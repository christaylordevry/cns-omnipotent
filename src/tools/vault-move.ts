/**
 * vault_move — Story 4-7
 *
 * Ordering (AC1, enforced before any mutation):
 * 1. Normalize vault-relative source_path / destination_path (`normalizeVaultRelativePosix`).
 * 2. Lexical resolve under vault (`resolveVaultPath`); reject same path.
 * 3. Stat source: must be a regular file; missing → NOT_FOUND; directory → IO_ERROR.
 * 4. Canonical source via `resolveWriteTargetCanonical`; `vaultRelativePosix`; `assertWriteAllowed(..., operation: "rename")`.
 * 5. Canonical destination (path may not exist yet); `assertWriteAllowed(..., operation: "create")`.
 * 6. Destination parent must exist as a directory → else IO_ERROR (no implicit mkdir for disallowed trees).
 * 7. Destination must not exist → else IO_ERROR.
 * 8. Read source bytes; build the post-move note (`modified` bumped), then run PAKE + secret scan
 *    against destination path before any rename/move (hard block on invalid content).
 *
 * Move execution:
 * - If `obsidianCliPath` is set and the binary is reachable, try Obsidian CLI first (see `tryObsidianCliMove`).
 * - Otherwise or on CLI failure: single `fs.promises.rename` from canonical source to canonical destination (AC3).
 *   EEXIST → IO_ERROR; EXDEV → IO_ERROR (no copy-delete fallback).
 *
 * Post-move (implementation-owned content):
 * - Atomically write prevalidated content with bumped `modified` (AC4).
 * - Wikilink repair across `.md` files: each touched file → WriteGate overwrite, PAKE + secret scan, atomic write (AC5).
 * - Append one audit line to `_meta/logs/agent-log.md` with `audit-append` / `append` (AC6).
 *
 * Obsidian CLI invocation (verified against help.obsidian.md CLI reference, Files and folders → move):
 *   `obsidian move path=<source_vault_rel> to=<dest_vault_rel> silent`
 * Parameters use `path=` (exact vault-relative path) and `to=` (destination vault-relative path).
 */

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { parseNoteFrontmatter } from "../pake/parse-frontmatter.js";
import { normalizeVaultRelativePosix } from "../pake/path-rules.js";
import { validatePakeForVaultPath } from "../pake/validate.js";
import { assertVaultWriteContentNoSecretPatterns } from "../secrets/scan.js";
import { appendRecord } from "../audit/audit-logger.js";
import { assertWriteAllowed, resolveWriteTargetCanonical, vaultRelativePosix } from "../write-gate.js";
import { rewriteWikilinksForMove, wikilinkRewriteChanged } from "./wikilink-repair.js";

function normalizeAbsolute(p: string): string {
  return path.normalize(path.resolve(p));
}

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export type VaultMoveOptions = {
  /** MCP / host surface identifier; default `unknown`. */
  surface?: string | undefined;
  /** Absolute path to Obsidian CLI; overrides env when passed from config. */
  obsidianCliPath?: string | undefined;
};

function tryObsidianCliMove(cliPath: string, sourcePosix: string, destPosix: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      fs.accessSync(cliPath, fs.constants.F_OK);
    } catch {
      resolve(false);
      return;
    }
    const child = spawn(
      cliPath,
      ["move", `path=${sourcePosix}`, `to=${destPosix}`, "silent"],
      { stdio: "ignore" },
    );
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function writePreparedMovedNoteContent(
  vaultRoot: string,
  destCanonical: string,
  destPosix: string,
  fullNoteString: string,
): Promise<void> {
  assertWriteAllowed(vaultRoot, destCanonical, { operation: "overwrite" });

  const dir = path.dirname(destCanonical);
  const tmpPath = path.join(dir, `.${randomUUID()}.vault-move-mod.tmp`);
  try {
    await writeFile(tmpPath, fullNoteString, "utf8");
    await rename(tmpPath, destCanonical);
  } catch (e: unknown) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    throw new CnsError("IO_ERROR", "Failed to update modified timestamp after move.", {
      path: destPosix,
      errno: err.code,
    });
  }
}

/**
 * Build destination note bytes from source content and validate before move:
 * destination-PAKE + secret scan with bumped `modified`.
 */
