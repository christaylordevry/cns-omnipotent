# Story 15.3: Surface adapters (Cursor / Claude Code)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **maintainer**,
I want **surface-specific adapter modules that translate a routing DecisionRecord into the config format each tool consumes**,
so that **the routing engine stays pure and each tool's integration is isolated and independently testable**.

## Context

- **Predecessor 15-1:** Shipped repo-stored routing config only — schemas, example configs, and config validation tests. All config lives under `config/model-routing/`.
- **Predecessor 15-2:** Shipped the first runtime routing code — a pure `resolveRoutingDecision` function in `src/routing/decision-engine.ts` that returns `RoutingDecisionResult` (discriminated union: `{ ok: true, decision: DecisionRecord }` | `{ ok: false, error: RoutingError }`). Types live in `src/routing/types.ts`.
- **Pre-architecture readout:** `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` — §3 "Surface adapters (Cursor / Claude Code)" is the source slice for this story.
- **Design anchor:** Adapters are **translators only** — they translate a `DecisionRecord` into surface-specific config, performing no routing logic, no deny/allow evaluation, and no fallback chain walks. They receive only success results (`{ ok: true }`) from the caller.
- **15-2 completion notes:** The engine returns a `DecisionRecord` with `selected_model_alias` (an alias name, not a concrete model string). Adapters must resolve the alias to a concrete `model_id` via the `AliasRegistry` before writing.

## Acceptance Criteria

1. **Given** a valid `DecisionRecord` produced by `resolveRoutingDecision` from 15-2
   **When** an adapter is invoked with that record and a target config path
   **Then** it writes the model selection to the correct location for that surface in the format that surface expects

2. **Given** the adapter architecture
   **When** adapters are implemented
   **Then** each adapter is a separate module — no shared branching function like `if (surface === "cursor") ... else if (surface === "claude-code")`

3. **Given** the adapter responsibility boundary
   **When** any adapter executes
   **Then** no routing logic (deny/allow/fallback) exists in any adapter — adapters are translators only
   **And** adapters are invoked after the engine returns a decision — they never call the engine themselves

4. **Cursor adapter (`src/routing/adapters/cursor.ts`):**
   **Given** a `DecisionRecord` with `selected_model_alias`
   **When** `applyCursorAdapter(decision, registry, configPath)` is called
   **Then** it resolves the alias to a concrete model string via the alias registry and writes it to the Cursor config location
   **And** it does not write if the `DecisionRecord` is an error result — it receives only `{ ok: true }` results
   **And** the config write is atomic where possible — partial writes must not leave Cursor in a broken state
   **And** it exports `applyCursorAdapter(decision: DecisionRecord, registry: AliasRegistry, configPath: string): Promise<AdapterResult>`

5. **Claude Code adapter (`src/routing/adapters/claude-code.ts`):**
   **Given** a `DecisionRecord` with `selected_model_alias`
   **When** `applyClaudeCodeAdapter(decision, registry, configPath)` is called
   **Then** it resolves the alias to a concrete model string via the alias registry and writes it to the Claude Code config location
   **And** same error-result guard as Cursor adapter
   **And** same atomic write requirement
   **And** it exports `applyClaudeCodeAdapter(decision: DecisionRecord, registry: AliasRegistry, configPath: string): Promise<AdapterResult>`

6. **`AdapterResult` type:**
   **Given** both adapters complete
   **When** they succeed
   **Then** they return `{ ok: true, writtenPath: string, modelResolved: string }`
   **When** they fail
   **Then** they return `{ ok: false, error: string, surface: string }` — no throws
   **And** `AdapterResult` is defined in `src/routing/types.ts` alongside existing routing types

7. **Alias resolution:**
   **Given** the alias-to-concrete-model resolution
   **When** the alias in the `DecisionRecord` exists in the registry
   **Then** a shared utility function in `src/routing/adapters/resolve-alias.ts` resolves it — not duplicated in each adapter
   **When** the alias does not exist in the registry
   **Then** the adapter returns `{ ok: false }` with a clear error message — it does not fall back silently

