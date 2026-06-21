---
title: Epic 73 — Nexus Entity Intelligence Architecture
status: complete
created: 2026-06-21
updated: 2026-06-21
epicScope: epic-73
workflowType: architecture
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
completedAt: 2026-06-21
project_name: CNS
user_name: Chris Taylor
inputDocuments:
  - _bmad-output/specs/spec-nexus-entity-intelligence/SPEC.md
  - _bmad-output/specs/spec-nexus-entity-intelligence/functional-requirements.md
  - _bmad-output/specs/spec-nexus-entity-intelligence/scope-boundaries.md
  - _bmad-output/specs/spec-nexus-entity-intelligence/architecture-agenda.md
  - _bmad-output/specs/spec-nexus-entity-intelligence/parent-session-constraints.md
  - _bmad-output/specs/spec-nexus-entity-intelligence/architecture-diagrams.md
  - _bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md
  - _bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md
  - _bmad-output/implementation-artifacts/68-2-people-watchlist-loader.md
  - cns-dashboard/convex/schema.ts
  - cns-dashboard/convex/validators.ts
  - cns-dashboard/convex/digest.ts
  - scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs
  - project-context.md
repos:
  analysisCompute: Omnipotent.md
  schemaPersistence: cns-dashboard
  operatorConfig: ~/.hermes
adrs:
  - ADR-E73-001
  - ADR-E73-002
  - ADR-E73-003
  - ADR-E73-004
  - ADR-E73-005
  - ADR-E73-006
  - ADR-E73-007
---

# Architecture: Epic 73 — Nexus Entity Intelligence

**Author:** Chris Taylor (architecture workflow)
**Date:** 2026-06-21
**Status:** Complete — normative for Epic 73 story authoring and implementation

## 0. Document Purpose

This architecture is the **normative technical contract** for Epic 73. It resolves the five open
design questions in `architecture-agenda.md` (Q1–Q5) as explicit ADRs and owns the schema, module,
and validation contracts that `/bmad-create-story` and `/bmad-dev-story` consume.

It does **not** re-litigate product scope, which is locked in `scope-boundaries.md`. Where the agenda
and the brownfield disagree, the brownfield wins and the divergence is logged (§13).

**Primary inputs:** `SPEC.md` + companions; the Epic 64 scoring-engine and Epic 67 signal-quality
architectures; the Epic 68-2 people-watchlist loader; and the live Convex schema/mutations in the
sibling `cns-dashboard` repo.

**Agenda → ADR map:**

| Agenda question | Resolved by | One-line decision |
|-----------------|-------------|-------------------|
| Q1 thresholds — who/when | ADR-E73-006 | Architecture sets tunable v1 defaults in one Convex `constants.ts` block; operator does not pre-decide |
| Q2 non-person entities | ADR-E73-003 | v1 ships person/account + GitHub org/repo entities from structured fields; company/product canonicalization deferred to v2 |
| Q3 theme adjacency | ADR-E73-004 | Maps to persisted `scores.personalRelevance` band + run `focusKeyword` + co-occurring `peopleMatch`; no LLM/NLP |
| Q4 cold-start | ADR-E73-005 | Emerging lane has its own no-baseline rule, distinct from acceleration |
| Q5 persistence | **ADR-E73-002** | **New persisted Convex table `entityMentions`** (per-run snapshots), not stateless aggregation |

---

## 1. System Context

### 1.1 Brownfield facts this architecture binds to

| Fact | Source | Implication for Epic 73 |
|------|--------|-------------------------|
| Compute lives in Omnipotent.md Node cron; Convex persists + serves; **no scoring in Convex** | ADR-E64-001 | Entity extraction is Node; Convex stores snapshots + serves a bounded derived read |
| `digestSignals` indexed **only** `by_digestRunId` | `cns-dashboard/convex/schema.ts` | Stateless N-day entity aggregation = full per-run collects on every read (see ADR-E73-002) |
| `digestRuns` indexed `by_date`, `by_ranAt` | schema.ts | Time-window scans key off `ranAt` |
| `sourceMetadata` already carries `author`, `authorHandle`, resolved `peopleMatch{personName,matchType}`, `contributingSources[]` | `validators.ts` | Structured entity surface — no free-text extraction needed for v1 |
| `scores.personalRelevance` + run `focusKeyword` persisted per signal | `validators.ts` | Deterministic theme-adjacency inputs (Q3) |
| Tracked-people membership = `~/.hermes/nexus-people.yaml` (≤30 people, handles per platform); 68-3 writes `peopleMatch` onto matched signals | Story 68-2/68-3 | "Tracked" lane membership derives from `peopleMatch`, not a new config |
| Canonical payload builder `buildDigestPushPayload(sources)` round-trips through input validators in `tests/morning-digest-build-payload.test.mjs` | `build-digest-push-payload.mjs` | Mirror this exactly for entity payloads (constraint) |
| `getDigestSourceHealth` **derives** health in a query (`inferenceMode: metadata|inferred`); no persisted health table | `digest.ts` | New health surface is a derived query, live-verified against prod (Epic 69-3 pattern) |
| Public-by-design mutations validate via input validator then insert | `digest.ts` | New `recordEntityMentions` follows the same shape |

