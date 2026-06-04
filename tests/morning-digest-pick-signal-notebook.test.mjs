import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, it } from 'node:test';

import {
  rankAllMatches,
  tokenizeForScoring,
} from '../scripts/session-close/lib/notebook-scorer.mjs';
import {
  buildDigestSignals,
  dedupeSignals,
  extractPerplexitySignals,
  pickSignalNotebook,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pickScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs',
);

const watchRegistry = [
  { id: 'cns-watch-1', title: 'CNS Vault Architecture', watch: true, domain: 'cns-brain', last_updated: null },
  { id: 'ai-watch-1', title: 'AI Factory Blueprint', watch: true, domain: 'ai-factory', last_updated: null },
];

const mixedRegistry = [
  ...watchRegistry,
  { id: 'unwatch-1', title: 'LinkedIn Strategy 2026', watch: false, domain: 'linkedin', last_updated: null },
];

const tieRegistry = [
  { id: 'nb-z', title: 'Zulu Topic Notebook', watch: true, domain: 'zulu', last_updated: null },
  { id: 'nb-a', title: 'Alpha Topic Notebook', watch: true, domain: 'alpha', last_updated: null },
];

const multiSourceFixture = {
  trends: [{ keyword: 'weekly tech roundup', normalizedValue: 0.9 }],
  headlines: [{ title: 'Enterprise AI agents reshape AI Factory Blueprint automation' }],
  perplexityText:
    'AI agent orchestration platforms saw major releases for AI Factory Blueprint operators this week.',
};

describe('pick-signal-notebook.mjs helpers', () => {
  it('dedupes case-insensitively and keeps first occurrence', () => {
    assert.deepEqual(dedupeSignals(['AI Agents', 'ai agents', 'Beta']), ['AI Agents', 'Beta']);
  });

  it('truncates to 10 signals', () => {
    const many = Array.from({ length: 12 }, (_, i) => `signal-${i}`);
    assert.equal(dedupeSignals(many).length, 10);
  });
});

describe('buildDigestSignals', () => {
  it('orders trends by normalizedValue desc then headlines then perplexity', () => {
    const signals = buildDigestSignals({
      trends: [
        { keyword: 'low', normalizedValue: 0.1 },
        { keyword: 'high', normalizedValue: 0.9 },
      ],
      headlines: [{ title: 'Headline A' }],
      perplexityText: 'Vault architecture roadmap for CNS operators.',
    });
    assert.deepEqual(signals.slice(0, 3), [
      'high',
      'low',
      'Headline A',
    ]);
    assert.ok(signals.some((s) => s.includes('Vault architecture')));
  });

  it('dedupes case-insensitively keeping trend before headline', () => {
    const signals = buildDigestSignals({
      trends: [{ keyword: 'AI Agents', normalizedValue: 1 }],
      headlines: [{ title: 'Breaking: AI agents in enterprise' }],
    });
    assert.equal(signals.filter((s) => s.toLowerCase() === 'ai agents').length, 1);
    assert.equal(signals[0], 'AI Agents');
  });

  it('caps combined output at 10 signals', () => {
    const signals = buildDigestSignals({
      trends: Array.from({ length: 8 }, (_, i) => ({
        keyword: `trend-${i}`,
        normalizedValue: 1 - i * 0.01,
      })),
      headlines: Array.from({ length: 8 }, (_, i) => ({ title: `headline-${i}` })),
      perplexityText: 'One. Two. Three. Four. Five.',
    });
    assert.equal(signals.length, 10);
  });

  it('skips failed or empty sources without throwing', () => {
    assert.deepEqual(buildDigestSignals({}), []);
    assert.deepEqual(
      buildDigestSignals({ trends: [{ keyword: '' }], headlines: null, perplexityText: '   ' }),
      [],
    );
  });
});

describe('extractPerplexitySignals', () => {
  it('returns empty for blank or whitespace-only text', () => {
    assert.deepEqual(extractPerplexitySignals(''), []);
    assert.deepEqual(extractPerplexitySignals('   \n\t  '), []);
  });

  it('splits on sentence boundaries up to three segments', () => {
    const signals = extractPerplexitySignals(
      'AI agent orchestration update. Vault architecture changes. Stopword only the.',
    );
    assert.ok(signals.length >= 2);
    assert.ok(signals[0].includes('orchestration'));
    assert.ok(signals.some((s) => s.includes('Vault architecture')));
  });

  it('filters stopword-only segments', () => {
    const signals = extractPerplexitySignals('the and for. Real CNS vault architecture news.');
    assert.ok(signals.every((s) => tokenizeForScoring(s).length > 0));
    assert.ok(signals.some((s) => s.includes('vault architecture')));
  });
});

