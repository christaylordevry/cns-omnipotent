#!/usr/bin/env node
import { execFile } from "node:child_process";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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

/** Default per-call bound for `nlm source list` (ms). */
export const NLM_LIST_TIMEOUT_MS = 25_000;
/** Default per-call bound for `nlm source sync` (ms). */
export const NLM_SYNC_TIMEOUT_MS = 120_000;
/**
 * Hard ceiling for list/sync timeout env overrides (ms).
 * Must stay below Hermes `terminal: timeout: 300` so the *inner* execFile bound
 * fires first and preserves `nlm_list_timeout` / `nlm_sync_timeout` classification.
 * Do not "simplify" to 300_000 — that is parity with the outer kill and makes the
 * inner bound unreachable (opaque terminal kill instead of nlm_*_timeout).
 * Arithmetic: concurrent syncs → wall ≈ max(sync)+list+report ≈ 240+25 ≈ 265s,
 * ~35s margin inside 300s. Measured live sync is 41.2s; >240s implies ~9 MB export
 * and needs a design revisit, not a bigger number.
 */
export const NLM_TIMEOUT_MS_CAP = 240_000;
/** Default canary fraction of sync bound (warn when duration ≥ fraction × bound). */
export const NLM_SYNC_CANARY_FRACTION = 0.5;

/**
 * Resolve a positive integer ms timeout from env. Invalid values fall back to
 * default with a loud WARNING — never return NaN/0/negative (Node execFile
 * treats those as no timeout = unbounded hang). Values above
 * {@link NLM_TIMEOUT_MS_CAP} clamp to the cap with a loud WARNING (never silent).
 *
 * @param {string} name
 * @param {number} defaultMs
 * @param {Record<string, string | undefined>} [env]
 * @returns {number}
 */
export function resolvePositiveIntMsEnv(name, defaultMs, env = process.env) {
  const raw = env[name];
  if (raw === undefined) {
    return defaultMs;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    process.stderr.write(
      `session-close: WARNING invalid ${name}=${JSON.stringify(raw)}; using default ${defaultMs}\n`,
    );
    return defaultMs;
  }
  if (n > NLM_TIMEOUT_MS_CAP) {
    process.stderr.write(
      `session-close: WARNING ${name}=${JSON.stringify(raw)} exceeds cap ${NLM_TIMEOUT_MS_CAP}; using ${NLM_TIMEOUT_MS_CAP} (preserves nlm_sync_timeout / nlm_list_timeout inside Hermes terminal budget 300s — do not raise cap to 300000)\n`,
    );
    return NLM_TIMEOUT_MS_CAP;
  }
  return n;
}

/**
 * Resolve canary fraction in (0, 1]. Invalid → default + WARNING.
 *
 * @param {string} name
 * @param {number} defaultFraction
 * @param {Record<string, string | undefined>} [env]
 * @returns {number}
 */
export function resolveCanaryFractionEnv(name, defaultFraction, env = process.env) {
  const raw = env[name];
  if (raw === undefined) {
    return defaultFraction;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) {
    process.stderr.write(
      `session-close: WARNING invalid ${name}=${JSON.stringify(raw)}; using default ${defaultFraction}\n`,
    );
    return defaultFraction;
  }
  return n;
}

/**
 * Pick list vs sync timeout from argv (resolved at call time).
 *
 * @param {string[]} args
 * @param {Record<string, string | undefined>} [env]
 * @returns {number}
 */
export function resolveNlmCallTimeoutMs(args, env = process.env) {
  if (args.includes("sync")) {
    return resolvePositiveIntMsEnv("NLM_SYNC_TIMEOUT_MS", NLM_SYNC_TIMEOUT_MS, env);
  }
  return resolvePositiveIntMsEnv("NLM_LIST_TIMEOUT_MS", NLM_LIST_TIMEOUT_MS, env);
}

/**
 * @param {number} durationMs
 * @param {number} syncBoundMs
 * @param {number} fraction
 * @param {number | null | undefined} sourceSizeBytes
 */
