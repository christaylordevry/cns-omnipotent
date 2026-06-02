import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { parseAgentsSection8, parseDevelopmentStatus, readVaultLintSummary } from "./read-sources.mjs";

// MEMORY_MD_PATH — optional override for Hermes memory file (default ~/.hermes/memories/MEMORY.md).
// Operator sets in shell env or Hermes service environment; session-close does not write .env files.

export const MEMORY_FILE_CHAR_LIMIT = 2200;
const CNS_STATE_HEADING = "## CNS State";
const EPIC_KEY_RE = /^epic-(\d+)$/;
const PRIOR_FANOUT_UNKNOWN = "unknown";

/**
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
function truncateUtf8ToByteLimit(text, limit) {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= limit) {
    return text;
  }
  let end = limit;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return buf.subarray(0, end).toString("utf8");
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function resolveMemoryMdPath(env = process.env) {
  const override = env.MEMORY_MD_PATH?.trim();
  if (override) {
    return override;
  }
  return join(homedir(), ".hermes", "memories", "MEMORY.md");
}

/**
 * @param {{ key: string, status: string }[]} entries
 * @returns {string[]}
 */
export function collectInProgressEpicNumbers(entries) {
  const nums = [];
  for (const { key, status } of entries) {
    const m = key.match(EPIC_KEY_RE);
    if (m && status === "in-progress") {
      nums.push(m[1]);
    }
  }
  return nums;
}

/**
 * @param {unknown[]} targets
 * @returns {string}
 */
export function formatPriorFanoutSummary(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return PRIOR_FANOUT_UNKNOWN;
  }
  let ok = 0;
  let failed = 0;
  /** @type {string | null} */
  let firstFailure = null;
  for (const target of targets) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      continue;
    }
    const record = /** @type {{ fanout_status?: unknown; error_class?: unknown; title?: unknown }} */ (
      target
    );
    if (record.fanout_status === "ok") {
      ok += 1;
      continue;
    }
    if (record.fanout_status === "failed") {
      failed += 1;
      if (!firstFailure) {
        const errClass =
          typeof record.error_class === "string" ? record.error_class : "error";
        const title = typeof record.title === "string" ? record.title : "?";
        firstFailure = `${errClass}: ${title}`;
      }
    }
  }
  const total = targets.length;
  if (failed === 0) {
    return `${ok}/${total} ok`;
  }
  const detail = firstFailure ?? "failed";
  return `${ok}/${total} ok; ${failed} failed (${detail})`;
}

/**
 * @param {string} memoryText
 * @param {string} newBlock includes ## CNS State heading
 * @returns {string}
 */
export function replaceCnsStateInMemory(memoryText, newBlock) {
  const block = newBlock.endsWith("\n") ? newBlock : `${newBlock}\n`;
  const start = memoryText.indexOf(CNS_STATE_HEADING);
  if (start === -1) {
    const prefix = memoryText.length > 0 && !memoryText.endsWith("\n") ? "\n" : "";
    return memoryText.length === 0 ? block : `${block}${prefix}${memoryText}`;
  }

  let regionEnd = memoryText.length;
  const afterHeading = memoryText.indexOf("\n", start);
  const searchFrom = afterHeading === -1 ? start + CNS_STATE_HEADING.length : afterHeading + 1;
  const nextHeading = memoryText.indexOf("\n## ", searchFrom);
  if (nextHeading !== -1) {
    regionEnd = nextHeading + 1;
  }

  const before = memoryText.slice(0, start);
  const after = memoryText.slice(regionEnd);
  return `${before}${block}${after}`;
}

/**
 * @param {string} memoryText
 * @param {number} limit
 * @returns {string}
 */
