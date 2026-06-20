/**
 * Cross-repo digest source registry parity helpers (Story 72-2).
 * Used by tests/digest-source-registry-parity.test.mjs — fails verify when lists drift.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Collect keys → canonical sourceKey (orchestrator + outcome writer). */
export const COLLECT_KEY_TO_SOURCE_KEY = Object.freeze({
  trends: 'google_trends',
});

/** Registry sources not stored as digestSignals.sourceType. */
export const NON_SIGNAL_SOURCE_TYPE_KEYS = Object.freeze(['notebook']);

/** Registry sources not invoked via collectAdapterOutputs. */
export const NON_COLLECT_SOURCE_KEYS = Object.freeze(['deep_signal', 'notebook']);

/** Convex section union literals → canonical sourceKey. */
export const SECTION_LITERAL_TO_SOURCE_KEY = Object.freeze({
  trends: 'google_trends',
  headlines: 'newsapi',
  arxiv: 'arxiv',
  hackernews: 'hackernews',
  deep_signal: 'deep_signal',
  github: 'github',
  reddit: 'reddit',
  rss: 'rss',
  producthunt: 'producthunt',
  twitter: 'twitter',
  bluesky: 'bluesky',
  youtube: 'youtube',
  tiktok: 'tiktok',
  instagram: 'instagram',
});

/** Badge aliases that are not canonical sourceType keys. */
export const BADGE_ALIAS_KEYS = Object.freeze(['perplexity']);

/**
 * @returns {string | null}
 */
export function resolveDashboardRoot() {
  const fromEnv = process.env.CNS_DASHBOARD_ROOT?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }
  const sibling = join(repoRoot, '../cns-dashboard');
  return existsSync(sibling) ? sibling : null;
}

/**
 * @param {string} source
 * @param {string} exportName
 * @returns {string[]}
 */
export function parseRegistrySourceKeys(source, exportName) {
  const blockRe = new RegExp(
    `export const ${exportName} = \\[([\\s\\S]*?)\\] as const`,
  );
  const blockMatch = source.match(blockRe);
  if (!blockMatch) {
    throw new Error(`Could not find export const ${exportName}`);
  }
  return [...blockMatch[1].matchAll(/sourceKey:\s*'([^']+)'/g)].map((match) => match[1]);
}

/**
 * @param {string} source
 * @param {string} exportName
 * @returns {string[]}
 */
export function parseUnionLiterals(source, exportName) {
  const blockRe = new RegExp(
    `export const ${exportName} = v\\.union\\(([\\s\\S]*?)\\);`,
  );
  const blockMatch = source.match(blockRe);
  if (!blockMatch) {
    throw new Error(`Could not find export const ${exportName}`);
  }
  return [...blockMatch[1].matchAll(/v\.literal\('([^']+)'\)/g)].map((match) => match[1]);
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function parseDigestSourceBadgeKeys(source) {
  const blockMatch = source.match(
    /const DIGEST_SOURCE_BADGE: Record<string, string> = \{([\s\S]*?)\};/,
  );
  if (!blockMatch) {
    throw new Error('Could not find DIGEST_SOURCE_BADGE map');
  }
  return [...blockMatch[1].matchAll(/^\s*([a-z0-9_]+):/gm)].map((match) => match[1]);
}

/**
 * @param {string} dashboardRoot
 * @returns {{
 *   healthRegistryKeys: string[];
 *   sourceTypeLiterals: string[];
 *   sectionLiterals: string[];
 *   badgeKeys: string[];
 * }}
 */
export function loadDashboardSourceLists(dashboardRoot) {
  const registrySource = readFileSync(
    join(dashboardRoot, 'convex/lib/digest_source_registry.ts'),
    'utf8',
  );
  const validatorsSource = readFileSync(join(dashboardRoot, 'convex/validators.ts'), 'utf8');
  const feedSource = readFileSync(
    join(dashboardRoot, 'src/lib/utils/nexus-digest-feed.ts'),
    'utf8',
  );

  return {
    healthRegistryKeys: parseRegistrySourceKeys(registrySource, 'DIGEST_SOURCE_HEALTH_REGISTRY'),
    sourceTypeLiterals: parseUnionLiterals(validatorsSource, 'digestSourceTypeValue'),
    sectionLiterals: parseUnionLiterals(validatorsSource, 'digestSectionValue'),
    badgeKeys: parseDigestSourceBadgeKeys(feedSource),
  };
}

/**
 * @param {string[]} left
 * @param {string[]} right
 * @returns {string}
 */
export function formatSetDiff(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const onlyLeft = [...leftSet].filter((key) => !rightSet.has(key));
  const onlyRight = [...rightSet].filter((key) => !leftSet.has(key));
  return JSON.stringify({ onlyLeft, onlyRight }, null, 2);
}
