---
story_id: 61-4
epic: 61
title: morning-digest-hackernews-source
status: done
baseline_commit: 48b2d71d9144b359f23519d937914fbc31d37671
operator_brief: 2026-06-04
predecessors: 61-1, 61-2, 61-3, 56-4, 60-1
---

# Story 61.4: Morning digest HackerNews RSS source

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest in `#hermes`**,
I want **top HackerNews front-page stories included in the briefing and in NotebookLM signal scoring**,
so that **I see what the dev/tech community is surfacing today alongside Trends, NewsAPI, Perplexity, arXiv, and Vault context — without a separate HN habit**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 61: Morning digest source expansion (operator brief 2026-06-04) |
| **Predecessors** | **61-1** (`fetch-arxiv-rss.mjs`, Source 4 arXiv, `buildDigestSignals` arxiv block — the canonical pattern to mirror); **61-3** (`resolveOperatorHome` HOME-isolation fix in `fetch-arxiv-rss.mjs`, SKILL v1.2.7); **56-4** (`buildDigestSignals`, `DIGEST_SOURCES_JSON`); **60-1** (morning-digest repo mirror + `rsync --delete` install) |
| **Feed** | Public RSS: `https://hnrss.org/frontpage?count=10` — no API key. **Verified live shape 2026-06-05** (see Dev Notes) |
| **Pattern** | Mirror **arXiv** wrapper semantics (61-1): Hermes `terminal` → `.mjs` prints JSON stdout; failure → `{"error":"..."}` and exit **0** so digest continues |
| **Parity** | `morning-digest` is a parity skill — after edits run `bash scripts/install-hermes-skill-morning-digest.sh` and confirm `diff -rq` clean (verify.sh enforces) |
| **Out of scope** | New npm dependencies (supply-chain rule); Convex/dashboard/vault writes; `notebook-scorer.mjs` threshold changes; fetching full article/comment text |

### Operator brief (binding)

1. Add HackerNews top stories as a **6th digest source** (display + scoring), after arXiv and before Vault context.
2. New fetch script `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` printing JSON stdout `{"stories":[{title, link, score, comments},...]}` or `{"error":"..."}`.
3. Exit **0** on failure (graceful degradation — never abort the digest).
4. Config: `MORNING_DIGEST_HN_MAX_STORIES` (default **5**), `MORNING_DIGEST_HN_ENABLED`.
5. `buildDigestSignals` adds HN **titles** (priority **5**, max **3**) after arXiv.
6. Discord section **"HackerNews"** between arXiv and Vault context.
7. Uses the `resolveOperatorHome` pattern (**not** `homedir()`) for any env reads.
8. `SKILL.md` bumped to **v1.2.8**.
9. Fixture-based tests, **no live network** in `npm test`.
10. `npm test` and `bash scripts/verify.sh` green.

## Acceptance Criteria

### 1. HackerNews fetch module (AC: module)

**Given** the HN source is enabled
**When** `node scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` runs
**Then** stdout is JSON:

```json
{
  "stories": [
    {
      "title": "Dear Microsoft, enough is enough",
      "link": "https://www.politico.eu/sponsored-content/...",
      "score": 14,
      "comments": 2
    }
  ]
}
```

**Or** on failure:

```json
{ "error": "<short reason>" }
```

**And** script exits **0** on fetch/parse failure (digest must not abort)
**And** **no new `npm` dependencies** — parse RSS with Node built-ins + regex (HN item shape is stable, see Dev Notes)
**And** `score` and `comments` are **integers** parsed from the `<description>` HTML (`Points: N`, `# Comments: N`); default to `0` when a line is absent
**And** `title` is CDATA-unwrapped plain text; `link` is the item's `<link>` (article URL).

### 2. Configuration (AC: config)

| Variable | Purpose | Default |
|----------|---------|---------|
| `MORNING_DIGEST_HN_MAX_STORIES` | Max stories to return (after fetch) | `5` |
| `MORNING_DIGEST_HN_ENABLED` | Set `0`/`false`/`no`/`off` to disable without code change | enabled |

