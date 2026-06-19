import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';

import {
  buildSourcesFromAdapterOutputs,
  computeConvexBlock,
  computeOutcomeFromInvocation,
  computeOverall,
  inferDiscordFromLogActions,
  markInvocationStarted,
  mergeDayOutcomeRecord,
  mergeInvocationOutcome,
  readDayOutcomeRecord,
  resolveDigestTrigger,
  writeDayOutcomeRecordAtomic,
} from '../scripts/lib/digest-run-outcome.mjs';
import {
  formatOutcomeCheckMessage,
  resolveOutcomeCheckExitCode,
  runDigestOutcomeCheck,
} from '../scripts/check-digest-run-outcome.mjs';

describe('digest-run-outcome (Story 71-3)', () => {
  it('resolveDigestTrigger defaults to manual and accepts cron/watchdog values', () => {
    assert.equal(resolveDigestTrigger({}), 'manual');
    assert.equal(resolveDigestTrigger({ DIGEST_TRIGGER: 'cron' }), 'cron');
    assert.equal(resolveDigestTrigger({ DIGEST_TRIGGER: 'watchdog-1830' }), 'watchdog-1830');
    assert.equal(resolveDigestTrigger({ DIGEST_TRIGGER: 'invalid' }), 'manual');
  });

  it('maps recovered-push and completion-backfill-push to convex.ok true', () => {
    const recovered = computeConvexBlock({
      terminalAction: 'recovered-push',
      pushResult: null,
      convexRowStatus: 'published',
    });
    assert.equal(recovered.ok, true);

    const backfill = computeConvexBlock({
      terminalAction: 'completion-backfill-push',
      pushResult: { ok: true, runId: 'run-1', signalsWritten: 2 },
      convexRowStatus: 'published',
    });
    assert.equal(backfill.ok, true);
  });

  it('maps recovered-push-failed to convex.ok false', () => {
    const failed = computeConvexBlock({
      terminalAction: 'recovered-push-failed',
      pushResult: { ok: false, signalsWritten: 0, error: 'spawn-failed' },
      convexRowStatus: null,
    });
    assert.equal(failed.ok, false);
  });

  it('push-only-artifact recovery path preserves convex.ok on completion-backfill-push', () => {
    const outcome = computeOutcomeFromInvocation({
      trigger: 'watchdog-0715',
      date: '2026-06-13',
      terminalAction: 'completion-backfill-push',
      recoveryPath: 'push-only-artifact',
      pushResult: { ok: true, runId: 'run-abc', signalsWritten: 3 },
      discordResult: { ok: true },
      convexRowStatus: 'published',
      logActions: ['push-only-artifact-recovery', 'discord-post-ok', 'completion-backfill-push'],
      signalCount: 3,
    });

    assert.equal(outcome.recoveryPath, 'push-only-artifact');
    assert.equal(outcome.convex.ok, true);
    assert.equal(outcome.convex.runId, 'run-abc');
    assert.equal(outcome.overall, 'success');
  });

  it('skipped-already-pushed with Convex started yields partial overall and convex.ok false', () => {
    const outcome = computeOutcomeFromInvocation({
      trigger: 'watchdog-1300',
      date: '2026-06-13',
      terminalAction: 'skipped-already-pushed',
      recoveryPath: 'none',
      convexRowStatus: 'started',
      logActions: ['skipped-already-pushed'],
    });

    assert.equal(outcome.convex.ok, false);
    assert.equal(outcome.convex.error, 'log-skipped-but-convex-not-published');
    assert.equal(outcome.overall, 'partial');
  });

  it('classifies adapter error payloads as sources.error not empty', () => {
    const sources = buildSourcesFromAdapterOutputs({
      reddit: { success: false, error: 'oauth-missing' },
      trends: { success: true, data: { events: [{ keyword: 'ai' }] } },
    });
    assert.equal(sources.reddit.status, 'error');
    assert.equal(sources.reddit.count, 0);
    assert.equal(sources.google_trends.status, 'ok');
    assert.equal(sources.google_trends.count, 1);
  });

  it('counts youtube videos[] for outcome sources.youtube (72-2)', () => {
    const sources = buildSourcesFromAdapterOutputs({
      youtube: {
        success: true,
        data: {
          videos: [
            { title: 'One', url: 'https://www.youtube.com/watch?v=a' },
            { title: 'Two', url: 'https://www.youtube.com/watch?v=b' },
          ],
        },
      },
    });
    assert.equal(sources.youtube.status, 'ok');
    assert.equal(sources.youtube.count, 2);
  });

  it('computeOverall marks convex+discord success as success even when a source errored', () => {
    const overall = computeOverall({
      convex: { ok: true },
      discord: { ok: true },
      sources: { reddit: { status: 'error', count: 0 } },
      terminalAction: 'completion-backfill-push',
      signalCount: 4,
    });
    assert.equal(overall, 'success');
  });

  it('inferDiscordFromLogActions reads latest discord action', () => {
    assert.deepEqual(inferDiscordFromLogActions(['discord-post-failed', 'discord-post-ok']), {
      ok: true,
      error: null,
    });
  });
});

