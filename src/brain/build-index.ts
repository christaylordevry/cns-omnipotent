import { mkdir, readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { getRealVaultRoot, resolveReadTargetCanonical } from "../read-boundary.js";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import {
  isDailyNotesVaultPath,
  isMetaLogsVaultPath,
  stripAgentLogSectionFromMarkdown,
} from "./brain-path-utils.js";
import type { BrainCorpusAllowlist } from "./corpus-allowlist.js";
import type { Embedder, EmbedderMetadata } from "./embedder.js";
import type { QualityMetadata } from "./quality.js";
import { effectiveCorpusRoots } from "./load-corpus-allowlist.js";
import { evaluateNoteForEmbeddingSecretGate } from "./indexing-secret-gate.js";
import { PAKE_TYPE_VALUES } from "../pake/schemas.js";

export type BuildIndexExclusion = {
  path: string;
  reasonCode: string;
  detail?: Record<string, unknown>;
};

export type DiscoverMarkdownCandidatesResult = {
  candidates: string[];
  hardExcludedMetaLogsCount: number;
};

export type BuildIndexRecord = {
  path: string;
  embedding: number[];
  quality?: QualityMetadata;
};

export type BuildIndexResult = {
  embedder: EmbedderMetadata;
  records: BuildIndexRecord[];
  exclusions: BuildIndexExclusion[];
};

function toPosixVaultRel(p: string): string {
  return p.split(path.sep).join("/");
}

function isEnoent(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT");
}

function underEffectiveRoot(vaultRelPosix: string, roots: string[]): boolean {
  return roots.some((r) => vaultRelPosix === r || vaultRelPosix.startsWith(`${r}/`));
}

function isWithinCanonicalRoot(root: string, candidate: string): boolean {
  if (candidate === root) {
    return true;
  }
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return candidate.startsWith(prefix);
}

/**
 * Discover markdown candidates under effective corpus roots, sorted lexically by vault-relative POSIX path.
 * Skips `_meta/logs/**` regardless of allowlist.
 */
export async function discoverMarkdownCandidates(
  vaultRoot: string,
  allowlist: BrainCorpusAllowlist,
): Promise<DiscoverMarkdownCandidatesResult> {
  const roots = effectiveCorpusRoots(allowlist);
  const found = new Set<string>();
  const metaLogsLexical = path.join(vaultRoot, "_meta", "logs");
  let realMetaLogsRoot: string | null = null;
  let hardExcludedMetaLogsCount = 0;

  try {
    realMetaLogsRoot = await realpath(metaLogsLexical);
  } catch (err) {
    if (!isEnoent(err)) {
      throw err;
    }
  }

  async function walk(absDir: string, vaultRelPosix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch (err) {
      if (isEnoent(err)) {
        return;
      }
      throw err;
    }

    for (const ent of entries) {
      const name = String(ent.name);
      const childRel = vaultRelPosix ? `${vaultRelPosix}/${name}` : name;
      const posixRel = toPosixVaultRel(childRel);
      if (isMetaLogsVaultPath(posixRel)) {
        hardExcludedMetaLogsCount++;
        continue;
      }
      const absChild = path.join(absDir, name);
      if (realMetaLogsRoot !== null) {
        try {
          const canonicalChild = await realpath(absChild);
          if (isWithinCanonicalRoot(realMetaLogsRoot, canonicalChild)) {
            hardExcludedMetaLogsCount++;
            continue;
          }
        } catch (err) {
          if (!isEnoent(err)) {
            throw err;
          }
        }
      }
      if (ent.isDirectory()) {
        await walk(absChild, posixRel);
      } else if (ent.isSymbolicLink()) {
        let st;
        try {
          st = await stat(absChild);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          await walk(absChild, posixRel);
        } else if (st.isFile() && name.toLowerCase().endsWith(".md") && underEffectiveRoot(posixRel, roots)) {
          found.add(posixRel);
        }
      } else if (ent.isFile() && name.toLowerCase().endsWith(".md")) {
        if (!underEffectiveRoot(posixRel, roots)) {
          continue;
        }
        found.add(posixRel);
      }
    }
  }

  for (const root of roots) {
    const abs = path.join(vaultRoot, root);
    await walk(abs, root);
  }

  return {
    candidates: [...found].sort((a, b) => a.localeCompare(b, "en")),
    hardExcludedMetaLogsCount,
  };
}

function sanitizeBoundaryDetail(err: CnsError): Record<string, unknown> {
  const code = err.code;
  if (code === "VAULT_BOUNDARY") {
    return { code };
  }
  return { code };
}

function pakeTypeAllowed(allowlist: BrainCorpusAllowlist, frontmatter: Record<string, unknown>): boolean {
  const filter = allowlist.pake_types;
  if (filter === undefined || filter.length === 0) {
    return true;
  }
  const pt = frontmatter.pake_type;
  if (typeof pt !== "string") {
    return false;
  }
  return filter.includes(pt);
}

function extractQualityMetadata(frontmatter: Record<string, unknown>): QualityMetadata | undefined {
  const out: QualityMetadata = {};

  const status = frontmatter.status;
  if (status === "draft" || status === "in-progress" || status === "reviewed" || status === "archived") {
    out.status = status;
  }

  const confidence = frontmatter.confidence_score;
  if (typeof confidence === "number" && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) {
    out.confidence_score = confidence;
  }

  const verification = frontmatter.verification_status;
  if (verification === "pending" || verification === "verified" || verification === "disputed") {
    out.verification_status = verification;
  }

  const pt = frontmatter.pake_type;
  if (typeof pt === "string" && (PAKE_TYPE_VALUES as readonly string[]).includes(pt)) {
    out.pake_type = pt as QualityMetadata["pake_type"];
  }

  if (Object.keys(out).length === 0) {
    return undefined;
  }
  return out;
}

/**
 * Runs the Story 12.4 gate chain: canonical read → frontmatter → optional pake_types → secret gate → embed.
 */
export type RunBuildIndexResult = {
  result: BuildIndexResult;
  candidates: string[];
  hardExcludedMetaLogsCount: number;
};

export async function runBuildIndex(
  vaultRoot: string,
  allowlist: BrainCorpusAllowlist,
  embedder: Embedder,
): Promise<RunBuildIndexResult> {
  const records: BuildIndexRecord[] = [];
  const exclusions: BuildIndexExclusion[] = [];

  const discovered = await discoverMarkdownCandidates(vaultRoot, allowlist);
  const candidates = discovered.candidates;
  const realRoot = await getRealVaultRoot(vaultRoot);

  for (const vaultRel of candidates) {
    let raw: string;
    try {
      const absolute = resolveVaultPath(vaultRoot, vaultRel);
      const canonical = await resolveReadTargetCanonical(realRoot, absolute, {
        path: vaultRel,
        notFoundMessage: `Note not found: ${vaultRel}`,
      });
      raw = await readFile(canonical, "utf8");
    } catch (err) {
      if (err instanceof CnsError) {
        exclusions.push({
          path: vaultRel,
          reasonCode: err.code,
          detail: sanitizeBoundaryDetail(err),
        });
        continue;
      }
      exclusions.push({
        path: vaultRel,
        reasonCode: "IO_ERROR",
        detail: { code: "IO_ERROR" },
      });
      continue;
    }

    let parsed: { frontmatter: Record<string, unknown>; body: string };
    try {
      parsed = parseNoteFrontmatter(raw);
    } catch (err) {
      if (err instanceof CnsError) {
        exclusions.push({
          path: vaultRel,
          reasonCode: "FRONTMATTER_PARSE",
          detail: { code: err.code },
        });
        continue;
      }
      exclusions.push({
        path: vaultRel,
        reasonCode: "FRONTMATTER_PARSE",
        detail: { code: "IO_ERROR" },
      });
      continue;
    }

    if (!pakeTypeAllowed(allowlist, parsed.frontmatter)) {
      exclusions.push({
        path: vaultRel,
        reasonCode: "PAKE_TYPE_FILTER",
        detail: { code: "PAKE_TYPE_FILTER" },
      });
      continue;
    }

    const secret = await evaluateNoteForEmbeddingSecretGate(vaultRoot, raw);
    if (!secret.eligible) {
      exclusions.push({
        path: vaultRel,
        reasonCode: secret.reasonCode,
        detail: { patternId: secret.patternId },
      });
      continue;
    }

    const quality = extractQualityMetadata(parsed.frontmatter);

    let textForEmbed = raw;
    if (isDailyNotesVaultPath(vaultRel)) {
      const strippedBody = stripAgentLogSectionFromMarkdown(parsed.body);
      textForEmbed = matter.stringify(strippedBody, parsed.frontmatter);
    }

    const embedding = await embedder.embed(textForEmbed);
    records.push({ path: vaultRel, embedding, ...(quality ? { quality } : {}) });
  }

  return {
    result: {
      embedder: embedder.metadata,
      records,
      exclusions: exclusions.sort((a, b) => a.path.localeCompare(b.path, "en")),
    },
    candidates,
    hardExcludedMetaLogsCount: discovered.hardExcludedMetaLogsCount,
  };
}

/** Stable JSON artifact: deterministic field order, sorted arrays; no timestamps. */
export function serializeBuildIndexArtifact(result: BuildIndexResult): string {
  const sortedRecords = [...result.records].sort((a, b) => a.path.localeCompare(b.path, "en"));
  const sortedExclusions = [...result.exclusions].sort((a, b) => a.path.localeCompare(b.path, "en"));
  const obj = {
    schema_version: 1,
    embedder: result.embedder,
    records: sortedRecords,
    exclusions: sortedExclusions,
  };
  return `${JSON.stringify(obj, null, 2)}\n`;
}

export async function writeBuildIndexArtifact(
  vaultRoot: string,
  outputDir: string,
  result: BuildIndexResult,
): Promise<string> {
  const realOut = await assertOutputDirOutsideVault(vaultRoot, outputDir);
  const outPath = path.join(realOut, "brain-index.json");
  const tmpPath = path.join(realOut, `.brain-index.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmpPath, serializeBuildIndexArtifact(result), "utf8");
  await rename(tmpPath, outPath);
  return outPath;
}

/**
 * Asserts the output directory is not inside the vault (canonical check). Creates the directory first.
 */
export async function assertOutputDirOutsideVault(vaultRoot: string, outputDirAbs: string): Promise<string> {
  const realVault = await getRealVaultRoot(vaultRoot);
  const resolvedOut = path.resolve(outputDirAbs);
  await mkdir(resolvedOut, { recursive: true });
  const realOut = await realpath(resolvedOut);
  if (isWithinCanonicalRoot(realVault, realOut)) {
    throw new CnsError("UNSUPPORTED", "Output directory must be outside the vault boundary.", {
      code: "OUTPUT_INSIDE_VAULT",
    });
  }
  return realOut;
}
