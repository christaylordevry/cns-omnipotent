---
story_id: 44-3-2
epic: 44
planning_epic: "Epic 44 / Epic 3 Story 3.2"
title: reddit-news-collectors-norm-cache
status: review
output_repo: Omnipotent.md
cns_repo_touch: scripts/trend-ingest.py
---

# Story 44-3-2: Reddit and News collectors with norm cache

Status: review

**Planning map:** Epic 44 Story 3.2 — `44-3-2-reddit-news-collectors-norm-cache`.

## Story

As a **CNS operator**,
I want **Reddit mention and News article counts normalised against my keyword's recent history**,
So that **cross-source ranking in the panel is comparable**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `Omnipotent.md` (`scripts/trend-ingest.py` + tests) |
| **Depends on** | 44-3-1 (collectors pattern), 44-2-2 (push), `dedupe_key_for_event` |
| **Normative** | `architecture-epic-44-trend-intelligence-layer-1.md` § Normalisation, I4 cache |
| **Out of scope** | CLI logging polish (44-3-3), cron docs (44-4-1), `trend-ingest.env.example` |

## Acceptance Criteria

1. **Reddit (AC: reddit)** — `--sources reddit`: PRAW mention counts per keyword; `signalType: mention_count`, `metadata.normalisationMethod: reddit_7d_minmax`, 7-day min-max via `~/.hermes/trend-norm-cache.json` keyed `topicSlug|reddit`.
2. **News (AC: news)** — `--sources news`: NewsAPI article counts; `signalType: article_count`, `metadata.normalisationMethod: news_7d_minmax`, same cache file updated before push.
3. **Isolate (AC: isolate)** — Per-keyword failure does not stop other keywords in that source.
4. **Cross-source (AC: cross)** — Reddit total failure still runs News when both in `activeSources` (and vice versa).
5. **Cache boundary (AC: cache)** — Cache stays operator-local; never in Convex batch.
6. **Metadata (AC: meta)** — Each event has top-level `value` (raw) and `metadata.rawValue` alongside `normalizedValue`.
7. **Wire (AC: wire)** — `dedupeKey`, `ingestRunId`, `windowHours`, `collectedAt` on every event; `signalSources` patch per source.
8. **Tests (AC: test)** — Mocked collectors + cache; `python3 -m unittest tests.test_trend_ingest`.
9. **Boundary (AC: boundary)** — `bash scripts/verify.sh` passes; no npm/verify.sh edits for trend logic.

## Tasks / Subtasks

- [x] Norm cache load/save/prune + min-max helper
- [x] `collect_reddit` + `collect_news` with injectable fetchers
- [x] Wire `run()` with per-source isolation
- [x] Unit tests; verify.sh; sprint-status → review

## Dev Agent Record

### Completion Notes List

- `~/.hermes/trend-norm-cache.json` — versioned cache with 7-day sample retention; min-max normalisation per `topicSlug|source`.
- `collect_reddit` / `collect_news` — PRAW + NewsAPI (urllib); injectable fetchers; per-keyword + cross-source isolation.
- Events include `value`, `metadata.rawValue`, `metadata.normalisationMethod`; cache saved before push (not on dry-run).
- `tests/test_trend_ingest.py`: 55 tests. Operator: `pip install praw`; set `REDDIT_*` and `NEWSAPI_API_KEY` in trend-ingest.env.

### File List

- `scripts/trend-ingest.py`
- `tests/test_trend_ingest.py`
- `_bmad-output/implementation-artifacts/44-3-2-reddit-news-collectors-norm-cache.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Story 44-3-2 — Reddit/News collectors + norm cache; status → review.

## Dev Notes

### Env vars (`~/.hermes/trend-ingest.env`)

- Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`
- News: `NEWSAPI_API_KEY`

### Cache shape

```json
{
  "version": 1,
  "entries": {
    "ai-agents|reddit": {
      "samples": [{"v": 12, "t": 1746000000000}],
      "updatedAt": 1746000000000
    }
  }
}
```

### Event metadata

```json
"metadata": {
  "normalisationMethod": "reddit_7d_minmax",
  "rawValue": 12
}
```

### Dependencies

- `pip install praw` for Reddit; `requests` (stdlib urllib ok for NewsAPI) — optional import pattern like pytrends.
