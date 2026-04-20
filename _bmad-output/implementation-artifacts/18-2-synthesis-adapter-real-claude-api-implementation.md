# Story 18.2: Synthesis Adapter: Real Claude API Implementation

Status: done

Epic: 18 (Research quality + Perplexity carry)

## Story

As a **research automation system**,
I want **an LLM-backed `SynthesisAdapter` that calls the real Anthropic Messages API and returns Zod-validated synthesis output**,
so that **the Synthesis Agent can produce executive summaries, patterns, gaps, and opportunities from source notes instead of failing with `UNSUPPORTED`**.

## Context / Baseline

- Green baseline: **458 tests passing** (22 TAP + 436 Vitest) and `bash scripts/verify.sh` passes.
- Current behavior: `createDefaultSynthesisAdapter()` throws `new CnsError("UNSUPPORTED", ...)` in `src/agents/synthesis-agent.ts`.
- This story adds a new adapter implementation file only and a dedicated test file. **Do not modify** `src/agents/synthesis-agent.ts` or `createDefaultSynthesisAdapter()`; wiring happens in Story 18-5.

## Requirements (verbatim contracts)

### Adapter input (from `src/agents/synthesis-agent.ts`)

`SynthesisAdapterInput`:

- `topic: string`
- `queries: string[]`
- `source_notes: Array<{ vault_path: string; body: string; frontmatter: Record<string, unknown> }>`

### Adapter output (validated by `synthesisAdapterOutputSchema`)

`SynthesisAdapterOutput`:

- `patterns: string[]`
- `gaps: string[]`
- `opportunities: string[]`
- `summary: string` (min length 1)

## Implementation Scope (hard constraint)

- Add **one new production file only**:
  - `src/agents/synthesis-adapter-llm.ts`
- Add **one new test file** (name/location is flexible; keep it in Vitest suite):
  - Recommended: `tests/vault-io/synthesis-adapter-llm.test.ts`
- No other production file changes in this story.

## Acceptance Criteria

1. **New adapter file exists + exports**
   - **Given** the repository codebase
   - **When** a consumer imports from `src/agents/synthesis-adapter-llm.ts`
   - **Then** the file exists and exports `createLlmSynthesisAdapter(): SynthesisAdapter`.

2. **Calls Anthropic Messages API with required parameters**
   - **Given** a call to `adapter.synthesize(input)`
   - **When** `process.env.ANTHROPIC_API_KEY` is present
   - **Then** the adapter calls `fetch("https://api.anthropic.com/v1/messages", ...)` with:
     - `method: "POST"`
     - `model: "claude-sonnet-4-20250514"`
     - `max_tokens: 1000`
     - `system` prompt establishing role (see AC3)
     - `messages` containing exactly one `"user"` turn (see AC4)
     - Header includes API key read **at call time** from `process.env.ANTHROPIC_API_KEY` (no key passed through function params).

3. **System prompt: role + JSON-only constraint**
   - **Given** the request payload
   - **When** the adapter constructs the `system` prompt
   - **Then** it states the model role as **content research synthesizer for a marketing/creative agency**
   - **And** it instructs: **respond only with a JSON object** (no markdown fences, no preamble).

4. **User prompt: structured research context**
   - **Given** `input.topic`, `input.queries`, and `input.source_notes`
   - **When** the adapter constructs the `"user"` content
   - **Then** it includes:
     - The **topic**
     - The **list of queries run**
     - Each source note body, labeled with its `vault_path`
   - **And** it instructs the model to produce:
     - recurring **patterns** across sources
     - **gaps** in coverage / underexplored areas
     - **opportunities** for original angles
     - an executive **summary** (non-empty)
   - **And** the model is asked to return a JSON object with keys:
     - `patterns`, `gaps`, `opportunities`, `summary`.

5. **JSON parsing + Zod validation before returning**
   - **Given** a 200 response from Anthropic
   - **When** the adapter reads the assistant output text
   - **Then** it runs `JSON.parse(...)`
   - **And** it validates the parsed object with `synthesisAdapterOutputSchema` imported from `src/agents/synthesis-agent.ts`
   - **And** it returns the validated `SynthesisAdapterOutput` object.

6. **IO errors: fetch failure or unparseable response**
   - **Given** any network failure, non-OK response, missing content text, or parse failure
   - **When** the adapter cannot obtain a parseable JSON payload
   - **Then** it throws `new CnsError("IO_ERROR", ...)`.
   - **And** specifically:
     - If `JSON.parse` fails, throw `CnsError("IO_ERROR", "Synthesis LLM returned non-JSON response")`.

