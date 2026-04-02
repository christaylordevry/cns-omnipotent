---
purpose: Daily log files and append-only agent logging
schema_required: true
allowed_pake_types: WorkflowNote
naming_convention: DailyNotes/YYYY-MM-DD.md (use ISO date)
---

# DailyNotes

## What Goes Here
One file per day, named `YYYY-MM-DD.md`.

Inside each daily note, keep:
- An ordered activity log for the day.
- An Agent Log section that records significant vault operations.

Daily notes are append-only during the day and are reviewed periodically.

## What Does Not Go Here
Do not store curated reference material here.

Untriaged raw captures should go to `00-Inbox/`.

## Frontmatter Requirements
Daily note files must include PAKE standard frontmatter fields, and use:
`pake_type: WorkflowNote`.

Daily notes are daily-scoped, so `tags` must include `daily`.

Naming convention:
- File name format: `YYYY-MM-DD.md`.

During the day, append content rather than rewriting history.

