// fetch-hn-rss.mjs — HackerNews RSS for morning-digest Source 5
// Usage: node fetch-hn-rss.mjs
// stdout: {"stories":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv, parseRssItemBlock } from './fetch-arxiv-rss.mjs';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_STORIES_DEFAULT = 5;
const HN_RSS_BASE = 'https://hnrss.org/frontpage';
const USER_AGENT = 'CNS-morning-digest/1.0';

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isHnEnabled(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) {
    return true;
  }
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ enabled: boolean, maxStories: number }}
 */
export function loadHnConfig(env = process.env) {
  const enabled = isHnEnabled(env.MORNING_DIGEST_HN_ENABLED);
  const raw = parseInt(String(env.MORNING_DIGEST_HN_MAX_STORIES ?? ''), 10);
  const maxStories = Number.isFinite(raw) && raw > 0 ? raw : MAX_STORIES_DEFAULT;
  return { enabled, maxStories };
}

/**
 * @param {string} description
 * @returns {{ score: number, comments: number }}
 */
export function extractScoreAndComments(description) {
  const text = String(description ?? '')
    .replace(/<[^>]+>/g, ' ')
    .trim();
  const pts = text.match(/Points:\s*(\d+)/i);
  const cmt = text.match(/#\s*Comments:\s*(\d+)/i);
  return {
    score: pts ? parseInt(pts[1], 10) : 0,
    comments: cmt ? parseInt(cmt[1], 10) : 0,
  };
}

/**
 * @param {string} block
 * @returns {{ title: string, link: string, score: number, comments: number } | null}
 */
export function parseHnItemBlock(block) {
  const parsed = parseRssItemBlock(block);
  if (!parsed) {
    return null;
  }

  const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
  const rawDesc = descMatch?.[1] ?? '';
  const { score, comments } = extractScoreAndComments(rawDesc);

  return {
    title: parsed.title,
    link: parsed.link,
    score,
    comments,
  };
}

/**
 * @param {string} xml
 * @param {number} maxStories
 * @returns {Array<{ title: string, link: string, score: number, comments: number }>}
 */
export function parseHnRss(xml, maxStories) {
  /** @type {Array<{ title: string, link: string, score: number, comments: number }>} */
  const stories = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml)) !== null && stories.length < maxStories) {
    const parsed = parseHnItemBlock(match[1]);
    if (parsed) {
      stories.push(parsed);
    }
  }
  return stories;
}

/**
 * @param {number} maxStories
 * @param {typeof fetch} fetchFn
 * @param {string} [fixtureXml]
 * @returns {Promise<{ ok: true, xml: string } | { ok: false, reason: string }>}
 */
export async function fetchHnFeed(maxStories, fetchFn, fixtureXml) {
  if (fixtureXml !== undefined) {
    return { ok: true, xml: fixtureXml };
  }
  const count = Math.max(maxStories, 1);
  const url = `${HN_RSS_BASE}?count=${count}`;
  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}` };
    }
    const xml = await res.text();
    return { ok: true, xml };
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, fixtureXml?: string }} [options]
 * @returns {Promise<{ stories?: unknown[], error?: string }>}
 */
export async function runHnFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadHnConfig(env);

  if (!config.enabled) {
    return { error: 'hackernews disabled' };
  }

  const result = await fetchHnFeed(config.maxStories, fetchFn, options.fixtureXml);
  if (!result.ok) {
    return { error: result.reason };
  }

  const stories = parseHnRss(result.xml, config.maxStories);
  return { stories };
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
    const payload = await runHnFetch(merged);
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
