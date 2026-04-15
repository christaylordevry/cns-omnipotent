import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { getRealVaultRoot, resolveReadTargetCanonical } from "../read-boundary.js";
import type { BrainCorpusAllowlist } from "./corpus-allowlist.js";
import type { EmbedderMetadata } from "./embedder.js";
import { INDEXING_SECRET_EXCLUSION_REASON } from "./indexing-secret-gate.js";
import type { BuildIndexExclusion } from "./build-index.js";
import { assertOutputDirOutsideVault } from "./build-index.js";
import { effectiveCorpusRoots } from "./load-corpus-allowlist.js";

export const BRAIN_INDEX_MANIFEST_SCHEMA_VERSION = 1 as const;
export const BRAIN_INDEX_MANIFEST_FILENAME = "brain-index-manifest.json" as const;
export const BRAIN_INDEX_MANIFEST_FAILURE_CAP = 50 as const;

export const HARD_EXCLUDE_META_LOGS_REASON = "HARD_EXCLUDE_META_LOGS" as const;

export type BrainIndexManifestOutcome = "success" | "failed";

export type BrainIndexManifestFailure = {
  code: string;
  message: string;
};

export type BrainIndexManifestAllowlistSnapshot = {
  subtrees: string[];
  inbox: { enabled: boolean };
  pake_types?: string[];
  /** Presence-only; never echo operator rationale text. */
  protected_corpora_opt_in?: { enabled: true };
};

export type BrainIndexManifestCounts = {
  candidates_discovered: number;
  embedded: number;
  excluded: number;
  failed: number;
};

export type BrainIndexManifestVaultSnapshot = {
  vault_root_realpath_hash: string;
  markdown_candidates_discovered: number;
  max_mtime_ms: number | null;
  max_mtime_utc: string | null;
};

export type BrainIndexManifestFreshness = {
  last_build_utc: string;
  estimated_stale_count: number;
  estimated_stale_sample: string[];
};

export type BrainIndexManifestFailureDetail = {
  code?: string;
  patternId?: string;
};

export type BrainIndexManifestFailureSummary = {
  path: string;
  reasonCode: string;
  detail?: BrainIndexManifestFailureDetail;
};

export type BrainIndexManifest = {
  schema_version: typeof BRAIN_INDEX_MANIFEST_SCHEMA_VERSION;
  outcome: BrainIndexManifestOutcome;
  build_timestamp_utc: string;

  allowlist_snapshot: BrainIndexManifestAllowlistSnapshot;
  embedder: EmbedderMetadata;

  counts: BrainIndexManifestCounts;
  exclusion_reason_breakdown: Record<string, number>;
  failures: BrainIndexManifestFailureSummary[];

  vault_snapshot: BrainIndexManifestVaultSnapshot;
  freshness: BrainIndexManifestFreshness;

  failure?: BrainIndexManifestFailure;
};

function toUtcIso(ms: number): string {
  return new Date(ms).toISOString();
}

function stableReasonBreakdown(entries: Array<[string, number]>): Record<string, number> {
  const filtered = entries.filter(([, count]) => count > 0);
  filtered.sort(([a], [b]) => a.localeCompare(b, "en"));
  return Object.fromEntries(filtered);
}

export function allowlistToSnapshot(allowlist: BrainCorpusAllowlist): BrainIndexManifestAllowlistSnapshot {
  const roots = effectiveCorpusRoots(allowlist);
  const out: BrainIndexManifestAllowlistSnapshot = {
    subtrees: [...allowlist.subtrees].sort((a, b) => a.localeCompare(b, "en")),
    inbox: { enabled: allowlist.inbox.enabled },
  };
  if (allowlist.pake_types && allowlist.pake_types.length > 0) {
    out.pake_types = [...allowlist.pake_types].sort((a, b) => a.localeCompare(b, "en"));
  }
  if (allowlist.protected_corpora_opt_in) {
    out.protected_corpora_opt_in = { enabled: true };
  }
  // The effective roots are used by discovery; keeping snapshot minimal and safe.
  // `roots` is currently unused but retained to reflect the “allowlist snapshot” intent.
  void roots;
  return out;
}

export type CandidateMtime = { path: string; mtimeMs: number };

