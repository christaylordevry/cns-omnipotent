#!/usr/bin/env node
/**
 * M1 CLI — assert digest-signal-contract.json ⊆ deployed prod function-spec.
 *
 * Owner: Omnipotent.md (public). cns-dashboard invokes this script via sibling
 * checkout (no PAT). Loud-skip when contract root is absent is handled inside
 * the library (CI sets M1_FAIL_ON_SKIP=1 / CI=true → fail).
 *
 * Auth: Convex CLI reads CONVEX_DEPLOY_KEY. Map the least-privilege secret:
 *   CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_FUNCTION_SPEC_KEY }}
 */
import {
	checkDigestContractSubsetOfDeployed
} from './lib/digest-signal-deployed-contract.mjs';

const result = checkDigestContractSubsetOfDeployed({
	failOnSkip: process.env.CI === 'true' || process.env.M1_FAIL_ON_SKIP === '1'
});

if (result.status === 'skipped') {
	console.warn(`[M1] skipped: ${result.reason}`);
	process.exit(0);
}

if (result.status === 'fail') {
	console.error(`[M1] FAIL: ${result.message}`);
	for (const v of result.violations ?? []) {
		console.error(`  - ${v}`);
	}
	process.exit(1);
}

console.log(`[M1] PASS: contract ⊆ deployed (${result.contractPath})`);
process.exit(0);
