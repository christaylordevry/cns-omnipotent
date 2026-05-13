# Story 29.4: Vault lint rules spec and output format

Status: done

<!-- Spec-only story: deliverable is this document. No code, Hermes skill edits, or vault writes in 29-4. Story 29-5 implements against the normative sections below. -->

## Story

As an operator,
I want a normative specification for four deterministic vault lint rules, severities, scopes, and report formats (Discord plus on-disk report),
so that `/vault-lint` (29-5) and future tooling stay consistent, report-only, and unambiguous.

## Epic alignment and overrides

**Source:** `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md` (Story 29-4 card).

**Overrides relative to the epic card (this story is authoritative for 29-5):**

| Topic | Epic card | This story (29-4) |
|-------|-----------|-------------------|
| Stale pending threshold | “>30 days” | **14 days** (calendar days, see Rule 3). |
| On-disk report path | `_meta/logs/vault-lint-YYYY-MM-DD.md` | **`_meta/reports/vault-lint-YYYY-MM-DD.md`** (create `_meta/reports/` if missing; same operator-FS write pattern as `MEMORY.md` in 29-2, not `vault_create_note`). |
| Duplicate URL field name | (implied `source_uri`) | Scan **`source_uri`** (PAKE canonical). Treat legacy key **`source_url`** as an alias: if present without `source_uri`, treat its value as `source_uri` for Rule 1 only; if both exist, **`source_uri` wins** for duplicate grouping and emit a **WARNING** finding on the note: “Deprecated key `source_url`; migrate to `source_uri`” with suggested `vault_update_frontmatter` removing `source_url`. |

## Acceptance criteria (story-level)

1. Normative sections below define **all four rules** with detection logic, severity, scope boundaries, suggested resolution shape, and tie-breaks where needed.
2. **Required PAKE frontmatter** per `pake_type` is extracted from **`specs/cns-vault-contract/`** (see Rule 4 and appendix) and listed explicitly.
3. **Discord** message body follows the **exact template** in this file (verbatim structure; replace placeholders only).
4. **`_meta/reports/vault-lint-YYYY-MM-DD.md`** format is defined verbatim (sections and ordering).
5. **Staleness** for Rule 3 is **14 days**, not 30.
6. **Every ERROR and every WARNING** includes either a **pre-formed shell or MCP-shaped command** (copy-paste or tool JSON) **or** a single-line **suggested action** that names concrete parameters (no “fix the note” without a verb and target).
7. The spec is **complete enough that 29-5** can implement it **without ambiguity** (scopes, exclusions, sorting, report paths, and severity routing).

---

# Normative specification: Vault Lint (Option A)

**Mode:** Report-only. No auto-fix, no required mutators for lint execution.  
**Paths in output:** Always **vault-relative** (relative to vault root `Knowledge-Vault-ACTIVE/`), POSIX separators, no leading `./`.

## 1. Governed scope (global definitions)

### 1.1 Governed folders (Rules 1, 3, 4)

Recursive scan under:

- `01-Projects/`
- `02-Areas/`
- `03-Resources/`

**Excluded from “governed notes” for these rules:**

- Any path starting with `00-Inbox/`
- Any path starting with `_meta/`
- **`DailyNotes/`** (constitution defines a dedicated daily format; out of scope for these four rules)
- **`04-Archives/`** (optional future epic; **out of scope** for v1 of this spec)
- **`AI-Context/`** (constitution and modules; not PAKE knowledge notes for this lint)

### 1.2 “Note file” definition

A **note file** is a file ending in `.md` that is not excluded above.

**Manifest / contract files:** Any file named `_README.md` is a **directory contract manifest**, not a PAKE knowledge note. **Exclude** `_README.md` from Rules 3 and 4 (and from wikilink graph nodes for Rule 2 if they appear under scope). Do not emit findings for `_README.md` missing PAKE fields.

### 1.3 Parsing

- **Frontmatter:** YAML between first line `---` and closing `---` on a later line.
- **`pake_type`:** Read from frontmatter. If missing or not a known PAKE knowledge type, Rule 4 still fires; Rules 1 and 3 use `pake_type` only where stated.
- **Dates:** `created` and `modified` are **required** to be `YYYY-MM-DD` for valid PAKE notes. For Rule 3, if `created` is missing or unparsable, **do not** apply stale-pending logic; instead emit one **Rule 4 ERROR** for missing/invalid `created` (critical field).

## 2. Severity tiers (routing)

