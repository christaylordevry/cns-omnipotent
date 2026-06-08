// fetch-arxiv-rss.mjs — arXiv RSS for morning-digest Source 4
// Usage: node fetch-arxiv-rss.mjs
// stdout: {"papers":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const CATEGORY_RE = /^[a-zA-Z0-9._+-]+$/;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_ARXIV_CATEGORIES = 3;
const SNIPPET_MAX = 200;
const ARXIV_RSS_BASE = 'https://rss.arxiv.org/rss/';

/** Documented default categories when env unset (Story 64-7). */
export const DEFAULT_ARXIV_CATEGORIES = 'cs.AI,cs.LG,stat.ML';

/**
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function useArxivDefaults(env) {
  const v = String(env.MORNING_DIGEST_ARXIV_USE_DEFAULTS ?? '').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isArxivEnabled(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) {
    return true;
  }
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

/**
 * @param {string} category
 * @returns {boolean}
 */
export function isValidArxivCategory(category) {
  const trimmed = String(category ?? '').trim();
  return trimmed.length > 0 && CATEGORY_RE.test(trimmed);
}

/**
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
export function trimSnippet(text, maxLen = SNIPPET_MAX) {
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
 * @param {string} description
 * @returns {string}
 */
export function extractSnippetFromDescription(description) {
  const m = String(description ?? '').match(/Abstract:\s*([\s\S]+)/i);
  if (!m) {
    return '';
  }
  return trimSnippet(m[1]);
}

/**
 * @param {string} block
 * @returns {{ title: string, link: string, snippet: string, pubDate: string } | null}
 */
export function parseRssItemBlock(block) {
  const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  const linkMatch = block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
  const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
  const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

  const title = (titleMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
  const link = (linkMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
  if (!title) {
    return null;
  }

  const rawDesc = (descMatch?.[1] ?? '').replace(/<[^>]+>/g, ' ').trim();
  return {
    title,
    link,
    snippet: extractSnippetFromDescription(rawDesc),
    pubDate: (dateMatch?.[1] ?? '').trim(),
  };
}

/**
 * @param {string} xml
 * @param {string} category
 * @param {number} maxPerCategory
 * @returns {Array<{ category: string, title: string, link: string, snippet: string, pubDate: string }>}
 */
export function parseArxivRss(xml, category, maxPerCategory) {
  const papers = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml)) !== null && papers.length < maxPerCategory) {
    const parsed = parseRssItemBlock(match[1]);
    if (parsed) {
      papers.push({ category, ...parsed });
    }
  }
  return papers;
}

/**
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ enabled: boolean, categories: string[], maxPerCategory: number, invalidCategories: string[] }}
 */
