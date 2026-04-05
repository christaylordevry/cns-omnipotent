import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import { normalizeVaultRelativePosix } from "../pake/path-rules.js";
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

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Keys rejected on merge to avoid prototype-pollution-style assignment. */
const DISALLOWED_FRONTMATTER_UPDATE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type VaultUpdateFrontmatterUpdates = Record<string, unknown>;

export type VaultUpdateFrontmatterOptions = {
  surface?: string | undefined;
};

/**
 * Mutation pipeline order (Story 4-5 AC1 — tests fail if reordered):
 * 1. WriteGate — assertWriteAllowed(..., operation: "overwrite") before reading file content for merge.
 * 2. Read — resolveVaultPath boundary + canonical target readFile; NOT_FOUND / IO_ERROR.
 * 3. Parse — parseNoteFrontmatter; YAML errors → IO_ERROR.
 * 4. Merge — shallow merge: each key in `updates` set on frontmatter; omitted keys preserved.
 * 5. Timestamps — set merged `modified` to today (YYYY-MM-DD); overrides caller `modified` in `updates`.
 * 6. PAKE — validatePakeForVaultPath(posixRel, mergedFrontmatter).
 * 7. Secret scan — assertVaultWriteContentNoSecretPatterns on full note string (new frontmatter + same body).
 * 8. Atomic write — temp file in target directory, rename over existing file.
 */
export async function vaultUpdateFrontmatter(
  vaultRoot: string,
  vaultRelativePath: string,
  updates: VaultUpdateFrontmatterUpdates,
  options: VaultUpdateFrontmatterOptions = {},
): Promise<{ path: string; updated_fields: string[]; modified_at: string }> {
  const surface = options.surface ?? "unknown";
  const normalizedRel = normalizeVaultRelativePosix(vaultRelativePath);
  const resolvedAbs = resolveVaultPath(vaultRoot, normalizedRel);

  assertWriteAllowed(vaultRoot, resolvedAbs, { operation: "overwrite" });

  const realRoot = fs.realpathSync(normalizeAbsolute(path.resolve(vaultRoot)));
  const canonicalTarget = resolveWriteTargetCanonical(realRoot, resolvedAbs);
  const posixRel = vaultRelativePosix(realRoot, canonicalTarget);

  let raw: string;
  try {
    raw = await readFile(canonicalTarget, "utf8");
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No file at vault path: ${normalizedRel}`, { path: posixRel });
    }
    if (code === "EISDIR") {
      throw new CnsError("IO_ERROR", `Path is a directory, not a file: ${normalizedRel}`, { path: posixRel });
    }
    throw new CnsError("IO_ERROR", `Failed to read file: ${normalizedRel}`, { path: posixRel });
  }

  const { frontmatter, body } = parseNoteFrontmatter(raw);

  const merged: Record<string, unknown> = { ...frontmatter };
  for (const key of Object.keys(updates)) {
    if (DISALLOWED_FRONTMATTER_UPDATE_KEYS.has(key)) {
      throw new CnsError("SCHEMA_INVALID", `Frontmatter update key "${key}" is not allowed.`, {
        issues: [{ path: key, message: "disallowed key", code: "custom" }],
      });
    }
    merged[key] = updates[key];
  }
  merged.modified = todayUtcYmd();

  validatePakeForVaultPath(posixRel, merged);

  const fullNoteString = matter.stringify(body, merged);
  await assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString);

  const modified_at = new Date().toISOString();
  const dir = path.dirname(canonicalTarget);
  const tmpPath = path.join(dir, `.${randomUUID()}.vault-update-fm.tmp`);

  const updated_fields = [...Object.keys(updates)];
  if (!updated_fields.includes("modified")) {
    updated_fields.push("modified");
  }

  try {
    await writeFile(tmpPath, fullNoteString, "utf8");
    await rename(tmpPath, canonicalTarget);

    await appendRecord(vaultRoot, {
      action: "update_frontmatter",
      tool: "vault_update_frontmatter",
      surface,
      targetPath: posixRel,
      payloadInput: { updated_fields },
    });
  } catch (e: unknown) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    throw new CnsError("IO_ERROR", "Failed to update note frontmatter.", {
      path: posixRel,
      errno: err.code,
    });
  }

  return {
    path: posixRel,
    updated_fields,
    modified_at,
  };
}
