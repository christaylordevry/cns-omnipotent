import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  REPLACE_ENTITY_MENTIONS_PATH,
  runAnalyzeEntityIntelligence,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/analyze-entity-intelligence.mjs';
import {
  buildPushedScoredPayload,
  persistPushedPayloadArtifact,
  pushDigestToConvex,
  runPushCliEntityStage,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';
import {
  CANONICAL_ENTITY_MENTION_RUN,
  CANONICAL_FIXTURE_SIGNALS,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/build-entity-mention-payload.mjs';
import { assertEntityMentionRowViaDashboard } from '../scripts/lib/entity-mention-validator-bridge.mjs';
import { invokePostPushEntityStage } from '../scripts/run-digest-convex-completion.mjs';

function mockResponse(status, body = '{}') {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

describe('analyze-entity-intelligence.mjs (Story 73-4)', () => {
  it('happy path: clear then record in order with validator-safe mentions', async () => {
    /** @type {Array<{ path: string; args: Record<string, unknown> }>} */
    const calls = [];
    const scoredPayload = {
      run: CANONICAL_ENTITY_MENTION_RUN,
      signals: CANONICAL_FIXTURE_SIGNALS,
    };

    await runAnalyzeEntityIntelligence(scoredPayload, {
      CONVEX_URL: 'https://test.convex.cloud',
      CONVEX_DEPLOY_KEY: 'deploy-key-test',
    }, {
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        calls.push({ path: body.path, args: body.args });
        return mockResponse(200, JSON.stringify({ status: 'success', value: { inserted: 1 } }));
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, REPLACE_ENTITY_MENTIONS_PATH);
    assert.equal(calls[0].args.digestRunId, CANONICAL_ENTITY_MENTION_RUN.digestRunId);
    assert.ok(Array.isArray(calls[0].args.mentions));
    assert.ok(/** @type {unknown[]} */ (calls[0].args.mentions).length > 0);
    for (const mention of /** @type {Array<Record<string, unknown>>} */ (calls[0].args.mentions)) {
      assertEntityMentionRowViaDashboard(mention);
    }
  });

  it('empty mentions: transactionally replaces with an empty set', async () => {
    const calls = [];
    const result = await runAnalyzeEntityIntelligence(
      {
        run: CANONICAL_ENTITY_MENTION_RUN,
        signals: [
          {
            digestSignalId: 'digestSignals:empty-meta',
            sourceType: 'google_trends',
            title: 'Trend only',
            rankScore: 10,
            sourceMetadata: {},
          },
        ],
      },
      { CONVEX_URL: 'https://test.convex.cloud', CONVEX_DEPLOY_KEY: 'key' },
      {
        fetchFn: async (_url, init) => {
          calls.push(JSON.parse(String(init?.body)));
          return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
        },
      },
    );
    assert.equal(result.status, 'ok');
    assert.equal(result.mentionsWritten, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, REPLACE_ENTITY_MENTIONS_PATH);
    assert.deepEqual(calls[0].args, {
      digestRunId: CANONICAL_ENTITY_MENTION_RUN.digestRunId,
      mentions: [],
    });
  });

  it('mutation failure: stderr logged, no throw', async () => {
    const stderrChunks = [];
    const originalStderr = console.error;
    console.error = (...args) => {
      stderrChunks.push(args.join(' '));
    };

    try {
      const result = await runAnalyzeEntityIntelligence(
        {
          run: CANONICAL_ENTITY_MENTION_RUN,
          signals: CANONICAL_FIXTURE_SIGNALS,
        },
        { CONVEX_URL: 'https://test.convex.cloud', CONVEX_DEPLOY_KEY: 'key' },
        {
          fetchFn: async () => mockResponse(500, 'server error'),
        },
      );
      assert.equal(result.status, 'failed');
    } finally {
      console.error = originalStderr;
    }

    assert.ok(stderrChunks.some((line) => line.includes('analyze-entity-intelligence: warning')));
  });

  it('re-run: replacement is called on every invocation for the same IDs', async () => {
    /** @type {string[]} */
    const paths = [];
    for (let invocation = 0; invocation < 2; invocation += 1) {
      await runAnalyzeEntityIntelligence(
        {
          run: CANONICAL_ENTITY_MENTION_RUN,
          signals: CANONICAL_FIXTURE_SIGNALS,
        },
        { CONVEX_URL: 'https://test.convex.cloud', CONVEX_DEPLOY_KEY: 'key' },
        {
          fetchFn: async (_url, init) => {
            const body = JSON.parse(String(init?.body));
            paths.push(body.path);
            return mockResponse(200, JSON.stringify({ status: 'success', value: { inserted: 3 } }));
          },
        },
      );
    }

    assert.deepEqual(paths, [REPLACE_ENTITY_MENTIONS_PATH, REPLACE_ENTITY_MENTIONS_PATH]);
  });

  it('pushDigestToConvex preserves digestSignalId on pushedPayload', async () => {
    let signalSeq = 0;
    const payload = {
      run: {
        date: '2026-06-11',
        ranAt: 1_749_657_600_000,
        focusKeyword: 'AI',
      },
      signals: [
        {
          sourceType: 'twitter',
          title: 'Tweet',
          url: 'https://x.com/a/status/1',
          sourceMetadata: { authorHandle: 'karpathy' },
        },
        {
          sourceType: 'github',
          title: 'llama.cpp',
          url: 'https://github.com/ggml-org/llama.cpp',
          sourceMetadata: { stars: 1000 },
        },
      ],
    };

    const result = await pushDigestToConvex({
      env: {
        DIGEST_PUSH_JSON: JSON.stringify(payload),
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'key',
      },
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.path === 'digest:createDigestRun') {
          return mockResponse(200, JSON.stringify({ status: 'success', value: 'digestRuns:run-1' }));
        }
        if (body.path === 'digest:addDigestSignal') {
          signalSeq += 1;
          return mockResponse(
            200,
            JSON.stringify({ status: 'success', value: `digestSignals:sig-${signalSeq}` }),
          );
        }
        return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
      },
    });

    assert.equal(result.ok, true);
    assert.ok(result.pushedPayload);
    assert.equal(result.pushedPayload.run.digestRunId, 'digestRuns:run-1');
    assert.equal(result.pushedPayload.signals.length, 2);
    assert.equal(result.pushedPayload.signals[0].digestSignalId, 'digestSignals:sig-1');
    assert.equal(result.pushedPayload.signals[1].digestSignalId, 'digestSignals:sig-2');
  });

  it('pushDigestToConvex force-rescore patches the same run and signal IDs', async () => {
    const calls = [];
    const payload = {
      run: {
        digestRunId: 'digestRuns:existing-run',
        date: '2026-06-11',
        ranAt: 1_749_657_600_000,
        focusKeyword: 'AI',
      },
      signals: [
        {
          digestRunId: 'digestRuns:existing-run',
          digestSignalId: 'digestSignals:existing-signal',
          section: 'twitter',
          sourceType: 'twitter',
          title: 'Existing signal',
          rank: 1,
          rankScore: 88,
        },
      ],
    };

    const result = await pushDigestToConvex({
      env: {
        DIGEST_PUSH_JSON: JSON.stringify(payload),
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'key',
      },
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        calls.push(body);
        return mockResponse(
          200,
          JSON.stringify({ status: 'success', value: { signalsUpdated: 1 } }),
        );
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.runId, 'digestRuns:existing-run');
    assert.equal(result.pushedPayload.run.digestRunId, 'digestRuns:existing-run');
    assert.equal(
      result.pushedPayload.signals[0].digestSignalId,
      'digestSignals:existing-signal',
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, 'digest:rescoreDigestRun');
    assert.equal(calls[0].args.id, 'digestRuns:existing-run');
    assert.equal(calls[0].args.signals[0].digestSignalId, 'digestSignals:existing-signal');
    assert.equal('digestSignalId' in calls[0].args.signals[0].signal, false);
    assert.equal('digestRunId' in calls[0].args.run, false);
  });

  it('pushDigestToConvex rejects partial rescore identity instead of creating duplicates', async () => {
    let fetchCalled = false;
    const result = await pushDigestToConvex({
      env: {
        DIGEST_PUSH_JSON: JSON.stringify({
          run: { digestRunId: 'digestRuns:existing-run', date: '2026-06-11', ranAt: 100 },
          signals: [{ section: 'twitter', sourceType: 'twitter', title: 'Missing ID', rank: 1 }],
        }),
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'key',
      },
      fetchFn: async () => {
        fetchCalled = true;
        return mockResponse(200);
      },
    });

    assert.equal(result.ok, false);
    assert.equal(fetchCalled, false);
    assert.match(result.error, /requires digestRunId and digestSignalId/);
  });

  it('pushDigestToConvex aborts a hung in-process push at the configured timeout', async () => {
    const result = await pushDigestToConvex({
      env: {
        DIGEST_PUSH_JSON: JSON.stringify({
          run: { date: '2026-06-11', ranAt: 100 },
          signals: [{ section: 'twitter', sourceType: 'twitter', title: 'Signal', rank: 1 }],
        }),
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'key',
      },
      timeoutMs: 5,
      fetchFn: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        }),
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /timed out|timeout/i);
  });

  it('pushDigestToConvex rejects whitespace mutation IDs', async () => {
    const result = await pushDigestToConvex({
      env: {
        DIGEST_PUSH_JSON: JSON.stringify({
          run: { date: '2026-06-11', ranAt: 100 },
          signals: [{ section: 'twitter', sourceType: 'twitter', title: 'Signal', rank: 1 }],
        }),
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'key',
      },
      fetchFn: async () =>
        mockResponse(200, JSON.stringify({ status: 'success', value: '   ' })),
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /createDigestRun did not return an id/);
  });

  it('buildPushedScoredPayload shapes run metadata for entity stage', () => {
    const shaped = buildPushedScoredPayload(
      { date: '2026-06-11', ranAt: 100, workspaceId: 'ws-1' },
      'digestRuns:abc',
      [{ digestSignalId: 'digestSignals:1' }],
    );
    assert.deepEqual(shaped.run, {
      digestRunId: 'digestRuns:abc',
      ranAt: 100,
      date: '2026-06-11',
      workspaceId: 'ws-1',
    });
    assert.equal(shaped.signals.length, 1);
  });

  it('persists the ID-bearing pushed payload as the canonical recovery artifact', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'pushed-payload-artifact-'));
    const pushedPayload = buildPushedScoredPayload(
      { date: '2026-06-11', ranAt: 100, focusKeyword: 'AI' },
      'digestRuns:existing',
      [
        {
          digestRunId: 'digestRuns:existing',
          digestSignalId: 'digestSignals:existing',
          sourceType: 'twitter',
          title: 'Existing signal',
        },
      ],
    );
    const path = await persistPushedPayloadArtifact(pushedPayload, {
      HOME: operatorHome,
      CNS_OPERATOR_HOME: operatorHome,
    });
    const stored = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(stored.run.digestRunId, 'digestRuns:existing');
    assert.equal(stored.signals[0].digestSignalId, 'digestSignals:existing');
  });

  it('direct push CLI runs artifact persistence then entity analysis with pushed IDs', async () => {
    const order = [];
    const pushedPayload = buildPushedScoredPayload(
      { date: '2026-06-11', ranAt: 100 },
      'digestRuns:direct',
      [{ digestSignalId: 'digestSignals:direct', sourceType: 'twitter', title: 'Signal' }],
    );
    const entityResult = await runPushCliEntityStage(
      { ok: true, pushedPayload },
      {},
      {
        persistFn: async (payload) => {
          order.push('persist');
          assert.equal(payload.run.digestRunId, 'digestRuns:direct');
        },
        analyzeFn: async (payload) => {
          order.push('analyze');
          assert.equal(payload.signals[0].digestSignalId, 'digestSignals:direct');
          return { status: 'ok', mentionsWritten: 1, reason: null };
        },
      },
    );
    assert.deepEqual(order, ['persist', 'analyze']);
    assert.equal(entityResult.status, 'ok');
  });
});

