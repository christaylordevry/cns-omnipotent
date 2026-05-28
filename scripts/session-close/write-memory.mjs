#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { loadContextPackIfPresent } from "./lib/load-context-pack.mjs";
import { resolvePaths } from "./lib/paths.mjs";
import { readSprintSnapshot } from "./lib/read-sources.mjs";
import { buildMemoryMarkdown } from "./lib/write-memory-body.mjs";

/**
 * @param {Record<string, unknown> | null} pack
 * @returns {string | undefined}
 */
function projectStatusFromPack(pack) {
  const sprint = pack?.sprint;
  if (!sprint || typeof sprint !== "object") {
    return undefined;
  }
  const line = /** @type {{ project_status_line?: unknown }} */ (sprint).project_status_line;
  return typeof line === "string" && line.trim() ? line.trim() : undefined;
}

/**
 * @param {{
 *   dryRun?: boolean;
 *   repoRoot?: string;
 *   vaultRoot?: string;
 *   contextPackPath?: string;
 *   contextPack?: Record<string, unknown> | null;
 * }} [opts]
 */
export async function runWriteMemory(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const paths = resolvePaths({
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
  });

  const memoryPath = join(paths.vaultRoot, "AI-Context", "MEMORY.md");
  const contextPackPath = opts.contextPackPath ?? paths.contextPackPath;
  const pack =
    opts.contextPack ??
    (await loadContextPackIfPresent(contextPackPath));

  const agentsText = await readFile(paths.agentsPath, "utf8");
  const sprintYaml = await readFile(paths.sprintPath, "utf8");
  const sprint = await readSprintSnapshot(paths.sprintPath, paths.repoRoot);
  const projectStatusLine =
    projectStatusFromPack(pack) ?? sprint.project_status_line;

  const body = buildMemoryMarkdown({
    agentsText,
    sprintYaml,
    projectStatusLine,
    vaultRoot: paths.vaultRoot,
  });

  if (dryRun) {
    return { memoryPath, body, written: false, usedContextPack: pack !== null };
  }

  await writeFile(memoryPath, body, { encoding: "utf8" });
  return { memoryPath, body, written: true, usedContextPack: pack !== null };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  try {
    const result = await runWriteMemory({ dryRun });
    const packNote = result.usedContextPack ? " (context-pack)" : "";
    if (dryRun) {
      process.stdout.write(
        `session-close: MEMORY preview (${result.body.length} chars)${packNote} → ${result.memoryPath}\n`,
      );
    } else {
      process.stdout.write(
        `session-close: MEMORY written (${result.body.length} chars)${packNote} → ${result.memoryPath}\n`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: write-memory failed: ${message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: write-memory failed: ${message}\n`);
    process.exit(1);
  });
}
