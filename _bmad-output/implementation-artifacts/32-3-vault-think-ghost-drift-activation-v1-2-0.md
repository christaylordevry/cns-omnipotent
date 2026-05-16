---
story_id: 32-3
epic: 32
title: vault-think-ghost-drift-activation-v1-2-0
status: review
---

# Story 32.3: vault-think-ghost-drift-activation-v1-2-0

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide for Epic 32 `/ghost` and `/drift` activation on vault-think v1.2.0. -->

## Story

As the **operator**,  
I want **`/ghost`** and **`/drift`** thinking commands to return real vault content,  
so that **I can query my own thinking patterns from Discord instead of receiving stub refusals**.

## Context

| Topic | Detail |
|-------|--------|
| **Skill home** | **`vault-think`** — read-only cognition; this story activates the last two v1.1 stubs. |
| **Version line** | Skill is at **`1.1.1`** today (`/today` shipped in 32-2). This story activates **`/ghost`** and **`/drift`** and bumps to **`1.2.0`**. |
| **Current stubs** | **`task-prompt.md` §1a** replies `vault-think: v1.1-not-active` for `/ghost` and `/drift` with no vault I/O. **`SKILL.md`** lists them in **v1.1 stubs** table and **When not to use**. |
| **Writes** | **None** — allowed tools for these commands: **`vault_search`**, **`vault_read`**, **`vault_list`** only (no mutators, no REST). |
| **Dual copy rule** | Every skill edit applies to **both**: (1) `scripts/hermes-skill-examples/vault-think/` (repo mirror), (2) `~/.hermes/skills/cns/vault-think/` via **`bash scripts/install-hermes-skill-vault-think.sh`**. |

**Environment**

| Variable / path | Value |
|-----------------|--------|
| Vault root | **`CNS_VAULT_ROOT`** (env → `~/.hermes/config.yaml` `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`) |
| Daily notes (drift) | **`DailyNotes/YYYY-MM-DD.md`** — last **14** UTC calendar days |
| Synthesis check (drift) | **`03-Resources/`** via **`vault_search`** for existing **SynthesisNote** per recurring concept |
| Operator voice (ghost) | Notes where the **operator** has written about the topic — search broadly across governed folders |

## Acceptance Criteria

1. **`references/task-prompt.md`** has a new **`/ghost`** section and a new **`/drift`** section. **Both** repo mirror and live **`~/.hermes`** copies updated. Stub refusal block for `/ghost` and `/drift` (**§1a**) is **removed** and replaced with live procedure routing.
2. **`SKILL.md`** updated: **`/ghost`** and **`/drift`** moved from **v1.1 stubs** table to **When to use** active triggers. **`version:`** bumped to **`1.2.0`**. **v1.1 stubs** section removed. Description frontmatter updated. **Both** copies updated.
3. **`/ghost` procedure:** **`vault_search`** (up to **6** calls, scoped broadly), **`vault_read`** (up to **8** notes), synthesize first-person answer using **only** vault content. If no relevant content: reply exactly **`ghost: no vault writing found on this topic.`** Discord output template:

   ```text
   👻 Ghost — <question>

   <synthesized answer in operator voice>

   Sources: <note titles>
   ```

4. **`/drift` procedure:** **`vault_list`** **`DailyNotes/`** + **`vault_read`** last **14** daily notes, extract terms/phrases appearing **3+** times, **`vault_search`** each in **`03-Resources/`** for **SynthesisNote**, report unresolved ones. Discord output:

   ```text
   🌀 Drift

   Circling without landing:
   • <concept> (<n> mentions, no synthesis)

   Consider /graduate or run-chain on these.
   ```

