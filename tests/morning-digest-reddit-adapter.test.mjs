import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  absoluteRedditUrl,
  buildRedditPublicTopUrl,
  dedupePostsByUrl,
  fetchRedditPublicTop,
  isRedditEnabled,
  loadRedditConfig,
  mapRedditListingToPosts,
  mapRedditPostItem,
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

/**
 * Mirrors task-prompt §9 Reddit assembly: nest posts[] engagement under sourceMetadata.
 *
 * @param {{ title: string, url: string, upvotes: number, commentCount?: number, publishedAt?: string }} post
 * @param {number} rank
 */
function redditPostToDigestSignal(post, rank) {
  /** @type {Record<string, unknown>} */
  const sourceMetadata = { upvotes: post.upvotes };
  if (post.commentCount !== undefined) {
    sourceMetadata.commentCount = post.commentCount;
  }
  if (post.publishedAt) {
    sourceMetadata.publishedAt = post.publishedAt;
  }
  return {
    section: 'reddit',
    sourceType: 'reddit',
    title: post.title,
    url: post.url,
    rank,
    sourceMetadata,
  };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs',
);

const FIXTURE_LISTING = {
  data: {
    children: [
      {
        data: {
          title: 'Example ML post',
          score: 420,
          num_comments: 37,
          permalink: '/r/MachineLearning/comments/abc123/example/',
          created_utc: 1717920000,
        },
      },
      {
        data: {
          title: 'Duplicate URL post',
          score: 100,
          num_comments: 5,
          permalink: '/r/MachineLearning/comments/abc123/example/',
          created_utc: 1717920100,
        },
      },
      {
        data: {
          title: 'LocalLLaMA highlight',
          score: 900,
          num_comments: 120,
          permalink: '/r/LocalLLaMA/comments/def456/llm/',
          created_utc: 1717930000,
        },
      },
    ],
  },
};

describe('fetch-reddit-signals.mjs parsing', () => {
  it('maps public JSON listing fields to stdout post shape', () => {
    const mapped = mapRedditPostItem(FIXTURE_LISTING.data.children[0].data);
    assert.deepEqual(mapped, {
      title: 'Example ML post',
      url: 'https://www.reddit.com/r/MachineLearning/comments/abc123/example/',
      upvotes: 420,
      commentCount: 37,
      publishedAt: new Date(1717920000 * 1000).toISOString(),
    });
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

  it('mapRedditListingToPosts caps at per-subreddit limit', () => {
    const posts = mapRedditListingToPosts(FIXTURE_LISTING, 2);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].title, 'Example ML post');
    assert.equal(posts[1].title, 'Duplicate URL post');
  });

  it('dedupePostsByUrl keeps first occurrence and respects maxPosts', () => {
    const posts = mapRedditListingToPosts(FIXTURE_LISTING, 3);
    const deduped = dedupePostsByUrl(posts, 5);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].url, 'https://www.reddit.com/r/MachineLearning/comments/abc123/example/');
  });
});

describe('fetch-reddit-signals.mjs buildRedditPublicTopUrl', () => {
  it('builds top.json URL with t=day, limit=25, and raw_json=1', () => {
    const url = buildRedditPublicTopUrl('MachineLearning');
    assert.equal(
      url,
      'https://www.reddit.com/r/MachineLearning/top.json?t=day&limit=25&raw_json=1',
    );
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
        async json() {
          return FIXTURE_LISTING;
        },
      };
    };

    const result = await fetchRedditPublicTop('MachineLearning', 3, mockFetch);

    assert.deepEqual(result.ok, true);
    assert.equal(
      capturedUrl,
      'https://www.reddit.com/r/MachineLearning/top.json?t=day&limit=25&raw_json=1',
    );
    const headers = /** @type {Record<string, string>} */ (capturedInit?.headers);
    assert.equal(headers['User-Agent'], 'CNS-morning-digest/1.0');
    assert.equal(headers.Authorization, undefined);
  });

  it('uses fixtureJson without network', async () => {
    const result = await fetchRedditPublicTop(
      'MachineLearning',
      3,
      async () => {
        throw new Error('should not fetch');
      },
      FIXTURE_LISTING,
    );
    assert.equal(result.ok, true);
    assert.equal(result.posts.length, 3);
  });
});

describe('fetch-reddit-signals.mjs runRedditFetch', () => {
  const baseEnv = {
    MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning',
  };

  it('returns posts from fixture without credentials', async () => {
    const payload = await runRedditFetch(baseEnv, {
      fixtureJson: FIXTURE_LISTING,
    });
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts.length, 2);
    assert.equal(payload.posts[0].upvotes, 420);
    assert.equal(payload.posts[0].commentCount, 37);
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
        fixtureJsonBySubreddit: {
          MachineLearning: FIXTURE_LISTING,
          LocalLLaMA: FIXTURE_LISTING,
        },
      },
    );
    assert.equal(payload.posts?.length, 2);
  });

  it('returns error JSON on public fetch failure', async () => {
    const failingFetch = async () => ({ ok: false, status: 429 });
    const payload = await runRedditFetch(baseEnv, { fetch: failingFetch });
    assert.deepEqual(payload, { error: 'http-429' });
  });

  it('returns http-403 on forbidden response', async () => {
    const failingFetch = async () => ({ ok: false, status: 403 });
    const payload = await runRedditFetch(baseEnv, { fetch: failingFetch });
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

  it('fetch stdout → sourceMetadata assembly → normalizeEngagement round-trip (§6.1)', async () => {
    const payload = await runRedditFetch(baseEnv, {
      fixtureJson: FIXTURE_LISTING,
    });
    assert.ok(Array.isArray(payload.posts) && payload.posts.length > 0);

    for (const [index, post] of payload.posts.entries()) {
      const signal = redditPostToDigestSignal(post, index + 1);
      const norm = normalizeEngagement(signal);
      assert.ok(
        norm !== null && norm >= 0 && norm <= 100,
        `expected non-null engagement for ${post.title}`,
      );
      assert.equal(signal.sourceMetadata.upvotes, post.upvotes);
      if (post.commentCount !== undefined) {
        assert.equal(signal.sourceMetadata.commentCount, post.commentCount);
      }
    }

    const rootLevelUpvotes = {
      section: 'reddit',
      sourceType: 'reddit',
      title: payload.posts[0].title,
      url: payload.posts[0].url,
      rank: 1,
      upvotes: payload.posts[0].upvotes,
      commentCount: payload.posts[0].commentCount,
    };
    assert.equal(normalizeEngagement(rootLevelUpvotes), null);
  });

  it('cap fixture upvotes/comments → normalizedEngagement 100', () => {
    const norm = normalizeEngagement({
      sourceType: 'reddit',
      title: 'cap post',
      sourceMetadata: { upvotes: 10000, commentCount: 2000 },
    });
    assert.equal(norm, 100);
  });

  it('adapter-shaped reddit row drives Path A momentum via scoreDigestSignals', () => {
    const signal = redditPostToDigestSignal(
      { title: 'Momentum post', url: 'https://www.reddit.com/r/test/comments/1/x/', upvotes: 500, commentCount: 50 },
      1,
    );
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
    assert.ok(momentum > 0);
    assert.equal(
      momentum,
      clamp(Math.round(0.75 * norm + 0.25 * trendProxyForSignal(signal)), 0, 100),
    );
  });

  it('mandatory integration assertion from architecture §10', () => {
    const norm = normalizeEngagement({
      sourceType: 'reddit',
      title: 'test post',
      sourceMetadata: { upvotes: 500, commentCount: 50 },
    });
    assert.ok(norm !== null && norm >= 0 && norm <= 100);
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
});
