---
story_id: 64-1
epic: 64
title: digest-signals-schema-extension
status: review
baseline_commit: 22f4480
operator_brief: 2026-06-08
predecessors: 61-5, 63-6
blocks: 64-2, 64-3, 64-4, 64-5
---

# Story 64.1: digestSignals schema extension for per-signal scores

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator consuming ranked intelligence in the Nexus cockpit**,
I want **`digestSignals` to persist five named dimension scores, disposition, normalized engagement, and `rankScore` with extended engagement metadata**,
so that **Epic 64 scoring stories (64-2..64-5) can compute and push ranked signals without another schema migration, and read queries can sort "What Matters Now" by `rankScore`**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 64: Intelligence Scoring Engine v1 — **64-1 is the schema gate**; blocks all scoring stories |
| **Repo** | **Cross-repo** — primary: `cns-dashboard` (`validators.ts`, `digest.ts`); paired: Omnipotent.md push contract + tests |
| **Predecessors** | **61-5** (digestRuns/digestSignals tables + `push-digest-convex.mjs`); **63-6** (`getDigestSignalsForRun` read query + rank asc sort) |
| **Parallel done** | **64-6** (NewsAPI tightening), **64-7** (arXiv env fix) — improved source inputs; no schema dependency |
| **Normative spec** | `architecture-epic-64-scoring-engine.md` §3 (Schema Contract), ADR-E64-001, ADR-E64-002 |
| **FR IDs** | FR-1 (scores object), FR-2 (disposition/normalizedEngagement/rankScore), FR-3 (sourceMetadata engagement), FR-4 (push contract) |
| **Out of scope** | Scoring computation (`score-digest-signals.mjs` → 64-2..64-5); disposition derivation (64-3); engagement normalization algorithm (64-4); task-prompt scoring integration (64-5); dashboard UI rendering; `digestSourceTypeValue` GitHub/Reddit/RSS literals (Epic 65); removing legacy top-level `score` field |

### Problem (current state)

`cns-dashboard/convex/validators.ts` defines `digestSignal*Validator` with only optional legacy `score` (number). No dimension object, no `disposition`, no `rankScore`, no engagement fields on `sourceMetadata` beyond `comments`/`categories`/`author`/`publishedAt`.

`getDigestSignalsForRun` sorts by `rank` ascending only and omits any future score fields from the return mapper.

`push-digest-convex.mjs` already passes signal objects through unchanged — but fixtures and `task-prompt.md` document only legacy fields. HN maps RSS `score` → top-level `score` and `comments` → `sourceMetadata.comments`; architecture requires `sourceMetadata.points` + `sourceMetadata.commentCount` for normalization inputs (64-4).

### Operator brief (binding — sprint-change-proposal-2026-06-08)

1. **64-1 is primarily a cns-dashboard story** with one Omnipotent.md push-contract touch.
2. Expect **one cross-repo touch** for schema; 64-2..64-5 are Omnipotent.md only.
3. All new fields **optional** during migration — legacy rows without scores remain readable.
4. `bash scripts/verify.sh` must pass including cns-dashboard when `CNS_DASHBOARD_ROOT` is set.

## Acceptance Criteria

### 1. `scores` object on digestSignals (AC: FR-1)

**Given** a `digestSignal` payload with `scores` present
**When** `addDigestSignal` runs
**Then** `scores` is an object with **exactly five required numeric keys** when the parent key is present: `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency`
**And** each value is a number in **0–100 inclusive** (document contract; enforce via tests with representative payloads)
**And** a payload with `scores` missing any of the five keys is **rejected** at the validator boundary
**And** a payload with only legacy top-level `score` (no `scores` object) is **still accepted** (backward compatibility)
**And** `personalRelevance` and `relevance` are separate fields — partial object with only `relevance` does not satisfy the contract

**Apply identically to** `digestSignalInputValidator` and `digestSignalRowValidator` in `cns-dashboard/convex/validators.ts`.

### 2. disposition, normalizedEngagement, rankScore (AC: FR-2)

**Given** optional fields on a signal payload
**When** values are provided
**Then** `disposition` accepts only: `priority` | `watch` | `ignore` | `escalate`
**And** invalid disposition literals are rejected
**And** `normalizedEngagement` and `rankScore` accept optional numbers (0–100 contract per architecture §3.1)
**And** `getDigestSignalsForRun` sorts signals:
  1. By `rankScore` **descending** when both rows have `rankScore`
  2. Rows with `rankScore` before rows without
  3. Fallback: legacy `rank` **ascending** when `rankScore` absent or tied
