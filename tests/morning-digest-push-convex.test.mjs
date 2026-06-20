import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, it } from 'node:test';

import {
	countValidSignals,
	formatPushResult,
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

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 1);
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

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 1);
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

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 1);
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

	it('passes youtube sourceType through to addDigestSignal unchanged', async () => {
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
					section: 'youtube',
					sourceType: 'youtube',
					title: 'Building AI agents with MCP',
					url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
					rank: 1,
					externalId: 'ytabcdef12345678',
					sourceMetadata: {
						viewCount: 12500,
						likes: 890,
						commentCount: 142,
						author: 'Example Channel',
						publishedAt: '2026-06-18T14:30:00.000Z',
					},
				},
			],
		};

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-youtube' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 1);
		const addCall = calls.find((call) => call.path === 'digest:addDigestSignal');
		assert.ok(addCall);
		assert.equal(addCall.args.signal.section, 'youtube');
		assert.equal(addCall.args.signal.sourceType, 'youtube');
		assert.deepEqual(addCall.args.signal.sourceMetadata, {
			viewCount: 12500,
			likes: 890,
			commentCount: 142,
			author: 'Example Channel',
			publishedAt: '2026-06-18T14:30:00.000Z',
		});
	});

	it('passes tiktok and instagram sourceType through to addDigestSignal unchanged', async () => {
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
					section: 'tiktok',
					sourceType: 'tiktok',
					title: 'AI agents on TikTok',
					url: 'https://www.tiktok.com/@aitech/video/123',
					rank: 1,
					externalId: 'ttabcdef12345678',
					sourceMetadata: { viewCount: 125000, likes: 8900, commentCount: 420, author: 'aitech' },
				},
				{
					section: 'instagram',
					sourceType: 'instagram',
					title: 'AI reel demo',
					url: 'https://www.instagram.com/reel/ABC123/',
					rank: 2,
					externalId: 'igabcdef12345678',
					sourceMetadata: { viewCount: 50000, likes: 1200, commentCount: 88, author: 'aitech' },
				},
			],
		};

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-shortform' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 2);
		const addCalls = calls.filter((call) => call.path === 'digest:addDigestSignal');
		assert.equal(addCalls[0].args.signal.sourceType, 'tiktok');
		assert.equal(addCalls[1].args.signal.sourceType, 'instagram');
	});

	it('passes pinterest sourceType through to addDigestSignal unchanged', async () => {
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
					section: 'pinterest',
					sourceType: 'pinterest',
					title: 'AI agents home office setup',
					url: 'https://www.pinterest.com/pin/123456789/',
					rank: 1,
					externalId: '123456789',
					sourceMetadata: { upvotes: 4200, author: 'aitech', publishedAt: '2026-06-18T10:00:00.000Z' },
				},
			],
		};

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-pinterest' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 1);
		const addCall = calls.find((call) => call.path === 'digest:addDigestSignal');
		assert.equal(addCall?.args.signal.sourceType, 'pinterest');
		assert.equal(addCall?.args.signal.sourceMetadata.upvotes, 4200);
	});

	it('passes polymarket sourceType through to addDigestSignal unchanged', async () => {
		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];
		const payload = {
			run: {
				date: '2026-06-05',
				ranAt: 1_749_091_200_000,
				topTrend: 'AI model',
				focusKeyword: 'AI model',
			},
			signals: [
				{
					section: 'polymarket',
					sourceType: 'polymarket',
					title: 'Will Google have the best AI model at the end of June 2026?',
					url: 'https://polymarket.com/market/will-google-have-the-best-ai-model-at-the-end-of-june-2026',
					rank: 1,
					externalId: '631139',
					sourceMetadata: {
						leadingOutcome: 'No',
						leadingProbability: 0.58,
						upvotes: 300444.42,
						volumeUsd: 15988722.19,
						liquidityUsd: 70032.71,
						outcomes: ['Yes', 'No'],
						outcomePrices: [0.42, 0.58],
						publishedAt: '2026-06-30T00:00:00.000Z',
					},
				},
			],
		};

		const result = await pushDigestToConvex({
			env: baseEnv({ DIGEST_PUSH_JSON: JSON.stringify(payload) }),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-polymarket' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 1);
		const addCall = calls.find((call) => call.path === 'digest:addDigestSignal');
		assert.equal(addCall?.args.signal.sourceType, 'polymarket');
		assert.equal(addCall?.args.signal.sourceMetadata.leadingProbability, 0.58);
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

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 2);
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

		assert.equal(result.ok, true);
		assert.equal(result.signalsWritten, 2);
		assert.equal(result.exitCode, 0);
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

		assert.equal(result.ok, false);
		assert.equal(result.error, 'missing-convex-env');
		assert.equal(result.exitCode, 0);
		assert.equal(fetchCalled, false);
	});

	it('returns failed with exit 1 when add mutation HTTP fails and finalizes run as failed', async () => {
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

		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.signalsWritten, 0);
		assert.match(String(result.error), /mutation failed|Convex HTTP 500/);
		assert.equal(calls.length, 3);
		assert.equal(calls[0].path, 'digest:createDigestRun');
		assert.equal(calls[1].path, 'digest:addDigestSignal');
		assert.equal(calls[2].path, 'digest:finalizeDigestRun');
		assert.deepEqual(calls[2].args, { id: 'run-id-2', status: 'failed' });
	});

	it('returns failed with exit 1 when create mutation HTTP fails', async () => {
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

		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.signalsWritten, 0);
		assert.equal(result.runId, null);
		assert.deepEqual(paths, ['digest:createDigestRun']);
	});

	it('returns partial write with exit 1 when add fails mid-loop', async () => {
		let addCount = 0;
		const result = await pushDigestToConvex({
			env: baseEnv(),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-partial' }));
				}
				if (body.path === 'digest:addDigestSignal') {
					addCount += 1;
					if (addCount === 2) {
						return mockResponse(500, 'add failed mid-loop');
					}
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.signalsWritten, 1);
		assert.equal(result.runId, 'run-id-partial');
	});

	it('formatPushResult maps invalid input to exit 2', () => {
		const result = formatPushResult({ status: 'error', reason: 'invalid-input' });
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 2);
		assert.equal(result.error, 'invalid-input');
	});

	it('treats zero-signal push as success-with-zero (not partial-write failure)', async () => {
		assert.equal(countValidSignals([]), 0);

		const formatted = formatPushResult({
			status: 'ok',
			digestRunId: 'run-id-zero',
			signalsWritten: 0,
			expectedCount: 0,
		});
		assert.equal(formatted.ok, true);
		assert.equal(formatted.exitCode, 0);
		assert.equal(formatted.signalsWritten, 0);
		assert.equal(formatted.error, null);

		/** @type {Array<{ path: string; args: Record<string, unknown> }>} */
		const calls = [];
		const result = await pushDigestToConvex({
			env: baseEnv({
				DIGEST_PUSH_JSON: JSON.stringify({
					run: { date: '2026-06-11', ranAt: 1749000000000 },
					signals: [],
				}),
			}),
			fetchFn: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				calls.push({ path: body.path, args: body.args });
				if (body.path === 'digest:createDigestRun') {
					return mockResponse(200, JSON.stringify({ status: 'success', value: 'run-id-zero' }));
				}
				return mockResponse(200, JSON.stringify({ status: 'success', value: null }));
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		assert.equal(result.signalsWritten, 0);
		assert.equal(calls.length, 2);
		assert.equal(calls[0].path, 'digest:createDigestRun');
		assert.equal(calls[1].path, 'digest:finalizeDigestRun');
		assert.deepEqual(calls[1].args, { id: 'run-id-zero', status: 'published' });
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
