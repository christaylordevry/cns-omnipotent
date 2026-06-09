---
story_id: 65-9
epic: 65
title: surface-intelligence-scoring-inspector-drawer
status: done
baseline_commit: 8fb7206
operator_brief: 2026-06-09
predecessors: 63-5, 63-6, 64-1, 64-5
source: epic-64-retro-2026-06-09 T2 / epic-65-retro carry-forward
repo: cns-dashboard
---

# Story 65.9: Surface Intelligence Scoring in Inspector Drawer

Status: done

> **SCHEMA CLARIFICATION (verified 2026-06-09):**
> - `signal.disposition` — string | undefined, **flat field**
> - `signal.rankScore` — number | undefined, **flat field**
> - `signal.normalizedEngagement` — number | undefined, flat (optional surface)
> - `signal.scores` — object | undefined, **nested**:
>   - `signal.scores.relevance`
>   - `signal.scores.personalRelevance`
>   - `signal.scores.novelty`
>   - `signal.scores.momentum`
>   - `signal.scores.urgency`
>
> Panel hidden when: `!signal.scores && signal.disposition == null && signal.rankScore == null`
>
> Scale is 0–100 (per architecture). Defensive: if any dimension value ≤ 1, multiply × 100.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **Nexus operator inspecting a signal in the Intelligence Inspector drawer**,
I want **a Signal Intelligence panel showing disposition, rank score, and five dimension micro-bars from Epic 64 scoring**,
so that **I can see why a digest signal was ranked and labeled without reading raw Convex JSON — closing the Epic 64/65 retro action T2 (Nexus UI dimension score display)**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 65 post-close UI surface — **65-9 closes retro T2** carried from Epic 64 (`epic-64-retro-2026-06-09.md`, `epic-65-retro-2026-06-09.md`) |
| **Repo** | **cns-dashboard only** — Svelte inspector UI + optional util tests; **no** Omnipotent.md scoring changes |
| **Predecessors** | **63-5** (Inspector drawer shell); **63-6** (`getLatestDigestBrief` + digest read queries); **64-1** (schema + `getDigestSignalsForRun` projection); **64-5** (scored signals in production push path) |
| **Normative spec** | `architecture-epic-64-scoring-engine.md` §3 (schema contract, 0–100 scale); `epic-46-ui-spec.md` §2 (dark precision instrument, teal accent family) |
| **Out of scope** | New Convex queries/mutations; schema changes; scoring formula changes; Hermes action grid wiring; Signal Seeds Track/Dismiss behavior; live digest smoke test |

### Problem (current state)

Epic 64 ships `rankScore`, `disposition`, and `scores.{relevance,personalRelevance,novelty,momentum,urgency}` on `digestSignals` rows. `getDigestSignalsForRun` **already projects** all scoring fields (verified at `cns-dashboard/convex/digest.ts:150-183` and `tests/convex/digest.test.ts:181-188`).

The Intelligence Inspector (`NexusInspectorDrawer.svelte`) currently shows sparkline, WoW delta, digest brief prose, source trace, source weights, related signals, and a 2×2 inert action grid — but **no scoring panel**. It subscribes to `getLatestDigestBrief` for "Why this matters" text only; it does **not** subscribe to `getDigestSignalsForRun`.

### Operator brief (binding)

1. Panel title: **Signal Intelligence**
2. Placement: **below** "Why this matters" (digest brief), **above** "Actions" grid (insert before Source trace is acceptable if it keeps digest→scoring adjacency; preferred: immediately after digest brief section at line ~407)
3. **Hide entire panel** when no scoring fields present — no empty state, no "—" placeholders
4. **No new Convex queries** — wire existing `getDigestSignalsForRun` using `digestRunId` from `getLatestDigestBrief`
5. `bash scripts/verify.sh` must pass (414 cns-dashboard tests baseline as of 2026-06-09)

## Acceptance Criteria

### 1. Scored signal renders full panel (AC: post-Epic-64 data)

**Given** I open the Intelligence Inspector for a topic whose `digestFocusKeyword` resolves to a digest run with at least one scored `digestSignal` (has `rankScore` and/or `scores` and/or `disposition`)
**When** the drawer finishes loading digest data
**Then** a **Signal Intelligence** section appears between the digest brief and the Actions grid
**And** I see a colour-coded **disposition badge** when `disposition` is defined (`priority` | `watch` | `ignore` | `escalate`)
**And** I see **Rank Score** when `rankScore` is present (numeric label, e.g. `87` for 0–100 scale)
**And** I see **at least three** dimension micro-bars for dimensions present on the matched signal (`relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency`)
**And** each dimension row shows: left label, 4px teal fill bar on dark track, right-aligned value label

