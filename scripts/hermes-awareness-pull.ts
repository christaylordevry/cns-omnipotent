/**
 * Hermes awareness pull client (Story 77-2) — GET snapshot from Convex HTTP route,
 * cache locally for FR12 pull pattern (no per-turn Convex calls).
 *
 * Usage:
 *   npx tsx scripts/hermes-awareness-pull.ts [--json] [--dry-run]
 *
 * Env: CONVEX_URL (.convex.cloud), HERMES_CONVEX_READ_KEY (WSL only).
 * Optional: HERMES_AWARENESS_URL, HERMES_AWARENESS_CACHE_PATH
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type McpStatusRow,
  type RunChainStatus,
  type SyncMetadata,
  type VaultHealth,
  normalizeConvexUrl,
} from "./dashboard-sync.js";

export const AWARENESS_PULL_TIMEOUT_MS = 30_000;
export const DEFAULT_HERMES_AWARENESS_CACHE_REL = ".hermes/memories/awareness-snapshot.json";

export const HERMES_AWARENESS_SNAPSHOT_KEYS = [
  "sync",
  "vault",
  "chain",
  "mcps",
  "digest",
  "entities",
  "investigations",
  "trends",
] as const;

export type HermesAwarenessSnapshotKey = (typeof HERMES_AWARENESS_SNAPSHOT_KEYS)[number];

export type DigestBrief = {
  digestRunId: string;
  ranAt: number;
  date: string;
  status: string;
  focusKeyword?: string;
  topTrend?: string;
  deepSignalSummary?: string;
} | null;

export type DigestSignalListItem = {
  digestSignalId: string;
  digestRunId: string;
  section: string;
  sourceType: string;
  title: string;
  summary?: string;
  url?: string;
  externalId?: string;
  score?: number;
  rank?: number;
  rankScore?: number;
  workspaceId?: string;
};

export type EntityMentionSignalRef = {
  digestSignalId: string;
  title: string;
  url?: string;
  sourceType: string;
};

export type EntityReason = {
  code: string;
  detail: string;
};

export type EntityLaneItem = {
  entityKey: string;
  entityType: string;
  displayName: string;
  platform?: string;
  activeCount: number;
  baselineDailyRate: number;
  sourceTypes: string[];
  momentumSummary: string;
  reasons: EntityReason[];
  evidence: EntityMentionSignalRef[];
};

export type HermesAwarenessDigestSection = {
  brief: DigestBrief;
  topSignals: DigestSignalListItem[];
};

export type HermesAwarenessEntitiesSection = {
  tracked: EntityLaneItem[];
  emerging: EntityLaneItem[];
  hasBaselineHistory: boolean;
  runDate?: string;
};

export type HermesAwarenessInvestigationsSummary = {
  totalItems: number;
  columnCounts: {
    triage: number;
    investigating: number;
    waiting: number;
    resolved: number;
  };
};

export type HermesAwarenessTrendAnomalyItem = {
  topicId: string;
  sourceId?: string;
  detectedAt: number;
  signalTimestamp: number;
  observedValue: number;
  expectedValue: number;
  sigmaDistance: number;
  direction: string;
  anomalyId: string;
  topicSlug: string;
  keyword: string;
  sourceLabel: string;
};

export type HermesAwarenessTrendScoreItem = {
  topicId: string;
  keyword: string;
  computedAt: number;
  lifecycleStage: string;
  previousLifecycleStage?: string;
  investmentScore: number;
  daysToPeak: number;
  momentumTrajectory: number[];
  trendType: string;
  trendSlope: number;
  rSquared: number;
  breakpoints: number[];
  volatilityRisk: number;
  declineRisk: number;
  timingRisk: number;
  platformRisk: number;
  overallRisk: number;
  hasAnomaly: boolean;
  topicSlug: string;
};

export type HermesAwarenessTrendsSection = {
  anomalies: HermesAwarenessTrendAnomalyItem[];
  scores: HermesAwarenessTrendScoreItem[];
};

/** Hand-mirrored from cns-dashboard/convex/validators.ts hermesAwarenessSnapshotValidator — keep in sync. */
export type HermesAwarenessSnapshot = {
  sync: SyncMetadata | null;
  vault: VaultHealth | null;
  chain: RunChainStatus | null;
  mcps: McpStatusRow[];
  digest: HermesAwarenessDigestSection;
  entities: HermesAwarenessEntitiesSection;
  investigations: HermesAwarenessInvestigationsSummary;
  trends: HermesAwarenessTrendsSection;
};

export type AwarenessCacheEnvelope = {
  pulledAt: number;
  sourceUrl: string;
  snapshot: HermesAwarenessSnapshot;
};

export function convexSiteUrlFromCloudUrl(cloudUrl: string): string {
  const normalized = normalizeConvexUrl(cloudUrl);
  if (!normalized.includes(".convex.cloud")) {
    throw new Error("CONVEX_URL must be a .convex.cloud deployment URL");
  }
  return normalized.replace(/\.convex\.cloud$/, ".convex.site");
}

