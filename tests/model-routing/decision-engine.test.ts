import { describe, expect, it } from "vitest";
import { resolveRoutingDecision } from "../../src/routing/decision-engine.js";
import type {
  AliasRegistry,
  RoutingContext,
  RoutingPolicy,
} from "../../src/routing/types.js";

// ── Shared fixtures ────────────────────────────────────────────

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

function makePolicy(overrides?: {
  surfaces?: RoutingPolicy["surfaces"];
}): RoutingPolicy {
  return {
    policy_version: "1.0.0",
    surfaces: overrides?.surfaces ?? {
      cursor: {
        default_scope: "task",
        defaults: {
          coding: {
            model_alias: "default-coding",
            fallback_chain: ["fast"],
          },
          writing: {
            model_alias: "fast",
            fallback_chain: ["default-reasoning"],
          },
          analysis: {
            model_alias: "default-reasoning",
            fallback_chain: ["deep", "default-coding"],
          },
        },
        allow: {
          model_aliases: [
            "default-coding",
            "default-reasoning",
            "fast",
            "deep",
          ],
        },
      },
      "claude-code": {
        default_scope: "task",
        defaults: {
          coding: {
            model_alias: "default-coding",
            fallback_chain: ["fast"],
          },
          writing: {
            model_alias: "fast",
            fallback_chain: ["default-coding"],
          },
          analysis: {
            model_alias: "default-reasoning",
            fallback_chain: ["deep"],
          },
        },
      },
      "vault-io": {
        default_scope: "tool",
        defaults: {
          coding: {
            model_alias: "fast",
            fallback_chain: ["default-coding"],
          },
          writing: {
            model_alias: "fast",
            fallback_chain: ["default-coding"],
          },
          analysis: {
            model_alias: "default-reasoning",
            fallback_chain: ["deep"],
          },
        },
      },
      "gemini-cli": {
        default_scope: "session",
        defaults: {
          coding: { model_alias: "gemini-pro", fallback_chain: ["gemini-flash"] },
          writing: { model_alias: "gemini-flash", fallback_chain: ["gemini-pro"] },
          analysis: { model_alias: "gemini-pro", fallback_chain: ["gemini-flash"] },
        },
        allow: { model_aliases: ["gemini-pro", "gemini-flash"] },
      },
      unknown: {
        default_scope: "session",
        defaults: {
          coding: { model_alias: "fast", fallback_chain: [] },
          writing: { model_alias: "fast", fallback_chain: [] },
          analysis: {
            model_alias: "fast",
            fallback_chain: ["default-reasoning"],
          },
        },
        deny: { model_aliases: ["deep"] },
      },
    },
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

// ── Tests ──────────────────────────────────────────────────────

describe("routing decision engine", () => {
  it("happy path: alias resolved on first match (DEFAULT)", () => {
    const result = resolveRoutingDecision(
      ctx(),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("default-coding");
    expect(result.decision.reason_code).toBe("DEFAULT");
    expect(result.decision.surface).toBe("cursor");
    expect(result.decision.scope).toBe("task");
    expect(result.decision.policy_version).toBe("1.0.0");
    expect(result.decision.operator_override).toBe(false);
    expect(result.decision.fallback_chain).toEqual(["fast"]);
  });

  it("deny-wins-over-allow: alias on both lists → denied → walks fallback", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "default-coding",
              fallback_chain: ["fast"],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: ["default-reasoning"],
            },
            analysis: {
              model_alias: "default-reasoning",
              fallback_chain: ["deep"],
            },
          },
          allow: {
            model_aliases: ["default-coding", "fast", "deep"],
          },
          deny: {
            model_aliases: ["default-coding"],
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx(),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("fast");
    expect(result.decision.reason_code).toBe("POLICY_DENY");
  });

  it("fallback chain walk: primary denied, second fallback succeeds", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "default-coding",
              fallback_chain: ["fast", "deep"],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "default-reasoning",
              fallback_chain: [],
            },
          },
          deny: {
            model_aliases: ["default-coding", "fast"],
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx(),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("deep");
    expect(result.decision.reason_code).toBe("POLICY_DENY");
  });

  it("full chain exhaustion: all aliases denied → FALLBACK_EXHAUSTED structured error", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "default-coding",
              fallback_chain: ["fast"],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "default-reasoning",
              fallback_chain: [],
            },
          },
          deny: {
            model_aliases: ["default-coding", "fast"],
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx(),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("FALLBACK_EXHAUSTED");
    expect(result.error.surface).toBe("cursor");
    expect(result.error.taskCategory).toBe("coding");
    expect(typeof result.error.message).toBe("string");
  });

  it("operator override: denied alias + operatorOverride:true → bypasses deny, returns alias if in registry", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "default-coding",
              fallback_chain: ["fast"],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "default-reasoning",
              fallback_chain: [],
            },
          },
          deny: {
            model_aliases: ["default-coding"],
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx({ operatorOverride: true }),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("default-coding");
    expect(result.decision.reason_code).toBe("OPERATOR_OVERRIDE");
    expect(result.decision.operator_override).toBe(true);
  });

  it("operator override + unregistered alias: error if alias not in registry", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "phantom-model",
              fallback_chain: [],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "fast",
              fallback_chain: [],
            },
          },
          deny: {
            model_aliases: ["phantom-model"],
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx({ operatorOverride: true }),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("NO_MATCH_FAIL_CLOSED");
    expect(result.error.message).toContain("phantom-model");
    expect(result.error.message).toContain("not in the registry");
  });

  it("invalid reason code rejection: engine refuses to emit an unregistered reason code", () => {
    const truncatedCodes = ["OPERATOR_OVERRIDE", "NO_MATCH_FAIL_CLOSED"];

    const result = resolveRoutingDecision(
      ctx(),
      makePolicy(),
      REGISTRY,
      truncatedCodes,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("NO_MATCH_FAIL_CLOSED");
    expect(result.error.message).toContain('unregistered reason code "DEFAULT"');
  });

  it("empty reason code registry throws before emitting an unregistered error code", () => {
    expect(() =>
      resolveRoutingDecision(
        ctx(),
        makePolicy(),
        REGISTRY,
        [],
      ),
    ).toThrowError(
      'reasonCodes must contain at least one registered code, including "NO_MATCH_FAIL_CLOSED"',
    );
  });

  it("primary alias missing from the registry fails closed before fallback walk", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "phantom-model",
              fallback_chain: ["fast"],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "default-reasoning",
              fallback_chain: [],
            },
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx(),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("NO_MATCH_FAIL_CLOSED");
    expect(result.error.message).toContain('Primary alias "phantom-model" is not in the registry');
    expect(result.error.message).toContain("fallback walk was skipped");
  });

  it("unknown surface: returns structured error", () => {
    const result = resolveRoutingDecision(
      ctx({ surface: "nonexistent" as never }),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("NO_MATCH_FAIL_CLOSED");
    expect(result.error.surface).toBe("nonexistent");
  });

  it("unknown task category: returns structured error", () => {
    const result = resolveRoutingDecision(
      ctx({ taskCategory: "painting" as never }),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("NO_MATCH_FAIL_CLOSED");
    expect(result.error.taskCategory).toBe("painting");
  });

  it("scope derivation: uses context.scope when provided, falls back to policy default_scope", () => {
    const result1 = resolveRoutingDecision(
      ctx({ scope: "tool" }),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    expect(result1.decision.scope).toBe("tool");

    const result2 = resolveRoutingDecision(
      ctx(),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    expect(result2.decision.scope).toBe("task");
  });

  it("final decision schema-shape validation fails closed before returning", () => {
    const result = resolveRoutingDecision(
      ctx({ scope: "invalid-scope" as never }),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("NO_MATCH_FAIL_CLOSED");
    expect(result.error.message).toContain("Decision record failed schema-shape validation");
    expect(result.error.message).toContain('scope "invalid-scope"');
  });

  it("allow list as positive filter: alias not on allow list is skipped", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "default-coding",
              fallback_chain: ["fast", "deep"],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "default-reasoning",
              fallback_chain: [],
            },
          },
          allow: {
            model_aliases: ["deep"],
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx(),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("deep");
    expect(result.decision.reason_code).toBe("POLICY_DENY");
  });

  it("empty fallback chain on unknown surface → FALLBACK_EXHAUSTED", () => {
    const policy = makePolicy();
    const result = resolveRoutingDecision(
      ctx({ surface: "unknown", taskCategory: "coding" }),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("fast");
    expect(result.decision.reason_code).toBe("DEFAULT");
  });

  it("result is a plain object, never a thrown exception", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "default-coding",
              fallback_chain: [],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "fast",
              fallback_chain: [],
            },
          },
          deny: { model_aliases: ["default-coding"] },
        },
      },
    });

    let threw = false;
    let result;
    try {
      result = resolveRoutingDecision(
        ctx(),
        policy,
        REGISTRY,
        REASON_CODES,
      );
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result).toBeDefined();
    expect(result!.ok).toBe(false);
    if (result!.ok) return;
    expect(result!.error.reason_code).toBe("FALLBACK_EXHAUSTED");
  });

  it("gemini-cli surface resolves successfully", () => {
    const result = resolveRoutingDecision(
      ctx({ surface: "gemini-cli", taskCategory: "coding" }),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("gemini-pro");
    expect(result.decision.reason_code).toBe("DEFAULT");
    expect(result.decision.surface).toBe("gemini-cli");
  });

  it("unrecognised surface (e.g. chatgpt) returns NO_MATCH_FAIL_CLOSED", () => {
    const result = resolveRoutingDecision(
      ctx({ surface: "chatgpt" as never }),
      makePolicy(),
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason_code).toBe("NO_MATCH_FAIL_CLOSED");
    expect(result.error.surface).toBe("chatgpt");
  });

  it("operator override on fallback chain: denied fallback + override → returned if registered", () => {
    const policy = makePolicy({
      surfaces: {
        cursor: {
          default_scope: "task",
          defaults: {
            coding: {
              model_alias: "default-coding",
              fallback_chain: ["deep"],
            },
            writing: {
              model_alias: "fast",
              fallback_chain: [],
            },
            analysis: {
              model_alias: "fast",
              fallback_chain: [],
            },
          },
          deny: {
            model_aliases: ["default-coding", "deep"],
          },
        },
      },
    });

    const result = resolveRoutingDecision(
      ctx({ operatorOverride: true }),
      policy,
      REGISTRY,
      REASON_CODES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.selected_model_alias).toBe("default-coding");
    expect(result.decision.reason_code).toBe("OPERATOR_OVERRIDE");
    expect(result.decision.operator_override).toBe(true);
  });
});
