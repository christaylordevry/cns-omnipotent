# Story 27.7: End-to-end verification — Discord `#hermes` triage → approve → execute → move → audit

**Story key:** `27-7-end-to-end-verification-discord-candidates-approve-moves-audit`  
**Epic:** 27 (Hermes CNS Inbox triage)  
**Status:** done

**BMAD create-story:** Ultimate context expansion applied 2026-05-04. Normative stack: Hermes + Nexus Discord `#hermes`, Vault IO MCP (`CNS_VAULT_ROOT`), triage skill under `~/.hermes/skills/cns/triage/` [Source: `scripts/install-hermes-skill-triage.sh`, `_bmad-output/implementation-artifacts/26-5-hermes-discord-channel-and-bot.md`]. Epic 27 functional slice is Stories **27.1–27.6** in-repo; **27.7** is the **live proof** that the documented command sequence works against the operator vault.

---

## Story

As an **operator**,  
I want **a single reproducible live run in Discord `#hermes` that walks `/triage` → candidate listing → `/approve` → `/execute-approved` → verified vault relocation**,  
so that **Epic 27 is grounded in operator-visible behavior**, **`vault_move` governance is proven**, and **`_meta/logs/agent-log.md` correlates the mutation**.

---

## Acceptance Criteria

1. **Preconditions recorded (AC: preflight)**  
   - **Given** Stories **27.1–27.6** are implemented and the repo gates are green  
   - **When** E2E verification begins  
   - **Then** the operator confirms (in the Dev Agent Record below):  
     - Hermes is running with **`triage` skill bound to `#hermes`** per `~/.hermes/skills/cns/triage/references/config-snippet.md`  
     - Vault IO MCP is available to Hermes with **`CNS_VAULT_ROOT`** pointing at the active **`Knowledge-Vault-ACTIVE`** tree  
     - **`bash scripts/install-hermes-skill-triage.sh`** has been run so `~/.hermes/skills/cns/triage/` matches the repo mirror  
     - Output of **`hermes version`** (or equivalent Hermes build identifier) is captured for the evidence bundle  

2. **Disposable Inbox seed (AC: seed-note)**  
   - **Given** the canonical disposable note path **`00-Inbox/_e2e-27-7-disposable.md`** (fixed name so every run uses the same vault-relative source — repeatable and unambiguous)  
   - **When** the operator prepares verification **before** `/triage`  
   - **Then** if the file is **missing** from **`00-Inbox/`** (e.g. first run or post-cleanup), the operator creates it there with trivial placeholder body (PAKE/frontmatter optional per vault norms); if it **still exists** under **`00-Inbox/`** from a prior attempt, reuse it **or** recreate after housekeeping — **but** the approve/execute steps below **must** use this exact path string  
   - **And** if a previous E2E left the note only under **`destination_path`**, the operator **`vault_move`**s or copies it back to **`00-Inbox/_e2e-27-7-disposable.md`** before starting AC3 so the scripted Discord commands stay literal  
   - **And** destination directory **`--to`** for approve/execute is **vault-relative**, ends with `/`, **not** under forbidden prefixes from Story **27.5** (`AI-Context/`, `_meta/`)

3. **`/triage` lists the candidate (AC: triage-list)**  
   - **Given** the seeded note may appear on the first page or a later page  
   - **When** the operator posts **`/triage`** (and **`/triage --offset <n>`** if needed) in **`#hermes`**  
   - **Then** Hermes replies with the bounded preview contract from Stories **27.1–27.3** (session header, candidate rows including **vault-relative path** + excerpt cap, routing suggestion row, paging footer)  
   - **And** **`00-Inbox/_e2e-27-7-disposable.md`** appears in the listing  

4. **`/approve` is non-mutating (AC: approve-no-move)**  
   - **Given** the candidate path from AC3  
   - **When** the operator posts **`/approve 00-Inbox/_e2e-27-7-disposable.md --to <destination_dir>/`** matching Story **27.4** grammar  
   - **Then** Hermes acknowledges approval **without** calling **`vault_move`** or any other mutator  
   - **And** **`00-Inbox/_e2e-27-7-disposable.md`** **still** exists after this step (filesystem check or `/triage` still lists that path)

5. **`/execute-approved` performs exactly one governed move (AC: execute-move)**  
   - **Given** the same paths as AC4  
   - **When** the operator posts **`/execute-approved 00-Inbox/_e2e-27-7-disposable.md --to <destination_dir>/`**  
   - **Then** Hermes validates per Story **27.5** (four-token command shape, Inbox-only source, `.md`, no `..`, destination trailing `/`, no protected prefixes)  
   - **And** Hermes invokes **`vault_move`** exactly once with derived **`destination_path = <destination_dir>/<basename(source_path>)`**  
   - **And** after success the note exists at **`destination_path`** (basename **`_e2e-27-7-disposable.md`**) and **no longer** at **`00-Inbox/_e2e-27-7-disposable.md`**  

