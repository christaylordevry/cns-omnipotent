# Story 15.2: Routing decision engine (pure function)

Status: done

## Story

As a **maintainer**,
I want a **deterministic, testable routing function that reads the policy schema and alias registry and returns a model selection decision**,
so that **surface adapters have a single, auditable source of routing truth with no side effects**.

## Context

- **Predecessor:** Story 15-1 shipped repo-stored routing config only — schemas, example configs, and config validation tests. This story adds the **first runtime code** in the routing domain.
- **Pre-architecture readout:** `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` — §Routing mechanism design options selects **deterministic / rules-based** as the baseline; this story implements that engine.
- **Design anchor:** The readout's "Minimal decision record" shape and the `minimalDecisionRecord` `$defs` in `config/model-routing/policy.schema.json` define the output contract.
- **15-1 completion notes:** deny-wins precedence was documented and shipped examples made conflict-free; reason_code locked via registry `$ref`. This story operationalizes both constraints in code.
- **Closes three Medium review items from 15-1:** credential blocklist expansion, alias name minimum length reconciliation, and README operator guidance.

## Acceptance Criteria

1. **Given** the schemas and configs from 15-1 are stable and verified
   **When** the routing engine is invoked with a task context (surface, task category, operator override flag)
   **Then** it returns a structured decision record: `{ selected_model_alias, reason_code, fallback_chain, operator_override: bool }`
   **And** the decision record is validated against `policy.schema.json` before being returned — no unregistered reason codes may appear in output

2. **Given** an alias appears on both an allow list and a deny list for a surface
   **When** the engine resolves the alias
   **Then** deny rules take precedence over allow rules — this is the explicit tie-break rule, documented in code and README

3. **Given** the requested alias is on the deny list
   **When** the engine evaluates fallback options
   **Then** it walks `fallback_chain` in order and returns the first non-denied alias
   **And** if the entire fallback chain is exhausted, the engine returns a structured error (not a thrown exception) with `reason_code: FALLBACK_EXHAUSTED`

4. **Given** the operator override flag is true
   **When** the engine evaluates a denied alias
   **Then** the override bypasses deny rules for model aliases but does **not** bypass the alias registry entirely — the alias must still exist in the registry

5. **Given** the engine function signature
   **When** it is called
   **Then** it is a **pure function** — no network calls, no filesystem reads at call time, no logging of model selection inputs or outputs; config is injected via parameters, not imported at module level

6. **Given** surface adapter concerns (15-3)
   **When** the engine is invoked
   **Then** it has no knowledge of surface-specific config formats — it accepts only the canonical policy + registry + task context shapes

7. **(Credential blocklist — closes Medium from 15-1 review)**
   **Given** the credential key blocklist in `tests/model-routing/policy-config.test.ts`
   **When** a config-validation test runs
   **Then** the blocklist includes at minimum: `client_secret`, `access_token`, `refresh_token`, `private_key`, `x-api-key`, `bearer`, `jwt` (in addition to existing entries)
   **And** the blocklist scan covers both key names AND string values in the injected config object

8. **(Schema alignment — closes Medium from 15-1 review)**
   **Given** `policy.schema.json` `modelAlias` `$defs` and `model-alias-registry.schema.json` `propertyNames`
   **When** alias name constraints are evaluated
   **Then** both schemas enforce a consistent **3-character minimum** (the registry already requires `{1,62}` interior which means 3+ total; the policy `modelAlias` must match)

9. **(README — closes Medium from 15-1 review)**
   **Given** `config/model-routing/_README.md`
   **When** a maintainer reads it
   **Then** it includes: which files to edit for a new alias, which files to edit for a new policy rule, alias naming constraints, when to bump `policy_version` vs `registry_version`, and the validation command to run locally

