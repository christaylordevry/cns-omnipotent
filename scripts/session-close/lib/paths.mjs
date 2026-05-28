import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

export const DEFAULT_OMNIPOTENT_REPO = "/home/christ/ai-factory/projects/Omnipotent.md";
export const DEFAULT_CNS_VAULT_ROOT =
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";

const SPRINT_MARKER = "scripts/export-vault-for-notebooklm.sh";

/**
 * @param {string | undefined} value
 * @returns {string | null}
 */
function absoluteDir(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  try {
    const abs = resolve(trimmed);
    if (!existsSync(abs)) {
      return null;
    }
    return realpathSync(abs);
  } catch {
    return null;
  }
}

/**
 * @param {string} repoRoot
 * @returns {boolean}
 */
export function isValidRepoRoot(repoRoot) {
  return (
    existsSync(join(repoRoot, SPRINT_MARKER)) &&
    existsSync(join(repoRoot, "_bmad-output", "implementation-artifacts", "sprint-status.yaml"))
  );
}

/**
 * @param {string} repoRoot
 * @returns {string | null}
 */
function vaultFallbackUnderRepo(repoRoot) {
  const candidate = join(repoRoot, "Knowledge-Vault-ACTIVE");
  if (existsSync(join(candidate, "AI-Context", "AGENTS.md"))) {
    try {
      return realpathSync(candidate);
    } catch {
      return resolve(candidate);
    }
  }
  return null;
}

/**
 * @param {{ repoRoot?: string, vaultRoot?: string }} [overrides]
 */
export function resolvePaths(overrides = {}) {
  const envRepo = absoluteDir(process.env.OMNIPOTENT_REPO);
  const envVault = absoluteDir(process.env.CNS_VAULT_ROOT);

  let repoRoot = absoluteDir(overrides.repoRoot) ?? envRepo;
  if (!repoRoot || !isValidRepoRoot(repoRoot)) {
    const fallback = resolve(DEFAULT_OMNIPOTENT_REPO);
    if (isValidRepoRoot(fallback)) {
      repoRoot = fallback;
    } else if (repoRoot && existsSync(repoRoot)) {
      // keep explicit override for tests even without full markers
    } else {
      throw new Error(
        `Could not resolve Omnipotent.md repo from OMNIPOTENT_REPO or ${DEFAULT_OMNIPOTENT_REPO}`,
      );
    }
  }

  let vaultRoot =
    absoluteDir(overrides.vaultRoot) ??
    envVault ??
    absoluteDir(DEFAULT_CNS_VAULT_ROOT) ??
    vaultFallbackUnderRepo(repoRoot);

  if (!vaultRoot) {
    throw new Error(
      `Could not resolve vault root from CNS_VAULT_ROOT or ${DEFAULT_CNS_VAULT_ROOT}`,
    );
  }

  return {
    repoRoot,
    vaultRoot,
    agentsPath: join(vaultRoot, "AI-Context", "AGENTS.md"),
    sprintPath: join(repoRoot, "_bmad-output", "implementation-artifacts", "sprint-status.yaml"),
    artifactsDir: join(repoRoot, "_bmad-output", "implementation-artifacts"),
    sessionCloseDir: join(repoRoot, ".session-close"),
    contextPackPath: join(repoRoot, ".session-close", "context-pack.json"),
    closeReportPath: join(repoRoot, ".session-close", "close-report.json"),
  };
}
