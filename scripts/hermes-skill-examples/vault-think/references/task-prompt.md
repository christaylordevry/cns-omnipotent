# Task: `vault-think` on-demand cognition

- **v1.0:** Vault IO MCP — `vault_search` + `vault_read` only.
- **v1.1 live:** Obsidian Local REST API — **terminal `curl -k`** only (no new Node dependencies).
- **v1.1.1:** `/today`, `/today --brief` — Vault IO **`vault_list`** + **`vault_read`** only.
- **v1.2.0:** `/ghost`, `/drift` — Vault IO read-only (`vault_search` + `vault_read`; `/drift` also **`vault_list`** + **`vault_read_frontmatter`**).

## 0) Vault root, REST env, and clocks

1. Resolve directory **`CNS_VAULT_ROOT`** (required for v1.0 and **`/today`** commands):

   - If environment variable `CNS_VAULT_ROOT` is set and non-empty after trim, use it.
   - Else read `~/.hermes/config.yaml` as text, parse YAML mentally, and read `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`.
   - If still unset on a v1.0, **`/today`**, **`/ghost`**, or **`/drift`** command path: reply exactly `vault-think: no-vault-root` and **stop**.

2. Resolve **Obsidian Local REST** (required for `/trace` and `/connect` only):

   - **`OBSIDIAN_API_KEY`**: from environment, or `~/.hermes/config.yaml` → `env.OBSIDIAN_API_KEY`. If unset or empty: reply exactly `vault-think: obsidian-rest-no-api-key` and **stop**.
   - **`OBSIDIAN_LOCAL_REST_URL`**: from environment, or config `env.OBSIDIAN_LOCAL_REST_URL`, else default **`https://127.0.0.1:27124`** (trim trailing `/`).
   - **Never** print the API key in Discord or logs.

3. **REST `curl` helper** (use the **terminal** tool for every HTTP call):

   ```bash
   REST_BASE="${OBSIDIAN_LOCAL_REST_URL:-https://127.0.0.1:27124}"
   REST_BASE="${REST_BASE%/}"
   curl -sk -H "Authorization: Bearer ${OBSIDIAN_API_KEY}" "${REST_BASE}<path>"
   ```

   - If any request fails (connection error, timeout, or HTTP status not **2xx**): reply exactly `vault-think: obsidian-rest-unavailable` and **stop**.
   - URL-encode path segments in `/vault/{filename}` (spaces → `%20`, etc.).

4. Set **`today_utc`** = current UTC calendar date `YYYY-MM-DD` at the instant you start.

5. For `/emerge` only, set **`since_utc`** = `today_utc` minus **60** calendar days (UTC date roll; if a day is invalid, clamp within the month).

## 1) Line classification (after trim)

Let **`raw`** = operator message with leading and trailing ASCII whitespace removed.

### 1b) `/today` — route to §3

- `/today` or `/today` + trailing spaces only → full briefing.
- `/today --brief` (+ trailing spaces only) → 3-line brief.
- Other `/today…` → `vault-think: bad-trigger`; no vault I/O.

### 1c) `/ghost` — route to §3

- **`/ghost `** + non-empty remainder → **§3 `/ghost`** (`**question**` = remainder trimmed).
- **`/ghost`** only (no question) → `vault-think: ghost requires question`; stop.
- Other **`/ghost…`** → `vault-think: bad-trigger`; stop.

### 1d) `/drift` — route to §3

- **`/drift`** or **`/drift`** + trailing ASCII whitespace only → **§3 `/drift`**.
- **`/drift`** + other args → `vault-think: bad-trigger`; stop.

**§1b–1d:** need **`CNS_VAULT_ROOT`**; not **`OBSIDIAN_API_KEY`**.

### 1e) v1.1 live triggers — route to §3 (`/trace`, `/connect`)

If **`raw`** equals `/trace`, starts with `/trace `, equals `/connect`, or starts with `/connect `, continue to **§3** (do not treat as bad-trigger).

### 1f) v1.0 bad trigger

If **`raw`** does not match any v1.0 trigger in §2, reply exactly `vault-think: bad-trigger` and **stop** (no MCP calls).

## 2) v1.0 triggers (Vault IO MCP)

### `/challenge`

**Match:** `raw` starts with `/challenge` followed by at least one ASCII space, and the remainder (the **belief** text) is non-empty after trim.

**If** `/challenge` with no remainder or only spaces: reply `vault-think: challenge requires topic` and stop.

**Procedure:**

