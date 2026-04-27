# Story 18.3: Hook Generation Adapter: Real Claude API Implementation

Status: done

Epic: 18 (Research quality + Perplexity carry)

## Story

As a **research automation system**,
I want **an LLM-backed `HookGenerationAdapter` that calls the real Anthropic Messages API and returns Zod-validated hook output**,
so that **the Hook Agent can generate and iteratively refine 4 distinct hook options instead of failing with `UNSUPPORTED`**.

## Context / Baseline

- Green baseline: **468 tests passing** (22 TAP + 446 Vitest) and `bash scripts/verify.sh` passes.
- Current behavior: `createDefaultHookGenerationAdapter()` throws `new CnsError("UNSUPPORTED", ...)` in `src/agents/hook-agent.ts`.
- This story implements the **real LLM-backed adapter** that will later replace the default stub via wiring in Story 18-5.
- **Hard constraint:** do **not** modify `src/agents/hook-agent.ts` or `createDefaultHookGenerationAdapter()` in this story.
- **Dev model for this story:** Claude Code terminal (Opus).

## Requirements (verbatim contracts)

### Adapter input (from `src/agents/hook-agent.ts`)

`HookGenerationAdapterInput`:

```ts
{
  synthesis_body: string;       // full markdown body of the synthesis note
  synthesis_vault_path: string; // vault path of the synthesis note
  synthesis_title: string | undefined;
  hook_slot: number;            // 1–4, which of the 4 hook options this is
  iteration: number;            // 1-based, which iteration of refinement
  current_draft: string;        // empty string on iteration 1, previous hook text on iteration 2+
}
```

### Adapter output (validated by `hook-agent.ts`)

Zod-validated by `hookGenerationAdapterOutputSchema` in `src/agents/hook-agent.ts`:

```ts
{
  hook_text: string;  // min 1 char
  score: number;      // integer 1–10
}
```

## Implementation Scope (hard constraint)

- Add **one new production file only**:
  - `src/agents/hook-adapter-llm.ts`
- Add **one new test file** (Vitest suite; name/location flexible):
  - Recommended: `tests/vault-io/hook-adapter-llm.test.ts`
- No other production file changes in this story.
- No live API calls in tests; all Anthropic requests must be mocked.

## Acceptance Criteria

### AC1. New adapter file exists + exports

- **Given** the repository codebase
- **When** a consumer imports from `src/agents/hook-adapter-llm.ts`
- **Then** the file exists and exports `createLlmHookGenerationAdapter(): HookGenerationAdapter`.

### AC2. Calls Anthropic Messages API with required parameters

- **Given** a call to `adapter.generateOrRefine(input)`
- **When** `process.env.ANTHROPIC_API_KEY` is present
- **Then** the adapter calls `fetch("https://api.anthropic.com/v1/messages", ...)` with:
  - `method: "POST"`
  - `model: "claude-sonnet-4-6"`
  - `max_tokens: 1000`
  - `system` prompt matching AC3
  - `messages` containing exactly one `"user"` turn matching AC4/AC5
  - Headers:
    - `x-api-key` read **at call time** from `process.env.ANTHROPIC_API_KEY` (not passed as a param, not hardcoded)
    - `anthropic-version: "2023-06-01"` (match existing adapter convention)
    - `content-type: "application/json"`

### AC3. System prompt: role + JSON-only constraint + exact keys

System prompt must:

- Establish role as a **world-class copywriter for a marketing/creative agency**
- Require: **respond only with a JSON object** (no markdown fences, no preamble, no trailing text)
- Require: JSON has **exactly two keys**:
  - `hook_text` (string)
  - `score` (integer 1–10)
- Require: the score is an **integer only**, and **honest** (10 means genuinely exceptional)

### AC4. User prompt branches correctly on generate vs refine mode

The adapter must treat these as **distinct modes** and the prompt must reflect that distinction.

- **Generate mode**
  - Condition: `iteration === 1` **and** `current_draft === ""`
  - Prompt must:
    - Include `synthesis_body` (full markdown body)
    - Include `synthesis_vault_path`
    - Include `synthesis_title` **if present**
    - Include `hook_slot` and slot archetype guidance (AC6)
    - Explicitly instruct: generate a **fresh** hook from scratch
  - Prompt must **not** mention `current_draft` or “refine”, “improve”, “revision”, “iterate”, etc.

