# Story 5.2: Mutations and `vault_log_action`

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide for Epic 5 Story 5.2. -->

## Story

As an **operator**,  
I want **every authorized write, update, and move to emit an audit record**,  
so that **I can reconstruct what happened**.

## Acceptance Criteria

1. **Given** Phase 1 mutating tools: `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`  
   **When** a mutation completes successfully (note file created/updated/moved as specified in each tool’s contract)  
   **Then** `AuditLogger.appendRecord` runs **after** the successful atomic write/rename/move and **before** the tool returns its success payload  
   **And** audit append failures propagate as **`IO_ERROR`** (or `PROTECTED_PATH` / `VAULT_BOUNDARY` if misconfigured), never swallowed (align with Story 5.1 / Epic 4 “no silent failures”).

2. **Line format and safety** match Story 5.1 / architecture §8: six pipe-separated fields, LF-terminated; **`surface`** follows `vault_move` (caller-supplied, default `unknown`); **`payload_summary`** via `summarizePayloadForAudit` only — **never** log full note `content`, full daily append `content`, or full merged frontmatter bodies (NFR-S3).

3. **Suggested payload shapes** (truncate via existing summarizer; keep objects small and metadata-only):
   - **`vault_create_note`:** `action` e.g. `create`; `tool` `vault_create_note`; `targetPath` = vault-relative created path; `payloadInput` e.g. `{ pake_type, title }` (title already slug-limited by create flow; do not pass `content`).
   - **`vault_update_frontmatter`:** `action` e.g. `update_frontmatter`; `tool` `vault_update_frontmatter`; `targetPath` = note path; `payloadInput` e.g. `{ updated_fields: string[] }` (keys only, not values).
   - **`vault_append_daily`:** `action` e.g. `append_daily`; `tool` `vault_append_daily`; `targetPath` = daily note path (`DailyNotes/YYYY-MM-DD.md`); `payloadInput` e.g. `{ section?: string }` only (omit raw appended markdown).
   - **`vault_move`:** already wired in Story 5.1; **do not** add a second audit line per move.

4. **`vault_append_daily` race (EEXIST retry):** If the create branch delegates to `appendToExistingDaily` after `EEXIST`, exactly **one** audit line must be written for that successful user operation (the inner path that completes the append).

5. **`vault_log_action` MCP tool** (FR22, `CNS-Phase-1-Spec.md` §5): Register on the MCP server with Zod-validated input:
   - **Input:** `action` (string, required), `tool_used` (string, required), `target_path` (string, optional), `details` (string, optional) per spec.
   - **Behavior:** Append one line via **`appendRecord`** (same six-field file format as other tools). Map `tool_used` → logger `tool`; `target_path` → `targetPath` (use empty string when omitted); `details` → `payloadInput` (string passes through summarizer). **`surface`** for this tool: `mcp` when invoked from `register-vault-io-tools` (consistent with other tools).
   - **Output:** `{ logged_at: string }` with ISO-8601 timestamp (UTC) of the log event (match style of other write tools’ timestamps).
   - **Normative format note:** Phase 1 spec shows a five-field example; **implementation uses architecture §8 / Story 5.1 six fields** (`surface` + `payload_summary`). No second on-disk format.

6. **Registration:** Add `vault_log_action` in `src/register-vault-io-tools.ts` and return its handle from `registerVaultIoTools` for parity with tests that destructure registered tools.

7. **Tests:** Extend or add Vitest coverage under `tests/vault-io/` so that successful runs of create / update frontmatter / append daily / `vault_log_action` each assert a new line in `_meta/logs/agent-log.md` with expected `tool` segment and **no** raw secret or full body content in the log. Respect existing fake-timer patterns in `vault_append_daily` tests if present. Run `bash scripts/verify.sh` before marking done.

## Reviewer checklist (explicit — Phase 1 audit guarantee)

**Bind this file as normative spec** for mutation logging and `vault_log_action` (alongside `CNS-Phase-1-Spec.md` §5–§7 and architecture §8). Do not treat audit behaviour as “implementation detail only”; regressions here break the Phase 1 “all writes logged” and NFR-S3 guarantees.

