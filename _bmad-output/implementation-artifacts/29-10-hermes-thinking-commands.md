# Story 29.10: Hermes thinking commands (`vault-think`)

Status: done

## Story

As a **CNS operator**,
I want **on-demand Hermes slash commands** that pressure-test beliefs, surface unsynthesized idea clusters, and produce a structured idea report **using only read-only Vault IO** (`vault_search`, `vault_read`),
so that **I get Claude-style cognition against my vault with zero always-on token tax and no vault mutations from the skill path**.

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] User-facing Hermes behavior added: **§15.6 Vault think** plus Version History **1.25.0** in `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`.

## Acceptance Criteria

1. **Skill package** exists at `~/.hermes/skills/cns/vault-think/` with `SKILL.md` and `references/task-prompt.md` (normative procedure and output shapes).
2. **Repo mirror** at `scripts/hermes-skill-examples/vault-think/` matches the operator install tree (use `cp -a` or install script).
3. **v1.0 commands** implemented in `references/task-prompt.md` with Discord reply bodies matching **exact** templates:
   - `/challenge <non-empty belief text>` — supporting vs contradicting bullets from vault evidence, then **The tension:** synthesis (2–3 sentences).
   - `/emerge` — last **60 calendar days** (UTC), governed folders `01-Projects/`, `02-Areas/`, `03-Resources/` only; idea cluster across **≥2** notes without a dedicated synthesis page; bullets include note title and reference (vault-relative path).
   - `/ideas` — full **Vault Idea Report** with four sections and bullet lines as specified.
4. **v1.1 stubs** documented in `SKILL.md`: `/trace`, `/connect`, `/ghost`, `/drift` — each with trigger text, intent, **not-yet-active** marker; `/connect` explicitly states dependency on **Obsidian Local REST API** (not in v1.0 tool surface).
5. **Hermes config:** `vault-think` added to `discord.channel_skill_bindings` for `#hermes` (`1500733488897462382`); `discord.channel_prompts` for that id updated to tell the model to use **vault-think** for `/challenge`, `/emerge`, `/ideas`, `/trace`, `/connect`, `/ghost`, `/drift`.
6. **Read-only:** Allowed Vault IO tools: **`vault_search`**, **`vault_read`** only. Forbidden: all mutators (`vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`, `vault_log_action`) and `vault_read_frontmatter` (user asked MCP-only subset of search+read; do not add tools).
7. **Zero always-on overhead:** Skill is **not** referenced from AGENTS or session-close; loads only via channel binding (same pattern as `vault-lint`). Document token/MCP call soft caps in `SKILL.md`.
8. **`npm test`** and **`bash scripts/verify.sh`** pass.
9. **Operator Guide** §15 gains a subsection documenting install path, triggers, and read-only posture (**Story standing task**).

## Tasks / Subtasks

- [x] Author `scripts/hermes-skill-examples/vault-think/SKILL.md` (overview, when to use, v1.1 stub table, tools, non-goals).
- [x] Author `scripts/hermes-skill-examples/vault-think/references/task-prompt.md` (trigger parsers, vault root resolution, MCP budgets, exact Discord templates).
- [x] Add `scripts/install-hermes-skill-vault-think.sh` mirroring triage install pattern.
- [x] Add `tests/hermes-vault-think-skill.test.mjs` asserting mirror files, command names, forbidden mutators, template markers.
- [x] Copy skill tree to `~/.hermes/skills/cns/vault-think/`.
- [x] Patch `~/.hermes/config.yaml` bindings + channel prompt.
- [x] Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15 + version row + `modified`.
- [x] Update `_bmad-output/implementation-artifacts/sprint-status.yaml` for `29-10-hermes-thinking-commands`.
- [x] Run `npm test` and `bash scripts/verify.sh`.

## Dev Notes

### Epic and planning context

- Epic 29 card: **29-10 — Hermes thinking commands** (`_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md`): on-demand skills, read-only vault, slash triggers, skill capture §15 + 26-8 pattern.
- **User override (this story):** Skill directory name **`vault-think`** (not `thinking-commands/`); **three** v1.0 commands and **four** v1.1 stubs as listed in sprint request; MCP surface **`vault_search` + `vault_read` only**.

### Architecture compliance

- Follow **`scripts/hermes-skill-examples/vault-lint/`** layout: YAML frontmatter, `metadata.hermes.tags`, thin `SKILL.md` + fat `references/task-prompt.md`.
- **Discord untrusted input:** Only treat lines matching documented triggers as commands; refuse unknown shapes with `vault-think: bad-trigger` (no vault reads).
- **CNS_VAULT_ROOT** resolution: same three-step chain as vault-lint (`env` → `~/.hermes/config.yaml` `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT` → error `vault-think: no-vault-root`).

### vault_search contract

- Normative tool definition: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` § `vault_search` — `max_results` default 50, hard cap 50; pass explicit `scope` per call when default scope unset.

### v1.1 documentation requirements

| Command   | Stub behavior | Special dependency |
|-----------|----------------|--------------------|
| `/trace` | Idea evolution over time across notes | None (v1.1) |
| `/connect` | Bridge two domains via link graph | **Obsidian Local REST API** required; not available via Vault IO MCP v1.0 |
| `/ghost` | Answer in operator voice from vault writing | None (v1.1) |
| `/drift` | Loosely connected ideas without clear thread | None (v1.1) |

## Technical Requirements

- **Triggers (trimmed, case-sensitive command word):**
  - `/challenge ` + non-empty remainder = stated belief / topic string.
  - `/emerge` exactly (optional trailing whitespace only).
  - `/ideas` exactly (optional trailing whitespace only).
- **Date math:** Use **UTC** calendar dates for the 60-day window in `/emerge` unless task-prompt specifies otherwise; document in task-prompt.
- **Governed paths:** `01-Projects/`, `02-Areas/`, `03-Resources/` — align with vault-lint governed set (exclude `00-Inbox/`, `_meta/` from *emerge* sources).

## Testing Requirements

- New Node test module under `tests/` validates repo mirror content and presence of install script.
- No live Discord or Hermes gateway in CI.

## References

- [Source: `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md` § 29-10]
- [Source: `scripts/hermes-skill-examples/vault-lint/SKILL.md`]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` § vault_search / vault_read]
- [Source: Context7 `/nousresearch/hermes-agent` — SKILL frontmatter + channel_skill_bindings]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent).

### Completion Notes List

- Implemented `vault-think` Hermes skill (repo mirror, `~/.hermes` copy, install script, CI test).
- Wired `vault-think` into `~/.hermes/config.yaml` `#hermes` channel_skill_bindings and channel_prompts (all seven command triggers).
- Operator Guide §15.6 + version 1.25.0; refreshed `hermes-url-auto-capture-inbox` config snippet example YAML.

### File List

- `_bmad-output/implementation-artifacts/29-10-hermes-thinking-commands.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `scripts/hermes-skill-examples/vault-think/SKILL.md`
- `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`
- `scripts/install-hermes-skill-vault-think.sh`
- `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/references/config-snippet.md`
- `tests/hermes-vault-think-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- Operator FS: `~/.hermes/skills/cns/vault-think/**`, `~/.hermes/config.yaml`
