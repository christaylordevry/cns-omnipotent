# Story 18.4: Weapons Check Adapter: Real Claude API Implementation

Status: done

Epic: 18 (Research quality + Perplexity carry)

## Story

As a **research automation system**,
I want **a real LLM-backed `WeaponsCheckAdapter` that scores and rewrites hooks via the Anthropic Messages API in a single call**,
so that **the Boss Agent can run its novelty + copy-intensity weapons gate without failing with `UNSUPPORTED`**.

## Context / Baseline

- Green baseline: **476 tests passing** (22 TAP + 454 Vitest) and `bash scripts/verify.sh` passes.
- Current behavior: `createDefaultWeaponsCheckAdapter()` throws `new CnsError("UNSUPPORTED", ...)` in `src/agents/boss-agent.ts`.
- This story implements the real adapter as a new file only; wiring/injection into runtime is handled elsewhere.
- **Dev model for this story:** Claude Code terminal (Opus).

## Requirements (verbatim contracts)

### Adapter interface + types (from `src/agents/boss-agent.ts`)

The implementation MUST import these from `src/agents/boss-agent.ts` (do not re-declare or guess fields):

- `WeaponsCheckAdapter`
- `WeaponsCheckAdapterInput`
- `WeaponsCheckAdapterOutput`
- `weaponsCheckAdapterOutputSchema`
- `WEAPONS_RUBRIC`

Reminder (do not copy/paste a guessed variant): the adapter contract is:

- `type WeaponsCheckAdapter = { scoreAndRewrite(input: WeaponsCheckAdapterInput): Promise<WeaponsCheckAdapterOutput>; }`

### Critical constraint: WEAPONS_RUBRIC injection (hard requirement)

`WEAPONS_RUBRIC` (exported const in `src/agents/boss-agent.ts`) MUST be injected **VERBATIM** into the **system prompt**.

- Do not paraphrase it.
- Do not summarize it.
- Do not “reformat” it.
- Do not inline a copy; import it and embed as-is.

This is snapshot-tested elsewhere and any drift will fail tests.

### Gate logic placement (hard requirement)

The strict gate logic is owned by `boss-agent.ts`, not the adapter:

- gate condition is **strict integer equality**: `novelty === 10 && copy_intensity === 10`
- the adapter MUST NOT implement iteration loops or gate retries
- the adapter MUST do **score + rewrite in a single call**

## Implementation Scope (hard constraint)

- Add **one new production file only**:
  - `src/agents/boss-adapter-llm.ts`
- No other production code changes in this story.
- No new tests in this story (baseline suite must still pass).

## Acceptance Criteria

### AC1. New adapter file exists + exports

- **Given** the repository codebase
- **When** a consumer imports from `src/agents/boss-adapter-llm.ts`
- **Then** the file exists and exports `createLlmWeaponsCheckAdapter(): WeaponsCheckAdapter`.

### AC2. Calls Anthropic Messages API with required parameters

- **Given** a call to `adapter.scoreAndRewrite(input)`
- **When** `process.env.ANTHROPIC_API_KEY` is present (non-empty after trim)
- **Then** the adapter calls `fetch("https://api.anthropic.com/v1/messages", ...)` with:
  - `method: "POST"`
  - `model: "claude-sonnet-4-6"`
  - `max_tokens: 1500`
  - `system` prompt matching AC3
  - `messages` containing exactly one `"user"` turn matching AC4
  - Headers:
    - `x-api-key` read **at call time** from `process.env.ANTHROPIC_API_KEY` (not passed as a param, not hardcoded)
    - `anthropic-version: "2023-06-01"` (match existing adapter convention)
    - `content-type: "application/json"`

### AC3. System prompt includes role, JSON-only constraint, and WEAPONS_RUBRIC verbatim

System prompt MUST:

- Establish the model role as a **weapons-check judge and rewrite engine** for hooks (marketing/creative copy context).
- Require: **respond only with a JSON object** (no markdown fences, no preamble, no trailing text).
- Include the rubric **verbatim** by embedding `${WEAPONS_RUBRIC}` (imported from `boss-agent.ts`) as part of the system prompt text.

### AC4. User prompt is deterministic and includes all adapter inputs

The user message content MUST:

- Include every field from `WeaponsCheckAdapterInput` in a deterministic structure, including:
  - `topic`
  - `synthesis_insight_path`
  - `hook_set_note_path`
  - `hook_slot`
  - `iteration`
  - `current_hook`
