// fetch-instagram-signals.mjs — ScrapeCreators Instagram for morning-digest Source 15
//
// FRESHNESS: Instagram hashtag search uses ScrapeCreators' Google-index-backed
// search/hashtag endpoint. Results reflect what Google has indexed, NOT a live
// Instagram-native feed. Sparse or stale results on a given day are expected.
//
// Usage: node fetch-instagram-signals.mjs
// stdout: {"reels":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath, URL } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const SCRAPECREATORS_API_BASE = 'https://api.scrapecreators.com';
const FETCH_TIMEOUT_MS = 15_000;
const HASHTAG_DELAY_MS = 100;
const MAX_REELS_DEFAULT = 15;
const PER_HASHTAG_DEFAULT = 5;
const LOOKBACK_HOURS_DEFAULT = 168;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isInstagramEnabled(value) {
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
export function parseInstagramHashtags(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^#+/, ''))
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTruthyEnv(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) {
    return true;
  }
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
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
 *   maxReels: number,
 *   perHashtag: number,
 *   includeTrending: boolean,
 *   lookbackHours: number,
 *   mediaType: string,
 * }}
 */
export function loadInstagramConfig(env = process.env) {
  const enabled = isInstagramEnabled(env.MORNING_DIGEST_INSTAGRAM_ENABLED);
  const apiKey = String(env.SCRAPECREATORS_API_KEY ?? '').trim() || undefined;
  const hashtags = parseInstagramHashtags(env.MORNING_DIGEST_INSTAGRAM_HASHTAGS);
  const rawMax = parseInt(String(env.MORNING_DIGEST_INSTAGRAM_MAX_REELS ?? ''), 10);
  const rawPerHashtag = parseInt(String(env.MORNING_DIGEST_INSTAGRAM_PER_HASHTAG ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_INSTAGRAM_LOOKBACK_HOURS ?? ''), 10);
  const maxReels = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : MAX_REELS_DEFAULT;
  const perHashtag =
    Number.isFinite(rawPerHashtag) && rawPerHashtag > 0 ? rawPerHashtag : PER_HASHTAG_DEFAULT;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  const includeTrending = isTruthyEnv(env.MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING);
  const mediaTypeRaw = String(env.MORNING_DIGEST_INSTAGRAM_MEDIA_TYPE ?? 'reels').trim().toLowerCase();
  const mediaType = mediaTypeRaw === 'all' ? 'all' : 'reels';
  return { enabled, apiKey, hashtags, maxReels, perHashtag, includeTrending, lookbackHours, mediaType };
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
 * @param {{ shortcode?: unknown, url?: unknown }} row
 * @returns {string | null}
 */
export function reelDedupeKey(row) {
  const shortcode = String(row.shortcode ?? '').trim();
  if (shortcode) {
    return `ig:reel:${shortcode}`;
  }
  const url = normalizeUrl(row.url);
  return url ? `ig:url:${url}` : null;
}

/**
 * @param {unknown} caption
 * @returns {string}
 */
export function extractCaptionText(caption) {
  if (typeof caption === 'string') {
    return caption.trim();
  }
  if (caption && typeof caption === 'object') {
    const row = /** @type {Record<string, unknown>} */ (caption);
    return String(row.text ?? row.caption ?? '').trim();
  }
  return '';
}

/**
 * @param {unknown} item
 * @returns {{
 *   shortcode: string,
 *   title: string,
 *   author: string,
 *   url: string,
 *   publishedAt?: string,
 *   viewCount: number,
 *   likeCount: number,
 *   commentCount: number,
 * } | null}
 */
export function mapReelItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const shortcode = String(row.shortcode ?? row.code ?? '').trim();
  const title = extractCaptionText(row.caption ?? row.title ?? row.desc);
  if (!shortcode && !title) {
    return null;
  }

  const owner =
    row.owner && typeof row.owner === 'object'
      ? /** @type {Record<string, unknown>} */ (row.owner)
      : row.user && typeof row.user === 'object'
        ? /** @type {Record<string, unknown>} */ (row.user)
        : {};
  const author = String(owner.username ?? owner.handle ?? row.author ?? '').trim() || 'unknown';

  const url =
    normalizeUrl(row.url ?? row.permalink) ||
    (shortcode ? `https://www.instagram.com/reel/${shortcode}/` : '');

  const viewCount = parseStatCount(
    row.play_count ?? row.playCount ?? row.view_count ?? row.viewCount ?? row.video_view_count,
  );
  const likeCount = parseStatCount(row.like_count ?? row.likeCount ?? row.likes);
  const commentCount = parseStatCount(row.comment_count ?? row.commentCount ?? row.comments);

  let publishedAt;
  const takenAt = row.taken_at ?? row.takenAt ?? row.timestamp ?? row.publishedAt;
  if (takenAt != null) {
    const asNum = Number(takenAt);
    if (Number.isFinite(asNum) && asNum > 0) {
      publishedAt = new Date(asNum * 1000).toISOString();
    } else {
      const asStr = String(takenAt).trim();
      if (asStr) {
        publishedAt = asStr;
      }
    }
  }

  return {
    shortcode: shortcode || url,
    title: title || `Instagram reel ${shortcode}`,
    author,
    url: url || `https://www.instagram.com/`,
    viewCount,
    likeCount,
    commentCount,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @param {number} perHashtag
 * @returns {ReturnType<typeof mapReelItem>[]}
 */
export function parseHashtagResponse(json, perHashtag) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const row = /** @type {Record<string, unknown>} */ (json);
  const list = row.items ?? row.reels ?? row.posts ?? row.results ?? row.data;
  const items = Array.isArray(list) ? list : Array.isArray(json) ? json : [];
  /** @type {ReturnType<typeof mapReelItem>[]} */
  const reels = [];
  for (const item of items) {
    if (reels.length >= perHashtag) {
      break;
    }
    const mapped = mapReelItem(item);
    if (mapped) {
      reels.push(mapped);
    }
  }
  return reels;
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
 *   | { ok: true, reels: ReturnType<typeof parseHashtagResponse> }
 *   | { ok: false, reason: string, fatal?: boolean }
 * >}
 */
export async function fetchScrapeCreators(path, params, apiKey, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    const perHashtag = parseInt(String(params.perHashtag ?? PER_HASHTAG_DEFAULT), 10);
    return { ok: true, reels: parseHashtagResponse(fixtureJson, perHashtag) };
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
    return { ok: true, reels: parseHashtagResponse(json, perHashtag) };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {ReturnType<typeof mapReelItem>[]} candidates
 * @param {number} maxReels
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
export function dedupeAndFilterReels(candidates, maxReels, lookbackHours, now = new Date()) {
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
  const reels = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!isWithinLookback(candidate.publishedAt, lookbackHours, now)) {
      continue;
    }
    const key = reelDedupeKey(candidate);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    reels.push({
      title: candidate.title,
      url: candidate.url,
      author: candidate.author,
      viewCount: candidate.viewCount,
      likeCount: candidate.likeCount,
      commentCount: candidate.commentCount,
      ...(candidate.publishedAt ? { publishedAt: candidate.publishedAt } : {}),
    });
    if (reels.length >= maxReels) {
      break;
    }
  }
  return reels;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtureHashtagByTag?: Record<string, unknown>,
 *   fixtureTrending?: unknown,
 *   now?: Date,
 * }} [options]
 * @returns {Promise<{ reels?: unknown[], error?: string }>}
 */
