import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  classifyYoutubeHttpError,
  dedupeVideosById,
  enrichVideoStatistics,
  isYoutubeEnabled,
  loadYoutubeConfig,
  mapSearchItem,
  parseSearchResponse,
  parseStatCount,
  parseVideosListResponse,
  runYoutubeFetch,
  searchVideosForQuery,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-youtube-signals.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

/**
 * @param {{ title: string, url: string, channelTitle?: string, viewCount?: number, likeCount?: number, commentCount?: number, publishedAt?: string }} video
 * @param {number} rank
 */
function youtubeVideoToDigestSignal(video, rank) {
  /** @type {Record<string, unknown>} */
  const sourceMetadata = {
    viewCount: video.viewCount,
    likes: video.likeCount,
    commentCount: video.commentCount,
  };
  if (video.channelTitle) {
    sourceMetadata.author = video.channelTitle;
  }
  if (video.publishedAt) {
    sourceMetadata.publishedAt = video.publishedAt;
  }
  return {
    section: 'youtube',
    sourceType: 'youtube',
    title: video.title,
    summary: video.title.slice(0, 200),
    url: video.url,
    rank,
    sourceMetadata,
  };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-youtube-signals.mjs',
);

const FIXTURE_SEARCH = {
  items: [
    {
      id: { kind: 'youtube#video', videoId: 'video-one' },
      snippet: {
        title: 'Building AI agents with MCP',
        channelTitle: 'Example Channel',
        publishedAt: '2026-06-18T14:30:00.000Z',
      },
    },
    {
      id: { kind: 'youtube#video', videoId: 'video-two' },
      snippet: {
        title: 'Claude Code tutorial',
        channelTitle: 'Dev Channel',
        publishedAt: '2026-06-18T10:00:00.000Z',
      },
    },
    {
      id: { kind: 'youtube#video', videoId: 'video-one' },
      snippet: {
        title: 'Duplicate video id',
        channelTitle: 'Dup Channel',
        publishedAt: '2026-06-17T10:00:00.000Z',
      },
    },
  ],
};

const FIXTURE_VIDEOS_LIST = {
  items: [
    {
      id: 'video-one',
      statistics: { viewCount: '12500', likeCount: '890', commentCount: '142' },
    },
    {
      id: 'video-two',
      statistics: { viewCount: '5000', likeCount: '120', commentCount: '30' },
    },
  ],
};

describe('fetch-youtube-signals.mjs parsing', () => {
  it('maps search API fields to intermediate video shape', () => {
    const mapped = mapSearchItem(FIXTURE_SEARCH.items[0]);
    assert.deepEqual(mapped, {
      videoId: 'video-one',
      title: 'Building AI agents with MCP',
      channelTitle: 'Example Channel',
      publishedAt: '2026-06-18T14:30:00.000Z',
    });
  });

  it('parseSearchResponse caps at perQuery', () => {
    const videos = parseSearchResponse(FIXTURE_SEARCH, 2);
    assert.equal(videos.length, 2);
    assert.equal(videos[0].videoId, 'video-one');
    assert.equal(videos[1].videoId, 'video-two');
  });

  it('parseStatCount parses string statistics', () => {
    assert.equal(parseStatCount('12500'), 12500);
    assert.equal(parseStatCount(undefined), 0);
  });

  it('parseVideosListResponse maps statistics by video id', () => {
    const stats = parseVideosListResponse(FIXTURE_VIDEOS_LIST);
    assert.equal(stats.get('video-one')?.viewCount, 12500);
    assert.equal(stats.get('video-one')?.likeCount, 890);
    assert.equal(stats.get('video-two')?.commentCount, 30);
  });

  it('dedupeVideosById keeps first occurrence and respects maxVideos', () => {
    const videos = parseSearchResponse(FIXTURE_SEARCH, 3);
    const deduped = dedupeVideosById(videos, 5);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].videoId, 'video-one');
  });

  it('classifyYoutubeHttpError detects quota-exceeded', () => {
    const reason = classifyYoutubeHttpError(
      { status: 403 },
      { error: { errors: [{ reason: 'quotaExceeded' }] } },
    );
    assert.equal(reason, 'quota-exceeded');
  });
});

