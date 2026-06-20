/**
 * SSOT for Pinterest → Convex push shape (Story 72-5).
 *
 * Same bug class as 2026-06-20 viewCount/contributingSources drift: adapter stdout,
 * §9 builder, and digest:addDigestSignal must stay aligned. Tests import this
 * module — do not hand-roll parallel fixtures in digest.test.ts or adapter tests.
 */

import { buildDigestPushPayload } from '../../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';

/** Mapped stdout pin row (post mapPinItem), used by buildDigestPushPayload. */
export const CANONICAL_PINTEREST_PIN = Object.freeze({
  title: 'AI agents home office setup',
  description: 'Inspiration for MCP server workflows',
  url: 'https://www.pinterest.com/pin/123456789/',
  link: 'https://example.com/article',
  imageUrl: 'https://i.pinimg.com/originals/example.jpg',
  author: 'aitech',
  pinId: '123456789',
  repinCount: 4200,
  publishedAt: '2026-06-18T10:00:00.000Z',
});

const FIXTURE_BUILD_INPUT = Object.freeze({
  date: '2026-06-11',
  ranAt: 1_781_000_000_000,
  pinterest: { pins: [CANONICAL_PINTEREST_PIN] },
  runMeta: { topTrend: 'AI agents', focusKeyword: 'AI agents' },
});

/**
 * Production §9 builder output for the canonical pin — mutation-safe signal body
 * (no digestRunId; caller supplies rank/digestRunId).
 * @returns {ReturnType<typeof buildDigestPushPayload>['signals'][number]}
 */
export function buildCanonicalPinterestDigestSignal() {
  const payload = buildDigestPushPayload(FIXTURE_BUILD_INPUT);
  const signal = payload.signals.find((row) => row.sourceType === 'pinterest');
  if (!signal) {
    throw new Error('buildDigestPushPayload did not emit a pinterest signal');
  }
  return signal;
}

/** Validator-bound metadata keys only — guards against repinCount/imageUrl drift. */
export const PINTEREST_VALIDATOR_METADATA_KEYS = Object.freeze([
  'upvotes',
  'author',
  'publishedAt',
]);
