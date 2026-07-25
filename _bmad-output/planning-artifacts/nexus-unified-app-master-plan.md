# Nexus — Master Integration Plan: "One Wired App"

**Status:** Gate 0 CLOSED · Architecture approved 2026-07-25 · v2
**Owner:** operator (Christ) · **Architect/review:** Winston / Claude · **Execution:** Cursor (BMAD stories)
**Architecture SSOT:** [`architecture-nexus-unified-app.md`](./architecture-nexus-unified-app.md)  
**Brownfield ground truth:** [`brownfield/00-index.md`](./brownfield/00-index.md)  
**Companion artifacts:** [System Wiring Map](https://claude.ai/code/artifact/56556906-9d82-46c3-8e6e-b84b82566653) · [Capability-Parity Scan](https://claude.ai/code/artifact/9dad5ea5-d21d-43ce-a45c-659a9a80968c)

> This is the plan-before-code the operator asked for. We do **not** fire off code until the
> research + design gates are cleared. It is deliberately verbose: it is the single source of truth
> for the next few days of work. Read Part 0 and Part 5 first; the rest is reference.
>
> **2026-07-25:** Gate 0 closed. Topology = A (multi-package Turbo/pnpm workspace) via C-bridge;
> shell/IA locked; Pluto pull-ins sequenced; Convex KEEP; data-model DM-1+2 → DM-3 → DM-4 gated.
> Next executable step = **M0** (diagnose live P0) — only on explicit operator go. **Phase B
> design gate is preserved** (hand-built visual target per destination before any build).

---

## Part 0 — Charter

**The vision (North Star).** Every surface and system already built — the cockpit, trends, entities,
investigations, the digest pipeline, the vault, Hermes, NotebookLM, voice — becomes **one coherent
web app**: everything wired, everything connected, everything comprehensible, visually consistent in
the INSTRUMENT language, and — above all — it **flows**. The operator is visual and artistic; a
surface that works but is ugly or disjointed is **not done**. The goal is a product he can drop into
a workflow state and move through without friction or confusion.

**Where we are (the honest reality).** The backend is deep and mature; the frontend surfaces maybe a
third of it and is stitched together loosely. Of 8 nav surfaces, 3 are live, 5 are dead buttons; a
whole `/trends` surface is built but hidden; voice is broken; the design language reached only the
cockpit. The gap is **connective tissue and coherence**, not capability. That is good news: much of
the wiring is short.

**Operating principles (binding for this whole effort).**
1. **Research before code.** Every wave is preceded by a research package and a design target. No
   surface gets built from a blank guess.
2. **One design language.** INSTRUMENT (near-black `#111`, cyan `#0090C0`, flat instrument chrome,
   `data-theme` dark/light) across *every* surface. No second visual system.
3. **Honesty primitives are sacred.** No fabricated data affordances. Empty/quiet states are honest
   ("no substrate → no chrome"). Signal-strength ≠ confidence. This survived the redesign; it stays.
4. **One shell, one flow.** A single app shell, one nav, consistent header/drawer/motion — so it
   reads as one product, not a folder of pages.
5. **Methodical + gated.** Phases with explicit operator review gates. Small commits, one surface at
   a time, always shippable, verify gate green (currently **763 tests, 0 lint**) at every commit.
6. **Execution model.** Claude architects, maps, writes the research + story prompts, and reviews.
   Cursor executes the BMAD stories. Data shapes / ranking logic go **propose-then-stop**.

---

## Part 1 — System Inventory (everything we've built)

Four strata. This is the "take all the knowledge of what we built" catalogue. Where a fact is
verified this session it is stated; where it needs tracing it is flagged `→ RP-n`.

### 1.1 The App — `cns-dashboard` (SvelteKit 5 · Convex · Vercel · desktop-first)

| Surface | Route | Role | Status |
|---|---|---|---|
| Intelligence | `/nexus` | Morning cockpit — judgment queue + inspector | **Live**, reskinned to INSTRUMENT (`f90723b`) |
| Signals | `/nexus/investigate` | Investigation board (Triage→Investigating→Waiting→Resolved) | **Live**, not yet reskinned |
| Entities | `/nexus/entities` | Tracked + emerging entities to review | **Live**, not yet reskinned |
| Anomalies | — | Spikes/drops across signals | **Dead button** (data exists → RP-3) |
| Sources | — | Source health / weights / coverage | **Dead button** (data exists → RP-3) |
| Archive | — | Resolved / dismissed history | **Dead button** (scope undefined → RP-3) |
| Docs | — | The vault, in-app | **Dead button** (needs vault bridge → RP-8) |
| Support | — | Help / operator guide | **Dead button** (scope undefined → RP-3) |
| **Trends** | `/trends`, `/trends/[topicId]`, `/trends/canvas` | Topic timeline, forecast, decomposition, risk radar, signal map, investigation canvas | **Orphaned** — built, works, **not in nav** → RP-4 |
| Voice | Hermes drawer | Jarvis voice ask/recall | **Broken** (Hermes session expired) → RP-5 |
| Top-nav | shell | Notifications / Settings / Last-sync | **Stubs** (`NexusTopNav.svelte`), Last-sync shows "—" |

Design tokens: `src/lib/styles/cns-tokens.css` (INSTRUMENT SSOT) → drives `cockpit-monera.css`,
`nexus-theme.css`, and (still divergent) `trends-theme.css`. Charts: LayerChart (SVG) + ECharts
(canvas) — canvas needs in-engine re-theme (never fully done → design phase).

### 1.2 The Data Store + Aggregator — Convex (prod `amiable-ox-862`)

Module inventory (exported fns): `trendIntelligence` **19**, `digest` **11**, `entityIntelligence`
**5**, `investigationBoard` **5**, `investigationSessions` **5**, `keywordCandidates` **4**,
`trends` **4**, `dashboard` **3**, `canvasLayouts` **2**, `notebookHealth` **2**,
`notebookQueries` **2**, `hermesAwareness` **1**. Stubs (0 fns): `trendAlertDelivery`,
`trendAlertEvaluation`, `trendAnalytics`, `trendValidators`, `noteSearch`, `hermesPush` routes.

- **Awareness aggregator** (`hermesAwareness.ts`) reads across `digestRuns`, `digestSignals`,
  `entityMentions`, `investigationBoardItems`, `trendTopics`, `trendAnomalies`, `watchlist`,
  `trendScores`, `vaultHealth` — this is the system-state hub and the natural backbone for a global
  "Awareness / Last sync" surface.
- **Ingestion:** `http.ts` exposes `/hermes/awareness` (httpAction); `hermesPush.deliverAwarenessEvent`
  (internalAction) delivers events; `crons.ts` runs one interval job.
- Tables map cleanly to surfaces: `digestSignals`→cockpit, `investigationBoardItems`→Signals,
  `entityMentions`→Entities, `trendAnomalies`→Anomalies, source health→Sources, `vaultHealth`→Docs.

### 1.3 The Orchestration + Intelligence Backend — CNS repo (`Omnipotent.md`) + Hermes (`~/.hermes`)

The app is fed by crons + scripts in the CNS repo, not by the app itself:
- **Morning digest:** `hermes-morning-digest.sh` → Hermes `score-digest-signals.mjs` (computes
  `rankScore` = 5 deterministic dims; 89-3 source-class caps + substance floor live in the *app*)
  → `run-digest-convex-completion.mjs` → writes `digestRuns`/`digestSignals` to Convex.
  Cron: `install-morning-digest-cron.sh`, completion hook, `push-digest-watchdog.mjs`.
- **Trend layer (continuous):** `run-trend-ingest-cron.sh` → python adapters → `signalEvents` /
  `trendScores` / `trendTopics` / `trendAnomalies`. (Only trends+news+reddit feed signalEvents.)
- **Entity stage:** → `entityMentions` (emergence = active vs baseline count).
- **Hermes gateway:** Discord surface, skills (`morning-digest`, `investigate-trend`), voice,
  watchdog cron every 3 min.

### 1.4 The Knowledge + Sensory Systems (built, mostly NOT in the app yet)

- **Vault / PAKE** — PARA knowledge base, note schemas, quality scoring; `vault-io` MCP (10 tools,
  WriteGate). Candidate backing for the **Docs** surface.
- **NotebookLM** — 4 notebooks, fan-out; `notebooklm` MCP. Candidate surface or Docs sub-tab.
- **Honcho** — learning/memory pillar (managed). Never touch `pre_llm_call` recall.
- **run-chain** — hook-set / weapons-check outputs.
- **MCP fabric** — firecrawl (currently 401), perplexity, playwright, context7, discord.

### 1.5 The Workflows (what it does — the operator's real flows, end-to-end)

Each must be traced for "wired end-to-end? / breaks where? / unrealized potential?" (→ RP-2, RP-5):
1. **Morning orient:** cron digest → cockpit judgment queue → inspect → Dig / Watch / Dismiss →
   items flow to the investigation board.
2. **Investigate:** board Triage→Investigating→Waiting→Resolved; `runInvestigation` LLM action;
   per-item notes; sessions.
3. **Trend deepen:** `/trends` topic → timeline / forecast / decomposition / risk radar → crossing
   back to the digest item.
4. **Entity narrative:** emerging/tracked entities → evidence arc → save top signal.
5. **Knowledge capture:** sources → Nexus note authoring → vault; NotebookLM fan-out.
6. **Voice:** Hermes voice ask / recall (broken now).
7. **Awareness:** Hermes push events → the app's "Last sync" / notifications (not wired now).

---

## Part 2 — The Research Plan (exhaustive; each package is Cursor-ready)

Eight research packages. None require writing feature code — they produce **maps and decisions**.
Claude will write a paste-ready Cursor prompt for each when we start it. Deliverable of each = a
markdown doc under `_bmad-output/planning-artifacts/research/`.

- **RP-1 · Data-spine trace.** For every Convex table + function: what writes it, what reads it,
  the cadence/freshness, and whether it is live / stale / orphaned. Deliverable: a data-flow diagram
  (source → cron/script → Convex table → app query → surface) + a "dead data / dead query" list.
- **RP-2 · Surface teardown (deep).** For each of the 8 nav surfaces + `/trends` + drawers: current
  components, data bindings, wired/broken/missing, and a crisp definition of "done." Deliverable:
  one page per surface.
- **RP-3 · Dead-surface data-readiness + scope.** For Anomalies / Sources / Archive / Docs / Support:
  exactly which backend data already exists, what's missing, and **what each surface should be**
  (its job, its content, its interactions). This is where we *define* the vague ones.
- **RP-4 · Orphan adoption (`/trends`).** What's genuinely good in trends, what to keep/cut, and the
  decision: adopt as its own nav destination vs fold the best parts into the cockpit/other surfaces.
  Reverses the earlier "ignore trends" stance.
- **RP-5 · Backend orchestration + failure audit.** Every cron/script/hook in the CNS repo + Hermes:
  what runs, when, what it writes, and the known failure modes (voice re-auth, firecrawl 401, digest
  watchdog, Nexus-breaks-on-CC-update). Deliverable: an ops/runbook map + the reconfig list for Part 3.
- **RP-6 · External design + IA research.** How best-in-class unified intelligence / knowledge /
  command-center apps structure their IA, nav, shell, flow, and motion. Pull concrete references
  (the operator responds to visual references). Feeds the design phase.
- **RP-7 · INSTRUMENT design-system completeness.** Audit component coverage vs. what every surface
  needs: cards, tables, chips, states (loading/empty/error/quiet), chart re-theme (LayerChart +
  ECharts), logos/wordmark, motion. Deliverable: a component gap list + the design-system spec.
- **RP-8 · Knowledge-system integration.** How the vault (Docs), NotebookLM, and Honcho plug into
  the app — data bridges, MCP vs. Convex, what a "Docs" surface actually renders. Deliverable: an
  integration spec per system.

---

## Part 3 — Reconfiguration Map (what to fix/reconfigure)

Populated from RP-1/RP-5; seeded now:
- **Voice re-auth durability** — stop the recurring Hermes-session expiry (durable token path, not
  manual cookie edits).
- **"Last sync" / awareness heartbeat** — wire `hermesAwareness` → the top-nav so the app shows it's
  alive.
- **Firecrawl 401** — reconnect the MCP so research tooling works.
- **Convex stubs → real or removed** — `trendAlerts`, `analytics`, `noteSearch`, `hermesPush` routes.
- **Nav model** — add `/trends`; resolve Archive/Docs/Support from RP-3.
- **Any data-shape reconfig** surfaced by RP-1 (stale tables, disconnected writes).

---

## Part 4 — Design Plan (what to design)

- **The unified shell.** One nav (sidebar), one header, one inspector drawer pattern, one wordmark +
  logo. Every surface lives inside it. Kills the two-shell (`/nexus` vs `/trends`) split.
- **INSTRUMENT component library.** Formalize the cockpit's primitives into reusable components:
  cards, panels, tables, chips, stat tiles, the honest empty/quiet/error states, and the chart
  re-theme (LayerChart follows tokens; ECharts needs JS re-theme).
- **Per-surface visual targets.** Like the cockpit target HTML, a hand-built target for each surface
  *before* it's built — so the operator approves the look up front (the workflow that finally landed
  the cockpit he loves).
