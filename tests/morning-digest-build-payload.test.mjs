import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDigestPushPayload,
  extractArxivId,
  extractHnItemId,
  shortSha256,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';

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
});
