import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { link, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import { z } from "zod";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import { validatePakeForVaultPath } from "../pake/validate.js";
import { appendRecord } from "../audit/audit-logger.js";
import { assertVaultWriteContentNoSecretPatterns } from "../secrets/scan.js";
import {
  assertWriteAllowed,
  resolveWriteTargetCanonical,
  vaultRelativePosix,
} from "../write-gate.js";

function normalizeAbsolute(p: string): string {
  return path.normalize(path.resolve(p));
}

/** Same as `vault-update-frontmatter.ts` (Story 4-6 AC1 — fake timers must pin the same instant). */
export function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export const vaultAppendDailyInputSchema = z
  .object({
    content: z.string().refine((s) => s.trim().length > 0, {
      message: "content must contain at least one non-whitespace character",
    }),
    section: z.string().optional(),
  })
  .strict();

export type VaultAppendDailyInput = z.infer<typeof vaultAppendDailyInputSchema>;

export type VaultAppendDailyOptions = {
  surface?: string | undefined;
};

function yamlScalarString(s: string): string {
  return JSON.stringify(s);
}

/** Level-2 heading line used for matching and for created sections (Story 4-6 AC2). */
export function normalizeDailySectionHeading(section: string): string {
  const t = section.trim();
  if (t.startsWith("#")) return t;
  return `## ${t}`;
}

/**
 * Insert trimmed `content` into markdown `body` (Story 4-6 AC2).
 * - No section: append `\n\n` + content + trailing newline at end of body.
 * - Section: find first line equal to normalized heading (trimmed); insert before next `/^##\s+/` line or at end; if missing, append section + content.
 */
export function appendContentToDailyBody(body: string, content: string, section: string | undefined): string {
  const trimmed = content.trim();
  const norm =
    section === undefined || section.trim().length === 0 ? undefined : normalizeDailySectionHeading(section);

  if (norm === undefined) {
    const b = body.replace(/\s*$/, "");
    return `${b}\n\n${trimmed}\n`;
  }

  const lines = body.split("\n");
  const idx = lines.findIndex((l) => l.trim() === norm.trim());
  if (idx === -1) {
    const b = body.replace(/\s*$/, "");
    return `${b}\n\n${norm}\n\n${trimmed}\n`;
  }

  let j = idx + 1;
  while (j < lines.length && !/^##\s/.test(lines[j])) {
    j += 1;
  }
  const before = lines.slice(0, j).join("\n");
  const after = lines.slice(j).join("\n");
  const insertion = `\n\n${trimmed}\n`;
  return after.length > 0 ? `${before}${insertion}${after}` : `${before}${insertion}`;
}

function buildBootstrapDailyMarkdown(ymd: string): string {
  const pake_id = randomUUID();
  const lines: string[] = [
    "---",
    `pake_id: ${pake_id}`,
    "pake_type: WorkflowNote",
    `title: ${yamlScalarString(`Daily Note ${ymd}`)}`,
    `created: ${yamlScalarString(ymd)}`,
    `modified: ${yamlScalarString(ymd)}`,
    "status: in-progress",
    "confidence_score: 0.5",
    "verification_status: pending",
    "creation_method: ai",
    "tags:",
    "  - daily",
    "---",
    "",
    `# ${ymd}`,
    "",
    "## Log",
    "",
    "",
    "## Agent Log",
    "",
    "",
    "## Reflections",
    "",
    "",
  ];
  let markdown = lines.join("\n");
  if (!markdown.endsWith("\n")) {
    markdown += "\n";
  }
  return markdown;
}

/**
 * Existing daily file (Story 4-6 AC2) — order must match:
 * 1. WriteGate overwrite before read
 * 2. Read + parse (IO_ERROR / NOT_FOUND)
 * 3. Body edit + bump `modified` (UTC YYYY-MM-DD)
 * 4. PAKE on post-edit frontmatter
 * 5. Secret scan on full serialized note
 * 6. Atomic temp + rename in DailyNotes/
 */
async function appendToExistingDaily(
  vaultRoot: string,
  resolvedAbs: string,
  canonicalTarget: string,
  posixRel: string,
  input: VaultAppendDailyInput,
  appendedAt: string,
  options: VaultAppendDailyOptions,
): Promise<{ path: string; appended_at: string }> {
  const surface = options.surface ?? "unknown";
  assertWriteAllowed(vaultRoot, resolvedAbs, { operation: "overwrite" });

  let raw: string;
  try {
    raw = await readFile(canonicalTarget, "utf8");
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No file at vault path: ${posixRel}`, { path: posixRel });
    }
    if (code === "EISDIR") {
      throw new CnsError("IO_ERROR", `Path is a directory, not a file: ${posixRel}`, { path: posixRel });
    }
    throw new CnsError("IO_ERROR", `Failed to read file: ${posixRel}`, { path: posixRel });
  }

  const { frontmatter, body } = parseNoteFrontmatter(raw);
  const nextBody = appendContentToDailyBody(body, input.content, input.section);
  const merged: Record<string, unknown> = { ...frontmatter, modified: todayUtcYmd() };

  validatePakeForVaultPath(posixRel, merged);

  const fullNoteString = matter.stringify(nextBody, merged);
  await assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString);

  const dir = path.dirname(canonicalTarget);
  const tmpPath = path.join(dir, `.${randomUUID()}.vault-append-daily.tmp`);

  try {
    await writeFile(tmpPath, fullNoteString, "utf8");
    await rename(tmpPath, canonicalTarget);

    const payloadInput: { section?: string } = {};
    if (input.section !== undefined && input.section.trim().length > 0) {
      payloadInput.section = input.section;
    }
    await appendRecord(vaultRoot, {
      action: "append_daily",
      tool: "vault_append_daily",
      surface,
      targetPath: posixRel,
      payloadInput,
    });
  } catch (e: unknown) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    throw new CnsError("IO_ERROR", "Failed to append to daily note.", {
      path: posixRel,
      errno: err.code,
    });
  }

  return { path: posixRel, appended_at: appendedAt };
}

/**
 * Missing daily file (Story 4-6 AC3): WriteGate create → mkdir → bootstrap → append on body →
 * PAKE → secrets → exclusive `link` create; on EEXIST, unlink temp and run existing-file branch once.
 */
async function appendCreateDailyThenMaybeRetryExisting(
  vaultRoot: string,
  resolvedAbs: string,
  canonicalTarget: string,
  posixRel: string,
  ymd: string,
  input: VaultAppendDailyInput,
  appendedAt: string,
  options: VaultAppendDailyOptions,
): Promise<{ path: string; appended_at: string }> {
  const surface = options.surface ?? "unknown";
  assertWriteAllowed(vaultRoot, resolvedAbs, { operation: "create" });

  const bootstrapRaw = buildBootstrapDailyMarkdown(ymd);
  const { frontmatter, body } = parseNoteFrontmatter(bootstrapRaw);
  const nextBody = appendContentToDailyBody(body, input.content, input.section);
  const merged: Record<string, unknown> = { ...frontmatter, modified: ymd };

  validatePakeForVaultPath(posixRel, merged);

  const fullNoteString = matter.stringify(nextBody, merged);
  await assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString);

  const dir = path.dirname(canonicalTarget);
  const tmpPath = path.join(dir, `.${randomUUID()}.vault-append-daily.tmp`);

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmpPath, fullNoteString, "utf8");
    try {
      await link(tmpPath, canonicalTarget);
    } catch (linkErr: unknown) {
      await unlink(tmpPath).catch(() => {});
      if (linkErr instanceof CnsError) throw linkErr;
      const le = linkErr as NodeJS.ErrnoException;
      if (le.code === "EEXIST") {
        return appendToExistingDaily(
          vaultRoot,
          resolvedAbs,
          canonicalTarget,
          posixRel,
          input,
          appendedAt,
          options,
        );
      }
      throw new CnsError("IO_ERROR", "Failed to create daily note file.", {
        path: posixRel,
        errno: le.code,
      });
    }
    await unlink(tmpPath);

    const payloadInput: { section?: string } = {};
    if (input.section !== undefined && input.section.trim().length > 0) {
      payloadInput.section = input.section;
    }
    await appendRecord(vaultRoot, {
      action: "append_daily",
      tool: "vault_append_daily",
      surface,
      targetPath: posixRel,
      payloadInput,
    });
  } catch (e: unknown) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    throw new CnsError("IO_ERROR", "Failed to create daily note file.", {
      path: posixRel,
      errno: err.code,
    });
  }

  return { path: posixRel, appended_at: appendedAt };
}

export async function vaultAppendDaily(
  vaultRoot: string,
  input: VaultAppendDailyInput,
  options: VaultAppendDailyOptions = {},
): Promise<{ path: string; appended_at: string }> {
  const ymd = todayUtcYmd();
  const dailyRel = `DailyNotes/${ymd}.md`;
  const resolvedAbs = resolveVaultPath(vaultRoot, dailyRel);

  const realRoot = fs.realpathSync(normalizeAbsolute(path.resolve(vaultRoot)));
  const canonicalTarget = resolveWriteTargetCanonical(realRoot, resolvedAbs);
  const posixRel = vaultRelativePosix(realRoot, canonicalTarget);

  const appendedAt = new Date().toISOString();

  let exists = false;
  try {
    const st = await stat(canonicalTarget);
    if (st.isDirectory()) {
      throw new CnsError("IO_ERROR", `Path is a directory, not a file: ${posixRel}`, { path: posixRel });
    }
    exists = true;
  } catch (e: unknown) {
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw new CnsError("IO_ERROR", `Failed to stat daily path: ${posixRel}`, { path: posixRel });
    }
  }

  if (exists) {
    return appendToExistingDaily(
      vaultRoot,
      resolvedAbs,
      canonicalTarget,
      posixRel,
      input,
      appendedAt,
      options,
    );
  }
  return appendCreateDailyThenMaybeRetryExisting(
    vaultRoot,
    resolvedAbs,
    canonicalTarget,
    posixRel,
    ymd,
    input,
    appendedAt,
    options,
  );
}
