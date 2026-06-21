import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertEntityMentionPayloadRow,
  buildCanonicalEntityMentionFixture,
  buildEntityMentionPayload,
  resolveWorkspaceId,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/build-entity-mention-payload.mjs';
import {
  assertEntityMentionRowViaDashboard,
  ENTITY_MENTION_INPUT_KEYS,
  ENTITY_MENTION_REQUIRED_KEYS,
} from '../scripts/lib/entity-mention-validator-bridge.mjs';
import {
  buildCanonicalEntityMentionPayload,
  buildCanonicalEntityMentionRow,
  ENTITY_MENTION_ROW_KEYS,
  ENTITY_MENTION_SIGNAL_REF_KEYS,
} from './fixtures/entity-mention.fixture.mjs';

/**
 * Validator import strategy (AC2):
 * - Node tests call assertEntityMentionRowViaDashboard → real cns-dashboard assertEntityMentionRow
 *   (business rules bound to entityMentionInputValidator / recordEntityMentions).
 * - Convex field-type validation remains in cns-dashboard entityIntelligence.test.ts (Story 73-1).
 */

const SAMPLE_RUN = Object.freeze({
  digestRunId: 'digestRuns:sample-run',
  ranAt: 1_749_657_600_000,
  date: '2026-06-11',
});

function postPushSignal(overrides) {
  return {
    digestSignalId: 'digestSignals:sig-default',
    sourceType: 'twitter',
    title: 'Default signal',
    rankScore: 50,
    sourceMetadata: { authorHandle: 'defaultuser' },
    ...overrides,
  };
}

