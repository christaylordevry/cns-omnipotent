import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  breakingBonus,
  clamp,
  extractSprintTokens,
  f1Score,
  loadScoringContext,
  overlapRatio,
  parseDevelopmentStatus,
  parseNoveltyHistoryJson,
  parseWatchlistYaml,
  recencyScore,
  scoreMomentum,
  scoreNovelty,
  scorePersonalRelevance,
  scoreRelevance,
  scoreUrgency,
  tokenizeSignalText,
  trendProxyForSignal,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

/** @returns {import('../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs').ScoringContext} */
function baseCtx(overrides = {}) {
  return {
    domainTokens: [],
    personalTokens: [],
    epicNumericTokens: [],
    noveltyHistoryEntries: [],
    runAt: Date.parse('2026-06-09T12:00:00Z'),
    watchlistMissing: false,
    ...overrides,
  };
}

describe('shared primitives', () => {
  it('clamp bounds values', () => {
    assert.equal(clamp(150, 0, 100), 100);
    assert.equal(clamp(-5, 0, 100), 0);
    assert.equal(clamp(42, 0, 100), 42);
  });

  it('f1Score scales imported f1 to 0-100 integers', () => {
    assert.equal(f1Score(['alpha', 'beta'], ['alpha', 'beta']), 100);
    assert.equal(f1Score(['alpha'], ['beta']), 0);
    assert.equal(f1Score(['ai', 'agents'], ['ai', 'agents', 'framework']), 80);
  });

  it('tokenizeSignalText delegates to tokenizeForScoring on title + summary', () => {
    const tokens = tokenizeSignalText('AI Agents Launch', 'New framework for developers');
    assert.ok(tokens.includes('ai'));
    assert.ok(tokens.includes('agents'));
    assert.ok(tokens.includes('framework'));
  });
});

describe('watchlist and sprint parsing', () => {
  it('parseWatchlistYaml splits domain and personal keywords', () => {
    const yaml = `version: 1
keywords:
  - AI agents
  - keyword: machine learning
    region: global
personal:
  - CNS vault
  - Omnipotent
`;
    const parsed = parseWatchlistYaml(yaml);
    assert.deepEqual(parsed.domainKeywords, ['AI agents', 'machine learning']);
    assert.deepEqual(parsed.personalKeywords, ['CNS vault', 'Omnipotent']);
  });

  it('extractSprintTokens collects in-progress epic and story tokens', () => {
    const sprint = `development_status:
  epic-64: in-progress
  64-2-scoring-engine-five-dimensions: in-progress
  epic-37: done
`;
    const tokens = extractSprintTokens(parseDevelopmentStatus(sprint));
    assert.ok(tokens.sprintTokens.includes('epic'));
    assert.ok(tokens.sprintTokens.includes('64'));
    assert.ok(tokens.sprintTokens.includes('scoring'));
    assert.ok(tokens.sprintTokens.includes('engine'));
    assert.deepEqual(tokens.epicNumericTokens, ['64']);
  });
});

describe('scoreRelevance', () => {
  it('returns degraded neutral peripheral score when watchlist is missing', () => {
    const ctx = baseCtx({ watchlistMissing: true });
    const signal = { title: 'AI agents framework', sourceType: 'newsapi' };
    assert.equal(scoreRelevance(signal, ctx), 25);
  });

  it('hits representative calibration bands from F1 overlap', () => {
    const ctx = baseCtx({ domainTokens: ['ai', 'agents', 'framework', 'orchestration'] });
    assert.ok(scoreRelevance({ title: 'Sports overtime win', sourceType: 'newsapi' }, ctx) <= 20);
    assert.ok(
      scoreRelevance({ title: 'AI startup funding round', sourceType: 'newsapi' }, ctx) >= 21 &&
        scoreRelevance({ title: 'AI startup funding round', sourceType: 'newsapi' }, ctx) <= 50,
    );
    assert.ok(
      scoreRelevance({ title: 'AI agents framework orchestration', sourceType: 'newsapi' }, ctx) >=
        51,
    );
    assert.ok(
      scoreRelevance(
        { title: 'AI agents framework orchestration platform', sourceType: 'newsapi' },
        ctx,
      ) >= 76,
    );
  });
});

