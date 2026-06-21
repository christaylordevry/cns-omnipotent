# Task: `morning-digest` (Story 49-6 + 52-1 + 52-2 + 64-5)

## 0) REFERENCE ONLY — invocation already confirmed

> **You have already been invoked.** The `config.yaml` trigger matched the incoming Discord message (manual `morning-digest` line or cron pseudo-trigger). Do not re-check or re-evaluate the Hermes skill binding.
> Proceed directly to **Hard constraints** and source collection — do not ask whether to run the digest.

For documentation purposes only (do not re-evaluate at runtime):

- Manual trigger: first non-empty line equals `morning-digest` or begins with `morning-digest ` (case-sensitive; single-line message). See `references/trigger-pattern.md`.
- Cron: operator schedule per `references/cron-snippet.md` / `references/trigger-pattern.md` (`--skill morning-digest`; not the Discord line-1 grammar).

## REQUIRED SOURCES — terminal checklist (non-negotiable)

> **Pin this block.** Invoke **every** step below (via `terminal` or MCP) **before** posting to `#hermes` or calling §9/§10 push scripts. Do **not** post the Discord digest or invoke `push-digest-convex.mjs` / `push-keyword-candidates.mjs` until **all** source terminals in this list have fired **and** the post-scoring digest push artifact terminal has fired (see **Persist digest push artifact** below). A failed source still counts as fired when you record `(source unavailable: …)` in the Output Contract — **skipping** a terminal is not allowed.

**Strict collection order:** 0 → 1 → 2 → 4 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → **14** → **15** → **16** → **17** → **18** → **19** → 3 → 6 → §9 map → dedup → score → artifact → Discord → §9 push → §10

| Step | Source | Required invocation |
|------|--------|---------------------|
| 0 | Date | `terminal(...)` **Australia/Sydney** civil date (Tool-call rule below; matches cron `CRON_TZ`) |
| 1 | Google Trends | `terminal(command="bash scripts/session-close/hermes-run-trend-ingest.sh", …)` |
| 2 | NewsAPI | `terminal(command="bash scripts/session-close/hermes-run-newsapi.sh", …)` |
| 4 | arXiv | `terminal(command="bash scripts/session-close/hermes-run-arxiv.sh", …)` |
| 5 | HackerNews | `terminal(command="bash scripts/session-close/hermes-run-hn.sh", …)` |
| 7 | GitHub | `terminal(command="bash scripts/session-close/hermes-run-github.sh", …)` |
| 8 | Reddit | `terminal(command="bash scripts/session-close/hermes-run-reddit.sh", …)` |
| 9 | Newsletters / RSS | `terminal(command="bash scripts/session-close/hermes-run-rss.sh", …)` — **MUST fire before Source 6** |
| 10 | Product Hunt | `terminal(command="bash scripts/session-close/hermes-run-producthunt.sh", …)` — **MUST fire before Source 6** |
| 11 | X / Twitter | `terminal(command="bash scripts/session-close/hermes-run-x.sh", …)` — **MUST fire before Source 6** |
| 12 | Bluesky | `terminal(command="bash scripts/session-close/hermes-run-bluesky.sh", …)` — **MUST fire before Source 13** |
| 13 | YouTube | `terminal(command="bash scripts/session-close/hermes-run-youtube.sh", …)` — **MUST fire before Source 14** |
| 14 | TikTok | `terminal(command="bash scripts/session-close/hermes-run-tiktok.sh", …)` — **MUST fire before Source 15** |
| 15 | Instagram | `terminal(command="bash scripts/session-close/hermes-run-instagram.sh", …)` — **MUST fire before Source 16** |
| 16 | Pinterest | `terminal(command="bash scripts/session-close/hermes-run-pinterest.sh", …)` — **MUST fire before Source 17** |
| 17 | Polymarket | `terminal(command="bash scripts/session-close/hermes-run-polymarket.sh", …)` — **MUST fire before Source 18**; keyword watchlist primary (`MORNING_DIGEST_POLYMARKET_KEYWORDS`) |
| 18 | Threads | `terminal(command="bash scripts/session-close/hermes-run-threads.sh", …)` — **MUST fire before Source 19**; handle watchlist primary (`MORNING_DIGEST_THREADS_HANDLES`) |
| 19 | LinkedIn | `terminal(command="bash scripts/session-close/hermes-run-linkedin.sh", …)` — **MUST fire before Source 3**; dual primary watchlists (`MORNING_DIGEST_LINKEDIN_COMPANIES` + `MORNING_DIGEST_LINKEDIN_PROFILES`) |
| 3 | Perplexity (Deep Signal) | `terminal(command="bash scripts/session-close/hermes-run-perplexity.sh <shellQuote(top_trend_keyword)>", …)` — **after Source 19, before Source 6**; top keyword from Source 1 only |
| 6 | Vault context | `node scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`, then `node …/query-notebook.mjs` when ROUTED — **only after steps 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, and 3** |

**Steps 9–19 gate:** Sources 9, 10, 11, 12, 13, **14**, **15**, **16**, **17**, **18**, and **19** terminals **MUST fire** (and record success or `(source unavailable)`) before Source 3 or Source 6. Skipping any of these terminals invalidates the run.

**Source 3 gate:** Perplexity terminal **MUST fire** (and record success or `(source unavailable)`) after Source **19** and before Source 6 or Discord post.

**Gate:** Only after steps **0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 3, and 6** complete → build and score `digest_push_payload` → **persist digest push artifact** → post the full Output Contract to `#hermes` → §9 `push-digest-convex.mjs` → §10 `push-keyword-candidates.mjs`.

## Hard constraints (must follow)

1. **Channel**: Discord `#hermes` only.
2. **No vault writes**: no Vault IO mutators, no files under `Knowledge-Vault-ACTIVE/`, no `00-Inbox/` captures.
3. **No dashboard relay**, no digest archive JSONL. **NotebookLM:** read-only via `query-notebook.mjs` after signal scoring — no `source_add`, no session-close fan-out, no `mcp__notebooklm__notebook_query`.
4. **Google Trends**: call the Hermes `terminal` tool with command `bash scripts/session-close/hermes-run-trend-ingest.sh` (wrapper must keep `--dry-run`). Dry-run prints JSON only — **no Convex push**, no norm-cache write.
5. **Secrets**: never echo `NEWSAPI_API_KEY` in Discord. Load credentials from **`$HOME/.hermes/trend-ingest.env`** only (never cwd-relative `.hermes/` or `./trend-ingest.env`). Under Hermes isolation the wrapper scripts remap `$HOME` back to the operator's real home (Epic 59), so this resolves to the operator's `~/.hermes/trend-ingest.env` and not the isolated `…/.hermes/home/.hermes/...` path.
6. **Date line**: `YYYY-MM-DD` from **Australia/Sydney** civil date (same as morning-digest / push-watchdog cron `CRON_TZ=Australia/Sydney`). Use the Step 0 terminal below — do not use machine-local OS timezone for digest headers, `digest_push_payload.run.date`, or artifact filenames.
7. **Cross-source failures**: run Sources **1–5, 7–16, 3, and 6** independently (collection order: 1 → 2 → 4 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → **14** → **15** → **16** → 3 → 6). A failed source must not abort the digest — always post the full contract with `(source unavailable: …)` in the affected section(s).
8. **Digest wall clock**: record `digest_start_ms = Date.now()` at the start of task execution (before Source 1). Use it for Source 6 `NOTEBOOK_REMAINING_S` (see Source 6).
9. **Required completion gate (non-negotiable)**: After building and scoring `digest_push_payload`, **persist the digest push artifact** to `~/.hermes/digest-push-<YYYY-MM-DD>.json` **before** posting to `#hermes` (see **Persist digest push artifact**). After the Discord post, invoke **BOTH** `push-digest-convex.mjs` (§9) **AND** `push-keyword-candidates.mjs` (§10) with the same `DIGEST_PUSH_JSON`. The skill is **NOT complete** until the artifact terminal **and both** push terminal calls have fired. Steps 9+10 are a single two-part completion gate — neither push alone is sufficient. This requirement is **non-negotiable even under context compression** — never drop, defer, summarize, or deprioritize the artifact write or either push call. ("fire-and-forget" describes only how each push *result* is handled — exit 0, no Discord warning — it never means either call is skippable.) **§9 digest push:** follow the pinned **DO NOT improvise** block in the post-post digest entity push section — exactly one `terminal` call to `push-digest-convex.mjs` with `DIGEST_PUSH_JSON`; no direct Convex HTTP, MCP, or hand-rolled mutation loops.

