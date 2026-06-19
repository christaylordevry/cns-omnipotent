// fetch-youtube-signals.mjs — YouTube Data API v3 for morning-digest Source 13
// Usage: node fetch-youtube-signals.mjs
// stdout: {"videos":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const FETCH_TIMEOUT_MS = 15_000;
const SEARCH_DELAY_MS = 100;
const MAX_VIDEOS_DEFAULT = 25;
const MAX_VIDEOS_HARD = 50;
const PER_QUERY_DEFAULT = 3;
const LOOKBACK_HOURS_DEFAULT = 24;
const QUOTA_WARN_THRESHOLD = 2000;
const VIDEOS_LIST_BATCH_SIZE = 50;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isYoutubeEnabled(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) {
    return true;
  }
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseYoutubeQueries(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   apiKey?: string,
 *   queries: string[],
 *   maxVideos: number,
 *   perQuery: number,
 *   lookbackHours: number,
 * }}
 */
export function loadYoutubeConfig(env = process.env) {
  const enabled = isYoutubeEnabled(env.MORNING_DIGEST_YOUTUBE_ENABLED);
  const apiKey = String(env.MORNING_DIGEST_YOUTUBE_API_KEY ?? '').trim() || undefined;
  const queries = parseYoutubeQueries(env.MORNING_DIGEST_YOUTUBE_QUERIES);
  const rawMax = parseInt(String(env.MORNING_DIGEST_YOUTUBE_MAX_VIDEOS ?? ''), 10);
  const rawPerQuery = parseInt(String(env.MORNING_DIGEST_YOUTUBE_PER_QUERY ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_YOUTUBE_LOOKBACK_HOURS ?? ''), 10);
  const maxVideos =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_VIDEOS_HARD) : MAX_VIDEOS_DEFAULT;
  const perQuery = Number.isFinite(rawPerQuery) && rawPerQuery > 0 ? rawPerQuery : PER_QUERY_DEFAULT;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  return { enabled, apiKey, queries, maxVideos, perQuery, lookbackHours };
}

/**
 * @param {Date} [now]
 * @param {number} lookbackHours
 * @returns {string}
 */
export function publishedAfterIso(lookbackHours, now = new Date()) {
  const cutoff = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  return cutoff.toISOString();
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function parseStatCount(value) {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @param {unknown} item
 * @returns {{ videoId: string, title: string, channelTitle: string, publishedAt?: string } | null}
 */
export function mapSearchItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const id = row.id;
  const snippet = row.snippet;
  if (!id || typeof id !== 'object' || !snippet || typeof snippet !== 'object') {
    return null;
  }
  const idRow = /** @type {{ videoId?: unknown }} */ (id);
  const snippetRow = /** @type {{ title?: unknown, channelTitle?: unknown, publishedAt?: unknown }} */ (
    snippet
  );
  const videoId = String(idRow.videoId ?? '').trim();
  const title = String(snippetRow.title ?? '').trim();
  const channelTitle = String(snippetRow.channelTitle ?? '').trim();
  if (!videoId || !title) {
    return null;
  }
  const publishedAt =
    snippetRow.publishedAt != null ? String(snippetRow.publishedAt) : undefined;
  return {
    videoId,
    title,
    channelTitle,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @param {number} perQuery
 * @returns {Array<{ videoId: string, title: string, channelTitle: string, publishedAt?: string }>}
 */
export function parseSearchResponse(json, perQuery) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const items = /** @type {{ items?: unknown[] }} */ (json).items;
  if (!Array.isArray(items)) {
    return [];
  }
  /** @type {Array<{ videoId: string, title: string, channelTitle: string, publishedAt?: string }>} */
  const videos = [];
  for (const item of items) {
    if (videos.length >= perQuery) {
      break;
    }
    const mapped = mapSearchItem(item);
    if (mapped) {
      videos.push(mapped);
    }
  }
  return videos;
}

/**
 * @param {Response} res
 * @param {unknown} json
 * @returns {string}
 */
export function classifyYoutubeHttpError(res, json) {
  const errors =
    json && typeof json === 'object'
      ? /** @type {{ error?: { errors?: Array<{ reason?: string }> } }} */ (json).error?.errors
      : undefined;
  const reason = Array.isArray(errors) ? String(errors[0]?.reason ?? '') : '';
  if (reason === 'quotaExceeded') {
    return 'quota-exceeded';
  }
  if (res.status === 403) {
    return 'http-403';
  }
  return `http-${res.status}`;
}

/**
 * @param {string} query
 * @param {{
 *   apiKey: string,
 *   perQuery: number,
 *   lookbackHours: number,
 *   now?: Date,
 * }} config
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<
 *   | { ok: true, videos: ReturnType<typeof parseSearchResponse> }
 *   | { ok: false, reason: string, fatal?: boolean }
 * >}
 */
export async function searchVideosForQuery(query, config, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    return { ok: true, videos: parseSearchResponse(fixtureJson, config.perQuery) };
  }

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'date',
    publishedAfter: publishedAfterIso(config.lookbackHours, config.now),
    maxResults: String(config.perQuery),
    key: config.apiKey,
  });
  const url = `${YOUTUBE_API_BASE}/search?${params.toString()}`;

  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) {
      const reason = classifyYoutubeHttpError(res, json);
      const fatal = reason === 'quota-exceeded' || reason === 'http-403';
      return { ok: false, reason, fatal };
    }
    return { ok: true, videos: parseSearchResponse(json, config.perQuery) };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {unknown} item
 * @returns {{ viewCount: number, likeCount: number, commentCount: number } | null}
 */
