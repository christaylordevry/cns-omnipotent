---
baseline_commit: 9a968db
branch: hermes-consolidation
depends_on:
  - 79-3-recall-policy-config-recall-inject
  - 79-6-chunked-brain-index-chunk-aware-recall
  - 82-3-voice-drawer
---

# Story 79.8: Distribute recall injection budget across `max_chunks`

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an **operator using Local Nexus voice**,
I want **the `voice_pane` recall budget split fairly across up to `max_chunks` cited notes**,
so that **voice answers ground in multiple vault sources (e.g. Operator Guide + Daily Rhythm) instead of one chunk consuming the entire ~800-token budget (FR18 recall quality; Epic 82 live-smoke finding)**.

**Zone/Repo:** Omnipotent.md · `src/brain/recall-inject.ts`, `tests/brain/recall-inject.test.ts` · **Branch:** `hermes-consolidation`

**Problem statement (live evidence):** Epic 82-3 smoke (2026-06-29) confirmed `voice_pane` channel end-to-end, but a “what time does the morning digest cron run?” voice turn answered from **cron config / Hermes state**, not **`03-Resources/CNS-Operator-Guide.md`** — the golden query `morning-digest-time` expects. Root cause: `buildRecallInjection` allocates **`remainingTokens = maxTokens - tokensUsed`** sequentially, so the top-ranked chunk can consume ~800 tokens and leave the second `max_chunks` slot with negligible budget even when two distinct parent notes rank in top-k.

**Out of scope:** 82-x plumbing (voice channel resolution, VoiceDrawer, plugin sidecar) — **done**. Calibration threshold retuning (79-7) — **done**. Plugin / prefetch CLI contract changes — **unchanged**.

## Acceptance Criteria

1. **Per-chunk budget allocation (AC: split)**
   - **When** `buildRecallInjection` has **≥2 injectable hits** within `max_chunks` (distinct parent paths, pass secret-gate/blocklist, non-empty passage)
   - **Then** each injected chunk’s token budget is capped at **`floor(max_injection_tokens / injectableCount)`** where `injectableCount = min(eligibleHits, max_chunks)` — equal split across slots that will actually inject
   - **And** total `tokensUsedEstimate` still **≤** channel `max_injection_tokens` (NFR-RECALL-1)
   - **And** citation count can reach **`max_chunks`** when multiple notes rank (voice_pane: **2 distinct paths** on multi-note queries)

2. **Single-note preservation (AC: single)**
   - **When** only **one** injectable hit survives filtering (or only one ranks above threshold)
   - **Then** that chunk may use the **full** channel `max_injection_tokens` (today’s behavior preserved — no artificial 50% cap on lone relevant note)

3. **Sequential-fair reserve algorithm (AC: algorithm)**
   - **Implement** using either:
     - **Two-pass (preferred):** (a) collect up to `max_chunks` injectable candidates with existing drop rules; (b) compute `perChunkCap` from final count; (c) fit each chunk with `fitRecallChunkToBudget({ remainingTokens: perChunkCap })`, **or**
     - **Slot-reserve inline:** before fitting chunk *i*, `remainingSlots = max_chunks - chunks.length`; `chunkBudget = floor((maxTokens - tokensUsed) / remainingSlots)` **only when** at least one more injectable candidate remains after current hit
   - **And** document chosen approach in code comment at allocation site (one paragraph max)
   - **And** `fitRecallChunkToBudget` helper **unchanged in signature** — pass per-slot cap as `remainingTokens`

4. **Channel parity (AC: channels)**
   - **And** allocation applies to **all channels** (`voice_pane`, `standard_text`, `yapped_text`) — not voice-only special case
   - **And** existing behaviors **unchanged:** `max_chunks` hard cap, drop reasons (`BUDGET`, `PATH_BLOCKED`, `SECRET_GATE`, …), shadow mode, blocked paths, quality weighting pass-through, chunk passage text from index (79-6)

5. **Golden query regression (AC: golden)**
   - **When** fixture harness runs `morning-digest-time` on `voice_pane` with multi-hit fixture index (Operator Guide + cron-adjacent decoy note both above threshold)
   - **Then** injection includes **≥2 citations** OR Operator Guide passage is present **and** total tokensUsed ≤ 800 with second distinct path cited
   - **And** existing `recall-inject.test.ts` cases remain green: budget ceiling, max_chunks trim, skip oversized path, shadow mode, stale penalty ordering

6. **No contract drift (AC: contracts)**
   - **And** `recall-prefetch-cli.ts` stdout JSON shape unchanged (`context`, `citations`, `channel`, `shadow`)
   - **And** `config/brain-recall-policy.json` values unchanged unless dev adds optional `policy_notes` line documenting split semantics (no new required schema keys)
   - **And** protect-list **zero edits:** `src/agents/{synthesis,hook,boss}-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`
   - **And** no Hermes core fork; no `plugin.py` edits

