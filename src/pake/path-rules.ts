/**
 * Vault-relative POSIX path rules for PAKE validation skips (Phase 1).
 * Inbox exemption is path-only, never content-based.
 */

export function normalizeVaultRelativePosix(userPath: string): string {
  let p = userPath.trim().replace(/\\/g, "/");
  while (p.startsWith("./")) {
    p = p.slice(2);
  }
  return p.replace(/^\/+/, "");
}

/** True when the logical target is under raw capture (no PAKE schema required). */
export function isInboxVaultPath(vaultRelativePosix: string): boolean {
  const n = normalizeVaultRelativePosix(vaultRelativePosix);
  return n === "00-Inbox" || n.startsWith("00-Inbox/");
}

/** Folder contract manifests use non-PAKE frontmatter; do not validate as PAKE notes. */
export function isContractManifestReadmePath(vaultRelativePosix: string): boolean {
  const n = normalizeVaultRelativePosix(vaultRelativePosix);
  return n === "_README.md" || n.endsWith("/_README.md");
}
