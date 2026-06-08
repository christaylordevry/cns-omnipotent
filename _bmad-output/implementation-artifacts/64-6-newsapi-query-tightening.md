---
story_id: 64-6
epic: 64
title: newsapi-query-tightening
status: done
baseline_commit: ce0dc5d
operator_brief: 2026-06-08
predecessors: 49-6, 61-5, 59-3
---

# Story 64.6: NewsAPI query tightening for morning digest

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest in `#hermes`**,
I want **NewsAPI headlines filtered to CNS-relevant AI/agent topics within a recent time window**,
so that **the Headlines section and `digestSignals` rows surface on-topic intelligence instead of broad "automation" noise or stale articles**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 64: Intelligence Scoring Engine v1 — **64-6 is a parallel quick win** (no dependency on 64-1 schema) |
| **Repo** | Omnipotent.md only — no cns-dashboard changes |
| **Predecessors** | **49-6** (introduced `hermes-run-newsapi.sh` + morning-digest Source 2); **61-5** (Convex push expects `headlines[].url` when present); **59-3** (Hermes HOME isolation in newsapi wrapper) |
| **Touchpoint** | `scripts/session-close/hermes-run-newsapi.sh` — currently inline Python with a broad query |
| **Pattern** | Mirror **arXiv/HN** refactor (61-1, 61-4): thin bash wrapper → Node `.mjs` module, JSON stdout, exit **0** on failure |
| **Out of scope** | Epic 64 scoring dimensions (64-2..64-5); trend-ingest `news` collector (`trend-ingest.py` watchlist article counts); keyword-candidates newsapi extraction (62-1 Phase 2); Operator Guide edits unless query/env contract changes materially |

### Problem (current state)

`hermes-run-newsapi.sh` embeds inline Python with:

```python
q = '("artificial intelligence" OR "AI agents" OR automation) AND NOT sports'
sortBy = publishedAt
pageSize = 5
```

**Known weaknesses:**

1. **`automation` is too broad** — matches industrial/home automation unrelated to CNS.
2. **No `from` window** — `publishedAt` sort without date bounds can surface stale or off-window articles.
3. **Titles only** — stdout is `{"headlines":["title",...]}`; Convex push mapping (61-5) supports `url` but NewsAPI never emits it.
4. **No client-side relevance filter** — API-level `NOT sports` is insufficient; off-topic titles still slip through.
5. **Untestable inline Python** — unlike arXiv/HN modules, no fixture-based unit tests.

### Operator brief (binding — sprint-change-proposal-2026-06-08)

1. Tighten NewsAPI query for CNS-relevant headlines.
2. Primary file: `scripts/session-close/hermes-run-newsapi.sh`.
3. Success criterion: **NewsAPI returns on-topic headlines** (Epic 64 proposal §Success criteria).
4. Can run in parallel with 64-1; does not block scoring engine stories.

## Acceptance Criteria

### 1. NewsAPI fetch module (AC: module)

**Given** `NEWSAPI_API_KEY` is configured in `~/.hermes/trend-ingest.env`
**When** `node scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs` runs
**Then** stdout is JSON:

```json
{
  "headlines": [
    {
      "title": "OpenAI ships new agent framework for developers",
      "url": "https://example.com/article"
    }
  ]
}
```

**Or** on failure:

```json
{ "error": "<short reason>" }
```

**And** script exits **0** on missing key, HTTP error, API error status, empty filtered results, or parse failure (digest must not abort)
**And** **no new `npm` dependencies** — use Node built-in `fetch` + `URLSearchParams`
**And** credentials load via `mergeTrendIngestEnv` from `fetch-arxiv-rss.mjs` (same operator-home resolution as arXiv/HN — **not** `homedir()` directly)
**And** **never** print the API key to stdout/stderr

### 2. Tightened query contract (AC: query)

**Given** default configuration (no custom query override)
**When** the module builds the NewsAPI `/v2/everything` request
**Then** it uses:

| Param | Value | Rationale |
|-------|-------|-----------|
| `q` | CNS-focused OR group **without** bare `automation` — include terms like `"artificial intelligence"`, `"AI agents"`, `"large language model"`, `LLM`, `"agentic AI"`, `MCP`, `"knowledge management"`; exclude noise: `sports`, `celebrity`, `"reality TV"`, `"stock market"`, `cryptocurrency`, `bitcoin` | Operator/CNS topical fit |
| `searchIn` | `title,description` | Precision over full content |
| `language` | `en` | Unchanged |
| `sortBy` | `publishedAt` | Recency for daily digest |
| `from` | Rolling window start (ISO 8601 datetime) | Prevent stale headlines |
| `pageSize` | `20` (fetch pool) | Room for post-filter before cap |

