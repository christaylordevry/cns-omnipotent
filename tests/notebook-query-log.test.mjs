import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, it } from 'node:test';

import {
	logNotebookQueryToConvex,
	parseKeyValueEnv,
	readLogPayload,
	resolveConvexPushEnv,
} from '../scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs';

/** @type {string[]} */
let tempDirs = [];

afterEach(async () => {
	await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
	tempDirs = [];
});

function baseEnv(overrides = {}) {
	return {
		NOTEBOOK_QUERY: 'What are PAKE rules?',
		NOTEBOOK_ANSWER: 'PAKE requires valid frontmatter.',
		NOTEBOOK_ID: 'cns-watch-1',
		NOTEBOOK_TITLE: 'CNS Vault Architecture',
		NOTEBOOK_DOMAIN: 'cns-brain',
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

describe('log-notebook-query.mjs', () => {
	it('posts mutation with correct path and args when fetch succeeds', async () => {
		/** @type {unknown} */
		let capturedBody = null;

		const result = await logNotebookQueryToConvex({
			env: baseEnv(),
			fetchFn: async (_url, init) => {
				capturedBody = JSON.parse(String(init?.body));
				return mockResponse(200);
			},
		});

		assert.equal(result.status, 'ok');
		assert.deepEqual(capturedBody, {
			path: 'notebookQueries:logNotebookQuery',
			args: {
				entry: {
					question: 'What are PAKE rules?',
					answer: 'PAKE requires valid frontmatter.',
					notebookId: 'cns-watch-1',
					notebookTitle: 'CNS Vault Architecture',
					domain: 'cns-brain',
				},
			},
			format: 'json',
		});
	});

	it('skips without fetch when Convex env is missing', async () => {
		let fetchCalled = false;
		const result = await logNotebookQueryToConvex({
			env: baseEnv({
				CONVEX_URL: '',
				CONVEX_DEPLOY_KEY: '',
				CNS_TREND_INGEST_ENV_PATH: '/tmp/notebook-query-log-missing-trend-ingest.env',
			}),
			fetchFn: async () => {
				fetchCalled = true;
				return mockResponse(200);
			},
		});

		assert.equal(result.status, 'skipped');
		assert.equal(fetchCalled, false);
	});

	it('returns error when NOTEBOOK_ANSWER is missing', async () => {
		const payload = readLogPayload(baseEnv({ NOTEBOOK_ANSWER: '' }));
		assert.equal(payload, null);

		const result = await logNotebookQueryToConvex({
			env: baseEnv({ NOTEBOOK_ANSWER: '   ' }),
			fetchFn: async () => mockResponse(200),
		});
		assert.equal(result.status, 'error');
	});

	it('passes full answer in payload (Convex truncates at insert)', async () => {
		const longAnswer = 'x'.repeat(5000);
		/** @type {unknown} */
		let capturedBody = null;

		await logNotebookQueryToConvex({
			env: baseEnv({ NOTEBOOK_ANSWER: longAnswer }),
			fetchFn: async (_url, init) => {
				capturedBody = JSON.parse(String(init?.body));
				return mockResponse(200);
			},
		});

		assert.equal(
			/** @type {{ args: { entry: { answer: string } } }} */ (capturedBody).args.entry.answer.length,
			5000,
		);
	});

	it('returns error when fetch returns HTTP 500', async () => {
		const result = await logNotebookQueryToConvex({
			env: baseEnv(),
			fetchFn: async () => mockResponse(500, 'fail'),
		});
		assert.equal(result.status, 'error');
	});

	it('resolveConvexPushEnv falls back to trend-ingest env file', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'notebook-query-log-'));
		tempDirs.push(dir);
		const envPath = join(dir, 'trend-ingest.env');
		await writeFile(
			envPath,
			"export CONVEX_URL=https://fallback.convex.cloud\nCONVEX_DEPLOY_KEY='key|123'\n",
		);

		const resolved = await resolveConvexPushEnv({
			CNS_TREND_INGEST_ENV_PATH: envPath,
		});
		assert.deepEqual(resolved, {
			convexUrl: 'https://fallback.convex.cloud',
			convexDeployKey: 'key|123',
		});
	});

	it('parseKeyValueEnv supports export and quoted values', () => {
		assert.deepEqual(
			parseKeyValueEnv("export CONVEX_URL=https://x.convex.cloud\nCONVEX_DEPLOY_KEY='a|b'\n"),
			{
				CONVEX_URL: 'https://x.convex.cloud',
				CONVEX_DEPLOY_KEY: 'a|b',
			},
		);
	});
});
