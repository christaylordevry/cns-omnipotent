import fs from "node:fs";
import path from "node:path";
import { CnsError } from "./errors.js";

/** Vault-relative path to the append-only agent audit log (Epic 5). */
export const AUDIT_AGENT_LOG_VAULT_REL = "_meta/logs/agent-log.md";

export type WritePurpose = "tool-write" | "audit-append";

export type WriteOperation = "create" | "overwrite" | "append" | "delete" | "mkdir" | "rename";

export type AssertWriteAllowedOptions = {
  /** Default `tool-write`; use `audit-append` only from audit machinery. */
  purpose?: WritePurpose;
  /** Kind of mutation; defaults to `overwrite`. */
  operation?: WriteOperation;
};

function normalizeAbsolute(p: string): string {
  return path.normalize(path.resolve(p));
}

/** Same prefix rule as `paths.ts` (canonical absolute paths only). */
function isWithinResolvedVaultRoot(resolvedVaultRoot: string, resolved: string): boolean {
  if (resolved === resolvedVaultRoot) return true;
  const prefix = resolvedVaultRoot.endsWith(path.sep) ? resolvedVaultRoot : resolvedVaultRoot + path.sep;
  return resolved.startsWith(prefix);
}

/**
 * Follows symlinks on existing path segments (Node `realpathSync`), then joins remaining
 * path tail. Catches symlink escapes where the logical path sits under the vault but the
 * real location does not. Throws `VAULT_BOUNDARY` if the canonical target leaves the vault.
 */
export function resolveWriteTargetCanonical(realVaultRoot: string, resolvedPath: string): string {
  let cur = normalizeAbsolute(resolvedPath);
  let tail = "";
  for (;;) {
    try {
      const realBase = fs.realpathSync(cur);
      const full = tail === "" ? realBase : path.normalize(path.join(realBase, tail));
      if (!isWithinResolvedVaultRoot(realVaultRoot, full)) {
        throw new CnsError("VAULT_BOUNDARY", "Resolved path escapes vault root.", {
          vaultRoot: realVaultRoot,
          resolvedPath: full,
        });
      }
      return full;
    } catch (e: unknown) {
      if (e instanceof CnsError) throw e;
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") throw e;
      const parent = path.dirname(cur);
      if (parent === cur) {
        throw new CnsError("VAULT_BOUNDARY", "Resolved path escapes vault root.", {
          vaultRoot: realVaultRoot,
          resolvedPath: normalizeAbsolute(resolvedPath),
        });
      }
      const base = path.basename(cur);
      tail = tail === "" ? base : path.join(base, tail);
      cur = parent;
    }
  }
}

/**
 * Vault-relative path using `/` separators for stable policy checks and error `details.path`.
 * Call after boundary checks; throws `VAULT_BOUNDARY` if relative resolution leaks `..`.
 */
export function vaultRelativePosix(vaultRoot: string, resolvedPath: string): string {
  const root = normalizeAbsolute(vaultRoot);
  const resolved = normalizeAbsolute(resolvedPath);
  const rel = path.relative(root, resolved);
  if (path.isAbsolute(rel)) {
    throw new CnsError("VAULT_BOUNDARY", "Resolved path escapes vault root.", {
      vaultRoot: root,
      resolvedPath: resolved,
    });
  }
  const segments = rel.split(path.sep);
  if (segments.some((s) => s === "..")) {
    throw new CnsError("VAULT_BOUNDARY", "Resolved path escapes vault root.", {
      vaultRoot: root,
      resolvedPath: resolved,
      path: segments.join("/"),
    });
  }
  return segments.join("/");
}

function isUnderAiContext(posixRel: string): boolean {
  return posixRel === "AI-Context" || posixRel.startsWith("AI-Context/");
}

function isUnderMetaSchemas(posixRel: string): boolean {
  return posixRel === "_meta/schemas" || posixRel.startsWith("_meta/schemas/");
}

function isUnderMetaLogs(posixRel: string): boolean {
  return posixRel === "_meta/logs" || posixRel.startsWith("_meta/logs/");
}

function isUnderMeta(posixRel: string): boolean {
  return posixRel === "_meta" || posixRel.startsWith("_meta/");
}

function protectedPath(message: string, posixRel: string): CnsError {
  return new CnsError("PROTECTED_PATH", message, { path: posixRel });
}

/**
 * Validates that a mutating filesystem operation may target `resolvedPath`.
 * Callers must pass normalized absolute paths consistent with `path.resolve` / `path.normalize` and `resolveVaultPath`.
 * The gate validates only; it does not perform IO.
 *
 * Boundary uses `realpathSync` so symlinks inside the vault cannot point outside it (writes
 * would follow the link). `paths.ts` read helpers remain string-based; Epic 4 write tools must
 * call this gate before mutating IO.
 */
export function assertWriteAllowed(
  vaultRoot: string,
  resolvedPath: string,
  options: AssertWriteAllowedOptions = {},
): void {
  const purpose = options.purpose ?? "tool-write";
  const operation = options.operation ?? "overwrite";

  let realVaultRoot: string;
  try {
    realVaultRoot = fs.realpathSync(normalizeAbsolute(path.resolve(vaultRoot)));
  } catch {
    throw new CnsError("VAULT_BOUNDARY", "Vault root could not be resolved.", {
      vaultRoot: normalizeAbsolute(path.resolve(vaultRoot)),
    });
  }

  const canonicalTarget = resolveWriteTargetCanonical(realVaultRoot, resolvedPath);
  const posixRel = vaultRelativePosix(realVaultRoot, canonicalTarget);

  if (purpose === "audit-append" && posixRel === AUDIT_AGENT_LOG_VAULT_REL) {
    // Phase 1 folder contract includes `_meta/logs/agent-log.md`; bootstrap is not the gate's job.
    // AuditLogger may create the file on first append; no overwrite/delete/rename surfaces are allowed.
    if (operation === "append" || operation === "create") {
      return;
    }
    throw protectedPath(
      "Audit log allows only create/append operations via audit-append purpose.",
      posixRel,
    );
  }

  if (isUnderMetaLogs(posixRel)) {
    throw protectedPath(
      "Writes under _meta/logs/ are restricted; use audit-append on agent-log.md only.",
      posixRel,
    );
  }

  if (isUnderAiContext(posixRel)) {
    throw protectedPath("AI-Context is protected; writes are not allowed.", posixRel);
  }

  if (isUnderMetaSchemas(posixRel)) {
    throw protectedPath("Writes under _meta/schemas/ are not allowed.", posixRel);
  }

  if (isUnderMeta(posixRel)) {
    throw protectedPath("Writes under _meta/ are not allowed for this operation.", posixRel);
  }
}