export function buildAwarenessUrl(env: NodeJS.ProcessEnv): string {
  const override = env.HERMES_AWARENESS_URL?.trim();
  if (override) {
    return override;
  }
  const cloud = env.CONVEX_URL?.trim();
  if (!cloud) {
    throw new Error("CONVEX_URL is required");
  }
  return `${convexSiteUrlFromCloudUrl(cloud)}/hermes/awareness`;
}

export function verifyBearerHeader(
  headers: Record<string, string>,
  readKey: string,
): void {
  const auth = headers.Authorization ?? headers.authorization;
  if (auth !== `Bearer ${readKey}`) {
    throw new Error("Authorization header must be Bearer <HERMES_CONVEX_READ_KEY>");
  }
}

export function buildAwarenessRequest(opts: {
  url: string;
  readKey: string;
  timeoutMs?: number;
}): { url: string; init: RequestInit } {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.readKey}`,
  };
  verifyBearerHeader(headers, opts.readKey);
  return {
    url: opts.url,
    init: {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(opts.timeoutMs ?? AWARENESS_PULL_TIMEOUT_MS),
    },
  };
}

export function parseAwarenessResponse(body: unknown): HermesAwarenessSnapshot {
  if (typeof body !== "object" || body === null) {
    throw new Error("awareness response is not a JSON object");
  }
  for (const key of HERMES_AWARENESS_SNAPSHOT_KEYS) {
    if (!(key in body)) {
      throw new Error(`awareness response missing key: ${key}`);
    }
  }
  return body as HermesAwarenessSnapshot;
}

export function resolveAwarenessCachePath(env: NodeJS.ProcessEnv): string {
  const override = env.HERMES_AWARENESS_CACHE_PATH?.trim();
  if (override) {
    return override.startsWith("~")
      ? path.join(os.homedir(), override.slice(1))
      : override;
  }
  return path.join(os.homedir(), DEFAULT_HERMES_AWARENESS_CACHE_REL);
}

export function buildAwarenessCacheEnvelope(
  sourceUrl: string,
  snapshot: HermesAwarenessSnapshot,
  pulledAt = Date.now(),
): AwarenessCacheEnvelope {
  return { pulledAt, sourceUrl, snapshot };
}

export async function writeAwarenessCache(
  cachePath: string,
  envelope: AwarenessCacheEnvelope,
): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  const tempPath = `${cachePath}.tmp.${process.pid}`;
  const payload = `${JSON.stringify(envelope, null, 2)}\n`;
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, cachePath);
}

export async function readAwarenessCache(cachePath: string): Promise<AwarenessCacheEnvelope | null> {
  try {
    const raw = await readFile(cachePath, "utf8");
    return JSON.parse(raw) as AwarenessCacheEnvelope;
  } catch {
    return null;
  }
}

export function validatePullEnv(env: NodeJS.ProcessEnv): { url: string; readKey: string } {
  const readKey = env.HERMES_CONVEX_READ_KEY?.trim();
  if (!readKey) {
    throw new Error("HERMES_CONVEX_READ_KEY is required");
  }
  const url = buildAwarenessUrl(env);
  return { url, readKey };
}

export async function pullAwarenessSnapshot(opts: {
  url: string;
  readKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<HermesAwarenessSnapshot> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const { url, init } = buildAwarenessRequest({
    url: opts.url,
    readKey: opts.readKey,
    timeoutMs: opts.timeoutMs,
  });
  const response = await fetchImpl(url, init);
  if (response.status === 401) {
    throw new Error("awareness pull unauthorized (check HERMES_CONVEX_READ_KEY)");
  }
  if (!response.ok) {
    throw new Error(`awareness pull HTTP ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("awareness pull response was not valid JSON");
  }
  return parseAwarenessResponse(body);
}

export type PullCliOptions = {
  json: boolean;
  dryRun: boolean;
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export async function runAwarenessPull(opts: PullCliOptions): Promise<AwarenessCacheEnvelope> {
  const { url, readKey } = validatePullEnv(opts.env);
  const snapshot = await pullAwarenessSnapshot({
    url,
    readKey,
    fetchImpl: opts.fetchImpl,
  });
  const envelope = buildAwarenessCacheEnvelope(url, snapshot, opts.now?.());
  if (!opts.dryRun) {
    const cachePath = resolveAwarenessCachePath(opts.env);
    await writeAwarenessCache(cachePath, envelope);
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  }
  return envelope;
}

function parseCliArgs(argv: string[]): { json: boolean; dryRun: boolean } {
  return {
    json: argv.includes("--json"),
    dryRun: argv.includes("--dry-run"),
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { json, dryRun } = parseCliArgs(argv);
  try {
    await runAwarenessPull({ json, dryRun, env: process.env });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`hermes-awareness-pull: ${message}\n`);
    return 1;
  }
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entryPath) {
  const code = await main();
  process.exit(code);
}
