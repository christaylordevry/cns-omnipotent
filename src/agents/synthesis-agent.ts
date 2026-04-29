import matter from "gray-matter";
import { z } from "zod";
import { appendRecord } from "../audit/audit-logger.js";
import { CnsError } from "../errors.js";
import { runIngestPipeline } from "../ingest/pipeline.js";
import { vaultReadFile } from "../tools/vault-read.js";
import {
  DEFAULT_OPERATOR_CONTEXT,
  operatorContextSchema,
  type OperatorContext,
} from "./operator-context.js";
import {
  vaultContextPacketSchema,
  type VaultContextPacket,
} from "./vault-context-builder.js";
import {
  researchSweepResultSchema,
  type ResearchSweepResult,
} from "./research-agent.js";

export type VaultReadAdapter = {
  readNote(vaultPath: string): Promise<{ body: string; frontmatter: Record<string, unknown> }>;
};

export type SynthesisAdapterInput = {
  topic: string;
  queries: string[];
  source_notes: Array<{
    vault_path: string;
    body: string;
    frontmatter: Record<string, unknown>;
  }>;
  operator_context: OperatorContext;
  vault_context_packet: VaultContextPacket;
};

export const synthesisAdapterOutputSchema = z.object({
  body: z.string().min(1),
  summary: z.string().min(1),
});

export type SynthesisAdapterOutput = z.infer<typeof synthesisAdapterOutputSchema>;

export type SynthesisAdapter = {
  synthesize(input: SynthesisAdapterInput): Promise<SynthesisAdapterOutput>;
};

export type SynthesisAgentAdapters = {
  vaultRead?: VaultReadAdapter | undefined;
  synthesis?: SynthesisAdapter | undefined;
};

export type SynthesisAgentOptions = {
  surface?: string;
  queries?: string[];
  adapters?: SynthesisAgentAdapters;
  operator_context?: OperatorContext;
  vault_context_packet?: VaultContextPacket;
};

export type SynthesisSkipReason = "no-source-notes" | "no-readable-sources";

export type SynthesisRunResult =
  | {
      status: "ok";
      insight_note: { vault_path: string; pake_id: string };
      sources_used: string[];
      sources_read_failed: string[];
      synthesis_timestamp: string;
    }
  | {
      status: "skipped";
      reason: SynthesisSkipReason;
      sources_read_failed: string[];
      synthesis_timestamp: string;
    };

export function createDefaultVaultReadAdapter(vaultRoot: string): VaultReadAdapter {
  return {
    async readNote(vaultPath: string) {
      const raw = await vaultReadFile(vaultRoot, vaultPath);
      const parsed = matter(raw);
      const fm =
        parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
          ? { ...(parsed.data as Record<string, unknown>) }
          : {};
      return { body: parsed.content, frontmatter: fm };
    },
  };
}

export function createDefaultSynthesisAdapter(): SynthesisAdapter {
  return {
    async synthesize() {
      throw new CnsError(
        "UNSUPPORTED",
        "Synthesis adapter not configured — inject an LLM-backed SynthesisAdapter via opts.adapters.synthesis",
      );
    },
  };
}

function pakeIdFromFrontmatter(fm: Record<string, unknown>): string | undefined {
  const v = fm["pake_id"];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function emptyVaultContextPacket(timestamp: string): VaultContextPacket {
  return {
    notes: [],
    total_notes: 0,
    token_budget_used: 0,
    retrieval_timestamp: timestamp,
  };
}

const NO_VAULT_CONTEXT_WARNING =
  "> [!warning] No vault context found — this synthesis is grounded in external research only.";

const REQUIRED_PAKE_MARKERS = [
  "## What We Know",
  "> [!note] Signal vs Noise",
  "## The Gap Map",
  "> [!warning] Blind Spots",
  "## Where Chris Has Leverage",
  "> [!tip] Highest-Leverage Move",
  "## Connected Vault Notes",
  "## Decisions Needed",
  "## Open Questions",
  "## Version / Run Metadata",
  "> [!abstract]",
] as const;

function countWords(text: string): number {
  return text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g)?.length ?? 0;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function countSentences(text: string): number {
  return text.match(/[^.!?]+[.!?]+(?=\s|$)/g)?.length ?? 0;
}

function sectionBetween(body: string, startMarker: string, endMarker: string): string {
  const start = body.indexOf(startMarker);
  if (start < 0) return "";
  const contentStart = start + startMarker.length;
  const end = body.indexOf(endMarker, contentStart);
  return body.slice(contentStart, end < 0 ? undefined : end);
}

function stripBlockquoteMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*>\s?/, ""))
    .join("\n")
    .trim();
}

