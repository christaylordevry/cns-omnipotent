// fetch-tiktok-signals.mjs — ScrapeCreators TikTok for morning-digest Source 14
// Usage: node fetch-tiktok-signals.mjs
// stdout: {"videos":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath, URL } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const SCRAPECREATORS_API_BASE = 'https://api.scrapecreators.com';
const FETCH_TIMEOUT_MS = 15_000;
const HASHTAG_DELAY_MS = 100;
const MAX_VIDEOS_DEFAULT = 20;
const MAX_VIDEOS_HARD = 40;
const PER_HASHTAG_DEFAULT = 5;
const LOOKBACK_HOURS_DEFAULT = 24;
const CREDIT_WARN_THRESHOLD = 50;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isTiktokEnabled(value) {
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
export function parseTiktokHashtags(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^#+/, ''))
    .filter(Boolean);
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
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   apiKey?: string,
 *   hashtags: string[],
 *   region: string,
 *   maxVideos: number,
 *   perHashtag: number,
 *   lookbackHours: number,
 * }}
 */
export function loadTiktokConfig(env = process.env) {
  const enabled = isTiktokEnabled(env.MORNING_DIGEST_TIKTOK_ENABLED);
  const apiKey = String(env.SCRAPECREATORS_API_KEY ?? '').trim() || undefined;
  const hashtags = parseTiktokHashtags(env.MORNING_DIGEST_TIKTOK_HASHTAGS);
  const region = String(env.MORNING_DIGEST_TIKTOK_REGION ?? 'US').trim() || 'US';
  const rawMax = parseInt(String(env.MORNING_DIGEST_TIKTOK_MAX_VIDEOS ?? ''), 10);
  const rawPerHashtag = parseInt(String(env.MORNING_DIGEST_TIKTOK_PER_HASHTAG ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_TIKTOK_LOOKBACK_HOURS ?? ''), 10);
  const maxVideos =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_VIDEOS_HARD) : MAX_VIDEOS_DEFAULT;
  const perHashtag =
    Number.isFinite(rawPerHashtag) && rawPerHashtag > 0 ? rawPerHashtag : PER_HASHTAG_DEFAULT;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  return { enabled, apiKey, hashtags, region, maxVideos, perHashtag, lookbackHours };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * @param {{ aweme_id?: unknown, url?: unknown }} row
 * @returns {string | null}
 */
export function tiktokDedupeKey(row) {
  const id = String(row.aweme_id ?? '').trim();
  if (id) {
    return `tt:${id}`;
  }
  const url = normalizeUrl(row.url);
  return url ? `tt:url:${url}` : null;
}

/**
 * @param {unknown} item
 * @returns {{
 *   aweme_id: string,
 *   title: string,
 *   author: string,
 *   url: string,
 *   publishedAt?: string,
 *   viewCount: number,
 *   likeCount: number,
 *   commentCount: number,
 * } | null}
 */
