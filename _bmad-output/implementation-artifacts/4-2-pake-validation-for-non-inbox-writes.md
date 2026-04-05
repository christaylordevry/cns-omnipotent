# Story 4.2: PAKE validation for non-Inbox writes

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide for Epic 4.2. -->

## Story

As an **agent**,  
I want **frontmatter validated against repo-shipped PAKE rules outside `00-Inbox/`**,  
so that **created and updated notes stay schema-compliant**.

## Acceptance Criteria

1. **Given** Zod (or JSON Schema) definitions derived from `specs/cns-vault-contract/` PAKE standard  
   **When** validation runs for a target **vault-relative** path that is **not** under `00-Inbox/`  
   **Then** parsed frontmatter must satisfy the schema for the declared `pake_type`  
   **And** on failure the caller receives **`SCHEMA_INVALID`** with actionable `message` and optional structured `details` (field paths, not full note content).

2. **Given** the Inbox exception (FR6, FR12, FR16, architecture §3)  
   **When** the target vault-relative path is under `00-Inbox/` (any depth), determined **only** by normalized POSIX path prefix (`00-Inbox` or `00-Inbox/...`), not by frontmatter presence or shape  
   **Then** PAKE schema validation is **not** required by this layer (no-op; no throw).

3. **Given** NFR-R1 (no silent inconsistent state)  
   **When** validation fails before any future mutator performs IO  
   **Then** the validation API throws or returns a result that prevents the write; this story does **not** implement `vault_create_note`, but the module must be callable from write tools without side effects.

4. **Given** Story 4.1 complete  
   **When** tests run  
   **Then** **Vitest** unit tests cover valid/invalid PAKE objects, Inbox skip behavior, and at least one **per-`pake_type`** constraint (e.g. optional fields), without a live MCP host or real vault drive.

## Tasks / Subtasks

- [x] **Error contract** (AC: 1, 3)
  - [x] Add **`SCHEMA_INVALID`** to `ErrorCode` in `src/errors.ts` and ensure `CnsError` / `mcp-result` serialization accepts it (architecture §9).

