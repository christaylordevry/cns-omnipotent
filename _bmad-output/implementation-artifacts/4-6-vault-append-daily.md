# Story 4.6: `vault_append_daily`

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide for Epic 4.6. -->

## Story

As an **agent**,  
I want **to append to today’s daily note under an optional section**,  
so that **I can log progress without hand-editing dailies**.

## Acceptance Criteria

1. **Given** Phase 1 spec and constitution daily-note layout  
   **When** `vault_append_daily` runs  
   **Then** the target path is **`DailyNotes/YYYY-MM-DD.md`** where `YYYY-MM-DD` is **today’s calendar date in UTC**, matching `todayUtcYmd()` usage in `vault-update-frontmatter.ts` (Vitest fake timers must pin the same instant for assertions).

2. **Given** WriteGate, PAKE validation, and secret scanning from Stories 4.1–4.5  
   **When** the daily file **already exists**  
   **Then** the mutation pipeline runs in this **exact order** (document in code; tests fail if reordered):
   1. **WriteGate** — `assertWriteAllowed(vaultRoot, resolvedAbs, { operation: "overwrite" })` **before** reading the file (reject `PROTECTED_PATH` / `VAULT_BOUNDARY` without parsing body).
   2. **Read** — `readFile` on canonical target; `NOT_FOUND` → treat as missing branch below; `IO_ERROR` for directory / read failures; YAML parse errors on read use same policy as update-frontmatter (`parseNoteFrontmatter` → `IO_ERROR` on invalid note shape if applicable).
   3. **Body edit** — Parse with `parseNoteFrontmatter`. Bump frontmatter **`modified`** to today (`YYYY-MM-DD`, UTC). Insert caller **`content`** into the **markdown body**:
      - If **`section`** is omitted or empty: append `\n\n` + trimmed content + trailing newline semantics consistent with `vault-update-frontmatter` / `gray-matter` stringify at **end of body**.
      - If **`section`** is provided: normalize to a **level-2 heading line** for matching, e.g. caller passes `## Agent Log` or `Agent Log` (implementation trims; if line does not start with `#`, treat as title and match `## ${trimmed}`). Find the first body line that equals the normalized heading (after trim). Insert the new content **after** that heading line and **before** the next line that matches `/^##\s+/` (start of next H2), or at **end of body** if no such line. If the heading **does not exist**, append at end of body: `\n\n${normalizedHeading}\n\n${trimmedContent}\n` so the section is created (explicit, test-covered).
   4. **PAKE** — `validatePakeForVaultPath(posixRel, frontmatter)` on the **post-edit** frontmatter object (daily lives under `DailyNotes/`, **not** Inbox; full PAKE applies).
   5. **Secret scan** — Build full file string with `gray-matter` (`matter.stringify(body, frontmatter)`) and run `assertVaultWriteContentNoSecretPatterns(vaultRoot, fullNoteString)` so behavior matches architecture: **entire note** is scanned, not only the appended fragment (stricter than informal “new content only” wording; aligns with [Source: `_bmad-output/planning-artifacts/architecture.md` § 5]).
   6. **Atomic write** — Temp file in **`DailyNotes/`** directory, `rename` over destination; cleanup temp on failure.

3. **Given** the same security stack  
   **When** the daily file **does not exist**  
   **Then**:
   1. **WriteGate** — `assertWriteAllowed(vaultRoot, resolvedAbs, { operation: "create" })`.
   2. **Ensure directory** — `mkdir(..., { recursive: true })` for `DailyNotes/` under vault root as needed (no writes under `_meta/`).
   3. **Bootstrap** — Create initial note from the **Daily Notes Format** in [Source: `specs/cns-vault-contract/AGENTS.md` § Daily Notes Format]: `pake_type: WorkflowNote`, `tags: [daily]`, `title: "Daily Note YYYY-MM-DD"`, `created` / `modified` = that date, **`pake_id`** = `randomUUID()` (same as `vault-create-note`). Body must include `# YYYY-MM-DD` and the three sections `## Log`, `## Agent Log`, `## Reflections`. Human placeholder lines from the constitution (`[Chronological entries...]`, etc.) **must not** appear in machine output; use empty lines under each section so append logic has stable anchors.
   4. **Apply append** — Same section / end-of-body rules as AC2 **on the bootstrapped body**.
   5. **PAKE** → **Secret scan** → **Exclusive create** as in `vaultCreateNoteFromMarkdown`: write temp in `DailyNotes/`, then `link(tmp, canonicalTarget)` (not `rename`) so `EEXIST` means another writer won the race—**on `EEXIST`**, `unlink` temp and **re-run the existing-file branch** once from read (bounded retry prevents clobber). Matches [Source: `src/tools/vault-create-note.ts`].

4. **Given** Phase 1 spec inputs `content` (string), `section` (string, optional)  
   **When** the tool succeeds  
   **Then** the MCP JSON payload is **`{ path, appended_at }`** where `path` is **vault-relative POSIX** (`DailyNotes/YYYY-MM-DD.md`, forward slashes) and `appended_at` is **ISO 8601** UTC string (same convention as `created_at` / `modified_at` elsewhere).

5. **Given** NFR-R1 and FR14  
   **When** any step fails  
   **Then** return explicit `CnsError` codes and **leave the prior daily file unchanged** on the existing-file path (no partial truncate).

