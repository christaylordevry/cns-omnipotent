import { describe, expect, it, vi } from "vitest";
import { validateVersionCompatibility } from "../../src/routing/version-guard.js";
import { resolveRoutingDecision } from "../../src/routing/decision-engine.js";
import type { AliasRegistry, RoutingContext, RoutingPolicy } from "../../src/routing/types.js";

// ── Unit tests for validateVersionCompatibility ────────────────

describe("validateVersionCompatibility", () => {
  it("matching majors with different minor/patch returns ok: true", () => {
    const result = validateVersionCompatibility("1.0.0", "1.2.0");
    expect(result.ok).toBe(true);
  });

  it("mismatched majors returns ok: false with reason", () => {
    const result = validateVersionCompatibility("1.0.0", "2.0.0");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("Major version mismatch");
    expect(result.policyVersion).toBe("1.0.0");
    expect(result.registryVersion).toBe("2.0.0");
  });

  it("minor mismatch is allowed (returns ok: true)", () => {
    const result = validateVersionCompatibility("1.1.0", "1.2.0");
    expect(result.ok).toBe(true);
  });

  it("minor/patch mismatch emits console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateVersionCompatibility("1.0.0", "1.3.1");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("Minor/patch version mismatch");
    spy.mockRestore();
  });

  it("identical versions produce no warning", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateVersionCompatibility("1.0.0", "1.0.0");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("non-semver identical strings pass", () => {
    const result = validateVersionCompatibility("sha256:abc123", "sha256:abc123");
    expect(result.ok).toBe(true);
  });

  it("non-semver different strings fail", () => {
    const result = validateVersionCompatibility("sha256:abc", "sha256:def");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("Non-semver");
  });
});

// ── Integration with resolveRoutingDecision ────────────────────

describe("version guard integration with decision engine", () => {
  const REASON_CODES = [
    "DEFAULT",
    "FALLBACK_EXHAUSTED",
    "FALLBACK_RATE_LIMIT",
    "OPERATOR_OVERRIDE",
    "POLICY_DENY",
    "NO_MATCH_FAIL_CLOSED",
    "VERSION_MISMATCH",
  ] as const;

  const REGISTRY: AliasRegistry = {
    registry_version: "1.0.0",
    aliases: {
      "default-coding": { provider: "anthropic", model_id: "claude-sonnet" },
      fast: { provider: "anthropic", model_id: "claude-haiku" },
    },
  };

  function makePolicy(policyVersion: string): RoutingPolicy {
    return {
      policy_version: policyVersion,
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: { model_alias: "default-coding", fallback_chain: ["fast"] },
            writing: { model_alias: "fast", fallback_chain: [] },
            analysis: { model_alias: "fast", fallback_chain: [] },
          },
        },
      },
    };
  }

  function ctx(): RoutingContext {
    return { surface: "cursor", taskCategory: "coding", operatorOverride: false };
  }

  it("mismatched major versions produce VERSION_MISMATCH error", () => {
    const result = resolveRoutingDecision(
      ctx(),
      makePolicy("2.0.0"),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("VERSION_MISMATCH");
    expect(result.error.message).toContain("Major version mismatch");
  });

  it("matching major versions proceed normally", () => {
    const result = resolveRoutingDecision(
      ctx(),
      makePolicy("1.5.0"),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("default-coding");
  });
});
