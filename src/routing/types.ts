/**
 * TypeScript types for the CNS routing decision engine.
 *
 * These mirror the shapes in policy.schema.json and
 * model-alias-registry.schema.json. The engine treats them as
 * injected data — no JSON Schema validation at runtime.
 */

// ── Enums (matching schema definitions) ────────────────────────

export type Surface = "cursor" | "claude-code" | "vault-io" | "gemini-cli" | "unknown";

export type TaskCategory = "coding" | "writing" | "analysis";

export type Scope = "session" | "task" | "tool";

// ── Routing context (caller-provided) ──────────────────────────

export interface RoutingContext {
  readonly surface: Surface;
  readonly taskCategory: TaskCategory;
  readonly operatorOverride: boolean;
  /** If omitted the engine reads policy.surfaces[surface].default_scope */
  readonly scope?: Scope;
}

// ── Policy shape (mirrors policy.schema.json) ──────────────────

export interface DefaultSelection {
  readonly model_alias: string;
  readonly fallback_chain: readonly string[];
}

export interface SurfacePolicy {
  readonly defaults: Readonly<Record<TaskCategory, DefaultSelection>>;
  readonly allow?: {
    readonly model_aliases?: readonly string[];
    readonly tools?: readonly string[];
  };
  readonly deny?: {
    readonly model_aliases?: readonly string[];
    readonly tools?: readonly string[];
  };
  readonly default_scope?: Scope;
}

export interface RoutingPolicy {
  readonly policy_version: string;
  readonly surfaces: Readonly<Record<string, SurfacePolicy>>;
}

// ── Alias registry shape (mirrors model-alias-registry.schema.json)

export interface AliasEntry {
  readonly provider: string;
  readonly model_id: string;
  readonly label?: string;
  readonly capabilities?: readonly string[];
  readonly notes?: string;
}

export interface AliasRegistry {
  readonly registry_version: string;
  readonly aliases: Readonly<Record<string, AliasEntry>>;
}

// ── Decision output ────────────────────────────────────────────

export interface DecisionRecord {
  readonly surface: Surface;
  readonly taskCategory: TaskCategory;
  readonly scope: Scope;
  readonly policy_version: string;
  readonly selected_model_alias: string;
  readonly reason_code: string;
  readonly fallback_chain: readonly string[];
  readonly operator_override: boolean;
}

export interface RoutingError {
  readonly reason_code: string;
  readonly surface: string;
  readonly taskCategory: string;
  readonly message: string;
}

export type RoutingDecisionResult =
  | { readonly ok: true; readonly decision: DecisionRecord }
  | { readonly ok: false; readonly error: RoutingError };

// ── Fallback types ─────────────────────────────────────────────

export type FallbackTier = "silent" | "visible";

export type FallbackResult =
  | { readonly ok: true; readonly tier: "silent"; readonly decision: DecisionRecord; readonly originalAlias: string }
  | { readonly ok: true; readonly tier: "visible"; readonly decision: DecisionRecord; readonly originalAlias: string; readonly reason: string }
  | { readonly ok: false; readonly tier: "visible"; readonly error: RoutingError; readonly originalAlias: string };

export interface FallbackLogEntry {
  readonly timestamp: string;
  readonly surface: Surface;
  readonly taskCategory: TaskCategory;
  readonly originalAlias: string;
  readonly selectedAlias: string | null;
  readonly tier: FallbackTier;
  readonly reason: string;
  readonly reason_code: string;
}

export type OnFallbackCallback = (result: FallbackResult) => void;

// ── Adapter output ─────────────────────────────────────────────

export type AdapterResult =
  | { readonly ok: true; readonly writtenPath: string; readonly modelResolved: string }
  | { readonly ok: false; readonly error: string; readonly surface: string };

// ── Audit log output ───────────────────────────────────────────

export type AuditWriteResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly error: string };
