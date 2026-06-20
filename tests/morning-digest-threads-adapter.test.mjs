import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  dedupeAndFilterPosts,
  isThreadsEnabled,
  loadThreadsConfig,
  mapThreadsPost,
  parseThreadsHandles,
  parseThreadsKeywords,
  parseThreadsPostsResponse,
  runThreadsFetch,
  threadsDedupeKey,
  THREADS_SEARCH_ENDPOINT_AVAILABLE,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-threads-signals.mjs';
import { buildDigestPushPayload } from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';
import {
  buildCanonicalThreadsDigestSignal,
  CANONICAL_THREADS_POST,
  THREADS_VALIDATOR_METADATA_KEYS,
} from './fixtures/threads-digest-signal.fixture.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-threads-signals.mjs',
);

const FIXTURE_NOW = new Date('2026-06-20T12:00:00.000Z');
const FIXTURE_TAKEN_AT = Math.floor(FIXTURE_NOW.getTime() / 1000) - 3600;

const FIXTURE_POST_RAW = {
  id: '3851718899906387951_63491345281',
  caption: {
    text: 'What does it mean that the state of the art models continue to give this for the last 4 years as *the* joke.',
  },
  code: 'DV0De6jlB_v',
  like_count: 215,
  reshare_count: 10,
  repost_count: 2,
  direct_reply_count: 8,
  taken_at: FIXTURE_TAKEN_AT,
  user: { username: 'karpathy' },
  url: 'https://www.threads.com/@karpathy/post/DV0De6jlB_v',
};

const FIXTURE_USER_POSTS = {
  success: true,
  posts: [FIXTURE_POST_RAW],
};

describe('fetch-threads-signals.mjs parsing', () => {
  it('parseThreadsHandles strips @ and dedupes case-insensitively', () => {
    assert.deepEqual(parseThreadsHandles('@Karpathy,karpathy,sama'), ['Karpathy', 'sama']);
  });

  it('parseThreadsKeywords caps at 5 keywords', () => {
    assert.equal(parseThreadsKeywords('a,b,c,d,e,f,g').length, 5);
  });

  it('maps API post to stdout shape with repost sum', () => {
    const mapped = mapThreadsPost(FIXTURE_POST_RAW, 'karpathy');
    assert.equal(mapped?.title, CANONICAL_THREADS_POST.title);
    assert.equal(mapped?.authorHandle, 'karpathy');
    assert.equal(mapped?.likes, 215);
    assert.equal(mapped?.reposts, 12);
    assert.equal(mapped?.replies, 8);
    assert.equal(mapped?.postCode, 'DV0De6jlB_v');
    assert.ok(mapped?.publishedAt);
  });

  it('threadsDedupeKey prefers postId then postCode', () => {
    assert.equal(threadsDedupeKey({ postId: '123' }), 'th:123');
    assert.equal(threadsDedupeKey({ postCode: 'ABC' }), 'th:code:ABC');
  });

  it('dedupeAndFilterPosts removes duplicate postCode across handles', () => {
    const first = mapThreadsPost(FIXTURE_POST_RAW, 'karpathy');
    const second = mapThreadsPost(FIXTURE_POST_RAW, 'other');
    const deduped = dedupeAndFilterPosts([first, second], 10, 168, FIXTURE_NOW);
    assert.equal(deduped.length, 1);
  });

  it('parseThreadsPostsResponse respects per-handle limit', () => {
    const posts = parseThreadsPostsResponse(
      { posts: [FIXTURE_POST_RAW, { ...FIXTURE_POST_RAW, id: '2', code: 'X2' }] },
      1,
      'karpathy',
    );
    assert.equal(posts.length, 1);
  });

  it('buildCanonicalThreadsDigestSignal metadata keys stay validator-bound', () => {
    const signal = buildCanonicalThreadsDigestSignal();
    assert.equal(signal.sourceType, 'threads');
    assert.deepEqual(Object.keys(signal.sourceMetadata ?? {}).sort(), [
      ...THREADS_VALIDATOR_METADATA_KEYS,
    ].sort());
    assert.equal('postCode' in (signal.sourceMetadata ?? {}), false);
    assert.equal('postId' in (signal.sourceMetadata ?? {}), false);
  });

  it('buildDigestPushPayload externalId uses postId when present', () => {
    const payload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      threads: { posts: [CANONICAL_THREADS_POST] },
      runMeta: { topTrend: 'AI' },
    });
    const signal = payload.signals.find((row) => row.sourceType === 'threads');
    assert.equal(signal?.externalId, CANONICAL_THREADS_POST.postId);
  });

  it('normalizeEngagement round-trip for threads via likes + reposts', () => {
    const built = buildCanonicalThreadsDigestSignal();
    const score = normalizeEngagement({
      title: built.title,
      sourceType: 'threads',
      sourceMetadata: built.sourceMetadata,
    });
    assert.ok(typeof score === 'number' && score > 0);
  });
});

