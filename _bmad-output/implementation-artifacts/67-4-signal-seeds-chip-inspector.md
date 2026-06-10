---
story_id: 67-4
epic: 67
title: signal-seeds-chip-inspector
status: done
baseline_date: 2026-06-10
operator_brief: 2026-06-09
predecessors: 63-3, 63-5, 63-6, 65-9, 66-1
parallel: 67-1, 67-3
repo: cns-dashboard
blocks: none
---

# Story 67.4: Signal Seeds Chip → Intelligence Inspector

Status: done

> **Normative override:** Architecture **ADR-E67-005** supersedes PRD addendum A3 step 4 and PRD open question #4. When no `trendTopics` row matches, open inspector in **keyword mode** — do **not** no-op.
>
> **cns-dashboard only.** No Convex schema/query changes. No Omnipotent.md source changes unless verify script path notes change.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **Nexus operator viewing the Signal Seeds chip rail**,
I want **clicking a chip body to open the Intelligence Inspector for the matching trend topic or, when no topic exists, for digest signals matching that keyword**,
so that **I can investigate seed keywords without copy-pasting into the hero chart — realizing UJ-3 and closing the 65-9 T0 chip-open deferral**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 67 — Signal Quality + Source Expansion |
| **Repo** | **cns-dashboard only** — Svelte 5 UI + Vitest util tests |
| **Predecessors** | **63-3** (chip rail + Track/Dismiss); **63-5/63-6** (inspector drawer + digest read queries); **65-9** (Signal Intelligence panel); **66-1** (investigation actions on resolved `digestSignalId`) |
| **Parallel** | **67-1** (live digest validation), **67-3** (nexus-goals scoring) — no dependency |
| **Normative spec** | `architecture-epic-67-signal-quality-source-expansion.md` §6, ADR-E67-005; `prd-epic-67-2026-06-09` §4.4 (FR-8, FR-9) with ADR override on no-match |
| **FR IDs** | FR-8 (chip click opens inspector), FR-9 (slug resolution util + tests) |
| **Out of scope** | Convex changes; new queries; scoring formula; Track/Dismiss behavior; hero/anomaly selection regressions; Screen 10 workspace (Epic 68); Omnipotent.md morning-digest adapters |

### Problem (current state — verified 2026-06-10)

`NexusSignalSeedsRail.svelte` renders chip bodies as inert `<div class="nx-signal-chip-main">` — **no click handler**. Inspector opens only via hero chart or anomaly feed (`setSelectedTopicSlug`).

`keywordCandidates.term` (storage key, e.g. `ai-agents`) often differs from `trendTopics.topicSlug` and from human `displayTerm` (e.g. `AI agents`). Story **65-9** deferred chip-open (T0) because slug mismatch blocked naive `{ topicSlug: term }` wiring.

`nexus-context.ts` types `NexusDrawerPayload` as `{ topicSlug: string }` only. `NexusInspectorDrawer.svelte` gates **all** content on `topicSlug` — empty state when absent.

### Target behavior (ADR-E67-005)

**Resolution order** via `resolveSeedToInspectorTarget(term, displayTerm, topics)`:

1. Slug match: `slugifySeedTerm(term) === topic.topicSlug` (case-insensitive)
2. Keyword match: `normalizeSeedLabel(displayTerm) === normalizeSeedLabel(topic.keyword)`
3. **Topic mode:** `{ mode: 'topic', topicSlug }` → existing inspector path
4. **Keyword mode:** no trend row but non-empty `term` → `{ mode: 'keyword', keywordTerm, displayLabel }` → digest-focused inspector (skip topic-scoped Convex queries)

Track/Dismiss icon buttons must **not** open inspector (`stopPropagation` / separate handlers — already isolated).

---

## Acceptance Criteria

### 1. Chip body opens inspector — topic mode (FR-8, UJ-3)

**Given** Signal Seeds rail shows candidate with `displayTerm` "AI agents" and a `trendTopics` row exists where `keyword` normalizes to "ai agents" OR `topicSlug` is `ai-agents`
**When** I click the chip main body (not Track or Dismiss)
**Then** the Intelligence Inspector drawer opens
**And** `drawerPayload` is `{ mode: 'topic', topicSlug: '<matched slug>' }`
**And** inspector content matches selecting that topic from the hero chart (sparkline, WoW, digest brief, Signal Intelligence panel when scored signal exists, investigation actions)

### 2. Chip body opens inspector — keyword mode fallback (ADR-E67-005)