**And** the query return mapper includes `scores`, `disposition`, `normalizedEngagement`, `rankScore` when stored

### 3. sourceMetadata engagement extension (AC: FR-3)

**Given** `sourceMetadata` on a digest signal
**When** engagement fields are present
**Then** validator accepts optional: `stars`, `forks`, `upvotes`, `points`, `commentCount`
**And** existing optional fields (`comments`, `categories`, `author`, `publishedAt`) **remain** for backward compatibility
**And** HN push contract documents: RSS `score` → `sourceMetadata.points`; RSS `comments` → `sourceMetadata.commentCount` (architecture §3.2)

### 4. Push contract alignment (AC: FR-4)

**Given** a fixture `DIGEST_PUSH_JSON` with fully scored signals (all new optional fields populated on at least one signal)
**When** `pushDigestToConvex` runs with mocked Convex HTTP
**Then** `addDigestSignal` mutation args include the new fields unchanged (passthrough — no stripping)
**And** `tests/morning-digest-push-convex.test.mjs` asserts scored payload round-trip on the happy path
**And** `task-prompt.md` §9 signal mapping documents new optional keys and updated HN `sourceMetadata` mapping (`points`, `commentCount`)
**And** `bash scripts/verify.sh` passes (Omnipotent.md tests + sibling `cns-dashboard` vitest)

### 5. No scoring compute in this story (AC: anti-drift)

**Given** this story's scope boundary
**When** implementation completes
**Then** there is **no** `score-digest-signals.mjs` module
**And** no changes to `pick-signal-notebook.mjs` routing logic
**And** no Convex function computes dimension scores server-side (ADR-E64-001)
**And** morning digest still pushes **unscored** signals successfully (existing fixture payloads without new fields)

## Tasks / Subtasks

- [x] **T1** `cns-dashboard/convex/validators.ts` — extend validators (AC: 1, 2, 3)
  - [x] Add `digestSignalScoresValidator` (or inline object) with five required number fields inside optional `scores`
  - [x] Add optional `disposition`, `normalizedEngagement`, `rankScore` to input + row validators
  - [x] Extend `sourceMetadataValidator` with `stars`, `forks`, `upvotes`, `points`, `commentCount`
  - [x] Mirror changes in both `digestSignalInputValidator` and `digestSignalRowValidator`
- [x] **T2** `cns-dashboard/convex/digest.ts` — read-side sort + mapper (AC: 2)
  - [x] Replace sort in `getDigestSignalsForRun` per architecture §3.3
  - [x] Include new fields in `.map()` return destructuring
- [x] **T3** `cns-dashboard/tests/convex/digest.test.ts` — extend coverage (AC: 1, 2, 3)
  - [x] Happy path: addDigestSignal with full `scores` + `rankScore` + `disposition` + extended `sourceMetadata`
  - [x] Reject partial `scores` (e.g. only `relevance`)
  - [x] Reject invalid `disposition`
  - [x] `getDigestSignalsForRun` rankScore desc sort + legacy rank fallback when rankScore absent
- [x] **T4** Omnipotent.md push contract (AC: 4)
  - [x] Extend `tests/morning-digest-push-convex.test.mjs` with scored `basePayload()` variant; assert fields in `addDigestSignal` args
  - [x] Update `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` §9: document optional `scores`, `disposition`, `normalizedEngagement`, `rankScore`; HN `sourceMetadata.points`/`commentCount`; strict-schema rule ("omit when absent, never null")
  - [x] **Do not** change `push-digest-convex.mjs` logic unless a field is being stripped today (it should passthrough `{ ...signal, digestRunId }` already)
- [x] **T5** Verify gate (AC: 4)
  - [x] `bash scripts/verify.sh` green from Omnipotent.md with default `../cns-dashboard` sibling path
  - [x] If WSL sibling verify fails, use operator PowerShell launcher / `CNS_DASHBOARD_ROOT` per project-context

## Dev Notes

### Architecture compliance

| ADR | Requirement for 64-1 |
|-----|----------------------|
| **ADR-E64-001** | Schema + persistence in cns-dashboard; scoring compute deferred to 64-2..64-5 in Omnipotent.md |
| **ADR-E64-002** | `scores` SSOT for dimensions; `rankScore` SSOT for ordering; legacy `score` remains optional, not a proxy |
| **ADR-E64-003** | Raw engagement in `sourceMetadata` only; no cross-source comparison in this story |
| **ADR-E64-005** | No last30days dependency |

**Schema auto-sync:** `cns-dashboard/convex/schema.ts` uses `defineTable(digestSignalRowValidator)` — **validators.ts is the only schema touch**; do not hand-edit `schema.ts` unless validator export shape forces a separate change.

