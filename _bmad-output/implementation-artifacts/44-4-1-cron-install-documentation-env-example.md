---
story_id: 44-4-1
epic: 44
planning_epic: "Epic 44 / Epic 4 Story 4.1"
title: cron-install-documentation-env-example
status: done
output_repo: Omnipotent.md
cns_repo_touch: scripts/trend-ingest.env.example, scripts/install-trend-ingest-cron.sh, scripts/run-trend-ingest-cron.sh
---

# Story 44-4-1: Cron install documentation and env example

Status: done

**Planning map:** Epic 44 Story 4.1 — `44-4-1-cron-install-documentation-env-example`.

## Story

As a **CNS operator**,
I want **copy-paste cron lines and an env example for trend ingest**,
So that **the pipeline runs every 15 minutes for news/reddit and hourly for trends without editing application code**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `Omnipotent.md` (shell installers + env example + operator guide) |
| **Depends on** | 44-2-1 (env/watchlist), 44-2-2 (push), 44-3-3 (CLI `--sources`, structured log) |
| **Normative** | `epics-epic-44-trend-intelligence-layer-1.md` Story 4.1; FR10, FR11, FR39; NFR-S1 |
| **Reference** | `scripts/install-dashboard-sync-cron.sh`, `scripts/run-dashboard-sync-cron.sh` |
| **Deferred in** | 44-3-3 operator guide logging; 44-3-2 PRAW-per-keyword (cron hardening) |
| **Out of scope** | 44-4-2 seven-day reliability verification, `verify.sh` Python wiring, cns-dashboard panel |

## Acceptance Criteria

1. **Cron schedule (AC: cron)** — `install-trend-ingest-cron.sh` installs three WSL user crontab lines tagged `cns-trend-ingest-news`, `cns-trend-ingest-reddit`, `cns-trend-ingest-google-trends`:
   - `*/15 * * * *` → `--sources news`
   - `*/15 * * * *` → `--sources reddit`
   - `0 * * * *` → `--sources google_trends`

2. **Cron wrapper (AC: wrapper)** — `run-trend-ingest-cron.sh` accepts source name, sources `~/.hermes/trend-ingest.env` under bash (same quoted-value pattern as dashboard-sync), runs `python3 scripts/trend-ingest.py --sources <name>` from repo root.

3. **Env example (AC: env)** — `scripts/trend-ingest.env.example` lists `CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, `NEWSAPI_API_KEY` with chmod 600 copy guidance (NFR-S1). Install script seeds `~/.hermes/trend-ingest.env` from example when missing.

4. **Operator guide (AC: guide)** — `CNS-Operator-Guide.md` §16.5 documents watchlist path, env setup, cron install command, structured log path (`TREND_INGEST_LOG`), `tail`/`jq` examples, manual smoke commands, and NewsAPI free-tier quota + upgrade path (Journey 4).

5. **PRAW hardening (AC: praw)** — Reuse one PRAW client per reddit cron run (not per keyword); existing reddit collector tests pass.

6. **Verify gate (AC: verify)** — `bash scripts/verify.sh` passes; run `python3 -m unittest tests.test_trend_ingest` before review.

## Tasks / Subtasks

- [x] Add `scripts/trend-ingest.env.example` with all required vars + chmod 600 comment block
- [x] Add `scripts/run-trend-ingest-cron.sh` (source arg, env load, python3 invoke)
- [x] Add `scripts/install-trend-ingest-cron.sh` (seed env, install 3 cron lines, log dir)
- [x] Refactor `fetch_reddit_mention_count` / `collect_reddit` for single PRAW client per run
- [x] Update `CNS-Operator-Guide.md` §16.5 + version history
- [x] Resolve deferred-work items from 44-3-2/44-3-3 related to this story
- [x] Run `python3 -m unittest tests.test_trend_ingest` and `bash scripts/verify.sh`
- [x] Update sprint-status → `review`

### Review Findings

- [x] [Review][Patch] `TREND_INGEST_LOG` install vs Python path drift [`scripts/install-trend-ingest-cron.sh:7-32`, `scripts/run-trend-ingest-cron.sh`] — fixed: export in runner + persist in env on install
- [x] [Review][Patch] Cron wrapper should resolve `python3` explicitly [`scripts/run-trend-ingest-cron.sh:36`] — fixed: PATH prepend + `command -v python3`
- [x] [Review][Defer] PRAW client not closed per cron run [`scripts/trend-ingest.py:854-863`] — deferred, acceptable for 15m operator-scale cron

## Dev Notes

### Cron lines (normative)

```bash
*/15 * * * * /bin/bash "/path/to/scripts/run-trend-ingest-cron.sh" news >> "$HOME/.hermes/logs/trend-ingest.log" 2>&1 # cns-trend-ingest-news
*/15 * * * * /bin/bash "/path/to/scripts/run-trend-ingest-cron.sh" reddit >> "$HOME/.hermes/logs/trend-ingest.log" 2>&1 # cns-trend-ingest-reddit
0 * * * * /bin/bash "/path/to/scripts/run-trend-ingest-cron.sh" google_trends >> "$HOME/.hermes/logs/trend-ingest.log" 2>&1 # cns-trend-ingest-google-trends
```

Structured JSON lines are appended by Python; stderr from wrapper/script may interleave — filter with `grep '^{'` or `jq -c`.

### NewsAPI quota (operator guide)

Free/developer tier: ~100 requests/day on NewsAPI.org; each watchlist keyword = one `/everything` call per news cron tick (every 15 min). Document upgrade path (paid Business tier) when `signalSources.news` shows quota errors in ingest log.

### Python deps (operator)

- `pip install pytrends praw` on WSL for google_trends and reddit collectors.

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log

- Story file created at dev start (no prior sprint `ready-for-dev` entry for 44-4-1).

### Completion Notes List

- Created `trend-ingest.env.example`, `install-trend-ingest-cron.sh`, `run-trend-ingest-cron.sh` mirroring dashboard-sync cron patterns (bash wrapper + env `source`, tagged crontab lines).
- Operator guide §16.5: watchlist, env, cron install, structured log + `jq` examples, NewsAPI quota / upgrade path, partial-degradation note.
- PRAW: `create_reddit_client()` once per `collect_reddit` run; `fetch_reddit_mention_count` accepts optional `reddit` instance.
- Tests: env example keys test + single-client reuse test; 73 unittest OK; `verify.sh` passed.
- Crontab install not re-run in dev sandbox — operator confirms `crontab -l` after `install-trend-ingest-cron.sh` on live WSL.

### File List

- `scripts/trend-ingest.env.example`
- `scripts/install-trend-ingest-cron.sh`
- `scripts/run-trend-ingest-cron.sh`
- `scripts/trend-ingest.py`
- `tests/test_trend_ingest.py`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/44-4-1-cron-install-documentation-env-example.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Story 44-4-1 created and implemented — cron install, env example, operator guide §16.5, PRAW reuse (review).
- 2026-05-26: Code review patches — `TREND_INGEST_LOG` export/persist, cron `python3` PATH hardening (done).

### References

- [Source: `_bmad-output/planning-artifacts/epics-epic-44-trend-intelligence-layer-1.md` — Story 4.1]
- [Source: `_bmad-output/implementation-artifacts/44-3-3-cli-sources-polish-logging.md` — deferred operator guide]
- [Source: `scripts/install-dashboard-sync-cron.sh` — install pattern]
