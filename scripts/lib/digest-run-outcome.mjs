/**
 * Structured digest run-outcome records (Story 71-3).
 * Pure mapping + I/O helpers for ~/.hermes/digest-outcomes/.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ADAPTER_PAYLOAD_ARRAY_KEYS,
  unwrapAdapterResult,
} from '../hermes-skill-examples/morning-digest/scripts/adapter-result.mjs';
import {
  evaluateTodayDigestRuns,
  fetchRecentDigestRuns,
} from '../push-digest-watchdog.mjs';
import { TERMINAL_CONVEX_STATUSES } from './digest-retry-eligibility.mjs';

/** @typedef {'cron' | 'watchdog-0715' | 'watchdog-1300' | 'watchdog-1830' | 'manual'} DigestTrigger */
/** @typedef {'full-pipeline' | 'push-only-artifact' | 'watchdog-recover-artifact' | 'none'} DigestRecoveryPath */
/** @typedef {'success' | 'partial' | 'failed'} DigestOverall */

const VALID_TRIGGERS = new Set([
  'cron',
  'watchdog-0715',
  'watchdog-1300',
  'watchdog-1830',
  'manual',
]);

/** Collect-task keys → canonical source keys for outcome.sources. */
const COLLECT_KEY_TO_SOURCE_KEY = {
  trends: 'google_trends',
};

export const CONVEX_SUCCESS_TERMINAL_ACTIONS = new Set([
  'completion-backfill-push',
  'completion-force-rescore-push',
  'recovered-push',
  'skipped-already-pushed',
]);

export const CONVEX_FAILURE_TERMINAL_ACTIONS = new Set([
  'completion-convex-push-failed',
  'recovered-push-failed',
  'completion-backfill-push-failed',
]);

export const DISCORD_SUCCESS_ACTIONS = new Set(['discord-post-ok', 'discord-only-repair-ok']);
export const DISCORD_FAILURE_ACTIONS = new Set(['discord-post-failed', 'discord-only-repair-failed']);

/** Terminal actions that do not touch Convex — sticky merge must not infer divergence from them. */
export const CONVEX_UNTOUCHED_TERMINAL_ACTIONS = new Set([
  'discord-only-repair-ok',
  'discord-only-repair-failed',
  'discord-only-repair-skipped-no-artifact',
]);

/**
 * @param {Record<string, string | undefined>} env
 * @returns {DigestTrigger}
 */
export function resolveDigestTrigger(env) {
  const value = env.DIGEST_TRIGGER?.trim();
  if (value && VALID_TRIGGERS.has(value)) {
    return /** @type {DigestTrigger} */ (value);
  }
  return 'manual';
}

/**
 * Root directory for day-level outcome files (`YYYY-MM-DD.json`).
 *
 * @param {string} operatorHome
 * @returns {string}
 */
export function resolveDigestOutcomesRoot(operatorHome) {
  return join(operatorHome, '.hermes', 'digest-outcomes');
}

/**
 * @param {string} operatorHome
 * @param {string} [_date] — kept for call-site compatibility; no longer part of the path
 * @returns {string}
 */
export function resolveDigestOutcomeDir(operatorHome) {
  return resolveDigestOutcomesRoot(operatorHome);
}

/**
 * @param {string} operatorHome
 * @param {string} date
 * @returns {string}
 */
export function resolveDayOutcomeFilePath(operatorHome, date) {
  return join(resolveDigestOutcomesRoot(operatorHome), `${date}.json`);
}

/**
 * @param {string} date
 * @param {DigestTrigger} [trigger]
 * @returns {import('./digest-run-outcome.mjs').DigestDayOutcome}
 */
export function createZeroValueDayRecord(date, trigger = 'manual') {
  const now = new Date().toISOString();
  return {
    date,
    updatedAt: now,
    inProgress: null,
    convex: { ok: false, signalsWritten: 0, runId: null, status: null, error: null },
    discord: { ok: false, error: null },
    entity: { ok: null, status: 'not-run', mentionsWritten: 0, error: null },
    sources: {},
    overall: 'failed',
    lastInvocation: { timestamp: now, trigger, recoveryPath: null, action: null },
    history: [],
  };
}

/**
 * @param {Record<string, { success?: boolean; error?: unknown; data?: unknown } | unknown>} [adapterOutputs]
 * @returns {Record<string, { status: 'ok' | 'error' | 'empty'; count: number }>}
 */