- [x] **`src/pake/` validation library** (AC: 1–3)
  - [x] Add **`parse-frontmatter.ts`** (or single module): use existing **`gray-matter`** dependency to split YAML frontmatter from body; reject unusable input with **`SCHEMA_INVALID`** or **`IO_ERROR`** only where parsing itself is the failure mode (document distinction).
  - [x] Add **Zod schemas** for PAKE Standard minimum fields per [Source: `specs/cns-vault-contract/AGENTS.md` § Frontmatter Template] and [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` § Frontmatter Schema]: `pake_id` (UUID v4 string), `pake_type` (enum of five types), `title`, `created` / `modified` (date strings `YYYY-MM-DD`), `status`, `confidence_score` (0–1), `verification_status`, `creation_method`, `tags` (array). Model **optional** fields (`source_uri`, `cross_references`, `ai_summary`) where spec allows.
  - [x] Export **`validatePakeForVaultPath(vaultRelativePosix: string, frontmatter: unknown)`** (names flexible): if path is Inbox-prefixed → **skip** validation (return success); else parse/validate and **`throw new CnsError("SCHEMA_INVALID", ...)`** on failure. Use stable Inbox prefix check: normalize to forward slashes and treat `00-Inbox` / `00-Inbox/...` as exempt.
  - [x] **Contract manifests (`*/_README.md`):** **Phase 1 decision — skip only.** Do **not** apply PAKE Standard when the vault-relative POSIX path ends with `/_README.md` (includes root `_README.md`). Rationale: manifests are human-authored folder-contract documents with contract-template keys (`purpose`, `schema_required`, etc.); PAKE Zod would produce false failures and adds no safety. **No** separate manifest schema in this story.

- [x] **Integration boundary** (AC: 3, scope)
  - [x] Do **not** implement secret scan (4.3), `vault_create_note` (4.4), or merge into `assertWriteAllowed` unless trivial (prefer **separate function** called **after** WriteGate in later stories).

- [x] **Tests** (AC: 4)
  - [x] Add `tests/vault-io/pake-validation.test.ts` (or `src/pake/*.test.ts` matching repo convention): valid minimal frontmatter per type; invalid enum; invalid UUID; Inbox path skip; manifest path behavior per chosen rule.

## Dev Notes

### Architecture compliance

- **Single pipeline later:** Architecture §4 and §Project structure: `write-gate.ts` eventually combines boundary, secrets, and PAKE; for **4.2**, deliver **`src/pake/`** as the **authoritative validation** so 4.4+ only imports and calls it.
- **Normative source in repo:** Schemas must be **repo-shipped** (Zod in TS is acceptable); tests must not depend on `Knowledge-Vault-ACTIVE/` or a Windows drive letter.
- **Parser:** `gray-matter` already in `package.json`; **Zod** already present.

### File structure requirements

- **Target layout:** [Source: `_bmad-output/planning-artifacts/architecture.md` § Project structure]  
  `src/pake/parse-frontmatter.ts`, plus `validate.ts` or `schemas.ts` as needed. **Kebab-case** filenames.

### Testing requirements

- **Runner:** Vitest (`npm run test:vitest`), full gate `bash scripts/verify.sh` before marking done.
- **Style:** Mirror `tests/vault-io/write-gate.test.ts` patterns (imports from `src/*.js` after build or tsconfig paths as existing tests do).

### Previous story intelligence (4.1)

- **WriteGate** uses **`vaultRelativePosix`**, **`CnsError`**, canonical path resolution for **writes**; PAKE validation is **orthogonal** (operates on **frontmatter data** + **logical** vault-relative path for Inbox/manifest rules).
- **4.1 code review:** Read path vs write path asymmetry is documented; do not change read helpers for this story.
- **`PROTECTED_PATH`** and **`VAULT_BOUNDARY`** are already implemented; add **`SCHEMA_INVALID`** without reusing those codes for schema failures.

### Library and versions

- Use **Zod 3.x** and **gray-matter** from the **implementation package `package.json`** (this repo: single root package from story 3-1; do not rely on a non-existent nested MCP `package.json`).

### Implementation decisions (locked)

- **`_README.md`:** Skip PAKE validation for paths ending with `/_README.md` (manifests are not PAKE notes).
- **Inbox:** Exemption **only** via path prefix `00-Inbox` / `00-Inbox/...` after normalizing separators; never infer Inbox from missing or invalid frontmatter.
- **`SCHEMA_INVALID`:** Add to `ErrorCode` in `errors.ts` **before** building the validator (same pattern as `PROTECTED_PATH` in 4.1).

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.2 (BDD AC).
- `_bmad-output/planning-artifacts/architecture.md` — §3 Inbox exception, §4 PAKE validation, §9 error contract, §Project structure.
- `specs/cns-vault-contract/AGENTS.md` — PAKE Standard frontmatter template and `_README.md` exception wording.
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — Frontmatter schema section.
- `specs/cns-vault-contract/modules/vault-io.md` — Validate before write outside Inbox.
- `_bmad-output/implementation-artifacts/4-1-writegate-boundary-and-protected-paths.md` — prior epic patterns and file list.

### Open questions (non-blocking)

- If human-readable `_meta/schemas/*.md` in the vault diverges from repo Zod, **repo Zod wins** for MCP until a change-control story aligns them.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Code review (handoff)

- **AC coverage:** Path-only Inbox and `/_README.md` skips, `SCHEMA_INVALID` with `details.issues` (paths + messages, no full note body), YAML syntax → `IO_ERROR` vs schema → `SCHEMA_INVALID`, per-type optional field (`source_uri`) covered in tests.
- **Residual risk (document only):** Inbox prefix is case-sensitive (`00-Inbox` exact). Vault-relative paths that only normalize backslashes/`./` are accepted; odd encodings or Unicode lookalikes are out of scope for Phase 1.
- **Integration:** Callers must run `parseNoteFrontmatter` then `validatePakeForVaultPath` on the write path; Story 4.4 wires the pipeline.

### Completion Notes List

- Added `SCHEMA_INVALID` to `ErrorCode` before PAKE modules; `callToolErrorFromCns` already forwards any `CnsError.code` (no `mcp-result` change).
- **`parseNoteFrontmatter`:** YAML/frontmatter **syntax** failures → `IO_ERROR` (aligned with `vault_read_frontmatter`). **`validatePakeForVaultPath`:** non-object or Zod PAKE Standard failures → `SCHEMA_INVALID` with `details.issues` (field paths only).
- Inbox skip and `_README.md` skip are **path-only** via `path-rules.ts` (`normalizeVaultRelativePosix`, `isInboxVaultPath`, `isContractManifestReadmePath`).
- Dependencies: `gray-matter` and `zod` remain on the **root** implementation `package.json` (single package from 3-1; no nested MCP package).
- JSDoc in `validate.ts` avoids `**/` inside block comments (would terminate the comment).

### File List

- `src/errors.ts` (modified)
- `src/pake/path-rules.ts` (new)
- `src/pake/schemas.ts` (new)
- `src/pake/parse-frontmatter.ts` (new)
- `src/pake/validate.ts` (new)
- `tests/vault-io/pake-validation.test.ts` (new)
- `_bmad-output/implementation-artifacts/4-2-pake-validation-for-non-inbox-writes.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-04-02: Story context file created (BMAD create-story workflow); sprint status set to `ready-for-dev`.
- 2026-04-02: Implemented PAKE validation library, `SCHEMA_INVALID`, Vitest coverage; locked manifest skip and path-based Inbox in story; sprint status `review`.
- 2026-04-02: Code review passed; sprint status `done`.
