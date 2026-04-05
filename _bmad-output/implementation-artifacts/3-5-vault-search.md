# Story 3.5: `vault_search`

Status: done

## Story

As an **agent**,  
I want **scoped full-text search with a hard result cap**,  
so that **I can find content without full-vault scans on WSL**.

## Acceptance Criteria

- `query` + `scope` when `CNS_VAULT_DEFAULT_SEARCH_SCOPE` is unset; default scope from env when set.
- At most **50** hits per call; literal substring match (fixed-string), `*.md` only.
- Respects vault root **`.gitignore`** (via `ignore` + Node walk; ripgrep uses its own ignore rules from vault cwd).
- Excludes **`_meta/logs/`** unless scope is `_meta/logs` or nested under it.
- ripgrep used when `rg` is on `PATH`; otherwise Node scanner (architecture §6).

## Implementation notes

- **`UNSUPPORTED`** when neither `scope` nor `CNS_VAULT_DEFAULT_SEARCH_SCOPE` is set.
- **`forceNodeScanner`** on `vaultSearch()` for tests only (not exposed on MCP tool).
- Output JSON: `{ query, scope, hits: [{ path, matched_snippet, frontmatter_summary }] }`.

## File List

- `src/errors.ts` (`UNSUPPORTED`)
- `src/config.ts` (`defaultSearchScope` from `CNS_VAULT_DEFAULT_SEARCH_SCOPE`)
- `src/tools/vault-search.ts`
- `src/index.ts`
- `tests/vault-io/vault-search.test.ts`
- `tests/vault-io/config.test.ts`
- `package.json` / `package-lock.json` (`ignore`)

## Verification

`bash scripts/verify.sh` passed.
