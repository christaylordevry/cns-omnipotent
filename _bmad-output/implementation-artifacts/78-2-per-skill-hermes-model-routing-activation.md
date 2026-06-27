---
baseline_commit: 8d4ea80
branch: hermes-consolidation
---

# Story 78.2: Per-skill Hermes model routing activation

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. Config-only activation on ~/.hermes/config.yaml routing block + routing.md governance. Zero Omnipotent.md src/ changes. Protect-list untouched. FR14 + ADR-HERMES-010. Depends 78-1 config (auto_tts=true); Desktop E2E deferred — not blocking. -->

## Story

As an **operator**,
I want **cheap models routed for cheap Hermes skills**,
so that **subscription cost stays low after Portal migration (FR14)**.

## Acceptance Criteria

1. **Prerequisites — Epic 74 Portal + Layer-3 reference (mandatory)**
   **Given** Epic **74** Portal primary is live (`model.provider: nous`, default `anthropic/claude-sonnet-4.6`)
   **And** Epic **15** Layer-3 routing engine exists in Omnipotent.md (`src/routing/`, `config/model-routing/`)
   **And** story **78-1** config baseline is done (`voice.auto_tts: true`; AC#4 Desktop E2E may remain PARTIAL — **not blocking**)
   **When** this story begins
   **Then** WSL baseline passes:
   ```bash
   hermes --version                    # expect v0.17.x
   hermes portal info                  # logged in, Nous inference provider
   grep -A4 '^model:' ~/.hermes/config.yaml
   grep -A3 'compression:' ~/.hermes/config.yaml   # Haiku compression already on nous
   pgrep -af 'hermes_cli.main gateway' # Discord gateway running
   ```
   **And** if any prerequisite fails, **stop** — restore Epic 74 state before routing work

2. **Context7 gate — Hermes skill routing API (mandatory before config write)**
   **Given** AC #1 passes
   **When** dev implements routing activation
   **Then** dev runs Context7 **in order**:
   1. `resolve-library-id` → `/nousresearch/hermes-agent`
   2. `query-docs` → per-skill model routing, `smart_model_routing`, skill model override, `config.yaml` routing block
   **And** dev inspects live Hermes source at `~/.hermes/hermes-agent/hermes_cli/config.py` (`DEFAULT_CONFIG`) for consumed keys (`smart_model_routing`, `routing`, skill-level model fields)
   **And** chosen config shape in AC #3 matches **Context7 + source**, not training data
   **And** Dev Agent Record cites Context7 query topic + whether `smart_model_routing` is consumed in v0.17.x

3. **Per-skill routing block activated in `~/.hermes/config.yaml`**
   **Given** Context7 gate from AC #2
   **When** operator activates CNS skill routing in **`~/.hermes/config.yaml` only** (routing block — not global `model.default` regression)
   **Then** config includes a **top-level routing policy** (key name per Hermes docs — fallback name `smart_model_routing` if documented in Hermes AGENTS.md top-level sections):
   ```yaml
   # Example shape — normalize keys to Context7 / DEFAULT_CONFIG at implementation time
   smart_model_routing:
     enabled: true
     tiers:
       fast:
         cns_alias: fast                    # Epic 15 registry crosswalk
         provider: nous
         model: anthropic/claude-haiku-4.5
       standard:
         cns_alias: default-coding          # Epic 15 registry crosswalk
         provider: nous
         model: anthropic/claude-sonnet-4.6
     skills:
       triage: fast
       vault-lint: fast
       vault-graduate: fast
       session-close: fast
       hermes-url-auto-capture-inbox: fast
       notebook-query: fast
       investigate-trend: fast
       awareness-sync: fast
       hermes-cns-verify-gate-summary: fast
       vault-think: standard
       run-chain: standard
       hermes-url-ingest-vault: standard
       morning-digest: standard
   ```
   **And** global primary remains **`model.provider: nous`** + **`model.default: anthropic/claude-sonnet-4.6`** (unchanged unless Context7 requires explicit `standard` tier as default)
   **And** **`auxiliary.compression`** stays **`anthropic/claude-haiku-4.5`** on `nous` (already cost-optimized — do not regress)
   **And** at minimum **`triage`** (cheap tier) and **`vault-think`** or **`run-chain`** (standard tier) are mapped to **different tiers**
   **And** gateway restarted after config change:
   ```bash
   hermes gateway restart
   # or operator's usual gateway launcher; confirm pgrep gateway PID
   ```

4. **Runtime demonstration — two skills, two tiers (with documented aliases)**
   **Given** AC #3 routing block saved and gateway restarted
   **When** operator runs two smoke invocations in Discord `#hermes` (or WSL `hermes chat` if Discord unavailable):
   1. **Cheap tier:** `/triage` (or minimal triage trigger per skill docs)
   2. **Standard tier:** `/challenge` or `/verify` (vault-think skill) **or** explicit `run-chain` trigger if operator-approved
   **Then** evidence shows **different resolved model IDs** for the two invocations (gateway log grep, Portal usage dashboard, or Hermes session metadata — redact secrets)
   **And** evidence table maps each skill → **CNS alias** (`fast` / `default-coding`) → **Portal model ID**
   **If** Hermes v0.17.x does not yet consume `smart_model_routing` at runtime: document **config-ready / consumer-pending** in evidence, file follow-up in `deferred-work.md`, and still pass AC #3 + #5 + #7 — do **not** fake log lines

5. **`routing.md` governance — skill→model map (NFR5, ADR-HERMES-010)**
   **Given** AC #3 tier map is finalized
   **When** governance is updated
   **Then** both copies are **identical** after save:
   - Repo mirror: `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`
   - Canonical vault: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`
   **And** new subsection **Hermes per-skill routing (Epic 78 / FR14)** includes:
   - Tier table: CNS alias → Portal provider/model → typical cost posture
   - Skill→tier map (all CNS skills at `~/.hermes/skills/cns/`, at least triage + vault-think/run-chain called out)
   - Crosswalk to Epic 15 aliases in `config/model-routing/model-alias-registry.json` (`fast`, `default-coding`, `default-reasoning`)
   - Note: **run-chain LLM stages** remain on **FR11 Option A** (`ANTHROPIC_API_KEY` / protect-list adapters) — this story routes **Hermes skill invocations** only
   - Reconciliation date + `hermes --version`
   **And** existing Epic 15 IDE routing + Epic 74 global Hermes surface table are **not removed or broken**
   **And** `diff -q` between repo mirror and canonical vault passes for `routing.md`

6. **Protect-list + scope boundary (NFR2, FR11)**
   **Given** this story activates Hermes config + governance only
   **When** story closes
   **Then** git diff has **zero** changes under protect-list:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** **no** `src/` or `dist/` edits in Omnipotent.md (config lives in `~/.hermes/`, not git)
   **And** the **`run-chain` Hermes skill** (`~/.hermes/skills/cns/run-chain/`) may remain bound — it triggers the protect-list **script** via `terminal()`; do not edit adapter TypeScript

7. **Verify gate + evidence (NFR1)**
   **Given** AC #2–#6 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/78-2-skill-routing-evidence.md` exists with dated PASS/FAIL/PARTIAL per AC (redacted)
   **And** `bash scripts/verify.sh` passes **unchanged**
   **And** `deferred-work.md` §Per-skill Hermes model routing updated (unblocked → done or consumer-pending note)
   **And** no secrets in git (`.env`, `auth.json`, OAuth tokens)

## Tasks / Subtasks

- [x] **AC #1 — WSL + Portal + gateway preflight** (AC: #1)
  - [x] Run baseline commands; capture redacted excerpts in evidence scaffold
  - [x] Confirm 78-1 `auto_tts: true` still set (voice config unchanged by this story)

- [x] **AC #2 — Context7 + Hermes source discovery** (AC: #2)
  - [x] `resolve-library-id` + `query-docs` for skill routing / smart_model_routing
  - [x] Grep `~/.hermes/hermes-agent/hermes_cli/config.py` and gateway for consumed routing keys
  - [x] Record chosen config schema in Dev Agent Record

- [x] **AC #3 — Activate routing block in config.yaml** (AC: #3)
  - [x] Back up `~/.hermes/config.yaml` (date suffix)
  - [x] Add tier + skill map (minimum triage=fast, vault-think or run-chain=standard)
  - [x] Restart gateway; confirm running

- [x] **AC #4 — Two-skill smoke + evidence** (AC: #4)
  - [x] Discord or CLI smoke for cheap vs standard skill
  - [x] Capture model resolution proof or document consumer-pending gap honestly

- [x] **AC #5 — routing.md skill→model map** (AC: #5)
  - [x] Update repo mirror + canonical vault; `diff -q` clean
  - [x] Preserve Epic 15 + Epic 74 sections

- [x] **AC #6 — Protect-list + scope check** (AC: #6)
  - [x] Confirm no protect-list or `src/` diffs

- [x] **AC #7 — Evidence + verify + deferred-work** (AC: #7)
  - [x] Complete `78-2-skill-routing-evidence.md`
  - [x] `bash scripts/verify.sh` green

## Dev Notes

### Epic and sequencing context

- **Epic 78 (JARVIS Voice + Model Routing)** — story **78-2** activates **FR14** per-skill routing; follows **78-1** (voice config; may stay `in-progress` for Desktop E2E).
- **Does not include:** **78-3** operator guide vault section (WriteGate), Omnipotent.md `src/` changes, protect-list adapter edits, run-chain engine credential path changes (FR11 Option A).
- **Branch:** `hermes-consolidation`.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 78-2; `sprint-status.yaml` Epic 78]

