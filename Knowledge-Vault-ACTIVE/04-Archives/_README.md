---
purpose: Completed or inactive items that should be treated as read-only unless reactivated
schema_required: true
allowed_pake_types: any
naming_convention: Archived titles and stable naming; set `status: archived` in PAKE frontmatter
---

# 04-Archives

## What Goes Here
Notes that are completed, deprecated, or no longer actively maintained.

Recommended practice:
- Keep archived items discoverable by leaving stable titles in place.
- When reactivating, update the note metadata and move the note back to the governed directory that matches its content.

## What Does Not Go Here
Do not write new operational work into archived directories.

Untriaged raw captures belong in `00-Inbox/`.

## Frontmatter Requirements
Notes in `04-Archives/` must include PAKE standard frontmatter fields:
`pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `confidence_score`, `verification_status`, `creation_method`, and `tags`.

Recommended metadata:
`status: archived`.

