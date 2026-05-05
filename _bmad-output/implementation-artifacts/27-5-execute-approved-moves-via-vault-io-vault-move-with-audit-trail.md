# Story 27.5: `vault_move` execution + audit trail (Hermes `/execute-approved`)

**Story key:** `27-5-execute-approved-moves-via-vault-io-vault-move-with-audit-trail`  
**Epic:** 27 (Hermes CNS Inbox triage)  
**Status:** done

**BMAD create-story:** Ultimate context expansion applied 2026-05-04. Normative planning references: FR27 and `vault_move` sequence in `_bmad-output/planning-artifacts/architecture.md` (write pipeline, optional Obsidian CLI); Epic 27 slice is defined in story chain `27-1` through `27-7` under `_bmad-output/implementation-artifacts/`, not a single `epics.md` block.

---

## Story

As an **operator**,
I want **Hermes to execute exactly one approved Inbox move through Vault IO `vault_move`**,
so that **Inbox triage can perform real governed mutations with the existing WriteGate, PAKE validation, wikilink repair, modified timestamp bump, and audit trail**.

---

## Acceptance Criteria

1. **Execution command is explicit and self-contained (AC: execute-command)**
   - **Given** Story 27.4 introduced `/approve <00-Inbox/path.md> --to <destination_dir>/` as non-mutating approval syntax
   - **When** the operator is ready to execute one approved relocation
   - **Then** Hermes documents and handles a single-line command:
     - `/execute-approved <00-Inbox/path.md> --to <destination_dir>/`
   - **And** the command is self-contained: it includes source and destination directory, so Hermes does not need Discord memory or prior message state.

2. **Execution uses `vault_move` only (AC: governed-move)**
   - **Given** a syntactically valid execution command
   - **When** Hermes executes it
   - **Then** Hermes derives `destination_path` as `<destination_dir>/<basename(source_path)>`
   - **And** Hermes calls exactly one mutating Vault IO tool: `vault_move` with `source_path` and `destination_path`
   - **And** Hermes must not call `vault_log_action`, because successful `vault_move` already appends the audit line through the shared audit logger.

3. **Validation remains strict before mutation (AC: validate-before-move)**
   - **Given** the operator posts `/execute-approved`
   - **When** Hermes parses the command
   - **Then** Hermes validates before any mutator call:
     - source starts with `00-Inbox/`
     - source ends with `.md`
     - source has no `..` path segment and is not absolute
     - destination ends with `/`
     - destination is vault-relative, has no `..` path segment, and is not under protected prefixes `AI-Context/` or `_meta/`
   - **And** invalid input produces one bounded error block and no Vault IO calls.

4. **Success response includes audit expectation (AC: success-copy)**
   - **Given** `vault_move` returns success
   - **When** Hermes replies in Discord
   - **Then** the reply includes source, destination path, whether wikilinks were partially repaired, any wikilink repair warnings, and a short note that `vault_move` emitted the audit line in `_meta/logs/agent-log.md`.

5. **Failure response is bounded and fail-closed (AC: failure-copy)**
   - **Given** `vault_move` returns or throws an error
   - **When** Hermes replies in Discord
   - **Then** Hermes reports a short error class/message only, does not retry with filesystem writes, does not call any other mutator, and tells the operator no fallback mutation was attempted.

6. **Discovery remains unchanged (AC: scope-regression)**
   - **Given** `/triage` and `/approve` behavior from Stories 27.1 to 27.4
   - **When** Story 27.5 changes are applied
   - **Then** `/triage` discovery remains scoped under `00-Inbox/`, `/approve` remains non-mutating, and no discard/delete/archive semantics are introduced.

7. **Operator-visible documentation is updated (AC: docs)**
   - **Given** this story enables real mutation
   - **When** the story closes
   - **Then** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` Section 15.3 describes `/execute-approved`, the derived destination path, the `vault_move` audit behavior, and the failure posture.

---

## Tasks / Subtasks

- [x] **Define execution command in skill docs** (AC: execute-command, governed-move, validate-before-move)
  - [x] Update `scripts/hermes-skill-examples/triage/SKILL.md` to bump version and describe Story 27.5 execution.
  - [x] Update `scripts/hermes-skill-examples/triage/references/trigger-pattern.md` with `/execute-approved` grammar and examples.
  - [x] Update `scripts/hermes-skill-examples/triage/references/task-prompt.md` with parse, validation, `destination_path` derivation, one `vault_move` call, and bounded success/failure output.

- [x] **Add regression tests for the prompt contract** (AC: governed-move, success-copy, failure-copy, scope-regression)
  - [x] Update `tests/hermes-triage-skill.test.mjs` to assert version bump, execution grammar, `vault_move` call contract, audit note, failure posture, and `/approve` non-mutation preservation.

- [x] **Standing: operator guide update** (AC: docs)
  - [x] Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` Section 15.3 and Version History.

