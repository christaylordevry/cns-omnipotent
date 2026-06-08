# Sprint Change Proposal — Epic 63: Nexus Intelligence Cockpit UI

**Date:** 2026-06-06  
**Author:** Correct Course workflow (Chris brief)  
**Status:** Approved (2026-06-06, Chris)  
**Supersession (2026-06-08):** "Epic 64+" Hermes AI wiring references in this document are renumbered to **Epic 66**. Epic 64 is redefined as Intelligence Scoring Engine v1 per `sprint-change-proposal-2026-06-08.md`.  
**Repos affected:** `cns-dashboard` (primary), `Omnipotent.md` (sprint tracking + verify gate)

---

## Section 1: Issue Summary

### Problem statement

The current `cns-dashboard` presents two disconnected surfaces: an Epic 42 **operator situational-awareness console** at `/` and an Epic 46 **trend intelligence workstation** at `/trends`. Signal Seeds data (Epic 62) now accumulates daily in `keywordCandidates`, but the handoff explicitly forbids wiring it into the legacy operator dashboard. The commercial face of Nexus — a premium intelligence cockpit designed in Stitch (project `1178802411726576244`) — has no implementation path in existing epics.

### Trigger

| Field | Value |
|-------|-------|
| Triggering context | Post–Epic 62 session handoff (`HANDOFF-2026-06-06-post-epic62-session.md`) |
| Trigger type | **Strategic pivot** — new product surface, not a bug fix |
| Discovery | Operator brief + Stitch design lock (3 screens, 9 cockpit variants for QA) |
| Evidence | 21 signals/run from morning digest; `keywordCandidates` table live; 642 + 375 tests green |

### Core change

Introduce **Epic 63** to build the Nexus Intelligence Cockpit as a new SvelteKit shell (`/nexus`), reusing the existing Convex trend/digest backend while replacing the visual and interaction model. Epic 42 `/` operator panels and Epic 46 `/trends` layout are **superseded for the Nexus product narrative** (not deleted in Epic 63 — deprecation/redirect is a 63-6 decision).

---

## Section 2: Impact Analysis

### Epic impact

| Epic | Impact |
|------|--------|
| **Epic 63 (NEW)** | Full epic with stories 63-1 … 63-6 as defined below |
| **Epic 62** | Complete — provides `keywordCandidates`, `upsertKeywordCandidate`, `getTopCandidates`; sprint-status still shows `in-progress` (hygiene fix needed) |
| **Epic 46 (cns-dashboard)** | **Superseded for UI** — Convex queries, chart utilities, drawer patterns remain reusable; `/trends` route frozen, not extended |
| **Epic 42 (cns-dashboard)** | **Superseded for primary landing** — operator `DashboardShell` at `/` no longer the product face; may redirect to `/nexus` in 63-6 |
| **Epic 64+ (NEW, implied)** | Hermes wiring for inspector AI actions, Agent Orchestration Workspace (Screen 10), `investigationSessions` table — explicitly out of Epic 63 |

### Story impact (proposed)

| Story | Title | Repo | Depends on |
|-------|-------|------|------------|
| 63-1 | New SvelteKit shell (foundation) | cns-dashboard | — |
| 63-2 | P0 Convex mutations: seed accept/dismiss | cns-dashboard | 63-1 (soft — can parallel after schema review) |
| 63-3 | Signal Seeds chip rail | cns-dashboard | 63-1, 63-2 |
| 63-4 | Hero trajectory chart + anomaly feed | cns-dashboard | 63-1 (parallel with 63-2 after 63-1) |
| 63-5 | Intelligence Inspector drawer | cns-dashboard | 63-1, partial 63-4 |
| 63-6 | Polish pass + digest read queries | cns-dashboard | 63-1 … 63-5 |

**Parallelism:** 63-2 and 63-4 can run in parallel once 63-1 lands.

### Artifact conflicts

| Artifact | Conflict | Required update |
|----------|----------|-----------------|
| `prd-epic-42-cns-dashboard.md` | Positions dashboard as operator read-only console | Add supersession note; Nexus cockpit is separate product narrative |
| `epic-46-ui-spec.md` | 380px drawer, `/trends` route, Monitor/Explore modes | Reference as **legacy ADR**; Epic 63 spec inherits color tokens + chart libs, new layout zones |
| `epics.md` (Omnipotent.md) | No Epic 63 entry | Add Epic 63 section or companion `epics-epic-63.md` |
| `project-context.md` (both repos) | Epic 46 in progress | Update phase status → Epic 63 next |
| `sprint-status.yaml` (both repos) | No epic-63 entries; epic-62 stale | Add epic-63 backlog; mark epic-62 done |
| **Missing** | No PRD/architecture for Epic 63 | Create `prd-epic-63-nexus-intelligence-cockpit.md`, `architecture-epic-63-nexus-cockpit.md` |

