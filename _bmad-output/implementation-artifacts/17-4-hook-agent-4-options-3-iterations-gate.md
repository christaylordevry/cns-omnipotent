# Story 17.4: Hook Agent — four options, three iterations minimum, 10/10 gate

Status: done

Epic: 17 (Agency first product: content research agent chain)

## Story

As a **content strategist (operator)**,
I want **a Hook Agent that consumes a `SynthesisRunResult`, reads the synthesis InsightNote,
generates four hook candidates with at least three refinement iterations each, and only accepts
a candidate once a 10/10 quality gate is met**,
so that **downstream copy and CTA work starts from sharp, governed hook options stored as a
single `HookSetNote` — with the same adapter-injection and ingest-pipeline discipline as
Research and Synthesis**.

## References

- Synthesis output contract (prerequisite, done): `src/agents/synthesis-agent.ts` — `SynthesisRunResult`, `runSynthesisAgent`
- Ingest pipeline: `src/ingest/pipeline.ts` — `runIngestPipeline()`
- PAKE / ingest typing: `src/pake/schemas.ts`, `src/ingest/classify.ts`
- Pattern reference: `_bmad-output/implementation-artifacts/17-3-synthesis-agent-patterns-gaps-opportunities.md`, `17-2-research-agent-firecrawl-apify-sweep.md`

## Acceptance Criteria

1. **Input validation (AC: input-validation)**  
   **Given** a candidate `SynthesisRunResult` (unknown)  
   **When** `runHookAgent(vaultRoot, synthesisResult, opts)` is called  
   **Then** the agent validates input with `synthesisRunResultSchema.safeParse()`  
   **And** on failure returns `CnsError("SCHEMA_INVALID", …)` before vault reads or adapter calls.

2. **Synthesis skipped short-circuit (AC: synthesis-skipped)**  
   **Given** a valid result with `status: "skipped"`  
   **When** the agent runs  
   **Then** it returns `HookRunResult` with `status: "skipped"` and a traceable reason tied to synthesis  
   **And** emits exactly one `appendRecord` with `action: "hook_skipped"` (no `HookSetNote` written).

3. **Read synthesis note via injected adapter (AC: vault-read)**  
   **Given** `status: "ok"` with `insight_note.vault_path`  
   **When** the agent runs  
   **Then** it reads that path via injected `VaultReadAdapter.readNote()` (same contract as 17-3)  
   **And** if the read throws or fails, the agent does not call the hook adapter — it skips with `hook_skipped` and a read-failure reason (or returns a typed skip result per implementation notes).

4. **Four hooks × min 3 iterations × 10/10 gate (AC: hooks-gate)**  
   **Given** a readable synthesis note body  
   **When** the agent runs  
   **Then** for each hook slot `1..4` it calls an injected `HookGenerationAdapter` at least **three** times per slot  
   **And** iteration continues until the adapter returns `score >= 10` (after the third iteration) or until a documented max iteration bound is exceeded (then fail closed with `CnsError`, not a partial vault write).

5. **HookSetNote via ingest pipeline (AC: hook-set-note)**  
   **Given** all four slots pass the gate  
   **When** the agent writes output  
   **Then** it calls `runIngestPipeline()` with `source_type: "text"`, `ingest_as: "HookSetNote"`, structured markdown listing four final hooks plus a compact per-slot iteration trace  
   **And** tags include a topic hint, `"hook-set"`, and `"research-sweep"`.

6. **Audit trail (AC: audit)**  
   **Given** a completed hook run (success or skip)  
   **Then** exactly one sweep-level `appendRecord` beyond pipeline ingest audit:  
   - success → `action: "hook_run"` with payload referencing `hook_set_note` path / `pake_id`  
   - skip → `action: "hook_skipped"` with payload explaining why

7. **Adapter injection (AC: adapters)**  
   **Given** defaults mirror 17-2 / 17-3  
   **When** callers omit adapters  
   **Then** `createDefaultVaultReadAdapter(vaultRoot)` is used for reads  
   **And** `createDefaultHookGenerationAdapter()` throws `CnsError("UNSUPPORTED", …)` so production must inject LLM behaviour.

8. **Tests (AC: tests)**  
   **Given** hook generation is external  
   **When** tests run  
   **Then** `HookGenerationAdapter` is always mocked (no live LLM)  
   **And** tests cover: invalid synthesis JSON, synthesis skipped, read failure, happy path (4× gate with scores reaching 10 on iteration ≥3), gate timeout / fail when score never reaches 10, malformed adapter output, audit lines  
   **And** `bash scripts/verify.sh` passes before the story is marked **review**.

## Tasks / Subtasks

- [x] Add `HookSetNote` to PAKE literals, `destinationDirectoryForCreate`, and pipeline `ingest_as` typing
- [x] Add `src/agents/hook-agent.ts` — Zod for `SynthesisRunResult`, types, defaults, `runHookAgent`
- [x] Render HookSet markdown (four options + trace + wikilink to synthesis insight)
- [x] Emit `hook_run` / `hook_skipped` audit records
- [x] Add `tests/vault-io/hook-agent.test.ts` (mock hook adapter only)
- [x] Run `bash scripts/verify.sh` and mark story **review** + sprint `17-4` → `review`

## Dev Agent Record

### Agent Model Used

Composer (agent router)

### Debug Log References

- Initial hook-agent audit assertions expected JSON-shaped log lines; aligned with pipe-delimited `formatAuditLine` (`| hook_skipped |`, `| hook_run |`) per `audit-logger.ts`.

### Completion Notes List

