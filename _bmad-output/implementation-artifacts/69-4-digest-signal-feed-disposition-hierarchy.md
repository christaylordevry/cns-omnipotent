# Story 69.4: Digest Signal Feed + Disposition Hierarchy

Status: done

**Epic gate:** This is the **layout gate** for Epic 69. Stories 69-1, 69-2, 69-3, and 69-5 attach to surfaces that assume a ranked digest feed exists on `/nexus`. Do not start those stories until 69-4 is **done**.

**Implementation repo:** `../cns-dashboard` (SvelteKit + Convex). No Omnipotent.md code changes in this story.

<!-- Validation: optional `/bmad-create-story` checklist before `/bmad-dev-story`. -->

## Story

As a CNS operator triaging the morning digest on Nexus,
I want a ranked digest signal feed with clear disposition hierarchy on the main cockpit surface,
so that I can see `priority` and `escalate` signals first and open the inspector on any row without leaving `/nexus`.

## Acceptance Criteria

### AC1 — Digest signal feed on `/nexus` (FR-1)

**Given** the operator opens `/nexus`  
**When** the latest `digestRun` exists with scored `digestSignals`  
**Then** a new **Digest Signal Feed** zone renders in the center column **above** `NexusAnomalyFeedZone` (below `NexusHeroChartZone`)  
**And** the feed subscribes reactively to `getLatestDigestBrief` (no `focusKeyword` — latest run by `ranAt` desc) plus `getDigestSignalsForRun` for that run's `digestRunId`  
**And** each card shows: **title**, **primary source badge**, **disposition chip** (text label, not colour-only), **rankScore** (normalized percent when present)  
**And** tapping a card opens the Intelligence Inspector scoped to **that digest signal** (not a keyword/topic guess)  
**And** Signal Seeds rail (`NexusSignalSeedsRail`) is unchanged  
**And** when no completed digest run exists or the run has zero signals, an empty state renders with copy explaining the next morning digest will populate the feed (no broken layout)

### AC2 — Disposition sort and tier grouping (FR-1)

**Given** multiple signals with `disposition` and `rankScore`  
**When** the feed renders  
**Then** signals are grouped by disposition tier in order: `priority` → `escalate` → `watch` → `ignore`  
**And** within each tier, signals sort by `rankScore` descending (signals without `rankScore` sort after scored rows, preserving stable order via legacy `rank` asc as tiebreaker — mirror `compareSignalsByRank` semantics in `convex/digest.ts`)  
**And** sort/group logic lives in `$lib/utils/nexus-digest-feed.ts` with Vitest coverage (not inline in the Svelte component)

### AC3 — Disposition visual hierarchy (FR-2)

**Given** signals in each disposition tier  
**When** the feed renders on desktop and mobile (≤768px)  
**Then** styling reuses `dispositionColour()` and `DISPOSITION_COLOURS` from `$lib/utils/nexus-inspector-scoring.ts` per addendum A4:

| Disposition | Feed treatment |
|-------------|----------------|
| `priority` | Pinned top section; 3px left border accent `#00D4AA`; elevated card shadow |
| `escalate` | Second pinned section; red accent `#EF4444` |
| `watch` | Standard cards with disposition badge |
| `ignore` | "Low priority" accordion **collapsed by default on mobile**; expanded on desktop |

**And** every disposition chip includes visible text (`Priority`, `Escalate`, `Watch`, `Ignore`) — colour is supplementary (WCAG: not colour-alone)  
**And** on mobile, `priority` tier shows at most **5** cards before a "Show all priority" control expands the rest  
**And** `bash scripts/verify.sh` passes in `cns-dashboard`

### AC4 — Inspector wiring for feed cards (FR-1, layout gate)

**Given** the operator taps a digest feed card  
**When** the inspector opens  
**Then** the drawer shows the **Signal Intelligence** panel for the tapped signal's `digestSignalId` (scores, disposition, rankScore)  
**And** Epic 66 investigation actions (Explain / Compare / Trace / Ask AI) remain functional for that signal when `digestSignalId` resolves  
**And** existing topic/keyword inspector modes (`openInspectorForTopic`, `openInspectorForKeyword`, Signal Seeds rail) are unchanged

### AC5 — Out of scope (explicit)

- Merge provenance section (69-1), people match chip (69-2), source health panel (69-3), investigation board / "Add to investigate" (69-5)
- New Convex mutations or schema changes (read queries only; optional convenience query allowed if it reduces duplicate subscriptions)
- Omnipotent.md push/scoring script changes
- Replacing or removing `NexusAnomalyFeedZone` or hero chart

## Tasks / Subtasks

