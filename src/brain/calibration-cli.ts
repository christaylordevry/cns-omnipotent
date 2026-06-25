#!/usr/bin/env node
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCalibrationHarness } from "./calibration-harness.js";
import { writeCalibrationPassArtifact } from "./calibration-artifact.js";
import { loadBrainGoldenQueriesFromFile } from "./golden-queries.js";
import { resolveTokenCounterFromEnv } from "./inference-token-counter.js";
import { loadBrainRecallPolicyFromRepo } from "./recall-policy.js";
import { resolveBrainEmbedder } from "./resolve-embedder.js";
import { CnsError } from "../errors.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function safeSingleLine(s: string): string {
  return String(s).split(/\r?\n/, 1)[0]?.trim() ?? "Error";
}

function resolveVaultRoot(): string {
  const fromEnv = process.env.CNS_VAULT_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "index-path": { type: "string" },
      "golden-queries": { type: "string" },
      "repo-root": { type: "string" },
      "vault-root": { type: "string" },
      json: { type: "boolean" },
      "write-artifact": { type: "boolean" },
      "operator-waiver": { type: "string" },
      "waived-by": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(
      [
        "brain:calibrate — FR19 golden-set calibration harness (Story 79-4).",
        "",
        "Usage:",
        "  tsx src/brain/calibration-cli.ts \\",
        "    --index-path <abs-path-to-brain-index.json> \\",
        "    [--golden-queries config/brain-golden-queries.json] \\",
        "    [--write-artifact] \\",
        "    [--operator-waiver \"reason\"] [--waived-by Chris]",
        "",
        "Token counting (actual, not chars/4):",
        "  Set CNS_BRAIN_TOKEN_COUNT_BASE_URL + CNS_BRAIN_TOKEN_COUNT_MODEL",
        "  (Anthropic-compatible POST /v1/messages/count_tokens).",
        "",
        "Shadow mode: set shadow_mode: true in config/brain-recall-policy.json",
        "  — logs would-inject payloads to stderr; context stays empty.",
        "",
        "Exit code 0 when all golden queries pass OR --operator-waiver is set.",
        "",
      ].join("\n"),
    );
    return;
  }

  const repoRoot = values["repo-root"] ? path.resolve(values["repo-root"]) : REPO_ROOT;
  const indexPath = values["index-path"];
  if (!indexPath?.trim()) {
    process.stderr.write("Error: --index-path is required.\n");
    process.exitCode = 1;
    return;
  }

  const goldenQueriesPath = values["golden-queries"]
    ? path.resolve(values["golden-queries"])
    : path.join(repoRoot, "config/brain-golden-queries.json");

  const policy = await loadBrainRecallPolicyFromRepo(repoRoot);
  const goldenQueries = await loadBrainGoldenQueriesFromFile(goldenQueriesPath);
  const countTokens = resolveTokenCounterFromEnv();
  if (!countTokens) {
    process.stderr.write(
      "Warning: CNS_BRAIN_TOKEN_COUNT_* unset — report uses chars/4 estimate only for actual-token column.\n",
    );
  }

  const report = await runCalibrationHarness({
    vaultRoot: values["vault-root"] ? path.resolve(values["vault-root"]) : resolveVaultRoot(),
    indexPath: path.resolve(indexPath),
    policy,
    goldenQueries,
    embedder: resolveBrainEmbedder(),
    countTokens,
    logShadowPayloads: policy.shadow_mode === true,
  });

  if (values.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `Calibration: ${report.passed ? "PASS" : "FAIL"} (policy ${report.policyVersion}, shadow=${report.shadowMode})`,
        `Queries: ${report.goldenQueryCount} | Channel runs: ${report.summary.passedChannelRuns}/${report.summary.totalChannelRuns} passed`,
        report.summary.warnings.length > 0 ? `Warnings: ${report.summary.warnings.length}` : "",
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    for (const q of report.results) {
      const status = q.passed ? "PASS" : "FAIL";
      process.stdout.write(`  [${status}] ${q.queryId} (tokens: ${q.tokenMeasureSummary})\n`);
      for (const ch of q.channels) {
        const tokens =
          ch.tokenMeasure === "actual"
            ? `actual=${ch.tokensUsedActual}`
            : `est=${ch.tokensUsedEstimate}`;
        process.stdout.write(
          `      ${ch.channel}: precision@${ch.k}=${ch.precisionAtK.toFixed(3)} ${tokens}/${ch.injectionBudget} [${ch.tokenMeasure}]\n`,
        );
      }
    }
    if (report.summary.warnings.length > 0) {
      process.stdout.write("\nWarnings:\n");
      for (const w of report.summary.warnings) {
        process.stdout.write(`  - ${w}\n`);
      }
    }
  }

  const waiverReason = values["operator-waiver"]?.trim();
  const waivedBy = values["waived-by"]?.trim() || "operator";
  const passDateUtc = new Date().toISOString();

  if (values["write-artifact"] && (report.passed || waiverReason)) {
    const artifactPath = await writeCalibrationPassArtifact({
      repoRoot,
      report,
      passDateUtc,
      indexPath: path.resolve(indexPath),
      goldenQueriesPath,
      operatorWaiver: waiverReason
        ? { reason: waiverReason, waivedBy, waivedAtUtc: passDateUtc }
        : undefined,
    });
    process.stdout.write(`\nArtifact: ${artifactPath}\n`);
  }

  if (!report.passed && !waiverReason) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  const msg =
    err instanceof CnsError ? safeSingleLine(err.message) : err instanceof Error ? safeSingleLine(err.message) : "Error";
  process.stderr.write(`${msg}\n`);
  process.exitCode = 1;
});
