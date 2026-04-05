# Operator audit playbook (Phase 1)

**Audience:** Vault maintainers and operators diagnosing mutations or maintaining long-running `_meta/logs/agent-log.md` files.

**Scope:** Read and interpret append-only audit lines, correlate them with vault paths, and perform **human-run** archive or trim work. This document does not change WriteGate or MCP behavior.

**Normative references (stay aligned):**

- `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` — mutation audit, `vault_log_action`, payload rules, reviewer checklist
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — Phase 1 tool contract and checklist
- `specs/cns-vault-contract/modules/security.md` — protected paths and logging rules
- Implementation: `src/audit/audit-logger.ts`, `src/write-gate.ts`

---

## 1. Purpose

Vault IO mutators append one line per successful mutation to `_meta/logs/agent-log.md`. Operators use this file to answer: *what changed, when, which tool, and on what path?* FR23-style correlation means tying a concrete note path to matching log lines. FR24 allows **humans** to trim or archive the log file using normal filesystem operations; that path is intentionally **outside** Vault IO mutator tools so append-only guarantees for agents stay intact (NFR-S3).

---

## 2. On-disk line format

Each record is one **LF-terminated** line. Physical format (Story 5.1 / `formatAuditLine`):

```text
[ISO8601 UTC] | action | tool | surface | target_path | payload_summary
```

- **`[ISO8601 UTC]`** — Bracketed timestamp, UTC (for example `2026-04-02T14:30:00.123Z`). For `vault_log_action`, this matches the tool’s returned `logged_at` when the server sets the timestamp.
- **`action`** — Short verb describing the operation (for example `create`, `update_frontmatter`, `append_daily`, `move`, or a custom string from `vault_log_action`).
- **`tool`** — MCP tool name (for example `vault_create_note`, `vault_move`, `vault_log_action`).
- **`surface`** — Caller context (for example `mcp` for tools registered on the MCP server; `vault_move` may reflect caller-supplied surface or default `unknown`).
- **`target_path`** — Vault-relative path using `/` separators (for example `01-Projects/CNS/spec.md`, `DailyNotes/2026-04-02.md`). Empty string is allowed when a tool omits path.
- **`payload_summary`** — **Metadata only**, never full note body or full frontmatter values. Produced by `summarizePayloadForAudit` (max 120 JavaScript string units; structured input is stable-sorted JSON then truncated). Not a forensic dump of file content.

**Pipe safety:** `|`, CR, and LF inside free-text fields are replaced with spaces so a line stays parseable as six pipe-separated segments.

---

## 3. Investigation workflow (troubleshooting)

1. **Start from the note** — Identify the vault-relative path of the note you care about (Obsidian, `vault_list`, or filesystem). Normalize to forward slashes.
2. **Filter by `target_path`** — Search the log for that path. Remember the path appears in the **fifth** field (after the fourth `|`). Prefer tools that search whole lines (see §7).
3. **Narrow by time** — Use the bracketed ISO timestamp at the start of each line to bound an incident window.
4. **Validate tool and action** — Read `tool` and `action` to see whether the change matches `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`, or `vault_log_action`.
5. **Treat `payload_summary` as hints only** — It may show small JSON like `{"pake_type":"WorkflowNote","title":"..."}` or `{"updated_fields":["status"]}`. It will **not** contain full markdown bodies or secret values by design. If you need the exact post-mutation file, read the note with `vault_read` or the editor; do not expect the audit log to replace that.

---

## 4. Correlation walkthrough (FR23)

**Scenario:** You notice `01-Projects/CNS-Phase-1/acceptance-checklist.md` changed and want to see which tool did it.

1. Open or search `_meta/logs/agent-log.md` under the vault root (WSL path example: `/home/you/vault/Knowledge-Vault-ACTIVE/_meta/logs/agent-log.md`).
2. Search for the path string `01-Projects/CNS-Phase-1/acceptance-checklist.md` (or a unique suffix if paths are long).

**Example line (illustrative; same six-field layout as `formatAuditLine` / `appendRecord` in `src/audit/audit-logger.ts`):**

```text
[2026-04-02T09:15:22.456Z] | update_frontmatter | vault_update_frontmatter | mcp | 01-Projects/CNS-Phase-1/acceptance-checklist.md | {"updated_fields":["modified","status"]}
```

Operators should confirm against a line from their vault or from `tests/vault-io/audit-logger.test.ts` (`appendRecord` expectation) before relying on field positions in custom parsers.

