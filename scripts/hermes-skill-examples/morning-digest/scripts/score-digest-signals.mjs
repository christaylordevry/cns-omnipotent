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

/** Epic 68 FR-4 — nexus-people.yaml limits (anti-drift surface). */
export const NEXUS_PEOPLE_MAX_PEOPLE = 30;
export const NEXUS_PEOPLE_MAX_HANDLES_PER_PLATFORM = 3;
export const DEFAULT_PERSON_WEIGHT = 2.5;

/** Epic 68 FR-5 — personalRelevance v3 people watchlist bonuses (addendum A2). */
export const PEOPLE_HANDLE_MATCH_BONUS = 20;
export const PEOPLE_NAME_MATCH_BONUS = 10;
export const PEOPLE_NAME_F1_THRESHOLD = 30;

const SOURCE_PRIOR = {
  newsapi: 15,
  hackernews: 10,
  google_trends: 10,
  deep_signal: 5,
  arxiv: 0,
  github: 5,
  reddit: 8,
  producthunt: 8,
  twitter: 9,
  bluesky: 7,
  youtube: 8,
  tiktok: 8,
  instagram: 8,
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
  twitter: 40,
  bluesky: 38,
  youtube: 40,
  tiktok: 40,
  instagram: 40,
  rss: 30,
};

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = join(MODULE_DIR, '..', '..', '..', '..');

