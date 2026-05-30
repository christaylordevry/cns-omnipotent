import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, it } from 'node:test';

import {
  dedupeSignals,
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

describe('pick-signal-notebook.mjs helpers', () => {
  it('dedupes case-insensitively and keeps first occurrence', () => {
    assert.deepEqual(dedupeSignals(['AI Agents', 'ai agents', 'Beta']), ['AI Agents', 'Beta']);
  });

  it('truncates to 10 signals', () => {
    const many = Array.from({ length: 12 }, (_, i) => `signal-${i}`);
    assert.equal(dedupeSignals(many).length, 10);
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

  async function runPick({ signals, registryPath, env = {} }) {
    return execFileAsync('node', [pickScript, registryPath], {
      env: {
        ...process.env,
        CNS_REPO_ROOT: repoRoot,
        SIGNALS_JSON: JSON.stringify(signals),
        ...env,
      },
    });
  }

  it('emits JSON on stdout with exit 0 for ROUTED pick', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runPick({
      signals: ['CNS vault architecture'],
      registryPath,
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'cns-watch-1');
    assert.equal(payload.winning_signal, 'CNS vault architecture');
    assert.equal(typeof payload.elapsed_ms, 'number');
  });

  it('supports legacy argv signals with registry path as second argument', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const baseEnv = { ...process.env };
    delete baseEnv.SIGNALS_JSON;
    const { stdout } = await execFileAsync(
      'node',
      [pickScript, JSON.stringify(['CNS vault architecture']), registryPath],
      {
        env: {
          ...baseEnv,
          CNS_REPO_ROOT: repoRoot,
        },
      },
    );
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'cns-watch-1');
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
});
