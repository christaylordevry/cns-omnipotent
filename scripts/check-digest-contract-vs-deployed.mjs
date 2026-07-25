#!/usr/bin/env node
/**
 * M1 — Omnipotent thin invoker for deploy-aware contract check.
 *
 * Implementation lives in cns-dashboard (single owner). This script resolves the
 * sibling dashboard repo and runs its check. Loud SKIP when sibling is absent
 * (OPS-2 missing-sibling pattern). In CI (CI=true / M1_FAIL_ON_SKIP=1), skip → fail.
 *
 * Auth: Convex CLI reads CONVEX_DEPLOY_KEY. Omni CI must map
 *   CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_FUNCTION_SPEC_KEY }}
 * (least-privilege key — not the real deploy key). Do not set
 * M1_ALLOW_DEPLOY_KEY_FALLBACK here.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OMNI_ROOT = join(MODULE_DIR, '..');

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [cwd]
 * @returns {string}
 */
export function resolveCnsDashboardRoot(env = process.env, cwd = process.cwd()) {
	const fromEnv =
		String(env.CNS_DASHBOARD_ROOT ?? '').trim() ||
		String(env.CNS_DASHBOARD_REPO ?? '').trim();
	if (fromEnv) {
		return resolve(fromEnv);
	}
	return resolve(cwd, '../cns-dashboard');
}

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv;
 *   cwd?: string;
 *   spawn?: typeof spawnSync;
 * }} [opts]
 * @returns {{
 *   status: 'pass' | 'fail' | 'skipped';
 *   exitCode: number;
 *   reason?: string;
 *   dashboardRoot: string;
 *   stdout?: string;
 *   stderr?: string;
 * }}
 */
export function invokeDigestContractVsDeployedCheck(opts = {}) {
	const env = opts.env ?? process.env;
	const cwd = opts.cwd ?? process.cwd();
	const spawn = opts.spawn ?? spawnSync;
	const dashboardRoot = resolveCnsDashboardRoot(env, cwd);
	const scriptPath = join(dashboardRoot, 'scripts/check-digest-contract-vs-deployed.ts');
	const failOnSkip = env.CI === 'true' || env.M1_FAIL_ON_SKIP === '1';

	if (!existsSync(join(dashboardRoot, 'package.json')) || !existsSync(scriptPath)) {
		const reason = `cns-dashboard sibling not found at ${dashboardRoot} (looked for package.json + check script). Set CNS_DASHBOARD_ROOT if relocated.`;
		if (failOnSkip) {
			console.error(`[M1] FAIL: ${reason}`);
			return { status: 'fail', exitCode: 1, reason, dashboardRoot };
		}
		console.warn(`\n[M1] SKIP digest-contract-vs-deployed: ${reason}\n`);
		return { status: 'skipped', exitCode: 0, reason, dashboardRoot };
	}

	const hasCliKey =
		Boolean(String(env.CONVEX_DEPLOY_KEY ?? '').trim()) ||
		Boolean(String(env.CONVEX_FUNCTION_SPEC_KEY ?? '').trim());
	if (!hasCliKey && failOnSkip) {
		const reason =
			'CONVEX_DEPLOY_KEY is required in CI (map secrets.CONVEX_FUNCTION_SPEC_KEY → CONVEX_DEPLOY_KEY; least-privilege function-spec key only).';
		console.error(`[M1] FAIL: ${reason}`);
		return { status: 'fail', exitCode: 1, reason, dashboardRoot };
	}

	const childEnv = { ...env };
	// Never allow Omni to opt into deploy-key fallback labeling.
	delete childEnv.M1_ALLOW_DEPLOY_KEY_FALLBACK;
	// If only the GitHub-secret-style name is set, map it for the Convex CLI.
	if (!String(childEnv.CONVEX_DEPLOY_KEY ?? '').trim()) {
		const specKey = String(childEnv.CONVEX_FUNCTION_SPEC_KEY ?? '').trim();
		if (specKey) {
			childEnv.CONVEX_DEPLOY_KEY = specKey;
		}
	}
	childEnv.OMNIPOTENT_ROOT =
		String(env.OMNIPOTENT_ROOT ?? '').trim() || resolve(DEFAULT_OMNI_ROOT);
	childEnv.M1_FAIL_ON_SKIP = failOnSkip ? '1' : env.M1_FAIL_ON_SKIP;

	const result = spawn(
		'npx',
		['vite-node', 'scripts/check-digest-contract-vs-deployed.ts'],
		{
			cwd: dashboardRoot,
			env: childEnv,
			encoding: 'utf8',
			shell: process.platform === 'win32'
		}
	);

	const stdout = result.stdout || '';
	const stderr = result.stderr || '';
	if (stdout) process.stdout.write(stdout);
	if (stderr) process.stderr.write(stderr);

	if (result.status === 0) {
		return { status: 'pass', exitCode: 0, dashboardRoot, stdout, stderr };
	}
	return {
		status: 'fail',
		exitCode: result.status ?? 1,
		reason: `dashboard check exited ${result.status}`,
		dashboardRoot,
		stdout,
		stderr
	};
}

const isMain =
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
	const result = invokeDigestContractVsDeployedCheck();
	process.exit(result.exitCode);
}
