import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { promisify } from 'node:util';
import { afterEach, describe, it } from 'node:test';

import { scoreNotebooks } from '../scripts/session-close/lib/notebook-scorer.mjs';
import { disambiguateRoute } from '../scripts/session-close/lib/notebook-disambiguate.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const resolverScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs',
);
const queryScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/notebook-query/scripts/query-notebook.mjs',
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const watchRegistry = [
  { id: 'cns-watch-1', title: 'CNS Vault Architecture', watch: true, domain: 'cns-brain', last_updated: null },
  { id: 'ai-watch-1', title: 'AI Factory Blueprint', watch: true, domain: 'ai-factory', last_updated: null },
];

const mixedRegistry = [
  ...watchRegistry,
  { id: 'unwatch-1', title: 'LinkedIn Strategy 2026', watch: false, domain: 'linkedin', last_updated: null },
];

// ---------------------------------------------------------------------------
// Helper under test — mirrors the resolver helper pipeline
// ---------------------------------------------------------------------------

function resolveForQuestion(question, registry) {
  const watched = registry.filter((e) => e && e.watch === true);
  const scoreResult = scoreNotebooks(question, watched);
  return disambiguateRoute(scoreResult, watched);
}

async function runResolver({ question, registryPath, env = {} }) {
  return execFileAsync('node', [resolverScript, '', registryPath], {
    env: {
      ...process.env,
      CNS_REPO_ROOT: repoRoot,
      NOTEBOOK_QUERY: question,
      ...env,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notebook-query routing pipeline', () => {
  it('TC-1: strong title match routes to cns-watch-1', () => {
    const route = resolveForQuestion('CNS vault architecture', watchRegistry);
    assert.equal(route.status, 'ROUTED');
    assert.equal(route.id, 'cns-watch-1');
  });

  it('TC-1b: natural-language title question routes to cns-watch-1', () => {
    const route = resolveForQuestion('what is the CNS vault architecture?', watchRegistry);
    assert.equal(route.status, 'ROUTED');
    assert.equal(route.id, 'cns-watch-1');
  });

  it('TC-2: domain keyword match routes to cns-watch-1', () => {
    const route = resolveForQuestion('pake brain vault', watchRegistry);
    assert.equal(route.status, 'ROUTED');
    assert.equal(route.id, 'cns-watch-1');
  });

  it('TC-3: no keyword overlap returns NO_ROUTE', () => {
    const route = resolveForQuestion('linkedin strategy posts', watchRegistry);
    assert.equal(route.status, 'NO_ROUTE');
  });

  it('TC-4: unwatch-flagged entry is excluded from mixedRegistry', () => {
    const route = resolveForQuestion('linkedin strategy', mixedRegistry);
    assert.equal(route.status, 'NO_ROUTE');
  });

  it('TC-5: empty watched registry always returns NO_ROUTE', () => {
    const route = resolveForQuestion('vault architecture', []);
    assert.equal(route.status, 'NO_ROUTE');
  });

  it('TC-6: watch filter via mixedRegistry excludes unwatch entry', () => {
    const route = resolveForQuestion('linkedin', mixedRegistry);
    assert.equal(route.status, 'NO_ROUTE');
  });

  it('TC-7: short tokens only (<2 chars not in lexicon) returns NO_ROUTE', () => {
    const route = resolveForQuestion('is it ok', watchRegistry);
    assert.equal(route.status, 'NO_ROUTE');
  });

  it('TC-8: tied scores resolve via disambiguator top-ranked (first match wins)', () => {
    const tiedResult = {
      status: 'OK',
      matches: [
        { id: 'ai-watch-1', title: 'AI Factory Blueprint', score: 0.85 },
        { id: 'cns-watch-1', title: 'CNS Vault Architecture', score: 0.85 },
      ],
    };
    const route = disambiguateRoute(tiedResult, watchRegistry);
    assert.equal(route.status, 'ROUTED');
    assert.equal(route.reason, 'top-ranked');
    assert.equal(route.id, 'ai-watch-1');
  });

  it('disambiguateRoute OK with empty matches returns NO_ROUTE', () => {
    const route = disambiguateRoute({ status: 'OK', matches: [] }, watchRegistry);
    assert.equal(route.status, 'NO_ROUTE');
  });
});

describe('resolveForQuestion watch filter isolation', () => {
  it('unwatch entries in mixedRegistry do not affect routing for watched topics', () => {
    const route = resolveForQuestion('CNS vault architecture', mixedRegistry);
    assert.equal(route.status, 'ROUTED');
    assert.equal(route.id, 'cns-watch-1');
  });

  it('returns NO_ROUTE for empty question', () => {
    const route = resolveForQuestion('', watchRegistry);
    assert.equal(route.status, 'NO_ROUTE');
  });

  it('returns NO_ROUTE for whitespace-only question', () => {
    const route = resolveForQuestion('   ', watchRegistry);
    assert.equal(route.status, 'NO_ROUTE');
  });
});

describe('resolve-notebook.mjs CLI', () => {
  /** @type {string[]} */
  let tempDirs = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
  });

  async function writeRegistry(entries) {
    const dir = await mkdtemp(join(tmpdir(), 'notebook-query-'));
    tempDirs.push(dir);
    const registryPath = join(dir, 'registry.json');
    await writeFile(registryPath, JSON.stringify(entries));
    return registryPath;
  }

  it('emits JSON on stdout with exit 0 for a valid registry', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runResolver({
      question: 'what is the CNS vault architecture?',
      registryPath,
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'cns-watch-1');
    assert.equal(typeof payload.elapsed_ms, 'number');
  });

  it('exit 2 when registry file is missing', async () => {
    const registryPath = join(tmpdir(), 'nonexistent-registry.json');
    await assert.rejects(
      () => runResolver({ question: 'vault', registryPath }),
      (err) => {
        assert.equal(err.code, 2);
        return true;
      },
    );
  });

  it('exit 2 when registry JSON is not an array', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'notebook-query-'));
    tempDirs.push(dir);
    const registryPath = join(dir, 'registry.json');
    await writeFile(registryPath, '{}');
    await assert.rejects(
      () => runResolver({ question: 'vault', registryPath }),
      (err) => {
        assert.equal(err.code, 2);
        return true;
      },
    );
  });

  it('reads question from NOTEBOOK_QUERY env (not argv)', async () => {
    const registryPath = await writeRegistry(watchRegistry);
    const { stdout } = await runResolver({
      question: 'pake brain vault',
      registryPath,
    });
    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.route.status, 'ROUTED');
    assert.equal(payload.route.id, 'cns-watch-1');
  });
});

