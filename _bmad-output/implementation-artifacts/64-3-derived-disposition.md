---
story_id: 64-3
epic: 64
title: derived-disposition
status: review
baseline_commit: 14c77b0
operator_brief: 2026-06-08
predecessors: 64-2
blocks: 64-5
---

# Story 64.3: Derived disposition — priority / watch / ignore / escalate

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator triaging the morning digest "What Matters Now" feed**,
I want **`deriveDisposition(scores, rankScore)` to assign exactly one categorical label per scored signal using the locked architecture threshold table**,
so that **Epic 64 can surface actionable triage (`priority`, `escalate`) without operator guesswork, and 64-5 can push pre-labeled signals to Convex with deterministic, regression-tested disposition rules**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 64: Intelligence Scoring Engine v1 — **64-3 is the disposition gate**; blocks 64-5 orchestration |
| **Repo** | **Omnipotent.md only** — extend existing `score-digest-signals.mjs` + tests; no cns-dashboard changes |
| **Predecessor** | **64-2** (done) — five dimension scorers exported; `deriveDisposition` explicitly out of scope until this story |
| **Normative spec** | `architecture-epic-64-scoring-engine.md` **§7** (threshold table) + **§7.1** (fixture matrix A–E) |
| **FR IDs** | FR-10 (disposition derivation) |
| **Out of scope** | `computeRankScore`, `scoreDigestSignals` orchestrator (64-5); `normalizeEngagement` (64-4); `push-digest-convex.mjs` / task-prompt Source 6 integration (64-5); Convex mutations; dashboard UI; operator disposition override (PRD §4.3) |

### Problem (current state)

`score-digest-signals.mjs` (64-2) computes five dimension scores but exports **no** `deriveDisposition`. Convex validators (64-1) accept optional `disposition` literals — this story implements the pure derivation function and locks regression tests to architecture §7.1.

### Operator brief (binding)

1. **Architecture §7 threshold table is normative** — not the PRD addendum sketch (addendum `watch`/`ignore` rules differ; architecture wins per §12 resolution).
2. **§7.1 fixture cases A–E are mandatory tests** — same enforcement pattern as 64-2 novelty table rows (10/25/45/65/90/100).
3. **Omnipotent.md only** — one function export + test extensions; `bash scripts/verify.sh` green before done.

## Acceptance Criteria

### 1. `deriveDisposition` export and signature (AC: FR-10 foundation)

