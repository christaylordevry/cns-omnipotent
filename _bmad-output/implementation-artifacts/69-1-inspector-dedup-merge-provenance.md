---
baseline_commit: cf65264a90476d694ef90645e6b422f1297ebc12
---

# Story 69.1: Inspector Dedup Cluster / Merge Provenance

Status: review

**Epic gate:** Requires **69-4 done** — merge provenance attaches to signal rows opened from the digest feed (`digestSignal` inspector mode) and any inspector path where `scoredDigestSignal` carries dedup metadata. **69-4 is implemented** (`eae57d6` in cns-dashboard).

**Implementation repo:** `../cns-dashboard` (SvelteKit + Convex UI only). **No Omnipotent.md changes** — `contributingSources` and `dedupClusterSize` are already pushed by Epic 68-1.

<!-- Validation: optional `/bmad-create-story` checklist before `/bmad-dev-story`. -->

## Story

As a CNS operator inspecting a deduplicated digest signal in Nexus,
I want the Intelligence Inspector to show which sources were merged and their per-source engagement,
so that I can trust why one ranked row replaced multiple headlines and understand compound engagement behind the score.

## Acceptance Criteria

### AC1 — Merge provenance visibility gate (FR-3)

**Given** the Intelligence Inspector is open with a `scoredDigestSignal`  
**When** `sourceMetadata.dedupClusterSize` is present and `>= 2`  
**Then** a **Merge provenance** section renders **below** the Signal Intelligence panel  
**And** when `dedupClusterSize` is absent or `< 2`, the section is **not rendered** (no empty placeholder)  
**And** the section appears for `digestSignal`, `keyword`, and `topic` inspector modes whenever the resolved signal carries merge metadata

### AC2 — Cluster headline and primary source (FR-3, addendum A2)

**Given** merge provenance is visible  
**When** the section renders  
**Then** the headline reads **"Merged signal (N sources)"** where `N` is `dedupClusterSize` (fallback to `contributingSources.length` when size missing but array has ≥2 entries)  
**And** a **Primary:** line shows the winning `sourceType` on the signal row using `formatDigestSourceTitle()` (long label) with `formatDigestSourceBadge()` badge  
**And** primary label matches the dedup engine winner stored on the row — not recomputed client-side

### AC3 — Contributing source badges and engagement lines (FR-3)

**Given** `sourceMetadata.contributingSources[]` is present  
**When** the section renders  
**Then** each contributor shows:
- A source badge via `formatDigestSourceBadge(contributor.sourceType)` with `formatDigestSourceTitle()` tooltip
- A per-source engagement line using the **best available** metric from that contributor object, in priority order: `points` → `upvotes` → `stars` → `likes` → `commentCount` → `reposts` → `replies` → `quotes` → `forks`

**And** engagement copy examples:
- `842 pts` for HN `points`
- `1.2k likes` for X `likes` (compact thousands when ≥1000)
- `—` when no engagement fields present on that contributor

**And** contributors render in array order (engine order); do not re-sort client-side  
**And** if `contributingSources` is missing but `dedupClusterSize >= 2`, show headline + primary only with muted copy "Contributor details unavailable"

### AC4 — No regressions (FR-3, Epic 66/69-4)

**Given** inspector open on any mode  
**When** merge provenance renders or is hidden  
**Then** Signal Intelligence scoring panel, Epic 66 investigation actions, digest brief, and 69-4 feed → inspector wiring remain unchanged  
**And** `bash scripts/verify.sh` passes in `cns-dashboard`

### AC5 — Out of scope (explicit)

- Omnipotent.md dedup engine or push script changes
- Discord digest merge chips (Nexus-only per PRD §5)
- People match chip (69-2), source health panel (69-3), investigation board (69-5)
- Convex schema/query changes (read path already returns `sourceMetadata` via `getDigestSignalById` / `getDigestSignalsForRun`)
- Re-merging or editing clusters in UI

## Tasks / Subtasks

