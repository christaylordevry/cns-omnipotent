---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: architecture
lastStep: 8
status: complete
completedAt: "2026-06-24"
project_name: CNS — Hermes Consolidation & JARVIS Presence
user_name: Chris
date: "2026-06-24"
preImplementationItems:
  - FR-GATE — confirm Portal paid tier includes Tool Gateway (Pre-4)
  - NFR3 — Brain embedder audit before Portal /embeddings switch
  - vitest.config.ts — add tests/hermes/**/*.test.ts include (Epic B or D1 setup story)
topologyDecision: option-a-locked
topologySummary: "Hermes Desktop/Discord = conversational + voice JARVIS; /nexus = FR12 awareness + async ask-Hermes via hermes-dispatch webhook; D3 embedded chat dev-local/tunnel opt-in only"
epicDSplit:
  - D1-awareness
  - D2-voice
  - D3-embedded-optional
operatorLeans:
  FR11: "Option A confirmed — Anthropic key for Synthesis/Hook/Boss; zero adapter code"
  FR13: "Option (ii) confirmed — async hermes-dispatch; not Epic D MVP"
  FR12-pull: "Least-privilege Convex HTTP read action; not Convex MCP"
  FR12-push: "Webhook fallback v1; no tunnel; API-Server injection future opt-in only"
inputDocuments:
  - _bmad-output/planning-artifacts/prd-hermes-consolidation.md
  - _bmad-output/planning-artifacts/architecture-vision.md
  - project-context.md
  - docs/architecture.md
  - docs/project-overview.md
  - docs/CNSHermes New Big Plan/00-research-index.md
  - docs/CNSHermes New Big Plan/01-ground-truth-system-state.md
  - docs/CNSHermes New Big Plan/02-vault-alignment-report.md
  - docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md
  - docs/CNSHermes New Big Plan/04-nous-portal-integration.md
  - docs/CNSHermes New Big Plan/05-openai-codex-assessment.md
  - docs/CNSHermes New Big Plan/06-implementation-sequence.md
  - docs/CNSHermes New Big Plan/07-merged-accurate-memory.md
  - ../cns-dashboard/project-context.md
  - ../cns-dashboard/convex/schema.ts
  - ../cns-dashboard/src/routes/api/trends/hermes-dispatch/+server.ts
  - ../cns-dashboard/src/lib/server/hermes-trend-dispatch.ts
  - ../cns-dashboard/src/lib/server/trends-claude.ts
  - ../cns-dashboard/src/routes/api/trends/explain/+server.ts
  - ../cns-dashboard/src/routes/api/trends/summarise-risk/+server.ts
  - ../cns-dashboard/src/routes/nexus/+layout.svelte
  - ../cns-dashboard/src/routes/nexus/+page.svelte
  - ../cns-dashboard/src/routes/nexus/entities/+page.svelte
  - ../cns-dashboard/src/routes/nexus/investigate/+page.svelte
  - ../cns-dashboard/src/routes/nexus/nexus-theme.css
operatorConstraints:
  untouched:
    - NEXUS Discord–Obsidian bridge bot
    - run-chain engine — forbidden paths (Epic B):
        - src/agents/synthesis-adapter-llm.ts
        - src/agents/hook-adapter-llm.ts
        - src/agents/boss-adapter-llm.ts
        - src/agents/run-chain.ts
        - scripts/run-chain.ts
    - Discord gateway
    - morning-digest cron
    - Brain index (NFR3)
  deferred:
    - ADR-HERMES-011 inline streaming (FR13 i/iii)
    - ADR-HERMES-012 D3 embedded chat (dev/tunnel opt-in)
    - CNS_SYNTHESIS_BASE_URL Portal optimization
    - Tailscale/tunnel for Hermes API Server push
  locked:
    - PRD §10.8 topology option (a)
    - FR11 Option A
    - FR13 Option (ii)
    - FR12 pull via least-privilege HTTP
    - FR12 push v1 via webhook
  confirmedNotOpen:
    - FR9 embed pattern (SvelteKit server proxy; browser never holds API_SERVER_KEY)
    - FR12 awareness mechanism (least-privilege HTTP pull + webhook push hybrid)
  gate:
    - FR-GATE — Tool Gateway requires paid Portal tier (voice, dashboard AI reroute, Firecrawl drop)