### 1.2 Where Epic 73 sits in the pipeline

```
digest sources (≤19)  → buildDigestSignals → scoreDigestSignals (Epic 64/67/68)
   → build-digest-push-payload → createDigestRun + addDigestSignal (Convex)
   → [NEW] analyze-entity-intelligence (Node, post-push, read-free)
        → extract entities from this run's signals (structured fields only)
        → recordEntityMentions (Convex)  ← per-run, per-entity snapshots
   → [NEW] getEntityIntelligence (Convex derived read, bounded baseline window)
        → tracked-in-motion lane + emerging-to-review lane (reasons + evidence)
   → Nexus dashboard (reactive) + morning digest sections (one-shot HTTP read)
```

**Zero new external adapters.** The analysis stage consumes only signals already collected and pushed.

### 1.3 Repo boundary

| Layer | Repo | Responsibility |
|-------|------|----------------|
| Entity extraction (write path) | Omnipotent.md | `analyze-entity-intelligence.mjs`, `build-entity-mention-payload.mjs` |
| Schema + persistence + derived read | cns-dashboard | `entityMentions` table, validators, `recordEntityMentions` mutation, `getEntityIntelligence` + health queries, thresholds in `constants.ts` |
| Dashboard modules | cns-dashboard | Two read-only modules consuming `getEntityIntelligence` |
| Digest sections | Omnipotent.md | Morning-digest reads `getEntityIntelligence` once over HTTP |
| Tracked membership | ~/.hermes | `nexus-people.yaml` (unchanged; reused via `peopleMatch`) |

---

## 2. Architecture Decision Records

### ADR-E73-001 — Entity extraction runs as a Node analysis stage, post-push, with no live Convex reads

**Status:** Accepted
**Context:** Epic 73 is explicitly an analysis stage on already-collected signals (CAP-6, FR6), not a
new adapter. ADR-E64-001 fixes the boundary: compute in Node cron, Convex persists and serves; the
Epic 64 scoring hot path performs **no live Convex reads** during cron.
**Decision:** A new Node module `analyze-entity-intelligence.mjs` runs **after** the digest push
completes, operating on the in-memory pushed run (the same `signals[]` produced by
`buildDigestPushPayload`). It extracts entities from structured fields and **writes** per-run snapshots
to Convex via one batched mutation. It performs **no Convex reads** — baseline comparison is a
read-side concern (ADR-E73-002 read path), so the write path stays a pure, deterministic projection of
the current run.
**Consequences:**
- The stage cannot fail the digest: on any error it logs to stderr and exits 0 (mirrors Epic 64 §9
  fire-and-forget).
- All entity-extraction logic lives in exactly one place (Node write path); the read path never
  re-extracts, eliminating the cross-repo logic-duplication that caused this cycle's registry-drift
  incidents.

---

### ADR-E73-002 — Entity-mention history is a NEW persisted Convex table (`entityMentions`), not stateless aggregation  ⟵ Q5

**Status:** Accepted — **highest-stakes decision; explicit over alternatives**
**Context (Q5):** "Acceleration vs. baseline" cannot be computed as a fresh-every-time stateless query
over `digestSignals`: a baseline requires stored entity-mention activity over time. The agenda asks
whether this needs a new lightweight Convex table versus a stateless live-aggregation query.

**Options considered:**

- **Option A — Stateless live aggregation.** On each read, scan all `digestRuns` in the baseline
  window (`by_ranAt`), `collect()` every run's `digestSignals` (`by_digestRunId`), re-extract entities,
  and aggregate per entity.
- **Option B — Persisted per-run entity-mention snapshot table (CHOSEN).** The Node stage records one
  compact `entityMentions` row per (entity, run); reads are indexed lookups over snapshots.

**Decision: Option B.** Add a new Convex table `entityMentions` (§3). Per-run snapshots are written by
the Node stage (ADR-E73-001); the dashboard and digest read a bounded derived query over snapshots
(ADR-E73-007). The persisted layer stores **mention counts and trend baselines only** — never
approved/dismissed suggestion state (FR5). Suggestions remain derived and read-only.

**Why Option B wins (decisive factors):**