**Given** a seed candidate whose `term`/`displayTerm` does **not** resolve to any `trendTopics` row
**When** I click the chip main body
**Then** the drawer opens with `drawerPayload` `{ mode: 'keyword', keywordTerm, displayLabel }`
**And** header shows **"Signals matching: {displayLabel}"** (or equivalent keyword-mode title)
**And** topic-scoped sections are hidden or show appropriate empty/muted state: score trend sparkline, WoW delta, lifecycle/investment meta, source trace, source weights, related topics strip
**And** digest brief + Signal Intelligence panel still load via `getLatestDigestBrief({ focusKeyword: displayLabel })` + `getDigestSignalsForRun` + `resolveScoredDigestSignal()` (reuse existing 65-9 wiring)
**And** investigation actions (Explain, Compare, Trace, Ask AI) work when a scored `digestSignalId` resolves — same gate as topic mode

### 3. Track/Dismiss isolation (FR-8)

**Given** a visible chip
**When** I click **Track** or **Dismiss**
**Then** the existing mutation runs
**And** the inspector does **not** open

### 4. Slug resolution utility (FR-9)

**Given** `resolveSeedToInspectorTarget`, `slugifySeedTerm`, and `normalizeSeedLabel` exported from `src/lib/utils/nexus-signal-seeds.ts`
**When** unit tests run
**Then** cases cover at minimum:
- exact slug match (`term` → `topicSlug`)
- keyword match via `displayTerm` vs `topic.keyword` (case/whitespace insensitive)
- keyword mode fallback when no topic row
- `null` when `term` is empty/whitespace only
**And** normalization does not duplicate divergent logic from `resolveScoredDigestSignal` — prefer shared trim/lowercase pattern; seed label match adds whitespace collapse per architecture §6.1

### 5. Payload migration — no regressions (FR-8)

**Given** hero chart and anomaly feed still call `setSelectedTopicSlug(topicSlug)`
**When** I open inspector from those entry points after this story
**Then** behavior is unchanged (topic mode, full inspector)
**And** `selectedTopicSlug` updates for chart highlight in topic mode only
**And** keyword mode does **not** set `selectedTopicSlug` (hero selection unchanged)

### 6. Verify gate (project non-negotiable)

**Given** implementation complete in `cns-dashboard`
**When** `npm test`, `npm run lint`, `npm run build`, and `bash scripts/verify.sh` (from Omnipotent.md repo root) run
**Then** all pass with no new failures
**And** test count preserved or increased (baseline: **451** tests in cns-dashboard as of 2026-06-10)

---

## Tasks / Subtasks

- [x] **T1: Resolution util** (AC: 4)
  - [x] T1.1 Add `InspectorTarget`, `slugifySeedTerm`, `normalizeSeedLabel`, `resolveSeedToInspectorTarget` to `src/lib/utils/nexus-signal-seeds.ts` per architecture §6.1
  - [x] T1.2 Extend `tests/lib/nexus-signal-seeds.test.ts` with resolver cases (do **not** create duplicate `tests/unit/` path unless moving existing file)

- [x] **T2: Nexus context payload + APIs** (AC: 1, 2, 5)
  - [x] T2.1 Change `NexusDrawerPayload` to discriminated union `{ mode: 'topic'; topicSlug } | { mode: 'keyword'; keywordTerm; displayLabel }`
  - [x] T2.2 Update `openInspectorForTopic` and `setSelectedTopicSlug` to set `{ mode: 'topic', topicSlug }`
  - [x] T2.3 Add `openInspectorForKeyword(keywordTerm, displayLabel)` — sets keyword payload, opens drawer, does **not** mutate `selectedTopicSlug`
  - [x] T2.4 Hoist `getTrendTopics` query in `src/routes/nexus/+layout.svelte` (limit 24) and expose as `trendTopicsQuery` on `NexusContext` for chip resolution (avoids N+1 per-chip queries)

- [x] **T3: Chip rail click wiring** (AC: 1, 2, 3)
  - [x] T3.1 In `NexusSignalSeedsRail.svelte`, load topics from context; on chip main click call resolver → `openInspectorForTopic` or `openInspectorForKeyword`
  - [x] T3.2 Convert `.nx-signal-chip-main` to `<button type="button">` (or equivalent accessible control) with focus ring; add hover/cursor styles in `nexus-theme.css`
  - [x] T3.3 Optional: `aria-live="polite"` status when resolver returns `null` (empty term only — keyword mode handles non-empty terms without topic row)

