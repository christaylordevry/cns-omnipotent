# Story 11.1: Obsidian Bases panels (Epic D — Phase 2.0)

Status: ready-for-dev

<!-- Sprint tracker: epic-11 / 11-1-obsidian-bases-panels. Phase 2 Epic D: Obsidian Bases visibility panels. Vault artifact authoring only. No vault-io code changes. -->

## Story

As an **operator**,
I want **three read-only Obsidian Bases panels inside the vault giving me at-a-glance visibility into inbox state, project status, and research coverage**,
so that **I never have to run a search or open multiple folders just to triage work, check project health, or audit what has been researched — the panels derive their data directly from PAKE frontmatter already present in the vault**.

## Acceptance Criteria

1. **Inbox Triage panel**
   **Given** the vault contains notes under `00-Inbox/` with PAKE frontmatter
   **When** the operator opens `_meta/bases/inbox-triage.base` in Obsidian
   **Then** the panel renders a table view of all notes in `00-Inbox/`, sorted by `created` descending, with columns: `title`, `pake_type`, `status`, `created`
   **And** notes added to or removed from `00-Inbox/` appear or disappear automatically without any agent action
   **And** the panel does not expose inline editing controls (read-only intent documented in `_meta/bases/_README.md`)
   **And** notes in `00-Inbox/` that have no frontmatter (raw captures) still appear in the panel with blank property cells rather than being silently excluded.

2. **Project Status panel**
   **Given** the vault contains notes under `01-Projects/` organized in project subfolders
   **When** the operator opens `_meta/bases/project-status.base` in Obsidian
   **Then** the panel renders a table view of all notes in `01-Projects/`, showing columns: `title`, `status`, `modified` (file modification time)
   **And** notes are grouped by project subfolder so each project's notes cluster together visually
   **And** `_README.md` manifest files in project subfolders appear in the panel and are identifiable by their title so the operator can filter them mentally or exclude them via a property filter if desired
   **And** no vault-io write or audit log entry is produced by opening the panel (read path only; WriteGate is not involved).

3. **Research Tracker panel**
   **Given** the vault contains `InsightNote` and `SourceNote` typed notes under `03-Resources/`
   **When** the operator opens `_meta/bases/research-tracker.base` in Obsidian
   **Then** the panel renders a table view filtered to notes whose `pake_type` is `InsightNote` or `SourceNote`, with columns: `title`, `pake_type`, `source_uri`, `tags`
   **And** notes with other `pake_type` values or no `pake_type` in `03-Resources/` are excluded from the view
   **And** the `tags` column renders as a comma-separated list or tag pill display depending on Bases rendering capability
   **And** the panel reflects the current file state on each open without any cache warm-up step.

4. **Panel authoring is operator-applied (WriteGate constraint)**
   **Given** `_meta/` structural mutations are WriteGate-protected and agents cannot create new subdirectories or files under `_meta/` via `vault_create_note`
   **When** this story is delivered
   **Then** the agent produces the complete content of all four vault artifacts (three `.base` files plus `_README.md`) in the story completion record
   **And** the operator manually creates `_meta/bases/` in the vault and copies each file in
   **And** the story completion record includes exact copy instructions with file paths relative to the vault root
   **And** no `vault_create_note` call is attempted for any `_meta/bases/` path.

5. **Verification**
   **Given** the operator has placed all three `.base` files in `_meta/bases/`
   **When** Obsidian is open with the vault loaded
   **Then** each panel opens without error and displays at least one row (or a clear empty state if the folder is empty)
   **And** `bash scripts/verify.sh` passes with no regressions (this story adds no vault-io code; verify green is a sanity gate only)
   **And** the operator records the smoke test result in the Dev Agent Record before marking the story done.

## Tasks / Subtasks

### Deliverable 1: `_meta/bases/inbox-triage.base`

