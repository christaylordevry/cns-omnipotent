# Task: `/session-close` CNS closure (Story 28.1)

## Hard constraints

1. **Repo root resolution:** If `OMNIPOTENT_REPO` is set to an absolute path, use it. Otherwise use the fixed host fallback `/home/christ/ai-factory/projects/Omnipotent.md`. The resolved repo root must contain `scripts/export-vault-for-notebooklm.sh` and `_bmad-output/implementation-artifacts/sprint-status.yaml`. Do not guess cwd.
2. **AGENTS mutation boundary:** Do not call Vault IO mutators for AGENTS.md. `AI-Context/**` is WriteGate-protected and returns `PROTECTED_PATH`. Use filesystem edits for both constitution copies:
   - `<resolved_repo_root>/specs/cns-vault-contract/AGENTS.md`
   - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`
3. **Forbidden Vault IO mutators:** `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_log_action`.
4. **Allowed Vault IO usage:** read-only project map discovery with `vault_read`, `vault_search`, `vault_list`, or `vault_read_frontmatter`.
5. **Dry run:** `/session-close --dry-run` performs reads and synthesis only. It must not write AGENTS files, run the export script, call `source_add`, or write `AI-Context/MEMORY.md`, `AI-Context/vault-fast-scan-index.md`, or `AI-Context/CNS-Daily-Rhythm.md`. Dry-run **may** compute Step 6.7 AUTO block values and include them in the Discord reply as preview-only.
6. **No secrets:** Do not paste note bodies, export content, env values, or raw NotebookLM payloads into Discord.
7. **Hermes npm PATH:** `execute_code` and minimal terminal shells may not have `npm` on PATH even when `auto_source_bashrc` is enabled. Before **any** `npm` command in this skill (`npm test`, `npm run vault:fast-scan`, etc.):
   - Prefer the newest NVM install: `NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"` then `export PATH="${NODE_BIN}:$PATH"`.
   - Fallback when NVM layout differs: `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`.
   - Then `cd "<resolved_repo_root>"` before the npm subcommand.
   - If `command -v npm` still fails, treat `AUTO:TESTS` as `FAILED (see session-close log)` and set `failure_class: tests`.

## Preconditions

Resolve `resolved_repo_root` in this order:

1. Use `OMNIPOTENT_REPO` only if it is set to a non-empty absolute path.
2. Otherwise use `/home/christ/ai-factory/projects/Omnipotent.md`.

If the resolved path is missing, relative, not a directory, or lacks the sprint tracker, reply:

```markdown
## Session close blocked

- **failure_class:** repo_root
- **message:** Could not resolve the Omnipotent.md repo from `OMNIPOTENT_REPO` or `/home/christ/ai-factory/projects/Omnipotent.md`; set `OMNIPOTENT_REPO` to the absolute repo path, then rerun `/session-close`.
- **actions_taken:** none
```

Stop.

## Trigger modes

- `/session-close`: real close.
- `/session-close --dry-run`: preview only.

Reject every other flag or trailing argument with `failure_class: invalid_input` and no tools beyond parsing.

## Step 1: Read sprint status

Read the full file:

`<resolved_repo_root>/_bmad-output/implementation-artifacts/sprint-status.yaml`

Parse enough of `development_status` to identify:

- Active epics: keys like `epic-28` with value `in-progress`.
- In-progress stories.
- Review stories.
- Backlog and ready-for-dev stories relevant to active epics.
- Recent completions: the newest story files with `Status: done` or sprint status `done`.

Preserve story order from the YAML file.

## Step 2: Select recent story artifacts

Under `<resolved_repo_root>/_bmad-output/implementation-artifacts/`, select the **three most recently modified** files whose basename matches:

`^[0-9]+-[0-9]+-.+\.md$`

Default exclusions:

- `cns-session-handoff-*.md`
- `deferred-work.md`
- `epic-*-retro*.md`
- `*-retrospective*.md`
- non-markdown files
- `sprint-status.yaml`

For each selected story, read only enough to extract title, status, acceptance outcome, and key completion notes. Summarize in one short bullet. Do not paste full bodies.

## Step 3: Synthesize Section 8

Replace exactly from the heading `## 8. Current Focus` through the line immediately before `## 9. Agent Behavior Guidelines`.

Preserve these intro blockquote lines when still accurate:

```markdown
> Update this section whenever your active priorities shift.  
> This is the "what am I working on right now" that agents check first.
```

