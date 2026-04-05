# Story 4.3: Secret pattern scanning

Status: done

## Story

As an **agent**,  
I want **writes rejected when content matches configured credential patterns**,  
so that **the vault does not become a secret store**.

## Acceptance Criteria

1. **Given** `config/secret-patterns.json` and optional vault override merge  
   **When** body or frontmatter string values match a pattern on create/update/append (full note text is scanned, which includes YAML and body)  
   **Then** the write path receives **`SECRET_PATTERN`** and the error does **not** echo the matched secret  
   **And** application scope matches architecture (full note text covering body + frontmatter region) (FR19, NFR-S2, FR21).

2. **Given** baseline patterns ship in the implementation repo  
   **When** `{vaultRoot}/_meta/schemas/secret-patterns.json` exists  
   **Then** its patterns are **merged after** baseline (append-only; baseline rules always remain in effect).

## Tasks / Subtasks

- [x] **Error contract** — Add **`SECRET_PATTERN`** to `ErrorCode` in `src/errors.ts` before scanner logic (same pattern as `SCHEMA_INVALID` / `PROTECTED_PATH`).
- [x] **Versioned config** — Add `config/secret-patterns.json` at repo root with conservative baseline patterns (OpenAI-style keys, AWS access key id shape, GitHub PAT, Slack bot token).
- [x] **Repo root resolution** — `src/implementation-root.ts` resolves Omnipotent.md root for `config/` (works from `src/` and emitted `dist/` layout).
- [x] **`src/secrets/`** — `pattern-config.ts` (Zod), `load-patterns.ts` (baseline + vault merge, `ENOENT` on vault override = baseline only), `scan.ts` (`assertContentMatchesNoSecretPatterns`, `assertVaultWriteContentNoSecretPatterns`).
- [x] **Tests** — `tests/vault-io/secret-scan.test.ts`: no echo of secret in message; baseline load; vault merge; AWS-like hit; PAT inside YAML frontmatter string.
- [x] **Scope** — Do **not** wire into `vault_create_note` yet (Story 4.4); mutators call `assertVaultWriteContentNoSecretPatterns` after WriteGate + PAKE when implemented.

## Dev Notes

- **Details on match:** `details.patternId` only; never matched substring in `message` or `details`.
- **Regex compile errors:** `IO_ERROR` with `patternId` where applicable (invalid operator vault override).
- **References:** `architecture.md` §5 Secret pattern scanning; `specs/cns-vault-contract/modules/security.md`.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Code review (handoff)

- **`getImplementationRepoRoot`:** Uses `import.meta.url` + one `..` segment so the root is the **module file’s** parent directory (`src/` → repo root, or `dist/` → repo root). **Independent of `process.cwd()`**, so MCP/CLI invoked from an arbitrary working directory still resolves `config/secret-patterns.json` correctly (verified with Node URL resolution semantics).
- **Malformed vault override:** Invalid JSON or Zod-invalid shape throws **`IO_ERROR`**; only **`ENOENT`** on the override file falls back to baseline-only (`load-patterns.ts`). Tests lock this so silent “protected when it isn’t” cannot regress.
- **No echo:** Errors use fixed copy + `details.patternId` only; tests assert no matched material in `message` / `details` (including YAML-embedded PAT and merged vault pattern).

### Completion Notes List

- `SECRET_PATTERN` added to `errors.ts`; `callToolErrorFromCns` already forwards any code.
- Scan runs on the **entire note string**, which satisfies “body + frontmatter strings” without separate YAML walking.
- Vault override path: `_meta/schemas/secret-patterns.json` (merged after baseline).

### File List

- `src/errors.ts` (modified)
- `src/implementation-root.ts` (new)
- `src/secrets/pattern-config.ts` (new)
- `src/secrets/load-patterns.ts` (new)
- `src/secrets/scan.ts` (new)
- `config/secret-patterns.json` (new)
- `tests/vault-io/secret-scan.test.ts` (new)
- `_bmad-output/implementation-artifacts/4-3-secret-pattern-scanning.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-04-02: Implemented Story 4.3 secret pattern scanning; sprint status `review`.
- 2026-04-02: Code review + test hardening (malformed override, no-secret-in-message for YAML + merge); sprint status `done`.