### Architecture compliance (ADR-HERMES-010, FR14, D2)

| Decision | Requirement for this story |
|----------|---------------------------|
| **ADR-HERMES-010** | Per-skill routing activation **post-Epic 74** (Portal native model IDs) |
| **FR14** | Cheap models for cheap Hermes skills; subscription cost control |
| **D2 ownership** | `~/.hermes/` config + `routing.md` governance |
| **Epic 15 Layer-3** | Reference only — alias names (`fast`, `default-coding`) crosswalk; **do not** wire Cursor/Claude Code adapters in this story |
| **FR11 Option A** | Run-chain **adapters** stay on `ANTHROPIC_API_KEY`; Hermes **skill** routing is separate |
| **NFR2** | Discord gateway + morning-digest cron must remain operational after gateway restart |
| **NFR5** | Reversible — document rollback: disable `smart_model_routing.enabled: false` or remove block; global Sonnet default unchanged |
| **Protect-list** | Zero edits to `src/agents/*`, `scripts/run-chain.ts` |

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §ADR-HERMES-010, §Epic D2; `project-context.md` §ADR table]

### Current live config baseline (story prep 2026-06-25)

| Key | Current value | Story target |
|-----|---------------|--------------|
| `model.provider` | `nous` | **unchanged** |
| `model.default` | `anthropic/claude-sonnet-4.6` | **unchanged** (standard tier reference) |
| `auxiliary.compression.model` | `anthropic/claude-haiku-4.5` | **unchanged** |
| `smart_model_routing` | absent | **ADD** tier + skill map |
| All `#hermes` skills | inherit global Sonnet | **route** cheap skills to Haiku tier |

