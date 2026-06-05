import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  extractSnippetFromDescription,
  inferOperatorHomeFromHome,
  isValidArxivCategory,
  loadArxivConfig,
  mergeTrendIngestEnv,
  parseArxivRss,
  resolveOperatorHome,
  runArxivFetch,
  trimSnippet,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs',
);

const FIXTURE_RSS = `<?xml version="1.0"?>
<rss><channel>
<item>
<title>Paper One Title</title>
<link>https://arxiv.org/abs/2401.00001</link>
<description>arXiv:2401.00001 Announce Type: new Abstract: This is the first abstract with enough words to test trimming behavior across multiple tokens in the snippet field for morning digest.</description>
<pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
</item>
<item>
<title>Paper Two Title</title>
<link>https://arxiv.org/abs/2401.00002</link>
<description>arXiv:2401.00002 without abstract prefix</description>
<pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
</item>
</channel></rss>`;

describe('fetch-arxiv-rss.mjs parsing', () => {
  it('parses fixture RSS into titles, snippets, and links', () => {
    const papers = parseArxivRss(FIXTURE_RSS, 'cs.AI', 5);
    assert.equal(papers.length, 2);
    assert.equal(papers[0].category, 'cs.AI');
    assert.equal(papers[0].title, 'Paper One Title');
    assert.equal(papers[0].link, 'https://arxiv.org/abs/2401.00001');
    assert.ok(papers[0].snippet.includes('first abstract'));
    assert.equal(papers[1].title, 'Paper Two Title');
    assert.equal(papers[1].snippet, '');
  });

  it('returns empty snippet when Abstract: is missing', () => {
    assert.equal(extractSnippetFromDescription('no abstract here'), '');
  });

  it('trimSnippet is word-safe under 200 chars', () => {
    const long = 'word '.repeat(80);
    const out = trimSnippet(long, 200);
    assert.ok(out.length <= 200);
    assert.ok(!out.endsWith('wor'));
  });

  it('rejects invalid category codes', () => {
    assert.equal(isValidArxivCategory('cs.AI'), true);
    assert.equal(isValidArxivCategory('bad;injection'), false);
  });
});

describe('fetch-arxiv-rss.mjs runArxivFetch', () => {
  it('returns papers from fixture without network', async () => {
    const payload = await runArxivFetch(
      {
        MORNING_DIGEST_ARXIV_CATEGORIES: 'cs.AI',
        MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY: '2',
      },
      { fixtureXml: FIXTURE_RSS },
    );
    assert.ok(Array.isArray(payload.papers));
    assert.equal(payload.papers.length, 2);
  });

  it('returns empty papers when categories unset', async () => {
    const payload = await runArxivFetch({});
    assert.deepEqual(payload, { papers: [] });
  });

  it('returns arxiv disabled when enabled flag is false', async () => {
    const payload = await runArxivFetch({
      MORNING_DIGEST_ARXIV_ENABLED: 'false',
      MORNING_DIGEST_ARXIV_CATEGORIES: 'cs.AI',
    });
    assert.deepEqual(payload, { error: 'arxiv disabled' });
  });

  it('returns invalid category error for bad env', async () => {
    const payload = await runArxivFetch({
      MORNING_DIGEST_ARXIV_CATEGORIES: 'not valid!',
    });
    assert.deepEqual(payload, { error: 'invalid category' });
  });

  it('returns error JSON on fetch failure', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const payload = await runArxivFetch(
      { MORNING_DIGEST_ARXIV_CATEGORIES: 'cs.AI' },
      { fetch: failingFetch },
    );
    assert.ok(payload.error);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_ARXIV_CATEGORIES: 'not valid!',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'invalid category' });
  });
});

