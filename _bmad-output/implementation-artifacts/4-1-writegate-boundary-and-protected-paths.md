# Story 4.1: WriteGate — boundary and protected paths

Status: done

<!-- Implementation context for dev agent; sources cited below. -->

## Story

As an **agent**,  
I want **all writes to pass a single gate that enforces vault boundary and protected directories**,  
so that **I cannot corrupt human-only or structural areas by mistake**.

## Acceptance Criteria

1. **Given** a centralized WriteGate module per architecture (`src/write-gate.ts`) encoding protected-path policy  
   **When** a caller requests a mutating filesystem operation (create, overwrite, delete, mkdir, rename) against a resolved absolute path under `vaultRoot`  
   **Then** the gate rejects disallowed targets with **`PROTECTED_PATH`** (or **`VAULT_BOUNDARY`** when the path is outside the vault—typically already thrown by `resolveVaultPath`, but the gate must remain consistent if invoked with absolute paths)  
   **And** no partial file is written by the gate itself (the gate validates only; actual IO happens in later write-tool stories).

2. **Given** architecture §3 protected-path table (human-edit-only and `_meta` rules)  
   **When** the target is under `AI-Context/**`, `_meta/schemas/**`, or any structural mutation under `_meta/**` disallowed by policy  
   **Then** the operation fails with **`PROTECTED_PATH`** and actionable `message` + optional `details.path` (vault-relative or normalized per existing tool conventions).

3. **Given** `_meta/logs/**` rules: deny direct put/patch; **only** append to `_meta/logs/agent-log.md` via audit machinery (Epic 5)  
   **When** Story 4.1 implements policy  
   **Then** the gate **denies** arbitrary writes under `_meta/logs/` **except** an explicitly documented **internal** allowance for audit append (e.g. `assertWriteAllowed(resolvedPath, { purpose: "audit-append" })` used only by future `AuditLogger`)  
   **And** default tool-facing calls use **`purpose: "tool-write"`** (or equivalent) so logs are not writable by mistake.

4. **Given** FR17, FR18, NFR-S1  
   **When** tests exercise the gate  
   **Then** allowed paths include normal note areas (e.g. `00-Inbox/`, topical folders) and denied paths match the architecture table; behavior is covered by **unit tests** (Vitest) that do not require a running MCP host.

## Tasks / Subtasks

- [x] **Extend error model** (AC: 1–2)
  - [x] Add **`PROTECTED_PATH`** to `ErrorCode` in `src/errors.ts` (architecture §9 includes this code; align `CnsError` and any type exports).
  - [x] Ensure `src/mcp-result.ts` (or equivalent) maps the new code for tool errors when write tools land; for this story, gate throws `CnsError` and tests assert codes.

- [x] **Implement `src/write-gate.ts`** (AC: 1–3)
  - [x] Accept `vaultRoot: string` and **normalized absolute** `resolvedPath: string` (document contract: callers must resolve via `path.resolve` + `path.normalize` consistent with `paths.ts`).
  - [x] Re-assert vault boundary (defense in depth): if path escapes `vaultRoot`, throw **`VAULT_BOUNDARY`**.
  - [x] Implement relative vault path computation for policy checks (e.g. `path.relative(vaultRoot, resolvedPath)` with guards for `..` leakage).
  - [x] Encode policy (from architecture §3 and epics.md Story 4.1):
    - Deny writes under `AI-Context/` (any depth).
    - Deny writes under `_meta/schemas/` (any depth).
    - Deny **structural** mutations under `_meta/` per architecture (mkdir/rename/delete); for Phase 1 “simpler rule table,” treat **any create/overwrite of files under `_meta/`** as deny **except** the audit-append exception below.
    - **Audit exception:** allow **append-only** target exactly `_meta/logs/agent-log.md` **only** when `purpose === "audit-append"`; all other paths under `_meta/logs/` → **`PROTECTED_PATH`** for tool writes.
  - [x] Export a small API, e.g. `assertWriteAllowed(vaultRoot, resolvedPath, options)` or `checkWrite(...)` returning a result type—pick one style and use it consistently in Epic 4 write tools.

- [x] **Wire nothing premature** (scope guard)
  - [x] Do **not** implement PAKE, secret scan, or actual `vault_create_note` in this story (Epic 4.2+). WriteGate gains those hooks later or separate functions in the same module per architecture.

