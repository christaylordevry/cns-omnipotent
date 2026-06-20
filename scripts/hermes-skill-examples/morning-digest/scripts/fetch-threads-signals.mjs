// fetch-threads-signals.mjs — ScrapeCreators Threads for morning-digest Source 18
// Usage: node fetch-threads-signals.mjs
// stdout: {"posts":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure
//
// Platform limit: GET /v1/threads/user/posts returns only the last 20–30 publicly
// visible posts per handle. Sparse results are expected — not an adapter bug.

import { fileURLToPath, URL } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';
import { classifyScrapeCreatorsHttpError } from './fetch-tiktok-signals.mjs';

const SCRAPECREATORS_API_BASE = 'https://api.scrapecreators.com';
const FETCH_TIMEOUT_MS = 15_000;
const ITERATION_DELAY_MS = 100;
const MAX_POSTS_DEFAULT = 15;
const MAX_POSTS_HARD = 30;
const PER_HANDLE_DEFAULT = 5;
const PER_KEYWORD_DEFAULT = 5;
const LOOKBACK_HOURS_DEFAULT = 168;
const MAX_KEYWORDS = 5;
const CREDIT_WARN_THRESHOLD = 50;
const TITLE_MAX_CHARS = 280;

/**
 * T0 spike 2026-06-20: GET /v1/threads/search?query=ai&trim=true returned HTTP 200
 * with posts[] (operator docs site showed "Endpoint not found" — live API works).
 * Set false to disable keyword supplement without removing env parsing.
 */
export const THREADS_SEARCH_ENDPOINT_AVAILABLE = true;

export const DEFAULT_THREADS_HANDLES = Object.freeze([
  'sama',
  'karpathy',
  'AnthropicAI',
  'simonw',
  'emollick',
]);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isThreadsEnabled(value) {
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
export function parseThreadsHandles(raw) {
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
  return unique;
}

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseThreadsKeywords(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   apiKey?: string,
 *   handles: string[],
 *   keywords: string[],
 *   maxPosts: number,
 *   perHandle: number,
 *   perKeyword: number,
 *   lookbackHours: number,
 *   searchEndpointAvailable: boolean,
 * }}
 */
export function loadThreadsConfig(env = process.env) {
  const enabled = isThreadsEnabled(env.MORNING_DIGEST_THREADS_ENABLED);
  const apiKey = String(env.SCRAPECREATORS_API_KEY ?? '').trim() || undefined;
  const handles = parseThreadsHandles(env.MORNING_DIGEST_THREADS_HANDLES);
  const keywords =
    THREADS_SEARCH_ENDPOINT_AVAILABLE && env.MORNING_DIGEST_THREADS_KEYWORDS
      ? parseThreadsKeywords(env.MORNING_DIGEST_THREADS_KEYWORDS)
      : [];
  const rawMax = parseInt(String(env.MORNING_DIGEST_THREADS_MAX_POSTS ?? ''), 10);
  const rawPerHandle = parseInt(String(env.MORNING_DIGEST_THREADS_PER_HANDLE ?? ''), 10);
  const rawPerKeyword = parseInt(String(env.MORNING_DIGEST_THREADS_PER_KEYWORD ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_THREADS_LOOKBACK_HOURS ?? ''), 10);
  const maxPosts =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_POSTS_HARD) : MAX_POSTS_DEFAULT;
  const perHandle =
    Number.isFinite(rawPerHandle) && rawPerHandle > 0 ? rawPerHandle : PER_HANDLE_DEFAULT;
  const perKeyword =
    Number.isFinite(rawPerKeyword) && rawPerKeyword > 0 ? rawPerKeyword : PER_KEYWORD_DEFAULT;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  return {
    enabled,
    apiKey,
    handles,
    keywords,
    maxPosts,
    perHandle,
    perKeyword,
    lookbackHours,
    searchEndpointAvailable: THREADS_SEARCH_ENDPOINT_AVAILABLE,
  };
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
 * @param {unknown} value
 * @returns {number}
 */
