import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { CnsError } from "../errors.js";
import { appendRecord } from "../audit/audit-logger.js";
import { resolveVaultPath } from "../paths.js";
import { assertWriteAllowed } from "../write-gate.js";
import { vaultCreateNote } from "../tools/vault-create-note.js";
import { classifySource, resolvePakeType } from "./classify.js";
import { governedNoteExistsWithSourceUri } from "./duplicate.js";
import { normalizeInput } from "./normalize.js";
import { appendIndexRow } from "./index-update.js";
import type { IngestOptions, SourceType } from "./classify.js";

export type IngestInput = {
  /**
   * The raw input: a URL string, an absolute path to a PDF, or raw text content.
   * The pipeline classifies the source type automatically unless `source_type` is provided.
   */
  input: string;
  /** Override source type classification. */
  source_type?: SourceType | undefined;
  /**
   * Pre-fetched content string for URL and PDF sources.
   * When provided, the pipeline skips file reads.
   * Required for URL sources in test contexts (no live HTTP calls in the pipeline itself).
   */
  fetched_content?: string | undefined;
  /** Hint title (used when body has no heading). */
  title_hint?: string | undefined;
} & IngestOptions;

export type IngestResult =
  | { status: "ok"; pake_id: string; vault_path: string; inbox_path: string }
  | { status: "duplicate"; source_uri: string }
  | { status: "conflict"; error: string; inbox_path: string }
  | { status: "validation_error"; error: string; inbox_path: string };

/** Vault-relative path for the inbox staging area. */
const INBOX_DIR = "00-Inbox";

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base.length > 0 ? base : "note").slice(0, 100);
}

/**
 * Write a temporary inbox draft (no PAKE validation — 00-Inbox is exempt).
 * Returns the vault-relative path.
 */
async function writeInboxDraft(
  vaultRoot: string,
  title: string,
  body: string,
  source_uri: string | undefined,
): Promise<string> {
  const id = randomUUID().slice(0, 8);
  const slug = slugify(title);
  const filename = `${slug}-${id}.md`;
  const inboxRel = `${INBOX_DIR}/${filename}`;
  const absPath = resolveVaultPath(vaultRoot, inboxRel);
  await mkdir(path.dirname(absPath), { recursive: true });
  assertWriteAllowed(vaultRoot, absPath, { operation: "create" });

  const lines = ["---", `title: ${JSON.stringify(title)}`, "status: inbox"];
  if (source_uri) lines.push(`source_uri: ${JSON.stringify(source_uri)}`);
  lines.push("---", "", body);
  const content = lines.join("\n") + "\n";
  await writeFile(absPath, content, "utf8");
  return inboxRel;
}

/** Remove inbox draft after successful promotion. */
async function removeInboxDraft(vaultRoot: string, inboxRel: string): Promise<void> {
  const absPath = resolveVaultPath(vaultRoot, inboxRel);
  try {
    await unlink(absPath);
  } catch {
    /* best-effort; leave orphan for human triage if removal fails */
  }
}

/**
 * Run the ingest pipeline for a single input.
 *
 * Stages (per spec Section 4):
 * 1. Intent — classify source type, resolve PAKE type
 * 2. Normalize — strip chrome, attach provenance
 * 3. PAKE gate — validate via vaultCreateNote (WriteGate + PAKE + secrets)
 * 4. Write — governed vault note
 * 5. Index — append to master ingest index
 * 6. Audit — append audit line
 */
export async function runIngestPipeline(
  vaultRoot: string,
  input: IngestInput,
  opts: { surface?: string } = {},
): Promise<IngestResult> {
  const surface = opts.surface ?? "ingest-pipeline";

  // Stage 1 — Intent
  const sourceType = input.source_type ?? classifySource(input.input);
  const pakeType = resolvePakeType(sourceType, input);

  // Stage 2 — Normalize
  const normalized = await normalizeInput(
    sourceType,
    input.input,
    input.fetched_content,
    input.title_hint,
  );

  if (normalized.source_uri !== undefined && normalized.source_uri.length > 0) {
    const dup = await governedNoteExistsWithSourceUri(vaultRoot, normalized.source_uri);
    if (dup) {
      return { status: "duplicate", source_uri: normalized.source_uri };
    }
  }

  const tags = ["ingest", ...(input.tags ?? [])];
  const today = todayUtcYmd();

  // Write inbox draft (no PAKE validation — 00-Inbox exempt)
  let inboxPath: string;
  try {
    inboxPath = await writeInboxDraft(vaultRoot, normalized.title, normalized.body, normalized.source_uri);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CnsError("IO_ERROR", `Failed to write inbox draft: ${msg}`);
  }

  // Stage 3/4 — PAKE gate + governed write
  let pake_id: string;
  let vault_path: string;
  try {
    const result = await vaultCreateNote(
      vaultRoot,
      {
        title: normalized.title,
        content: normalized.body,
        pake_type: pakeType,
        tags,
        confidence_score: input.confidence_score ?? 0.5,
        source_uri: normalized.source_uri,
        ai_summary: input.ai_summary,
      },
      { surface, suppressAudit: true },
    );
    pake_id = result.pake_id;
    vault_path = result.file_path;
  } catch (err) {
    const msg = err instanceof CnsError ? err.message : String(err);
    if (
      err instanceof CnsError &&
      err.code === "IO_ERROR" &&
      msg.includes("already exists at target path")
    ) {
      return { status: "conflict", error: msg, inbox_path: inboxPath };
    }
    return { status: "validation_error", error: msg, inbox_path: inboxPath };
  }

  // Remove inbox draft after successful promotion
  await removeInboxDraft(vaultRoot, inboxPath);

  // Stage 5 — Index
  await appendIndexRow(vaultRoot, {
    date: today,
    pake_id,
    pake_type: pakeType,
    title: normalized.title,
    source_uri: normalized.source_uri ?? "",
    vault_path,
  });

  // Stage 6 — Audit
  await appendRecord(vaultRoot, {
    action: "ingest",
    tool: "ingest_pipeline",
    surface,
    targetPath: vault_path,
    payloadInput: {
      pake_type: pakeType,
      source_type: sourceType,
      source_uri: normalized.source_uri,
      title: normalized.title,
    },
  });

  return { status: "ok", pake_id, vault_path, inbox_path: inboxPath };
}
