#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveVaultExportFanoutMode } from "./lib/load-session-close-env.mjs";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} reportPath
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 */
export async function recordNotebooklmFanoutMode(reportPath, opts = {}) {
  const resolved = await resolveVaultExportFanoutMode({ env: opts.env });
  let report;
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `session-close: record-notebooklm-fanout-mode could not read close-report: ${message}; continuing\n`,
    );
    return resolved;
  }
  if (!isObject(report)) {
    return resolved;
  }

  report.notebooklm_fanout_mode = resolved.mode;
  report.legacy_fanout_deprecation = resolved.mode === "legacy-source-add";

  const deterministic = isObject(report.deterministic) ? { ...report.deterministic } : {};
  if (resolved.driveDocId) {
    deterministic.notebooklm_drive_doc_id = resolved.driveDocId;
  } else {
    delete deterministic.notebooklm_drive_doc_id;
  }
  report.deterministic = deterministic;

  if (resolved.oauthSetupRequired) {
    process.stderr.write(
      "session-close: GOOGLE_OAUTH_SETUP_REQUIRED — Drive Doc ID is set but OAuth credentials are missing; falling back to legacy source_add\n",
    );
  } else if (resolved.mode === "legacy-source-add" && !resolved.driveDocId) {
    process.stderr.write(
      "session-close: NOTEBOOKLM_DRIVE_DOC_ID not set — legacy source_add fan-out (deprecated); set Drive Doc ID per references/drive-export-sync.md\n",
    );
  }

  const targets = Array.isArray(report.notebooklm_targets) ? report.notebooklm_targets : [];
  for (const row of targets) {
    if (isObject(row) && resolved.driveDocId) {
      row.drive_doc_id = resolved.driveDocId;
    }
  }
  report.notebooklm_targets = targets;

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return resolved;
}

async function main() {
  const repoRoot = process.env.OMNIPOTENT_REPO || process.cwd();
  const reportIndex = process.argv.indexOf("--report");
  const reportPath =
    reportIndex >= 0 && process.argv[reportIndex + 1]
      ? process.argv[reportIndex + 1]
      : join(repoRoot, ".session-close", "close-report.json");
  const resolved = await recordNotebooklmFanoutMode(reportPath);
  process.stdout.write(`${JSON.stringify(resolved)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: record-notebooklm-fanout-mode failed: ${message}; continuing\n`);
    process.exit(0);
  });
}
