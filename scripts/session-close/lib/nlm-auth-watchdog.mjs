#!/usr/bin/env node
import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_LOCAL_NLM = "/home/christ/.local/bin/nlm";
const DEFAULT_TIMEOUT_MS = 10_000;
const UNAUTH_RE =
  /\b(unauthenticated|not authenticated|not configured|login required|please login|session expired|auth expired|credentials stale|session stale)\b/i;

/**
 * @typedef {'authenticated' | 'unauthenticated' | 'unknown' | 'skipped'} NlmAuthStatus
 * @typedef {'ok' | 'missing-cli' | 'timeout' | 'unauthenticated' | 'check-failed' | 'skipped-dry-run'} NlmAuthReason
 * @typedef {{ status: NlmAuthStatus; reason: NlmAuthReason; message: string }} NlmAuthResult
 */

/**
 * @param {string} text
 */
export function sanitizeNlmAuthText(text) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:SID|HSID|SSID|APISID|SAPISID|__Secure-[A-Za-z0-9_-]+|NID|AEC|OSID|LSID)=\S+/g, "[redacted-token]")
    .replace(/\b(?:ya29|sk-[A-Za-z0-9_-]*|AIza)[A-Za-z0-9._-]+/g, "[redacted-token]")
    .slice(0, 160);
}

function checkFailedResult() {
  return {
    status: "unknown",
    reason: "check-failed",
    message: "nlm auth check failed",
  };
}

/**
 * @param {string} file
 */
async function isExecutable(file) {
  try {
    await access(file, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} command
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
async function resolveFromPath(command, env) {
  const pathValue = env.PATH ?? "";
  for (const dir of pathValue.split(":")) {
    if (!dir) {
      continue;
    }
    const candidate = join(dir, command);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
 *   localNlmPath?: string;
 * }} [opts]
 */
export async function resolveNlmCommand(opts = {}) {
  const env = opts.env ?? process.env;
  const override = env.NLM_BIN?.trim();
  if (override && (await isExecutable(override))) {
    return override;
  }

  const fromPath = await resolveFromPath("nlm", env);
  if (fromPath) {
    return fromPath;
  }

  const localNlmPath = opts.localNlmPath ?? DEFAULT_LOCAL_NLM;
  if (await isExecutable(localNlmPath)) {
    return localNlmPath;
  }

  return null;
}

/**
 * @param {unknown} err
 */
function errorOutput(err) {
  if (!err || typeof err !== "object") {
    return "";
  }
  const record = /** @type {{ stdout?: unknown; stderr?: unknown }} */ (err);
  return `${typeof record.stdout === "string" ? record.stdout : ""}\n${
    typeof record.stderr === "string" ? record.stderr : ""
  }`;
}

/**
 * @param {unknown} err
 */
function isTimeoutError(err) {
  if (!err || typeof err !== "object") {
    return false;
  }
  const record = /** @type {{ signal?: unknown; killed?: unknown; code?: unknown }} */ (err);
  return record.signal === "SIGTERM" || record.killed === true || record.code === "ETIMEDOUT";
}

/**
 * @param {{
 *   dryRun?: boolean;
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
 *   timeoutMs?: number;
 *   resolveCommand?: () => Promise<string | null>;
 *   runCommand?: (command: string, args: string[], opts: { env: NodeJS.ProcessEnv | Record<string, string | undefined>; timeout: number }) => Promise<{ stdout: string; stderr: string }>;
 * }} [opts]
 * @returns {Promise<NlmAuthResult>}
 */
export async function runNlmAuthWatchdog(opts = {}) {
  if (opts.dryRun) {
    return {
      status: "skipped",
      reason: "skipped-dry-run",
      message: "nlm_auth: skipped in dry-run",
    };
  }

  const env = opts.env ?? process.env;
  const resolveCommand = opts.resolveCommand ?? (() => resolveNlmCommand({ env }));
  const command = await resolveCommand();
  if (!command) {
    return { status: "unknown", reason: "missing-cli", message: "nlm CLI not found" };
  }

  const runCommand =
    opts.runCommand ??
    ((cmd, args, runOpts) =>
      execFileAsync(cmd, args, {
        env: runOpts.env,
        timeout: runOpts.timeout,
        maxBuffer: 256 * 1024,
      }));

  try {
    const { stdout, stderr } = await runCommand(command, ["login", "--check"], {
      env,
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    const output = `${stdout}\n${stderr}`;
    if (UNAUTH_RE.test(output)) {
      return {
        status: "unauthenticated",
        reason: "unauthenticated",
        message: "nlm auth check reported unauthenticated",
      };
    }
    return { status: "authenticated", reason: "ok", message: "nlm auth check passed" };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      /** @type {{ code?: unknown }} */ (err).code === "ENOENT"
    ) {
      return { status: "unknown", reason: "missing-cli", message: "nlm CLI not found" };
    }
    if (isTimeoutError(err)) {
      return { status: "unknown", reason: "timeout", message: "nlm auth check timed out" };
    }
    const output = errorOutput(err);
    if (UNAUTH_RE.test(output)) {
      return {
        status: "unauthenticated",
        reason: "unauthenticated",
        message: "nlm auth check reported unauthenticated",
      };
    }
    return {
      status: "unknown",
      reason: "check-failed",
      message: "nlm auth check failed",
    };
  }
}

/**
 * @param {NlmAuthResult} result
 */
export function formatNlmAuthWarning(result) {
  if (result.status === "authenticated" || result.status === "skipped") {
    return "";
  }
  return `nlm auth warning: ${result.reason}. run nlm login before the next NotebookLM query or sync.`;
}

/**
 * @param {string} reportPath
 * @param {NlmAuthResult} result
 */
export async function mergeNlmAuthIntoCloseReport(reportPath, result) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.nlm_auth = {
    ...result,
    warning: formatNlmAuthWarning(result) || null,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  const dryRun = argv.includes("--dry-run");
  const reportIndex = argv.indexOf("--report");
  const repoRoot = process.env.OMNIPOTENT_REPO || process.cwd();
  return {
    dryRun,
    reportPath:
      reportIndex >= 0 && argv[reportIndex + 1]
        ? argv[reportIndex + 1]
        : join(repoRoot, ".session-close", "close-report.json"),
  };
}

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  let result;
  try {
    result = await runNlmAuthWatchdog({ dryRun: opts.dryRun });
  } catch {
    result = checkFailedResult();
  }

  let output = {
    ...result,
    warning: formatNlmAuthWarning(result) || null,
  };
  try {
    const report = await mergeNlmAuthIntoCloseReport(opts.reportPath, result);
    output = report.nlm_auth;
  } catch {
    process.stderr.write(
      "session-close: nlm auth watchdog could not update close-report.json; continuing\n",
    );
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => {
    const result = checkFailedResult();
    process.stderr.write("session-close: nlm auth watchdog failed; continuing\n");
    process.stdout.write(
      `${JSON.stringify({ ...result, warning: formatNlmAuthWarning(result) })}\n`,
    );
    process.exit(0);
  });
}
