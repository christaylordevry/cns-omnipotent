---
# HARD RULES - read before anything else:
1. This skill is fully script-driven. The model only runs bash commands and formats their stdout.
2. Run `resolve-notebook.mjs` first. If it returns `NO_ROUTE`, post the no-match reply and stop.
3. After a `ROUTED` result, run `query-notebook.mjs` with the routed notebook ID, original question, and remaining time budget.
4. If NO_ROUTE: post exactly:
   "📚 notebook-query: no confident match for your question.
   Reason: <route.reason>
   Try rephrasing or use /vault-lint to check notebook coverage."
   Then stop. Do not search the vault. Do not offer alternatives.
5. Never offer to "search the vault manually" or "provide information from
   memory" as a fallback. The only valid fallback is the error message above.
---

# Task prompt: `notebook-query` (Story 51-1)

Complete implementation instructions for the Hermes agent when a `/notebook-query` message is received in `#hermes`.

---

## 0) REFERENCE ONLY — invocation already confirmed
> **You have already been invoked.** The config.yaml trigger matched the
> incoming Discord message. Do not re-check or re-evaluate the trigger prefix.
> The question has already been extracted for you. Proceed directly to §1.

For documentation purposes only (do not re-evaluate at runtime):
1. Original message started with `/notebook-query ` (case-sensitive, space-terminated).
2. Question = everything after the `/notebook-query ` prefix, trimmed.
3. If question is empty or whitespace-only: reply `notebook-query: bad-trigger (question required)` and **stop**.
4. Truncate question to 500 chars silently if longer.
5. Record `start_time` = wall clock timestamp (milliseconds since epoch).

---

## 1) Run resolver

Via `execute_code bash` - pass the question in **`NOTEBOOK_QUERY`**:

```bash
SKILL_DIR="$HOME/.hermes/skills/cns/notebook-query"
NOTEBOOK_QUERY='<question>' node "$SKILL_DIR/scripts/resolve-notebook.mjs"
```

- Set `NOTEBOOK_QUERY` to the extracted question string using a **single-quoted** value. If the question contains a single quote (`'`), escape each `'` as `'\''` inside the quoted string.
- Parse the single JSON line from stdout. Extract `route` and `elapsed_ms`.

**Error handling (check exit code before parsing stdout):**

| Exit code | Action |
|-----------|--------|
| `2` | Post `📚 notebook-query: error — could not load notebook registry` and **stop** |
| `1` | Post `📚 notebook-query: error — could not resolve notebook routing` and **stop** |
| `0` | Parse stdout JSON; if empty or invalid JSON, post `📚 notebook-query: error — could not resolve notebook routing` and **stop** |

---

## 2) Route decision

After parsing `{ route, elapsed_ms }`:

**Case A - `route.status === 'NO_ROUTE'`:**

Post to `#hermes`:
```
📚 notebook-query: no confident match for your question.
Reason: <route.reason>
Try rephrasing or use /vault-lint to check notebook coverage.
```

`<route.reason>` is diagnostic from the resolver, e.g. `no_watched_notebooks`, `empty_question`, or `below_threshold: best=AI Factory Blueprint (0.00)`.

Then **stop**.

**Case B - `route.status === 'ROUTED'`:**

- If `route.id` is missing or `route.title` is missing/blank after trim: post `📚 notebook-query: error — could not resolve notebook routing` and **stop**.
- Otherwise continue to step 3.

---

## 3) Query notebook

Compute remaining time budget from **command receipt** (`start_time` from step 0), not resolver `elapsed_ms` alone:

```
remaining_s = Math.min(90, Math.max(10, 90 - (Date.now() - start_time) / 1000))
```

Run:

```bash
node "$HOME/.hermes/skills/cns/notebook-query/scripts/query-notebook.mjs" \
  "$NOTEBOOK_ID" "$QUESTION"
```

Or with env vars:

```bash
NOTEBOOK_ID="<route.id>" NOTEBOOK_QUERY="<question>" \
NOTEBOOK_REMAINING_S="<remaining_s>" \
node "$HOME/.hermes/skills/cns/notebook-query/scripts/query-notebook.mjs"
```

