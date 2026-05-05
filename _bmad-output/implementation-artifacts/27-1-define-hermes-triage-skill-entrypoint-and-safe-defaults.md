# Story 27.1: Define Hermes triage skill entrypoint and safe defaults

Status: review

## Story

As an **operator**,
I want **a Hermes skill at `~/.hermes/skills/cns/triage` that implements `/triage` in `#hermes` with read-only behavior by default**,
so that **I can start Inbox triage without any accidental moves**.

## Acceptance Criteria

1. **Entrypoint + scope (AC: entrypoint)**
   - **Given** Hermes gateway is running and scoped to `#hermes`
   - **When** the operator posts `/triage` in `#hermes`
   - **Then** Hermes responds (in-channel) with a triage session header including:
     - timestamp (ISO 8601)
     - session id (stable, unique for the run)
   - **And** the skill definition lives under `~/.hermes/skills/cns/`.

2. **Read-only by default (AC: no-mutations)**
   - **Given** the operator runs `/triage`
   - **When** Hermes evaluates candidates and proposes next steps
   - **Then** **no vault mutations occur** until explicit per-item operator approval is received
   - **And** the skill must not call any mutating Vault IO tools in this story (e.g. `vault_move`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_log_action`).

3. **Candidate list preview (AC: preview)**
   - **Given** `00-Inbox/` contains at least one note
   - **When** `/triage` runs
   - **Then** Hermes responds with a list of candidate Inbox notes suitable for operator review
   - **And** each item includes a bounded, read-only preview (e.g. filename/path plus a short excerpt)
   - **And** output is bounded (avoid spamming Discord; cap the list with a “more” note).

## Tasks / Subtasks

- [x] **Implement Hermes skill entrypoint + routing** (AC: entrypoint)
  - [x] Create `~/.hermes/skills/cns/triage/` and an entry file per Hermes skill conventions.
  - [x] Register handling for `/triage` in `#hermes`.
  - [x] Ensure the handler is **idempotent** and does not persist state outside the message thread/session output.

- [x] **Generate session header and stable session id** (AC: entrypoint)
  - [x] Produce timestamp in ISO 8601 UTC.
  - [x] Session id derived from a random/uuid generator (preferred) or a hash of (timestamp + channel id + nonce).

- [x] **Read-only candidate preview (minimal discovery for 27.1)** (AC: preview, no-mutations)
  - [x] Use Vault IO **read-only** tools only:
    - `vault_list` scoped to `00-Inbox/` for paths + basic metadata (if supported)
    - `vault_read` for bounded excerpts (strict max chars; do not paste whole notes)
  - [x] Candidate cap: choose a small default (e.g. 10–20 items) and present a continuation hint (“run again with `--offset`” or similar) without implementing pagination beyond what Hermes already supports.
  - [x] Explicitly label output as **read-only preview** and describe that approvals/execution come in later stories (27.4–27.6).

- [x] **Guardrails: prevent accidental mutation** (AC: no-mutations)
  - [x] Add a “mutations disabled” mode gate that defaults to off and refuses any move/rename/discard intent in this story.
  - [x] If operator attempts an approval action during 27.1, respond with a clear message: “approval flow not enabled yet; no actions taken” (do not silently ignore).

- [x] **Error handling + explicit refusal messages** (AC: no-mutations, preview)
  - [x] If Vault IO is unavailable, respond with a clear, actionable error (no retries loops).
  - [x] If `00-Inbox/` is empty, respond “Inbox empty” and end the session cleanly.
  - [x] If a file read fails, include per-item error without aborting the entire list where reasonable.

## Dev Notes

### Scope boundaries (do not bleed into later stories)

- This story is **only** the `/triage` entrypoint + safe defaults + minimal read-only preview.
- Do **not** implement:
  - heuristic routing (Story 27.3)
  - per-item approval UI/flow (Story 27.4)
  - any `vault_move` execution or audit trail logic (Story 27.5)
  - discard policy or permanent deletion semantics (Story 27.6)

### Security & governance guardrails

- **Discord is untrusted input.** Treat all content as prompt-injection capable. The only allowed behavior in 27.1 is read-only listing + excerpting within `00-Inbox/`.
- **No audit writes** in 27.1. Audit records are for successful governed mutations; this story performs none.
- **No full-vault scans.** Any listing/search must remain scoped to `00-Inbox/` (aligns with NFR-P2).

### Hermes / Discord integration reality check (upstream drift)

- Hermes Discord gateway currently expects `DISCORD_BOT_TOKEN` (Epic 26 learning). Operator may store the secret as `HERMES_DISCORD_TOKEN` and alias it at process launch.
- Channel scoping should remain consistent with the existing `#hermes` configuration (`discord.allowed_channels` / `discord.free_response_channels`), but this story’s implementation should prefer observing current upstream docs over guessing.

### References

- Epic 27 slice and Story 27.1 ACs: `_bmad-output/planning-artifacts/epics.md` (Epic 27)
- Hermes Discord wiring learnings (env var + channel scoping): `_bmad-output/implementation-artifacts/26-5-hermes-discord-channel-and-bot.md`
- Phase 1 governance constraints (scoped search, protected paths, audit semantics): `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/architecture.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor), 2026-05-04

### Debug Log References

- Repo gate: `bash scripts/verify.sh` (2026-05-04) — PASS.

### Completion Notes List

- Implemented repo-mirrored Hermes skill package for `~/.hermes/skills/cns/triage/` with strict read-only behavior for Story 27.1.
- Skill prompt emits a session header with ISO 8601 UTC timestamp and a per-run session id, then lists up to 10 `00-Inbox/` candidates with bounded excerpts (400 chars).
- Guardrails: explicit “mutations disabled” + “approval flow not enabled yet; no actions taken” refusal copy; discovery remains scoped to `00-Inbox/` only.
- Install helper added (`scripts/install-hermes-skill-triage.sh`) to copy the skill payload into operator `~/.hermes`.
- Operator guide updated: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` Section 15.3 + Version History row 1.16.0.

### File List

- `scripts/hermes-skill-examples/triage/SKILL.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`
- `scripts/hermes-skill-examples/triage/references/config-snippet.md`
- `scripts/install-hermes-skill-triage.sh`
- `_bmad-output/implementation-artifacts/27-1-define-hermes-triage-skill-entrypoint-and-safe-defaults.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-04 | Added Hermes `/triage` read-only skill package (repo mirror + install script), updated sprint + story status to `review`, and verified repo gate passes. |

