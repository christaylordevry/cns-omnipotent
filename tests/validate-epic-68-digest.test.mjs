import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  countBySourceType,
  countScored,
  evaluateEpic68Checks,
  findDedupClusters,
  findDuplicateUrlClusters,
  formatChecklistTable,
  hasPeopleBoostEvidence,
  parseCliArgs,
  pickLatestDigestRunId,
} from '../scripts/validate-epic-68-digest.mjs';

/**
 * @param {number} n
 * @param {Partial<Record<string, unknown>>} overrides
 * @returns {Record<string, unknown>}
 */
function makeSignal(n, overrides = {}) {
  return {
    sourceType: 'newsapi',
    title: `Signal ${n}`,
    url: `https://example.com/story-${n}`,
    rankScore: 0.5 + n * 0.001,
    rank: n,
    ...overrides,
  };
}

/**
 * @param {number} count
 * @returns {Array<Record<string, unknown>>}
 */
function makeScoredBatch(count) {
  return Array.from({ length: count }, (_, i) => makeSignal(i + 1));
}

describe('Story 68-8 validate-epic-68-digest', () => {
  it('countBySourceType tallies sourceType values', () => {
    const counts = countBySourceType([
      { sourceType: 'github' },
      { sourceType: 'rss' },
      { sourceType: 'github' },
      { sourceType: 'bluesky' },
    ]);
    assert.deepEqual(counts, { github: 2, rss: 1, bluesky: 1 });
  });

  it('countScored reports scored ratio', () => {
    const result = countScored([
      { rankScore: 1 },
      { rankScore: 2 },
      { rank: 3 },
    ]);
    assert.equal(result.scored, 2);
    assert.equal(result.total, 3);
    assert.ok(Math.abs(result.unscoredRatio - 1 / 3) < 0.001);
  });

  it('findDedupClusters finds contributingSources clusters', () => {
    const clusters = findDedupClusters([
      {
        sourceMetadata: {
          contributingSources: [{ sourceType: 'hackernews' }, { sourceType: 'newsapi' }],
          dedupClusterSize: 2,
        },
      },
      { sourceMetadata: { contributingSources: [{ sourceType: 'rss' }] } },
    ]);
    assert.equal(clusters.length, 1);
  });

  it('findDuplicateUrlClusters detects repeated normalized URLs', () => {
    const leaks = findDuplicateUrlClusters([
      { title: 'Same story', url: 'https://www.example.com/a?utm_source=x' },
      { title: 'Same story', url: 'https://example.com/a/' },
    ]);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].count, 2);
  });

  it('hasPeopleBoostEvidence detects elevated personalRelevance with authorHandle', () => {
    assert.equal(
      hasPeopleBoostEvidence([
        {
          scores: { personalRelevance: 45 },
          sourceMetadata: { authorHandle: '@alice' },
        },
      ]),
      true,
    );
    assert.equal(
      hasPeopleBoostEvidence([
        {
          scores: { personalRelevance: 10 },
          sourceMetadata: { authorHandle: '@alice' },
        },
      ]),
      false,
    );
    assert.equal(
      hasPeopleBoostEvidence([
        {
          scores: { personalRelevance: 20 },
          sourceMetadata: { authorHandle: '@alice' },
        },
      ]),
      true,
      'handle-only boost at threshold should pass C6',
    );
    assert.equal(
      hasPeopleBoostEvidence([
        {
          scores: { personalRelevance: 19 },
          sourceMetadata: { authorHandle: '@alice' },
        },
      ]),
      false,
      'score below threshold should not pass C6',
    );
  });

  it('evaluateEpic68Checks passes full fixture with X GO and people waiver', () => {
    const signals = [
      ...makeScoredBatch(30),
      {
        sourceType: 'bluesky',
        title: 'Bsky post',
        url: 'https://bsky.app/profile/alice/post/1',
        rankScore: 0.7,
        sourceMetadata: { likes: 12, reposts: 3 },
      },
      {
        sourceType: 'twitter',
        title: 'Tweet',
        url: 'https://x.com/alice/status/1',
        rankScore: 0.65,
        sourceMetadata: { likes: 8 },
      },
      {
        sourceType: 'github',
        title: 'Repo',
        url: 'https://github.com/org/repo',
        rankScore: 0.6,
      },
      {
        sourceType: 'rss',
        title: 'Feed item',
        url: 'https://blog.example.com/post',
        rankScore: 0.55,
      },
      {
        sourceType: 'producthunt',
        title: 'Launch',
        url: 'https://www.producthunt.com/posts/launch',
        rankScore: 0.5,
      },
      {
        sourceType: 'newsapi',
        title: 'Merged cluster',
        url: 'https://news.example.com/story',
        rankScore: 0.8,
        sourceMetadata: {
          contributingSources: [
            { sourceType: 'hackernews', url: 'https://news.ycombinator.com/item?id=1' },
            { sourceType: 'newsapi', url: 'https://news.example.com/story' },
          ],
          dedupClusterSize: 2,
        },
      },
    ];

    const result = evaluateEpic68Checks(signals, { xStatus: 'go', peopleStoriesDone: false });
    assert.equal(result.overall, 'pass');
    assert.equal(result.checks.find((c) => c.id === 'C3')?.status, 'pass');
    assert.equal(result.checks.find((c) => c.id === 'C6')?.status, 'waived');
    assert.equal(result.checks.find((c) => c.id === 'C4')?.status, 'pass');
    assert.equal(result.checks.find((c) => c.id === 'C8')?.status, 'pass');
  });

  it('evaluateEpic68Checks waives twitter row on X NO-GO', () => {
    const signals = [
      ...makeScoredBatch(30),
      {
        sourceType: 'bluesky',
        title: 'Bsky',
        url: 'https://bsky.app/profile/alice/post/2',
        rankScore: 0.7,
        sourceMetadata: { likes: 1 },
      },
      {
        sourceType: 'github',
        title: 'Repo',
        url: 'https://github.com/org/repo2',
        rankScore: 0.6,
      },
      {
        sourceType: 'rss',
        title: 'Feed',
        url: 'https://blog.example.com/post2',
        rankScore: 0.55,
      },
      {
        sourceType: 'producthunt',
        title: 'PH',
        url: 'https://www.producthunt.com/posts/ph2',
        rankScore: 0.5,
      },
      {
        sourceType: 'newsapi',
        title: 'Cluster',
        url: 'https://news.example.com/cluster',
        rankScore: 0.8,
        sourceMetadata: {
          contributingSources: [{ sourceType: 'rss' }, { sourceType: 'newsapi' }],
          dedupClusterSize: 2,
        },
      },
    ];

    const result = evaluateEpic68Checks(signals, { xStatus: 'no-go', peopleStoriesDone: false });
    assert.equal(result.checks.find((c) => c.id === 'C3')?.status, 'waived');
    assert.equal(result.overall, 'pass');
  });

  it('evaluateEpic68Checks fails when mandatory rows missing', () => {
    const signals = makeScoredBatch(10);
    const result = evaluateEpic68Checks(signals, { xStatus: 'no-go', peopleStoriesDone: false });
    assert.equal(result.overall, 'fail');
    assert.equal(result.checks.find((c) => c.id === 'C1')?.status, 'fail');
    assert.equal(result.checks.find((c) => c.id === 'C2')?.status, 'fail');
  });

  it('evaluateEpic68Checks fails C5 on duplicate URL leak', () => {
    const signals = [
      ...makeScoredBatch(30),
      {
        sourceType: 'bluesky',
        title: 'Bsky',
        url: 'https://bsky.app/profile/alice/post/3',
        rankScore: 0.7,
        sourceMetadata: { likes: 2 },
      },
      {
        sourceType: 'github',
        title: 'Repo',
        url: 'https://github.com/org/repo3',
        rankScore: 0.6,
      },
      {
        sourceType: 'rss',
        title: 'Feed',
        url: 'https://blog.example.com/post3',
        rankScore: 0.55,
      },
      {
        sourceType: 'producthunt',
        title: 'PH',
        url: 'https://www.producthunt.com/posts/ph3',
        rankScore: 0.5,
      },
      {
        sourceType: 'newsapi',
        title: 'Cluster A',
        url: 'https://news.example.com/dup',
        rankScore: 0.8,
        sourceMetadata: {
          contributingSources: [{ sourceType: 'rss' }, { sourceType: 'newsapi' }],
          dedupClusterSize: 2,
        },
      },
      {
        sourceType: 'hackernews',
        title: 'Cluster B',
        url: 'https://news.example.com/dup/',
        rankScore: 0.75,
      },
    ];

    const result = evaluateEpic68Checks(signals, { xStatus: 'no-go', peopleStoriesDone: false });
    assert.equal(result.checks.find((c) => c.id === 'C5')?.status, 'fail');
    assert.equal(result.overall, 'fail');
  });

  it('evaluateEpic68Checks requires people boost when 68-2/68-3 done', () => {
    const signals = [
      ...makeScoredBatch(30),
      {
        sourceType: 'bluesky',
        title: 'Bsky',
        url: 'https://bsky.app/profile/alice/post/4',
        rankScore: 0.7,
        sourceMetadata: { likes: 2 },
      },
      {
        sourceType: 'github',
        title: 'Repo',
        url: 'https://github.com/org/repo4',
        rankScore: 0.6,
      },
      {
        sourceType: 'rss',
        title: 'Feed',
        url: 'https://blog.example.com/post4',
        rankScore: 0.55,
      },
      {
        sourceType: 'producthunt',
        title: 'PH',
        url: 'https://www.producthunt.com/posts/ph4',
        rankScore: 0.5,
      },
      {
        sourceType: 'newsapi',
        title: 'Cluster',
        url: 'https://news.example.com/cluster4',
        rankScore: 0.8,
        sourceMetadata: {
          contributingSources: [{ sourceType: 'rss' }, { sourceType: 'newsapi' }],
          dedupClusterSize: 2,
        },
      },
    ];

    const result = evaluateEpic68Checks(signals, { xStatus: 'no-go', peopleStoriesDone: true });
    assert.equal(result.checks.find((c) => c.id === 'C6')?.status, 'fail');
  });

  it('pickLatestDigestRunId skips failed runs', () => {
    const id = pickLatestDigestRunId([
      { _id: 'run_failed', status: 'failed' },
      { _id: 'run_ok', status: 'published' },
    ]);
    assert.equal(id, 'run_ok');
  });

  it('parseCliArgs parses flags', () => {
    const parsed = parseCliArgs(['--latest', '--json', '--x-no-go', '--people-done']);
    assert.equal(parsed.latest, true);
    assert.equal(parsed.json, true);
    assert.equal(parsed.xStatus, 'no-go');
    assert.equal(parsed.peopleDone, true);
  });

  it('parseCliArgs rejects both --x-go and --x-no-go regardless of order', () => {
    assert.throws(
      () => parseCliArgs(['--latest', '--x-go', '--x-no-go']),
      /Use only one of --x-go or --x-no-go/,
    );
    assert.throws(
      () => parseCliArgs(['--latest', '--x-no-go', '--x-go']),
      /Use only one of --x-go or --x-no-go/,
    );
  });

  it('evaluateEpic68Checks exposes manualChecksPending for C7 and C11', () => {
    const result = evaluateEpic68Checks(makeScoredBatch(10), {
      xStatus: 'no-go',
      peopleStoriesDone: false,
    });
    assert.deepEqual(result.manualChecksPending, ['C7', 'C11']);
  });

  it('formatChecklistTable renders human-readable rows', () => {
    const table = formatChecklistTable([
      { id: 'C1', label: 'Signal count', status: 'pass', detail: 'ok' },
      { id: 'C7', label: 'Discord merged attribution', status: 'manual', detail: 'operator' },
    ]);
    assert.match(table, /C1\s+PASS/);
    assert.match(table, /C7\s+MANUAL\s+Discord merged attribution/);
    assert.match(table, /Signal count/);
  });
});