| Tier | Meaning | Operator SLA (guidance for copy) |
|------|---------|-----------------------------------|
| **ERROR** | Blocks trust for governed knowledge; must be resolved before the **next ingest cycle** (Hermes URL ingest, pipeline promote, or bulk capture). | Discord section **ERRORS**. |
| **WARNING** | Quality or linkage debt; **review within 7 days**. | Discord section **WARNINGS**. |
| **INFO** | Aggregate hygiene; **no action required**. | Discord **ℹ️** line only; optional duplicate counts in machine block. |

## 3. Rule 1: Duplicate `source_uri` (ERROR)

### 3.1 Intent

Prevent the same canonical source URL from being stored on **more than one** governed **SourceNote**.

### 3.2 Scope

- **Folders:** Governed folders (§1.1).
- **Note filter:** `pake_type: SourceNote` only.
- **Key:** `source_uri` string from frontmatter after YAML parsing. If `source_uri` absent and `source_url` present, use `source_url` value as the effective URI for grouping (and emit a separate **WARNING** finding if `source_url` is present: deprecated key; migrate to `source_uri` per the epic alignment table in this story header).

### 3.3 Duplicate detection

1. Collect all effective URIs (non-empty strings after trim).
2. **Normalization (v1):** Compare strings with **exact match** after trim only. **URL canonicalization** (trailing slash, scheme, host case) is **not** required in v1; Story **29-6** may later require a shared normalizer: if 29-5 implements after 29-6 lands, **SHOULD** call the same normalization as `src/ingest/duplicate.ts` before grouping (document which behavior shipped in 29-5 Dev Agent Record).
3. **Empty URI:** Ignore (no duplicate group); optionally count in INFO as `source_notes_without_uri`.

### 3.4 Findings

For each URI value shared by **two or more** notes:

- Emit **one ERROR group** titled: `Duplicate source_uri`.
- List **every** note path in the group with `created` date (from frontmatter).
- **Oldest duplicate:** the note with **minimum `created` date** (ISO `YYYY-MM-DD` string compare). If **tie**, choose lexicographically smallest **vault-relative path** as the oldest.
- **Suggested resolution (required):** Pre-formed **operator filesystem delete** of the oldest duplicate only (Phase 1 has **no** `vault_delete` MCP tool per `specs/cns-vault-contract/CNS-Phase-1-Spec.md` security section). Use this **exact pattern**:

```text
FS_DELETE_DUPLICATE_OLDEST: rm -f "<VAULT_ROOT>/<relative_path>"
```

Where `<VAULT_ROOT>` is the configured absolute vault root (e.g. `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` on WSL) and `<relative_path>` is the vault-relative path to the **oldest** note in the duplicate set.

**Alternative (audited, no delete):** If the operator forbids `rm`, use a pre-formed **`vault_move`** quarantine (same spec file `CNS-Phase-1-Spec.md`):

```json
{"tool":"vault_move","arguments":{"source_path":"<oldest_relative>","destination_path":"_meta/archive/vault-lint-quarantine/<YYYYMMDD>-<basename>"}}
```

29-5 **must** emit **one** of the two forms above per duplicate group (default **FS_DELETE** unless operator config in 29-5 says otherwise).

### 3.5 Discord line shape (per finding)

Under ERRORS, one bullet per duplicate URI (truncate display URI to 120 chars with `…` if longer):

```text
• Duplicate source_uri: <uri or truncated>
  - <path> (created: <date>)
  - <path> (created: <date>)
  → Fix: FS_DELETE_DUPLICATE_OLDEST: rm -f "<VAULT_ROOT>/<oldest_path>"
```

## 4. Rule 2: Orphan notes (WARNING)

### 4.1 Intent

Surface governed notes that nothing links to, so the knowledge graph stays navigable.

### 4.2 Scope

- **Folders only:** `01-Projects/`, `02-Areas/`, `03-Resources/` (same as §1.1).
- **Continue to exclude:** `_README.md`, `00-Inbox/`, `_meta/`.

### 4.3 Wikilink graph

- **Orphan candidate nodes:** All `.md` note files under `01-Projects/`, `02-Areas/`, `03-Resources/` only (excluding `_README.md`). These are the only files that may receive an orphan **WARNING**.

- **Edge sources (where outgoing links are scanned):** Every vault `.md` file **except** paths under `00-Inbox/` or `_meta/` (so links from `AI-Context/`, `DailyNotes/`, `04-Archives/`, governed folders, etc. **do** count). Rationale: an orphan should not trigger if a hub note in `AI-Context` already wikilinks the candidate.