describe('scorePersonalRelevance anti-drift', () => {
  it('keeps personal relevance independent from relevance', () => {
    const domainTokens = ['ai', 'agents', 'framework', 'orchestration'];
    const signal = {
      title: 'AI agents framework orchestration platform',
      sourceType: 'newsapi',
    };
    const ctxA = baseCtx({ domainTokens, personalTokens: [], epicNumericTokens: [] });
    const ctxB = baseCtx({
      domainTokens,
      personalTokens: ['platform', 'orchestration', 'scoring'],
      epicNumericTokens: [],
    });

    const relevanceA = scoreRelevance(signal, ctxA);
    const personalA = scorePersonalRelevance(signal, ctxA);
    const relevanceB = scoreRelevance(signal, ctxB);
    const personalB = scorePersonalRelevance(signal, ctxB);

    assert.ok(relevanceA >= 76);
    assert.ok(personalA <= 20);
    assert.equal(relevanceA, relevanceB);
    assert.ok(personalB > personalA);
    assert.notEqual(personalB, relevanceB);
  });

  it('applies epic bonus for active in-progress epic tokens', () => {
    const ctx = baseCtx({
      personalTokens: [],
      epicNumericTokens: ['64'],
    });
    const withoutEpic = scorePersonalRelevance(
      { title: 'Vault operations update for platform', sourceType: 'newsapi' },
      ctx,
    );
    const withEpic = scorePersonalRelevance(
      { title: 'Vault operations update for platform 64', sourceType: 'newsapi' },
      ctx,
    );
    assert.equal(withEpic - withoutEpic, 15);
  });

  it('hits representative calibration bands from personal token overlap', () => {
    const personalTokens = [
      'omnipotent',
      'vault',
      'scoring',
      'digest',
      'cns',
      'framework',
      'orchestration',
      'platform',
    ];
    const ctx = baseCtx({ personalTokens, epicNumericTokens: [] });

    assert.ok(
      scorePersonalRelevance(
        { title: 'Sports overtime win in regional league', sourceType: 'newsapi' },
        ctx,
      ) <= 20,
    );

    const adjacent = scorePersonalRelevance(
      {
        title: 'Omnipotent vault market report summary today weekly news',
        sourceType: 'newsapi',
      },
      ctx,
    );
    assert.ok(adjacent >= 21 && adjacent <= 50);

    const activeWork = scorePersonalRelevance(
      {
        title: 'Omnipotent vault scoring digest market outlook',
        sourceType: 'newsapi',
      },
      ctx,
    );
    assert.ok(activeWork >= 51 && activeWork <= 75);

    assert.ok(
      scorePersonalRelevance(
        { title: 'Omnipotent vault scoring digest framework', sourceType: 'newsapi' },
        ctx,
      ) >= 76,
    );
  });
});

