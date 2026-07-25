# Data Spine — Source → Cron → Convex → Query → Surface

**Scan date:** 2026-07-25 · Phase 0 RP-1 ground truth  
**Prod:** Convex `amiable-ox-862`

> [!abstract]
> Every live operator surface is fed by Omnipotent.md scripts / Hermes skills writing Convex, then SvelteKit reading via `convex-svelte` queries. Several tables and queries have **no mounted UI**; several nav items have **no route**. This file is the spine map.

---

## Legend

| Status | Meaning |
|--------|---------|
| **LIVE** | Writer + reader + mounted surface all exist |
| **PARTIAL** | Writer and/or query exist; UI missing, stubbed, or client-only |
| **ORPHAN-DATA** | Written / queried but no mounted consumer |
| **ORPHAN-UI** | Component/route exists without nav or without writers |
| **DEAD** | Nav/affordance with no route and no dedicated binding |

---

## Spine 1 — Morning digest → cockpit judgment

| Stage | Artifact |
|-------|----------|
| **Sources** | 17 adapter keys via `scripts/session-close/hermes-run-*.sh`: trends, newsapi, arxiv, hackernews, github, reddit, rss, producthunt, twitter, bluesky, youtube, tiktok, instagram, pinterest, polymarket, threads, linkedin |
| **Orchestrator** | `scripts/run-digest-convex-completion.mjs` (cron: `run-morning-digest-cron.sh` @ **07:00 Australia/Sydney**) |
| **Score** | `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs` — dims: relevance, personalRelevance, novelty, momentum, urgency → `rankScore` + disposition (`escalate`/`priority`/`watch`/`ignore`) |
| **Disk** | `~/.hermes/digest-push-YYYY-MM-DD.json`; outcomes `~/.hermes/digest-outcomes/YYYY-MM-DD.json` |
| **Convex write** | `digest:createDigestRun` → `digest:addDigestSignal` → `digest:finalizeDigestRun` (+ optional `rescoreDigestRun`) via `push-digest-convex.mjs` |
| **Tables** | `digestRuns`, `digestSignals` |
| **Watchdogs** | `run-push-digest-watchdog-cron.sh` @ 07:15 / 13:00 / 18:30 Sydney (re-enters same orchestrator); outcome check 19:00 |
| **Discord** | `post-digest-discord.mjs` → `#hermes` |
| **App query** | `digest.getLatestDigestBrief`, `getRecentDigestRuns`, `getDigestSignalsForRun`, `getDigestSourceHealth` |
| **Surface** | `/nexus` · `NexusMorningCockpit.svelte` (**LIVE**) |
| **App-side selection** | Story **89-3**: source-class caps + substance floor (`clampRawScore0to100`) in dashboard — distinct from Hermes scorer |

**Entity stage (post-push):** `analyze-entity-intelligence.mjs` → `entityIntelligence:clearEntityMentionsForRun` / `recordEntityMentions` / `replaceEntityMentionsForRun` → table `entityMentions` → surface `/nexus/entities` (**LIVE**).

> [!warning] Active ops defect
> Recent outcome files report Convex `ArgumentValidationError: Object contains extra field 'contributedCount'` on `sourceOutcomes[0]`, with Discord also failing. Spine may be **broken at write** until validators/payloads align — treat as P0 ops follow-up, not architecture theory.

**Legacy path (not crontab primary):** `hermes-morning-digest.sh` → Hermes agent Mode B → vault `00-Inbox/hermes-morning-digest-*.md`. Hermes-internal cron jobs parked on annual schedule.

---

## Spine 2 — Dig / Watch / Dismiss (judgment actions)

| Action | Writes | Reads / effect | Status |
|--------|--------|----------------|--------|
| **Dig** | `investigationBoard.addToInvestigationBoard` → `investigationBoardItems` | Board on `/nexus/investigate` | **LIVE** |
| **Watch** | `trendIntelligence.addWatchlistKeyword` → `watchlist` (+ topic scaffolding) | Trends / inspector watchlist | **LIVE** |
| **Dismiss** | **None** — local `dismissedIds` Set in cockpit only | Hides from queue until reload | **PARTIAL** (not persisted) |