6. **Given** the MCP server from Epic 3  
   **When** the tool is registered  
   **Then** Zod validates **`content`** (required string; allow empty only if product decision, otherwise `.min(1)`—**require at least one non-whitespace character** to avoid no-op writes), **`section`** optional string; map errors via `callToolErrorFromCns`; Vitest covers: create-missing-daily + append under `## Agent Log`, append with no section, section-not-found creates heading, PAKE failure, `SECRET_PATTERN` on full note after append, `PROTECTED_PATH` if someone points tool at wrong path (tool always targets `DailyNotes/{date}.md` only—**do not** accept arbitrary path input), ordering test: invalid PAKE after append + secret in body → **`SCHEMA_INVALID` before** secret path if implementation reuses single pipeline order.

7. **Given** Phase 1 audit expectations (Stories 4-4 / 4-5)  
   **When** append succeeds  
   **Then** **defer** `vault_log_action` / `_meta/logs/agent-log.md` append to Epic 5.2 with the same inline comment pattern as `vault-update-frontmatter.ts` pointing to `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`.

## Tasks / Subtasks

- [x] **Module** (AC: 2, 3, 5) — Add `src/tools/vault-append-daily.ts`: shared helpers for UTC date, template builder, body splice, canonical path resolution (`realpathSync` on vault root, `resolveWriteTargetCanonical`, `vaultRelativePosix`, `resolveVaultPath` aligned with `vault-update-frontmatter.ts`); **create path** reuses `link`-based exclusive create from `vault-create-note.ts` with one-shot `EEXIST` fallback to overwrite pipeline.

- [x] **MCP** (AC: 4, 6) — Register `vault_append_daily` in `src/index.ts` with spec-aligned description; JSON success payload.

- [x] **Tests** (AC: 6) — Add `tests/vault-io/vault-append-daily.test.ts`: `vi.useFakeTimers` for deterministic `YYYY-MM-DD`; cases for missing file, existing file, section insertion, secret + PAKE ordering, `PROTECTED_PATH` not applicable to normal daily path (optional: corrupt `AI-Context` test if you add a negative test for a different code path).

- [x] **Audit** (AC: 7) — Defer comment + story reference only.

## Dev Notes

### Architecture compliance

- **Write path:** All mutating IO through WriteGate + atomic temp/rename; no ad hoc append-only `fs.appendFile` that skips PAKE/secrets [Source: `_bmad-output/planning-artifacts/architecture.md` § Implementation patterns].
- **Secret scan scope:** Full serialized note after edit [Source: same file § 5].
- **File layout:** One tool per file `src/tools/vault-append-daily.ts` [Source: same file § Project structure].

### File structure requirements

- **Kebab-case** `vault-append-daily.ts`; wire from `src/index.ts` only.

### Testing requirements

- **Runner:** Vitest; gate: `bash scripts/verify.sh` before marking done.
- **Fixtures:** `fs.mkdtemp` under `os.tmpdir()`; create `DailyNotes/` only when testing create path.

### Previous story intelligence (4-5)

- **Canonical paths:** Mirror `vaultUpdateFrontmatter` opening: `normalizeVaultRelativePosix` is **not** used for a user-supplied path here because the path is **derived**; still compute `posixRel` with `vaultRelativePosix(realRoot, canonicalTarget)` after `resolveWriteTargetCanonical`.
- **PAKE before secrets** on the **final** string is the established invariant to test when both could fail.
- **Atomic write** and temp file naming pattern match update-frontmatter.
- **Audit:** Explicitly deferred to 5-2 with file reference comment.

### Library and framework requirements

- **Existing deps:** `gray-matter`, `zod`, `node:crypto` (`randomUUID`), Node `fs/promises` — same stack as 4-4 / 4-5.

### Latest technical notes

- `@modelcontextprotocol/sdk` registration mirrors `vault_update_frontmatter` in `src/index.ts`.

### Git intelligence summary

- Recent commits are sprint/status and folder-contract work; **no** `vault_append_daily` implementation yet—greenfield file in `src/tools/`.

### Project context reference

- No `project-context.md` in repo; follow `CLAUDE.md` and `specs/cns-vault-contract/AGENTS.md`.

### References

- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_append_daily`]
- [Source: `specs/cns-vault-contract/AGENTS.md` — Daily Notes Format]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.6]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — secret scan, structure, write sequence]
- [Source: `_bmad-output/implementation-artifacts/4-5-vault-update-frontmatter.md` — pipeline patterns, audit deferral]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `vault_append_daily`: existing-file pipeline (WriteGate overwrite → read → body splice + `modified` bump → PAKE → full-note secret scan → atomic rename) and missing-file pipeline (WriteGate create → mkdir → PAKE bootstrap → splice → PAKE → secrets → `link` exclusive create with one-shot `EEXIST` retry into existing branch). MCP registers Zod `vaultAppendDailyInputSchema` with non-whitespace `content` and optional `section`; `safeParse` failures map to `SCHEMA_INVALID` via `callToolErrorFromCns`. Vitest covers create, append-end, PAKE/secret ordering, and schema rejection. `bash scripts/verify.sh` passed.

### File List

- `src/tools/vault-append-daily.ts`
- `src/index.ts`
- `tests/vault-io/vault-append-daily.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-6-vault-append-daily.md`

## Change Log

- 2026-04-02: Story context created (ready-for-dev); sprint status updated.
- 2026-04-02: Story 4.6 implemented; status → review; sprint entry → review.
