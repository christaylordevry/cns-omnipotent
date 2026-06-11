import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  breakingBonus,
  clamp,
  computeRankScore,
  deriveDisposition,
  extractSprintTokens,
  f1Score,
  GH_FORKS_CAP,
  GH_STARS_CAP,
  HN_COMMENTS_CAP,
  HN_POINTS_CAP,
  buildGoalWeightedTokens,
  DEFAULT_GOAL_WEIGHT,
  DEFAULT_PERSON_WEIGHT,
  loadNexusGoals,
  loadNexusPeople,
  loadScoringContext,
  logNorm,
  NEXUS_GOALS_MAX_PHRASES,
  NEXUS_PEOPLE_MAX_HANDLES_PER_PLATFORM,
  NEXUS_PEOPLE_MAX_PEOPLE,
  PEOPLE_HANDLE_MATCH_BONUS,
  PEOPLE_NAME_F1_THRESHOLD,
  PEOPLE_NAME_MATCH_BONUS,
  normalizeEngagement,
  normalizePeopleHandle,
  resolvePeopleMatch,
  scorePeopleBonuses,
  parseNexusPeopleYaml,
  overlapRatio,
  parseDevelopmentStatus,
  parseDigestSignalsJson,
  parseNexusGoalsYaml,
  parseNoveltyHistoryJson,
  parseWatchlistYaml,
  RANK_WEIGHT_MOMENTUM,
  RANK_WEIGHT_MOMENTUM_NO_ENGAGEMENT,
  RANK_WEIGHT_NORMALIZED_ENGAGEMENT,
  RANK_WEIGHT_NOVELTY,
  RANK_WEIGHT_PERSONAL,
  RANK_WEIGHT_RELEVANCE,
  RANK_WEIGHT_URGENCY,
  RD_COMMENTS_CAP,
  RD_UPVOTES_CAP,
  recencyScore,
  runScoreDigestSignalsCli,
  scoreDigestSignals,
  scoreDigestSignalsSafe,
  scoreMomentum,
  scoreNovelty,
  scorePersonalRelevance,
  scoreRelevance,
  scoreUrgency,
  tokenizeSignalText,
  trendProxyForSignal,
  weightedPersonalF1,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

const execFileAsync = promisify(execFile);
const testDir = dirname(fileURLToPath(import.meta.url));
const scoreScript = join(
  testDir,
  '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs',
);
const nexusPeopleExamplePath = join(testDir, '../scripts/nexus-people.yaml.example');

