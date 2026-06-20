import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDigestPushPayload,
  extractArxivId,
  extractHnItemId,
  shortSha256,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import {
  buildCanonicalPinterestDigestSignal,
  CANONICAL_PINTEREST_PIN,
  PINTEREST_VALIDATOR_METADATA_KEYS,
} from './fixtures/pinterest-digest-signal.fixture.mjs';
import {
  buildCanonicalPolymarketDigestSignal,
  CANONICAL_POLYMARKET_MARKET,
  POLYMARKET_VALIDATOR_METADATA_KEYS,
} from './fixtures/polymarket-digest-signal.fixture.mjs';

describe('build-digest-push-payload (Story 68-10)', () => {
  it('shortSha256 returns 16-char hex', () => {
    assert.equal(shortSha256('test').length, 16);
  });

  it('extractArxivId and extractHnItemId helpers', () => {
    assert.equal(extractArxivId('https://arxiv.org/abs/2401.12345'), '2401.12345');
    assert.equal(extractHnItemId('https://news.ycombinator.com/item?id=48408186'), '48408186');
  });

  it('maps adapter outputs into strict signal objects', () => {
    const payload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      trends: { events: [{ keyword: 'AI agents', normalizedValue: 0.87 }] },
      newsapi: { headlines: [{ title: 'Headline', url: 'https://example.com/a' }] },
      hackernews: {
        stories: [
          {
            title: 'Show HN',
            link: 'https://news.ycombinator.com/item?id=1',
            score: 42,
            comments: 3,
          },
        ],
      },
      twitter: {
        posts: [{ title: 'Tweet body', url: 'https://x.com/a/status/1', likes: 5 }],
      },
      bluesky: {
        posts: [{ title: 'Skeet', url: 'https://bsky.app/profile/a/post/1', likes: 2 }],
      },
      producthunt: {
        launches: [{ title: 'Launch', tagline: 'Tag', url: 'https://ph.com/1', votesCount: 9 }],
      },
      runMeta: { topTrend: 'AI agents', focusKeyword: 'AI agents' },
    });

    assert.equal(payload.run.date, '2026-06-11');
    assert.ok(payload.signals.length >= 6);

    const twitter = payload.signals.find((row) => row.sourceType === 'twitter');
    assert.ok(twitter);
    assert.equal(twitter.section, 'twitter');
    assert.equal(twitter.title, 'Tweet body');
    assert.equal(twitter.sourceMetadata.likes, 5);

    const bluesky = payload.signals.find((row) => row.sourceType === 'bluesky');
    assert.ok(bluesky);
    assert.equal(bluesky.section, 'bluesky');

    const ph = payload.signals.find((row) => row.sourceType === 'producthunt');
    assert.ok(ph);
    assert.equal(ph.summary, 'Tag');
    assert.equal(ph.sourceMetadata.upvotes, 9);

    for (const signal of payload.signals) {
      assert.ok(signal.section);
      assert.ok(signal.sourceType);
      assert.ok(signal.title);
      assert.equal(typeof signal.rank, 'number');
      if ('url' in signal) {
        assert.notEqual(signal.url, null);
      }
      if ('summary' in signal) {
        assert.notEqual(signal.summary, null);
      }
    }
  });

  it('maps pinterest repinCount to sourceMetadata.upvotes only (Story 72-5)', () => {
    const payload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      pinterest: { pins: [CANONICAL_PINTEREST_PIN] },
      runMeta: { topTrend: 'AI agents' },
    });

    const pinterest = payload.signals.find((row) => row.sourceType === 'pinterest');
    assert.ok(pinterest);
    assert.equal(pinterest.section, 'pinterest');
    assert.equal(pinterest.sourceMetadata?.upvotes, CANONICAL_PINTEREST_PIN.repinCount);
    assert.equal(pinterest.sourceMetadata?.author, CANONICAL_PINTEREST_PIN.author);
    assert.equal(pinterest.sourceMetadata?.publishedAt, CANONICAL_PINTEREST_PIN.publishedAt);
    assert.equal(pinterest.title, CANONICAL_PINTEREST_PIN.title);
    assert.ok(
      pinterest.summary?.includes('MCP server'),
      'summary should come from description, not imageUrl/link',
    );

    const metaKeys = Object.keys(pinterest.sourceMetadata ?? {}).sort();
    assert.deepEqual(metaKeys, [...PINTEREST_VALIDATOR_METADATA_KEYS].sort());
    assert.equal('repinCount' in (pinterest ?? {}), false);
    assert.equal('imageUrl' in (pinterest.sourceMetadata ?? {}), false);
    assert.equal('link' in (pinterest.sourceMetadata ?? {}), false);
    assert.equal('description' in (pinterest.sourceMetadata ?? {}), false);
  });

  it('canonical pinterest fixture stays aligned with buildDigestPushPayload (anti-drift)', () => {
    const signal = buildCanonicalPinterestDigestSignal();
    assert.equal(signal.sourceMetadata?.upvotes, 4200);
    assert.equal(signal.externalId, CANONICAL_PINTEREST_PIN.pinId);
  });

  it('maps polymarket volume24hrUsd to sourceMetadata.upvotes only (Story 72-6)', () => {
    const payload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      polymarket: { markets: [CANONICAL_POLYMARKET_MARKET] },
      runMeta: { topTrend: 'AI model' },
    });

    const polymarket = payload.signals.find((row) => row.sourceType === 'polymarket');
    assert.ok(polymarket);
    assert.equal(polymarket.section, 'polymarket');
    assert.equal(polymarket.sourceMetadata?.upvotes, CANONICAL_POLYMARKET_MARKET.volume24hrUsd);
    assert.equal(polymarket.sourceMetadata?.leadingOutcome, 'No');
    assert.equal(polymarket.sourceMetadata?.leadingProbability, 0.58);
    assert.equal(polymarket.title, CANONICAL_POLYMARKET_MARKET.question);
    assert.ok(polymarket.summary?.includes('No'));
    assert.ok(polymarket.summary?.includes('58%'));

    const metaKeys = Object.keys(polymarket.sourceMetadata ?? {}).sort();
    assert.deepEqual(metaKeys, [...POLYMARKET_VALIDATOR_METADATA_KEYS].sort());
    assert.equal('conditionId' in (polymarket.sourceMetadata ?? {}), false);
    assert.equal('slug' in (polymarket.sourceMetadata ?? {}), false);
    assert.equal('volume24hrUsd' in (polymarket.sourceMetadata ?? {}), false);
  });

  it('polymarket externalId uses conditionId hash when marketId absent (AC 5)', () => {
    const market = {
      ...CANONICAL_POLYMARKET_MARKET,
      marketId: '',
      url: '',
      slug: '',
    };
    const payload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      polymarket: { markets: [market] },
      runMeta: { topTrend: 'AI' },
    });
    const signal = payload.signals.find((row) => row.sourceType === 'polymarket');
    assert.equal(signal?.externalId, shortSha256(market.conditionId).slice(0, 16));
  });

  it('canonical polymarket fixture stays aligned with buildDigestPushPayload (anti-drift)', () => {
    const signal = buildCanonicalPolymarketDigestSignal();
    assert.equal(signal.sourceMetadata?.upvotes, CANONICAL_POLYMARKET_MARKET.volume24hrUsd);
    assert.equal(signal.externalId, CANONICAL_POLYMARKET_MARKET.marketId);
  });
});
