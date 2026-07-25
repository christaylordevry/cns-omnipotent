import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  applyQualityFloor,
  classifyYoutubeHttpError,
  dedupeVideosById,
  enrichVideoStatistics,
  estimateYoutubeQuota,
  hoursSincePublish,
  isYoutubeEnabled,
  loadYoutubeConfig,
  mapSearchItem,
  parseSearchOrder,
  parseSearchResponse,
  parseStatCount,
  parseVideosListResponse,
  publishedAfterIso,
  rankVideosByVelocity,
  runYoutubeFetch,
  searchVideosForQuery,
  selectYoutubeVideos,
  viewVelocity,
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

/** Quality-selection fixture: spike short, rising hit, slow absolute pile, junk. */
const FIXTURE_QUALITY_SEARCH = {
  items: [
    {
      id: { kind: 'youtube#video', videoId: 'spike-short' },
      snippet: {
        title: 'Viral short 200 views in 5 min',
        channelTitle: 'Shorts',
        publishedAt: '2026-07-23T11:55:00.000Z',
      },
    },
    {
      id: { kind: 'youtube#video', videoId: 'rising-hit' },
      snippet: {
        title: 'Rising Claude Code tip',
        channelTitle: 'Dev',
        publishedAt: '2026-07-23T08:00:00.000Z',
      },
    },
    {
      id: { kind: 'youtube#video', videoId: 'slow-pile' },
      snippet: {
        title: 'Older high absolute views',
        channelTitle: 'Archive',
        publishedAt: '2026-07-21T12:00:00.000Z',
      },
    },
    {
      id: { kind: 'youtube#video', videoId: 'junk-zero' },
      snippet: {
        title: 'Brand new zero engagement',
        channelTitle: 'Spam',
        publishedAt: '2026-07-23T11:50:00.000Z',
      },
    },
    {
      id: { kind: 'youtube#video', videoId: 'low-likes' },
      snippet: {
        title: 'High views low likes short',
        channelTitle: 'Bait',
        publishedAt: '2026-07-23T06:00:00.000Z',
      },
    },
  ],
};

const FIXTURE_QUALITY_STATS = {
  items: [
    {
      id: 'spike-short',
      statistics: { viewCount: '200', likeCount: '5', commentCount: '0' },
    },
    {
      id: 'rising-hit',
      statistics: { viewCount: '2400', likeCount: '80', commentCount: '12' },
    },
    {
      id: 'slow-pile',
      statistics: { viewCount: '50000', likeCount: '900', commentCount: '100' },
    },
    {
      id: 'junk-zero',
      statistics: { viewCount: '3', likeCount: '0', commentCount: '0' },
    },
    {
      id: 'low-likes',
      statistics: { viewCount: '5000', likeCount: '2', commentCount: '0' },
    },
  ],
};

const NOW_QUALITY = new Date('2026-07-23T12:00:00.000Z');

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