7. **Schema errors: JSON parses but Zod fails**
   - **Given** the model returned JSON that parses successfully
   - **When** validation against `synthesisAdapterOutputSchema` fails
   - **Then** the adapter throws `new CnsError("SCHEMA_INVALID", <zod-error-message>)`
   - **And** the message includes `parsed.error.message` from Zod (no wrapping that loses the Zod message).

8. **Test suite: mock fetch only (no live API calls)**
   - **Given** the Vitest test suite
   - **When** tests run
   - **Then** all tests mock `fetch` and do not call the live Anthropic API.

9. **Adapter behavior tests pass**
   - **Happy path**: mock returns valid JSON -> adapter resolves with parsed, validated output
   - **API error**: `fetch` rejects -> adapter throws `CnsError("IO_ERROR", ...)`
   - **Non-JSON response**: returns text that fails `JSON.parse` -> throws `CnsError("IO_ERROR", "Synthesis LLM returned non-JSON response")`
   - **Schema invalid**: returns JSON missing required fields (e.g. missing `summary`) -> throws `CnsError("SCHEMA_INVALID", ...)`
   - **Empty `source_notes`**: adapter still calls API and resolves (skip logic is owned by `runSynthesisAgent`, not the adapter).

10. **Verify gate**
   - `bash scripts/verify.sh` passes with **458+ tests**.

## Tasks / Subtasks

- [x] Implement `createLlmSynthesisAdapter()` (AC: 1–7)
  - [x] Create `src/agents/synthesis-adapter-llm.ts`
  - [x] Export `createLlmSynthesisAdapter(): SynthesisAdapter`
  - [x] Read API key from `process.env.ANTHROPIC_API_KEY` inside `synthesize(...)`
  - [x] Call `fetch("https://api.anthropic.com/v1/messages", ...)` with correct model + `max_tokens`
  - [x] Build system + user prompts per AC3–AC4
  - [x] Extract assistant text from Anthropic response
  - [x] `JSON.parse` with correct IO_ERROR behavior on parse failure
  - [x] Validate via `synthesisAdapterOutputSchema.safeParse(...)`; throw `SCHEMA_INVALID` with Zod error message on failure
  - [x] On any fetch / response parse issue -> throw `CnsError("IO_ERROR", ...)`

- [x] Add adapter tests (AC: 8–10)
  - [x] Create `tests/vault-io/synthesis-adapter-llm.test.ts`
  - [x] Mock `fetch` using Vitest (e.g. `vi.stubGlobal("fetch", ...)`) and reset between tests
  - [x] Write 5 tests:
    - [x] happy path
    - [x] fetch rejects
    - [x] non-JSON response
    - [x] Zod schema invalid JSON
    - [x] empty source_notes still calls API
  - [x] Ensure assertions check `CnsError.code` is correct for each failure mode

