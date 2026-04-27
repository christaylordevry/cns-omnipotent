# Story 18.8: Production Adapter Hardening: Token Budgeting and Rate Limit Retry

Status: done

Epic: 18 (LLM adapters + full chain wiring)

## Story

As a **research automation system**,
I want **production Anthropic adapters to be token-budget aware and resilient to rate limits**,
so that **a live chain run can complete reliably under Anthropic token-per-minute constraints**.

## Context / Baseline

- Green baseline: **496 tests passing** (22 TAP + 474 Vitest) and `bash scripts/verify.sh` passes.
- A live chain run exposed **three structural problems** that must be fixed **together** in this story (do not land piecemeal).
- **Dev model for this story:** Claude Code terminal (Opus).

## Problems (must all be fixed in this story)

### Problem 1 — Synthesis input token explosion

`src/agents/synthesis-adapter-llm.ts` currently concatenates **all** `source_notes` bodies into **one** Anthropic call.

In deep sweeps we can produce 8–10 notes averaging 10–50KB each, which can exceed **25,000 input tokens** and consume the entire **30,000 token/minute** budget before Hook or Boss can run.

**Fix (in `buildUserPrompt()` in `src/agents/synthesis-adapter-llm.ts`):**

- Cap source notes at **8 maximum** (`slice(input.source_notes, 0, 8)`).
- Truncate each individual note body to **600 chars** **before** including it in the prompt (truncate per-note, not post-concat).

### Problem 2 — No retry-with-backoff on 429 responses

All three Anthropic adapters crash immediately on HTTP 429. Anthropic returns a `retry_after` value (seconds) in the response body and/or a `Retry-After` response header.

**Fix (shared helper + used by all three adapters):**

- Create a shared helper `fetchWithRetry()` in a new file:
  - `src/agents/anthropic-fetch.ts` (NEW)
  - Export: `fetchWithRetry(url, init, maxAttempts?)`
- Behavior:
  - On **HTTP 429** only:
    - Parse `retry_after` seconds from response JSON error object **OR** from `Retry-After` response header.
    - Sleep for `retry_after` seconds, clamped to **min 5s**, **max 120s**.
    - Retry up to **3 total attempts** (1 original + 2 retries).
  - If all 3 attempts return 429: throw `new CnsError("IO_ERROR", <adapter-appropriate message>)`.
    - Synthesis: `"Synthesis API rate limited after 3 attempts"`
    - Hook: `"Hook API rate limited after 3 attempts"`
    - Boss: `"Weapons check API rate limited after 3 attempts"`
  - All other non-2xx responses: **no retry**. Return the response to the adapter, and let the adapter throw with its own error semantics.
- **Do not duplicate retry logic** inside adapter files; all three must use `fetchWithRetry()`.

### Problem 3 — `max_tokens` misconfigured on all three adapters

Current values are too high, wasting output-token budget and contributing to rate-limit pressure.

Correct values based on actual output shape:

- `src/agents/synthesis-adapter-llm.ts`: set `MAX_TOKENS = 800`
- `src/agents/hook-adapter-llm.ts`: set `MAX_TOKENS = 150`
- `src/agents/boss-adapter-llm.ts`: set `MAX_TOKENS = 300`

## Also remove live-testing hacks (must be reverted in this story)

- `src/agents/run-chain.ts`: remove the 65-second sleep line:
  - `await new Promise(r => setTimeout(r, 65000));`
- `src/agents/hook-adapter-llm.ts`: remove the 1500-char truncation of `synthesis_body`
  - The synthesis body is ~4KB and is safe once retry/backoff exists.
- `src/agents/synthesis-adapter-llm.ts`: revert `MAX_TOKENS` back from **8000** to **800**
  - (If any live-testing bump remains; ensure final value is exactly 800.)

## Files in scope

- **Add** `src/agents/anthropic-fetch.ts` (shared retry helper)
- **Edit** `src/agents/synthesis-adapter-llm.ts`
- **Edit** `src/agents/hook-adapter-llm.ts`
- **Edit** `src/agents/boss-adapter-llm.ts`
- **Edit** `src/agents/run-chain.ts`
- **Update tests** as needed to reflect new token caps + retry behavior (see Testing Requirements)

