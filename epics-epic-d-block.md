---

## Phase 2 — Epic D: Obsidian Bases panels (visibility layer)

Read-only Bases panels inside the vault give the operator at-a-glance visibility into inbox state, project status, and research coverage. Panels derive their data from PAKE frontmatter already present in vault notes and require no vault-io API calls at read time.

**Source:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` §Epic D.
**Tracked in sprint-status as:** `epic-11` (story `11-1`).

### Story D.1: Three read-only Bases panels

As an **operator**,
I want **`inbox-triage.base`, `project-status.base`, and `research-tracker.base` under `_meta/bases/`**,
so that **I have persistent, filter-driven visibility into inbox, project, and research state directly inside Obsidian**.

**Acceptance Criteria (summary):**

**Given** PAKE frontmatter exists on notes in `00-Inbox/`, `01-Projects/`, and `03-Resources/`
**When** the operator opens each `.base` file in Obsidian
**Then** each panel renders the correct filtered, sorted table view for its domain
**And** inline editing is not enabled (deferred to a future Epic D story)
**And** `_meta/bases/_README.md` documents panel purpose, read-only policy, and the write-capability deferral rationale
**And** `bash scripts/verify.sh` passes (no vault-io code changes in this story).
