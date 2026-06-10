# Task: `morning-digest` (Story 49-6 + 52-1 + 52-2 + 64-5)

## 0) REFERENCE ONLY — invocation already confirmed

> **You have already been invoked.** The `config.yaml` trigger matched the incoming Discord message (manual `morning-digest` line or cron pseudo-trigger). Do not re-check or re-evaluate the Hermes skill binding.
> Proceed directly to **Hard constraints** and source collection — do not ask whether to run the digest.

For documentation purposes only (do not re-evaluate at runtime):

- Manual trigger: first non-empty line equals `morning-digest` or begins with `morning-digest ` (case-sensitive; single-line message). See `references/trigger-pattern.md`.
- Cron: operator schedule per `references/cron-snippet.md` / `references/trigger-pattern.md` (`--skill morning-digest`; not the Discord line-1 grammar).

## REQUIRED SOURCES — terminal checklist (non-negotiable)

> **Pin this block.** Invoke **every** step below (via `terminal` or MCP) **before** posting to `#hermes` or calling §9/§10 push scripts. Do **not** post the Discord digest or invoke `push-digest-convex.mjs` / `push-keyword-candidates.mjs` until **all** source terminals in this list have fired. A failed source still counts as fired when you record `(source unavailable: …)` in the Output Contract — **skipping** a terminal is not allowed.

**Strict collection order:** 1 → 2 → 3 → 4 → 5 → 7 → 8 → 9 → 10 → 6

| Step | Source | Required invocation |
|------|--------|---------------------|
| 0 | Date | `terminal(...)` machine-local date (Tool-call rule below) |
| 1 | Google Trends | `terminal(command="bash scripts/session-close/hermes-run-trend-ingest.sh", …)` |
| 2 | NewsAPI | `terminal(command="bash scripts/session-close/hermes-run-newsapi.sh", …)` |
| 3 | Perplexity | `mcp__perplexity__search` once (when Source 1 yields a top keyword) |
| 4 | arXiv | `terminal(command="bash scripts/session-close/hermes-run-arxiv.sh", …)` |
| 5 | HackerNews | `terminal(command="bash scripts/session-close/hermes-run-hn.sh", …)` |
| 7 | GitHub | `terminal(command="bash scripts/session-close/hermes-run-github.sh", …)` |
| 8 | Reddit | `terminal(command="bash scripts/session-close/hermes-run-reddit.sh", …)` |
| 9 | Newsletters / RSS | `terminal(command="bash scripts/session-close/hermes-run-rss.sh", …)` |
| 10 | Product Hunt | `terminal(command="bash scripts/session-close/hermes-run-producthunt.sh", …)` |
| 6 | Vault context | `pick-signal-notebook.mjs`, then `query-notebook.mjs` when ROUTED (Source 6) |

**Gate:** Only after steps **0, 1, 2, 3, 4, 5, 7, 8, 9, 10, and 6** complete → post the full Output Contract to `#hermes` → §9 `push-digest-convex.mjs` → §10 `push-keyword-candidates.mjs`.

## Hard constraints (must follow)

1. **Channel**: Discord `#hermes` only.
2. **No vault writes**: no Vault IO mutators, no files under `Knowledge-Vault-ACTIVE/`, no `00-Inbox/` captures.
3. **No dashboard relay**, no digest archive JSONL. **NotebookLM:** read-only via `query-notebook.mjs` after signal scoring — no `source_add`, no session-close fan-out, no `mcp__notebooklm__notebook_query`.
4. **Google Trends**: call the Hermes `terminal` tool with command `bash scripts/session-close/hermes-run-trend-ingest.sh` (wrapper must keep `--dry-run`). Dry-run prints JSON only — **no Convex push**, no norm-cache write.
5. **Secrets**: never echo `NEWSAPI_API_KEY` in Discord. Load credentials from **`$HOME/.hermes/trend-ingest.env`** only (never cwd-relative `.hermes/` or `./trend-ingest.env`). Under Hermes isolation the wrapper scripts remap `$HOME` back to the operator's real home (Epic 59), so this resolves to the operator's `~/.hermes/trend-ingest.env` and not the isolated `…/.hermes/home/.hermes/...` path.
6. **Date line**: `YYYY-MM-DD` from **machine-local** civil date (`process.env.TZ` if set, else OS default). Do not hardcode a region timezone in commands or config.
7. **Cross-source failures**: run Sources **1–5, 7–10, and 6** independently (collection order: 1 → 2 → 3 → 4 → 5 → 7 → 8 → 9 → 10 → 6). A failed source must not abort the digest — always post the full contract with `(source unavailable: …)` in the affected section(s).
8. **Digest wall clock**: record `digest_start_ms = Date.now()` at the start of task execution (before Source 1). Use it for Source 6 `NOTEBOOK_REMAINING_S` (see Source 6).
9. **Required completion gate (non-negotiable)**: After the Discord post, invoke **BOTH** `push-digest-convex.mjs` (§9) **AND** `push-keyword-candidates.mjs` (§10) with the same `DIGEST_PUSH_JSON`. The skill is **NOT complete** until both terminal calls have fired. Steps 9+10 are a single two-part completion gate — neither push alone is sufficient. This requirement is **non-negotiable even under context compression** — never drop, defer, summarize, or deprioritize either call. ("fire-and-forget" describes only how each push *result* is handled — exit 0, no Discord warning — it never means either call is skippable.)

## Tool-call rule

Do not treat shell snippets as instructions for the model to summarize. For every local command below, actually invoke the Hermes `terminal` tool using the explicit `terminal(command="...", workdir="...", timeout=<seconds>)` shape.

Resolve **`resolved_repo_root`** as:

- `OMNIPOTENT_REPO` when that environment variable is set to a non-empty absolute path.
- Otherwise `/home/christ/ai-factory/projects/Omnipotent.md`.

Use `resolved_repo_root` as the `workdir` argument for every `terminal(...)` call in this task.

