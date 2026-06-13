#!/usr/bin/env node
/**
 * Post-cron observability gate for digest outcomes (Story 71-3).
 * Reads the day-level merged record; exits non-zero when today is partial, failed, or missing.
 */

import { formatSydneyDate } from './hermes-skill-examples/morning-digest/scripts/digest-date.mjs';
import { resolveOperatorHome } from './hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs';
import {
  readDayOutcomeRecord,
  resolveDigestOutcomesRoot,
} from './lib/digest-run-outcome.mjs';

const DEFAULT_HERMES_CHANNEL_ID = '1500733488897462382';
const DEFAULT_INPROGRESS_GRACE_MINUTES = 20;

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string | undefined}
 */
function readTrimmedEnv(env, key) {
  const value = env[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * @param {Record<string, unknown>} outcome
 * @returns {string}
 */
export function formatOutcomeCheckMessage(outcome) {
  const date = String(outcome.date ?? 'unknown');
  const overall = String(outcome.overall ?? 'unknown');
  const lastInvocation = /** @type {{ action?: string | null }} */ (outcome.lastInvocation ?? {});
  const terminalAction = String(
    lastInvocation.action ?? outcome.terminalAction ?? 'unknown',
  );
  const convex = /** @type {{ ok?: boolean; error?: string | null }} */ (outcome.convex ?? {});
  const discord = /** @type {{ ok?: boolean; error?: string | null }} */ (outcome.discord ?? {});
  const convexSummary = convex.ok ? 'ok' : `fail:${convex.error ?? 'unknown'}`;
  const discordSummary = discord.ok ? 'ok' : `fail:${discord.error ?? 'unknown'}`;
  return `Digest outcome check ${date}: overall=${overall} action=${terminalAction} convex=${convexSummary} discord=${discordSummary}`;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} message
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<boolean>}
 */
export async function postOutcomeCheckAlert(env, message, fetchFn = globalThis.fetch) {
  const token =
    readTrimmedEnv(env, 'HERMES_DISCORD_TOKEN') ?? readTrimmedEnv(env, 'DISCORD_BOT_TOKEN');
  const channelId =
    readTrimmedEnv(env, 'CNS_DISCORD_HERMES_CHANNEL_ID') ?? DEFAULT_HERMES_CHANNEL_ID;

  if (!token) {
    process.stderr.write('[digest-outcome-check] Discord token missing — alert skipped\n');
    return false;
  }

  const response = await fetchFn(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: message.slice(0, 1900) }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    process.stderr.write(
      `[digest-outcome-check] Discord alert failed HTTP ${response.status}: ${body.slice(0, 200)}\n`,
    );
    return false;
  }

  return true;
}

/**
 * @param {Record<string, unknown> | null} outcome
 * @param {{
 *   now?: number;
 *   graceMinutes?: number;
 * }} [opts]
 * @returns {{ exitCode: number; status: 'missing' | 'success' | 'in-progress-grace' | 'in-progress-stuck' | 'partial-or-failed' }}
 */
export function resolveOutcomeCheckExitCode(outcome, opts = {}) {
  const now = opts.now ?? Date.now();
  const parsedGrace = Number.parseInt(
    String(process.env.DIGEST_INPROGRESS_GRACE_MINUTES ?? ''),
    10,
  );
  const graceMinutes =
    opts.graceMinutes ?? (Number.isFinite(parsedGrace) ? parsedGrace : DEFAULT_INPROGRESS_GRACE_MINUTES);

  if (!outcome) {
    return { exitCode: 1, status: 'missing' };
  }

  if (outcome.overall === 'success') {
    return { exitCode: 0, status: 'success' };
  }

  const inProgress = /** @type {{ since?: string; trigger?: string } | null} */ (
    outcome.inProgress ?? null
  );
  if (inProgress && inProgress.since) {
    const sinceMs = new Date(inProgress.since).getTime();
    const elapsedMin = (now - sinceMs) / 60_000;
    if (elapsedMin <= graceMinutes) {
      return { exitCode: 0, status: 'in-progress-grace' };
    }
    return { exitCode: 1, status: 'in-progress-stuck' };
  }

  return { exitCode: 1, status: 'partial-or-failed' };
}