- **Motion + flow.** Transitions that preserve context as he moves orient → investigate → deepen;
  the "workflow state." Respect `prefers-reduced-motion`.
- **Logos / identity.** The visual-fidelity layer the operator specifically called out.

---

## Part 4.5 — Foundation & Architecture (Phase 0) — GATE 0 CLOSED

**SSOT:** [`architecture-nexus-unified-app.md`](./architecture-nexus-unified-app.md) (`status: gate0-approved`)  
**Brownfield:** [`brownfield/00-index.md`](./brownfield/00-index.md)

| Decision | Locked target |
|----------|---------------|
| **D1 Topology** | **A** = one Turbo/pnpm workspace of multiple packages (not a merged soup). Linchpin = `@cns/contracts` imported by app **and** writers. Vault never vendored; Hermes runtime stays `~/.hermes`. |
| **D1b Sequencing** | **M0 → M1 → M2 → M3**. C is bridge; A is target. M0 = diagnose live P0 from rejected payload first, then minimal live fix, then formalize contracts. Acceptance = real digest run newer than 2026-07-22 in cockpit. |
| **D2 Shell + IA** | One shell. Destinations: Briefing / Investigate / Explore / Knowledge / System. Canvas under Investigate. Archive/Support not destinations. Trends shell KILL. Canonical evidence substrate = **target model**, not ingestion rewrite. Durable Dismiss-with-decay. |
| **D3 Pluto pull-ins** | **D3b Sentry first** (unified with awareness — one health model, three consumers; failed digest must actively reach operator). **D3a workflow** evidence-gated after D3b. **D3c** agent-DX stack rule. **D3d** sandbox last, autonomy criterion, non-blocking for Gate 0 / wiring waves. |
| **D4 Convex** | **KEEP** operational plane. One runtime contract source; types derive; fork (a) export Convex validators vs (b) generate — decided at M0; parallel hand defs FORBIDDEN. Secrets, Honcho, large blobs stay off Convex. |
| **D5 Data model** | **DM-1+2 one revision** (identity measure + fallback + provenance). Then DM-3 durable judgments. DM-4 only if RP-1 overlap share justifies unification. |

