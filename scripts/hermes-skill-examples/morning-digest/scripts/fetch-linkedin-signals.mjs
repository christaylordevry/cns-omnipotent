// fetch-linkedin-signals.mjs — ScrapeCreators LinkedIn for morning-digest Source 19
// Usage: node fetch-linkedin-signals.mjs
// stdout: {"posts":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure
//
// Professional intelligence layer: company positioning, hiring narratives, B2B/founder
// discourse — not real-time trend chatter.
//
// Keyword search (/v1/linkedin/search/posts) is Google-index-backed. Results reflect
// what Google has indexed, not a live LinkedIn-native feed. Sparse keyword results may
// lag actual posting activity — source characteristic, not adapter bug.
//
// Public profile endpoint does not reliably return work history or job title — do not
// design scoring or digest copy around those fields.

import { fileURLToPath, URL } from 'node:url';
import { setTimeout as delayMs } from 'node:timers/promises';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';
import { classifyScrapeCreatorsHttpError } from './fetch-tiktok-signals.mjs';

const SCRAPECREATORS_API_BASE = 'https://api.scrapecreators.com';
const FETCH_TIMEOUT_MS = 15_000;
const ITERATION_DELAY_MS = 100;
const MAX_POSTS_DEFAULT = 15;
const MAX_POSTS_HARD = 30;
const PER_TARGET_DEFAULT = 5;
const PER_KEYWORD_DEFAULT = 5;
const LOOKBACK_HOURS_DEFAULT = 168;
const MAX_KEYWORDS = 5;
const MAX_COMPANY_PAGES = 7;
const CREDIT_WARN_THRESHOLD = 50;
const TITLE_MAX_CHARS = 280;

/**
 * T0 spike 2026-06-20: GET /v1/linkedin/search/posts?query=ai+agents&date_posted=last-week
 * returned HTTP 200 with 10 posts (likeCount, commentCount, description, author).
 * Set false to disable keyword supplement without removing env parsing.
 */
