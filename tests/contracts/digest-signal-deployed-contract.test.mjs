/**
 * M1 — deploy-aware contract ⊆ deployed function-spec (M0 replay).
 *
 * Path kept under tests/contracts/ to match the suite location used during M1
 * (digest-signal-deployed-contract.test.*). Implementation owner: Omnipotent.md.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
	assertContractSubsetOfDeployed,
	checkDigestContractSubsetOfDeployed,
	extractDigestFieldSetsFromFunctionSpec
} from '../../scripts/lib/digest-signal-deployed-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_SKINNY = path.join(
	__dirname,
	'../fixtures/prod-function-spec-pre-m0-skinny.json'
);

function contractWithTripleCounts() {
	return {
		meta: {
			generated: true,
			generatedFrom: 'test-fixture',
			regenerateCommand: 'n/a',
			generatedAt: '2026-07-23T00:00:00.000Z'
		},
		fieldSets: {
			digestSignalInput: ['digestRunId', 'sourceType', 'title', 'topicSlug'],
			digestSignalScores: ['momentum', 'novelty', 'relevance'],
			sourceMetadata: ['viewCount', 'contributingSources', 'peopleMatch'],
			contributingSources: ['sourceType', 'url', 'viewCount'],
			peopleMatch: ['matchType', 'personName'],
			digestRunInput: ['date', 'ranAt', 'sourceOutcomes', 'workspaceId'],
			digestSourceOutcome: [
				'contributedCount',
				'fetchCount',
				'reason',
				'signalCount',
				'sourceKey',
				'status',
				'storedPrimaryCount'
			]
		}
	};
}

describe('M1 deploy-aware contract ⊆ function-spec (M0 replay)', () => {
	it('FAILS LOUD when contract has triple-count fields prod function-spec lacks (pre-M0 skinny)', () => {
		const raw = JSON.parse(readFileSync(FIXTURE_SKINNY, 'utf8'));
		const deployed = extractDigestFieldSetsFromFunctionSpec(raw);
		const result = assertContractSubsetOfDeployed(contractWithTripleCounts(), deployed);

		assert.equal(result.status, 'fail');
		assert.match(result.violations.join('\n'), /contributedCount/);
		assert.match(result.violations.join('\n'), /fetchCount/);
		assert.match(result.violations.join('\n'), /storedPrimaryCount/);
		assert.match(result.message, /deployed/i);
	});

	it('PASSES when deployed function-spec includes every contract allowlisted field', () => {
		const raw = JSON.parse(readFileSync(FIXTURE_SKINNY, 'utf8'));
		const create = raw.functions.find((f) => f.identifier === 'digest.js:createDigestRun');
		const so =
			create?.args?.value?.run?.fieldType?.value?.sourceOutcomes?.fieldType?.value?.value;
		assert.ok(so);
		for (const k of ['contributedCount', 'fetchCount', 'storedPrimaryCount']) {
			so[k] = { fieldType: { type: 'number' }, optional: true };
		}
		const deployed = extractDigestFieldSetsFromFunctionSpec(raw);
		const result = assertContractSubsetOfDeployed(contractWithTripleCounts(), deployed);
		assert.equal(result.status, 'pass');
	});

	it('loud-skips when Omnipotent root is absent (never silent green)', () => {
		const result = checkDigestContractSubsetOfDeployed({
			omnipotentRoot: '/tmp/m1-nonexistent-omnipotent-root',
			functionSpec: JSON.parse(readFileSync(FIXTURE_SKINNY, 'utf8')),
			failOnSkip: false
		});
		assert.equal(result.status, 'skipped');
		assert.match(String(result.reason), /not found/i);
	});
});
