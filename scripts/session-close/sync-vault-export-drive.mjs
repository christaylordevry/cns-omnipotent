#!/usr/bin/env node
import { execFile } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { readNotebooklmDriveDocId } from "./lib/load-session-close-env.mjs";
import { matchDriveSourceByDocId } from "./lib/match-drive-source.mjs";
import { isTimeoutError, resolveNlmCommand, resolveNlmEnv } from "./lib/nlm-auth-watchdog.mjs";
import { resolveOperatorHome } from "./lib/operator-home.mjs";
import { resolvePaths } from "./lib/paths.mjs";
import { mergeFanoutUpdatesAtPath } from "./merge-notebooklm-fanout.mjs";

const DRIVE_SYNC_LOG_BASENAME = "session-close-drive-sync.log";

/** Per-call bound for `nlm source list` / `nlm source sync` (ms). */
export const NLM_EXEC_TIMEOUT_MS = 25_000;

/**
 * Simple promise-chain mutex so concurrent notebook workers serialize
 * close-report read-modify-write merges.
 * @returns {(fn: () => Promise<unknown>) => Promise<unknown>}
 */
export function createAsyncMutex() {
  /** @type {Promise<unknown>} */
  let chain = Promise.resolve();
  return function withLock(fn) {
    const run = chain.then(() => fn());
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/**
 * Append full drive-sync stderr to operator log before close-report sanitization.
 *
 * @param {Array<{ notebook_id?: string; status: string; stderr?: string }>} updates
 * @param {{ env?: Record<string, string | undefined>; logPath?: string }} [opts]
 */
export async function appendDriveSyncFailureLogs(updates, opts = {}) {
  const failures = updates.filter(
    (row) => row.status === "failed" && typeof row.stderr === "string" && row.stderr.trim(),
  );
  if (failures.length === 0) {
    return;
  }

  const logPath =
    opts.logPath ??
    join(
      await resolveOperatorHome(opts.env ?? process.env),
      ".hermes",
      "logs",
      DRIVE_SYNC_LOG_BASENAME,
    );
  await mkdir(dirname(logPath), { recursive: true });

  const timestamp = new Date().toISOString();
  for (const row of failures) {
    const notebookId = typeof row.notebook_id === "string" ? row.notebook_id : "unknown";
    const block = `[${timestamp}] notebook_id=${notebookId}\n${row.stderr}\n---\n`;
    await appendFile(logPath, block, "utf8");
  }
}

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
 * Merge fields into existing `drive_sync_phase` (preserves started_at etc.).
 * @param {string} reportPath
 * @param {Record<string, unknown>} phasePatch
 */
async function patchDriveSyncPhase(reportPath, phasePatch) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (!isObject(report)) {
    throw new Error("close-report invalid");
  }
  const existing = isObject(report.drive_sync_phase) ? report.drive_sync_phase : {};
  report.drive_sync_phase = { ...existing, ...phasePatch };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function formatExecError(err) {
  const message = err instanceof Error ? err.message : String(err);
  if (err && typeof err === "object" && "stderr" in err && typeof err.stderr === "string") {
    return `${message}\n${err.stderr}`;
  }
  return message;
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

/** Canonical vault-export title (without extension) for PDF / Doc matching. */
export const VAULT_EXPORT_SOURCE_TITLE = "vault-export-for-notebooklm";

/**
 * @param {unknown} title
 * @returns {boolean}
 */
function titleMatchesVaultExport(title) {
  if (typeof title !== "string") {
    return false;
  }
  const normalized = title.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const base = VAULT_EXPORT_SOURCE_TITLE.toLowerCase();
  return (
    normalized === base ||
    normalized === `${base}.pdf` ||
    normalized === `${base}.md` ||
    normalized.startsWith(`${base}.`)
  );
}

/**
 * Prefer google_docs type (legacy Doc source) when drive_doc_id match misses.
 * @param {unknown[]} sources
 * @returns {{ sourceId: string; source: Record<string, unknown> } | null}
 */
export function matchGoogleDocsSourceFallback(sources) {
  if (!Array.isArray(sources)) {
    return null;
  }
  for (const source of sources) {
    if (!isObject(source) || source.type !== "google_docs" || typeof source.id !== "string") {
      continue;
    }
    const sourceId = source.id.trim();
    if (sourceId) {
      return { sourceId, source };
    }
  }
  return null;
}

/**
 * PDF Drive sources (spike): type `word_doc`, no drive_doc_id/url.
 * Anchor to vault-export title so migration (Doc + PDF both present) does not pick the wrong source.
 * @param {unknown[]} sources
 * @returns {{ sourceId: string; source: Record<string, unknown> } | null}
 */
export function matchWordDocVaultExportFallback(sources) {
  if (!Array.isArray(sources)) {
    return null;
  }
  for (const source of sources) {
    if (!isObject(source) || source.type !== "word_doc" || typeof source.id !== "string") {
      continue;
    }
    if (!titleMatchesVaultExport(source.title)) {
      continue;
    }
    const sourceId = source.id.trim();
    if (sourceId) {
      return { sourceId, source };
    }
  }
  return null;
}

/**
 * @typedef {{
 *   status: 'ok' | 'failed';
 *   stderr: string;
 *   driveSourceId: string | null;
 *   errorClass?: string;
 * }} SyncNotebookResult
 */

/**
 * @param {string} notebookId
 * @param {string} driveDocId
 * @param {(cmd: string, args: string[]) => Promise<{ stdout: string }>} [runNlm]
 * @returns {Promise<SyncNotebookResult>}
 */
export async function syncNotebookDriveSource(notebookId, driveDocId, runNlm) {
  const nlmEnv = await resolveNlmEnv();
  const nlm = await resolveNlmCommand({ env: nlmEnv });
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
        env: nlmEnv,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: NLM_EXEC_TIMEOUT_MS,
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
    const stderr = formatExecError(err);
    if (isTimeoutError(err)) {
      return {
        status: "failed",
        stderr,
        driveSourceId: null,
        errorClass: "nlm_list_timeout",
      };
    }
    return { status: "failed", stderr, driveSourceId: null };
  }

  let sources;
  try {
    sources = parseNlmDriveSourceList(listStdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", stderr: message, driveSourceId: null };
  }

  let matched = matchDriveSourceByDocId(sources, driveDocId);
  if (!matched) {
    matched = matchGoogleDocsSourceFallback(sources);
  }
  if (!matched) {
    matched = matchWordDocVaultExportFallback(sources);
  }
  if (!matched) {
    return {
      status: "failed",
      stderr:
        `no Drive source matched NOTEBOOKLM_DRIVE_DOC_ID ${driveDocId} and no google_docs / vault-export word_doc fallback source was available; add the PDF (or Doc) as a Drive source titled vault-export-for-notebooklm in NotebookLM UI`,
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
    const stderr = formatExecError(err);
    if (isTimeoutError(err)) {
      return {
        status: "failed",
        stderr,
        driveSourceId: matched.sourceId,
        errorClass: "nlm_sync_timeout",
      };
    }
    return { status: "failed", stderr, driveSourceId: matched.sourceId };
  }
}

/**
 * @param {string} notebookId
 * @param {string} driveDocId
 * @param {SyncNotebookResult} result
 * @returns {import('./merge-notebooklm-fanout.mjs').FanoutUpdate}
 */
function buildFanoutUpdate(notebookId, driveDocId, result) {
  /** @type {import('./merge-notebooklm-fanout.mjs').FanoutUpdate} */
  const update = {
    notebook_id: notebookId,
    status: result.status,
    stderr: result.stderr,
    drive_doc_id: driveDocId,
  };
  if (result.driveSourceId) {
    update.drive_source_id = result.driveSourceId;
  }
  if (result.errorClass) {
    update.error_class = result.errorClass;
  } else if (result.status === "failed" && result.stderr.includes("NOTEBOOKLM_DRIVE_DOC_ID")) {
    update.error_class = "unknown";
  }
  return update;
}

/**
 * @param {string} reportPath
 * @param {string} driveDocId
 * @param {unknown[]} targets
 * @param {string} message
 * @param {string | undefined} driveSyncLogPath
 * @param {Record<string, string | undefined> | undefined} env
 */
async function mergeDriveWriteFailure(
  reportPath,
  driveDocId,
  targets,
  message,
  driveSyncLogPath,
  env,
) {
  const updates = targets
    .filter((row) => isObject(row) && typeof row.notebook_id === "string")
    .map((row) => ({
      notebook_id: /** @type {string} */ (row.notebook_id),
      status: /** @type {'failed'} */ ("failed"),
      stderr: message,
      error_class: "drive_write_error",
      drive_doc_id: driveDocId,
    }));
  await appendDriveSyncFailureLogs(updates, { logPath: driveSyncLogPath, env });
  await mergeFanoutUpdatesAtPath(reportPath, updates);
  return { ok: false, reason: "drive-write-failed", merged: updates.length };
}

/**
 * @param {string} reportPath
 * @param {{
 *   driveDocId?: string;
 *   runNlm?: (cmd: string, args: string[]) => Promise<{ stdout: string }>;
 *   driveSyncLogPath?: string;
 *   env?: Record<string, string | undefined>;
 * }} [opts]
 */
export async function runSyncVaultExportDrive(reportPath, opts = {}) {
  const env = opts.env ?? process.env;
  const driveDocId = opts.driveDocId ?? (await readNotebooklmDriveDocId({ env }));
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

  if (driveWrite?.status !== "ok") {
    const message =
      driveWrite?.status === "failed" && typeof driveWrite.message === "string"
        ? driveWrite.message
        : "drive doc overwrite not completed (steps.drive_write missing or not ok)";
    process.stderr.write(`session-close: sync-vault-export-drive skipped (${message})\n`);
    return mergeDriveWriteFailure(
      reportPath,
      driveDocId,
      targets,
      message,
      opts.driveSyncLogPath,
      env,
    );
  }

  const notebookIds = targets
    .filter((row) => isObject(row) && typeof row.notebook_id === "string")
    .map((row) => /** @type {string} */ (row.notebook_id));

  const mergeLock = createAsyncMutex();

  await mergeLock(async () =>
    patchDriveSyncPhase(reportPath, { started_at: new Date().toISOString() }),
  );

  const settled = await Promise.allSettled(
    notebookIds.map(async (notebookId) => {
      const result = await syncNotebookDriveSource(notebookId, driveDocId, opts.runNlm);
      const update = buildFanoutUpdate(notebookId, driveDocId, result);
      await appendDriveSyncFailureLogs([update], {
        logPath: opts.driveSyncLogPath,
        env,
      });
      await mergeLock(async () => mergeFanoutUpdatesAtPath(reportPath, [update]));
      return update;
    }),
  );

  await mergeLock(async () =>
    patchDriveSyncPhase(reportPath, { finished_at: new Date().toISOString() }),
  );

  const updates = settled
    .filter((row) => row.status === "fulfilled")
    .map((row) => /** @type {import('./merge-notebooklm-fanout.mjs').FanoutUpdate} */ (row.value));

  return { ok: true, synced: updates.filter((u) => u.status === "ok").length };
}

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  const { closeReportPath } = resolvePaths();
  const reportIndex = argv.indexOf("--report");
  return {
    reportPath:
      reportIndex >= 0 && argv[reportIndex + 1]
        ? argv[reportIndex + 1]
        : closeReportPath,
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
