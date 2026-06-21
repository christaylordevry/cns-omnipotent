# Story 73.5: Get Entity Intelligence Query

Status: done

baseline_commit: 6dfc4244061e3a9ee70f58abb0274ec33d6e1f1a

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **cns-dashboard only** (Convex query, constants, validators, tests). No Omnipotent.md changes.  
**Normative spec:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §5, ADR-E73-004, ADR-E73-005, ADR-E73-006, ADR-E73-007  
**Prerequisites:** **73-1** (`entityMentions` table + row shape). **73-4** soft — tests use inserted fixtures; empty lanes OK until live runs.  
**Blocks:** **73-6**, **73-7** (hard gate — both marked ready-for-dev pending this story)

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a CNS operator viewing Nexus entity intelligence surfaces,
I want a single derived Convex query `getEntityIntelligence` that ranks tracked and emerging lanes with reasons and evidence,
so that the dashboard and morning digest share identical lane logic, thresholds live in one tunable file, and no signal re-scoring happens in Convex.

## Acceptance Criteria

### AC1 — Threshold constants (ADR-E73-006)

**Given** architecture ADR-E73-006 v1 default table  
**When** `cns-dashboard/convex/constants.ts` is updated  
**Then** it exports `[TUNABLE v1]` constants:

| Constant | Default |
|----------|---------|
| `ENTITY_ACTIVE_WINDOW_DAYS` | 7 |
| `ENTITY_BASELINE_WINDOW_DAYS` | 30 |
| `ENTITY_TRACKED_ACCEL_RATIO` | 2.0 |
| `ENTITY_TRACKED_MIN_ACTIVE` | 3 |
| `ENTITY_EMERGING_COLDSTART_MIN` | 3 |
| `ENTITY_EMERGING_MIN_DISTINCT_SIGNALS` | 2 |
| `ENTITY_THEME_RELEVANCE_BAND` | 50 |
| `ENTITY_LANE_MAX_ITEMS` | 10 |

**And** constants are imported only by read-path lane logic (not write path)

### AC2 — Result validators (§5.2)

**Given** `convex/validators.ts`  
**When** query validators are added  
**Then** export:

- `entityReasonValidator` — `code` union: `acceleration | cold_start | cross_source | new_source | theme_adjacent | co_mentioned | high_priority_source` + `detail: string`
- `entityLaneItemValidator` — fields per §5.2 (`entityKey`, `entityType`, `displayName`, `platform?`, `activeCount`, `baselineDailyRate`, `sourceTypes`, `momentumSummary`, `reasons[]`, `evidence[]`)
- `entityIntelligenceResultValidator` — `{ trackedInMotion: entityLaneItemValidator[], emergingToReview: entityLaneItemValidator[], runDate?: string }` (extend if UX needs run meta — keep minimal)

**And** `evidence[]` reuses `entityMentionSignalRefValidator` from 73-1

### AC3 — `getEntityIntelligence` query (§5.1, ADR-E73-004/005/007)

**Given** `entityMentions` rows exist in baseline window  
**When** `getEntityIntelligence({ now, workspaceId? })` runs  
**Then**:

1. `windowStart = now - ENTITY_BASELINE_WINDOW_DAYS`; `activeStart = now - ENTITY_ACTIVE_WINDOW_DAYS`
2. Load rows: `entityMentions.withIndex('by_ranAt', q => q.gte('ranAt', windowStart)).collect()`
3. Optional `workspaceId` filter when arg provided
4. Group by `entityKey` → compute per entity: `activeCount`, `activeRate`, `baselineDailyRate`, `sourceTypes`, `tracked`, `maxPersonalRelevance`, co-mention data, evidence refs
5. **Tracked lane:** `tracked === true` AND `activeRate >= ENTITY_TRACKED_ACCEL_RATIO × baselineDailyRate` AND `activeCount >= ENTITY_TRACKED_MIN_ACTIVE`
6. **Emerging lane (ADR-E73-005):**
   - **(4a) Cold-start:** no baseline snapshots older than active window AND `activeCount >= ENTITY_EMERGING_COLDSTART_MIN` AND distinct signals `>= ENTITY_EMERGING_MIN_DISTINCT_SIGNALS`
   - **(4b) Low-baseline traction:** not tracked, thin baseline, acceleration by same ratio rule
7. Attach `reasons[]` per ADR-E73-004/005 (acceleration, cold_start, cross_source, new_source, theme_adjacent, co_mentioned, high_priority_source as applicable)
8. Compute `momentumSummary` human string (e.g. `"12 mentions / 7d vs 1.3/wk baseline (≈4×)"`)
9. Rank lanes; slice each to `ENTITY_LANE_MAX_ITEMS`

**And** `now` is **required from client** — **never** `Date.now()` inside query handler (Convex reactivity rule)  
**And** no signal re-extraction — reads snapshots only (ADR-E73-002)  
**And** grouping/threshold math only — not 5-dimension scoring engine

