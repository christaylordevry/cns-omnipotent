---
story_id: BD-9
epic: cns-redesign-build-deps
title: known-entity-read-path-for-nexus-entity-narrative
status: ready-for-dev
created: 2026-07-23
operator_brief: 2026-07-23
predecessors: 73-5, 73-8, BD-3, BD-6
blocks: scenario-02-eric-entity-narrative
design_gate: SPLIT_2026-07-23
gate_a_exposure: READY_FOR_DEV
gate_b_confidence: PROPOSE_THEN_STOP
gate_a_covers: AC1, AC2, AC4, AC5, AC6-exposure, AC7, AC8
gate_b_covers: AC3, AC3-calibration, AC6-confidence
design_gate_note: LOGGED_IN_IA covers BD-6 entity-home only — NOT Confidence weights/caps (scoring-model-spec is PROPOSAL, not approved)
implementation_repo: cns-dashboard
implementation_branch: cns-redesign
story_ssot: Omnipotent.md/_bmad-output/implementation-artifacts/BD-9-known-entity-read-path.md
not_epic_89: true
---

# Story BD-9: Known-entity read path for Nexus entity narrative

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created.
     Placement: cns-redesign-build-deps (NOT Epic 89). Epic 89 = digest source-shaping only.
     Amended 2026-07-23: split gate (exposure vs Confidence), restore same-family cap 65, calibration stop. -->

## Story

As a **CNS operator deepening from an S01 Dig into a known actor**,
I want **Convex queries that return known-entity aggregates and a tracked/known roster — not motion lanes**,
so that **Scenario 02 (entity narrative + Confidence home) can render steady tracked actors with honest evidence arcs even when `trackedInMotion` is empty**.

## Review Gate — SPLIT (amended 2026-07-23)

Same discipline as **90-4 / 90-5**: exposure that unblocks the product ships; scoring constants do not lock without operator approval + live evidence.

| Gate | Status | Covers | Rule |
|------|--------|--------|------|
| **A — Exposure** | **READY FOR DEV** | AC1, AC2, AC4, AC5, AC6-exposure, AC7, AC8 | Pure exposure of `aggregateEntityRows` — **the Scenario 02 unblock**. No scoring risk. Implement and ship. |
| **B — Confidence** | **PROPOSE-THEN-STOP** | AC3, AC3-calibration, AC6-confidence | Implement derive behind the **agreed shape** (formula + **all three** caps + family map). **Do NOT finalise weights/caps** until operator approval after calibration evidence. |

`design_gate: LOGGED_IN_IA` / BD-6 settles **entity-home only** (Confidence is an entity property, never per-signal). It does **not** approve weights. Source: `scoring-model-spec.md` — **Status: PROPOSAL, not approved** · "not a green light to code" · weights MUST go through propose-then-stop.

| Decision | Value | Source |
|----------|-------|--------|
| **Problem** | Lane-only public API cannot serve known-entity narrative | `grounding-verdict.md` BD-9 |
| **Fix shape** | Expose existing aggregation — do **not** rebuild | `ia-entities.md` BD-9; operator brief |
| **Confidence home** | Entity property on this path; never per-signal | BD-3 RESOLVED · BD-6 LOGGED (**Gate B shape**, not weight approval) |
| **Confidence weights/caps** | Provisional `[TUNABLE v1]` until Gate B unlock | `scoring-model-spec.md` PROPOSAL |
| **Emergence chrome** | Out of scope (BD-7 standing rule) | S02 IA scope note |
| **Repo** | **cns-dashboard** owns Convex | Epic 73 ADRs; verified 2026-07-23 |

### Placement correction (operator brief said "Epic 89 lane")

| Claim | Reality |
|-------|---------|
| Epic 89 | Digest source-shaping (`89-1`…`89-3`) — **wrong bucket** |
| Correct epic key | `cns-redesign-build-deps` (same register as BD-4) |
| Story key | `BD-9-known-entity-read-path` |

---

## Context

### Repo ownership (verified 2026-07-23)

