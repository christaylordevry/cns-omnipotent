import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { appendRecord } from "../audit/audit-logger.js";
import { CnsError } from "../errors.js";
import { runIngestPipeline } from "../ingest/pipeline.js";
import { vaultReadFile } from "../tools/vault-read.js";
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
};

export const synthesisAdapterOutputSchema = z.object({
  patterns: z.array(z.string()),
  gaps: z.array(z.string()),
  opportunities: z.array(z.string()),
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

function wikilinkTarget(vaultPath: string): string {
  const base = path.basename(vaultPath, path.extname(vaultPath));
  return base;
}

function renderSection(heading: string, items: string[]): string {
  const lines = [`## ${heading}`, ""];
  if (items.length === 0) {
    lines.push("- _none identified_");
  } else {
    for (const item of items) lines.push(`- ${item}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderSourcesSection(
  sources: Array<{ vault_path: string; pake_id?: string | undefined }>,
): string {
  const lines = ["## Sources", ""];
  if (sources.length === 0) {
    lines.push("- _no readable sources_");
  } else {
    for (const src of sources) {
      const link = `[[${wikilinkTarget(src.vault_path)}]]`;
      lines.push(src.pake_id ? `- ${link} (${src.pake_id})` : `- ${link}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function renderSynthesisBody(args: {
  topic: string;
  summary: string;
  patterns: string[];
  gaps: string[];
  opportunities: string[];
  sources: Array<{ vault_path: string; pake_id?: string | undefined }>;
}): string {
  return [
    `# Synthesis: ${args.topic}`,
    "",
    args.summary,
    "",
    renderSection("Patterns", args.patterns),
    renderSection("Gaps", args.gaps),
    renderSection("Opportunities", args.opportunities),
    renderSourcesSection(args.sources),
  ].join("\n");
}

function pakeIdFromFrontmatter(fm: Record<string, unknown>): string | undefined {
  const v = fm["pake_id"];
  return typeof v === "string" && v.length > 0 ? v : undefined;
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
  });

  const outputParsed = synthesisAdapterOutputSchema.safeParse(rawOutput);
  if (!outputParsed.success) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `Synthesis adapter returned malformed output: ${outputParsed.error.message}`,
    );
  }
  const output = outputParsed.data;

  const sources_used = source_notes.map((s) => s.vault_path);
  const sourcesForBody = sources_used.map((vp) => {
    const pid = pake_id_map.get(vp);
    return pid ? { vault_path: vp, pake_id: pid } : { vault_path: vp };
  });

  const dateYmd = synthesis_timestamp.slice(0, 10);
  const title = `Synthesis: ${sweepResult.brief_topic} (${dateYmd})`;
  const body = renderSynthesisBody({
    topic: sweepResult.brief_topic,
    summary: output.summary,
    patterns: output.patterns,
    gaps: output.gaps,
    opportunities: output.opportunities,
    sources: sourcesForBody,
  });

  const ingestResult = await runIngestPipeline(
    vaultRoot,
    {
      input: body,
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
