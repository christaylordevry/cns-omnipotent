---
story_id: 64-4
epic: 64
title: engagement-normalization
status: done
baseline_commit: f1513d3
operator_brief: 2026-06-08
predecessors: 64-2
blocks: 64-5
---

# Story 64.4: Cross-source engagement normalization

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator ranking heterogeneous digest signals in "What Matters Now"**,
I want **`normalizeEngagement(signal)` to map per-source raw engagement (`points`, `stars`, `upvotes`, `commentCount`, `forks`) onto a common 0–100 `normalizedEngagement` scale using architecture §6 log-scaled caps**,
so that **`scoreMomentum` Path A (64-2) can consume a comparable engagement signal without cross-source raw comparison (ADR-E64-003), and 64-5 can fold `normalizedEngagement` into `rankScore` with deterministic, regression-locked calibration**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 64: Intelligence Scoring Engine v1 — **64-4 is the engagement normalization gate**; blocks 64-5 orchestration |
| **Repo** | **Omnipotent.md only** — extend `score-digest-signals.mjs` + tests; no cns-dashboard changes (schema engagement fields landed in 64-1) |
| **Predecessor** | **64-2** (done) — `scoreMomentum` Path A accepts injected `normalizedEngagement`; explicitly deferred `normalizeEngagement()` until this story |
| **Normative spec** | `architecture-epic-64-scoring-engine.md` **§6** (log-scaled caps table) + **§6.2** (FR-11 cross-source fixture) + **§6.3** (execution order) |
| **FR IDs** | FR-11 (per-source normalization), FR-12 (normalization before momentum) |
| **Out of scope** | `computeRankScore`, `scoreDigestSignals` orchestrator (64-5); `push-digest-convex.mjs` / task-prompt Source 6 integration (64-5); Convex mutations; dashboard UI; GitHub/Reddit **adapters** (Epic 65 — normalization must accept their `sourceType` + metadata shape anyway); `last30days` dependency (ADR-E64-005); changing `scoreMomentum` formula (locked in 64-2 §5.5) |

### Problem (current state)

`score-digest-signals.mjs` exports `scoreMomentum(signal, normalizedEngagement, ctx)` with Path A/B split, but **no** `normalizeEngagement`. Tests inject `normalizedEngagement` manually (64-2). HN RSS already maps `score` → `sourceMetadata.points` and `comments` → `sourceMetadata.commentCount` per 64-1 push contract — raw fields exist in schema but are not normalized.

### Operator brief (binding)

1. **Architecture §6.1 engagement caps table is normative AC** — not the PRD addendum sketch alone. Caps: HN `500` pts / `200` comments; GitHub `50k` stars / `5k` forks; Reddit `10k` upvotes / `2k` comments; shared `logNorm` helper; weighted per-source blends exactly as table specifies.
2. **ADR-E64-003 is non-negotiable** — `normalizeEngagement` reads raw fields; `scoreMomentum` must **not** read them (existing 64-2 guard + test must stay green).
3. **Omnipotent.md only** — one pure function (+ `logNorm` helper) + test extensions; `bash scripts/verify.sh` green before done.

## Acceptance Criteria

### 1. `logNorm` shared helper and cap constants (AC: architecture §6.1 foundation)

