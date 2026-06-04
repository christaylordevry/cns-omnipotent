---
story_id: 61-1
epic: 61
title: morning-digest-arxiv-source
status: review
baseline_commit: 807268f11c88e6989d067987390c666ecf126c31
operator_brief: 2026-06-04
predecessors: 49-6, 52-1, 52-2, 55-1, 55-3, 56-4, 60-1
---

# Story 61.1: Morning digest arXiv source

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest in `#hermes`**,  
I want **recent arXiv preprints from configurable categories included in the briefing and in NotebookLM signal scoring**,  
so that **I see ML/AI research drops alongside Trends, NewsAPI, Perplexity, and Vault context without a separate RSS habit**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 61: Morning digest arXiv source (operator brief 2026-06-04) |
| **Predecessors** | **56-4** (`buildDigestSignals`, `DIGEST_SOURCES_JSON`); **60-1** (morning-digest repo mirror + `rsync --delete` install); **55-1** (trigger/task-prompt contract tests) |
| **Feed** | Public RSS: `https://rss.arxiv.org/rss/<category>` (e.g. `cs.AI`, `cs.LG`, `stat.ML`) — no API key |
| **Pattern** | Mirror **NewsAPI** wrapper semantics: Hermes `terminal` → script prints JSON stdout; non-zero HTTP → `{"error":"..."}` and exit **0** so digest continues |
| **Parity** | `morning-digest` is in `parity_skills` — after edits run `bash scripts/install-hermes-skill-morning-digest.sh` and confirm `diff -rq` clean |
| **Out of scope** | New npm dependencies (supply-chain rule); Convex/dashboard/vault writes; `notebook-scorer.mjs` threshold changes; arXiv PDF download |

### Operator brief (binding)

1. Add arXiv as a **5th digest source** (display + scoring), alongside Google Trends, NewsAPI, Perplexity, NotebookLM Vault context.
2. Fetch top **N** entries per configured category; emit **title + abstract snippet** for Discord and scoring.
3. Include arXiv titles in `buildDigestSignals` / `DIGEST_SOURCES_JSON` scored signal block.
4. Categories and max entries **configurable** (env or skill config) — **do not** hardcode `cs.AI` only.
5. Graceful degradation if RSS unreachable.
6. `npm test` and `bash scripts/verify.sh` green.

## Acceptance Criteria

### 1. arXiv fetch module (AC: module)

**Given** one or more valid arXiv category codes in configuration  
**When** `node scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` runs (or thin bash wrapper documented in Completion Notes)  
**Then** stdout is JSON:

```json
{
  "papers": [
    {
      "category": "cs.AI",
      "title": "...",
      "link": "https://arxiv.org/abs/...",
      "snippet": "...",
      "pubDate": "..."
    }
  ]
}
```

**Or** on failure:

```json
{ "error": "<short reason>" }
```

**And** script exits **0** on fetch/parse failure (digest must not abort)  
**And** no new `npm` dependencies (parse RSS with Node built-ins + string/regex extraction; arXiv item shape is stable — see Dev Notes)  
**And** abstract `snippet` is trimmed (target **~200 chars**, word-safe) from RSS `<description>` after `Abstract:` prefix.

### 2. Configuration (AC: config)

**Given** operator environment  
**When** categories are unset or empty after trim  
**Then** fetch module returns `{"papers":[]}` or `{"error":"arxiv disabled"}` without throwing  
**And** default categories are **not** baked into code as the only path — document defaults in `references/config-snippet.md` only (e.g. `cs.AI,cs.LG,stat.ML` as **example**, loaded when env set).

**Configuration (implementer picks one primary + optional secondary):**

| Variable | Purpose | Example |
|----------|---------|---------|
| `MORNING_DIGEST_ARXIV_CATEGORIES` | Comma-separated category codes | `cs.AI,cs.LG,stat.ML` |
| `MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY` | Max items per feed (RSS order = newest first) | `3` |
| `MORNING_DIGEST_ARXIV_ENABLED` | Optional `0`/`false` to disable without unsetting categories | `1` |

