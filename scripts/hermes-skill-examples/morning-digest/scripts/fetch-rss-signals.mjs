// fetch-rss-signals.mjs — Curated RSS/Substack feeds for morning-digest Source 9
// Usage: node fetch-rss-signals.mjs
// stdout: {"entries":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';

import Parser from 'rss-parser';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_PER_FEED_DEFAULT = 3;
const MAX_TOTAL_DEFAULT = 10;
const USER_AGENT = 'CNS-morning-digest/1.0';

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isRssEnabled(value) {
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
export function parseRssFeeds(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ enabled: boolean, feeds: string[], maxPerFeed: number, maxTotal: number }}
 */
export function loadRssConfig(env = process.env) {
  const enabled = isRssEnabled(env.MORNING_DIGEST_RSS_ENABLED);
  const feeds = parseRssFeeds(env.MORNING_DIGEST_RSS_FEEDS);
  const rawMaxPerFeed = parseInt(String(env.MORNING_DIGEST_RSS_MAX_PER_FEED ?? ''), 10);
  const rawMaxTotal = parseInt(String(env.MORNING_DIGEST_RSS_MAX_TOTAL ?? ''), 10);
  const maxPerFeed =
    Number.isFinite(rawMaxPerFeed) && rawMaxPerFeed > 0 ? rawMaxPerFeed : MAX_PER_FEED_DEFAULT;
  const maxTotal =
    Number.isFinite(rawMaxTotal) && rawMaxTotal > 0 ? rawMaxTotal : MAX_TOTAL_DEFAULT;
  return { enabled, feeds, maxPerFeed, maxTotal };
}

/**
 * @param {string | undefined} isoDate
 * @param {string | undefined} pubDate
 * @returns {string | undefined}
 */
export function parsePublishedAt(isoDate, pubDate) {
  const raw = String(isoDate ?? pubDate ?? '').trim();
  if (!raw) {
    return undefined;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return undefined;
  }
  return new Date(ms).toISOString();
}

/**
 * @param {unknown} item
 * @returns {{ title: string, url: string, publishedAt?: string, author?: string } | null}
 */
export function mapRssItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const title = String(row.title ?? '').trim();
  const url = String(row.link ?? row.guid ?? '').trim();
  if (!title || !url) {
    return null;
  }
  const publishedAt = parsePublishedAt(
    row.isoDate != null ? String(row.isoDate) : undefined,
    row.pubDate != null ? String(row.pubDate) : undefined,
  );
  let author;
  const creator = row.creator ?? row.author;
  if (typeof creator === 'string' && creator.trim()) {
    author = creator.trim();
  } else if (creator && typeof creator === 'object' && 'name' in creator) {
    const name = /** @type {{ name?: unknown }} */ (creator).name;
    if (typeof name === 'string' && name.trim()) {
      author = name.trim();
    }
  }
  return {
    title,
    url,
    ...(publishedAt ? { publishedAt } : {}),
    ...(author ? { author } : {}),
  };
}

/**
 * @param {unknown[]} items
 * @param {number} maxPerFeed
 * @returns {Array<{ title: string, url: string, publishedAt?: string, author?: string }>}
 */
export function parseFeedItems(items, maxPerFeed) {
  if (!Array.isArray(items)) {
    return [];
  }
  const seenUrls = new Set();
  const seenTitles = new Set();
  /** @type {Array<{ title: string, url: string, publishedAt?: string, author?: string }>} */
  const entries = [];
  for (const item of items) {
    if (entries.length >= maxPerFeed) {
      break;
    }
    const mapped = mapRssItem(item);
    if (!mapped) {
      continue;
    }
    const urlKey = normalizeUrl(mapped.url);
    const titleKey = normalizeTitle(mapped.title);
    if (urlKey && seenUrls.has(urlKey)) {
      continue;
    }
    if (titleKey && seenTitles.has(titleKey)) {
      continue;
    }
    if (urlKey) {
      seenUrls.add(urlKey);
    }
    if (titleKey) {
      seenTitles.add(titleKey);
    }
    entries.push(mapped);
  }
  return entries;
}

/**
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  return String(url ?? '').trim().toLowerCase();
}

/**
 * @param {string} title
 * @returns {string}
 */
function normalizeTitle(title) {
  return String(title ?? '').trim().toLowerCase();
}

/**
 * @param {Array<{ title: string, url: string, publishedAt?: string, author?: string }>} items
 * @param {number} maxTotal
 * @returns {Array<{ title: string, url: string, publishedAt?: string, author?: string }>}
 */
export function dedupeEntries(items, maxTotal) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  /** @type {Array<{ title: string, url: string, publishedAt?: string, author?: string }>} */
  const entries = [];
  for (const item of items) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = normalizeTitle(item.title);
    if (urlKey && seenUrls.has(urlKey)) {
      continue;
    }
    if (titleKey && seenTitles.has(titleKey)) {
      continue;
    }
    if (urlKey) {
      seenUrls.add(urlKey);
    }
    if (titleKey) {
      seenTitles.add(titleKey);
    }
    entries.push(item);
    if (entries.length >= maxTotal) {
      break;
    }
  }
  return entries;
}

/**
 * @param {string} url
 * @param {import('rss-parser')} parser
 * @param {string | undefined} fixtureXml
 * @returns {Promise<{ ok: true, items: unknown[] } | { ok: false, reason: string }>}
 */
export async function fetchFeed(url, parser, fixtureXml) {
  try {
    const feed =
      fixtureXml !== undefined ? await parser.parseString(fixtureXml) : await parser.parseURL(url);
    const items = feed && Array.isArray(feed.items) ? feed.items : [];
    return { ok: true, items };
  } catch (err) {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 80)
        : 'parse-error';
    return { ok: false, reason };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   Parser?: typeof Parser,
 *   fixtureXml?: string,
 *   fixtureXmlByFeedUrl?: Record<string, string>,
 * }} [options]
 * @returns {Promise<{ entries?: unknown[], error?: string }>}
 */
export async function runRssFetch(env, options = {}) {
  void options.fetch;
  const ParserClass = options.Parser ?? Parser;
  const config = loadRssConfig(env);

  if (!config.enabled) {
    return { error: 'rss disabled' };
  }
  if (config.feeds.length === 0) {
    return { error: 'missing-feeds' };
  }

  const parser = new ParserClass({
    timeout: FETCH_TIMEOUT_MS,
    headers: { 'User-Agent': USER_AGENT },
  });

  /** @type {Array<{ title: string, url: string, publishedAt?: string, author?: string }>} */
  const collected = [];
  /** @type {string[]} */
  const feedErrors = [];

  for (const feedUrl of config.feeds) {
    const fixture =
      options.fixtureXmlByFeedUrl?.[feedUrl] ??
      (options.fixtureXml !== undefined && config.feeds.length === 1
        ? options.fixtureXml
        : undefined);
    const result = await fetchFeed(feedUrl, parser, fixture);
    if (!result.ok) {
      feedErrors.push(result.reason);
      continue;
    }
    collected.push(...parseFeedItems(result.items, config.maxPerFeed));
  }

  if (collected.length === 0 && feedErrors.length >= config.feeds.length) {
    return { error: feedErrors[0] ?? 'all-feeds-failed' };
  }

  const entries = dedupeEntries(collected, config.maxTotal);
  return { entries };
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
    const payload = await runRssFetch(merged);
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