- [x] Run verify gate locally (AC: 10)
  - [x] `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Decision] Model string: keep spec-pinned `claude-sonnet-4-20250514` vs update to current `claude-sonnet-4-6` family — Decided: update to `claude-sonnet-4-6`.
- [x] [Review][Decision] Scope expectation: should `_bmad-output/implementation-artifacts/sprint-status.yaml` be reverted for this story? — Decided: keep sprint tracking edits.
- [x] [Review][Decision] JSON strictness vs resilience: keep strict `JSON.parse(assistantText)` only, or add a best-effort JSON extraction fallback (e.g., strip code fences / preamble) while still throwing `CnsError("IO_ERROR", "Synthesis LLM returned non-JSON response")` when extraction/parsing fails — Decided: keep strict parsing (no fallback extraction).

- [x] [Review][Patch] Anthropic `content[]` extraction is fragile: `extractAssistantText` returns only the first `type: "text"` block; multi-block outputs (or non-text blocks preceding text) can break parsing. Consider concatenating all text blocks in order, and add tests for (a) non-text leading block, (b) multiple text blocks forming valid JSON. [`src/agents/synthesis-adapter-llm.ts`]
- [x] [Review][Patch] Treat whitespace-only `ANTHROPIC_API_KEY` as missing (trim before check) and add a unit test for it. [`src/agents/synthesis-adapter-llm.ts`]
- [x] [Review][Patch] Add missing negative-path tests for error mapping: (a) non-2xx response → `CnsError("IO_ERROR", ...)`, (b) missing/invalid envelope (`content` missing or no text block) → `IO_ERROR`, (c) env var missing → `IO_ERROR`. [`tests/vault-io/synthesis-adapter-llm.test.ts`]
- [x] [Review][Patch] Improve non-2xx error debuggability: include safe details (e.g. status + small response body snippet or provider error message if present) without logging prompts/source note content. [`src/agents/synthesis-adapter-llm.ts`]

## Dev Notes / Guardrails (read before coding)

### Existing contract sources

- `SynthesisAdapter`, `SynthesisAdapterInput`, `SynthesisAdapterOutput`, and `synthesisAdapterOutputSchema` live in:
  - `src/agents/synthesis-agent.ts`
- Error type is:
  - `src/errors.ts` (`CnsError` with `code` union including `"IO_ERROR"` and `"SCHEMA_INVALID"`).

### Anthropic response parsing (required approach)

- The adapter must **not** return raw API payloads; it must return the validated `SynthesisAdapterOutput`.
- The adapter must treat any of the following as IO failures:
  - `fetch` throws
  - response is non-OK (HTTP status not 2xx)
  - response JSON shape is missing the assistant content text
  - assistant content exists but is not JSON parseable

### Prompt construction requirements

- System prompt must enforce “JSON only” (no fences).
- User prompt must include all inputs in a deterministic, structured way. Recommended structure:
  - `Topic: ...`
  - `Queries: ...` (bulleted or JSON array)
  - `Sources:` with repeated blocks:
    - `---`
    - `vault_path: ...`
    - `body: ...`

### Test suite conventions

- Tests in this repo import ESM outputs with `.js` extensions (see `tests/vault-io/synthesis-agent.test.ts`).
- Keep tests fast and isolated; do not write to the vault fixture for this adapter-level unit test.
- Ensure global `fetch` mocking does not leak between tests (restore/reset globals).

## Dev Agent Record

### Agent Model Used

Claude Code terminal (Opus)

### Debug Log References

- `bash scripts/verify.sh` (run after implementation)

### Completion Notes List

- Implemented `createLlmSynthesisAdapter()` in `src/agents/synthesis-adapter-llm.ts` as the only new production file. No edits to `src/agents/synthesis-agent.ts` or any other existing file.
- Adapter calls `fetch("https://api.anthropic.com/v1/messages", ...)` with `method: "POST"`, `model: "claude-sonnet-4-20250514"`, `max_tokens: 1000`, headers `x-api-key` + `anthropic-version: 2023-06-01`, and a single user-role message.
- API key is read inside `synthesize(...)` from `process.env.ANTHROPIC_API_KEY` at call time — never passed via function params, never hardcoded. Missing key → `CnsError("IO_ERROR", ...)`.
- System prompt establishes the role as a content research synthesizer for a marketing/creative agency and requires a JSON-only response with no code fences.
- User prompt includes `Topic: ...`, a bulleted list of queries, and repeated `--- / vault_path / body:` blocks for each source note; explicitly asks for `patterns`, `gaps`, `opportunities`, `summary` keys.
- Assistant text is extracted from the first `content[]` block where `type === "text"`. `JSON.parse` failure → `CnsError("IO_ERROR", "Synthesis LLM returned non-JSON response")` exactly as spec'd. Fetch rejection, non-2xx, malformed envelope, or missing content text all surface as `CnsError("IO_ERROR", ...)`.
- Parsed JSON is validated with `synthesisAdapterOutputSchema.safeParse(...)` imported from `src/agents/synthesis-agent.ts`; on failure the adapter throws `CnsError("SCHEMA_INVALID", parsed.error.message)` — the raw Zod message is preserved with no wrapping.
- Tests in `tests/vault-io/synthesis-adapter-llm.test.ts` mock global `fetch` via `vi.stubGlobal("fetch", ...)` and restore with `vi.unstubAllGlobals()` in `afterEach`. All 5 required cases covered: happy path (also asserts request URL, method, model, `max_tokens`, headers, system prompt content, user prompt content), fetch rejection, non-JSON response, schema-invalid JSON, and empty `source_notes`.
- Verify gate passed: `bash scripts/verify.sh` → 22 TAP (node:test) + 441 Vitest = **463 tests passing** (458 baseline + 5 new). Lint, typecheck, and build all green.

### File List

- `src/agents/synthesis-adapter-llm.ts` (new)
- `tests/vault-io/synthesis-adapter-llm.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — added `18-2-synthesis-adapter-real-claude-api-implementation` key, updated `last_updated`)

### Change Log

- 2026-04-20: Implemented Story 18-2 LLM-backed synthesis adapter. Added `createLlmSynthesisAdapter()` (one new production file) + 5 Vitest cases with mocked `fetch` (one new test file). All 10 acceptance criteria satisfied. Verify gate green at 463 tests.