**Test entry paths:**
- **Primary:** Hero trajectory chart or anomaly feed → `setSelectedTopicSlug` (existing 63-5 wiring)
- **Signal Seeds:** Chip `term` ≠ `topicSlug` today (`"ai agents"` vs `"ai-agents"`). Satisfy AC via topic whose `headerMeta.keyword` matches a seed's `displayTerm`, **or** add minimal chip-body click → resolve slug via keyword match in hoisted `getTrendTopics` (optional subtask T0 if literal chip-open is required)

### 2. Legacy signal — panel absent (AC: pre-Epic-64 backward compat)

**Given** I open the Inspector for a topic where the matched digest signal has **no** `disposition`, **no** `rankScore`, and **no** `scores` object
**When** the drawer renders
**Then** the Signal Intelligence section is **completely absent** from the DOM (conditional `{#if}` — not `display:none` with empty chrome)
**And** no empty-state copy ("No scoring data", "—", etc.) is shown

### 3. Disposition badge colours (AC: design spec)

**Given** a signal with `disposition` set
**When** the badge renders
**Then** pill chip colours match:

| disposition | colour |
|-------------|--------|
| `priority` | `#00D4AA` (teal) |
| `watch` | `#F59E0B` (amber) |
| `ignore` | `#6B7280` (muted) |
| `escalate` | `#EF4444` (red) |

**And** when `disposition` is `undefined`/missing, the badge element is **not rendered**

### 4. Build + tests green (AC: verify gate)

**Given** implementation is complete
**When** `npm test`, `npm run lint`, `npm run build`, and `bash scripts/verify.sh` run from respective repos
**Then** all pass with **no new failures**
**And** existing test count is preserved or increased (baseline: **414** tests in cns-dashboard)

## Tasks / Subtasks

- [x] **T1: Scoring data wiring** (AC: 1, 2)
  - [x] T1.1 Add `useQuery(api.digest.getDigestSignalsForRun, …)` in `NexusInspectorDrawer.svelte` — skip when drawer closed or `digestBriefQuery.data?.digestRunId` absent (mirror existing skip-when-closed pattern from 63-5/63-6)
  - [x] T1.2 Implement `resolveScoredDigestSignal(signals, focusKeyword)` in new util — pick best match: title/summary contains normalized keyword → else highest `rankScore` in run → else `null`
  - [x] T1.3 Derive `hasScoringPanel` boolean: true iff matched signal has any of `disposition`, `rankScore`, or any key in `scores`

- [x] **T2: Signal Intelligence panel UI** (AC: 1, 3)
  - [x] T2.1 Insert `<section aria-label="Signal Intelligence">` after digest brief block (~line 407), before Source trace
  - [x] T2.2 Disposition badge — pill chip, colour from disposition map; omit when undefined
  - [x] T2.3 Rank Score row — show when `rankScore` present; display as integer percent (round `rankScore` when 0–100; if value ≤ 1, multiply by 100 per defensive normalization)
  - [x] T2.4 Five dimension micro-bars — render **only** dimensions with finite numeric values on `scores`; reuse `.nx-inspector-weight-bar` / `.nx-inspector-weight-fill` pattern or sibling classes with `#1E1E1E` track override

- [x] **T3: Theme CSS** (AC: 3)
  - [x] T3.1 Add `.nx-inspector-scoring-*` classes in `nexus-theme.css` — panel surface `#1A1A1A`, border `#2A2A2A`, Source Sans 3 (via `var(--nx-font-body)`), disposition badge palette per spec
  - [x] T3.2 Bar track `#1E1E1E`, fill teal `#00D4AA` (dimension bars per operator brief; may differ from existing `--nx-accent-primary` `#00c8aa` — use spec literals for this panel)

- [x] **T4: Util tests** (AC: 1, 2, 4)
  - [x] T4.1 `tests/lib/nexus-inspector-scoring.test.ts` — `hasScoringPanel`, `normalizeScorePercent`, `resolveScoredDigestSignal`, disposition colour map
  - [x] T4.2 No new Convex tests required unless projection gap found (expected: none)

- [x] **T5: Verify gate** (AC: 4)
  - [x] T5.1 `cd cns-dashboard && npm test && npm run lint && npm run build`
  - [x] T5.2 `bash scripts/verify.sh` from Omnipotent.md (sibling dashboard tests)

- [ ] **T0 (optional): Signal Seeds chip → inspector** — only if AC1 cannot be demonstrated via hero/anomaly
  - [ ] T0.1 Chip body click (exclude Track/Dismiss) resolves `topicSlug` from `displayTerm` via trend topic keyword match → `setSelectedTopicSlug`

## Dev Notes

### Scoring field contract (confirmed from validators)

```163:169:cns-dashboard/convex/validators.ts
export const digestSignalScoresValidator = v.object({
	relevance: v.number(),
	personalRelevance: v.number(),
	novelty: v.number(),
	momentum: v.number(),
	urgency: v.number()
});
```

