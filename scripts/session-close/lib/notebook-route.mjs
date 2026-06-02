import { disambiguateRoute } from "./notebook-disambiguate.mjs";
import {
  rankAllMatches,
  scoreNotebooks,
  SOFT_ROUTE_FLOOR,
} from "./notebook-scorer.mjs";

/**
 * @typedef {import('./sync-notebook-registry.mjs').NotebookRegistryEntry} NotebookRegistryEntry
 * @typedef {{ status: 'ROUTED', id: string, title: string, reason: string, score: number }
 *         | { status: 'NO_ROUTE', id: null, title: null, reason: string, best: { title: string, score: number } | null }} NotebookRouteResult
 */

/**
 * Hard match via scoreNotebooks + disambiguator, else soft-route when best F1 >= SOFT_ROUTE_FLOOR.
 * @param {string} topic
 * @param {NotebookRegistryEntry[]} registry
 * @returns {NotebookRouteResult}
 */
function watchedRegistryRows(registry) {
  return (Array.isArray(registry) ? registry : []).filter(
    (e) => e && e.watch === true,
  );
}

export function resolveNotebookRoute(topic, registry) {
  const watched = watchedRegistryRows(registry);
  const hard = scoreNotebooks(topic, watched);
  if (hard.status === "OK") {
    const route = disambiguateRoute(hard, watched);
    if (route.status === "ROUTED") {
      const matched =
        hard.matches.find((m) => m.id === route.id) ?? hard.matches[0];
      const score = matched?.score ?? 0;
      return { ...route, score };
    }
  }

  const ranked = rankAllMatches(topic, watched);
  const top = ranked[0];
  if (top && top.score >= SOFT_ROUTE_FLOOR) {
    return {
      status: "ROUTED",
      id: top.id,
      title: top.title,
      reason: "soft_match",
      score: top.score,
    };
  }

  return {
    status: "NO_ROUTE",
    id: null,
    title: null,
    reason: "no-route",
    best: top ? { title: top.title, score: top.score } : null,
  };
}

/**
 * @param {{ title: string, score: number } | null} best
 * @returns {string}
 */
export function belowThresholdReason(best) {
  if (!best) {
    return "no_watched_notebooks";
  }
  const display = (Math.round(best.score * 100) / 100).toFixed(2);
  return `below_threshold: best=${best.title} (${display})`;
}