| Layer | Owner | Path |
|-------|-------|------|
| Schema, validators, queries, lane/aggregate math | **cns-dashboard** | `convex/entityIntelligence.ts`, `convex/lib/entity_intelligence.ts`, `convex/validators.ts`, `convex/constants.ts` |
| Write-path extraction / digest HTTP consumers | Omnipotent.md | Hermes `analyze-entity-intelligence.mjs` → mutations; digest reads **lane** query (preserve) |
| Consuming UI (Scenario 02 surface) | cns-dashboard | `/nexus/entities` — **out of BD-9 code scope**; blocked until this API ships |
| Story SSOT | Omnipotent.md | `_bmad-output/implementation-artifacts/BD-9-*.md` (BD-4 pattern) |
| Omnipotent.md `convex/` | **Does not exist** on `hermes-consolidation` | Do not create a mirror |

**Implement only in `cns-dashboard` on branch `cns-redesign`.** Omnipotent.md changes for this story: story file + sprint-status only (plus verify gate that runs sibling dashboard tests).

### Problem (measured against Convex prod 2026-07-23 — not assumed)

Deployment: `amiable-ox-862`. Method: `getEntityIntelligenceHealth` / `getEntityIntelligence` + readonly aggregate over `entityMentions` (30d baseline / 7d active).

| Surface | Live result | Job |
|---------|-------------|-----|
| Motion lanes | `trackedCount=0`, `emergingCount=1` | Acceleration / cold-start discovery |
| Known entities | 82 distinct · 49 active · 15 baseline+active · 2 multi-source (Mollick bluesky+twitter; Altman rss+twitter) | Narrative + Confidence |

**Why lanes miss narrative actors:** `ENTITY_TRACKED_ACCEL_RATIO = 2.0`. Mollick at active 6 / baseline 24 is **correctly** absent from `trackedInMotion` while being exactly what S02 must show. A lane-only API cannot serve the surface no matter how the UI is written.

### What already exists (do not reinvent)

Private in `cns-dashboard/convex/lib/entity_intelligence.ts`:

- `EntityAggregate` type — identity, `tracked`, `activeCount` / `baselineCount`, `activeSourceTypes` / `baselineSourceTypes`, `activeDistinctSignalIds`, `evidence`, `maxRankScore`, top-evidence pointers, rates inputs
- `aggregateEntityRows(rows, now)` — builds the full map
- `buildEntityIntelligenceFromRows` — **filters** that map down to lane-qualified items only
- Public today: `getEntityIntelligence` / `getEntityIntelligenceHealth` → lanes only

**Gap = query exposure + return shape** (Gate A). Confidence derive is Gate B (propose-then-stop). Not missing mention data. Not new aggregation.

### Design references (read — do not re-derive)

- `cns-dashboard/_bmad-output/C-UX-Scenarios/02-eric-entity-narrative/ia-entities.md` — BD-9 entry, quiet-day contract, Confidence on row/arc
- `cns-dashboard/_bmad-output/C-UX-Scenarios/02-eric-entity-narrative/grounding-verdict.md` — measurement + live numbers
- `cns-dashboard/_bmad-output/_progress/00-design-log.md` — BD-9 logged; S02 scoped to known-entity
- `cns-dashboard/_bmad-output/A-Product-Brief/scoring-model-spec.md` — Confidence formula **PROPOSAL, not approved** — Gate B input only; not a green light to lock weights

---

## Acceptance Criteria

### Gate A — Exposure (ready-for-dev · Scenario 02 unblock)

### AC1 — `getEntityAggregate(entityKey)` known-entity read

