# Story 15.4: Gemini CLI adapter

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **maintainer**,
I want **a Gemini CLI adapter that translates a routing DecisionRecord into the Gemini CLI config format**,
so that **CNS can route tasks to Gemini Pro (or Flash) using the same adapter pattern established in 15-3**.

## Context

- **Predecessor 15-3:** Shipped Cursor + Claude Code adapters, `resolveAlias` utility, `AdapterResult` type, ChatGPT stub, and the full adapter test suite. All patterns are established and documented. Story file: `_bmad-output/implementation-artifacts/15-3-surface-adapters.md`.
- **Predecessor 15-2:** Shipped the routing decision engine (`resolveRoutingDecision`) that returns `RoutingDecisionResult`. Engine has zero knowledge of adapters.
- **Predecessor 15-1:** Shipped repo-stored config (schemas, policy, alias registry, reason codes) under `config/model-routing/`.
- **Design anchor:** Adapters are **translators only** — receive a `DecisionRecord` + `AliasRegistry`, resolve alias to `model_id`, write to surface config. No routing logic, no deny/allow, no fallback walks.
- **Adapter contract from 15-3:** Export `apply<Surface>Adapter(decision, registry, configPath): Promise<AdapterResult>`. Use `resolveAlias` from `./resolve-alias.js`. Return structured results. Atomic write via temp+rename. Never throw for expected failures.

## Acceptance Criteria

1. **Given** a valid `DecisionRecord` with a Gemini alias (e.g. `gemini-pro` or `gemini-flash`)
   **When** the Gemini CLI adapter is invoked with that record and the registry
   **Then** it resolves the alias to a concrete model string (e.g. `gemini-2.5-pro`) and writes it to `~/.gemini/settings.json` under the `model.name` key
   **And** it follows the same adapter contract established in 15-3 — no routing logic, translator only, invoked after engine decision

2. **Config write target:**
   **Given** the adapter writes to `~/.gemini/settings.json` (user-level) by default
   **Then** `configPath` is injectable for tests
   **And** the write sets `model.name` inside the JSON object — it must merge into the existing file, not overwrite it entirely
   **And** the write is atomic (temp+rename pattern matching 15-3)
   **And** if the existing file contains valid JSON that is not an object, the adapter returns `{ ok: false }` — same guard as 15-3

3. **Why settings file over env var or flag:**
   **Given** the design decision documentation requirement
   **Then** the adapter's JSDoc explicitly documents: `~/.gemini/settings.json` was chosen over `GEMINI_MODEL` env var (programmatic env mutation affects all processes) and `--model` flag (session-only, not injectable by CNS)

4. **Alias registry additions:**
   **Given** `config/model-routing/model-alias-registry.json`
   **When** updated
   **Then** it includes at minimum:
   - `gemini-pro` → `{ "model_id": "gemini-2.5-pro", "provider": "google" }`
   - `gemini-flash` → `{ "model_id": "gemini-2.5-flash", "provider": "google" }`
   **And** existing schema validation tests still pass with the new aliases

5. **Adapter module:**
   **Given** the adapter at `src/routing/adapters/gemini-cli.ts`
   **Then** it exports `applyGeminiCliAdapter(decision: DecisionRecord, registry: AliasRegistry, configPath: string): Promise<AdapterResult>`
   **And** it uses the shared `resolveAlias` utility from `src/routing/adapters/resolve-alias.ts` — no duplication
   **And** it returns `{ ok: true, writtenPath, modelResolved }` on success
   **And** it returns `{ ok: false, error, surface: "gemini-cli" }` on failure — no throws

6. **Policy defaults update:**
   **Given** `config/model-routing/policy.defaults.json`
   **When** updated
   **Then** it includes a `gemini-cli` surface entry with:
   - `default_scope: "session"`
   - coding → `gemini-pro` alias
   - analysis → `gemini-pro` alias
   - writing → `gemini-flash` alias
   - `fallback_chain: ["gemini-flash"]` for pro tasks, `fallback_chain: ["gemini-pro"]` for flash tasks
   - No deny list initially

