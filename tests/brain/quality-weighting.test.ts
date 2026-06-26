import { describe, expect, it } from "vitest";
import {
  applyQualityWeightStrength,
  computeQualityMultiplier,
} from "../../src/brain/retrieval/quality-weighting.js";

describe("applyQualityWeightStrength", () => {
  it("returns 1.0 when α=0 regardless of raw multiplier", () => {
    expect(applyQualityWeightStrength(0.25, 0)).toBeCloseTo(1.0);
    expect(applyQualityWeightStrength(0.364, 0)).toBeCloseTo(1.0);
  });

  it("returns raw multiplier when α=1 (regression lock)", () => {
    expect(applyQualityWeightStrength(0.25, 1)).toBeCloseTo(0.25);
    expect(applyQualityWeightStrength(0.364, 1)).toBeCloseTo(0.364);
    expect(applyQualityWeightStrength(1.0, 1)).toBeCloseTo(1.0);
  });

  it("blends toward 1.0 at α=0.3", () => {
    expect(applyQualityWeightStrength(0.25, 0.3)).toBeCloseTo(0.775);
    expect(applyQualityWeightStrength(0.364, 0.3)).toBeCloseTo(0.8092);
    expect(applyQualityWeightStrength(1.0, 0.3)).toBeCloseTo(1.0);
  });

  it("clamps α and raw multiplier to [0, 1]", () => {
    expect(applyQualityWeightStrength(1.5, 2)).toBeCloseTo(1.0);
    expect(applyQualityWeightStrength(-0.2, 0.5)).toBeCloseTo(0.5);
  });
});

describe("computeQualityMultiplier", () => {
  it("applies flat penalty when quality is missing entirely", () => {
    expect(computeQualityMultiplier(undefined)).toBeCloseTo(0.25);
  });

  it("applies the same flat penalty when quality is an empty object", () => {
    expect(computeQualityMultiplier({})).toBeCloseTo(0.25);
  });

  it("uses best-case weights for reviewed + verified with explicit confidence", () => {
    expect(
      computeQualityMultiplier({
        status: "reviewed",
        confidence_score: 1.0,
        verification_status: "verified",
        pake_type: "SourceNote",
      }),
    ).toBeCloseTo(1.0);
  });

  it("down-ranks draft + pending with missing confidence", () => {
    const draftProduct = 0.65 * 0.5 * 0.8 * 0.7;
    expect(
      computeQualityMultiplier({
        status: "draft",
        verification_status: "pending",
      }),
    ).toBeCloseTo(draftProduct);
    expect(applyQualityWeightStrength(draftProduct, 1)).toBeCloseTo(draftProduct);
    expect(applyQualityWeightStrength(draftProduct, 0)).toBeCloseTo(1.0);
    expect(applyQualityWeightStrength(0.25, 0.3)).toBeCloseTo(0.775);
  });

  it("allows explicit confidence_score=0 to drive multiplier to 0 (not the flat missing-quality penalty)", () => {
    expect(
      computeQualityMultiplier({
        status: "reviewed",
        confidence_score: 0,
        verification_status: "verified",
        pake_type: "SourceNote",
      }),
    ).toBeCloseTo(0);
  });

  it("treats unknown field values as missing (uses missing weights)", () => {
    expect(
      computeQualityMultiplier({
        status: "weird" as never,
        verification_status: "nope" as never,
        confidence_score: 0.8,
        pake_type: "NotAType" as never,
      }),
    ).toBeCloseTo(0.5 * 0.8 * 0.6 * 0.7);
  });

  it("uses PAKE type preference as a bounded trust signal", () => {
    const base = {
      status: "reviewed" as const,
      confidence_score: 1,
      verification_status: "verified" as const,
    };

    expect(computeQualityMultiplier({ ...base, pake_type: "SourceNote" })).toBeCloseTo(1);
    expect(computeQualityMultiplier({ ...base, pake_type: "WorkflowNote" })).toBeCloseTo(0.85);
    expect(computeQualityMultiplier({ ...base, pake_type: "UnknownType" as never })).toBeCloseTo(0.7);
  });
});
