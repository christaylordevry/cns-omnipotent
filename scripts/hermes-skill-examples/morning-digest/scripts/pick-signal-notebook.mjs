// pick-signal-notebook.mjs
// Usage: DIGEST_SOURCES_JSON='{"trends":[...],"headlines":[...],"perplexityText":"..."}' node pick-signal-notebook.mjs [registryPath]
// Legacy: SIGNALS_JSON='["keyword",...]' node pick-signal-notebook.mjs [registryPath]
// Legacy: node pick-signal-notebook.mjs '<json-array-string>' [registryPath]
// Outputs JSON to stdout: { route, winning_signal, winning_score, elapsed_ms }
// Exit 2 + stderr → registry unreadable/malformed; exit 1 → other routing failure

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const EXIT_REGISTRY = 2;
const EXIT_ROUTING = 1;
const MAX_SIGNALS = 10;
const MAX_TREND_KEYWORDS = 5;
const MAX_HEADLINE_TITLES = 5;
const MAX_PERPLEXITY_SIGNALS = 3;
const MAX_ARXIV_SIGNALS = 3;
const PERPLEXITY_TRUNCATE_CHARS = 200;

const CNS_REPO_ROOT =
  process.env.CNS_REPO_ROOT ??
  join(homedir(), 'ai-factory', 'projects', 'Omnipotent.md');
const LIB_PATH = join(CNS_REPO_ROOT, 'scripts', 'session-close', 'lib');

function failRegistry() {
  console.error('could not load notebook registry');
  process.exit(EXIT_REGISTRY);
}

function failRouting() {
  console.error('could not pick signal notebook routing');
  process.exit(EXIT_ROUTING);
}

let resolveNotebookRoute;
let tokenizeForScoring;
try {
  ({ resolveNotebookRoute } = await import(join(LIB_PATH, 'notebook-route.mjs')));
  ({ tokenizeForScoring } = await import(join(LIB_PATH, 'notebook-scorer.mjs')));
} catch {
  failRouting();
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function dedupeSignals(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_SIGNALS) {
      break;
    }
  }
  return out;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isStopwordOnlySignal(text) {
  return tokenizeForScoring(String(text)).length === 0;
}

/**
 * @param {unknown} perplexityText
 * @returns {string[]}
 */
export function extractPerplexitySignals(perplexityText) {
  const trimmed = String(perplexityText ?? '').trim();
  if (!trimmed) {
    return [];
  }

  const segments = trimmed
    .split(/\s*[.;]\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 2 && !isStopwordOnlySignal(segment));

  if (segments.length === 0) {
    const fallback =
      trimmed.length > PERPLEXITY_TRUNCATE_CHARS
        ? trimmed.slice(0, PERPLEXITY_TRUNCATE_CHARS).trim()
        : trimmed;
    return fallback.length >= 2 && !isStopwordOnlySignal(fallback) ? [fallback] : [];
  }

  /** @type {string[]} */
  const signals = [];
  for (const segment of segments) {
    const chunk =
      segment.length > PERPLEXITY_TRUNCATE_CHARS
        ? segment.slice(0, PERPLEXITY_TRUNCATE_CHARS).trim()
        : segment;
    if (chunk.length >= 2 && !isStopwordOnlySignal(chunk)) {
      signals.push(chunk);
      if (signals.length >= MAX_PERPLEXITY_SIGNALS) {
        break;
      }
    }
  }
  return signals;
}

/**
 * @param {Array<{ title?: string }>} arxivList
 * @returns {string[]}
 */
export function extractArxivSignals(arxivList) {
  if (!Array.isArray(arxivList)) {
    return [];
  }
  /** @type {string[]} */
  const out = [];
  for (const entry of arxivList.slice(0, MAX_ARXIV_SIGNALS)) {
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    if (title) {
      out.push(title);
    }
  }
  return out;
}

/**
 * @param {{
 *   trends?: Array<{ keyword?: string, normalizedValue?: number }>,
 *   headlines?: Array<{ title?: string } | string>,
 *   perplexityText?: string,
 *   arxiv?: Array<{ title?: string }>,
 * }} sources
 * @returns {string[]}
 */
export function buildDigestSignals(sources = {}) {
  /** @type {string[]} */
  const ordered = [];

  const trendList = Array.isArray(sources.trends) ? [...sources.trends] : [];
  trendList.sort((a, b) => (b?.normalizedValue ?? 0) - (a?.normalizedValue ?? 0));
  for (const entry of trendList.slice(0, MAX_TREND_KEYWORDS)) {
    const keyword = typeof entry?.keyword === 'string' ? entry.keyword.trim() : '';
    if (keyword) {
      ordered.push(keyword);
    }
  }

  const headlineList = Array.isArray(sources.headlines) ? sources.headlines : [];
  for (const entry of headlineList.slice(0, MAX_HEADLINE_TITLES)) {
    const title =
      typeof entry === 'string'
        ? entry.trim()
        : typeof entry?.title === 'string'
          ? entry.title.trim()
          : '';
    if (title) {
      ordered.push(title);
    }
  }

  ordered.push(...extractPerplexitySignals(sources.perplexityText).slice(0, MAX_PERPLEXITY_SIGNALS));
  ordered.push(...extractArxivSignals(sources.arxiv));

  return dedupeSignals(ordered);
}

/**
 * @param {{ signalIndex: number, top: { id: string, title: string, score: number } }} candidate
 * @param {{ signalIndex: number, top: { id: string, title: string, score: number } }} incumbent
 * @returns {boolean} true when candidate should replace incumbent
 */
