import matter from "gray-matter";
import { CnsError } from "../errors.js";

export type ParsedNoteFrontmatter = {
  frontmatter: Record<string, unknown>;
  body: string;
};

/**
 * Split YAML frontmatter from markdown body.
 * YAML syntax errors are IO_ERROR (unusable file), consistent with vault_read_frontmatter.
 */
export function parseNoteFrontmatter(raw: string): ParsedNoteFrontmatter {
  try {
    const parsed = matter(raw);
    const data = parsed.data;
    const frontmatter =
      data !== null && typeof data === "object" && !Array.isArray(data)
        ? { ...(data as Record<string, unknown>) }
        : {};
    return { frontmatter, body: parsed.content };
  } catch {
    throw new CnsError("IO_ERROR", "Invalid or unparseable YAML frontmatter in note content");
  }
}
