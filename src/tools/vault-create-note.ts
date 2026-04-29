import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { link, mkdir, unlink, writeFile } from "node:fs/promises";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import { normalizeVaultRelativePosix } from "../pake/path-rules.js";
import type { PakeType } from "../pake/schemas.js";
import { validatePakeForVaultPath } from "../pake/validate.js";
import { appendRecord } from "../audit/audit-logger.js";
import { assertVaultWriteContentNoSecretPatterns } from "../secrets/scan.js";
import {
  assertWriteAllowed,
  resolveWriteTargetCanonical,
  vaultRelativePosix,
} from "../write-gate.js";

/** Alias for MCP create input; equals {@link PakeType}. */
export type VaultCreatePakeType = PakeType;

export type VaultCreateNoteInput = {
  title: string;
  content: string;
  pake_type: VaultCreatePakeType;
  tags: string[];
  confidence_score?: number;
  source_uri?: string;
  /** WorkflowNote: explicit project folder under 01-Projects/ */
  project?: string;
  /** WorkflowNote: area folder under 02-Areas/ when project is absent */
  area?: string;
  /** Optional AI summary (PAKE optional field). */
  ai_summary?: string | undefined;
};

/** MCP / host surface identifier for audit lines; default `unknown`. */
export type VaultCreateNoteOptions = {
  surface?: string | undefined;
  /** When true, skip append-only audit line (caller logs a higher-level action, e.g. ingest). */
  suppressAudit?: boolean | undefined;
};

function normalizeAbsolute(p: string): string {
  return path.normalize(path.resolve(p));
}

/**
 * Mutation pipeline order (Story 4-4 AC1 — tests fail if reordered):
 * 1. WriteGate — assertWriteAllowed(..., operation: "create") before YAML or PAKE.
 * 2. PAKE — parseNoteFrontmatter, then validatePakeForVaultPath before secret scan.
 * 3. Secret scan — assertVaultWriteContentNoSecretPatterns on the full note string.
 * Then atomic exclusive create: temp file in the target directory, `link(2)` to the final name
 * (fails with EEXIST if the target already exists, avoiding rename clobber), then unlink the temp name.
 */
export async function vaultCreateNoteFromMarkdown(
  vaultRoot: string,
  vaultRelativePath: string,
  fullMarkdown: string,
  options: VaultCreateNoteOptions = {},
): Promise<{ pake_id: string; file_path: string; created_at: string }> {
  const surface = options.surface ?? "unknown";
  const normalizedRel = normalizeVaultRelativePosix(vaultRelativePath);
  const resolvedAbs = resolveVaultPath(vaultRoot, normalizedRel);

  assertWriteAllowed(vaultRoot, resolvedAbs, { operation: "create" });

  const realRoot = fs.realpathSync(normalizeAbsolute(path.resolve(vaultRoot)));
  const canonicalTarget = resolveWriteTargetCanonical(realRoot, resolvedAbs);
  const posixRel = vaultRelativePosix(realRoot, canonicalTarget);

  const { frontmatter } = parseNoteFrontmatter(fullMarkdown);
  validatePakeForVaultPath(posixRel, frontmatter);
  await assertVaultWriteContentNoSecretPatterns(vaultRoot, fullMarkdown);

  const dir = path.dirname(canonicalTarget);
  const tmpPath = path.join(dir, `.${randomUUID()}.vault-create.tmp`);
  const createdAt = new Date().toISOString();

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmpPath, fullMarkdown, "utf8");
    // Default behavior is "overwrite on EEXIST" (unit-tested). In the ingest pipeline,
    // callers pass `suppressAudit: true`; in that mode we preserve conflict semantics
    // so duplicate ingests return `{ status: "conflict" }` instead of silently
    // replacing existing content.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await link(tmpPath, canonicalTarget);
        break;
      } catch (linkErr: unknown) {
        const le = linkErr as NodeJS.ErrnoException;

        const shouldOverwrite =
          le.code === "EEXIST" && attempt === 0 && options.suppressAudit !== true;
        if (shouldOverwrite) {
          await unlink(canonicalTarget).catch(() => {});
          continue;
        }

        await unlink(tmpPath).catch(() => {});
        if (linkErr instanceof CnsError) throw linkErr;

        if (le.code === "EEXIST") {
          throw new CnsError("IO_ERROR", "Note already exists at target path.", {
            path: posixRel,
          });
        }

        throw new CnsError("IO_ERROR", "Failed to create note file.", {
          path: posixRel,
          errno: le.code,
        });
      }
    }
    await unlink(tmpPath);

    if (!options.suppressAudit) {
      const pakeType = frontmatter.pake_type;
      const titleVal = frontmatter.title;
      await appendRecord(vaultRoot, {
        action: "create",
        tool: "vault_create_note",
        surface,
        targetPath: posixRel,
        payloadInput: {
          pake_type: typeof pakeType === "string" ? pakeType : String(pakeType),
          title: typeof titleVal === "string" ? titleVal : String(titleVal),
        },
      });
    }
  } catch (e: unknown) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    throw new CnsError("IO_ERROR", "Failed to create note file.", {
      path: posixRel,
      errno: err.code,
    });
  }

  const pid = frontmatter.pake_id;
  if (typeof pid !== "string") {
    throw new CnsError("IO_ERROR", "Created note missing pake_id in frontmatter.", { path: posixRel });
  }

  return { pake_id: pid, file_path: posixRel, created_at: createdAt };
}