8. **Future adapter stubs:**
   **Given** deferred adapters
   **Then** `src/routing/adapters/chatgpt.ts` contains a stub with only a comment: `// ChatGPT adapter — deferred. Subscription status uncertain. Add if subscription is retained.`
   **And** no Gemini CLI adapter stub is created here — Gemini CLI is a real implementation story (15-4), not a stub
   **And** no implementation exists in the ChatGPT stub — comment only

9. **Tests (Vitest, no live tool calls):**
   **Given** the adapter test suite
   **When** tests run
   **Then** they use a fake filesystem (temp dir via `node:fs/promises` + `node:os`) — no writes to actual Cursor or Claude Code config locations
   **And** they cover: happy path for each adapter, alias-not-in-registry error, atomic write failure handling, correct model string resolved from alias
   **And** adapter tests do not import or invoke `resolveRoutingDecision` — they receive a pre-built `DecisionRecord` as input
   **And** `npm test`, `npm run lint`, `npm run typecheck` all pass
   **And** `bash scripts/verify.sh` passes unchanged

10. **Documentation:**
    **Given** `config/model-routing/_README.md`
    **When** updated
    **Then** it explains: what adapters do, where each surface's config is written, and how to add a new surface adapter
    **And** each adapter file has a JSDoc comment explaining its surface target and config write location

## Explicit out of scope

- No Gemini CLI adapter (that is 15-4 — real implementation)
- No ChatGPT adapter implementation (stub only — subscription uncertain)
- No Perplexity integration (belongs in vault ingestion pipeline, not routing)
- No routing logic in adapters
- No live API calls to any model provider
- No daemon or always-on process
- No changes to `decision-engine.ts` — if a fix is needed there, stop and raise it separately

## Tasks / Subtasks

- [x] **Add `AdapterResult` type to `src/routing/types.ts`** (AC: 6)
  - [x] Add `AdapterResult` as a discriminated union: `{ ok: true; writtenPath: string; modelResolved: string } | { ok: false; error: string; surface: string }`
  - [x] Keep `readonly` modifier pattern consistent with existing types in the file
  - [x] Ensure type is exported and consumable by adapter modules and tests

- [x] **Create shared alias resolution utility** (AC: 7)
  - [x] Create `src/routing/adapters/resolve-alias.ts`
  - [x] Export: `resolveAlias(alias: string, registry: AliasRegistry): { ok: true; modelId: string; provider: string } | { ok: false; error: string }`
  - [x] Look up `registry.aliases[alias]`; if found, return `{ ok: true, modelId: entry.model_id, provider: entry.provider }`
  - [x] If alias is not in registry, return `{ ok: false, error: "..." }` with descriptive message — no throw, no silent fallback
  - [x] Import only `AliasRegistry` type from `../types.js` — no config file imports, no filesystem reads

- [x] **Implement Cursor adapter** (AC: 1, 2, 3, 4)
  - [x] Create `src/routing/adapters/cursor.ts`
  - [x] Export: `applyCursorAdapter(decision: DecisionRecord, registry: AliasRegistry, configPath: string): Promise<AdapterResult>`
  - [x] Call `resolveAlias` from `./resolve-alias.js` to get concrete model string
  - [x] On alias resolution failure, return `{ ok: false, error: ..., surface: "cursor" }`
  - [x] Read existing config at `configPath` if it exists (JSON parse); if file doesn't exist, start with `{}`
  - [x] Merge the resolved `model_id` into the config structure at the documented key path
  - [x] Write atomically: write to `configPath + ".tmp"`, then `rename(tmp, configPath)` — rename is atomic on POSIX
  - [x] On write failure, catch the error and return `{ ok: false, error: ..., surface: "cursor" }` — no throws
  - [x] Add JSDoc comment explaining: target is Cursor settings JSON (`configPath` is typically `.cursor/settings.json`), the write sets the model selection key so Cursor picks it up on next request
  - [x] **Config write location rationale:** Cursor reads model selection from `.cursor/settings.json` in the workspace root. Writing to a project-level settings file (not user-level) ensures per-workspace model control and avoids polluting global settings. The adapter merges into an existing settings object to avoid clobbering other Cursor config keys.

