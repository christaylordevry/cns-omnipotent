---
story_id: 32-1
epic: 32
title: vault-graduate-skill-daily-note-idea-promotion
status: review
---

# Story 32.1: vault-graduate-skill-daily-note-idea-promotion

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide for Epic 32 graduate skill. -->

## Story

As the **operator**,  
I want to run **`/graduate`** in Discord and have ideas tagged **`#graduate`** in my daily notes automatically promoted to governed **InsightNotes** in **`03-Resources/`**,  
so that **half-formed ideas do not stay buried in daily logs**.

## Context

| Topic | Detail |
|-------|--------|
| **Why a separate skill** | **`vault-think`** is **read-only** (`vault_search`, `vault_read` only — no mutators). Graduate requires **`vault_create_note`** and **`vault_append_daily`**, so it needs its **own** Hermes skill. |
| **Trigger** | **`/graduate`** in Discord **`#hermes`** (channel skill binding required — see Dev Notes). |
| **Scan scope** | **`DailyNotes/`** under **`CNS_VAULT_ROOT`**; default last **7** calendar days (`/graduate --days <n>` override). |
| **Promotion target** | **`03-Resources/`** via **`vault_create_note`** with full PAKE frontmatter (tool-generated). |
| **Receipt** | Append **`## Graduated <ISO date>`** to **today's** daily via **`vault_append_daily`** (default today-only path); each bullet cites source daily **`(from DailyNotes/YYYY-MM-DD.md)`**. **Option B** — do not write historical dailies. |
| **Tag retention** | **`#graduate`** is **not** removed from the source line (no body-edit mutator exists). The appended **Graduated** section is the graduation receipt. |
| **Dedup** | Before create, **`vault_search`** in **`03-Resources/`** for matching InsightNote **title**; skip with **already graduated** in Discord report. |

**Environment**

| Variable / path | Value |
|-----------------|--------|
| Vault root | **`CNS_VAULT_ROOT`** (env → `~/.hermes/config.yaml` `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`) |
| Daily notes | **`DailyNotes/`** — filenames **`YYYY-MM-DD.md`** |
| InsightNote destination | **`03-Resources/`** (via `pake_type: InsightNote`) |
| Skill install (operator) | **`~/.hermes/skills/cns/vault-graduate/`** |
| Repo mirror | **`scripts/hermes-skill-examples/vault-graduate/`** |

## Acceptance Criteria

1. **Skill package:** New Hermes skill at **`scripts/hermes-skill-examples/vault-graduate/SKILL.md`** with **`name: vault-graduate`**, **`version: 1.0.0`**. **Trigger:** **`/graduate`** in **`#hermes`**. **When to use:** operator posts **`/graduate`** (exact, no args) or **`/graduate --days <n>`** to scan last **n** days (default **7**).
2. **`references/task-prompt.md`** defines the full procedure:
   - **a.** **`vault_list`** on **`DailyNotes/`** (non-recursive or recursive per list contract — include all `*.md` daily files).
   - **b.** Filter to last **7** days (or **`--days n`**) by **filename date** (`YYYY-MM-DD.md`).
   - **c.** **`vault_read`** each daily note in range.
   - **d.** Find lines containing **`#graduate`** (case-insensitive).
   - **e.** For each hit: **`vault_create_note`** an InsightNote in **`03-Resources/`** with:
     - **`pake_type`:** `InsightNote`
     - **`title`:** idea text with **`#graduate`** stripped (trimmed)
     - **`source_uri`:** `vault://DailyNotes/<filename>` (e.g. `vault://DailyNotes/2026-05-17.md`)
     - **`creation_method`:** `ai` (set by Vault IO create path — do not duplicate in body)
     - **`status`:** `draft` (set by Vault IO create path)
     - **`content` (body):** blockquote source line plus context:
       ```markdown
       > Source: <daily note title>, <date>

       <idea line context — include the full source line; #graduate may remain in the quoted context>
       ```
     - **`tags`:** include at least `graduate`, `daily-note` (add slug from daily date if useful).
   - **f.** **`vault_append_daily`** on **TODAY's** daily note (no path arg — default **`vault_append_daily`** behaviour), appending a **`## Graduated <ISO date>`** section listing all promoted InsightNotes with their source daily note filenames in parentheses. Do not attempt to write to historical daily notes. **Resolution: Option B.** Example:
     ```markdown
     ## Graduated 2026-05-17
     - <Idea Title> → 03-Resources/<filename> (from DailyNotes/2026-05-14.md)
     - <Idea Title 2> → 03-Resources/<filename> (from DailyNotes/2026-05-16.md)
     ```
   - **g.** **Discord report:** list promoted notes, skipped dedup hits, and per-source receipts; or **`No #graduate tags found in the last <n> days.`**
