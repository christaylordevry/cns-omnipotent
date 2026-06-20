// fetch-polymarket-signals.mjs — Polymarket Gamma API for morning-digest Source 17
// Usage: node fetch-polymarket-signals.mjs
// stdout: {"markets":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const FETCH_TIMEOUT_MS = 15_000;
const WATCHLIST_DELAY_MS = 100;
const MAX_MARKETS_DEFAULT = 15;
const MAX_MARKETS_HARD = 30;
const PER_KEYWORD_DEFAULT = 5;
const PER_TAG_DEFAULT = 5;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isPolymarketEnabled(value) {
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
export function parseWatchlistItems(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   keywords: string[],
 *   tagSlugs: string[],
 *   maxMarkets: number,
 *   perKeyword: number,
 *   perTag: number,
 *   minVolume24hr: number,
 *   priceDeltaHours: number,
 * }}
 */
export function loadPolymarketConfig(env = process.env) {
  const enabled = isPolymarketEnabled(env.MORNING_DIGEST_POLYMARKET_ENABLED);
  const keywords = parseWatchlistItems(env.MORNING_DIGEST_POLYMARKET_KEYWORDS);
  const tagSlugs = parseWatchlistItems(env.MORNING_DIGEST_POLYMARKET_TAG_SLUGS);
  const rawMax = parseInt(String(env.MORNING_DIGEST_POLYMARKET_MAX_MARKETS ?? ''), 10);
  const rawPerKeyword = parseInt(String(env.MORNING_DIGEST_POLYMARKET_PER_KEYWORD ?? ''), 10);
  const rawPerTag = parseInt(String(env.MORNING_DIGEST_POLYMARKET_PER_TAG ?? ''), 10);
  const rawMinVol = parseFloat(String(env.MORNING_DIGEST_POLYMARKET_MIN_VOLUME24HR ?? ''));
  const rawDeltaHours = parseInt(
    String(env.MORNING_DIGEST_POLYMARKET_PRICE_DELTA_HOURS ?? ''),
    10,
  );
  const maxMarkets =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_MARKETS_HARD) : MAX_MARKETS_DEFAULT;
  const perKeyword =
    Number.isFinite(rawPerKeyword) && rawPerKeyword > 0 ? rawPerKeyword : PER_KEYWORD_DEFAULT;
  const perTag = Number.isFinite(rawPerTag) && rawPerTag > 0 ? rawPerTag : PER_TAG_DEFAULT;
  const minVolume24hr = Number.isFinite(rawMinVol) && rawMinVol >= 0 ? rawMinVol : 0;
  const priceDeltaHours =
    Number.isFinite(rawDeltaHours) && rawDeltaHours > 0 ? rawDeltaHours : 0;
  return {
    enabled,
    keywords,
    tagSlugs,
    maxMarkets,
    perKeyword,
    perTag,
    minVolume24hr,
    priceDeltaHours,
  };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function parseJsonStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  const raw = String(value ?? '').trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

/**
 * @param {unknown} value
 * @returns {number[]}
 */
export function parseOutcomePrices(value) {
  return parseJsonStringArray(value)
    .map((entry) => parseFloat(entry))
    .filter((entry) => Number.isFinite(entry));
}

/**
 * @param {string[]} outcomes
 * @param {number[]} outcomePrices
 * @returns {{ leadingOutcome?: string, leadingProbability?: number }}
 */
export function computeLeadingOutcome(outcomes, outcomePrices) {
  if (outcomes.length === 0 || outcomePrices.length === 0) {
    return {};
  }
  let bestIndex = 0;
  let bestPrice = outcomePrices[0] ?? 0;
  for (let index = 1; index < outcomePrices.length; index += 1) {
    const price = outcomePrices[index] ?? 0;
    if (price > bestPrice) {
      bestPrice = price;
      bestIndex = index;
    }
  }
  const leadingOutcome = outcomes[bestIndex];
  if (!leadingOutcome) {
    return {};
  }
  return { leadingOutcome, leadingProbability: bestPrice };
}

/**
 * @param {unknown} value
 * @returns {number | undefined}
 */
