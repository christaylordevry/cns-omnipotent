import path from "node:path";
import { z } from "zod";
import { appendRecord } from "../audit/audit-logger.js";
import { runIngestPipeline, type IngestResult } from "../ingest/pipeline.js";
import {
  createPerplexitySlot,
  type PerplexityResult,
  type PerplexitySlot,
} from "./perplexity-slot.js";

export const researchBriefSchema = z.object({
  topic: z.string().min(1),
  queries: z.array(z.string().min(1)).min(1).max(10),
  depth: z.enum(["shallow", "standard", "deep"]),
  tags: z.array(z.string()).optional(),
});

export type ResearchBrief = z.infer<typeof researchBriefSchema>;

export const skipReasonSchema = z.enum(["duplicate", "validation_error", "conflict", "fetch_error"]);
export type SkipReason = z.infer<typeof skipReasonSchema>;

export const researchSourceSchema = z.enum(["firecrawl", "apify", "perplexity"]);
export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const createdNoteSchema = z.object({
  vault_path: z.string(),
  pake_id: z.string(),
  source_uri: z.string().optional(),
  source: researchSourceSchema,
});
export type CreatedNote = z.infer<typeof createdNoteSchema>;

export const skippedNoteSchema = z.object({
  source_uri: z.string(),
  reason: skipReasonSchema,
});
export type SkippedNote = z.infer<typeof skippedNoteSchema>;

export const researchSweepResultSchema = z.object({
  brief_topic: z.string(),
  notes_created: z.array(createdNoteSchema),
  notes_skipped: z.array(skippedNoteSchema),
  perplexity_skipped: z.boolean(),
  /** Count of Perplexity answers successfully filed as InsightNote/SynthesisNote this sweep. */
  perplexity_answers_filed: z.number().int().min(0),
  sweep_timestamp: z.string(),
});
export type ResearchSweepResult = z.infer<typeof researchSweepResultSchema>;

/** Synthetic `source_uri` when the Firecrawl search adapter throws for a query (not a real URL). */
export function firecrawlQueryAdapterFailureUri(query: string): string {
  return `urn:cns:research-sweep:firecrawl:query:${encodeURIComponent(query)}`;
}

/** Synthetic `source_uri` when the Apify rag-web-browser adapter throws for a query. */
export function apifyQueryAdapterFailureUri(query: string): string {
  return `urn:cns:research-sweep:apify:query:${encodeURIComponent(query)}`;
}

/** Synthetic `source_uri` / provenance for a filed Perplexity answer (one per brief query). */
export function perplexityAnswerSourceUri(query: string): string {
  return `urn:cns:research-sweep:perplexity:answer:${encodeURIComponent(query)}`;
}

function sweepBaseTags(brief: ResearchBrief, sweepLabel: "research-sweep" | "apify-sweep"): string[] {
  return [brief.topic, ...brief.queries, sweepLabel, ...(brief.tags ?? [])];
}

export type FirecrawlSearchResult = {
  url: string;
  title?: string;
  snippet?: string;
};

export type FirecrawlAdapter = {
  search(query: string, opts: { limit: number }): Promise<FirecrawlSearchResult[]>;
  scrape(url: string): Promise<{ markdown: string; title?: string }>;
};

export type ApifyRagResult = {
  url?: string;
  title?: string;
  text: string;
};

export type ApifyAdapter = {
  ragWebBrowser(query: string, opts: { limit: number }): Promise<ApifyRagResult[]>;
};

export type ResearchAgentAdapters = {
  firecrawl?: FirecrawlAdapter | undefined;
  apify?: ApifyAdapter | undefined;
  perplexity?: PerplexitySlot | undefined;
};

export type ResearchAgentOptions = {
  surface?: string;
  adapters?: ResearchAgentAdapters;
};

type DepthProfile = {
  firecrawlLimit: number;
  firecrawlScrape: boolean;
  apifyLimit: number;
};