function extractCalloutBody(body: string, marker: string): string {
  const lines = body.split("\n");
  const markerIndex = lines.findIndex((line) => line.trim() === marker);
  if (markerIndex < 0) return "";

  const contentLines: string[] = [];
  for (const line of lines.slice(markerIndex + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("> [!")) break;
    if (trimmed.startsWith(">")) {
      contentLines.push(line);
      continue;
    }
    if (trimmed.length === 0 && contentLines.length === 0) continue;
    break;
  }

  return stripBlockquoteMarkers(contentLines.join("\n"));
}

function hasBulletLines(section: string): boolean {
  return section.split("\n").some((line) => /^\s*[-*+]\s+/.test(line));
}

function hasTimeCue(text: string): boolean {
  return /\b(today|tomorrow|tonight|this (morning|afternoon|week|month|quarter|year)|next (week|month|quarter)|before|after|by|within|in \d+ (minutes?|hours?|days?|weeks?)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/i.test(
    text,
  );
}

function countMarkdownTableRows(body: string, header: string): number {
  const lines = body.split("\n");
  const headerIndex = lines.findIndex((line) => line.trim() === header);
  if (headerIndex < 0) return 0;

  let count = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) break;
    if (/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(trimmed)) continue;
    count += 1;
  }
  return count;
}

