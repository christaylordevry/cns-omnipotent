---
stepsCompleted:
  - step-01-requirements-extraction
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
dashboardAuthDecision: ADR-HERMES-008-oauth-primary-basic-auth-fallback
inputDocuments:
  - _bmad-output/planning-artifacts/prd-hermes-consolidation.md
  - _bmad-output/planning-artifacts/architecture-hermes-consolidation.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/EXPERIENCE.md
  - ../cns-dashboard/project-context.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
project_name: CNS — Hermes Consolidation & JARVIS Presence
epicAliases:
  A: 74
  B: 75
  C: 76
  D1: 77
  D2: 78
preImplementation:
  - pre-1-fixture-fix
  - pre-2-session-close
  - pre-3-static-body-fix
  - pre-4-portal-subscribe-fr-gate
deferred:
  - epic-D3-FR9-embedded-pane
  - ADR-HERMES-011-FR13-inline-streaming
  - FR16-brain-semantic-recall
---

# CNS — Hermes Consolidation & JARVIS Presence — Epic Breakdown

## Overview

This document decomposes the Hermes Consolidation initiative (PRD + architecture ADR) into implementable epics and stories. **Production JARVIS topology (ADR-HERMES-001 option a):** conversational + voice on Hermes Desktop/Discord; `/nexus` cockpit = FR12 data-awareness + async ask box (not embedded chat to WSL).

**Companion artifacts:** `prd-hermes-consolidation.md`, `architecture-hermes-consolidation.md`

## Pre-Implementation Checklist (not stories)

Operator/ops steps before or between epics — **do not create story files for these.**

| ID | Step | Owner | Gates |
|----|------|-------|-------|
| Pre-1 | Fix `tests/fixtures/session-close/section8-draft-fragment.md` (remove blockquote preamble) | Dev (optional, ~2 min) | Clean session-close before Pre-2 |
| Pre-2 | Run `/session-close` in Discord `#hermes` — **BLOCKED until Epic 74.** Live finding 2026-06-24: Hermes provider currently resolves to `none` (no inference), so session-close's LLM steps cannot run. Skip for now; it executes via **story 76-1 after Portal migration**. Not a pre-Epic-74 gate. | Operator | Deferred → 76-1 |
| Pre-3 | Fix `CNS-Daily-Rhythm.md` static body rows (Web App Vision Epic 42 DONE, stack, URL) | Dev | After Pre-2 |
| Pre-4 | Subscribe Nous Portal **paid tier** ($30 plan satisfies `FR-GATE` — all paid tiers include hosted Tool Gateway / web search + TTS; confirm on upgrade screen). **Timing: upgrade the day you start story 74-2 (provider switch), NOT before.** Free tier (inference-only, $0.10/mo) cannot carry Epic 74 validation; a paid month spent on no-Portal stories (74-1, 75-1/2, 76-2/4/5) wastes expiring subscription credit (monthly cycle). Net cost likely *falls* — replaces openai-codex + OpenRouter + Anthropic + standalone Firecrawl/TTS (NFR6). | Operator | Stories **74-2**+, **74-4**, **78-1** |

**Sequencing:** Pre-1 → Pre-3 → (start 74-1 Brain audit, no Portal) → **Pre-4 at story 74-2** → rest of **Epic 74** → Epic 75 ∥ Epic 76 (session-close runs here via 76-1) → Epic 77 → Epic 78
*(Pre-2 session-close is deferred into Epic 76 / story 76-1 — it cannot run until Portal restores a provider.)*

---

## Requirements Inventory

### Functional Requirements