/** @returns {import('../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs').ScoringContext} */
function baseCtx(overrides = {}) {
  return {
    domainTokens: [],
    personalTokens: [],
    goalWeightedTokens: [],
    nexusPeople: [],
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

describe('Epic 65 SOURCE_PRIOR and TREND_PROXY_PRIOR', () => {
  const runAt = Date.parse('2026-06-09T12:00:00Z');

  it('assigns non-zero trend proxy priors for github, reddit, producthunt, twitter, bluesky, and rss', () => {
    assert.equal(trendProxyForSignal({ title: 'GH repo', sourceType: 'github' }), 40);
    assert.equal(trendProxyForSignal({ title: 'RD post', sourceType: 'reddit' }), 42);
    assert.equal(trendProxyForSignal({ title: 'PH launch', sourceType: 'producthunt' }), 42);
    assert.equal(trendProxyForSignal({ title: 'X post', sourceType: 'twitter' }), 40);
    assert.equal(trendProxyForSignal({ title: 'BSKY post', sourceType: 'bluesky' }), 38);
    assert.equal(trendProxyForSignal({ title: 'RSS item', sourceType: 'rss' }), 30);
  });

  it('assigns non-zero urgency via github source prior', () => {
    const urgency = scoreUrgency(
      {
        title: 'owner/example-repo',
        sourceType: 'github',
        sourceMetadata: { publishedAt: '2026-06-09T08:00:00Z' },
      },
      baseCtx({ runAt }),
    );
    assert.ok(urgency > 0);
  });

  it('assigns higher urgency for twitter than arxiv via SOURCE_PRIOR 9 vs 0', () => {
    const signalBase = {
      title: 'Stable title without breaking keywords',
      sourceMetadata: { publishedAt: '2026-06-09T08:00:00Z' },
    };
    const twitterUrgency = scoreUrgency({ ...signalBase, sourceType: 'twitter' }, baseCtx({ runAt }));
    const arxivUrgency = scoreUrgency({ ...signalBase, sourceType: 'arxiv' }, baseCtx({ runAt }));
    assert.ok(twitterUrgency > arxivUrgency);
  });

  it('assigns higher urgency for bluesky than arxiv via SOURCE_PRIOR 7 vs 0', () => {
    const signalBase = {
      title: 'Stable title without breaking keywords',
      sourceMetadata: { publishedAt: '2026-06-09T08:00:00Z' },
    };
    const blueskyUrgency = scoreUrgency({ ...signalBase, sourceType: 'bluesky' }, baseCtx({ runAt }));
    const arxivUrgency = scoreUrgency({ ...signalBase, sourceType: 'arxiv' }, baseCtx({ runAt }));
    assert.ok(blueskyUrgency > arxivUrgency);
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

describe('logNorm and cap constants', () => {
  it('exports normative §6.1 cap constants', () => {
    assert.equal(HN_POINTS_CAP, 500);
    assert.equal(HN_COMMENTS_CAP, 200);
    assert.equal(GH_STARS_CAP, 50000);
    assert.equal(GH_FORKS_CAP, 5000);
    assert.equal(RD_UPVOTES_CAP, 10000);
    assert.equal(RD_COMMENTS_CAP, 2000);
  });

  it('logNorm returns 0 for zero value', () => {
    assert.equal(logNorm(0, 500), 0);
    assert.equal(logNorm(0, 50000), 0);
  });

  it('logNorm treats negative and non-finite values as 0', () => {
    assert.equal(logNorm(-10, 500), 0);
    assert.equal(logNorm(Number.NaN, 500), 0);
    assert.equal(logNorm(Number.POSITIVE_INFINITY, 500), 0);
  });

  it('logNorm returns 100 at cap saturation', () => {
    assert.equal(logNorm(500, 500), 100);
    assert.equal(logNorm(50000, 50000), 100);
    assert.equal(logNorm(10000, 10000), 100);
  });
});

describe('normalizeEngagement cap-saturation fixtures (§6.1)', () => {
  it('hackernews at points/comments cap → 100', () => {
    assert.equal(
      normalizeEngagement({
        title: 'HN cap story',
        sourceType: 'hackernews',
        sourceMetadata: { points: 500, commentCount: 200 },
      }),
      100,
    );
  });

  it('github at stars/forks cap → 100', () => {
    assert.equal(
      normalizeEngagement({
        title: 'GH cap repo',
        sourceType: 'github',
        sourceMetadata: { stars: 50000, forks: 5000 },
      }),
      100,
    );
  });

  it('reddit at upvotes/comments cap → 100', () => {
    assert.equal(
      normalizeEngagement({
        title: 'RD cap post',
        sourceType: 'reddit',
        sourceMetadata: { upvotes: 10000, commentCount: 2000 },
      }),
      100,
    );
  });

  it('producthunt at upvotes cap without comments → 75', () => {
    assert.equal(
      normalizeEngagement({
        title: 'PH cap launch',
        sourceType: 'producthunt',
        sourceMetadata: { upvotes: 10000 },
      }),
      75,
    );
  });

  it('producthunt parity with reddit at same upvotes', () => {
    const upvotes = 420;
    const ph = normalizeEngagement({
      title: 'PH launch',
      sourceType: 'producthunt',
      sourceMetadata: { upvotes },
    });
    const rd = normalizeEngagement({
      title: 'RD post',
      sourceType: 'reddit',
      sourceMetadata: { upvotes },
    });
    assert.equal(ph, rd);
  });

  it('twitter at engagement caps → 100', () => {
    assert.equal(
      normalizeEngagement({
        title: 'X cap post',
        sourceType: 'twitter',
        sourceMetadata: {
          likes: 50000,
          reposts: 10000,
          replies: 5000,
          quotes: 2000,
        },
      }),
      100,
    );
  });

  it('twitter with all zero engagement → null', () => {
    assert.equal(
      normalizeEngagement({
        title: 'X zero post',
        sourceType: 'twitter',
        sourceMetadata: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      }),
      null,
    );
  });

  it('bluesky at engagement caps → 100', () => {
    assert.equal(
      normalizeEngagement({
        title: 'BSKY cap post',
        sourceType: 'bluesky',
        sourceMetadata: {
          likes: 20000,
          reposts: 5000,
          replies: 2000,
          quotes: 1000,
        },
      }),
      100,
    );
  });

  it('bluesky with all zero engagement → null', () => {
    assert.equal(
      normalizeEngagement({
        title: 'BSKY zero post',
        sourceType: 'bluesky',
        sourceMetadata: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      }),
      null,
    );
  });

  it('hackernews at zero engagement → 0', () => {
    assert.equal(
      normalizeEngagement({
        title: 'HN zero story',
        sourceType: 'hackernews',
        sourceMetadata: { points: 0, commentCount: 0 },
      }),
      0,
    );
  });
});

describe('normalizeEngagement §6.2 cross-source calibration', () => {
  it('primary-only raw 500 yields hn=80 and gh=48 — not shared scale', () => {
    const hn = normalizeEngagement({
      title: 'HN cap story',
      sourceType: 'hackernews',
      sourceMetadata: { points: 500 },
    });
    const gh = normalizeEngagement({
      title: 'GH repo',
      sourceType: 'github',
      sourceMetadata: { stars: 500 },
    });

    assert.notEqual(hn, gh);
    assert.equal(hn, 80);
    assert.equal(gh, 48);
    assert.ok(hn >= 51 && hn <= 85);
    assert.ok(gh < hn);
  });
});

describe('normalizeEngagement omit-null sources', () => {
  it('returns null for newsapi, arxiv, deep_signal, google_trends', () => {
    assert.equal(
      normalizeEngagement({ title: 'News', sourceType: 'newsapi' }),
      null,
    );
    assert.equal(
      normalizeEngagement({ title: 'Paper', sourceType: 'arxiv' }),
      null,
    );
    assert.equal(
      normalizeEngagement({ title: 'Deep', sourceType: 'deep_signal' }),
      null,
    );
    assert.equal(
      normalizeEngagement({
        title: 'Trend',
        sourceType: 'google_trends',
        sourceMetadata: { normalizedValue: 0.9 },
      }),
      null,
    );
  });

  it('returns null when primary engagement field is absent', () => {
    assert.equal(
      normalizeEngagement({ title: 'HN no points', sourceType: 'hackernews' }),
      null,
    );
    assert.equal(
      normalizeEngagement({ title: 'GH no stars', sourceType: 'github' }),
      null,
    );
    assert.equal(
      normalizeEngagement({ title: 'RD no upvotes', sourceType: 'reddit' }),
      null,
    );
  });

  it('uses 0 for missing secondary fields when primary is present', () => {
    assert.equal(
      normalizeEngagement({
        title: 'HN points only',
        sourceType: 'hackernews',
        sourceMetadata: { points: 500 },
      }),
      80,
    );
    assert.equal(
      normalizeEngagement({
        title: 'GH stars only',
        sourceType: 'github',
        sourceMetadata: { stars: 500 },
      }),
      48,
    );
  });

  it('does not alias legacy comments field to commentCount', () => {
    assert.equal(
      normalizeEngagement({
        title: 'HN legacy comments',
        sourceType: 'hackernews',
        sourceMetadata: { points: 500, comments: 200 },
      }),
      80,
    );
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

  it('normalizeEngagement output drives Path A momentum (HN cap → 86)', () => {
    const signal = {
      title: 'HN cap story',
      sourceType: 'hackernews',
      sourceMetadata: { points: 500, commentCount: 200 },
    };
    const norm = normalizeEngagement(signal);
    assert.equal(norm, 100);
    assert.equal(scoreMomentum(signal, norm, baseCtx()), 86);
  });

  it('github adapter row with stars drives Path A momentum', () => {
    const signal = {
      title: 'owner/example-repo',
      sourceType: 'github',
      sourceMetadata: { stars: 500 },
    };
    const norm = normalizeEngagement(signal);
    assert.ok(norm !== null && norm >= 0 && norm <= 100);
    assert.equal(norm, 48);
    const momentum = scoreMomentum(signal, norm, baseCtx());
    assert.ok(momentum > 0);
    assert.equal(momentum, clamp(Math.round(0.75 * norm + 0.25 * trendProxyForSignal(signal)), 0, 100));
  });

  it('null normalizedEngagement preserves Path B for non-engagement sources', () => {
    const newsapi = { title: 'News headline', sourceType: 'newsapi' };
    const arxiv = { title: 'arXiv paper', sourceType: 'arxiv' };
    const deep = { title: 'Deep signal', sourceType: 'deep_signal' };
    const trends = {
      title: 'Trend spike',
      sourceType: 'google_trends',
      sourceMetadata: { normalizedValue: 0.82 },
    };

    assert.equal(normalizeEngagement(newsapi), null);
    assert.equal(normalizeEngagement(arxiv), null);
    assert.equal(normalizeEngagement(deep), null);
    assert.equal(normalizeEngagement(trends), null);

    assert.equal(scoreMomentum(newsapi, normalizeEngagement(newsapi), baseCtx()), 35);
    assert.equal(scoreMomentum(arxiv, normalizeEngagement(arxiv), baseCtx()), 25);
    assert.equal(scoreMomentum(deep, normalizeEngagement(deep), baseCtx()), 50);
    assert.equal(scoreMomentum(trends, normalizeEngagement(trends), baseCtx()), 82);
  });
});

/**
 * @param {{
 *   relevance: number,
 *   personalRelevance: number,
 *   novelty?: number,
 *   momentum?: number,
 *   urgency: number,
 * }} fixture
 */
function scoresFixture({ relevance, personalRelevance, novelty = 30, momentum = 30, urgency }) {
  return { relevance, personalRelevance, novelty, momentum, urgency };
}

describe('deriveDisposition', () => {
  it('exports deriveDisposition with architecture §7.1 case A — escalate via relevance >= 75', () => {
    assert.equal(
      deriveDisposition(scoresFixture({ relevance: 80, personalRelevance: 30, urgency: 80 }), 55),
      'escalate',
    );
  });

  it('architecture §7.1 case B — escalate via personalRelevance >= 60', () => {
    assert.equal(
      deriveDisposition(scoresFixture({ relevance: 40, personalRelevance: 65, urgency: 80 }), 60),
      'escalate',
    );
  });

  it('architecture §7.1 case C — priority when urgency below escalate threshold', () => {
    assert.equal(
      deriveDisposition(scoresFixture({ relevance: 70, personalRelevance: 55, urgency: 40 }), 72),
      'priority',
    );
  });

  it('architecture §7.1 case D — ignore when rankScore < 40 and max dimension < 50', () => {
    assert.equal(
      deriveDisposition(
        scoresFixture({
          relevance: 30,
          personalRelevance: 30,
          novelty: 20,
          momentum: 25,
          urgency: 20,
        }),
        35,
      ),
      'ignore',
    );
  });

  it('architecture §7.1 case E — watch default for remaining signals', () => {
    assert.equal(
      deriveDisposition(scoresFixture({ relevance: 55, personalRelevance: 40, urgency: 50 }), 55),
      'watch',
    );
  });

  it('escalate wins over priority when both rules match', () => {
    assert.equal(
      deriveDisposition(
        scoresFixture({ relevance: 80, personalRelevance: 65, urgency: 80 }),
        85,
      ),
      'escalate',
    );
  });

  it('case C inputs do not escalate when urgency is below 75', () => {
    assert.equal(
      deriveDisposition(scoresFixture({ relevance: 70, personalRelevance: 55, urgency: 40 }), 72),
      'priority',
    );
  });

  it('case D inputs are ignore not watch', () => {
    assert.equal(
      deriveDisposition(
        scoresFixture({
          relevance: 30,
          personalRelevance: 30,
          novelty: 20,
          momentum: 25,
          urgency: 20,
        }),
        35,
      ),
      'ignore',
    );
  });

  it('escalate with null rankScore — rule 1 does not require rankScore', () => {
    assert.equal(
      deriveDisposition(
        scoresFixture({ relevance: 80, personalRelevance: 30, urgency: 80 }),
        null,
      ),
      'escalate',
    );
  });

  it('skips priority and ignore when rankScore is absent, falling through to watch', () => {
    assert.equal(
      deriveDisposition(scoresFixture({ relevance: 70, personalRelevance: 55, urgency: 40 }), null),
      'watch',
    );
    assert.equal(
      deriveDisposition(
        scoresFixture({
          relevance: 30,
          personalRelevance: 30,
          novelty: 20,
          momentum: 25,
          urgency: 20,
        }),
        undefined,
      ),
      'watch',
    );
  });
});

describe('nexus-goals.yaml loader and weighted personalRelevance', () => {
  it('parseNexusGoalsYaml reads version, phrases, and per-phrase weights', () => {
    const yaml = `version: 1
goals:
  - phrase: "Nexus intelligence cockpit"
    weight: 2.0
  - phrase: morning digest signal quality
  - phrase: "Convex real-time dashboard"
    weight: 1.5
`;
    const parsed = parseNexusGoalsYaml(yaml);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.malformed, false);
    assert.equal(parsed.goals.length, 3);
    assert.equal(parsed.goals[0].phrase, 'Nexus intelligence cockpit');
    assert.equal(parsed.goals[0].weight, 2.0);
    assert.equal(parsed.goals[1].phrase, 'morning digest signal quality');
    assert.equal(parsed.goals[1].weight, DEFAULT_GOAL_WEIGHT);
    assert.equal(parsed.goals[2].weight, 1.5);
  });

  it('buildGoalWeightedTokens tokenizes phrases and caps at NEXUS_GOALS_MAX_PHRASES', () => {
    const goals = Array.from({ length: 21 }, (_, index) => ({
      phrase: `focus area number ${index + 1}`,
      weight: 2.0,
    }));
    const tokens = buildGoalWeightedTokens(goals);
    const phrasesLoaded = goals.slice(0, NEXUS_GOALS_MAX_PHRASES);
    const expectedCount = phrasesLoaded.reduce(
      (sum, goal) => sum + tokenizeSignalText(goal.phrase).length,
      0,
    );
    assert.equal(tokens.length, expectedCount);
    assert.ok(!tokens.some(({ token }) => token === String(21)));
  });

  it('loadNexusGoals returns empty set when file is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-missing-'));
    const loaded = await loadNexusGoals(root);
    assert.deepEqual(loaded.goalWeightedTokens, []);
    assert.equal(loaded.diagnostic, undefined);
  });

  it('parseNexusGoalsYaml handles empty file without throw', () => {
    const parsed = parseNexusGoalsYaml('');
    assert.equal(parsed.version, null);
    assert.deepEqual(parsed.goals, []);
    assert.equal(parsed.malformed, false);
  });

  it('loadNexusGoals handles empty file without throw or diagnostic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-empty-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(join(hermesDir, 'nexus-goals.yaml'), '', 'utf8');
    const loaded = await loadNexusGoals(root);
    assert.deepEqual(loaded.goalWeightedTokens, []);
    assert.equal(loaded.diagnostic, undefined);
  });

  it('parseNexusGoalsYaml handles missing goals key without throw', () => {
    const parsed = parseNexusGoalsYaml('version: 1\n');
    assert.equal(parsed.version, 1);
    assert.deepEqual(parsed.goals, []);
    assert.equal(parsed.malformed, false);
  });

  it('loadNexusGoals returns empty goals for version-only file without throw', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-no-goals-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(join(hermesDir, 'nexus-goals.yaml'), 'version: 1\n', 'utf8');
    const loaded = await loadNexusGoals(root);
    assert.deepEqual(loaded.goalWeightedTokens, []);
    assert.equal(loaded.diagnostic, undefined);
  });

  it('loadNexusGoals rejects quoted-string weight with malformed diagnostic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-weight-str-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-goals.yaml'),
      `version: 1
goals:
  - phrase: "test phrase"
    weight: "2.0"
`,
      'utf8',
    );
    const loaded = await loadNexusGoals(root);
    assert.deepEqual(loaded.goalWeightedTokens, []);
    assert.match(loaded.diagnostic ?? '', /score-digest-signals: warning — malformed nexus-goals.yaml/);
  });

  it('loadNexusGoals emits diagnostic for malformed YAML', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-bad-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-goals.yaml'),
      `goals:
  - not-a-phrase-key: broken
`,
      'utf8',
    );
    const loaded = await loadNexusGoals(root);
    assert.deepEqual(loaded.goalWeightedTokens, []);
    assert.match(loaded.diagnostic ?? '', /score-digest-signals: warning — malformed nexus-goals.yaml/);
  });

  it('loadNexusGoals warns on unsupported version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-ver-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-goals.yaml'),
      `version: 2
goals:
  - phrase: "future schema"
`,
      'utf8',
    );
    const loaded = await loadNexusGoals(root);
    assert.deepEqual(loaded.goalWeightedTokens, []);
    assert.match(loaded.diagnostic ?? '', /unsupported nexus-goals.yaml version 2/);
  });

  it('valid goals file via temp operator home yields higher personalRelevance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-score-'));
    const operatorHome = join(root, 'operator');
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-goals.yaml'),
      `version: 1
goals:
  - phrase: "Nexus intelligence cockpit"
    weight: 2.0
`,
      'utf8',
    );

    const ctxWithGoals = await loadScoringContext({
      HOME: operatorHome,
      CNS_REPO_ROOT: root,
      DIGEST_NOVELTY_HISTORY_JSON: '[]',
    });
    const ctxWithoutGoals = baseCtx({ personalTokens: [], goalWeightedTokens: [], epicNumericTokens: [] });
    const signal = {
      title: 'Nexus intelligence cockpit ships scoring panel',
      sourceType: 'newsapi',
    };

    const withGoals = scorePersonalRelevance(signal, ctxWithGoals);
    const withoutGoals = scorePersonalRelevance(signal, ctxWithoutGoals);
    assert.ok(withGoals > withoutGoals);
    assert.ok(ctxWithGoals.goalWeightedTokens.length > 0);
  });

  it('per-phrase weight 1.5 scores lower than default 2.0 for same overlap', () => {
    const signalTokens = tokenizeSignalText('Nexus intelligence cockpit ships scoring panel');
    const refTokens = ['nexus', 'intelligence', 'cockpit'].map((token) => ({ token, weight: 2.0 }));
    const lighter = ['nexus', 'intelligence', 'cockpit'].map((token) => ({ token, weight: 1.5 }));
    assert.ok(weightedPersonalF1(signalTokens, refTokens) > weightedPersonalF1(signalTokens, lighter));
  });

  it('FR-7 fixture delta is at least 15 points with vs without goals', () => {
    const signal = {
      title: 'Nexus intelligence cockpit ships scoring panel',
      sourceType: 'newsapi',
    };
    const withoutGoals = baseCtx({ personalTokens: [], goalWeightedTokens: [], epicNumericTokens: [] });
    const withGoals = baseCtx({
      personalTokens: [],
      goalWeightedTokens: buildGoalWeightedTokens([
        { phrase: 'Nexus intelligence cockpit', weight: 2.0 },
      ]),
      epicNumericTokens: [],
    });
    const delta =
      scorePersonalRelevance(signal, withGoals) - scorePersonalRelevance(signal, withoutGoals);
    assert.ok(delta >= 15, `expected delta >= 15, got ${delta}`);
  });

  it('loadScoringContext integration loads goals and excludes goal tokens from personalTokens', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-ctx-'));
    const operatorHome = join(root, 'operator');
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'trend-watchlist.yaml'),
      `version: 1
keywords:
  - AI agents
personal:
  - Nexus intelligence cockpit
`,
      'utf8',
    );
    await writeFile(
      join(hermesDir, 'nexus-goals.yaml'),
      `version: 1
goals:
  - phrase: "Nexus intelligence cockpit"
    weight: 2.0
`,
      'utf8',
    );

    const stderrChunks = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    };
    try {
      const ctx = await loadScoringContext({
        HOME: operatorHome,
        CNS_REPO_ROOT: root,
        DIGEST_NOVELTY_HISTORY_JSON: '[]',
      });
      assert.ok(ctx.goalWeightedTokens.some(({ token }) => token === 'nexus'));
      assert.ok(!ctx.personalTokens.includes('nexus'));
      assert.ok(!ctx.personalTokens.includes('intelligence'));
      assert.ok(!ctx.personalTokens.includes('cockpit'));
    } finally {
      process.stderr.write = originalWrite;
    }
    assert.equal(stderrChunks.join('').includes('nexus-goals'), false);
  });

  it('loadScoringContext excludes sprint entity tokens overlapping goal phrases from personalTokens', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-goals-sprint-overlap-'));
    const operatorHome = join(root, 'operator');
    const hermesDir = join(operatorHome, '.hermes');
    const artifacts = join(root, 'repo', '_bmad-output', 'implementation-artifacts');
    await mkdir(hermesDir, { recursive: true });
    await mkdir(artifacts, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-goals.yaml'),
      `version: 1
goals:
  - phrase: "morning digest signal quality"
    weight: 2.0
`,
      'utf8',
    );
    await writeFile(
      join(artifacts, 'sprint-status.yaml'),
      `development_status:
  epic-67: in-progress
`,
      'utf8',
    );

    const ctx = await loadScoringContext({
      HOME: operatorHome,
      CNS_REPO_ROOT: join(root, 'repo'),
      MORNING_DIGEST_SPRINT_STATUS_PATH: join(artifacts, 'sprint-status.yaml'),
      MORNING_DIGEST_PROJECT_ENTITIES: 'morning digest,CNS',
      DIGEST_NOVELTY_HISTORY_JSON: '[]',
    });

    for (const { token } of ctx.goalWeightedTokens) {
      assert.ok(
        !ctx.personalTokens.includes(token),
        `goal token "${token}" must not appear in personalTokens`,
      );
    }
    assert.ok(ctx.personalTokens.includes('cns'));
    assert.ok(ctx.personalTokens.includes('epic'));
    assert.ok(!ctx.personalTokens.includes('morning'));
    assert.ok(!ctx.personalTokens.includes('digest'));
  });
});