export function maybeEmitSyncCanary(durationMs, syncBoundMs, fraction, sourceSizeBytes) {
  if (!(durationMs >= fraction * syncBoundMs)) {
    return;
  }
  const sizeLabel =
    typeof sourceSizeBytes === "number" && Number.isFinite(sourceSizeBytes)
      ? String(sourceSizeBytes)
      : "unknown";
  process.stderr.write(
    `session-close: WARNING nlm source sync canary: duration_ms=${durationMs} bound_ms=${syncBoundMs} source_size_bytes=${sizeLabel}\n`,
  );
}

/**
 * Stamp `failure_class` only when currently null/empty (never overwrite Phase A).
 *
 * @param {string} reportPath
 * @param {string} failureClass
 */
async function stampFailureClassIfEmpty(reportPath, failureClass) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (!isObject(report)) {
    throw new Error("close-report invalid");
  }
  const existing = report.failure_class;
  if (existing != null && existing !== "") {
    return report;
  }
  report.failure_class = failureClass;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

/**
 * Prefer on-disk size of the vault-export file (AC4). Missing/unreadable → null
 * so the canary prints `source_size_bytes=unknown`. Metadata `export_bytes` is
 * fallback only when `export_path` is absent.
 *
 * @param {Record<string, unknown>} report
 * @returns {Promise<number | null>}
 */
export async function resolveExportSourceBytes(report) {
  const det = isObject(report.deterministic) ? report.deterministic : {};
  if (typeof det.export_path === "string" && det.export_path.trim()) {
    try {
      const s = await stat(det.export_path);
      return s.size;
    } catch {
      return null;
    }
  }
  if (typeof det.export_bytes === "number" && Number.isFinite(det.export_bytes)) {
    return det.export_bytes;
  }
  return null;
}

/**
 * Apply drive-sync phase rollup: honest ok + failure_class when null.
 *
 * @param {string} reportPath
 * @param {Array<{ status: string }>} updates
 * @param {(fn: () => Promise<unknown>) => Promise<unknown>} [withLock]
 * @param {{ expectedCount?: number }} [opts] — authoritative N (notebook ids);
 *   use when some workers rejected after stamp so `updates.length` undercounts.
 * @returns {Promise<{ ok: boolean; synced: number; failureClass: string | null }>}
 */
export async function applyDriveSyncRollup(reportPath, updates, withLock, opts = {}) {
  const synced = updates.filter((u) => u.status === "ok").length;
  const n =
    typeof opts.expectedCount === "number" && Number.isFinite(opts.expectedCount)
      ? opts.expectedCount
      : updates.length;
  /** @type {string | null} */
  let failureClass = null;
  if (n === 0) {
    failureClass = "notebooklm_no_targets";
  } else if (synced === 0) {
    failureClass = "notebooklm";
  } else if (synced < n) {
    failureClass = "notebooklm_partial";
  }

  if (failureClass) {
    const stamp = () => stampFailureClassIfEmpty(reportPath, failureClass);
    if (withLock) {
      await withLock(stamp);
    } else {
      await stamp();
    }
  }

  return {
    ok: n > 0 && synced === n,
    synced,
    failureClass,
  };
}

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
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   now?: () => number;
 *   sourceSizeBytes?: number | null;
 *   execFile?: typeof execFileAsync;
 * }} [opts]
 * @returns {Promise<SyncNotebookResult>}
 */
