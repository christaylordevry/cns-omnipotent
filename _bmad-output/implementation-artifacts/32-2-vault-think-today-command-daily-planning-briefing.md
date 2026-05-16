---
story_id: 32-2
epic: 32
title: vault-think-today-command-daily-planning-briefing
status: done
---

# Story 32.2: vault-think-today-command-daily-planning-briefing

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide for Epic 32 `/today` daily planning briefing on vault-think. -->

## Story

As the **operator**,  
I want to run **`/today`** in Discord and receive a structured vault-aware planning briefing,  
so that **I can orient quickly at the start of a work session without manually checking multiple vault locations**.

## Context

| Topic | Detail |
|-------|--------|
| **Skill home** | **`vault-think`** — read-only orientation; **`/today`** needs **`vault_list`**, **`vault_read`**, and **`vault_search`** is **not** required for this command. |
| **Version line** | Skill is at **`1.1.0`** today. This story adds **`/today`** and bumps to **`1.1.1`** (minor addition). **`1.2.0`** is reserved for **story 32-3** when **`/ghost`** and **`/drift`** go live. |
| **Trigger** | **`/today`** (exact, no args) or **`/today --brief`** (shorter output). |
| **Writes** | **None** — no **`vault_create_note`**, **`vault_append_daily`**, or other mutators. |
| **Dual copy rule** | Every skill edit applies to **both**: (1) `scripts/hermes-skill-examples/vault-think/` (repo mirror), (2) `~/.hermes/skills/cns/vault-think/` via **`bash scripts/install-hermes-skill-vault-think.sh`**. |

**Environment**

| Variable / path | Value |
|-----------------|--------|
| Vault root | **`CNS_VAULT_ROOT`** (env → `~/.hermes/config.yaml` `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`) |
| Daily notes | **`DailyNotes/YYYY-MM-DD.md`** (UTC date) |
| Active projects | **`01-Projects/`** (exclude **`_README.md`**) |
| Inbox | **`00-Inbox/`** — **count only** (list entries; no **`vault_read`**) |

## Acceptance Criteria

1. **`references/task-prompt.md`** has a new **`/today`** section with the full procedure (steps 1–6 in Dev Notes). Section is placed **immediately after the `/connect` section** (end of §3 live triggers, before §4 Forbidden tools). **Both** repo mirror and live **`~/.hermes`** copies updated.
2. **`SKILL.md`** updated: **`/today`** and **`/today --brief`** added to **When to use**; **`version:`** bumped to **`1.1.1`**. Description frontmatter mentions **`/today`**. **Both** copies updated.
3. **`--brief` flag:** When present, Discord output is **exactly three lines** (see Brief template in Dev Notes): date header, daily note summary, inbox count. **No** active-project bullets.
4. **Token budget (§6.5 delta):** The **`/today`** section added to **`task-prompt.md`** must not exceed **500** estimated tokens (**`wc -c` delta before/after ÷ 4**). Record baseline bytes, post-edit bytes, delta bytes, and estimated delta tokens in **Verification** at dev closeout.
5. **Regression test** in **`tests/hermes-vault-think-skill.test.mjs`**:
   - **`/today`** trigger recognition (exact and optional trailing whitespace)
   - **`--brief`** flag recognition
   - **`DailyNotes/`** list + read procedure documented
   - Project list capped at **5** reads
   - Inbox **count** without reads
   - **`version: 1.1.1`** asserted
   - **`vault_list`** allowed for **`/today`** (update or extend the existing “forbidden tools” test so it does not fail when **`vault_list`** appears in the **`/today`** procedure)
6. **`npm test`** passes. **`bash scripts/verify.sh`** passes.

## Tasks / Subtasks