export async function runInstagramFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadInstagramConfig(env);

  if (!config.enabled) {
    return { error: 'instagram disabled' };
  }
  if (!config.apiKey) {
    return { error: 'missing-api-key' };
  }
  if (config.hashtags.length === 0 && !config.includeTrending) {
    return { error: 'missing-hashtags' };
  }

  /** @type {ReturnType<typeof mapReelItem>[]} */
  const collected = [];
  let sawSuccess = false;

  for (let index = 0; index < config.hashtags.length; index += 1) {
    const hashtag = config.hashtags[index];
    if (index > 0) {
      await delayMs(HASHTAG_DELAY_MS);
    }
    const fixture = options.fixtureHashtagByTag?.[hashtag];
    const result = await fetchScrapeCreators(
      '/v1/instagram/search/hashtag',
      {
        hashtag,
        date_posted: 'last-week',
        media_type: config.mediaType,
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
      console.error(`instagram hashtag search failed for "${hashtag}": ${result.reason}`);
      continue;
    }
    sawSuccess = true;
    collected.push(...result.reels);
  }

  if (config.includeTrending) {
    const trendingResult = await fetchScrapeCreators(
      '/v1/instagram/reels/trending',
      { perHashtag: String(config.maxReels) },
      config.apiKey,
      fetchFn,
      options.fixtureTrending,
    );
    if (trendingResult.ok) {
      sawSuccess = true;
      collected.push(...trendingResult.reels);
    } else if (!trendingResult.fatal) {
      console.error(`instagram trending reels failed: ${trendingResult.reason}`);
    } else if (collected.length === 0) {
      return { error: trendingResult.reason };
    }
  }

  const reels = dedupeAndFilterReels(
    collected,
    config.maxReels,
    config.lookbackHours,
    options.now,
  );

  if (!sawSuccess) {
    return { error: 'instagram fetch failed' };
  }

  return { reels };
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
    const payload = await runInstagramFetch(merged);
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