Before source collection, call `terminal` once to get the machine-local date:

`terminal(command="node -e \"const d=new Date(); const p=n=>String(n).padStart(2,'0'); console.log(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()))\"", workdir=resolved_repo_root, timeout=10)`

Use that stdout value for `<YYYY-MM-DD>`.

## Source 1 — Google Trends

Call `terminal` exactly once for Google Trends:

`terminal(command="bash scripts/session-close/hermes-run-trend-ingest.sh", workdir=resolved_repo_root, timeout=60)`

The wrapper runs `trend-ingest.py` with **`--dry-run`** (mandatory): stdout JSON only; ingest does **not** call Convex or persist norm-cache updates.

If the command exits non-zero or stdout is not valid JSON, treat Source 1 as failed and **continue** to Source 2.

Parse stdout JSON:

- `events[]` with `keyword`, `normalizedValue` (0–1), `value` (0–100).
- Sort by `normalizedValue` descending; take top **5**.
- Display score: `round(normalizedValue * 100)` or integer `value`.

On failure: section header + `- (source unavailable: <short reason>)`.

Requires `~/.hermes/trend-watchlist.yaml` and `pytrends` (Operator Guide §16.5).

## Source 2 — NewsAPI headlines

Call `terminal` exactly once for NewsAPI. This command reads credentials only from the `$HOME/.hermes/trend-ingest.env` path — the wrapper remaps `$HOME` back to the operator home under Hermes isolation (Epic 59) — and prints JSON with either `{"headlines":[...]}` or `{"error":"..."}`:

```text
terminal(command="bash scripts/session-close/hermes-run-newsapi.sh", workdir=resolved_repo_root, timeout=45)
```

Load `NEWSAPI_API_KEY` from that path only. **Do not** use repo-relative or cwd-relative env paths.

Request (one call per digest; implemented in `fetch-newsapi-headlines.mjs`):

- Endpoint: `https://newsapi.org/v2/everything`
- Query (`q`): CNS-focused OR group — `"artificial intelligence"`, `"AI agents"`, `"large language model"`, `LLM`, `"agentic AI"`, `MCP`, `"knowledge management"`, `"AI assistant"` — **without** bare `automation`; excludes `sports`, `celebrity`, `"reality TV"`, `"stock market"`, `cryptocurrency`, `bitcoin`, `ethereum`
- Params: `searchIn=title,description`, `sortBy=publishedAt`, `language=en`, `from=<rolling window ISO 8601>`, `pageSize=20` (fetch pool before client-side filter)
- Rolling window: `MORNING_DIGEST_NEWSAPI_WINDOW_HOURS` (default **48**)
- Post-fetch: client-side `isOnTopicHeadline` filter; cap at `MORNING_DIGEST_NEWSAPI_MAX_HEADLINES` (default **5**)
- Optional override: `MORNING_DIGEST_NEWSAPI_QUERY` replaces the built-in `q`; `MORNING_DIGEST_NEWSAPI_ENABLED=0` skips the network call

Stdout shape:

```json
{
  "headlines": [
    { "title": "OpenAI ships new agent framework for developers", "url": "https://example.com/article" }
  ]
}
```

`url` is included when NewsAPI provides it; omit the key when absent (never `null`).

Emit up to **5** headline **titles** under **Headlines** (use `title` from each object; `url` is for Convex `digestSignals` push only).

On failure (missing key, HTTP error, empty results): `- (source unavailable: <short reason>)` and **continue** to Source 3.

## Source 3 — Perplexity deep signal

Call `mcp__perplexity__search` exactly once when Source 1 produced at least one trend keyword. If Source 1 failed or returned no usable keyword, do **not** invent a fallback keyword from headlines; mark Deep Signal unavailable with the required bullet.

- Keyword: **top** item from Source 1 (after sort).
- Query: `<keyword> — latest news and developments last 24 hours — CNS operator brief`
- Target **2–3 sentences** in **Deep Signal** section when Perplexity succeeds.
- Soft cap **45s** — on timeout, write `- (source unavailable: perplexity timeout)`.
- Missing top trend keyword: write `- (source unavailable: no top trend keyword)`.

## Source 4 — arXiv preprints

Call `terminal` exactly once for arXiv RSS (no API key). The script reads `MORNING_DIGEST_ARXIV_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"papers":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-arxiv.sh", workdir=resolved_repo_root, timeout=45)
```

When `MORNING_DIGEST_ARXIV_CATEGORIES` is unset or empty, the script applies documented defaults: **`cs.AI,cs.LG,stat.ML`**. Operators who want empty categories to fail instead of defaulting can set `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0` (returns `{"error":"categories not configured"}`).

Parse stdout JSON:

- `papers[]` with `category`, `title`, `link`, `snippet`, `pubDate`.
- Emit up to **N** papers per configured category (newest first in RSS order).

For Discord **arXiv Preprints**, list each paper as `- <title> — <snippet>` (single line). Parenthetical after the heading: configured category codes (e.g. `cs.AI, cs.LG`) or `(configured categories)` when unknown.

On failure (`error` key, empty `papers`, or invalid stdout): section header **arXiv Preprints** + `- (source unavailable: <short reason>)` and **continue** to Source 5. Map `error: categories not configured` → `- (source unavailable: categories not configured)`.

## Source 5 — HackerNews

Call `terminal` exactly once for HackerNews RSS (no API key). The script reads `MORNING_DIGEST_HN_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"stories":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-hn.sh", workdir=resolved_repo_root, timeout=45)
```

Stdout shape (HN only — do not confuse with Sources 7–9 keys):

```json
{ "stories": [{ "title": "...", "link": "...", "score": 142, "comments": 12 }] }
```

**After the HN terminal returns** (mandatory stdout threading — mirror §9 scoring / Source 6 pick stdout patterns):