### Technical impact

**Existing Convex (reuse — no rewrite):**

| Function | Module | Epic 63 consumer |
|----------|--------|------------------|
| `getTopCandidates` | `keywordCandidates.ts` | 63-3 chip rail |
| `upsertKeywordCandidate` | `keywordCandidates.ts` | ingest (Epic 62) |
| `addWatchlistKeyword` | `trendIntelligence.ts` | 63-2 accept flow |
| `getWatchlistSignalHistory` | `trendIntelligence.ts` | 63-4 hero chart |
| `getRecentAnomalies` | `trendIntelligence.ts` | 63-4 anomaly feed |
| `getSignalSources` | `trends.ts` | 63-4 source weights |
| `getTopicBySlug` | `trends.ts` | 63-5 inspector |
| `getLatestScores` | `trendIntelligence.ts` | 63-5 inspector |
| `getTopicScoreHistory` | `trendIntelligence.ts` | 63-5 sparkline |
| `getSignalEventsForTopicRange` | `trendIntelligence.ts` | 63-5 source trace |
| `getTrendTopics` | `trends.ts` | 63-5 related signals |

**New Convex (Epic 63):**

| Function | Type | Story |
|----------|------|-------|
| `dismissKeywordCandidate` | mutation | 63-2 |
| `acceptKeywordCandidate` | mutation | 63-2 (calls `addWatchlistKeyword`) |
| `getTopicWeekOverWeekDelta` | query | 63-5 |
| `getSourceWeightsForTopic` | query | 63-5 |
| `getRecentDigestSignals` | query | 63-6 (read path; ingest exists in `digest.ts`) |

**UI stack (unchanged):** SvelteKit 2, Svelte 5, Convex reactive queries, LayerChart + ECharts via `EChartsPanel.svelte`, Tailwind 4, Stitch visual reference `1178802411726576244`.

**Out of scope (Epic 63):**

- AI Agent Orchestration Workspace (Screen 10) → Epic 64+
- Hermes wiring for Explain/Compare/Trace/Ask AI → Epic 64+
- `investigationSessions` table → Epic 64+
- Multi-tenancy (`workspaceId` stays nullable stub)

---

## Section 3: Recommended Approach

### Selected path: **Option 1 — Direct Adjustment**

Add Epic 63 with six stories inside the existing sprint structure. No rollback of Epic 46/42 work — backend and chart utilities are leveraged; UI is a greenfield shell on a new route.

| Criterion | Assessment |
|-----------|------------|
| Effort | **Medium** — 6 stories, ~2 new mutations + 3 queries, full layout rebuild |
| Risk | **Medium** — route/landing change affects operator habit; mitigated by phased redirect in 63-6 |
| Timeline | Sequential core: 63-1 → (63-2 ∥ 63-4) → 63-3 → 63-5 → 63-6 |
| Rollback (Option 2) | **Not viable** — Epic 46 Convex investment is foundational; rollback would waste 62+ data layer |
| MVP review (Option 3) | **Not required** — CNS Phase 1 vault IO unchanged; this is Layer 3 product scope |

### Rationale

The Stitch design, Epic 62 data layer, and Epic 45/46 Convex queries converge naturally into a new shell. Building Signal Seeds into the legacy operator dashboard would violate the handoff constraint. A dedicated epic with explicit story sequencing unblocks `/bmad-create-story` → `/bmad-dev-story` without replanning the CNS control layer.

### Open decisions (resolve before 63-1 dev)

1. **Route:** Recommend `/nexus` in 63-1; `/` → `/nexus` redirect in 63-6 (preserve `/ops` or `/dashboard` alias for legacy operator shell if needed).
2. **Drawer width:** Epic 63 spec says **320px**; Epic 46 used 380px — follow Stitch (320px).
3. **Epic 62 sprint hygiene:** Mark `epic-62: done` in Omnipotent.md sprint-status (handoff says complete).

### Naming constraint (approved amendment)

Epic 63 environment variables in `cns-dashboard` **must not** use these names — reserved by the NEXUS Discord–Obsidian bridge:

| Reserved | Reason |
|----------|--------|
| `NEXUS_VAULT_DIR` | Bridge vault path |
| `NEXUS_TMUX_SESSION` | Bridge tmux session |
| `NEXUS_DISCORD_PLUGIN` | Bridge Discord plugin path |

Use `CNS_*`, `DASHBOARD_*`, or `PUBLIC_*` prefixes for new Epic 63 config instead. Document allowed names in `architecture-epic-63-nexus-cockpit.md` ADR-E63-005.

