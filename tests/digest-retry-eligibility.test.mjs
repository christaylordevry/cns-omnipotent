import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyDigestRetryBucket,
  findLatestDigestLogEntryForDate,
  MISSING_CONVEX_ENV_ERROR,
  parseCompletionLogDetail,
} from '../scripts/lib/digest-retry-eligibility.mjs';

describe('digest-retry-eligibility (Story 71-1)', () => {
  it('parseCompletionLogDetail parses JSON detail payloads', () => {
    assert.deepEqual(parseCompletionLogDetail('{"error":"Convex HTTP 500","signalsWritten":0}'), {
      error: 'Convex HTTP 500',
      signalsWritten: 0,
    });
  });

  it('findLatestDigestLogEntryForDate returns the latest digest action for today', () => {
    const log = [
      '2026-06-11T00:00:00.000Z action=started date=2026-06-11 exit=0',
      '2026-06-11T01:00:00.000Z action=completion-convex-push-failed date=2026-06-11 exit=0 detail={"error":"missing-convex-env"}',
    ].join('\n');
    assert.deepEqual(findLatestDigestLogEntryForDate(log, '2026-06-11'), {
      action: 'completion-convex-push-failed',
      detail: '{"error":"missing-convex-env"}',
    });
  });

  it('classifyDigestRetryBucket is pure and classifies bucket 1 started runs', () => {
    assert.equal(
      classifyDigestRetryBucket({
        latestLogAction: 'started',
        convexStatus: 'started',
        hasArtifact: false,
      }),
      'full-pipeline',
    );
  });

  it('classifyDigestRetryBucket preserves terminal success logs', () => {
    assert.equal(
      classifyDigestRetryBucket({
        latestLogAction: 'completion-backfill-push',
        convexStatus: 'started',
        hasArtifact: true,
      }),
      'terminal-success',
    );
  });

  it('classifyDigestRetryBucket splits bucket 2 vs bucket 3 push failures', () => {
    assert.equal(
      classifyDigestRetryBucket({
        latestLogAction: 'completion-convex-push-failed',
        detail: JSON.stringify({ error: 'Convex HTTP 500' }),
        hasArtifact: true,
        missingConvexEnvError: MISSING_CONVEX_ENV_ERROR,
      }),
      'full-pipeline',
    );
    assert.equal(
      classifyDigestRetryBucket({
        latestLogAction: 'completion-convex-push-failed',
        detail: JSON.stringify({ error: MISSING_CONVEX_ENV_ERROR }),
        hasArtifact: true,
        missingConvexEnvError: MISSING_CONVEX_ENV_ERROR,
      }),
      'push-only-artifact',
    );
  });

  it('classifyDigestRetryBucket bucket 3 wins over Convex started row', () => {
    assert.equal(
      classifyDigestRetryBucket({
        latestLogAction: 'completion-convex-push-failed',
        detail: JSON.stringify({ error: MISSING_CONVEX_ENV_ERROR }),
        convexStatus: 'started',
        hasArtifact: true,
        missingConvexEnvError: MISSING_CONVEX_ENV_ERROR,
      }),
      'push-only-artifact',
    );
  });

  it('classifyDigestRetryBucket bucket 4: convex ok + discord failed → discord-only-repair', () => {
    const dayOutcome = {
      convex: { ok: true },
      discord: { ok: false },
      inProgress: null,
    };
    assert.equal(
      classifyDigestRetryBucket({
        convexStatus: 'published',
        hasArtifact: true,
        dayOutcome,
      }),
      'discord-only-repair',
    );
  });

  it('classifyDigestRetryBucket bucket 4: discord ok stays terminal-success', () => {
    assert.equal(
      classifyDigestRetryBucket({
        convexStatus: 'published',
        hasArtifact: true,
        dayOutcome: {
          convex: { ok: true },
          discord: { ok: true },
          inProgress: null,
        },
      }),
      'terminal-success',
    );
  });

  it('classifyDigestRetryBucket bucket 4: null dayOutcome stays terminal-success', () => {
    assert.equal(
      classifyDigestRetryBucket({
        convexStatus: 'published',
        hasArtifact: true,
        dayOutcome: null,
      }),
      'terminal-success',
    );
  });

  it('classifyDigestRetryBucket bucket 4: inProgress blocks repair', () => {
    assert.equal(
      classifyDigestRetryBucket({
        convexStatus: 'published',
        hasArtifact: true,
        dayOutcome: {
          convex: { ok: true },
          discord: { ok: false },
          inProgress: { startedAt: 1 },
        },
      }),
      'terminal-success',
    );
  });

  it('findLatestDigestLogEntryForDate recovery chain uses latest terminal not stale failure', () => {
    const log = [
      '2026-06-11T00:00:00.000Z action=started date=2026-06-11 exit=0',
      '2026-06-11T01:00:00.000Z action=completion-convex-push-failed date=2026-06-11 exit=0 detail={"error":"missing-convex-env"}',
      '2026-06-11T02:00:00.000Z action=completion-backfill-push date=2026-06-11 exit=0',
    ].join('\n');
    assert.deepEqual(findLatestDigestLogEntryForDate(log, '2026-06-11'), {
      action: 'completion-backfill-push',
      detail: undefined,
    });
    assert.equal(
      classifyDigestRetryBucket({
        latestLogAction: 'completion-backfill-push',
        convexStatus: 'started',
        hasArtifact: true,
      }),
      'terminal-success',
    );
  });
});