- [ ] **T1 — Pure feed utilities** (AC: 2)
  - [ ] T1.1 Create `$lib/utils/nexus-digest-feed.ts` with:
    - `DISPOSITION_TIER_ORDER` constant
    - `groupSignalsByDispositionTier(signals)` → ordered tier groups
    - `sortSignalsWithinTier(a, b)` — rankScore desc, legacy rank tiebreaker
    - `formatDispositionLabel(disposition)` — human-readable chip text
    - `formatDigestSourceBadge(sourceType)` — extend beyond seed rail types (github, reddit, rss, producthunt, twitter, bluesky, deep_signal, perplexity, etc.); fall back to uppercase prefix or `sourceDisplayLabel()` where sensible
  - [ ] T1.2 Add `tests/lib/nexus-digest-feed.test.ts` covering tier order, within-tier sort, signals missing disposition (bucket as `watch` or dedicated "unscored" section — document choice in test name)

- [ ] **T2 — Nexus context: digest-signal inspector mode** (AC: 4)
  - [ ] T2.1 Extend `NexusDrawerPayload` in `$lib/context/nexus-context.ts`:
    ```typescript
    | { mode: 'digestSignal'; digestSignalId: Id<'digestSignals'>; digestRunId: Id<'digestRuns'> }
    ```
  - [ ] T2.2 Add `openInspectorForDigestSignal(digestSignalId, digestRunId)` helper
  - [ ] T2.3 Update `NexusInspectorDrawer.svelte`:
    - When `mode === 'digestSignal'`, subscribe to `api.digest.getDigestSignalById` (skip when drawer closed)
    - Use returned row as `scoredDigestSignal` directly (bypass `resolveScoredDigestSignal` keyword matching)
    - Header: signal **title** + source badge; topic-specific sections (WoW delta, trace, related signals) skip or show digest-appropriate empty states — do not crash or show wrong topic data
    - Preserve investigation session wiring keyed on `digestSignalId` (existing Epic 66 paths)

- [ ] **T3 — Feed component** (AC: 1, 3)
  - [ ] T3.1 Create `$lib/components/nexus/NexusDigestSignalFeed.svelte`
  - [ ] T3.2 Wire Convex subscriptions (`getLatestDigestBrief` + `getDigestSignalsForRun`, limit 100)
  - [ ] T3.3 Render tier sections with pinned priority/escalate headers
  - [ ] T3.4 Card click → `openInspectorForDigestSignal`
  - [ ] T3.5 Loading skeleton, error boundary copy, empty state
  - [ ] T3.6 Mobile ignore-tier accordion + priority "Show all" (match `nexus-theme.css` panel patterns)

- [ ] **T4 — Page integration + styles** (AC: 1, 3)
  - [ ] T4.1 Import feed in `src/routes/nexus/+page.svelte` inside `.nx-center-column` **above** `NexusAnomalyFeedZone`
  - [ ] T4.2 Add scoped styles to `nexus-theme.css`: `.nx-digest-feed`, `.nx-digest-card`, tier headers, pinned borders, mobile accordion — follow existing `.nx-panel` / charcoal shell tokens

- [ ] **T5 — Verify gate** (AC: 3)
  - [ ] T5.1 Run `bash scripts/verify.sh` from `cns-dashboard` (npm test + Omnipotent sibling hook if configured)
  - [ ] T5.2 Manual smoke: `/nexus` with live Convex data — priority signals visible above watch/ignore; card tap opens inspector with correct scoring panel

## Dev Notes

### Layout gate — downstream Epic 69 consumers

| Story | Depends on 69-4 because… |
|-------|--------------------------|
| **69-1** | Inspector merge provenance attaches to signal rows opened from feed |
| **69-2** | People match chip sits in Signal Intelligence panel opened from feed |
| **69-3** | Empty-state copy may link to source health panel beside feed |
| **69-5** | "Add to investigate" action targets feed cards (defer to 69-5) |

### Current `/nexus` page (no digest list today)

```svelte
<!-- src/routes/nexus/+page.svelte — today -->
<NexusSignalSeedsRail />
<div class="nx-main-grid">
  <div class="nx-center-column">
    <NexusHeroChartZone />
    <!-- INSERT NexusDigestSignalFeed HERE -->
    <NexusAnomalyFeedZone />
  </div>
  <NexusSourceWeightsPanel />
</div>
```

PRD assumption A1: **no ranked digest list exists on `/nexus` today** — this story creates it.

### Convex read surface (already shipped — Epic 63.6 / 64)

| Query | Args | Returns |
|-------|------|---------|
| `digest.getLatestDigestBrief` | `{ focusKeyword?: string }` | Latest run brief or `null`; omit keyword for global latest |
| `digest.getDigestSignalsForRun` | `{ digestRunId, limit?: number }` | Up to 100 signals, server-sorted by `rankScore` desc |
| `digest.getDigestSignalById` | `{ digestSignalId }` | Single signal list item or `null` |

**Do not** change `compareSignalsByRank` server behavior unless client tier grouping cannot match — client must apply **disposition tier** ordering on top of server rank sort.

Optional: add `getLatestDigestSignals` convenience query wrapping brief + signals in one round-trip — only if duplicate subscriptions cause measurable flicker; not required for AC.

### Inspector digest path today (must extend)

