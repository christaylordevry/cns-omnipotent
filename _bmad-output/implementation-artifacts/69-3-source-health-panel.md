---
baseline_commit: a55caf11390dce1b6cd8f761f011396e09953273
---

# Story 69.3: Source Health Panel — Query + Push Outcomes + UI

Status: review

**Epic gate:** Requires **69-4 done** (layout gate — `/nexus` digest feed exists). **69-4 is done** (`eae57d6`). Panel attaches to the **right column** beside the digest feed; empty-state copy in the feed may reference source health (optional polish).

**Repo boundary:** **Split story** — FR-6 query + FR-8 UI in **cns-dashboard**; FR-7 optional `sourceOutcomes` push metadata in **Omnipotent.md** completion scripts. No new adapters, no vault WriteGate, no Hermes skill format changes.

**Sequencing note (PRD §6.2):** Ship **inference-only query + panel first** (69-3a path); add **push metadata** (69-3b) in the same story or as a follow-up commit within this story — panel must work without `sourceOutcomes` on legacy runs.

<!-- Validation: optional `/bmad-create-story` checklist before `/bmad-dev-story`. -->

## Story

As a CNS operator triaging the morning digest on Nexus,
I want an at-a-glance view of which of the twelve morning-digest sources fired, failed, or were unavailable on the latest run,
so that I can explain a thin digest or credential failures without re-reading the Discord post or local artifact files.

## Acceptance Criteria

### AC1 — getDigestSourceHealth query (FR-6)

**Given** a completed `digestRun` exists  
**When** `getDigestSourceHealth({ digestRunId })` is called  
**Then** it returns **exactly twelve rows** in canonical registry order (addendum A1):

| Order | `sourceKey` | Label |
|-------|-------------|-------|
| 1 | `google_trends` | Google Trends |
| 2 | `newsapi` | NewsAPI |
| 3 | `deep_signal` | Perplexity |
| 4 | `arxiv` | arXiv |
| 5 | `hackernews` | HackerNews |
| 6 | `notebook` | Notebook |
| 7 | `github` | GitHub |
| 8 | `reddit` | Reddit |
| 9 | `rss` | RSS |
| 10 | `producthunt` | Product Hunt |
| 11 | `twitter` | X |
| 12 | `bluesky` | Bluesky |

**And** each row shape is `{ sourceKey, label, status, signalCount?, reason?, inferenceMode: 'metadata' | 'inferred' }`  
**And** `status` is one of: `fired` | `unavailable` | `error` | `unknown`

**Preferred path (`inferenceMode: 'metadata'`):** when `digestRuns.sourceOutcomes[]` is present on the run, map outcomes by `sourceKey` — trust pushed status and reason verbatim; fill `signalCount` when provided.

**Fallback path (`inferenceMode: 'inferred'`):** when `sourceOutcomes` absent:

| sourceKey | `fired` when | `unknown` when |
|-----------|--------------|----------------|
| `google_trends` | `run.topTrend` non-empty | no topTrend |
| `newsapi` | ≥1 signal `sourceType === 'newsapi'` OR in any `contributingSources` | else |
| `deep_signal` | `run.deepSignalSummary` non-empty OR signal `sourceType === 'deep_signal'` | else |
| `arxiv` | signal `sourceType === 'arxiv'` OR in contributingSources | else |
| `hackernews` | signal `sourceType === 'hackernews'` OR in contributingSources | else |
| `notebook` | `run.notebookId` non-empty | else |
| `github` … `bluesky` | matching `sourceType` OR in contributingSources | else |

**And** `signalCount` on inferred path = count of `digestSignals` where row `sourceType === sourceKey` **plus** count of contributing-source appearances for that key (dedupe by signal id — count primary row only, not double-count contributors on same signal)  
**And** `unavailable` and `error` statuses **cannot** be inferred without push metadata — inference path never emits them (only `fired` or `unknown`)  
**And** Convex unit tests cover: (a) run with `sourceOutcomes` including unavailable + reason, (b) run without metadata inferring fired/unknown from signals + run fields, (c) empty run → all `unknown`

### AC2 — sourceOutcomes push metadata (FR-7, optional but in-scope)

**Given** morning digest completion runs in Omnipotent.md  
**When** `run-digest-convex-completion.mjs` builds or replays the digest push payload  
**Then** `run.sourceOutcomes[]` may be attached before Convex push:

```typescript
type SourceOutcome = {
  sourceKey: string;
  status: 'fired' | 'unavailable' | 'error';
  signalCount?: number;
  reason?: string;
};
```

**And** `digestRunRowValidator` + `digestRunInputValidator` accept optional `sourceOutcomes` array with validated entries  
**And** parser extracts outcomes from digest artifact markdown OR assembled push context:
- Section fired with content → `status: 'fired'`, `signalCount` from mapped signals when known
- Line matching `- (source unavailable: …)` under section → `status: 'unavailable'`, `reason` = captured text
- Adapter hard error (when detectable from completion backfill) → `status: 'error'`, `reason` set

**And** `push-digest-convex.mjs` passes `sourceOutcomes` through on `createDigestRun` when present in payload  
**And** tests in `tests/run-digest-convex-completion.test.mjs` (or dedicated parser test) cover parsing `(source unavailable: X credentials not configured)` → `{ sourceKey: 'twitter', status: 'unavailable', reason: '…' }`  
**And** `bash scripts/verify.sh` passes in **Omnipotent.md**

### AC3 — Source health panel UI (FR-8)

**Given** the operator opens `/nexus`  
**When** the latest completed digest run resolves via `getLatestDigestBrief`  
**Then** `NexusSourceHealthPanel.svelte` renders in the **right column below** `NexusSourceWeightsPanel`  
**And** the panel subscribes to `getDigestSourceHealth({ digestRunId })` reactively (same run as digest feed)  
**And** all twelve sources display with **text labels** (not colour-only): green dot + "Fired", amber + "Unavailable", red + "Error", gray + "Unknown"  
**And** tap/hover on a source shows tooltip with `reason` (when present) and signal count  
**And** when `inferenceMode === 'inferred'` for any row, panel footer shows disclaimer: **"Status inferred from signals — run metadata not yet pushed"**  
**And** mobile (≤768px): horizontal scroll chip row (addendum A7) — same pattern as Signal Seeds rail overflow  
**And** loading skeleton + error copy when query fails; empty when no digest run exists ("No digest run yet")

### AC4 — Distinction from NexusSourceWeightsPanel (regression guard)

**Given** both panels visible on `/nexus`  
**When** rendered  
**Then** **Source weights** panel continues showing Epic 44 **trend ingest** sources (`getSignalSources` — google_trends/reddit/news cron health)  
**And** **Source health** panel shows **morning-digest twelve-source** run outcomes — do not merge or replace weights panel  
**And** `bash scripts/verify.sh` passes in **cns-dashboard**

### AC5 — No regressions (Epic 66/69)

**Given** `/nexus` with feed, inspector, and weights panel  
**When** source health panel added  
**Then** digest feed (69-4), inspector enrichments (69-1, 69-2), hero chart, anomaly feed, and Epic 66 investigation actions remain unchanged  
**And** no changes to scoring, dedup, or adapter scripts beyond FR-7 completion-hook metadata

### AC6 — Out of scope (explicit)

- New source adapters (Epic 68 owns ingest)
- Replacing `NexusSourceWeightsPanel` or trend-ingest health strip
- Discord digest source status formatting
- Google Trends as `digestSignal` rows (keyword pipeline only — health via `topTrend` / outcomes)
- Investigation board (69-5)
- Real-time streaming during digest run (refresh on Convex subscription after run completes)

## Tasks / Subtasks

### cns-dashboard — FR-6 query + validators

- [x] **T1 — Validators + schema** (AC: 1, 2)
  - [x] T1.1 Add `digestSourceOutcomeValidator` and `digestSourceHealthStatusValue` in `convex/validators.ts`:
    ```typescript
    export const digestSourceHealthStatusValue = v.union(
      v.literal('fired'),
      v.literal('unavailable'),
      v.literal('error'),
      v.literal('unknown')
    );
    export const digestSourceOutcomeValidator = v.object({
      sourceKey: v.string(),
      status: v.union(v.literal('fired'), v.literal('unavailable'), v.literal('error')),
      signalCount: v.optional(v.number()),
      reason: v.optional(v.string()),
    });
    ```
  - [x] T1.2 Extend `digestRunRowValidator` + `digestRunInputValidator` with optional `sourceOutcomes: v.optional(v.array(digestSourceOutcomeValidator))`
  - [x] T1.3 Add `digestSourceHealthRowValidator` for query return type

