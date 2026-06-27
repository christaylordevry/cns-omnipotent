---
stepsCompleted:
  - step-01-requirements-extraction
  - step-02-design-epics
  - step-03-create-stories
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md
  - _bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/addendum.md
  - _bmad-output/planning-artifacts/architecture-hermes-omniscient.md
  - _bmad-output/planning-artifacts/architecture-hermes-consolidation.md
  - project-context.md
operatorConstraints:
  epic_order: "Phase A (FR16/18/19) → B1 (FR14, parallel early) → C (FR20/21) → D (FR10, spike-gated) → E (v1.5 FR15/22)"
  a4_0_first: true
  phase_d_gate: "A3 calibration pass OR shadow mode + operator waiver"
  recall_first: true
  fr10_slip_valve: true
  protect_list_zero_edits: true
  plugin_in_repo_with_install: true
  evidence_file_pattern: "_bmad-output/implementation-artifacts/<story-id>-<slug>-evidence.md"
epicAliases:
  A: 79
  B1: 80
  C: 81
  D: 82
  E1: 83
  E2: 84
  E3: 85
parentEpics: "74-78 (Hermes Consolidation — FR10/FR14/FR16 superseded or relocated here)"
sequencing: "79 (P0, cannot slip) → 80 (parallel OK early) → 81 (after A tail) → 82 (A3 gate + spikes; slip valve) → 83-85 (v1.5)"
---

# CNS — Hermes Omniscient - Epic Breakdown

## Overview

This document decomposes the Hermes Omniscient (Hands-Off JARVIS) initiative into implementable epics and stories. It continues Hermes Consolidation — finishing G4/G5/G7 felt intelligence (recall, digest, local voice, cost routing).

**Parent artifacts:** `prd-CNS-2026-06-25`, `architecture-hermes-omniscient.md`, `architecture-hermes-consolidation.md` (ADR-HERMES-001..012 inherited; 001 amended, 013–015 new).

## Requirements Inventory

### Functional Requirements

```
FR10: Local Nexus voice pane — The operator can speak to Hermes from Local Nexus (`localhost:5173`) and receive streaming spoken responses with the same recall and memory substrate as text. Push-to-talk via faster-whisper STT; streaming ElevenLabs TTS; SvelteKit `$lib/server` routes proxy to `127.0.0.1:9119`; transcript UI with recall citations; deployed Vercel `/nexus` does not render voice controls; FR18 `voice_pane` channel budget applies. Always-on duplex voice is out. Designated v1 slip-to-v1.5 candidate.

FR14: Auxiliary tasks on Haiku — Hermes auxiliary side-work runs on a cheap model (`anthropic/claude-haiku-4.5` or successor); main conversational model reserved for operator-facing turns. Pin `compression`, `approval`, `skills_hub`, `mcp`, `title_generation`, `triage_specifier` under `auxiliary:` in `~/.hermes/config.yaml`. Verify via logs/test harness that auxiliary tasks do not fall through to Sonnet 4.6. Remove or comment out inert `smart_model_routing` block; document deprecation. Reversible via config.

FR15: Progressive operator learning (v1.5) — Hermes compounds operator model and memory across sessions without manual session-close as the only feed. Configure Honcho dialectic user-modeling; raise `memory_char_limit` / `user_char_limit`; verify native memory persists across sessions; automate `session-close` feeding memory. Optional v1 parallel: auto session-close cron if ≥80% milestone is hard target.

FR16: Production semantic recall — The operator can query vault knowledge semantically without supplying file paths. Hermes conversations automatically receive cited recall context governed by a tunable recall policy. PortalEmbedder implements `Embedder`; `brain:index` produces non-stub vectors via Portal `/embeddings` (Context7 before implement). `brain:query` returns relevant vault paths with scores; zero dead-end "I don't know" without follow-up on vault-groundable questions. `indexing-secret-gate.ts` excludes secrets/protected zones; allowlist honored. Index rebuild incremental on changed notes; full reindex on embedder model change; embed cost guarded (vector cache per content hash). Batched incremental rebuild on cron (15–30 min) + on-demand after high-signal vault writes. `brain-recall-policy.json` at repo-known path — versioned, documented, reversible.

FR18: Cited auto-injection into Hermes context — Each Hermes turn automatically loads relevant Brain recall into working context with visible vault path citations, governed by the active recall channel budget. Recall loads without operator invoking a skill or `brain:query` manually. Every injected chunk includes vault path citation. Injection stops when channel token budget is exhausted (fetch may over-retrieve; inject trims by score). Channel detection: `voice_pane` | `yapped_text` (length ≥ `yapped_text_min_chars`) | `standard_text`. Injected context visible in UI or logged for operator audit. Architecture seam: `pre_llm_call` Hermes plugin (ADR-HERMES-015) — not protect-list adapters.

FR19: Post-embedder recall calibration — After PortalEmbedder ships and Brain index is rebuilt, operator runs calibration pass before cited auto-injection goes live in production Hermes. Golden query set: ≥10 operator-curated prompts with expected source paths. Calibration harness runs `brain:query` + injection trim per channel; reports precision@k and token use. Operator tunes `min_score_threshold` and per-channel budgets until golden set passes. Calibration artifacts logged (config version + pass date); re-run on embedder model change or >20% corpus ingest. Until calibration passes, auto-injection may run in shadow mode (log would-inject, don't inject). Policy numbers are config-tunable — not PRD-hardcoded.

FR20: Morning digest automation and enrichment — The morning cockpit surfaces an enriched digest without operator-triggered skills. Internal dev-state block added to digest pipeline: scan `deferred-work.md`, `sprint-status.yaml`, `agent-log.md` (recent tail), `vault-fast-scan-index.md` → structured section. External reliability: watchdog/retry hardening for existing trend ingest paths (news, reddit, google-trends) — no regression on 07:00 delivery. Digest output consumable by Local and Deployed Nexus cockpit panels. Informs only — no autonomous execution. Must extend existing 07:00 morning-digest cron and reconcile with existing `push-digest-watchdog` crons (07:15 / 13:00 / 18:30 Australia/Sydney) — extend, don't duplicate.

FR21: Internal dev-state discovery surface — The morning cockpit shows a prioritized work list derived from internal project state without operator running triage skills. Scan sources: `deferred-work.md`, `sprint-status.yaml`, `agent-log.md`, vault fast-scan index. Output: prioritized list with links/paths and visible rank rationale. Surface: morning cockpit panel on `/nexus` (local and deployed) — not separate Discord push in v1. Informs only — no auto-triage, vault writes, or skill invocation. Shares scan logic with FR20 internal block (single collector, two consumers). Deployed Nexus reads via Convex `getInternalDevState` (WSL collector → push).

FR22: Unified Loop run-chain (v1.5) — Compose Discover + Build + adversarial Verify + governed Persist into one schedulable cycle. Reuse existing adversarial skills (`bmad-code-review`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`). Worktree handoff exists (`EnterWorktree`); persistence exceeds WriteGate/PAKE/audit. Build move approval-gated — no silent vault corruption. Kanban + trend-fusion cockpit and Tailscale remote voice land in same v1.5 tranche.
```

### NonFunctional Requirements

```
NFR1: `bash scripts/verify.sh` exits 0 before every commit (+ cns-dashboard `npm test` when sibling present; override with `CNS_DASHBOARD_ROOT`).