**→ GATE 0: APPROVED 2026-07-25. No code until operator says go for M0.**

### The monorepo decision (record)

Option spectrum A/B/C was decided in create-architecture. **Target = A.** Migration = C-bridge-first (shared-contract package before full workspace collapse). Do **not** misread monorepo as folder soup — it is multi-package with `@cns/contracts` as the linchpin against OPS-2 / `contributedCount`-class drift.

## Part 5 — The Sequenced Roadmap

```
PHASE 0 — FOUNDATION & ARCHITECTURE          → GATE 0: CLOSED 2026-07-25
   brownfield docs · architecture-nexus-unified-app.md (D1–D5 locked)

NEXT EXECUTABLE — M0 (C-bridge start)        → only on explicit operator go
   Diagnose live P0 from rejected digest payload → minimal live fix → cockpit run > Jul 22
   → then formalize @cns/contracts (fix-then-formalize). Still no monorepo merge.

PHASE A — RESEARCH (re-scoped)               → GATE A: operator reviews remaining map
   RP-1 data spine (feeds DM-4 overlap share) · RP-5 backend/ops · RP-6 external design ·
   RP-7 INSTRUMENT completeness · RP-8 knowledge
   (RP-2/RP-3/RP-4 partially answered by Decision 2 IA — refine, don't rediscover)

PHASE B — DESIGN  ★ PRESERVED GATE           → GATE B: operator approves visual targets
   BEFORE ANY BUILD of a destination:
   Hand-built visual target (INSTRUMENT) for each of:
     Briefing · Investigate · Explore · Knowledge · System
   Operator approves each target before Cursor wires that destination.
   (This is the only workflow that has produced a design the operator kept — cockpit INSTRUMENT.)
   Also: unified shell chrome · component library · motion/flow · logo/identity

M1–M3 (topology) can interleave with research/design after M0; A remains the end-state workspace.

PHASE C — WIRING (waves; BMAD stories + verify + visual review against Gate B targets)
   Align wave order to Decision 2 destinations (not the old dead-nav list).
   Wave sketches: Briefing durability/Dismiss · Investigate (+ canvas) · Explore lenses ·
                  Knowledge bridge · System/Sources · shell unify · D3b awareness push
                                              → GATE per wave
```