function candidateBeatsIncumbent(candidate, incumbent) {
  if (candidate.top.score > incumbent.top.score) {
    return true;
  }
  if (candidate.top.score < incumbent.top.score) {
    return false;
  }
  if (candidate.signalIndex < incumbent.signalIndex) {
    return true;
  }
  if (candidate.signalIndex > incumbent.signalIndex) {
    return false;
  }
  const titleCmp = candidate.top.title.localeCompare(incumbent.top.title, undefined, {
    sensitivity: 'base',
  });
  if (titleCmp < 0) {
    return true;
  }
  if (titleCmp > 0) {
    return false;
  }
  return candidate.top.id.localeCompare(incumbent.top.id) < 0;
}

/**
 * @param {string | undefined | null} raw
 * @returns {Map<string, string>}
 */
export function parseNotebookTitleMap(raw) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const segment of String(raw ?? '').split(',')) {
    const idx = segment.indexOf(':');
    if (idx <= 0) {
      continue;
    }
    const prefix = segment.slice(0, idx).trim();
    const title = segment.slice(idx + 1).trim();
    if (prefix && title) {
      map.set(prefix, title);
    }
  }
  return map;
}

/**
 * @param {unknown[]} rows
 * @param {Map<string, string>} titleMap
 * @returns {unknown[]}
 */
export function applyNotebookTitleOverlay(rows, titleMap) {
  if (!titleMap.size) {
    return rows;
  }
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string') {
      return row;
    }
    for (const [prefix, title] of titleMap) {
      if (
        row.id === prefix ||
        row.id.startsWith(prefix + '-') ||
        row.id.startsWith(prefix)
      ) {
        return { ...row, title };
      }
    }
    return row;
  });
}

/**
 * @param {string[]} signals
 * @param {unknown[]} watchedRegistry
 */
export function pickSignalNotebook(signals, watchedRegistry) {
  const watchedOnly = (Array.isArray(watchedRegistry) ? watchedRegistry : []).filter(
    (e) => e && e.watch === true,
  );
  let best = null;

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const route = resolveNotebookRoute(signal, watchedOnly);
    if (route.status !== 'ROUTED') {
      continue;
    }
    const candidate = {
      signal,
      signalIndex: i,
      route,
      top: { id: route.id, title: route.title, score: route.score },
    };
    if (!best || candidateBeatsIncumbent(candidate, best)) {
      best = candidate;
    }
  }

  if (!best) {
    return {
      route: { status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' },
      winning_signal: null,
      winning_score: null,
    };
  }

  return {
    route: {
      status: 'ROUTED',
      id: best.route.id,
      title: best.route.title,
      reason: best.route.reason,
    },
    winning_signal: best.signal,
    winning_score: best.top.score,
  };
}

function hasEnvDigestSources() {
  const raw = process.env.DIGEST_SOURCES_JSON;
  return raw !== undefined && String(raw).trim() !== '';
}

function hasEnvSignals() {
  return process.env.SIGNALS_JSON !== undefined;
}

function hasEnvSignalInput() {
  return hasEnvDigestSources() || hasEnvSignals();
}

/**
 * @param {unknown} parsed
 * @returns {string[]}
 */
function signalsFromParsedInput(parsed) {
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    ('trends' in parsed ||
      'headlines' in parsed ||
      'perplexityText' in parsed ||
      'arxiv' in parsed)
  ) {
    return buildDigestSignals(/** @type {Parameters<typeof buildDigestSignals>[0]} */ (parsed));
  }
  return dedupeSignals(parsed);
}

function parseSignalsInput() {
  if (hasEnvDigestSources()) {
    try {
      return signalsFromParsedInput(JSON.parse(process.env.DIGEST_SOURCES_JSON ?? '{}'));
    } catch {
      return [];
    }
  }
  if (hasEnvSignals()) {
    try {
      return dedupeSignals(JSON.parse(process.env.SIGNALS_JSON ?? '[]'));
    } catch {
      return [];
    }
  }
  const raw = process.argv[2] ?? '[]';
  try {
    return signalsFromParsedInput(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseRegistryPath() {
  const fromArgv = process.argv[3];
  const fromEnv = process.env.CNS_NOTEBOOK_REGISTRY_PATH;
  if (fromArgv && String(fromArgv).trim()) {
    return fromArgv;
  }
  if (fromEnv && String(fromEnv).trim()) {
    return fromEnv;
  }
  if (hasEnvSignalInput()) {
    return process.argv[2];
  }
  return join(LIB_PATH, 'notebook-registry.json');
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === entry;
}

if (isMainModule()) {
  const registryPath = parseRegistryPath();
  const start = Date.now();
  let raw;
  try {
    raw = JSON.parse(await readFile(registryPath, 'utf8'));
  } catch {
    failRegistry();
  }

  if (!Array.isArray(raw)) {
    failRegistry();
  }

  const mergedEnv = await mergeTrendIngestEnv(process.env);
  const titleMap = parseNotebookTitleMap(mergedEnv.NOTEBOOKLM_NOTEBOOK_TITLES);
  const registryWithTitles = applyNotebookTitleOverlay(raw, titleMap);
  const watchedRegistry = registryWithTitles.filter((e) => e && e.watch === true);
  const signals = parseSignalsInput();
  const result = pickSignalNotebook(signals, watchedRegistry);
  const elapsed_ms = Date.now() - start;

  let routeOutput = result.route;
  if (result.route.status === 'ROUTED') {
    const entry = watchedRegistry.find((e) => e && e.id === result.route.id);
    routeOutput = {
      ...result.route,
      domain: typeof entry?.domain === 'string' ? entry.domain : '',
    };
  }

  process.stdout.write(
    JSON.stringify({
      route: routeOutput,
      winning_signal: result.winning_signal,
      winning_score: result.winning_score,
      elapsed_ms,
    }) + '\n',
  );
}
