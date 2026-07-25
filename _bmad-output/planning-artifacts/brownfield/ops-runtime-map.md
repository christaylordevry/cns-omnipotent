# Ops & Runtime Map — Crons, Hermes, Failure Modes

**Scan date:** 2026-07-25 · Hermes home: `~/.hermes` · Control scripts: Omnipotent.md `scripts/`

> [!warning]
> Redact secrets always. Env files listed by **name only**.

---

## Scheduling authority

| Layer | Role |
|-------|------|
| **System crontab** | Authoritative for digest, trends, watchdogs, gateway, sync, awareness |
| **Hermes `cron/jobs.json`** | Legacy morning-digest jobs parked on `0 0 1 1 *` (annual) — superseded |
| **Convex `crons.ts`** | Hourly `trendAnalytics.runAnalyticsPass` |
| **Hooks** | `morning-digest-convex-completion` on agent:end for skill path |

---

## Live crontab map (CNS-relevant)

| Cadence | Job | Script | Log |
|---------|-----|--------|-----|
| `@reboot` | Gateway boot | `hermes-gateway-start.sh` | `gateway-reboot-cron.log` |
| `*/3` | Gateway watchdog | `hermes-gateway-start.sh` if not running | `watchdog.log` (may be absent if never fired) |
| `*/3` | Dashboard sync → Convex | `dashboard-sync.ts` | `dashboard-sync.log` |
| `*/3` | Awareness pull | `run-awareness-pull-cron.sh` | `awareness-pull.log` |
| `*/15` | Trend ingest reddit | `run-trend-ingest-cron.sh reddit` | `trend-ingest.log` |
| `*/30` | Trend ingest news | `run-trend-ingest-cron.sh news` | `trend-ingest.log` |
| hourly | Trend ingest google_trends | `run-trend-ingest-cron.sh google_trends` | `trend-ingest.log` |
| `0 7 * * *` Sydney | Morning digest | `run-morning-digest-cron.sh` | `morning-digest-skill-cron.log` |
| `15 7` / `0 13` / `30 18` Sydney | Push-digest watchdog | `run-push-digest-watchdog-cron.sh` | `push-digest-watchdog.log` |
| `0 19 * * *` Sydney | Digest outcome check | `run-digest-outcome-check-cron.sh` | `digest-outcome-check.log` |

**Note:** Watchdog cron invokes the **full** `run-digest-convex-completion.mjs` orchestrator (not only the thin push-watchdog module).

---

## Dual digest paths (do not conflate)

| Path | Entry | Writes | Status |
|------|-------|--------|--------|
| **Deterministic (current)** | `run-digest-convex-completion.mjs` | Convex + Discord + artifact + entities | Crontab primary |
| **Legacy agent Mode B** | `hermes-morning-digest.sh` | Vault inbox markdown + Discord | Legacy; Hermes jobs parked |

Skill `morning-digest` + convex-completion **hook** can still trigger completion after agent skill runs.

---

## Scoring (Epic 64)

**File:** `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs`  
**Also mirrored under** Omnipotent `scripts/hermes-skill-examples/morning-digest/scripts/`

| Dimension | Weight in rankScore (when engagement present) |
|-----------|-----------------------------------------------|
| personalRelevance | 0.30 |
| relevance | 0.20 |
| momentum | 0.20 |
| urgency | 0.15 |
| novelty | 0.10 |
| normalizedEngagement | 0.05 |

Context files: `nexus-goals.yaml`, `nexus-people.yaml`, `trend-watchlist.yaml`, sprint-status.yaml.

**App overlay (89-3):** source-class caps + substance floor on queue selection — uses raw 0–100 scores (`clampRawScore0to100`), not `normalizeScorePercent`.

---

## CNS skills (14) — operational roles

| Skill | Operator surface | Vault writes? |
|-------|------------------|---------------|
| `morning-digest` | Discord briefing | No (skill claim) |
| `session-close` | `/session-close` Discord | Yes (governed apply) |
| `triage` | Inbox triage | Yes (`vault_move` on execute) |
| `investigate-trend` | Discord recommendation | No |
| `notebook-query` | NotebookLM Q&A | Log to Convex |
| `run-chain` | CLI brief | No protect-list imports |
| `awareness-sync` | Awareness summary | Cache only |
| `vault-lint` / `vault-think` / `vault-graduate` | Cognition / promote | lint report / graduate yes |
| `hermes-url-ingest-vault` | `#hermes` SourceNotes | Yes |
| `hermes-url-auto-capture-inbox` | `#general` inbox | Unstructured inbox |
| `unified-loop` | Discover shell | Artifact under hermes |
| `hermes-cns-verify-gate-summary` | verify.sh summary | No |

Discord channel binding: `#hermes` = command skills; `#general` = auto-capture only.

---

## Hermes runtime config (non-secret)

| Setting | Value |
|---------|-------|
| Model | `nous` / `anthropic/claude-sonnet-4.6` |
| Memory | Honcho |
| MCP | `cns_vault_io`, `notebooklm`, `perplexity` |
| Voice | `auto_tts: true`; TTS/STT openai defaults |
| Dashboard (Hermes UI) | port **9119**, auth fields empty → localhost assumption |
| Plugin | `cns-brain-recall` |

Env sidecars (names): `.env`, `dashboard-sync.env`, `session-close.env`, `trend-ingest.env`, `awareness-pull.env`, `brain-recall.env`.

---

## Failure modes & known defects

| Issue | Evidence | Severity |
|-------|----------|----------|
| Digest Convex validation `contributedCount` | Recent `digest-outcomes/*.json` | **P0** — breaks morning spine write |
| Voice session expiry | Handoff 2026-07-24 | High for voice UX |
| Firecrawl MCP 401 | Handoff | Research tooling offline |
| `watchdog.log` missing | Inventory | Benign if gateway never needed restart |
| CLAUDE.md constitution version drift (v2.1.5 vs v2.1.59) | Docs | Medium docs debt |
| Root AGENTS.md mentions `vault_write` | Not a registered tool | Docs debt |
| Nexus breaks on Claude Code update | Master plan RP-5 | Recurring ops |
| Dual `_bmad-output` / schema drift across repos | Master plan Part 4.5 | Structural |

---

## Convex HTTP / push

| Endpoint / fn | Auth | Consumer |
|---------------|------|----------|
| `GET /hermes/awareness` | Bearer `HERMES_CONVEX_READ_KEY` | awareness-pull cron + Hermes |
| `hermesPush.deliverAwarenessEvent` | Internal | Discord webhook |

---

## Related

- [data-spine.md](./data-spine.md)
- [operator-workflows.md](./operator-workflows.md)
- HANDOFF-2026-07-24