describe('resolveOperatorHome (Hermes HOME isolation)', () => {
  it('infers real operator home from Hermes profile HOME', () => {
    assert.equal(
      inferOperatorHomeFromHome('/home/christ/.hermes/home'),
      '/home/christ',
    );
    assert.equal(
      inferOperatorHomeFromHome('/home/christ/.hermes/home/sub/dir'),
      '/home/christ',
    );
  });

  it('returns null for a normal (non-isolated) HOME', () => {
    assert.equal(inferOperatorHomeFromHome('/home/christ'), null);
  });

  it('remaps a Hermes-isolated HOME back to the operator home', async () => {
    const resolved = await resolveOperatorHome({
      HOME: '/home/christ/.hermes/home',
      USER: 'christ',
    });
    assert.equal(resolved, '/home/christ');
  });

  it('leaves a normal HOME untouched', async () => {
    const resolved = await resolveOperatorHome({ HOME: '/home/christ' });
    assert.equal(resolved, '/home/christ');
  });
});

describe('mergeTrendIngestEnv under simulated Hermes HOME isolation', () => {
  it('reads the real trend-ingest.env when HOME is profile-isolated', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'cns-merge-env-'));
    try {
      // Real operator home: <tmpRoot>/.hermes/trend-ingest.env
      await mkdir(join(tmpRoot, '.hermes'), { recursive: true });
      await writeFile(
        join(tmpRoot, '.hermes', 'trend-ingest.env'),
        [
          '# comment line',
          'NEWSAPI_API_KEY=news-secret',
          'PERPLEXITY_API_KEY="perp-secret"',
          'NOTEBOOKLM_NOTEBOOK_TITLES=nb1:Title One,nb2:Title Two',
          'GOOGLE_TRENDS_WATCHLIST=ai,llm',
        ].join('\n'),
        'utf8',
      );

      // Hermes isolates HOME under <tmpRoot>/.hermes/home — the broken path.
      const merged = await mergeTrendIngestEnv({
        HOME: join(tmpRoot, '.hermes', 'home'),
        USER: 'christ',
      });

      assert.equal(merged.NEWSAPI_API_KEY, 'news-secret');
      assert.equal(merged.PERPLEXITY_API_KEY, 'perp-secret');
      assert.equal(
        merged.NOTEBOOKLM_NOTEBOOK_TITLES,
        'nb1:Title One,nb2:Title Two',
      );
      assert.equal(merged.GOOGLE_TRENDS_WATCHLIST, 'ai,llm');
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('lets baseEnv override file values', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'cns-merge-env-'));
    try {
      await mkdir(join(tmpRoot, '.hermes'), { recursive: true });
      await writeFile(
        join(tmpRoot, '.hermes', 'trend-ingest.env'),
        'NEWSAPI_API_KEY=from-file\n',
        'utf8',
      );

      const merged = await mergeTrendIngestEnv({
        HOME: join(tmpRoot, '.hermes', 'home'),
        USER: 'christ',
        NEWSAPI_API_KEY: 'from-process-env',
      });

      assert.equal(merged.NEWSAPI_API_KEY, 'from-process-env');
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('returns baseEnv unchanged when no env file exists', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'cns-merge-env-'));
    try {
      const merged = await mergeTrendIngestEnv({
        HOME: join(tmpRoot, '.hermes', 'home'),
        USER: 'christ',
        SOME_KEY: 'value',
      });
      assert.equal(merged.SOME_KEY, 'value');
      assert.equal(merged.NEWSAPI_API_KEY, undefined);
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('loadArxivConfig', () => {
  it('does not embed default categories in code path', () => {
    const cfg = loadArxivConfig({});
    assert.deepEqual(cfg.categories, []);
  });

  it('caps configured categories at three for terminal timeout budget', () => {
    const cfg = loadArxivConfig({
      MORNING_DIGEST_ARXIV_CATEGORIES: 'cs.AI,cs.LG,stat.ML,cs.CL,cs.CV',
    });
    assert.equal(cfg.categories.length, 3);
    assert.deepEqual(cfg.categories, ['cs.AI', 'cs.LG', 'stat.ML']);
  });
});
