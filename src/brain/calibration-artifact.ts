import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CalibrationReport } from "./calibration-harness.js";

export type CalibrationArtifactParams = {
  repoRoot: string;
  report: CalibrationReport;
  passDateUtc: string;
  indexPath: string;
  goldenQueriesPath: string;
  operatorWaiver?: {
    reason: string;
    waivedBy: string;
    waivedAtUtc: string;
  };
};

export const CALIBRATION_PASS_ARTIFACT_REL =
  "_bmad-output/implementation-artifacts/79-4-calibration-pass.md";

export function formatCalibrationPassMarkdown(params: CalibrationArtifactParams): string {
  const { report, passDateUtc, indexPath, goldenQueriesPath, operatorWaiver } = params;
  const gateStatus = report.passed
    ? "PASS"
    : operatorWaiver
      ? "SHADOW_WAIVER"
      : "FAIL";

  const lines: string[] = [
    "---",
    `title: "Story 79-4 — Brain recall calibration gate"`,
    `pass_date_utc: "${passDateUtc}"`,
    `policy_version: "${report.policyVersion}"`,
    `shadow_mode: ${report.shadowMode}`,
    `gate_status: ${gateStatus}`,
    "epic_82_gate: true",
    "---",
    "",
    "# Story 79-4: Golden-set calibration pass (Epic 82 gate)",
    "",
    "> **Epic 82 gate:** This artifact documents calibration **PASS** or an explicit **shadow-mode operator waiver** before Story 82-3.",
    "",
    "## Run metadata",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Pass date (UTC) | ${passDateUtc} |`,
    `| Policy version | \`${report.policyVersion}\` |`,
    `| Shadow mode | \`${report.shadowMode}\` |`,
    `| Golden queries | ${report.goldenQueryCount} |`,
    `| Index path | \`${indexPath}\` |`,
    `| Golden set | \`${goldenQueriesPath}\` |`,
    `| Gate status | **${gateStatus}** |`,
    "",
    "## Summary",
    "",
    `- Channel runs: ${report.summary.passedChannelRuns}/${report.summary.totalChannelRuns} passed`,
    `- All queries passed: **${report.passed ? "yes" : "no"}**`,
    `- Token count degraded (estimate fallback): **${report.summary.tokenCountDegraded ? "yes" : "no"}**`,
    "",
  ];

  if (report.summary.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const w of report.summary.warnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  if (operatorWaiver) {
    lines.push(
      "## Operator waiver (shadow mode continue)",
      "",
      `- Waived by: ${operatorWaiver.waivedBy}`,
      `- Waived at (UTC): ${operatorWaiver.waivedAtUtc}`,
      `- Reason: ${operatorWaiver.reason}`,
      "",
    );
  }

  lines.push("## Per-query results", "");

  for (const query of report.results) {
    lines.push(
      `### ${query.queryId}`,
      "",
      `**Prompt:** ${query.prompt}`,
      "",
      `**Token measure:** ${query.tokenMeasureSummary}`,
      "",
    );
    if (query.warnings.length > 0) {
      lines.push("**Query warnings:**");
      for (const w of query.warnings) {
        lines.push(`- ${w}`);
      }
      lines.push("");
    }
    lines.push(
      "| Channel | precision@k | cited | tokens | measure | budget | pass |",
      "|---------|---------------|-------|--------|---------|--------|------|",
    );
    for (const ch of query.channels) {
      const tokenValue = ch.tokensUsedActual !== null ? String(ch.tokensUsedActual) : String(ch.tokensUsedEstimate);
      lines.push(
        `| ${ch.channel} | ${ch.precisionAtK.toFixed(3)} | ${ch.citedPaths.join(", ") || "—"} | ${tokenValue} | ${ch.tokenMeasure} | ${ch.injectionBudget} | ${ch.passed ? "✅" : "❌"} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Re-run triggers",
    "",
    "Re-run calibration when:",
    "",
    "- Embedder model changes",
    "- Corpus ingest delta >20%",
    "- Per-channel policy budgets or thresholds change materially",
    "",
    "## Reversibility (NFR5)",
    "",
    "Revert `config/brain-recall-policy.json` to prior `policy_version` in git; set `shadow_mode: true` until re-calibrated.",
    "",
  );

  return lines.join("\n");
}

export async function writeCalibrationPassArtifact(params: CalibrationArtifactParams): Promise<string> {
  const absPath = path.join(params.repoRoot, CALIBRATION_PASS_ARTIFACT_REL);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, formatCalibrationPassMarkdown(params), "utf8");
  return absPath;
}
