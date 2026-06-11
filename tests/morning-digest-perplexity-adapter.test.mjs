import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  buildPerplexityQuery,
  extractAnswerText,
  loadPerplexityConfig,
  runPerplexityFetch,
  truncateAtWord,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-perplexity-signal.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-perplexity-signal.mjs',
);

const FIXTURE_RESPONSE = {
  choices: [
    {
      message: {
        role: 'assistant',
        content:
          'AI agents are accelerating enterprise automation. New orchestration frameworks ship weekly. Operators should watch MCP adoption trends.',
      },
    },
  ],
};

describe('fetch-perplexity-signal.mjs helpers', () => {
  it('truncateAtWord caps at word boundary', () => {
    const long = 'word '.repeat(400).trim();
    const out = truncateAtWord(long, 1200);
    assert.ok(out.length <= 1200);
    assert.ok(!out.endsWith('wor'));
  });

  it('buildPerplexityQuery preserves Source 3 shape', () => {
    const q = buildPerplexityQuery('ai agents');
    assert.ok(q.includes('ai agents'));
    assert.ok(q.includes('last 24 hours'));
    assert.ok(q.includes('CNS operator brief'));
  });

  it('extractAnswerText reads choices[0].message.content', () => {
    assert.equal(
      extractAnswerText(FIXTURE_RESPONSE),
      FIXTURE_RESPONSE.choices[0].message.content,
    );
  });

  it('loadPerplexityConfig reads keyword from argv not env', () => {
    const config = loadPerplexityConfig({ PERPLEXITY_API_KEY: 'test-key' }, 'ai agents');
    assert.equal(config.apiKey, 'test-key');
    assert.equal(config.keyword, 'ai agents');
  });
});

describe('fetch-perplexity-signal.mjs runPerplexityFetch', () => {
  it('returns deepSignal and topTrend capped at 1200 chars', async () => {
    const payload = await runPerplexityFetch(
      { PERPLEXITY_API_KEY: 'test-key' },
      'ai agents',
      { fixtureJson: FIXTURE_RESPONSE },
    );
    assert.equal(payload.topTrend, 'ai agents');
    assert.ok(typeof payload.deepSignal === 'string');
    assert.ok(payload.deepSignal.length <= 1200);
    assert.ok(payload.deepSignal.includes('AI agents'));
  });

  it('returns exact missing key error when api key absent', async () => {
    const payload = await runPerplexityFetch({}, 'ai agents');
    assert.deepEqual(payload, { error: 'missing PERPLEXITY_API_KEY' });
  });

  it('returns no top trend keyword when argv keyword empty', async () => {
    const payload = await runPerplexityFetch({ PERPLEXITY_API_KEY: 'test-key' }, '');
    assert.deepEqual(payload, { error: 'no top trend keyword' });
  });

  it('returns error JSON on fetch failure', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const payload = await runPerplexityFetch(
      { PERPLEXITY_API_KEY: 'test-key' },
      'ai agents',
      { fetch: failingFetch },
    );
    assert.ok(payload.error);
  });

  it('returns perplexity timeout on AbortError', async () => {
    const timeoutFetch = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    const payload = await runPerplexityFetch(
      { PERPLEXITY_API_KEY: 'test-key' },
      'ai agents',
      { fetch: timeoutFetch },
    );
    assert.deepEqual(payload, { error: 'perplexity timeout' });
  });

  it('CLI exits 0 and prints JSON on missing keyword', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: { ...process.env, PERPLEXITY_API_KEY: 'test-key' },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'no top trend keyword' });
  });

  it('CLI exits 0 with keyword arg and missing key', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript, 'ai agents'], {
      env: { ...process.env, PERPLEXITY_API_KEY: '' },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'missing PERPLEXITY_API_KEY' });
  });
});
