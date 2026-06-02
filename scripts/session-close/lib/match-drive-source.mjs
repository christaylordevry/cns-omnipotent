/**
 * Match a NotebookLM Drive-backed source by Google Drive file ID (not title).
 * `nlm source list <notebook_id> --drive --json` includes `drive_doc_id` when present.
 */

/**
 * @param {unknown} source
 * @returns {string | null}
 */
export function extractDriveDocIdFromSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }
  const row = /** @type {Record<string, unknown>} */ (source);
  const candidates = [
    row.drive_doc_id,
    row.driveDocId,
    row.drive_file_id,
    row.file_id,
    row.document_id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  const url = typeof row.url === "string" ? row.url : "";
  if (url) {
    const docMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch?.[1]) {
      return docMatch[1];
    }
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
      return fileMatch[1];
    }
  }
  return null;
}

/**
 * @param {unknown[]} sources
 * @param {string} driveDocId
 * @returns {{ sourceId: string; source: Record<string, unknown> } | null}
 */
export function matchDriveSourceByDocId(sources, driveDocId) {
  const target = driveDocId.trim();
  if (!target || !Array.isArray(sources)) {
    return null;
  }
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      continue;
    }
    const row = /** @type {Record<string, unknown>} */ (source);
    const docId = extractDriveDocIdFromSource(row);
    if (docId !== target) {
      continue;
    }
    const sourceId = typeof row.id === "string" ? row.id : "";
    if (!sourceId) {
      continue;
    }
    return { sourceId, source: row };
  }
  return null;
}