describe('scoreNovelty normative table', () => {
  const signal = {
    title: 'Novel AI orchestration patterns for agents',
    sourceType: 'hackernews',
  };

  it('returns 100 for empty history', () => {
    assert.equal(scoreNovelty(signal, baseCtx()), 100);
  });

  it('returns 10 for exact normalized title repeat', () => {
    const ctx = baseCtx({
      noveltyHistoryEntries: [{ title: '  Novel AI Orchestration Patterns For Agents  ' }],
    });
    assert.equal(scoreNovelty(signal, ctx), 10);
  });

  it('returns 25 for overlapRatio >= 0.60 paraphrase', () => {
    const ctx = baseCtx({
      noveltyHistoryEntries: [
        {
          title:
            'Novel AI orchestration patterns for agents and multi-agent coordination systems',
        },
      ],
    });
    const ratio = overlapRatio(
      tokenizeSignalText(signal.title),
      tokenizeSignalText(ctx.noveltyHistoryEntries[0].title),
    );
    assert.ok(ratio >= 0.6);
    assert.equal(scoreNovelty(signal, ctx), 25);
  });

  it('returns 45 for 0.30 <= overlapRatio < 0.60 paraphrase', () => {
    const paraphraseSignal = {
      title: 'Novel AI orchestration patterns for agents',
      sourceType: 'hackernews',
    };
    const ctx = baseCtx({
      noveltyHistoryEntries: [{ title: 'Novel robotics patterns for deployment teams' }],
    });
    const ratio = overlapRatio(
      tokenizeSignalText(paraphraseSignal.title),
      tokenizeSignalText(ctx.noveltyHistoryEntries[0].title),
    );
    assert.ok(ratio >= 0.3 && ratio < 0.6);
    assert.equal(scoreNovelty(paraphraseSignal, ctx), 45);
  });

  it('returns 65 for novel title with same sourceType in history', () => {
    const ctx = baseCtx({
      noveltyHistoryEntries: [{ title: 'Unrelated database indexing paper', sourceType: 'hackernews' }],
    });
    assert.equal(scoreNovelty(signal, ctx), 65);
  });

  it('returns 90 for first title in non-empty history window', () => {
    const ctx = baseCtx({
      noveltyHistoryEntries: [{ title: 'Quantum chemistry simulation advances', sourceType: 'arxiv' }],
    });
    assert.equal(scoreNovelty(signal, ctx), 90);
  });
});

describe('scoreUrgency', () => {
  const runAt = Date.parse('2026-06-09T12:00:00Z');

  it('scores breaking news within 6h higher than stale arXiv preprint', () => {
    const breaking = scoreUrgency(
      {
        title: 'Breaking: critical CVE-2026 outage today',
        sourceType: 'newsapi',
        sourceMetadata: { publishedAt: '2026-06-09T08:00:00Z' },
      },
      baseCtx({ runAt }),
    );
    const stale = scoreUrgency(
      {
        title: 'Graph neural networks for protein folding',
        sourceType: 'arxiv',
        sourceMetadata: { publishedAt: '2026-05-01T08:00:00Z' },
      },
      baseCtx({ runAt }),
    );
    assert.ok(breaking > stale);
    assert.equal(breakingBonus('Breaking: critical CVE-2026 outage today'), 20);
    assert.equal(recencyScore('2026-06-09T08:00:00Z', runAt), 95);
  });
});

describe('scoreMomentum', () => {
  it('uses Path B static priors when normalizedEngagement is absent', () => {
    assert.equal(
      scoreMomentum({ title: 'HN story', sourceType: 'hackernews' }, undefined, baseCtx()),
      45,
    );
    assert.equal(
      scoreMomentum({ title: 'News headline', sourceType: 'newsapi' }, null, baseCtx()),
      35,
    );
    assert.equal(
      scoreMomentum({ title: 'arXiv paper', sourceType: 'arxiv' }, undefined, baseCtx()),
      25,
    );
    assert.equal(
      scoreMomentum(
        {
          title: 'Trend spike',
          sourceType: 'google_trends',
          sourceMetadata: { normalizedValue: 0.82 },
        },
        undefined,
        baseCtx(),
      ),
      82,
    );
  });

  it('uses Path A with injected normalizedEngagement and ignores raw engagement fields', () => {
    const signal = {
      title: 'HN story with raw points',
      sourceType: 'hackernews',
      sourceMetadata: { points: 999, commentCount: 500, stars: 200, upvotes: 300 },
    };
    const withRaw = scoreMomentum(signal, 80, baseCtx());
    const withoutRaw = scoreMomentum(
      { title: 'HN story with raw points', sourceType: 'hackernews' },
      80,
      baseCtx(),
    );
    assert.equal(withRaw, withoutRaw);
    assert.equal(withRaw, clamp(Math.round(0.75 * 80 + 0.25 * trendProxyForSignal(signal)), 0, 100));
  });
});

