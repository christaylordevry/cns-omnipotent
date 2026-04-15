import { describe, expect, it } from "vitest";
import { computeQualityMultiplier } from "../../src/brain/retrieval/quality-weighting.js";

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
      }),
    ).toBeCloseTo(1.0);
  });

  it("down-ranks draft + pending with missing confidence", () => {
    expect(
      computeQualityMultiplier({
        status: "draft",
        verification_status: "pending",
      }),
    ).toBeCloseTo(0.65 * 0.5 * 0.8);
  });

  it("treats unknown field values as missing (uses missing weights)", () => {
    expect(
      computeQualityMultiplier({
        status: "weird" as never,
        verification_status: "nope" as never,
        confidence_score: 0.8,
      }),
    ).toBeCloseTo(0.5 * 0.8 * 0.6);
  });
});