3. **Dedup guard:** Before **`vault_create_note`**, call **`vault_search`** scoped to **`03-Resources/`** using the stripped idea **title** (or a short literal derived from it). If an existing InsightNote’s **`title`** frontmatter (verify via **`vault_read_frontmatter`** on top hits) **matches** the candidate title (case-insensitive trim), **skip** create and record **`already graduated: <title>`** in the Discord report.
4. **Token budget (§6.5):** **`SKILL.md`** must not exceed **800** tokens. **`task-prompt.md`** must not exceed **1,200** tokens. Measure with **`wc -c ÷ 4`** on each file; record bytes and estimated tokens in **Verification** (dev-story).
5. **Install script:** **`scripts/install-hermes-skill-vault-graduate.sh`** copies the skill tree to **`~/.hermes/skills/cns/vault-graduate/`** (mirror **`install-hermes-skill-vault-think.sh`**).
6. **Regression test:** **`tests/hermes-vault-graduate-skill.test.mjs`** covering:
   - **`/graduate`** trigger recognition (exact and **`--days`** form)
   - **`#graduate`** line detection (case-insensitive)
   - InsightNote **`vault_create_note`** field contract in task-prompt
   - **`vault_append_daily`** graduation receipt section shape
   - dedup skip behaviour documented in task-prompt
7. **`npm test`** passes. **`bash scripts/verify.sh`** passes.

## Tasks / Subtasks

- [x] Create **`scripts/hermes-skill-examples/vault-graduate/`** with **`SKILL.md`** and **`references/task-prompt.md`**.
- [x] Write **`SKILL.md`:** YAML frontmatter, overview, when to use / not use, policy (allowed vs forbidden tools), steps, references pointer.
- [x] Write **`task-prompt.md`:** full procedure (AC2a–g), dedup guard (AC3), Discord output templates, vault root resolution, date filter algorithm, error classes (`vault-graduate: bad-trigger`, `vault-graduate: no-vault-root`, etc.).
- [x] Create **`scripts/install-hermes-skill-vault-graduate.sh`**; run it to deploy to **`~/.hermes/skills/cns/vault-graduate/`**.
- [x] Write **`tests/hermes-vault-graduate-skill.test.mjs`** (repo mirror assertions only — no live Discord).
- [x] Measure token counts (**AC4**); trim prose if over budget.
- [x] Wire **`vault-graduate`** into **`~/.hermes/config.yaml`** `discord.channel_skill_bindings` and **`channel_prompts`** for **`#hermes`** (same pattern as **`vault-think`** / **`vault-lint`**).
- [x] Run **`npm test`** and **`bash scripts/verify.sh`**.

## Dev Notes

### Epic 32 / prior story intelligence

| Source | Relevance |
|--------|-----------|
| **Epic 31** (done) | **`vault-think`** v1.1 live; read-only cognition. **Graduate is the write complement** — do not add mutators to `vault-think`. |
| **29-10** (done) | Hermes on-demand skill pattern: thin **`SKILL.md`**, fat **`task-prompt.md`**, install script, **`tests/hermes-*-skill.test.mjs`**, channel binding. |
| **29-6** (done) | Dedup via **`vault_search`** + frontmatter verification — reuse **pattern**, not ingest URI normalization. |
| **26-6** (done) | **`vault_create_note`** mapping example in **`hermes-url-ingest-vault`**. |
| **26-3** (done) | Governed writes **MCP-only** outside **`00-Inbox/`** — no Hermes FS writes to **`DailyNotes/`** or **`03-Resources/`**. |

### `vault_append_daily` receipt — Option B (decided, AC2f)

**Operator decision (2026-05-17):** Graduation receipts go in **today's** daily note. The graduation event happens today, so it belongs in today's log. **No MCP changes.**

**Procedure:** After all **`vault_create_note`** calls for the run, call **`vault_append_daily` once** (or once per batch) with a single **`## Graduated <ISO date>`** section (UTC `YYYY-MM-DD` at run time) and **one bullet per promoted InsightNote**, each including **`(from DailyNotes/<source-filename>)`**. Use default **`vault_append_daily`** (targets **`DailyNotes/{todayUtcYmd()}.md`** only — path is not configurable).

**Do not** append to source/historical daily files. **Do not** use Hermes filesystem writes to **`DailyNotes/`** (violates **26-3**). There is no **`vault_update_body`** tool.

### Allowed / forbidden Vault IO tools

| Allowed | Forbidden |
|---------|-----------|
| **`vault_list`**, **`vault_read`**, **`vault_read_frontmatter`**, **`vault_search`**, **`vault_create_note`**, **`vault_append_daily`** | **`vault_update_frontmatter`**, **`vault_move`**, **`vault_log_action`**, **`vault_request_disambiguation`** (unless a future disambiguation story adds it) |

**Contrast with `vault-think`:** graduate **must** call mutators; vault-think **must not**.

