#!/usr/bin/env node
/**
 * Deterministic Convex completion for morning-digest (Story 68-10).
 * 1) Replay artifact via push-digest-watchdog when present.
 * 2) Otherwise re-fetch adapters, build payload, dedupe, score, artifact, push.
 */

import { execFile } from 'node:child_process';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  buildErrorsBySource,
  isAdapterErrorPayload,
  summarizeAdapterCollection,
  unwrapAdapterResult,
} from './hermes-skill-examples/morning-digest/scripts/adapter-result.mjs';
import { buildDigestPushPayload } from './hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import { formatSydneyDate } from './hermes-skill-examples/morning-digest/scripts/digest-date.mjs';
import {
  resolveDigestMarkdownFromPayload,
  resolveSourceOutcomes,
} from './hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs';
import { mergeTrendIngestEnv, resolveOperatorHome } from './hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs';
import {
  countValidSignals,
  readDigestPushPayload,
  resolveConvexPushEnv,
} from './hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';
import { postDigestToDiscord } from './hermes-skill-examples/morning-digest/scripts/post-digest-discord.mjs';
import { writeDigestPushArtifact } from './hermes-skill-examples/morning-digest/scripts/write-digest-push-artifact.mjs';
import {
  computeOutcomeFromInvocation,
  markInvocationStarted,
  mergeInvocationOutcome,
  queryTodayConvexStatus,
  resolveDigestOutcomesRoot,
  resolveDigestTrigger,
} from './lib/digest-run-outcome.mjs';
import { collectDigestLogActionsForDate } from './lib/digest-retry-eligibility.mjs';
import {
  formatWatchdogLogLine,
  resolveWatchdogLogPath,
  runPushDigestWatchdog,
} from './push-digest-watchdog.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDir = join(repoRoot, 'scripts/hermes-skill-examples/morning-digest/scripts');
const sessionCloseDir = join(repoRoot, 'scripts/session-close');

export { formatSydneyDate } from './hermes-skill-examples/morning-digest/scripts/digest-date.mjs';
export {
  buildErrorsBySource,
  isAdapterErrorPayload,
  summarizeAdapterCollection,
  unwrapAdapterResult,
} from './hermes-skill-examples/morning-digest/scripts/adapter-result.mjs';

/**
 * @param {string} stdout
 * @returns {unknown | null}
 */
export function parseAdapterStdout(stdout) {
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
    env: { ...process.env, ...env },
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<{
 *   trends?: unknown;
 *   newsapi?: unknown;
 *   arxiv?: unknown;
 *   hackernews?: unknown;
 *   github?: unknown;
 *   reddit?: unknown;
 *   rss?: unknown;
 *   producthunt?: unknown;
 *   twitter?: unknown;
 *   bluesky?: unknown;
 *   youtube?: unknown;
 *   tiktok?: unknown;
 *   instagram?: unknown;
 *   pinterest?: unknown;
 * }>}
 */
/** Collect-task keys wired in the deterministic orchestrator (Story 72-2 parity guard). */
export const COLLECT_ADAPTER_TASK_KEYS = Object.freeze([
  'trends',
  'newsapi',
  'arxiv',
  'hackernews',
  'github',
  'reddit',
  'rss',
  'producthunt',
  'twitter',
  'bluesky',
  'youtube',
  'tiktok',
  'instagram',
  'pinterest',
]);

const COLLECT_ADAPTER_WRAPPER_BY_KEY = Object.freeze({
  trends: ['hermes-run-trend-ingest.sh', 60_000],
  newsapi: ['hermes-run-newsapi.sh', 45_000],
  arxiv: ['hermes-run-arxiv.sh', 45_000],
  hackernews: ['hermes-run-hn.sh', 45_000],
  github: ['hermes-run-github.sh', 45_000],
  reddit: ['hermes-run-reddit.sh', 45_000],
  rss: ['hermes-run-rss.sh', 45_000],
  producthunt: ['hermes-run-producthunt.sh', 45_000],
  twitter: ['hermes-run-x.sh', 45_000],
  bluesky: ['hermes-run-bluesky.sh', 45_000],
  youtube: ['hermes-run-youtube.sh', 45_000],
  tiktok: ['hermes-run-tiktok.sh', 45_000],
  instagram: ['hermes-run-instagram.sh', 45_000],
  pinterest: ['hermes-run-pinterest.sh', 45_000],
});