- [x] **T2 — Registry + inference utilities** (AC: 1)
  - [x] T2.1 Create `convex/lib/digest-source-registry.ts` (or `$lib/utils/nexus-source-health.ts` for shared constants — prefer **convex/lib** for query-side logic, re-export labels to UI):
    - `DIGEST_SOURCE_HEALTH_REGISTRY` — twelve entries `{ sourceKey, label }` in A1 order
    - `inferSourceHealthFromRun(run, signals)` — implements fallback table from AC1
    - `mergeSourceOutcomes(outcomes, inferred)` — metadata wins per sourceKey
  - [x] T2.2 Add `tests/convex/digest-source-health.test.ts` (or extend `digest.test.ts`) for metadata path, inference path, empty run

- [x] **T3 — getDigestSourceHealth query** (AC: 1)
  - [x] T3.1 Export `getDigestSourceHealth` from `convex/digest.ts`:
    ```typescript
    export const getDigestSourceHealth = query({
      args: { digestRunId: v.id('digestRuns') },
      returns: v.object({
        digestRunId: v.id('digestRuns'),
        ranAt: v.number(),
        inferenceMode: v.union(v.literal('metadata'), v.literal('inferred')),
        sources: v.array(digestSourceHealthRowValidator),
      }),
      handler: async (ctx, { digestRunId }) => { /* load run + signals, build twelve rows */ },
    });
    ```
  - [x] T3.2 Load signals via `by_digestRunId` index (collect bounded — same run, typically <100 rows)
  - [x] T3.3 Set query-level `inferenceMode: 'metadata'` when `run.sourceOutcomes?.length`; else `'inferred'`

### cns-dashboard — FR-8 UI panel

- [x] **T4 — Pure UI view-model utilities** (AC: 3)
  - [x] T4.1 Create `$lib/utils/nexus-source-health.ts` with:
    - `SourceHealthRowViewModel` — `{ sourceKey, label, statusLabel, statusTone, signalCount?, reason?, tooltipText, ariaLabel }`
    - `formatSourceHealthTooltip(row)` — reason + count copy
    - `buildSourceHealthChipViewModels(sources, inferenceMode)` — maps query rows to chip UI
  - [x] T4.2 Status tone map: `fired` → green `#22C55E`, `unavailable` → amber `#F59E0B`, `error` → red `#EF4444`, `unknown` → gray `#6B7280` (text labels required per AC3)
  - [x] T4.3 Add `tests/lib/nexus-source-health.test.ts` — tooltip copy, disclaimer flag, all twelve labels present

- [x] **T5 — NexusSourceHealthPanel component** (AC: 3, 4)
  - [x] T5.1 Create `$lib/components/nexus/NexusSourceHealthPanel.svelte`
  - [x] T5.2 Subscribe: `getLatestDigestBrief` → `getDigestSourceHealth` (skip when no run)
  - [x] T5.3 Render `.nx-panel.nx-source-health-panel` with chip grid (desktop) / horizontal scroll (mobile)
  - [x] T5.4 Tooltip on focus/hover using native `title` or existing Nexus tooltip pattern from weights panel error lines
  - [x] T5.5 Inference disclaimer footer when `inferenceMode === 'inferred'`

- [x] **T6 — Page integration + styles** (AC: 3, 4)
  - [x] T6.1 Update `src/routes/nexus/+page.svelte`:
    ```svelte
    <div class="nx-right-column">
      <NexusSourceWeightsPanel />
      <NexusSourceHealthPanel />
    </div>
    ```
    Wrap right-column panels if not already grouped (preserve grid `nx-main-grid` layout)
  - [x] T6.2 Add `.nx-source-health-panel`, `.nx-source-health-chip`, scroll row, status dots in `nexus-theme.css` — mirror `.nx-weights-panel` spacing; right column stacks vertically

- [x] **T7 — Verify gate** (AC: 4, 5)
  - [x] T7.1 Run `bash scripts/verify.sh` from cns-dashboard
  - [x] T7.2 Manual smoke: live `/nexus` — twelve chips, fired sources match signal counts; legacy run shows inference disclaimer

### Omnipotent.md — FR-7 push metadata (optional gate within story)

- [x] **T8 — Outcome parser** (AC: 2)
  - [x] T8.1 Create `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`:
    - Export `parseSourceOutcomesFromArtifact(markdown)` and/or `buildSourceOutcomesFromPayload({ run, signals, adapterResults })`
    - Map section headers → `sourceKey` (reuse A1 table)
    - Regex: `\(source unavailable:\s*(.+?)\)` → `unavailable` + reason
  - [x] T8.2 Unit tests in `tests/parse-digest-source-outcomes.test.mjs`