**Given** `entityMentions` rows for a known key (e.g. tracked Mollick with active+baseline, fails accel gate)
**When** client calls `entityIntelligence:getEntityAggregate({ now, entityKey, workspaceId? })`
**Then** return a validated object including at least:
- Identity: `entityKey`, `entityType`, `displayName`, `platform?`, `tracked`
- Volume / arc: `activeCount`, `baselineCount`, `baselineDailyRate`, `activeRate` (or equivalent documented rates), `momentumSummary`
- Diversity: `sourceTypes` (active-window), optionally `baselineSourceTypes`
- Depth: `distinctSignalCount` (union of active-window signal IDs), `evidence` (≤5 `entityMentionSignalRef`s, same top-evidence ranking as lanes)
- Salience: `maxRankScore` (active window peak)
- `latestActiveDate?` / runDate-adjacent fields as needed for UI
**And** the entity appears even when it would **not** qualify for `trackedInMotion` / `emergingToReview`
**And** client **must** pass `now` (never `Date.now()` inside the query)
**And** Gate A does **not** require Confidence fields — those land under AC3 (Gate B). If Gate B code is merged in the same PR, Confidence fields may be present as **provisional** (`[TUNABLE v1]` / not-yet-approved); they must not be treated as locked product scores until Gate B unlocks.

### AC2 — Known / tracked roster ≠ motion lanes

**Given** the same window load as lane queries
**When** client calls `entityIntelligence:getKnownEntityRoster({ now, workspaceId?, entityKeys? })`
**Then**:
- **Default membership** (`entityKeys` omitted): entities with `tracked === true` that have any mention in the baseline window (active and/or baseline) — **no** acceleration gate, **no** emerging cold-start gate
- **Override membership** (`entityKeys` provided): return aggregates for those keys that exist in-window (Dig/inspector-linked actors); omit missing keys (do not fabricate)
- Sort interim: diversity → depth → volume (IA §Selection) — **not** emergence-lift / accel ratio
- Each row carries the same Gate A identity / lift / sourceTypes / evidence summary as AC1 (full arc fields may live only on `getEntityAggregate`)
**And** roster is **explicitly not** `trackedInMotion` / `emergingToReview`
**And** empty roster returns `[]` / honest empty result — not an error
**And** Confidence on roster rows follows the same Gate B rule as AC1 (optional/provisional until unlocked)

### AC4 — Honest emptiness (quiet-day substrate)

**Given** thin/empty entities (no active mentions, or missing `entityKey`)
**When** aggregate / roster queries run
**Then**:
- Missing key → `null` (aggregate) or omitted from roster — not a synthetic multi-source row
- Thin / zero-active evidence → honest empty or sparse fields — **never** fabricated corroboration or invented `sourceTypes`
- When Gate B Confidence is present: thin evidence → low provisional Confidence + honest `whyNotHigher` — still never fabricate sources
- Existing lane queries may still return empty `trackedInMotion` — that remains correct; BD-9 does not “fix” lanes by relaxing accel

### AC5 — Preserve lane API contract (no digest / Epic 90 blast radius)

**Given** existing consumers of `getEntityIntelligence` / `getEntityIntelligenceHealth` (dashboard modules, Hermes awareness entities section, digest entity sections)
**When** BD-9 ships
**Then**:
- Lane query return validators **unchanged** in shape (additive fields elsewhere only)
- Lane qualification math **unchanged** (`ENTITY_TRACKED_ACCEL_RATIO`, emerging rules)
- **Do not** touch digest scorer, dedupe, Epic 90 intake paths, or `digest-signal-contract.json`
- **OPS-2:** entity validators are **out of OPS-2 scope** (OPS-2 = digestSignals field-set only). Adding entity return validators does **not** require `generate:digest-signal-contract`. If you edit `validators.ts`, do not disturb digestSignal field sets / contract extraction.

### AC6-exposure — Tests for Gate A (cns-dashboard)

**Given** `tests/convex/entityIntelligence.test.ts` patterns (fixed `now`, seed via `recordEntityMentions`)
**When** Gate A completes
**Then** coverage includes at least:
1. Tracked steady actor (active+baseline, fails accel) **absent** from lanes **present** in roster + aggregate
2. `getEntityAggregate` miss → `null`
3. `entityKeys` filter returns only requested keys
4. Empty window / empty tracked set → empty roster, no throw
5. Existing lane tests still pass (no regression)

### AC7 — Verify gate