NFR2: Protect-list zero edits: `src/agents/synthesis-adapter-llm.ts`, `src/agents/hook-adapter-llm.ts`, `src/agents/boss-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`. Recall additive in `src/brain/`; voice in cns-dashboard + `~/.hermes/config.yaml`. No fork of `~/.hermes/hermes-agent` core.

NFR3: Brain index integrity: `brain:index` / `brain:query` work post-PortalEmbedder; embedder behind flag.

NFR4: No secrets in git; dashboard secrets in `$lib/server`; no `NEXUS_*` env vars on cns-dashboard.

NFR5: Reversibility: embedder, auto-injection, Honcho, auxiliary routing, TTS provider — all config-reversible. Each story must flag reversibility in ACs.

NFR6: Cost: auxiliary never on main model; injection cost bounded per turn (FR19 policy).

NFR7: Context7 mandatory before Portal `/embeddings`, ElevenLabs/voice config, Honcho — `resolve-library-id` → `query-docs` before implement.

NFR8: WriteGate: never directly edit `AI-Context/AGENTS.md`; route via session-close.

NFR-RECALL-1: Recall policy enforces separate `max_injection_tokens` per channel; voice_pane < standard_text < yapped_text. Values live in config only.

NFR-RECALL-2: Incremental index no older than configurable SLA (default target ≤30 min under normal cron); on-demand rebuild within configurable timeout after session-close.

NFR-RECALL-3: Embedder + auto-injection behind flags; revert to StubEmbedder / manual recall without vault mutation.

NFR-RECALL-4: Injected chunks without resolvable vault path are dropped; injection never includes secret-gate-excluded paths.

NFR-VOICE-1: Voice pane activates only on Local Nexus with reachable WSL Hermes (`:9119` health gate).

NFR-VOICE-2: No silent execution — Hermes announces actions; destructive ops require approval.

NFR-GOV-1: No silent execution v1; Hermes announces actions; destructive ops require approval.

NFR-GOV-2: Auto-indexing respects `indexing-secret-gate.ts` + corpus allowlist; no secrets in Brain index. Index/secret-gate stories must assert coverage.

NFR-PKG-1: No npm/pip package < 14 days old without operator approval.
```

### Additional Requirements

```
- Brownfield extension only — no greenfield scaffold; first stories are A4-0 + A1, not `create-*` CLI (architecture § Starter Template Evaluation).

- A4-0 is the FIRST Phase A task: prove `pre_llm_call` MUTATION on one live turn (stub returns `[brain-recall:probe]`, confirm it reaches API user message) BEFORE any recall depends on it. A1 PortalEmbedder may run in parallel.

- ADR-HERMES-001 amended: Local Nexus primary voice v1; Desktop/Discord voice deferred; Deployed Vercel awareness-only for voice.

- ADR-HERMES-013: SvelteKit `$lib/server` → `127.0.0.1:9119`; voice UI local-only-activated; browser never holds `API_SERVER_KEY`; target dashboard `/api/ws` not gateway API port.

- ADR-HERMES-014: ElevenLabs direct via `ELEVENLABS_API_KEY` in `~/.hermes/.env`; `tts.provider: elevenlabs`; `edge` documented fallback; Portal managed TTS is OpenAI-only.

- ADR-HERMES-015: FR18 seam = `pre_llm_call` plugin `cns-brain-recall`; Honcho external MemoryProvider slot preserved for v1.5.

- Plugin in-repo-with-install: source at `scripts/hermes-plugin-examples/cns-brain-recall/` + `scripts/install-hermes-plugin-cns-brain-recall.sh`; runtime at `~/.hermes/plugins/` is INSTALLED copy (not git). Never hand-edit runtime without repo mirror + reinstall.

- Config/plugin stories (B1, A4, D1) carry EVIDENCE FILE as done-proof (`_bmad-output/implementation-artifacts/<story-id>-<slug>-evidence.md`, Epic 74 pattern): redacted config keys, `hermes plugins list`, install output — no secrets in git.

- Each story names ZONE/REPO: Omnipotent.md (`src/brain`, `scripts`) | `~/.hermes` (plugin/config, evidence-verified) | cns-dashboard (Convex, voice). Lead commit instructions with repo+branch.

- SPIKE-OMNI-001 (SvelteKit → `:9119/api/ws` OAuth ticket) + SPIKE-OMNI-002 (`voice_pane` channel metadata) are Phase D pre-work — scheduled AFTER recall, gating FR10 only. No Phase D story starts until A3 calibration passes (or shadow mode + operator waiver).