- [x] **T9 — Wire completion + push** (AC: 2)
  - [x] T9.1 In `run-digest-convex-completion.mjs`, after payload assembly, attach `run.sourceOutcomes` when parse/build succeeds
  - [x] T9.2 Ensure `build-digest-push-payload.mjs` preserves `sourceOutcomes` on `run` object
  - [x] T9.3 `push-digest-convex.mjs` — no change needed if spread passes full `run`; verify explicitly
  - [x] T9.4 Extend `tests/run-digest-convex-completion.test.mjs` — pushed artifact includes `sourceOutcomes` when artifact markdown has unavailable markers
  - [x] T9.5 Run `bash scripts/verify.sh` from Omnipotent.md; call `resolveOperatorHome()` on any script touch per project guardrails

## Dev Notes

### Prerequisite — layout gate and sibling stories

| Dependency | Status |
|------------|--------|
| Digest feed on `/nexus` | Shipped 69-4 (`eae57d6`) |
| `getLatestDigestBrief` + `getDigestSignalsForRun` | Shipped Epic 63/64 |
| Merge provenance / people chip patterns | Shipped 69-1 (review), 69-2 (done) — **same pure-util + panel component pattern** |
| Morning digest push pipeline | Shipped 68-10 completion gate |
| `contributingSources` on signals | Shipped 68-1 — needed for inference path |

### Why inference alone is insufficient (product context)

Signals alone cannot distinguish **"source unavailable (credentials missing)"** from **"source ran but zero matches"**. Both yield zero signals. Push metadata (`sourceOutcomes`) closes UJ-4. Panel ships with inference first so operators get partial value on legacy runs; disclaimer sets expectations.

### Data contract — sourceOutcomes on digestRuns

**Validator addition** (`convex/validators.ts`):

```typescript
sourceOutcomes: v.optional(v.array(digestSourceOutcomeValidator)),
```

**Example pushed run:**

```json
{
  "date": "2026-06-11",
  "ranAt": 1749657600000,
  "topTrend": "AI agents",
  "deepSignalSummary": "…",
  "notebookId": "abc123",
  "sourceOutcomes": [
    { "sourceKey": "twitter", "status": "unavailable", "reason": "X session invalid" },
    { "sourceKey": "newsapi", "status": "fired", "signalCount": 5 },
    { "sourceKey": "hackernews", "status": "fired", "signalCount": 3 }
  ]
}
```

### Query insertion point (UPDATE — cns-dashboard)

`convex/digest.ts` today exposes read queries only for signals/brief — add `getDigestSourceHealth` alongside `getDigestSignalsForRun`. **Do not** overload `getLatestDigestBrief` with twelve rows (keeps subscriptions granular — panel and feed can share `digestRunId` from brief query).

**Current brief shape** (no sourceOutcomes exposed to client yet):

```typescript
// convex/digest.ts — toDigestBrief today
{ digestRunId, ranAt, date, status, focusKeyword, topTrend, deepSignalSummary }
```

Health panel: brief query for `digestRunId` → health query. Two subscriptions acceptable (matches feed pattern in `NexusDigestSignalFeed.svelte`).

### UI insertion point (UPDATE — cns-dashboard)

**Current page** (`src/routes/nexus/+page.svelte`):

```svelte
<div class="nx-main-grid">
  <div class="nx-center-column">
    <NexusHeroChartZone />
    <NexusDigestSignalFeed />
    <NexusAnomalyFeedZone />
  </div>
  <NexusSourceWeightsPanel />
</div>
```

**Target:**

```svelte
<aside class="nx-right-column">
  <NexusSourceWeightsPanel />
  <NexusSourceHealthPanel />
</aside>
```

Add `.nx-right-column { display: flex; flex-direction: column; gap: … }` if stacking needed. Preserve `--nx-weights-width: 240px` grid column.

### NexusSourceWeightsPanel — do not conflate (UPDATE)

`NexusSourceWeightsPanel.svelte` uses `getSignalSources` (Epic 44 — **3** cron ingest sources with weight bars). Source health panel covers **12** morning-digest sources. Different data, different purpose, both visible.

### Special sources — inference edge cases

