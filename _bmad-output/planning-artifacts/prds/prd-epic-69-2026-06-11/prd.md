---
title: Epic 69 — Nexus Intelligence UI: Signal Surface + Operator Visibility
status: final
created: 2026-06-11
updated: 2026-06-11
epicScope: epic-69
workflowType: prd
inputDocuments:
  - Operator brief (2026-06-11)
  - _bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md
  - cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte
  - cns-dashboard/convex/digest.ts
  - cns-dashboard/convex/schema.ts
  - project-context.md
relatedPrd:
  - _bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/prd.md
relatedArchitecture:
  - _bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md
  - cns-dashboard/_bmad-output/planning-artifacts/architecture-epic-63-nexus-cockpit.md
classification:
  projectType: internal-tool
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
repos:
  primaryUi: cns-dashboard
  computePushMetadata: Omnipotent.md
liveUrl: https://cns-dashboard-three.vercel.app/nexus
---

# PRD: Epic 69 — Nexus Intelligence UI: Signal Surface + Operator Visibility

**Author:** Chris Taylor  
**Date:** 2026-06-11  
**Product:** CNS Nexus Intelligence Cockpit — operator visibility for backend signal richness  
**Epic:** 69  
**Status:** Final

## 0. Document Purpose

This PRD is the normative product contract for Epic 69 story authoring (`69-1` through `69-5`). Downstream consumers: `/bmad-create-architecture`, `/bmad-create-epics-and-stories`, `/bmad-create-story`, and `/bmad-dev-story`.

The document anchors vocabulary in §3 Glossary. Functional requirements use globally numbered FR IDs scoped to this epic (`FR-1` through `FR-N`). Assumptions inferred without operator confirmation are tagged `[ASSUMPTION]` and indexed in §9.

**Primary inputs:** Operator brief (2026-06-11) — five UI gaps after Epics 66–68 backend completion. **Normative upstream:** Epic 68 (`contributingSources`, people bonus, 12 sources), Epic 66 (`investigationSessions`, inspector AI actions), Epic 65/63 (Nexus cockpit shell, Signal Intelligence panel). **Live surface:** `/nexus` on cns-dashboard (Vercel).

**Gate pattern (normative):** Story **69-4 (digest signal feed + disposition hierarchy)** is the **layout gate** — ranked digest signals must be visible on the main Nexus surface before disposition styling and board "Add to investigate" actions attach. Story **69-3 (source health)** may split query (69-3a) and panel (69-3b) if push metadata extension is sequenced separately.

**Repo boundary:** UI and Convex read/query extensions in **cns-dashboard**. Optional push metadata (`sourceOutcomes`, `peopleMatch`) in **Omnipotent.md** completion/scoring scripts only — no new source adapters.

---

## 1. Vision

Epics 66–68 made the morning digest backend strong: twelve source families, cross-source deduplication with `contributingSources[]`, people-aware `personalRelevance` v3, X/Twitter and Bluesky adapters, and §9 watchdog reliability. The Nexus Intelligence Cockpit at `/nexus` has not kept pace. The operator sees raw scoring bars in the Intelligence Inspector but cannot answer three daily questions without opening Discord, Convex dashboard, or local YAML files:

1. **Which signals were merged and why?** — Dedup clusters exist in Convex metadata but are invisible.
2. **Why did this signal score high on personal relevance?** — The +20 handle bonus from `nexus-people.yaml` is applied at scoring time but not surfaced.
3. **Did the digest pipeline fire cleanly?** — No at-a-glance view of which sources succeeded vs `(source unavailable)` on the latest run.

Additionally, Epic 66 deferred **Screen 10** (Investigation Workspace) while shipping drawer-based AI actions. Operators need a persistent kanban-style board to track signals under active investigation across sessions — not only ephemeral inspector sessions.

Epic 69 closes the visibility gap. It is **UI/UX-first**: SvelteKit components, mobile-responsive layouts, and targeted Convex query/schema extensions where the Vercel-hosted dashboard cannot infer state from signals alone. It does **not** add adapters, rescoring logic, or Hermes skill changes beyond optional digest-push metadata fields.

The outcome: an operator opening Nexus on a phone after the morning digest can triage by disposition, inspect merge provenance and people matches, confirm source health, and promote signals to an investigation board — all without leaving the cockpit.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Triage fast** — See `priority` and `escalate` signals first in the ranked feed; demote `ignore` noise without losing access.
- **Trust merged signals** — Understand which sources contributed to a deduped row and what engagement each brought.
- **Explain personal scores** — See when a signal ranked high because a watched person authored it, not because of generic keyword overlap.
- **Verify pipeline health** — Confirm all twelve digest sources fired or gracefully degraded on the latest run.
- **Investigate across sessions** — Move signals to a persistent board; return hours later without losing context.