---

# Architecture Decision Document — Hermes Consolidation & JARVIS Presence

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

**Companion PRD:** `prd-hermes-consolidation.md`  
**Vision input:** `architecture-vision.md`  
**Repos in scope:** `Omnipotent.md` (control layer) + `cns-dashboard` (Layer 3 / Convex)

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

Hermes Consolidation spans provider migration (FR1–FR4), desktop surface (FR5–FR6), run-chain knowledge/revival without engine rewrite (FR7–FR8, FR11 stub), JARVIS presence in the Nexus ecosystem (FR9–FR14), native memory activation (FR15–FR16), and governance cleanup (FR17). The initiative is explicitly cross-repo: Omnipotent.md owns Hermes config, skills, dashboard-sync, run-chain, and Brain; cns-dashboard owns Convex intelligence/observability tables, `/nexus` UI, `hermes-dispatch`, and degraded `explain`/`summarise-risk` server routes.

Epic D (FR9–FR14) is the highest-complexity track. **Topology option (a) is locked:** Hermes Desktop and Discord are the conversational + voice JARVIS surfaces; the `/nexus` cockpit delivers FR12 data-awareness plus a Vercel-safe async "ask Hermes" box via the existing `hermes-dispatch` webhook (reply arrives in Discord/Desktop). Embedded inline chat (D3) is dev-local or tunnel opt-in only — not production default.

FR9 (embed proxy pattern) and FR12 (Convex MCP pull + HTTP push hybrid) are answered at mechanism level; architecture details event taxonomy and Vercel-safe paths for FR13.

FR11 remains an operator decision gate (Option A: retain Anthropic key for Boss; Option B: additive provider branch). No Boss adapter design in this initiative.

**Non-Functional Requirements:**

NFR2/NFR3/NFR8 establish hard preservation boundaries (run-chain engine, NEXUS bridge, Brain index, two-bot vault boundary). NFR4 mandates server-side secret handling (ADR-E46-003). NFR1 requires cross-repo verify gate. FR-GATE gates all Tool-Gateway-dependent features (voice, Portal web search, Firecrawl drop).

**Scale & Complexity:**

- Primary domain: Full-stack integration (Hermes agent + SvelteKit/Convex + vault control layer)
- Complexity level: High (runtime zone split, not LOC)
- Estimated architectural components: Portal config, dashboard service, Convex MCP mount, HTTP push bridge, dashboard AI adapter, topology-dependent chat surface, event taxonomy, run-chain governance module

### Technical Constraints & Dependencies

| Constraint | Source | Implication |
|------------|--------|-------------|
| Vercel ↔ WSL unreachable | Deploy topology | **Locked (a):** no production embedded chat to `:9119`; async dispatch + awareness only on Vercel |
| Portal OpenAI-format proxy only | Nous Portal | Run-chain Boss needs FR11 decision; no zero-code Portal path for `tool_choice` |
| API_SERVER_KEY mandatory | Hermes #6439 | Browser never holds key; D3 server proxy pattern when used |
| FR-GATE paid tier | Portal subscription | Blocks FR3, FR10, Firecrawl cancellation |
| Untouched subsystems | Operator + NFR2/NFR3/NFR8 | NEXUS bridge, hook/boss/weapons logic, Discord gateway, digest cron, Brain index |
| Existing seams | Code audit | `dashboard-sync` (3-min pull), `hermes-dispatch` (webhook push), `trends-claude` (dead Anthropic) |

### Cross-Cutting Concerns Identified

1. Runtime zone boundaries (WSL / Vercel / Convex)
2. Secret placement and ADR-E46-003 compliance
3. Provider consolidation vs FR11 residual credential
4. Non-destructive preservation firewall
5. Orientation artifact freshness (Epic C)
6. Seam upgrade: snapshot → live awareness (FR12)
7. Cross-repo verify gate (NFR1)

## Starter Template Evaluation

### Primary Technology Domain

**Brownfield integration architecture** — not a greenfield app bootstrap. Two existing repos extended:

