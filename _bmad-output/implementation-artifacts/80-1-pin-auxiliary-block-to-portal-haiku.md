---
story_id: 80-1
epic: 80
title: pin-auxiliary-block-to-portal-haiku
status: done
zone: WSL ~/.hermes/config.yaml
branch: hermes-consolidation
evidence_file: _bmad-output/implementation-artifacts/80-1-auxiliary-haiku-evidence.md
baseline_hermes_version: v0.17.0 (2026.6.19)
baseline_commit: 68531e6e34d2a1f4bf11535a4bbbb18046908847
---

# Story 80.1: Pin `auxiliary:` block to Portal Haiku

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. Config-only operator story: ~/.hermes/config.yaml auxiliary block ONLY. smart_model_routing is INERT and OUT OF SCOPE (Story 80-2). Zero Omnipotent.md src/ changes. -->

## Story

As an **operator**,
I want **all listed auxiliary tasks pinned to `anthropic/claude-haiku-4.5` on Portal (`nous`)**,
so that **compression, approval, skills_hub, mcp, title_generation, and triage_specifier never fall through to `anthropic/claude-sonnet-4.6` (FR14, NFR6)**.

## Acceptance Criteria

1. **Prerequisite — Epic 74 Portal login active**
   **Given** Epic 74 Portal OAuth is live
   **When** this story begins
   **Then** `hermes portal info` shows **logged in** with **Nous inference provider**
   **And** `grep -A4 '^model:' ~/.hermes/config.yaml` shows `provider: nous`, `default: anthropic/claude-sonnet-4.6`
   **And** if Portal auth is missing, **stop** — re-run 74-2 OAuth before continuing

2. **Scope boundary — `auxiliary:` only; do NOT touch `smart_model_routing`**
   **Given** Hermes v0.17.0 source audit (Story 78-2 evidence)
   **When** implementation runs
   **Then** **only** keys under `auxiliary:` for the six listed tasks are modified
   **And** the top-level `smart_model_routing` block is **left unchanged** (confirmed inert/unconsumed — zero gateway readers; see `78-2-skill-routing-evidence.md`)
   **And** `model.default`, `model.provider`, `compression:` thresholds, voice/TTS, Brain recall, and protect-list paths are **untouched**
   **And** other auxiliary tasks (`vision`, `web_extract`, `kanban_decomposer`, `profile_describer`, `tts_audio_tags`, `curator`, etc.) are **out of scope** unless already pinned and left as-is

3. **Pin six auxiliary tasks to Portal Haiku**
   **Given** AC #1 prerequisite
   **When** operator sets each of the following tasks to `provider: nous`, `model: anthropic/claude-haiku-4.5`, with empty `base_url` and `api_key` (clear stale overrides per 74-3 pattern):
   - `auxiliary.compression` *(likely already correct from 74-3 — verify, do not regress)*
   - `auxiliary.approval`
   - `auxiliary.skills_hub`
   - `auxiliary.mcp`
   - `auxiliary.title_generation`
   - `auxiliary.triage_specifier`
   **Then** for each task, config shows:
   ```yaml
   provider: nous
   model: anthropic/claude-haiku-4.5
   base_url: ''
   api_key: ''
   ```
   **And** canonical CLI pattern (repeat per task):
   ```bash
   hermes config set auxiliary.<task>.provider nous
   hermes config set auxiliary.<task>.model anthropic/claude-haiku-4.5
   hermes config set auxiliary.<task>.base_url ""
   hermes config set auxiliary.<task>.api_key ""
   ```
   **And** `hermes config show` auxiliary section reflects Haiku on `nous` for all six tasks

