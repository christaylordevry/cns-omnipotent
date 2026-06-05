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
7. **Cross-source failures**: run Sources 1–5 independently. A failed source must not abort the digest — always post the full contract with `(source unavailable: …)` in the affected section(s).
8. **Digest wall clock**: record `digest_start_ms = Date.now()` at the start of task execution (before Source 1). Use it for Source 5 `NOTEBOOK_REMAINING_S` (see Source 5).

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

Request (one call per digest):

- Endpoint: `https://newsapi.org/v2/everything`
- Query: `q=("artificial intelligence" OR "AI agents" OR automation) AND NOT sports`
- Params: `sortBy=publishedAt`, `pageSize=5`, `language=en`

Emit up to **5** headline titles (title field only) under **Headlines**.

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

Parse stdout JSON:

- `papers[]` with `category`, `title`, `link`, `snippet`, `pubDate`.
- Emit up to **N** papers per configured category (newest first in RSS order).

For Discord **arXiv Preprints**, list each paper as `- <title> — <snippet>` (single line). Parenthetical after the heading: configured category codes (e.g. `cs.AI, cs.LG`) or `(configured categories)` when unknown.

On failure (`error` key, empty `papers`, or invalid stdout): section header **arXiv Preprints** + `- (source unavailable: <short reason>)` and **continue** to Source 5.

## Source 5 — Vault context (NotebookLM)

Run **after** Source 4 completes. Do **not** use `mcp__notebooklm__notebook_query` — CLI only.

### Build `digest_sources` (for scoring)

After Sources 1–4 complete, assemble a JSON object from parsed tool outputs (skip a source that failed with `source unavailable` — use an empty array or omit that field):

```json
{
  "trends": [{ "keyword": "<string>", "normalizedValue": <number> }],
  "headlines": [{ "title": "<string>" }],
  "perplexityText": "<Deep Signal body text only — not the Perplexity query string>",
  "arxiv": [{ "title": "<string>", "snippet": "<string>" }]
}
```

- **trends:** up to **5** keywords from Source 1 (`events[]`), sorted by `normalizedValue` descending (same sort/top-5 as Trending Now).
- **headlines:** up to **5** headline **titles** from Source 2.
- **perplexityText:** the **2–3 sentence Deep Signal** answer from Source 3 when Perplexity succeeded; omit or `""` when Deep Signal is unavailable.
- **arxiv:** paper **titles** and **snippets** from Source 4 when available; omit or `[]` when arXiv is unavailable.

`pick-signal-notebook.mjs` runs `buildDigestSignals(digest_sources)` internally: trends → headlines → Perplexity-derived phrases (up to 3) → arXiv titles (up to 3), case-insensitive dedupe (first wins), cap **10** signals total. Do **not** hand-build a `SIGNALS_JSON` array from memory.

Before building the Source 5 pick-signal / query terminal commands, shell-quote every dynamic environment value with this exact POSIX single-quote transform:

```text
shellQuote(value) = "'" + String(value).replaceAll("'", "'\\''") + "'"
```

Use `shellQuote(...)` for `DIGEST_SOURCES_JSON`, `NOTEBOOK_ID`, `NOTEBOOK_QUERY`, `NOTEBOOK_REMAINING_S`, and `QUERY_SCRIPT` (Source 5), and for `LOG_SCRIPT`, `NOTEBOOK_ANSWER`, `NOTEBOOK_TITLE`, and `NOTEBOOK_DOMAIN` (post-post log). Do not pass raw headline text, matched signals, or NotebookLM queries unquoted.

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

Run **only** when Source 5 finished with `route.status === 'ROUTED'` and `query-notebook.mjs` returned valid stdout JSON `{ answer, elapsed_ms }` where **`answer` is non-empty after trim** (Vault context section is **not** `(source unavailable: …)`).

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
- `NOTEBOOK_ANSWER` = `answer_full` from Source 5 (**full** `query-notebook.mjs` stdout `answer`, saved before Discord 500-char truncation).
- `NOTEBOOK_DOMAIN` = `route.domain` when present; otherwise `'general'`.
- Use the same `shellQuote(value)` transform as Source 5 for all dynamic env values.

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

## Allowed tools

| Tool | Use |
|------|-----|
| `terminal` | Machine-local date; trend dry-run; NewsAPI; arXiv RSS; `pick-signal-notebook.mjs`; `query-notebook.mjs`; `log-notebook-query.mjs` (post-post, success only) |
| `mcp__perplexity__search` | Deep signal only |
| Discord reply | Final formatted digest |

**Forbidden:** `vault_write`, `vault_append_daily`, `vault_create_note`, `mcp__notebooklm__notebook_query`, Firecrawl, dashboard APIs, session-close NotebookLM fan-out.

## Partial failure

Still post the full template with all section headers. Never invent headlines or trend keywords.

Never stop the run because an earlier source failed — only the failing section gets `- (source unavailable: …)`.
