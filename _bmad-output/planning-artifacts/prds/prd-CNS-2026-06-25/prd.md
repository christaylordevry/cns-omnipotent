---
title: "PRD — Hermes Omniscient (Hands-Off JARVIS)"
status: final
created: 2026-06-25
updated: 2026-06-25
parent_prd: prd-hermes-consolidation.md
parent_initiative: Hermes Consolidation (G4/G5/G7)
source_brief: briefs/brief-hermes-omniscient-2026-06-25/brief.md
grounding: research-hermes-omniscience-resurfacing.md
finalized: 2026-06-25
---

# PRD: Hermes Omniscient — Hands-Off JARVIS

*Working title confirmed. This PRD finishes the tail of Hermes Consolidation — not a new program.*

## 0. Document Purpose

This PRD is for Chris (operator-builder), downstream BMAD workflows (`bmad-create-architecture`, `bmad-create-epics-and-stories`), and implementation agents working across **Omnipotent.md** and **cns-dashboard**. It **continues** `prd-hermes-consolidation.md` — parent Epic D, FR15, and FR16 sections are **superseded here** for recall, voice, learning, and JARVIS presence. FR numbering is preserved where capabilities overlap (FR10/G6 voice, FR14 cost, FR15 learning, FR16 recall) with new FRs for cited auto-injection, local Nexus voice pane, autonomous discovery, and the v1.5 unified loop.

**Inputs (read and reconciled):**
- Product brief + addendum: `_bmad-output/planning-artifacts/briefs/brief-hermes-omniscient-2026-06-25/`
- Ground-truth resurfacing: `_bmad-output/planning-artifacts/research-hermes-omniscience-resurfacing.md`
- Parent PRD + architecture ADR set (ADR-HERMES-001 requires formal amendment)
- Constitution: `specs/cns-vault-contract/AGENTS.md`

**Structure:** Glossary-anchored vocabulary (especially Wispr Flow vs Whisper). Features grouped with globally numbered FRs. Technical transport and ADR detail in `addendum.md`. Open architecture questions in §8; assumptions in §12.

---

## 1. Vision

Chris is building Hermes into a **hands-off JARVIS** for a solo operator-builder escaping employment into an AI-native agency. The operator talks or texts naturally; Hermes already knows where they left off, what is in the vault, what is moving in the world, and what to act on — then answers intelligently, suggests better paths, and executes on the stack **without remembered skill names**.

**The missing 30% is felt intelligence — recall and learning — not more plumbing.** In ~90 days the infrastructure matured (constitution-following models, MCP, BMAD, Epic 77 awareness, 13 crons). Vault read/write, live cockpit state, and trend ingestion are live. Semantic recall is broken (StubEmbedder fake vectors). Learning loops are manual. The operator still serves as Hermes's memory.

**v1 (~30 days) delivers the felt layer:** real semantic recall with cited auto-injection, enriched automated morning digest, local Nexus JARVIS voice (push-to-talk in, streaming TTS out), auxiliary→Haiku cost routing, and autonomous **discovery** that surfaces prioritized internal work (informs only — no execution). **v1.5** adds the learning loop (Honcho, memory budgets, automated session-close), skill automation, kanban + trend-fusion cockpit, Tailscale remote voice, and the approval-gated **Unified Loop**.

**North star (emotional): operator intention** — Hermes understands what Chris is trying to accomplish and what is incomplete, not just which file was last opened. This depends on the v1.5 learning loop. **v1 does not promise intention inference.** v1 success is felt intelligence via recall + digest + local voice: vague questions get grounded answers with citations; the morning cockpit is already right; paid work ships that week.

**Trust line (any one = failure):** confident fabrication about vault or system state; Hermes stops catching the operator's gaps; silent vault corruption. **Hands-off line:** named skills only for dangerous/destructive actions; Hermes announces what it is doing in v1; acts on destructive ops only after approval.

