import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import { buildDigestPushPayload } from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import {
  REDDIT_USER_AGENT,
  absoluteRedditUrl,
  buildRedditPublicTopUrl,
  dedupePostsByUrl,
  fetchRedditPublicTop,
  isRedditEnabled,
  loadRedditConfig,
  mapRedditAtomItem,
  mapRedditAtomToPosts,
  parseSubreddits,
  runRedditFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs';
import {
  clamp,
  normalizeEngagement,
  scoreDigestSignals,
  scoreMomentum,
  trendProxyForSignal,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs',
);
const TREND_PROXY_REDDIT = 42;

/** Minimal Atom feed shaped like Reddit …/top/.rss (no score/num_comments). */
const FIXTURE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>top scoring links in MachineLearning</title>
  <entry>
    <author><name>/u/Kooky-Ad-4124</name></author>
    <id>t3_1v38k1m</id>
    <link href="https://www.reddit.com/r/MachineLearning/comments/1v38k1m/skewadam/"/>
    <updated>2026-07-22T07:04:40+00:00</updated>
    <title>SkewAdam: MoE optimizer [R]</title>
    <content type="html">discussion of mixture-of-experts training</content>
  </entry>
  <entry>
    <author><name>/u/Due_Highlight_9341</name></author>
    <id>t3_1v2xktw</id>
    <link href="https://www.reddit.com/r/MachineLearning/comments/1v2xktw/snake_ai/"/>
    <updated>2026-07-21T22:33:50+00:00</updated>
    <title>Looking for feedback on Snake AI [P]</title>
  </entry>
  <entry>
    <author><name>/u/GuestCheap9405</name></author>
    <id>t3_1v3enzq</id>
    <link href="https://www.reddit.com/r/MachineLearning/comments/1v3enzq/openreview/"/>
    <updated>2026-07-22T12:25:54+00:00</updated>
    <title>Happy openreview refresh day [D]</title>
  </entry>
  <entry>
    <author><name>/u/dup</name></author>
    <id>t3_dup</id>
    <link href="https://www.reddit.com/r/MachineLearning/comments/1v38k1m/skewadam/"/>
    <updated>2026-07-22T08:00:00+00:00</updated>
    <title>Duplicate URL post</title>
  </entry>
</feed>`;

describe('fetch-reddit-signals.mjs Atom mapping', () => {
  it('maps Atom entry fields and omits upvotes/commentCount', () => {
    const mapped = mapRedditAtomItem({
      title: 'SkewAdam: MoE optimizer [R]',
      link: 'https://www.reddit.com/r/MachineLearning/comments/1v38k1m/skewadam/',
      id: 't3_1v38k1m',
      isoDate: '2026-07-22T07:04:40.000Z',
      creator: '/u/Kooky-Ad-4124',
    });
    assert.deepEqual(mapped, {
      title: 'SkewAdam: MoE optimizer [R]',
      url: 'https://www.reddit.com/r/MachineLearning/comments/1v38k1m/skewadam/',
      publishedAt: '2026-07-22T07:04:40.000Z',
      author: '/u/Kooky-Ad-4124',
      externalId: 't3_1v38k1m',
    });
    assert.equal(Object.hasOwn(mapped, 'upvotes'), false);
    assert.equal(Object.hasOwn(mapped, 'commentCount'), false);
  });

  it('absoluteRedditUrl prefixes relative permalinks', () => {
    assert.equal(
      absoluteRedditUrl('/r/MachineLearning/comments/abc/example/'),
      'https://www.reddit.com/r/MachineLearning/comments/abc/example/',
    );
    assert.equal(
      absoluteRedditUrl('https://www.reddit.com/r/test/comments/1/'),
      'https://www.reddit.com/r/test/comments/1/',
    );
  });

  it('mapRedditAtomToPosts caps at per-subreddit limit', async () => {
    const Parser = (await import('rss-parser')).default;
    const feed = await new Parser().parseString(FIXTURE_ATOM);
    const posts = mapRedditAtomToPosts(feed, 2);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].title, 'SkewAdam: MoE optimizer [R]');
    assert.equal(posts[1].title, 'Looking for feedback on Snake AI [P]');
  });

  it('dedupePostsByUrl keeps first occurrence and respects maxPosts', async () => {
    const Parser = (await import('rss-parser')).default;
    const feed = await new Parser().parseString(FIXTURE_ATOM);
    const posts = mapRedditAtomToPosts(feed, 10);
    const deduped = dedupePostsByUrl(posts, 5);
    assert.equal(deduped.length, 3);
    assert.equal(
      deduped[0].url,
      'https://www.reddit.com/r/MachineLearning/comments/1v38k1m/skewadam/',
    );
  });
});

describe('fetch-reddit-signals.mjs buildRedditPublicTopUrl', () => {
  it('builds top/.rss URL with t=day', () => {
    const url = buildRedditPublicTopUrl('MachineLearning');
    assert.equal(url, 'https://www.reddit.com/r/MachineLearning/top/.rss?t=day');
  });
});

describe('fetch-reddit-signals.mjs fetchRedditPublicTop', () => {
  it('sends User-Agent header and no Authorization on public fetch', async () => {
    /** @type {RequestInit | undefined} */
    let capturedInit;
    /** @type {string | undefined} */
    let capturedUrl;
    const mockFetch = async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        async text() {
          return FIXTURE_ATOM;
        },
      };
    };

    const result = await fetchRedditPublicTop('MachineLearning', 3, mockFetch);

    assert.deepEqual(result.ok, true);
    assert.equal(capturedUrl, 'https://www.reddit.com/r/MachineLearning/top/.rss?t=day');
    const headers = /** @type {Record<string, string>} */ (capturedInit?.headers);
    assert.equal(headers['User-Agent'], REDDIT_USER_AGENT);
    assert.equal(headers.Authorization, undefined);
    assert.match(String(headers.Accept ?? ''), /atom\+xml/);
  });

  it('uses fixtureXml without network', async () => {
    const result = await fetchRedditPublicTop(
      'MachineLearning',
      3,
      async () => {
        throw new Error('should not fetch');
      },
      FIXTURE_ATOM,
    );
    assert.equal(result.ok, true);
    assert.equal(result.posts.length, 3);
  });
});

describe('fetch-reddit-signals.mjs runRedditFetch', () => {
  const baseEnv = {
    MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning',
  };

  it('returns posts from Atom fixture without credentials or upvotes', async () => {
    const payload = await runRedditFetch(baseEnv, {
      fixtureXml: FIXTURE_ATOM,
      paceMs: 0,
    });
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts.length, 3);
    for (const post of payload.posts) {
      assert.equal(Object.hasOwn(post, 'upvotes'), false);
      assert.equal(Object.hasOwn(post, 'commentCount'), false);
      assert.equal(post.upvotes, undefined);
    }
  });

  it('paces between subreddits (~2s default; injectable)', async () => {
    /** @type {number[]} */
    const sleeps = [];
    const payload = await runRedditFetch(
      {
        MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning,LocalLLaMA',
        MORNING_DIGEST_REDDIT_MAX_POSTS: '10',
      },
      {
        fixtureXmlBySubreddit: {
          MachineLearning: FIXTURE_ATOM,
          LocalLLaMA: FIXTURE_ATOM,
        },
        paceMs: 2000,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );
    assert.ok(payload.posts);
    assert.deepEqual(sleeps, [2000]);
  });

  it('returns reddit disabled when enabled flag is false', async () => {
    const payload = await runRedditFetch({
      ...baseEnv,
      MORNING_DIGEST_REDDIT_ENABLED: 'false',
    });
    assert.deepEqual(payload, { error: 'reddit disabled' });
  });

  it('returns missing-subreddits when enabled but subreddits unset', async () => {
    const payload = await runRedditFetch({});
    assert.deepEqual(payload, { error: 'missing-subreddits' });
  });

  it('dedupes across multiple subreddits', async () => {
    const payload = await runRedditFetch(
      {
        ...baseEnv,
        MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning,LocalLLaMA',
        MORNING_DIGEST_REDDIT_MAX_POSTS: '5',
        MORNING_DIGEST_REDDIT_PER_SUBREDDIT: '3',
      },
      {
        fixtureXmlBySubreddit: {
          MachineLearning: FIXTURE_ATOM,
          LocalLLaMA: FIXTURE_ATOM,
        },
        paceMs: 0,
      },
    );
    assert.equal(payload.posts?.length, 3);
  });

  it('returns error JSON on public fetch failure', async () => {
    const failingFetch = async () => ({ ok: false, status: 429 });
    const payload = await runRedditFetch(baseEnv, { fetch: failingFetch, paceMs: 0 });
    assert.deepEqual(payload, { error: 'http-429' });
  });

  it('skips a 429 subreddit and returns posts from successful siblings', async () => {
    const payload = await runRedditFetch(
      {
        MORNING_DIGEST_REDDIT_SUBREDDITS: 'Blocked,MachineLearning',
        MORNING_DIGEST_REDDIT_MAX_POSTS: '5',
        MORNING_DIGEST_REDDIT_PER_SUBREDDIT: '3',
      },
      {
        fixtureXmlBySubreddit: {
          MachineLearning: FIXTURE_ATOM,
        },
        fetch: async () => ({ ok: false, status: 429 }),
        paceMs: 0,
      },
    );
    assert.equal(payload.error, undefined);
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts?.length, 3);
  });

  it('stops the subreddit loop before pace would exceed adapter budget', async () => {
    let t = 0;
    /** @type {number[]} */
    const sleeps = [];
    const payload = await runRedditFetch(
      {
        MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning,LocalLLaMA,artificial',
        MORNING_DIGEST_REDDIT_MAX_POSTS: '10',
        MORNING_DIGEST_REDDIT_PER_SUBREDDIT: '3',
      },
      {
        fixtureXmlBySubreddit: {
          MachineLearning: FIXTURE_ATOM,
          LocalLLaMA: FIXTURE_ATOM,
          artificial: FIXTURE_ATOM,
        },
        paceMs: 10_000,
        budgetMs: 5_000,
        nowMs: () => t,
        sleep: async (ms) => {
          sleeps.push(ms);
          t += ms;
        },
      },
    );
    assert.deepEqual(sleeps, []);
    assert.equal(payload.posts?.length, 3);
  });

  it('returns http-403 on forbidden response', async () => {
    const failingFetch = async () => ({ ok: false, status: 403 });
    const payload = await runRedditFetch(baseEnv, { fetch: failingFetch, paceMs: 0 });
    assert.deepEqual(payload, { error: 'http-403' });
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_REDDIT_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'reddit disabled' });
  });

  it('CLI exits 0 with missing-subreddits when subreddits unset', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_REDDIT_SUBREDDITS: '',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'missing-subreddits' });
  });
});

describe('RSS reddit → build → score Path B survival (Story 90-1)', () => {
  it('RSS posts carry no upvotes key; scored payload rankScore>0 via no-engagement path', async () => {
    const adapter = await runRedditFetch(
      { MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning' },
      { fixtureXml: FIXTURE_ATOM, paceMs: 0 },
    );
    assert.ok(Array.isArray(adapter.posts) && adapter.posts.length === 3);
    for (const post of adapter.posts) {
      assert.equal('upvotes' in post, false);
      assert.equal(post.upvotes, undefined);
    }

    const built = buildDigestPushPayload({
      date: '2026-07-22',
      ranAt: '2026-07-22T14:00:00.000Z',
      reddit: { posts: adapter.posts },
    });
    assert.equal(built.signals.length, 3);
    for (const signal of built.signals) {
      assert.equal(signal.sourceType, 'reddit');
      assert.equal(signal.sourceMetadata?.upvotes, undefined);
      assert.equal(Object.hasOwn(signal.sourceMetadata ?? {}, 'upvotes'), false);
      assert.equal(normalizeEngagement(signal), null);
    }

    const ctx = {
      domainTokens: ['moe', 'optimizer', 'gpu', 'openreview', 'snake'],
      personalTokens: [],
      epicNumericTokens: [],
      noveltyHistoryEntries: [],
      runAt: Date.parse('2026-07-22T14:00:00Z'),
      watchlistMissing: false,
    };
    const scored = scoreDigestSignals(built.signals, ctx);
    assert.equal(scored.length, 3);
    for (const row of scored) {
      assert.equal(row.normalizedEngagement, undefined);
      assert.equal(row.scores.momentum, 42);
      assert.ok(Number.isFinite(row.rankScore) && row.rankScore > 0);
      assert.notEqual(row.disposition, 'ignore');
    }
  });

  it('anti-regression: upvotes:0 is Path A poison, not the RSS contract', () => {
    const poisoned = {
      section: 'reddit',
      sourceType: 'reddit',
      title: 'Poisoned zero upvotes',
      url: 'https://www.reddit.com/r/test/comments/x/',
      rank: 1,
      sourceMetadata: { upvotes: 0, commentCount: 0 },
    };
    const norm = normalizeEngagement(poisoned);
    assert.notEqual(norm, null);
    assert.ok(norm !== null && norm < 20);

    const rssShaped = {
      section: 'reddit',
      sourceType: 'reddit',
      title: 'RSS omit upvotes',
      url: 'https://www.reddit.com/r/test/comments/y/',
      rank: 1,
      sourceMetadata: { publishedAt: '2026-07-22T12:00:00.000Z' },
    };
    assert.equal(normalizeEngagement(rssShaped), null);
    const ctx = {
      domainTokens: [],
      personalTokens: [],
      epicNumericTokens: [],
      noveltyHistoryEntries: [],
      runAt: Date.parse('2026-07-22T14:00:00Z'),
      watchlistMissing: false,
    };
    const scored = scoreDigestSignals([rssShaped], ctx);
    assert.equal(scored[0].scores.momentum, TREND_PROXY_REDDIT);
  });

  it('finite upvotes still take Path A (deferred Firecrawl enrich)', () => {
    const signal = {
      section: 'reddit',
      sourceType: 'reddit',
      title: 'Enriched post',
      url: 'https://www.reddit.com/r/test/comments/1/x/',
      rank: 1,
      sourceMetadata: { upvotes: 500, commentCount: 50 },
    };
    const norm = normalizeEngagement(signal);
    assert.ok(norm !== null && norm >= 0 && norm <= 100);

    const ctx = {
      domainTokens: [],
      personalTokens: [],
      epicNumericTokens: [],
      noveltyHistoryEntries: [],
      runAt: Date.parse('2026-06-09T12:00:00Z'),
      watchlistMissing: false,
    };
    const scored = scoreDigestSignals([signal], ctx);
    assert.equal(scored.length, 1);
    assert.equal(scored[0].normalizedEngagement, norm);
    assert.ok(scored[0].scores.momentum > 0);

    const momentum = scoreMomentum(signal, norm, ctx);
    assert.equal(
      momentum,
      clamp(Math.round(0.75 * norm + 0.25 * trendProxyForSignal(signal)), 0, 100),
    );
  });
});

describe('loadRedditConfig', () => {
  it('defaults maxPosts and perSubreddit when unset or invalid', () => {
    const config = loadRedditConfig({
      MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning, LocalLLaMA',
    });
    assert.equal(config.maxPosts, 5);
    assert.equal(config.perSubreddit, 3);
    assert.deepEqual(config.subreddits, ['MachineLearning', 'LocalLLaMA']);
  });

  it('isRedditEnabled treats empty as enabled', () => {
    assert.equal(isRedditEnabled(undefined), true);
    assert.equal(isRedditEnabled('false'), false);
    assert.equal(isRedditEnabled('off'), false);
  });

  it('parseSubreddits trims, drops empty segments, and strips r/ prefix', () => {
    assert.deepEqual(parseSubreddits(' MachineLearning , , LocalLLaMA '), [
      'MachineLearning',
      'LocalLLaMA',
    ]);
    assert.deepEqual(parseSubreddits('r/MachineLearning, LocalLLaMA ,r/artificial'), [
      'MachineLearning',
      'LocalLLaMA',
      'artificial',
    ]);
    assert.deepEqual(parseSubreddits('R/bar, baz'), ['bar', 'baz']);
  });

  it('parseSubreddits dedupes case-insensitively', () => {
    assert.deepEqual(parseSubreddits('MachineLearning, r/machinelearning ,LocalLLaMA'), [
      'MachineLearning',
      'LocalLLaMA',
    ]);
  });

  it('mapRedditAtomItem accepts link objects with href', () => {
    const mapped = mapRedditAtomItem({
      title: 'Object link post',
      link: { href: '/r/MachineLearning/comments/xyz/object_link/' },
      id: 't3_xyz',
    });
    assert.equal(
      mapped?.url,
      'https://www.reddit.com/r/MachineLearning/comments/xyz/object_link/',
    );
  });
});