export function computeFreshnessFromMtimes(
  buildTimestampMs: number,
  mtimes: CandidateMtime[],
  sampleLimit = 20,
): { estimated_stale_count: number; estimated_stale_sample: string[]; max_mtime_ms: number | null; max_mtime_utc: string | null } {
  let max: number | null = null;
  const stale: CandidateMtime[] = [];
  for (const c of mtimes) {
    if (max === null || c.mtimeMs > max) {
      max = c.mtimeMs;
    }
    if (c.mtimeMs > buildTimestampMs) {
      stale.push(c);
    }
  }
  stale.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en"));
  return {
    estimated_stale_count: stale.length,
    estimated_stale_sample: stale.slice(0, sampleLimit).map((s) => s.path),
    max_mtime_ms: max,
    max_mtime_utc: max === null ? null : toUtcIso(max),
  };
}

export async function computeVaultSnapshotAndFreshness(
  vaultRoot: string,
  candidates: string[],
  buildTimestampMs: number,
  sampleLimit = 20,
  failureCap = 50,
): Promise<{
  vault_snapshot: BrainIndexManifestVaultSnapshot;
  freshness: BrainIndexManifestFreshness;
  drift_failures: Array<{ path: string; reasonCode: string }>;
}> {
  const realRoot = await getRealVaultRoot(vaultRoot);
  const vaultHash = createHash("sha256").update(realRoot, "utf8").digest("hex");

  const mtimes: CandidateMtime[] = [];
  const driftFailures: Array<{ path: string; reasonCode: string }> = [];

  for (const vaultRel of candidates) {
    try {
      const absolute = resolveVaultPath(vaultRoot, vaultRel);
      const canonical = await resolveReadTargetCanonical(realRoot, absolute, {
        path: vaultRel,
        notFoundMessage: `Note not found: ${vaultRel}`,
      });
      const st = await stat(canonical);
      mtimes.push({ path: vaultRel, mtimeMs: st.mtimeMs });
    } catch (err) {
      const reasonCode =
        err instanceof CnsError
          ? err.code
          : err && typeof err === "object" && "code" in err
            ? String((err as NodeJS.ErrnoException).code ?? "IO_ERROR")
            : "IO_ERROR";
      driftFailures.push({ path: vaultRel, reasonCode });
      if (driftFailures.length >= failureCap) {
        break;
      }
    }
  }

  const freshnessCalc = computeFreshnessFromMtimes(buildTimestampMs, mtimes, sampleLimit);

  return {
    vault_snapshot: {
      vault_root_realpath_hash: vaultHash,
      markdown_candidates_discovered: candidates.length,
      max_mtime_ms: freshnessCalc.max_mtime_ms,
      max_mtime_utc: freshnessCalc.max_mtime_utc,
    },
    freshness: {
      last_build_utc: toUtcIso(buildTimestampMs),
      estimated_stale_count: freshnessCalc.estimated_stale_count,
      estimated_stale_sample: freshnessCalc.estimated_stale_sample,
    },
    drift_failures: driftFailures,
  };
}

function isPerFileFailure(ex: BuildIndexExclusion): boolean {
  return ex.reasonCode === "IO_ERROR" || ex.reasonCode === "FRONTMATTER_PARSE";
}

export function buildExclusionReasonBreakdown(
  exclusions: BuildIndexExclusion[],
  hardExcludedMetaLogsCount: number,
): Record<string, number> {
  const counts = new Map<string, number>();
  for (const ex of exclusions) {
    counts.set(ex.reasonCode, (counts.get(ex.reasonCode) ?? 0) + 1);
  }
  if (hardExcludedMetaLogsCount > 0) {
    counts.set(HARD_EXCLUDE_META_LOGS_REASON, (counts.get(HARD_EXCLUDE_META_LOGS_REASON) ?? 0) + hardExcludedMetaLogsCount);
  }
  // Ensure the secret gate reason is always representable for consumers.
  if (!counts.has(INDEXING_SECRET_EXCLUSION_REASON)) {
    counts.set(INDEXING_SECRET_EXCLUSION_REASON, 0);
  }
  return stableReasonBreakdown([...counts.entries()]);
}

