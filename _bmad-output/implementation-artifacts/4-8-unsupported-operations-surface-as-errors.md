# Story 4.8: Unsupported operations surface as errors

Status: done

**Spec binding:** Normative tool list and behavior remain `specs/cns-vault-contract/CNS-Phase-1-Spec.md` and `specs/cns-vault-contract/modules/`. This story only tightens **error surfacing** at the MCP tool boundary; it does **not** add tools or change read/write policy beyond returning stable codes.

## Story

As an **agent**,  
I want **unsupported or disallowed operation shapes and unexpected failures to return stable MCP errors instead of raw throws**,  
so that **I never mistake a transport-level failure for success and I can branch on `code`**.

## Scope (tight)

**In scope**

- **MCP handler boundary** (`src/register-vault-io-tools.ts`, invoked from `src/index.ts`): every registered tool’s async handler must **never** rethrow a non-`CnsError` into the MCP SDK. Today each handler does `if (e instanceof CnsError) return callToolErrorFromCns(e); throw e;` — replace with a **single shared pattern** (small helper or wrapper) so unknown errors always become a **`callToolErrorFromCns`** result.
- **Error code policy** (document in code + story):
  - **`UNSUPPORTED`** — Phase 1 / contract does not offer this **capability or shape** (same meaning as existing `vault_search` when scope and default are both missing). Use for intentional “not available” branches, not for random IO failures.
  - **`IO_ERROR`** — unexpected exceptions, library throws, or filesystem failures that are not already mapped to a more specific `CnsError` code.
- **Tests** proving a handler that throws a plain `Error` returns structured MCP error JSON with **`IO_ERROR`** (or the agreed mapping), not an uncaught rejection.
- **Light audit**: grep `src/` for `throw new Error` / bare `throw` on hot paths; if any represent “not supported in Phase 1”, convert to `new CnsError("UNSUPPORTED", ...)` with a clear message. Do **not** refactor working `CnsError` chains.

**Explicitly out of scope (do not do in 4-8)**

- **Story 4.9** — canonical read boundary / symlink hardening for read tools (`realpath` parity, `VAULT_BOUNDARY` on symlink escape). No changes to `paths.ts` read resolution for this story.
- **New tools** — no `vault_delete`, no batch/bulk write API, no generic “raw FS” tool.
- **Audit logger / Epic 5** — no new logging behavior beyond optional `console.error` for unexpected errors if you already follow a project pattern.
- **Spec rewrites** — no new markdown in `specs/` unless a one-line cross-reference is truly necessary (prefer code comments).

## Acceptance criteria

1. **Given** any registered Vault IO tool handler  
   **When** the implementation throws a value that is **not** `instanceof CnsError`  
   **Then** the MCP client still receives **`isError: true`** with JSON body `{ code, message, ... }` per `callToolErrorFromCns`, using **`IO_ERROR`** (and a **safe** message — avoid leaking full stack traces in the JSON payload; stderr logging for operators is optional).

2. **Given** a code path that intentionally means “Phase 1 does not support this operation / shape”  
   **When** that path is hit  
   **Then** the tool returns **`UNSUPPORTED`** with a clear, agent-actionable message (consistent with `src/errors.ts` and architecture §9).

3. **Given** existing tools that already throw `CnsError` with specific codes (`NOT_FOUND`, `VAULT_BOUNDARY`, etc.)  
   **When** those paths run  
   **Then** behavior is **unchanged** except where the shared wrapper only affects non-`CnsError` throws.

4. **Tests** in `tests/` (Vitest) cover at least one tool path where a **plain `Error`** is thrown inside the implementation (test double / injected failure or minimal internal hook) and assert the **serialized error code** is **`IO_ERROR`**.

## Tasks / Subtasks

- [x] Add shared **`toolTry`** / **`handleToolError`** (name to match repo style) used by all tool handlers in `src/register-vault-io-tools.ts` (AC1, AC3).
- [x] Map unknown errors → `CnsError("IO_ERROR", ...)` with bounded `details` if useful (`name`, not stack in JSON unless spec requires otherwise) (AC1).
- [x] Optional quick pass: convert any stray “not supported” plain `Error` in `src/tools/` to `CnsError("UNSUPPORTED", ...)` (AC2); skip if none found.
- [x] Add Vitest coverage for non-`CnsError` throw → `IO_ERROR` JSON shape (AC4).
- [x] Run `bash scripts/verify.sh` before marking done.

## Dev notes

- **Reuse:** `CnsError`, `callToolErrorFromCns` — `src/errors.ts`, `src/mcp-result.ts`.
- **Precedent:** `src/tools/vault-search.ts` uses `UNSUPPORTED` when neither `scope` nor `CNS_VAULT_DEFAULT_SEARCH_SCOPE` is set; tests in `tests/vault-io/vault-search.test.ts`.
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` §9 (MCP tool error contract); stable codes include `UNSUPPORTED` and `IO_ERROR`.
- **Epic alignment:** `epics.md` Story 4.8 / FR20 — explicit errors for unsupported or disallowed operation shapes; this story implements the **defensive layer** only.

## Dev Agent Record

### Agent Model Used

Cursor (Composer agent)

### Debug Log References

### Completion Notes List

- Added `handleToolInvocationCatch` in `src/mcp-result.ts`: `CnsError` → `callToolErrorFromCns`; anything else → `IO_ERROR` with a **generic agent-facing message**, bounded `details` (`name` or `kind`, plus `debug` carrying the original throw text), **no stack** in JSON.
- Tool registration lives in `src/register-vault-io-tools.ts`; `src/index.ts` loads config, registers tools, connects stdio. All eight handlers use `return handleToolInvocationCatch(e)` in catch blocks (replacing rethrow).
- Grep for `throw new Error` under `src/` found no occurrences; optional AC2 conversions not needed.
- Tests: `tests/vault-io/mcp-tool-invocation-error.test.ts` (unit) and `tests/vault-io/vault-read-mcp-handler.test.ts` (registered `vault_read` handler + mocked `vaultReadFile` → `IO_ERROR`).
- `bash scripts/verify.sh` passed.

### File List

- `src/mcp-result.ts`
- `src/register-vault-io-tools.ts`
- `src/index.ts`
- `tests/vault-io/mcp-tool-invocation-error.test.ts`
- `tests/vault-io/vault-read-mcp-handler.test.ts`
- `_bmad-output/implementation-artifacts/4-8-unsupported-operations-surface-as-errors.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-02: Story 4-8 — shared MCP handler error boundary (`handleToolInvocationCatch`), Vitest coverage, sprint status → review.
- 2026-04-02: Story 4-8 — AC4 integration test via `registerVaultIoTools`; `IO_ERROR` agent message sanitization + `details.debug`; verify passed; status → done.