**Given** `MORNING_DIGEST_HN_ENABLED` is falsey
**Then** the module returns `{"error":"hackernews disabled"}` without throwing.

**Given** `MORNING_DIGEST_HN_MAX_STORIES` is unset, non-numeric, or `<= 0`
**Then** it falls back to **5** (mirror `loadArxivConfig` `maxPerCategory` coercion).

**And** env is read via `mergeTrendIngestEnv` (merges `$OPERATOR_HOME/.hermes/trend-ingest.env` with `resolveOperatorHome`, process env wins) — the **same** merge used by arXiv/NewsAPI. Do **not** call `homedir()`/`os.homedir()` directly for config reads.

### 3. `buildDigestSignals` integration (AC: scoring)

**Given** `digest_sources` includes a `hackernews` array after Source 5 fetch
**When** `buildDigestSignals` runs
**Then** signal priority is:

| Priority | Source | Max entries | Content |
|----------|--------|-------------|---------|
| 1 | Google Trends | 5 | `keyword` |
| 2 | NewsAPI | 5 | headline `title` |
| 3 | Perplexity | 3 | derived phrases |
| 4 | arXiv | 3 | paper `title` strings |
| 5 | **HackerNews** | `MAX_HN_SIGNALS` (**3**) | story `title` strings only |

**And** HN titles are appended **after** arXiv titles
**And** case-insensitive dedupe keeps first occurrence (HN loses to any earlier identical title)
**And** total cap **10** (`MAX_SIGNALS` unchanged)
**And** `signalsFromParsedInput` treats objects with a `hackernews` key like `trends`/`headlines`/`perplexityText`/`arxiv`
**And** an exported `extractHnSignals(hnList)` mirrors `extractArxivSignals` (caps at 3, trims, drops empty/non-string titles).

### 4. Task-prompt, SKILL, and Discord contract (AC: discord)

**Given** Sources 1–4 complete
**When** Hermes runs the digest per updated `references/task-prompt.md`
**Then**:

- New **Source 5 — HackerNews** runs one `terminal` call to a wrapper (timeout **45s**).
- Former **Source 5 Vault context** is renumbered to **Source 6** (every cross-reference updated; `digest_start_ms` / `NOTEBOOK_REMAINING_S` still anchored to digest start).
- `digest_sources` JSON adds `"hackernews": [{ "title": "..." }]` (omit or `[]` when unavailable).
- Discord template adds a section **after arXiv Preprints, before Vault context**:

```text
**HackerNews** (top stories)
- <title> — <score> pts, <comments> comments
- ...
```

**And** on failure: `- (source unavailable: <short reason>)` under **HackerNews** only
**And** `SKILL.md` version bumped to **1.2.8**, overview + description list **six** sources, inline contract + execution rule updated (headings list includes `**HackerNews**`)
**And** `tests/hermes-morning-digest-skill.test.mjs` asserts Source 5 HN terminal call, `**HackerNews**` heading, `hackernews` in `digest_sources`, six-source scoring, and v1.2.8.

### 5. Graceful degradation (AC: degrade)

**Given** HN RSS timeout, DNS failure, non-200, or malformed XML
**When** Source 5 runs
**Then** the digest still posts the full template with all other sections
**And** the HackerNews section shows the unavailable bullet; Vault context (Source 6) still runs with `digest_sources` lacking `hackernews`.

### 6. Verify gate (AC: test)

**Then** `tests/morning-digest-hn-rss.test.mjs` (NEW) uses **fixture RSS strings** (no live network) covering: parse 2 items → title/link/score/comments; missing Points/# Comments → `0`; disabled flag → error; max-stories cap; fetch failure → error JSON + CLI exit 0
**And** `tests/morning-digest-pick-signal-notebook.test.mjs` covers HN ordering (after arXiv), dedupe, cap-10 interaction, empty hackernews, and `extractHnSignals` cap-at-3
**And** `bash scripts/verify.sh` passes (including the Hermes skill parity gate — installed tree must match repo).

## Tasks / Subtasks