| Source | Notes |
|--------|-------|
| **google_trends** | Not pushed as `digestSignal`; use `run.topTrend` or `sourceOutcomes` only |
| **deep_signal** | Perplexity sweep; `run.deepSignalSummary` is strong fired signal |
| **notebook** | Orchestration; `run.notebookId` indicates pick succeeded — not a `sourceType` on signals |
| **Merged signals** | Count contributor `sourceType` appearances in `contributingSources[]` for inference |

### Parser section-header → sourceKey map (Omnipotent.md)

| Artifact section header (examples) | sourceKey |
|-----------------------------------|-----------|
| Google Trends / Trends | `google_trends` |
| NewsAPI / Headlines | `newsapi` |
| Deep Signal / Perplexity | `deep_signal` |
| arXiv Preprints | `arxiv` |
| HackerNews | `hackernews` |
| Notebook / Vault context | `notebook` |
| GitHub | `github` |
| Reddit | `reddit` |
| Newsletters / RSS | `rss` |
| Product Hunt | `producthunt` |
| X / Twitter | `twitter` |
| Bluesky | `bluesky` |

### Reuse — do not duplicate

| Utility | Location | Use for |
|---------|----------|---------|
| `formatDigestSourceBadge` / `formatDigestSourceTitle` | `nexus-digest-feed.ts` | Optional chip abbreviations — health panel uses **full labels** from registry |
| `sourceDisplayLabel` | `trend-panel-format.ts` | Fallback label formatting if keys overlap trend sources |
| `buildMergeProvenanceViewModel` pattern | `nexus-merge-provenance.ts` | Pure view-model module structure |
| `NexusDigestSignalFeed` subscription pattern | `NexusDigestSignalFeed.svelte` | brief → dependent query |
| `digestRunRowValidator` | `validators.ts` | Extend for sourceOutcomes |

### Testing standards

| Repo | Required tests |
|------|----------------|
| cns-dashboard | `tests/convex/digest-source-health.test.ts` (or `digest.test.ts` section) — metadata + inference paths |
| cns-dashboard | `tests/lib/nexus-source-health.test.ts` — UI view-model copy |
| cns-dashboard | Validator test — `createDigestRun` accepts `sourceOutcomes` |
| Omnipotent.md | `tests/parse-digest-source-outcomes.test.mjs` — parser |
| Omnipotent.md | `tests/run-digest-convex-completion.test.mjs` — integration attach |
| Gate | `bash scripts/verify.sh` in each touched repo |

### Architecture compliance

| Constraint | Value |
|------------|-------|
| Stack | SvelteKit 2 + Convex + Tailwind 4 + `convex-svelte` |
| Mobile | Horizontal scroll chip row ≤768px (PRD A7) |
| Env vars | No `NEXUS_*` in cns-dashboard (ADR-E63-005) |
| WriteGate / vault | **Not touched** |
| Backend adapters | **None new** — completion-hook metadata only |
| Live URL | https://cns-dashboard-three.vercel.app/nexus |
| Omnipotent.md script touch | Call `resolveOperatorHome()` per CLAUDE.md |

### Project structure (files to create/modify)

**cns-dashboard — create:**

- `convex/lib/digest-source-registry.ts` (or equivalent)
- `src/lib/utils/nexus-source-health.ts`
- `src/lib/components/nexus/NexusSourceHealthPanel.svelte`
- `tests/lib/nexus-source-health.test.ts`
- `tests/convex/digest-source-health.test.ts`

**cns-dashboard — modify:**

- `convex/validators.ts`
- `convex/digest.ts`
- `src/routes/nexus/+page.svelte`
- `src/routes/nexus/nexus-theme.css`
- `tests/convex/digest.test.ts` (validator case)

**Omnipotent.md — create:**

- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `tests/parse-digest-source-outcomes.test.mjs`

**Omnipotent.md — modify:**

- `scripts/run-digest-convex-completion.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` (if needed)
- `tests/run-digest-convex-completion.test.mjs`

**Do not modify:** adapter scripts, `score-digest-signals.mjs`, digest feed component, inspector drawer (except optional empty-state link copy in feed — defer unless trivial)

### Previous story intelligence

| Story | Relevant learning |
|-------|-------------------|
| **69-4** | Feed uses `getLatestDigestBrief` → `getDigestSignalsForRun`; health panel mirrors same run id |
| **69-2** | Cross-repo validator + push metadata pattern; ship cns-dashboard validator before Omnipotent push |
| **69-1** | Pure `$lib/utils/*` module + panel component + `nexus-theme.css` |
| **68-10** | `run-digest-convex-completion.mjs` backfill path — attach outcomes in same payload assembly stage |
| **68-1** | `contributingSources[]` validator — use for inference counts |
| **44-5-1** | TrendStubPanel source health strip — **different domain** (cron ingest); do not reuse component |

