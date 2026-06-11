// score-digest-signals.mjs — Epic 64 dimension scoring (Stories 64-2..64-5)
// Computes five independent 0–100 dimension scores, engagement normalization, rankScore, and derived disposition.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { f1, tokenizeForScoring } from '../../../session-close/lib/notebook-scorer.mjs';
import { resolveOperatorHome } from './fetch-arxiv-rss.mjs';

const EPIC_KEY_RE = /^epic-(\d+)$/;
const STORY_KEY_RE = /^(\d+)-\d+-/;
const BREAKING_TITLE_RE =
  /\b(breaking|launch|released|announces|emergency|critical|cve-\d|outage|today)\b/i;
const NOVELTY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** ADR-E67-004 — nexus-goals.yaml limits (anti-drift surface). */
export const NEXUS_GOALS_MAX_PHRASES = 20;
export const DEFAULT_GOAL_WEIGHT = 2.0;

const SOURCE_PRIOR = {
  newsapi: 15,
  hackernews: 10,
  google_trends: 10,
  deep_signal: 5,
  arxiv: 0,
  github: 5,
  reddit: 8,
  producthunt: 8,
  bluesky: 7,
  rss: 5,
};

const TREND_PROXY_PRIOR = {
  google_trends: 40,
  hackernews: 45,
  newsapi: 35,
  arxiv: 25,
  deep_signal: 50,
  github: 40,
  reddit: 42,
  producthunt: 42,
  bluesky: 38,
  rss: 30,
};

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = join(MODULE_DIR, '..', '..', '..', '..');

/** @typedef {'newsapi' | 'hackernews' | 'google_trends' | 'arxiv' | 'deep_signal' | 'github' | 'reddit' | 'producthunt' | 'bluesky' | 'rss'} DigestSourceType */
/**
 * @typedef {{
 *   title: string,
 *   summary?: string,
 *   sourceType: DigestSourceType,
 *   sourceMetadata?: {
 *     publishedAt?: string,
 *     normalizedValue?: number,
 *     points?: number,
 *     commentCount?: number,
 *     stars?: number,
 *     forks?: number,
 *     upvotes?: number,
 *   },
 * }} DigestSignal
 * @typedef {{
 *   title: string,
 *   sourceType?: string,
 *   seenAt?: number,
 * }} NoveltyHistoryEntry
 * @typedef {{
 *   domainTokens: string[],
 *   personalTokens: string[],
 *   goalWeightedTokens: Array<{ token: string, weight: number }>,
 *   epicNumericTokens: string[],
 *   noveltyHistoryEntries: NoveltyHistoryEntry[],
 *   runAt: number,
 *   watchlistMissing: boolean,
 * }} ScoringContext
 * @typedef {{
 *   relevance: number,
 *   personalRelevance: number,
 *   novelty: number,
 *   momentum: number,
 *   urgency: number,
 * }} DimensionScores
 */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Architecture §6.1 engagement caps — normative constants (anti-drift surface). */
export const HN_POINTS_CAP = 500;
export const HN_COMMENTS_CAP = 200;
export const GH_STARS_CAP = 50000;
export const GH_FORKS_CAP = 5000;
export const RD_UPVOTES_CAP = 10000;
export const RD_COMMENTS_CAP = 2000;
export const BSKY_LIKES_CAP = 20000;
export const BSKY_REPOSTS_CAP = 5000;
export const BSKY_REPLIES_CAP = 2000;
export const BSKY_QUOTES_CAP = 1000;

/** Architecture §8.1 rankScore weights — normative constants (anti-drift surface). */
export const RANK_WEIGHT_PERSONAL = 0.3;
export const RANK_WEIGHT_RELEVANCE = 0.2;
export const RANK_WEIGHT_MOMENTUM = 0.2;
export const RANK_WEIGHT_MOMENTUM_NO_ENGAGEMENT = 0.25;
export const RANK_WEIGHT_URGENCY = 0.15;
export const RANK_WEIGHT_NOVELTY = 0.1;
export const RANK_WEIGHT_NORMALIZED_ENGAGEMENT = 0.05;

/**
 * Log-scaled normalization to 0–100 per architecture §6.1.
 *
 * @param {number} value
 * @param {number} cap
 * @returns {number}
 */
