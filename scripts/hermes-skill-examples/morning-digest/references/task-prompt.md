# Task: `morning-digest` (Story 49-6 + 52-1 + 52-2)

## 0) REFERENCE ONLY — invocation already confirmed

> **You have already been invoked.** The `config.yaml` trigger matched the incoming Discord message (manual `morning-digest` line or cron pseudo-trigger). Do not re-check or re-evaluate the Hermes skill binding.
> Proceed directly to **Hard constraints** and source collection — do not ask whether to run the digest.

For documentation purposes only (do not re-evaluate at runtime):

- Manual trigger: first non-empty line equals `morning-digest` or begins with `morning-digest ` (case-sensitive; single-line message). See `references/trigger-pattern.md`.
- Cron: operator schedule per `references/cron-snippet.md` / `references/trigger-pattern.md` (`--skill morning-digest`; not the Discord line-1 grammar).

## Hard constraints (must follow)

1. **Channel**: Discord `#hermes` only.
2. **No vault writes**: no Vault IO mutators, no files under `Knowledge-Vault-ACTIVE/`, no `00-Inbox/` captures.
3. **No dashboard relay**, no digest archive JSONL. **NotebookLM:** read-only via `query-notebook.mjs` after signal scoring — no `source_add`, no session-close fan-out, no `mcp__notebooklm__notebook_query`.
4. **Google Trends**: call the Hermes `terminal` tool with command `bash scripts/session-close/hermes-run-trend-ingest.sh` (wrapper must keep `--dry-run`). Dry-run prints JSON only — **no Convex push**, no norm-cache write.
5. **Secrets**: never echo `NEWSAPI_API_KEY` in Discord. Load credentials from **`$HOME/.hermes/trend-ingest.env`** only (never cwd-relative `.hermes/` or `./trend-ingest.env`). Under Hermes isolation the wrapper scripts remap `$HOME` back to the operator's real home (Epic 59), so this resolves to the operator's `~/.hermes/trend-ingest.env` and not the isolated `…/.hermes/home/.hermes/...` path.
6. **Date line**: `YYYY-MM-DD` from **machine-local** civil date (`process.env.TZ` if set, else OS default). Do not hardcode a region timezone in commands or config.
7. **Cross-source failures**: run Sources 1–6 independently. A failed source must not abort the digest — always post the full contract with `(source unavailable: …)` in the affected section(s).
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

Parse stdout JSON:

- `stories[]` with `title`, `link`, `score`, `comments` (integers).
- Emit up to **N** stories (default **5**, configurable via `MORNING_DIGEST_HN_MAX_STORIES`).

For Discord **HackerNews**, list each story as `- <title> — <score> pts, <comments> comments`.

On failure (`error` key, empty `stories`, or invalid stdout): section header **HackerNews** + `- (source unavailable: <short reason>)` and **continue** to Source 6.

## Source 6 — Vault context (NotebookLM)

Run **after** Source 5 completes. Do **not** use `mcp__notebooklm__notebook_query` — CLI only.

### Build `digest_sources` (for scoring)

After Sources 1–5 complete, assemble a JSON object from parsed tool outputs (skip a source that failed with `source unavailable` — use an empty array or omit that field):

```json
{
  "trends": [{ "keyword": "<string>", "normalizedValue": <number> }],
  "headlines": [{ "title": "<string>", "url": "<optional url>" }],
  "perplexityText": "<Deep Signal body text only — not the Perplexity query string>",
  "arxiv": [{ "title": "<string>", "snippet": "<string>" }],
  "hackernews": [{ "title": "<string>" }]
}
```

- **trends:** up to **5** keywords from Source 1 (`events[]`), sorted by `normalizedValue` descending (same sort/top-5 as Trending Now).
- **headlines:** up to **5** headline **titles** from Source 2.
- **perplexityText:** the **2–3 sentence Deep Signal** answer from Source 3 when Perplexity succeeded; omit or `""` when Deep Signal is unavailable.
- **arxiv:** paper **titles** and **snippets** from Source 4 when available; omit or `[]` when arXiv is unavailable.
- **hackernews:** story **titles** from Source 5 when available; omit or `[]` when HackerNews is unavailable.

`pick-signal-notebook.mjs` runs `buildDigestSignals(digest_sources)` internally: trends → headlines → Perplexity-derived phrases (up to 3) → arXiv titles (up to 3) → HackerNews titles (up to 3), case-insensitive dedupe (first wins), cap **10** signals total. Do **not** hand-build a `SIGNALS_JSON` array from memory.

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

Run **after** Sources 1–6 were attempted, `digest_sources` was assembled, the full digest was posted to `#hermes`, and the notebook Convex log step (when applicable) has finished — so `notebookId` and `vaultContextSummary` are available on ROUTED+success runs. This step is **mandatory** and runs **after** the Discord post, but it is only **half** of the completion gate — §10 (`push-keyword-candidates.mjs`) must fire next with the same payload. Failure handling is **fire-and-forget** — the push script always exits **0** and you never post a Discord warning on failure — but "fire-and-forget" applies only to the *result*, never to whether the call runs. The invocation itself is required.