### Current files — must read before editing

**validators.ts (today):**

```171:197:cns-dashboard/convex/validators.ts
export const digestSignalInputValidator = v.object({
	digestRunId: v.id('digestRuns'),
	section: digestSectionValue,
	sourceType: digestSourceTypeValue,
	title: v.string(),
	summary: v.optional(v.string()),
	url: v.optional(v.string()),
	externalId: v.optional(v.string()),
	score: v.optional(v.number()),
	rank: v.number(),
	sourceMetadata: v.optional(sourceMetadataValidator),
	workspaceId: v.optional(v.string())
});

export const digestSignalRowValidator = v.object({
	// ... same fields minus digestRunId
});
```

**sourceMetadata (today):** `comments`, `categories`, `author`, `publishedAt` only.

**digest.ts sort (today):**

```137:152:cns-dashboard/convex/digest.ts
		return signals
			.sort((a, b) => a.rank - b.rank)
			.slice(0, take)
			.map(({ digestRunId: runId, section, sourceType, title, summary, url, externalId, score, rank, sourceMetadata, workspaceId }) => ({
				// ... no scores/disposition/rankScore fields
			}));
```

**push-digest-convex.mjs (today):** spreads each signal unchanged into `addDigestSignal` — no field filtering.

### Target validator shape (normative — architecture §3.1–3.2)

```typescript
scores: v.optional(v.object({
  relevance: v.number(),
  personalRelevance: v.number(),
  novelty: v.number(),
  momentum: v.number(),
  urgency: v.number(),
})),
disposition: v.optional(v.union(
  v.literal('priority'),
  v.literal('watch'),
  v.literal('ignore'),
  v.literal('escalate'),
)),
normalizedEngagement: v.optional(v.number()),
rankScore: v.optional(v.number()),
```

Extend `sourceMetadataValidator`:

```typescript
stars: v.optional(v.number()),
forks: v.optional(v.number()),
upvotes: v.optional(v.number()),
points: v.optional(v.number()),
commentCount: v.optional(v.number()),
```

### HN metadata migration note

- **Today:** task-prompt maps HN `score` → signal `score`; `comments` → `sourceMetadata.comments`
- **64-1 contract:** document `sourceMetadata.points` + `sourceMetadata.commentCount` for engagement normalization (64-4)
- **Backward compat:** keep accepting `sourceMetadata.comments` in validator; do **not** require agents to stop sending top-level HN `score` in 64-1 (64-5 may reconcile ranked order)
- **Task-prompt update:** add rows for new optional signal keys; update HN `sourceMetadata` bullet — scoring stories will populate `scores`/`rankScore` later; 64-1 only documents the contract

### Scored fixture payload (for tests)

```json
{
  "section": "hackernews",
  "sourceType": "hackernews",
  "title": "Show HN: Agent framework",
  "url": "https://news.ycombinator.com/item?id=48408186",
  "rank": 1,
  "externalId": "48408186",
  "score": 142,
  "sourceMetadata": { "points": 142, "commentCount": 38 },
  "scores": {
    "relevance": 72,
    "personalRelevance": 85,
    "novelty": 90,
    "momentum": 55,
    "urgency": 40
  },
  "disposition": "priority",
  "normalizedEngagement": 61,
  "rankScore": 78
}
```

### rankScore sort test scenario (cns-dashboard)

Insert three signals same run:

| title | rank | rankScore |
|-------|------|-----------|
| Low rankScore | 1 | 30 |
| High rankScore | 3 | 90 |
| Legacy only | 2 | (omit) |

**Expect order:** High rankScore → Legacy only → Low rankScore (per §3.3: rankScore rows before non-rankScore; among rankScore, desc; among non-rankScore, rank asc).

### Cross-repo verify workflow

```bash
# From Omnipotent.md repo root
bash scripts/verify.sh
# Uses ../cns-dashboard by default; override:
CNS_DASHBOARD_ROOT=/path/to/cns-dashboard bash scripts/verify.sh
```

**Commits:** Prefer **one commit in cns-dashboard** + **one in Omnipotent.md** (mirror 61-5 pattern). Message style: `feat(epic-64): 64-1 digestSignals schema extension for scoring fields`.

### Parallel epic learnings (64-6, 64-7)

- Fixture-first Node `.mjs` tests with `node:test` — extend existing files rather than new harness
- `mergeTrendIngestEnv` / `resolveOperatorHome()` for env — not relevant to cns-dashboard validators but keep push tests using existing `baseEnv()` pattern
- 64-6/64-7 improved source quality; 64-1 does not depend on their completion but benefits from richer HN/arXiv inputs in production digests
- Operator brief may override earlier story AC (64-7 vs 61-1 defaults) — 64-1 does not repeat that pattern; strict backward compat on optional fields