describe('query-notebook.mjs CLI', () => {
  /** @type {string[]} */
  let tempDirs = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
  });

  async function writeMockNlm(source) {
    const dir = await mkdtemp(join(tmpdir(), 'notebook-query-nlm-'));
    tempDirs.push(dir);
    const path = join(dir, 'nlm');
    await writeFile(path, source, { mode: 0o755 });
    await chmod(path, 0o755);
    return path;
  }

  async function runQuery({ args = [], env = {} }) {
    return execFileAsync('node', [queryScript, ...args], {
      env: {
        ...process.env,
        NOTEBOOK_NLM_BIN: env.NOTEBOOK_NLM_BIN,
        NOTEBOOK_ID: env.NOTEBOOK_ID,
        NOTEBOOK_QUERY: env.NOTEBOOK_QUERY,
        NOTEBOOK_REMAINING_S: env.NOTEBOOK_REMAINING_S,
      },
    });
  }

  it('queries nlm and emits answer JSON from env inputs', async () => {
    const mockNlm = await writeMockNlm(`#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] !== 'query' || args[1] !== 'notebook') process.exit(9);
if (!args.includes('--json') || !args.includes('--timeout')) process.exit(8);
process.stdout.write(JSON.stringify({ answer: 'CNS uses a vault-based control plane.' }));
`);

    const { stdout } = await runQuery({
      env: {
        NOTEBOOK_NLM_BIN: mockNlm,
        NOTEBOOK_ID: '981466f0-de1c-4551-93a9-f3bc2a24b184',
        NOTEBOOK_QUERY: 'what is the CNS vault architecture?',
        NOTEBOOK_REMAINING_S: '7',
      },
    });

    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.answer, 'CNS uses a vault-based control plane.');
    assert.equal(typeof payload.elapsed_ms, 'number');
  });

  it('accepts notebook-id first argv form used by the task prompt', async () => {
    const mockNlm = await writeMockNlm(`#!/usr/bin/env node
const args = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  answer: args[2] === '981466f0-de1c-4551-93a9-f3bc2a24b184' && args[3] === 'question text' ? 'ok' : ''
}));
`);

    const { stdout } = await runQuery({
      args: ['981466f0-de1c-4551-93a9-f3bc2a24b184', 'question text'],
      env: { NOTEBOOK_NLM_BIN: mockNlm },
    });

    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.answer, 'ok');
  });

  it('accepts question first argv form documented by the script usage', async () => {
    const mockNlm = await writeMockNlm(`#!/usr/bin/env node
const args = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  response: args[2] === '981466f0-de1c-4551-93a9-f3bc2a24b184' && args[3] === 'question text' ? 'ok' : ''
}));
`);

    const { stdout } = await runQuery({
      args: ['question text', '981466f0-de1c-4551-93a9-f3bc2a24b184'],
      env: { NOTEBOOK_NLM_BIN: mockNlm },
    });

    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.answer, 'ok');
  });

  it('extracts answer from nlm value.answer JSON shape', async () => {
    const mockNlm = await writeMockNlm(`#!/usr/bin/env node
process.stdout.write(JSON.stringify({ value: { answer: 'nested ok' } }));
`);

    const { stdout } = await runQuery({
      args: ['981466f0-de1c-4551-93a9-f3bc2a24b184', 'question text'],
      env: { NOTEBOOK_NLM_BIN: mockNlm },
    });

    const payload = JSON.parse(stdout.trim());
    assert.equal(payload.answer, 'nested ok');
  });

  it('exits 1 when nlm fails', async () => {
    const mockNlm = await writeMockNlm(`#!/usr/bin/env node
console.error('notebooklm exploded');
process.exit(3);
`);

    await assert.rejects(
      () => runQuery({
        env: {
          NOTEBOOK_NLM_BIN: mockNlm,
          NOTEBOOK_ID: '981466f0-de1c-4551-93a9-f3bc2a24b184',
          NOTEBOOK_QUERY: 'question',
        },
      }),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /notebooklm exploded/);
        return true;
      },
    );
  });
});