Required subsection shape:

```markdown
## 8. Current Focus

> Update this section whenever your active priorities shift.  
> This is the "what am I working on right now" that agents check first.

### Project Status

- <status bullet from sprint-status.yaml>

### Current Priorities

1. <priority from active epic/story status>
2. <priority from review or ready-for-dev queue>
3. <maintenance priority for Section 8 and NotebookLM freshness when relevant>

### Recent Session Context

- <three recent story bullets, newest first>

### Phase 2 Backlog (Sequenced, Not Active)

- <retain only still-applicable backlog items, or omit this subsection>

### Parking Lot (Phase 3+)

- <retain only still-applicable parking lot items, or omit this subsection>
```

Do not leave stale Epic 16 text unless sprint-status.yaml still supports it.

## Step 4: Bump header version and changelog

Read the current header blockquote in each AGENTS file. Bump the patch version by one for Section 8-only changes. Example: `> Version: 1.9.2 | Last updated: 2026-04-29` becomes `> Version: 1.9.3 | Last updated: <YYYY-MM-DD>`.

Set `Last updated:` to the current local date in `YYYY-MM-DD`.

Add one changelog row above the previous latest row:

```markdown
| <YYYY-MM-DD> | <new-version> | Story 28.1: Section 8 regenerated by Hermes `/session-close`; current focus now derives from sprint-status.yaml and recent story artifacts. |
```

Section 9 onward must remain unchanged except for the changelog row.

## Step 5: Sync both AGENTS copies

Apply the same complete AGENTS content to:

- `<resolved_repo_root>/specs/cns-vault-contract/AGENTS.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`

Then verify the two files are **byte-for-byte** identical. If either path is missing or read-only, report `failure_class: agents_sync` and do not claim success.

If the repo contains `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md`, update it to the same bytes as the specs mirror so constitution mirror tests stay green.

## Step 6: Export for NotebookLM

For real close only:

1. `cd` to `<resolved_repo_root>`.
2. Run `bash scripts/export-vault-for-notebooklm.sh`.
3. Respect `CNS_VAULT_ROOT` from the environment when set. If unset, use the script default.
4. Confirm `scripts/output/vault-export-for-notebooklm.md` exists.
5. Report path and byte size only.

If the script exits non-zero or output is missing, report `failure_class: export` and skip NotebookLM fan-out.

## Step 6.5: Regenerate MEMORY.md (before Step 6.6)

Skip this entire step in dry-run mode.

After the AGENTS Section 8 update (Step 5) and after export (Step 6), regenerate `MEMORY.md` by reading:

- `<resolved_repo_root>/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (only §8: “### Current Priorities” item 1, and “### Recent Session Context” top 3 bullets)

Then **overwrite** the canonical memory file at:

`/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`

Hard constraints:

- Overwrite, never append. Running the step twice with unchanged inputs must produce byte-identical output.
- Output must be **under 2,000 characters**.
- Do not include timestamps, relative language, random IDs, or anything non-deterministic.
- Do not call any Vault IO mutators for this file.

Write **exactly** this template:

```markdown
## CNS State (auto — /session-close)
Phase 6 active. Epic [N] [status]. Done: [completed story IDs].

## Last Session Decisions
- [decision 1 from AGENTS.md §8 recent context]
- [decision 2]
- [decision 3]

## Environment
- Gateway: WSL `@reboot` cron runs `scripts/hermes-gateway-start.sh` (idempotent; logs `~/.hermes/logs/gateway-cron.log`, reboot wrapper `gateway-reboot-cron.log`)
- SOUL.md: remove after every hermes version/gateway start
- Vault: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/

## Next Session
[Priority 1 from AGENTS.md §8 current priorities]
```

## Step 6.6: Regenerate vault-fast-scan-index.md (after MEMORY.md, before NotebookLM)

Skip this entire step in dry-run mode.

After Step 6.5 completes, build the **vault fast-scan index** so agents can load a bounded catalog before deep reads.

**Vault root:** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/` (same tree as export and `MEMORY.md`).

**Scan (recursive `*.md` only):**

- `01-Projects/`
- `02-Areas/`
- `03-Resources/`

**Do not** scan `00-Inbox/`, `DailyNotes/`, `04-Archives/`, `_meta/`, or `AI-Context/` except paths that genuinely live under the three roots above.

For each file:

1. Read frontmatter (operator filesystem read or read-only `vault_read_frontmatter`).
2. Map `pake_type` to a line prefix: `SourceNote`→`SRC`, `InsightNote`→`INS`, `SynthesisNote`→`SYN`, `DailyNote`→`DLY`, anything else or missing→`OTH`.
3. **Path:** vault-relative POSIX path (forward slashes), e.g. `03-Resources/CNS-Operator-Guide.md`.
4. **Title:** frontmatter `title` (strip YAML quotes if present). If missing, use the filename without `.md`. Replace any `|` in the title with ` - `.
5. **Created column:** `YYYY-MM-DD` from frontmatter `created`, else `date`, else `modified`, else format filesystem `mtime` as `YYYY-MM-DD`.
6. **Sort key:** descending **modified** time: parse frontmatter `modified` (`YYYY-MM-DD`) when present, else use filesystem `mtime`.

Sort all rows by that key (newest first). Start with cap **N = min(100, row count)**. Build the file **exactly** as:

```markdown
# Vault Fast-Scan Index (auto — /session-close)
# Format: [TYPE] [path] | [title] | [created]
# Token budget: ≤2,000 tokens | Cap: 100 most-recently-modified notes

```

Then one line per included row:

`[TYPE] [path] | [title] | [YYYY-MM-DD]`

**Token budget:** Let `chars` be the UTF-16 string length of the entire file (headers plus all body lines). Require `ceil(chars / 4) <= 2000`. If the file is too large, decrease `N` by **5** and rebuild until it fits (stop at `N = 0` if needed, headers only).

**Write (operator filesystem only):** overwrite

`/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md`

Hard constraints:

- **Do not** call `vault_create_note`, `vault_update_frontmatter`, or any Vault IO mutator for this path.
- Deterministic for unchanged inputs (same bytes if nothing changed).
- Optional: run `npm run vault:fast-scan` from `<resolved_repo_root>` when `CNS_VAULT_ROOT` points at the canonical vault, as a parity check (apply **Hard constraint 7** npm PATH prelude first); the Discord skill path still ends with the canonical file bytes above.

## Step 6.7: Refresh CNS-Daily-Rhythm AUTO blocks (after Step 6.6, before NotebookLM)

**Dry-run:** Compute all AUTO values and include a **preview** subsection in the Step 9 Discord reply. Do **not** write `CNS-Daily-Rhythm.md`.

**Real close:** Run after Step 5 (AGENTS sync) and after Step 6.6 so `AUTO:AGENTS_VERSION` matches the post-close header. Use a **single** `execute_code` or terminal `python3` pipeline: read all inputs → compute all markers → write once.

**Paths:**

- **Vault root:** `CNS_VAULT_ROOT` if set to an absolute path, else `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/`
- **Rhythm file:** `{vault_root}/AI-Context/CNS-Daily-Rhythm.md`
- **Static supplements:** `<resolved_repo_root>/scripts/hermes-skill-examples/session-close/references/daily-rhythm-static-rows.md`
- **Hermes config:** `~/.hermes/config.yaml`
- **Skills root:** `~/.hermes/skills/`