export function logNorm(value, cap) {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  if (cap <= 0) {
    return 0;
  }
  const scaled = (100 * Math.log10(1 + v)) / Math.log10(1 + cap);
  return Math.round(clamp(scaled, 0, 100));
}

/**
 * Map per-source raw engagement onto a common 0–100 scale (FR-11).
 * Raw fields read only here — ADR-E64-003: scoreMomentum consumes normalizedEngagement only.
 *
 * @param {DigestSignal} signal
 * @returns {number | null}
 */
export function normalizeEngagement(signal) {
  const meta = signal.sourceMetadata ?? {};
  const commentCount = meta.commentCount;

  switch (signal.sourceType) {
    case 'hackernews': {
      if (!Number.isFinite(meta.points)) {
        return null;
      }
      return Math.round(
        0.8 * logNorm(meta.points, HN_POINTS_CAP) +
          0.2 * logNorm(commentCount, HN_COMMENTS_CAP),
      );
    }
    case 'github': {
      if (!Number.isFinite(meta.stars)) {
        return null;
      }
      return Math.round(
        0.85 * logNorm(meta.stars, GH_STARS_CAP) +
          0.15 * logNorm(meta.forks, GH_FORKS_CAP),
      );
    }
    case 'reddit':
    case 'producthunt': {
      if (!Number.isFinite(meta.upvotes)) {
        return null;
      }
      return Math.round(
        0.75 * logNorm(meta.upvotes, RD_UPVOTES_CAP) +
          0.25 * logNorm(commentCount, RD_COMMENTS_CAP),
      );
    }
    case 'bluesky': {
      const likes = meta.likes;
      const reposts = meta.reposts;
      const replies = meta.replies;
      const quotes = meta.quotes;
      const hasEngagement = [likes, reposts, replies, quotes].some(
        (value) => Number.isFinite(value) && Number(value) > 0,
      );
      if (!hasEngagement) {
        return null;
      }
      return Math.round(
        0.4 * logNorm(likes, BSKY_LIKES_CAP) +
          0.3 * logNorm(reposts, BSKY_REPOSTS_CAP) +
          0.2 * logNorm(replies, BSKY_REPLIES_CAP) +
          0.1 * logNorm(quotes, BSKY_QUOTES_CAP),
      );
    }
    case 'newsapi':
    case 'arxiv':
    case 'deep_signal':
    case 'google_trends':
      return null;
    default:
      return null;
  }
}

/**
 * @param {string[]} tokensA
 * @param {string[]} tokensB
 * @returns {number}
 */
export function f1Score(tokensA, tokensB) {
  return Math.round(clamp(f1(tokensA, tokensB) * 100, 0, 100));
}

/**
 * Weighted F1 for personal relevance tiers (ADR-E67-004 FR-7).
 *
 * @param {string[]} signalTokens
 * @param {Array<{ token: string, weight: number }>} weightedRefTokens
 * @returns {number}
 */
export function weightedPersonalF1(signalTokens, weightedRefTokens) {
  if (signalTokens.length === 0 || weightedRefTokens.length === 0) {
    return 0;
  }
  const signalSet = new Set(signalTokens);
  let weightedIntersection = 0;
  let totalRefWeight = 0;
  for (const { token, weight } of weightedRefTokens) {
    const w = Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_GOAL_WEIGHT;
    totalRefWeight += w;
    if (signalSet.has(token)) {
      weightedIntersection += w;
    }
  }
  if (weightedIntersection === 0 || totalRefWeight === 0) {
    return 0;
  }
  const precision = weightedIntersection / signalTokens.length;
  const recall = weightedIntersection / totalRefWeight;
  const denominator = precision + recall;
  if (denominator === 0) {
    return 0;
  }
  const f1val = (2 * precision * recall) / denominator;
  return Math.round(clamp(f1val * 100, 0, 100));
}

/**
 * @param {string} title
 * @param {string} [summary]
 * @returns {string[]}
 */
export function tokenizeSignalText(title, summary) {
  const text = `${title ?? ''} ${summary ?? ''}`.trim();
  return tokenizeForScoring(text);
}