function profileForDepth(depth: ResearchBrief["depth"]): DepthProfile {
  switch (depth) {
    case "shallow":
      return { firecrawlLimit: 2, firecrawlScrape: false, apifyLimit: 2 };
    case "deep":
      return { firecrawlLimit: 5, firecrawlScrape: true, apifyLimit: 5 };
    case "standard":
    default:
      return { firecrawlLimit: 5, firecrawlScrape: false, apifyLimit: 5 };
  }
}

function classifyIngestSkip(
  result: Exclude<IngestResult, { status: "ok" }>,
): SkipReason {
  switch (result.status) {
    case "duplicate":
      return "duplicate";
    case "conflict":
      return "conflict";
    case "validation_error":
      return "validation_error";
  }
}

export async function firecrawlSweep(
  vaultRoot: string,
  brief: ResearchBrief,
  adapter: FirecrawlAdapter,
  opts: { surface: string; profile: DepthProfile },
): Promise<{ created: CreatedNote[]; skipped: SkippedNote[] }> {
  const created: CreatedNote[] = [];
  const skipped: SkippedNote[] = [];
  const baseTags = sweepBaseTags(brief, "research-sweep");

  for (const query of brief.queries) {
    let results: FirecrawlSearchResult[];
    try {
      results = await adapter.search(query, { limit: opts.profile.firecrawlLimit });
    } catch {
      skipped.push({ source_uri: firecrawlQueryAdapterFailureUri(query), reason: "fetch_error" });
      continue;
    }

    for (const hit of results) {
      let body: string;
      let titleHint: string | undefined;
      try {
        if (opts.profile.firecrawlScrape) {
          const scraped = await adapter.scrape(hit.url);
          body = scraped.markdown;
          titleHint = scraped.title ?? hit.title;
        } else {
          body = hit.snippet ?? hit.title ?? hit.url;
          titleHint = hit.title;
        }
      } catch {
        skipped.push({ source_uri: hit.url, reason: "fetch_error" });
        continue;
      }

      if (body.trim().length === 0) {
        skipped.push({ source_uri: hit.url, reason: "fetch_error" });
        continue;
      }

      const result = await runIngestPipeline(
        vaultRoot,
        {
          input: hit.url,
          source_type: "url",
          fetched_content: body,
          title_hint: titleHint,
          ingest_as: "SourceNote",
          tags: baseTags,
        },
        { surface: opts.surface },
      );

      if (result.status === "ok") {
        created.push({
          vault_path: result.vault_path,
          pake_id: result.pake_id,
          source_uri: hit.url,
          source: "firecrawl",
        });
      } else {
        const source_uri =
          result.status === "duplicate" ? result.source_uri : hit.url;
        skipped.push({ source_uri, reason: classifyIngestSkip(result) });
      }
    }
  }

  return { created, skipped };
}

export async function apifySweep(
  vaultRoot: string,
  brief: ResearchBrief,
  adapter: ApifyAdapter,
  opts: { surface: string; profile: DepthProfile },
): Promise<{ created: CreatedNote[]; skipped: SkippedNote[] }> {
  const created: CreatedNote[] = [];
  const skipped: SkippedNote[] = [];
  const baseTags = sweepBaseTags(brief, "apify-sweep");

  for (const query of brief.queries) {
    let snippets: ApifyRagResult[];
    try {
      snippets = await adapter.ragWebBrowser(query, { limit: opts.profile.apifyLimit });
    } catch {
      skipped.push({ source_uri: apifyQueryAdapterFailureUri(query), reason: "fetch_error" });
      continue;
    }

    for (const snippet of snippets) {
      const hasUrl = typeof snippet.url === "string" && snippet.url.length > 0;
      const body = snippet.text;
      if (!body || body.trim().length === 0) {
        if (hasUrl) skipped.push({ source_uri: snippet.url as string, reason: "fetch_error" });
        continue;
      }

      const input = hasUrl ? (snippet.url as string) : body;
      const sourceUriForSkip = hasUrl ? (snippet.url as string) : "";

      const ingestInput = hasUrl
        ? {
            input,
            source_type: "url" as const,
            fetched_content: body,
            title_hint: snippet.title,
            ingest_as: "SourceNote" as const,
            tags: baseTags,
          }
        : {
            input,
            source_type: "text" as const,
            title_hint: snippet.title,
            ingest_as: "SourceNote" as const,
            tags: baseTags,
          };

      const result = await runIngestPipeline(vaultRoot, ingestInput, { surface: opts.surface });

      if (result.status === "ok") {
        const created_entry: CreatedNote = {
          vault_path: result.vault_path,
          pake_id: result.pake_id,
          source: "apify",
        };
        if (hasUrl) created_entry.source_uri = snippet.url as string;
        created.push(created_entry);
      } else {
        const source_uri =
          result.status === "duplicate" ? result.source_uri : sourceUriForSkip;
        skipped.push({ source_uri, reason: classifyIngestSkip(result) });
      }
    }
  }

  return { created, skipped };
}