7. **Tests (Vitest, no live Gemini calls):**
   **Given** injectable `configPath` pointing to a temp dir
   **Then** tests cover: happy path (`gemini-pro` resolved and written), `gemini-flash` resolved and written, alias-not-in-registry error, malformed `model_id` error, non-object JSON root rejection, atomic write failure handling, merge preserves existing keys
   **And** adapter tests receive a pre-built `DecisionRecord` — they do not call `resolveRoutingDecision`
   **And** `npm test`, `npm run lint`, `npm run typecheck` all pass
   **And** `bash scripts/verify.sh` passes unchanged

8. **Documentation:**
   **Given** `config/model-routing/_README.md`
   **Then** it includes Gemini CLI in the adapter table with its config write location and the rationale for settings file over env var
   **And** `src/routing/adapters/gemini-cli.ts` has a JSDoc comment explaining the surface, config target, and precedence hierarchy rationale

## Explicit out of scope

- No `/model` slash command injection (in-session switching — not programmable by CNS)
- No `GEMINI_MODEL` env var writes
- No `--model` flag injection
- No Google API key handling — credentials stay in env/keychain, never in the adapter
- No ChatGPT adapter implementation
- No routing logic in the adapter
- No changes to `decision-engine.ts`

## Tasks / Subtasks

- [x] **Update alias registry with Gemini aliases** (AC: 4)
  - [x] Add `gemini-pro` → `{ "provider": "google", "model_id": "gemini-2.5-pro", "label": "Gemini Pro default", "capabilities": ["coding", "reasoning", "tools"] }` to `config/model-routing/model-alias-registry.json`
  - [x] Add `gemini-flash` → `{ "provider": "google", "model_id": "gemini-2.5-flash", "label": "Gemini Flash (fast, cheaper)", "capabilities": ["fast", "coding"] }` to the same file
  - [x] Bump `registry_version` to `"1.1.0"` (new aliases added)
  - [x] Verify alias names match schema pattern: `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$` — both `gemini-pro` and `gemini-flash` are valid

- [x] **Update policy schema to allow `gemini-cli` surface** (AC: 6)
  - [x] Add `"gemini-cli": { "$ref": "#/$defs/surfacePolicy" }` to `policy.schema.json` → `properties.surfaces.properties`
  - [x] Do NOT add `gemini-cli` to the `required` array — keep it optional so minimal policy files that omit Gemini still validate
  - [x] Verify existing schema validation tests still pass (the schema change is additive)

- [x] **Update policy defaults with `gemini-cli` surface entry** (AC: 6)
  - [x] Add `gemini-cli` surface to `config/model-routing/policy.defaults.json` with:
    ```json
    "gemini-cli": {
      "default_scope": "session",
      "defaults": {
        "coding": { "model_alias": "gemini-pro", "fallback_chain": ["gemini-flash"] },
        "writing": { "model_alias": "gemini-flash", "fallback_chain": ["gemini-pro"] },
        "analysis": { "model_alias": "gemini-pro", "fallback_chain": ["gemini-flash"] }
      },
      "allow": {
        "model_aliases": ["gemini-pro", "gemini-flash"]
      }
    }
    ```
  - [x] No deny list — operator can add restrictions later
  - [x] Bump `policy_version` to `"1.1.0"` (new surface added)

- [x] **Update `Surface` type in `types.ts`** (AC: 5, 6)
  - [x] Add `"gemini-cli"` to the `Surface` type union: `export type Surface = "cursor" | "claude-code" | "vault-io" | "gemini-cli" | "unknown";`
  - [x] This is in `src/routing/types.ts`, NOT in `decision-engine.ts` — no engine changes required
  - [x] **IMPORTANT:** The decision engine's internal `VALID_SURFACES` set (line 19 of `decision-engine.ts`) does NOT get updated here. This means `validateDecisionRecordShape` will reject decision records with `surface: "gemini-cli"`. This is acceptable because: (a) the adapter never calls the engine, (b) adapter tests build DecisionRecords inline, and (c) a follow-up task integrates gemini-cli into the engine's surface set. Document this as a known gap.

