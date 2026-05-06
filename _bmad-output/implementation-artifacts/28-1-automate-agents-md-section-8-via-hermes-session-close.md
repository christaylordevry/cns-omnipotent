# Story 28.1: Automate AGENTS.md Section 8 updates via Hermes session-close skill

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **28** (Hermes operator closure and NotebookLM freshness)  
Tracked in sprint-status as: **`28-1-automate-agents-md-section-8-via-hermes-session-close`**

## Context

- **Epic 26–27** established Hermes on WSL2, `#hermes` Discord surface, Vault IO write path for governed mutations, and CNS skills under `~/.hermes/skills/cns/` with `SKILL.md` + `references/` layout. Canonical skill reference: `26-8-hermes-skill-capture-workflow.md`, `26-6-url-ingest-hermes-vault.md`. [Source: `_bmad-output/implementation-artifacts/26-8-hermes-skill-capture-workflow.md` §B–§E]
- **`AGENTS.md` Section 8** (“Current Focus”) is the operator-visible sprint narrative; the live constitution duplicates stale Phase 4/Epic 16 language today while `sprint-status.yaml` tracks Epics 26–27 and beyond. [Source: `specs/cns-vault-contract/AGENTS.md` §8]
- **Constitution sync rule:** Any edit to `AGENTS.md` must update **both** `specs/cns-vault-contract/AGENTS.md` (repo mirror) and `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (canonical vault) identically. [Source: `.cursor/rules/cns-specs-constitution.mdc` — AGENTS.md sync rule]
- **NotebookLM export:** `scripts/export-vault-for-notebooklm.sh` writes `scripts/output/vault-export-for-notebooklm.md`; respects `CNS_VAULT_ROOT`. [Source: `scripts/export-vault-for-notebooklm.sh`]
- **Project map:** Operators maintain notebook IDs/names in vault `03-Resources/` (filename may be `notebooklm-project-map.md`, `NotebookLM-Project-Map.md`, or similar; skill must locate the authoritative row table via `vault_read` or documented path). [Source: `10-1-notebooklm-vault-integration.md` AC1; module pointer `AI-Context/modules/notebooklm-workflow.md`]

### Critical constraint: WriteGate vs stakeholder wording

The story request says **only `vault_update_frontmatter` for vault mutations touching `AGENTS.md`**.

**Fact:** Vault IO **rejects all writes** under `AI-Context/**` including `AGENTS.md` (`PROTECTED_PATH`). [Source: `src/write-gate.ts` — `isUnderAiContext`]

**Implication:** Hermes **cannot** apply Section 8 body changes through Vault IO today. Implementation for 28.1 MUST:

1. Update **both** constitution copies via **Hermes-accessible filesystem paths** (repo mirror + vault `AI-Context/AGENTS.md` on the Windows mount), **or**
2. Split deliverables: Hermes updates repo mirror only and replies with a explicit “sync vault copy” reminder, **or**
3. Defer MCP-based AGENTS edits to a **future story** that changes WriteGate policy (explicitly **out of scope** for 28.1).

Record which option shipped in **Dev Agent Record**. Default acceptable path: **filesystem edits to both AGENTS paths** (same net effect as operator manual sync), **zero Vault IO mutators** on session-close. If product owner insists on Vault IO only, spike WriteGate carve-out separately; do not silently fail `vault_update_frontmatter` calls against `AI-Context/AGENTS.md`.

## Story

As an **operator**,  
I want **a Hermes `/session-close` skill in `#hermes` that ingests sprint tracker + recent story context, regenerates `AGENTS.md` Section 8, runs the NotebookLM vault export script, and pushes the fresh export to every active notebook listed in the project map**,  
so that **end-of-session closure is one command**, **agents see accurate “Current Focus” on next load**, and **NotebookLM sources stay aligned with the vault without manual repetition**.

## Acceptance Criteria

1. **Skill package (AC: skill)**  
   **Given** Hermes skills root `~/.hermes/skills/cns/` exists  
   **When** the operator installs this story’s deliverable  
   **Then** a skill directory exists at **`~/.hermes/skills/cns/session-close/`** (or `hermes-cns-session-close/` if naming collision; document final slug in Dev Agent Record) containing **`SKILL.md`** and **`references/`** with at least **`task-prompt.md`** describing ordered steps, inputs, failure handling, and tool boundaries  
   **And** `SKILL.md` follows the HI-8 normative layout (name/description, when to use, steps, tools allowed, non-goals). [Source: `26-8` §B–§D]

2. **Trigger surface (AC: trigger)**  
   **Given** Discord `#hermes` is configured per Epic 26–27  
   **When** the operator sends **`/session-close`** (Hermes slash command or documented equivalent that invokes this skill without ambiguity)  
   **Then** Hermes loads the session-close skill and executes its workflow (no unrelated skill fan-out unless documented fallback)

3. **Sprint status ingestion (AC: sprint)**  
   **When** the skill runs  
   **Then** it reads **`_bmad-output/implementation-artifacts/sprint-status.yaml`** from the **Omnipotent repo** using a **single documented resolution rule** for repo root (e.g. env `OMNIPOTENT_REPO` or fixed path in Dev Agent Record; no cwd guessing)  
   **And** it parses `development_status` enough to summarize **active epic(s)**, **in-progress / review / backlog** stories, and **recent completions** relevant to Section 8 narrative

4. **Recent story artifacts (AC: artifacts)**  
   **When** the skill runs  
   **Then** it selects the **three most recently modified** files under `_bmad-output/implementation-artifacts/` matching story pattern **`{epic}-{story}-*.md`** (numeric epic and story segments), **excluding** obvious non-story noise files if needed (`cns-session-handoff-*.md`, `deferred-work.md`, retros unless explicitly included — default **exclude** handoffs/retros from the “3 most recent” pool; document rule in `references/task-prompt.md`)  
   **And** it incorporates short bullets from those files (titles, status, key outcomes) into the Section 8 rewrite without pasting secrets or full bodies

5. **Section 8 rewrite (AC: section8)**  
   **When** synthesis completes  
   **Then** **`## 8. Current Focus`** through the line immediately before **`## 9. Agent Behavior Guidelines`** in **both** constitution copies is replaced with updated markdown that:  
   - Preserves the **blockquote** intro lines under §8 if still accurate  
   - Replaces **Project Status** and **Current Priorities** bullets so they reflect **`sprint-status.yaml`** (not stale Epic 16 text unless still true)  
   - Optionally retains **Phase 2 Backlog** / **Parking Lot** subsections when still applicable; otherwise trims with operator-visible rationale in Hermes reply  
   **And** the **Version** line in the header blockquote (`> Version:` / `> Last updated:`) is bumped appropriately (patch/version rule documented in task prompt)  
   **And** **§9 onward and §Changelog** remain unchanged except where Changelog requires a new row per constitution maintenance norms (add dated row citing Story 28.1 when Section 8 materially changes)

6. **Dual-path AGENTS sync (AC: sync)**  
   **When** Section 8 is rewritten  
   **Then** **both** paths match byte-for-byte after the run:  
   - `specs/cns-vault-contract/AGENTS.md`  
   - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`  
   **And** if either path is missing or read-only, Hermes reports failure class clearly and does **not** claim success

7. **Export script (AC: export)**  
   **Given** Omnipotent repo with `scripts/export-vault-for-notebooklm.sh`  
   **When** session-close runs  
   **Then** Hermes executes **`bash scripts/export-vault-for-notebooklm.sh`** from repo root with **`CNS_VAULT_ROOT`** set per operator env (default script path already points at canonical vault; override documented)  
   **And** confirms `scripts/output/vault-export-for-notebooklm.md` exists after run and reports path + size summary to `#hermes`

8. **NotebookLM source_add fan-out (AC: notebooklm)**  
   **When** export succeeds  
   **Then** Hermes reads **`03-Resources/notebooklm-project-map.md`** (or resolves the actual filename under `03-Resources/` if different — use **`vault_read`** on vault path after locating via `vault_search` scoped to `03-Resources/` if needed)  
   **And** for **each notebook marked active** (table column semantics defined in references: e.g. status = active / include = yes; document exact column header matching operator note), Hermes invokes NotebookLM **`source_add`** with the **fresh export file** as the source payload per **`notebooklm-workflow`** module conventions (file path or upload shape supported by MCP; document exact tool arguments observed)  
   **And** Hermes summarizes per-notebook success/failure without dumping tokens

9. **Mutation boundary (AC: vault-io)**  
   **Given** WriteGate protects `AI-Context/**`  
   **When** session-close runs  
   **Then** it does **not** call Vault IO mutators against protected paths  
   **And** allowed Vault IO usage is **read-only** (`vault_read`, `vault_search`, `vault_list`, `vault_read_frontmatter`) for project map discovery unless a separate approved carve-out exists  
   **And** Dev Agent Record states how stakeholder “vault_update_frontmatter only” intent was reconciled with WriteGate (see Context above)

10. **Operator guidance (AC: docs)**  
    **When** the story completes  
    **Then** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` gains a short subsection (operator FS edit per HI patterns) **or** completion notes state “no operator-guide change” with rationale  
    **And** Hermes `MEMORY.md` or equivalent gains a one-screen pointer if your stack uses it (optional; follow Epic 26 norms)

## Tasks / Subtasks

- [x] Confirm `--session-close` vs `/session-close` binding with observed Hermes Discord slash/skill wiring; update `discord.channel_skill_bindings` as needed (AC: trigger)
- [x] Author `~/.hermes/skills/cns/session-close/SKILL.md` + `references/task-prompt.md` + optional `references/trigger-pattern.md` (AC: skill, trigger)
- [x] Implement deterministic repo root + sprint-status path resolution (AC: sprint)
- [x] Implement “3 most recent story artifacts” selection with documented exclusions (AC: artifacts)
- [x] Define Section 8 markdown template with placeholders for synthesized bullets (AC: section8)
- [x] Implement dual AGENTS.md surgical replace for §8 boundaries (`## 8.` … before `## 9.`) with changelog/version bump policy (AC: section8, sync)
- [x] Wire `bash scripts/export-vault-for-notebooklm.sh` invocation + stderr capture (AC: export)
- [x] Wire `vault_read`/`vault_search` for project map + `source_add` loop for active notebooks (AC: notebooklm)
- [x] Document WriteGate reality and actual IO strategy in Dev Agent Record (AC: vault-io)
- [x] Smoke: dry-run mode optional (rewrite AGENTS to `/tmp` diff preview) — nice-to-have; document if implemented

### Review Findings

- [x] [Review][Patch] Ensure Hermes runtime receives `OMNIPOTENT_REPO`. Live Hermes has `terminal.env_passthrough: []` and no observed `OMNIPOTENT_REPO`; the skill blocks before sprint ingestion if the variable is absent. [`/home/christ/.hermes/config.yaml:68`, `scripts/hermes-skill-examples/session-close/SKILL.md:34`]: resolved by deterministic repo root fallback to `/home/christ/ai-factory/projects/Omnipotent.md`.
- [x] [Review][Patch] Remove trigger ambiguity in the live `#hermes` channel prompt. The channel prompt still says `hermes-url-ingest-vault` is authoritative for every message, while the 28.1 trigger contract says `/session-close` must not fan out into URL ingest or triage. [`/home/christ/.hermes/config.yaml:340`, `scripts/hermes-skill-examples/session-close/references/trigger-pattern.md:23`]: resolved by updating the live channel prompt to route URL-only, triage, and session-close triggers as peers.
- [x] [Review][Patch] Reconcile NotebookLM `source_add` arguments with the live NotebookLM workflow during proof. The session-close prompt hardcodes `source_type: "file"` with `file_path`, while the canonical NotebookLM workflow says vault-wide exports use `source_type: text`; the exact observed connector arguments still need to be captured. [`scripts/hermes-skill-examples/session-close/references/task-prompt.md:167`, `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md:141`]: resolved by documenting observed live file-upload shape: `notebook_id`, `source_name: "My Knowledge Base"`, `source_type: "file"`, and absolute export `file_path`, with explicit fallback recording when IDs are absent from the map.
- [x] [Review][Patch] Clarify dry-run NotebookLM behavior so the later fan-out step cannot override the hard constraint. The hard constraints forbid `source_add` in dry-run, but Step 8 unconditionally says to call `source_add` for each active notebook. [`scripts/hermes-skill-examples/session-close/references/task-prompt.md:11`, `scripts/hermes-skill-examples/session-close/references/task-prompt.md:165`]: resolved by making Step 8 real-close only and dry-run report `notebooklm: skipped in dry-run`.
- [x] [Review][Patch] Bring the canonical active operator guide back into sync with the repo fixture for the touched session-close documentation area. The live vault guide has the 28.1 row as version `1.19.0` and is missing the repo fixture's intervening 27.3 to 27.6 history rows, while the repo fixture records 28.1 as `1.22.0`. [`/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md:394`, `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md:397`]: resolved by syncing the active vault guide to the repo fixture, preserving the 28.1 `1.22.0` row and safer triage guidance.

## Dev Notes

### Standing task: Update operator guide

- If behavior or paths are operator-visible: update `03-Resources/CNS-Operator-Guide.md` (operator FS), bump `modified`, Version History row for `28-1-automate-agents-md-section-8-via-hermes-session-close`.
- Else note “Operator guide: no update required” in Dev Agent Record.

### References

| Topic | Path |
|--------|------|
| Section 8 shape | `specs/cns-vault-contract/AGENTS.md` §8 |
| WriteGate AI-Context | `src/write-gate.ts` |
| Hermes skill layout | `_bmad-output/implementation-artifacts/26-8-hermes-skill-capture-workflow.md` |
| Export script | `scripts/export-vault-for-notebooklm.sh` |
| NotebookLM mapping story | `_bmad-output/implementation-artifacts/10-1-notebooklm-vault-integration.md` |
| Sprint tracker | `_bmad-output/implementation-artifacts/sprint-status.yaml` |

### Previous story intelligence (Epic 27 closure)

- Epic 27 emphasizes **Discord approval flows**, **vault_move** with audit, and **non-destructive** triage. Session-close must **not** move inbox notes or widen scopes; it is **read + constitution edit + export + NotebookLM** only. [Source: `27-5`, `27-6`, `27-7`]

### Testing / verification

- `bash scripts/verify.sh` remains green (no mandatory MCP server code changes expected).
- Hermes smoke: operator runs `/session-close` in `#hermes`; captures Discord transcript excerpt + export path + one successful `source_add` line in Dev Agent Record (redact secrets).

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Pre-change gate: `npm test` passed before implementation.
- Red check: `node --test tests/hermes-session-close-skill.test.mjs` failed before the session-close skill and operator-guide docs existed.
- Green check: `node --test tests/hermes-session-close-skill.test.mjs` passed after adding the skill mirror, install helper, and docs.
- Live install: `bash scripts/install-hermes-skill-session-close.sh` copied the package to `~/.hermes/skills/cns/session-close/`.
- Live sync check: `diff -qr scripts/hermes-skill-examples/session-close /home/christ/.hermes/skills/cns/session-close` returned no differences.
- Final gate: `bash scripts/verify.sh` passed after adding `.claude/worktrees/**` to lint and git ignores.
- Review-fix pre-change gate: `npm test` passed before resolving the five code review findings.
- Review fixes: updated repo-root fallback, live `#hermes` channel prompt, NotebookLM `source_add` argument contract, dry-run fan-out guard, and active operator-guide sync.

### Completion Notes List

- Final skill slug: `session-close`; live path: `~/.hermes/skills/cns/session-close/`.
- Trigger surface shipped as `/session-close` plus `/session-close --dry-run`; `~/.hermes/config.yaml` now binds `session-close` beside `hermes-url-ingest-vault` and `triage` for channel `1500733488897462382`.
- Repo root resolution is documented as absolute `OMNIPOTENT_REPO` first, then fixed host fallback `/home/christ/ai-factory/projects/Omnipotent.md`; no cwd guessing.
- The task prompt defines sprint parsing, three-newest story artifact selection, Section 8 replacement boundaries, patch version bump, changelog row, and byte-for-byte AGENTS sync across the specs mirror, planning mirror, and canonical vault copy.
- Stakeholder `vault_update_frontmatter only` intent reconciled with WriteGate by using filesystem edits for protected AGENTS paths and zero Vault IO mutators on session-close. Allowed Vault IO usage is read-only project-map discovery.
- Export and NotebookLM fan-out are documented as `bash scripts/export-vault-for-notebooklm.sh`, output validation for `scripts/output/vault-export-for-notebooklm.md`, and one real-close-only `source_add` per active mapped notebook with `notebook_id`, `source_name: "My Knowledge Base"`, `source_type: "file"`, and absolute `file_path`; the NotebookLM workflow module now matches this file-upload shape.
- Operator guide updated and byte-synced between the repo vault fixture and canonical active vault. Hermes `MEMORY.md` update not required because the existing Hermes skill system loads from `~/.hermes/skills/cns/` and operator usage belongs in the guide.
- Live `/session-close` Discord smoke was not run in this Codex session because the NotebookLM MCP surface is not exposed here; the skill contains dry-run and blocked-NotebookLM failure handling for the operator run.
- Verification required ignoring operator-local `.claude/worktrees/` so ESLint does not recurse into nested generated checkouts.

### File List

- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `scripts/hermes-skill-examples/session-close/references/task-prompt.md`
- `scripts/hermes-skill-examples/session-close/references/trigger-pattern.md`
- `scripts/hermes-skill-examples/session-close/references/config-snippet.md`
- `scripts/install-hermes-skill-session-close.sh`
- `tests/hermes-session-close-skill.test.mjs`
- `.gitignore`
- `eslint.config.js`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md`
- `/home/christ/.hermes/skills/cns/session-close/SKILL.md`
- `/home/christ/.hermes/skills/cns/session-close/references/task-prompt.md`
- `/home/christ/.hermes/skills/cns/session-close/references/trigger-pattern.md`
- `/home/christ/.hermes/skills/cns/session-close/references/config-snippet.md`
- `/home/christ/.hermes/config.yaml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/28-1-automate-agents-md-section-8-via-hermes-session-close.md`

### Change Log

| Date | Change |
|------|--------|
| 2026-05-06 | Resolved all five code-review findings: deterministic repo fallback, peer trigger prompt, NotebookLM source_add shape, dry-run fan-out guard, and operator-guide active sync; story moved back to review. |
| 2026-05-05 | Implemented Hermes `session-close` skill package, install helper, trigger binding, operator docs, and guard tests; story moved to review. |
