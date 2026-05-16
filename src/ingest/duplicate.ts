import { readFile, stat } from "node:fs/promises";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import { resolveVaultPath } from "../paths.js";
import { vaultSearch } from "../tools/vault-search.js";

/**
 * Ingest/MCP dedup-only: trim; for `http(s)://` URIs strip `www.`, query, fragment; `http`→`https`;
 * iterative trailing `/` strip on the serialized result.
 * Not general-purpose URL canonicalization (IDN/punycode, host case-folding, default ports, query ordering, path case).
 */

function stripQueryAndFragmentFromString(s: string): string {
  let cut = s.length;
  const q = s.indexOf("?");
  const h = s.indexOf("#");
  if (q >= 0) cut = Math.min(cut, q);
  if (h >= 0) cut = Math.min(cut, h);
  return s.slice(0, cut);
}

function stripWwwAuthority(authority: string): string {
  const userinfoEnd = authority.lastIndexOf("@");
  const prefix = userinfoEnd >= 0 ? authority.slice(0, userinfoEnd + 1) : "";
  const hostPort = userinfoEnd >= 0 ? authority.slice(userinfoEnd + 1) : authority;
  if (hostPort.startsWith("[")) return authority;
  return `${prefix}${/^www\./i.test(hostPort) ? hostPort.slice(4) : hostPort}`;
}

function stripTrailingSlashesIteratively(s: string): string {
  let out = s;
  while (out.endsWith("/")) {
    out = out.slice(0, -1);
  }
  return out;
}

function normalizeHttpUrlStringFallback(s: string): string {
  let base = stripQueryAndFragmentFromString(s);
  const hostPath = base.match(/^(https?:\/\/)([^/?#]+)(.*)$/i);
  if (hostPath) {
    const rest = hostPath[3] ?? "";
    base = `https://${stripWwwAuthority(hostPath[2] ?? "")}${rest}`;
  } else if (/^http:\/\//i.test(base)) {
    base = `https://${base.slice(7)}`;
  }
  return stripTrailingSlashesIteratively(base);
}

export function normalizeSourceUriForDedup(uri: string): string {
  const trimmed = uri.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeHttpUrlStringFallback(trimmed);
  }
  let s = trimmed;
  if (/^http:\/\//i.test(s)) {
    s = `https://${s.slice(7)}`;
  }
  return stripTrailingSlashesIteratively(s);
}

function wwwHostTwinOfNormalizedUri(k: string): string | null {
  const m = k.match(/^https:\/\/([^/]+)(\/.*)?$/i);
  if (!m || /^www\./i.test(m[1] ?? "")) return null;
  return `https://www.${m[1]}${m[2] ?? ""}`;
}

function addSchemeAndSlashVariants(uri: string, literals: Set<string>): void {
  literals.add(uri);
  if (!uri.endsWith("/")) {
    literals.add(`${uri}/`);
  }
  if (/^https:\/\//i.test(uri)) {
    const rest = uri.slice(8);
    literals.add(`http://${rest}`);
    literals.add(`http://${rest}/`);
  }
}

/** Literals that may appear in YAML `source_uri:` lines for the same dedup key (narrow vault_search queries). */
function sourceUriVaultSearchLiteralsForDedup(trimmed: string): string[] {
  const k = normalizeSourceUriForDedup(trimmed);
  const literals = new Set<string>();
  addSchemeAndSlashVariants(trimmed, literals);
  addSchemeAndSlashVariants(k, literals);
  const wwwTwin = wwwHostTwinOfNormalizedUri(k);
  if (wwwTwin) {
    addSchemeAndSlashVariants(wwwTwin, literals);
  }
  return [...literals];
}

/** Full-text queries for a URI literal; includes a prefix form so stored values with `?` or `#` suffixes still hit. */
function vaultSearchQueriesForDedupLiteral(lit: string, includePrefix: boolean): string[] {
  const exact = `source_uri: ${JSON.stringify(lit)}`;
  if (!includePrefix || !/^https?:\/\//i.test(lit)) {
    return [exact];
  }
  const quoted = JSON.stringify(lit);
  const prefix = `source_uri: ${quoted.slice(0, -1)}`;
  if (prefix === exact) return [exact];
  return [exact, prefix];
}

async function findAllGovernedPathsMatchingDedupSourceUri(
  vaultRoot: string,
  sourceUriTrimmed: string,
): Promise<string[]> {
  const seekKey = normalizeSourceUriForDedup(sourceUriTrimmed);
  const literals = sourceUriVaultSearchLiteralsForDedup(sourceUriTrimmed);
  const seenHitPaths = new Set<string>();
  const matchingPaths: string[] = [];
  const seenQueries = new Set<string>();

  for (const lit of literals) {
    const usePrefix = normalizeSourceUriForDedup(lit) === seekKey;
    for (const query of vaultSearchQueriesForDedupLiteral(lit, usePrefix)) {
      if (seenQueries.has(query)) continue;
      seenQueries.add(query);
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
