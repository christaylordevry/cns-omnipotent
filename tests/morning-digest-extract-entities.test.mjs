import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aggregateRunEntities,
  collectCoMentionedTracked,
  extractEntitiesFromSignal,
  normalizeAccountIdentifier,
  normalizeEntityKey,
  normalizeEntityName,
  parseGithubRepoUrl,
  pickTopSignalRefs,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs';
import { buildCanonicalThreadsDigestSignal } from './fixtures/threads-digest-signal.fixture.mjs';

describe('extract-entities.mjs (Story 73-2)', () => {
  describe('normalizeEntityName / normalizeEntityKey (ADR-E73-003)', () => {
    it('normalizes person names with trim, lowercase, collapsed whitespace', () => {
      assert.equal(normalizeEntityName('  Andrej   Karpathy '), 'andrej karpathy');
      assert.equal(
        normalizeEntityKey('person', 'Andrej Karpathy'),
        'person:andrej karpathy',
      );
    });

    it('strips @ and lowercases account handles', () => {
      assert.equal(normalizeAccountIdentifier('@Karpathy'), 'karpathy');
      assert.equal(
        normalizeEntityKey('account', 'twitter', '@karpathy'),
        'account:twitter:karpathy',
      );
    });

    it('builds org keys from github owner segment', () => {
      assert.equal(
        normalizeEntityKey('org', 'github', 'ggml-org'),
        'org:github:ggml-org',
      );
    });
  });

  describe('extractEntitiesFromSignal', () => {
    it('extracts tracked person from peopleMatch.personName', () => {
      const entities = extractEntitiesFromSignal({
        sourceType: 'newsapi',
        title: 'Interview headline',
        sourceMetadata: {
          peopleMatch: { personName: 'Andrej Karpathy', matchType: 'name' },
        },
      });
      assert.equal(entities.length, 1);
      assert.deepEqual(entities[0], {
        entityType: 'person',
        entityKey: 'person:andrej karpathy',
        displayName: 'Andrej Karpathy',
        platform: 'newsapi',
        tracked: true,
      });
    });

    it('extracts twitter account from authorHandle with @ stripped', () => {
      const entities = extractEntitiesFromSignal({
        sourceType: 'twitter',
        title: 'Tweet body',
        sourceMetadata: { authorHandle: '@karpathy', likes: 10 },
      });
      assert.equal(entities.length, 1);
      assert.deepEqual(entities[0], {
        entityType: 'account',
        entityKey: 'account:twitter:karpathy',
        displayName: 'karpathy',
        platform: 'twitter',
        tracked: false,
      });
    });

    it('extracts bluesky account from authorHandle', () => {
      const entities = extractEntitiesFromSignal({
        sourceType: 'bluesky',
        title: 'Skeet',
        sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
      });
      assert.equal(entities.length, 1);
      assert.equal(entities[0].entityKey, 'account:bluesky:karpathy.bsky.social');
      assert.equal(entities[0].entityType, 'account');
    });

    it('extracts rss account from author field', () => {
      const entities = extractEntitiesFromSignal({
        sourceType: 'rss',
        title: 'Article',
        url: 'https://example.com/post',
        sourceMetadata: { author: 'Jane Doe' },
      });
      assert.equal(entities.length, 1);
      assert.deepEqual(entities[0], {
        entityType: 'account',
        entityKey: 'account:rss:jane doe',
        displayName: 'Jane Doe',
        platform: 'rss',
        tracked: false,
      });
    });

    it('extracts github org from repo url owner segment', () => {
      const entities = extractEntitiesFromSignal({
        sourceType: 'github',
        title: 'llama.cpp',
        url: 'https://github.com/ggml-org/llama.cpp',
        sourceMetadata: { stars: 50_000 },
      });
      assert.equal(entities.length, 1);
      assert.deepEqual(entities[0], {
        entityType: 'org',
        entityKey: 'org:github:ggml-org',
        displayName: 'ggml-org',
        platform: 'github',
        tracked: false,
      });
    });

    it('emits person and org on the same github signal', () => {
      const entities = extractEntitiesFromSignal({
        sourceType: 'github',
        title: 'llama.cpp release',
        url: 'https://github.com/ggml-org/llama.cpp',
        sourceMetadata: {
          peopleMatch: { personName: 'Andrej Karpathy', matchType: 'name' },
          stars: 50_000,
        },
      });
      assert.equal(entities.length, 2);
      assert.deepEqual(
        entities.map((row) => row.entityKey).sort(),
        ['org:github:ggml-org', 'person:andrej karpathy'],
      );
    });

    it('returns empty array when no structured entity fields exist', () => {
      assert.deepEqual(
        extractEntitiesFromSignal({
          sourceType: 'producthunt',
          title: 'Launch title only',
          url: 'https://www.producthunt.com/posts/example',
          sourceMetadata: { upvotes: 120 },
        }),
        [],
      );
    });

    it('prefers peopleMatch over authorHandle on the same signal', () => {
      const entities = extractEntitiesFromSignal({
        sourceType: 'bluesky',
        title: 'Post',
        sourceMetadata: {
          authorHandle: 'karpathy.bsky.social',
          peopleMatch: { personName: 'Andrej Karpathy', matchType: 'handle' },
        },
      });
      assert.equal(entities.length, 1);
      assert.equal(entities[0].entityType, 'person');
      assert.equal(entities[0].entityKey, 'person:andrej karpathy');
    });

    it('does not free-text extract from title or summary', () => {
      assert.deepEqual(
        extractEntitiesFromSignal({
          sourceType: 'newsapi',
          title: 'Andrej Karpathy announces new project',
          summary: 'Jane Doe also commented',
        }),
        [],
      );
    });

    it('maps threads canonical fixture authorHandle to account key', () => {
      const signal = buildCanonicalThreadsDigestSignal();
      const entities = extractEntitiesFromSignal(signal);
      assert.equal(entities.length, 1);
      assert.equal(entities[0].entityKey, 'account:threads:karpathy');
    });
  });

  describe('parseGithubRepoUrl', () => {
    it('parses owner and repo from common github url shapes', () => {
      assert.deepEqual(parseGithubRepoUrl('https://github.com/ggml-org/llama.cpp'), {
        owner: 'ggml-org',
        repo: 'llama.cpp',
      });
      assert.deepEqual(parseGithubRepoUrl('http://www.github.com/OpenAI/tiktoken'), {
        owner: 'OpenAI',
        repo: 'tiktoken',
      });
      assert.deepEqual(parseGithubRepoUrl('github.com/openai/tiktoken/issues/1'), {
        owner: 'openai',
        repo: 'tiktoken',
      });
      assert.equal(parseGithubRepoUrl('https://github.com/orgs/openai'), null);
      assert.equal(parseGithubRepoUrl('https://github.com/orgs/'), null);
      assert.equal(parseGithubRepoUrl('https://github.com/openai'), null);
      assert.equal(parseGithubRepoUrl('github.com/openai/'), null);
      assert.equal(parseGithubRepoUrl('https://evil.example/github.com/openai/gpt'), null);
      assert.equal(parseGithubRepoUrl('https://notgithub.com/github.com/openai/gpt'), null);
      assert.equal(parseGithubRepoUrl('prefix github.com/openai/gpt suffix'), null);
      assert.equal(parseGithubRepoUrl('ftp://github.com/openai/gpt'), null);
      assert.equal(parseGithubRepoUrl('https://github.com/explore/repos'), null);
      assert.equal(parseGithubRepoUrl('https://github.com/openai/..'), null);
    });
  });

  describe('aggregateRunEntities', () => {
    it('groups run-level aggregates by entityKey', () => {
      const signals = [
        {
          digestSignalId: 'digestSignals:sig-a',
          sourceType: 'twitter',
          title: 'Tweet A',
          url: 'https://x.com/a/status/1',
          externalId: 'sig-a',
          rankScore: 70,
          scores: { personalRelevance: 55 },
          sourceMetadata: { authorHandle: 'karpathy' },
        },
        {
          digestSignalId: 'digestSignals:sig-b',
          sourceType: 'bluesky',
          title: 'Skeet B',
          url: 'https://bsky.app/profile/a/post/2',
          externalId: 'sig-b',
          rankScore: 90,
          scores: { personalRelevance: 80 },
          sourceMetadata: {
            authorHandle: 'karpathy.bsky.social',
            peopleMatch: { personName: 'Andrej Karpathy', matchType: 'handle' },
          },
        },
        {
          digestSignalId: 'digestSignals:sig-c',
          sourceType: 'github',
          title: 'Repo',
          url: 'https://github.com/ggml-org/llama.cpp',
          externalId: 'sig-c',
          rankScore: 60,
          scores: { personalRelevance: 40 },
          sourceMetadata: { stars: 1000 },
        },
      ];

      const aggregates = aggregateRunEntities(signals);
      const person = aggregates['person:andrej karpathy'];
      assert.ok(person);
      assert.equal(person.mentionCount, 1);
      assert.equal(person.distinctSignalCount, 1);
      assert.deepEqual(person.sourceTypes, ['bluesky']);
      assert.equal(person.maxPersonalRelevance, 80);
      assert.equal(person.maxRankScore, 90);
      assert.equal(person.tracked, true);

      const twitter = aggregates['account:twitter:karpathy'];
      assert.ok(twitter);
      assert.equal(twitter.mentionCount, 1);
      assert.deepEqual(twitter.coMentionedTrackedEntities, ['person:andrej karpathy']);

      const org = aggregates['org:github:ggml-org'];
      assert.ok(org);
      assert.deepEqual(org.coMentionedTrackedEntities, ['person:andrej karpathy']);
    });

    it('counts duplicate signal references toward mentionCount and distinctSignalCount', () => {
      const signal = {
        digestSignalId: 'digestSignals:sig-dup',
        sourceType: 'github',
        title: 'Repo',
        url: 'https://github.com/ggml-org/llama.cpp',
        externalId: 'sig-dup',
        rankScore: 50,
        sourceMetadata: {
          peopleMatch: { personName: 'Andrej Karpathy', matchType: 'name' },
        },
      };
      const aggregates = aggregateRunEntities([signal, signal]);
      const person = aggregates['person:andrej karpathy'];
      assert.equal(person.mentionCount, 2);
      assert.equal(person.distinctSignalCount, 1);
      assert.equal(person.signalRefs.length, 1);
    });

    it('caps signalRefs at five highest rankScore signals', () => {
      const signals = Array.from({ length: 7 }, (_, index) => ({
        digestSignalId: `digestSignals:sig-${index}`,
        sourceType: 'twitter',
        title: `Tweet ${index}`,
        url: `https://x.com/a/status/${index}`,
        externalId: `sig-${index}`,
        rankScore: index * 10,
        sourceMetadata: { authorHandle: 'karpathy' },
      }));
      const refs = pickTopSignalRefs(signals);
      assert.equal(refs.length, 5);
      assert.deepEqual(
        refs.map((row) => row.title),
        ['Tweet 6', 'Tweet 5', 'Tweet 4', 'Tweet 3', 'Tweet 2'],
      );

      const aggregate = aggregateRunEntities(signals)['account:twitter:karpathy'];
      assert.equal(aggregate.signalRefs.length, 5);
      assert.equal(aggregate.signalRefs[0].title, 'Tweet 6');
    });

    it('includes digestSignalId on signalRefs when present', () => {
      const aggregates = aggregateRunEntities([
        {
          digestSignalId: 'digestSignals:abc123',
          sourceType: 'rss',
          title: 'Post',
          url: 'https://example.com/post',
          rankScore: 42,
          sourceMetadata: { author: 'Jane Doe' },
        },
      ]);
      assert.equal(
        aggregates['account:rss:jane doe'].signalRefs[0].digestSignalId,
        'digestSignals:abc123',
      );
    });

    it('requires post-push digestSignalId values for aggregation', () => {
      assert.throws(
        () =>
          aggregateRunEntities([
            {
              sourceType: 'rss',
              title: 'Post',
              externalId: 'pre-push-id',
              sourceMetadata: { author: 'Jane Doe' },
            },
          ]),
        /requires a Convex-assigned digestSignalId/,
      );
    });

    it('omits non-finite score maxima and sorts them as zero', () => {
      const aggregate = aggregateRunEntities([
        {
          digestSignalId: 'digestSignals:infinite',
          sourceType: 'rss',
          title: 'Infinite',
          rankScore: Number.POSITIVE_INFINITY,
          scores: { personalRelevance: Number.NEGATIVE_INFINITY },
          sourceMetadata: { author: 'Jane Doe' },
        },
        {
          digestSignalId: 'digestSignals:finite',
          sourceType: 'rss',
          title: 'Finite',
          rankScore: 40,
          scores: { personalRelevance: 50 },
          sourceMetadata: { author: 'Jane Doe' },
        },
      ])['account:rss:jane doe'];

      assert.equal(aggregate.maxRankScore, 40);
      assert.equal(aggregate.maxPersonalRelevance, 50);
      assert.equal(aggregate.signalRefs[0].digestSignalId, 'digestSignals:finite');
    });

    it('returns empty object for empty signal array', () => {
      assert.deepEqual(aggregateRunEntities([]), {});
    });
  });

  describe('collectCoMentionedTracked', () => {
    it('lists other tracked person keys in the run', () => {
      const signals = [
        {
          sourceType: 'newsapi',
          title: 'A',
          sourceMetadata: {
            peopleMatch: { personName: 'Andrej Karpathy', matchType: 'name' },
          },
        },
        {
          sourceType: 'newsapi',
          title: 'B',
          sourceMetadata: {
            peopleMatch: { personName: 'Dario Amodei', matchType: 'name' },
          },
        },
      ];
      assert.deepEqual(
        collectCoMentionedTracked(signals, 'person:andrej karpathy'),
        ['person:dario amodei'],
      );
    });
  });
});