- [x] **T1 — Pure merge-provenance utilities** (AC: 1, 2, 3)
  - [x] T1.1 Create `$lib/utils/nexus-merge-provenance.ts` with:
    - `ContributingSource` type aligned with `sourceMetadataValidator.contributingSources` entries
    - `MergeProvenanceViewModel` — `{ clusterSize, primarySourceType, contributors: { badge, title, engagementLine }[] }`
    - `shouldShowMergeProvenance(sourceMetadata)` — true when `dedupClusterSize >= 2` OR (`contributingSources?.length >= 2` with explicit cluster size)
    - `resolveClusterSize(sourceMetadata, contributingSources)` — prefer `dedupClusterSize`, else array length
    - `formatContributorEngagement(contributor)` — metric priority + compact number formatting
    - `buildMergeProvenanceViewModel(signal: { sourceType?: string; sourceMetadata?: Record<string, unknown> })`
  - [x] T1.2 Add `tests/lib/nexus-merge-provenance.test.ts` covering:
    - Hidden when `dedupClusterSize` absent and single contributor
    - Visible at `dedupClusterSize: 2` with HN + NewsAPI fixture (mirror `digest.test.ts` Story 68-1 fixture)
    - Engagement priority (`points` over `commentCount`; `likes` formatting)
    - Missing `contributingSources` with `dedupClusterSize >= 2` → degraded view model
    - Twitter `likes: 1200` → `1.2k likes`

- [x] **T2 — Inspector UI section** (AC: 1, 2, 3, 4)
  - [x] T2.1 Import utilities + `formatDigestSourceBadge` / `formatDigestSourceTitle` from `nexus-digest-feed.ts` in `NexusInspectorDrawer.svelte`
  - [x] T2.2 Add `$derived` `mergeProvenanceViewModel` from `scoredDigestSignal`
  - [x] T2.3 Insert `<section aria-label="Merge provenance">` **immediately after** Signal Intelligence `</section>` (~line 712 today)
  - [x] T2.4 Markup per addendum A2 wireframe:
    - Headline `Merged signal (N sources)`
    - Badge row for all contributors
    - Per-contributor engagement lines (`HN 842 pts · NewsAPI —` pattern)
    - `Primary: {title}` footer
  - [x] T2.5 Add scoped styles in `nexus-theme.css`: `.nx-inspector-merge-provenance`, badge chips, engagement list — match existing `.nx-inspector-section` / charcoal tokens; reuse digest feed badge styling where possible

- [x] **T3 — Verify gate** (AC: 4)
  - [x] T3.1 Run `bash scripts/verify.sh` from `cns-dashboard`
  - [x] T3.2 Manual smoke: open merged signal from digest feed (or Convex row with `dedupClusterSize: 2`) → merge section visible; open singleton signal → section absent

## Dev Notes

### Prerequisite — 69-4 layout gate (done)

69-4 shipped `digestSignal` inspector mode and `NexusDigestSignalFeed`. Merge provenance is the first inspector enrichment on feed-opened rows.

| Dependency | Status |
|------------|--------|
| `openInspectorForDigestSignal` | Shipped 69-4 |
| `getDigestSignalById` returns `sourceMetadata` | Shipped 63-6 / 68-1 |
| `formatDigestSourceBadge` / `formatDigestSourceTitle` | Shipped 69-4 (`nexus-digest-feed.ts`) |

### Data contract (already in Convex — Epic 68-1)

```typescript
// convex/validators.ts — sourceMetadataValidator (excerpt)
contributingSources: v.optional(v.array(v.object({
  sourceType: v.string(),
  url: v.optional(v.string()),
  points: v.optional(v.number()),
  upvotes: v.optional(v.number()),
  stars: v.optional(v.number()),
  forks: v.optional(v.number()),
  commentCount: v.optional(v.number()),
  likes: v.optional(v.number()),
  reposts: v.optional(v.number()),
  replies: v.optional(v.number()),
  quotes: v.optional(v.number()),
  publishedAt: v.optional(v.string()),
}))),
dedupClusterSize: v.optional(v.number())
```