5. **Token budget (§6.5 delta):** **`/ghost`** + **`/drift`** sections added to **`task-prompt.md`** must not exceed **700** estimated tokens **combined** (`wc -c` delta before/after ÷ 4). **Baseline (story creation):** **15,711** bytes (~**3,928** tokens full file). Record baseline, post-edit bytes, delta bytes, and estimated delta tokens in **Verification** at dev closeout.
6. **Regression tests** in **`tests/hermes-vault-think-skill.test.mjs`**:
   - **`/ghost`** trigger recognition and **`vault_search`** + **`vault_read`** procedure
   - **`/ghost`** no-content fallback string
   - **`/drift`** trigger recognition and **DailyNotes** scan procedure
   - **`/drift`** unresolved concept detection (3+ mentions, SynthesisNote check in **`03-Resources/`**)
   - Stub refusal block is **GONE** (negative assertion: no **`v1.1-not-active`** routing for ghost/drift)
7. **`npm test`** passes. **`bash scripts/verify.sh`** passes.
8. **Live Discord test:** **`/ghost`** run with a known topic returns vault-sourced content. **`/drift`** returns a real scan result. Evidence in **`_bmad-output/implementation-artifacts/epic-32-thinking-commands-evidence.md`** (operator executes in **`#hermes`** and pastes results back).

## Tasks / Subtasks

- [x] Read current **`scripts/hermes-skill-examples/vault-think/SKILL.md`** and **`references/task-prompt.md`** in full.
- [x] Measure **`task-prompt.md`** baseline: `wc -c` → expect **15,711** bytes (record for AC5).
- [x] **Remove** **`§1a) v1.1 stub triggers`** entirely (ghost/drift refusal block).
- [x] Add **`§1`** routing for **`/ghost`** and **`/drift`** (classify before or after **`/today`** per ordering table in Dev Notes; route to §3 procedures).
- [x] Add **`### /ghost`** section to **`task-prompt.md`** in **§3** — **after `/connect`**, **before `/today`**.
- [x] Add **`### /drift`** section to **`task-prompt.md`** in **§3** — immediately after **`/ghost`**.
- [x] Update **§0** header bullet list: remove **v1.1 stubs** line; add **v1.2.0** live **`/ghost`**, **`/drift`**.
- [x] Update **§4) Forbidden tools** to carve out **`vault_list`** for **`/drift`** path (and keep **`/today`** carve-out); **`/ghost`** stays **`vault_search`** + **`vault_read`** only.
- [x] Update **`SKILL.md`:** move **`/ghost`**, **`/drift`** to **When to use**; remove **v1.1 stubs** table and **When not to use** stub bullet; bump **`version: 1.2.0`**; update description.
- [x] **`bash scripts/install-hermes-skill-vault-think.sh`**; confirm mirror == **`~/.hermes/skills/cns/vault-think/`**.
- [x] Extend **`tests/hermes-vault-think-skill.test.mjs`** (AC6); update Story 31-3 describe version assertion to **`1.2.0`**.
- [x] Measure **`task-prompt.md`** post-edit delta; confirm **≤ 700** tokens combined for new sections (AC5).
- [x] Extend **`~/.hermes/config.yaml`** **`discord.channel_prompts`** for **`#hermes`** to mention **`/ghost`** and **`/drift`** (bindings already route **`#hermes`** through **`vault-think`**).
- [x] Run **`npm test`** and **`bash scripts/verify.sh`**.
- [ ] **Operator (AC8):** Run live **`/ghost`** and **`/drift`** in **`#hermes`**; paste evidence into **`epic-32-thinking-commands-evidence.md`**.

## Dev Notes

### Epic 32 / prior story intelligence

