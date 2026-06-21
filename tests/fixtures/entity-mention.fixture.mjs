/**
 * SSOT for entityMentions → Convex push shape (Story 73-3).
 *
 * Same anti-drift discipline as pinterest-digest-signal.fixture.mjs: tests import this
 * module and round-trip through the real buildEntityMentionPayload() builder.
 */

import {
  buildCanonicalEntityMentionFixture,
  buildEntityMentionPayload,
  CANONICAL_ENTITY_MENTION_RUN,
  CANONICAL_FIXTURE_SIGNALS,
} from '../../scripts/hermes-skill-examples/morning-digest/scripts/build-entity-mention-payload.mjs';

export { CANONICAL_ENTITY_MENTION_RUN, CANONICAL_FIXTURE_SIGNALS };

/**
 * Tracked person row from production builder — mutation-safe mention body.
 * @returns {ReturnType<typeof buildEntityMentionPayload>[number]}
 */
export function buildCanonicalEntityMentionRow() {
  return buildCanonicalEntityMentionFixture();
}

/**
 * Full multi-entity mention set for integration-style tests.
 * @returns {ReturnType<typeof buildEntityMentionPayload>}
 */
export function buildCanonicalEntityMentionPayload() {
  return buildEntityMentionPayload(CANONICAL_ENTITY_MENTION_RUN, CANONICAL_FIXTURE_SIGNALS);
}

/** Validator-bound top-level keys for a canonical mention row. */
export const ENTITY_MENTION_ROW_KEYS = Object.freeze([
  'digestRunId',
  'ranAt',
  'date',
  'entityKey',
  'entityType',
  'displayName',
  'platform',
  'tracked',
  'mentionCount',
  'distinctSignalCount',
  'sourceTypes',
  'maxPersonalRelevance',
  'maxRankScore',
  'coMentionedTrackedEntities',
  'signalRefs',
  'workspaceId',
]);

/** signalRefs element keys per entityMentionSignalRefValidator. */
export const ENTITY_MENTION_SIGNAL_REF_KEYS = Object.freeze([
  'digestSignalId',
  'title',
  'url',
  'sourceType',
]);
