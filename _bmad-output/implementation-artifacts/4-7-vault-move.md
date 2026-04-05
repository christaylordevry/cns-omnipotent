# Story 4.7: `vault_move`

Status: done

**Spec binding:** This file is the binding acceptance spec for the `vault_move` implementation in this repo. Normative tool behavior and security policy remain `specs/cns-vault-contract/CNS-Phase-1-Spec.md` and `specs/cns-vault-contract/modules/`; where they differ, reconcile by updating this story or the spec—do not ship unstoryed behavior.

<!-- Read this story end-to-end before moving sprint-status to in-progress for 4-7. -->

## Story

As an **agent**,  
I want **to move or rename notes preserving backlinks when Obsidian CLI is available**,  
so that **wiki links stay coherent**.

## Acceptance Criteria

### AC1 — WriteGate and existence (both endpoints, explicit)

**Given** vault-relative `source_path` and `destination_path` per Phase 1 spec  

**When** `vault_move` begins validation (before any mutation)  

**Then** all of the following hold, with ordering documented in code and enforced by tests where practical:

1. **Source**
   - Resolve `source_path` through the same vault path pipeline as other Epic 4 write tools (`resolveVaultPath`, canonical resolution / `realpathSync` patterns consistent with `src/write-gate.ts` and `src/paths.js`).
   - The source must **exist** as a **file** (not a directory). If it does not exist, fail with **`NOT_FOUND`** (or the repo’s equivalent explicit code). Do not treat a missing source as an IO generic error only.
   - The source must lie **within the vault boundary** after canonical resolution; use the same boundary rules as existing tools (`VAULT_BOUNDARY` on escape).
   - Call **`assertWriteAllowed`** on the resolved **source** absolute path with **`operation: "rename"`** (or the gate operation this repo defines for “remove from this path as part of a move”; must match `WriteOperation` in `src/write-gate.ts`).

2. **Destination**
   - Resolve `destination_path` the same way.
   - Call **`assertWriteAllowed`** on the resolved **destination** absolute path with **`operation: "create"`**, so **protected-path and policy rules match `vault_create_note`** for landing a file at that path (same choke point as a create into that directory). Parent directory semantics: if the implementation requires the parent to exist, fail with a clear **`IO_ERROR`**; do not implicitly create disallowed trees without matching create-tool policy.

**Rationale:** Source and destination both need gate checks; destination is a governed “landing” and must not bypass create-equivalent protections.

### AC2 — PAKE at destination (fail closed)

**Given** the file to be moved (read from source before relocate)  

**When** the resolved **destination** vault-relative path (POSIX, stable string used elsewhere) is **not** exempt under existing PAKE path rules  

**Then** parse frontmatter from the **current** file body (e.g. `parseNoteFrontmatter`) and run **`validatePakeForVaultPath(destinationVaultRelativePosix, frontmatter)`** — validation is keyed off the **destination** path, not the source path, so a note moved out of `00-Inbox/` into a governed tree cannot land non-compliant.

**And** if validation throws, the move **does not** occur (**`SCHEMA_INVALID`** / existing mapping); never leave a non-compliant note in a governed directory.

**And** when the destination is under **`00-Inbox/`** (or other PAKE-exempt paths per `src/pake/validate.ts` / `path-rules.ts`), PAKE validation follows those same exemptions.

### AC3 — Atomic file relocation, no clobber

**Given** validation through AC1–AC2 has passed  

**When** performing the **filesystem fallback** move (when Obsidian CLI is not used or fails)  

**Then** the **primary note file** is placed at the destination using a **single `rename`** (Node: `fs.promises.rename` or sync equivalent) from the canonical source file to the canonical destination file path — **not** copy-then-delete.

**And** if the destination file already exists, **`rename` must fail** with **`EEXIST`** (or equivalent); map to an explicit **`IO_ERROR`** (or dedicated code if the repo adds one) with a clear “destination already exists” message — **never overwrite** an existing destination file.

**And** if the platform returns **`EXDEV`** (cross-device move), do **not** silently degrade to copy-delete; fail with explicit **`IO_ERROR`** and document that Phase 1 requires source and destination on the same filesystem for atomic rename (aligned with `vault_create_note` same-volume expectations in `specs/cns-vault-contract/modules/security.md`).

**Obsidian CLI path:** When `CNS_OBSIDIAN_CLI` is used and succeeds, CLI behavior governs backlink preservation; still enforce AC1–AC2 **before** invoking the CLI. If CLI fails, fallback must obey the rename / EEXIST / EXDEV rules above.

### AC4 — `modified` timestamp

**Given** successful relocation of a note with YAML frontmatter  

**When** the implementation owns the final file content (fallback path, or CLI path if CLI does not update `modified`)  

**Then** update **`modified`** to the move date (`YYYY-MM-DD`) per `specs/cns-vault-contract/modules/vault-io.md`, consistent with other mutators.

### AC5 — Wikilink fallback (after atomic move)

**Given** filesystem fallback  

**When** the primary `rename` succeeds  

**Then** run the **limited vault wikilink rewrite** per architecture (`_bmad-output/planning-artifacts/architecture.md` §7): document limitations (embeds, aliases, non-markdown). Each **additional file touched** by the rewriter must go through **WriteGate** (and any other gates required for that tool class) before writing.

**Note:** AC3 atomicity applies to the **moved note file**; wikilink updates are separate writes and may run after rename (document ordering and failure behavior: e.g. move succeeded but link repair failed — surface clearly).

