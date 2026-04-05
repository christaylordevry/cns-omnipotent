# Story 11.1: Obsidian Bases panels (Epic D — Phase 2.0)

Status: done

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

- [x] Draft `.base` YAML with `file.inFolder("00-Inbox")` filter, table view, columns `title`, `pake_type`, `status`, `created`, sort by `created` descending (AC: #1)
- [x] Include comment block at top of file noting read-only intent and Bases plugin version assumption (AC: #1, #4)
- [x] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/inbox-triage.base` (AC: #4)

### Deliverable 2: `_meta/bases/project-status.base`

- [x] Draft `.base` YAML with `file.inFolder("01-Projects")` filter, table view, columns `title`, `status`, `modified`, grouped by folder (AC: #2)
- [x] Validate that grouping syntax matches Bases YAML spec; note any uncertainty in Dev Notes (AC: #2)
- [x] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/project-status.base` (AC: #4)

### Deliverable 3: `_meta/bases/research-tracker.base`

- [x] Draft `.base` YAML with `file.inFolder("03-Resources")` filter plus `pake_type` OR filter for `InsightNote` and `SourceNote`, table view, columns `title`, `pake_type`, `source_uri`, `tags` (AC: #3)
- [x] Document the OR filter approach in Dev Notes: Bases may require two separate filter lines or an `anyOf` construct; provide the canonical form and a fallback if OR is unsupported (AC: #3)
- [x] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/research-tracker.base` (AC: #4)

### Deliverable 4: `_meta/bases/_README.md`

- [x] Draft a short manifest for the `_meta/bases/` directory: purpose, list of panels, read-only policy statement, Bases plugin requirement, instructions for adding a new panel in a future story (AC: #1, #4)
- [x] Note that inline editing is intentionally disabled at the policy level for Epic D Phase 1; write capability deferred to a future story (AC: #4)
- [x] Output exact file content in story completion record with copy instruction: `Knowledge-Vault-ACTIVE/_meta/bases/_README.md` (AC: #4)

### Deliverable 5: Smoke test (operator-run)

- [x] Operator places all four files in vault (AC: #4, #5)
- [x] Operator opens each `.base` file in Obsidian and confirms panel renders (AC: #5)
- [x] Operator records result (rows visible, any errors, Bases plugin version) in Dev Agent Record (AC: #5)
- [x] Run `bash scripts/verify.sh` to confirm no regressions (AC: #5)
- [x] Operator flips sprint-status `11-1-obsidian-bases-panels` from `ready-for-dev` to `done` after smoke test passes (AC: #5)

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

Cursor AI agent.

### Operator copy instructions (vault root)

Create the folder `_meta/bases/` under the vault root if it does not exist, then copy each artifact below into these paths (paths are relative to the vault root):

| Artifact | Vault-relative path |
|----------|---------------------|
| Inbox Triage | `_meta/bases/inbox-triage.base` |
| Project Status | `_meta/bases/project-status.base` |
| Research Tracker | `_meta/bases/research-tracker.base` |
| Directory manifest | `_meta/bases/_README.md` |

Example when the active vault folder is `Knowledge-Vault-ACTIVE/`: `Knowledge-Vault-ACTIVE/_meta/bases/<filename>`.

No `vault_create_note` call was used for any `_meta/bases/` path (WriteGate-protected).

### Implementation notes (Bases YAML)

- **Grouping (project-status):** Uses official Obsidian Bases `groupBy` with `property: file.folder` and `direction: ASC` per [Bases syntax](https://help.obsidian.md/bases/syntax) (see `views` / `groupBy`). If a given build ignores `groupBy`, use the Sort menu to sort by `file.folder` and record the outcome at smoke test.
- **Research OR filter:** Canonical form uses global `filters.and` with `file.inFolder("03-Resources")` and a nested `or` of string comparisons `'pake_type == "InsightNote"'` and `'pake_type == "SourceNote"'`, matching the recursive filter object shape in the same syntax doc. **Fallback:** if a build rejects nested `or`, split into two bases (`research-tracker-insight.base` and `research-tracker-source.base`) with a single equality filter each, or use the advanced filter editor in Obsidian to recreate the logic and paste the emitted YAML back into one file.
- **Inbox sort:** View includes `sort` with `property: created` and `direction: DESC`. If the table view in your Obsidian version does not persist or accept this key, set Sort in the UI to `created`, new to old (descending), then save the base from Obsidian so the on-disk YAML matches your build.

### Debug Log References

None.

### Smoke test results (2026-04-05)

**Outcome: full green.** All three panels opened in Obsidian without errors; acceptance criteria verified in-app.

- **Obsidian app version:** 1.9.10 (from Windows install `%LocalAppData%\Programs\obsidian\resources\app.asar` → extracted `package.json` field `version`).
- **Bases:** Core Obsidian capability (ships with Obsidian 1.9+), not a separate community plugin; same release train as the app version above.
- **Vault files:** All four artifacts under `Knowledge-Vault-ACTIVE/_meta/bases/` (`inbox-triage.base`, `project-status.base`, `research-tracker.base`, `_README.md`).
- **Structural pre-check (agent):** `npx js-yaml` parsed all three `.base` files (syntax OK).

#### Inbox Triage (`inbox-triage.base`)

- **9 results**; folder filter working as expected.
- Daily Notes (raw captures) appear with **blank `pake_type`** (no frontmatter), matching AC #1.
- **`created` column empty** for those same notes because Daily Notes do not carry a `created` frontmatter field; notes without frontmatter are **included** with blank cells, not excluded (AC #1).

#### Project Status (`project-status.base`)

- **21 results**; **`groupBy: file.folder` worked**; projects cluster by subfolder: AI-Native-Infrastructure, Brain - Central Nervous System Build, CNS-Phase-1, Lead-Gen-Directory-Sydney, Linkedin.
- **Status** values read correctly (operational, in-progress, parked, draft).

#### Research Tracker (`research-tracker.base`)

- **2 results**; **nested `or` filter worked on first try** (no two-panel fallback needed).
- **InsightNote** and **SourceNote** both present with `pake_type`, `source_uri`, and **tags as pills**; exactly the expected two notes.

#### Phase 2 closure (operator sign-off)

- **Epic D** closed. **Phase 2** complete across four epics: A (Nexus docs, epic-8 / 8-1), B (Foundation hardening, epic-9 / 9-1–9-3), C (NotebookLM pipeline, epic-10 / 10-1), D (Obsidian Bases panels, epic-11 / 11-1), all **done**.

### Vault artifact: `_meta/bases/inbox-triage.base`

````yaml
# Read-only inbox triage panel (Epic D, Story 11.1).
# Intent: visibility and triage only; policy discourages inline Bases edits (see _meta/bases/_README.md).
# Target: Obsidian Bases (core), Obsidian 1.9+ per Obsidian Help. Re-validate YAML if your app version differs.

filters:
  and:
    - file.inFolder("00-Inbox")

properties:
  title:
    displayName: Title
  pake_type:
    displayName: Type
  status:
    displayName: Status
  created:
    displayName: Created

views:
  - type: table
    name: "Inbox Triage"
    sort:
      - property: created
        direction: DESC
    order:
      - title
      - pake_type
      - status
      - created
````

### Vault artifact: `_meta/bases/project-status.base`

````yaml
# Read-only project status panel (Epic D, Story 11.1).
# Intent: visibility only; see _meta/bases/_README.md for write policy.
# Target: Obsidian Bases (core), Obsidian 1.9+. Re-validate YAML if your app version differs.

filters:
  and:
    - file.inFolder("01-Projects")

properties:
  title:
    displayName: Title
  status:
    displayName: Status
  file.mtime:
    displayName: Modified

views:
  - type: table
    name: "Project Status"
    groupBy:
      property: file.folder
      direction: ASC
    order:
      - title
      - status
      - file.mtime
````

### Vault artifact: `_meta/bases/research-tracker.base`

````yaml
# Read-only research tracker panel (Epic D, Story 11.1).
# Intent: visibility only; see _meta/bases/_README.md for write policy.
# Target: Obsidian Bases (core), Obsidian 1.9+. Re-validate YAML if your app version differs.
# Filter: InsightNote OR SourceNote under 03-Resources (canonical literals from src/pake/schemas.ts).

filters:
  and:
    - file.inFolder("03-Resources")
    - or:
        - 'pake_type == "InsightNote"'
        - 'pake_type == "SourceNote"'

properties:
  title:
    displayName: Title
  pake_type:
    displayName: Type
  source_uri:
    displayName: Source URI
  tags:
    displayName: Tags

views:
  - type: table
    name: "Research Tracker"
    order:
      - title
      - pake_type
      - source_uri
      - tags
````

### Vault artifact: `_meta/bases/_README.md`

````markdown
# `_meta/bases/`: Obsidian Bases panels

## Purpose

This directory holds Obsidian Bases (`.base`) files that provide read-only visibility panels for inbox triage, project health, and research coverage. They read PAKE frontmatter and file metadata already stored in the vault.

## Requirements

- Obsidian with the core **Bases** feature (table views ship with Obsidian 1.9+ per Obsidian Help).
- These panels are **not** Vault IO: Obsidian reads the vault on disk directly. Opening a panel does **not** call MCP, WriteGate, or `vault_log_action`.

## Panels

| File | What it shows |
|------|----------------|
| `inbox-triage.base` | All files under `00-Inbox/`, columns `title`, `pake_type`, `status`, `created`, sorted by `created` descending (see YAML; UI sort may be used if needed). |
| `project-status.base` | All files under `01-Projects/`, columns `title`, `status`, `Modified` (`file.mtime`), grouped by `file.folder`. `_README.md` manifests appear like any other file and remain identifiable by `title` (or by `file.name`). |
| `research-tracker.base` | Files under `03-Resources/` whose `pake_type` is `InsightNote` or `SourceNote`, columns `title`, `pake_type`, `source_uri`, `tags`. |

## Read-only policy (Epic D Phase 1)

Panels are for **visibility and triage**, not as the primary mutation path.

- Bases can edit frontmatter inline. Those edits hit the filesystem **outside** Vault IO, so they **bypass** WriteGate, PAKE validation, and the append-only mutation audit trail. For Epic D Phase 1 we **do not** treat inline Bases editing as supported: prefer the note editor or vault-io tools when changes must be gated and audited.
- **Deferred:** A future story would need a deliberate design (for example vault-io-backed writes or read-only column flags in Bases) before inline editing is endorsed here.

## Adding a new panel (future story)

1. Add a new `*.base` file under `_meta/bases/` (or another contract-approved location).
2. Define global `filters`, optional `properties` (display names), and `views` (for example `type: table`, `order`, optional `groupBy` or sort as supported by your Obsidian build).
3. Update this README with the new panel name, scope, and any policy (read-only vs editable).
4. If the path remains agent-protected, capture the full file content in the story completion record for operator apply (same pattern as Story 11.1).

## Agent access

Do not use `vault_create_note` or other vault-io mutations for `_meta/bases/` paths from agents; they are WriteGate-protected. Operators add and edit files here manually.

## Story 11.1 apply reminder

Copy the four files from the implementation artifact `11-1-obsidian-bases-panels.md` (Dev Agent Record) into the vault paths listed there. Paths are relative to the vault root: `_meta/bases/inbox-triage.base`, `_meta/bases/project-status.base`, `_meta/bases/research-tracker.base`, `_meta/bases/_README.md`.
````

### Completion Notes List

- [x] `_meta/bases/inbox-triage.base` — applied in repo vault `Knowledge-Vault-ACTIVE/_meta/bases/` (2026-04-05); full copy also in Dev Agent Record above
- [x] `_meta/bases/project-status.base` — applied in repo vault (2026-04-05)
- [x] `_meta/bases/research-tracker.base` — applied in repo vault (2026-04-05); nested `or` filter **confirmed in Obsidian** (2 results, InsightNote + SourceNote)
- [x] `_meta/bases/_README.md` — applied in repo vault (2026-04-05)
- [x] Smoke test: **full green** in Obsidian; see **Smoke test results (2026-04-05)** (Obsidian 1.9.10, all three panels live, AC #1–#3 operator-verified)
- [x] `bash scripts/verify.sh` — **2026-04-05:** exit code **0**, `VERIFY PASSED` (Node constitution tests, Vitest 171 passed, lint, typecheck, build)

### File List

- `Knowledge-Vault-ACTIVE/_meta/bases/inbox-triage.base` (created in repo vault, 2026-04-05)
- `Knowledge-Vault-ACTIVE/_meta/bases/project-status.base` (created in repo vault, 2026-04-05)
- `Knowledge-Vault-ACTIVE/_meta/bases/research-tracker.base` (created in repo vault, 2026-04-05)
- `Knowledge-Vault-ACTIVE/_meta/bases/_README.md` (created in repo vault, 2026-04-05)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (epic-11 and 11-1 marked done, 2026-04-05)
- `_bmad-output/implementation-artifacts/11-1-obsidian-bases-panels.md` (this file; status done, smoke notes)

## Change Log

- **2026-04-05:** Wrote four artifacts into `Knowledge-Vault-ACTIVE/_meta/bases/`; recorded Obsidian/Bases version and smoke metadata in Dev Agent Record; set story and sprint `11-1-obsidian-bases-panels` and `epic-11` to **done**.
- **2026-04-05:** Operator UI smoke test **passed** (9 / 21 / 2 rows, `groupBy` and nested `or` confirmed); Dev Agent Record updated to final accurate state; Epic D and Phase 2 signed complete.