### AC4 — Empty and sparse history (§8)

**Given** no rows in window or early-days sparse baselines  
**When** query runs  
**Then** returns empty arrays for both lanes (not error)  
**And** cold-start path dominates when no baseline history exists

### AC5 — Tests (§11)

**Given** `cns-dashboard/tests/convex/entityIntelligence.test.ts` (extend 73-1 file or same module)  
**When** `npm test` runs  
**Then** additional cases cover:

- Tracked acceleration fixture (ratio above threshold, min active met) → tracked lane
- Cold-start fixture (zero prior history + N active appearances) → emerging lane with `cold_start` reason
- Low-baseline traction → emerging lane
- Theme adjacency reason when `maxPersonalRelevance >= ENTITY_THEME_RELEVANCE_BAND`
- `co_mentioned` reason when `coMentionedTrackedEntities` present on snapshots
- Threshold edge: active count one below `MIN_ACTIVE` → excluded
- `ENTITY_LANE_MAX_ITEMS` slice — 12 candidates → 10 returned
- `now` passed as arg — deterministic across two calls with same `now`

**And** `bash scripts/verify.sh` passes

### AC6 — Out of scope (explicit)

- `getEntityIntelligenceHealth` (73-8)
- Dashboard Svelte modules (73-6)
- Digest markdown (73-7)
- Node extraction/orchestrator (73-2–73-4)
- WriteGate / vault

## Tasks / Subtasks

### Prerequisite gate

- [x] **T0 — Dependency check**
  - [x] T0.1 Confirm 73-1: `entityMentions` table + validators exist
  - [x] T0.2 Seed test data via `recordEntityMentions` in convex-test

### Constants + validators

- [x] **T1 — `constants.ts`** (AC: 1)
  - [x] T1.1 Add ENTITY_* constants block with `[TUNABLE v1]` comment

- [x] **T2 — Validators** (AC: 2)
  - [x] T2.1 `entityReasonValidator`, `entityLaneItemValidator`, `entityIntelligenceResultValidator`

### Query implementation

- [x] **T3 — Lane logic** (AC: 3, 4)
  - [x] T3.1 Consider `convex/lib/entity_intelligence.ts` for pure grouping helpers (thin query wrapper)
  - [x] T3.2 `getEntityIntelligence` in `entityIntelligence.ts`
  - [x] T3.3 `computeBaselineDailyRate`, `computeActiveMetrics`, `buildReasons`, `formatMomentumSummary`
  - [x] T3.4 `focusKeyword` theme overlap — reuse `normalizeDigestKeyword` / `keywordsMatch` pattern from `digest.ts` if run-level keyword needed (read `digestRuns` for focusKeyword by ranAt in window OR persist on snapshots — prefer snapshot `maxPersonalRelevance` + optional run join only if required by ADR-E73-004)

### Tests

- [x] **T4 — Convex tests** (AC: 5)
  - [x] T4.1 Fixture rows inserted at controlled `ranAt` offsets from `now` arg
  - [x] T4.2 Extend `tests/convex/entityIntelligence.test.ts`
  - [x] T4.3 `bash scripts/verify.sh`

## Dev Notes

### Prerequisite gate

| Story | Delivers | Blocks this story |
|-------|----------|-------------------|
| **73-1** | Table + mutations | **Yes** (schema) |
| **73-4** | Live snapshot writes | Soft (tests use fixtures) |
| **Blocks** | **73-6**, **73-7** | **Hard** |

### Architecture compliance

- **ADR-E73-006:** Thresholds in `constants.ts` only
- **ADR-E73-007:** Single read query — dashboard + digest share this
- **ADR-E73-004:** Theme adjacency from persisted `maxPersonalRelevance` on snapshots (+ focusKeyword if implemented)
- **ADR-E73-005:** Separate tracked vs emerging detection models
- **Convex rule:** No `Date.now()` in query — client passes `now`

### Files to READ before editing (mandatory)

| File | Current state | Preserve / reuse |
|------|---------------|------------------|
| `cns-dashboard/convex/digest.ts` | `getDigestSourceHealth`, keyword normalize helpers | Derived query pattern |
| `cns-dashboard/convex/lib/digest_source_registry.ts` | Pure health derivation | Lib extraction pattern |
| `cns-dashboard/convex/entityIntelligence.ts` | 73-1 mutations | Add query alongside |
| `cns-dashboard/convex/validators.ts` | `entityMention*` validators from 73-1 | Extend with lane validators |
| `cns-dashboard/tests/convex/digest-source-health.test.ts` | Derived query tests | convex-test harness |

### Lane computation sketch (§5.1)