| Source | Relevance |
|--------|-----------|
| **32-2** (done) | **`vault-think` v1.1.1** — **`/today`** uses **`vault_list`** + **`vault_read`**; **`§1b`** classification; **`task-prompt.md`** baseline **15,711** bytes post-32-2. **`§4`** has **`/today` path only** carve-out for **`vault_list`**. |
| **32-1** (done) | **`vault-graduate`** is the **write** complement for promoting ideas; **`/drift`** footer references **`/graduate`** and **run-chain** — do **not** add mutators to **`vault-think`**. |
| **31-3** (done) | **`/trace`**, **`/connect`** live via REST; ghost/drift were the remaining stubs. Tests in **`hermes-vault-think-skill.test.mjs`** assert stub refusal — **must flip to negative assertion** in this story. |
| **29-10** (done) | Original ghost/drift **intent**: ghost = operator voice from vault writing; drift = ideas circling without clear thread. Install script + test module patterns. |

### Critical: remove §1a stub block

**Today (pre-32-3):** `task-prompt.md` lines 41–49 (**§1a**) short-circuit ghost/drift with:

```text
vault-think: v1.1-not-active — /ghost and /drift are documented stubs only. Use /challenge, /emerge, /ideas, /trace, /connect, or /today.
```

**Implementation rule:** Delete **§1a** entirely. Add explicit **§1** classification entries for **`/ghost`** and **`/drift`** that route to **§3** procedures (same pattern as **`/today`** in **§1b**).

### Classification order (normative)

Let **`raw`** = operator message trimmed.

| Order | Pattern | Route |
|-------|---------|--------|
| 1 | **`/today`** variants | **§1b** → **§3 `/today`** (unchanged) |
| 2 | **`/ghost`** + non-empty question | **§3 `/ghost`** |
| 3 | **`/drift`** exact (+ optional trailing spaces only) | **§3 `/drift`** |
| 4 | **`/trace`**, **`/connect`** | **§1c** → **§3** REST (unchanged) |
| 5 | v1.0 triggers | **§2** (unchanged) |
| — | else | **`vault-think: bad-trigger`** |

**`/ghost` parse:**

| Pattern | Behavior |
|---------|----------|
| **`raw`** starts with **`/ghost`** + at least one ASCII space + non-empty remainder | Route to **`/ghost`**; **`question`** = remainder trimmed. |
| **`/ghost`** with no question (exact or only spaces after command) | Reply **`vault-think: ghost requires question`** and stop (no vault I/O). |
| Anything else starting with **`/ghost`** | **`vault-think: bad-trigger`**. |

**`/drift` parse:**

| Pattern | Behavior |
|---------|----------|
| **`raw`** equals **`/drift`** or **`/drift`** + trailing ASCII whitespace only | Route to **`/drift`**. |
| **`/drift`** + any other args/flags | **`vault-think: bad-trigger`**. |

**Env requirements:**

- **`/ghost`**, **`/drift`:** require **`CNS_VAULT_ROOT`** (reply **`vault-think: no-vault-root`** if unset). **Do not** require **`OBSIDIAN_API_KEY`**.

### Procedure: `/ghost` (normative)

Let **`question`** = operator text after **`/ghost `**.

1. Derive **2–4** literal search strings from **`question`** (meaningful words/phrases; drop stopwords; each ≥ 3 chars unless question is shorter).
2. Call **`vault_search`** with `max_results: 50`, rotating scopes across **`01-Projects/`**, **`02-Areas/`**, **`03-Resources/`**, and optionally **`DailyNotes/`** before repeating. **Cap:** ≤ **6** total **`vault_search`** calls.
3. Deduplicate hit paths (vault-relative POSIX). Rank for **operator-authored** relevance: prefer notes whose body or snippet shows first-person operator writing about the topic (daily notes, project notes, resources — not pure third-party paste without operator voice).
4. **`vault_read`** up to **8** distinct paths (prioritize highest relevance). **Cap:** ≤ **8** reads.
5. **Synthesize** a first-person answer **using only** text from read notes. **No external knowledge.** Preserve uncertainty; cite honestly.
6. **If** no note yields usable operator-voice content on the topic: reply **exactly** (standalone, no template wrapper):

   ```text
   ghost: no vault writing found on this topic.
   ```

