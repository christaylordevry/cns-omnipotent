import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  buildErrorsBySource,
  formatSydneyDate,
  parseAdapterStdout,
  parseCompletionCliArgs,
  runDigestConvexCompletion,
  summarizeAdapterCollection,
  unwrapAdapterResult,
} from '../scripts/run-digest-convex-completion.mjs';

describe('run-digest-convex-completion (Story 68-10)', () => {
  it('formatSydneyDate uses Australia/Sydney by default', () => {
    const value = formatSydneyDate('Australia/Sydney', new Date('2026-06-11T02:00:00Z'));
    assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('formatSydneyDate returns Sydney civil date at UTC boundary', () => {
    assert.equal(
      formatSydneyDate('Australia/Sydney', new Date('2026-06-10T20:00:00.000Z')),
      '2026-06-11',
    );
  });

  it('formatSydneyDate defaults to Sydney when env tz absent', () => {
    assert.equal(formatSydneyDate(undefined, new Date('2026-06-10T20:00:00.000Z')), '2026-06-11');
  });

  it('unwrapAdapterResult supports wrapped and legacy bare objects', () => {
    assert.deepEqual(unwrapAdapterResult({ success: true, data: { posts: [{ title: 'ok' }] } }), {
      posts: [{ title: 'ok' }],
    });
    assert.deepEqual(unwrapAdapterResult({ success: false, error: 'timeout' }), {
      error: 'timeout',
    });
    assert.deepEqual(unwrapAdapterResult({ posts: [{ title: 'legacy' }] }), {
      posts: [{ title: 'legacy' }],
    });
  });

  it('summarizeAdapterCollection emits one-line per-source summary', () => {
    const line = summarizeAdapterCollection({
      trends: { success: true, data: { events: [] } },
      twitter: { success: false, error: 'invalid-json' },
    });
    assert.equal(line, 'collect: trends=ok twitter=fail:invalid-json');
  });

  it('buildErrorsBySource lists only failed wrapped sources', () => {
    assert.deepEqual(
      buildErrorsBySource({
        trends: { success: true, data: { events: [] } },
        reddit: { success: false, error: 'timeout' },
      }),
      { reddit: 'timeout' },
    );
  });

  it('buildErrorsBySource maps trends collect key to google_trends', () => {
    assert.deepEqual(
      buildErrorsBySource({
        trends: { success: false, error: 'invalid-json' },
      }),
      { google_trends: 'invalid-json' },
    );
  });

  it('parseAdapterStdout returns null on invalid JSON', () => {
    assert.equal(parseAdapterStdout('not-json'), null);
    assert.deepEqual(parseAdapterStdout('{"ok":true}'), { ok: true });
  });

  it('parseCompletionCliArgs detects --force-rescore', () => {
    assert.equal(parseCompletionCliArgs(['--force-rescore']).forceRescore, true);
    assert.equal(parseCompletionCliArgs([]).forceRescore, false);
  });

  it('delegates to watchdog when artifact replay succeeds', async () => {
    const result = await runDigestConvexCompletion({
      env: { CRON_TZ: 'Australia/Sydney', HOME: join(tmpdir(), 'completion-watchdog') },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'recovered-push', exitCode: 0 }),
      collectFn: async () => {
        throw new Error('collect should not run');
      },
    });
    assert.equal(result.action, 'recovered-push');
  });

  it('backfills when watchdog reports skipped-no-artifact', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-backfill-'));
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'skipped-no-artifact', exitCode: 0 }),
      collectFn: async () => ({
        trends: { success: true, data: { events: [{ keyword: 'AI agents', normalizedValue: 0.5 }] } },
        twitter: {
          success: true,
          data: { posts: [{ title: 'Tweet', url: 'https://x.com/a/status/1' }] },
        },
        bluesky: {
          success: true,
          data: { posts: [{ title: 'Post', url: 'https://bsky.app/profile/a/post/1' }] },
        },
        producthunt: {
          success: true,
          data: { launches: [{ title: 'PH', url: 'https://ph.com/1', votesCount: 3 }] },
        },
        reddit: { success: false, error: 'timeout' },
      }),
    });

    assert.equal(result.action, 'completion-backfill-push');
    const artifactPath = join(operatorHome, '.hermes', 'digest-push-2026-06-11.json');
    const artifactRaw = await readFile(artifactPath, 'utf8');
    const artifact = JSON.parse(artifactRaw);
    assert.equal(artifact.run.date, '2026-06-11');
    assert.ok(Array.isArray(artifact.signals));
    assert.ok(artifact.signals.some((row) => row.sourceType === 'twitter'));
    assert.ok(artifact.signals.some((row) => row.sourceType === 'bluesky'));
    assert.ok(artifact.signals.some((row) => row.sourceType === 'producthunt'));
    assert.ok(Array.isArray(artifact.run.sourceOutcomes));
    assert.ok(artifact.run.sourceOutcomes.some((row) => row.sourceKey === 'google_trends'));
    assert.deepEqual(artifact.run.errors_by_source, { reddit: 'timeout' });
    assert.ok(
      artifact.run.sourceOutcomes.some(
        (row) => row.sourceKey === 'reddit' && row.status === 'error' && row.reason === 'timeout',
      ),
    );
    const logRaw = await readFile(
      join(operatorHome, '.hermes', 'logs', 'push-digest-watchdog.log'),
      'utf8',
    );
    assert.match(logRaw, /action=discord-post-failed/);
    assert.match(logRaw, /action=completion-backfill-push/);
  });

  it('force-rescore bypasses watchdog already-pushed and rescores artifact', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-force-rescore-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    const artifact = {
      run: { date: '2026-06-11', ranAt: 1, status: 'published' },
      signals: [
        {
          sourceType: 'twitter',
          title: 'Test tweet',
          url: 'https://x.com/ylecun/status/1',
          authorHandle: 'ylecun',
          sourceMetadata: { authorHandle: 'ylecun', likes: 10 },
          scores: { personalRelevance: 0, momentum: 0, novelty: 0, relevance: 0, urgency: 0 },
        },
      ],
    };
    await writeFile(join(hermesDir, 'digest-push-2026-06-11.json'), JSON.stringify(artifact));
    await writeFile(
      join(hermesDir, 'nexus-people.yaml'),
      [
        'version: 1',
        'people:',
        '  - name: "Yann LeCun"',
        '    handles:',
        '      twitter: "ylecun"',
        '    tags: ["meta"]',
        '    weight: 1',
        '',
      ].join('\n'),
    );

    let watchdogCalled = false;
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      forceRescore: true,
      watchdogFn: async () => {
        watchdogCalled = true;
        return { action: 'skipped-already-pushed', exitCode: 0 };
      },
      collectFn: async () => {
        throw new Error('collect should not run when artifact rescore succeeds');
      },
    });

    assert.equal(watchdogCalled, false);
    assert.equal(result.action, 'completion-force-rescore-push');
    const updatedRaw = await readFile(join(hermesDir, 'digest-push-2026-06-11.json'), 'utf8');
    const updated = JSON.parse(updatedRaw);
    const ylecun = updated.signals.find((row) => row.sourceMetadata?.authorHandle === 'ylecun');
    assert.ok(ylecun);
    assert.ok((ylecun.scores?.personalRelevance ?? 0) >= 20);
  });

  it('force-rescore applies people bonus when HOME is Hermes profile-isolated', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-hermes-home-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-people.yaml'),
      [
        'version: 1',
        'people:',
        '  - name: "Ethan Mollick"',
        '    handles:',
        '      twitter: [emollick]',
        '    tags: [ai, education]',
        '    weight: 2.5',
        '',
      ].join('\n'),
    );
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: { date: '2026-06-11', ranAt: 1, status: 'published' },
        signals: [
          {
            sourceType: 'twitter',
            title: 'AI in education',
            url: 'https://x.com/emollick/status/1',
            sourceMetadata: { authorHandle: 'emollick', likes: 5 },
            scores: { personalRelevance: 0, momentum: 0, novelty: 0, relevance: 0, urgency: 0 },
          },
        ],
      }),
    );

    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: join(operatorHome, '.hermes', 'home'),
        HERMES_HOME: join(operatorHome, '.hermes'),
        USER: 'christ',
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      forceRescore: true,
      watchdogFn: async () => ({ action: 'skipped-already-pushed', exitCode: 0 }),
      collectFn: async () => {
        throw new Error('collect should not run when artifact rescore succeeds');
      },
    });

    assert.equal(result.action, 'completion-force-rescore-push');
    const updated = JSON.parse(await readFile(join(hermesDir, 'digest-push-2026-06-11.json'), 'utf8'));
    const emollick = updated.signals.find((row) => row.sourceMetadata?.authorHandle === 'emollick');
    assert.ok(emollick);
    assert.ok((emollick.scores?.personalRelevance ?? 0) >= 20);
  });

  it('persists errors_by_source on zero-signals runs when adapters fail', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-no-signals-'));
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
      },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'skipped-no-artifact', exitCode: 0 }),
      collectFn: async () => ({
        trends: { success: false, error: 'timeout' },
        twitter: { success: false, error: 'invalid-json' },
      }),
    });

    assert.equal(result.action, 'completion-no-signals');
    const artifactPath = join(operatorHome, '.hermes', 'digest-push-2026-06-11.json');
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    assert.deepEqual(artifact.run.errors_by_source, {
      google_trends: 'timeout',
      twitter: 'invalid-json',
    });
    assert.ok(
      artifact.run.sourceOutcomes.some(
        (row) => row.sourceKey === 'google_trends' && row.status === 'error',
      ),
    );
    const logRaw = await readFile(
      join(operatorHome, '.hermes', 'logs', 'push-digest-watchdog.log'),
      'utf8',
    );
    assert.match(logRaw, /action=completion-no-signals/);
    assert.match(logRaw, /google_trends/);
  });
});
