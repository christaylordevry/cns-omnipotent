/**
 * One-off operator tool: move into `_archive/source-notes/`:
 *
 * 1. Markdown notes with `pake_type: SourceNote`
 * 2. Chain-generated inbox debris: under `00-Inbox/`, inbox or missing status, no
 *    `pake_type`, filename matches long-slug pattern (see `matchesNoPakeInboxDebrisFilename`)
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

type ArchiveCategory = "SourceNote" | "no-pake inbox debris";

interface ArchiveCandidate {
  src: string;
  category: ArchiveCategory;
}

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

function vaultRelativePosix(vaultResolved: string, fileResolved: string): string {
  return path.relative(vaultResolved, fileResolved).split(path.sep).join("/");
}

function isUnderInboxFolder(vaultResolved: string, fileResolved: string): boolean {
  const rel = vaultRelativePosix(vaultResolved, fileResolved);
  return rel.startsWith("00-Inbox/");
}

/** `status: inbox`, absent status, or null/empty status. */
function isInboxStatusOrMissing(data: Record<string, unknown>): boolean {
  if (!("status" in data) || data.status == null) return true;
  const s = String(data.status).trim().toLowerCase();
  return s === "" || s === "inbox";
}

/** No meaningful PAKE type (missing, null, or whitespace-only). */
function hasNoMeaningfulPakeType(data: Record<string, unknown>): boolean {
  const v = data.pake_type;
  if (v == null) return true;
  return typeof v === "string" && v.trim() === "";
}

/**
 * Long-slug debris: (3+ hyphens in stem AND `-` + 8 hex before `.md`) OR stem length > 60.
 */
function matchesNoPakeInboxDebrisFilename(basename: string): boolean {
  if (!basename.toLowerCase().endsWith(".md")) return false;
  const stem = basename.slice(0, -".md".length);
  const hyphenCount = (stem.match(/-/g) ?? []).length;
  const hexSuffixBeforeMd = /-[0-9a-f]{8}\.md$/i.test(basename);
  const slugPattern = hyphenCount >= 3 && hexSuffixBeforeMd;
  const veryLong = stem.length > 60;
  return slugPattern || veryLong;
}

function logCategoryLabel(category: ArchiveCategory): string {
  return category === "SourceNote"
    ? "ARCHIVED (SourceNote)"
    : "ARCHIVED (no-pake inbox debris)";
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

  const candidates: ArchiveCandidate[] = [];

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

    const basename = path.basename(fileResolved);
    if (OPERATOR_FILE_WHITELIST.includes(basename)) {
      console.log(`SKIPPED (whitelisted operator file): ${path.relative(vaultResolved, fileResolved)}`);
      continue;
    }

    let category: ArchiveCategory | undefined;
    if (data.pake_type === "SourceNote") {
      category = "SourceNote";
    } else if (
      isUnderInboxFolder(vaultResolved, fileResolved) &&
      isInboxStatusOrMissing(data) &&
      hasNoMeaningfulPakeType(data) &&
      matchesNoPakeInboxDebrisFilename(basename)
    ) {
      category = "no-pake inbox debris";
    }

    if (category !== undefined) {
      candidates.push({ src: fileResolved, category });
    }
  }

  const basenameCounts = new Map<string, number>();
  for (const { src } of candidates) {
    const base = path.basename(src);
    basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
  }
  const collisions = [...basenameCounts.entries()].filter(([, n]) => n > 1).map(([b]) => b);
  if (collisions.length > 0) {
    fail(
      `Filename collisions in archive target (multiple candidates share basename): ${collisions.join(", ")}`,
    );
  }

  const moves: { src: string; dest: string; category: ArchiveCategory }[] = [];
  for (const { src, category } of candidates) {
    const dest = path.join(archiveDirResolved, path.basename(src));
    moves.push({ src, dest, category });
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

  const nSource = candidates.filter((c) => c.category === "SourceNote").length;
  const nDebris = candidates.filter((c) => c.category === "no-pake inbox debris").length;
  const summaryExtra =
    moves.length === 0 ? "" : ` (${nSource} SourceNote, ${nDebris} no-pake inbox debris)`;

  console.log(
    execute
      ? `Executing: moving ${moves.length} file(s)${summaryExtra} → ${ARCHIVE_SUBDIR}/`
      : `Dry-run: would move ${moves.length} file(s)${summaryExtra} → ${ARCHIVE_SUBDIR}/`,
  );
  for (const { src, dest, category } of moves) {
    console.log(
      `  [${logCategoryLabel(category)}] ${path.relative(vaultResolved, src)} → ${path.relative(vaultResolved, dest)}`,
    );
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