- **Edges (outgoing):** From each edge source file’s **Markdown body** (after frontmatter closing `---`) parse:
  - Wikilinks: `[[...]]` (including `[[path|alias]]`; use **link target** before `|` for resolution).
  - Embeds: `![[...]]` count as **one incoming edge** to the embedded target the same as `[[...]]`.

- **Target resolution:** Map wikilink target to a vault file by this order:
  1. If target starts with `/`, strip the leading slash and resolve relative to vault root.
  2. If target contains `/`, resolve as a vault-root-relative path. If the target does not end with `.md`, also try appending `.md`.
  3. If target ends with `.md` and contains no `/`, first resolve relative to the edge source file's directory. If no file exists there, try vault-root-relative resolution.
  4. Else treat as **title** match: resolve to the unique note whose `title` frontmatter equals the target string (case-sensitive). If ambiguous (multiple matches), **do not** count as resolved edge; emit **no orphan false negative** for that link; optionally log INFO `ambiguous_wikilink` in machine section (not a Discord ERROR unless you add a future rule).

**Incoming count:** For each orphan candidate N, count edges from **any** allowed edge source file whose resolved target path equals N’s path.

### 4.4 Finding

If **incoming count == 0**, the note is an **orphan** → **WARNING**: `Orphan note (no incoming wikilinks)`.

### 4.5 Suggested resolution (required)

Emit a **one-line suggested action** (cannot be fully automated without semantic choice):

```text
Review: Add `[[<Title from frontmatter title>]]` to the most relevant hub note in the same folder or parent project (prefer a `_README.md` or index note in the same directory); if none exists, create a stub index note linking this file.
```

Optional **helper** (not required for 29-5): suggest **candidate path** = longest shared prefix directory’s `_README.md` if that file exists: “Prefer adding link in `<path/to/_README.md>` section ## Related”.

## 5. Rule 3: Stale pending verification (WARNING)

### 5.1 Intent

Surface governed notes left in `verification_status: pending` too long.

### 5.2 Scope

Governed folders (§1.1), all PAKE knowledge note files (all `pake_type` values in PAKE standard), excluding `_README.md`.

### 5.3 Condition

- `verification_status` equals `pending` (YAML string, trim).
- `created` is a valid `YYYY-MM-DD`.
- **Age:** Let `today` be the UTC date at lint run start (or operator-local `YYYY-MM-DD` documented in 29-5). **Days pending** = `today - created` in **calendar days**.
- Fire when **days pending > 14** (strictly greater than fourteen; day 14 inclusive from `created` is **not** yet a warning).

### 5.4 Finding fields

Report: vault-relative **path**, **pake_type**, **days pending**.

### 5.5 Suggested resolution (required)

Pre-formed frontmatter update:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"verification_status":"verified","modified":"<today>"}}}
```

If the operator likely should delete instead:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"verification_status":"disputed","modified":"<today>"}}}
```

Emit **one** primary suggestion: prefer **`verified`** if the note is still accurate; add second line “If obsolete: delete via `FS_DELETE_DUPLICATE_OLDEST` pattern with path” only when `status: archived` or title contains “deprecated” (optional heuristic; if not implemented, always emit only the `verified` JSON).

## 6. Rule 4: Missing required frontmatter (ERROR vs WARNING)

### 6.1 Intent

Ensure governed notes match **PAKE Standard** from constitution and Phase 1 spec.

**Normative sources:**

- `specs/cns-vault-contract/AGENTS.md`: Section 3 “Frontmatter Template (PAKE Standard)” and optional fields block.
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md`: Section “Frontmatter Schema (PAKE Standard)” and optional list.

### 6.2 Scope

Governed folders (§1.1), all `.md` except `_README.md`.

### 6.3 Critical fields (ERROR if missing, empty, or wrong type)

These keys **must** exist and be non-empty (where “non-empty” applies):

| Field | Requirement |
|-------|-------------|
| `pake_id` | Non-empty string; SHOULD be UUID v4 (lint **WARNING** only if format not UUID, do not downgrade missing `pake_id` from ERROR). |
| `pake_type` | Must be one of: `SourceNote`, `InsightNote`, `SynthesisNote`, `WorkflowNote`, `ValidationNote`. |
| `title` | Non-empty string. |
| `created` | `YYYY-MM-DD`. |
| `modified` | `YYYY-MM-DD`. |
| `status` | One of: `draft`, `in-progress`, `reviewed`, `archived`. |
| `confidence_score` | Parseable number in `[0.0, 1.0]`. |
| `verification_status` | One of: `pending`, `verified`, `disputed`. |
| `creation_method` | One of: `human`, `ai`, `hybrid`. |
| `tags` | YAML list with **at least one** entry (non-empty list). |

**Missing critical field:** one ERROR per `(path, field)` with:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"<field>":"<suggested_value>","modified":"<today>"}}}
```

