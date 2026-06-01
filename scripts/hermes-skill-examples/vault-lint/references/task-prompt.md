# Task: `/vault-lint` full scan (read-only Vault IO + report file)

## 0) REFERENCE ONLY — invocation already confirmed

> **You have already been invoked.** The `config.yaml` trigger matched the incoming Discord message. Do not re-check or re-evaluate the Hermes skill binding.
> Proceed directly to **§1** (resolve vault root and run the scan).

For documentation purposes only (do not re-evaluate at runtime):

1. After trim, the operator line is **exactly** `/vault-lint` (no arguments, no extra text).

## 1) Vault root and abort gates

1. If **`raw`** (trimmed operator message) contains any token after `/vault-lint` (extra arguments or trailing text), reply `vault-lint: bad-trigger` and **stop** (no MCP reads, no report). This is **argument** validation only — not a Hermes binding check.
2. Resolve vault root directory `CNS_VAULT_ROOT`:

   - If environment variable `CNS_VAULT_ROOT` is set and non-empty after trim, use it.
   - Else read `~/.hermes/config.yaml` as text, parse YAML mentally, and read `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`.
   - If still unset: reply `vault-lint: no-vault-root` and **stop**.

3. Set **`today`** = current UTC calendar date `YYYY-MM-DD` at the instant you start (use for all date math and filenames).

## 2) Required `vault_search` usage (AC: tool mix)

Call **`vault_search`** at least **three** times, each with `max_results: 50`:

| Call | `scope` | `query` (literal) |
|------|-----------|-------------------|
| A | `01-Projects/` | `source_uri` |
| B | `02-Areas/` | `source_uri` |
| C | `03-Resources/` | `source_uri` |

Use results only as a **cross-check** hint; authoritative data is always from `vault_list` + `vault_read` / `vault_read_frontmatter`.

## 3) Inventory paths with `vault_list`

Use **`vault_list`** with `recursive: true` for each of:

- `01-Projects/`
- `02-Areas/`
- `03-Resources/`

From returned `entries`, collect every `vaultPath` where:

- `type` is `file`, and
- name ends with `.md`, and
- basename is **not** `_README.md`

Call this set **`GOVERNED_MD`**.

Separately, call **`vault_list`** with `path: "."` and `recursive: true`. From all `.md` files whose `vaultPath` does **not** start with `00-Inbox/` or `_meta/`, build set **`EDGE_MD`** (edge sources for wikilinks). Include `AI-Context/`, `DailyNotes/`, `04-Archives/`, and governed paths per spec.

## 4) Load frontmatter for governed notes

Batch **`vault_read_frontmatter`** using the `paths` array argument. Keep each request **≤ 40** paths. Cover every path in `GOVERNED_MD`.

If frontmatter is missing or YAML breaks, treat as Rule 4 failures per `vault-lint.md` (invalid `created` blocks Rule 3 for that file).

## 5) Rule 1 — duplicate `source_uri` (ERROR)

Scope: notes in `GOVERNED_MD` whose frontmatter `pake_type` is **`SourceNote`**.

Effective URI:

- If `source_uri` present after trim: use trimmed `source_uri` as string.
- Else if `source_url` present after trim: use trimmed `source_url` for **grouping only**, and emit a **WARNING** `deprecated_source_url` row for that note (see §8).
- Ignore empty effective URI for duplicate grouping; count optional INFO `source_notes_without_uri` in the machine JSON if you want.

Group notes by **exact** string match after trim (no URL normalization).

For each URI shared by **≥ 2** notes:

- List all member paths with `created` (or `unknown` if missing).
- **Oldest** = minimum **valid** `YYYY-MM-DD` `created`; ties broken by **lexicographically smallest** vault-relative path.
- **Fix line (default):** `FS_DELETE_DUPLICATE_OLDEST: rm -f "<CNS_VAULT_ROOT>/<oldest_relative>"` with `<CNS_VAULT_ROOT>` replaced by the **resolved absolute path** from §1 (no `$` variable left in the final Discord or report text for the default fix, so the operator can copy-paste).

Discord shape for that group (spec **Discord line shape** under Rule 1):

