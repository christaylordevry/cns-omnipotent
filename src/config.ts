import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CnsError } from "./errors.js";

export type RuntimeConfig = {
  vaultRoot: string;
  /** Vault-relative default directory for `vault_search` when the tool omits `scope`. */
  defaultSearchScope?: string | undefined;
  /** Optional absolute path to Obsidian CLI binary (`CNS_OBSIDIAN_CLI`). */
  obsidianCliPath?: string | undefined;
};

/**
 * Optional overrides for {@link loadRuntimeConfig}. The Phase 1 stdio entrypoint (`src/index.ts`) calls
 * `loadRuntimeConfig()` with no arguments, so vault root is **env-only** there (`CNS_VAULT_ROOT`).
 */
export type ConfigInputs = {
  /**
   * Programmatic vault root for embedders, tests, or future host wiring. Not passed from the stdio `main`.
   * When set alongside a non-empty trimmed `CNS_VAULT_ROOT`, **the environment variable wins**.
   */
  vaultRootFromHost?: string | undefined;
  /** Process environment to read (defaults to `process.env`). */
  env?: NodeJS.ProcessEnv | undefined;
};

const vaultRootPathSchema = z
  .string()
  .min(1, "Missing CNS_VAULT_ROOT. Set CNS_VAULT_ROOT to an existing vault directory.");

async function assertExistingDirectory(dirPath: string): Promise<void> {
  try {
    const s = await stat(dirPath);
    if (!s.isDirectory()) {
      throw new CnsError("IO_ERROR", `CNS_VAULT_ROOT must be a directory: ${dirPath}`, { path: dirPath });
    }
  } catch (err) {
    if (err instanceof CnsError) throw err;
    throw new CnsError("IO_ERROR", `CNS_VAULT_ROOT must exist and be readable: ${dirPath}`, {
      path: dirPath,
    });
  }
}

/** Reject configured root when it is the OS filesystem root — boundary checks would be meaningless (deferred-work / Epic B). */
function assertVaultRootNotFilesystemRoot(vaultRoot: string): void {
  const resolved = path.resolve(vaultRoot);
  const { root } = path.parse(resolved);
  if (resolved === root) {
    throw new CnsError(
      "IO_ERROR",
      "CNS_VAULT_ROOT cannot be the filesystem root. Set it to your vault directory (a folder inside the volume), not / or a drive root.",
      { path: resolved },
    );
  }
}

/**
 * Resolves vault root from `CNS_VAULT_ROOT` and/or `vaultRootFromHost`, validates the path, then reads optional env-driven settings.
 *
 * **Precedence:** non-empty trimmed `CNS_VAULT_ROOT` overrides `vaultRootFromHost`.
 */
export async function loadRuntimeConfig(inputs: ConfigInputs = {}): Promise<RuntimeConfig> {
  const env = inputs.env ?? process.env;
  const envVaultRoot = env.CNS_VAULT_ROOT;
  const raw = (envVaultRoot && envVaultRoot.trim()) || inputs.vaultRootFromHost || "";

  const parsed = vaultRootPathSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid CNS_VAULT_ROOT.";
    throw new CnsError("IO_ERROR", msg);
  }

  const vaultRoot = parsed.data;

  assertVaultRootNotFilesystemRoot(vaultRoot);
  await assertExistingDirectory(vaultRoot);

  const defaultScopeRaw = env.CNS_VAULT_DEFAULT_SEARCH_SCOPE?.trim();
  const defaultSearchScope = defaultScopeRaw && defaultScopeRaw.length > 0 ? defaultScopeRaw : undefined;

  const obsidianRaw = env.CNS_OBSIDIAN_CLI?.trim();
  const obsidianCliPath = obsidianRaw && obsidianRaw.length > 0 ? obsidianRaw : undefined;

  return { vaultRoot, defaultSearchScope, obsidianCliPath };
}