const segmentRe = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function assertValidContextSegment(value: string, field: string): void {
  if (!segmentRe.test(value)) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `${field} must be a single path segment (letters, digits, ., _, -).`,
      { issues: [{ path: field, message: "invalid segment", code: "custom" }] },
    );
  }
}

/** Destination directory (vault-relative, no trailing slash) for PAKE routing. */
export function destinationDirectoryForCreate(input: VaultCreateNoteInput): string {
  const { pake_type, project, area } = input;

  switch (pake_type) {
    case "SourceNote":
    case "InsightNote":
    case "HookSetNote":
    case "WeaponsCheckNote":
    case "SynthesisNote":
    case "ValidationNote":
      return "03-Resources";
    case "WorkflowNote": {
      if (project !== undefined && project.length > 0) {
        assertValidContextSegment(project, "project");
        return `01-Projects/${project}`;
      }
      if (area !== undefined && area.length > 0) {
        assertValidContextSegment(area, "area");
        return `02-Areas/${area}`;
      }
      return "02-Areas";
    }
  }
}

export function slugFilenameFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stem = (base.length > 0 ? base : "note").slice(0, 120);
  return `${stem}.md`;
}

function yamlScalarString(s: string): string {
  return JSON.stringify(s);
}

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildVaultCreateNoteMarkdown(input: VaultCreateNoteInput): {
  markdown: string;
  pake_id: string;
} {
  const pake_id = randomUUID();
  const ymd = todayUtcYmd();
  const confidence = input.confidence_score ?? 0.5;

  const lines: string[] = [
    "---",
    `pake_id: ${pake_id}`,
    `pake_type: ${input.pake_type}`,
    `title: ${yamlScalarString(input.title)}`,
    `created: ${yamlScalarString(ymd)}`,
    `modified: ${yamlScalarString(ymd)}`,
    "status: draft",
    `confidence_score: ${confidence}`,
    "verification_status: pending",
    "creation_method: ai",
  ];
  if (input.tags.length === 0) {
    lines.push("tags: []");
  } else {
    lines.push("tags:");
    for (const t of input.tags) {
      lines.push(`  - ${yamlScalarString(t)}`);
    }
  }
  if (input.source_uri !== undefined) {
    lines.push(`source_uri: ${yamlScalarString(input.source_uri)}`);
  }
  if (input.ai_summary !== undefined) {
    lines.push(`ai_summary: ${yamlScalarString(input.ai_summary)}`);
  }
  lines.push("---", "", input.content);
  let markdown = lines.join("\n");
  if (!markdown.endsWith("\n")) {
    markdown += "\n";
  }
  return { markdown, pake_id };
}

/**
 * High-level create: routing, PAKE body, then shared pipeline (WriteGate → PAKE → secrets → atomic write).
 */
export async function vaultCreateNote(
  vaultRoot: string,
  input: VaultCreateNoteInput,
  options: VaultCreateNoteOptions = {},
): Promise<{ pake_id: string; file_path: string; created_at: string }> {
  const dir = destinationDirectoryForCreate(input);
  const fileName = slugFilenameFromTitle(input.title);
  const vaultRelativePath = `${dir}/${fileName}`;
  const { markdown } = buildVaultCreateNoteMarkdown(input);
  return vaultCreateNoteFromMarkdown(vaultRoot, vaultRelativePath, markdown, options);
}