describe('loadScoringContext', () => {
  it('resolves watchlist, sprint, novelty history, and run timestamp from env', async () => {
    const root = await mkdtemp(join(tmpdir(), 'score-ctx-'));
    const operatorHome = join(root, 'operator');
    const hermesDir = join(operatorHome, '.hermes');
    const artifacts = join(root, 'repo', '_bmad-output', 'implementation-artifacts');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(artifacts, { recursive: true });
    await writeFile(
      join(hermesDir, 'trend-watchlist.yaml'),
      `version: 1
keywords:
  - AI agents
personal:
  - CNS scoring
`,
      'utf8',
    );
    await writeFile(
      join(artifacts, 'sprint-status.yaml'),
      `development_status:
  epic-64: in-progress
  64-2-scoring-engine-five-dimensions: in-progress
`,
      'utf8',
    );

    const runAt = Date.parse('2026-06-09T12:00:00Z');
    const ctx = await loadScoringContext({
      HOME: operatorHome,
      CNS_REPO_ROOT: join(root, 'repo'),
      MORNING_DIGEST_SPRINT_STATUS_PATH: join(artifacts, 'sprint-status.yaml'),
      MORNING_DIGEST_PROJECT_ENTITIES: 'Omnipotent,CNS',
      DIGEST_KEYWORD_CANDIDATES_JSON: JSON.stringify([
        { term: 'digest scoring', category: 'personal' },
        { term: 'ignored', category: 'trending' },
      ]),
      DIGEST_NOVELTY_HISTORY_JSON: JSON.stringify([
        'Prior headline',
        { title: 'HN prior', sourceType: 'hackernews', seenAt: runAt - 60_000 },
      ]),
      DIGEST_RUN_AT: String(runAt),
    });

    assert.ok(ctx.domainTokens.includes('ai'));
    assert.ok(ctx.domainTokens.includes('agents'));
    assert.ok(ctx.personalTokens.includes('scoring'));
    assert.ok(ctx.personalTokens.includes('omnipotent'));
    assert.ok(ctx.personalTokens.includes('digest'));
    assert.equal(ctx.runAt, runAt);
    assert.equal(ctx.watchlistMissing, false);
    assert.equal(ctx.noveltyHistoryEntries.length, 2);
    assert.equal(parseNoveltyHistoryJson(null).length, 0);
  });

  it('treats missing watchlist as degraded relevance mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'score-ctx-missing-'));
    const ctx = await loadScoringContext({
      HOME: join(root, 'missing-operator'),
      CNS_REPO_ROOT: root,
      DIGEST_NOVELTY_HISTORY_JSON: '[]',
    });
    assert.equal(ctx.watchlistMissing, true);
    assert.equal(
      scoreRelevance({ title: 'Any headline', sourceType: 'newsapi' }, ctx),
      25,
    );
    assert.equal(
      scoreNovelty({ title: 'Any headline', sourceType: 'newsapi' }, ctx),
      100,
    );
  });

  it('filters novelty history to 7-day lookback when seenAt is present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'score-ctx-lookback-'));
    const runAt = Date.parse('2026-06-09T12:00:00Z');
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
    const ctx = await loadScoringContext({
      HOME: join(root, 'missing-operator'),
      CNS_REPO_ROOT: root,
      DIGEST_NOVELTY_HISTORY_JSON: JSON.stringify([
        { title: 'Stale headline', seenAt: runAt - eightDaysMs },
        { title: 'Recent headline', seenAt: runAt - 60_000 },
        'Undated headline',
      ]),
      DIGEST_RUN_AT: String(runAt),
    });

    assert.equal(ctx.noveltyHistoryEntries.length, 2);
    assert.ok(ctx.noveltyHistoryEntries.some((entry) => entry.title === 'Recent headline'));
    assert.ok(ctx.noveltyHistoryEntries.some((entry) => entry.title === 'Undated headline'));
    assert.ok(!ctx.noveltyHistoryEntries.some((entry) => entry.title === 'Stale headline'));
  });
});
