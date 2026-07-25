#!/usr/bin/env node
/**
 * Story 87-2: Sync canonical vault AI-Context/modules → specs/cns-vault-contract/modules mirror.
 */
import { pathToFileURL } from "node:url";

import { resolvePaths } from "./lib/paths.mjs";
import {
  formatModulesParityMessage,
  runSyncVaultModules,
} from "./lib/sync-vault-modules.mjs";

/**
 * @param {import('./lib/sync-vault-modules.mjs').runSyncVaultModules extends (...args: any) => Promise<infer R> ? R : never} result
 */
function formatSyncSummary(result) {
  if (result.dryRun) {
    if (result.ok) {
      return "vault modules mirror is in sync (dry-run)";
    }
    return formatModulesParityMessage(result);
  }
  const parts = [];
  if (result.added.length > 0) {
    parts.push(`added ${result.added.length}`);
  }
  if (result.updated.length > 0) {
    parts.push(`updated ${result.updated.length}`);
  }
  if (result.removed.length > 0) {
    parts.push(`removed ${result.removed.length}`);
  }
  if (parts.length === 0) {
    return "vault modules mirror already in sync";
  }
  return `vault modules synced (${parts.join(", ")})`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const paths = resolvePaths();
  const result = await runSyncVaultModules({
    dryRun,
    repoRoot: paths.repoRoot,
    vaultRoot: paths.vaultRoot,
  });
  const summary = formatSyncSummary(result);
  process.stdout.write(`${summary}\n`);
  if (dryRun && !result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`sync-vault-modules failed: ${message}\n`);
    process.exit(1);
  });
}