describe('run-digest-convex-completion entity stage wiring (Story 73-4)', () => {
  it('invokePostPushEntityStage runs analyze after push before discord would', async () => {
    /** @type {string[]} */
    const order = [];
    const result = await invokePostPushEntityStage({
      pushResult: {
        ok: true,
        pushedPayload: {
          run: CANONICAL_ENTITY_MENTION_RUN,
          signals: CANONICAL_FIXTURE_SIGNALS,
        },
      },
      env: { CONVEX_URL: 'https://test.convex.cloud', CONVEX_DEPLOY_KEY: 'key' },
      analyzeFn: async () => {
        order.push('analyze');
      },
    });
    assert.deepEqual(order, ['analyze']);
    assert.equal(result.status, 'ok');
  });

  it('invokePostPushEntityStage skips when pushedPayload missing', async () => {
    let called = false;
    const result = await invokePostPushEntityStage({
      pushResult: { ok: true, pushedPayload: null },
      env: {},
      analyzeFn: async () => {
        called = true;
      },
    });
    assert.equal(called, false);
    assert.deepEqual(result, {
      status: 'failed',
      mentionsWritten: 0,
      reason: 'missing-pushed-payload',
    });
  });

  it('invokePostPushEntityStage contains unexpected analyzer rejection', async () => {
    const result = await invokePostPushEntityStage({
      pushResult: {
        ok: true,
        pushedPayload: {
          run: CANONICAL_ENTITY_MENTION_RUN,
          signals: CANONICAL_FIXTURE_SIGNALS,
        },
      },
      env: {},
      analyzeFn: async () => {
        throw new Error('unexpected analyzer bug');
      },
    });
    assert.equal(result.status, 'failed');
    assert.match(result.reason, /unexpected analyzer bug/);
  });
});
