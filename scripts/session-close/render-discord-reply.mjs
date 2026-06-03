#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { resolvePaths } from "./lib/paths.mjs";

/**
 * @param {string} notebookId
 */
function shortNotebookId(notebookId) {
  if (notebookId.length <= 12) {
    return notebookId;
  }
  return `${notebookId.slice(0, 8)}…`;
}

/**
 * @param {unknown} steps
 * @param {string} key
 */
function formatStepLine(steps, key) {
  if (!steps || typeof steps !== "object" || Array.isArray(steps)) {
    return "n/a";
  }
  const step = /** @type {Record<string, unknown>} */ (steps)[key];
  if (!step || typeof step !== "object" || Array.isArray(step)) {
    return "n/a";
  }
  const row = /** @type {{ status?: unknown; message?: unknown }} */ (step);
  const status = typeof row.status === "string" ? row.status : "unknown";
  const message = typeof row.message === "string" ? row.message : "";
  if (status === "ok") {
    return message || "ok";
  }
  if (status === "skipped") {
    return message || "skipped";
  }
  return `${status}${message ? `: ${message}` : ""}`;
}

/**
 * @param {Record<string, unknown>} report
 */
function formatAgentsSync(report) {
  const phaseB = report.phase_b_token_check;
  if (phaseB && typeof phaseB === "object" && !Array.isArray(phaseB)) {
    const status = /** @type {{ status?: unknown }} */ (phaseB).status;
    if (status === "ABORTED") {
      return "skipped (phase B token ABORT)";
    }
  }
  if (report.failure_class === "section8") {
    return "failed";
  }
  if (report.mode === "dry-run") {
    return "preview only (dry-run)";
  }
  return "synced via gate-apply-section8";
}

/**
 * @param {Record<string, unknown>} report
 */
function formatExport(report) {
  const steps = report.steps;
  const line = formatStepLine(steps, "export");
  const det =
    report.deterministic && typeof report.deterministic === "object" && !Array.isArray(report.deterministic)
      ? /** @type {{ export_path?: unknown; export_bytes?: unknown }} */ (report.deterministic)
      : null;
  const path = typeof det?.export_path === "string" ? det.export_path : null;
  const bytes = typeof det?.export_bytes === "number" ? det.export_bytes : null;
  if (path && bytes != null) {
    return `${line} (${bytes} bytes)`;
  }
  return line;
}

/**
 * @param {Record<string, unknown>} report
 */
function formatNotebooklmSummary(report) {
  if (report.mode === "dry-run") {
    return "skipped in dry-run";
  }
  const mode =
    typeof report.notebooklm_fanout_mode === "string" ? report.notebooklm_fanout_mode : "";
  const prefix =
    mode === "drive-sync"
      ? "drive-sync — "
      : mode === "legacy-source-add"
        ? "legacy (deprecated) — "
        : "";
  const targets = Array.isArray(report.notebooklm_targets) ? report.notebooklm_targets : [];
  let ok = 0;
  let failed = 0;
  /** @type {string[]} */
  const errorClasses = [];
  for (const target of targets) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      continue;
    }
    const row = /** @type {{ fanout_status?: unknown; error_class?: unknown }} */ (target);
    if (row.fanout_status === "ok") {
      ok += 1;
    } else if (row.fanout_status === "failed") {
      failed += 1;
      if (typeof row.error_class === "string" && row.error_class) {
        errorClasses.push(row.error_class);
      }
    }
  }
  if (targets.length === 0) {
    return `${prefix}no targets`;
  }
  if (failed === 0 && ok === 0) {
    return `${prefix}${targets.length} target(s) pending fan-out`;
  }
  const parts = [];
  if (ok > 0) {
    parts.push(`${ok} ok`);
  }
  if (failed > 0) {
    const unique = [...new Set(errorClasses)];
    parts.push(`${failed} failed${unique.length ? ` (${unique.join(", ")})` : ""}`);
  }
  return `${prefix}${parts.join(", ")}`;
}

/**
 * @param {unknown} target
 */
