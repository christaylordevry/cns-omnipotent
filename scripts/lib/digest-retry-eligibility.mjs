/**
 * Pure retry-eligibility taxonomy for morning-digest watchdog / completion (Story 71-1).
 *
 * classifyDigestRetryBucket is side-effect free — safe for 71-3 outcome reporting.
 * retryable ≠ alert-worthy every time; 71-3 owns alert dedupe for bucket 3.
 */

export { MISSING_CONVEX_ENV_ERROR } from '../hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';

/** @typedef {'terminal-success' | 'full-pipeline' | 'push-only-artifact' | 'discord-only-repair'} DigestRetryBucket */

export const TERMINAL_SUCCESS_LOG_ACTIONS = new Set([
  'completion-backfill-push',
  'completion-force-rescore-push',
  'completion-no-signals',
  'discord-post-ok',
  'skipped-already-pushed',
]);

export const TERMINAL_CONVEX_STATUSES = new Set(['published', 'archived', 'completed']);

export const DIGEST_LOG_ACTIONS = new Set([
  'started',
  'completion-backfill-push',
  'completion-backfill-push-failed',
  'completion-force-rescore-push',
  'completion-force-rescore-push-failed',
  'completion-no-signals',
  'completion-convex-push-failed',
  'completion-pipeline-failed',
  'completion-artifact-failed',
  'discord-post-ok',
  'discord-post-failed',
  'skipped-already-pushed',
  'recovered-push',
  'recovered-push-failed',
  'push-only-artifact-recovery',
  'skipped-no-artifact',
  'discord-only-repair-ok',
  'discord-only-repair-failed',
  'discord-only-repair-skipped-no-artifact',
]);

/**
 * @param {string | undefined} detail
 * @returns {{ error?: string; signalsWritten?: number } | null}
 */
export function parseCompletionLogDetail(detail) {
  if (!detail || typeof detail !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(detail);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return /** @type {{ error?: string; signalsWritten?: number }} */ (parsed);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {string} line
 * @returns {{ action: string; date: string; detail?: string } | null}
 */
export function parseWatchdogLogLine(line) {
  const trimmed = String(line ?? '').trim();
  if (!trimmed) {
    return null;
  }

  const actionMatch = trimmed.match(/(?:^|\s)action=([^\s]+)/);
  const dateMatch = trimmed.match(/(?:^|\s)date=([^\s]+)/);
  if (!actionMatch || !dateMatch) {
    return null;
  }

  const detailMatch = trimmed.match(/(?:^|\s)detail=(.+)$/);
  return {
    action: actionMatch[1],
    date: dateMatch[1],
    detail: detailMatch ? detailMatch[1] : undefined,
  };
}

/**
 * @param {string} logContent
 * @param {string} todayDate
 * @returns {{ action: string; detail?: string } | null}
 */
export function findLatestDigestLogEntryForDate(logContent, todayDate) {
  const lines = String(logContent ?? '').split('\n');
  /** @type {{ action: string; detail?: string } | null} */
  let latest = null;

  for (const line of lines) {
    const parsed = parseWatchdogLogLine(line);
    if (!parsed || parsed.date !== todayDate) {
      continue;
    }
    if (!DIGEST_LOG_ACTIONS.has(parsed.action)) {
      continue;
    }
    latest = { action: parsed.action, detail: parsed.detail };
  }

  return latest;
}

/**
 * @param {string} logContent
 * @param {string} todayDate
 * @returns {string[]}
 */
export function collectDigestLogActionsForDate(logContent, todayDate) {
  const actions = [];
  for (const line of String(logContent ?? '').split('\n')) {
    const parsed = parseWatchdogLogLine(line);
    if (!parsed || parsed.date !== todayDate) {
      continue;
    }
    if (!DIGEST_LOG_ACTIONS.has(parsed.action)) {
      continue;
    }
    actions.push(parsed.action);
  }
  return actions;
}

/**
 * Pure classifier — no I/O or side effects (71-3 may import for reporting only).
 *
 * @param {{
 *   latestLogAction?: string | null;
 *   detail?: string | null;
 *   convexStatus?: string | null;
 *   hasArtifact?: boolean;
 *   missingConvexEnvError?: string;
 *   dayOutcome?: {
 *     convex?: { ok?: boolean };
 *     discord?: { ok?: boolean };
 *     inProgress?: unknown;
 *   } | null;
 * }} input
 * @returns {DigestRetryBucket}
 */
export function classifyDigestRetryBucket(input) {
  const latestLogAction = input.latestLogAction ?? null;
  const detail = input.detail ?? null;
  const convexStatus = input.convexStatus ?? null;
  const hasArtifact = input.hasArtifact === true;
  const missingEnvError = input.missingConvexEnvError ?? 'missing-convex-env';
  const dayOutcome = input.dayOutcome ?? null;

  if (latestLogAction && TERMINAL_SUCCESS_LOG_ACTIONS.has(latestLogAction)) {
    const result = 'terminal-success';
    if (
      dayOutcome &&
      dayOutcome.convex?.ok === true &&
      dayOutcome.discord?.ok === false &&
      dayOutcome.inProgress === null
    ) {
      return 'discord-only-repair';
    }
    return result;
  }

  if (convexStatus && TERMINAL_CONVEX_STATUSES.has(convexStatus)) {
    const result = 'terminal-success';
    if (
      dayOutcome &&
      dayOutcome.convex?.ok === true &&
      dayOutcome.discord?.ok === false &&
      dayOutcome.inProgress === null
    ) {
      return 'discord-only-repair';
    }
    return result;
  }

  if (latestLogAction === 'completion-convex-push-failed') {
    const parsed = parseCompletionLogDetail(detail ?? undefined);
    if (parsed?.error === missingEnvError) {
      return hasArtifact ? 'push-only-artifact' : 'full-pipeline';
    }
    return 'full-pipeline';
  }

  if (convexStatus === 'started') {
    return 'full-pipeline';
  }

  if (latestLogAction === 'started') {
    return 'full-pipeline';
  }

  if (!latestLogAction && !convexStatus && hasArtifact) {
    return 'push-only-artifact';
  }

  if (!latestLogAction && (convexStatus === 'failed' || convexStatus === null) && hasArtifact) {
    return 'push-only-artifact';
  }

  return 'full-pipeline';
}