```text
* Duplicate source_uri: <uri or first 120 chars>…
  - <path> (created: <date>)
  - <path> (created: <date>)
  Fix: FS_DELETE_DUPLICATE_OLDEST: rm -f "<ABSOLUTE_VAULT_ROOT>/<oldest_path>"
```

If you emit the quarantine alternative instead, use the exact JSON one-liner from `vault-lint.md` with `destination_path` under `_meta/archive/vault-lint-quarantine/<YYYYMMDD>-<basename>`.

## 6) Rule 2 — orphan notes (WARNING)

**Candidates:** `GOVERNED_MD` (already excludes `_README.md`).

For every path in **`EDGE_MD`**, call **`vault_read`**, strip YAML frontmatter (first `---` through next line that is exactly `---`), then extract links from the **body** only:

- Wikilinks `\[\[([^\]|]+)(?:\|[^\]]+)?\]\]` — capture group 1 as target.
- Embeds `!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]` — capture group 1 as target.

Trim each target. Skip empty.

**Resolve** each target to zero or one vault-relative `.md` paths using this order:

1. If target starts with `/`, strip one leading `/` and treat as vault-root-relative.
2. If target contains `/`, treat as vault-root-relative; if it does not end with `.md`, also try appending `.md`.
3. If target ends with `.md` and has no `/`, try same-directory relative to the **edge source** file; if not found, try vault-root-relative.
4. Else resolve by **unique** frontmatter `title` match (**case-sensitive**) across all notes you already have frontmatter for (build a map from `title` → path when unique). If **0** or **>1** matches, the link is unresolved; if **>1**, optional INFO `ambiguous_wikilink` in JSON only.

Normalize resolved paths to POSIX vault-relative form.

Build **incoming count** per candidate path. If **0**, emit WARNING `Orphan note (no incoming wikilinks)`.

**Review line (required verbatim suggestion):**

```text
Review: Add `[[<Title from frontmatter title>]]` to the most relevant hub note in the same folder or parent project, preferring a `_README.md` or index note in the same directory. If none exists, create a stub index note linking this file.
```

In Discord WARNINGS rows, use parenthetical **`([<pake_type>], n/a days)`** for orphan rows.

## 7) Rule 3 — stale pending verification (WARNING)

For each path in `GOVERNED_MD` (excluding `_README.md` already), using frontmatter:

- If `verification_status` trimmed equals `pending` **and** `created` is valid `YYYY-MM-DD`, compute **calendar-day** distance from `created` to **`today` (UTC)**.
- Warn **only** if `days_pending > 14`.

Discord line shape (WARNINGS):

- Description should include path, `pake_type`, and day count.
- Parenthetical must be **`([<pake_type>], <N> days)`**.

**Review (primary):**

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"verification_status":"verified","modified":"<today>"}}}
```

(Optional alternate disputed — only as second line in report body if you mention obsolete content.)

## 8) Rule 4 — missing required frontmatter (ERROR / WARNING)

On each `GOVERNED_MD` path, validate critical fields per `vault-lint.md` table:

`pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `confidence_score`, `verification_status`, `creation_method`, `tags`.

