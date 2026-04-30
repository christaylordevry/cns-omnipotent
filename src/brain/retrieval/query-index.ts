import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CnsError } from "../../errors.js";
import type { Embedder, EmbedderMetadata } from "../embedder.js";
import type { QualityMetadata } from "../quality.js";
import { computeQualityMultiplierComponents, type QualityMultiplierComponents } from "./quality-weighting.js";

const MAX_TOPK = 50;
const FRESHNESS_STALE_SAMPLE_PENALTY = 0.85;

const IndexArtifactSchema = z.object({
  schema_version: z.literal(1),
  embedder: z.object({
    providerId: z.string(),
    modelId: z.string(),
  }),
  records: z.array(
    z.object({
      path: z.string(),
      embedding: z.array(z.number()),
      quality: z
        .object({
          status: z.enum(["draft", "in-progress", "reviewed", "archived"]).optional(),
          confidence_score: z.number().min(0).max(1).optional(),
          verification_status: z.enum(["pending", "verified", "disputed"]).optional(),
          pake_type: z.string().optional(),
        })
        .optional(),
    }),
  ),
  exclusions: z.array(z.unknown()).optional(),
});

type IndexArtifact = z.infer<typeof IndexArtifactSchema>;

const SiblingManifestSchema = z.object({
  schema_version: z.number().optional(),
  outcome: z.string().optional(),
  freshness: z
    .object({
      last_build_utc: z.string().optional(),
      estimated_stale_count: z.number().optional(),
      estimated_stale_sample: z.array(z.string()).optional(),
    })
    .optional(),
});

type SiblingManifest = z.infer<typeof SiblingManifestSchema>;

type QueryWarningCode =
  | "MANIFEST_MISSING"
  | "MANIFEST_UNREADABLE"
  | "MANIFEST_OUTCOME_NOT_SUCCESS"
  | "INDEX_ESTIMATED_STALE"
  | "ZERO_VECTOR_QUERY"
  | "ZERO_VECTOR_RECORD"
  | "UNSAFE_RECORD_PATH"
  | "DIMENSION_MISMATCH"
  | "TOPK_CAPPED"
  | "FRESHNESS_PENALTY_APPLIED";

export type QueryBrainIndexWarning = {
  code: QueryWarningCode;
  message: string;
};

export type QueryBrainIndexParams = {
  /** Absolute path to brain-index.json */
  indexPath: string;
  query: string;
  topK?: number;
  minScore?: number;
  /** Default: true. When false, ranking is pure cosine similarity. */
  qualityWeighting?: boolean;
  includeScores?: boolean;
  explain?: boolean;
  includeEmbedderMetadata?: boolean;
  /** Embedder instance (tests can inject deterministic fakes; production can inject real adapters). */
  embedder: Embedder;
};

export type QueryBrainIndexScoreComponents = {
  rawSimilarity: number;
  qualityMultiplier: number;
  quality: QualityMultiplierComponents;
  freshnessPenalty: number;
  staleSampleMatch: boolean;
  finalScore: number;
};

export type QueryBrainIndexResultItem = {
  path: string;
  score?: number;
  components?: QueryBrainIndexScoreComponents;
};

export type QueryBrainIndexOutput = {
  embedder?: EmbedderMetadata;
  results: QueryBrainIndexResultItem[];
  warnings?: QueryBrainIndexWarning[];
  provenance?: {
    /** From sibling brain-index-manifest.json freshness.last_build_utc, if present. */
    last_build_utc?: string;
  };
};

type SimilarityFailReason = "ZERO_VECTOR" | "DIMENSION_MISMATCH" | "NON_FINITE";

function normalizeVaultRelPath(input: string): string {
  // Normalize basic manifest/index path variations to a POSIX-ish vault-relative form.
  // (We still validate safety separately.)
  let p = input.replaceAll("\\", "/");
  if (p.startsWith("./")) {
    p = p.slice(2);
  }
  return p;
}

function isSafeVaultRelPath(p: string): boolean {
  // Disallow absolute paths, traversal, and Windows drive roots.
  if (p.length === 0) return false;
  if (p.startsWith("/")) return false;
  if (/^[A-Za-z]:\//.test(p)) return false;
  if (p.includes("\0")) return false;
  if (p.split("/").some((seg) => seg === ".." || seg === "." || seg.length === 0)) return false;
  return true;
}

function cosineSimilarity(
  a: number[],
  b: number[],
): { ok: true; score: number } | { ok: false; reason: SimilarityFailReason } {
  if (a.length === 0 || b.length === 0) {
    return { ok: false, reason: "ZERO_VECTOR" };
  }
  if (a.length !== b.length) {
    return { ok: false, reason: "DIMENSION_MISMATCH" };
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) {
    return { ok: false, reason: "ZERO_VECTOR" };
  }
  const score = dot / (Math.sqrt(na) * Math.sqrt(nb));
  if (!Number.isFinite(score)) {
    return { ok: false, reason: "NON_FINITE" };
  }
  return { ok: true, score };
}

function stableSortByScoreThenPath<T extends { path: string; score: number }>(items: T[]): T[] {
  return items.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path, "en"));
}

