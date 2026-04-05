# Story 4.5: `vault_update_frontmatter`

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide for Epic 4.5. -->

## Story

As an **agent**,  
I want **to merge frontmatter updates without dropping unspecified fields**,  
so that **I can patch metadata safely**.

## Acceptance Criteria

1. **Given** WriteGate, PAKE validation, and secret scanning from Stories 4.1–4.4  
   **When** `vault_update_frontmatter` runs its mutation pipeline on an **existing** vault note  
   **Then** checks occur in this **exact order** (document in code; tests fail if reordered):
   1. **WriteGate** — `assertWriteAllowed(vaultRoot, resolvedAbs, { operation: "overwrite" })` **before** reading file content for merge (same rationale as 4-4: reject `PROTECTED_PATH` / `VAULT_BOUNDARY` without parsing YAML).
   2. **Read** — Load current file text via vault boundary-safe resolution (reuse `resolveVaultPath` + `readFile` pattern from `vaultReadFile`); `NOT_FOUND` if missing; `IO_ERROR` for directory / read failures.
   3. **Parse** — `parseNoteFrontmatter` to obtain existing `frontmatter` + `body` (YAML errors → `IO_ERROR`, consistent with `vault-read-frontmatter` / `parse-frontmatter` policy).
   4. **Merge** — **Shallow** merge: for each key in input `updates`, set or replace that key on the frontmatter object; **omit** keys not present in `updates` (no deletion-by-omission). Nested objects: replacing a key replaces the whole nested value (do not deep-merge nested maps unless spec later requires it).
   5. **Timestamps** — After merge, set `modified` on the merged frontmatter to **today** in `YYYY-MM-DD` (PAKE date shape), regardless of whether the caller included `modified` in `updates` (spec: auto-update modified).
   6. **PAKE** — `validatePakeForVaultPath(posixRel, mergedFrontmatter)` so schema runs on the **result** of the merge. Inbox (`00-Inbox/...`) and contract manifests (`*/_README.md`) keep **path-based skip** per Story 4-2.
   7. **Secret scan** — Serialize full note (new YAML frontmatter + **unchanged** body) and run `assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString)` so scan matches create-note semantics (full file string).
   8. **Atomic write** — Write to a temp file in the **target file’s directory**, then `rename` over the existing file; on failure paths you control, remove temp; no truncated destination.

2. **Given** Phase 1 spec inputs `path` (string) and `updates` (object of key-value pairs)  
   **When** the tool succeeds  
   **Then** the MCP response includes `{ path, updated_fields, modified_at }` where:
   - `path` is **vault-relative POSIX** (normalized like other tools),
   - `updated_fields` lists the **top-level** keys from the request’s `updates` object **and** always includes `modified` when the tool applied the automatic `modified` bump (so callers see every field the tool changed),
   - `modified_at` is an ISO 8601 timestamp string for the mutation (align field name with `vault_create_note`’s `created_at` convention).

3. **Given** NFR-R1  
   **When** any step fails  
   **Then** return explicit `CnsError` codes (`VAULT_BOUNDARY`, `PROTECTED_PATH`, `NOT_FOUND`, `SCHEMA_INVALID`, `SECRET_PATTERN`, `IO_ERROR`, etc.) and leave the original file unchanged.

4. **Given** the MCP server from Epic 3  
   **When** the tool is registered  
   **Then** inputs are **Zod-validated** (`path` required; `updates` as `z.record(z.string(), z.unknown())` or stricter if you encode scalar/array shapes), errors map through `callToolErrorFromCns`, and Vitest covers: happy merge (unspecified keys preserved), `modified` auto-bump, PAKE failure after merge, secret hit on merged content, `PROTECTED_PATH`, ordering proof (PAKE-invalid merged note that also matches a secret pattern → **`SCHEMA_INVALID` first**).

5. **Given** Phase 1 audit expectations (same deferral as 4-4)  
   **When** an update succeeds  
   **Then** document whether this story appends to `_meta/logs/agent-log.md` or defers to Epic 5.2 with an in-code pointer to `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`.

## Tasks / Subtasks