describe('fetch-youtube-signals.mjs runYoutubeFetch', () => {
  it('returns videos from fixtures without network (search + enrich)', async () => {
    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
      },
      {
        fixtureSearchByQuery: { 'AI agents': FIXTURE_SEARCH },
        fixtureVideosListByBatch: {
          'video-one,video-two': FIXTURE_VIDEOS_LIST,
        },
      },
    );
    assert.ok(Array.isArray(payload.videos));
    assert.equal(payload.videos.length, 2);
    assert.equal(payload.videos[0].viewCount, 12500);
    assert.equal(payload.videos[0].url, 'https://www.youtube.com/watch?v=video-one');
  });

  it('returns youtube disabled when enabled flag is false', async () => {
    const payload = await runYoutubeFetch({
      MORNING_DIGEST_YOUTUBE_ENABLED: 'false',
      MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
      MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
    });
    assert.deepEqual(payload, { error: 'youtube disabled' });
  });

  it('returns missing-api-key when enabled but key unset', async () => {
    const payload = await runYoutubeFetch({
      MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
    });
    assert.deepEqual(payload, { error: 'missing-api-key' });
  });

  it('returns missing-queries when key set but queries unset', async () => {
    const payload = await runYoutubeFetch({
      MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
    });
    assert.deepEqual(payload, { error: 'missing-queries' });
  });

  it('dedupes across overlapping queries', async () => {
    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents,MCP demo',
        MORNING_DIGEST_YOUTUBE_MAX_VIDEOS: '25',
        MORNING_DIGEST_YOUTUBE_PER_QUERY: '3',
      },
      {
        fixtureSearchByQuery: {
          'AI agents': FIXTURE_SEARCH,
          'MCP demo': FIXTURE_SEARCH,
        },
        fixtureVideosListByBatch: {
          'video-one,video-two': FIXTURE_VIDEOS_LIST,
        },
      },
    );
    assert.equal(payload.videos?.length, 2);
  });

  it('returns quota-exceeded on fatal search 403', async () => {
    const failingFetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: { errors: [{ reason: 'quotaExceeded' }] } }),
    });
    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
      },
      { fetch: /** @type {typeof fetch} */ (failingFetch) },
    );
    assert.deepEqual(payload, { error: 'quota-exceeded' });
  });

  it('aborts search loop on quota-exceeded without calling later queries', async () => {
    let fetchCount = 0;
    const fetchFn = async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return { ok: true, status: 200, json: async () => FIXTURE_SEARCH };
      }
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: { errors: [{ reason: 'quotaExceeded' }] } }),
      };
    };

    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'q1,q2,q3',
        MORNING_DIGEST_YOUTUBE_PER_QUERY: '2',
      },
      { fetch: /** @type {typeof fetch} */ (fetchFn) },
    );
    assert.deepEqual(payload, { error: 'quota-exceeded' });
    assert.equal(fetchCount, 2, 'query 3 must not run after fatal quota on query 2');
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_YOUTUBE_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'youtube disabled' });
  });

  it('fetch stdout → sourceMetadata assembly → normalizeEngagement round-trip', async () => {
    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
      },
      {
        fixtureSearchByQuery: { 'AI agents': FIXTURE_SEARCH },
        fixtureVideosListByBatch: {
          'video-one,video-two': FIXTURE_VIDEOS_LIST,
        },
      },
    );
    assert.ok(Array.isArray(payload.videos) && payload.videos.length > 0);

    for (const [index, video] of payload.videos.entries()) {
      const signal = youtubeVideoToDigestSignal(video, index + 1);
      const norm = normalizeEngagement(signal);
      assert.ok(
        norm !== null && norm >= 0 && norm <= 100,
        `expected non-null engagement for ${video.title}`,
      );
      assert.equal(signal.sourceMetadata.viewCount, video.viewCount);
      assert.equal(signal.sourceMetadata.likes, video.likeCount);
    }
  });
});