```
FR-GATE: Confirm Portal plan tier includes Tool Gateway before Firecrawl-cancellation, TTS-dependent work, or FR3/FR10 stories.
FR1: Hermes authenticates to Portal via OAuth; provider→nous; default model→anthropic/claude-sonnet-4.6; openai-codex retained as last-resort fallback.
FR2: auxiliary.compression → Portal (anthropic/claude-haiku-4.5); removes last OpenRouter dependency.
FR3: Hermes web search → Portal Tool Gateway ("Nous Subscription") — gated on FR-GATE.
FR4: Discord gateway + morning-digest cron remain operational throughout (regression-tested, not assumed).
FR5: hermes dashboard service runs persistently (systemd user unit + watchdog); primary auth = Nous OAuth via `hermes dashboard register` (HERMES_DASHBOARD_OAUTH_CLIENT_ID); Hermes Desktop OAuth login; basic-auth fallback on trusted WSL localhost only if OAuth path fails (documented in governance); live curl reachability test precedes localhost assumptions.
FR6: Hermes Desktop (Windows) connects to WSL backend; live chat works (WebSocket, not just status).
FR7: Run-chain documented as governance module (AI-Context/modules/run-chain.md) + vault project folder; Hermes cold-starts knowing it (zero engine code).
FR8: Hermes skill triggers run-chain via terminal() and reports results to Discord/Desktop (zero adapter code).
FR9: Embed live Hermes agent pane in /nexus via API Server + server proxy (D3 — dev-local/tunnel opt-in only; NOT production on Vercel).
FR10: Voice: push-to-talk in + streaming TTS out via Portal (Desktop primary; FR-GATE).
FR11: Run-chain credential path — Option A confirmed: keep ANTHROPIC_API_KEY for Synthesis/Hook/Boss; zero adapter edits to protected engine paths.
FR12: Bidirectional dashboard awareness — Hermes reads live Convex state (least-privilege HTTP pull + webhook push v1); cockpit surfaces awareness; no Vercel→WSL loopback.
FR13: Dashboard server-side AI (explain/summarise-risk/investigation) — Option (ii): async hermes-dispatch; stretch, not Epic 77 MVP.
FR14: Per-skill Hermes model routing activated (cheap models for cheap tasks) post-Epic 74.
FR15: Hermes native memory + skill-learning + Honcho user-modeling active; fed by session-close.
FR16: (Stretch) Hermes queries Brain semantic index — depends on Brain production embedder + Portal /embeddings.
FR17: Orientation artifacts regenerate accurately: both MEMORY.md, CNS-Daily-Rhythm AUTO blocks, AGENTS §8, both project-context.md, fast-scan-index; mobile-posture.md + personas/; inbox triage.
```

### Non-Functional Requirements

```
NFR1: bash scripts/verify.sh exits 0 before every commit (CNS + sibling cns-dashboard when present).
NFR2: Non-destructive — no deletion/modification of run-chain adapter logic or NEXUS bridge; additive/env-gated only.
NFR3: Brain integrity — brain:index / brain:query keep working; embedder dependency identified before provider/embeddings switch.
NFR4: No secrets committed; dashboard secrets in $lib/server/+server.ts and Convex/Vercel env; browser never holds inference keys.
NFR5: Reversibility — every provider change config-reversible; openai-codex fallback until Portal proven stable.
NFR6: Net subscription spend should fall; confirm before cancelling standalone services.
NFR7: Fresh chat per BMAD workflow; stories sized under ~50% context.
NFR8: Hermes and NEXUS bridge documented non-colliding boundary on shared vault.
```

### Additional Requirements (Architecture)

```
- Brownfield extension only — no greenfield starter; first code stories follow Pre-work + Epic 74 Portal login.
- ADR-HERMES-001 locked: Desktop/Discord = chat+voice; Vercel /nexus = awareness + async ask only.
- ADR-HERMES-002: FR12 pull via GET /hermes/awareness + HermesAwarenessSnapshot DTO; bearer HERMES_CONVEX_READ_KEY; not Convex MCP at runtime.
- ADR-HERMES-003: FR12 push v1 via Convex → HERMES_DISCORD_WEBHOOK_URL; events: run_chain.error (P0), digest HIGH (P1), investigation promotion (P1), trend anomaly (P2 stretch).
- ADR-HERMES-004: FR11 Option A — validate/rotate Anthropic key only; protect-list paths forbidden.
- ADR-HERMES-005: FR13 async dispatch stretch; do not rewire trends-claude.ts in Epic 77 MVP.
- Protect-list (Epic 75+): src/agents/synthesis-adapter-llm.ts, hook-adapter-llm.ts, boss-adapter-llm.ts, run-chain.ts, scripts/run-chain.ts — zero edits unless operator explicitly authorizes FR11-B.
- vitest.config.ts: add tests/hermes/**/*.test.ts include (one-time; story 75-1).
- Repo ownership: Epic 74/75/76 → Omnipotent.md + ~/.hermes/ + vault; Epic 77 → cns-dashboard convex/ + Omnipotent pull client; Epic 78 → ~/.hermes/ config.
- cns-dashboard: never NEXUS_* env vars (ADR-E63-005); secrets ADR-E46-003; ECharts via EChartsPanel only.
- Retain dashboard-sync.ts until D1 pull validated; align DTO with convex/validators.ts.
- API_SERVER_KEY mandatory for Hermes API Server; CORS allowlist; D3 dev-only.
- ADR-HERMES-008: dashboard auth OAuth primary (`hermes dashboard register`); basic-auth fallback only on trusted WSL localhost with governance note — not default (verified Context7 June 2026).
- Webhook push body prefix: [awareness.<eventType>] for v1 filtering.
- Dispatch actions kebab-case: save-watchlist-note, investigate-trend, ask (stretch).
- Cross-repo verify gate on every story completion.
```

