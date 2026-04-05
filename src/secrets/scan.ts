import { CnsError } from "../errors.js";
import type { CompiledSecretPattern } from "./pattern-config.js";
import { loadMergedSecretPatterns } from "./load-patterns.js";

/**
 * Scan full note text (body + YAML block + keys) for configured credential shapes.
 * Does not echo matched substrings in errors (NFR-S2 / security module).
 */
export function assertContentMatchesNoSecretPatterns(
  content: string,
  patterns: CompiledSecretPattern[],
): void {
  for (const p of patterns) {
    if (p.regex.test(content)) {
      throw new CnsError(
        "SECRET_PATTERN",
        "Write rejected: content matches a disallowed credential pattern.",
        { patternId: p.id },
      );
    }
  }
}

export async function assertVaultWriteContentNoSecretPatterns(
  vaultRoot: string,
  content: string,
): Promise<void> {
  const patterns = await loadMergedSecretPatterns(vaultRoot);
  assertContentMatchesNoSecretPatterns(content, patterns);
}