- [x] Read current **`scripts/hermes-skill-examples/vault-think/SKILL.md`** and **`references/task-prompt.md`** in full.
- [x] Measure **`task-prompt.md`** baseline: `wc -c` (record for AC4).
- [x] Add **`/today`** section to **`task-prompt.md`** immediately after **`/connect`** (procedure steps 1–6, full + brief templates, MCP caps).
- [x] Update **§1) Line classification** so **`/today`** and **`/today --brief`** route to the new section (not **`bad-trigger`**, not ghost/drift stub).
- [x] Update **§4) Forbidden tools** to carve out **`vault_list`** (and only the reads needed for **`/today`**) for the **`/today`** path; other commands remain unchanged.
- [x] Update **`SKILL.md`:** **When to use**, version **`1.1.1`**, description; optional one-line under Policy that **`/today`** may use **`vault_list`**.
- [x] **`bash scripts/install-hermes-skill-vault-think.sh`**; confirm mirror == **`~/.hermes/skills/cns/vault-think/`**.
- [x] Extend **`tests/hermes-vault-think-skill.test.mjs`** (AC5).
- [x] Measure **`task-prompt.md`** post-edit delta; confirm **≤ 500** tokens (AC4).
- [x] Extend **`~/.hermes/config.yaml`** **`discord.channel_prompts`** for **`#hermes`** to mention **`/today`** (bindings already route **`#hermes`** through **`vault-think`** — prompt text only).
- [x] Run **`npm test`** and **`bash scripts/verify.sh`**.

## Dev Notes

### Epic 32 / prior story intelligence

| Source | Relevance |
|--------|-----------|
| **32-1** (done) | **`vault-graduate`** is the **write** complement; **do not** add mutators to **`vault-think`**. Install + test patterns established. |
| **31-3** (done) | **`vault-think` v1.1.0** — **`/trace`**, **`/connect`** live via REST; **`/ghost`**, **`/drift`** stubs. **`/today`** is Vault IO only (no REST). |
| **29-10** (done) | Hermes on-demand skill pattern: thin **`SKILL.md`**, fat **`task-prompt.md`**, install script, **`tests/hermes-vault-think-skill.test.mjs`**. |

### Critical: `vault_list` exception (today only)

**Today:** **`task-prompt.md` §4** lists **`vault_list`** as **forbidden** for all commands. **`/today` requires `vault_list`** for directory listing (daily note discovery, project enumeration, inbox count).

**Implementation rule:**

- **`/today` path:** allowed Vault IO tools = **`vault_list`**, **`vault_read`** only (no **`vault_search`**, no **`vault_read_frontmatter`**, no mutators).
- **All other commands:** unchanged — v1.0 still **`vault_search`** + **`vault_read`**; v1.1 trace/connect still REST **`curl`** only; §4 forbidden list stays for those paths.
- **Tests:** The test titled **"restricts v1.0 MCP reads to vault_search and vault_read only"** must be **narrowed** or **split**: assert v1.0 commands still forbid **`vault_list`**, and assert **`/today`** documents **`vault_list`** on **`DailyNotes/`**, **`01-Projects/`**, **`00-Inbox/`**.

### Trigger parsing (AC2, AC3)

Let **`raw`** = operator message trimmed.

| Pattern | Behavior |
|---------|----------|
| **`/today`** | Full briefing (steps 1–6). |
| **`/today`** + only trailing ASCII whitespace | Same as exact **`/today`**. |
| **`/today --brief`** | Brief briefing (3 lines). |
| **`/today --brief`** + only trailing whitespace | Same as **`/today --brief`**. |
| Anything else starting with **`/today`** (extra args, unknown flags) | Reply **`vault-think: bad-trigger`**; no vault I/O. |

**Classification order (§1):** After ghost/drift stub check, treat **`/today`** matches **before** **`/trace`/`/connect`** and **before** v1.0 **`bad-trigger`**. **`/today`** does **not** require **`OBSIDIAN_API_KEY`**. **`/today`** **does** require **`CNS_VAULT_ROOT`** (same as v1.0 — reply **`vault-think: no-vault-root`** and stop if unset).

### Procedure (normative — steps 1–6)

Use **`today_utc`** from §0 step 4 (`YYYY-MM-DD`).