### 2.2 Non-Users (v1)

- External dashboard users / multi-tenant workspaces (`workspaceId` remains stub).
- Discord-only operators (MVP is Nexus web UI).
- PAKE vault editors (no WriteGate or note mutations).

### 2.3 Key User Journeys

**UJ-1. Chris triages the morning digest on mobile.**

- **Persona + context:** CNS operator; digest completed; phone browser on `/nexus`.
- **Entry state:** Latest `digestRun` completed in Convex.
- **Path:** Opens Nexus → **Digest signal feed** shows priority tier pinned → taps signal → inspector opens → reviews disposition badge and rank score → dismisses or adds to investigation board.
- **Climax:** Priority signals visually distinct from `watch`/`ignore`; operator completes triage in under two minutes.
- **Resolution:** Board updated; inspector closed.
- **Edge case:** No scored signals in run → feed shows empty state with link to source health panel.

**UJ-2. Chris inspects a deduplicated launch story.**

- **Persona + context:** Operator sees high `rankScore` on merged OpenAI launch coverage.
- **Entry state:** Inspector open on signal with `dedupClusterSize >= 2`.
- **Path:** Scrolls to **Merge provenance** section → reads source badges (HN, NewsAPI, X) → per-source engagement lines.
- **Climax:** Operator confirms compound engagement drove rank — not a single headline.
- **Resolution:** Trusts digest density; no Discord cross-check.

**UJ-3. Chris explains a Karpathy Bluesky post ranking high.**

- **Persona + context:** `nexus-people.yaml` includes Karpathy handles; people bonus applied at scoring.
- **Entry state:** Inspector Signal Intelligence shows `personalRelevance >= 20`.
- **Path:** **People match** chip shows "Andrej Karpathy · @karpathy.bsky.social · +20 handle match".
- **Climax:** Operator understands score driver without reading local YAML.
- **Resolution:** Adjusts watchlist quarterly if needed.

**UJ-4. Chris verifies source health after a thin digest.**

- **Persona + context:** Digest felt light; operator suspects X or Reddit unavailable.
- **Entry state:** Nexus main grid or inspector adjunct panel.
- **Path:** Opens **Source health** panel for latest run → sees X `unavailable`, Reddit `fired`, Bluesky `fired`.
- **Climax:** Operator knows pipeline degraded gracefully — not a silent failure.
- **Resolution:** Fixes credentials or env before next cron.

**UJ-5. Chris runs a multi-day investigation on an agent-framework spike.**

- **Persona + context:** Signal escalated Monday; operator returns Wednesday.
- **Entry state:** `/nexus/investigate` board route.
- **Path:** Signal in **Investigating** column → opens inspector → runs Compare action (Epic 66) → moves to **Waiting** → adds note.
- **Climax:** Board state persists; latest investigation session linked from card.
- **Resolution:** Moves to **Resolved** when external research completes.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **Digest signal feed** | New Nexus UI zone listing scored `digestSignals` from the latest (or selected) `digestRun`, sorted by disposition tier then `rankScore`. Distinct from Signal Seeds rail (`keywordCandidates`). |
| **Intelligence Inspector** | 320px `NexusInspectorDrawer` — hosts Signal Intelligence, merge provenance, people match, and Epic 66 AI actions. |
| **Merge provenance** | Inspector section displaying `contributingSources[]` when `dedupClusterSize >= 2`. |
| **People match indicator** | Inspector chip showing watchlist person name, matched handle, and bonus points when people scoring applied. |
| **Source health panel** | UI summary of twelve morning-digest sources with last-run status: `fired`, `unavailable`, or `error`. |
| **sourceOutcomes** | Optional `digestRuns` metadata array pushed at digest completion — per-source status and counts. See addendum A1. |
| **peopleMatch** | Optional `sourceMetadata` object pushed at scoring — person name, handle, bonus. See addendum A3. |
| **Disposition tier** | Visual grouping by `disposition`: `priority`, `escalate`, `watch`, `ignore`. |
| **Screen 10** | Investigation Workspace — kanban board at `/nexus/investigate`. Deferred Epic 66; **in scope Epic 69**. |
| **investigationBoardItems** | New Convex table for kanban membership — distinct from `investigationSessions` (AI action runs). |
| **investigationSessions** | Existing Epic 66 table — one row per Explain/Compare/Trace/Ask AI invocation. Board links to sessions; does not replace them. |
| **resolveOperatorHome()** | Mandatory in any Omnipotent.md script changes (push metadata only this epic). |

