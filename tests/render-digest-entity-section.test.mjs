import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  compactMomentumSummary,
  DIGEST_ENTITY_FETCH_TIMEOUT_MS,
  DIGEST_ENTITY_MAX_LINES_PER_LANE,
  fetchEntityIntelligence,
  normalizeEntityIntelligenceResult,
  reasonCodeToDigestLabel,
  renderDigestEntitySection,
  sanitizeEntityDigestField,
  trimEntityBlockForDigestAppend,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs';

/** Production-shaped fixtures (73-5/73-6 live entities). */
const PRODUCTION_FIXTURE = {
  trackedInMotion: [
    {
      entityKey: 'person:ethan mollick',
      entityType: 'person',
      displayName: 'Ethan Mollick',
      momentumSummary: '14 mentions / 7d vs 3.2/wk baseline (≈4.1×)',
      reasons: [
        {
          code: 'acceleration',
          detail: 'Active rate 2.00/day vs baseline 0.46/day (≈4.1×)',
        },
        {
          code: 'cross_source',
          detail: 'Present across 3 sources: twitter, linkedin, youtube',
        },
      ],
    },
    {
      entityKey: 'person:yann lecun',
      entityType: 'person',
      displayName: 'Yann LeCun',
      momentumSummary: '7 mentions / 7d vs 2.0/wk baseline (≈2.5×)',
      reasons: [
        {
          code: 'acceleration',
          detail: 'Active rate 1.00/day vs baseline 0.29/day (≈2.5×)',
        },
        {
          code: 'theme_adjacent',
          detail: 'Theme relevance 72 (band ≥ 60)',
        },
      ],
    },
    {
      entityKey: 'person:jack clark',
      entityType: 'person',
      displayName: 'Jack Clark',
      momentumSummary: '9 mentions / 7d vs 1.8/wk baseline (≈3.5×)',
      reasons: [
        {
          code: 'acceleration',
          detail: 'Active rate 1.29/day vs baseline 0.26/day (≈3.5×)',
        },
        {
          code: 'high_priority_source',
          detail: 'Peak rank score 88 in active window',
        },
      ],
    },
  ],
  emergingToReview: [
    {
      entityKey: 'org:ggml-org/llama.cpp',
      entityType: 'org',
      displayName: 'ggml-org/llama.cpp',
      momentumSummary: '5 mentions / 7d (no baseline yet)',
      reasons: [
        {
          code: 'cold_start',
          detail: '5 mentions in 7d with no prior baseline history',
        },
        {
          code: 'cross_source',
          detail: 'Present across 2 sources: github, hackernews',
        },
      ],
    },
    {
      entityKey: 'person:riley lambert',
      entityType: 'person',
      displayName: 'Riley Lambert',
      momentumSummary: '4 mentions / 7d (no baseline yet)',
      reasons: [
        {
          code: 'cold_start',
          detail: '4 mentions in 7d with no prior baseline history',
        },
      ],
    },
  ],
};

