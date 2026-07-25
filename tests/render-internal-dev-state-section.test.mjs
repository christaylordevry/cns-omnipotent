import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  categoryLabelForDigest,
  DIGEST_INTERNAL_MAX_LINES,
  DISCOVERY_COCKPIT_LINK,
  INTERNAL_DIGEST_SECTION_TITLE,
  renderInternalDevStateSection,
  runInternalDevStateDigestSection,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/render-internal-dev-state-section.mjs';
import { DIGEST_ENTITY_MAX_LINES_PER_LANE } from '../scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs';

const FIXTURE_ITEMS = [
  {
    rank: 2,
    title: '81-2-morning-digest-internal-block-watchdog-reliability',
    category: 'sprint',
    rationale: 'Sprint status: ready-for-dev (Epic 81)',
    sourcePath: 'sprint-status.yaml',
  },
  {
    rank: 1,
    title: 'Hermes *unsafe* 🚀 title',
    category: 'deferred',
    rationale: 'Surfaced by: @everyone scan',
    sourcePath: 'deferred-work.md',
  },
  {
    rank: 3,
    title: 'agent-log entry',
    category: 'agent_log',
    rationale: 'Recent operator note',
    sourcePath: 'AI-Context/agent-log.md',
  },
];

describe('render-internal-dev-state-section (Story 81-2 AC1)', () => {
  it('exports line cap alias matching entity renderer', () => {
    assert.equal(DIGEST_INTERNAL_MAX_LINES, DIGEST_ENTITY_MAX_LINES_PER_LANE);
    assert.equal(DIGEST_INTERNAL_MAX_LINES, 5);
  });

  it('renders section grammar with category labels and discovery link', () => {
    const markdown = renderInternalDevStateSection(FIXTURE_ITEMS, { includeDeepLink: true });
    assert.match(markdown, new RegExp(`^## ${INTERNAL_DIGEST_SECTION_TITLE}`));
    assert.ok(markdown.includes('Hermes \\*unsafe\\* title'));
    assert.match(markdown, /\(deferred\) — Surfaced by:/);
    assert.match(
      markdown,
      /• \*\*81-2-morning-digest-internal-block-watchdog-reliability\*\* \(sprint\)/,
    );
    assert.match(markdown, /• \*\*agent-log entry\*\* \(agent log\)/);
    assert.match(markdown, new RegExp(DISCOVERY_COCKPIT_LINK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(markdown, /🚀/);
  });

  it('sorts by rank ascending and caps at five lines', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      rank: index + 1,
      title: `Story ${index + 1}`,
      category: 'sprint',
      rationale: `rationale ${index + 1}`,
    }));
    const markdown = renderInternalDevStateSection(many, { includeDeepLink: false });
    const bullets = markdown.split('\n').filter((line) => line.startsWith('• '));
    assert.equal(bullets.length, 5);
    assert.match(bullets[0], /Story 1/);
    assert.match(bullets[4], /Story 5/);
  });

  it('returns empty string for empty or invalid input', () => {
    assert.equal(renderInternalDevStateSection([]), '');
    assert.equal(renderInternalDevStateSection(null), '');
    assert.equal(
      renderInternalDevStateSection([null, { title: 'missing category' }]),
      '',
    );
  });

  it('maps category labels including vault_scan fallback', () => {
    assert.equal(categoryLabelForDigest('vault_scan'), 'vault scan');
    assert.equal(categoryLabelForDigest('unknown_cat'), 'unknown\\_cat');
  });

  it('runInternalDevStateDigestSection returns failed status on collect throw', async () => {
    const result = await runInternalDevStateDigestSection(
      {},
      {
        collectFn: async () => {
          throw new Error('collect-boom');
        },
      },
    );
    assert.equal(result.markdown, '');
    assert.equal(result.internalDevDigestResult.status, 'failed');
    assert.match(result.internalDevDigestResult.reason ?? '', /collect-boom/);
  });

  it('runInternalDevStateDigestSection returns empty when collector yields no items', async () => {
    const result = await runInternalDevStateDigestSection(
      {},
      {
        collectFn: async () => [],
      },
    );
    assert.equal(result.markdown, '');
    assert.equal(result.internalDevDigestResult.status, 'empty');
    assert.equal(result.internalDevDigestResult.linesRendered, 0);
  });

  it('runInternalDevStateDigestSection returns ok with line count', async () => {
    const result = await runInternalDevStateDigestSection(
      {},
      {
        collectFn: async () => FIXTURE_ITEMS,
      },
    );
    assert.equal(result.internalDevDigestResult.status, 'ok');
    assert.equal(result.internalDevDigestResult.linesRendered, 3);
    assert.match(result.markdown, /Internal work prioritized/);
  });
});
