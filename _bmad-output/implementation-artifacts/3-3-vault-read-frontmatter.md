# Story 3.3: `vault_read_frontmatter`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **agent**,  
I want **parsed frontmatter for one or many paths**,  
so that **I can scan metadata without loading entire bodies**.

## Acceptance Criteria

1. **Given** valid markdown files with optional YAML frontmatter under the vault root  
   **When** I call `vault_read_frontmatter` with one path or multiple paths (allowed vault-relative paths)  
   **Then** I receive structured frontmatter data per path (empty object when no `---` block)  
   **And** the MCP response shape is stable and easy for agents to consume.

2. **Given** boundary or filesystem failures  
   **When** a path escapes the vault, is missing, is a directory, or cannot be read  
   **Then** errors follow the MCP error contract (`VAULT_BOUNDARY`, `NOT_FOUND`, `IO_ERROR` as appropriate) per architecture §9  
   **And** behavior aligns with FR9 and Story 3.2 patterns.

3. **Given** a file that has a `---` fenced block but invalid YAML  
   **When** the parser cannot parse frontmatter  
   **Then** the tool fails with a clear `IO_ERROR` (or a dedicated parse error if you add a new `ErrorCode` consistently in `errors.ts` + architecture alignment) and does not return partial silent success.

## Tasks / Subtasks

- [x] **Dependency** (AC: 1)
  - [x] Add `gray-matter` (architecture §4: Parser) for split + YAML parse; pin in `package.json`.

- [x] **Core module** (AC: 1–3)
  - [x] Add `src/tools/vault-read-frontmatter.ts` (or `parse-frontmatter.ts` + thin tool wrapper per architecture tree): reuse `resolveVaultPath` + read file like `vaultReadFile`, then `matter()` to obtain `.data` as plain object.
  - [x] Support **either** `path: string` **or** `paths: z.array(z.string().min(1)).min(1)` in Zod; reject if both/neither (use `.superRefine` or two schemas / discriminated union).
  - [x] Return **JSON as MCP text content** with a single predictable shape, e.g. `{ results: Array<{ path: string, frontmatter: Record<string, unknown> }> }` (always use `results` even for one path).

- [x] **Register MCP tool** (AC: 1–2)
  - [x] In `src/index.ts`, register tool name exactly `vault_read_frontmatter` with Zod-validated input.
  - [x] Success: `content: [{ type: "text", text: JSON.stringify(...) }]`.
  - [x] Errors: `callToolErrorFromCns` + `CnsError` like `vault_read`.

- [x] **Tests** (AC: 1–3)
  - [x] Vitest: happy path single path; multiple paths; empty/missing frontmatter → `{}`; `NOT_FOUND`; `VAULT_BOUNDARY`; directory → `IO_ERROR`; invalid YAML in frontmatter → failure path.

## Dev Notes

- **Reuse:** Mirror `src/tools/vault-read.ts` for path resolution and errno mapping before parsing.
- **Read policy:** Same as 3.2: vault boundary only; no read blocklist in Phase 1 unless a later story adds it.
- **PAKE validation:** This story parses YAML only; **do not** run PAKE schema validation here (Epic 4). Invalid YAML is a parse/IO concern, not `SCHEMA_INVALID`.
- **References:** `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (`vault_read_frontmatter`); `_bmad-output/planning-artifacts/architecture.md` (§4 PAKE parser note, §9 MCP errors, suggested file `src/tools/vault-read-frontmatter.ts`).

### Project Structure Notes

- Follow existing ESM imports (`.js` suffix), `kebab-case.ts` under `src/tools/`.
- Colocate tests in `tests/vault-io/vault-read-frontmatter.test.ts` next to `vault-read.test.ts`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3 / Story 3.3]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — Tool Definitions → `vault_read_frontmatter`]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — §4 Parser, §9 MCP tool error contract]
- [Source: `_bmad-output/implementation-artifacts/3-2-vault-read.md` — prior tool patterns and file list]

### Previous story intelligence (3.2)

- `vault_read` lives in `src/tools/vault-read.ts`; registers in `src/index.ts` with Zod `path`.
- Errors use `CnsError` + `callToolErrorFromCns`; codes include `NOT_FOUND`, `IO_ERROR`, `VAULT_BOUNDARY`.
- Tests use temp dirs + Vitest; verify gate is `bash scripts/verify.sh`.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

- `npm run typecheck`
- `npm run test:vitest`
- `bash scripts/verify.sh`

### Completion Notes List

- Added `gray-matter` and `vaultReadFrontmatter()` which reads via `vaultReadFile` then parses; invalid YAML throws `IO_ERROR` with path in details.
- Registered `vault_read_frontmatter` with Zod: exactly one of `path` or `paths`; JSON response `{ results: [...] }`.

### File List

- `package.json` / `package-lock.json` (gray-matter)
- `src/tools/vault-read-frontmatter.ts`
- `src/index.ts`
- `tests/vault-io/vault-read-frontmatter.test.ts`

### Change Log

- 2026-04-02: Story created (bmad-create-story) for `3-3-vault-read-frontmatter`.
- 2026-04-02: Implemented `vault_read_frontmatter` MCP tool, tests, verify green; story **done**.
