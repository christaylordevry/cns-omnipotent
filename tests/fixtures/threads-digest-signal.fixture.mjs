/**
 * SSOT for Threads → Convex push shape (Story 72-7).
 */

import { buildDigestPushPayload } from '../../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';

/** Mapped stdout post row (post mapThreadsPost), used by buildDigestPushPayload. */
export const CANONICAL_THREADS_POST = Object.freeze({
  title: 'What does it mean that the state of the art models continue to give this for the last 4 years as *the* joke.',
  url: 'https://www.threads.com/@karpathy/post/DV0De6jlB_v',
  authorHandle: 'karpathy',
  author: 'karpathy',
  publishedAt: '2026-03-13T02:04:55.000Z',
  likes: 215,
  reposts: 12,
  replies: 8,
  postCode: 'DV0De6jlB_v',
  postId: '3851718899906387951_63491345281',
});

const FIXTURE_BUILD_INPUT = Object.freeze({
  date: '2026-06-11',
  ranAt: 1_781_000_000_000,
  threads: { posts: [CANONICAL_THREADS_POST] },
  runMeta: { topTrend: 'AI model', focusKeyword: 'AI model' },
});

/**
 * Production §9 builder output for the canonical post — mutation-safe signal body.
 * @returns {ReturnType<typeof buildDigestPushPayload>['signals'][number]}
 */
export function buildCanonicalThreadsDigestSignal() {
  const payload = buildDigestPushPayload(FIXTURE_BUILD_INPUT);
  const signal = payload.signals.find((row) => row.sourceType === 'threads');
  if (!signal) {
    throw new Error('buildDigestPushPayload did not emit a threads signal');
  }
  return signal;
}

/** Validator-bound metadata keys only — guards against postCode/postId drift. */
export const THREADS_VALIDATOR_METADATA_KEYS = Object.freeze([
  'likes',
  'reposts',
  'replies',
  'authorHandle',
  'author',
  'publishedAt',
]);