**Interpretation:** At 09:15 UTC, `vault_update_frontmatter` ran on the MCP surface and updated frontmatter fields named `modified` and `status` only; values are not logged. A subsequent line with the same path and `tool` `vault_append_daily` would indicate a daily-note section append if that path were a daily file, and so on.

**Moves:** `vault_move` emits **one** line per successful move; `target_path` reflects the post-move path per Story 5.2. Correlate renames by time and `action`/`tool` sequence.

---

## 5. Manual archive or trim workflow (FR24)

**Phase 1 has no MCP tool** to truncate, rotate, delete, or rewrite existing lines in `agent-log.md`. Agents must not perform log maintenance through Vault IO; WriteGate treats other `_meta/logs/**` writes as `PROTECTED_PATH` (see §6). Archive and trim are **human-only** operations on the vault filesystem.

**Allowed:** A **human operator** using a shell, file manager, or editor **outside** Vault IO mutator tools may:

- Copy `agent-log.md` to a dated archive (for example `_meta/logs/archive/agent-log-2026-Q1.md`).
- Truncate or rotate the live `agent-log.md` after backup (for example keep last N lines or empty the file for a fresh start).

**Requirements:**

- Perform these steps as **normal OS file operations** on the machine that holds the vault (WSL paths are fine).
- Do **not** ask an agent to “clean up” the log via MCP write tools; mutators are not a supported path for rewriting historical audit lines.
- After rotation, new mutations continue to append via `appendRecord` as before.

This preserves NFR-S3: agents keep a single choke point (`appendRecord` + WriteGate `audit-append`) and cannot delete or overwrite audit history through supported tools.

---

## 6. Safety boundaries (human vs agent)

| Party | May append new lines via MCP | May rewrite / delete old log lines via Vault IO |
|--------|------------------------------|--------------------------------------------------|
| Agent / MCP mutators | Yes (only through `appendRecord` on `agent-log.md`) | **No** — other `_meta/logs/**` writes are `PROTECTED_PATH` |
| Human operator | N/A (humans use editors/shell) | Yes, outside MCP, for maintenance only |

WriteGate (`src/write-gate.ts`) allows **only** `purpose: "audit-append"` with operation `create` or `append` on exactly `_meta/logs/agent-log.md`. Any other write under `_meta/logs/` through the gate fails. **Do not** change code to “open up” log cleanup for tools; use human maintenance instead.

**Secrets:** Do not put API keys or tokens into `vault_log_action` `details` or any field expecting to be logged; pattern scanning and policy still apply to vault writes, and logs should never be treated as a secret store.

---

## 7. Quick command cookbook (WSL / repo conventions)

Run these from a shell with `VAULT` set to your vault root (example: `export VAULT=/home/you/path/to/Knowledge-Vault-ACTIVE`).

```bash
LOG="$VAULT/_meta/logs/agent-log.md"
```

**Show last 50 lines:**

```bash
tail -n 50 "$LOG"
```

**Filter by note path (literal substring in line):**

```bash
grep -F '01-Projects/MyProject/note.md' "$LOG"
```

**Filter by tool name (`tool` is the second `|`-delimited field after the bracketed timestamp, immediately after `action`; matching `| vault_move |` is usually enough):**

```bash
grep -F '| vault_move |' "$LOG"
```

**Filter by calendar day (ISO date prefix in timestamp):**

```bash
grep '^\[2026-04-02' "$LOG"
```

**Count lines today (rough):**

```bash
grep -c '^\[2026-04-02' "$LOG"
```

**Ripgrep** (same idea as `grep -F`; requires `rg` on PATH, e.g. `apt install ripgrep` or `brew install ripgrep` on WSL):

```bash
rg -F 'DailyNotes/2026-04-02.md' "$LOG"
```

**Pitfalls:**

- **Payload is not the note body** — If grep finds nothing “obvious,” the mutation may still be logged with a short JSON summary only.
- **Pipes in text** — User-controlled text has `|` stripped in logged fields; do not assume raw user text appears verbatim in every column.
- **Path spelling** — Must match vault-relative form; Windows-style backslashes may not appear depending on caller normalization.

---

## 8. What not to do

- **Do not** use Vault IO mutator tools to bulk-edit, truncate, or delete existing lines in `agent-log.md` (not supported; wrong tool for FR24).
- **Do not** log full note `content`, full daily append bodies, or full frontmatter value blobs through tools; implementation truncates and summarizes, and operators should not try to bypass that with oversized `details`.
- **Do not** point agents at “fixing” audit history; human archive/trim only.
- **Do not** treat `payload_summary` as complete evidence of file state; read the file when you need ground truth.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-03 | Initial operator playbook (Story 5.3). |
