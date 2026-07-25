/**
 * M1 — Omnipotent-owned deploy-aware check CLI / library wiring.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	resolveOmnipotentRoot,
	checkDigestContractSubsetOfDeployed
} from '../scripts/lib/digest-signal-deployed-contract.mjs';

describe('M1 Omnipotent deploy-aware check owner', () => {
	it('resolves OMNIPOTENT_ROOT when set', () => {
		assert.equal(
			resolveOmnipotentRoot({ OMNIPOTENT_ROOT: '/custom/omni' }, '/ignored'),
			'/custom/omni'
		);
	});

	it('loud-skips when root is absent (never silent green)', () => {
		const result = checkDigestContractSubsetOfDeployed({
			omnipotentRoot: '/tmp/m1-nonexistent-omnipotent-root',
			functionSpec: { functions: [] },
			failOnSkip: false
		});
		assert.equal(result.status, 'skipped');
		assert.match(String(result.reason), /not found/i);
	});

	it('fails (not skips) when root absent and M1_FAIL_ON_SKIP=1', () => {
		const result = checkDigestContractSubsetOfDeployed({
			omnipotentRoot: '/tmp/m1-nonexistent-omnipotent-root',
			functionSpec: { functions: [] },
			env: { M1_FAIL_ON_SKIP: '1' }
		});
		assert.equal(result.status, 'fail');
	});
});