**Policy source (deferred-work.md):** Haiku for triage/graduate/vault-lint/session-close; Sonnet for vault-think/verify/run-chain.

[Source: `_bmad-output/implementation-artifacts/deferred-work.md` §Per-skill Hermes model routing; live `~/.hermes/config.yaml` grep]

### Layer-3 routing engine (Omnipotent.md — reference, do not reimplement)

Epic **15** shipped a **pure decision engine** for IDE surfaces — use for **alias governance only**:

| Artifact | Path |
|----------|------|
| Decision engine | `src/routing/decision-engine.ts` |
| Alias registry | `config/model-routing/model-alias-registry.json` |
| Policy defaults | `config/model-routing/policy.defaults.json` |
| Operator README | `config/model-routing/_README.md` |
| Tests | `tests/model-routing/*.test.ts` |

**Portal model crosswalk (CNS aliases → live Nous IDs):**

| CNS alias (Epic 15) | Portal model (Hermes `nous`) | Tier |
|---------------------|------------------------------|------|
| `fast` | `anthropic/claude-haiku-4.5` | Cheap Hermes skills |
| `default-coding` | `anthropic/claude-sonnet-4.6` | Standard / synthesis-class skills |
| `default-reasoning` | `anthropic/claude-sonnet-4.6` | (same Sonnet class for v1) |

