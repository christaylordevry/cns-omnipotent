import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { RECALL_CHANNEL_KEYS, type RecallChannel } from "./recall-policy.js";

export const BRAIN_GOLDEN_QUERIES_SCHEMA_VERSION = 1 as const;

const recallChannelSchema = z.enum(RECALL_CHANNEL_KEYS);

const goldenQuerySchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  expected_paths: z.array(z.string().min(1)).min(1),
  forbidden_paths: z.array(z.string().min(1)).optional(),
  channels: z.array(recallChannelSchema).min(1).optional(),
  provenance: z.string().min(1),
  notes: z.string().optional(),
});

const brainGoldenQueriesSchema = z.object({
  schema_version: z.literal(BRAIN_GOLDEN_QUERIES_SCHEMA_VERSION),
  curated_by: z.string().min(1),
  curated_at: z.string().min(1),
  curation_notes: z.string().optional(),
  operator_signoff: z.enum(["pending", "confirmed"]).optional(),
  queries: z.array(goldenQuerySchema).min(10),
});

export type GoldenQuery = z.infer<typeof goldenQuerySchema>;
export type BrainGoldenQueries = z.infer<typeof brainGoldenQueriesSchema>;

export type BrainGoldenQueriesParseResult =
  | { ok: true; value: BrainGoldenQueries }
  | { ok: false; message: string };

export const BRAIN_GOLDEN_QUERIES_REPO_REL = "config/brain-golden-queries.json";

export function parseBrainGoldenQueries(jsonText: string): BrainGoldenQueriesParseResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { ok: false, message: "Input is not valid JSON." };
  }
  const parsed = brainGoldenQueriesSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const at = first?.path.length ? ` at "${first.path.join(".")}"` : "";
    return { ok: false, message: `Invalid golden queries shape${at} (${first?.code ?? "schema"}).` };
  }
  return { ok: true, value: parsed.data };
}

export async function loadBrainGoldenQueriesFromFile(absPath: string): Promise<BrainGoldenQueries> {
  const text = await readFile(absPath, "utf8");
  const parsed = parseBrainGoldenQueries(text);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

export async function loadBrainGoldenQueriesFromRepo(repoRoot: string): Promise<BrainGoldenQueries> {
  return loadBrainGoldenQueriesFromFile(path.join(repoRoot, BRAIN_GOLDEN_QUERIES_REPO_REL));
}

export function channelsForGoldenQuery(query: GoldenQuery): RecallChannel[] {
  return query.channels ?? [...RECALL_CHANNEL_KEYS];
}