| Repo | Stack | Role in this initiative |
|------|-------|-------------------------|
| `Omnipotent.md` | TypeScript / Node MCP server + Hermes skills/crons | Portal migration, dashboard-sync upgrade, run-chain docs/skill, Hermes awareness pull client |
| `cns-dashboard` | SvelteKit 2 + Svelte 5 + Convex + Vercel | `/nexus` awareness UI, `hermes-dispatch` expansion, Convex HTTP surfaces for FR12 |

### Starter Options Considered

| Option | Verdict |
|--------|---------|
| New SvelteKit / Next / T3 starter | **Rejected** — Epic 63 `/nexus` shell exists |
| New Hermes install | **Rejected** — v0.17.0 live on WSL |
| Greenfield Convex project | **Rejected** — schema + intelligence tables live |
| **Brownfield extension on locked stacks** | **Selected** |

### Selected Foundation: Brownfield Extension

**Rationale:** All surfaces, schemas, and integration seams pre-exist. This initiative wires Portal provider, upgrades awareness seams, and adds Desktop/voice — it does not scaffold a new application.

**No initialization command.** First implementation stories are Epic C pre-work + Epic A Portal login (per `06-implementation-sequence.md`).

### Architectural Decisions Provided by Existing Foundation

**Language & Runtime:** TypeScript strict on both repos; Node ≥20; Hermes Python runtime on WSL (operator-managed).

**Styling:** Tailwind 4 + Nexus theme CSS (`nexus-theme.css`); ECharts via `EChartsPanel.svelte` only (ADR-E46-002).

**Build & Deploy:** `npm run build` + Vercel adapter (dashboard); `npm test` + `verify.sh` gate (both repos).

**Testing:** Vitest (dashboard); Node test runner + vitest (Omnipotent.md).

**Code Organization:** ADR-E46-001..003 (trends/nexus routes, server secrets, drawer slug contract); ADR-E63-005 (no `NEXUS_*` env collision).

**Integration Patterns:** Convex reactive queries; Hermes webhook dispatch; MCP for vault; curated HTTP for Convex read (FR12).

### ADR-HERMES-001 — JARVIS Hosting Topology (LOCKED)

Option **(a)** — no re-opening in later steps.

- **Conversational + voice:** Hermes Desktop (primary) + Discord #hermes (secondary)
- **Cockpit `/nexus`:** FR12 data-awareness + Vercel-safe async "ask Hermes" via `hermes-dispatch` webhook
- **D3 embedded inline chat:** dev-local (`localhost:5173` server proxy) or tunnel — operator opt-in only

### Epic D Decomposition (CONFIRMED)

- **D1 Awareness** — least-privilege Convex HTTP pull, HTTP push for high-signal events, `dashboard-sync` retention/upgrade, `/nexus` live-state panels, async ask box
- **D2 Voice** — Desktop push-to-talk + Portal TTS (FR-GATE)
- **D3 Embedded (optional)** — FR9 server-proxy chat pane; not production on Vercel

### FR13 Credential Note (for Step 4)

Nous Portal is OAuth + short-lived JWT per Context7/Hermes docs — no documented long-lived server API key. Resolved: FR13 Option (ii) async dispatch; ADR-HERMES-011 inline streaming deferred.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-HERMES-001 | JARVIS hosting topology option (a) | **LOCKED** |
| ADR-HERMES-002 | FR12 pull: least-privilege Convex HTTP read | **LOCKED** |
| ADR-HERMES-003 | FR12 push v1: Discord webhook fallback | **LOCKED** |
| ADR-HERMES-004 | FR11: Anthropic key for all run-chain stages | **CONFIRMED — Option A** |
| ADR-HERMES-005 | FR13: async via hermes-dispatch | **CONFIRMED — Option (ii)** |
| ADR-HERMES-006 | FR-GATE tier confirmation | **Pre-work Pre-4** |

**Important Decisions:**

| ADR | Decision |
|-----|----------|
| ADR-HERMES-007 | Portal migration (FR1–FR4) on WSL Hermes |
| ADR-HERMES-008 | Hermes dashboard service + Desktop (FR5–FR6) — **OAuth primary** |
| ADR-HERMES-009 | NFR3 Brain embedder audit before Portal switch |
| ADR-HERMES-010 | Per-skill routing activation (FR14) post-Epic A |