export function buildSourcesFromAdapterOutputs(adapterOutputs) {
  /** @type {Record<string, { status: 'ok' | 'error' | 'empty'; count: number }>} */
  const sources = {};
  if (!adapterOutputs || typeof adapterOutputs !== 'object') {
    return sources;
  }

  for (const [collectKey, result] of Object.entries(adapterOutputs)) {
    const sourceKey = COLLECT_KEY_TO_SOURCE_KEY[collectKey] ?? collectKey;
    if (!result || typeof result !== 'object' || !('success' in result)) {
      sources[sourceKey] = { status: 'empty', count: 0 };
      continue;
    }

    const row = /** @type {{ success?: boolean; error?: unknown; data?: unknown }} */ (result);
    if (row.success === false) {
      sources[sourceKey] = { status: 'error', count: 0 };
      continue;
    }

    const data = unwrapAdapterResult(result);
    const count = countAdapterItems(data);
    sources[sourceKey] = count > 0 ? { status: 'ok', count } : { status: 'empty', count: 0 };
  }

  return sources;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {number}
 */
function countAdapterItems(data) {
  for (const key of ADAPTER_PAYLOAD_ARRAY_KEYS) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }
  return 0;
}

/**
 * @param {string[]} logActions
 * @returns {{ ok: boolean; error: string | null }}
 */
export function inferDiscordFromLogActions(logActions) {
  for (let i = logActions.length - 1; i >= 0; i -= 1) {
    const action = logActions[i];
    if (DISCORD_SUCCESS_ACTIONS.has(action)) {
      return { ok: true, error: null };
    }
    if (DISCORD_FAILURE_ACTIONS.has(action)) {
      return { ok: false, error: 'discord-post-failed' };
    }
  }
  return { ok: false, error: null };
}

/**
 * @param {{
 *   terminalAction: string;
 *   pushResult?: { ok?: boolean; runId?: string | null; signalsWritten?: number; error?: string | null } | null;
 *   convexRowStatus?: string | null;
 * }} input
 * @returns {{ ok: boolean; signalsWritten: number; status: string | null; error: string | null }}
 */
export function computeConvexBlock(input) {
  const { terminalAction, pushResult, convexRowStatus } = input;
  const status = convexRowStatus ?? null;
  const signalsWritten = pushResult?.signalsWritten ?? 0;

  if (terminalAction === 'completion-no-signals') {
    return { ok: false, signalsWritten: 0, status, error: 'completion-no-signals' };
  }

  if (
    terminalAction === 'completion-artifact-failed' ||
    terminalAction === 'completion-pipeline-failed' ||
    terminalAction === 'skipped-no-convex-env'
  ) {
    return { ok: false, signalsWritten: 0, status, error: terminalAction };
  }

  if (CONVEX_FAILURE_TERMINAL_ACTIONS.has(terminalAction)) {
    return {
      ok: false,
      signalsWritten,
      status,
      error: pushResult?.error ?? terminalAction,
    };
  }

  if (terminalAction === 'skipped-already-pushed') {
    if (status && TERMINAL_CONVEX_STATUSES.has(status)) {
      return { ok: true, signalsWritten, status, error: null };
    }
    return {
      ok: false,
      signalsWritten,
      status,
      error: 'log-skipped-but-convex-not-published',
    };
  }

  if (CONVEX_SUCCESS_TERMINAL_ACTIONS.has(terminalAction)) {
    if (pushResult && pushResult.ok === false) {
      return {
        ok: false,
        signalsWritten,
        status,
        error: pushResult.error ?? 'convex-push-failed',
      };
    }
    return {
      ok: true,
      runId: pushResult?.runId ?? null,
      signalsWritten,
      status,
      error: null,
    };
  }

  return { ok: false, signalsWritten, status, error: terminalAction || 'unknown' };
}

/**
 * @param {{
 *   terminalAction: string;
 *   discordResult?: { ok?: boolean; error?: string | null } | null;
 *   logActions?: string[];
 * }} input
 * @returns {{ ok: boolean; error: string | null }}
 */