describe('90-3 quality selection helpers', () => {
  it('viewVelocity uses minAgeHours denominator floor', () => {
    // 200 views in 5 minutes → raw age 5/60h; with minAge=1h → vel=200
    const publishedAt = '2026-07-23T11:55:00.000Z';
    assert.equal(hoursSincePublish(publishedAt, NOW_QUALITY), 5 / 60);
    assert.equal(viewVelocity(200, publishedAt, 1 / 60, NOW_QUALITY), 200 / (5 / 60));
    assert.equal(viewVelocity(200, publishedAt, 1, NOW_QUALITY), 200);
  });

  it('applyQualityFloor requires views AND likes', () => {
    const rows = [
      { viewCount: 5000, likeCount: 2 },
      { viewCount: 100, likeCount: 50 },
      { viewCount: 500, likeCount: 10 },
    ];
    const kept = applyQualityFloor(rows, 200, 5);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].viewCount, 500);
  });

  it('rankVideosByVelocity: fresh riser beats stale when velocity is higher', () => {
    const rows = [
      {
        videoId: 'stale',
        viewCount: 3000,
        likeCount: 40,
        publishedAt: '2026-07-21T12:00:00.000Z', // 48h → vel=62.5
      },
      {
        videoId: 'riser',
        viewCount: 2400,
        likeCount: 80,
        publishedAt: '2026-07-23T08:00:00.000Z', // 4h → vel=600
      },
    ];
    const ranked = rankVideosByVelocity(rows, 1, NOW_QUALITY);
    assert.equal(ranked[0].videoId, 'riser');
    assert.equal(ranked[1].videoId, 'stale');
  });

  it('selectYoutubeVideos floors junk and low-likes, keeps top by velocity, truncates keepN', () => {
    const enriched = [
      {
        videoId: 'spike-short',
        viewCount: 200,
        likeCount: 5,
        publishedAt: '2026-07-23T11:55:00.000Z',
      },
      {
        videoId: 'rising-hit',
        viewCount: 2400,
        likeCount: 80,
        publishedAt: '2026-07-23T08:00:00.000Z',
      },
      {
        videoId: 'slow-pile',
        viewCount: 50_000,
        likeCount: 900,
        publishedAt: '2026-07-21T12:00:00.000Z',
      },
      {
        videoId: 'junk-zero',
        viewCount: 3,
        likeCount: 0,
        publishedAt: '2026-07-23T11:50:00.000Z',
      },
      {
        videoId: 'low-likes',
        viewCount: 5000,
        likeCount: 2,
        publishedAt: '2026-07-23T06:00:00.000Z',
      },
    ];
    const selected = selectYoutubeVideos(enriched, {
      minViews: 200,
      minLikes: 5,
      keepN: 2,
      velocityMinAgeHours: 1,
      now: NOW_QUALITY,
    });
    assert.equal(selected.length, 2);
    assert.ok(!selected.some((v) => v.videoId === 'junk-zero'));
    assert.ok(!selected.some((v) => v.videoId === 'low-likes'));
    // slow-pile vel≈1042, rising-hit vel=600, spike-short vel=200 (minAge 1h)
    assert.equal(selected[0].videoId, 'slow-pile');
    assert.equal(selected[1].videoId, 'rising-hit');
  });

  it('selectYoutubeVideos returns empty when floor wipes pool (no velocity-without-floor fallback)', () => {
    const enriched = [
      { videoId: 'a', viewCount: 50, likeCount: 1, publishedAt: '2026-07-23T10:00:00.000Z' },
      { videoId: 'b', viewCount: 10, likeCount: 0, publishedAt: '2026-07-23T11:00:00.000Z' },
    ];
    const selected = selectYoutubeVideos(enriched, {
      minViews: 200,
      minLikes: 5,
      keepN: 12,
      now: NOW_QUALITY,
    });
    assert.deepEqual(selected, []);
  });

  it('estimateYoutubeQuota uses candidates-enriched not keep-N', () => {
    assert.equal(estimateYoutubeQuota(10, 93), 1000 + 2);
    assert.equal(estimateYoutubeQuota(10, 12), 1000 + 1);
    assert.equal(estimateYoutubeQuota(10, 0), 1000);
  });

  it('parseSearchOrder rejects unknown values to date', () => {
    assert.equal(parseSearchOrder('viewCount'), 'viewCount');
    assert.equal(parseSearchOrder('bogus'), 'date');
    assert.equal(parseSearchOrder(undefined), 'date');
  });

  it('fixture reproduces before/after quality lift: date-order vs velocity+floor', () => {
    const enriched = FIXTURE_QUALITY_STATS.items.map((item, index) => {
      const search = FIXTURE_QUALITY_SEARCH.items[index];
      return {
        videoId: item.id,
        viewCount: parseStatCount(item.statistics.viewCount),
        likeCount: parseStatCount(item.statistics.likeCount),
        publishedAt: search.snippet.publishedAt,
      };
    });
    // BEFORE: encounter/date order cap (no floor) — sim shape of old pre-enrich keep.
    const before = enriched.slice(0, 5);
    const after = selectYoutubeVideos(enriched, {
      minViews: 200,
      minLikes: 5,
      keepN: 5,
      velocityMinAgeHours: 1,
      now: NOW_QUALITY,
    });
    const beforeIds = before.map((v) => v.videoId);
    const afterIds = after.map((v) => v.videoId);
    assert.ok(beforeIds.includes('junk-zero'));
    assert.ok(beforeIds.includes('low-likes'));
    assert.ok(!afterIds.includes('junk-zero'));
    assert.ok(!afterIds.includes('low-likes'));
    assert.deepEqual(afterIds, ['slow-pile', 'rising-hit', 'spike-short']);
    const mean = (rows, key) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
    // BEFORE still carries floor-failing junk; AFTER is all floor-passers and higher mean engagement.
    assert.ok(before.some((v) => v.viewCount < 200 || v.likeCount < 5));
    assert.ok(after.every((v) => v.viewCount >= 200 && v.likeCount >= 5));
    assert.ok(mean(after, 'viewCount') > mean(before, 'viewCount'));
    assert.ok(mean(after, 'likeCount') > mean(before, 'likeCount'));
  });

  it('undated and zero-view videos get velocity 0 and rank last', () => {
    const ranked = rankVideosByVelocity(
      [
        { videoId: 'undated', viewCount: 9000, likeCount: 50 },
        { videoId: 'zero', viewCount: 0, likeCount: 0, publishedAt: '2026-07-23T11:00:00.000Z' },
        {
          videoId: 'live',
          viewCount: 400,
          likeCount: 10,
          publishedAt: '2026-07-23T10:00:00.000Z',
        },
      ],
      1,
      NOW_QUALITY,
    );
    assert.equal(ranked[0].videoId, 'live');
    assert.equal(viewVelocity(9000, undefined, 1, NOW_QUALITY), 0);
    assert.equal(viewVelocity(0, '2026-07-23T11:00:00.000Z', 1, NOW_QUALITY), 0);
  });

  it('future publishedAt is untrusted (velocity 0)', () => {
    assert.equal(hoursSincePublish('2026-07-23T13:00:00.000Z', NOW_QUALITY), Number.POSITIVE_INFINITY);
    assert.equal(viewVelocity(5000, '2026-07-23T13:00:00.000Z', 1, NOW_QUALITY), 0);
  });

  it('non-finite viewCount yields velocity 0', () => {
    assert.equal(viewVelocity(Number.NaN, '2026-07-23T10:00:00.000Z', 1, NOW_QUALITY), 0);
    assert.equal(viewVelocity(-10, '2026-07-23T10:00:00.000Z', 1, NOW_QUALITY), 0);
  });

  it('selectYoutubeVideos returns fewer than keepN without padding; undefined keepN → []', () => {
    const enriched = [
      {
        videoId: 'only',
        viewCount: 500,
        likeCount: 10,
        publishedAt: '2026-07-23T08:00:00.000Z',
      },
    ];
    const selected = selectYoutubeVideos(enriched, {
      minViews: 200,
      minLikes: 5,
      keepN: 12,
      now: NOW_QUALITY,
    });
    assert.equal(selected.length, 1);
    assert.equal(selected[0].videoId, 'only');
    const noKeep = selectYoutubeVideos(enriched, {
      minViews: 200,
      minLikes: 5,
      keepN: undefined,
      now: NOW_QUALITY,
    });
    assert.deepEqual(noKeep, []);
  });

  it('parseStatCount treats missing likeCount as 0 (not null)', () => {
    assert.equal(parseStatCount(undefined), 0);
    assert.equal(parseStatCount(null), 0);
    const stats = parseVideosListResponse({
      items: [{ id: 'x', statistics: { viewCount: '300' } }],
    });
    assert.equal(stats.get('x')?.likeCount, 0);
    assert.equal(stats.get('x')?.viewCount, 300);
  });
});