function formatNotebooklmTargetLine(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return "- (invalid target row)";
  }
  const row = /** @type {{
    title?: unknown;
    notebook_id?: unknown;
    fanout_status?: unknown;
    error_class?: unknown;
    export_bytes?: unknown;
    http_status?: unknown;
  }} */ (target);
  const title = typeof row.title === "string" && row.title ? row.title : "Untitled";
  const id = typeof row.notebook_id === "string" ? shortNotebookId(row.notebook_id) : "unknown";
  if (row.fanout_status === "failed") {
    const errorClass = typeof row.error_class === "string" ? row.error_class : "unknown";
    const size =
      typeof row.export_bytes === "number"
        ? ` (${Math.round(row.export_bytes / 1024)} KB)`
        : "";
    const http =
      typeof row.http_status === "number" ? `, http_status: ${row.http_status}` : "";
    return `- **${title}** (\`${id}\`): failed — error_class: ${errorClass}${size}${http}`;
  }
  if (row.fanout_status === "ok") {
    return `- **${title}** (\`${id}\`): ok`;
  }
  return `- **${title}** (\`${id}\`): pending`;
}

/**
 * @param {Record<string, unknown>} report
 */
function formatNlmAuth(report) {
  if (report.mode === "dry-run") {
    return "skipped in dry-run";
  }
  const auth = report.nlm_auth;
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
    return "not recorded";
  }
  const row = /** @type {{ status?: unknown; reason?: unknown; message?: unknown; warning?: unknown }} */ (
    auth
  );
  const status = typeof row.status === "string" ? row.status : "unknown";
  const reason = typeof row.reason === "string" ? row.reason : "unknown";
  if (typeof row.warning === "string" && row.warning.trim()) {
    return row.warning.trim();
  }
  const message = typeof row.message === "string" ? row.message : "";
  return `${status} (${reason})${message ? `: ${message}` : ""}`;
}

/**
 * @param {Record<string, unknown>} report
 * @returns {string}
 */
export function renderDiscordReply(report) {
  const steps = report.steps;
  const targets = Array.isArray(report.notebooklm_targets) ? report.notebooklm_targets : [];
  const targetLines =
    targets.length > 0
      ? targets.map((target) => formatNotebooklmTargetLine(target)).join("\n")
      : "- (none)";

  const failureClass =
    report.failure_class == null || report.failure_class === ""
      ? "none"
      : String(report.failure_class);

  return [
    "## Session close complete",
    "",
    `- **mode:** ${report.mode ?? "unknown"}`,
    `- **agents_sync:** ${formatAgentsSync(report)}`,
    `- **export:** ${formatExport(report)}`,
    `- **notebooklm:** ${formatNotebooklmSummary(report)}`,
    `- **vault_fast_scan:** ${formatStepLine(steps, "fast_scan")}`,
    `- **daily_rhythm:** ${formatStepLine(steps, "daily_rhythm")}`,
    `- **nlm_auth:** ${formatNlmAuth(report)}`,
    `- **failure_class:** ${failureClass}`,
    "",
    "### NotebookLM targets",
    "",
    targetLines,
    "",
  ].join("\n");
}

/**
 * @param {string} closeReportPath
 */
export async function renderDiscordReplyFromFile(closeReportPath) {
  const raw = await readFile(closeReportPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("close-report.json must be a JSON object");
  }
  return renderDiscordReply(/** @type {Record<string, unknown>} */ (parsed));
}

async function main() {
  const paths = resolvePaths();
  let closeReportPath = paths.closeReportPath;
  const reportArgIndex = process.argv.indexOf("--report");
  if (reportArgIndex >= 0 && process.argv[reportArgIndex + 1]) {
    closeReportPath = process.argv[reportArgIndex + 1];
  }

  try {
    const reply = await renderDiscordReplyFromFile(closeReportPath);
    process.stdout.write(reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: render-discord-reply failed: ${message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: render-discord-reply failed: ${message}\n`);
    process.exit(1);
  });
}
