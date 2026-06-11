import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  formatSydneyDate,
  parseAdapterStdout,
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
  });
});