**Deferred (Post-MVP / Explicit Opt-In):**

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-HERMES-011 | Inline streaming explain/risk (FR13 i/iii) | Operator confirmed defer |
| ADR-HERMES-012 | D3 embedded chat pane | Dev-local/tunnel only |
| — | CNS_SYNTHESIS_BASE_URL Portal path | Unnecessary scope into protected engine |
| — | Tailscale/tunnel for API-Server push | No public exposure for personal tool |
| — | API-Server session injection for push | Graduate only on explicit future opt-in |

### ADR-HERMES-002 — FR12 Pull (Least-Privilege HTTP Read)

**Rejected:** Full Convex MCP server mount in Hermes.

**Selected:** Read-only Convex `httpAction` at `GET /hermes/awareness` returning a fixed **HermesAwarenessSnapshot** DTO.

| Property | Value |
|----------|-------|
| Auth | `Authorization: Bearer ${HERMES_CONVEX_READ_KEY}` |
| Implementation | `cns-dashboard/convex/http.ts` + `convex/hermesAwareness.ts` (`internalQuery`) |
| Consumer | Hermes cron/skill on WSL (3-min poll + on-demand) |
| Excluded | Full `noteIndex`, raw `agentLogEntries`, mutations, arbitrary function execution |

**DTO sections:** `sync`, `vault`, `chain`, `mcps`, `digest` (top 5 signals), `entities` (top 5 tracked + 3 emerging), `investigations` (summary), `trends` (top 3 anomalies + 3 scores).

### ADR-HERMES-003 — FR12 Push v1 (Webhook Fallback)

**Selected:** Convex internal action → `HERMES_DISCORD_WEBHOOK_URL` with structured awareness messages.

| Event | Priority |
|-------|----------|
| Run-chain `error` state | P0 |
| Digest HIGH-score signal | P1 |
| Investigation board promotion | P1 |
| Trend anomaly spike | P2 (stretch) |

**Not in v1:** Tailscale/tunnel, API-Server session injection (future explicit opt-in only).

### ADR-HERMES-004 — FR11 Run-Chain Credentials (CONFIRMED)

**Option A — purest form (operator confirmed):**

- Keep **one `ANTHROPIC_API_KEY`** in `.env.live-chain`
- **All three stages** (Synthesis, Hook, Boss) stay on Anthropic Messages API
- **Zero adapter code changes**
- **Do not** implement `CNS_SYNTHESIS_BASE_URL` Portal optimization in this initiative

**Epic B scope:** governance doc module (`AI-Context/modules/run-chain.md`) + vault project folder + Hermes trigger skill + **key rotate/validate only**.

### ADR-HERMES-005 — FR13 Dashboard AI (CONFIRMED)

**Option (ii) — async via hermes-dispatch:**

- Expand `hermes-dispatch` with `ask` action (and context payload)
- Reply arrives in Discord/Desktop — not inline SSE in cockpit
- **Not in Epic D MVP**; lowest priority stretch within D1 or post-D1
- ADR-HERMES-011 inline streaming **deferred**; do not rewiring `trends-claude.ts` in Epic D

### ADR-HERMES-008 — Hermes Dashboard Auth + Desktop (FR5–FR6) (LOCKED)

**Verified live (Context7 + `hermes dashboard --help`, June 2026):** dashboard auth has three providers — **OAuth (Nous Portal, recommended)**, username/password (basic-auth), and self-hosted OIDC.

**Primary path (canonical — matches FR5 operator decision):**

1. Portal login already complete from Epic 74 (`hermes setup` / `hermes auth add nous` if needed).
2. Register dashboard OAuth client:
   ```bash
   hermes dashboard register
   # ✓ writes HERMES_DASHBOARD_OAUTH_CLIENT_ID to ~/.hermes/.env (mode 0600)
   ```
   *(Verify exact subcommand at implementation time — live CLI exposes `hermes dashboard register`.)*
3. Optional config mirror in `~/.hermes/config.yaml`:
   ```yaml
   dashboard:
     oauth:
       client_id: <from register>
   ```
