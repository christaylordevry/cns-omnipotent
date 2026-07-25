---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: architecture
lastStep: 8
status: complete
completedAt: "2026-06-25"
project_name: CNS — Hermes Omniscient (Hands-Off JARVIS)
user_name: Chris
date: "2026-06-25"
parent_architecture: architecture-hermes-consolidation.md
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md
  - _bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/addendum.md
  - _bmad-output/planning-artifacts/architecture-hermes-consolidation.md
  - _bmad-output/planning-artifacts/research-hermes-omniscience-resurfacing.md
  - _bmad-output/planning-artifacts/briefs/brief-hermes-omniscient-2026-06-25/brief.md
  - project-context.md
operatorConstraints:
  protect_list_zero_edits:
    - src/agents/synthesis-adapter-llm.ts
    - src/agents/hook-adapter-llm.ts
    - src/agents/boss-adapter-llm.ts
    - src/agents/run-chain.ts
    - scripts/run-chain.ts
  no_hermes_core_fork: true
  recall_first_sequencing: true
openQuestionsResolved:
  - OQ-1 → ADR-HERMES-014
  - OQ-9 → ADR-HERMES-015
spikesRequired:
  - SPIKE-OMNI-001 — Local Nexus ↔ Hermes dashboard `/api/ws` + voice auth ticket proxy
  - SPIKE-OMNI-002 — `voice_pane` recall-channel metadata through dashboard chat path
confirmEarly:
  - A4-0 — pre_llm_call injection contract E2E proof (first A4 task; P0 gate before recall depends on seam)
---

# Architecture Decision Document — Hermes Omniscient (Hands-Off JARVIS)

**Companion PRD:** `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md`  
**Parent architecture:** `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` (ADR-HERMES-001..012)  
**Repos in scope:** `Omnipotent.md` (Brain, collectors, Hermes plugins) + `cns-dashboard` (Local/Deployed Nexus, Convex)

This document **amends** ADR-HERMES-001 and adds ADR-HERMES-013..015. It resolves OQ-1 and OQ-9 before recall stories enter build, and specifies FR20/FR21 WSL→Convex transport for deployed `/nexus`.

---

## Executive summary

| # | Decision | Outcome |
|---|----------|---------|
| **ADR-HERMES-001** | Voice surface reversal | **Amended** — Local Nexus primary voice v1; Desktop/Discord voice deferred |
| **ADR-HERMES-013** | WSL reachability split | **New** — SvelteKit `$lib/server` → `127.0.0.1:9119`; voice UI local-only |
| **ADR-HERMES-014** | ElevenLabs delivery (OQ-1) | **Direct `ELEVENLABS_API_KEY`** — Portal managed TTS is OpenAI-only; `edge` documented fallback |
| **ADR-HERMES-015** | FR18 injection seam (OQ-9) | **`pre_llm_call` Hermes plugin** — no core fork; protect-list clean; Honcho slot preserved |
| **FR20/FR21** | Deployed Nexus dev-state | **Extend Epic 77 `dashboard-sync` → Convex** — reactive query on Vercel; WSL digest reads same collector |

**Recall-first rule (unchanged):** FR16/18/19 + ADR-HERMES-015 land before FR10 voice. Voice is the designated slip valve.

---

## Project Context Analysis

### Requirements overview

**Functional requirements (architectural mapping):**

| Area | FRs | Architectural implication |
|------|-----|---------------------------|
| Semantic recall + injection | FR16, FR18, FR19 | `src/brain/` PortalEmbedder + policy config + Hermes `pre_llm_call` plugin (ADR-015); golden-set calibration gate |
| Local Nexus voice | FR10 | cns-dashboard Local-only drawer; ADR-013 proxy to `:9119`; ADR-014 ElevenLabs direct; spikes gate D-phase only |
| Morning intelligence | FR20, FR21 | Shared WSL collector → Convex push → reactive `/nexus` panel (deployed cannot read WSL files) |
| Cost routing | FR14 | `auxiliary:` block pin to Haiku; retire inert `smart_model_routing` |
| Learning / loop (v1.5) | FR15, FR22 | Honcho external memory provider; does not block v1 recall seam |

**Non-functional requirements (decision drivers):**

- **NFR2** — protect-list firewall on run-chain adapters
- **NFR5** — config-reversible embedder, injection, TTS
- **NFR7** — Context7 before Portal embeddings, voice config, Honcho
- **NFR-RECALL-1..4** — per-channel token ceilings, index freshness, secret-gate on index
- **NFR-VOICE-1** — voice UI local-only-activated

**Scale and complexity:**

- **Primary domain:** Brownfield full-stack (Hermes WSL + Omnipotent Brain + cns-dashboard/Convex)
- **Complexity level:** High — runtime zone split (WSL / Vercel / Convex), recall policy calibration, voice proxy
- **Architectural components:** ~12 (embedder, index cron, recall-inject, pre_llm_call plugin, policy config, dev-state collector, Convex tables, digest enrichment, voice drawer, Hermes TTS config, calibration harness, awareness panels unchanged)

### Technical constraints and dependencies

| Constraint | Implication |
|------------|-------------|
| StubEmbedder today | FR16 is greenfield embedder + reindex, not engine surgery |
| One external MemoryProvider slot | Brain recall via `pre_llm_call`, not external provider — Honcho slot preserved |
| Vercel ↔ WSL unreachable | FR20/21 must use Convex transport; FR10 local-only |
| Portal managed TTS = OpenAI only | ElevenLabs requires direct key (ADR-014) |
| Epic 77 dashboard-sync live | Extend push path for internal dev-state — do not reinvent |

### Cross-cutting concerns

1. Runtime zone boundaries (WSL / Vercel / Convex)
2. Recall-first sprint ordering (voice is slip valve)
3. Cited injection trust line (no secret-gate paths, visible citations)
4. Hermes extension seams without core fork
5. Protect-list preservation
6. Context7 + verify.sh gates

---

## Starter Template Evaluation

### Technical preferences (from project context)

Documented in `project-context.md` and parent `architecture-hermes-consolidation.md`:

| Preference | Value |
|------------|-------|
| Languages | TypeScript strict (both repos); Python on WSL for Hermes runtime only |
| Control repo | `Omnipotent.md` — Vault IO MCP, `src/brain/`, scripts, Hermes skills/crons |
| Dashboard repo | `cns-dashboard` — SvelteKit 2 + Svelte 5 + Convex + Vercel |
| Agent runtime | Hermes v0.17.0 at `~/.hermes/hermes-agent` (operator-managed; **no reinstall**) |
| Inference | Nous Portal OAuth; `anthropic/claude-sonnet-4.6` main; auxiliary → Haiku (FR14) |
| Deploy zones | WSL (Hermes `:9119`, gateway, crons) · Vercel (`/nexus`) · Convex (intelligence DB) |
| UX | Epic 63 `/nexus` shell + `nexus-theme.css`; ECharts via `EChartsPanel.svelte` only |
| Init pattern | **Brownfield extension** — no greenfield scaffold |

No UX spec loaded for Omniscient; voice drawer extends existing `/nexus` home (PRD §4.2).

### Primary technology domain

**Brownfield integration architecture** — cross-repo extension of live stacks. Not a greenfield app bootstrap.

Omniscient adds **felt intelligence** (Brain recall, injection plugin, dev-state transport, Local Nexus voice) on top of consolidation infrastructure (Portal, Epic 77 awareness, dashboard-sync, digest crons).

### Starter options considered

| Option | Verdict | Why |
|--------|---------|-----|
| `npm create svelte@latest` / new SvelteKit app | **Rejected** | Epic 63 `/nexus` + Convex schema live in `cns-dashboard` |
| `npx convex dev` greenfield init | **Rejected** | `convex/` tables, `ingestDashboardSnapshot`, `hermesAwareness` exist |
| Fresh `hermes setup` / new Hermes install | **Rejected** | v0.17.0 live; OAuth, 13 crons, CNS skills configured |
| New Omnipotent.md TypeScript package | **Rejected** | Vault IO MCP + `src/brain/` scaffold exist |
| **Brownfield extension on locked stacks** | **Selected** | Same decision as parent consolidation; Omniscient is tail work |

**Explicitly rejected for Omniscient:**

- Standalone recall microservice (Brain stays in `Omnipotent.md` `src/brain/`)
- Fork/patch `~/.hermes/hermes-agent` (plugins + config only)
- New database (Convex extension only)
- Client-side Brain query from browser (server/plugin paths only)

### Selected foundation: brownfield extension

**Rationale:** Every surface, schema, and seam pre-exists from Epics 42, 63, 74, 77. Omniscient wires PortalEmbedder, `pre_llm_call` recall injection, internal dev-state Convex push, and Local Nexus voice — it does not scaffold a new application.

**No initialization command.** First implementation stories are Phase A (PortalEmbedder + A4-0 inject proof), not `create-*` CLI.

### Live stack versions (verified 2026-06-25)

