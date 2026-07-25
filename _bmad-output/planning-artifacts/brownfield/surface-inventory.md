# Surface Inventory — Wired / Dead / Orphaned

**Scan date:** 2026-07-25 · `cns-dashboard` branch `cns-redesign`  
**Nav SSOT:** `src/lib/components/nexus/NexusSidebar.svelte`  
**Design SSOT:** `src/lib/styles/cns-tokens.css` (INSTRUMENT)

> [!abstract]
> Nexus sidebar: **3 LIVE**, **5 DEAD**. Trends: **LIVE routes**, **ORPHANED from Nexus nav**. Multiple Convex-wired components exist with **zero route importers**.

---

## Status vocabulary

| Status | Definition |
|--------|------------|
| **LIVE** | Route mounted + data bound + reachable from a shell nav |
| **DEAD** | Shown in UI as control but `disabled` / no href / no handler |
| **ORPHANED** | Implemented (route or component + often data) but not linked from primary Nexus nav — or component with no importers |
| **STUB** | Visible control that does nothing useful yet |
| **BROKEN** | Intended path exists but fails in practice (ops/auth) |

---

## A. Nexus sidebar (8 items)

| # | Label | href | Status | Backend readiness |
|---|-------|------|--------|-------------------|
| 1 | Intelligence | `/nexus` | **LIVE** | `digest.*` + board list + 89-3 selection; INSTRUMENT skin |
| 2 | Signals | `/nexus/investigate` | **LIVE** | `investigationBoard.*` (label ≠ “Investigate”) |
| 3 | Anomalies | — | **DEAD** | `trendAnomalies` + `getRecentAnomalies` **exist**; Trends already shows anomalies |
| 4 | Sources | — | **DEAD** | `getDigestSourceHealth` / `getSignalSources` **exist**; panel orphan |
| 5 | Archive | — | **DEAD** | Scope undefined; candidate = resolved board + dismissed history |
| 6 | Entities | `/nexus/entities` | **LIVE** | `entityIntelligence.*` |
| 7 | Docs | — | **DEAD** | Vault + NotebookLM live outside app; no bridge |
| 8 | Support | — | **DEAD** | Scope undefined (operator guide candidates in vault/docs) |

---

## B. Routes (app pages)

| Route | Shell | Status | Primary components |
|-------|-------|--------|--------------------|
| `/` | — | redirect → `/nexus` | — |
| `/nexus` | Nexus | **LIVE** | `NexusMorningCockpit` |
| `/nexus/investigate` | Nexus | **LIVE** | `NexusInvestigationBoard` |
| `/nexus/entities` | Nexus | **LIVE** | entity lanes |
| `/trends` | Trends | **ORPHANED** (from Nexus) / **LIVE** (own shell) | `MonitorScaffold` |
| `/trends/[topicId]` | Trends | same | topic monitor + SSR slug |
| `/trends/canvas` | Trends | same | `ResearchCanvasView` |

**Two shells:** `nexus/+layout.svelte` (sidebar, topnav, inspector, voice drawer) vs `trends/+layout.svelte` (Monitor/Explore tabs, TopicSidebar, context drawer). Unifying these is Wave 4 / architecture work.

---

## C. Nexus chrome

| Control | File | Status | Notes |
|---------|------|--------|-------|
| Brand / sidebar | `NexusSidebar.svelte` | LIVE structure | 5 dead buttons |
| Inspector toggle | `NexusTopNav.svelte` | **LIVE** | Opens Intelligence Inspector |
| Last sync | `NexusTopNav.svelte` | **STUB** | Literal `Last sync: —`; awareness data unused |
| Notifications | `NexusTopNav.svelte` | **STUB** | No onclick |
| Settings | `NexusTopNav.svelte` | **STUB** | No onclick |
| Inspector drawer | `NexusInspectorDrawer.svelte` | **LIVE** | Digest scoring, dig/investigate, topic context |
| Voice drawer | Hermes voice path | **BROKEN** | Handoff: Hermes session expired; reconnect APIs under `/api/nexus/hermes/voice-reconnect/*` |

