import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { CnsError } from "../errors.js";
import {
  DEFAULT_OPERATOR_CONTEXT,
  operatorContextSchema,
  type OperatorContext,
} from "./operator-context.js";
import { vaultReadFile } from "../tools/vault-read.js";
import { vaultSearch } from "../tools/vault-search.js";

export const vaultContextNoteSchema = z.object({
  vault_path: z.string(),
  title: z.string(),
  excerpt: z.string(),
  retrieval_reason: z.enum([
    "topic-match",
    "tag-lane",
    "recency",
    "operator-profile",
  ]),
  tags: z.array(z.string()),
});

export const vaultContextPacketSchema = z.object({
  notes: z.array(vaultContextNoteSchema),
  total_notes: z.number().int().min(0),
  token_budget_used: z.number().int().min(0),
  retrieval_timestamp: z.string(),
});

export type VaultContextNote = z.infer<typeof vaultContextNoteSchema>;
export type VaultContextPacket = z.infer<typeof vaultContextPacketSchema>;

const OPERATOR_PROFILE_PATH = "03-Resources/Operator-Profile.md";
const RESOURCES_SCOPE = "03-Resources";
const EXCERPT_CHARS = 400;
const MAX_TOPIC_MATCH_NOTES = 2;

export async function loadOperatorContextFromVault(
  vaultRoot: string,
): Promise<OperatorContext> {
  try {
    const raw = await vaultReadFile(vaultRoot, OPERATOR_PROFILE_PATH);
    const parsed = matter(raw);
    const fm =
      parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
        ? (parsed.data as Record<string, unknown>)
        : {};

    const candidate: Partial<OperatorContext> = {
      name: fm["operator_name"] as unknown as string,
      location: fm["operator_location"] as unknown as string,
      positioning: fm["operator_positioning"] as unknown as string,
      tracks: fm["operator_tracks"] as unknown as OperatorContext["tracks"],
      constraints: fm["operator_constraints"] as unknown as string[],
    };

    const validated = operatorContextSchema.safeParse(candidate);
    if (!validated.success) return DEFAULT_OPERATOR_CONTEXT;

    return validated.data;
  } catch {
    return DEFAULT_OPERATOR_CONTEXT;
  }
}

function titleFromFrontmatterOrPath(fm: Record<string, unknown>, vaultPath: string): string {
  const t = fm["title"];
  if (typeof t === "string" && t.trim().length > 0) return t;
  return path.basename(vaultPath, path.extname(vaultPath));
}

function tagsFromFrontmatter(fm: Record<string, unknown>): string[] {
  const t = fm["tags"];
  if (Array.isArray(t)) {
    return t.filter((x): x is string => typeof x === "string");
  }
  return [];
}

async function tryReadNote(
  vaultRoot: string,
  vaultPath: string,
): Promise<{ body: string; frontmatter: Record<string, unknown> } | null> {
  try {
    const raw = await vaultReadFile(vaultRoot, vaultPath);
    const parsed = matter(raw);
    const fm =
      parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
        ? { ...(parsed.data as Record<string, unknown>) }
        : {};
    return { body: parsed.content, frontmatter: fm };
  } catch (err) {
    if (err instanceof CnsError) return null;
    return null;
  }
}

function buildExcerpt(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= EXCERPT_CHARS) return trimmed;
  return trimmed.slice(0, EXCERPT_CHARS);
}

/**
 * Minimal VaultContextPacket builder (Story 18-9).
 *
 * - Guarantees an operator profile slot at `03-Resources/Operator-Profile.md` when present.
 * - Adds up to 2 topic-relevant notes via `vault_search` scoped to `03-Resources/`.
 * - Swallows search / read failures: packet degrades to what is readable.
 *
 * The `queries` parameter is part of the forward-compatible signature for the full
 * hybrid retriever and is not used by this minimal builder.
 */
export async function buildVaultContextPacket(
  vaultRoot: string,
  topic: string,
  queries: string[],
): Promise<VaultContextPacket> {
  void queries;
  const notes: VaultContextNote[] = [];
  const seen = new Set<string>();

  const profile = await tryReadNote(vaultRoot, OPERATOR_PROFILE_PATH);
  if (profile !== null) {
    notes.push({
      vault_path: OPERATOR_PROFILE_PATH,
      title: titleFromFrontmatterOrPath(profile.frontmatter, OPERATOR_PROFILE_PATH),
      excerpt: buildExcerpt(profile.body),
      retrieval_reason: "operator-profile",
      tags: tagsFromFrontmatter(profile.frontmatter),
    });
    seen.add(OPERATOR_PROFILE_PATH);
  }

  if (topic.trim().length > 0) {
    try {
      const result = await vaultSearch(vaultRoot, {
        query: topic,
        scope: RESOURCES_SCOPE,
        maxResults: 3,
      });
      const picked: string[] = [];
      for (const hit of result.hits) {
        if (picked.length >= MAX_TOPIC_MATCH_NOTES) break;
        if (seen.has(hit.path)) continue;
        picked.push(hit.path);
        seen.add(hit.path);
      }
      for (const vp of picked) {
        const read = await tryReadNote(vaultRoot, vp);
        if (read === null) continue;
        notes.push({
          vault_path: vp,
          title: titleFromFrontmatterOrPath(read.frontmatter, vp),
          excerpt: buildExcerpt(read.body),
          retrieval_reason: "topic-match",
          tags: tagsFromFrontmatter(read.frontmatter),
        });
      }
    } catch {
      // Search failures (scope missing, etc.) → minimal packet continues.
    }
  }

  return {
    notes,
    total_notes: notes.length,
    token_budget_used: 0,
    retrieval_timestamp: new Date().toISOString(),
  };
}