export function mapVideoStatistics(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {{ statistics?: unknown }} */ (item);
  const statistics = row.statistics;
  if (!statistics || typeof statistics !== 'object') {
    return null;
  }
  const stats = /** @type {{ viewCount?: unknown, likeCount?: unknown, commentCount?: unknown }} */ (
    statistics
  );
  return {
    viewCount: parseStatCount(stats.viewCount),
    likeCount: parseStatCount(stats.likeCount),
    commentCount: parseStatCount(stats.commentCount),
  };
}

/**
 * @param {unknown} json
 * @returns {Map<string, { viewCount: number, likeCount: number, commentCount: number }>}
 */
export function parseVideosListResponse(json) {
  /** @type {Map<string, { viewCount: number, likeCount: number, commentCount: number }>} */
  const statsById = new Map();
  if (!json || typeof json !== 'object') {
    return statsById;
  }
  const items = /** @type {{ items?: unknown[] }} */ (json).items;
  if (!Array.isArray(items)) {
    return statsById;
  }
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const id = String(/** @type {{ id?: unknown }} */ (item).id ?? '').trim();
    if (!id) {
      continue;
    }
    const stats = mapVideoStatistics(item);
    if (stats) {
      statsById.set(id, stats);
    }
  }
  return statsById;
}

/**
 * @param {string[]} videoIds
 * @param {string} apiKey
 * @param {typeof fetch} fetchFn
 * @param {Record<string, unknown>} [fixtureByBatch]
 * @returns {Promise<
 *   | { ok: true, statsById: Map<string, { viewCount: number, likeCount: number, commentCount: number }> }
 *   | { ok: false, reason: string, fatal?: boolean }
 * >}
 */
export async function enrichVideoStatistics(videoIds, apiKey, fetchFn, fixtureByBatch) {
  /** @type {Map<string, { viewCount: number, likeCount: number, commentCount: number }>} */
  const statsById = new Map();

  for (let offset = 0; offset < videoIds.length; offset += VIDEOS_LIST_BATCH_SIZE) {
    const batch = videoIds.slice(offset, offset + VIDEOS_LIST_BATCH_SIZE);
    if (batch.length === 0) {
      continue;
    }

    const fixtureKey = batch.join(',');
    if (fixtureByBatch && fixtureKey in fixtureByBatch) {
      const batchStats = parseVideosListResponse(fixtureByBatch[fixtureKey]);
      for (const [id, stats] of batchStats) {
        statsById.set(id, stats);
      }
      continue;
    }

    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: batch.join(','),
      key: apiKey,
    });
    const url = `${YOUTUBE_API_BASE}/videos?${params.toString()}`;

    try {
      const res = await fetchFn(url, {
        signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) {
        const reason = classifyYoutubeHttpError(res, json);
        const fatal = reason === 'quota-exceeded' || reason === 'http-403';
        return { ok: false, reason, fatal };
      }
      const batchStats = parseVideosListResponse(json);
      for (const [id, stats] of batchStats) {
        statsById.set(id, stats);
      }
    } catch (err) {
      const name =
        err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
      return { ok: false, reason: name };
    }
  }

  return { ok: true, statsById };
}

