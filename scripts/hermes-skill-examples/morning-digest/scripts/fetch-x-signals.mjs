// fetch-x-signals.mjs — X/Twitter GraphQL for morning-digest Source 11
// Usage: node fetch-x-signals.mjs
// stdout: {"posts":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';
import { TwitterClientBase } from './vendor/bird-search/lib/twitter-client-base.js';
import { withSearch } from './vendor/bird-search/lib/twitter-client-search.js';

const SearchClient = withSearch(TwitterClientBase);

const FETCH_TIMEOUT_MS = 15_000;
const SEARCH_DELAY_MS = 100;
const MAX_TWEETS_DEFAULT = 20;
const MAX_TWEETS_HARD = 50;
const LOOKBACK_HOURS_DEFAULT = 24;
const MAX_SEARCH_QUERIES = 3;
const TITLE_MAX_CHARS = 280;
const JSON_RETRY_DELAY_MS = 5000;
const MAX_JSON_RETRIES = 1;

export const DEFAULT_X_ACCOUNTS = [
  'karpathy',
  'sama',
  'ylecun',
  'emollick',
  'simonw',
];

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isXEnabled(value) {
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
export function parseAccounts(raw, options = {}) {
  const parsed = String(raw ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^@/, ''))
    .filter(Boolean);
  const seen = new Set();
  /** @type {string[]} */
  const unique = [];
  for (const handle of parsed) {
    const key = handle.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(handle);
  }
  if (unique.length > 0) {
    return unique;
  }
  return options.useDefaultWhenEmpty ? [...DEFAULT_X_ACCOUNTS] : [];
}

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseSearchQueries(raw) {
  const parsed = String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parsed.slice(0, MAX_SEARCH_QUERIES);
}

/**
 * @param {number} lookbackHours
 * @param {Date} [now]
 * @returns {string}
 */
export function buildSinceDate(lookbackHours, now = new Date()) {
  const cutoff = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const yyyy = cutoff.getUTCFullYear();
  const mm = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cutoff.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   authToken: string,
 *   ct0: string,
 *   accounts: string[],
 *   searchQueries: string[],
 *   maxTweets: number,
 *   lookbackHours: number,
 * }}
 */
export function loadXConfig(env = process.env) {
  const enabled = isXEnabled(env.MORNING_DIGEST_X_ENABLED);
  const authToken = String(
    env.X_AUTH_TOKEN ?? env.AUTH_TOKEN ?? env.TWITTER_AUTH_TOKEN ?? '',
  ).trim();
  const ct0 = String(env.X_CT0 ?? env.CT0 ?? env.TWITTER_CT0 ?? '').trim();
  const accountsRaw = env.MORNING_DIGEST_X_ACCOUNTS;
  const accounts =
    accountsRaw === undefined || accountsRaw === null
      ? parseAccounts('', { useDefaultWhenEmpty: true })
      : parseAccounts(accountsRaw, { useDefaultWhenEmpty: false });
  const searchQueries = parseSearchQueries(env.MORNING_DIGEST_X_SEARCH_QUERIES);
  const rawMax = parseInt(String(env.MORNING_DIGEST_X_MAX_TWEETS ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_X_LOOKBACK_HOURS ?? ''), 10);
  const maxTweets =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_TWEETS_HARD) : MAX_TWEETS_DEFAULT;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  return { enabled, authToken, ct0, accounts, searchQueries, maxTweets, lookbackHours };
}

/**
 * @param {string} text
 * @returns {string}
 */
