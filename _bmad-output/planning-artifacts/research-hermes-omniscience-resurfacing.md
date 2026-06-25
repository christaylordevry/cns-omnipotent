# Research & Resurfacing — Hermes Omniscience Initiative

**Date:** 2026-06-25
**Author:** Verifier pass (Opus 4.8), source-grounded against installed Hermes v0.17.0 + live config + repo
**Status:** Findings + target architecture — input for a BMAD PRD refresh + epic/story generation
**Parent initiative:** Hermes Consolidation (PRD `prd-hermes-consolidation.md`, goals G4/G5/G7)

---

## 1. Operator vision (verbatim intent)

> "I want everything to be cost-effective and automatic, hands-off as possible. I want to be able to talk/text to Hermes and it knows everything literally about what's in our system, because we want it to progressively get smarter and learn me and optimize everything that I do. Not just little skills I have to remember to run here and there."

Decomposed into four pillars:

1. **Omniscient** — knows everything across all information avenues, including the knowledge vault.
2. **Hands-off / automatic** — no skill the operator must remember to trigger; ingestion *and recall* are passive.
3. **Progressively smarter / learns me** — models the operator, compounds over time, optimizes their workflow.
4. **Cost-effective** — cheap models for cheap work; efficient indexing.

This is **not new scope** — it is goals G4 (knows everything), G5 (gets smarter), G7 (full access) and FR15/FR16 from the existing PRD. This initiative *finishes the least-built tail*, it does not invent a new program.

---

## 2. Method

Ground truth was read directly, not inferred from docs or training data:

- Installed Hermes source: `~/.hermes/hermes-agent/` (v0.17.0)
- Live config: `~/.hermes/config.yaml`
- Live cron + systemd: `crontab -l`, `~/.config/systemd/user/`
- Repo: `~/ai-factory/projects/Omnipotent.md/src/`, `scripts/`, `package.json`
- Memory state: `~/.hermes/memories/`
- Portal capabilities: operator-confirmed Info page (237 inference models, **25 embedding models**, `openai-audio` voice)

---

## 3. Current-state ground truth (4 pillars)

### Pillar 1 — Knows everything  *(partial; recall is the gap)*

| Avenue | Mechanism | State |
|--------|-----------|-------|
| Knowledge vault | `cns_vault_io` MCP, `CNS_VAULT_ROOT=/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` | ✅ read/write live |
| Live system/cockpit state | `dashboard-sync.ts` push → Convex (3 min) + `hermes-awareness-pull.ts` pull → `~/.hermes/memories/awareness-snapshot.json` (3 min) | ✅ live (Epic 77) |
| Trends / news / reddit / google-trends | `run-trend-ingest-cron.sh` (15/30/60 min) | ✅ live |
| Morning digest + outcome check | digest crons (07:00, watchdogs, 19:00) | ✅ live |
| **Semantic recall across all of it** | `src/brain/` index + `brain:query` | ❌ **STUB — non-functional** |

**Critical finding:** `src/brain/embedder.ts` ships only `StubEmbedder` — it returns 8 floats derived from a SHA-256 hash of the input. There is **no production embedder**. `npm run brain:index` / `brain:query` execute structurally but on *fake* vectors, so semantic retrieval returns noise. Hermes can read a vault note **only when given the path**; it cannot semantically recall the relevant knowledge on its own. This is the single biggest blocker to the "knows everything" feeling.

**Unblock available now:** Portal exposes 25 embedding models. A `PortalEmbedder implements Embedder` (hitting Portal `/embeddings`) replaces the stub with zero interface change (the `Embedder` type is already pluggable — designed for this in Story 12.4).

### Pillar 2 — Automatic / hands-off  *(strong backbone; manual skills are the gap)*

**Already automatic (13 cron jobs + 2 systemd units):**
- Gateway self-heal: `@reboot` start + 3-min watchdog; `hermes-dashboard.service`, `hermes-gateway.service`
- NEXUS discord bridge watchdog (3 min)
- `dashboard-sync` (3 min), `awareness-pull` (3 min)
- Trend ingest news/reddit/google-trends (15/30/60 min)
- Morning digest + 3 push-digest watchdogs + outcome check (daily)
- Native memory auto-flush during chat (`flush_min_turns: 6`, `nudge_interval: 10`)

**Manual / on-demand (the "remember to run it" friction):**
- `triage`, `vault-lint`, `vault-graduate`, `session-close`, `vault-think`, `hermes-url-ingest-vault`, `notebook-query`, `investigate-trend`
- These are Discord-channel-bound CNS skills at `~/.hermes/skills/cns/` — invoked by the operator, not scheduled.

