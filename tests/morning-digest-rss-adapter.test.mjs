import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  dedupeEntries,
  fetchFeed,
  isRssEnabled,
  loadRssConfig,
  mapRssItem,
  parseFeedItems,
  parsePublishedAt,
  parseRssFeeds,
  runRssFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-rss-signals.mjs';
import {
  normalizeEngagement,
  scoreDigestSignals,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

/**
 * Mirrors task-prompt §9 RSS assembly: nest entries[] metadata under sourceMetadata.
 *
 * @param {{ title: string, url: string, publishedAt?: string, author?: string }} entry
 * @param {number} rank
 */
function rssEntryToDigestSignal(entry, rank) {
  /** @type {Record<string, unknown>} */
  const sourceMetadata = {};
  if (entry.publishedAt) {
    sourceMetadata.publishedAt = entry.publishedAt;
  }
  if (entry.author) {
    sourceMetadata.author = entry.author;
  }
  const externalId = createHash('sha256').update(entry.url).digest('hex').slice(0, 16);
  return {
    section: 'rss',
    sourceType: 'rss',
    title: entry.title,
    url: entry.url,
    rank,
    externalId,
    ...(Object.keys(sourceMetadata).length > 0 ? { sourceMetadata } : {}),
  };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-rss-signals.mjs',
);

const FIXTURE_RSS_20 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Test RSS 2.0</title>
    <item>
      <title>Article One</title>
      <link>https://example.com/one</link>
      <pubDate>Mon, 09 Jun 2026 07:00:00 GMT</pubDate>
      <dc:creator>Author One</dc:creator>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/one</link>
      <pubDate>Sun, 08 Jun 2026 07:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Three</title>
      <link>https://example.com/three</link>
      <pubDate>Sat, 07 Jun 2026 07:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const FIXTURE_ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom-one"/>
    <updated>2026-06-09T07:00:00.000Z</updated>
    <author><name>Atom Author</name></author>
  </entry>
</feed>`;

const FIXTURE_MALFORMED = 'not valid xml <<<';

describe('fetch-rss-signals.mjs config', () => {
  it('isRssEnabled treats empty as enabled and falsy values as disabled', () => {
    assert.equal(isRssEnabled(undefined), true);
    assert.equal(isRssEnabled('false'), false);
    assert.equal(isRssEnabled('off'), false);
  });

  it('parseRssFeeds trims and drops empty segments', () => {
    assert.deepEqual(parseRssFeeds(' https://a.test/feed , ,https://b.test/rss '), [
      'https://a.test/feed',
      'https://b.test/rss',
    ]);
  });

  it('loadRssConfig defaults maxPerFeed and maxTotal when unset or invalid', () => {
    const config = loadRssConfig({
      MORNING_DIGEST_RSS_FEEDS: 'https://example.com/feed',
    });
    assert.equal(config.maxPerFeed, 3);
    assert.equal(config.maxTotal, 10);
    assert.deepEqual(config.feeds, ['https://example.com/feed']);
  });
});

describe('fetch-rss-signals.mjs parse/map', () => {
  it('parsePublishedAt prefers isoDate and returns ISO8601', () => {
    assert.equal(
      parsePublishedAt('2026-06-09T07:00:00.000Z', undefined),
      '2026-06-09T07:00:00.000Z',
    );
    assert.equal(parsePublishedAt(undefined, 'Mon, 09 Jun 2026 07:00:00 GMT'), '2026-06-09T07:00:00.000Z');
  });

  it('maps RSS 2.0 XML fixture items to entries[] shape', async () => {
    const payload = await runRssFetch(
      { MORNING_DIGEST_RSS_FEEDS: 'https://example.com/rss' },
      { fixtureXml: FIXTURE_RSS_20 },
    );
    assert.ok(Array.isArray(payload.entries));
    assert.equal(payload.entries.length, 2);
    assert.deepEqual(payload.entries[0], {
      title: 'Article One',
      url: 'https://example.com/one',
      publishedAt: '2026-06-09T07:00:00.000Z',
      author: 'Author One',
    });
  });

  it('maps Atom XML fixture to entries[] shape', async () => {
    const payload = await runRssFetch(
      { MORNING_DIGEST_RSS_FEEDS: 'https://example.com/atom' },
      { fixtureXml: FIXTURE_ATOM },
    );
    assert.equal(payload.entries?.length, 1);
    assert.equal(payload.entries?.[0].title, 'Atom Entry');
    assert.equal(payload.entries?.[0].url, 'https://example.com/atom-one');
    assert.equal(payload.entries?.[0].author, 'Atom Author');
  });

  it('mapRssItem omits optional fields when absent', () => {
    const mapped = mapRssItem({ title: 'Plain', link: 'https://example.com/plain' });
    assert.deepEqual(mapped, { title: 'Plain', url: 'https://example.com/plain' });
  });
});

describe('fetch-rss-signals.mjs dedupe/caps', () => {
  it('dedupeEntries removes duplicate URLs then duplicate titles', () => {
    const items = parseFeedItems(
      [
        { title: 'A', link: 'https://example.com/dup' },
        { title: 'B', link: 'https://example.com/dup' },
        { title: 'a', link: 'https://example.com/other' },
      ],
      10,
    );
    const deduped = dedupeEntries(items, 10);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].title, 'A');
  });

  it('respects MAX_PER_FEED and MAX_TOTAL', async () => {
    const payload = await runRssFetch(
      {
        MORNING_DIGEST_RSS_FEEDS: 'https://example.com/rss',
        MORNING_DIGEST_RSS_MAX_PER_FEED: '2',
        MORNING_DIGEST_RSS_MAX_TOTAL: '10',
      },
      { fixtureXml: FIXTURE_RSS_20 },
    );
    assert.equal(payload.entries?.length, 2);
    assert.equal(payload.entries?.[0].title, 'Article One');
    assert.equal(payload.entries?.[1].title, 'Article Three');
  });

  it('respects MAX_TOTAL across combined feeds', async () => {
    const payload = await runRssFetch(
      {
        MORNING_DIGEST_RSS_FEEDS: 'https://example.com/rss,https://example.com/atom',
        MORNING_DIGEST_RSS_MAX_TOTAL: '2',
      },
      {
        fixtureXmlByFeedUrl: {
          'https://example.com/rss': FIXTURE_RSS_20,
          'https://example.com/atom': FIXTURE_ATOM,
        },
      },
    );
    assert.equal(payload.entries?.length, 2);
  });
});

describe('fetch-rss-signals.mjs failure paths', () => {
  it('returns rss disabled when enabled flag is false', async () => {
    const payload = await runRssFetch({
      MORNING_DIGEST_RSS_ENABLED: 'false',
      MORNING_DIGEST_RSS_FEEDS: 'https://example.com/feed',
    });
    assert.deepEqual(payload, { error: 'rss disabled' });
  });

  it('returns missing-feeds when enabled but feeds unset', async () => {
    const payload = await runRssFetch({});
    assert.deepEqual(payload, { error: 'missing-feeds' });
  });

  it('skips single malformed feed and continues others', async () => {
    const payload = await runRssFetch(
      {
        MORNING_DIGEST_RSS_FEEDS: 'https://bad.example/feed,https://good.example/feed',
      },
      {
        fixtureXmlByFeedUrl: {
          'https://bad.example/feed': FIXTURE_MALFORMED,
          'https://good.example/feed': FIXTURE_ATOM,
        },
      },
    );
    assert.equal(payload.entries?.length, 1);
    assert.equal(payload.entries?.[0].title, 'Atom Entry');
  });

  it('returns error when all feeds fail', async () => {
    const payload = await runRssFetch(
      { MORNING_DIGEST_RSS_FEEDS: 'https://bad.example/feed' },
      { fixtureXml: FIXTURE_MALFORMED },
    );
    assert.ok(payload.error);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_RSS_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'rss disabled' });
  });
});

describe('fetch-rss-signals.mjs scoring round-trip', () => {
  it('entry → digestSignal → normalizeEngagement null → momentum Path B', async () => {
    const payload = await runRssFetch(
      { MORNING_DIGEST_RSS_FEEDS: 'https://example.com/rss' },
      { fixtureXml: FIXTURE_RSS_20 },
    );
    assert.ok(Array.isArray(payload.entries) && payload.entries.length > 0);

    const signal = rssEntryToDigestSignal(payload.entries[0], 1);
    assert.equal(normalizeEngagement(signal), null);
    assert.equal(signal.sourceMetadata?.publishedAt, payload.entries[0].publishedAt);
    assert.equal(signal.sourceMetadata?.author, payload.entries[0].author);

    const [scored] = scoreDigestSignals([signal], {
      domainTokens: [],
      personalTokens: [],
      epicNumericTokens: [],
      noveltyHistoryEntries: [],
      runAt: Date.parse('2026-06-09T12:00:00Z'),
      watchlistMissing: false,
    });
    assert.ok(Number.isFinite(scored.rankScore));
    assert.ok(scored.scores && scored.scores.momentum > 0);

    const rootLevelMetadata = {
      section: 'rss',
      sourceType: 'rss',
      title: payload.entries[0].title,
      url: payload.entries[0].url,
      rank: 1,
      publishedAt: payload.entries[0].publishedAt,
      author: payload.entries[0].author,
    };
    assert.equal(normalizeEngagement(rootLevelMetadata), null);
  });
});

describe('fetchFeed', () => {
  it('returns parse-error for malformed XML', async () => {
    const Parser = (await import('rss-parser')).default;
    const parser = new Parser();
    const result = await fetchFeed('https://example.com/bad', parser, FIXTURE_MALFORMED);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason);
    }
  });
});
