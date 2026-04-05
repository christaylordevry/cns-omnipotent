# Story 9.1: Shared PAKE type module for MCP and validation (Epic B — Phase 2.0)

Status: done

<!-- Sprint tracker: epic-9 / 9-1-shared-pake-type-module-for-mcp-and-validation -->

## Summary

Centralized PAKE Standard `pake_type` literals in `src/pake/schemas.ts` as `PAKE_TYPE_VALUES`, `PakeType`, and `pakeTypeSchema`. `register-vault-io-tools.ts` uses `pakeTypeSchema` for `vault_list` and `vault_create_note`; `vault-list.ts` re-exports `PakeType` and `VAULT_LIST_PAKE_TYPES` from the module; `vault-create-note.ts` defines `VaultCreatePakeType` as an alias of `PakeType`.

## Verification

- `bash scripts/verify.sh` passed (2026-04-04).