async function buildValidatedMovedNoteContent(
  vaultRoot: string,
  sourceRaw: string,
  destPosix: string,
): Promise<string> {
  const { frontmatter, body } = parseNoteFrontmatter(sourceRaw);
  const merged: Record<string, unknown> = { ...frontmatter, modified: todayUtcYmd() };
  validatePakeForVaultPath(destPosix, merged);
  const fullNoteString = matter.stringify(body, merged);
  await assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString);
  return fullNoteString;
}

async function listMarkdownFilesRecursive(dirAbs: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dirAbs, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === ".git" || ent.name === "node_modules" || ent.name === ".obsidian") continue;
      out.push(...(await listMarkdownFilesRecursive(full)));
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * After rename, rewrite wikilinks in vault markdown files. Skips paths that fail WriteGate overwrite.
 * Ordering: move succeeded → this pass may write multiple files; failures are collected as warnings (AC5).
 */
async function repairWikilinksAcrossVault(
  vaultRoot: string,
  realRoot: string,
  oldPosix: string,
  newPosix: string,
  warnings: string[],
): Promise<number> {
  const rootAbs = normalizeAbsolute(path.resolve(vaultRoot));
  const allMd = await listMarkdownFilesRecursive(rootAbs);
  let updated = 0;

  for (const abs of allMd) {
    let canonical: string;
    try {
      canonical = resolveWriteTargetCanonical(realRoot, abs);
    } catch {
      let posixRel: string;
      try {
        posixRel = vaultRelativePosix(realRoot, normalizeAbsolute(abs));
      } catch {
        posixRel = abs;
      }
      warnings.push(`wikilink_skip_resolve:${posixRel}`);
      continue;
    }
    const posixRel = vaultRelativePosix(realRoot, canonical);

    try {
      assertWriteAllowed(vaultRoot, canonical, { operation: "overwrite" });
    } catch (e: unknown) {
      if (e instanceof CnsError && e.code === "PROTECTED_PATH") {
        warnings.push(`wikilink_skip_protected:${posixRel}`);
      }
      continue;
    }

    const raw = await readFile(canonical, "utf8");
    const next = rewriteWikilinksForMove(raw, oldPosix, newPosix);
    if (!wikilinkRewriteChanged(raw, next)) continue;

    const { frontmatter, body } = parseNoteFrontmatter(next);
    try {
      validatePakeForVaultPath(posixRel, frontmatter);
    } catch (e: unknown) {
      warnings.push(`wikilink_pake:${posixRel}:${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const fullNoteString = matter.stringify(body, frontmatter);
    try {
      await assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString);
    } catch (e: unknown) {
      warnings.push(`wikilink_secrets:${posixRel}:${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const dir = path.dirname(canonical);
    const tmpPath = path.join(dir, `.${randomUUID()}.vault-wikilink.tmp`);
    try {
      await writeFile(tmpPath, fullNoteString, "utf8");
      await rename(tmpPath, canonical);
      updated += 1;
    } catch (e: unknown) {
      try {
        await unlink(tmpPath);
      } catch {
        /* ignore */
      }
      warnings.push(`wikilink_io:${posixRel}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return updated;
}

export async function vaultMove(
  vaultRoot: string,
  source_path: string,
  destination_path: string,
  options: VaultMoveOptions = {},
): Promise<{
  old_path: string;
  new_path: string;
  backlinks_updated: number;
  /** True when at least one backlink file could not be fully repaired (see `wikilink_repair_warnings`). */
  partial_wikilink_repair: boolean;
  wikilink_repair_warnings?: string[];
}> {
  const surface = options.surface ?? "unknown";
  const cliPath = options.obsidianCliPath;

  const sourceRel = normalizeVaultRelativePosix(source_path);
  const destRel = normalizeVaultRelativePosix(destination_path);
  if (sourceRel === destRel) {
    throw new CnsError("IO_ERROR", "Source and destination are the same path.", { path: destRel });
  }

  const sourceAbs = resolveVaultPath(vaultRoot, sourceRel);
  const destAbs = resolveVaultPath(vaultRoot, destRel);
  const realRoot = fs.realpathSync(normalizeAbsolute(path.resolve(vaultRoot)));

  let sourceCanonical: string;
  try {
    const st = await stat(sourceAbs);
    if (st.isDirectory()) {
      throw new CnsError("IO_ERROR", "Source path is a directory, not a file.", { path: sourceRel });
    }
    if (!st.isFile()) {
      throw new CnsError("IO_ERROR", "Source is not a regular file.", { path: sourceRel });
    }
    sourceCanonical = resolveWriteTargetCanonical(realRoot, sourceAbs);
  } catch (e: unknown) {
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No file at vault path: ${sourceRel}`, { path: sourceRel });
    }
    throw new CnsError("IO_ERROR", `Failed to access source: ${sourceRel}`, { path: sourceRel });
  }

  const sourcePosix = vaultRelativePosix(realRoot, sourceCanonical);
  assertWriteAllowed(vaultRoot, sourceCanonical, { operation: "rename" });

  const destCanonical = resolveWriteTargetCanonical(realRoot, destAbs);
  const destPosix = vaultRelativePosix(realRoot, destCanonical);
  assertWriteAllowed(vaultRoot, destCanonical, { operation: "create" });

  const destParent = path.dirname(destCanonical);
  try {
    const pst = await stat(destParent);
    if (!pst.isDirectory()) {
      throw new CnsError("IO_ERROR", "Destination parent is not a directory.", { path: destRel });
    }
  } catch (e: unknown) {
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new CnsError("IO_ERROR", "Destination parent directory does not exist.", { path: destRel });
    }
    throw new CnsError("IO_ERROR", "Failed to stat destination parent.", { path: destRel });
  }

  try {
    await stat(destCanonical);
    throw new CnsError("IO_ERROR", "Destination file already exists.", { path: destPosix });
  } catch (e: unknown) {
    if (e instanceof CnsError) throw e;
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw new CnsError("IO_ERROR", "Failed to check destination.", { path: destPosix });
    }
  }

  let raw: string;
  try {
    raw = await readFile(sourceCanonical, "utf8");
  } catch {
    throw new CnsError("IO_ERROR", "Failed to read source file before move.", { path: sourcePosix });
  }
  const movedNoteString = await buildValidatedMovedNoteContent(vaultRoot, raw, destPosix);

  let usedCli = false;
  if (cliPath !== undefined && cliPath.length > 0) {
    usedCli = await tryObsidianCliMove(cliPath, sourcePosix, destPosix);
  }

  if (!usedCli) {
    try {
      await rename(sourceCanonical, destCanonical);
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "EEXIST") {
        throw new CnsError("IO_ERROR", "Destination file already exists.", { path: destPosix });
      }
      if (err.code === "EXDEV") {
        throw new CnsError(
          "IO_ERROR",
          "Cross-device move is not supported; source and destination must be on the same filesystem for atomic rename.",
          { path: destPosix, source_path: sourcePosix },
        );
      }
      throw new CnsError("IO_ERROR", "Failed to rename note to destination.", {
        path: destPosix,
        errno: err.code,
      });
    }
  } else {
    try {
      const dst = await stat(destCanonical);
      if (!dst.isFile()) {
        throw new CnsError("IO_ERROR", "Obsidian CLI did not leave a file at the destination.", {
          path: destPosix,
        });
      }
    } catch (e: unknown) {
      if (e instanceof CnsError) throw e;
      throw new CnsError("IO_ERROR", "Obsidian CLI reported success but destination file is missing.", {
        path: destPosix,
      });
    }

    let sourceStillPresent = false;
    try {
      await stat(sourceCanonical);
      sourceStillPresent = true;
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw new CnsError("IO_ERROR", "Failed to verify source removed after Obsidian CLI move.", {
          path: sourcePosix,
          errno: err.code,
        });
      }
    }
    if (sourceStillPresent) {
      throw new CnsError(
        "IO_ERROR",
        `Obsidian CLI reported success but source file still exists at ${sourcePosix}.`,
        { path: sourcePosix },
      );
    }
  }

  await writePreparedMovedNoteContent(vaultRoot, destCanonical, destPosix, movedNoteString);

  const warnings: string[] = [];
  const backlinks_updated = await repairWikilinksAcrossVault(
    vaultRoot,
    realRoot,
    sourcePosix,
    destPosix,
    warnings,
  );

  await appendRecord(vaultRoot, {
    action: "move",
    tool: "vault_move",
    surface,
    targetPath: destPosix,
    payloadInput: { source: sourcePosix, destination: destPosix },
  });

  const partial_wikilink_repair = warnings.length > 0;
  return {
    old_path: sourcePosix,
    new_path: destPosix,
    backlinks_updated,
    partial_wikilink_repair,
    ...(partial_wikilink_repair ? { wikilink_repair_warnings: warnings } : {}),
  };
}
