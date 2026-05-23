# Story 43.1: CNS-Daily-Rhythm AUTO blocks via session-close

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **43** (Operator living document automation)  
Tracked in sprint-status as: **`43-1-cns-daily-rhythm-auto-blocks-via-session-close`**

**Epic placement rationale:** Deferred-work tags weekly report and Composio as **Epic 41** (business synthesis). This story is **session-close / operator-doc** work (extends Epic 28), so it lives in **Epic 43** to avoid mixing with revenue/delivery epics.

## Context

- **Living doc:** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/CNS-Daily-Rhythm.md` defines operator daily rhythm, command reference, and machine-maintained `<!-- AUTO:xxx -->` … `<!-- /AUTO:xxx -->` regions. [Source: vault `CNS-Daily-Rhythm.md`]
- **Deferred-work:** “CNS-Daily-Rhythm.md auto-update from session-close `AUTO` blocks” — class (b) Architecture, Medium priority. [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- **Session-close today (28.1):** Rewrites AGENTS §8, syncs constitution copies, export, MEMORY.md, vault-fast-scan-index, NotebookLM fan-out. Does **not** yet touch `CNS-Daily-Rhythm.md`. [Source: `scripts/hermes-skill-examples/session-close/SKILL.md`, `references/task-prompt.md`]
- **WriteGate:** `AI-Context/**` is protected for Vault IO mutators (`PROTECTED_PATH`). Same pattern as AGENTS.md: **filesystem overwrite** on the canonical vault path, not `vault_update_frontmatter`. [Source: `src/write-gate.ts`; Story 28.1 Context]
- **Vault-lint reports:** Latest scan summary lives at `{CNS_VAULT_ROOT}/_meta/reports/vault-lint-YYYY-MM-DD.md` with `## Summary` bullets (`Scanned`, `Clean`, `Errors`, `Warnings`). [Source: `specs/cns-vault-contract/modules/vault-lint.md`; sample `vault-lint-2026-05-21.md`]
- **Hermes config:** Provider/model at `~/.hermes/config.yaml` → `model.provider`, `model.default`. [Source: operator `config.yaml`]
- **Sprint tracker:** `_bmad-output/implementation-artifacts/sprint-status.yaml` → `development_status`. [Source: sprint-status.yaml]
- **Doc drift:** `CNS-Daily-Rhythm.md` §End of Session claims session-close runs `git commit` and always runs `npm test`. Story 28.1 **forbids** git commit/push in task-prompt. This story may run **`npm test`** for the `AUTO:TESTS` block only; **do not** add git commit to session-close unless a separate operator-approved story says so. Update Operator Guide to match shipped behavior.

### AUTO block inventory (must all be wired)

| Marker | Current example | Data source |
|--------|-----------------|-------------|
| `AUTO:PROVIDER` | `openai-codex / gpt-5.5` | `~/.hermes/config.yaml` `model.provider` + `model.default` |
| `AUTO:VAULT_NOTES` | `115` | Latest vault-lint report `Scanned:` **or** governed-note count from same report |
| `AUTO:VAULT_HEALTH` | `115/115 clean — ERRORS: 0, WARNINGS: 0` | Latest vault-lint report Summary lines |
| `AUTO:SPRINT` | Epic 38 narrative | `sprint-status.yaml` active epics + in-progress/review/deferred stories |
| `AUTO:AGENTS_VERSION` | `v2.1.4` | AGENTS header `> Version: X.Y.Z` (after Step 5 sync in same close) |
| `AUTO:SKILLS_COUNT` | `91 available` | Count skill packages under `~/.hermes/skills/` (document rule: top-level dirs + nested `*/SKILL.md` or Hermes CLI if stable) |
| `AUTO:TESTS` | `609 passing` | `npm test` in `<resolved_repo_root>`; parse vitest summary `Tests N passed` |
| `AUTO:LAST_SESSION` | `2026-05-22` | Local `YYYY-MM-DD` on **real** close only |
| `AUTO:ACTIVE_PROJECTS` | markdown table | See §Active projects synthesis below |
| `AUTO:DEFERRED_SUMMARY` | markdown table | `_bmad-output/implementation-artifacts/deferred-work.md` Summary table |
| `AUTO:ROADMAP` | markdown table | `sprint-status.yaml` epic keys + statuses; include epics 38–42 per planning doc |

**Replacement contract:** For each marker, replace **only** the inner content between `<!-- AUTO:TAG -->` and `<!-- /AUTO:TAG -->`, preserving both comment anchors and surrounding markdown. Use UTF-8, LF endings. Idempotent: second run with unchanged inputs → same bytes.

## Story

As an **operator**,  
I want **`/session-close` to refresh every `<!-- AUTO:xxx -->` block in `AI-Context/CNS-Daily-Rhythm.md` from live sprint status, Hermes config, vault-lint, and repo test results**,  
so that **my daily operating rhythm doc stays truthful without manual edits** and **Pattern 7 “check AUTO blocks” reflects real system state after each session**.

## Acceptance Criteria

1. **Task prompt step (AC: step)**  
   **Given** the session-close skill at `scripts/hermes-skill-examples/session-close/`  
   **When** this story ships  
   **Then** `references/task-prompt.md` defines **Step 6.7** (after 6.6, before NotebookLM Step 7 renumber or insert as “Step 6.7” with later steps shifted — keep monotonic step numbers documented in Dev Agent Record) that:  
   - Skips entirely on `--dry-run` (preview block values in Discord reply only; **no** write to `CNS-Daily-Rhythm.md`)  
   - Runs on real close after AGENTS sync (Step 5) so `AUTO:AGENTS_VERSION` matches post-close header  
   - Writes only via filesystem to `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/CNS-Daily-Rhythm.md`  
   - Does **not** call Vault IO mutators for this path  

2. **Marker coverage (AC: markers)**  
   **When** Step 6.7 runs on real close  
   **Then** all eleven markers in the inventory table are updated per their data source  
   **And** no `<!-- AUTO:` block in the file is left with stale 2026-05-22 seed content unless the source truly unchanged (byte compare optional in tests)

3. **Vault-lint freshness (AC: lint)**  
   **When** populating `AUTO:VAULT_NOTES` and `AUTO:VAULT_HEALTH`  
   **Then** the skill reads the **newest** `{CNS_VAULT_ROOT}/_meta/reports/vault-lint-*.md` by filename date (not mtime alone)  
   **And** if no report exists for today and notes/health would be stale, run **`/vault-lint`** first **or** invoke the vault-lint bulk scan script from repo (`scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py` path documented in task-prompt) — document chosen strategy in Dev Agent Record; prefer **reuse latest report ≤7 days** else trigger scan in same session-close turn  

4. **Sprint narrative (AC: sprint)**  
   **When** populating `AUTO:SPRINT`  
   **Then** content summarizes every `epic-N: in-progress` plus notable `ready-for-dev` / `review` / `deferred` story keys for those epics in one line ≤120 chars if possible, else two lines max inside the marker  

5. **Tests block (AC: tests)**  
   **When** populating `AUTO:TESTS`  
   **Then** Hermes runs `npm test` from `<resolved_repo_root>` (same repo resolution as 28.1)  
   **And** on non-zero exit, write `AUTO:TESTS` as `FAILED (see session-close log)` and set `failure_class: tests` in Discord reply without aborting AGENTS/NotebookLM steps already completed (partial close policy)

6. **Active projects table (AC: projects)**  
   **When** populating `AUTO:ACTIVE_PROJECTS`  
   **Then** the table includes one row per epic with `development_status` value `in-progress` (title from `_bmad-output/planning-artifacts/epics.md` heading if available, else `Epic N`)  
   **And** preserves **operator business rows** not derivable from sprint YAML via static supplement list in `references/daily-rhythm-static-rows.md` (new file): seed from current vault doc (LinkedIn, Lead-Gen, Operator System Synthesis, etc.)  
   **And** merging rule: sprint rows first, then static rows whose project name is not already present  

7. **Deferred summary (AC: deferred)**  
   **When** populating `AUTO:DEFERRED_SUMMARY`  
   **Then** parse `_bmad-output/implementation-artifacts/deferred-work.md` **Summary table** (top of file) for rows with Class `(b)` and take up to **12** rows sorted by priority column (P0 before P1…)  
   **And** emit markdown table with columns `Item | Priority | Class` matching existing doc style  

8. **Roadmap table (AC: roadmap)**  
   **When** populating `AUTO:ROADMAP`  
   **Then** emit one row per epic key `epic-38` … `epic-42` (extend range when sprint adds epics) with status from `sprint-status.yaml` and theme from `epics.md` or static fallback strings in `daily-rhythm-static-rows.md`  

9. **SKILL.md + pitfalls (AC: skill)**  
   **When** shipped  
   **Then** `SKILL.md` Overview and Steps mention CNS-Daily-Rhythm refresh  
   **And** Pitfalls documents: do not use `hermes_tools.read_file` in execute_code for this file (same as AGENTS); symlink path is direct vault write; table rows must not break `|` in titles (sanitize)  

10. **Install + parity (AC: parity)**  
    **When** implementation completes  
    **Then** `bash scripts/install-hermes-skill-session-close.sh` copies updates to `~/.hermes/skills/cns/session-close/`  
    **And** `cmp` repo vs installed for `SKILL.md` and `references/task-prompt.md`  

11. **Tests (AC: verify)**  
    **When** implementation completes  
    **Then** extend `tests/hermes-session-close-skill.test.mjs` with assertions for Step 6.7, `CNS-Daily-Rhythm.md`, each AUTO marker name, dry-run skip, and forbidden Vault IO mutators on rhythm path  
    **And** `npm test` and `bash scripts/verify.sh` pass  

12. **Operator guide (AC: docs)**  
    **When** shipped  
    **Then** `03-Resources/CNS-Operator-Guide.md` §15.4 Session close lists Step 6.7 / AUTO block refresh  
    **And** corrects any claim that session-close runs `git commit` (unless explicitly deferred)  
    **And** Version History row added  

13. **Footer line (AC: footer)**  
    **When** real close updates the file  
    **Then** the document footer `*Last auto-update: …*` (line ~513) is set to current date, AGENTS version, and provider string matching AUTO blocks  

## Tasks / Subtasks

- [ ] Add `references/daily-rhythm-static-rows.md` with non-sprint project rows and epic 39–42 theme fallbacks (AC: projects, roadmap)
- [ ] Implement Step 6.7 in `references/task-prompt.md` with deterministic parsing helpers (AC: step, markers)
- [ ] Update `SKILL.md` overview, steps, pitfalls (AC: skill)
- [ ] Run install script + `cmp` (AC: parity)
- [ ] Extend `tests/hermes-session-close-skill.test.mjs` (AC: verify)
- [ ] Update Operator Guide §15.4 + version history (AC: docs)
- [ ] Smoke: `/session-close --dry-run` shows preview of AUTO values; real close updates vault file (AC: step)
- [ ] Mark deferred-work item closed or “in progress → done” in Dev Agent Record when complete (AC: deferred-work hygiene)

## Dev Notes

### Implementation pattern (follow 28.1 / 29-9)

- **Single `execute_code` or terminal python3** block for read-all → compute-all → write-once (avoid split-cell `NameError` on `rows`). [Source: session-close Pitfalls Step 6.6]
- **Read paths with `open()`**, not `hermes_tools.read_file` in sandbox. [Source: session-close Pitfalls]
- **Repo root:** `OMNIPOTENT_REPO` or `/home/christ/ai-factory/projects/Omnipotent.md`. [Source: task-prompt Hard constraints]
- **Vault root:** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/` or `CNS_VAULT_ROOT`.