1. **`vault_append_daily` EEXIST path — exactly one audit line per successful user operation**  
   Trace `src/tools/vault-append-daily.ts` by hand:
   - If **`link(tmp, canonicalTarget)` succeeds** (exclusive create completes), **`appendRecord` runs once** in `appendCreateDailyThenMaybeRetryExisting` after `unlink(tmp)`; **`appendToExistingDaily` is not invoked** → one line.
   - If **`link` fails with `EEXIST`**, execution **returns** into **`appendToExistingDaily`**, which performs the append and **`appendRecord` runs once** there. The create branch **must not** call `appendRecord` after that return (no second line).  
   **Failure mode to catch:** any `appendRecord` on the create path that still runs after delegating to `appendToExistingDaily` would **double-log** daily creates under race and corrupt the audit trail.

2. **Payload minimisation — tests vs log format**  
   Confirm `tests/vault-io/mutations-audit.test.ts` uses **credential- or secret-shaped** placeholder strings that still pass the vault secret scanner (so the mutation succeeds), not only obviously fake words like “decoy”.  
   Confirm assertions use the **full raw UTF-8** of `_meta/logs/agent-log.md` (e.g. one `readFile` string), **`not` only `JSON.parse` of a substring**: a formatting bug could leak body or values into pipe-separated **prefix** fields (`action`, `tool`, `surface`, `target_path`) outside the summarised payload column. **`not.toContain(sensitive)` on the entire file** catches that class of leak.

3. **`appendRecord` optional `isoUtc`**  
   Confirm **production mutation tools** (`vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`) **never pass `isoUtc`**; only **`vault_log_action`** (or tests) may set it so **`logged_at` matches the bracket timestamp**. If a mutator passed `isoUtc` from user-controlled input, audit timestamps would become **client-controlled**.

4. **`vault_log_action` (eighth tool) and WriteGate**  
   Confirm **`vault_log_action` only appends via `appendRecord`** in `src/audit/audit-logger.ts`, which calls **`assertWriteAllowed(..., { purpose: "audit-append", operation: "append" })`** on `_meta/logs/agent-log.md`. There must be **no alternate write path** to `agent-log.md` that bypasses Epic 4 append-only / WriteGate rules.

## Tasks / Subtasks

- [x] Add optional **`surface`** (and any minimal options bag) to `vaultCreateNote` / `vaultCreateNoteFromMarkdown`, `vaultUpdateFrontmatter`, and `vaultAppendDaily` — mirror `VaultMoveOptions` / `vault_move` call pattern from `register-vault-io-tools.ts` (`surface: "mcp"`).
- [x] After successful mutation in `src/tools/vault-create-note.ts`, `vault-update-frontmatter.ts`, `vault-append-daily.ts`, call `appendRecord` with AC3-compliant metadata (remove “deferred to Epic 5.2” comments).
- [x] Implement `src/tools/vault-log-action.ts` (or equivalent single module) + Zod schema; wire MCP handler in `register-vault-io-tools.ts`.
- [x] Tests per AC7; `bash scripts/verify.sh` green.

## Dev Notes

### Architecture compliance

- **Audit:** `_bmad-output/planning-artifacts/architecture.md` §8, implementation sequence step 7 (“Wire `vault_log_action` and ensure every mutator calls it”). Implementation may call **`appendRecord` directly** from mutators; that satisfies the spec intent (“every write logged”) without an MCP self-call loop.
- **Anti-pattern:** Raw append to `agent-log.md` outside `audit-logger.ts` / `appendRecord`.

### Spec cross-check

- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §5 **`vault_log_action`** and checklist §7 (“All write operations produce entries in `_meta/logs/agent-log.md`”).
- `specs/cns-vault-contract/modules/security.md` — all modifications logged.

### Project structure notes

- **Existing module:** `src/audit/audit-logger.ts` — `appendRecord`, `summarizePayloadForAudit`, `sanitizeAuditFreeText` (via `formatAuditLine`).
- **WriteGate:** Only `appendRecord` performs `audit-append` on `agent-log.md`.
- **Story 6.1** will re-verify the full eight-tool surface; this story should deliver **`vault_log_action`** so Epic 6 is not blocked on an empty registration.

### Testing requirements