export function validatePakeSynthesisBody(args: {
  body: string;
  operator_context: OperatorContext;
  vault_context_packet: VaultContextPacket;
}): string[] {
  const failures: string[] = [];
  const { body, operator_context, vault_context_packet } = args;

  for (const marker of REQUIRED_PAKE_MARKERS) {
    if (!body.includes(marker)) failures.push(`missing required PAKE++ marker: ${marker}`);
  }

  const abstractIndex = body.indexOf("> [!abstract]");
  if (abstractIndex >= 0) {
    const laterMarker = REQUIRED_PAKE_MARKERS.filter((m) => m !== "> [!abstract]").find(
      (marker) => {
        const markerIndex = body.indexOf(marker);
        return markerIndex >= 0 && markerIndex > abstractIndex;
      },
    );
    if (laterMarker) {
      failures.push(`abstract callout must appear after required section: ${laterMarker}`);
    }
    const abstractSentenceCount = countSentences(
      extractCalloutBody(body, "> [!abstract]"),
    );
    if (abstractSentenceCount < 2 || abstractSentenceCount > 3) {
      failures.push("Abstract must contain 2-3 sentences");
    }
  }

  const whatWeKnow = sectionBetween(body, "## What We Know", "> [!note] Signal vs Noise");
  if (countWords(whatWeKnow) < 180) {
    failures.push("What We Know must contain at least 180 words");
  }
  if (hasBulletLines(whatWeKnow)) {
    failures.push("What We Know must be prose-only with no bullet lines");
  }
  if (countMatches(whatWeKnow, /\[\[[^\]]+\]\]/g) < 3) {
    failures.push("What We Know must contain at least 3 wikilinks");
  }

  const leverage = sectionBetween(
    body,
    "## Where Chris Has Leverage",
    "> [!tip] Highest-Leverage Move",
  );
  if (countWords(leverage) < 150) {
    failures.push("Where Chris Has Leverage must contain at least 150 words");
  }
  if (hasBulletLines(leverage)) {
    failures.push("Where Chris Has Leverage must be prose-only with no bullet lines");
  }
  const namedTracks = operator_context.tracks.filter((track) =>
    leverage.includes(track.name),
  );
  if (namedTracks.length < 2) {
    failures.push("Where Chris Has Leverage must name at least 2 operator tracks verbatim");
  }
  if (!leverage.includes(operator_context.location)) {
    failures.push("Where Chris Has Leverage must reference operator location");
  }
  if (!leverage.includes(operator_context.positioning)) {
    failures.push("Where Chris Has Leverage must reference operator positioning");
  }

  const highestLeverageMove = stripBlockquoteMarkers(
    sectionBetween(body, "> [!tip] Highest-Leverage Move", "## Connected Vault Notes"),
  );
  if (countWords(highestLeverageMove) < 10) {
    failures.push("Highest-Leverage Move must contain a specific action");
  }
  if (countMatches(highestLeverageMove, /\[\[[^\]]+\]\]/g) < 1) {
    failures.push("Highest-Leverage Move must be vault-connected with at least 1 wikilink");
  }
  if (!hasTimeCue(highestLeverageMove)) {
    failures.push("Highest-Leverage Move must be timeable");
  }

  if (
    countMarkdownTableRows(
      body,
      "| Claim | Agree | Disagree | Implication |",
    ) < 3
  ) {
    failures.push("Contradiction Ledger must contain at least 3 table rows");
  }
  if (countMarkdownTableRows(body, "| Known | Unknown | Why it matters |") < 4) {
    failures.push("Gap Map must contain at least 4 table rows");
  }
  if (countMarkdownTableRows(body, "| Note | Why relevant | Status |") < 5) {
    failures.push("Connected Vault Notes must contain at least 5 table rows");
  }

  const decisions = sectionBetween(body, "## Decisions Needed", "## Open Questions");
  const decisionBlocks = decisions
    .split(/^### Decision:/m)
    .slice(1)
    .map((block) => block.trim());
  if (decisionBlocks.length < 4) {
    failures.push("Decisions Needed must contain at least 4 decisions");
  }
  for (const [idx, decision] of decisionBlocks.entries()) {
    if (!decision.includes("- **Option A:**")) {
      failures.push(`Decision ${idx + 1} missing Option A`);
    }
    if (!decision.includes("- **Option B:**")) {
      failures.push(`Decision ${idx + 1} missing Option B`);
    }
    if (!decision.includes("- **Downstream consequence:**")) {
      failures.push(`Decision ${idx + 1} missing downstream consequence`);
    }
  }

  const openQuestions = sectionBetween(
    body,
    "## Open Questions",
    "## Version / Run Metadata",
  );
  if (countMatches(openQuestions, /^\s*\d+\.\s+\S/gm) < 3) {
    failures.push("Open Questions must contain at least 3 numbered items");
  }

  const hasOperatorProfile = vault_context_packet.notes.some(
    (note) => note.retrieval_reason === "operator-profile",
  );
  if (!hasOperatorProfile && !body.includes(NO_VAULT_CONTEXT_WARNING)) {
    failures.push("missing required no-vault-context warning when operator profile is absent");
  }

  return failures;
}