- Clearly instruct the model to:
  - score the **current hook** on both rubric dimensions (integers 1–10)
  - rewrite the hook to improve scores (even if already strong)
  - return a JSON object with keys matching the adapter output schema:
    - `revised_hook`
    - `scores` with keys: `novelty`, `copy_intensity`, `rationale`
- Explicitly require novelty and copy intensity to be **integers** (not floats, not strings).

### AC5. Output parsing + Zod validation before returning

- **Given** a 200 response from Anthropic
- **When** the adapter extracts assistant content text from the Anthropic response
- **Then** it MUST:
  - concatenate all `content[]` blocks where `type === "text"` in order (robust to multiple text blocks)
  - `JSON.parse(...)` the resulting assistant text strictly (no code-fence stripping fallback)
  - validate the parsed object via `weaponsCheckAdapterOutputSchema.safeParse(...)` imported from `src/agents/boss-agent.ts`
  - return the validated `WeaponsCheckAdapterOutput` object.

### AC6. Error handling uses `CnsError` and matches existing adapter conventions

Mirror error-mapping conventions used by the other LLM adapters (e.g. synthesis / hook adapters).

- **Missing / blank API key** (including whitespace-only) → throw `new CnsError("IO_ERROR", ...)`
- **Fetch rejects** → `CnsError("IO_ERROR", ...)`
- **Non-2xx response** → `CnsError("IO_ERROR", ...)` (include safe details: HTTP status; optional short response text snippet; do not include prompt inputs like synthesis body)
- **Malformed Anthropic envelope** (no assistant text content) → `CnsError("IO_ERROR", ...)`
- **Non-JSON assistant text** → `CnsError("IO_ERROR", "Weapons check LLM returned non-JSON response")` (exact message)
- **JSON parses but fails Zod validation** → `CnsError("SCHEMA_INVALID", <zod-error-message>)`
  - Must preserve Zod `error.message` (no wrapping that loses it)

### AC7. Verify gate stays green

- `bash scripts/verify.sh` passes with **476+ tests**.

## Tasks / Subtasks

- [x] Implement `createLlmWeaponsCheckAdapter()` (AC: 1–6)
  - [x] Create `src/agents/boss-adapter-llm.ts`
  - [x] Export `createLlmWeaponsCheckAdapter(): WeaponsCheckAdapter`
  - [x] Read API key from `process.env.ANTHROPIC_API_KEY` inside `scoreAndRewrite(...)` (trim and validate non-empty)
  - [x] Build system prompt with verbatim `WEAPONS_RUBRIC` injection
  - [x] Build a deterministic single-turn user prompt containing all input fields
  - [x] Call Anthropic Messages API with correct model, headers, and `max_tokens`
  - [x] Extract assistant text from Anthropic envelope (concatenate all text blocks)
  - [x] Strict `JSON.parse`; enforce exact IO_ERROR message on parse failure
  - [x] Validate with `weaponsCheckAdapterOutputSchema.safeParse(...)`; on failure throw `SCHEMA_INVALID` with Zod error message
  - [x] On any fetch / response / envelope issue -> `IO_ERROR`

- [x] Run verify gate (AC: 7)
  - [x] `bash scripts/verify.sh`

## Dev Notes / Guardrails (read before coding)

### Where the contract lives

- `WEAPONS_RUBRIC`, `WeaponsCheckAdapterInput`, output schema, and gate semantics are in:
  - `src/agents/boss-agent.ts`

### Prompt construction guardrails

- **Rubric injection is non-negotiable**: import `WEAPONS_RUBRIC` and embed it verbatim in `system`.
- Output must be **pure JSON**; do not allow markdown fences or extra text.
- The adapter should not “helpfully” iterate until it gets 10/10; the Boss Agent owns iteration.

### Safety / logging

- Do not log the full prompt content or hook bodies.
- If including response text snippets in error messages, keep them short and avoid echoing sensitive/large content.

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.
  - Operator guide: no update required. This story adds an internal LLM adapter file; no new tool, workflow, constraint, panel, or integration surfaces to operators. Wiring into runtime is deferred to a later story.

## Dev Agent Record

### Agent Model Used

Claude Code terminal (Opus)

### Debug Log References

- `bash scripts/verify.sh` (run after implementation)

### Completion Notes List

