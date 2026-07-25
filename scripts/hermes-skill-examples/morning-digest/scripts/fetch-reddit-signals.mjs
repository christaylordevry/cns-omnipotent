// fetch-reddit-signals.mjs — Reddit public Atom RSS top listings for morning-digest Source 8
// Story 90-1: app-free …/top/.rss?t=day (JSON 403s; OAuth unavailable). No fabricated engagement.
// Usage: node fetch-reddit-signals.mjs
// stdout: {"posts":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';

import Parser from 'rss-parser';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_POSTS_DEFAULT = 5;
const PER_SUBREDDIT_DEFAULT = 3;
const SUBREDDIT_PACE_MS_DEFAULT = 2000;
/** Wall-clock budget for the multi-subreddit loop (digest terminal ~45s). */
export const ADAPTER_BUDGET_MS = 45_000;
const REDDIT_PUBLIC_BASE = 'https://www.reddit.com/r';
const REDDIT_SITE_BASE = 'https://www.reddit.com';
/** Descriptive UA — no personal account required (Story 90-1 Q3). */
export const REDDIT_USER_AGENT = 'linux:cns-morning-digest:1.0 (by /u/cns_operator)';

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
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const part of String(raw ?? '').split(',')) {
    const sub = part.trim().replace(/^r\//i, '');
    if (!sub) {
      continue;
    }
    const key = sub.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(sub);
  }
  return out;
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
 * Public Atom top feed URL (Story 90-1). Replaces retired `.json` endpoint.
 *
 * @param {string} subreddit
 * @returns {string}
 */
export function buildRedditPublicTopUrl(subreddit) {
  const sub = encodeURIComponent(subreddit);
  return `${REDDIT_PUBLIC_BASE}/${sub}/top/.rss?t=day`;
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
 * @param {unknown} link
 * @returns {string}
 */
export function atomLinkHref(link) {
  if (typeof link === 'string') {
    return link.trim();
  }
  if (Array.isArray(link)) {
    for (const item of link) {
      const href = atomLinkHref(item);
      if (href) {
        return href;
      }
    }
    return '';
  }
  if (link && typeof link === 'object') {
    const row = /** @type {Record<string, unknown>} */ (link);
    if (typeof row.href === 'string') {
      return row.href.trim();
    }
    const dollar = row.$;
    if (dollar && typeof dollar === 'object') {
      const href = /** @type {Record<string, unknown>} */ (dollar).href;
      if (typeof href === 'string') {
        return href.trim();
      }
    }
  }
  return '';
}

/**
 * Map one rss-parser Atom item → stdout post. Omits upvotes/commentCount (never coerce to 0).
 *
 * @param {unknown} item
 * @returns {{
 *   title: string,
 *   url: string,
 *   publishedAt?: string,
 *   author?: string,
 *   externalId?: string,
 * } | null}
 */
export function mapRedditAtomItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const title = String(row.title ?? '').trim();
  const url = absoluteRedditUrl(atomLinkHref(row.link));
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
  const rawId = String(row.id ?? row.guid ?? '').trim();
  const externalId = rawId || undefined;
  return {
    title,
    url,
    ...(publishedAt ? { publishedAt } : {}),
    ...(author ? { author } : {}),
    ...(externalId ? { externalId } : {}),
  };
}

/**
 * @param {unknown} feedOrItems
 * @param {number} cap
 * @returns {Array<{ title: string, url: string, publishedAt?: string, author?: string, externalId?: string }>}
 */
export function mapRedditAtomToPosts(feedOrItems, cap) {
  /** @type {unknown[]} */
  let items = [];
  if (Array.isArray(feedOrItems)) {
    items = feedOrItems;
  } else if (feedOrItems && typeof feedOrItems === 'object') {
    const feed = /** @type {{ items?: unknown[] }} */ (feedOrItems);
    if (Array.isArray(feed.items)) {
      items = feed.items;
    }
  }
  /** @type {Array<{ title: string, url: string, publishedAt?: string, author?: string, externalId?: string }>} */
  const posts = [];
  for (const item of items) {
    if (posts.length >= cap) {
      break;
    }
    const mapped = mapRedditAtomItem(item);
    if (mapped) {
      posts.push(mapped);
    }
  }
  return posts;
}

/**
 * @param {Array<{ title: string, url: string, publishedAt?: string, author?: string, externalId?: string }>} batches
 * @param {number} maxPosts
 * @returns {Array<{ title: string, url: string, publishedAt?: string, author?: string, externalId?: string }>}
 */
export function dedupePostsByUrl(batches, maxPosts) {
  const seen = new Set();
  /** @type {Array<{ title: string, url: string, publishedAt?: string, author?: string, externalId?: string }>} */
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
 * @param {number} ms
 * @returns {Promise<void>}
 */
function defaultSleep(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

/**
 * @param {string} subreddit
 * @param {number} perSubreddit
 * @param {typeof fetch} fetchFn
 * @param {string | undefined} [fixtureXml]
 * @param {{ parser?: import('rss-parser').default }} [options]
 * @returns {Promise<{ ok: true, posts: ReturnType<typeof mapRedditAtomToPosts> } | { ok: false, reason: string }>}
 */
export async function fetchRedditPublicTop(
  subreddit,
  perSubreddit,
  fetchFn,
  fixtureXml,
  options = {},
) {
  const parser = options.parser ?? new Parser();
  try {
    let xml = fixtureXml;
    if (xml === undefined) {
      const url = buildRedditPublicTopUrl(subreddit);
      const res = await fetchFn(url, {
        signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': REDDIT_USER_AGENT,
          Accept: 'application/atom+xml, application/xml, text/xml, */*',
        },
      });
      if (!res.ok) {
        return { ok: false, reason: `http-${res.status}` };
      }
      xml = await res.text();
    }
    const feed = await parser.parseString(xml);
    return { ok: true, posts: mapRedditAtomToPosts(feed, perSubreddit) };
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 80)
        : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, reason: name };
    }
    return { ok: false, reason: message || name || 'parse-error' };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   fetch?: typeof fetch,
 *   fixtureXml?: string,
 *   fixtureXmlBySubreddit?: Record<string, string>,
 *   paceMs?: number,
 *   budgetMs?: number,
 *   nowMs?: () => number,
 *   sleep?: (ms: number) => Promise<void>,
 *   parser?: import('rss-parser').default,
 * }} [options]
 * @returns {Promise<{ posts?: unknown[], error?: string }>}
 */
