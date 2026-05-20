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

/** Story 37-2 topic hubs under Research/ use contract manifest frontmatter. */
export function isContractTopicHubPath(vaultRelativePosix: string): boolean {
  const n = normalizeVaultRelativePosix(vaultRelativePosix);
  return n.startsWith("03-Resources/Research/") && n.endsWith("-hub.md");
}

/** Contract manifest or topic hub — skip PAKE Standard validation. */
export function isContractManifestPath(vaultRelativePosix: string): boolean {
  return isContractManifestReadmePath(vaultRelativePosix) || isContractTopicHubPath(vaultRelativePosix);
}
