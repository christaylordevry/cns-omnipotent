import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  buildErrorsBySource,
  formatSydneyDate,
  isAdapterErrorPayload,
  parseAdapterStdout,
  parseCompletionCliArgs,
  runDigestConvexCompletion,
  summarizeAdapterCollection,
  unwrapAdapterResult,
} from '../scripts/run-digest-convex-completion.mjs';
import { resolveDayOutcomeFilePath } from '../scripts/lib/digest-run-outcome.mjs';

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

  it('classifies YouTube exit-0 quota JSON as adapter error (Epic 70/71 collect path)', () => {
    const stdout = JSON.stringify({ error: 'quota-exceeded' });
    const parsed = parseAdapterStdout(stdout);
    assert.ok(parsed && typeof parsed === 'object');
    assert.equal(isAdapterErrorPayload(parsed), true);

    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:quota-exceeded',
    });
    assert.deepEqual(buildErrorsBySource({ youtube: wrapped }), {
      youtube: 'adapter-error:quota-exceeded',
    });
  });

  it('does not classify YouTube success stdout as adapter error', () => {
    const parsed = parseAdapterStdout(
      JSON.stringify({
        videos: [{ title: 'Demo', url: 'https://www.youtube.com/watch?v=abc' }],
      }),
    );
    assert.equal(isAdapterErrorPayload(parsed), false);
  });

  it('classifies TikTok exit-0 credit-exhausted JSON as adapter error (Story 72-3)', () => {
    const stdout = JSON.stringify({ error: 'credit-exhausted' });
    const parsed = parseAdapterStdout(stdout);
    assert.ok(parsed && typeof parsed === 'object');
    assert.equal(isAdapterErrorPayload(parsed), true);

    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:credit-exhausted',
    });
    assert.deepEqual(buildErrorsBySource({ tiktok: wrapped }), {
      tiktok: 'adapter-error:credit-exhausted',
    });
  });

  it('classifies Instagram exit-0 missing-api-key JSON as adapter error (Story 72-3)', () => {
    const stdout = JSON.stringify({ error: 'missing-api-key' });
    const parsed = parseAdapterStdout(stdout);
    assert.ok(parsed && typeof parsed === 'object');
    assert.equal(isAdapterErrorPayload(parsed), true);

    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:missing-api-key',
    });
    assert.deepEqual(buildErrorsBySource({ instagram: wrapped }), {
      instagram: 'adapter-error:missing-api-key',
    });
  });

  it('classifies Pinterest exit-0 missing-api-key JSON as adapter error (Story 72-5)', () => {
    const stdout = JSON.stringify({ error: 'missing-api-key' });
    const parsed = parseAdapterStdout(stdout);
    assert.ok(parsed && typeof parsed === 'object');
    assert.equal(isAdapterErrorPayload(parsed), true);

    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:missing-api-key',
    });
    assert.deepEqual(buildErrorsBySource({ pinterest: wrapped }), {
      pinterest: 'adapter-error:missing-api-key',
    });
  });

  it('does not classify TikTok/Instagram/Pinterest success stdout as adapter error (Story 72-3/72-5)', () => {
    assert.equal(
      isAdapterErrorPayload(
        parseAdapterStdout(
          JSON.stringify({
            videos: [{ title: 'TT', url: 'https://www.tiktok.com/@a/video/1' }],
          }),
        ),
      ),
      false,
    );
    assert.equal(
      isAdapterErrorPayload(
        parseAdapterStdout(
          JSON.stringify({
            reels: [{ title: 'IG', url: 'https://www.instagram.com/reel/ABC/' }],
          }),
        ),
      ),
      false,
    );
    assert.equal(
      isAdapterErrorPayload(
        parseAdapterStdout(
          JSON.stringify({
            pins: [{ title: 'PI', url: 'https://www.pinterest.com/pin/123/' }],
          }),
        ),
      ),
      false,
    );
  });

  it('classifies Polymarket exit-0 missing-watchlist JSON as adapter error (Story 72-6)', () => {
    const stdout = JSON.stringify({ error: 'missing-watchlist' });
    const parsed = parseAdapterStdout(stdout);
    assert.ok(parsed && typeof parsed === 'object');
    assert.equal(isAdapterErrorPayload(parsed), true);

    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:missing-watchlist',
    });
    assert.deepEqual(buildErrorsBySource({ polymarket: wrapped }), {
      polymarket: 'adapter-error:missing-watchlist',
    });
  });

  it('classifies Polymarket exit-0 http-429 JSON as adapter error (Story 72-6)', () => {
    const stdout = JSON.stringify({ error: 'http-429' });
    const parsed = parseAdapterStdout(stdout);
    assert.equal(isAdapterErrorPayload(parsed), true);
    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:http-429',
    });
  });

  it('classifies Threads exit-0 missing-handles JSON as adapter error (Story 72-7)', () => {
    const stdout = JSON.stringify({ error: 'missing-handles' });
    const parsed = parseAdapterStdout(stdout);
    assert.ok(parsed && typeof parsed === 'object');
    assert.equal(isAdapterErrorPayload(parsed), true);

    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:missing-handles',
    });
    assert.deepEqual(buildErrorsBySource({ threads: wrapped }), {
      threads: 'adapter-error:missing-handles',
    });
  });

  it('classifies Threads exit-0 credit-exhausted JSON as adapter error (Story 72-7)', () => {
    const stdout = JSON.stringify({ error: 'credit-exhausted' });
    const parsed = parseAdapterStdout(stdout);
    assert.equal(isAdapterErrorPayload(parsed), true);
    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:credit-exhausted',
    });
    assert.deepEqual(buildErrorsBySource({ threads: wrapped }), {
      threads: 'adapter-error:credit-exhausted',
    });
  });

  it('does not classify Threads success stdout as adapter error (Story 72-7)', () => {
    assert.equal(
      isAdapterErrorPayload(
        parseAdapterStdout(
          JSON.stringify({
            posts: [
              {
                title: 'Threads post',
                url: 'https://www.threads.com/@karpathy/post/ABC123',
                authorHandle: 'karpathy',
              },
            ],
          }),
        ),
      ),
      false,
    );
  });

  it('classifies LinkedIn exit-0 missing-watchlist JSON as adapter error (Story 72-8)', () => {
    const stdout = JSON.stringify({ error: 'missing-watchlist' });
    const parsed = parseAdapterStdout(stdout);
    assert.equal(isAdapterErrorPayload(parsed), true);
    const wrapped = isAdapterErrorPayload(parsed)
      ? { success: false, error: `adapter-error:${String(/** @type {{ error?: unknown }} */ (parsed).error)}` }
      : { success: true, data: parsed };
    assert.deepEqual(wrapped, {
      success: false,
      error: 'adapter-error:missing-watchlist',
    });
    assert.deepEqual(buildErrorsBySource({ linkedin: wrapped }), {
      linkedin: 'adapter-error:missing-watchlist',
    });
  });

  it('does not classify LinkedIn success stdout as adapter error (Story 72-8)', () => {
    assert.equal(
      isAdapterErrorPayload(
        parseAdapterStdout(
          JSON.stringify({
            posts: [
              {
                title: 'LinkedIn post',
                url: 'https://www.linkedin.com/posts/openai_test-activity-7473441251686752257-cfCj',
                authorHandle: 'openai',
              },
            ],
          }),
        ),
      ),
      false,
    );
  });

  it('does not classify Polymarket success stdout as adapter error (Story 72-6)', () => {
    assert.equal(
      isAdapterErrorPayload(
        parseAdapterStdout(
          JSON.stringify({
            markets: [
              {
                question: 'PM market',
                url: 'https://polymarket.com/market/pm-one',
              },
            ],
          }),
        ),
      ),
      false,
    );
  });

  it('parseCompletionCliArgs detects --force-rescore', () => {
    assert.equal(parseCompletionCliArgs(['--force-rescore']).forceRescore, true);
    assert.equal(parseCompletionCliArgs([]).forceRescore, false);
  });

  it('delegates to watchdog when artifact replay succeeds', async () => {
    let analyzeCalled = false;
    const pushedPayload = {
      run: { digestRunId: 'digestRuns:recovered', date: '2026-06-11', ranAt: 100 },
      signals: [
        {
          digestRunId: 'digestRuns:recovered',
          digestSignalId: 'digestSignals:recovered',
          section: 'twitter',
          sourceType: 'twitter',
          title: 'Recovered signal',
          rank: 1,
        },
      ],
    };
    const result = await runDigestConvexCompletion({
      env: { CRON_TZ: 'Australia/Sydney', HOME: join(tmpdir(), 'completion-watchdog') },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({
        action: 'recovered-push',
        exitCode: 0,
        pushResult: {
          ok: true,
          runId: 'digestRuns:recovered',
          signalsWritten: 1,
          pushedPayload,
        },
      }),
      analyzeFn: async (payload) => {
        analyzeCalled = true;
        assert.equal(payload.run.digestRunId, 'digestRuns:recovered');
        return { status: 'ok', mentionsWritten: 1, reason: null };
      },
      collectFn: async () => {
        throw new Error('collect should not run');
      },
    });
    assert.equal(result.action, 'recovered-push');
    assert.equal(analyzeCalled, true);
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
      pushFn: async (payload) => ({
        ok: true,
        signalsWritten: payload.signals.filter((s) => s && typeof s === 'object').length,
      }),
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
      pushFn: async (payload, _env, pushOptions) => {
        assert.equal(pushOptions.forceRescore, true);
        return {
          ok: true,
          signalsWritten: payload.signals.filter((s) => s && typeof s === 'object').length,
        };
      },
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

  it('force-rescore full path preserves IDs and orders push then analyze then Discord', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-force-rescore-order-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: {
          digestRunId: 'digestRuns:existing-run',
          date: '2026-06-11',
          ranAt: 1_749_657_600_000,
          status: 'published',
        },
        signals: [
          {
            digestRunId: 'digestRuns:existing-run',
            digestSignalId: 'digestSignals:existing-signal',
            section: 'twitter',
            sourceType: 'twitter',
            title: 'Existing signal',
            url: 'https://x.com/karpathy/status/1',
            rank: 1,
            rankScore: 70,
            sourceMetadata: { authorHandle: 'karpathy' },
            scores: {
              personalRelevance: 80,
              momentum: 20,
              novelty: 20,
              relevance: 80,
              urgency: 20,
            },
          },
        ],
      }),
    );

    const order = [];
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
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.path === 'entityIntelligence:getEntityIntelligence') {
          order.push('entity-fetch');
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 'success',
              value: { trackedInMotion: [], emergingToReview: [] },
            }),
        };
      },
      pushFn: async (payload) => {
        order.push('push');
        assert.equal(payload.run.digestRunId, 'digestRuns:existing-run');
        assert.equal(payload.signals[0].digestSignalId, 'digestSignals:existing-signal');
        return {
          ok: true,
          runId: 'digestRuns:existing-run',
          signalsWritten: 1,
          pushedPayload: payload,
        };
      },
      analyzeFn: async (payload) => {
        order.push('analyze');
        assert.equal(payload.run.digestRunId, 'digestRuns:existing-run');
        assert.equal(payload.signals[0].digestSignalId, 'digestSignals:existing-signal');
        return { status: 'ok', mentionsWritten: 1, reason: null };
      },
      postDigestFn: async (payload) => {
        order.push('discord');
        assert.equal(typeof payload.entityDigestMarkdown, 'undefined');
        return { ok: true, messageIds: ['discord-1'], error: null };
      },
      writeOutcomeFn: async () => {},
    });

    assert.equal(result.action, 'completion-force-rescore-push');
    assert.deepEqual(order, ['push', 'analyze', 'entity-fetch', 'discord']);
    const persisted = JSON.parse(
      await readFile(join(hermesDir, 'digest-push-2026-06-11.json'), 'utf8'),
    );
    assert.equal(persisted.run.digestRunId, 'digestRuns:existing-run');
    assert.equal(persisted.signals[0].digestSignalId, 'digestSignals:existing-signal');
  });

  it('entity digest markdown attached to Discord payload when query returns lanes (Story 73-7)', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-entity-digest-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: {
          digestRunId: 'digestRuns:entity-run',
          date: '2026-06-11',
          ranAt: 1_749_657_600_000,
        },
        signals: [
          {
            digestRunId: 'digestRuns:entity-run',
            digestSignalId: 'digestSignals:entity-signal',
            sourceType: 'twitter',
            title: 'Signal',
            rank: 1,
          },
        ],
        digestMarkdown: '## Morning digest\n- headline',
      }),
    );

    /** @type {Record<string, unknown> | null} */
    let discordPayload = null;
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
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.path !== 'entityIntelligence:getEntityIntelligence') {
          throw new Error(`unexpected query path: ${body.path}`);
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 'success',
              value: {
                trackedInMotion: [
                  {
                    entityType: 'person',
                    displayName: 'Ethan Mollick',
                    momentumSummary: '14 mentions / 7d vs 3.2/wk baseline (≈4.1×)',
                    reasons: [
                      { code: 'acceleration', detail: '≈4.1×' },
                      { code: 'cross_source', detail: 'Present across 3 sources: twitter, linkedin' },
                    ],
                  },
                ],
                emergingToReview: [],
              },
            }),
        };
      },
      pushFn: async (payload) => ({
        ok: true,
        runId: payload.run.digestRunId,
        signalsWritten: 1,
        pushedPayload: payload,
      }),
      analyzeFn: async () => ({ status: 'ok', mentionsWritten: 1, reason: null }),
      postDigestFn: async (payload) => {
        discordPayload = payload;
        return { ok: true, messageIds: ['discord-entity'], error: null };
      },
      writeOutcomeFn: async () => {},
    });

    assert.equal(result.action, 'completion-force-rescore-push');
    assert.ok(discordPayload);
    assert.match(String(discordPayload.entityDigestMarkdown), /Ethan Mollick/);
    assert.match(String(discordPayload.entityDigestMarkdown), /Tracked entities accelerating now/);
  });

  it('force-rescore applies people bonus when HOME is Hermes profile-isolated', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-hermes-home-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(join(hermesDir, 'logs'), { recursive: true });
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
      pushFn: async (payload) => ({
        ok: true,
        signalsWritten: payload.signals.filter((s) => s && typeof s === 'object').length,
      }),
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

  it('logs completion-convex-push-failed and skips Discord when push fails', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-convex-fail-'));
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
      }),
      pushFn: async () => ({
        ok: false,
        signalsWritten: 0,
        error: 'Convex HTTP 500: mutation failed',
      }),
    });

    assert.equal(result.action, 'completion-convex-push-failed');
    const logRaw = await readFile(
      join(operatorHome, '.hermes', 'logs', 'push-digest-watchdog.log'),
      'utf8',
    );
    assert.match(logRaw, /action=completion-convex-push-failed/);
    assert.doesNotMatch(logRaw, /action=discord-post-ok/);
    assert.doesNotMatch(logRaw, /action=completion-backfill-push/);
  });

  it('treats partial Convex push as failure and skips Discord', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-convex-partial-'));
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
      }),
      pushFn: async () => ({
        ok: true,
        signalsWritten: 1,
        error: null,
      }),
    });

    assert.equal(result.action, 'completion-convex-push-failed');
    const logRaw = await readFile(
      join(operatorHome, '.hermes', 'logs', 'push-digest-watchdog.log'),
      'utf8',
    );
    assert.match(logRaw, /action=completion-convex-push-failed/);
    assert.doesNotMatch(logRaw, /action=completion-backfill-push/);
  });

  it('bucket 2: mutation push failure retries full pipeline even when artifact exists', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-bucket2-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(join(hermesDir, 'logs'), { recursive: true });
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: { date: '2026-06-11' },
        signals: [{ title: 'Stale', sourceType: 'hackernews', section: 'HackerNews' }],
      }),
    );
    await writeFile(
      join(hermesDir, 'logs', 'push-digest-watchdog.log'),
      `2026-06-11T01:00:00.000Z action=completion-convex-push-failed date=2026-06-11 exit=0 detail=${JSON.stringify({ error: 'Convex HTTP 500', signalsWritten: 0 })}\n`,
    );

    let collectCalled = false;
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
      pushFn: async (payload) => ({
        ok: true,
        signalsWritten: payload.signals.filter((s) => s && typeof s === 'object').length,
      }),
      collectFn: async () => {
        collectCalled = true;
        return {
          trends: { success: true, data: { events: [{ keyword: 'AI agents', normalizedValue: 0.5 }] } },
          twitter: {
            success: true,
            data: { posts: [{ title: 'Tweet', url: 'https://x.com/a/status/1' }] },
          },
        };
      },
    });

    assert.equal(collectCalled, true);
    assert.equal(result.action, 'completion-backfill-push');
  });

  it('bucket 3: push-only artifact enforces push, analyze, entity-fetch, Discord order', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-bucket3-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(join(hermesDir, 'logs'), { recursive: true });
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: { date: '2026-06-11', ranAt: 1_749_657_600_000 },
        signals: [
          { title: 'Cached', sourceType: 'hackernews', section: 'HackerNews' },
          { title: 'Cached 2', sourceType: 'twitter', section: 'Twitter/X' },
        ],
      }),
    );
    await writeFile(
      join(hermesDir, 'logs', 'push-digest-watchdog.log'),
      `2026-06-11T01:00:00.000Z action=completion-convex-push-failed date=2026-06-11 exit=0 detail=${JSON.stringify({ error: 'missing-convex-env', signalsWritten: 0 })}\n`,
    );

    let collectCalled = false;
    let pushCalled = false;
    const order = [];
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'deferred-push-only-artifact', exitCode: 0 }),
      collectFn: async () => {
        collectCalled = true;
        throw new Error('collect should not run for bucket 3');
      },
      pushFn: async (payload) => {
        pushCalled = true;
        order.push('push');
        const pushedPayload = {
          run: { ...payload.run, digestRunId: 'digestRuns:push-only' },
          signals: payload.signals.map((signal, index) => ({
            ...signal,
            digestRunId: 'digestRuns:push-only',
            digestSignalId: `digestSignals:push-only-${index}`,
          })),
        };
        return {
          ok: true,
          signalsWritten: payload.signals.filter((s) => s && typeof s === 'object').length,
          pushedPayload,
        };
      },
      analyzeFn: async () => {
        order.push('analyze');
        return { status: 'ok', mentionsWritten: 2, reason: null };
      },
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.path === 'entityIntelligence:getEntityIntelligence') {
          order.push('entity-fetch');
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 'success',
              value: { trackedInMotion: [], emergingToReview: [] },
            }),
        };
      },
      postDigestFn: async () => {
        order.push('discord');
        return { ok: true, messageIds: ['push-only-discord'], error: null };
      },
      writeOutcomeFn: async () => {},
    });

    assert.equal(collectCalled, false);
    assert.equal(pushCalled, true);
    assert.deepEqual(order, ['push', 'analyze', 'entity-fetch', 'discord']);
    assert.equal(result.action, 'completion-backfill-push');
    const logRaw = await readFile(join(hermesDir, 'logs', 'push-digest-watchdog.log'), 'utf8');
    assert.match(logRaw, /action=push-only-artifact-recovery/);
    assert.match(logRaw, /action=completion-backfill-push/);
  });

  it('records entity-fetch failure in the structured day outcome', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-entity-fetch-fail-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: {
          digestRunId: 'digestRuns:fetch-fail',
          date: '2026-06-11',
          ranAt: 1_749_657_600_000,
        },
        signals: [
          {
            digestRunId: 'digestRuns:fetch-fail',
            digestSignalId: 'digestSignals:fetch-fail',
            title: 'Cached',
            sourceType: 'hackernews',
            section: 'HackerNews',
          },
        ],
      }),
    );

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
      pushFn: async (payload) => ({
        ok: true,
        runId: payload.run.digestRunId,
        signalsWritten: 1,
        pushedPayload: payload,
      }),
      analyzeFn: async () => ({ status: 'ok', mentionsWritten: 1, reason: null }),
      fetchFn: async () => ({
        ok: false,
        status: 503,
        text: async () => 'entity query unavailable',
      }),
      postDigestFn: async () => ({ ok: true, messageIds: ['fetch-fail-discord'], error: null }),
    });

    assert.equal(result.action, 'completion-force-rescore-push');
    const outcome = JSON.parse(
      await readFile(resolveDayOutcomeFilePath(operatorHome, '2026-06-11'), 'utf8'),
    );
    assert.equal(outcome.entity.status, 'failed');
    assert.match(outcome.entity.error, /^digest-fetch:Convex HTTP 503/);
    assert.equal(outcome.overall, 'partial');
  });

  it('bucket 3 without artifact falls through to full pipeline collect', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-bucket3-no-artifact-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(join(hermesDir, 'logs'), { recursive: true });
    await writeFile(
      join(hermesDir, 'logs', 'push-digest-watchdog.log'),
      `2026-06-11T01:00:00.000Z action=completion-convex-push-failed date=2026-06-11 exit=0 detail=${JSON.stringify({ error: 'missing-convex-env', signalsWritten: 0 })}\n`,
    );

    let collectCalled = false;
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'deferred-push-only-artifact', exitCode: 0 }),
      pushFn: async (payload) => ({
        ok: true,
        signalsWritten: payload.signals.filter((s) => s && typeof s === 'object').length,
      }),
      collectFn: async () => {
        collectCalled = true;
        return {
          trends: { success: true, data: { events: [{ keyword: 'AI agents', normalizedValue: 0.5 }] } },
          twitter: {
            success: true,
            data: { posts: [{ title: 'Tweet', url: 'https://x.com/a/status/1' }] },
          },
        };
      },
    });

    assert.equal(collectCalled, true);
    assert.equal(result.action, 'completion-backfill-push');
  });

  it('writes outcome record on completion-convex-push-failed branch', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-outcome-fail-'));
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        DIGEST_TRIGGER: 'cron',
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-13',
      watchdogFn: async () => ({ action: 'skipped-no-artifact', exitCode: 0 }),
      collectFn: async () => ({
        trends: { success: true, data: { events: [{ keyword: 'AI agents', normalizedValue: 0.5 }] } },
        twitter: {
          success: true,
          data: { posts: [{ title: 'Tweet', url: 'https://x.com/a/status/1' }] },
        },
      }),
      pushFn: async () => ({
        ok: false,
        signalsWritten: 0,
        error: 'Convex HTTP 500: mutation failed',
      }),
      fetchFn: async () => ({
        ok: true,
        json: async () => ({ status: 'success', value: [] }),
        text: async () => JSON.stringify({ status: 'success', value: [] }),
      }),
    });

    assert.equal(result.action, 'completion-convex-push-failed');
    const outcomePath = resolveDayOutcomeFilePath(operatorHome, '2026-06-13');
    const outcome = JSON.parse(await readFile(outcomePath, 'utf8'));
    assert.equal(outcome.lastInvocation.action, 'completion-convex-push-failed');
    assert.equal(outcome.history.at(-1).action, 'completion-convex-push-failed');
    assert.equal(outcome.history.at(-1).trigger, 'cron');
    assert.equal(outcome.overall, 'failed');
    assert.equal(outcome.convex.ok, false);
    assert.equal(outcome.inProgress, null);
  });
});