### Git intelligence

**cns-dashboard:**

```
6ed6101 feat(epic-69): 69-2 people match chip in inspector + validator extension
addf62c feat(epic-69): 69-1 inspector merge provenance section
eae57d6 feat(epic-69): 69-4 digest signal feed + disposition hierarchy layout gate
ddb4a22 feat(epic-68): 68-1 sourceMetadata contributingSources validators
```

**Omnipotent.md:**

```
a55caf1 feat(epic-69): 69-2 peopleMatch push metadata from scoring
cf65264 feat(epic-68): 68-11 force-rescore completion
c19eef7 fix(epic-68): 68-10 agent:end completion hook + deterministic §9 backfill
```

69-3 is the second cross-repo Epic 69 story. **Recommended order:** cns-dashboard query + validator + panel first (inference path); then Omnipotent.md parser + push wiring so next digest run populates metadata.

### Latest tech notes

- Convex `@convex-dev/eslint-plugin` — add `returns` validator on new query
- Svelte 5 runes — `$derived` for health view models from query data
- No new npm packages
- Accessibility: status text + coloured dot (`aria-hidden` on dot, label on chip); tooltip content in `aria-label`

### References

- PRD FR-6, FR-7, FR-8: `_bmad-output/planning-artifacts/prds/prd-epic-69-2026-06-11/prd.md` §4.4, §6.2, §7
- Addendum A1 (registry), A7 (mobile): `_bmad-output/planning-artifacts/prds/prd-epic-69-2026-06-11/addendum.md`
- UJ-4 pipeline confidence: PRD §2
- Story 69-4 (layout gate): `_bmad-output/implementation-artifacts/69-4-digest-signal-feed-disposition-hierarchy.md`
- Story 69-2 (cross-repo metadata pattern): `_bmad-output/implementation-artifacts/69-2-people-match-indicator.md`
- Completion hook: `scripts/run-digest-convex-completion.mjs`
- Push script: `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs`
- Validators: `cns-dashboard/convex/validators.ts`
- Weights panel (do not replace): `cns-dashboard/src/lib/components/nexus/NexusSourceWeightsPanel.svelte`
- Deferred: `_bmad-output/implementation-artifacts/deferred-work.md` (Product Hunt section gaps — health panel should surface `unavailable` when pushed)

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- cns-dashboard `bash scripts/verify.sh` — PASSED (501 tests)
- Omnipotent.md `bash scripts/install-hermes-skill-morning-digest.sh && bash scripts/verify.sh` — PASSED (927 node + 642 vitest)

### Completion Notes List

- Shipped `getDigestSourceHealth` with twelve-row registry, metadata + inference paths, and Convex tests.
- Added `NexusSourceHealthPanel` in right column below weights panel; inference disclaimer on legacy runs.
- Extended `digestRun*Validator` with optional `sourceOutcomes`.
- Omnipotent: `parse-digest-source-outcomes.mjs` + completion hook attaches `run.sourceOutcomes` before artifact write/push.
- Code review fixes (69-3 CR): brief-loading skeleton (M1); `resolveSourceOutcomes` markdown merge in completion hook (M2); per-row inference disclaimer (L1); aria labels include count/reason (L3).

### File List

**cns-dashboard**
- `convex/validators.ts`
- `convex/lib/digest-source-registry.ts`
- `convex/digest.ts`
- `src/lib/utils/nexus-source-health.ts`
- `src/lib/components/nexus/NexusSourceHealthPanel.svelte`
- `src/routes/nexus/+page.svelte`
- `src/routes/nexus/nexus-theme.css`
- `tests/convex/digest-source-health.test.ts`
- `tests/convex/digest.test.ts`
- `tests/lib/nexus-source-health.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Omnipotent.md**
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `tests/parse-digest-source-outcomes.test.mjs`
- `tests/run-digest-convex-completion.test.mjs`
- `_bmad-output/implementation-artifacts/69-3-source-health-panel.md`

### Change Log

- 2026-06-11: Story 69-3 — source health query, panel, and completion-hook sourceOutcomes push metadata.

## Story Completion Status

- Implementation complete; code review batch-fix applied (M1, M2, L1–L3)
- Status: **review** (pending commit)
- Sprint tracker: `69-3-source-health-panel` → review
