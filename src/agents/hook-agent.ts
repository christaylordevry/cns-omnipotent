import path from "node:path";
import { z } from "zod";
import { appendRecord } from "../audit/audit-logger.js";
import { CnsError } from "../errors.js";
import { runIngestPipeline } from "../ingest/pipeline.js";
import {
  createDefaultVaultReadAdapter,
  type VaultReadAdapter,
} from "./synthesis-agent.js";

/** Mirrors `SynthesisSkipReason` for Zod (avoid circular import with synthesis-agent). */
const synthesisSkipReasonSchema = z.enum(["no-source-notes", "no-readable-sources"]);

export const synthesisRunResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    insight_note: z.object({
      vault_path: z.string(),
      pake_id: z.string(),
    }),
    sources_used: z.array(z.string()),
    sources_read_failed: z.array(z.string()),
    synthesis_timestamp: z.string(),
  }),
  z.object({
    status: z.literal("skipped"),
    reason: synthesisSkipReasonSchema,
    sources_read_failed: z.array(z.string()),
    synthesis_timestamp: z.string(),
  }),
]);

export const HOOK_SLOT_COUNT = 4 as const;
export const MIN_HOOK_ITERATIONS = 3;
export const MAX_HOOK_ITERATIONS = 20;

/** Shape of a single settled hook slot (final text + per-iteration score trace). */
export const hookSlotResultSchema = z.object({
  slot: z.number().int().min(1),
  final_hook: z.string().min(1),
  iterations: z.number().int().min(1),
  trace: z.array(
    z.object({
      iteration: z.number().int().min(1),
      score: z.number().int().min(1).max(10),
    }),
  ),
});

/**
 * Discriminated union for the Hook Agent's run result. Exported so downstream
 * agents (e.g. Boss Agent, 17-5) can validate `unknown` input with a single
 * source of truth rather than mirroring the shape.
 */
export const hookRunResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    hook_set_note: z.object({ vault_path: z.string(), pake_id: z.string() }),
    synthesis_insight_path: z.string(),
    options: z.array(hookSlotResultSchema),
    hook_timestamp: z.string(),
  }),
  z.object({
    status: z.literal("skipped"),
    reason: z.enum(["synthesis-skipped", "synthesis-read-failed"]),
    synthesis_skip_reason: synthesisSkipReasonSchema.optional(),
    hook_timestamp: z.string(),
  }),
]);

export type HookGenerationAdapterInput = {
  synthesis_body: string;
  synthesis_vault_path: string;
  synthesis_title: string | undefined;
  hook_slot: number;
  iteration: number;
  current_draft: string;
};

export const hookGenerationAdapterOutputSchema = z.object({
  hook_text: z.string().min(1),
  score: z.number().int().min(1).max(10),
});

export type HookGenerationAdapterOutput = z.infer<typeof hookGenerationAdapterOutputSchema>;

export type HookGenerationAdapter = {
  generateOrRefine(input: HookGenerationAdapterInput): Promise<HookGenerationAdapterOutput>;
};

export type HookAgentAdapters = {
  vaultRead?: VaultReadAdapter | undefined;
  hookGeneration?: HookGenerationAdapter | undefined;
};

export type HookAgentOptions = {
  surface?: string;
  adapters?: HookAgentAdapters | undefined;
};

export type HookIterationTrace = { iteration: number; score: number };

export type HookSlotResult = {
  slot: number;
  final_hook: string;
  iterations: number;
  trace: HookIterationTrace[];
};

export type HookRunResult =
  | {
      status: "ok";
      hook_set_note: { vault_path: string; pake_id: string };
      synthesis_insight_path: string;
      options: HookSlotResult[];
      hook_timestamp: string;
    }
  | {
      status: "skipped";
      reason: "synthesis-skipped" | "synthesis-read-failed";
      synthesis_skip_reason?: "no-source-notes" | "no-readable-sources" | undefined;
      hook_timestamp: string;
    };

export function createDefaultHookGenerationAdapter(): HookGenerationAdapter {
  return {
    async generateOrRefine() {
      throw new CnsError(
        "UNSUPPORTED",
        "Hook generation adapter not configured — inject an LLM-backed HookGenerationAdapter via opts.adapters.hookGeneration",
      );
    },
  };
}

function wikilinkTarget(vaultPath: string): string {
  const base = path.basename(vaultPath, path.extname(vaultPath));
  return base;
}

function parseTopicFromSynthesis(body: string, frontmatter: Record<string, unknown>): string {
  const m = body.match(/^#\s*Synthesis:\s*(.+)$/m);
  if (m?.[1]) return m[1].trim();
  const title = frontmatter.title;
  if (typeof title === "string" && title.length > 0) {
    return title.replace(/^Synthesis:\s*/i, "").replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, "").trim();
  }
  return "research-topic";
}

function topicTagSlug(topic: string): string {
  const s = topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "research-topic";
}