**Precondition:** Discord post complete. Build `digest_push_payload` from parsed source outputs (not memory).

### Signal mapping (`signals[]`)

| Section | sourceType | Source data | title | summary | url | score | externalId |
|---------|------------|-------------|-------|---------|-----|-------|------------|
| `trends` | `google_trends` | Source 1 `events[]` | `keyword` | — | — | `normalizedValue` | `sha256(keyword + date)` short hex |
| `headlines` | `newsapi` | Source 2 `headlines[]` | `title` | — | `url` if present | — | url hash or title+date hash |
| `deep_signal` | `deep_signal` | Source 3 body | first 80 chars or `"Deep Signal"` | full text | — | — | `sha256(date + topTrend)` short hex |
| `arxiv` | `arxiv` | Source 4 `papers[]` | `title` | `snippet` | `link` | — | arxiv id from link (`/\d+\.\d+`) or link hash |
| `hackernews` | `hackernews` | Source 5 `stories[]` | `title` | — | `link` | `score` | HN item id from link/comments URL or title+date hash |

- `rank`: 1-based index within each section in display order (legacy ordering; Epic 64 scoring stories will assign `rank` from `rankScore` sort in 64-5).
- `sourceMetadata` engagement fields (all optional — **omit when absent, never `null`**):
  - HN: map RSS `score` → `points` (number); RSS `comments` → `commentCount` (number). Legacy `sourceMetadata.comments` remains accepted by validators but prefer `points` + `commentCount` for engagement normalization (64-4).
  - arXiv: `categories` (array of strings from `category`) when present.
  - GitHub/Reddit (future): `stars`, `forks`, `upvotes` when present.
- **Scoring fields (optional until 64-5 populates them):** `scores` (object with all five keys when present: `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency` — each 0–100), `disposition` (`priority` | `watch` | `ignore` | `escalate`), `normalizedEngagement` (0–100), `rankScore` (0–100). Morning digest v1 pushes **unscored** signals — omit these keys entirely until the scoring pipeline runs.
- Use Node `crypto.createHash('sha256')` for hashes (built-in only).
- Empty sections → omit signals (no placeholder rows).

#### Each signal object — required schema (Convex validators are strict)

The `addDigestSignal` validator is a **strict** object: a missing required key **or** an unexpected/`null` value rejects the whole signal, and the push then finalizes the run as `failed` with **zero** signals stored. Build every signal object exactly to this contract:

- **Required keys on every signal — never omit:** `section`, `sourceType`, `title`, `rank`. Missing `section` is the most common failure — include it on **every** signal, paired with `sourceType` per the table above.
- **`section`** ∈ `trends` | `headlines` | `arxiv` | `hackernews` | `deep_signal`. **`sourceType`** ∈ `google_trends` | `newsapi` | `arxiv` | `hackernews` | `deep_signal`.
- **Optional keys** (`summary`, `url`, `score`, `externalId`, `sourceMetadata`, `scores`, `disposition`, `normalizedEngagement`, `rankScore`): **OMIT the key entirely** when there is no value. **Never set them to `null`** — Convex rejects `null` for an optional string/number field (`null` is not the same as omitted).
- **Types:** `rank`, `score`, `normalizedEngagement`, and `rankScore` are **numbers** (not strings); `sourceMetadata.points`, `sourceMetadata.commentCount`, and legacy `sourceMetadata.comments` are **numbers**; `sourceMetadata.categories` is an **array of strings**; when `scores` is present it must include all five dimension keys as numbers (0–100 each).
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

Every entry in `signals[]` MUST carry both `section` and `sourceType` (see the strict-schema contract above). Optional keys with no value are **omitted**, never `null`.

`ranAt` must be the numeric `digest_start_ms` from task start (Unix ms) — never a string.

Omit `workspaceId`. Push available signals even when some sources failed.

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

Run **immediately after** the digest Convex push terminal call (`push-digest-convex.mjs`). Reuse the **same** `digest_push_payload` — do not rebuild or query Convex.

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
| `terminal` | Machine-local date; trend dry-run; NewsAPI; arXiv RSS; HackerNews RSS; `pick-signal-notebook.mjs`; `query-notebook.mjs`; `log-notebook-query.mjs` (post-post, success only); `push-digest-convex.mjs` (post-post, all runs); `push-keyword-candidates.mjs` (post-post, all runs) |
| `mcp__perplexity__search` | Deep signal only |
| Discord reply | Final formatted digest |

**Forbidden:** `vault_write`, `vault_append_daily`, `vault_create_note`, `mcp__notebooklm__notebook_query`, Firecrawl, dashboard APIs, session-close NotebookLM fan-out.

## Partial failure

Still post the full template with all section headers. Never invent headlines or trend keywords.

Never stop the run because an earlier source failed — only the failing section gets `- (source unavailable: …)`.