/**
 * @param {Record<string, unknown> | null} outcome
 * @param {ReturnType<typeof resolveOutcomeCheckExitCode>} resolved
 * @returns {string}
 */
export function formatOutcomeCheckStatusMessage(outcome, resolved) {
  const date = String(outcome?.date ?? 'unknown');
  if (resolved.status === 'missing') {
    return `Digest outcome check ${date}: no outcome record found`;
  }
  if (resolved.status === 'in-progress-grace') {
    const inProgress = /** @type {{ since?: string; trigger?: string }} */ (outcome?.inProgress ?? {});
    const sinceMs = new Date(String(inProgress.since)).getTime();
    const elapsedMin = Math.round((Date.now() - sinceMs) / 60_000);
    return `WARN: digest run in progress (started ${elapsedMin}m ago, trigger=${inProgress.trigger ?? 'unknown'}) — not yet success, no alert`;
  }
  if (resolved.status === 'in-progress-stuck') {
    const inProgress = /** @type {{ since?: string; trigger?: string }} */ (outcome?.inProgress ?? {});
    const sinceMs = new Date(String(inProgress.since)).getTime();
    const elapsedMin = Math.round((Date.now() - sinceMs) / 60_000);
    return `FAIL: digest run started ${elapsedMin}m ago and still marked in-progress — likely stuck/crashed (trigger=${inProgress.trigger ?? 'unknown'})`;
  }
  return formatOutcomeCheckMessage(outcome ?? {});
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   todayDate?: string;
 *   operatorHome?: string;
 *   readDayFn?: typeof readDayOutcomeRecord;
 *   alertFn?: typeof postOutcomeCheckAlert;
 *   now?: number;
 *   graceMinutes?: number;
 * }} [opts]
 * @returns {Promise<{ exitCode: number; outcome: Record<string, unknown> | null; message: string; status: string }>}
 */
export async function runDigestOutcomeCheck(opts = {}) {
  const env = opts.env ?? process.env;
  const todayDate = opts.todayDate ?? formatSydneyDate(env.CRON_TZ ?? env.TZ);
  const operatorHome = opts.operatorHome ?? (await resolveOperatorHome(env));
  const readDayFn = opts.readDayFn ?? readDayOutcomeRecord;
  const alertFn = opts.alertFn ?? postOutcomeCheckAlert;

  const dir = resolveDigestOutcomesRoot(operatorHome);
  const outcome = await readDayFn(dir, todayDate);
  const resolved = resolveOutcomeCheckExitCode(outcome, {
    now: opts.now,
    graceMinutes: opts.graceMinutes,
  });
  const message = formatOutcomeCheckStatusMessage(outcome, resolved);

  if (resolved.exitCode !== 0) {
    process.stderr.write(`${message}\n`);
    // Default-on: alert unless operator explicitly sets CHECK_DIGEST_ALERT=0.
    if (env.CHECK_DIGEST_ALERT !== '0') {
      try {
        await alertFn(env, message);
      } catch (err) {
        process.stderr.write(
          `[digest-outcome-check] Discord alert error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
  } else if (resolved.status === 'in-progress-grace') {
    process.stdout.write(`${message}\n`);
  } else {
    process.stdout.write(`${message}\n`);
  }

  return { exitCode: resolved.exitCode, outcome, message, status: resolved.status };
}

async function main() {
  const { exitCode } = await runDigestOutcomeCheck();
  process.exit(exitCode);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('check-digest-run-outcome.mjs');

if (isMain) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

export { resolveDigestOutcomesRoot, readDayOutcomeRecord };