### Suggested Step 6.7 algorithm (pseudocode)

```python
RHYTHM = f"{VAULT_ROOT}/AI-Context/CNS-Daily-Rhythm.md"
text = open(RHYTHM, encoding="utf-8").read()

def replace_auto(tag, inner):
    global text
    pat = rf"<!-- AUTO:{tag} -->.*?<!-- /AUTO:{tag} -->"
    text = re.sub(pat, f"<!-- AUTO:{tag} -->{inner}<!-- /AUTO:{tag} -->", text, count=1, flags=re.DOTALL)

# ... compute provider, lint, sprint, agents_version, skills, tests, date ...
# ... rebuild ACTIVE_PROJECTS, DEFERRED_SUMMARY, ROADMAP as full markdown tables ...

open(RHYTHM, "w", encoding="utf-8", newline="\n").write(text)
```

### AUTO:SPRINT example shape

`Epic 38 in-progress (38-1, 38-3 done; 38-2 ready-for-dev)` — derive from YAML order preserved in file.

### AUTO:VAULT_HEALTH example shape

`{clean}/{scanned} clean — ERRORS: {errors}, WARNINGS: {warnings}` from report Summary.

### Discord reply addition (Step 9)

Add bullet: `- **daily_rhythm:** updated | preview-only | failed`