---

## D. Orphaned components (exist, not mounted by routes)

| Component | Convex bindings | Notes |
|-----------|-----------------|-------|
| `NexusAwarenessPanel` | `hermesAwareness.getHermesAwarenessSnapshot` | Natural Last-sync / notifications substrate |
| `NexusSourceHealthPanel` | digest health queries | Cockpit has inline chips instead |
| `NexusSignalSeedsRail` | keywordCandidates accept/dismiss | Layout still queries `getTopCandidates` |
| `NexusHeroChartZone` | layout trend context | Unmounted |
| `NexusAnomalyFeedZone` | anomalies context | Unmounted — Anomalies nav candidate |
| `NexusSourceWeightsPanel` | source weights | Unmounted |
| `DiscoveryWorkPanel` | `internalDevState.getInternalDevState` | Unmounted |
| `DashboardShell` (+ TrendStub / VaultSearch) | `dashboard.*`, trends topics/sources | Epic 42 shell — **no route** |

---

## E. API surfaces (SvelteKit)

| Path | Role | Status |
|------|------|--------|
| `/api/trends/explain` | Claude stream explain | LIVE (Trends) |
| `/api/trends/summarise-risk` | Claude risk summary | LIVE |
| `/api/trends/hermes-dispatch` | Discord/Hermes watchlist + investigate-trend | LIVE |
| `/api/nexus/hermes/health` | Local Hermes health | LIVE (local) |
| `/api/nexus/hermes/recall-status` | Recall status | LIVE (local) |
| `/api/nexus/hermes/ws` + `ws-ticket` | WS proxy | LIVE (local) |
| `/api/nexus/hermes/voice-reconnect/*` | Voice session repair | Present; durability gap |
| `/api/nexus/voice/tts` | ElevenLabs TTS | Present |

---

## F. Design system surface coverage

| Token / theme | Scope | Status |
|---------------|-------|--------|
| `cns-tokens.css` INSTRUMENT | Global CSS vars; cockpit via token remap | **SSOT** |
| `cockpit-monera.css` + cockpit Svelte | Names legacy; colors INSTRUMENT | LIVE on `/nexus` |
| `nexus-theme.css` | Nexus shell | Partially aligned |
| `trends-theme.css` | Trends navy instrument | **Divergent** — Stage 3 Monera unification abandoned (handoff) |
| Charts | LayerChart token-friendly; ECharts needs JS re-theme | Incomplete |

Honesty primitives (no fake sparklines/confidence) preserved on cockpit — binding for redesign.

---

## G. Done definitions (seed for RP-2 / RP-3)

| Surface | Crisp “done” (proposal for architecture, not shipped) |
|---------|--------------------------------------------------------|
| Intelligence | Already: INSTRUMENT + judgment queue + Dig/Watch + inspector. Gaps: persisted Dismiss; Last-sync; cross-link to Trends |
| Signals | Board columns + notes + investigate action. Gaps: INSTRUMENT reskin; Archive handoff |
| Entities | Lanes + health. Gaps: INSTRUMENT; evidence arc depth |
| Anomalies | Mount zone or page on `getRecentAnomalies`; INSTRUMENT; link to topic |
| Sources | Mount source health + weights; INSTRUMENT |
| Archive | Define: resolved board + dismissed (needs Dismiss persistence) |
| Docs | Vault bridge and/or NotebookLM tab — needs RP-8 |
| Support | Operator guide embed or link — needs RP-3 |
| Trends | Decide adopt-as-nav vs fold (RP-4); INSTRUMENT parity |
| Voice | Durable auth — RP-5 |
| Top-nav | Wire awareness snapshot; real notifications/settings or remove |

---

## Related

- [data-spine.md](./data-spine.md)
- [operator-workflows.md](./operator-workflows.md)
- Master plan Part 1.1 / RP-2–RP-4
