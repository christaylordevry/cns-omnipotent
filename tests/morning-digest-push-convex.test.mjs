import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, it } from 'node:test';

import {
	pushDigestToConvex,
	readDigestPushPayload,
	resolveConvexPushEnv,
	shortSha256Hex,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs';

/** @type {string[]} */
let tempDirs = [];

afterEach(async () => {
	await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
	tempDirs = [];
});

function basePayload({ scored = false } = {}) {
	const hackernewsSignal = scored
		? {
				section: 'hackernews',
				sourceType: 'hackernews',
				title: 'Show HN: Agent framework',
				url: 'https://news.ycombinator.com/item?id=48408186',
				score: 142,
				rank: 1,
				externalId: '48408186',
				sourceMetadata: { points: 142, commentCount: 38 },
				scores: {
					relevance: 72,
					personalRelevance: 85,
					novelty: 90,
					momentum: 55,
					urgency: 40,
				},
				disposition: 'priority',
				normalizedEngagement: 61,
				rankScore: 78,
			}
		: {
				section: 'hackernews',
				sourceType: 'hackernews',
				title: 'Show HN: Example',
				url: 'https://news.ycombinator.com/item?id=48408186',
				score: 142,
				rank: 1,
				externalId: '48408186',
				sourceMetadata: { comments: 12 },
			};

	return {
		run: {
			date: '2026-06-05',
			ranAt: 1_749_091_200_000,
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
				externalId: 'a1b2c3d4',
			},
			hackernewsSignal,
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

describe('push-digest-convex.mjs', () => {
	it('readDigestPushPayload rejects missing run.date', () => {
		assert.equal(readDigestPushPayload({ DIGEST_PUSH_JSON: '{}' }), null);
		assert.equal(readDigestPushPayload({ DIGEST_PUSH_JSON: '{"run":{}}' }), null);
		assert.equal(readDigestPushPayload({ DIGEST_PUSH_JSON: 'not-json' }), null);
	});

	it('shortSha256Hex is stable for same inputs', () => {
		const first = shortSha256Hex('AI agents', '2026-06-05');
		const second = shortSha256Hex('AI agents', '2026-06-05');
		assert.equal(first, second);
		assert.equal(first.length, 16);
	});

	it('passes reddit sourceType through to addDigestSignal unchanged', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];
		const payload = {
			run: {
				date: '2026-06-05',
				ranAt: 1_749_091_200_000,
				topTrend: 'AI agents',
				focusKeyword: 'AI agents',
			},
			signals: [
				{
					section: 'reddit',
					sourceType: 'reddit',
					title: 'Example ML post',
					url: 'https://www.reddit.com/r/MachineLearning/comments/abc123/example/',
					rank: 1,
					externalId: 'rdabcdef12345678',
					sourceMetadata: { upvotes: 420, commentCount: 37, publishedAt: '2026-06-09T08:00:00.000Z' },
				},
			],
		};

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-reddit' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.status, 'ok');
		const addCall = calls.find((call) => call.path === 'digest:addDigestSignal');
		assert.ok(addCall);
		assert.equal(addCall.args.signal.section, 'reddit');
		assert.equal(addCall.args.signal.sourceType, 'reddit');
		assert.deepEqual(addCall.args.signal.sourceMetadata, {
			upvotes: 420,
			commentCount: 37,
			publishedAt: '2026-06-09T08:00:00.000Z',
		});
	});

	it('passes rss sourceType through to addDigestSignal unchanged', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];
		const payload = {
			run: {
				date: '2026-06-05',
				ranAt: 1_749_091_200_000,
				topTrend: 'AI agents',
				focusKeyword: 'AI agents',
			},
			signals: [
				{
					section: 'rss',
					sourceType: 'rss',
					title: 'Newsletter headline',
					url: 'https://example.com/newsletter/post',
					rank: 1,
					externalId: 'rsabcdef12345678',
					sourceMetadata: { publishedAt: '2026-06-09T07:00:00.000Z', author: 'Author Name' },
				},
			],
		};

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-rss' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.status, 'ok');
		const addCall = calls.find((call) => call.path === 'digest:addDigestSignal');
		assert.ok(addCall);
		assert.equal(addCall.args.signal.section, 'rss');
		assert.equal(addCall.args.signal.sourceType, 'rss');
		assert.deepEqual(addCall.args.signal.sourceMetadata, {
			publishedAt: '2026-06-09T07:00:00.000Z',
			author: 'Author Name',
		});
	});

	it('passes github sourceType through to addDigestSignal unchanged', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];
		const payload = {
			run: {
				date: '2026-06-05',
				ranAt: 1_749_091_200_000,
				topTrend: 'AI agents',
				focusKeyword: 'AI agents',
			},
			signals: [
				{
					section: 'github',
					sourceType: 'github',
					title: 'owner/example-repo',
					url: 'https://github.com/owner/example-repo',
					rank: 1,
					externalId: 'ghabcdef12345678',
					sourceMetadata: { stars: 1234, forks: 56, publishedAt: '2026-06-01T12:00:00.000Z' },
				},
			],
		};

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-github' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.status, 'ok');
		const addCall = calls.find((call) => call.path === 'digest:addDigestSignal');
		assert.ok(addCall);
		assert.equal(addCall.args.signal.section, 'github');
		assert.equal(addCall.args.signal.sourceType, 'github');
		assert.deepEqual(addCall.args.signal.sourceMetadata, {
			stars: 1234,
			forks: 56,
			publishedAt: '2026-06-01T12:00:00.000Z',
		});
	});

	it('passes scored signal fields through to addDigestSignal unchanged', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(basePayload({ scored: true })) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-scored' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.status, 'ok');
		const addCalls = calls.filter((call) => call.path === 'digest:addDigestSignal');
		const scoredSignal = addCalls.find((call) => call.args.signal?.title === 'Show HN: Agent framework');
		assert.ok(scoredSignal, 'expected scored HN signal in addDigestSignal calls');
		assert.deepEqual(scoredSignal.args.signal.scores, {
			relevance: 72,
			personalRelevance: 85,
			novelty: 90,
			momentum: 55,
			urgency: 40,
		});
		assert.equal(scoredSignal.args.signal.disposition, 'priority');
		assert.equal(scoredSignal.args.signal.normalizedEngagement, 61);
		assert.equal(scoredSignal.args.signal.rankScore, 78);
		assert.deepEqual(scoredSignal.args.signal.sourceMetadata, {
			points: 142,
			commentCount: 38,
		});
	});

	it('preserves pre-sorted rankScore descending order in addDigestSignal mutation calls (FR-14)', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];
		const payload = {
			run: {
				date: '2026-06-05',
				ranAt: 1_749_091_200_000,
				topTrend: 'AI agents',
				focusKeyword: 'AI agents',
			},
			signals: [
				{
					section: 'hackernews',
					sourceType: 'hackernews',
					title: 'Higher rankScore signal',
					rank: 1,
					rankScore: 90,
					scores: {
						relevance: 80,
						personalRelevance: 85,
						novelty: 90,
						momentum: 70,
						urgency: 60,
					},
					disposition: 'priority',
				},
				{
					section: 'headlines',
					sourceType: 'newsapi',
					title: 'Lower rankScore signal',
					rank: 2,
					rankScore: 45,
					scores: {
						relevance: 40,
						personalRelevance: 35,
						novelty: 50,
						momentum: 35,
						urgency: 30,
					},
					disposition: 'watch',
				},
			],
		};

		await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-order' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		const addCalls = calls.filter((call) => call.path === 'digest:addDigestSignal');
		assert.equal(addCalls.length, 2);
		assert.equal(addCalls[0].args.signal.title, 'Higher rankScore signal');
		assert.equal(addCalls[1].args.signal.title, 'Lower rankScore signal');
		assert.ok(
			/** @type {number} */ (addCalls[0].args.signal.rankScore) >
				/** @type {number} */ (addCalls[1].args.signal.rankScore),
		);
	});

	it('posts create → add × N → finalize in order on happy path', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];

		const result = await pushDigestToConvex({
			env: baseEnv(),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-1' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.status, 'ok');
		assert.equal(calls.length, 4);
		assert.equal(calls[0].path, 'digest:createDigestRun');
		assert.equal(calls[0].args.run.status, 'started');
		assert.equal(calls[1].path, 'digest:addDigestSignal');
		assert.equal(calls[1].args.signal.digestRunId, 'run-id-1');
		assert.equal(calls[2].path, 'digest:addDigestSignal');
		assert.equal(calls[3].path, 'digest:finalizeDigestRun');
		assert.deepEqual(calls[3].args, { id: 'run-id-1', status: 'published' });
	});

	it('skips without fetch when Convex env is missing', async () => {
		let fetchCalled = false;
		const result = await pushDigestToConvex({
			env: baseEnv({
				CONVEX_URL: '',
				CONVEX_DEPLOY_KEY: '',
				HOME: '/tmp/nonexistent-operator-home-push-digest',
				CNS_TREND_INGEST_ENV_PATH: '/tmp/push-digest-missing-trend-ingest.env',
			}),
			fetchFn: async () => {
				fetchCalled = true;
				return mockResponse(200);
			},
		});

		assert.equal(result.status, 'skipped');
		assert.equal(fetchCalled, false);
	});

	it('returns failed with exit 0 when add mutation HTTP fails and finalizes run as failed', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];
		const result = await pushDigestToConvex({
			env: baseEnv(),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-2' }));
				}
				if (body.path === 'digest:addDigestSignal') {
					return mockResponse(500, 'mutation failed');
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.status, 'failed');
		assert.equal(result.exitCode, 0);
		assert.equal(calls.length, 3);
		assert.equal(calls[0].path, 'digest:createDigestRun');
		assert.equal(calls[1].path, 'digest:addDigestSignal');
		assert.equal(calls[2].path, 'digest:finalizeDigestRun');
		assert.deepEqual(calls[2].args, { id: 'run-id-2', status: 'failed' });
	});

	it('returns failed with exit 0 when create mutation HTTP fails', async () => {
		/** @type {string[]} */
		const paths = [];
		const result = await pushDigestToConvex({
			env: baseEnv(),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				paths.push(body.path);
				return mockResponse(500, 'create failed');
			},
		});

		assert.equal(result.status, 'failed');
		assert.equal(result.exitCode, 0);
		assert.deepEqual(paths, ['digest:createDigestRun']);
	});

	it('resolveConvexPushEnv uses mergeTrendIngestEnv via operator home trend-ingest.env', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'morning-digest-push-convex-'));
		tempDirs.push(dir);
		const hermesDir = join(dir, '.hermes');
		const { mkdir } = await import('node:fs/promises');
		await mkdir(hermesDir, { recursive: true });
		await writeFile(
			join(hermesDir, 'trend-ingest.env'),
			"CONVEX_URL=https://fallback.convex.cloud\nCONVEX_DEPLOY_KEY='key|123'\n",
		);

		const resolved = await resolveConvexPushEnv({
			HOME: dir,
		});
		assert.deepEqual(resolved, {
			convexUrl: 'https://fallback.convex.cloud',
			convexDeployKey: 'key|123',
		});
	});
});
