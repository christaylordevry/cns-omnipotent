---
purpose: Unprocessed captures that need triage
schema_required: false
allowed_pake_types: any
naming_convention: Free-form titles; triage standardizes names and applies PAKE frontmatter
---

# 00-Inbox

## What Goes Here
Raw captures from clipping, quick notes, and mobile or web ingestion. Notes may be incomplete or missing YAML frontmatter at initial creation.

## What Does Not Go Here
Do not use 00-Inbox for curated, schema-compliant notes that are ready for retrieval. Once triaged, move the note to the governed directory that matches its PAKE type and content purpose.

## Frontmatter Requirements
Initial create under `00-Inbox/` is allowed without PAKE standard frontmatter.

During triage (manual or agent-assisted), apply PAKE standard frontmatter for notes moved out of `00-Inbox/`, including `pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `confidence_score`, `verification_status`, `creation_method`, and `tags`.