- **Refine mode**
  - Condition: `iteration > 1` **and** `current_draft` is non-empty
  - Prompt must:
    - Include the exact `current_draft` text in a clearly delimited block
    - Include `iteration`, `hook_slot`, and slot archetype guidance (AC6)
    - Include `synthesis_body`
    - Include `synthesis_title` **if present**
    - Explicitly instruct: **refine/improve** the previous draft (without access to prior score)
  - Prompt must **not** pretend to know the previous iteration’s score (adapter does not receive it).

### AC5. Score instruction is explicit about honesty and integer constraint

User prompt (in both modes) must include an explicit scoring rubric:

- Score is **integer 1–10**
- Must self-score based on:
  - **novelty** (freshness / non-generic angle)
  - **copy intensity** (direct, high-stakes, no filler)
- Must be **honest**:
  - 10 means **genuinely exceptional** (rare)
  - 7–9 is strong but improvable
  - 1–6 is weak and must be improved

Rationale: `hook-agent.ts` enforces a 10/10 gate downstream; inflated scores prevent refinement.

### AC6. Hook slot number influences the prompt (4 distinct angle archetypes)

`hook_slot` must influence the user prompt such that the four slots produce meaningfully different hook angles. Use these archetypes:

- **slot 1**: bold claim / big promise
- **slot 2**: counterintuitive / contrarian angle
- **slot 3**: specific + concrete (numbers, mechanisms, named artifacts; avoid vague hype)
- **slot 4**: challenge / provocation (calls the reader out, asks a hard question)

The archetype label (or equivalent distinct instruction) must appear in the prompt so tests can assert slot-driven divergence.

### AC7. Error handling matches synthesis adapter pattern (CnsError codes)

Mirror error-mapping conventions used by `src/agents/synthesis-adapter-llm.ts`.

- **Missing/blank `ANTHROPIC_API_KEY`** (including whitespace-only) → throw `new CnsError("IO_ERROR", ...)`
- **Fetch rejects** → `CnsError("IO_ERROR", ...)`
- **Non-2xx response** → `CnsError("IO_ERROR", ...)` (include safe details: HTTP status; optional short response text snippet; do not log synthesis body)
- **Malformed Anthropic envelope** (no assistant text content) → `CnsError("IO_ERROR", ...)`
- **Non-JSON assistant text** → `CnsError("IO_ERROR", "Hook LLM returned non-JSON response")` (exact message)
- **JSON parses but fails Zod validation** → `CnsError("SCHEMA_INVALID", <zod-error-message>)`
  - Must preserve Zod `error.message` (no wrapping that loses it)

### AC8. Output is parsed and validated before returning

- Extract assistant text from Anthropic `content[]` blocks:
  - Collect all blocks where `type === "text"` and concatenate in order (mirrors synthesis adapter robustness).
- `JSON.parse(assistantText)` strictly (no “strip fences” fallback).
- Validate parsed JSON against the output schema:
  - Prefer importing `hookGenerationAdapterOutputSchema` from `src/agents/hook-agent.ts` (avoid drift).

### AC9. Tests: all mock fetch, and cover all 7 required cases

All tests must:

- Mock global `fetch` using Vitest (`vi.stubGlobal("fetch", ...)`)
- Restore/cleanup globals between tests (e.g. `vi.unstubAllGlobals()` in `afterEach`)
- Never call the real Anthropic API

Required test cases (7 total):

1. **Happy path (iteration 1 / generate mode)**:
   - `current_draft: ""`, `iteration: 1`
   - Mock API returns valid JSON; adapter resolves with parsed output
   - Assert request includes correct:
     - URL, method, headers (including API key), model, `max_tokens`
   - Assert user prompt contains `synthesis_body` content
   - Assert user prompt does **not** contain `"current_draft"` or refine language

2. **Happy path (iteration 2 / refine mode)**:
   - `current_draft` is non-empty, `iteration: 2`
   - Adapter resolves
   - Assert user prompt contains the `current_draft` text
   - Assert user prompt contains refine language

3. **Hook slot influences prompt (slot 1 vs slot 2 differ)**:
   - Run adapter twice with identical input except `hook_slot = 1` vs `hook_slot = 2`
   - Assert user prompt strings differ and each includes its archetype guidance

4. **Missing API key**:
   - `delete process.env.ANTHROPIC_API_KEY` (and/or set to whitespace)
   - Expect `CnsError` with `code: "IO_ERROR"`

5. **Fetch rejects**:
   - `fetch` rejects
   - Expect `CnsError` with `code: "IO_ERROR"`