4. **Haiku invocation proof — not Sonnet (FR14)**
   **Given** AC #3 config applied
   **When** operator runs **at least one** verification path per story (pick A + at least one auxiliary trigger from B):
   - **A (config smoke):** `hermes config show` excerpt + Python/YAML load confirming six tasks resolve to `nous` + `anthropic/claude-haiku-4.5`
   - **B (runtime proof — required for done):** Trigger an auxiliary path and capture log lines showing **`anthropic/claude-haiku-4.5`** (or Portal log equivalent), **not** `anthropic/claude-sonnet-4.6`:
     - **compression:** long-context turn in Discord `#hermes` or CLI until compression fires (see 74-3 smoke path A)
     - **title_generation:** start a new session / first message in a fresh thread
     - **approval:** invoke a command that triggers smart approval classifier (if observable)
     - **skills_hub:** skill search/discovery path (if used in operator workflow)
     - **mcp:** MCP helper auxiliary call (if observable in logs)
     - **triage_specifier:** `hermes kanban specify <id>` or dashboard ✨ Specify (if kanban enabled)
   **Then** evidence file includes **log excerpt or test harness output** proving Haiku invocation
   **And** **no fake log lines** — if a task cannot be triggered live, document "config-only for `<task>`" with explicit follow-up trigger note; at least **one** task must show runtime Haiku proof

5. **Watch keys — `triage_specifier` and `skills_hub` (operator note in evidence)**
   **Given** these two tasks affect routing/skill matching quality
   **When** post-pin smoke runs
   **Then** evidence file has an explicit **Watch keys** subsection for `triage_specifier` and `skills_hub`
   **And** operator records observed behavior (skill discovery quality, kanban specify output quality, any misrouting symptoms)
   **And** **if misrouting is observed**, revert **ONLY** the misbehaving key(s) to prior values documented in AC #6 — **do not** revert the entire auxiliary block or unrelated tasks

