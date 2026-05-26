---
story_id: 44-3-3
epic: 44
planning_epic: "Epic 44 / Epic 3 Story 3.3"
title: cli-sources-polish-logging
status: done
output_repo: Omnipotent.md
cns_repo_touch: scripts/trend-ingest.py
---

# Story 44-3-3: Collector CLI source selection and logging

Status: done

**Planning map:** Epic 44 Story 3.3 — `44-3-3-cli-sources-polish-logging`.

## Story

As a **CNS operator**,
I want **to run one source at a time matching cron schedules and see ingest outcomes in a log file**,
So that **I can debug NewsAPI quota or Reddit token issues without reading cron mail only**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `Omnipotent.md` (`scripts/trend-ingest.py` + `tests/test_trend_ingest.py`) |
| **Depends on** | 44-2-1 (`parse_sources_arg`, `--dry-run`), 44-2-2 (`push_signal_batch`), 44-3-1/44-3-2 (collectors) |
| **Normative** | `epics-epic-44-trend-intelligence-layer-1.md` Story 3.3; `prd-epic-44-trend-intelligence-layer-1.md` FR38, FR10–FR11 (partial), FR43; NFR-P3, NFR-R2 |
| **Reference** | `scripts/install-dashboard-sync-cron.sh` log pattern (`~/.hermes/logs/dashboard-sync.log`); existing `run()` collector gating by `active_sources` |
| **Out of scope** | Cron install script / `trend-ingest.env.example` (44-4-1), operator guide cron tables beyond log path + CLI one-liner (44-4-1), `cns-dashboard` / panel work, vault writes, `verify.sh` wiring for Python unittest |

## Acceptance Criteria

1. **Single-source CLI (AC: cli)** — Operator can run exactly one collector source per invocation via documented flags:
   - **Canonical:** `--sources <name>` or `--sources a,b` (existing comma list; unchanged semantics).
   - **Polish:** `--source <name>` singular alias for one of `google_trends`, `reddit`, `news` (equivalent to `--sources <name>`).
   - If both `--source` and `--sources` are passed, **reject** with clear FATAL message (no ambiguous merge).
   - Argparse help and module docstring include copy-paste examples for the three cron shapes: `--sources news`, `--sources reddit`, `--sources google_trends`.
   - When `google_trends` ∉ `activeSources`, reddit/news collectors do not run (and vice versa) — **regression:** existing isolation tests must still pass.

2. **activeSources wire (AC: wire)** — Batch JSON `activeSources` lists **only** sources requested for this run (empty list still allowed for watchlist-only push — see AC: empty).

3. **Empty sources behaviour (AC: empty)** — If `--sources` / `--source` omitted or empty after parse:
   - **Dry-run:** allowed; log line records `activeSources: []`, `eventsEmitted: 0`.
   - **Live push:** allowed (watchlist mirror only); stderr **warning** once; log records `outcome: watchlist_only` (or equivalent) — do not FATAL.

4. **Ingest log file (AC: log)** — After every run that reaches `run()` completion path (success, push failure, or collector-only completion before push), **append one JSON line** to `~/.hermes/logs/trend-ingest.log` (override path via `TREND_INGEST_LOG`). Create parent dir if missing (`mkdir -p`). Use UTF-8, no secrets in log payload (FR38, NFR-R2).

5. **Log fields (AC: logfields)** — Each line is a single JSON object with at minimum:
   - `ts` — ISO-8601 UTC timestamp at write time
   - `ingestRunId` — batch UUID
   - `activeSources` — array of source names
   - `watchlistKeywords` — count of watchlist entries in batch
   - `eventsEmitted` — `len(batch.events)` at log time
   - `dryRun` — boolean
   - `durationMs` — wall time for full `run()` (NFR-P3 observability)
   - `httpStatus` — integer when HTTP push attempted; `null` when dry-run or push not reached
   - `outcome` — one of `ok`, `error`, `watchlist_only` (and `dry_run` optional alias when `dryRun` true and no push)
   - `error` — short operator-safe message on failure (no deploy key, no API key substrings)

6. **HTTP result (AC: http)** — Refactor `push_signal_batch` to return the HTTP status code (e.g. `int`) on success; callers log it. Convex mutation `status: error` in JSON body still raises `RuntimeError` as today — log `outcome: error` with message before exit 1.

