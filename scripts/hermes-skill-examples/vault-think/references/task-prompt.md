# Task: `vault-think` on-demand cognition (read-only: `vault_search` + `vault_read` only)

## 0) Vault root and clocks

1. Resolve directory `CNS_VAULT_ROOT`:

   - If environment variable `CNS_VAULT_ROOT` is set and non-empty after trim, use it.
   - Else read `~/.hermes/config.yaml` as text, parse YAML mentally, and read `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`.
   - If still unset: reply exactly `vault-think: no-vault-root` and **stop**.

2. Set **`today_utc`** = current UTC calendar date `YYYY-MM-DD` at the instant you start (use for report headers and date math).

3. For `/emerge` only, set **`since_utc`** = `today_utc` minus **60** calendar days (UTC date roll; if a day is invalid, clamp within the month).

## 1) Line classification (after trim)

Let **`raw`** = operator message with leading and trailing ASCII whitespace removed.

### 1a) v1.1 stub triggers (handle before v1.0)

If **`raw`** equals `/trace`, starts with `/trace `, equals `/connect`, starts with `/connect `, equals `/ghost`, starts with `/ghost `, or equals `/drift` (optional trailing spaces only for the zero-argument forms), reply **exactly**:

```text
vault-think: v1.1-not-active — /trace, /connect, /ghost, and /drift are documented stubs only. /connect will require Obsidian Local REST API for link-graph bridging when implemented. Use /challenge, /emerge, or /ideas in v1.0.
```

Then **stop** (no MCP calls).

### 1b) v1.0 bad trigger

If **`raw`** does not match any v1.0 trigger in §2, reply exactly `vault-think: bad-trigger` and **stop** (no MCP calls).

## 2) v1.0 triggers

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

## 3) Forbidden tools reminder

Do **not** call: `vault_list`, `vault_read_frontmatter`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`, `vault_log_action`, `vault_request_disambiguation`, Obsidian CLI, or filesystem writes to vault paths.

## 4) Incomplete work

If caps block completion, reply `vault-think: incomplete` once, optionally with one sentence naming the blocking cap. Do not fabricate unread citations.
