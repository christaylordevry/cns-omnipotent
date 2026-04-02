import path from "node:path";
import { CnsError } from "./errors.js";

// Lexical resolution only: Inbox exemptions elsewhere use exact `00-Inbox` prefix (case-sensitive on typical Linux); canonical casing alignment is Story 4-9.

function normalizeAbsolute(p: string): string {
  return path.normalize(p);
}

/** True if `resolved` is exactly the vault root or a path strictly under it (prefix + sep). */
function isWithinResolvedVaultRoot(resolvedVaultRoot: string, resolved: string): boolean {
  if (resolved === resolvedVaultRoot) return true;
  const prefix = resolvedVaultRoot.endsWith(path.sep) ? resolvedVaultRoot : resolvedVaultRoot + path.sep;
  return resolved.startsWith(prefix);
}

export function resolveVaultPath(vaultRoot: string, userPath: string): string {
  const resolvedVaultRoot = normalizeAbsolute(path.resolve(vaultRoot));
  const resolved = normalizeAbsolute(path.resolve(resolvedVaultRoot, userPath));

  if (!isWithinResolvedVaultRoot(resolvedVaultRoot, resolved)) {
    throw new CnsError("VAULT_BOUNDARY", "Resolved path escapes vault root.", {
      vaultRoot: resolvedVaultRoot,
      userPath,
      resolvedPath: resolved,
    });
  }

  return resolved;
}

/** Lexical boundary only; do not treat as read-safe without a canonical (`realpath`) step. */
export function assertWithinVault(vaultRoot: string, resolvedPath: string): void {
  const resolvedVaultRoot = normalizeAbsolute(path.resolve(vaultRoot));
  const resolved = normalizeAbsolute(path.resolve(resolvedPath));

  if (!isWithinResolvedVaultRoot(resolvedVaultRoot, resolved)) {
    throw new CnsError("VAULT_BOUNDARY", "Resolved path escapes vault root.", {
      vaultRoot: resolvedVaultRoot,
      resolvedPath: resolved,
    });
  }
}