Use:
- `NOTEBOOK_ID`: `route.id`
- `QUESTION` or `NOTEBOOK_QUERY`: original question (verbatim, full length)
- `NOTEBOOK_REMAINING_S`: `remaining_s`

Parse stdout JSON: `{ answer, elapsed_ms }`

**Error handling:**

- Exit `0`: if stdout parses and `answer` is non-empty, use `answer` for the formatted response.
- Exit `0` but stdout is empty, invalid JSON, or lacks a non-empty `answer`: post `📚 notebook-query: error — could not query notebook` and **stop**.
- Exit non-zero with stderr indicating timeout / time exceeded: post `📚 notebook-query: timeout — answer not received within 90s. Try again.` and **stop**.
- Any other non-zero exit: post `📚 notebook-query: error — <concise description of the error>` and **stop**.

---

## 4) Post answer

When `query-notebook.mjs` returns successfully:

Format the response exactly as:

```
📚 **notebook-query:** <question_display>
**Notebook:** <notebook_title_display>
**Answer:** <answer text from query-notebook.mjs>
```

Where:
- `<question_display>` = original question, truncated to 80 chars with `…` suffix if longer than 80 chars
- `<notebook_title_display>` = `route.title` with any newline characters replaced by spaces, then trimmed (single line)
- `<answer text>` = `answer` from `query-notebook.mjs` (verbatim, no truncation)

**Example output:**

```
📚 **notebook-query:** What are the PAKE validation rules?
**Notebook:** CNS Vault Architecture
**Answer:** PAKE validation rules require that all notes outside 00-Inbox include valid frontmatter with pake_id, pake_type, title, created, modified, status, confidence_score, verification_status, and creation_method...
```

---

## 5) Log to Convex

After posting the formatted answer to `#hermes` on the **success path only**, log the query for the `/trends` dashboard history panel. Run **after** step 4 completes. **Await** the `terminal` call and emit telemetry before ending the skill turn — do not background or skip this step. Do **not** edit or retract the Discord answer from step 4 regardless of log outcome.

Resolve paths and quoting (same rules as morning-digest Source 4):

```text
resolved_repo_root = OMNIPOTENT_REPO when set to a non-empty absolute path, else /home/christ/ai-factory/projects/Omnipotent.md
shellQuote(value) = "'" + String(value).replaceAll("'", "'\\''") + "'"
log_script = resolved_repo_root + "/scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs"
```

If the repo `log_script` path is unavailable, use: `$HOME/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs`

Invoke the Hermes **`terminal`** tool once (not `execute_code bash`):

```text
terminal(
  command="LOG_SCRIPT=<shellQuote(log_script)> NOTEBOOK_QUERY=<shellQuote(question)> NOTEBOOK_ANSWER=<shellQuote(answer)> NOTEBOOK_ID=<shellQuote(route.id)> NOTEBOOK_TITLE=<shellQuote(route.title)> NOTEBOOK_DOMAIN=<shellQuote(route.domain or 'general')> node \"$LOG_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=15
)
```

Where:
- `question` = original extracted question (verbatim)
- `answer` = `answer` from `query-notebook.mjs` stdout (verbatim)
- `NOTEBOOK_DOMAIN` = `route.domain` when present; otherwise `'general'`

**Only invoke on success path** — do not run for `NO_ROUTE`, timeout, or any error path.

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

Do **not** post the warning for `ok` or `skipped-env`. Do **not** treat log failure as skill failure.

---

## Summary of all reply strings

| Situation | Reply |
|-----------|-------|
| Empty question | `notebook-query: bad-trigger (question required)` |
| Resolver exit `2` (registry read/parse/malformed) | `📚 notebook-query: error — could not load notebook registry` |
| Resolver exit `1`, bad stdout JSON, or invalid ROUTED payload | `📚 notebook-query: error — could not resolve notebook routing` |
| `route.status === 'NO_ROUTE'` (including empty watch registry) | `📚 notebook-query: no confident match for your question.\nReason: <route.reason>\nTry rephrasing or use /vault-lint to check notebook coverage.` (e.g. `Reason: below_threshold: best=AI Factory Blueprint (0.00)`) |
| Query script timeout | `📚 notebook-query: timeout — answer not received within 90s. Try again.` |
| Query script error | `📚 notebook-query: error — <concise error description>` |
| Success | Formatted answer block (see step 4) |
