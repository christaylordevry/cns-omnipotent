import matter from "gray-matter";
import { CnsError } from "../errors.js";
import { vaultReadFile } from "./vault-read.js";

export type VaultReadFrontmatterResult = {
  results: Array<{ path: string; frontmatter: Record<string, unknown> }>;
};

function normalizeFrontmatter(data: unknown): Record<string, unknown> {
  if (data === null || data === undefined) return {};
  if (typeof data === "object" && !Array.isArray(data)) {
    return { ...(data as Record<string, unknown>) };
  }
  return {};
}

/**
 * Read YAML frontmatter for one or more vault-relative paths. Enforces vault boundary via `vaultReadFile`.
 */
export async function vaultReadFrontmatter(
  vaultRoot: string,
  userPaths: string[],
): Promise<VaultReadFrontmatterResult> {
  const results: VaultReadFrontmatterResult["results"] = [];

  for (const userPath of userPaths) {
    const raw = await vaultReadFile(vaultRoot, userPath);
    try {
      const parsed = matter(raw);
      results.push({
        path: userPath,
        frontmatter: normalizeFrontmatter(parsed.data),
      });
    } catch (e) {
      if (e instanceof CnsError) throw e;
      throw new CnsError(
        "IO_ERROR",
        `Invalid or unparseable YAML frontmatter: ${userPath}`,
        { path: userPath },
      );
    }
  }

  return { results };
}
