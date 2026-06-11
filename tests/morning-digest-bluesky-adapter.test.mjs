import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  buildPostUrl,
  dedupePostsByUrl,
  fetchAuthorFeed,
  filterByLookback,
  loadBlueskyConfig,
  mapFeedPost,
  parseActors,
  parseAuthorFeedResponse,
  resolveHandle,
  runBlueskyFetch,
  sortAndCapPosts,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs';
import {
  BSKY_LIKES_CAP,
  BSKY_QUOTES_CAP,
  BSKY_REPLIES_CAP,
  BSKY_REPOSTS_CAP,
  normalizeEngagement,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

/**
 * Mirrors task-prompt §9 Bluesky assembly.
 *
 * @param {{
 *   title: string,
 *   authorHandle: string,
 *   url: string,
 *   likes: number,
 *   reposts: number,
 *   replies: number,
 *   quotes: number,
 *   publishedAt?: string,
 * }} post
 * @param {number} rank
 */
function blueskyPostToDigestSignal(post, rank) {
  /** @type {Record<string, unknown>} */
  const sourceMetadata = {
    authorHandle: post.authorHandle,
    likes: post.likes,
    reposts: post.reposts,
    replies: post.replies,
    quotes: post.quotes,
  };
  if (post.publishedAt) {
    sourceMetadata.publishedAt = post.publishedAt;
  }
  return {
    section: 'bluesky',
    sourceType: 'bluesky',
    title: post.title,
    summary: post.title.slice(0, 200),
    url: post.url,
    rank,
    sourceMetadata,
  };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs',
);

const FIXTURE_FEED = {
  feed: [
    {
      post: {
        uri: 'at://did:plc:test/app.bsky.feed.post/3labc123',
        record: {
          text: 'Bluesky post alpha with enough text.',
          createdAt: '2026-06-11T07:30:00.000Z',
        },
        author: { handle: 'simonwillison.net' },
        likeCount: 450,
        repostCount: 120,
        replyCount: 34,
        quoteCount: 8,
        indexedAt: '2026-06-11T07:31:00.000Z',
      },
    },
    {
      post: {
        uri: 'at://did:plc:test/app.bsky.feed.post/3ldef456',
        record: { text: 'Second post with sparse engagement.' },
        author: { handle: 'karpathy.bsky.social' },
        indexedAt: '2026-06-11T06:00:00.000Z',
      },
    },
    {
      post: {
        uri: 'at://did:plc:test/app.bsky.feed.post/3lghi789',
        record: { text: '' },
        author: { handle: 'invalid.example' },
      },
    },
  ],
};

describe('fetch-bluesky-signals.mjs parsing', () => {
  it('maps AT Protocol feed item to stdout post shape', () => {
    const mapped = mapFeedPost(FIXTURE_FEED.feed[0]);
    assert.deepEqual(mapped, {
      title: 'Bluesky post alpha with enough text.',
      authorHandle: 'simonwillison.net',
      url: 'https://bsky.app/profile/simonwillison.net/post/3labc123',
      publishedAt: '2026-06-11T07:31:00.000Z',
      likes: 450,
      reposts: 120,
      replies: 34,
      quotes: 8,
    });
  });

  it('buildPostUrl extracts rkey suffix from uri', () => {
    assert.equal(
      buildPostUrl('simonwillison.net', 'at://did:plc:x/app.bsky.feed.post/3labc123'),
      'https://bsky.app/profile/simonwillison.net/post/3labc123',
    );
  });

  it('parseAuthorFeedResponse skips invalid posts', () => {
    const posts = parseAuthorFeedResponse(FIXTURE_FEED);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].authorHandle, 'simonwillison.net');
    assert.equal(posts[1].likes, 0);
  });

  it('sortAndCapPosts orders by likes + 2×reposts and caps', () => {
    const posts = parseAuthorFeedResponse(FIXTURE_FEED);
    const capped = sortAndCapPosts(posts, 1);
    assert.equal(capped.length, 1);
    assert.equal(capped[0].authorHandle, 'simonwillison.net');
  });

  it('filterByLookback excludes posts older than lookback window', () => {
    const posts = parseAuthorFeedResponse(FIXTURE_FEED);
    const now = new Date('2026-06-11T12:00:00.000Z');
    const filtered = filterByLookback(posts, 5, now);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].authorHandle, 'simonwillison.net');
  });

  it('filterByLookback excludes posts without or with invalid publishedAt', () => {
    const dated = {
      title: 'dated',
      authorHandle: 'a.bsky.social',
      url: 'https://bsky.app/profile/a.bsky.social/post/1',
      publishedAt: '2020-01-01T00:00:00.000Z',
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
    };
    const now = new Date('2026-06-11T12:00:00.000Z');
    assert.equal(filterByLookback([{ ...dated, publishedAt: undefined }], 24, now).length, 0);
    assert.equal(
      filterByLookback([{ ...dated, publishedAt: 'not-a-date' }], 24, now).length,
      0,
    );
    assert.equal(filterByLookback([dated], 24, now).length, 0);
  });

  it('dedupePostsByUrl keeps first occurrence per url', () => {
    const deduped = dedupePostsByUrl([
      { url: 'https://bsky.app/profile/a/post/1', title: 'first' },
      { url: 'https://bsky.app/profile/a/post/1', title: 'duplicate' },
      { url: 'https://bsky.app/profile/b/post/2', title: 'other' },
    ]);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].title, 'first');
  });
});