## Tool-call rule

Do not treat shell snippets as instructions for the model to summarize. For every local command below, actually invoke the Hermes `terminal` tool using the explicit `terminal(command="...", workdir="...", timeout=<seconds>)` shape.

Resolve **`resolved_repo_root`** as:

- `OMNIPOTENT_REPO` when that environment variable is set to a non-empty absolute path.
- Otherwise `/home/christ/ai-factory/projects/Omnipotent.md`.

Use `resolved_repo_root` as the `workdir` argument for every `terminal(...)` call in this task.

Before source collection, call `terminal` once to get the **Australia/Sydney** civil date (matches cron and push-watchdog artifact lookup):

`terminal(command="node -e \"console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney'}).format(new Date()))\"", workdir=resolved_repo_root, timeout=10)`

Use that stdout value for `<YYYY-MM-DD>` everywhere in this task — Output contract header, `digest_push_payload.run.date`, and artifact filename.

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

On failure (missing key, HTTP error, empty results): `- (source unavailable: <short reason>)` and **continue** to Source 4.

## Source 3 — Perplexity deep signal

> **Runtime position:** fires **after Source 19 (LinkedIn), before Source 6 (Vault context)** — not at position 3 in the collection order. The section number is retained for Output Contract / §9 mapping compatibility.

**Pre-flight gate:** If the `hermes-run-perplexity.sh` terminal has not fired, do not proceed to Source 6. Perplexity **MUST fire after Source 19**.

Call `terminal` exactly once for Perplexity deep signal when Source 1 produced at least one trend keyword. If Source 1 failed or returned no usable keyword, do **not** invent a fallback keyword from headlines; mark Deep Signal unavailable with the required bullet.

```text
terminal(command="bash scripts/session-close/hermes-run-perplexity.sh <shellQuote(top_trend_keyword)>", workdir=resolved_repo_root, timeout=45)
```

Where `top_trend_keyword` is the **top** item from Source 1 (after sort by `normalizedValue` descending). Use the same `shellQuote(value)` transform as Source 6.

Stdout shape (Perplexity only):

```json
{ "deepSignal": "2-3 sentence sweep...", "topTrend": "ai agents" }
```

**After the Perplexity terminal returns** (mandatory stdout threading):

1. Let `pplx_stdout` = Perplexity terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `pplx_json = JSON.parse(pplx_stdout)` inside try/catch or equivalent safe parse.
3. If `pplx_json.error` (string) → treat as failure; reason = that string.
4. Else if `typeof pplx_json.deepSignal === 'string' && pplx_json.deepSignal.trim()`:
   - Emit **2–3 sentences** under **Deep Signal** using `pplx_json.deepSignal` (already ≤1200 chars from adapter).
   - Use `pplx_json.topTrend` for the section header keyword when present.
5. Else → failure (empty `deepSignal`, invalid shape, or parse error).
6. On failure: section header **Deep Signal** + `- (source unavailable: <short reason>)` and **continue** to Source 6.
7. Missing top trend keyword (do not call terminal): write `- (source unavailable: no top trend keyword)`.

Failure mapping: `perplexity timeout` → `- (source unavailable: perplexity timeout)`; `missing PERPLEXITY_API_KEY` → `- (source unavailable: missing PERPLEXITY_API_KEY)`.

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
   - For Discord **GitHub**, list each repo as `- <title> — <stars> stars, <forks> forks` where `<title>` is `repos[].title` (owner/repo string).
5. Else → failure (empty `repos`, invalid shape, or parse error).
6. On failure: section header **GitHub** + `- (source unavailable: <short reason>)` and **continue** to Source 8.
7. **Anti-pattern:** Do not read `stories[]`, `posts[]`, or `entries[]` from GitHub stdout — those keys belong to Sources 5, 8, and 9 only.
8. **Anti-pattern (Discord):** **DO NOT post bare URLs or link previews** in **GitHub** — do not post bare `repos[].url` values, angle-bracket URLs, or markdown autolinks; Discord renders **link preview cards** instead of contract bullets. Required bullet: `- owner/repo — N stars, M forks` using `repos[].title`; `url` is for §9 Convex mapping only.

## Source 8 — Reddit

Call `terminal` exactly once for Reddit top listings via public JSON (no OAuth). The script reads `MORNING_DIGEST_REDDIT_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). User-Agent (`CNS-morning-digest/1.0`) is set inside the script — the operator does not configure it for digest. It prints JSON with either `{"posts":[...]}` or `{"error":"..."}` and always exits **0** on failure:

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
   - Emit up to **N** posts (default **5**, configurable via `MORNING_DIGEST_REDDIT_MAX_POSTS`); requires `MORNING_DIGEST_REDDIT_SUBREDDITS` (comma-separated subreddit names; `r/` prefix is stripped automatically when present).
   - For Discord **Reddit**, list each post as `- <title> — <upvotes> upvotes, <commentCount> comments`.
5. Else → failure (empty `posts`, invalid shape, or parse error).
6. On failure: section header **Reddit** + `- (source unavailable: <short reason>)` and **continue** to Source 9.
7. **Anti-pattern:** Do not read `stories[]`, `repos[]`, or `entries[]` from Reddit stdout — those keys belong to Sources 5, 7, and 9 only.

## Source 9 — Newsletters / RSS

Call `terminal` exactly once for curated RSS/Substack feeds. The script reads `MORNING_DIGEST_RSS_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"entries":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-rss.sh", workdir=resolved_repo_root, timeout=45)
```

**Pre-flight gate:** If the `hermes-run-rss.sh` terminal has not fired, do not proceed to Source 10 or Source 6.

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

**Pre-flight gate:** If the `hermes-run-producthunt.sh` terminal has not fired, do not proceed to Source 11 or Source 6.

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
6. On failure: section header **Product Hunt** + `- (source unavailable: <short reason>)` and **continue** to Source 11.
7. **Anti-pattern:** Do not read `repos[]`, `posts[]`, `stories[]`, or `entries[]` from Product Hunt stdout — those keys belong to Sources 5, 7, 8, and 9 only.

## Source 11 — X / Twitter

Call `terminal` exactly once for X/Twitter curated accounts and optional search queries via vendored bird-search GraphQL. The script reads `X_AUTH_TOKEN`, `X_CT0`, and `MORNING_DIGEST_X_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"posts":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-x.sh", workdir=resolved_repo_root, timeout=60)
```

**Pre-flight gate:** If the `hermes-run-x.sh` terminal has not fired, do not proceed to Source 12 or Source 6.

Stdout shape (X / Twitter only — do not confuse with Sources 5, 7, 8, 9, or 10 keys):

```json
{ "posts": [{ "title": "...", "authorHandle": "karpathy", "url": "https://x.com/karpathy/status/123", "likes": 1200, "reposts": 340, "replies": 89, "quotes": 12, "publishedAt": "2026-06-11T08:00:00Z" }] }
```

**After the X / Twitter terminal returns** (mandatory stdout threading — mirror Sources 7–10):

1. Let `x_stdout` = X / Twitter terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `x_json = JSON.parse(x_stdout)` inside try/catch or equivalent safe parse.
3. If `x_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(x_json.posts) && x_json.posts.length > 0`:
   - Read **`x_json.posts`** (`posts[]` stdout array key) only — each item uses `title`, `authorHandle`, `url`, `likes`, `reposts`, `replies`, `quotes` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata`: `posts[].likes` → `sourceMetadata.likes`, `posts[].reposts` → `sourceMetadata.reposts`, `posts[].replies` → `sourceMetadata.replies`, `posts[].quotes` → `sourceMetadata.quotes`; map `posts[].authorHandle` → `sourceMetadata.authorHandle`; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `posts[].title` → `summary`.
   - Emit up to **N** posts (default **20**, hard cap **50** via `MORNING_DIGEST_X_MAX_TWEETS`); requires `X_AUTH_TOKEN` + `X_CT0` session cookies when enabled.
   - For Discord **X / Twitter**, list each post as `- <title> — <likes> likes, <reposts> reposts` (optional author sub-bullet when present).