- Recall-first: FR16/18/19 NEVER slip; FR10 is designated slip-to-v1.5 valve.

- FR20/21 transport: extend Epic 77 `dashboard-sync` → Convex `internalDevState` table; shared `scripts/lib/collect-internal-dev-state.ts`; WSL digest reads collector locally; deployed panel reads Convex.

- Dev-state push on existing 3-min `run-dashboard-sync-cron.sh` tick — extend, don't spawn second cron unless operator approves.

- C1 digest: reconcile FR20 reliability with EXISTING `push-digest-watchdog` crons (07:15 / 13:00 / 18:30 AEST) — extend, don't duplicate.

- B1 auxiliary: watch `triage_specifier` + `skills_hub` on Haiku — they affect routing; revert just those keys if misrouting.

- FR19 recall policy stays config-tunable (`brain-recall-policy.json`) — no PRD-hardcoded numbers; calibrate post-embedder.

- Brain prefetch CLI stdout JSON contract: `{ context, citations, channel, shadow }` — plugin reads `context` only.

- Recall channel platform hint `nexus-voice` for Local Nexus proxy (SPIKE-OMNI-002 may refine).

- Shadow mode: `brain-recall-policy.json` `shadow_mode: true` logs full inject payload, returns empty context.

- Inherited parent ADRs unchanged unless amended: ADR-HERMES-002 (awareness pull), 003 (Discord push), 004 (run-chain Anthropic key), 006 (Portal paid tier).

- v1.5 defer explicit: Honcho MemoryProvider, Unified Loop FR22, kanban/trend-fusion, Tailscale remote voice, FR10 if slipped.

- No client-side Brain query from browser; no Convex mutations from deployed UI for dev-state ingest.

- Hermes v0.17.0 — operator-managed; do not auto-upgrade mid-initiative.

- Python extras for voice: `hermes-agent[tts-premium]` for ElevenLabs; `hermes-agent[voice]` for STT capture path.
```

### UX Design Requirements

```
(No dedicated Omniscient UX spec — voice drawer extends existing `/nexus` home per PRD §4.2 and architecture. Inherits `nexus-theme.css` / Epic 63 cockpit patterns.)

UX-DR1: Voice drawer/panel on existing `/nexus` home route — not a separate route; mounts only when local Hermes backend health check passes (no dead mic on deployed Vercel).

UX-DR2: Transcript UI shows turn history; recall citations visible on disputed answers (FR18 trust line).

UX-DR3: DiscoveryWorkPanel on `/nexus` cockpit — prioritized internal work list with rank rationale visible (not black-box); reactive via Convex `useQuery(getInternalDevState)`.

UX-DR4: Digest internal dev-state block consumable in cockpit panels (Local and Deployed) — same DTO section as FR21 where practical.

UX-DR5: Styling inherits Tailwind 4 + `nexus-theme.css` (ADR-E46-002); ECharts via `EChartsPanel.svelte` only; no new design system.

UX-DR6: Deployed Vercel `/nexus` — voice controls not rendered; async ask + awareness unchanged.

UX-DR7: Local-only feature divergence via health gate + env — one codebase, not forked repos.
```

### FR Coverage Map

```
FR10: Epic 82 — Local Nexus JARVIS voice drawer (slip-to-v1.5 valve; supersedes Epic 78 D2 Desktop-first voice)
FR14: Epic 80 — Auxiliary → Haiku (supersedes Epic 78 per-skill routing; smart_model_routing retired)
FR15: Epic 83 — Honcho + memory budgets + automated session-close (v1.5)
FR16: Epic 79 — PortalEmbedder + production Brain index
FR18: Epic 79 — Recall policy, cited auto-injection, pre_llm_call plugin seam
FR19: Epic 79 — Golden-set calibration + shadow mode gate
FR20: Epic 81 — Morning digest enrichment + external reliability (extends 07:00 cron + watchdog crons)
FR21: Epic 81 — Discovery cockpit panel via Convex dev-state transport
FR22: Epic 84 — Unified Loop run-chain (v1.5, approval-gated)
(brief) Kanban + trend-fusion + Tailscale remote voice: Epic 85 (v1.5); FR10 if slipped from v1

NFR1: All epics — verify.sh (+ cns-dashboard npm test for Convex/voice stories)
NFR2: All epics — protect-list + no Hermes core fork AC
NFR3: Epic 79 story A1 — embedder/index integrity before production switch
NFR4: Epics 79, 80, 82 — secret placement; evidence files redacted
NFR5: Epics 79, 80, 82, 83 — reversibility flag per story
NFR6: Epics 79, 80 — injection budgets + auxiliary never on main model
NFR7: Epics 79, 82, 83 — Context7 before Portal embeddings, voice, Honcho
NFR8: Epic 83 — session-close / WriteGate on constitution updates
NFR-RECALL-1..4: Epic 79
NFR-VOICE-1..2: Epic 82
NFR-GOV-1: Epics 79, 82, 84
NFR-GOV-2: Epic 79 story A1 — secret-gate + allowlist on index
NFR-PKG-1: All epics — dependency age gate

