# Story 18.6: Perplexity Slot: Real Direct API Implementation

Status: done

Epic: 18 (LLM adapters + full chain wiring)

## Story

As a **research automation system**,
I want **the production `PerplexitySlot` to call Perplexity’s API directly (not stubbed, not “MCP”)**,
so that **Vault IO can run Perplexity-backed searches in production code paths with deterministic tests and correct domain errors**.

## Context / Baseline

- Green baseline: **489 tests passing** (22 TAP + 467 Vitest) and `bash scripts/verify.sh` passes.
- `src/agents/perplexity-slot.ts` is currently a stub:
  - `available` is set based on `PERPLEXITY_API_KEY`
  - `search()` always throws `CnsError("UNSUPPORTED", ...)`
  - Stub comment incorrectly references “MCP call not yet implemented” — MCP tools are invoked by agent runtimes, not Node.js production code.
- The working direct-call pattern already exists in `scripts/run-research-agent.ts` (`buildPerplexitySlot`) and must be ported into the production module.
- **Dev model for this story:** Cursor Composer 2 (straightforward port).

## Hard Constraints / Guardrails

- **Production code change scope (hard):** modify **one file only**
  - `src/agents/perplexity-slot.ts`
  - Keep existing exported types (`PerplexityResult`, `PerplexitySlot`) and the exported `createPerplexitySlot()` signature **exactly the same**.
- **Tests:** add **one new test file only**
  - `tests/vault-io/perplexity-slot.test.ts`
  - All tests must mock `fetch` — **no live network calls**.
- **No new production files** and no changes to unrelated modules.
- The stub comment referencing “MCP call not yet implemented” must be removed.

## Requirements (verbatim)

### Slot behavior

- `createPerplexitySlot()` returns a `PerplexitySlot` with `available: true` when `PERPLEXITY_API_KEY` is set (non-empty), `false` otherwise.
- When `available` is false and `search()` is called, throw:
  - `CnsError("UNSUPPORTED", "Perplexity not configured — PERPLEXITY_API_KEY missing")`
- When `available` is true, `search(query)` calls:
  - `POST https://api.perplexity.ai/chat/completions`
  - `Authorization: Bearer <PERPLEXITY_API_KEY>`
  - `Content-Type: application/json`
  - `body: { model: "sonar", messages: [{ role: "user", content: query }] }`
  - Parse response as:
    - `{ choices: [{ message: { content: string } }], citations?: string[] }`
  - Return:
    - `{ answer: choices[0].message.content ?? "", citations: citations ?? [] }`
- Non-2xx response → `CnsError("IO_ERROR", "Perplexity API HTTP <status>")`
- Fetch rejects → `CnsError("IO_ERROR", "Perplexity fetch failed: <message>")`
- Response not valid JSON → `CnsError("IO_ERROR", "Perplexity response was not valid JSON")`

### Implementation scope

- Modify one file only:
  - `src/agents/perplexity-slot.ts`
- No new files in `src/`.

### Test requirements (new file)

New test file:
- `tests/vault-io/perplexity-slot.test.ts`

All tests use mocked `fetch` — no live API calls.

- Happy path: mock returns valid response, slot resolves with answer + citations.
  - Assert `fetch` called with correct URL, method, Authorization header, model.
- `available: false` when `PERPLEXITY_API_KEY` not set.
- `available: true` when `PERPLEXITY_API_KEY` is set.
- `search()` when `available` is false → `CnsError("UNSUPPORTED")`.
- Non-2xx response → `CnsError("IO_ERROR")` with status in message.
- Fetch rejects → `CnsError("IO_ERROR")`.
- Non-JSON response → `CnsError("IO_ERROR")`.

## Acceptance Criteria

### AC1. Direct Perplexity API call (no MCP, no stub throw)

- **Given** `src/agents/perplexity-slot.ts`
- **When** `createPerplexitySlot().search(query)` is invoked with Perplexity configured
- **Then** it performs a direct `fetch` to `https://api.perplexity.ai/chat/completions` using the contract in Requirements
- **And** it does not reference MCP and does not throw “stub” `UNSUPPORTED`.

### AC2. `available` reflects `PERPLEXITY_API_KEY` presence correctly

- **Given** `PERPLEXITY_API_KEY` is unset or empty
- **When** `createPerplexitySlot()` is called
- **Then** `available === false`.

- **Given** `PERPLEXITY_API_KEY` is set (non-empty string)
- **When** `createPerplexitySlot()` is called
- **Then** `available === true`.

### AC3. Missing config search error is `UNSUPPORTED` with exact message

