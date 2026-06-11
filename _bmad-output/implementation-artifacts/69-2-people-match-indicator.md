---
baseline_commit: cf65264a90476d694ef90645e6b422f1297ebc12
---

# Story 69.2: People Match Indicator — Inspector Chip (+ Push Metadata)

Status: done

**Epic gate:** Requires **69-4 done** (digest feed → inspector) and benefits from **69-1** merge-provenance patterns (same drawer enrichment rhythm). **69-4 is done** (`eae57d6`). **69-1 is in review** (`addf62c` in cns-dashboard) — people chip is a **sibling section inside Signal Intelligence**, not below merge provenance.

**Repo boundary:** **Split story** — FR-4 push metadata in **Omnipotent.md** scoring scripts; FR-5 UI chip in **cns-dashboard**. No new adapters, no Convex schema tables, no vault WriteGate.

<!-- Validation: optional `/bmad-create-story` checklist before `/bmad-dev-story`. -->

## Story

As a CNS operator inspecting a digest signal with elevated personal relevance in Nexus,
I want the Intelligence Inspector to show which watchlist person matched and why the bonus applied,
so that I can explain surprising `personalRelevance` spikes without opening `~/.hermes/nexus-people.yaml` on my local machine.

## Acceptance Criteria

### AC1 — peopleMatch push metadata (FR-4)

**Given** `scoreDigestSignals()` runs with a populated `ctx.nexusPeople` watchlist  
**When** a signal receives a people handle bonus (+20) or name bonus (+10) per Epic 68-3  
**Then** the scored signal's `sourceMetadata.peopleMatch` is populated before Convex push:

```json
{
  "personName": "Andrej Karpathy",
  "matchedHandle": "karpathy.bsky.social",
  "bonusPoints": 20,
  "matchType": "handle"
}
```

**And** name-only match omits `matchedHandle`:

```json
{
  "personName": "Dario Amodei",
  "bonusPoints": 10,
  "matchType": "name"
}
```

**And** when both handle and name bonuses apply on the same signal, metadata uses **`matchType: "handle"`** with handle bonus points and the person resolved from the matched handle (handle metadata takes display precedence)  
**And** when no people bonus applies, `peopleMatch` is **not** added (do not push `null`)  
**And** `sourceMetadataValidator` in cns-dashboard accepts the optional `peopleMatch` object  
**And** fixture test: Karpathy Bluesky handle → `peopleMatch.bonusPoints === 20` and `personName === "Andrej Karpathy"`  
**And** `bash scripts/verify.sh` passes in **Omnipotent.md** (scoring tests)

### AC2 — People match chip visibility (FR-5)