| Component | Installed / locked | npm/PyPI latest (web check) | Gap |
|-----------|-------------------|----------------------------|-----|
| Node | `>=20` (Omnipotent); `^20.19 \|\| ^22.12 \|\| >=24` (dashboard) | 22 LTS current | None — engines satisfied |
| TypeScript | `^5.9.3` (Omnipotent); `^6.0.2` (dashboard) | 5.x / 6.x | Dashboard ahead; no downgrade needed |
| SvelteKit | `@sveltejs/kit ^2.57.0` | 2.x maintained | In family |
| Svelte | `^5.55.2` | 5.x | In family |
| Convex | `^1.39.1` | **1.41.0** (npm, Jun 2026) | Minor; bump in dependency story if needed, not init |
| Vite | `^8.0.7` | 8.x | In family |
| Tailwind | `^4.2.2` | 4.x | In family |
| Vitest | `^3.2.4` | 3.x | In family |
| Hermes Agent | **0.17.0** (`pyproject.toml`) | Context7: v2026.4.16 tags exist | Operator-managed; **do not auto-upgrade** mid-initiative |
| MCP SDK | `^1.29.0` | — | Vault IO only; unchanged |

**Version policy (NFR-PKG-1):** No npm/pip package &lt; 14 days old without operator approval. Routine patch bumps happen in implementation stories, not as starter init.

### Architectural decisions provided by existing foundation

**Language and runtime**

- TypeScript strict, ESM (`"type": "module"`) on both repos
- Hermes Python 3.x on WSL; extension via `~/.hermes/plugins/` + `config.yaml`
- `npx tsx` for Omnipotent scripts; `npm run build` / `tsc` for MCP server

**Styling and UI**

- Tailwind 4 + `nexus-theme.css` (ADR-E46-002)
- Voice drawer = new Svelte component on existing `/nexus` — inherits theme, no new design system

**Build and deploy**

- Omnipotent: `npm test` + `bash scripts/verify.sh`
- cns-dashboard: `npm test` + Vercel adapter; `npx convex deploy --cmd 'vite build'`
- WSL Hermes: systemd `hermes-dashboard.service` on `0.0.0.0:9119`

**Testing**

- Omnipotent: Node test runner + Vitest (`tests/brain/`, `tests/hermes/` domains)
- cns-dashboard: Vitest + `convex-test`

**Code organization (inherits + Omniscient additions)**

| Repo | Existing | Omniscient adds |
|------|----------|-----------------|
| Omnipotent.md | `src/brain/`, `scripts/dashboard-sync.ts`, `~/.hermes/skills/cns/` | `src/brain/recall-inject.ts`, `config/brain-recall-policy.json`, `scripts/brain-recall-prefetch.mjs`, `scripts/lib/collect-internal-dev-state.ts`, `scripts/hermes-plugin-examples/cns-brain-recall/` + `scripts/install-hermes-plugin-cns-brain-recall.sh` |
| cns-dashboard | `convex/dashboard.ts`, `/nexus/*`, `hermesAwareness` | `internalDevState` table, `VoiceDrawer.svelte`, `$lib/server/hermes-local-proxy.ts` |

**Integration patterns (unchanged)**

- Convex reactive `useQuery` for cockpit panels
- WSL → Convex push via `dashboard-sync.env` (`CONVEX_DEPLOY_KEY`)
- Vault via `cns_vault_io` MCP on Hermes
- Hermes extension: plugins/hooks — not core patches

### Omniscient-specific starter constraints (not in parent doc)

1. **Recall spine uses existing Brain CLI** — `npm run brain:index` / `brain:query` remain; PortalEmbedder is drop-in on `Embedder` interface.
2. **Injection is plugin-only** — source in `scripts/hermes-plugin-examples/`; install via `install-hermes-plugin-cns-brain-recall.sh` (same pattern as Hermes skills). Runtime copy at `~/.hermes/plugins/` is **not** version-controlled.
3. **FR20/21 extends dashboard-sync** — same cron, same env file; new collector module, not new sync service.
4. **FR10 extends cns-dashboard routes** — same SvelteKit app; local-only feature flag via health check.

### First implementation story (post-starter)

Not a scaffold command — first story is **A4-0** (`pre_llm_call` inject E2E proof) in parallel with **A1** (PortalEmbedder), per recall-first sequencing. Voice Phase D remains behind A3 calibration + spikes.

---

## Core Architectural Decisions

_Sync pass (step 04). Normative ADR narratives follow in § ADR-HERMES-001/013/014/015 and FR20/21 transport. Inherited parent ADRs (002–012) remain binding unless explicitly amended here._

### Decision priority analysis

**Critical — block implementation (Omniscient):**

| ID | Decision | Status | Detail |
|----|----------|--------|--------|
| ADR-HERMES-001 | JARVIS topology — Local Nexus primary voice | **AMENDED** | § ADR-HERMES-001 below |
| ADR-HERMES-013 | WSL `:9119` proxy; voice local-only | **NEW — LOCKED** | § ADR-HERMES-013 |
| ADR-HERMES-014 | ElevenLabs direct key (not Portal managed TTS) | **NEW — LOCKED** | § ADR-HERMES-014 |
| ADR-HERMES-015 | FR18 seam = `pre_llm_call` plugin | **NEW — LOCKED** | § ADR-HERMES-015 |
| FR20/21 transport | WSL collector → Convex → `useQuery` | **NEW — LOCKED** | § FR20/FR21 transport |
| A4-0 gate | `pre_llm_call` inject E2E proof | **CONFIRM-EARLY** | First A4 task |

**Critical — inherited unchanged (consolidation):**

| ID | Decision | Status |
|----|----------|--------|
| ADR-HERMES-002 | FR12 pull: `GET /hermes/awareness` | LOCKED |
| ADR-HERMES-003 | FR12 push v1: Discord webhook | LOCKED |
| ADR-HERMES-004 | FR11: Anthropic key, protect-list adapters | LOCKED |
| ADR-HERMES-006 | FR-GATE Portal paid tier | DONE (Pre-4) |

**Important (Omniscient):**

| ID | Decision |
|----|----------|
| FR14 | `auxiliary:` → Haiku; retire `smart_model_routing` |
| FR16–19 | PortalEmbedder, policy config, calibration harness |
| Protect-list | Zero edits on run-chain adapters + engine |

**Deferred (v1.5 / explicit opt-in):**

| Item | Rationale |
|------|-----------|
| Honcho external `MemoryProvider` (FR15) | v1.5; Brain recall stays on `pre_llm_call` |
| Unified Loop (FR22) | Approval-gated; after recall + learning |
| Desktop/Discord voice | ADR-001 amendment defers v1 |
| Tailscale remote voice | v1.5 per brief |
| ADR-HERMES-011 inline streaming | Parent defer unchanged |
| SPIKE-OMNI-001/002 | Gate FR10 only |

### Data architecture

| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Brain vectors** | File-backed index under Omnipotent repo (`src/brain/`); PortalEmbedder replaces StubEmbedder | Pluggable `Embedder`; incremental rebuild on hash change |
| **Recall policy** | Versioned `config/brain-recall-policy.json` | Per-channel budgets tunable post-FR19; not PRD-hardcoded |
| **Convex — awareness** | Existing tables + `HermesAwarenessSnapshot` (ADR-002) | No schema break |
| **Convex — dev-state** | New singleton `internalDevState` table | FR21 deployed panel; separate from awareness DTO |
| **Convex — dashboard** | Extend `ingestDashboardSnapshot` cron path OR parallel mutation same tick | Reuse `dashboard-sync.env` credentials |
| **Vault corpus** | PARA vault via MCP; secret-gate + allowlist on index | NFR-GOV-2 |
| **Caching** | `brain-index-manifest.json` + vector hash cache | Embed cost guard |
| **Migration** | Full reindex on embedder model change; incremental otherwise | FR16 consequences |

No new database product. No client-side Brain index reads.

### Authentication and security

| Concern | Decision |
|---------|----------|
| Hermes inference | Portal OAuth refresh token (`~/.hermes/auth.json`) — unchanged |
| Dashboard chat/voice proxy | OAuth via `$lib/server`; browser never holds `API_SERVER_KEY` (ADR-013) |
| Convex push (WSL) | `CONVEX_DEPLOY_KEY` in `~/.hermes/dashboard-sync.env` |
| Convex pull (Hermes) | `HERMES_CONVEX_READ_KEY` bearer — unchanged (ADR-002) |
| ElevenLabs TTS | `ELEVENLABS_API_KEY` in `~/.hermes/.env` (ADR-014) |
| Brain index | `indexing-secret-gate.ts` same pattern set as WriteGate |
| Env collision | No `NEXUS_*` on cns-dashboard (ADR-E63-005) |
| Reversibility | Embedder flag, plugin disable, `tts.provider` swap (NFR5) |

### API and communication patterns

| Seam | Pattern | Zone |
|------|---------|------|
| FR18 recall inject | `pre_llm_call` → `brain-recall-prefetch.mjs` → cited context block | WSL Hermes (all text + voice turns) |
| Vault IO | `cns_vault_io` MCP stdio | WSL Hermes |
| Portal embeddings | HTTPS `/embeddings` via Portal JWT | WSL → Portal |
| Dev-state push | `ingestInternalDevState` mutation (new) | WSL → Convex |
| Cockpit read | Convex `useQuery(getInternalDevState)` | Vercel + Local Nexus |
| Awareness pull | `GET /hermes/awareness` | Convex → WSL (unchanged) |
| Awareness push | Discord webhook | Convex → Discord (unchanged) |
| Async ask | `hermes-dispatch` webhook | Vercel → Discord (unchanged) |
| Local voice chat | Dashboard `WS /api/ws` via SvelteKit proxy | Local Nexus → WSL `:9119` |
| Error shape | Preserve existing dispatch `{ ok, message, code }` envelope | cns-dashboard |