async function perplexityProbe(slot: PerplexitySlot, brief: ResearchBrief): Promise<boolean> {
  if (!slot.available) return true;
  try {
    await slot.search(brief.queries[0]);
    return false;
  } catch {
    return true;
  }
}

function canonUrlKey(raw: string): string | null {
  const t = raw.trim();
  const withScheme = /^https?:\/\//i.test(t) ? t : /^www\./i.test(t) ? `https://${t}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    const p = u.pathname.replace(/\/$/, "") || "/";
    return `${u.hostname.toLowerCase()}|${p}`;
  } catch {
    return null;
  }
}

function citationMatchesSourceUri(citation: string, sourceUri: string): boolean {
  const c = citation.trim();
  const s = sourceUri.trim();
  if (!c || !s) return false;
  if (c === s) return true;
  const kc = canonUrlKey(c);
  const ks = canonUrlKey(s);
  return kc !== null && ks !== null && kc === ks;
}

function matchLinkedAcquisitionNotes(acquisition: CreatedNote[], citations: string[]): CreatedNote[] {
  const out: CreatedNote[] = [];
  const seen = new Set<string>();
  for (const cite of citations) {
    if (!cite || cite.trim().length === 0) continue;
    for (const note of acquisition) {
      if (note.source === "perplexity") continue;
      const su = note.source_uri;
      if (!su) continue;
      if (citationMatchesSourceUri(cite, su)) {
        if (!seen.has(note.vault_path)) {
          seen.add(note.vault_path);
          out.push(note);
        }
      }
    }
  }
  return out;
}

function wikilinkBasename(vaultPath: string): string {
  return path.basename(vaultPath, path.extname(vaultPath));
}

function renderPerplexityAnswerBody(args: {
  briefTopic: string;
  query: string;
  answer: string;
  citations: string[];
  linked: CreatedNote[];
}): string {
  const citeBlock =
    args.citations.length === 0
      ? "- _none returned_"
      : args.citations.map((c) => `- ${c}`).join("\n");
  const linkBlock =
    args.linked.length === 0
      ? "- _no vault SourceNotes matched citations from this sweep_"
      : args.linked.map((n) => `- [[${wikilinkBasename(n.vault_path)}]]`).join("\n");
  return [
    `# Perplexity: ${args.briefTopic} — ${args.query}`,
    "",
    args.answer.trim(),
    "",
    "## Citations",
    "",
    citeBlock,
    "",
    "## Linked vault sources",
    "",
    linkBlock,
    "",
  ].join("\n");
}

