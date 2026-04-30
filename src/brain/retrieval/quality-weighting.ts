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

const PAKE_TYPE_WEIGHT: Record<string, number> = {
  SourceNote: 1.0,
  SynthesisNote: 0.95,
  ValidationNote: 0.95,
  InsightNote: 0.9,
  WorkflowNote: 0.85,
  HookSetNote: 0.8,
  WeaponsCheckNote: 0.8,
};

const MISSING_STATUS_WEIGHT = 0.5;
const MISSING_CONFIDENCE_WEIGHT = 0.5;
const MISSING_VERIFICATION_WEIGHT = 0.6;
const MISSING_PAKE_TYPE_WEIGHT = 0.7;

export type QualityMultiplierComponents = {
  statusWeight: number;
  confidenceWeight: number;
  verificationWeight: number;
  typeWeight: number;
  /**
   * True when a flat penalty was applied because quality metadata was missing/empty
   * (components are still reported for transparency, but do not explain the flat penalty).
   */
  flatPenaltyApplied: boolean;
  multiplier: number;
};

/**
 * Computes a quality multiplier in [0, 1] based on PAKE quality signals.
 *
 * Formula:
 *
 * - If quality metadata is missing entirely (no `quality` field on record): multiplier = 0.25
 * - Else: multiplier = status_weight * confidence_weight * verification_weight * type_weight
 *
 * Weights:
 * - status_weight: reviewed 1.0, in-progress 0.85, draft 0.65, archived 0.4, missing/unknown 0.5
 * - confidence_weight: if present and finite in [0, 1], use it; else 0.5
 * - verification_weight: verified 1.0, pending 0.8, disputed 0.5, missing/unknown 0.6
 * - type_weight: SourceNote 1.0, SynthesisNote/ValidationNote 0.95, InsightNote 0.9,
 *   WorkflowNote 0.85, HookSetNote/WeaponsCheckNote 0.8, missing/unknown 0.7
 */
export function computeQualityMultiplierComponents(quality?: QualityMetadata): QualityMultiplierComponents {
  if (quality === undefined) {
    return {
      statusWeight: MISSING_STATUS_WEIGHT,
      confidenceWeight: MISSING_CONFIDENCE_WEIGHT,
      verificationWeight: MISSING_VERIFICATION_WEIGHT,
      typeWeight: MISSING_PAKE_TYPE_WEIGHT,
      flatPenaltyApplied: true,
      multiplier: 0.25,
    };
  }
  if (
    quality.status === undefined &&
    quality.confidence_score === undefined &&
    quality.verification_status === undefined &&
    quality.pake_type === undefined
  ) {
    return {
      statusWeight: MISSING_STATUS_WEIGHT,
      confidenceWeight: MISSING_CONFIDENCE_WEIGHT,
      verificationWeight: MISSING_VERIFICATION_WEIGHT,
      typeWeight: MISSING_PAKE_TYPE_WEIGHT,
      flatPenaltyApplied: true,
      multiplier: 0.25,
    };
  }

  const statusWeight = quality.status ? (STATUS_WEIGHT[quality.status] ?? MISSING_STATUS_WEIGHT) : MISSING_STATUS_WEIGHT;
  const confidenceWeight =
    typeof quality.confidence_score === "number" && Number.isFinite(quality.confidence_score) && quality.confidence_score >= 0 && quality.confidence_score <= 1
      ? quality.confidence_score
      : MISSING_CONFIDENCE_WEIGHT;
  const verificationWeight = quality.verification_status
    ? (VERIFICATION_WEIGHT[quality.verification_status] ?? MISSING_VERIFICATION_WEIGHT)
    : MISSING_VERIFICATION_WEIGHT;
  const typeWeight = quality.pake_type ? (PAKE_TYPE_WEIGHT[quality.pake_type] ?? MISSING_PAKE_TYPE_WEIGHT) : MISSING_PAKE_TYPE_WEIGHT;

  const mult = statusWeight * confidenceWeight * verificationWeight * typeWeight;
  if (!Number.isFinite(mult) || mult < 0) {
    return {
      statusWeight,
      confidenceWeight,
      verificationWeight,
      typeWeight,
      flatPenaltyApplied: false,
      multiplier: 0.25,
    };
  }
  return {
    statusWeight,
    confidenceWeight,
    verificationWeight,
    typeWeight,
    flatPenaltyApplied: false,
    multiplier: Math.min(1, mult),
  };
}

export function computeQualityMultiplier(quality?: QualityMetadata): number {
  return computeQualityMultiplierComponents(quality).multiplier;
}
