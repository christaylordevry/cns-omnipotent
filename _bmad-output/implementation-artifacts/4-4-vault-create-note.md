# Story 4.4: `vault_create_note`

Status: done

<!-- Story context generated for Epic 4.4; sprint aligned to in-progress (same session as dev start). -->

## Story

As an **agent**,  
I want **to create new notes in routed, contract-correct locations**,  
so that **knowledge lands in the right folder with valid PAKE when required**.

## Acceptance Criteria

1. **Given** a resolved vault-relative target path and full note content (YAML frontmatter + body) ready to write  
   **When** `vault_create_note` runs its validation pipeline  
   **Then** checks occur in this **exact order** (documented in code and covered by tests that fail if reordered):
   1. **WriteGate** — `assertWriteAllowed` on the resolved absolute path (`operation: "create"` or the closest equivalent the gate documents for exclusive create) so boundary and protected-path violations fail **before** YAML parsing or PAKE work.
   2. **PAKE validation** — Parse with `parseNoteFrontmatter`, then `validatePakeForVaultPath(vaultRelativePosix, frontmatter)` so schema shape is confirmed **before** secret scanning.
   3. **Secret scan** — `assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString)` on the **complete** file string (frontmatter region + body) so scanning happens only after path and PAKE are acceptable.

2. **Given** WriteGate, PAKE, and secret modules from Stories 4.1–4.3  
   **When** I create a note with inputs per Phase 1 spec (`title`, `content`, `pake_type`, `tags`, `confidence_score`, `source_uri` optional, auto `pake_id` / timestamps)  
   **Then** the file is written **atomically** (write to a temp file in the target directory, then **hard link** to the final name so an existing file yields `EEXIST` instead of silent overwrite, then remove the temp name; same-filesystem as `rename`) where the platform allows, and routing matches [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` § `vault_create_note`] and [Source: `specs/cns-vault-contract/AGENTS.md` § Routing Rules + WorkflowNote disambiguation].

3. **Given** NFR-R1 (no silent inconsistent state)  
   **When** any step fails  
   **Then** the tool returns an explicit `CnsError` code (`VAULT_BOUNDARY`, `PROTECTED_PATH`, `SCHEMA_INVALID`, `SECRET_PATTERN`, `IO_ERROR`, etc.) and **no** partial note file remains (no orphan temp left behind on failure paths you control).

4. **Given** the MCP server from Epic 3  
   **When** the tool is registered  
   **Then** inputs are **Zod-validated**, errors map through `callToolErrorFromCns`, and Vitest tests exercise happy path + at least one failure per gate stage (WriteGate deny, PAKE invalid, secret hit) using a fixture vault root (no dependency on operator’s live vault path).

5. **Given** Phase 1 audit expectations  
   **When** a create succeeds  
   **Then** document in implementation notes whether this story appends to `_meta/logs/agent-log.md` via `audit-append` / shared logger, or defers full line format to Epic 5.2 — spec requires eventual logging for every mutator [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` § Security Enforcement / `vault_create_note` behavior].

## Tasks / Subtasks

- [x] **Pipeline order** (AC: 1, 4) — Implement `vault_create_note` (new `src/tools/vault-create-note.ts` or equivalent) with **WriteGate → PAKE → secret scan**; add a test that would break if `assertVaultWriteContentNoSecretPatterns` runs before `validatePakeForVaultPath` (e.g. PAKE-invalid content that also triggers a pattern: PAKE must fail first with `SCHEMA_INVALID`, not `SECRET_PATTERN`).

- [x] **Routing + file body** (AC: 2) — Compute destination directory from `pake_type` and optional project/area parameters per spec; build full markdown with generated `pake_id` (UUID v4), `created` / `modified`, and required PAKE fields.

- [x] **Atomic create** (AC: 2, 3) — Exclusive create: fail clearly if the target file already exists; temp + `link` + unlink temp name in target directory (see `specs/cns-vault-contract/modules/security.md`); cleanup temp on error.

- [x] **MCP registration** (AC: 4) — Register `vault_create_note` in `src/index.ts` with schema matching spec inputs; return `{ pake_id, file_path, created_at }` (or spec-equivalent field names).

- [x] **Audit logging** (AC: 5) — Wire or explicitly defer with a tracked TODO and reference to `5-2-mutations-and-vault-log-action.md`.