**Given** `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
**When** the module is imported
**Then** it exports named cap constants (anti-drift surface):

| Constant | Value |
|----------|-------|
| `HN_POINTS_CAP` | `500` |
| `HN_COMMENTS_CAP` | `200` |
| `GH_STARS_CAP` | `50000` |
| `GH_FORKS_CAP` | `5000` |
| `RD_UPVOTES_CAP` | `10000` |
| `RD_COMMENTS_CAP` | `2000` |

**And** it exports `logNorm(value, cap)` implementing:

```
logNorm(value, cap) = round(clamp(100 * log10(1 + value) / log10(1 + cap), 0, 100))
```

**And** non-finite or negative `value` is treated as `0` before the formula
**And** `logNorm(0, cap)` returns `0` for any positive `cap`
**And** `logNorm(cap, cap)` returns `100` (at-cap saturation)

### 2. `normalizeEngagement` export and return contract (AC: FR-11 foundation)

**Given** a digest signal `{ title, sourceType, sourceMetadata? }`
**When** `normalizeEngagement(signal)` runs
**Then** return type is `number | null`:
- **`null`** — source has no engagement normalization row (newsapi, arxiv, deep_signal, google_trends) OR no usable primary engagement field for the source
- **`number` 0–100** — integer per `round()` in per-source formulas below

**And** function is **pure** — no env reads, no filesystem, no Convex

### 3. Per-source formulas — normative §6.1 table (AC: FR-11 primary anti-drift)

**Given** `sourceType` and `sourceMetadata` engagement fields
**When** `normalizeEngagement` runs
**Then** per-source blends match architecture **exactly**:

| sourceType | Required raw fields | Formula |
|------------|---------------------|---------|
| `hackernews` | `points` (primary) | `round(0.80 * logNorm(points, 500) + 0.20 * logNorm(commentCount, 200))` |
| `github` | `stars` (primary) | `round(0.85 * logNorm(stars, 50000) + 0.15 * logNorm(forks, 5000))` |
| `reddit` | `upvotes` (primary) | `round(0.75 * logNorm(upvotes, 10000) + 0.25 * logNorm(commentCount, 2000))` |
| `newsapi` | — | return `null` |
| `arxiv` | — | return `null` |
| `deep_signal` | — | return `null` |
| `google_trends` | — | return `null` (`normalizedValue` feeds `trendProxyForSignal` only — §6.1) |

**Missing secondary field rule:** When `commentCount` / `forks` is absent, `undefined`, `null`, or non-finite → use `0` inside `logNorm` (not `null` for whole signal if primary present).

**Missing primary rule:** When primary field (`points`, `stars`, `upvotes`) is absent → return `null` (momentum uses Path B).

**Legacy HN field:** `sourceMetadata.comments` (64-1 legacy) is **not** a normalization input — use `commentCount` only. Do not alias `comments` → `commentCount` in this story (adapter/orchestration concern).

### 4. Mandatory cap-saturation fixture rows (AC: FR-11 regression lock)

**Given** controlled signals at architecture cap values
**When** `normalizeEngagement` runs
**Then** outputs match **exactly**:

| sourceType | sourceMetadata | Expected `normalizedEngagement` |
|------------|----------------|--------------------------------|
| `hackernews` | `{ points: 500, commentCount: 200 }` | **100** |
| `github` | `{ stars: 50000, forks: 5000 }` | **100** |
| `reddit` | `{ upvotes: 10000, commentCount: 2000 }` | **100** |
| `hackernews` | `{ points: 0, commentCount: 0 }` | **0** |

**Mandatory tests:** one dedicated test per table row — named or commented with source + cap label. Do not substitute continuous/heuristic normalization.

### 5. Cross-source FR-11 calibration fixture (AC: architecture §6.2)

**Given** primary-only engagement at equal raw integer `500`:

```javascript
const hn = normalizeEngagement({
  title: 'HN cap story',
  sourceType: 'hackernews',
  sourceMetadata: { points: 500 },
});
const gh = normalizeEngagement({
  title: 'GH repo',
  sourceType: 'github',
  sourceMetadata: { stars: 500 },
});
```

**When** both run through §6.1 formulas (secondary fields absent → `0`)
**Then** `hn !== gh` (must not copy raw 500 into a shared scale)
**And** `hn === 80` and `gh === 48` (precomputed from §6.1 — **lock these integers in tests**)
**And** `hn >= 51 && hn <= 85` (HN lands in architecture §6.2 "strong engagement" band)
**And** `gh` is strictly less than `hn` (monotonic cross-source calibration — same raw integer, different caps → different normalized scores)

**Architecture §6.2 fidelity note:** Full §6.2 text also requires `Math.abs(hn - gh) <= 15` and both signals in 51–85. With primary-only inputs, §6.1 yields `gh = 48` (below 51) and a 32-point gap. **§6.1 caps table wins** — implement formulas exactly; do **not** fudge caps/weights to satisfy §6.2. If product wants both clauses satisfied at `{500}`/`{500}`, that requires an architecture amendment (e.g. secondary-field defaults), not dev improvisation.

### 6. Momentum integration guard (AC: FR-12)

**Given** a hackernews signal with raw engagement metadata
**When** `const norm = normalizeEngagement(signal)` then `scoreMomentum(signal, norm, ctx)`
**Then** Path A applies when `norm` is a finite number
**And** `scoreMomentum` still **does not** read `sourceMetadata.points`, `stars`, `upvotes`, or `commentCount` (existing 64-2 test remains green)
**And** a dedicated test proves `normalizeEngagement` output drives momentum: e.g. HN `{points:500, commentCount:200}` → `norm=100` → `momentum = round(0.75*100 + 0.25*45) = 86` (HN `trendProxy` prior = 45)

**Given** newsapi / arxiv / deep_signal / google_trends signals
**When** `normalizeEngagement` returns `null`
**Then** `scoreMomentum(signal, null, ctx)` uses Path B unchanged (64-2 behavior preserved)

### 7. No downstream integration (AC: scope boundary)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** `computeRankScore` or `scoreDigestSignals` orchestrator (64-5)
**And** **no** changes to `push-digest-convex.mjs`, `task-prompt.md` Source 6, or `pick-signal-notebook.mjs`
**And** `tests/morning-digest-pick-signal-notebook.test.mjs` passes unchanged
**And** no Convex changes

### 8. Test file and verify gate (AC: architecture §11)

**Given** `tests/morning-digest-score-signals.test.mjs`
**When** tests run via `npm test`
**Then** coverage includes: `logNorm` helper edges, cap constants, per-source formula rows (§4), §6.2 cross-source fixture, momentum integration (§6), omit-null sources
**And** all 64-2 dimension + 64-3 disposition tests remain green
**And** `bash scripts/verify.sh` passes green

## Tasks / Subtasks

- [x] **T1** Implement `logNorm` + cap constants + `normalizeEngagement` in `score-digest-signals.mjs` (AC: 1–3)
  - [x] Export cap constants as named `const` bindings (test-importable)
  - [x] Implement `logNorm` with clamp + `Math.log10`
  - [x] Implement per-source branches; return `null` for non-engagement sources
  - [x] Extend JSDoc `DigestSignal` / `sourceMetadata` typedef for engagement fields + `github` | `reddit` sourceTypes
  - [x] Update file header comment (64-2 + 64-3 → + 64-4)
- [x] **T2** Extend `tests/morning-digest-score-signals.test.mjs` (AC: 4–6, 8)
  - [x] Import `logNorm`, cap constants, `normalizeEngagement`
  - [x] `logNorm` unit tests: 0, at-cap, negative→0
  - [x] One test per §4 cap-saturation row
  - [x] §6.2 cross-source fixture with locked `80`/`48`
  - [x] Momentum integration: norm → Path A; null → Path B
  - [x] Omit-null tests for newsapi, arxiv, deep_signal, google_trends
- [x] **T3** Hermes skill sync + verify (AC: 7, 8)
  - [x] Run `bash scripts/install-hermes-skill-morning-digest.sh` after module change
  - [x] `bash scripts/verify.sh` green
  - [x] Confirm `morning-digest-pick-signal-notebook.test.mjs` untouched and passing

## Dev Notes

### Architecture compliance

| ADR | Requirement for 64-4 |
|-----|----------------------|
| **ADR-E64-001** | Normalization compute in Omnipotent.md; no Convex scoring |
| **ADR-E64-002** | `normalizedEngagement` is separate optional field — this story produces the value only |
| **ADR-E64-003** | Raw engagement read **only** in `normalizeEngagement`; `scoreMomentum` consumes `normalizedEngagement` only |
| **ADR-E64-004** | N/A — normalization does not touch personal relevance |
| **ADR-E64-005** | No last30days import/subprocess — CNS-native `logNorm` |

### Current file state (`score-digest-signals.mjs`)

**What exists today (do not break):**
- Five dimension scorers + `deriveDisposition` (64-2, 64-3)
- `scoreMomentum(signal, normalizedEngagement, ctx)` — Path B when `normalizedEngagement` null/undefined; Path A when finite (lines ~590–602)
- `trendProxyForSignal` — static HN prior `45`; google_trends uses `normalizedValue` (lines ~571–579)
- `DigestSignal` typedef — `sourceMetadata` currently only documents `publishedAt`, `normalizedValue`; **extend** for engagement fields

**What this story adds:**
- `logNorm`, cap constants, `normalizeEngagement(signal)` export
- No changes to `scoreMomentum` body unless a bug fix — Path A wiring is caller-side until 64-5 orchestrator

### Primary drift risks (read before coding)

1. **Raw cross-source compare:** Do not branch on `points > stars` or compare heterogeneous raw fields inside `scoreMomentum`. All raw reads belong in `normalizeEngagement` only.
2. **Continuous/heuristic maps:** Do not replace §6.1 log-scaled table with linear `value/cap*100` or percentile estimation. **Wrong.**
3. **google_trends normalization:** Do not emit `normalizedEngagement` from `normalizedValue` — architecture §6.1 routes trends to `trendProxy` only.
4. **Cap drift:** Do not change `500` / `50000` / `10000` caps to make tests "feel" better — constants are normative AC (operator brief).
5. **Weight drift:** HN 0.80/0.20, GH 0.85/0.15, RD 0.75/0.25 are locked — not renormalizable without architecture amendment.
6. **Parallel module:** Do not create `normalize-engagement.mjs` — extend `score-digest-signals.mjs` per §4.1 export table.

### `normalizeEngagement` implementation sketch (normative behavior)

```javascript
export const HN_POINTS_CAP = 500;
export const HN_COMMENTS_CAP = 200;
export const GH_STARS_CAP = 50000;
export const GH_FORKS_CAP = 5000;
export const RD_UPVOTES_CAP = 10000;
export const RD_COMMENTS_CAP = 2000;