export function enforceMemoryFileCharLimit(memoryText, limit = MEMORY_FILE_CHAR_LIMIT) {
  if (Buffer.byteLength(memoryText, "utf8") <= limit) {
    return memoryText;
  }

  const start = memoryText.indexOf(CNS_STATE_HEADING);
  if (start === -1) {
    const firstH2 = memoryText.indexOf("\n## ");
    if (firstH2 === -1) {
      return truncateUtf8ToByteLimit(memoryText, limit);
    }
    const tail = memoryText.slice(firstH2 + 1);
    const head = memoryText.slice(0, firstH2 + 1);
    const tailBytes = Buffer.byteLength(tail, "utf8");
    if (tailBytes >= limit) {
      return tail;
    }
    return truncateUtf8ToByteLimit(head, limit - tailBytes) + tail;
  }

  let regionEnd = memoryText.length;
  const afterHeading = memoryText.indexOf("\n", start);
  const searchFrom = afterHeading === -1 ? start + CNS_STATE_HEADING.length : afterHeading + 1;
  const nextHeading = memoryText.indexOf("\n## ", searchFrom);
  if (nextHeading !== -1) {
    regionEnd = nextHeading + 1;
  }

  const before = memoryText.slice(0, start);
  const after = memoryText.slice(regionEnd);
  const suffix = "[truncated]";
  const overhead = Buffer.byteLength(`${before}${after}`, "utf8");
  let bodyBudget = limit - overhead - Buffer.byteLength(`\n${suffix}\n`, "utf8");
  if (bodyBudget < CNS_STATE_HEADING.length) {
    bodyBudget = CNS_STATE_HEADING.length;
  }

  let body = memoryText.slice(start, regionEnd).trimEnd();
  while (Buffer.byteLength(body, "utf8") > bodyBudget && body.length > CNS_STATE_HEADING.length) {
    body = truncateUtf8ToByteLimit(body, Buffer.byteLength(body, "utf8") - 1);
  }
  if (!body.includes(suffix)) {
    body = `${body}\n${suffix}`;
  }
  const block = body.endsWith("\n") ? body : `${body}\n`;
  let merged = `${before}${block}${after}`;
  while (Buffer.byteLength(merged, "utf8") > limit && body.length > CNS_STATE_HEADING.length) {
    body = body.slice(0, -suffix.length - 2);
    const trimmed = `${body}\n${suffix}\n`;
    merged = `${before}${trimmed}${after}`;
  }
  return merged;
}

/**
 * @param {{
 *   closedAt: string;
 *   agentsVersion: string | null;
 *   failureClass: string | null;
 *   epicNumbers: string[];
 *   testsLine: string;
 *   vaultHealth: string;
 *   priorFanoutSummary: string;
 * }} input
 */
export function buildCnsStateBlock(input) {
  const version = input.agentsVersion ? `v${input.agentsVersion}` : "vunknown";
  const failure =
    input.failureClass && input.failureClass.length > 0 ? input.failureClass : "none";
  const epics =
    input.epicNumbers.length > 0
      ? `${input.epicNumbers.join(", ")} in-progress`
      : "none in-progress";
  const tests = input.testsLine?.trim() || "unknown";
  const fanout = input.priorFanoutSummary?.trim() || PRIOR_FANOUT_UNKNOWN;

  return `## CNS State (auto — /session-close)
Closed: ${input.closedAt} | AGENTS ${version} | failure_class: ${failure}
Epics: ${epics} | Tests: ${tests}
Vault: ${input.vaultHealth}
Fan-out (prev): ${fanout}
`;
}

/**
 * @param {Record<string, unknown>} report
 */
function readCloseReportFields(report) {
  const steps =
    report.steps && typeof report.steps === "object" && !Array.isArray(report.steps)
      ? /** @type {Record<string, { message?: unknown }>} */ (report.steps)
      : {};
  const testsStep = steps.tests;
  const testsMessage =
    testsStep && typeof testsStep.message === "string" ? testsStep.message : null;

  const deterministic =
    report.deterministic &&
    typeof report.deterministic === "object" &&
    !Array.isArray(report.deterministic)
      ? /** @type {Record<string, unknown>} */ (report.deterministic)
      : {};

  const testsDeterministic =
    typeof deterministic.tests === "string" ? deterministic.tests : null;

  const priorFanout =
    typeof deterministic.prior_fanout_summary === "string"
      ? deterministic.prior_fanout_summary
      : null;

  const generatedAt =
    typeof report.generated_at === "string" ? report.generated_at : null;
  const failureClass =
    typeof report.failure_class === "string" ? report.failure_class : null;

  return {
    testsLine: testsMessage ?? testsDeterministic ?? "unknown",
    priorFanoutSummary: priorFanout ?? PRIOR_FANOUT_UNKNOWN,
    generatedAt,
    failureClass,
  };
}

/**
 * @param {string} closeReportPath
 * @param {{ status: string; message: string }} result
 */