7. **Failure logging (AC: fail)** — Push failure, secret scan failure, missing credentials, and FATAL watchlist errors: still print to stderr **and** append log line when `ingestRunId` was allocated (watchlist loaded). Early exit before batch creation (empty watchlist skip) may omit file log — stderr warning only (matches FR6).

8. **No vault IO (AC: boundary)** — Log and norm cache remain under `~/.hermes/` only; no writes under vault root (FR43, NFR-S3).

9. **Tests (AC: test)** — Extend `tests/test_trend_ingest.py`: `--source` alias, mutual exclusion with `--sources`, log append with temp log path via env, success + push-failure log shapes, dry-run log line, mocked HTTP status in log. Run `python3 -m unittest tests.test_trend_ingest`.

10. **Verify gate (AC: verify)** — `bash scripts/verify.sh` passes; production diff scope remains `scripts/trend-ingest.py` + tests only.

## Tasks / Subtasks

- [x] Add `_default_ingest_log_path()` + `append_ingest_log(record, path)` (atomic append or safe append; no secret fields)
- [x] Add `--source` argparse + conflict guard with `--sources`; refresh help text and module Usage block
- [x] Wrap `run()` with timing; call `append_ingest_log` on all completion paths where batch exists
- [x] Change `push_signal_batch` → return `int` HTTP status; update all call sites and tests
- [x] Unit tests for CLI polish + logging; regression on single-source collector gating
- [x] Run `python3 -m unittest tests.test_trend_ingest` and `bash scripts/verify.sh`
- [x] Update sprint-status → `review` after implementation (dev-story agent)

### Review Findings

- [x] [Review][Patch] Convex mutation body error omits httpStatus on HTTP 200 [`scripts/trend-ingest.py:463-474`] — Fixed: mutation/body errors raise `Convex HTTP {status}: …` so ingest log records `httpStatus`.
- [x] [Review][Patch] Unhandled collector exceptions log misleading outcome ok [`scripts/trend-ingest.py:1363-1370`] — Fixed: `except Exception` sets `outcome: error` before `finally` writes the log line.
- [x] [Review][Patch] No test for TREND_INGEST_LOG env override [`tests/test_trend_ingest.py`] — Fixed: `test_trend_ingest_log_env_override` plus `test_push_convex_body_error_logs_http_status_200` and `test_unhandled_collector_error_logs_error_outcome`.
- [x] [Review][Defer] Operator guide logging section not updated — deferred to story 44-4-1 per Dev Agent Record.
- [x] [Review][Defer] Story 44-3-3 code shipped in commit e4dc309 (dashboard-sync cron message) — pre-existing process gap; no functional defect.

## Dev Notes

### Log path (normative for this story)

| Item | Value |
|------|--------|
| Default | `~/.hermes/logs/trend-ingest.log` |
| Override | `TREND_INGEST_LOG` (absolute or `~` expanded) |
| Pattern mirror | `DASHBOARD_SYNC_LOG` / `~/.hermes/logs/dashboard-sync.log` in `scripts/install-dashboard-sync-cron.sh` |

### Example log lines

```json
{"ts":"2026-05-26T01:15:00Z","ingestRunId":"a1b2c3d4-...","activeSources":["news"],"watchlistKeywords":5,"eventsEmitted":5,"dryRun":false,"durationMs":8120,"httpStatus":200,"outcome":"ok"}
```

```json
{"ts":"2026-05-26T01:20:00Z","ingestRunId":"...","activeSources":["reddit"],"watchlistKeywords":5,"eventsEmitted":0,"dryRun":false,"durationMs":400,"httpStatus":null,"outcome":"error","error":"praw is required for reddit (pip install praw)"}
```

### CLI examples (document in help + story completion)

```bash
python3 scripts/trend-ingest.py --dry-run --sources news
python3 scripts/trend-ingest.py --source reddit
python3 scripts/trend-ingest.py --sources google_trends
```

Cron (44-4-1) will redirect stderr to the same log file **or** rely on structured lines only — prefer **structured JSON inside Python** so cron `>> log 2>&1` does not duplicate unstructured noise; still keep brief stderr summary on push success (existing one-liner OK).