### UX Design Requirements (D1 scope only)

```
UX-DR1: Ask-Hermes panel uses existing Nexus cockpit theme (nexus-theme.css): .nx-panel, .nx-panel-title (uppercase mono), --nx-surface-* tokens, --nx-accent-primary for primary CTA — no new base palette.
UX-DR2: Ask-Hermes async UX: submit shows immediate acknowledgment ("Question sent — reply in Discord or Hermes Desktop"); no inline SSE/streaming in production cockpit; loading/error states match existing .nx-panel-status patterns.
UX-DR3: Awareness summary panel(s) on /nexus inherit instrument-panel density: mono meta labels, 12px panel gap, 16px padding — visually sibling to NexusSourceHealthPanel / digest feeds.
UX-DR4: Ask-Hermes form accessibility: labeled textarea + submit button; keyboard submit; focus visible; aria-live region for dispatch result; mobile stacks single-column at MOBILE_BREAKPOINT_PX (768) per existing Nexus layout.
UX-DR5: Awareness freshness indicator reuses stale/sync chrome from existing dashboard panels (last sync timestamp, flat active/stale states) — no new status vocabulary.
```

### FR Coverage Map

```
FR-GATE: Pre-4 (operator) + gates 74-4, 78-1
FR1: Epic 74 — Portal OAuth + provider switch
FR2: Epic 74 — auxiliary.compression → Portal
FR3: Epic 74 — Tool Gateway web search (FR-GATE)
FR4: Epic 74 — gateway + digest regression
FR5: Epic 74 — dashboard systemd + reachability
FR6: Epic 74 — Hermes Desktop WebSocket chat
FR7: Epic 75 — run-chain governance module
FR8: Epic 75 — Hermes run-chain skill
FR9: Deferred (D3 / ADR-HERMES-012)
FR10: Epic 78 — push-to-talk + Portal TTS
FR11: Epic 75 — Anthropic key validate/rotate (Option A)
FR12: Epic 77 — HTTP pull + webhook push + awareness UI
FR13: Epic 77 stretch (77-6) — async ask via hermes-dispatch
FR14: Epic 78 — per-skill model routing
FR15: Epic 76 — session-close memory/Honcho verification
FR16: Deferred — Brain semantic recall stretch
FR17: Epic 76 — orientation artifact regeneration
NFR1: All epics — verify.sh AC on every story
NFR2: All epics — protect-list + untouched subsystems AC
NFR3: Epic 74 story 74-1 — embedder audit before embeddings
NFR4: Epics 74, 77 — secret placement AC
NFR5: Epic 74 story 74-8 — reversibility docs
NFR6: Epic 74 — cost/subscription note in governance docs
NFR7: Process — story sizing discipline
NFR8: Epic 76 story 76-6 — two-bot boundary doc
UX-DR1..5: Epic 77 stories 77-5, 77-6
```

## Epic List

### Epic 74 (A): Hermes on Portal + Desktop

Operator runs Hermes on a single stable Nous Portal subscription with Hermes Desktop chat from Windows — Discord gateway and morning digest unchanged.

**Alias:** Epic A · **FRs:** FR1–FR6, FR-GATE · **NFRs:** NFR3, NFR4, NFR5, NFR6 · **Depends:** Pre-4 for Tool Gateway stories

### Epic 75 (B): Run-Chain Knowledge + Revival

Hermes cold-starts knowing run-chain; operator triggers a chain from Discord/Desktop via skill; Anthropic key validated — zero engine adapter edits.

**Alias:** Epic B · **FRs:** FR7, FR8, FR11 · **Depends:** Epic 74 complete

### Epic 76 (C): Orientation & Governance Cleanup

Orientation artifacts match live sprint reality; governance gaps closed; two-bot vault boundary documented; memory pillars verified active.

**Alias:** Epic C · **FRs:** FR15, FR17 · **NFRs:** NFR8 · **Parallel with:** Epic 75 after Pre-2

### Epic 77 (D1): JARVIS Awareness in Nexus

Hermes reads live Convex intelligence state; high-signal events push to Discord; `/nexus` shows awareness + optional async ask box — production cockpit feel without WSL loopback.

**Alias:** Epic D1 · **FRs:** FR12, FR13 (stretch) · **UX-DRs:** UX-DR1–5 · **Depends:** Epic 74

