import assert from 'node:assert/strict';

import { describe, it } from 'node:test';

import {
	extractKeywordCandidates,
	pushKeywordCandidatesToConvex,
	scoreKeywordCandidate,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/push-keyword-candidates.mjs';

function basePayload() {
	return {
		run: {
			date: '2026-06-05',
			ranAt: 1_749_091_200_000,
			topTrend: 'AI agents',
		},
		signals: [
			{
				section: 'trends',
				sourceType: 'google_trends',
				title: 'AI agents',
				score: 0.87,
				rank: 1,
			},
			{
				section: 'hackernews',
				sourceType: 'hackernews',
				title: 'Show HN: Example',
				score: 142,
				rank: 1,
			},
			{
				section: 'arxiv',
				sourceType: 'arxiv',
				title: 'Attention Is All You Need',
				rank: 1,
			},
			{
				section: 'headlines',
				sourceType: 'newsapi',
				title: 'Sample headline',
				rank: 1,
			},
			{
				section: 'deep_signal',
				sourceType: 'deep_signal',
				title: 'Deep signal summary',
				rank: 1,
			},
		],
	};
}

function baseEnv(overrides = {}) {
	return {
		DIGEST_PUSH_JSON: JSON.stringify(basePayload()),
		CONVEX_URL: 'https://test.convex.cloud',
		CONVEX_DEPLOY_KEY: 'deploy-key-test',
		...overrides,
	};
}

function mockResponse(status, body = '{}') {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => body,
	};
}

describe('push-keyword-candidates.mjs', () => {
	it('extractKeywordCandidates pulls trends + HN + arxiv; skips headlines/deep_signal', () => {
		const candidates = extractKeywordCandidates(basePayload());
		const sourceTypes = candidates.map((row) => row.sourceType).sort();
		assert.deepEqual(sourceTypes, ['arxiv', 'google_trends', 'hackernews']);
		assert.ok(!candidates.some((row) => row.sourceType === 'newsapi'));
		assert.ok(!candidates.some((row) => row.sourceType === 'deep_signal'));
	});

	it('dedupes by normalized term within payload', () => {
		const payload = basePayload();
		payload.signals.push({
			section: 'trends',
			sourceType: 'google_trends',
			title: '  AI AGENTS  ',
			score: 0.5,
			rank: 2,
		});
		const candidates = extractKeywordCandidates(payload);
		const trends = candidates.filter((row) => row.sourceType === 'google_trends');
		assert.equal(trends.length, 1);
		assert.equal(trends[0].displayTerm, 'AI agents');
		assert.equal(trends[0].score, scoreKeywordCandidate({ sourceType: 'google_trends', trendComponent: 0.87 }));
	});

	it('scoreKeywordCandidate formula spot-check for google_trends vs arxiv', () => {
		const trendsScore = scoreKeywordCandidate({ sourceType: 'google_trends', trendComponent: 0.87 });
		const arxivScore = scoreKeywordCandidate({ sourceType: 'arxiv', trendComponent: 0.25 });
		assert.ok(trendsScore > arxivScore);
		assert.equal(trendsScore, 0.87 * 0.4 + 1.0 * 0.3 + 0.1 * 0.3);
		assert.equal(arxivScore, 0.25 * 0.4 + 1.0 * 0.3 + 0.1 * 0.3);
	});

	it('skips without fetch when Convex env is missing', async () => {
		let fetchCalled = false;
		const result = await pushKeywordCandidatesToConvex({
			env: baseEnv({
				CONVEX_URL: '',
				CONVEX_DEPLOY_KEY: '',
				HOME: '/tmp/nonexistent-operator-home-push-candidates',
				CNS_TREND_INGEST_ENV_PATH: '/tmp/push-candidates-missing-trend-ingest.env',
			}),
			fetchFn: async () => {
				fetchCalled = true;
				return mockResponse(200);
			},
		});

		assert.equal(result.status, 'skipped-env');
		assert.equal(result.exitCode, 0);
		assert.equal(fetchCalled, false);
	});

	it('happy path mock fetch → N upsert calls with keywordCandidates path', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];

		const result = await pushKeywordCandidatesToConvex({
			env: baseEnv(),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				return mockResponse(200, JSON.stringify({ status: 'success', value: 'candidate-id' }));
			},
		});

		assert.equal(result.status, 'ok');
		assert.equal(result.upserted, 3);
		assert.equal(calls.length, 3);
		assert.ok(calls.every((call) => call.path === 'keywordCandidates:upsertKeywordCandidate'));
		assert.ok(calls.every((call) => call.args.candidate && typeof call.args.candidate === 'object'));
		assert.ok(
			calls.every(
				(call) =>
					typeof /** @type {{ candidate: { trendComponent?: unknown } }} */ (call.args).candidate
						.trendComponent === 'number',
			),
		);
	});

	it('HTTP 500 on upsert → stderr warning path, exit 0, partial upserted count', async () => {
		let callCount = 0;
		const result = await pushKeywordCandidatesToConvex({
			env: baseEnv(),
			fetchFn: async () => {
				callCount += 1;
				if (callCount === 1) {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'candidate-id' }));
				}
				return mockResponse(500, 'mutation failed');
			},
		});

		assert.equal(result.status, 'failed');
		assert.equal(result.exitCode, 0);
		assert.equal(result.upserted, 1);
	});
});
