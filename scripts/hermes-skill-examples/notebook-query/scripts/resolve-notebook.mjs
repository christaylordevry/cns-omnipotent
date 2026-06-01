// resolve-notebook.mjs
// Usage: NOTEBOOK_QUERY="<question>" node resolve-notebook.mjs [registryPath]
// Legacy: node resolve-notebook.mjs "<question>" [registryPath]
// Outputs JSON to stdout: { route: DisambiguationResult, elapsed_ms: number }
// Exit 2 + stderr → registry unreadable/malformed; exit 1 → other resolver failure

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const EXIT_REGISTRY = 2;
const EXIT_ROUTING = 1;

const CNS_REPO_ROOT =
  process.env.CNS_REPO_ROOT ??
  join(homedir(), 'ai-factory', 'projects', 'Omnipotent.md');
const LIB_PATH = join(CNS_REPO_ROOT, 'scripts', 'session-close', 'lib');

function failRegistry() {
  console.error('could not load notebook registry');
  process.exit(EXIT_REGISTRY);
}

function failRouting() {
  console.error('could not resolve notebook routing');
  process.exit(EXIT_ROUTING);
}

let scoreNotebooks;
let disambiguateRoute;
let tokenizeForScoring;
let f1;
let normalizeDomainSlug;
let getDomainKeywordTokens;
try {
  ({ scoreNotebooks, tokenizeForScoring, f1 } = await import(
    join(LIB_PATH, 'notebook-scorer.mjs')
  ));
  ({ disambiguateRoute } = await import(join(LIB_PATH, 'notebook-disambiguate.mjs')));
  ({ normalizeDomainSlug, getDomainKeywordTokens } = await import(
    join(LIB_PATH, 'infer-notebook-domain.mjs')
  ));
} catch {
  failRouting();
}

const question = (process.env.NOTEBOOK_QUERY ?? process.argv[2] ?? '').trim();
const registryPath =
  process.argv[3] ??
  (process.env.CNS_NOTEBOOK_REGISTRY_PATH ||
    join(LIB_PATH, 'notebook-registry.json'));

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

const watchedRegistry = raw.filter((e) => e && e.watch === true);

/**
 * @param {number} value
 * @returns {string}
 */
function formatDisplayScore(value) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * @param {number} value
 * @returns {number}
 */
function roundScore(value) {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * @param {object} entry
 * @returns {string[]}
 */
function domainTokensForEntry(entry) {
  const slug = normalizeDomainSlug(entry.domain || 'general');
  const slugTokens = tokenizeForScoring(slug);
  const lexicon = getDomainKeywordTokens(slug);
  return [...new Set([...slugTokens, ...lexicon])];
}

/**
 * @param {unknown} row
 * @returns {object | null}
 */
function validRegistryRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!id || !title) {
    return null;
  }
  return {
    id,
    title,
    watch: Boolean(row.watch),
    domain: typeof row.domain === 'string' ? row.domain : '',
  };
}

/**
 * @param {string} topic
 * @param {object[]} registry
 * @returns {{ title: string, score: number } | null}
 */
function bestWatchedMatch(topic, registry) {
  const queryTokens = tokenizeForScoring(topic);
  if (queryTokens.length === 0) {
    return null;
  }

  const rows = registry.map((row) => validRegistryRow(row)).filter((row) => row !== null);
  if (rows.length === 0) {
    return null;
  }

  /** @type {{ id: string, title: string, score: number }[]} */
  const ranked = [];
  for (const entry of rows) {
    const titleTokens = tokenizeForScoring(entry.title);
    const domainTokens = domainTokensForEntry(entry);
    const titleScore = roundScore(f1(queryTokens, titleTokens));
    const domainScore = roundScore(f1(queryTokens, domainTokens));
    const score = roundScore(Math.max(titleScore, domainScore));
    ranked.push({ id: entry.id, title: entry.title, score });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const titleCmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    if (titleCmp !== 0) {
      return titleCmp;
    }
    return a.id.localeCompare(b.id);
  });

  const top = ranked[0];
  return top ? { title: top.title, score: top.score } : null;
}

/**
 * @param {string} reason
 * @returns {{ route: object, elapsed_ms: number }}
 */
function noRouteOutput(reason) {
  return {
    route: {
      status: 'NO_ROUTE',
      id: null,
      title: null,
      reason,
    },
    elapsed_ms: Date.now() - start,
  };
}

if (watchedRegistry.length === 0) {
  process.stdout.write(JSON.stringify(noRouteOutput('no_watched_notebooks')) + '\n');
  process.exit(0);
}

if (!question || tokenizeForScoring(question).length === 0) {
  process.stdout.write(JSON.stringify(noRouteOutput('empty_question')) + '\n');
  process.exit(0);
}

const scoreResult = scoreNotebooks(question, watchedRegistry);
const route = disambiguateRoute(scoreResult, watchedRegistry);

let routeOutput = route;
if (route.status === 'ROUTED') {
  const entry = watchedRegistry.find((e) => e && e.id === route.id);
  routeOutput = {
    ...route,
    domain: typeof entry?.domain === 'string' ? entry.domain : '',
  };
} else if (route.status === 'NO_ROUTE') {
  const best = bestWatchedMatch(question, watchedRegistry);
  const reason = best
    ? `below_threshold: best=${best.title} (${formatDisplayScore(best.score)})`
    : 'below_threshold: best=unknown (0.00)';
  routeOutput = {
    ...route,
    reason,
  };
}

process.stdout.write(
  JSON.stringify({ route: routeOutput, elapsed_ms: Date.now() - start }) + '\n',
);
