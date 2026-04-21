# Story 18.5: End-to-End Chain Orchestrator and Integration Test

Status: done

Epic: 18 (LLM adapters + full chain wiring)

## Story

As a **research automation system**,
I want **a single `runChain()` orchestrator that wires Research → Synthesis → Hook → Boss with default LLM adapters**,
so that **we can validate the full end-to-end chain with deterministic integration tests and provide a live runner script for manual spot checks**.

## Context / Baseline

- Green baseline: **484 tests passing** (22 TAP + 462 Vitest) and `bash scripts/verify.sh` passes.
- Stories **18-2**, **18-3**, **18-4** implemented LLM adapters, but nothing wires the chain together yet.
- **Dev model for this story:** Claude Code terminal (Opus).

## Hard Constraints / Guardrails

- **Do not modify** any of these existing agent files:
  - `src/agents/research-agent.ts`
  - `src/agents/synthesis-agent.ts`
  - `src/agents/hook-agent.ts`
  - `src/agents/boss-agent.ts`
- **Do not modify** any of these existing adapter files:
  - `src/agents/synthesis-adapter-llm.ts`
  - `src/agents/hook-adapter-llm.ts`
  - `src/agents/boss-adapter-llm.ts`
- **Integration tests must not make live network calls** (no Firecrawl/Perplexity/Anthropic requests) and must use the fixture vault.
- Orchestrator behavior: **do not short-circuit** on `skipped` statuses; pass results through and let downstream agents decide (they already handle upstream-skipped inputs).

## Requirements (verbatim)

### New orchestrator module

Create `src/agents/run-chain.ts` that exports:

- `runChain(vaultRoot, brief, opts?)`
- `ChainRunResult` type:
  - `{
      sweep: ResearchSweepResult;
      synthesis: SynthesisRunResult;
      hooks: HookRunResult;
      weapons: BossRunResult;
    }`

The orchestrated sequence MUST be:

1. `runResearchAgent(vaultRoot, brief, opts.research)`
2. `runSynthesisAgent(vaultRoot, sweepResult, { adapters: { synthesis: opts.adapters?.synthesis ?? createLlmSynthesisAdapter() } })`
3. `runHookAgent(vaultRoot, synthesisResult, { adapters: { hookGeneration: opts.adapters?.hookGeneration ?? createLlmHookGenerationAdapter() } })`
4. `runBossAgent(vaultRoot, hookResult, { adapters: { weaponsCheck: opts.adapters?.weaponsCheck ?? createLlmWeaponsCheckAdapter() } })`

### Live runner script (not a test)

Create `scripts/run-chain.ts` that:

- Calls `runChain()`
- Uses **real** Firecrawl + Perplexity in the same style as `scripts/run-research-agent.ts`:
  - Replicate the `buildFirecrawlAdapter(...)` pattern (do **not** import it from `scripts/run-research-agent.ts`)
  - Replicate the `buildPerplexitySlot(...)` pattern
- Injects the LLM adapters via the existing factories:
  - `createLlmSynthesisAdapter()` (reads `ANTHROPIC_API_KEY`)
  - `createLlmHookGenerationAdapter()` (reads `ANTHROPIC_API_KEY`)
  - `createLlmWeaponsCheckAdapter()` (reads `ANTHROPIC_API_KEY`)
- Uses the “Creative Technologist” brief at **depth `"deep"`**:
  - topic: `"Creative Technologist remote roles and how to position for them in 2026"`
  - queries:
    - `"what do companies actually want when they hire a creative technologist"`
    - `"creative technologist remote job market 2026 salary expectations"`
    - `"how to position AI skills for creative director or creative technologist roles reddit"`
  - depth: `"deep"`
- Logs each stage result with clear headers (sweep / synthesis / hooks / weapons)
- Vault root from `CNS_VAULT_ROOT` env var; fallback to the standard WSL path

### Script fix

Update `scripts/run-research-agent.ts`:

- Change the brief’s `depth` from `"standard"` to `"deep"`.

### Integration tests (orchestration wiring only)

Create `tests/vault-io/run-chain.test.ts` with fully mocked adapters and fixture vault (no live calls, no real vault writes).

Must cover:

1. **Happy path**: all four agents succeed; returned `ChainRunResult` has status `"ok"` on all four.
2. **Synthesis skipped**: when the sweep yields “no source notes”, chain returns:
   - `synthesis.status === "skipped"`
   - and `hooks.status === "skipped"` and `weapons.status === "skipped"` propagate through.
3. **Adapter injection defaults**: when `opts.adapters` is not passed, confirm the real LLM adapter factories are used by default:
   - mock `createLlmSynthesisAdapter`, `createLlmHookGenerationAdapter`, `createLlmWeaponsCheckAdapter` and assert they are called.

Note: These tests do **not** validate individual agent behavior; they validate orchestration only (call order + correct result threading).

## Acceptance Criteria

### AC1. Orchestrator file exists and exports correct API

- **Given** the repository codebase
- **When** a consumer imports from `src/agents/run-chain.ts`
- **Then** `runChain()` and `ChainRunResult` are exported, and `ChainRunResult` contains exactly `{ sweep, synthesis, hooks, weapons }`.

### AC2. All four agents are invoked in strict sequence and results thread correctly

- **Given** `runChain(vaultRoot, brief, opts)` is executed
- **When** `runResearchAgent` returns a `ResearchSweepResult`
- **Then** `runSynthesisAgent` is called with `(vaultRoot, sweepResult, ...)`
- **And** `runHookAgent` is called with `(vaultRoot, synthesisResult, ...)`
- **And** `runBossAgent` is called with `(vaultRoot, hookResult, ...)`.

### AC3. Default LLM adapter injection

- **Given** `opts.adapters` is omitted
- **When** `runChain()` is called
- **Then** `createLlmSynthesisAdapter()`, `createLlmHookGenerationAdapter()`, and `createLlmWeaponsCheckAdapter()` are invoked to supply adapters.

### AC4. Skipped propagation is not short-circuited by the orchestrator

- **Given** a sweep result that causes downstream `runSynthesisAgent` to return `status: "skipped"`
- **When** `runChain()` is executed
- **Then** `runHookAgent` and `runBossAgent` are still called in order with the returned upstream results, and the final chain result reflects the downstream `skipped` statuses.

### AC5. `scripts/run-chain.ts` exists and runs the Creative Technologist brief at depth deep

- **Given** environment variables are set (`CNS_VAULT_ROOT`, `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`)
- **When** `tsx scripts/run-chain.ts` is executed
- **Then** it calls `runChain()` with the specified brief (depth `"deep"`) and logs stage headers and JSON summaries for each stage.

### AC6. `scripts/run-research-agent.ts` depth override corrected

- **Given** `scripts/run-research-agent.ts`
- **When** the brief is constructed
- **Then** `depth` is `"deep"` (not `"standard"`).

### AC7. Test + verify gate stays green

- `bash scripts/verify.sh` passes with **484+** tests.

## Tasks / Subtasks

- [x] Implement orchestrator `src/agents/run-chain.ts` (AC: 1–4)
  - [x] Define `ChainRunResult` type using the existing exported result types from each agent module (import the types; do not re-declare/guess fields)
  - [x] Implement `runChain(vaultRoot, brief, opts?)`
  - [x] Thread results exactly in order (research → synthesis → hooks → weapons)
  - [x] Adapter defaults: call `createLlm*` factories only when the corresponding adapter is not injected
  - [x] Ensure no special-casing for `skipped` (no short-circuit logic)

