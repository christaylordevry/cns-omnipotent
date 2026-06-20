// fetch-pinterest-signals.mjs — ScrapeCreators Pinterest for morning-digest Source 16
// Usage: node fetch-pinterest-signals.mjs
// stdout: {"pins":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath, URL } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const SCRAPECREATORS_API_BASE = 'https://api.scrapecreators.com';
const FETCH_TIMEOUT_MS = 15_000;
const KEYWORD_DELAY_MS = 100;
const MAX_PINS_DEFAULT = 15;
const MAX_PINS_HARD = 30;
const PER_KEYWORD_DEFAULT = 5;
const LOOKBACK_HOURS_DEFAULT = 168;
const CREDIT_WARN_THRESHOLD = 50;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isPinterestEnabled(value) {
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
export function parsePinterestKeywords(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
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
 *   keywords: string[],
 *   maxPins: number,
 *   perKeyword: number,
 *   lookbackHours: number,
 * }}
 */
export function loadPinterestConfig(env = process.env) {
  const enabled = isPinterestEnabled(env.MORNING_DIGEST_PINTEREST_ENABLED);
  const apiKey = String(env.SCRAPECREATORS_API_KEY ?? '').trim() || undefined;
  const keywords = parsePinterestKeywords(env.MORNING_DIGEST_PINTEREST_KEYWORDS);
  const rawMax = parseInt(String(env.MORNING_DIGEST_PINTEREST_MAX_PINS ?? ''), 10);
  const rawPerKeyword = parseInt(String(env.MORNING_DIGEST_PINTEREST_PER_KEYWORD ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_PINTEREST_LOOKBACK_HOURS ?? ''), 10);
  const maxPins =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_PINS_HARD) : MAX_PINS_DEFAULT;
  const perKeyword =
    Number.isFinite(rawPerKeyword) && rawPerKeyword > 0 ? rawPerKeyword : PER_KEYWORD_DEFAULT;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  return { enabled, apiKey, keywords, maxPins, perKeyword, lookbackHours };
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
 * @param {{ pinId?: unknown, id?: unknown, url?: unknown }} row
 * @returns {string | null}
 */
export function pinDedupeKey(row) {
  const pinId = String(row.pinId ?? row.id ?? '').trim();
  if (pinId) {
    return `pin:${pinId}`;
  }
  const url = normalizeUrl(row.url);
  return url ? `pin:url:${url}` : null;
}

/**
 * @param {unknown} item
 * @returns {number}
 */