1. Let `hn_stdout` = HN terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `hn_json = JSON.parse(hn_stdout)` inside try/catch or equivalent safe parse.
3. If `hn_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(hn_json.stories) && hn_json.stories.length > 0`:
   - Read **`hn_json.stories`** (`stories[]` stdout array key) only — each item uses `title`, `link`, `score`, `comments` (integers from stdout).
   - Emit up to **N** stories (default **5**, configurable via `MORNING_DIGEST_HN_MAX_STORIES`).
   - For Discord **HackerNews**, list each story as `- <title> — <score> pts, <comments> comments`.
5. Else → failure (empty `stories`, invalid shape, or parse error).
6. On failure: section header **HackerNews** + `- (source unavailable: <short reason>)` and **continue** to Source 7.
7. **Anti-pattern:** Do not read `repos[]`, `posts[]`, or `entries[]` from HN stdout — those keys belong to Sources 7–9 only.

## Source 7 — GitHub

Call `terminal` exactly once for GitHub repository search. The script reads `MORNING_DIGEST_GITHUB_*` and optional `GITHUB_TOKEN` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"repos":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-github.sh", workdir=resolved_repo_root, timeout=45)
```

Stdout shape (GitHub only — do not confuse with Sources 5, 8, or 9 keys):

```json
{ "repos": [{ "title": "owner/repo", "url": "https://github.com/...", "stars": 1200, "forks": 45 }] }
```

**After the GitHub terminal returns** (mandatory stdout threading — mirror Source 5 / §9 scoring):

1. Let `gh_stdout` = GitHub terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `gh_json = JSON.parse(gh_stdout)` inside try/catch or equivalent safe parse.
3. If `gh_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(gh_json.repos) && gh_json.repos.length > 0`:
   - Read **`gh_json.repos`** (`repos[]` stdout array key) only — each item uses `title` (owner/repo), `url`, `stars`, `forks` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata`: `repos[].stars` → `sourceMetadata.stars`, `repos[].forks` → `sourceMetadata.forks` (omit `forks` when absent), `repos[].publishedAt` → `sourceMetadata.publishedAt` when present.
   - Emit up to **N** repos (default **5**, configurable via `MORNING_DIGEST_GITHUB_MAX_REPOS`); requires `MORNING_DIGEST_GITHUB_QUERIES` (comma-separated search strings) when enabled.
   - For Discord **GitHub**, list each repo as `- <title> — <stars> stars, <forks> forks`.
5. Else → failure (empty `repos`, invalid shape, or parse error).
6. On failure: section header **GitHub** + `- (source unavailable: <short reason>)` and **continue** to Source 8.
7. **Anti-pattern:** Do not read `stories[]`, `posts[]`, or `entries[]` from GitHub stdout — those keys belong to Sources 5, 8, and 9 only.

## Source 8 — Reddit

Call `terminal` exactly once for Reddit hot listings via OAuth. The script reads `MORNING_DIGEST_REDDIT_*` and `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` / `REDDIT_PASSWORD` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"posts":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-reddit.sh", workdir=resolved_repo_root, timeout=45)
```

Stdout shape (Reddit only — do not confuse with Sources 5, 7, or 9 keys):

```json
{ "posts": [{ "title": "...", "url": "https://reddit.com/...", "upvotes": 42, "commentCount": 7 }] }
```

**After the Reddit terminal returns** (mandatory stdout threading — mirror Source 5 / §9 scoring):

1. Let `rd_stdout` = Reddit terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `rd_json = JSON.parse(rd_stdout)` inside try/catch or equivalent safe parse.
3. If `rd_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(rd_json.posts) && rd_json.posts.length > 0`:
   - Read **`rd_json.posts`** (`posts[]` stdout array key) only — each item uses `title`, `url`, `upvotes`, `commentCount` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata`: `posts[].upvotes` → `sourceMetadata.upvotes`, `posts[].commentCount` → `sourceMetadata.commentCount` (omit `commentCount` when absent), `posts[].publishedAt` → `sourceMetadata.publishedAt` when present.
   - Emit up to **N** posts (default **5**, configurable via `MORNING_DIGEST_REDDIT_MAX_POSTS`); requires `MORNING_DIGEST_REDDIT_SUBREDDITS` (comma-separated subreddit names **without** `r/` prefix) and OAuth credentials when enabled.
   - For Discord **Reddit**, list each post as `- <title> — <upvotes> upvotes, <commentCount> comments`.
5. Else → failure (empty `posts`, invalid shape, or parse error).
6. On failure: section header **Reddit** + `- (source unavailable: <short reason>)` and **continue** to Source 9.
7. **Anti-pattern:** Do not read `stories[]`, `repos[]`, or `entries[]` from Reddit stdout — those keys belong to Sources 5, 7, and 9 only.

## Source 9 — Newsletters / RSS

Call `terminal` exactly once for curated RSS/Substack feeds. The script reads `MORNING_DIGEST_RSS_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"entries":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-rss.sh", workdir=resolved_repo_root, timeout=45)
```

Stdout shape (RSS only — do not confuse with Sources 5, 7, or 8 keys):

```json
{ "entries": [{ "title": "...", "url": "https://...", "publishedAt": "2026-06-09T08:00:00.000Z", "author": "..." }] }
```

**After the RSS terminal returns** (mandatory stdout threading — mirror Source 5 / §9 scoring):

1. Let `rss_stdout` = RSS terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `rss_json = JSON.parse(rss_stdout)` inside try/catch or equivalent safe parse.
3. If `rss_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(rss_json.entries) && rss_json.entries.length > 0`:
   - Read **`rss_json.entries`** (`entries[]` stdout array key) only — each item uses `title`, `url`, optional `publishedAt` (ISO string), optional `author`.
   - When building §9 push signals, nest metadata under `sourceMetadata`: `entries[].publishedAt` → `sourceMetadata.publishedAt`, `entries[].author` → `sourceMetadata.author` when present — **never** leave metadata at the signal root.
   - Emit up to **N** entries total (default **10**, configurable via `MORNING_DIGEST_RSS_MAX_TOTAL`; default **3** per feed via `MORNING_DIGEST_RSS_MAX_PER_FEED`); requires `MORNING_DIGEST_RSS_FEEDS` (comma-separated feed URLs) when enabled.
   - For Discord **Newsletters / RSS**, list each entry as `- <title>` (optional ` — <author>` when present).
