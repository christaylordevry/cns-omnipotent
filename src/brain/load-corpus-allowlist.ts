import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrainCorpusAllowlist } from "./corpus-allowlist.js";
import { parseBrainCorpusAllowlist, type BrainCorpusAllowlistParseResult } from "./corpus-allowlist.js";

/** Live operator allowlist path relative to vault root (Story 12.2). */
export const BRAIN_CORPUS_ALLOWLIST_VAULT_REL = "_meta/schemas/brain-corpus-allowlist.json";

/**
 * Reads `{vaultRoot}/_meta/schemas/brain-corpus-allowlist.json` and validates via
 * {@link parseBrainCorpusAllowlist} (pure parser; unchanged from 12.2).
 */
export async function loadBrainCorpusAllowlistFromVault(vaultRoot: string): Promise<BrainCorpusAllowlistParseResult> {
  const abs = path.join(vaultRoot, BRAIN_CORPUS_ALLOWLIST_VAULT_REL);
  const text = await readFile(abs, "utf8");
  return parseBrainCorpusAllowlist(text);
}

/**
 * Effective corpus roots: normalized `subtrees` plus `00-Inbox` when `inbox.enabled` is true,
 * sorted lexically (POSIX-style ordering via `localeCompare`).
 */
export function effectiveCorpusRoots(allowlist: BrainCorpusAllowlist): string[] {
  const set = new Set<string>(allowlist.subtrees);
  if (allowlist.inbox.enabled) {
    set.add("00-Inbox");
  }
  return [...set].sort((a, b) => a.localeCompare(b, "en"));
}