7. **Tests + verify (AC: verify)**
   - **And** new unit tests in `tests/brain/recall-inject.test.ts`:
     - Multi-note equal split: 2 long passages, `voice_pane` 800 tok / 2 chunks → **2 citations**, each excerpt trimmed, neither monopolizes 800
     - Single-note full budget: 1 hit, long passage → 1 citation using up to full 800
     - Multi-chunk with one BUDGET drop: second note still injects when first fits its slot cap
   - **And** brain tests use isolated env: `CNS_BRAIN_EMBEDDER=stub`, temp vault/index, fixture policy — **never inherit live `~/.hermes` policy**
   - **And** `bash scripts/verify.sh` passes (known session-close parity drift OK per operator)

## Tasks / Subtasks

- [x] **Analyze + implement budget split** (AC: split, single, algorithm)
  - [x] Read `buildRecallInjection` loop in `src/brain/recall-inject.ts:156-261` — today uses global `remainingTokens = maxTokens - tokensUsed`
  - [x] Refactor to two-pass or slot-reserve; compute `perChunkCap` from injectable count
  - [x] Post-pass: if `citations.length === 1`, optional re-fit with full `maxTokens` only if first pass under-utilized budget (only if needed for AC:single — prefer correct upfront count)

- [x] **Tests** (AC: golden, verify)
  - [x] Add voice_pane multi-note split test (2 notes, long bodies, assert 2 paths cited, each `estimateInjectionTokens(chunk) ≤ 400`)
  - [x] Add single-note full-budget test
  - [x] Add standard_text regression: existing `max_injection_tokens` ceiling test still passes

- [x] **Verify gate** (AC: verify)
  - [x] `npm test -- tests/brain/recall-inject.test.ts`
  - [x] `bash scripts/verify.sh` (story-specific brain tests green)

## Dev Notes

### Current code state (READ BEFORE EDITING)

| File | Today | This story changes |
|------|-------|-------------------|
| `src/brain/recall-inject.ts` | Sequential budget: first chunk eats `maxTokens - tokensUsed` | Per-chunk cap from `maxTokens / injectableCount` |
| `src/brain/recall-policy.ts` | Parses `max_injection_tokens`, `max_chunks` | **No schema change required** |
| `config/brain-recall-policy.json` | voice_pane: 800 tok, 2 chunks | Optional `policy_notes` only |
| `src/brain/recall-prefetch-cli.ts` | Calls `buildRecallInjection` | **No logic change** |
| `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` | Subprocess prefetch | **Do not edit** |

### Bug mechanism (why smoke failed)

```typescript
// CURRENT (recall-inject.ts ~222-240): first hit sees remainingTokens ≈ 800
const remainingTokens = maxTokens - tokensUsed;
const fitted = fitRecallChunkToBudget({ ..., remainingTokens });
// Second hit sees remainingTokens ≈ 0–50 after first long Operator Guide passage truncated to ~780 tokens
```

Voice golden `morning-digest-time` expects `03-Resources/CNS-Operator-Guide.md`. Cron/hermes config notes may also rank. With sequential drain, model sees **one** cited block dominated by whichever passage expanded first — not a balanced multi-source context.

### Recommended algorithm (two-pass)

```typescript
// Pass 1: walk queryOut.results — apply blocklist/secret-gate/empty passage drops;
//         collect injectable candidates up to max_chunks (store path, passageText, score)

// Pass 2:
const n = candidates.length;
if (n === 0) { /* empty result */ }
const perChunkCap =
  n === 1 ? maxTokens : Math.floor(maxTokens / Math.min(n, maxChunks));

for (const c of candidates.slice(0, maxChunks)) {
  const fitted = fitRecallChunkToBudget({ ..., remainingTokens: perChunkCap });
  // same drop-on-null behavior
}
```

**Why two-pass:** Inline slot-reserve (`floor((maxTokens - used) / remainingSlots)`) caps a **lone** injectable hit at `800/2=400` when `max_chunks=2` even if only one note qualifies — violates AC:single.

### `fitRecallChunkToBudget` — preserve as-is

```125:151:src/brain/recall-inject.ts
function fitRecallChunkToBudget(params: {
  path: string;
  passageText: string;
  score: number;
  remainingTokens: number;
}): { chunk: string; tokens: number } | null {
  // ... headerTokens guard, char trim loop — DO NOT duplicate
}
```

Pass **`perChunkCap`** as `remainingTokens`, not global remainder.

### Architecture compliance

- **FR18** (`epics-hermes-omniscient.md`): injection stops when channel token budget exhausted; fetch may over-retrieve; inject trims by score. This story refines **how** trim splits across chunks — still config-driven via `max_injection_tokens` + `max_chunks`.
- **NFR-RECALL-1:** `voice_pane` (800) < `standard_text` (1500) < `yapped_text` (3000) — unchanged in config.
- **ADR-HERMES-015:** trim logic stays in `src/brain/`; plugin subprocess contract unchanged.
- **No WriteGate / vault_log_action / security.md** touch — operator approval not required.