- Temp vault under `os.tmpdir()` (see `tests/vault-io/vault-move.test.ts`, `audit-logger.test.ts`).
- Assert log line contains tool name and expected JSON fragment where applicable; assert sensitive strings from note bodies do **not** appear in `agent-log.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.2]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — §8 Audit logging, §Implementation sequence]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — §5 tools, §7 acceptance]
- [Source: `_bmad-output/implementation-artifacts/5-1-auditlogger-append-only-format.md` — format, NFR-S3, `vault_move` reference implementation]
- [Source: `src/audit/audit-logger.ts`]
- [Source: `src/register-vault-io-tools.ts`]
- [Source: `src/tools/vault-move.ts` — `appendRecord` usage after successful move]

## Developer context (guardrails)

| Topic | Requirement |
|--------|-------------|
| **Choke point** | All audit lines go through `appendRecord` + WriteGate `audit-append`. |
| **Ordering** | Mutation committed first; then audit; then return success to caller. |
| **No payload leaks** | Never pass full `content`, full `updates` values, or full daily append text into `payloadInput`. |
| **Move** | Single audit per successful `vault_move` (already implemented). |
| **Errors** | Audit failure → same error contract as other tools (`handleToolInvocationCatch` / `CnsError`). |

## Previous story intelligence (5.1)

- **`appendRecord`** order in `audit-logger.ts`: WriteGate then mkdir then append (review fixes applied in 5.1).
- **`action` and `tool`** are sanitized for `\|` / CR / LF via `formatAuditLine`.
- **`summarizePayloadForAudit`** catches circular / non-JSON-safe input and returns `[unserializable]`; prefer small plain objects for mutator payloads.
- **5.1 scope:** Only `vault_move` was wired; **5.2** owns create, update frontmatter, append daily, and **`vault_log_action`**.

## Git intelligence summary

Epic 4 completed mutators with explicit “deferred to Epic 5.2” comments at the success points in `vault-create-note.ts`, `vault-update-frontmatter.ts`, `vault-append-daily.ts`. `register-vault-io-tools.ts` currently registers seven tools; **`vault_log_action` is missing** until this story.

## Latest technical notes

No new npm dependencies expected. Use existing **Vitest** + **Zod** patterns from `register-vault-io-tools.ts`.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Added `VaultCreateNoteOptions`, `VaultUpdateFrontmatterOptions`, `VaultAppendDailyOptions` with optional `surface` (default `unknown`); MCP handlers pass `{ surface: "mcp" }`.
- Wired `appendRecord` after successful atomic writes in create note, update frontmatter, and append daily; create branch logs only on exclusive-create success; EEXIST retry delegates to `appendToExistingDaily`, which logs once (no double line).
- New `vault-log-action.ts`: Zod schema, `vaultLogAction` → `appendRecord` with `isoUtc` aligned to returned `logged_at`.
- Extended `AuditAppendFields` with optional `isoUtc` for that alignment.
- Tests: `tests/vault-io/mutations-audit.test.ts` (no EEXIST stat spy: ESM namespace not configurable in Vitest; race path covered by implementation structure).

### Implementation Plan

1. Mirror `vault_move` options pattern on the three mutators; call `appendRecord` only after successful rename/link.
2. Register eighth tool `vault_log_action` with safeParse error mapping like `vault_append_daily`.
3. Add integration-style audit tests with decoy secrets in note bodies; assert absence in `agent-log.md`.

### File List

- `src/audit/audit-logger.ts`
- `src/register-vault-io-tools.ts`
- `src/tools/vault-append-daily.ts`
- `src/tools/vault-create-note.ts`
- `src/tools/vault-log-action.ts` (new)
- `src/tools/vault-update-frontmatter.ts`
- `tests/vault-io/mutations-audit.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (Story 5.2 binding)
- `specs/cns-vault-contract/modules/security.md` (Story 5.2 binding)
- `.cursor/rules/cns-specs-constitution.mdc` (pointer to bound story)

## Change Log

- 2026-04-02: Story 5.2 implemented — mutator audit lines + `vault_log_action` MCP tool; verify.sh green.
- 2026-04-02: Bound this file as normative spec from Phase 1 spec + security module + Cursor rule; added explicit **Reviewer checklist**; strengthened mutation audit tests (credential-shaped placeholders, full-file raw log assertions).

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
