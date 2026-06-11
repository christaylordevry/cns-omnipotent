#!/usr/bin/env node
/**
 * Epic 68 live-digest validation helper (Story 68-8).
 * Queries Convex digest signals and evaluates addendum A6 + FR-16 checklist.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveConvexPushEnv } from './hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';
import { normalizeDigestUrl } from './hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs';
import { postQuery } from './push-digest-watchdog.mjs';

const RECENT_RUNS_PATH = 'digest:getRecentDigestRuns';
const SIGNALS_PATH = 'digest:getDigestSignalsForRun';
const RECENT_RUNS_LIMIT = 10;
const SIGNALS_LIMIT = 100;
const MIN_SCORED_SIGNALS = 30;
const MAX_UNSCORED_RATIO = 0.1;
export const PEOPLE_RELEVANCE_THRESHOLD = 20;

export const CLI_HELP_TEXT =
  'Usage: node scripts/validate-epic-68-digest.mjs [--digest-run-id <id> | --latest] [--json] [--x-go | --x-no-go] [--people-done]';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {Array<Record<string, unknown>>} signals
 * @returns {Record<string, number>}
 */
export function countBySourceType(signals) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const signal of signals) {
    const sourceType = typeof signal.sourceType === 'string' ? signal.sourceType : '_unknown_';
    counts[sourceType] = (counts[sourceType] ?? 0) + 1;
  }
  return counts;
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @returns {{ scored: number; total: number; unscoredRatio: number }}
 */
export function countScored(signals) {
  const total = signals.length;
  let scored = 0;
  for (const signal of signals) {
    if (signal.rankScore !== undefined && signal.rankScore !== null) {
      scored += 1;
    }
  }
  return {
    scored,
    total,
    unscoredRatio: total === 0 ? 1 : (total - scored) / total,
  };
}

/**
 * @param {unknown} metadata
 * @returns {boolean}
 */
function hasEngagementMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  const meta = /** @type {Record<string, unknown>} */ (metadata);
  return (
    (typeof meta.likes === 'number' && meta.likes >= 0) ||
    (typeof meta.reposts === 'number' && meta.reposts >= 0)
  );
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @returns {Array<Record<string, unknown>>}
 */
export function findDedupClusters(signals) {
  return signals.filter((signal) => {
    const metadata = signal.sourceMetadata;
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }
    const meta = /** @type {Record<string, unknown>} */ (metadata);
    const contributing = meta.contributingSources;
    const clusterSize = meta.dedupClusterSize;
    return (
      Array.isArray(contributing) &&
      contributing.length >= 2 &&
      typeof clusterSize === 'number' &&
      clusterSize >= 2
    );
  });
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @returns {Array<{ url: string; titles: string[]; count: number }>}
 */