/**
 * @param {number} value
 * @param {number} cap
 * @returns {number}
 */
export function logNorm(value, cap) {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  if (cap <= 0) return 0;
  const scaled = (100 * Math.log10(1 + v)) / Math.log10(1 + cap);
  return Math.round(clamp(scaled, 0, 100));
}

/**
 * @param {DigestSignal} signal
 * @returns {number | null}
 */
export function normalizeEngagement(signal) {
  const meta = signal.sourceMetadata ?? {};
  const cc = meta.commentCount;

  switch (signal.sourceType) {
    case 'hackernews': {
      if (!Number.isFinite(meta.points)) return null;
      return Math.round(
        0.8 * logNorm(meta.points, HN_POINTS_CAP) +
          0.2 * logNorm(cc, HN_COMMENTS_CAP),
      );
    }
    case 'github': {
      if (!Number.isFinite(meta.stars)) return null;
      return Math.round(
        0.85 * logNorm(meta.stars, GH_STARS_CAP) +
          0.15 * logNorm(meta.forks, GH_FORKS_CAP),
      );
    }
    case 'reddit': {
      if (!Number.isFinite(meta.upvotes)) return null;
      return Math.round(
        0.75 * logNorm(meta.upvotes, RD_UPVOTES_CAP) +
          0.25 * logNorm(cc, RD_COMMENTS_CAP),
      );
    }
    case 'newsapi':
    case 'arxiv':
    case 'deep_signal':
    case 'google_trends':
      return null;
    default:
      return null;
  }
}
```

### Precomputed reference values (for test authoring)

| Input | logNorm / blend | Result |
|-------|-----------------|--------|
| `logNorm(500, 500)` | — | 100 |
| `logNorm(500, 50000)` | — | 57 |
| HN `{points:500}` only | `0.8*100 + 0.2*0` | **80** |
| GH `{stars:500}` only | `0.85*57 + 0.15*0` | **48** |
| HN `{points:500, commentCount:200}` | `0.8*100 + 0.2*100` | **100** |
| Momentum Path A: HN cap + norm 100 | `0.75*100 + 0.25*45` | **86** |

### §6.3 execution order (64-5 preview — not implemented here)

```
normalizedEngagement = normalizeEngagement(signal)  // may be null
scores.momentum = scoreMomentum(signal, normalizedEngagement, ctx)
```

64-4 tests prove the two-step contract in isolation; 64-5 wires it in `scoreDigestSignals`.

### Previous story intelligence

**64-2:**
- `scoreMomentum` Path A/B already implemented; ADR-E64-003 guard test exists (`uses Path A with injected normalizedEngagement and ignores raw engagement fields`)
- Module path: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- Test style: `node:test` + `assert.strict`; mandatory table-row tests prevented novelty drift — replicate for §6.1 cap rows

**64-3:**
- Extend same module in place; update header comment pattern
- Hermes install gate after morning-digest script edits
- Scope boundary: no orchestrator until 64-5

**64-1:**
- `sourceMetadata.points`, `commentCount`, `stars`, `forks`, `upvotes` validated in cns-dashboard — normalization reads same field names
- HN RSS mapping documented in `task-prompt.md` — adapters emit raw fields; normalization consumes them

### Git intelligence (recent Epic 64 work)

| Commit | Relevance |
|--------|-----------|
| `f1513d3` | 64-3 `deriveDisposition` — **baseline for 64-4** |
| `14c77b0` | 64-2 `scoreMomentum` Path A/B + momentum guard test |
| `347b41c` | Architecture §6 locked — normative AC source |
| `cfdbfd3` | 64-1 `sourceMetadata` engagement fields |

### Project structure notes

| Path | Change |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **UPDATE** — `logNorm`, cap constants, `normalizeEngagement` |
| `tests/morning-digest-score-signals.test.mjs` | **UPDATE** — normalization tests |
| `push-digest-convex.mjs` | **NO CHANGE** (64-5) |
| `pick-signal-notebook.mjs` | **NO CHANGE** |
| `task-prompt.md` | **NO CHANGE** (64-5) |
| `cns-dashboard/` | **NO CHANGE** |

### Testing requirements

| File | Action |
|------|--------|
| `tests/morning-digest-score-signals.test.mjs` | **EXTEND** — logNorm, cap rows, §6.2, momentum integration |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | **Run unchanged** — routing regression |
| `tests/morning-digest-push-convex.test.mjs` | **No changes** — scored push is 64-5 |

**Gate:** `bash scripts/verify.sh` green before marking done.

### WriteGate / security

No WriteGate, `vault_log_action`, or `security.md` changes. No operator approval required.

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md` §6, §6.1–6.3, §10, §11, ADR-E64-003]
- [Source: `_bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md` §4.4 FR-11, FR-12]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md` locked decision #6]
- [Source: `_bmad-output/implementation-artifacts/64-2-scoring-engine-five-dimensions.md` — momentum Path A deferral + guard test pattern]
- [Source: `_bmad-output/implementation-artifacts/64-1-digest-signals-schema-extension.md` — `sourceMetadata` engagement field names]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — extend in place]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor Agent)

### Debug Log References

(none)

### Completion Notes List

- Implemented `logNorm`, six named cap constants, and `normalizeEngagement` in `score-digest-signals.mjs` per architecture §6.1 — no cap/weight fudge.
- §6.2 cross-source fixture locked: HN `{points:500}` → **80**, GH `{stars:500}` → **48** (gh below 51 band — §6.1 wins per story fidelity note).
- Extended tests: logNorm edges, four cap-saturation rows, cross-source calibration, omit-null sources, momentum Path A/B integration.
- Existing 64-2 ADR-E64-003 guard test remains green; `scoreMomentum` body unchanged.
- Hermes skill synced; `bash scripts/verify.sh` green (593 node tests + cns-dashboard).

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` (modified)
- `tests/morning-digest-score-signals.test.mjs` (modified)

### Change Log

- 2026-06-09: Story 64-4 — `normalizeEngagement` + `logNorm` + cap constants; test extensions; Hermes sync.

## Story Completion Status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **done**
- Code review: clean (2026-06-09) — logNorm/caps match §6.1; §6.2 fixture locked at hn=80 / gh=48 via `assert.equal`
