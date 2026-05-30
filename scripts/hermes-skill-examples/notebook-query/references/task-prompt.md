---
⚠️ HARD RULES — read before anything else:
1. After the resolver outputs ROUTED, your ONLY next action is to call
   mcp__notebooklm__notebook_query. Do NOT look for scripts. Do NOT search
   the vault. Do NOT improvise an alternative. Call the MCP tool directly.
2. There is no query-notebook.js. There is no helper script for step 3.
   The MCP tool IS the query mechanism.
3. If mcp__notebooklm__notebook_query is unavailable, post:
   "📚 notebook-query: error — notebooklm MCP not available" and stop.
---

# Task prompt: `notebook-query` (Story 51-1)

Complete implementation instructions for the Hermes agent when a `/notebook-query` message is received in `#hermes`.

---

## 0) Trigger and abort gates

1. Message must start with `/notebook-query ` (case-sensitive, space-terminated).
2. Extract question: everything after the `/notebook-query ` prefix, trimmed.
3. If question is empty or whitespace-only: reply `notebook-query: bad-trigger (question required)` and **stop**.
4. Truncate question to 500 chars silently if longer.
5. Record `start_time` = wall clock timestamp (milliseconds since epoch).

---

## 1) Run resolver

Via `execute_code bash` — pass the question in **`NOTEBOOK_QUERY`** (never as a shell argument):

```bash
SKILL_DIR="$HOME/.hermes/skills/cns/notebook-query"
NOTEBOOK_QUERY='<question>' node "$SKILL_DIR/scripts/resolve-notebook.mjs"
```

- Set `NOTEBOOK_QUERY` to the extracted question string using a **single-quoted** value. If the question contains a single quote (`'`), escape each `'` as `'\''` inside the quoted string.
- Do **not** pass the question as `argv` to `node`; env-only avoids shell metacharacter injection from Discord input.
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

**Case A — `route.status === 'NO_ROUTE'`:**

Post to `#hermes`:
```
📚 notebook-query: no confident match
No watched notebook scored ≥ 0.75 for that question. Try more specific keywords, or check `watch: true` flags in the notebook registry.
```

Then **stop**. Do not call `mcp__notebooklm__notebook_query`.

**Case B — `route.status === 'ROUTED'`:**

- If `route.id` is missing or `route.title` is missing/blank after trim: post `📚 notebook-query: error — could not resolve notebook routing` and **stop**.
- Otherwise continue to step 3.

---

## 3) Query notebook

**CALL mcp__notebooklm__notebook_query NOW. Do not use any other tool or script. Do not search the vault. The only valid action here is the MCP call.**

Compute remaining time budget from **command receipt** (`start_time` from step 0), not resolver `elapsed_ms` alone:

```
remaining_s = Math.min(30, Math.max(5, 30 - (Date.now() - start_time) / 1000))
```

Call `mcp__notebooklm__notebook_query` with:
- `notebook_id`: `route.id`
- `query`: original question (verbatim, full length — do NOT truncate for the MCP call)
- `timeout`: `remaining_s`

**Error handling:**

- Timeout (tool error indicating timeout / time exceeded): post `📚 notebook-query: timeout — answer not received within 30s. Try again.` and **stop**.
- Any other MCP error or exception: post `📚 notebook-query: error — <concise description of the error>` and **stop**.

---

## 4) Post answer

When `notebook_query` returns successfully:

Format the response exactly as:

```
📚 **notebook-query:** <question_display>
**Notebook:** <notebook_title_display>
**Answer:** <answer text from notebook_query>
```

Where:
- `<question_display>` = original question, truncated to 80 chars with `…` suffix if longer than 80 chars
- `<notebook_title_display>` = `route.title` with any newline characters replaced by spaces, then trimmed (single line)
- `<answer text>` = the answer string returned by `notebook_query` (verbatim, no truncation)

**Example output:**

```
📚 **notebook-query:** What are the PAKE validation rules?
**Notebook:** CNS Vault Architecture
**Answer:** PAKE validation rules require that all notes outside 00-Inbox include valid frontmatter with pake_id, pake_type, title, created, modified, status, confidence_score, verification_status, and creation_method...
```

---

## Summary of all reply strings

| Situation | Reply |
|-----------|-------|
| Empty question | `notebook-query: bad-trigger (question required)` |
| Resolver exit `2` (registry read/parse/malformed) | `📚 notebook-query: error — could not load notebook registry` |
| Resolver exit `1`, bad stdout JSON, or invalid ROUTED payload | `📚 notebook-query: error — could not resolve notebook routing` |
| `route.status === 'NO_ROUTE'` (including empty watch registry) | `📚 notebook-query: no confident match\nNo watched notebook scored ≥ 0.75 for that question. Try more specific keywords, or check \`watch: true\` flags in the notebook registry.` |
| `notebook_query` timeout | `📚 notebook-query: timeout — answer not received within 30s. Try again.` |
| `notebook_query` MCP error | `📚 notebook-query: error — <concise error description>` |
| Success | Formatted answer block (see step 4) |
