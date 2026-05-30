// pick-signal-notebook.mjs
// Usage: SIGNALS_JSON='["keyword",...]' node pick-signal-notebook.mjs [registryPath]
// Legacy: node pick-signal-notebook.mjs '<json-array-string>' [registryPath]
// Outputs JSON to stdout: { route, winning_signal, winning_score, elapsed_ms }
// Exit 2 + stderr → registry unreadable/malformed; exit 1 → other routing failure

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXIT_REGISTRY = 2;
const EXIT_ROUTING = 1;
const MAX_SIGNALS = 10;
const SCORE_THRESHOLD = 0.75;

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

let scoreNotebooks;
let disambiguateRoute;
try {
  ({ scoreNotebooks } = await import(join(LIB_PATH, 'notebook-scorer.mjs')));
  ({ disambiguateRoute } = await import(join(LIB_PATH, 'notebook-disambiguate.mjs')));
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
 * @param {string[]} signals
 * @param {unknown[]} watchedRegistry
 */
export function pickSignalNotebook(signals, watchedRegistry) {
  let best = null;

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const scoreResult = scoreNotebooks(signal, watchedRegistry);
    if (scoreResult.status !== 'OK' || scoreResult.matches.length === 0) {
      continue;
    }
    const top = scoreResult.matches[0];
    if (top.score < SCORE_THRESHOLD) {
      continue;
    }
    const candidate = { signal, signalIndex: i, scoreResult, top };
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

  const route = disambiguateRoute(best.scoreResult, watchedRegistry);
  return {
    route,
    winning_signal: best.signal,
    winning_score: best.top.score,
  };
}

function hasEnvSignals() {
  return process.env.SIGNALS_JSON !== undefined;
}

function parseSignalsInput() {
  const raw = hasEnvSignals() ? process.env.SIGNALS_JSON : (process.argv[2] ?? '[]');
  try {
    return dedupeSignals(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseRegistryPath() {
  const fromArgv = hasEnvSignals() ? process.argv[2] : process.argv[3];
  return (
    fromArgv ??
    (process.env.CNS_NOTEBOOK_REGISTRY_PATH ||
      join(LIB_PATH, 'notebook-registry.json'))
  );
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

  const watchedRegistry = raw.filter((e) => e && e.watch === true);
  const signals = parseSignalsInput();
  const result = pickSignalNotebook(signals, watchedRegistry);
  const elapsed_ms = Date.now() - start;

  process.stdout.write(
    JSON.stringify({
      route: result.route,
      winning_signal: result.winning_signal,
      winning_score: result.winning_score,
      elapsed_ms,
    }) + '\n',
  );
}