UX-DR1, UX-DR2, UX-DR6, UX-DR7: Epic 82
UX-DR3, UX-DR4: Epic 81
UX-DR5: Epics 81, 82
```

## Epic List

### Epic 79 (Phase A): Felt Recall — Semantic Brain + Cited Auto-Injection

Chris asks vague questions on any Hermes surface and gets **grounded, cited** answers without path-hunting, skill names, or dead-end "I don't know" on vault-groundable topics. This is the v1 spine — **cannot slip**.

**Alias:** Phase A · **FRs:** FR16, FR18, FR19 · **NFRs:** NFR-RECALL-1..4, NFR3, NFR5, NFR7, NFR-GOV-2 · **Repos:** Omnipotent.md (`src/brain/`, `config/`, plugin source) + `~/.hermes` (plugin install, evidence)

**Story themes (Step 3):** A4-0 `pre_llm_call` inject probe (FIRST) ∥ A1 PortalEmbedder → A2 policy + `recall-inject.ts` → A3 golden-set calibration → A4 production `cns-brain-recall` plugin + prefetch CLI

**Standalone value:** Text surfaces (Discord, Desktop, async ask) deliver "knows everything" via cited recall even if voice never ships.

**Depends:** Hermes Consolidation Epics 74–77 live (Portal, dashboard-sync precedent). **Blocks:** Epic 82 (voice uses same inject substrate); Epic 81 may overlap A tail per PRD.

---

### Epic 80 (Phase B / B1): Cost-Effective Auxiliary Routing

Hermes runs compression, triage, skills hub, MCP, titles, and approval on **Haiku** while reserving Sonnet for operator-facing turns — no rationing anxiety on side work.

**Alias:** Phase B1 · **FRs:** FR14 · **NFRs:** NFR5, NFR6 · **Repos:** `~/.hermes/config.yaml` (evidence file required)

**Story themes:** Pin `auxiliary:` block; verify logs; retire `smart_model_routing`; watch `triage_specifier` + `skills_hub` for misrouting (revert those keys only if needed).

**Standalone value:** Cost posture improves immediately; no dependency on recall or voice.

**Depends:** Epic 74 Portal login. **Parallel:** May start early alongside Epic 79.

---

### Epic 81 (Phase C): Morning Intelligence — Digest Enrichment + Discovery Surface

Chris opens `/nexus` unprompted and the cockpit already shows **enriched morning digest** (external trends + internal dev-state) and a **prioritized work list** with visible rationale — informs only, no autonomous execution.

**Alias:** Phase C · **FRs:** FR20, FR21 · **UX-DRs:** UX-DR3, UX-DR4, UX-DR5 · **Repos:** Omnipotent.md (collector, digest, dashboard-sync extend) + cns-dashboard (Convex `internalDevState`, `DiscoveryWorkPanel`)

**Story themes:** Shared `collect-internal-dev-state.ts` → Convex push on existing 3-min sync; digest internal block + watchdog reconciliation (07:15/13:00/18:30 — extend, don't duplicate); cockpit panel via `useQuery`.

**Standalone value:** Proactive cockpit (SM-2) without recall or voice.

**Depends:** Epic 79 recall spine preferred complete; may overlap A tail. **Does not require:** Epic 82.

---

### Epic 82 (Phase D): Local Nexus JARVIS Voice

Chris speaks to Hermes from **Local Nexus** (`localhost:5173`) with push-to-talk in, streaming ElevenLabs TTS out, transcript + citations — same recall substrate as text. Deployed Vercel shows no mic.

**Alias:** Phase D · **FRs:** FR10 · **UX-DRs:** UX-DR1, UX-DR2, UX-DR5, UX-DR6, UX-DR7 · **NFRs:** NFR-VOICE-1..2, NFR4, NFR5, NFR7 · **Repos:** cns-dashboard (drawer, proxy routes) + `~/.hermes` (tts config, evidence)

**Story themes:** D0 SPIKE-OMNI-001/002 (WS auth + `voice_pane` metadata) → D1 VoiceDrawer + ADR-013/014.

**Standalone value:** Full JARVIS presence on local surface; text recall still delivers v1 promise if this epic slips to v1.5.

**Gate:** Epic 79 A3 calibration pass **OR** shadow mode + operator waiver. **Slip valve:** First epic cut under scope pressure.

**Depends:** Epic 79 (FR18 `voice_pane` channel); spikes before proxy stories.

---

### Epic 83 (Phase E1 / v1.5): Operator Learning Loop

Hermes compounds operator preferences and workflow patterns across sessions without manual session-close as the only memory feed.

**Alias:** Phase E1 · **FRs:** FR15 · **NFRs:** NFR5, NFR7, NFR8 · **Repos:** `~/.hermes` (Honcho config, memory limits) + vault via session-close

**Story themes:** Honcho dialectic config (Context7); memory budget raise; automated session-close trigger; cross-session recall verification.

**Depends:** Epic 79 recall foundation shipped. **Preserves:** Honcho external MemoryProvider slot — Brain recall stays on `pre_llm_call`.

---

### Epic 84 (Phase E2 / v1.5): Unified Loop — Discover, Build, Verify, Persist

Operator runs an approval-gated composed cycle (Discover → Build → adversarial Verify → governed Persist) reusing existing BMAD review skills — no silent vault corruption.

**Alias:** Phase E2 · **FRs:** FR22 · **NFRs:** NFR-GOV-1, NFR2 · **Repos:** Omnipotent.md (run-chain governance, skills) — **protect-list untouched**

**Story themes:** Schedule composed run-chain; wire adversarial skills; approval gates on Build; WriteGate/PAKE persist path.

**Depends:** Epics 79, 81 (discover transport); Epic 83 preferred for memory feed.

---

### Epic 85 (Phase E3 / v1.5): Cockpit Fusion + Remote Voice

Kanban + trend-fusion cockpit and Tailscale remote voice complete the v1.5 tranche; absorbs **FR10** if slipped from Epic 82.

**Alias:** Phase E3 · **FRs:** FR10 (if slipped) · **Brief scope:** kanban, trend-fusion, Tailscale · **Repos:** cns-dashboard + WSL tunnel config

**Depends:** Epics 81, 82 or deferred FR10. **Deferred detail:** Story breakdown at v1.5 gate per brief.

---

## Sequencing Summary

```
Epic 79 (A) ─────────────────────────────► P0 spine; A4-0 first; NEVER slip
     │
     ├──► Epic 80 (B1) ───────────────────► parallel OK from early v1
     │
     ├──► Epic 81 (C) ────────────────────► after A tail; overlap OK
     │
     └──► Epic 82 (D) ────────────────────► A3 gate + SPIKE-OMNI-*; slip valve