```typescript
// Pseudocode — implement in lib helper
const rows = await ctx.db.query('entityMentions')
  .withIndex('by_ranAt', q => q.gte('ranAt', windowStart))
  .collect();

// Split rows into active vs baseline buckets by ranAt relative to now
// Group by entityKey
// For each entity: baselineDailyRate = baselineMentionCount / BASELINE_WINDOW_DAYS
// activeRate = activeMentionCount / ACTIVE_WINDOW_DAYS
// Apply tracked vs emerging rules → reasons → rank → slice
```

### UX contract alignment (73-6)

Downstream expects:

- `trackedInMotion[]`, `emergingToReview[]` (confirm exact property names in validator — match EXPERIENCE.md / 73-6 story)
- `EntityLaneItem.evidence` = signal refs
- `reasons[].code` drives chip labels client-side

### New / modified files (expected)

```
cns-dashboard/convex/constants.ts          (modified)
cns-dashboard/convex/validators.ts       (modified)
cns-dashboard/convex/entityIntelligence.ts (modified)
cns-dashboard/convex/lib/entity_intelligence.ts  (new, optional)
cns-dashboard/tests/convex/entityIntelligence.test.ts (extended)
```

### Testing requirements

- Use fixed `now` ms timestamp in all query tests
- Insert `entityMentions` via mutation in test setup
- Do not duplicate lane math in Omnipotent.md tests

### References

- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §5, §11, ADR-E73-004–007]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/EXPERIENCE.md` — `getEntityIntelligence` subscription]
- [Source: `_bmad-output/implementation-artifacts/73-6-dashboard-entity-intelligence-modules.md` — consumer contract]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- Implemented pure lane math in `convex/lib/entity_intelligence.ts`; thin `getEntityIntelligence` query wrapper reads `by_ranAt` index only.
- Theme adjacency uses persisted `maxPersonalRelevance` on snapshots per ADR-E73-004 — no LLM, no `digestRuns` join, no free-text matching.
- Tracked lane does not exclude already-tracked entities; acceleration vs baseline is the gate per PRD correction.

### Completion Notes List

- Added `[TUNABLE v1]` ENTITY_* thresholds to `constants.ts` (ADR-E73-006).
- Exported lane validators (`entityReasonValidator`, `entityLaneItemValidator`, `entityIntelligenceResultValidator`) reusing `entityMentionSignalRefValidator`.
- Shipped `getEntityIntelligence({ now, workspaceId? })` with required client `now`, two-lane detection (tracked acceleration + emerging cold-start/low-baseline), reasons, momentum summaries, ranking, and `ENTITY_LANE_MAX_ITEMS` slice.
- Extended convex tests: tracked acceleration, cold-start, low-baseline, theme_adjacent, co_mentioned, MIN_ACTIVE edge, lane slice, deterministic `now`.
- `bash scripts/verify.sh` passes (Omnipotent.md + cns-dashboard).

### File List

- cns-dashboard/convex/constants.ts (modified)
- cns-dashboard/convex/validators.ts (modified)
- cns-dashboard/convex/entityIntelligence.ts (modified)
- cns-dashboard/convex/lib/entity_intelligence.ts (new)
- cns-dashboard/tests/convex/entityIntelligence.test.ts (modified)

### Change Log

- 2026-06-21: Story 73-5 — `getEntityIntelligence` derived query, tunable thresholds, lane validators, lane math tests (cns-dashboard only).
- 2026-06-21: Code review — ADR-E73-004 v1 scope amendment; distinct-signal union fix; 6 test patches applied.

### Review Findings

- [x] [Review][Decision] ADR-E73-004 `focusKeyword` path omitted from `theme_adjacent` — **Resolved:** amended ADR-E73-004 with v1 scope note (personalRelevance-only on read path; focusKeyword deferred to v1.1).

- [x] [Review][Patch] Cold-start `activeDistinctSignals` sums per-run counts instead of unioning signal IDs [`cns-dashboard/convex/lib/entity_intelligence.ts:94`]

- [x] [Review][Patch] No round-trip test from 73-3 `buildEntityMentionPayload()` through `getEntityIntelligence` [`cns-dashboard/tests/convex/entityIntelligence.test.ts`]

- [x] [Review][Patch] Weak validator shape assertion [`cns-dashboard/tests/convex/entityIntelligence.test.ts:328`]

- [x] [Review][Patch] Missing negative test for required `now` arg [`cns-dashboard/convex/entityIntelligence.ts:157`]

- [x] [Review][Patch] No test for `high_priority_source` reason [`cns-dashboard/convex/lib/entity_intelligence.ts:219`]

- [x] [Review][Patch] No test for optional `workspaceId` filter [`cns-dashboard/convex/lib/entity_intelligence.ts:337`]

- [x] [Review][Defer] `ENTITY_HIGH_PRIORITY_RANK_SCORE = 70` is a 9th constant outside ADR-E73-006 eight-row table [`cns-dashboard/convex/constants.ts:25`] — deferred, acceptable v1 companion threshold centralized in constants.ts