### Epic 78 (D2): JARVIS Voice + Model Routing

Operator uses push-to-talk and streaming TTS on Hermes Desktop; per-skill cheap-model routing active.

**Alias:** Epic D2 · **FRs:** FR10, FR14 · **Depends:** Epic 74; FR-GATE for TTS

### Deferred (not epics in this breakdown)

- **D3 / FR9:** Embedded inline chat pane (ADR-HERMES-012, dev/tunnel opt-in)
- **FR13 inline:** ADR-HERMES-011 streaming explain/risk
- **FR16:** Brain semantic recall via Portal embeddings

---

## Epic 74: Hermes on Portal + Desktop

Operator runs Hermes on a single stable Nous Portal subscription with Hermes Desktop chat from Windows — Discord gateway and morning digest unchanged.

### Story 74-1: Brain embedder audit before Portal switch

As an **operator**,
I want **the Brain index embedder dependency documented and verified before any Portal /embeddings migration**,
So that **brain:index and brain:query keep working through provider consolidation (NFR3)**.

**Acceptance Criteria:**

**Given** the current Brain embedder configuration in Omnipotent.md
**When** the audit story completes
**Then** a short note in vault governance or `_bmad-output/implementation-artifacts/` records current embedder provider, env vars, and whether Portal `/embeddings` is safe to adopt
**And** `npm run brain:index` and `brain:query` smoke pass on fixture or operator vault sample before Epic 74 Portal switch proceeds
**And** `bash scripts/verify.sh` passes (NFR1).

### Story 74-2: Portal OAuth login and provider switch

As an **operator**,
I want **Hermes authenticated to Nous Portal with anthropic/claude-sonnet-4.6 as default**,
So that **inference runs on one subscription instead of fragile openai-codex (FR1)**.

**Acceptance Criteria:**

**Given** Pre-4 Portal subscription active
**When** `hermes auth add nous --type oauth --manual-paste` and `hermes config set model.provider nous` run on WSL
**Then** `hermes portal info` shows logged in with Nous inference provider
**And** default model is `anthropic/claude-sonnet-4.6`
**And** openai-codex remains documented as last-resort fallback in routing governance (NFR5)
**And** no secrets committed (NFR4).

### Story 74-3: Auxiliary compression on Portal

As an **operator**,
I want **auxiliary.compression routed to Portal Haiku**,
So that **the exhausted OpenRouter dependency is removed (FR2)**.

**Acceptance Criteria:**

**Given** Portal login from 74-2
**When** `hermes config set auxiliary.compression.provider nous` and model `anthropic/claude-haiku-4.5`
**Then** compression tasks use Portal (verify via config dump or smoke chat with long context)
**And** OpenRouter is no longer referenced in active Hermes config for compression
**And** `bash scripts/verify.sh` passes.

### Story 74-4: Tool Gateway web search

As an **operator**,
I want **Hermes web search via Portal Tool Gateway**,
So that **standalone Firecrawl dependency for Hermes search is replaced when tier allows (FR3)**.

**Acceptance Criteria:**

**Given** Pre-4 confirmed Tool Gateway on paid tier (FR-GATE)
**When** `hermes tools` sets Web search → "Nous Subscription"
**Then** `hermes portal tools` shows Web search = Nous Subscription
**And** a smoke `hermes chat` question requiring web search succeeds
**And** story AC documents FR-GATE tier confirmation date
**And** Discord gateway still responds (FR4 spot check).

### Story 74-5: Gateway and morning-digest regression gate

As an **operator**,
I want **explicit regression verification that Portal migration did not break Discord or digest**,
So that **non-negotiable preservation holds (FR4, NFR2)**.

**Acceptance Criteria:**

**Given** Portal provider active from 74-2
**When** regression checklist runs
**Then** Discord `#hermes` receives and replies to a test message
**And** morning-digest cron path is documented as unchanged (gateway guard in `hermes-morning-digest.sh` verified)
**And** NEXUS Discord–Obsidian bridge is untouched (NFR2)
**And** results recorded in operator notes or story completion comment.

### Story 74-6: Hermes dashboard OAuth registration, systemd, and reachability

As an **operator**,
I want **hermes dashboard registered with Nous OAuth, running persistently, and reachable from Windows**,
So that **Hermes Desktop can connect to WSL backend with Portal auth (FR5, ADR-HERMES-008)**.

**Acceptance Criteria:**