5. Else → failure (empty `entries`, invalid shape, or parse error).
6. On failure: section header **Newsletters / RSS** + `- (source unavailable: <short reason>)` and **continue** to Source 10.
7. **Anti-pattern:** Do not read `stories[]`, `repos[]`, or `posts[]` from RSS stdout — those keys belong to Sources 5, 7, and 8 only.

## Source 10 — Product Hunt

Call `terminal` exactly once for Product Hunt daily launches via GraphQL. The script reads `MORNING_DIGEST_PRODUCTHUNT_*` and `PRODUCTHUNT_API_KEY` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"launches":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-producthunt.sh", workdir=resolved_repo_root, timeout=45)
```

Stdout shape (Product Hunt only — do not confuse with Sources 5, 7, 8, or 9 keys):

```json
{ "launches": [{ "title": "...", "tagline": "...", "url": "https://www.producthunt.com/posts/...", "votesCount": 42 }] }
```

**After the Product Hunt terminal returns** (mandatory stdout threading — mirror Sources 7–9):

1. Let `ph_stdout` = Product Hunt terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `ph_json = JSON.parse(ph_stdout)` inside try/catch or equivalent safe parse.
3. If `ph_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(ph_json.launches) && ph_json.launches.length > 0`:
   - Read **`ph_json.launches`** (`launches[]` stdout array key) only — each item uses `title`, `tagline`, `url`, `votesCount` (number), optional `createdAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata`: `launches[].votesCount` → `sourceMetadata.upvotes` (number, **required** for engagement normalization); map `launches[].tagline` → `summary` for §9; map `launches[].createdAt` → `sourceMetadata.publishedAt` when present.
   - Emit up to **N** launches (default **5**, configurable via `MORNING_DIGEST_PRODUCTHUNT_MAX_LAUNCHES`); requires `PRODUCTHUNT_API_KEY` when enabled.
   - For Discord **Product Hunt**, list each launch as `- <title> — <votesCount> votes` (optional tagline sub-bullet when present).
5. Else → failure (empty `launches`, invalid shape, or parse error).
6. On failure: section header **Product Hunt** + `- (source unavailable: <short reason>)` and **continue** to Source 6.
7. **Anti-pattern:** Do not read `repos[]`, `posts[]`, `stories[]`, or `entries[]` from Product Hunt stdout — those keys belong to Sources 5, 7, 8, and 9 only.

## Source 6 — Vault context (NotebookLM)

Run **after** Source 10 completes. Do **not** use `mcp__notebooklm__notebook_query` — CLI only.

### Build `digest_sources` (for scoring)

After Sources 1–5, Source 7, Source 8, Source 9, and Source 10 complete, assemble a JSON object from parsed tool outputs (skip a source that failed with `source unavailable` — use an empty array or omit that field):

```json
{
  "trends": [{ "keyword": "<string>", "normalizedValue": <number> }],
  "headlines": [{ "title": "<string>", "url": "<optional url>" }],
  "perplexityText": "<Deep Signal body text only — not the Perplexity query string>",
  "arxiv": [{ "title": "<string>", "snippet": "<string>" }],
  "hackernews": [{ "title": "<string>" }],
  "github": [{ "title": "<string>", "url": "<string>", "stars": <number> }],
  "reddit": [{ "title": "<string>", "url": "<string>", "upvotes": <number> }],
  "rss": [{ "title": "<string>", "url": "<string>", "publishedAt": "<optional ISO string>" }],
  "producthunt": [{ "title": "<string>", "url": "<string>", "votesCount": <number> }]
}
```

- **trends:** up to **5** keywords from Source 1 (`events[]`), sorted by `normalizedValue` descending (same sort/top-5 as Trending Now).
- **headlines:** up to **5** headline **titles** from Source 2.
- **perplexityText:** the **2–3 sentence Deep Signal** answer from Source 3 when Perplexity succeeded; omit or `""` when Deep Signal is unavailable.
- **arxiv:** paper **titles** and **snippets** from Source 4 when available; omit or `[]` when arXiv is unavailable.
- **hackernews:** story **titles** from Source 5 when available; omit or `[]` when HackerNews is unavailable.
- **github:** repo **titles** from Source 7 when available; omit or `[]` when GitHub is unavailable.
- **reddit:** post **titles** from Source 8 when available; omit or `[]` when Reddit is unavailable.
- **rss:** newsletter/RSS entry **titles** from Source 9 when available (include `publishedAt` when present for recency sorting in `buildDigestSignals`); omit or `[]` when RSS is unavailable.
- **producthunt:** launch **titles** from Source 10 when available (include `votesCount` for ranking in `buildDigestSignals`); omit or `[]` when Product Hunt is unavailable.

`pick-signal-notebook.mjs` runs `buildDigestSignals(digest_sources)` internally: trends → headlines → Perplexity-derived phrases (up to 3) → arXiv titles (up to 3) → HackerNews titles (up to 3) → GitHub repo titles (up to 2, highest stars) → Reddit post titles (up to 2, highest upvotes) → RSS title (up to 1, most recent by `publishedAt` when available) → Product Hunt launch titles (up to 2, highest votesCount), case-insensitive dedupe (first wins), cap **10** signals total. Do **not** hand-build a `SIGNALS_JSON` array from memory.

Before building the Source 6 pick-signal / query terminal commands, shell-quote every dynamic environment value with this exact POSIX single-quote transform:

```text
shellQuote(value) = "'" + String(value).replaceAll("'", "'\\''") + "'"
```

Use `shellQuote(...)` for `DIGEST_SOURCES_JSON`, `NOTEBOOK_ID`, `NOTEBOOK_QUERY`, `NOTEBOOK_REMAINING_S`, and `QUERY_SCRIPT` (Source 6), and for `LOG_SCRIPT`, `NOTEBOOK_ANSWER`, `NOTEBOOK_TITLE`, and `NOTEBOOK_DOMAIN` (post-post log). Do not pass raw headline text, matched signals, or NotebookLM queries unquoted.

### Pick notebook

Call `terminal` once:

```text
terminal(command="DIGEST_SOURCES_JSON=<shellQuote(JSON.stringify(digest_sources))> node scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs", workdir=resolved_repo_root, timeout=30)
```

The script also supports legacy `SIGNALS_JSON=<shellQuote(signals_json)>` (JSON array of strings) for manual runs, `node .../pick-signal-notebook.mjs <registryPath>` when `DIGEST_SOURCES_JSON` or `SIGNALS_JSON` is set, and legacy `node ... '<json-array>' <registryPath>` when neither env is set.

Parse stdout JSON: `{ route, winning_signal, winning_score, elapsed_ms }`.

- `route.status === 'NO_ROUTE'` → Vault context unavailable (no watched notebook matched).
- `route.status === 'ROUTED'` → continue to query step.

Registry path: `scripts/session-close/lib/notebook-registry.json` (override via `CNS_NOTEBOOK_REGISTRY_PATH` on the script env if needed).

### Query notebook (ROUTED only)

Compute remaining seconds:

```text
remaining_s = Math.max(15, Math.min(60, 120 - (Date.now() - digest_start_ms) / 1000))
```

Resolve query script (do not copy into morning-digest):

```text
query_script = resolved_repo_root + "/scripts/hermes-skill-examples/notebook-query/scripts/query-notebook.mjs"
```

If that repo path is unavailable, use the installed fallback: `$HOME/.hermes/skills/cns/notebook-query/scripts/query-notebook.mjs`.

Call `terminal` once:

```text
terminal(command="QUERY_SCRIPT=<shellQuote(query_script)> NOTEBOOK_ID=<shellQuote(route.id)> NOTEBOOK_QUERY=<shellQuote(note_query)> NOTEBOOK_REMAINING_S=<shellQuote(String(remaining_s))> node \"$QUERY_SCRIPT\"", workdir=resolved_repo_root, timeout=90)
```

Where `note_query` is exactly: `Morning digest context for: <winning_signal>. Summarize what this notebook adds for an operator brief today (2–3 sentences, vault-aligned, no fluff).`

Parse stdout JSON `{ answer, elapsed_ms }`. Save **`answer_full = answer`** (full CLI stdout text) **before** any Discord formatting. Truncate a **separate** display copy to **500** characters for Discord (append `…` if truncated). Do **not** reuse the truncated string for Convex logging.

**Failure mapping:**

- Non-zero exit or invalid JSON → `- (source unavailable: <short reason>)`
- Stderr contains `notebook query timed out` → unavailable with that reason
- Missing `nlm` on PATH → `- (source unavailable: notebooklm CLI not found)`

Vault context failure does **not** abort the digest.

## Output contract (post to `#hermes`)