**Cost posture:** pay for intelligence; route by reasoning need (Haiku for cheap auxiliary work, Sonnet when it matters). Hard spend cap deferred until billing is steady.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Stop being the indexer** — Hermes recalls vault + system context without path-hunting or skill names.
- **Start from prepared, not zero** — morning cockpit surfaces unfinished work, trends, and internal dev-state before the operator asks.
- **Talk naturally, get grounded answers** — local JARVIS pane and text surfaces share the same recall and memory substrate.
- **Ship paid work weekly** — system reduces catch-up time so agency output lands, not just organizes.
- **Compound institutional memory** — preferences and workflow patterns persist (v1.5 learning loop; v1 lays recall foundation).
- **Trust but verify** — citations on recalled knowledge; no silent destructive execution.

### 2.2 Non-Users (v1)

- Agency clients (work product ROI only; no Hermes access).
- Operators expecting always-on duplex voice, Desktop/Discord voice, or day-one intention inference.

### 2.3 Key User Journeys

**UJ-1. Chris asks a vague question and Hermes connects the dots.**
Chris, mid-build, opens local Nexus or Discord and asks *"what was I supposed to do about that YouTube thing?"* Hermes auto-injects recalled vault notes, sprint/deferred-work context, and awareness snapshot — then responds with options grounded in cited sources. **Climax:** no dead-end *"I don't know"*; partial context narrows to actionable choices. **Unacceptable:** confident fabrication or no follow-up path.

**UJ-2. Chris opens the morning cockpit unprompted.**
Before coffee, local or deployed `/nexus` shows an enriched digest: external trends (existing cron) plus **internal dev-state** prioritized work list (new). Something proactive already surfaced. Chris picks one item and ships paid work that week. **Climax:** cockpit was right without manual triage skill.

**UJ-3. Chris uses the local JARVIS voice pane.**
On `localhost:5173`, Chris push-to-talks in the voice pane (faster-whisper STT via Hermes). Hermes runs the same recall-injected inference as text, streams ElevenLabs TTS back. Wispr Flow remains the universal dictation layer for Cursor, async ask, and Discord text — separate from the pane's turn-taking STT.

---

## 3. Glossary

- **Brain index** — Semantic vector index over the vault corpus (`brain:index` / `brain:query`). Currently stub-embedded; v1 replaces with PortalEmbedder real vectors.
- **Cited auto-injection** — Automatic insertion of top-k Brain recall results into Hermes working context per turn, with vault path citations visible to the operator.
- **Discovery (Loop Engineering)** — Autonomous scan of internal dev-state (`agent-log.md`, `deferred-work.md`, `sprint-status.yaml`, fast-scan index) → prioritized work surface. **Informs only in v1**; does not execute.
- **Felt intelligence** — The operator-experienced layer: recall, proactive surfacing, and spoken responses — distinct from backend plumbing.
- **Hermes Omniscient** — This initiative; tail of Hermes Consolidation finishing G4/G5/G7.
- **Honcho** — Hermes dialectic user-modeling layer (`honcho: {}` today — unconfigured).
- **Local Nexus** — cns-dashboard at `localhost:5173`; primary v1 voice + full JARVIS surface. Server routes proxy to WSL Hermes `127.0.0.1:9119`.
- **Operator intention** — Emotional north star: what the operator is trying to accomplish and what is incomplete. v1.5+ capability; not a v1 deliverable.
- **PortalEmbedder** — Production embedder hitting Nous Portal `/embeddings` (25 models); drop-in replacement for StubEmbedder.
- **Protect-list** — Files that must not be edited: synthesis/hook/boss adapters, `run-chain.ts` (see §9 Constraints).
- **Recall channel** — Turn classification for injection budgeting: `voice_pane` (local JARVIS STT turns), `yapped_text` (prompt length ≥ `yapped_text_min_chars` — includes Wispr dictation; **no Wispr-specific flag exists**), `standard_text` (shorter typed prompts). Each channel has separate tunable top-k, min_score, and token budget in recall policy config.
- **Recall injection policy** — Config-tunable rules (not PRD-hardcoded numbers) governing per-channel fetch, score threshold, injection token ceiling, and trim behavior. Calibrated post-embedder via FR19 golden query set.
- **Unified Loop (v1.5)** — Composed Schedule→Discover→Build→adversarial-Verify→Persist run-chain; approval-gated; reuses existing BMAD adversarial review skills.
- **Deployed Nexus** — Vercel `/nexus`; awareness, trends, digest view, async ask via dispatch. **No realtime voice v1**; voice UI local-only-activated.
- **Wispr Flow** — Third-party OS-level dictation app. Speech→text into any field. Universal speak-instead-of-type input; no vault awareness; no TTS.
- **Whisper** — faster-whisper STT model inside the Hermes voice pipeline. Used for in-pane push-to-talk capture on Local Nexus.

