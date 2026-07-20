/**
 * OPS-2 Phase B — digest-signal schema contract guard (producer side).
 *
 * Hard gate: never skip. Manifest + producer both live in Omnipotent.md.
 * Used by (1) fixture-sweep tests at verify time and (2) pre-flight assertion
 * in pushDigestToConvex before the first Convex write.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
/** Repo layout: scripts/hermes-skill-examples/morning-digest/scripts → 4 levels up. */
const DEFAULT_REPO_ROOT = join(MODULE_DIR, '..', '..', '..', '..');

export const DIGEST_SIGNAL_CONTRACT_RELATIVE_PATH = 'contracts/digest-signal-contract.json';

/**
 * Resolve Omnipotent repo root for the contract file.
 * Prefer explicit env, then MODULE_DIR-relative repo layout.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveContractRepoRoot(env = process.env) {
  const fromContractPath = String(env.DIGEST_SIGNAL_CONTRACT_PATH ?? '').trim();
  if (fromContractPath) {
    return dirname(fromContractPath);
  }
  const fromEnv =
    String(env.OMNIPOTENT_REPO ?? '').trim() ||
    String(env.CNS_REPO_ROOT ?? '').trim();
  if (fromEnv) {
    return fromEnv;
  }
  return DEFAULT_REPO_ROOT;
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveDigestSignalContractPath(env = process.env) {
  const explicit = String(env.DIGEST_SIGNAL_CONTRACT_PATH ?? '').trim();
  if (explicit) {
    return explicit;
  }
  return join(resolveContractRepoRoot(env), DIGEST_SIGNAL_CONTRACT_RELATIVE_PATH);
}

/**
 * @param {string} contractPath
 * @returns {{
 *   fieldSets: {
 *     digestSignalInput: string[];
 *     digestSignalScores: string[];
 *     sourceMetadata: string[];
 *     contributingSources: string[];
 *     peopleMatch: string[];
 *     digestRunInput: string[];
 *     digestSourceOutcome: string[];
 *   };
 * }}
 */
