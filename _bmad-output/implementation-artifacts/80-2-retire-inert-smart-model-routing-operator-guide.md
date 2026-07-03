---
story_id: 80-2
epic: 80
title: retire-inert-smart-model-routing-operator-guide
status: done
baseline_commit: 68531e6e34d2a1f4bf11535a4bbbb18046908847
zone: WSL ~/.hermes/config.yaml + vault docs via session-close
branch: hermes-consolidation
evidence_file: _bmad-output/implementation-artifacts/80-2-retire-smart-model-routing-evidence.md
baseline_hermes_version: v0.17.0 (2026.6.19)
depends_on: 80-1-pin-auxiliary-block-to-portal-haiku (done)
---

# Story 80.2: Retire inert `smart_model_routing` + operator guide

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. Config comment-out + vault documentation via session-close only. Zero Omnipotent.md src/ changes. auxiliary: is the sole routing lever; smart_model_routing has zero consumers in Hermes v0.17.0. -->

## Story

As a **maintainer**,
I want **`smart_model_routing` commented out with deprecation documented in operator-facing vault docs**,
so that **operators do not chase dead config and future sessions do not try to "fix" or extend an inert block (FR14 supersession of Epic 78 FR14)**.

## Acceptance Criteria

1. **Prerequisite — Story 80-1 auxiliary pin live**
   **Given** Story `80-1-pin-auxiliary-block-to-portal-haiku` is **done**
   **When** this story begins
   **Then** six auxiliary tasks (`compression`, `approval`, `skills_hub`, `mcp`, `title_generation`, `triage_specifier`) remain pinned to `nous` / `anthropic/claude-haiku-4.5` per `80-1-auxiliary-haiku-evidence.md`
   **And** `model.default` remains `anthropic/claude-sonnet-4.6` on `nous`
   **And** if 80-1 pins are missing, **stop** — complete or restore 80-1 before continuing

2. **Source audit — zero consumers confirmed (do not re-litigate)**
   **Given** Hermes v0.17.0 upstream at `~/.hermes/hermes-agent`
   **When** dev verifies inertness before editing config
   **Then** evidence cites **both** audits:
   - **Story 78-2:** `78-2-skill-routing-evidence.md` §AC #2 — no `DEFAULT_CONFIG` entry, no `gateway/` reader, only `AGENTS.md` lists the section name; `agent/coding_context.py` has `model_hint` seam only ("not yet consumed by the router")
   - **Fresh re-confirmation (this story):** `rg 'smart_model_routing' ~/.hermes/hermes-agent --glob '!**/tests/**' --glob '!**/AGENTS.md'` → **zero matches** (exit 1)
   **And** Dev Agent Record logs the exact grep command + exit code
   **And** dev does **not** add new code expecting `smart_model_routing` to work — it is retired, not "consumer-pending"

3. **Config backup before edit (NFR5)**
   **Given** operator is about to modify `~/.hermes/config.yaml`
   **When** backup runs
   **Then** `cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%Y-%m-%d)-80-2` exists
   **And** evidence file records backup path
   **And** rollback = restore backup or uncomment block per AC #4

4. **Comment out `smart_model_routing` — reversible, not deleted**
   **Given** AC #2 audit confirmed and AC #3 backup taken
   **When** operator edits `~/.hermes/config.yaml`
   **Then** the entire `smart_model_routing:` block (lines ~755–779 in current live config — `enabled`, `tiers`, `skills` map) is **YAML-commented out**, not deleted
   **And** a dated header comment immediately above the block states retirement, e.g.:
   ```yaml
   # RETIRED 2026-07-03 — Story 80-2: smart_model_routing has zero consumers in Hermes v0.17.0.
   # Sole routing lever: auxiliary: block (Story 80-1). Do not re-enable or extend.
   # Evidence: _bmad-output/implementation-artifacts/80-2-retire-smart-model-routing-evidence.md
   # smart_model_routing:
   #   enabled: true
   #   ...
   ```
   **And** `plugins:` and all other top-level keys remain **unchanged**
   **And** `auxiliary:` six-task pins from 80-1 are **untouched**
   **And** optional gateway restart: `hermes gateway restart` (config load sanity; block was already unread)

5. **Scope boundary — config + docs only; no code (NFR2)**
   **Given** this story retires dead config and documents truth
   **When** implementation completes
   **Then** **zero diffs** in protect-list paths:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no edits to `~/.hermes/hermes-agent` core fork
   **And** no Omnipotent.md `src/**` or `dist/**` changes
   **And** `model.default`, `model.provider`, voice/TTS, Brain recall unchanged