---

## 4. Features

Stories numbered by **implementation dependency**; §6.2 lists **operator-value priority** for sprint ordering.

### 4.1 Digest Signal Feed + Disposition Hierarchy (69-4)

**Description:** Introduce a ranked digest signal feed on `/nexus` showing latest-run `digestSignals` with visual hierarchy by `disposition`. Priority and escalate signals pinned above watch/ignore tiers. Mobile-responsive card list with tap-to-open inspector. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Digest signal feed component

Add `NexusDigestSignalFeed.svelte` (or equivalent) subscribing to `getLatestDigestBrief` + `getDigestSignalsForRun` (or new `getLatestDigestSignals` convenience query).

**Consequences (testable):**
- Feed renders on `/nexus` below Signal Seeds rail or in center column per layout spec `[ASSUMPTION: center column above anomaly feed]`.
- Signals sorted: disposition tier (priority → escalate → watch → ignore) then `rankScore` desc within tier.
- Each card shows: title, primary source badge, disposition chip, `rankScore`, tap opens inspector for that signal/topic.
- Empty state when no digest run or zero signals.
- Vitest component tests for sort/group logic extracted to `$lib/utils/nexus-digest-feed.ts`.

#### FR-2: Disposition visual hierarchy

Apply disposition styling per addendum A4 using existing `dispositionColour()` tokens.

**Consequences (testable):**
- `priority` cards: pinned section, left border accent, elevated weight.
- `escalate` cards: second pin group with red accent.
- `ignore` cards: collapsed accordion on mobile by default.
- Accessibility: disposition not conveyed by colour alone — text label on every chip.
- `bash scripts/verify.sh` green in cns-dashboard.

**Notes:**
- Signal Seeds rail unchanged — keyword candidates are a separate surface.
- Reuse `getDigestSignalsForRun` sort; client-side tier grouping acceptable for ≤100 signals.

---

### 4.2 Dedup Cluster View — Inspector (69-1)

**Description:** When `sourceMetadata.dedupClusterSize >= 2`, Intelligence Inspector shows **Merge provenance**: contributing source badges, per-source engagement metrics, and primary source label. Realizes UJ-2.

**Functional Requirements:**

#### FR-3: Merge provenance section

Extend `NexusInspectorDrawer.svelte` with conditional section below Signal Intelligence.

**Consequences (testable):**
- Section hidden when `dedupClusterSize` absent or `< 2`.
- Renders badge per `contributingSources[].sourceType` using `sourceDisplayLabel()`.
- Shows best available engagement metric per contributor (`points`, `stars`, `likes`, `upvotes`, etc.).
- Displays cluster size headline: "Merged signal (N sources)".
- Unit tests in `nexus-inspector-scoring.test.ts` or new `nexus-merge-provenance.test.ts` for formatting helpers.

**Out of Scope:**
- Discord digest formatting for merge chips (remains Convex-only evidence per Epic 68).

---

### 4.3 People Match Indicator — Inspector (69-2)

**Description:** Inspector surfaces why `personalRelevance` received people watchlist bonus: person name, matched handle, and bonus points. Realizes UJ-3.

**Functional Requirements:**

#### FR-4: peopleMatch push metadata

Extend `sourceMetadataValidator` with optional `peopleMatch` object. Update `score-digest-signals.mjs` to emit `peopleMatch` when handle (+20) or name (+10) bonus applies. Omnipotent.md touch — not a new adapter.

**Consequences (testable):**
- Validator accepts `peopleMatch: { personName, matchedHandle?, bonusPoints, matchType }`.
- Fixture test: Karpathy handle → `peopleMatch.bonusPoints === 20`.
- `bash scripts/verify.sh` green in Omnipotent.md for scoring tests.

#### FR-5: People match UI chip

Inspector renders people match chip when `sourceMetadata.peopleMatch` present OR fallback when `personalRelevance >= 20` and `authorHandle` present (handle only, no name).

**Consequences (testable):**
- Chip copy: `{personName} · @{handle} · +{bonus} handle match` (full metadata path).
- Fallback copy: `@{handle} · watchlist boost likely` when name unavailable.
- Chip appears in Signal Intelligence section adjacent to `personalRelevance` bar.

---

### 4.4 Source Health Panel (69-3)

**Description:** Operator sees twelve-source health for the latest digest run: fired / unavailable / error with optional reason. Realizes UJ-4.

**Functional Requirements:**

#### FR-6: Source health query

