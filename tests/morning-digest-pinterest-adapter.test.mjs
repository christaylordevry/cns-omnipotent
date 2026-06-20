import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  dedupeAndFilterPins,
  isPinterestEnabled,
  loadPinterestConfig,
  mapPinItem,
  parsePinterestKeywords,
  parseSearchResponse,
  pinDedupeKey,
  runPinterestFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-pinterest-signals.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';
import {
  buildCanonicalPinterestDigestSignal,
  CANONICAL_PINTEREST_PIN,
} from './fixtures/pinterest-digest-signal.fixture.mjs';

/** @deprecated Use buildCanonicalPinterestDigestSignal() — kept for importers during 72-5. */
export function pinterestPinToDigestSignal(pin, rank) {
  const built = buildCanonicalPinterestDigestSignal();
  if (pin !== CANONICAL_PINTEREST_PIN) {
    throw new Error('pinterestPinToDigestSignal only supports CANONICAL_PINTEREST_PIN; use buildDigestPushPayload for other pins');
  }
  return { ...built, rank };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-pinterest-signals.mjs',
);

const FIXTURE_SEARCH = {
  pins: [
    {
      id: '123456789',
      title: 'AI agents home office setup',
      description: 'Inspiration for MCP server workflows',
      repin_count: 4200,
      pinner: { username: 'aitech' },
      link: 'https://example.com/article',
      created_at: '2026-06-18T10:00:00.000Z',
    },
  ],
};

const FIXTURE_DUPES = {
  pins: [
    {
      id: '111',
      title: 'Pin one',
      repin_count: 900,
      pinner: { username: 'creator1' },
    },
    {
      id: '111',
      title: 'Pin one duplicate',
      repin_count: 800,
      pinner: { username: 'creator1' },
    },
    {
      id: '222',
      title: 'Pin two',
      repin_count: 700,
      pinner: { username: 'creator2' },
    },
  ],
};

describe('fetch-pinterest-signals.mjs parsing', () => {
  it('maps search item to stdout pin shape', () => {
    const mapped = mapPinItem(FIXTURE_SEARCH.pins[0]);
    assert.equal(mapped?.title, 'AI agents home office setup');
    assert.equal(mapped?.url, 'https://www.pinterest.com/pin/123456789/');
    assert.equal(mapped?.repinCount, 4200);
    assert.equal(mapped?.author, 'aitech');
    assert.equal(mapped?.pinId, '123456789');
  });

  it('coerces string repin counts', () => {
    const mapped = mapPinItem({ id: '1', title: 'Test', repin_count: '1500' });
    assert.equal(mapped?.repinCount, 1500);
  });

  it('pinDedupeKey uses pinId', () => {
    assert.equal(pinDedupeKey({ pinId: '123456789' }), 'pin:123456789');
  });

  it('dedupeAndFilterPins removes duplicate pin ids across keywords', () => {
    const parsed = parseSearchResponse(FIXTURE_DUPES, 10);
    const deduped = dedupeAndFilterPins(parsed, 10, 24 * 365);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].title, 'Pin one');
  });

  it('parseSearchResponse handles empty search response', () => {
    const pins = parseSearchResponse({ pins: [] }, 5);
    assert.deepEqual(pins, []);
  });

  it('parsePinterestKeywords splits comma-separated queries', () => {
    assert.deepEqual(parsePinterestKeywords('ai agents, home office'), [
      'ai agents',
      'home office',
    ]);
  });
});

