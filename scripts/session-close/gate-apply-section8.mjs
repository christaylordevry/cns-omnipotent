#!/usr/bin/env node
/**
 * Phase B pre-apply token gate: evaluate section8-draft.md, record close-report check,
 * then delegate to apply-section8.mjs only when PASSED.
 */
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseApplySection8Argv, runApplySection8 } from "./apply-section8.mjs";
import { evaluatePhaseBDraftTokens, recordPhaseBTokenCheck } from "./lib/phase-b-token-gate.mjs";
import { resolvePaths } from "./lib/paths.mjs";
import { SECTION8_DRAFT_TOKEN_LIMIT } from "./lib/token-estimate.mjs";

/**
 * Resolve `--draft` relative to OMNIPOTENT_REPO (not process cwd).
 *
 * @param {string} draftPath
 * @param {string} repoRoot
 */
export function resolveGateDraftPath(draftPath, repoRoot) {
  if (isAbsolute(draftPath)) {
    return draftPath;
  }
  return join(repoRoot, draftPath);
}

/**
 * @param {{
 *   draftPath: string;
 *   dryRun?: boolean;
 *   repoRoot?: string;
 *   vaultRoot?: string;
 *   closeReportPath?: string;
 *   contextPackPath?: string;
 *   contextPack?: Record<string, unknown> | null;
 *   dateStr?: string;
 * }} opts
 */
export async function runGateApplySection8(opts) {
  const paths = resolvePaths({
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
  });
  const closeReportPath = opts.closeReportPath ?? paths.closeReportPath;
  const draftPath = resolveGateDraftPath(opts.draftPath, paths.repoRoot);

  let draftRaw;
  try {
    draftRaw = await readFile(draftPath, "utf8");
  } catch (err) {
    const message = `could not read draft: ${draftPath}`;
    throw new Error(message, { cause: err });
  }

  const check = evaluatePhaseBDraftTokens(draftRaw);
  await recordPhaseBTokenCheck(closeReportPath, check);

  if (check.status === "ABORTED") {
    return {
      check,
      applied: false,
    };
  }

  const applyResult = await runApplySection8({
    draftPath,
    dryRun: opts.dryRun,
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
    contextPackPath: opts.contextPackPath,
    contextPack: opts.contextPack,
    dateStr: opts.dateStr,
  });

  return {
    check,
    applied: true,
    applyResult,
  };
}

async function main() {
  const { dryRun, draftPath } = parseApplySection8Argv(process.argv);
  if (!draftPath) {
    process.stderr.write(
      "usage: node scripts/session-close/gate-apply-section8.mjs --draft <path> [--dry-run]\n",
    );
    process.exit(1);
  }

  try {
    const result = await runGateApplySection8({ draftPath, dryRun });
    if (result.check.status === "ABORTED") {
      process.stderr.write(
        `session-close: phase B token check ABORTED (${result.check.tokens} tokens > ${SECTION8_DRAFT_TOKEN_LIMIT}); apply-section8 skipped\n`,
      );
      process.exit(1);
    }

    const apply = result.applyResult;
    if (apply?.dryRun) {
      process.stdout.write(
        `session-close: phase B token check PASSED (${result.check.tokens} tokens); §8 apply preview (dry-run) v${apply.newVersion} → ${apply.previewPath}\n`,
      );
    } else if (apply) {
      process.stdout.write(
        `session-close: phase B token check PASSED (${result.check.tokens} tokens); §8 applied v${apply.newVersion} (${apply.bytes} bytes) → ${apply.targets.join(", ")}\n`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close gate-apply-section8: ${message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