export function truncateTitle(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length <= TITLE_MAX_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, TITLE_MAX_CHARS - 1)}…`;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {unknown} createdAt
 * @returns {string | undefined}
 */
export function parsePublishedAt(createdAt) {
  const raw = String(createdAt ?? '').trim();
  if (!raw) {
    return undefined;
  }
  if (raw.length > 10 && raw[10] === 'T') {
    const ts = Date.parse(raw);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : undefined;
  }
  const twitterMatch = raw.match(
    /^(\w{3}) (\w{3}) (\d{1,2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4}) (\d{4})$/,
  );
  if (twitterMatch) {
    const ts = Date.parse(raw);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : undefined;
  }
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : undefined;
}

/**
 * @param {unknown} tweet
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
export function mapBirdTweet(tweet) {
  if (!tweet || typeof tweet !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (tweet);
  const author =
    row.author && typeof row.author === 'object'
      ? /** @type {Record<string, unknown>} */ (row.author)
      : row.user && typeof row.user === 'object'
        ? /** @type {Record<string, unknown>} */ (row.user)
        : {};
  const authorHandle = String(
    author.username ?? author.screen_name ?? row.author_handle ?? '',
  )
    .trim()
    .replace(/^@/, '');
  const title = truncateTitle(String(row.text ?? row.full_text ?? ''));
  let url = String(row.permanent_url ?? row.url ?? '').trim();
  if (!url && row.id && authorHandle) {
    url = `https://x.com/${authorHandle}/status/${row.id}`;
  }
  if (!title || !authorHandle || !url) {
    return null;
  }
  const likes = toCount(row.likeCount ?? row.like_count ?? row.favorite_count);
  const reposts = toCount(row.retweetCount ?? row.retweet_count);
  const replies = toCount(row.replyCount ?? row.reply_count);
  const quotes = toCount(row.quoteCount ?? row.quote_count);
  const publishedAt = parsePublishedAt(row.createdAt ?? row.created_at);
  return {
    title,
    authorHandle,
    url,
    likes,
    reposts,
    replies,
    quotes,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {string} url
 * @returns {string}
 */
export function normalizeTweetUrl(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.replace(/^twitter\.com$/i, 'x.com');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return trimmed.replace(/^https?:\/\/twitter\.com/i, 'https://x.com');
  }
}

/**
 * @param {{ url?: string, authorHandle?: string }} post
 * @returns {string}
 */
