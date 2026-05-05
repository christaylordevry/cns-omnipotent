# Story 27.4: Discord approval interaction pattern (per-item approve + override)

Status: done

## Story

As an **operator**,
I want **a safe, explicit, per-item approval interaction pattern in Discord for `/triage` candidates (including optional destination override)**,
so that **I can mark specific Inbox notes as “approved to move” without Hermes mutating anything yet**, and later stories can execute those approved moves deterministically.

## Acceptance Criteria

1. **Per-item approval command exists (AC: approve-command)**
   - **Given** Hermes has posted a `/triage` candidate list in `#hermes`
   - **When** the operator wants to approve exactly one candidate for later relocation
   - **Then** there is a documented Discord command pattern the operator can post (single-line) that:
     - references **exactly one** candidate (by number and/or path)
     - includes the **destination directory** Hermes should later move it to
     - optionally allows an **override destination** different from the routing suggestion
   - **And** the approval pattern is **self-contained** (does not require Hermes to persist state between messages to interpret it correctly).

2. **Approval is non-mutating and explicit (AC: no-mutation)**
   - **Given** the operator posts an approval command
   - **When** Hermes handles it
   - **Then** Hermes performs **no vault mutations** (no `vault_move`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_log_action`)
   - **And** Hermes replies with a clear acknowledgment that the item is **approved for later execution only**, and that **no actions were taken**.

3. **Approval validation and refusal rules (AC: validate)**
   - **Given** the operator posts an approval command
   - **When** Hermes parses it
   - **Then** Hermes validates:
     - the referenced candidate path is **vault-relative** and under **`00-Inbox/`**
     - the destination is a **vault-relative directory** (must end with `/`)
     - the destination is **not** under protected paths (`AI-Context/`, `_meta/`, etc.)
   - **And** invalid approval commands produce a **single, bounded error** message and stop (no Vault IO calls required).

4. **No change to discovery scope (AC: scope)**
   - **Given** `/triage` candidate discovery and preview behavior from Stories 27.1–27.3
   - **When** Story 27.4 changes are applied
   - **Then** discovery and previews remain scoped **at or under `00-Inbox/` only**, and the paging + optional `vault_search` contract remains unchanged.

5. **Operator-visible documentation is updated (AC: docs)**
   - **Given** this story introduces a new operator interaction pattern
   - **When** the story closes
   - **Then** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3 (Hermes triage) is updated to describe:
     - the approval command(s)
     - what “approved” means in Story 27.4 (non-mutating)
     - how overrides work
     - the explicit “execution comes later (27.5)” warning

## Tasks / Subtasks

- [x] **Define approval interaction pattern in skill docs** (AC: approve-command, validate, no-mutation)
  - [x] Update `scripts/hermes-skill-examples/triage/references/trigger-pattern.md` with a canonical approval grammar (single-line).
  - [x] Update `scripts/hermes-skill-examples/triage/references/task-prompt.md` to:
    - [x] remove/replace the “No approvals” hard constraint
    - [x] define parsing + validation rules for approval commands
    - [x] specify the exact acknowledgment/error output blocks
    - [x] specify how overrides are expressed and how destination strings are normalized
  - [x] Update `scripts/hermes-skill-examples/triage/SKILL.md` to bump version and reflect approvals now supported (still non-mutating).

- [x] **Add regression tests for the prompt contract** (AC: scope, validate, approve-command)
  - [x] Update `tests/hermes-triage-skill.test.mjs` to assert:
    - [x] approval grammar is documented
    - [x] non-mutation tool forbiddance remains present
    - [x] validation rules exist (Inbox-only source, protected-path destination refusal)
    - [x] discovery/paging/search rules are unchanged (still scoped to `00-Inbox/`, cap 50)

- [x] **Standing: operator guide update** (AC: docs)
  - [x] Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3 + Version History row.

- [x] **Repo gate** (standing)
  - [x] Run `node --test tests/hermes-triage-skill.test.mjs`
  - [x] Run `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] `SKILL.md` frontmatter has duplicate `description` keys [scripts/hermes-skill-examples/triage/SKILL.md:3]
- [x] [Review][Patch] `/triage` reply notes still say approvals are not enabled in Story 27.4 [scripts/hermes-skill-examples/triage/references/task-prompt.md:258]

## Dev Notes

### Scope boundaries

- Story 27.4 is **interaction pattern only**. It must **not** implement:
  - execution of moves (`vault_move`) or audit behavior (Story 27.5)
  - discard semantics (Story 27.6)
  - any new discovery outside `00-Inbox/` (keep NFR-P2 posture)
- Approvals must be **self-contained** so the model does not need to remember a prior message; assume Discord history may be unavailable/ambiguous.

### Security guardrails

- Treat Discord as untrusted input; approval parsing must be strict and bounded.
- Keep approval commands safe-by-construction:
  - source path must be under `00-Inbox/`
  - destination must be vault-relative and must not target protected paths
  - no execution in 27.4

### References

- Existing triage prompt contract: `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- Existing triggers: `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`
- Prior stories: `_bmad-output/implementation-artifacts/27-1-*.md`, `27-2-*.md`, `27-3-*.md`
- Hermes Discord surface context: `_bmad-output/implementation-artifacts/26-5-hermes-discord-channel-and-bot.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor), 2026-05-04

### Debug Log References

- `node --test tests/hermes-triage-skill.test.mjs` (2026-05-04) — PASS.
- `bash scripts/verify.sh` (2026-05-04) — PASS.

### Completion Notes List

- Skill prompt contract bumped to **v1.3.0** and now supports a **self-contained, non-mutating** per-item approval command: `/approve <00-Inbox/path.md> --to <destination_dir>/`.
- `/approve` validates Inbox-only source paths and refuses protected destinations (`AI-Context/`, `_meta/`) with a single bounded error message; on success it acknowledges “approved for later execution only; no actions taken”.
- `/triage` discovery/paging/search contract remains unchanged: recursive `vault_list` under `00-Inbox/`, optional `vault_search` only with explicit query and `scope: "00-Inbox/"`, `max_results` ≤ 50.
- Operator guide updated (§15.3 + Version History row **1.19.0**) to document `/approve` and override mechanics.

### File List

- `_bmad-output/implementation-artifacts/27-4-discord-approval-interaction-pattern-per-item-approve-override.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `scripts/hermes-skill-examples/triage/SKILL.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`
- `tests/hermes-triage-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-04 | Defined non-mutating `/approve` interaction pattern (docs + tests), updated operator guide, verified repo gate, and marked story `review`. |