### Git intelligence (recent Epic 64 work)

| Commit | Relevance |
|--------|-----------|
| `22f4480` | Sprint artifacts after 64-6/64-7 — baseline for 64-1 |
| `e7b2bfb` | 64-6: `.mjs` module + test extension pattern |
| `92646fe` | 64-7: env contract documentation in task-prompt style |
| `0fd5b4e` / `0116eab` | 61-5: push contract, `ranAt`, mandatory completion gate — preserve fire-and-forget exit 0 semantics |

### Testing requirements

| File | Action |
|------|--------|
| `cns-dashboard/tests/convex/digest.test.ts` | Extend — validator acceptance, rankScore sort, field mapper |
| `tests/morning-digest-push-convex.test.mjs` | Extend — scored payload passthrough |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | **No changes** — routing must not regress (sanity: run verify) |
| `tests/hermes-morning-digest-skill.test.mjs` | Only if task-prompt edits require assertion updates |

**Gate:** `bash scripts/verify.sh` green before marking done.

### Project structure notes

| Path | Repo | Change |
|------|------|--------|
| `convex/validators.ts` | cns-dashboard | **UPDATE** |
| `convex/digest.ts` | cns-dashboard | **UPDATE** |
| `tests/convex/digest.test.ts` | cns-dashboard | **UPDATE** |
| `scripts/.../references/task-prompt.md` | Omnipotent.md | **UPDATE** (docs only) |
| `tests/morning-digest-push-convex.test.mjs` | Omnipotent.md | **UPDATE** |
| `convex/schema.ts` | cns-dashboard | **No edit expected** (validator-driven) |
| `push-digest-convex.mjs` | Omnipotent.md | **No logic change expected** |

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md` §3, §10, §11]
- [Source: `_bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md` §4.1 FR-1..FR-4]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md` — schema extension table, cross-repo note]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 64 goal + story order]
- [Source: `_bmad-output/implementation-artifacts/61-5-morning-digest-convex-push.md` — push lifecycle, strict optional-key rules]
- [Source: `_bmad-output/implementation-artifacts/63-6-polish-pass-digest-read-queries.md` — `getDigestSignalsForRun` baseline]
- [Source: `_bmad-output/implementation-artifacts/64-6-newsapi-query-tightening.md` — parallel track pattern]
- [Source: `_bmad-output/implementation-artifacts/64-7-arxiv-env-fix.md` — parallel track pattern]
- [Source: `project-context.md` — verify gate, Nexus principle, cross-repo layout]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Sort test expectation corrected vs story prose: architecture §3.3 places all `rankScore` rows before non-`rankScore` rows → order High (90) → Low (30) → Legacy (rank 2).
- Hermes skill parity gate required `bash scripts/install-hermes-skill-morning-digest.sh` after task-prompt edit.

### Completion Notes List

- Extended `digestSignalScoresValidator`, `digestSignalDispositionValue`, and `sourceMetadataValidator` engagement fields in cns-dashboard validators; mirrored on input + row validators.
- `getDigestSignalsForRun` now sorts rankScore desc (rows with rankScore before rows without), legacy rank asc fallback; return mapper includes all new fields.
- Added 5 digest.test.ts cases: full scored payload, partial scores rejection, invalid disposition rejection, legacy score-only acceptance, rankScore sort.
- Extended `morning-digest-push-convex.test.mjs` with scored payload passthrough test; updated task-prompt §9 contract docs.
- `push-digest-convex.mjs` unchanged (passthrough confirmed).
- `bash scripts/verify.sh` green (Omnipotent.md + cns-dashboard vitest).

### File List

**cns-dashboard**
- `convex/validators.ts`
- `convex/digest.ts`
- `tests/convex/digest.test.ts`

**Omnipotent.md**
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `tests/morning-digest-push-convex.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-09: Story 64-1 — digestSignals schema extension (scores, disposition, rankScore, sourceMetadata engagement); cross-repo validators + push contract docs.

### Review Findings

- [x] [Review][Patch] Tied `rankScore` sort fallback untested [`cns-dashboard/tests/convex/digest.test.ts`] — added tied-rankScore fixture; lower legacy `rank` sorts first per §3.3.
- [x] [Review][Patch] Query mapper omits full scored-field assertion [`cns-dashboard/tests/convex/digest.test.ts`] — happy-path test now asserts all four scored fields via `getDigestSignalsForRun` query response.