describe('pick-signal-notebook routing', () => {
  it('routes CNS vault architecture to cns-watch-1', () => {
    const result = pickSignalNotebook(['CNS vault architecture'], watchRegistry);
    assert.equal(result.route.status, 'ROUTED');
    assert.equal(result.route.id, 'cns-watch-1');
    assert.equal(result.winning_signal, 'CNS vault architecture');
    assert.ok(result.winning_score >= 0.75);
  });

  it('returns NO_ROUTE for unrelated topic', () => {
    const result = pickSignalNotebook(['unrelated xyz topic'], watchRegistry);
    assert.equal(result.route.status, 'NO_ROUTE');
    assert.equal(result.winning_signal, null);
    assert.equal(result.winning_score, null);
  });

  it('prefers earlier signal when scores tie across notebooks', () => {
    const result = pickSignalNotebook(['alpha topic notebook', 'zulu topic notebook'], tieRegistry);
    assert.equal(result.route.status, 'ROUTED');
    assert.equal(result.winning_signal, 'alpha topic notebook');
    assert.equal(result.route.id, 'nb-a');
  });

  it('prefers higher score even when later in the list', () => {
    const result = pickSignalNotebook(['unrelated xyz topic', 'CNS vault architecture'], watchRegistry);
    assert.equal(result.route.status, 'ROUTED');
    assert.equal(result.winning_signal, 'CNS vault architecture');
    assert.equal(result.route.id, 'cns-watch-1');
  });

  it('deduped duplicate signals match single-signal routing', () => {
    const single = pickSignalNotebook(['AI Factory Blueprint'], watchRegistry);
    const deduped = pickSignalNotebook(['AI Factory Blueprint', 'ai factory blueprint'], watchRegistry);
    assert.equal(deduped.route.status, single.route.status);
    assert.equal(deduped.route.id, single.route.id);
    assert.equal(deduped.winning_signal, single.winning_signal);
  });

  it('returns NO_ROUTE for empty signal list', () => {
    const result = pickSignalNotebook([], watchRegistry);
    assert.equal(result.route.status, 'NO_ROUTE');
  });

  it('excludes unwatched notebooks (linkedin)', () => {
    const result = pickSignalNotebook(['linkedin strategy posts'], mixedRegistry);
    assert.equal(result.route.status, 'NO_ROUTE');
  });

  it('soft-routes trend signal with partial overlap (score >= 0.20, < 0.75)', () => {
    const result = pickSignalNotebook(['ai agent orchestration'], watchRegistry);
    assert.equal(result.route.status, 'ROUTED');
    assert.equal(result.route.id, 'ai-watch-1');
    assert.equal(result.route.reason, 'soft_match');
    assert.equal(result.winning_signal, 'ai agent orchestration');
    assert.ok(result.winning_score >= 0.2);
    assert.ok(result.winning_score < 0.75);
  });

  it('hard-route signal keeps disambiguator reason (not soft_match)', () => {
    const result = pickSignalNotebook(['CNS vault architecture'], watchRegistry);
    assert.equal(result.route.status, 'ROUTED');
    assert.equal(result.route.id, 'cns-watch-1');
    assert.notEqual(result.route.reason, 'soft_match');
    assert.ok(result.winning_score >= 0.75);
  });

  it('multi-source fixture ROUTED with winning_score >= 0.20', () => {
    const signals = buildDigestSignals(multiSourceFixture);
    const result = pickSignalNotebook(signals, watchRegistry);
    assert.equal(result.route.status, 'ROUTED');
    assert.equal(result.route.id, 'ai-watch-1');
    assert.ok(result.winning_score >= 0.2);
    assert.ok(result.winning_score < 0.75);
  });

  it('headline signal routes when trend-only does not in same fixture', () => {
    const trendOnly = pickSignalNotebook(
      buildDigestSignals({ trends: multiSourceFixture.trends }),
      watchRegistry,
    );
    assert.equal(trendOnly.route.status, 'NO_ROUTE');

    const headlineOnly = pickSignalNotebook(
      buildDigestSignals({ headlines: multiSourceFixture.headlines }),
      watchRegistry,
    );
    assert.equal(headlineOnly.route.status, 'ROUTED');
    assert.equal(headlineOnly.route.id, 'ai-watch-1');
    assert.ok(headlineOnly.winning_score >= 0.2);
  });

  it('perplexity-only signal can route to cns-watch-1', () => {
    const signals = buildDigestSignals({
      perplexityText: 'Major updates to CNS vault architecture for operators.',
    });
    const result = pickSignalNotebook(signals, watchRegistry);
    assert.equal(result.route.status, 'ROUTED');
    assert.equal(result.route.id, 'cns-watch-1');
    assert.ok(result.winning_score >= 0.2);
  });

  it('exact duplicate trend keyword in headline is deduped before scoring', () => {
    const signals = buildDigestSignals({
      trends: [{ keyword: 'AI Factory Blueprint', normalizedValue: 1 }],
      headlines: [{ title: 'ai factory blueprint' }],
    });
    assert.equal(signals.length, 1);
    const matches = rankAllMatches(signals[0], watchRegistry);
    assert.ok(matches.some((m) => m.id === 'ai-watch-1' && m.score >= 0.2));
  });
});

