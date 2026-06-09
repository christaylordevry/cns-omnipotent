import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  computeSpikeSummary,
  detectBlockIndicator,
  evaluateGoNoGo,
  loadSpikeConfig,
  parseRedditListing,
  parseSubreddits,
  percentileMs,
  runRedditSpike,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const spikeScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs',
);

/** @param {number} n @param {string} [title] */
function redditListing(n, title = 'Example post') {
  return {
    data: {
      children: Array.from({ length: n }, (_, i) => ({
        data: {
          title: `${title} ${i + 1}`,
          score: 10,
          num_comments: 2,
          permalink: `/r/test/comments/abc/${i}/`,
        },
      })),
    },
  };
}

describe('parseSubreddits', () => {
  it('splits comma-separated names and trims whitespace', () => {
    assert.deepEqual(parseSubreddits(' MachineLearning , LocalLLaMA , artificial '), [
      'MachineLearning',
      'LocalLLaMA',
      'artificial',
    ]);
  });

  it('rejects empty segments', () => {
    assert.deepEqual(parseSubreddits('agents,,llm,'), ['agents', 'llm']);
    assert.deepEqual(parseSubreddits(''), []);
    assert.deepEqual(parseSubreddits(undefined), []);
  });
});

describe('parseRedditListing', () => {
  it('counts children and requires at least one titled post', () => {
    const parsed = parseRedditListing(redditListing(10));
    assert.equal(parsed.parseOk, true);
    assert.equal(parsed.postCount, 10);
  });

  it('fails when children lack titles', () => {
    const parsed = parseRedditListing({
      data: {
        children: [{ data: { title: '' } }, { data: {} }],
      },
    });
    assert.equal(parsed.parseOk, false);
    assert.equal(parsed.postCount, 2);
  });

  it('fails on invalid shape', () => {
    assert.deepEqual(parseRedditListing(null), { parseOk: false, postCount: 0 });
    assert.deepEqual(parseRedditListing({ data: {} }), { parseOk: false, postCount: 0 });
  });
});

describe('detectBlockIndicator', () => {
  it('maps HTTP 429 and 403', () => {
    assert.equal(detectBlockIndicator(429, ''), 'http-429');
    assert.equal(detectBlockIndicator(403, ''), 'http-403');
  });

  it('detects HTML and captcha markers', () => {
    assert.equal(detectBlockIndicator(200, '<!DOCTYPE html><html>'), 'html-response');
    assert.equal(detectBlockIndicator(200, '<html><body>blocked</body></html>'), 'html-response');
    assert.equal(detectBlockIndicator(200, '{"msg":"complete captcha"}'), 'captcha-marker');
    assert.equal(detectBlockIndicator(200, 'You have been blocked'), 'captcha-marker');
  });

  it('returns null on successful parse', () => {
    const parsed = parseRedditListing(redditListing(3));
    assert.equal(detectBlockIndicator(200, '{}', parsed), null);
  });

  it('returns empty-listing and parse-error for bad JSON listings', () => {
    assert.equal(
      detectBlockIndicator(200, '{}', { parseOk: false, postCount: 0 }),
      'empty-listing',
    );
    assert.equal(detectBlockIndicator(200, 'not-json', undefined, true), 'parse-error');
  });
});

describe('computeSpikeSummary', () => {
  it('computes parseSuccessRate, p95LatencyMs, and sustainedBlock', () => {
    const summary = computeSpikeSummary([
      { latencyMs: 800, parseOk: true, blockIndicator: null },
      { latencyMs: 900, parseOk: true, blockIndicator: null },
      { latencyMs: 1200, parseOk: true, blockIndicator: null },
    ]);
    assert.equal(summary.totalCycles, 3);
    assert.equal(summary.parseSuccessRate, 1);
    assert.equal(summary.p95LatencyMs, 1200);
    assert.equal(summary.sustainedBlock, false);
  });

  it('flags sustainedBlock on consecutive 429/403 cycles', () => {
    const summary = computeSpikeSummary([
      { latencyMs: 500, parseOk: false, blockIndicator: 'http-429' },
      { latencyMs: 520, parseOk: false, blockIndicator: 'http-429' },
      { latencyMs: 510, parseOk: true, blockIndicator: null },
    ]);
    assert.equal(summary.sustainedBlock, true);
    assert.equal(summary.parseSuccessRate, 1 / 3);
  });
});

describe('percentileMs', () => {
  it('returns 95th percentile as integer ms', () => {
    assert.equal(percentileMs([800, 900, 1200], 95), 1200);
  });
});