describe('loadYoutubeConfig', () => {
  it('defaults maxVideos, perQuery, and lookback when unset', () => {
    const config = loadYoutubeConfig({
      MORNING_DIGEST_YOUTUBE_API_KEY: 'key',
      MORNING_DIGEST_YOUTUBE_QUERIES: 'agents, llm',
    });
    assert.equal(config.maxVideos, 25);
    assert.equal(config.perQuery, 3);
    assert.equal(config.lookbackHours, 24);
    assert.deepEqual(config.queries, ['agents', 'llm']);
  });

  it('isYoutubeEnabled treats empty as enabled', () => {
    assert.equal(isYoutubeEnabled(undefined), true);
    assert.equal(isYoutubeEnabled('false'), false);
    assert.equal(isYoutubeEnabled('off'), false);
  });
});

describe('enrichVideoStatistics', () => {
  it('batches video ids and merges statistics', async () => {
    const result = await enrichVideoStatistics(
      ['video-one', 'video-two'],
      'test-key',
      async () => {
        throw new Error('should use fixture');
      },
      {
        'video-one,video-two': FIXTURE_VIDEOS_LIST,
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.statsById.get('video-one')?.viewCount, 12500);
  });

  it('searchVideosForQuery uses fixture without network', async () => {
    const result = await searchVideosForQuery(
      'AI agents',
      { apiKey: 'key', perQuery: 3, lookbackHours: 24 },
      async () => {
        throw new Error('no network');
      },
      FIXTURE_SEARCH,
    );
    assert.equal(result.ok, true);
    assert.equal(result.videos.length, 3);
  });

  it('issues a second videos.list call when more than 50 unique ids', async () => {
    const batch1Ids = Array.from({ length: 50 }, (_, index) => `vid-${index + 1}`);
    const batch2Ids = ['vid-51'];
    const allIds = [...batch1Ids, ...batch2Ids];

    /** @param {string[]} ids */
    const videosListFixture = (ids) => ({
      items: ids.map((id) => ({
        id,
        statistics: { viewCount: '100', likeCount: '10', commentCount: '1' },
      })),
    });

    let fetchCallCount = 0;
    const fetchFn = async (url) => {
      fetchCallCount += 1;
      const idParam = new URL(String(url)).searchParams.get('id');
      if (idParam === batch1Ids.join(',')) {
        return {
          ok: true,
          status: 200,
          json: async () => videosListFixture(batch1Ids),
        };
      }
      if (idParam === 'vid-51') {
        return {
          ok: true,
          status: 200,
          json: async () => videosListFixture(batch2Ids),
        };
      }
      throw new Error(`unexpected videos.list batch: ${idParam}`);
    };

    const result = await enrichVideoStatistics(
      allIds,
      'test-key',
      /** @type {typeof fetch} */ (fetchFn),
    );
    assert.equal(result.ok, true);
    assert.equal(fetchCallCount, 2);
    assert.equal(result.statsById.get('vid-51')?.viewCount, 100);
  });

  it('returns quota-exceeded when videos.list hits fatal 403', async () => {
    let fetchCount = 0;
    const fetchFn = async (url) => {
      fetchCount += 1;
      if (String(url).includes('/search?')) {
        return { ok: true, status: 200, json: async () => FIXTURE_SEARCH };
      }
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: { errors: [{ reason: 'quotaExceeded' }] } }),
      };
    };

    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
      },
      { fetch: /** @type {typeof fetch} */ (fetchFn) },
    );
    assert.deepEqual(payload, { error: 'quota-exceeded' });
    assert.ok(fetchCount >= 2, 'expected search.list then videos.list attempt');
  });
});