describe('nexus-people.yaml loader', () => {
  const validFixture = `version: 1
people:
  - name: "Andrej Karpathy"
    handles:
      twitter: "karpathy"
      bluesky: "karpathy.bsky.social"
    tags:
      - llm
      - research
    weight: 2.5
  - name: "Dario Amodei"
    handles:
      twitter: "darioamodei"
    tags:
      - ai-safety
`;

  it('parseNexusPeopleYaml reads version, people, handles, tags, and weights', () => {
    const parsed = parseNexusPeopleYaml(validFixture);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.malformed, false);
    assert.equal(parsed.people.length, 2);
    assert.equal(parsed.people[0].name, 'Andrej Karpathy');
    assert.deepEqual(parsed.people[0].handles.twitter, ['karpathy']);
    assert.deepEqual(parsed.people[0].handles.bluesky, ['karpathy.bsky.social']);
    assert.deepEqual(parsed.people[0].tags, ['llm', 'research']);
    assert.equal(parsed.people[0].weight, 2.5);
    assert.equal(parsed.people[1].weight, DEFAULT_PERSON_WEIGHT);
  });

  it('normalizePeopleHandle lowercases and strips leading @', () => {
    assert.equal(normalizePeopleHandle('@Karpathy'), 'karpathy');
    assert.equal(normalizePeopleHandle('KARPATHY'), 'karpathy');
    assert.equal(normalizePeopleHandle('  @TwitterUser  '), 'twitteruser');
  });

  it('parseNexusPeopleYaml parses inline tags array (A2 schema)', () => {
    const yaml = `version: 1
people:
  - name: "Andrej Karpathy"
    handles:
      twitter: "karpathy"
    tags: ["llm", "research"]
`;
    const parsed = parseNexusPeopleYaml(yaml);
    assert.equal(parsed.malformed, false);
    assert.deepEqual(parsed.people[0].tags, ['llm', 'research']);
    assert.equal(parsed.people[0].handles.tags, undefined);
  });

  it('parseNexusPeopleYaml parses unquoted inline tags and handle flow arrays', () => {
    const yaml = `version: 1
people:
  - name: "Ethan Mollick"
    weight: 2.5
    handles:
      bluesky: [emollick.bsky.social]
      twitter: [emollick]
    tags: [ai, education]
`;
    const parsed = parseNexusPeopleYaml(yaml);
    assert.equal(parsed.malformed, false);
    assert.deepEqual(parsed.people[0].handles.twitter, ['emollick']);
    assert.deepEqual(parsed.people[0].handles.bluesky, ['emollick.bsky.social']);
    assert.deepEqual(parsed.people[0].tags, ['ai', 'education']);
  });

  it('parseNexusPeopleYaml normalizes uppercase platform keys and handles in parser context', () => {
    const yaml = `version: 1
people:
  - name: "Test Person"
    handles:
      Twitter: "@KARPATHY"
`;
    const parsed = parseNexusPeopleYaml(yaml);
    assert.equal(parsed.malformed, false);
    assert.deepEqual(parsed.people[0].handles.twitter, ['karpathy']);
  });

  it('parseNexusPeopleYaml round-trips scripts/nexus-people.yaml.example', () => {
    const example = readFileSync(nexusPeopleExamplePath, 'utf8');
    const parsed = parseNexusPeopleYaml(example);
    assert.equal(parsed.malformed, false);
    assert.equal(parsed.version, 1);
    assert.ok(parsed.people.length >= 8);
    assert.deepEqual(parsed.people[0].tags, ['llm', 'research']);
    assert.deepEqual(parsed.people[0].handles.twitter, ['karpathy']);
    assert.equal(parsed.people[0].handles.tags, undefined);
  });

  it('parseNexusPeopleYaml caps handles at NEXUS_PEOPLE_MAX_HANDLES_PER_PLATFORM per platform', () => {
    const yaml = `version: 1
people:
  - name: "Test Person"
    handles:
      twitter:
        - one
        - two
        - three
        - four
`;
    const parsed = parseNexusPeopleYaml(yaml);
    assert.equal(parsed.people[0].handles.twitter.length, NEXUS_PEOPLE_MAX_HANDLES_PER_PLATFORM);
    assert.deepEqual(parsed.people[0].handles.twitter, ['one', 'two', 'three']);
  });

  it('loadNexusPeople truncates to NEXUS_PEOPLE_MAX_PEOPLE with diagnostic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-trunc-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    const peopleLines = Array.from(
      { length: 31 },
      (_, index) => `  - name: "Person ${index + 1}"\n    handles:\n      twitter: "p${index + 1}"`,
    ).join('\n');
    await writeFile(
      join(hermesDir, 'nexus-people.yaml'),
      `version: 1\npeople:\n${peopleLines}\n`,
      'utf8',
    );
    const loaded = await loadNexusPeople(root);
    assert.equal(loaded.people.length, NEXUS_PEOPLE_MAX_PEOPLE);
    assert.match(
      loaded.diagnostic ?? '',
      new RegExp(`truncated to ${NEXUS_PEOPLE_MAX_PEOPLE} people`),
    );
    assert.match(loaded.diagnostic ?? '', /score-digest-signals:/);
    assert.match(loaded.diagnostic ?? '', /nexus-people.yaml/);
  });

  it('loadNexusPeople returns empty set when file is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-missing-'));
    const loaded = await loadNexusPeople(root);
    assert.deepEqual(loaded.people, []);
    assert.equal(loaded.diagnostic, undefined);
  });

  it('loadNexusPeople emits diagnostic for malformed YAML', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-bad-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-people.yaml'),
      `people:
  - not-a-name-key: broken
`,
      'utf8',
    );
    const loaded = await loadNexusPeople(root);
    assert.deepEqual(loaded.people, []);
    assert.match(loaded.diagnostic ?? '', /score-digest-signals: warning — malformed nexus-people.yaml/);
  });

  it('loadNexusPeople warns on unsupported version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-ver-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-people.yaml'),
      `version: 2
people:
  - name: "Future Schema"
    handles:
      twitter: "future"
`,
      'utf8',
    );
    const loaded = await loadNexusPeople(root);
    assert.deepEqual(loaded.people, []);
    assert.match(loaded.diagnostic ?? '', /unsupported nexus-people.yaml version 2/);
  });

  it('parseNexusPeopleYaml handles empty file without throw', () => {
    const parsed = parseNexusPeopleYaml('');
    assert.equal(parsed.version, null);
    assert.deepEqual(parsed.people, []);
    assert.equal(parsed.malformed, false);
  });

  it('loadNexusPeople handles empty file without throw or diagnostic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-empty-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(join(hermesDir, 'nexus-people.yaml'), '', 'utf8');
    const loaded = await loadNexusPeople(root);
    assert.deepEqual(loaded.people, []);
    assert.equal(loaded.diagnostic, undefined);
  });

  it('parseNexusPeopleYaml handles version-only file without throw', () => {
    const parsed = parseNexusPeopleYaml('version: 1\n');
    assert.equal(parsed.version, 1);
    assert.deepEqual(parsed.people, []);
    assert.equal(parsed.malformed, false);
  });

  it('loadNexusPeople rejects quoted-string weight with malformed diagnostic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-weight-str-'));
    const hermesDir = join(root, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(
      join(hermesDir, 'nexus-people.yaml'),
      `version: 1
people:
  - name: "Test Person"
    handles:
      twitter: "test"
    weight: "2.5"
`,
      'utf8',
    );
    const loaded = await loadNexusPeople(root);
    assert.equal(loaded.people.length, 1);
    assert.equal(loaded.people[0].name, 'Test Person');
    assert.match(loaded.diagnostic ?? '', /score-digest-signals: warning — malformed nexus-people.yaml/);
  });

  it('loadScoringContext integration loads nexusPeople from temp operator home', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-ctx-'));
    const operatorHome = join(root, 'operator');
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(join(hermesDir, 'nexus-people.yaml'), validFixture, 'utf8');

    const ctx = await loadScoringContext({
      HOME: operatorHome,
      CNS_REPO_ROOT: root,
      DIGEST_NOVELTY_HISTORY_JSON: '[]',
    });
    assert.ok(ctx.nexusPeople.length > 0);
    assert.equal(ctx.nexusPeople[0].name, 'Andrej Karpathy');
  });

  it('scorePersonalRelevance applies handle bonus when nexusPeople is populated (68-3)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nexus-people-antidrift-'));
    const operatorHome = join(root, 'operator');
    const hermesDir = join(operatorHome, '.hermes');
    await mkdir(hermesDir, { recursive: true });
    await writeFile(join(hermesDir, 'nexus-people.yaml'), validFixture, 'utf8');

    const ctxWithPeople = await loadScoringContext({
      HOME: operatorHome,
      CNS_REPO_ROOT: root,
      DIGEST_NOVELTY_HISTORY_JSON: '[]',
    });
    const ctxWithoutPeople = baseCtx({ personalTokens: [], goalWeightedTokens: [], epicNumericTokens: [] });
    const signal = {
      title: 'Karpathy shares new LLM training insights',
      sourceType: 'bluesky',
      sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
    };

    const withPeople = scorePersonalRelevance(signal, ctxWithPeople);
    const withoutPeople = scorePersonalRelevance(signal, ctxWithoutPeople);
    assert.ok(withPeople - withoutPeople >= PEOPLE_HANDLE_MATCH_BONUS);
    assert.ok(ctxWithPeople.nexusPeople.length > 0);
  });
});

