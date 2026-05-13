---
pake_id: cns-vault-lint-spec-001
pake_type: WorkflowNote
title: "CNS Vault Lint Specification"
created: 2026-05-13
modified: 2026-05-13
status: active
confidence_score: 1.0
verification_status: verified
creation_method: hybrid
tags:
  - cns
  - vault-lint
  - spec
---

# CNS Vault Lint Specification

This module is the normative contract for the `/vault-lint` implementation story. It defines four deterministic report-only lint rules, severity routing, Discord output, and the on-disk report shape.

## Mode And Paths

Vault lint is report-only. Running lint must not auto-fix notes, delete files, or require mutators except for the single report write defined below.

All paths in output are vault-relative to `Knowledge-Vault-ACTIVE/`, use POSIX separators, and omit leading `./`.

## Governed Scope

Rules 1, 3, and 4 recursively scan governed notes under:

- `01-Projects/`
- `02-Areas/`
- `03-Resources/`

Excluded from governed notes:

- `00-Inbox/`
- `_meta/`
- `DailyNotes/`
- `04-Archives/`
- `AI-Context/`

A note file is a `.md` file inside governed scope. Files named `_README.md` are directory contract manifests, not PAKE knowledge notes. Exclude `_README.md` from Rules 3 and 4, and from Rule 2 orphan candidate nodes.

Frontmatter is YAML between a first-line `---` and a later closing `---`. `created` and `modified` must be valid `YYYY-MM-DD` dates for valid PAKE notes. If `created` is missing or invalid, Rule 3 must not apply stale-pending logic; Rule 4 emits the missing or invalid `created` finding instead.

## Severity Routing

| Tier | Meaning | Output |
|------|---------|--------|
| ERROR | Blocks trust for governed knowledge; resolve before the next ingest cycle. | Discord ERRORS section. |
| WARNING | Quality or linkage debt; review within 7 days. | Discord WARNINGS section. |
| INFO | Aggregate hygiene; no action required. | Discord info line and optional machine block. |

## Rule 1: Duplicate `source_uri` (ERROR)

Intent: prevent the same canonical source URL from being stored on more than one governed `SourceNote`.

Scope:

- Folders: governed scope.
- Note filter: `pake_type: SourceNote` only.
- Key: `source_uri` from YAML frontmatter.
- Legacy alias: if `source_uri` is absent and `source_url` is present, use `source_url` as the effective URI for grouping and emit a separate WARNING for deprecated `source_url`.
- If both `source_uri` and `source_url` are present, `source_uri` wins for duplicate grouping and `source_url` still emits the deprecation WARNING.

Detection:

1. Collect non-empty effective URIs after string trim.
2. Compare by exact match after trim only. URL canonicalization is not required for v1.
3. Ignore empty URIs for duplicate grouping. Implementations may count them as INFO `source_notes_without_uri`.

Finding:

- Emit one ERROR group titled `Duplicate source_uri` for each URI shared by two or more notes.
- List every note path in the group with its `created` date.
- Select the oldest duplicate by minimum valid `created` date. If tied, choose the lexicographically smallest vault-relative path.
- Emit one required resolution per group. Default:

```text
FS_DELETE_DUPLICATE_OLDEST: rm -f "<VAULT_ROOT>/<relative_path>"
```

If operator configuration forbids shell delete, emit this audited quarantine alternative:

```json
{"tool":"vault_move","arguments":{"source_path":"<oldest_relative>","destination_path":"_meta/archive/vault-lint-quarantine/<YYYYMMDD>-<basename>"}}
```

Discord line shape:

```text
* Duplicate source_uri: <uri or truncated to 120 chars>
  - <path> (created: <date>)
  - <path> (created: <date>)
  Fix: FS_DELETE_DUPLICATE_OLDEST: rm -f "<VAULT_ROOT>/<oldest_path>"
```

## Rule 2: Orphan Notes (WARNING)

Intent: surface governed notes with zero incoming wikilinks.

