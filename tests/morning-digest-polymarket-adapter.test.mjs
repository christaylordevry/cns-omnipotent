import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  computeLeadingOutcome,
  dedupeAndFilterMarkets,
  fetchByTagSlug,
  isPolymarketEnabled,
  loadPolymarketConfig,
  mapMarketItem,
  marketDedupeKey,
  parseJsonStringArray,
  parseMarketsListResponse,
  parseOutcomePrices,
  parsePublicSearchResponse,
  runPolymarketFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-polymarket-signals.mjs';
import { buildDigestPushPayload } from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';
import {
  buildCanonicalPolymarketDigestSignal,
  CANONICAL_POLYMARKET_MARKET,
  POLYMARKET_VALIDATOR_METADATA_KEYS,
} from './fixtures/polymarket-digest-signal.fixture.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-polymarket-signals.mjs',
);

const FIXTURE_MARKET_RAW = {
  id: '631139',
  question: 'Will Google have the best AI model at the end of June 2026?',
  conditionId: '0x0bd1b836a2494f80aaee62927cf01e5f6fceb19114e96fc517c6440aea4576e4',
  slug: 'will-google-have-the-best-ai-model-at-the-end-of-june-2026',
  outcomes: '["Yes", "No"]',
  outcomePrices: '["0.42", "0.58"]',
  volumeNum: 15988722.19,
  volume24hr: 300444.42,
  liquidityNum: 70032.71,
  endDate: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-20T03:53:39.319Z',
  active: true,
  closed: false,
};

const FIXTURE_SEARCH = {
  events: [
    {
      id: '57705',
      markets: [FIXTURE_MARKET_RAW],
    },
  ],
};

const FIXTURE_DUPES = {
  events: [
    {
      markets: [
        FIXTURE_MARKET_RAW,
        {
          ...FIXTURE_MARKET_RAW,
          question: 'Duplicate market question',
        },
        {
          id: '999',
          question: 'Second unique market',
          conditionId: '0xabc',
          slug: 'second-unique-market',
          outcomes: '["Yes", "No"]',
          outcomePrices: '["0.6", "0.4"]',
          volume24hr: 1000,
          active: true,
          closed: false,
        },
      ],
    },
  ],
};

