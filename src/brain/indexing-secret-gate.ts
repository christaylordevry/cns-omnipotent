import { loadMergedSecretPatterns } from "../secrets/load-patterns.js";
import { findFirstMatchingSecretPatternId } from "../secrets/scan.js";

/**
 * Stable machine-facing reason when a note is excluded from embedding due to a
 * secret-pattern hit (for Story 12.5 index manifest / reason breakdown).
 */
export const INDEXING_SECRET_EXCLUSION_REASON = "EXCLUDED_SECRET_PATTERN" as const;

export type IndexingSecretExclusionReasonCode = typeof INDEXING_SECRET_EXCLUSION_REASON;

export type IndexingSecretGateResult =
  | { eligible: true }
  | {
      eligible: false;
      reasonCode: IndexingSecretExclusionReasonCode;
      /** Pattern id from merged config (baseline or vault override); never matched text. */
      patternId: string;
    };

/**
 * Evaluates full serialized note text (YAML frontmatter + body) against the same
 * merged pattern set as WriteGate. Returns allow/exclude without throwing on match;
 * callers must not treat structured fields as containing secret material.
 */
export async function evaluateNoteForEmbeddingSecretGate(
  vaultRoot: string,
  fullNoteText: string,
): Promise<IndexingSecretGateResult> {
  const patterns = await loadMergedSecretPatterns(vaultRoot);
  const patternId = findFirstMatchingSecretPatternId(fullNoteText, patterns);
  if (patternId !== null) {
    return {
      eligible: false,
      reasonCode: INDEXING_SECRET_EXCLUSION_REASON,
      patternId,
    };
  }
  return { eligible: true };
}