---

## Section 4: Detailed Change Proposals

### 4.1 New PRD — `prd-epic-63-nexus-intelligence-cockpit.md`

**Section: Executive Summary (NEW)**

```
Epic 63 delivers the Nexus Intelligence Cockpit — the commercial face of Nexus.
Dark charcoal SvelteKit shell with Signal Seeds chip rail, hero trajectory chart,
anomaly feed, source weights panel, and 320px Intelligence Inspector drawer.
Powered by existing Convex trend/digest data plus 2 mutations and 3 new queries.
Stitch reference: project 1178802411726576244.
Out of scope: Hermes AI actions (Epic 64+), Screen 10 orchestration workspace.
```

### 4.2 New Architecture — `architecture-epic-63-nexus-cockpit.md`

**Key ADRs to add:**

| ADR | Decision |
|-----|----------|
| ADR-E63-001 | Route `/nexus`; hoisted Convex in `nexus/+layout.svelte`; legacy `/trends` unchanged |
| ADR-E63-002 | Reuse `EChartsPanel.svelte` + LayerChart; inherit Epic 46 color tokens |
| ADR-E63-003 | Inspector drawer 320px; topicSlug in URL params (same contract as Epic 48) |
| ADR-E63-004 | Signal Seeds mutations in `keywordCandidates.ts`; accept composes `addWatchlistKeyword` |
| ADR-E63-005 | Env vars: never `NEXUS_VAULT_DIR`, `NEXUS_TMUX_SESSION`, `NEXUS_DISCORD_PLUGIN` (bridge reserved); prefer `CNS_*` / `DASHBOARD_*` / existing `PUBLIC_*` |

### 4.3 Story proposals

#### Story 63-1 — New SvelteKit shell (foundation)

**Section: Acceptance Criteria**

```
OLD: (none — greenfield)

NEW:
- Route /nexus (or / with redirect deferred to 63-6) renders dark charcoal layout
- Left nav + top nav bar per Stitch project 1178802411726576244
- Three-column grid skeleton: hero / feed / right panel (placeholder content)
- Intelligence Inspector drawer skeleton: 320px, closed by default
- No Convex data wiring beyond layout shell
- verify.sh passes; no regression to /trends or legacy /
```

**Rationale:** Scaffold everything else lands in.

---

#### Story 63-2 — P0 Convex mutations: seed accept/dismiss

**Section: Acceptance Criteria**

```
OLD: keywordCandidates has upsertKeywordCandidate + getTopCandidates only

NEW:
- dismissKeywordCandidate({ term }) sets dismissed: true on matching row
- acceptKeywordCandidate({ term }) sets accepted: true, dismissed: false,
  calls addWatchlistKeyword with displayTerm
- Unit tests in tests/convex/keywordCandidates.test.ts
- Idempotent: double-dismiss / double-accept safe
```

**Rationale:** Unblocks 63-3 Track/Dismiss actions.

---

#### Story 63-3 — Signal Seeds chip rail

**Section: Acceptance Criteria**

```
NEW:
- Hero section "WHAT YOU SHOULD WATCH" wired to getTopCandidates
- Horizontal chip rail: displayTerm, category badge, source badge (AR/HN/GT from sourceType),
  momentum arrow from score
- Track → acceptKeywordCandidate; Dismiss → dismissKeywordCandidate
- Chips removed from rail on dismiss; accepted chips leave rail (on watchlist)
```

**Rationale:** Primary Signal Seeds operator surface — explicitly NOT on legacy dashboard.

---

#### Story 63-4 — Hero trajectory chart + anomaly feed

**Section: Acceptance Criteria**

```
NEW:
- Teal multi-line hero chart from getWatchlistSignalHistory (LayerChart)
- Anomaly feed cards from getRecentAnomalies with confidence tags
- Source weights panel from getSignalSources
- Reactive via convex-svelte useQuery in nexus/+layout.svelte (hoisted)
```

**Rationale:** Main cockpit body; parallel with 63-2 after 63-1.

---

#### Story 63-5 — Intelligence Inspector drawer

**Section: Acceptance Criteria**

```
NEW:
- 320px right drawer opens on topic selection
- Wired: getTopicBySlug, getLatestScores, getTopicScoreHistory (sparkline + WoW delta),
  getSignalEventsForTopicRange (source trace)
- NEW queries: getTopicWeekOverWeekDelta, getSourceWeightsForTopic
- "Why This Matters": stub from digestRuns.deepSignalSummary (real wiring in 63-6)
- Related signals from getTrendTopics
- 2×2 action grid (Explain / Compare / Trace / Ask AI) — UI buttons only, no Hermes
```

