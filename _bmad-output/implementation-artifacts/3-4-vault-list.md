# Story 3.4: `vault_list`

Status: done

## Story

As an **agent**,  
I want **directory listings with metadata summaries**,  
so that **I can navigate the vault without reading every body**.

## Acceptance Criteria

1. **Given** a directory path under the vault root  
   **When** I call `vault_list`  
   **Then** I receive entries with metadata summaries (name, type, modified time), not full note bodies  
   **And** boundary and IO errors are explicit (FR10).

2. **Given** optional parameters from `CNS-Phase-1-Spec.md` (`recursive`, `filter_by_type`, `filter_by_status`)  
   **When** they are supplied  
   **Then** behavior matches the spec: recursive listing; optional filters use parsed frontmatter on `.md` files only.

## Tasks / Subtasks

- [x] Implement `src/tools/vault-list.ts` (resolve directory, `readdir`, stat per entry, stable JSON shape).
- [x] Register MCP tool `vault_list` in `src/index.ts` with Zod input.
- [x] Vitest: non-recursive listing, recursive, `NOT_FOUND`, `VAULT_BOUNDARY`, file-not-directory, optional filters.

## Dev Agent Record

### Completion Notes

- Output: `{ path, entries: [{ name, vaultPath, type, modified, pake_type?, status? }] }` with ISO 8601 `modified`. Optional `pake_type` / `status` only when readable from frontmatter (`.md` files).
- Filters exclude non-matching `.md` files; directories always included when filters are set.
- `bash scripts/verify.sh` passed after implementation.

### File List

- `src/tools/vault-list.ts`
- `src/index.ts`
- `tests/vault-io/vault-list.test.ts`
- `_bmad-output/implementation-artifacts/3-4-vault-list.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
