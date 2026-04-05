/**
 * Limited vault wikilink rewrite after a note move (filesystem fallback).
 *
 * Limitations (Phase 1): does not parse markdown code fences; may touch `[[...]]` inside
 * fenced blocks. Does not resolve Obsidian aliases, embed-only titles without paths, or
 * `![[...]]` path forms beyond simple target replacement. Prefer Obsidian CLI when available.
 */

const LINK_RE = /(!?\[\[)([^\]|]+)(\|[^\]]*)?(\]\])/g;

function posixBasename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

function normalizeLinkTarget(t: string): string {
  return t.trim().replace(/\\/g, "/");
}

/**
 * If `target` matches the old note location, return the new target; else return original.
 */
export function mapWikilinkTarget(
  target: string,
  oldVaultPosix: string,
  newVaultPosix: string,
): string {
  const t = normalizeLinkTarget(target);
  const old = oldVaultPosix.replace(/\\/g, "/");
  const neu = newVaultPosix.replace(/\\/g, "/");
  const oldNoMd = old.replace(/\.md$/i, "");
  const oldBase = posixBasename(old);
  const newBase = posixBasename(neu);
  const oldBaseNoMd = oldBase.replace(/\.md$/i, "");

  if (t === old || t === oldNoMd) return neu;
  if (t === oldBase || t === oldBaseNoMd) return newBase;
  return target;
}

/** Rewrite `[[...]]` and `![[...]]` link targets that pointed at the moved note. */
export function rewriteWikilinksForMove(markdown: string, oldVaultPosix: string, newVaultPosix: string): string {
  return markdown.replace(LINK_RE, (_m, p1: string, target: string, p3: string | undefined, p4: string) => {
    const mapped = mapWikilinkTarget(target, oldVaultPosix, newVaultPosix);
    return `${p1}${mapped}${p3 ?? ""}${p4}`;
  });
}

export function wikilinkRewriteChanged(before: string, after: string): boolean {
  return before !== after;
}