describe('Story 71-4 discord-only repair from day outcome record', () => {
  it('artifact present + postDigest ok → no collect, no push, discord-only-repair-ok, overall success', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-discord-only-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(join(hermesDir, 'logs'), { recursive: true });
    await mkdir(join(hermesDir, 'digest-outcomes'), { recursive: true });
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: {
          digestRunId: 'digestRuns:discord-only',
          date: '2026-06-11',
          ranAt: 1_749_657_600_000,
        },
        signals: [
          {
            digestRunId: 'digestRuns:discord-only',
            digestSignalId: 'digestSignals:discord-only',
            title: 'Cached',
            sourceType: 'hackernews',
            section: 'HackerNews',
          },
        ],
      }),
    );
    await writeFile(
      resolveDayOutcomeFilePath(operatorHome, '2026-06-11'),
      JSON.stringify({
        date: '2026-06-11',
        convex: { ok: true },
        discord: { ok: false },
        overall: 'partial',
        inProgress: null,
        history: [],
      }),
    );

    let collectCalled = false;
    let pushCalled = false;
    const order = [];
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'deferred-discord-only-repair', exitCode: 0 }),
      collectFn: async () => {
        collectCalled = true;
        throw new Error('collect should not run for bucket 4');
      },
      pushFn: async () => {
        pushCalled = true;
        return { ok: true, signalsWritten: 1 };
      },
      analyzeFn: async () => {
        order.push('analyze');
        return { status: 'ok', mentionsWritten: 1, reason: null };
      },
      postDigestFn: async () => {
        order.push('discord');
        return { ok: true, messageIds: ['msg-1'], error: null };
      },
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.path === 'entityIntelligence:getEntityIntelligence') {
          order.push('entity-fetch');
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                status: 'success',
                value: { trackedInMotion: [], emergingToReview: [] },
              }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            value: [{ date: '2026-06-11', status: 'published' }],
          }),
          text: async () =>
            JSON.stringify({
              status: 'success',
              value: [{ date: '2026-06-11', status: 'published' }],
            }),
        };
      },
    });

    assert.equal(collectCalled, false);
    assert.equal(pushCalled, false);
    assert.deepEqual(order, ['analyze', 'entity-fetch', 'discord']);
    assert.equal(result.action, 'discord-only-repair-ok');
    const logRaw = await readFile(join(hermesDir, 'logs', 'push-digest-watchdog.log'), 'utf8');
    assert.match(logRaw, /action=discord-only-repair-ok/);
    const outcome = JSON.parse(await readFile(resolveDayOutcomeFilePath(operatorHome, '2026-06-11'), 'utf8'));
    assert.equal(outcome.discord.ok, true);
    assert.equal(outcome.convex.ok, true);
    assert.equal(outcome.overall, 'success');
    assert.deepEqual(outcome.history.at(-1).warnings, []);
    assert.equal(outcome.history.at(-1).convex.ok, true);
    assert.equal(outcome.history.at(-1).overall, 'success');
  });

  it('postDigest fails → discord-only-repair-failed, overall stays partial', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-discord-fail-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(join(hermesDir, 'logs'), { recursive: true });
    await mkdir(join(hermesDir, 'digest-outcomes'), { recursive: true });
    await writeFile(
      join(hermesDir, 'digest-push-2026-06-11.json'),
      JSON.stringify({
        run: {
          digestRunId: 'digestRuns:discord-fail',
          date: '2026-06-11',
          ranAt: 1_749_657_600_000,
        },
        signals: [
          {
            digestRunId: 'digestRuns:discord-fail',
            digestSignalId: 'digestSignals:discord-fail',
            title: 'Cached',
            sourceType: 'hackernews',
            section: 'HackerNews',
          },
        ],
      }),
    );
    await writeFile(
      resolveDayOutcomeFilePath(operatorHome, '2026-06-11'),
      JSON.stringify({
        date: '2026-06-11',
        convex: { ok: true },
        discord: { ok: false },
        overall: 'partial',
        inProgress: null,
        history: [],
      }),
    );

    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'deferred-discord-only-repair', exitCode: 0 }),
      analyzeFn: async () => ({ status: 'ok', mentionsWritten: 1, reason: null }),
      postDigestFn: async () => ({ ok: false, messageIds: [], error: 'discord-rate-limit' }),
      fetchFn: async () => ({
        ok: true,
        json: async () => ({ status: 'success', value: [] }),
        text: async () => JSON.stringify({ status: 'success', value: [] }),
      }),
    });

    assert.equal(result.action, 'discord-only-repair-failed');
    const outcome = JSON.parse(await readFile(resolveDayOutcomeFilePath(operatorHome, '2026-06-11'), 'utf8'));
    assert.equal(outcome.discord.ok, false);
    assert.equal(outcome.overall, 'partial');
    assert.equal(outcome.history.at(-1).action, 'discord-only-repair-failed');
    assert.deepEqual(outcome.history.at(-1).warnings, []);
    assert.equal(outcome.history.at(-1).convex.ok, true);
    assert.equal(outcome.history.at(-1).overall, 'partial');
  });

  it('missing artifact → discord-only-repair-skipped-no-artifact, no collect, overall partial', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'completion-discord-no-artifact-'));
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(join(hermesDir, 'logs'), { recursive: true });
    await mkdir(join(hermesDir, 'digest-outcomes'), { recursive: true });
    await writeFile(
      resolveDayOutcomeFilePath(operatorHome, '2026-06-11'),
      JSON.stringify({
        date: '2026-06-11',
        convex: { ok: true },
        discord: { ok: false },
        overall: 'partial',
        inProgress: null,
        history: [],
      }),
    );

    let collectCalled = false;
    const result = await runDigestConvexCompletion({
      env: {
        CRON_TZ: 'Australia/Sydney',
        HOME: operatorHome,
        CNS_OPERATOR_HOME: operatorHome,
        CONVEX_URL: 'https://test.convex.cloud',
        CONVEX_DEPLOY_KEY: 'deploy-key-test',
      },
      todayDate: '2026-06-11',
      watchdogFn: async () => ({ action: 'deferred-discord-only-repair', exitCode: 0 }),
      collectFn: async () => {
        collectCalled = true;
        throw new Error('collect should not run when artifact missing');
      },
      fetchFn: async () => ({
        ok: true,
        json: async () => ({ status: 'success', value: [] }),
        text: async () => JSON.stringify({ status: 'success', value: [] }),
      }),
    });

    assert.equal(collectCalled, false);
    assert.equal(result.action, 'discord-only-repair-skipped-no-artifact');
    const outcome = JSON.parse(await readFile(resolveDayOutcomeFilePath(operatorHome, '2026-06-11'), 'utf8'));
    assert.equal(outcome.discord.ok, false);
    assert.equal(outcome.overall, 'partial');
  });
});
