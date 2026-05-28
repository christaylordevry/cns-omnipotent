import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const PHASE_A_REQUIRED_PACK_KEYS = [
  "generated_at",
  "mode",
  "repo_root",
  "vault_root",
  "agents",
  "sprint",
  "recent_stories",
  "deterministic",
  "notebooklm_targets",
  "token_budget",
];

/** @typedef {"PASSED" | "INCOMPLETE" | "FAILED"} PhaseACompletionStatus */
/**
 * @typedef {{
 *   status: PhaseACompletionStatus;
 *   reasons: string[];
 *   report?: Record<string, unknown>;
 *   pack?: Record<string, unknown>;
 * }} PhaseACompletionResult
 */

/**
 * @param {string} path
 */
async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate Phase A artifacts before Phase B may run.
 *
 * Known limit: does not check `generated_at` freshness. If Hermes skips Phase A but
 * leaves prior `.session-close/` artifacts that still pass key/shape checks, this gate
 * returns PASSED without re-running Phase A. Retry in `ensurePhaseAComplete` only runs
 * when status is INCOMPLETE (missing files or required pack keys), not for stale packs.
 *
 * @param {{ contextPackPath: string; closeReportPath: string }} opts
 * @returns {Promise<PhaseACompletionResult>}
 */
export async function evaluatePhaseACompletion(opts) {
  /** @type {string[]} */
  const reasons = [];
  /** @type {Record<string, unknown> | undefined} */
  let pack;
  /** @type {Record<string, unknown> | undefined} */
  let report;

  const packExists = await pathExists(opts.contextPackPath);
  const reportExists = await pathExists(opts.closeReportPath);

  if (!packExists) {
    reasons.push(`context-pack.json missing: ${opts.contextPackPath}`);
  } else {
    try {
      const parsed = JSON.parse(await readFile(opts.contextPackPath, "utf8"));
      if (!isPlainObject(parsed)) {
        reasons.push("context-pack.json is not a JSON object");
      } else {
        pack = parsed;
        for (const key of PHASE_A_REQUIRED_PACK_KEYS) {
          if (!(key in pack)) {
            reasons.push(`context-pack.json missing required key: ${key}`);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reasons.push(`context-pack.json unreadable: ${message}`);
    }
  }

  if (!reportExists) {
    reasons.push(`close-report.json missing: ${opts.closeReportPath}`);
  } else {
    try {
      const parsed = JSON.parse(await readFile(opts.closeReportPath, "utf8"));
      if (!isPlainObject(parsed)) {
        reasons.push("close-report.json is not a JSON object");
      } else {
        report = parsed;
        const steps = report.steps;
        if (!isPlainObject(steps)) {
          reasons.push("close-report.json missing steps object");
        } else {
          const prepare = steps.prepare_context;
          if (!isPlainObject(prepare)) {
            reasons.push("close-report.json missing steps.prepare_context");
          } else if (prepare.status !== "ok") {
            reasons.push(
              `steps.prepare_context status is "${String(prepare.status)}", expected "ok"`,
            );
          }
        }
        if (report.failure_class === "pipeline") {
          reasons.push('close-report.json failure_class is "pipeline"');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reasons.push(`close-report.json unreadable: ${message}`);
    }
  }

  if (reasons.length === 0) {
    return { status: "PASSED", reasons: [], report, pack };
  }

  const incomplete =
    !packExists ||
    !reportExists ||
    reasons.some((r) => r.startsWith("context-pack.json missing required key:"));

  return {
    status: incomplete ? "INCOMPLETE" : "FAILED",
    reasons,
    report,
    pack,
  };
}

/**
 * @param {PhaseACompletionResult} result
 */
export function formatPhaseAGateError(result) {
  const headline =
    result.status === "INCOMPLETE"
      ? "Phase A incomplete: context-pack or close-report missing required artifacts"
      : "Phase A failed: cannot proceed to Phase B";
  return `${headline}. ${result.reasons.join("; ")}`;
}

/**
 * Merge `phase_a_gate` into close-report.json (preserve other keys).
 *
 * @param {string} closeReportPath
 * @param {PhaseACompletionResult} result
 */
export async function recordPhaseAGateFailure(closeReportPath, result) {
  /** @type {Record<string, unknown>} */
  let report = {};
  try {
    const raw = await readFile(closeReportPath, "utf8");
    const parsed = JSON.parse(raw);
    if (isPlainObject(parsed)) {
      report = parsed;
    }
  } catch {
    // partial close: create or overwrite gate marker only
  }

  report.phase_a_gate = {
    status: "ABORTED",
    phase_a_status: result.status,
    reasons: result.reasons,
  };
  if (!report.failure_class) {
    report.failure_class = "pipeline";
  }

  await mkdir(dirname(closeReportPath), { recursive: true });
  await writeFile(closeReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