export function parseCount(value) {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @param {unknown} item
 * @param {string} [fallbackHandle]
 * @returns {Record<string, unknown> | null}
 */
export function mapThreadsPost(item, fallbackHandle = '') {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const caption =
    row.caption && typeof row.caption === 'object'
      ? /** @type {Record<string, unknown>} */ (row.caption)
      : {};
  const captionText = String(caption.text ?? row.text ?? '').trim();
  if (!captionText) {
    return null;
  }

  const userRow =
    row.user && typeof row.user === 'object'
      ? /** @type {Record<string, unknown>} */ (row.user)
      : {};
  const authorHandle = String(userRow.username ?? fallbackHandle ?? '').trim().replace(/^@/, '');
  const code = String(row.code ?? '').trim();
  const postId = String(row.id ?? row.pk ?? '').trim();
  const urlFromApi = normalizeUrl(row.url);
  const url =
    urlFromApi ||
    (authorHandle && code
      ? `https://www.threads.com/@${authorHandle}/post/${code}`
      : '');

  const reshareCount = parseCount(row.reshare_count ?? row.reshareCount);
  const repostCount = parseCount(row.repost_count ?? row.repostCount);
  const reposts = reshareCount + repostCount;

  let publishedAt;
  const takenAt = row.taken_at ?? row.takenAt;
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

  const title =
    captionText.length > TITLE_MAX_CHARS
      ? `${captionText.slice(0, TITLE_MAX_CHARS - 1)}…`
      : captionText;

  return {
    title,
    url: url || undefined,
    authorHandle: authorHandle || fallbackHandle || undefined,
    author: authorHandle || fallbackHandle || undefined,
    publishedAt,
    likes: parseCount(row.like_count ?? row.likeCount),
    reposts,
    replies: parseCount(row.direct_reply_count ?? row.directReplyCount),
    postCode: code || undefined,
    postId: postId || undefined,
  };
}

/**
 * @param {{ postId?: unknown, postCode?: unknown, code?: unknown, url?: unknown }} row
 * @returns {string | null}
 */
export function threadsDedupeKey(row) {
  const postId = String(row.postId ?? row.id ?? '').trim();
  if (postId) {
    return `th:${postId}`;
  }
  const code = String(row.postCode ?? row.code ?? '').trim();
  if (code) {
    return `th:code:${code}`;
  }
  const url = normalizeUrl(row.url);
  return url ? `th:url:${url}` : null;
}

/**
 * @param {unknown} json
 * @param {number} limit
 * @param {string} [fallbackHandle]
 * @returns {ReturnType<typeof mapThreadsPost>[]}
 */
export function parseThreadsPostsResponse(json, limit, fallbackHandle = '') {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const row = /** @type {Record<string, unknown>} */ (json);
  const list = row.posts ?? row.items;
  if (!Array.isArray(list)) {
    return [];
  }
  /** @type {ReturnType<typeof mapThreadsPost>[]} */
  const posts = [];
  for (const item of list) {
    if (posts.length >= limit) {
      break;
    }
    const mapped = mapThreadsPost(item, fallbackHandle);
    if (mapped) {
      posts.push(mapped);
    }
  }
  return posts;
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
 * @param {ReturnType<typeof mapThreadsPost>[]} candidates
 * @param {number} maxPosts
 * @param {number} lookbackHours
 * @param {Date} [now]
 * @returns {ReturnType<typeof mapThreadsPost>[]}
 */
export function dedupeAndFilterPosts(candidates, maxPosts, lookbackHours, now = new Date()) {
  const seen = new Set();
  /** @type {ReturnType<typeof mapThreadsPost>[]} */
  const posts = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!isWithinLookback(candidate.publishedAt, lookbackHours, now)) {
      continue;
    }
    const key = threadsDedupeKey(candidate);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    posts.push(candidate);
    if (posts.length >= maxPosts) {
      break;
    }
  }
  return posts;
}

/**
 * @param {string} path
 * @param {Record<string, string>} params
 * @param {string} apiKey
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<
 *   | { ok: true, json: unknown }
 *   | { ok: false, reason: string, fatal?: boolean }
 * >}
 */