/** @typedef {'newsapi' | 'hackernews' | 'google_trends' | 'arxiv' | 'deep_signal' | 'github' | 'reddit' | 'producthunt' | 'twitter' | 'bluesky' | 'youtube' | 'tiktok' | 'instagram' | 'rss'} DigestSourceType */
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
 *     authorHandle?: string,
 *   },
 * }} DigestSignal
 * @typedef {{
 *   title: string,
 *   sourceType?: string,
 *   seenAt?: number,
 * }} NoveltyHistoryEntry
 * @typedef {{
 *   name: string,
 *   handles: Record<string, string[]>,
 *   tags: string[],
 *   weight: number,
 * }} NexusPerson
 * @typedef {{
 *   domainTokens: string[],
 *   personalTokens: string[],
 *   goalWeightedTokens: Array<{ token: string, weight: number }>,
 *   nexusPeople: NexusPerson[],
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
export const YT_VIEWS_CAP = 1_000_000;
export const YT_LIKES_CAP = 50_000;
export const YT_COMMENTS_CAP = 10_000;
export const X_LIKES_CAP = 50000;
export const X_REPOSTS_CAP = 10000;
export const X_REPLIES_CAP = 5000;
export const X_QUOTES_CAP = 2000;

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
    case 'twitter': {
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
        0.55 * logNorm(likes, X_LIKES_CAP) +
          0.25 * logNorm(reposts, X_REPOSTS_CAP) +
          0.15 * logNorm(replies, X_REPLIES_CAP) +
          0.05 * logNorm(quotes, X_QUOTES_CAP),
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
    case 'youtube':
    case 'tiktok':
    case 'instagram': {
      const views = meta.viewCount;
      const likes = meta.likes;
      const comments = meta.commentCount;
      const hasEngagement = [views, likes, comments].some(
        (value) => Number.isFinite(value) && Number(value) > 0,
      );
      if (!hasEngagement) {
        return null;
      }
      return Math.round(
        0.6 * logNorm(views, YT_VIEWS_CAP) +
          0.3 * logNorm(likes, YT_LIKES_CAP) +
          0.1 * logNorm(comments, YT_COMMENTS_CAP),
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
 * @param {string} raw
 * @returns {string}
 */
export function normalizePeopleHandle(raw) {
  return String(raw).trim().replace(/^@+/, '').toLowerCase();
}

/**
 * @param {string} raw Bracketed inline YAML flow array, e.g. `["llm", "research"]`.
 * @returns {string[] | null}
 */
function parseInlineTagArray(raw) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return inner
    .split(',')
    .map((part) => {
      const token = part.trim();
      const quoted = token.match(/^['"](.+)['"]$/);
      return quoted ? quoted[1].trim() : token;
    })
    .filter((part) => part.length > 0);
}

/**
 * @param {Record<string, string[]>} handles
 * @returns {Record<string, string[]>}
 */
function finalizePeopleHandles(handles) {
  /** @type {Record<string, string[]>} */
  const result = {};
  for (const [platform, rawHandles] of Object.entries(handles)) {
    const key = platform.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const normalized = [
      ...new Set(
        rawHandles.map((handle) => normalizePeopleHandle(handle)).filter((handle) => handle.length > 0),
      ),
    ];
    result[key] = normalized.slice(0, NEXUS_PEOPLE_MAX_HANDLES_PER_PLATFORM);
  }
  return result;
}

/**
 * Line-safe subset parser for ~/.hermes/nexus-people.yaml (Epic 68 FR-4).
 *
 * @param {string} yaml
 * @returns {{ version: number | null, people: NexusPerson[], malformed: boolean }}
 */
export function parseNexusPeopleYaml(yaml) {
  /** @type {number | null} */
  let version = null;
  let inPeople = false;
  let inHandles = false;
  let inTags = false;
  /** @type {string | null} */
  let currentPlatform = null;
  /** @type {string | null} */
  let currentName = null;
  /** @type {Record<string, string[]>} */
  let currentHandles = {};
  /** @type {string[]} */
  let currentTags = [];
  let currentWeight = DEFAULT_PERSON_WEIGHT;
  /** @type {NexusPerson[]} */
  const people = [];
  let sawPeopleSection = false;
  let malformed = false;

  const flushCurrent = () => {
    if (currentName) {
      const weight =
        Number.isFinite(currentWeight) && currentWeight > 0
          ? currentWeight
          : DEFAULT_PERSON_WEIGHT;
      people.push({
        name: currentName,
        handles: finalizePeopleHandles(currentHandles),
        tags: [...currentTags],
        weight,
      });
    }
    currentName = null;
    currentHandles = {};
    currentTags = [];
    currentWeight = DEFAULT_PERSON_WEIGHT;
    inHandles = false;
    inTags = false;
    currentPlatform = null;
  };

  const addHandle = (platform, value) => {
    const key = platform.trim().toLowerCase();
    const handle = normalizePeopleHandle(value);
    if (!key || !handle) {
      return;
    }
    if (!currentHandles[key]) {
      currentHandles[key] = [];
    }
    currentHandles[key].push(handle);
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

    if (/^people:\s*$/.test(trimmed)) {
      flushCurrent();
      inPeople = true;
      sawPeopleSection = true;
      continue;
    }

    if (
      inPeople &&
      /^[A-Za-z0-9_]+:\s*$/.test(trimmed) &&
      !trimmed.startsWith('-') &&
      !/^\s/.test(rawLine)
    ) {
      flushCurrent();
      inPeople = false;
      continue;
    }

    if (!inPeople) {
      if (/^-\s+/.test(trimmed)) {
        malformed = true;
      }
      continue;
    }

    const listNameMatch = trimmed.match(/^-\s+name:\s*(.+)$/i);
    if (listNameMatch) {
      flushCurrent();
      currentName = listNameMatch[1].trim().replace(/^['"]|['"]$/g, '');
      if (!currentName) {
        malformed = true;
      }
      continue;
    }

    if (/^-\s+/.test(trimmed) && !/^-\s+name:/i.test(trimmed)) {
      if (inTags) {
        const tagMatch = trimmed.match(/^-\s+(.+)$/);
        if (tagMatch) {
          const tag = tagMatch[1].trim().replace(/^['"]|['"]$/g, '');
          if (tag) {
            currentTags.push(tag);
          }
        } else {
          malformed = true;
        }
        continue;
      }
      if (inHandles && currentPlatform) {
        const handleMatch = trimmed.match(/^-\s+(.+)$/);
        if (handleMatch) {
          addHandle(currentPlatform, handleMatch[1]);
        } else {
          malformed = true;
        }
        continue;
      }
      malformed = true;
      continue;
    }

    const handlesSectionMatch = rawLine.match(/^\s+handles:\s*$/i);
    if (handlesSectionMatch && currentName) {
      inHandles = true;
      inTags = false;
      currentPlatform = null;
      continue;
    }

    const tagsSectionMatch = rawLine.match(/^\s+tags:\s*$/i);
    if (tagsSectionMatch && currentName) {
      inHandles = false;
      inTags = true;
      currentPlatform = null;
      continue;
    }

    const tagsInlineMatch = rawLine.match(/^\s+tags:\s+(.+)$/i);
    if (tagsInlineMatch && currentName) {
      inHandles = false;
      inTags = false;
      currentPlatform = null;
      const value = tagsInlineMatch[1].trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        const parsedTags = parseInlineTagArray(value);
        if (!parsedTags || parsedTags.length === 0) {
          malformed = true;
        } else {
          currentTags.push(...parsedTags);
        }
      } else {
        const tag = value.replace(/^['"]|['"]$/g, '');
        if (!tag) {
          malformed = true;
        } else {
          currentTags.push(tag);
        }
      }
      continue;
    }

    const quotedWeightMatch = rawLine.match(/^\s+weight:\s*['"][^'"]+['"]\s*$/i);
    if (quotedWeightMatch && currentName) {
      inHandles = false;
      inTags = false;
      malformed = true;
      continue;
    }

    const weightMatch =
      rawLine.match(/^\s+weight:\s*([\d.]+)\s*$/i) || trimmed.match(/^weight:\s*([\d.]+)\s*$/i);
    if (weightMatch && currentName) {
      inHandles = false;
      inTags = false;
      const parsedWeight = Number(weightMatch[1]);
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        malformed = true;
      } else {
        currentWeight = parsedWeight;
      }
      continue;
    }

    const platformKeyOnlyMatch = rawLine.match(/^\s{4,}(\w+):\s*$/i);
    if (inHandles && currentName && platformKeyOnlyMatch) {
      currentPlatform = platformKeyOnlyMatch[1];
      continue;
    }

    const platformScalarMatch = rawLine.match(/^\s{4,}(\w+):\s*(.+)$/i);
    if (inHandles && currentName && platformScalarMatch) {
      const platform = platformScalarMatch[1];
      if (platform.toLowerCase() === 'tags') {
        malformed = true;
        continue;
      }
      const rawValue = platformScalarMatch[2].trim();
      currentPlatform = null;
      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        const parsedHandles = parseInlineTagArray(rawValue);
        if (parsedHandles === null) {
          malformed = true;
        } else {
          for (const handle of parsedHandles) {
            addHandle(platform, handle);
          }
        }
      } else {
        const value = rawValue.replace(/^['"]|['"]$/g, '');
        addHandle(platform, value);
      }
      continue;
    }

    const nameMatch = rawLine.match(/^\s+name:\s*(.+)$/i);
    if (nameMatch && !currentName) {
      currentName = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
      if (!currentName) {
        malformed = true;
      }
      continue;
    }

    if ((/^-\s+/.test(trimmed) || /^\s+\w+:/.test(rawLine)) && currentName && !inHandles && !inTags) {
      malformed = true;
    }
  }

  flushCurrent();

  if (sawPeopleSection && version == null) {
    malformed = true;
  }

  return { version, people, malformed };
}

/**
 * @param {string} operatorHome
 * @returns {Promise<{ people: NexusPerson[], diagnostic?: string }>}
 */
export async function loadNexusPeople(operatorHome) {
  const peoplePath = join(operatorHome, '.hermes', 'nexus-people.yaml');
  try {
    const raw = await readFile(peoplePath, 'utf8');
    const parsed = parseNexusPeopleYaml(raw);

    if (parsed.malformed && parsed.people.length === 0) {
      return {
        people: [],
        diagnostic: 'score-digest-signals: warning — malformed nexus-people.yaml',
      };
    }

    if (parsed.version !== 1) {
      if (parsed.version != null) {
        return {
          people: [],
          diagnostic: `score-digest-signals: warning — unsupported nexus-people.yaml version ${parsed.version}`,
        };
      }
      if (parsed.people.length === 0) {
        return { people: [] };
      }
      let salvagePeople = parsed.people;
      if (salvagePeople.length > NEXUS_PEOPLE_MAX_PEOPLE) {
        salvagePeople = salvagePeople.slice(0, NEXUS_PEOPLE_MAX_PEOPLE);
      }
      return {
        people: salvagePeople,
        diagnostic: 'score-digest-signals: warning — malformed nexus-people.yaml (using valid entries)',
      };
    }

    let people = parsed.people;
    if (people.length > NEXUS_PEOPLE_MAX_PEOPLE) {
      people = people.slice(0, NEXUS_PEOPLE_MAX_PEOPLE);
      return {
        people,
        diagnostic: `score-digest-signals: warning — nexus-people.yaml truncated to ${NEXUS_PEOPLE_MAX_PEOPLE} people`,
      };
    }

    if (parsed.malformed) {
      return {
        people,
        diagnostic: 'score-digest-signals: warning — malformed nexus-people.yaml (using valid entries)',
      };
    }

    return { people };
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return { people: [] };
    }
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'read error';
    return {
      people: [],
      diagnostic: `score-digest-signals: warning — nexus-people.yaml unreadable (${reason})`,
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
  const nexusPeopleResult = await loadNexusPeople(operatorHome);
  if (nexusPeopleResult.diagnostic) {
    console.error(nexusPeopleResult.diagnostic);
  }
  const goalWeightedTokens = nexusGoals.goalWeightedTokens;
  const nexusPeople = nexusPeopleResult.people;
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
    nexusPeople,
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
 * @param {NexusPerson[]} nexusPeople
 * @returns {Set<string>}
 */
export function collectNormalizedWatchHandles(nexusPeople) {
  /** @type {Set<string>} */
  const handles = new Set();
  for (const person of nexusPeople) {
    for (const platformHandles of Object.values(person.handles ?? {})) {
      for (const handle of platformHandles) {
        const normalized = normalizePeopleHandle(handle);
        if (normalized.length > 0) {
          handles.add(normalized);
        }
      }
    }
  }
  return handles;
}

/**
 * @param {DigestSignal} signal
 * @param {NexusPerson[]} nexusPeople
 * @returns {{ personName: string, matchedHandle?: string, bonusPoints: number, matchType: 'handle' | 'name' } | null}
 */
export function resolvePeopleMatch(signal, nexusPeople) {
  if (!Array.isArray(nexusPeople) || nexusPeople.length === 0) {
    return null;
  }

  const rawHandle = signal.sourceMetadata?.authorHandle;
  if (typeof rawHandle === 'string' && rawHandle.trim()) {
    const signalNormalized = normalizePeopleHandle(rawHandle);
    if (signalNormalized.length > 0) {
      for (const person of nexusPeople) {
        for (const platformHandles of Object.values(person.handles ?? {})) {
          if (!Array.isArray(platformHandles)) {
            continue;
          }
          for (const handle of platformHandles) {
            const normalized = normalizePeopleHandle(handle);
            if (normalized.length > 0 && normalized === signalNormalized) {
              return {
                personName: person.name,
                matchedHandle: normalized,
                bonusPoints: PEOPLE_HANDLE_MATCH_BONUS,
                matchType: 'handle',
              };
            }
          }
        }
      }
    }
  }

  const signalTokens = tokenizeSignalText(signal.title, signal.summary);
  let bestNameF1 = 0;
  /** @type {string | null} */
  let bestPersonName = null;
  for (const person of nexusPeople) {
    const nameTokens = tokenizeForScoring(person.name ?? '');
    const nameF1 = f1Score(signalTokens, nameTokens);
    if (nameF1 > bestNameF1) {
      bestNameF1 = nameF1;
      bestPersonName = person.name;
    }
  }
  if (bestNameF1 >= PEOPLE_NAME_F1_THRESHOLD && bestPersonName) {
    return {
      personName: bestPersonName,
      bonusPoints: PEOPLE_NAME_MATCH_BONUS,
      matchType: 'name',
    };
  }

  return null;
}

/**
 * @param {DigestSignal} signal
 * @param {NexusPerson[]} nexusPeople
 * @returns {{ handleBonus: number, nameBonus: number }}
 */
export function scorePeopleBonuses(signal, nexusPeople) {
  if (!Array.isArray(nexusPeople) || nexusPeople.length === 0) {
    return { handleBonus: 0, nameBonus: 0 };
  }

  const watchHandles = collectNormalizedWatchHandles(nexusPeople);
  let handleBonus = 0;
  const rawHandle = signal.sourceMetadata?.authorHandle;
  if (typeof rawHandle === 'string' && rawHandle.trim()) {
    const normalized = normalizePeopleHandle(rawHandle);
    if (normalized.length > 0 && watchHandles.has(normalized)) {
      handleBonus = PEOPLE_HANDLE_MATCH_BONUS;
    }
  }

  let nameBonus = 0;
  const signalTokens = tokenizeSignalText(signal.title, signal.summary);
  let bestNameF1 = 0;
  for (const person of nexusPeople) {
    const nameTokens = tokenizeForScoring(person.name ?? '');
    const nameF1 = f1Score(signalTokens, nameTokens);
    if (nameF1 > bestNameF1) {
      bestNameF1 = nameF1;
    }
  }
  if (bestNameF1 >= PEOPLE_NAME_F1_THRESHOLD) {
    nameBonus = PEOPLE_NAME_MATCH_BONUS;
  }

  return { handleBonus, nameBonus };
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
  const nexusPeople = ctx.nexusPeople ?? [];
  const { handleBonus, nameBonus } =
    nexusPeople.length > 0 ? scorePeopleBonuses(signal, nexusPeople) : { handleBonus: 0, nameBonus: 0 };
  return clamp(combined + epicBonus + handleBonus + nameBonus, 0, 100);
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
    const peopleMatch = resolvePeopleMatch(
      /** @type {DigestSignal} */ (signal),
      ctx.nexusPeople ?? [],
    );
    /** @type {Record<string, unknown>} */
    const out = {
      ...signal,
      scores,
      disposition,
      rankScore,
      _oi: originalIndex,
    };
    if (peopleMatch) {
      out.sourceMetadata = {
        ...(/** @type {DigestSignal} */ (signal).sourceMetadata ?? {}),
        peopleMatch,
      };
    }
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