6. **Audit correlation (AC: agent-log)**  
   - **Given** a successful **`vault_move`** per AC5  
   - **When** the operator inspects **`{vaultRoot}/_meta/logs/agent-log.md`**  
   - **Then** there is **at least one new LF-terminated audit line** consistent with governed **`vault_move`** logging [Source: `specs/cns-vault-contract/AGENTS.md` §4 audit trail]  
   - **And** the line’s **`target_path`** (or equivalent path field in the pipe-delimited format) correlates with the **destination** path class used in AC5  

7. **Evidence bundle captured in-repo (AC: evidence)**  
   - **Given** ACs 1–6 pass  
   - **When** the story closes  
   - **Then** this file’s **Dev Agent Record** contains:  
     - **Redacted** Discord proof (message IDs, partial screenshot filenames in workspace assets, or redacted links — **no tokens**)  
     - **`hermes version`** line  
     - Vault-relative **source** **`00-Inbox/_e2e-27-7-disposable.md`**, **destination_dir**, full **destination_path**, and basename **`_e2e-27-7-disposable.md`**  
     - **One** representative **`agent-log.md`** line (truncated/`payload_summary`-safe — **no secrets**, no full note bodies)  
   - **And** optional disposal: operator may **`vault_move`** the disposable note to an archive folder or leave it in place per housekeeping preference (document choice).

8. **Regression gates remain green (AC: repo-gates)**  
   - **Given** Story 27.7 may add **documentation-only** edits (operator guide Version History row, or evidence appendix text)  
   - **When** the branch is ready for **done**  
   - **Then** **`node --test tests/hermes-triage-skill.test.mjs`** passes  
   - **And** **`bash scripts/verify.sh`** passes  

9. **Operator guide acknowledgment (AC: docs-optional)**  
   - **Given** AC7 documents live proof  
   - **When** the maintainer wants vault-local visibility  
   - **Then** add a **short** bullet under **`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`** §15.3 stating Epic **27** E2E verification completed with pointer to this story key — **or** record “Operator guide: no update required” if policy is evidence-in-story-only  

---

## Tasks / Subtasks

- [x] **Preflight checklist** (AC: preflight)  
  - [x] Confirm `#hermes` ↔ `triage` binding and MCP **`CNS_VAULT_ROOT`**.  
  - [x] Install/sync skill: **`bash scripts/install-hermes-skill-triage.sh`**.  
  - [x] Capture **`hermes version`**.

- [x] **Execute live sequence** (AC: seed-note, triage-list, approve-no-move, execute-move, agent-log)  
  - [x] Ensure **`00-Inbox/_e2e-27-7-disposable.md`** exists at **`00-Inbox/`** before `/triage` (create or restore per AC2).  
  - [x] **`/triage`** (and paging if needed) until candidate appears.  
  - [x] **`/approve … --to …/`**; verify file still in Inbox.  
  - [x] **`/execute-approved … --to …/`**; verify file at destination; verify audit line.

- [x] **Record evidence** (AC: evidence, docs-optional)  
  - [x] Paste proof into **Dev Agent Record** (redaction discipline per §15.3 operator guide).  
  - [x] Optionally bump Operator Guide §15.3 + Version History row.

- [x] **Repo gate** (AC: repo-gates)  
  - [x] **`node --test tests/hermes-triage-skill.test.mjs`**  
  - [x] **`bash scripts/verify.sh`**

---

## Developer context (guardrails)

**What this story is:** **Operational / live acceptance**, not new Hermes mutation semantics. Stories **27.4–27.5** already define `/approve` and `/execute-approved`. **27.7** proves them **in Discord** against the real vault and **`agent-log.md`**, using the **fixed** disposable source **`00-Inbox/_e2e-27-7-disposable.md`** so every run matches the same commands and grep targets.

**Anti-patterns (do not do):**

- Do **not** broaden execution beyond **one** **`vault_move`** or relax Story **27.5** validation to “make E2E easier”.  
- Do **not** commit Discord tokens, `.env` bodies, or raw **`payload_summary`** blobs that could leak note content.  
- Do **not** treat Nexus filesystem shortcuts as a substitute for **`vault_move`** audit correlation — success must be **Vault IO** path.

**Reuse:**

- Command grammar + refusal semantics: `scripts/hermes-skill-examples/triage/references/task-prompt.md`.  
- Operator-facing summary: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3.  
- Evidence pattern: `_bmad-output/implementation-artifacts/26-6-url-ingest-hermes-vault.md` (E2E proof discipline).