export function computeDiscordBlock(input) {
  if (input.discordResult && typeof input.discordResult.ok === 'boolean') {
    return {
      ok: input.discordResult.ok,
      error: input.discordResult.ok ? null : (input.discordResult.error ?? 'discord-post-failed'),
    };
  }

  const inferred = inferDiscordFromLogActions(input.logActions ?? []);
  if (inferred.error || inferred.ok) {
    return inferred;
  }

  if (
    input.terminalAction === 'completion-no-signals' ||
    input.terminalAction === 'completion-artifact-failed' ||
    input.terminalAction === 'completion-pipeline-failed' ||
    CONVEX_FAILURE_TERMINAL_ACTIONS.has(input.terminalAction) ||
    input.terminalAction === 'skipped-no-convex-env'
  ) {
    return { ok: false, error: null };
  }

  if (input.terminalAction === 'skipped-already-pushed') {
    return inferred;
  }

  return { ok: false, error: null };
}

/**
 * @param {{
 *   convex: { ok: boolean };
 *   discord: { ok: boolean };
 *   sources: Record<string, { status: 'ok' | 'error' | 'empty'; count: number }>;
 *   terminalAction: string;
 *   signalCount?: number;
 *   entity?: { ok: boolean | null };
 * }} input
 * @returns {DigestOverall}
 */
export function computeOverall(input) {
  const { convex, discord, sources, terminalAction, signalCount = 0, entity } = input;

  if (
    terminalAction === 'completion-no-signals' ||
    CONVEX_FAILURE_TERMINAL_ACTIONS.has(terminalAction) ||
    terminalAction === 'completion-artifact-failed' ||
    terminalAction === 'completion-pipeline-failed' ||
    terminalAction === 'recovered-push-failed' ||
    terminalAction === 'completion-backfill-push-failed'
  ) {
    return 'failed';
  }

  const hasSourceError = Object.values(sources).some((row) => row.status === 'error');
  const hasSignals = signalCount > 0;

  if (convex.ok && discord.ok) {
    return entity?.ok === false ? 'partial' : 'success';
  }

  if (convex.ok && !discord.ok) {
    return 'partial';
  }

  if (!convex.ok && discord.ok) {
    return 'partial';
  }

  if (hasSourceError && hasSignals) {
    return 'partial';
  }

  if (terminalAction === 'skipped-already-pushed' && !convex.ok) {
    return 'partial';
  }

  return 'failed';
}

/**
 * Pure outcome builder for tests and orchestrator finally block.
 *
 * @param {{
 *   trigger: DigestTrigger;
 *   date: string;
 *   terminalAction: string;
 *   recoveryPath: DigestRecoveryPath;
 *   pushResult?: { ok?: boolean; runId?: string | null; signalsWritten?: number; error?: string | null } | null;
 *   discordResult?: { ok?: boolean; error?: string | null } | null;
 *   entityResult?: { status?: string; mentionsWritten?: number; reason?: string | null } | null;
 *   adapterOutputs?: Record<string, unknown>;
 *   convexRowStatus?: string | null;
 *   logActions?: string[];
 *   signalCount?: number;
 *   timestamp?: string;
 * }} input
 */
export function computeOutcomeFromInvocation(input) {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const sources = buildSourcesFromAdapterOutputs(
    /** @type {Record<string, { success?: boolean; error?: unknown; data?: unknown }>} */ (
      input.adapterOutputs ?? {}
    ),
  );
  const convexRaw = computeConvexBlock({
    terminalAction: input.terminalAction,
    pushResult: input.pushResult,
    convexRowStatus: input.convexRowStatus,
  });
  const discord = computeDiscordBlock({
    terminalAction: input.terminalAction,
    discordResult: input.discordResult,
    logActions: input.logActions,
  });
  const convex = {
    ok: convexRaw.ok,
    signalsWritten: convexRaw.signalsWritten,
    runId: convexRaw.runId ?? input.pushResult?.runId ?? null,
    status: convexRaw.status,
    error: convexRaw.error,
  };
  const entityStatus = input.entityResult?.status ?? 'not-run';
  const entity = {
    ok: entityStatus === 'not-run' ? null : entityStatus === 'ok',
    status: entityStatus,
    mentionsWritten: input.entityResult?.mentionsWritten ?? 0,
    error: entityStatus === 'ok' || entityStatus === 'not-run' ? null : (input.entityResult?.reason ?? 'unknown'),
  };
  const overall = computeOverall({
    convex,
    discord,
    sources,
    terminalAction: input.terminalAction,
    signalCount: input.signalCount ?? 0,
    entity,
  });

  return {
    timestamp,
    trigger: input.trigger,
    date: input.date,
    runId: input.pushResult?.runId ?? null,
    terminalAction: input.terminalAction,
    recoveryPath: input.recoveryPath,
    convex,
    discord,
    entity,
    sources,
    overall,
  };
}