4. Run persistently via systemd on `0.0.0.0:9119` with `--skip-build`; non-loopback bind engages auth gate.
5. Verify gate: `curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'` — expect OAuth provider present.
6. **Hermes Desktop (Windows):** connect to WSL backend URL (`http://localhost:9119` when mirrored networking works); sign in via **Nous OAuth** (same Portal account).

**Fallback only (documented, not default):**

- If `hermes dashboard register` or Desktop OAuth login fails after documented retry, operator may adopt **basic-auth on trusted WSL localhost/LAN** per Hermes docs (`HERMES_DASHBOARD_BASIC_AUTH_*` in `~/.hermes/.env`).
- Fallback completion **requires** recording the decision in `hermes-desktop.md` governance — stories must not silently default to basic-auth.
- Basic-auth is **not** for internet-facing exposure; WSL↔Windows localhost qualifies as trusted network.

**Rejected as primary:** basic-auth-first setup from legacy research docs (`03-hermes-desktop-connection.md`) — superseded by Portal OAuth registration path.

### Authentication & Security — Secret Table

| Secret | Location | Purpose |
|--------|----------|---------|
| Portal OAuth refresh token | `~/.hermes/auth.json` | Hermes inference (WSL only) |
| `HERMES_DASHBOARD_OAUTH_CLIENT_ID` | `~/.hermes/.env` (from `hermes dashboard register`) | Dashboard + Desktop OAuth (**primary**, ADR-HERMES-008) |
| `HERMES_DASHBOARD_BASIC_AUTH_*` | `~/.hermes/.env` (fallback only) | Dashboard username/password if OAuth path blocked |
| `HERMES_CONVEX_READ_KEY` | Convex env + `~/.hermes/` env | FR12 pull bearer |
| `HERMES_DISCORD_WEBHOOK_URL` | Vercel + Convex env | Dispatch + awareness push v1 |
| `ANTHROPIC_API_KEY` | `.env.live-chain` (gitignored) | **Synthesis, Hook, Boss** (FR11-A) |
| `API_SERVER_KEY` | WSL only | Hermes API Server; D3 dev opt-in |
| `CONVEX_DEPLOY_KEY` | `~/.hermes/dashboard-sync.env` | Existing snapshot push |

Browser never holds inference keys (ADR-E46-003). No `NEXUS_*` env vars in cns-dashboard (ADR-E63-005).

### Data Architecture

No Convex schema redesign. New HTTP surface + internal queries only. Retain `dashboard-sync.ts` until D1 pull validated; keep DTO field names aligned with existing validators in `convex/validators.ts`.

### API & Communication Patterns

| Seam | Pattern | Zone |
|------|---------|------|
| FR12 pull | `GET /hermes/awareness` | Convex → WSL Hermes |
| FR12 push v1 | Webhook POST | Convex → Discord → Hermes |
| Cockpit ask (stretch) | `POST api/trends/hermes-dispatch` | Vercel → Discord → Hermes |
| Vault | `cns_vault_io` MCP | WSL Hermes |
| `/nexus` UI | Convex `useQuery` (unchanged) | Vercel browser |

### Infrastructure & Deployment

| Zone | Workloads |
|------|-----------|
| WSL | Gateway, dashboard `:9119`, proxy `:8645`, awareness pull client, `dashboard-sync` |
| Vercel | `/nexus`, `hermes-dispatch` |
| Convex | Intelligence DB, HTTP awareness, push actions |

### Decision Impact — Implementation Sequence

```
Pre-work (fixture, session-close, Portal tier)
  → Epic A (Portal + Desktop)
      → Epic B (doc + skill + Anthropic key rotate/validate ONLY)
      → Epic C (orientation) — parallel
      → Epic D1 (awareness HTTP pull + webhook push + ask box stretch)
          → Epic D2 (voice; FR-GATE)
          → D3 + FR13-inline + tunnel push (deferred)
```

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical conflict points:** 12 areas where agents could diverge without these rules (protect-list paths, test globs, seam choice, FR-GATE, repo ownership, DTO drift, deferred scope creep).

### Naming Patterns