**Write boundary:** Filesystem `open()` read/write only. Do **not** call `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, or `vault_log_action` for `CNS-Daily-Rhythm.md` or any `AI-Context/**` path in this step. Do **not** use `hermes_tools.read_file` inside `execute_code` (use plain `open()`).

**Replacement contract:** For each tag `TAG`, replace only the inner content between `<!-- AUTO:TAG -->` and `<!-- /AUTO:TAG -->`, preserving both comment anchors. UTF-8, LF newlines. Idempotent when inputs are unchanged.

```python
import re

def replace_auto(text, tag, inner):
    pat = rf"<!-- AUTO:{tag} -->.*?<!-- /AUTO:{tag} -->"
    repl = f"<!-- AUTO:{tag} -->{inner}<!-- /AUTO:{tag} -->"
    return re.sub(pat, repl, text, count=1, flags=re.DOTALL)
```

### Data sources (all eleven markers)

| Tag | Inner shape | Source |
|-----|-------------|--------|
| `PROVIDER` | `{provider} / {default_model}` | `~/.hermes/config.yaml` → `model.provider`, `model.default` |
| `VAULT_NOTES` | integer | Latest vault-lint report `Scanned:` (see below) |
| `VAULT_HEALTH` | `{clean}/{scanned} clean — ERRORS: {e}, WARNINGS: {w}` | Same report Summary (`Clean:`, `Errors:`, `Warnings:`) |
| `SPRINT` | one line ≤120 chars, two max | `sprint-status.yaml` `development_status` |
| `AGENTS_VERSION` | `vX.Y.Z` | Vault `AI-Context/AGENTS.md` header `> Version: X.Y.Z` (post Step 5) |
| `SKILLS_COUNT` | `{n} available` | Count dirs under `~/.hermes/skills/` that contain `SKILL.md` at `{dir}/SKILL.md` or `{dir}/*/SKILL.md` (count each skill package once) |
| `TESTS` | `{n} passing` or `FAILED (see session-close log)` | **Hard constraint 7** npm PATH prelude, then `npm test` in `<resolved_repo_root>`; regex `Tests\s+(\d+)\s+passed` on combined stdout/stderr; if exit 0 but no match, use `FAILED (see session-close log)` |
| `LAST_SESSION` | `YYYY-MM-DD` | Local date on real close only; dry-run: omit write, preview may show computed date |
| `ACTIVE_PROJECTS` | markdown table | Sprint + static rows (below) |
| `DEFERRED_SUMMARY` | markdown table | `deferred-work.md` Summary (below) |
| `ROADMAP` | markdown table | `sprint-status.yaml` + `epics.md` + static fallbacks |

### Vault-lint freshness

1. List `{vault_root}/_meta/reports/vault-lint-*.md`.
2. Pick the file with the **latest date** in the basename (`vault-lint-YYYY-MM-DD.md`), not mtime alone.
3. Parse `## Summary` bullets: `Scanned:`, `Clean:`, `Errors:`, `Warnings:`.
4. **Dry-run:** Stop after step 3. Do **not** invoke `/vault-lint` or `bulk_scan.py`. If the newest report is older than 7 calendar days, use it anyway and note `vault_lint: stale` in the Discord preview.
5. **Real close only:** If the newest report is **older than 7 calendar days** (compare basename date to today), run vault-lint in the same turn:
   - Prefer: invoke Hermes `/vault-lint` if bound, **or**
   - `python3 <resolved_repo_root>/scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py` with `CNS_VAULT_ROOT` set
6. Re-read the newest report after scan. If scan fails, keep the latest report ≤7 days and note `vault_lint: stale` in the Discord reply.

### AUTO:SPRINT

For each `epic-N` with value `in-progress`, build a fragment: `Epic N in-progress (` then comma-separated notable story keys for that epic with status `ready-for-dev`, `review`, `deferred`, or `done` (cap 4 keys). Preserve YAML file order. Join multiple epics with `; ` if needed. Truncate to 120 characters; allow one continuation inside the marker only if unavoidable.

Example: `Epic 38 in-progress (38-2 ready-for-dev); Epic 43 in-progress (43-1 in-progress)`

### AUTO:TESTS failure policy

1. Apply **Hard constraint 7** (npm PATH prelude), then `cd "<resolved_repo_root>"` and run `npm test`.
2. Parse combined stdout/stderr with regex `Tests\s+(\d+)\s+passed`. On match, set inner to `{n} passing`.
3. On non-zero exit, `command -v npm` failure, or exit 0 with no regex match, set inner to `FAILED (see session-close log)` and set `failure_class: tests` in the Discord reply.
4. Do **not** abort Steps 7–8 or undo AGENTS/MEMORY/fast-scan work already completed.

Example shell prelude (same cell as `npm test`):

```bash
NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-$HOME/.nvm/versions/node/v24.14.0/bin}:$PATH"
cd "<resolved_repo_root>" && npm test
```

### AUTO:ACTIVE_PROJECTS

Emit a markdown table:

```markdown
| Project | Status | Next action |
|---|---|---|
```

**Sprint rows (first):** For each `epic-N` in `development_status` with value `in-progress`, add one row:

- **Project:** title from `epics.md` `### Epic N:` heading after the colon, else `Epic N`
- **Status:** `in-progress`
- **Next action:** comma-separated story keys for that epic with status `in-progress`, `ready-for-dev`, or `review` (max 3), else `—`

**Static rows (second):** Parse the table under `## Active projects — operator business rows` in `daily-rhythm-static-rows.md`. Append each row whose Project name is not already present (case-insensitive).

Sanitize: replace `|` in any cell with ` - `.

### AUTO:DEFERRED_SUMMARY