- [x] **Tests** (AC: 4)
  - [x] Add `tests/write-gate.test.ts` (or colocated `src/write-gate.test.ts` per repo convention—match existing `tests/vault-io/` layout).
  - [x] Cases: allowed inbox path; denied `AI-Context/foo.md`; denied `_meta/schemas/x`; denied `_meta/foo.md`; denied `_meta/logs/other.md`; allowed `audit-append` only for `agent-log.md`; symlink edge cases if you already have a policy (if not, document “follow Node stat semantics” and add one test that matches `paths.ts` behavior).

## Dev Notes

### Guardrails (do not skip)

- **Phase 1 scope:** This story is **policy + module + tests**, not the full write tool surface. Epic 4.4+ will call WriteGate before `fs.writeFile`.
- **Single choke point:** Architecture explicitly forbids raw `fs.writeFile` in tools that bypass WriteGate. Establish the module now so later stories only add callers.
- **Precedence:** Vault boundary rules remain authoritative in `src/paths.ts` for user-provided relative paths; WriteGate adds **write-specific** denies on top of “inside vault.”

### Sources (normative)

- `_bmad-output/planning-artifacts/epics.md` → Epic 4 / Story 4.1 (BDD AC).
- `_bmad-output/planning-artifacts/architecture.md` → §2 Path model, §3 Protected paths, §9 MCP tool error contract, §Project structure (`write-gate.ts`).
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` and `specs/cns-vault-contract/modules/` as needed for any vault-side policy wording (do not contradict repo architecture without explicit change control).

### Dependencies

- **Builds on:** `src/paths.ts` (`resolveVaultPath`, normalization assumptions), `src/errors.ts`, existing Vitest setup.
- **Enables:** Epic 4.2 (PAKE), 4.3 (secrets), 4.4–4.7 (mutating tools), Epic 5 (audit append caller).

### Completion checklist

- [x] `npm test` passes; `bash scripts/verify.sh` passes.
- [x] Story status moved to `done` in `sprint-status.yaml` when implementation merges.
- [x] Dev Agent Record filled (model, files touched, notes).

## Dev Agent Record

### Agent Model Used

Cursor agent (GPT-5.1)

### Completion Notes List

- Extended `ErrorCode` with `PROTECTED_PATH`; `callToolErrorFromCns` already serializes any `CnsError.code` for future write tools.
- Added `src/write-gate.ts`: `assertWriteAllowed(vaultRoot, resolvedPath, options)` with `purpose` default `tool-write` and `operation` default `overwrite`; **canonical boundary** via `realpathSync` + `resolveWriteTargetCanonical` (walks parents on `ENOENT` for create paths), then `vaultRelativePosix` for policy; **`audit-append` allows only `append`** on `_meta/logs/agent-log.md` (Phase 1 folder contract supplies the file; no `create` surface on the gate).
- Tests in `tests/vault-io/write-gate.test.ts` (Vitest): inbox allow, protected paths, `..` escape, symlink-to-in-vault-target, **symlink-to-outside-vault → `VAULT_BOUNDARY`**.

### Code review (handoff)

- **Symlink escape:** Write gate now rejects targets whose **canonical** path (after `realpathSync`) leaves the vault. **`src/paths.ts` read helpers remain string-based**; asymmetry accepted for Phase 1. **Documented** in `specs/cns-vault-contract/modules/security.md`; **deferred implementation** in story `4-9-canonical-read-boundary-hardening.md`. **`assertWithinVault`** JSDoc warns lexical-only (not read-safe without canonical step).
- **Audit surface:** Only `operation: "append"` with `purpose: "audit-append"` on the exact agent log path; Epic 5 `AuditLogger` must open with append flags and rely on folder contract for file presence.

### File List

- `src/errors.ts`
- `src/write-gate.ts`
- `src/paths.ts` (closeout: `assertWithinVault` JSDoc)
- `tests/vault-io/write-gate.test.ts`
- `specs/cns-vault-contract/modules/security.md` (closeout: read vs write boundary note)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-1-writegate-boundary-and-protected-paths.md`
- `_bmad-output/implementation-artifacts/4-9-canonical-read-boundary-hardening.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`

### Change Log

- 2026-04-02: Story context file created for Epic 4 kickoff (WriteGate boundary + protected paths).
- 2026-04-02: Implemented WriteGate module, `PROTECTED_PATH`, unit tests; story marked review.
- 2026-04-02: Follow-up: realpath-based vault boundary for writes, audit-append narrowed to `append` only, symlink-escape + `..` tests; code-review handoff notes added.
- 2026-04-02: Closed: security module note + backlog story 4.9 + `assertWithinVault` JSDoc; sprint status `done`.
