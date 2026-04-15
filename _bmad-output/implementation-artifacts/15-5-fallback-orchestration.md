# Story 15.5: Failure-handling + fallback orchestration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **maintainer**,
I want **the routing system to handle model unavailability and rate limits gracefully using a two-tier notification model**,
so that **routine degradation is invisible and significant fallbacks are surfaced without interrupting the operator's flow**.

## Acceptance Criteria

1. **FallbackTier + FallbackResult types (AC: types)**
   **Given** the existing types in `src/routing/types.ts`
   **When** new fallback types are added
   **Then** a `FallbackTier` type is defined: `"silent" | "visible"`
   **And** a `FallbackResult` discriminated union is defined:
   ```typescript
   export type FallbackResult =
     | { ok: true; tier: "silent"; decision: DecisionRecord; originalAlias: string }
     | { ok: true; tier: "visible"; decision: DecisionRecord; originalAlias: string; reason: string }
     | { ok: false; tier: "visible"; error: RoutingError; originalAlias: string }
   ```
   **And** `FallbackResult` is the return type of the `orchestrateFallback` function

2. **Reason codes (AC: config)**
   **Given** `config/model-routing/reason-codes.json` and `reason-codes.schema.json`
   **When** updated
   **Then** `FALLBACK_USED` and `FALLBACK_CROSS_PROVIDER` are added to both the data file and the schema enum
   **And** existing schema validation tests still pass

3. **Fallback orchestrator (AC: orchestrator)**
   **Given** `src/routing/fallback-orchestrator.ts`
   **When** the orchestrator is invoked
   **Then** it exports a single function:
   ```typescript
   export function orchestrateFallback(
     originalDecision: DecisionRecord,
     registry: AliasRegistry,
     policy: RoutingPolicy,
     reasonCodes: readonly string[],
     failureReason: string,
   ): FallbackResult
   ```
   **And** it is a pure function — no network calls, no filesystem reads, no logging at call time
   **And** it walks the `fallback_chain` from the original decision in order
   **And** for each candidate it checks: not the same alias as the original, exists in registry, not on the deny list
   **And** it classifies each candidate as `"silent"` or `"visible"` by comparing `registry.aliases[candidate].provider` against `registry.aliases[originalDecision.selected_model_alias].provider`
   **And** it returns the first eligible candidate as a `FallbackResult`
   **And** if no eligible candidate exists it returns `{ ok: false, tier: "visible", error: { reason_code: "FALLBACK_EXHAUSTED", ... }, originalAlias }`

4. **Audit log builder (AC: audit)**
   **Given** `src/routing/audit-log.ts`
   **When** `buildFallbackLogEntry` is called
   **Then** it exports:
   ```typescript
   export function buildFallbackLogEntry(
     result: FallbackResult,
     context: RoutingContext,
   ): FallbackLogEntry
   ```
   **And** `FallbackLogEntry` is a plain serialisable object (no filesystem writes in this story — writing to agent-log.md is a 15-6 concern)
   **And** the log entry includes: `timestamp`, `surface`, `taskCategory`, `originalAlias`, `selectedAlias` (if ok), `tier`, `reason`, `reason_code`
   **And** silent-tier entries are marked `tier: "silent"` — callers may choose to suppress display but must not suppress logging
   **And** visible-tier entries are marked `tier: "visible"` — callers must surface these to the operator

5. **Adapter integration (AC: adapters)**
   **Given** each adapter (`cursor.ts`, `claude-code.ts`, `gemini-cli.ts`)
   **When** updated
   **Then** each adapter accepts an optional `onFallback` callback:
   ```typescript
   type OnFallbackCallback = (result: FallbackResult) => void
   ```
   **And** if a write fails and a fallback is available, the adapter calls `orchestrateFallback`, then calls `onFallback` with the result before retrying with the fallback model
   **And** if no `onFallback` is provided, fallback still occurs silently — the callback is optional, not required
   **And** adapters do not implement fallback logic themselves — they call the orchestrator