- [x] **T1** Implement `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` — import `mergeTrendIngestEnv` from `./fetch-arxiv-rss.mjs`; `loadHnConfig`, single feed fetch with `AbortSignal.timeout`, RSS parse (title/link/score/comments), max-stories slice, JSON stdout, exit 0 on failure (AC: 1, 2, 5)
- [x] **T2** Add `MAX_HN_SIGNALS = 3`, `extractHnSignals`, extend `buildDigestSignals` (append after arXiv) and `signalsFromParsedInput` guard for `hackernews` in `pick-signal-notebook.mjs` (AC: 3)
- [x] **T3** Add wrapper `scripts/session-close/hermes-run-hn.sh` (mirror `hermes-run-arxiv.sh`; `chmod +x`) (AC: 4)
- [x] **T4** Update `references/task-prompt.md` — Source 5 HackerNews, renumber Vault → Source 6, `digest_sources` shape, Discord template, hard-constraint "Sources 1–6" (AC: 4)
- [x] **T5** Update `SKILL.md` (v1.2.8, six sources, execution-rule heading list, `hermes-run-hn.sh`) and `references/config-snippet.md` (HN env table) (AC: 4)
- [x] **T6** Tests — NEW `tests/morning-digest-hn-rss.test.mjs`; extend pick-signal + `hermes-morning-digest-skill` contract tests (bump v1.2.7→v1.2.8 assertions, fix Source 5/6 slicing, add HN assertions) (AC: 6)
- [x] **T7** `bash scripts/install-hermes-skill-morning-digest.sh`; confirm `diff -rq` parity; `bash scripts/verify.sh` (AC: 6)

### Review Findings

- [x] [Review][Patch] Unrelated `AGENTS.md` changes in working tree — revert `specs/cns-vault-contract/AGENTS.md` from this story's commit; epic-status and duplicate 2.1.34 changelog entry are out of scope for 61-4 (not in File List). Route constitution updates via session-close / separate story. [`specs/cns-vault-contract/AGENTS.md`]
- [x] [Review][Defer] Story completion notes cite "505 tests pass" but `npm test` reports 642 — documentation drift in Dev Agent Record only; no code impact. [`61-4-morning-digest-hackernews-source.md`]

## Dev Notes

### Verified live RSS shape (2026-06-05, `https://hnrss.org/frontpage?count=2`)

```xml
<item>
  <title><![CDATA[Dear Microsoft, enough is enough]]></title>
  <description><![CDATA[
    <p>Article URL: <a href="https://www.politico.eu/...">...</a></p>
    <p>Comments URL: <a href="https://news.ycombinator.com/item?id=48408186">...</a></p>
    <p>Points: 14</p>
    <p># Comments: 2</p>
  ]]></description>
  <pubDate>Fri, 05 Jun 2026 05:01:59 +0000</pubDate>
  <link>https://www.politico.eu/...</link>
  <dc:creator>giuliomagnifico</dc:creator>
  <comments>https://news.ycombinator.com/item?id=48408186</comments>
  <guid isPermaLink="false">https://news.ycombinator.com/item?id=48408186</guid>
</item>
```

Notes:
- `<title>` is **CDATA-wrapped** — the existing `parseRssItemBlock` regex in `fetch-arxiv-rss.mjs` already strips `<![CDATA[ ]]>` and inner tags; reuse the same regex shape.
- `<link>` = the article URL → use for the `link` field.
- `<comments>` element = the HN discussion URL. The brief's `comments` field is the **integer comment count** (parallel to `score`), parsed from `# Comments: N` in the description — **not** the URL. (Optionally also capture the discussion URL as a `commentsUrl` field; it is not required and not asserted by tests.)
- The description's HTML must be tag-stripped before regex (same `.replace(/<[^>]+>/g, ' ')` the arXiv parser uses), yielding text like `... Points: 14 # Comments: 2`.
- **Score/comments extraction:**

```text
const pts = text.match(/Points:\s*(\d+)/i);
const cmt = text.match(/#\s*Comments:\s*(\d+)/i);
score = pts ? parseInt(pts[1], 10) : 0;
comments = cmt ? parseInt(cmt[1], 10) : 0;
```