May also read the same keys from `$HOME/.hermes/trend-ingest.env` if present (parity with `NEWSAPI_API_KEY` host file) — document in config-snippet.

### 3. `buildDigestSignals` integration (AC: scoring)

**Given** `digest_sources` includes an `arxiv` array after Source 4 fetch  
**When** `buildDigestSignals` runs  
**Then** signal priority is:

| Priority | Source | Max entries | Content |
|----------|--------|-------------|---------|
| 1 | Google Trends | 5 | `keyword` |
| 2 | NewsAPI | 5 | headline `title` |
| 3 | Perplexity | 3 | derived phrases |
| 4 | arXiv | `MAX_ARXIV_SIGNALS` (recommend **3**) | paper `title` strings only |

**And** case-insensitive dedupe keeps first occurrence (arxiv after perplexity-derived)  
**And** total cap **10** (`MAX_SIGNALS` unchanged)  
**And** `signalsFromParsedInput` treats objects with `arxiv` key like `trends`/`headlines`/`perplexityText`.

### 4. Task-prompt, SKILL, and Discord contract (AC: discord)

**Given** Sources 1–3 complete  
**When** Hermes runs the digest per updated `references/task-prompt.md`  
**Then**:

- New **Source 4 — arXiv** runs one `terminal` call to the fetch script (timeout **45s**).
- Former **Source 4 Vault context** is renumbered to **Source 5** (all cross-references updated).
- `digest_sources` JSON adds `"arxiv": [{ "title": "...", "snippet": "..." }]` (omit or `[]` when unavailable).
- Discord template adds section **after Deep Signal, before Vault context**:

```text
**arXiv Preprints** (<category list or "configured categories">)
- <title> — <snippet>
- ...
```

**And** on failure: `- (source unavailable: <short reason>)` under **arXiv Preprints** only  
**And** `SKILL.md` version bump (≥ **1.2.5**), overview lists five sources, inline contract updated  
**And** `tests/hermes-morning-digest-skill.test.mjs` asserts Source 4 arxiv terminal call, section heading, `arxiv` in `digest_sources`, five-source scoring mention.

### 5. Graceful degradation (AC: degrade)

**Given** arXiv RSS timeout, DNS failure, non-200, or malformed XML  
**When** Source 4 runs  
**Then** digest still posts full template with other sections  
**And** arXiv section shows unavailable bullet; Vault context (Source 5) still runs with `digest_sources` lacking arxiv papers.

### 6. Verify gate (AC: test)

**Then** `tests/morning-digest-pick-signal-notebook.test.mjs` covers arxiv ordering, dedupe, cap-10 interaction, empty arxiv  
**And** unit tests for `fetch-arxiv-rss.mjs` use **fixture RSS strings** (no live network in `npm test`)  
**And** `bash scripts/verify.sh` passes (including Hermes skill parity gate).

## Tasks / Subtasks

- [x] **T1** Implement `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` — config load, multi-category fetch, RSS parse, snippet extract, JSON stdout (AC: 1, 2, 5)
- [x] **T2** Extend `buildDigestSignals` + `signalsFromParsedInput` for `arxiv` titles; export `extractArxivSignals` if it aids tests (AC: 3)
- [x] **T3** Update `references/task-prompt.md` — Source 4 arxiv, renumber Vault → Source 5, `digest_sources` shape, Discord template (AC: 4)
- [x] **T4** Update `SKILL.md` (v1.2.5), `references/config-snippet.md` env table (AC: 4)
- [x] **T5** Tests — `tests/morning-digest-arxiv-rss.test.mjs` (fixtures), extend pick-signal + hermes-morning-digest contract tests (AC: 6)
- [x] **T6** `bash scripts/install-hermes-skill-morning-digest.sh`; `diff -rq` parity; `bash scripts/verify.sh` (AC: 6)

### Review Findings