export function tweetDedupeKey(post) {
  const normalized = normalizeTweetUrl(post.url);
  const statusMatch = normalized.match(/\/status\/(\d+)/i);
  if (statusMatch) {
    return `status:${statusMatch[1]}`;
  }
  return normalized;
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
    const key = tweetDedupeKey(post);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
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
 * @param {Record<string, string | undefined>} env
 */
export function applyXCredentialEnv(env) {
  process.env.AUTH_TOKEN =
    env.X_AUTH_TOKEN ?? env.AUTH_TOKEN ?? env.TWITTER_AUTH_TOKEN ?? '';
  process.env.CT0 = env.X_CT0 ?? env.CT0 ?? env.TWITTER_CT0 ?? '';
  process.env.BIRD_DISABLE_BROWSER_COOKIES = '1';
}

/**
 * @param {string} query
 * @param {string} sinceDate
 * @returns {string}
 */
export function appendSinceToQuery(query, sinceDate) {
  const trimmed = String(query ?? '').trim();
  if (/\bsince:\d{4}-\d{2}-\d{2}\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} since:${sinceDate}`;
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function isSessionInvalidError(message) {
  const text = String(message ?? '');
  if (/401|403|unauthorized|forbidden/i.test(text)) {
    return true;
  }
  const lower = text.toLowerCase();
  return (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('login') ||
    lower.includes('sign in') ||
    lower.includes('invalid json') ||
    lower.includes('unexpected token')
  );
}

/**
 * @param {string} message
 * @returns {boolean}
 */
function isRetryableSearchError(message) {
  const lower = String(message ?? '').toLowerCase();
  return (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('invalid json') ||
    lower.includes('unexpected token')
  );
}

/**
 * @param {InstanceType<ReturnType<typeof withSearch>>} client
 * @param {string} query
 * @param {number} count
 * @returns {Promise<{ tweets?: unknown[], error?: string }>}
 */
export async function searchWithRetry(client, query, count) {
  let lastError = 'search failed';
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt += 1) {
    try {
      const result = await client.search(query, count);
      if (result.success) {
        return { tweets: result.tweets ?? [] };
      }
      lastError = String(result.error ?? 'search failed');
      if (!isRetryableSearchError(lastError) || attempt >= MAX_JSON_RETRIES) {
        return { error: lastError.slice(0, 120) };
      }
      await delayMs(JSON_RETRY_DELAY_MS);
    } catch (err) {
      lastError =
        err && typeof err === 'object' && 'message' in err
          ? String(/** @type {{ message: unknown }} */ (err).message)
          : 'search error';
      if (!isRetryableSearchError(lastError) || attempt >= MAX_JSON_RETRIES) {
        return { error: lastError.slice(0, 120) };
      }
      await delayMs(JSON_RETRY_DELAY_MS);
    }
  }
  return { error: lastError.slice(0, 120) };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   searchClient?: { search: (query: string, count: number) => Promise<{ success: boolean, tweets?: unknown[], error?: string }> },
 *   fixtures?: Record<string, unknown[]>,
 *   now?: Date,
 * }} [options]
 * @returns {Promise<{ posts?: unknown[], error?: string }>}
 */
export async function runXFetch(env, options = {}) {
  const config = loadXConfig(env);

  if (!config.enabled) {
    return { error: 'x disabled' };
  }
  if (!config.authToken || !config.ct0) {
    return { error: 'X credentials not configured' };
  }
  if (config.accounts.length === 0 && config.searchQueries.length === 0) {
    return { error: 'no x accounts configured' };
  }

  const sinceDate = buildSinceDate(config.lookbackHours, options.now);
  /** @type {string[]} */
  const queries = [];
  for (const handle of config.accounts) {
    queries.push(`from:${handle} since:${sinceDate}`);
  }
  for (const query of config.searchQueries) {
    queries.push(appendSinceToQuery(query, sinceDate));
  }

  /** @type {Array<NonNullable<ReturnType<typeof mapBirdTweet>>>} */
  const aggregated = [];
  let sawSuccess = false;

  if (options.fixtures) {
    for (const query of queries) {
      const tweets = options.fixtures[query];
      if (!Array.isArray(tweets)) {
        continue;
      }
      for (const tweet of tweets) {
        const mapped = mapBirdTweet(tweet);
        if (mapped) {
          aggregated.push(mapped);
        }
      }
    }
    return { posts: sortAndCapPosts(dedupePostsByUrl(aggregated), config.maxTweets) };
  }

  applyXCredentialEnv(env);
  const client =
    options.searchClient ??
    new SearchClient({
      cookies: {
        authToken: config.authToken,
        ct0: config.ct0,
        cookieHeader: `auth_token=${config.authToken}; ct0=${config.ct0}`,
      },
      timeoutMs: FETCH_TIMEOUT_MS,
    });

  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    if (index > 0) {
      await delayMs(SEARCH_DELAY_MS);
    }

    const perQueryCount = Math.min(
      MAX_TWEETS_HARD,
      Math.max(5, Math.ceil(config.maxTweets / Math.max(queries.length, 1))),
    );
    const result = await searchWithRetry(client, query, perQueryCount);
    if (result.error) {
      console.error(`x search failed for "${query}": ${result.error}`);
      if (isSessionInvalidError(result.error)) {
        if (!sawSuccess && aggregated.length === 0) {
          return { error: 'X session invalid' };
        }
        break;
      }
      continue;
    }

    sawSuccess = true;
    for (const tweet of result.tweets ?? []) {
      const mapped = mapBirdTweet(tweet);
      if (mapped) {
        aggregated.push(mapped);
      }
    }
  }

  if (!sawSuccess && aggregated.length === 0) {
    return { error: 'x fetch failed' };
  }

  const deduped = dedupePostsByUrl(aggregated);
  return { posts: sortAndCapPosts(deduped, config.maxTweets) };
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
    applyXCredentialEnv(merged);
    const payload = await runXFetch(merged);
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