Hermes skill routing is **config activation**, not a new TypeScript adapter in this story.

[Source: `config/model-routing/model-alias-registry.json`; `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` §Hermes agent surface]

### CNS Hermes skills inventory (`~/.hermes/skills/cns/`)

| Skill | Suggested tier | Rationale |
|-------|----------------|-----------|
| `triage` | **fast** | Read-only inbox preview + heuristics |
| `vault-lint` | **fast** | Deterministic lint scan |
| `vault-graduate` | **fast** | Promotion heuristics |
| `session-close` | **fast** | Script-heavy; synthesis section bounded |
| `hermes-url-auto-capture-inbox` | **fast** | Inbox capture only |
| `notebook-query` | **fast** | Routing + query |
| `investigate-trend` | **fast** | Perplexity-forward |
| `awareness-sync` | **fast** | Snapshot read + format |
| `hermes-cns-verify-gate-summary` | **fast** | CLI verify wrapper |
| `vault-think` | **standard** | Reasoning commands (/challenge, /verify, …) |
| `run-chain` | **standard** | Orchestrates chain (engine uses Anthropic key separately) |
| `hermes-url-ingest-vault` | **standard** | Governed SourceNote + fetch |
| `morning-digest` | **standard** | Multi-source synthesis path |

[Source: `~/.hermes/config.yaml` `discord.channel_skill_bindings`; skill SKILL.md overviews]

### Technical requirements (Context7 — implement from docs, not training data)

**Mandatory discovery queries (Hermes Agent `/nousresearch/hermes-agent`):**
- `smart_model_routing` config schema and `enabled` flag
- Per-skill model override vs global `model.default`
- Gateway restart / hot-reload behavior for routing keys
- Discord skill invocation model resolution logging

**Known v0.17.0 context (story prep — verify at implementation):**
- Hermes `AGENTS.md` lists `smart_model_routing` as a top-level `config.yaml` section
- `agent/coding_context.py` documents `model_hint` as an **extension seam** ("not yet consumed by the router")
- `channel_skill_bindings` supports **skills list only** — no per-binding `model` field
- **Delegation** and **cron** support global/per-job model overrides — **not** per Discord skill routing
- If `smart_model_routing` is not in `DEFAULT_CONFIG`, deep-merge may still store it; confirm whether gateway reads it before claiming AC #4 PASS