Inspector path: Dig/Investigate also uses `investigation.runInvestigation` (action) → `investigationSessions` (**LIVE** from inspector).

---

## Spine 3 — Investigation board

| Stage | Artifact |
|-------|----------|
| **Write** | Cockpit Dig; board mutations `moveBoardItem`, `updateBoardItemNote`, `removeBoardItem` |
| **Table** | `investigationBoardItems` (columns: Triage → Investigating → Waiting → Resolved) |
| **Sessions** | `investigationSessions` via `runInvestigation` + getLatest* queries |
| **Query** | `investigationBoard.listInvestigationBoard` |
| **Surface** | `/nexus/investigate` · `NexusInvestigationBoard` (**LIVE**) |

---

## Spine 4 — Trend ingest → Trends shell

| Stage | Artifact |
|-------|----------|
| **Sources** | `scripts/trend-ingest.py` collectors: `news`, `reddit`, `google_trends` |
| **Cron** | reddit `*/15`; news `*/30`; google_trends `0 * * * *` (live crontab) |
| **Env** | `~/.hermes/trend-ingest.env` |
| **Convex write** | `trends:ingestSignalBatch` |
| **Tables** | `signalEvents`, `trendTopics`, `signalSources`, (downstream) `trendScores`, `trendForecasts`, `trendAnomalies`, `trendAlerts`, `trendAlertDeliveries` |
| **Hourly cron (Convex)** | `crons.ts` → `internal.trendAnalytics.runAnalyticsPass` → scores / anomalies / alert evaluation chain |
| **App queries** | `trends.getTrendTopics`, `getTopicBySlug`, `getSignalSources`; rich `trendIntelligence.*` (scores, forecasts, anomalies, alerts, watchlist) |
| **Surface** | `/trends`, `/trends/[topicId]`, `/trends/canvas` (**LIVE app**, **ORPHAN relative to Nexus nav**) |

Keyword candidates: writers `keywordCandidates.*`; layout still queries `getTopCandidates`; accept/dismiss UI rail **ORPHAN**.

---

## Spine 5 — Entity narrative

| Stage | Artifact |
|-------|----------|
| **Write** | Digest completion entity stage → `entityMentions` |
| **Query** | `entityIntelligence.getEntityIntelligence`, `getEntityIntelligenceHealth` |
| **Surface** | `/nexus/entities` (**LIVE**) |
| **Cross-link** | Also reads `investigationBoard.listInvestigationBoard` for board context |

---

## Spine 6 — Awareness / Last sync

| Stage | Artifact |
|-------|----------|
| **Build** | `hermesAwareness.buildSnapshot` (internal) aggregates digest, entities, board, anomalies, topics, scores, watchlist, vaultHealth, mcpStatus, runChainStatus, syncMetadata |
| **HTTP** | `GET /hermes/awareness` (`http.ts`) bearer `HERMES_CONVEX_READ_KEY` |
| **Pull cron** | `run-awareness-pull-cron.sh` every **3 min** → `~/.hermes/memories/awareness-snapshot.json` |
| **Push** | `hermesPush.deliverAwarenessEvent` → Discord webhook (internalAction) |
| **App query** | `hermesAwareness.getHermesAwarenessSnapshot` |
| **UI** | `NexusAwarenessPanel` **ORPHAN**; TopNav “Last sync: —” **STUB** |

Status: **PARTIAL** — backend hub LIVE; product surface not wired.

---

## Spine 7 — Dashboard / vault health sync

| Stage | Artifact |
|-------|----------|
| **Cron** | `dashboard-sync.ts` every **3 min** |
| **Write** | `dashboard:ingestDashboardSnapshot`, `internalDevState:ingestInternalDevState` |
| **Tables** | `vaultHealth`, `mcpStatus`, `agentLogEntries`, `runChainStatus`, `noteIndex`, `syncMetadata`, `internalDevState` |
| **Query** | `dashboard.getDashboardSnapshot`, `searchNotes`; `internalDevState.getInternalDevState` |
| **UI** | `DashboardShell` / `VaultSearchPanel` / `DiscoveryWorkPanel` **ORPHAN** (no route) |