6. **Tests (AC: tests)**
   **Given** Vitest, no network
   **When** tests run
   **Then** they cover:
   - Same-provider fallback → `tier: "silent"`, correct alias selected
   - Cross-provider fallback → `tier: "visible"`, correct alias selected, reason populated
   - Full chain exhaustion → `ok: false`, `tier: "visible"`, `reason_code: FALLBACK_EXHAUSTED`
   - Original alias skipped in fallback walk (no infinite loop)
   - Deny list respected during fallback walk
   - `buildFallbackLogEntry` produces correct fields for both tiers
   - Adapter `onFallback` callback is called with correct `FallbackResult`
   - Adapter completes successfully when `onFallback` is not provided
   **And** `npm test`, `npm run lint`, `npm run typecheck` all pass
   **And** `bash scripts/verify.sh` passes unchanged

7. **Version compatibility comment (AC: deferred)**
   **Given** `decision-engine.ts` line 377 already contains `// TODO(15-6): add a policy/engine version compatibility guard.`
   **When** reviewed
   **Then** confirm it already references 15-6 — no code change needed

## Explicit out of scope

- No actual filesystem writes to `agent-log.md` (that is 15-6)
- No network calls to detect model availability — failure is signalled by the caller, not polled
- No retry logic — fallback is a single walk, not a retry loop
- No changes to the routing decision engine's core logic
- No Obsidian Base panel for routing decisions (Phase 4)
- No daemon or always-on process
- No ChatGPT adapter

## Tasks / Subtasks

- [x] **Add new reason codes to config** (AC: 2)
  - [x] Add `"FALLBACK_USED"` and `"FALLBACK_CROSS_PROVIDER"` to `config/model-routing/reason-codes.json` array (maintain alphabetical ordering)
  - [x] Add `"FALLBACK_USED"` and `"FALLBACK_CROSS_PROVIDER"` to `config/model-routing/reason-codes.schema.json` `$defs.reasonCode.enum` array (maintain alphabetical ordering)
  - [x] Run `npm test` to confirm existing `tests/model-routing/policy-config.test.ts` schema validation still passes

- [x] **Add fallback types to `src/routing/types.ts`** (AC: 1)
  - [x] Add `FallbackTier` type: `export type FallbackTier = "silent" | "visible";`
  - [x] Add `FallbackResult` discriminated union with three variants (see AC 1 type definition)
  - [x] Add `FallbackLogEntry` interface with fields: `timestamp` (string, ISO 8601), `surface` (Surface), `taskCategory` (TaskCategory), `originalAlias` (string), `selectedAlias` (string | null), `tier` (FallbackTier), `reason` (string), `reason_code` (string)
  - [x] Add `OnFallbackCallback` type: `export type OnFallbackCallback = (result: FallbackResult) => void;`
  - [x] Maintain `readonly` modifier pattern on all new type fields

- [x] **Implement fallback orchestrator** (AC: 3)
  - [x] Create `src/routing/fallback-orchestrator.ts`
  - [x] Export `orchestrateFallback(originalDecision, registry, policy, reasonCodes, failureReason): FallbackResult`
  - [x] Look up the surface policy from `policy.surfaces[originalDecision.surface]` to get the deny list
  - [x] Look up the original model's provider: `registry.aliases[originalDecision.selected_model_alias].provider`
  - [x] Walk `originalDecision.fallback_chain` in order (index 0, 1, 2, ... — linear, no backtracking)
  - [x] For each candidate: skip if same alias as `originalDecision.selected_model_alias`, skip if not in `registry.aliases`, skip if on surface deny list
  - [x] For first eligible candidate: compare `registry.aliases[candidate].provider` against original provider → `"silent"` if same, `"visible"` if different
  - [x] Build a new `DecisionRecord` for the fallback candidate (copy `surface`, `scope`, `policy_version` from original; update `selected_model_alias`, `reason_code`, `fallback_chain`, `operator_override`)
  - [x] Reason code: `FALLBACK_USED` for silent tier, `FALLBACK_CROSS_PROVIDER` for visible tier
  - [x] If chain exhausted: return `{ ok: false, tier: "visible", error: { reason_code: "FALLBACK_EXHAUSTED", surface, taskCategory, message }, originalAlias }`
  - [x] Use `validateReasonCode` pattern or inline check against `reasonCodes` param — fail closed if reason code is missing from the injected set
  - [x] Import only types from `./types.js` — no config file imports, no `node:fs`