6. **Operator documentation — route via session-close (WriteGate)**
   **Given** vault `AI-Context/**` is WriteGate-protected (NFR8)
   **When** documentation updates are applied
   **Then** dev does **NOT** hand-edit `AI-Context/AGENTS.md` or use Vault IO mutators on WriteGate paths directly from Cursor
   **And** doc changes are included in **session-close Section 8 synthesis** (`/session-close` in `#hermes`) so `gate-apply-section8.mjs` applies them
   **And** the following are updated (content requirements):

   **6a. `AI-Context/modules/routing.md`** (both vault copies must match after gate apply):
   - Replace §"Hermes per-skill routing (Epic 78 / FR14)" consumer-pending language with **retired** status
   - State plainly: **`auxiliary:` is the sole Hermes v0.17.0 routing lever** for cost control (reference 80-1 six tasks + `auxiliary.compression`)
   - State: **`smart_model_routing` is retired/inert** — commented out in config Story 80-2; **do not re-enable, extend, or file stories to "implement" it** unless Hermes upstream ships a documented consumer (then new epic, not resurrection of 78-2 block)
   - Preserve Epic 74 global Hermes surface table and Epic 15 IDE routing references
   - Add **Reconciled:** line with date + Story 80-2

   **6b. `03-Resources/CNS-Operator-Guide.md`:**
   - Add or extend Hermes routing guidance (§15.13 pointer table or short new subsection under §15) stating:
     - Main operator turns: `model.default` Sonnet on Portal
     - Auxiliary side-work: `auxiliary:` block → Haiku (Story 80-1)
     - **`smart_model_routing` retired** — was config-ready but never consumed; operators must not tune it
   - Bump `modified` frontmatter date
   - Add Version History row referencing **`80-2-retire-inert-smart-model-routing-operator-guide`**

   **6c. `deferred-work.md`** (Omnipotent.md repo — direct edit OK):
   - Update §"Per-skill Hermes model routing" → **closed/superseded by Epic 80** — consumer never shipped; block retired 80-2; real lever is `auxiliary:`

   **And** session-close close-report shows Section 8 gate apply success (or documented controlled skip with operator follow-up)

