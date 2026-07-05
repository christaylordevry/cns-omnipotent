/**
 * Discover artifact writer (Story 84-1).
 * Invokes collectInternalDevState read-only; writes ~/.hermes/artifacts/unified-loop/discover.json.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLLECTOR_MODULE = 'scripts/lib/collect-internal-dev-state.ts';
export const COLLECTOR_ITEM_CAP = 20;
export const ARTIFACT_REL_SEGMENTS = ['.hermes', 'artifacts', 'unified-loop', 'discover.json'];

const DEFAULT_REPO_ROOT = '/home/christ/ai-factory/projects/Omnipotent.md';
const DEFAULT_VAULT_ROOT = '/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE';

/**
 * @param {string} [homeDir]
 * @returns {string}
 */
export function resolveDiscoverArtifactPath(homeDir = os.homedir()) {
  return path.join(homeDir, ...ARTIFACT_REL_SEGMENTS);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ repoRoot: string; vaultRoot: string; artifactPath: string }}
 */
export function resolveDiscoverPaths(env = process.env) {
  const repoRoot = path.resolve(String(env.OMNIPOTENT_REPO ?? '').trim() || DEFAULT_REPO_ROOT);
  const vaultRoot = path.resolve(String(env.CNS_VAULT_ROOT ?? '').trim() || DEFAULT_VAULT_ROOT);
  const override = String(env.UNIFIED_LOOP_DISCOVER_ARTIFACT ?? '').trim();
  const artifactPath = override ? path.resolve(override) : resolveDiscoverArtifactPath();
  return { repoRoot, vaultRoot, artifactPath };
}

/**
 * @param {Date | number} value
 * @returns {string}
 */
export function formatIso8601WithOffset(value) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @returns {{ storyKey: string; reason: string } | null}
 */
export function pickTopStory(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const sorted = items
    .filter((item) => item && typeof item === 'object')
    .slice()
    .sort((a, b) => {
      const rankA = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER;
      const rankB = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });
  const top = sorted[0];
  if (!top || typeof top.title !== 'string') {
    return null;
  }
  const score = typeof top.rankScore === 'number' ? top.rankScore : 'n/a';
  const category = typeof top.category === 'string' ? top.category : 'unknown';
  return {
    storyKey: top.title,
    reason: `highest rankScore ${category} item (rankScore=${score})`,
  };
}

/**
 * @param {{
 *   items: Array<Record<string, unknown>>;
 *   repoRoot: string;
 *   artifactPath: string;
 *   trigger: string;
 *   generatedAt?: string;
 * }} input
 * @returns {Record<string, unknown>}
 */
export function buildDiscoverPayload(input) {
  const topPick = pickTopStory(input.items);
  return {
    schemaVersion: 1,
    stage: 'discover',
    generatedAt: input.generatedAt ?? formatIso8601WithOffset(Date.now()),
    trigger: input.trigger,
    repoRoot: path.resolve(input.repoRoot),
    artifactPath: path.resolve(input.artifactPath),
    collector: {
      module: COLLECTOR_MODULE,
      itemCap: COLLECTOR_ITEM_CAP,
    },
    items: input.items,
    topPick: topPick ?? { storyKey: '', reason: 'no prioritized items' },
    buildIntent: {
      proposedStoryKey: null,
      status: 'awaiting-operator-approval',
    },
  };
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} artifactPath
 */
export async function writeDiscoverArtifactFile(payload, artifactPath) {
  const abs = path.resolve(artifactPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return abs;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   trigger?: string;
 *   now?: number;
 *   collectFn?: (opts: { repoRoot: string; vaultRoot: string; now?: number }) => Promise<Array<Record<string, unknown>>>;
 * }} [options]
 */
export async function runDiscoverWrite(env, options = {}) {
  const { repoRoot, vaultRoot, artifactPath } = resolveDiscoverPaths(env);
  const trigger = String(options.trigger ?? env.UNIFIED_LOOP_TRIGGER ?? 'manual').trim() || 'manual';
  const now =
    typeof options.now === 'number' && Number.isFinite(options.now) ? options.now : undefined;

  const collectFn =
    options.collectFn ??
    (async (opts) => {
      const { collectInternalDevState } = await import('../../../lib/collect-internal-dev-state.ts');
      return collectInternalDevState(opts);
    });

  const items = await collectFn({
    repoRoot,
    vaultRoot,
    ...(typeof now === 'number' ? { now } : {}),
  });

  const payload = buildDiscoverPayload({
    items,
    repoRoot,
    artifactPath,
    trigger,
    ...(typeof now === 'number' ? { generatedAt: formatIso8601WithOffset(now) } : {}),
  });

  const writtenPath = await writeDiscoverArtifactFile(payload, artifactPath);
  return { payload, artifactPath: writtenPath, items };
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === entry;
}

if (isMainModule()) {
  const trigger = process.argv[2] ?? process.env.UNIFIED_LOOP_TRIGGER ?? 'manual';
  runDiscoverWrite(process.env, { trigger })
    .then((result) => {
      process.stdout.write(
        `${JSON.stringify({
          ok: true,
          artifactPath: result.artifactPath,
          itemCount: result.items.length,
          topPick: result.payload.topPick,
        })}\n`,
      );
    })
    .catch((err) => {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String(/** @type {{ message: unknown }} */ (err).message)
          : 'discover-write-failed';
      process.stderr.write(`[unified-loop-discover] ${message}\n`);
      process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
      process.exit(1);
    });
}