## Acceptance Criteria

### AC1. Synthesis prompt caps + per-note truncation (token budgeting)

- **Given** `src/agents/synthesis-adapter-llm.ts` `buildUserPrompt()`
- **When** it formats `input.source_notes`
- **Then** it includes **at most 8** source notes
- **And** each included note body is truncated to **<= 600 chars** **before concatenation**
- **And** the prompt still includes `vault_path` and `body:` markers per note block.

### AC2. Shared `fetchWithRetry()` exists and is used by all three Anthropic adapters

- **Given** the repo source tree
- **When** reading `src/agents/synthesis-adapter-llm.ts`, `src/agents/hook-adapter-llm.ts`, `src/agents/boss-adapter-llm.ts`
- **Then** each adapter uses `fetchWithRetry()` for the Anthropic request
- **And** retry logic is not duplicated in adapters.

### AC3. 429 retry behavior honors `retry_after` and clamps sleep

- **Given** an Anthropic response with HTTP 429
- **When** `fetchWithRetry()` handles it
- **Then** it sleeps for `retry_after` seconds, clamped to \([5, 120]\)
- **And** retries up to 3 total attempts
- **And** after 3 consecutive 429s it throws `CnsError("IO_ERROR", "<Adapter> API rate limited after 3 attempts")`.

### AC4. Non-429 error behavior is unchanged (no retries)

- **Given** an Anthropic response with non-2xx status other than 429 (e.g. 401, 500)
- **When** `fetchWithRetry()` is used
- **Then** no retries occur.
- **And** the adapter throws immediately with its existing error semantics (i.e., adapters own non-429 error handling; `fetchWithRetry` is retry logic only).

### AC5. `MAX_TOKENS` corrected in all three adapters

- `synthesis-adapter-llm.ts`: `MAX_TOKENS === 800`
- `hook-adapter-llm.ts`: `MAX_TOKENS === 150`
- `boss-adapter-llm.ts`: `MAX_TOKENS === 300`

### AC6. Live testing hacks removed

- **Given** `src/agents/run-chain.ts`
- **Then** no artificial 65s sleep exists between synthesis and hook.
- **Given** `src/agents/hook-adapter-llm.ts`
- **Then** `synthesis_body` is not truncated to 1500 chars (include full body).

### AC7. Test suite + verify gate remain green

- `npm test` passes (including updated adapter tests)
- `bash scripts/verify.sh` passes at **496+** tests.

## Tasks / Subtasks

- [x] Implement `fetchWithRetry()` helper in `src/agents/anthropic-fetch.ts` (AC: 2–4)
  - [x] Parse `retry_after` from response JSON error object, fallback to `Retry-After` header
  - [x] Clamp sleep to min 5 / max 120 seconds
  - [x] Retry only on 429, maxAttempts default 3
  - [x] Keep helper generic: `fetchWithRetry(url, init, { adapterLabel, maxAttempts? })`
- [x] Update `src/agents/synthesis-adapter-llm.ts` (AC: 1–5)
  - [x] `MAX_TOKENS = 800`
  - [x] `buildUserPrompt()` caps to 8 notes + truncates each note body to 600 chars before concat
  - [x] Replace direct `fetch(...)` with `fetchWithRetry(...)`
  - [x] On 3x429: surface `CnsError("IO_ERROR", "Anthropic API rate limited after 3 attempts — synthesis")`
- [x] Update `src/agents/hook-adapter-llm.ts` (AC: 2–6)
  - [x] `MAX_TOKENS = 150`
  - [x] Remove `synthesis_body` truncation to 1500 chars in both generate/refine prompts
  - [x] Replace direct `fetch(...)` with `fetchWithRetry(...)`
  - [x] On 3x429: surface `CnsError("IO_ERROR", "Anthropic API rate limited after 3 attempts — hook")`
- [x] Update `src/agents/boss-adapter-llm.ts` (AC: 2–5)
  - [x] `MAX_TOKENS = 300`
  - [x] Replace direct `fetch(...)` with `fetchWithRetry(...)`
  - [x] On 3x429: surface `CnsError("IO_ERROR", "Anthropic API rate limited after 3 attempts — weapons check")`