**Given** sibling `cns-dashboard` present
**When** `bash scripts/verify.sh` runs from Omnipotent.md
**Then** exit 0 (CNS tests + dashboard `npm test`)

### AC8 — Scope boundary (UI out)

**Given** Scenario 02 surface work (`/nexus/entities` remount, zone chrome)
**When** Gate A is done
**Then** Scenario 02 UI may consume aggregate/roster APIs — UI remount remains a **follow-on** story
**And** Dev Agent Record notes the export/API names the UI should call
**And** UI must not present provisional Confidence as final trust chrome until Gate B unlocks (or omit Confidence chrome until then)

---

### Gate B — Confidence (PROPOSE-THEN-STOP · same discipline as 90-4 / 90-5)

### AC3 — Confidence is an entity property (BD-3 / BD-6 home · weights NOT approved)

**Given** aggregates with different diversity / family structure (live discriminators: Mollick, Altman, Karpathy)
**When** Confidence is derived at **read time**
**Then** implement behind this **agreed shape** (provisional `[TUNABLE v1]` — **not locked**):

```
Confidence = 100 × (0.40·D + 0.35·E + 0.25·Q)

D = min(1, distinctActiveSourceTypes / 3)     // source diversity
E = min(1, distinctActiveSignalIds / 10)      // evidence depth
Q = min(1, max(0, maxRankScore) / 100)        // evidence salience proxy

Caps (apply after raw score; lowest binding cap wins) — ALL THREE from scoring-model-spec:
- distinctActiveSourceTypes === 1 → cap 55
- distinctActiveSignalIds === 1 → cap 45
- all active sourceTypes map to the SAME source family → cap 65   // LOAD-BEARING — was missing in first BD-9 draft
```

**Source-family map** — define explicitly in `convex/constants.ts` as `[TUNABLE v1]`, e.g.:

```
ENTITY_SOURCE_FAMILIES = {
  microblog: ['twitter', 'bluesky', 'threads', 'mastodon'],
  // extend as needed: rss, github, youtube, reddit, … each as own family or grouped per operator tune
}
```

Family resolution: map each active `sourceType` → family id; if every mapped family is identical → apply cap 65. Unmapped `sourceType` = its own singleton family (so unknown types do not falsely share a family).

**Why this cap is load-bearing:** Ethan Mollick (bluesky + twitter) is **same-family microblogging**. Without cap 65 he scores as fully corroborated and becomes indistinguishable from Sam Altman (rss + twitter), who has **genuine cross-family** corroboration. Cap 65 is exactly what makes Confidence discriminate for the right reason; dropping it ships false precision on the trust surface.

- `whyNotHigher` must name the binding cap, including family when it binds — e.g. `"2 sources but both microblog — corroboration capped at 65"` or `"single source (twitter) caps Confidence at 55"` — never invent extra sources
- Confidence appears **only** on known-entity DTOs from this story
- **Do not** add Confidence to `digestSignal*` validators, S01 signal cards, or per-signal payloads
- **Do not** persist Confidence on `entityMentions` (derive only)
- **STOP:** do **not** mark AC3 / weights / caps **approved** or remove the provisional flag until AC3-calibration passes operator review

### AC3-calibration — Live distribution evidence BEFORE weights lock

**Given** Gate B derive is implemented (provisional constants)
**When** derivation is run over the **live** known-entity population (≈82 distinct entities in the baseline window on prod `amiable-ox-862`, same method as `grounding-verdict.md`)
**Then** Dev Agent Record (or attached artifact) **must** paste:
1. **Full distribution** — at minimum: count, min/max/median/p25/p75 (or histogram buckets) of provisional Confidence across the population
2. **Named cases** with scores + binding cap / `whyNotHigher`:
   - Ethan Mollick (bluesky + twitter) — expect same-family **cap 65** binds
   - Sam Altman (rss + twitter) — expect **cross-family**; should rank **above** Mollick when discrimination is for the right reason
   - Andrej Karpathy (twitter-only / thin) — expect single-source / thin caps