describe('evaluateGoNoGo', () => {
  it('returns PASS for healthy spike summary', () => {
    const cycles = [
      { parseOk: true, postCount: 10, blockIndicator: null },
      { parseOk: true, postCount: 10, blockIndicator: null },
      { parseOk: true, postCount: 10, blockIndicator: null },
    ];
    const summary = computeSpikeSummary(
      cycles.map((cycle, index) => ({
        latencyMs: 800 + index * 200,
        parseOk: cycle.parseOk,
        blockIndicator: cycle.blockIndicator,
      })),
    );
    assert.equal(evaluateGoNoGo(summary, cycles), 'PASS');
  });

  it('returns FAIL for sustained blocks and low parse rate', () => {
    const cycles = [
      { parseOk: false, postCount: 0, blockIndicator: 'http-429' },
      { parseOk: false, postCount: 0, blockIndicator: 'http-429' },
      { parseOk: false, postCount: 0, blockIndicator: 'http-429' },
    ];
    const summary = computeSpikeSummary(
      cycles.map(() => ({ latencyMs: 500, parseOk: false, blockIndicator: 'http-429' })),
    );
    assert.equal(evaluateGoNoGo(summary, cycles), 'FAIL');
  });

  it('returns FAIL when majority of failures are hard blocks', () => {
    const cycles = [
      { parseOk: false, postCount: 0, blockIndicator: 'html-response' },
      { parseOk: false, postCount: 0, blockIndicator: 'captcha-marker' },
      { parseOk: true, postCount: 5, blockIndicator: null },
    ];
    const summary = computeSpikeSummary(
      cycles.map((cycle, index) => ({
        latencyMs: 400 + index * 50,
        parseOk: cycle.parseOk,
        blockIndicator: cycle.blockIndicator,
      })),
    );
    assert.equal(evaluateGoNoGo(summary, cycles), 'FAIL');
  });

  it('returns PARTIAL for mixed success without sustained block', () => {
    const cycles = [
      { parseOk: true, postCount: 10, blockIndicator: null },
      { parseOk: true, postCount: 10, blockIndicator: null },
      { parseOk: false, postCount: 0, blockIndicator: 'http-403' },
    ];
    const summary = computeSpikeSummary(
      cycles.map((cycle, index) => ({
        latencyMs: 700 + index * 100,
        parseOk: cycle.parseOk,
        blockIndicator: cycle.blockIndicator,
      })),
    );
    assert.equal(evaluateGoNoGo(summary, cycles), 'PARTIAL');
  });

  it('returns PARTIAL when p95 latency exceeds 15s gate', () => {
    const cycles = [
      { parseOk: true, postCount: 10, blockIndicator: null },
      { parseOk: true, postCount: 10, blockIndicator: null },
      { parseOk: true, postCount: 10, blockIndicator: null },
    ];
    const summary = {
      totalCycles: 3,
      parseSuccessRate: 1,
      p95LatencyMs: 16_000,
      sustainedBlock: false,
    };
    assert.equal(evaluateGoNoGo(summary, cycles), 'PARTIAL');
  });
});

describe('runRedditSpike integration', () => {
  it('runs 3 mocked cycles round-robin across subreddits with delayMs 0', async () => {
    const payload = await runRedditSpike(
      {
        MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning,LocalLLaMA',
        MORNING_DIGEST_REDDIT_SPIKE_CYCLES: '3',
      },
      {
        delayMs: 0,
        fixtureJsonByCycle: {
          1: redditListing(10, 'ML'),
          2: redditListing(8, 'LLM'),
          3: redditListing(6, 'ML again'),
        },
      },
    );

    assert.equal(payload.goNoGo, 'PASS');
    assert.equal(payload.cycles?.length, 3);
    assert.equal(payload.cycles?.[0].subreddit, 'MachineLearning');
    assert.equal(payload.cycles?.[1].subreddit, 'LocalLLaMA');
    assert.equal(payload.cycles?.[2].subreddit, 'MachineLearning');
    assert.equal(payload.summary?.totalCycles, 3);
    assert.equal(payload.summary?.parseSuccessRate, 1);
  });

  it('records mixed failure fixtures across cycles', async () => {
    const payload = await runRedditSpike(
      {
        MORNING_DIGEST_REDDIT_SUBREDDITS: 'artificial',
        MORNING_DIGEST_REDDIT_SPIKE_CYCLES: '3',
      },
      {
        delayMs: 0,
        fetch: async () => ({
          status: 429,
          text: async () => 'rate limited',
        }),
      },
    );

    assert.equal(payload.goNoGo, 'FAIL');
    assert.equal(payload.cycles?.[0].blockIndicator, 'http-429');
    assert.equal(payload.summary?.sustainedBlock, true);
  });

  it('returns missing-subreddits when env unset', async () => {
    const payload = await runRedditSpike({});
    assert.deepEqual(payload, { error: 'missing-subreddits' });
  });
});

describe('loadSpikeConfig', () => {
  it('defaults cycles and delay when unset', () => {
    const config = loadSpikeConfig({
      MORNING_DIGEST_REDDIT_SUBREDDITS: 'MachineLearning',
    });
    assert.deepEqual(config.subreddits, ['MachineLearning']);
    assert.equal(config.cycles, 3);
    assert.equal(config.delayMs, 180_000);
  });
});

describe('spike-reddit-public-json.mjs CLI', () => {
  it('exits 0 with missing-subreddits error JSON', async () => {
    const { stdout } = await execFileAsync('node', [spikeScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_REDDIT_SUBREDDITS: '',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'missing-subreddits' });
  });
});