No REST API for Brain recall exposed to browser. No Convex mutations from deployed UI for dev-state ingest.

### Frontend architecture

| Concern | Decision |
|---------|----------|
| Framework | SvelteKit 2 + Svelte 5 (brownfield) |
| State | Convex `convex-svelte` reactive queries for panels; no new global store |
| Routing | Voice drawer on `/nexus` home — no new route |
| Local vs deployed | Feature detect via `$lib/server` health check; voice UI conditional mount |
| Charts | ECharts via `EChartsPanel.svelte` only (ADR-E46-002) |
| Styling | Tailwind 4 + `nexus-theme.css` |
| Citations UI | Transcript + dispute path shows vault path citations (FR18 trust line) |

### Infrastructure and deployment

| Zone | Workloads |
|------|-----------|
| **WSL** | Hermes gateway, dashboard `:9119`, Brain CLI, `dashboard-sync` + dev-state collector, digest crons, `cns-brain-recall` plugin |
| **Vercel** | `/nexus` static+SSR; no WSL reachability |
| **Convex** | Intelligence DB, HTTP awareness, dev-state queries, push actions |

**CI/verify:** `bash scripts/verify.sh` (Omnipotent + cns-dashboard when sibling present).

**Monitoring:** Existing agent-log + sync metadata; injection shadow mode logs for FR19.

### Decision impact analysis

**Cross-component dependencies:**

```
PortalEmbedder (FR16)
    → brain:index rebuild
    → recall-inject.ts + policy config (FR18)
    → pre_llm_call plugin (ADR-015) — after A4-0 proof
    → FR19 calibration gate
FR14 auxiliary Haiku — parallel, no dependency
collect-internal-dev-state → Convex internalDevState
    → FR21 panel + FR20 digest block (shared collector)
ADR-013/014 + SPIKE-OMNI-* → FR10 voice drawer (last)
```

**Implementation sequence:** See § Decision impact — implementation sequence (unchanged).

---

## Implementation Patterns & Consistency Rules

_Inherits parent `architecture-hermes-consolidation.md` § Implementation Patterns unless overridden below. Focus: where Omniscient agents could diverge without explicit rules._

### Pattern categories defined

**Critical conflict points (Omniscient-specific):** 14 areas — recall seam choice, Brain vs adapter location, plugin vs memory-provider, Convex DTO drift, deployed-vs-local UI branching, ElevenLabs vs Portal TTS config, dev-state collector duplication, channel metadata, shadow mode, protect-list, test glob placement, Context7 gate, epic repo ownership, digest vs panel consumer split.

### Naming patterns

**Convex (cns-dashboard):** camelCase tables and fields (existing). New module: `internalDevState.ts` (or `internalDevState/` if split). Query/mutation names: `ingestInternalDevState`, `getInternalDevState`. Do **not** overload `hermesAwareness` DTO for dev-state.

**Internal dev-state DTO fields:** camelCase — `collectedAt`, `prioritizedItems`, `sourcePath`, `sourceKind`. `sourceKind` literals: `'deferred' | 'sprint' | 'agent-log' | 'fast-scan'`.

**Recall policy config:** `config/brain-recall-policy.json` — channel keys exactly `voice_pane`, `standard_text`, `yapped_text` (PRD glossary). Policy keys: `max_top_k_fetch`, `min_score_threshold`, `max_injection_tokens`, `max_chunks`.

**Hermes plugin (in-repo-with-install):** **Source of truth (git)** — `scripts/hermes-plugin-examples/cns-brain-recall/` (`plugin.py`, optional `references/config-snippet.md`). **Install target (runtime)** — `~/.hermes/plugins/cns-brain-recall/` via `bash scripts/install-hermes-plugin-cns-brain-recall.sh` (mirrors `install-hermes-skill-*.sh`). Plugin name: `cns-brain-recall`. Hook: `pre_llm_call` only for v1 inject.

**Recall channel platform hint:** string `nexus-voice` when Local Nexus proxy forwards voice-pane turns (SPIKE-OMNI-002 may refine).

**Omnipotent scripts:** kebab-case filenames — `brain-recall-prefetch.mjs`, `collect-internal-dev-state.ts`. Shared lib under `scripts/lib/`.

**Svelte components:** PascalCase — `VoiceDrawer.svelte`, `DiscoveryWorkPanel.svelte`. Server modules: `hermes-local-proxy.ts`, `hermes-local-health.ts`.

**Env vars:** `ELEVENLABS_API_KEY`, `HERMES_*`, `CNS_*` — never `NEXUS_*` on cns-dashboard.

### Structure patterns

**Repo ownership (Omniscient phases):**

| Phase | Primary repo | Scope |
|-------|--------------|-------|
| A — Recall spine | Omnipotent.md | `src/brain/`, policy config, plugin **source** + install script, prefetch CLI |
| A4-0 | Omnipotent.md → WSL install | Run `install-hermes-plugin-cns-brain-recall.sh`; enable in `config.yaml` |
| B — Cost | WSL `~/.hermes/config.yaml` | `auxiliary:` block |
| C — Morning intelligence | Omnipotent collectors + cns-dashboard Convex/UI | Shared `collect-internal-dev-state` |
| D — Voice | cns-dashboard + WSL Hermes config | Drawer, proxy routes, `tts:` block |

**Omnipotent.md additions (normative paths):**

```
config/brain-recall-policy.json
src/brain/embedder-portal.ts          # PortalEmbedder (name may vary; stays under src/brain/)
src/brain/recall-inject.ts
scripts/brain-recall-prefetch.mjs
scripts/lib/collect-internal-dev-state.ts
scripts/hermes-plugin-examples/cns-brain-recall/
  plugin.py                             # pre_llm_call hook — VERSION CONTROLLED
  references/config-snippet.md          # plugins.enabled + OMNIPOTENT_REPO (optional)
scripts/install-hermes-plugin-cns-brain-recall.sh
tests/brain/recall-inject.test.ts
tests/brain/portal-embedder.test.ts   # if split
```

**WSL Hermes (runtime install target — not in Omnipotent git):**

```
~/.hermes/plugins/cns-brain-recall/     # INSTALLED copy from install script
~/.hermes/config.yaml                 # auxiliary, tts, plugins.enabled
~/.hermes/.env                        # ELEVENLABS_API_KEY
```

**cns-dashboard additions:**

```
convex/internalDevState.ts
convex/validators.ts                  # extend — internalDevStateValidator
src/lib/server/hermes-local-proxy.ts
src/lib/server/hermes-local-health.ts
src/routes/api/nexus/hermes/**          # health + chat/WS proxy
src/lib/components/nexus/VoiceDrawer.svelte
src/lib/components/nexus/DiscoveryWorkPanel.svelte
```

**Test placement (Omnipotent — vitest.config.ts already includes `tests/brain/**`, `tests/hermes/**`):**

| Domain | Location | Runner |
|--------|----------|--------|
| Brain recall / embedder | `tests/brain/**/*.test.ts` | vitest |
| Prefetch CLI / inject integration | `tests/brain/` or `tests/hermes/` | vitest |
| Dev-state collector | `tests/brain/` or new `tests/dashboard-sync/` | vitest |
| Plugin inject proof | Manual + optional `tests/hermes/` harness | operator A4-0 |

**Do not** put Brain tests in `tests/vault-io/`. **Do not** add root-level `tests/*.test.ts`.

### Format patterns

**Brain prefetch CLI stdout (JSON):** `{ "context": string | null, "citations": [{ "path": string, "score": number }], "channel": string, "shadow": boolean }` — plugin reads `context` only; citations logged when `shadow: true`.

**Injection fence in context block:** Markdown with explicit `vault:` path per chunk — operator-disputable. Chunks without resolvable path **dropped** (NFR-RECALL-4).

**InternalDevState snapshot:** camelCase JSON; `prioritizedItems[].rank` 1-based integer; include `rationale` string (FR21 — not black-box).

**Hand-mirror types:** Omnipotent `collect-internal-dev-state.ts` types sync-comment-linked to `cns-dashboard/convex/validators.ts` (same pattern as `dashboard-sync.ts` ↔ `DashboardSnapshot`).

**Hermes dispatch / awareness:** unchanged parent envelopes — `{ ok: true }`, `[awareness.<eventType>]` webhook prefix.

**Timestamps:** Unix ms (`number`) in Convex and collector DTOs — match existing dashboard-sync convention.

### Communication patterns