`NexusInspectorDrawer.svelte` already loads digest data for **topic/keyword** modes:

```typescript
// Lines ~166-188 — keyword/topic path only today
digestBriefQuery → getLatestDigestBrief({ focusKeyword })
digestSignalsQuery → getDigestSignalsForRun({ digestRunId, limit: 50 })
scoredDigestSignal = resolveScoredDigestSignal(digestSignals, digestFocusKeyword)
```

**69-4 requirement:** new `digestSignal` mode uses `getDigestSignalById` so feed card tap shows the **exact** row, not best keyword match.

### Disposition tokens (reuse — do not duplicate)

```typescript
// $lib/utils/nexus-inspector-scoring.ts
export const DISPOSITION_COLOURS = {
  priority: '#00D4AA',
  watch: '#F59E0B',
  ignore: '#6B7280',
  escalate: '#EF4444',
};
export function dispositionColour(disposition) { ... }
```

### Source badge mapping

- Seed rail `formatSourceBadge()` only covers `google_trends | newsapi | arxiv | hackernews | digest_history`
- Digest feed must handle full `digestSourceTypeValue` union (`github`, `reddit`, `rss`, `producthunt`, `twitter`, `bluesky`, `deep_signal`, …)
- Prefer a new `formatDigestSourceBadge()` in `nexus-digest-feed.ts` with Vitest; use `sourceDisplayLabel()` for tooltip/long label if needed

### Signals missing disposition

Epic 64 scoring should populate `disposition` on pushed signals. Legacy rows may lack it:

- **Recommended:** treat missing disposition as `watch` tier (neutral) — document in utility JSDoc
- Do not hide unscored signals entirely

### Testing standards

- **Unit:** `tests/lib/nexus-digest-feed.test.ts` — tier grouping, sort, badge labels
- **Convex:** no new tests required unless adding convenience query
- **Component:** optional lightweight test for empty state props; sort logic must not live only in Svelte
- **Gate:** `bash scripts/verify.sh` from repo root `cns-dashboard`

### Architecture compliance

| Constraint | Value |
|------------|-------|
| Stack | SvelteKit 2 + Convex + Tailwind 4 + `convex-svelte` |
| Drawer width | 320px (ADR-E63-003) |
| Env vars | No `NEXUS_*` names in cns-dashboard (ADR-E63-005) |
| Live URL | https://cns-dashboard-three.vercel.app/nexus |

### Project structure (files to create/modify)

**Create:**

- `cns-dashboard/src/lib/utils/nexus-digest-feed.ts`
- `cns-dashboard/src/lib/components/nexus/NexusDigestSignalFeed.svelte`
- `cns-dashboard/tests/lib/nexus-digest-feed.test.ts`

**Modify:**

- `cns-dashboard/src/routes/nexus/+page.svelte`
- `cns-dashboard/src/lib/context/nexus-context.ts`
- `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `cns-dashboard/src/routes/nexus/nexus-theme.css`

**Do not modify:** Omnipotent.md scoring/push scripts, Signal Seeds rail, anomaly feed logic, investigation board (69-5)

### Previous story intelligence (Epic 63 / 64 / 67)

- **63-6:** Established digest read queries and inspector "Why this matters" wiring — reuse query names, skip-when-closed `useQuery` pattern
- **63-5 / ADR-E63-003:** `closeDrawer()` keeps payload for instant reopen — new `digestSignal` payload must follow same contract
- **64-x:** `disposition`, `rankScore`, five-dimension `scores` on pushed signals — feed displays these fields
- **67-4:** Signal Seeds open keyword/topic inspector modes — do not regress chip rail → inspector paths
- **65-9:** Inspector scoring panel patterns (`hasScoringPanel`, dimension bars) — reuse for digestSignal mode

### Git intelligence (cns-dashboard)

Recent epic work on digest validators and social metadata (68-4, 68-1) — feed cards should render twitter/bluesky/github rows without layout break. Product Hunt and dedup metadata display is cosmetic only in 69-4 (merge section is 69-1).

### Latest tech notes

- Svelte 5 runes (`$state`, `$derived`, `$props`) — match existing nexus components
- `convex-svelte` `useQuery(api.x.y, () => condition ? args : 'skip')` — mandatory for drawer/feed subscriptions
- No new npm packages

### References

- PRD: `_bmad-output/planning-artifacts/prds/prd-epic-69-2026-06-11/prd.md` §4.1, §6.2, gate pattern §0
- Addendum A4 (disposition hierarchy): `./addendum.md` in same PRD folder
- Epic 63 architecture: `cns-dashboard/_bmad-output/planning-artifacts/architecture-epic-63-nexus-cockpit.md`
- Digest queries: `cns-dashboard/convex/digest.ts`
- Inspector scoring utils: `cns-dashboard/src/lib/utils/nexus-inspector-scoring.ts`
- Story 63-6 (digest query patterns): `cns-dashboard/_bmad-output/implementation-artifacts/63-6-polish-pass-digest-read-queries.md`

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List