export async function collectAdapterOutputs(env) {
  const mergedEnv = await mergeTrendIngestEnv(env);
  const results = {};

  for (const key of COLLECT_ADAPTER_TASK_KEYS) {
    const wrapperSpec = COLLECT_ADAPTER_WRAPPER_BY_KEY[key];
    if (!wrapperSpec) {
      results[key] = { success: false, error: 'missing-wrapper-config' };
      continue;
    }
    const [wrapperName, timeoutMs] = wrapperSpec;
    try {
      const stdout = await runWrapper(wrapperName, mergedEnv, timeoutMs);
      const trimmed = String(stdout ?? '').trim();
      if (!trimmed) {
        results[key] = { success: false, error: 'empty-stdout' };
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        results[key] = { success: false, error: 'invalid-json' };
        continue;
      }

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

  console.error(summarizeAdapterCollection(results));
  return results;
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
/**
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, string | undefined>} [extra]
 * @returns {Promise<Record<string, string | undefined>>}
 */
async function buildDigestPipelineChildEnv(env, extra = {}) {
  const operatorHome = await resolveOperatorHome({ ...process.env, ...env });
  return {
    ...process.env,
    ...env,
    ...extra,
    HOME: operatorHome,
  };
}

async function dedupeSignals(signals, env) {
  const dedupeScript = join(scriptsDir, 'dedupe-digest-signals.mjs');
  const { stdout } = await execFileAsync('node', [dedupeScript], {
    cwd: repoRoot,
    env: await buildDigestPipelineChildEnv(env, {
      DIGEST_SIGNALS_JSON: JSON.stringify(signals),
    }),
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const parsed = parseAdapterStdout(stdout);
  return Array.isArray(parsed) ? parsed : signals;
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @param {number} ranAt
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function scoreSignals(signals, ranAt, env) {
  const scoreScript = join(scriptsDir, 'score-digest-signals.mjs');
  const { stdout } = await execFileAsync('node', [scoreScript], {
    cwd: repoRoot,
    env: await buildDigestPipelineChildEnv(env, {
      DIGEST_SIGNALS_JSON: JSON.stringify(signals),
      DIGEST_RUN_AT: String(ranAt),
    }),
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const parsed = parseAdapterStdout(stdout);
  return Array.isArray(parsed) ? parsed : signals;
}

/**
 * @param {string} stdout
 * @returns {{ ok: boolean; runId?: string | null; signalsWritten?: number; error?: string | null } | null}
 */
export function parsePushStdout(stdout) {
  const lines = String(stdout ?? '')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);
  if (!lastLine) {
    return null;
  }
  try {
    const parsed = JSON.parse(lastLine);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return /** @type {{ ok: boolean; runId?: string | null; signalsWritten?: number; error?: string | null }} */ (
      parsed
    );
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {number}
 */
function expectedSignalCount(payload) {
  return countValidSignals(Array.isArray(payload.signals) ? payload.signals : []);
}

/**
 * @param {{
 *   ok: boolean;
 *   runId?: string | null;
 *   signalsWritten?: number;
 *   error?: string | null;
 * }} pushResult
 * @param {number} expectedCount
 * @returns {{ ok: boolean; runId?: string | null; signalsWritten: number; error?: string }}
 */
function normalizePushResult(pushResult, expectedCount) {
  const signalsWritten = pushResult.signalsWritten ?? 0;
  const ok = pushResult.ok === true && signalsWritten === expectedCount;
  if (ok) {
    return {
      ok: true,
      runId: pushResult.runId ?? null,
      signalsWritten,
    };
  }
  return {
    ok: false,
    runId: pushResult.runId ?? null,
    signalsWritten,
    error:
      pushResult.error ??
      (signalsWritten < expectedCount
        ? `partial-write:${signalsWritten}/${expectedCount}`
        : 'convex-push-failed'),
  };
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<{ ok: boolean; runId?: string | null; signalsWritten: number; error?: string }>}
 */
export async function pushPayload(payload, env) {
  const digestPushJson = JSON.stringify(payload);
  const pushScript = join(scriptsDir, 'push-digest-convex.mjs');
  const candidatesScript = join(scriptsDir, 'push-keyword-candidates.mjs');
  const childEnv = { ...process.env, ...env, DIGEST_PUSH_JSON: digestPushJson };
  const expectedCount = expectedSignalCount(payload);

  /** @type {{ ok: boolean; runId?: string | null; signalsWritten?: number; error?: string | null } | null} */
  let parsed;

  try {
    const { stdout } = await execFileAsync('node', [pushScript], {
      cwd: repoRoot,
      env: childEnv,
      timeout: 45_000,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    parsed = parsePushStdout(stdout);
  } catch (err) {
    const stdout =
      err && typeof err === 'object' && 'stdout' in err
        ? String(/** @type {{ stdout?: unknown }} */ (err).stdout ?? '')
        : '';
    parsed = parsePushStdout(stdout);
    if (!parsed) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
          : 'push-spawn-failed';
      return { ok: false, signalsWritten: 0, error: message };
    }
  }

  if (!parsed) {
    return { ok: false, signalsWritten: 0, error: 'invalid-push-stdout' };
  }

  const normalized = normalizePushResult(parsed, expectedCount);
  if (!normalized.ok) {
    return normalized;
  }

  await execFileAsync('node', [candidatesScript], {
    cwd: repoRoot,
    env: childEnv,
    timeout: 45_000,
  });
  return normalized;
}

/**
 * @param {string} logPath
 * @param {string} line
 */
async function appendLog(logPath, line) {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${line}\n`, 'utf8');
}

/**
 * @param {string[]} argv
 * @returns {{ forceRescore: boolean }}
 */
export function parseCompletionCliArgs(argv) {
  return { forceRescore: argv.includes('--force-rescore') };
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown> | undefined} adapterResults
 */
function attachSourceOutcomes(payload, adapterResults) {
  const priorOutcomes =
    adapterResults == null && payload.run && typeof payload.run === 'object'
      ? /** @type {unknown} */ (payload.run).sourceOutcomes
      : undefined;
  const outcomes = resolveSourceOutcomes({
    markdown: resolveDigestMarkdownFromPayload(payload),
    run: payload.run,
    signals: Array.isArray(payload.signals) ? payload.signals : [],
    adapterResults,
    priorOutcomes: Array.isArray(priorOutcomes) ? priorOutcomes : undefined,
  });
  if (outcomes.length > 0) {
    payload.run = { ...payload.run, sourceOutcomes: outcomes };
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {number} ranAt
 * @param {Record<string, string | undefined>} env
 * @param {(action: string, exitCode: number, detail?: string) => Promise<void>} log
 * @param {string} successAction
 * @param {Record<string, unknown> | undefined} [adapterResults]
 * @param {(payload: Record<string, unknown>, env: Record<string, string | undefined>) => Promise<{ ok: boolean; runId?: string | null; signalsWritten: number; error?: string }>} [pushFn]
 * @param {{
 *   pushResult?: { ok: boolean; runId?: string | null; signalsWritten: number; error?: string } | null;
 *   discordResult?: { ok: boolean; error?: string | null } | null;
 *   signalCount?: number;
 * } | null} [invocation]
 * @returns {Promise<{ action: string; exitCode: number }>}
 */
async function scoreWriteAndPush(
  payload,
  ranAt,
  env,
  log,
  successAction,
  adapterResults,
  pushFn,
  invocation,
) {
  let signals = /** @type {Array<Record<string, unknown>>} */ (payload.signals);
  try {
    signals = await dedupeSignals(signals, env);
    payload.signals = signals;
    signals = await scoreSignals(signals, ranAt, env);
    payload.signals = signals;
  } catch (err) {
    const detail =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'pipeline-error';
    await log('completion-pipeline-failed', 0, detail);
    return { action: 'completion-pipeline-failed', exitCode: 0 };
  }

  attachSourceOutcomes(payload, adapterResults);

  const writeResult = await writeDigestPushArtifact({
    ...env,
    DIGEST_PUSH_JSON: JSON.stringify(payload),
  });
  if (writeResult.status !== 'ok') {
    await log('completion-artifact-failed', 0, writeResult.reason);
    return { action: 'completion-artifact-failed', exitCode: 0 };
  }

  const doPush = pushFn ?? pushPayload;
  const expectedCount = expectedSignalCount(payload);
  try {
    const pushResult = normalizePushResult(
      await doPush(payload, env),
      expectedCount,
    );
    if (!pushResult.ok) {
      const detail = JSON.stringify({
        error: pushResult.error?.slice(0, 120) ?? 'convex-push-failed',
        signalsWritten: pushResult.signalsWritten ?? 0,
      }).slice(0, 200);
      if (invocation) {
        invocation.pushResult = pushResult;
        invocation.discordResult = null;
        invocation.signalCount = expectedCount;
      }
      await log('completion-convex-push-failed', 0, detail);
      return { action: 'completion-convex-push-failed', exitCode: 0 };
    }

    const discordResult = await postDigestToDiscord(payload, env);
    if (invocation) {
      invocation.pushResult = pushResult;
      invocation.discordResult = discordResult;
      invocation.signalCount = expectedCount;
    }
    if (discordResult.ok) {
      const detail =
        discordResult.messageIds.length > 0 ? discordResult.messageIds.join(',') : undefined;
      await log('discord-post-ok', 0, detail);
    } else {
      await log('discord-post-failed', 0, discordResult.error);
    }
    await log(successAction, 0);
    return { action: successAction, exitCode: 0 };
  } catch (err) {
    const detail =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'push-error';
    await log(`${successAction}-failed`, 0, detail);
    return { action: `${successAction}-failed`, exitCode: 0 };
  }
}

/**
 * @param {{
 *   env: Record<string, string | undefined>;
 *   todayDate: string;
 *   operatorHome: string;
 *   log: (action: string, exitCode: number, detail?: string) => Promise<void>;
 *   pushFn?: (payload: Record<string, unknown>, env: Record<string, string | undefined>) => Promise<{ ok: boolean; runId?: string | null; signalsWritten: number; error?: string }>;
 *   invocation?: {
 *     pushResult?: { ok: boolean; runId?: string | null; signalsWritten: number; error?: string } | null;
 *     discordResult?: { ok: boolean; error?: string | null } | null;
 *     signalCount?: number;
 *   } | null;
 * }} ctx
 * @returns {Promise<{ action: string; exitCode: number } | null>}
 */
async function pushOnlyFromArtifact(ctx) {
  const artifactPath = join(ctx.operatorHome, '.hermes', `digest-push-${ctx.todayDate}.json`);
  let artifactRaw;
  try {
    artifactRaw = await readFile(artifactPath, 'utf8');
  } catch {
    return null;
  }

  const payload = readDigestPushPayload({ DIGEST_PUSH_JSON: artifactRaw });
  if (!payload || !Array.isArray(payload.signals) || payload.signals.length === 0) {
    return null;
  }

  // Pattern shared with 71-4 Discord-only repair — retry failed leg from digest-push artifact.
  const doPush = ctx.pushFn ?? pushPayload;
  const expectedCount = expectedSignalCount(payload);
  try {
    const pushResult = normalizePushResult(
      await doPush(payload, ctx.env),
      expectedCount,
    );
    if (!pushResult.ok) {
      const detail = JSON.stringify({
        error: pushResult.error?.slice(0, 120) ?? 'convex-push-failed',
        signalsWritten: pushResult.signalsWritten ?? 0,
      }).slice(0, 200);
      if (ctx.invocation) {
        ctx.invocation.pushResult = pushResult;
        ctx.invocation.discordResult = null;
        ctx.invocation.signalCount = expectedCount;
      }
      await ctx.log('completion-convex-push-failed', 0, detail);
      return { action: 'completion-convex-push-failed', exitCode: 0 };
    }

    const discordResult = await postDigestToDiscord(payload, ctx.env);
    if (ctx.invocation) {
      ctx.invocation.pushResult = pushResult;
      ctx.invocation.discordResult = discordResult;
      ctx.invocation.signalCount = expectedCount;
    }
    if (discordResult.ok) {
      const detail =
        discordResult.messageIds.length > 0 ? discordResult.messageIds.join(',') : undefined;
      await ctx.log('discord-post-ok', 0, detail);
    } else {
      await ctx.log('discord-post-failed', 0, discordResult.error);
    }
    await ctx.log('completion-backfill-push', 0);
    return { action: 'completion-backfill-push', exitCode: 0 };
  } catch (err) {
    const detail =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'push-error';
    await ctx.log('completion-backfill-push-failed', 0, detail);
    return { action: 'completion-backfill-push-failed', exitCode: 0 };
  }
}

async function discordOnlyFromArtifact(ctx) {
  const artifactPath = join(ctx.operatorHome, '.hermes', `digest-push-${ctx.todayDate}.json`);
  let artifactRaw;
  try {
    artifactRaw = await readFile(artifactPath, 'utf8');
  } catch {
    // deliberately not escalating to full-pipeline — see 71-4 AC3
    await ctx.log('discord-only-repair-skipped-no-artifact', 0);
    return { action: 'discord-only-repair-skipped-no-artifact', exitCode: 0 };
  }

  const payload = readDigestPushPayload({ DIGEST_PUSH_JSON: artifactRaw });
  if (!payload || !Array.isArray(payload.signals) || payload.signals.length === 0) {
    // deliberately not escalating to full-pipeline — see 71-4 AC3
    await ctx.log('discord-only-repair-skipped-no-artifact', 0);
    return { action: 'discord-only-repair-skipped-no-artifact', exitCode: 0 };
  }

  const postDigest = ctx.postDigestFn ?? postDigestToDiscord;
  const expectedCount = expectedSignalCount(payload);
  try {
    const discordResult = await postDigest(payload, ctx.env);
    if (ctx.invocation) {
      ctx.invocation.discordResult = discordResult;
      ctx.invocation.signalCount = expectedCount;
      ctx.invocation.ranAdapters = false;
    }
    if (discordResult.ok) {
      const detail =
        discordResult.messageIds.length > 0 ? discordResult.messageIds.join(',') : undefined;
      await ctx.log('discord-only-repair-ok', 0, detail);
      return { action: 'discord-only-repair-ok', exitCode: 0 };
    }
    await ctx.log('discord-only-repair-failed', 0, discordResult.error);
    return { action: 'discord-only-repair-failed', exitCode: 0 };
  } catch (err) {
    const detail =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'discord-error';
    if (ctx.invocation) {
      ctx.invocation.discordResult = { ok: false, error: detail };
      ctx.invocation.signalCount = expectedCount;
      ctx.invocation.ranAdapters = false;
    }
    await ctx.log('discord-only-repair-failed', 0, detail);
    return { action: 'discord-only-repair-failed', exitCode: 0 };
  }
}

/**
 * @param {{
 *   env: Record<string, string | undefined>;
 *   todayDate: string;
 *   operatorHome: string;
 *   log: (action: string, exitCode: number, detail?: string) => Promise<void>;
 *   pushFn?: (payload: Record<string, unknown>, env: Record<string, string | undefined>) => Promise<{ ok: boolean; runId?: string | null; signalsWritten: number; error?: string }>;
 *   invocation?: {
 *     pushResult?: { ok: boolean; runId?: string | null; signalsWritten: number; error?: string } | null;
 *     discordResult?: { ok: boolean; error?: string | null } | null;
 *     signalCount?: number;
 *   } | null;
 * }} ctx
 * @returns {Promise<{ action: string; exitCode: number } | null>}
 */
async function tryRescoreFromArtifact(ctx) {
  const artifactPath = join(ctx.operatorHome, '.hermes', `digest-push-${ctx.todayDate}.json`);
  let artifactRaw;
  try {
    artifactRaw = await readFile(artifactPath, 'utf8');
  } catch {
    return null;
  }

  const payload = readDigestPushPayload({ DIGEST_PUSH_JSON: artifactRaw });
  if (!payload || !Array.isArray(payload.signals) || payload.signals.length === 0) {
    return null;
  }

  const ranAt = Date.now();
  payload.run = { ...payload.run, date: ctx.todayDate, ranAt };
  return scoreWriteAndPush(
    payload,
    ranAt,
    ctx.env,
    ctx.log,
    'completion-force-rescore-push',
    undefined,
    ctx.pushFn,
    ctx.invocation,
  );
}

/**
 * @param {{
 *   env: Record<string, string | undefined>;
 *   todayDate: string;
 *   operatorHome: string;
 *   logPath: string;
 *   invocation: {
 *     recoveryPath: 'full-pipeline' | 'push-only-artifact' | 'watchdog-recover-artifact' | 'none';
 *     logActions: string[];
 *     pushResult?: { ok: boolean; runId?: string | null; signalsWritten: number; error?: string } | null;
 *     discordResult?: { ok: boolean; error?: string | null } | null;
 *     adapterOutputs?: Record<string, unknown> | null;
 *     signalCount?: number;
 *     ranAdapters?: boolean;
 *   };
 *   result: { action: string; exitCode: number };
 *   fetchFn?: typeof fetch;
 * }} ctx
 */
async function mergeInvocationOutcomeRecord(ctx) {
  let convexRowStatus = null;
  try {
    const convexEnv = await resolveConvexPushEnv(ctx.env);
    if (convexEnv) {
      convexRowStatus = await queryTodayConvexStatus(
        ctx.fetchFn ?? globalThis.fetch,
        convexEnv,
        ctx.todayDate,
      );
    }
  } catch {
    convexRowStatus = null;
  }

  const logContent = await readFile(ctx.logPath, 'utf8').catch(() => '');
  const dayLogActions = collectDigestLogActionsForDate(logContent, ctx.todayDate);
  const logActions =
    ctx.invocation.logActions.length > 0 ? ctx.invocation.logActions : dayLogActions;

  const outcome = computeOutcomeFromInvocation({
    trigger: resolveDigestTrigger(ctx.env),
    date: ctx.todayDate,
    terminalAction: ctx.result.action,
    recoveryPath: ctx.invocation.recoveryPath,
    pushResult: ctx.invocation.pushResult,
    discordResult: ctx.invocation.discordResult,
    adapterOutputs: ctx.invocation.adapterOutputs ?? undefined,
    convexRowStatus,
    logActions,
    signalCount: ctx.invocation.signalCount ?? 0,
  });

  await mergeInvocationOutcome(ctx.outcomeDir, ctx.todayDate, {
    date: ctx.todayDate,
    trigger: outcome.trigger,
    recoveryPath: outcome.recoveryPath,
    terminalAction: outcome.terminalAction,
    timestamp: outcome.timestamp,
    convex: outcome.convex,
    discord: outcome.discord,
    sources: outcome.sources,
    overall: outcome.overall,
    ranAdapters: ctx.invocation.ranAdapters === true,
    signalCount: ctx.invocation.signalCount ?? 0,
  });
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   todayDate?: string;
 *   forceRescore?: boolean;
 *   collectFn?: typeof collectAdapterOutputs;
 *   watchdogFn?: typeof runPushDigestWatchdog;
 *   pushFn?: typeof pushPayload;
 *   postDigestFn?: typeof postDigestToDiscord;
 *   fetchFn?: typeof fetch;
 *   writeOutcomeFn?: typeof mergeInvocationOutcomeRecord;
 * }} [opts]
 * @returns {Promise<{ action: string; exitCode: number }>}
 */
export async function runDigestConvexCompletion(opts = {}) {
  const env = opts.env ?? process.env;
  const todayDate = opts.todayDate ?? formatSydneyDate(env.CRON_TZ ?? env.TZ);
  const operatorHome = await resolveOperatorHome(env);
  const logPath = resolveWatchdogLogPath(operatorHome);
  const invocation = {
    recoveryPath: /** @type {'full-pipeline' | 'push-only-artifact' | 'watchdog-recover-artifact' | 'none'} */ ('none'),
    logActions: /** @type {string[]} */ ([]),
    pushResult: null,
    discordResult: null,
    adapterOutputs: null,
    signalCount: 0,
    ranAdapters: false,
  };
  const log = async (action, exitCode, detail) => {
    invocation.logActions.push(action);
    await appendLog(
      logPath,
      formatWatchdogLogLine(action, { date: todayDate, exit: exitCode, detail }),
    );
  };

  const forceRescore = opts.forceRescore ?? false;
  const pushFn = opts.pushFn;
  const writeOutcomeFn = opts.writeOutcomeFn ?? mergeInvocationOutcomeRecord;
  const outcomeDir = resolveDigestOutcomesRoot(operatorHome);
  const trigger = resolveDigestTrigger(env);
  /** @type {{ action: string; exitCode: number }} */
  let result = { action: 'completion-pipeline-failed', exitCode: 0 };

  // Must run before watchdog eligibility — fast-exit paths still need a brief inProgress marker.
  await markInvocationStarted(outcomeDir, todayDate, { trigger });

  try {
    if (forceRescore) {
      invocation.recoveryPath = 'full-pipeline';
      const rescoreResult = await tryRescoreFromArtifact({
        env,
        todayDate,
        operatorHome,
        log,
        pushFn,
        invocation,
      });
      if (rescoreResult) {
        result = rescoreResult;
        return result;
      }
    } else {
      const watchdogFn = opts.watchdogFn ?? runPushDigestWatchdog;
      const watchdogResult = await watchdogFn({ env, todayDate });
      if (watchdogResult.action === 'skipped-already-pushed') {
        invocation.recoveryPath = 'none';
        result = watchdogResult;
        return result;
      }
      if (watchdogResult.action === 'recovered-push') {
        invocation.recoveryPath = 'watchdog-recover-artifact';
        result = watchdogResult;
        return result;
      }

      if (watchdogResult.action === 'deferred-push-only-artifact') {
        invocation.recoveryPath = 'push-only-artifact';
        await log('push-only-artifact-recovery', 0);
        const pushOnlyResult = await pushOnlyFromArtifact({
          env,
          todayDate,
          operatorHome,
          log,
          pushFn,
          invocation,
        });
        if (pushOnlyResult) {
          result = pushOnlyResult;
          return result;
        }
      } else if (watchdogResult.action === 'deferred-discord-only-repair') {
        invocation.recoveryPath = 'none';
        result = await discordOnlyFromArtifact({
          env,
          todayDate,
          operatorHome,
          log,
          postDigestFn: opts.postDigestFn,
          invocation,
        });
        return result;
      } else if (watchdogResult.action !== 'skipped-no-artifact') {
        result = watchdogResult;
        return result;
      }
    }

    invocation.recoveryPath = 'full-pipeline';
    const collectFn = opts.collectFn ?? collectAdapterOutputs;
    const ranAt = Date.now();
    const adapterOutputs = await collectFn(env);
    invocation.adapterOutputs = adapterOutputs;
    invocation.ranAdapters = true;
    const errorsBySource = buildErrorsBySource(adapterOutputs);

    const trendsPayload = /** @type {{ events?: Array<{ keyword?: string; normalizedValue?: number }> }} */ (
      unwrapAdapterResult(adapterOutputs.trends)
    );
    const topTrend = trendsPayload.events?.[0]?.keyword;

    const payload = buildDigestPushPayload({
      date: todayDate,
      ranAt,
      trends: trendsPayload,
      newsapi: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.newsapi)),
      arxiv: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.arxiv)),
      hackernews: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.hackernews)),
      github: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.github)),
      reddit: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.reddit)),
      rss: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.rss)),
      producthunt: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.producthunt)),
      twitter: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.twitter)),
      bluesky: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.bluesky)),
      youtube: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.youtube)),
      tiktok: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.tiktok)),
      instagram: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.instagram)),
      pinterest: /** @type {never} */ (unwrapAdapterResult(adapterOutputs.pinterest)),
      runMeta: {
        topTrend: topTrend ? String(topTrend) : undefined,
        focusKeyword: topTrend ? String(topTrend) : undefined,
      },
    });

    if (errorsBySource) {
      payload.run = { ...payload.run, errors_by_source: errorsBySource };
    }

    if (!Array.isArray(payload.signals) || payload.signals.length === 0) {
      attachSourceOutcomes(payload, adapterOutputs);
      await writeDigestPushArtifact({
        ...env,
        DIGEST_PUSH_JSON: JSON.stringify(payload),
      });
      const detail = errorsBySource
        ? `adapter-refetch-empty ${JSON.stringify(errorsBySource)}`
        : 'adapter-refetch-empty';
      await log('completion-no-signals', 0, detail);
      result = { action: 'completion-no-signals', exitCode: 0 };
      return result;
    }

    result = await scoreWriteAndPush(
      payload,
      ranAt,
      env,
      log,
      'completion-backfill-push',
      adapterOutputs,
      pushFn,
      invocation,
    );
    return result;
  } finally {
    await writeOutcomeFn({
      env,
      todayDate,
      operatorHome,
      outcomeDir,
      logPath,
      invocation,
      result,
      fetchFn: opts.fetchFn,
    });
  }
}

async function main() {
  const { forceRescore } = parseCompletionCliArgs(process.argv.slice(2));
  await runDigestConvexCompletion({ forceRescore });
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('run-digest-convex-completion.mjs');

if (isMain) {
  main().catch(() => process.exit(0));
}
