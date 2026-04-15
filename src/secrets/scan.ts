import { CnsError } from "../errors.js";
import type { CompiledSecretPattern } from "./pattern-config.js";
import { loadMergedSecretPatterns } from "./load-patterns.js";

/**
 * Returns the id of the first compiled pattern that matches `content`, or `null`.
 * Shared by WriteGate (throwing) and Brain indexing (non-throwing) paths.
 */
export function findFirstMatchingSecretPatternId(
  content: string,
  patterns: CompiledSecretPattern[],
): string | null {
  for (const p of patterns) {
    if (p.regex.test(content)) {
      return p.id;
    }
  }
  return null;
}

/**
 * Scan full note text (body + YAML block + keys) for configured credential shapes.
 * Does not echo matched substrings in errors (NFR-S2 / security module).
 */
export function assertContentMatchesNoSecretPatterns(
  content: string,
  patterns: CompiledSecretPattern[],
): void {
  const patternId = findFirstMatchingSecretPatternId(content, patterns);
  if (patternId !== null) {
    throw new CnsError(
      "SECRET_PATTERN",
      "Write rejected: content matches a disallowed credential pattern.",
      { patternId },
    );
  }
}

export async function assertVaultWriteContentNoSecretPatterns(
  vaultRoot: string,
  content: string,
): Promise<void> {
  const patterns = await loadMergedSecretPatterns(vaultRoot);
  assertContentMatchesNoSecretPatterns(content, patterns);
}