export async function recordMemoryUpdateStep(closeReportPath, result) {
  /** @type {Record<string, unknown>} */
  let report = {};
  try {
    const raw = await readFile(closeReportPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      report = parsed;
    }
  } catch {
    // merge into partial report
  }
  const steps =
    report.steps && typeof report.steps === "object" && !Array.isArray(report.steps)
      ? /** @type {Record<string, unknown>} */ (report.steps)
      : {};
  steps.memory_update = { status: result.status, message: result.message };
  report.steps = steps;
  await mkdir(dirname(closeReportPath), { recursive: true });
  await writeFile(closeReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

/**
 * @param {{
 *   dryRun?: boolean;
 *   repoRoot: string;
 *   vaultRoot: string;
 *   closeReportPath: string;
 *   agentsPath?: string;
 *   sprintPath?: string;
 *   memoryMdPath?: string;
 *   env?: NodeJS.ProcessEnv;
 * }} opts
 */
export async function runMemoryUpdate(opts) {
  const env = opts.env ?? process.env;
  const memoryPath = opts.memoryMdPath ?? resolveMemoryMdPath(env);
  const closeReportPath = opts.closeReportPath;

  if (!memoryPath.trim()) {
    process.stderr.write("memory_update: skipped\n");
    const result = { status: "skipped", message: "memory_update: skipped", charCount: null };
    if (!opts.dryRun) {
      await recordMemoryUpdateStep(closeReportPath, result);
    }
    return result;
  }

  let parentExists = true;
  try {
    await access(dirname(memoryPath));
  } catch {
    parentExists = false;
  }
  if (!parentExists) {
    process.stderr.write("memory_update: skipped\n");
    const result = { status: "skipped", message: "memory_update: skipped", charCount: null };
    if (!opts.dryRun) {
      await recordMemoryUpdateStep(closeReportPath, result);
    }
    return result;
  }

  let memoryText;
  try {
    memoryText = await readFile(memoryPath, "utf8");
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      process.stderr.write("memory_update: skipped\n");
      const result = { status: "skipped", message: "memory_update: skipped", charCount: null };
      if (!opts.dryRun) {
        await recordMemoryUpdateStep(closeReportPath, result);
      }
      return result;
    }
    throw err;
  }

  /** @type {Record<string, unknown>} */
  let report = {};
  try {
    const raw = await readFile(closeReportPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      report = parsed;
    }
  } catch {
    // proceed with defaults
  }

  const reportFields = readCloseReportFields(report);
  const closedAt = reportFields.generatedAt ?? new Date().toISOString();

  const agentsPath =
    opts.agentsPath ?? join(opts.repoRoot, "specs/cns-vault-contract/AGENTS.md");
  const sprintPath =
    opts.sprintPath ??
    join(opts.repoRoot, "_bmad-output", "implementation-artifacts", "sprint-status.yaml");

  let agentsText;
  let sprintYaml;
  let vaultLint;
  try {
    [agentsText, sprintYaml, vaultLint] = await Promise.all([
      readFile(agentsPath, "utf8"),
      readFile(sprintPath, "utf8"),
      readVaultLintSummary(opts.vaultRoot),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = {
      status: "failed",
      message: `memory_update: failed (${message})`,
      charCount: null,
    };
    if (!opts.dryRun) {
      await recordMemoryUpdateStep(closeReportPath, result);
    }
    return result;
  }

  const { version } = parseAgentsSection8(agentsText);
  const entries = parseDevelopmentStatus(sprintYaml);
  const epicNumbers = collectInProgressEpicNumbers(entries);

  let vaultHealth = `${vaultLint.clean}/${vaultLint.scanned} clean — ERRORS: ${vaultLint.errors}, WARNINGS: ${vaultLint.warnings}`;
  if (vaultLint.stale) {
    vaultHealth += " — STALE REPORT (>7d); run /vault-lint";
  }

  const newBlock = buildCnsStateBlock({
    closedAt,
    agentsVersion: version,
    failureClass: reportFields.failureClass,
    epicNumbers,
    testsLine: reportFields.testsLine,
    vaultHealth,
    priorFanoutSummary: reportFields.priorFanoutSummary,
  });

  let merged = replaceCnsStateInMemory(memoryText, newBlock);
  merged = enforceMemoryFileCharLimit(merged);

  const charCount = Buffer.byteLength(merged, "utf8");

  if (opts.dryRun) {
    return {
      status: "skipped",
      message: "memory_update: skipped (dry-run)",
      charCount,
      preview: merged,
    };
  }

  try {
    await writeFile(memoryPath, merged, "utf8");
    const result = {
      status: "ok",
      message: `memory_update: ok (${charCount} chars)`,
      charCount,
    };
    await recordMemoryUpdateStep(closeReportPath, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = {
      status: "failed",
      message: `memory_update: failed (${message})`,
      charCount: null,
    };
    await recordMemoryUpdateStep(closeReportPath, result);
    return result;
  }
}
