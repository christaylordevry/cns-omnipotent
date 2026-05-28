import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { estimateTokens, SECTION8_DRAFT_TOKEN_LIMIT } from "./token-estimate.mjs";

/** @typedef {{ tokens: number; status: "PASSED" }} PhaseBTokenCheckPassed */
/** @typedef {{ tokens: number; status: "ABORTED"; reason: string }} PhaseBTokenCheckAborted */
/** @typedef {PhaseBTokenCheckPassed | PhaseBTokenCheckAborted} PhaseBTokenCheckResult */

export const PHASE_B_ABORT_REASON = `exceeds ${SECTION8_DRAFT_TOKEN_LIMIT} token limit`;

/**
 * @param {string} draftText
 * @returns {PhaseBTokenCheckResult}
 */
export function evaluatePhaseBDraftTokens(draftText) {
  const tokens = estimateTokens(draftText);
  if (tokens > SECTION8_DRAFT_TOKEN_LIMIT) {
    return {
      tokens,
      status: "ABORTED",
      reason: PHASE_B_ABORT_REASON,
    };
  }
  return {
    tokens,
    status: "PASSED",
  };
}

/**
 * @param {PhaseBTokenCheckResult} result
 * @returns {Record<string, unknown>}
 */
function phaseBTokenCheckPayload(result) {
  if (result.status === "PASSED") {
    return { tokens: result.tokens, status: "PASSED" };
  }
  return {
    tokens: result.tokens,
    status: "ABORTED",
    reason: result.reason,
  };
}

/**
 * Merge `phase_b_token_check` into close-report.json (preserve other keys).
 *
 * @param {string} closeReportPath
 * @param {PhaseBTokenCheckResult} result
 */
export async function recordPhaseBTokenCheck(closeReportPath, result) {
  /** @type {Record<string, unknown>} */
  let report = {};
  try {
    const raw = await readFile(closeReportPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      report = /** @type {Record<string, unknown>} */ (parsed);
    }
  } catch {
    // partial close: create or overwrite token-check marker only
  }
  report.phase_b_token_check = phaseBTokenCheckPayload(result);
  await mkdir(dirname(closeReportPath), { recursive: true });
  await writeFile(closeReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