1. **`vault_list`** on **`DailyNotes/`** (non-recursive default per spec). Find entry whose filename is **`{today_utc}.md`** (exact basename match).
2. **If found:** **`vault_read`** that path. Extract for the briefing: open tasks (`- [ ]` / `- [x]` lines if present), lines under headings like **Priorities**, **Focus**, **Today**, or the first **200** characters of body after frontmatter if no structured sections. If the note is empty, summary = **`(empty daily note)`**.
3. **If not found:** daily summary = **`not yet created`** (do not **`vault_read`** a missing file).
4. **`vault_list`** on **`01-Projects/`**. Drop entries named **`_README.md`**. Sort remaining project notes by **`modified`** from list output (**descending**). Take top **5** paths. For each: **`vault_read`** (cap **5** reads total). Extract **`status`** from YAML frontmatter when present; else first non-empty body line within **200** characters after frontmatter.
5. **`vault_list`** on **`00-Inbox/`**. Let **`inbox_n`** = count of list entries (files only; exclude subdirs if the list API returns them — document choice in task-prompt). **Do not** **`vault_read`** any inbox item for this command.
6. Post Discord briefing using the templates below. Optionally add **one** emerging theme or focus sentence synthesized from daily + project samples (honest; no invented projects).

**MCP caps for `/today`:** ≤ **3** **`vault_list`** calls; ≤ **6** **`vault_read`** calls (1 daily + up to 5 projects). If caps block completion, reply **`vault-think: incomplete`** once (same discipline as other commands).

### Discord templates

**Full (default):**

```text
📅 Today — <YYYY-MM-DD>

**Daily note:** <summary of today's note, or "not yet created">
**Active projects (<n>):**
- <Project title> — <status or first line>
- ...

**Inbox:** <n> items waiting

<one emerging theme or focus if discernible from daily + projects>
```

**Rules:**

- **`<YYYY-MM-DD>`** = **`today_utc`**.
- **`<n>`** in header = number of project bullets actually shown (≤ 5).
- **Project title** = frontmatter **`title`** when present, else basename without **`.md`**.
- Omit the final theme line only if nothing defensible can be grounded in read content (prefer one honest line over filler).

**Brief (`--brief`) — exactly 3 lines:**

```text
📅 Today — <YYYY-MM-DD>
**Daily note:** <summary or "not yet created">
**Inbox:** <n> items waiting
```

No project section. No theme line.

### Placement in `task-prompt.md`

Insert new subsection **`### /today`** at the **end of §3** (after **`/connect`**), before **`## 4) Forbidden tools reminder`**.

Update §0 header bullet list to mention **`/today`** under v1.1.x if you maintain a version manifest line (optional one-liner).

Update ghost/drift stub refusal line to include **`/today`** in the “use instead” list (recommended):  
`Use /challenge, /emerge, /ideas, /trace, /connect, or /today.`