**Suggested values when obvious:**

- `modified`: today’s date.
- `tags`: if completely missing list, suggest `["lint-auto"]` and WARNING to operator to replace with real tags (emit **WARNING** follow-up “tags are placeholder”; optional for 29-5).

If **`pake_type` missing**, suggest default **`WorkflowNote`** only when path under `01-Projects/` or `02-Areas/`; suggest **`SourceNote`** only when under `03-Resources/`; otherwise suggest **`InsightNote`** with **WARNING** that human must confirm (one-line suggested action).

### 6.4 Optional fields (WARNING if “recommended” missing)

From the same spec sources, optional keys are: `source_uri`, `cross_references`, `ai_summary`.

| `pake_type` | Optional WARNING |
|-------------|------------------|
| `SourceNote` | **WARNING** if `source_uri` missing (provenance gap; ingest notes almost always need URI). |
| `InsightNote`, `SynthesisNote` | **WARNING** if `cross_references` missing or empty list (cross-note graph). |
| Any | **WARNING** if `ai_summary` missing (informational only; low priority). |

**Suggested resolution:** same `vault_update_frontmatter` JSON pattern with operator-filled values; for `source_uri` cannot invent URL: use one-line action “Paste canonical URL into `source_uri`” plus empty JSON template with `"source_uri": "<operator fills>"` literal in the report.

### 6.5 `source_url` deprecation

If `source_url` key exists (any type): **WARNING** `Deprecated frontmatter key source_url`; suggest:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"source_uri":"<copy_from_source_url>","modified":"<today>"}}}
```

and manual removal of `source_url` key (or a follow-up edit), because `vault_update_frontmatter` may not delete keys: if implementation cannot delete, say **“Edit file to remove `source_url` line after copying.”**

---

## 7. Discord report format (exact template)

**Placeholder rules:** Replace `YYYY-MM-DD`, `N`, and bracketed segments; keep headings, emoji, bullets, and arrow prefixes **exactly** as below.

```markdown
🔍 Vault Lint Report: YYYY-MM-DD

❌ ERRORS (N)
• [Rule]: [description]
  - [note path] ([date])
  → Fix: [pre-formed command or action]

⚠️ WARNINGS (N)
• [Rule]: [description]
  - [note path] ([type], [N] days)
  → Review: [suggested action]

ℹ️ Scanned: [N] notes | Clean: [N] | Issues: [N]
Report saved: _meta/reports/vault-lint-YYYY-MM-DD.md
```

**Field binding for template lines:**

- For **ERRORS**, `[date]` is `created` or `modified` as relevant (state which in description if needed).
- For **WARNINGS**, always use the `([pake_type], [N] days)` parenthetical. For non-Rule-3 warnings where day count is not applicable, use `([pake_type], n/a days)`.

**“Clean” definition:** notes in full lint scope with **zero** ERROR and **zero** WARNING (INFO does not affect Clean).

## 8. On-disk report: `_meta/reports/vault-lint-YYYY-MM-DD.md`

**Write method:** Direct filesystem write by the skill or operator process to the **canonical vault path** (same class as `MEMORY.md` in Story 29-2: **not** `vault_create_note`). Append or overwrite policy: **overwrite** whole file each run for that date (idempotent re-run same day).

### 8.1 Required sections (top to bottom)

1. **YAML frontmatter** (Obsidian-friendly, machine-parsable):

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

(Report file is a **WorkflowNote-shaped** meta artifact; if that is undesirable, 29-5 may use manifest-style keys only after operator approval; default is **full PAKE** so the file itself passes Rule 4 if scanned.)

2. **`# Vault Lint Report: YYYY-MM-DD`**

3. **`## Summary`**: Same numbers as Discord ℹ️ line plus counts by rule.

4. **`## ERRORS`**: For each finding: **Rule name**, **description**, **vault-relative path**, **created**, **frontmatter excerpt** (YAML snippet up to 40 lines), **pre-formed Fix** (same as Discord).

5. **`## WARNINGS`**: Same structure as ERRORS with **Review** line.

