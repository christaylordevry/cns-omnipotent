# NotebookLM fan-out diagnostics (Phase C)

Normative contract for `/session-close` Phase C **legacy** `source_add` fan-out. When `NOTEBOOKLM_DRIVE_DOC_ID` and Google OAuth are configured, use `drive-export-sync.md` instead (no `source_add`).

Merge results into `.session-close/close-report.json` without re-deriving targets from the vault.

## Flow

1. Read `notebooklm_targets[]` from `close-report.json` only (Phase A output).
2. For each row, call `mcp__notebooklm__source_add` with:
   - `notebook_id` from the row
   - `title: "My Knowledge Base"`
   - `source_type: "file"`
   - `file_path` from row `export_path`
   - `wait: false`
3. After **each** call, run the merge helper (do not fire-and-forget).
4. On tool error, pass **error message + stderr** concatenated into `--stderr`.
5. Do **not** retry on failure or on `ready: false` success.

Dry-run: skip `source_add` and do **not** write fan-out result fields.

## Merge CLI

Single target:

```bash
"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-merge-notebooklm-fanout.sh" \
  --notebook-id "<uuid>" \
  --status ok|failed \
  --stderr "<combined message + stderr for classifier>"
```

Batch (optional, fewer terminal round-trips):

```bash
echo '[{"notebook_id":"...","status":"failed","stderr":"..."}]' | \
  "${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-merge-notebooklm-fanout.sh" --batch
```

Report path override: `--report /path/to/close-report.json` (default: `$OMNIPOTENT_REPO/.session-close/close-report.json`).

Non-blocking: unreadable or missing report → exit **0**, stderr warning; session-close continues.

## Per-notebook row fields (after merge)

| Field | Success (`fanout_status: ok`) | Failure (`fanout_status: failed`) |
|-------|-------------------------------|-----------------------------------|
| `fanout_status` | `ok` | `failed` |
| `error_class` | omitted | `size_limit`, `auth_error`, `duplicate_source`, `api_error`, or `unknown` |
| `export_bytes` | number when known | same |
| `error_snippet` | omitted | sanitized text, ≤ 160 chars |
| `http_status` | omitted or `null` | integer when parseable |

Rows merge **in place** on `notebook_id` (no duplicates). Never write export file bodies, cookies, tokens, or full MCP JSON to the report.

`export_bytes` comes from `deterministic.export_bytes` when present, else `stat(export_path).size`.

## stderr → error_class (first match)

| Class | Match hints (case-insensitive) |
|-------|--------------------------------|
| `size_limit` | `too large`, `size limit`, `file too big`, `exceeds`, `payload too large`, `413`, `request entity too large` |
| `auth_error` | `unauthenticated`, `not authenticated`, `login required`, `session expired`, `401`, `403`, `forbidden`, `unauthorized` |
| `duplicate_source` | `duplicate`, `already exists`, `already added` |
| `api_error` | `HTTP 5xx`, `502`, `503`, `504`, `internal server`, `service unavailable` |
| `unknown` | default (e.g. bare `Could not add file source.`) |
| `drive_write_error` | Drive Doc overwrite failed (drive-sync path only; set via merge `--error-class` or sync script) |

## HTTP status parsing

`parseHttpStatus` extracts codes from patterns such as `HTTP 413`, `status code: 403`.

## Discord (see discord-reply-template.md)

- Success: `Title (short-id): ok`
- Failure: `Title (short-id): failed — error_class: <class>` (optional compact `export_bytes`, `http_status`)
- Aggregate `**notebooklm:**` line: e.g. `2 ok, 1 failed (size_limit)`
- Never paste raw stderr into Discord.