export function findDuplicateUrlClusters(signals) {
  /** @type {Map<string, { titles: Set<string>; count: number }>} */
  const byUrl = new Map();

  for (const signal of signals) {
    const url = typeof signal.url === 'string' ? signal.url : '';
    const normalized = normalizeDigestUrl(url);
    if (!normalized) {
      continue;
    }
    const title = typeof signal.title === 'string' ? signal.title.trim() : '';
    const bucket = byUrl.get(normalized) ?? { titles: new Set(), count: 0 };
    bucket.count += 1;
    if (title) {
      bucket.titles.add(title);
    }
    byUrl.set(normalized, bucket);
  }

  /** @type {Array<{ url: string; titles: string[]; count: number }>} */
  const leaks = [];
  for (const [url, bucket] of byUrl) {
    if (bucket.count > 1) {
      leaks.push({ url, titles: [...bucket.titles], count: bucket.count });
    }
  }
  return leaks;
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @returns {boolean}
 */
export function hasPeopleBoostEvidence(signals) {
  return signals.some((signal) => {
    const scores = signal.scores;
    const metadata = signal.sourceMetadata;
    if (!scores || typeof scores !== 'object') {
      return false;
    }
    const personalRelevance = /** @type {{ personalRelevance?: number }} */ (scores).personalRelevance;
    const authorHandle =
      metadata && typeof metadata === 'object'
        ? /** @type {{ authorHandle?: string }} */ (metadata).authorHandle
        : undefined;
    return (
      typeof personalRelevance === 'number' &&
      personalRelevance >= PEOPLE_RELEVANCE_THRESHOLD &&
      typeof authorHandle === 'string' &&
      authorHandle.trim().length > 0
    );
  });
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @param {{ xStatus: 'go' | 'no-go'; peopleStoriesDone: boolean }} opts
 * @returns {{
 *   checks: Array<{ id: string; label: string; status: 'pass' | 'fail' | 'waived' | 'manual'; detail: string }>;
 *   overall: 'pass' | 'fail';
 *   sourceTypeCounts: Record<string, number>;
 *   manualChecksPending: string[];
 * }}
 */
export function evaluateEpic68Checks(signals, opts) {
  const sourceTypeCounts = countBySourceType(signals);
  const scored = countScored(signals);
  const dedupClusters = findDedupClusters(signals);
  const urlLeaks = findDuplicateUrlClusters(signals);

  const blueskySignals = signals.filter((s) => s.sourceType === 'bluesky');
  const blueskyWithEngagement = blueskySignals.filter((s) => hasEngagementMetadata(s.sourceMetadata));

  const twitterSignals = signals.filter((s) => s.sourceType === 'twitter');
  const twitterWithEngagement = twitterSignals.filter((s) => hasEngagementMetadata(s.sourceMetadata));

  /** @type {Array<{ id: string; label: string; status: 'pass' | 'fail' | 'waived' | 'manual'; detail: string }>} */
  const checks = [];

  const c1Pass =
    scored.scored >= MIN_SCORED_SIGNALS && scored.unscoredRatio < MAX_UNSCORED_RATIO;
  checks.push({
    id: 'C1',
    label: 'Signal count',
    status: c1Pass ? 'pass' : 'fail',
    detail: `${scored.scored}/${scored.total} with rankScore (${(scored.unscoredRatio * 100).toFixed(1)}% unscored; need ≥${MIN_SCORED_SIGNALS} and <10% unscored)`,
  });

  const c2Pass = blueskyWithEngagement.length >= 1;
  checks.push({
    id: 'C2',
    label: 'Bluesky coverage',
    status: c2Pass ? 'pass' : 'fail',
    detail: `${blueskyWithEngagement.length} bluesky signal(s) with likes/reposts metadata`,
  });

  const c3Waived = opts.xStatus === 'no-go';
  const c3Pass = c3Waived || twitterWithEngagement.length >= 1;
  checks.push({
    id: 'C3',
    label: 'Twitter coverage',
    status: c3Waived ? 'waived' : c3Pass ? 'pass' : 'fail',
    detail: c3Waived
      ? 'X NO-GO documented — twitter row waived'
      : `${twitterWithEngagement.length} twitter signal(s) with engagement metadata`,
  });

  const c4Pass = dedupClusters.length >= 1;
  checks.push({
    id: 'C4',
    label: 'Dedup cluster',
    status: c4Pass ? 'pass' : 'fail',
    detail: `${dedupClusters.length} signal(s) with contributingSources.length ≥ 2 and dedupClusterSize ≥ 2`,
  });

  const c5Pass = urlLeaks.length === 0;
  checks.push({
    id: 'C5',
    label: 'No duplicate URL cluster leak',
    status: c5Pass ? 'pass' : 'fail',
    detail: c5Pass
      ? 'No normalized URL appears on more than one pushed signal'
      : `${urlLeaks.length} duplicate URL cluster(s): ${urlLeaks
          .slice(0, 3)
          .map((l) => l.url)
          .join(', ')}`,
  });

  const c6Waived = !opts.peopleStoriesDone;
  const c6Pass = c6Waived || hasPeopleBoostEvidence(signals);
  checks.push({
    id: 'C6',
    label: 'People boost',
    status: c6Waived ? 'waived' : c6Pass ? 'pass' : 'fail',
    detail: c6Waived
      ? '68-2/68-3 backlog — people-boost waived'
      : c6Pass
        ? 'At least one signal shows elevated personalRelevance with authorHandle'
        : 'No people-match evidence in scored signals',
  });

  checks.push({
    id: 'C7',
    label: 'Discord merged attribution',
    status: 'manual',
    detail:
      'Operator confirms single Discord headline for merged cluster (not machine-checkable from Convex)',
  });

  const c8Pass = (sourceTypeCounts.producthunt ?? 0) >= 1;
  checks.push({
    id: 'C8',
    label: 'ProductHunt regression',
    status: c8Pass ? 'pass' : 'fail',
    detail: `${sourceTypeCounts.producthunt ?? 0} producthunt signal(s)`,
  });

  const c9Pass = (sourceTypeCounts.github ?? 0) >= 1;
  checks.push({
    id: 'C9',
    label: 'GitHub regression',
    status: c9Pass ? 'pass' : 'fail',
    detail: `${sourceTypeCounts.github ?? 0} github signal(s)`,
  });

  const c10Pass = (sourceTypeCounts.rss ?? 0) >= 1;
  checks.push({
    id: 'C10',
    label: 'RSS regression',
    status: c10Pass ? 'pass' : 'fail',
    detail: `${sourceTypeCounts.rss ?? 0} rss signal(s)`,
  });

  checks.push({
    id: 'C11',
    label: 'Dedup effectiveness',
    status: 'manual',
    detail: 'Document pre/post dedup counts in Run Record (not auto-scored)',
  });

  const machineChecks = checks.filter((c) => c.status !== 'manual');
  const overall = machineChecks.every((c) => c.status === 'pass' || c.status === 'waived')
    ? 'pass'
    : 'fail';
  const manualChecksPending = checks.filter((c) => c.status === 'manual').map((c) => c.id);

  return { checks, overall, sourceTypeCounts, manualChecksPending };
}

/**
 * @param {unknown} runs
 * @returns {string | null}
 */
export function pickLatestDigestRunId(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return null;
  }
  for (const run of runs) {
    if (!run || typeof run !== 'object') {
      continue;
    }
    const row = /** @type {{ _id?: string; status?: string }} */ (run);
    if (typeof row._id !== 'string') {
      continue;
    }
    if (row.status === 'failed') {
      continue;
    }
    return row._id;
  }
  return null;
}

/**
 * @param {Array<{ id: string; label: string; status: string; detail: string }>} checks
 * @returns {string}
 */
export function formatChecklistTable(checks) {
  const lines = ['Epic 68 digest validation (addendum A6 + FR-16)', ''];
  const statusWidth = 8;
  for (const check of checks) {
    const status = check.status.toUpperCase().padEnd(statusWidth);
    lines.push(`${check.id}  ${status}  ${check.label}`);
    lines.push(`      ${check.detail}`);
  }
  return lines.join('\n');
}

/**
 * @param {string[]} argv
 * @returns {{
 *   digestRunId?: string;
 *   latest: boolean;
 *   json: boolean;
 *   xStatus?: 'go' | 'no-go';
 * }}
 */
export function parseCliArgs(argv) {
  /** @type {{ digestRunId?: string; latest: boolean; json: boolean; peopleDone: boolean; xStatus?: 'go' | 'no-go' }} */
  const parsed = { latest: false, json: false, peopleDone: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--latest') {
      parsed.latest = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--people-done') {
      parsed.peopleDone = true;
    } else if (arg === '--x-go') {
      parsed.xStatus = 'go';
    } else if (arg === '--x-no-go') {
      parsed.xStatus = 'no-go';
    } else if (arg === '--digest-run-id') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--digest-run-id requires a value');
      }
      parsed.digestRunId = next;
      i += 1;
    }
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    throw new Error('__HELP__');
  }

  if (!parsed.digestRunId && !parsed.latest) {
    throw new Error('Specify --digest-run-id <id> or --latest');
  }
  if (parsed.digestRunId && parsed.latest) {
    throw new Error('Use only one of --digest-run-id or --latest');
  }
  if (argv.includes('--x-go') && argv.includes('--x-no-go')) {
    throw new Error('Use only one of --x-go or --x-no-go');
  }

  return parsed;
}

