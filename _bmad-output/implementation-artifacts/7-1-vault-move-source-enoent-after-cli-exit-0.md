# Story 7.1: `vault_move` — Obsidian CLI exit 0 must imply source removed

Status: done

**Scope:** Phase 1 correctness closure (before Phase 2). ~30 minutes: **one production check** + **one regression test** + `verify.sh`.

**Problem class:** Core tool correctness — not polish. Today, when the Obsidian CLI path is used and the child exits `0`, the code verifies the destination exists but **does not** verify the source file is gone. A broken or misbehaving CLI could leave **both** source and destination files (e.g. copy without delete), and the implementation would still append audit and return success — violating NFR-R1-style “no silent inconsistent state.”

---

## Story

As an **operator**,  
I want **`vault_move` to treat Obsidian CLI exit `0` as success only if the source path no longer exists**,  
so that **a lying CLI cannot produce a successful move while the vault still holds the old file**.

---

## Acceptance Criteria

### AC1 — Source `ENOENT` after CLI success (implementation)

**Given** `obsidianCliPath` is configured and `tryObsidianCliMove` resolved `true` (process exit code `0`)

**When** execution is in the `usedCli` branch of `vaultMove` after the existing destination `stat` check

**Then** the implementation **must** `stat` the **canonical source path** (`sourceCanonical` — same file identity validated before the CLI ran)

**And** if `stat` succeeds (source still present), throw `CnsError("IO_ERROR", …)` with an operator-clear message (e.g. CLI reported success but source file still exists at `source_path`)

**And** **must not** run `writePreparedMovedNoteContent`, wikilink repair, or `appendRecord` on that path — fail closed

**And** if `stat` fails with `ENOENT`, proceed with the existing post-move pipeline unchanged

**Binding code today:** `src/tools/vault-move.ts` lines 329–343 (CLI branch checks destination only). Extend immediately after destination validation.

---

### AC2 — Single regression test

**Given** a temp vault with a valid PAKE note at `source_path`, destination parent exists, destination file does not exist initially

**When** `obsidianCliPath` points to a **fake CLI** that:

- exits `0`, and
- creates the destination file by copying from source (source **remains** — simulates “success” without a true move)

**Then** `vaultMove` **rejects** with `{ code: "IO_ERROR" }`

**Pattern:** Reuse the style of `tests/vault-io/vault-move.test.ts` (“falls back to rename when Obsidian CLI exits non-zero”): executable in temp dir. A tiny `node` ESM script that reads vault root from `process.env`, parses `path=` / `to=` from `process.argv`, `mkdir` for parent, `copyFileSync` source→dest, `exit 0` keeps the test hermetic without mocking `spawn`.

---

### AC3 — Verification gate

**Then** `bash scripts/verify.sh` passes.

---

## Tasks / Subtasks

- [x] AC1: After destination check in the `usedCli` branch, assert source is gone (`ENOENT`) or throw `IO_ERROR`
- [x] AC2: One new `it(...)` in `tests/vault-io/vault-move.test.ts`
- [x] AC3: Run `bash scripts/verify.sh`

---

## Dev Notes

- **Deferred intake:** [_bmad-output/implementation-artifacts/deferred-work.md — “`vault_move` Obsidian CLI success path (4-7 review)”]
- **Do not** change `tryObsidianCliMove` contract (still `boolean` on exit `0`); verification is **filesystem truth** after CLI returns.
- **Symmetry:** Filesystem fallback uses `rename`, which inherently removes the source; CLI path needs this explicit parity check.
- **Errors:** Prefer consistent `CnsError` / `IO_ERROR` mapping with existing vault-move messages; avoid new error codes for Phase 1.

### Project Structure Notes

- Expected touch set: `src/tools/vault-move.ts`, `tests/vault-io/vault-move.test.ts` only unless a trivial shared constant is already established (avoid refactors).

### References

- [Source: `src/tools/vault-move.ts` — module header ordering, `tryObsidianCliMove`, `usedCli` branch]
- [Source: `_bmad-output/implementation-artifacts/4-7-vault-move.md` — Obsidian CLI path, AC3]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_move`]
- [Source: `_bmad-output/planning-artifacts/epics.md` — NFR-R1 authorized mutations consistency]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- After Obsidian CLI exit `0`, `vaultMove` now `stat`s `sourceCanonical`; if the file still exists, throws `IO_ERROR` and skips post-move writes and audit.
- Regression: fake CLI copies source→dest, exits `0`, leaves source; `vaultMove` rejects with `IO_ERROR`; both paths remain (no `writePreparedMovedNoteContent` / audit). Test asserts `agent-log.md` stays empty so `appendRecord` is not refactored past the error path unnoticed.

### File List

- `src/tools/vault-move.ts`
- `tests/vault-io/vault-move.test.ts`