describe('fetch-threads-signals.mjs runThreadsFetch', () => {
  it('returns posts from handle fixtures without network', async () => {
    const payload = await runThreadsFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
      },
      { fixtures: { 'handle:karpathy': FIXTURE_USER_POSTS }, now: FIXTURE_NOW },
    );
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts?.length, 1);
    assert.equal(payload.posts?.[0]?.authorHandle, 'karpathy');
  });

  it('returns threads disabled when enabled flag is false', async () => {
    const payload = await runThreadsFetch({
      MORNING_DIGEST_THREADS_ENABLED: '0',
      SCRAPECREATORS_API_KEY: 'test-key',
      MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
    });
    assert.deepEqual(payload, { error: 'threads disabled' });
  });

  it('returns missing-api-key when key absent', async () => {
    const payload = await runThreadsFetch({
      MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
    });
    assert.deepEqual(payload, { error: 'missing-api-key' });
  });

  it('returns missing-handles when watchlist empty', async () => {
    const payload = await runThreadsFetch({
      SCRAPECREATORS_API_KEY: 'test-key',
      MORNING_DIGEST_THREADS_HANDLES: '',
    });
    assert.deepEqual(payload, { error: 'missing-handles' });
  });

  it('returns credit-exhausted on fatal 402 from handle fetch', async () => {
    const payload = await runThreadsFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
      },
      {
        fetch: async () => ({
          ok: false,
          status: 402,
          json: async () => ({ message: 'credit exhausted' }),
        }),
      },
    );
    assert.deepEqual(payload, { error: 'credit-exhausted' });
  });

  it('returns http-401 on fatal 401 from handle fetch', async () => {
    const payload = await runThreadsFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
      },
      {
        fetch: async () => ({
          ok: false,
          status: 401,
          json: async () => ({ message: 'unauthorized' }),
        }),
      },
    );
    assert.deepEqual(payload, { error: 'http-401' });
  });

  it('keeps handle-sourced posts when keyword search hits fatal 401', async () => {
    if (!THREADS_SEARCH_ENDPOINT_AVAILABLE) {
      return;
    }
    let callCount = 0;
    const payload = await runThreadsFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
        MORNING_DIGEST_THREADS_KEYWORDS: 'ai agents',
      },
      {
        fixtures: { 'handle:karpathy': FIXTURE_USER_POSTS },
        fetch: async () => {
          callCount += 1;
          return {
            ok: false,
            status: 401,
            json: async () => ({ message: 'unauthorized' }),
          };
        },
        now: FIXTURE_NOW,
      },
    );
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts?.length, 1);
    assert.equal(payload.posts?.[0]?.authorHandle, 'karpathy');
    assert.ok(callCount >= 1);
  });

  it('does not parse keywords when env unset even if search endpoint available', () => {
    const config = loadThreadsConfig({
      SCRAPECREATORS_API_KEY: 'key',
      MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
    });
    assert.deepEqual(config.keywords, []);
    assert.equal(THREADS_SEARCH_ENDPOINT_AVAILABLE, true);
  });

  it('keyword supplement merges when search fixture provided and endpoint available', async () => {
    if (!THREADS_SEARCH_ENDPOINT_AVAILABLE) {
      return;
    }
    const payload = await runThreadsFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
        MORNING_DIGEST_THREADS_KEYWORDS: 'ai agents',
      },
      {
        fixtures: {
          'handle:karpathy': FIXTURE_USER_POSTS,
          'keyword:ai agents': {
            posts: [
              {
                ...FIXTURE_POST_RAW,
                id: 'search-only-post',
                code: 'SearchOnly1',
                caption: { text: 'Keyword-only supplementary post about AI agents' },
              },
            ],
          },
        },
        now: FIXTURE_NOW,
      },
    );
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts?.length, 2);
  });

  it('CLI exits 0 with error JSON when disabled', async () => {
    const { stdout } = await execFileAsync(process.execPath, [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_THREADS_ENABLED: '0',
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_THREADS_HANDLES: 'karpathy',
      },
      cwd: repoRoot,
    });
    assert.deepEqual(JSON.parse(stdout.trim()), { error: 'threads disabled' });
  });
});

describe('fetch-threads-signals.mjs config', () => {
  it('isThreadsEnabled defaults true', () => {
    assert.equal(isThreadsEnabled(undefined), true);
    assert.equal(isThreadsEnabled('off'), false);
  });

  it('loadThreadsConfig parses tuning vars', () => {
    const config = loadThreadsConfig({
      SCRAPECREATORS_API_KEY: 'key',
      MORNING_DIGEST_THREADS_HANDLES: 'sama,karpathy',
      MORNING_DIGEST_THREADS_MAX_POSTS: '20',
      MORNING_DIGEST_THREADS_PER_HANDLE: '3',
      MORNING_DIGEST_THREADS_LOOKBACK_HOURS: '72',
    });
    assert.equal(config.maxPosts, 20);
    assert.equal(config.perHandle, 3);
    assert.equal(config.lookbackHours, 72);
    assert.deepEqual(config.handles, ['sama', 'karpathy']);
  });
});