**And** after fetch, apply **client-side title filter** `isOnTopicHeadline(title, description?)` — headline must match at least one CNS relevance token (case-insensitive word boundary or substring for multi-word phrases)
**And** return at most **5** headlines after filter (display order = API `publishedAt` desc)
**And** drop articles with empty/whitespace titles; include `url` when NewsAPI provides it (omit key when absent — do not set `null`)

### 3. Configuration (AC: config)

| Variable | Purpose | Default |
|----------|---------|---------|
| `MORNING_DIGEST_NEWSAPI_WINDOW_HOURS` | Rolling `from` window | `48` |
| `MORNING_DIGEST_NEWSAPI_MAX_HEADLINES` | Max headlines after filter | `5` |
| `MORNING_DIGEST_NEWSAPI_PAGE_SIZE` | API fetch pool before filter | `20` |
| `MORNING_DIGEST_NEWSAPI_QUERY` | Optional full `q` override (operator escape hatch) | built-in tightened default |
| `MORNING_DIGEST_NEWSAPI_ENABLED` | Set `0`/`false`/`no`/`off` to disable | enabled |

**Given** `MORNING_DIGEST_NEWSAPI_ENABLED` is falsey
**Then** module returns `{"error":"newsapi disabled"}` without network call.

**Given** `MORNING_DIGEST_NEWSAPI_WINDOW_HOURS` is unset, non-numeric, or `<= 0`
**Then** fall back to **48**.

**And** document new vars in `scripts/trend-ingest.env.example` and `references/config-snippet.md`

### 4. Wrapper + skill contract (AC: skill)

**Given** `hermes-run-newsapi.sh` is updated
**Then** it:

- Preserves Epic 59 **HOME isolation remap** (`$HOME` → operator home when under `/.hermes/home`)
- Loads `NEWSAPI_API_KEY` from `$HOME/.hermes/trend-ingest.env` (existing bash env bootstrap)
- `exec node …/fetch-newsapi-headlines.mjs` (no inline Python)

**And** `references/task-prompt.md` Source 2 section documents the tightened query, `from` window, object-shaped `headlines[]`, and new env vars
**And** `SKILL.md` bumped to **v1.4.0** (minor — new headline shape + query contract)
**And** backward compatibility: `buildDigestSignals` / `pick-signal-notebook.mjs` already accept `headlines` as `string | { title }` — **no breaking change** required unless you add optional `url` passthrough in `DIGEST_SOURCES_JSON` examples

### 5. Tests + verify gate (AC: tests)

**Then** new `tests/morning-digest-newsapi.test.mjs` covers (fixture/mocked fetch — **no live network** in `npm test`):

- `loadNewsapiConfig` defaults and coercion
- `buildNewsapiQuery` default vs override
- `computeFromIso` window math
- `parseNewsapiPayload` happy path + error status
- `filterOnTopicHeadlines` accepts CNS-relevant titles, rejects off-topic fixtures (e.g., sports-only, generic stock/crypto)
- `runNewsapiFetch` with injectable `fetch` returns `{ headlines }` or `{ error }`; always exit 0 from CLI `main`

**And** extend `tests/hermes-morning-digest-skill.test.mjs`:

- Wrapper delegates to `fetch-newsapi-headlines.mjs` (no inline `python3 - <<'PY'`)
- Task-prompt mentions `searchIn`, rolling `from` window, and object headlines with `url`

**And** `npm test` and `bash scripts/verify.sh` green
**And** run `bash scripts/install-hermes-skill-morning-digest.sh` after skill edits; verify parity gate passes

## Tasks / Subtasks

- [x] **Task 1 — Extract module** (AC: 1, 2)
  - [x] Create `scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs`
  - [x] Export pure helpers: `loadNewsapiConfig`, `buildNewsapiQuery`, `computeFromIso`, `parseNewsapiPayload`, `isOnTopicHeadline`, `filterOnTopicHeadlines`, `runNewsapiFetch`
  - [x] CLI: print JSON stdout; `process.exit(0)` on all failure paths