10. **(Tests — Vitest, no network)**
    **Given** the routing engine implementation
    **When** tests run
    **Then** they cover: happy path (alias resolved on first match), deny-wins-over-allow conflict resolution, fallback chain walk, full chain exhaustion (`FALLBACK_EXHAUSTED`), operator override flag bypass of deny rules, invalid reason code rejection
    **And** `npm test`, `npm run lint`, `npm run typecheck` all pass
    **And** `bash scripts/verify.sh` passes unchanged

## Explicit out of scope

- No live API calls to any model provider
- No Cursor or Claude Code config file writes (that is 15-3)
- No Gemini or third-party adapter (that is 15-3+)
- No daemon, no always-on process
- No changes to Vault IO MCP tool surface or Phase 1 audit logging

## Tasks / Subtasks

- [x] **Add `FALLBACK_EXHAUSTED` reason code** (AC: 1, 3)
  - [x] Update `config/model-routing/reason-codes.json` — add `"FALLBACK_EXHAUSTED"` to the array
  - [x] Update `config/model-routing/reason-codes.schema.json` — add `"FALLBACK_EXHAUSTED"` to the `reasonCode` enum
  - [x] Run existing `tests/model-routing/policy-config.test.ts` to confirm schema alignment still passes

- [x] **Reconcile alias name minimum length** (AC: 8)
  - [x] In `config/model-routing/policy.schema.json`, update `$defs.modelAlias` from `"minLength": 1` to `"minLength": 3` and update `"pattern"` to `"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$"` (matching the registry `propertyNames` pattern)
  - [x] Verify all shipped aliases (`default-coding`, `default-reasoning`, `fast`, `deep`) still pass validation — note that `fast` and `deep` are exactly 4 characters, which clears the 3-character minimum

- [x] **Implement the routing decision engine** (AC: 1, 2, 3, 4, 5, 6)
  - [x] Create `src/routing/decision-engine.ts`
  - [x] Export a pure function with this signature pattern:
    ```typescript
    export function resolveRoutingDecision(
      context: RoutingContext,
      policy: RoutingPolicy,
      registry: AliasRegistry,
      reasonCodes: readonly string[],
    ): RoutingDecisionResult
    ```
  - [x] `RoutingContext` includes: `surface`, `taskCategory`, `operatorOverride` (boolean), `scope` (optional — if omitted, engine reads `policy.surfaces[surface].default_scope`)
  - [x] `RoutingDecisionResult` is a discriminated union: `{ ok: true, decision: DecisionRecord }` | `{ ok: false, error: RoutingError }` — structured error, never a thrown exception for policy failures
  - [x] `DecisionRecord` matches `minimalDecisionRecord` from `policy.schema.json` `$defs` — includes `scope` (populated from context or policy `default_scope`), `policy_version` (from injected policy), and all other required fields
  - [x] `RoutingError` includes: `reason_code` (from the registered set), `surface`, `taskCategory`, and a human-readable `message` string
  - [x] Decision logic:
    1. Look up surface policy → task category defaults → get `model_alias` + `fallback_chain`
    2. Check deny list: if alias is denied AND `operatorOverride` is false → walk fallback chain
    3. Check deny list: if alias is denied AND `operatorOverride` is true → bypass deny, but verify alias exists in registry
    4. Allow list interaction: if `allow.model_aliases` exists and is non-empty, treat it as a **positive filter** — only aliases on the allow list (and not on deny) are eligible. If the allow list is absent or empty, all non-denied aliases are eligible. An alias that is on allow AND deny is denied (deny wins).
    5. Fallback walk: iterate chain in order; for each candidate: check deny (skip if denied unless override), check allow (skip if allow list exists and candidate is absent), check registry (skip if alias not registered); return first valid alias
    6. If all fallbacks exhausted → return `{ ok: false, error: { reason_code: 'FALLBACK_EXHAUSTED', ... } }`
    7. Validate final `reason_code` against injected `reasonCodes` array before returning — reject unregistered codes
  - [x] Verify alias exists in registry before returning (including under operator override) — unknown alias is an error
  - [x] No imports of config files at module level; all data injected as parameters

