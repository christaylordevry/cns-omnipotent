import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { resolvePaths } from "./paths.mjs";
import { readSessionCloseEnvVar } from "./load-session-close-env.mjs";

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeLf(text) {
  return text.replace(/\r\n/g, "\n");
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function listModuleFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

/**
 * @param {{ repoRoot?: string; vaultRoot?: string }} [overrides]
 */
export function resolveVaultModulesPaths(overrides = {}) {
  if (overrides.repoRoot && overrides.vaultRoot) {
    const repoRoot = resolve(overrides.repoRoot);
    const vaultRoot = resolve(overrides.vaultRoot);
    return {
      repoRoot,
      vaultRoot,
      vaultModulesPath: join(vaultRoot, "AI-Context", "modules"),
      repoModulesPath: join(repoRoot, "specs/cns-vault-contract/modules"),
    };
  }
  const paths = resolvePaths(overrides);
  return {
    repoRoot: paths.repoRoot,
    vaultRoot: paths.vaultRoot,
    vaultModulesPath: paths.vaultModulesPath,
    repoModulesPath: paths.repoModulesPath,
  };
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readNormalized(filePath) {
  return normalizeLf(await readFile(filePath, "utf8"));
}

/**
 * @param {string} vaultDir
 * @param {string} specsDir
 * @returns {Promise<{ ok: boolean; added: string[]; removed: string[]; changed: string[] }>}
 */
export async function compareVaultModulesMirror(vaultDir, specsDir) {
  const vaultFiles = existsSync(vaultDir) ? await listModuleFiles(vaultDir) : [];
  const specsFiles = existsSync(specsDir) ? await listModuleFiles(specsDir) : [];

  const vaultSet = new Set(vaultFiles);
  const specsSet = new Set(specsFiles);

  const added = vaultFiles.filter((name) => !specsSet.has(name));
  const removed = specsFiles.filter((name) => !vaultSet.has(name));
  /** @type {string[]} */
  const changed = [];

  for (const name of vaultFiles) {
    if (!specsSet.has(name)) {
      continue;
    }
    const vaultContent = await readNormalized(join(vaultDir, name));
    const specsContent = await readNormalized(join(specsDir, name));
    if (vaultContent !== specsContent) {
      changed.push(name);
    }
  }

  return {
    ok: added.length === 0 && removed.length === 0 && changed.length === 0,
    added,
    removed,
    changed,
  };
}

/**
 * @param {{ added: string[]; removed: string[]; changed: string[] }} diff
 * @returns {string}
 */
export function formatModulesParityMessage(diff) {
  const lines = ["Vault modules mirror drift detected:"];
  if (diff.added.length > 0) {
    lines.push(`  added (in vault, missing from specs): ${diff.added.join(", ")}`);
  }
  if (diff.removed.length > 0) {
    lines.push(`  removed (in specs, missing from vault): ${diff.removed.join(", ")}`);
  }
  if (diff.changed.length > 0) {
    lines.push(`  changed (content differs): ${diff.changed.join(", ")}`);
  }
  lines.push("Run: npm run sync-vault-modules");
  return lines.join("\n");
}

/**
 * @param {{
 *   dryRun?: boolean;
 *   repoRoot?: string;
 *   vaultRoot?: string;
 * }} opts
 */
export async function runSyncVaultModules(opts = {}) {
  const { vaultModulesPath, repoModulesPath } = resolveVaultModulesPaths({
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
  });

  if (!existsSync(vaultModulesPath)) {
    throw new Error(`Vault modules directory not found: ${vaultModulesPath}`);
  }

  const diff = await compareVaultModulesMirror(vaultModulesPath, repoModulesPath);

  if (opts.dryRun) {
    return {
      dryRun: true,
      ...diff,
      added: diff.added,
      updated: diff.changed,
      removed: diff.removed,
    };
  }

  await mkdir(repoModulesPath, { recursive: true });

  const vaultFiles = await listModuleFiles(vaultModulesPath);
  const vaultSet = new Set(vaultFiles);

  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const updated = [];

  for (const name of vaultFiles) {
    const content = normalizeLf(await readFile(join(vaultModulesPath, name), "utf8"));
    const targetPath = join(repoModulesPath, name);
    const existed = existsSync(targetPath);
    let prior = "";
    if (existed) {
      prior = await readNormalized(targetPath);
    }
    if (!existed) {
      added.push(name);
    } else if (prior !== content) {
      updated.push(name);
    }
    await writeFile(targetPath, content, "utf8");
  }

  const specsFiles = existsSync(repoModulesPath) ? await listModuleFiles(repoModulesPath) : [];
  /** @type {string[]} */
  const removed = [];
  for (const name of specsFiles) {
    if (!vaultSet.has(name)) {
      removed.push(name);
      await rm(join(repoModulesPath, name));
    }
  }

  return {
    dryRun: false,
    ok: true,
    added,
    updated,
    removed,
  };
}

/**
 * Resolve live vault modules dir for parity tests.
 * Uses process.env.CNS_VAULT_ROOT, then ~/.hermes/session-close.env (via readSessionCloseEnvVar).
 * @param {{ env?: NodeJS.ProcessEnv; envPath?: string }} [opts]
 * @returns {Promise<string | null>}
 */
export async function resolveLiveVaultModulesDir(opts = {}) {
  const vaultRoot = await readSessionCloseEnvVar("CNS_VAULT_ROOT", opts);
  if (!vaultRoot) {
    return null;
  }
  const modulesDir = join(vaultRoot, "AI-Context", "modules");
  if (!existsSync(modulesDir)) {
    return null;
  }
  return modulesDir;
}
