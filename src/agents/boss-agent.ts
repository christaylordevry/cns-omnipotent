import path from "node:path";
import { z } from "zod";
import { appendRecord } from "../audit/audit-logger.js";
import { CnsError } from "../errors.js";
import { runIngestPipeline } from "../ingest/pipeline.js";
import {
  createDefaultVaultReadAdapter,
  type VaultReadAdapter,
} from "./synthesis-agent.js";
import { hookRunResultSchema } from "./hook-agent.js";

/**
 * Weapons-check scoring rubric. Exported so production callers can surface the
 * same criteria to human reviewers, and asserted verbatim in tests so edits
 * here are deliberate. The full literal is also embedded in every rendered
 * `WeaponsCheckNote` body.
 */
export const WEAPONS_RUBRIC = `**Invention novelty (1–10)** — Does this hook present a new angle the audience has not already internalised?
- 1: commodity platitude, interchangeable with competitor copy
- 4: a familiar insight dressed in fresher language
- 7: recognisable territory with a legitimately new framing
- 10: a reframe the reader cannot unread — the core claim did not previously exist in the category conversation

**Copy intensity (1–10)** — Does every word pull weight, and does the line hit kinetically?
- 1: mushy, abstract, passive; could be removed without loss
- 4: clear but inert; no rhythm, no verbs doing work
- 7: tight and concrete, one or two soft spots
- 10: every word pulls — concrete nouns, active verbs, specific stakes, nothing trimmable

Gate: both dimensions must equal 10 (integer) simultaneously; any lower score triggers a rewrite and re-score.` as const;

export const MAX_WEAPONS_ITERATIONS = 10;

export type WeaponsCheckAdapterInput = {
  topic: string;
  synthesis_insight_path: string;
  hook_set_note_path: string;
  hook_slot: number;
  iteration: number;
  current_hook: string;
};

export const weaponsCheckScoresSchema = z.object({
  novelty: z.number().int().min(1).max(10),
  copy_intensity: z.number().int().min(1).max(10),
  rationale: z.string().min(1),
});

export const weaponsCheckAdapterOutputSchema = z.object({
  revised_hook: z.string().min(1),
  scores: weaponsCheckScoresSchema,
});

export type WeaponsCheckAdapterOutput = z.infer<typeof weaponsCheckAdapterOutputSchema>;

export type WeaponsCheckAdapter = {
  scoreAndRewrite(input: WeaponsCheckAdapterInput): Promise<WeaponsCheckAdapterOutput>;
};

export type BossAgentAdapters = {
  vaultRead?: VaultReadAdapter | undefined;
  weaponsCheck?: WeaponsCheckAdapter | undefined;
};

export type BossAgentOptions = {
  surface?: string;
  adapters?: BossAgentAdapters | undefined;
};

export type WeaponsIterationTrace = {
  iteration: number;
  novelty: number;
  copy_intensity: number;
  rationale: string;
};

export type WeaponsSlotResult = {
  slot: number;
  final_hook: string;
  iterations: number;
  trace: WeaponsIterationTrace[];
};

export type BossRunResult =
  | {
      status: "ok";
      weapons_check_note: { vault_path: string; pake_id: string };
      hook_set_note_path: string;
      synthesis_insight_path: string;
      options: WeaponsSlotResult[];
      weapons_timestamp: string;
    }
  | {
      status: "skipped";
      reason: "hook-skipped";
      hook_skip_reason: "synthesis-skipped" | "synthesis-read-failed";
      synthesis_skip_reason?: "no-source-notes" | "no-readable-sources" | undefined;
      weapons_timestamp: string;
    };

export function createDefaultWeaponsCheckAdapter(): WeaponsCheckAdapter {
  return {
    async scoreAndRewrite() {
      throw new CnsError(
        "UNSUPPORTED",
        "Weapons check adapter not configured — inject an LLM-backed WeaponsCheckAdapter via opts.adapters.weaponsCheck",
      );
    },
  };
}

function wikilinkTarget(vaultPath: string): string {
  return path.basename(vaultPath, path.extname(vaultPath));
}