- [x] **T4: Inspector drawer keyword branch** (AC: 2, 5)
  - [x] T4.1 Derive `inspectorMode`, `topicSlug`, `digestFocusKeyword` from `drawerPayload` (topic: existing; keyword: `displayLabel` for digest focus, skip topic slug)
  - [x] T4.2 Skip topic-scoped queries when `mode === 'keyword'`: `getTopicBySlug`, score history, WoW, source trace, source weights, related topics
  - [x] T4.3 Keyword-mode header copy; hide or mute topic-only sections per AC-2
  - [x] T4.4 Update `$effect` restore-context key to use stable payload id (`topicSlug` or `keyword:${keywordTerm}`)
  - [x] T4.5 Empty-state copy: when drawer open with no payload, keep existing hint; keyword mode is **not** empty

- [x] **T5: Verify** (AC: 6)
  - [x] T5.1 Manual QA on `/nexus`: chip with matching topic; chip with no topic row (keyword mode); Track/Dismiss regression; hero/anomaly regression
  - [x] T5.2 `bash scripts/verify.sh` green

---

## Dev Notes

### Files to touch (cns-dashboard)

| File | Action | Notes |
|------|--------|-------|
| `src/lib/utils/nexus-signal-seeds.ts` | **Update** | Add resolver exports; keep existing badge/momentum helpers |
| `tests/lib/nexus-signal-seeds.test.ts` | **Update** | Resolver unit tests |
| `src/lib/context/nexus-context.ts` | **Update** | Payload union, `openInspectorForKeyword`, migrate payload sets |
| `src/routes/nexus/+layout.svelte` | **Update** | Hoist `getTrendTopics`, pass into `createNexusContext` |
| `src/lib/components/nexus/NexusSignalSeedsRail.svelte` | **Update** | Chip click → resolver → open |
| `src/lib/components/nexus/NexusInspectorDrawer.svelte` | **Update** | Mode branch; largest change — read fully before editing |
| `src/routes/nexus/nexus-theme.css` | **Update** | Chip main button affordance (hover, focus-visible) |

**Do not edit:** `convex/*`, Omnipotent.md `scripts/*`, WriteGate paths, `security.md`.

### Current code anchors (read before modify)

**Chip rail — no click today:**

```104:128:cns-dashboard/src/lib/components/nexus/NexusSignalSeedsRail.svelte
<div class="nx-signal-chip-main">
  <span class="nx-signal-chip-term">{candidate.displayTerm}</span>
  ...
</div>
```

**Context — topic-only payload:**

```18:20:cns-dashboard/src/lib/context/nexus-context.ts
export type NexusDrawerPayload = {
  topicSlug: string;
};
```

**Drawer — all content behind `topicSlug`:**

```53:53:cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte
const topicSlug = $derived(open ? ($drawerPayload?.topicSlug ?? null) : null);
```

```514:520:cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte
{#if !topicSlug}
  <div class="nx-drawer-empty">...</div>
{:else}
  <div class="nx-inspector-content">...</div>
{/if}
```

**Digest/scoring path to preserve (65-9):**

```149:175:cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte
const digestFocusKeyword = $derived(
  topicSlug ? headerMeta.keyword.trim() || topicSlug : null
);
// ... getLatestDigestBrief, getDigestSignalsForRun, resolveScoredDigestSignal
```

In keyword mode, set `digestFocusKeyword` from `displayLabel` directly (no `headerMeta` dependency).

**Keyword matching for digest signals** — reuse `resolveScoredDigestSignal` / `signalMatchesKeyword` in `nexus-inspector-scoring.ts` (`normalizeKeyword` = trim + lowercase). Seed **topic** matching uses `normalizeSeedLabel` with whitespace collapse — keep both consistent for the same human label.

### Architecture compliance

- **ADR-E67-005:** Two-mode inspector; no new Convex tables
- **§3.2:** Zero Convex changes for 67-4
- **§6.2–6.3:** Context API + drawer branches exactly as architecture diagrams
- **Epic 46 UI:** Dark precision instrument; teal accent family for interactive chip state — match existing chip rail tokens in `nexus-theme.css`
- **ADR-E63-003:** `closeDrawer()` keeps payload for instant reopen — preserve; keyword payload must survive close/reopen toggle

### Call sites to migrate for payload shape

