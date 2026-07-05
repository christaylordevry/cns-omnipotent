/**
 * Selective trends/newsapi refetch for watchdog completion (Story 81-2 AC2).
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { buildDigestPushPayload } from '../hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import { mergeTrendIngestEnv } from '../hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs';
import {
  resolveDigestMarkdownFromPayload,
  resolveSourceOutcomes,
} from '../hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs';
import {
  isAdapterErrorPayload,
  unwrapAdapterResult,
} from '../hermes-skill-examples/morning-digest/scripts/adapter-result.mjs';
import { collectDigestLogActionsForDate } from './digest-retry-eligibility.mjs';
import { formatWatchdogLogLine, resolveWatchdogLogPath } from '../push-digest-watchdog.mjs';
import { readDigestPushPayload } from '../hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sessionCloseDir = join(repoRoot, 'scripts/session-close');

/** Adapter keys eligible for selective watchdog refetch (Reddit excluded — platform closure). */
export const SELECTIVE_REFETCH_ADAPTER_KEYS = Object.freeze(['trends', 'newsapi']);

const SELECTIVE_REFETCH_SOURCE_TYPES = Object.freeze(['google_trends', 'newsapi']);

/** @type {Record<string, [string, number]>} */
const WRAPPER_BY_KEY = {
  trends: ['hermes-run-trend-ingest.sh', 60_000],
  newsapi: ['hermes-run-newsapi.sh', 45_000],
};

/**
 * @param {string} stdout
 * @returns {unknown | null}
 */