6. **Reversibility — prior values documented (NFR5)**
   **Given** config backup taken before edits (`~/.hermes/config.yaml.bak-YYYY-MM-DD-80-1`)
   **When** story completes
   **Then** evidence file `_bmad-output/implementation-artifacts/80-1-auxiliary-haiku-evidence.md` includes a **Rollback table** with **prior** `provider` + `model` for all six tasks (redacted — no secrets)
   **And** rollback commands are listed per task (inverse of AC #3 CLI pattern)

7. **Evidence file — redacted, no secrets (NFR4)**
   **Given** evidence is the done-proof for this config story
   **When** story completes
   **Then** `_bmad-output/implementation-artifacts/80-1-auxiliary-haiku-evidence.md` exists with:
   - Hermes version + Portal login status (no tokens)
   - Redacted `auxiliary:` excerpt for the six tasks (provider/model only)
   - Log excerpt or harness proof (AC #4)
   - Watch keys subsection (AC #5)
   - Rollback table (AC #6)
   - Explicit statement: **`smart_model_routing` not modified** (pointer to 80-2)
   **And** git diff contains **no** `.env`, `auth.json`, API keys, or OAuth secrets

8. **Scope boundary — no code / protect-list changes (NFR2)**
   **Given** this story is operator CLI + evidence only
   **When** implementation completes
   **Then** **zero diffs** in protect-list paths:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no edits to `~/.hermes/hermes-agent` core fork
   **And** `bash scripts/verify.sh` passes (NFR1)

## Tasks / Subtasks

- [x] **AC #1 — Portal preflight** (AC: #1)
  - [x] `hermes --version` → v0.17.x
  - [x] `hermes portal info` → logged in, Nous inference
  - [x] Confirm main model still Sonnet 4.6 on `nous`

- [x] **AC #2 — Confirm scope** (AC: #2)
  - [x] Read `78-2-skill-routing-evidence.md` — do not edit `smart_model_routing`
  - [x] List in Dev Agent Record: files/keys that must NOT change

- [x] **AC #3 — Backup + pin six tasks** (AC: #3)
  - [x] Copy `~/.hermes/config.yaml` → `~/.hermes/config.yaml.bak-YYYY-MM-DD-80-1`
  - [x] Record **prior values** for rollback table before any edit
  - [x] Run `hermes config set` for each of six tasks (compression verify-first)
  - [x] `grep`/YAML verify all six blocks

- [x] **AC #4 — Runtime Haiku proof** (AC: #4)
  - [x] Trigger ≥1 auxiliary path; grep `~/.hermes/logs/` (agent.log, gateway.log) for Haiku model id
  - [x] Confirm absence of Sonnet model id on those auxiliary log lines

- [x] **AC #5 — Watch keys assessment** (AC: #5)
  - [x] Exercise or document `skills_hub` + `triage_specifier` behavior
  - [x] If misrouting: partial revert per AC #5 only

- [x] **AC #6–#8 — Evidence + verify** (AC: #6, #7, #8)
  - [x] Write `80-1-auxiliary-haiku-evidence.md`
  - [x] `git status` / `git diff` — Omnipotent.md evidence only; no secrets
  - [x] `bash scripts/verify.sh` → exit 0

## Dev Notes

### Epic and sequencing context

- **Epic 80 (Cost-Effective Auxiliary Routing)** — Phase B1 · **FR14** · **NFR5, NFR6**
- **Story 80-1** pins the consumed routing surface (`auxiliary:`). **Story 80-2** retires inert `smart_model_routing` + operator guide — **not this story**.
- **Depends:** Epic 74 Portal login (done). **Parallel:** May run alongside Epic 79/81; no recall/voice dependency.
- **Supersedes intent of Epic 78 FR14:** Per-skill `smart_model_routing` was config-ready but consumer-pending; real cost lever is `auxiliary:` per resurfacing research.

[Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §Epic 80, §Story 80-1, §FR14]

### Why `auxiliary:` and not `smart_model_routing`

| Config key | Hermes v0.17.0 consumer? | This story |
|------------|-------------------------|------------|
| `auxiliary.<task>.*` | **Yes** — `agent/auxiliary_client.py` | **MODIFY** (six tasks) |
| `smart_model_routing` | **No** — deep-merge stores only; zero gateway reader | **DO NOT TOUCH** |

[Source: `_bmad-output/implementation-artifacts/78-2-skill-routing-evidence.md` §AC #2, #4]

### Live baseline (verify at story start — do not assume)

Captured 2026-07-03 at story creation:

| Task | Current `provider` | Current `model` | Action |
|------|-------------------|-----------------|--------|
| `compression` | `nous` | `anthropic/claude-haiku-4.5` | **Verify only** — already pinned (74-3) |
| `approval` | `none` | `gemini-2.5-flash` | **Pin to nous/Haiku** |
| `skills_hub` | `none` | `gemini-2.5-flash` | **Pin to nous/Haiku** — **watch key** |
| `mcp` | `none` | `gemini-2.5-flash` | **Pin to nous/Haiku** |
| `title_generation` | `none` | `gemini-2.5-flash` | **Pin to nous/Haiku** |
| `triage_specifier` | `auto` | `''` (empty) | **Pin to nous/Haiku** — **watch key** |

**Fallthrough behavior today:** `provider: auto` or misconfigured `none` routes auxiliary work through resolution chains that can end on the **main model (Sonnet 4.6)**. Explicit `provider: nous` + `model: anthropic/claude-haiku-4.5` bypasses that fallthrough.

[Source: `_bmad-output/planning-artifacts/research-hermes-omniscience-resurfacing.md` §Pillar 4; Hermes docs §Auxiliary Models — `auto` uses main model]

### Operator CLI runbook (canonical sequence)

```bash
# 0. Preflight
hermes --version
hermes portal info
grep -A4 '^model:' ~/.hermes/config.yaml

# 1. Backup + record prior values for evidence rollback table
cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%Y-%m-%d)-80-1

# 2. Pin each task (compression: verify first; skip if already nous/Haiku)
for task in compression approval skills_hub mcp title_generation triage_specifier; do
  hermes config set auxiliary.${task}.provider nous
  hermes config set auxiliary.${task}.model anthropic/claude-haiku-4.5
  hermes config set auxiliary.${task}.base_url ""
  hermes config set auxiliary.${task}.api_key ""
done

# 3. Verify
hermes config show
python3 -c "
import yaml
cfg = yaml.safe_load(open('$HOME/.hermes/config.yaml'))
aux = cfg.get('auxiliary', {})
targets = ['compression','approval','skills_hub','mcp','title_generation','triage_specifier']
for t in targets:
    b = aux.get(t, {})
    print(f'{t}: provider={b.get(\"provider\")} model={b.get(\"model\")}')
"

# 4. Optional gateway restart if config hot-reload doesn't apply (74-3: compression reloads on next message; restart if uncertain)
hermes gateway restart

# 5. Runtime proof — grep logs after triggering auxiliary work
grep -E 'haiku|sonnet|Auxiliary' ~/.hermes/logs/agent.log | tail -30
```

### Verification harness options

| Method | When to use |
|--------|-------------|
| `hermes config show` + YAML parse | Always — config smoke |
| Log grep `~/.hermes/logs/agent.log` | After live auxiliary trigger — **required for done** |
| Long-context compression turn | Proven path from 74-3 |
| New session title generation | Lightweight auxiliary trigger |
| `hermes kanban specify <id>` | Tests `triage_specifier` watch key |

**Do not** claim AC #4 PASS from config alone — at least one runtime log line must show Haiku.

### Watch keys — partial revert protocol

If `skills_hub` or `triage_specifier` misroutes after Haiku pin:

1. Document symptom in evidence (what broke, which command/skill).
2. Restore **only** the failing task from rollback table, e.g.:
   ```bash
   hermes config set auxiliary.skills_hub.provider none
   hermes config set auxiliary.skills_hub.model gemini-2.5-flash
   ```
3. Leave other four pinned tasks on Haiku.
4. Note partial revert in evidence; file follow-up in `deferred-work.md` if needed.

### Architecture compliance

| Requirement | Compliance |
|-------------|------------|
| **FR14** | Auxiliary side-work on Haiku; main Sonnet for operator turns |
| **NFR2** | Config-only; protect-list zero edits; no Hermes core fork |
| **NFR4** | Evidence redacted; no secrets in git |
| **NFR5** | Backup + rollback table in evidence |
| **NFR6** | Auxiliary never on main model after pin |
| **NFR1** | `bash scripts/verify.sh` before done |

### File structure requirements

| Path | Action |
|------|--------|
| `~/.hermes/config.yaml` | **UPDATE** — `auxiliary:` six tasks only (outside git) |
| `_bmad-output/implementation-artifacts/80-1-auxiliary-haiku-evidence.md` | **CREATE** — done proof |
| `_bmad-output/implementation-artifacts/80-1-pin-auxiliary-block-to-portal-haiku.md` | Story file (this doc) |
| Omnipotent.md `src/**`, `scripts/**` (except evidence) | **NO CHANGE** |

### Testing requirements

- **Gate:** `bash scripts/verify.sh` must exit 0 before marking story done (NFR1).
- **No new unit tests** in Omnipotent.md — operator config story; evidence file is the functional test record.
- **Optional local:** Hermes upstream `tests/agent/test_auxiliary_client.py` patterns if dev needs to understand provider resolution — not a story deliverable.

### Previous story intelligence (Epic 74 / 78)

| Story | Relevant learning |
|-------|-------------------|
| **74-3** | `hermes config set auxiliary.compression.*` CLI pattern; clear `base_url`/`api_key`; evidence file pattern; config hot-reload on next gateway message |
| **34-1** | Early auxiliary cost work — model id namespace changed (`claude-haiku-4-5-20251001` → Portal `anthropic/claude-haiku-4.5`) |
| **78-2** | `smart_model_routing` inert — **do not build on it**; real lever is `auxiliary:` |

### Latest technical information (Context7 + Hermes docs)

- **Context7 ID:** `/nousresearch/hermes-agent`
- **Auxiliary config pattern:** Every task uses `provider`, `model`, `base_url`, `api_key`; set via `hermes config set auxiliary.<task>.<field> <value>`
- **Provider `nous`:** Requires `hermes portal info` logged in; routes to Portal inference API
- **Target model:** `anthropic/claude-haiku-4.5` (Portal namespace — not legacy `claude-haiku-4-5-20251001`)
- **Default `auto` behavior (v0.17):** Uses main chat model — explains Sonnet cost on unconfigured tasks

[Source: Context7 `/nousresearch/hermes-agent` — auxiliary config, fallback-providers; Hermes `website/docs/user-guide/configuration.md` §Auxiliary Models]

### Project context reference

- Constitution: no WriteGate impact — config lives in `~/.hermes/`, not vault `AI-Context/`
- Branch: `hermes-consolidation`
- Evidence pattern: Epic 74/78/79 stories — redacted config keys + log proof in `_bmad-output/implementation-artifacts/`
- **80-2 follow-up:** Retire `smart_model_routing` + operator guide — explicitly deferred

### Anti-patterns

- **Do not** edit or remove `smart_model_routing` in this story (80-2 owns that).
- **Do not** change `model.default` to Haiku — main operator turns stay on Sonnet 4.6.
- **Do not** commit `~/.hermes/config.yaml` to Omnipotent.md.
- **Do not** paste tokens, OAuth secrets, or inline `api_key` values into evidence.
- **Do not** revert entire auxiliary block if only one watch key misroutes.
- **Do not** fake log excerpts — consumer-pending honesty rule from 78-2 applies.

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §Story 80-1, lines 440–457]
- [Source: `_bmad-output/planning-artifacts/research-hermes-omniscience-resurfacing.md` §Pillar 4]
- [Source: `_bmad-output/implementation-artifacts/78-2-skill-routing-evidence.md`]
- [Source: `_bmad-output/implementation-artifacts/74-3-auxiliary-compression-on-portal.md`]
- [Source: `~/.hermes/hermes-agent/agent/auxiliary_client.py` — consumed routing surface]
- [Source: Hermes docs — Auxiliary Models, Fallback Providers]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Portal preflight: Hermes v0.17.0, Nous logged in, main model Sonnet 4.6 on `nous`
- Config backup: `~/.hermes/config.yaml.bak-2026-07-03-80-1`
- Runtime proof: `title_generation` harness → `Auxiliary title_generation: using nous (anthropic/claude-haiku-4.5)`
- Verify: initial fail on session-close SKILL.md parity drift (pre-existing); synced repo mirror → installed skill; verify PASS

### Scope — keys/paths NOT modified

- `smart_model_routing` (in `~/.hermes/config.yaml`)
- `model.default`, `model.provider`, `compression:` thresholds
- voice/TTS, Brain recall settings
- Omnipotent.md protect-list: `src/agents/synthesis-adapter-llm.ts`, `hook-adapter-llm.ts`, `boss-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`
- Other auxiliary tasks: `vision`, `web_extract`, `kanban_decomposer`, `profile_describer`, `tts_audio_tags`, `curator`

### Completion Notes List

- Pinned six auxiliary tasks (`compression`, `approval`, `skills_hub`, `mcp`, `title_generation`, `triage_specifier`) to `nous` / `anthropic/claude-haiku-4.5`
- `compression` was already correct (74-3); verified unchanged
- `approval`, `skills_hub`, `mcp`, `title_generation` migrated from `none`/`gemini-2.5-flash`
- `triage_specifier` migrated from `auto`/empty
- Runtime Haiku proof via `title_generation` harness (log line shows Portal Haiku, not Sonnet)
- Watch keys (`skills_hub`, `triage_specifier`): config-only assessment; no misrouting observed
- Evidence file created with rollback table and redacted config excerpt
- `bash scripts/verify.sh` PASS

### File List

- `~/.hermes/config.yaml` (UPDATE — auxiliary six tasks; outside git)
- `~/.hermes/config.yaml.bak-2026-07-03-80-1` (CREATE — backup; outside git)
- `~/.hermes/skills/cns/session-close/SKILL.md` (UPDATE — parity sync for verify gate; outside git)
- `_bmad-output/implementation-artifacts/80-1-auxiliary-haiku-evidence.md` (CREATE)
- `_bmad-output/implementation-artifacts/80-1-pin-auxiliary-block-to-portal-haiku.md` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Change Log

- 2026-07-03: Pinned six auxiliary tasks to Portal Haiku; evidence + verify complete; status → review