7. **Success** — Discord reply **only**:

   ```text
   👻 Ghost — <question>

   <synthesized answer in operator voice>

   Sources: <comma-separated note titles from frontmatter title or basename>
   ```

**MCP caps for `/ghost`:** ≤ **6** **`vault_search`**, ≤ **8** **`vault_read`**. Cap hit → **`vault-think: incomplete`** once.

### Procedure: `/drift` (normative)

**Goal:** Surface recurring concepts in recent daily notes that have **not** landed as a **SynthesisNote** in **`03-Resources/`**.

1. Compute **`window_start_utc`** = **`today_utc`** minus **14** calendar days (same UTC date math as **`/emerge`**).
2. **`vault_list`** on **`DailyNotes/`** (non-recursive). Select entries whose basename date is **≥ `window_start_utc`** and **≤ `today_utc`**, sorted descending by date. **Cap:** read at most **14** files.
3. For each selected daily note: **`vault_read`**. Extract candidate **terms/phrases**:
   - Prefer heading lines, bold phrases, repeated proper nouns, and multi-word concepts (Title Case or emphasized).
   - Normalize case for counting; ignore stopwords-only tokens.
   - Keep terms appearing **≥ 3** times **across the scanned daily-note corpus** (not necessarily within a single file).
4. For each recurring term (cap **8** terms to stay within search budget): **`vault_search`** in scope **`03-Resources/`** with query = term. Check hits for **`pake_type: SynthesisNote`** in frontmatter summary **or** title containing the term (case-insensitive). If **no** synthesis hit: term is **unresolved drift**.
5. **Cap:** ≤ **8** **`vault_search`** calls for drift checks; ≤ **14** **`vault_read`** on dailies; ≤ **1** **`vault_list`**.
6. **Discord reply** — if **no** unresolved terms:

   ```text
   🌀 Drift

   No recurring concepts circling without synthesis in the last 14 days.
   ```

   If unresolved terms exist — **only**:

   ```text
   🌀 Drift

   Circling without landing:
   • <concept> (<n> mentions, no synthesis)
   ...

   Consider /graduate or run-chain on these.
   ```

   Sort bullets by **`n`** descending; cap display at **8** concepts.

**MCP caps for `/drift`:** ≤ **1** **`vault_list`**, ≤ **14** **`vault_read`**, ≤ **8** **`vault_search`**. Cap hit → **`vault-think: incomplete`**.

### Placement in `task-prompt.md`

| Section | Action |
|---------|--------|
| **§0** bullets | Remove **v1.1 stubs** line; add **v1.2.0: `/ghost`, `/drift`** (Vault IO read-only). |
| **§1a** | **Delete** stub block. |
| **§1** | Add **`/ghost`** and **`/drift`** classification subsections (suggest **§1d** after **§1c**, or merge into ordered list — keep **`/today`** in **§1b** unchanged). |
| **§3** | Insert **`### /ghost`** then **`### /drift`** **after** **`### /connect`**, **before** **`### /today`**. |
| **§4** | Extend carve-out: **`/today` and `/drift` paths** may call **`vault_list`** (+ reads as specified). **`/ghost`** path: **`vault_search`** + **`vault_read`** only. |