- **Given** `available === false`
- **When** `search(query)` is called
- **Then** it throws `CnsError("UNSUPPORTED", "Perplexity not configured — PERPLEXITY_API_KEY missing")`.

### AC4. PerplexityResult shape is correct

- **Given** a successful Perplexity response
- **When** `search(query)` resolves
- **Then** the returned value is exactly `{ answer: string, citations: string[] }` matching the existing `PerplexityResult` type:
  - `answer` defaults to `""` when missing
  - `citations` defaults to `[]` when missing.

### AC5. Error mapping uses correct `CnsError` codes and messages

- **Non-2xx response**: throws `CnsError("IO_ERROR", "Perplexity API HTTP <status>")`
- **Fetch rejects**: throws `CnsError("IO_ERROR", "Perplexity fetch failed: <message>")`
- **Invalid JSON**: throws `CnsError("IO_ERROR", "Perplexity response was not valid JSON")`.

### AC6. All 7 test cases pass with mocked fetch only

- **Given** `tests/vault-io/perplexity-slot.test.ts`
- **When** `vitest` runs
- **Then** all 7 cases pass and no live Perplexity call is attempted.

### AC7. Verify gate remains green

- `bash scripts/verify.sh` passes at **489+** tests.

### AC8. Change scope honored

- Only `src/agents/perplexity-slot.ts` is modified in production code.
- Only one new test file is added: `tests/vault-io/perplexity-slot.test.ts`.
- The incorrect “MCP call not yet implemented” stub comment is removed.

## Tasks / Subtasks

- [x] Implement direct Perplexity API slot in `src/agents/perplexity-slot.ts` (AC: 1–5, 8)
  - [x] `available` is `true` only when `process.env.PERPLEXITY_API_KEY` is **non-empty**
  - [x] If `available === false`, `search()` throws `CnsError("UNSUPPORTED", "Perplexity not configured — PERPLEXITY_API_KEY missing")`
  - [x] On `available === true`, `search()` performs the Perplexity POST request and returns `{ answer, citations }`
  - [x] Error mapping:
    - [x] non-2xx → `CnsError("IO_ERROR", "Perplexity API HTTP <status>")`
    - [x] fetch rejection → `CnsError("IO_ERROR", "Perplexity fetch failed: <message>")`
    - [x] invalid JSON → `CnsError("IO_ERROR", "Perplexity response was not valid JSON")`
  - [x] Remove the incorrect stub comment about MCP

- [x] Add unit tests `tests/vault-io/perplexity-slot.test.ts` (AC: 6)
  - [x] Mock `fetch` via Vitest (`vi.stubGlobal("fetch", ...)`) and reset between tests (`vi.unstubAllGlobals()` in `afterEach`)
  - [x] Implement the 7 required test cases and assert request URL/body/headers on happy path

- [x] Verify gate (AC: 7)
  - [x] `bash scripts/verify.sh`

## Dev Notes / Implementation Guidance (read before coding)

- **Port the request shape exactly** from `scripts/run-research-agent.ts` `buildPerplexitySlot(...)`:
  - URL: `https://api.perplexity.ai/chat/completions`
  - JSON body: `model: "sonar"`, `messages: [{ role: "user", content: query }]`
- **Error type and codes** are defined in `src/errors.ts` (`CnsError` with code union including `IO_ERROR` and `UNSUPPORTED`).
- **Tests in this repo import ESM outputs with `.js` extensions** (see other `tests/vault-io/*`).
- **Test helper approach:** use `new Response(JSON.stringify(...), { status, headers })` to simulate API responses, matching existing adapter tests.

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Cursor Composer 2

### Debug Log References

- `bash scripts/verify.sh` — PASS (2026-04-20). TAP: 22 passed. Vitest: 474 passed.

### Completion Notes List

- ✅ Implemented direct Perplexity API `POST https://api.perplexity.ai/chat/completions` with `sonar` + `messages[{role:"user",content:query}]` and correct auth/content-type headers.
- ✅ Domain error mapping:
  - non-2xx → `CnsError("IO_ERROR", "Perplexity API HTTP <status>")`
  - fetch rejection → `CnsError("IO_ERROR", "Perplexity fetch failed: <message>")`
  - invalid JSON → `CnsError("IO_ERROR", "Perplexity response was not valid JSON")`
- ✅ Tests added with fully mocked `fetch` (7 cases).
- Operator guide: no update required.

### File List

- Modified: `src/agents/perplexity-slot.ts`
- Added: `tests/vault-io/perplexity-slot.test.ts`