describe('fetch-polymarket-signals.mjs parsing', () => {
  it('parses JSON string outcomes and outcomePrices', () => {
    assert.deepEqual(parseJsonStringArray('["Yes", "No"]'), ['Yes', 'No']);
    assert.deepEqual(parseOutcomePrices('["0.42", "0.58"]'), [0.42, 0.58]);
  });

  it('computes leading outcome from parsed prices', () => {
    assert.deepEqual(computeLeadingOutcome(['Yes', 'No'], [0.42, 0.58]), {
      leadingOutcome: 'No',
      leadingProbability: 0.58,
    });
  });

  it('maps API market item to stdout shape', () => {
    const mapped = mapMarketItem(FIXTURE_MARKET_RAW);
    assert.equal(mapped?.question, CANONICAL_POLYMARKET_MARKET.question);
    assert.equal(mapped?.leadingOutcome, 'No');
    assert.equal(mapped?.leadingProbability, 0.58);
    assert.equal(mapped?.volume24hrUsd, 300444.42);
    assert.equal(
      mapped?.url,
      'https://polymarket.com/market/will-google-have-the-best-ai-model-at-the-end-of-june-2026',
    );
  });

  it('filters closed and inactive markets', () => {
    assert.equal(mapMarketItem({ ...FIXTURE_MARKET_RAW, closed: true }), null);
    assert.equal(mapMarketItem({ ...FIXTURE_MARKET_RAW, active: false }), null);
  });

  it('marketDedupeKey uses conditionId', () => {
    assert.equal(
      marketDedupeKey({ conditionId: FIXTURE_MARKET_RAW.conditionId }),
      `pm:${FIXTURE_MARKET_RAW.conditionId}`,
    );
  });

  it('dedupeAndFilterMarkets removes duplicate conditionIds', () => {
    const parsed = parsePublicSearchResponse(FIXTURE_DUPES, 10);
    const deduped = dedupeAndFilterMarkets(parsed, 10, 0);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].question, CANONICAL_POLYMARKET_MARKET.question);
  });

  it('parsePublicSearchResponse handles empty search response', () => {
    const markets = parsePublicSearchResponse({ events: [] }, 5);
    assert.deepEqual(markets, []);
  });

  it('parseMarketsListResponse maps tag /markets array through same stdout shape', () => {
    const fromTag = parseMarketsListResponse([FIXTURE_MARKET_RAW], 5);
    assert.equal(fromTag.length, 1);
    const fromKeyword = parsePublicSearchResponse(FIXTURE_SEARCH, 5);
    assert.equal(fromKeyword.length, 1);
    assert.deepEqual(Object.keys(fromTag[0]).sort(), Object.keys(fromKeyword[0]).sort());
    assert.deepEqual(fromTag[0], fromKeyword[0]);
  });

  it('keyword and tag paths produce identical buildDigestPushPayload signals', () => {
    const keywordMapped = parsePublicSearchResponse(FIXTURE_SEARCH, 5)[0];
    const tagMapped = parseMarketsListResponse([FIXTURE_MARKET_RAW], 5)[0];
    const keywordPayload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      polymarket: { markets: [keywordMapped] },
      runMeta: { topTrend: 'AI' },
    });
    const tagPayload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      polymarket: { markets: [tagMapped] },
      runMeta: { topTrend: 'AI' },
    });
    const keywordSignal = keywordPayload.signals.find((row) => row.sourceType === 'polymarket');
    const tagSignal = tagPayload.signals.find((row) => row.sourceType === 'polymarket');
    assert.ok(keywordSignal && tagSignal);
    assert.deepEqual(
      Object.keys(keywordSignal.sourceMetadata ?? {}).sort(),
      Object.keys(tagSignal.sourceMetadata ?? {}).sort(),
    );
    assert.equal(keywordSignal.title, tagSignal.title);
    assert.equal(keywordSignal.externalId, tagSignal.externalId);
  });

  it('dedupeAndFilterMarkets enforces minVolume24hr on missing volume24hrUsd', () => {
    const lowVol = mapMarketItem({
      ...FIXTURE_MARKET_RAW,
      volume24hr: 50,
      id: 'low-vol',
      conditionId: '0xlow',
      slug: 'low-vol-market',
    });
    const highVol = mapMarketItem({
      ...FIXTURE_MARKET_RAW,
      volume24hr: 5000,
      id: 'high-vol',
      conditionId: '0xhigh',
      slug: 'high-vol-market',
    });
    const filtered = dedupeAndFilterMarkets([lowVol, highVol], 10, 1000);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].marketId, 'high-vol');
  });
});