- **FR18 inject:** once per turn via `pre_llm_call` — not per tool-loop iteration; Hermes merges at API-call time only.
- **FR12 awareness:** unchanged — 3-min pull cache; no per-turn Convex for recall.
- **Dev-state push:** same 3-min cron tick as `dashboard-sync` (extend, don't spawn second cron unless operator approves).
- **FR20 digest:** WSL cron reads collector **locally** for markdown; may also read Convex for deployed digest panel — two consumers, **one collector function**.
- **FR10 voice:** Local Nexus → `$lib/server` → `:9119` only; Convex cloud never calls `:9119`.

### Process patterns

**Protect-list (zero edits — unchanged):**

`src/agents/synthesis-adapter-llm.ts`, `hook-adapter-llm.ts`, `boss-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`

**Recall implementation MUST NOT:** patch `turn_context.py`, `memory_manager.py`, or any file under `~/.hermes/hermes-agent/`.

**Context7 gate (NFR7):** before implementing Portal `/embeddings`, ElevenLabs/`tts` config, Honcho — `resolve-library-id` → `query-docs`.

**Shadow mode (FR19):** `brain-recall-policy.json` `shadow_mode: true` → plugin returns empty context but logs full inject payload to stderr or `~/.hermes/logs/`.

**Reversibility:** feature flags in policy config + `hermes plugins disable cns-brain-recall` + embedder env toggle — no vault mutations to revert.

**Config-story evidence-file requirement (binding on B1, A4, D1, and any story mutating `~/.hermes/config.yaml` or `~/.hermes/.env`):**

Every story that changes Hermes operator config (not in-repo `config/brain-recall-policy.json`) **MUST** produce a secret-safe evidence markdown file:

| Rule | Detail |
|------|--------|
| **Path** | `_bmad-output/implementation-artifacts/<story-id>-<slug>-evidence.md` (Epic 74 pattern, e.g. `74-3-compression-portal-evidence.md`) |
| **Redaction** | No refresh tokens, JWTs, inline `api_key`, or `auth.json` contents (NFR4) |
| **Minimum contents** | Redacted `hermes config show` / `hermes portal info` excerpts; before/after `config.yaml` **keys only** (not secret values); install command run + destination path |
| **Plugin stories (A4)** | **Must** include: `bash scripts/install-hermes-plugin-cns-brain-recall.sh` output; `hermes plugins list` showing `cns-brain-recall` enabled; A4-0 inject probe visible in one turn |
| **Auxiliary story (B1)** | Pin confirmation for `auxiliary:` tasks + log excerpt showing Haiku not Sonnet |
| **TTS story (D1)** | `tts.provider` + extras install note; redacted proof TTS path works; `edge` fallback documented |
| **In-repo config (A2)** | Policy file is git-tracked — evidence optional; golden-set calibration artifact satisfies FR19 |

**Verify gate:** `bash scripts/verify.sh` before every commit.

**Sprint gate:** No Phase D files until A3 calibration passes or operator documents waiver; A4-0 should complete before production inject enable.

### Enforcement guidelines

**All AI agents MUST:**

1. Read this doc + PRD before Omniscient stories
2. Check protect-list before every edit in Omnipotent.md
3. Place Brain logic in `src/brain/`; Hermes delivery in **repo plugin source** + install script (not hand-edits under `~/.hermes/plugins/` only)
4. Extend dashboard-sync for dev-state — no parallel mystery sync script
5. Run `bash scripts/install-hermes-plugin-cns-brain-recall.sh` after plugin source changes (A4 parity gate)
6. Use `tests/brain/` or `tests/hermes/` for new tests
7. Context7 before Portal embeddings / voice / Honcho APIs
8. Config-touching stories: produce `<story-id>-*-evidence.md` per § Process patterns
9. Pass `verify.sh`

### Pattern examples

**Good — A1:** `PortalEmbedder` in `src/brain/`, tests in `tests/brain/portal-embedder.test.ts`

**Good — A4:** `scripts/hermes-plugin-examples/cns-brain-recall/` in git + install script → `~/.hermes/plugins/cns-brain-recall/` calling `brain-recall-prefetch.mjs`

**Anti-pattern:** edit plugin **only** under `~/.hermes/plugins/` with no repo mirror (drifts from git)

**Good — C1:** `collect-internal-dev-state.ts` imported by `dashboard-sync.ts` and digest script

**Anti-pattern:** edit `synthesis-adapter-llm.ts` to prepend recall context

**Anti-pattern:** fork `hermes-agent` to add inject hook

**Anti-pattern:** Svelte component calling `brain:query` from browser

**Anti-pattern:** new Convex table named `dev_state` (snake_case) — use camelCase `internalDevState` table

**Anti-pattern:** edit `~/.hermes/plugins/cns-brain-recall/` without updating `scripts/hermes-plugin-examples/` and re-running install script

**Anti-pattern:** config story (B1, A4, D1) merged without `<story-id>-*-evidence.md`

**Anti-pattern:** `tts.use_gateway: true` expecting ElevenLabs — gateway is OpenAI TTS only

---

## Project Structure & Boundaries

_Additions and touch points for Hermes Omniscient. **EXISTING** = live from consolidation; **NEW** = Omniscient stories; **PROTECTED** = zero edits._

### Complete project directory structure

```
Omnipotent.md/
├── config/
│   ├── brain-corpus-allowlist.json         # EXISTING
│   └── brain-recall-policy.json              # NEW (A2) — per-channel injection policy
├── src/
│   ├── brain/                                # EXISTING tree — extend in place
│   │   ├── embedder.ts                       # EXISTING — add PortalEmbedder export (A1)
│   │   ├── build-index.ts                    # EXISTING
│   │   ├── build-index-cli.ts                # EXISTING — npm run brain:index
│   │   ├── query-index-cli.ts                # EXISTING — npm run brain:query
│   │   ├── indexing-secret-gate.ts           # EXISTING
│   │   ├── brain-index-manifest.json         # GENERATED at index time
│   │   ├── recall-inject.ts                  # NEW (A2) — query + trim + cite fence
│   │   └── retrieval/
│   │       └── query-index.ts                # EXISTING — top-k + quality weighting
│   └── agents/                               # PROTECTED — no Omniscient edits
│       ├── synthesis-adapter-llm.ts          # PROTECTED
│       ├── hook-adapter-llm.ts               # PROTECTED
│       ├── boss-adapter-llm.ts               # PROTECTED
│       └── run-chain.ts                      # PROTECTED
├── scripts/
│   ├── dashboard-sync.ts                     # EXISTING — EXTEND push (C1)
│   ├── run-dashboard-sync-cron.sh              # EXISTING — 3-min cron
│   ├── run-chain.ts                          # PROTECTED
│   ├── brain-recall-prefetch.mjs             # NEW (A4) — CLI for pre_llm_call plugin
│   ├── hermes-plugin-examples/               # NEW — version-controlled Hermes extensions
│   │   └── cns-brain-recall/
│   │       ├── plugin.py                     # pre_llm_call hook (SOURCE)
│   │       └── references/config-snippet.md  # plugins.enabled snippet (optional)
│   ├── install-hermes-plugin-cns-brain-recall.sh  # NEW (A4) — cp to ~/.hermes/plugins/
│   └── lib/
│       └── collect-internal-dev-state.ts     # NEW (C1) — shared FR20/FR21 collector
├── tests/
│   ├── brain/                                # EXISTING glob in vitest.config.ts
│   │   ├── recall-inject.test.ts             # NEW (A2/A3)
│   │   └── portal-embedder.test.ts           # NEW (A1)
│   └── hermes/                               # EXISTING glob
│       └── brain-recall-prefetch.test.ts     # NEW (A4) — optional CLI harness
├── vitest.config.ts                          # EXISTING — includes brain + hermes
└── _bmad-output/planning-artifacts/
    └── architecture-hermes-omniscient.md     # THIS DOC

Knowledge-Vault-ACTIVE/  (vault — read via MCP; digest reads some paths on WSL)
├── _meta/logs/agent-log.md                   # FR20/FR21 source
└── (fast-scan index path per vault contract) # FR20/FR21 source

_bmad-output/implementation-artifacts/        # FR20/FR21 WSL sources + config-story evidence
├── deferred-work.md
├── sprint-status.yaml
├── agent-log.md                              # if mirrored — prefer vault _meta path per PRD
└── <story-id>-<slug>-evidence.md             # REQUIRED for ~/.hermes config/env stories (B1, A4, D1)

~/.hermes/  (WSL — runtime; NOT in Omnipotent git)
├── config.yaml                               # EXTEND — auxiliary, tts, plugins.enabled
├── .env                                      # ELEVENLABS_API_KEY (ADR-014)
├── auth.json                                 # EXISTING — Portal OAuth
├── dashboard-sync.env                        # EXISTING — CONVEX_URL + DEPLOY_KEY
├── plugins/
│   └── cns-brain-recall/                     # INSTALLED (A4) — from install script
│       └── plugin.py                         # copy of repo source
├── memories/                                 # EXISTING
│   └── awareness-snapshot.json               # EXISTING (Epic 77)
└── skills/cns/                               # EXISTING — no new skill for auto-inject

cns-dashboard/
├── convex/
│   ├── schema.ts                             # EXTEND — internalDevState table (C1)
│   ├── validators.ts                         # EXTEND — internalDevStateValidator
│   ├── dashboard.ts                          # EXISTING — may extend ingest OR sibling mutation
│   ├── internalDevState.ts                   # NEW (C1) — ingest + query
│   ├── hermesAwareness.ts                    # EXISTING — unchanged boundary
│   ├── hermesPush.ts                         # EXISTING
│   └── http.ts                               # EXISTING — GET /hermes/awareness
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── hermes-trend-dispatch.ts      # EXISTING
│   │   │   ├── hermes-local-health.ts        # NEW (D1) — :9119 probe
│   │   │   └── hermes-local-proxy.ts         # NEW (D1) — WS/fetch proxy
│   │   └── components/nexus/
│   │       ├── NexusAwarenessPanel.svelte    # EXISTING
│   │       ├── DiscoveryWorkPanel.svelte     # NEW (C2) — FR21 panel
│   │       └── VoiceDrawer.svelte            # NEW (D1) — FR10 local-only
│   └── routes/
│       ├── nexus/
│       │   └── +page.svelte                  # EXTEND — mount drawer + discovery panel
│       └── api/nexus/hermes/
│           ├── health/+server.ts             # NEW (D1)
│           └── chat/+server.ts               # NEW (D1) — SPIKE-OMNI-001
└── tests/convex/
    └── internal-dev-state.test.ts            # NEW (C1)
```

### Architectural boundaries

**API boundaries:**

| Boundary | Endpoint / seam | Auth | Direction | Omniscient |
|----------|-----------------|------|-----------|------------|
| Brain prefetch | subprocess `brain-recall-prefetch.mjs` | Local WSL | Plugin → Omnipotent | **NEW** |
| FR18 inject | `pre_llm_call` hook | N/A | Hermes internal | **NEW** |
| Dev-state push | `ingestInternalDevState` | `CONVEX_DEPLOY_KEY` | WSL → Convex | **NEW** |
| Dev-state read | `getInternalDevState` query | Convex client | Browser ↔ Convex | **NEW** |
| FR12 awareness | `GET /hermes/awareness` | Bearer read key | WSL → Convex | EXISTING |
| FR12 push | Discord webhook | URL secret | Convex → Discord | EXISTING |
| Vault | `cns_vault_io` MCP | Gateway local | Hermes ↔ vault | EXISTING |
| Local voice/chat | `WS /api/ws` on `:9119` | Dashboard OAuth | Local Nexus server → WSL | **NEW** |
| Portal embeddings | Portal `/embeddings` | Portal JWT | WSL → Portal | **NEW** (A1) |

**Runtime zone firewall:**

| From → To | Allowed | Forbidden |
|-----------|---------|-----------|
| Vercel → WSL `:9119` | — | **All** (voice local-only) |
| Vercel → Convex | `useQuery` | mutations for dev-state ingest |
| WSL → Convex | push mutations (deploy key) | arbitrary reads beyond awareness DTO |
| Browser → Brain CLI | — | **All** (server/plugin only) |
| Convex → WSL files | — | **All** |
| Vercel → `~/.hermes/plugins/` | — | **All** (install from WSL only) |
| Git → `~/.hermes/` direct commit | — | **All** (operator paths via install script + evidence) |

**Three-zone boundary (normative):**

```
┌──────────────────────── ZONE 1 — WSL ────────────────────────────┐
│ Hermes gateway + dashboard :9119                                   │
│ ~/.hermes/ (config, .env, plugins — RUNTIME; not in Omnipotent git) │
│ Omnipotent.md: src/brain/, scripts/, hermes-plugin-examples/       │
│   git source ──install script──► ~/.hermes/plugins/cns-brain-recall │
│ dashboard-sync + dev-state collector ──push──►                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ push only (deploy key)
┌──────────────────────── ZONE 3 — Convex ─────────────────────────┐
│ internalDevState, hermesAwareness, HTTP /hermes/awareness          │
│ ◄── useQuery ── Zone 2          ◄── push ── Zone 1               │
└────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ useQuery (read-only panels)
┌──────────────────────── ZONE 2 — Vercel / Local Nexus ───────────┐
│ cns-dashboard /nexus — awareness + discovery panels                │
│ Local-only: $lib/server ──► 127.0.0.1:9119 (voice/chat)           │
│ ✗ no WSL file reads  ✗ no :9119 from deployed build              │
└────────────────────────────────────────────────────────────────────┘
```

Zone 1 owns recall inject, Brain index, Hermes operator config, and collector **source**. Zone 2 owns UI and local proxy **only when health gate passes**. Zone 3 owns **durable intelligence DTOs** consumed reactively — never WSL filesystem or `:9119`.

| Component | Owns | Must not |
|-----------|------|----------|
| `recall-inject.ts` | Score trim, citations, secret-gate drop | Hermes turn wiring |
| `cns-brain-recall` plugin (runtime) | Hook registration, channel detect, subprocess to prefetch CLI | Brain scoring logic |
| Plugin source (git) | `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` | Runtime-only edits without repo mirror |
| `install-hermes-plugin-cns-brain-recall.sh` | Copy git source → `~/.hermes/plugins/` | Hand-copy plugin files ad hoc |
| `collect-internal-dev-state.ts` | Parse + rank WSL artifacts | UI rendering |
| `DiscoveryWorkPanel.svelte` | Display Convex query | Direct file reads |
| `VoiceDrawer.svelte` | Local UI + server route calls | Hold API keys in browser |
| `dashboard-sync.ts` | Orchestrate collectors + push | Inline dev-state parsing (import lib) |

### Requirements → structure mapping (PRD §10 phases)

| Phase | FRs | Primary locations |
|-------|-----|-------------------|
| **A1** | FR16 | `src/brain/embedder.ts`, `build-index.ts`, `indexing-secret-gate.ts`, `tests/brain/` |
| **A2** | FR18 | `config/brain-recall-policy.json`, `src/brain/recall-inject.ts` |
| **A3** | FR19 | `tests/brain/recall-inject.test.ts`, golden set in `_bmad-output/` or `tests/fixtures/` |
| **A4-0** | FR18 gate | Repo plugin stub + `install-hermes-plugin-cns-brain-recall.sh` |
| **A4** | FR18 prod | Full `plugin.py` + `brain-recall-prefetch.mjs` wiring + evidence file |
| **B1** | FR14 | `~/.hermes/config.yaml` `auxiliary:` only + evidence file |
| **C1** | FR20, FR21 transport | `scripts/lib/collect-internal-dev-state.ts`, `convex/internalDevState.ts`, `dashboard-sync.ts` |
| **C2** | FR21 UI | `DiscoveryWorkPanel.svelte`, `nexus/+page.svelte` |
| **C1 digest** | FR20 | Morning digest cron script (WSL) imports same collector |
| **D1** | FR10 | `VoiceDrawer.svelte`, `api/nexus/hermes/*`, `~/.hermes/config.yaml` `tts:` + evidence file |

### Integration points and data flow

```
[VAULT corpus] ──index──► [Brain file index] ◄──query── [recall-inject.ts]
                                ▲                           │
                                │                           ▼
                         [Portal /embeddings]      [brain-recall-prefetch.mjs]
                                                         ▲
[WSL Hermes turn] ──pre_llm_call──► [cns-brain-recall plugin @ ~/.hermes/plugins/]
        │                                    ▲
        │                                    │ install from git
        │                          [scripts/hermes-plugin-examples/cns-brain-recall/]
        │                                    │
        │                                    └──► [brain-recall-prefetch.mjs] ──► [recall-inject.ts]
        │
        ├── MCP ──► Vault (manual tools — unchanged)
        └── awareness pull ──► Convex /hermes/awareness (unchanged)

[WSL repo + vault paths] ──collect──► [collect-internal-dev-state.ts]
        │                                      │
        ├──► [dashboard-sync cron] ──push──► Convex internalDevState
        └──► [07:00 digest cron] ──markdown──► digest artifact

[Local Nexus browser] ──► SvelteKit $lib/server ──► :9119/api/ws (voice/chat)
[Deployed Nexus browser] ──useQuery──► Convex (awareness + internalDevState)
                                      ✗ no :9119, ✗ no WSL files
```

### Development workflow integration

| Workflow | Command / path |
|----------|----------------|
| Brain index (dev) | `npm run brain:index` from Omnipotent root |
| Brain query (dev) | `npm run brain:query` |
| Dashboard sync (dev) | `npx tsx scripts/dashboard-sync.ts [--no-push]` |
| Prefetch CLI (dev) | `node scripts/brain-recall-prefetch.mjs --query "..." --channel standard_text` |
| Plugin install (dev) | `bash scripts/install-hermes-plugin-cns-brain-recall.sh` |
| Local Nexus | `npm run dev` in cns-dashboard (`localhost:5173`) |
| Verify gate | `bash scripts/verify.sh` (both repos) |
| Plugin enable | `hermes plugins enable cns-brain-recall` |

**Build/deploy:** No new deployable artifact in Omnipotent (library/scripts only). cns-dashboard deploys to Vercel as today; Convex schema push via existing `convex deploy` path.

---

## Project context (condensed)

Hermes Omniscient finishes Hermes Consolidation G4/G5/G7. Infrastructure is ~70% built (13 crons, Epic 77 awareness, vault MCP). The missing **felt intelligence** layer is semantic recall (StubEmbedder today) and cited auto-injection into every turn.

**Hard constraints carried forward:**

- Protect-list zero edits on run-chain adapters and engine
- No fork of `~/.hermes/hermes-agent` — supported extension seams only
- Context7 before Portal `/embeddings`, ElevenLabs/voice config, Honcho (NFR7)
- `bash scripts/verify.sh` gate; WriteGate on `AI-Context/AGENTS.md`; no `NEXUS_*` on cns-dashboard
- Reversibility (NFR5): embedder, injection, TTS provider — all config-reversible

---

## ADR-HERMES-001 — Amendment: JARVIS hosting topology

**Status:** **AMENDED** (supersedes consolidation doc § ADR-HERMES-001 locked table, 2026-06-24)

**Was (2026-06-24):**

| Surface | Role | Voice |
|---------|------|-------|
| Hermes Desktop / Discord | Primary conversational + voice JARVIS | Yes |
| Deployed Vercel `/nexus` | Awareness + async ask | No |
| Local Nexus embedded chat | Dev-local / tunnel opt-in (D3) | Optional |

**Now (2026-06-25 — brief-locked):**

| Surface | Role | Voice v1 |
|---------|------|----------|
| **Local Nexus** (`localhost:5173`) | Primary JARVIS — voice drawer, realtime chat, recall-injected turns | **Yes** |
| **Deployed Vercel `/nexus`** | Cockpit, trends, awareness, digest view, async ask via dispatch | **No** (mic UI hidden) |
| **Hermes Desktop / Discord** | Text + async; same recall substrate as Local Nexus | **Deferred v1** |
| **D3 embedded chat** | Absorbed into Local Nexus primary surface | Local-only |

**Rationale:** Operator wants a polished JARVIS pane in cns-dashboard with the same Brain recall as text. Vercel cannot reach WSL `:9119` without tunnel (Tailscale = v1.5). Desktop voice deferred to reduce surface area while recall spine ships.

**Implications:**

- Epic D2 voice stories move from WSL Desktop-first to **cns-dashboard Local Nexus drawer** (ADR-HERMES-013/014).
- ADR-HERMES-012 (D3 optional embedded chat) is **superseded** by Local Nexus as the canonical local embed path.
- Discord/Desktop remain valid **text** surfaces for FR18 injection (same `pre_llm_call` plugin — see ADR-HERMES-015).

---

## ADR-HERMES-013 — Local Nexus ↔ WSL Hermes reachability split

**Status:** **NEW — LOCKED**

### Decision

| Zone | Voice / realtime | Data path |
|------|------------------|-----------|
| **Local Nexus** (dev server `localhost:5173`, same machine as WSL) | Voice drawer **enabled** when backend health check passes | SvelteKit `$lib/server` routes proxy to **`http://127.0.0.1:9119`** (Hermes dashboard web server) |
| **Deployed Vercel `/nexus`** | Voice controls **not rendered** (NFR-VOICE-1) | Convex reactive queries only — no WSL file or `:9119` access |

### Rules

1. **Browser never holds `API_SERVER_KEY`** (inherits ADR-E46-003 / parent FR9). Server routes hold dashboard OAuth session or WS ticket; secrets in `$lib/server` / env only.
2. **Health gate:** Voice drawer mounts only after `$lib/server/hermes-local-health` (or equivalent) returns reachable `:9119` + auth gate satisfied. Deployed build skips probe → no dead mic.
3. **UI placement:** Drawer/panel on existing `/nexus` home — not a separate route (PRD §4.2).
4. **Hermes endpoint:** Target is the **dashboard web server** (`hermes dashboard`, port `9119`) — specifically `/api/ws` for chat and dashboard voice middleware — **not** the OpenAI-compatible `hermes gateway` API server. Context7 confirms `/api/ws` exists only on the dashboard process (`hermes_cli/web_server.py`); pointing at the gateway API port returns 404 for TUI control/voice.
5. **One codebase:** Same SvelteKit app deploys to Vercel and runs locally; behavior diverges on health gate + env, not forked repos.

### cns-dashboard additions (normative)

```
src/lib/server/hermes-local-proxy.ts      # fetch/WS proxy helpers, OAuth ticket
src/routes/api/nexus/hermes/health/+server.ts
src/routes/api/nexus/hermes/chat/+server.ts   # or WS upgrade proxy — see SPIKE-OMNI-001
src/lib/components/nexus/VoiceDrawer.svelte     # local-only mount
```

### Spike gate

**SPIKE-OMNI-001** (blocks FR10 story breakdown, not FR16/18/19): Prove server-side WS proxy from SvelteKit → `127.0.0.1:9119/api/ws` with dashboard OAuth — document ticket/cookie pattern from Hermes web-dashboard docs before implementing voice drawer.

---

## ADR-HERMES-014 — ElevenLabs TTS delivery path (OQ-1)

**Status:** **NEW — LOCKED** (Context7-verified 2026-06-25)

### Context7 findings

| Path | Provider backend | Voice catalog | Streaming |
|------|------------------|---------------|-----------|
| **Portal `managed_nous_feature: tts`** | **OpenAI TTS** via Tool Gateway (`openai-audio`) | 6 OpenAI voices (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) | Yes (OpenAI audio API) |
| **`tts.provider: elevenlabs`** + `ELEVENLABS_API_KEY` | **ElevenLabs direct** | Full ElevenLabs catalog (`voice_id`, `model_id`) | Yes — Hermes `stream_tts_to_speaker` sentence pipeline |
| **`tts.provider: edge`** | Microsoft Edge TTS (free) | 322 voices | Yes |

Source: `hermes_cli/tools_config.py` (TTS provider table), `hermes_cli/nous_subscription.py` (`tts_managed` only when `tts_current_provider == "openai"`), `tools/tts_tool.py` (`_resolve_openai_audio_client_config` for gateway; ElevenLabs requires direct key).

**Critical:** Portal managed TTS does **not** expose ElevenLabs. Selecting "Nous Subscription" for TTS sets `tts_provider: "openai"` — same discipline that caught `smart_model_routing` being inert: do not assume subscription covers ElevenLabs quality.

### Decision

**Primary (FR10): Direct ElevenLabs**

```yaml
# ~/.hermes/config.yaml (operator-owned, not in git)
tts:
  provider: elevenlabs
  elevenlabs:
    voice_id: "<operator-selected — JARVIS persona>"
    model_id: eleven_multilingual_v2
```

```bash
# ~/.hermes/.env (mode 0600)
ELEVENLABS_API_KEY=<direct key>
```

- **Python extras (Context7-verified — distinct packages):**
  - `pip install "hermes-agent[tts-premium]"` — installs `elevenlabs` SDK; **required for ElevenLabs TTS provider**
  - `pip install "hermes-agent[voice]"` — installs `sounddevice`, `numpy`; **CLI/dashboard STT capture path** (separate extra; not a substitute for `tts-premium`)
  - Local Nexus D1 story: confirm both extras at install step if push-to-talk STT + ElevenLabs TTS are in scope; `edge` fallback needs neither premium extra
- Context7 `query-docs` on voice config before story implementation (NFR7).

**Documented fallback chain**

| Priority | Provider | When |
|----------|----------|------|
| 1 | `elevenlabs` | Key present + `tts-premium` installed — **v1 target quality** |
| 2 | `edge` | Key missing, quota error, or operator toggle — **free fallback** (document in operator guide) |
| 3 | `openai` via Portal gateway | Optional cost-consolidation path — **not** FR10 primary; OpenAI voices only |

**Rejected for FR10 primary:** Portal-managed TTS as ElevenLabs substitute — wrong provider; fails the brief's quality bar ("ElevenLabs over `edge`").

**FR-GATE note:** Tool Gateway remains required for Firecrawl/web/image per ADR-HERMES-006. TTS gateway is orthogonal — ElevenLabs is a **direct-key** provider in Hermes v0.17.0.

**Reversibility (NFR5):** Operator may switch `tts.provider: edge` in config without code changes.

---

## ADR-HERMES-015 — FR18 cited auto-injection seam (OQ-9)

**Status:** **NEW — LOCKED** (Context7-verified 2026-06-25)

### Problem

FR18 requires **automatic**, **cited**, **per-channel-budgeted** Brain recall on every Hermes turn. The PRD specifies policy shape; this ADR selects the **Hermes-side delivery seam** only. Fetch/trim logic stays in `Omnipotent.md` `src/brain/` (additive).

### Candidate evaluation

| # | Seam | Verdict |
|---|------|---------|
| 1 | **Native `MemoryProvider.prefetch()`** | Technically fits (`memory_manager.prefetch_all` before tool loop). **Rejected for v1 primary** — Hermes allows **one external** memory provider; slot reserved for **Honcho (FR15, v1.5)**. Using `cns-brain` as external provider forces provider swap at v1.5. |
| 2 | **Gateway system-message layering** | **Rejected** — per-surface caller `system_message`; does not uniformly cover Discord, cron, and Local Nexus proxy without adapter sprawl. Recall also competes with prompt-cache stability (system prompt should stay stable per Hermes `pre_llm_call` docs). |
| 3 | **Always-on MCP `brain:query` tool** | **Rejected** — model may skip tool; not "automatic" per FR18; token overhead on every turn for tool schema. |
| **4** | **`pre_llm_call` plugin hook** | **SELECTED** — documented RAG integration seam; fires once per turn before tool loop; injects into **user message** (preserves system prompt cache); no core fork; no protect-list edits; **Honcho slot untouched**. |

Context7: `pre_llm_call` is the only hook whose return value injects context (`{"context": "..."}`). `turn_context.py` merges plugin context before `prefetch_all`.

### Decision

**In-repo-with-install:** Plugin **source** lives in `scripts/hermes-plugin-examples/cns-brain-recall/` (version controlled). Operator/runtime copy at `~/.hermes/plugins/cns-brain-recall/` is installed via `bash scripts/install-hermes-plugin-cns-brain-recall.sh` — same discipline as `scripts/hermes-skill-examples/` + `install-hermes-skill-*.sh`.

**Runtime registration:** `register(ctx)` → `ctx.register_hook("pre_llm_call", recall_hook)`; enable in `~/.hermes/config.yaml` `plugins.enabled` (config story must capture evidence file per § Implementation Patterns).

**No fork** of `~/.hermes/hermes-agent`. **No edits** to protect-list files or `src/agents/*`.

### Data flow

```
Hermes turn (Discord | Desktop | Local Nexus proxy | cron)
    │
    ▼
pre_llm_call hook (plugin)
    │  inputs: user_message, platform, session_id, …
    │  derives recall_channel (see below)
    ▼
subprocess: OMNIPOTENT_REPO/scripts/brain-recall-prefetch.mjs
    │  reads config/brain-recall-policy.json
    │  calls src/brain/ query + inject trim (citations, token budget)
    ▼
returns {"context": "<fenced cited recall block>"}
    │
    ▼
Hermes appends to user message → inference (+ native memory prefetch separately)
```

### Recall channel metadata path

| Channel | Detection rule |
|---------|----------------|
| `voice_pane` | `platform` hint `nexus-voice` **or** `recall_channel=voice_pane` in plugin kwargs — Local Nexus `$lib/server` proxy sets this on dashboard chat/WS metadata (**SPIKE-OMNI-002** if dashboard path cannot carry metadata → convention: prefix `[cns-recall:voice_pane]` stripped server-side) |
| `yapped_text` | `len(user_message) >= yapped_text_min_chars` from policy config |
| `standard_text` | default — all other text turns |

Wispr Flow output is indistinguishable from typed text (PRD §3) — length heuristic only.

### Omnipotent.md ownership (off protect-list)

| Path | Role |
|------|------|
| `config/brain-recall-policy.json` | Versioned per-channel budgets (FR18 shape) |
| `src/brain/recall-inject.ts` | Query + score trim + citation fence + secret-gate drop |
| `scripts/brain-recall-prefetch.mjs` | CLI entry for plugin subprocess (JSON stdout) |
| `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` | Hook source (git) |
| `scripts/install-hermes-plugin-cns-brain-recall.sh` | Install to `~/.hermes/plugins/` |
| `tests/brain/recall-inject.test.ts` | Policy + golden-set harness (FR19) |

### Shadow mode (FR19)

Policy flag `shadow_mode: true` → CLI logs would-inject block, returns empty context. Operator toggles for calibration pass.

### Reversibility (NFR5)

- Disable plugin: `hermes plugins disable cns-brain-recall` or remove hook registration.
- Revert to manual `brain:query` skill — no vault mutation.

### Protect-list + no-fork assertion

| Constraint | Satisfied |
|------------|-----------|
| No edits to `synthesis/hook/boss-adapter-llm.ts`, `run-chain.ts` | ✅ Injection is plugin + `src/brain/` only |
| No fork of Hermes core | ✅ `~/.hermes/plugins/` + `config.yaml` hooks only |
| Supported extension API | ✅ `pre_llm_call` documented in hooks + build-a-hermes-plugin guides |

### v1.5 note (Honcho)

When Honcho activates as external `MemoryProvider`, Brain recall **remains** on `pre_llm_call` — no provider slot conflict. Honcho prefetch and Brain recall both inject via separate mechanisms (Honcho via `prefetch_all`, Brain via plugin).

### A4-0 — Confirm-early: `pre_llm_call` mutation contract (not a blocker; first A4 task)

Shipped observability consumers (`observability/langfuse`, `observability/nemo_relay`) use `pre_llm_call` to **observe** (open trace spans) and typically return `None`. CNS Brain recall **must mutate** the API-call user message via return value.

**Verified mutation contract (Hermes v0.17.0 source + Context7):**

| Return shape | Effect |
|--------------|--------|
| `{"context": "<text>"}` | Text appended to **current turn's user message** at API call time |
| Plain non-empty `str` | Same as dict form |
| `None` / omit / empty | No injection (observer-only — langfuse/nemo pattern) |

**Runtime wiring (`conversation_loop.py`):** `plugin_user_context` from all `pre_llm_call` results is joined with `\n\n` and appended to `api_msg["content"]` for the current user turn only. **Session DB is not mutated** — injection is ephemeral (preserves prompt cache on system prompt).

**A4-0 acceptance (prove before A2/A3 depend on production injection):**

1. Minimal `~/.hermes/plugins/cns-brain-recall/` stub returns `{"context": "[brain-recall:probe]"}` on every turn.
2. Single Discord or `hermes chat` turn shows probe text in model-visible context (log or dispute UI).
3. Document return contract in story A4-0; only then wire `brain-recall-prefetch.mjs` subprocess.

---

## FR20 / FR21 — Internal dev-state transport (deployed Nexus)

**Status:** **NEW — LOCKED** (re-added; was incorrectly deferrable on deployed)

### Problem

Internal dev-state files live on **WSL/Omnipotent repo**:

- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_meta/logs/agent-log.md` (vault)
- `vault-fast-scan-index.md` (vault)

**Deployed Vercel `/nexus` cannot read these paths.** Assuming direct file access on deployed is a architecture bug.

### Decision — extend Epic 77 dashboard-sync path

Reuse the proven **WSL collector → Convex push → reactive query** pattern from Epic 42/77 (`scripts/dashboard-sync.ts` → `ingestDashboardSnapshot`).

```
┌─────────────────────────────────────────────────────────────┐
│ WSL (Omnipotent.md) — every 3 min (existing dashboard-sync  │
│ cron) + on-demand after session-close                      │
│   collectInternalDevState()  ← NEW shared module           │
│     · parse deferred-work, sprint-status, agent-log tail   │
│     · parse vault-fast-scan-index                          │
│     · rank + rationale (FR21)                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ CONVEX_DEPLOY_KEY (dashboard-sync.env)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Convex (cns-dashboard)                                     │
│   ingestInternalDevState mutation  ← NEW (or snapshot field) │
│   getInternalDevState query      ← NEW                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ useQuery (reactive)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ /nexus cockpit — Local AND Deployed Vercel                 │
│   DiscoveryWorkPanel.svelte (FR21)                           │
│   Digest internal block view (FR20) — same DTO section       │
└─────────────────────────────────────────────────────────────┘
```

### WSL-side collector (Omnipotent.md)

```
scripts/lib/collect-internal-dev-state.ts   # shared pure functions
scripts/dashboard-sync.ts                 # extend buildDashboardSnapshot OR
                                          # parallel push in same cron tick
```

**FR20 morning digest (07:00 WSL cron):** Calls **same collector** directly on WSL — no Convex round-trip required to **generate** digest markdown. Digest artifact may optionally mirror summary to Convex for deployed digest panel consistency.

**FR21 cockpit panel:** Reads **`getInternalDevState`** via Convex on both Local and Deployed — single source of truth for UI.

### Convex schema (cns-dashboard)

**Option selected:** New singleton table `internalDevState` (mirrors `vaultHealth` / `runChainStatus` pattern) rather than overloading `HermesAwarenessSnapshot` — keeps FR12 awareness DTO stable.

```typescript
// validators.ts (shape — tune in stories)
internalDevState: {
  collectedAt: number,
  prioritizedItems: Array<{
    rank: number,
    title: string,
    rationale: string,
    sourcePath: string,
    sourceKind: 'deferred' | 'sprint' | 'agent-log' | 'fast-scan',
  }>,
  sprintSummary: { inProgress: string[], blocked: string[] },
  deferredHighlights: string[],
  agentLogTail: Array<{ timestamp, action, summary }>,
}
```

### Push contract

| Field | Source |
|-------|--------|
| Cron | Existing `run-dashboard-sync-cron.sh` (3 min) — add dev-state push to same tick |
| Auth | `~/.hermes/dashboard-sync.env` — `CONVEX_URL` + `CONVEX_DEPLOY_KEY` (unchanged) |
| On-demand | After `session-close` vault write — optional trigger script (NFR-RECALL-2 alignment) |

### Explicit non-goals

- No Convex → WSL pull for dev-state (wrong direction)
- No Vercel server routes reading `/mnt/c/...` or repo paths
- FR21 **informs only** — no auto-triage or vault writes from panel

---

## Decision impact — implementation sequence

```
Phase A — Recall spine (P0, cannot slip)
  A1 PortalEmbedder + Brain index (FR16)
  A2 recall-inject.ts + brain-recall-policy.json (FR18 policy)
  A3 golden-set calibration + shadow mode (FR19)
  A4-0 pre_llm_call inject E2E proof (confirm-early)
  A4 cns-brain-recall pre_llm_call plugin (ADR-HERMES-015)

Phase B — Cost (P1, parallel)
  B1 auxiliary → Haiku (FR14)

Phase C — Morning intelligence (P2, after A)
  C1 collect-internal-dev-state + Convex push (FR20/FR21 transport)
  C2 digest enrichment using shared collector (FR20)
  C3 DiscoveryWorkPanel via getInternalDevState (FR21)

Phase D — Local voice (P3, slip allowed)
  D0 SPIKE-OMNI-001/002
  D1 ADR-HERMES-001/013/014 — VoiceDrawer + ElevenLabs + edge fallback (FR10)
```

**Gate:** No Phase D until A3 passes or operator waives with shadow mode documented.

---

## Spikes required before build

| ID | Blocks | Question |
|----|--------|----------|
| **SPIKE-OMNI-001** | FR10 proxy stories | Exact SvelteKit → `:9119/api/ws` auth ticket flow (server-held OAuth, no browser key) |
| **SPIKE-OMNI-002** | FR18 `voice_pane` channel | How Local Nexus chat path exposes `recall_channel` to `pre_llm_call` (metadata vs platform string convention) |

**Not spiked (resolved):** OQ-1 ElevenLabs path, OQ-9 injection seam, FR20/21 Convex transport.

---

## Secret table (additions)

| Secret | Location | Purpose |
|--------|----------|---------|
| `ELEVENLABS_API_KEY` | `~/.hermes/.env` | ADR-HERMES-014 direct TTS |
| `CONVEX_DEPLOY_KEY` | `~/.hermes/dashboard-sync.env` | FR20/21 push (existing) |
| Dashboard OAuth | `~/.hermes/.env` + server proxy | ADR-HERMES-013 Local Nexus chat |

No new secrets in git. No `NEXUS_*` on cns-dashboard.

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision compatibility:** ADR-HERMES-001 (amended), ADR-013 (local `:9119` proxy), ADR-014 (ElevenLabs direct), and ADR-HERMES-015 (`pre_llm_call` plugin) compose without conflict. Brain recall avoids the single external `MemoryProvider` slot (Honcho reserved for FR15 v1.5). FR20/21 WSL→Convex push respects the Vercel↔WSL firewall; deployed `/nexus` reads DTOs only. Portal managed TTS (OpenAI-only) and direct ElevenLabs key are mutually exclusive paths — no contradictory `tts` config.

**Pattern consistency:** In-repo-with-install for `cns-brain-recall` mirrors Hermes skills discipline. Naming (camelCase Convex, kebab-case scripts, PRD channel keys) aligns across ADRs, structure tree, and enforcement list. Config-story evidence requirement (B1, A4, D1) closes the operator-config audit gap that git-tracked policy alone cannot cover.

**Structure alignment:** Complete directory tree places plugin **source** under `scripts/hermes-plugin-examples/` with install script; runtime `~/.hermes/plugins/` is explicitly non-version-controlled. Three-zone boundary diagram matches API firewall table and data-flow diagram. Phase A→D mapping ties every FR to concrete paths in both repos.

### Requirements Coverage Validation ✅

**Epic/phase coverage (PRD §10):**

| Phase | FRs | Architectural support |
|-------|-----|----------------------|
| A | FR16, FR18, FR19 | PortalEmbedder, `recall-inject.ts`, policy config, A4-0 + plugin seam |
| B | FR14 | `auxiliary:` Haiku pin in `~/.hermes/config.yaml` |
| C | FR20, FR21 | Shared collector → `internalDevState` Convex → panel + digest |
| D | FR10 | VoiceDrawer + `$lib/server` proxy + ADR-014 TTS (spikes gate stories) |
| E (v1.5) | FR15, FR22 | Honcho slot + unified loop — documented defer; no v1 block |

**Functional requirements coverage:**

| FR | Status | Primary seam |
|----|--------|--------------|
| FR16 | ✅ | `src/brain/` PortalEmbedder + index cron |
| FR18 | ✅ | ADR-015 `pre_llm_call` + `brain-recall-prefetch.mjs` |
| FR19 | ✅ | Golden-set harness + `shadow_mode` in policy config |
| FR14 | ✅ | B1 auxiliary block |
| FR20 | ✅ | Collector + digest enrichment (WSL local read) |
| FR21 | ✅ | Convex `getInternalDevState` + DiscoveryWorkPanel |
| FR10 | ✅ (spike-gated) | ADR-013/014; SPIKE-OMNI-001/002 before D stories |
| FR15, FR22 | ⏸ v1.5 | Explicit defer; architecture does not block v1 epics |

**Non-functional requirements coverage:**

| NFR | Architectural response |
|-----|------------------------|
| NFR2 protect-list | Zero-edit list + enforcement guidelines |
| NFR5 reversibility | Plugin disable, policy flags, embedder toggle |
| NFR7 Context7 | Mandatory gate on Portal/voice/Honcho |
| NFR-RECALL-1..4 | Per-channel policy config + secret-gate on index |
| NFR-VOICE-1 | Health gate; voice UI local-only |
| NFR6 cost | FR14 auxiliary + per-turn injection budgets (FR19) |

**Parent carry-forward:** Inherited ADR-002/003/004/006 unchanged; Omniscient amends only ADR-001 and adds 013–015.

### Implementation Readiness Validation ✅

**Decision completeness:** All four must-resolve items closed (OQ-1 → ADR-014, OQ-9 → ADR-015, FR20/21 transport, ADR-001 amendment). `pre_llm_call` mutation contract documented (`{"context": "..."}`). Hermes v0.17.0 assumed; no core fork.

**Structure completeness:** Full tree for Omnipotent.md, `~/.hermes/` runtime, cns-dashboard, and vault read paths. Component boundaries separate Brain logic, plugin shim, collector, and UI. Integration points table covers prefetch CLI, Convex push/query, awareness (unchanged), and local voice proxy.

**Pattern completeness:** 14 conflict points addressed in § Implementation Patterns. Good/anti-pattern examples include plugin install discipline and evidence-file requirement. Enforcement list (9 items) is agent-actionable.

### Gap Analysis Results

**Critical gaps:** None — epics drafting may proceed.

**Important gaps (story gates, not architecture holes):**

| Item | Gates | Notes |
|------|-------|-------|
| **A4-0** | A4 production inject enable | Confirm-early; first A4 task |
| **SPIKE-OMNI-001** | FR10 proxy stories | WS/auth ticket to `:9119/api/ws` |
| **SPIKE-OMNI-002** | `voice_pane` channel metadata | May refine `nexus-voice` platform hint |
| **A3 calibration** | Phase D (or operator waiver) | Golden-set location at story time |
| **NFR3 embedder audit** | A1 story | Inherited from parent; before Portal switch |

**Nice-to-have (defer to stories):**

- Golden-set fixture path (`tests/fixtures/` vs `_bmad-output/`)
- `cns-dashboard/project-context.md` ADR table sync at implementation start
- Optional `tests/hermes/brain-recall-prefetch.test.ts` CLI harness

### Validation Issues Addressed

No contradictory decisions required resolution during validation. Minor naming note (`embedder-portal.ts` vs export from `embedder.ts`) is already documented as implementer choice — both stay under `src/brain/`.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall status:** **READY FOR IMPLEMENTATION** (epics + build; A4-0 and spikes gate specific stories, not architecture completeness)

**Confidence level:** High

**Key strengths:**

- OQ-1 and OQ-9 resolved before recall stories enter build
- Recall-first sequencing with explicit FR10 slip valve
- Three-zone firewall with normative diagram
- Plugin in-repo-with-install + config evidence pattern
- Protect-list and no-core-fork constraints preserved end-to-end
- Parent consolidation ADRs inherited without schema breaks

**Areas for future enhancement:**

- Honcho external memory provider (FR15 v1.5)
- Unified Loop run-chain (FR22 v1.5)
- Desktop/Discord voice and Tailscale remote voice
- SPIKE-OMNI-002 may refine voice-pane channel detection

### Implementation Handoff

**AI agent guidelines:**

- This document amends parent `architecture-hermes-consolidation.md` for Omniscient scope
- Respect protect-list; Brain logic in `src/brain/`; Hermes delivery via repo plugin + install script
- Config stories (B1, A4, D1) require evidence markdown per § Process patterns
- Context7 before Portal embeddings, TTS, Honcho; `verify.sh` before every commit
- No Phase D until A3 passes or operator documents shadow-mode waiver

**First implementation priority:**

```
Phase A parallel start:
  A4-0 — pre_llm_call inject E2E proof (confirm-early)
  A1   — PortalEmbedder + brain:index reindex
Then A2 → A3 → A4 prod plugin; B1 parallel OK early
```

**Next BMAD step:** `/bmad-create-epics-and-stories` — inputs: `prds/prd-CNS-2026-06-25/prd.md` + this document + parent `architecture-hermes-consolidation.md`

---

## References

- Context7 `/nousresearch/hermes-agent` — `pre_llm_call` hook, TTS provider table, voice-mode config
- `~/.hermes/hermes-agent/agent/turn_context.py` — plugin injection + prefetch order
- `~/.hermes/hermes-agent/hermes_cli/nous_subscription.py` — `tts_managed` OpenAI-only guard
- `scripts/dashboard-sync.ts` — Epic 77 push precedent
- `cns-dashboard/convex/dashboard.ts` — `ingestDashboardSnapshot` pattern
