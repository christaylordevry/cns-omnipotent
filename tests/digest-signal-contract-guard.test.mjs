/**
 * OPS-2 Phase B (AC3/AC4) — Omnipotent.md hard gate.
 *
 * Fixture sweep: buildDigestPushPayload → dedupeSignals → emitted keys ⊆ manifest.
 * New-adapter tripwire: every COLLECT_ADAPTER_TASK_KEYS entry must appear in the sweep.
 * Never skip — manifest and producer both live in this repo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COLLECT_ADAPTER_TASK_KEYS } from '../scripts/run-digest-convex-completion.mjs';
import { buildDigestPushPayload } from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import { dedupeDigestSignals } from '../scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs';
import {
  ADAPTER_TASK_KEY_TO_SOURCE_TYPE,
  collectEmittedFieldKeys,
  loadDigestSignalContract,
  resolveDigestSignalContractPath,
  validatePayloadAgainstContract,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/digest-signal-contract-guard.mjs';
import { buildAllAdapterContractFixtureSources } from './fixtures/all-adapters-digest-contract.fixture.mjs';

/**
 * @returns {{
 *   built: { run: Record<string, unknown>; signals: Array<Record<string, unknown>> };
 *   swept: { run: Record<string, unknown>; signals: Array<Record<string, unknown>> };
 * }}
 */
function buildSweptPayload() {
  const sources = buildAllAdapterContractFixtureSources();
  const built = buildDigestPushPayload(sources);
  const signals = dedupeDigestSignals(built.signals);
  return {
    built: { run: built.run, signals: built.signals },
    swept: { run: built.run, signals },
  };
}

describe('OPS-2 digest-signal contract guard (AC3 fixture sweep)', () => {
  it('resolves contract path inside this repo (hard gate — never skip)', () => {
    const path = resolveDigestSignalContractPath();
    assert.match(path, /contracts\/digest-signal-contract\.json$/);
    const contract = loadDigestSignalContract(path);
    assert.ok(Array.isArray(contract.fieldSets.sourceMetadata));
    assert.ok(contract.fieldSets.sourceMetadata.includes('viewCount'));
  });

  it('union of keys from buildDigestPushPayload + dedupeSignals ⊆ manifest', () => {
    const contract = loadDigestSignalContract(resolveDigestSignalContractPath());
    const { swept: payload } = buildSweptPayload();
    const emitted = collectEmittedFieldKeys(payload);

    // Prove the sweep actually exercised the 06-20 field and the dedupe merge.
    assert.ok(
      emitted.sourceMetadata.has('viewCount'),
      'fixture must emit sourceMetadata.viewCount (06-20 defect surface)',
    );
    assert.ok(
      emitted.sourceMetadata.has('contributingSources'),
      'fixture must exercise dedupe merge (:446 spread)',
    );
    assert.ok(
      emitted.sourceMetadata.has('dedupClusterSize'),
      'fixture must emit dedupClusterSize from merge',
    );
    assert.ok(
      emitted.contributingSources.size > 0,
      'fixture must emit contributingSources entry keys',
    );

    const result = validatePayloadAgainstContract(payload, contract);
    assert.equal(
      result.ok,
      true,
      result.ok ? '' : `unexpected violations: ${result.violations.join(', ')}`,
    );
  });

  it('RED-TEST PROOF: emit viewCount with viewCount removed from manifest → FAIL', () => {
    const contract = loadDigestSignalContract(resolveDigestSignalContractPath());
    const stripped = {
      ...contract,
      fieldSets: {
        ...contract.fieldSets,
        sourceMetadata: contract.fieldSets.sourceMetadata.filter((k) => k !== 'viewCount'),
        contributingSources: contract.fieldSets.contributingSources.filter(
          (k) => k !== 'viewCount',
        ),
      },
    };
    assert.equal(
      stripped.fieldSets.sourceMetadata.includes('viewCount'),
      false,
      'red-test setup: viewCount must be absent from stripped manifest',
    );

    const { swept: payload } = buildSweptPayload();
    const result = validatePayloadAgainstContract(payload, stripped);
    assert.equal(result.ok, false, 'red-test must fail when viewCount is off-contract');
    assert.ok(
      result.violations.some((v) => v.includes('viewCount')),
      `expected viewCount in violations, got: ${result.violations?.join(', ')}`,
    );
    assert.match(result.message, /viewCount/);
    console.log(
      '[OPS-2 AC3 red-test] FAIL as required:\n',
      result.message,
      '\nviolations:',
      result.violations.join(', '),
    );
  });
});

describe('OPS-2 digest-signal contract guard (AC4 new-adapter tripwire)', () => {
  it('fixture sweep covers every COLLECT_ADAPTER_TASK_KEYS entry', () => {
    assert.equal(
      COLLECT_ADAPTER_TASK_KEYS.length,
      17,
      'COLLECT_ADAPTER_TASK_KEYS count drifted — update fixture + mapping',
    );

    const { built } = buildSweptPayload();
    // Coverage is asserted on pre-dedupe emissions so a merge cannot erase an adapter.
    const { sourceTypes } = collectEmittedFieldKeys(built);
    /** @type {string[]} */
    const missing = [];

    for (const key of COLLECT_ADAPTER_TASK_KEYS) {
      const expectedSourceType = ADAPTER_TASK_KEY_TO_SOURCE_TYPE[key];
      assert.ok(
        expectedSourceType,
        `ADAPTER_TASK_KEY_TO_SOURCE_TYPE missing entry for collect key "${key}"`,
      );
      if (!sourceTypes.has(expectedSourceType)) {
        missing.push(`${key}→${expectedSourceType}`);
      }
    }

    assert.equal(
      missing.length,
      0,
      `new-adapter tripwire: fixture missing coverage for: ${missing.join(', ')}`,
    );
  });
});
