#!/usr/bin/env node
/**
 * Cron watchdog: backfill Convex digestRuns when §9 push was skipped (Story 67-10).
 *
 * Checks digest:getRecentDigestRuns for today's non-failed run; if missing, replays
 * push-digest-convex.mjs from ~/.hermes/digest-push-YYYY-MM-DD.json when present.
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import {
  normalizeConvexUrl,
  readDigestPushPayload,
  resolveConvexPushEnv,
} from './hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';
import { resolveOperatorHome } from './hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs';

const QUERY_PATH = 'digest:getRecentDigestRuns';
const RECENT_RUNS_LIMIT = 10;
const QUERY_MAX_ATTEMPTS = 3;
const QUERY_RETRY_DELAY_MS = 1000;
const VALID_NON_FAILED_STATUSES = new Set(['started', 'completed', 'published', 'archived']);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string | undefined} envTz
 * @param {Date} [now]
 * @returns {string}
 */
export function formatTodayLocalDate(envTz, now = new Date()) {
  const timeZone = envTz?.trim() || undefined;
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/**
 * @param {typeof fetch} fetchFn
 * @param {{ convexUrl: string; convexDeployKey: string }} convexEnv
 * @param {string} path
 * @param {Record<string, unknown>} args
 * @returns {Promise<unknown>}
 */
export async function postQuery(fetchFn, convexEnv, path, args) {
  const response = await fetchFn(`${normalizeConvexUrl(convexEnv.convexUrl)}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Convex ${convexEnv.convexDeployKey}`,
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  });

  const bodyText = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Convex HTTP ${response.status}: ${bodyText.slice(0, 200)}`);
  }

  let payload;
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    throw new Error('Convex query response was not valid JSON');
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.status === 'error') {
      const message =
        typeof payload.errorMessage === 'string' ? payload.errorMessage : 'Convex query failed';
      throw new Error(message);
    }
    if (payload.status && payload.status !== 'success') {
      throw new Error('Convex query returned unexpected status');
    }
    return payload.value;
  }

  return payload;
}

/**
 * @param {typeof fetch} fetchFn
 * @param {{ convexUrl: string; convexDeployKey: string }} convexEnv
 * @param {{ maxAttempts?: number; retryDelayMs?: number; sleepFn?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<unknown>}
 */
export async function fetchRecentDigestRuns(fetchFn, convexEnv, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? QUERY_MAX_ATTEMPTS;
  const retryDelayMs = opts.retryDelayMs ?? QUERY_RETRY_DELAY_MS;
  const sleepFn = opts.sleepFn ?? ((ms) => delayMs(ms));

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await postQuery(fetchFn, convexEnv, QUERY_PATH, { limit: RECENT_RUNS_LIMIT });
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await sleepFn(retryDelayMs);
      }
    }
  }

  throw lastError ?? new Error('Convex query failed');
}

/**
 * @param {unknown} runs
 * @param {string} todayDate
 * @returns {{ hasNonFailedToday: boolean; todayFailedOnly: boolean }}
 */
export function evaluateTodayDigestRuns(runs, todayDate) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return { hasNonFailedToday: false, todayFailedOnly: false };
  }

  let sawToday = false;
  let sawTodayNonFailed = false;

  for (const row of runs) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const record = /** @type {{ date?: unknown; status?: unknown }} */ (row);
    if (record.date !== todayDate) {
      continue;
    }
    sawToday = true;
    const status = typeof record.status === 'string' ? record.status : '';
    if (VALID_NON_FAILED_STATUSES.has(status)) {
      sawTodayNonFailed = true;
      break;
    }
  }

  return {
    hasNonFailedToday: sawTodayNonFailed,
    todayFailedOnly: sawToday && !sawTodayNonFailed,
  };
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolvePushDigestScriptPath(env) {
  const repo = env.OMNIPOTENT_REPO?.trim() || repoRoot;
  return join(
    repo,
    'scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs',
  );
}

/**
 * @param {string} operatorHome
 * @returns {string}
 */
export function resolveWatchdogLogPath(operatorHome) {
  return join(operatorHome, '.hermes', 'logs', 'push-digest-watchdog.log');
}

/**
 * @param {{
 *   logPath: string;
 *   line: string;
 *   appendFileFn?: typeof appendFile;
 *   mkdirFn?: typeof mkdir;
 * }} opts
 */
async function appendWatchdogLog(opts) {
  const appendFileFn = opts.appendFileFn ?? appendFile;
  const mkdirFn = opts.mkdirFn ?? mkdir;
  await mkdirFn(dirname(opts.logPath), { recursive: true });
  await appendFileFn(opts.logPath, `${opts.line}\n`, 'utf8');
}

/**
 * @param {string} action
 * @param {{ date: string; exit: number; detail?: string }} fields
 * @returns {string}
 */
export function formatWatchdogLogLine(action, fields) {
  const timestamp = new Date().toISOString();
  const parts = [`${timestamp}`, `action=${action}`, `date=${fields.date}`, `exit=${fields.exit}`];
  if (fields.detail) {
    parts.push(`detail=${fields.detail}`);
  }
  return parts.join(' ');
}

/**
 * @param {string} scriptPath
 * @param {Record<string, string | undefined>} env
 * @param {string} digestPushJson
 * @param {(cmd: string, args: string[], opts: { env: Record<string, string | undefined> }) => Promise<{ exitCode: number }>} spawnFn
 * @returns {Promise<number>}
 */
async function spawnPushDigest(scriptPath, env, digestPushJson, spawnFn) {
  const childEnv = { ...env, DIGEST_PUSH_JSON: digestPushJson };
  const result = await spawnFn(process.execPath, [scriptPath], { env: childEnv });
  return result.exitCode ?? 0;
}

/**
 * @param {{
 *   env: Record<string, string | undefined>;
 *   todayDate: string;
 *   operatorHome: string;
 *   log: (action: string, exitCode: number, detail?: string) => Promise<void>;
 *   readFileFn: typeof readFile;
 *   spawnFn: (cmd: string, args: string[], opts: { env: Record<string, string | undefined> }) => Promise<{ exitCode: number }>;
 *   recoveryDetail?: string;
 * }} ctx
 * @returns {Promise<{ action: string; exitCode: number }>}
 */
async function tryRecoverFromArtifact(ctx) {
  const artifactPath = join(ctx.operatorHome, '.hermes', `digest-push-${ctx.todayDate}.json`);
  let artifactRaw;
  try {
    artifactRaw = await ctx.readFileFn(artifactPath, 'utf8');
  } catch {
    const detail = ctx.recoveryDetail ?? undefined;
    await ctx.log('skipped-no-artifact', 0, detail);
    return { action: 'skipped-no-artifact', exitCode: 0 };
  }

  const payload = readDigestPushPayload({ DIGEST_PUSH_JSON: artifactRaw });
  if (!payload) {
    const detail = ctx.recoveryDetail ? `${ctx.recoveryDetail};invalid-json` : 'invalid-json';
    await ctx.log('skipped-no-artifact', 0, detail);
    return { action: 'skipped-no-artifact', exitCode: 0 };
  }

  const pushScript = resolvePushDigestScriptPath(ctx.env);
  try {
    const pushExitCode = await spawnPushDigest(
      pushScript,
      ctx.env,
      artifactRaw.trim(),
      ctx.spawnFn,
    );
    const action = pushExitCode === 0 ? 'recovered-push' : 'recovered-push-failed';
    await ctx.log(action, pushExitCode, ctx.recoveryDetail);
    return { action, exitCode: 0 };
  } catch (err) {
    const spawnDetail =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'spawn-failed';
    const detail = ctx.recoveryDetail ? `${ctx.recoveryDetail};${spawnDetail}` : spawnDetail;
    await ctx.log('recovered-push-failed', 0, detail);
    return { action: 'recovered-push-failed', exitCode: 0 };
  }
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   fetchFn?: typeof fetch;
 *   readFileFn?: typeof readFile;
 *   spawnFn?: (cmd: string, args: string[], opts: { env: Record<string, string | undefined> }) => Promise<{ exitCode: number }>;
 *   appendFileFn?: typeof appendFile;
 *   mkdirFn?: typeof mkdir;
 *   todayDate?: string;
 *   queryMaxAttempts?: number;
 *   queryRetryDelayMs?: number;
 *   sleepFn?: (ms: number) => Promise<void>;
 * }} [opts]
 * @returns {Promise<{ action: string; exitCode: number }>}
 */
export async function runPushDigestWatchdog(opts = {}) {
  const env = opts.env ?? process.env;
  const todayDate =
    opts.todayDate ?? formatTodayLocalDate(env.CRON_TZ ?? env.TZ, new Date());
  const operatorHome = await resolveOperatorHome(env);
  const logPath = resolveWatchdogLogPath(operatorHome);
  const log = async (action, exitCode, detail) => {
    await appendWatchdogLog({
      logPath,
      line: formatWatchdogLogLine(action, { date: todayDate, exit: exitCode, detail }),
      appendFileFn: opts.appendFileFn,
      mkdirFn: opts.mkdirFn,
    });
  };

  const convexEnv = await resolveConvexPushEnv(env);
  if (!convexEnv) {
    await log('skipped-no-convex-env', 0);
    return { action: 'skipped-no-convex-env', exitCode: 0 };
  }

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const readFileFn = opts.readFileFn ?? readFile;
  const spawnFn =
    opts.spawnFn ??
    ((cmd, args, spawnOpts) =>
      new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
          env: spawnOpts.env,
          stdio: ['ignore', 'ignore', 'pipe'],
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ exitCode: code ?? 0 }));
      }));

  const recoveryCtx = {
    env,
    todayDate,
    operatorHome,
    log,
    readFileFn,
    spawnFn,
  };

  let queryFailed = false;
  try {
    const recentRuns = await fetchRecentDigestRuns(fetchFn, convexEnv, {
      maxAttempts: opts.queryMaxAttempts,
      retryDelayMs: opts.queryRetryDelayMs,
      sleepFn: opts.sleepFn,
    });
    const { hasNonFailedToday } = evaluateTodayDigestRuns(recentRuns, todayDate);
    if (hasNonFailedToday) {
      await log('skipped-already-pushed', 0);
      return { action: 'skipped-already-pushed', exitCode: 0 };
    }
  } catch {
    queryFailed = true;
  }

  return tryRecoverFromArtifact({
    ...recoveryCtx,
    recoveryDetail: queryFailed ? 'query-retries-exhausted' : undefined,
  });
}

async function main() {
  await runPushDigestWatchdog();
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('push-digest-watchdog.mjs');

if (isMain) {
  main().catch(async () => {
    process.exit(0);
  });
}
