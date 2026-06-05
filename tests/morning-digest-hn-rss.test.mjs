import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  extractScoreAndComments,
  isHnEnabled,
  loadHnConfig,
  parseHnItemBlock,
  parseHnRss,
  runHnFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs',
);

const FIXTURE_RSS = `<?xml version="1.0"?>
<rss><channel>
<item>
<title><![CDATA[Dear Microsoft, enough is enough]]></title>
<description><![CDATA[
<p>Article URL: <a href="https://www.politico.eu/sponsored-content/example">...</a></p>
<p>Comments URL: <a href="https://news.ycombinator.com/item?id=48408186">...</a></p>
<p>Points: 14</p>
<p># Comments: 2</p>
]]></description>
<pubDate>Fri, 05 Jun 2026 05:01:59 +0000</pubDate>
<link>https://www.politico.eu/sponsored-content/example</link>
<comments>https://news.ycombinator.com/item?id=48408186</comments>
</item>
<item>
<title><![CDATA[Second Story Title]]></title>
<description><![CDATA[
<p>Article URL: <a href="https://example.com/article">...</a></p>
<p>Comments URL: <a href="https://news.ycombinator.com/item?id=12345">...</a></p>
]]></description>
<pubDate>Fri, 05 Jun 2026 04:00:00 +0000</pubDate>
<link>https://example.com/article</link>
</item>
</channel></rss>`;

describe('fetch-hn-rss.mjs parsing', () => {
  it('parses fixture RSS into titles, links, score, and comments', () => {
    const stories = parseHnRss(FIXTURE_RSS, 5);
    assert.equal(stories.length, 2);
    assert.equal(stories[0].title, 'Dear Microsoft, enough is enough');
    assert.equal(stories[0].link, 'https://www.politico.eu/sponsored-content/example');
    assert.equal(stories[0].score, 14);
    assert.equal(stories[0].comments, 2);
    assert.equal(stories[1].title, 'Second Story Title');
    assert.equal(stories[1].link, 'https://example.com/article');
    assert.equal(stories[1].score, 0);
    assert.equal(stories[1].comments, 0);
  });

  it('extractScoreAndComments defaults to 0 when lines are absent', () => {
    const { score, comments } = extractScoreAndComments(
      '<p>Article URL only</p>',
    );
    assert.equal(score, 0);
    assert.equal(comments, 0);
  });

  it('parseHnItemBlock extracts score and comments from description HTML', () => {
    const block = `<item>
<title>Test</title>
<link>https://example.com</link>
<description><![CDATA[<p>Points: 42</p><p># Comments: 7</p>]]></description>
</item>`;
    const parsed = parseHnItemBlock(block);
    assert.ok(parsed);
    assert.equal(parsed.score, 42);
    assert.equal(parsed.comments, 7);
  });
});

describe('fetch-hn-rss.mjs runHnFetch', () => {
  it('returns stories from fixture without network', async () => {
    const payload = await runHnFetch({}, { fixtureXml: FIXTURE_RSS });
    assert.ok(Array.isArray(payload.stories));
    assert.equal(payload.stories.length, 2);
  });

  it('returns hackernews disabled when enabled flag is false', async () => {
    const payload = await runHnFetch({ MORNING_DIGEST_HN_ENABLED: 'false' });
    assert.deepEqual(payload, { error: 'hackernews disabled' });
  });

  it('caps stories at MORNING_DIGEST_HN_MAX_STORIES', async () => {
    const payload = await runHnFetch(
      { MORNING_DIGEST_HN_MAX_STORIES: '1' },
      { fixtureXml: FIXTURE_RSS },
    );
    assert.equal(payload.stories.length, 1);
    assert.equal(payload.stories[0].title, 'Dear Microsoft, enough is enough');
  });

  it('returns error JSON on fetch failure', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const payload = await runHnFetch({}, { fetch: failingFetch });
    assert.ok(payload.error);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_HN_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'hackernews disabled' });
  });
});

describe('loadHnConfig', () => {
  it('defaults maxStories to 5 when unset or invalid', () => {
    assert.equal(loadHnConfig({}).maxStories, 5);
    assert.equal(loadHnConfig({ MORNING_DIGEST_HN_MAX_STORIES: '0' }).maxStories, 5);
    assert.equal(loadHnConfig({ MORNING_DIGEST_HN_MAX_STORIES: 'abc' }).maxStories, 5);
  });

  it('isHnEnabled treats empty as enabled', () => {
    assert.equal(isHnEnabled(undefined), true);
    assert.equal(isHnEnabled('false'), false);
    assert.equal(isHnEnabled('off'), false);
  });
});