describe('fetch-bluesky-signals.mjs resolveHandle', () => {
  it('returns did from mocked resolve response', async () => {
    const fetchFn = async () => ({
      ok: true,
      json: async () => ({ did: 'did:plc:test' }),
    });
    const result = await resolveHandle('https://api.bsky.app', 'simonwillison.net', fetchFn);
    assert.deepEqual(result, { did: 'did:plc:test' });
  });
});

describe('fetch-bluesky-signals.mjs fetchAuthorFeed', () => {
  it('parses getAuthorFeed response via mocked fetch', async () => {
    const fetchFn = async (url) => {
      assert.ok(String(url).includes('app.bsky.feed.getAuthorFeed'));
      assert.ok(String(url).includes('did%3Aplc%3Atest'));
      return { ok: true, json: async () => FIXTURE_FEED };
    };
    const result = await fetchAuthorFeed('https://api.bsky.app', 'did:plc:test', fetchFn);
    assert.ok(Array.isArray(result.posts));
    assert.equal(result.posts?.length, 2);
    assert.equal(result.posts?.[0].authorHandle, 'simonwillison.net');
  });

  it('returns error on non-ok feed response', async () => {
    const fetchFn = async () => ({ ok: false, status: 429 });
    const result = await fetchAuthorFeed('https://api.bsky.app', 'did:plc:test', fetchFn);
    assert.deepEqual(result, { error: 'feed-429' });
  });
});

