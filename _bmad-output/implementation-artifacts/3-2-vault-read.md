# Story 3.2: `vault_read`

Status: done

## Story

As an **agent**,  
I want **to read a full note by vault-relative path**,  
so that **I can reason over file contents inside allowed areas**.

## Acceptance Criteria

1. **Given** a path inside the vault root and not blocked by read policy  
   **When** I call `vault_read`  
   **Then** I receive the file contents or a `NOT_FOUND` / `IO_ERROR` with stable error shape  
   **And** paths outside the vault are rejected with `VAULT_BOUNDARY` (FR8, FR17 for attempted misuse).

## Tasks / Subtasks

- [x] **Extend error model** (AC: 1)
  - [x] Add `NOT_FOUND` to stable tool error codes (architecture MCP error contract).

- [x] **Implement `vault_read` core** (AC: 1)
  - [x] Add `src/tools/vault-read.ts`: resolve path with `resolveVaultPath`, read UTF-8 file, map `ENOENT` → `NOT_FOUND`, IO failures → `IO_ERROR`, boundary → `VAULT_BOUNDARY` (from `resolveVaultPath`).
  - [x] Reject reading a directory as a file (`EISDIR` → `IO_ERROR` with actionable message).

- [x] **Register MCP tool** (AC: 1)
  - [x] In `src/index.ts`, register tool name exactly `vault_read` with Zod `path` (non-empty string).
  - [x] Success: return full file text as tool text content.
  - [x] Errors: return `isError: true` with JSON body `{ code, message, details? }` per architecture.

- [x] **Tests** (AC: 1)
  - [x] Vitest: happy path, `NOT_FOUND`, `VAULT_BOUNDARY`, directory path (`IO_ERROR`).

## Dev Notes

- **Read policy:** Story AC mentions read policy; Phase 1 has no separate read blocklist in this repo yet. Enforce vault boundary only; defer path-level read denies to later stories if specified.
- **Stack:** Zod for tool args; reuse `resolveVaultPath` from `src/paths.ts`.
- **References:** `_bmad-output/planning-artifacts/architecture.md` (MCP tool error contract); `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (`vault_read`).

### Review Findings (2026-04-02)

- [x] [Review] **bmad-code-review (Story 3.2 scope):** No blocking issues. AC1 satisfied: `vault_read` registered with Zod `path`, boundary via `resolveVaultPath`, `NOT_FOUND` / `IO_ERROR` / `VAULT_BOUNDARY` with stable JSON via `callToolErrorFromCns`. Read-policy blocklist deferred per Dev Notes. Non-blocking deferrals: symlink/`realpath` semantics, very large files, invalid UTF-8 handling (future hardening).

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- `npm test`
- `npm run typecheck`
- `npm run build`
- `bash scripts/verify.sh` (after `scripts/verify.sh` fix: detects `typecheck` / `build` via `package.json`, not broken `npm -s run` grep)

### Completion Notes List

- Added `NOT_FOUND` to `ErrorCode` and `vaultReadFile` in `src/tools/vault-read.ts` (boundary via `resolveVaultPath`, `ENOENT` / `EISDIR` / generic IO).
- Registered MCP tool `vault_read` with Zod-validated `path`; domain errors return `isError` + JSON `{ code, message, details? }` via `callToolErrorFromCns`.
- Vitest coverage for happy path, missing file, escape, directory-as-file.
- Code review passed; story marked **done**. `scripts/verify.sh` updated so the factory gate runs real `typecheck` and `build` (was skipping because `npm -s run` prints no script list).

### File List

- `src/errors.ts`
- `src/mcp-result.ts`
- `src/tools/vault-read.ts`
- `src/index.ts`
- `tests/vault-io/vault-read.test.ts`
- `scripts/verify.sh` (gate: detect scripts via Node + `package.json`)

### Change Log

- 2026-04-02: Story 3.2 — `vault_read` tool + tests + sprint artifact created from epics.
- 2026-04-02: Verify gate fix + code review; story status **done**.