- [x] **Implement Claude Code adapter** (AC: 1, 2, 3, 5)
  - [x] Create `src/routing/adapters/claude-code.ts`
  - [x] Export: `applyClaudeCodeAdapter(decision: DecisionRecord, registry: AliasRegistry, configPath: string): Promise<AdapterResult>`
  - [x] Call `resolveAlias` from `./resolve-alias.js` to get concrete model string
  - [x] On alias resolution failure, return `{ ok: false, error: ..., surface: "claude-code" }`
  - [x] Read existing config at `configPath` if it exists (JSON parse); if file doesn't exist, start with `{}`
  - [x] Write the resolved `model_id` into the Claude Code settings structure at the documented key path
  - [x] Write atomically: same temp + rename pattern as Cursor adapter
  - [x] On write failure, catch the error and return `{ ok: false, error: ..., surface: "claude-code" }` — no throws
  - [x] Add JSDoc comment explaining: target is Claude Code settings JSON, the write sets the top-level `"model"` key (corrected from story's original `env.ANTHROPIC_MODEL` — see Dev Agent Record)
  - [x] **Config write location rationale (CORRECTED):** Claude Code reads its model from the top-level `"model"` key in settings.json (not `env.ANTHROPIC_MODEL`). The `env` block is for provider config (e.g. Bedrock ARNs), not model selection. Writing the `"model"` key is the canonical persistent method documented by Anthropic. Precedence: settings.json `"model"` → `ANTHROPIC_MODEL` env → `--model` flag → `/model` command.

- [x] **Create ChatGPT stub** (AC: 8)
  - [x] Create `src/routing/adapters/chatgpt.ts`
  - [x] Content: single comment line `// ChatGPT adapter — deferred. Subscription status uncertain. Add if subscription is retained.`
  - [x] No exports, no implementation

- [x] **Write adapter tests** (AC: 9)
  - [x] Create `tests/model-routing/surface-adapters.test.ts`
  - [x] Use `node:fs/promises` and `node:os` for temp directory — `mkdtemp` per test, `rm` after
  - [x] Shared test fixtures: build a `DecisionRecord` inline (do NOT import `resolveRoutingDecision`), build an `AliasRegistry` inline
  - [x] Test: `resolveAlias` happy path — known alias returns `{ ok: true, modelId, provider }`
  - [x] Test: `resolveAlias` missing alias — returns `{ ok: false }` with error message
  - [x] Test: `applyCursorAdapter` happy path — writes correct model to temp file, returns `{ ok: true, writtenPath, modelResolved }`
  - [x] Test: `applyCursorAdapter` preserves existing config keys — read back and verify non-model keys survived
  - [x] Test: `applyCursorAdapter` alias-not-in-registry — returns `{ ok: false, surface: "cursor" }`
  - [x] Test: `applyClaudeCodeAdapter` happy path — writes correct model to temp file, returns `{ ok: true, writtenPath, modelResolved }`
  - [x] Test: `applyClaudeCodeAdapter` preserves existing config keys — read back and verify non-model keys survived
  - [x] Test: `applyClaudeCodeAdapter` alias-not-in-registry — returns `{ ok: false, surface: "claude-code" }`
  - [x] Test: atomic write failure — simulate by providing an invalid temp path (e.g. nested under nonexistent dir) → returns `{ ok: false }` without throwing
  - [x] All tests pure: no network, no live Cursor or Claude Code invocations, all config inline

- [x] **Update `config/model-routing/_README.md`** (AC: 10)
  - [x] Add section: "Surface adapters" — what they do (translate a `DecisionRecord` into surface-specific config format)
  - [x] Add subsection: "Cursor adapter" — writes to `.cursor/settings.json` (workspace-level); explain which JSON key holds the model selection and why project-level is preferred
  - [x] Add subsection: "Claude Code adapter" — writes to `.claude/settings.json` under top-level `"model"` key (corrected from story's original `env.ANTHROPIC_MODEL`)
  - [x] Add subsection: "How to add a new surface adapter" — step-by-step guide: create module in `src/routing/adapters/`, use `resolveAlias` for alias → model_id, follow the `AdapterResult` contract, add tests, update this README

- [x] **Verify all gates pass** (AC: 9)
  - [x] `npm test` passes (259 tests, 29 files)
  - [x] `npm run lint` passes
  - [x] `npm run typecheck` passes
  - [x] `bash scripts/verify.sh` passes unchanged

## Dev Notes

### Adapter pattern — the critical design decision

Adapters are **translators only**. They:
- Receive a `DecisionRecord` (already resolved by the engine) and an `AliasRegistry`
- Resolve the alias to a concrete `model_id` via `resolveAlias()`
- Write the model string to the surface's config location
- Return a structured `AdapterResult` — never throw for expected failures

Adapters do NOT:
- Call `resolveRoutingDecision` — the caller does that before invoking the adapter
- Evaluate deny/allow lists or walk fallback chains — that's the engine's job
- Import config from `config/model-routing/` — config is injected as parameters
- Make network calls or invoke live model providers

### Alias resolution — shared utility, not duplicated

`src/routing/adapters/resolve-alias.ts` is the single function that maps `alias → model_id`. Both adapters call it. The function:
1. Looks up `registry.aliases[alias]`
2. If found → returns `{ ok: true, modelId: entry.model_id, provider: entry.provider }`
3. If not found → returns `{ ok: false, error: "Alias \"<alias>\" not found in registry" }`

This prevents each adapter from reimplementing registry lookup and ensures consistent error messages.

### Cursor config write location

**Target:** `.cursor/settings.json` in the workspace root (project-level, not user-level).

**Why `.cursor/settings.json`:**
- Cursor reads model configuration from its settings JSON. The workspace-level settings file (`.cursor/settings.json`) is preferred because:
  1. It scopes model selection to the project — different vaults can use different models
  2. It doesn't pollute the user's global Cursor settings
  3. It is machine-readable JSON that can be atomically written
- The adapter should merge the model selection key into the existing settings object (preserve other keys).

**Config structure (Cursor settings):**
The adapter writes the `model_id` resolved from the alias. The exact key path within the Cursor settings JSON depends on Cursor's current config format. Cursor supports model configuration through a `models` key or through feature-specific model settings. The adapter should write to a CNS-specific namespace to avoid conflicts:
```json
{
  "cns.routing.model": "<resolved_model_id>"
}
```
Alternatively, if Cursor supports a top-level model override, the adapter may write there. **Document the chosen key and rationale in the adapter's JSDoc.**

The `configPath` parameter allows the caller to specify the path — the adapter does not hardcode `.cursor/settings.json`. Tests pass a temp file path.

### Claude Code config write location

**Target:** `~/.claude/settings.json` (Claude Code's persistent settings file).

**Why `~/.claude/settings.json`:**
- Claude Code reads its default model from the `ANTHROPIC_MODEL` environment variable. This env var can be set persistently via `~/.claude/settings.json` under the `env` key:
  ```json
  {
    "env": {
      "ANTHROPIC_MODEL": "<resolved_model_id>"
    }
  }
  ```
- Writing to the settings file is preferred because:
  1. It is machine-readable JSON (not shell rc file manipulation)
  2. It affects only Claude Code (not other shell processes)
  3. Claude Code loads it automatically on startup
  4. It supports atomic write via temp + rename
- The adapter merges `env.ANTHROPIC_MODEL` into the existing settings to preserve other Claude Code config.

The `configPath` parameter allows the caller to specify the path — the adapter does not hardcode `~/.claude/settings.json`. Tests pass a temp file path.

### Atomic write pattern

Both adapters use the same pattern:
1. Serialize the config object to JSON with `JSON.stringify(config, null, 2)` + trailing newline
2. Write to `configPath + ".tmp"` using `writeFile`
3. `rename(configPath + ".tmp", configPath)` — atomic on POSIX filesystems
4. If `rename` fails, attempt to `unlink` the temp file (best-effort cleanup), then return `{ ok: false }`

This prevents partial writes from leaving the target surface in a broken state.

### Error handling — structured results, no throws

Like the engine, adapters use the `{ ok, error }` discriminated union pattern:
- Alias not in registry → `{ ok: false, error: "Alias ... not found in registry", surface: "cursor" }`
- Config parse failure (existing file is not valid JSON) → `{ ok: false, error: "Failed to parse existing config: ...", surface: "cursor" }`
- Write/rename failure → `{ ok: false, error: "Atomic write failed: ...", surface: "cursor" }`
- Unexpected errors are caught and returned as `{ ok: false }` — adapters never throw for expected failures

### Type additions to `src/routing/types.ts`

Add at the end of the file:

```typescript
export type AdapterResult =
  | { readonly ok: true; readonly writtenPath: string; readonly modelResolved: string }
  | { readonly ok: false; readonly error: string; readonly surface: string };
```

This follows the existing `readonly` pattern and discriminated union style in the file.

### Existing code conventions to follow

- **TypeScript + ESM:** `"type": "module"` in `package.json`; use `.js` extensions in relative imports (e.g., `import { resolveAlias } from "./resolve-alias.js"`)
- **Error pattern:** Structured results for expected failures (adapter errors); exceptions only for truly unexpected programming bugs
- **Test pattern:** See `tests/model-routing/decision-engine.test.ts` for Vitest conventions — inline fixtures, no mocks of I/O except temp dir for filesystem tests
- **Config is not a dependency of adapter modules:** Adapter modules must NOT import from `config/` — the `AliasRegistry` is injected as a parameter
- **`readonly` types:** All interface fields in `src/routing/types.ts` use `readonly` — maintain this for `AdapterResult`

### File structure

| Artifact | Path | Action |
|----------|------|--------|
| AdapterResult type | `src/routing/types.ts` | modified — add `AdapterResult` |
| Alias resolver | `src/routing/adapters/resolve-alias.ts` | new |
| Cursor adapter | `src/routing/adapters/cursor.ts` | new |
| Claude Code adapter | `src/routing/adapters/claude-code.ts` | new |
| ChatGPT stub | `src/routing/adapters/chatgpt.ts` | new |
| Adapter tests | `tests/model-routing/surface-adapters.test.ts` | new |
| README | `config/model-routing/_README.md` | modified — add adapter sections |

Vitest config (`vitest.config.ts`) already includes `tests/model-routing/**/*.test.ts` — no change needed.

### Testing approach

Tests use **real filesystem operations on temp directories**, not mocks:

```typescript
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let tempDir: string;
beforeEach(async () => { tempDir = await mkdtemp(path.join(tmpdir(), "cns-adapter-")); });
afterEach(async () => { await rm(tempDir, { recursive: true, force: true }); });
```

This gives real filesystem behavior (atomic rename, permission errors) without touching actual Cursor or Claude Code config.

**Test cases:**
1. `resolveAlias` happy path → `{ ok: true, modelId: "claude-sonnet", provider: "anthropic" }`
2. `resolveAlias` missing alias → `{ ok: false, error: ... }`
3. Cursor adapter happy path → file written, `{ ok: true, writtenPath, modelResolved: "claude-sonnet" }`
4. Cursor adapter preserves existing keys → existing JSON keys survive merge
5. Cursor adapter alias-not-in-registry → `{ ok: false, surface: "cursor" }`
6. Claude Code adapter happy path → file written with `env.ANTHROPIC_MODEL` set
7. Claude Code adapter preserves existing keys → existing JSON keys survive merge
8. Claude Code adapter alias-not-in-registry → `{ ok: false, surface: "claude-code" }`
9. Atomic write failure → provide unwritable path → `{ ok: false }` without throwing

**No test imports `resolveRoutingDecision`** — tests construct `DecisionRecord` objects inline.

### Model alias registry context

The shipped registry (`config/model-routing/model-alias-registry.json`) maps:
- `default-coding` → `{ provider: "anthropic", model_id: "claude-sonnet" }`
- `default-reasoning` → `{ provider: "anthropic", model_id: "claude-opus" }`
- `fast` → `{ provider: "anthropic", model_id: "claude-haiku" }`
- `deep` → `{ provider: "anthropic", model_id: "claude-opus" }`

The `model_id` is the concrete string the adapter writes to the surface config.

### Previous story intelligence (15-2)

- **Agent:** Claude Opus 4.6 (Cursor)
- **Patterns established:**
  - `readonly` modifier on all type interface fields
  - Discriminated union `{ ok: true, ... } | { ok: false, ... }` for result types
  - Pure functions with injected config (no module-level imports from `config/`)
  - `validateReasonCode` / `makeError` helper patterns for internal error construction
  - Inline test fixtures — no shared config file loading in engine tests
- **Review findings resolved:**
  - Fail-closed reason-code handling rejects empty registry precondition
  - Primary alias registry guard before fallback walk
  - Final decision schema-shape validation before returning
- **Decision engine API:** `resolveRoutingDecision(context, policy, registry, reasonCodes): RoutingDecisionResult`
- **The engine has zero knowledge of adapters** — it returns a `DecisionRecord` and the caller is responsible for invoking the appropriate adapter.

### Previous story intelligence (15-1)

- **Agent:** GPT-5.2 (Cursor)
- **Patterns established:**
  - Ajv with `strict: true, strictSchema: false, validateSchema: false, validateFormats: false` for cross-schema `$ref` validation in config tests
  - `isRecord()` type guard for runtime object shape checks
  - `intersection()` helper for conflict detection
  - `CREDENTIAL_KEY_BLOCKLIST` for safety scanning
  - Schema files reference each other via `$ref` — policy schema references reason-codes schema
- **Registry schema:** `model-alias-registry.schema.json` enforces alias names match `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$` and entries require `provider` + `model_id`

### Git intelligence

Recent commits are documentation-focused (constitution, BMAD templates, AGENTS.md symlinks) plus 15-1 and 15-2 implementation. `src/routing/` currently contains:
- `src/routing/types.ts` — TypeScript interfaces
- `src/routing/decision-engine.ts` — pure routing function

The `src/routing/adapters/` directory does not yet exist — this story creates it.

### Project Structure Notes

- Alignment with unified project structure: new adapter modules go under `src/routing/adapters/`, following the `src/routing/` namespace established by 15-2
- Test file follows existing pattern: `tests/model-routing/surface-adapters.test.ts`
- No new dependencies needed — adapters use only `node:fs/promises`, `node:path`, and existing types from `../types.js`

### References

- [Source: `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` — §Recommended Phase 3 epic/story breakdown item 3: Surface adapters]
- [Source: `_bmad-output/implementation-artifacts/15-2-routing-decision-engine.md` — completion notes, types, review resolutions, pure function pattern]
- [Source: `_bmad-output/implementation-artifacts/15-1-policy-schema-and-model-alias-registry.md` — registry schema, credential blocklist, config validation patterns]
- [Source: `src/routing/types.ts` — existing type definitions: `DecisionRecord`, `AliasRegistry`, `AliasEntry`, `RoutingDecisionResult`]
- [Source: `src/routing/decision-engine.ts` — `resolveRoutingDecision` function signature and return shape]
- [Source: `config/model-routing/model-alias-registry.json` — shipped alias → model_id mappings]
- [Source: `config/model-routing/model-alias-registry.schema.json` — alias entry shape with `provider` + `model_id` required fields]
- [Source: `config/model-routing/_README.md` — existing operator guidance, allow/deny precedence, versioning]
- [Source: `_bmad-output/implementation-artifacts/epic-14-retro-2026-04-14.md` — continuity: when starting first router implementation story, re-open readout dependency section]

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

- Operator guide: no update required (surface adapters are internal routing infrastructure, no new user-facing tool or workflow).
- **Claude Code config location corrected from story spec:** The story originally specified `env.ANTHROPIC_MODEL` within `~/.claude/settings.json` as the write target. Web research against current Claude Code 3.x documentation confirmed this is **incorrect**. Claude Code reads model selection from the **top-level `"model"` key** in settings.json (e.g., `{ "model": "claude-opus-4-6" }`). The `env` block in settings.json is for provider-specific config (Bedrock ARNs, etc.), not model selection. Implementation uses the correct `"model"` key. Precedence documented in adapter JSDoc: settings.json `"model"` (lowest) → `ANTHROPIC_MODEL` env → `--model` flag → `/model` command (highest).
- Added `AdapterResult` discriminated union type to `src/routing/types.ts` following existing `readonly` pattern.
- Created `src/routing/adapters/resolve-alias.ts` — shared utility for alias → `model_id` resolution. Returns structured result, no throws. Both adapters call this function — no duplicated registry lookup. Revision hardening: aliases with missing, empty, or non-string `model_id` now return `{ ok: false }` with a clear error instead of reporting success.
- Created `src/routing/adapters/cursor.ts` — Cursor adapter writes `cns.routing.model` key to workspace-level `.cursor/settings.json`. Atomic write via temp + rename. Merges into existing config to preserve other Cursor settings. Revision hardening: valid JSON that is not an object now returns `{ ok: false }` instead of being treated as `{}` and overwritten.
- Created `src/routing/adapters/claude-code.ts` — Claude Code adapter writes top-level `"model"` key to `.claude/settings.json` (project or user level). Atomic write via temp + rename. Merges into existing config to preserve permissions, env, and other Claude Code settings. Revision hardening: valid JSON that is not an object now returns `{ ok: false }` instead of being treated as `{}` and overwritten.
- Created `src/routing/adapters/chatgpt.ts` — comment-only stub as specified.
- 16 adapter tests covering: `resolveAlias` happy path and failure, malformed alias entries with invalid `model_id`, Cursor adapter happy path + merge preservation + alias failure + write failure + invalid JSON + non-object JSON rejection, Claude Code adapter happy path + merge preservation + alias failure + write failure + non-object JSON rejection + overwrite.
- Updated `config/model-routing/_README.md` with: Surface adapters section, Cursor adapter subsection, Claude Code adapter subsection (with corrected config key), How to add a new surface adapter guide.
- All gates green after revision: 263 tests (16 adapter tests in `tests/model-routing/surface-adapters.test.ts`), lint, typecheck, build, `bash scripts/verify.sh`.

### Change Log

- 2026-04-15: Story 15-3 implemented — surface adapters (Cursor, Claude Code), shared alias resolver, ChatGPT stub, adapter tests, README documentation.
- 2026-04-15: Claude Code config write location corrected from `env.ANTHROPIC_MODEL` to top-level `"model"` key per current Anthropic documentation.
- 2026-04-15: Addressed review findings — `resolveAlias` now rejects invalid `model_id` values and both adapters reject non-object JSON configs with regression coverage.

### File List

- `src/routing/types.ts` (modified — added `AdapterResult` type)
- `src/routing/adapters/resolve-alias.ts` (new — shared alias → model_id resolution utility)
- `src/routing/adapters/cursor.ts` (new — Cursor surface adapter, writes `cns.routing.model` to `.cursor/settings.json`)
- `src/routing/adapters/claude-code.ts` (new — Claude Code surface adapter, writes `"model"` to `.claude/settings.json`)
- `src/routing/adapters/chatgpt.ts` (new — comment-only stub, deferred)
- `tests/model-routing/surface-adapters.test.ts` (new — 12 tests for adapters and alias resolution)
- `config/model-routing/_README.md` (modified — added surface adapter documentation)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — 15-3 status tracking)
- `_bmad-output/implementation-artifacts/15-3-surface-adapters.md` (modified — task completion, dev record)