**Given** Portal login from 74-2
**When** `hermes dashboard register` runs (verify exact subcommand live via `hermes dashboard --help`)
**Then** `HERMES_DASHBOARD_OAUTH_CLIENT_ID` is written to `~/.hermes/.env` (mode 0600)
**And** systemd user unit `hermes-dashboard.service` runs dashboard on `0.0.0.0:9119` with `--skip-build`
**And** `curl -s http://127.0.0.1:9119/api/status` shows `auth_required: true` with OAuth in `auth_providers`
**And** live curl from Windows host to WSL dashboard URL succeeds (document actual URL if not `localhost:9119`)
**And** service restarts on failure (Restart=on-failure)
**And** gateway process remains independent (`pgrep -f 'hermes gateway'`)
**And** **auth path flag:** primary path = OAuth register (above). **Fallback only:** if register fails after documented retry, operator may use `HERMES_DASHBOARD_BASIC_AUTH_*` on trusted WSL localhost — story completion must record `auth_path: oauth` or `auth_path: basic-auth-fallback` and link to governance note (never silent basic-auth default).

### Story 74-7: Hermes Desktop live chat connection

As an **operator**,
I want **Hermes Desktop on Windows connected with working WebSocket chat**,
So that **I have a local JARVIS conversational surface (FR6, ADR-HERMES-001)**.

**Acceptance Criteria:**

**Given** dashboard reachable from 74-6 with auth gate active
**When** Hermes Desktop connects to WSL backend URL and authenticates via **Nous OAuth** (Portal login — matches 74-6 OAuth register path)
**Then** chat interface shows WebSocket connected (not status-only)
**And** a test message gets a model response via Portal
**And** Discord mobile surface still works independently
**And** **auth path flag:** if 74-6 completed with `auth_path: basic-auth-fallback`, Desktop uses basic-auth credentials instead — AC must match 74-6 recorded path
**And** connection steps documented in governance doc (feeds 74-8).

### Story 74-8: Portal and Desktop governance documentation

As a **maintainer**,
I want **hermes-desktop.md and routing.md updated for Portal + reversibility**,
So that **future sessions and operators know the keystone config (NFR5, NFR6)**.

**Acceptance Criteria:**

**Given** Epic 74 config state from prior stories
**When** governance docs are written (vault via session-close path for AI-Context modules)
**Then** docs cover Portal OAuth (`hermes dashboard register`), Desktop OAuth sign-in, model aliases, openai-codex fallback procedure, Desktop URL, basic-auth fallback section (trusted localhost only), recorded `auth_path` from 74-6, and subscription cost note (one Portal vs prior providers)
**And** routing alias table reconciled with live `~/.hermes/config.yaml`
**And** `bash scripts/verify.sh` passes.

---

## Epic 75: Run-Chain Knowledge + Revival

Hermes cold-starts knowing run-chain; operator triggers a chain from Discord/Desktop via skill; Anthropic key validated — zero engine adapter edits.

### Story 75-1: Hermes test domain and vitest include

As a **developer**,
I want **`tests/hermes/` registered in vitest.config.ts**,
So that **Hermes integration tests run in verify.sh (architecture test convention)**.

**Acceptance Criteria:**

**Given** `vitest.config.ts` current include globs
**When** `tests/hermes/**/*.test.ts` is added to include
**Then** a placeholder or real test under `tests/hermes/` is discovered by `npm run test:vitest`
**And** `bash scripts/verify.sh` passes (NFR1)
**And** no tests added at repo root `tests/*.test.ts` (anti-pattern per ADR).

### Story 75-2: Run-chain governance module and project folder

As an **operator**,
I want **run-chain documented in AI-Context/modules/run-chain.md and a vault project folder**,
So that **Hermes cold-starts with run-chain context without engine code changes (FR7)**.

**Acceptance Criteria:**

**Given** protect-list paths remain untouched (NFR2)
**When** governance module and `AI-Context/projects/run-chain/` (or equivalent PARA path) are created via session-close WriteGate
**Then** module describes stages (Research/Synthesis/Hook/Boss), trigger paths, FR11 Option A credential posture, and forbidden adapter edits
**And** Hermes MEMORY or skill index references the module
**And** zero edits to `src/agents/*-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`.

### Story 75-3: Hermes run-chain trigger skill

As an **operator**,
I want **a Hermes skill that runs run-chain via terminal() and reports to Discord/Desktop**,
So that **I can revive the chain without new adapter code (FR8)**.

**Acceptance Criteria:**

