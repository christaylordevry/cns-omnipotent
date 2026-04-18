import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CnsError } from "../errors.js";
import type { SourceType } from "./classify.js";
import { stripQueryAndFragment } from "./classify.js";

export type NormalizedContent = {
  title: string;
  body: string;
  /** Preserved for PAKE `source_uri` field (URL sources only). */
  source_uri?: string | undefined;
};

/** Derive a title from the first `# heading` or first non-empty line, or fall back to a default. */
export function deriveTitle(text: string, fallback: string): string {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.slice(2).trim();
    if (trimmed.length > 0 && !trimmed.startsWith("#")) return trimmed.slice(0, 120);
  }
  return fallback;
}

/** Strip leading/trailing blank lines and normalize to LF. */
function cleanBody(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/** Normalize URL input: treat the caller-supplied content string as pre-fetched page text. */
export function normalizeUrl(url: string, fetchedContent: string): NormalizedContent {
  let canonical = url.trim();
  if (/^www\./i.test(canonical)) canonical = `https://${canonical}`;
  const body = cleanBody(fetchedContent);
  const title = deriveTitle(body, canonical);
  return { title, body, source_uri: canonical };
}

/** Normalize PDF: read the file, treat as raw text (no PDF parsing in Phase 4). */
export async function normalizePdf(filePath: string, rawText?: string): Promise<NormalizedContent> {
  const resolvedFsPath = filePath.startsWith("file:") ? fileURLToPath(filePath) : filePath;
  const text = rawText !== undefined ? rawText : await readFile(resolvedFsPath, "utf8");
  const body = cleanBody(text);
  const baseName = stripQueryAndFragment(resolvedFsPath.replace(/\\/g, "/")).split("/").pop() ?? "pdf-import";
  const title = deriveTitle(body, baseName);
  const posixPath = resolvedFsPath.replace(/\\/g, "/");
  return { title, body, source_uri: `file://${posixPath}` };
}

/** Normalize raw text input. */
export function normalizeText(text: string, titleHint?: string): NormalizedContent {
  const body = cleanBody(text);
  const title = titleHint ?? deriveTitle(body, "Untitled Note");
  return { title, body };
}

/** Dispatch normalization by source type. `content` is the raw input (URL string, PDF path, or text body). */
export async function normalizeInput(
  sourceType: SourceType,
  input: string,
  fetchedContent?: string,
  titleHint?: string,
): Promise<NormalizedContent> {
  switch (sourceType) {
    case "url": {
      if (fetchedContent === undefined || String(fetchedContent).trim() === "") {
        throw new CnsError(
          "UNSUPPORTED",
          "URL ingest requires fetched_content (pre-fetched page text).",
        );
      }
      return normalizeUrl(input, fetchedContent);
    }
    case "pdf":
      return normalizePdf(input, fetchedContent);
    case "text":
      return normalizeText(input, titleHint);
  }
}
