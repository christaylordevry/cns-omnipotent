# PRD — Hermes Consolidation & JARVIS Presence

**Project:** CNS (Omnipotent.md + cns-dashboard) · **Track:** BMad Method (full) · **Status:** Draft for architecture
**Date:** 2026-06-24 · **Author:** drafted with operator (Chris Taylor)
**Source inputs:** `CNSHermes New Big Plan/` (8 research docs, verified against live Hermes/Nous docs) + cross-repo scan (Omnipotent.md `src/`, cns-dashboard `src/`+`convex/`, live vault) + `cursor_feature_overview_and_use_cases.md` (full system feature map)

> **Research note:** The source research package says "do not re-research." That instruction was overridden by the operator. All external claims in this PRD were re-verified against the live Hermes Agent / Nous Portal documentation (June 2026). Corrections are folded in and flagged.

---

## 1. North Star

Make **Hermes the single, always-on intelligence layer ("JARVIS")** that lives inside the Nexus cockpit, knows everything happening across the CNS ecosystem, and gets measurably smarter over time — while running on **one cost-effective subscription provider (Nous Portal)**.

The operator should be able to **talk to Hermes and have it talk back**, ask it anything about the vault / digest / trends / entity intelligence / run-chain, and have it **act with full access** — without re-explaining context, and without breaking anything already built.

**Non-negotiable preservation:** the Discord gateway, the morning-digest cron, the run-chain hook/boss/weapons engine, the **NEXUS Discord–Obsidian bridge bot**, and the Brain index must all keep working untouched throughout.

---

## 2. Background — verified current state

### Providers (all degraded or fragile)
- Hermes primary: `openai-codex / gpt-5.4-mini` — **functional but fragile** (undocumented Cloudflare header spoofing; model string drifted twice in 6 weeks; breaks off residential IP / on servers).
- `openrouter` — **402 exhausted** (was Hermes aux + dashboard investigation provider, Epic 66-4).
- `ANTHROPIC_API_KEY` — **401 dead** → run-chain Synthesis/Hook/Boss all failing; last durable synthesis 2026-05-24. Dashboard `explain`/`summarise-risk` (server-side Claude) also affected.
- `nous` (Portal) — **not logged in** (target).

### Nous Portal — verified real
- Flat-fee OAuth subscription; refresh token in `~/.hermes/auth.json`; short-lived `inference:invoke` JWTs; 300+ models.
- Model slug confirmed: **`anthropic/claude-sonnet-4.6`** (and `anthropic/claude-opus-4.6`).
- **Tool Gateway** (web search via Firecrawl, image gen, **OpenAI TTS**, browser) = **paid tier only** (free tier = inference only).
- **Subscription proxy:** `hermes proxy start` → `127.0.0.1:8645/v1`, **OpenAI chat-completions format only** (no Anthropic Messages endpoint), allowed paths `/chat/completions`, `/completions`, `/embeddings`, `/models`, accepts any bearer.

