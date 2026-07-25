# Operator Workflows — End-to-End (As Built)

**Scan date:** 2026-07-25  
**Purpose:** Capture real flows for architecture — where wired, where broken, where unrealized.

---

## 1. Morning orient → judgment → investigate

```
07:00 Sydney cron
  → run-morning-digest-cron.sh
  → run-digest-convex-completion.mjs
      → adapters collect → dedupe → score-digest-signals.mjs
      → digest-push artifact
      → Convex digestRuns/digestSignals
      → Discord #hermes
      → entity stage → entityMentions
  → watchdog slots if Convex missing
```

**Operator in app (`/nexus`):**

1. Open Intelligence (Morning Cockpit).
2. Judgment queue shows scored signals (app applies 89-3 source-class caps + substance floor).
3. Select signal → detail + Dig / Watch / Dismiss.
4. **Dig** → `addToInvestigationBoard` → appears on Signals board (`/nexus/investigate`).
5. **Watch** → `addWatchlistKeyword` → watchlist / Trends substrate.
6. **Dismiss** → removed from **local** queue only (reload restores) — **gap**.
7. Inspector can run `runInvestigation` → LLM session on `investigationSessions`.

| Checkpoint | Wired? |
|------------|--------|
| Cron → Convex | **Yes** (when validators match; see ops defect) |
| Convex → cockpit | **Yes** |
| Dig → board | **Yes** |
| Watch → watchlist | **Yes** |
| Dismiss → durable archive | **No** |
| Discord briefing parallel | **Yes** (when push succeeds) |
| Last-sync heartbeat | **No** (stub) |

---

## 2. Investigate (board lifecycle)

**Surface:** `/nexus/investigate` (sidebar label: **Signals**)

1. Board columns: Triage → Investigating → Waiting → Resolved.
2. Move items (`moveBoardItem`); attach notes (`updateBoardItemNote`).
3. From inspector: `runInvestigation` action builds context from digest signal + writes session.
4. Hermes skill `investigate-trend` can also recommend WATCH/IGNORE/ESCALATE from Discord (no vault write) — parallel path, not the same as board Dig.

| Checkpoint | Wired? |
|------------|--------|
| Board CRUD | **Yes** |
| LLM investigation action | **Yes** |
| Resolved → Archive surface | **No** (Archive dead) |
| INSTRUMENT reskin | **No** (still pre-INSTRUMENT look) |

---

## 3. Trend deepen

**Continuous spine:** trend-ingest (news/reddit/GT) → `ingestSignalBatch` → analytics hourly → scores/forecasts/anomalies.

**Operator path:**

1. Navigate to `/trends` **manually** (not in Nexus sidebar).
2. Monitor: topics, scores, anomalies, forecasts, alerts.
3. Topic route `/trends/[topicId]` for deep panels.
4. Explore canvas `/trends/canvas` for layout persistence.
5. Drawer AI: `/api/trends/explain`, `summarise-risk`; Hermes dispatch for watchlist note / investigate-trend.
6. Crossing back to digest item: possible via shared `topicSlug` / inspector topic queries on Nexus layout — **weak product flow** (two shells).

| Checkpoint | Wired? |
|------------|--------|
| Ingest → Convex | **Yes** |
| Trends UI | **Yes** |
| In Nexus nav | **No** (orphaned) |
| INSTRUMENT parity | **No** |
| Digested signal ↔ topic round-trip UX | **Partial** |

Handoff 2026-07-24: Stage 3 Trends Monera unification **abandoned**; master plan **reverses** “ignore trends” → RP-4 adopt decision.

---

## 4. Entity narrative

1. Entity stage after digest push writes `entityMentions`.
2. `/nexus/entities` shows tracked + emerging lanes + health query.
3. Board list also queried for context.
4. “Save top signal” / rich evidence arc — **limited vs master-plan aspiration**.

| Checkpoint | Wired? |
|------------|--------|
| Write after digest | **Yes** |
| Entities page | **Yes** |
| INSTRUMENT | **No** |
| Deep narrative / save top | **Partial / unrealized** |

---

## 5. Knowledge / vault capture

| Step | Mechanism | In app? |
|------|-----------|---------|
| Capture URL (Discord `#general`) | `hermes-url-auto-capture-inbox` → `00-Inbox/` | No |
| Governed ingest (`#hermes`) | `hermes-url-ingest-vault` → SourceNote | No |
| Triage inbox | `triage` skill → `vault_move` | No |
| Graduate insights | `vault-graduate` | No |
| Session close fan-out | `session-close` → vault export, NotebookLM, rhythm | No (Discord reply) |
| Docs button | — | **DEAD** |
| NotebookLM in Trends | health + recent queries | **Yes** (Trends only) |

Vault IO MCP (10 tools) is the agent bridge; Convex holds **snapshots** (`vaultHealth`, `noteIndex`), not note bodies.

---

## 6. Voice

| Step | Status |
|------|--------|
| Hermes TTS/STT config | Present in `~/.hermes/config.yaml` |
| Nexus voice drawer + `/api/nexus/voice/tts` | Present |
| Durable session / reconnect | **BROKEN** / recurring expiry (handoff RP-5) |
| Discord voice FX | Disabled in config |

---

## 7. Awareness

| Step | Status |
|------|--------|
| Snapshot builder | **LIVE** (`hermesAwareness`) |
| HTTP pull for Hermes | **LIVE** (`GET /hermes/awareness`) |
| 3-min pull cron → memories file | **LIVE** |
| Discord push events | `hermesPush.deliverAwarenessEvent` exists |
| App Last-sync / notifications | **STUB / ORPHAN panel** |

---

## Workflow friction map (architecture inputs)

| Friction | Type | Implication |
|----------|------|-------------|
| Two shells (Nexus vs Trends) | Product | Unified shell decision |
| 5 dead nav items | IA | RP-3 scope or remove |
| Dismiss not durable | Data | Schema or local-only honesty |
| Digest `contributedCount` validation | Ops | Fix before trusting morning spine |
| Voice session expiry | Ops | Durable auth |
| Firecrawl 401 (handoff) | Tooling | Research MCP offline |
| Cross-repo schema drift | Topology | Monorepo / shared contract (Gate 0) |
| Docs outside app | Integration | RP-8 |

---

## Related

- [data-spine.md](./data-spine.md)
- [surface-inventory.md](./surface-inventory.md)
- [ops-runtime-map.md](./ops-runtime-map.md)