### Trigger parsing (AC1)

Let **`raw`** = operator message trimmed.

| Pattern | Behavior |
|---------|----------|
| **`/graduate`** | Scan default **7** days. |
| **`/graduate --days <n>`** | **`n`** positive integer; scan last **`n`** calendar days by filename. |
| Anything else | Reply **`vault-graduate: bad-trigger`**; no vault I/O. |

**Date filter:** Parse **`YYYY-MM-DD`** from basename of paths under **`DailyNotes/`**. Include files where **`file_date >= run_date - n days`** (UTC calendar math; document edge cases in task-prompt).

### `#graduate` line extraction (AC2d–e)

- Match **whole-line** or **inline** tag: substring **`#graduate`** case-insensitive.
- **Title** for InsightNote: same line with **`#graduate`** removed, whitespace collapsed, max length per Vault IO title rules.
- **One InsightNote per flagged line** (multiple tags on one line → one note unless task-prompt splits on multiple hashtags — default **one per line**).
- Do **not** strip **`#graduate`** from the source daily body (no body-edit tool).

### `vault_create_note` mapping (AC2e)

Call with **body-only** `content` (no YAML in content). Tool auto-sets **`status: draft`**, **`creation_method: ai`**, timestamps, **`pake_id`**.

| Argument | Value |
|----------|--------|
| `pake_type` | `InsightNote` |
| `title` | Stripped idea text |
| `source_uri` | `vault://DailyNotes/<filename>` |
| `tags` | `["graduate", "daily-note", ...]` |
| `confidence_score` | `0.5` unless operator policy says otherwise |

On **filename conflict**, surface short class **`graduate: duplicate-title`** in Discord; do not overwrite.

### Dedup guard (AC3)

1. **`vault_search`** with `scope: "03-Resources/"`, query = stripped title (or quoted literal per search syntax).
2. For top hits (cap **5**), **`vault_read_frontmatter`** and compare **`title`** field **case-insensitive** after trim.
3. On match → skip create; Discord line: **`already graduated: <title> → <existing path>`**.

Do **not** reuse **`governedNoteExistsWithSourceUri`** (URI dedup ≠ title dedup).

### Discord report template (AC2g)

**Success (partial or full):**

```text
🎓 Graduate report (last <n> days)

Promoted:
• <title> → 03-Resources/<file> (from DailyNotes/<daily>)

Skipped (already graduated):
• <title> → <existing path>

Receipt appended (today's daily):
• DailyNotes/<today> — ## Graduated <ISO date> (all promoted items with source filenames)
```

**Empty scan:**

```text
No #graduate tags found in the last <n> days.
```

Reply **only** the template body (no extra preamble), same discipline as **`vault-think`**.

### Token budget (AC4)

Per **`AGENTS.md` §6.5** (on-demand Hermes skills: zero always-on overhead; file budgets are hard limits):

```bash
# From repo root after authoring:
wc -c scripts/hermes-skill-examples/vault-graduate/SKILL.md
wc -c scripts/hermes-skill-examples/vault-graduate/references/task-prompt.md
# estimated_tokens = bytes / 4
```

| File | Max tokens (bytes ÷ 4) |
|------|-------------------------|
| `SKILL.md` | **800** |
| `task-prompt.md` | **1,200** |

Prefer tables and numbered steps over prose in **`task-prompt.md`** to stay under budget.

### File structure requirements

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/vault-graduate/SKILL.md` | Create |
| `scripts/hermes-skill-examples/vault-graduate/references/task-prompt.md` | Create |
| `scripts/install-hermes-skill-vault-graduate.sh` | Create |
| `tests/hermes-vault-graduate-skill.test.mjs` | Create |
| `~/.hermes/skills/cns/vault-graduate/` | Install copy |
| `~/.hermes/config.yaml` | Add binding + channel prompt (operator tree; not committed) |

**Not in scope:** `src/register-vault-io-tools.ts`, `specs/`, **`AGENTS.md`**, **`vault-think`** skill files (Option B — no MCP extension).

### Testing requirements

**Blocking:**

```bash
npm test
bash scripts/verify.sh
```

**`tests/hermes-vault-graduate-skill.test.mjs` minimum assertions:**

- Mirror paths exist; **`name: vault-graduate`**, **`version: 1.0.0`**
- **`/graduate`** and **`--days`** documented in **`SKILL.md`** / **`task-prompt.md`**
- **`#graduate`** case-insensitive mention
- **`vault_create_note`** field table / `source_uri` `vault://DailyNotes/`
- **`## Graduated`** receipt on **today's** daily with **`(from DailyNotes/...)`** per bullet and **`vault_append_daily`**
- dedup / **already graduated** strings
- **`vault-think`**-style forbidden mutator list **excludes** create/append from forbidden set (graduate allows them)
- install script path