**Recall is not auto-injected:** even with a working Brain index, nothing currently loads relevant vault knowledge into a conversation automatically. That wiring must be designed (PRD §38–39 already flags: "no dedicated external-event-injection endpoint — awareness must be designed").

### Pillar 3 — Learns me / progressively smarter  *(weakest pillar)*

Live `memory:` config block:
```yaml
memory:
  memory_enabled: true        # ✅ on
  user_profile_enabled: true  # ✅ on
  write_approval: false        # ✅ writes without prompting
  memory_char_limit: 2200      # ⚠️ tiny
  user_char_limit: 1375        # ⚠️ tiny
  provider: ''                 # ⚠️ falls through to main model
  nudge_interval: 10
  flush_min_turns: 6
honcho: {}                     # ❌ EMPTY — dialectic user-modeling unconfigured
```
- Native memory **is** active: writes `~/.hermes/memories/MEMORY.md` (updated today), user profile **symlinked into the vault** (`USER.md → vault/AI-Context/USER.md`). Source: `agent/memory_manager.py`, `agent/memory_provider.py`.
- **Honcho user-modeling is empty** — the layer that actually "learns you" (PRD §37: "Honcho dialectic user-modeling") is not turned on.
- Memory budgets are very small (2200 / 1375 chars) — caps how much can compound.
- `session-close` is the loop that feeds memory (PRD G5: "session-close feeds memory") but it is **operator-triggered**, so learning only happens when the operator remembers to close out.

### Pillar 4 — Cost-effective  *(easy real lever identified)*

- **Verified:** the live cost lever is the `auxiliary:` block, which Hermes v0.17.0 **does** consume (`agent/auxiliary_client.py`). A task with `provider: none`/`auto` falls through to the **main model (Sonnet 4.6)**. Only `compression` is pinned to Haiku. `approval`, `skills_hub`, `mcp`, `title_generation`, `triage_specifier` currently run trivial side-work on Sonnet.
- **Verified:** `smart_model_routing` (shipped by story 78-2) has **zero consumers** in source — it is inert. The per-CNS-skill routing concept is not supported in v0.17.0; CNS skills always run on the main model.
- **Not applicable:** `provider_routing.sort: "price"` / ClawRouter is OpenRouter-specific; the system is on Nous Portal and has no `provider_routing` block.
- Embeddings: Portal embedding models are cheap; cost is a one-time vault index + incremental on change.

---

## 4. Gap analysis — what stands between "now" and the vision

| Vision pillar | Built | Missing (the work) |
|---------------|-------|--------------------|
| Knows everything | Ingestion + vault/state access | **Real embedder + Brain index + auto-injected semantic recall** |
| Hands-off | 13 cron jobs, gateway self-heal, memory auto-flush | **Auto-inject recall into chats; convert manual knowledge skills to scheduled/event-driven** |
| Learns me | Native memory on, profile in vault | **Honcho user-modeling; larger memory budgets; automatic session-close feeding loop** |
| Cost-effective | compression on Haiku | **Pin remaining auxiliary side-tasks to Haiku; correct/retire inert `smart_model_routing`** |

The automation *plumbing* is ~70% done. The missing 30% is precisely the part a human experiences as intelligence: **recall** and **learning**.

---

## 5. Target architecture — hands-off omniscient Hermes

**Principle: ingestion is already passive; make *recall* and *learning* passive too, and delete the manual skill triggers.**

```
                 ┌─────────────────────────────────────────────┐
                 │            INFORMATION AVENUES               │
                 │  Vault · Convex cockpit state · Trends ·     │
                 │  Digests · Inbox · Discord · run-chain       │
                 └───────────────┬─────────────────────────────┘
                                 │ (already automatic: cron + MCP + Epic 77)
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │   SEMANTIC INDEX (Brain) — PortalEmbedder, real vecs  │  ← FR16, Phase 1
        │   rebuilt incrementally on vault change (cron/watch)  │
        └───────────────┬──────────────────────────────────────┘
                        │ brain:query auto-injected as a Hermes tool
                        ▼
        ┌──────────────────────────────────────────────────────┐
        │   HERMES WORKING CONTEXT (per conversation)           │
        │   = native memory + Honcho user-model + recalled      │  ← FR15, Phase 2
        │     vault knowledge, loaded WITHOUT a manual skill    │
        └───────────────┬──────────────────────────────────────┘
                        │ talk/text (Discord, Desktop, voice)
                        ▼
        ┌──────────────────────────────────────────────────────┐
        │   LEARNING LOOP (passive)                             │
        │   session-close (automated) + Honcho dialectic →      │  ← FR15, Phase 2/3
        │   memory + user-model compound over time              │
        └──────────────────────────────────────────────────────┘

   Cost substrate (background): auxiliary side-tasks → Haiku; embeddings cheap.
```

### Sequencing rationale (recall → learning → automation)