1. Let **`belief`** = substring of `raw` after the first ASCII space following `/challenge`, trimmed.
2. Derive **2–4** literal search strings from `belief` (meaningful words or short phrases; drop stopwords like "the", "and"). Each string length ≥ 3 unless `belief` itself is shorter (then use `belief` once).
3. For each search string, call **`vault_search`** with `max_results: 50`, rotating scopes so you use each of these at least once before repeating, in order: `01-Projects/`, `02-Areas/`, `03-Resources/`. **Cap:** ≤ **6** total `vault_search` calls for this command.
4. Build a deduped list of hit paths (POSIX vault-relative). Keep up to **18** paths prioritizing hits whose `matched_snippet` or titles in `frontmatter_summary` look semantically tied to `belief`.
5. Call **`vault_read`** on up to **14** distinct paths (prioritize highest-signal paths first). Parse YAML `title:` when present for display titles; else derive title from filename.
6. From read bodies, select **1–3** bullets whose content **supports** `belief` and **1–3** bullets whose content **contradicts** or **qualifies** `belief` (genuine tension, not strawmen). If the vault yields only one side, the other side bullets must still print using honest scarcity wording on that line, for example `• (no strong contradicting passage found in sampled notes) — widen search or restate belief` without adding a fake citation.
7. Discord reply: **only** this shape (replace bracketed fields; use `•` U+2022 bullets; blank line between major sections):

```text
⚡ Challenge: [stated belief]

Supporting evidence from your vault:
• [note title] — [one-line finding]

Contradicting evidence from your vault:
• [note title] — [one-line finding]

The tension: [Hermes synthesis of the conflict in 2-3 sentences]
```

**Rules:**

- `[stated belief]` repeats **`belief`** verbatim.
- Each bullet’s **note title** is the note’s `title` frontmatter when present, else basename of path.
- **One-line finding** must paraphrase text you actually saw in that note’s body (no external facts).
- Minimum **one** bullet line under each heading (use the scarcity rule for a side if needed).

### `/emerge`

**Match:** `raw` is exactly `/emerge` or `/emerge` with only trailing ASCII whitespace.

**Procedure:**

1. Call **`vault_search`** exactly **3** times (each `max_results: 50`):

   | Call | `scope` | `query` (literal) |
   |------|---------|-------------------|
   | E1 | `01-Projects/` | `modified:` |
   | E2 | `02-Areas/` | `modified:` |
   | E3 | `03-Resources/` | `modified:` |

2. Union hit paths; dedupe. For each path (cap **40** distinct paths, search-hit order), call **`vault_read`**. Extract frontmatter `title`, `modified` (`YYYY-MM-DD`), and `pake_type` when present (parse YAML manually from the read text).
3. Keep only notes where **`modified` date ≥ `since_utc`** when `modified` parses; if `modified` missing, **exclude** the path from the emerge set (do not guess mtime).
4. From the kept set, pick a cluster: a **concept title** (short noun phrase, Title Case, max 8 words) that appears as a **substring of at least two distinct** `title` fields **or** appears in the body of at least two kept notes (wording may vary slightly; pick the clearest cluster). Prefer concepts that **do not** already have a dedicated synthesis note: absence means **no** kept note has `pake_type: SynthesisNote` whose `title` contains the same substring as the cluster (case-insensitive).
5. Let **`N`** = count of kept notes in the cluster (must be ≥ **2**). Choose two exemplar paths with different titles for the bullets.
6. Discord reply: **only** this shape:

```text
💡 Emerging idea: [concept title]

Your vault mentions this across [N] notes but never synthesizes it:
• [note 1 title] — [reference]
• [note 2 title] — [reference]

Draft thesis: [one paragraph Hermes would write if asked to]
```

**Rules:**

- `[reference]` = vault-relative path (POSIX) of that note.
- If step 4–5 cannot reach **N ≥ 2** truthfully, reply `vault-think: emerge found no unsynthesized cluster in the last 60 days under the sampled hits; try /ideas or narrow with /challenge on a hypothesis` and **stop** (still counts as correct trigger handling).

### `/ideas`

**Match:** `raw` is exactly `/ideas` or `/ideas` with only trailing ASCII whitespace.

**Procedure:**

1. Call **`vault_search`** exactly **6** times, each `max_results: 50`, using this fixed matrix (literal queries):

   | Call | `scope` | `query` |
   |------|---------|---------|
   | I1 | `01-Projects/` | `TODO` |
   | I2 | `02-Areas/` | `risk` |
   | I3 | `03-Resources/` | `research` |
   | I4 | `01-Projects/` | `build` |
   | I5 | `03-Resources/` | `idea` |
   | I6 | `02-Areas/` | `stakeholder` |

2. Union paths; dedupe. Select up to **12** paths (diversity across scopes). `vault_read` each (cap **12** reads). Mine bodies + titles for: tooling or automation candidates, people or roles to contact, open research threads, and writing prompts.
3. Discord reply: **only** this shape (`[date]` = `today_utc`; each category: **1–4** bullets; if a category is thin, still emit at least one bullet with honest vault grounding or `• (none surfaced in this pass)` for the idea text after the em dash where appropriate):