Orphan candidate nodes are all `.md` files under `01-Projects/`, `02-Areas/`, and `03-Resources/`, excluding `_README.md`.

Edge sources are every vault `.md` file except paths under `00-Inbox/` or `_meta/`. Links from `AI-Context/`, `DailyNotes/`, `04-Archives/`, and governed folders count.

Parse outgoing links from Markdown body only, after frontmatter:

- Wikilinks: `[[target]]`
- Aliased wikilinks: `[[target|alias]]`, using only `target`
- Embeds: `![[target]]`, counted as incoming edges to `target`

Target resolution order:

1. If target starts with `/`, strip the leading slash and resolve relative to vault root.
2. If target contains `/`, resolve as a vault-root-relative path. If the target does not end with `.md`, also try appending `.md`.
3. If target ends with `.md` and contains no `/`, first resolve relative to the edge source file's directory. If no file exists there, try vault-root-relative resolution.
4. Otherwise resolve by unique frontmatter `title` match, case-sensitive. If multiple notes share the title, do not count the link as resolved and optionally add INFO `ambiguous_wikilink`.

If incoming count is zero for a candidate node, emit WARNING `Orphan note (no incoming wikilinks)`.

Required suggested action:

```text
Review: Add `[[<Title from frontmatter title>]]` to the most relevant hub note in the same folder or parent project, preferring a `_README.md` or index note in the same directory. If none exists, create a stub index note linking this file.
```

## Rule 3: Stale Pending Verification (WARNING)

Intent: surface governed PAKE notes left in `verification_status: pending` too long.

Scope: governed folders, all PAKE knowledge note types, excluding `_README.md`.

Condition:

- `verification_status` equals `pending` after trim.
- `created` is valid `YYYY-MM-DD`.
- `today` is the UTC date at lint run start, unless 29-5 explicitly documents operator-local date.
- `days_pending` is calendar days from `created` to `today`.
- Fire only when `days_pending > 14`. Day 14 is not a warning.

Report path, `pake_type`, and `days_pending`.

Required primary suggested action:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"verification_status":"verified","modified":"<today>"}}}
```

If the note is likely obsolete, implementations may instead suggest:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"verification_status":"disputed","modified":"<today>"}}}
```

## Rule 4: Missing Required Frontmatter (ERROR Or WARNING)

Intent: ensure governed notes match the PAKE Standard from `specs/cns-vault-contract/AGENTS.md` and `specs/cns-vault-contract/CNS-Phase-1-Spec.md`.

Scope: governed folders, all `.md` files except `_README.md`.

Critical fields are ERROR if missing, empty, or wrong type:

| Field | Requirement |
|-------|-------------|
| `pake_id` | Non-empty string. Warn if present but not UUID v4. |
| `pake_type` | One of `SourceNote`, `InsightNote`, `SynthesisNote`, `WorkflowNote`, `ValidationNote`. |
| `title` | Non-empty string. |
| `created` | `YYYY-MM-DD`. |
| `modified` | `YYYY-MM-DD`. |
| `status` | One of `draft`, `in-progress`, `reviewed`, `archived`. |
| `confidence_score` | Parseable number in `[0.0, 1.0]`. |
| `verification_status` | One of `pending`, `verified`, `disputed`. |
| `creation_method` | One of `human`, `ai`, `hybrid`. |
| `tags` | YAML list with at least one entry. |

Missing critical field resolution shape:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"<field>":"<suggested_value>","modified":"<today>"}}}
```

Suggested defaults:

- `modified`: today.
- `tags`: `["lint-auto"]`, with a WARNING that the operator should replace placeholder tags.
- Missing `pake_type`: suggest `WorkflowNote` under `01-Projects/` or `02-Areas/`; suggest `SourceNote` under `03-Resources/`.

Optional fields from PAKE are `source_uri`, `cross_references`, and `ai_summary`.

Optional field warnings:

| `pake_type` | Optional WARNING |
|-------------|------------------|
| `SourceNote` | WARNING if `source_uri` is missing. |
| `InsightNote`, `SynthesisNote` | WARNING if `cross_references` is missing or empty. |
| Any | WARNING if `ai_summary` is missing. |

If `source_url` exists on any note type, emit WARNING `Deprecated frontmatter key source_url` and suggest:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"source_uri":"<copy_from_source_url>","modified":"<today>"}}}
```

