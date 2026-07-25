/**
 * M1 — Omnipotent thin invoker for dashboard-owned deploy-aware check.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	invokeDigestContractVsDeployedCheck,
	resolveCnsDashboardRoot
} from '../scripts/check-digest-contract-vs-deployed.mjs';

describe('M1 Omni invoker (sibling path)', () => {
	it('resolves CNS_DASHBOARD_ROOT when set', () => {
		assert.equal(
			resolveCnsDashboardRoot({ CNS_DASHBOARD_ROOT: '/custom/cns-dashboard' }, '/ignored'),
			'/custom/cns-dashboard'
		);
	});

	it('loud-skips when dashboard sibling is absent (never silent green)', () => {
		const result = invokeDigestContractVsDeployedCheck({
			env: {
				CNS_DASHBOARD_ROOT: '/tmp/m1-nonexistent-cns-dashboard',
				M1_FAIL_ON_SKIP: undefined,
				CI: undefined
			},
			spawn: () => {
				throw new Error('spawn must not run when sibling missing');
			}
		});
		assert.equal(result.status, 'skipped');
		assert.equal(result.exitCode, 0);
		assert.match(String(result.reason), /not found/i);
	});

	it('fails (not skips) when sibling absent and M1_FAIL_ON_SKIP=1', () => {
		const result = invokeDigestContractVsDeployedCheck({
			env: {
				CNS_DASHBOARD_ROOT: '/tmp/m1-nonexistent-cns-dashboard',
				M1_FAIL_ON_SKIP: '1'
			},
			spawn: () => {
				throw new Error('spawn must not run when sibling missing');
			}
		});
		assert.equal(result.status, 'fail');
		assert.equal(result.exitCode, 1);
	});

	it('fails in CI when CONVEX_DEPLOY_KEY is missing', () => {
		const result = invokeDigestContractVsDeployedCheck({
			env: {
				CNS_DASHBOARD_ROOT: resolveCnsDashboardRoot(),
				CI: 'true'
				// no CONVEX_DEPLOY_KEY / CONVEX_FUNCTION_SPEC_KEY
			},
			spawn: () => {
				throw new Error('spawn must not run without CONVEX_DEPLOY_KEY in CI');
			}
		});
		// If sibling exists locally, expect fail on missing key; if absent, fail on skip.
		assert.equal(result.status, 'fail');
		assert.equal(result.exitCode, 1);
		assert.match(String(result.reason), /CONVEX_DEPLOY_KEY|not found/i);
	});
});
