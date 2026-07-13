# Vault export — Drive-backed PDF sync (Story 58-3)

Primary Phase C path when `NOTEBOOKLM_DRIVE_DOC_ID` and Google OAuth credentials are configured in `~/.hermes/session-close.env`.

The Drive source is a **Google Drive PDF** (media byte-swap), not a native Google Doc body overwrite. Docs `insertText` was too slow (~134 s on ~1.5 MB) for the ~60 s Hermes budget.

## Preconditions

| Variable | Purpose |
|----------|---------|
| `NOTEBOOKLM_DRIVE_DOC_ID` | Existing Drive **PDF** file ID (overwrite in place — do not auto-create). Env name retained from 58-1. |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth refresh token with `https://www.googleapis.com/auth/drive` scope |

`@googleapis/mcp-server-drive` is **not** required. Hermes uses `write-vault-export-to-drive.mjs` (Playwright md→PDF + Drive `PATCH …?uploadType=media`).

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

- Renders `deterministic.export_path` markdown → `vault-export-for-notebooklm.pdf` (beside the `.md`) via Playwright Chromium (`page.pdf`, extractable text).
- Media-overwrites the same Drive PDF `fileId` (`Content-Type: application/pdf`). Typical wall-clock ≪ 60 s.
- Sync only runs when `steps.drive_write.status === "ok"`.
- Notebooks sync **concurrently** (`Promise.allSettled`); each `nlm` call is bounded by **25 s** (`NLM_EXEC_TIMEOUT_MS`).
- Per notebook (incremental merge under a mutex): `nlm source list <id> --drive --json --skip-freshness` → match cascade:
  1. `drive_doc_id` / id fields / URL parse (`matchDriveSourceByDocId`)
  2. first `type === "google_docs"` (legacy Doc)
  3. `type === "word_doc"` **and** title anchored to `vault-export-for-notebooklm` (PDF; spike-proven payload has no `drive_doc_id` / `url`)
  → `nlm source sync <id> --source-ids <uuid> -y`.
- Each notebook's fan-out row is merged into `.session-close/close-report.json` **immediately** after that notebook settles (ok / failed / timeout) — a mid-phase kill leaves already-finished notebooks stamped.
- Phase markers: `drive_sync_phase.started_at` before notebook work; `drive_sync_phase.finished_at` after all settle (merge into existing phase object). Kill after start leaves `started_at` without `finished_at`.

4. **Legacy mode** (`legacy_fanout_deprecation: true`): when Drive file ID or OAuth missing — use `references/fanout-diagnostics.md` `source_add` loop unchanged.

## close-report fields

| Field | Drive-sync | Legacy |
|-------|------------|--------|
| `notebooklm_fanout_mode` | `drive-sync` | `legacy-source-add` |
| `legacy_fanout_deprecation` | `false` | `true` |
| `steps.drive_write` | `{ status, message }` e.g. `drive pdf overwritten` | omitted |
| `drive_doc_id` / `drive_source_id` on targets | when known | omitted |
| `drive_sync_phase` | `{ started_at, finished_at? }` when sync path entered | omitted |

## error_class

| Class | When |
|-------|------|
| `drive_write_error` | Drive PDF media overwrite failed (all targets failed with this class) |
| `nlm_list_timeout` | `nlm source list` exceeded 25 s (explicit; wins over classifier) |
| `nlm_sync_timeout` | `nlm source sync` exceeded 25 s (explicit; wins over classifier) |
| `unknown` | No matching Drive source in notebook (operator must add PDF titled `vault-export-for-notebooklm` in UI) |
| Others | Sync stderr via `classify-source-add-error.mjs` |

Drive/sync failures are **non-blocking** — session-close continues; auth watchdog still runs.

## Operator migration (Doc → PDF)

1. Upload / host `vault-export-for-notebooklm.pdf` on Drive (or create once; subsequent closes overwrite bytes).
2. In **each** watched NotebookLM notebook: add that PDF as a Drive source (`doc_type=pdf` / UI) with title `vault-export-for-notebooklm` (with or without `.pdf`).
3. **Remove the old `google_docs` vault-export source** before (or immediately when) switching the env ID — matcher order is `drive_doc_id` → first `google_docs` → title-anchored `word_doc`, so a leftover Doc would be synced instead of the PDF while both exist.
4. Set `NOTEBOOKLM_DRIVE_DOC_ID=<pdf-file-id>` in `~/.hermes/session-close.env`.
5. Ensure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` remain set.
6. Restart `hermes-gateway.service`.
7. Run `/session-close` — confirm `fanout_status: ok` and `notebooklm_fanout_mode: drive-sync`.

Watched notebooks (as of 58-3): `981466f0…`, `dc6abf1a…`, `f037c741…`.

## Optional Drive MCP (future)

If `@googleapis/mcp-server-drive` becomes available and OAuth is registered in `~/.hermes/config.yaml`, Hermes may call `mcp__google_drive__*` instead of the REST script. Current production default is REST media upload only.