6. **`## INFO`**: Machine-readable block (see §9) duplicated or extended.

7. **`## Configuration`**: `VAULT_ROOT` used, `today` date, normalization mode (`exact` vs `ingest-aligned`), tool version or git SHA if available.

### 8.2 Flow state requirement

Every ERROR and WARNING row in §8 **must** repeat the **same** pre-formed resolution command or one-liner as Discord (no summary-only shrink that drops the fix).

---

## 9. Machine-readable block (INFO / appendix)

At end of `_meta/reports/` file (and optionally appended in Discord as collapsible code block if length allows), include a fenced JSON object:

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

**Ordering:** `findings` sorted by `(severity rank ERROR first, rule, path)`.

---

## 10. Out of scope (explicit)

- Auto-fix, batch delete without operator confirmation, LLM-based contradiction detection.
- `04-Archives/`, `DailyNotes/`, `00-Inbox/` for v1 rules above.
- Defining Hermes slash command wiring (29-5).

---

## Tasks / Subtasks (29-4)

- [x] Produce this normative spec in `_bmad-output/implementation-artifacts/29-4-vault-lint-rules-spec-and-output-format.md` (AC: all story acceptance criteria).
- [x] Confirm no in-repo code, skill, or vault mutations are in scope for 29-4; `/vault-lint` implementation is **Story 29-5** only.

**Note:** Do not add “implement 29-5” as a checkbox under 29-4; track that work in `29-5-vault-lint-hermes-skill-and-vault-log-write.md` when that story is `ready-for-dev`.

## Dev Notes

### Constitution and PAKE references

- Vault map and PAKE template: `specs/cns-vault-contract/AGENTS.md` §2–3.
- Frontmatter schema duplicate: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (Frontmatter Schema, `vault_move`, no delete in Phase 1).
- Ingest alignment for `source_uri`: `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md` (wiki-ingest mapping).

### Cross-story

- **29-2:** Report file write is **operator FS**, same discipline as `MEMORY.md` overwrite.
- **29-6:** URL normalization for duplicates; until merged, Rule 1 uses exact string match after trim.

### Operator guide (29-4)

- No user-facing behavior ships in 29-4. **Operator guide:** no update required for 29-4.

## Change Log

| Date | Change |
|------|--------|
| 2026-05-13 | `bmad-dev-story`: closed spec-only delivery; clarified tasks vs 29-5; status → review. |
| 2026-05-13 | `code-review`: accepted spec-only delivery; status → done. |
| 2026-05-13 | `code-review`: added normative spec module and tightened 29-5 ambiguity. |

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed: normative lint spec, templates, and PAKE field matrix embedded for 29-5.
- **Dev story (2026-05-13):** Re-ran acceptance criteria against §§1–10; spec-only story requires **no** new tests or `src/` changes. Sprint task list corrected so 29-5 work is not a 29-4 subtask. `bash scripts/verify.sh` run for regression gate.
- **Code review (2026-05-13):** Added `specs/cns-vault-contract/modules/vault-lint.md`, fixed deterministic Discord warning parenthetical, and clarified same-folder `.md` wikilink resolution for Rule 2.

### File List

- `specs/cns-vault-contract/modules/vault-lint.md` (normative spec module)
- `_bmad-output/implementation-artifacts/29-4-vault-lint-rules-spec-and-output-format.md` (story record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (29-4 status)

---

## Appendix A: PAKE required / optional matrix (extracted from specs)

**Source:** `specs/cns-vault-contract/AGENTS.md` (Section 3, Frontmatter Template and optional fields); aligned with `specs/cns-vault-contract/CNS-Phase-1-Spec.md` “Frontmatter Schema (PAKE Standard)”.

### A.1 Required on all PAKE knowledge types

`pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `confidence_score`, `verification_status`, `creation_method`, `tags` (non-empty list).

### A.2 Optional (all types)

`source_uri`, `cross_references`, `ai_summary`.

### A.3 Lint-only extensions

- `source_url`: **not** in spec; treat as deprecated alias (Rule 1 / Rule 4 overlap).

---

## Appendix B: Open questions saved for 29-5 (non-blocking)

1. Whether Discord posts the full JSON block or only a pointer line (spec allows either; default **pointer only** if `findings.length > 20`).
2. Whether `ambiguous_wikilink` INFO is implemented in v1.

---

## Story completion status

**Status:** done  
**Note:** 29-4 is **spec-only**; implementation is **29-5**. The normative module now lives at `specs/cns-vault-contract/modules/vault-lint.md`.
