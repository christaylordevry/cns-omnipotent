# Story 9.2: Reject filesystem root as CNS_VAULT_ROOT (Epic B — Phase 2.0)

Status: done

<!-- Sprint tracker: epic-9 / 9-2-reject-filesystem-root-as-cns-vault-root -->

## Summary

`loadRuntimeConfig` in `src/config.ts` calls `assertVaultRootNotFilesystemRoot` after parsing: if `path.resolve(vaultRoot)` equals `path.parse(resolved).root`, startup throws `IO_ERROR` with an operator-facing message (deferred-work: meaningless boundary when root is `/` or drive root).

## Tests

- `tests/vault-io/config.test.ts` — rejects `CNS_VAULT_ROOT` equal to OS filesystem root.

## Verification

- `bash scripts/verify.sh` passed (2026-04-04).
