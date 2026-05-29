import { inferNotebookDomain } from "./infer-notebook-domain.mjs";

/**
 * @typedef {object} NotebookRegistryEntry
 * @property {string} id
 * @property {string} title
 * @property {boolean} watch
 * @property {string} domain
 * @property {string | null} last_updated
 */

/**
 * @typedef {object} NlmNotebookRow
 * @property {string} id
 * @property {string} title
 * @property {string} [updated_at]
 */

/**
 * @param {string | undefined} updatedAt
 * @returns {string | null}
 */
function mapLastUpdated(updatedAt) {
  if (typeof updatedAt === "string" && updatedAt.trim()) {
    return updatedAt.trim();
  }
  return null;
}

/**
 * @param {NlmNotebookRow[]} nlmRows
 * @returns {NlmNotebookRow[]}
 */
function dedupeNlmRowsById(nlmRows) {
  const lastById = new Map();
  const order = [];

  for (const row of nlmRows) {
    const id = typeof row?.id === "string" ? row.id.trim() : "";
    if (!id) {
      continue;
    }

    if (!lastById.has(id)) {
      order.push(id);
    }
    lastById.set(id, { ...row, id });
  }

  return order.map((id) => lastById.get(id));
}

/**
 * Merge live `nlm` rows into the committed registry (keyed by `id`).
 * @param {NotebookRegistryEntry[]} existing
 * @param {NlmNotebookRow[]} nlmRows
 * @returns {NotebookRegistryEntry[]}
 */
export function mergeNotebookRegistry(existing, nlmRows) {
  const byId = new Map();
  for (const row of Array.isArray(existing) ? existing : []) {
    const id = typeof row?.id === "string" ? row.id.trim() : "";
    if (id) {
      byId.set(id, row);
    }
  }

  const result = [];

  for (const row of dedupeNlmRowsById(nlmRows)) {

    const prev = byId.get(row.id);
    const title = String(row.title ?? prev?.title ?? "").trim();
    const lastUpdated = mapLastUpdated(row.updated_at);

    let domain;
    if (prev && typeof prev.domain === "string" && prev.domain.trim()) {
      domain = prev.domain.trim();
    } else {
      domain = inferNotebookDomain(title);
    }

    const watch = prev ? Boolean(prev.watch) : false;

    /** @type {NotebookRegistryEntry} */
    const entry = {
      id: row.id,
      title,
      watch,
      domain,
      last_updated: lastUpdated ?? (prev ? prev.last_updated : null),
    };

    result.push(entry);
  }

  return result;
}
