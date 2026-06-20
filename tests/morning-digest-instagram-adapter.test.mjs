import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  dedupeAndFilterReels,
  isInstagramEnabled,
  loadInstagramConfig,
  mapReelItem,
  parseHashtagResponse,
  reelDedupeKey,
  runInstagramFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-instagram-signals.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-instagram-signals.mjs',
);

const FIXTURE_HASHTAG = {
  items: [
    {
      shortcode: 'ABC123',
      caption: 'AI agents demo reel',
      like_count: 1200,
      comment_count: 88,
      play_count: 50000,
      owner: { username: 'aitech' },
    },
  ],
};

const FIXTURE_TRENDING_DUPES = {
  items: [
    {
      shortcode: 'DUP001',
      caption: 'Trending reel one',
      like_count: 900,
      play_count: 40000,
      owner: { username: 'creator1' },
    },
    {
      shortcode: 'DUP001',
      caption: 'Trending reel duplicate shortcode',
      like_count: 800,
      play_count: 35000,
      owner: { username: 'creator1' },
    },
    {
      shortcode: 'UNIQ002',
      caption: 'Trending reel two',
      like_count: 700,
      play_count: 30000,
      owner: { username: 'creator2' },
    },
  ],
};

describe('fetch-instagram-signals.mjs parsing', () => {
  it('maps hashtag item to stdout reel shape', () => {
    const mapped = mapReelItem(FIXTURE_HASHTAG.items[0]);
    assert.equal(mapped?.title, 'AI agents demo reel');
    assert.equal(mapped?.url, 'https://www.instagram.com/reel/ABC123/');
    assert.equal(mapped?.viewCount, 50000);
    assert.equal(mapped?.author, 'aitech');
  });

  it('reelDedupeKey uses shortcode', () => {
    assert.equal(reelDedupeKey({ shortcode: 'ABC123' }), 'ig:reel:ABC123');
  });

  it('dedupeAndFilterReels removes duplicate shortcodes within response', () => {
    const parsed = parseHashtagResponse(FIXTURE_TRENDING_DUPES, 10);
    const deduped = dedupeAndFilterReels(parsed, 10, 24 * 365);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].title, 'Trending reel one');
  });

  it('parseHashtagResponse handles empty Google-index response', () => {
    const reels = parseHashtagResponse({ items: [] }, 5);
    assert.deepEqual(reels, []);
  });
});

describe('fetch-instagram-signals.mjs runInstagramFetch', () => {
  it('returns reels from hashtag fixtures without network', async () => {
    const payload = await runInstagramFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_INSTAGRAM_HASHTAGS: 'ai',
        MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING: 'false',
      },
      { fixtureHashtagByTag: { ai: FIXTURE_HASHTAG }, now: new Date('2026-06-20T12:00:00Z') },
    );
    assert.ok(Array.isArray(payload.reels));
    assert.equal(payload.reels.length, 1);
    assert.equal(payload.reels[0].likeCount, 1200);
  });

  it('merges trending with dedup by shortcode', async () => {
    const payload = await runInstagramFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_INSTAGRAM_HASHTAGS: 'ai',
        MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING: 'true',
        MORNING_DIGEST_INSTAGRAM_LOOKBACK_HOURS: '8760',
      },
      {
        fixtureHashtagByTag: { ai: FIXTURE_HASHTAG },
        fixtureTrending: FIXTURE_TRENDING_DUPES,
        now: new Date('2026-06-20T12:00:00Z'),
      },
    );
    assert.equal(payload.reels?.length, 3);
  });

  it('returns instagram disabled when enabled flag is false', async () => {
    const payload = await runInstagramFetch({
      MORNING_DIGEST_INSTAGRAM_ENABLED: 'false',
      SCRAPECREATORS_API_KEY: 'test-key',
      MORNING_DIGEST_INSTAGRAM_HASHTAGS: 'ai',
    });
    assert.deepEqual(payload, { error: 'instagram disabled' });
  });

  it('returns missing-api-key when enabled but key unset', async () => {
    const payload = await runInstagramFetch({
      MORNING_DIGEST_INSTAGRAM_HASHTAGS: 'ai',
    });
    assert.deepEqual(payload, { error: 'missing-api-key' });
  });

  it('returns missing-hashtags when no hashtags and trending disabled', async () => {
    const payload = await runInstagramFetch({
      SCRAPECREATORS_API_KEY: 'test-key',
      MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING: 'false',
    });
    assert.deepEqual(payload, { error: 'missing-hashtags' });
  });

  it('returns empty reels array path when hashtag returns empty (still success)', async () => {
    const payload = await runInstagramFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_INSTAGRAM_HASHTAGS: 'ai',
        MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING: 'false',
      },
      { fixtureHashtagByTag: { ai: { items: [] } } },
    );
    assert.deepEqual(payload, { reels: [] });
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_INSTAGRAM_ENABLED: 'false',
      },
    });
    assert.deepEqual(JSON.parse(stdout.trim()), { error: 'instagram disabled' });
  });

  it('normalizeEngagement round-trip for instagram sourceType', async () => {
    const payload = await runInstagramFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_INSTAGRAM_HASHTAGS: 'ai',
        MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING: 'false',
        MORNING_DIGEST_INSTAGRAM_LOOKBACK_HOURS: '8760',
      },
      { fixtureHashtagByTag: { ai: FIXTURE_HASHTAG }, now: new Date('2026-06-20T12:00:00Z') },
    );
    const reel = payload.reels?.[0];
    assert.ok(reel);
    const score = normalizeEngagement({
      title: reel.title,
      sourceType: 'instagram',
      sourceMetadata: {
        viewCount: reel.viewCount,
        likes: reel.likeCount,
        commentCount: reel.commentCount,
      },
    });
    assert.ok(typeof score === 'number' && score > 0);
  });

  it('loadInstagramConfig defaults includeTrending true', () => {
    assert.equal(loadInstagramConfig({}).includeTrending, true);
    assert.equal(isInstagramEnabled('off'), false);
  });
});