/**
 * @param {typeof fetch} fetchFn
 * @param {{ convexUrl: string; convexDeployKey: string }} convexEnv
 * @param {string} todayDate
 * @returns {Promise<string | null>}
 */
export async function queryTodayConvexStatus(fetchFn, convexEnv, todayDate) {
  const recentRuns = await fetchRecentDigestRuns(fetchFn, convexEnv);
  const evaluated = evaluateTodayDigestRuns(recentRuns, todayDate);
  return evaluated.todayConvexStatus;
}

/**
 * @param {string} dir
 * @param {string} date
 * @param {typeof readFile} [readFileFn]
 * @param {(message: string) => void} [warnFn]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function readDayOutcomeRecord(dir, date, readFileFn = readFile, warnFn) {
  const warn = warnFn ?? ((message) => process.stderr.write(`${message}\n`));
  try {
    const raw = await readFileFn(join(dir, `${date}.json`), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    warn(`[digest-run-outcome] corrupt or unreadable day record ${date}.json — treating as absent`);
    return null;
  }
}

/**
 * @param {string} dir
 * @param {string} date
 * @param {Record<string, unknown>} record
 * @param {{
 *   writeFileFn?: typeof writeFile;
 *   renameFn?: typeof rename;
 *   mkdirFn?: typeof mkdir;
 * }} [deps]
 * @returns {Promise<string>}
 */
