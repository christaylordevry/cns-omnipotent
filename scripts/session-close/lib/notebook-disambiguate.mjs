/**
 * @typedef {import('./notebook-scorer.mjs').NotebookScoreResult} NotebookScoreResult
 * @typedef {import('./sync-notebook-registry.mjs').NotebookRegistryEntry} NotebookRegistryEntry
 * @typedef {{ status: 'ROUTED', id: string, title: string, reason: 'single-match' | 'watch-preferred' | 'top-ranked' }
 *         | { status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' }} DisambiguationResult
 */

/** @returns {DisambiguationResult} */
function noRoute() {
  return { status: "NO_ROUTE", id: null, title: null, reason: "no-route" };
}

/**
 * @param {unknown} scoreResult
 * @returns {scoreResult is NotebookScoreResult}
 */
function isValidScoreResult(scoreResult) {
  if (!scoreResult || typeof scoreResult !== "object") {
    return false;
  }
  const status = /** @type {{ status?: unknown }} */ (scoreResult).status;
  if (status !== "OK" && status !== "NO_ROUTE") {
    return false;
  }
  if (status === "NO_ROUTE") {
    return true;
  }
  const matches = /** @type {{ matches?: unknown }} */ (scoreResult).matches;
  return Array.isArray(matches);
}

/**
 * @param {NotebookRegistryEntry[]} registry
 * @returns {Set<string>}
 */
function watchedIdsFromRegistry(registry) {
  return new Set(
    registry
      .filter((r) => r && r.watch === true && typeof r.id === "string")
      .map((r) => r.id),
  );
}

/**
 * @param {string} id
 * @param {NotebookRegistryEntry[]} registry
 * @returns {{ id: string, title: string } | null}
 */
function registryEntryForId(id, registry) {
  const entry = registry.find((r) => r && r.id === id);
  if (!entry || typeof entry.title !== "string") {
    return null;
  }
  return { id: entry.id, title: entry.title };
}

/**
 * @param {NotebookScoreResult['matches'][number]} match
 * @param {NotebookRegistryEntry[]} registry
 * @returns {{ id: string, title: string }}
 */
function resolveRoutedEntry(match, registry) {
  const fromRegistry = registryEntryForId(match.id, registry);
  if (fromRegistry) {
    return fromRegistry;
  }
  return {
    id: match.id,
    title: typeof match.title === "string" ? match.title : "",
  };
}

/**
 * @param {NotebookScoreResult} scoreResult
 * @param {NotebookRegistryEntry[]} registry
 * @returns {DisambiguationResult}
 */
export function disambiguateRoute(scoreResult, registry) {
  if (!isValidScoreResult(scoreResult)) {
    return noRoute();
  }

  const rows = Array.isArray(registry) ? registry : [];

  if (scoreResult.status === "NO_ROUTE") {
    return noRoute();
  }

  const matches = scoreResult.matches.filter(
    (m) => m && typeof m === "object" && typeof m.id === "string",
  );
  if (matches.length === 0) {
    return noRoute();
  }

  if (matches.length === 1) {
    const entry = resolveRoutedEntry(matches[0], rows);
    return {
      status: "ROUTED",
      id: entry.id,
      title: entry.title,
      reason: "single-match",
    };
  }

  const watchedIds = watchedIdsFromRegistry(rows);
  const watchFlagged = matches.filter((m) => watchedIds.has(m.id));

  if (watchFlagged.length === 1) {
    const entry = resolveRoutedEntry(watchFlagged[0], rows);
    return {
      status: "ROUTED",
      id: entry.id,
      title: entry.title,
      reason: "watch-preferred",
    };
  }

  const entry = resolveRoutedEntry(matches[0], rows);
  return {
    status: "ROUTED",
    id: entry.id,
    title: entry.title,
    reason: "top-ranked",
  };
}

/**
 * @param {string} slug
 * @returns {string[]}
 */
function slugToKeywords(slug) {
  return String(slug)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token));
}

/**
 * Extract a short scoring topic string from the context pack (no IO, no LLM).
 * Returns "" when no usable fields are present.
 * @param {unknown} contextPack
 * @returns {string}
 */
export function extractScoringTopic(contextPack) {
  if (!contextPack || typeof contextPack !== "object") {
    return "";
  }

  const pack = /** @type {Record<string, unknown>} */ (contextPack);
  const sprint =
    pack.sprint && typeof pack.sprint === "object"
      ? /** @type {Record<string, unknown>} */ (pack.sprint)
      : null;

  const activeEpics = sprint?.active_epics;
  if (Array.isArray(activeEpics) && activeEpics.length > 0) {
    const epicIds = activeEpics
      .map((epic) => {
        if (!epic || typeof epic !== "object") {
          return "";
        }
        const id = /** @type {{ id?: unknown }} */ (epic).id;
        return typeof id === "string" ? id.trim() : "";
      })
      .filter(Boolean);
    if (epicIds.length > 0) {
      return epicIds.join(" ").slice(0, 60).trim();
    }
  }

  const recentStories = pack.recent_stories;
  if (Array.isArray(recentStories) && recentStories.length > 0) {
    const first = recentStories[0];
    if (first && typeof first === "object") {
      const basename = /** @type {{ basename?: unknown }} */ (first).basename;
      if (typeof basename === "string" && basename.trim()) {
        const keywords = slugToKeywords(basename);
        if (keywords.length > 0) {
          return keywords.join(" ").slice(0, 60).trim();
        }
      }
    }
  }

  return "";
}