### File structure requirements

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/vault-think/references/task-prompt.md` | Edit — add **`/today`** |
| `scripts/hermes-skill-examples/vault-think/SKILL.md` | Edit — v1.1.1, When to use |
| `tests/hermes-vault-think-skill.test.mjs` | Edit — AC5 assertions |
| `~/.hermes/skills/cns/vault-think/**` | Install copy |
| `~/.hermes/config.yaml` | Extend **`channel_prompts`** for **`/today`** (operator tree) |

**Not in scope:** `src/`, `specs/`, **`AGENTS.md`**, **`vault-graduate`**, activating **`/ghost`** / **`/drift`** (32-3), MCP tool signature changes.

### Testing requirements

**Blocking:**

```bash
npm test
bash scripts/verify.sh
```

**`tests/hermes-vault-think-skill.test.mjs` minimum additions (new `describe` block or extend existing):**

- `version: 1.1.1`
- `/today` and `/today --brief` in **`SKILL.md`** and **`task-prompt.md`**
- `DailyNotes/` + `{today_utc}.md` matching language
- `01-Projects/` cap **5** project reads
- `00-Inbox/` count without **`vault_read`** on inbox paths
- Brief template three-line shape (e.g. assert **Inbox:** present and **Active projects** absent in brief section)
- **`vault_list`** present in **`/today`** procedure; v1.0 challenge/emerge/ideas still must not require **`vault_list`**

Pattern: existing [`tests/hermes-vault-think-skill.test.mjs`](tests/hermes-vault-think-skill.test.mjs).

### Token budget (AC4)

Per **`AGENTS.md` §6.5** — this story adds **incremental** context to an on-demand skill file (zero always-on overhead). Budget applies to **delta only** on **`task-prompt.md`**:

```bash
# Baseline before edits:
wc -c scripts/hermes-skill-examples/vault-think/references/task-prompt.md
# After edits:
wc -c scripts/hermes-skill-examples/vault-think/references/task-prompt.md
# delta_tokens ≈ (bytes_after - bytes_before) / 4  → must be ≤ 500
```

**Baseline (story creation):** **13,904** bytes (~**3,476** tokens full file). Target: **`/today`** section adds ≤ **2,000** bytes (~500 tokens).

Prefer tables and numbered steps over prose to stay under delta.

### Architecture compliance

- **Read-only:** No WriteGate mutations; no audit lines from mutators on this command.
- **Vault boundaries:** All paths under **`CNS_VAULT_ROOT`** via Vault IO tools only.
- **Do not** use Obsidian REST or filesystem reads for **`/today`**.

### Hermes config (post-install)

1. **`vault-think`** should already be bound for **`#hermes`** from **29-10** / **31-3**.
2. Extend **`discord.channel_prompts`** for channel id **`1500733488897462382`** (unless deployment differs) to route **`/today`** and **`/today --brief`** through **`vault-think`**.

### Sequencing (Epic 32)

| Story | Scope |
|-------|--------|
| **32-1** (done) | **`vault-graduate`** `/graduate` |
| **32-2** (this) | **`vault-think` v1.1.1** `/today` |
| **32-3** (future) | **`/ghost`**, **`/drift`** → **v1.2.0** |

### Standing task: Operator guide

- [x] Add **`/today`** to **§15.6** (or adjacent vault-think section) in **`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`**: trigger, full vs **`--brief`**, vault folders touched, read-only guarantee. Bump **`modified`** and Version History when implementation ships.

## References

- [Source: `specs/cns-vault-contract/AGENTS.md` §2 Daily Notes, §4 Vault IO, §6.5 Token Budget]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_list`, `vault_read`]
- [Source: `scripts/hermes-skill-examples/vault-think/` — current v1.1.0 mirror]
- [Source: `scripts/install-hermes-skill-vault-think.sh`]
- [Source: `_bmad-output/implementation-artifacts/32-1-vault-graduate-skill-daily-note-idea-promotion.md`]
- [Source: `_bmad-output/implementation-artifacts/31-3-obsidian-local-rest-api-and-thinking-command-activation.md`]

## Dev Agent Record

### Agent Model Used

Composer (dev-story 32-2)

### Debug Log References

_(none)_

### Completion Notes List

- **`vault-think` v1.1.1:** `/today` + `/today --brief` in `SKILL.md` and `task-prompt.md` §1b + §3; `vault_list` carve-out in §4 for today path only.
- **Token delta (AC4):** baseline 13,904 B → post 15,711 B; delta 1,807 B (~451 tokens) ≤ 500.
- Installed to `~/.hermes/skills/cns/vault-think/` (diff clean vs repo mirror).
- Extended `#hermes` `channel_prompts` for `/today` / `/today --brief`.
- Operator Guide §15.6 + v1.28.0 version history.
- `npm test` + `bash scripts/verify.sh` passed.

### File List

- `scripts/hermes-skill-examples/vault-think/SKILL.md`
- `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`
- `tests/hermes-vault-think-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/32-2-vault-think-today-command-daily-planning-briefing.md` (this story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (32-2 → done)
- `~/.hermes/skills/cns/vault-think/` (install copy)
- `~/.hermes/config.yaml`

### Verification

| Check | Result |
|-------|--------|
| Story file created | done |
| `task-prompt.md` baseline bytes | 13,904 (~3,476 tokens full file) |
| `task-prompt.md` post-edit bytes | 15,711 |
| Delta bytes | 1,807 |
| Delta token budget (AC4) | ~451 tokens (≤ 500) |
| `npm test` | pass (676 tests) |
| `bash scripts/verify.sh` | pass |

## Change Log

- 2026-05-17: Story 32-2 created (ready-for-dev) — Hermes `vault-think` `/today` daily planning briefing; v1.1.1 bump; `vault_list` exception for today-only listing.
- 2026-05-17: Story 32-2 implemented — `/today` live at v1.1.1; tests + operator guide + Hermes config prompt updated.
- 2026-05-17: Code review pass — clarified `CNS_VAULT_ROOT` requirement in `SKILL.md`; reinstalled live skill; `npm test`, `bash scripts/verify.sh`, `git diff --check`, and mirror diff passed; status → done.