export function loadArxivConfig(env = process.env) {
  const enabled = isArxivEnabled(env.MORNING_DIGEST_ARXIV_ENABLED);
  let rawCategories = String(env.MORNING_DIGEST_ARXIV_CATEGORIES ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  if (rawCategories.length === 0 && enabled && useArxivDefaults(env)) {
    rawCategories = DEFAULT_ARXIV_CATEGORIES.split(',').map((c) => c.trim());
  }

  const invalidCategories = rawCategories.filter((c) => !isValidArxivCategory(c));
  const categories = rawCategories
    .filter((c) => isValidArxivCategory(c))
    .slice(0, MAX_ARXIV_CATEGORIES);

  const maxRaw = parseInt(String(env.MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY ?? '3'), 10);
  const maxPerCategory = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 3;

  return { enabled, categories, maxPerCategory, invalidCategories };
}

/**
 * Infer the operator's real HOME directly from a Hermes profile-isolated HOME
 * (e.g. /home/christ/.hermes/home → /home/christ). Returns null when HOME does
 * not match the isolation pattern.
 *
 * @param {string} home
 * @returns {string | null}
 */
export function inferOperatorHomeFromHome(home) {
  if (!home) return null;
  const m = home.match(/^(.*?)\/\.hermes\/home(\/.*)?$/);
  return m?.[1] ? m[1] : null;
}

/**
 * Infer HERMES_HOME from a HOME that matches the Hermes profile-isolation
 * pattern (.hermes/home or .hermes/home/...). Returns null otherwise.
 *
 * @param {string} home
 * @returns {string | null}
 */
export function inferHermesHomeFromHome(home) {
  if (!home) return null;
  const m = home.match(/^(.*\/\.hermes)\/home(\/.*)?$/);
  return m ? m[1] : null;
}

/**
 * True when HOME is Hermes per-profile isolation ({HERMES_HOME}/home).
 *
 * @param {string} home
 * @param {string} hermesHome
 * @returns {boolean}
 */
export function isHermesProfileHome(home, hermesHome) {
  if (!home || !hermesHome) {
    return false;
  }
  const profileRoot = join(hermesHome, 'home');
  return home === profileRoot || home.startsWith(`${profileRoot}/`);
}

/**
 * Resolve the operator's real HOME even when Hermes has profile-isolated the
 * process under {HERMES_HOME}/home (Epic 59). Falls back to the input HOME when
 * the pattern does not match or getent yields nothing.
 *
 * Mirrors scripts/session-close/lib/operator-home.mjs. Inlined deliberately: the
 * installed skill tree (~/.hermes/skills/cns/morning-digest) does not include the
 * session-close package, so a cross-package import would break at runtime.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<string>}
 */
export async function resolveOperatorHome(env = process.env) {
  const home = (env.HOME || homedir()).trim();
  const directInference = inferOperatorHomeFromHome(home);
  if (directInference) {
    return directInference;
  }
  let hermesHome = (env.HERMES_HOME || '').trim();
  if (!hermesHome) {
    hermesHome = inferHermesHomeFromHome(home) || '';
  }
  if (!isHermesProfileHome(home, hermesHome)) {
    return home || homedir();
  }
  const user = (env.USER || env.LOGNAME || '').trim();
  if (!user) {
    return home || homedir();
  }
  try {
    const { stdout } = await execFileAsync('getent', ['passwd', user], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
    });
    const line = stdout.trim().split('\n')[0] ?? '';
    const passwdHome = line.split(':')[5]?.trim();
    if (passwdHome) {
      return passwdHome;
    }
  } catch {
    // getent unavailable — fall through to profile HOME.
  }
  return home || homedir();
}

/**
 * @param {Record<string, string | undefined>} baseEnv
 * @returns {Promise<Record<string, string | undefined>>}
 */
export async function mergeTrendIngestEnv(baseEnv) {
  const operatorHome = await resolveOperatorHome(baseEnv);
  const path = join(operatorHome, '.hermes', 'trend-ingest.env');
  try {
    const content = await readFile(path, 'utf8');
    const fromFile = parseEnvFile(content);
    return { ...fromFile, ...baseEnv };
  } catch {
    return { ...baseEnv };
  }
}

/**
 * @param {string} category
 * @param {typeof fetch} fetchFn
 * @param {string} [fixtureXml]
 * @returns {Promise<{ ok: true, xml: string } | { ok: false, reason: string }>}
 */
export async function fetchCategoryFeed(category, fetchFn, fixtureXml) {
  if (fixtureXml !== undefined) {
    return { ok: true, xml: fixtureXml };
  }
  const url = `${ARXIV_RSS_BASE}${encodeURIComponent(category)}`;
  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}` };
    }
    const xml = await res.text();
    return { ok: true, xml };
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'fetch-error';
    return { ok: false, reason: name };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, fixtureXml?: string }} [options]
 * @returns {Promise<{ papers?: unknown[], error?: string }>}
 */
export async function runArxivFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadArxivConfig(env);

  if (!config.enabled) {
    return { error: 'arxiv disabled' };
  }

  if (config.categories.length === 0) {
    if (config.invalidCategories.length > 0) {
      return { error: 'invalid category' };
    }
    if (config.enabled && !useArxivDefaults(env)) {
      return { error: 'categories not configured' };
    }
    return { papers: [] };
  }

  if (config.invalidCategories.length > 0) {
    return { error: 'invalid category' };
  }

  /** @type {Array<{ category: string, title: string, link: string, snippet: string, pubDate: string }>} */
  const papers = [];
  let lastError = '';

  for (const category of config.categories) {
    const result = await fetchCategoryFeed(category, fetchFn, options.fixtureXml);
    if (!result.ok) {
      lastError = result.reason;
      continue;
    }
    papers.push(...parseArxivRss(result.xml, category, config.maxPerCategory));
  }

  if (papers.length === 0 && lastError) {
    return { error: lastError };
  }

  return { papers };
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
    const payload = await runArxivFetch(merged);
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