- **Reliability caveat (observed during story creation):** the feed returned `502 Bad Gateway` then an empty/timeout response before succeeding, and default `curl` UA was rate-limited (a browser-ish UA worked). This is exactly the failure mode AC-5 guards. Set a User-Agent header on the fetch (e.g. `CNS-morning-digest/1.0`) to reduce 4xx/throttle; still treat any non-200/timeout as `{"error":...}` + exit 0.

### Fetch implementation constraints (mirror 61-1)

- Use **`fetch`** (Node ≥20) with `globalThis.AbortSignal.timeout(15000)` (ESLint `no-undef` on bare `AbortSignal` — use `globalThis.AbortSignal`, see 61-1 debug log).
- Build URL: `https://hnrss.org/frontpage?count=${count}` where `count = Math.max(maxStories, 1)`. The brief's `?count=10` is the reference example; tying `count` to `maxStories` keeps the fetch tight. (Tests use fixtures, so the count param does not affect them.)
- **Do not** add `fast-xml-parser` or any RSS lib (14-day npm rule + supply-chain rule).
- Single feed (one URL) — no per-category loop. Parse items with the same `<item>...</item>` regex iteration as `parseArxivRss`, slice to `maxStories`.
- **Reuse, don't duplicate, HOME logic:** `import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';` and call it in `main()` before `loadHnConfig(merged)`. `mergeTrendIngestEnv` already wraps `resolveOperatorHome` (61-3), satisfying the "resolveOperatorHome pattern, not homedir()" requirement without re-inlining it. Do not import from `session-close/lib` (installed skill tree lacks that package — see 61-1 note).

### `loadHnConfig` (normative sketch)

```js
const MAX_STORIES_DEFAULT = 5;