**Given** `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
**When** the module is imported
**Then** it exports `deriveDisposition(scores, rankScore)`
**And** `scores` is an object with all five dimension keys: `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency` (each 0–100 integer)
**And** `rankScore` is a number (0–100) — may be `null`/`undefined` when caller has not computed rank yet (rule 1 must still work)
**And** return value is exactly one literal: `'priority' | 'watch' | 'ignore' | 'escalate'`

### 2. Normative threshold table — first match wins (AC: FR-10; architecture §7)

**Given** dimension scores and optional `rankScore`
**When** `deriveDisposition(scores, rankScore)` runs
**Then** rules are evaluated **top-to-bottom; first match wins**:

| Priority | disposition | Rule |
|----------|-------------|------|
| 1 | `escalate` | `urgency >= 75` AND (`personalRelevance >= 60` OR `relevance >= 75`) |
| 2 | `priority` | `rankScore >= 70` AND `personalRelevance >= 50` |
| 3 | `ignore` | `rankScore < 40` AND `max(relevance, personalRelevance, novelty, momentum, urgency) < 50` |
| 4 | `watch` | default (all remaining signals) |

**And** rule 1 (`escalate`) uses dimension scores only — **must not** consult `rankScore` (escalate can apply before `rankScore` is computed)
**And** rules 2–3 require finite `rankScore`; when `rankScore` is `null`/`undefined`/`NaN`, skip rules 2–3 and fall through to `watch` unless rule 1 matched
**And** `ignore` uses `max()` across all five dimensions — not "all dimensions < 50" (anti-drift: one dimension at 49 with rankScore 35 still qualifies if max < 50)

### 3. Mandatory §7.1 fixture matrix (AC: FR-10 regression lock — **primary anti-drift surface**)

**Given** controlled score inputs per architecture §7.1
**When** `deriveDisposition` is called with the fixture `scores` and `rankScore`
**Then** outputs match **exactly**:

| Case | relevance | personalRelevance | novelty | momentum | urgency | rankScore | Expected |
|------|-----------|-------------------|---------|----------|---------|-----------|----------|
| A | 80 | 30 | * | * | 80 | 55 | **escalate** |
| B | 40 | 65 | * | * | 80 | 60 | **escalate** |
| C | 70 | 55 | * | * | 40 | 72 | **priority** |
| D | 30 | 30 | 20 | 25 | 20 | 35 | **ignore** |
| E | 55 | 40 | * | * | 50 | 55 | **watch** |

`*` = any values that do not trigger a higher-priority rule (for A/B/C/E, set `novelty` and `momentum` ≤ 49 so `ignore` cannot fire; for D, all five must be < 50 per row above).

**Mandatory tests:** one dedicated test per case A, B, C, D, E — named or commented with case letter. Do not substitute continuous/heuristic disposition logic.

### 4. Rule-order edge fixtures (AC: anti-drift §7 notes)

**Given** a signal that satisfies both `escalate` and `priority` conditions
**When** `deriveDisposition` runs
**Then** result is **`escalate`** (rule 1 wins over rule 2)

**Given** `rankScore = 72`, `personalRelevance = 55`, `urgency = 40` (Case C inputs)
**When** `deriveDisposition` runs
**Then** result is **`priority`** — not `escalate` (urgency below 75)

**Given** `rankScore = 35`, all five dimensions < 50 (Case D inputs)
**When** `deriveDisposition` runs
**Then** result is **`ignore`** — not `watch`

**Given** `urgency = 80`, `personalRelevance = 30`, `relevance = 80`, `rankScore = null`
**When** `deriveDisposition` runs
**Then** result is **`escalate`** — proves rule 1 does not require `rankScore`

### 5. No downstream integration (AC: scope boundary)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** `computeRankScore`, `normalizeEngagement`, or `scoreDigestSignals` orchestrator (64-4, 64-5)
**And** **no** changes to `push-digest-convex.mjs`, `task-prompt.md` Source 6, or `pick-signal-notebook.mjs`
**And** `tests/morning-digest-pick-signal-notebook.test.mjs` passes unchanged (routing regression gate)
**And** no Convex live queries

### 6. Test file and verify gate (AC: architecture §11)

**Given** `tests/morning-digest-score-signals.test.mjs`
**When** tests run via `npm test`
**Then** coverage includes: `deriveDisposition` export, all four threshold rules, §7.1 cases A–E (one test each), rule-order edge fixtures (§4), `rankScore` null path for escalate
**And** existing 64-2 dimension tests remain green
**And** `bash scripts/verify.sh` passes green

## Tasks / Subtasks

- [x] **T1** Implement `deriveDisposition` in `score-digest-signals.mjs` (AC: 1, 2)
  - [x] Add JSDoc typedef for scores shape (five required keys)
  - [x] Rule 1: escalate — ignore `rankScore`
  - [x] Rules 2–3: guard on finite `rankScore`
  - [x] Rule 4: default `watch`
  - [x] Export from module; update file header comment (64-2 → 64-2 + 64-3)
- [x] **T2** Extend `tests/morning-digest-score-signals.test.mjs` (AC: 3, 4, 6)
  - [x] Import `deriveDisposition`
  - [x] One test per §7.1 case A, B, C, D, E with explicit dimension values
  - [x] Edge tests: escalate beats priority; Case C not escalate; Case D not watch; escalate with null rankScore
- [x] **T3** Hermes skill sync + verify (AC: 5, 6)
  - [x] Run `bash scripts/install-hermes-skill-morning-digest.sh` if module changed
  - [x] `bash scripts/verify.sh` green
  - [x] Confirm `morning-digest-pick-signal-notebook.test.mjs` untouched and passing

## Dev Notes

### Architecture compliance

| ADR | Requirement for 64-3 |
|-----|----------------------|
| **ADR-E64-001** | Disposition compute in Omnipotent.md; no Convex derivation |
| **ADR-E64-002** | `disposition` is separate from `scores` / `rankScore` — this story produces the label only |
| **ADR-E64-003** | N/A — disposition does not read raw engagement fields |
| **ADR-E64-004** | `escalate` and `priority` both gate on `personalRelevance` — preserves operator-fit signal |
| **ADR-E64-005** | No last30days dependency |

### Primary drift risks (read before coding)

1. **Addendum vs architecture:** PRD addendum §"Disposition threshold sketch" defines different `watch`/`ignore` rules (`watch` = rankScore 40–69 OR any dimension ≥ 60). **Wrong for this story.** Architecture §7 table is locked per §12 ("Disposition thresholds | §7 table (locked)").
2. **Ignore rule:** Use `max(five dimensions) < 50`, not `every dimension < 50` — equivalent when all < 50, but implement `max()` explicitly per architecture.
3. **Escalate before rankScore:** Do not require `rankScore` for rule 1; 64-5 may call `deriveDisposition` after dimensions but before `computeRankScore` in some paths — function must support `rankScore` absent.
4. **Continuous thresholds:** Do not invent weighted blends or ML-style disposition — discrete first-match-wins only.
5. **Case A vs priority:** Case A has `rankScore=55` and `personalRelevance=30` — would fail `priority` even without escalate; test must prove `escalate` wins via `relevance >= 75`.

### `deriveDisposition` implementation sketch (normative behavior, not optional pseudocode)

```javascript
/**
 * @param {{
 *   relevance: number,
 *   personalRelevance: number,
 *   novelty: number,
 *   momentum: number,
 *   urgency: number,
 * }} scores
 * @param {number | null | undefined} rankScore
 * @returns {'priority' | 'watch' | 'ignore' | 'escalate'}
 */