---

## 4. Features

### 4.1 Semantic Recall & Cited Auto-Injection

**Description:** Replace StubEmbedder with PortalEmbedder; build a real Brain index over the vault corpus (respecting allowlist + `indexing-secret-gate.ts`); expose recall to Hermes and **auto-inject** top-k results with citations every turn — the primary v1 gate for G4 "knows everything." Machinery largely exists (`query-index.ts`: top-k cap 50, quality weighting, 0.85 freshness stale penalty); v1 work is **policy calibration under three pressures**, not greenfield retrieval. Realizes UJ-1, UJ-2, UJ-3.

**War Room synthesis (Cross-Functional, 2026-06-25):**

| Persona | Pressure | Non-negotiable |
|---------|----------|----------------|
| PM (felt omniscience) | Enough injected context that vague questions connect | Recall must feel grounding, not lookup |
| Engineer (cost/latency) | Every injected token is spend; voice must stay fast | Hard per-turn ceilings; incremental embed only |
| Operator (trust) | Right context with verifiable sources | Noise = trust reset; citations mandatory |

**Design principles (locked from War Room):**

1. **Per-channel injection budgets** — one global cap is wrong. Policy splits by turn channel (see Glossary: **Recall channel**).
2. **Thresholds are config-tunable, not PRD-hardcoded** — existing `topK` / `minScore` / stale-penalty assumptions were validated against StubEmbedder (8-dim SHA-256). Real Portal vectors invalidate those distributions. PRD specifies policy *shape* + a **post-embedder calibration story (FR19)**; implementation ships tunable defaults, not final numbers.
3. **Growth stress-test** — moat is compounding; vault will grow. Policy must remain precision-stable and cost-bounded at ~2× corpus without manual re-architecture (see §4.1 Growth check).

#### FR16: Production semantic recall

The operator can query vault knowledge semantically without supplying file paths. Hermes conversations automatically receive cited recall context governed by a tunable **recall policy**.

**Consequences (testable):**
- `PortalEmbedder` implements `Embedder`; `brain:index` produces non-stub vectors via Portal `/embeddings` (Context7 before implement).
- `brain:query` returns relevant vault paths with scores; zero dead-end "I don't know" without follow-up on vault-groundable questions (SM-1).
- `indexing-secret-gate.ts` excludes secrets/protected zones (same pattern set as WriteGate); allowlist honored; coverage verified in stories.
- Index rebuild is **incremental** on changed notes; full reindex on embedder model change; embed cost guarded (vector cache per content hash).
- **Index freshness (OQ-5 resolved):** batched incremental rebuild on cron (e.g. 15–30 min) + on-demand trigger after high-signal vault writes (session-close, `vault_write` mutations) — not watch-on-every-write. `brain-index-manifest.json` carries `last_build_utc`; stale-sample penalty remains but **penalty factor is config-tunable** (current code default 0.85 is not normative post-Portal).
- **Recall policy config** exists at repo-known path (e.g. `config/brain-recall-policy.json`) — versioned, documented, reversible (NFR5).

#### FR18: Cited auto-injection into Hermes context

Each Hermes turn automatically loads relevant Brain recall into working context with visible vault path citations, governed by the active **recall channel** budget.

**Consequences (testable):**
- Recall loads without operator invoking a skill or `brain:query` manually.
- Every injected chunk includes vault path citation the operator can verify.
- Injection stops when the channel's **token budget** is exhausted (not when top-k is exhausted — fetch may over-retrieve, inject trims by score until budget hit).
- Hermes turn metadata selects recall channel: `voice_pane` | `yapped_text` | `standard_text` (see §3 Glossary). `yapped_text` vs `standard_text` is **length-heuristic only** — Wispr Flow output is indistinguishable from typed text (no explicit flag).
- Injected context is visible in UI or logged for operator audit on dispute (trust line).