export const LINKEDIN_SEARCH_ENDPOINT_AVAILABLE = true;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isLinkedinEnabled(value) {
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
export function parseLinkedinList(raw) {
  const parsed = String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set();
  /** @type {string[]} */
  const unique = [];
  for (const entry of parsed) {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseLinkedinKeywords(raw) {
  return parseLinkedinList(raw).slice(0, MAX_KEYWORDS);
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeLinkedinCompanyEntry(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const slug = trimmed.replace(/^company\//i, '');
  return `https://www.linkedin.com/company/${slug}`;
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeLinkedinProfileEntry(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const vanity = trimmed.replace(/^in\//i, '');
  return `https://www.linkedin.com/in/${vanity}`;
}

/**
 * @param {string} companyUrl
 * @returns {string}
 */
export function extractCompanySlug(companyUrl) {
  const match = String(companyUrl ?? '').match(/\/company\/([^/?#]+)/i);
  return match ? match[1] : '';
}

/**
 * @param {string} profileUrl
 * @returns {string}
 */
export function extractProfileVanity(profileUrl) {
  const match = String(profileUrl ?? '').match(/\/in\/([^/?#]+)/i);
  return match ? match[1] : '';
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   apiKey?: string,
 *   companies: string[],
 *   profiles: string[],
 *   keywords: string[],
 *   maxPosts: number,
 *   perTarget: number,
 *   perKeyword: number,
 *   maxPages: number,
 *   lookbackHours: number,
 *   searchEndpointAvailable: boolean,
 * }}
 */
export function loadLinkedinConfig(env = process.env) {
  const enabled = isLinkedinEnabled(env.MORNING_DIGEST_LINKEDIN_ENABLED);
  const apiKey = String(env.SCRAPECREATORS_API_KEY ?? '').trim() || undefined;
  const companies = parseLinkedinList(env.MORNING_DIGEST_LINKEDIN_COMPANIES)
    .map(normalizeLinkedinCompanyEntry)
    .filter(Boolean);
  const profiles = parseLinkedinList(env.MORNING_DIGEST_LINKEDIN_PROFILES)
    .map(normalizeLinkedinProfileEntry)
    .filter(Boolean);
  const keywords =
    LINKEDIN_SEARCH_ENDPOINT_AVAILABLE && env.MORNING_DIGEST_LINKEDIN_KEYWORDS
      ? parseLinkedinKeywords(env.MORNING_DIGEST_LINKEDIN_KEYWORDS)
      : [];
  const rawMax = parseInt(String(env.MORNING_DIGEST_LINKEDIN_MAX_POSTS ?? ''), 10);
  const rawPerTarget = parseInt(String(env.MORNING_DIGEST_LINKEDIN_PER_TARGET ?? ''), 10);
  const rawPerKeyword = parseInt(String(env.MORNING_DIGEST_LINKEDIN_PER_KEYWORD ?? ''), 10);
  const rawPages = parseInt(String(env.MORNING_DIGEST_LINKEDIN_MAX_PAGES ?? ''), 10);
  const rawLookback = parseInt(String(env.MORNING_DIGEST_LINKEDIN_LOOKBACK_HOURS ?? ''), 10);
  const maxPosts =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.min(rawMax, MAX_POSTS_HARD) : MAX_POSTS_DEFAULT;
  const perTarget =
    Number.isFinite(rawPerTarget) && rawPerTarget > 0 ? rawPerTarget : PER_TARGET_DEFAULT;
  const perKeyword =
    Number.isFinite(rawPerKeyword) && rawPerKeyword > 0 ? rawPerKeyword : PER_KEYWORD_DEFAULT;
  const maxPages =
    Number.isFinite(rawPages) && rawPages > 0
      ? Math.min(rawPages, MAX_COMPANY_PAGES)
      : 1;
  const lookbackHours =
    Number.isFinite(rawLookback) && rawLookback > 0 ? rawLookback : LOOKBACK_HOURS_DEFAULT;
  return {
    enabled,
    apiKey,
    companies,
    profiles,
    keywords,
    maxPosts,
    perTarget,
    perKeyword,
    maxPages,
    lookbackHours,
    searchEndpointAvailable: LINKEDIN_SEARCH_ENDPOINT_AVAILABLE,
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
 * @param {string} text
 * @returns {string}
 */
function trimTitle(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= TITLE_MAX_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, TITLE_MAX_CHARS - 1)}…`;
}

/**
 * @param {unknown} authorUrl
 * @returns {string}
 */
function authorHandleFromUrl(authorUrl) {
  const url = String(authorUrl ?? '');
  const profile = url.match(/\/in\/([^/?#]+)/i);
  if (profile) {
    return profile[1];
  }
  const company = url.match(/\/company\/([^/?#]+)/i);
  return company ? company[1] : '';
}

/**
 * @param {unknown} item
 * @param {{ companyUrl?: string, companySlug?: string }} context
 * @returns {Record<string, unknown> | null}
 */
export function mapLinkedinCompanyPost(item, context = {}) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const text = String(row.text ?? row.description ?? '').trim();
  if (!text) {
    return null;
  }
  const url = normalizeUrl(row.url);
  const postId = String(row.id ?? '').trim();
  const companySlug =
    context.companySlug || extractCompanySlug(context.companyUrl ?? '') || undefined;
  return {
    title: trimTitle(text),
    url: url || undefined,
    author: companySlug || undefined,
    authorHandle: companySlug || undefined,
    publishedAt: String(row.datePublished ?? row.publishedAt ?? '').trim() || undefined,
    likes: parseCount(row.likeCount ?? row.likes),
    commentCount: parseCount(row.commentCount ?? row.comments),
    postId: postId || undefined,
    sourceKind: 'company',
  };
}

/**
 * @param {unknown} item
 * @returns {Record<string, unknown> | null}
 */
export function mapLinkedinSearchPost(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const description = String(row.description ?? row.text ?? '').trim();
  if (!description) {
    return null;
  }
  const authorRow =
    row.author && typeof row.author === 'object'
      ? /** @type {Record<string, unknown>} */ (row.author)
      : {};
  const authorUrl = String(authorRow.url ?? '');
  const authorHandle = authorHandleFromUrl(authorUrl);
  const authorName = String(authorRow.name ?? authorHandle ?? '').trim();
  const url = normalizeUrl(row.url);
  const postIdMatch = url.match(/activity-(\d+)/);
  return {
    title: trimTitle(description),
    url: url || undefined,
    author: authorName || undefined,
    authorHandle: authorHandle || undefined,
    publishedAt: String(row.datePublished ?? row.publishedAt ?? '').trim() || undefined,
    likes: parseCount(row.likeCount ?? row.likes),
    commentCount: parseCount(row.commentCount ?? row.comments),
    postId: postIdMatch ? postIdMatch[1] : undefined,
    sourceKind: authorUrl.includes('/company/') ? 'company' : 'profile',
  };
}

/**
 * @param {unknown} item
 * @param {{ profileUrl?: string, profileName?: string, profileVanity?: string }} context
 * @returns {Record<string, unknown> | null}
 */
export function mapLinkedinProfileRecentPost(item, context = {}) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const text = String(row.title ?? row.text ?? row.description ?? '').trim();
  if (!text) {
    return null;
  }
  const vanity =
    context.profileVanity || extractProfileVanity(context.profileUrl ?? '') || undefined;
  const url = normalizeUrl(row.link ?? row.url);
  const postId = String(row.id ?? '').trim();
  return {
    title: trimTitle(text),
    url: url || undefined,
    author: context.profileName || vanity || undefined,
    authorHandle: vanity || undefined,
    publishedAt: String(row.datePublished ?? row.publishedAt ?? '').trim() || undefined,
    likes: parseCount(row.likeCount ?? row.likes),
    commentCount: parseCount(row.commentCount ?? row.comments),
    postId: postId || undefined,
    sourceKind: 'profile',
  };
}

/**
 * @param {{ postId?: unknown, url?: unknown }} row
 * @returns {string | null}
 */
export function linkedinDedupeKey(row) {
  const postId = String(row.postId ?? '').trim();
  if (postId) {
    return `li:${postId}`;
  }
  const url = normalizeUrl(row.url);
  return url ? `li:url:${url}` : null;
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
 * @param {ReturnType<typeof mapLinkedinCompanyPost>[]} candidates
 * @param {number} maxPosts
 * @param {number} lookbackHours
 * @param {Date} [now]
 * @returns {ReturnType<typeof mapLinkedinCompanyPost>[]}
 */
export function dedupeAndFilterPosts(candidates, maxPosts, lookbackHours, now = new Date()) {
  const seen = new Set();
  /** @type {ReturnType<typeof mapLinkedinCompanyPost>[]} */
  const posts = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (!isWithinLookback(candidate.publishedAt, lookbackHours, now)) {
      continue;
    }
    const key = linkedinDedupeKey(candidate);
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
 * @param {unknown} json
 * @param {number} limit
 * @param {{ companyUrl?: string, companySlug?: string }} [context]
 * @returns {ReturnType<typeof mapLinkedinCompanyPost>[]}
 */
export function parseLinkedinCompanyPostsResponse(json, limit, context = {}) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const row = /** @type {Record<string, unknown>} */ (json);
  const list = row.posts ?? row.data;
  if (!Array.isArray(list)) {
    return [];
  }
  /** @type {ReturnType<typeof mapLinkedinCompanyPost>[]} */
  const posts = [];
  for (const item of list) {
    if (posts.length >= limit) {
      break;
    }
    const mapped = mapLinkedinCompanyPost(item, context);
    if (mapped) {
      posts.push(mapped);
    }
  }
  return posts;
}

/**
 * @param {unknown} json
 * @param {number} limit
 * @returns {ReturnType<typeof mapLinkedinSearchPost>[]}
 */
export function parseLinkedinSearchPostsResponse(json, limit) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const row = /** @type {Record<string, unknown>} */ (json);
  const list = row.posts ?? row.data ?? row.results;
  if (!Array.isArray(list)) {
    return [];
  }
  /** @type {ReturnType<typeof mapLinkedinSearchPost>[]} */
  const posts = [];
  for (const item of list) {
    if (posts.length >= limit) {
      break;
    }
    const mapped = mapLinkedinSearchPost(item);
    if (mapped) {
      posts.push(mapped);
    }
  }
  return posts;
}

/**
 * @param {unknown} json
 * @param {number} limit
 * @param {{ profileUrl?: string, profileName?: string, profileVanity?: string }} [context]
 * @returns {ReturnType<typeof mapLinkedinProfileRecentPost>[]}
 */
export function parseLinkedinProfilePostsResponse(json, limit, context = {}) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const row = /** @type {Record<string, unknown>} */ (json);
  const list = row.recentPosts ?? row.posts ?? row.recent_posts;
  if (!Array.isArray(list)) {
    return [];
  }
  /** @type {ReturnType<typeof mapLinkedinProfileRecentPost>[]} */
  const posts = [];
  for (const item of list) {
    if (posts.length >= limit) {
      break;
    }
    const mapped = mapLinkedinProfileRecentPost(item, context);
    if (mapped) {
      posts.push(mapped);
    }
  }
  return posts;
}

/**
 * @param {string} path
 * @param {Record<string, string | number>} params
 * @param {string} apiKey
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<
 *   | { ok: true, json: unknown }
 *   | { ok: false, reason: string, fatal?: boolean }
 * >}
 */
export async function fetchLinkedinApi(path, params, apiKey, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    return { ok: true, json: fixtureJson };
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }
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
    const body =
      json && typeof json === 'object'
        ? /** @type {Record<string, unknown>} */ (json)
        : {};
    if (body.success === false) {
      const errorStatus = Number(body.errorStatus ?? 0);
      if (errorStatus === 404) {
        return { ok: false, reason: 'profile-not-found', fatal: false };
      }
      const message = String(body.message ?? body.error ?? '').toLowerCase();
      if (message.includes('private') || message.includes('not publicly available')) {
        return { ok: false, reason: 'profile-not-found', fatal: false };
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
 * @returns {Promise<{ posts?: ReturnType<typeof mapLinkedinCompanyPost>[], error?: string }>}
 */
export async function runLinkedinFetch(env = process.env, options = {}) {
  const config = loadLinkedinConfig(env);
  const fetchFn = options.fetch ?? globalThis.fetch;
  const fixtures = options.fixtures ?? {};
  const now = options.now ?? new Date();

  if (!config.enabled) {
    return { error: 'linkedin disabled' };
  }
  if (!config.apiKey) {
    return { error: 'missing-api-key' };
  }
  if (config.companies.length === 0 && config.profiles.length === 0) {
    return { error: 'missing-watchlist' };
  }

  const estimatedCredits =
    config.companies.length * config.maxPages +
    config.profiles.length +
    config.keywords.length;
  if (estimatedCredits >= CREDIT_WARN_THRESHOLD) {
    console.error(
      `linkedin credit warning: ~${estimatedCredits} ScrapeCreators calls scheduled (companies=${config.companies.length}, pages=${config.maxPages}, profiles=${config.profiles.length}, keywords=${config.keywords.length})`,
    );
  }

  /** @type {ReturnType<typeof mapLinkedinCompanyPost>[]} */
  const candidates = [];
  let lastFailureReason = 'linkedin fetch failed';
  let fatalHit = false;

  for (const companyUrl of config.companies) {
    if (fatalHit) {
      break;
    }
    const companySlug = extractCompanySlug(companyUrl);
    for (let page = 1; page <= config.maxPages; page += 1) {
      const fixtureKey = `company:${companyUrl}:page:${page}`;
      const result = await fetchLinkedinApi(
        '/v1/linkedin/company/posts',
        { url: companyUrl, page },
        config.apiKey,
        fetchFn,
        fixtures[fixtureKey] ?? (page === 1 ? fixtures[`company:${companyUrl}`] : undefined),
      );
      if (!result.ok) {
        lastFailureReason = result.reason;
        if (result.fatal) {
          fatalHit = true;
          break;
        }
        console.error(`linkedin company/posts failed for ${companyUrl} page ${page}: ${result.reason}`);
        break;
      }
      candidates.push(
        ...parseLinkedinCompanyPostsResponse(result.json, config.perTarget, {
          companyUrl,
          companySlug,
        }),
      );
      await delayMs(ITERATION_DELAY_MS);
      const parsed =
        result.json && typeof result.json === 'object'
          ? /** @type {Record<string, unknown>} */ (result.json)
          : {};
      const list = parsed.posts ?? parsed.data;
      if (!Array.isArray(list) || list.length === 0) {
        break;
      }
    }
    if (fatalHit) {
      break;
    }
    await delayMs(ITERATION_DELAY_MS);
  }

  if (fatalHit) {
    return { error: lastFailureReason.slice(0, 120) };
  }

  for (const profileUrl of config.profiles) {
    const result = await fetchLinkedinApi(
      '/v1/linkedin/profile',
      { url: profileUrl },
      config.apiKey,
      fetchFn,
      fixtures[`profile:${profileUrl}`],
    );
    if (!result.ok) {
      lastFailureReason = result.reason;
      if (result.fatal) {
        return { error: result.reason.slice(0, 120) };
      }
      console.error(`linkedin profile failed for ${profileUrl}: ${result.reason}`);
      await delayMs(ITERATION_DELAY_MS);
      continue;
    }
    const body =
      result.json && typeof result.json === 'object'
        ? /** @type {Record<string, unknown>} */ (result.json)
        : {};
    const profileName = String(body.name ?? '').trim();
    const profileVanity = extractProfileVanity(profileUrl);
    candidates.push(
      ...parseLinkedinProfilePostsResponse(result.json, config.perTarget, {
        profileUrl,
        profileName,
        profileVanity,
      }),
    );
    await delayMs(ITERATION_DELAY_MS);
  }

  if (config.keywords.length > 0 && config.searchEndpointAvailable) {
    for (const keyword of config.keywords) {
      const result = await fetchLinkedinApi(
        '/v1/linkedin/search/posts',
        { query: keyword, date_posted: 'last-week' },
        config.apiKey,
        fetchFn,
        fixtures[`keyword:${keyword}`],
      );
      if (!result.ok) {
        console.error(`linkedin search/posts failed for "${keyword}": ${result.reason}`);
        if (result.fatal) {
          break;
        }
        await delayMs(ITERATION_DELAY_MS);
        continue;
      }
      const searchPosts = parseLinkedinSearchPostsResponse(result.json, config.perKeyword);
      candidates.push(...searchPosts);
      if (searchPosts.length === 0) {
        console.error(`linkedin keyword supplement: search-thin-results for "${keyword}"`);
      } else {
        console.error(
          `linkedin keyword supplement: ${searchPosts.length} posts from "${keyword}" (Google-index-backed; supplementary)`,
        );
      }
      await delayMs(ITERATION_DELAY_MS);
    }
  }

  const posts = dedupeAndFilterPosts(candidates, config.maxPosts, config.lookbackHours, now);
  if (posts.length === 0 && candidates.length === 0 && lastFailureReason !== 'linkedin fetch failed') {
    return { error: lastFailureReason.slice(0, 120) };
  }

  return { posts };
}

async function main() {
  const env = await mergeTrendIngestEnv(process.env);
  const payload = await runLinkedinFetch(env);
  console.log(JSON.stringify(payload));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ error: message.slice(0, 120) }));
    process.exit(0);
  });
}