describe('fetch-pinterest-signals.mjs runPinterestFetch', () => {
  it('returns pins from keyword fixtures without network', async () => {
    const payload = await runPinterestFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_PINTEREST_KEYWORDS: 'ai agents',
      },
      { fixtureKeywordByQuery: { 'ai agents': FIXTURE_SEARCH }, now: new Date('2026-06-20T12:00:00Z') },
    );
    assert.ok(Array.isArray(payload.pins));
    assert.equal(payload.pins.length, 1);
    assert.equal(payload.pins[0].repinCount, 4200);
  });

  it('dedupes duplicate pin ids across keywords', async () => {
    const payload = await runPinterestFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_PINTEREST_KEYWORDS: 'ai,agents',
        MORNING_DIGEST_PINTEREST_LOOKBACK_HOURS: '8760',
      },
      {
        fixtureKeywordByQuery: {
          ai: FIXTURE_DUPES,
          agents: FIXTURE_DUPES,
        },
        now: new Date('2026-06-20T12:00:00Z'),
      },
    );
    assert.equal(payload.pins?.length, 2);
  });

  it('returns pinterest disabled when enabled flag is false', async () => {
    const payload = await runPinterestFetch({
      MORNING_DIGEST_PINTEREST_ENABLED: 'false',
      SCRAPECREATORS_API_KEY: 'test-key',
      MORNING_DIGEST_PINTEREST_KEYWORDS: 'ai',
    });
    assert.deepEqual(payload, { error: 'pinterest disabled' });
  });

  it('returns missing-api-key when enabled but key unset', async () => {
    const payload = await runPinterestFetch({
      MORNING_DIGEST_PINTEREST_KEYWORDS: 'ai',
    });
    assert.deepEqual(payload, { error: 'missing-api-key' });
  });

  it('returns missing-keywords when no keywords configured', async () => {
    const payload = await runPinterestFetch({
      SCRAPECREATORS_API_KEY: 'test-key',
    });
    assert.deepEqual(payload, { error: 'missing-keywords' });
  });

  it('returns empty pins array when search returns empty (still success)', async () => {
    const payload = await runPinterestFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_PINTEREST_KEYWORDS: 'ai',
      },
      { fixtureKeywordByQuery: { ai: { pins: [] } } },
    );
    assert.deepEqual(payload, { pins: [] });
  });

  it('returns credit-exhausted on fatal 402 fixture path', async () => {
    const payload = await runPinterestFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_PINTEREST_KEYWORDS: 'ai',
      },
      {
        fetch: async () => ({
          ok: false,
          status: 402,
          json: async () => ({ message: 'credit exhausted' }),
        }),
      },
    );
    assert.deepEqual(payload, { error: 'credit-exhausted' });
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_PINTEREST_ENABLED: 'false',
      },
    });
    assert.deepEqual(JSON.parse(stdout.trim()), { error: 'pinterest disabled' });
  });

  it('normalizeEngagement round-trip for pinterest sourceType via upvotes', async () => {
    const payload = await runPinterestFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_PINTEREST_KEYWORDS: 'ai agents',
        MORNING_DIGEST_PINTEREST_LOOKBACK_HOURS: '8760',
      },
      { fixtureKeywordByQuery: { 'ai agents': FIXTURE_SEARCH }, now: new Date('2026-06-20T12:00:00Z') },
    );
    const pin = payload.pins?.[0];
    assert.ok(pin);
    assert.deepEqual(
      {
        title: pin.title,
        repinCount: pin.repinCount,
        author: pin.author,
        pinId: pin.pinId,
      },
      {
        title: CANONICAL_PINTEREST_PIN.title,
        repinCount: CANONICAL_PINTEREST_PIN.repinCount,
        author: CANONICAL_PINTEREST_PIN.author,
        pinId: CANONICAL_PINTEREST_PIN.pinId,
      },
    );
    const signal = buildCanonicalPinterestDigestSignal();
    const score = normalizeEngagement({
      title: signal.title,
      sourceType: 'pinterest',
      sourceMetadata: signal.sourceMetadata,
    });
    assert.ok(typeof score === 'number' && score > 0);
  });

  it('mapped fetch pin matches canonical fixture used by Convex tests', () => {
    const mapped = mapPinItem(FIXTURE_SEARCH.pins[0]);
    assert.ok(mapped);
    assert.equal(mapped.title, CANONICAL_PINTEREST_PIN.title);
    assert.equal(mapped.repinCount, CANONICAL_PINTEREST_PIN.repinCount);
    assert.equal(mapped.pinId, CANONICAL_PINTEREST_PIN.pinId);
  });

  it('loadPinterestConfig defaults enabled true', () => {
    assert.equal(loadPinterestConfig({}).enabled, true);
    assert.equal(isPinterestEnabled('off'), false);
  });
});