**Fallback if consumer missing:** Ship config + governance (AC #3, #5, #7); mark AC #4 **PARTIAL** with deferred consumer note — do **not** patch Hermes gateway in this story.

[Source: Context7 `/nousresearch/hermes-agent`; `~/.hermes/hermes-agent/AGENTS.md`; `agent/coding_context.py`]

### File structure requirements

| Path | Action |
|------|--------|
| `~/.hermes/config.yaml` | **UPDATE** — routing / `smart_model_routing` block only |
| `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` | **UPDATE** — skill→model map + tier crosswalk |
| `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` | **UPDATE** — must match repo mirror |
| `_bmad-output/implementation-artifacts/78-2-skill-routing-evidence.md` | **NEW** — PASS/FAIL evidence |
| `_bmad-output/implementation-artifacts/deferred-work.md` | **UPDATE** — close or note consumer-pending |
| `src/**`, `scripts/run-chain.ts`, `src/agents/*` | **DO NOT TOUCH** |
| `~/.hermes/skills/cns/*/SKILL.md` | **Avoid** unless Context7 documents skill-frontmatter model override as the native API |

### Testing requirements

- **Primary test:** Manual two-skill smoke (AC #4) + gateway log / Portal usage proof
- **Regression gate:** `bash scripts/verify.sh` must pass with **no** Omnipotent.md code changes
- **Discord regression:** gateway PID alive; optional lightweight `#hermes` ping after restart
- **Do not** add Omnipotent.md vitest that mocks Hermes routing unless it only validates `routing.md` content (optional, not required by AC)

### Previous story intelligence (78-1 — direct dependency)

From **78-1** (`in-progress`, config done):
- `voice.auto_tts: true` set; Tool Gateway audio configured; Desktop E2E **PARTIAL** (no packaged `.exe`)
- **78-2 explicitly unblocked** — pure `~/.hermes/config.yaml` work; no Desktop dependency
- Pattern: operator evidence in `_bmad-output/implementation-artifacts/`, `verify.sh` unchanged, protect-list clean
- Voice uses **`openai-audio`** Tool Gateway — separate from inference tier routing

[Source: `_bmad-output/implementation-artifacts/78-1-portal-tts-and-push-to-talk-on-desktop.md`]

### Previous story intelligence (74-8 — routing.md baseline)

From **74-8** (done):
- `routing.md` has **global** Hermes surface table (Sonnet primary, Haiku compression, codex fallback)
- **No skill→model map yet** — this story adds it
- Both vault copies must stay identical (`diff -q`)
- WriteGate: do **not** edit `AI-Context/AGENTS.md` directly — defer module table bumps to session-close / **78-3**

[Source: `_bmad-output/implementation-artifacts/74-8-portal-and-desktop-governance-documentation.md`]

### Git intelligence (recent hermes-consolidation work)

Recent commits: Epic **77** awareness (`77-2` pull client, `77-4` skill). No prior FR14 routing work — **greenfield config** on existing Portal stack. Follow Epic **74/78-1** pattern: evidence files in `_bmad-output/implementation-artifacts/`, zero `src/` diff.

### Latest tech information (Hermes v0.17.0 + Portal)

- **Portal inference:** `nous` provider with OpenRouter-style model IDs (`anthropic/claude-sonnet-4.6`, `anthropic/claude-haiku-4.5`)
- **Compression already on Haiku** via `auxiliary.compression` — complementary to skill routing, not a substitute
- **`hermes portal info`** — inspect Tool Gateway + inference health after routing changes
- **`smart_model_routing`** — listed in Hermes contributor docs; runtime consumption must be verified in source before claiming automatic routing

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — routing module pointer §7; no direct AGENTS edit this story
- CNS Phase 1 spec: **not applicable** (no Vault IO MCP changes)
- Sprint: Epic **78** `in-progress`; **78-3** follows after **78-2**
- Branch: `hermes-consolidation`

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 78, Story 78-2]
- [Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR14]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §ADR-HERMES-010, §D2]
- [Source: `config/model-routing/_README.md`, `model-alias-registry.json`]
- [Source: `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`]
- [Source: Context7 `/nousresearch/hermes-agent` — configuring-models, configuration, delegation]
- [Source: `_bmad-output/implementation-artifacts/78-1-portal-tts-and-push-to-talk-on-desktop.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` §Per-skill Hermes model routing]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Context7 `/nousresearch/hermes-agent`: no published `smart_model_routing` tier/skills YAML schema; AGENTS.md lists section name only
- `rg smart_model_routing` → only `AGENTS.md`; not in `DEFAULT_CONFIG` or `gateway/`
- `load_config()` confirms block persisted; gateway restart PID 2248111

### Completion Notes List

- Activated `smart_model_routing` in `~/.hermes/config.yaml` (13 CNS skills: 9 fast / 4 standard). Global Sonnet + Haiku compression unchanged.
- Updated `routing.md` (repo mirror + canonical vault) with Epic 78 tier table, skill map, FR11 run-chain note, consumer-pending status.
- AC #4 **PARTIAL**: Hermes v0.17.0 stores config but does not route by skill at runtime yet; documented honestly in evidence + deferred-work.
- `bash scripts/verify.sh` PASS (2026-06-25). Zero protect-list / `src/` changes.

### File List

- `~/.hermes/config.yaml` (UPDATE — `smart_model_routing` block; outside git)
- `~/.hermes/config.yaml.bak-2026-06-25-78-2` (NEW backup; outside git)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (UPDATE)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (UPDATE — synced)
- `_bmad-output/implementation-artifacts/78-2-skill-routing-evidence.md` (NEW)
- `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)
- `_bmad-output/implementation-artifacts/78-2-per-skill-hermes-model-routing-activation.md` (UPDATE)

### Change Log

- 2026-06-25: Story 78-2 — per-skill Hermes routing config activation + routing.md governance; consumer-pending for runtime router (Hermes v0.17.0)