5. Else → failure (empty `posts`, invalid shape, or parse error).
6. On failure: section header **X / Twitter** + `- (source unavailable: <short reason>)` and **continue** to Source 12.
7. **Anti-pattern:** Do not read `launches[]`, `repos[]`, `stories[]`, or `entries[]` from X stdout — those keys belong to Sources 5, 7, 9, and 10 only.

## Source 12 — Bluesky

Call `terminal` exactly once for Bluesky public author feeds via AT Protocol AppView. The script reads `MORNING_DIGEST_BSKY_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"posts":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-bluesky.sh", workdir=resolved_repo_root, timeout=45)
```

**Pre-flight gate:** If the `hermes-run-bluesky.sh` terminal has not fired, do not proceed to Source 13 or Source 6.

Stdout shape (Bluesky only — do not confuse with Sources 5, 7, 8, 9, or 10 keys):

```json
{ "posts": [{ "title": "...", "authorHandle": "simonwillison.net", "url": "https://bsky.app/profile/simonwillison.net/post/3l...", "publishedAt": "2026-06-11T07:30:00Z", "likes": 450, "reposts": 120, "replies": 34, "quotes": 8 }] }
```

**After the Bluesky terminal returns** (mandatory stdout threading — mirror Sources 7–10):

1. Let `bsky_stdout` = Bluesky terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `bsky_json = JSON.parse(bsky_stdout)` inside try/catch or equivalent safe parse.
3. If `bsky_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(bsky_json.posts) && bsky_json.posts.length > 0`:
   - Read **`bsky_json.posts`** (`posts[]` stdout array key) only — each item uses `title`, `authorHandle`, `url`, `likes`, `reposts`, `replies`, `quotes` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata`: `posts[].likes` → `sourceMetadata.likes`, `posts[].reposts` → `sourceMetadata.reposts`, `posts[].replies` → `sourceMetadata.replies`, `posts[].quotes` → `sourceMetadata.quotes`; map `posts[].authorHandle` → `sourceMetadata.authorHandle`; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `posts[].title` → `summary`.
   - Emit up to **N** posts (default **25**, hard max **50**, configurable via `MORNING_DIGEST_BSKY_MAX_POSTS`); uses public `getAuthorFeed` only — no app password in v1.
   - For Discord **Bluesky**, list each post as `- <title> — <likes> likes, <reposts> reposts` (optional author sub-bullet when present).
5. Else → failure (empty `posts`, invalid shape, or parse error).
6. On failure: section header **Bluesky** + `- (source unavailable: <short reason>)` and **continue** to Source 13.
7. **Anti-pattern:** Do not read `launches[]`, `repos[]`, `stories[]`, or `entries[]` from Bluesky stdout — those keys belong to Sources 5, 7, 9, and 10 only.

## Source 13 — YouTube

Call `terminal` exactly once for YouTube Data API v3 search + statistics enrichment. The script reads `MORNING_DIGEST_YOUTUBE_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present (it resolves the operator home via `resolveOperatorHome` under Hermes isolation). It prints JSON with either `{"videos":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-youtube.sh", workdir=resolved_repo_root, timeout=45)
```

**Pre-flight gate:** If the `hermes-run-youtube.sh` terminal has not fired, do not proceed to Source 14 or Source 3.

Stdout shape (YouTube only — do not confuse with Sources 5, 7, 8, 9, 10, 11, or 12 keys):

```json
{ "videos": [{ "title": "Building AI agents with MCP — live demo", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "channelTitle": "Example Channel", "publishedAt": "2026-06-18T14:30:00.000Z", "viewCount": 12500, "likeCount": 890, "commentCount": 142 }] }
```

**After the YouTube terminal returns** (mandatory stdout threading — mirror Sources 7–12):