describe('fetch-polymarket-signals.mjs runPolymarketFetch', () => {
  it('returns markets from keyword fixtures without network', async () => {
    const payload = await runPolymarketFetch(
      {
        MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI model',
      },
      { fixtureSearchByKeyword: { 'AI model': FIXTURE_SEARCH } },
    );
    assert.ok(Array.isArray(payload.markets));
    assert.equal(payload.markets.length, 1);
    assert.equal(payload.markets[0].leadingOutcome, 'No');
  });

  it('returns markets from tag-only watchlist without keywords', async () => {
    const payload = await runPolymarketFetch(
      { MORNING_DIGEST_POLYMARKET_TAG_SLUGS: 'crypto' },
      {
        fixtureMarketsByTag: {
          crypto: [FIXTURE_MARKET_RAW],
        },
      },
    );
    assert.ok(Array.isArray(payload.markets));
    assert.equal(payload.markets.length, 1);
    assert.equal(payload.markets[0].leadingOutcome, 'No');
  });

  it('dedupes same conditionId across keyword search and tag fetch', async () => {
    const payload = await runPolymarketFetch(
      {
        MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI',
        MORNING_DIGEST_POLYMARKET_TAG_SLUGS: 'crypto',
      },
      {
        fixtureSearchByKeyword: { AI: FIXTURE_SEARCH },
        fixtureMarketsByTag: {
          crypto: [
            {
              ...FIXTURE_MARKET_RAW,
              question: 'Duplicate from tag path',
            },
          ],
        },
      },
    );
    assert.equal(payload.markets?.length, 1);
    assert.equal(payload.markets[0].conditionId, FIXTURE_MARKET_RAW.conditionId);
  });

  it('keyword watchlist runs before optional tag slugs', async () => {
    const calls = [];
    const payload = await runPolymarketFetch(
      {
        MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI',
        MORNING_DIGEST_POLYMARKET_TAG_SLUGS: 'crypto',
      },
      {
        fixtureSearchByKeyword: { AI: FIXTURE_SEARCH },
        fixtureMarketsByTag: {
          crypto: [
            {
              id: 'tag-1',
              question: 'Tag market',
              conditionId: '0xtag',
              slug: 'tag-market',
              outcomes: '["Yes", "No"]',
              outcomePrices: '["0.5", "0.5"]',
              volume24hr: 5000,
              active: true,
              closed: false,
            },
          ],
        },
        fetch: async (url) => {
          calls.push(url);
          return { ok: true, json: async () => [] };
        },
      },
    );
    assert.equal(payload.markets?.length, 2);
    assert.equal(calls.length, 0);
  });

  it('returns polymarket disabled when enabled flag is false', async () => {
    const payload = await runPolymarketFetch({
      MORNING_DIGEST_POLYMARKET_ENABLED: 'false',
      MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI',
    });
    assert.deepEqual(payload, { error: 'polymarket disabled' });
  });

  it('returns missing-watchlist when no keywords or tag slugs configured', async () => {
    const payload = await runPolymarketFetch({});
    assert.deepEqual(payload, { error: 'missing-watchlist' });
  });

  it('returns empty markets array when search returns empty (still success)', async () => {
    const payload = await runPolymarketFetch(
      { MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI' },
      { fixtureSearchByKeyword: { AI: { events: [] } } },
    );
    assert.deepEqual(payload, { markets: [] });
  });

  it('retries on 429 and eventually succeeds', async () => {
    let attempts = 0;
    const payload = await runPolymarketFetch(
      { MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI' },
      {
        fetch: async () => {
          attempts += 1;
          if (attempts < 2) {
            return { ok: false, status: 429, json: async () => ({}) };
          }
          return { ok: true, status: 200, json: async () => FIXTURE_SEARCH };
        },
      },
    );
    assert.equal(attempts, 2);
    assert.equal(payload.markets?.length, 1);
  });

  it('retries on 5xx and eventually succeeds', async () => {
    let attempts = 0;
    const payload = await runPolymarketFetch(
      { MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI' },
      {
        fetch: async () => {
          attempts += 1;
          if (attempts < 2) {
            return { ok: false, status: 503, json: async () => ({}) };
          }
          return { ok: true, status: 200, json: async () => FIXTURE_SEARCH };
        },
      },
    );
    assert.equal(attempts, 2);
    assert.equal(payload.markets?.length, 1);
  });

  it('surfaces http-429 on stdout when all watchlist fetches fail', async () => {
    const payload = await runPolymarketFetch(
      { MORNING_DIGEST_POLYMARKET_KEYWORDS: 'AI' },
      {
        fetch: async () => ({ ok: false, status: 429, json: async () => ({}) }),
      },
    );
    assert.deepEqual(payload, { error: 'http-429' });
  });

  it('fetchByTagSlug uses parseMarketsListResponse for flat array fixtures', async () => {
    const result = await fetchByTagSlug('crypto', 5, globalThis.fetch, [FIXTURE_MARKET_RAW]);
    assert.ok(result.ok);
    assert.equal(result.markets.length, 1);
    assert.equal(result.markets[0].question, CANONICAL_POLYMARKET_MARKET.question);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_POLYMARKET_ENABLED: 'false',
      },
    });
    assert.deepEqual(JSON.parse(stdout.trim()), { error: 'polymarket disabled' });
  });

  it('normalizeEngagement round-trip for polymarket via volume24hr → upvotes', () => {
    const signal = buildCanonicalPolymarketDigestSignal();
    const score = normalizeEngagement({
      title: signal.title,
      sourceType: 'polymarket',
      sourceMetadata: signal.sourceMetadata,
    });
    assert.ok(typeof score === 'number' && score > 0);
  });

  it('canonical fixture metadata keys stay validator-bound', () => {
    const signal = buildCanonicalPolymarketDigestSignal();
    assert.deepEqual(
      Object.keys(signal.sourceMetadata ?? {}).sort(),
      [...POLYMARKET_VALIDATOR_METADATA_KEYS].sort(),
    );
  });

  it('isPolymarketEnabled defaults to enabled', () => {
    assert.equal(isPolymarketEnabled(undefined), true);
    assert.equal(loadPolymarketConfig({}).enabled, true);
  });
});