**Given** governance module from 75-2 and Epic 74 Portal stable
**When** skill at `~/.hermes/skills/cns/run-chain/SKILL.md` is installed and mirrored per verify parity gate
**Then** invoking the skill runs `scripts/run-chain.ts` (or documented entry) via `terminal()`
**And** success/failure summary posts to Discord thread or Desktop session
**And** skill declares required env (`.env.live-chain`) without exposing secrets
**And** protect-list files unmodified (NFR2).

### Story 75-4: Anthropic key validate script and FR11-A smoke

As an **operator**,
I want **scripts/validate-anthropic-key.ts with tests and a documented key rotate procedure**,
So that **Synthesis/Hook/Boss can run under Option A without adapter changes (FR11)**.

**Acceptance Criteria:**

**Given** `.env.live-chain` holds `ANTHROPIC_API_KEY` (gitignored)
**When** `scripts/validate-anthropic-key.ts` runs
**Then** it smoke-calls Anthropic Messages API (minimal prompt) and exits 0 on valid key
**And** `tests/hermes/validate-anthropic-key.test.ts` mocks HTTP and passes in CI
**And** protect-list adapter files have zero diffs
**And** operator doc states rotate procedure if key was exposed in audit
**And** `bash scripts/verify.sh` passes.

### Story 75-5: Run-chain end-to-end revival verification

As an **operator**,
I want **one documented E2E run-chain execution via Hermes skill with evidence**,
So that **run-chain revival is proven before JARVIS awareness work (FR8, G2)**.

**Acceptance Criteria:**

**Given** valid Anthropic key from 75-4 and skill from 75-3
**When** operator triggers run-chain via Discord or Desktop skill on a test brief
**Then** chain completes or fails with actionable stage error (not 401)
**And** synthesis output path documented
**And** no edits to hook/boss/weapons engine logic (NFR2)
**And** evidence captured in story completion notes (date, brief slug, outcome).

---

## Epic 76: Orientation & Governance Cleanup

Orientation artifacts match live sprint reality; governance gaps closed; two-bot vault boundary documented; memory pillars verified active.

### Story 76-1: Session-close orientation artifact refresh

As an **operator**,
I want **session-close to regenerate accurate AGENTS §8, MEMORY files, and AUTO blocks**,
So that **cold-start context matches Epic 72–73 reality (FR17, supports Pre-2)**.

**Acceptance Criteria:**

**Given** Pre-1 fixture fix applied (recommended)
**When** `/session-close` runs successfully
**Then** both MEMORY.md copies list correct epic status (72 done, 73 in-progress, 74+ backlog)
**And** `CNS-Daily-Rhythm.md` AUTO blocks reflect live MCP/sprint state
**And** AGENTS §8 project status matches sprint-status.yaml
**And** no `failure_class: tests` unless tests genuinely failing.

### Story 76-2: Both project-context.md files synced

As a **developer**,
I want **Omnipotent.md and cns-dashboard project-context.md updated to Hermes consolidation phase**,
So that **AI agents see accurate stack, epic status, and cross-repo rules (FR17)**.

**Acceptance Criteria:**

**Given** epics 74–78 defined in sprint-status
**When** both project-context files are updated
**Then** phase status, Layer-3 ADR references, and Hermes consolidation pointers are accurate
**And** cns-dashboard file reflects Epic 63/73 done or in-progress correctly
**And** Epic 46/63 env rules (no NEXUS_*) preserved
**And** `bash scripts/verify.sh` passes both repos where applicable.

### Story 76-3: Fast-scan index and inbox triage plan

As an **operator**,
I want **vault-fast-scan-index refreshed and a triage plan for the 103-item inbox backlog**,
So that **orientation layer is actionable not stale (FR17)**.

**Acceptance Criteria:**

**Given** session-close from 76-1
**When** fast-scan-index is regenerated or manually corrected
**Then** index reflects current PARA hotspots and Hermes consolidation priority
**And** inbox triage doc categorizes backlog into: act-now, defer, archive (no bulk destructive moves)
**And** vault WriteGate respected for any AI-Context mutations.

### Story 76-4: Missing governance files — mobile-posture and personas

As a **maintainer**,
I want **mobile-posture.md and personas/ directory created**,
So that **governance gaps from FR17 are closed**.

**Acceptance Criteria:**

**Given** constitution module structure
**When** `mobile-posture.md` and `personas/` stubs or full content are added via session-close
**Then** files link from AGENTS or modules index
**And** content describes operator mobile surfaces (Discord, Obsidian mobile) without contradicting ADR-HERMES-001
**And** both AGENTS.md copies stay in sync per constitution rule.

### Story 76-5: Two-bot vault boundary documentation