export async function runRedditFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadRedditConfig(env);
  const paceMs =
    typeof options.paceMs === 'number' && Number.isFinite(options.paceMs)
      ? Math.max(0, options.paceMs)
      : SUBREDDIT_PACE_MS_DEFAULT;
  const budgetMs =
    typeof options.budgetMs === 'number' && Number.isFinite(options.budgetMs)
      ? Math.max(0, options.budgetMs)
      : ADAPTER_BUDGET_MS;
  const nowMs = typeof options.nowMs === 'function' ? options.nowMs : () => Date.now();
  const sleep = options.sleep ?? defaultSleep;

  if (!config.enabled) {
    return { error: 'reddit disabled' };
  }
  if (config.subreddits.length === 0) {
    return { error: 'missing-subreddits' };
  }

  /** @type {Array<{ title: string, url: string, publishedAt?: string, author?: string, externalId?: string }>} */
  const collected = [];
  const started = nowMs();
  /** @type {string | undefined} */
  let lastError;
  for (let i = 0; i < config.subreddits.length; i += 1) {
    const elapsed = nowMs() - started;
    if (budgetMs > 0 && elapsed >= budgetMs) {
      break;
    }
    if (i > 0 && paceMs > 0) {
      if (budgetMs > 0 && elapsed + paceMs >= budgetMs) {
        break;
      }
      await sleep(paceMs);
      if (budgetMs > 0 && nowMs() - started >= budgetMs) {
        break;
      }
    }
    const subreddit = config.subreddits[i];
    const fixture =
      options.fixtureXmlBySubreddit?.[subreddit] ??
      (options.fixtureXml !== undefined && config.subreddits.length === 1
        ? options.fixtureXml
        : undefined);
    const result = await fetchRedditPublicTop(subreddit, config.perSubreddit, fetchFn, fixture, {
      parser: options.parser,
    });
    if (!result.ok) {
      lastError = result.reason;
      continue;
    }
    collected.push(...result.posts);
  }

  if (collected.length === 0) {
    return { error: lastError || 'all-subreddits-failed' };
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