async function filePerplexityAnswers(
  vaultRoot: string,
  brief: ResearchBrief,
  acquisitionNotes: CreatedNote[],
  slot: PerplexitySlot,
  surface: string,
  dateYmd: string,
): Promise<{ created: CreatedNote[]; skipped: SkippedNote[] }> {
  const created: CreatedNote[] = [];
  const skipped: SkippedNote[] = [];
  const tagBase = [brief.topic, "perplexity-answer", "research-sweep", ...(brief.tags ?? [])];

  for (const query of brief.queries) {
    let pr: PerplexityResult;
    try {
      pr = await slot.search(query);
    } catch {
      skipped.push({ source_uri: perplexityAnswerSourceUri(query), reason: "fetch_error" });
      continue;
    }
    const answer = pr.answer?.trim() ?? "";
    if (answer.length === 0) continue;

    const linked = matchLinkedAcquisitionNotes(acquisitionNotes, pr.citations ?? []);
    const ingest_as = linked.length >= 2 ? ("SynthesisNote" as const) : ("InsightNote" as const);
    const body = renderPerplexityAnswerBody({
      briefTopic: brief.topic,
      query,
      answer: pr.answer,
      citations: pr.citations ?? [],
      linked,
    });
    const prov = perplexityAnswerSourceUri(query);
    const title_hint = `Perplexity: ${brief.topic.slice(0, 80)} — ${query.slice(0, 80)} (${dateYmd})`;

    const result = await runIngestPipeline(
      vaultRoot,
      {
        input: body,
        source_type: "text",
        provenance_uri: prov,
        title_hint,
        ingest_as,
        tags: [...tagBase, query],
        ai_summary: answer.slice(0, 500),
        confidence_score: 0.55,
      },
      { surface },
    );

    if (result.status === "ok") {
      created.push({
        vault_path: result.vault_path,
        pake_id: result.pake_id,
        source_uri: prov,
        source: "perplexity",
      });
    } else {
      const source_uri =
        result.status === "duplicate" ? result.source_uri : perplexityAnswerSourceUri(query);
      skipped.push({ source_uri, reason: classifyIngestSkip(result) });
    }
  }

  return { created, skipped };
}

export async function runResearchAgent(
  vaultRoot: string,
  brief: ResearchBrief,
  opts: ResearchAgentOptions = {},
): Promise<ResearchSweepResult> {
  const parsed = researchBriefSchema.parse(brief);
  const surface = opts.surface ?? "research-agent";
  const profile = profileForDepth(parsed.depth);

  const firecrawl = opts.adapters?.firecrawl;
  const apify = opts.adapters?.apify;
  const perplexity = opts.adapters?.perplexity ?? createPerplexitySlot();

  const firecrawlPromise = firecrawl
    ? firecrawlSweep(vaultRoot, parsed, firecrawl, { surface, profile })
    : Promise.resolve({ created: [], skipped: [] });

  const apifyPromise = apify
    ? apifySweep(vaultRoot, parsed, apify, { surface, profile })
    : Promise.resolve({ created: [], skipped: [] });

  const [firecrawlOut, apifyOut] = await Promise.all([firecrawlPromise, apifyPromise]);

  let notes_created = [...firecrawlOut.created, ...apifyOut.created];
  const notes_skipped = [...firecrawlOut.skipped, ...apifyOut.skipped];
  const perplexity_skipped = await perplexityProbe(perplexity, parsed);

  const sweep_timestamp = new Date().toISOString();
  const dateYmd = sweep_timestamp.slice(0, 10);

  let perplexity_answers_filed = 0;
  if (!perplexity_skipped) {
    const filed = await filePerplexityAnswers(
      vaultRoot,
      parsed,
      notes_created,
      perplexity,
      surface,
      dateYmd,
    );
    notes_created = [...notes_created, ...filed.created];
    notes_skipped.push(...filed.skipped);
    perplexity_answers_filed = filed.created.length;
  }

  await appendRecord(vaultRoot, {
    action: "research_sweep",
    tool: "research_agent",
    surface,
    targetPath: notes_created[0]?.vault_path ?? "no-notes-created",
    payloadInput: {
      topic: parsed.topic,
      query_count: parsed.queries.length,
      notes_created_count: notes_created.length,
      perplexity_skipped,
      perplexity_answers_filed,
    },
    isoUtc: sweep_timestamp,
  });

  return researchSweepResultSchema.parse({
    brief_topic: parsed.topic,
    notes_created,
    notes_skipped,
    perplexity_skipped,
    perplexity_answers_filed,
    sweep_timestamp,
  });
}