Each wave: propose-then-stop on any data shape/ranking; verify gate green; visual review
(Playwright dark+light) against the **Gate B approved target** before commit; small commits.

---

## Part 6 — Execution Model & Guardrails

- **Cursor BMAD stories** generated from this plan (lead every prompt with repo/branch/dir).
- **Propose-then-stop** on data shapes and any ranking/scoring logic (review gate — has caught real
  bugs).
- **Verify gate** every commit; INSTRUMENT tokens only; honesty primitives preserved.
- **Claude** = architect/reviewer + writes research/story prompts + visual verification via Playwright.
- **One surface at a time**, always shippable; no big-bang.

---

## Part 7 — Immediate Next Step

**Gate 0 is closed.** Do **not** start Phase A / RP-1 as the next action.

**Next executable step = M0** (Decision 1b), **only when the operator explicitly says go:**

1. Pull a real rejected digest payload + Convex validation error.
2. Diagnose which side is canonically wrong (do not pre-assume "no contributedCount").
3. Minimal live fix → prove cockpit shows a digest run **newer than 2026-07-22**.
4. Then extract the proven shape into `@cns/contracts` (fork a vs b decide here; Context7 for Infer).

Until that go: planning/research prompts may be drafted, but **no code, no contract package, no deploy.**

**Do not bury Phase B:** before any destination is built in Phase C, a hand-built INSTRUMENT visual
target for that destination must be operator-approved (Gate B). M0 unblocks the spine; it does not
authorize wiring Briefing/Investigate/Explore/Knowledge/System without those targets.
