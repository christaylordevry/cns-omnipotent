import { z } from "zod";

/** UUID v4 string (PAKE Standard / AGENTS.md). */
const uuidV4Regex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Single source of truth for PAKE Standard `pake_type` literals (MCP tool enums, Zod validation, list filters).
 * Phase 2 Epic B — shared module per deferred-work / sprint-change-proposal.
 */
export const PAKE_TYPE_VALUES = [
  "SourceNote",
  "InsightNote",
  "HookSetNote",
  "SynthesisNote",
  "WorkflowNote",
  "ValidationNote",
] as const;

export type PakeType = (typeof PAKE_TYPE_VALUES)[number];

export const pakeTypeSchema = z.enum(PAKE_TYPE_VALUES);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const tagsSchema = z.union([
  z.array(z.string()),
  z.string().transform((s) => [s]),
]);

/**
 * Minimum PAKE Standard frontmatter (CNS-Phase-1-Spec / AGENTS.md).
 * Extra keys are allowed for forward compatibility.
 */
export const pakeStandardFrontmatterSchema = z
  .object({
    pake_id: z.string().regex(uuidV4Regex, "must be a UUID v4 string"),
    pake_type: pakeTypeSchema,
    title: z.string().min(1),
    created: isoDateSchema,
    modified: isoDateSchema,
    status: z.enum(["draft", "in-progress", "reviewed", "archived"]),
    confidence_score: z.number().min(0).max(1),
    verification_status: z.enum(["pending", "verified", "disputed"]),
    creation_method: z.enum(["human", "ai", "hybrid"]),
    tags: tagsSchema,
    source_uri: z.string().optional(),
    cross_references: z.array(z.string()).optional(),
    ai_summary: z.string().optional(),
  })
  .passthrough();

export type PakeStandardFrontmatter = z.infer<typeof pakeStandardFrontmatterSchema>;