function renderHookSetBody(args: {
  topic: string;
  synthesisInsightPath: string;
  options: HookSlotResult[];
}): string {
  const synLink = `[[${wikilinkTarget(args.synthesisInsightPath)}]]`;
  const lines: string[] = [
    `# Hook set: ${args.topic}`,
    "",
    `Synthesis: ${synLink}`,
    "",
    "_Each option ran at least three refinement iterations and passed a 10/10 gate._",
    "",
  ];
  for (const opt of args.options) {
    lines.push(`## Hook option ${opt.slot}`, "");
    lines.push(opt.final_hook, "");
    lines.push("### Iteration trace", "");
    for (const t of opt.trace) {
      lines.push(`- Iteration ${t.iteration}: score ${t.score}/10`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

async function runOneHookSlot(
  adapter: HookGenerationAdapter,
  ctx: Omit<HookGenerationAdapterInput, "iteration" | "current_draft" | "hook_slot"> & {
    hook_slot: number;
  },
): Promise<HookSlotResult> {
  let draft = "";
  const trace: HookIterationTrace[] = [];

  for (let iteration = 1; iteration <= MAX_HOOK_ITERATIONS; iteration++) {
    const raw = await adapter.generateOrRefine({
      ...ctx,
      hook_slot: ctx.hook_slot,
      iteration,
      current_draft: draft,
    });
    const parsed = hookGenerationAdapterOutputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new CnsError(
        "SCHEMA_INVALID",
        `Hook adapter returned malformed output (slot ${ctx.hook_slot}): ${parsed.error.message}`,
      );
    }
    draft = parsed.data.hook_text;
    trace.push({ iteration, score: parsed.data.score });

    if (iteration >= MIN_HOOK_ITERATIONS && parsed.data.score >= 10) {
      return { slot: ctx.hook_slot, final_hook: draft, iterations: iteration, trace };
    }
  }

  const last = trace[trace.length - 1];
  throw new CnsError(
    "IO_ERROR",
    `Hook slot ${ctx.hook_slot} did not reach 10/10 within ${MAX_HOOK_ITERATIONS} iterations (last score: ${last?.score ?? 0})`,
  );
}

export async function runHookAgent(
  vaultRoot: string,
  synthesisResult: unknown,
  opts: HookAgentOptions = {},
): Promise<HookRunResult> {
  const parsed = synthesisRunResultSchema.safeParse(synthesisResult);
  if (!parsed.success) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Invalid SynthesisRunResult input: ${parsed.error.message}`,
    );
  }
  const sr = parsed.data;

  const surface = opts.surface ?? "hook-agent";
  const hook_timestamp = new Date().toISOString();
  const vaultReadAdapter = opts.adapters?.vaultRead ?? createDefaultVaultReadAdapter(vaultRoot);
  const hookAdapter = opts.adapters?.hookGeneration ?? createDefaultHookGenerationAdapter();

  if (sr.status === "skipped") {
    await appendRecord(vaultRoot, {
      action: "hook_skipped",
      tool: "hook_agent",
      surface,
      targetPath: "no-hook-set-note",
      payloadInput: {
        reason: "synthesis-skipped",
        synthesis_reason: sr.reason,
      },
      isoUtc: hook_timestamp,
    });
    return {
      status: "skipped",
      reason: "synthesis-skipped",
      synthesis_skip_reason: sr.reason,
      hook_timestamp,
    };
  }

  let synthesis_body: string;
  let synthesis_fm: Record<string, unknown>;
  try {
    const read = await vaultReadAdapter.readNote(sr.insight_note.vault_path);
    synthesis_body = read.body;
    synthesis_fm = read.frontmatter;
  } catch {
    await appendRecord(vaultRoot, {
      action: "hook_skipped",
      tool: "hook_agent",
      surface,
      targetPath: "no-hook-set-note",
      payloadInput: {
        reason: "synthesis-read-failed",
        insight_path: sr.insight_note.vault_path,
      },
      isoUtc: hook_timestamp,
    });
    return {
      status: "skipped",
      reason: "synthesis-read-failed",
      hook_timestamp,
    };
  }

  const titleFm =
    typeof synthesis_fm.title === "string" && synthesis_fm.title.length > 0
      ? synthesis_fm.title
      : undefined;
  const topic = parseTopicFromSynthesis(synthesis_body, synthesis_fm);
  const adapterCtx = {
    synthesis_body,
    synthesis_vault_path: sr.insight_note.vault_path,
    synthesis_title: titleFm,
  };

  const options: HookSlotResult[] = [];
  for (let slot = 1; slot <= HOOK_SLOT_COUNT; slot++) {
    options.push(await runOneHookSlot(hookAdapter, { ...adapterCtx, hook_slot: slot }));
  }

  const dateYmd = hook_timestamp.slice(0, 10);
  const titleHint = `Hooks: ${topic} (${dateYmd})`;
  const body = renderHookSetBody({
    topic,
    synthesisInsightPath: sr.insight_note.vault_path,
    options,
  });

  const ingestResult = await runIngestPipeline(
    vaultRoot,
    {
      input: body,
      source_type: "text",
      ingest_as: "HookSetNote",
      title_hint: titleHint,
      tags: [topicTagSlug(topic), "hook-set", "research-sweep"],
      ai_summary: `Four hook options (10/10 gate, ≥${MIN_HOOK_ITERATIONS} iterations each) for: ${topic}`,
      confidence_score: 0.65,
    },
    { surface },
  );

  if (ingestResult.status !== "ok") {
    const detail =
      ingestResult.status === "conflict" || ingestResult.status === "validation_error"
        ? ingestResult.error
        : `unexpected ingest status: ${ingestResult.status}`;
    throw new CnsError("IO_ERROR", `Hook set ingest failed: ${detail}`);
  }

  await appendRecord(vaultRoot, {
    action: "hook_run",
    tool: "hook_agent",
    surface,
    targetPath: ingestResult.vault_path,
    payloadInput: {
      topic,
      hook_set_note_pake_id: ingestResult.pake_id,
      synthesis_insight_path: sr.insight_note.vault_path,
      slots: options.map((o) => ({ slot: o.slot, iterations: o.iterations })),
    },
    isoUtc: hook_timestamp,
  });

  return {
    status: "ok",
    hook_set_note: { vault_path: ingestResult.vault_path, pake_id: ingestResult.pake_id },
    synthesis_insight_path: sr.insight_note.vault_path,
    options,
    hook_timestamp,
  };
}
