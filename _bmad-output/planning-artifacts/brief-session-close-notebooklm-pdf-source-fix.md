# Brief — Session-close NotebookLM fan-out: switch Doc → PDF source (fix `drive_write_error`)

**Status:** Ready for `/bmad-create-story`
**Owner surface:** CNS session-close (`scripts/session-close/`) + Hermes skill (`~/.hermes/skills/cns/session-close/`)
**Diagnosed:** 2026-07-08 (verified live against production credentials)
**Decision:** Operator chose PDF Drive source (durable fix). Interim budget-raise band-aid explicitly rejected.

---

## 1. Problem (what the operator sees)

Every `/session-close` run reports NotebookLM fan-out failure:

```
notebooklm: drive-sync — 3 failed (drive_write_error)
Untitled (981466f0…): failed — error_class: drive_write_error (1493 KB)
Untitled (dc6abf1a…): failed — error_class: drive_write_error (1493 KB)
Untitled (f037c741…): failed — error_class: drive_write_error (1493 KB)
Drive write timed out (60s budget exceeded) — NLM sync skipped this run. Known intermittent.
```

It has been dismissed as "known intermittent." **It is neither known-correctly nor intermittent.**

## 2. Root cause (measured, not inferred)

| Hypothesis | Evidence | Verdict |
|---|---|---|
| OAuth token expired / auth broken | Refresh-token exchange → **HTTP 200**, scope `https://www.googleapis.com/auth/drive`, valid access token | ❌ Not the cause (works today) |
| Intermittent Drive/network error | Fails every run; deterministic | ❌ Not intermittent |
| Export too large for native-Doc write | Export = **1,519,619 chars / 1.49 MB**. `overwriteGoogleDocContent` (Docs API `insertText`, `scripts/session-close/lib/google-drive-doc-write.mjs`) measured at **134 s** to complete. Hermes agent command budget ≈ **60 s** → killed mid-write → `steps.drive_write` never `ok` → `sync-vault-export-drive.mjs` emits `drive_write_error` for all 3 notebooks | ✅ **ROOT CAUSE** |

The `Google OAuth token refresh failed` lines in `~/.hermes/logs/session-close-drive-sync.log` (dates 07-05→07-06) were a **separate, already-fixed** stale-token issue (env rewritten Jul 5 21:29). Two distinct failures were blurred into one "known issue," which is why band-aids never held.

**Why now:** as the vault grew, the export crossed the ~60 s conversion threshold. It now fails every run and worsens weekly.

**Bottleneck is size × native-Doc conversion.** Confirmed the API method is not the lever: Drive media upload of the same bytes *also* exceeded 120 s because Google still server-side-converts markdown → native Doc.

## 3. Constraint that dictates the fix

NotebookLM live Drive-sync (`source_sync_drive`) accepts only these Drive source types — from the `source_add` schema `doc_type: doc | slides | sheets | pdf`. Plain `.md`/`.txt` uploads become **one-time file copies, not re-syncable sources**. Verified on notebook `981466f0`: its only `drive_sources` entry is `type: "google_docs"`.

Of the four syncable types, **PDF is the only binary one** → overwriting it is a raw byte-swap via Drive `files.update?uploadType=media` = **seconds, no conversion, future-proof at any vault size**. This is the chosen fix.

## 4. Scope of change

| File | Change |
|---|---|
| `scripts/session-close/lib/google-drive-doc-write.mjs` | Replace Docs-API `insertText` overwrite with Drive **media update** (`PATCH /upload/drive/v3/files/{id}?uploadType=media`, `Content-Type: application/pdf`). Reuse existing OAuth refresh (it works). |
| **New:** md→PDF render step | Render `scripts/output/vault-export-for-notebooklm.md` → PDF with **extractable text**. Use already-installed Playwright/Chromium (`~/.cache/ms-playwright`) print-to-PDF (md → minimal HTML → `page.pdf()`). Playwright is years-old → clears the 14-day-package rule. |
| `scripts/session-close/write-vault-export-to-drive.mjs` | Call the PDF render + media upload instead of Doc overwrite. |
| `scripts/session-close/sync-vault-export-drive.mjs` (~line 94) | Filter `source.type !== "google_docs"` must also accept the PDF Drive source type; matches on `drive_doc_id`. |
| `~/.hermes/skills/cns/session-close/references/drive-export-sync.md` | Update `doc_type`/mechanism docs. |
| `~/.hermes/session-close.env` | `NOTEBOOKLM_DRIVE_DOC_ID` → the PDF file's Drive ID (operator sets during migration). |

## 5. Acceptance criteria

- **AC#1 — Spike first, then STOP for operator confirmation.** Prove a PDF Drive source round-trips: create a test PDF on Drive, add to a scratch notebook via `source_add(source_type=drive, doc_type=pdf)`, overwrite bytes via media update, confirm `source_list_drive` shows it syncable and `source_sync_drive` refreshes to new content. Report timing. **If PDF re-sync fails, stop and report** (fallback: raise drive-write command budget to 240 s as interim only).
- **AC#2 — md→PDF render** produces extractable-text PDF from the 1.5 MB export via Playwright/Chromium. No new package < 14 days old. Confirm renderer via Context7 first.
- **AC#3 — Fast upload:** media update overwrites the PDF in place (same fileId), completes **well under 60 s** for 1.5 MB.
- **AC#4 — Sync path** accepts PDF drive sources; end-to-end drive-sync reports `fanout_status: ok`, `notebooklm_fanout_mode: drive-sync`.
- **AC#5 — Verify gate:** `bash scripts/verify.sh` passes.

## 6. Operator one-time migration (after AC#1 spike passes)

The three watched notebooks — `981466f0-de1c-4551-93a9-f3bc2a24b184`, `dc6abf1a-99d2-428d-af63-107591ff2c2e`, `f037c741-f7e1-4a90-880f-d2d38986767b`:
1. Create/host `vault-export-for-notebooklm.pdf` on Drive; set its file ID in `~/.hermes/session-close.env` (`NOTEBOOKLM_DRIVE_DOC_ID`).
2. In each notebook: add the PDF as a Drive source; remove the old `google_docs` source once the PDF syncs.
3. Restart `hermes-gateway.service`; run `/session-close`; confirm `fanout_status: ok`.

## 7. Immediate unblock (no code needed)

The 134 s Doc write *succeeds* when uninterrupted — a diagnostic run on 2026-07-08 already wrote the current export into the existing Doc (`1_UbhuhLj1uPcscFy5DdfMJL_W21KlmvfsOCNb3815h4`). Re-running only the NotebookLM **sync** step will push it to the 3 notebooks without another write.

## 8. Non-negotiables (CLAUDE.md)

Spec-first (`specs/cns-vault-contract/`) · Context7 before renderer/Drive API · small commits · no package < 14 days old · never edit `AI-Context/AGENTS.md` directly · `bash scripts/verify.sh` green before commit.
