import fs from "node:fs/promises";
import path from "node:path";
import { CnsError } from "./errors.js";

function normalizeAbsolute(p: string): string {
  return path.normalize(p);
}

/** Same prefix rule as `write-gate.ts` and `paths.ts` (canonical absolute paths only). */
function isWithinResolvedVaultRoot(resolvedVaultRoot: string, resolved: string): boolean {
  if (resolved === resolvedVaultRoot) return true;
  const prefix = resolvedVaultRoot.endsWith(path.sep) ? resolvedVaultRoot : resolvedVaultRoot + path.sep;
  return resolved.startsWith(prefix);
}

/** `realpath` of configured vault root; matches write-gate behaviour when root is unusable. */
export async function getRealVaultRoot(vaultRoot: string): Promise<string> {
  try {
    return await fs.realpath(normalizeAbsolute(path.resolve(vaultRoot)));
  } catch {
    throw new CnsError("VAULT_BOUNDARY", "Vault root could not be resolved.", {
      vaultRoot: normalizeAbsolute(path.resolve(vaultRoot)),
    });
  }
}

export type ResolveReadCanonicalOpts = {
  /** Vault-relative path for error `details.path`. */
  path: string;
  /** User-visible message when `realpath` fails with ENOENT (row A). */
  notFoundMessage: string;
};

/**
 * Canonical read boundary for MCP reads: `realpath` then assert under real vault root.
 * Maps to error table: ENOENT → NOT_FOUND; outside vault → VAULT_BOUNDARY; other fs errors → IO_ERROR.
 */
export async function resolveReadTargetCanonical(
  realVaultRoot: string,
  resolvedAbsolutePath: string,
  opts: ResolveReadCanonicalOpts,
): Promise<string> {
  const normalizedTarget = normalizeAbsolute(path.resolve(resolvedAbsolutePath));
  let canonical: string;
  try {
    canonical = await fs.realpath(normalizedTarget);
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", opts.notFoundMessage, { path: opts.path });
    }
    throw new CnsError("IO_ERROR", `Failed to resolve path: ${opts.path}`, { path: opts.path });
  }

  if (!isWithinResolvedVaultRoot(realVaultRoot, canonical)) {
    throw new CnsError("VAULT_BOUNDARY", "Resolved path escapes vault root.", {
      vaultRoot: realVaultRoot,
      resolvedPath: canonical,
      path: opts.path,
    });
  }

  return canonical;
}