3. Explicit verdict sentence: Confidence discriminates because **Altman > Mollick on cross-family corroboration**, **not** merely because multi-source > single-source
**And** operator reviews that paste before Gate B unlock
**And** until unlock: constants stay `[TUNABLE v1]` / provisional; product copy must not claim final Confidence

### AC6-confidence — Tests for Gate B (provisional until unlock)

**Given** Gate B code lands
**When** tests run
**Then** coverage includes (against provisional formula — update if operator retunes):
1. Same-family multi-source (bluesky+twitter) → Confidence ≤ 65; `whyNotHigher` names microblog / same-family cap
2. Cross-family multi-source (rss+twitter) → not bound by family cap 65 solely for being multi-source; scores **above** same-family fixture when other factors equal enough to show the gap
3. 1-source → Confidence ≤ 55; `whyNotHigher` mentions single-source
4. 1-evidence → Confidence ≤ 45 when that cap binds
5. No Confidence fields on digest signal validators / lane item validators

---

## Tasks / Subtasks

### Gate A — ship (AC: 1, 2, 4, 5, 6-exposure, 7, 8)

#### T1 — Export aggregate substrate

- [ ] Export (or add thin public wrappers around) `aggregateEntityRows` / a serializable aggregate DTO builder in `convex/lib/entity_intelligence.ts`
- [ ] Keep `buildEntityIntelligenceFromRows` lane path untouched
- [ ] Add `buildKnownEntityDto(aggregate)` / `buildKnownEntityRoster(aggregates, opts)` — **no** accel/emerging gates in roster path

#### T2 — Validators (exposure)

- [ ] Add `entityKnownItemValidator` / `entityAggregateResultValidator` (null union for miss) — Gate A fields only required
- [ ] Add `knownEntityRosterResultValidator` (`items: entityKnownItem[]`, `hasBaselineHistory`, `runDate?` as needed)
- [ ] Do **not** mutate `entityLaneItemValidator` / `entityIntelligenceResultValidator` / digestSignal validators

#### T3 — Public queries

- [ ] `getEntityAggregate` in `convex/entityIntelligence.ts` — same window load pattern as `getEntityIntelligence` (`by_ranAt` ≥ windowStart → `filterRowsByWorkspace` → aggregate → pick key)
- [ ] `getKnownEntityRoster` — same load; filter membership per AC2; sort per IA interim rule
- [ ] Args: required `now`; optional `workspaceId`; roster optional `entityKeys: string[]`
- [ ] `returns:` validators on both (Convex + project rules)

#### T4 — Tests + verify (Gate A)

- [ ] Extend `tests/convex/entityIntelligence.test.ts` with AC6-exposure cases
- [ ] Fixed `now`; no `Date.now()` in handlers under test
- [ ] Run `npm test` in cns-dashboard; then Omnipotent `bash scripts/verify.sh`

#### T5 — Deploy note (Gate A)

- [ ] Deploy Convex from `cns-dashboard` `cns-redesign` when ready (prod `amiable-ox-862`) so S02 UI story can subscribe
- [ ] Record query names + sample `npx convex run` smoke in Dev Agent Record
- [ ] Do **not** change Omnipotent digest push / Hermes dual-copy for this story

### Gate B — propose-then-stop (AC: 3, 3-calibration, 6-confidence)

#### T6 — Confidence derive (provisional — do not lock)

- [ ] Add `deriveEntityConfidence(aggregate)` implementing AC3 shape including **all three caps**
- [ ] Put weights, caps, and `ENTITY_SOURCE_FAMILIES` (microblog = twitter/bluesky/threads/mastodon, …) in `convex/constants.ts` as `[TUNABLE v1]` / clearly provisional
- [ ] Wire optional Confidence fields onto known-entity DTOs / validators (`entityConfidenceValidator`: score, D/E/Q, capsApplied[], whyNotHigher, `provisional: true` or equivalent doc flag until unlock)
- [ ] **STOP** — do not remove provisional marking; do not claim Gate B approved

