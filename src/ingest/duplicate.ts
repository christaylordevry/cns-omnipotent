import { readFile, stat } from "node:fs/promises";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import { resolveVaultPath } from "../paths.js";
import { vaultSearch } from "../tools/vault-search.js";

/**
 * True when a governed note under `03-Resources/` already has this `source_uri` in frontmatter.
 * Uses a narrow full-text query then verifies YAML `source_uri` to avoid body-only matches.
 */
export async function governedNoteExistsWithSourceUri(
  vaultRoot: string,
  sourceUri: string,
): Promise<boolean> {
  const query = `source_uri: ${JSON.stringify(sourceUri)}`;
  const res = await vaultSearch(vaultRoot, {
    query,
    scope: "03-Resources",
    maxResults: 50,
    forceNodeScanner: true,
  });
  for (const hit of res.hits) {
    const absPath = resolveVaultPath(vaultRoot, hit.path);
    const raw = await readFile(absPath, "utf8");
    const { frontmatter } = parseNoteFrontmatter(raw);
    const su = frontmatter.source_uri;
    if (typeof su === "string" && su === sourceUri) return true;
  }
  return false;
}

type TitleDuplicateMatch = {
  path: string;
  modifiedKey: string | null;
  mtimeMs: number;
  source_uri: string | null;
};

function parseYmdOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function stableNewestFirst(a: TitleDuplicateMatch, b: TitleDuplicateMatch): number {
  // Prefer frontmatter modified date (YYYY-MM-DD), else fall back to file mtime.
  const am = a.modifiedKey;
  const bm = b.modifiedKey;
  if (am && bm) {
    if (am > bm) return -1;
    if (am < bm) return 1;
  } else if (am && !bm) {
    return -1;
  } else if (!am && bm) {
    return 1;
  }

  if (a.mtimeMs > b.mtimeMs) return -1;
  if (a.mtimeMs < b.mtimeMs) return 1;
  return a.path.localeCompare(b.path);
}

/**
 * Find governed notes under `03-Resources/` with identical frontmatter `title`.
 * Returns matches sorted newest-first.
 */
export async function findGovernedResourceNotesByTitle(
  vaultRoot: string,
  title: string,
): Promise<TitleDuplicateMatch[]> {
  const query = `title: ${JSON.stringify(title)}`;
  const res = await vaultSearch(vaultRoot, {
    query,
    scope: "03-Resources",
    maxResults: 50,
    forceNodeScanner: true,
  });

  const matches: TitleDuplicateMatch[] = [];
  for (const hit of res.hits) {
    const absPath = resolveVaultPath(vaultRoot, hit.path);
    const raw = await readFile(absPath, "utf8");
    const { frontmatter } = parseNoteFrontmatter(raw);
    const t = frontmatter.title;
    if (typeof t !== "string" || t !== title) continue;

    const st = await stat(absPath);
    const modifiedKey = parseYmdOrNull(frontmatter.modified);
    const su = typeof frontmatter.source_uri === "string" ? frontmatter.source_uri : null;
    matches.push({
      path: hit.path,
      modifiedKey,
      mtimeMs: st.mtimeMs,
      source_uri: su,
    });
  }

  matches.sort(stableNewestFirst);
  return matches;
}