- [x] **Task 2 — Refactor wrapper** (AC: 4)
  - [x] Slim `scripts/session-close/hermes-run-newsapi.sh` to HOME remap + env load + `exec node`
  - [x] Remove inline Python block entirely
- [x] **Task 3 — Skill docs** (AC: 3, 4)
  - [x] Update `references/task-prompt.md` Source 2 query table
  - [x] Update `references/config-snippet.md` + `scripts/trend-ingest.env.example`
  - [x] Bump `SKILL.md` to v1.4.0
- [x] **Task 4 — Tests** (AC: 5)
  - [x] Add `tests/morning-digest-newsapi.test.mjs`
  - [x] Extend `tests/hermes-morning-digest-skill.test.mjs`
  - [x] Run `npm test` + `bash scripts/verify.sh`

## Dev Notes

### Architecture compliance

- **ADR-E64-001 (preview):** Scoring engine is Omnipotent.md-side; 64-6 improves **source quality** feeding future 64-2 scoring — no Convex schema work.
- **Epic 64 parallel track:** 64-6 does **not** wait on 64-1 `digestSignals.scores` extension.
- **Separate from trend-ingest news collector:** `scripts/trend-ingest.py` `fetch_news_article_count` uses per-watchlist-keyword `q` + `totalResults` — **do not modify** in this story.

### Current wrapper (must read before editing)

```39:63:scripts/session-close/hermes-run-newsapi.sh
python3 - <<'PY'
import json, os, urllib.parse, urllib.request

key = os.environ.get("NEWSAPI_API_KEY", "")
params = urllib.parse.urlencode({
    "q": "(\"artificial intelligence\" OR \"AI agents\" OR automation) AND NOT sports",
    "sortBy": "publishedAt",
    "pageSize": "5",
    "language": "en",
    "apiKey": key,
})
# ... prints {"headlines": ["title", ...]}
PY
```

**Preserve:** HOME isolation block (lines 9–14), `trend-ingest.env` key loading, JSON error contract, exit 0 semantics.

### Recommended default `q` (implement unless overridden)

```
(
  "artificial intelligence" OR "AI agents" OR "large language model" OR LLM
  OR "agentic AI" OR MCP OR "knowledge management" OR "AI assistant"
)
AND NOT (
  sports OR celebrity OR "reality TV" OR "stock market"
  OR cryptocurrency OR bitcoin OR ethereum
)
```

Use `searchIn=title,description`. Request `pageSize=20`, filter locally, cap at 5.

### Client-side relevance tokens (post-filter)

Minimum match (any one) in **title** (optionally title+description):

`ai`, `llm`, `agent`, `agents`, `mcp`, `automation` (only when paired with tech context — prefer explicit multi-word matches), `artificial intelligence`, `language model`, `knowledge`, `notebooklm`, `openai`, `anthropic`, `gemini`, `claude`

Reject titles matching exclude patterns even if API returned them: `\bsports\b`, `\bcelebrity\b`, `\bnba\b`, `\bnfl\b`, `\bmlb\b`, crypto ticker hype without AI context.

Keep the filter **conservative** — better 2–3 on-topic headlines than 5 noisy ones. Empty after filter → `{"error":"no on-topic headlines"}` exit 0.

### NewsAPI API reference (Context7 `/websites/newsapi`)

- Endpoint: `GET https://newsapi.org/v2/everything`
- Required: `apiKey`
- Use camelCase params as current code does: `sortBy`, `pageSize` (NewsAPI accepts both styles; keep `sortBy`/`pageSize` to match existing shell script)
- `from`: ISO 8601 datetime — use UTC, e.g. `2026-06-06T08:00:00` for rolling window
- Response: `articles[].{title,url,description,publishedAt}`; check `status === "ok"`

