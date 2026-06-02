#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { sanitizeFanoutErrorText } from "./lib/classify-source-add-error.mjs";
import { readNotebooklmDriveDocId } from "./lib/load-session-close-env.mjs";
import { matchDriveSourceByDocId } from "./lib/match-drive-source.mjs";
import { resolveNlmCommand } from "./lib/nlm-auth-watchdog.mjs";
import { mergeFanoutUpdatesAtPath } from "./merge-notebooklm-fanout.mjs";

const execFileAsync = promisify(execFile);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} reportPath
 * @param {Record<string, unknown>} patch
 */
async function patchCloseReport(reportPath, patch) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (!isObject(report)) {
    throw new Error("close-report invalid");
  }
  Object.assign(report, patch);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

/**
 * @param {string} stdout
 * @returns {unknown[]}
 */
export function parseNlmDriveSourceList(stdout) {
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new Error("nlm source list --drive --json must return a JSON array");
  }
  return parsed;
}

/**
 * @param {string} notebookId
 * @param {string} driveDocId
 * @param {(cmd: string, args: string[]) => Promise<{ stdout: string }>} [runNlm]
 */
export async function syncNotebookDriveSource(notebookId, driveDocId, runNlm) {
  const nlm = await resolveNlmCommand();
  if (!nlm) {
    return {
      status: /** @type {'failed'} */ ("failed"),
      stderr: "nlm CLI not found",
      driveSourceId: null,
    };
  }

  const runner =
    runNlm ??
    (async (cmd, args) => {
      const { stdout } = await execFileAsync(cmd, args, {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      return { stdout };
    });

  let listStdout;
  try {
    const listed = await runner(nlm, [
      "source",
      "list",
      notebookId,
      "--drive",
      "--json",
      "--skip-freshness",
    ]);
    listStdout = listed.stdout;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr =
      err && typeof err === "object" && "stderr" in err && typeof err.stderr === "string"
        ? `${message}\n${err.stderr}`
        : message;
    return { status: "failed", stderr, driveSourceId: null };
  }

  let sources;
  try {
    sources = parseNlmDriveSourceList(listStdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", stderr: message, driveSourceId: null };
  }

  const matched = matchDriveSourceByDocId(sources, driveDocId);
  if (!matched) {
    return {
      status: "failed",
      stderr:
        `no Drive source matched NOTEBOOKLM_DRIVE_DOC_ID ${driveDocId}; add the Doc as a Drive source in NotebookLM UI`,
      driveSourceId: null,
    };
  }

  try {
    await runner(nlm, [
      "source",
      "sync",
      notebookId,
      "--source-ids",
      matched.sourceId,
      "-y",
    ]);
    return { status: "ok", stderr: "", driveSourceId: matched.sourceId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr =
      err && typeof err === "object" && "stderr" in err && typeof err.stderr === "string"
        ? `${message}\n${err.stderr}`
        : message;
    return { status: "failed", stderr, driveSourceId: matched.sourceId };
  }
}

/**
 * @param {string} reportPath
 * @param {{
 *   driveDocId?: string;
 *   runNlm?: (cmd: string, args: string[]) => Promise<{ stdout: string }>;
 * }} [opts]
 */
export async function runSyncVaultExportDrive(reportPath, opts = {}) {
  const driveDocId = opts.driveDocId ?? (await readNotebooklmDriveDocId());
  if (!driveDocId) {
    return { ok: false, skipped: true, reason: "missing-doc-id" };
  }

  let report;
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `session-close: sync-vault-export-drive could not read close-report: ${message}; continuing\n`,
    );
    return { ok: false, reason: "report-read" };
  }

  const steps = isObject(report.steps) ? report.steps : {};
  const driveWrite = isObject(steps.drive_write) ? steps.drive_write : null;
  const exportStep = isObject(steps.export) ? steps.export : null;
  if (exportStep?.status !== "ok") {
    process.stderr.write(
      "session-close: sync-vault-export-drive skipped (Phase A export not ok)\n",
    );
    return { ok: false, skipped: true, reason: "export-not-ok" };
  }

  const targets = Array.isArray(report.notebooklm_targets) ? report.notebooklm_targets : [];
  if (targets.length === 0) {
    process.stderr.write("session-close: sync-vault-export-drive no notebooklm_targets; continuing\n");
    return { ok: true, synced: 0 };
  }

  await patchCloseReport(reportPath, {
    notebooklm_fanout_mode: "drive-sync",
    legacy_fanout_deprecation: false,
  });

  if (driveWrite?.status === "failed") {
    const message =
      typeof driveWrite.message === "string"
        ? driveWrite.message
        : "drive doc overwrite failed";
    const updates = targets
      .filter((row) => isObject(row) && typeof row.notebook_id === "string")
      .map((row) => ({
        notebook_id: /** @type {string} */ (row.notebook_id),
        status: /** @type {'failed'} */ ("failed"),
        stderr: message,
        error_class: "drive_write_error",
      }));
    await mergeFanoutUpdatesAtPath(reportPath, updates);
    const patched = JSON.parse(await readFile(reportPath, "utf8"));
    const patchedTargets = Array.isArray(patched.notebooklm_targets) ? patched.notebooklm_targets : [];
    for (const row of patchedTargets) {
      if (isObject(row)) {
        row.drive_doc_id = driveDocId;
      }
    }
    await writeFile(reportPath, `${JSON.stringify(patched, null, 2)}\n`, "utf8");
    return { ok: false, reason: "drive-write-failed", merged: updates.length };
  }

  /** @type {import('./merge-notebooklm-fanout.mjs').FanoutUpdate[]} */
  const updates = [];
  for (const target of targets) {
    if (!isObject(target) || typeof target.notebook_id !== "string") {
      continue;
    }
    const notebookId = target.notebook_id;
    const result = await syncNotebookDriveSource(notebookId, driveDocId, opts.runNlm);
    target.drive_doc_id = driveDocId;
    if (result.driveSourceId) {
      target.drive_source_id = result.driveSourceId;
    }
    updates.push({
      notebook_id: notebookId,
      status: result.status,
      stderr: result.stderr,
      ...(result.status === "failed" && result.stderr.includes("NOTEBOOKLM_DRIVE_DOC_ID")
        ? {}
        : {}),
    });
  }

  await mergeFanoutUpdatesAtPath(reportPath, updates);

  const reportAfter = JSON.parse(await readFile(reportPath, "utf8"));
  const rows = Array.isArray(reportAfter.notebooklm_targets) ? reportAfter.notebooklm_targets : [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const update = updates.find((u) => isObject(row) && row.notebook_id === u.notebook_id);
    if (!isObject(row) || !update || update.status !== "failed") {
      continue;
    }
    if (update.stderr.includes("NOTEBOOKLM_DRIVE_DOC_ID")) {
      row.error_class = "unknown";
      const snippet = sanitizeFanoutErrorText(update.stderr);
      if (snippet) {
        row.error_snippet = snippet;
      }
    }
  }
  await writeFile(reportPath, `${JSON.stringify(reportAfter, null, 2)}\n`, "utf8");

  return { ok: true, synced: updates.filter((u) => u.status === "ok").length };
}

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  const repoRoot = process.env.OMNIPOTENT_REPO || process.cwd();
  const reportIndex = argv.indexOf("--report");
  return {
    reportPath:
      reportIndex >= 0 && argv[reportIndex + 1]
        ? argv[reportIndex + 1]
        : join(repoRoot, ".session-close", "close-report.json"),
  };
}

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  const result = await runSyncVaultExportDrive(opts.reportPath);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: sync-vault-export-drive failed: ${message}; continuing\n`);
    process.stdout.write(`${JSON.stringify({ ok: false, message })}\n`);
    process.exit(0);
  });
}