Epic 83 (E1) ──► Epic 84 (E2) ──► Epic 85 (E3)     v1.5 tranche
```

**Parent supersession notes:**
- Epic 78 FR10 (Desktop voice) → relocated to Epic 82 (Local Nexus) per ADR-HERMES-001 amendment
- Epic 78 FR14 (per-skill routing) → superseded by Epic 80 `auxiliary:` block
- Consolidation FR16 stretch → promoted to Epic 79 P0 gate

---

## Epic 79: Felt Recall — Semantic Brain + Cited Auto-Injection

Chris asks vague questions on any Hermes surface and gets **grounded, cited** answers without path-hunting, skill names, or dead-end "I don't know" on vault-groundable topics.

### Story 79-1: A4-0 — `pre_llm_call` inject probe (confirm-early)

As an **operator**,
I want **a minimal `cns-brain-recall` plugin stub that returns `[brain-recall:probe]` on one live Hermes turn**,
So that **the ADR-HERMES-015 mutation contract is proven before recall production depends on it (A4-0 gate)**.

**Zone/Repo:** Omnipotent.md (`scripts/hermes-plugin-examples/cns-brain-recall/`, install script) → WSL `~/.hermes/plugins/` · **Branch:** `hermes-consolidation` (Omnipotent.md)

**Acceptance Criteria:**

**Given** Context7 `resolve-library-id` + `query-docs` on `/nousresearch/hermes-agent` for `pre_llm_call` hook return shape
**When** `bash scripts/install-hermes-plugin-cns-brain-recall.sh` installs stub `plugin.py` returning `{"context": "[brain-recall:probe]"}` and `hermes plugins enable cns-brain-recall` runs
**Then** one live Discord or `hermes chat` turn shows probe text in model-visible context (log excerpt or dispute capture)
**And** protect-list files (`src/agents/*`, `run-chain.ts`, `scripts/run-chain.ts`) have zero diffs (NFR2)
**And** no edits under `~/.hermes/hermes-agent/` (no core fork)
**And** evidence file `_bmad-output/implementation-artifacts/79-1-a4-0-inject-probe-evidence.md` records: install output, redacted `hermes plugins list`, probe turn proof — no secrets (NFR4)
**And** **Reversibility (NFR5):** `hermes plugins disable cns-brain-recall` documented in evidence
**And** `bash scripts/verify.sh` passes (NFR1)

**Parallel OK:** May run concurrently with Story 79-2; must complete before Story 79-5 production wiring.

---

### Story 79-2: PortalEmbedder + production Brain index

As an **operator**,
I want **real Portal `/embeddings` vectors in the Brain index with secret-gate and allowlist enforcement**,
So that **semantic recall returns meaningful scores instead of StubEmbedder fake vectors (FR16, NFR3, NFR-GOV-2)**.

**Zone/Repo:** Omnipotent.md · `src/brain/`, `config/brain-corpus-allowlist.json`, `tests/brain/` · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Context7 docs for Nous Portal `/embeddings` fetched before implement (NFR7)
**When** `PortalEmbedder` implements `Embedder` in `src/brain/` and `npm run brain:index` runs against operator allowlist corpus
**Then** indexed vectors are non-stub (dimension/model recorded in `brain-index-manifest.json` with `last_build_utc`)
**And** `indexing-secret-gate.ts` excludes protected paths; story AC lists spot-check paths verified excluded (NFR-GOV-2)
**And** `npm run brain:query` returns ranked vault paths with scores on ≥3 smoke queries
**And** incremental rebuild path documented (cron 15–30 min target per NFR-RECALL-2) + on-demand hook note for session-close
**And** embedder behind env/config flag — revert to StubEmbedder without vault mutation (NFR5)
**And** `tests/brain/portal-embedder.test.ts` (or equivalent) passes; no new packages &lt; 14 days old (NFR-PKG-1)
**And** `bash scripts/verify.sh` passes (NFR1)

**Parallel OK:** May run concurrently with Story 79-1.

---

### Story 79-3: Recall policy config + `recall-inject.ts`

As an **operator**,
I want **versioned per-channel recall policy and inject-trim logic with citation fences**,
So that **injection respects token budgets and drops chunks without resolvable paths (FR18, NFR-RECALL-1, NFR-RECALL-4)**.

**Zone/Repo:** Omnipotent.md · `config/brain-recall-policy.json`, `src/brain/recall-inject.ts`, `tests/brain/recall-inject.test.ts` · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Story 79-2 index exists (or fixture index for unit tests)
**When** `config/brain-recall-policy.json` ships with channel keys `voice_pane`, `standard_text`, `yapped_text` and tunable placeholders (no PRD-hardcoded final numbers)
**Then** `recall-inject.ts` fetches top-k, trims by per-channel `max_injection_tokens`, emits markdown fence with `vault:` path per chunk
**And** chunks without resolvable path are dropped; secret-gate paths never injected (NFR-RECALL-4)
**And** channel detection: length heuristic for `yapped_text` vs `standard_text`; `voice_pane` accepts platform hint parameter
**And** policy file is git-tracked and reversible via config version rollback (NFR5)
**And** `tests/brain/recall-inject.test.ts` covers trim, budget ceiling, and drop rules
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 79-4: Golden-set calibration harness + shadow mode

As an **operator**,
I want **a calibration harness and shadow mode over ≥10 golden queries before production inject goes live**,
So that **recall precision and per-channel token use meet the SM-1 bar (FR19, NFR-RECALL-1)**.

**Zone/Repo:** Omnipotent.md · `tests/brain/` or `tests/fixtures/brain-golden-queries.json`, policy config · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Stories 79-2 and 79-3 complete with Portal index
**When** golden query set (≥10 prompts with expected source paths) runs through `brain:query` + inject trim per channel
**Then** harness reports precision@k and token use per channel; operator tunes `min_score_threshold` and budgets until all golden prompts pass
**And** `shadow_mode: true` in policy logs full would-inject payload without injecting (FR19)
**And** calibration artifact logged: config version + pass date in `_bmad-output/implementation-artifacts/79-4-calibration-pass.md`
**And** **Gate for Epic 82:** documents pass date OR explicit operator waiver for shadow-mode continue
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 79-5: Production `cns-brain-recall` plugin + prefetch CLI

As an **operator**,
I want **cited Brain recall auto-injected on every Hermes turn via `pre_llm_call` plugin calling `brain-recall-prefetch.mjs`**,
So that **I stop invoking `brain:query` manually and vague questions get grounded context (FR18, ADR-HERMES-015)**.

**Zone/Repo:** Omnipotent.md (`scripts/brain-recall-prefetch.mjs`, plugin source, install script) → WSL `~/.hermes/plugins/` · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Story 79-1 probe proven and Stories 79-3/79-4 complete (calibration pass or documented shadow waiver)
**When** production `plugin.py` subprocesses `brain-recall-prefetch.mjs` with JSON stdout `{ context, citations, channel, shadow }`
**Then** one live turn on `standard_text` shows cited vault paths in injected context (not probe stub)
**And** `shadow_mode: false` enables real injection; revert via policy flag + plugin disable (NFR5)
**And** Honcho external MemoryProvider slot untouched — no `MemoryProvider` registration for Brain (ADR-015)
**And** evidence file `_bmad-output/implementation-artifacts/79-5-brain-recall-plugin-evidence.md`: install output, `hermes plugins list`, redacted config keys only, one inject turn proof (NFR4)
**And** protect-list zero edits; no Hermes core fork (NFR2)
**And** `bash scripts/verify.sh` passes (NFR1)

---

## Epic 80: Cost-Effective Auxiliary Routing

Hermes runs auxiliary side-work on Haiku; main model reserved for operator-facing turns.

### Story 80-1: Pin `auxiliary:` block to Portal Haiku

As an **operator**,
I want **all auxiliary tasks pinned to `anthropic/claude-haiku-4.5` (or successor) on Portal**,
So that **compression, approval, skills_hub, mcp, title_generation, and triage_specifier never fall through to Sonnet (FR14, NFR6)**.

**Zone/Repo:** WSL `~/.hermes/config.yaml` · **Branch:** `hermes-consolidation` (evidence in Omnipotent.md `_bmad-output/`)

**Acceptance Criteria:**

**Given** Epic 74 Portal login active
**When** `auxiliary:` block pins listed tasks to Portal Haiku model
**Then** log excerpt or test harness shows auxiliary invocation on Haiku, not `anthropic/claude-sonnet-4.6` (FR14)
**And** **Watch keys:** `triage_specifier` and `skills_hub` called out in evidence — if misrouting observed, revert only those keys (operator note in evidence)
**And** evidence file `_bmad-output/implementation-artifacts/80-1-auxiliary-haiku-evidence.md` with redacted config keys + log lines (NFR4)
**And** **Reversibility (NFR5):** prior `auxiliary:` values documented for rollback
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 80-2: Retire inert `smart_model_routing` + operator guide

As a **maintainer**,
I want **`smart_model_routing` removed or commented out with deprecation documented**,
So that **operators do not chase dead config (FR14 supersession of Epic 78 FR14)**.

**Zone/Repo:** WSL `~/.hermes/config.yaml` + vault operator guide via session-close · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Story 80-1 auxiliary pin live
**When** `smart_model_routing` block is commented/removed in `config.yaml`
**Then** operator guide (`CNS-Operator-Guide` or routing governance module) states auxiliary block is the sole routing lever in Hermes v0.17.0
**And** no new stories target `smart_model_routing`
**And** `bash scripts/verify.sh` passes (NFR1)

---

## Epic 81: Morning Intelligence — Digest Enrichment + Discovery Surface

Chris opens `/nexus` unprompted and sees enriched digest + prioritized internal work.

### Story 81-1: Internal dev-state collector + Convex transport

As an **operator**,
I want **WSL collector pushing prioritized dev-state to Convex on the existing dashboard-sync cron**,
So that **deployed `/nexus` can show internal work without reading WSL files (FR21 transport, FR20 shared collector)**.

**Zone/Repo:** Omnipotent.md (`scripts/lib/collect-internal-dev-state.ts`, `scripts/dashboard-sync.ts`) + cns-dashboard (`convex/internalDevState.ts`, `convex/schema.ts`) · **Branches:** `hermes-consolidation` + cns-dashboard `main`

**Acceptance Criteria:**

**Given** Epic 77 `dashboard-sync.env` with `CONVEX_DEPLOY_KEY` exists
**When** `collect-internal-dev-state.ts` parses `deferred-work.md`, `sprint-status.yaml`, `agent-log.md` tail, vault fast-scan index → ranked `prioritizedItems` with `rationale` and `sourcePath`
**Then** `ingestInternalDevState` mutation pushes on same 3-min cron tick as `dashboard-sync` (extend, no second cron)
**And** `getInternalDevState` query returns camelCase DTO matching `validators.ts` hand-mirror comment in collector
**And** `tests/convex/internal-dev-state.test.ts` passes in cns-dashboard
**And** no Vercel server route reads WSL paths; no browser Brain calls (architecture firewall)
**And** `bash scripts/verify.sh` passes (NFR1) including cns-dashboard tests

---

### Story 81-2: Morning digest internal block + watchdog reliability

As an **operator**,
I want **the 07:00 digest enriched with internal dev-state and hardened external trend reliability**,
So that **SM-2 proactive cockpit holds without manual triage skills (FR20)**.

**Zone/Repo:** Omnipotent.md · morning-digest skill / digest scripts, `push-digest-watchdog.mjs` · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Story 81-1 collector module exists
**When** morning-digest pipeline imports **same** `collect-internal-dev-state.ts` for internal markdown block
**Then** digest output includes structured internal dev-state section consumable by cockpit (UX-DR4)
**And** external trend paths (news, reddit, google-trends) have watchdog/retry hardening where flaky — **extends** existing `push-digest-watchdog` crons at **07:15 / 13:00 / 18:30 Australia/Sydney** — does not duplicate or replace them
**And** 07:00 primary cron delivery has no regression (spot-check or test fixture)
**And** digest informs only — no autonomous vault writes (NFR-GOV-1)
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 81-3: Discovery work panel on `/nexus`

As an **operator**,
I want **a prioritized work panel on Local and Deployed `/nexus` driven by Convex dev-state**,
So that **I see what to work on without running triage skills (FR21, UX-DR3)**.

**Zone/Repo:** cns-dashboard · `DiscoveryWorkPanel.svelte`, `nexus/+page.svelte` · **Branch:** cns-dashboard `main`

**Acceptance Criteria:**

**Given** Story 81-1 `getInternalDevState` live
**When** `DiscoveryWorkPanel.svelte` mounts on `/nexus` home via `useQuery(getInternalDevState)`
**Then** panel shows ranked items with visible `rationale` and links/paths (not black-box)
**And** styling inherits `nexus-theme.css` panel patterns (UX-DR5)
**And** panel is read-only — no auto-triage, vault writes, or skill invocation (FR21)
**And** works on deployed Vercel (Convex only) and Local Nexus
**And** `bash scripts/verify.sh` passes with cns-dashboard tests (NFR1)

---

## Epic 82: Local Nexus JARVIS Voice

Chris speaks to Hermes from Local Nexus with recall-injected voice turns.

**Epic gate:** Story 79-4 calibration pass **OR** documented shadow-mode operator waiver before Story 82-3.

### Story 82-1: SPIKE-OMNI-001 — SvelteKit → `:9119/api/ws` auth ticket

As a **developer**,
I want **a spike proving server-side WS proxy to Hermes dashboard `/api/ws` with OAuth**,
So that **FR10 proxy stories do not guess the ticket/cookie pattern (SPIKE-OMNI-001)**.

**Zone/Repo:** cns-dashboard · spike doc + minimal route prototype · **Branch:** cns-dashboard `main`

**Acceptance Criteria:**

**Given** Context7 Hermes dashboard web-server docs consulted (NFR7); Story 79-4 gate satisfied or waived
**When** spike implements minimal SvelteKit `$lib/server` WS/fetch proxy to `127.0.0.1:9119/api/ws`
**Then** `_bmad-output/implementation-artifacts/82-1-spike-omni-001-ws-proxy.md` documents: auth ticket flow, browser never holds `API_SERVER_KEY` (ADR-HERMES-013), failure modes
**And** spike code may land behind feature flag or draft route — not production VoiceDrawer yet
**And** `bash scripts/verify.sh` passes if spike code merged (NFR1)

---

### Story 82-2: SPIKE-OMNI-002 — `voice_pane` recall channel metadata

As a **developer**,
I want **a spike proving how Local Nexus chat path sets `voice_pane` for `pre_llm_call`**,
So that **voice turns get the tightest recall budget (SPIKE-OMNI-002, FR18 channel)**.

**Zone/Repo:** cns-dashboard + Omnipotent.md plugin · spike doc · **Branch:** `hermes-consolidation` / cns-dashboard `main`

**Acceptance Criteria:**

**Given** Story 82-1 spike context and Epic 79 plugin live
**When** spike tests `platform` hint `nexus-voice` and/or `recall_channel=voice_pane` metadata through dashboard chat path
**Then** `_bmad-output/implementation-artifacts/82-2-spike-omni-002-voice-channel.md` documents chosen convention and plugin detection rule
**And** fallback prefix convention documented if metadata path fails
**And** no protect-list or Hermes core edits (NFR2)

---

### Story 82-3: VoiceDrawer + ElevenLabs TTS + local health gate

As an **operator**,
I want **a local-only JARVIS voice drawer on `/nexus` with push-to-talk, streaming TTS, and transcript citations**,
So that **I talk to Hermes with the same recall substrate as text (FR10, UX-DR1/2/6/7, NFR-VOICE-1/2)**.

**Zone/Repo:** cns-dashboard (`VoiceDrawer.svelte`, `hermes-local-proxy.ts`, `api/nexus/hermes/*`) + WSL `~/.hermes` (`tts:`, `.env`) · **Branches:** cns-dashboard `main` + evidence in Omnipotent.md

**Acceptance Criteria:**

**Given** Stories 82-1/82-2 spikes accepted; Context7 on Hermes voice/`tts` config (NFR7); `ELEVENLABS_API_KEY` in `~/.hermes/.env`
**When** `VoiceDrawer.svelte` mounts only after `hermes-local-health` returns reachable `:9119`
**Then** push-to-talk STT via Hermes voice pipeline; streaming ElevenLabs TTS (`tts.provider: elevenlabs` per ADR-HERMES-014); `edge` fallback documented
**And** transcript shows turn history; recall citations visible on disputed answers (UX-DR2)
**And** deployed Vercel build does not render mic UI (NFR-VOICE-1, UX-DR6)
**And** FR18 `voice_pane` channel applies per spike convention
**And** evidence `_bmad-output/implementation-artifacts/82-3-voice-drawer-evidence.md`: redacted tts config keys, TTS smoke note, health gate proof (NFR4)
**And** **Reversibility (NFR5):** switch to `tts.provider: edge` documented
**And** `pip install "hermes-agent[tts-premium]"` and `[voice]` extras noted if STT+TTS in scope
**And** `bash scripts/verify.sh` passes including cns-dashboard tests (NFR1)

---

## Epic 83: Operator Learning Loop (v1.5)

Hermes compounds operator model across sessions.

### Story 83-1: Honcho dialectic configuration

As an **operator**,
I want **Honcho user-modeling configured in Hermes**,
So that **dialectic memory complements native memory without occupying Brain's `pre_llm_call` slot (FR15)**.

**Zone/Repo:** WSL `~/.hermes/config.yaml` · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Context7 Honcho/Hermes memory docs fetched (NFR7); Epic 79 recall on `pre_llm_call` unchanged
**When** `honcho: {}` → live Honcho config per docs
**Then** Hermes starts with Honcho as external MemoryProvider without disabling `cns-brain-recall` plugin
**And** evidence `_bmad-output/implementation-artifacts/83-1-honcho-config-evidence.md` (redacted)
**And** **Reversibility (NFR5):** disable Honcho block documented
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 83-2: Memory budget raise + cross-session verification

As an **operator**,
I want **sane `memory_char_limit` / `user_char_limit` and verified cross-session recall**,
So that **preferences persist without manual session-close every time (FR15)**.

**Zone/Repo:** WSL `~/.hermes/config.yaml` · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Story 83-1 Honcho live
**When** memory limits raised per operator-approved ceilings (OQ-7 resolved at v1.5 gate)
**Then** real prompts demonstrate native memory persists across two sessions (documented in evidence)
**And** WriteGate unchanged — no direct `AI-Context/AGENTS.md` edit (NFR8)
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 83-3: Automated session-close feeding memory

As an **operator**,
I want **session-close feeding memory on a defined trigger (idle/daily/hybrid)**,
So that **institutional memory compounds without remembering the skill (FR15, optional SM-5)**.

**Zone/Repo:** WSL `~/.hermes/` cron or skill · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Stories 83-1/83-2 complete; trigger choice documented (OQ-8)
**When** auto session-close cron or equivalent runs on operator-approved schedule
**Then** memory/Honcho receive session-close output without silent vault corruption (NFR-GOV-1)
**And** trigger definition in operator guide
**And** `bash scripts/verify.sh` passes (NFR1)

---

## Epic 84: Unified Loop — Discover, Build, Verify, Persist (v1.5)

Approval-gated composed run-chain cycle.

### Story 84-1: Unified Loop governance + schedule shell

As an **operator**,
I want **governance documenting the Unified Loop moves and a schedulable shell**,
So that **Discover/Build/Verify/Persist compose without rewriting run-chain engine (FR22, NFR2)**.

**Zone/Repo:** Omnipotent.md + vault via session-close · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** protect-list paths forbidden (NFR2)
**When** governance module describes Schedule→Discover→Build→Verify→Persist with approval gates
**Then** cron/skill shell invokes loop stages without editing `src/agents/*` or `run-chain.ts`
**And** Discover reuses Epic 81 collector; Build is approval-gated (NFR-GOV-1)
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 84-2: Adversarial verify wiring

As an **operator**,
I want **existing BMAD adversarial review skills wired into the Verify move**,
So that **the loop uses Blind Hunter / Cynical Review / Edge Case Hunter — not new review logic (FR22)**.

**Zone/Repo:** Omnipotent.md · `~/.hermes/skills/cns/` · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Story 84-1 shell exists
**When** Verify move invokes `bmad-code-review`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter` per governance
**Then** one dry-run documents skill invocation paths and outputs
**And** protect-list zero edits (NFR2)
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 84-3: Approval-gated Build + governed Persist

As an **operator**,
I want **Build moves that require approval and Persist through WriteGate/PAKE/audit**,
So that **no silent vault corruption occurs in the autonomous loop (FR22, NFR-GOV-1)**.

**Zone/Repo:** Omnipotent.md · skills + governance · **Branch:** `hermes-consolidation`

**Acceptance Criteria:**

**Given** Stories 84-1/84-2 complete; `EnterWorktree` handoff exists
**When** Build move attempts vault mutation
**Then** destructive or WriteGate paths require explicit operator approval before proceed
**And** Persist reuses existing audit/`vault_log_action` patterns (Story 5.2 bound spec)
**And** one E2E dry-run with approval pause documented
**And** `bash scripts/verify.sh` passes (NFR1)

---

## Epic 85: Cockpit Fusion + Remote Voice (v1.5)

Kanban, trend-fusion, Tailscale; absorbs slipped FR10.

### Story 85-1: Kanban cockpit panel

As an **operator**,
I want **a kanban-oriented work view on `/nexus` fused with dev-state signals**,
So that **I see flow-oriented status beyond the prioritized list (brief v1.5)**.

**Zone/Repo:** cns-dashboard · **Branch:** cns-dashboard `main`

**Acceptance Criteria:**

**Given** Epic 81 dev-state transport live
**When** kanban panel ships on `/nexus` per brief scope (columns TBD at v1.5 gate)
**Then** panel uses Convex queries only; inherits `nexus-theme.css` (UX-DR5)
**And** informs only — no autonomous vault writes
**And** `bash scripts/verify.sh` passes with cns-dashboard tests (NFR1)

---

### Story 85-2: Trend-fusion cockpit panel

As an **operator**,
I want **trend intelligence fused with internal dev-state on the cockpit**,
So that **external motion and internal work appear in one instrument view (brief v1.5)**.

**Zone/Repo:** cns-dashboard · **Branch:** cns-dashboard `main`

**Acceptance Criteria:**

**Given** Epic 69/71 trend surfaces and Epic 81 dev-state exist
**When** trend-fusion panel composes reactive queries
**Then** ECharts only via `EChartsPanel.svelte` (UX-DR5)
**And** `bash scripts/verify.sh` passes (NFR1)

---

### Story 85-3: Tailscale remote voice OR deferred Epic 82 FR10

As an **operator**,
I want **remote voice reachability via Tailscale when Local Nexus alone is insufficient**,
So that **JARVIS voice works away from the dev machine (brief v1.5; absorbs FR10 if Epic 82 slipped)**.

**Zone/Repo:** cns-dashboard + WSL tunnel config · **Branches:** per implementation plan at v1.5 gate

**Acceptance Criteria:**

**Given** Epic 82 complete OR explicitly deferred to v1.5
**When** Tailscale (or approved tunnel) enables secure `:9119` reachability per brief
**Then** voice path documented; security constraints match ADR-HERMES-013 spirit (no browser API keys)
**And** if Epic 82 slipped, this story delivers FR10 acceptance criteria from PRD §4.2
**And** `bash scripts/verify.sh` passes (NFR1)

