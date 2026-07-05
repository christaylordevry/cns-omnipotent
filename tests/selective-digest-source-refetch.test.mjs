import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  detectFailedPrimaryTrendSources,
  mergeSelectiveRefetchIntoPayload,
  SELECTIVE_REFETCH_ADAPTER_KEYS,
  trySelectiveSourceRefetch,
} from '../scripts/lib/selective-digest-source-refetch.mjs';
import { formatWatchdogLogLine } from '../scripts/push-digest-watchdog.mjs';

describe('selective-digest-source-refetch (Story 81-2 AC2)', () => {
  it('excludes reddit from selective refetch adapter keys', () => {
    assert.deepEqual(SELECTIVE_REFETCH_ADAPTER_KEYS, ['trends', 'newsapi']);
    assert.ok(!SELECTIVE_REFETCH_ADAPTER_KEYS.includes('reddit'));
  });

  it('detectFailedPrimaryTrendSources flags missing trends and newsapi when other signals exist', () => {
    const payload = {
      run: { ranAt: 1_749_657_600_000, topTrend: '' },
      signals: [
        { sourceType: 'hackernews', title: 'HN story' },
        { sourceType: 'reddit', title: 'Reddit post' },
      ],
    };
    const failed = detectFailedPrimaryTrendSources(payload);
    assert.deepEqual(failed.sort(), ['newsapi', 'trends']);
  });

  it('detectFailedPrimaryTrendSources returns empty when trends and newsapi present', () => {
    const payload = {
      run: { ranAt: 1_749_657_600_000, topTrend: 'ai agents' },
      signals: [
        { sourceType: 'google_trends', title: 'ai agents', normalizedValue: 88 },
        { sourceType: 'newsapi', title: 'Headline one' },
        { sourceType: 'hackernews', title: 'HN story' },
      ],
    };
    assert.deepEqual(detectFailedPrimaryTrendSources(payload), []);
  });

  it('mergeSelectiveRefetchIntoPayload replaces trend/newsapi signals only', () => {
    const payload = {
      run: { ranAt: 1_749_657_600_000, topTrend: '', focusKeyword: '' },
      signals: [
        { sourceType: 'hackernews', title: 'Keep me', id: 'hn-1' },
        { sourceType: 'google_trends', title: 'old trend', id: 'trend-old' },
      ],
    };
    const adapterOutputs = {
      trends: {
        success: true,
        data: {
          events: [{ keyword: 'fresh keyword', normalizedValue: 91 }],
        },
      },
      newsapi: {
        success: true,
        data: {
          headlines: [{ title: 'Fresh headline', url: 'https://example.com/a' }],
        },
      },
    };

    const merged = mergeSelectiveRefetchIntoPayload(payload, adapterOutputs, '2026-07-05');
    const sourceTypes = merged.payload.signals.map((signal) => signal.sourceType);
    assert.ok(sourceTypes.includes('hackernews'));
    assert.ok(sourceTypes.includes('google_trends'));
    assert.ok(sourceTypes.includes('newsapi'));
    assert.equal(merged.payload.run.topTrend, 'fresh keyword');
    assert.deepEqual(merged.refetched, ['trends', 'newsapi']);
    assert.ok(!merged.payload.signals.some((signal) => signal.id === 'trend-old'));
  });

  it('mergeSelectiveRefetchIntoPayload preserves newsapi when only trends refetch succeeds', () => {
    const payload = {
      run: { ranAt: 1_749_657_600_000, topTrend: '', focusKeyword: '' },
      signals: [
        { sourceType: 'hackernews', title: 'Keep me', id: 'hn-1' },
        { sourceType: 'google_trends', title: 'old trend', id: 'trend-old' },
        { sourceType: 'newsapi', title: 'Existing headline', id: 'news-keep' },
      ],
    };
    const adapterOutputs = {
      trends: {
        success: true,
        data: {
          events: [{ keyword: 'fresh keyword', normalizedValue: 91 }],
        },
      },
    };

    const merged = mergeSelectiveRefetchIntoPayload(payload, adapterOutputs, '2026-07-05');
    const sourceTypes = merged.payload.signals.map((signal) => signal.sourceType);
    assert.ok(sourceTypes.includes('hackernews'));
    assert.ok(sourceTypes.includes('google_trends'));
    assert.ok(sourceTypes.includes('newsapi'));
    assert.ok(merged.payload.signals.some((signal) => signal.id === 'news-keep'));
    assert.ok(!merged.payload.signals.some((signal) => signal.id === 'trend-old'));
    assert.equal(merged.payload.run.topTrend, 'fresh keyword');
    assert.deepEqual(merged.refetched, ['trends']);
  });

  it('trySelectiveSourceRefetch skips when selective-source-refetch already logged today', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'digest-refetch-'));
    await mkdir(join(operatorHome, '.hermes', 'logs'), { recursive: true });
    const logPath = join(operatorHome, '.hermes', 'logs', 'push-digest-watchdog.log');
    await writeFile(
      logPath,
      `${formatWatchdogLogLine('selective-source-refetch', { date: '2026-07-05', exit: 0, detail: '{}' })}\n`,
      'utf8',
    );

    const result = await trySelectiveSourceRefetch({
      env: {},
      todayDate: '2026-07-05',
      operatorHome,
      log: async () => {},
      dedupeFn: async (signals) => signals,
      scoreFn: async (signals) => signals,
      writeArtifactFn: async () => {},
    });

    assert.equal(result.action, 'skipped-already-refetched');
    assert.equal(result.patched, false);
  });

  it('trySelectiveSourceRefetch skips when no refetch needed', async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), 'digest-refetch-'));
    await mkdir(join(operatorHome, '.hermes'), { recursive: true });
    await mkdir(join(operatorHome, '.hermes', 'logs'), { recursive: true });

    const payload = {
      run: { date: '2026-07-05', ranAt: 1_749_657_600_000, topTrend: 'ai agents' },
      signals: [
        { sourceType: 'google_trends', title: 'ai agents' },
        { sourceType: 'newsapi', title: 'Headline' },
      ],
    };
    await writeFile(
      join(operatorHome, '.hermes', 'digest-push-2026-07-05.json'),
      JSON.stringify(payload),
      'utf8',
    );

    const result = await trySelectiveSourceRefetch({
      env: {},
      todayDate: '2026-07-05',
      operatorHome,
      log: async () => {},
      dedupeFn: async (signals) => signals,
      scoreFn: async (signals) => signals,
      writeArtifactFn: async () => {},
    });

    assert.equal(result.action, 'skipped-no-refetch-needed');
    assert.equal(result.patched, false);
  });
});