describe('pick-signal-notebook.mjs CLI', () => {
  /** @type {string[]} */
  let tempDirs = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
  });

  async function writeRegistry(entries) {
    const dir = await mkdtemp(join(tmpdir(), 'morning-digest-pick-'));
    tempDirs.push(dir);
    const registryPath = join(dir, 'registry.json');
    await writeFile(registryPath, JSON.stringify(entries));
    return registryPath;
  }

  async function runPick({ signals, registryPath, env = {}, digestSources }) {
    const baseEnv = {
      ...process.env,
      CNS_REPO_ROOT: repoRoot,
      ...env,
    };
    const debugLogPath = '/tmp/debug-pick-signal-test-env.log';
    if (digestSources !== undefined) {
      baseEnv.DIGEST_SOURCES_JSON = JSON.stringify(digestSources);
      delete baseEnv.SIGNALS_JSON;
    } else {
      baseEnv.SIGNALS_JSON = JSON.stringify(signals);
    }
    return execFileAsync('node', [pickScript, registryPath], { env: baseEnv });
  }

  it('emits JSON on stdout with soft_match for partial trend signal', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runPick({
      signals: ['ai agent orchestration'],
      registryPath,
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'ai-watch-1');
    assert.equal(payload.route.reason, 'soft_match');
    assert.equal(payload.winning_signal, 'ai agent orchestration');
  });

  it('emits JSON on stdout with exit 0 for ROUTED pick', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runPick({
      signals: ['CNS vault architecture'],
      registryPath,
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'cns-watch-1');
    assert.equal(payload.route.domain, 'cns-brain');
    assert.equal(payload.winning_signal, 'CNS vault architecture');
    assert.equal(typeof payload.elapsed_ms, 'number');
  });

  it('emits empty route.domain when registry entry omits domain (Story 52-2)', async () => {
    const noDomainRegistry = [
      { id: 'cns-watch-1', title: 'CNS Vault Architecture', watch: true, last_updated: null },
    ];
    const registryPath = await writeRegistry(noDomainRegistry);
    const { stdout } = await runPick({
      signals: ['CNS vault architecture'],
      registryPath,
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'cns-watch-1');
    assert.equal(payload.route.domain, '');
  });

  it('supports legacy argv signals with registry path as second argument', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const baseEnv = { ...process.env };
    delete baseEnv.SIGNALS_JSON;
    const { stdout } = await execFileAsync(
      'node',
      [pickScript, JSON.stringify(['CNS vault architecture'])],
      {
        env: {
          ...baseEnv,
          CNS_REPO_ROOT: repoRoot,
          CNS_NOTEBOOK_REGISTRY_PATH: registryPath, // Added for debug
        },
      },
    );
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'cns-watch-1');
    assert.equal(payload.route.domain, 'cns-brain');
  });

  it('exit 2 when registry file is missing', async () => {
    const registryPath = join(tmpdir(), 'missing-registry.json');
    await assert.rejects(
      () => runPick({ signals: ['vault'], registryPath }),
      (err) => {
        assert.equal(err.code, 2);
        return true;
      },
    );
  });

  it('emits ROUTED pick via DIGEST_SOURCES_JSON env', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runPick({
      signals: [],
      digestSources: multiSourceFixture,
      registryPath,
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'ai-watch-1');
    assert.ok(payload.winning_score >= 0.2);
  });

  it('prefers DIGEST_SOURCES_JSON over SIGNALS_JSON when both set', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runPick({
      signals: ['unrelated xyz topic'],
      digestSources: multiSourceFixture,
      registryPath,
      env: { SIGNALS_JSON: JSON.stringify(['unrelated xyz topic']) },
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'ai-watch-1');
  });

  it('falls back to SIGNALS_JSON when DIGEST_SOURCES_JSON is empty', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runPick({
      signals: ['ai agent orchestration'],
      registryPath,
      env: {
        DIGEST_SOURCES_JSON: '',
        SIGNALS_JSON: JSON.stringify(['ai agent orchestration']),
      },
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'ai-watch-1');
    assert.ok(payload.winning_score >= 0.2);
    assert.ok(payload.winning_score < 0.75);
  });
});
