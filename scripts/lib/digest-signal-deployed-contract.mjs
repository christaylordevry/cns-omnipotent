/**
 * M1 — deploy-aware digest-signal contract check (SINGLE OWNER: Omnipotent.md).
 *
 * Truth model:
 * - cns-dashboard convex/validators.ts = authoring SSOT (generator)
 * - contracts/digest-signal-contract.json = producer allowlist (this repo)
 * - prod `npx convex function-spec` = runtime truth
 *
 * Invariant: contract.fieldSets[k] ⊆ deployedFieldSets[k]
 * Never regenerate the contract FROM function-spec.
 *
 * cns-dashboard invokes this module via sibling path (public checkout; no PAT).
 */

import {
	existsSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OMNIPOTENT_ROOT = path.join(MODULE_DIR, '..', '..');

export const DIGEST_SIGNAL_CONTRACT_RELATIVE_PATH = 'contracts/digest-signal-contract.json';
export const CREATE_DIGEST_RUN_ID = 'digest.js:createDigestRun';
export const ADD_DIGEST_SIGNAL_ID = 'digest.js:addDigestSignal';

export const REQUIRED_DEPLOYED_FIELD_SETS = Object.freeze([
	'digestSignalInput',
	'digestSignalScores',
	'sourceMetadata',
	'contributingSources',
	'peopleMatch',
	'digestRunInput',
	'digestSourceOutcome'
]);

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [cwd]
 * @returns {string}
 */
export function resolveOmnipotentRoot(env = process.env, cwd = process.cwd()) {
	const fromEnv =
		String(env.OMNIPOTENT_ROOT ?? '').trim() ||
		String(env.OMNIPOTENT_REPO ?? '').trim() ||
		String(env.CNS_REPO_ROOT ?? '').trim();
	if (fromEnv) {
		return path.resolve(fromEnv);
	}
	return path.resolve(DEFAULT_OMNIPOTENT_ROOT);
}

/**
 * @param {{ type?: string, value?: unknown, fieldType?: object }} | undefined} node
 * @param {string} label
 * @returns {string[]}
 */
function objectFieldNamesFromSpec(node, label) {
	if (!node || node.type !== 'object' || !node.value || typeof node.value !== 'object') {
		throw new Error(`M1: expected object validator at ${label}`);
	}
	return Object.keys(/** @type {Record<string, unknown>} */ (node.value)).sort();
}

/**
 * @param {{ type?: string, value?: unknown, fieldType?: object } | undefined} node
 */
function unwrapFieldType(node) {
	if (!node) return undefined;
	if (node.fieldType) return unwrapFieldType(/** @type {typeof node} */ (node.fieldType));
	return node;
}

/**
 * @param {{ type?: string, value?: unknown, fieldType?: object } | undefined} node
 * @param {string} label
 */
function arrayElementObject(node, label) {
	const unwrapped = unwrapFieldType(node);
	if (!unwrapped || unwrapped.type !== 'array') {
		throw new Error(`M1: expected array at ${label}`);
	}
	const elem = unwrapFieldType(/** @type {{ value?: object }} */ (unwrapped).value);
	if (!elem || elem.type !== 'object') {
		throw new Error(`M1: expected array-of-object at ${label}`);
	}
	return elem;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string[]>}
 */
export function extractDigestFieldSetsFromFunctionSpec(raw) {
	const doc = /** @type {{ functions?: Array<{ identifier?: string, args?: object }> }} */ (raw);
	const functions = Array.isArray(doc?.functions) ? doc.functions : [];
	const createRun = functions.find((f) => f.identifier === CREATE_DIGEST_RUN_ID);
	const addSignal = functions.find((f) => f.identifier === ADD_DIGEST_SIGNAL_ID);
	if (!createRun?.args) {
		throw new Error(`M1: function-spec missing ${CREATE_DIGEST_RUN_ID}`);
	}
	if (!addSignal?.args) {
		throw new Error(`M1: function-spec missing ${ADD_DIGEST_SIGNAL_ID}`);
	}

	const runArgs = unwrapFieldType(/** @type {any} */ (createRun.args));
	const run = unwrapFieldType(runArgs?.value?.run);
	if (!run || run.type !== 'object') {
		throw new Error(`M1: ${CREATE_DIGEST_RUN_ID} missing args.run object`);
	}

	const sourceOutcomes = arrayElementObject(
		run.value.sourceOutcomes,
		`${CREATE_DIGEST_RUN_ID}.run.sourceOutcomes`
	);

	const signalRoot = unwrapFieldType(/** @type {any} */ (addSignal.args));
	const signal = unwrapFieldType(signalRoot?.value?.signal);
	if (!signal || signal.type !== 'object') {
		throw new Error(`M1: ${ADD_DIGEST_SIGNAL_ID} missing args.signal object`);
	}

	const signalFields = signal.value;
	const sourceMetadata = unwrapFieldType(signalFields.sourceMetadata);
	if (!sourceMetadata || sourceMetadata.type !== 'object') {
		throw new Error(`M1: ${ADD_DIGEST_SIGNAL_ID} missing signal.sourceMetadata object`);
	}
	const scores = unwrapFieldType(signalFields.scores);
	if (!scores || scores.type !== 'object') {
		throw new Error(`M1: ${ADD_DIGEST_SIGNAL_ID} missing signal.scores object`);
	}

	const metaFields = sourceMetadata.value;
	const contributingSources = arrayElementObject(
		metaFields.contributingSources,
		`${ADD_DIGEST_SIGNAL_ID}.signal.sourceMetadata.contributingSources`
	);
	const peopleMatch = unwrapFieldType(metaFields.peopleMatch);
	if (!peopleMatch || peopleMatch.type !== 'object') {
		throw new Error(
			`M1: ${ADD_DIGEST_SIGNAL_ID} missing signal.sourceMetadata.peopleMatch object`
		);
	}

	return {
		digestRunInput: objectFieldNamesFromSpec(run, 'createDigestRun.run'),
		digestSourceOutcome: objectFieldNamesFromSpec(
			sourceOutcomes,
			'createDigestRun.run.sourceOutcomes[]'
		),
		digestSignalInput: objectFieldNamesFromSpec(signal, 'addDigestSignal.signal'),
		digestSignalScores: objectFieldNamesFromSpec(scores, 'addDigestSignal.signal.scores'),
		sourceMetadata: objectFieldNamesFromSpec(
			sourceMetadata,
			'addDigestSignal.signal.sourceMetadata'
		),
		contributingSources: objectFieldNamesFromSpec(
			contributingSources,
			'addDigestSignal.signal.sourceMetadata.contributingSources[]'
		),
		peopleMatch: objectFieldNamesFromSpec(
			peopleMatch,
			'addDigestSignal.signal.sourceMetadata.peopleMatch'
		)
	};
}

/**
 * @param {{ fieldSets?: Record<string, string[]> }} contract
 * @param {Record<string, string[]>} deployed
 */
export function assertContractSubsetOfDeployed(contract, deployed) {
	/** @type {string[]} */
	const violations = [];
	for (const name of REQUIRED_DEPLOYED_FIELD_SETS) {
		const allowed = contract.fieldSets?.[name];
		const prod = deployed[name];
		if (!Array.isArray(allowed)) {
			violations.push(`contract.fieldSets.${name}: missing or not an array`);
			continue;
		}
		if (!Array.isArray(prod)) {
			violations.push(`deployed.${name}: missing or not an array`);
			continue;
		}
		const prodSet = new Set(prod);
		for (const field of allowed) {
			if (!prodSet.has(field)) {
				violations.push(
					`contract.fieldSets.${name}.${field} not in deployed ${
						name === 'digestSourceOutcome'
							? `${CREATE_DIGEST_RUN_ID} run.sourceOutcomes[]`
							: name === 'digestRunInput'
								? `${CREATE_DIGEST_RUN_ID} run`
								: `${ADD_DIGEST_SIGNAL_ID} signal`
					}`
				);
			}
		}
	}

	if (violations.length === 0) {
		return { status: /** @type {const} */ ('pass'), deployed };
	}

	const unique = [...new Set(violations)].sort();
	return {
		status: /** @type {const} */ ('fail'),
		violations: unique,
		message: `M1 deploy-aware contract violation: contract fields not accepted by deployed function-spec: ${unique.join(', ')}`,
		deployed
	};
}

/**
 * @param {string} contractPath
 */
export function loadDigestSignalContractManifest(contractPath) {
	if (!existsSync(contractPath)) {
		throw new Error(
			`M1: contract missing at ${contractPath} — regenerate via cns-dashboard npm run generate:digest-signal-contract`
		);
	}
	return JSON.parse(readFileSync(contractPath, 'utf8'));
}

/**
 * Convex CLI reads CONVEX_DEPLOY_KEY. Prefer CONVEX_FUNCTION_SPEC_KEY when set
 * (mapped onto CONVEX_DEPLOY_KEY). Works from any cwd when the key scopes a deployment.
 *
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options]
 */
export function fetchProdFunctionSpecJson(options = {}) {
	const cwd = options.cwd ?? process.cwd();
	const envIn = options.env ?? process.env;
	const specKey = envIn.CONVEX_FUNCTION_SPEC_KEY?.trim();
	const deployKey = envIn.CONVEX_DEPLOY_KEY?.trim();

	const env = { ...envIn };
	if (specKey) {
		env.CONVEX_DEPLOY_KEY = specKey;
	} else if (deployKey) {
		env.CONVEX_DEPLOY_KEY = deployKey;
	}

	const before = new Set(
		readdirSync(cwd).filter((n) => n.startsWith('function_spec_') && n.endsWith('.json'))
	);

	const result = spawnSync(
		'npx',
		['--yes', 'convex@1.40.0', 'function-spec', '--prod', '--file'],
		{
			cwd,
			env,
			encoding: 'utf8',
			shell: process.platform === 'win32'
		}
	);
	if (result.status !== 0) {
		const err = (result.stderr || result.stdout || '').trim();
		throw new Error(
			`M1: convex function-spec --prod --file failed (exit ${result.status}): ${err}`
		);
	}

	const after = readdirSync(cwd)
		.filter((n) => n.startsWith('function_spec_') && n.endsWith('.json'))
		.map((n) => path.join(cwd, n));
	const created = after.filter((p) => !before.has(path.basename(p)));
	const candidates = created.length > 0 ? created : after;
	if (candidates.length === 0) {
		throw new Error(
			'M1: function-spec --file produced no function_spec_*.json (convex CLI changed?)'
		);
	}
	candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
	const chosen = candidates[0];
	try {
		return JSON.parse(readFileSync(chosen, 'utf8'));
	} finally {
		rmSync(chosen, { force: true });
	}
}

/**
 * @param {{
 *   omnipotentRoot?: string,
 *   env?: NodeJS.ProcessEnv,
 *   cwd?: string,
 *   functionSpec?: unknown,
 *   failOnSkip?: boolean,
 * }} [options]
 */
export function checkDigestContractSubsetOfDeployed(options = {}) {
	const env = options.env ?? process.env;
	const cwd = options.cwd ?? process.cwd();
	const omnipotentRoot =
		options.omnipotentRoot !== undefined
			? path.resolve(options.omnipotentRoot)
			: resolveOmnipotentRoot(env, cwd);

	const failOnSkip =
		options.failOnSkip === true ||
		(options.failOnSkip !== false &&
			(env.CI === 'true' || env.M1_FAIL_ON_SKIP === '1'));

	const contractPath = path.join(omnipotentRoot, DIGEST_SIGNAL_CONTRACT_RELATIVE_PATH);

	if (!existsSync(path.join(omnipotentRoot, 'package.json'))) {
		const reason = `Omnipotent.md root not found at ${omnipotentRoot} (looked for package.json). Set OMNIPOTENT_ROOT if relocated.`;
		if (failOnSkip) {
			return {
				status: /** @type {const} */ ('fail'),
				contractPath,
				omnipotentRoot,
				violations: [reason],
				message: `M1: ${reason}`
			};
		}
		console.warn(`\n[M1] SKIP digest-contract-vs-deployed: ${reason}\n`);
		return { status: /** @type {const} */ ('skipped'), reason, omnipotentRoot };
	}

	let contract;
	try {
		contract = loadDigestSignalContractManifest(contractPath);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			status: /** @type {const} */ ('fail'),
			contractPath,
			omnipotentRoot,
			violations: [message],
			message
		};
	}

	let deployed;
	try {
		const raw =
			options.functionSpec !== undefined
				? options.functionSpec
				: fetchProdFunctionSpecJson({ cwd, env });
		deployed = extractDigestFieldSetsFromFunctionSpec(raw);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			status: /** @type {const} */ ('fail'),
			contractPath,
			omnipotentRoot,
			violations: [message],
			message
		};
	}

	const subset = assertContractSubsetOfDeployed(contract, deployed);
	if (subset.status === 'pass') {
		return {
			status: /** @type {const} */ ('pass'),
			contractPath,
			omnipotentRoot,
			deployed: subset.deployed
		};
	}
	return {
		status: /** @type {const} */ ('fail'),
		contractPath,
		omnipotentRoot,
		violations: subset.violations,
		message: subset.message,
		deployed: subset.deployed
	};
}