/**
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  return String(title ?? '').trim().toLowerCase();
}

/**
 * @param {string} yaml
 * @returns {{ domainKeywords: string[], personalKeywords: string[] }}
 */
export function parseWatchlistYaml(yaml) {
  /** @type {string[]} */
  const domainKeywords = [];
  /** @type {string[]} */
  const personalKeywords = [];
  let section = null;

  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (/^keywords:\s*$/.test(trimmed)) {
      section = 'keywords';
      continue;
    }
    if (/^personal:\s*$/.test(trimmed)) {
      section = 'personal';
      continue;
    }
    if (/^[A-Za-z0-9_]+:\s*$/.test(trimmed) && !trimmed.startsWith('-')) {
      section = null;
      continue;
    }

    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (!listMatch) {
      continue;
    }

    let value = listMatch[1].trim();
    const keywordMatch = value.match(/^keyword:\s*(.+)$/i);
    if (keywordMatch) {
      value = keywordMatch[1].trim().replace(/^['"]|['"]$/g, '');
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
    }

    if (!value) {
      continue;
    }

    if (section === 'personal') {
      personalKeywords.push(value);
    } else if (section === 'keywords') {
      domainKeywords.push(value);
    }
  }

  return { domainKeywords, personalKeywords };
}

/**
 * @param {string} yaml
 * @returns {{ key: string, status: string }[]}
 */
export function parseDevelopmentStatus(yaml) {
  /** @type {{ key: string, status: string }[]} */
  const entries = [];
  let inSection = false;

  for (const line of yaml.split('\n')) {
    if (/^development_status:\s*$/.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) {
      continue;
    }
    const match = line.match(/^ {2}([^:]+):\s*(\S+)(?:\s+#.*)?$/);
    if (match) {
      entries.push({ key: match[1].trim(), status: match[2].trim() });
    }
  }

  return entries;
}

/**
 * Line-safe subset parser for ~/.hermes/nexus-goals.yaml (ADR-E67-004).
 *
 * @param {string} yaml
 * @returns {{ version: number | null, goals: { phrase: string, weight: number }[], malformed: boolean }}
 */
export function parseNexusGoalsYaml(yaml) {
  /** @type {number | null} */
  let version = null;
  let inGoals = false;
  /** @type {string | null} */
  let currentPhrase = null;
  let currentWeight = DEFAULT_GOAL_WEIGHT;
  /** @type {{ phrase: string, weight: number }[]} */
  const goals = [];
  let sawGoalsSection = false;
  let malformed = false;

  const flushCurrent = () => {
    if (currentPhrase) {
      const weight =
        Number.isFinite(currentWeight) && currentWeight > 0
          ? currentWeight
          : DEFAULT_GOAL_WEIGHT;
      goals.push({ phrase: currentPhrase, weight });
      currentPhrase = null;
      currentWeight = DEFAULT_GOAL_WEIGHT;
    }
  };

  for (const rawLine of yaml.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const versionMatch = trimmed.match(/^version:\s*(\d+)\s*$/);
    if (versionMatch) {
      version = Number(versionMatch[1]);
      continue;
    }

    if (/^goals:\s*$/.test(trimmed)) {
      inGoals = true;
      sawGoalsSection = true;
      continue;
    }

    if (inGoals && /^[A-Za-z0-9_]+:\s*$/.test(trimmed) && !trimmed.startsWith('-')) {
      flushCurrent();
      inGoals = false;
      continue;
    }

    if (!inGoals) {
      if (/^-\s+/.test(trimmed)) {
        malformed = true;
      }
      continue;
    }

    const listPhraseMatch = trimmed.match(/^-\s+phrase:\s*(.+)$/i);
    if (listPhraseMatch) {
      flushCurrent();
      currentPhrase = listPhraseMatch[1].trim().replace(/^['"]|['"]$/g, '');
      currentWeight = DEFAULT_GOAL_WEIGHT;
      if (!currentPhrase) {
        malformed = true;
      }
      continue;
    }

    const bareListMatch = trimmed.match(/^-\s+(.+)$/);
    if (bareListMatch && !/^phrase:/i.test(bareListMatch[1]) && !/^weight:/i.test(bareListMatch[1])) {
      flushCurrent();
      currentPhrase = bareListMatch[1].trim().replace(/^['"]|['"]$/g, '');
      currentWeight = DEFAULT_GOAL_WEIGHT;
      if (!currentPhrase) {
        malformed = true;
      }
      continue;
    }

    const phraseMatch = rawLine.match(/^\s+phrase:\s*(.+)$/i);
    if (phraseMatch) {
      if (!currentPhrase) {
        currentPhrase = phraseMatch[1].trim().replace(/^['"]|['"]$/g, '');
        currentWeight = DEFAULT_GOAL_WEIGHT;
        if (!currentPhrase) {
          malformed = true;
        }
      }
      continue;
    }

    const weightMatch =
      rawLine.match(/^\s+weight:\s*([\d.]+)\s*$/i) || trimmed.match(/^weight:\s*([\d.]+)\s*$/i);
    if (weightMatch) {
      if (!currentPhrase) {
        malformed = true;
        continue;
      }
      const parsedWeight = Number(weightMatch[1]);
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        malformed = true;
      } else {
        currentWeight = parsedWeight;
      }
      continue;
    }

    if (/^-\s+/.test(trimmed) || /^\s+\w+:/.test(rawLine)) {
      malformed = true;
    }
  }

  flushCurrent();

  if (sawGoalsSection && version == null) {
    malformed = true;
  }

  return { version, goals, malformed };
}

/**
 * @param {{ phrase: string, weight: number }[]} goals
 * @returns {Array<{ token: string, weight: number }>}
 */
export function buildGoalWeightedTokens(goals) {
  /** @type {Array<{ token: string, weight: number }>} */
  const goalWeightedTokens = [];
  for (const { phrase, weight } of goals.slice(0, NEXUS_GOALS_MAX_PHRASES)) {
    const w = Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_GOAL_WEIGHT;
    for (const token of tokenizeForScoring(phrase)) {
      goalWeightedTokens.push({ token, weight: w });
    }
  }
  return goalWeightedTokens;
}

/**
 * @param {string} operatorHome
 * @returns {Promise<{ goalWeightedTokens: Array<{ token: string, weight: number }>, diagnostic?: string }>}
 */
export async function loadNexusGoals(operatorHome) {
  const goalsPath = join(operatorHome, '.hermes', 'nexus-goals.yaml');
  try {
    const raw = await readFile(goalsPath, 'utf8');
    const parsed = parseNexusGoalsYaml(raw);

    if (parsed.malformed) {
      return {
        goalWeightedTokens: [],
        diagnostic: 'score-digest-signals: warning — malformed nexus-goals.yaml',
      };
    }

    if (parsed.version !== 1) {
      if (parsed.version != null) {
        return {
          goalWeightedTokens: [],
          diagnostic: `score-digest-signals: warning — unsupported nexus-goals.yaml version ${parsed.version}`,
        };
      }
      return { goalWeightedTokens: [] };
    }

    return {
      goalWeightedTokens: buildGoalWeightedTokens(parsed.goals),
    };
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return { goalWeightedTokens: [] };
    }
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'read error';
    return {
      goalWeightedTokens: [],
      diagnostic: `score-digest-signals: warning — nexus-goals.yaml unreadable (${reason})`,
    };
  }
}

/**
 * @param {{ key: string, status: string }[]} entries
 * @returns {{ sprintTokens: string[], epicNumericTokens: string[] }}
 */
export function extractSprintTokens(entries) {
  const inProgressEpics = new Set();
  /** @type {string[]} */
  const storyKeys = [];

  for (const { key, status } of entries) {
    const epicMatch = key.match(EPIC_KEY_RE);
    if (epicMatch && status === 'in-progress') {
      inProgressEpics.add(key);
      continue;
    }
    const storyMatch = key.match(STORY_KEY_RE);
    if (storyMatch && status === 'in-progress') {
      storyKeys.push(key);
    }
  }

  /** @type {string[]} */
  const sprintTokens = [];
  /** @type {string[]} */
  const epicNumericTokens = [];

  for (const epicKey of inProgressEpics) {
    sprintTokens.push(...tokenizeForScoring(epicKey.replace('-', ' ')));
    const epicNum = epicKey.match(EPIC_KEY_RE)?.[1];
    if (epicNum) {
      epicNumericTokens.push(epicNum);
      sprintTokens.push('epic', epicNum);
    }
  }

  for (const storyKey of storyKeys) {
    sprintTokens.push(...tokenizeForScoring(storyKey.replace(/-/g, ' ')));
  }

  return {
    sprintTokens: [...new Set(sprintTokens)],
    epicNumericTokens: [...new Set(epicNumericTokens)],
  };
}

/**
 * @param {unknown} raw
 * @returns {{ title: string, sourceType?: string, seenAt?: number }[]}
 */
export function parseNoveltyHistoryJson(raw) {
  if (!raw) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  /** @type {{ title: string, sourceType?: string, seenAt?: number }[]} */
  const entries = [];
  for (const item of parsed) {
    if (typeof item === 'string') {
      const title = item.trim();
      if (title) {
        entries.push({ title });
      }
      continue;
    }
    if (item && typeof item === 'object' && typeof item.title === 'string') {
      const title = item.title.trim();
      if (!title) {
        continue;
      }
      const entry = { title };
      if (typeof item.sourceType === 'string' && item.sourceType.trim()) {
        entry.sourceType = item.sourceType.trim();
      }
      if (typeof item.seenAt === 'number' && Number.isFinite(item.seenAt)) {
        entry.seenAt = item.seenAt;
      }
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseKeywordCandidatesPersonalTerms(raw) {
  if (!raw) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  /** @type {string[]} */
  const terms = [];
  for (const item of parsed) {
    if (typeof item === 'string') {
      const term = item.trim();
      if (term) {
        terms.push(term);
      }
      continue;
    }
    if (item && typeof item === 'object') {
      const category = typeof item.category === 'string' ? item.category.trim().toLowerCase() : '';
      if (category && category !== 'personal') {
        continue;
      }
      const term =
        typeof item.term === 'string'
          ? item.term.trim()
          : typeof item.keyword === 'string'
            ? item.keyword.trim()
            : '';
      if (term) {
        terms.push(term);
      }
    }
  }
  return terms;
}

/**
 * @param {string} repoRoot
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
function resolveSprintStatusPath(repoRoot, env) {
  const override = String(env.MORNING_DIGEST_SPRINT_STATUS_PATH ?? '').trim();
  if (override) {
    return override;
  }
  return join(repoRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<ScoringContext>}
 */
export async function loadScoringContext(env = process.env) {
  const repoRoot = String(env.CNS_REPO_ROOT ?? DEFAULT_REPO_ROOT).trim() || DEFAULT_REPO_ROOT;
  const runAt = Number(env.DIGEST_RUN_AT);
  const resolvedRunAt = Number.isFinite(runAt) && runAt > 0 ? runAt : Date.now();

  const operatorHome = await resolveOperatorHome(env);
  const nexusGoals = await loadNexusGoals(operatorHome);
  if (nexusGoals.diagnostic) {
    console.error(nexusGoals.diagnostic);
  }
  const goalWeightedTokens = nexusGoals.goalWeightedTokens;
  const goalTokenSet = new Set(goalWeightedTokens.map(({ token }) => token));

  const watchlistPath = join(operatorHome, '.hermes', 'trend-watchlist.yaml');

  /** @type {string[]} */
  let domainKeywords;
  /** @type {string[]} */
  let personalWatchlistKeywords;
  /** @type {boolean} */
  let watchlistMissing;
  try {
    const watchlistRaw = await readFile(watchlistPath, 'utf8');
    const parsed = parseWatchlistYaml(watchlistRaw);
    domainKeywords = parsed.domainKeywords;
    personalWatchlistKeywords = parsed.personalKeywords;
    watchlistMissing = false;
  } catch {
    domainKeywords = [];
    personalWatchlistKeywords = [];
    watchlistMissing = true;
  }

  /** @type {string[]} */
  let sprintTokens;
  /** @type {string[]} */
  let epicNumericTokens;
  try {
    const sprintPath = resolveSprintStatusPath(repoRoot, env);
    const sprintRaw = await readFile(sprintPath, 'utf8');
    const sprintParsed = extractSprintTokens(parseDevelopmentStatus(sprintRaw));
    sprintTokens = sprintParsed.sprintTokens;
    epicNumericTokens = sprintParsed.epicNumericTokens;
  } catch {
    sprintTokens = [];
    epicNumericTokens = [];
  }

  const projectEntities = String(env.MORNING_DIGEST_PROJECT_ENTITIES ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const keywordCandidateTerms = parseKeywordCandidatesPersonalTerms(
    env.DIGEST_KEYWORD_CANDIDATES_JSON,
  );

  const domainTokens = [
    ...new Set(domainKeywords.flatMap((keyword) => tokenizeForScoring(keyword))),
  ];
  const personalTokens = [
    ...new Set(
      [
        ...sprintTokens,
        ...projectEntities.flatMap((entity) => tokenizeForScoring(entity)),
        ...personalWatchlistKeywords.flatMap((keyword) => tokenizeForScoring(keyword)),
        ...keywordCandidateTerms.flatMap((term) => tokenizeForScoring(term)),
      ].filter((token) => !goalTokenSet.has(token)),
    ),
  ];

  const noveltyHistoryAll = parseNoveltyHistoryJson(env.DIGEST_NOVELTY_HISTORY_JSON);
  const noveltyCutoff = resolvedRunAt - NOVELTY_LOOKBACK_MS;
  // v1 string[] entries lack seenAt — treat the full array as the lookback set until orchestration adds dates.
  const noveltyHistoryEntries = noveltyHistoryAll.filter((entry) => {
    if (entry.seenAt == null) {
      return true;
    }
    return entry.seenAt >= noveltyCutoff && entry.seenAt <= resolvedRunAt;
  });

  return {
    domainTokens,
    personalTokens,
    goalWeightedTokens,
    epicNumericTokens,
    noveltyHistoryEntries,
    runAt: resolvedRunAt,
    watchlistMissing,
  };
}

/**
 * @param {DigestSignal} signal
 * @param {ScoringContext} ctx
 * @returns {number}
 */
export function scoreRelevance(signal, ctx) {
  if (ctx.watchlistMissing || ctx.domainTokens.length === 0) {
    return 25;
  }
  const signalTokens = tokenizeSignalText(signal.title, signal.summary);
  return f1Score(signalTokens, ctx.domainTokens);
}

/**
 * @param {DigestSignal} signal
 * @param {ScoringContext} ctx
 * @returns {number}
 */
export function scorePersonalRelevance(signal, ctx) {
  const signalTokens = tokenizeSignalText(signal.title, signal.summary);
  const baseTier = weightedPersonalF1(
    signalTokens,
    ctx.personalTokens.map((token) => ({ token, weight: 1 })),
  );
  const goalTier = weightedPersonalF1(signalTokens, ctx.goalWeightedTokens ?? []);
  const combined = Math.max(baseTier, goalTier);
  const epicBonus = ctx.epicNumericTokens.some((token) => signalTokens.includes(token)) ? 15 : 0;
  return clamp(combined + epicBonus, 0, 100);
}

/**
 * @param {string[]} signalTokens
 * @param {string[]} historyTokens
 * @returns {number}
 */
export function overlapRatio(signalTokens, historyTokens) {
  if (signalTokens.length === 0) {
    return 0;
  }
  const historySet = new Set(historyTokens);
  let intersection = 0;
  for (const token of signalTokens) {
    if (historySet.has(token)) {
      intersection += 1;
    }
  }
  return intersection / Math.max(1, signalTokens.length);
}

/**
 * @param {DigestSignal} signal
 * @param {ScoringContext} ctx
 * @returns {number}
 */
export function scoreNovelty(signal, ctx) {
  const history = ctx.noveltyHistoryEntries ?? [];
  if (history.length === 0) {
    return 100;
  }

  const normalizedTitle = normalizeTitle(signal.title);
  const signalTokens = tokenizeSignalText(signal.title, signal.summary);

  for (const entry of history) {
    if (normalizeTitle(entry.title) === normalizedTitle) {
      return 10;
    }
  }

  for (const entry of history) {
    const historyTokens = tokenizeSignalText(entry.title);
    const ratio = overlapRatio(signalTokens, historyTokens);
    if (ratio >= 0.6) {
      return 25;
    }
  }

  for (const entry of history) {
    const historyTokens = tokenizeSignalText(entry.title);
    const ratio = overlapRatio(signalTokens, historyTokens);
    if (ratio >= 0.3) {
      return 45;
    }
  }

  const historySourceTypes = new Set(
    history.map((entry) => entry.sourceType).filter((value) => typeof value === 'string'),
  );
  if (signal.sourceType && historySourceTypes.has(signal.sourceType)) {
    return 65;
  }

  return 90;
}

/**
 * @param {string | undefined} publishedAt
 * @param {number} runAt
 * @returns {number}
 */
export function recencyScore(publishedAt, runAt) {
  if (!publishedAt) {
    return 15;
  }
  const publishedMs = Date.parse(publishedAt);
  if (!Number.isFinite(publishedMs)) {
    return 15;
  }
  const ageHours = (runAt - publishedMs) / (60 * 60 * 1000);
  if (ageHours < 0) {
    return 95;
  }
  if (ageHours <= 6) {
    return 95;
  }
  if (ageHours <= 24) {
    return 80;
  }
  if (ageHours <= 72) {
    return 55;
  }
  if (ageHours <= 7 * 24) {
    return 35;
  }
  return 15;
}

/**
 * @param {string} title
 * @returns {number}
 */
export function breakingBonus(title) {
  return BREAKING_TITLE_RE.test(String(title ?? '')) ? 20 : 0;
}

/**
 * @param {DigestSignal} signal
 * @param {ScoringContext} ctx
 * @returns {number}
 */
export function scoreUrgency(signal, ctx) {
  const publishedAt = signal.sourceMetadata?.publishedAt;
  const recency = recencyScore(publishedAt, ctx.runAt);
  const sourcePrior = SOURCE_PRIOR[signal.sourceType] ?? 0;
  const breaking = breakingBonus(signal.title);
  return clamp(Math.round(0.7 * recency + 0.2 * sourcePrior + breaking), 0, 100);
}

/**
 * @param {DigestSignal} signal
 * @returns {number}
 */
export function trendProxyForSignal(signal) {
  if (signal.sourceType === 'google_trends') {
    const normalizedValue = signal.sourceMetadata?.normalizedValue;
    if (typeof normalizedValue === 'number' && Number.isFinite(normalizedValue)) {
      return clamp(Math.round(normalizedValue * 100), 0, 100);
    }
    return TREND_PROXY_PRIOR.google_trends;
  }
  return TREND_PROXY_PRIOR[signal.sourceType] ?? 0;
}

/**
 * Path A uses normalizedEngagement only — ADR-E64-003: never read raw engagement fields here.
 *
 * @param {DigestSignal} signal
 * @param {number | null | undefined} normalizedEngagement
 * @param {ScoringContext} ctx
 * @returns {number}
 */
export function scoreMomentum(signal, normalizedEngagement, ctx) {
  void ctx;
  const trendProxy = trendProxyForSignal(signal);

  if (normalizedEngagement == null || !Number.isFinite(normalizedEngagement)) {
    return clamp(Math.round(trendProxy), 0, 100);
  }

  return clamp(
    Math.round(0.75 * normalizedEngagement + 0.25 * trendProxy),
    0,
    100,
  );
}

/**
 * Derive categorical disposition from dimension scores and optional rankScore.
 * Architecture §7: first-match-wins threshold table. Rule 1 (escalate) ignores rankScore.
 *
 * @param {DimensionScores} scores
 * @param {number | null | undefined} rankScore
 * @returns {'priority' | 'watch' | 'ignore' | 'escalate'}
 */
export function deriveDisposition(scores, rankScore) {
  const { relevance, personalRelevance, novelty, momentum, urgency } = scores;

  if (urgency >= 75 && (personalRelevance >= 60 || relevance >= 75)) {
    return 'escalate';
  }

  const rank = rankScore;
  if (Number.isFinite(rank)) {
    if (rank >= 70 && personalRelevance >= 50) {
      return 'priority';
    }

    const dimMax = Math.max(relevance, personalRelevance, novelty, momentum, urgency);
    if (rank < 40 && dimMax < 50) {
      return 'ignore';
    }
  }

  return 'watch';
}

/**
 * Composite rankScore from dimension scores and optional normalizedEngagement (FR-13).
 * When engagement is absent, its 0.05 weight redistributes to momentum (0.25).
 *
 * @param {DimensionScores} scores
 * @param {number | null | undefined} normalizedEngagement
 * @returns {number}
 */
export function computeRankScore(scores, normalizedEngagement) {
  const { personalRelevance, relevance, momentum, urgency, novelty } = scores;
  const hasEngagement =
    normalizedEngagement != null && Number.isFinite(normalizedEngagement);
  const raw = hasEngagement
    ? RANK_WEIGHT_PERSONAL * personalRelevance +
      RANK_WEIGHT_RELEVANCE * relevance +
      RANK_WEIGHT_MOMENTUM * momentum +
      RANK_WEIGHT_URGENCY * urgency +
      RANK_WEIGHT_NOVELTY * novelty +
      RANK_WEIGHT_NORMALIZED_ENGAGEMENT * normalizedEngagement
    : RANK_WEIGHT_PERSONAL * personalRelevance +
      RANK_WEIGHT_RELEVANCE * relevance +
      RANK_WEIGHT_MOMENTUM_NO_ENGAGEMENT * momentum +
      RANK_WEIGHT_URGENCY * urgency +
      RANK_WEIGHT_NOVELTY * novelty;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * @param {Record<string, unknown>[]} signals
 * @param {ScoringContext} ctx
 * @returns {Array<Record<string, unknown>>}
 */
export function scoreDigestSignals(signals, ctx) {
  const enriched = signals.map((signal, originalIndex) => {
    const normalizedEngagement = normalizeEngagement(/** @type {DigestSignal} */ (signal));
    const scores = {
      relevance: scoreRelevance(/** @type {DigestSignal} */ (signal), ctx),
      personalRelevance: scorePersonalRelevance(/** @type {DigestSignal} */ (signal), ctx),
      novelty: scoreNovelty(/** @type {DigestSignal} */ (signal), ctx),
      urgency: scoreUrgency(/** @type {DigestSignal} */ (signal), ctx),
      momentum: scoreMomentum(
        /** @type {DigestSignal} */ (signal),
        normalizedEngagement,
        ctx,
      ),
    };
    const rankScore = computeRankScore(scores, normalizedEngagement);
    const disposition = deriveDisposition(scores, rankScore);
    /** @type {Record<string, unknown>} */
    const out = {
      ...signal,
      scores,
      disposition,
      rankScore,
      _oi: originalIndex,
    };
    if (normalizedEngagement != null && Number.isFinite(normalizedEngagement)) {
      out.normalizedEngagement = normalizedEngagement;
    }
    return out;
  });

  enriched.sort((a, b) => {
    const rankDiff = /** @type {number} */ (b.rankScore) - /** @type {number} */ (a.rankScore);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return /** @type {number} */ (a._oi) - /** @type {number} */ (b._oi);
  });

  return enriched.map(({ _oi, ...signal }, index) => {
    void _oi;
    return {
      ...signal,
      rank: index + 1,
    };
  });
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>[] | null}
 */
export function parseDigestSignalsJson(raw) {
  if (!raw) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  return parsed.filter((item) => item && typeof item === 'object');
}

/**
 * @param {Record<string, unknown>[]} signals
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function scoreDigestSignalsSafe(signals, env = process.env) {
  try {
    const ctx = await loadScoringContext(env);
    return scoreDigestSignals(signals, ctx);
  } catch (err) {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`score-digest-signals: warning — ${reason}`);
    return signals;
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function runScoreDigestSignalsCli(env = process.env) {
  const parsed = parseDigestSignalsJson(env.DIGEST_SIGNALS_JSON);
  if (parsed == null) {
    console.error('score-digest-signals: warning — missing or invalid DIGEST_SIGNALS_JSON');
    return [];
  }

  return scoreDigestSignalsSafe(parsed, env);
}

async function main() {
  const scored = await runScoreDigestSignalsCli();
  process.stdout.write(`${JSON.stringify(scored)}\n`);
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('score-digest-signals.mjs');

if (isMain) {
  main().catch((err) => {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`score-digest-signals: warning — ${reason}`);
    process.stdout.write('[]\n');
    process.exit(0);
  });
}