export function parseUsdNumber(value) {
  if (value == null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * @param {unknown} item
 * @returns {Record<string, unknown> | null}
 */
export function mapMarketItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  if (row.closed === true || row.active === false) {
    return null;
  }

  const question = String(row.question ?? '').trim();
  if (!question) {
    return null;
  }

  const outcomes = parseJsonStringArray(row.outcomes);
  const outcomePrices = parseOutcomePrices(row.outcomePrices);
  const { leadingOutcome, leadingProbability } = computeLeadingOutcome(outcomes, outcomePrices);

  const slug = String(row.slug ?? '').trim();
  const conditionId = String(row.conditionId ?? '').trim();
  const marketId = String(row.id ?? row.marketId ?? '').trim();
  const volumeUsd = parseUsdNumber(row.volumeNum ?? row.volume);
  const volume24hrUsd = parseUsdNumber(row.volume24hr ?? row.volume24hrClob);
  const liquidityUsd = parseUsdNumber(row.liquidityNum ?? row.liquidity);
  const endDate = row.endDate != null ? String(row.endDate) : undefined;
  const updatedAt = row.updatedAt != null ? String(row.updatedAt) : undefined;

  let url = '';
  if (slug) {
    url = `https://polymarket.com/market/${slug}`;
  } else if (conditionId) {
    url = `https://polymarket.com/market/${conditionId}`;
  }

  return {
    question,
    url,
    marketId,
    conditionId,
    slug,
    outcomes,
    outcomePrices,
    ...(leadingOutcome ? { leadingOutcome } : {}),
    ...(leadingProbability != null ? { leadingProbability } : {}),
    ...(volumeUsd != null ? { volumeUsd } : {}),
    ...(volume24hrUsd != null ? { volume24hrUsd } : {}),
    ...(liquidityUsd != null ? { liquidityUsd } : {}),
    ...(endDate ? { endDate } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

/**
 * @param {{ conditionId?: unknown, marketId?: unknown, id?: unknown, url?: unknown }} row
 * @returns {string | null}
 */
export function marketDedupeKey(row) {
  const conditionId = String(row.conditionId ?? '').trim();
  if (conditionId) {
    return `pm:${conditionId}`;
  }
  const marketId = String(row.marketId ?? row.id ?? '').trim();
  if (marketId) {
    return `pm:id:${marketId}`;
  }
  const url = String(row.url ?? '').trim();
  return url ? `pm:url:${url}` : null;
}

/**
 * @param {Array<ReturnType<typeof mapMarketItem>>} candidates
 * @param {number} maxMarkets
 * @param {number} minVolume24hr
 * @returns {Array<NonNullable<ReturnType<typeof mapMarketItem>>>}
 */
export function dedupeAndFilterMarkets(candidates, maxMarkets, minVolume24hr) {
  const seen = new Set();
  /** @type {Array<NonNullable<ReturnType<typeof mapMarketItem>>>} */
  const markets = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const volume24hr = candidate.volume24hrUsd ?? 0;
    if (minVolume24hr > 0 && volume24hr < minVolume24hr) {
      continue;
    }
    const key = marketDedupeKey(candidate);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    markets.push(candidate);
    if (markets.length >= maxMarkets) {
      break;
    }
  }

  return markets;
}

/**
 * @param {unknown} json
 * @param {number} limit
 * @returns {Array<NonNullable<ReturnType<typeof mapMarketItem>>>}
 */
export function parsePublicSearchResponse(json, limit) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const events = /** @type {{ events?: unknown[] }} */ (json).events;
  if (!Array.isArray(events)) {
    return [];
  }

  /** @type {Array<NonNullable<ReturnType<typeof mapMarketItem>>>} */
  const markets = [];
  for (const event of events) {
    if (!event || typeof event !== 'object') {
      continue;
    }
    const nested = /** @type {{ markets?: unknown[] }} */ (event).markets;
    if (!Array.isArray(nested)) {
      continue;
    }
    for (const item of nested) {
      if (markets.length >= limit) {
        return markets;
      }
      const mapped = mapMarketItem(item);
      if (mapped) {
        markets.push(mapped);
      }
    }
  }
  return markets;
}

/**
 * @param {unknown} json
 * @param {number} limit
 * @returns {Array<NonNullable<ReturnType<typeof mapMarketItem>>>}
 */
export function parseMarketsListResponse(json, limit) {
  const items = Array.isArray(json) ? json : [];
  /** @type {Array<NonNullable<ReturnType<typeof mapMarketItem>>>} */
  const markets = [];
  for (const item of items) {
    if (markets.length >= limit) {
      break;
    }
    const mapped = mapMarketItem(item);
    if (mapped) {
      markets.push(mapped);
    }
  }
  return markets;
}

/**
 * @param {string} url
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<
 *   | { ok: true, json: unknown }
 *   | { ok: false, reason: string, retryable?: boolean }
 * >}
 */
export async function fetchWithRetry(url, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    return { ok: true, json: fixtureJson };
  }

  let lastReason = 'fetch-error';
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await delayMs(RETRY_BASE_MS * 2 ** (attempt - 1));
    }

    try {
      const res = await fetchFn(url, {
        signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
      let json;
      try {
        json = await res.json();
      } catch {
        lastReason = 'parse-error';
        continue;
      }
      if (res.ok) {
        return { ok: true, json };
      }
      const reason = res.status === 429 ? 'http-429' : `http-${res.status}`;
      lastReason = reason;
      if (res.status === 429 || res.status >= 500) {
        continue;
      }
      return { ok: false, reason };
    } catch (err) {
      const name =
        err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
      lastReason = name;
    }
  }

  return { ok: false, reason: lastReason, retryable: true };
}

/**
 * @param {string} keyword
 * @param {number} perKeyword
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<
 *   | { ok: true, markets: ReturnType<typeof parsePublicSearchResponse> }
 *   | { ok: false, reason: string }
 * >}
 */
export async function searchByKeyword(keyword, perKeyword, fetchFn, fixtureJson) {
  const params = new URLSearchParams({
    q: keyword,
    limit_per_type: String(perKeyword),
    events_status: 'active',
  });
  const url = `${GAMMA_API_BASE}/public-search?${params.toString()}`;
  const result = await fetchWithRetry(url, fetchFn, fixtureJson);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, markets: parsePublicSearchResponse(result.json, perKeyword) };
}