6. **Non-JSON assistant text**:
   - API returns assistant text `"not json"`
   - Expect `CnsError("IO_ERROR", "Hook LLM returned non-JSON response")`

7. **Schema invalid JSON**:
   - API returns JSON that parses but fails schema (e.g. `{ "hook_text": "x", "score": "10" }`)
   - Expect `CnsError` with `code: "SCHEMA_INVALID"`

### AC10. Verify gate stays green

- `bash scripts/verify.sh` passes with **468+ tests**.

## Tasks / Subtasks

- [x] Implement `createLlmHookGenerationAdapter()` (AC: 1–8)
  - [x] Create `src/agents/hook-adapter-llm.ts`
  - [x] Export `createLlmHookGenerationAdapter(): HookGenerationAdapter`
  - [x] Read API key from `process.env.ANTHROPIC_API_KEY` inside `generateOrRefine(...)` (trim and validate non-empty)
  - [x] Build system + user prompts with strict JSON-only constraint and mode branching (generate vs refine)
  - [x] Ensure slot archetype guidance is explicit and different for slots 1–4
  - [x] Call Anthropic Messages API with correct model + headers + `max_tokens`
  - [x] Extract assistant text from Anthropic envelope (concatenate all text blocks)
  - [x] `JSON.parse` assistant text; enforce the exact IO_ERROR message on parse failure
  - [x] Validate with `hookGenerationAdapterOutputSchema.safeParse(...)`; on failure throw `SCHEMA_INVALID` with Zod error message
  - [x] On any fetch / response / envelope issue -> `IO_ERROR`

- [x] Add adapter tests (AC: 9–10)
  - [x] Create `tests/vault-io/hook-adapter-llm.test.ts`
  - [x] Mock `fetch` via Vitest and reset between tests
  - [x] Implement the 7 required test cases (AC9)
  - [x] Assertions include: request body branching for generate vs refine, slot archetype divergence, and correct `CnsError.code` mapping

## Dev Notes / Guardrails (read before coding)

### Follow existing adapter conventions

- Use `src/agents/synthesis-adapter-llm.ts` as the canonical pattern for:
  - API key handling (`trim()`; whitespace-only treated as missing)
  - Anthropic request shape and headers
  - Non-2xx response mapping to `IO_ERROR` with safe details
  - Anthropic `content[]` assistant text extraction (concatenate multiple text blocks)
  - Strict `JSON.parse` (no code-fence stripping)
  - Zod `safeParse` error propagation (`SCHEMA_INVALID` with raw Zod message)

### Prompt tone constraints (agency context)

- Hooks are for marketing/creative content.
- Tone: **direct, high-stakes, no filler**.
- Slot angles must feel meaningfully different (avoid 4 variants of the same generic hook).
- Scoring honesty is critical to avoid premature 10/10 outcomes that block refinement.

### Test suite conventions

- This repo imports ESM outputs with `.js` extensions in tests.
- Keep tests fast and isolated; no filesystem/vault fixture required for this adapter-only unit suite.

## Dev Agent Record

### Agent Model Used

Claude Code terminal (Opus)

### Debug Log References

- `bash scripts/verify.sh` (run after implementation)

### Completion Notes List