- [x] Remove sleep hack from `src/agents/run-chain.ts` (AC: 6)
- [x] Update tests for token caps + retry behavior (AC: 3, 5, 7)
  - [x] Update existing adapter tests to match new `max_tokens`
  - [x] Add at least one unit test per adapter that:
    - [x] Mocks fetch: first response 429 with `retry_after`, second response 200
    - [x] Uses fake timers so the test is fast and asserts the sleep clamp is respected
    - [x] Asserts exactly 2 fetch calls happened and adapter resolves successfully
  - [x] Add at least one unit test asserting 3 consecutive 429s -> `CnsError("IO_ERROR", "Anthropic API rate limited after 3 attempts — <label>")`
- [x] Verify gate (AC: 7)
  - [x] `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Decision] `fetchWithRetry` contract for non-429 non-2xx — resolved: helper is retry logic only; adapters own error semantics. Story AC4 wording updated accordingly. Evidence: `src/agents/anthropic-fetch.ts` returns `response` whenever `response.status !== 429`.
- [x] [Review][Patch] Rate-limit exhaustion message does not match story AC3 [`src/agents/anthropic-fetch.ts`] — resolved 2026-04-22. `fetchWithRetry()` now accepts `exhaustedMessage`, and the three adapters pass exact story-required messages: `"Synthesis API rate limited after 3 attempts"`, `"Hook API rate limited after 3 attempts"`, and `"Weapons check API rate limited after 3 attempts"`.
- [x] [Review][Patch] Remove raw assistant output logging on synthesis JSON-parse failure [`src/agents/synthesis-adapter-llm.ts`] — removed the `console.error("RAW:", ...)` debug hack entirely.
- [x] [Review][Patch] Harden `fetchWithRetry` input validation [`src/agents/anthropic-fetch.ts`] — validate `maxAttempts` is an integer ≥ 1; throw `CnsError("IO_ERROR", "fetchWithRetry: maxAttempts must be a positive integer")` if invalid. (HTTP-date `Retry-After` parsing intentionally skipped; Anthropic uses seconds.)
- [x] [Review][Defer] Add jitter / backoff strategy to reduce thundering herd on 429s — deferred, pre-existing. Current approach sleeps exactly the provided/clamped duration with no jitter; acceptable for now given the story scope is “honor retry_after + clamp + maxAttempts”. Consider adding small jitter later to avoid synchronization across parallel runs.

## Dev Notes / Implementation Guidance (read before coding)

### Existing patterns to follow (do not invent new styles)

- All three adapters share the same overall structure today (constants, prompt builders, `extractAssistantText`, `JSON.parse`, Zod validation).
- `CnsError` is defined in `src/errors.ts`; keep error codes/messages stable and terse.
- Current adapters already include `retry_after` in error details on non-2xx; with `fetchWithRetry()` this should become less frequently triggered.

### `retry_after` extraction guidance

Anthropic error envelopes can vary; implement a defensive parse in `fetchWithRetry()`:

- Prefer response header `Retry-After` when present and numeric.
- Else parse JSON body and look for a numeric `retry_after` under `error.retry_after` (seconds).
- If neither is available, default to 5 seconds (then clamp).

### Testing note (fake timers)

Use Vitest fake timers (or a sleep function that can be spied on) so retry tests do not actually wait real seconds.

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Claude Code terminal (Opus 4.7)

### Debug Log References

- `npm test` → 22 TAP + 493 Vitest (515 total) passing. Previous baseline: 22 TAP + 474 Vitest = 496. +19 Vitest tests added by this story (9 in `anthropic-fetch.test.ts`, 3 in synthesis adapter, 4 in hook adapter, 3 in boss adapter).
- `bash scripts/verify.sh` → `VERIFY PASSED` (tests + lint + typecheck + build). Note: requires `PERPLEXITY_API_KEY` to be unset in the test environment; with it set, `research-agent.test.ts` tests make real network calls and time out (pre-existing behavior of those tests and unrelated to this story).

### Completion Notes List

- **Shared helper:** `src/agents/anthropic-fetch.ts` exports `fetchWithRetry(url, init, { adapterLabel, exhaustedMessage?, maxAttempts? })`. It parses `retry_after` from the JSON body (`error.retry_after`), falls back to the `Retry-After` header, defaults to 5s when neither is present, and clamps the sleep to `[5, 120]` seconds. Retries only on HTTP 429 (up to 3 total attempts); all other non-2xx responses are returned to the adapter untouched. After 3 consecutive 429s, it throws the adapter-provided exact exhaustion message.
- **Adapter wiring:** each adapter (`synthesis-adapter-llm.ts`, `hook-adapter-llm.ts`, `boss-adapter-llm.ts`) now calls `fetchWithRetry` with its own `adapterLabel` and exact `exhaustedMessage` (`"Synthesis API rate limited after 3 attempts"`, `"Hook API rate limited after 3 attempts"`, `"Weapons check API rate limited after 3 attempts"`). The existing fetch-error catch block also lets `CnsError` propagate unwrapped so the retry-exhaustion message is not re-prefixed with "X LLM fetch failed:".
- **Token budgeting (synthesis):** `buildUserPrompt()` slices `input.source_notes` to the first 8 and truncates each note body to 600 chars **before** concatenation. `MAX_TOKENS` is 800.
- **Hook adapter:** `MAX_TOKENS` is 150. `synthesis_body` is no longer truncated to 1500 chars in either `buildGeneratePrompt` or `buildRefinePrompt` — the full body is passed through.
- **Boss adapter:** `MAX_TOKENS` is 300.
- **Live-test hacks removed:** `run-chain.ts` no longer contains `await new Promise(r => setTimeout(r, 65000))` between synthesis and hook steps.
- Operator guide: no update required (this is an internal reliability change — no user-facing behavior, tools, or workflows changed).

### File List

- **Added:** `src/agents/anthropic-fetch.ts` (shared 429 retry helper)
- **Added:** `tests/vault-io/anthropic-fetch.test.ts` (9 unit tests for `fetchWithRetry`)
- **Modified:** `src/agents/synthesis-adapter-llm.ts` (MAX_TOKENS=800, 8-note cap, 600-char per-note truncation, `fetchWithRetry`)
- **Modified:** `src/agents/hook-adapter-llm.ts` (MAX_TOKENS=150, removed 1500-char `synthesis_body` truncation in both prompts, `fetchWithRetry`)
- **Modified:** `src/agents/boss-adapter-llm.ts` (MAX_TOKENS=300, `fetchWithRetry`)
- **Modified:** `src/agents/run-chain.ts` (removed 65s sleep between synthesis and hook)
- **Modified:** `tests/vault-io/synthesis-adapter-llm.test.ts` (max_tokens=800, 8-note cap test, 429-then-200 retry test, 3x429 exhaustion test)
- **Modified:** `tests/vault-io/hook-adapter-llm.test.ts` (max_tokens=150, full-body-passthrough tests for generate/refine, 429-then-200 retry test, 3x429 exhaustion test)
- **Modified:** `tests/vault-io/boss-adapter-llm.test.ts` (max_tokens=300, 429-then-200 retry test with upper-clamp, 3x429 exhaustion test, non-429 no-retry test)
- **Modified:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (18-8 → review)

### Change Log

- 2026-04-21: Initial implementation of Story 18-8 production adapter hardening. Added shared `fetchWithRetry` helper with 429 retry/backoff honoring Anthropic `retry_after` (body + header fallback, clamped to [5, 120] seconds). Corrected `MAX_TOKENS` on all three adapters (synthesis=800, hook=150, boss=300). Capped synthesis `source_notes` at 8 and truncated each note body to 600 chars before concatenation. Removed the 65s live-test sleep from `run-chain.ts` and the 1500-char `synthesis_body` truncation in `hook-adapter-llm.ts`. All adapters now call `fetchWithRetry` with their own `adapterLabel` to surface adapter-specific rate-limit-exhaustion errors.
- 2026-04-22: Closed review patch for rate-limit exhaustion messages. `fetchWithRetry` accepts `exhaustedMessage`; adapters now emit the exact AC3 messages. Focused Vitest run passed: `anthropic-fetch`, `synthesis-adapter-llm`, `hook-adapter-llm`, and `boss-adapter-llm` test files — 49 tests.