- [x] **Implement Gemini CLI adapter** (AC: 1, 2, 3, 5)
  - [x] Create `src/routing/adapters/gemini-cli.ts`
  - [x] Export: `applyGeminiCliAdapter(decision: DecisionRecord, registry: AliasRegistry, configPath: string): Promise<AdapterResult>`
  - [x] Call `resolveAlias` from `./resolve-alias.js` to get concrete model string
  - [x] On alias resolution failure, return `{ ok: false, error: ..., surface: "gemini-cli" }`
  - [x] Read existing config at `configPath` if it exists (JSON parse); if file doesn't exist, start with `{}`
  - [x] If parsed JSON is not an object, return `{ ok: false, error: "Failed to parse existing config: existing config must be a JSON object", surface: "gemini-cli" }` — same guard as Cursor/Claude Code adapters
  - [x] **Deep merge the `model.name` key**: ensure `existing["model"]` is an object (create `{}` if missing or not an object), then set `existing["model"]["name"] = resolution.modelId`. This preserves sibling keys under `model` and all other top-level keys.
  - [x] Write atomically: write to `configPath + ".tmp"`, then `rename(tmp, configPath)` — matching 15-3 pattern
  - [x] On write failure, best-effort `unlink` of temp file, return `{ ok: false, error: ..., surface: "gemini-cli" }` — no throws
  - [x] Add JSDoc comment explaining:
    - Target: `~/.gemini/settings.json` (user-level Gemini CLI config)
    - Config key: `model.name` (nested path)
    - **Why settings file:** `~/.gemini/settings.json` chosen over `GEMINI_MODEL` env var (programmatic env mutation affects all child processes, not scoped to Gemini CLI) and `--model` flag (session-only, not persistently injectable by CNS). The settings file is machine-writable, scoped to Gemini CLI only, and loaded automatically on CLI startup.
    - This module contains no routing logic — translator only.

- [x] **Write Gemini adapter tests** (AC: 7)
  - [x] Add tests to existing `tests/model-routing/surface-adapters.test.ts` (same file, new `describe("applyGeminiCliAdapter", ...)` block)
  - [x] Import `applyGeminiCliAdapter` from `../../src/routing/adapters/gemini-cli.js`
  - [x] Extend `REGISTRY` fixture (or create a Gemini-specific registry inline) with `gemini-pro` and `gemini-flash` entries
  - [x] Test: happy path with `gemini-pro` — writes `{ "model": { "name": "gemini-2.5-pro" } }`, returns `{ ok: true, writtenPath, modelResolved: "gemini-2.5-pro" }`
  - [x] Test: happy path with `gemini-flash` — writes `{ "model": { "name": "gemini-2.5-flash" } }`, returns `{ ok: true }`
  - [x] Test: alias-not-in-registry — returns `{ ok: false, surface: "gemini-cli" }`
  - [x] Test: malformed `model_id` error — use `makeRegistryWithAliasEntry` pattern from existing tests
  - [x] Test: non-object JSON root rejection — write `["array"]` to config, expect `{ ok: false }` with "must be a JSON object"
  - [x] Test: atomic write failure — bogus nested path → `{ ok: false, error: "Atomic write failed: ..." }`
  - [x] Test: merge preserves existing keys — pre-write `{ "model": { "name": "old", "safety": "block_all" }, "otherKey": 42 }`, verify `safety` and `otherKey` survive, `model.name` updated
  - [x] Test: creates `model` object when it doesn't exist in existing config — pre-write `{ "otherKey": 42 }`, verify `{ "model": { "name": "..." }, "otherKey": 42 }`
  - [x] All tests use temp directory (existing `beforeEach`/`afterEach` lifecycle)
  - [x] No test imports `resolveRoutingDecision`