- [x] **Export TypeScript types** (AC: 1, 6)
  - [x] Create `src/routing/types.ts` with exported interfaces: `RoutingContext`, `RoutingPolicy`, `AliasRegistry`, `DecisionRecord`, `RoutingError`, `RoutingDecisionResult`
  - [x] `RoutingContext`: `surface` (string from surface enum), `taskCategory` (from taskCategory enum), `operatorOverride` (boolean), `scope?` (optional, from scope enum)
  - [x] `DecisionRecord`: all fields from `minimalDecisionRecord` — `surface`, `scope`, `policy_version`, `selected_model_alias`, `reason_code`, `fallback_chain`, `operator_override`
  - [x] `RoutingError`: `reason_code` (string), `surface` (string), `taskCategory` (string), `message` (string)
  - [x] `RoutingDecisionResult`: `{ ok: true; decision: DecisionRecord } | { ok: false; error: RoutingError }`
  - [x] `RoutingPolicy` / `AliasRegistry`: match the shapes from `policy.schema.json` and `model-alias-registry.schema.json` respectively
  - [x] Types should be consumable by future surface adapters without coupling to the engine internals

- [x] **Expand credential blocklist in tests** (AC: 7)
  - [x] In `tests/model-routing/policy-config.test.ts`, expand `CREDENTIAL_KEY_BLOCKLIST` to include: `client_secret`, `access_token`, `refresh_token`, `private_key`, `x-api-key`, `bearer`, `jwt`
  - [x] Add a value-scanning pass: for all string values in the config, check against blocklist patterns (not just key names)

- [x] **Write decision engine tests** (AC: 10)
  - [x] Create `tests/model-routing/decision-engine.test.ts`
  - [x] Test cases:
    - Happy path: alias resolved on first match (DEFAULT reason code)
    - Deny-wins-over-allow: alias on both lists → denied → walks fallback
    - Fallback chain walk: primary denied, second fallback succeeds
    - Full chain exhaustion: all aliases denied → `FALLBACK_EXHAUSTED` structured error (not exception)
    - Operator override: denied alias + `operatorOverride: true` → bypasses deny, returns alias if in registry
    - Operator override + unregistered alias: override does not create aliases — error if alias not in registry
    - Invalid reason code rejection: engine refuses to emit a reason code not in the injected set
    - Unknown surface: returns structured error
    - Unknown task category: returns structured error
  - [x] All tests pure — no network, no filesystem reads, no mocks of I/O; config constructed inline as test fixtures

- [x] **Update `config/model-routing/_README.md`** (AC: 9)
  - [x] Add section: "Adding a new model alias" — edit `model-alias-registry.json`, add to allowlists in `policy.defaults.json` if needed
  - [x] Add section: "Adding a new policy rule" — edit `policy.defaults.json`, follow surface → defaults/allow/deny structure
  - [x] Add section: "Alias naming constraints" — lowercase kebab-case, 3–64 chars, pattern `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`
  - [x] Add section: "When to bump versions" — `policy_version` for policy changes, `registry_version` for alias additions/removals; both must be updated independently
  - [x] Add section: "Local validation" — `npm run test:vitest` (or `npm test`) runs schema validation + credential safety + decision engine tests

- [x] **Verify all gates pass** (AC: 10)
  - [x] `npm test` passes
  - [x] `npm run lint` passes
  - [x] `npm run typecheck` passes
  - [x] `bash scripts/verify.sh` passes unchanged

## Dev Notes

### Review Findings

- [x] [Review][Patch] Fail-closed reason-code fallback can emit a code outside the injected registry when `reasonCodes` is empty, violating the "no unregistered reason codes may appear in output" contract; fixed by making an empty reason-code registry an explicit invalid-call precondition and adding a regression test for the degenerate empty-list case. [src/routing/decision-engine.ts:68]

### Pure function pattern — the critical design decision