**Convex (cns-dashboard):** camelCase tables (existing); new modules `hermes*.ts`; HTTP route `GET /hermes/awareness`; env vars `HERMES_*` / `CNS_*` — never `NEXUS_*` (ADR-E63-005).

**Hermes dispatch actions:** kebab-case literals — `'save-watchlist-note'`, `'investigate-trend'`, `'ask'` (stretch).

**Webhook push `eventType`:** dot-namespaced — `awareness.run_chain.error`, `awareness.digest.high_signal`.

### Structure Patterns

**Repo ownership:**

| Epic | Primary repo |
|------|----------------|
| A | WSL Hermes + Omnipotent docs |
| B | Vault governance + Hermes skill + key validate script only |
| C | Vault session-close + both project-context files |
| D1 | cns-dashboard `convex/` + Omnipotent pull client |
| D2 | WSL Hermes config |
| D3 / FR13-inline | Deferred |

**cns-dashboard additions:**

```
convex/http.ts
convex/hermesAwareness.ts
convex/hermesPush.ts
src/lib/server/hermes-trend-dispatch.ts   # extend
src/routes/api/trends/hermes-dispatch/    # extend
```

**Omnipotent.md additions:**

```
scripts/hermes-awareness-pull.ts
scripts/validate-anthropic-key.ts
tests/hermes/hermes-awareness-pull.test.ts      # vitest — see tests/hermes/ domain
tests/hermes/validate-anthropic-key.test.ts
AI-Context/modules/run-chain.md                 # vault via session-close
```

**Test domain decision:** use dedicated `tests/hermes/` with one-line addition to `vitest.config.ts` include glob (`tests/hermes/**/*.test.ts`). Low config friction; better semantic fit than `tests/vault-io/` for Hermes integration scripts.

### Format Patterns

**HermesAwarenessSnapshot:** camelCase JSON DTO (see ADR-HERMES-002). Hand-mirror types in Omnipotent with sync comment (same pattern as `dashboard-sync.ts`).

**Dispatch API:** preserve `{ ok: true }` / `{ message, code }` envelope from existing `hermes-dispatch`.

**Webhook body:** prefix `[awareness.<eventType>]` for v1 filtering without new parsers.

### Communication Patterns

- FR12 pull: 3-min cron + cache at `~/.hermes/memories/awareness-snapshot.json` — no per-turn Convex call.
- FR12 push v1: webhook only from Convex — never `127.0.0.1:9119` from cloud.
- FR13 ask (stretch): single POST, no browser polling for Discord reply.

### Process Patterns

**Protect-list gate — exact forbidden paths (Epic B and all stories unless explicitly authorized):**

| Path | Reason |
|------|--------|
| `src/agents/synthesis-adapter-llm.ts` | Synthesis LLM adapter |
| `src/agents/hook-adapter-llm.ts` | Hook LLM adapter |
| `src/agents/boss-adapter-llm.ts` | Boss LLM adapter (`tool_choice`) |
| `src/agents/run-chain.ts` | Run-chain orchestration |
| `scripts/run-chain.ts` | Run-chain entry script |

Also untouched: NEXUS bridge, Discord gateway, morning-digest cron, Brain index wiring (NFR3 audit first).

**Epic B allowed code:** `.env.live-chain` docs, `scripts/validate-anthropic-key.*`, Hermes skill markdown, vault governance markdown — **zero edits** to the five paths above.

**Test convention (Omnipotent.md — verify.sh must execute new tests):**

| Runner | Glob / location | Example |
|--------|-----------------|--------|
| Node (`npm run test:node`) | `tests/*.test.mjs` only | `tests/constitution.test.mjs` |
| Vitest (`npm run test:vitest`) | `tests/vault-io/**`, `tests/verification/**`, `tests/brain/**`, `tests/model-routing/**`, **`tests/hermes/**`** | `tests/hermes/hermes-awareness-pull.test.ts` |

**Do not** add bare `tests/*.test.ts` at repo root — not picked up by either runner. Hermes-integration tests → **`tests/hermes/`** (requires `vitest.config.ts` include line — one-time setup story in Epic B or D1).

**FR-GATE:** stories for FR3/FR10/Firecrawl-cancel must AC tier confirmation.