describe('fetch-youtube-signals.mjs runYoutubeFetch', () => {
  it('returns videos from fixtures without network (search + enrich)', async () => {
    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
        MORNING_DIGEST_YOUTUBE_MIN_VIEWS: '0',
        MORNING_DIGEST_YOUTUBE_MIN_LIKES: '0',
      },
      {
        fixtureSearchByQuery: { 'AI agents': FIXTURE_SEARCH },
        fixtureVideosListByBatch: {
          'video-one,video-two': FIXTURE_VIDEOS_LIST,
        },
        now: new Date('2026-06-19T00:00:00.000Z'),
      },
    );
    assert.ok(Array.isArray(payload.videos));
    assert.equal(payload.videos.length, 2);
    assert.equal(payload.videos[0].viewCount, 12500);
    assert.equal(payload.videos[0].url, 'https://www.youtube.com/watch?v=video-one');
  });

  it('enriches full candidate pool then ranks by velocity and applies floor', async () => {
    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'quality',
        MORNING_DIGEST_YOUTUBE_MAX_VIDEOS: '3',
        MORNING_DIGEST_YOUTUBE_MIN_VIEWS: '200',
        MORNING_DIGEST_YOUTUBE_MIN_LIKES: '5',
        MORNING_DIGEST_YOUTUBE_VELOCITY_MIN_AGE_HOURS: '1',
      },
      {
        fixtureSearchByQuery: { quality: FIXTURE_QUALITY_SEARCH },
        fixtureVideosListByBatch: {
          'spike-short,rising-hit,slow-pile,junk-zero,low-likes': FIXTURE_QUALITY_STATS,
        },
        now: NOW_QUALITY,
      },
    );
    assert.ok(Array.isArray(payload.videos));
    // floor drops junk-zero + low-likes; keep 3 of spike/rising/slow
    assert.equal(payload.videos.length, 3);
    const ids = payload.videos.map((v) => new URL(v.url).searchParams.get('v'));
    assert.ok(!ids.includes('junk-zero'));
    assert.ok(!ids.includes('low-likes'));
    assert.equal(ids[0], 'slow-pile');
    assert.equal(ids[1], 'rising-hit');
    assert.equal(ids[2], 'spike-short');
  });

  it('returns empty videos when floor wipes all candidates (precision over recall)', async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => {
      errors.push(args.map(String).join(' '));
    };
    try {
      const payload = await runYoutubeFetch(
        {
          MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
          MORNING_DIGEST_YOUTUBE_QUERIES: 'AI agents',
          MORNING_DIGEST_YOUTUBE_MIN_VIEWS: '999999',
          MORNING_DIGEST_YOUTUBE_MIN_LIKES: '999999',
        },
        {
          fixtureSearchByQuery: { 'AI agents': FIXTURE_SEARCH },
          fixtureVideosListByBatch: {
            'video-one,video-two': FIXTURE_VIDEOS_LIST,
          },
        },
      );
      assert.deepEqual(payload, { videos: [] });
      assert.ok(
        errors.some((line) =>
          line.includes('quality-floor-wiped: 2 candidates enriched, 0 cleared floor'),
        ),
        `expected loud floor-wipe stderr, got: ${JSON.stringify(errors)}`,
      );
    } finally {
      console.error = originalError;
    }
  });

  it('candidateMax bounds how many ids are enriched', async () => {
    const wideSearch = {
      items: Array.from({ length: 5 }, (_, index) => ({
        id: { kind: 'youtube#video', videoId: `cap-${index + 1}` },
        snippet: {
          title: `Cap video ${index + 1}`,
          channelTitle: 'Cap',
          publishedAt: `2026-07-23T0${index}:00:00.000Z`,
        },
      })),
    };
    let enrichBatchKey = '';
    const payload = await runYoutubeFetch(
      {
        MORNING_DIGEST_YOUTUBE_API_KEY: 'test-key',
        MORNING_DIGEST_YOUTUBE_QUERIES: 'cap',
        MORNING_DIGEST_YOUTUBE_CANDIDATE_MAX: '2',
        MORNING_DIGEST_YOUTUBE_MIN_VIEWS: '0',
        MORNING_DIGEST_YOUTUBE_MIN_LIKES: '0',
        MORNING_DIGEST_YOUTUBE_MAX_VIDEOS: '12',
      },
      {
        fixtureSearchByQuery: { cap: wideSearch },
        fixtureVideosListByBatch: new Proxy(
          {},
          {
            has(_target, key) {
              enrichBatchKey = String(key);
              return key === 'cap-1,cap-2';
            },
            get(_target, key) {
              if (key === 'cap-1,cap-2') {
                return {
                  items: [
                    {
                      id: 'cap-1',
                      statistics: { viewCount: '100', likeCount: '10', commentCount: '1' },
                    },
                    {
                      id: 'cap-2',
                      statistics: { viewCount: '200', likeCount: '20', commentCount: '2' },
                    },
                  ],
                };
              }
              return undefined;
            },
          },
        ),
        now: NOW_QUALITY,
      },
    );
    assert.ok(Array.isArray(payload.videos));
    assert.equal(payload.videos.length, 2);
    assert.equal(enrichBatchKey, 'cap-1,cap-2');
    assert.equal(dedupeVideosById(parseSearchResponse(wideSearch, 10), 2).length, 2);
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
        MORNING_DIGEST_YOUTUBE_MIN_VIEWS: '0',
        MORNING_DIGEST_YOUTUBE_MIN_LIKES: '0',
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
        MORNING_DIGEST_YOUTUBE_MIN_VIEWS: '0',
        MORNING_DIGEST_YOUTUBE_MIN_LIKES: '0',
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
  it('defaults keep-N, perQuery, lookback, floor, candidateMax, velocity min-age when unset', () => {
    const config = loadYoutubeConfig({
      MORNING_DIGEST_YOUTUBE_API_KEY: 'key',
      MORNING_DIGEST_YOUTUBE_QUERIES: 'agents, llm',
    });
    assert.equal(config.maxVideos, 12);
    assert.equal(config.perQuery, 10);
    assert.equal(config.lookbackHours, 72);
    assert.equal(config.candidateMax, 100);
    assert.equal(config.minViews, 200);
    assert.equal(config.minLikes, 5);
    assert.equal(config.searchOrder, 'date');
    assert.equal(config.velocityMinAgeHours, 1);
    assert.deepEqual(config.queries, ['agents', 'llm']);
  });

  it('clamps perQuery to 50 and lookbackHours to 720', () => {
    const config = loadYoutubeConfig({
      MORNING_DIGEST_YOUTUBE_API_KEY: 'key',
      MORNING_DIGEST_YOUTUBE_QUERIES: 'x',
      MORNING_DIGEST_YOUTUBE_PER_QUERY: '999',
      MORNING_DIGEST_YOUTUBE_LOOKBACK_HOURS: '99999',
    });
    assert.equal(config.perQuery, 50);
    assert.equal(config.lookbackHours, 720);
    // Safe Date under clamp
    assert.ok(Number.isFinite(Date.parse(publishedAfterIso(config.lookbackHours, NOW_QUALITY))));
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
