// fetch-newsapi-headlines.mjs — NewsAPI headlines for morning-digest Source 2
// Usage: node fetch-newsapi-headlines.mjs
// stdout: {"headlines":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const FETCH_TIMEOUT_MS = 20_000;
const NEWSAPI_EVERYTHING_URL = 'https://newsapi.org/v2/everything';

const DEFAULT_WINDOW_HOURS = 48;
const DEFAULT_MAX_HEADLINES = 5;
const DEFAULT_PAGE_SIZE = 20;

export const DEFAULT_NEWSAPI_QUERY = `(
  "artificial intelligence" OR "AI agents" OR "large language model" OR LLM
  OR "agentic AI" OR MCP OR "knowledge management" OR "AI assistant"
)
AND NOT (
  sports OR celebrity OR "reality TV" OR "stock market"
  OR cryptocurrency OR bitcoin OR ethereum
)`;

const MULTI_WORD_RELEVANCE = [
  'artificial intelligence',
  'language model',
  'agentic ai',
  'knowledge management',
  'ai assistant',
];

const WORD_RELEVANCE = [
  'ai',
  'llm',
  'agent',
  'agents',
  'mcp',
  'knowledge',
  'notebooklm',
  'openai',
  'anthropic',
  'gemini',
  'claude',
];

const EXCLUDE_PATTERNS = [
  /\bsports\b/i,
  /\bcelebrity\b/i,
  /\breality\s+tv\b/i,
  /\bnba\b/i,
  /\bnfl\b/i,
  /\bmlb\b/i,
];

const CRYPTO_PATTERNS = [
  /\bcryptocurrency\b/i,
  /\bbitcoin\b/i,
  /\bethereum\b/i,
  /\bcrypto\b/i,
];

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isNewsapiEnabled(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) {
    return true;
  }
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   enabled: boolean,
 *   apiKey: string,
 *   windowHours: number,
 *   maxHeadlines: number,
 *   pageSize: number,
 *   queryOverride: string | null,
 * }}
 */
export function loadNewsapiConfig(env = process.env) {
  const enabled = isNewsapiEnabled(env.MORNING_DIGEST_NEWSAPI_ENABLED);
  const apiKey = String(env.NEWSAPI_API_KEY ?? '').trim();

  const windowRaw = parseInt(String(env.MORNING_DIGEST_NEWSAPI_WINDOW_HOURS ?? ''), 10);
  const windowHours =
    Number.isFinite(windowRaw) && windowRaw > 0 ? windowRaw : DEFAULT_WINDOW_HOURS;

  const maxRaw = parseInt(String(env.MORNING_DIGEST_NEWSAPI_MAX_HEADLINES ?? ''), 10);
  const maxHeadlines =
    Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : DEFAULT_MAX_HEADLINES;

  const pageRaw = parseInt(String(env.MORNING_DIGEST_NEWSAPI_PAGE_SIZE ?? ''), 10);
  const pageSize = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : DEFAULT_PAGE_SIZE;

  const override = String(env.MORNING_DIGEST_NEWSAPI_QUERY ?? '').trim();
  const queryOverride = override.length > 0 ? override : null;

  return { enabled, apiKey, windowHours, maxHeadlines, pageSize, queryOverride };
}

/**
 * @param {string | null} queryOverride
 * @returns {string}
 */
export function buildNewsapiQuery(queryOverride) {
  return queryOverride ?? DEFAULT_NEWSAPI_QUERY;
}

/**
 * @param {number} windowHours
 * @param {Date} [now]
 * @returns {string}
 */
export function computeFromIso(windowHours, now = new Date()) {
  const hours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : DEFAULT_WINDOW_HOURS;
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return from.toISOString().slice(0, 19);
}

/**
 * @param {unknown} payload
 * @returns {{ ok: true, articles: Array<{ title?: string, url?: string, description?: string }> } | { ok: false, reason: string }}
 */