/**
 * @param {string} videoId
 * @returns {string}
 */
export function buildYoutubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * @param {Array<{ videoId: string, title: string, channelTitle: string, publishedAt?: string }>} candidates
 * @param {number} maxVideos
 * @returns {Array<{ videoId: string, title: string, channelTitle: string, publishedAt?: string }>}
 */
export function dedupeVideosById(candidates, maxVideos) {
  const seen = new Set();
  /** @type {Array<{ videoId: string, title: string, channelTitle: string, publishedAt?: string }>} */
  const videos = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.videoId)) {
      continue;
    }
    seen.add(candidate.videoId);
    videos.push(candidate);
    if (videos.length >= maxVideos) {
      break;
    }
  }
  return videos;
}

/**
 * @param {{
 *   videoId: string,
 *   title: string,
 *   channelTitle: string,
 *   publishedAt?: string,
 *   viewCount: number,
 *   likeCount: number,
 *   commentCount: number,
 * }} row
 * @returns {{
 *   title: string,
 *   url: string,
 *   channelTitle: string,
 *   publishedAt?: string,
 *   viewCount: number,
 *   likeCount: number,
 *   commentCount: number,
 * }}
 */
export function toStdoutVideo(row) {
  return {
    title: row.title,
    url: buildYoutubeWatchUrl(row.videoId),
    channelTitle: row.channelTitle,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
  };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtureSearchByQuery?: Record<string, unknown>,
 *   fixtureVideosListByBatch?: Record<string, unknown>,
 *   now?: Date,
 * }} [options]
 * @returns {Promise<{ videos?: unknown[], error?: string }>}
 */
export async function runYoutubeFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadYoutubeConfig(env);

  if (!config.enabled) {
    return { error: 'youtube disabled' };
  }
  if (!config.apiKey) {
    return { error: 'missing-api-key' };
  }
  if (config.queries.length === 0) {
    return { error: 'missing-queries' };
  }

  const estimatedQuota = config.queries.length * 100 + config.maxVideos;
  if (estimatedQuota > QUOTA_WARN_THRESHOLD) {
    console.error(
      `youtube quota warning: estimated ${estimatedQuota} units (queries=${config.queries.length}, maxVideos=${config.maxVideos})`,
    );
  }

  /** @type {Array<{ videoId: string, title: string, channelTitle: string, publishedAt?: string }>} */
  const searchHits = [];
  let sawSearchSuccess = false;

  for (let index = 0; index < config.queries.length; index += 1) {
    const query = config.queries[index];
    if (index > 0) {
      await delayMs(SEARCH_DELAY_MS);
    }

    const fixture = options.fixtureSearchByQuery?.[query];
    const result = await searchVideosForQuery(
      query,
      {
        apiKey: config.apiKey,
        perQuery: config.perQuery,
        lookbackHours: config.lookbackHours,
        now: options.now,
      },
      fetchFn,
      fixture,
    );

    if (!result.ok) {
      if (result.fatal) {
        return { error: result.reason };
      }
      console.error(`youtube search failed for "${query}": ${result.reason}`);
      continue;
    }

    if (result.videos.length > 0) {
      sawSearchSuccess = true;
      searchHits.push(...result.videos);
    }
  }

  const deduped = dedupeVideosById(searchHits, config.maxVideos);
  if (!sawSearchSuccess || deduped.length === 0) {
    return { error: 'youtube fetch failed' };
  }

  const enrichResult = await enrichVideoStatistics(
    deduped.map((row) => row.videoId),
    config.apiKey,
    fetchFn,
    options.fixtureVideosListByBatch,
  );
  if (!enrichResult.ok) {
    return { error: enrichResult.reason };
  }

  const videos = deduped.map((row) => {
    const stats = enrichResult.statsById.get(row.videoId) ?? {
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    };
    return toStdoutVideo({ ...row, ...stats });
  });

  return { videos };
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === entry;
}

if (isMainModule()) {
  try {
    const merged = await mergeTrendIngestEnv(process.env);
    const payload = await runYoutubeFetch(merged);
    process.stdout.write(JSON.stringify(payload) + '\n');
    process.exit(0);
  } catch (err) {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'unexpected error';
    process.stdout.write(JSON.stringify({ error: reason }) + '\n');
    process.exit(0);
  }
}