export async function syncNotebookDriveSource(notebookId, driveDocId, runNlm, opts = {}) {
  const callEnv = opts.env ?? process.env;
  const now = opts.now ?? (() => Date.now());
  const sourceSizeBytes = opts.sourceSizeBytes;
  const nlmEnv = await resolveNlmEnv();
  const nlm = await resolveNlmCommand({ env: nlmEnv });
  if (!nlm) {
    return {
      status: /** @type {'failed'} */ ("failed"),
      stderr: "nlm CLI not found",
      driveSourceId: null,
    };
  }

  const execImpl = opts.execFile ?? execFileAsync;
  const runner =
    runNlm ??
    (async (cmd, args) => {
      const timeout = resolveNlmCallTimeoutMs(args, callEnv);
      const { stdout } = await execImpl(cmd, args, {
        env: nlmEnv,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout,
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

  const syncBoundMs = resolvePositiveIntMsEnv(
    "NLM_SYNC_TIMEOUT_MS",
    NLM_SYNC_TIMEOUT_MS,
    callEnv,
  );
  const canaryFraction = resolveCanaryFractionEnv(
    "NLM_SYNC_CANARY_FRACTION",
    NLM_SYNC_CANARY_FRACTION,
    callEnv,
  );
  const syncStarted = now();
  try {
    await runner(nlm, [
      "source",
      "sync",
      notebookId,
      "--source-ids",
      matched.sourceId,
      "-y",
    ]);
    maybeEmitSyncCanary(now() - syncStarted, syncBoundMs, canaryFraction, sourceSizeBytes);
    return { status: "ok", stderr: "", driveSourceId: matched.sourceId };
  } catch (err) {
    maybeEmitSyncCanary(now() - syncStarted, syncBoundMs, canaryFraction, sourceSizeBytes);
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
 *   now?: () => number;
 *   execFile?: typeof execFileAsync;
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
    process.stderr.write(
      "session-close: sync-vault-export-drive no notebooklm_targets resolved (N=0); refusing vacuous success\n",
    );
    await stampFailureClassIfEmpty(reportPath, "notebooklm_no_targets");
    return {
      ok: false,
      synced: 0,
      reason: "no-notebooklm-targets",
      failure_class: "notebooklm_no_targets",
    };
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

  // Re-read after mode patch so export_bytes / path are current.
  report = JSON.parse(await readFile(reportPath, "utf8"));
  const sourceSizeBytes = await resolveExportSourceBytes(
    isObject(report) ? report : {},
  );

  const mergeLock = createAsyncMutex();

  await mergeLock(async () =>
    patchDriveSyncPhase(reportPath, { started_at: new Date().toISOString() }),
  );

  const settled = await Promise.allSettled(
    notebookIds.map(async (notebookId) => {
      const result = await syncNotebookDriveSource(notebookId, driveDocId, opts.runNlm, {
        env,
        now: opts.now,
        sourceSizeBytes,
        execFile: opts.execFile,
      });
      const update = buildFanoutUpdate(notebookId, driveDocId, result);
      // Stamp first so a log-append IO failure cannot leave the row UNSTAMPED.
      await mergeLock(async () => mergeFanoutUpdatesAtPath(reportPath, [update]));
      await appendDriveSyncFailureLogs([update], {
        logPath: opts.driveSyncLogPath,
        env,
      });
      return update;
    }),
  );

  await mergeLock(async () =>
    patchDriveSyncPhase(reportPath, { finished_at: new Date().toISOString() }),
  );

  const updates = settled
    .filter((row) => row.status === "fulfilled")
    .map((row) => /** @type {import('./merge-notebooklm-fanout.mjs').FanoutUpdate} */ (row.value));
  const rejected = settled.filter((row) => row.status === "rejected");

  const rollup = await applyDriveSyncRollup(reportPath, updates, mergeLock, {
    expectedCount: notebookIds.length,
  });

  if (rejected.length > 0) {
    const first = rejected[0];
    const reason = first.status === "rejected" ? first.reason : undefined;
    const message = reason instanceof Error ? reason.message : String(reason ?? "unknown");
    process.stderr.write(
      `session-close: sync-vault-export-drive worker failed for ${rejected.length} notebook(s): ${message}\n`,
    );
    return {
      ok: false,
      reason: "partial-merge-failed",
      synced: rollup.synced,
    };
  }

  return { ok: rollup.ok, synced: rollup.synced };
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
