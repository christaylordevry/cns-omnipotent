import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  absoluteRedditUrl,
  dedupePostsByUrl,
  fetchRedditAppToken,
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
  it('maps OAuth listing fields to stdout post shape', () => {
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

describe('fetch-reddit-signals.mjs fetchRedditAppToken', () => {
  it('POSTs password grant with Basic auth header', async () => {
    /** @type {RequestInit | undefined} */
    let capturedInit;
    const mockFetch = async (_url, init) => {
      capturedInit = init;
      return {
        ok: true,
        async json() {
          return { access_token: 'test-token-abc' };
        },
      };
    };

    const result = await fetchRedditAppToken(
      'client-id',
      'client-secret',
      'reddit-user',
      'reddit-pass',
      mockFetch,
    );

    assert.deepEqual(result, { ok: true, token: 'test-token-abc' });
    assert.equal(capturedInit?.method, 'POST');
    const headers = /** @type {Record<string, string>} */ (capturedInit?.headers);
    assert.equal(headers.Authorization, `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
    assert.equal(headers['User-Agent'], 'CNS-morning-digest/1.0');
    const body = String(capturedInit?.body);
    assert.ok(body.includes('grant_type=password'));
    assert.ok(body.includes('username=reddit-user'));
    assert.ok(body.includes('password=reddit-pass'));
  });

  it('uses fixtureToken without network', async () => {
    const result = await fetchRedditAppToken(
      'id',
      'secret',
      'user',
      'pass',
      async () => {
        throw new Error('should not fetch');
      },
      'fixture-token',
    );
    assert.deepEqual(result, { ok: true, token: 'fixture-token' });
  });

  it('returns token-error when access_token is null (not Bearer null)', async () => {
    const result = await fetchRedditAppToken('id', 'secret', 'user', 'pass', async () => ({
      ok: true,
      async json() {
        return { access_token: null };
      },
    }));
    assert.deepEqual(result, { ok: false, reason: 'token-error' });
  });
});

describe('fetch-reddit-signals.mjs runRedditFetch', () => {
  const baseEnv = {
    MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning',
    REDDIT_CLIENT_ID: 'id',
    REDDIT_CLIENT_SECRET: 'secret',
    REDDIT_USERNAME: 'user',
    REDDIT_PASSWORD: 'pass',
  };

  it('returns posts from fixture without network', async () => {
    const payload = await runRedditFetch(baseEnv, {
      fixtureToken: 'token',
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
    const payload = await runRedditFetch({
      REDDIT_CLIENT_ID: 'id',
      REDDIT_CLIENT_SECRET: 'secret',
      REDDIT_USERNAME: 'user',
      REDDIT_PASSWORD: 'pass',
    });
    assert.deepEqual(payload, { error: 'missing-subreddits' });
  });

  it('returns missing-credentials when OAuth vars absent', async () => {
    const payload = await runRedditFetch({
      MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning',
    });
    assert.deepEqual(payload, { error: 'missing-credentials' });
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
        fixtureToken: 'token',
        fixtureJsonBySubreddit: {
          MachineLearning: FIXTURE_LISTING,
          LocalLLaMA: FIXTURE_LISTING,
        },
      },
    );
    assert.equal(payload.posts?.length, 2);
  });

  it('returns error JSON on OAuth hot fetch failure', async () => {
    const failingFetch = async (url) => {
      if (String(url).includes('access_token')) {
        return {
          ok: true,
          async json() {
            return { access_token: 'token' };
          },
        };
      }
      return { ok: false, status: 403 };
    };
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

  it('fetch stdout → sourceMetadata assembly → normalizeEngagement round-trip (§6.1)', async () => {
    const payload = await runRedditFetch(baseEnv, {
      fixtureToken: 'token',
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
      REDDIT_CLIENT_ID: 'id',
      REDDIT_CLIENT_SECRET: 'secret',
      REDDIT_USERNAME: 'user',
      REDDIT_PASSWORD: 'pass',
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

  it('parseSubreddits trims and drops empty segments', () => {
    assert.deepEqual(parseSubreddits(' MachineLearning , , LocalLLaMA '), [
      'MachineLearning',
      'LocalLLaMA',
    ]);
  });
});
