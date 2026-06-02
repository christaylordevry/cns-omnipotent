#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  overwriteGoogleDocContent,
  readExportMarkdown,
} from "./lib/google-drive-doc-write.mjs";
import {
  hasGoogleOAuthCredentials,
  readNotebooklmDriveDocId,
  readSessionCloseEnvVar,
} from "./lib/load-session-close-env.mjs";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} reportPath
 * @param {{ status: string; message: string }} driveWrite
 */
async function patchCloseReportDriveWrite(reportPath, driveWrite) {
  let report;
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `session-close: write-vault-export-to-drive could not read close-report: ${message}; continuing\n`,
    );
    process.exit(0);
  }
  if (!isObject(report)) {
    process.stderr.write(
      "session-close: write-vault-export-to-drive close-report invalid; continuing\n",
    );
    process.exit(0);
  }
  const steps = isObject(report.steps) ? { ...report.steps } : {};
  steps.drive_write = driveWrite;
  report.steps = steps;
  report.notebooklm_fanout_mode = "drive-sync";
  report.legacy_fanout_deprecation = false;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  const repoRoot = process.env.OMNIPOTENT_REPO || process.cwd();
  const reportIndex = argv.indexOf("--report");
  const exportIndex = argv.indexOf("--export-path");
  const docIndex = argv.indexOf("--doc-id");
  return {
    reportPath:
      reportIndex >= 0 && argv[reportIndex + 1]
        ? argv[reportIndex + 1]
        : join(repoRoot, ".session-close", "close-report.json"),
    exportPath:
      exportIndex >= 0 && argv[exportIndex + 1]
        ? argv[exportIndex + 1]
        : join(repoRoot, "scripts/output/vault-export-for-notebooklm.md"),
    docId: docIndex >= 0 ? argv[docIndex + 1] : undefined,
  };
}

export async function runWriteVaultExportToDrive(opts = {}) {
  const reportPath = opts.reportPath ?? join(process.env.OMNIPOTENT_REPO || process.cwd(), ".session-close", "close-report.json");
  const exportPath =
    opts.exportPath ??
    join(process.env.OMNIPOTENT_REPO || process.cwd(), "scripts/output/vault-export-for-notebooklm.md");
  const docId = opts.docId ?? (await readNotebooklmDriveDocId({ env: opts.env }));

  if (!docId) {
    return { ok: false, skipped: true, reason: "missing-doc-id", message: "NOTEBOOKLM_DRIVE_DOC_ID not set" };
  }

  const oauthReady = await hasGoogleOAuthCredentials({ env: opts.env });
  if (!oauthReady) {
    process.stderr.write(
      "session-close: GOOGLE_OAUTH_SETUP_REQUIRED — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in ~/.hermes/session-close.env\n",
    );
    return {
      ok: false,
      skipped: true,
      reason: "oauth-setup-required",
      message: "Google OAuth credentials missing",
    };
  }

  const [clientId, clientSecret, refreshToken] = await Promise.all([
    readSessionCloseEnvVar("GOOGLE_CLIENT_ID", { env: opts.env }),
    readSessionCloseEnvVar("GOOGLE_CLIENT_SECRET", { env: opts.env }),
    readSessionCloseEnvVar("GOOGLE_REFRESH_TOKEN", { env: opts.env }),
  ]);

  let markdown;
  try {
    markdown = await readExportMarkdown(exportPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const driveWrite = { status: "failed", message: `export read failed: ${message}` };
    await patchCloseReportDriveWrite(reportPath, driveWrite);
    return { ok: false, reason: "export-read", message: driveWrite.message };
  }

  try {
    await overwriteGoogleDocContent({
      documentId: docId,
      text: markdown,
      clientId,
      clientSecret,
      refreshToken,
      fetchFn: opts.fetchFn,
    });
    const driveWrite = { status: "ok", message: "drive doc overwritten" };
    await patchCloseReportDriveWrite(reportPath, driveWrite);
    return { ok: true, message: driveWrite.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const driveWrite = { status: "failed", message: message.slice(0, 240) };
    await patchCloseReportDriveWrite(reportPath, driveWrite);
    return { ok: false, reason: "drive-write", message: driveWrite.message };
  }
}

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  const result = await runWriteVaultExportToDrive(opts);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.skipped) {
    process.exit(0);
  }
  if (!result.ok) {
    process.stderr.write(`session-close: drive write failed: ${result.message}; continuing\n`);
    process.exit(0);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: write-vault-export-to-drive failed: ${message}; continuing\n`);
    process.stdout.write(`${JSON.stringify({ ok: false, message })}\n`);
    process.exit(0);
  });
}