- Implemented `createLlmHookGenerationAdapter()` in the single new production file `src/agents/hook-adapter-llm.ts`. `src/agents/hook-agent.ts` and `createDefaultHookGenerationAdapter()` were not touched — wiring is deferred to Story 18-5.
- Mirrors `src/agents/synthesis-adapter-llm.ts` conventions throughout: Anthropic Messages endpoint + version, `x-api-key` + `anthropic-version: 2023-06-01` + `content-type: application/json`, `model: "claude-sonnet-4-6"`, `max_tokens: 1000`, single `user`-role message, and identical error-mapping shape.
- API key handling: read `process.env.ANTHROPIC_API_KEY` inside `generateOrRefine(...)` at call time, `.trim()`, and treat empty or whitespace-only as missing → `CnsError("IO_ERROR", ...)`. Never accepted via function params, never hardcoded.
- System prompt: role as world-class copywriter for a marketing/creative agency; requires JSON-only response (no fences, no preamble); requires exactly two keys `hook_text` (string) and `score` (integer 1–10); reminds the model that 10 is rare and inflated scores harm the process.
- User prompt branches on mode: `isGenerateMode = iteration === 1 && current_draft === ""` produces the generate prompt (fresh-hook instruction, no mention of previous draft or refine language). Otherwise it produces the refine prompt, which includes `current_draft` inside a `<<<PREVIOUS>>> ... <<<END>>>` block, the current `iteration`, and explicit refine/improve instructions. The refine prompt never references a prior score (adapter doesn't receive it).
- Slot archetypes defined for all four slots (bold claim / counterintuitive / specific + concrete / challenge) with positive-only guidance so prompts for different slots share no archetype keywords. Slot label and guidance both appear in the user prompt, satisfying AC6 and producing meaningfully different prompts per slot.
- Scoring rubric block is included in both generate and refine prompts: integer 1–10, honest self-assessment based on **novelty** and **copy intensity**, with thresholds (10 rare/exceptional, 7–9 strong-but-not-exceptional, 1–6 weak). Wording deliberately avoids the keywords "refine" / "improve" / "revision" / "iterate" outside the refine branch so the generate-mode prompt stays clean.
- Assistant text extraction concatenates all `content[]` blocks where `type === "text"` (same robustness as synthesis adapter). Strict `JSON.parse`; on failure → `CnsError("IO_ERROR", "Hook LLM returned non-JSON response")` (exact message required by AC7). Fetch rejection, non-2xx response, malformed envelope, and missing assistant text all surface as `CnsError("IO_ERROR", ...)`.
- Zod validation via `hookGenerationAdapterOutputSchema.safeParse(...)` imported from `src/agents/hook-agent.ts` (no schema drift). On failure → `CnsError("SCHEMA_INVALID", parsed.error.message)` — raw Zod message preserved, no wrapping.
- Tests in `tests/vault-io/hook-adapter-llm.test.ts` mock `fetch` via `vi.stubGlobal("fetch", ...)` with `vi.unstubAllGlobals()` in `afterEach`. All 7 AC9 cases covered: generate-mode happy (with full request + prompt assertions, including refute of refine language), refine-mode happy (with current_draft + refine language assertions), slot 1 vs slot 2 divergence (both directions: each prompt includes its own archetype keywords and excludes the other's), missing / whitespace-only API key, fetch rejection, non-JSON response (exact message), and schema-invalid JSON (`score: "10"` as string → `SCHEMA_INVALID`).
- Verify gate passed: `bash scripts/verify.sh` → **TAP: 22 (node:test), Vitest: 453, Total: 475** (468 baseline + 7 new). Lint, typecheck, and build all green.

### File List

- `src/agents/hook-adapter-llm.ts` (new)
- `tests/vault-io/hook-adapter-llm.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — added `18-3-hook-generation-adapter-real-claude-api-implementation` key)

### Change Log

- 2026-04-20: Implemented Story 18-3 LLM-backed hook generation adapter. Added `createLlmHookGenerationAdapter()` (one new production file) with generate/refine mode branching, four distinct slot archetypes, honest-scoring rubric, and error mapping matching Story 18-2. Added 7 Vitest cases with mocked `fetch` (one new test file). All 10 acceptance criteria satisfied. Verify gate green at 475 tests (22 TAP + 453 Vitest).
- 2026-04-22: BMAD code review closure. No patch items against the 18-3 implementation. Sprint status set to `done`. Note: current `hook-adapter-llm.ts` `MAX_TOKENS = 150` is an intentional Story 18-8 supersession of the original 18-3 `max_tokens: 1000` contract, not an 18-3 closure defect.

### Review Findings

_BMAD code review closure (2026-04-22). Focus: 18-3 acceptance criteria, adapter API request shape at the original 18-3 commit, prompt branching, slot divergence, strict JSON/Zod handling, mocked test coverage, and later Story 18-8 token-budget supersession. Verify: `npx vitest run --config vitest.config.ts tests/vault-io/hook-adapter-llm.test.ts` passed 12 tests; `bash scripts/verify.sh` passed 22 TAP + 506 Vitest, lint, typecheck, and build._

#### `decision-needed`

- [x] [Review][Decision] Current `src/agents/hook-adapter-llm.ts` sends `max_tokens: 150` while 18-3 AC2 says `1000` — **Resolved:** Verified original Story 18-3 commit `4307b52` used `MAX_TOKENS = 1000` and tests asserted `1000`. Later done Story 18-8 intentionally changed the hook adapter budget to `150` for production token budgeting. No 18-3 patch required.

#### `patch`

- [x] None.

#### `defer`

- [x] None.

#### `dismissed-as-noise`

- [x] None.