**Test fixture** (from `tests/convex/digest.test.ts` Story 68-1):

```typescript
sourceMetadata: {
  points: 200,
  commentCount: 45,
  dedupClusterSize: 2,
  contributingSources: [
    { sourceType: 'hackernews', url: '...', points: 200, commentCount: 45 },
    { sourceType: 'newsapi', url: '...', publishedAt: '2026-06-11T08:00:00.000Z' }
  ]
}
// Row sourceType: 'hackernews' (primary winner)
```

`getDigestSignalById` and `toDigestSignalListItem` already pass `sourceMetadata` through — **no Convex edits required**.

### Inspector insertion point (UPDATE file — read before editing)

`NexusInspectorDrawer.svelte` today:

```svelte
{#if showScoringPanel && scoredDigestSignal}
  <section class="nx-inspector-section nx-inspector-scoring-panel" aria-label="Signal Intelligence">
    <!-- disposition, rankScore, dimension bars -->
  </section>
{/if}
<!-- INSERT Merge provenance HERE -->
{#if topicSlug}
  <section aria-label="Source trace">...</section>
```

`scoredDigestSignal` resolution (preserve):

```typescript
const scoredDigestSignal = $derived(
  inspectorMode === 'digestSignal'
    ? (digestSignalByIdQuery.data ?? null)
    : resolveScoredDigestSignal(digestSignals, digestFocusKeyword)
);
```

Merge section keys off `scoredDigestSignal.sourceMetadata` — works for feed taps and keyword/topic paths when the matched row is a merged cluster.

### UI wireframe (addendum A2)

```
┌─ Merged signal (3 sources) ─────────────┐
│ [HN] [NA] [TW]  ← badge row             │
│ HN 842 pts · NewsAPI — · X 1.2k likes   │
│ Primary: HackerNews                     │
└─────────────────────────────────────────┘
```

Use `formatDigestSourceBadge` for `[HN]` chips (not `sourceDisplayLabel` alone — digest sources need PH/TW/BS abbreviations).

### Engagement formatter rules

| Field | Display pattern |
|-------|-----------------|
| `points` | `{n} pts` |
| `upvotes` | `{n} upvotes` |
| `stars` | `{n} stars` |
| `likes` | `{n} likes` (compact `1.2k` when n ≥ 1000) |
| `commentCount` | `{n} comments` |
| `reposts` | `{n} reposts` |
| none | `—` |

Pick **first** metric in priority list that is a finite number. Do not concatenate multiple metrics per contributor in v1.

### TypeScript typing note

`DigestSignalRow.sourceMetadata` is `Record<string, unknown>` in `nexus-inspector-scoring.ts`. In `nexus-merge-provenance.ts`, narrow with runtime guards before reading `contributingSources` / `dedupClusterSize`. Do not widen to `any`.

### Reuse — do not duplicate

| Utility | Location | Use for |
|---------|----------|---------|
| `formatDigestSourceBadge` | `nexus-digest-feed.ts` | Contributor + primary badges |
| `formatDigestSourceTitle` | `nexus-digest-feed.ts` | Tooltips, Primary line |
| `sourceDisplayLabel` | `trend-panel-format.ts` | Fallback only — digest-specific types need digest helpers |
| `hasScoringPanel` / scoring panel | `nexus-inspector-scoring.ts` | Unchanged |

### Testing standards

- **Unit (required):** `tests/lib/nexus-merge-provenance.test.ts` — all formatting and visibility logic; **must not** live only in Svelte
- **Convex:** no new tests (contract covered by 68-1 `digest.test.ts`)
- **Component:** optional; prefer utility coverage
- **Gate:** `bash scripts/verify.sh` from `cns-dashboard` repo root

### Architecture compliance