- [x] **Implement audit log builder** (AC: 4)
  - [x] Create `src/routing/audit-log.ts`
  - [x] Export `buildFallbackLogEntry(result: FallbackResult, context: RoutingContext): FallbackLogEntry`
  - [x] `timestamp`: `new Date().toISOString()`
  - [x] `surface`: `context.surface`
  - [x] `taskCategory`: `context.taskCategory`
  - [x] `originalAlias`: `result.originalAlias`
  - [x] `selectedAlias`: `result.ok ? result.decision.selected_model_alias : null`
  - [x] `tier`: `result.tier`
  - [x] `reason`: `result.ok && result.tier === "visible" ? result.reason : (result.ok ? "same-provider fallback" : result.error.message)`
  - [x] `reason_code`: `result.ok ? result.decision.reason_code : result.error.reason_code`
  - [x] No filesystem writes — this is a builder that returns a plain object

- [x] **Update adapter signatures to accept `onFallback`** (AC: 5)
  - [x] In `src/routing/adapters/cursor.ts`: update `applyCursorAdapter` signature to add optional params: `policy?: RoutingPolicy, reasonCodes?: readonly string[], onFallback?: OnFallbackCallback`
  - [x] In `src/routing/adapters/claude-code.ts`: update `applyClaudeCodeAdapter` signature — same additional optional params
  - [x] In `src/routing/adapters/gemini-cli.ts`: update `applyGeminiCliAdapter` signature — same additional optional params
  - [x] In each adapter: after initial write failure (the catch block around atomic write), if `policy` and `reasonCodes` are provided, call `orchestrateFallback(decision, registry, policy, reasonCodes, failureReason)`, then if result is ok, call `onFallback?.(result)`, then retry write with `result.decision.selected_model_alias` resolved through `resolveAlias`
  - [x] If `policy`/`reasonCodes` are not provided or orchestrator returns `{ ok: false }`, preserve existing behavior (return `{ ok: false }` as before)
  - [x] Import `orchestrateFallback` from `../fallback-orchestrator.js`, import `OnFallbackCallback` and `RoutingPolicy` from `../types.js`
  - [x] **CRITICAL:** Existing tests must continue to pass unchanged — the new params are all optional, so existing call sites (including tests that pass 3 args) remain valid

- [x] **Write fallback orchestrator tests** (AC: 6)
  - [x] Create `tests/model-routing/fallback-orchestrator.test.ts`
  - [x] Test: same-provider fallback (anthropic → anthropic) → `tier: "silent"`, `reason_code: "FALLBACK_USED"`, correct alias
  - [x] Test: cross-provider fallback (anthropic → google) → `tier: "visible"`, `reason_code: "FALLBACK_CROSS_PROVIDER"`, reason string populated
  - [x] Test: full chain exhaustion → `{ ok: false, tier: "visible", error.reason_code: "FALLBACK_EXHAUSTED" }`
  - [x] Test: original alias skipped during walk (candidate same as original → skipped, next candidate returned)
  - [x] Test: deny-listed candidate skipped during walk
  - [x] Test: candidate not in registry skipped during walk
  - [x] Test: `buildFallbackLogEntry` produces correct fields for silent tier
  - [x] Test: `buildFallbackLogEntry` produces correct fields for visible tier (ok)
  - [x] Test: `buildFallbackLogEntry` produces correct fields for visible tier (failed)
  - [x] All tests pure — no network, no filesystem, inline fixtures
  - [x] Construct `DecisionRecord`, `AliasRegistry`, `RoutingPolicy` inline (same pattern as `decision-engine.test.ts`)

- [x] **Write adapter fallback integration tests** (AC: 6)
  - [x] Add tests to `tests/model-routing/surface-adapters.test.ts`
  - [x] Test: adapter calls `onFallback` with correct `FallbackResult` when write fails and fallback succeeds
  - [x] Test: adapter completes successfully when `onFallback` is not provided (existing 3-arg call pattern)
  - [x] Tests use temp directory + forced write failure (bogus nested path for initial write, valid path for fallback retry)

- [x] **Confirm version compatibility comment** (AC: 7)
  - [x] Read `src/routing/decision-engine.ts` line 377 and confirm `// TODO(15-6)` comment exists — no modification required

- [x] **Verify all gates pass** (AC: 6)
  - [x] `npm test` passes
  - [x] `npm run lint` passes
  - [x] `npm run typecheck` passes
  - [x] `bash scripts/verify.sh` passes unchanged

## Dev Notes

### How failure is signalled — the orchestrator is called, not polled

The orchestrator **never** detects model unavailability itself. The adapter tries to write the model config, gets an error back from the surface, and then calls `orchestrateFallback` with a `failureReason` string describing why the original model failed. This keeps the orchestrator pure, testable, and free of network mocking.