#### T7 — Calibration evidence (required before unlock)

- [ ] Run derive over live ≈82-entity population on prod
- [ ] Paste distribution + Mollick / Altman / Karpathy named cases into Dev Agent Record (or `_bmad-output` artifact)
- [ ] Show Altman > Mollick for **cross-family** reason (not merely multi-source > single-source)
- [ ] Await operator approval → then retune if needed → only then mark AC3 weights locked / Gate B unlocked

#### T8 — Gate B tests

- [ ] AC6-confidence cases (same-family cap 65, cross-family above, single-source 55, thin evidence 45)
---

## Dev Notes

### Architecture compliance

- **Pure math in lib; thin query wrappers** — mirror 73-5 / Epic 69-3 health pattern.
- **Client passes `now`** — Convex queries must stay deterministic (no `Date.now()`).
- **Thresholds only in `constants.ts`** — Confidence weights/caps/families join ENTITY_* as `[TUNABLE v1]` and stay **provisional until Gate B unlock**.
- **Snapshots only** — do not re-scan `digestSignals` or re-score Hermes dimensions for Confidence; use aggregate fields already on mentions.
- **ADR-E73-005** — lanes stay dual-model; known-entity path is a **third read shape**, not a third lane.
- **Propose-then-stop (90-4/90-5 discipline)** — Gate A ships exposure; Gate B implements shape + calibration paste, then **STOP** for operator approval before locking weights.

### Current state of files being modified

| File | Today | BD-9 change |
|------|-------|-------------|
| `lib/entity_intelligence.ts` | Private `aggregateEntityRows` / `EntityAggregate`; public lane builder only | **Gate A:** export aggregate builders + roster. **Gate B:** `deriveEntityConfidence` (provisional) |
| `entityIntelligence.ts` | `getEntityIntelligence`, health, mutations | **Add** two queries; mutations unchanged |
| `validators.ts` | Lane + mention validators | **Add** known-entity validators; Confidence validator under Gate B; leave lanes + digestSignals alone |
| `constants.ts` | Lane thresholds | **Gate B:** Confidence weights/caps + `ENTITY_SOURCE_FAMILIES` (incl. microblog set) as `[TUNABLE v1]` |
| `tests/convex/entityIntelligence.test.ts` | Lane qualification suite | **Gate A** exposure cases; **Gate B** Confidence/cap cases (provisional) |

### What must be preserved

- Lane empty-when-steady behavior (Mollick not in `trackedInMotion`)
- `recordEntityMentions` / `replaceEntityMentionsForRun` / assert rules
- Hermes awareness entities section still lane-shaped unless a later story expands it
- Digest entity markdown path still consuming lane query

### Anti-patterns (will fail review)

| Anti-pattern | Correct |
|--------------|---------|
| Rebuild aggregation in the query handler | Call/export `aggregateEntityRows` |
| Relax accel ratio so lanes “include” known entities | Separate roster/aggregate queries |
| Lock Confidence weights without calibration + operator OK | Gate B propose-then-stop |
| Drop same-family cap 65 / treat bluesky+twitter as full corroboration | Cap 65 + `whyNotHigher` names microblog |
| Add `confidence` to signal list items / S01 cards | Entity DTOs only (BD-6) |
| Persist Confidence on `entityMentions` | Derive at read |
| Sort roster by accel / emerging lift | diversity → depth → volume |
| Touch `score-digest-signals.mjs` / dedupe / Epic 90 | Out of scope |
| Run OPS-2 contract regen for entity validators | Not applicable |
| Create Omnipotent.md `convex/` mirror | Dashboard only |
| Fabricate multi-source for thin entities | Honest caps + whyNotHigher |
| Use `Date.now()` in query | Required `now` arg |
| Claim LOGGED_IN_IA approved the weights | IA/BD-6 = entity-home only |

### Previous story intelligence (73-5 / 73-8)