function staleSamplePathsFromManifest(manifest: Awaited<ReturnType<typeof tryLoadSiblingManifest>>): Set<string> {
  if (!manifest.ok) {
    return new Set();
  }
  const raw = manifest.manifest.freshness?.estimated_stale_sample ?? [];
  return new Set(raw.map(normalizeVaultRelPath));
}

async function loadIndexArtifact(indexPath: string): Promise<IndexArtifact> {
  let raw: string;
  try {
    raw = await readFile(indexPath, "utf8");
  } catch {
    throw new CnsError("NOT_FOUND", "Index artifact not found.", { code: "INDEX_NOT_FOUND" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CnsError("SCHEMA_INVALID", "Index artifact is not valid JSON.", { code: "INDEX_JSON_INVALID" });
  }

  const r = IndexArtifactSchema.safeParse(parsed);
  if (!r.success) {
    throw new CnsError("SCHEMA_INVALID", "Index artifact schema is invalid.", { code: "INDEX_SCHEMA_INVALID" });
  }
  return r.data;
}

async function tryLoadSiblingManifest(
  indexPath: string,
): Promise<{ ok: true; manifest: SiblingManifest } | { ok: false; kind: "missing" } | { ok: false; kind: "unreadable" }> {
  const dir = path.dirname(indexPath);
  const manifestPath = path.join(dir, "brain-index-manifest.json");
  try {
    const txt = await readFile(manifestPath, "utf8");
    const parsed = SiblingManifestSchema.safeParse(JSON.parse(txt));
    if (!parsed.success) {
      return { ok: false, kind: "unreadable" };
    }
    return { ok: true, manifest: parsed.data };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, kind: "missing" };
    }
    return { ok: false, kind: "unreadable" };
  }
}

function collectManifestWarnings(
  manifest: Awaited<ReturnType<typeof tryLoadSiblingManifest>>,
  warnings: QueryBrainIndexWarning[],
  provenance: NonNullable<QueryBrainIndexOutput["provenance"]>,
): void {
  if (manifest.ok) {
    const buildUtc = manifest.manifest.freshness?.last_build_utc;
    if (buildUtc !== undefined) {
      provenance.last_build_utc = buildUtc;
    }
    const outcome = manifest.manifest.outcome;
    if (outcome && outcome !== "success") {
      warnings.push({
        code: "MANIFEST_OUTCOME_NOT_SUCCESS",
        message: "Index manifest outcome is not success; results may be unreliable.",
      });
    }
    const estimatedStale = Number(manifest.manifest.freshness?.estimated_stale_count ?? 0);
    if (Number.isFinite(estimatedStale) && estimatedStale > 0) {
      warnings.push({
        code: "INDEX_ESTIMATED_STALE",
        message: `Manifest indicates estimated stale count > 0 (${estimatedStale}).`,
      });
    }
  } else if (manifest.kind === "missing") {
    warnings.push({
      code: "MANIFEST_MISSING",
      message: "Sibling brain-index-manifest.json not found; freshness signals unavailable.",
    });
  } else {
    warnings.push({
      code: "MANIFEST_UNREADABLE",
      message: "Sibling brain-index-manifest.json could not be read/parsed; freshness signals unavailable.",
    });
  }
}

function buildOutput(
  index: IndexArtifact,
  results: QueryBrainIndexResultItem[],
  warnings: QueryBrainIndexWarning[],
  provenance: NonNullable<QueryBrainIndexOutput["provenance"]>,
  includeEmbedderMetadata: boolean,
): QueryBrainIndexOutput {
  return {
    ...(includeEmbedderMetadata ? { embedder: index.embedder } : {}),
    results,
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(Object.keys(provenance).length > 0 ? { provenance } : {}),
  };
}

