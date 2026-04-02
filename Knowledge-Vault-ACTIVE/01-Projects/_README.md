---
purpose: Active project workspaces that contain project docs and project-scoped context
schema_required: true
allowed_pake_types: WorkflowNote
naming_convention: Project subfolders under `01-Projects/` with stable, human-readable project names
---

# 01-Projects

## What Goes Here
Project-level planning, specs, and workflow tracking for active initiatives.

Within this directory:
- Each project lives in its own subfolder, `01-Projects/<project-name>/`.
- Project-scoped notes should include PAKE standard frontmatter and are typically `pake_type: WorkflowNote`.
- Place project-specific references and working docs under the project folder, not in 00-Inbox.

## What Does Not Go Here
Untriaged raw captures should go to `00-Inbox/`.

Reference material that is not part of a specific active project should go to `03-Resources/`.

Time-based daily logs should go to `DailyNotes/`.

## Frontmatter Requirements
Notes outside `00-Inbox/` must include PAKE standard frontmatter fields:
`pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `confidence_score`, `verification_status`, `creation_method`, and `tags`.

For workflow and planning notes in project folders, set:
`pake_type: WorkflowNote`.

