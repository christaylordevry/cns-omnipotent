---
story_id: 44-2-2
epic: 44
planning_epic: "Epic 44 / Epic 2 Story 2.2"
title: trend-ingest-http-push-secret-guard
status: done
output_repo: Omnipotent.md
cns_repo_touch: scripts/trend-ingest.py
---

# Story 44-2-2: HTTP push to ingestSignalBatch with secret guard

Status: done

**Planning map:** Epic 44 Story 2.2 — `44-2-2-trend-ingest-http-push-secret-guard`.

## Story

As a **CNS operator**,
I want **successful batches pushed to production Convex with the same auth pattern as dashboard-sync**,
So that **trend ingest reuses proven transport without new npm dependencies**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `Omnipotent.md` (`scripts/trend-ingest.py` + tests) |
| **Depends on** | 44-2-1 (batch builder + dry-run), 44-1-2 (`trends:ingestSignalBatch`) |
| **Normative** | `architecture-epic-44-trend-intelligence-layer-1.md` § Wire Contract, I5, C1 |
| **Reference** | `scripts/dashboard-sync.ts` (`pushDashboardSnapshot`, secret scan) |
| **Out of scope** | Collectors (Epic 44 Epic 3), `dashboard-sync.ts` edits |

## Acceptance Criteria

1. **HTTP push (AC: http)** — Without `--dry-run`, POST `{CONVEX_URL}/api/mutation` with path `trends:ingestSignalBatch`, `Authorization: Convex {CONVEX_DEPLOY_KEY}`, body `{ path, args: { batch }, format: "json" }` (camelCase batch).
2. **Env (AC: env)** — `CONVEX_URL` and `CONVEX_DEPLOY_KEY` from `~/.hermes/trend-ingest.env` only; missing on push → non-zero exit (dry-run: warn only, per 44-2-1).
3. **Secret guard (AC: secret)** — Scan serialised batch JSON against `config/secret-patterns.json` before HTTP; match → stderr pattern id, exit 1, no request.
4. **Partial run (AC: partial)** — HTTP success with empty `events` but valid batch (e.g. watchlist-only) → exit 0.
5. **Tests (AC: test)** — Extend `tests/test_trend_ingest.py` with push request shape, secret abort, env required, mocked success/failure.
6. **Boundary (AC: boundary)** — `bash scripts/verify.sh` passes; `dashboard-sync.ts` untouched.

## Tasks / Subtasks

- [x] Add secret-pattern loader + scan (repo `config/secret-patterns.json`)
- [x] Add `push_signal_batch` (stdlib HTTP, dashboard-sync mirror)
- [x] Wire `run()` for production push; require env on push
- [x] Extend unit tests; run unittest + verify.sh
- [x] Update sprint-status to `review`

### Review Findings

- [x] [Review][Patch] AC test gap — no mocked Convex failure path [`tests/test_trend_ingest.py`] — added HTTPError, non-2xx, `status: error`, unexpected status, and CLI push failure tests.
- [x] [Review][Patch] Missing secret-patterns file crashes push path [`scripts/trend-ingest.py`] — `load_secret_patterns` raises `ValueError`; `run()` maps to FATAL + exit 1.
- [x] [Review][Patch] Convex error detail dropped on unexpected status [`scripts/trend-ingest.py`] — surfaces `errorMessage` on non-success status (dashboard-sync mirror).
- [x] [Review][Patch] Empty compiled pattern list disables secret guard [`scripts/trend-ingest.py`] — `load_secret_patterns` requires ≥1 valid compiled pattern.
- [x] [Review][Defer] Python unittest not in verify.sh gate [`scripts/verify.sh`] — pre-existing from 44-2-1; npm-only gate still passes; manual `python3 -m unittest tests.test_trend_ingest` required.

## Dev Agent Record

### Completion Notes List

- Extended `scripts/trend-ingest.py`: `scan_batch_for_secret_pattern_id`, `push_signal_batch` (urllib), production path in `run()`.
- Secret scan uses repo `config/secret-patterns.json`; reports pattern id only (no substring echo).
- Push requires `CONVEX_URL` + `CONVEX_DEPLOY_KEY` in trend-ingest.env; dry-run unchanged.
- `tests/test_trend_ingest.py`: 32 tests (push/secret + code-review failure-path coverage).
- `bash scripts/verify.sh` OK.
- Code review patches: fail-closed secret-pattern load, Convex `errorMessage` on non-success, FATAL on pattern-file errors.

### File List

- `scripts/trend-ingest.py`
- `tests/test_trend_ingest.py`
- `_bmad-output/implementation-artifacts/44-2-2-trend-ingest-http-push-secret-guard.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Story 44-2-2 — HTTP push + secret guard for trend ingest.
- 2026-05-26: Code review batch-fix — failure-path tests, fail-closed secret patterns, Convex error surfacing.

## Dev Notes

### Mutation request shape

```json
{
  "path": "trends:ingestSignalBatch",
  "args": { "batch": { "ingestRunId": "...", "activeSources": [], "events": [], "watchlist": [], "signalSources": [] } },
  "format": "json"
}
```

### Secret scan

Mirror `findFirstMatchingSecretPatternId` — report `patternId` only, never matched substring.