- [x] **Update `config/model-routing/_README.md`** (AC: 8)
  - [x] Add "Gemini CLI adapter" subsection under "Surface adapters"
  - [x] Document: **Module:** `src/routing/adapters/gemini-cli.ts`, **Config target:** `~/.gemini/settings.json` (user-level), **Config key:** `model.name` (nested)
  - [x] Include rationale: settings file chosen over `GEMINI_MODEL` env var (process-wide mutation) and `--model` flag (session-only)
  - [x] Update the adapter table/list to include Gemini CLI alongside Cursor and Claude Code

- [x] **Verify all gates pass** (AC: 7)
  - [x] `npm test` passes
  - [x] `npm run lint` passes
  - [x] `npm run typecheck` passes
  - [x] `bash scripts/verify.sh` passes unchanged

## Dev Notes

### Adapter pattern — follow 15-3 exactly

The Gemini CLI adapter follows the identical pattern established by `cursor.ts` and `claude-code.ts`:

1. Receive `DecisionRecord` + `AliasRegistry` + `configPath`
2. Call `resolveAlias(decision.selected_model_alias, registry)` → get `modelId`
3. Read existing config (or `{}` if ENOENT)
4. Guard: reject non-object JSON roots with `{ ok: false }`
5. Merge model selection into config (key-specific — see below)
6. Atomic write: `writeFile(tmp)` → `rename(tmp, configPath)`
7. Return `AdapterResult`

**Do NOT deviate from this pattern.** Copy the structure of `cursor.ts` or `claude-code.ts` as a starting point.

### Config key: `model.name` (nested merge)

This adapter differs from Cursor (`cns.routing.model` — shallow key) and Claude Code (`model` — shallow key) in that the config key is **nested**: `model.name` inside the JSON object.

The existing file may look like:
```json
{
  "model": {
    "name": "gemini-1.5-pro",
    "safety": "block_medium_and_above"
  },
  "codeExecution": true
}
```

After the adapter writes `gemini-2.5-pro`:
```json
{
  "model": {
    "name": "gemini-2.5-pro",
    "safety": "block_medium_and_above"
  },
  "codeExecution": true
}
```

Implementation approach:
```typescript
// Ensure model key is an object
const modelObj = isRecord(existing["model"]) ? existing["model"] : {};
modelObj["name"] = resolution.modelId;
existing["model"] = modelObj;
```

If `existing["model"]` exists but is NOT an object (e.g., a string or array), replace it with `{ name: resolution.modelId }`. This is intentional — the adapter owns the `model.name` key.

### `isRecord` guard — reuse pattern from existing adapters