**Given** the Intelligence Inspector Signal Intelligence panel is visible (`showScoringPanel && scoredDigestSignal`)  
**When** `sourceMetadata.peopleMatch` is present on the resolved signal  
**Then** a **people match chip** renders **adjacent to the Personal Relevance dimension row** (directly below that row's progress bar)  
**And** the chip appears for `digestSignal`, `keyword`, and `topic` inspector modes whenever `scoredDigestSignal` carries the metadata (same resolution path as merge provenance in 69-1)

**When** `peopleMatch` is absent but `scores.personalRelevance >= 20` (0–100 scale, after `normalizeScorePercent`) **and** `sourceMetadata.authorHandle` is a non-empty string  
**Then** fallback chip renders: **`@{handle} · watchlist boost likely`** (strip duplicate `@` from handle before prefixing)  
**And** fallback does **not** show a person name (Vercel cannot read local YAML — per PRD decision log)

**When** neither full metadata nor fallback conditions apply  
**Then** no people chip renders (no empty placeholder)

### AC3 — Chip copy and styling (FR-5, UJ-3, addendum A3)

**Given** full `peopleMatch` metadata with `matchType: "handle"`  
**When** the chip renders  
**Then** copy is: **`{personName} · @{matchedHandle} · +{bonusPoints} handle match`**  
**Example:** `Andrej Karpathy · @karpathy.bsky.social · +20 handle match`

**Given** `matchType: "name"`  
**Then** copy is: **`{personName} · +{bonusPoints} name match`**  
**Example:** `Dario Amodei · +10 name match`

**And** chip uses inspector accent styling consistent with disposition badge / merge badges — teal accent on charcoal (`#00D4AA` border or text accent per Nexus theme); not colour-only (text carries meaning)  
**And** chip has `aria-label` describing the people match for screen readers

### AC4 — No regressions (Epic 66/69-1/69-4)

**Given** inspector open on any mode  
**When** people chip renders or is hidden  
**Then** Signal Intelligence dimension bars, merge provenance section (69-1), Epic 66 investigation actions, digest brief, and 69-4 feed → inspector wiring remain unchanged  
**And** `bash scripts/verify.sh` passes in **cns-dashboard** (and Omnipotent.md when sibling path present)

### AC5 — Out of scope (explicit)

- Reading `nexus-people.yaml` from cns-dashboard / Vercel (forbidden — push metadata only)
- Convex schema table changes (metadata lives on existing `digestSignals.sourceMetadata`)
- Discord digest people chips
- Source health panel (69-3), investigation board (69-5)
- Changing people bonus amounts or scoring formulas (68-3 owns +20/+10)
- `--force-rescore` operator workflow (68-11) — optional follow-up to backfill `peopleMatch` on old rows; fallback UI covers legacy rows without metadata

## Tasks / Subtasks

### Omnipotent.md — FR-4 push metadata

- [x] **T1 — Resolve peopleMatch at scoring time** (AC: 1)
  - [x] T1.1 Add `resolvePeopleMatch(signal, nexusPeople)` in `score-digest-signals.mjs` returning `{ personName, matchedHandle?, bonusPoints, matchType } | null`:
    - Handle path: iterate people → platform handles → `normalizePeopleHandle` compare to signal `authorHandle`; return matched person name, normalized handle, `PEOPLE_HANDLE_MATCH_BONUS`, `'handle'`
    - Name path (only when handle path null): reuse name F1 logic from `scorePeopleBonuses`; return best person name, `PEOPLE_NAME_MATCH_BONUS`, `'name'`
    - Prefer handle metadata when `handleBonus > 0`
  - [x] T1.2 Export `resolvePeopleMatch` for unit tests (mirror `scorePeopleBonuses` exports)
  - [x] T1.3 In `scoreDigestSignals()`, after scores computed, when `resolvePeopleMatch` returns non-null, shallow-merge into output:
    ```javascript
    sourceMetadata: {
      ...(signal.sourceMetadata ?? {}),
      ...(peopleMatch ? { peopleMatch } : {}),
    }
    ```
  - [x] T1.4 Preserve existing `sourceMetadata` fields (`authorHandle`, `contributingSources`, engagement, etc.)

- [x] **T2 — Omnipotent.md tests** (AC: 1)
  - [x] T2.1 Add tests in `tests/morning-digest-score-signals.test.mjs` under `describe('peopleMatch push metadata (69-2)')`:
    - Karpathy Bluesky handle → `peopleMatch.bonusPoints === 20`, `matchType === 'handle'`, `personName === 'Andrej Karpathy'`
    - Dario name-only title F1 → `matchType === 'name'`, `bonusPoints === 10`, no `matchedHandle`
    - Empty `nexusPeople` → scored signal has no `peopleMatch` key
    - `scoreDigestSignals` integration: output array element includes nested `sourceMetadata.peopleMatch`
  - [x] T2.2 Run `bash scripts/verify.sh` from Omnipotent.md repo root

### cns-dashboard — FR-4 validator + FR-5 UI

- [x] **T3 — Convex validator extension** (AC: 1)
  - [x] T3.1 Extend `sourceMetadataValidator` in `convex/validators.ts`:
    ```typescript
    peopleMatch: v.optional(v.object({
      personName: v.string(),
      matchedHandle: v.optional(v.string()),
      bonusPoints: v.number(),
      matchType: v.union(v.literal('handle'), v.literal('name')),
    })),
    ```
  - [x] T3.2 Add `digest.test.ts` case: `addDigestSignal` accepts twitter row with `sourceMetadata.peopleMatch` Karpathy fixture

- [x] **T4 — Pure people-match UI utilities** (AC: 2, 3)
  - [x] T4.1 Create `$lib/utils/nexus-people-match.ts` with:
    - `PeopleMatchMetadata` type aligned with validator
    - `PeopleMatchChipViewModel` — `{ label: string; ariaLabel: string; variant: 'full' | 'fallback' }`
    - `parsePeopleMatch(sourceMetadata)` — narrow `Record<string, unknown>` with runtime guards
    - `formatPeopleMatchChip(peopleMatch)` — full copy per AC3
    - `formatFallbackPeopleChip(authorHandle)` — fallback copy per AC2
    - `shouldShowPeopleMatchChip(signal)` — true when parse succeeds OR fallback conditions met
    - `buildPeopleMatchChipViewModel(signal: DigestSignalRow)` — returns null when hidden
  - [x] T4.2 Constants: `PEOPLE_MATCH_FALLBACK_THRESHOLD = 20` (align with `PEOPLE_HANDLE_MATCH_BONUS` / Epic 68 C6 threshold)
  - [x] T4.3 Add `tests/lib/nexus-people-match.test.ts` covering full handle copy, name copy, fallback, hidden when `personalRelevance < 20`, `@` normalization

- [x] **T5 — Inspector UI chip** (AC: 2, 3, 4)
  - [x] T5.1 Import utilities in `NexusInspectorDrawer.svelte`
  - [x] T5.2 Add `$derived peopleMatchChipViewModel` from `scoredDigestSignal`
  - [x] T5.3 Inside Signal Intelligence dimension `{#each}` loop, after the `personalRelevance` row's bar, render chip when view model non-null:
    ```svelte
    {#if row.key === 'personalRelevance' && peopleMatchChipViewModel}
      <div class="nx-inspector-people-match-chip" aria-label={peopleMatchChipViewModel.ariaLabel}>
        {peopleMatchChipViewModel.label}
      </div>
    {/if}
    ```
  - [x] T5.4 Add `.nx-inspector-people-match-chip` styles in `nexus-theme.css` — compact pill below personal relevance bar; reuse teal accent from disposition `priority` colour

- [x] **T6 — Verify gate** (AC: 4)
  - [x] T6.1 Run `bash scripts/verify.sh` from cns-dashboard
  - [x] T6.2 Manual smoke: signal with `peopleMatch` in Convex (or test fixture via dev tools) → chip shows person name; legacy row with `personalRelevance: 20` + `authorHandle` only → fallback chip; row without bonus → no chip

## Dev Notes

### Prerequisite — layout gate and inspector enrichment (done / in review)

| Dependency | Status |
|------------|--------|
| `digestSignal` inspector mode + feed tap | Shipped 69-4 |
| `scoredDigestSignal` resolution | Shipped 69-4 / 65-9 |
| Merge provenance section pattern | Shipped 69-1 (review) — people chip is **inside** scoring panel, not a new section |
| People scoring bonuses (+20/+10) | Shipped 68-3 |
| `authorHandle` on social signals | Shipped 68-5/68-6 |

### Why push metadata is required (architectural constraint)

`nexus-people.yaml` lives at `~/.hermes/nexus-people.yaml` on the operator machine. **cns-dashboard on Vercel cannot read it.** Person names in the UI require `sourceMetadata.peopleMatch` emitted at scoring/push time in Omnipotent.md. Fallback chip covers legacy Convex rows scored before 69-2 ships.

### Data contract

**Validator addition** (`convex/validators.ts`):

```typescript
peopleMatch: v.optional(v.object({
  personName: v.string(),
  matchedHandle: v.optional(v.string()),
  bonusPoints: v.number(),
  matchType: v.union(v.literal('handle'), v.literal('name')),
})),
```

**Example pushed row** (addendum A3):

```json
"sourceMetadata": {
  "authorHandle": "karpathy",
  "peopleMatch": {
    "personName": "Andrej Karpathy",
    "matchedHandle": "karpathy",
    "bonusPoints": 20,
    "matchType": "handle"
  }
}
```

`getDigestSignalById` / `getDigestSignalsForRun` already return `sourceMetadata` — **no new Convex queries**.

### Scoring insertion point (UPDATE — Omnipotent.md)

`scoreDigestSignals()` today maps signals and returns `{ ...signal, scores, disposition, rankScore }` without enriching metadata. Insert `peopleMatch` merge **inside the map callback** after `scorePersonalRelevance` / `scorePeopleBonuses` logic — reuse `ctx.nexusPeople`.

**Existing helpers to extend (do not duplicate):**

| Function | File | Use |
|----------|------|-----|
| `scorePeopleBonuses` | `score-digest-signals.mjs` | Bonus amounts; refactor shared person lookup into `resolvePeopleMatch` |
| `normalizePeopleHandle` | same | Handle comparison |
| `collectNormalizedWatchHandles` | same | Optional — prefer person-level iteration for name resolution |
| `PEOPLE_HANDLE_MATCH_BONUS` / `PEOPLE_NAME_MATCH_BONUS` | same | `bonusPoints` values |

### Inspector insertion point (UPDATE — cns-dashboard)

Signal Intelligence panel today (`NexusInspectorDrawer.svelte` ~676–717):

```svelte
<ul class="nx-inspector-scoring-dimensions" role="list">
  {#each scoringDimensionRows as row (row.key)}
    <li class="nx-inspector-scoring-dimension-row">
      <!-- label + bar -->
    </li>
    <!-- INSERT people chip HERE when row.key === 'personalRelevance' -->
  {/each}
</ul>
```

Merge provenance remains **below** the entire scoring panel (69-1). Do not relocate it.

`scoredDigestSignal` resolution (preserve):

```typescript
const scoredDigestSignal = $derived(
  inspectorMode === 'digestSignal'
    ? (digestSignalByIdQuery.data ?? null)
    : resolveScoredDigestSignal(digestSignals, digestFocusKeyword)
);
```

### Fallback logic detail

| Condition | Chip |
|-----------|------|
| `peopleMatch` object valid | Full copy (AC3) |
| `personalRelevance >= 20` AND `authorHandle` present | Fallback copy |
| Otherwise | Hidden |

Use `normalizeScorePercent(scores.personalRelevance)` for threshold comparison. A signal can have high personal relevance from **goals/epic bonus without people match** — fallback may show "watchlist boost likely" as **heuristic** when handle present; acceptable per PRD v1. Do not widen fallback to signals without `authorHandle`.

### TypeScript typing note

`DigestSignalRow.sourceMetadata` is `Record<string, unknown>`. Narrow in `nexus-people-match.ts` with runtime guards — same pattern as `nexus-merge-provenance.ts`. Do not use `any`.

### Reuse — do not duplicate

| Utility | Location | Use for |
|---------|----------|---------|
| `normalizeScorePercent` | `nexus-inspector-scoring.ts` | Fallback threshold |
| `scoreDimensionRows` | same | Dimension loop (unchanged) |
| `buildMergeProvenanceViewModel` | `nexus-merge-provenance.ts` | Pattern for pure view-model module |
| `formatDigestSourceBadge` | `nexus-digest-feed.ts` | **Not** used for people chip |

### Testing standards

| Repo | Required tests |
|------|----------------|
| Omnipotent.md | `tests/morning-digest-score-signals.test.mjs` — `peopleMatch` emission |
| cns-dashboard | `tests/lib/nexus-people-match.test.ts` — all copy/visibility logic |
| cns-dashboard | `tests/convex/digest.test.ts` — validator accepts `peopleMatch` |
| Gate | `bash scripts/verify.sh` in each touched repo |

### Architecture compliance

| Constraint | Value |
|------------|-------|
| Stack | SvelteKit 2 + Convex + Tailwind 4 + `convex-svelte` |
| Drawer width | 320px (ADR-E63-003) |
| Mobile | Full-width overlay ≤768px — chip wraps inside dimension column |
| Env vars | No `NEXUS_*` in cns-dashboard (ADR-E63-005) |
| WriteGate / vault | **Not touched** |
| Live URL | https://cns-dashboard-three.vercel.app/nexus |

### Project structure (files to create/modify)

**Omnipotent.md — modify:**

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `tests/morning-digest-score-signals.test.mjs`

**cns-dashboard — create:**

- `src/lib/utils/nexus-people-match.ts`
- `tests/lib/nexus-people-match.test.ts`

**cns-dashboard — modify:**

- `convex/validators.ts`
- `tests/convex/digest.test.ts`
- `src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `src/routes/nexus/nexus-theme.css`

**Do not modify:** dedup engine, feed component (69-4), merge provenance utils (69-1), investigation actions (66), `nexus-people.yaml` loader (68-2)

### Previous story intelligence

| Story | Relevant learning |
|-------|-------------------|
| **68-3** | `scorePeopleBonuses` + constants; handle/name stacking; clamp at 100 |
| **68-11** | `--force-rescore` repushes scored signals — first production path for `peopleMatch` on live rows |
| **69-1** | Pure utility module + drawer `$derived` view model + scoped CSS; merge section is sibling below scoring panel |
| **69-4** | `digestSignal` mode uses `getDigestSignalById` — chip works on feed-tapped rows |
| **65-9** | Signal Intelligence panel structure — chip enriches personal relevance row only |

### Git intelligence

**cns-dashboard:**

```
addf62c feat(epic-69): 69-1 inspector merge provenance section
eae57d6 feat(epic-69): 69-4 digest signal feed + disposition hierarchy layout gate
ddb4a22 feat(epic-68): 68-1 sourceMetadata validators (contributingSources pattern)
```

**Omnipotent.md:**

```
203e2c8 feat(epic-68): 68-3 personalRelevance v3 people bonus
a3ca8c0 feat(epic-68): 68-2 nexus-people.yaml loader
```

69-2 is the first cross-repo Epic 69 story. Ship validator + UI in cns-dashboard first so pushes don't fail validation; then scoring emission in Omnipotent.md (or same PR if coordinated).

### Latest tech notes

- Svelte 5 runes — `$derived` for chip view model
- No new npm packages
- Accessibility: chip text is primary; `aria-label` mirrors visible copy; sufficient contrast on charcoal background

### References

- PRD FR-4, FR-5: `_bmad-output/planning-artifacts/prds/prd-epic-69-2026-06-11/prd.md` §4.3, §6.2
- Addendum A3: same folder `addendum.md`
- UJ-3: PRD §2
- Epic 68-3 story: `_bmad-output/implementation-artifacts/68-3-personal-relevance-v3-people-bonus.md`
- Story 69-1 (inspector patterns): `_bmad-output/implementation-artifacts/69-1-inspector-dedup-merge-provenance.md`
- Story 69-4 (layout gate): `_bmad-output/implementation-artifacts/69-4-digest-signal-feed-disposition-hierarchy.md`
- Scoring script: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- Validator: `cns-dashboard/convex/validators.ts`
- Inspector drawer: `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`
- People example: `scripts/nexus-people.yaml.example`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Hermes skill install gate failed until `install-hermes-skill-morning-digest.sh` synced `score-digest-signals.mjs` to `~/.hermes/skills/cns/morning-digest`.

### Completion Notes List

- Added `resolvePeopleMatch()` in Omnipotent.md scoring; `scoreDigestSignals()` shallow-merges `sourceMetadata.peopleMatch` when a watchlist handle or name bonus applies (handle metadata preferred).
- Extended cns-dashboard `sourceMetadataValidator` with optional `peopleMatch` object.
- Added `nexus-people-match.ts` pure view-model utilities with full copy, fallback (`@{handle} · watchlist boost likely`), and visibility guards.
- Rendered people match chip below Personal Relevance bar in `NexusInspectorDrawer.svelte` with teal accent styling.
- Tests: 5 new scoring tests (Omnipotent.md), 7 UI utility tests + 1 Convex validator test (cns-dashboard).
- `bash scripts/verify.sh` passed in both repos.

### File List

**Omnipotent.md**

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**cns-dashboard**

- `convex/validators.ts`
- `src/lib/utils/nexus-people-match.ts`
- `src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `src/routes/nexus/nexus-theme.css`
- `tests/lib/nexus-people-match.test.ts`
- `tests/convex/digest.test.ts`

### Change Log

- 2026-06-11: Story 69-2 — peopleMatch push metadata (FR-4) + inspector people match chip (FR-5) across Omnipotent.md and cns-dashboard.

### Review Findings

- [x] [Review][Patch] Missing test: dual-match handle precedence — AC1 requires `matchType: 'handle'` when both handle and name bonuses apply; `describe('peopleMatch push metadata (69-2)')` has no signal with matching handle + person name in title. [`tests/morning-digest-score-signals.test.mjs`]
- [x] [Review][Patch] Missing test: fallback suppressed without `authorHandle` — AC2 excludes fallback when handle absent; implementation guards correctly but test only covers low-`personalRelevance` case, not high score + missing handle. [`tests/lib/nexus-people-match.test.ts`]
- [x] [Review][Patch] `sourceMetadata` coerced to `{}` when absent and no match — `scoreDigestSignals` always sets `sourceMetadata: existingMetadata` where `existingMetadata = signal.sourceMetadata ?? {}`, injecting empty object on signals that had no metadata. Prefer preserving field absence when `peopleMatch` is null. [`score-digest-signals.mjs:1555-1561`]
- [x] [Review][Patch] CSS chip missing `align-self: flex-start` — parent `.nx-inspector-scoring-dimension-row` is flex column; chip stretches full width without shrink-wrap. Disposition pill uses `align-self: flex-start` at line 1445; people chip should match for AC3 compact pill. [`nexus-theme.css:1208`]
- [x] [Review][Patch] Missing `@` normalization test on full chip path — T4.3 requires `@` normalization coverage; only `formatFallbackPeopleChip` is tested, not `formatPeopleMatchChip` with `matchedHandle: '@karpathy'`. [`tests/lib/nexus-people-match.test.ts`]
- [x] [Review][Defer] `scorePeopleBonuses` not refactored to delegate to `resolvePeopleMatch` — T1.1 dev note requested shared lookup; handle/name traversal duplicated (~50 lines). Maintenance hazard, not AC failure. [`score-digest-signals.mjs:1265-1295`] — deferred, pre-existing refactor scope
- [x] [Review][Defer] `normalizeScorePercent(1)` → 100 fraction heuristic — pre-existing in `nexus-inspector-scoring.ts`; affects fallback threshold edge at score=1 but not introduced by 69-2. [`nexus-inspector-scoring.ts:48-54`] — deferred, pre-existing
- [x] [Review][Defer] `resolveScoredDigestSignal` bidirectional keyword substring match — pre-existing topic/keyword inspector resolution; not in 69-2 diff. [`NexusInspectorDrawer.svelte`] — deferred, pre-existing