- [x] Add live runner `scripts/run-chain.ts` (AC: 5)
  - [x] Replicate `buildFirecrawlAdapter()` pattern from `scripts/run-research-agent.ts` (copy the implementation; do not import)
  - [x] Replicate `buildPerplexitySlot()` pattern from `scripts/run-research-agent.ts` (copy the implementation; do not import)
  - [x] Call `runChain()` with real adapters and the Creative Technologist brief at depth `"deep"`
  - [x] Console log stage headers + full JSON results
  - [x] Vault root: `CNS_VAULT_ROOT ?? "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"`

- [x] Fix depth in `scripts/run-research-agent.ts` (AC: 6)
  - [x] Change `depth: "standard"` to `depth: "deep"`

- [x] Add orchestration integration tests `tests/vault-io/run-chain.test.ts` (AC: 2–4, 7)
  - [x] Use the fixture vault root (same approach as other `tests/vault-io/*`)
  - [x] Fully mock adapters / agent boundaries to avoid live calls and real writes
  - [x] Test happy path, skipped propagation, and default adapter factory invocation

- [x] Verify gate (AC: 7)
  - [x] `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] Integration test uses fixture vault copy (not empty temp dir) [`tests/vault-io/run-chain.test.ts`:200]
- [x] [Review][Patch] Live runner stage headers include sweep / synthesis / hooks / weapons [`scripts/run-chain.ts`:144]

## Dev Notes / Implementation Guidance (read before coding)

### File creation / edit list (expected)

- **Add** `src/agents/run-chain.ts`
- **Add** `scripts/run-chain.ts`
- **Edit** `scripts/run-research-agent.ts` (depth override only)
- **Add** `tests/vault-io/run-chain.test.ts`

### Adapter injection shape (must match existing agents)

- `runSynthesisAgent(..., { adapters: { synthesis: ... } })`
- `runHookAgent(..., { adapters: { hookGeneration: ... } })`
- `runBossAgent(..., { adapters: { weaponsCheck: ... } })`

Do not invent new option names; use the existing agent option structures.

### Test strategy (wiring only)

- Focus assertions on:
  - Call order and arguments (result threading)
  - `ChainRunResult` structure and status propagation
  - Default adapter factories invoked when adapters not injected
- Avoid asserting on note content, file writes, or internal agent logic (already tested elsewhere).

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Claude Code terminal (Opus)

### Debug Log References

- `bash scripts/verify.sh` — VERIFY PASSED (489 tests: 22 TAP + 467 Vitest; baseline was 484 → +5 new orchestrator wiring tests)

### Completion Notes List

- Orchestrator `src/agents/run-chain.ts` threads `runResearchAgent → runSynthesisAgent → runHookAgent → runBossAgent` with nullish-coalesce adapter defaults (`createLlm*` factories only invoked when caller omits the corresponding adapter). No short-circuit on `skipped` — each stage passes its result through regardless of status, consistent with the downstream agents' existing skip-propagation handling.
- Integration tests in `tests/vault-io/run-chain.test.ts` use `vi.mock` on the four agent modules and the three LLM adapter factory modules. Uses `vi.importActual` + spread for the agent modules so type exports (schemas, etc.) remain available; factory modules are fully mocked since runtime-only concern. Fixture vault is a temp dir via `mkdtemp` (unused by mocked agents; kept for realism of `vaultRoot` path argument).
- Live runner `scripts/run-chain.ts` replicates (does not import) the Firecrawl `buildFirecrawlAdapter` and Perplexity `buildPerplexitySlot` patterns from `scripts/run-research-agent.ts` per the guardrail. Uses `createLlm*` factories directly for the three Anthropic-backed adapters. Logs stage headers and full JSON for sweep / synthesis / hooks / weapons.
- `scripts/run-research-agent.ts` depth changed from `"standard"` to `"deep"` (single-line edit, AC6).
- Operator guide: no update required (no user-facing surface change — wiring + script-level addition only).

### File List

- Added: `src/agents/run-chain.ts`
- Added: `scripts/run-chain.ts`
- Added: `tests/vault-io/run-chain.test.ts`
- Edited: `scripts/run-research-agent.ts` (depth `"standard"` → `"deep"`)

