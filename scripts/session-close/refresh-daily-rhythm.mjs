#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolvePaths } from "./lib/paths.mjs";
import {
  loadRhythmRefreshInputs,
  refreshRhythmDocument,
} from "./lib/rhythm-markers.mjs";

const STATIC_ROWS_REL =
  "scripts/hermes-skill-examples/session-close/references/daily-rhythm-static-rows.md";

/**
 * @param {{
 *   dryRun?: boolean;
 *   repoRoot?: string;
 *   vaultRoot?: string;
 *   testsLine?: string | null;
 * }} [opts]
 */
export async function runRefreshDailyRhythm(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const paths = resolvePaths({
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
  });

  const rhythmPath = join(paths.vaultRoot, "AI-Context", "CNS-Daily-Rhythm.md");
  const staticRowsPath = join(paths.repoRoot, STATIC_ROWS_REL);
  const deferredPath = join(paths.artifactsDir, "deferred-work.md");
  const epicsPath = join(paths.repoRoot, "_bmad-output", "planning-artifacts", "epics.md");

  const rhythmText = await readFile(rhythmPath, "utf8");
  const { markers, providerLine, sessionDate } = await loadRhythmRefreshInputs({
    repoRoot: paths.repoRoot,
    vaultRoot: paths.vaultRoot,
    agentsPath: paths.agentsPath,
    rhythmPath,
    staticRowsPath,
    sprintPath: paths.sprintPath,
    deferredPath,
    epicsPath,
    testsLine: opts.testsLine ?? null,
    dryRun,
  });

  const updated = refreshRhythmDocument(rhythmText, markers, {
    date: sessionDate,
    agentsVersion: markers.AGENTS_VERSION,
    providerLine,
    realClose: !dryRun,
  });

  if (!dryRun) {
    await writeFile(rhythmPath, updated, { encoding: "utf8" });
  }

  return {
    rhythmPath,
    markers,
    updated,
    written: !dryRun,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  try {
    const result = await runRefreshDailyRhythm({ dryRun });
    if (dryRun) {
      process.stdout.write(
        `session-close: daily rhythm preview (no write) → ${result.rhythmPath}\n`,
      );
    } else {
      process.stdout.write(
        `session-close: daily rhythm updated → ${result.rhythmPath}\n`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: refresh-daily-rhythm failed: ${message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: refresh-daily-rhythm failed: ${message}\n`);
    process.exit(1);
  });
}
