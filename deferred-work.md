## Deferred from: code review (58-1-migrate-vault-export-drive-doc-sync.md) (2026-06-03)

- No unit tests for `google-drive-doc-write.mjs` / `runWriteVaultExportToDrive` — REST overwrite path untested; acceptable for operator-migration story but add before relying on Docs API edge cases (large exports, partial delete).

## session-close: replace vault export source instead of adding new one
- **Resolved by Story 58-1** (Drive Doc overwrite + per-notebook sync). Legacy
  `source_add` remains when `NOTEBOOKLM_DRIVE_DOC_ID` / OAuth not configured.

## session-close: show not
