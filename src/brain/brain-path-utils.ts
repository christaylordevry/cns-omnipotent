/**
 * Hard exclusion: audit logs must never enter the embed set (Story 12.4 / charter),
 * even when `_meta/**` is allowlisted via protected-corpora opt-in.
 */
export function isMetaLogsVaultPath(vaultRel: string): boolean {
  const p = vaultRel.replace(/\\/g, "/");
  return p === "_meta/logs" || p.startsWith("_meta/logs/");
}

/** True when the path is under DailyNotes (Agent Log stripping applies). */
export function isDailyNotesVaultPath(vaultRel: string): boolean {
  const p = vaultRel.replace(/\\/g, "/");
  return p === "DailyNotes" || p.startsWith("DailyNotes/");
}

/**
 * Removes the `## Agent Log` section (from that heading through the line before the next `## `
 * heading at column 0, or EOF). Used only after the secret gate; secret scanning uses full raw text.
 */
export function stripAgentLogSectionFromMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (!skipping && /^## Agent Log\s*$/.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^## /.test(line)) {
      skipping = false;
      out.push(line);
      continue;
    }
    if (!skipping) {
      out.push(line);
    }
  }
  return out.join("\n");
}