**Verify gate:** `bash scripts/verify.sh` both repos before done.

### Enforcement Guidelines

**All AI agents MUST:**

1. Read this ADR + PRD before Epic A–D stories
2. Check protect-list exact paths before every PR
3. FR12 pull = HTTP only; FR12 push v1 = webhook only
4. Keep FR13 out of Epic D MVP unless tagged `stretch-fr13`
5. Place new tests in runner-covered globs (see table above)
6. Pass `verify.sh`

### Pattern Examples

**Good Epic B:** governance doc + Hermes skill + `scripts/validate-anthropic-key.ts` + `tests/hermes/validate-anthropic-key.test.ts`

**Anti-pattern:** edit `src/agents/boss-adapter-llm.ts` to add Portal proxy branch

**Anti-pattern:** `tests/hermes-awareness-pull.test.ts` at repo root (never runs in CI)

## Project Structure & Boundaries

### Complete Project Directory Structure (additions + touch points)

```
Omnipotent.md/
├── scripts/
│   ├── dashboard-sync.ts              # EXISTING — retain until D1 pull proven
│   ├── run-chain.ts                   # PROTECTED — do not edit (Epic B)
│   ├── hermes-awareness-pull.ts       # NEW (D1) — GET Convex /hermes/awareness
│   └── validate-anthropic-key.ts      # NEW (Epic B) — key smoke test only
├── src/agents/
│   ├── synthesis-adapter-llm.ts       # PROTECTED
│   ├── hook-adapter-llm.ts            # PROTECTED
│   ├── boss-adapter-llm.ts            # PROTECTED
│   └── run-chain.ts                   # PROTECTED
├── tests/
│   ├── *.test.mjs                     # Node runner glob only
│   └── hermes/                        # NEW domain — add to vitest.config.ts include
│       ├── hermes-awareness-pull.test.ts
│       └── validate-anthropic-key.test.ts
├── vitest.config.ts                   # EXTEND — "tests/hermes/**/*.test.ts"
└── _bmad-output/planning-artifacts/
    └── architecture-hermes-consolidation.md

Knowledge-Vault-ACTIVE/  (via session-close)
├── AI-Context/modules/run-chain.md    # NEW (Epic B)
└── AI-Context/projects/run-chain/     # NEW (Epic B)

~/.hermes/  (WSL)
├── config.yaml                        # Epic A
├── auth.json                          # Portal OAuth
├── memories/awareness-snapshot.json   # NEW (D1)
├── skills/cns/
│   ├── run-chain/SKILL.md             # NEW (Epic B)
│   └── awareness-sync/SKILL.md        # NEW (D1)
└── crons/                             # awareness pull (D1)

cns-dashboard/
├── convex/
│   ├── http.ts                        # NEW (D1)
│   ├── hermesAwareness.ts             # NEW (D1)
│   ├── hermesPush.ts                  # NEW (D1)
│   ├── validators.ts                  # EXTEND
│   └── schema.ts                      # NO REDESIGN
├── src/routes/api/trends/
│   └── hermes-dispatch/+server.ts     # EXTEND — `ask` (stretch FR13)
├── src/lib/server/
│   └── hermes-trend-dispatch.ts       # EXTEND
└── src/routes/nexus/                  # EXTEND ask box (stretch); no redesign
```

### Architectural Boundaries

**API boundaries:**

| Boundary | Endpoint | Auth | Direction |
|----------|----------|------|-----------|
| FR12 pull | `GET /hermes/awareness` | Bearer `HERMES_CONVEX_READ_KEY` | WSL → Convex |
| FR12 push v1 | Discord webhook | URL secret | Convex → Discord → Hermes |
| Cockpit dispatch | `POST /api/trends/hermes-dispatch` | Trends API auth | Vercel → Discord |
| Vault | MCP stdio | Local gateway | Hermes ↔ vault |
| `/nexus` | Convex queries | Convex client | Browser ↔ Convex |

**Runtime zones:** WSL owns conversation/voice/pull; Vercel owns UI/dispatch; Convex owns intelligence DB + HTTP/push. No cross-zone loopback.

### Requirements to Structure Mapping

