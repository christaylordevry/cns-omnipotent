/**
 * Routing decision engine — pure function, no side effects.
 *
 * All data (policy, registry, reason codes) is injected via parameters.
 * The module has zero imports from config/ or node:fs.
 */

import type {
  AliasRegistry,
  DecisionRecord,
  RoutingContext,
  RoutingDecisionResult,
  RoutingError,
  RoutingPolicy,
  Scope,
} from "./types.js";
import { validateVersionCompatibility } from "./version-guard.js";

const MODEL_ALIAS_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const VALID_SURFACES = new Set(["cursor", "claude-code", "vault-io", "gemini-cli", "unknown"]);
const VALID_SCOPES = new Set(["session", "task", "tool"]);
const SAFE_ERROR_REASON_CODE = "NO_MATCH_FAIL_CLOSED";

function makeError(
  reasonCode: string,
  ctx: RoutingContext,
  message: string,
): RoutingError {
  return {
    reason_code: reasonCode,
    surface: ctx.surface,
    taskCategory: ctx.taskCategory,
    message,
  };
}

function isDenied(alias: string, denyList: readonly string[] | undefined): boolean {
  return denyList !== undefined && denyList.includes(alias);
}

function isAllowed(
  alias: string,
  allowList: readonly string[] | undefined,
): boolean {
  if (allowList === undefined || allowList.length === 0) return true;
  return allowList.includes(alias);
}

function isRegistered(alias: string, registry: AliasRegistry): boolean {
  return Object.prototype.hasOwnProperty.call(registry.aliases, alias);
}

/**
 * Validates that a reason code exists in the injected set.
 * Returns the code if valid, or undefined if not.
 *
 * This intentionally does not throw: invalid policy/config state must still
 * surface as a structured RoutingError so callers can fail closed without
 * losing the attempted semantic reason code in the human-readable message.
 */
function validateReasonCode(
  code: string,
  reasonCodes: readonly string[],
): string | undefined {
  return reasonCodes.includes(code) ? code : undefined;
}

function assertReasonCodesConfigured(
  reasonCodes: readonly string[],
): asserts reasonCodes is readonly [string, ...string[]] {
  if (reasonCodes.length === 0) {
    throw new TypeError(
      'reasonCodes must contain at least one registered code, including "NO_MATCH_FAIL_CLOSED"',
    );
  }
}

function safeErrorReasonCode(reasonCodes: readonly string[]): string {
  assertReasonCodesConfigured(reasonCodes);
  return validateReasonCode(SAFE_ERROR_REASON_CODE, reasonCodes) ?? reasonCodes[0];
}

function invalidReasonCodeError(
  attemptedCode: string,
  ctx: RoutingContext,
  reasonCodes: readonly string[],
): RoutingDecisionResult {
  return {
    ok: false,
    error: makeError(
      safeErrorReasonCode(reasonCodes),
      ctx,
      `Attempted to emit unregistered reason code "${attemptedCode}". Returning a structured fail-closed error instead of throwing is intentional.`,
    ),
  };
}

function failClosedError(
  ctx: RoutingContext,
  reasonCodes: readonly string[],
  message: string,
): RoutingDecisionResult {
  return {
    ok: false,
    error: makeError(safeErrorReasonCode(reasonCodes), ctx, message),
  };
}

function isValidModelAlias(alias: unknown): alias is string {
  return typeof alias === "string" && MODEL_ALIAS_PATTERN.test(alias);
}