```text
🌅 **Morning Digest** — <YYYY-MM-DD>

**Trending Now** (Google Trends)
- <keyword 1> · <score>
- <keyword 2> · <score>
...up to 5

**Headlines** (NewsAPI)
- <headline 1>
- <headline 2>
...up to 5

**Deep Signal** (Perplexity — top trend: "<keyword>")
<2–3 sentence sweep summary or - (source unavailable: <short reason>)>

**arXiv Preprints** (<category list or configured categories>)
- <title> — <snippet>
- ...
(or - (source unavailable: <short reason>) when Source 4 failed)

**HackerNews** (top stories)
- <title> — <score> pts, <comments> comments
- ...
(or - (source unavailable: <short reason>) when Source 5 failed)

**GitHub** (trending repos)
- <title> — <stars> stars, <forks> forks
- ...
(or - (source unavailable: <short reason>) when Source 7 failed)

**Reddit** (hot posts)
- <title> — <upvotes> upvotes, <commentCount> comments
- ...
(or - (source unavailable: <short reason>) when Source 8 failed)

**Newsletters / RSS**
- <title> (optional — <author> when present)
- ...
(or - (source unavailable: <short reason>) when Source 9 failed)

**Product Hunt** (daily launches)
- <title> — <votesCount> votes
- ... (optional tagline sub-bullet when present)
(or - (source unavailable: <short reason>) when Source 10 failed)

**Vault context** (NotebookLM — <route.title>)
<answer text, max 500 chars; if longer truncate with … suffix>
_Matched signal:_ <winning_signal>

**Recommended focus:** <top keyword to watch today or (none — trends unavailable)>
```

**Vault context** when `route.status === 'NO_ROUTE'`:

```text
**Vault context** (NotebookLM)
- (source unavailable: no watched notebook matched today's signals)
```

**Vault context** when ROUTED but query fails:

```text
**Vault context** (NotebookLM — <route.title>)
- (source unavailable: <short reason>)
```

**Recommended focus:** same keyword as Source 3 unless Source 1 failed entirely; then use `(none — trends unavailable)`.

## Post-post — Log Vault context to Convex (ROUTED + query success only)

Run **only** when Source 6 finished with `route.status === 'ROUTED'` and `query-notebook.mjs` returned valid stdout JSON `{ answer, elapsed_ms }` where **`answer` is non-empty after trim** (Vault context section is **not** `(source unavailable: …)`).

**After** posting the full digest to `#hermes`, call `terminal` once. **Await** completion (15s cap) before ending the task turn. Do not edit or retract the Discord digest regardless of log outcome.

```text
terminal(
  command="LOG_SCRIPT=<shellQuote(log_script)> NOTEBOOK_QUERY=<shellQuote(winning_signal)> NOTEBOOK_ANSWER=<shellQuote(answer_full)> NOTEBOOK_ID=<shellQuote(route.id)> NOTEBOOK_TITLE=<shellQuote(route.title)> NOTEBOOK_DOMAIN=<shellQuote(route.domain or 'general')> node \"$LOG_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=15
)
```