- Cold-start distinct signals = **union of IDs**, not summed per-run counts — reuse same Sets on aggregate.
- Evidence top signal = highest `maxRankScore` + deterministic tie-break — reuse for aggregate evidence order.
- Health lane counts must continue to match `trackedInMotion.length` / `emergingToReview.length` — do not redefine health as roster sizes.
- Prod smoke: `npx convex run --prod entityIntelligence:getEntityAggregate '{"now": <ms>, "entityKey": "person:…"}'`.

### Git intelligence

- cns-dashboard EI landed on path history / `cns-redesign` (`2656912` 73-5, `cc1f59b` 73-8) — **no** `hermes-consolidation` branch on dashboard.
- Omnipotent `hermes-consolidation` holds digest/Hermes half of Epic 73 — **do not** implement BD-9 queries there.
- Nearby design commit on dashboard: `396eccb docs(s02): Phase 4 IA for Entity Narrative…`.

### Testing commands

```bash
# Implementation repo
cd ../cns-dashboard
npm test
# optional focused:
# npx vitest run tests/convex/entityIntelligence.test.ts

# Cross-repo gate (from Omnipotent.md)
bash scripts/verify.sh
```

### Project structure notes

- Story file SSOT: this repo (`Omnipotent.md`) under `_bmad-output/implementation-artifacts/`
- Dual sprint-status: update **both** Omnipotent + cns-dashboard `sprint-status.yaml` keys under `cns-redesign-build-deps`
- Spec cite: Epic 73 architecture remains normative for lanes; BD-9 is redesign build-dep additive — no conflict with `specs/cns-vault-contract/` (no WriteGate / vault_log_action)

### References

- [Source: cns-dashboard/_bmad-output/C-UX-Scenarios/02-eric-entity-narrative/ia-entities.md] — BD-9, quiet-day, Confidence home, roster membership
- [Source: cns-dashboard/_bmad-output/C-UX-Scenarios/02-eric-entity-narrative/grounding-verdict.md] — live prod numbers, lane vs narrative
- [Source: cns-dashboard/_bmad-output/A-Product-Brief/scoring-model-spec.md] — **PROPOSAL, not approved**; three caps including same-platform/family → 65; propose-then-stop required
- [Source: Omnipotent.md/_bmad-output/implementation-artifacts/73-5-get-entity-intelligence-query.md] — query patterns, `now`, lib split
- [Source: Omnipotent.md/_bmad-output/implementation-artifacts/BD-4-stamp-matched-watchlist-topic.md] — BD-* story / dual sprint-status pattern
- [Source: Omnipotent.md/_bmad-output/implementation-artifacts/90-4-dedupe-over-collapse-retune.md] / `90-5-…` — propose-then-stop discipline precedent
- [Source: cns-dashboard/convex/lib/entity_intelligence.ts] — private aggregate already complete
- [Source: cns-dashboard/convex/entityIntelligence.ts] — public lane queries today
- [Source: OPS-2 stories] — digestSignals contract only; do not regen for entity DTOs

### Deferred / follow-on (not Gate A)

- **Gate B unlock** — operator approval after AC3-calibration paste (weights/caps may retune)
- Scenario 02 UI remount of `/nexus/entities` (zones 02.1–02.4) — consumes Gate A; Confidence chrome waits on Gate B
- Emergence discovery chrome — BD-7
- Per-signal Confidence — rejected (BD-6)
- Expanding Hermes awareness entities section beyond lanes

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Calibration Evidence (Gate B — required before weight lock)

<!-- Paste: live ~82-entity Confidence distribution + Mollick / Altman / Karpathy with binding caps.
     Verdict must show Altman > Mollick on cross-family corroboration, not merely multi-source > single-source. -->

### File List

---

## Story completion status

- Status: **ready-for-dev** (Gate A)
- Gate B Confidence: **PROPOSE-THEN-STOP** — implement shape + calibration; do not lock weights without operator approval
- Amended 2026-07-23: split gate; restored same-family cap 65; calibration evidence required
- Implementation target: **cns-dashboard** (`cns-redesign`) only
- Blocks: Scenario 02 entity narrative surface implementation (unblocked by Gate A exposure)