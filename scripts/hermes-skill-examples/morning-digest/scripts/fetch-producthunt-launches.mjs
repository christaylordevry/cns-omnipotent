// fetch-producthunt-launches.mjs — Product Hunt GraphQL for morning-digest Source 10
// Usage: node fetch-producthunt-launches.mjs
// stdout: {"launches":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure
//
// postedAfter: start of previous calendar day UTC (e.g. on 2026-06-10 → 2026-06-09T00:00:00.000Z)
// Env: PRODUCTHUNT_API_KEY (alias PRODUCTHUNT_API_TOKEN documented in trend-ingest.env only)

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const GRAPHQL_URL = 'https://api.producthunt.com/v2/api/graphql';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_LAUNCHES_DEFAULT = 5;
const GRAPHQL_FIRST = 10;

const POSTS_QUERY = `
query ($after: DateTime!) {
  posts(order: VOTES, postedAfter: $after, first: ${GRAPHQL_FIRST}) {
    edges {
      node {
        name
        tagline
        url
        votesCount
        createdAt
      }
    }
  }
}
`.trim();

/**
 * @param {Date} [now]
 * @returns {string} ISO timestamp for start of previous UTC calendar day
 */
export function getPostedAfterIso(now = new Date()) {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  return d.toISOString();
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isProductHuntEnabled(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) {
    return true;
  }
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ enabled: boolean, apiKey?: string, maxLaunches: number }}
 */
export function loadProductHuntConfig(env = process.env) {
  const enabled = isProductHuntEnabled(env.MORNING_DIGEST_PRODUCTHUNT_ENABLED);
  const apiKey = String(env.PRODUCTHUNT_API_KEY ?? '').trim() || undefined;
  const rawMax = parseInt(String(env.MORNING_DIGEST_PRODUCTHUNT_MAX_LAUNCHES ?? ''), 10);
  const maxLaunches =
    Number.isFinite(rawMax) && rawMax > 0 ? rawMax : MAX_LAUNCHES_DEFAULT;
  return { enabled, apiKey, maxLaunches };
}

/**
 * @param {unknown} node
 * @returns {{ title: string, tagline: string, url: string, votesCount: number, createdAt?: string } | null}
 */
export function mapLaunchNode(node) {
  if (!node || typeof node !== 'object') {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (node);
  const title = String(row.name ?? '').trim();
  const tagline = String(row.tagline ?? '').trim();
  const url = String(row.url ?? '').trim();
  if (!title || !url) {
    return null;
  }
  const votesCount = Number(row.votesCount);
  const createdAt = row.createdAt != null ? String(row.createdAt) : '';
  return {
    title,
    tagline,
    url,
    votesCount: Number.isFinite(votesCount) ? votesCount : 0,
    ...(createdAt ? { createdAt } : {}),
  };
}

/**
 * @param {unknown} json
 * @returns {Array<{ title: string, tagline: string, url: string, votesCount: number, createdAt?: string }>}
 */
export function parseGraphQLResponse(json) {
  if (!json || typeof json !== 'object') {
    return [];
  }
  const data = /** @type {{ data?: { posts?: { edges?: unknown[] } } }} */ (json).data;
  const edges = data?.posts?.edges;
  if (!Array.isArray(edges)) {
    return [];
  }
  /** @type {Array<{ title: string, tagline: string, url: string, votesCount: number, createdAt?: string }>} */
  const launches = [];
  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') {
      continue;
    }
    const node = /** @type {{ node?: unknown }} */ (edge).node;
    const mapped = mapLaunchNode(node);
    if (mapped) {
      launches.push(mapped);
    }
  }
  return launches;
}

/**
 * @param {Array<{ title: string, tagline: string, url: string, votesCount: number, createdAt?: string }>} launches
 * @param {number} maxLaunches
 * @returns {Array<{ title: string, tagline: string, url: string, votesCount: number, createdAt?: string }>}
 */
export function sortAndCapLaunches(launches, maxLaunches) {
  return [...launches]
    .sort((a, b) => b.votesCount - a.votesCount)
    .slice(0, maxLaunches);
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, fixtureJson?: unknown, now?: Date }} [options]
 * @returns {Promise<{ launches?: unknown[], error?: string }>}
 */
export async function runProductHuntFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadProductHuntConfig(env);

  if (!config.enabled) {
    return { error: 'producthunt disabled' };
  }
  if (!config.apiKey) {
    return { error: 'missing PRODUCTHUNT_API_KEY' };
  }

  if (options.fixtureJson !== undefined) {
    const launches = sortAndCapLaunches(
      parseGraphQLResponse(options.fixtureJson),
      config.maxLaunches,
    );
    return { launches };
  }

  const postedAfter = getPostedAfterIso(options.now);
  try {
    const res = await fetchFn(GRAPHQL_URL, {
      method: 'POST',
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        query: POSTS_QUERY,
        variables: { after: postedAfter },
      }),
    });
    if (!res.ok) {
      return { error: `http-${res.status}` };
    }
    const json = await res.json();
    if (json && typeof json === 'object' && 'errors' in json) {
      const errors = /** @type {{ errors?: Array<{ message?: string }> }} */ (json).errors;
      const msg =
        Array.isArray(errors) && errors[0]?.message
          ? String(errors[0].message).slice(0, 80)
          : 'graphql-error';
      return { error: msg };
    }
    const launches = sortAndCapLaunches(parseGraphQLResponse(json), config.maxLaunches);
    return { launches };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { error: name };
  }
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
    const payload = await runProductHuntFetch(merged);
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