## Dev Notes

### Architecture compliance

- **Write path:** [Source: `_bmad-output/planning-artifacts/architecture.md`] — No raw `fs.writeFile` in the handler without going through WriteGate; reuse `resolveVaultPath` + canonical resolution patterns from `write-gate.ts` / Story 4.1.
- **Imports:** `assertWriteAllowed`, `vaultRelativePosix`, `resolveWriteTargetCanonical` as established in 4.1; `parseNoteFrontmatter`, `validatePakeForVaultPath` from `src/pake/`; `assertVaultWriteContentNoSecretPatterns` from `src/secrets/scan.js`.

### File structure requirements

- **Kebab-case** tool module under `src/tools/`; keep `index.ts` as thin registration + Zod, matching `vault-read.ts` / `vault-list.ts` style.

### Testing requirements

- **Runner:** Vitest (`npm run test:vitest`); gate: `bash scripts/verify.sh` before marking done.
- **Fixtures:** Use `fs.mkdtemp` or existing vault-io test patterns; avoid real `Knowledge-Vault-ACTIVE/` paths.

### Previous story intelligence (4.1–4.3)

- **4.1:** Canonical write target via `realpathSync` + `resolveWriteTargetCanonical`; `vaultRelativePosix` for policy strings.
- **4.2:** Inbox and `/_README.md` skips live inside `validatePakeForVaultPath`; path prefix is authoritative for Inbox.
- **4.3:** Secret scan is async (`loadMergedSecretPatterns`); do not echo matched material; full note string is the scan unit.

### References

- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_create_note`]
- [Source: `specs/cns-vault-contract/modules/vault-io.md`]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.4]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Code review (separate pass)

- **Blind Hunter:** WriteGate runs before frontmatter work (`PROTECTED_PATH` test); symlink escape covered (`VAULT_BOUNDARY`); `project`/`area` limited to single segments (blocks `../escape`). No bypass found.
- **Edge Case Hunter:** Duplicate path → `IO_ERROR`; temp file removed on failure; title slug degenerates to `note.md` when empty after strip; PAKE-invalid + secret body yields `SCHEMA_INVALID` before scan (ordering test). Residual: same-title concurrent creates remain a TOCTOU race (rename failure surfaces as `IO_ERROR`) — acceptable for Phase 1.
- **Acceptance Auditor:** AC1–5 satisfied; audit append explicitly deferred to Epic 5.2 with in-code comment and story reference. `bash scripts/verify.sh` passed at acceptance.

**Outcome:** Accepted; no blocking changes.

### Completion Notes List

- Implemented `src/tools/vault-create-note.ts`: `vaultCreateNoteFromMarkdown` runs **WriteGate (`create`) → parseNoteFrontmatter → validatePakeForVaultPath → assertVaultWriteContentNoSecretPatterns**, then exclusive check, temp write in target dir, rename. `vaultCreateNote` adds routing (`destinationDirectoryForCreate`), title slug filename, and `buildVaultCreateNoteMarkdown` (UUID v4, quoted `created`/`modified` strings so gray-matter yields PAKE-compatible types).
- MCP: `vault_create_note` registered in `src/index.ts` with Zod input; domain errors via `callToolErrorFromCns`.
- Tests: `tests/vault-io/vault-create-note.test.ts` (happy path, routing, duplicate file, PROTECTED_PATH, VAULT_BOUNDARY symlink, PAKE-before-secret ordering, SECRET_PATTERN, invalid project segment).
- **AC5 / audit:** No append to `_meta/logs/agent-log.md` in this story; inline comment references deferred work in `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` (Epic 5.2).
- Verify gate: `bash scripts/verify.sh` passed.

### File List

- `src/tools/vault-create-note.ts`
- `src/index.ts`
- `tests/vault-io/vault-create-note.test.ts`
- `_bmad-output/implementation-artifacts/4-4-vault-create-note.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-02: Story 4-4 implementation complete; vault_create_note tool, tests, sprint status → review.
- 2026-04-02: Code review passed; sprint status → done.
- 2026-04-02: Exclusive create hardened: `link(2)` instead of `rename` to avoid clobbering an existing file; documented in `specs/cns-vault-contract/modules/security.md`.