export function extractRepinCount(item) {
  if (!item || typeof item !== 'object') {
    return 0;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const stats =
    row.statistics && typeof row.statistics === 'object'
      ? /** @type {Record<string, unknown>} */ (row.statistics)
      : row.stats && typeof row.stats === 'object'
        ? /** @type {Record<string, unknown>} */ (row.stats)
        : {};
  return parseStatCount(
    row.repin_count ??
      row.repinCount ??
      row.save_count ??
      row.saveCount ??
      row.saves ??
      stats.repin_count ??
      stats.repinCount ??
      stats.save_count ??
      stats.saves,
  );
}

/**
 * @param {unknown} item
 * @returns {{
 *   pinId: string,
 *   title: string,
 *   description?: string,
 *   url: string,
 *   link?: string,
 *   imageUrl?: string,
 *   author: string,
 *   repinCount: number,
 *   publishedAt?: string,
 * } | null}
 */
export function mapPinItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const pinId = String(row.id ?? row.pin_id ?? row.pinId ?? '').trim();
  const description = String(row.description ?? row.desc ?? '').trim();
  const title =
    String(row.title ?? '').trim() ||
    (description ? description.split('\n')[0].trim() : '');
  if (!pinId && !title) {
    return null;
  }

  const pinner =
    row.pinner && typeof row.pinner === 'object'
      ? /** @type {Record<string, unknown>} */ (row.pinner)
      : row.user && typeof row.user === 'object'
        ? /** @type {Record<string, unknown>} */ (row.user)
        : {};
  const author =
    String(pinner.username ?? pinner.display_name ?? pinner.name ?? row.author ?? '').trim() ||
    'unknown';

  const url =
    normalizeUrl(row.url ?? row.permalink) ||
    (pinId ? `https://www.pinterest.com/pin/${pinId}/` : '');

  const outboundLink = normalizeUrl(row.link ?? row.outbound_link ?? row.destination_url);
  const imageUrl = normalizeUrl(
    row.image_url ??
      row.imageUrl ??
      (row.images && typeof row.images === 'object'
        ? /** @type {Record<string, unknown>} */ (row.images).orig
        : undefined) ??
      row.image,
  );

  const repinCount = extractRepinCount(row);

  let publishedAt;
  const createdAt = row.created_at ?? row.createdAt ?? row.publishedAt ?? row.date;
  if (createdAt != null) {
    const asNum = Number(createdAt);
    if (Number.isFinite(asNum) && asNum > 0) {
      publishedAt = new Date(asNum > 1e12 ? asNum : asNum * 1000).toISOString();
    } else {
      const asStr = String(createdAt).trim();
      if (asStr) {
        publishedAt = asStr;
      }
    }
  }

  return {
    pinId: pinId || url,
    title: title || `Pinterest pin ${pinId}`,
    ...(description ? { description } : {}),
    url: url || 'https://www.pinterest.com/',
    ...(outboundLink ? { link: outboundLink } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    author,
    repinCount,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @param {number} perKeyword
 * @returns {ReturnType<typeof mapPinItem>[]}
 */
export function parseSearchResponse(json, perKeyword) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const row = /** @type {Record<string, unknown>} */ (json);
  const list = row.pins ?? row.results ?? row.items ?? row.data;
  const items = Array.isArray(list) ? list : Array.isArray(json) ? json : [];
  /** @type {ReturnType<typeof mapPinItem>[]} */
  const pins = [];
  for (const item of items) {
    if (pins.length >= perKeyword) {
      break;
    }
    const mapped = mapPinItem(item);
    if (mapped) {
      pins.push(mapped);
    }
  }
  return pins;
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
 *   | { ok: true, pins: ReturnType<typeof parseSearchResponse> }
 *   | { ok: false, reason: string, fatal?: boolean }
 * >}
 */
export async function fetchScrapeCreators(path, params, apiKey, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    const perKeyword = parseInt(String(params.perKeyword ?? PER_KEYWORD_DEFAULT), 10);
    return { ok: true, pins: parseSearchResponse(fixtureJson, perKeyword) };
  }

  const searchParams = new URLSearchParams({ ...params, trim: 'true' });
  delete searchParams.perKeyword;
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
    const perKeyword = parseInt(String(params.perKeyword ?? PER_KEYWORD_DEFAULT), 10);
    return { ok: true, pins: parseSearchResponse(json, perKeyword) };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {ReturnType<typeof mapPinItem>[]} candidates
 * @param {number} maxPins
 * @param {number} lookbackHours
 * @param {Date} [now]
 * @returns {Array<{
 *   title: string,
 *   description?: string,
 *   url: string,
 *   link?: string,
 *   imageUrl?: string,
 *   author: string,
 *   pinId: string,
 *   repinCount: number,
 *   publishedAt?: string,
 * }>}
 */
export function dedupeAndFilterPins(candidates, maxPins, lookbackHours, now = new Date()) {
  const seen = new Set();
  /** @type {Array<{
 *   title: string,
 *   description?: string,
 *   url: string,
 *   link?: string,
 *   imageUrl?: string,
 *   author: string,
 *   pinId: string,
 *   repinCount: number,
 *   publishedAt?: string,
 * }>} */
  const pins = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!isWithinLookback(candidate.publishedAt, lookbackHours, now)) {
      continue;
    }
    const key = pinDedupeKey(candidate);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    pins.push({
      title: candidate.title,
      url: candidate.url,
      author: candidate.author,
      pinId: candidate.pinId,
      repinCount: candidate.repinCount,
      ...(candidate.description ? { description: candidate.description } : {}),
      ...(candidate.link ? { link: candidate.link } : {}),
      ...(candidate.imageUrl ? { imageUrl: candidate.imageUrl } : {}),
      ...(candidate.publishedAt ? { publishedAt: candidate.publishedAt } : {}),
    });
    if (pins.length >= maxPins) {
      break;
    }
  }
  return pins;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtureKeywordByQuery?: Record<string, unknown>,
 *   now?: Date,
 * }} [options]
 * @returns {Promise<{ pins?: unknown[], error?: string }>}
 */
export async function runPinterestFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadPinterestConfig(env);

  if (!config.enabled) {
    return { error: 'pinterest disabled' };
  }
  if (!config.apiKey) {
    return { error: 'missing-api-key' };
  }
  if (config.keywords.length === 0) {
    return { error: 'missing-keywords' };
  }

  const estimatedCredits = config.keywords.length;
  if (estimatedCredits > CREDIT_WARN_THRESHOLD) {
    console.error(
      `pinterest credit warning: estimated ${estimatedCredits} API calls (keywords=${config.keywords.length})`,
    );
  }

  /** @type {ReturnType<typeof mapPinItem>[]} */
  const collected = [];
  let sawSuccess = false;

  for (let index = 0; index < config.keywords.length; index += 1) {
    const keyword = config.keywords[index];
    if (index > 0) {
      await delayMs(KEYWORD_DELAY_MS);
    }
    const fixture = options.fixtureKeywordByQuery?.[keyword];
    const result = await fetchScrapeCreators(
      '/v1/pinterest/search',
      {
        query: keyword,
        perKeyword: String(config.perKeyword),
      },
      config.apiKey,
      fetchFn,
      fixture,
    );
    if (!result.ok) {
      if (result.fatal) {
        return { error: result.reason };
      }
      console.error(`pinterest search failed for "${keyword}": ${result.reason}`);
      continue;
    }
    sawSuccess = true;
    collected.push(...result.pins);
  }

  const pins = dedupeAndFilterPins(
    collected,
    config.maxPins,
    config.lookbackHours,
    options.now,
  );

  if (!sawSuccess) {
    return { error: 'pinterest fetch failed' };
  }

  return { pins };
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
    const payload = await runPinterestFetch(merged);
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