describe('personalRelevance v3 people bonus', () => {
  const karpathyPeople = [
    {
      name: 'Andrej Karpathy',
      handles: { twitter: ['karpathy'], bluesky: ['karpathy.bsky.social'] },
      tags: [],
      weight: 2.5,
    },
  ];
  const darioPeople = [
    {
      name: 'Dario Amodei',
      handles: { twitter: ['darioamodei'] },
      tags: [],
      weight: 2.5,
    },
  ];
  const emptyCtx = baseCtx({ personalTokens: [], goalWeightedTokens: [], epicNumericTokens: [] });

  it('handle match Karpathy yields at least +20 vs empty nexusPeople', () => {
    const signal = {
      title: 'New training run results',
      sourceType: 'bluesky',
      sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
    };
    const withPeople = baseCtx({ ...emptyCtx, nexusPeople: karpathyPeople });
    const withoutPeople = baseCtx({ ...emptyCtx, nexusPeople: [] });
    const delta =
      scorePersonalRelevance(signal, withPeople) - scorePersonalRelevance(signal, withoutPeople);
    assert.ok(delta >= PEOPLE_HANDLE_MATCH_BONUS, `expected delta >= ${PEOPLE_HANDLE_MATCH_BONUS}, got ${delta}`);
  });

  it('handle normalization @Karpathy matches karpathy', () => {
    const signalAt = {
      title: 'Training update',
      sourceType: 'twitter',
      sourceMetadata: { authorHandle: '@Karpathy' },
    };
    const signalPlain = {
      title: 'Training update',
      sourceType: 'twitter',
      sourceMetadata: { authorHandle: 'karpathy' },
    };
    const ctx = baseCtx({ ...emptyCtx, nexusPeople: karpathyPeople });
    assert.equal(scorePersonalRelevance(signalAt, ctx), scorePersonalRelevance(signalPlain, ctx));
  });

  it('bluesky handle karpathy.bsky.social earns +20 when configured', () => {
    const signal = {
      title: 'Post',
      sourceType: 'bluesky',
      sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
    };
    const bonuses = scorePeopleBonuses(signal, karpathyPeople);
    assert.equal(bonuses.handleBonus, PEOPLE_HANDLE_MATCH_BONUS);
    assert.equal(bonuses.nameBonus, 0);
  });

  it('name match Dario Amodei without handle earns at least +10', () => {
    const signal = {
      title: 'Dario Amodei discusses AI safety roadmap',
      sourceType: 'newsapi',
    };
    const withPeople = baseCtx({ ...emptyCtx, nexusPeople: darioPeople });
    const withoutPeople = baseCtx({ ...emptyCtx, nexusPeople: [] });
    const delta =
      scorePersonalRelevance(signal, withPeople) - scorePersonalRelevance(signal, withoutPeople);
    assert.ok(delta >= PEOPLE_NAME_MATCH_BONUS, `expected delta >= ${PEOPLE_NAME_MATCH_BONUS}, got ${delta}`);
  });

  it('name F1 below threshold yields no name bonus', () => {
    const signal = {
      title: 'Unrelated market headline about quarterly earnings',
      sourceType: 'newsapi',
    };
    const bonuses = scorePeopleBonuses(signal, darioPeople);
    assert.equal(bonuses.nameBonus, 0);
  });

  it('both handle and name bonuses stack to +30', () => {
    const signal = {
      title: 'Dario Amodei discusses AI safety roadmap',
      sourceType: 'twitter',
      sourceMetadata: { authorHandle: 'darioamodei' },
    };
    const bonuses = scorePeopleBonuses(signal, darioPeople);
    assert.equal(bonuses.handleBonus, PEOPLE_HANDLE_MATCH_BONUS);
    assert.equal(bonuses.nameBonus, PEOPLE_NAME_MATCH_BONUS);
    assert.equal(bonuses.handleBonus + bonuses.nameBonus, 30);
  });

  it('stacks with goal-weighted personal relevance', () => {
    const signal = {
      title: 'Omnipotent weekly update',
      sourceType: 'bluesky',
      sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
    };
    const withGoalsOnly = baseCtx({
      personalTokens: [],
      goalWeightedTokens: [{ token: 'omnipotent', weight: 2 }, { token: 'vault', weight: 2 }],
      epicNumericTokens: [],
      nexusPeople: [],
    });
    const withGoalsAndPeople = baseCtx({
      ...withGoalsOnly,
      nexusPeople: karpathyPeople,
    });
    const withoutGoals = baseCtx({
      personalTokens: [],
      goalWeightedTokens: [],
      epicNumericTokens: [],
      nexusPeople: [],
    });
    const goalsDelta = scorePersonalRelevance(signal, withGoalsOnly) - scorePersonalRelevance(signal, withoutGoals);
    const peopleDelta =
      scorePersonalRelevance(signal, withGoalsAndPeople) - scorePersonalRelevance(signal, withGoalsOnly);
    assert.ok(goalsDelta > 0);
    assert.ok(peopleDelta >= PEOPLE_HANDLE_MATCH_BONUS);
    assert.equal(scorePeopleBonuses(signal, karpathyPeople).handleBonus, PEOPLE_HANDLE_MATCH_BONUS);
  });

  it('empty nexusPeople yields zero people bonuses', () => {
    const signal = {
      title: 'Dario Amodei discusses AI safety',
      sourceType: 'twitter',
      sourceMetadata: { authorHandle: 'darioamodei' },
    };
    const bonuses = scorePeopleBonuses(signal, []);
    assert.equal(bonuses.handleBonus, 0);
    assert.equal(bonuses.nameBonus, 0);
  });

  it('clamp at 100 caps high base plus people bonuses', () => {
    const signal = {
      title: 'Omnipotent vault scoring digest framework omnipotent vault',
      sourceType: 'twitter',
      sourceMetadata: { authorHandle: 'karpathy' },
    };
    const ctx = baseCtx({
      personalTokens: ['omnipotent', 'vault', 'scoring', 'digest', 'framework'],
      goalWeightedTokens: [],
      epicNumericTokens: ['68'],
      nexusPeople: karpathyPeople,
    });
    const score = scorePersonalRelevance(signal, ctx);
    assert.ok(score <= 100);
    assert.equal(score, 100);
  });

  it('exports people bonus constants', () => {
    assert.equal(PEOPLE_HANDLE_MATCH_BONUS, 20);
    assert.equal(PEOPLE_NAME_MATCH_BONUS, 10);
    assert.equal(PEOPLE_NAME_F1_THRESHOLD, 30);
  });
});

