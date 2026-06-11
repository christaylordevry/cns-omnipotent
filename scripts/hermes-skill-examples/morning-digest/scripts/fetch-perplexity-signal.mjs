// fetch-perplexity-signal.mjs — Perplexity deep signal for morning-digest Source 3
// Usage: node fetch-perplexity-signal.mjs "<top_trend_keyword>"
// stdout: {"deepSignal":"...","topTrend":"..."} or {"error":"..."}; always exit 0 on failure

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const PPLX_URL = 'https://api.perplexity.ai/chat/completions';
const FETCH_TIMEOUT_MS = 15_000;
const DEEP_SIGNAL_MAX = 1200;
const PPLX_MODEL = 'sonar';

/**
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
export function truncateAtWord(text, maxLen = DEEP_SIGNAL_MAX) {
  const normalized = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLen) {
    return normalized;
  }
  const slice = normalized.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string | undefined} keywordArg
 * @returns {{ apiKey?: string, keyword: string }}
 */
export function loadPerplexityConfig(env = process.env, keywordArg) {
  const apiKey = String(env.PERPLEXITY_API_KEY ?? '').trim() || undefined;
  const keyword = String(keywordArg ?? '').trim();
  return { apiKey, keyword };
}

/**
 * @param {string} keyword
 * @returns {string}
 */
export function buildPerplexityQuery(keyword) {
  return `${keyword} — latest news and developments last 24 hours — CNS operator brief`;
}

/**
 * @param {unknown} json
 * @returns {string}
 */
export function extractAnswerText(json) {
  if (!json || typeof json !== 'object') {
    return '';
  }
  const choices = /** @type {{ choices?: Array<{ message?: { content?: unknown } }> }} */ (json)
    .choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return '';
  }
  const content = choices[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string | undefined} keywordArg
 * @param {{ fetch?: typeof fetch, fixtureJson?: unknown }} [options]
 * @returns {Promise<{ deepSignal?: string, topTrend?: string, error?: string }>}
 */
export async function runPerplexityFetch(env, keywordArg, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadPerplexityConfig(env, keywordArg);

  if (!config.apiKey) {
    return { error: 'missing PERPLEXITY_API_KEY' };
  }
  if (!config.keyword) {
    return { error: 'no top trend keyword' };
  }

  if (options.fixtureJson !== undefined) {
    const answer = extractAnswerText(options.fixtureJson);
    if (!answer) {
      return { error: 'empty response' };
    }
    return {
      deepSignal: truncateAtWord(answer),
      topTrend: config.keyword,
    };
  }

  const query = buildPerplexityQuery(config.keyword);
  try {
    const res = await fetchFn(PPLX_URL, {
      method: 'POST',
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: PPLX_MODEL,
        messages: [{ role: 'user', content: query }],
        max_tokens: 400,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      return { error: `http-${res.status}` };
    }
    const json = await res.json();
    const answer = extractAnswerText(json);
    if (!answer) {
      return { error: 'empty response' };
    }
    return {
      deepSignal: truncateAtWord(answer),
      topTrend: config.keyword,
    };
  } catch (err) {
    const name =
      err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { error: 'perplexity timeout' };
    }
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
    const keywordArg = process.argv[2];
    const payload = await runPerplexityFetch(merged, keywordArg);
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
