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
import { readDigestPushPayload } from './hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';
import { postDigestToDiscord } from './hermes-skill-examples/morning-digest/scripts/post-digest-discord.mjs';
import { writeDigestPushArtifact } from './hermes-skill-examples/morning-digest/scripts/write-digest-push-artifact.mjs';
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
 * }>}
 */
export async function collectAdapterOutputs(env) {
  const mergedEnv = await mergeTrendIngestEnv(env);
  const results = {};

  const tasks = [
    ['trends', () => runWrapper('hermes-run-trend-ingest.sh', mergedEnv, 60_000)],
    ['newsapi', () => runWrapper('hermes-run-newsapi.sh', mergedEnv, 45_000)],
    ['arxiv', () => runWrapper('hermes-run-arxiv.sh', mergedEnv, 45_000)],
    ['hackernews', () => runWrapper('hermes-run-hn.sh', mergedEnv, 45_000)],
    ['github', () => runWrapper('hermes-run-github.sh', mergedEnv, 45_000)],
    ['reddit', () => runWrapper('hermes-run-reddit.sh', mergedEnv, 45_000)],
    ['rss', () => runWrapper('hermes-run-rss.sh', mergedEnv, 45_000)],
    ['producthunt', () => runWrapper('hermes-run-producthunt.sh', mergedEnv, 45_000)],
    ['twitter', () => runWrapper('hermes-run-x.sh', mergedEnv, 45_000)],
    ['bluesky', () => runWrapper('hermes-run-bluesky.sh', mergedEnv, 45_000)],
  ];

  for (const [key, runner] of tasks) {
    try {
      const stdout = await runner();
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
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<void>}
 */
async function pushPayload(payload, env) {
  const digestPushJson = JSON.stringify(payload);
  const pushScript = join(scriptsDir, 'push-digest-convex.mjs');
  const candidatesScript = join(scriptsDir, 'push-keyword-candidates.mjs');
  const childEnv = { ...process.env, ...env, DIGEST_PUSH_JSON: digestPushJson };

  await execFileAsync('node', [pushScript], { cwd: repoRoot, env: childEnv, timeout: 45_000 });
  await execFileAsync('node', [candidatesScript], { cwd: repoRoot, env: childEnv, timeout: 45_000 });
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
  const outcomes = resolveSourceOutcomes({
    markdown: resolveDigestMarkdownFromPayload(payload),
    run: payload.run,
    signals: Array.isArray(payload.signals) ? payload.signals : [],
    adapterResults,
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
 * @returns {Promise<{ action: string; exitCode: number }>}
 */
async function scoreWriteAndPush(payload, ranAt, env, log, successAction, adapterResults) {
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

  try {
    await pushPayload(payload, env);
    const discordResult = await postDigestToDiscord(payload, env);
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
  return scoreWriteAndPush(payload, ranAt, ctx.env, ctx.log, 'completion-force-rescore-push');
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   todayDate?: string;
 *   forceRescore?: boolean;
 *   collectFn?: typeof collectAdapterOutputs;
 *   watchdogFn?: typeof runPushDigestWatchdog;
 * }} [opts]
 * @returns {Promise<{ action: string; exitCode: number }>}
 */
export async function runDigestConvexCompletion(opts = {}) {
  const env = opts.env ?? process.env;
  const todayDate = opts.todayDate ?? formatSydneyDate(env.CRON_TZ ?? env.TZ);
  const operatorHome = await resolveOperatorHome(env);
  const logPath = resolveWatchdogLogPath(operatorHome);
  const log = async (action, exitCode, detail) => {
    await appendLog(
      logPath,
      formatWatchdogLogLine(action, { date: todayDate, exit: exitCode, detail }),
    );
  };

  const forceRescore = opts.forceRescore ?? false;

  if (forceRescore) {
    const rescoreResult = await tryRescoreFromArtifact({ env, todayDate, operatorHome, log });
    if (rescoreResult) {
      return rescoreResult;
    }
  } else {
    const watchdogFn = opts.watchdogFn ?? runPushDigestWatchdog;
    const watchdogResult = await watchdogFn({ env, todayDate });
    if (watchdogResult.action === 'skipped-already-pushed' || watchdogResult.action === 'recovered-push') {
      return watchdogResult;
    }

    if (watchdogResult.action !== 'skipped-no-artifact') {
      return watchdogResult;
    }
  }

  const collectFn = opts.collectFn ?? collectAdapterOutputs;
  const ranAt = Date.now();
  const adapterOutputs = await collectFn(env);
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
    return { action: 'completion-no-signals', exitCode: 0 };
  }

  return scoreWriteAndPush(payload, ranAt, env, log, 'completion-backfill-push', adapterOutputs);
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
