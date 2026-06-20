/**
 * SSOT for LinkedIn → Convex push shape (Story 72-8).
 */

import { buildDigestPushPayload } from '../../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';

/** Mapped stdout post row, used by buildDigestPushPayload. */
export const CANONICAL_LINKEDIN_POST = Object.freeze({
  title:
    'More than 230 million people ask ChatGPT health and wellness questions every week.',
  url: 'https://www.linkedin.com/posts/openai_improving-health-intelligence-in-chatgpt-activity-7473441251686752257-cfCj',
  authorHandle: 'openai',
  author: 'openai',
  publishedAt: '2026-06-18T18:27:24.206Z',
  likes: 420,
  commentCount: 38,
  postId: '7473441251686752257',
});

const FIXTURE_BUILD_INPUT = Object.freeze({
  date: '2026-06-11',
  ranAt: 1_781_000_000_000,
  linkedin: { posts: [CANONICAL_LINKEDIN_POST] },
  runMeta: { topTrend: 'AI agents', focusKeyword: 'AI agents' },
});

/**
 * Production §9 builder output for the canonical post — mutation-safe signal body.
 * @returns {ReturnType<typeof buildDigestPushPayload>['signals'][number]}
 */
export function buildCanonicalLinkedinDigestSignal() {
  const payload = buildDigestPushPayload(FIXTURE_BUILD_INPUT);
  const signal = payload.signals.find((row) => row.sourceType === 'linkedin');
  if (!signal) {
    throw new Error('buildDigestPushPayload did not emit a linkedin signal');
  }
  return signal;
}

/** Validator-bound metadata keys only — guards against postId/sourceKind drift. */
export const LINKEDIN_VALIDATOR_METADATA_KEYS = Object.freeze([
  'likes',
  'commentCount',
  'authorHandle',
  'author',
  'publishedAt',
]);
