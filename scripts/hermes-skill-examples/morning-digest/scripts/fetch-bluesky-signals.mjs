// fetch-bluesky-signals.mjs — Bluesky AT Protocol for morning-digest Source 12
// Usage: node fetch-bluesky-signals.mjs
// stdout: {"posts":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const APPVIEW_DEFAULT = 'https://api.bsky.app';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_POSTS_DEFAULT = 25;
const MAX_POSTS_HARD = 50;
const LOOKBACK_HOURS_DEFAULT = 24;
const ACTOR_DELAY_MS = 100;
const BSKY_TITLE_MAX_CHARS = 80;
const JUNK_LINE_RE = /^(full text|thread|re:|fw:):?\s*$/i;
const FEED_LIMIT = 50;

export const DEFAULT_BSKY_ACTORS = [
  'karpathy.bsky.social',
  'simonwillison.net',
  'dannypostma.bsky.social',
  'swyx.io',
  'sama.bsky.social',
  'ylecun.bsky.social',
  'emollick.bsky.social',
  'GaryMarcus.bsky.social',
];

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isBlueskyEnabled(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) {
    return true;
  }
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

/**
 * @param {string | undefined} raw
 * @param {{ useDefaultWhenEmpty?: boolean }} [options]
 * @returns {string[]}
 */
export function parseActors(raw, options = {}) {
  const parsed = String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const unique = [...new Set(parsed)];
  if (unique.length > 0) {
    return unique;
  }
  return options.useDefaultWhenEmpty ? [...DEFAULT_BSKY_ACTORS] : [];
}

/**
 * @param {string} appviewHost
 * @returns {string}
 */
export function normalizeAppviewHost(appviewHost) {
  const trimmed = String(appviewHost ?? APPVIEW_DEFAULT).trim() || APPVIEW_DEFAULT;
  return trimmed.replace(/\/+$/, '');
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   actors: string[],
 *   maxPosts: number,
 *   lookbackHours: number,
 *   appviewHost: string,
 * }}
 */
export function loadBlueskyConfig(env = process.env) {
  const enabled = isBlueskyEnabled(env.MORNING_DIGEST_BSKY_ENABLED);
  const actorsRaw = env.MORNING_DIGEST_BSKY_ACTORS;
  const actors =
    actorsRaw === undefined || actorsRaw === null
      ? parseActors('', { useDefaultWhenEmpty: true })
      : parseActors(actorsRaw, { useDefaultWhenEmpty: false });
  const rawMax = parseInt(String(env.MORNING_DIGEST_BSKY_MAX_POSTS ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_BSKY_LOOKBACK_HOURS ?? ''), 10);
  const maxPosts = Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_POSTS_HARD) : MAX_POSTS_DEFAULT;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  const appviewHost = normalizeAppviewHost(env.MORNING_DIGEST_BSKY_APPVIEW_HOST ?? APPVIEW_DEFAULT);
  return { enabled, actors, maxPosts, lookbackHours, appviewHost };
}

/**
 * @param {string} handle
 * @param {string} uri
 * @returns {string}
 */
export function buildPostUrl(handle, uri) {
  const trimmedHandle = String(handle ?? '').trim();
  const trimmedUri = String(uri ?? '').trim();
  if (!trimmedHandle || !trimmedUri) {
    return '';
  }
  const rkey = trimmedUri.split('/').pop() ?? '';
  if (!rkey) {
    return '';
  }
  return `https://bsky.app/profile/${trimmedHandle}/post/${rkey}`;
}

/**
 * @param {string} text
 * @param {string} [authorHandle]
 * @returns {string}
 */
export function deriveBlueskyTitle(text, authorHandle) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let line = lines.find((candidate) => !JUNK_LINE_RE.test(candidate)) ?? '';
  if (!line) {
    const handle = String(authorHandle ?? '').trim();
    return handle ? `[Bluesky post by @${handle}]` : '[Bluesky post]';
  }
  if (line.length <= BSKY_TITLE_MAX_CHARS) {
    return line;
  }
  const slice = line.slice(0, BSKY_TITLE_MAX_CHARS);
  const lastSpace = slice.lastIndexOf(' ');
  const truncated = (lastSpace > 20 ? slice.slice(0, lastSpace) : slice).trimEnd();
  return `${truncated}…`;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function truncateTitle(text) {
  return deriveBlueskyTitle(text);
}