```text
🧠 Vault Idea Report — [date]

🛠 Tools to build:
• [idea] — from [note reference]

🤝 People to reach out to:
• [person/type] — why: [reason from vault]

🔍 Topics to investigate:
• [topic] — emerging in [note references]

✍️ Things to write:
• [essay/post idea] — based on [vault pattern]
```

**Rules:**

- `[note reference]` and `[note references]` use vault-relative paths; separate multiple paths with comma + space.
- Every substantive bullet must trace to text you read in **`vault_read`** output for this run (no invented people or companies).

## 3) v1.1 live triggers (Obsidian Local REST via `curl -k`)

Use **§0** REST env. All HTTP in this section uses the **terminal** tool only.

### `/trace`

**Match:** `raw` starts with `/trace` followed by at least one ASCII space; let **`target`** = remainder trimmed (non-empty).

**If** `/trace` with no remainder or only spaces: reply `vault-think: trace requires note` and stop.

**Note resolution:**

1. If **`target`** contains `/` or ends with `.md`, treat as vault-relative path candidate.
2. Else treat **`target`** as title substring (case-insensitive).
3. **Direct read attempt:** `GET /vault/{url-encoded-path}` with `Accept: application/vnd.olrapi.note+json`.
   If **200**, use that note.
4. **Search fallback:** `POST "${REST_BASE}/search/simple/?query=$(urlencode target)&contextLength=80"`
   Parse JSON matches; keep paths under `01-Projects/`, `02-Areas/`, `03-Resources/` first.
5. **Ambiguous:** if **2–5** equally plausible paths remain, reply **only**:

```text
vault-think: trace ambiguous
• [title] — [path]
...
```

(max **5** candidates, `•` bullets).

6. **Not found:** reply exactly `vault-think: trace not-found` and stop.

**Link graph (after note resolved):**

1. **Read note:** `GET /vault/{path}` with `Accept: application/vnd.olrapi.note+json`. Extract `content`, `frontmatter.title` (or basename), and `path`.
2. **Forward links:** Parse body for `[[wikilink]]` targets; **exclude** embeds matching `![[...]]`. Dedupe targets. Cap display at **12** (prefer links whose resolved paths exist under governed folders).
3. **Backlinks:** Search for notes that link to the **resolved note**, not to the note's outgoing targets:
   - Build target aliases from the resolved note: frontmatter title, basename without `.md`, full vault-relative path, and path without `.md`.
   - For up to **4** aliases, run `POST /search/simple/?query=$(urlencode alias)&contextLength=120` (cap **4** backlink search calls).
   - Keep hits whose snippet or fetched body contains a wikilink to the resolved note alias, including `[[alias]]` or `[[alias|display]]`; exclude the resolved note itself.
   - Dedupe by path. Cap display at **12** backlinks; prefer governed folders when ranking.
4. **One-sentence graph synthesis** from actual link sets (no invented notes).

**Discord reply — only this shape on success:**

```text
🔗 Trace: [note title]
Path: [vault-relative path]

← Backlinks ([N]):
• [title] — [path]
...

→ Forward links ([M]):
• [title] — [path]
...

Graph: [one sentence synthesis of how this note sits in the vault]
```

Omit empty backlink/forward sections; use `(none in sampled graph)` on the section line if zero.

### `/connect`

**Match:** `raw` starts with `/connect` followed by at least one ASCII space.

Let **`rest`** = substring after `/connect ` trimmed. Split **`rest`** on the **first** ASCII space into **`concept_a`** and **`concept_b`** (both non-empty after trim). If fewer than two tokens: reply exactly `vault-think: connect requires two concepts` and stop.

**Procedure (≤ 6** `search/simple` **calls total):**

1. `POST /search/simple/?query=$(urlencode concept_a)&contextLength=100` → set **A** (paths).
2. `POST /search/simple/?query=$(urlencode concept_b)&contextLength=100` → set **B** (paths).
3. **Direct bridge:** if **A ∩ B** non-empty, pick best path (governed folders first); optionally `GET` one note for a one-line “why”.
4. **Two-hop bridge:** if intersection empty, for up to **2** notes in **A** (cap REST budget), search for notes linking both concepts:
   - `POST /search/simple/?query=$(urlencode concept_b)` and check snippets mentioning **concept_a** or wikilinks from **A** notes; or
   - `POST /search/` with JsonLogic when simple search is thin:

   ```bash
   curl -sk -X POST \
     -H "Authorization: Bearer ${OBSIDIAN_API_KEY}" \
     -H "Content-Type: application/vnd.olrapi.jsonlogic+json" \
     --data '{"and":[{"glob":["*'"${concept_a}"'*",{"var":"content"}]},{"glob":["*'"${concept_b}"'*",{"var":"content"}]}]}' \
     "${REST_BASE}/search/"
   ```

   (Counts toward the **6** search call cap.)