1. Let `yt_stdout` = YouTube terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `yt_json = JSON.parse(yt_stdout)` inside try/catch or equivalent safe parse.
3. If `yt_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(yt_json.videos) && yt_json.videos.length > 0`:
   - Read **`yt_json.videos`** (`videos[]` stdout array key) only — each item uses `title`, `url`, `channelTitle`, `viewCount`, `likeCount`, `commentCount` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata`: `videos[].viewCount` → `sourceMetadata.viewCount`, `videos[].likeCount` → `sourceMetadata.likes`, `videos[].commentCount` → `sourceMetadata.commentCount`; map `videos[].channelTitle` → `sourceMetadata.author`; map `videos[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `videos[].title` → `summary`.
   - Emit up to **N** videos (default **25**, hard max **50**, configurable via `MORNING_DIGEST_YOUTUBE_MAX_VIDEOS`); two-phase API flow (`search.list` then `videos.list` batch enrich).
   - For Discord **YouTube**, list each video as `- <title> — <viewCount> views, <likeCount> likes` (use `title` text; `url` for §9 only — no bare URL link previews).
5. Else → failure (empty `videos`, invalid shape, or parse error).
6. On failure: section header **YouTube** + `- (source unavailable: <short reason>)` and **continue** to Source 14.
7. **Anti-pattern:** Do not read `repos[]`, `posts[]`, `headlines[]`, `launches[]`, or `entries[]` from YouTube stdout — those keys belong to other sources only.

## Source 14 — TikTok

Call `terminal` exactly once for ScrapeCreators TikTok hashtag search (or trending fallback when hashtag list empty). The script reads `SCRAPECREATORS_API_KEY` and `MORNING_DIGEST_TIKTOK_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present. It prints JSON with either `{"videos":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-tiktok.sh", workdir=resolved_repo_root, timeout=45)
```

**Pre-flight gate:** If the `hermes-run-tiktok.sh` terminal has not fired, do not proceed to Source 15 or Source 3.

Stdout shape (TikTok only — do not confuse with Source 13 or other keys):

```json
{ "videos": [{ "title": "Caption trimmed", "url": "https://www.tiktok.com/@handle/video/1234567890", "author": "handle", "publishedAt": "2026-06-19T14:30:00.000Z", "viewCount": 125000, "likeCount": 8900, "commentCount": 420 }] }
```

**After the TikTok terminal returns** (mandatory stdout threading — mirror Source 13):

1. Let `tt_stdout` = TikTok terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `tt_json = JSON.parse(tt_stdout)` inside try/catch or equivalent safe parse.
3. If `tt_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(tt_json.videos) && tt_json.videos.length > 0`:
   - Read **`tt_json.videos`** only — each item uses `title`, `url`, `author`, `viewCount`, `likeCount`, `commentCount` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata`: `videos[].viewCount` → `sourceMetadata.viewCount`, `videos[].likeCount` → `sourceMetadata.likes`, `videos[].commentCount` → `sourceMetadata.commentCount`; map `videos[].author` → `sourceMetadata.author`; map `videos[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `videos[].title` → `summary`.
   - For Discord **TikTok**, list each video as `- <title> — <viewCount> views, <likeCount> likes`.
5. Else → failure (empty `videos`, invalid shape, or parse error).
6. On failure: section header **TikTok** + `- (source unavailable: <short reason>)` and **continue** to Source 15.
7. **Anti-pattern:** Do not read `reels[]`, `repos[]`, or `posts[]` from TikTok stdout.

## Source 15 — Instagram

Call `terminal` exactly once for ScrapeCreators Instagram hashtag search (Google-index-backed) with optional trending reels supplement. The script reads `SCRAPECREATORS_API_KEY` and `MORNING_DIGEST_INSTAGRAM_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present. It prints JSON with either `{"reels":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-instagram.sh", workdir=resolved_repo_root, timeout=45)
```

**Freshness callout:** Instagram hashtag search uses ScrapeCreators' **Google-index-backed** endpoint — results reflect what Google has indexed, **not** a live Instagram-native feed. Sparse or stale results on a given day are **expected behavior**, not adapter bugs.

**Pre-flight gate:** If the `hermes-run-instagram.sh` terminal has not fired, do not proceed to Source 16 or Source 6.

Stdout shape (Instagram only — do not confuse with Bluesky `posts[]` or YouTube `videos[]`):

```json
{ "reels": [{ "title": "Caption trimmed", "url": "https://www.instagram.com/reel/ABC123/", "author": "handle", "publishedAt": "2026-06-18T10:00:00.000Z", "viewCount": 50000, "likeCount": 1200, "commentCount": 88 }] }
```

**After the Instagram terminal returns** (mandatory stdout threading):

1. Let `ig_stdout` = Instagram terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `ig_json = JSON.parse(ig_stdout)` inside try/catch or equivalent safe parse.
3. If `ig_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(ig_json.reels) && ig_json.reels.length > 0`:
   - Read **`ig_json.reels`** only — each item uses `title`, `url`, `author`, `viewCount`, `likeCount`, `commentCount` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, nest engagement under `sourceMetadata` (same mapping as TikTok).
   - For Discord **Instagram**, list each reel as `- <title> — <viewCount> views, <likeCount> likes`.
5. Else → failure (empty `reels`, invalid shape, or parse error).
6. On failure: section header **Instagram** + `- (source unavailable: <short reason>)` and **continue** to Source 16.
7. **Anti-pattern:** Do not read `videos[]` or `posts[]` from Instagram stdout — Instagram uses `reels[]` only.

## Source 16 — Pinterest

Call `terminal` exactly once for ScrapeCreators Pinterest keyword search. The script reads `SCRAPECREATORS_API_KEY` and `MORNING_DIGEST_PINTEREST_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present. It prints JSON with either `{"pins":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-pinterest.sh", workdir=resolved_repo_root, timeout=45)
```

**Pre-flight gate:** If the `hermes-run-pinterest.sh` terminal has not fired, do not proceed to Source 17 or Source 6.

Stdout shape (Pinterest only — do not confuse with Instagram `reels[]` or TikTok `videos[]`):

```json
{ "pins": [{ "title": "Pin title trimmed", "description": "Pin description trimmed", "url": "https://www.pinterest.com/pin/123456789/", "link": "https://example.com/outbound-article", "imageUrl": "https://i.pinimg.com/...", "author": "pinner_username", "pinId": "123456789", "repinCount": 4200, "publishedAt": "2026-06-18T10:00:00.000Z" }] }
```

**After the Pinterest terminal returns** (mandatory stdout threading):

1. Let `pin_stdout` = Pinterest terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `pin_json = JSON.parse(pin_stdout)` inside try/catch or equivalent safe parse.
3. If `pin_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(pin_json.pins) && pin_json.pins.length > 0`:
   - Read **`pin_json.pins`** only — each item uses `title`, `url`, `author`, `repinCount` (number), optional `description`, `link`, `imageUrl`, `pinId`, `publishedAt` (ISO string).
   - When building §9 push signals, map `repinCount` → `sourceMetadata.upvotes` (Product Hunt analog — saves/repins are Pinterest's primary engagement signal).
   - For Discord **Pinterest**, list each pin as `- <title> — <repinCount> saves`.
5. Else → failure (empty `pins`, invalid shape, or parse error).
6. On failure: section header **Pinterest** + `- (source unavailable: <short reason>)` and **continue** to Source 17.
7. **Anti-pattern:** Do not read `videos[]`, `reels[]`, or `posts[]` from Pinterest stdout — Pinterest uses `pins[]` only.

## Source 17 — Polymarket

Call `terminal` exactly once for Polymarket Gamma API keyword search (primary). The script reads `MORNING_DIGEST_POLYMARKET_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present. **No API key required.** It prints JSON with either `{"markets":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-polymarket.sh", workdir=resolved_repo_root, timeout=45)
```

**Pre-flight gate:** If the `hermes-run-polymarket.sh` terminal has not fired, do not proceed to Source 18 or Source 6.

**Watchlist (primary):** `MORNING_DIGEST_POLYMARKET_KEYWORDS` — comma-separated topical keywords (e.g. `AI model,Claude,Bitcoin ETF,Fed rate cut`). **Secondary (optional):** `MORNING_DIGEST_POLYMARKET_TAG_SLUGS` for category slugs — use keywords as the default documented path; tag slugs are optional breadth, not the primary signal focus.

Stdout shape (Polymarket only — do not confuse with Google Trends `events[]`):

```json
{ "markets": [{ "question": "Will Google have the best AI model at the end of June 2026?", "url": "https://polymarket.com/market/will-google-have-the-best-ai-model-at-the-end-of-june-2026", "marketId": "631139", "conditionId": "0x0bd1...", "slug": "will-google-have-the-best-ai-model-at-the-end-of-june-2026", "outcomes": ["Yes", "No"], "outcomePrices": [0.42, 0.58], "leadingOutcome": "No", "leadingProbability": 0.58, "volumeUsd": 15988722.19, "volume24hrUsd": 300444.42, "liquidityUsd": 70032.71, "endDate": "2026-06-30T00:00:00.000Z", "updatedAt": "2026-06-20T03:53:39.319Z" }] }
```

**After the Polymarket terminal returns** (mandatory stdout threading):

1. Let `pm_stdout` = Polymarket terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `pm_json = JSON.parse(pm_stdout)` inside try/catch or equivalent safe parse.
3. If `pm_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(pm_json.markets) && pm_json.markets.length > 0`:
   - Read **`pm_json.markets`** only — each item uses `question`, `url`, `leadingOutcome`, `leadingProbability` (0–1), `volume24hrUsd`, `liquidityUsd`, optional `outcomes`/`outcomePrices` arrays.
   - When building §9 push signals, map `volume24hrUsd` → `sourceMetadata.upvotes` (24h trading volume — scoring analog).
   - For Discord **Polymarket**, list each market as `- <question> — <leadingOutcome> <pct>% · $<volume24hr> 24h vol` (human-readable percent, not raw 0–1).
5. Else → failure (empty `markets`, invalid shape, or parse error).
6. On failure: section header **Polymarket** + `- (source unavailable: <short reason>)` and **continue** to Source 18.
7. **Anti-pattern:** Do not read `events[]` from Polymarket stdout — Polymarket uses `markets[]` only (Google Trends owns `events[]`).

## Source 18 — Threads

Call `terminal` exactly once for ScrapeCreators Threads handle watchlist (primary). The script reads `SCRAPECREATORS_API_KEY` and `MORNING_DIGEST_THREADS_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present. It prints JSON with either `{"posts":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-threads.sh", workdir=resolved_repo_root, timeout=45)
```

**Handle watchlist (primary):** `MORNING_DIGEST_THREADS_HANDLES` — comma-separated Threads usernames (e.g. `sama,karpathy,AnthropicAI,simonw,emollick`). **Optional secondary:** `MORNING_DIGEST_THREADS_KEYWORDS` only when live `/v1/threads/search` is confirmed — supplementary low-trust recall, max 5 keywords.

**Platform limit callout:** `GET /v1/threads/user/posts` returns only the **last 20–30 publicly visible posts** per handle. Sparse results are expected — not an adapter bug.

**Pre-flight gate:** If the `hermes-run-threads.sh` terminal has not fired, do not proceed to Source 19 or Source 6.

Stdout shape (Threads only — same key as X/Bluesky but from a separate adapter process):

```json
{ "posts": [{ "title": "Caption text trimmed", "url": "https://www.threads.com/@karpathy/post/DIU8naHS6q_", "authorHandle": "karpathy", "author": "karpathy", "publishedAt": "2026-06-19T14:30:00.000Z", "likes": 4200, "reposts": 180, "replies": 95, "postCode": "DIU8naHS6q_", "postId": "1234567890" }] }
```

**After the Threads terminal returns** (mandatory stdout threading):

1. Let `th_stdout` = Threads terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `th_json = JSON.parse(th_stdout)` inside try/catch or equivalent safe parse.
3. If `th_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(th_json.posts) && th_json.posts.length > 0`:
   - Read **`th_json.posts`** only — each item uses `title`, `url`, `authorHandle`, `likes`, `reposts`, `replies` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, map engagement under `sourceMetadata`: `likes`, `reposts`, `replies`, `authorHandle`, `author`, `publishedAt` (mirror X/Bluesky — **not** `postCode`/`postId`).
   - For Discord **Threads**, list each post as `- @<authorHandle>: <title> — <likes> likes, <reposts> reposts`.
5. Else → failure (empty `posts`, invalid shape, or parse error).
6. On failure: section header **Threads** + `- (source unavailable: <short reason>)` and **continue** to Source 19.
7. **Anti-pattern:** Do not read `markets[]`, `videos[]`, or `reels[]` from Threads stdout — Threads uses `posts[]` only (same key as X/Bluesky but separate terminal stdout).

## Source 19 — LinkedIn

Call `terminal` exactly once for ScrapeCreators LinkedIn dual primary watchlists (company pages + founder profiles). The script reads `SCRAPECREATORS_API_KEY` and `MORNING_DIGEST_LINKEDIN_*` from the process environment and from `$HOME/.hermes/trend-ingest.env` when present. It prints JSON with either `{"posts":[...]}` or `{"error":"..."}` and always exits **0** on failure:

```text
terminal(command="bash scripts/session-close/hermes-run-linkedin.sh", workdir=resolved_repo_root, timeout=60)
```

**Professional intelligence layer:** LinkedIn signals reflect company positioning, hiring narratives, and B2B/founder discourse — not real-time trend chatter.

**Dual primary watchlists (no URL-shape inference):**
- `MORNING_DIGEST_LINKEDIN_COMPANIES` — company page URLs/slugs only (e.g. `anthropic,openai,cursor`)
- `MORNING_DIGEST_LINKEDIN_PROFILES` — founder/operator profile URLs/vanity slugs only (e.g. `emollick,karpathy,sama`)
- At least one list must be set. **Do not** route profiles through `COMPANIES` or companies through `PROFILES`.

**Optional secondary:** `MORNING_DIGEST_LINKEDIN_KEYWORDS` — Google-index-backed keyword supplement only (max 5); sparse/stale results may lag actual posting activity — **source characteristic**, not adapter bug.

**Profile limitation:** Public profile endpoint does **not** return work history or job title — do not expect those fields in signals or scoring.

**Pre-flight gate:** If the `hermes-run-linkedin.sh` terminal has not fired, do not proceed to Source 3 or Source 6.

Stdout shape (LinkedIn only — same `posts[]` key as X/Bluesky/Threads but from a separate adapter process):

```json
{ "posts": [{ "title": "Post text trimmed", "url": "https://www.linkedin.com/posts/openai_...", "authorHandle": "openai", "author": "openai", "publishedAt": "2026-06-19T14:30:00.000Z", "likes": 420, "commentCount": 38, "postId": "7473441251686752257" }] }
```

**After the LinkedIn terminal returns** (mandatory stdout threading):

1. Let `li_stdout` = LinkedIn terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `li_json = JSON.parse(li_stdout)` inside try/catch or equivalent safe parse.
3. If `li_json.error` (string) → treat as failure; reason = that string.
4. Else if `Array.isArray(li_json.posts) && li_json.posts.length > 0`:
   - Read **`li_json.posts`** only — each item uses `title`, `url`, `authorHandle`, `author`, `likes`, `commentCount` (numbers), optional `publishedAt` (ISO string).
   - When building §9 push signals, map engagement under `sourceMetadata`: `likes`, `commentCount`, `authorHandle`, `author`, `publishedAt` — **not** `postId` or `sourceKind`.
   - For Discord **LinkedIn**, list each post as `- <author>: <title> — <likes> likes, <commentCount> comments`.
5. Else → failure (empty `posts`, invalid shape, or parse error).
6. On failure: section header **LinkedIn** + `- (source unavailable: <short reason>)` and **continue** to Source 3.
7. **Anti-pattern:** Do not read `markets[]`, `videos[]`, or `reels[]` from LinkedIn stdout — LinkedIn uses `posts[]` only.

## Source 6 — Vault context (NotebookLM)

Run **after** Source 19 and Source 3 complete. Do **not** use `mcp__notebooklm__notebook_query` — CLI only.

**Prerequisite:** Terminals for Sources **9**, **10**, **11**, **12**, **13**, **14**, **15**, **16**, **17**, **18**, **19**, and **3** have fired (success or `(source unavailable)` recorded in the Output Contract). Do not run `pick-signal-notebook.mjs` until all twelve terminals complete.

### Build `digest_sources` (for scoring)

After Sources 1–5, Source 7, Source 8, Source 9, Source 10, Source 11, Source 12, Source 13, Source 14, Source 15, Source 16, Source 17, Source 18, and Source 19 complete, assemble a JSON object from parsed tool outputs (skip a source that failed with `source unavailable` — use an empty array or omit that field):

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
  "producthunt": [{ "title": "<string>", "url": "<string>", "votesCount": <number> }],
  "twitter": [{ "title": "<string>", "url": "<string>", "likes": <number>, "reposts": <number> }],
  "bluesky": [{ "title": "<string>", "url": "<string>", "likes": <number>, "reposts": <number> }],
  "youtube": [{ "title": "<string>", "url": "<string>", "viewCount": <number>, "likeCount": <number> }],
  "tiktok": [{ "title": "<string>", "url": "<string>", "viewCount": <number>, "likeCount": <number> }],
  "instagram": [{ "title": "<string>", "url": "<string>", "viewCount": <number>, "likeCount": <number> }],
  "pinterest": [{ "title": "<string>", "url": "<string>", "repinCount": <number> }],
  "polymarket": [{ "question": "<string>", "url": "<string>", "volume24hrUsd": <number>, "leadingProbability": <number> }],
  "threads": [{ "title": "<string>", "url": "<string>", "likes": <number>, "reposts": <number>, "authorHandle": "<string>" }],
  "linkedin": [{ "title": "<string>", "url": "<string>", "likes": <number>, "commentCount": <number>, "authorHandle": "<string>" }]
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
- **twitter:** post **titles** from Source 11 when available (include `likes` and `reposts` for ranking in `buildDigestSignals`); omit or `[]` when X / Twitter is unavailable.
- **bluesky:** post **titles** from Source 12 when available (include `likes` and `reposts` for ranking in `buildDigestSignals`); omit or `[]` when Bluesky is unavailable.
- **youtube:** video **titles** from Source 13 when available (include `viewCount` and `likeCount` for ranking in `buildDigestSignals`); omit or `[]` when YouTube is unavailable.
- **tiktok:** video **titles** from Source 14 when available (include `viewCount` and `likeCount` for ranking); omit or `[]` when TikTok is unavailable.
- **instagram:** reel **titles** from Source 15 when available (include `viewCount` and `likeCount` for ranking); omit or `[]` when Instagram is unavailable.
- **pinterest:** pin **titles** from Source 16 when available (include `repinCount` for ranking); omit or `[]` when Pinterest is unavailable.
- **polymarket:** market **questions** from Source 17 when available (include `volume24hrUsd` and `leadingProbability` for ranking); omit or `[]` when Polymarket is unavailable.
- **threads:** post **titles** from Source 18 when available (include `likes`, `reposts`, and `authorHandle` for ranking and peopleMatch); omit or `[]` when Threads is unavailable.
- **linkedin:** post **titles** from Source 19 when available (include `likes`, `commentCount`, and `authorHandle` for ranking and peopleMatch); omit or `[]` when LinkedIn is unavailable.

`pick-signal-notebook.mjs` runs `buildDigestSignals(digest_sources)` internally: trends → headlines → Perplexity-derived phrases (up to 3) → arXiv titles (up to 3) → HackerNews titles (up to 3) → GitHub repo titles (up to 2, highest stars) → Reddit post titles (up to 2, highest upvotes) → RSS title (up to 1, most recent by `publishedAt` when available) → Product Hunt launch titles (up to 2, highest votesCount) → X / Twitter post titles (up to 2, highest likes + reposts) → Bluesky post titles (up to 2, highest likes + reposts) → YouTube video titles (up to 2, highest viewCount) → TikTok video titles (up to 2, highest viewCount) → Instagram reel titles (up to 2, highest viewCount) → Pinterest pin titles (up to 2, highest repinCount) → Polymarket questions (up to 2, highest volume24hrUsd) → Threads post titles (up to 2, highest likes + 2×reposts) → LinkedIn post titles (up to 2, highest likes + 2×commentCount), case-insensitive dedupe (first wins), cap **10** signals total. Do **not** hand-build a `SIGNALS_JSON` array from memory.

Before building the Source 6 pick-signal / query terminal commands, shell-quote every dynamic environment value with this exact POSIX single-quote transform:

```text
shellQuote(value) = "'" + String(value).replaceAll("'", "'\\''") + "'"
```

Use `shellQuote(...)` for `DIGEST_SOURCES_JSON`, `NOTEBOOK_ID`, `NOTEBOOK_QUERY`, `NOTEBOOK_REMAINING_S`, and `QUERY_SCRIPT` (Source 6), and for `LOG_SCRIPT`, `NOTEBOOK_ANSWER`, `NOTEBOOK_TITLE`, and `NOTEBOOK_DOMAIN` (post-post log). Do not pass raw headline text, matched signals, or NotebookLM queries unquoted.

### Pick notebook

Call `terminal` once:

```text
terminal(
  command="PICK_SCRIPT=<shellQuote(resolved_repo_root + '/scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs')> DIGEST_SOURCES_JSON=<shellQuote(JSON.stringify(digest_sources))> node \"$PICK_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=30
)
```

The script also supports legacy `SIGNALS_JSON=<shellQuote(signals_json)>` (JSON array of strings) for manual runs, `node .../pick-signal-notebook.mjs <registryPath>` when `DIGEST_SOURCES_JSON` or `SIGNALS_JSON` is set, and legacy `node ... '<json-array>' <registryPath>` when neither env is set.

**Anti-pattern:** Do **not** invoke this script with `bash` — `.mjs` files are ES modules and require `node` (`import: command not found` under bash).

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

## Pre-Discord — Build, score, and persist digest push payload (REQUIRED)

After Sources **1–5, 7–13, 3, and 6** complete and `digest_sources` is assembled, build `digest_push_payload` from parsed source outputs (not memory) using the shape and signal mapping in **§9 Post-post — Push digest entities to Convex** below.

**Discord post is forbidden** until **§9 map construction**, **dedupe**, **scoring**, and the **Persist digest push artifact** terminals return. The artifact must capture **post-dedup, post-scoring** `digest_push_payload` (same payload §9 will push later).

### Build `digest_push_payload.signals` from §9 map (REQUIRED — non-negotiable)

> **Pin this gate.** Epic 68-8 live validation failed when dedupe ran with empty `DIGEST_SIGNALS_JSON` because this step was skipped. **Do not invoke `dedupe-digest-signals.mjs` until this section completes.**

**Precondition:** Terminals for Sources **0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13, 3, and 6** have fired (success or `(source unavailable)` recorded). Source 6 (`pick-signal-notebook.mjs`) runs **only after** Sources 9–13 and Source 3 complete — vault routing does **not** substitute for §9 signal assembly.

**Mandatory assembly (from adapter stdout only — not memory):**

1. Initialize `digest_push_payload = { run: { … }, signals: [] }` with `run.date` from Step 0, `run.ranAt = digest_start_ms`, and optional run fields from Sources 1–3 / Source 6 when available (`topTrend`, `focusKeyword`, `deepSignalSummary`, `notebookId`, `vaultContextSummary`).
2. For **each** source that returned parseable stdout, append signals to `digest_push_payload.signals[]` using the **Signal mapping (`signals[]`)** table in **§9 Post-post — Push digest entities to Convex** (Sources 1–5, 7–13). Thread stdout from each adapter terminal (`events[]`, `headlines[]`, `papers[]`, `stories[]`, `repos[]`, `posts[]`, `entries[]`, `launches[]`, `posts[]` for X, `posts[]` for Bluesky, `videos[]` for YouTube) — skip sections that failed with `(source unavailable)`.
3. Assign provisional integer `rank` per signal (section order is fine pre-scoring; scoring replaces ranks from `rankScore`).
4. **Gate check before dedupe:** Let `signals_json = JSON.stringify(digest_push_payload.signals)`. If **any** source succeeded but `digest_push_payload.signals.length === 0`, **stop** — re-read adapter stdout and re-run §9 mapping; do **not** call dedupe with an empty array. When at least one source succeeded, `signals_json` must be a non-empty JSON array string.
5. **Anti-patterns (must not ship):**
   - Invoking `dedupe-digest-signals.mjs` before step 4 completes
   - Building `DIGEST_SIGNALS_JSON` from notebook routing titles (`pick-signal-notebook.mjs` cap-10) instead of full §9 adapter mapping
   - Hand-rolling signals from Discord display text instead of parsed terminal JSON

**Pipeline order (binding):** adapters → Source 6 → **§9 map (this section)** → **dedup** → score → artifact → Discord → push.

### Dedupe signals before scoring (REQUIRED — Epic 68-1)

After **§9 map construction** (above) assigns unscored `digest_push_payload.signals` and **before** the scoring terminal, invoke the dedupe terminal:

```text
terminal(
  command="DEDUPE_SCRIPT=<shellQuote(dedupe_script)> DIGEST_SIGNALS_JSON=<shellQuote(JSON.stringify(digest_push_payload.signals))> node \"$DEDUPE_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=30
)
```

Where:

```text
dedupe_script = resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs"
```

Fallback if repo path missing: `$HOME/.hermes/skills/cns/morning-digest/scripts/dedupe-digest-signals.mjs`

**After the dedupe terminal returns** (mandatory stdout threading — same pattern as scoring):

1. Let `dedupe_stdout` = dedupe terminal **stdout** (trim whitespace; stderr is observability only).
2. Try `deduped_signals = JSON.parse(dedupe_stdout)`.
3. If `Array.isArray(deduped_signals) && deduped_signals.length > 0`:
   - `digest_push_payload.signals = deduped_signals` (replace the entire array; do not merge).
4. Else (empty stdout, invalid JSON, or `[]`):
   - keep existing unscored `digest_push_payload.signals` (degraded mode passthrough).
5. Do **not** invoke scoring until step 3 or 4 completes.

The script always exits **0**. Stderr warnings use prefix `dedupe-digest-signals:`.

**Pipeline order (binding):** adapters → §9 map → **dedup** → score → artifact → Discord → push.

**Anti-patterns (must not ship):**

- Dedup inside `pick-signal-notebook.mjs`
- Dedup after `scoreDigestSignals()` (engagement winner needs pre-score proxy)
- Dedup only on cap-10 notebook titles

### Score signals before push (REQUIRED — Epic 64-5)

After dedupe stdout replacement completes and **before** the artifact write or Discord post, invoke the scoring terminal:

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
5. Do **not** call `JSON.stringify(digest_push_payload)` for push or artifact until step 3 or 4 completes.
6. **Anti-pattern:** Do not pass pre-scoring `digest_push_payload.signals` to `push-digest-convex.mjs` when step 3 assigned scored signals.

The script always exits **0**. Stderr warnings use prefix `score-digest-signals:`.

### Persist digest push artifact (REQUIRED — before Discord post)

> **REQUIRED — recovery artifact for §9 watchdog.** Non-negotiable even under context compression. Invoke **after** dedupe and scoring stdout replacement complete (above) and **before** posting the Output contract to `#hermes`. The 07:15 push-digest-watchdog cron replays Convex push from this file when the agent skips §9.

**Precondition:** `digest_push_payload` is **post-dedup, post-scoring** (dedupe stdout replacement, then scoring stdout replacement completed). Use `digest_push_payload.run.date` as `<YYYY-MM-DD>` in the artifact filename (Australia/Sydney from Step 0).

1. Let `artifact_script` = `resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/write-digest-push-artifact.mjs"` (fallback only when repo path missing: `$HOME/.hermes/skills/cns/morning-digest/scripts/write-digest-push-artifact.mjs`).
2. **MUST** invoke the `terminal(...)` block below — no alternative write path.
3. **Do not** post to `#hermes` until this terminal returns.
4. Under Hermes HOME isolation, the script resolves operator home via `resolveOperatorHome` — artifact lands in the operator's `~/.hermes/digest-push-<YYYY-MM-DD>.json`, not the isolated profile nested path.

```text
terminal(
  command="ARTIFACT_SCRIPT=<shellQuote(artifact_script)> DIGEST_PUSH_JSON=<shellQuote(JSON.stringify(digest_push_payload))> node \"$ARTIFACT_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=15
)
```

The script always exits **0**. Stderr warnings use prefix `write-digest-push-artifact:`.

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
(DO NOT post bare URLs or link previews — use `- owner/repo — N stars, M forks` bullets from `title` only; `url` is for §9 Convex mapping.)

**Reddit** (top posts)
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

**X / Twitter**
- <title> — <likes> likes, <reposts> reposts
- ...
(or - (source unavailable: <short reason>) when Source 11 failed)

**Bluesky**
- <title> — <likes> likes, <reposts> reposts
- ...
(or - (source unavailable: <short reason>) when Source 12 failed)

**YouTube**
- <title> — <viewCount> views, <likeCount> likes
- ...
(or - (source unavailable: <short reason>) when Source 13 failed)

**TikTok**
- <title> — <viewCount> views, <likeCount> likes
- ...
(or - (source unavailable: <short reason>) when Source 14 failed)

**Instagram**
- <title> — <viewCount> views, <likeCount> likes
- ...
(or - (source unavailable: <short reason>) when Source 15 failed)

**Pinterest**
- <title> — <repinCount> saves
- ...
(or - (source unavailable: <short reason>) when Source 16 failed)

**Polymarket**
- <question> — <leadingOutcome> <pct>% · $<volume24hr> 24h vol
- ...
(or - (source unavailable: <short reason>) when Source 17 failed)

**Threads**
- @<authorHandle>: <title> — <likes> likes, <reposts> reposts
- ...
(or - (source unavailable: <short reason>) when Source 18 failed)

**LinkedIn**
- <author>: <title> — <likes> likes, <commentCount> comments
- ...
(or - (source unavailable: <short reason>) when Source 19 failed)

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

Run **after** Sources **1–5, 7–15, 3, and 6** were attempted, `digest_sources` was assembled, the full digest was posted to `#hermes`, and the notebook Convex log step (when applicable) has finished — so `notebookId` and `vaultContextSummary` are available on ROUTED+success runs. This step is **mandatory** and runs **after** the Discord post, but it is only **half** of the completion gate — §10 (`push-keyword-candidates.mjs`) must fire next with the same payload. Failure handling is **fire-and-forget** — the push script always exits **0** and you never post a Discord warning on failure — but "fire-and-forget" applies only to the *result*, never to whether the call runs. The invocation itself is required.

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
| `twitter` | `twitter` | Source 11 `posts[]` | `title` | first 200 chars of `title` | `url` | — | url hash or title+date hash |
| `bluesky` | `bluesky` | Source 12 `posts[]` | `title` | first 200 chars of `title` | `url` | — | url hash or title+date hash |
| `youtube` | `youtube` | Source 13 `videos[]` | `title` | first 200 chars of `title` | `url` | — | `sha256(url).slice(0,16)` |
| `tiktok` | `tiktok` | Source 14 `videos[]` | `title` | first 200 chars of `title` | `url` | — | `sha256(url).slice(0,16)` |
| `instagram` | `instagram` | Source 15 `reels[]` | `title` | first 200 chars of `title` | `url` | — | shortcode or url hash |
| `pinterest` | `pinterest` | Source 16 `pins[]` | `title` | first 200 chars of `description` or `title` | `url` | — | `pinId` or `sha256(url).slice(0,16)` |
| `polymarket` | `polymarket` | Source 17 `markets[]` | `question` | `<leadingOutcome> <pct>% · vol $<volume24hr> · liq $<liquidity>` (truncate 200) | `url` | — | `marketId` or `sha256(conditionId).slice(0,16)` |
| `threads` | `threads` | Source 18 `posts[]` | `title` | first 200 chars of `title` | `url` | — | `postId` or `postCode` or `sha256(url).slice(0,16)` |
| `linkedin` | `linkedin` | Source 19 `posts[]` | `title` | first 200 chars of `title` | `url` | — | `postId` or `sha256(url).slice(0,16)` |

- `rank`: assigned by `scoreDigestSignals` from descending `rankScore` sort (1 = highest `rankScore`). Replaces legacy section-index ordering.
- `sourceMetadata` engagement fields (all optional — **omit when absent, never `null`**):
  - HN: map RSS `score` → `points` (number); RSS `comments` → `commentCount` (number). Legacy `sourceMetadata.comments` remains accepted by validators but prefer `points` + `commentCount` for engagement normalization (64-4).
  - arXiv: `categories` (array of strings from `category`) when present.
  - GitHub: map `repos[].stars` → `sourceMetadata.stars` (number, **required** for engagement normalization); map `repos[].forks` → `sourceMetadata.forks` (number) when present; map `repos[].publishedAt` → `sourceMetadata.publishedAt` when present. **Never** leave `stars`/`forks` at the signal root — `normalizeEngagement` reads only `sourceMetadata.stars`/`sourceMetadata.forks`; root-level fields score as null silently.
  - Reddit: map `posts[].upvotes` → `sourceMetadata.upvotes` (number, **required** for engagement normalization); map `posts[].commentCount` → `sourceMetadata.commentCount` (number) when present; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present. **Never** leave `upvotes`/`commentCount` at the signal root — `normalizeEngagement` reads only `sourceMetadata.upvotes`/`sourceMetadata.commentCount`; root-level fields score as null silently.
  - RSS: map `entries[].publishedAt` → `sourceMetadata.publishedAt` when present; map `entries[].author` → `sourceMetadata.author` when present. **No engagement fields** — omit `stars`, `upvotes`, `points`, etc. **Never** leave `publishedAt`/`author` at the signal root.
  - Product Hunt: map `launches[].votesCount` → `sourceMetadata.upvotes` (number, **required** for engagement normalization); map `launches[].tagline` → `summary`; map `launches[].createdAt` → `sourceMetadata.publishedAt` when present. **Never** leave `votesCount` at the signal root — `normalizeEngagement` reads only `sourceMetadata.upvotes`; root-level fields score as null silently.
  - X / Twitter: map `posts[].likes` / `posts[].reposts` / `posts[].replies` / `posts[].quotes` → same keys under `sourceMetadata` (numbers); map `posts[].authorHandle` → `sourceMetadata.authorHandle`; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `posts[].title` → `summary`. **Never** leave engagement fields at the signal root — `normalizeEngagement` reads only `sourceMetadata.likes`/`reposts`/`replies`/`quotes`; root-level fields score as null silently.
  - Bluesky: map `posts[].likes` / `posts[].reposts` / `posts[].replies` / `posts[].quotes` → same keys under `sourceMetadata` (numbers); map `posts[].authorHandle` → `sourceMetadata.authorHandle`; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `posts[].title` → `summary`. **Never** leave engagement fields at the signal root — `normalizeEngagement` reads only `sourceMetadata.likes`/`reposts`/`replies`/`quotes`; root-level fields score as null silently.
  - YouTube: map `videos[].viewCount` → `sourceMetadata.viewCount` (number); map `videos[].likeCount` → `sourceMetadata.likes` (number); map `videos[].commentCount` → `sourceMetadata.commentCount` (number); map `videos[].channelTitle` → `sourceMetadata.author`; map `videos[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `videos[].title` → `summary`. **Never** leave engagement fields at the signal root — `normalizeEngagement` reads only `sourceMetadata.viewCount`/`likes`/`commentCount`; root-level fields score as null silently.
  - TikTok: map `videos[].viewCount` → `sourceMetadata.viewCount`; map `videos[].likeCount` → `sourceMetadata.likes`; map `videos[].commentCount` → `sourceMetadata.commentCount`; map `videos[].author` → `sourceMetadata.author`; map `videos[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `videos[].title` → `summary`.
  - Instagram: map `reels[].viewCount` → `sourceMetadata.viewCount`; map `reels[].likeCount` → `sourceMetadata.likes`; map `reels[].commentCount` → `sourceMetadata.commentCount`; map `reels[].author` → `sourceMetadata.author`; map `reels[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `reels[].title` → `summary`.
  - Pinterest: map `pins[].repinCount` → `sourceMetadata.upvotes` (number, **required** for engagement normalization — Product Hunt analog); map `pins[].author` → `sourceMetadata.author`; map `pins[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `pins[].description` or `pins[].title` → `summary`. **Do not** push `imageUrl`, `description`, or `link` as metadata keys. **Never** leave `repinCount` at the signal root — `normalizeEngagement` reads only `sourceMetadata.upvotes`.
  - Polymarket: map `markets[].outcomes` → `sourceMetadata.outcomes`; map `markets[].outcomePrices` → `sourceMetadata.outcomePrices`; map `markets[].leadingOutcome` → `sourceMetadata.leadingOutcome`; map `markets[].leadingProbability` → `sourceMetadata.leadingProbability` (0–1); map `markets[].volumeUsd` → `sourceMetadata.volumeUsd`; map `markets[].volume24hrUsd` → `sourceMetadata.upvotes` (24h trading volume — scoring analog); map `markets[].liquidityUsd` → `sourceMetadata.liquidityUsd`; map `markets[].endDate` or `markets[].updatedAt` → `sourceMetadata.publishedAt`. **Do not** push `conditionId` or `slug` as metadata keys.
  - Threads: map `posts[].likes` / `posts[].reposts` / `posts[].replies` → same keys under `sourceMetadata` (numbers); map `posts[].authorHandle` → `sourceMetadata.authorHandle`; map `posts[].author` → `sourceMetadata.author`; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `posts[].title` → `summary`. **Do not** push `postCode` or `postId` as metadata keys.
  - LinkedIn: map `posts[].likes` / `posts[].commentCount` → same keys under `sourceMetadata` (numbers); map `posts[].authorHandle` → `sourceMetadata.authorHandle`; map `posts[].author` → `sourceMetadata.author`; map `posts[].publishedAt` → `sourceMetadata.publishedAt` when present; map first 200 chars of `posts[].title` → `summary`. **Do not** push `postId`, `sourceKind`, work history, job title, or headcount. **Never** leave engagement fields at the signal root.
- **Scoring fields (populated by scoring step below):** `scores` (object with all five keys when present: `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency` — each 0–100), `disposition` (`priority` | `watch` | `ignore` | `escalate`), `normalizedEngagement` (0–100), `rankScore` (0–100). Omit these keys only when the scoring terminal fails (§9 degraded mode).
- Use Node `crypto.createHash('sha256')` for hashes (built-in only).
- Empty sections → omit signals (no placeholder rows).

#### Each signal object — required schema (Convex validators are strict)

The `addDigestSignal` validator is a **strict** object: a missing required key **or** an unexpected/`null` value rejects the whole signal, and the push then finalizes the run as `failed` with **zero** signals stored. Build every signal object exactly to this contract:

- **Required keys on every signal — never omit:** `section`, `sourceType`, `title`, `rank`. Missing `section` is the most common failure — include it on **every** signal, paired with `sourceType` per the table above.
- **`section`** ∈ `trends` | `headlines` | `arxiv` | `hackernews` | `deep_signal` | `github` | `reddit` | `rss` | `producthunt` | `twitter` | `bluesky` | `youtube` | `tiktok` | `instagram` | `pinterest` | `polymarket` | `threads` | `linkedin`. **`sourceType`** ∈ `google_trends` | `newsapi` | `arxiv` | `hackernews` | `deep_signal` | `github` | `reddit` | `rss` | `producthunt` | `twitter` | `bluesky` | `youtube` | `tiktok` | `instagram` | `pinterest` | `polymarket` | `threads` | `linkedin`.
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

> **Executed in Pre-Discord section above** (before Discord post and before §9 push). The scoring terminal, stdout threading, and anti-patterns are documented there — do not skip or defer scoring to the post-Discord §9 block.

**Pipeline order (fixed):**

```text
build digest_push_payload (unscored signals)
  → dedupe terminal (Pre-Discord)
  → capture stdout → digest_push_payload.signals = deduped_signals
  → scoring terminal (Pre-Discord)
  → capture stdout → digest_push_payload.signals = scored_signals
  → persist digest push artifact terminal (post-dedup, post-scoring payload to ~/.hermes/digest-push-<date>.json)
  → Discord Output contract post
  → push terminal (DIGEST_PUSH_JSON uses post-scoring payload)
  → keyword candidates terminal (same post-scoring payload)
```

`DIGEST_PUSH_JSON` in the push command must reference `digest_push_payload` **after** signal replacement — not a stale copy from before scoring.

### DO NOT improvise — digest Convex push (pinned)

> **CRITICAL: Follow this sequence exactly.** Non-negotiable even under context compression.

**Forbidden:**

- Direct `fetch` to Convex `/api/mutation` or any Convex HTTP endpoint
- MCP Convex tools (`createDigestRun`, `addDigestSignal`, etc.)
- Hand-rolled `createDigestRun` / `addDigestSignal` loops in Node or shell
- Hand-rolled `node -e` one-liners or inline scripts that call Convex mutations directly
- Summarizing push as "done" without a `terminal` invocation
- Substituting `log-notebook-query.mjs` or any other script for digest entity push

**Required:** exactly one `terminal` call executing `node "$PUSH_SCRIPT"` where `PUSH_SCRIPT` resolves to `push-digest-convex.mjs` (repo path or `~/.hermes/skills/cns/morning-digest/scripts/` fallback).

**Before invoking the push terminal** (mandatory — mirror scoring stdout threading):

1. Let `push_script` = `resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs"` (fallback only when repo path missing: `$HOME/.hermes/skills/cns/morning-digest/scripts/push-digest-convex.mjs`).
2. Ensure `digest_push_payload` is **post-scoring** (scoring stdout replacement completed per steps above).
3. **MUST** invoke the `terminal(...)` block below — no alternative transport.
4. Let `push_stdout` / exit code be observability only; the script persists assigned IDs and runs the
   entity snapshot replacement before returning. Fire-and-forget **result** handling is unchanged.
5. **Anti-pattern:** Do not push digest entities by any path other than `push-digest-convex.mjs` with `DIGEST_PUSH_JSON`.

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
{"digest_convex_push":{"status":"ok|skipped-env|invalid-input|failed","entity_status":"ok|skipped|failed|not-run","exit_code":0,"reason":"..."}}
```

| status | When |
|--------|------|
| `ok` | Exit `0` and push completed |
| `skipped-env` | Exit `0` and stderr indicates missing `CONVEX_URL` / deploy key skip |
| `invalid-input` | Exit `0` and stderr indicates missing/invalid `DIGEST_PUSH_JSON` (`run.date` required) |
| `failed` | Exit `0` but stderr contains `push-digest-convex: warning` |

The push CLI writes its ID-bearing `pushedPayload` back to the recovery artifact and invokes
transactional entity replacement before returning. `entityResult.status` in stdout is the actionable
machine result; stderr remains a human-readable warning surface. Always `exit_code: 0`. Do **not** post
Discord warnings for digest or entity-stage failures. The graceful exit-0 / no-warning behavior governs
only the *outcome* — it does **not** make the push optional. The skill is still incomplete after this
call — proceed immediately to §10.

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
| `terminal` | Machine-local date; trend dry-run; NewsAPI; arXiv RSS; HackerNews RSS; Perplexity deep signal (`hermes-run-perplexity.sh`); `pick-signal-notebook.mjs`; `query-notebook.mjs`; `log-notebook-query.mjs` (post-post, success only); `dedupe-digest-signals.mjs` (Pre-Discord, before scoring); `score-digest-signals.mjs` (Pre-Discord, after dedup); `write-digest-push-artifact.mjs` (Pre-Discord, before Discord post); `push-digest-convex.mjs` (post-post, all runs); `push-keyword-candidates.mjs` (post-post, all runs) |
| Discord reply | Final formatted digest |

**Forbidden:** `vault_write`, `vault_append_daily`, `vault_create_note`, `mcp__notebooklm__notebook_query`, Firecrawl, dashboard APIs, session-close NotebookLM fan-out.

## Partial failure

Still post the full template with all section headers. Never invent headlines or trend keywords.

Never stop the run because an earlier source failed — only the failing section gets `- (source unavailable: …)`.