export function loadDigestSignalContract(contractPath) {
  if (!existsSync(contractPath)) {
    throw new Error(
      `OPS-2 contract missing at ${contractPath} — regenerate from cns-dashboard (npm run generate:digest-signal-contract)`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(contractPath, 'utf8'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OPS-2 contract unreadable at ${contractPath}: ${message}`, {
      cause: err,
    });
  }
  if (!parsed?.fieldSets || typeof parsed.fieldSets !== 'object') {
    throw new Error(`OPS-2 contract missing fieldSets at ${contractPath}`);
  }
  return parsed;
}

/**
 * @param {Iterable<string>} keys
 * @param {Iterable<string>} allowed
 * @param {string} pathPrefix
 * @returns {string[]}
 */
function extrasBeyondAllowed(keys, allowed, pathPrefix) {
  const allow = new Set(allowed);
  /** @type {string[]} */
  const violations = [];
  for (const key of keys) {
    if (!allow.has(key)) {
      violations.push(`${pathPrefix}.${key}`);
    }
  }
  return violations;
}

/**
 * Collect union of keys actually present on a push payload (run + signals).
 *
 * @param {{ run?: Record<string, unknown>; signals?: unknown[] }} payload
 * @returns {{
 *   signalTopLevel: Set<string>;
 *   sourceMetadata: Set<string>;
 *   contributingSources: Set<string>;
 *   peopleMatch: Set<string>;
 *   scores: Set<string>;
 *   run: Set<string>;
 *   sourceOutcomes: Set<string>;
 *   sourceTypes: Set<string>;
 * }}
 */
export function collectEmittedFieldKeys(payload) {
  /** @type {Set<string>} */
  const signalTopLevel = new Set();
  /** @type {Set<string>} */
  const sourceMetadata = new Set();
  /** @type {Set<string>} */
  const contributingSources = new Set();
  /** @type {Set<string>} */
  const peopleMatch = new Set();
  /** @type {Set<string>} */
  const scores = new Set();
  /** @type {Set<string>} */
  const run = new Set();
  /** @type {Set<string>} */
  const sourceOutcomes = new Set();
  /** @type {Set<string>} */
  const sourceTypes = new Set();

  if (payload?.run && typeof payload.run === 'object') {
    for (const key of Object.keys(payload.run)) {
      run.add(key);
    }
    const outcomes = payload.run.sourceOutcomes;
    if (Array.isArray(outcomes)) {
      for (const row of outcomes) {
        if (row && typeof row === 'object') {
          for (const key of Object.keys(/** @type {Record<string, unknown>} */ (row))) {
            sourceOutcomes.add(key);
          }
        }
      }
    }
  }

  const signals = Array.isArray(payload?.signals) ? payload.signals : [];
  for (const signal of signals) {
    if (!signal || typeof signal !== 'object') {
      continue;
    }
    const row = /** @type {Record<string, unknown>} */ (signal);
    for (const key of Object.keys(row)) {
      signalTopLevel.add(key);
    }
    if (typeof row.sourceType === 'string' && row.sourceType.trim()) {
      sourceTypes.add(row.sourceType.trim());
    }
    const meta =
      row.sourceMetadata && typeof row.sourceMetadata === 'object'
        ? /** @type {Record<string, unknown>} */ (row.sourceMetadata)
        : null;
    if (meta) {
      for (const key of Object.keys(meta)) {
        sourceMetadata.add(key);
      }
      if (Array.isArray(meta.contributingSources)) {
        for (const entry of meta.contributingSources) {
          if (entry && typeof entry === 'object') {
            for (const key of Object.keys(/** @type {Record<string, unknown>} */ (entry))) {
              contributingSources.add(key);
            }
          }
        }
      }
      if (meta.peopleMatch && typeof meta.peopleMatch === 'object') {
        for (const key of Object.keys(/** @type {Record<string, unknown>} */ (meta.peopleMatch))) {
          peopleMatch.add(key);
        }
      }
    }
    if (row.scores && typeof row.scores === 'object') {
      for (const key of Object.keys(/** @type {Record<string, unknown>} */ (row.scores))) {
        scores.add(key);
      }
    }
  }

  return {
    signalTopLevel,
    sourceMetadata,
    contributingSources,
    peopleMatch,
    scores,
    run,
    sourceOutcomes,
    sourceTypes,
  };
}

/**
 * Strip local push-transport identity fields that are never part of the Convex
 * createDigestRun / addDigestSignal body schemas (rescore identity carriers).
 * pushDigestToConvex already omitKeys these before mutations.
 *
 * @param {{ run?: Record<string, unknown>; signals?: unknown[] }} payload
 * @returns {{ run: Record<string, unknown>; signals: Array<Record<string, unknown>> }}
 */
export function sanitizePayloadForContractCheck(payload) {
  const runIn = payload?.run && typeof payload.run === 'object' ? payload.run : {};
  const { digestRunId: _runDigestRunId, ...run } = /** @type {Record<string, unknown>} */ (runIn);
  void _runDigestRunId;
  const signalsIn = Array.isArray(payload?.signals) ? payload.signals : [];
  const signals = signalsIn.map((signal) => {
    if (!signal || typeof signal !== 'object') {
      return /** @type {Record<string, unknown>} */ ({});
    }
    const row = /** @type {Record<string, unknown>} */ (signal);
    const { digestSignalId: _digestSignalId, ...rest } = row;
    void _digestSignalId;
    return rest;
  });
  return { run, signals };
}

/**
 * Assert emitted keys are a subset of the contract field sets.
 *
 * @param {{ run?: Record<string, unknown>; signals?: unknown[] }} payload
 * @param {{
 *   fieldSets: {
 *     digestSignalInput: string[];
 *     digestSignalScores: string[];
 *     sourceMetadata: string[];
 *     contributingSources: string[];
 *     peopleMatch: string[];
 *     digestRunInput: string[];
 *     digestSourceOutcome: string[];
 *   };
 * }} contract
 * @returns {{ ok: true } | { ok: false; violations: string[]; message: string }}
 */
export function validatePayloadAgainstContract(payload, contract) {
  const emitted = collectEmittedFieldKeys(sanitizePayloadForContractCheck(payload));
  const sets = contract.fieldSets;
  /** @type {string[]} */
  const violations = [
    ...extrasBeyondAllowed(emitted.signalTopLevel, sets.digestSignalInput, 'signal'),
    ...extrasBeyondAllowed(emitted.sourceMetadata, sets.sourceMetadata, 'sourceMetadata'),
    ...extrasBeyondAllowed(
      emitted.contributingSources,
      sets.contributingSources,
      'sourceMetadata.contributingSources[]',
    ),
    ...extrasBeyondAllowed(emitted.peopleMatch, sets.peopleMatch, 'sourceMetadata.peopleMatch'),
    ...extrasBeyondAllowed(emitted.scores, sets.digestSignalScores, 'scores'),
    ...extrasBeyondAllowed(emitted.run, sets.digestRunInput, 'run'),
    ...extrasBeyondAllowed(emitted.sourceOutcomes, sets.digestSourceOutcome, 'run.sourceOutcomes[]'),
  ];

  if (violations.length === 0) {
    return { ok: true };
  }

  const unique = [...new Set(violations)].sort();
  const offending = unique.join(', ');
  return {
    ok: false,
    violations: unique,
    message: `OPS-2 contract violation: extra field(s) not in digest-signal-contract.json: ${offending}`,
  };
}

/**
 * Load contract from env/repo and validate payload. Hard-fails if contract missing.
 *
 * @param {{ run?: Record<string, unknown>; signals?: unknown[] }} payload
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ ok: true; contractPath: string } | { ok: false; contractPath: string; violations: string[]; message: string }}
 */
export function assertPayloadMatchesDigestSignalContract(payload, env = process.env) {
  const contractPath = resolveDigestSignalContractPath(env);
  const contract = loadDigestSignalContract(contractPath);
  const result = validatePayloadAgainstContract(payload, contract);
  if (result.ok) {
    return { ok: true, contractPath };
  }
  return {
    ok: false,
    contractPath,
    violations: result.violations,
    message: result.message,
  };
}

/**
 * COLLECT_ADAPTER_TASK_KEYS → sourceType emitted by buildDigestPushPayload.
 * Used by AC4 new-adapter tripwire.
 */
export const ADAPTER_TASK_KEY_TO_SOURCE_TYPE = Object.freeze({
  trends: 'google_trends',
  newsapi: 'newsapi',
  arxiv: 'arxiv',
  hackernews: 'hackernews',
  github: 'github',
  reddit: 'reddit',
  rss: 'rss',
  producthunt: 'producthunt',
  twitter: 'twitter',
  bluesky: 'bluesky',
  youtube: 'youtube',
  tiktok: 'tiktok',
  instagram: 'instagram',
  pinterest: 'pinterest',
  polymarket: 'polymarket',
  threads: 'threads',
  linkedin: 'linkedin',
});
