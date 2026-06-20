/**
 * SSOT for Polymarket → Convex push shape (Story 72-6).
 *
 * Same bug class as 2026-06-20 viewCount/contributor drift: adapter stdout,
 * §9 builder, and digest:addDigestSignal must stay aligned.
 */

import { buildDigestPushPayload } from '../../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';

/** Mapped stdout market row (post mapMarketItem), used by buildDigestPushPayload. */
export const CANONICAL_POLYMARKET_MARKET = Object.freeze({
  question: 'Will Google have the best AI model at the end of June 2026?',
  url: 'https://polymarket.com/market/will-google-have-the-best-ai-model-at-the-end-of-june-2026',
  marketId: '631139',
  conditionId: '0x0bd1b836a2494f80aaee62927cf01e5f6fceb19114e96fc517c6440aea4576e4',
  slug: 'will-google-have-the-best-ai-model-at-the-end-of-june-2026',
  outcomes: ['Yes', 'No'],
  outcomePrices: [0.42, 0.58],
  leadingOutcome: 'No',
  leadingProbability: 0.58,
  volumeUsd: 15988722.19,
  volume24hrUsd: 300444.42,
  liquidityUsd: 70032.71,
  endDate: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-20T03:53:39.319Z',
});

const FIXTURE_BUILD_INPUT = Object.freeze({
  date: '2026-06-11',
  ranAt: 1_781_000_000_000,
  polymarket: { markets: [CANONICAL_POLYMARKET_MARKET] },
  runMeta: { topTrend: 'AI model', focusKeyword: 'AI model' },
});

/**
 * Production §9 builder output for the canonical market — mutation-safe signal body
 * (no digestRunId; caller supplies rank/digestRunId).
 * @returns {ReturnType<typeof buildDigestPushPayload>['signals'][number]}
 */
export function buildCanonicalPolymarketDigestSignal() {
  const payload = buildDigestPushPayload(FIXTURE_BUILD_INPUT);
  const signal = payload.signals.find((row) => row.sourceType === 'polymarket');
  if (!signal) {
    throw new Error('buildDigestPushPayload did not emit a polymarket signal');
  }
  return signal;
}

/** Validator-bound metadata keys only — guards against conditionId/slug drift. */
export const POLYMARKET_VALIDATOR_METADATA_KEYS = Object.freeze([
  'outcomes',
  'outcomePrices',
  'leadingOutcome',
  'leadingProbability',
  'volumeUsd',
  'upvotes',
  'liquidityUsd',
  'publishedAt',
]);