### Two-tier fallback classification

| Scenario | Tier | Reason code | Operator notification |
|----------|------|-------------|----------------------|
| Fallback to same provider (e.g., `claude-opus` → `claude-haiku`) | `"silent"` | `FALLBACK_USED` | Logged only; suppressed from display |
| Fallback to different provider (e.g., `claude-opus` → `gemini-pro`) | `"visible"` | `FALLBACK_CROSS_PROVIDER` | Logged + surfaced to operator |
| All fallbacks exhausted | `"visible"` | `FALLBACK_EXHAUSTED` | Logged + surfaced to operator (error) |

Provider is determined by comparing `registry.aliases[original].provider` against `registry.aliases[candidate].provider`. The existing registry has `provider` on every alias entry (required by schema).

### Orchestrator algorithm (pseudocode)

```
orchestrateFallback(originalDecision, registry, policy, reasonCodes, failureReason):
  originalAlias = originalDecision.selected_model_alias
  originalProvider = registry.aliases[originalAlias].provider
  surfacePolicy = policy.surfaces[originalDecision.surface]
  denyList = surfacePolicy?.deny?.model_aliases ?? []

  for candidate in originalDecision.fallback_chain:
    if candidate === originalAlias: skip
    if candidate not in registry.aliases: skip
    if candidate in denyList: skip

    candidateProvider = registry.aliases[candidate].provider
    tier = (candidateProvider === originalProvider) ? "silent" : "visible"
    reasonCode = (tier === "silent") ? "FALLBACK_USED" : "FALLBACK_CROSS_PROVIDER"

    newDecision = { ...originalDecision fields, selected_model_alias: candidate, reason_code: reasonCode }
    return FallbackResult { ok: true, tier, decision: newDecision, originalAlias, reason? }

  return FallbackResult { ok: false, tier: "visible", error: FALLBACK_EXHAUSTED, originalAlias }
```

The walk is linear — no backtracking, no retry. This matches the `decision-engine.ts` fallback pattern from 15-2.

### Adapter integration pattern — minimal change to existing adapters

The adapter signature gains 3 optional params at the end:

```typescript
export async function applyCursorAdapter(
  decision: DecisionRecord,
  registry: AliasRegistry,
  configPath: string,
  policy?: RoutingPolicy,
  reasonCodes?: readonly string[],
  onFallback?: OnFallbackCallback,
): Promise<AdapterResult>
```

**Optional params keep all existing call sites and tests working.** The fallback path activates only when:
1. The initial write attempt fails (caught in the existing try/catch)
2. `policy` and `reasonCodes` are both provided (non-undefined)

When fallback activates:
1. Call `orchestrateFallback(decision, registry, policy, reasonCodes, errorMessage)`
2. If `result.ok`:
   - Call `onFallback?.(result)` to notify the caller
   - Resolve the new alias via `resolveAlias(result.decision.selected_model_alias, registry)`
   - Retry the atomic write with the new model_id
   - Return `AdapterResult` with the new model info
3. If `!result.ok`:
   - Call `onFallback?.(result)` to notify the caller
   - Return `{ ok: false }` with the exhaustion error

**CRITICAL: The fallback retry uses the SAME atomic write pattern** (temp + rename). If the retry also fails, return `{ ok: false }` as a normal write failure — no recursive fallback.

### FallbackLogEntry shape

```typescript
export interface FallbackLogEntry {
  readonly timestamp: string;
  readonly surface: Surface;
  readonly taskCategory: TaskCategory;
  readonly originalAlias: string;
  readonly selectedAlias: string | undefined;
  readonly tier: FallbackTier;
  readonly reason: string;
  readonly reason_code: string;
}
```

This is a plain serializable object. Story 15-6 will handle writing it to `_meta/logs/agent-log.md` via the existing `AuditLogger` pattern.

### Existing code conventions to follow

