// fetch-reddit-signals.mjs — Reddit public-JSON top listings for morning-digest Source 8
// Reddit public-JSON pattern informed by last30days reference (MIT) — no runtime dependency
// Usage: node fetch-reddit-signals.mjs
// stdout: {"posts":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_POSTS_DEFAULT = 5;
const PER_SUBREDDIT_DEFAULT = 3;
const REDDIT_PUBLIC_BASE = 'https://www.reddit.com/r';
const REDDIT_SITE_BASE = 'https://www.reddit.com';
const USER_AGENT = 'CNS-morning-digest/1.0';

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isRedditEnabled(value) {
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
export function parseSubreddits(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^r\//i, ''))
    .filter(Boolean);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   subreddits: string[],
 *   maxPosts: number,
 *   perSubreddit: number,
 * }}
 */
export function loadRedditConfig(env = process.env) {
  const enabled = isRedditEnabled(env.MORNING_DIGEST_REDDIT_ENABLED);
  const subreddits = parseSubreddits(env.MORNING_DIGEST_REDDIT_SUBREDDITS);
  const rawMax = parseInt(String(env.MORNING_DIGEST_REDDIT_MAX_POSTS ?? ''), 10);
  const rawPerSub = parseInt(String(env.MORNING_DIGEST_REDDIT_PER_SUBREDDIT ?? ''), 10);
  const maxPosts = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : MAX_POSTS_DEFAULT;
  const perSubreddit =
    Number.isFinite(rawPerSub) && rawPerSub > 0 ? rawPerSub : PER_SUBREDDIT_DEFAULT;
  return {
    enabled,
    subreddits,
    maxPosts,
    perSubreddit,
  };
}

/**
 * @param {string} subreddit
 * @returns {string}
 */
export function buildRedditPublicTopUrl(subreddit) {
  const sub = encodeURIComponent(subreddit);
  return `${REDDIT_PUBLIC_BASE}/${sub}/top.json?t=day&limit=25&raw_json=1`;
}

/**
 * @param {string} permalink
 * @returns {string}
 */
export function absoluteRedditUrl(permalink) {
  const trimmed = String(permalink ?? '').trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${REDDIT_SITE_BASE}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/**
 * @param {unknown} childData
 * @returns {{ title: string, url: string, upvotes: number, commentCount: number, publishedAt?: string } | null}
 */
export function mapRedditPostItem(childData) {
  if (!childData || typeof childData !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (childData);
  const title = String(row.title ?? '').trim();
  const url = absoluteRedditUrl(String(row.permalink ?? ''));
  if (!title || !url) {
    return null;
  }
  const upvotes = Number(row.score);
  const commentCount = Number(row.num_comments);
  const createdUtc = Number(row.created_utc);
  const publishedAt =
    Number.isFinite(createdUtc) && createdUtc > 0
      ? new Date(createdUtc * 1000).toISOString()
      : undefined;
  return {
    title,
    url,
    upvotes: Number.isFinite(upvotes) ? upvotes : 0,
    commentCount: Number.isFinite(commentCount) ? commentCount : 0,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @param {number} cap
 * @returns {Array<{ title: string, url: string, upvotes: number, commentCount: number, publishedAt?: string }>}
 */
export function mapRedditListingToPosts(json, cap) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const children = /** @type {{ data?: { children?: unknown[] } }} */ (json).data?.children;
  if (!Array.isArray(children)) {
    return [];
  }
  /** @type {Array<{ title: string, url: string, upvotes: number, commentCount: number, publishedAt?: string }>} */
  const posts = [];
  for (const child of children) {
    if (posts.length >= cap) {
      break;
    }
    if (!child || typeof child !== 'object') {
      continue;
    }
    const childData = /** @type {{ data?: unknown }} */ (child).data;
    const mapped = mapRedditPostItem(childData);
    if (mapped) {
      posts.push(mapped);
    }
  }
  return posts;
}

/**
 * @param {string} subreddit
 * @param {number} perSubreddit
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<{ ok: true, posts: ReturnType<typeof mapRedditListingToPosts> } | { ok: false, reason: string }>}
 */
export async function fetchRedditPublicTop(subreddit, perSubreddit, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    return { ok: true, posts: mapRedditListingToPosts(fixtureJson, perSubreddit) };
  }
  const url = buildRedditPublicTopUrl(subreddit);
  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}` };
    }
    const json = await res.json();
    return { ok: true, posts: mapRedditListingToPosts(json, perSubreddit) };
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {Array<{ title: string, url: string, upvotes: number, commentCount: number, publishedAt?: string }>} batches
 * @param {number} maxPosts
 * @returns {Array<{ title: string, url: string, upvotes: number, commentCount: number, publishedAt?: string }>}
 */
export function dedupePostsByUrl(batches, maxPosts) {
  const seen = new Set();
  /** @type {Array<{ title: string, url: string, upvotes: number, commentCount: number, publishedAt?: string }>} */
  const posts = [];
  for (const post of batches) {
    if (seen.has(post.url)) {
      continue;
    }
    seen.add(post.url);
    posts.push(post);
    if (posts.length >= maxPosts) {
      break;
    }
  }
  return posts;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtureJson?: unknown,
 *   fixtureJsonBySubreddit?: Record<string, unknown>,
 * }} [options]
 * @returns {Promise<{ posts?: unknown[], error?: string }>}
 */
export async function runRedditFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadRedditConfig(env);

  if (!config.enabled) {
    return { error: 'reddit disabled' };
  }
  if (config.subreddits.length === 0) {
    return { error: 'missing-subreddits' };
  }

  /** @type {Array<{ title: string, url: string, upvotes: number, commentCount: number, publishedAt?: string }>} */
  const collected = [];
  for (const subreddit of config.subreddits) {
    const fixture =
      options.fixtureJsonBySubreddit?.[subreddit] ??
      (options.fixtureJson !== undefined && config.subreddits.length === 1
        ? options.fixtureJson
        : undefined);
    const result = await fetchRedditPublicTop(
      subreddit,
      config.perSubreddit,
      fetchFn,
      fixture,
    );
    if (!result.ok) {
      return { error: result.reason };
    }
    collected.push(...result.posts);
  }

  const posts = dedupePostsByUrl(collected, config.maxPosts);
  return { posts };
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
    const payload = await runRedditFetch(merged);
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
