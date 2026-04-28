import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { CnsError } from "../errors.js";
import {
  DEFAULT_OPERATOR_CONTEXT,
  operatorContextSchema,
  type OperatorContext,
} from "./operator-context.js";
import { vaultListDirectory } from "../tools/vault-list.js";
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

const DEFAULT_TOKEN_BUDGET = 2000;
const MAX_TAG_LANE_NOTES = 2;
const MAX_TOPIC_MATCH_NOTES = 3;
const MAX_RECENCY_NOTES = 2;
const TAG_LANE_SEARCH_RESULTS = 5;
const TOPIC_SEARCH_RESULTS = 5;
const RECENCY_LIST_LIMIT = 5;

let tokenBudget = DEFAULT_TOKEN_BUDGET;

/** @internal — test-only override for the per-packet token budget. */
export function __setTokenBudgetForTests(n: number): void {
  tokenBudget = n;
}

/** @internal — restore the production token budget. */
export function __resetTokenBudgetForTests(): void {
  tokenBudget = DEFAULT_TOKEN_BUDGET;
}

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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function trackToTag(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

type BudgetState = { used: number; exhausted: boolean };

type AddOutcome = "added" | "skipped-budget" | "skipped-other";

async function tryAddNote(
  vaultRoot: string,
  vaultPath: string,
  reason: VaultContextNote["retrieval_reason"],
  notes: VaultContextNote[],
  seen: Set<string>,
  budget: BudgetState,
): Promise<AddOutcome> {
  if (seen.has(vaultPath)) return "skipped-other";
  const read = await tryReadNote(vaultRoot, vaultPath);
  if (read === null) return "skipped-other";
  const excerpt = buildExcerpt(read.body);
  const cost = estimateTokens(excerpt);
  if (budget.used + cost > tokenBudget) {
    budget.exhausted = true;
    return "skipped-budget";
  }
  notes.push({
    vault_path: vaultPath,
    title: titleFromFrontmatterOrPath(read.frontmatter, vaultPath),
    excerpt,
    retrieval_reason: reason,
    tags: tagsFromFrontmatter(read.frontmatter),
  });
  seen.add(vaultPath);
  budget.used += cost;
  return "added";
}

/**
 * Bounded hybrid VaultContextPacket retriever (Story 19-3).
 *
 * Tier order (stops when token budget is exhausted):
 *   1. operator-profile (1 slot) — `03-Resources/Operator-Profile.md`
 *   2. tag-lane (max 2)         — vault_search per active operator track tag
 *   3. topic-match (max 3)      — vault_search on topic
 *   4. recency (max 2)          — vault_list entries sorted by modified ISO string desc
 *
 * Each tier is wrapped in try/catch and skipped silently on failure.
 * `queries` is accepted for forward-compat but unused.
 */
export async function buildVaultContextPacket(
  vaultRoot: string,
  topic: string,
  queries: string[],
): Promise<VaultContextPacket> {
  void queries;
  const notes: VaultContextNote[] = [];
  const seen = new Set<string>();
  const budget: BudgetState = { used: 0, exhausted: false };

  // Tier 1: operator-profile
  try {
    await tryAddNote(
      vaultRoot,
      OPERATOR_PROFILE_PATH,
      "operator-profile",
      notes,
      seen,
      budget,
    );
  } catch {
    // tier failure → skip silently
  }

  // Tier 2: tag-lane (active track names → kebab-case tags)
  if (!budget.exhausted) {
    try {
      const operatorContext = await loadOperatorContextFromVault(vaultRoot);
      const tags = operatorContext.tracks
        .filter((t) => t.status === "active")
        .map((t) => trackToTag(t.name))
        .filter((t) => t.length > 0);

      let added = 0;
      tagLoop: for (const tag of tags) {
        if (added >= MAX_TAG_LANE_NOTES) break;
        try {
          const result = await vaultSearch(vaultRoot, {
            query: tag,
            scope: RESOURCES_SCOPE,
            maxResults: TAG_LANE_SEARCH_RESULTS,
          });
          for (const hit of result.hits) {
            if (added >= MAX_TAG_LANE_NOTES) break;
            const outcome = await tryAddNote(
              vaultRoot,
              hit.path,
              "tag-lane",
              notes,
              seen,
              budget,
            );
            if (outcome === "added") added++;
            if (outcome === "skipped-budget") break tagLoop;
          }
        } catch {
          // single-tag failure → continue with the next tag
        }
      }
    } catch {
      // tier failure → skip silently
    }
  }

  // Tier 3: topic-match
  if (!budget.exhausted && topic.trim().length > 0) {
    try {
      const result = await vaultSearch(vaultRoot, {
        query: topic,
        scope: RESOURCES_SCOPE,
        maxResults: TOPIC_SEARCH_RESULTS,
      });
      let added = 0;
      for (const hit of result.hits) {
        if (added >= MAX_TOPIC_MATCH_NOTES) break;
        const outcome = await tryAddNote(
          vaultRoot,
          hit.path,
          "topic-match",
          notes,
          seen,
          budget,
        );
        if (outcome === "added") added++;
        if (outcome === "skipped-budget") break;
      }
    } catch {
      // tier failure → skip silently
    }
  }

  // Tier 4: recency
  if (!budget.exhausted) {
    try {
      const result = await vaultListDirectory(vaultRoot, {
        userPath: RESOURCES_SCOPE,
        recursive: false,
      });
      const recent = result.entries
        .filter((e) => e.type === "file" && e.name.endsWith(".md"))
        .sort((a, b) => b.modified.localeCompare(a.modified))
        .slice(0, RECENCY_LIST_LIMIT);

      let added = 0;
      for (const ent of recent) {
        if (added >= MAX_RECENCY_NOTES) break;
        const outcome = await tryAddNote(
          vaultRoot,
          ent.vaultPath,
          "recency",
          notes,
          seen,
          budget,
        );
        if (outcome === "added") added++;
        if (outcome === "skipped-budget") break;
      }
    } catch {
      // tier failure → skip silently
    }
  }

  return {
    notes,
    total_notes: notes.length,
    token_budget_used: budget.used,
    retrieval_timestamp: new Date().toISOString(),
  };
}
