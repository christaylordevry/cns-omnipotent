import { describe, expect, it } from "vitest";
import { buildFallbackLogEntry } from "../../src/routing/audit-log.js";
import { orchestrateFallback } from "../../src/routing/fallback-orchestrator.js";
import type {
  AliasRegistry,
  DecisionRecord,
  FallbackResult,
  RoutingContext,
  RoutingPolicy,
} from "../../src/routing/types.js";

// ── Shared fixtures ────────────────────────────────────────────

const REASON_CODES = [
  "DEFAULT",
  "FALLBACK_CROSS_PROVIDER",
  "FALLBACK_EXHAUSTED",
  "FALLBACK_RATE_LIMIT",
  "FALLBACK_USED",
  "OPERATOR_OVERRIDE",
  "POLICY_DENY",
  "NO_MATCH_FAIL_CLOSED",
] as const;

const REGISTRY: AliasRegistry = {
  registry_version: "1.1.0",
  aliases: {
    "default-coding": {
      provider: "anthropic",
      model_id: "claude-sonnet",
    },
    "default-reasoning": {
      provider: "anthropic",
      model_id: "claude-opus",
    },
    fast: {
      provider: "anthropic",
      model_id: "claude-haiku",
    },
    deep: {
      provider: "anthropic",
      model_id: "claude-opus",
    },
    "gemini-pro": {
      provider: "google",
      model_id: "gemini-2.5-pro",
    },
    "gemini-flash": {
      provider: "google",
      model_id: "gemini-2.5-flash",
    },
  },
};

function makeDecision(overrides?: Partial<DecisionRecord>): DecisionRecord {
  return {
    surface: "cursor",
    taskCategory: "coding",
    scope: "task",
    policy_version: "1.1.0",
    selected_model_alias: "default-coding",
    reason_code: "DEFAULT",
    fallback_chain: ["fast"],
    operator_override: false,
    ...overrides,
  };
}

function makePolicy(overrides?: Partial<RoutingPolicy>): RoutingPolicy {
  return {
    policy_version: "1.1.0",
    surfaces: {
      cursor: {
        default_scope: "task",
        defaults: {
          coding: { model_alias: "default-coding", fallback_chain: ["fast"] },
          writing: { model_alias: "fast", fallback_chain: ["default-reasoning"] },
          analysis: { model_alias: "default-reasoning", fallback_chain: ["deep", "default-coding"] },
        },
      },
      "claude-code": {
        default_scope: "task",
        defaults: {
          coding: { model_alias: "default-coding", fallback_chain: ["fast"] },
          writing: { model_alias: "fast", fallback_chain: ["default-coding"] },
          analysis: { model_alias: "default-reasoning", fallback_chain: ["deep"] },
        },
      },
    },
    ...overrides,
  };
}

function ctx(overrides?: Partial<RoutingContext>): RoutingContext {
  return {
    surface: "cursor",
    taskCategory: "coding",
    operatorOverride: false,
    ...overrides,
  };
}

// ── orchestrateFallback ────────────────────────────────────────

describe("orchestrateFallback", () => {
  it("same-provider fallback returns silent tier with FALLBACK_USED", () => {
    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: ["fast"],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, makePolicy(), REASON_CODES, "rate limit exceeded",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier).toBe("silent");
    expect(result.decision.selected_model_alias).toBe("fast");
    expect(result.decision.reason_code).toBe("FALLBACK_USED");
    expect(result.originalAlias).toBe("default-coding");
  });

  it("cross-provider fallback returns visible tier with FALLBACK_CROSS_PROVIDER", () => {
    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: ["gemini-pro"],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, makePolicy(), REASON_CODES, "model unavailable",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier).toBe("visible");
    expect(result.decision.selected_model_alias).toBe("gemini-pro");
    expect(result.decision.reason_code).toBe("FALLBACK_CROSS_PROVIDER");
    expect(result.originalAlias).toBe("default-coding");
    expect(result.reason).toContain("anthropic");
    expect(result.reason).toContain("google");
  });

  it("full chain exhaustion returns ok: false with FALLBACK_EXHAUSTED", () => {
    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: [],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, makePolicy(), REASON_CODES, "all models down",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.tier).toBe("visible");
    expect(result.error.reason_code).toBe("FALLBACK_EXHAUSTED");
    expect(result.error.taskCategory).toBe("coding");
    expect(result.originalAlias).toBe("default-coding");
  });

  it("fallback exhaustion preserves taskCategory for writing tasks", () => {
    const decision = makeDecision({
      taskCategory: "writing",
      selected_model_alias: "default-coding",
      fallback_chain: [],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, makePolicy(), REASON_CODES, "all fallbacks exhausted",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("FALLBACK_EXHAUSTED");
    expect(result.error.taskCategory).toBe("writing");
  });

  it("skips the original alias to prevent infinite loops", () => {
    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: ["default-coding", "fast"],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, makePolicy(), REASON_CODES, "timeout",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("fast");
  });

  it("skips deny-listed candidates", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: { model_alias: "default-coding", fallback_chain: ["fast"] },
            writing: { model_alias: "fast", fallback_chain: [] },
            analysis: { model_alias: "default-reasoning", fallback_chain: [] },
          },
          deny: { model_aliases: ["fast"] },
        },
      },
    });

    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: ["fast", "default-reasoning"],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, policy, REASON_CODES, "denied",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("default-reasoning");
  });

  it("skips candidates not in registry", () => {
    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: ["nonexistent", "fast"],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, makePolicy(), REASON_CODES, "unregistered test",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("fast");
  });

  it("preserves surface, scope, policy_version from original decision", () => {
    const decision = makeDecision({
      surface: "claude-code",
      scope: "session",
      policy_version: "2.0.0",
      selected_model_alias: "default-coding",
      fallback_chain: ["fast"],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, makePolicy(), REASON_CODES, "error",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.surface).toBe("claude-code");
    expect(result.decision.scope).toBe("session");
    expect(result.decision.policy_version).toBe("2.0.0");
  });

  it("returns FALLBACK_EXHAUSTED when all candidates are denied or unregistered", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: { model_alias: "default-coding", fallback_chain: ["fast"] },
            writing: { model_alias: "fast", fallback_chain: [] },
            analysis: { model_alias: "default-reasoning", fallback_chain: [] },
          },
          deny: { model_aliases: ["fast"] },
        },
      },
    });

    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: ["default-coding", "fast", "nonexistent"],
    });

    const result = orchestrateFallback(
      decision, REGISTRY, policy, REASON_CODES, "all bad",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("FALLBACK_EXHAUSTED");
  });
});