**Rationale:** Inspector is Epic 63 UX centerpiece; AI wiring deferred Epic 64.

---

#### Story 63-6 — Polish pass + digest read queries

**Section: Acceptance Criteria**

```
NEW:
- getRecentDigestSignals read query (digest.ts currently ingest-only)
- Inspector "Why This Matters" wired to real digestRuns data
- Top bar: last sync time + source health indicators
- Responsive drawer open/close; keyboard/a11y pass
- QA against all 9 Stitch cockpit screen variants
- Landing redirect decision implemented (/ → /nexus if approved)
- verify.sh green
```

**Rationale:** Production-ready cockpit; closes digest read gap.

---

### 4.4 Sprint status updates

**File:** `Omnipotent.md/_bmad-output/implementation-artifacts/sprint-status.yaml`

```
OLD:
  epic-62: in-progress
  62-1-keyword-candidates-from-digest-signals: done

NEW:
  epic-62: done
  62-1-keyword-candidates-from-digest-signals: done
  epic-62-retrospective: optional

  # Epic 63 — Nexus Intelligence Cockpit UI (cns-dashboard)
  epic-63: backlog
  63-1-new-sveltekit-shell-foundation: backlog
  63-2-p0-convex-mutations-seed-accept-dismiss: backlog
  63-3-signal-seeds-chip-rail: backlog
  63-4-hero-trajectory-chart-anomaly-feed: backlog
  63-5-intelligence-inspector-drawer: backlog
  63-6-polish-pass-digest-read-queries: backlog
```

**File:** `cns-dashboard/_bmad-output/implementation-artifacts/sprint-status.yaml` — mirror epic-63 block.

---

### 4.5 Project context updates

**Both `project-context.md` files — Phase status section:**

```
OLD: Epic 46 in progress
NEW: Epics 1–48 done; Epic 63 (Nexus Intelligence Cockpit) in backlog → in-progress on first story
```

---

## Section 5: Implementation Handoff

### Scope classification: **Moderate**

Requires backlog reorganization (PO/SM) + Developer execution in `cns-dashboard`. No CNS vault-io or Omnipotent.md `src/` changes except sprint/planning artifacts and verify gate (already includes cns-dashboard tests).

### Handoff recipients

| Role | Agent / Owner | Responsibilities |
|------|---------------|------------------|
| SM | `/bmad-create-story` | Create story files 63-1 … 63-6 from this proposal; update sprint-status |
| PM | `/bmad-prd` or tech writer | Author `prd-epic-63-nexus-intelligence-cockpit.md` |
| Architect | `/bmad-create-architecture` | Author `architecture-epic-63-nexus-cockpit.md` with ADR-E63-001..004 |
| Developer | `/bmad-dev-story` | Implement in `cns-dashboard`; Context7 before SvelteKit/Convex changes |
| QA | verify gate | `bash scripts/verify.sh` in both repos before each story done |

### Success criteria

1. `/nexus` renders full cockpit with live Convex data
2. Signal Seeds Track/Dismiss mutate `keywordCandidates` and accept adds watchlist entries
3. Inspector drawer shows score history, WoW delta, source trace, digest summary
4. AI action grid visible but inert (Epic 64 wires Hermes)
5. All 9 Stitch variants pass visual QA checklist
6. 642 + 375+ tests remain green; new Convex functions have unit tests

### Recommended next steps (post-approval)

1. Approve this proposal
2. Run `/bmad-create-story` for **63-1** (foundation first)
3. Create PRD + architecture artifacts in parallel (can precede 63-2)
4. Mark `epic-62: done` in sprint-status
5. Set `epic-63: in-progress` when 63-1 story file is created

---

## Checklist completion summary

| Section | Status |
|---------|--------|
| 1. Trigger & context | [x] Done — strategic pivot, post-Epic 62 handoff |
| 2. Epic impact | [x] Done — Epic 63 new; 42/46 UI superseded; 64+ implied |
| 3. Artifact conflicts | [x] Done — PRD/architecture/sprint-status updates identified |
| 4. Path forward | [x] Done — Option 1 Direct Adjustment selected |
| 5. Proposal components | [x] Done — this document |
| 6. Final review | [x] Done — approved 2026-06-06 with env-var naming constraint |
| 6.4 Sprint status | [x] Done — updated Omnipotent.md + cns-dashboard |

---

## Approval

**Approved by Chris, 2026-06-06.** Amendment: Epic 63 env vars must not collide with NEXUS bridge (`NEXUS_VAULT_DIR`, `NEXUS_TMUX_SESSION`, `NEXUS_DISCORD_PLUGIN`).