- [x] **Install Hermes skill mirror for live operator use**
  - [x] Run `bash scripts/install-hermes-skill-triage.sh`.
  - [x] Verify installed `~/.hermes/skills/cns/triage/SKILL.md` reflects the new version.

- [x] **Repo gate**
  - [x] Run `node --test tests/hermes-triage-skill.test.mjs`.
  - [x] Run `bash scripts/verify.sh`.

### Review Findings

- [x] [Review][Patch] Mutating `/execute-approved` grammar did not explicitly reject extra trailing tokens before `vault_move` [scripts/hermes-skill-examples/triage/references/task-prompt.md:104]
- [x] [Review][Patch] Skill metadata still tagged the now-mutating triage skill as `read-only` [scripts/hermes-skill-examples/triage/SKILL.md:9]

---

## Developer context (guardrails)

**What this story is:** Prompt-and-documentation work only. Hermes executes moves **only** by instructing the model (via skill + task prompt) to call MCP **`vault_move`** once after parsing `/execute-approved`. No changes to `src/tools/vault-move.ts`, WriteGate, or audit logger internals.

**Anti-patterns (do not do):**

- Do not add `vault_log_action` after `vault_move` for the same operation (duplicate audit noise; spec intent is `vault_move` owns logging for that mutation per Phase 1 tool description).
- Do not bypass Vault IO with raw `write_file` / shell `mv` for vault notes.
- Do not implement discard, delete, bulk move, or archive (Story **27.6**).
- Do not persist approval state in Discord or files; execution command must stay **self-contained**.

**Reuse instead of reinventing:**

- Move semantics, PAKE, secret scan, wikilink repair: already inside **`vault_move`** (Epic 4 Story 4.7). Hermes only validates Discord-facing grammar then delegates.

---

## Technical requirements

| Requirement | Detail |
|-------------|--------|
| Command | `/execute-approved <vault-relative-00-Inbox-path.md> --to <destination_dir>/` |
| Derivation | `destination_path = destination_dir + basename(source_path)` (POSIX-style join mentally; paths are vault-relative strings per existing prompts) |
| Single mutator | Exactly **one** `vault_move` call per valid command; no other mutators on success path |
| Audit | Success path: rely on **`vault_move`** append to `_meta/logs/agent-log.md`. Do **not** call `vault_log_action` for this move. |
| Discord input | Untrusted: validate shape before any tool call; fail closed with one bounded error block |
| Fail closed | On `vault_move` error: short message, no retry, no filesystem fallback |

---

## Architecture compliance

- **Phase 1 write pipeline:** Single gated path for mutations; `vault_move` uses Obsidian CLI when configured else filesystem move + wikilink rewrite; logs via shared audit logger [Source: `_bmad-output/planning-artifacts/architecture.md` Executive summary + Requirements table].
- **`vault_move` contract:** Input `source_path`, `destination_path`; output includes move metadata and backlink repair info; **Logs action to agent-log.md** [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §tool definitions, `vault_move` block].
- **Mutation audit (Story 5.2):** When touching logging or mutator success paths elsewhere, follow `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`. This story does **not** change server code but must remain consistent with “mutators log on success” semantics.

---

## Library / framework requirements

- **Tests:** Node built-in `node:test` + `node:assert` only (`tests/hermes-triage-skill.test.mjs`). No new npm deps for Story 27.5.
- **Hermes:** Skill markdown under `scripts/hermes-skill-examples/triage/`; install script copies to operator `~/.hermes/skills/cns/triage/`.

---

## File structure requirements

| Area | Paths |
|------|--------|
| Skill mirror (source of truth in repo) | `scripts/hermes-skill-examples/triage/SKILL.md`, `references/task-prompt.md`, `references/trigger-pattern.md` |
| Contract tests | `tests/hermes-triage-skill.test.mjs` |
| Operator guide | `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3, Version History |
| Install | `scripts/install-hermes-skill-triage.sh` |
| Do **not** edit for this story | `src/tools/vault-move.ts`, MCP registration, `specs/cns-vault-contract/AGENTS.md` (unless separate constitution task) |

---

## Testing requirements

1. **Prompt contract tests** must assert (see existing file for exact strings):
   - Skill version bump (currently **1.4.0** in test assertions).
   - Sections: `## Execute approved move handling (Story 27.5)`, `Call **vault_move** exactly once`, `Do not call vault_log_action`, success and failure blocks.
   - Trigger pattern documents `/execute-approved ... --to .../` and destination derivation.
2. **Gate:** `node --test tests/hermes-triage-skill.test.mjs` and `bash scripts/verify.sh` green before marking done.

---

## Previous story intelligence (27.4)

- **27.4** established non-mutating `/approve` with same path validation philosophy (Inbox-only source, directory destination with trailing `/`, no protected destinations). **27.5** adds the **only** mutation path: `/execute-approved` → `vault_move`.
- **Review lesson:** Watch for duplicate YAML keys in `SKILL.md` frontmatter and stale lines that say approvals are disabled after enabling them.

---

## Latest tech / version notes

