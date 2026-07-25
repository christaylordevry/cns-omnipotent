# CNS System Overview — Brownfield

**Scan date:** 2026-07-25 · **Exhaustive multi-part**

---

## Executive summary

CNS is a **multi-part intelligence system**, not a single repo:

| Stratum | What | Where it lives |
|---------|------|----------------|
| **App** | Nexus cockpit + Trends monitor | `cns-dashboard` → Vercel + Convex `amiable-ox-862` |
| **Data / aggregator** | Convex tables + awareness hub | `cns-dashboard/convex/` |
| **Orchestration** | Crons, adapters, digest completion, session-close | `Omnipotent.md/scripts/` + Hermes skills |
| **Agent runtime** | Discord gateway, skills, voice, scoring | `~/.hermes` |
| **Knowledge** | PARA vault / PAKE notes | Live vault via `cns_vault_io` MCP |

The unified-app master plan’s diagnosis holds: **capability is ahead of coherence**. Three Nexus nav routes work; five are dead buttons; Trends is a full second shell not linked from Nexus; several Convex-backed panels exist as orphans.

---

## Part: Omnipotent.md (control)

| Item | Detail |
|------|--------|
| Package | `cns` · Node ≥20 · TypeScript · MCP stdio |
| Entry | `src/index.ts` → server name `cns-vault-io` |
| Tools | 10 Vault IO tools; WriteGate blocks `AI-Context/` |
| Constitution | `specs/cns-vault-contract/AGENTS.md` **v2.1.59** (repo `CLAUDE.md` still cites v2.1.5 — drift) |
| Spec | `specs/cns-vault-contract/CNS-Phase-1-Spec.md` |
| Verify | `bash scripts/verify.sh` (+ sibling dashboard tests when present) |
| Branch | `hermes-consolidation` |

**Also in this repo:** brain/recall, run-chain agents, routing adapters, Phase 4 ingest helpers — orchestration scripts under `scripts/` are the data-spine writers for Convex.

---

## Part: cns-dashboard (Nexus app)

| Item | Detail |
|------|--------|
| Stack | SvelteKit ^2.57 · Svelte ^5.55 · Vite 8 · Tailwind 4 · Convex ^1.39 |
| Adapter | `@sveltejs/adapter-vercel` |
| Charts | LayerChart + ECharts |
| Branch | `cns-redesign` (INSTRUMENT cockpit at `f90723b`) |
| Design SSOT | `src/lib/styles/cns-tokens.css` — near-black `#111`, cyan `#0090C0` |
| Tests | ~763 Vitest (handoff claim; verify gate) |

**Routes:** `/` → `/nexus`; `/nexus`, `/nexus/investigate`, `/nexus/entities`; `/trends`, `/trends/[topicId]`, `/trends/canvas`; Hermes proxy APIs under `/api/nexus/hermes/*` and Trends AI under `/api/trends/*`.

**Convex:** 25 schema tables · ~83 exported functions · HTTP `GET /hermes/awareness` · hourly cron → `trendAnalytics.runAnalyticsPass`.

---

## Part: Hermes (`~/.hermes`)

| Item | Detail |
|------|--------|
| Model | `provider: nous` · `default: anthropic/claude-sonnet-4.6` |
| Memory | Honcho (`memory.provider: honcho`) |
| MCP | `cns_vault_io`, `notebooklm`, `perplexity` (registered in config) |
| CNS skills | 14 under `skills/cns/` (morning-digest, session-close, triage, investigate-trend, …) |
| Scorer | `skills/cns/morning-digest/scripts/score-digest-signals.mjs` — 5 dims → `rankScore` + disposition |
| Gateway | Discord `#hermes` + `#general`; voice/TTS configured; voice UX in app reported broken (session expiry) |
| Dashboard UI | Port **9119** (Hermes web UI — distinct from cns-dashboard) |
| Scheduler | **System crontab** is authoritative; Hermes-internal morning-digest jobs parked on annual expr |

---

## Part: Vault (reference only)

Live PARA at `Knowledge-Vault-ACTIVE` (WSL: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`).

Top-level (vault_list): `00-Inbox`, `01-Projects`, `02-Areas`, `03-Resources`, `04-Archive`, `AI-Context`, `DailyNotes`, `Clippings`, `_meta`, Attachments, plus agent tooling dirs.

**Access:** Vault IO MCP only for agents. Never merge vault into monorepo. WriteGate protects `AI-Context/` (constitution updates via session-close / dual-path sync).

---

## Architecture pattern (as-built)

```
┌─────────────┐    crons/scripts     ┌──────────────────┐    reactive queries    ┌─────────────┐
│  Adapters   │ ──────────────────► │  Convex cloud    │ ─────────────────────► │ Nexus /     │
│  + Hermes   │    HTTP awareness    │  amiable-ox-862  │    + mutations          │ Trends UI   │
│  Discord    │ ◄────────────────── │  hermesAwareness │                        │ Vercel      │
└─────────────┘                      └──────────────────┘                        └─────────────┘
        │                                       ▲
        │ vault_io MCP                          │ dashboard-sync / digest push
        ▼                                       │
┌─────────────┐                                 │
│  PAKE Vault │ ◄── session-close / triage ─────┘ (notes stay in vault; snapshots in Convex)
└─────────────┘
```

**Not a monorepo today.** Cross-repo friction (schema drift, dual `_bmad-output`, verify spanning siblings) is documented in the master plan and is an explicit architecture decision for Gate 0.

---

## Related notes

- [data-spine.md](./data-spine.md)
- [surface-inventory.md](./surface-inventory.md)
- [operator-workflows.md](./operator-workflows.md)
- [ops-runtime-map.md](./ops-runtime-map.md)