- [ ] Draft `.base` YAML with `file.inFolder("00-Inbox")` filter, table view, columns `title`, `pake_type`, `status`, `created`, sort by `created` descending (AC: #1)
- [ ] Include comment block at top of file noting read-only intent and Bases plugin version assumption (AC: #1, #4)
- [ ] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/inbox-triage.base` (AC: #4)

### Deliverable 2: `_meta/bases/project-status.base`

- [ ] Draft `.base` YAML with `file.inFolder("01-Projects")` filter, table view, columns `title`, `status`, `modified`, grouped by folder (AC: #2)
- [ ] Validate that grouping syntax matches Bases YAML spec; note any uncertainty in Dev Notes (AC: #2)
- [ ] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/project-status.base` (AC: #4)

### Deliverable 3: `_meta/bases/research-tracker.base`

- [ ] Draft `.base` YAML with `file.inFolder("03-Resources")` filter plus `pake_type` OR filter for `InsightNote` and `SourceNote`, table view, columns `title`, `pake_type`, `source_uri`, `tags` (AC: #3)
- [ ] Document the OR filter approach in Dev Notes: Bases may require two separate filter lines or an `anyOf` construct; provide the canonical form and a fallback if OR is unsupported (AC: #3)
- [ ] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/research-tracker.base` (AC: #4)

### Deliverable 4: `_meta/bases/_README.md`

- [ ] Draft a short manifest for the `_meta/bases/` directory: purpose, list of panels, read-only policy statement, Bases plugin requirement, instructions for adding a new panel in a future story (AC: #1, #4)
- [ ] Note that inline editing is intentionally disabled at the policy level for Epic D Phase 1; write capability deferred to a future story (AC: #4)
- [ ] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/_README.md` (AC: #4)

### Deliverable 5: Smoke test (operator-run)

- [ ] Operator places all four files in vault (AC: #4, #5)
- [ ] Operator opens each `.base` file in Obsidian and confirms panel renders (AC: #5)
- [ ] Operator records result (rows visible, any errors, Bases plugin version) in Dev Agent Record (AC: #5)
- [ ] Run `bash scripts/verify.sh` to confirm no regressions (AC: #5)
- [ ] Operator flips sprint-status `11-1-obsidian-bases-panels` from `ready-for-dev` to `done` after smoke test passes (AC: #5)

## Dev Notes

### WriteGate and path constraints

`_meta/` structural mutations are denied to agents per `src/write-gate.ts`. Specifically, creating a new subdirectory `_meta/bases/` and placing files in it constitutes a structural mutation. This story follows the same human-apply pattern established in Story 10-1 (workflow module) and Story 8.1 (AI-Context edits): the agent produces all file content; the operator applies it manually.

The agent must not attempt `vault_create_note` with any path under `_meta/bases/`. If `vault_create_note` is called with such a path during implementation, it will fail with `PROTECTED_PATH`. This is expected and correct behavior.

`scripts/verify.sh` still runs because it gates all Phase 2 stories as a sanity check even when no vault-io code changes. The script should exit zero: this story adds no TypeScript, no test files, and no changes to existing source.

### Obsidian Bases syntax reference

Bases files use YAML with up to five top-level sections: `filters`, `formulas`, `properties`, `summaries`, `views`. For this story only `filters`, `properties`, and `views` are needed.

**Canonical `.base` structure used across all three panels:**

```yaml
filters:
  - <filter expression>
properties:
  - <property name>
views:
  - type: table
    sort:
      - property: <property>
        direction: asc | desc
```

**Filter expressions:**

| Use case | Expression |
|----------|-----------|
| Scope to folder | `file.inFolder("00-Inbox")` |
| Match property value | `pake_type: InsightNote` |
| OR across property values | Two filter lines with `anyOf` or property list — see note below |

**OR filter for Research Tracker:** Bases may represent an OR condition as a property value list or an `anyOf` block depending on plugin version. The canonical form to attempt first:

```yaml
filters:
  - file.inFolder("03-Resources")
  - pake_type:
      anyOf:
        - InsightNote
        - SourceNote
```

Fallback if `anyOf` is unsupported: create two separate panels (`research-tracker-insight.base` and `research-tracker-source.base`) and document the limitation. Prefer the single-panel approach and validate at smoke test.

**Grouping for Project Status:** Bases grouping by folder path is expressed in the `views` section:

```yaml
views:
  - type: table
    group:
      - property: file.folder
```

If `file.folder` is not a supported group key in the installed Bases version, fall back to sorting by `file.folder` descending and document in Dev Agent Record.

**Column for file modification time:** Use `file.mtime` as the property name for last-modified timestamp. This is a built-in Bases file property and does not require frontmatter.

**Plugin version assumption:** This story targets Obsidian Bases as available in the operator's vault. Bases is in active development; if syntax errors occur at smoke test, the operator should check the Bases plugin changelog and adjust the YAML accordingly. The Dev Agent Record should capture the plugin version installed.

### No vault-io code changes

This story is vault artifact authoring only. No changes under `src/`, no new MCP tools, no modifications to `write-gate.ts`, `audit/`, or any TypeScript source. `scripts/verify.sh` is run as a gate but not modified.

### Why _meta/bases/ and not a different location

`_meta/` is the designated location for system and agent infrastructure files in the vault contract (schemas, logs, manifests). Bases panels are infrastructure views, not research content, so they belong under `_meta/` not `03-Resources/`. This also keeps them out of the export script (`scripts/export-vault-for-notebooklm.sh` already excludes `_meta/`), preventing panel YAML from being uploaded to NotebookLM as a source.

### Relationship to deferred write capability

Obsidian Bases supports inline property editing when a view does not mark properties as read-only. We are not enabling this in Epic D. The decision is policy-level, not Bases-level: if a user edits a property in a Bases panel, that edit writes directly to the note's frontmatter without going through vault-io WriteGate, bypassing audit logging and PAKE validation. Until vault-io exposes a Bases-compatible write hook (out of scope for Phase 2), inline editing stays off. `_meta/bases/_README.md` must document this clearly so a future developer knows why write capability was deferred and what would be required to enable it safely.

### Project Structure Notes

- `_meta/bases/inbox-triage.base` — new file, operator-placed
- `_meta/bases/project-status.base` — new file, operator-placed
- `_meta/bases/research-tracker.base` — new file, operator-placed
- `_meta/bases/_README.md` — new file, operator-placed
- No changes to `src/`, `scripts/`, `tests/`, or any existing vault-io file

### References

- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` (Epic D scope: `.base` files under `_meta/bases/`, three panel types)
- `src/write-gate.ts` (`isUnderMeta` and structural mutation policy)
- `_bmad-output/implementation-artifacts/10-1-notebooklm-vault-integration.md` (human-apply pattern for protected paths)
- `_bmad-output/implementation-artifacts/8-1-nexus-coexistence-documentation.md` (precedent for operator-applied vault artifacts)
- `specs/cns-vault-contract/AGENTS.md` Section 2 (routing), Section 3 (PAKE frontmatter fields used as panel columns)
- `Knowledge-Vault-ACTIVE/_meta/schemas/` (PAKE type definitions: InsightNote, SourceNote confirm valid `pake_type` values)
- Obsidian Bases plugin documentation (external; validate syntax at smoke test against installed version)

## Previous Story Intelligence

### From Story 10-1 (Epic C, NotebookLM integration)

- **Human-apply pattern is the established norm for protected paths.** Story 10-1 set this for `AI-Context/modules/`; this story applies the same pattern to `_meta/bases/`. The completion record must include exact file content and copy instructions. No variation.
- **Prose style:** No em dashes. Use commas, semicolons, colons, or full stops.
- **Verify gate discipline:** Every Phase 2 story runs `bash scripts/verify.sh` before claiming done, even when no vault-io code changed. This story is no exception.

### From Story 9-1 (Epic B, shared PAKE module)

- `pake_type` values used as panel filters (`InsightNote`, `SourceNote`) are canonical literals from `src/pake/schemas.ts`. Confirm spelling against that file before drafting the `.base` filter expressions; do not rely on memory.

### From Story 8-1 (Epic A, Nexus coexistence)

- `_README.md` manifests in vault directories follow a consistent format: purpose statement, allowed content, naming conventions, agent access level. `_meta/bases/_README.md` should follow this pattern.

### From Epics 4-5 (WriteGate and audit)

- Bases panels do not produce audit log entries because they are read-only filesystem reads, not vault-io mutations. This is by design. Document in `_meta/bases/_README.md` so operators understand that panel usage is not audited.

## Dev Agent Record

### Agent Model Used

_To be filled at implementation time._

### Debug Log References

_To be filled at implementation time._

### Completion Notes List

- [ ] `_meta/bases/inbox-triage.base` — content produced in completion record, operator copy confirmed
- [ ] `_meta/bases/project-status.base` — content produced in completion record, operator copy confirmed
- [ ] `_meta/bases/research-tracker.base` — content produced in completion record, operator copy confirmed; OR filter syntax validated at smoke test
- [ ] `_meta/bases/_README.md` — content produced in completion record, operator copy confirmed
- [ ] Smoke test: all three panels open in Obsidian without error; results recorded here with Bases plugin version
- [ ] `bash scripts/verify.sh` — result recorded here (expected: pass, no regressions)

### File List

- `Knowledge-Vault-ACTIVE/_meta/bases/inbox-triage.base` (new, operator-placed)
- `Knowledge-Vault-ACTIVE/_meta/bases/project-status.base` (new, operator-placed)
- `Knowledge-Vault-ACTIVE/_meta/bases/research-tracker.base` (new, operator-placed)
- `Knowledge-Vault-ACTIVE/_meta/bases/_README.md` (new, operator-placed)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (add epic-11 and 11-1 rows)
- `_bmad-output/implementation-artifacts/11-1-obsidian-bases-panels.md` (this file)