Where:

```text
log_script = resolved_repo_root + "/scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs"
```

Fallback if repo path missing: `$HOME/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs`

- `NOTEBOOK_QUERY` = `winning_signal` (matched trend keyword or headline — **not** the templated NotebookLM prompt).
- `NOTEBOOK_ANSWER` = `answer_full` from Source 6 (**full** `query-notebook.mjs` stdout `answer`, saved before Discord 500-char truncation).
- `NOTEBOOK_DOMAIN` = `route.domain` when present; otherwise `'general'`.
- Use the same `shellQuote(value)` transform as Source 6 for all dynamic env values.

**Do not run** for `NO_ROUTE`, query failure/timeout/invalid JSON, empty/whitespace-only `answer`, or when Vault context shows `(source unavailable: …)`.

**After terminal returns**, record exactly one JSON line to **stderr** (or tool transcript):

```json
{"notebook_query_log":{"status":"<status>","exit_code":<n>,"reason":"<reason>"}}
```

| status | When |
|--------|------|
| `ok` | Exit `0` and stderr does not indicate Convex HTTP/mutation failure or env skip |
| `skipped-env` | Exit `0` and stderr indicates missing `CONVEX_URL` / deploy key skip |
| `failed` | Exit non-zero |
| `timeout` | Terminal tool reports timeout or exceeded 15s |

**stderr → status** (match substrings from `log-notebook-query.mjs` stderr; exit code from terminal):

| stderr contains | exit | status | reason (example) |
|-----------------|------|--------|------------------|
| `skipped — missing CONVEX_URL` | `0` | `skipped-env` | `missing-convex-env` |
| `Convex push failed` | non-zero | `failed` | `convex-http-error` |
| `missing required env` | non-zero | `failed` | `invalid-input` |
| `unexpected error` | non-zero | `failed` | `unexpected-error` |
| (none of the above) | `0` | `ok` | `ok` |

`reason`: short snake_case or kebab token (≤ 80 chars), no secrets, no full `NOTEBOOK_ANSWER` body.

**Discord warning** (only when `status` is `failed` or `timeout`): post one additional line to `#hermes`:

```text
_(Notebook history log failed — /trends may be missing this query.)_
```

Do **not** post the warning for `ok` or `skipped-env`. Do **not** treat log failure as skill failure. Missing `CONVEX_URL` / `CONVEX_DEPLOY_KEY` → script exits 0 (skip path → `skipped-env`). Malformed required env or Convex HTTP error → script exits 1 (`failed`).

## Post-post — Push digest entities to Convex (REQUIRED — all runs)

> **REQUIRED §9 — part 1 of 2 of the completion gate.** This is **part 1 of 2** — do **not** end the task turn after this call; §10 must also fire. Non-negotiable even under context compression. Invoke on **every** run (success or partial failure), exactly as session-close treats its required steps.

Run **after** Sources **1–5, 7–10, and 6** were attempted, `digest_sources` was assembled, the full digest was posted to `#hermes`, and the notebook Convex log step (when applicable) has finished — so `notebookId` and `vaultContextSummary` are available on ROUTED+success runs. This step is **mandatory** and runs **after** the Discord post, but it is only **half** of the completion gate — §10 (`push-keyword-candidates.mjs`) must fire next with the same payload. Failure handling is **fire-and-forget** — the push script always exits **0** and you never post a Discord warning on failure — but "fire-and-forget" applies only to the *result*, never to whether the call runs. The invocation itself is required.

**Precondition:** Discord post complete. Build `digest_push_payload` from parsed source outputs (not memory).

### Signal mapping (`signals[]`)

| Section | sourceType | Source data | title | summary | url | score | externalId |
|---------|------------|-------------|-------|---------|-----|-------|------------|
| `trends` | `google_trends` | Source 1 `events[]` | `keyword` | — | — | `normalizedValue` | `sha256(keyword + date)` short hex |
| `headlines` | `newsapi` | Source 2 `headlines[]` | `title` | — | `url` if present | — | url hash or title+date hash |
| `deep_signal` | `deep_signal` | Source 3 body | first 80 chars or `"Deep Signal"` | full text | — | — | `sha256(date + topTrend)` short hex |
| `arxiv` | `arxiv` | Source 4 `papers[]` | `title` | `snippet` | `link` | — | arxiv id from link (`/\d+\.\d+`) or link hash |
| `hackernews` | `hackernews` | Source 5 `stories[]` | `title` | — | `link` | `score` | HN item id from link/comments URL or title+date hash |
| `github` | `github` | Source 7 `repos[]` | `title` | — | `url` | — | `sha256(url).slice(0,16)` short hex |
| `reddit` | `reddit` | Source 8 `posts[]` | `title` | — | `url` | — | url hash or title+date hash |
| `rss` | `rss` | Source 9 `entries[]` | `title` | — | `url` | — | url hash or title+date hash |
| `producthunt` | `producthunt` | Source 10 `launches[]` | `title` | `tagline` | `url` | — | url hash or title+date hash |

