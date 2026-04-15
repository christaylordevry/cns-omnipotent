/**
 * Fallback orchestrator — walks the fallback chain from a failed
 * routing decision and returns the first eligible candidate.
 *
 * Pure function: no filesystem reads, no network calls, no logging.
 * All data is injected via parameters.
 */

import type {
  AliasRegistry,
  DecisionRecord,
  FallbackResult,
  RoutingPolicy,
} from "./types.js";

export function orchestrateFallback(
  originalDecision: DecisionRecord,
  registry: AliasRegistry,
  policy: RoutingPolicy,
  reasonCodes: readonly string[],
  failureReason: string,
): FallbackResult {
  const originalAlias = originalDecision.selected_model_alias;
  const originalEntry = registry.aliases[originalAlias];
  if (originalEntry === undefined) {
    return {
      ok: false,
      tier: "visible",
      error: {
        reason_code: "FALLBACK_EXHAUSTED",
        surface: originalDecision.surface,
        taskCategory: originalDecision.taskCategory,
        message: `Original alias "${originalAlias}" not in registry; cannot determine provider for tier classification`,
      },
      originalAlias,
    };
  }

  const originalProvider = originalEntry.provider;
  const surfacePolicy = policy.surfaces[originalDecision.surface];
  const denyList = surfacePolicy?.deny?.model_aliases ?? [];

  for (const candidate of originalDecision.fallback_chain) {
    if (candidate === originalAlias) continue;
    if (!Object.prototype.hasOwnProperty.call(registry.aliases, candidate)) continue;
    if (denyList.includes(candidate)) continue;

    const candidateProvider = registry.aliases[candidate].provider;
    const tier = candidateProvider === originalProvider ? "silent" : "visible";
    const reasonCode = tier === "silent" ? "FALLBACK_USED" : "FALLBACK_CROSS_PROVIDER";

    if (!reasonCodes.includes(reasonCode)) {
      return {
        ok: false,
        tier: "visible",
        error: {
          reason_code: "FALLBACK_EXHAUSTED",
          surface: originalDecision.surface,
          taskCategory: originalDecision.taskCategory,
          message: `Reason code "${reasonCode}" not in registered set; fail closed`,
        },
        originalAlias,
      };
    }

    const decision: DecisionRecord = {
      surface: originalDecision.surface,
      taskCategory: originalDecision.taskCategory,
      scope: originalDecision.scope,
      policy_version: originalDecision.policy_version,
      selected_model_alias: candidate,
      reason_code: reasonCode,
      fallback_chain: originalDecision.fallback_chain,
      operator_override: originalDecision.operator_override,
    };

    if (tier === "silent") {
      return { ok: true, tier, decision, originalAlias };
    }

    return {
      ok: true,
      tier,
      decision,
      originalAlias,
      reason: `Cross-provider fallback from ${originalProvider} to ${candidateProvider}: ${failureReason}`,
    };
  }

  return {
    ok: false,
    tier: "visible",
    error: {
      reason_code: "FALLBACK_EXHAUSTED",
      surface: originalDecision.surface,
      taskCategory: originalDecision.taskCategory,
      message: `All fallback candidates exhausted for ${originalDecision.surface}: ${failureReason}`,
    },
    originalAlias,
  };
}