function parseTopicFromHookSet(body: string, frontmatter: Record<string, unknown>): string {
  const m = body.match(/^#\s*Hook set:\s*(.+)$/m);
  if (m?.[1]) return m[1].trim();
  const title = frontmatter.title;
  if (typeof title === "string" && title.length > 0) {
    return title
      .replace(/^Hooks:\s*/i, "")
      .replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, "")
      .trim();
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

function renderWeaponsCheckBody(args: {
  topic: string;
  hookSetNotePath: string;
  synthesisInsightPath: string;
  options: WeaponsSlotResult[];
}): string {
  const hookLink = `[[${wikilinkTarget(args.hookSetNotePath)}]]`;
  const synLink = `[[${wikilinkTarget(args.synthesisInsightPath)}]]`;
  const lines: string[] = [
    `# Weapons check: ${args.topic}`,
    "",
    `Hook set: ${hookLink}`,
    `Synthesis: ${synLink}`,
    "",
    "_All four hooks cleared the weapons gate (novelty >= 9 AND copy intensity >= 9)._",
    "",
    "## Rubric",
    "",
    WEAPONS_RUBRIC,
    "",
  ];
  for (const opt of args.options) {
    lines.push(`## Hook option ${opt.slot}`, "");
    lines.push(`**Final hook:** ${opt.final_hook}`, "");
    lines.push(
      `**Final scores:** novelty 9+/10 · copy intensity 9+/10 · iterations ${opt.iterations}`,
      "",
    );
    lines.push("### Iteration trace", "");
    for (const t of opt.trace) {
      lines.push(
        `- Iteration ${t.iteration}: novelty ${t.novelty}, copy ${t.copy_intensity} — ${t.rationale}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

async function runOneWeaponsSlot(
  adapter: WeaponsCheckAdapter,
  ctx: {
    topic: string;
    synthesis_insight_path: string;
    hook_set_note_path: string;
    hook_slot: number;
    initial_hook: string;
  },
): Promise<WeaponsSlotResult> {
  let draft = ctx.initial_hook;
  const trace: WeaponsIterationTrace[] = [];

  for (let iteration = 1; iteration <= MAX_WEAPONS_ITERATIONS; iteration++) {
    const raw = await adapter.scoreAndRewrite({
      topic: ctx.topic,
      synthesis_insight_path: ctx.synthesis_insight_path,
      hook_set_note_path: ctx.hook_set_note_path,
      hook_slot: ctx.hook_slot,
      iteration,
      current_hook: draft,
    });
    const parsed = weaponsCheckAdapterOutputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new CnsError(
        "SCHEMA_INVALID",
        `Weapons adapter returned malformed output (slot ${ctx.hook_slot}): ${parsed.error.message}`,
      );
    }
    draft = parsed.data.revised_hook;
    trace.push({
      iteration,
      novelty: parsed.data.scores.novelty,
      copy_intensity: parsed.data.scores.copy_intensity,
      rationale: parsed.data.scores.rationale,
    });
    if (
      parsed.data.scores.novelty >= 9 &&
      parsed.data.scores.copy_intensity >= 9
    ) {
      return {
        slot: ctx.hook_slot,
        final_hook: draft,
        iterations: iteration,
        trace,
      };
    }
  }

  const last = trace[trace.length - 1];
  throw new CnsError(
    "IO_ERROR",
    `Weapons slot ${ctx.hook_slot} failed the novelty+copy_intensity gate (9+/10 required) within ${MAX_WEAPONS_ITERATIONS} iterations (last scores: novelty ${last?.novelty ?? 0}, copy_intensity ${last?.copy_intensity ?? 0})`,
  );
}

/**
 * Run the Boss Agent: subject every hook slot to a novelty + copy-intensity
 * weapons check and emit a single governed `WeaponsCheckNote` only if every
 * slot clears the 10/10 gate on both dimensions.
 */
export async function runBossAgent(
  vaultRoot: string,
  hookResult: unknown,
  opts: BossAgentOptions = {},
): Promise<BossRunResult> {
  const parsed = hookRunResultSchema.safeParse(hookResult);
  if (!parsed.success) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Invalid HookRunResult input: ${parsed.error.message}`,
    );
  }
  const hr = parsed.data;

  const surface = opts.surface ?? "boss-agent";
  const weapons_timestamp = new Date().toISOString();
  const vaultReadAdapter =
    opts.adapters?.vaultRead ?? createDefaultVaultReadAdapter(vaultRoot);
  const weaponsAdapter =
    opts.adapters?.weaponsCheck ?? createDefaultWeaponsCheckAdapter();

  if (hr.status === "skipped") {
    await appendRecord(vaultRoot, {
      action: "weapons_skipped",
      tool: "boss_agent",
      surface,
      targetPath: "no-weapons-check-note",
      payloadInput: {
        reason: "hook-skipped",
        hook_skip_reason: hr.reason,
        ...(hr.synthesis_skip_reason !== undefined
          ? { synthesis_skip_reason: hr.synthesis_skip_reason }
          : {}),
      },
      isoUtc: weapons_timestamp,
    });
    return {
      status: "skipped",
      reason: "hook-skipped",
      hook_skip_reason: hr.reason,
      synthesis_skip_reason: hr.synthesis_skip_reason,
      weapons_timestamp,
    };
  }

  let hook_set_body: string;
  let hook_set_fm: Record<string, unknown>;
  try {
    const read = await vaultReadAdapter.readNote(hr.hook_set_note.vault_path);
    hook_set_body = read.body;
    hook_set_fm = read.frontmatter;
  } catch (err) {
    throw new CnsError(
      "IO_ERROR",
      `Boss Agent failed to read HookSetNote at ${hr.hook_set_note.vault_path}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const topic = parseTopicFromHookSet(hook_set_body, hook_set_fm);

  const options: WeaponsSlotResult[] = [];
  for (const slot of hr.options) {
    options.push(
      await runOneWeaponsSlot(weaponsAdapter, {
        topic,
        synthesis_insight_path: hr.synthesis_insight_path,
        hook_set_note_path: hr.hook_set_note.vault_path,
        hook_slot: slot.slot,
        initial_hook: slot.final_hook,
      }),
    );
  }

  const dateYmd = weapons_timestamp.slice(0, 10);
  const titleHint = `Weapons check: ${topic} (${dateYmd})`;
  const body = renderWeaponsCheckBody({
    topic,
    hookSetNotePath: hr.hook_set_note.vault_path,
    synthesisInsightPath: hr.synthesis_insight_path,
    options,
  });

  const ingestResult = await runIngestPipeline(
    vaultRoot,
    {
      input: body,
      source_type: "text",
      ingest_as: "WeaponsCheckNote",
      title_hint: titleHint,
      tags: [topicTagSlug(topic), "weapons-check", "research-sweep"],
      ai_summary: `Four hooks passed the weapons gate (novelty >= 9 AND copy intensity >= 9) for: ${topic}`,
      confidence_score: 0.7,
    },
    { surface },
  );

  if (ingestResult.status !== "ok") {
    const detail =
      ingestResult.status === "conflict" || ingestResult.status === "validation_error"
        ? ingestResult.error
        : `unexpected ingest status: ${ingestResult.status}`;
    throw new CnsError("IO_ERROR", `WeaponsCheckNote ingest failed: ${detail}`);
  }

  await appendRecord(vaultRoot, {
    action: "weapons_run",
    tool: "boss_agent",
    surface,
    targetPath: ingestResult.vault_path,
    payloadInput: {
      topic,
      weapons_check_note_pake_id: ingestResult.pake_id,
      hook_set_note_path: hr.hook_set_note.vault_path,
      slots: options.map((o) => ({ slot: o.slot, iterations: o.iterations })),
    },
    isoUtc: weapons_timestamp,
  });

  return {
    status: "ok",
    weapons_check_note: {
      vault_path: ingestResult.vault_path,
      pake_id: ingestResult.pake_id,
    },
    hook_set_note_path: hr.hook_set_note.vault_path,
    synthesis_insight_path: hr.synthesis_insight_path,
    options,
    weapons_timestamp,
  };
}