describe('peopleMatch push metadata (69-2)', () => {
  const karpathyPeople = [
    {
      name: 'Andrej Karpathy',
      handles: { twitter: ['karpathy'], bluesky: ['karpathy.bsky.social'] },
      tags: [],
      weight: 2.5,
    },
  ];
  const darioPeople = [
    {
      name: 'Dario Amodei',
      handles: { twitter: ['darioamodei'] },
      tags: [],
      weight: 2.5,
    },
  ];
  const emptyCtx = baseCtx({ personalTokens: [], goalWeightedTokens: [], epicNumericTokens: [] });

  it('Karpathy Bluesky handle resolves handle peopleMatch metadata', () => {
    const signal = {
      title: 'New training run results',
      sourceType: 'bluesky',
      sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
    };
    const match = resolvePeopleMatch(signal, karpathyPeople);
    assert.deepEqual(match, {
      personName: 'Andrej Karpathy',
      matchedHandle: 'karpathy.bsky.social',
      bonusPoints: 20,
      matchType: 'handle',
    });
  });

  it('handle match takes precedence when both handle and name bonuses apply', () => {
    const signal = {
      title: 'Andrej Karpathy shares new training insights',
      sourceType: 'bluesky',
      sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
    };
    const match = resolvePeopleMatch(signal, karpathyPeople);
    assert.deepEqual(match, {
      personName: 'Andrej Karpathy',
      matchedHandle: 'karpathy.bsky.social',
      bonusPoints: 20,
      matchType: 'handle',
    });
  });

  it('Dario name-only title resolves name peopleMatch without matchedHandle', () => {
    const signal = {
      title: 'Dario Amodei discusses AI safety roadmap',
      sourceType: 'newsapi',
    };
    const match = resolvePeopleMatch(signal, darioPeople);
    assert.deepEqual(match, {
      personName: 'Dario Amodei',
      bonusPoints: 10,
      matchType: 'name',
    });
    assert.equal(match?.matchedHandle, undefined);
  });

  it('empty nexusPeople yields null peopleMatch', () => {
    const signal = {
      title: 'Dario Amodei discusses AI safety roadmap',
      sourceType: 'twitter',
      sourceMetadata: { authorHandle: 'darioamodei' },
    };
    assert.equal(resolvePeopleMatch(signal, []), null);
  });

  it('scoreDigestSignals integration includes sourceMetadata.peopleMatch', () => {
    const signal = {
      title: 'New training run results',
      sourceType: 'bluesky',
      sourceMetadata: { authorHandle: 'karpathy.bsky.social', likes: 42 },
    };
    const ctx = baseCtx({ ...emptyCtx, nexusPeople: karpathyPeople });
    const [scored] = scoreDigestSignals([signal], ctx);
    assert.deepEqual(scored.sourceMetadata.peopleMatch, {
      personName: 'Andrej Karpathy',
      matchedHandle: 'karpathy.bsky.social',
      bonusPoints: 20,
      matchType: 'handle',
    });
    assert.equal(scored.sourceMetadata.likes, 42);
  });

  it('scoreDigestSignals omits peopleMatch when no bonus applies', () => {
    const signal = {
      title: 'Unrelated market headline about quarterly earnings',
      sourceType: 'newsapi',
    };
    const ctx = baseCtx({ ...emptyCtx, nexusPeople: darioPeople });
    const [scored] = scoreDigestSignals([signal], ctx);
    assert.equal(scored.sourceMetadata, undefined);
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

describe('computeRankScore weight constants', () => {
  it('exports architecture §8.1 anti-drift weight constants', () => {
    assert.equal(RANK_WEIGHT_PERSONAL, 0.3);
    assert.equal(RANK_WEIGHT_RELEVANCE, 0.2);
    assert.equal(RANK_WEIGHT_MOMENTUM, 0.2);
    assert.equal(RANK_WEIGHT_MOMENTUM_NO_ENGAGEMENT, 0.25);
    assert.equal(RANK_WEIGHT_URGENCY, 0.15);
    assert.equal(RANK_WEIGHT_NOVELTY, 0.1);
    assert.equal(RANK_WEIGHT_NORMALIZED_ENGAGEMENT, 0.05);
  });
});

describe('computeRankScore fixture rows (§8.2)', () => {
  const baseScores = {
    personalRelevance: 80,
    relevance: 60,
    momentum: 50,
    urgency: 40,
    novelty: 30,
  };

  it('row 1 — engagement present → rankScore 58', () => {
    assert.equal(computeRankScore(baseScores, 60), 58);
  });

  it('row 2 — engagement absent redistributes 0.05 to momentum (0.25) → rankScore 58', () => {
    assert.equal(computeRankScore(baseScores, null), 58);
  });

  it('row 3 — all zeros with null engagement → rankScore 0', () => {
    assert.equal(
      computeRankScore(
        {
          personalRelevance: 0,
          relevance: 0,
          momentum: 0,
          urgency: 0,
          novelty: 0,
        },
        null,
      ),
      0,
    );
  });

  it('row 4 — all hundreds with engagement → rankScore 100', () => {
    assert.equal(
      computeRankScore(
        {
          personalRelevance: 100,
          relevance: 100,
          momentum: 100,
          urgency: 100,
          novelty: 100,
        },
        100,
      ),
      100,
    );
  });
});

describe('scoreDigestSignals orchestrator', () => {
  it('FR-14 sort fixture — personalRelevance drives rankScore order (A before B)', () => {
    const ctx = baseCtx({
      watchlistMissing: true,
      personalTokens: ['omnipotent', 'vault', 'scoring', 'digest'],
    });
    const signals = [
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Omnipotent vault scoring digest framework update',
        rank: 2,
        sourceMetadata: { points: 500, commentCount: 200 },
      },
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Regional sports league championship recap',
        rank: 1,
        sourceMetadata: { points: 500, commentCount: 200 },
      },
    ];

    const result = scoreDigestSignals(signals, ctx);

    assert.equal(result.length, 2);
    assert.ok(result[0].rankScore > result[1].rankScore);
    assert.equal(result[0].rank, 1);
    assert.equal(result[0].title, signals[0].title);
    assert.equal(result[1].rank, 2);
  });

  it('stable tie-break preserves input order when rankScore ties', () => {
    const ctx = baseCtx({ watchlistMissing: true });
    const signals = [
      {
        section: 'headlines',
        sourceType: 'newsapi',
        title: 'Identical headline alpha',
        rank: 5,
      },
      {
        section: 'headlines',
        sourceType: 'newsapi',
        title: 'Identical headline alpha',
        rank: 2,
      },
    ];

    const result = scoreDigestSignals(signals, ctx);
    assert.equal(result[0].rankScore, result[1].rankScore);
    assert.equal(result[0].title, signals[0].title);
    assert.equal(result[0].rank, 1);
    assert.equal(result[1].rank, 2);
  });

  it('HN orchestrator integration — normalizedEngagement, Path A momentum, full scored shape', () => {
    const signal = {
      section: 'hackernews',
      sourceType: 'hackernews',
      title: 'HN cap story',
      rank: 3,
      sourceMetadata: { points: 500, commentCount: 200 },
    };
    const ctx = baseCtx({ watchlistMissing: true });
    const [scored] = scoreDigestSignals([signal], ctx);

    assert.equal(scored.normalizedEngagement, 100);
    assert.equal(scored.scores.momentum, 86);
    assert.equal(scored.scores.relevance, 25);
    assert.ok(['priority', 'watch', 'ignore', 'escalate'].includes(scored.disposition));
    assert.equal(typeof scored.rankScore, 'number');
    assert.equal(scored.rank, 1);
    assert.equal(scored.section, 'hackernews');
  });

  it('omits normalizedEngagement key when engagement is null', () => {
    const [scored] = scoreDigestSignals(
      [{ section: 'headlines', sourceType: 'newsapi', title: 'Plain headline', rank: 1 }],
      baseCtx({ watchlistMissing: true }),
    );
    assert.ok(!Object.hasOwn(scored, 'normalizedEngagement'));
  });

  it('does not mutate the input array', () => {
    const signals = [
      { section: 'headlines', sourceType: 'newsapi', title: 'Headline A', rank: 1 },
      { section: 'headlines', sourceType: 'newsapi', title: 'Headline B', rank: 2 },
    ];
    const snapshot = JSON.parse(JSON.stringify(signals));
    scoreDigestSignals(signals, baseCtx({ watchlistMissing: true }));
    assert.deepEqual(signals, snapshot);
  });

  it('wires disposition via deriveDisposition(scores, rankScore) after computeRankScore', () => {
    const ctx = baseCtx({
      watchlistMissing: true,
      personalTokens: ['omnipotent', 'vault', 'scoring', 'digest'],
    });
    const [scored] = scoreDigestSignals(
      [
        {
          section: 'headlines',
          sourceType: 'newsapi',
          title: 'Omnipotent vault scoring digest weekly update',
          rank: 1,
        },
      ],
      ctx,
    );

    const expectedRankScore = computeRankScore(
      scored.scores,
      Object.hasOwn(scored, 'normalizedEngagement') ? scored.normalizedEngagement : null,
    );
    assert.equal(scored.rankScore, expectedRankScore);
    assert.equal(scored.disposition, deriveDisposition(scored.scores, scored.rankScore));
  });
});

describe('parseDigestSignalsJson', () => {
  it('returns null for missing or invalid JSON', () => {
    assert.equal(parseDigestSignalsJson(undefined), null);
    assert.equal(parseDigestSignalsJson('not-json'), null);
    assert.equal(parseDigestSignalsJson('{"signals":[]}'), null);
  });

  it('returns object array for valid JSON array', () => {
    assert.deepEqual(parseDigestSignalsJson('[{"title":"A"}]'), [{ title: 'A' }]);
  });
});

describe('runScoreDigestSignalsCli', () => {
  it('returns [] with stderr warning when DIGEST_SIGNALS_JSON is missing', async () => {
    const stderrChunks = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    };
    try {
      const result = await runScoreDigestSignalsCli({});
      assert.deepEqual(result, []);
      assert.ok(stderrChunks.join('').includes('score-digest-signals: warning'));
      assert.ok(stderrChunks.join('').includes('DIGEST_SIGNALS_JSON'));
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it('passthrough unscored signals on scoring failure', async () => {
    const signals = [{ section: 'headlines', sourceType: 'newsapi', title: 'Fail path', rank: 1 }];
    const badSignal = {};
    Object.defineProperty(badSignal, 'sourceType', {
      get() {
        throw new Error('simulated scoring failure');
      },
    });
    const stderrChunks = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    };
    try {
      const result = await scoreDigestSignalsSafe([badSignal, ...signals], {});
      assert.deepEqual(result, [badSignal, ...signals]);
      assert.ok(stderrChunks.join('').includes('score-digest-signals: warning'));
      assert.ok(stderrChunks.join('').includes('simulated scoring failure'));
    } finally {
      process.stderr.write = originalWrite;
    }
  });
});

describe('score-digest-signals CLI', () => {
  it('writes scored JSON array to stdout on success', async () => {
    const { stdout } = await execFileAsync('node', [scoreScript], {
      env: {
        ...process.env,
        DIGEST_SIGNALS_JSON: JSON.stringify([
          {
            section: 'headlines',
            sourceType: 'newsapi',
            title: 'CLI scored headline',
            rank: 1,
          },
        ]),
        DIGEST_RUN_AT: String(Date.parse('2026-06-09T12:00:00Z')),
        HOME: join(tmpdir(), 'score-cli-missing-operator'),
        CNS_REPO_ROOT: join(tmpdir(), 'score-cli-missing-repo'),
      },
    });

    const parsed = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].title, 'CLI scored headline');
    assert.ok(parsed[0].scores);
    assert.equal(typeof parsed[0].rankScore, 'number');
    assert.equal(parsed[0].rank, 1);
  });

  it('exits 0 with [] stdout when DIGEST_SIGNALS_JSON is invalid', async () => {
    const { stdout, stderr } = await execFileAsync('node', [scoreScript], {
      env: {
        ...process.env,
        DIGEST_SIGNALS_JSON: 'not-json',
      },
    });

    assert.equal(JSON.parse(stdout.trim()).length, 0);
    assert.match(stderr, /score-digest-signals: warning/);
  });
});