/**
 * @param {string} tagSlug
 * @param {number} perTag
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<
 *   | { ok: true, markets: ReturnType<typeof parseMarketsListResponse> }
 *   | { ok: false, reason: string }
 * >}
 */
export async function fetchByTagSlug(tagSlug, perTag, fetchFn, fixtureJson) {
  const params = new URLSearchParams({
    tag_slug: tagSlug,
    closed: 'false',
    active: 'true',
    limit: String(perTag),
  });
  const url = `${GAMMA_API_BASE}/markets?${params.toString()}`;
  const result = await fetchWithRetry(url, fetchFn, fixtureJson);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, markets: parseMarketsListResponse(result.json, perTag) };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtureSearchByKeyword?: Record<string, unknown>,
 *   fixtureMarketsByTag?: Record<string, unknown>,
 * }} [options]
 * @returns {Promise<{ markets?: unknown[], error?: string }>}
 */
export async function runPolymarketFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadPolymarketConfig(env);

  if (!config.enabled) {
    return { error: 'polymarket disabled' };
  }
  if (config.keywords.length === 0 && config.tagSlugs.length === 0) {
    return { error: 'missing-watchlist' };
  }

  /** @type {Array<ReturnType<typeof mapMarketItem>>} */
  const candidates = [];
  let sawSuccess = false;
  let lastFailureReason = 'polymarket fetch failed';

  for (let index = 0; index < config.keywords.length; index += 1) {
    const keyword = config.keywords[index];
    if (index > 0) {
      await delayMs(WATCHLIST_DELAY_MS);
    }

    const fixture = options.fixtureSearchByKeyword?.[keyword];
    const result = await searchByKeyword(keyword, config.perKeyword, fetchFn, fixture);
    if (!result.ok) {
      lastFailureReason = result.reason;
      console.error(`polymarket keyword search failed for "${keyword}": ${result.reason}`);
      continue;
    }

    sawSuccess = true;
    candidates.push(...result.markets);
  }

  for (let index = 0; index < config.tagSlugs.length; index += 1) {
    const tagSlug = config.tagSlugs[index];
    if (config.keywords.length > 0 || index > 0) {
      await delayMs(WATCHLIST_DELAY_MS);
    }

    const fixture = options.fixtureMarketsByTag?.[tagSlug];
    const result = await fetchByTagSlug(tagSlug, config.perTag, fetchFn, fixture);
    if (!result.ok) {
      lastFailureReason = result.reason;
      console.error(`polymarket tag fetch failed for "${tagSlug}": ${result.reason}`);
      continue;
    }

    sawSuccess = true;
    candidates.push(...result.markets);
  }

  const markets = dedupeAndFilterMarkets(
    candidates,
    config.maxMarkets,
    config.minVolume24hr,
  );

  if (!sawSuccess) {
    return { error: lastFailureReason.slice(0, 120) };
  }

  if (config.priceDeltaHours > 0) {
    console.error(
      'polymarket price delta deferred: MORNING_DIGEST_POLYMARKET_PRICE_DELTA_HOURS > 0 not implemented in v1',
    );
  }

  return { markets };
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
    const payload = await runPolymarketFetch(merged);
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
