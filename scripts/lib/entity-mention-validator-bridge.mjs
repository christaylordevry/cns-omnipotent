/**
 * Cross-repo validator bridge (Story 73-3).
 * Invokes cns-dashboard validators via npx tsx:
 * - entityMentionInputValidator for Convex field-schema validation
 * - assertEntityMentionRow for business-rule validation
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveDashboardRoot } from './digest-source-registry-parity.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * @param {unknown} err
 * @returns {string}
 */
function childProcessErrorMessage(err) {
  if (err && typeof err === 'object') {
    const stderr =
      'stderr' in err && err.stderr != null ? String(/** @type {{ stderr: unknown }} */ (err).stderr).trim() : '';
    if (stderr) {
      const lines = stderr
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.find((line) => /^Error: /.test(line)) ?? lines[0];
    }
    if ('message' in err) {
      return String(/** @type {{ message: unknown }} */ (err).message);
    }
  }
  return String(err);
}

/**
 * @param {string} path
 * @returns {string}
 */
function formatPath(path) {
  return path || 'row';
}

/**
 * Validates a value against the real Convex validator object exported by cns-dashboard.
 * This intentionally reads the validator's runtime structure instead of maintaining
 * parallel literal lists in Omnipotent.md.
 *
 * @param {unknown} value
 * @param {Record<string, unknown>} validator
 * @param {string} [path]
 */
export function assertConvexValidatorValue(value, validator, path = 'row') {
  if (!validator || typeof validator !== 'object' || validator.isConvexValidator !== true) {
    throw new Error(`${formatPath(path)} validator is not a Convex validator`);
  }

  if (value === undefined) {
    if (validator.isOptional === 'optional') {
      return;
    }
    throw new Error(`${formatPath(path)} is required`);
  }

  switch (validator.kind) {
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${formatPath(path)} must be an object`);
      }

      const fields = /** @type {Record<string, Record<string, unknown>>} */ (validator.fields);
      const fieldNames = new Set(Object.keys(fields));
      for (const key of Object.keys(/** @type {Record<string, unknown>} */ (value))) {
        if (!fieldNames.has(key)) {
          throw new Error(`${formatPath(path)} has unexpected field ${key}`);
        }
      }
      for (const [key, fieldValidator] of Object.entries(fields)) {
        assertConvexValidatorValue(
          /** @type {Record<string, unknown>} */ (value)[key],
          fieldValidator,
          `${path}.${key}`,
        );
      }
      return;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        throw new Error(`${formatPath(path)} must be an array`);
      }
      const element = /** @type {Record<string, unknown>} */ (validator.element);
      value.forEach((item, index) => assertConvexValidatorValue(item, element, `${path}[${index}]`));
      return;
    }

    case 'union': {
      const members = /** @type {Array<Record<string, unknown>>} */ (validator.members);
      const errors = [];
      for (const member of members) {
        try {
          assertConvexValidatorValue(value, member, path);
          return;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      throw new Error(`${formatPath(path)} did not match any union member: ${errors.join('; ')}`);
    }

    case 'literal':
      if (value !== validator.value) {
        throw new Error(`${formatPath(path)} must be literal ${JSON.stringify(validator.value)}`);
      }
      return;

    case 'id':
    case 'string':
      if (typeof value !== 'string') {
        throw new Error(`${formatPath(path)} must be a string`);
      }
      return;

    case 'float64':
      if (typeof value !== 'number') {
        throw new Error(`${formatPath(path)} must be a number`);
      }
      return;

    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`${formatPath(path)} must be a boolean`);
      }
      return;

    default:
      throw new Error(`${formatPath(path)} uses unsupported Convex validator kind ${String(validator.kind)}`);
  }
}

/**
 * @param {Record<string, unknown>} row
 */
export function assertEntityMentionRowViaDashboard(row) {
  const dashboardRoot = resolveDashboardRoot();
  if (!dashboardRoot) {
    throw new Error(
      'cns-dashboard not found — set CNS_DASHBOARD_ROOT for entityMention validator bridge',
    );
  }

  const entityIntelligencePath = join(dashboardRoot, 'convex/entityIntelligence.ts');
  if (!existsSync(entityIntelligencePath)) {
    throw new Error(`entityIntelligence.ts missing at ${entityIntelligencePath}`);
  }

  const payload = JSON.stringify(row);
  const script = `
    import { entityMentionInputValidator } from ${JSON.stringify(join(dashboardRoot, 'convex/validators.ts'))};
    import { assertConvexValidatorValue } from ${JSON.stringify(fileURLToPath(import.meta.url))};
    import { assertEntityMentionRow } from ${JSON.stringify(entityIntelligencePath)};
    const row = ${payload};
    assertConvexValidatorValue(row, entityMentionInputValidator);
    assertEntityMentionRow(row);
  `;

  try {
    execFileSync('npx', ['tsx', '--eval', script], {
      cwd: repoRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (err) {
    throw new Error(`entityMention validator bridge failed: ${childProcessErrorMessage(err)}`, {
      cause: err,
    });
  }
}

/** Field keys on entityMentionInputValidator per architecture §3.1 / validators.ts. */
export const ENTITY_MENTION_INPUT_KEYS = Object.freeze([
  'digestRunId',
  'ranAt',
  'date',
  'entityKey',
  'entityType',
  'displayName',
  'platform',
  'tracked',
  'mentionCount',
  'distinctSignalCount',
  'sourceTypes',
  'maxPersonalRelevance',
  'maxRankScore',
  'coMentionedTrackedEntities',
  'signalRefs',
  'workspaceId',
]);

/** Required keys (non-optional validator fields). */
export const ENTITY_MENTION_REQUIRED_KEYS = Object.freeze([
  'digestRunId',
  'ranAt',
  'date',
  'entityKey',
  'entityType',
  'displayName',
  'tracked',
  'mentionCount',
  'distinctSignalCount',
  'sourceTypes',
  'signalRefs',
]);