- Introduced PAKE `HookSetNote` (`schemas.ts`), routed to `03-Resources` with other resource notes, extended `ingest_as` / `resolvePakeType` for pipeline text ingest.
- `runHookAgent` validates unknown input with `synthesisRunResultSchema`, reuses `createDefaultVaultReadAdapter` from `synthesis-agent.ts`, requires injected `HookGenerationAdapter` (default throws `UNSUPPORTED`).
- Per-slot loop: minimum `MIN_HOOK_ITERATIONS` (3), exit when `score >= 10`, hard cap `MAX_HOOK_ITERATIONS` (20) then `CnsError("IO_ERROR", …)` — no partial vault write on gate failure.
- Success path writes one `HookSetNote` via `runIngestPipeline` and emits `hook_run`; skip paths emit `hook_skipped` only (synthesis skipped or synthesis read failure).
- `bash scripts/verify.sh` green: **409** Vitest tests (9 new hook-agent + 1 resolvePakeType + 1 ingest HookSetNote + vault-create-note routing loop).

### File List

- `src/agents/hook-agent.ts` (new)
- `src/pake/schemas.ts` (modified — `HookSetNote` in `PAKE_TYPE_VALUES`)
- `src/tools/vault-create-note.ts` (modified — `HookSetNote` routing)
- `src/ingest/classify.ts` (modified — `ingest_as` / `resolvePakeType` for `HookSetNote`)
- `tests/vault-io/hook-agent.test.ts` (new)
- `tests/vault-io/ingest-pipeline.test.ts` (modified)
- `tests/vault-io/vault-create-note.test.ts` (modified)
- `_bmad-output/implementation-artifacts/17-4-hook-agent-4-options-3-iterations-gate.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-18 | Story file created (in-progress) |
| 2026-04-18 | Implementation complete — HookSetNote + hook agent + tests; verify green; status → review |

---

## Developer Context — Implementation Guide

### Contracts

- **Input:** `SynthesisRunResult` (validate unknown with `synthesisRunResultSchema` co-located in `hook-agent.ts` or imported schema if added to synthesis module — prefer single Zod source in `hook-agent.ts` to avoid circular imports).
- **Hook adapter:** One method that accepts slot, iteration index (1-based), current draft string (empty on first iteration), and synthesis text context; returns `{ hook_text: string; score: number }` with `score` integer 1–10, validated with Zod.
- **Gate loop per slot:** `MIN_ITERATIONS = 3`, `MAX_ITERATIONS` reasonable (e.g. 20). Exit when `iteration >= 3 && score >= 10`.
- **Writes:** Only `runIngestPipeline()` for the vault note; sweep audit via `appendRecord`.

### Skip read-failure behaviour

On `VaultReadAdapter.readNote` failure for the synthesis path: emit `hook_skipped` with `payloadInput` including `reason: "synthesis-read-failed"` (or equivalent) and return `HookRunResult` skipped — do not throw unless schema/contract violation.

### Review Findings

BMAD code review (2026-04-18). Review layers: Blind Hunter, Edge Case Hunter, and Acceptance Auditor were executed in-session (subagents unavailable). Diff: modified tracked files plus full read of untracked `src/agents/hook-agent.ts` and `tests/vault-io/hook-agent.test.ts`.

**Triage:** 0 `decision-needed`, 0 `patch`, 0 `defer` after triage; 4 findings dismissed as noise or informational only.

Dismissed / informational (not persisted as action items):

- **Score `=== 10` vs `>= 10`:** Gate uses `parsed.data.score >= 10` after `iteration >= MIN_HOOK_ITERATIONS`. Adapter output is `z.number().int().min(1).max(10)`, so any accepted value with `score >= 10` is exactly `10`. The `>=` form matches AC wording and is equivalent for valid adapter output.
- **Parallel `synthesisRunResultSchema`:** Intentional per story (avoid circular imports with synthesis-agent); not classified as a defect.
- **Blind Hunter:** No security-sensitive patterns in the reviewed surface beyond existing ingest/audit patterns.
- **Edge Case Hunter:** Gate failure before `runIngestPipeline` leaves no partial `HookSetNote` (options built in memory, ingest only after all four slots succeed). Malformed adapter output throws `SCHEMA_INVALID` before ingest.

#### Focus verification (Acceptance Auditor)

| Focus | Verdict | Evidence |
| --- | --- | --- |
| Gated loop min 3, max 20, `IO_ERROR` on cap | Pass | `runOneHookSlot`: `for` 1..`MAX_HOOK_ITERATIONS` (20); exit only when `iteration >= MIN_HOOK_ITERATIONS` (3) and `score >= 10`; exhaustion throws `CnsError("IO_ERROR", …)` with last score. Tests assert `MIN_HOOK_ITERATIONS` floor, `MAX_HOOK_ITERATIONS` call count on stall, and `IO_ERROR` when score stays 9. |
| HookSetNote PAKE routing | Pass | `PAKE_TYPE_VALUES` includes `HookSetNote`; `resolvePakeType` accepts `ingest_as: "HookSetNote"`; `destinationDirectoryForCreate` routes `HookSetNote` to `03-Resources` (with `InsightNote` / `SourceNote`); `runIngestPipeline` resolves `pakeType` and passes to `vaultCreateNote`. Ingest and hook-agent tests assert `pake_type: HookSetNote` in written notes. |
| Score gate boundaries | Pass | Early high scores on iterations 1–2 do not exit (`iteration >= 3` required). Integer 1–10 enforced by Zod. |
| Adapter injection completeness | Pass | `vaultRead` defaults to `createDefaultVaultReadAdapter(vaultRoot)`; `hookGeneration` defaults to `createDefaultHookGenerationAdapter()` whose `generateOrRefine` rejects with `UNSUPPORTED`. Matches AC7 and mirrors the synthesis read pattern. |
