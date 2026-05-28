#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolvePaths } from "./lib/paths.mjs";
import {
  parseAgentsSection8,
  readHermesProviderLine,
  readNotebookLmTargets,
  readSprintSnapshot,
  readVaultLintSummary,
  selectRecentStories,
} from "./lib/read-sources.mjs";
import { enforceTokenBudget, PACK_TOKEN_LIMIT } from "./lib/token-estimate.mjs";

/**
 * @param {{ dryRun?: boolean, repoRoot?: string, vaultRoot?: string }} opts
 */
export async function buildContextPack(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const paths = resolvePaths({
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
  });

  const agentsText = await readFile(paths.agentsPath, "utf8");
  const { version, section8, changelogAnchorRow } = parseAgentsSection8(agentsText);
  const sprint = await readSprintSnapshot(paths.sprintPath, paths.repoRoot);
  const recent_stories = await selectRecentStories(paths.artifactsDir, 3);
  const vault_lint = await readVaultLintSummary(paths.vaultRoot);
  const hermes_provider = await readHermesProviderLine();

  const exportPath = join(paths.repoRoot, "scripts/output/vault-export-for-notebooklm.md");
  const notebooklm_targets = await readNotebookLmTargets(paths.vaultRoot, exportPath);

  /** @type {Record<string, unknown>} */
  const pack = {
    generated_at: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "real",
    repo_root: paths.repoRoot,
    vault_root: paths.vaultRoot,
    agents: {
      version,
      section8_excerpt: section8,
      changelog_anchor_row: changelogAnchorRow,
    },
    sprint,
    recent_stories,
    deterministic: {
      export_path: exportPath,
      export_bytes: null,
      fast_scan_rows: null,
      tests: null,
      vault_lint,
      hermes_provider,
    },
    notebooklm_targets,
    token_budget: {
      pack_tokens: 0,
      pack_limit: PACK_TOKEN_LIMIT,
    },
  };

  return enforceTokenBudget(pack, PACK_TOKEN_LIMIT);
}

/**
 * @param {Record<string, unknown>} pack
 * @param {string} outputPath
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function writeContextPack(pack, outputPath, opts = {}) {
  if (opts.dryRun) {
    return pack;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  return pack;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");

  try {
    const paths = resolvePaths();
    const pack = await buildContextPack({ dryRun });
    await writeContextPack(pack, paths.contextPackPath, { dryRun });
    const dest = dryRun ? "(dry-run, not written)" : paths.contextPackPath;
    process.stdout.write(
      `session-close: context pack ready (${pack.token_budget.pack_tokens}/${pack.token_budget.pack_limit} tokens) → ${dest}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: prepare-context failed: ${message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: prepare-context failed: ${message}\n`);
    process.exit(1);
  });
}