The engine MUST be a pure function. This means:
- **Config injection:** `policy`, `registry`, and `reasonCodes` are parameters — not imported from `config/model-routing/` at call time. The caller (a future surface adapter or CLI) is responsible for loading and parsing config before calling the engine.
- **No side effects:** No `console.log`, no `fs.readFile`, no `fetch`, no writes. The function takes data in and returns data out.
- **Structured errors, not exceptions:** Policy failures (e.g., fallback exhaustion) return `{ ok: false, error: ... }`. Only truly unexpected programming bugs (type violations) may throw — and those should be prevented by TypeScript types.
- **Rationale:** This pattern makes the engine testable with inline fixtures, deterministic across runs, and safe to call from any execution context (MCP host, CLI, test harness) without environment coupling.

### Scope derivation and decision record completeness

The `minimalDecisionRecord` schema requires a `scope` field. The engine derives it as follows:
- If `context.scope` is provided → use it
- Otherwise → read `policy.surfaces[context.surface].default_scope`
- The `policy_version` field comes from `policy.policy_version` (top-level)

The engine does NOT validate the full decision record against Ajv/JSON Schema at runtime — that would require an `ajv` production dependency. Instead, the engine constructs the record using TypeScript types that mirror `$defs.minimalDecisionRecord`, and the test suite validates that the output shape matches. If a future story needs runtime schema validation (e.g., for cross-process trust boundaries), it can add Ajv as a dependency at that time.

### Reason code matrix

| Scenario | `reason_code` |
|----------|---------------|
| Primary alias resolved, not denied, not overridden | `DEFAULT` |
| Primary denied → fallback succeeds | `POLICY_DENY` |
| Operator override bypasses deny for primary | `OPERATOR_OVERRIDE` |
| All fallbacks exhausted (error result) | `FALLBACK_EXHAUSTED` |
| Unknown surface or task category (error result) | `NO_MATCH_FAIL_CLOSED` |

`FALLBACK_RATE_LIMIT` is reserved for future runtime use (rate-limit triggered fallback in 15-4+) — the engine does not emit it in this story.

### Tool allow/deny — explicitly out of scope for 15-2

The `surfacePolicy` schema includes `allow.tools` / `deny.tools` arrays. These are **not evaluated** by the routing decision engine in this story. Tool-level routing belongs to surface adapters (15-3+) which interpret tool context. This story evaluates **model alias** allow/deny only. The engine function accepts no tool identifier in its context.

### Deny-wins-over-allow: the tie-break rule

This was established in 15-1's review pass and documented in `config/model-routing/_README.md`. The engine must implement it:

```
if (deny.model_aliases.includes(alias) && !operatorOverride) → alias is denied
```

Even if the alias also appears on `allow.model_aliases`, deny wins. The only exception is the operator override flag, which bypasses deny but still requires the alias to exist in the registry.

### Fallback chain walk logic

```
1. Start with defaults[taskCategory].model_alias
2. If denied (and no override): try defaults[taskCategory].fallback_chain[0]
3. If that's also denied: try fallback_chain[1], etc.
4. If entire chain exhausted: return { ok: false, error: { reason_code: 'FALLBACK_EXHAUSTED' } }
```

The walk MUST be linear (index 0, 1, 2, ...) — no backtracking, no reordering. The chain is operator-authored policy; the engine respects it as-is.

### Operator override semantics

Override means: "I, the operator, accept the risk of using this specific model even though policy would deny it." Override does NOT mean:
- The alias can be anything (must exist in registry)
- The engine skips all validation (schema checks still apply)
- The decision goes unaudited (the decision record includes `operator_override: true`)

### Existing code conventions to follow