Both `cursor.ts` and `claude-code.ts` define a local `isRecord` function. The Gemini adapter should define the same function locally (not extracted — the cost of a 3-line utility doesn't warrant a shared import and matches the existing pattern):

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

### Policy schema update — `gemini-cli` as optional surface

The current `policy.schema.json` has `additionalProperties: false` on the `surfaces` object and `required: ["cursor", "claude-code", "vault-io", "unknown"]`. Adding `gemini-cli` to `policy.defaults.json` without updating the schema will fail the existing `policy-config.test.ts` validation test.

**Required schema change:**
- Add `"gemini-cli": { "$ref": "#/$defs/surfacePolicy" }` to `properties.surfaces.properties`
- Do NOT add to `required` — keep it optional. This allows minimal policy files (e.g., test fixtures) to omit Gemini while the shipped default includes it.

### Surface type update — `types.ts` only, NOT `decision-engine.ts`

The `Surface` type in `src/routing/types.ts` (line 11) needs `"gemini-cli"` added to the union. This change is in `types.ts`, NOT in `decision-engine.ts`.

**Known gap:** The engine's internal `VALID_SURFACES` set at `decision-engine.ts` line 19 does NOT include `"gemini-cli"`. This means `validateDecisionRecordShape` will reject records with `surface: "gemini-cli"`. This is acceptable for 15-4 because:
- The adapter never calls the engine
- Adapter tests construct `DecisionRecord` objects inline (they can use any existing surface value in the record)
- A follow-up task should add `"gemini-cli"` to `VALID_SURFACES` when integrating the full routing flow

**For adapter tests:** Use `surface: "gemini-cli"` in test `DecisionRecord` fixtures since TypeScript allows it after the type update. The adapter doesn't validate the surface field — it only reads `selected_model_alias`.

### Why `~/.gemini/settings.json` over alternatives

| Method | Problem |
|--------|---------|
| `GEMINI_MODEL` env var | Programmatic `process.env` mutation is global — affects ALL child processes, not scoped to Gemini CLI. Env var manipulation also requires shell-level persistence (`.bashrc`, `.zshrc`) for durability, which is fragile and surface-dependent. |
| `--model` CLI flag | Session-only — not persistently injectable by CNS. Would require wrapping every Gemini CLI invocation, which is not the adapter's responsibility. |
| `~/.gemini/settings.json` | Machine-writable JSON, scoped to Gemini CLI only, loaded automatically on CLI startup, supports atomic write, and follows the same pattern as Cursor and Claude Code adapters. |

### Alias registry update details

New entries for `config/model-routing/model-alias-registry.json`:

```json
"gemini-pro": {
  "provider": "google",
  "model_id": "gemini-2.5-pro",
  "label": "Gemini Pro default",
  "capabilities": ["coding", "reasoning", "tools"]
},
"gemini-flash": {
  "provider": "google",
  "model_id": "gemini-2.5-flash",
  "label": "Gemini Flash (fast, cheaper)",
  "capabilities": ["fast", "coding"]
}
```

Both alias names match the required pattern `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`. The `provider` field is `"google"` (vendor-neutral identifier consistent with registry schema).

Bump `registry_version` to `"1.1.0"`.

### Existing code conventions to follow

- **TypeScript + ESM:** `"type": "module"` in `package.json`; use `.js` extensions in relative imports (e.g., `import { resolveAlias } from "./resolve-alias.js"`)
- **Error pattern:** Structured results for expected failures (adapter errors); exceptions only for truly unexpected bugs
- **Test pattern:** See existing `tests/model-routing/surface-adapters.test.ts` — inline fixtures, temp dirs via `mkdtemp`/`rm`, no mocks
- **Config is not a dependency of adapter modules:** Do NOT import from `config/` — `AliasRegistry` is injected as a parameter
- **`readonly` types:** All type fields in `src/routing/types.ts` use `readonly`
- **`isRecord` guard:** Define locally in the adapter file — matches pattern in `cursor.ts` and `claude-code.ts`
- **Atomic write:** `writeFile(tmpPath)` → `rename(tmpPath, configPath)` → catch → best-effort `unlink(tmpPath)` → return `{ ok: false }`

### File structure

| Artifact | Path | Action |
|----------|------|--------|
| Surface type | `src/routing/types.ts` | modified — add `"gemini-cli"` to `Surface` union |
| Gemini CLI adapter | `src/routing/adapters/gemini-cli.ts` | new |
| Alias registry | `config/model-routing/model-alias-registry.json` | modified — add `gemini-pro`, `gemini-flash` |
| Policy schema | `config/model-routing/policy.schema.json` | modified — add optional `gemini-cli` surface property |
| Policy defaults | `config/model-routing/policy.defaults.json` | modified — add `gemini-cli` surface entry |
| Adapter tests | `tests/model-routing/surface-adapters.test.ts` | modified — add Gemini `describe` block |
| README | `config/model-routing/_README.md` | modified — add Gemini CLI adapter section |

No new dependencies. No vitest config changes (test file already included).

### Testing approach

Add a new `describe("applyGeminiCliAdapter", ...)` block to the existing `tests/model-routing/surface-adapters.test.ts` file. Use the same `tempDir` lifecycle and `makeDecision` helper.

Create a Gemini-specific registry (or extend the shared `REGISTRY` fixture) with `gemini-pro` and `gemini-flash` entries:

```typescript
const GEMINI_REGISTRY: AliasRegistry = {
  registry_version: "1.1.0",
  aliases: {
    "gemini-pro": { provider: "google", model_id: "gemini-2.5-pro" },
    "gemini-flash": { provider: "google", model_id: "gemini-2.5-flash" },
  },
};
```

**Test cases:**
1. Happy path: `gemini-pro` resolved → `{ "model": { "name": "gemini-2.5-pro" } }` written
2. Happy path: `gemini-flash` resolved → `{ "model": { "name": "gemini-2.5-flash" } }` written
3. Alias-not-in-registry → `{ ok: false, surface: "gemini-cli" }`
4. Malformed `model_id` → `{ ok: false }` (using `makeRegistryWithAliasEntry` pattern)
5. Non-object JSON root → `{ ok: false, error: "...must be a JSON object" }`
6. Atomic write failure (bogus nested path) → `{ ok: false, error: "Atomic write failed: ..." }`
7. Merge preserves existing keys (including sibling keys under `model` and top-level keys)
8. Creates `model` object when absent in existing config

### Previous story intelligence (15-3)

- **Agent:** Claude Opus 4.6 (Cursor)
- **Key patterns to reuse:**
  - `isRecord` local guard function — same 3-line definition
  - Atomic write pattern: `writeFile(tmp)` → `rename` → catch → `unlink` → `{ ok: false }`
  - Error messages: `"Failed to parse existing config: ..."`, `"Atomic write failed: ..."` — keep consistent
  - Non-object JSON rejection: `"existing config must be a JSON object"`
  - Test fixtures: inline `DecisionRecord` via `makeDecision()`, inline `AliasRegistry`, `mkdtemp`/`rm` lifecycle
- **Review findings from 15-3 to carry forward:**
  - `resolveAlias` rejects invalid `model_id` (missing, empty, non-string) — already baked into the shared utility
  - Both adapters reject non-object JSON configs — replicate in Gemini adapter
- **15-3 file list (reference for patterns):**
  - `src/routing/adapters/cursor.ts` — 71 lines, clean reference implementation
  - `src/routing/adapters/claude-code.ts` — 86 lines with JSDoc
  - `src/routing/adapters/resolve-alias.ts` — 48 lines, shared utility
  - `tests/model-routing/surface-adapters.test.ts` — 274 lines, 16 tests

### Previous story intelligence (15-2)

- **Agent:** Claude Opus 4.6 (Cursor)
- **Key types:** `DecisionRecord` (7 fields, all `readonly`), `AliasRegistry`, `RoutingDecisionResult`
- **Engine API:** `resolveRoutingDecision(context, policy, registry, reasonCodes): RoutingDecisionResult` — the adapter never calls this

### Previous story intelligence (15-1)

- **Agent:** GPT-5.2 (Cursor)
- **Registry schema enforces:** alias names `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`, entries require `provider` + `model_id`
- **Capabilities enum:** `["tools", "vision", "reasoning", "fast", "coding"]` — use these values for Gemini entries

### Git intelligence

Recent commits are documentation-focused plus 15-1, 15-2, 15-3 implementation. `src/routing/adapters/` directory exists with:
- `resolve-alias.ts` (shared utility)
- `cursor.ts` (Cursor adapter)
- `claude-code.ts` (Claude Code adapter)
- `chatgpt.ts` (stub)

### Project Structure Notes

- Adapter module at `src/routing/adapters/gemini-cli.ts` follows the existing namespace
- Test additions go into the existing `tests/model-routing/surface-adapters.test.ts`
- Config changes under `config/model-routing/` follow established patterns
- No new dependencies required

### References

- [Source: `_bmad-output/implementation-artifacts/15-3-surface-adapters.md` — full adapter pattern, review findings, test patterns, completion notes]
- [Source: `src/routing/adapters/cursor.ts` — reference adapter implementation (71 lines)]
- [Source: `src/routing/adapters/claude-code.ts` — reference adapter with JSDoc rationale (86 lines)]
- [Source: `src/routing/adapters/resolve-alias.ts` — shared alias resolution utility (48 lines)]
- [Source: `src/routing/types.ts` — `DecisionRecord`, `AdapterResult`, `AliasRegistry`, `Surface` type definitions]
- [Source: `src/routing/decision-engine.ts` — line 19: `VALID_SURFACES` set (does NOT include gemini-cli — follow-up needed)]
- [Source: `config/model-routing/model-alias-registry.json` — current aliases, registry_version, entry structure]
- [Source: `config/model-routing/model-alias-registry.schema.json` — alias naming pattern, capabilities enum]
- [Source: `config/model-routing/policy.defaults.json` — current surface policies, structure to replicate for gemini-cli]
- [Source: `config/model-routing/policy.schema.json` — surfaces properties with `additionalProperties: false`, surfacePolicy $def]
- [Source: `config/model-routing/_README.md` — "How to add a new surface adapter" guide (step-by-step)]
- [Source: `tests/model-routing/surface-adapters.test.ts` — existing 16 adapter tests, fixture patterns, temp dir lifecycle]
- [Source: `tests/model-routing/policy-config.test.ts` — schema validation test that must pass with config changes]

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (Cursor)

### Debug Log References

None — clean implementation, all tests passed on first run.

### Completion Notes List

- Implemented `applyGeminiCliAdapter` in `src/routing/adapters/gemini-cli.ts` following the exact pattern from `cursor.ts` and `claude-code.ts` (15-3).
- Key differentiator: nested `model.name` deep merge — the adapter ensures `existing["model"]` is an object before setting `["name"]`, preserving sibling keys like `model.safety` and `model.temperature`.
- Added `gemini-pro` and `gemini-flash` aliases to the registry (version bumped to 1.1.0).
- Added optional `gemini-cli` surface to `policy.schema.json` (NOT in `required` array) and added the surface entry to `policy.defaults.json` (version bumped to 1.1.0).
- Added `"gemini-cli"` to the `Surface` type union in `types.ts`. Known gap: `decision-engine.ts` `VALID_SURFACES` not updated — acceptable per story spec (adapter never calls engine; follow-up task).
- 9 new tests covering: happy path (pro + flash), alias-not-in-registry, malformed model_id, non-object JSON root, atomic write failure, nested merge preserving sibling + top-level keys, model object creation when absent, and non-object model replacement.
- JSDoc on the adapter documents the rationale for `~/.gemini/settings.json` over `GEMINI_MODEL` env var and `--model` flag.
- README updated with Gemini CLI adapter subsection and rationale table.
- Operator guide: no update required (adapter internals, no user-facing behavior change).

### Change Log

- 2026-04-15: Implemented Gemini CLI adapter, updated alias registry, policy schema/defaults, types, tests, and documentation.

### File List

- `src/routing/adapters/gemini-cli.ts` — new (Gemini CLI adapter)
- `src/routing/types.ts` — modified (added `"gemini-cli"` to `Surface` union)
- `config/model-routing/model-alias-registry.json` — modified (added `gemini-pro`, `gemini-flash`; bumped version to 1.1.0)
- `config/model-routing/policy.schema.json` — modified (added optional `gemini-cli` surface property)
- `config/model-routing/policy.defaults.json` — modified (added `gemini-cli` surface entry; bumped version to 1.1.0)
- `tests/model-routing/surface-adapters.test.ts` — modified (added 9 Gemini adapter tests)
- `config/model-routing/_README.md` — modified (added Gemini CLI adapter subsection)