1. **Boundary + drift (the operator's bound constraint).** Option A forces entity extraction logic
   into a Convex query — duplicating the Node extractor across two repos and putting compute in Convex,
   violating ADR-E64-001. That is precisely the validator/registry-drift class flagged from three
   incidents this cycle. Option B keeps extraction in one Node module and persistence/serving in Convex.
2. **Index + cost.** `digestSignals` is indexed only `by_digestRunId`. Option A is
   O(runs_in_window × signals_per_run) re-extracted on **every** reactive read; the existing
   `getPriorDigestSignalsForTopic` already shows full per-run `collect()` is only tolerated for a single
   topic capped at 2 priors. Applying that to the entire entity space on every dashboard render breaks
   reactive-query cost discipline. Option B reads compact snapshot rows via `by_entityKey` / `by_ranAt`.
3. **History durability.** Baselines must outlive raw-signal retention. If `digestSignals` are archived
   or pruned, Option A loses all baseline. Option B is a compact, durable intelligence layer decoupled
   from raw-signal lifecycle.
4. **Determinism / stability.** Option B captures the baseline as a stable snapshot at run time; Option
   A jitters as data changes and as "now" advances mid-day.

**Consequences:**
- Confirms the spec's own reasoning: this feature moves from a pure stateless read stage to one with a
  persisted intelligence layer.
- New schema surface: one table, one input validator, atomic `replaceEntityMentionsForRun`, and two
  read queries (§3, §7).
- Every field must round-trip through the real `entityMentionInputValidator` via a canonical fixture
  `buildEntityMentionPayload()` (ADR-E73-007).

**Re-analysis idempotency — transactional clear-then-write (locked here, not deferred to dev-story):** when a
`digestRunId` is re-analyzed, the stage **deletes all prior snapshots for that run, then writes the
freshly built set in one Convex mutation** (§4.3). The transaction also runs for an empty fresh set,
and any validation or insert failure rolls the deletion back. A no-op-if-exists strategy is rejected: a re-collect can produce a
*different* signal set for the same `digestRunId`, so a surviving stale snapshot would silently feed
wrong mention counts into the baseline/acceleration math that is the entire point of this table.
Correctness of the persisted intelligence layer outweighs a redundant delete+insert on the common
force-rescore-without-recollect case, where clear-then-write and no-op produce identical output anyway.
Persistence remains counts/baselines only — never approved/dismissed state (FR5).

---

### ADR-E73-003 — v1 entity model = person/account + GitHub org/repo from structured fields; company/product canonicalization is v2  ⟵ Q2

**Status:** Accepted
**Context (Q2):** "Broader than people-only" must be a concrete v1 mechanism, not a principle, while
staying inside the structured-field-only constraint (no free-text extraction).
**Decision:** v1 extracts a **type-tagged** entity from existing structured fields only:

| `entityType` | Source field(s) | Key construction |
|--------------|-----------------|------------------|
| `person` | `sourceMetadata.peopleMatch.personName` (already resolved against `nexus-people.yaml` by 68-3) | `person:<normalized personName>` (canonical; bridges a person's handles) |
| `account` | `sourceMetadata.authorHandle` (twitter/bluesky/threads/linkedin), else `sourceMetadata.author` (rss/youtube/tiktok/instagram/pinterest) | `account:<platform>:<normalized handle-or-author>` |
| `org` | GitHub `url` owner segment (`github.com/<owner>/<repo>`) | `org:github:<normalized owner>` |

- **Cross-platform identity linking stays out of scope** (scope-boundaries): `account:twitter:karpathy`
  and `account:bluesky:karpathy.bsky.social` are distinct unless both resolve to the same
  `peopleMatch.personName`, in which case the `person:` entity is the canonical bridge for the tracked lane.
- **ProductHunt maker / general company canonicalization = v2.** ProductHunt signals carry only
  `votesCount`→`upvotes` (no maker field in `sourceMetadata`), so org extraction there is deferred. Do
  not overpromise: in v1 the **emerging** lane is where orgs/repos appear; the **tracked** lane is
  people-centric because the watchlist (`nexus-people.yaml`) is people-only.
**Consequences:**
- Extraction is fully deterministic; no NLP, no LLM.
- The model is type-extensible: adding `org`/`product` sources later is a new extractor branch + (if
  needed) a new `entityType` literal, no redesign.

---

### ADR-E73-004 — "Co-mentioned with tracked themes" maps to persisted `personalRelevance` + `focusKeyword` + co-occurring `peopleMatch`  ⟵ Q3

**Status:** Accepted
**Context (Q3):** The phrase appears in FR2/FR4 and must resolve to an existing structured field, or it
quietly reopens the LLM/NLP dependency (Risk 4).
**Decision:** Theme/entity adjacency is computed from data already persisted on each `digestSignal` — no
new scoring, no free text:

- **Theme adjacency** of an entity's signal := `signal.scores.personalRelevance >= ENTITY_THEME_RELEVANCE_BAND`
  (default 50, the Epic 64 §5.2 "active work" band) **OR** the signal's title tokens overlap the run
  `focusKeyword` (reusing the existing keyword normalization in `digest.ts`).
- **Entity adjacency** (co-mentioned with tracked entities) := within the same run, the entity's signals
  co-occur with at least one **tracked** entity (a signal carrying `peopleMatch`). Recorded as
  `coMentionedTrackedEntities[]` on the snapshot.
**Consequences:**
- The snapshot persists `maxPersonalRelevance` and `coMentionedTrackedEntities` so the read path emits
  this as an intelligible reason without recomputation.
- `relevance`/`personalRelevance` semantics from Epic 64 are reused verbatim; Epic 73 adds no scoring
  dimensions.

---

### ADR-E73-005 — Emerging lane has a distinct cold-start rule, separate from acceleration  ⟵ Q4

**Status:** Accepted
**Context (Q4):** A never-before-seen entity has no baseline — its first appearances *are* the signal.
The emerging lane needs its own rule, not a special case bolted onto acceleration.
**Decision:** The two lanes use **different** detection models (honoring the "separate lanes" constraint):

- **Tracked lane (acceleration-vs-baseline):** entity is `tracked` (has a `person:` key from `peopleMatch`)
  AND active-window mention rate `>= ENTITY_TRACKED_ACCEL_RATIO × baseline daily rate`
  AND active-window count `>= ENTITY_TRACKED_MIN_ACTIVE`. New-source-penetration (a `sourceType` in the
  active window absent from baseline) and cross-source spread are additional acceleration reasons.
- **Emerging lane — two distinct sub-paths:**
  - **(4a) Cold-start (no baseline):** entity key absent from snapshots older than the active window
    AND `>= ENTITY_EMERGING_COLDSTART_MIN` appearances within the active window
    AND `>= ENTITY_EMERGING_MIN_DISTINCT_SIGNALS` distinct signals (not one signal counted twice).
  - **(4b) Low-baseline traction:** entity has a thin baseline but is not tracked, and shows acceleration
    by the same ratio rule as the tracked lane.
- Theme/entity adjacency (ADR-E73-004) and cross-source spread **boost ranking and supply reasons** but
  are **not** sole triggers.
**Consequences:**
- Cold-start is explicit and testable in isolation (fixture: zero prior history + N active appearances).
- The lanes never share one ambiguous scoring model.

---

### ADR-E73-006 — Thresholds are architecture-set v1 defaults, tunable, centralized in Convex `constants.ts`  ⟵ Q1

**Status:** Accepted
**Context (Q1):** Thresholds are intentionally unlocked. Decide who locks them and when — mirror the
"loose first-pass numbers, revisable" precedent (Epic 64 §8.1 locked-but-revisable tables; Polymarket
scoring weights) rather than over-engineering upfront or blocking dev-story on operator input.
**Decision:** This architecture **sets concrete v1 defaults now**, flagged `[TUNABLE v1]`, in a single
location: `cns-dashboard/convex/constants.ts`. The operator does **not** need to pre-decide numbers
before implementation. Thresholds are consumed only by the read-path lane computation (ADR-E73-007), so
they live in one place and are revisable without schema or write-path changes.

**v1 default table `[TUNABLE v1]`:**

| Constant | Default | Meaning |
|----------|---------|---------|
| `ENTITY_ACTIVE_WINDOW_DAYS` | 7 | Short window for current momentum |
| `ENTITY_BASELINE_WINDOW_DAYS` | 30 | Trailing baseline for comparison |
| `ENTITY_TRACKED_ACCEL_RATIO` | 2.0 | Active rate ÷ baseline daily rate to flag acceleration |
| `ENTITY_TRACKED_MIN_ACTIVE` | 3 | Min active-window mentions (noise floor; blocks 1→2 spikes) |
| `ENTITY_EMERGING_COLDSTART_MIN` | 3 | Min active-window appearances for a no-baseline candidate |
| `ENTITY_EMERGING_MIN_DISTINCT_SIGNALS` | 2 | Distinct signals required (anti single-signal echo) |
| `ENTITY_THEME_RELEVANCE_BAND` | 50 | `personalRelevance` band for theme adjacency (ADR-E73-004) |
| `ENTITY_LANE_MAX_ITEMS` | 10 | Max ranked items per lane returned to surfaces |

**Consequences:**
- No operator gate blocks dev-story; numbers are calibrated after the first live runs.
- Because thresholds are Convex-side read constants, retuning is a single-file change with no migration.

---

### ADR-E73-007 — Lane computation is one bounded derived Convex query; validator + health discipline is mandatory

**Status:** Accepted
**Context:** Both the dashboard (reactive) and the digest (one-shot) must show identical lanes, with
intelligible reasons and source traces, without duplicating logic or violating the no-compute-in-Convex
scoring boundary.
**Decision:**
- **Single read query `getEntityIntelligence`** (cns-dashboard) reads `entityMentions` over the baseline
  window (`by_ranAt`), groups by `entityKey`, applies the `[TUNABLE]` thresholds, and returns the two
  ranked lanes with reasons + evidence (§7). This is **derived aggregation** (ratios/thresholds), in the
  same class as the existing `getDigestSourceHealth` derived query — explicitly **not** the prohibited
  5-dimension signal-scoring engine. The dashboard subscribes reactively; the digest calls it once over
  HTTP for its ranked sections.
- **Validator round-trip discipline (bound constraint):** every `entityMentions` field round-trips
  through the real `entityMentionInputValidator` via a canonical `buildEntityMentionPayload()` fixture,
  exactly mirroring `buildDigestPushPayload` + `tests/morning-digest-build-payload.test.mjs`. A
  cns-dashboard convex test asserts the validator accepts a canonical row and rejects malformed ones.
- **Health surface (bound constraint):** a derived `getEntityIntelligenceHealth` query reports whether
  the entity stage ran for the latest run, snapshot counts, and lane sizes. It is **live-verified against
  prod** after deploy (not only local tests), per the Pinterest/Polymarket health-registry lesson and
  the Epic 69-3 source-health pattern.
**Consequences:**
- Lane/threshold logic exists once (Convex query); extraction logic exists once (Node); no drift.
- A dedicated story owns the prod health verification artifact (§10).

---

## 3. Schema Contract (cns-dashboard)

### 3.1 New table `entityMentions` (one row per entity × digest run)

**File:** `cns-dashboard/convex/validators.ts` (validators) + `convex/schema.ts` (table + indexes).

```typescript
export const entityTypeValue = v.union(
  v.literal('person'),
  v.literal('account'),
  v.literal('org'),
);

// Compact evidence reference — title/url/sourceType only (no full body).
export const entityMentionSignalRefValidator = v.object({
  digestSignalId: v.id('digestSignals'),
  title: v.string(),
  url: v.optional(v.string()),
  sourceType: digestSourceTypeValue,
});

// Input validator (pushed from Node; _creationTime is server-side).
export const entityMentionInputValidator = v.object({
  digestRunId: v.id('digestRuns'),
  ranAt: v.number(),                 // denormalized from run for by_ranAt window scans
  date: v.string(),
  entityKey: v.string(),             // normalized canonical key (ADR-E73-003)
  entityType: entityTypeValue,
  displayName: v.string(),
  platform: v.optional(v.string()),  // twitter | bluesky | github | rss | youtube | ...
  tracked: v.boolean(),              // true when entityType==='person' from peopleMatch
  mentionCount: v.number(),          // mentions in THIS run (>= 1)
  distinctSignalCount: v.number(),   // distinct digestSignals in this run (>= 1)
  sourceTypes: v.array(digestSourceTypeValue),       // distinct sources this run
  maxPersonalRelevance: v.optional(v.number()),      // 0–100, theme adjacency (ADR-E73-004)
  maxRankScore: v.optional(v.number()),              // 0–100
  coMentionedTrackedEntities: v.optional(v.array(v.string())), // tracked entityKeys co-occurring
  signalRefs: v.array(entityMentionSignalRefValidator),        // capped evidence (max 5)
  workspaceId: v.optional(v.string()),
});

export const entityMentionRowValidator = entityMentionInputValidator; // identical shape persisted
```

**Indexes (`schema.ts`):**

```typescript
entityMentions: defineTable(entityMentionRowValidator)
  .index('by_entityKey', ['entityKey'])
  .index('by_ranAt', ['ranAt'])
  .index('by_digestRunId', ['digestRunId']),
```

**Validation rules (round-tripped via fixture):**
- `mentionCount >= 1`, `distinctSignalCount >= 1`, `distinctSignalCount <= mentionCount`.
- `0 <= maxPersonalRelevance <= 100`, `0 <= maxRankScore <= 100` when present.
- `sourceTypes` non-empty; each a valid `digestSourceTypeValue`.
- `signalRefs` length 1..5 (evidence cap; keeps rows compact).
- `tracked === true` ⟹ `entityType === 'person'` in v1 (no tracked-org config yet).

### 3.2 Mutation `recordEntityMentions` (batched, public-by-design)

**File:** `cns-dashboard/convex/entityIntelligence.ts` (new).

```typescript
export const recordEntityMentions = mutation({
  args: { mentions: v.array(entityMentionInputValidator) },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { mentions }) => {
    // verify each mention.digestRunId exists (mirror addDigestSignal parent check)
    // insert each row; return count
  },
});
```

Mirrors `addDigestSignal`: validate input → confirm parent `digestRun` exists → insert.

```typescript
export const clearEntityMentionsForRun = mutation({
  args: { digestRunId: v.id('digestRuns') },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, { digestRunId }) => {
    // delete all entityMentions withIndex('by_digestRunId', q => q.eq('digestRunId', digestRunId))
  },
});
```

```typescript
export const replaceEntityMentionsForRun = mutation({
  args: { digestRunId: v.id('digestRuns'), mentions: v.array(entityMentionInputValidator) },
  returns: v.object({ deleted: v.number(), inserted: v.number() }),
  handler: async (ctx, { digestRunId, mentions }) => {
    // validate the full replacement, delete prior rows, then insert in one transaction
  },
});
```

Re-analysis is **transactional clear-then-write** (ADR-E73-002, §4.3): the stage calls
`replaceEntityMentionsForRun` on every run, including zero-mention replacements. Convex mutation
atomicity prevents a failed insert from leaving the run with its prior snapshots deleted.

### 3.3 No changes to `digestSignals` / `digestRuns`

Epic 73 adds **no fields** to existing tables. It reads `digestSignals.sourceMetadata`,
`scores.personalRelevance`, and `digestRuns.focusKeyword` as they already exist (Epic 64/67/68).

---

## 4. Node Analysis Stage (Omnipotent.md)

### 4.1 New modules

| File | Action | Purpose |
|------|--------|---------|
| `scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs` | **New** | Pure functions: `extractEntitiesFromSignal(signal)`, `normalizeEntityKey(...)`, `aggregateRunEntities(signals)` |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-entity-mention-payload.mjs` | **New** | `buildEntityMentionPayload(run, signals)` → `entityMentionInputValidator[]` (canonical fixture anchor) |
| `scripts/hermes-skill-examples/morning-digest/scripts/analyze-entity-intelligence.mjs` | **New** | Post-push orchestrator: build payload → `recordEntityMentions` over HTTP; stderr+exit-0 on failure |
| `scripts/run-digest-convex-completion.mjs` | **Update** | Invoke `analyze-entity-intelligence` after the digest push completes |

### 4.2 Extraction algorithm (deterministic, structured-field-only)

For each pushed signal, emit zero or more `(entityType, entityKey, displayName, platform, tracked)`:

1. If `sourceMetadata.peopleMatch.personName` present → `person` entity, `tracked: true`, key
   `person:<normalize(personName)>`.
2. Else if `sourceMetadata.authorHandle` present → `account` entity, key
   `account:<platform>:<stripAt(lower(handle))>` (platform from `sourceType`).
3. Else if `sourceMetadata.author` present (rss/youtube/tiktok/instagram/pinterest) → `account` entity,
   key `account:<platform>:<normalize(author)>`.
4. If `sourceType === 'github'` and `url` matches `github.com/<owner>/<repo>` → `org` entity, key
   `org:github:<lower(owner)>`.

A single signal may yield both an account/person and an org. `normalize` = trim + lowercase + collapse
whitespace (reuse `tokenizeForScoring` normalization where applicable; no new stopword lists).

Then `aggregateRunEntities(signals)` groups per `entityKey` for the run:
- `mentionCount` = total signals referencing the entity; `distinctSignalCount` = distinct `digestSignalId`.
- `sourceTypes` = distinct sources; `maxPersonalRelevance` / `maxRankScore` = max over the entity's signals.
- `coMentionedTrackedEntities` = tracked entityKeys appearing in the same run.
- `signalRefs` = up to 5 highest-`rankScore` signals (evidence cards / source traces).

### 4.3 Idempotency — transactional clear-then-write (locked; see ADR-E73-002)

The stage keys snapshots to `digestRunId`. Re-analysis of a `digestRunId` is **clear-then-write**: the
orchestrator calls `replaceEntityMentionsForRun(digestRunId, mentions)` unconditionally. The mutation
validates the complete replacement, deletes prior rows, and inserts the fresh set atomically. A
zero-mention replacement still clears stale rows. A no-op-if-exists strategy is **rejected** (rationale
in ADR-E73-002). Force-rescore must patch and re-analyze the existing `digestRunId` and
`digestSignalId` values, never create an independent duplicate run. **No live read in the scoring hot
path;** this is a one-shot post-push reconciliation, deterministic per run.

---

## 5. Read Path & Lane Computation (cns-dashboard)

### 5.1 `getEntityIntelligence` query

```typescript
export const getEntityIntelligence = query({
  args: { now: v.optional(v.number()), workspaceId: v.optional(v.string()) },
  returns: entityIntelligenceResultValidator, // two lanes, each entityLaneItemValidator[]
  handler: async (ctx, { now }) => {
    // 1. window = [now - BASELINE_WINDOW, now]; active = [now - ACTIVE_WINDOW, now]
    // 2. rows = entityMentions.withIndex('by_ranAt', q => q.gte('ranAt', windowStart)).collect()
    // 3. group by entityKey → { activeCount, activeRate, baselineDailyRate, sourceTypes, tracked,
    //    maxPersonalRelevance, coMentioned..., evidence }
    // 4. tracked lane: tracked && activeRate >= RATIO*baseline && activeCount >= MIN_ACTIVE
    // 5. emerging lane: cold-start (no baseline + COLDSTART_MIN) OR low-baseline traction
    // 6. attach reasons[]; rank; slice to LANE_MAX_ITEMS
  },
});
```

`now` is passed by the client (per the no-`Date.now()`-in-queries rule); the digest passes its run time.
Thresholds come from `constants.ts` (ADR-E73-006). Grouping/threshold math only — no signal re-scoring.

### 5.2 Lane item & reasons shape

```typescript
export const entityReasonValidator = v.object({
  code: v.union(
    v.literal('acceleration'),       // active rate >= ratio × baseline
    v.literal('cold_start'),         // no prior baseline + N appearances
    v.literal('cross_source'),       // present across >1 sourceType
    v.literal('new_source'),         // sourceType new vs baseline
    v.literal('theme_adjacent'),     // personalRelevance band / focusKeyword (ADR-E73-004)
    v.literal('co_mentioned'),       // co-occurs with a tracked entity
    v.literal('high_priority_source'),
  ),
  detail: v.string(),                // human-readable evidence string
});

export const entityLaneItemValidator = v.object({
  entityKey: v.string(),
  entityType: entityTypeValue,
  displayName: v.string(),
  platform: v.optional(v.string()),
  activeCount: v.number(),
  baselineDailyRate: v.number(),
  sourceTypes: v.array(v.string()),
  momentumSummary: v.string(),       // e.g. "12 mentions / 7d vs 1.3/wk baseline (≈4×)"
  reasons: v.array(entityReasonValidator),
  evidence: v.array(entityMentionSignalRefValidator), // source traces for the card
});
```

This satisfies CAP-4/CAP-7/FR4: display name, type, why-here (reasons), momentum summary, and source
traces — all from persisted snapshots, no opaque-score-only output.

---

## 6. Surfaces

### 6.1 Dashboard (cns-dashboard)

Two read-only modules/tabs (CAP-1, CAP-7) bound to `getEntityIntelligence` via reactive `useQuery`-style
Convex subscription: **Tracked Entities in Motion** and **Emerging Entities to Review**. Evidence cards
render `displayName`, `entityType`, `reasons[]`, `momentumSummary`, and `evidence[]` source traces.
Actions are inspect/compare/save/**manual-track** — all read-only / navigational; **no YAML or config
mutation** (CAP-5, FR5). "Manual track" deep-links the operator to edit `nexus-people.yaml` themselves.

### 6.2 Morning digest (Omnipotent.md)

The digest assembly calls `getEntityIntelligence` once over HTTP and renders a small ranked section for
each lane (CAP-8, FR... digest): "Tracked entities accelerating now" and "Emerging entities worth a look",
with one-line reasons. Feature remains useful outside the dashboard.

---

## 7. Validator & Health Discipline (bound constraint)

| Requirement | Mechanism |
|-------------|-----------|
| Every field round-trips through the real mutation validator via a canonical fixture | `buildEntityMentionPayload()` (Node) is the single source of payload shape; `tests/morning-digest-entity-mention-payload.test.mjs` round-trips it; `cns-dashboard/tests/convex/entityIntelligence.test.ts` asserts `entityMentionInputValidator` accepts the canonical row and rejects malformed (mirrors `buildDigestPushPayload` discipline) |
| New health/status surface live-verified against prod | `getEntityIntelligenceHealth` derived query (latest-run analyzed? snapshot count, lane sizes); a live-prod verification artifact under `_bmad-output/implementation-artifacts/` (Epic 69-3 source-health pattern) — not just passing local tests |
| No registry drift | Extraction logic = one Node module; lane/threshold logic = one Convex query; `entityType`/`sourceType` literals reuse existing `digestSourceTypeValue` |

---

## 8. Failure & Degraded Modes

| Failure | Behavior |
|---------|----------|
| Entity stage throws | stderr warning; **exit 0**; structured outcome `entity.status=failed`; digest post continues |
| `replaceEntityMentionsForRun` validation error | transaction rolls back; structured outcome records the failure; digest post continues |
| No snapshots in window | `getEntityIntelligence` returns empty lanes; surfaces show empty state, not error |
| Sparse history (early days) | Cold-start path dominates until baselines accrue; acceleration ratio gated by `MIN_ACTIVE` floor |
| Re-pushed run | Existing run and signal IDs are patched; snapshots reconcile atomically per §4.3 |

---

## 9. Constraint Compliance Matrix

| Constraint (SPEC / parent-session) | Where honored |
|-----------------------------------|---------------|
| No new ScrapeCreators / external adapter | §1.2 — analysis stage on pushed signals only; zero new sources |
| No LLM required for v1 | ADR-E73-003/004 — structured fields + persisted `personalRelevance`; no provider dependency |
| Structured-field-first; free-text is v2 | ADR-E73-003 — extraction from `peopleMatch`/`authorHandle`/`author`/github url only |
| Separate lanes, not one ambiguous model | ADR-E73-005 — distinct tracked vs emerging detection |
| Read-only suggestions (no YAML writes) | ADR-E73-002, §6 — persistence is counts/baselines only; surfaces are read-only |
| Validator round-trip via canonical fixture | ADR-E73-007, §7 — `buildEntityMentionPayload()` |
| Health surface live-verified against prod | ADR-E73-007, §7, §10 |
| Not Epic 72 adapter/three-list-class pattern | §1.3 — new analysis modules, not source-registry adapters |

---

## 10. Story Traceability (proposed Epic 73 stories)

| Story | Sections / ADRs | Repo | Key deliverables |
|-------|-----------------|------|------------------|
| **73-1** | §3, ADR-E73-002 | cns-dashboard | `entityMentions` table + validators + indexes + atomic `replaceEntityMentionsForRun`; Convex validator test |
| **73-2** | §4.1–4.2, ADR-E73-001/003 | Omnipotent.md | `extract-entities.mjs` pure functions + unit tests (person/account/org keys) |
| **73-3** | §3.2, §4.3, §7, ADR-E73-007 | Omnipotent.md | `build-entity-mention-payload.mjs` + `buildEntityMentionPayload()` round-trip fixture test |
| **73-4** | §4.1, §4.3, ADR-E73-002 | Omnipotent.md | `analyze-entity-intelligence.mjs` orchestrator + all push/recovery paths; identity-preserving force-rescore; transactional clear-then-write idempotency |
| **73-5** | §5, ADR-E73-004/005/006 | cns-dashboard | `getEntityIntelligence` query + thresholds in `constants.ts` + lane/reasons validators + tests |
| **73-6** | §6.1 | cns-dashboard | Two dashboard modules (read-only evidence cards) |
| **73-7** | §6.2 | Omnipotent.md | Digest ranked sections consuming `getEntityIntelligence` |
| **73-8** | §7, §10, ADR-E73-007 | operator + artifact | `getEntityIntelligenceHealth` + live-prod verification artifact |

**Gate discipline:** 73-1 → 73-2/73-3 (parallel) → 73-4 → 73-5 → 73-6/73-7 (parallel) → 73-8 (after live runs accrue baseline). `bash scripts/verify.sh` green before each story done.

---

## 11. Test Requirements

| Test file | Coverage |
|-----------|----------|
| `tests/morning-digest-extract-entities.test.mjs` (new) | person/account/org key construction; multi-entity signals; normalization |
| `tests/morning-digest-entity-mention-payload.test.mjs` (new) | `buildEntityMentionPayload()` shape + validator round-trip |
| `cns-dashboard/tests/convex/entityIntelligence.test.ts` (new) | validator accept/reject; `recordEntityMentions` parent check; `getEntityIntelligence` tracked/cold-start/low-baseline cases; threshold edges |

---

## 12. Open Questions — Resolved

| Agenda question | Resolution |
|-----------------|------------|
| Q1 thresholds | ADR-E73-006 — architecture-set `[TUNABLE v1]` defaults in `constants.ts`; no operator pre-gate |
| Q2 non-person entities | ADR-E73-003 — person/account + github org/repo in v1; company/product canonicalization v2 |
| Q3 theme adjacency | ADR-E73-004 — `personalRelevance` band + `focusKeyword` + co-occurring `peopleMatch` |
| Q4 cold-start | ADR-E73-005 — distinct emerging-lane rule (4a cold-start, 4b low-baseline) |
| Q5 persistence | **ADR-E73-002 — new persisted `entityMentions` Convex table; not stateless aggregation** |

---

## 13. Divergence / Assumption Log

| Item | Agenda / SPEC | Architecture | Rationale |
|------|---------------|--------------|-----------|
| ProductHunt org entity | Q2 lists ProductHunt maker as a candidate org field | Deferred to v2 | `sourceMetadata` carries no PH maker field today (only `upvotes`); structured-only constraint |
| Tracked lane breadth | "broader than people-only" | Tracked lane is people-centric in v1; orgs/repos emerge only | `nexus-people.yaml` is people-only; no tracked-org config exists (anti-overpromise per Q2) |
| Lane math location | "stateless query vs new table" framed as read concern | Read-side derived query (grouping/thresholds) over the persisted table | Distinct from prohibited 5-dim scoring engine; same class as `getDigestSourceHealth` |

---

## 14. Downstream Handoff

| Next workflow | Action |
|---------------|--------|
| `/bmad-create-story 73-1` | `entityMentions` schema + mutation against §3 |
| `/bmad-create-story 73-2` | Entity extraction against §4.2 |
| `/bmad-create-story 73-3` | Payload builder + fixture against §3.2/§7 |
| `/bmad-create-story 73-4` | Post-push orchestrator against §4 |
| `/bmad-create-story 73-5` | `getEntityIntelligence` + thresholds against §5/§ADR-E73-006 |
| `/bmad-create-story 73-6`/`73-7` | Dashboard modules + digest sections against §6 |
| `/bmad-create-story 73-8` | Health surface + live-prod verification against §7 |

**Normative path:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md`