### Previous story intelligence

**79-6 (chunk-aware recall):** Inject uses **chunk passage text** from index hit, cites **parent** vault path. Budget/drop semantics explicitly “preserved unchanged” except this story’s allocation fix.

**79-7 (calibration soften):** Thresholds retuned (`voice_pane` min_score 0.15); `shadow_mode: false` live. Do **not** retune thresholds in 79-8 — pure inject allocator change.

**82-2 / 82-3 (voice plumbing):** `voice_pane` resolved via `sessions.source=nexus-voice` → `--recall-channel voice_pane`. Confirmed live 2026-06-29. Degraded-chip / sidecar is separate (SPIKE-OMNI-003).

**79-3 review patches:** Budget continuation when first path too long; secret-gate cache; blocked paths in policy — preserve all when refactoring loop.

### Testing requirements

| Test file | Requirement |
|-----------|-------------|
| `tests/brain/recall-inject.test.ts` | Primary — new split + single-note cases |
| `tests/brain/calibration-harness.test.ts` | Run via verify — should remain green (uses `buildRecallInjection`) |
| `tests/brain/recall-prefetch-cli.test.ts` | JSON contract unchanged |

**Env isolation pattern** (mandatory — from HANDOFF + 82-2):

```typescript
// Fixture policy in test — do not load repo policy with shadow_mode:false from live env
const FIXTURE_POLICY = { ... channels: { voice_pane: { max_injection_tokens: 800, max_chunks: 2, ... } } };
process.env.CNS_BRAIN_EMBEDDER = "stub";
// mkdtemp vault + index per test (existing pattern in recall-inject.test.ts)
```

### File structure requirements

| Path | Action |
|------|--------|
| `src/brain/recall-inject.ts` | **UPDATE** — budget allocation only |
| `tests/brain/recall-inject.test.ts` | **UPDATE** — new cases |
| `config/brain-recall-policy.json` | Optional note in `policy_notes` |
| `src/brain/recall-policy.ts` | Read-only unless documenting split in comments |
| `src/brain/recall-prefetch-cli.ts` | Read-only |

### Library / framework requirements

- **No new npm dependencies** (NFR-PKG-1 satisfied by default)
- **Context7:** Not required — no new library; pure TypeScript refactor of existing inject loop
- Token estimate remains `ceil(chars/4)` — do not switch to Portal `count_tokens` on hot path (79-4 documented proxy limitation)

### Git intelligence

Recent `hermes-consolidation` commits are Epic 82 voice + SPIKE-OMNI-003 sidecar (`9a968db`, `2e4e056`, `b57f470`). Recall inject core last materially changed in 79-6/79-7. Keep commit scoped to `recall-inject.ts` + tests — one logical change.

### Project context reference

- `HANDOFF-2026-06-29-session9-hermes-consolidation.md` §4 item 3 — defines this story’s motivation
- `config/brain-golden-queries.json` → `morning-digest-time` expects `03-Resources/CNS-Operator-Guide.md`
- `project-context.md` — protect-list, verify gate, brain test isolation

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` — FR18, Epic 79]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` — ADR-HERMES-015, policy keys]
- [Source: `_bmad-output/implementation-artifacts/79-3-recall-policy-config-recall-inject.md` — original budget trim AC]
- [Source: `_bmad-output/implementation-artifacts/79-6-chunked-brain-index-chunk-aware-recall.md` — chunk passage inject]
- [Source: `_bmad-output/implementation-artifacts/82-2-spike-omni-002-voice-channel.md` — voice_pane 800/2 budget table]
- [Source: `HANDOFF-2026-06-29-session9-hermes-consolidation.md` — live smoke failure narrative]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Two-pass refactor: pass 1 collects injectable candidates (all existing drop rules); pass 2 sets `perChunkCap = n===1 ? maxTokens : floor(maxTokens/min(n,maxChunks))`.
- Budget-ceiling regression updated: equal split allows up to 3 citations within 60-token ceiling (20 tok/slot).
- Fit-time BUDGET drop test uses 50-token voice_pane budget so perChunkCap=25 exposes long-path header failure.

### Completion Notes List

- Implemented two-pass budget allocation in `buildRecallInjection` — lone note keeps full `max_injection_tokens`; multi-note queries share evenly across injectable count.
- `fitRecallChunkToBudget` signature unchanged; per-slot cap passed as `remainingTokens`.
- Added 3 unit tests: equal split (2 notes @ 800/2), single-note full budget, fit-time BUDGET drop with second note still injecting.
- All 23 recall-inject tests green; `bash scripts/verify.sh` exit 0 (known session-close parity drift).
- Watch-item preserved: fit-time null drops do not redistribute slot budget (mild under-use by design).

### File List

- `src/brain/recall-inject.ts`
- `tests/brain/recall-inject.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/79-8-distribute-recall-budget-across-max-chunks.md`
