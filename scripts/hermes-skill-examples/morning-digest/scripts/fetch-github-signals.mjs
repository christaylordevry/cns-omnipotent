// fetch-github-signals.mjs — GitHub search for morning-digest Source 7
// Usage: node fetch-github-signals.mjs
// stdout: {"repos":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REPOS_DEFAULT = 5;
const PER_QUERY_DEFAULT = 3;
const GITHUB_SEARCH_BASE = 'https://api.github.com/search/repositories';
const USER_AGENT = 'CNS-morning-digest/1.0';

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isGithubEnabled(value) {
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
export function parseGithubQueries(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ enabled: boolean, queries: string[], maxRepos: number, perQuery: number, token?: string }}
 */
export function loadGithubConfig(env = process.env) {
  const enabled = isGithubEnabled(env.MORNING_DIGEST_GITHUB_ENABLED);
  const queries = parseGithubQueries(env.MORNING_DIGEST_GITHUB_QUERIES);
  const rawMax = parseInt(String(env.MORNING_DIGEST_GITHUB_MAX_REPOS ?? ''), 10);
  const rawPerQuery = parseInt(String(env.MORNING_DIGEST_GITHUB_PER_QUERY ?? ''), 10);
  const maxRepos = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : MAX_REPOS_DEFAULT;
  const perQuery = Number.isFinite(rawPerQuery) && rawPerQuery > 0 ? rawPerQuery : PER_QUERY_DEFAULT;
  const token = String(env.GITHUB_TOKEN ?? '').trim() || undefined;
  return { enabled, queries, maxRepos, perQuery, token };
}

/**
 * @param {unknown} item
 * @returns {{ title: string, url: string, stars: number, forks: number, publishedAt?: string } | null}
 */
export function mapGithubRepoItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (item);
  const title = String(row.full_name ?? '').trim();
  const url = String(row.html_url ?? '').trim();
  if (!title || !url) {
    return null;
  }
  const stars = Number(row.stargazers_count);
  const forks = Number(row.forks_count);
  const pushedAt = row.pushed_at != null ? String(row.pushed_at) : '';
  const createdAt = row.created_at != null ? String(row.created_at) : '';
  const publishedAt = pushedAt || createdAt || undefined;
  return {
    title,
    url,
    stars: Number.isFinite(stars) ? stars : 0,
    forks: Number.isFinite(forks) ? forks : 0,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @param {number} perQuery
 * @returns {Array<{ title: string, url: string, stars: number, forks: number, publishedAt?: string }>}
 */
export function parseSearchResponse(json, perQuery) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const items = /** @type {{ items?: unknown[] }} */ (json).items;
  if (!Array.isArray(items)) {
    return [];
  }
  /** @type {Array<{ title: string, url: string, stars: number, forks: number, publishedAt?: string }>} */
  const repos = [];
  for (const item of items) {
    if (repos.length >= perQuery) {
      break;
    }
    const mapped = mapGithubRepoItem(item);
    if (mapped) {
      repos.push(mapped);
    }
  }
  return repos;
}

/**
 * @param {string} query
 * @param {number} perQuery
 * @param {typeof fetch} fetchFn
 * @param {string | undefined} token
 * @param {unknown} [fixtureJson]
 * @returns {Promise<{ ok: true, repos: ReturnType<typeof parseSearchResponse> } | { ok: false, reason: string }>}
 */
export async function fetchGithubSearch(query, perQuery, fetchFn, token, fixtureJson) {
  if (fixtureJson !== undefined) {
    return { ok: true, repos: parseSearchResponse(fixtureJson, perQuery) };
  }
  const url = `${GITHUB_SEARCH_BASE}?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perQuery}`;
  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers,
    });
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}` };
    }
    const json = await res.json();
    return { ok: true, repos: parseSearchResponse(json, perQuery) };
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {Array<{ title: string, url: string, stars: number, forks: number, publishedAt?: string }>} batches
 * @param {number} maxRepos
 * @returns {Array<{ title: string, url: string, stars: number, forks: number, publishedAt?: string }>}
 */
export function dedupeReposByUrl(batches, maxRepos) {
  const seen = new Set();
  /** @type {Array<{ title: string, url: string, stars: number, forks: number, publishedAt?: string }>} */
  const repos = [];
  for (const repo of batches) {
    if (seen.has(repo.url)) {
      continue;
    }
    seen.add(repo.url);
    repos.push(repo);
    if (repos.length >= maxRepos) {
      break;
    }
  }
  return repos;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, fixtureJson?: unknown, fixtureJsonByQuery?: Record<string, unknown> }} [options]
 * @returns {Promise<{ repos?: unknown[], error?: string }>}
 */
export async function runGithubFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadGithubConfig(env);

  if (!config.enabled) {
    return { error: 'github disabled' };
  }
  if (config.queries.length === 0) {
    return { error: 'missing-queries' };
  }

  /** @type {Array<{ title: string, url: string, stars: number, forks: number, publishedAt?: string }>} */
  const collected = [];
  for (const query of config.queries) {
    const fixture =
      options.fixtureJsonByQuery?.[query] ??
      (options.fixtureJson !== undefined && config.queries.length === 1 ? options.fixtureJson : undefined);
    const result = await fetchGithubSearch(
      query,
      config.perQuery,
      fetchFn,
      config.token,
      fixture,
    );
    if (!result.ok) {
      return { error: result.reason };
    }
    collected.push(...result.repos);
  }

  const repos = dedupeReposByUrl(collected, config.maxRepos);
  return { repos };
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
    const payload = await runGithubFetch(merged);
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