As an **operator**,
I want **documented non-colliding boundary between Hermes and NEXUS bridge on the vault**,
So that **consolidation work never breaks the bridge bot (NFR8, NFR2)**.

**Acceptance Criteria:**

**Given** NEXUS bridge remains untouched
**When** boundary doc is published (vault module or operator guide section)
**Then** doc lists Hermes write paths vs NEXUS paths, env var namespaces (HERMES_/CNS_ vs NEXUS_*), and escalation if collision suspected
**And** cns-dashboard ADR-E63-005 cross-referenced
**And** no NEXUS bridge code or config modified.

### Story 76-6: Memory pillars and Honcho verification

As an **operator**,
I want **confirmation that Hermes memory, skill-learning, and Honcho are active and fed by session-close**,
So that **JARVIS gets smarter over time (FR15)**.

**Acceptance Criteria:**

**Given** Hermes on Portal from Epic 74
**When** verification checklist runs
**Then** 3-layer memory (SQLite FTS + summarization), skill-learning loop, and Honcho dialectic are documented as active or explicitly gated with remediation steps
**And** session-close writes feed memory (spot-check MEMORY diff after close)
**And** no new memory infrastructure built — native Hermes capabilities used.

---

## Epic 77: JARVIS Awareness in Nexus

Hermes reads live Convex intelligence state; high-signal events push to Discord; `/nexus` shows awareness + optional async ask box.

### Story 77-1: Convex HermesAwarenessSnapshot HTTP endpoint

As **Hermes (WSL agent)**,
I want **a least-privilege GET /hermes/awareness returning a fixed DTO**,
So that **I can read live cockpit state without Convex MCP or mutations (FR12, ADR-HERMES-002)**.

**Acceptance Criteria:**

**Given** `HERMES_CONVEX_READ_KEY` in Convex env
**When** `GET /hermes/awareness` is called with valid bearer
**Then** response JSON matches HermesAwarenessSnapshot sections: sync, vault, chain, mcps, digest (top 5), entities (top 5 tracked + 3 emerging), investigations summary, trends (top 3 anomalies + 3 scores)
**And** unauthorized requests return 401
**And** no full noteIndex or raw agentLogEntries exposed
**And** validators extended in `convex/validators.ts`; `bash scripts/verify.sh` passes cns-dashboard.

### Story 77-2: Hermes awareness pull client and cron cache

As **Hermes (WSL agent)**,
I want **scripts/hermes-awareness-pull.ts on a 3-min cron writing ~/.hermes/memories/awareness-snapshot.json**,
So that **awareness is cached locally without per-turn Convex calls (FR12 pull)**.

**Acceptance Criteria:**

**Given** 77-1 endpoint deployed
**When** pull script runs manually and via Hermes cron
**Then** snapshot file updates with camelCase JSON mirroring DTO (sync comment with dashboard-sync pattern)
**And** `tests/hermes/hermes-awareness-pull.test.ts` covers auth header and DTO parse (mock fetch)
**And** `bash scripts/verify.sh` passes Omnipotent.md
**And** existing `dashboard-sync.ts` still runs until operator validates pull in 77-7.

### Story 77-3: Convex webhook push for high-signal events

As an **operator**,
I want **P0/P1 cockpit events pushed to Discord via webhook**,
So that **Hermes learns proactively without Vercel→WSL tunnel (FR12 push, ADR-HERMES-003)**.

**Acceptance Criteria:**

**Given** `HERMES_DISCORD_WEBHOOK_URL` in Convex env
**When** run-chain enters `error`, digest emits HIGH-score signal, or investigation board promotion occurs
**Then** `convex/hermesPush.ts` internal action POSTs structured message with `[awareness.<eventType>]` prefix
**And** P0 run_chain.error verified in test or manual smoke
**And** no call to 127.0.0.1:9119 from Convex cloud
**And** trend anomaly spike (P2) documented as stretch sub-task or follow-up.

### Story 77-4: Awareness-sync Hermes skill

As an **operator**,
I want **a Hermes skill to on-demand refresh awareness snapshot and summarize for chat**,
So that **I can ask Hermes about live state in Desktop/Discord (FR12)**.

**Acceptance Criteria:**

**Given** 77-2 pull client working
**When** `~/.hermes/skills/cns/awareness-sync/SKILL.md` is invoked
**Then** skill runs pull script and reads cached snapshot into session context
**And** skill documents example prompts ("What's the run-chain status?")
**And** skill parity passes verify Hermes skill gate
**And** protect-list paths untouched.

### Story 77-5: Nexus awareness panels UI

