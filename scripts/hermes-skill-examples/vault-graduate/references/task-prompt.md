# Task: `vault-graduate` daily-note promotion

Promote **`#graduate`** lines from **`DailyNotes/`** to **`03-Resources/`** InsightNotes. Receipt on **today's** daily only (Option B).

## 0) Vault root, clocks, trigger

1. Resolve **`CNS_VAULT_ROOT`**: env, else `~/.hermes/config.yaml` → `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`. If unset: `vault-graduate: no-vault-root` and **stop**.
2. **`today_utc`** = UTC `YYYY-MM-DD` at run start.
3. **`raw`** = trimmed operator message.

| Match | `scan_days` |
|-------|-------------|
| exactly `/vault-graduate` (optional trailing spaces) | **7** |
| `/vault-graduate --days <n>` (`<n>` positive integer, no extra tokens) | **`<n>`** |
| else | `vault-graduate: bad-trigger` and **stop** |

## 1) List and filter dailies (AC2a–b)

1. **`vault_list`** **`DailyNotes/`** (`recursive: true` if needed).
2. Keep `*.md` basenames matching `^\d{4}-\d{2}-\d{2}\.md$`; **`file_date`** = first 10 chars.
3. **`cutoff_utc`** = `today_utc` − **`scan_days`** (UTC calendar days).
4. Include iff **`cutoff_utc <= file_date <= today_utc`**.

## 2) Extract `#graduate` lines (AC2c–d)

Per included daily: **`vault_read`** → each line with **`#graduate`** (case-insensitive):

- One InsightNote per line.
- **`candidate_title`**: line minus `#graduate` tokens, whitespace collapsed, trimmed.
- **`source_filename`** = daily basename (e.g. `2026-05-14.md`).
- **`title_slug`**: `candidate_title` lowercased; spaces → hyphens; strip characters unsafe in URI fragments; collapse repeated hyphens.
- **`source_uri`** = `vault://DailyNotes/<source_filename>#<url-encoded-title-slug>` (encode the slug for the fragment; e.g. title `My great idea` → `vault://DailyNotes/2026-05-14.md#my-great-idea`). **Per-idea URI** — multiple `#graduate` lines in one daily must each get a distinct `source_uri` so `vault_create_note` dedup does not block after the first create.
- Keep full source line for body quote.

If none: reply only `No #graduate tags found in the last <scan_days> days.` and **stop**.

## 3) Dedup (AC3)

Before each create for **`candidate_title`**:

1. **`vault_search`**, `scope: "03-Resources/"`, query = title.
2. Up to **5** hits: **`vault_read_frontmatter`**; if any **`title`** matches case-insensitive trim → skip; record `already graduated: <title> → <path>`.

No URI dedup.

## 4) Create InsightNotes (AC2e)

**`vault_create_note`** per non-deduped hit (body-only `content`; tool sets draft/ai/timestamps):

| Arg | Value |
|-----|--------|
| `pake_type` | `InsightNote` |
| `title` | `candidate_title` |
| `source_uri` | `vault://DailyNotes/<source_filename>#<url-encoded-title-slug>` |
| `tags` | `graduate`, `daily-note`, `daily-<file_date>` |
| `confidence_score` | `0.5` |
| `content` | `> Source: <title or filename>, <file_date>` blank line full source line |

Conflict → `graduate: duplicate-title`; no overwrite. Collect **`promoted[]`**: title, dest_path, source_filename.

## 5) Receipt — Option B (AC2f)

If **`promoted[]`** non-empty:

```markdown
## Graduated <today_utc>
- <title> → 03-Resources/<dest> (from DailyNotes/<source_filename>)
```

One **`vault_append_daily`** with that block (default **`DailyNotes/<today_utc>.md`** only). Never append historical dailies; no FS writes under **`DailyNotes/`**.

## 6) Discord report (AC2g)

Reply **only** template body (no preamble).

**Success:**

```text
🎓 Graduate report (last <scan_days> days)

Promoted:
• <title> → 03-Resources/<file> (from DailyNotes/<daily>)

Skipped (already graduated):
• <title> → <existing path>

Receipt appended (today's daily):
• DailyNotes/<today_utc>.md — ## Graduated <today_utc> (<N> items with source filenames)
```

Omit empty sections.

## 7) Forbidden tools (graduate)

Do **not** call:

- `vault_update_frontmatter`
- `vault_move`
- `vault_log_action`
- `vault_request_disambiguation`

Allowed mutators for this skill: **`vault_create_note`**, **`vault_append_daily`**. Also allowed reads: **`vault_list`**, **`vault_read`**, **`vault_read_frontmatter`**, **`vault_search`**.

## 8) Error classes

| Class | When |
|-------|------|
| `vault-graduate: bad-trigger` | Trigger mismatch |
| `vault-graduate: no-vault-root` | No `CNS_VAULT_ROOT` |
| `graduate: duplicate-title` | Create conflict |