describe('check-digest-run-outcome (Story 71-3)', () => {
  it('resolveOutcomeCheckExitCode returns 1 for missing/partial/failed and 0 for success', () => {
    assert.equal(resolveOutcomeCheckExitCode(null).exitCode, 1);
    assert.equal(resolveOutcomeCheckExitCode({ overall: 'failed' }).exitCode, 1);
    assert.equal(resolveOutcomeCheckExitCode({ overall: 'partial' }).exitCode, 1);
    assert.equal(resolveOutcomeCheckExitCode({ overall: 'success' }).exitCode, 0);
  });

  it('formatOutcomeCheckMessage includes overall and leg summaries', () => {
    const message = formatOutcomeCheckMessage({
      date: '2026-06-13',
      overall: 'partial',
      terminalAction: 'skipped-already-pushed',
      convex: { ok: false, error: 'log-skipped-but-convex-not-published' },
      discord: { ok: false, error: null },
    });
    assert.match(message, /overall=partial/);
    assert.match(message, /convex=fail:/);
  });

  it('runDigestOutcomeCheck exits non-zero when no record exists', async () => {
    const result = await runDigestOutcomeCheck({
      env: { CRON_TZ: 'Australia/Sydney', CHECK_DIGEST_ALERT: '0' },
      todayDate: '2026-06-13',
      operatorHome: '/tmp/nonexistent-home-71-3',
      readDayFn: async () => null,
      alertFn: async () => false,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.message, /no outcome record/);
  });

  it('runDigestOutcomeCheck exits zero for success record', async () => {
    const result = await runDigestOutcomeCheck({
      env: { CHECK_DIGEST_ALERT: '0' },
      todayDate: '2026-06-13',
      operatorHome: '/tmp/success-home-71-3',
      readDayFn: async () => ({
        date: '2026-06-13',
        overall: 'success',
        lastInvocation: { action: 'completion-backfill-push' },
        convex: { ok: true },
        discord: { ok: true },
      }),
      alertFn: async () => false,
    });
    assert.equal(result.exitCode, 0);
  });

  it('runDigestOutcomeCheck exits non-zero for partial record', async () => {
    const result = await runDigestOutcomeCheck({
      env: { CHECK_DIGEST_ALERT: '0' },
      todayDate: '2026-06-13',
      operatorHome: '/tmp/partial-home-71-3',
      readDayFn: async () => ({
        date: '2026-06-13',
        overall: 'partial',
        lastInvocation: { action: 'completion-backfill-push' },
        convex: { ok: true },
        discord: { ok: false },
        inProgress: null,
      }),
      alertFn: async () => false,
    });
    assert.equal(result.exitCode, 1);
  });
});

describe('digest-run-outcome amendment — day-level merge (Story 71-3)', () => {
  const date = '2026-06-13';

  it('1 — sticky success across invocations: later divergence does not downgrade overall', () => {
    const existing = {
      date,
      convex: { ok: true, signalsWritten: 71, runId: 'run-1', status: 'published', error: null },
      discord: { ok: true, error: null },
      sources: {},
      overall: 'success',
      history: [
        {
          timestamp: '2026-06-13T07:00:01.000Z',
          trigger: 'cron',
          recoveryPath: 'full-pipeline',
          action: 'completion-backfill-push',
          convex: { ok: true, signalsWritten: 71 },
          discord: { ok: true },
          overall: 'success',
          ranAdapters: true,
          warnings: [],
        },
      ],
    };

    const { record } = mergeDayOutcomeRecord(existing, {
      date,
      trigger: 'watchdog-1830',
      recoveryPath: 'none',
      terminalAction: 'skipped-already-pushed',
      timestamp: '2026-06-13T18:30:02.000Z',
      convex: { ok: false, signalsWritten: 71, runId: 'run-1', status: 'started', error: 'log-skipped-but-convex-not-published' },
      discord: { ok: true, error: null },
      sources: {},
      overall: 'partial',
      ranAdapters: false,
      signalCount: 71,
    });

    assert.equal(record.overall, 'success');
    assert.equal(/** @type {unknown[]} */ (record.history).length, 2);
    const latest = /** @type {{ warnings?: string[] }} */ (record.history.at(-1));
    assert.ok(latest.warnings?.some((w) => w.includes('divergence')));
  });

  it('2 — recovered-push inherits prior Discord success from day record', () => {
    const existing = {
      date,
      convex: { ok: false, signalsWritten: 0, runId: null, status: null, error: 'push-failed' },
      discord: { ok: true, error: null },
      sources: {},
      overall: 'failed',
      history: [],
    };

    const { record } = mergeDayOutcomeRecord(existing, {
      date,
      trigger: 'watchdog-0715',
      recoveryPath: 'watchdog-recover-artifact',
      terminalAction: 'recovered-push',
      timestamp: '2026-06-13T07:15:01.000Z',
      convex: { ok: true, signalsWritten: 71, runId: null, status: 'published', error: null },
      discord: { ok: false, error: null },
      sources: {},
      overall: 'partial',
      ranAdapters: false,
      signalCount: 71,
    });

    assert.equal(record.overall, 'success');
    assert.equal(/** @type {{ ok?: boolean }} */ (record.discord).ok, true);
    assert.equal(/** @type {{ ok?: boolean }} */ (record.convex).ok, true);
  });

  it('3 — in-progress within grace exits 0 with WARN message', async () => {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const result = await runDigestOutcomeCheck({
      env: { CHECK_DIGEST_ALERT: '0' },
      todayDate: date,
      operatorHome: '/tmp/inprogress-grace-71-3',
      now: Date.now(),
      graceMinutes: 20,
      readDayFn: async () => ({
        date,
        overall: 'failed',
        inProgress: { since, trigger: 'watchdog-1830' },
        convex: { ok: false },
        discord: { ok: false },
      }),
      alertFn: async () => false,
    });
    assert.equal(result.exitCode, 0);
    assert.match(result.message, /WARN/);
    assert.match(result.message, /no alert/);
  });

  it('4 — in-progress past grace exits 1 with FAIL stuck message', async () => {
    const since = new Date(Date.now() - 45 * 60_000).toISOString();
    const result = await runDigestOutcomeCheck({
      env: { CHECK_DIGEST_ALERT: '0' },
      todayDate: date,
      operatorHome: '/tmp/inprogress-stuck-71-3',
      now: Date.now(),
      graceMinutes: 20,
      readDayFn: async () => ({
        date,
        overall: 'failed',
        inProgress: { since, trigger: 'watchdog-1830' },
        convex: { ok: false },
        discord: { ok: false },
      }),
      alertFn: async () => false,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.message, /FAIL/);
    assert.match(result.message, /stuck/);
  });

  it('5 — no record at all exits 1', async () => {
    const result = await runDigestOutcomeCheck({
      env: { CHECK_DIGEST_ALERT: '0' },
      todayDate: date,
      readDayFn: async () => null,
      alertFn: async () => false,
    });
    assert.equal(result.exitCode, 1);
  });

  it('6 — atomic write then read returns valid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'digest-outcome-atomic-'));
    const record = {
      date,
      updatedAt: new Date().toISOString(),
      inProgress: null,
      convex: { ok: true, signalsWritten: 1, runId: 'r1', status: 'published', error: null },
      discord: { ok: true, error: null },
      sources: {},
      overall: 'success',
      lastInvocation: { timestamp: new Date().toISOString(), trigger: 'cron', recoveryPath: null, action: 'completion-backfill-push' },
      history: [],
    };
    await writeDayOutcomeRecordAtomic(dir, date, record);
    const readBack = await readDayOutcomeRecord(dir, date);
    assert.equal(readBack?.overall, 'success');
  });

  it('7 — markInvocationStarted then mergeInvocationOutcome clears inProgress', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'digest-outcome-fast-exit-'));
    await markInvocationStarted(dir, date, { trigger: 'watchdog-1830' });
    const mid = await readDayOutcomeRecord(dir, date);
    assert.ok(mid?.inProgress);

    await mergeInvocationOutcome(dir, date, {
      date,
      trigger: 'watchdog-1830',
      recoveryPath: 'none',
      terminalAction: 'skipped-already-pushed',
      timestamp: new Date().toISOString(),
      convex: { ok: true, signalsWritten: 71, runId: 'run-1', status: 'published', error: null },
      discord: { ok: true, error: null },
      sources: {},
      overall: 'success',
      ranAdapters: false,
      signalCount: 71,
    });

    const finalRecord = await readDayOutcomeRecord(dir, date);
    assert.ok(finalRecord);
    assert.equal(finalRecord.inProgress, null);
    assert.equal(/** @type {unknown[]} */ (finalRecord.history).length, 1);
  });

  it('8 — sources preserved across push-only invocation (ranAdapters false)', () => {
    const existing = {
      date,
      convex: { ok: true, signalsWritten: 71, runId: 'run-1', status: 'published', error: null },
      discord: { ok: true, error: null },
      sources: {
        reddit: { status: 'error', count: 0 },
        google_trends: { status: 'ok', count: 12 },
      },
      overall: 'partial',
      history: [],
    };

    const { record } = mergeDayOutcomeRecord(existing, {
      date,
      trigger: 'watchdog-0715',
      recoveryPath: 'push-only-artifact',
      terminalAction: 'completion-backfill-push',
      timestamp: '2026-06-13T07:15:01.000Z',
      convex: { ok: true, signalsWritten: 71, runId: 'run-2', status: 'published', error: null },
      discord: { ok: true, error: null },
      sources: {},
      overall: 'success',
      ranAdapters: false,
      signalCount: 71,
    });

    assert.deepEqual(record.sources, existing.sources);
  });

  it('discord-only-repair-ok mirrors existing convex in history without divergence warning', () => {
    const existing = {
      date,
      convex: { ok: true, signalsWritten: 71, runId: 'run-1', status: 'published', error: null },
      discord: { ok: false, error: null },
      sources: {},
      overall: 'partial',
      history: [],
    };

    const outcome = computeOutcomeFromInvocation({
      trigger: 'watchdog-0715',
      date,
      terminalAction: 'discord-only-repair-ok',
      recoveryPath: 'none',
      discordResult: { ok: true },
      convexRowStatus: 'published',
    });

    assert.equal(outcome.convex.ok, false, 'invocation-level convex block still catch-all until merge');

    const { record, warnings } = mergeDayOutcomeRecord(existing, {
      date,
      trigger: outcome.trigger,
      recoveryPath: outcome.recoveryPath,
      terminalAction: outcome.terminalAction,
      timestamp: outcome.timestamp,
      convex: outcome.convex,
      discord: outcome.discord,
      sources: outcome.sources,
      overall: outcome.overall,
      ranAdapters: false,
    });

    assert.deepEqual(warnings, []);
    assert.equal(record.overall, 'success');
    assert.equal(record.convex.ok, true);
    assert.equal(record.discord.ok, true);
    const latest = /** @type {{ warnings?: string[]; convex?: { ok?: boolean }; overall?: string }} */ (
      record.history.at(-1)
    );
    assert.deepEqual(latest.warnings, []);
    assert.equal(latest.convex?.ok, true);
    assert.equal(latest.overall, 'success');
  });

  it('readDayOutcomeRecord treats corrupt JSON as null', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'digest-outcome-corrupt-'));
    await writeFile(join(dir, `${date}.json`), '{not-json', 'utf8');
    const warnings = [];
    const record = await readDayOutcomeRecord(dir, date, readFile, (msg) => warnings.push(msg));
    assert.equal(record, null);
    assert.ok(warnings.some((w) => w.includes('corrupt')));
  });
});