function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe('build-entity-mention-payload.mjs (Story 73-3)', () => {
  describe('post-push ordering (AC3)', () => {
    it('requires Convex-assigned digestSignalId — rejects pre-push signals', () => {
      assert.throws(
        () =>
          buildEntityMentionPayload(SAMPLE_RUN, [
            {
              sourceType: 'rss',
              title: 'Pre-push',
              externalId: 'pre-push-only',
              sourceMetadata: { author: 'Jane Doe' },
            },
          ]),
        /requires a Convex-assigned digestSignalId/,
      );
    });

    it('preflights mixed batches before aggregation runs', () => {
      assert.throws(
        () =>
          buildEntityMentionPayload(SAMPLE_RUN, [
            postPushSignal({
              digestSignalId: 'digestSignals:mixed-ok-1',
              title: 'Good first',
            }),
            {
              sourceType: 'rss',
              title: 'Missing second',
              sourceMetadata: { author: 'Jane Doe' },
            },
            postPushSignal({
              digestSignalId: 'digestSignals:mixed-ok-2',
              sourceType: 'github',
              title: 'Good third',
              url: 'https://github.com/ggml-org/llama.cpp',
            }),
          ]),
        /buildEntityMentionPayload signals\[1\]\.digestSignalId requires a Convex-assigned digestSignalId/,
      );
    });

    it('uses digestSignalId from post-push signals in signalRefs', () => {
      const mentions = buildEntityMentionPayload(SAMPLE_RUN, [
        postPushSignal({
          digestSignalId: 'digestSignals:post-push-abc',
          sourceMetadata: { authorHandle: 'karpathy' },
        }),
      ]);
      assert.equal(mentions.length, 1);
      assert.equal(
        mentions[0].signalRefs[0].digestSignalId,
        'digestSignals:post-push-abc',
      );
    });
  });

  describe('buildEntityMentionPayload coverage (AC4)', () => {
    it('returns empty array for empty signals', () => {
      assert.deepEqual(buildEntityMentionPayload(SAMPLE_RUN, []), []);
    });

    it('extracts tracked person from peopleMatch', () => {
      const mentions = buildEntityMentionPayload(SAMPLE_RUN, [
        postPushSignal({
          digestSignalId: 'digestSignals:person-1',
          sourceType: 'newsapi',
          title: 'Interview',
          sourceMetadata: {
            peopleMatch: { personName: 'Andrej Karpathy', matchType: 'name' },
          },
        }),
      ]);
      const person = mentions.find((row) => row.entityType === 'person');
      assert.ok(person);
      assert.equal(person.entityKey, 'person:andrej karpathy');
      assert.equal(person.tracked, true);
      assert.equal(person.displayName, 'Andrej Karpathy');
    });

    it('extracts account from authorHandle', () => {
      const mentions = buildEntityMentionPayload(SAMPLE_RUN, [
        postPushSignal({
          digestSignalId: 'digestSignals:account-1',
          sourceMetadata: { authorHandle: '@openai' },
        }),
      ]);
      const account = mentions.find((row) => row.entityType === 'account');
      assert.ok(account);
      assert.equal(account.entityKey, 'account:twitter:openai');
      assert.equal(account.tracked, false);
    });

    it('extracts org from GitHub repo url', () => {
      const mentions = buildEntityMentionPayload(SAMPLE_RUN, [
        postPushSignal({
          digestSignalId: 'digestSignals:org-1',
          sourceType: 'github',
          title: 'llama.cpp',
          url: 'https://github.com/ggml-org/llama.cpp',
          sourceMetadata: { stars: 1000 },
        }),
      ]);
      const org = mentions.find((row) => row.entityType === 'org');
      assert.ok(org);
      assert.equal(org.entityKey, 'org:github:ggml-org');
    });

    it('produces multiple mention rows for multi-entity run', () => {
      const mentions = buildCanonicalEntityMentionPayload();
      assert.equal(mentions.length, 3);
      const keys = mentions.map((row) => row.entityKey).sort();
      assert.deepEqual(keys, [
        'account:twitter:karpathy',
        'org:github:ggml-org',
        'person:andrej karpathy',
      ]);
    });

    it('populates coMentionedTrackedEntities when two tracked people co-occur', () => {
      const mentions = buildEntityMentionPayload(SAMPLE_RUN, [
        postPushSignal({
          digestSignalId: 'digestSignals:tracked-a',
          sourceType: 'newsapi',
          title: 'A',
          sourceMetadata: {
            peopleMatch: { personName: 'Andrej Karpathy', matchType: 'name' },
          },
        }),
        postPushSignal({
          digestSignalId: 'digestSignals:tracked-b',
          sourceType: 'newsapi',
          title: 'B',
          sourceMetadata: {
            peopleMatch: { personName: 'Dario Amodei', matchType: 'name' },
          },
        }),
      ]);
      const karpathy = mentions.find((row) => row.entityKey === 'person:andrej karpathy');
      const dario = mentions.find((row) => row.entityKey === 'person:dario amodei');
      assert.deepEqual(karpathy?.coMentionedTrackedEntities, ['person:dario amodei']);
      assert.deepEqual(dario?.coMentionedTrackedEntities, ['person:andrej karpathy']);
    });

    it('caps signalRefs at five ordered by rankScore', () => {
      const signals = Array.from({ length: 7 }, (_, index) =>
        postPushSignal({
          digestSignalId: `digestSignals:cap-${index}`,
          title: `Tweet ${index}`,
          rankScore: index * 10,
          sourceMetadata: { authorHandle: 'karpathy' },
        }),
      );
      const mentions = buildEntityMentionPayload(SAMPLE_RUN, signals);
      const account = mentions.find((row) => row.entityKey === 'account:twitter:karpathy');
      assert.ok(account);
      assert.equal(account.signalRefs.length, 5);
      assert.deepEqual(
        account.signalRefs.map((ref) => ref.title),
        ['Tweet 6', 'Tweet 5', 'Tweet 4', 'Tweet 3', 'Tweet 2'],
      );
    });

    it('maps run metadata and workspaceId onto each row', () => {
      const mentions = buildEntityMentionPayload(
        { ...SAMPLE_RUN, workspaceId: 'ws-from-run' },
        [postPushSignal({ digestSignalId: 'digestSignals:ws-1' })],
      );
      assert.equal(mentions[0].digestRunId, SAMPLE_RUN.digestRunId);
      assert.equal(mentions[0].ranAt, SAMPLE_RUN.ranAt);
      assert.equal(mentions[0].date, SAMPLE_RUN.date);
      assert.equal(mentions[0].workspaceId, 'ws-from-run');
    });

    it('resolveWorkspaceId falls back to signal workspaceId', () => {
      assert.equal(
        resolveWorkspaceId(SAMPLE_RUN, [
          postPushSignal({ workspaceId: 'ws-from-signal' }),
        ]),
        'ws-from-signal',
      );
    });
  });

  describe('validator round-trip (AC2)', () => {
    it('canonical fixture row matches entityMentionInputValidator field keys', () => {
      const row = buildCanonicalEntityMentionRow();
      const keys = Object.keys(row).sort();
      for (const key of keys) {
        assert.ok(
          ENTITY_MENTION_ROW_KEYS.includes(key),
          `unexpected key ${key} — drift from entityMentionInputValidator`,
        );
      }
      for (const required of ENTITY_MENTION_REQUIRED_KEYS) {
        assert.ok(required in row, `missing required key ${required}`);
      }
    });

    it('canonical fixture signalRefs match entityMentionSignalRefValidator keys', () => {
      const row = buildCanonicalEntityMentionRow();
      for (const ref of row.signalRefs) {
        const refKeys = Object.keys(ref).sort();
        assert.ok(refKeys.every((key) => ENTITY_MENTION_SIGNAL_REF_KEYS.includes(key)));
        assert.ok(refKeys.includes('digestSignalId'));
        assert.ok(refKeys.includes('title'));
        assert.ok(refKeys.includes('sourceType'));
      }
    });

    it('local business-rule guard accepts canonical fixture', () => {
      assert.doesNotThrow(() => assertEntityMentionPayloadRow(buildCanonicalEntityMentionRow()));
    });

    it('cross-repo assertEntityMentionRow accepts canonical fixture (real validator bridge)', () => {
      assertEntityMentionRowViaDashboard(buildCanonicalEntityMentionRow());
    });

    it('cross-repo assertEntityMentionRow accepts every multi-entity payload row', () => {
      for (const row of buildCanonicalEntityMentionPayload()) {
        assertEntityMentionRowViaDashboard(row);
      }
    });

    it('cross-repo bridge rejects Convex field-schema malformed rows', () => {
      const base = buildCanonicalEntityMentionRow();
      assert.throws(
        () =>
          assertEntityMentionRowViaDashboard({
            ...base,
            sourceTypes: ['not_a_real_source'],
            signalRefs: base.signalRefs.map((ref) => ({
              ...ref,
              sourceType: 'not_a_real_source',
            })),
          }),
        /did not match any union member|not_a_real_source|sourceType/,
      );
    });

    it('rejects malformed payload rows locally (mirrors cns-dashboard 73-1 tests)', () => {
      const base = buildCanonicalEntityMentionRow();
      assert.throws(
        () => assertEntityMentionPayloadRow({ ...base, mentionCount: 0 }),
        /mentionCount must be finite and >= 1/,
      );
      assert.throws(
        () => assertEntityMentionPayloadRow({ ...base, signalRefs: [] }),
        /signalRefs length must be 1\.\.5/,
      );
      assert.throws(
        () =>
          assertEntityMentionPayloadRow({
            ...base,
            tracked: true,
            entityType: 'org',
          }),
        /tracked === true requires entityType === person/,
      );
    });

    it('canonical fixture stays aligned with buildEntityMentionPayload (anti-drift)', () => {
      const fromBuilder = buildCanonicalEntityMentionFixture();
      const fromFixture = buildCanonicalEntityMentionRow();
      assert.deepEqual(fromFixture, fromBuilder);
      assert.equal(fromFixture.entityKey, 'person:andrej karpathy');
      assert.equal(fromFixture.mentionCount, 1);
      assert.equal(fromFixture.signalRefs[0].digestSignalId, 'digestSignals:canonical-person');
    });

    it('documents full entityMentionInputValidator key contract', () => {
      assert.deepEqual([...ENTITY_MENTION_INPUT_KEYS].sort(), [...ENTITY_MENTION_ROW_KEYS].sort());
    });

    it('fails closed when CNS_DASHBOARD_ROOT cannot reach entityIntelligence.ts', () => {
      assert.throws(
        () =>
          withEnv({ CNS_DASHBOARD_ROOT: '/tmp' }, () =>
            assertEntityMentionRowViaDashboard(buildCanonicalEntityMentionRow()),
          ),
        /entityIntelligence\.ts missing/,
      );
    });

    it('fails closed when bridge process cannot spawn npx', () => {
      assert.throws(
        () =>
          withEnv({ PATH: '/nonexistent' }, () =>
            assertEntityMentionRowViaDashboard(buildCanonicalEntityMentionRow()),
          ),
        /spawnSync npx ENOENT/,
      );
    });
  });
});