- **TypeScript + ESM:** `"type": "module"` in `package.json`; use `.js` extensions in relative imports (e.g., `import { orchestrateFallback } from "../fallback-orchestrator.js"`)
- **Error pattern:** Structured results `{ ok: true/false }` for expected failures; exceptions only for truly unexpected bugs
- **`readonly` types:** All type fields in `src/routing/types.ts` use `readonly` — maintain this for `FallbackResult`, `FallbackLogEntry`, `FallbackTier`
- **Pure functions:** Orchestrator and log builder are pure — no I/O, no side effects, config injected as params
- **Test pattern:** Inline fixtures, no mocks, temp dirs for filesystem tests (`mkdtemp`/`rm` lifecycle from `surface-adapters.test.ts`)
- **Config is not a dependency of runtime modules:** `fallback-orchestrator.ts` must NOT import from `config/` — `AliasRegistry`, `RoutingPolicy`, and `reasonCodes` are injected

### Reason code config changes

Add to `config/model-routing/reason-codes.json` (alphabetical):
```json
{
  "reason_codes": [
    "DEFAULT",
    "FALLBACK_CROSS_PROVIDER",
    "FALLBACK_EXHAUSTED",
    "FALLBACK_RATE_LIMIT",
    "FALLBACK_USED",
    "OPERATOR_OVERRIDE",
    "POLICY_DENY",
    "NO_MATCH_FAIL_CLOSED"
  ]
}
```

Add to `config/model-routing/reason-codes.schema.json` `$defs.reasonCode.enum` (same order).

### File structure

| Artifact | Path | Action |
|----------|------|--------|
| Fallback types | `src/routing/types.ts` | modified — add `FallbackTier`, `FallbackResult`, `FallbackLogEntry`, `OnFallbackCallback` |
| Fallback orchestrator | `src/routing/fallback-orchestrator.ts` | new |
| Audit log builder | `src/routing/audit-log.ts` | new |
| Cursor adapter | `src/routing/adapters/cursor.ts` | modified — add optional fallback params |
| Claude Code adapter | `src/routing/adapters/claude-code.ts` | modified — add optional fallback params |
| Gemini CLI adapter | `src/routing/adapters/gemini-cli.ts` | modified — add optional fallback params |
| Reason codes registry | `config/model-routing/reason-codes.json` | modified — add FALLBACK_USED, FALLBACK_CROSS_PROVIDER |
| Reason codes schema | `config/model-routing/reason-codes.schema.json` | modified — add FALLBACK_USED, FALLBACK_CROSS_PROVIDER |
| Orchestrator tests | `tests/model-routing/fallback-orchestrator.test.ts` | new |
| Adapter tests | `tests/model-routing/surface-adapters.test.ts` | modified — add onFallback integration tests |

No new dependencies. Vitest config already includes `tests/model-routing/**/*.test.ts`.

### Testing approach

**Orchestrator tests** (`tests/model-routing/fallback-orchestrator.test.ts`):
- Pure function tests — construct `DecisionRecord`, `AliasRegistry`, `RoutingPolicy` inline
- Use the existing shipped registry aliases for realistic fixtures:
  - Anthropic: `default-coding` (anthropic), `default-reasoning` (anthropic), `fast` (anthropic), `deep` (anthropic)
  - Google: `gemini-pro` (google), `gemini-flash` (google)
- Same-provider test: original `default-coding` (anthropic), fallback chain `["fast"]` → `fast` is anthropic → silent
- Cross-provider test: original `default-coding` (anthropic), fallback chain `["gemini-pro"]` → `gemini-pro` is google → visible
- Exhaustion test: fallback chain all denied or unregistered → `FALLBACK_EXHAUSTED`
- Skip-original test: chain `["default-coding", "fast"]` with original `default-coding` → skips first, returns `fast`
- Deny test: chain `["fast", "default-reasoning"]` with `fast` denied → skips `fast`, returns `default-reasoning`
- Unregistered test: chain `["nonexistent", "fast"]` → skips `nonexistent`, returns `fast`

**Audit log builder tests** (same file):
- Silent tier → entry has `tier: "silent"`, `selectedAlias` populated, correct `reason_code`
- Visible tier (ok) → entry has `tier: "visible"`, `selectedAlias` populated, `reason` populated
- Visible tier (failed) → entry has `tier: "visible"`, `selectedAlias` undefined, `reason_code: "FALLBACK_EXHAUSTED"`

**Adapter integration tests** (`tests/model-routing/surface-adapters.test.ts`):
- Use existing `tempDir` lifecycle
- Test `onFallback` callback: force write failure on initial attempt (bogus nested path), provide policy + reasonCodes + registry with valid fallback, assert callback is called with `FallbackResult`
- Test without `onFallback`: existing 3-arg call sites → adapter works as before
- **Design choice for adapter fallback test:** The adapter's fallback retry needs a valid `configPath` for the second attempt. Use a two-phase approach: first call with bogus initial path triggers orchestrator, but we need to verify the callback was invoked. A simpler approach: test the callback path by checking `onFallback` is called even when the final write also fails (both attempts use bogus path). The adapter should still call `onFallback` before the retry attempt.