/**
 * @param {string} repoRootPath
 * @returns {'go' | 'no-go'}
 */
export function detectXStatusFromCheckScript(repoRootPath) {
  const scriptPath = join(repoRootPath, 'scripts/session-close/hermes-run-x-check.sh');
  const result = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    console.warn(
      `validate-epic-68-digest: X check script failed to run (${result.error.message}); defaulting to no-go`,
    );
    return 'no-go';
  }
  if (result.status === null) {
    console.warn('validate-epic-68-digest: X check script terminated abnormally; defaulting to no-go');
    return 'no-go';
  }
  return result.status === 0 ? 'go' : 'no-go';
}

/**
 * @param {{
 *   fetchFn?: typeof fetch;
 *   env?: Record<string, string | undefined>;
 *   argv?: string[];
 *   peopleStoriesDone?: boolean;
 *   xStatusOverride?: 'go' | 'no-go';
 *   repoRootPath?: string;
 * }} [opts]
 * @returns {Promise<{ exitCode: number; jsonMode: boolean; report: Record<string, unknown> }>}
 */
export async function runValidateEpic68Digest(opts = {}) {
  const fetchFn = opts.fetchFn ?? fetch;
  const env = opts.env ?? process.env;
  const argv = opts.argv ?? process.argv.slice(2);
  const repoRootPath = opts.repoRootPath ?? repoRoot;
  const cli = parseCliArgs(argv);
  const peopleStoriesDone = opts.peopleStoriesDone ?? cli.peopleDone;
  const convexEnv = await resolveConvexPushEnv(env);
  if (!convexEnv) {
    throw new Error('CONVEX_URL and CONVEX_DEPLOY_KEY required (trend-ingest.env)');
  }

  let xStatus = cli.xStatus ?? opts.xStatusOverride;
  if (!xStatus) {
    xStatus = detectXStatusFromCheckScript(repoRootPath);
  }

  let digestRunId = cli.digestRunId;
  if (cli.latest) {
    const runs = await postQuery(fetchFn, convexEnv, RECENT_RUNS_PATH, {
      limit: RECENT_RUNS_LIMIT,
    });
    digestRunId = pickLatestDigestRunId(runs) ?? undefined;
    if (!digestRunId) {
      throw new Error('No non-failed digest run found in recent runs');
    }
  }

  if (!digestRunId) {
    throw new Error('digestRunId is required');
  }

  const signals = await postQuery(fetchFn, convexEnv, SIGNALS_PATH, {
    digestRunId,
    limit: SIGNALS_LIMIT,
  });

  if (!Array.isArray(signals)) {
    throw new Error('getDigestSignalsForRun returned unexpected payload');
  }

  const signalsTruncated = signals.length >= SIGNALS_LIMIT;
  if (signalsTruncated) {
    console.warn(
      `validate-epic-68-digest: fetched ${signals.length} signals (limit ${SIGNALS_LIMIT}); counts may omit lower-ranked rows`,
    );
  }

  const evaluation = evaluateEpic68Checks(
    /** @type {Array<Record<string, unknown>>} */ (signals),
    { xStatus, peopleStoriesDone },
  );

  const report = {
    digestRunId,
    xStatus,
    signalCount: signals.length,
    signalsTruncated,
    sourceTypeCounts: evaluation.sourceTypeCounts,
    checks: evaluation.checks,
    manualChecksPending: evaluation.manualChecksPending,
    overall: evaluation.overall,
  };

  return {
    exitCode: evaluation.overall === 'pass' ? 0 : 1,
    jsonMode: cli.json,
    report,
  };
}

async function main() {
  try {
    const { exitCode, jsonMode, report } = await runValidateEpic68Digest();

    if (jsonMode) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatChecklistTable(/** @type {Array<never>} */ (report.checks)));
      console.log('');
      console.log(`digestRunId: ${report.digestRunId}`);
      console.log(`xStatus: ${report.xStatus}`);
      console.log(`overall: ${report.overall}`);
      const pending = /** @type {string[]} */ (report.manualChecksPending ?? []);
      if (pending.length > 0) {
        console.log(`manualChecksPending: ${pending.join(', ')}`);
      }
    }

    process.exit(exitCode);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === '__HELP__') {
      console.log(CLI_HELP_TEXT);
      process.exit(0);
    }
    console.error(`validate-epic-68-digest: ${message}`);
    process.exit(1);
  }
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) : '';
if (process.argv[1] && invokedPath === process.argv[1]) {
  main();
}
