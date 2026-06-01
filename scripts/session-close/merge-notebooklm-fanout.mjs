#!/usr/bin/env node
import { stat } from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  classifySourceAddError,
  parseHttpStatus,
  sanitizeFanoutErrorText,
} from "./lib/classify-source-add-error.mjs";

/**
 * @typedef {{ notebook_id: string; status: 'ok' | 'failed'; stderr?: string }} FanoutUpdate
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} report
 * @param {string} exportPath
 */
async function resolveExportBytes(report, exportPath) {
  const deterministic = report.deterministic;
  if (isObject(deterministic) && typeof deterministic.export_bytes === "number") {
    return deterministic.export_bytes;
  }
  if (!exportPath) {
    return null;
  }
  try {
    const info = await stat(exportPath);
    return info.size;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {'ok' | 'failed'} status
 * @param {string | undefined} stderr
 * @param {number | null} exportBytes
 */
function applyFanoutFields(row, status, stderr, exportBytes) {
  row.fanout_status = status;
  if (exportBytes !== null) {
    row.export_bytes = exportBytes;
  }

  if (status === "ok") {
    delete row.error_class;
    delete row.error_snippet;
    delete row.http_status;
    return;
  }

  const combined = stderr ?? "";
  row.error_class = classifySourceAddError(combined);
  const httpStatus = parseHttpStatus(combined);
  row.http_status = httpStatus;
  const snippet = sanitizeFanoutErrorText(combined);
  if (snippet) {
    row.error_snippet = snippet;
  } else {
    delete row.error_snippet;
  }
}

/**
 * @param {Record<string, unknown>} report
 * @param {FanoutUpdate} update
 */
export async function mergeFanoutIntoCloseReport(report, update) {
  const targets = Array.isArray(report.notebooklm_targets) ? report.notebooklm_targets : [];
  const index = targets.findIndex(
    (row) => isObject(row) && row.notebook_id === update.notebook_id,
  );
  if (index < 0) {
    return { merged: false, report };
  }

  const row = /** @type {Record<string, unknown>} */ (targets[index]);
  const exportPath = typeof row.export_path === "string" ? row.export_path : "";
  const exportBytes = await resolveExportBytes(report, exportPath);
  applyFanoutFields(row, update.status, update.stderr, exportBytes);
  return { merged: true, report };
}

/**
 * @param {string} reportPath
 * @param {FanoutUpdate[]} updates
 */
export async function mergeFanoutUpdatesAtPath(reportPath, updates) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  let mergedCount = 0;
  for (const update of updates) {
    const result = await mergeFanoutIntoCloseReport(report, update);
    if (result.merged) {
      mergedCount += 1;
    }
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, mergedCount };
}

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  const repoRoot = process.env.OMNIPOTENT_REPO || process.cwd();
  const reportIndex = argv.indexOf("--report");
  const notebookIndex = argv.indexOf("--notebook-id");
  const statusIndex = argv.indexOf("--status");
  const stderrIndex = argv.indexOf("--stderr");
  const batch = argv.includes("--batch");

  return {
    batch,
    reportPath:
      reportIndex >= 0 && argv[reportIndex + 1]
        ? argv[reportIndex + 1]
        : join(repoRoot, ".session-close", "close-report.json"),
    notebookId: notebookIndex >= 0 ? argv[notebookIndex + 1] : undefined,
    status: statusIndex >= 0 ? argv[statusIndex + 1] : undefined,
    stderr: stderrIndex >= 0 ? argv[stderrIndex + 1] : "",
  };
}

/**
 * @param {unknown} raw
 * @returns {FanoutUpdate[]}
 */
function parseBatch(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("batch payload must be a JSON array");
  }
  const updates = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.notebook_id !== "string") {
      continue;
    }
    const status = item.status === "ok" || item.status === "failed" ? item.status : "failed";
    updates.push({
      notebook_id: item.notebook_id,
      status,
      stderr: typeof item.stderr === "string" ? item.stderr : "",
    });
  }
  return updates;
}

async function readBatchFromStdin() {
  if (process.stdin.isTTY) {
    return [];
  }

  const readAll = () =>
    new Promise((resolve) => {
      const chunks = [];
      process.stdin.on("data", (chunk) => chunks.push(chunk));
      process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      process.stdin.on("error", () => resolve(""));
      process.stdin.resume();
    });

  const text = await Promise.race([
    readAll(),
    new Promise((resolve) => globalThis.setTimeout(() => resolve(""), 150)),
  ]);

  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  return parseBatch(JSON.parse(trimmed));
}

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  let updates = [];

  if (opts.batch) {
    updates = await readBatchFromStdin();
  } else if (opts.notebookId && (opts.status === "ok" || opts.status === "failed")) {
    updates = [
      {
        notebook_id: opts.notebookId,
        status: opts.status,
        stderr: opts.stderr,
      },
    ];
  } else {
    process.stderr.write(
      "session-close: merge-notebooklm-fanout requires --notebook-id and --status, or --batch\n",
    );
    process.exit(0);
  }

  if (opts.batch && updates.length === 0) {
    process.stderr.write(
      "session-close: merge-notebooklm-fanout --batch received no updates (empty stdin?); continuing\n",
    );
    process.stdout.write(`${JSON.stringify({ ok: true, merged: 0 })}\n`);
    process.exit(0);
  }

  try {
    const { mergedCount } = await mergeFanoutUpdatesAtPath(opts.reportPath, updates);
    if (mergedCount < updates.length) {
      process.stderr.write(
        `session-close: merge-notebooklm-fanout merged ${mergedCount}/${updates.length} targets (unknown notebook_id?); continuing\n`,
      );
    }
    process.stdout.write(`${JSON.stringify({ ok: true, merged: mergedCount })}\n`);
  } catch {
    process.stderr.write(
      "session-close: merge-notebooklm-fanout could not update close-report.json; continuing\n",
    );
    process.stdout.write(`${JSON.stringify({ ok: false, merged: 0 })}\n`);
    process.exit(0);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => {
    process.stderr.write(
      "session-close: merge-notebooklm-fanout failed; continuing\n",
    );
    process.stdout.write(`${JSON.stringify({ ok: false, merged: 0 })}\n`);
    process.exit(0);
  });
}