export function parseNewsapiPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'invalid json' };
  }

  const status = /** @type {{ status?: string, code?: string, message?: string, articles?: unknown[] }} */ (
    payload
  );

  if (status.status !== 'ok') {
    return { ok: false, reason: status.code || status.message || 'newsapi error' };
  }

  const articles = Array.isArray(status.articles) ? status.articles : [];
  return {
    ok: true,
    articles: /** @type {Array<{ title?: string, url?: string, description?: string }>} */ (articles),
  };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasTechRelevanceToken(text) {
  const lower = text.toLowerCase();
  for (const phrase of MULTI_WORD_RELEVANCE) {
    if (lower.includes(phrase)) {
      return true;
    }
  }
  for (const word of WORD_RELEVANCE) {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) {
      return true;
    }
  }
  if (/\bautomation\b/i.test(text)) {
    const withoutAutomation = lower.replace(/\bautomation\b/g, ' ');
    for (const phrase of MULTI_WORD_RELEVANCE) {
      if (withoutAutomation.includes(phrase)) {
        return true;
      }
    }
    for (const word of WORD_RELEVANCE) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(withoutAutomation)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {string} title
 * @param {string} [description]
 * @returns {boolean}
 */
export function isOnTopicHeadline(title, description = '') {
  const combined = `${title} ${description}`.trim();
  if (!combined) {
    return false;
  }

  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(combined)) {
      return false;
    }
  }

  const hasCrypto = CRYPTO_PATTERNS.some((pattern) => pattern.test(combined));
  if (hasCrypto && !hasTechRelevanceToken(combined)) {
    return false;
  }

  return hasTechRelevanceToken(combined);
}

/**
 * @param {Array<{ title?: string, url?: string, description?: string }>} articles
 * @param {number} maxHeadlines
 * @returns {Array<{ title: string, url?: string }>}
 */
export function filterOnTopicHeadlines(articles, maxHeadlines) {
  /** @type {Array<{ title: string, url?: string }>} */
  const headlines = [];

  for (const article of articles) {
    const title = String(article.title ?? '').trim();
    if (!title) {
      continue;
    }
    if (!isOnTopicHeadline(title, String(article.description ?? ''))) {
      continue;
    }
    const entry = { title };
    const url = String(article.url ?? '').trim();
    if (url) {
      entry.url = url;
    }
    headlines.push(entry);
    if (headlines.length >= maxHeadlines) {
      break;
    }
  }

  return headlines;
}

/**
 * @param {Record<string, string | undefined>} config
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixturePayload]
 * @returns {Promise<{ ok: true, payload: unknown } | { ok: false, reason: string }>}
 */
export async function fetchNewsapi(config, fetchFn, fixturePayload) {
  if (fixturePayload !== undefined) {
    return { ok: true, payload: fixturePayload };
  }

  const params = new URLSearchParams({
    q: buildNewsapiQuery(config.queryOverride),
    searchIn: 'title,description',
    language: 'en',
    sortBy: 'publishedAt',
    from: computeFromIso(config.windowHours),
    pageSize: String(config.pageSize),
    apiKey: config.apiKey,
  });

  try {
    const res = await fetchFn(`${NEWSAPI_EVERYTHING_URL}?${params.toString()}`, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}` };
    }
    const payload = await res.json();
    return { ok: true, payload };
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, fixturePayload?: unknown }} [options]
 * @returns {Promise<{ headlines?: Array<{ title: string, url?: string }>, error?: string }>}
 */
export async function runNewsapiFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadNewsapiConfig(env);

  if (!config.enabled) {
    return { error: 'newsapi disabled' };
  }

  if (!config.apiKey) {
    return { error: 'missing NEWSAPI_API_KEY' };
  }

  const fetchConfig = {
    apiKey: config.apiKey,
    windowHours: config.windowHours,
    pageSize: config.pageSize,
    queryOverride: config.queryOverride,
  };

  const result = await fetchNewsapi(fetchConfig, fetchFn, options.fixturePayload);
  if (!result.ok) {
    return { error: result.reason };
  }

  const parsed = parseNewsapiPayload(result.payload);
  if (!parsed.ok) {
    return { error: parsed.reason };
  }

  const headlines = filterOnTopicHeadlines(parsed.articles, config.maxHeadlines);
  if (headlines.length === 0) {
    return { error: 'no on-topic headlines' };
  }

  return { headlines };
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
    const payload = await runNewsapiFetch(merged);
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