If the update tool cannot remove keys, also emit: `Edit file to remove source_url after copying it to source_uri.`

## Discord Report Template

Replace placeholders only. Keep section order, headings, counts, bullet indentation, and `Fix:` or `Review:` prefixes exactly.

```markdown
Vault Lint Report: YYYY-MM-DD

ERRORS (N)
* [Rule]: [description]
  - [note path] ([date])
  Fix: [pre-formed command or action]

WARNINGS (N)
* [Rule]: [description]
  - [note path] ([type], [N] days)
  Review: [suggested action]

Scanned: [N] notes | Clean: [N] | Issues: [N]
Report saved: _meta/reports/vault-lint-YYYY-MM-DD.md
```

For ERROR rows, `[date]` is `created` or `modified` as relevant and the description must make the chosen date meaningful. For WARNING rows, always use the parenthetical form `([pake_type], [N] days)`. For non-Rule-3 warnings where day count is not applicable, use `([pake_type], n/a days)`.

Clean means notes in full lint scope with zero ERROR and zero WARNING. INFO does not affect Clean.

## On-Disk Report

Path: `_meta/reports/vault-lint-YYYY-MM-DD.md`

Write method: direct filesystem write by the skill or operator process to the canonical vault path. Do not use `vault_create_note`. Create `_meta/reports/` if missing. Overwrite the whole same-day report on rerun.

Required sections in order:

1. YAML frontmatter with full PAKE fields:

```yaml
---
title: "Vault Lint Report YYYY-MM-DD"
date: YYYY-MM-DD
tags: [vault-lint, cns, meta]
status: reviewed
source: Cursor
pake_type: WorkflowNote
pake_id: "<generated uuid for report file>"
created: YYYY-MM-DD
modified: YYYY-MM-DD
confidence_score: 1.0
verification_status: verified
creation_method: hybrid
---
```

2. `# Vault Lint Report: YYYY-MM-DD`
3. `## Summary`: same numbers as Discord info line plus counts by rule.
4. `## ERRORS`: rule name, description, vault-relative path, created date, frontmatter excerpt up to 40 lines, and the same `Fix:` command as Discord.
5. `## WARNINGS`: same structure as ERRORS, with the same `Review:` action as Discord.
6. `## INFO`: machine-readable block.
7. `## Configuration`: `VAULT_ROOT`, `today`, normalization mode, tool version or git SHA if available.

Every ERROR and WARNING row must repeat the same concrete resolution command or one-line action that appeared in Discord.

## Machine-Readable Block

At the end of the report file, include:

```json
{
  "schema": "cns.vault_lint_report.v1",
  "date": "YYYY-MM-DD",
  "counts": { "scanned": 0, "clean": 0, "errors": 0, "warnings": 0, "infos": 0 },
  "findings": [
    {
      "rule": "duplicate_source_uri|orphan_note|stale_pending|missing_frontmatter|deprecated_source_url",
      "severity": "ERROR|WARNING|INFO",
      "path": "03-Resources/example.md",
      "pake_type": "SourceNote",
      "detail": "human-readable",
      "resolution": "pre-formed command or JSON tool call as string"
    }
  ]
}
```

Sort findings by severity rank ERROR first, then rule, then path.

## Out Of Scope

- Auto-fix.
- Batch delete without operator confirmation.
- LLM-based contradiction detection.
- `04-Archives/`, `DailyNotes/`, and `00-Inbox/` findings.
- Hermes slash command wiring, which belongs to Story 29-5.