---

## Technical requirements

| Requirement | Detail |
|-------------|--------|
| Channel | Discord **`#hermes`** (Nexus / Hermes deployment per Epic **26**) |
| Commands | **`/triage`** → **`/approve 00-Inbox/_e2e-27-7-disposable.md --to <dir>/`** → **`/execute-approved 00-Inbox/_e2e-27-7-disposable.md --to <dir>/`** |
| Mutation | Exactly **one** **`vault_move`** on execute path; **no** **`vault_log_action`** for that move (Story **27.5**) |
| Audit | **`_meta/logs/agent-log.md`** append on successful **`vault_move`** |
| Evidence | Redacted Discord refs + **`hermes version`** + vault paths + one audit line excerpt |

---

## Previous story intelligence (27.6)

- Story **27.6** explicitly **excluded** full Discord E2E scope (**AC: no-e2e-scope**); **27.7** owns that scope now.  
- Discard/delete vocabulary must remain safety-mapped; E2E should **not** demo deletion — only **governed relocation**.

---

## Project structure notes

- Repo mirror: **`scripts/hermes-skill-examples/triage/`**  
- Installed skill: **`~/.hermes/skills/cns/triage/`**  
- Sprint tracking key must match **`27-7-end-to-end-verification-discord-candidates-approve-moves-audit`**.

---

## References

- Story chain: `27-1` … `27-6` under `_bmad-output/implementation-artifacts/`  
- Hermes Discord / bot context: `_bmad-output/implementation-artifacts/26-5-hermes-discord-channel-and-bot.md`  
- E2E evidence example: `_bmad-output/implementation-artifacts/26-6-url-ingest-hermes-vault.md` § E2E operator proof  
- Audit format: `specs/cns-vault-contract/AGENTS.md` §4  
- Install helper: `scripts/install-hermes-skill-triage.sh`

---

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If maintaining vault-visible proof: add §15.3 bullet + Version History row — **or** note “Operator guide: no update required” in Dev Agent Record.

---

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor)

### Debug Log References

- `hermes version`: `Hermes Agent v0.12.0 (2026.4.30)`
- Repo gates: `node --test tests/hermes-triage-skill.test.mjs` ✅, `bash scripts/verify.sh` ✅

### Completion Notes List

- ✅ E2E complete in Discord `#hermes`: `/triage` listed the seeded candidate, `/approve` acknowledged without mutation, `/execute-approved` triggered governed `vault_move` via Vault IO MCP.
- Source: `00-Inbox/_e2e-27-7-disposable.md`
- destination_dir: `03-Resources/`
- destination_path: `03-Resources/_e2e-27-7-disposable.md`
- Audit correlation: operator confirmed a new line in `{vaultRoot}/_meta/logs/agent-log.md` consistent with governed move logging:
  - `[2026-05-05T14:11:05.579Z] | move | vault_move | mcp | … | target_path=03-Resources/_e2e-27-7-disposable.md | …`
- Discord proof (redacted): screenshot captured in workspace assets:
  - `assets/c__Users_Christopher_Taylor_AppData_Roaming_Cursor_User_workspaceStorage_85cade0691566ddb22d472d60b1012bb_images_image-15e1b422-05f3-49da-a06e-509bdf18b267.png`
- WriteGate posture confirmed: invalid frontmatter was blocked, then Hermes self-corrected via `vault_update_frontmatter` before re-attempting the move.
- Known gap (operational): `/approve` is stateless across Discord messages (no session state).
- Operator guide: updated (see `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3 and Version History).

### File List

- `_bmad-output/implementation-artifacts/27-7-end-to-end-verification-discord-candidates-approve-moves-audit.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/cns-session-handoff-2026-05-05.md`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-04 | Story 27.7 created (live Discord E2E verification: `/triage` → `/approve` → `/execute-approved` → move → `agent-log.md`); sprint status → ready-for-dev. |
| 2026-05-04 | AC2 tightened: fixed disposable path **`00-Inbox/_e2e-27-7-disposable.md`**; AC3–AC5, tasks, and technical table aligned to literal path. |
| 2026-05-05 | Dev run started; repo gates verified locally; HALT recorded because Hermes reports Discord not configured (cannot perform live `#hermes` E2E in this environment). |
| 2026-05-05 | Operator ran Discord `#hermes` E2E: `/triage` → `/approve` → `/execute-approved` moved `00-Inbox/_e2e-27-7-disposable.md` → `03-Resources/_e2e-27-7-disposable.md`; audit line confirmed in `_meta/logs/agent-log.md`; evidence recorded and story marked done. |