### File structure

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs` | **NEW** |
| `scripts/session-close/hermes-run-newsapi.sh` | **UPDATE** — thin wrapper |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | **UPDATE** Source 2 |
| `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` | **UPDATE** |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | **UPDATE** v1.4.0 |
| `scripts/trend-ingest.env.example` | **UPDATE** optional NewsAPI digest vars |
| `tests/morning-digest-newsapi.test.mjs` | **NEW** |
| `tests/hermes-morning-digest-skill.test.mjs` | **UPDATE** |

**Do not touch:** `trend-ingest.py`, `cns-dashboard/`, WriteGate paths, `push-digest-convex.mjs` (already supports `url`), `pick-signal-notebook.mjs` (unless adding docstring comment only).

### Testing standards

- Mirror `tests/morning-digest-hn-rss.test.mjs` / `tests/morning-digest-arxiv-rss.test.mjs` patterns: inject `fetch` with fixture JSON payloads.
- Assert wrapper no longer contains `python3 - <<'PY'`.
- Hermes skill parity: `scripts/verify.sh` runs install + diff gate — run after SKILL changes.

### Previous story intelligence

| Story | Learning for 64-6 |
|-------|-------------------|
| **49-6** | Established NewsAPI as Source 2; one request per digest; free tier ~100 req/day — still valid (one call, higher `pageSize` is same quota) |
| **59-3** | HOME isolation in `hermes-run-newsapi.sh` — **must preserve** in wrapper |
| **61-1 / 61-4** | `.mjs` module + thin `hermes-run-*.sh` + `mergeTrendIngestEnv` is canonical |
| **61-5** | Convex signal mapping expects `headlines[].url` when present — emit objects not bare strings |
| **62-1** | Keyword extraction skips `newsapi` in Phase 1 — tightening still improves digest display + future Phase 2 |

### Git intelligence

Recent commits are digest-pipeline focused (61-5 Convex push, 62-1 keyword candidates). Follow same patterns: small Omnipotent.md-only diff, task-prompt as normative contract, fixture tests, verify gate.

### Security / operator approval

- **No WriteGate / vault_log_action / security.md** changes.
- API key stays in `~/.hermes/trend-ingest.env` only — never log or Discord-echo.
- No new npm packages (supply-chain rule).

### Project structure notes

- Morning-digest scripts live under `scripts/hermes-skill-examples/morning-digest/scripts/` and mirror to `~/.hermes/skills/cns/morning-digest/` via install script.
- `mergeTrendIngestEnv` is **inlined in fetch-arxiv-rss.mjs** (not imported from session-close) because installed skill tree lacks session-close package — **import from `./fetch-arxiv-rss.mjs`**.

## References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md` — Epic 64 story table, success criteria]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 64 goal + 64-6 parallel note]
- [Source: `scripts/session-close/hermes-run-newsapi.sh` — current implementation]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — Source 2 + signal mapping]
- [Source: `_bmad-output/implementation-artifacts/49-6-morning-digest-upgrade.md` — original NewsAPI contract]
- [Source: `_bmad-output/implementation-artifacts/61-4-morning-digest-hackernews-source.md` — .mjs refactor pattern]
- [Source: Context7 `/websites/newsapi` — `/v2/everything` parameters]
- [Source: `project-context.md` — verify gate, no new npm deps, Nexus intelligence principle]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor Agent)

### Debug Log References

- Fixture test initially returned 4 headlines because negative-case descriptions contained the substring "AI"; fixed fixture copy.

### Completion Notes List

- Extracted `fetch-newsapi-headlines.mjs` with tightened default `q`, rolling `from` window, `searchIn=title,description`, client-side `isOnTopicHeadline` filter, and object-shaped `headlines[]` including optional `url`.
- Refactored `hermes-run-newsapi.sh` to thin wrapper (HOME isolation + env bootstrap + `exec node`); removed inline Python.
- Updated skill docs to v1.4.0; documented new `MORNING_DIGEST_NEWSAPI_*` env vars in config-snippet and `trend-ingest.env.example`.
- Added `tests/morning-digest-newsapi.test.mjs` (19 tests) and extended skill contract tests for Story 64-6.
- `npm test`, `bash scripts/install-hermes-skill-morning-digest.sh`, and `bash scripts/verify.sh` all green.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs` (new)
- `scripts/session-close/hermes-run-newsapi.sh` (updated)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (updated)
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` (updated)
- `scripts/hermes-skill-examples/morning-digest/SKILL.md` (updated)
- `scripts/trend-ingest.env.example` (updated)
- `tests/morning-digest-newsapi.test.mjs` (new)
- `tests/hermes-morning-digest-skill.test.mjs` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)

### Review Findings

- 2026-06-08: Clean review — Blind Hunter, Edge Case Hunter, and Acceptance Auditor passed. 0 patch, 0 decision-needed, 1 defer (wrapper key gate before disabled path — pre-existing bash pattern; module handles disabled correctly when invoked directly).

### Change Log

- 2026-06-08: Story 64-6 — NewsAPI query tightening; .mjs module + thin wrapper + skill v1.4.0 + fixture tests.
- 2026-06-08: Code review complete — status `done`.
