import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { pushDigestToConvex } from '../scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';

const execFileAsync = promisify(execFile);
const scoreScript = join(
	dirname(fileURLToPath(import.meta.url)),
	'../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs',
);

const SCORE_DIMENSION_KEYS = [
	'relevance',
	'personalRelevance',
	'novelty',
	'momentum',
	'urgency',
];

const DISPOSITION_VALUES = new Set(['priority', 'watch', 'ignore', 'escalate']);

function unscoredPayload() {
	return {
		run: {
			date: '2026-06-09',
			ranAt: Date.parse('2026-06-09T12:00:00Z'),
			topTrend: 'AI agents',
			focusKeyword: 'AI agents',
		},
		signals: [
			{
				section: 'trends',
				sourceType: 'google_trends',
				title: 'AI agents',
				score: 0.87,
				rank: 1,
				externalId: 'trend-hash-1',
			},
			{
				section: 'hackernews',
				sourceType: 'hackernews',
				title: 'Show HN: Agent framework',
				url: 'https://news.ycombinator.com/item?id=48408186',
				score: 142,
				rank: 2,
				externalId: '48408186',
				sourceMetadata: { points: 142, commentCount: 38 },
			},
		],
	};
}

function mockResponse(status, body = '{}') {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => body,
	};
}

describe('morning-digest score → push pipeline', () => {
	it('threads score CLI stdout into push payload with full scoring fields', async () => {
		const payload = unscoredPayload();
		const runAt = payload.run.ranAt;

		const { stdout } = await execFileAsync('node', [scoreScript], {
			env: {
				...process.env,
				DIGEST_SIGNALS_JSON: JSON.stringify(payload.signals),
				DIGEST_RUN_AT: String(runAt),
				HOME: join(tmpdir(), 'score-push-pipeline-missing-operator'),
				CNS_REPO_ROOT: join(tmpdir(), 'score-push-pipeline-missing-repo'),
			},
		});

		const scored_signals = JSON.parse(stdout.trim());
		assert.ok(Array.isArray(scored_signals));
		assert.ok(scored_signals.length > 0);
		payload.signals = scored_signals;

		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];

		const result = await pushDigestToConvex({
			env: {
				DIGEST_PUSH_JSON: JSON.stringify(payload),
				CONVEX_URL: 'https://test.convex.cloud',
				CONVEX_DEPLOY_KEY: 'deploy-key-test',
			},
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-pipeline' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.ok, true);

		const addCalls = calls.filter((call) => call.path === 'digest:addDigestSignal');
		const hnCall = addCalls.find((call) => call.args.signal?.title === 'Show HN: Agent framework');
		assert.ok(hnCall, 'expected HN signal in addDigestSignal calls');

		const signal = /** @type {Record<string, unknown>} */ (hnCall.args.signal);
		assert.equal(typeof signal.rank, 'number');
		assert.ok(signal.rank >= 1);
		assert.equal(typeof signal.rankScore, 'number');
		assert.ok(signal.rankScore >= 0 && signal.rankScore <= 100);
		assert.ok(DISPOSITION_VALUES.has(/** @type {string} */ (signal.disposition)));

		const scores = /** @type {Record<string, number>} */ (signal.scores);
		assert.ok(scores);
		for (const key of SCORE_DIMENSION_KEYS) {
			assert.equal(typeof scores[key], 'number', `scores.${key} must be a number`);
			assert.ok(scores[key] >= 0 && scores[key] <= 100, `scores.${key} must be 0–100`);
		}
	});
});