| Epic | FRs | Primary locations |
|------|-----|-------------------|
| Pre-work | fixture, session-close, FR-GATE | `tests/fixtures/`, vault session-close, operator Portal subscribe |
| **A** | FR1–FR6, FR-GATE | `~/.hermes/config.yaml`, dashboard systemd, Desktop docs |
| **B** | FR7–FR8, FR11-A | vault `run-chain.md`, `~/.hermes/skills/cns/run-chain/`, `scripts/validate-anthropic-key.ts`, `tests/hermes/` |
| **C** | FR17, NFR8 | session-close, both `project-context.md` |
| **D1** | FR12, stretch FR13 | `convex/http.ts`, `hermesAwareness.ts`, `hermesPush.ts`, `scripts/hermes-awareness-pull.ts` |
| **D2** | FR10, FR14 | `~/.hermes/` config + routing |
| **D3** | FR9 | dev-only proxy — deferred |

### Integration Points & Data Flow

```
[Operator] ──► Desktop/Discord ◄──► Hermes (WSL)
                      ▲                    │
                      │ webhook            ├── MCP ──► Vault
                      │                    ├── pull ──► Convex /hermes/awareness
[/nexus Vercel] ──► Convex ◄── push ── webhook ──► Discord
        └── dispatch ──► webhook ──► Hermes (async ask, stretch)
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision compatibility:** Locked ADRs align — topology (a), FR11-A, FR13-(ii), FR12 HTTP pull + webhook push, and protect-list paths form a coherent cross-repo design with no Vercel→WSL loopback dependencies.

**Pattern consistency:** Protect-list, test globs, seam choices, and epic ownership rules reinforce ADR decisions.

**Structure alignment:** Epic→file mapping covers Omnipotent.md, cns-dashboard, `~/.hermes/skills/cns/`, and vault governance paths.

### Requirements Coverage Validation ✅

All FRs and NFRs have architectural support. PRD G3, FR9, Epic D scope, and `architecture-vision.md` are **aligned with ADR-HERMES-001** at source (embedded pane → D3 opt-in; production cockpit = FR12 awareness + async ask box). `bmad-create-epics-and-stories` may take the PRD as-is.

### Implementation Readiness Validation ✅

Decision, pattern, and structure documentation are sufficient for AI agent implementation. Three pre-implementation items remain tracked (not architecture gaps):

| Item | When |
|------|------|
| **FR-GATE** | Pre-work Pre-4 — Portal tier confirms Tool Gateway |
| **NFR3 embedder audit** | Epic A story — before Brain/Portal embeddings switch |
| **`vitest.config.ts` include** | Epic B or D1 setup — `tests/hermes/**/*.test.ts` |

### Gap Analysis Results

**Resolved:** PRD/vision sync with ADR-HERMES-001 (former gaps #2 and #4).

**Tracked pre-implementation (non-blocking for epics drafting):** FR-GATE, NFR3 embedder audit, vitest include line.

**Critical gaps:** None.

### Architecture Completeness Checklist

**Requirements Analysis** — [x] all four items  
**Architectural Decisions** — [x] all four items  
**Implementation Patterns** — [x] all four items  
**Project Structure** — [x] all four items  

### Architecture Readiness Assessment

**Overall status:** **READY FOR IMPLEMENTATION** (epics + build; pre-work items gate specific stories, not architecture completeness)

**Confidence level:** High

**Key strengths:** Locked topology; exact protect-list; least-privilege FR12 pull; webhook push without tunnel; operator gates closed on FR11/FR13; PRD and vision aligned.

**Future enhancement (explicit opt-in):** API-Server push injection, D3 embedded chat, FR13 inline streaming, Tailscale, Portal synthesis optimization.

### Implementation Handoff

**AI agent guidelines:**

- This document is normative for Hermes consolidation implementation
- Respect protect-list paths and Epic B forbidden files
- FR12 pull = HTTP DTO only; push v1 = webhook only
- FR13 async dispatch is stretch — not Epic D MVP

**First implementation priority:** Pre-work → Epic A → Epic B/C parallel → Epic D1 → D2

**Next BMAD step:** `/bmad-create-epics-and-stories` (inputs: `prd-hermes-consolidation.md` + this ADR)