function parseStdoutJson(stdout) {
  const trimmed = String(stdout ?? '').trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * @param {string} wrapperName
 * @param {Record<string, string | undefined>} env
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
async function runWrapper(wrapperName, env, timeoutMs) {
  const wrapperPath = join(sessionCloseDir, wrapperName);
  const { stdout } = await execFileAsync('bash', [wrapperPath], {
    cwd: repoRoot,
    env: { ...process.env, ...env, DIGEST_WATCHDOG_REFETCH: '1' },
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {readonly string[]} keys
 * @returns {Promise<Record<string, { success: boolean; data?: unknown; error?: string }>>}
 */
export async function collectSelectiveAdapterOutputs(env, keys = SELECTIVE_REFETCH_ADAPTER_KEYS) {
  const mergedEnv = await mergeTrendIngestEnv(env);
  /** @type {Record<string, { success: boolean; data?: unknown; error?: string }>} */
  const results = {};

  for (const key of keys) {
    const wrapperSpec = WRAPPER_BY_KEY[key];
    if (!wrapperSpec) {
      results[key] = { success: false, error: 'missing-wrapper-config' };
      continue;
    }
    const [wrapperName, timeoutMs] = wrapperSpec;
    try {
      const stdout = await runWrapper(wrapperName, mergedEnv, timeoutMs);
      const parsed = parseStdoutJson(stdout);
      if (!parsed || typeof parsed !== 'object') {
        results[key] = { success: false, error: 'invalid-json' };
        continue;
      }
      if (isAdapterErrorPayload(parsed)) {
        results[key] = {
          success: false,
          error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}`,
        };
        continue;
      }
      results[key] = { success: true, data: parsed };
    } catch (err) {
      const isTimeout =
        err &&
        typeof err === 'object' &&
        (('killed' in err && /** @type {{ killed?: boolean }} */ (err).killed) ||
          ('code' in err && /** @type {{ code?: string }} */ (err).code === 'ETIMEDOUT'));
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 80)
          : 'exec failed';
      results[key] = {
        success: false,
        error: isTimeout ? 'timeout' : `exec-error:${message}`,
      };
    }
  }

  return results;
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string[]}
 */
export function detectFailedPrimaryTrendSources(payload) {
  const signals = Array.isArray(payload.signals) ? payload.signals : [];
  const run = payload.run && typeof payload.run === 'object' ? payload.run : {};
  const outcomes = resolveSourceOutcomes({
    markdown: resolveDigestMarkdownFromPayload(payload),
    run,
    signals,
    priorOutcomes: Array.isArray(run.sourceOutcomes) ? run.sourceOutcomes : undefined,
  });

  /** @type {Set<string>} */
  const failed = new Set();

  for (const row of outcomes) {
    if (!row || (row.status !== 'error' && row.status !== 'unavailable')) {
      continue;
    }
    if (row.sourceKey === 'google_trends') {
      failed.add('trends');
    }
    if (row.sourceKey === 'newsapi') {
      failed.add('newsapi');
    }
  }

  const hasOtherSignals = signals.some((signal) => {
    const sourceType = typeof signal?.sourceType === 'string' ? signal.sourceType : '';
    return sourceType && !SELECTIVE_REFETCH_SOURCE_TYPES.includes(sourceType);
  });

  if (hasOtherSignals) {
    if (
      !signals.some((signal) => signal?.sourceType === 'google_trends') &&
      !String(run.topTrend ?? '').trim()
    ) {
      failed.add('trends');
    }
    if (!signals.some((signal) => signal?.sourceType === 'newsapi')) {
      failed.add('newsapi');
    }
  }

  return SELECTIVE_REFETCH_ADAPTER_KEYS.filter((key) => failed.has(key));
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, { success: boolean; data?: unknown; error?: string }>} adapterOutputs
 * @param {string} todayDate
 * @returns {{ payload: Record<string, unknown>; refetched: string[] }}
 */
export function mergeSelectiveRefetchIntoPayload(payload, adapterOutputs, todayDate) {
  const run = payload.run && typeof payload.run === 'object' ? { ...payload.run } : {};
  const ranAt =
    typeof run.ranAt === 'number' && Number.isFinite(run.ranAt) ? run.ranAt : Date.now();
  /** @type {string[]} */
  const refetched = [];

  const trendsPayload = /** @type {{ events?: Array<{ keyword?: string; normalizedValue?: number }> }} */ (
    adapterOutputs.trends?.success ? unwrapAdapterResult(adapterOutputs.trends) : null
  );
  const newsapiPayload = /** @type {{ headlines?: Array<{ title?: string; url?: string }> }} */ (
    adapterOutputs.newsapi?.success ? unwrapAdapterResult(adapterOutputs.newsapi) : null
  );

  if (adapterOutputs.trends?.success) {
    refetched.push('trends');
  }
  if (adapterOutputs.newsapi?.success) {
    refetched.push('newsapi');
  }

  const partial = buildDigestPushPayload({
    date: todayDate,
    ranAt,
    trends: trendsPayload ?? undefined,
    newsapi: newsapiPayload ?? undefined,
    runMeta: {
      topTrend: trendsPayload?.events?.[0]?.keyword
        ? String(trendsPayload.events[0].keyword)
        : run.topTrend,
      focusKeyword: trendsPayload?.events?.[0]?.keyword
        ? String(trendsPayload.events[0].keyword)
        : run.focusKeyword,
    },
  });

  /** Only strip/replace source types whose adapter refetch succeeded. */
  /** @type {Set<string>} */
  const refetchedSourceTypes = new Set();
  if (adapterOutputs.trends?.success) {
    refetchedSourceTypes.add('google_trends');
  }
  if (adapterOutputs.newsapi?.success) {
    refetchedSourceTypes.add('newsapi');
  }

  const existingSignals = Array.isArray(payload.signals) ? payload.signals : [];
  const keptSignals = existingSignals.filter(
    (signal) => !refetchedSourceTypes.has(String(signal?.sourceType ?? '')),
  );
  const replacementSignals = partial.signals.filter((signal) =>
    refetchedSourceTypes.has(String(signal?.sourceType ?? '')),
  );

  if (trendsPayload?.events?.[0]?.keyword) {
    run.topTrend = String(trendsPayload.events[0].keyword);
    run.focusKeyword = String(trendsPayload.events[0].keyword);
  }

  return {
    payload: {
      ...payload,
      run,
      signals: [...keptSignals, ...replacementSignals],
    },
    refetched,
  };
}

/**
 * @param {string} logPath
 * @param {typeof readFile} readFileFn
 * @returns {Promise<string>}
 */
async function readWatchdogLogContent(logPath, readFileFn) {
  try {
    return await readFileFn(logPath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * @param {{
 *   env: Record<string, string | undefined>;
 *   todayDate: string;
 *   operatorHome: string;
 *   log: (action: string, exitCode: number, detail?: string) => Promise<void>;
 *   readFileFn?: typeof readFile;
 *   dedupeFn: (signals: Array<Record<string, unknown>>, env: Record<string, string | undefined>) => Promise<Array<Record<string, unknown>>>;
 *   scoreFn: (signals: Array<Record<string, unknown>>, ranAt: number, env: Record<string, string | undefined>) => Promise<Array<Record<string, unknown>>>;
 *   writeArtifactFn: (payload: Record<string, unknown>, env: Record<string, string | undefined>) => Promise<void>;
 *   collectFn?: typeof collectSelectiveAdapterOutputs;
 * }} ctx
 * @returns {Promise<{ action: string; exitCode: number; patched?: boolean }>}
 */
export async function trySelectiveSourceRefetch(ctx) {
  const readFileFn = ctx.readFileFn ?? readFile;
  const logPath = resolveWatchdogLogPath(ctx.operatorHome);
  const logContent = await readWatchdogLogContent(logPath, readFileFn);
  const priorActions = collectDigestLogActionsForDate(logContent, ctx.todayDate);
  if (priorActions.includes('selective-source-refetch')) {
    return { action: 'skipped-already-refetched', exitCode: 0, patched: false };
  }

  const artifactPath = join(ctx.operatorHome, '.hermes', `digest-push-${ctx.todayDate}.json`);
  let artifactRaw;
  try {
    artifactRaw = await readFileFn(artifactPath, 'utf8');
  } catch {
    return { action: 'skipped-no-artifact', exitCode: 0, patched: false };
  }

  const payload = readDigestPushPayload({ DIGEST_PUSH_JSON: artifactRaw });
  if (!payload) {
    return { action: 'skipped-no-artifact', exitCode: 0, patched: false };
  }

  const failedKeys = detectFailedPrimaryTrendSources(payload);
  if (failedKeys.length === 0) {
    return { action: 'skipped-no-refetch-needed', exitCode: 0, patched: false };
  }

  const collectFn = ctx.collectFn ?? collectSelectiveAdapterOutputs;
  const adapterOutputs = await collectFn(ctx.env, failedKeys);
  const anySuccess = failedKeys.some((key) => adapterOutputs[key]?.success === true);
  if (!anySuccess) {
    await ctx.log(
      'selective-source-refetch',
      0,
      JSON.stringify({ sources: failedKeys, refetched: 0, reason: 'all-adapters-failed' }).slice(
        0,
        200,
      ),
    );
    return { action: 'selective-source-refetch', exitCode: 0, patched: false };
  }

  const merged = mergeSelectiveRefetchIntoPayload(payload, adapterOutputs, ctx.todayDate);
  const ranAt =
    typeof merged.payload.run?.ranAt === 'number' && Number.isFinite(merged.payload.run.ranAt)
      ? merged.payload.run.ranAt
      : Date.now();

  let signals = /** @type {Array<Record<string, unknown>>} */ (merged.payload.signals ?? []);
  signals = await ctx.dedupeFn(signals, ctx.env);
  signals = await ctx.scoreFn(signals, ranAt, ctx.env);
  merged.payload.signals = signals;

  await ctx.writeArtifactFn(merged.payload, ctx.env);

  await ctx.log(
    'selective-source-refetch',
    0,
    JSON.stringify({
      sources: failedKeys,
      refetched: merged.refetched.length,
      refetchedKeys: merged.refetched,
    }).slice(0, 200),
  );

  return { action: 'selective-source-refetch', exitCode: 0, patched: true };
}

export { formatWatchdogLogLine };