### `push_signal_batch` signature change

```python
def push_signal_batch(...) -> int:
    ...
    return int(status)  # 200-299 only; raises RuntimeError otherwise
```

Tests that mock `urlopen` must expect return value or ignore it; update `test_push_*` accordingly.

### Implementation sketch for `run()`

1. Record `started = time.monotonic()` at entry after argparse.
2. On success path after push: `append_ingest_log({..., httpStatus: status, outcome: "ok"})`.
3. On `except RuntimeError` from push: log then re-raise / return 1.
4. Use `try/finally` or single exit helper so dry-run and error paths still log once.

### NFR-P3 (120s)

Do not add a hard timeout in this story. Log `durationMs` so operator can audit slow runs in 44-4-2. Optional dev-note: typical watchlist ≤10 keywords per source should stay under 120s on WSL.

### Prior art (44-3-2) — do not regress

- Per-keyword and cross-source isolation in `collect_reddit` / `collect_news` / `collect_google_trends`.
- Norm cache save before push (not on dry-run).
- Secret scan before HTTP push.
- PRAW-per-keyword deferral stays in 44-4-1 (`deferred-work.md`).

### Prior art (44-3-1)

- Default empty `--sources` → no collectors; watchlist-only batch still valid.

### Python unittest gate

`scripts/verify.sh` remains npm-only — run `python3 -m unittest tests.test_trend_ingest` manually before review (deferred pattern from 44-2-1).

### Standing task: Operator guide

After implementation, add a short **Trend ingest logging** bullet under the dashboard/trend section of `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (via vault MCP, not direct edit): log path, `TREND_INGEST_LOG`, example `tail -1` / `jq` grep, and the three `--sources` cron one-liners. Bump Version History if section changes. If deferred to 44-4-1, note explicitly in Completion Notes.

## Standing tasks (every story)

### Standing task: Update operator guide

- [ ] If this story changes user-facing behavior: update `03-Resources/CNS-Operator-Guide.md` (log path + CLI flags minimum).
- [x] If guide update deferred to 44-4-1: note "Operator guide: log path deferred to 44-4-1" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created (2026-05-26).
- Implemented `--source` singular alias with mutual-exclusion guard vs `--sources`; module docstring + argparse epilog document cron one-liners.
- Structured JSON ingest log at `~/.hermes/logs/trend-ingest.log` (`TREND_INGEST_LOG` override); one line per run after batch allocation with `durationMs`, `httpStatus`, `outcome` (`ok` | `error` | `watchlist_only` | `dry_run`).
- `push_signal_batch` returns HTTP status `int` on success; failures log `outcome: error` before exit 1.
- Empty `--sources` live push: stderr warning once + `watchlist_only`; dry-run logs `activeSources: []`.
- Operator guide: log path + `tail`/`jq` examples deferred to story 44-4-1.
- `python3 -m unittest tests.test_trend_ingest` (68 tests) and `bash scripts/verify.sh` passed.

### File List

- `scripts/trend-ingest.py`
- `tests/test_trend_ingest.py`
- `_bmad-output/implementation-artifacts/44-3-3-cli-sources-polish-logging.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

### Change Log

- 2026-05-26: Story 44-3-3 created — CLI `--source` polish + structured ingest logging (ready-for-dev).
- 2026-05-26: Implemented CLI polish, ingest JSON logging, push HTTP status return, tests (review).
- 2026-05-26: Code review patches — HTTP status on mutation errors, unhandled-exception log outcome, TREND_INGEST_LOG test (done).

### References

- [Source: `_bmad-output/planning-artifacts/epics-epic-44-trend-intelligence-layer-1.md` — Story 3.3]
- [Source: `_bmad-output/planning-artifacts/prd-epic-44-trend-intelligence-layer-1.md` — FR38, NFR-P3, Journey 4]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-44-trend-intelligence-layer-1.md` — HTTP Push, operator paths]
- [Source: `scripts/trend-ingest.py` — `parse_sources_arg`, `run()`, `push_signal_batch`]
- [Source: `_bmad-output/implementation-artifacts/44-3-2-reddit-news-collectors-norm-cache.md` — collector isolation patterns]