- [x] [Review][Patch] task-prompt shell-quote step mislabeled as Source 4 [references/task-prompt.md:132] — fixed: Source 5 pick-signal / query env quoting.
- [x] [Review][Patch] No cap on configured category count [fetch-arxiv-rss.mjs] — fixed: `MAX_ARXIV_CATEGORIES = 3`; config-snippet documents limit.
- [x] [Review][Patch] `ARXIV_RSS_FIXTURE` honored in production CLI [fetch-arxiv-rss.mjs] — fixed: removed from CLI `main()`; tests use `runArxivFetch({ fixtureXml })`.
- [x] [Review][Defer] Partial per-category RSS failure returns subset without error [fetch-arxiv-rss.mjs:230-237] — deferred, acceptable degradation when at least one category succeeds; matches continue-on-failure loop intent.

## Dev Notes

### RSS shape (verified 2026-06-04)

Feed `https://rss.arxiv.org/rss/cs.AI` returns RSS 2.0 with `<item>` elements:

- `<title>` — paper title (plain text)
- `<link>` — `https://arxiv.org/abs/...`
- `<description>` — contains `arXiv:… Announce Type: new` then `Abstract: <full abstract>`

**Snippet extraction:**

```text
const m = description.match(/Abstract:\s*([\s\S]+)/);
snippet = m ? m[1].trim().slice(0, 200) : '';
```

Strip newlines in snippet for single-line Discord bullets.

### Fetch implementation constraints

- Use **`fetch`** (Node ≥20) with `AbortSignal.timeout(15000)` per category; sequential category loop is fine (3 categories × 15s < 45s terminal timeout).
- Validate category: `^[a-zA-Z0-9._+-]+$` — reject others to avoid URL injection.
- **Do not** add `fast-xml-parser` or similar without operator approval (14-day npm rule).
- Optional: thin `scripts/session-close/hermes-run-arxiv.sh` that `cd`s to repo and `exec node .../fetch-arxiv-rss.mjs` for symmetry with `hermes-run-newsapi.sh` — if added, keep logic in `.mjs` and test the module.

### `buildDigestSignals` change (normative sketch)

```js
const MAX_ARXIV_SIGNALS = 3;

// After perplexity block in buildDigestSignals:
const arxivList = Array.isArray(sources.arxiv) ? sources.arxiv : [];
for (const entry of arxivList.slice(0, MAX_ARXIV_SIGNALS)) {
  const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
  if (title) ordered.push(title);
}
```

Update `signalsFromParsedInput` guard:

```js
('trends' in parsed || 'headlines' in parsed || 'perplexityText' in parsed || 'arxiv' in parsed)
```

### Source renumbering (critical)

Current task-prompt **Source 4** = Vault context. After this story:

| # | Source |
|---|--------|
| 1 | Google Trends |
| 2 | NewsAPI |
| 3 | Perplexity |
| 4 | **arXiv** (new) |
| 5 | Vault context (NotebookLM) |

Update **every** reference: `digest_start_ms` / `NOTEBOOK_REMAINING_S` still tied to digest start; Source 5 pick/query/log blocks move verbatim from old Source 4.

### `digest_sources` JSON (extended)

```json
{
  "trends": [{ "keyword": "...", "normalizedValue": 0.42 }],
  "headlines": [{ "title": "..." }],
  "perplexityText": "...",
  "arxiv": [{ "title": "...", "snippet": "..." }]
}
```

Hermes assembles after Sources 1–4; Source 5 passes full object in `DIGEST_SOURCES_JSON`.

### Discord output contract (insert)

Between **Deep Signal** and **Vault context**:

```text
**arXiv Preprints** (cs.AI, cs.LG)
- <title> — <snippet>
```

If multiple categories configured, parenthetical lists them. If disabled/empty: section header + unavailable bullet.

