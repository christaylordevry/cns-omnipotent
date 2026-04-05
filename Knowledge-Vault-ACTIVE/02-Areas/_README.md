---
purpose: Ongoing responsibilities and responsibilities that are not time-bound
schema_required: true
allowed_pake_types: WorkflowNote
naming_convention: descriptive names aligned to ongoing responsibilities; avoid date-specific prefixes here
---

# 02-Areas

## What Goes Here
Longer-running workstreams that do not belong to a single active project folder.

Typical usage:
- Place ongoing responsibility notes under `02-Areas/<area-name>/` when you need stable organization.
- Use `pake_type: WorkflowNote` for responsibility tracking, plans, and operational notes.
- Fallback meaning for `WorkflowNote`: when project context required for routing into `01-Projects/<project-name>/` is not available, store the `WorkflowNote` under `02-Areas/<area-name>/` when the area is known. If the area is also ambiguous, store it under the `02-Areas/` root as a temporary holding location that requires triage, not as a permanent destination.

## What Does Not Go Here
Untriaged raw captures should go to `00-Inbox/`.

Archived material should go to `04-Archives/`.

Time-bound daily logs should go to `DailyNotes/`.

## Frontmatter Requirements
Notes outside `00-Inbox/` must include PAKE standard frontmatter fields:
`pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `confidence_score`, `verification_status`, `creation_method`, and `tags`.

For ongoing responsibilities notes, set:
`pake_type: WorkflowNote`.