function validateDecisionRecordShape(
  decision: DecisionRecord,
  reasonCodes: readonly string[],
): string | undefined {
  if (!VALID_SURFACES.has(decision.surface)) {
    return `surface "${decision.surface}" is outside the schema enum`;
  }
  if (!VALID_SCOPES.has(decision.scope)) {
    return `scope "${decision.scope}" is outside the schema enum`;
  }
  if (typeof decision.policy_version !== "string" || decision.policy_version.length === 0) {
    return "policy_version must be a non-empty string";
  }
  if (!isValidModelAlias(decision.selected_model_alias)) {
    return `selected_model_alias "${decision.selected_model_alias}" does not match modelAlias`;
  }
  if (validateReasonCode(decision.reason_code, reasonCodes) === undefined) {
    return `reason_code "${decision.reason_code}" is not in the injected registry`;
  }
  if (!Array.isArray(decision.fallback_chain) || decision.fallback_chain.length > 16) {
    return "fallback_chain must be an array with at most 16 aliases";
  }
  if (!decision.fallback_chain.every((alias) => isValidModelAlias(alias))) {
    return "fallback_chain contains an alias that does not match modelAlias";
  }
  if (typeof decision.operator_override !== "boolean") {
    return "operator_override must be a boolean";
  }

  return undefined;
}

/**
 * Determine whether a candidate alias passes deny, allow, and registry checks.
 */
function isCandidateEligible(
  alias: string,
  denyList: readonly string[] | undefined,
  allowList: readonly string[] | undefined,
  registry: AliasRegistry,
  operatorOverride: boolean,
): { eligible: boolean; reason?: string } {
  if (isDenied(alias, denyList) && !operatorOverride) {
    return { eligible: false, reason: "denied by policy" };
  }
  if (!isAllowed(alias, allowList)) {
    return { eligible: false, reason: "not on allow list" };
  }
  if (!isRegistered(alias, registry)) {
    return { eligible: false, reason: "not in alias registry" };
  }
  return { eligible: true };
}

function buildValidatedDecision(
  context: RoutingContext,
  scope: Scope,
  policyVersion: string,
  selectedAlias: string,
  reasonCode: string,
  fallbackChain: readonly string[],
  operatorOverride: boolean,
  reasonCodes: readonly string[],
): RoutingDecisionResult {
  const decision = buildDecision(
    context,
    scope,
    policyVersion,
    selectedAlias,
    reasonCode,
    fallbackChain,
    operatorOverride,
  );
  const validationError = validateDecisionRecordShape(decision, reasonCodes);
  if (validationError !== undefined) {
    return failClosedError(
      context,
      reasonCodes,
      `Decision record failed schema-shape validation: ${validationError}`,
    );
  }

  return {
    ok: true,
    decision,
  };
}

/**
 * Pure routing decision function.
 *
 * Returns a discriminated union — never throws for policy failures.
 * Only truly unexpected type-level bugs (which TypeScript prevents)
 * would ever surface as exceptions.
 */