describe('fetch-bluesky-signals.mjs runBlueskyFetch', () => {
  it('returns posts from fixture without network', async () => {
    const payload = await runBlueskyFetch(
      {
        MORNING_DIGEST_BSKY_ACTORS: 'simonwillison.net',
        MORNING_DIGEST_BSKY_LOOKBACK_HOURS: '5',
      },
      {
        fixtures: {
          'simonwillison.net': { did: 'did:plc:test', feed: FIXTURE_FEED },
        },
        now: new Date('2026-06-11T12:00:00.000Z'),
      },
    );
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts?.length, 1);
    assert.equal(/** @type {{ authorHandle: string }} */ (payload.posts[0]).authorHandle, 'simonwillison.net');
  });

  it('returns bluesky disabled when enabled flag is false', async () => {
    const payload = await runBlueskyFetch({ MORNING_DIGEST_BSKY_ENABLED: 'false' });
    assert.deepEqual(payload, { error: 'bluesky disabled' });
  });

  it('returns no actors configured when env actor list is empty', async () => {
    const payload = await runBlueskyFetch({ MORNING_DIGEST_BSKY_ACTORS: '' });
    assert.deepEqual(payload, { error: 'no bluesky actors configured' });
  });

  it('returns error JSON on fetch failure', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const payload = await runBlueskyFetch(
      { MORNING_DIGEST_BSKY_ACTORS: 'simonwillison.net' },
      { fetch: failingFetch },
    );
    assert.ok(payload.error);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_BSKY_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'bluesky disabled' });
  });

  it('fetch stdout → sourceMetadata assembly → normalizeEngagement round-trip (§9)', async () => {
    const payload = await runBlueskyFetch(
      { MORNING_DIGEST_BSKY_ACTORS: 'simonwillison.net' },
      {
        fixtures: {
          'simonwillison.net': { did: 'did:plc:test', feed: FIXTURE_FEED },
        },
        now: new Date('2026-06-11T12:00:00.000Z'),
      },
    );
    assert.ok(Array.isArray(payload.posts) && payload.posts.length > 0);

    const post = /** @type {{
      title: string,
      authorHandle: string,
      url: string,
      likes: number,
      reposts: number,
      replies: number,
      quotes: number,
      publishedAt?: string,
    }} */ (payload.posts[0]);
    const signal = blueskyPostToDigestSignal(post, 1);
    const norm = normalizeEngagement(signal);
    assert.ok(norm !== null && norm >= 0 && norm <= 100);
    assert.equal(signal.sourceMetadata.likes, post.likes);
    assert.equal(signal.section, 'bluesky');
    assert.equal(signal.sourceType, 'bluesky');

    const rootLevelLikes = {
      section: 'bluesky',
      sourceType: 'bluesky',
      title: post.title,
      url: post.url,
      rank: 1,
      likes: post.likes,
    };
    assert.equal(normalizeEngagement(rootLevelLikes), null);
  });
});

describe('loadBlueskyConfig', () => {
  it('defaults actors when unset', () => {
    const config = loadBlueskyConfig({});
    assert.ok(config.actors.length >= 8);
    assert.equal(config.maxPosts, 25);
    assert.equal(config.lookbackHours, 24);
  });

  it('parseActors splits comma-separated handles', () => {
    assert.deepEqual(parseActors('a.bsky.social,b.example'), ['a.bsky.social', 'b.example']);
  });

  it('parseActors dedupes repeated handles', () => {
    assert.deepEqual(parseActors('a.bsky.social,a.bsky.social,b.example'), [
      'a.bsky.social',
      'b.example',
    ]);
  });

  it('parseActors returns empty when explicitly empty and defaults disabled', () => {
    assert.deepEqual(parseActors('', { useDefaultWhenEmpty: false }), []);
  });

  it('caps max posts at hard limit', () => {
    const config = loadBlueskyConfig({ MORNING_DIGEST_BSKY_MAX_POSTS: '999' });
    assert.equal(config.maxPosts, 50);
  });
});

describe('normalizeEngagement bluesky caps', () => {
  it('bluesky at engagement caps → 100', () => {
    assert.equal(
      normalizeEngagement({
        title: 'BSKY cap post',
        sourceType: 'bluesky',
        sourceMetadata: {
          likes: BSKY_LIKES_CAP,
          reposts: BSKY_REPOSTS_CAP,
          replies: BSKY_REPLIES_CAP,
          quotes: BSKY_QUOTES_CAP,
        },
      }),
      100,
    );
  });

  it('bluesky with all zero engagement → null', () => {
    assert.equal(
      normalizeEngagement({
        title: 'BSKY zero post',
        sourceType: 'bluesky',
        sourceMetadata: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      }),
      null,
    );
  });
});
