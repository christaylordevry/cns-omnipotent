---
story_id: 42-4
epic: 42
planning_epic: "Epic 42 / internal Epic 1 Story 1.4"
title: sync-push-secret-guard-hermes-cron
status: done
output_repo: none
cns_repo_touch: scripts/dashboard-sync.ts, scripts/install-dashboard-sync-cron.sh
---

# Story 42.4: Sync push, secret guard, and Hermes cron

Status: done

**Planning map:** Epic 42 Story 1.4 — `42-4-sync-push-secret-guard-hermes-cron`.

## Story

As an **operator**,
I want **successful snapshot pushes to Convex on a 3-minute schedule with secret scanning and visible failures**,
so that **dashboard data stays fresh and unsafe payloads never reach Convex**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | **None** — CNS repo only |
| **CNS repo touch** | `scripts/dashboard-sync.ts` (+ cron install helper) |
| **Depends on** | 42-2 ingest mutation, 42-3 collectors |
| **Out of scope** | Dashboard panels (Epic 42.2), run-chain `error` signal (42-4+ / deferred) |

## Acceptance Criteria

1. **Secret guard (AC: secret)** — Before push, serialized snapshot is scanned with `config/secret-patterns.json` (+ vault override merge). On match: non-zero exit, stderr with `patternId` only, **no** `ingestDashboardSnapshot` call.
2. **Push (AC: push)** — When clean and `CONVEX_URL` + `CONVEX_DEPLOY_KEY` set, POST `ingestDashboardSnapshot` via Convex HTTP `/api/mutation` + `Authorization: Convex <key>` (no new npm deps). On HTTP/Convex error: push snapshot with `syncMetadata.lastSyncStatus: "error"` and `lastSyncError`, then non-zero exit.
3. **Cron (AC: cron)** — `scripts/install-dashboard-sync-cron.sh` documents/installs `*/3 * * * *` user crontab invoking `npx tsx scripts/dashboard-sync.ts` with env from `~/.hermes/dashboard-sync.env`; failures log to `~/.hermes/logs/dashboard-sync.log`.
4. **Tests (AC: test)** — Vitest covers secret abort, push request shape, error metadata path; `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Secret scan + `pushDashboardSnapshot` via fetch (AC: secret, push)
- [x] Wire CLI: push when Convex env set; `--json` / `--no-push` collect-only (AC: push)
- [x] `install-dashboard-sync-cron.sh` (AC: cron)
- [x] Vitest + verify.sh (AC: test)
- [x] Standing task: Operator guide — deferred; install script + `~/.hermes/dashboard-sync.env` document env (session-close / manual guide row)

## Dev Notes

- Mutation path: `dashboard:ingestDashboardSnapshot`, args `{ snapshot }`.
- [Source: Convex HTTP API — POST `/api/mutation`, `Authorization: Convex <deploy_key>`]
- [Source: `src/secrets/scan.ts`, `load-patterns.ts`]
- Run-chain `"error"` state: reserved (Story 42-3 review decision B).

### References

- [Source: `_bmad-output/planning-artifacts/epics-epic-42-cns-dashboard.md` Story 1.4]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-42-cns-dashboard.md` C1, I5]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Completion Notes List

- `pushDashboardSnapshot`: Convex HTTP `POST /api/mutation`, `Authorization: Convex <deploy_key>`, path `dashboard:ingestDashboardSnapshot`.
- Pre-push secret scan via `loadMergedSecretPatterns` + `findFirstMatchingSecretPatternId` on JSON snapshot; abort exit 1 without mutation.
- On push failure: best-effort second push with `syncMetadata` error fields, then exit 1.
- CLI pushes when `CONVEX_URL` + `CONVEX_DEPLOY_KEY` set; `--json` and `--no-push` skip push.
- `scripts/install-dashboard-sync-cron.sh`: WSL crontab `*/3`, logs `~/.hermes/logs/dashboard-sync.log`, env file `~/.hermes/dashboard-sync.env`.
- 18 dashboard-sync Vitest tests; verify.sh green (637 tests).
- **Operator guide:** add cron/env subsection via session-close (not edited in this story).

### File List

- `scripts/dashboard-sync.ts`
- `scripts/install-dashboard-sync-cron.sh`
- `tests/vault-io/dashboard-sync.test.ts`
- `_bmad-output/implementation-artifacts/42-4-sync-push-secret-guard-hermes-cron.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Story created; implementation started.
- 2026-05-24: Push, secret guard, cron installer, tests — ready for review.
- 2026-05-24: Code review — 3 decision-needed, 9 patch, 6 defer, 6 dismissed.
- 2026-05-24: Review decisions — D1:A keep `dashboard-sync.env` (AC updated); D2:A exit 1 when env file present but Convex keys empty; D3:B document `--json` as operator debug (no scan).
- 2026-05-24: Code review patches applied — secret re-scan on error push, fetch timeout, cron quoting, vault validation, tests; verify.sh green (642 tests).

### Review Findings

- [x] [Review][Decision→Patch] Cron env source — **D1:A** Keep `~/.hermes/dashboard-sync.env`; AC #3 updated to match.
- [x] [Review][Decision→Patch] Missing Convex env exits 0 — **D2:A** Exit 1 when `dashboard-sync.env` exists but `CONVEX_URL`/`CONVEX_DEPLOY_KEY` empty.
- [x] [Review][Decision→Patch] `--json` not secret-scanned — **D3:B** Document as operator-only debug mode; no scan on stdout.
- [x] [Review][Patch] Re-scan error snapshot before second push [`scripts/dashboard-sync.ts:636-638`]
- [x] [Review][Patch] Quote paths in cron line [`scripts/install-dashboard-sync-cron.sh:24`]
- [x] [Review][Patch] Add fetch timeout on Convex push [`scripts/dashboard-sync.ts:551-574`]
- [x] [Review][Patch] Guard `response.json()` parse failures [`scripts/dashboard-sync.ts:570`]
- [x] [Review][Patch] Log when error-metadata push fails (don't empty catch) [`scripts/dashboard-sync.ts:637-641`]
- [x] [Review][Patch] Add test for HTTP 4xx/5xx push failure path [`tests/vault-io/dashboard-sync.test.ts`]
- [x] [Review][Patch] Assert two fetch calls + successful error ingest in mutation-failure test [`tests/vault-io/dashboard-sync.test.ts`]
- [x] [Review][Patch] Validate `CNS_VAULT_ROOT` trim + path exists [`scripts/dashboard-sync.ts:651-656`]
- [x] [Review][Patch] Remove hardcoded operator vault path from env template [`scripts/install-dashboard-sync-cron.sh:16`]
- [x] [Review][Patch] Truncate `lastSyncError` to safe max length [`scripts/dashboard-sync.ts:584-596`]
- [x] [Review][Defer] Log rotation for `dashboard-sync.log` — deferred, operational hardening out of story scope
- [x] [Review][Defer] Crontab install race without file locking — deferred, low-frequency operator action
- [x] [Review][Defer] Re-chmod existing `dashboard-sync.env` on reinstall — deferred, operator hygiene
- [x] [Review][Defer] NFR-P5 ≤60s sync benchmark on 118+ note vault — deferred, no perf harness in story AC
- [x] [Review][Defer] `flock` guard for overlapping 3-min cron runs — deferred, enhancement beyond AC
- [x] [Review][Defer] Automated tests for `install-dashboard-sync-cron.sh` — deferred, shell installer manual validation