Add `getDigestSourceHealth` query (name `[ASSUMPTION]`) returning canonical twelve-source rows for a `digestRunId`.

**Consequences (testable):**
- **Preferred path:** reads `digestRuns.sourceOutcomes[]` when present.
- **Fallback path:** infers `fired` from `digestSignals` + `contributingSources`; marks others `unknown` with UI disclaimer.
- Returns `{ sourceKey, label, status, signalCount?, reason? }[]`.
- Convex unit tests for both metadata and inference paths.

#### FR-7: sourceOutcomes push metadata (optional gate)

Extend `digestRunRowValidator` with optional `sourceOutcomes[]`. Wire `run-digest-convex-completion.mjs` to populate from digest artifact section markers.

**Consequences (testable):**
- Push with outcomes passes validator.
- Unavailable sources record `status: 'unavailable'` and `reason` from `(source unavailable: …)` text.
- No new adapter scripts — completion hook only.

#### FR-8: Source health panel UI

Add `NexusSourceHealthPanel.svelte` — compact grid or chip row on `/nexus` (right column or below source weights `[ASSUMPTION: below NexusSourceWeightsPanel]`).

**Consequences (testable):**
- Shows all twelve sources from addendum A1 registry.
- Status icons: green fired, amber unavailable, red error, gray unknown.
- Tap source → tooltip with `reason` and signal count.
- Mobile: horizontal scroll chip row.
- Subscribes reactively to latest completed digest run.

---

### 4.5 Investigation Workspace — Screen 10 (69-5)

**Description:** Persistent kanban board at `/nexus/investigate` for signals under active investigation. Backed by new `investigationBoardItems` Convex table. Links to Epic 66 `investigationSessions`. Realizes UJ-5.

**Functional Requirements:**

#### FR-9: investigationBoardItems schema

Add table per addendum A5 with columns: `triage`, `investigating`, `waiting`, `resolved`.

**Consequences (testable):**
- Indexes: `by_column_updated`, `by_signal` (unique per signal `[ASSUMPTION]`).
- Mutations: `addToInvestigationBoard`, `moveBoardItem`, `removeBoardItem`, `updateBoardItemNote`.
- Query: `listInvestigationBoard` grouped by column.

#### FR-10: Investigation board UI

New route `/nexus/investigate` with kanban layout.

**Consequences (testable):**
- Four columns with signal cards: title, disposition, rankScore, added date.
- "Add to investigation" action on digest feed cards and inspector footer.
- Card tap opens inspector; secondary link shows latest investigation session if exists.
- Mobile: tabbed column selector or horizontal swipe `[ASSUMPTION: tabbed]`.
- Sidebar nav item **Signals** or new **Investigate** entry routes to board `[ASSUMPTION: activate Signals nav item]`.
- Board state persists across browser sessions (Convex-backed).

#### FR-11: Board–session linking

Board cards surface latest `investigationSessions` status for linked `digestSignalId` (any action).

**Consequences (testable):**
- Card badge: "Explain complete" / "Streaming…" / no session.
- Does not auto-create sessions — operator triggers Epic 66 actions from inspector.

**Out of Scope:**
- Multi-user assignment, Slack/Discord notifications, Hermes investigate webhook.

---

## 5. Non-Goals (Explicit)

- **New source adapters** — Epic 68 owns ingest; 69 consumes existing data.
- **Scoring engine changes** — except optional `peopleMatch` metadata emission (FR-4).
- **Hermes Discord digest format changes** — merge/people chips remain Nexus-only.
- **Multi-tenant `workspaceId` enforcement** — deferred.
- **LinkedIn / YouTube / Reddit OAuth** — deferred.
- **AI prompt changes** — Epic 66 investigation actions unchanged.
- **Legacy `/` operator dashboard** — Nexus `/nexus` only.
- **Real-time digest streaming** — feed refreshes on Convex subscription after run completes.

---

## 6. MVP Scope

### 6.1 In Scope

- Digest signal feed with disposition hierarchy (69-4).
- Inspector merge provenance for dedup clusters (69-1).
- People match indicator + optional push metadata (69-2).
- Source health panel + query (+ optional push outcomes) (69-3).
- Investigation workspace Screen 10 with `investigationBoardItems` (69-5).
- Mobile-responsive layouts for all new surfaces.
- cns-dashboard tests + `bash scripts/verify.sh` green per story.

### 6.2 Story Table — Prioritized by Operator Value