export function mapAwemeItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const awemeId = String(row.aweme_id ?? row.awemeId ?? '').trim();
  const desc = String(row.desc ?? row.title ?? '').trim();
  if (!awemeId && !desc) {
    return null;
  }

  const statistics =
    row.statistics && typeof row.statistics === 'object'
      ? /** @type {Record<string, unknown>} */ (row.statistics)
      : {};
  const authorRow =
    row.author && typeof row.author === 'object'
      ? /** @type {Record<string, unknown>} */ (row.author)
      : {};
  const uniqueId = String(authorRow.unique_id ?? authorRow.uniqueId ?? '').trim();
  const shareUrl = normalizeUrl(row.share_url ?? row.shareUrl);
  const url =
    awemeId && uniqueId
      ? `https://www.tiktok.com/@${uniqueId}/video/${awemeId}`
      : shareUrl || (awemeId ? `https://www.tiktok.com/video/${awemeId}` : '');

  if (!url && !desc) {
    return null;
  }

  const createTime = row.create_time ?? row.createTime;
  let publishedAt;
  if (createTime != null) {
    const asNum = Number(createTime);
    if (Number.isFinite(asNum) && asNum > 0) {
      publishedAt = new Date(asNum * 1000).toISOString();
    } else {
      const asStr = String(createTime).trim();
      if (asStr) {
        publishedAt = asStr;
      }
    }
  }

  return {
    aweme_id: awemeId || url,
    title: desc || `TikTok video ${awemeId}`,
    author: uniqueId || 'unknown',
    url: url || `https://www.tiktok.com/`,
    viewCount: parseStatCount(statistics.play_count ?? statistics.playCount),
    likeCount: parseStatCount(statistics.digg_count ?? statistics.diggCount),
    commentCount: parseStatCount(statistics.comment_count ?? statistics.commentCount),
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @param {number} perHashtag
 * @returns {ReturnType<typeof mapAwemeItem>[]}
 */
export function parseHashtagResponse(json, perHashtag) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const row = /** @type {Record<string, unknown>} */ (json);
  const list = row.aweme_list ?? row.awemeList ?? row.videos ?? row.items;
  if (!Array.isArray(list)) {
    return [];
  }
  /** @type {ReturnType<typeof mapAwemeItem>[]} */
  const videos = [];
  for (const item of list) {
    if (videos.length >= perHashtag) {
      break;
    }
    const mapped = mapAwemeItem(item);
    if (mapped) {
      videos.push(mapped);
    }
  }
  return videos;
}

/**
 * @param {Date} now
 * @param {number} lookbackHours
 * @returns {boolean}
 */
export function isWithinLookback(publishedAt, lookbackHours, now = new Date()) {
  if (!publishedAt) {
    return true;
  }
  const ms = Date.parse(String(publishedAt));
  if (Number.isNaN(ms)) {
    return true;
  }
  const cutoff = now.getTime() - lookbackHours * 60 * 60 * 1000;
  return ms >= cutoff;
}

/**
 * @param {Response} res
 * @param {unknown} json
 * @returns {string}
 */
export function classifyScrapeCreatorsHttpError(res, json) {
  const body =
    json && typeof json === 'object'
      ? /** @type {Record<string, unknown>} */ (json)
      : {};
  const message = String(body.message ?? body.error ?? '').toLowerCase();
  if (message.includes('credit') || message.includes('quota') || message.includes('balance')) {
    return 'credit-exhausted';
  }
  if (res.status === 402) {
    return 'credit-exhausted';
  }
  if (res.status === 401) {
    return 'http-401';
  }
  if (res.status === 403) {
    return 'http-403';
  }
  return `http-${res.status}`;
}

/**
 * @param {string} path
 * @param {Record<string, string>} params
 * @param {string} apiKey
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<
 *   | { ok: true, videos: ReturnType<typeof parseHashtagResponse> }
 *   | { ok: false, reason: string, fatal?: boolean }
 * >}
 */
export async function fetchScrapeCreators(path, params, apiKey, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    const perHashtag = parseInt(String(params.perHashtag ?? PER_HASHTAG_DEFAULT), 10);
    return { ok: true, videos: parseHashtagResponse(fixtureJson, perHashtag) };
  }

  const searchParams = new URLSearchParams({ ...params, trim: 'true' });
  delete searchParams.perHashtag;
  const url = `${SCRAPECREATORS_API_BASE}${path}?${searchParams.toString()}`;

  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      const reason = classifyScrapeCreatorsHttpError(res, json);
      const fatal = reason === 'credit-exhausted' || reason === 'http-401' || reason === 'http-403';
      return { ok: false, reason, fatal };
    }
    const perHashtag = parseInt(String(params.perHashtag ?? PER_HASHTAG_DEFAULT), 10);
    return { ok: true, videos: parseHashtagResponse(json, perHashtag) };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {ReturnType<typeof mapAwemeItem>[]} candidates
 * @param {number} maxVideos
 * @param {number} lookbackHours
 * @param {Date} [now]
 * @returns {Array<{
 *   title: string,
 *   url: string,
 *   author: string,
 *   publishedAt?: string,
 *   viewCount: number,
 *   likeCount: number,
 *   commentCount: number,
 * }>}
 */