export function deriveDisposition(scores, rankScore) {
  const { relevance, personalRelevance, novelty, momentum, urgency } = scores;

  // Rule 1 — escalate (ignores rankScore)
  if (urgency >= 75 && (personalRelevance >= 60 || relevance >= 75)) {
    return 'escalate';
  }

  const rank = rankScore;
  if (Number.isFinite(rank)) {
    // Rule 2 — priority
    if (rank >= 70 && personalRelevance >= 50) {
      return 'priority';
    }
    // Rule 3 — ignore
    const dimMax = Math.max(relevance, personalRelevance, novelty, momentum, urgency);
    if (rank < 40 && dimMax < 50) {
      return 'ignore';
    }
  }

  // Rule 4 — watch
  return 'watch';
}
```

### §7.1 fixture helper pattern

```javascript
function scoresFixture({ relevance, personalRelevance, novelty = 30, momentum = 30, urgency }) {
  return { relevance, personalRelevance, novelty, momentum, urgency };
}

// Case A
assert.equal(
  deriveDisposition(scoresFixture({ relevance: 80, personalRelevance: 30, urgency: 80 }), 55),
  'escalate',
);
```

Use explicit `novelty`/`momentum` in Case D (20, 25) so `max < 50` is provable.

### Previous story intelligence (64-2)

- Module path and test file already exist — **extend**, do not create parallel disposition module.
- Test style: `node:test` + `assert.strict`; describe blocks per function area.
- 64-2 explicitly deferred `deriveDisposition` — no stub to replace; add fresh export at end of `score-digest-signals.mjs`.
- Review pattern from 64-2: mandatory table-row tests prevented novelty drift — replicate for §7.1 A–E.
- Hermes install gate: run `bash scripts/install-hermes-skill-morning-digest.sh` after editing morning-digest scripts.
- 64-2 verify: 22+ tests in score-signals file; keep all green.

### Git intelligence (recent Epic 64 work)

| Commit | Relevance |
|--------|-----------|
| `14c77b0` | 64-2 implementation + review patches — **baseline for 64-3** |
| `347b41c` | Architecture §7 + §7.1 locked — normative AC source |
| `433b412` | 64-1 schema — `disposition` validator literals already defined |
| `cfdbfd3` | Push contract accepts optional `disposition` — wiring is 64-5 |

### Project structure notes

| Path | Change |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **UPDATE** — add `deriveDisposition` export |
| `tests/morning-digest-score-signals.test.mjs` | **UPDATE** — disposition tests |
| `push-digest-convex.mjs` | **NO CHANGE** (64-5) |
| `pick-signal-notebook.mjs` | **NO CHANGE** |
| `task-prompt.md` | **NO CHANGE** (64-5) |
| `cns-dashboard/` | **NO CHANGE** |

### Testing requirements

| File | Action |
|------|--------|
| `tests/morning-digest-score-signals.test.mjs` | **EXTEND** — §7.1 A–E + rule-order edges |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | **Run unchanged** — routing regression |
| `tests/morning-digest-push-convex.test.mjs` | **No changes** — scored disposition push is 64-5 |

**Gate:** `bash scripts/verify.sh` green before marking done.

### WriteGate / security

No WriteGate, `vault_log_action`, or `security.md` changes. No operator approval required.

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md` §7, §7.1, §10, §11, §12]
- [Source: `_bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md` §4.3 FR-10]
- [Source: `_bmad-output/implementation-artifacts/64-2-scoring-engine-five-dimensions.md` — scope boundary + mandatory table test pattern]
- [Source: `_bmad-output/implementation-artifacts/64-1-digest-signals-schema-extension.md` — `disposition` literal union]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — extend in place]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- Implementation follows architecture §7 sketch exactly: rule 1 returns before any `rankScore` read.
- Added explicit test `escalate with null rankScore` plus `skips priority and ignore when rankScore is absent` to lock the 64-5 pre-rank path.