// ── buildFallbackLogEntry ──────────────────────────────────────

describe("buildFallbackLogEntry", () => {
  it("produces correct fields for silent tier (ok: true)", () => {
    const result: FallbackResult = {
      ok: true,
      tier: "silent",
      decision: makeDecision({
        selected_model_alias: "fast",
        reason_code: "FALLBACK_USED",
      }),
      originalAlias: "default-coding",
    };

    const entry = buildFallbackLogEntry(result, ctx());

    expect(entry.surface).toBe("cursor");
    expect(entry.taskCategory).toBe("coding");
    expect(entry.originalAlias).toBe("default-coding");
    expect(entry.selectedAlias).toBe("fast");
    expect(entry.tier).toBe("silent");
    expect(entry.reason).toBe("same-provider fallback");
    expect(entry.reason_code).toBe("FALLBACK_USED");
    expect(typeof entry.timestamp).toBe("string");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("produces correct fields for visible tier (ok: true)", () => {
    const result: FallbackResult = {
      ok: true,
      tier: "visible",
      decision: makeDecision({
        selected_model_alias: "gemini-pro",
        reason_code: "FALLBACK_CROSS_PROVIDER",
      }),
      originalAlias: "default-coding",
      reason: "Cross-provider fallback from anthropic to google: rate limit",
    };

    const entry = buildFallbackLogEntry(result, ctx());

    expect(entry.surface).toBe("cursor");
    expect(entry.taskCategory).toBe("coding");
    expect(entry.originalAlias).toBe("default-coding");
    expect(entry.selectedAlias).toBe("gemini-pro");
    expect(entry.tier).toBe("visible");
    expect(entry.reason).toContain("Cross-provider");
    expect(entry.reason_code).toBe("FALLBACK_CROSS_PROVIDER");
  });

  it("produces correct fields for visible tier (ok: false) with selectedAlias as null", () => {
    const result: FallbackResult = {
      ok: false,
      tier: "visible",
      error: {
        reason_code: "FALLBACK_EXHAUSTED",
        surface: "cursor",
        taskCategory: "coding",
        message: "All fallback candidates exhausted for cursor: all models down",
      },
      originalAlias: "default-coding",
    };

    const entry = buildFallbackLogEntry(result, ctx());

    expect(entry.surface).toBe("cursor");
    expect(entry.taskCategory).toBe("coding");
    expect(entry.originalAlias).toBe("default-coding");
    expect(entry.selectedAlias).toBeNull();
    expect(entry.tier).toBe("visible");
    expect(entry.reason).toContain("exhausted");
    expect(entry.reason_code).toBe("FALLBACK_EXHAUSTED");

    const serialised = JSON.parse(JSON.stringify(entry));
    expect(serialised).toHaveProperty("selectedAlias");
    expect(serialised.selectedAlias).toBeNull();
  });

  it("log entry is a plain serialisable object", () => {
    const result: FallbackResult = {
      ok: true,
      tier: "silent",
      decision: makeDecision({
        selected_model_alias: "fast",
        reason_code: "FALLBACK_USED",
      }),
      originalAlias: "default-coding",
    };

    const entry = buildFallbackLogEntry(result, ctx());
    const json = JSON.stringify(entry);
    const parsed = JSON.parse(json);

    expect(parsed.surface).toBe("cursor");
    expect(parsed.selectedAlias).toBe("fast");
    expect(parsed.tier).toBe("silent");
  });
});
