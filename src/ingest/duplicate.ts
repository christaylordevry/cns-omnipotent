import { readFile, stat } from "node:fs/promises";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import { resolveVaultPath } from "../paths.js";
import { vaultSearch } from "../tools/vault-search.js";

/**
 * Ingest/MCP dedup-only: trim, iterative trailing `/` strip on the full string, and `http://` → `https://`.
 * Not general-purpose URL canonicalization (queries, `www.`, fragments, punycode, host case-folding, etc.).
 */
export function normalizeSourceUriForDedup(uri: string): string {
  let s = uri.trim();
  if (/^http:\/\//i.test(s)) {
    s = `https://${s.slice(7)}`;
  }
  while (s.endsWith("/")) {
    s = s.slice(0, -1);
  }
  return s;
}

/** Literals that may appear in YAML `source_uri:` lines for the same dedup key (narrow vault_search queries). */
function sourceUriVaultSearchLiteralsForDedup(trimmed: string): string[] {
  const k = normalizeSourceUriForDedup(trimmed);
  const literals = new Set<string>();
  literals.add(trimmed);
  literals.add(k);
  if (!k.endsWith("/")) {
    literals.add(`${k}/`);
  }
  if (/^https:\/\//i.test(k)) {
    const rest = k.slice(8);
    literals.add(`http://${rest}`);
    literals.add(`http://${rest}/`);
  }
  return [...literals];
}

async function findAllGovernedPathsMatchingDedupSourceUri(
  vaultRoot: string,
  sourceUriTrimmed: string,
): Promise<string[]> {
  const seekKey = normalizeSourceUriForDedup(sourceUriTrimmed);
  const literals = sourceUriVaultSearchLiteralsForDedup(sourceUriTrimmed);
  const seenHitPaths = new Set<string>();
  const matchingPaths: string[] = [];

  for (const lit of literals) {
    const query = `source_uri: ${JSON.stringify(lit)}`;
    const res = await vaultSearch(vaultRoot, {
      query,
      scope: "03-Resources",
      maxResults: 50,
      forceNodeScanner: true,
    });
    for (const hit of res.hits) {
      if (seenHitPaths.has(hit.path)) continue;
      seenHitPaths.add(hit.path);
      const absPath = resolveVaultPath(vaultRoot, hit.path);
      const raw = await readFile(absPath, "utf8");
      const { frontmatter } = parseNoteFrontmatter(raw);
      const su = frontmatter.source_uri;
      if (typeof su !== "string") continue;
      if (normalizeSourceUriForDedup(su) === seekKey) {
        matchingPaths.push(hit.path);
      }
    }
  }
  return [...new Set(matchingPaths)];
}

/**
 * Vault-relative POSIX path to the first governed `03-Resources/` note whose PAKE `source_uri`
 * matches `sourceUriTrimmed` under {@link normalizeSourceUriForDedup} (lexicographic tie-break).
 */
export async function findFirstGovernedNotePathForDedupSourceUri(
  vaultRoot: string,
  sourceUriTrimmed: string,
): Promise<string | null> {
  const t = sourceUriTrimmed.trim();
  if (t.length === 0) return null;
  const paths = await findAllGovernedPathsMatchingDedupSourceUri(vaultRoot, t);
  if (paths.length === 0) return null;
  paths.sort((a, b) => a.localeCompare(b));
  return paths[0] ?? null;
}

/**
 * True when a governed note under `03-Resources/` already has this `source_uri` in frontmatter
 * (after {@link normalizeSourceUriForDedup} equivalence).
 * Uses narrow full-text queries then verifies YAML `source_uri` to avoid body-only matches.
 */
export async function governedNoteExistsWithSourceUri(
  vaultRoot: string,
  sourceUri: string,
): Promise<boolean> {
  const paths = await findAllGovernedPathsMatchingDedupSourceUri(vaultRoot, sourceUri.trim());
  return paths.length > 0;
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