| Constraint | Value |
|------------|-------|
| Stack | SvelteKit 2 + Convex + Tailwind 4 + `convex-svelte` |
| Drawer width | 320px (ADR-E63-003) |
| Mobile | Full-width overlay ≤768px — merge section scrolls inside drawer body |
| Env vars | No `NEXUS_*` in cns-dashboard (ADR-E63-005) |
| Live URL | https://cns-dashboard-three.vercel.app/nexus |
| WriteGate / vault | **Not touched** |

### Project structure (files to create/modify)

**Create:**

- `cns-dashboard/src/lib/utils/nexus-merge-provenance.ts`
- `cns-dashboard/tests/lib/nexus-merge-provenance.test.ts`

**Modify:**

- `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `cns-dashboard/src/routes/nexus/nexus-theme.css`

**Do not modify:** Omnipotent.md, `convex/validators.ts`, dedup engine, feed component (69-4), people match (69-2)

### Previous story intelligence

| Story | Relevant learning |
|-------|-------------------|
| **68-1** | `contributingSources[]` + `dedupClusterSize` pushed at scoring; winner `sourceType` on row; engagement snapshots per loser |
| **69-4** | `digestSignal` inspector mode; feed opens exact row via `getDigestSignalById`; badge helpers in `nexus-digest-feed.ts` |
| **65-9** | Signal Intelligence panel patterns — merge section is sibling below, same `.nx-inspector-section` rhythm |
| **66-3** | Investigation actions keyed on `digestSignalId` — do not block or relocate action footer |

### Git intelligence (cns-dashboard)

```
eae57d6 feat(epic-69): 69-4 digest signal feed + disposition hierarchy layout gate
ddb4a22 feat(epic-68): 68-1 sourceMetadata contributingSources + dedupClusterSize validators
```

69-1 is the first inspector enrichment after the feed gate. Product Hunt / social rows in feed are cosmetic elsewhere; merge section only activates on dedup metadata.

### Latest tech notes

- Svelte 5 runes — match existing drawer (`$derived` for view model)
- No new npm packages
- Accessibility: section `aria-label="Merge provenance"`; engagement lines are text (not colour-only); badges have `title` tooltips

### References

- PRD FR-3: `_bmad-output/planning-artifacts/prds/prd-epic-69-2026-06-11/prd.md` §4.2
- Addendum A2: same folder `addendum.md`
- Epic 68-1 story: `_bmad-output/implementation-artifacts/68-1-cross-source-dedup-engine.md`
- Story 69-4 (layout gate): `_bmad-output/implementation-artifacts/69-4-digest-signal-feed-disposition-hierarchy.md`
- Validator contract: `cns-dashboard/convex/validators.ts` `sourceMetadataValidator`
- Inspector drawer: `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`
- Digest fixture test: `cns-dashboard/tests/convex/digest.test.ts` (Story 68-1 case)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

None

### Completion Notes List

- Added `nexus-merge-provenance.ts` with visibility gate (`dedupClusterSize >= 2`), cluster size resolution, engagement formatting (metric priority + compact thousands for likes), and view-model builder reusing digest badge helpers.
- Wired merge provenance section into `NexusInspectorDrawer.svelte` immediately below Signal Intelligence; section keys off `scoredDigestSignal.sourceMetadata` for digestSignal/keyword/topic modes.
- Degraded state shows "Contributor details unavailable" when `dedupClusterSize >= 2` but `contributingSources` absent.
- Five unit tests cover visibility, HN+NewsAPI fixture, engagement priority, compact likes, and degraded view model.
- `bash scripts/verify.sh` passed in cns-dashboard (475 tests, lint, typecheck, build).

### File List

- `cns-dashboard/src/lib/utils/nexus-merge-provenance.ts` (created)
- `cns-dashboard/tests/lib/nexus-merge-provenance.test.ts` (created)
- `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte` (modified)
- `cns-dashboard/src/routes/nexus/nexus-theme.css` (modified)

### Change Log

- 2026-06-11: Story 69-1 — Inspector merge provenance section + pure utilities (cns-dashboard)