export async function writeDayOutcomeRecordAtomic(dir, date, record, deps = {}) {
  const writeFileFn = deps.writeFileFn ?? writeFile;
  const renameFn = deps.renameFn ?? rename;
  const mkdirFn = deps.mkdirFn ?? mkdir;
  await mkdirFn(dir, { recursive: true });
  const finalPath = join(dir, `${date}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFileFn(tmpPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  await renameFn(tmpPath, finalPath);
  return finalPath;
}

/**
 * @param {string} dir
 * @param {string} date
 * @param {{ trigger: DigestTrigger }} input
 * @param {{
 *   readFileFn?: typeof readFile;
 *   writeFileFn?: typeof writeFile;
 *   renameFn?: typeof rename;
 *   mkdirFn?: typeof mkdir;
 * }} [deps]
 */
export async function markInvocationStarted(dir, date, input, deps = {}) {
  const now = new Date().toISOString();
  const existing = await readDayOutcomeRecord(dir, date, deps.readFileFn);
  const record = existing ?? createZeroValueDayRecord(date, input.trigger);
  record.inProgress = { since: now, trigger: input.trigger };
  record.updatedAt = now;
  await writeDayOutcomeRecordAtomic(dir, date, record, deps);
  return record;
}

/**
 * Pure merge — sticky-true convex/discord, sources only when ranAdapters.
 *
 * @param {Record<string, unknown> | null} existing
 * @param {{
 *   date: string;
 *   trigger: DigestTrigger;
 *   recoveryPath?: DigestRecoveryPath | null;
 *   terminalAction?: string;
 *   action?: string;
 *   timestamp?: string;
 *   convex: { ok: boolean; signalsWritten?: number; runId?: string | null; status?: string | null; error?: string | null };
 *   discord: { ok: boolean; error?: string | null };
 *   entity?: { ok: boolean | null; status: string; mentionsWritten?: number; error?: string | null };
 *   sources?: Record<string, { status: 'ok' | 'error' | 'empty'; count: number }>;
 *   overall: DigestOverall;
 *   ranAdapters?: boolean;
 *   signalCount?: number;
 * }} current
 * @returns {{ record: Record<string, unknown>; warnings: string[] }}
 */
export function mergeDayOutcomeRecord(existing, current) {
  const base = existing ?? createZeroValueDayRecord(current.date, current.trigger);
  /** @type {string[]} */
  const stickyWarnings = [];

  const terminalAction = current.terminalAction ?? current.action ?? 'unknown';
  const convexUntouched = CONVEX_UNTOUCHED_TERMINAL_ACTIONS.has(terminalAction);
  const historyConvex =
    convexUntouched && base.convex && typeof base.convex === 'object'
      ? /** @type {typeof current.convex} */ (base.convex)
      : current.convex;

  /** @type {{ ok: boolean; signalsWritten: number; runId: string | null; status: string | null; error: string | null }} */
  let mergedConvex;
  if (current.convex.ok === true) {
    mergedConvex = {
      ok: true,
      signalsWritten: current.convex.signalsWritten ?? 0,
      runId: current.convex.runId ?? null,
      status: current.convex.status ?? null,
      error: null,
    };
  } else if (base.convex && /** @type {{ ok?: boolean }} */ (base.convex).ok === true) {
    mergedConvex = /** @type {typeof mergedConvex} */ (base.convex);
    if (current.convex.ok === false && !convexUntouched) {
      stickyWarnings.push(
        `divergence: this invocation's convex check returned ok=false (${current.convex.error ?? 'unknown'}) but day record already convex.ok=true — day record unchanged`,
      );
    }
  } else {
    mergedConvex = {
      ok: current.convex.ok,
      signalsWritten: current.convex.signalsWritten ?? 0,
      runId: current.convex.runId ?? null,
      status: current.convex.status ?? null,
      error: current.convex.error ?? null,
    };
  }

  /** @type {{ ok: boolean; error: string | null }} */
  let mergedDiscord;
  if (current.discord.ok === true) {
    mergedDiscord = { ok: true, error: null };
  } else if (base.discord && /** @type {{ ok?: boolean }} */ (base.discord).ok === true) {
    mergedDiscord = /** @type {typeof mergedDiscord} */ (base.discord);
    if (current.discord.ok === false && current.discord.error) {
      stickyWarnings.push(
        `divergence: this invocation's discord check returned ok=false (${current.discord.error}) but day record already discord.ok=true — day record unchanged`,
      );
    }
  } else {
    mergedDiscord = {
      ok: current.discord.ok,
      error: current.discord.error ?? null,
    };
  }

  const mergedSources =
    current.ranAdapters === true
      ? (current.sources ?? {})
      : /** @type {Record<string, { status: 'ok' | 'error' | 'empty'; count: number }>} */ (
          base.sources ?? {}
        );
  const mergedEntity = current.entity ?? {
    ok: null,
    status: 'not-run',
    mentionsWritten: 0,
    error: null,
  };

  const overall = computeOverall({
    convex: mergedConvex,
    discord: mergedDiscord,
    sources: mergedSources,
    terminalAction,
    signalCount: current.signalCount ?? 0,
    entity: mergedEntity,
  });

  const timestamp = current.timestamp ?? new Date().toISOString();
  const historyOverall = computeOverall({
    convex: historyConvex,
    discord: current.discord,
    sources: mergedSources,
    terminalAction,
    signalCount: current.signalCount ?? 0,
    entity: mergedEntity,
  });
  const historyEntry = {
    timestamp,
    trigger: current.trigger,
    recoveryPath: current.recoveryPath ?? null,
    action: terminalAction,
    convex: historyConvex,
    discord: current.discord,
    entity: mergedEntity,
    overall: historyOverall,
    ranAdapters: current.ranAdapters ?? false,
    warnings: [...stickyWarnings],
  };

  const record = {
    ...base,
    date: current.date,
    updatedAt: new Date().toISOString(),
    inProgress: null,
    convex: mergedConvex,
    discord: mergedDiscord,
    entity: mergedEntity,
    sources: mergedSources,
    overall,
    lastInvocation: {
      timestamp,
      trigger: current.trigger,
      recoveryPath: current.recoveryPath ?? null,
      action: terminalAction,
    },
    history: [...(/** @type {unknown[]} */ (base.history) ?? []), historyEntry],
  };

  return { record, warnings: stickyWarnings };
}

/**
 * @param {string} dir
 * @param {string} date
 * @param {Parameters<typeof mergeDayOutcomeRecord>[1]} current
 * @param {{
 *   readFileFn?: typeof readFile;
 *   writeFileFn?: typeof writeFile;
 *   renameFn?: typeof rename;
 *   mkdirFn?: typeof mkdir;
 * }} [deps]
 */
export async function mergeInvocationOutcome(dir, date, current, deps = {}) {
  const existing = await readDayOutcomeRecord(dir, date, deps.readFileFn);
  const { record } = mergeDayOutcomeRecord(existing, current);
  const filePath = await writeDayOutcomeRecordAtomic(dir, date, record, deps);
  return { record, filePath };
}