describe('render-digest-entity-section (Story 73-7)', () => {
  it('both lanes populated → two headers + correct line grammar', () => {
    const markdown = renderDigestEntitySection(PRODUCTION_FIXTURE, { maxPerLane: 5 });
    assert.match(markdown, /^## Tracked entities accelerating now/m);
    assert.match(markdown, /^## Emerging entities worth a look/m);
    assert.match(
      markdown,
      /• \*\*Ethan Mollick\*\* \(person\) — ≈4\.1× vs baseline · cross-source \(3\)/,
    );
    assert.match(
      markdown,
      /• \*\*ggml-org\/llama\.cpp\*\* \(org\) — new, 5 mentions\/7d · cold start/,
    );
    assert.match(markdown, /\[Open entity cockpit\]\(\/nexus\/entities\)/);
  });

  it('empty tracked lane → emerging section only', () => {
    const markdown = renderDigestEntitySection(
      {
        trackedInMotion: [],
        emergingToReview: PRODUCTION_FIXTURE.emergingToReview.slice(0, 1),
      },
      { includeDeepLink: false },
    );
    assert.doesNotMatch(markdown, /Tracked entities accelerating now/);
    assert.match(markdown, /## Emerging entities worth a look/);
    assert.match(markdown, /ggml-org\/llama\.cpp/);
  });

  it('both empty → returns empty string', () => {
    assert.equal(renderDigestEntitySection({ trackedInMotion: [], emergingToReview: [] }), '');
    assert.equal(renderDigestEntitySection(null), '');
  });

  it('reason label mapping for acceleration, cold_start, cross_source', () => {
    assert.equal(
      reasonCodeToDigestLabel('acceleration', 'Active rate 2/day vs baseline 0.5/day (≈4×)'),
      '≈4× vs baseline',
    );
    assert.equal(reasonCodeToDigestLabel('cold_start'), 'cold start');
    assert.equal(
      reasonCodeToDigestLabel('cross_source', 'Present across 3 sources: twitter, github'),
      'cross-source (3)',
    );
  });

  it('line trim at DIGEST_ENTITY_MAX_LINES_PER_LANE', () => {
    const manyTracked = {
      trackedInMotion: Array.from({ length: 8 }, (_, index) => ({
        entityType: 'person',
        displayName: `Tracked ${index + 1}`,
        momentumSummary: '3 mentions / 7d vs 1/wk baseline (≈2×)',
        reasons: [{ code: 'acceleration', detail: '≈2×' }],
      })),
      emergingToReview: [],
    };
    const markdown = renderDigestEntitySection(manyTracked, {
      maxPerLane: DIGEST_ENTITY_MAX_LINES_PER_LANE,
      includeDeepLink: false,
    });
    const bulletCount = markdown.split('\n').filter((line) => line.startsWith('• ')).length;
    assert.equal(bulletCount, DIGEST_ENTITY_MAX_LINES_PER_LANE);
  });

  it('compactMomentumSummary shortens tracked and emerging momentum lines', () => {
    assert.equal(
      compactMomentumSummary('14 mentions / 7d vs 3.2/wk baseline (≈4.1×)'),
      '≈4.1× vs baseline',
    );
    assert.equal(compactMomentumSummary('5 mentions / 7d (no baseline yet)'), 'new, 5 mentions/7d');
  });

  it('trimEntityBlockForDigestAppend drops lowest-ranked lines when over pack limit', () => {
    const block = renderDigestEntitySection(PRODUCTION_FIXTURE, { maxPerLane: 5 });
    const base = 'x'.repeat(3130);
    const trimmed = trimEntityBlockForDigestAppend(block, base.length, 3400);
    assert.ok(trimmed.length > 0);
    assert.ok(base.length + 2 + trimmed.length <= 3400);
    assert.match(trimmed, /Tracked entities accelerating now/);
    assert.match(trimmed, /Emerging entities worth a look/);
    assert.doesNotMatch(trimmed, /Riley Lambert/);
    assert.match(trimmed, /Ethan Mollick/);
    assert.match(trimmed, /Open entity cockpit/);
    const bullets = trimmed.split('\n').filter((line) => line.startsWith('• '));
    assert.equal(bullets.length, 2);
  });

  it('omits the complete entity block when no heading and line fits', () => {
    const block = renderDigestEntitySection(PRODUCTION_FIXTURE);
    assert.equal(trimEntityBlockForDigestAppend(block, 3352, 3400), '');
  });

  it('skips malformed lane members without emitting empty headers', () => {
    const markdown = renderDigestEntitySection({
      trackedInMotion: [null, 'bad', PRODUCTION_FIXTURE.trackedInMotion[0]],
      emergingToReview: [null],
    });
    assert.match(markdown, /Ethan Mollick/);
    assert.doesNotMatch(markdown, /Emerging entities worth a look/);
  });

  it('sanitizes emoji, newlines, markdown controls, and Discord mentions', () => {
    const markdown = renderDigestEntitySection(
      {
        trackedInMotion: [
          {
            entityType: 'person',
            displayName: 'Name 🚀\n## @everyone *unsafe*',
            momentumSummary: 'fast 🚀\nnext',
            reasons: [{ code: 'new_source', detail: 'source: @here 🚀' }],
          },
        ],
        emergingToReview: [],
      },
      { includeDeepLink: false },
    );
    assert.doesNotMatch(markdown, /🚀|\n## @everyone/);
    assert.match(markdown, /@\u200Beveryone/);
    assert.match(markdown, /\\\*unsafe\\\*/);
    assert.equal(sanitizeEntityDigestField('🚀'), '');
  });

  it('fetchEntityIntelligence calls Convex query once with run timestamp', async () => {
    /** @type {Array<{ path: string; args: Record<string, unknown> }>} */
    const calls = [];
    const fetchFn = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      calls.push({ path: body.path, args: body.args });
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 'success',
            value: PRODUCTION_FIXTURE,
          }),
      };
    };

    const result = await fetchEntityIntelligence(
      { CONVEX_URL: 'https://test.convex.cloud', CONVEX_DEPLOY_KEY: 'deploy-key' },
      { now: 1_749_657_600_000, fetchFn },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, 'entityIntelligence:getEntityIntelligence');
    assert.equal(calls[0].args.now, 1_749_657_600_000);
    assert.equal(normalizeEntityIntelligenceResult(result).trackedInMotion.length, 3);
  });

  it('fetchEntityIntelligence aborts a stalled query at its configured timeout', async () => {
    const fetchFn = async (_url, init) =>
      await new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      });

    await assert.rejects(
      fetchEntityIntelligence(
        { CONVEX_URL: 'https://test.convex.cloud', CONVEX_DEPLOY_KEY: 'deploy-key' },
        { now: 1_749_657_600_000, fetchFn, timeoutMs: 5 },
      ),
      /timeout|aborted/i,
    );
    assert.equal(DIGEST_ENTITY_FETCH_TIMEOUT_MS, 10_000);
  });
});
