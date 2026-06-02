import {
  getDomainKeywordTokens,
  normalizeDomainSlug,
} from "./infer-notebook-domain.mjs";

export const SCORE_THRESHOLD = 0.75;
export const SOFT_ROUTE_FLOOR = 0.2;
const SCORING_STOPWORDS = new Set([
  "about",
  "are",
  "for",
  "how",
  "is",
  "me",
  "of",
  "on",
  "the",
  "to",
  "what",
  "whats",
]);

/**
 * @typedef {import('./sync-notebook-registry.mjs').NotebookRegistryEntry} NotebookRegistryEntry
 * @typedef {{ id: string, title: string, score: number }} NotebookScoreMatch
 * @typedef {{ status: 'OK', matches: NotebookScoreMatch[] } | { status: 'NO_ROUTE', matches: [] }} NotebookScoreResult
 */

/**
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeForScoring(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !SCORING_STOPWORDS.has(token));
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number}
 */
export function f1(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * @param {number} value
 * @returns {number}
 */
function roundScore(value) {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * @param {NotebookRegistryEntry} entry
 * @returns {string[]}
 */
function domainTokensForEntry(entry) {
  const slug = normalizeDomainSlug(entry.domain || "general");
  const slugTokens = tokenizeForScoring(slug);
  const lexicon = getDomainKeywordTokens(slug);
  return [...new Set([...slugTokens, ...lexicon])];
}

/**
 * @param {unknown} row
 * @returns {NotebookRegistryEntry | null}
 */
function validRegistryRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!id || !title) {
    return null;
  }
  return {
    id,
    title,
    watch: Boolean(row.watch),
    domain: typeof row.domain === "string" ? row.domain : "",
    last_updated:
      row.last_updated === null || typeof row.last_updated === "string"
        ? row.last_updated
        : null,
  };
}

/**
 * @param {string} query
 * @param {NotebookRegistryEntry[]} registry
 * @returns {{ queryTokens: string[] | null, rows: NotebookRegistryEntry[] }}
 */
function prepareScoringContext(query, registry) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    return { queryTokens: null, rows: [] };
  }

  const queryTokens = tokenizeForScoring(trimmed);
  if (queryTokens.length === 0) {
    return { queryTokens: null, rows: [] };
  }

  const rows = (Array.isArray(registry) ? registry : [])
    .map((row) => validRegistryRow(row))
    .filter((row) => row !== null);

  return { queryTokens, rows };
}

/**
 * @param {string[]} queryTokens
 * @param {NotebookRegistryEntry[]} rows
 * @returns {NotebookScoreMatch[]}
 */
function scoreAllEntries(queryTokens, rows) {
  /** @type {NotebookScoreMatch[]} */
  const ranked = [];
  for (const entry of rows) {
    const titleTokens = tokenizeForScoring(entry.title);
    const domainTokens = domainTokensForEntry(entry);
    const titleScore = roundScore(f1(queryTokens, titleTokens));
    const domainScore = roundScore(f1(queryTokens, domainTokens));
    const score = roundScore(Math.max(titleScore, domainScore));
    ranked.push({ id: entry.id, title: entry.title, score });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const titleCmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (titleCmp !== 0) {
      return titleCmp;
    }
    return a.id.localeCompare(b.id);
  });

  return ranked;
}

/**
 * @param {string} topic
 * @param {NotebookRegistryEntry[]} registry
 * @returns {NotebookScoreMatch[]}
 */
export function rankAllMatches(topic, registry) {
  const { queryTokens, rows } = prepareScoringContext(topic, registry);
  if (!queryTokens || rows.length === 0) {
    return [];
  }
  return scoreAllEntries(queryTokens, rows);
}

/**
 * @param {string} topic
 * @param {NotebookRegistryEntry[]} registry
 * @returns {NotebookScoreResult}
 */
export function scoreNotebooks(topic, registry) {
  const { queryTokens, rows } = prepareScoringContext(topic, registry);
  if (!queryTokens || rows.length === 0) {
    return { status: "NO_ROUTE", matches: [] };
  }

  const matches = scoreAllEntries(queryTokens, rows).filter(
    (entry) => entry.score >= SCORE_THRESHOLD,
  );

  if (matches.length === 0) {
    return { status: "NO_ROUTE", matches: [] };
  }

  return { status: "OK", matches };
}