Pattern: [`tests/hermes-vault-think-skill.test.mjs`](tests/hermes-vault-think-skill.test.mjs), [`tests/hermes-triage-skill.test.mjs`](tests/hermes-triage-skill.test.mjs).

### Architecture compliance

- **WriteGate / audit:** All creates and appends go through Vault IO; expect **`agent-log.md`** lines for **`vault_create_note`** and **`vault_append_daily`**.
- **Zero always-on overhead:** Skill loads via **`#hermes`** channel binding only — do not reference from **`session-close`** or **`AGENTS.md`**.

### Hermes config (post-install)

Mirror **29-10** / **31-3**:

1. Add **`vault-graduate`** to **`discord.channel_skill_bindings`** for **`#hermes`** (`1500733488897462382` unless deployment differs).
2. Extend **`discord.channel_prompts`** for that channel: use **`vault-graduate`** for **`/graduate`** and **`/graduate --days <n>`**.

Query Context7 **`/nousresearch/hermes-agent`** for **`channel_skill_bindings`** / skill layout if config shape is unclear.

### Standing task: Operator guide

- [ ] Add **§15.x Graduate (`/graduate`)** to **`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`**: trigger, scan window, **`#graduate`** tagging convention, dedup behaviour, **Option B** receipt on **today's** daily (`## Graduated` with source filenames in parentheses), MCP-only writes. Bump **`modified`** and Version History row when implementation ships.

## References

- [Source: `specs/cns-vault-contract/AGENTS.md` §2 Daily Notes, §4 Vault IO, §6.5 Token Budget]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` § `vault_create_note`, `vault_append_daily`, `vault_list`, `vault_search`]
- [Source: `src/tools/vault-append-daily.ts` — today-only path constraint]
- [Source: `scripts/hermes-skill-examples/vault-think/` — read-only contrast]
- [Source: `scripts/hermes-skill-examples/hermes-url-ingest-vault/SKILL.md` — `vault_create_note` mapping]
- [Source: `scripts/install-hermes-skill-vault-think.sh` — install script pattern]
- [Source: `_bmad-output/implementation-artifacts/29-10-hermes-thinking-commands.md`]
- [Source: `_bmad-output/implementation-artifacts/29-6-dedup-guard-at-ingest-time.md` — search dedup pattern]

## Dev Agent Record

### Agent Model Used

Composer (dev-story 32-1)

### Debug Log References

_(none)_

### Completion Notes List

- Added Hermes **`vault-graduate`** skill mirror (`SKILL.md` v1.0.0 + `references/task-prompt.md`) with `/graduate` and `/graduate --days <n>` triggers, `#graduate` scan, InsightNote create mapping, title dedup, Option B **`vault_append_daily`** receipt, Discord templates.
- Token budgets (bytes ÷ 4): **`SKILL.md`** 2657 → ~664 (≤800); **`task-prompt.md`** 3762 → ~940 (≤1200).
- Installed to **`~/.hermes/skills/cns/vault-graduate/`**; wired **`vault-graduate`** in **`~/.hermes/config.yaml`** for `#hermes` bindings + channel prompt.
- **`npm test`** and **`bash scripts/verify.sh`** pass. Standing operator-guide §15.x task remains for vault doc (not in repo File List).

### File List

- `scripts/hermes-skill-examples/vault-graduate/SKILL.md`
- `scripts/hermes-skill-examples/vault-graduate/references/task-prompt.md`
- `scripts/install-hermes-skill-vault-graduate.sh`
- `tests/hermes-vault-graduate-skill.test.mjs`
- `_bmad-output/implementation-artifacts/32-1-vault-graduate-skill-daily-note-idea-promotion.md` (this story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (32-1 → review)
- `~/.hermes/skills/cns/vault-graduate/` (installed copy)
- `~/.hermes/config.yaml` (channel binding + prompt; operator tree)

### Verification

| Check | Result |
|-------|--------|
| Story file created | done |
| Token budgets (`wc -c ÷ 4`) | SKILL.md 2657 (~664); task-prompt.md 3762 (~940) — within AC4 |
| `npm test` | pass |
| `bash scripts/verify.sh` | pass |

## Change Log

- 2026-05-17: Story 32-1 created (ready-for-dev) — Hermes `vault-graduate` skill for `#graduate` daily-note promotion; Epic 32 opened.
- 2026-05-17: AC2f locked to **Option B** — graduation receipt on today's daily only (`vault_append_daily` default); source daily cited in parentheses; no MCP extension.
- 2026-05-17: dev-story complete — skill package, install script, regression tests, Hermes config wiring; status → review.
- 2026-05-17: Code review patch — per-idea `source_uri` with `#<url-encoded-title-slug>` fragment (P1 dedup collision fix); reverted out-of-scope `AGENTS.md` to v2.0.2 with Epic 32 in-progress (P2).