export async function queryBrainIndex(params: QueryBrainIndexParams): Promise<QueryBrainIndexOutput> {
  const rawTopK = params.topK ?? 10;
  const topK = Math.max(0, Math.min(MAX_TOPK, Math.floor(rawTopK)));
  const includeScores = params.includeScores ?? true;
  const explain = params.explain ?? false;
  const includeEmbedderMetadata = params.includeEmbedderMetadata ?? true;
  const minScore = typeof params.minScore === "number" && Number.isFinite(params.minScore) ? params.minScore : undefined;
  const qualityWeighting = params.qualityWeighting ?? true;

  const warnings: QueryBrainIndexWarning[] = [];

  if (Number.isFinite(rawTopK) && rawTopK > MAX_TOPK) {
    warnings.push({
      code: "TOPK_CAPPED",
      message: `Requested topK ${rawTopK} exceeds cap of ${MAX_TOPK}; clamped to ${MAX_TOPK}.`,
    });
  }

  const index = await loadIndexArtifact(params.indexPath);

  const manifest = await tryLoadSiblingManifest(params.indexPath);
  const provenance: NonNullable<QueryBrainIndexOutput["provenance"]> = {};
  collectManifestWarnings(manifest, warnings, provenance);
  const staleSamplePaths = staleSamplePathsFromManifest(manifest);

  const queryVec = await params.embedder.embed(params.query);
  const queryNorm = cosineSimilarity(queryVec, queryVec);
  if (!queryNorm.ok) {
    warnings.push({
      code: "ZERO_VECTOR_QUERY",
      message: "Query embedding is empty, zero, or non-finite; no results returned.",
    });
    return buildOutput(index, [], warnings, provenance, includeEmbedderMetadata);
  }

  const scored: Array<{ path: string; score: number; components: QueryBrainIndexScoreComponents }> = [];
  let zeroRecordCount = 0;
  let dimensionMismatchCount = 0;
  let freshnessPenaltyCount = 0;
  let unsafePathCount = 0;

  for (const rec of index.records) {
    const normalizedPath = normalizeVaultRelPath(rec.path);
    if (!isSafeVaultRelPath(normalizedPath)) {
      unsafePathCount++;
      continue;
    }
    const sim = cosineSimilarity(queryVec, rec.embedding);
    if (!sim.ok) {
      if (sim.reason === "DIMENSION_MISMATCH") dimensionMismatchCount++;
      else zeroRecordCount++;
      continue;
    }
    if (qualityWeighting && rec.quality?.status === "archived") {
      continue;
    }
    const quality = qualityWeighting
      ? computeQualityMultiplierComponents(rec.quality as QualityMetadata | undefined)
      : {
          statusWeight: 1,
          confidenceWeight: 1,
          verificationWeight: 1,
          typeWeight: 1,
          flatPenaltyApplied: false,
          multiplier: 1,
        };
    const staleSampleMatch = qualityWeighting && staleSamplePaths.has(normalizedPath);
    const freshnessPenalty = staleSampleMatch ? FRESHNESS_STALE_SAMPLE_PENALTY : 1;
    const finalScore = sim.score * quality.multiplier * freshnessPenalty;
    if (minScore !== undefined && finalScore < minScore) {
      continue;
    }
    if (staleSampleMatch) {
      freshnessPenaltyCount++;
    }
    scored.push({
      path: normalizedPath,
      score: finalScore,
      components: {
        rawSimilarity: sim.score,
        qualityMultiplier: quality.multiplier,
        quality,
        freshnessPenalty,
        staleSampleMatch,
        finalScore,
      },
    });
  }

  if (unsafePathCount > 0) {
    warnings.push({
      code: "UNSAFE_RECORD_PATH",
      message: `Skipped ${unsafePathCount} record(s) with unsafe or non-vault-relative paths.`,
    });
  }
  if (zeroRecordCount > 0) {
    warnings.push({
      code: "ZERO_VECTOR_RECORD",
      message: `Skipped ${zeroRecordCount} record(s) with empty/zero or non-finite embeddings.`,
    });
  }
  if (dimensionMismatchCount > 0) {
    warnings.push({
      code: "DIMENSION_MISMATCH",
      message: `Skipped ${dimensionMismatchCount} record(s) with embedding dimension mismatch.`,
    });
  }
  if (freshnessPenaltyCount > 0) {
    warnings.push({
      code: "FRESHNESS_PENALTY_APPLIED",
      message: `Applied freshness penalty to ${freshnessPenaltyCount} result candidate(s) from the manifest stale sample.`,
    });
  }

  const ordered = stableSortByScoreThenPath(scored).slice(0, topK);
  const results: QueryBrainIndexResultItem[] = ordered.map((r) => ({
    path: r.path,
    ...(includeScores ? { score: r.score } : {}),
    ...(explain ? { components: r.components } : {}),
  }));

  return buildOutput(index, results, warnings, provenance, includeEmbedderMetadata);
}