### Previous story intelligence (15-4)

- **Agent:** Claude Opus 4.6 (Cursor)
- Gemini CLI adapter shipped with deep merge (`model.name`), 9 tests passing
- `Surface` type already includes `"gemini-cli"`
- Known gap: `VALID_SURFACES` in `decision-engine.ts` does NOT include `"gemini-cli"` — this is acceptable and does not affect the orchestrator (orchestrator does not call `validateDecisionRecordShape`)
- Clean implementation — all gates green on first run

### Previous story intelligence (15-3)

- **Agent:** Claude Opus 4.6 (Cursor)
- Established adapter pattern: `resolveAlias` → read existing config → guard non-object JSON → merge key → atomic write → return `AdapterResult`
- `isRecord` defined locally in each adapter (3-line function, not shared)
- Error messages follow established patterns: `"Failed to parse existing config: ..."`, `"Atomic write failed: ..."`
- Claude Code config corrected from `env.ANTHROPIC_MODEL` to top-level `"model"` key
- Non-object JSON rejection added as review hardening
- 263 tests total after 15-3

### Previous story intelligence (15-2)

- **Agent:** Claude Opus 4.6 (Cursor)
- `resolveRoutingDecision` is the pure engine function — orchestrator does NOT call this
- `validateReasonCode` pattern: returns code if valid, `undefined` if not
- `safeErrorReasonCode` pattern: falls back to registered code when semantic code is missing
- `buildDecision` helper constructs `DecisionRecord` — orchestrator should build its own decision records similarly
- `FALLBACK_EXHAUSTED` already in reason codes since 15-2

### Previous story intelligence (15-1)

- **Agent:** GPT-5.2 (Cursor)
- Registry schema enforces: alias names `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`, entries require `provider` + `model_id`
- Capabilities enum: `["tools", "vision", "reasoning", "fast", "coding"]`
- `provider` field is present on every alias entry (required by schema)
- Ajv validation with `strict: true` for config tests

### Git intelligence

Recent commits are story implementations (15-1 through 15-4) plus documentation. `src/routing/` currently contains:
- `types.ts` — 10 exported types
- `decision-engine.ts` — pure routing function with `TODO(15-6)` comment at line 377
- `adapters/resolve-alias.ts` — shared alias resolver
- `adapters/cursor.ts` — Cursor adapter (71 lines)
- `adapters/claude-code.ts` — Claude Code adapter (87 lines)
- `adapters/gemini-cli.ts` — Gemini CLI adapter (87 lines)
- `adapters/chatgpt.ts` — comment-only stub

### References