### Files to touch

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` | **NEW** |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE — `buildDigestSignals`, env parser |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE — sources 4/5, template |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE — v1.2.5, five sources |
| `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` | UPDATE — arxiv env keys |
| `tests/morning-digest-arxiv-rss.test.mjs` | **NEW** |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `scripts/session-close/hermes-run-arxiv.sh` | OPTIONAL wrapper |
| `~/.hermes/skills/cns/morning-digest/` | SYNC via install script |

**Read only:** `scripts/session-close/lib/notebook-scorer.mjs`, `notebook-route.mjs`.

### Testing guidance

**`tests/morning-digest-arxiv-rss.test.mjs`:**

- Fixture RSS string with 2 `<item>` blocks → parse titles, snippets, links.
- `Abstract:` missing → empty snippet, title still present.
- Invalid category env → error JSON, exit 0.
- Mock `global.fetch` or pass `RSS_FIXTURE` env read by module for testability.

**`buildDigestSignals`:**

- arxiv titles appear after perplexity signals in order test.
- Dedupe: arxiv title matching headline dropped if headline wins (headline priority 2 < arxiv 4 — headline kept first).

**Contract (`hermes-morning-digest-skill.test.mjs`):**

- `fetch-arxiv-rss.mjs` path in task-prompt `terminal(command=...)`
- `**arXiv Preprints**`
- `"arxiv"` in Source 5 / `digest_sources` section
- Source 5 still has `DIGEST_SOURCES_JSON` + `buildDigestSignals`

### Previous story intelligence (60-1)

- Install uses **`rsync -a --delete`** — run after repo edits.
- `pick-signal-notebook.mjs` in repo is SSOT; `parseRegistryPath` handles argv[3] + env.
- Pitfalls: clear `DIGEST_SOURCES_JSON` in isolated routing tests.

### Deferred work (do not fix in 61-1 unless blocking)

- Malformed `DIGEST_SOURCES_JSON` → silent `[]` (56-4 deferral) — keep behavior.
- SKILL cron doc still says 08:00 machine-local (55-3 deferral).

### Git intelligence

Recent pattern: small epic commits (`feat(epic-60): 60-1 ...`), verify before claim done, one logical commit per story.

### Security / ops

- arXiv RSS is public HTTP — no secrets in repo.
- Rate-limit: stay sequential; do not parallel-scrape dozens of categories.
- Never echo env file contents in Discord.

## Project Structure Notes

- Implementation lives under `scripts/hermes-skill-examples/morning-digest/` per operator brief; session-close wrappers optional only.
- Constitution: **no vault writes** (unchanged morning-digest policy).
- WriteGate: **not applicable** (read-only digest).

## References

- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` — `buildDigestSignals`]
- [Source: `_bmad-output/implementation-artifacts/56-4-morning-digest-signal-scoring-improvements.md`]
- [Source: `_bmad-output/implementation-artifacts/60-1-fix-verify-sh-hermes-skill-parity-gate.md`]
- [Source: `scripts/session-close/hermes-run-newsapi.sh` — JSON error pattern]
- [Source: arXiv RSS — https://rss.arxiv.org/rss/cs.AI]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- ESLint `no-undef` on `AbortSignal` — fixed via `globalThis.AbortSignal.timeout`.

### Completion Notes List

- Added `fetch-arxiv-rss.mjs` with env + `~/.hermes/trend-ingest.env` merge, category validation, RSS parse (no new npm deps), graceful `{"error":...}` + exit 0.
- Added `hermes-run-arxiv.sh` wrapper; Source 4 arXiv / Source 5 Vault renumber in task-prompt; Discord **arXiv Preprints** section.
- Extended `buildDigestSignals` / `signalsFromParsedInput` with `extractArxivSignals` (priority 4, max 3).
- SKILL v1.2.5 + config-snippet arXiv env table; contract tests in `morning-digest-arxiv-rss.test.mjs` and hermes skill tests.
- `npm test` and `bash scripts/verify.sh` pass; Hermes skill installed with `rsync --delete`.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` (new)
- `scripts/session-close/hermes-run-arxiv.sh` (new)
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `tests/morning-digest-arxiv-rss.test.mjs` (new)
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-04: Story 61-1 — arXiv as 5th digest source (fetch, scoring, contract, tests).