export function dedupeAndFilterVideos(candidates, maxVideos, lookbackHours, now = new Date()) {
  const seen = new Set();
  /** @type {Array<{
 *   title: string,
 *   url: string,
 *   author: string,
 *   publishedAt?: string,
 *   viewCount: number,
 *   likeCount: number,
 *   commentCount: number,
 * }>} */
  const videos = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!isWithinLookback(candidate.publishedAt, lookbackHours, now)) {
      continue;
    }
    const key = tiktokDedupeKey(candidate);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    videos.push({
      title: candidate.title,
      url: candidate.url,
      author: candidate.author,
      viewCount: candidate.viewCount,
      likeCount: candidate.likeCount,
      commentCount: candidate.commentCount,
      ...(candidate.publishedAt ? { publishedAt: candidate.publishedAt } : {}),
    });
    if (videos.length >= maxVideos) {
      break;
    }
  }
  return videos;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtureHashtagByTag?: Record<string, unknown>,
 *   fixtureTrending?: unknown,
 *   now?: Date,
 * }} [options]
 * @returns {Promise<{ videos?: unknown[], error?: string }>}
 */
export async function runTiktokFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadTiktokConfig(env);

  if (!config.enabled) {
    return { error: 'tiktok disabled' };
  }
  if (!config.apiKey) {
    return { error: 'missing-api-key' };
  }

  const useTrendingFallback = config.hashtags.length === 0;
  if (!useTrendingFallback && config.hashtags.length === 0) {
    return { error: 'missing-hashtags' };
  }

  const estimatedCredits = useTrendingFallback
    ? 1
    : config.hashtags.length;
  if (estimatedCredits > CREDIT_WARN_THRESHOLD) {
    console.error(
      `tiktok credit warning: estimated ${estimatedCredits} API calls (hashtags=${config.hashtags.length})`,
    );
  }

  /** @type {ReturnType<typeof mapAwemeItem>[]} */
  const collected = [];
  let sawSuccess = false;

  if (useTrendingFallback) {
    const result = await fetchScrapeCreators(
      '/v1/tiktok/get-trending-feed',
      { region: config.region, perHashtag: String(config.maxVideos) },
      config.apiKey,
      fetchFn,
      options.fixtureTrending,
    );
    if (!result.ok) {
      return { error: result.reason };
    }
    if (result.videos.length > 0) {
      sawSuccess = true;
      collected.push(...result.videos);
    }
  } else {
    for (let index = 0; index < config.hashtags.length; index += 1) {
      const hashtag = config.hashtags[index];
      if (index > 0) {
        await delayMs(HASHTAG_DELAY_MS);
      }
      const fixture = options.fixtureHashtagByTag?.[hashtag];
      const result = await fetchScrapeCreators(
        '/v1/tiktok/search/hashtag',
        {
          hashtag,
          region: config.region,
          perHashtag: String(config.perHashtag),
        },
        config.apiKey,
        fetchFn,
        fixture,
      );
      if (!result.ok) {
        if (result.fatal) {
          return { error: result.reason };
        }
        console.error(`tiktok hashtag search failed for "${hashtag}": ${result.reason}`);
        continue;
      }
      if (result.videos.length > 0) {
        sawSuccess = true;
        collected.push(...result.videos);
      }
    }
  }

  const videos = dedupeAndFilterVideos(
    collected,
    config.maxVideos,
    config.lookbackHours,
    options.now,
  );

  if (!sawSuccess) {
    return { error: 'tiktok fetch failed' };
  }

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
    const payload = await runTiktokFetch(merged);
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