### Non-goals

- No Vault IO WriteGate carve-out
- No edits to manual sections of CNS-Daily-Rhythm (workflow patterns, command tables without AUTO markers)
- No automatic git commit
- No changes to `sprint-status.yaml` from session-close

### Project Structure Notes

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/session-close/references/task-prompt.md` | Add Step 6.7, renumber downstream steps |
| `scripts/hermes-skill-examples/session-close/references/daily-rhythm-static-rows.md` | **New** — static table rows |
| `scripts/hermes-skill-examples/session-close/SKILL.md` | Overview + pitfalls |
| `~/.hermes/skills/cns/session-close/` | Install target |
| `tests/hermes-session-close-skill.test.mjs` | Assertions |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Docs |
| Vault `AI-Context/CNS-Daily-Rhythm.md` | Runtime output (not in git repo) |

### References

- [Source: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/CNS-Daily-Rhythm.md` — AUTO block definitions]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — original requirement]
- [Source: `_bmad-output/implementation-artifacts/28-1-automate-agents-md-section-8-via-hermes-session-close.md` — WriteGate + filesystem pattern]
- [Source: `_bmad-output/implementation-artifacts/36-2-hermes-skill-parity-pass.md` — install/cmp/test pattern]
- [Source: `scripts/hermes-skill-examples/session-close/references/task-prompt.md` — Steps 6.5–6.6 precedents]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md` — report Summary format]

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

(create-story workflow)

### Debug Log References

### Completion Notes List

### File List

## Previous story intelligence

- **28.1:** Established session-close, dual AGENTS sync, MEMORY + fast-scan regeneration, NotebookLM fan-out, dry-run semantics, `failure_class` reply shape. Reuse all hard constraints. [Source: `28-1-automate-agents-md-section-8-via-hermes-session-close.md`]
- **36.2:** Pitfalls must live in repo mirror; `cmp` after install; extend hermes-session-close tests. [Source: `36-2-hermes-skill-parity-pass.md`]

## Git intelligence

Recent session-close work: skill parity (36-2), provider migration doc (38-1). Pattern: repo mirror → install script → vitest skill tests → verify.sh.

## Latest tech information

- Hermes skill layout unchanged (HI-8). No new npm dependencies expected; optional `yaml` parsing in inline Python via PyYAML if already on host, else regex-parse sprint-status for minimal deps.
- Vitest summary line format: `Tests  609 passed (609)` — parse with regex `Tests\s+(\d+)\s+passed`.

## Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` §6.5 token budgets — AUTO tables are in a **on-demand** doc, not always-on context; no new always-on budget required.
- Phase 7 active: Epic 38 in-progress per sprint-status.
