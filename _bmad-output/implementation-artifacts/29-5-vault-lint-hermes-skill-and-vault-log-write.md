# Story 29.5: `/vault-lint` Hermes skill plus on-disk report write

Status: done

Epic: **29** (knowledge quality, agent memory)  
Normative spec: **`specs/cns-vault-contract/modules/vault-lint.md`** (binding for rules, Discord template, on-disk report, machine JSON).

## Story

As an **operator**,  
I want **`/vault-lint` in Discord `#hermes`** to run a **read-only** four-rule vault lint against governed folders, post a **spec-exact** Discord summary, and write a **full report** under **`_meta/reports/vault-lint-YYYY-MM-DD.md`** via **direct filesystem write** (not `vault_create_note`, not Vault IO mutators),  
so that **quality issues surface on a schedule or on demand** without **governed vault mutations** from the lint path, while **Hermes config** stays the single place for channel skill bindings.

## Scope boundaries (non-negotiable)

| Topic | Rule |
|-------|------|
| Vault mutations | **No** `vault_create_note`, `vault_update_frontmatter`, `vault_move`, `vault_append_daily`, `vault_log_action`, or shell that mutates governed notes. **Reads only** via Vault IO MCP (`vault_list`, `vault_read`, `vault_read_frontmatter`, `vault_search`). |
| Writes | **Only** `_meta/reports/vault-lint-YYYY-MM-DD.md` (create parent dir if missing; overwrite same calendar day). Operator FS / Hermes file or shell redirect to absolute path under `CNS_VAULT_ROOT`. |
| Stale threshold | **14** calendar days, **`days_pending > 14`** (day 14 is not a warning). `today` = **UTC** `YYYY-MM-DD` at run start. |
| Orphan candidates | **`01-Projects/`**, **`02-Areas/`**, **`03-Resources/`** only; exclude files named **`_README.md`**. |
| Governed scope for Rules 1,3,4 | Same three trees; exclusions per spec (`_README.md`, etc.). |
| Edge sources for Rule 2 | Every vault **`.md`** except under `00-Inbox/` or `_meta/` (links from `AI-Context/`, `DailyNotes/`, `04-Archives/` count). |

## Acceptance criteria

1. **`/vault-lint`** in **`#hermes`** runs the **full** four-rule scan per `vault-lint.md`.
2. **Discord** body matches **`vault-lint.md` § Discord Report Template** (section order, headings, `Fix:` / `Review:` prefixes, counts). **Rule 1** duplicate groups use the **Rule 1 Discord line shape** (multi-line bullet under one `*` when multiple paths share a URI).
3. **`_meta/reports/vault-lint-YYYY-MM-DD.md`** written after each successful run with sections per spec (frontmatter, Summary, ERRORS, WARNINGS, INFO JSON, Configuration).
4. Skill registered in **`~/.hermes/config.yaml`** `discord.channel_skill_bindings` for the **`#hermes`** channel alongside existing CNS skills.
5. Repo mirror at **`scripts/hermes-skill-examples/vault-lint/`** for `cp -a` installs.
6. **Read-only** vault posture confirmed (no mutator MCP calls).
7. **`npm test`** and **`bash scripts/verify.sh`** pass (no regressions).

## Tasks / Subtasks

- [x] Read normative `vault-lint.md` before authoring skill text.
- [x] Add `~/.hermes/skills/cns/vault-lint/` (`SKILL.md`, `references/task-prompt.md`).
- [x] Wire `vault-lint` skill name into `#hermes` bindings and channel prompt.
- [x] Mirror skill tree to `scripts/hermes-skill-examples/vault-lint/`.
- [x] Run `npm test` and `scripts/verify.sh`.
- [x] Update `sprint-status.yaml` for `29-5-vault-lint-hermes-skill-and-vault-log-write`.

## Dev Notes

### MCP tool reference

| Tool | Use |
|------|-----|
| `vault_list` | `path`, `recursive: true`; optional `filter_by_type` for SourceNote listing (Rule 1 aid). |
| `vault_read_frontmatter` | Exactly one of `path` or `paths` (non-empty array). |
| `vault_read` | Single `path`; body for wikilink parse after frontmatter (Rule 2). |
| `vault_search` | `query` (required), `scope` (required unless default set), `max_results` optional (max 50). **Must** call at least once per run with governed `scope` per story 29-5 AC / operator request. |

### `CNS_VAULT_ROOT` resolution

1. Environment variable `CNS_VAULT_ROOT` if set and non-empty.  
2. Else read `~/.hermes/config.yaml` and take `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT`.  
3. Else fail with short Discord error `vault-lint: no-vault-root` (no report write).

### Hermes layout reference

- `~/.hermes/skills/cns/hermes-url-ingest-vault/SKILL.md` (frontmatter, policy, steps, references split).
- `_bmad-output/implementation-artifacts/26-8-hermes-skill-capture-workflow.md` (policy vs `references/task-prompt.md`).

### Operator guide

No mandatory Operator Guide edit in this story’s AC; optional follow-up to mention `/vault-lint` next to triage/session-close.

## Dev Agent Record

### Agent model

Cursor agent (Composer-class) — implementation session 2026-05-13.

### Completion notes

- Implemented `vault-lint` Hermes skill (repo mirror + operator `~/.hermes` copy), `config.yaml` binding and prompt line for `/vault-lint`.
- Report path and Discord template follow `specs/cns-vault-contract/modules/vault-lint.md`.
- No Omnipotent `src/` changes; verification gate expected green.

### File list

- `_bmad-output/implementation-artifacts/29-5-vault-lint-hermes-skill-and-vault-log-write.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `scripts/hermes-skill-examples/vault-lint/SKILL.md`
- `scripts/hermes-skill-examples/vault-lint/references/task-prompt.md`
- Operator FS: `~/.hermes/skills/cns/vault-lint/**`
- Operator FS: `~/.hermes/config.yaml` (channel binding + prompt)

### Change log

| Date | Summary |
|------|---------|
| 2026-05-13 | Story created and implemented: skill, mirror, Hermes config, sprint status. |