- Implemented `createLlmWeaponsCheckAdapter()` in the single new production file `src/agents/boss-adapter-llm.ts`. `src/agents/boss-agent.ts` and `createDefaultWeaponsCheckAdapter()` were not touched — wiring is deferred.
- Mirrors `src/agents/synthesis-adapter-llm.ts` and `src/agents/hook-adapter-llm.ts` conventions: Anthropic Messages endpoint + version, `x-api-key` + `anthropic-version: 2023-06-01` + `content-type: application/json` headers, `model: "claude-sonnet-4-6"`, `max_tokens: 1500`, single `user`-role message.
- API key handling: read `process.env.ANTHROPIC_API_KEY` inside `scoreAndRewrite(...)` at call time, `.trim()`, treat empty/whitespace as missing → `CnsError("IO_ERROR", ...)`. Never accepted via params, never hardcoded.
- **WEAPONS_RUBRIC injection (hard requirement):** imported `WEAPONS_RUBRIC` from `src/agents/boss-agent.ts` and embedded it verbatim via template literal in the `SYSTEM_PROMPT` array. No paraphrase, no reformat, no inline copy. Drift-guarded by a test that asserts `WEAPONS_RUBRIC` appears inside the **serialized request body** sent to the API (`JSON.stringify(WEAPONS_RUBRIC).slice(1, -1)` against `init.body`), not just against the in-memory system prompt string.
- Single-call contract (AC requirement): adapter does `score + rewrite` in one Anthropic call; no adapter-level iteration. Happy-path test asserts `fetch` is called exactly once.
- System prompt: role as weapons-check judge and rewrite engine; rubric injected verbatim; JSON-only output with exact keys `revised_hook` + `scores: {novelty, copy_intensity, rationale}`; reminders that `novelty` and `copy_intensity` must be integers.
- User prompt includes every `WeaponsCheckAdapterInput` field in a deterministic order (`topic`, `synthesis_insight_path`, `hook_set_note_path`, `hook_slot`, `iteration`, `current_hook`) with the current hook in a delimited `<<<HOOK>>>` block. Explicit task list (score + rewrite + rationale) and a JSON-shape instruction mirroring the output schema.
- Assistant text extraction concatenates all `content[]` blocks where `type === "text"` (robust to multi-block responses). Strict `JSON.parse`; on failure → `CnsError("IO_ERROR", "Weapons check LLM returned non-JSON response")` (exact message per AC6). Fetch rejection, non-2xx, malformed envelope, and missing assistant text all surface as `CnsError("IO_ERROR", ...)`.
- Zod validation via `weaponsCheckAdapterOutputSchema.safeParse(...)` imported from `src/agents/boss-agent.ts` (no schema drift). On failure → `CnsError("SCHEMA_INVALID", parsed.error.message)` — raw Zod message preserved.
- Tests in `tests/vault-io/boss-adapter-llm.test.ts` mock `fetch` via `vi.stubGlobal("fetch", ...)` with `vi.unstubAllGlobals()` cleanup. 8 cases cover: happy path with full request-shape assertions (URL, method, headers, model, `max_tokens: 1500`, single-call guarantee), WEAPONS_RUBRIC verbatim injection assertion against the serialized request body, user-prompt field + schema-key coverage, missing/whitespace API key, fetch rejection, non-2xx with HTTP status in message, non-JSON response with exact message, and schema-invalid (`novelty: "10"` as string) → `SCHEMA_INVALID`.
- Verify gate passed: `bash scripts/verify.sh` → **TAP: 22 (node:test), Vitest: 462, Total: 484** (476 baseline + 8 new). Lint, typecheck, and build all green.
- Standing task — operator guide: no update required (internal adapter file; no user-facing surface changes).

### File List

- `src/agents/boss-adapter-llm.ts` (new)
- `tests/vault-io/boss-adapter-llm.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — `18-4` key flipped to `in-progress` then `review`)

### Change Log

- 2026-04-20: Implemented Story 18-4 LLM-backed weapons-check adapter. Added `createLlmWeaponsCheckAdapter()` with single-call score-and-rewrite, verbatim `WEAPONS_RUBRIC` injection (drift-guarded against the serialized request body), and error mapping consistent with Stories 18-2 and 18-3. Added 8 Vitest cases with mocked `fetch`. All 7 acceptance criteria satisfied. Verify gate green at 484 tests (22 TAP + 462 Vitest).

