/**
 * Epic 73 — canonical entityMentions payload builder (ADR-E73-007).
 * Post-push only: signals must carry Convex-assigned digestSignalId before aggregation.
 */

import { aggregateRunEntities } from './extract-entities.mjs';

/**
 * @param {Record<string, unknown>} opts
 * @returns {Record<string, unknown>}
 */
function omitUndefinedKeys(opts) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(opts)) {
    if (value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * @param {unknown} workspaceId
 * @returns {string | undefined}
 */
function normalizeWorkspaceId(workspaceId) {
  const normalized = String(workspaceId ?? '').trim();
  return normalized || undefined;
}

/**
 * Resolve workspaceId from run metadata or pushed signals (first match wins).
 *
 * @param {Record<string, unknown>} run
 * @param {Array<Record<string, unknown>>} signals
 * @returns {string | undefined}
 */
export function resolveWorkspaceId(run, signals) {
  const fromRun = normalizeWorkspaceId(run.workspaceId);
  if (fromRun) {
    return fromRun;
  }
  for (const signal of signals) {
    const fromSignal = normalizeWorkspaceId(signal.workspaceId);
    if (fromSignal) {
      return fromSignal;
    }
  }
  return undefined;
}

/**
 * @param {Array<Record<string, unknown>>} signals
 */
function assertPostPushSignalIds(signals) {
  for (const [index, signal] of signals.entries()) {
    const digestSignalId = String(signal?.digestSignalId ?? '').trim();
    if (!digestSignalId) {
      throw new Error(
        `buildEntityMentionPayload signals[${index}].digestSignalId requires a Convex-assigned digestSignalId`,
      );
    }
  }
}

/**
 * Architecture §3.1 business rules — mirror cns-dashboard assertEntityMentionRow.
 *
 * @param {Record<string, unknown>} row
 */
export function assertEntityMentionPayloadRow(row) {
  const mentionCount = row.mentionCount;
  if (typeof mentionCount !== 'number' || !Number.isFinite(mentionCount) || mentionCount < 1) {
    throw new Error('mentionCount must be finite and >= 1');
  }

  const distinctSignalCount = row.distinctSignalCount;
  if (
    typeof distinctSignalCount !== 'number' ||
    !Number.isFinite(distinctSignalCount) ||
    distinctSignalCount < 1
  ) {
    throw new Error('distinctSignalCount must be finite and >= 1');
  }
  if (distinctSignalCount > mentionCount) {
    throw new Error('distinctSignalCount must be <= mentionCount');
  }

  const sourceTypes = row.sourceTypes;
  if (!Array.isArray(sourceTypes) || sourceTypes.length === 0) {
    throw new Error('sourceTypes must be non-empty');
  }

  const signalRefs = row.signalRefs;
  if (!Array.isArray(signalRefs) || signalRefs.length < 1 || signalRefs.length > 5) {
    throw new Error('signalRefs length must be 1..5');
  }

  const maxPersonalRelevance = row.maxPersonalRelevance;
  if (maxPersonalRelevance != null) {
    if (
      typeof maxPersonalRelevance !== 'number' ||
      !Number.isFinite(maxPersonalRelevance) ||
      maxPersonalRelevance < 0 ||
      maxPersonalRelevance > 100
    ) {
      throw new Error('maxPersonalRelevance must be 0..100');
    }
  }

  const maxRankScore = row.maxRankScore;
  if (maxRankScore != null) {
    if (
      typeof maxRankScore !== 'number' ||
      !Number.isFinite(maxRankScore) ||
      maxRankScore < 0 ||
      maxRankScore > 100
    ) {
      throw new Error('maxRankScore must be 0..100');
    }
  }

  if (row.tracked === true && row.entityType !== 'person') {
    throw new Error('tracked === true requires entityType === person in v1');
  }
}

/**
 * @param {{
 *   digestRunId: string,
 *   ranAt: number,
 *   date: string,
 *   workspaceId?: string,
 * }} run
 * @param {import('./extract-entities.mjs').RunEntityAggregate} aggregate
 * @param {string | undefined} workspaceId
 * @returns {Record<string, unknown>}
 */
function mapAggregateToMentionRow(run, aggregate, workspaceId) {
  const coMentioned =
    Array.isArray(aggregate.coMentionedTrackedEntities) &&
    aggregate.coMentionedTrackedEntities.length > 0
      ? aggregate.coMentionedTrackedEntities
      : undefined;

  const row = omitUndefinedKeys({
    digestRunId: run.digestRunId,
    ranAt: run.ranAt,
    date: run.date,
    entityKey: aggregate.entityKey,
    entityType: aggregate.entityType,
    displayName: aggregate.displayName,
    platform: aggregate.platform,
    tracked: aggregate.tracked,
    mentionCount: aggregate.mentionCount,
    distinctSignalCount: aggregate.distinctSignalCount,
    sourceTypes: aggregate.sourceTypes,
    maxPersonalRelevance: aggregate.maxPersonalRelevance,
    maxRankScore: aggregate.maxRankScore,
    coMentionedTrackedEntities: coMentioned,
    signalRefs: aggregate.signalRefs,
    workspaceId,
  });

  assertEntityMentionPayloadRow(row);
  return row;
}

/**
 * Build entityMentions mutation rows from a post-push run + signals.
 * Call only after addDigestSignal assigns digestSignalId to each signal (ADR-E73-001, §4.3).
 *
 * @param {{
 *   digestRunId: string,
 *   ranAt: number,
 *   date: string,
 *   workspaceId?: string,
 * }} run
 * @param {Array<Record<string, unknown>>} signals — post-push; each requires digestSignalId
 * @returns {Array<Record<string, unknown>>}
 */
export function buildEntityMentionPayload(run, signals) {
  if (!Array.isArray(signals)) {
    throw new Error('buildEntityMentionPayload requires signals array');
  }
  if (signals.length === 0) {
    return [];
  }

  const digestRunId = String(run?.digestRunId ?? '').trim();
  if (!digestRunId) {
    throw new Error('buildEntityMentionPayload requires run.digestRunId');
  }
  if (typeof run?.ranAt !== 'number' || !Number.isFinite(run.ranAt)) {
    throw new Error('buildEntityMentionPayload requires finite run.ranAt');
  }
  const date = String(run?.date ?? '').trim();
  if (!date) {
    throw new Error('buildEntityMentionPayload requires run.date');
  }

  assertPostPushSignalIds(signals);
  const workspaceId = resolveWorkspaceId(run, signals);
  const aggregates = aggregateRunEntities(signals);

  return Object.values(aggregates)
    .sort((a, b) => a.entityKey.localeCompare(b.entityKey))
    .map((aggregate) => mapAggregateToMentionRow(run, aggregate, workspaceId));
}

/** Post-push signals for canonical fixture — mirrors multi-entity extract-entities coverage. */
const CANONICAL_FIXTURE_SIGNALS = Object.freeze([
  {
    digestSignalId: 'digestSignals:canonical-person',
    sourceType: 'bluesky',
    title: 'Karpathy on scaling',
    url: 'https://bsky.app/profile/karpathy/post/1',
    rankScore: 90,
    scores: { personalRelevance: 80 },
    sourceMetadata: {
      authorHandle: 'karpathy.bsky.social',
      peopleMatch: { personName: 'Andrej Karpathy', matchType: 'handle' },
    },
  },
  {
    digestSignalId: 'digestSignals:canonical-twitter',
    sourceType: 'twitter',
    title: 'Tweet from karpathy',
    url: 'https://x.com/karpathy/status/1',
    rankScore: 70,
    scores: { personalRelevance: 55 },
    sourceMetadata: { authorHandle: 'karpathy' },
  },
  {
    digestSignalId: 'digestSignals:canonical-github',
    sourceType: 'github',
    title: 'llama.cpp',
    url: 'https://github.com/ggml-org/llama.cpp',
    rankScore: 60,
    scores: { personalRelevance: 40 },
    sourceMetadata: { stars: 50_000 },
  },
]);

/** Run metadata paired with CANONICAL_FIXTURE_SIGNALS. */
export const CANONICAL_ENTITY_MENTION_RUN = Object.freeze({
  digestRunId: 'digestRuns:canonical-run',
  ranAt: 1_749_657_600_000,
  date: '2026-06-11',
  workspaceId: 'workspace-canonical',
});

/**
 * Minimal canonical entityMention row for cross-repo validator tests (ADR-E73-007).
 * Uses the real buildEntityMentionPayload() — not a hand-rolled test double.
 *
 * @returns {Record<string, unknown>}
 */
export function buildCanonicalEntityMentionFixture() {
  const mentions = buildEntityMentionPayload(
    CANONICAL_ENTITY_MENTION_RUN,
    CANONICAL_FIXTURE_SIGNALS,
  );
  const person = mentions.find((row) => row.entityKey === 'person:andrej karpathy');
  if (!person) {
    throw new Error('canonical fixture did not produce tracked person row');
  }
  return person;
}

/** Exported for fixture module round-trip tests. */
export { CANONICAL_FIXTURE_SIGNALS };