Read `<resolved_repo_root>/_bmad-output/implementation-artifacts/deferred-work.md`. Parse the **Summary table** (rows under `## Summary table`).

Include rows where the **Class** column contains `(b)`.

Derive **Priority** for sorting:

| Class text contains | Priority |
|---------------------|----------|
| `High` | P1 |
| `Medium` | P2 |
| `Low` | P3 |
| explicit `P0`–`P4` in Class or Item | use that token |

Sort ascending by priority (`P0` before `P1` …). Take up to **12** rows.

Emit:

```markdown
| Item | Priority | Class |
|---|---|---|
```

Use the short Item text (first column), derived Priority, and full Class column.

### AUTO:ROADMAP

Determine epic range: all keys matching `^epic-\d+$` in `development_status`, plus at minimum `epic-38` through `epic-42`.

For each epic number in range (sorted numerically), emit one row:

- **Epic:** number only (e.g. `38`)
- **Theme:** from `epics.md` heading, else theme fallback table in `daily-rhythm-static-rows.md`
- **Status:** `development_status[epic-N]` if present, else status fallback from static file

### Document footer

After all `replace_auto` calls, set the document footer line (near end of file) to:

```markdown
*Last auto-update: {YYYY-MM-DD} | AGENTS.md {version} | Provider: {provider}/{model}*
```

Use the same date, AGENTS version, and provider strings as the AUTO blocks.

### Write

`open(RHYTHM, "w", encoding="utf-8", newline="\n").write(text)` once.

Record in Discord reply: `daily_rhythm: updated | preview-only | failed`.

## Step 7: Resolve active NotebookLM notebooks

Use read-only vault tools to locate the project map:

1. Try `vault_read` on `03-Resources/notebooklm-project-map.md`.
2. If not found, try `vault_read` on `03-Resources/NotebookLM-Project-Map.md`.
3. If still not found, call `vault_search` with `query: "NotebookLM Project Map"`, `scope: "03-Resources/"`, `max_results: 10`, then `vault_read` the best matching map.

Active row semantics:

- If a table has a `Status` column, include rows where `Status` is `active`.
- If a table has an `Include` column, include rows where `Include` is `yes`.
- If neither column exists, include rows with a concrete notebook title and exclude rows where the notebook cell is unmapped, blank, `*(unmapped)*`, or where `Primary Use` or `Notes` contains `parked` or `inactive`.

The current operator maps use either `Project name | NotebookLM notebook | Primary use | Notes` or `Project | NotebookLM Notebook | Primary Use`. Treat both header variants as valid. If a `Notebook ID`, `NotebookLM ID`, or `notebook_id` column exists, prefer it for `source_add`. If no ID is present, use the notebook title only if the live connector accepts it, and record that fallback in the reply.

## Step 8: NotebookLM source_add fan-out

Skip this entire step in dry-run mode and report `notebooklm: skipped in dry-run`.

For real close only, call NotebookLM MCP `source_add` once per active notebook using the observed live argument shape:

```json
{
  "notebook_id": "<NotebookLM notebook id>",
  "source_name": "My Knowledge Base",
  "source_type": "file",
  "file_path": "<resolved_repo_root>/scripts/output/vault-export-for-notebooklm.md"
}
```

If the active connector requires a different key for the notebook identifier, use the live connector's accepted key and record the observed argument name in the reply. If the project map lacks notebook IDs, resolve IDs from the live NotebookLM connector when available; otherwise fall back to the notebook title only if accepted and record `notebook_id_fallback: title`.

Summarize per-notebook success or failure. Do not dump token-heavy responses.

## Step 9: Final Discord reply

Use this shape:

```markdown
## Session close complete

- **mode:** real | dry-run
- **agents_sync:** synced | preview-only | failed
- **section8_version:** `<version or unchanged>`
- **export:** `<path + bytes, skipped in dry-run, or failed>`
- **notebooklm:** `<n succeeded, m failed, skipped if export failed>`
- **vault_fast_scan:** `<wrote path + est tokens | skipped in dry-run | failed>`
- **daily_rhythm:** `<updated | preview-only | failed>`
- **failure_class:** `<none | repo_root | invalid_input | agents_sync | export | tests | notebooklm>`

### NotebookLM targets

- `<notebook>`: success | failed: `<short class>`
```

If any class failed, use `## Session close partial` or `## Session close blocked` as appropriate.