- `rank`: assigned by `scoreDigestSignals` from descending `rankScore` sort (1 = highest `rankScore`). Replaces legacy section-index ordering.
- `sourceMetadata` engagement fields (all optional — **omit when absent, never `null`**):
  - HN: map RSS `score` → `points` (number); RSS `comments` → `commentCount` (number). Legacy `sourceMetadata.comments` remains accepted by validators but prefer `points` + `commentCount` for engagement normalization (64-4).
  - arXiv: `categories` (array of strings from `category`) when present.
  - GitHub: map `repos[].stars` → `sourceMetadata.stars` (number, **required** for engagement normalization); map `repos[].forks` → `sourceMetadata.forks` (number) when present; map `repos[].publishedAt` → `sourceMetadata.publishedAt` when present. **Never** leave `stars`/`forks` at the signal root — `normalizeEngagement` reads only `sourceMetadata.stars`/`sourceMetadata.forks`; root-level fields score as null silently.
  - Reddit: map `posts[].upvotes` → `sourceMetadata.upvotes` (number, **required** for engagement normalization); map `posts[].commentCount` → `sourceMetadata.commentCount` (number) when present; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present. **Never** leave `upvotes`/`commentCount` at the signal root — `normalizeEngagement` reads only `sourceMetadata.upvotes`/`sourceMetadata.commentCount`; root-level fields score as null silently.
  - RSS: map `entries[].publishedAt` → `sourceMetadata.publishedAt` when present; map `entries[].author` → `sourceMetadata.author` when present. **No engagement fields** — omit `stars`, `upvotes`, `points`, etc. **Never** leave `publishedAt`/`author` at the signal root.
  - Product Hunt: map `launches[].votesCount` → `sourceMetadata.upvotes` (number, **required** for engagement normalization); map `launches[].tagline` → `summary`; map `launches[].createdAt` → `sourceMetadata.publishedAt` when present. **Never** leave `votesCount` at the signal root — `normalizeEngagement` reads only `sourceMetadata.upvotes`; root-level fields score as null silently.
- **Scoring fields (populated by scoring step below):** `scores` (object with all five keys when present: `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency` — each 0–100), `disposition` (`priority` | `watch` | `ignore` | `escalate`), `normalizedEngagement` (0–100), `rankScore` (0–100). Omit these keys only when the scoring terminal fails (§9 degraded mode).
- Use Node `crypto.createHash('sha256')` for hashes (built-in only).
- Empty sections → omit signals (no placeholder rows).

#### Each signal object — required schema (Convex validators are strict)

The `addDigestSignal` validator is a **strict** object: a missing required key **or** an unexpected/`null` value rejects the whole signal, and the push then finalizes the run as `failed` with **zero** signals stored. Build every signal object exactly to this contract:

- **Required keys on every signal — never omit:** `section`, `sourceType`, `title`, `rank`. Missing `section` is the most common failure — include it on **every** signal, paired with `sourceType` per the table above.
- **`section`** ∈ `trends` | `headlines` | `arxiv` | `hackernews` | `deep_signal` | `github` | `reddit` | `rss` | `producthunt`. **`sourceType`** ∈ `google_trends` | `newsapi` | `arxiv` | `hackernews` | `deep_signal` | `github` | `reddit` | `rss` | `producthunt`.
- **Optional keys** (`summary`, `url`, `score`, `externalId`, `sourceMetadata`, `scores`, `disposition`, `normalizedEngagement`, `rankScore`): **OMIT the key entirely** when there is no value. **Never set them to `null`** — Convex rejects `null` for an optional string/number field (`null` is not the same as omitted).
- **Types:** `rank`, `score`, `normalizedEngagement`, and `rankScore` are **numbers** (not strings); `sourceMetadata.points`, `sourceMetadata.commentCount`, `sourceMetadata.stars`, `sourceMetadata.forks`, `sourceMetadata.upvotes`, and legacy `sourceMetadata.comments` are **numbers**; `sourceMetadata.categories` is an **array of strings**; when `scores` is present it must include all five dimension keys as numbers (0–100 each).
- Do **not** add any key not listed in the table / this contract.

### `digest_push_payload` shape

```json
{
  "run": {
    "date": "<YYYY-MM-DD>",
    "ranAt": 1749091200000,
    "topTrend": "<top keyword when available>",
    "focusKeyword": "<recommended focus line>",
    "deepSignalSummary": "<Source 3 body when available>",
    "notebookId": "<route.id when ROUTED>",
    "vaultContextSummary": "<answer_full when ROUTED + query success>"
  },
  "signals": [
    {
      "section": "trends",
      "sourceType": "google_trends",
      "title": "<keyword>",
      "score": 0.4,
      "rank": 1,
      "externalId": "<short hex>"
    },
    {
      "section": "hackernews",
      "sourceType": "hackernews",
      "title": "<story title>",
      "url": "https://news.ycombinator.com/item?id=...",
      "score": 142,
      "rank": 1,
      "externalId": "<hn id>",
      "sourceMetadata": { "points": 142, "commentCount": 12 }
    }
  ]
}
```

> **Note:** `rank`, `rankScore`, `scores`, `disposition`, and `normalizedEngagement` appear on signals **after** the scoring step below — the example shows pre-scoring section-order `rank` only.

Every entry in `signals[]` MUST carry both `section` and `sourceType` (see the strict-schema contract above). Optional keys with no value are **omitted**, never `null`.

`ranAt` must be the numeric `digest_start_ms` from task start (Unix ms) — never a string.

Omit `workspaceId`. Push available signals even when some sources failed.

### Score signals before push (REQUIRED — Epic 64-5)

After building unscored `digest_push_payload.signals` from the mapping table above and **before** `JSON.stringify(digest_push_payload)` for Convex push, invoke the scoring terminal:

```text
terminal(
  command="SCORE_SCRIPT=<shellQuote(score_script)> DIGEST_SIGNALS_JSON=<shellQuote(JSON.stringify(digest_push_payload.signals))> DIGEST_RUN_AT=<shellQuote(String(digest_start_ms))> node \"$SCORE_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=30
)
```

Where:

```text
score_script = resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs"
```

Fallback if repo path missing: `$HOME/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs`

**Scoring context env** (passed through to `loadScoringContext` — set when available):

| Env | Purpose |
|-----|---------|
| `CNS_REPO_ROOT` | Repo root for sprint-status watchlist (defaults to Omnipotent.md) |
| `MORNING_DIGEST_PROJECT_ENTITIES` | Comma-separated project entity names for personal relevance |
| `DIGEST_KEYWORD_CANDIDATES_JSON` | Personal keyword candidates from §10 upsert path |
| `DIGEST_NOVELTY_HISTORY_JSON` | Prior digest titles for novelty scoring — prefer **`{ title, sourceType, seenAt? }[]`** when history is available, e.g. `[{"title":"Prior HN story","sourceType":"hackernews","seenAt":1749000000000}]`; legacy `string[]` still accepted |
| `DIGEST_RUN_AT` | Same numeric `digest_start_ms` as `run.ranAt` |