export async function fetchThreadsApi(path, params, apiKey, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    return { ok: true, json: fixtureJson };
  }

  const searchParams = new URLSearchParams({ ...params, trim: 'true' });
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
      if (res.status === 404 || String(json?.message ?? json?.error ?? '').toLowerCase().includes('endpoint not found')) {
        return { ok: false, reason: 'search-endpoint-unavailable', fatal: false };
      }
      return { ok: false, reason, fatal };
    }
    const body =
      json && typeof json === 'object'
        ? /** @type {Record<string, unknown>} */ (json)
        : {};
    if (body.success === false) {
      const message = String(body.message ?? body.error ?? '').toLowerCase();
      if (message.includes('endpoint not found')) {
        return { ok: false, reason: 'search-endpoint-unavailable', fatal: false };
      }
    }
    return { ok: true, json };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, fixtures?: Record<string, unknown>, now?: Date }} [options]
 * @returns {Promise<{ posts?: ReturnType<typeof mapThreadsPost>[], error?: string }>}
 */
export async function runThreadsFetch(env = process.env, options = {}) {
  const config = loadThreadsConfig(env);
  const fetchFn = options.fetch ?? globalThis.fetch;
  const fixtures = options.fixtures ?? {};
  const now = options.now ?? new Date();

  if (!config.enabled) {
    return { error: 'threads disabled' };
  }
  if (!config.apiKey) {
    return { error: 'missing-api-key' };
  }
  if (config.handles.length === 0) {
    return { error: 'missing-handles' };
  }

  const estimatedCredits = config.handles.length + config.keywords.length;
  if (estimatedCredits >= CREDIT_WARN_THRESHOLD) {
    console.error(
      `threads credit warning: ~${estimatedCredits} ScrapeCreators calls scheduled (handles=${config.handles.length}, keywords=${config.keywords.length})`,
    );
  }

  /** @type {ReturnType<typeof mapThreadsPost>[]} */
  const candidates = [];
  let lastFailureReason = 'threads fetch failed';
  let fatalHit = false;

  for (const handle of config.handles) {
    if (fatalHit) {
      break;
    }
    const result = await fetchThreadsApi(
      '/v1/threads/user/posts',
      { handle },
      config.apiKey,
      fetchFn,
      fixtures[`handle:${handle}`],
    );
    if (!result.ok) {
      lastFailureReason = result.reason;
      if (result.fatal) {
        fatalHit = true;
        break;
      }
      console.error(`threads user/posts failed for @${handle}: ${result.reason}`);
      await delayMs(ITERATION_DELAY_MS);
      continue;
    }
    candidates.push(...parseThreadsPostsResponse(result.json, config.perHandle, handle));
    await delayMs(ITERATION_DELAY_MS);
  }

  if (fatalHit) {
    return { error: lastFailureReason.slice(0, 120) };
  }

  if (config.keywords.length > 0 && config.searchEndpointAvailable) {
    for (const keyword of config.keywords) {
      const result = await fetchThreadsApi(
        '/v1/threads/search',
        { query: keyword },
        config.apiKey,
        fetchFn,
        fixtures[`keyword:${keyword}`],
      );
      if (!result.ok) {
        if (result.reason === 'search-endpoint-unavailable') {
          console.error('threads keyword supplement skipped: search-endpoint-unavailable');
          break;
        }
        console.error(`threads search failed for "${keyword}": ${result.reason}`);
        if (result.fatal) {
          // Keyword-path fatals must not discard handle-sourced candidates (Story 72-7 review).
          break;
        }
        await delayMs(ITERATION_DELAY_MS);
        continue;
      }
      const searchPosts = parseThreadsPostsResponse(result.json, config.perKeyword);
      candidates.push(...searchPosts);
      if (searchPosts.length > 0) {
        console.error(`threads keyword supplement: ${searchPosts.length} posts from "${keyword}" (supplementary)`);
      }
      await delayMs(ITERATION_DELAY_MS);
    }
  }

  const posts = dedupeAndFilterPosts(candidates, config.maxPosts, config.lookbackHours, now);
  if (posts.length === 0 && candidates.length === 0 && lastFailureReason !== 'threads fetch failed') {
    return { error: lastFailureReason.slice(0, 120) };
  }

  return { posts };
}

async function main() {
  const env = await mergeTrendIngestEnv(process.env);
  const payload = await runThreadsFetch(env);
  console.log(JSON.stringify(payload));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ error: message.slice(0, 120) }));
    process.exit(0);
  });
}