7. **Evidence file — redacted config diff (NFR4)**
   **Given** evidence is the done-proof
   **When** story completes
   **Then** `_bmad-output/implementation-artifacts/80-2-retire-smart-model-routing-evidence.md` exists with:
   - Hermes version + Story 80-1 prerequisite check (auxiliary pins summary — provider/model only)
   - Source audit: pointer to `78-2-skill-routing-evidence.md` + fresh grep command/output (AC #2)
   - Backup path
   - Redacted before/after: `smart_model_routing` section showing comment-out (no `api_key`, tokens, OAuth)
   - Statement: `auxiliary:` block unchanged vs 80-1 backup
   - Session-close reference: date, close-report path or Discord reply snippet confirming doc fan-out
   - Rollback: uncomment block OR `cp` backup instructions
   - Explicit: **no new stories should target `smart_model_routing`**
   **And** git diff contains no secrets

8. **Verify gate (NFR1)**
   **Given** all ACs satisfied
   **When** `bash scripts/verify.sh` runs from Omnipotent.md repo root
   **Then** exit code **0** before marking story done

9. **No future-story pollution**
   **Given** FR14 is satisfied by `auxiliary:` + retirement
   **When** story closes
   **Then** sprint-status and evidence explicitly note: **no backlog stories should re-open `smart_model_routing`**
   **And** if Hermes upstream later adds a consumer, treat as **new discovery epic** — not automatic uncomment of the 78-2 tier map

## Tasks / Subtasks

- [x] **AC #1 — 80-1 prerequisite check** (AC: #1)
  - [x] Read `80-1-auxiliary-haiku-evidence.md` — confirm six tasks on Haiku
  - [x] `hermes config show` or YAML grep — auxiliary pins present

- [x] **AC #2 — Source audit** (AC: #2)
  - [x] Re-read `78-2-skill-routing-evidence.md` §AC #2
  - [x] Run fresh `rg` across `~/.hermes/hermes-agent` (exclude tests, AGENTS.md)
  - [x] Log command + result in Dev Agent Record

- [x] **AC #3–#4 — Backup + comment out block** (AC: #3, #4)
  - [x] `cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-YYYY-MM-DD-80-2`
  - [x] Comment out full `smart_model_routing:` block with dated retirement header
  - [x] Verify `plugins:` section intact; `auxiliary:` unchanged
  - [x] Optional: `hermes gateway restart`; `python3 -c` YAML load smoke

- [x] **AC #5 — Scope check** (AC: #5)
  - [x] `git status` / `git diff` — no `src/**` changes
  - [x] Confirm protect-list untouched

- [x] **AC #6 — Documentation via session-close** (AC: #6)
  - [x] Draft Section 8 content for `routing.md` retirement + operator guide bullets
  - [x] Run `/session-close` (real, not dry-run) with doc updates in synthesis
  - [x] Verify gate apply + `diff -q` on both `routing.md` copies if applicable
  - [x] Update `deferred-work.md` §Per-skill Hermes model routing directly in repo

- [x] **AC #7–#9 — Evidence + verify** (AC: #7, #8, #9)
  - [x] Write `80-2-retire-smart-model-routing-evidence.md`
  - [x] `bash scripts/verify.sh` → exit 0
  - [x] Update story status; sprint-status → `ready-for-dev` consumed by dev-story → `review`

## Dev Notes

### Epic and sequencing context

- **Epic 80 (Cost-Effective Auxiliary Routing)** — Phase B1 · **FR14** · **NFR5, NFR8**
- **Story 80-1 (done):** Pins consumed routing surface (`auxiliary:` six tasks to Portal Haiku).
- **Story 80-2 (this):** Retires inert `smart_model_routing` + documents truth for operators.
- **Depends:** 80-1 **must** be done — auxiliary is the replacement lever before removing the dead block from active config.
- **Supersedes:** Epic 78 Story 78-2 "consumer-pending" posture — closed; upstream never shipped reader in v0.17.0.

[Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §Epic 80, §Story 80-2, §FR14]

### Why comment out instead of delete

| Approach | Rationale |
|----------|-----------|
| **Comment out (chosen)** | NFR5 reversibility; preserves 78-2 tier/skill map as archaeological record; recoverable if an unexpected dependency on YAML *presence* existed (none expected — nothing reads the key) |
| Delete outright | Loses rollback context; unnecessary given grep proves zero readers |

### Live `smart_model_routing` block (verify at story start)

Current `~/.hermes/config.yaml` (~lines 755–779):

```yaml
smart_model_routing:
  enabled: true
  tiers:
    fast:
      cns_alias: fast
      provider: nous
      model: anthropic/claude-haiku-4.5
    standard:
      cns_alias: default-coding
      provider: nous
      model: anthropic/claude-sonnet-4.6
  skills:
    triage: fast
    vault-lint: fast
    # ... 13 CNS skills total (9 fast / 4 standard)
```

**After 80-2:** entire block YAML-commented with retirement header; `plugins:` follows immediately.

### Source audit summary (two citations required)

| Audit | Finding |
|-------|---------|
| **78-2** (`78-2-skill-routing-evidence.md`) | `DEFAULT_CONFIG` — absent; `gateway/` — no matches; only `AGENTS.md` lists section; runtime skill invocations use `model.default` (Sonnet) |
| **Fresh 2026-07-03** | `rg 'smart_model_routing' ~/.hermes/hermes-agent --glob '!**/tests/**' --glob '!**/AGENTS.md'` → **0 matches** |

**Implication:** The 78-2 tier map never affected inference. Cost control is **`auxiliary:`** only (80-1). Per-skill Haiku/Sonnet differentiation for Discord skills does **not** exist in v0.17.0 — all skills use main model unless auxiliary path fires.

### Operator CLI runbook (canonical sequence)

```bash
# 0. Prerequisite — 80-1 pins
grep -A3 'triage_specifier:' ~/.hermes/config.yaml | head -6
# Expect: provider: nous, model: anthropic/claude-haiku-4.5

# 1. Source audit (log output in evidence)
rg 'smart_model_routing' ~/.hermes/hermes-agent --glob '!**/tests/**' --glob '!**/AGENTS.md'
# Expect: exit 1 (no matches)

# 2. Backup
cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%Y-%m-%d)-80-2

# 3. Comment out smart_model_routing block (manual edit or careful sed)
#    Add retirement header per AC #4; preserve commented YAML indentation

# 4. Verify load + scope
python3 -c "import yaml; yaml.safe_load(open('$HOME/.hermes/config.yaml'))"
grep -c '^smart_model_routing:' ~/.hermes/config.yaml || echo 'active key absent (good)'
grep -c '^# smart_model_routing:' ~/.hermes/config.yaml

# 5. Optional restart
hermes gateway restart

# 6. Documentation — session-close in #hermes (NOT direct AI-Context edits)
#    Include routing.md + CNS-Operator-Guide updates in Section 8 draft

# 7. Repo evidence + verify
cd /home/christ/ai-factory/projects/Omnipotent.md
bash scripts/verify.sh
```

### Session-close documentation workflow (WriteGate)

**Do not** use `vault_write` / Cursor direct edits on `AI-Context/AGENTS.md` or `AI-Context/modules/routing.md`.

**Do** route vault doc updates through Hermes `/session-close`:

1. Complete config comment-out + draft doc bullets in story working notes.
2. Invoke `/session-close` in Discord `#hermes` (or CLI equivalent).
3. Phase A runs `hermes-run-session-close.sh`.
4. Section 8 synthesis reads only `.session-close/section8-input.json` + `references/section8-synthesis.md`.
5. Write `.session-close/section8-draft.md` with routing retirement + operator guide additions.
6. Apply via `gate-apply-section8.mjs --draft ".session-close/section8-draft.md"`.
7. Confirm in `close-report.json` + rendered Discord reply.

**Operator guide path:** `03-Resources/CNS-Operator-Guide.md` (vault-relative POSIX).

**Routing module path:** `AI-Context/modules/routing.md` — update §Epic 78 section to **retired**; expand §Epic 74 table to list all six 80-1 auxiliary tasks if not already present.

[Source: `~/.hermes/skills/cns/session-close/SKILL.md`; NFR8 WriteGate]

### Documentation content requirements (copy-ready bullets)

**For `routing.md`:**

- Heading retain or rename: `## Hermes auxiliary routing (Epic 80 / FR14)` — sole cost lever
- Table: six 80-1 tasks + compression → `nous` / Haiku
- Retired callout: `smart_model_routing` commented out Story 80-2; zero v0.17.0 consumers; do not re-enable
- Remove "consumer-pending" and "re-run smoke when router ships" unless qualified as **future upstream only**

**For `CNS-Operator-Guide.md`:**

- Under §15 Hermes or §15.13: "Cost routing: tune `auxiliary:` only; `smart_model_routing` is retired inert config"
- Pointer to `routing.md` for rollback commands
- Version History row

**For `deferred-work.md`:**

- Close §Per-skill Hermes model routing with supersession note (Epic 80 / 80-2)

### Architecture compliance

| Requirement | Compliance |
|-------------|------------|
| **FR14** | Retire inert block; document `auxiliary:` as sole lever |
| **NFR2** | Config + docs only; protect-list zero edits |
| **NFR4** | Evidence redacted; no secrets in git |
| **NFR5** | Backup + commented (not deleted) block; rollback documented |
| **NFR8** | Vault AI-Context via session-close, not direct WriteGate bypass |
| **NFR1** | `bash scripts/verify.sh` before done |

[Source: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` §FR14]

### File structure requirements

| Path | Action |
|------|--------|
| `~/.hermes/config.yaml` | **UPDATE** — comment out `smart_model_routing:` (outside git) |
| `~/.hermes/config.yaml.bak-YYYY-MM-DD-80-2` | **CREATE** — backup (outside git) |
| `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` | **UPDATE** via session-close gate |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | **UPDATE** via session-close gate |
| `_bmad-output/implementation-artifacts/deferred-work.md` | **UPDATE** — close per-skill routing deferred item |
| `_bmad-output/implementation-artifacts/80-2-retire-smart-model-routing-evidence.md` | **CREATE** — done proof |
| `_bmad-output/implementation-artifacts/80-2-retire-inert-smart-model-routing-operator-guide.md` | Story file (this doc) |
| Omnipotent.md `src/**`, protect-list | **NO CHANGE** |

### Testing requirements

- **Gate:** `bash scripts/verify.sh` exit 0 (NFR1).
- **No new unit tests** — config + documentation story; evidence file is functional test record.
- **YAML load smoke:** `python3 -c "import yaml; yaml.safe_load(...)"` after comment-out.
- **Do not** claim per-skill routing works — it never did in v0.17.0.

### Previous story intelligence (80-1)

| Learning | Apply to 80-2 |
|----------|----------------|
| Backup naming `~/.hermes/config.yaml.bak-YYYY-MM-DD-80-1` | Use `-80-2` suffix |
| Evidence redaction pattern | Provider/model only; no secrets |
| `smart_model_routing` explicitly left untouched in 80-1 | **This story owns it** |
| Watch keys (`skills_hub`, `triage_specifier`) on auxiliary | Unaffected — do not revert auxiliary pins when commenting out dead block |
| Verify may fail on session-close skill parity | Sync `~/.hermes/skills/cns/session-close/SKILL.md` if verify complains (80-1 pattern) |

[Source: `_bmad-output/implementation-artifacts/80-1-pin-auxiliary-block-to-portal-haiku.md`]

### Latest technical information

- **Hermes v0.17.0:** `smart_model_routing` stored via `_deep_merge` in `load_config()` if present, but **no runtime consumer** — commenting out is safe.
- **Real routing surface:** `agent/auxiliary_client.py` reads `auxiliary.<task>.*` only.
- **Context7 ID:** `/nousresearch/hermes-agent` — query auxiliary config if needed; do not query `smart_model_routing` for implementation (retired).

[Source: `78-2-skill-routing-evidence.md`; `research-hermes-omniscience-resurfacing.md` §Pillar 4]

### Project context reference

- WriteGate: `AI-Context/**` mutations via session-close (constitution NFR8)
- Branch: `hermes-consolidation`
- Epic 80 completes after this story + optional retrospective
- **Anti-resurrection:** PRD decision D-006/D-027 lock retirement path

### Anti-patterns

- **Do not** delete `smart_model_routing` outright — comment out per NFR5.
- **Do not** hand-edit `AI-Context/AGENTS.md` or `routing.md` from Cursor — use session-close.
- **Do not** set `smart_model_routing.enabled: false` and leave block active — comment entire block for clarity.
- **Do not** change `auxiliary:` pins — 80-1 scope; regression risk.
- **Do not** change `model.default` to Haiku.
- **Do not** commit `~/.hermes/config.yaml` to Omnipotent.md.
- **Do not** file follow-up stories to "implement smart_model_routing consumer" without upstream release proof.
- **Do not** fake runtime routing logs — block was always inert.

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §Story 80-2, lines 460–474]
- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §FR14]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` §FR14]
- [Source: `_bmad-output/planning-artifacts/research-hermes-omniscience-resurfacing.md` §Pillar 4]
- [Source: `_bmad-output/implementation-artifacts/78-2-skill-routing-evidence.md`]
- [Source: `_bmad-output/implementation-artifacts/80-1-auxiliary-haiku-evidence.md`]
- [Source: `_bmad-output/implementation-artifacts/80-1-pin-auxiliary-block-to-portal-haiku.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` §Per-skill Hermes model routing]
- [Source: `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` §Epic 78 — to be retired]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §14, §15.13]
- [Source: `~/.hermes/skills/cns/session-close/SKILL.md`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- AC #2 fresh audit: `rg 'smart_model_routing' ~/.hermes/hermes-agent --glob '!**/tests/**' --glob '!**/AGENTS.md'` → exit **1** (zero matches)
- Config backup: `~/.hermes/config.yaml.bak-2026-07-03-80-2`
- YAML load smoke: **OK** after comment-out
- Session-close Phase A: 766 tests passing; close-report `failure_class: null`
- Gate apply: `phase B token check PASSED (278 tokens); §8 applied v2.1.48`
- Discord #hermes: close reply posted via `hermes send --to discord:1500733488897462382`
- `bash scripts/verify.sh` → exit **0**

### Completion Notes List

- Confirmed 80-1 auxiliary pins intact (six tasks on Portal Haiku; Sonnet default unchanged)
- Commented out `smart_model_routing` block with dated retirement header (reversible, not deleted)
- Updated `routing.md` (both copies): Epic 80 auxiliary sole lever + Epic 78 retired callout
- Updated `CNS-Operator-Guide.md` §15.14 + version 1.40.0 via session-close workflow
- Closed `deferred-work.md` §Per-skill Hermes model routing (superseded by Epic 80)
- Real session-close executed (Phase A + gate + fan-out + Discord reply); not dry-run
- Evidence file created; no `src/**` or protect-list changes
- **Anti-resurrection:** no backlog stories should target `smart_model_routing`

### File List

- `~/.hermes/config.yaml` (UPDATE — `smart_model_routing` commented out; outside git)
- `~/.hermes/config.yaml.bak-2026-07-03-80-2` (CREATE — backup; outside git)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (UPDATE — via session-close)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (UPDATE — canonical vault; synced)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (UPDATE — via session-close)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (UPDATE — canonical vault)
- `specs/cns-vault-contract/AGENTS.md` (UPDATE — Section 8 via gate-apply-section8)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (UPDATE — gate sync)
- `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE)
- `_bmad-output/implementation-artifacts/80-2-retire-smart-model-routing-evidence.md` (CREATE)
- `_bmad-output/implementation-artifacts/80-2-retire-inert-smart-model-routing-operator-guide.md` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Change Log

- 2026-07-03: Story 80-2 — retired inert `smart_model_routing`; vault routing docs + operator guide via session-close; Epic 80 FR14 complete