| Priority | Story | Title | Operator value rationale |
|----------|-------|-------|----------------------------|
| **P0** | **69-4** | Digest signal feed + disposition hierarchy | Daily triage — highest-frequency operator action every morning |
| **P0** | **69-1** | Inspector dedup cluster / merge provenance | Trust in ranked feed — explains why one row replaces three headlines |
| **P1** | **69-2** | People match indicator (+ push metadata) | Explains surprising `personalRelevance` spikes from watchlist |
| **P1** | **69-3** | Source health panel (+ query / push outcomes) | Pipeline confidence when digest feels thin or credentials fail |
| **P2** | **69-5** | Investigation workspace Screen 10 | Cross-session depth work — high value but less frequent than daily triage |

**Suggested sprint sequencing:** `69-4` → `69-1` ∥ `69-3a (query)` → `69-2` → `69-3b (panel + push outcomes)` → `69-5`

**FR traceability:**

| Story | FR IDs |
|-------|--------|
| 69-4 | FR-1, FR-2 |
| 69-1 | FR-3 |
| 69-2 | FR-4, FR-5 |
| 69-3 | FR-6, FR-7, FR-8 |
| 69-5 | FR-9, FR-10, FR-11 |

### 6.3 Out of Scope (v1)

- Drag-and-drop reorder within column `[ASSUMPTION: move via menu sufficient for v1]`.
- Bulk board actions (multi-select resolve).
- Export board to vault note.
- Google Trends in source health as `digestSignal` (shown as keyword pipeline status only).

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Triage efficiency | Operator identifies all `priority` signals without scrolling past `ignore` tier | UX review on mobile + desktop |
| Dedup visibility | 100% of inspector opens on `dedupClusterSize >= 2` signals show merge section | Manual QA on live digest |
| People explainability | When `peopleMatch` pushed, inspector shows person name on first view | Convex row spot-check |
| Source health accuracy | ≥10/12 sources report correct status when `sourceOutcomes` pushed | 69-3 test fixtures + live run |
| Board persistence | Board items survive browser close and 24h gap | QA scenario UJ-5 |
| Regression | Epic 66 inspector actions + Epic 63 cockpit remain functional | `bash scripts/verify.sh` |

**Counter-metrics (do not optimize):**
- **SM-C1:** Board item count — do not gamify open investigations; resolved column should grow.

---

## 8. Open Questions

1. **Layout placement:** Digest feed in center column vs replacing anomaly feed zone for v1? `[ASSUMPTION: new zone above anomaly feed]`
2. **sourceOutcomes push:** Ship inference-only health panel first, or gate panel on completion-hook metadata?
3. **Investigation board uniqueness:** One board item per `digestSignalId` globally, or per digest run?
4. **People list without push metadata:** Accept handle-only fallback for 69-2 v1 if Omnipotent.md metadata story slips?
5. **Sidebar nav:** Wire existing "Signals" stub to `/nexus/investigate` or add dedicated nav item?

---

## 9. Assumptions Index

- **A1:** Digest signal feed is a **new component** — no ranked digest list exists on `/nexus` today.
- **A2:** `sourceOutcomes` push requires small Omnipotent.md completion-hook change — allowed under "Convex queries extending" sibling work.
- **A3:** Person name in UI requires `peopleMatch` push metadata — Vercel cannot read `~/.hermes/nexus-people.yaml`.
- **A4:** `investigationBoardItems` is a **new table** — `investigationSessions` schema is insufficient for kanban state.
- **A5:** Mobile kanban uses **tabbed columns** rather than four-column horizontal scroll on narrow viewports.
- **A6:** Twelve-source registry per addendum A1 — Google Trends and Notebook tracked separately from `digestSourceTypeValue`.

---

## 10. Constraints and Guardrails

| Constraint | Value |
|------------|-------|
| Stack | SvelteKit 2 + Convex + Tailwind 4 (cns-dashboard) |
| Backend adapters | **None** new in Epic 69 |
| Omnipotent.md | Push metadata only; `resolveOperatorHome()` on any script touch |
| Verify gate | `bash scripts/verify.sh` green before each story done |
| Mobile | Operator uses phone — all new surfaces responsive at ≤768px |
| BMAD | Stories only — no ad-hoc implementation outside story files |
| Live URL | https://cns-dashboard-three.vercel.app/nexus |

---

## 11. References

- Live Nexus: https://cns-dashboard-three.vercel.app/nexus
- Epic 68 PRD: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md`
- Epic 66 PRD (Screen 10 deferral): `_bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md`
- Epic 66 architecture: `_bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md`
- Inspector scoring: `cns-dashboard/src/lib/utils/nexus-inspector-scoring.ts`
- Digest queries: `cns-dashboard/convex/digest.ts`
- Technical addendum: `./addendum.md`