**Architecture dependency (OQ-9):** *How* recall reaches every Hermes turn is unspecified here — policy only. Architecture must select a supported extension seam (not a core fork). See addendum § FR18 injection seam.

**Per-channel policy shape** *(parameters tunable via config — no normative numeric defaults in PRD):*

| Channel | When | Budget posture (War Room) |
|---------|------|---------------------------|
| `voice_pane` | Local Nexus push-to-talk turns | **Tightest** token budget; fewer chunks; prioritize highest min_score — latency and TTS pacing dominate |
| `standard_text` | Typed Discord, async ask, short prompts (below `yapped_text_min_chars`) | **Moderate** budget; default text surface |
| `yapped_text` | Long text prompts (≥ `yapped_text_min_chars` — includes Wispr dictation) | **Widest** token budget; more chunks allowed — long prompts carry more signal, need more grounding |

Each channel row configures (all tunable): `max_top_k_fetch`, `min_score_threshold`, `max_injection_tokens`, `max_chunks`, optional `quality_weighting` override.

#### FR19: Post-embedder recall calibration

After PortalEmbedder ships and the Brain index is rebuilt, the operator runs a calibration pass before cited auto-injection goes live in production Hermes.

**Consequences (testable):**
- **Golden query set:** ≥10 operator-curated prompts representing real vague questions (e.g. YouTube bar, sprint continuity, deferred work) with expected source paths documented.
- Calibration harness runs `brain:query` + injection trim per channel against golden set; reports precision@k and token use per channel.
- Operator tunes `min_score_threshold` and per-channel budgets until golden set passes acceptance (no false-source citations; recall bar met on all golden prompts).
- Calibration artifacts logged (config version + pass date); re-run required on embedder model change or major corpus ingest (>20% note count delta).
- Until calibration passes, auto-injection may run in **shadow mode** (log what would inject, don't inject) — operator choice in architecture.

**Growth check (month-2, vault ~2×):**

| Risk | Mitigation in policy |
|------|---------------------|
| Precision degrades (more near-duplicate chunks crowd top-k) | Raise `min_score_threshold` per channel; optional MMR/diversity pass before inject trim |
| Injection token cost rises | Cost scales with **turns**, not corpus size — if token budgets are enforced, 2× vault does not 2× spend |
| Index embed cost spikes | Incremental-only embed on hash change; batched cron bounds write amplification |
| Staleness | Manifest SLA + on-demand rebuild after session-close; stale penalty surfaces low-confidence recall in warnings |

If precision degrades after growth, **recalibrate (FR19)** — do not hardcode wider top-k to compensate.

**Feature-specific NFRs:**

- **NFR-RECALL-1 (Per-channel ceilings):** Recall policy enforces separate `max_injection_tokens` per channel; voice_pane < standard_text < yapped_text. Values live in config only.
- **NFR-RECALL-2 (Index freshness):** Incremental index no older than configurable SLA (default target: ≤30 min under normal cron); on-demand rebuild completes within configurable timeout after session-close.
- **NFR-RECALL-3 (Reversibility):** Embedder + auto-injection behind flags; revert to StubEmbedder / manual recall without vault mutation.
- **NFR-RECALL-4 (Trust):** Injected chunks without resolvable vault path are dropped; injection never includes secret-gate-excluded paths.

**Notes:** FR16 was stretch in parent PRD — **promoted to v1 gate #1** here. Parent `prd-hermes-consolidation.md` FR16 section superseded. **Recall is the v1 spine — cannot slip** (see §6 sequencing).

---

### 4.2 Local Nexus JARVIS Voice Pane (FR10 / G6)

**Description:** Visually polished JARVIS voice experience on **Local Nexus** (`localhost:5173`): push-to-talk in, streaming TTS out, conversation transcript, recall-injected turns via FR18 (channel `voice_pane`). Amends ADR-HERMES-001 (Nexus-local primary; Desktop/Discord voice deferred v1). Realizes UJ-3.

**UI placement (locked):** drawer/panel on existing `/nexus` home — not a separate route. Mic control and voice UI render **only** when local Hermes backend health check passes (no dead mic on deployed Vercel).

#### FR10: Local Nexus voice pane

The operator can speak to Hermes from Local Nexus and receive streaming spoken responses with the same recall and memory substrate as text.

**Consequences (testable):**
- Push-to-talk capture via in-pane faster-whisper STT (Hermes voice pipeline on WSL); Wispr Flow remains universal dictation for other surfaces.
- Streaming TTS out via Hermes (`tts.provider` per ADR-HERMES-014 — Portal-managed or direct ElevenLabs; `edge` documented fallback).
- SvelteKit `$lib/server` routes proxy audio/API to `127.0.0.1:9119` — browser never holds `API_SERVER_KEY` (ADR-HERMES-013).
- Transcript UI shows turn history; recall citations visible on disputed answers.
- Deployed Vercel `/nexus` does not render voice controls; async ask + awareness unchanged.
- FR18 recall channel `voice_pane` budget applies to voice turns.
- Always-on duplex voice is **out** (upstream Hermes #35750).

**Feature-specific NFRs:**
- **NFR-VOICE-1:** Voice pane activates only on Local Nexus with reachable WSL Hermes.
- **NFR-VOICE-2:** No silent execution — Hermes announces actions; destructive ops require approval (inherits §1 trust line).

**Slip posture:** FR10 is the **designated v1 slip candidate** if the ~30-day calendar tightens — recall (§4.1) must ship first; voice defers to v1.5 without collapsing G4 "knows everything" on text surfaces.

---

### 4.3 Morning Digest Enrichment (FR20)

**Description:** Automate and enrich the **existing** 07:00 morning-digest cron — not greenfield. External trends/news/reddit/google-trends already run; v1 adds internal dev-state block and hardens reliability. Realizes UJ-2.

#### FR20: Morning digest automation and enrichment

The morning cockpit surfaces an enriched digest without operator-triggered skills.

**Consequences (testable):**
- **Internal dev-state block** added to digest pipeline: scan `deferred-work.md`, `sprint-status.yaml`, `agent-log.md` (recent tail), `vault-fast-scan-index.md` → structured section in digest output.
- **External reliability:** watchdog/retry hardening for existing trend ingest paths (news, reddit, google-trends) where flaky — no regression on current 07:00 delivery.
- Digest output consumable by Local Nexus and Deployed Nexus cockpit panels.
- Digest informs only — no autonomous execution of surfaced items.

**Notes:** Pairs with FR21 (discovery cockpit surface); may share scan logic but digest remains the cron-delivered artifact.

---

### 4.4 Cost-Effective Auxiliary Routing (FR14)

**Description:** Reframe parent FR14 — `smart_model_routing` is **inert** in Hermes v0.17.0 (zero consumers). Real lever: `auxiliary:` block in `~/.hermes/config.yaml`, consumed by `agent/auxiliary_client.py`.

#### FR14: Auxiliary tasks on Haiku

Hermes auxiliary side-work runs on a cheap model; main conversational model reserved for operator-facing turns.

**Consequences (testable):**
- Pin to Portal Haiku (`anthropic/claude-haiku-4.5` or successor): `compression` (already), `approval`, `skills_hub`, `mcp`, `title_generation`, `triage_specifier`.
- Verify via logs or test harness that auxiliary tasks do not fall through to Sonnet 4.6.
- **Remove or comment out** inert `smart_model_routing` block in config; document deprecation in operator guide — no further stories on dead block.
- Reversible via config (NFR5).

**Notes:** Parent FR14 "per-skill routing" superseded — not supported in v0.17.0. Parallel chore; can land early in v1 schedule (low risk).

---

### 4.5 Autonomous Discovery — Informs Only (FR21)

**Description:** Loop Engineering **Discover** move for **internal** dev-state — not external trends (digest already covers those). Surfaces prioritized work in morning cockpit; **no execution**. Realizes UJ-2.

#### FR21: Internal dev-state discovery surface

The morning cockpit shows a prioritized work list derived from internal project state without operator running triage skills.

**Consequences (testable):**
- Scan sources (all required): `_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml`, `agent-log.md`, vault fast-scan index.
- Output: prioritized list with links/paths to source artifacts; rank rationale visible (not black-box).
- Surface: morning cockpit panel on `/nexus` (local and deployed) — **not** a separate Discord push in v1.
- **Informs only** — no auto-triage, vault writes, or skill invocation.
- Shares scan logic with FR20 internal block where practical (single implementation, two consumers).

**Held tension:** Discovery is autonomous **surfacing** (v1 allowed). Autonomous **build/act** is v1.5+ only (FR22).

---

### 4.6 Learning Loop & Unified Loop (v1.5 — FR15, FR22)

**Description:** Parent FR15 superseded here for Omniscient scope. Deferred from v1; depends on recall (§4.1) shipping first.

#### FR15: Progressive operator learning (v1.5)

Hermes compounds operator model and memory across sessions without manual session-close as the only feed.

**Consequences (testable):**
- Configure Honcho dialectic user-modeling (`honcho: {}` → live config; Context7 before implement).
- Raise `memory_char_limit` / `user_char_limit` to sane budgets (OQ-7 resolved at v1.5 gate).
- Verify native memory persists and recalls across sessions on real prompts.
- Automate `session-close` feeding memory (OQ-8: idle timeout / daily / hybrid — decide at v1.5 gate).
- Optional v1 parallel: auto session-close cron if ≥80% auto-close milestone is hard target (Menu 5-1).

#### FR22: Unified Loop run-chain (v1.5)

Compose Discover + Build + adversarial Verify + governed Persist into one schedulable cycle.

**Consequences (testable):**
- Reuse existing adversarial skills (`bmad-code-review` Blind Hunter, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`) — not new review logic.
- Worktree handoff already exists (`EnterWorktree`); persistence exceeds (WriteGate/PAKE/audit).
- **Build move approval-gated** — no silent vault corruption; destructive actions require operator approval.
- Gated behind no-silent-execution governance from §1.
- Kanban + trend-fusion cockpit and Tailscale remote voice land in same v1.5 tranche per brief.

---

## 5. Non-Functional Requirements

Carry forward parent NFR1–NFR8 unchanged unless noted. Omniscient additions:

| ID | Requirement |
|----|-------------|
| **NFR1** | `bash scripts/verify.sh` exits 0 before every commit (+ cns-dashboard when present). |
| **NFR2** | Protect-list zero edits: `src/agents/synthesis-adapter-llm.ts`, `hook-adapter-llm.ts`, `boss-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`. Recall additive in `src/brain/`; voice in cns-dashboard + `~/.hermes/config.yaml`. |
| **NFR3** | Brain index integrity: `brain:index` / `brain:query` work post-PortalEmbedder; embedder behind flag. |
| **NFR4** | No secrets in git; dashboard secrets in `$lib/server`; no `NEXUS_*` env vars on cns-dashboard. |
| **NFR5** | Reversibility: embedder, auto-injection, Honcho, auxiliary routing — all config-reversible. |
| **NFR6** | Cost: auxiliary never on main model; injection cost bounded per turn (FR19 policy). |
| **NFR7** | Context7 mandatory before Portal `/embeddings`, ElevenLabs/voice config, Honcho. |
| **NFR8** | WriteGate: never directly edit `AI-Context/AGENTS.md`; route via session-close. |
| **NFR-RECALL-1..4** | See §4.1. |
| **NFR-VOICE-1..2** | See §4.2. |
| **NFR-GOV-1** | No silent execution v1; Hermes announces actions; destructive ops require approval. |
| **NFR-GOV-2** | Auto-indexing respects `indexing-secret-gate.ts` + corpus allowlist; no secrets in Brain index. |
| **NFR-PKG-1** | No npm/pip package &lt; 14 days old without operator approval. |

---

## 6. MVP Scope

### 6.1 v1 IN (~30 days)

| Priority | Capability | FRs | Notes |
|----------|------------|-----|-------|
| **P0 — spine (cannot slip)** | Semantic recall + cited auto-injection + calibration | FR16, FR18, FR19 | PortalEmbedder, policy config, OQ-9 seam (architecture), golden-set gate |
| **P1 — parallel / early** | Auxiliary → Haiku | FR14 | Low risk; unblocks cost posture quickly |
| **P2 — after recall** | Digest enrichment + reliability | FR20 | Existing 07:00 cron; internal block + watchdog hardening |
| **P2 — after recall** | Discovery cockpit surface | FR21 | Informs only; shares scan with FR20 |
| **P3 — if calendar allows** | Local Nexus voice pane | FR10 | **Designated slip-to-v1.5**; heaviest lift (cns-dashboard + proxy + STT/TTS) |
| **Optional parallel** | Auto session-close cron | (FR15 partial) | Only if ≥80% milestone is hard target |

**Mandatory sequencing:**

```
FR16/18/19 (+ ADR-HERMES-015 seam)  →  FR14 (parallel OK early)
                                    →  FR20 + FR21
                                    →  FR10 (slip allowed)
```

**Recall-first rule:** If scope pressure hits, cut or defer **FR10 first**, then trim FR20/21 polish — **never** defer FR16/18/19 production path. Text surfaces + cited recall deliver the v1 "knows everything" promise; voice is enhancement.

### 6.2 v1.5 IN

| Capability | FRs |
|------------|-----|
| Honcho + memory budgets + automated session-close | FR15 |
| Skill automation (manual knowledge skills → scheduled/event-driven) | (epic detail) |
| Unified Loop (Discover + Build + Verify + Persist) | FR22 |
| Kanban + trend-fusion cockpit | (brief) |
| Tailscale remote voice | (brief) |
| FR10 if slipped from v1 | FR10 |

### 6.3 OUT (near-term)

Client-facing Hermes; silent execution; day-one intention inference; build-phase meta-mode; always-on duplex; Desktop/Discord voice v1; autonomous build/act in v1.

### 6.4 Held tensions

| Tension | Resolution |
|---------|------------|
| Autonomous discovery (v1) vs autonomous build (v1.5+) | FR21 informs only; FR22 build is approval-gated v1.5+ |
| Operator intention (north star) vs v1 success | Intention in §1 vision; **not** in v1 success criteria (§7) |
| Five capability areas in ~30 days | Recall spine non-negotiable; FR10 explicit slip valve |

---

## 7. Success Metrics

**Primary (operator-weighted):**

- **SM-1 (Recall bar):** Zero dead-end *"I don't know"* on vault-groundable questions without follow-up; recalled answers cite vault paths. Validates FR16, FR18, FR19.
- **SM-3 (Paid work):** 30-day test — paid work shipped or landed that week while using the system. Validates end-to-end felt intelligence, not just infra.

**Secondary (required for UJ-2, not co-primary pass/fail):**

- **SM-2 (Proactive cockpit):** Operator opens cockpit unprompted; digest + discovery already surfaced something actionable. Validates FR20, FR21.
- **SM-4 (Cost):** No rationing anxiety; auxiliary tasks never observed on main model. Validates FR14.
- **SM-5 (Hands-off):** North star — forgot skills exist; 30-day stretch — auto session-close ≥80% (optional v1 / v1.5).

**Trust counter-metrics (any = initiative failure):**

- **SM-C1:** Confident fabrication about vault or system state.
- **SM-C2:** Hermes stops catching operator gaps (scope drift, imminent breakage).
- **SM-C3:** Silent vault corruption or unapproved destructive write.

**30-day composite test:** Cockpit opened unprompted + proactive surfacing (SM-2) + **SM-1 + SM-3 pass** — not SM-5 or intention inference.

---

## 8. Open Questions

| # | Question | Owner | Blocks |
|---|----------|-------|--------|
| OQ-1 | ElevenLabs: Portal-managed TTS vs direct key | Architecture (ADR-HERMES-014) | FR10 stories |
| OQ-9 | FR18 auto-injection seam (memory provider vs system-message vs MCP tool) | Architecture (ADR-HERMES-015) | FR18 prod enable |
| OQ-6 | Honcho hosting local vs hosted | Operator + Context7 | v1.5 FR15 |
| OQ-7 | Memory budget ceiling | Operator | v1.5 FR15 |
| OQ-8 | Auto session-close trigger definition | Operator | v1.5 FR15 / optional v1 |

---

## 9. Constraints & ADR Amendments

**Protect-list (zero edits):** `src/agents/synthesis-adapter-llm.ts`, `src/agents/hook-adapter-llm.ts`, `src/agents/boss-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`.

**ADR amendments (detail in `addendum.md`):**

| ADR | Action |
|-----|--------|
| **ADR-HERMES-001** | Amend — Local Nexus primary voice; Desktop/Discord voice deferred v1 |
| **ADR-HERMES-013** | New — SvelteKit server routes → WSL `:9119`; voice local-only-activated |
| **ADR-HERMES-014** | New — ElevenLabs delivery path (OQ-1) |
| **ADR-HERMES-015** | New — FR18 cited auto-injection seam (OQ-9) |

---

## 10. Epic Outline (phased)

Epic numbering TBD by `bmad-create-epics-and-stories`; logical phasing:

### Phase A — Recall spine (v1 P0) — **cannot slip**

| Epic | Scope | FRs |
|------|-------|-----|
| **A1 PortalEmbedder + Brain index** | PortalEmbedder, incremental index, secret-gate, allowlist | FR16 |
| **A2 Recall policy + injection** | `brain-recall-policy.json`, fetch/inject trim, channel detection | FR18 |
| **A3 Calibration gate** | Golden query harness, shadow mode, go-live criteria | FR19 |
| **A4 Injection seam** | Architecture-selected Hermes extension (OQ-9); off protect-list | FR18 |

### Phase B — Cost (v1 P1, parallel early)

| Epic | Scope | FRs |
|------|-------|-----|
| **B1 Auxiliary → Haiku** | Config pin + verify; retire `smart_model_routing` | FR14 |

### Phase C — Morning intelligence (v1 P2, after A)

| Epic | Scope | FRs |
|------|-------|-----|
| **C1 Digest enrichment** | Internal dev-state block + external reliability | FR20 |
| **C2 Discovery surface** | Cockpit prioritized work panel | FR21 |

### Phase D — Local voice (v1 P3 — **slip-to-v1.5 allowed**)

| Epic | Scope | FRs |
|------|-------|-----|
| **D1 Nexus voice drawer** | Local-only pane, STT/TTS proxy, transcript, ADR-HERMES-001/013/014 | FR10 |

### Phase E — Learning & loop (v1.5)

| Epic | Scope | FRs |
|------|-------|-----|
| **E1 Learning loop** | Honcho, memory budgets, auto session-close | FR15 |
| **E2 Unified Loop** | Composed run-chain + adversarial verify wiring | FR22 |
| **E3 Cockpit fusion + remote voice** | Kanban, trend fusion, Tailscale | brief |

**Sprint rule:** No Phase D work starts until A3 calibration passes or is in shadow with explicit operator waiver. Phase C may overlap A tail.

---

## 11. Next BMAD Steps

1. **`bmad-create-architecture`** — resolve OQ-1, OQ-9; amend ADR-HERMES-001; draft ADR-HERMES-013/014/015.
2. **`bmad-create-epics-and-stories`** — decompose §10; enforce recall-first sprint ordering.
3. **`bmad-check-implementation-readiness`** → build cycle.

---

## 12. Assumptions Index

- Portal `/embeddings` API stable and documented via Context7 — FR16.
- Hermes v0.17.0 extension seams support FR18 without core fork — OQ-9.
- Existing 07:00 digest cron is the correct integration point for FR20 — not greenfield.
- `smart_model_routing` remains inert; no v0.17.0 consumer will appear mid-initiative.
- Wispr Flow output is indistinguishable from typed text — `yapped_text` is length-only — FR18.