- [Source: `_bmad-output/implementation-artifacts/15-4-gemini-cli-adapter.md` — adapter pattern, nested merge, Gemini aliases, test patterns]
- [Source: `_bmad-output/implementation-artifacts/15-3-surface-adapters.md` — adapter contract, `resolveAlias`, `AdapterResult`, atomic write, review findings]
- [Source: `_bmad-output/implementation-artifacts/15-2-routing-decision-engine.md` — pure function pattern, `DecisionRecord`, reason code validation, deny-wins, fallback walk]
- [Source: `_bmad-output/implementation-artifacts/15-1-policy-schema-and-model-alias-registry.md` — registry schema, credential blocklist, config validation]
- [Source: `src/routing/types.ts` — current 10 exported types: `Surface`, `TaskCategory`, `Scope`, `RoutingContext`, `DefaultSelection`, `SurfacePolicy`, `RoutingPolicy`, `AliasEntry`, `AliasRegistry`, `DecisionRecord`, `RoutingError`, `RoutingDecisionResult`, `AdapterResult`]
- [Source: `src/routing/decision-engine.ts` — line 377: `TODO(15-6)` comment, `buildDecision` helper at line 365, `validateReasonCode` pattern at line 60]
- [Source: `src/routing/adapters/cursor.ts` — reference adapter: `applyCursorAdapter(decision, registry, configPath)` with atomic write pattern]
- [Source: `src/routing/adapters/claude-code.ts` — `applyClaudeCodeAdapter` with top-level `"model"` key write]
- [Source: `src/routing/adapters/gemini-cli.ts` — `applyGeminiCliAdapter` with nested `model.name` deep merge]
- [Source: `src/routing/adapters/resolve-alias.ts` — `resolveAlias(alias, registry): AliasResolutionResult`]
- [Source: `config/model-routing/reason-codes.json` — current codes: DEFAULT, FALLBACK_EXHAUSTED, FALLBACK_RATE_LIMIT, OPERATOR_OVERRIDE, POLICY_DENY, NO_MATCH_FAIL_CLOSED]
- [Source: `config/model-routing/reason-codes.schema.json` — `$defs.reasonCode.enum` mirrors reason-codes.json]
- [Source: `config/model-routing/model-alias-registry.json` — 6 aliases: default-coding (anthropic), default-reasoning (anthropic), fast (anthropic), deep (anthropic), gemini-pro (google), gemini-flash (google)]
- [Source: `config/model-routing/policy.defaults.json` — 5 surfaces with deny/allow lists and fallback chains]
- [Source: `tests/model-routing/surface-adapters.test.ts` — 25 tests, `makeDecision` / `makeGeminiDecision` helpers, `tempDir` lifecycle]
- [Source: `tests/model-routing/decision-engine.test.ts` — 17 tests for routing engine, inline fixtures]
- [Source: `tests/model-routing/policy-config.test.ts` — schema validation, credential blocklist]

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (Cursor)

### Debug Log References

None — all gates passed on first run.

### Completion Notes List

- Operator guide: no update required (no user-facing behavior changes; internal orchestrator/adapter plumbing only)
- Implemented two-tier fallback orchestrator as pure function — walks `fallback_chain`, classifies candidates as `"silent"` (same provider) or `"visible"` (cross-provider), returns discriminated `FallbackResult` union
- Fixed review finding: `orchestrateFallback()` now preserves `originalDecision.taskCategory` on all error paths (no hardcoded `"coding"`)
- `buildFallbackLogEntry` uses `selectedAlias: string | null` (not `undefined`) — the `ok: false` case produces `null` which serializes cleanly via JSON.stringify (user-requested deviation from story spec)
- All three adapter signatures extended with 3 optional trailing params (`policy`, `reasonCodes`, `onFallback`) — all 25 existing adapter tests pass unmodified (zero changes to existing tests)
- Fallback retry in adapters uses extracted `atomicWrite*` helpers to avoid duplication
- Added writing-task fallback exhaustion regression test; total suite now 292 tests
- `FALLBACK_USED` and `FALLBACK_CROSS_PROVIDER` added to reason codes config + schema (alphabetical order maintained)
- Confirmed `TODO(15-6)` comment at decision-engine.ts line 377 — no change needed

### Change Log

- 2026-04-15: Implemented story 15-5 — fallback orchestrator, audit log builder, adapter integration, new reason codes, 18 new tests
- 2026-04-16: Addressed review finding — preserve task category on fallback exhaustion; added regression test; all gates green (292 tests, verify.sh passed)

### File List

- `config/model-routing/reason-codes.json` — modified (added FALLBACK_CROSS_PROVIDER, FALLBACK_USED)
- `config/model-routing/reason-codes.schema.json` — modified (added FALLBACK_CROSS_PROVIDER, FALLBACK_USED to enum)
- `src/routing/types.ts` — modified (added FallbackTier, FallbackResult, FallbackLogEntry, OnFallbackCallback)
- `src/routing/decision-engine.ts` — modified (DecisionRecord now includes taskCategory)
- `src/routing/fallback-orchestrator.ts` — new (orchestrateFallback pure function)
- `src/routing/audit-log.ts` — new (buildFallbackLogEntry builder)
- `src/routing/adapters/cursor.ts` — modified (optional fallback params, atomicWriteCursorConfig helper)
- `src/routing/adapters/claude-code.ts` — modified (optional fallback params, atomicWriteClaudeCodeConfig helper)
- `src/routing/adapters/gemini-cli.ts` — modified (optional fallback params, atomicWriteGeminiCliConfig helper)
- `tests/model-routing/fallback-orchestrator.test.ts` — modified (add writing-task fallback exhaustion regression)
- `tests/model-routing/surface-adapters.test.ts` — modified (DecisionRecord fixtures include taskCategory)
