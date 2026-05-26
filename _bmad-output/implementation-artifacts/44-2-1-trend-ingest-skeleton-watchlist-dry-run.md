---
story_id: 44-2-1
epic: 44
planning_epic: "Epic 44 / Epic 2 Story 2.1"
title: trend-ingest-skeleton-watchlist-dry-run
status: done
output_repo: Omnipotent.md
cns_repo_touch: scripts/trend-ingest.py
---

# Story 44-2-1: trend-ingest.py skeleton, watchlist module, and dry-run

Status: done

**Planning map:** Epic 44 Story 2.1 — `44-2-1-trend-ingest-skeleton-watchlist-dry-run`.

## Story

As a **CNS operator**,
I want **`scripts/trend-ingest.py` to read my watchlist and env, build a batch, and preview without pushing**,
So that **I can validate configuration before enabling collectors or cron**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `Omnipotent.md` only (`scripts/trend-ingest.py` + tests) |
| **CNS repo touch** | **`scripts/trend-ingest.py`** — no edits to `dashboard-sync.ts`, `package.json`, `verify.sh`, or `src/` |
| **Depends on** | Stories 44-1-1–44-1-3 (frozen `SignalIngestBatch` in `cns-dashboard/convex/trendValidators.ts`) |
| **Normative** | `architecture-epic-44-trend-intelligence-layer-1.md` § C9, § Wire Contract, § Naming |
| **Out of scope** | HTTP push to Convex (Story 44-2-2), collectors (Epic 44 Epic 3), `trend-ingest.env.example` (operator guide) |

## Acceptance Criteria

1. **Watchlist load (AC: watchlist)** — Reads `~/.hermes/trend-watchlist.yaml` at run start (snapshot; path overridable via `TREND_WATCHLIST_PATH`). YAML schema `version: 1` with `keywords` list; each entry is a string or `{ keyword, region? }` defaulting `region` to `global`.
2. **Slug (AC: slug)** — `topic_slug(keyword)` implements C9: lowercase trim → non `[a-z0-9]+` → `-` → collapse → max 80 chars.
3. **Validation (AC: validate)** — Rejects malformed YAML, missing `keywords`, empty keyword strings, keywords >200 chars, control chars, invalid `region` (non-empty, max 32, `[a-z0-9_-]+`). Duplicate slugs after normalisation → error.
4. **Empty/missing (AC: empty)** — Missing or empty watchlist logs warning to stderr and exits **0** without building push payload (no stdout batch JSON).
5. **Env (AC: env)** — Loads `~/.hermes/trend-ingest.env` only (override `TREND_INGEST_ENV`); never reads API keys from repo. Missing env file on `--dry-run` is **non-fatal** (warn once); invalid env line format warns and skips line.
6. **Dry-run (AC: dryrun)** — `--dry-run` prints one JSON object (camelCase) matching `SignalIngestBatch`: `ingestRunId` (UUID v4), `activeSources` from `--sources` (comma-separated, validated enum), `events: []`, `watchlist` entries with `topicSlug`, `keyword`, `region`, `addedAt` (run start ms), `signalSources: []`. No HTTP.
7. **Tests (AC: test)** — `tests/test_trend_ingest.py` (unittest) covers slug, valid YAML, rejections, empty file exit, dry-run JSON shape; runnable via `python3 -m unittest tests.test_trend_ingest`.
8. **Boundary (AC: boundary)** — `bash scripts/verify.sh` still passes (no package.json changes).

## Tasks / Subtasks

- [x] Add `scripts/trend-ingest.py` with dataclasses mirroring wire contract (AC: dryrun, env, slug)
- [x] Implement watchlist load + validation module in same file (AC: watchlist, validate, empty)
- [x] Add `tests/test_trend_ingest.py` (AC: test)
- [x] Run `python3 -m unittest tests.test_trend_ingest` and `bash scripts/verify.sh` (AC: test, boundary)
- [x] Update sprint-status and story file to `review` (AC: all)

## Dev Notes

### Watchlist YAML (normative for this story)

```yaml
version: 1
keywords:
  - keyword: AI agents
    region: global
  - Obsidian AI plugins
```

### CLI

```bash
python3 scripts/trend-ingest.py --dry-run
python3 scripts/trend-ingest.py --dry-run --sources news,reddit
```

### Python deps

- **PyYAML** required (`pip install pyyaml`) — document in Completion Notes if missing on CI; tests skip with message when import fails.
- No new npm deps; no edits to `dashboard-sync.ts`.

### Wire mirror (camelCase JSON keys)

Align with `signalIngestBatchValidator` in `cns-dashboard/convex/trendValidators.ts`. Do not send `momentum` or pre-built `trendTopics`.

### Previous story learnings

- Convex `syncWatchlist` no-ops on empty watchlist — Python must exit before push when YAML empty (this story: exit before dry-run JSON too).
- `ingestSignalBatch` path: `trends:ingestSignalBatch` (HTTP in 44-2-2).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log

- No `ready-for-dev` in sprint after 44-1-3; created story artifact then implemented in same session.

### Completion Notes List

- Added `scripts/trend-ingest.py`: C9 `topic_slug`, watchlist YAML loader (`version: 1`), env file parser, `--dry-run` / `--sources`, `SignalIngestBatch` wire JSON (empty events/signalSources).
- Empty/missing watchlist: stderr warning, exit 0, no stdout JSON. Non-dry-run exits 1 until 44-2-2 HTTP push.
- `tests/test_trend_ingest.py`: 12 unittest cases; `python3 -m unittest tests.test_trend_ingest` OK.
- `bash scripts/verify.sh` OK (642 npm tests; no package.json change).
- **Operator guide: no update required** (skeleton + dry-run; env example deferred to operator guide epic).
- **PyYAML** required on operator machine: `pip install pyyaml`.

### File List

**Omnipotent.md**:

- `scripts/trend-ingest.py` (new)
- `tests/test_trend_ingest.py` (new)
- `_bmad-output/implementation-artifacts/44-2-1-trend-ingest-skeleton-watchlist-dry-run.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Epic 44 Story 2.1 — `trend-ingest.py` watchlist + dry-run skeleton + unittest suite.
- 2026-05-26: Code review — expanded unittest coverage (18 cases); story marked done.

### Review Findings

- [x] [Review][Patch] Empty-watchlist CLI test omits stdout assertion [`tests/test_trend_ingest.py:102`] — added stdout capture via `_run_dry_run_patched`.
- [x] [Review][Patch] Validation AC tests incomplete [`tests/test_trend_ingest.py`] — added reject tests for version, missing keywords, keyword length, invalid region.
- [x] [Review][Patch] No test for explicit empty `keywords: []` YAML [`tests/test_trend_ingest.py`] — added loader + CLI tests for empty list.

- [x] [Review][Defer] Python gate not in `verify.sh` [`scripts/verify.sh`] — deferred, pre-existing; AC boundary only requires `verify.sh` pass; operator runs `python3 -m unittest` manually per story.