### AC6 — Audit log (this story; both paths + timestamp + surface)

**Given** a move completes successfully (CLI or fallback)  

**When** recording audit  

**Then** append **one line** to `_meta/logs/agent-log.md` using **`purpose: "audit-append"`** and **`operation: "append"`** on that file per `assertWriteAllowed`, so the log remains the single append-only sink.

**And** the line MUST include all of the following in a stable, documented format (align field names with `_bmad-output/planning-artifacts/architecture.md` §8 when compatible):

- **Source** vault-relative path (POSIX)
- **Destination** vault-relative path (POSIX)
- **ISO8601 timestamp**
- **surface** (MCP request metadata when available; else `unknown`)

**Rationale:** Both paths are required to diagnose misroutes; a single target-only field is insufficient for moves.

If Epic 5.1 later tightens the global line grammar, refactor this append to the shared AuditLogger without dropping source/destination from the payload.

### AC7 — MCP, errors, tests

**Given** the MCP server  

**When** `vault_move` is registered  

**Then** Zod validates `source_path` and `destination_path`; errors use **`callToolErrorFromCns`**.

**And** tests cover: happy fallback rename in a temp vault; **destination already exists** → non-zero / `IO_ERROR`; **missing source** → `NOT_FOUND`; **PROTECTED_PATH** on destination (e.g. `AI-Context/`); **VAULT_BOUNDARY**; **PAKE invalid** when moving into a governed path from Inbox with bad frontmatter; **audit append** called on success with both paths (assert on log content or mock).

### AC8 — Config / Obsidian (unchanged intent)

**Given** optional **`CNS_OBSIDIAN_CLI`**  

**When** set and executable  

**Then** attempt Obsidian CLI move per architecture; exact argv from CLI help, documented in code comments.

---

## Tasks / Subtasks

- [x] **AC1** — Dual WriteGate + source existence + destination `create`-equivalent operation.
- [x] **AC2** — Read source body → `validatePakeForVaultPath` with **destination** `vaultRelativePosix`.
- [x] **AC3** — Fallback: single `rename`, EEXIST → loud failure, EXDEV → explicit failure (no copy-delete).
- [x] **AC4** — Bump `modified` when applicable.
- [x] **AC5** — Wikilink pass + per-file WriteGate for touched notes.
- [x] **AC6** — Implement audit append for `vault_move` (both paths, timestamp, surface); do not defer this story’s move auditing to Epic 5.2.
- [x] **AC7** — Register tool + tests + `bash scripts/verify.sh`.

---

## Epic 4 closure checklist (do not skip)

- **4-9 / sprint-status drift:** After **4-7** and **4-8** are **done**, before **Epic 4 retrospective**, reconcile **`sprint-status.yaml`** with the **actual** state of the **`4-9-canonical-read-boundary-hardening`** artifact (and code): if implementation exists ahead of tracking, set story status to **`done`** or **`review`** as appropriate; if the artifact is planning-only, keep **`backlog`** or **`ready-for-dev`** consistently. Do **not** close Epic 4 with YAML contradicting the repo.

---

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` §7–§8] CLI vs fallback; audit line shape.
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_move`]

### File structure

- `src/tools/vault-move.ts`; register in `src/index.ts`.

### Previous story intelligence

- **4.4:** Exclusive create uses temp + `link` + EEXIST; this story uses **rename** semantics for move (different primitive, same “no clobber” intent).
- **4.1–4.2:** `assertWriteAllowed`, `validatePakeForVaultPath`, `vaultRelativePosix`, `resolveWriteTargetCanonical`.

### References

- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_move`]
- [Source: `specs/cns-vault-contract/modules/vault-io.md` — Moving and Renaming]
- [Source: `specs/cns-vault-contract/modules/security.md` — same-filesystem / hard link notes (analogy for EXDEV policy)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.7]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR27]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Code review (2026-04-02)

Adversarial pass bound to this story + `vault_move` implementation. Wikilink partial-repair, CLI verification, EXDEV messaging, and audit line shape reviewed; no changes required for merge. See Completion Notes for reviewer-flag answers.

### Debug Log References

### Completion Notes List

- Implemented `vault_move` in `src/tools/vault-move.ts` with documented validation order (AC1), PAKE keyed to destination (AC2), `rename` fallback with EEXIST/EXDEV handling (AC3), `modified` bump via temp+rename after move (AC4), vault-wide wikilink repair with per-file WriteGate + PAKE + secret scan (AC5), audit line to `_meta/logs/agent-log.md` via `audit-append`/`append` (AC6).
- Optional Obsidian CLI: `obsidian move path=<src> to=<dst> silent` when `CNS_OBSIDIAN_CLI` is set; non-zero exit falls back to filesystem rename.
- Added `src/tools/wikilink-repair.ts` and tests in `tests/vault-io/vault-move.test.ts`; extended `loadRuntimeConfig` with `obsidianCliPath`.

### File List

- `src/config.ts`
- `src/index.ts`
- `src/tools/vault-move.ts`
- `src/tools/wikilink-repair.ts`
- `tests/vault-io/vault-move.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-7-vault-move.md`

## Change Log

- 2026-04-02: Story 4-7 implemented — `vault_move` MCP tool, wikilink repair helper, audit append, tests, verify.sh green.
- 2026-04-02: Spec binding recorded; code review clean; status → done.