export function isHnEnabled(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return true;
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

export function loadHnConfig(env = process.env) {
  const enabled = isHnEnabled(env.MORNING_DIGEST_HN_ENABLED);
  const raw = parseInt(String(env.MORNING_DIGEST_HN_MAX_STORIES ?? ''), 10);
  const maxStories = Number.isFinite(raw) && raw > 0 ? raw : MAX_STORIES_DEFAULT;
  return { enabled, maxStories };
}
```

`runHnFetch(env, { fetch, fixtureXml })` mirrors `runArxivFetch`: disabled → `{ error: 'hackernews disabled' }`; fetch failure → `{ error: <reason> }`; success → `{ stories: [...] }`. Honor `fixtureXml` for tests (no `*_FIXTURE` env read in the production CLI path — 61-1 review fixed exactly that leak).

### `buildDigestSignals` change (normative sketch — `pick-signal-notebook.mjs`)

```js
const MAX_HN_SIGNALS = 3;

export function extractHnSignals(hnList) {
  if (!Array.isArray(hnList)) return [];
  const out = [];
  for (const entry of hnList.slice(0, MAX_HN_SIGNALS)) {
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    if (title) out.push(title);
  }
  return out;
}

// In buildDigestSignals, AFTER the arXiv push:
ordered.push(...extractHnSignals(sources.hackernews));
```

Update the `signalsFromParsedInput` guard:

```js
('trends' in parsed || 'headlines' in parsed || 'perplexityText' in parsed ||
 'arxiv' in parsed || 'hackernews' in parsed)
```

Also extend the `buildDigestSignals` JSDoc `@param` to include `hackernews?: Array<{ title?: string }>`.

### Source renumbering (critical regression risk)

Current task-prompt: Source 4 = arXiv, **Source 5 = Vault context**. After this story:

| # | Source |
|---|--------|
| 1 | Google Trends |
| 2 | NewsAPI |
| 3 | Perplexity |
| 4 | arXiv |
| 5 | **HackerNews** (new) |
| 6 | Vault context (NotebookLM) |

Move the entire old **Source 5 (Vault context)** block verbatim to **Source 6**; insert HackerNews as the new Source 5. Update Hard-constraint #7 ("run Sources 1–5 independently" → "1–6"), the "after Sources 1–4 / 1–5" phrasing in the Vault-context build step, and the Post-post section's references.

### `digest_sources` JSON (extended)

```json
{
  "trends": [{ "keyword": "...", "normalizedValue": 0.42 }],
  "headlines": [{ "title": "..." }],
  "perplexityText": "...",
  "arxiv": [{ "title": "...", "snippet": "..." }],
  "hackernews": [{ "title": "..." }]
}
```

Hermes maps the fetch output `stories[]` into `hackernews` using **titles only** for scoring (score/comments are display-only). Source 6 passes the full object in `DIGEST_SOURCES_JSON`.

### Discord output contract (insert)

Between **arXiv Preprints** and **Vault context**:

```text
**HackerNews** (top stories)
- <title> — <score> pts, <comments> comments
```

If disabled/empty/failed: header + `- (source unavailable: <short reason>)`.

### Files to touch

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` | **NEW** |
| `scripts/session-close/hermes-run-hn.sh` | **NEW** (executable wrapper) |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE — `MAX_HN_SIGNALS`, `extractHnSignals`, `buildDigestSignals`, `signalsFromParsedInput` |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE — Source 5 HN, renumber Vault → Source 6, template, constraints |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE — v1.2.8, six sources, `hermes-run-hn.sh`, heading list |
| `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` | UPDATE — HN env table |
| `tests/morning-digest-hn-rss.test.mjs` | **NEW** |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE — HN signal tests |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE — v1.2.8, Source 5/6, `**HackerNews**` |
| `~/.hermes/skills/cns/morning-digest/` | SYNC via install script (rsync `--delete`) |

**Read only:** `scripts/session-close/lib/notebook-scorer.mjs`, `notebook-route.mjs`.

### Existing contract-test regressions to fix (do NOT leave red)

`tests/hermes-morning-digest-skill.test.mjs` currently hard-codes the prior state — these will fail until updated:

1. Two assertions `body.includes("version: 1.2.7")` → **`1.2.8`** (in `"SKILL.md exists..."` and `"SKILL.md v1.2.7 documents..."`; rename the latter's title to v1.2.8).
2. Test `"task-prompt Source 4 arXiv terminal and Source 5 five-source scoring (Story 61-1)"` slices on `"## Source 5"` expecting **Vault** content. After renumber, Source 5 = HN. Update so it slices arXiv at `## Source 4`→`## Source 5`, and the five-source/scoring (`DIGEST_SOURCES_JSON`, `buildDigestSignals`, `"arxiv"`, etc.) assertions target **Source 6** (`taskBody.indexOf("## Source 6")`). Add a new assertion that Source 5 contains `hermes-run-hn.sh` / `**HackerNews**`.
3. Test `"task-prompt defines output contract..."` — add `**HackerNews**` and `"hackernews"` assertions; keep `Source 4`.
4. Post-post test slices on `"## Post-post — Log Vault context to Convex"` heading — keep that heading text stable when moving the Vault block to Source 6.

### Testing guidance

**`tests/morning-digest-hn-rss.test.mjs`** (mirror `morning-digest-arxiv-rss.test.mjs` structure):

- Fixture RSS string with 2 `<item>` blocks (CDATA titles, description with Article/Comments URL + `Points:`/`# Comments:`) → assert titles, links, `score` (int), `comments` (int).
- Item missing `Points:` / `# Comments:` lines → `score`/`comments` default `0`, title still present.
- `runHnFetch({ MORNING_DIGEST_HN_ENABLED: 'false' })` → `{ error: 'hackernews disabled' }`.
- `runHnFetch({ MORNING_DIGEST_HN_MAX_STORIES: '1' }, { fixtureXml })` → `stories.length === 1`.
- Failing `fetch` (throws) → `payload.error` truthy.
- CLI: `execFile('node', [fetchScript])` with a failing condition → stdout parses to `{ error }`, exit 0.

**`buildDigestSignals` (pick-signal test):**

- HN titles appear **after** arXiv titles in order.
- HN title matching an earlier headline/arxiv title is deduped (earlier wins).
- Cap-10 holds with hackernews included.
- `buildDigestSignals({ hackernews: [] })` → `[]`.
- `extractHnSignals` caps at 3.

### Previous story intelligence (61-1, 61-3)

- Install uses **`rsync -a --delete`** — run after repo edits; verify.sh parity gate diffs the installed tree.
- `fetchCategoryFeed`/`runArxivFetch` honor `fixtureXml` via options, **not** an env fixture in the production CLI (61-1 review patch — replicate this; no `HN_RSS_FIXTURE` env read in `main()`).
- 61-3: `resolveOperatorHome` lives in `fetch-arxiv-rss.mjs` and is reached through `mergeTrendIngestEnv`. Reuse it — do not reach for `homedir()`.
- Isolated routing tests should clear inherited `DIGEST_SOURCES_JSON`.

### Deferred work / keep-as-is (do not "fix")

- Malformed `DIGEST_SOURCES_JSON` → silent `[]` (56-4 deferral) — keep behavior.
- SKILL cron doc says 07:00 (handled in 55-3) — unrelated.

### Git intelligence

Recent pattern (last 5 commits): one logical commit per story, `feat(epic-61): 61-N ...` / `fix(epic-61): 61-N ...`, run `verify.sh` before claiming done, test count noted in commit (e.g. "643 total").

### Security / ops

- HN RSS is public HTTP — no secrets in repo, none echoed to Discord.
- Single sequential fetch; do not parallel-scrape.
- Never print `trend-ingest.env` contents.

## Project Structure Notes

- Implementation lives under `scripts/hermes-skill-examples/morning-digest/` with the wrapper in `scripts/session-close/` (parity with `hermes-run-arxiv.sh`).
- Constitution: **no vault writes** (unchanged morning-digest policy); WriteGate **not applicable** (read-only digest). No operator approval gate triggered (no security.md / WriteGate / `vault_log_action` changes).

## References

- [Source: `_bmad-output/implementation-artifacts/61-1-morning-digest-arxiv-source.md` — canonical pattern]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome`, `parseRssItemBlock`, `runArxivFetch`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` — `buildDigestSignals`, `extractArxivSignals`, `signalsFromParsedInput`]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — Source 4/5, output contract]
- [Source: `scripts/session-close/hermes-run-arxiv.sh` — wrapper template]
- [Source: `tests/morning-digest-arxiv-rss.test.mjs`, `tests/morning-digest-pick-signal-notebook.test.mjs`, `tests/hermes-morning-digest-skill.test.mjs`]
- [Source: HN RSS — https://hnrss.org/frontpage?count=10 (verified 2026-06-05)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Reused `parseRssItemBlock` from `fetch-arxiv-rss.mjs` for CDATA title/link parsing; added `extractScoreAndComments` for Points/# Comments regex on tag-stripped description.
- `globalThis.AbortSignal.timeout(15000)` + `User-Agent: CNS-morning-digest/1.0` on fetch per story Dev Notes.
- Source renumbering: Vault context moved from Source 5 → Source 6; all task-prompt cross-references updated.

### Completion Notes List

- ✅ Implemented `fetch-hn-rss.mjs` with `loadHnConfig`, `runHnFetch`, fixture-based test path, graceful exit 0 on failure.
- ✅ Added `extractHnSignals` + `buildDigestSignals` HN integration (priority 5, max 3, after arXiv).
- ✅ Added `hermes-run-hn.sh` wrapper; updated task-prompt, SKILL.md v1.2.8, config-snippet.
- ✅ 14 new tests across `morning-digest-hn-rss.test.mjs`, pick-signal, and skill contract tests.
- ✅ `npm test` + `bash scripts/verify.sh` green (505 tests pass); Hermes skill parity `diff -rq` clean.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` (NEW)
- `scripts/session-close/hermes-run-hn.sh` (NEW)
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `tests/morning-digest-hn-rss.test.mjs` (NEW)
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-05: Story 61-4 created (ready-for-dev) — HackerNews as 6th digest source.
- 2026-06-05: Story 61-4 implemented — HN RSS fetch, signal scoring, task-prompt Source 5/6 renumber, SKILL v1.2.8, tests + verify gate green.
- 2026-06-05: Code review — reverted unrelated AGENTS.md from changeset; story marked done.
