# Vault export — Drive-backed Doc sync (Story 58-1)

Primary Phase C path when `NOTEBOOKLM_DRIVE_DOC_ID` and Google OAuth credentials are configured in `~/.hermes/session-close.env`.

## Preconditions

| Variable | Purpose |
|----------|---------|
| `NOTEBOOKLM_DRIVE_DOC_ID` | Existing Google **Doc** file ID (overwrite only — do not auto-create) |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth refresh token with Docs API scope |

`@googleapis/mcp-server-drive` is **not** required. Hermes uses the repo script `write-vault-export-to-drive.mjs` (Google Docs REST API via OAuth refresh).

## Phase C flow (real close)

1. Read `notebooklm_targets` from `.session-close/close-report.json` only.
2. Record fan-out mode:

```bash
"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-record-notebooklm-fanout-mode.sh"
```

3. **Drive-sync mode** (`notebooklm_fanout_mode: drive-sync`):

```bash
"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-write-vault-export-to-drive.sh"
"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-sync-vault-export-drive.sh"
```

- Overwrites the Doc from `deterministic.export_path` / `export_path`.
- Per notebook: `nlm source list <id> --drive --json --skip-freshness` → match `drive_doc_id` === `NOTEBOOKLM_DRIVE_DOC_ID` → `nlm source sync <id> --source-ids <uuid> -y`.
- After **each** sync result, merge via `hermes-run-merge-notebooklm-fanout.sh` (sync script batches merge internally; optional per-target merge for parity).

4. **Legacy mode** (`legacy_fanout_deprecation: true`): when Doc ID or OAuth missing — use `references/fanout-diagnostics.md` `source_add` loop unchanged.

## close-report fields

| Field | Drive-sync | Legacy |
|-------|------------|--------|
| `notebooklm_fanout_mode` | `drive-sync` | `legacy-source-add` |
| `legacy_fanout_deprecation` | `false` | `true` |
| `steps.drive_write` | `{ status, message }` | omitted |
| `drive_doc_id` / `drive_source_id` on targets | when known | omitted |

## error_class

| Class | When |
|-------|------|
| `drive_write_error` | Drive Doc overwrite failed (all targets failed with this class) |
| `unknown` | No matching Drive source in notebook (operator must add Doc in UI) |
| Others | Sync stderr via `classify-source-add-error.mjs` |

Drive/sync failures are **non-blocking** — session-close continues; auth watchdog still runs.

## Operator migration (manual)

1. Create Google Drive folder `CNS Exports`.
2. Create Google Doc `vault-export-for-notebooklm` in that folder.
3. Add that Doc as a **Drive source** to each watched NotebookLM notebook (UI).
4. Set `NOTEBOOKLM_DRIVE_DOC_ID=<file-id>` in `~/.hermes/session-close.env`.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in the same file.
6. Restart `hermes-gateway.service`.
7. Run `/session-close` — confirm `fanout_status: ok` and `notebooklm_fanout_mode: drive-sync`.

## Optional Drive MCP (future)

If `@googleapis/mcp-server-drive` becomes available and OAuth is registered in `~/.hermes/config.yaml`, Hermes may call `mcp__google_drive__*` instead of the REST script. Current production default is REST only.