- **TypeScript + ESM:** `"type": "module"` in `package.json`; use `.js` extensions in relative imports
- **Error pattern:** See `src/errors.ts` (`CnsError`) for the existing error class — but note the engine should NOT use `CnsError` for policy failures since those are structured results, not thrown exceptions. `CnsError` is appropriate only for truly unexpected internal bugs if any.
- **Test pattern:** See `tests/model-routing/policy-config.test.ts` for Vitest conventions (no `ajv` needed in the engine tests — that's for schema validation. Engine tests use inline fixture objects.)
- **Config is not a dependency of the engine module:** The engine module (`src/routing/decision-engine.ts`) must NOT import from `config/` or use `fs`. The test file constructs config inline.

### Schema changes required (from 15-1 review Mediums)

**`policy.schema.json` `$defs.modelAlias`:**
- Current: `"minLength": 1, "pattern": "^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$"` — allows 2-character aliases
- Required: `"minLength": 3, "pattern": "^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$"` — matches registry `propertyNames` (3+ chars)
- Impact: All shipped aliases (`default-coding` = 14 chars, `default-reasoning` = 17, `fast` = 4, `deep` = 4) clear the 3-char floor.

**`reason-codes.schema.json` + `reason-codes.json`:**
- Add `FALLBACK_EXHAUSTED` to both the enum and the data file.

### Credential blocklist expansion (from 15-1 review Medium)

Existing blocklist in `tests/model-routing/policy-config.test.ts`:
```
apikey, api_key, token, authorization, auth, password, secret
```

Expand to also include:
```
client_secret, access_token, refresh_token, private_key, x-api-key, bearer, jwt
```

Add value scanning: iterate all string values in config objects and check them against the same blocklist patterns. This catches cases like `{ "notes": "use x-api-key header" }` where the key name is innocuous but the value references a credential concept. Apply judgment — the scan is heuristic, not a regex for actual secrets. The goal is to prevent accidental credential storage, not to parse natural language.

### Project Structure Notes

| Artifact | Path |
|----------|------|
| Routing engine (new) | `src/routing/decision-engine.ts` |
| Routing types (new) | `src/routing/types.ts` |
| Engine tests (new) | `tests/model-routing/decision-engine.test.ts` |
| Config test (modified) | `tests/model-routing/policy-config.test.ts` |
| Reason codes registry (modified) | `config/model-routing/reason-codes.json` |
| Reason codes schema (modified) | `config/model-routing/reason-codes.schema.json` |
| Policy schema (modified) | `config/model-routing/policy.schema.json` |
| README (modified) | `config/model-routing/_README.md` |

Vitest config (`vitest.config.ts`) already includes `tests/model-routing/**/*.test.ts` — no change needed.

### References

- [Source: `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` — §Routing mechanism design options, §Minimal decision record]
- [Source: `_bmad-output/implementation-artifacts/15-1-policy-schema-and-model-alias-registry.md` — completion notes, file list, review resolutions]
- [Source: `config/model-routing/policy.schema.json` — `$defs.minimalDecisionRecord`, `$defs.modelAlias`, `$defs.surfacePolicy`]
- [Source: `config/model-routing/reason-codes.schema.json` — `$defs.reasonCode` enum]
- [Source: `config/model-routing/model-alias-registry.schema.json` — `propertyNames` pattern]
- [Source: `config/model-routing/_README.md` — allow/deny precedence documentation]
- [Source: `config/model-routing/policy.defaults.json` — shipped example config with surface policies]
- [Source: `tests/model-routing/policy-config.test.ts` — existing credential blocklist, Ajv validation pattern]
- [Source: `_bmad-output/implementation-artifacts/epic-14-retro-2026-04-14.md` — continuity: when starting first router implementation story, re-open readout dependency section]

### Previous story intelligence (15-1)

- **Agent:** GPT-5.2 (Cursor)
- **Key review findings (resolved in 15-1):** deny-wins precedence was undocumented → added to README and schema descriptions; shipped example had allow/deny conflicts → removed; reason_code was a free string → locked via `$ref` to registry schema enum.
- **Patterns established:** Ajv with `strict: true, strictSchema: false, validateSchema: false, validateFormats: false` for cross-schema `$ref` validation; `isRecord()` type guard for runtime object shape checks; `intersection()` helper for conflict detection.
- **No runtime routing code was shipped** — this story is the first.

### Git intelligence

Recent commits are documentation-focused (constitution, BMAD templates, AGENTS.md symlinks). No conflicting routing implementation exists in `src/`. The `src/routing/` directory does not yet exist — this story creates it.

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (Cursor)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Operator guide: no update required (routing engine is internal, no new user-facing tool or workflow).
- Added `FALLBACK_EXHAUSTED` to reason codes registry and schema. Alphabetical ordering maintained.
- Reconciled `modelAlias` `minLength` from 1→3 and `pattern` interior quantifier from `{0,62}` → `{1,62}` in `policy.schema.json`. All 4 shipped aliases (4–17 chars) clear the floor.
- Created `src/routing/types.ts` with 10 exported types mirroring both JSON Schemas. All types are `readonly` to enforce immutability.
- Created `src/routing/decision-engine.ts` — single exported pure function `resolveRoutingDecision`. Zero imports from `config/`, `node:fs`, or any I/O. Returns discriminated union `{ ok, error }` pattern throughout — no thrown exceptions for policy failures.
- Deny-wins-over-allow implemented: `isDenied()` checked before `isAllowed()` at every evaluation point.
- Fallback chain walk is linear (index 0, 1, 2, ...) with no backtracking.
- Operator override bypasses deny but still validates alias registry membership.
- Review revision: when a semantic reason code is missing from the injected registry, the engine now fails closed with a registered fallback code when possible and rejects an empty reason-code registry as an invalid call precondition instead of fabricating an out-of-registry `error.reason_code`.
- Review revision: added an explicit primary-alias registry check before the fallback walk so an unregistered primary alias returns its own fail-closed error instead of surfacing as `FALLBACK_EXHAUSTED`.
- Review revision: all success paths now pass through a final runtime `minimalDecisionRecord` schema-shape validation before any `DecisionRecord` is returned.
- Review revision: added an inline maintainer comment on `validateReasonCode()` documenting that structured-error returns are intentional and must not be refactored into throws for policy/config failures.
- Expanded credential blocklist with 7 additional patterns. Added `collectCredentialLikeValues` value-scanning pass (skips schema files to avoid false positives on schema descriptions).
- 17 decision engine tests covering all 9 required scenarios plus bonus coverage (scope derivation, allow-list-as-filter, no-throw guarantee, override on fallback chain, primary registry failure, final decision schema-shape validation, empty reason-code registry precondition).
- Updated `_README.md` with 5 new sections: Adding aliases, Adding policy rules, Alias naming constraints, When to bump versions, Local validation.
- All gates green after review revision: 246 tests, lint, typecheck, `bash scripts/verify.sh`.

### Change Log

- 2026-04-15: Story 15-2 implemented — routing decision engine, types, tests, schema updates, README operator guidance.
- 2026-04-15: Addressed five review findings — fail-closed reason-code handling now rejects an empty registry precondition, plus primary alias registry guard, final decision schema-shape validation, and maintainer comment coverage.

### File List

- `config/model-routing/reason-codes.json` (modified — added FALLBACK_EXHAUSTED)
- `config/model-routing/reason-codes.schema.json` (modified — added FALLBACK_EXHAUSTED to enum)
- `config/model-routing/policy.schema.json` (modified — modelAlias minLength 1→3, pattern interior {0,62}→{1,62})
- `config/model-routing/_README.md` (modified — 5 new operator sections)
- `_bmad-output/implementation-artifacts/15-2-routing-decision-engine.md` (modified — recorded review-revision fixes and updated verification notes)
- `src/routing/types.ts` (new — TypeScript interfaces for routing domain)
- `src/routing/decision-engine.ts` (new — pure routing decision function with safe fail-closed reason-code fallback, explicit primary registry guard, and final decision schema-shape validation)
- `tests/model-routing/policy-config.test.ts` (modified — expanded blocklist + value scanning)
- `tests/model-routing/decision-engine.test.ts` (new — 16 tests for routing engine and review-revision regressions)