### File structure requirements

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/vault-think/references/task-prompt.md` | Edit — activate ghost/drift |
| `scripts/hermes-skill-examples/vault-think/SKILL.md` | Edit — v1.2.0, When to use |
| `tests/hermes-vault-think-skill.test.mjs` | Edit — AC6 assertions |
| `~/.hermes/skills/cns/vault-think/**` | Install copy |
| `~/.hermes/config.yaml` | Extend **`channel_prompts`** for **`/ghost`**, **`/drift`** |
| `_bmad-output/implementation-artifacts/epic-32-thinking-commands-evidence.md` | Create or append — AC8 live Discord evidence |

**Not in scope:** `src/`, `specs/`, **`AGENTS.md`**, MCP tool signature changes, activating new REST endpoints, **`vault-graduate`** logic changes.

### Testing requirements

**Blocking:**

```bash
npm test
bash scripts/verify.sh
```

**`tests/hermes-vault-think-skill.test.mjs` minimum changes:**

1. **Update** Story 31-3 describe: `version: 1.2.0`; ghost/drift in **When to use** context (not stub-only).
2. **Replace** test **"documents v1.0 output templates and ghost/drift stub refusal only"**:
   - **Remove** assertions requiring **`v1.1-not-active`** for ghost/drift.
   - **Add** negative: `!body.includes('v1.1-not-active — /ghost and /drift')` or equivalent.
   - **Keep** v1.0 template assertions (Challenge, Emerge, Ideas).
3. **New describe** `Story 32-3 Hermes vault-think /ghost and /drift`:
   - `version: 1.2.0` in **`SKILL.md`**
   - **`/ghost`** + **`vault_search`** + **`vault_read`** caps (6 / 8)
   - **`ghost: no vault writing found on this topic.`**
   - **`👻 Ghost —`**
   - **`/drift`** + **`DailyNotes/`** + **14** days + **3+** mentions
   - **`03-Resources/`** + **SynthesisNote** check language
   - **`🌀 Drift`** + **`Circling without landing:`**
   - **`/graduate`** or **run-chain** footer
   - **`vault_list`** in drift procedure; ghost section must **not** require **`vault_list`** unless documented
4. **Preserve** Story 32-2 **`/today`** tests unchanged except version bump side effects.

Pattern: existing [`tests/hermes-vault-think-skill.test.mjs`](tests/hermes-vault-think-skill.test.mjs).

### Token budget (AC5)

Per **`AGENTS.md` §6.5** — incremental delta on **`task-prompt.md`** only:

```bash
wc -c scripts/hermes-skill-examples/vault-think/references/task-prompt.md  # baseline: 15711
# after edits:
wc -c scripts/hermes-skill-examples/vault-think/references/task-prompt.md
# delta_tokens ≈ (bytes_after - bytes_before) / 4  → must be ≤ 700
```

**Note:** Removing **§1a** (~400–500 bytes) offsets part of the add. Net new content for **`/ghost`** + **`/drift`** procedures must still respect **≤ 700** token **combined** delta vs baseline **15,711** bytes. Prefer compact tables and numbered steps over prose.

### Architecture compliance

- **Read-only:** No WriteGate mutations; no **`vault_log_action`** from these commands.
- **Vault boundaries:** All paths under **`CNS_VAULT_ROOT`** via Vault IO MCP only.
- **No REST** for ghost/drift (unlike trace/connect).
- **Operator voice discipline (ghost):** Synthesis must be grounded in read note text; no fabricated citations.

### Hermes config (post-install)

1. **`vault-think`** should already be bound for **`#hermes`** from **29-10** / **31-3** / **32-2**.
2. Extend **`discord.channel_prompts`** for channel id **`1500733488897462382`** (unless deployment differs) to list **`/ghost <question>`** and **`/drift`**.

### Live Discord evidence (AC8 — operator-owned)

Create or update **`_bmad-output/implementation-artifacts/epic-32-thinking-commands-evidence.md`** with sections:

```markdown
## Story 32-3 — ghost/drift activation

### Discord — /ghost
- Date:
- Channel: #hermes
- Input:
- Outcome: pass | fail
- Paste: (full Discord reply)

### Discord — /drift
- Date:
- Channel: #hermes
- Input: /drift
- Outcome: pass | fail
- Paste: (full Discord reply)
```

Dev agent may create the file skeleton; **operator** runs commands and pastes results before marking story **done**.

### Sequencing (Epic 32)

| Story | Scope |
|-------|--------|
| **32-1** (done) | **`vault-graduate`** `/graduate` |
| **32-2** (done) | **`vault-think` v1.1.1** `/today` |
| **32-3** (this) | **`/ghost`**, **`/drift`** → **v1.2.0** |

### Standing task: Operator guide

- [ ] Add **`/ghost`** and **`/drift`** to **§15.6** (or adjacent vault-think section) in **`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`**: triggers, read-only guarantee, MCP caps, relationship to **`/graduate`** and **run-chain**. Bump **`modified`** and Version History when implementation ships.

## References

- [Source: `specs/cns-vault-contract/AGENTS.md` §6.5 Token Budget Policy]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `vault_search`, `vault_read`, `vault_list`]
- [Source: `scripts/hermes-skill-examples/vault-think/` — current v1.1.1 mirror]
- [Source: `scripts/install-hermes-skill-vault-think.sh`]
- [Source: `_bmad-output/implementation-artifacts/32-2-vault-think-today-command-daily-planning-briefing.md`]
- [Source: `_bmad-output/implementation-artifacts/31-3-obsidian-local-rest-api-and-thinking-command-activation.md`]
- [Source: `_bmad-output/implementation-artifacts/29-10-hermes-thinking-commands.md` — original ghost/drift intent]
- [Source: `_bmad-output/implementation-artifacts/epic-31-thinking-commands-evidence.md` — evidence format]

## Dev Agent Record

### Agent Model Used

Composer (dev-story 32-3)

### Debug Log References

_(none)_

### Completion Notes List

- Activated **`/ghost`** and **`/drift`** in `task-prompt.md` (§1c/§1d classification; §3 procedures); removed §1a stub refusal.
- Bumped `vault-think` to **v1.2.0** in `SKILL.md`; moved triggers to **When to use**; removed v1.1 stubs table.
- Extended §4 carve-outs for `/ghost` (search+read) and `/drift` (list+read+search).
- Regression tests: Story 32-3 describe block; flipped stub negative assertions; version **1.2.0** across describes.
- Installed mirror to `~/.hermes/skills/cns/vault-think/`; updated `#hermes` channel_prompts (`/ghost <question>`).
- AC5: baseline **15,711** → post **18,193** bytes; delta **2,482** (~**621** est. tokens, ≤ 700).
- AC8: evidence skeleton at `epic-32-thinking-commands-evidence.md` — **operator** must run live Discord and paste results.

### File List

- `scripts/hermes-skill-examples/vault-think/SKILL.md`
- `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`
- `tests/hermes-vault-think-skill.test.mjs`
- `_bmad-output/implementation-artifacts/epic-32-thinking-commands-evidence.md`
- `_bmad-output/implementation-artifacts/32-3-vault-think-ghost-drift-activation-v1-2-0.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `~/.hermes/skills/cns/vault-think/SKILL.md` (install)
- `~/.hermes/skills/cns/vault-think/references/task-prompt.md` (install)
- `~/.hermes/config.yaml`

### Verification

| Check | Result |
|-------|--------|
| Story file created | done |
| `task-prompt.md` baseline bytes | **15,711** (~3,928 tokens full file) |
| `task-prompt.md` post-edit bytes | **18,193** |
| Delta bytes | **+2,482** |
| Delta token budget (AC5) | **~621** (≤ 700) pass |
| `npm test` | pass (606) |
| `bash scripts/verify.sh` | pass |
| Live Discord AC8 evidence | pending operator |

## Change Log

- 2026-05-17: Story 32-3 created (ready-for-dev) — activate `/ghost` and `/drift` on `vault-think` v1.2.0; remove v1.1 stub refusal; Vault IO read-only procedures; 700-token combined delta budget.
- 2026-05-17: Dev implementation complete (review) — v1.2.0 ghost/drift live in skill mirror + Hermes install; tests green; AC8 awaits operator Discord evidence.
- 2026-05-17: Review fix — `/drift` resolution now requires a matching `pake_type: SynthesisNote`; non-synthesis title matches remain unresolved. Status stays review pending AC8.
