import { readFile } from "node:fs/promises";
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