As an **operator viewing /nexus**,
I want **live awareness summary panels matching Nexus cockpit visual language**,
So that **the cockpit feels JARVIS-aware without embedded WSL chat (FR12, UX-DR1, UX-DR3, UX-DR5)**.

**Acceptance Criteria:**

**Given** Convex tables already power home panels
**When** awareness panel(s) render on `/nexus` (extend existing panels or add `.nx-panel` module)
**Then** styling uses `nexus-theme.css` tokens only (.nx-panel-title, --nx-surface-*, --nx-accent-primary)
**And** freshness/stale chrome matches NexusSourceHealthPanel patterns (UX-DR5)
**And** data sourced from Convex reactive queries (no local polling loops — cns-dashboard project-context rule)
**And** mobile stacks at 768px breakpoint
**And** `bash scripts/verify.sh` passes cns-dashboard.

### Story 77-6: Async ask-Hermes box (stretch FR13)

As an **operator on /nexus**,
I want **to submit a question that dispatches to Hermes via webhook and replies in Discord/Desktop**,
So that **I can ask Hermes from the cockpit without Vercel reaching WSL (FR13 Option ii, UX-DR2, UX-DR4)**.

**Acceptance Criteria:**

**Given** ADR-HERMES-005 async dispatch pattern
**When** operator submits ask form on `/nexus`
**Then** `POST /api/trends/hermes-dispatch` accepts new `ask` action with context payload
**And** UI shows immediate ack ("Question sent — reply in Discord or Hermes Desktop") without SSE
**And** labeled textarea, submit, keyboard enter, focus visible, aria-live for result (UX-DR4)
**And** secrets remain server-side only (NFR4, ADR-E46-003)
**And** story tagged `stretch-fr13` in sprint tracker
**And** `trends-claude.ts` inline streaming NOT modified.

### Story 77-7: Dashboard-sync retention decision

As a **maintainer**,
I want **a documented decision on retaining or deprecating dashboard-sync.ts after pull validation**,
So that **we don't run duplicate seams indefinitely (architecture process pattern)**.

**Acceptance Criteria:**

**Given** 77-1 and 77-2 validated in production for ≥24h
**When** retention review completes
**Then** decision recorded: keep both, deprecate sync, or reduce sync frequency — with rationale
**And** if deprecating, follow-up story filed in deferred-work.md (not blocking Epic 77 done)
**And** DTO field names remain aligned between sync and HTTP pull.

---

## Epic 78: JARVIS Voice + Model Routing

Operator uses push-to-talk and streaming TTS on Hermes Desktop; per-skill cheap-model routing active.

### Story 78-1: Portal TTS and push-to-talk on Desktop

As an **operator**,
I want **push-to-talk input and streaming TTS output on Hermes Desktop via Portal**,
So that **I can talk to JARVIS locally (FR10, ADR-HERMES-001, FR-GATE)**.

**Acceptance Criteria:**

**Given** Pre-4 Tool Gateway tier confirmed (FR-GATE) and Epic 74 Desktop connected
**When** operator uses Ctrl+B push-to-talk on Hermes Desktop
**Then** Whisper transcription → Portal inference → streaming TTS plays sentence-by-sentence
**And** v1 expectation documented: not duplex always-on (upstream #35750)
**And** Discord voice explicitly out of scope for v1 unless already native
**And** failure modes documented if Tool Gateway unavailable.

### Story 78-2: Per-skill Hermes model routing activation

As an **operator**,
I want **cheap models routed for cheap Hermes skills**,
So that **subscription cost stays low after Portal migration (FR14)**.

**Acceptance Criteria:**

**Given** Layer-3 routing engine exists in Omnipotent.md and Hermes native API from Epic 74
**When** per-skill routing config is activated in `~/.hermes/config.yaml` (or routing policy file)
**Then** at least two skills demonstrate different model tiers (e.g., triage vs synthesis skill) with documented aliases
**And** routing.md governance updated with skill→model map
**And** no protect-list adapter changes
**And** `bash scripts/verify.sh` passes.

### Story 78-3: Voice and routing operator guide section

As an **operator**,
I want **CNS-Operator-Guide section on JARVIS voice surfaces and routing**,
So that **expectations are clear across Desktop, Discord, and cockpit (FR10, NFR7)**.

**Acceptance Criteria:**

**Given** 78-1 and 78-2 complete
**When** operator guide is updated (vault via session-close)
**Then** section covers: Desktop = chat+voice; Discord = chat; /nexus = awareness+ask; no production embedded pane
**And** links to hermes-desktop.md and routing.md from Epic 74
**And** FR-GATE and reversibility notes included.
