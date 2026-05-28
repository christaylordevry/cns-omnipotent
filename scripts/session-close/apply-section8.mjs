#!/usr/bin/env node
/**
 * Apply LLM section8-draft.md to AGENTS.md (FR-18 / SC-4).
 *
 * Draft convention: fragment only (subsections under §8; no `## 8.` heading).
 * The script adds `## 8. Current Focus`, bumps patch version, inserts changelog row,
 * and byte-syncs specs mirror + vault canonical copy.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { applySection8ToAgentsText } from "./lib/apply-section8-body.mjs";
import { loadContextPackIfPresent } from "./lib/load-context-pack.mjs";
import { resolvePaths } from "./lib/paths.mjs";
import { estimateTokens, SECTION8_DRAFT_TOKEN_LIMIT } from "./lib/token-estimate.mjs";

const DEFAULT_CHANGELOG_FROM_PACK =
  "Section 8 applied via session-close apply-section8.mjs; current focus from context pack.";

/**
 * @param {string[]} argv
 */
export function parseApplySection8Argv(argv) {
  const dryRun = argv.includes("--dry-run");
  let draftPath = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--draft" && argv[i + 1]) {
      draftPath = argv[++i];
      continue;
    }
  }
  return { dryRun, draftPath };
}

/**
 * @param {string} closeReportPath
 * @param {string} message
 */
export async function recordSection8Failure(closeReportPath, message) {
  /** @type {Record<string, unknown>} */
  let report = {};
  try {
    const raw = await readFile(closeReportPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      report = parsed;
    }
  } catch {
    // partial close: create or overwrite failure marker
  }
  report.failure_class = "section8";
  const steps =
    report.steps && typeof report.steps === "object" && !Array.isArray(report.steps)
      ? /** @type {Record<string, unknown>} */ (report.steps)
      : {};
  steps.section8 = { status: "failed", message };
  report.steps = steps;
  await mkdir(dirname(closeReportPath), { recursive: true });
  await writeFile(closeReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

/**
 * @param {Record<string, unknown> | null} pack
 * @returns {string | undefined}
 */
function changelogMessageFromPack(pack) {
  const agents = pack?.agents;
  if (!agents || typeof agents !== "object") {
    return undefined;
  }
  const anchor = /** @type {{ changelog_anchor_row?: unknown }} */ (agents).changelog_anchor_row;
  if (typeof anchor === "string" && anchor.trim()) {
    const cells = anchor
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length >= 3) {
      return cells.slice(2).join(" | ");
    }
  }
  return DEFAULT_CHANGELOG_FROM_PACK;
}

/**
 * @param {{
 *   draftPath: string;
 *   dryRun?: boolean;
 *   repoRoot?: string;
 *   vaultRoot?: string;
 *   contextPackPath?: string;
 *   contextPack?: Record<string, unknown> | null;
 *   dateStr?: string;
 * }} opts
 */
export async function runApplySection8(opts) {
  const dryRun = Boolean(opts.dryRun);
  const paths = resolvePaths({
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
  });

  let draftRaw;
  try {
    draftRaw = await readFile(opts.draftPath, "utf8");
  } catch (err) {
    const message = `could not read draft: ${opts.draftPath}`;
    if (!dryRun) {
      await recordSection8Failure(paths.closeReportPath, message);
    }
    throw new Error(message, { cause: err });
  }

  const draftTokens = estimateTokens(draftRaw);
  if (draftTokens > SECTION8_DRAFT_TOKEN_LIMIT) {
    const message = `section8 draft exceeds ${SECTION8_DRAFT_TOKEN_LIMIT} tokens (${draftTokens} estimated); refusing to mutate AGENTS`;
    if (!dryRun) {
      await recordSection8Failure(paths.closeReportPath, message);
    }
    throw new Error(message);
  }

  const contextPackPath = opts.contextPackPath ?? paths.contextPackPath;
  const pack =
    opts.contextPack ?? (await loadContextPackIfPresent(contextPackPath));
  const changelogMessage = changelogMessageFromPack(pack);

  const sourceAgentsPath = paths.repoAgentsPath;
  let agentsText;
  try {
    agentsText = await readFile(sourceAgentsPath, "utf8");
  } catch {
    agentsText = await readFile(paths.agentsPath, "utf8");
  }

  const { text: patched, newVersion, changelogRow } = applySection8ToAgentsText(
    agentsText,
    draftRaw,
    {
      dateStr: opts.dateStr,
      changelogMessage,
    },
  );

  const targets = [
    { label: "repo", path: paths.repoAgentsPath },
    { label: "vault", path: paths.agentsPath },
  ];

  if (dryRun) {
    const previewPath = join(paths.sessionCloseDir, "section8-apply-preview.md");
    await mkdir(paths.sessionCloseDir, { recursive: true });
    await writeFile(previewPath, patched, "utf8");
    return {
      dryRun: true,
      newVersion,
      changelogRow,
      previewPath,
      targets: targets.map((t) => t.path),
      written: false,
    };
  }

  /** @type {Map<string, string>} */
  const snapshots = new Map();
  for (const { path: targetPath } of targets) {
    try {
      snapshots.set(targetPath, await readFile(targetPath, "utf8"));
    } catch {
      // target may not exist yet in isolated fixtures
    }
  }

  const writtenPaths = [];
  try {
    for (const { path: targetPath } of targets) {
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, patched, "utf8");
      writtenPaths.push(targetPath);
    }
  } catch (err) {
    for (const targetPath of writtenPaths) {
      const prior = snapshots.get(targetPath);
      if (prior !== undefined) {
        try {
          await writeFile(targetPath, prior, "utf8");
        } catch {
          // best-effort rollback; original error is still thrown
        }
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    await recordSection8Failure(paths.closeReportPath, message);
    throw err;
  }

  return {
    dryRun: false,
    newVersion,
    changelogRow,
    targets: targets.map((t) => t.path),
    written: true,
    bytes: Buffer.byteLength(patched, "utf8"),
  };
}

async function main() {
  const { dryRun, draftPath } = parseApplySection8Argv(process.argv);
  if (!draftPath) {
    process.stderr.write(
      "usage: node scripts/session-close/apply-section8.mjs --draft <path> [--dry-run]\n",
    );
    process.exit(1);
  }

  try {
    const result = await runApplySection8({ draftPath, dryRun });
    if (result.dryRun) {
      process.stdout.write(
        `session-close: §8 apply preview (dry-run) v${result.newVersion} → ${result.previewPath}\n`,
      );
    } else {
      process.stdout.write(
        `session-close: §8 applied v${result.newVersion} (${result.bytes} bytes) → ${result.targets.join(", ")}\n`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close apply-section8: ${message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
