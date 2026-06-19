import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ADAPTER_DATA_KEYS, ADAPTER_PAYLOAD_ARRAY_KEYS } from '../scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs';
import {
  BADGE_ALIAS_KEYS,
  COLLECT_KEY_TO_SOURCE_KEY,
  formatSetDiff,
  loadDashboardSourceLists,
  NON_COLLECT_SOURCE_KEYS,
  NON_SIGNAL_SOURCE_TYPE_KEYS,
  resolveDashboardRoot,
  SECTION_LITERAL_TO_SOURCE_KEY,
} from '../scripts/lib/digest-source-registry-parity.mjs';
import { DIGEST_SOURCE_SECTION_MAP } from '../scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs';
import { COLLECT_ADAPTER_TASK_KEYS } from '../scripts/run-digest-convex-completion.mjs';

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

describe('digest source registry parity (Story 72-2)', () => {
  const sectionMapKeys = DIGEST_SOURCE_SECTION_MAP.map(({ sourceKey }) => sourceKey);
  const signalSourceTypeKeys = sortedUnique(
    sectionMapKeys.filter((key) => !NON_SIGNAL_SOURCE_TYPE_KEYS.includes(key)),
  );
  const dashboardRoot = resolveDashboardRoot();

  it('adapter payload array keys stay aligned between classification and outcome counting', () => {
    assert.deepEqual(
      sortedUnique([...ADAPTER_DATA_KEYS]),
      sortedUnique([...ADAPTER_PAYLOAD_ARRAY_KEYS]),
      'ADAPTER_DATA_KEYS must match ADAPTER_PAYLOAD_ARRAY_KEYS',
    );
  });

  it('collectAdapterOutputs keys map to expected canonical source keys', () => {
    const mappedCollectKeys = COLLECT_ADAPTER_TASK_KEYS.map(
      (key) => COLLECT_KEY_TO_SOURCE_KEY[key] ?? key,
    );
    const expectedCollectKeys = sortedUnique(
      sectionMapKeys.filter((key) => !NON_COLLECT_SOURCE_KEYS.includes(key)),
    );
    assert.deepEqual(
      sortedUnique(mappedCollectKeys),
      expectedCollectKeys,
      `collect task keys drift from section map:\n${formatSetDiff(mappedCollectKeys, expectedCollectKeys)}`,
    );
  });

  it('section literal union maps to signal sourceType keys', () => {
    const mappedSectionKeys = sortedUnique(Object.values(SECTION_LITERAL_TO_SOURCE_KEY));
    assert.deepEqual(
      mappedSectionKeys,
      signalSourceTypeKeys,
      `digestSectionValue literals drift:\n${formatSetDiff(mappedSectionKeys, signalSourceTypeKeys)}`,
    );
  });

  it('cross-repo source-key registries stay aligned when cns-dashboard is present', () => {
    if (!dashboardRoot) {
      return;
    }

    const dashboard = loadDashboardSourceLists(dashboardRoot);

    assert.deepEqual(
      sortedUnique(dashboard.healthRegistryKeys),
      sortedUnique(sectionMapKeys),
      `DIGEST_SOURCE_HEALTH_REGISTRY drift vs DIGEST_SOURCE_SECTION_MAP:\n${formatSetDiff(dashboard.healthRegistryKeys, sectionMapKeys)}`,
    );

    assert.deepEqual(
      sortedUnique(dashboard.sourceTypeLiterals),
      signalSourceTypeKeys,
      `digestSourceTypeValue drift vs DIGEST_SOURCE_SECTION_MAP:\n${formatSetDiff(dashboard.sourceTypeLiterals, signalSourceTypeKeys)}`,
    );

    const badgeCanonicalKeys = sortedUnique(
      dashboard.badgeKeys.filter((key) => !BADGE_ALIAS_KEYS.includes(key)),
    );
    assert.deepEqual(
      badgeCanonicalKeys,
      signalSourceTypeKeys,
      `DIGEST_SOURCE_BADGE drift vs signal source types:\n${formatSetDiff(badgeCanonicalKeys, signalSourceTypeKeys)}`,
    );

    assert.deepEqual(
      sortedUnique(dashboard.sectionLiterals),
      sortedUnique(Object.keys(SECTION_LITERAL_TO_SOURCE_KEY)),
      `digestSectionValue literal set drift:\n${formatSetDiff(dashboard.sectionLiterals, Object.keys(SECTION_LITERAL_TO_SOURCE_KEY))}`,
    );
  });
});