1. **Recall first.** Learning and "knows everything" are both worthless if Hermes can't retrieve the right context. The embedder unblock is concrete, low-risk (pluggable interface already exists), and immediately raises the perceived intelligence of every conversation.
2. **Learning second.** Once recall works, the memory/Honcho layer has good material to compound on; configuring Honcho + raising budgets pays off.
3. **Automation third.** With recall + learning live, convert the manual knowledge skills to scheduled/event-driven so the whole thing is hands-off. (Doing this first would just automate a system that can't yet recall or learn.)
4. **Cost throughout (background).** Auxiliary→Haiku is a small parallel chore, not a phase gate.

---

## 6. Proposed initiative shape (for BMAD to expand into epics/stories)

> High-level phases only. Acceptance criteria and story decomposition are BMAD's job in Cursor.

**Phase 1 — Semantic recall (FR16)**
- `PortalEmbedder implements Embedder` → Portal `/embeddings` (Context7 the embeddings API first; never hardcode model from training data)
- Real Brain index build over vault corpus (respect `config/brain-corpus-allowlist*.json` + `indexing-secret-gate.ts`)
- Incremental re-index on vault change (cron or watch) — automatic, not manual
- Expose `brain:query` as a Hermes tool and **auto-inject top-k recall** into conversation context
- Cost guard: embed only changed notes; cache vectors

**Phase 2 — Learning loop (FR15)**
- Configure Honcho user-modeling (currently `honcho: {}`)
- Raise `memory_char_limit` / `user_char_limit` to sane budgets; verify `provider` choice (cheap model OK)
- Verify native memory actually persists + recalls across sessions (don't assume)
- Make `session-close` feed memory **automatically** (scheduled/event), not operator-triggered

**Phase 3 — Hands-off automation**
- Convert manual knowledge skills (`triage`, `vault-lint`, `vault-graduate`, `session-close`) to scheduled/event-driven where safe; keep operator override
- Single "ask Hermes anything about my system" path that transparently uses recall + memory (no skill name to remember)

**Background — Cost**
- Pin `approval`, `skills_hub`, `mcp`, `title_generation`, `triage_specifier` auxiliary tasks to Haiku via `nous`
- Correct the 78-2 record: real FR14 lever is `auxiliary:`, not inert `smart_model_routing`; decide whether to retire the dead block

---

## 7. Key technical findings BMAD must carry into stories

1. **Embedder is pluggable** — `src/brain/embedder.ts` exposes the `Embedder` type; the production adapter is a drop-in. No engine surgery.
2. **`smart_model_routing` is inert** in v0.17.0 — do not build further on it.
3. **`auxiliary:` is the real routing surface** and is consumed — safe to optimize.
4. **Honcho is off** (`honcho: {}`) — turning it on is the "learn me" lever.
5. **Portal embeddings (25 models) unblock FR16** — the long-standing blocker is gone.
6. **Context7 is mandatory** before implementing Portal `/embeddings` or Honcho config (resolve-library-id + query-docs; never training data).

---

## 8. Constraints carried forward (unchanged)

- **Protect-list — zero edits:** `src/agents/synthesis-adapter-llm.ts`, `hook-adapter-llm.ts`, `boss-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`. Brain work is additive (`src/brain/`), not adapter surgery.
- **WriteGate:** never directly edit `AI-Context/AGENTS.md`; route doc bumps via session-close.
- **Verify gate:** `bash scripts/verify.sh` green before every commit (+ sibling cns-dashboard when present).
- **Security:** no secrets in git; Portal keys via env/`auth.json`; no npm/pip package < 14 days old without approval.
- **Reversibility (NFR5):** every change config-reversible; embedder + Honcho behind flags.

---

## 9. Open questions for the planning pass

1. **Recall injection budget** — how much recalled context per turn before it crowds the conversation / costs too much? Needs a top-k + token cap policy.
2. **Index freshness vs cost** — re-index on every vault write (watch) or batched cron? Probably batched + on-demand.
3. **Honcho hosting** — local vs hosted Honcho; what does v0.17.0 expect? (Context7.)
4. **Memory budget ceiling** — how large is safe before main-model context bloat?
5. **Automating session-close** — what triggers a "session end" without an operator? Idle timeout? Daily? Needs definition.
6. **Privacy/governance** — auto-indexing the whole vault: confirm allowlist excludes secrets/protected zones (`indexing-secret-gate.ts` already exists — verify coverage).

---

## 10. Loop Engineering alignment (added 2026-06-25)

Operator surfaced a vault note — `03-Resources/AI-Native-Infrastructure/loop-engineering-anthropic-cns-gap-analysis.md` — mapping Anthropic's "Loop Engineering" framework (**Schedule → Discover → Build → Verify → Repeat**) against the CNS. The framework is the right vocabulary for the **hands-off automation pillar (Phase 3 / brief's v1.5)**. It does **not** add new pillars or reorder the sequence — it names and blueprints the automation phase. Two corrections were applied after verification:

**Correction 1 — adversarial verification already exists.** The note claims CNS review skills are "collaborative, not adversarial." Verified false: `bmad-code-review` runs *adversarial* layers (**Blind Hunter / Edge Case Hunter / Acceptance Auditor**), and `bmad-review-adversarial-general` + `bmad-review-edge-case-hunter` ship as standalone skills. The real gap is narrower: adversarial review is **operator-invoked, not wired into an autonomous loop.**

**Correction 2 — discovery gap is internal-state, not "digest is manual."** `morning-digest` *is* on cron (07:00 + watchdogs) but scans **external** signal (trends/news/reddit). The genuine gap: nothing autonomously scans **internal dev-state** (`agent-log.md`, `deferred-work.md`, `sprint-status.yaml`, fast-scan index) to surface a prioritized *work* list.

### Five-move mapping (verified)

| Loop move | CNS status | Lands in |
|-----------|-----------|----------|
| Discovery | external auto / internal manual | **v1 morning cockpit** — extend to scan internal dev-state |
| Handoff (worktrees) | Done (`EnterWorktree`, `.claude/worktrees/` live) | none |
| Adversarial verify | skills exist, manually invoked | **v1.5** — wire existing adversarial skills into the loop |
| Persistence | Exceeds (WriteGate, PAKE, audit trail) | done — primary moat |
| Scheduling (unified loop) | 13 separate crons, no composed cycle | **v1.5 "Unified Loop" run-chain** |

### Scope tension to resolve in the PRD (critical)

Loop Engineering's **"Build" move = agents autonomously do work.** The brief locked **no silent execution in v1** (Hermes announces actions; acts only after approval on destructive ops). Split cleanly to avoid breaking the brief's trust line:

- **Autonomous *discovery*** (surface prioritized work, informs only) → **v1, allowed.**
- **Autonomous *build/act*** (loop performs work) → **v1.5+, approval-gated** under the brief's "remind vs act" rule.

Letting the full loop run unattended in v1 would violate the brief's trust-reset condition ("silent vault corruption").

### Meta-observation

The framework's core insight — *"an agent grading its own work always praises it; independent verification is essential"* — is the operating model this initiative already runs: implementer agent (Cursor) builds, verifier agent reads actual diffs (this is how `smart_model_routing` inertness and the ElevenLabs-real finding were caught). The human + two-agent split **is** the adversarial-verification pattern, human-orchestrated. The gap is automating the loop already run by hand.

### PRD additions (Loop Engineering)

- **v1 Discovery requirement:** autonomous scan of internal dev-state (`agent-log.md`, `deferred-work.md`, `sprint-status.yaml`, fast-scan index) → prioritized work surface in the morning cockpit. Informs only; no execution.
- **v1.5 "Unified Loop" epic:** compose Discover + Build + adversarial-Verify (reuse `bmad-review-adversarial-general` / `bmad-code-review` Blind Hunter) + governed Persistence into one schedulable run-chain. Gated by no-silent-execution / approval-on-destructive. Worktree handoff already exists.

---

## 11. References (inspected this pass)

- `~/.hermes/hermes-agent/agent/auxiliary_client.py` — auxiliary routing (consumed); resolution chain
- `~/.hermes/hermes-agent/agent/memory_manager.py`, `agent/memory_provider.py` — native memory
- `~/.hermes/config.yaml` — `memory:`, `honcho:`, `auxiliary:` blocks
- `src/brain/embedder.ts` — StubEmbedder (the FR16 blocker)
- `src/brain/build-index.ts`, `retrieval/query-index.ts`, `indexing-secret-gate.ts`, `brain-index-manifest.ts`
- `package.json` — `brain:index`, `brain:query` scripts
- `crontab -l` — 13 automatic jobs
- `prd-hermes-consolidation.md` — G4/G5/G7, FR15/FR16, §37–39
- Portal Info page (operator-confirmed) — 237 inference + 25 embedding models, `openai-audio`
- `~/.hermes/hermes-agent/hermes_cli/config.py`, `hermes_cli/web_server.py` — `tts.provider` options (edge/elevenlabs/openai/neutts), `managed_nous_feature: tts`; STT default `local` (faster-whisper)
- Vault note: `03-Resources/AI-Native-Infrastructure/loop-engineering-anthropic-cns-gap-analysis.md` — Loop Engineering framework + CNS gap analysis (§10)
- Skill set: `bmad-code-review` (Blind Hunter/Edge Case Hunter/Acceptance Auditor), `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter` — adversarial verification already present