### Hermes as a JARVIS substrate — verified native capability
- **Voice:** push-to-talk (Ctrl+B), Whisper transcription, **streaming TTS** (speaks sentence-by-sentence). TTS via Portal Tool Gateway, no separate key. *(True always-on duplex voice is feature request [#35750](https://github.com/NousResearch/hermes-agent/issues/35750) — not yet shipped.)*
- **Grows smarter:** 5 pillars (memory, skills, soul, crons, self-improvement); 3-layer memory (SQLite FTS + LLM summarization); closed skill-learning loop; **Honcho dialectic user-modeling**. Native — used, not built.
- **Embeddable:** **API Server** (`/v1/chat/completions`, `/v1/responses`, `/v1/runs` + SSE), TUI Gateway WS, ACP. `X-Hermes-Session-Id` / `X-Hermes-Session-Key` give a persistent per-user agent that keeps **full memory + tools + skills**. Frontend system message layers on top of core prompt.
- **Gap:** no dedicated external-event-injection endpoint — "awareness of dashboard events" must be designed (read Convex / push as messages / cron poll / expand webhook).

### Dashboard (Nexus) — integration seams already exist
- `hermes-dispatch` endpoint dispatches to Hermes via `HERMES_DISCORD_WEBHOOK_URL` — only `save-watchlist-note` + `investigate-trend` (the narrow ceiling today).
- Convex observability tables already defined: `mcpStatus`, `agentLogEntries`, `runChainStatus`, `vaultHealth`, `noteIndex`, plus digest/entity/investigation tables.
- `scripts/dashboard-sync.ts` already pushes a CNS snapshot **every 3 min via Hermes cron** → Home panels (Vault Health, MCP Status, Hermes Feed, Run Chain, Vault Search).
- **So "Hermes → cockpit state" exists as a one-way 3-min snapshot.** JARVIS = upgrade that seam to live + bidirectional + conversational.

### Orientation layer — systemically stale
Both `MEMORY.md` files, `CNS-Daily-Rhythm.md` AUTO blocks, AGENTS §8, `project-context.md` (both repos), and `vault-fast-scan-index.md` are 1–2 epic cycles behind reality (Epic 72 done, 73 in-progress).

### Keystone insight
Provider consolidation onto Portal simultaneously unblocks four parked items: **run-chain revival**, **per-skill Hermes model routing** (Layer-3 engine built but blocked on a Hermes-native API), **Brain production embeddings**, and the **JARVIS voice/inference layer** — at lower total cost. One move, four unlocks. This is why it sequences first.

---

## 3. Goals & success criteria

| # | Goal | Success measure |
|---|------|-----------------|
| G1 | Stable, cost-effective provider | `hermes portal info` logged in; one subscription replaces openai-codex + OpenRouter + dead Anthropic + standalone TTS |
| G2 | Nothing breaks | Discord gateway, digest cron, run-chain engine, NEXUS bridge, Brain index all verified working post-migration |
| G3 | Hermes is present across the ecosystem (JARVIS) | Conversational + voice on Hermes Desktop / Discord (local→WSL); `/nexus` surfaces live awareness (FR12) + an async "ask Hermes" box; inline embedded pane is D3 / opt-in only. *(Reframed by ADR-HERMES-001 topology (a) — Vercel cockpit cannot reach WSL-local Hermes.)* |
| G4 | Hermes knows everything | Hermes can answer questions about live vault/digest/trends/entities/run-chain state |
| G5 | Hermes gets smarter | Honcho user-modeling + skill-learning loop active; session-close feeds memory |
| G6 | Talk to it / it talks back | Push-to-talk voice in + streaming TTS out working via Portal |
| G7 | Full access | Hermes read/write across vault + Convex with governance preserved |

---

## 4. Scope

### In scope
Portal migration (Hermes + dashboard server-side AI); Hermes Desktop install + WSL backend; run-chain revival + Hermes-triggerable skill + governance docs; JARVIS cockpit presence (embedded chat/voice + bidirectional Convex awareness + per-skill routing); orientation/governance cleanup; deferred-decision stub for run-chain credential path.

### Out of scope
- Modifying hook/boss/weapons **engine logic** (additive-only if FR11 approved).
- Modifying the **NEXUS Discord–Obsidian bridge** (operator: works perfectly, leave it).
- Convex schema redesign, dashboard visual redesign, Nexus dashboard UI rework beyond the JARVIS pane.
- Cancelling standalone subscriptions — *evaluated only*, gated on verified Tool-Gateway tier.
- Epic 73 completion (73-7/73-8) — separate in-flight track.
- True always-on duplex voice (upstream feature not yet shipped) — push-to-talk is the v1 target.

---

## 5. Functional Requirements

### Provider & foundation
- **FR1** Hermes authenticates to Portal via OAuth; provider→`nous`, default model→`anthropic/claude-sonnet-4.6`; openai-codex retained as last-resort fallback.
- **FR2** `auxiliary.compression` → Portal (`anthropic/claude-haiku-4.5`); removes last OpenRouter dependency.
- **FR3** Hermes web search → Portal Tool Gateway ("Nous Subscription") — gated on FR-GATE (paid tier confirmed).
- **FR4** Discord gateway + morning-digest cron remain operational throughout (regression-tested, not assumed).
- **FR-GATE** Confirm the Portal plan tier includes Tool Gateway **before** any Firecrawl-cancellation or TTS-dependent work.

### Desktop surface
- **FR5** A `hermes dashboard` service runs persistently (systemd user unit + watchdog), authenticated via **Nous OAuth** (`hermes dashboard register` after Portal login — verify exact command live; writes `HERMES_DASHBOARD_OAUTH_CLIENT_ID` to `~/.hermes/.env`), reachable from Windows; Hermes Desktop signs in via the same OAuth flow. **Fallback only:** `HERMES_DASHBOARD_BASIC_AUTH_*` on trusted WSL localhost if register/OAuth Desktop login fails — must be documented in governance, not the default. **Live `curl` reachability test precedes any assumption about WSL mirrored-networking localhost.**
- **FR6** Hermes Desktop (Windows) connects to the WSL backend; live chat works (WebSocket, not just status).

### Run-chain
- **FR7** Run-chain documented as a governance module (`AI-Context/modules/run-chain.md`) + vault project folder, so Hermes cold-starts knowing it (zero engine code).
- **FR8** A Hermes skill triggers run-chain via `terminal()` and reports results to Discord/Desktop (zero adapter code).
- **FR11 (DECIDED — Option A, operator-approved 2026-06-24)** Run-chain credential path: **keep one `ANTHROPIC_API_KEY`** for Synthesis/Hook/Boss; **zero edits to the protected engine adapters**. Epic 75 scope = validate/rotate the key + governance docs only (story 75-4). Portal is OpenAI-format only, so there is no zero-code Portal path for Boss's `tool_choice`; Option B (additive, non-destructive provider branch) remains a future option if the residual Anthropic bill is ever to be eliminated. *(Originally a deferred stub; operator confirmed Option A at the architecture Step-4 gate.)*

### JARVIS presence (Epic D)
- **FR9** *(Scope locked by ADR-HERMES-001: the inline embedded pane is **Epic D3 — dev-local/tunnel opt-in only, NOT production**. Production "Hermes in the cockpit" = FR12 awareness + the async ask box. The embed pattern below applies to D3.)* Embed a live Hermes agent pane in the Nexus `/nexus` cockpit via Hermes API Server, using `X-Hermes-Session-Id` (session continuity) + `X-Hermes-Session-Key` (long-term memory scoping); SSE streaming; approval flow handled. **Researched (2026-06-24):** `API_SERVER_KEY` bearer is mandatory (loopback included — closes unauthenticated-RCE issue #6439); CORS off by default (`API_SERVER_CORS_ORIGINS` allowlist). Browser must never hold the key — proxy through a SvelteKit `$lib/server` route (the existing `api/trends/*` Claude-proxy pattern, ADR-E46-003). **HOSTING CONSTRAINT:** the cockpit is deployed on **Vercel (cloud)** while Hermes runs on **WSL (home machine)** — a Vercel serverless function cannot reach `127.0.0.1:9119`. The embedded-pane topology must be resolved in architecture (see §10.8).
- **FR10** Voice: push-to-talk in + streaming TTS out, available from the cockpit and/or Desktop, via Portal.
- **FR12** Bidirectional dashboard awareness — Hermes can read live Convex state (digest, entities, trends, investigations, run-chain status) and the dashboard can surface notable events into Hermes's session. **Mechanism researched (2026-06-24) — two proven, complementary paths:** (a) **Pull** via the official **Convex MCP server** (read tables/schemas, sandboxed read-only queries, `execute_function`) mounted into Hermes; (b) **Push** via **Convex HTTP actions** (`convex/http.ts`) + **scheduled functions** that POST high-signal events to Hermes's API Server as messages, atomic with the triggering mutation. Recommended hybrid: pull for on-demand state, push for proactive notify. Architecture to finalize which events warrant push and the exact tool surface.
- **FR13** Dashboard server-side AI (`explain`, `summarise-risk`, investigation) routes through Portal (proxy or API) so those features work again.
- **FR14** Per-skill Hermes model routing activated (cheap models for cheap tasks) now that a Hermes-native API exists.

### Knowledge & memory
- **FR15** Hermes's native memory + skill-learning + Honcho user-modeling are active and fed by session-close.
- **FR16** (Stretch) Hermes can query the Brain semantic index for deep recall (depends on Brain production embedder — Portal `/embeddings`).

### Governance
- **FR17** Orientation artifacts regenerate accurately: both `MEMORY.md`, `CNS-Daily-Rhythm.md` AUTO blocks, AGENTS §8, `project-context.md` (both repos), fast-scan-index; create missing `mobile-posture.md` + `personas/`; triage the 103-item inbox backlog.

---

## 6. Non-Functional Requirements
- **NFR1 (Verify gate)** `bash scripts/verify.sh` exits 0 before every commit (CNS + sibling cns-dashboard).
- **NFR2 (Non-destructive)** No deletion/modification of run-chain adapter logic or the NEXUS bridge in this initiative; additive/env-gated only.
- **NFR3 (Brain integrity)** `brain:index` / `brain:query` keep working post-switch; embedder dependency identified before any provider change.
- **NFR4 (Secrets)** No secrets committed (`.env.live-chain` stays gitignored); rotate any key exposed during the audit; dashboard secrets stay in `$lib/server`/`+server.ts` (ADR-E46-003) and as Convex/Vercel env vars.
- **NFR5 (Reversibility)** Every provider change config-reversible; openai-codex stays a working fallback until Portal proven stable.
- **NFR6 (Cost)** Net subscription spend should fall (one Portal bill replaces ≥3); confirm before cancelling anything.
- **NFR7 (Context discipline)** Fresh chat per BMAD workflow; stories sized under ~50% context.
- **NFR8 (Two-bot boundary)** Hermes and the NEXUS bridge have a documented non-colliding boundary on the shared vault.

---

## 7. Epics (overview — final story breakdown produced by `bmad-create-epics-and-stories` post-architecture)

- **Epic A — Hermes on Portal + Desktop** *(keystone; ops/CLI, low code risk, gateway-safe)* — FR1–FR6, FR-GATE, NFR3. Portal login/switch · aux→Portal · Tool Gateway · routing-alias reconcile · dashboard service (OAuth + live reachability test) · Desktop connect · `hermes-desktop.md` + `routing.md` governance.
- **Epic B — Run-chain knowledge + revival** — FR7, FR8, FR11 (Option A, decided). B1 doc module + project folder · B2 Hermes skill · validate/rotate Anthropic key (no engine edits).
- **Epic C — Orientation & governance cleanup** — FR17, NFR8. Pre-work session-close + systemic doc-drift fix + missing governance files + inbox triage.
- **Epic D — Hermes JARVIS presence in the Nexus ecosystem** *(marquee; depends on A; split per ADR-HERMES-001)* — **D1 awareness** (FR12 HTTP pull + webhook push + async ask box), **D2 voice** (FR10 Desktop push-to-talk + TTS, FR-GATE), **D3 embedded inline pane** (FR9 — dev-local/tunnel opt-in, deferred). Plus FR13 (async, lowest priority), FR14 per-skill routing, FR15/FR16 memory/Brain. *Production "Hermes in the cockpit" is awareness + ask box, not an iframe.*
- **Pre-work (Epic C kickoff, not stories):** Pre-1 fixture fix · Pre-2 `/session-close` · Pre-3 static-body fix · Pre-4 Portal subscribe + tier confirm.

---

## 8. Risks

| Risk | Sev | Mitigation |
|---|---|---|
| WSL `localhost:9119` not reachable from Windows | High | Live `curl` test first (FR5); Tailscale fallback documented |
| Tool Gateway not in chosen plan tier | High | FR-GATE before Firecrawl-cancel / TTS work |
| Brain embedder breaks on provider switch | Med | NFR3 — identify dependency in architecture before switching |
| FR12 event-awareness larger than expected | Med | Mechanism deferred to architecture; start with read-only Convex + cron |
| Boss `tool_choice` regression (if FR11 approved) | Med | Out of scope now; additive + score-comparison AC when approved |
| Stale orientation corrupts cold-start | Med | Epic C / pre-work session-close before build |
| Real-time duplex voice expectation gap | Low | v1 = push-to-talk; set expectation explicitly |
| Two bots collide on vault | Low | NFR8 documented boundary; NEXUS untouched |
| **Vercel cockpit can't reach WSL-local Hermes** | **High** | §10.8 — JARVIS chat/voice on Hermes Desktop (local); cockpit gets data-awareness (FR12), not an embedded pane reaching back to the laptop |
| API Server exposed unauthenticated (RCE #6439) | High | `API_SERVER_KEY` mandatory; never bind non-loopback without auth + narrow CORS; browser proxies through server route |

---

## 9. Dependencies & sequencing

```
Pre-work (Epic C kickoff): fixture fix -> /session-close -> static-body fix
        -> Pre-4 Portal subscribe + confirm Tool Gateway tier
                -> Epic A (Hermes on Portal + Desktop)   [KEYSTONE]
                        ├── Epic B (run-chain) — sequential after A
                        ├── Epic C remainder — parallel
                        └── Epic D (JARVIS cockpit) — after A
                                -> FR11 credential decision (operator)
                                -> optional Epic B credential stories
```

---

## 10. Open questions for architecture (`bmad-create-architecture`)

*Items 1–2 were researched 2026-06-24 and now carry recommended answers; architecture confirms and details them.*

1. **FR12 event-awareness model — ANSWERED (confirm/detail).** Hybrid: Convex MCP server (pull, read-only) + Convex HTTP actions/scheduled functions (push high-signal events to Hermes API Server). Architecture decides which events warrant push and validates the Convex MCP is appropriate for runtime (vs dev-tooling) use.
2. **FR9 embed approach — ANSWERED (confirm/detail).** Proxy via SvelteKit `$lib/server` route (existing `api/trends/*` pattern); browser never holds `API_SERVER_KEY`. Open sub-question is §10.8 (hosting topology).
3. **FR13 dashboard AI** — proxy (`:8645/v1`) vs Hermes API Server for `explain`/`summarise-risk`/investigation.
4. **NFR3 Brain embedder** — current embedder dependency and the Portal `/embeddings` migration path.
5. **FR10 voice surface** — push-to-talk in cockpit vs Desktop vs Discord voice; STT source (local Whisper vs Portal).
6. **FR11** — present Option A vs B with the engine-protection tradeoff for operator sign-off.
7. **Epic split** — whether D is one epic or splits (presence vs awareness vs voice).
8. **JARVIS hosting topology (NEW — load-bearing).** The cockpit is on Vercel (cloud); Hermes is on WSL (home). Vercel cannot reach `127.0.0.1:9119`. Options: (a) **Hermes's own dashboard/Desktop is the JARVIS chat+voice surface** (local, reaches WSL natively, voice built-in) and the Nexus cockpit gets **data awareness only** (FR12) rather than an embedded chat pane; (b) run the **cockpit locally** (`localhost:5173`) so its server route can reach WSL Hermes; (c) **expose Hermes via Tailscale/tunnel** so the deployed cockpit can reach it (public-exposure security cost). Recommendation leans (a) — least new surface, best voice, no public exposure — with FR12 giving the cockpit its "live agent" feel via data, not an iframe. Operator + architecture decide.

---

## 11. Next BMAD step
Fresh Cursor chat → **`bmad-create-architecture`** (Architect agent). Inputs: this PRD + the 8 research docs + the feature map. The architecture must resolve §10. Then `bmad-create-epics-and-stories` → `bmad-check-implementation-readiness` → `bmad-sprint-planning` → build cycle.