export async function runSynthesisAgent(
  vaultRoot: string,
  sweep: unknown,
  opts: SynthesisAgentOptions = {},
): Promise<SynthesisRunResult> {
  const parsed = researchSweepResultSchema.safeParse(sweep);
  if (!parsed.success) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Invalid ResearchSweepResult input: ${parsed.error.message}`,
    );
  }
  const sweepResult: ResearchSweepResult = parsed.data;

  const surface = opts.surface ?? "synthesis-agent";
  const vaultReadAdapter = opts.adapters?.vaultRead ?? createDefaultVaultReadAdapter(vaultRoot);
  const synthesisAdapter = opts.adapters?.synthesis ?? createDefaultSynthesisAdapter();
  const synthesis_timestamp = new Date().toISOString();

  const operatorContextIn = opts.operator_context ?? DEFAULT_OPERATOR_CONTEXT;
  const operatorContextParsed = operatorContextSchema.safeParse(operatorContextIn);
  if (!operatorContextParsed.success) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Invalid operator_context: ${operatorContextParsed.error.message}`,
    );
  }
  const operator_context = operatorContextParsed.data;

  const vaultContextPacketIn =
    opts.vault_context_packet ?? emptyVaultContextPacket(synthesis_timestamp);
  const vaultContextPacketParsed = vaultContextPacketSchema.safeParse(vaultContextPacketIn);
  if (!vaultContextPacketParsed.success) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Invalid vault_context_packet: ${vaultContextPacketParsed.error.message}`,
    );
  }
  const vault_context_packet = vaultContextPacketParsed.data;

  if (sweepResult.notes_created.length === 0) {
    await appendRecord(vaultRoot, {
      action: "synthesis_skipped",
      tool: "synthesis_agent",
      surface,
      targetPath: "no-insight-note",
      payloadInput: {
        topic: sweepResult.brief_topic,
        reason: "no-source-notes",
        sources_read_failed_count: 0,
      },
      isoUtc: synthesis_timestamp,
    });
    return {
      status: "skipped",
      reason: "no-source-notes",
      sources_read_failed: [],
      synthesis_timestamp,
    };
  }

  const source_notes: SynthesisAdapterInput["source_notes"] = [];
  const sources_read_failed: string[] = [];
  const pake_id_map = new Map<string, string>();

  for (const note of sweepResult.notes_created) {
    try {
      const read = await vaultReadAdapter.readNote(note.vault_path);
      source_notes.push({
        vault_path: note.vault_path,
        body: read.body,
        frontmatter: read.frontmatter,
      });
      const fmPakeId = pakeIdFromFrontmatter(read.frontmatter);
      pake_id_map.set(note.vault_path, fmPakeId ?? note.pake_id);
    } catch {
      sources_read_failed.push(note.vault_path);
    }
  }

  if (source_notes.length === 0) {
    await appendRecord(vaultRoot, {
      action: "synthesis_skipped",
      tool: "synthesis_agent",
      surface,
      targetPath: "no-insight-note",
      payloadInput: {
        topic: sweepResult.brief_topic,
        reason: "no-readable-sources",
        sources_read_failed_count: sources_read_failed.length,
      },
      isoUtc: synthesis_timestamp,
    });
    return {
      status: "skipped",
      reason: "no-readable-sources",
      sources_read_failed,
      synthesis_timestamp,
    };
  }

  const queries = opts.queries ?? [];
  const rawOutput = await synthesisAdapter.synthesize({
    topic: sweepResult.brief_topic,
    queries,
    source_notes,
    operator_context,
    vault_context_packet,
  });

  const outputParsed = synthesisAdapterOutputSchema.safeParse(rawOutput);
  if (!outputParsed.success) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Synthesis adapter returned malformed output: ${outputParsed.error.message}`,
    );
  }
  const output = outputParsed.data;

  const bodyValidationFailures = validatePakeSynthesisBody({
    body: output.body,
    operator_context,
    vault_context_packet,
  });
  if (bodyValidationFailures.length > 0) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Synthesis adapter returned PAKE++ body that failed validation: ${bodyValidationFailures.join("; ")}`,
    );
  }

  const sources_used = source_notes.map((s) => s.vault_path);

  const dateYmd = synthesis_timestamp.slice(0, 10);
  const title = `Synthesis: ${sweepResult.brief_topic} (${dateYmd})`;

  const ingestResult = await runIngestPipeline(
    vaultRoot,
    {
      input: output.body,
      source_type: "text",
      ingest_as: "InsightNote",
      title_hint: title,
      tags: [sweepResult.brief_topic, "synthesis", "research-sweep"],
      ai_summary: output.summary,
      confidence_score: 0.6,
    },
    { surface },
  );

  if (ingestResult.status !== "ok") {
    const detail =
      ingestResult.status === "conflict" || ingestResult.status === "validation_error"
        ? ingestResult.error
        : `unexpected ingest status: ${ingestResult.status}`;
    throw new CnsError("IO_ERROR", `Synthesis ingest failed: ${detail}`);
  }

  await appendRecord(vaultRoot, {
    action: "synthesis_run",
    tool: "synthesis_agent",
    surface,
    targetPath: ingestResult.vault_path,
    payloadInput: {
      topic: sweepResult.brief_topic,
      sources_used_count: sources_used.length,
      sources_read_failed_count: sources_read_failed.length,
      insight_note_pake_id: ingestResult.pake_id,
    },
    isoUtc: synthesis_timestamp,
  });

  return {
    status: "ok",
    insight_note: { vault_path: ingestResult.vault_path, pake_id: ingestResult.pake_id },
    sources_used,
    sources_read_failed,
    synthesis_timestamp,
  };
}
