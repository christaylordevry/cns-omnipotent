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
try {
  ({ scoreNotebooks } = await import(join(LIB_PATH, 'notebook-scorer.mjs')));
  ({ disambiguateRoute } = await import(join(LIB_PATH, 'notebook-disambiguate.mjs')));
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
const scoreResult = scoreNotebooks(question, watchedRegistry);
const route = disambiguateRoute(scoreResult, watchedRegistry);
const elapsed_ms = Date.now() - start;

let routeOutput = route;
if (route.status === 'ROUTED') {
  const entry = watchedRegistry.find((e) => e && e.id === route.id);
  routeOutput = {
    ...route,
    domain: typeof entry?.domain === 'string' ? entry.domain : '',
  };
}

process.stdout.write(JSON.stringify({ route: routeOutput, elapsed_ms }) + '\n');