- **ERROR** if missing, empty, or wrong type / out of allowed set / `tags` not a non-empty list / dates not `YYYY-MM-DD` / score not numeric in `[0.0,1.0]`.
- **WARNING** if `pake_id` present but **not** UUID v4 (regex: case-insensitive `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).

Optional field warnings per spec table (`source_uri` for SourceNote, `cross_references` for Insight/Synthesis, `ai_summary` any).

**Fix shape** for missing critical fields:

```json
{"tool":"vault_update_frontmatter","arguments":{"path":"<relative_path>","updates":{"<field>":"<suggested>","modified":"<today>"}}}
```

Suggested defaults from spec (`tags` placeholder `["lint-auto"]` with WARNING to replace, `pake_type` default by folder).

`source_url` deprecation WARNING + JSON suggestion per spec; append one line when needed: `Edit file to remove source_url after copying it to source_uri.`

Discord ERROR rows: `[date]` must be meaningful (`created` or `modified`); say which in the description.

## 9) Counts

- **`scanned`** = `|GOVERNED_MD|`.
- **`issues`** = number of findings with `severity` **ERROR** or **WARNING** in the machine JSON (after dedupe: one JSON finding per distinct rule+path+kind; duplicate URI group emits one ERROR finding per duplicate URI group with `path` set to the lexicographically first path or use one finding with `detail` listing all paths — prefer **one** finding per duplicate URI in JSON with `resolution` equal to the Fix line).
- **`clean`** = `scanned -` (distinct governed paths that appear in any ERROR or WARNING finding). Implement: count governed paths with **no** ERROR and **no** WARNING.

## 10) Discord output (exact template)

Emit **only** this structure (replace `N`, dates, lines; use `0` when empty). **No** extra text before or after.

**ERRORS section:** if zero errors, still print `ERRORS (0)` and then a blank line or go straight to WARNINGS — use exactly:

```markdown
Vault Lint Report: <today>

ERRORS (N)
<zero or more ERROR blocks — each ERROR block starts with * and uses Fix: line>

WARNINGS (N)
<zero or more WARNING blocks — each uses Review: line; parenthetical ([pake_type], N days or n/a days)>

Scanned: <scanned> notes | Clean: <clean> | Issues: <issues>
Report saved: _meta/reports/vault-lint-<today>.md
```

When `N` is `0` for a section, print the heading `ERRORS (0)` then **no** `*` lines under it (not even a placeholder).

**Rule 1** groups use the multi-line `*` shape from §5 (not the single-line generic).

## 11) On-disk report `{CNS_VAULT_ROOT}/_meta/reports/vault-lint-<today>.md`

1. Ensure directory exists: `{CNS_VAULT_ROOT}/_meta/reports/` (shell `mkdir -p` allowed; it is not a note mutation).
2. Write file with LF endings. **Overwrite** if it already exists for the same `<today>`.

Section order:

1. YAML frontmatter per spec (`pake_id` new UUID v4; `title` `Vault Lint Report <today>`; `tags: [vault-lint, cns, meta]`; `status: reviewed`; `source: Cursor`; `pake_type: WorkflowNote`; dates = `<today>`; scores and verification as spec example).
2. `# Vault Lint Report: <today>`
3. `## Summary` — repeat Scanned / Clean / Issues plus per-rule counts.
4. `## ERRORS` — for each issue: rule name, description, path, date, frontmatter excerpt up to **40** lines from `vault_read` if needed, same `Fix:` as Discord.
5. `## WARNINGS` — same, with `Review:`.
6. `## INFO` — machine-readable JSON block (same schema as §12, pretty-printed).
7. `## Configuration` — absolute `CNS_VAULT_ROOT`, `today`, normalization note (`exact trim, no URL canonicalization v1`), and optional `git rev-parse --short HEAD` from `OMNIPOTENT_REPO` if that env is set and directory exists; else `tool_version: vault-lint-skill-1.0.0`.

Put the **single** machine JSON (§12) inside `## INFO` as a fenced ```json code block. Section **7** is prose only (no second JSON copy).

## 12) Findings JSON (sort order)

Sort findings: **ERROR** before **WARNING** before **INFO**; then `rule` name; then `path`.

Allowed `rule` strings: `duplicate_source_uri`, `orphan_note`, `stale_pending`, `missing_frontmatter`, `deprecated_source_url`. Use `missing_frontmatter` for optional-field warnings if you need a bucket, or add `detail` to clarify.

```json
{
  "schema": "cns.vault_lint_report.v1",
  "date": "<today>",
  "counts": { "scanned": 0, "clean": 0, "errors": 0, "warnings": 0, "infos": 0 },
  "findings": []
}
```

Set `counts.errors` / `counts.warnings` / `counts.infos` to match the `findings` array severities.

## 13) Execution notes

- Batch `vault_read` for Rule 2 in groups (sequential or parallel tool calls) to stay within turn limits; if you cannot finish, reply `vault-lint: incomplete` and **do not** claim full scan (operator should retry with smaller vault or session split — avoid this by working in batches across turns if Hermes allows).
- Never call mutator MCP tools.
- After Discord reply and report write, **stop**.