export function resolveRoutingDecision(
  context: RoutingContext,
  policy: RoutingPolicy,
  registry: AliasRegistry,
  reasonCodes: readonly string[],
): RoutingDecisionResult {
  assertReasonCodesConfigured(reasonCodes);

  const versionCheck = validateVersionCompatibility(policy.policy_version, registry.registry_version);
  if (!versionCheck.ok) {
    const code = validateReasonCode("VERSION_MISMATCH", reasonCodes);
    if (code === undefined) {
      return invalidReasonCodeError("VERSION_MISMATCH", context, reasonCodes);
    }
    return {
      ok: false,
      error: makeError(code, context, versionCheck.reason),
    };
  }

  const surfacePolicy = policy.surfaces[context.surface];
  if (surfacePolicy === undefined) {
    const code = validateReasonCode("NO_MATCH_FAIL_CLOSED", reasonCodes);
    if (code === undefined) {
      return invalidReasonCodeError("NO_MATCH_FAIL_CLOSED", context, reasonCodes);
    }
    return {
      ok: false,
      error: makeError(code, context, `Unknown surface: ${context.surface}`),
    };
  }

  const taskDefaults = surfacePolicy.defaults[context.taskCategory];
  if (taskDefaults === undefined) {
    const code = validateReasonCode("NO_MATCH_FAIL_CLOSED", reasonCodes);
    if (code === undefined) {
      return invalidReasonCodeError("NO_MATCH_FAIL_CLOSED", context, reasonCodes);
    }
    return {
      ok: false,
      error: makeError(
        code,
        context,
        `Unknown task category: ${context.taskCategory}`,
      ),
    };
  }

  const scope: Scope = context.scope ?? surfacePolicy.default_scope ?? "session";
  const denyList = surfacePolicy.deny?.model_aliases;
  const allowList = surfacePolicy.allow?.model_aliases;
  const primaryAlias = taskDefaults.model_alias;
  const fallbackChain = taskDefaults.fallback_chain;

  // ── Try primary alias ────────────────────────────────────────

  const primaryDenied = isDenied(primaryAlias, denyList);

  if (!isRegistered(primaryAlias, registry)) {
    return failClosedError(
      context,
      reasonCodes,
      `Primary alias "${primaryAlias}" is not in the registry; fallback walk was skipped.`,
    );
  }

  if (primaryDenied && context.operatorOverride) {
    // Override bypasses deny but alias must exist in registry.
    const reasonCode = validateReasonCode("OPERATOR_OVERRIDE", reasonCodes);
    if (reasonCode === undefined) {
      return invalidReasonCodeError("OPERATOR_OVERRIDE", context, reasonCodes);
    }

    return buildValidatedDecision(
      context,
      scope,
      policy.policy_version,
      primaryAlias,
      reasonCode,
      fallbackChain,
      true,
      reasonCodes,
    );
  }

  if (!primaryDenied && isAllowed(primaryAlias, allowList) && isRegistered(primaryAlias, registry)) {
    const reasonCode = validateReasonCode("DEFAULT", reasonCodes);
    if (reasonCode === undefined) {
      return invalidReasonCodeError("DEFAULT", context, reasonCodes);
    }

    return buildValidatedDecision(
      context,
      scope,
      policy.policy_version,
      primaryAlias,
      reasonCode,
      fallbackChain,
      context.operatorOverride,
      reasonCodes,
    );
  }

  // ── Walk fallback chain ──────────────────────────────────────

  for (let i = 0; i < fallbackChain.length; i++) {
    const candidate = fallbackChain[i];

    if (isDenied(candidate, denyList) && context.operatorOverride) {
      if (isRegistered(candidate, registry)) {
        const reasonCode = validateReasonCode("OPERATOR_OVERRIDE", reasonCodes);
        if (reasonCode === undefined) {
          return invalidReasonCodeError("OPERATOR_OVERRIDE", context, reasonCodes);
        }
        return buildValidatedDecision(
          context,
          scope,
          policy.policy_version,
          candidate,
          reasonCode,
          fallbackChain,
          true,
          reasonCodes,
        );
      }
      continue;
    }

    const { eligible } = isCandidateEligible(
      candidate,
      denyList,
      allowList,
      registry,
      false,
    );
    if (eligible) {
      const reasonCode = validateReasonCode("POLICY_DENY", reasonCodes);
      if (reasonCode === undefined) {
        return invalidReasonCodeError("POLICY_DENY", context, reasonCodes);
      }
      return buildValidatedDecision(
        context,
        scope,
        policy.policy_version,
        candidate,
        reasonCode,
        fallbackChain,
        context.operatorOverride,
        reasonCodes,
      );
    }
  }

  // ── All fallbacks exhausted ──────────────────────────────────

  const exhaustedCode = validateReasonCode("FALLBACK_EXHAUSTED", reasonCodes);
  if (exhaustedCode === undefined) {
    return invalidReasonCodeError("FALLBACK_EXHAUSTED", context, reasonCodes);
  }

  return {
    ok: false,
    error: makeError(
      exhaustedCode,
      context,
      `All fallback aliases exhausted for ${context.surface}/${context.taskCategory}`,
    ),
  };
}

function buildDecision(
  context: RoutingContext,
  scope: Scope,
  policyVersion: string,
  selectedAlias: string,
  reasonCode: string,
  fallbackChain: readonly string[],
  operatorOverride: boolean,
): DecisionRecord {
  return {
    surface: context.surface,
    taskCategory: context.taskCategory,
    scope,
    policy_version: policyVersion,
    selected_model_alias: selectedAlias,
    reason_code: reasonCode,
    fallback_chain: fallbackChain,
    operator_override: operatorOverride,
  };
}