export function buildCounts(
  candidatesDiscovered: number,
  embedded: number,
  exclusions: BuildIndexExclusion[],
): BrainIndexManifestCounts {
  const failed = exclusions.filter(isPerFileFailure).length;
  const excluded = exclusions.length - failed;
  return {
    candidates_discovered: candidatesDiscovered,
    embedded,
    excluded,
    failed,
  };
}

export function serializeBrainIndexManifest(manifest: BrainIndexManifest): string {
  const obj: BrainIndexManifest = {
    schema_version: manifest.schema_version,
    outcome: manifest.outcome,
    build_timestamp_utc: manifest.build_timestamp_utc,
    allowlist_snapshot: manifest.allowlist_snapshot,
    embedder: manifest.embedder,
    counts: manifest.counts,
    exclusion_reason_breakdown: manifest.exclusion_reason_breakdown,
    failures: normalizeManifestFailures(manifest.failures),
    vault_snapshot: manifest.vault_snapshot,
    freshness: manifest.freshness,
    ...(manifest.failure ? { failure: manifest.failure } : {}),
  };
  return `${JSON.stringify(obj, null, 2)}\n`;
}

export function sanitizeFailureDetail(detail: unknown): BrainIndexManifestFailureDetail | undefined {
  if (!detail || typeof detail !== "object") {
    return undefined;
  }
  const detailRecord = detail as Record<string, unknown>;
  const out: BrainIndexManifestFailureDetail = {};
  if ("code" in detailRecord && typeof detailRecord.code === "string") {
    out.code = detailRecord.code;
  }
  if ("patternId" in detailRecord && typeof detailRecord.patternId === "string") {
    out.patternId = detailRecord.patternId;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

function sanitizeFailurePath(failurePath: unknown): string {
  if (typeof failurePath !== "string") {
    return "[redacted]";
  }
  const singleLine = failurePath.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const normalized = singleLine.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    return "[redacted]";
  }
  return normalized;
}

export function normalizeManifestFailures(
  failures: BrainIndexManifestFailureSummary[],
  cap = BRAIN_INDEX_MANIFEST_FAILURE_CAP,
): BrainIndexManifestFailureSummary[] {
  return failures.slice(0, cap).map((failure) => ({
    path: sanitizeFailurePath(failure.path),
    reasonCode: failure.reasonCode,
    detail: sanitizeFailureDetail(failure.detail),
  }));
}

export function buildBoundedFailureSummaries(
  exclusions: BuildIndexExclusion[],
  cap = BRAIN_INDEX_MANIFEST_FAILURE_CAP,
): BrainIndexManifestFailureSummary[] {
  const failures = exclusions
    .filter(isPerFileFailure)
    .sort((a, b) => a.path.localeCompare(b.path, "en"))
    .map((e) => ({
      path: e.path,
      reasonCode: e.reasonCode,
      detail: sanitizeFailureDetail(e.detail),
    }));
  return normalizeManifestFailures(failures, cap);
}

export function failureToManifestFailure(err: unknown): BrainIndexManifestFailure {
  if (err instanceof CnsError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: "UNEXPECTED", message: err.message };
  }
  return { code: "UNEXPECTED", message: String(err) };
}

export function pickFailureCode(err: unknown): string {
  if (err instanceof CnsError) {
    return err.code;
  }
  return "UNEXPECTED";
}

export function safeFailureMessage(err: unknown): string {
  const f = failureToManifestFailure(err);
  // Avoid accidental multiline / stack traces in operator-facing manifests.
  return String(f.message).split("\n")[0] ?? "Failure";
}

export function deriveOutputManifestPath(outputDir: string): string {
  return path.join(outputDir, BRAIN_INDEX_MANIFEST_FILENAME);
}

export async function writeBrainIndexManifest(
  vaultRoot: string,
  outputDir: string,
  manifest: BrainIndexManifest,
): Promise<string> {
  const realOut = await assertOutputDirOutsideVault(vaultRoot, outputDir);
  const outPath = deriveOutputManifestPath(realOut);
  const tmpPath = path.join(realOut, `.brain-index-manifest.${process.pid}.${Date.now()}.tmp`);
  // writeFile + rename is atomic on same filesystem
  const { writeFile, rename } = await import("node:fs/promises");
  await writeFile(tmpPath, serializeBrainIndexManifest(manifest), "utf8");
  await rename(tmpPath, outPath);
  return outPath;
}

