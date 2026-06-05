#!/usr/bin/env node
/**
 * Upsert keyword candidates into Convex from morning-digest DIGEST_PUSH_JSON signals.
 *
 * Env:
 *   DIGEST_PUSH_JSON — JSON payload { run, signals[] } (same shape as push-digest-convex.mjs)
 *   CONVEX_URL, CONVEX_DEPLOY_KEY (via mergeTrendIngestEnv / operator home)
 */

import {
	readDigestPushPayload,
	resolveConvexPushEnv,
} from './push-digest-convex.mjs';

const UPSERT_PATH = 'keywordCandidates:upsertKeywordCandidate';

const EXTRACT_SOURCE_TYPES = new Set(['google_trends', 'hackernews', 'arxiv']);

const CATEGORY_BY_SOURCE = {
	google_trends: 'trending',
	hackernews: 'adjacent',
	arxiv: 'adjacent',
};

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeTerm(value) {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @param {string} convexUrl
 * @returns {string}
 */
function normalizeConvexUrl(convexUrl) {
	return convexUrl.replace(/\/$/, '');
}

/**
 * @param {unknown} signal
 * @returns {number}
 */
function trendComponentForSignal(signal) {
	const sourceType = signal?.sourceType;
	const score = typeof signal?.score === 'number' ? signal.score : undefined;

	if (sourceType === 'google_trends') {
		return score ?? 0;
	}
	if (sourceType === 'hackernews') {
		if (typeof score === 'number') {
			return Math.min(score / 500, 1);
		}
		return 0.3;
	}
	if (sourceType === 'arxiv') {
		return 0.25;
	}
	return 0;
}

/**
 * @param {{
 *   sourceType: string;
 *   trendComponent: number;
 *   seenCount?: number;
 * }} opts
 * @returns {number}
 */
export function scoreKeywordCandidate(opts) {
	const seenCount = opts.seenCount ?? 1;
	const recency = 1.0;
	const seenCountComponent = Math.min(seenCount / 10, 1);
	return opts.trendComponent * 0.4 + recency * 0.3 + seenCountComponent * 0.3;
}

/**
 * @param {{ run: Record<string, unknown>; signals: unknown[] }} payload
 * @returns {Array<{ term: string; displayTerm: string; sourceType: string; score: number; category: string; trendComponent: number }>}
 */
export function extractKeywordCandidates(payload) {
	/** @type {Map<string, { term: string; displayTerm: string; sourceType: string; score: number; category: string; trendComponent: number }>} */
	const byTerm = new Map();

	for (const signal of payload.signals) {
		if (!signal || typeof signal !== 'object') {
			continue;
		}
		const sourceType = signal.sourceType;
		if (typeof sourceType !== 'string' || !EXTRACT_SOURCE_TYPES.has(sourceType)) {
			continue;
		}
		const title = typeof signal.title === 'string' ? signal.title.trim() : '';
		if (!title) {
			continue;
		}
		const term = normalizeTerm(title);
		if (term.length < 2 || term.length > 120) {
			continue;
		}

		const trendComponent = trendComponentForSignal(signal);
		const category = CATEGORY_BY_SOURCE[sourceType] ?? 'adjacent';
		const score = scoreKeywordCandidate({ sourceType, trendComponent });

		const existing = byTerm.get(term);
		if (!existing || trendComponent > existing.trendComponent) {
			byTerm.set(term, {
				term,
				displayTerm: title,
				sourceType,
				score,
				category,
				trendComponent,
			});
		}
	}

	return [...byTerm.values()].map((entry) => ({
		term: entry.term,
		displayTerm: entry.displayTerm,
		sourceType: entry.sourceType,
		trendComponent: entry.trendComponent,
		score: entry.score,
		category: entry.category,
	}));
}

/**
 * @param {typeof fetch} fetchFn
 * @param {{ convexUrl: string; convexDeployKey: string }} convexEnv
 * @param {string} path
 * @param {Record<string, unknown>} args
 * @returns {Promise<unknown>}
 */
async function postMutation(fetchFn, convexEnv, path, args) {
	const response = await fetchFn(`${normalizeConvexUrl(convexEnv.convexUrl)}/api/mutation`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Convex ${convexEnv.convexDeployKey}`,
		},
		body: JSON.stringify({ path, args, format: 'json' }),
	});

	const bodyText = await response.text().catch(() => '');
	if (!response.ok) {
		throw new Error(`Convex HTTP ${response.status}: ${bodyText.slice(0, 200)}`);
	}

	let payload;
	try {
		payload = bodyText ? JSON.parse(bodyText) : {};
	} catch {
		throw new Error('Convex mutation response was not valid JSON');
	}

	if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
		if (payload.status === 'error') {
			const message =
				typeof payload.errorMessage === 'string' ? payload.errorMessage : 'Convex mutation failed';
			throw new Error(message);
		}
		if (payload.status && payload.status !== 'success') {
			throw new Error('Convex mutation returned unexpected status');
		}
		return payload.value;
	}

	return payload;
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   fetchFn?: typeof fetch;
 * }} [opts]
 */
export async function pushKeywordCandidatesToConvex(opts = {}) {
	const env = opts.env ?? process.env;
	const payload = readDigestPushPayload(env);
	if (!payload) {
		console.error('push-keyword-candidates: missing required payload (run.date)');
		return { status: 'invalid-input', reason: 'invalid-input', exitCode: 0, upserted: 0 };
	}

	const convexEnv = await resolveConvexPushEnv(env);
	if (!convexEnv) {
		console.error('push-keyword-candidates: skipped — missing CONVEX_URL or CONVEX_DEPLOY_KEY');
		return { status: 'skipped-env', reason: 'missing-convex-env', exitCode: 0, upserted: 0 };
	}

	const candidates = extractKeywordCandidates(payload);
	const fetchFn = opts.fetchFn ?? globalThis.fetch;

	let upserted = 0;
	try {
		for (const candidate of candidates) {
			await postMutation(fetchFn, convexEnv, UPSERT_PATH, { candidate });
			upserted += 1;
		}
		return { status: 'ok', reason: 'pushed', exitCode: 0, upserted };
	} catch (err) {
		const reason =
			err && typeof err === 'object' && 'message' in err
				? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
				: 'unexpected error';
		console.error(`push-keyword-candidates: warning — ${reason}`);
		return { status: 'failed', reason, exitCode: 0, upserted };
	}
}

async function main() {
	const result = await pushKeywordCandidatesToConvex();
	console.error(
		JSON.stringify({
			keyword_candidates_push: {
				status: result.status,
				exit_code: result.exitCode,
				upserted: result.upserted,
				reason: result.reason,
			},
		}),
	);
	process.exit(0);
}

const isMain =
	import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
	process.argv[1]?.endsWith('push-keyword-candidates.mjs');

if (isMain) {
	main().catch((err) => {
		const reason =
			err && typeof err === 'object' && 'message' in err
				? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
				: 'unexpected error';
		console.error(`push-keyword-candidates: warning — ${reason}`);
		process.exit(0);
	});
}