| Location | Current | After |
|----------|---------|-------|
| `nexus-context.ts` `setSelectedTopicSlug` | `{ topicSlug }` | `{ mode: 'topic', topicSlug }` |
| `nexus-context.ts` `openInspectorForTopic` | `{ topicSlug }` | `{ mode: 'topic', topicSlug }` |
| `NexusInspectorDrawer.svelte` | `$drawerPayload?.topicSlug` | Branch on `mode` |
| Hero / anomaly | unchanged API (`setSelectedTopicSlug`) | internal payload shape only |

### Testing standards

- Vitest in `tests/lib/` mirroring `src/lib/` layout
- No new npm packages
- Component test optional; **util tests mandatory** per FR-9
- Cross-repo verify: `bash /home/christ/ai-factory/projects/Omnipotent.md/scripts/verify.sh` (runs cns-dashboard tests when sibling exists)

### Previous story intelligence

**65-9 (done):** Signal Intelligence panel wired via `digestRunId` from brief + `resolveScoredDigestSignal`. Chip-open was optional T0 — **this story is that T0 plus keyword mode**. Do not re-scaffold scoring panel.

**63-5/63-6 (done):** Drawer skip-when-closed query pattern; related signals click → `setSelectedTopicSlug`. Investigation restore `$effect` keyed on `topicSlug` — extend for keyword mode.

**63-3 (done):** Track/Dismiss use `useConvexClient` mutations; pending state disables all chips — chip open should respect `isChipDisabled` / not fire during pending mutations.

### Git intelligence (recent cns-dashboard)

- `2ee2b9d` — 65-9 inspector scoring panel (primary dependency)
- `2c208ac` — 66-1 investigation actions on `digestSignalId`
- `51d140f` — Epic 63-7 visual polish (chip rail CSS tokens)

Follow established Svelte 5 runes (`$derived`, `$state`, `$effect`) and `convex-svelte` `useQuery` skip patterns.

### Project context references

- Omnipotent.md `project-context.md` — verify gate, cns-dashboard sibling at `../cns-dashboard`
- cns-dashboard `project-context.md` — SvelteKit 2 + Svelte 5, Convex reactive queries, spec-first for UI (`epic-46-ui-spec.md`)
- **No WriteGate / vault_log_action / security.md** — operator approval not required

### Deferred / cross-epic notes

- **67-3** may raise `personalRelevance` on matched signals — keyword mode benefits automatically via same digest resolution path
- **67-6** Compare smoke requires topic or keyword inspector with `digestSignalId` — keyword mode must not break Compare when enabled
- PRD open question #4 resolved by ADR-E67-005 — document in completion notes if asked

---

## References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md` §6, ADR-E67-005, §3.2, §9 failure table]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/prd.md` §3 UJ-3, §4.4 FR-8/FR-9, §10 story table]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/addendum.md` §A3 — superseded on step 4 by ADR-E67-005]
- [Source: `_bmad-output/implementation-artifacts/65-9-surface-intelligence-scoring-inspector-drawer.md` — T0 deferral, scoring wiring]
- [Source: `_bmad-output/implementation-artifacts/63-3-signal-seeds-chip-rail.md` — rail structure, Track/Dismiss]
- [Source: `cns-dashboard/src/lib/context/nexus-context.ts` — drawer contract]
- [Source: `cns-dashboard/src/lib/utils/nexus-inspector-scoring.ts` — `resolveScoredDigestSignal`]

---

## Dev Agent Record

### Agent Model Used

Composer

### Completion Notes List

- Implemented ADR-E67-005 two-mode inspector: topic match via slug/keyword resolution, keyword fallback when no `trendTopics` row.
- Hoisted `getTrendTopics` to nexus layout; chip rail uses shared resolver + context APIs.
- Keyword mode shows digest brief + Signal Intelligence + investigation actions; topic-only sections hidden.
- `bash scripts/verify.sh` green — **457** tests (baseline 451 + 6 resolver cases).

### File List

- `cns-dashboard/src/lib/utils/nexus-signal-seeds.ts`
- `cns-dashboard/tests/lib/nexus-signal-seeds.test.ts`
- `cns-dashboard/src/lib/context/nexus-context.ts`
- `cns-dashboard/src/routes/nexus/+layout.svelte`
- `cns-dashboard/src/lib/components/nexus/NexusSignalSeedsRail.svelte`
- `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `cns-dashboard/src/routes/nexus/nexus-theme.css`

---

## Story Completion Status

- **Status:** done
- **Completion note:** Signal Seeds chip → inspector wiring with topic + keyword modes per ADR-E67-005. verify.sh green (457 tests).