---

## Spine 8 — NotebookLM

| Stage | Artifact |
|-------|----------|
| **Write** | session-close → `notebookHealth:upsertNotebookHealthSnapshot`; queries via skill → `notebookQueries:logNotebookQuery` |
| **Tables** | `notebookHealth`, `notebookQueries` |
| **Query** | Used on **Trends** layout (`getNotebookHealth`, `getRecentNotebookQueries`) |
| **Nexus Docs nav** | **DEAD** — no vault/notebook Docs surface |

---

## Spine 9 — Knowledge / vault capture (not Convex-primary)

| Flow | Path | Convex? |
|------|------|---------|
| URL ingest `#hermes` | skill `hermes-url-ingest-vault` → `vault_create_note` | No (vault) |
| Auto-capture `#general` | `hermes-url-auto-capture-inbox` → `00-Inbox/` | No |
| Triage | skill `triage` → `vault_move` | No |
| Graduate | `vault-graduate` → InsightNotes in `03-Resources/` | No |
| Session-close | vault export, fast-scan, MEMORY / Daily Rhythm, constitution sync | Snapshots only via dashboard-sync / notebookHealth |
| Docs nav button | — | **DEAD** |

---

## Spine 10 — Canvas / research explore

| Stage | Artifact |
|-------|----------|
| **Table** | `canvasLayouts` |
| **Mutations** | `canvasLayouts.getCanvasLayout` / `saveCanvasLayout` |
| **Surface** | `/trends/canvas` (**LIVE** inside Trends shell) |

---

## Dead / orphan data summary

| Asset | Status |
|-------|--------|
| `trendAnomalies` + `getRecentAnomalies` | Data **LIVE**; Nexus **Anomalies** nav **DEAD**; Trends consumes anomalies; orphan Nexus zones `NexusAnomalyFeedZone` |
| `digest.getDigestSourceHealth` | Queried by cockpit chips (**LIVE**); dedicated `NexusSourceHealthPanel` **ORPHAN**; Sources nav **DEAD** |
| `hermesAwareness` snapshot | Backend **LIVE**; panel + Last-sync **ORPHAN/STUB** |
| `noteIndex` / `searchNotes` | Synced; UI **ORPHAN** |
| `keywordCandidates` | Queried in layout; seeds rail **ORPHAN** |
| Archive / Support nav | **DEAD** — no tables dedicated; Archive could map to resolved board items (undefined) |
| Docs nav | **DEAD** — vault + NotebookLM not bridged into app |

---

## Convex table → primary consumer

| Table | Primary writer | Primary reader surface |
|-------|----------------|------------------------|
| `digestRuns` / `digestSignals` | digest completion | `/nexus` |
| `investigationBoardItems` | Dig / board UI | `/nexus/investigate` |
| `investigationSessions` | `runInvestigation` | Inspector |
| `entityMentions` | entity stage | `/nexus/entities` |
| `signalEvents` / `trendTopics` / `signalSources` | trend-ingest | `/trends*` |
| `watchlist` / `trendScores` / `trendForecasts` / `trendAnomalies` / `trendAlerts*` | ingest + analytics cron + UI | `/trends*` (+ layout queries on Nexus) |
| `keywordCandidates` | ingest/upsert path | orphan rail |
| `canvasLayouts` | Trends canvas | `/trends/canvas` |
| `vaultHealth` / `mcpStatus` / `noteIndex` / `syncMetadata` / `runChainStatus` | dashboard-sync | orphan DashboardShell |
| `internalDevState` | dashboard-sync | orphan DiscoveryWorkPanel |
| `notebookHealth` / `notebookQueries` | session-close / notebook-query | Trends layout |
| (awareness aggregate) | derived | HTTP + orphan panel |

---

## Related

- [surface-inventory.md](./surface-inventory.md)
- [operator-workflows.md](./operator-workflows.md)
- [ops-runtime-map.md](./ops-runtime-map.md)