- [x] **Pipeline + module** (AC: 1, 3) — Add `src/tools/vault-update-frontmatter.ts` implementing the ordered steps above; reuse `resolveVaultPath`, `assertWriteAllowed`, `resolveWriteTargetCanonical`, `vaultRelativePosix`, `parseNoteFrontmatter`, `validatePakeForVaultPath`, `assertVaultWriteContentNoSecretPatterns`, and the same realpath/canonical target pattern as `vault-create-note.ts` for stable `posixRel`.

- [x] **Serialize** (AC: 1) — Rebuild markdown with `gray-matter` (`matter.stringify` or equivalent) so the **body** is preserved exactly as returned by `parseNoteFrontmatter` (no accidental trim of trailing newline unless consistent with create-note).

- [x] **MCP** (AC: 2, 4) — Register `vault_update_frontmatter` in `src/index.ts` with description aligned to spec; return JSON success payload.

- [x] **Tests** (AC: 4) — Add `tests/vault-io/vault-update-frontmatter.test.ts` (or adjacent pattern): fixture vault / `fs.mkdtemp`; minimal PAKE note; merge `status` or `tags`; assert unchanged keys; PAKE-before-secret ordering test mirroring 4-4.

- [x] **Audit** (AC: 5) — Wire or defer with comment + story reference to 5-2.

## Dev Notes

### Architecture compliance

- **Write path:** No raw `fs.writeFile` without WriteGate; **overwrite** operation for in-place file replace [Source: `_bmad-output/planning-artifacts/architecture.md` § Protected paths / PAKE / secret scan scope].
- **PAKE applies** to `vault_update_frontmatter` outside Inbox [Source: same file § 4. PAKE validation].
- **Secret scan:** full note string including frontmatter region [Source: architecture § 5].

### File structure requirements

- **Kebab-case** module `src/tools/vault-update-frontmatter.ts`; thin `index.ts` registration, matching `vault-create-note.ts` / `vault-read-frontmatter.ts`.

### Testing requirements

- **Runner:** Vitest; gate: `bash scripts/verify.sh` before marking done.
- **Fixtures:** Temp dirs; no dependency on operator’s live vault path.

### Previous story intelligence (4-4)

- **Pipeline order** is mandatory and test-enforced for create: **Gate → (work) → PAKE → secrets → IO**. For update, **Gate → read → parse → merge → PAKE → secrets → IO**; the **PAKE before secrets** invariant must hold on the **post-merge** full string.
- **Atomic writes:** temp in target directory + rename; cleanup temp on error.
- **Canonical paths:** use `realpathSync` on vault root and `resolveWriteTargetCanonical` + `vaultRelativePosix` like `vaultCreateNoteFromMarkdown` so symlink escape behavior stays consistent.
- **Audit logging** was explicitly deferred to Epic 5.2 with an inline comment; repeat that pattern unless 5-2 landed first.

### Library and framework requirements

- **Existing deps only:** `gray-matter`, `zod`, Node `fs/promises`; no new serializers unless justified.

### Latest technical notes

- `@modelcontextprotocol/sdk` patterns already in `src/index.ts`; keep error mapping via `callToolErrorFromCns` for `CnsError`.

### Project context reference

- No `project-context.md` in repo; follow `CLAUDE.md` and `specs/cns-vault-contract/AGENTS.md`.

### References

- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_update_frontmatter`]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.5]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — write tools sequence, error contract]
- [Source: `_bmad-output/implementation-artifacts/4-4-vault-create-note.md` — pipeline and testing patterns]

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation session 2026-04-02).

### Debug Log References

_(none)_

### Completion Notes List

- Implemented ordered pipeline (WriteGate overwrite → read → parse → shallow merge → `modified` bump → PAKE → secret scan → atomic rename) with Epic 5.2 audit deferral comment matching 4-4.
- `bash scripts/verify.sh` passed (Vitest + Node story tests + typecheck + build).

### File List

- `src/tools/vault-update-frontmatter.ts` (new)
- `src/index.ts` (register `vault_update_frontmatter` + Zod input)
- `tests/vault-io/vault-update-frontmatter.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (4-5 → done)

## Change Log

- 2026-04-02: Story context created (ready-for-dev); sprint status updated.
- 2026-04-02: Implemented `vault_update_frontmatter`; verify green; story **done**.
- 2026-04-02: Follow-up: blocklisted `__proto__` / `constructor` / `prototype` on merge; `updated_fields` always includes auto-applied `modified`; AC2 text aligned.