- No external library upgrades required. Keep Node test style aligned with existing `tests/hermes-triage-skill.test.mjs`.
- If bumping skill version again: update **both** `SKILL.md` frontmatter and **string asserts** in `tests/hermes-triage-skill.test.mjs`.

---

## Project context reference

- No repo-root `project-context.md` found; use `CLAUDE.md`, `AGENTS.md`, and `specs/cns-vault-contract/CNS-Phase-1-Spec.md` for Phase 1 boundaries.

---

## Story completion status

- **Implementation:** Completed 2026-05-04 (skill v1.4.0, tests, operator guide, install script run).
- **Workflow state:** Sprint `development_status` entry `27-5-execute-approved-moves-via-vault-io-vault-move-with-audit-trail`: **done**.
- **Ultimate context engine analysis:** Completed for BMAD create-story (this file).

---

## Dev Notes (legacy concise summary)

### Scope boundaries

- This story enables exactly one real mutation path for Epic 27: `/execute-approved ... --to .../` calling Vault IO `vault_move`.
- Do not change MCP tool signatures, WriteGate, protected path rules, audit logger internals, or `src/tools/vault-move.ts`.
- Do not introduce discard, delete, archive, or bulk move semantics. Story 27.6 owns discard policy.
- Do not persist approval state. The execution command must remain self-contained.

### Security guardrails

- Treat Discord as untrusted input. Validate command shape before calling any tool.
- Source must remain under `00-Inbox/`; destination must be a vault-relative directory outside protected prefixes.
- Rely on `vault_move` for canonical boundary checks, PAKE validation, secret scan, modified timestamp bump, wikilink repair, and audit append.
- Fail closed. If `vault_move` fails, do not attempt raw filesystem writes or compensating moves.

### References

- Story 27.4 approval syntax: `_bmad-output/implementation-artifacts/27-4-discord-approval-interaction-pattern-per-item-approve-override.md`
- Existing triage skill mirror: `scripts/hermes-skill-examples/triage/`
- `vault_move` contract: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- Existing move tests: `tests/vault-io/vault-move.test.ts`
- Hermes MCP governance bridge: `_bmad-output/implementation-artifacts/26-3-hermes-vault-io-mcp-write-path.md`
- Discord surface: `_bmad-output/implementation-artifacts/26-5-hermes-discord-channel-and-bot.md`

---

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes any user-facing behavior: update `03-Resources/CNS-Operator-Guide.md`. Bump `modified` date and add Version History row.
- [x] Done for 27.5.

---

## Dev Agent Record

### Agent Model Used

GPT-5, 2026-05-04

### Debug Log References

- `npm test` (baseline before changes, 2026-05-04) - PASS.
- `node --test tests/hermes-triage-skill.test.mjs` (red phase, 2026-05-04) - FAIL as expected before prompt updates.
- `node --test tests/hermes-triage-skill.test.mjs` (green phase, 2026-05-04) - PASS.
- `bash scripts/install-hermes-skill-triage.sh` (2026-05-04) - PASS, installed skill v1.4.0 to `~/.hermes/skills/cns/triage/`.
- `bash scripts/verify.sh` (2026-05-04) - PASS.

### Completion Notes List

- Skill mirror bumped to **v1.4.0** and now documents `/execute-approved <00-Inbox/path.md> --to <destination_dir>/`.
- `/execute-approved` derives `destination_path` as `<destination_dir>/<basename(source_path)>`, validates source and destination shape, then calls `vault_move` exactly once.
- Prompt contract forbids `vault_log_action` for execution because `vault_move` emits the audit line on success; failures are bounded and do not attempt raw filesystem fallback.
- `/triage` discovery remains scoped under `00-Inbox/`, `/approve` remains non-mutating, and no discard/delete/archive behavior was added.
- Installed Hermes operator copy at `~/.hermes/skills/cns/triage/` now reflects v1.4.0.

### File List

- `_bmad-output/implementation-artifacts/27-5-execute-approved-moves-via-vault-io-vault-move-with-audit-trail.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `scripts/hermes-skill-examples/triage/SKILL.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`
- `tests/hermes-triage-skill.test.mjs`
- `~/.hermes/skills/cns/triage/SKILL.md` (operator install target)
- `~/.hermes/skills/cns/triage/references/task-prompt.md` (operator install target)
- `~/.hermes/skills/cns/triage/references/trigger-pattern.md` (operator install target)
- `~/.hermes/skills/cns/triage/references/config-snippet.md` (operator install target, copied unchanged)

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-04 | Created Story 27.5 and moved implementation to in-progress. |
| 2026-05-04 | Implemented `/execute-approved` prompt contract, tests, operator guide update, Hermes skill install, and moved story to review. |
| 2026-05-04 | BMAD create-story: expanded developer guardrails, architecture/testing/file-structure sections. |
| 2026-05-04 | BMAD code review patched exact-token execution grammar, removed stale read-only metadata tag, verified, and moved story to done. |