- **Scale:** Architecture §3 and `task-prompt.md` document **0–100** for `rankScore` and each dimension. Validators use plain `v.number()` — no range enforcement. UI must handle legacy/malformed values defensively (`Number.isFinite`).
- **`scores` object:** When present, all five keys are required (partial objects rejected at push). UI still renders **only dimensions that are finite numbers** to satisfy "only render dimensions that are present" for forward-compat.
- **`disposition`:** `priority` | `watch` | `ignore` | `escalate` — optional on row.

### Data flow (target)

```
topicSlug selected (drawer open)
  → getTopicBySlug + resolveDrawerHeaderMeta → digestFocusKeyword
  → getLatestDigestBrief({ focusKeyword }) → { digestRunId, deepSignalSummary, … }
  → getDigestSignalsForRun({ digestRunId, limit: 50 })  // EXISTING query — add subscription
  → resolveScoredDigestSignal(signals, digestFocusKeyword)
  → if hasScoringPanel → render Signal Intelligence section
```

**Do NOT** add `getDigestSignalForTopic` or extend `digestBriefValidator` unless `getDigestSignalsForRun` projection is found incomplete (it is complete per 64-1).

### Existing micro-bar pattern to reuse

```437:447:cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte
								<li class="nx-inspector-weight-row">
									<div class="nx-inspector-weight-header">
										<span>{row.label}</span>
										<span>{formatWeightPercent(row.weightPercent)}</span>
									</div>
									<div class="nx-inspector-weight-bar" aria-hidden="true">
										<span
											class="nx-inspector-weight-fill"
											style={`width: ${row.weightPercent}%;`}
										></span>
									</div>
								</li>
```

Dimension labels (display):

| key | label |
|-----|-------|
| `relevance` | Relevance |
| `personalRelevance` | Personal Relevance |
| `novelty` | Novelty |
| `momentum` | Momentum |
| `urgency` | Urgency |

### Panel visibility logic (critical — prevents AC-2 violations)

```typescript
function hasScoringPanel(signal: DigestSignalRow | null): boolean {
  if (!signal) return false;
  if (signal.disposition != null) return true;
  if (typeof signal.rankScore === 'number' && Number.isFinite(signal.rankScore)) return true;
  const s = signal.scores;
  if (!s) return false;
  return ['relevance','personalRelevance','novelty','momentum','urgency']
    .some((k) => typeof s[k] === 'number' && Number.isFinite(s[k]));
}
```

### Styling notes (repo vs operator brief)

| Token | Operator brief | Current Nexus theme |
|-------|----------------|---------------------|
| Panel surface | `#1A1A1A` | `--nx-surface-sidebar-end: #1a1a1a` ✓ |
| Border | `#2A2A2A` | Closest: `--nx-surface-2: #262626` — use `#2A2A2A` per brief for panel border |
| Body font | Source Sans 3 | `--nx-font-body` ✓ |
| Teal fill | `#00D4AA` | `--nx-accent-primary: #00c8aa` — use `#00D4AA` for this panel per AC-3 |

### Files to touch

| File | Action |
|------|--------|
| `src/lib/components/nexus/NexusInspectorDrawer.svelte` | Add query subscription + Signal Intelligence section |
| `src/lib/utils/nexus-inspector-scoring.ts` | **NEW** — match, normalize, label, disposition colours |
| `src/routes/nexus/nexus-theme.css` | Scoring panel + disposition badge styles |
| `tests/lib/nexus-inspector-scoring.test.ts` | **NEW** — unit tests |
| `convex/digest.ts` | **UPDATE only if** projection missing fields (expected: no change) |

### Testing guidance

**Unit tests (required):**
- `hasScoringPanel` false for `{}`, `{ rank: 1 }`, `{ scores: undefined }`
- `hasScoringPanel` true for `{ disposition: 'watch' }`, `{ rankScore: 78 }`, `{ scores: { relevance: 50, … } }`
- `normalizeScorePercent(0.87)` → `87`; `normalizeScorePercent(87)` → `87`
- `resolveScoredDigestSignal` keyword match vs rankScore fallback

**Manual smoke:**
1. Seed Convex test data with scored signal (`tests/convex/digest.test.ts` fixture pattern)
2. Open `/nexus`, select `ai-agents` topic, confirm panel renders
3. Open topic with legacy unscored signal — panel absent

**No Svelte component test required** — matches 63-5 defer pattern for drawer UI; util + existing Convex tests cover data contract.

### Previous story intelligence

**63-5:** Established drawer section order, skip-when-closed subscriptions, `.nx-inspector-weight-bar` pattern. "Why this matters" was stub until 63-6.

**63-6:** Wired `getLatestDigestBrief`; returns `digestRunId` — **use this as the join key** for `getDigestSignalsForRun`. `DIGEST_KEYWORD_SEARCH_RUN_LIMIT = 50`.

