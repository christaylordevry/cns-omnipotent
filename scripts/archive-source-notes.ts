/**
 * One-off operator tool: move vault markdown notes with pake_type: SourceNote
 * into `_archive/source-notes/`.
 *
 * Dry-run by default; pass --execute to perform moves.
 *
 * Usage:
 *   CNS_VAULT_ROOT="/path/to/vault" tsx scripts/archive-source-notes.ts
 *   CNS_VAULT_ROOT="/path/to/vault" tsx scripts/archive-source-notes.ts --execute
 */

import { mkdir, readFile, rename, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ARCHIVE_SUBDIR = path.join("_archive", "source-notes");

/** Basenames that must never be archived as SourceNote debris (operator-owned). */
const OPERATOR_FILE_WHITELIST = [
  "CNS-Operator-Guide.md",
  "Operator-Profile.md",
  "Vault-Intelligence-Discovery-Workflow.md",
  "notebooklm-project-map.md",
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): { execute: boolean } {
  let execute = false;
  const unknown: string[] = [];
  for (const a of argv) {
    if (a === "--execute") execute = true;
    else unknown.push(a);
  }
  if (unknown.length > 0) {
    fail(`Unknown arguments: ${unknown.join(", ")}`);
  }
  return { execute };
}

function isPathInsideVault(vaultResolved: string, fileResolved: string): boolean {
  const rel = path.relative(vaultResolved, fileResolved);
  return rel !== "" && !rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel);
}

function shouldSkipDirectory(name: string): boolean {
  return name === "_meta" || name === "AI-Context";
}

async function* walkMarkdownFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (shouldSkipDirectory(ent.name)) continue;
      yield* walkMarkdownFiles(full);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith(".md")) {
      yield full;
    }
  }
}

async function main(): Promise<void> {
  const vaultRootRaw = process.env.CNS_VAULT_ROOT;
  if (!vaultRootRaw || vaultRootRaw.trim() === "") {
    fail("CNS_VAULT_ROOT is not set or empty. Set it to the vault root path.");
  }

  const { execute } = parseArgs(process.argv.slice(2));

  const vaultResolved = path.resolve(vaultRootRaw);
  const archiveDirResolved = path.resolve(vaultResolved, ARCHIVE_SUBDIR);

  const candidates: string[] = [];

  for await (const absMd of walkMarkdownFiles(vaultResolved)) {
    const fileResolved = path.resolve(absMd);
    if (!isPathInsideVault(vaultResolved, fileResolved)) {
      fail(`Refusing to process path outside vault: ${fileResolved}`);
    }

    // Already in archive target — avoid duplicate / same-path rename.
    const archivePrefix = archiveDirResolved + path.sep;
    if (fileResolved === archiveDirResolved || fileResolved.startsWith(archivePrefix)) {
      continue;
    }

    let raw: string;
    try {
      raw = await readFile(fileResolved, "utf8");
    } catch (e) {
      console.warn(`Skip (unreadable): ${path.relative(vaultResolved, fileResolved)}`, e);
      continue;
    }

    let data: Record<string, unknown>;
    try {
      ({ data } = matter(raw));
    } catch (e) {
      console.warn(`Skip (frontmatter parse error): ${path.relative(vaultResolved, fileResolved)}`, e);
      continue;
    }

    if (data.pake_type !== "SourceNote") continue;

    const basename = path.basename(fileResolved);
    if (OPERATOR_FILE_WHITELIST.includes(basename)) {
      console.log(`SKIPPED (whitelisted operator file): ${path.relative(vaultResolved, fileResolved)}`);
      continue;
    }

    candidates.push(fileResolved);
  }

  const basenameCounts = new Map<string, number>();
  for (const src of candidates) {
    const base = path.basename(src);
    basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
  }
  const collisions = [...basenameCounts.entries()].filter(([, n]) => n > 1).map(([b]) => b);
  if (collisions.length > 0) {
    fail(
      `Filename collisions in archive target (multiple SourceNotes share basename): ${collisions.join(", ")}`,
    );
  }

  const moves: { src: string; dest: string }[] = [];
  for (const src of candidates) {
    const dest = path.join(archiveDirResolved, path.basename(src));
    moves.push({ src, dest });
    const destResolved = path.resolve(dest);
    if (!isPathInsideVault(vaultResolved, destResolved)) {
      fail(`Refusing to write outside vault: ${destResolved}`);
    }
    try {
      await readFile(destResolved);
      fail(`Archive destination already exists (would overwrite): ${path.relative(vaultResolved, destResolved)}`);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
      if (code !== "ENOENT") throw e;
    }
  }

  console.log(execute ? `Executing: moving ${moves.length} file(s) → ${ARCHIVE_SUBDIR}/` : `Dry-run: would move ${moves.length} file(s) → ${ARCHIVE_SUBDIR}/`);
  for (const { src, dest } of moves) {
    console.log(`  ${path.relative(vaultResolved, src)} → ${path.relative(vaultResolved, dest)}`);
  }

  if (!execute) {
    console.log("\nNo files moved (dry-run). Pass --execute to apply.");
    return;
  }

  await mkdir(archiveDirResolved, { recursive: true });

  for (const { src, dest } of moves) {
    await rename(src, dest);
  }

  console.log(`\nDone: archived ${moves.length} note(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
