import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  formatSydneyDate,
  parseAdapterStdout,
  parseCompletionCliArgs,
  runDigestConvexCompletion,
} from '../scripts/run-digest-convex-completion.mjs';

describe('run-digest-convex-completion (Story 68-10)', () => {
  it('formatSydneyDate uses Australia/Sydney by default', () => {
    const value = formatSydneyDate('Australia/Sydney', new Date('2026-06-11T02:00:00Z'));
    assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
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
        trends: { events: [{ keyword: 'AI agents', normalizedValue: 0.5 }] },
        twitter: { posts: [{ title: 'Tweet', url: 'https://x.com/a/status/1' }] },
        bluesky: { posts: [{ title: 'Post', url: 'https://bsky.app/profile/a/post/1' }] },
        producthunt: { launches: [{ title: 'PH', url: 'https://ph.com/1', votesCount: 3 }] },
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
});