5. **Success:** Discord reply **only**:

```text
🌉 Connect: [concept A] ↔ [concept B]

Bridge:
• [path 1] — [why it links A]
• [path 2] — [why it links B]
...

Summary: [1-2 sentences]
```

6. **No bridge** within caps: reply exactly `vault-think: connect no direct connection found`.

### `/ghost`

§1c. MCP **`vault_search`** + **`vault_read`** only; caps ≤**6** search, ≤**8** read. Cap hit → `vault-think: incomplete`.

1. **2–4** search strings from **`question`** (≥3 chars; drop stopwords).
2. **`vault_search`** `max_results: 50`; rotate `01-Projects/`, `02-Areas/`, `03-Resources/`, optional `DailyNotes/` (≤**6** calls).
3. Dedupe POSIX paths; rank operator-voice relevance; **`vault_read`** ≤**8** paths.
4. Synthesize first-person answer from read bodies only (no external facts).
5. No operator-voice content → exactly `ghost: no vault writing found on this topic.`
6. Else Discord **only**:

```text
👻 Ghost — <question>

<synthesized answer in operator voice>

Sources: <comma-separated note titles>
```

(`title` FM or basename)

### `/drift`

§1d. MCP **`vault_list`**, **`vault_read`**, **`vault_search`**, **`vault_read_frontmatter`**; caps ≤**1** list, ≤**14** daily reads, ≤**8** search, ≤**8** frontmatter reads. Cap hit → `vault-think: incomplete`.

1. **`window_start_utc`** = **`today_utc`** − **14** UTC days (same as **`/emerge`**).
2. **`vault_list`** `DailyNotes/`; pick `YYYY-MM-DD.md` in window, newest first (≤**14**).
3. **`vault_read`** each; extract terms (headings, bold, Title Case). **≥3** mentions across corpus.
4. Per recurring term (≤**8**): **`vault_search`** `03-Resources/`; inspect each candidate hit's frontmatter context, or call **`vault_read_frontmatter`** when `pake_type` is absent/ambiguous. A term is resolved only when a matching note has **`pake_type: SynthesisNote`** and its title or search context matches the term (case-insensitive). Title matches on `SourceNote`, `InsightNote`, or any non-`SynthesisNote` do **not** count as resolved.
5. Discord **only** — empty:

```text
🌀 Drift

No recurring concepts circling without synthesis in the last 14 days.
```

With unresolved (sort by **`n`** desc; ≤**8** bullets):

```text
🌀 Drift

Circling without landing:
• <concept> (<n> mentions, no synthesis)

Consider /graduate or run-chain on these.
```

### `/today`

§1b match. MCP: **`vault_list`**, **`vault_read`** only. Caps: ≤3 list, ≤6 read (1 daily + ≤5 projects). Cap hit → `vault-think: incomplete`.

1. **`vault_list`** `DailyNotes/`; match **`{today_utc}.md`**.
2. Found → **`vault_read`**: tasks `- [ ]`/`- [x]`, **Priorities**/**Focus**/**Today** lines, else 200 chars post-FM; empty → `(empty daily note)`. Missing → `not yet created` (no read).
3. **`vault_list`** `01-Projects/`; skip `_README.md`; sort **`modified`** desc; top **5** → **`vault_read`** each; **`status`** FM or first body line (≤200 chars).
4. **`vault_list`** `00-Inbox/`; count files (**No** `vault_read` on inbox).
5. Reply template. Optional one grounded theme line (full only).

**Full:**

```text
📅 Today — <YYYY-MM-DD>

**Daily note:** <summary or "not yet created">
**Active projects (<n>):**
- <Project title> — <status or first line>
...

**Inbox:** <n> items waiting

<theme if grounded>
```

**Brief (`--brief`) — exactly 3 lines (no project section, no theme line):**

```text
📅 Today — <YYYY-MM-DD>
**Daily note:** <summary or "not yet created">
**Inbox:** <n> items waiting
```

`<YYYY-MM-DD>`=`today_utc`; title=FM `title` else basename sans `.md`; project `<n>`=bullets shown (≤5).

## 4) Forbidden tools reminder

**`/today`:** **`vault_list`** + **`vault_read`** per §3. **`/drift`:** **`vault_list`**, **`vault_read`**, **`vault_search`** in **`03-Resources/`**, and **`vault_read_frontmatter`** only to verify candidate synthesis note PAKE type. **`/ghost`:** **`vault_search`** + **`vault_read`** only.

**All other commands:** do **not** call **`vault_list`**, `vault_read_frontmatter`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`, `vault_log_action`, `vault_request_disambiguation`, Obsidian CLI, or filesystem writes to vault paths.

## 5) Incomplete work

If caps block completion, reply `vault-think: incomplete` once, optionally with one sentence naming the blocking cap. Do not fabricate unread citations.
