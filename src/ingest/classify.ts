import { fileURLToPath } from "node:url";
import type { PakeType } from "../pake/schemas.js";

/** Raw source types the pipeline accepts. */
export type SourceType = "url" | "pdf" | "text";

/** Strip `?query` and `#fragment` for extension checks. */
export function stripQueryAndFragment(s: string): string {
  let cut = s.length;
  const q = s.indexOf("?");
  const h = s.indexOf("#");
  if (q >= 0) cut = Math.min(cut, q);
  if (h >= 0) cut = Math.min(cut, h);
  return s.slice(0, cut);
}

/** Caller-supplied ingest options (pipeline stage 1 — Intent). */
export type IngestOptions = {
  /** Explicit `pake_type` override; defaults to SourceNote for url/pdf, SourceNote for text. */
  ingest_as?: Extract<PakeType, "SourceNote" | "InsightNote"> | undefined;
  /** Tags to attach (pipeline always appends "ingest"). */
  tags?: string[] | undefined;
  /** Pre-computed AI summary to store as `ai_summary`. */
  ai_summary?: string | undefined;
  /** Confidence score override (default 0.5). */
  confidence_score?: number | undefined;
};

/** Classify input string as url, pdf path, or raw text. */
export function classifySource(input: string): SourceType {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return "url";
  if (/^ftp:\/\//i.test(trimmed)) return "url";
  if (/^file:\/\//i.test(trimmed)) {
    try {
      const fp = fileURLToPath(trimmed);
      const base = stripQueryAndFragment(fp.replace(/\\/g, "/"));
      if (/\.pdf$/i.test(base)) return "pdf";
    } catch {
      /* treat as url */
    }
    return "url";
  }
  if (/^www\./i.test(trimmed)) return "url";
  const forPdf = stripQueryAndFragment(trimmed);
  if (/\.pdf$/i.test(forPdf)) return "pdf";
  return "text";
}

/** Resolve PAKE type from source type and options. */
export function resolvePakeType(
  sourceType: SourceType,
  opts: IngestOptions,
): Extract<PakeType, "SourceNote" | "InsightNote"> {
  if (opts.ingest_as !== undefined) return opts.ingest_as;
  // Default: SourceNote for all source types (raw capture semantics)
  return "SourceNote";
}