/**
 * @param {unknown} feedItem
 * @returns {{
 *   title: string,
 *   authorHandle: string,
 *   url: string,
 *   publishedAt?: string,
 *   likes: number,
 *   reposts: number,
 *   replies: number,
 *   quotes: number,
 * } | null}
 */
export function mapFeedPost(feedItem) {
  if (!feedItem || typeof feedItem !== 'object') {
    return null;
  }
  const row = /** @type {{ post?: unknown }} */ (feedItem);
  const post = row.post;
  if (!post || typeof post !== 'object') {
    return null;
  }
  const postRow = /** @type {Record<string, unknown>} */ (post);
  const record = postRow.record;
  const author = postRow.author;
  if (!record || typeof record !== 'object' || !author || typeof author !== 'object') {
    return null;
  }
  const recordRow = /** @type {Record<string, unknown>} */ (record);
  const authorRow = /** @type {Record<string, unknown>} */ (author);
  const authorHandle = String(authorRow.handle ?? '').trim();
  const title = deriveBlueskyTitle(String(recordRow.text ?? ''), authorHandle);
  const url = buildPostUrl(authorHandle, String(postRow.uri ?? ''));
  if (!title || !authorHandle || !url) {
    return null;
  }
  const likes = Number(postRow.likeCount);
  const reposts = Number(postRow.repostCount);
  const replies = Number(postRow.replyCount);
  const quotes = Number(postRow.quoteCount);
  const indexedAt = postRow.indexedAt != null ? String(postRow.indexedAt) : '';
  const createdAt = recordRow.createdAt != null ? String(recordRow.createdAt) : '';
  const publishedAt = indexedAt || createdAt || undefined;
  return {
    title,
    authorHandle,
    url,
    likes: Number.isFinite(likes) ? likes : 0,
    reposts: Number.isFinite(reposts) ? reposts : 0,
    replies: Number.isFinite(replies) ? replies : 0,
    quotes: Number.isFinite(quotes) ? quotes : 0,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @returns {Array<NonNullable<ReturnType<typeof mapFeedPost>>>}
 */
export function parseAuthorFeedResponse(json) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const feed = /** @type {{ feed?: unknown[] }} */ (json).feed;
  if (!Array.isArray(feed)) {
    return [];
  }
  /** @type {Array<NonNullable<ReturnType<typeof mapFeedPost>>>} */
  const posts = [];
  for (const item of feed) {
    const mapped = mapFeedPost(item);
    if (mapped) {
      posts.push(mapped);
    }
  }
  return posts;
}

/**
 * @param {Array<{ publishedAt?: string }>} posts
 * @param {number} lookbackHours
 * @param {Date} [now]
 * @returns {Array<{ publishedAt?: string }>}
 */
export function filterByLookback(posts, lookbackHours, now = new Date()) {
  const cutoffMs = now.getTime() - lookbackHours * 60 * 60 * 1000;
  return posts.filter((post) => {
    if (!post.publishedAt) {
      return false;
    }
    const ts = Date.parse(post.publishedAt);
    if (!Number.isFinite(ts)) {
      return false;
    }
    return ts >= cutoffMs;
  });
}

/**
 * @param {Array<{ url: string }>} posts
 * @returns {Array<{ url: string }>}
 */
export function dedupePostsByUrl(posts) {
  const seen = new Set();
  /** @type {Array<{ url: string }>} */
  const out = [];
  for (const post of posts) {
    const url = String(post.url ?? '').trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push(post);
  }
  return out;
}

/**
 * @param {{ likes?: number, reposts?: number }} post
 * @returns {number}
 */
export function engagementProxy(post) {
  return (Number(post.likes) || 0) + 2 * (Number(post.reposts) || 0);
}

/**
 * @param {Array<{
 *   title: string,
 *   authorHandle: string,
 *   url: string,
 *   publishedAt?: string,
 *   likes: number,
 *   reposts: number,
 *   replies: number,
 *   quotes: number,
 * }>} posts
 * @param {number} maxPosts
 * @returns {Array<{
 *   title: string,
 *   authorHandle: string,
 *   url: string,
 *   publishedAt?: string,
 *   likes: number,
 *   reposts: number,
 *   replies: number,
 *   quotes: number,
 * }>}
 */
export function sortAndCapPosts(posts, maxPosts) {
  return [...posts]
    .sort((a, b) => engagementProxy(b) - engagementProxy(a))
    .slice(0, maxPosts);
}

/**
 * @param {string} appviewHost
 * @param {string} handle
 * @param {typeof fetch} fetchFn
 * @returns {Promise<{ did?: string, error?: string }>}
 */
export async function resolveHandle(appviewHost, handle, fetchFn) {
  const url = `${appviewHost}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { error: `resolve-${res.status}` };
    }
    const json = await res.json();
    const did = json && typeof json === 'object' ? String(/** @type {{ did?: unknown }} */ (json).did ?? '').trim() : '';
    if (!did) {
      return { error: 'resolve-missing-did' };
    }
    return { did };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { error: name };
  }
}

/**
 * @param {string} appviewHost
 * @param {string} did
 * @param {typeof fetch} fetchFn
 * @returns {Promise<{ posts?: ReturnType<typeof parseAuthorFeedResponse>, error?: string }>}
 */
export async function fetchAuthorFeed(appviewHost, did, fetchFn) {
  const url = `${appviewHost}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&limit=${FEED_LIMIT}`;
  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { error: `feed-${res.status}` };
    }
    const json = await res.json();
    return { posts: parseAuthorFeedResponse(json) };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { error: name };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtures?: Record<string, { did?: string, feed?: unknown, resolveError?: string, feedError?: string }>,
 *   now?: Date,
 * }} [options]
 * @returns {Promise<{ posts?: unknown[], error?: string }>}
 */
export async function runBlueskyFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadBlueskyConfig(env);

  if (!config.enabled) {
    return { error: 'bluesky disabled' };
  }
  if (config.actors.length === 0) {
    return { error: 'no bluesky actors configured' };
  }

  if (options.fixtures) {
    /** @type {Array<NonNullable<ReturnType<typeof mapFeedPost>>>} */
    const aggregated = [];
    for (const handle of config.actors) {
      const fixture = options.fixtures[handle];
      if (!fixture) {
        continue;
      }
      if (fixture.resolveError) {
        continue;
      }
      if (fixture.feedError) {
        continue;
      }
      if (fixture.feed !== undefined) {
        aggregated.push(...parseAuthorFeedResponse(fixture.feed));
      }
    }
    const deduped = dedupePostsByUrl(aggregated);
    const filtered = filterByLookback(deduped, config.lookbackHours, options.now);
    return { posts: sortAndCapPosts(filtered, config.maxPosts) };
  }

  /** @type {Array<NonNullable<ReturnType<typeof mapFeedPost>>>} */
  const aggregated = [];
  let sawSuccess = false;

  for (let index = 0; index < config.actors.length; index += 1) {
    const handle = config.actors[index];
    if (index > 0) {
      await delayMs(ACTOR_DELAY_MS);
    }

    const resolved = await resolveHandle(config.appviewHost, handle, fetchFn);
    if (resolved.error || !resolved.did) {
      console.error(`bluesky resolve failed for ${handle}: ${resolved.error ?? 'unknown'}`);
      continue;
    }

    const feedResult = await fetchAuthorFeed(config.appviewHost, resolved.did, fetchFn);
    if (feedResult.error || !feedResult.posts) {
      console.error(`bluesky feed failed for ${handle}: ${feedResult.error ?? 'unknown'}`);
      continue;
    }

    sawSuccess = true;
    aggregated.push(...feedResult.posts);
  }

  if (!sawSuccess && aggregated.length === 0) {
    return { error: 'bluesky fetch failed' };
  }

  const deduped = dedupePostsByUrl(aggregated);
  const filtered = filterByLookback(deduped, config.lookbackHours, options.now);
  return { posts: sortAndCapPosts(filtered, config.maxPosts) };
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
    const payload = await runBlueskyFetch(merged);
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