### Completion Notes List

- Added `deriveDisposition(scores, rankScore)` export with `DimensionScores` JSDoc typedef to `score-digest-signals.mjs`.
- Rule 1 (`escalate`) evaluates urgency + relevance/personalRelevance only — no `rankScore` access in that branch.
- Rules 2–3 gated behind `Number.isFinite(rankScore)`; default `watch` for all other cases.
- Extended test suite with 10 disposition tests: §7.1 cases A–E, rule-order edges, null/undefined rankScore paths.
- Hermes skill synced via `install-hermes-skill-morning-digest.sh`; `bash scripts/verify.sh` green (578 Omnipotent + cns-dashboard tests).
- **Reviewer flag:** Primary edge case is `escalate` with `rankScore = null` (AC §4). If any implementation checks `rankScore` inside the escalate branch, that is the bug — tests `escalate with null rankScore` and §7.1 case A/B should catch it.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- ✅ **Clean review** — all layers passed (2026-06-09). 0 decision-needed, 0 patch, 0 defer blocking.
- **Code path verified:** Rule 1 (`escalate`) returns at `score-digest-signals.mjs:617` before any `rankScore` read (`const rank = rankScore` at `:620`). `rankScore` is only consulted inside `Number.isFinite(rank)` for rules 2–3.
- **AC coverage:** §7.1 cases A–E, escalate-beats-priority, Case C/D negatives, null/undefined `rankScore` paths, `verify.sh` green, Hermes skill synced, scope boundary intact (no 64-5 orchestrator).
- **Informational (non-blocking):** Boundary exact-edge tests (rank 70/40, dimMax 50, urgency 75) and explicit `NaN` rankScore test are optional hardening — same `Number.isFinite` branch as null/undefined. Input validation on malformed `scores` deferred to 64-5 orchestrator (consistent with 64-2 dimension scorers).

### Change Log

- 2026-06-09: Story 64-3 — `deriveDisposition` pure function + §7.1 fixture regression tests; Hermes skill sync.
- 2026-06-09: Code review — clean pass; status → done.
