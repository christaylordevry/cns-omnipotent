import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  classifyScrapeCreatorsHttpError,
  dedupeAndFilterVideos,
  isTiktokEnabled,
  loadTiktokConfig,
  mapAwemeItem,
  parseHashtagResponse,
  parseStatCount,
  parseTiktokHashtags,
  runTiktokFetch,
  tiktokDedupeKey,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-tiktok-signals.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-tiktok-signals.mjs',
);

const FIXTURE_HASHTAG = {
  aweme_list: [
    {
      aweme_id: '7123456789012345678',
      desc: 'Building AI agents with MCP',
      statistics: { play_count: '125000', digg_count: '8900', comment_count: '420' },
      author: { unique_id: 'aitech' },
    },
    {
      aweme_id: '7123456789012345679',
      desc: 'Duplicate aweme id',
      statistics: { play_count: '5000', digg_count: '120', comment_count: '30' },
      author: { unique_id: 'dup' },
    },
    {
      aweme_id: '7123456789012345678',
      desc: 'Duplicate aweme id second',
      statistics: { play_count: '100', digg_count: '10', comment_count: '1' },
      author: { unique_id: 'dup2' },
    },
  ],
};

describe('fetch-tiktok-signals.mjs parsing', () => {
  it('parseTiktokHashtags strips hash and splits comma list', () => {
    assert.deepEqual(parseTiktokHashtags('#aiagents, claudeai'), ['aiagents', 'claudeai']);
  });

  it('maps aweme_list item to stdout video shape', () => {
    const mapped = mapAwemeItem(FIXTURE_HASHTAG.aweme_list[0]);
    assert.equal(mapped?.title, 'Building AI agents with MCP');
    assert.equal(mapped?.viewCount, 125000);
    assert.equal(mapped?.likeCount, 8900);
    assert.equal(mapped?.url, 'https://www.tiktok.com/@aitech/video/7123456789012345678');
  });

  it('parseStatCount parses string statistics', () => {
    assert.equal(parseStatCount('125000'), 125000);
    assert.equal(parseStatCount(undefined), 0);
  });

  it('parseHashtagResponse caps at perHashtag', () => {
    const videos = parseHashtagResponse(FIXTURE_HASHTAG, 2);
    assert.equal(videos.length, 2);
  });

  it('tiktokDedupeKey prefers aweme_id', () => {
    assert.equal(tiktokDedupeKey({ aweme_id: '7123456789012345678' }), 'tt:7123456789012345678');
  });

  it('dedupeAndFilterVideos keeps first occurrence', () => {
    const parsed = parseHashtagResponse(FIXTURE_HASHTAG, 5);
    const deduped = dedupeAndFilterVideos(parsed, 10, 24 * 365);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].viewCount, 125000);
  });

  it('classifyScrapeCreatorsHttpError detects credit-exhausted', () => {
    const reason = classifyScrapeCreatorsHttpError(
      { status: 402 },
      { message: 'Insufficient credits' },
    );
    assert.equal(reason, 'credit-exhausted');
  });

  it('classifyScrapeCreatorsHttpError maps 401', () => {
    assert.equal(classifyScrapeCreatorsHttpError({ status: 401 }, {}), 'http-401');
  });

  it('classifyScrapeCreatorsHttpError maps bare 402 to credit-exhausted', () => {
    assert.equal(classifyScrapeCreatorsHttpError({ status: 402 }, {}), 'credit-exhausted');
  });
});

describe('fetch-tiktok-signals.mjs runTiktokFetch', () => {
  it('returns videos from fixtures without network', async () => {
    const payload = await runTiktokFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_TIKTOK_HASHTAGS: 'aiagents',
      },
      { fixtureHashtagByTag: { aiagents: FIXTURE_HASHTAG }, now: new Date('2026-06-20T12:00:00Z') },
    );
    assert.ok(Array.isArray(payload.videos));
    assert.equal(payload.videos.length, 2);
    assert.equal(payload.videos[0].viewCount, 125000);
  });

  it('returns tiktok disabled when enabled flag is false', async () => {
    const payload = await runTiktokFetch({
      MORNING_DIGEST_TIKTOK_ENABLED: 'false',
      SCRAPECREATORS_API_KEY: 'test-key',
      MORNING_DIGEST_TIKTOK_HASHTAGS: 'aiagents',
    });
    assert.deepEqual(payload, { error: 'tiktok disabled' });
  });

  it('returns missing-api-key when enabled but key unset', async () => {
    const payload = await runTiktokFetch({
      MORNING_DIGEST_TIKTOK_HASHTAGS: 'aiagents',
    });
    assert.deepEqual(payload, { error: 'missing-api-key' });
  });

  it('uses trending fallback when hashtags empty', async () => {
    const payload = await runTiktokFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
      },
      { fixtureTrending: FIXTURE_HASHTAG, now: new Date('2026-06-20T12:00:00Z') },
    );
    assert.equal(payload.videos?.length, 2);
  });

  it('returns http-401 on fatal auth error', async () => {
    const failingFetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });
    const payload = await runTiktokFetch(
      {
        SCRAPECREATORS_API_KEY: 'bad-key',
        MORNING_DIGEST_TIKTOK_HASHTAGS: 'aiagents',
      },
      { fetch: /** @type {typeof fetch} */ (failingFetch) },
    );
    assert.deepEqual(payload, { error: 'http-401' });
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_TIKTOK_ENABLED: 'false',
      },
    });
    assert.deepEqual(JSON.parse(stdout.trim()), { error: 'tiktok disabled' });
  });

  it('normalizeEngagement round-trip for tiktok sourceType', async () => {
    const payload = await runTiktokFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_TIKTOK_HASHTAGS: 'aiagents',
      },
      { fixtureHashtagByTag: { aiagents: FIXTURE_HASHTAG }, now: new Date('2026-06-20T12:00:00Z') },
    );
    const video = payload.videos?.[0];
    assert.ok(video);
    const score = normalizeEngagement({
      title: video.title,
      sourceType: 'tiktok',
      sourceMetadata: {
        viewCount: video.viewCount,
        likes: video.likeCount,
        commentCount: video.commentCount,
      },
    });
    assert.ok(typeof score === 'number' && score > 0);
  });

  it('loadTiktokConfig respects enabled default true', () => {
    assert.equal(loadTiktokConfig({}).enabled, true);
    assert.equal(isTiktokEnabled('off'), false);
  });
});