**64-1:** Confirmed `getDigestSignalsForRun` sort: `rankScore` desc → legacy `rank` asc. Return mapper includes all scoring fields.

### Git intelligence (recent cns-dashboard)

```
8fb7206 feat(epic-65): 65-1 digest source types schema literals
73c2e17 test(epic-64): 64-1 rankScore tie-break and query mapper coverage
5f86e9d feat(epic-64): 64-1 digestSignals schema extension for scoring fields
51d140f feat: Epic 63-7 — Stitch visual polish for Nexus cockpit
```

Commit style: `feat(epic-65): 65-9 surface intelligence scoring in inspector drawer`

### Architecture compliance

- **ADR-E64-001:** Scoring computed in Omnipotent.md; dashboard is read-only consumer — this story is pure read/UI
- **ADR-E63-003:** Drawer opens on `setSelectedTopicSlug`; preserve existing subscription skip pattern
- **Epic 46 §2:** Dark precision instrument; restrained accent; explainable scores — dimension bars satisfy "interrogatable" tension
- **No WriteGate / vault / security.md** — no operator approval required

### Project structure notes

- Utils live in `src/lib/utils/` (mirror `nexus-inspector.ts`)
- Convex queries stay in `convex/digest.ts` — do not split modules
- Tests mirror `tests/lib/nexus-inspector.test.ts` Vitest style

### References

- [Source: `_bmad-output/implementation-artifacts/epic-64-retro-2026-06-09.md` — T2 action item]
- [Source: `_bmad-output/implementation-artifacts/epic-65-retro-2026-06-09.md` — T2 "Not Addressed" carry-forward]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md` §3]
- [Source: `cns-dashboard/_bmad-output/implementation-artifacts/63-5-intelligence-inspector-drawer.md`]
- [Source: `cns-dashboard/_bmad-output/implementation-artifacts/63-6-polish-pass-digest-read-queries.md`]
- [Source: `cns-dashboard/convex/validators.ts` — `digestSignalScoresValidator`, `digestSignalDispositionValue`]
- [Source: `cns-dashboard/convex/digest.ts` — `getDigestSignalsForRun`, `getLatestDigestBrief`]
- [Source: `cns-dashboard/_bmad-output/planning-artifacts/epic-46-ui-spec.md` §2]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Schema clarification applied: flat `disposition`/`rankScore`, nested `scores.*`
- `npm run build` (convex deploy wrapper) blocks in non-interactive shell; `npx vite build` passes
- Verify gate: 421 cns-dashboard tests (+7), `bash scripts/verify.sh` PASSED

### Completion Notes List

- Wired `getDigestSignalsForRun` off `digestBriefQuery.data.digestRunId` with skip-when-absent pattern
- Added `nexus-inspector-scoring.ts` util: `hasScoringPanel`, `normalizeScorePercent`, `resolveScoredDigestSignal`, `scoreDimensionRows`, disposition colours
- Inserted Signal Intelligence panel after digest brief, before Source trace; conditional `{#if}` hides panel for legacy unscored signals
- Added 7 unit tests; no Convex changes required (projection already complete per 64-1)

### File List

- `cns-dashboard/src/lib/utils/nexus-inspector-scoring.ts` (NEW)
- `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `cns-dashboard/src/routes/nexus/nexus-theme.css`
- `cns-dashboard/tests/lib/nexus-inspector-scoring.test.ts` (NEW)

## Change Log

- 2026-06-09 — Story 65-9 created (ready-for-dev) — Surface Epic 64 intelligence scoring in Nexus Inspector drawer; closes retro T2.
- 2026-06-09 — Story 65-9 implemented (review) — Signal Intelligence panel in Nexus Inspector drawer with scoring util + tests.
- 2026-06-09 — Code review complete (done) — keyword multi-match tie-break, aria-label, build TODO, test gaps patched; placement confirmed per story exception.

### Review Findings

- [x] [Review][Defer] Placement before Source trace vs literal AC1 "above Actions" — story L59 accepts digest→scoring adjacency; not a blocker.
- [x] [Review][Patch] Keyword multi-match used first `find()` not highest rankScore — fixed in `resolveScoredDigestSignal`.
- [x] [Review][Patch] Disposition badge missing `aria-label` — added `Signal disposition: …`.
- [x] [Review][Patch] `npm run build` Convex deploy blocker undocumented — `//build-todo` in `package.json`.
- [x] [Review][Patch] Test gaps: triple-null, 1.01 boundary, `dispositionColour(undefined)` — added 3 tests (+ multi-match test).
- [x] [Review][Defer] Scoring panel absent during signals fetch (no loading copy) — acceptable per 63-5 defer pattern.
- [x] [Review][Defer] Rank fallback when keyword misses may show unrelated run signal — by design per T1.2 spec.
