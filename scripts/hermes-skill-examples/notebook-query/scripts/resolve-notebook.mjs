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

let resolveNotebookRoute;
let belowThresholdReason;
let tokenizeForScoring;
try {
  ({ resolveNotebookRoute, belowThresholdReason } = await import(
    join(LIB_PATH, 'notebook-route.mjs')
  ));
  ({ tokenizeForScoring } = await import(join(LIB_PATH, 'notebook-scorer.mjs')));
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

const resolved = resolveNotebookRoute(question, watchedRegistry);

/** @type {object} */
let routeOutput;
if (resolved.status === 'ROUTED') {
  const entry = watchedRegistry.find((e) => e && e.id === resolved.id);
  routeOutput = {
    status: 'ROUTED',
    id: resolved.id,
    title: resolved.title,
    reason: resolved.reason,
    domain: typeof entry?.domain === 'string' ? entry.domain : '',
  };
} else {
  routeOutput = {
    status: 'NO_ROUTE',
    id: null,
    title: null,
    reason: belowThresholdReason(resolved.best),
  };
}

process.stdout.write(
  JSON.stringify({ route: routeOutput, elapsed_ms: Date.now() - start }) + '\n',
);
