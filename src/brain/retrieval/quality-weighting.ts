import type { QualityMetadata } from "../quality.js";

const STATUS_WEIGHT: Record<string, number> = {
  reviewed: 1.0,
  "in-progress": 0.85,
  draft: 0.65,
  archived: 0.4,
};

const VERIFICATION_WEIGHT: Record<string, number> = {
  verified: 1.0,
  pending: 0.8,
  disputed: 0.5,
};

const MISSING_STATUS_WEIGHT = 0.5;
const MISSING_CONFIDENCE_WEIGHT = 0.5;
const MISSING_VERIFICATION_WEIGHT = 0.6;

/**
 * Computes a quality multiplier in (0, 1] based on PAKE quality signals.
 *
 * Formula:
 *
 * - If quality metadata is missing entirely (no `quality` field on record): multiplier = 0.25
 * - Else: multiplier = status_weight * confidence_weight * verification_weight
 *
 * Weights:
 * - status_weight: reviewed 1.0, in-progress 0.85, draft 0.65, archived 0.4, missing/unknown 0.5
 * - confidence_weight: if present and finite in [0, 1], use it; else 0.5
 * - verification_weight: verified 1.0, pending 0.8, disputed 0.5, missing/unknown 0.6
 */
export function computeQualityMultiplier(quality?: QualityMetadata): number {
  if (quality === undefined) {
    return 0.25;
  }
  if (
    quality.status === undefined &&
    quality.confidence_score === undefined &&
    quality.verification_status === undefined &&
    quality.pake_type === undefined
  ) {
    return 0.25;
  }

  const statusWeight = quality.status ? (STATUS_WEIGHT[quality.status] ?? MISSING_STATUS_WEIGHT) : MISSING_STATUS_WEIGHT;
  const confidenceWeight =
    typeof quality.confidence_score === "number" && Number.isFinite(quality.confidence_score) && quality.confidence_score >= 0 && quality.confidence_score <= 1
      ? quality.confidence_score
      : MISSING_CONFIDENCE_WEIGHT;
  const verificationWeight = quality.verification_status
    ? (VERIFICATION_WEIGHT[quality.verification_status] ?? MISSING_VERIFICATION_WEIGHT)
    : MISSING_VERIFICATION_WEIGHT;

  const mult = statusWeight * confidenceWeight * verificationWeight;
  if (!Number.isFinite(mult) || mult <= 0) {
    return 0.25;
  }
  return Math.min(1, mult);
}

