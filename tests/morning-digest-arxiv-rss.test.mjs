import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  extractSnippetFromDescription,
  isValidArxivCategory,
  loadArxivConfig,
  parseArxivRss,
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