**After the scoring terminal returns** (mandatory stdout threading — mirror Source 6 pick/query stdout patterns):

1. Let `score_stdout` = scoring terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `scored_signals = JSON.parse(score_stdout)`.
3. If `Array.isArray(scored_signals) && scored_signals.length > 0`:
   - `digest_push_payload.signals = scored_signals` (replace the entire array; do not merge).
4. Else (empty stdout, invalid JSON, or `[]`):
   - keep existing unscored `digest_push_payload.signals` (architecture §9 degraded mode).
5. Do **not** call `JSON.stringify(digest_push_payload)` for push until step 3 or 4 completes.
6. **Anti-pattern:** Do not pass pre-scoring `digest_push_payload.signals` to `push-digest-convex.mjs` when step 3 assigned scored signals.

**Pipeline order (fixed):**

```text
build digest_push_payload (unscored signals)
  → scoring terminal
  → capture stdout → digest_push_payload.signals = scored_signals
  → push terminal (DIGEST_PUSH_JSON uses post-scoring payload)
  → keyword candidates terminal (same post-scoring payload)
```

`DIGEST_PUSH_JSON` in the push command must reference `digest_push_payload` **after** signal replacement — not a stale copy from before scoring.

The script always exits **0**. Stderr warnings use prefix `score-digest-signals:`.

### Terminal invocation (REQUIRED — part 1 of 2 completion gate — do not end the task turn here)

This `terminal(...)` call **MUST be invoked** as the first half of the two-part completion gate. Do **not** end the task turn after it fires — §10 must also run, even if context was compressed mid-run.

```text
terminal(
  command="PUSH_SCRIPT=<shellQuote(push_script)> DIGEST_PUSH_JSON=<shellQuote(JSON.stringify(digest_push_payload))> node \"$PUSH_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=45
)
```

Where:

```text
push_script = resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs"
```

Fallback if repo path missing: `$HOME/.hermes/skills/cns/morning-digest/scripts/push-digest-convex.mjs`

**After terminal returns**, emit optional stderr JSON for observability:

```json
{"digest_convex_push":{"status":"ok|skipped-env|invalid-input|failed","exit_code":0,"reason":"..."}}
```

| status | When |
|--------|------|
| `ok` | Exit `0` and push completed |
| `skipped-env` | Exit `0` and stderr indicates missing `CONVEX_URL` / deploy key skip |
| `invalid-input` | Exit `0` and stderr indicates missing/invalid `DIGEST_PUSH_JSON` (`run.date` required) |
| `failed` | Exit `0` but stderr contains `push-digest-convex: warning` |

Always `exit_code: 0`. Do **not** post Discord warnings for digest entity push failures. The graceful exit-0 / no-warning behavior governs only the *outcome* — it does **not** make the push optional. The skill is still incomplete after this call — proceed immediately to §10.

## Post-post — Push keyword candidates to Convex (REQUIRED — all runs)

> **REQUIRED §10 — part 2 of 2 of the completion gate.** The skill is **complete only after this call fires.** Same mandatory posture as §9: invoke on **every** run (success or partial failure), fire-and-forget **result** only (exit 0, no Discord warning).

Run **immediately after** the digest Convex push terminal call (`push-digest-convex.mjs`). Reuse the **same** `digest_push_payload` from **after** scoring stdout replacement (§9) — do not rebuild or query Convex.

### Terminal invocation (REQUIRED — part 2 of 2 completion gate)

```text
terminal(
  command="CANDIDATES_SCRIPT=<shellQuote(candidates_script)> DIGEST_PUSH_JSON=<shellQuote(JSON.stringify(digest_push_payload))> node \"$CANDIDATES_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=45
)
```

Where:

```text
candidates_script = resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/push-keyword-candidates.mjs"
```

Fallback if repo path missing: `$HOME/.hermes/skills/cns/morning-digest/scripts/push-keyword-candidates.mjs`

**After terminal returns**, emit optional stderr JSON for observability:

```json
{"keyword_candidates_push":{"status":"ok|skipped-env|invalid-input|failed","exit_code":0,"upserted":3,"reason":"..."}}
```

| status | When |
|--------|------|
| `ok` | Exit `0` and upserts completed |
| `skipped-env` | Exit `0` and stderr indicates missing `CONVEX_URL` / deploy key skip |
| `invalid-input` | Exit `0` and stderr indicates missing/invalid `DIGEST_PUSH_JSON` (`run.date` required) |
| `failed` | Exit `0` but stderr contains `push-keyword-candidates: warning` |

Always `exit_code: 0`. Do **not** post Discord warnings for keyword candidate push failures.

## Allowed tools

| Tool | Use |
|------|-----|
| `terminal` | Machine-local date; trend dry-run; NewsAPI; arXiv RSS; HackerNews RSS; `pick-signal-notebook.mjs`; `query-notebook.mjs`; `log-notebook-query.mjs` (post-post, success only); `score-digest-signals.mjs` (post-post, before push); `push-digest-convex.mjs` (post-post, all runs); `push-keyword-candidates.mjs` (post-post, all runs) |
| `mcp__perplexity__search` | Deep signal only |
| Discord reply | Final formatted digest |

**Forbidden:** `vault_write`, `vault_append_daily`, `vault_create_note`, `mcp__notebooklm__notebook_query`, Firecrawl, dashboard APIs, session-close NotebookLM fan-out.

## Partial failure

Still post the full template with all section headers. Never invent headlines or trend keywords.

Never stop the run because an earlier source failed — only the failing section gets `- (source unavailable: …)`.
