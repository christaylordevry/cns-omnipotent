# Story 29.2: MEMORY.md schema + session-close integration

Status: done

## Story

As an operator,
I want `MEMORY.md` regenerated on every `/session-close` run using a strict schema and a hard character cap,
so that rolling session learnings stay compact, deterministic, and do not pollute `USER.md` or governed PAKE notes.

## Normative design decisions (locked)

1. **Write path (canonical, operator FS):** `/session-close` must write **directly** to the canonical vault file:
   - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`
   - Do **not** call `vault_create_note` (this is operator-owned Hermes memory, not a governed PAKE note; see existing `MEMORY.md` header).
2. **Overwrite, never append:** `/session-close` must **replace the entire file content** each run.
   - Running `/session-close` twice must produce **byte-identical** output (no doubled sections, no appended blocks).
3. **Schema is exact:** `/session-close` must output **exactly** the template in “MEMORY.md schema (exact output template)” below.
4. **Budget is hard:** Post-run `MEMORY.md` content must be **< 2,000 characters**.

## Data sources for schema population (locked)

- **Epic/story state:** read `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Last 3 decisions:** read canonical vault `AI-Context/AGENTS.md` §8 “### Recent Session Context” (top 3 bullets)
- **Environment facts:** static, hardcoded in the session-close skill (per schema below)
- **Next session line:** read canonical vault `AI-Context/AGENTS.md` §8 “### Current Priorities” item **1**

## Acceptance Criteria

1. The session-close skill has a **new step** that generates `MEMORY.md` using the locked schema and **overwrites** the canonical file at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`.
2. Running `/session-close` twice produces **identical** `MEMORY.md` content (overwrite confirmed, no duplicate sections).
3. Post-run `MEMORY.md` character count is **under 2,000** (record the command and measured count in the Dev Agent Record).
4. The symlink `~/.hermes/memories/MEMORY.md` still resolves to the canonical vault path (record evidence such as `ls -l` output).
5. `MEMORY.md` loads at Hermes cold-start **position 7**, verified by reading `~/.hermes/hermes-agent/run_agent.py` and confirming the `memory_enabled` path loads persistent memory from disk (see `MemoryStore(...).load_from_disk()` in that file).
6. Scope guard: **No changes** to:
   - `AI-Context/USER.md`
   - `AI-Context/AGENTS.md` **§8 structure** (headings and ordering remain the same shape as the session-close spec requires)
   - Any governed vault notes (no new `03-Resources/` notes, no Vault IO mutators introduced for this story)

## Tasks / Subtasks

- [x] Implement MEMORY generation step in session-close (AC: #1, #2, #3)
  - [x] Locate the session-close skill prompt implementation under `scripts/hermes-skill-examples/session-close/` (skill package with `SKILL.md` and `references/task-prompt.md`).
  - [x] Update `scripts/hermes-skill-examples/session-close/references/task-prompt.md` to include a new deterministic step:
    - **Reads**:
      - `<resolved_repo_root>/_bmad-output/implementation-artifacts/sprint-status.yaml`
      - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (only §8, specifically the top of “### Current Priorities” and “### Recent Session Context”)
    - **Writes**:
      - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` (full overwrite)
    - **Hard constraints**:
      - Do not call Vault IO mutators for this memory file.
      - Output must be < 2,000 chars.
      - Output must be deterministic across repeated `/session-close` runs given unchanged inputs.
  - [x] Ensure dry-run behavior stays correct:
    - `/session-close --dry-run` must **not** write `MEMORY.md` (preview-only).
  - [x] Ensure the environment facts section is **static** and matches the locked schema exactly.
  - [x] Ensure the “CNS State” line uses the sprint-status-derived epic state and completed story IDs.

- [x] Verify symlink and limits (AC: #2, #3, #4)
  - [x] Verify overwrite determinism by running `/session-close` twice (or equivalent deterministic execution) and comparing the file bytes.
  - [x] Verify character count under 2,000.
  - [x] Verify `~/.hermes/memories/MEMORY.md` symlink resolves to the canonical vault path.

- [x] Verify Hermes cold-start positioning and memory_enabled path (AC: #5)
  - [x] Confirm Hermes loads persistent memory from disk when `memory_enabled` is true by inspecting `~/.hermes/hermes-agent/run_agent.py`:
    - The agent constructs `MemoryStore(...)` and calls `load_from_disk()` when `memory_enabled` or `user_profile_enabled` is enabled.
  - [x] Confirm “position 7” requirement via Hermes cold-start ordering evidence captured in story record (reference Story 29-0 audit, but re-verify in this story’s Dev Agent Record as needed).

## Dev Notes

### MEMORY.md schema (exact output template)

Session-close must overwrite `AI-Context/MEMORY.md` with **exactly**:

```markdown
## CNS State (auto — /session-close)
Phase 6 active. Epic [N] [status]. Done: [completed story IDs].

## Last Session Decisions
- [decision 1 from AGENTS.md §8 recent context]
- [decision 2]
- [decision 3]

## Environment
- Gateway: manual start required (not systemd)
- SOUL.md: remove after every hermes version/gateway start
- Vault: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/

## Next Session
[Priority 1 from AGENTS.md §8 current priorities]
```

### Determinism rules (must hold)

- The generated output must be **purely derived** from the specified inputs and the hardcoded environment facts.
- Do not include timestamps, random IDs, “today”, or relative language that changes run-to-run.
- “Done: …” must be a stable, sorted, and deterministic list derived from sprint status.

### Required file boundaries and governance posture

- `AI-Context/MEMORY.md` is **operator-owned** (filesystem write) and explicitly says: “operator filesystem only, do not use `vault_create_note`”.
- Do not expand scope into governed PAKE notes or Vault IO mutator behavior.

### Hermes memory load evidence pointers (for AC #5)

- Hermes persistent memory init path in `~/.hermes/hermes-agent/run_agent.py` includes:
  - `_memory_enabled = mem_config.get("memory_enabled", False)`
  - `MemoryStore(...).load_from_disk()`

## References

- Epic 29 story card 29-2: `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md` (see “29-2 — MEMORY.md schema + session-close integration”).
- Session-close skill package:
  - `scripts/hermes-skill-examples/session-close/SKILL.md`
  - `scripts/hermes-skill-examples/session-close/references/task-prompt.md`
- Existing canonical memory header (operator-owned posture): `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`
- Sprint tracker data source: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Hermes memory-enabled load path: `~/.hermes/hermes-agent/run_agent.py`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via governed Vault IO workflow. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used
GPT-5.2 (Cursor)

### Completion date
2026-05-13

### Debug Log References
- Verified Hermes memory-enabled disk load path in `~/.hermes/hermes-agent/run_agent.py` (see lines ~1697–1716: `MemoryStore(...)` + `load_from_disk()` when `memory_enabled` or `user_profile_enabled`).
- Verified cold-start load order evidence for MEMORY snapshot position 7 from Story 29-0 audit (`_bmad-output/implementation-artifacts/29-0-token-audit-and-mcp-always-on-cleanup.audit.md`, “Cold-Start Load Order” list item 7).

### Completion Notes List
- Wrote canonical vault `AI-Context/MEMORY.md` with exact locked schema template populated from real inputs (Epic 29 state and done IDs from `sprint-status.yaml`, last 3 decisions and Priority 1 from `AI-Context/AGENTS.md` §8).
- Added deterministic MEMORY regeneration step (“Step 6.5”) to both session-close task prompts:
  - `~/.hermes/skills/cns/session-close/references/task-prompt.md`
  - `scripts/hermes-skill-examples/session-close/references/task-prompt.md`
  The step overwrites (never appends) and is ordered as the last canonical vault write before NotebookLM fan-out.
- Updated session-close `SKILL.md` (both live and repo mirror) to include deterministic `MEMORY.md` overwrite in the documented sequence.
- Evidence, idempotency: ran overwrite simulation twice, confirmed `byte_identical: True`.
- Evidence, size: `char_count: 1146` after review status close-out (under 2,000).
- Evidence, symlink: `~/.hermes/memories/MEMORY.md` resolves to `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` (see `ls -l` output recorded below).
- Code review: all six ACs passed on 2026-05-13. Accepted out-of-scope documentation change: `03-Resources/CNS-Operator-Guide.md` documents the new `/session-close` memory overwrite step.

### File List
- /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md
- /home/christ/.hermes/skills/cns/session-close/SKILL.md
- /home/christ/.hermes/skills/cns/session-close/references/task-prompt.md
- /home/christ/ai-factory/projects/Omnipotent.md/scripts/hermes-skill-examples/session-close/SKILL.md
- /home/christ/ai-factory/projects/Omnipotent.md/scripts/hermes-skill-examples/session-close/references/task-prompt.md
- /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md

### Verification evidence (commands + outputs)

Idempotency and char count:

```text
byte_identical: True
char_count: 1146
```

Symlink resolution:

```text
lrwxrwxrwx 1 christ christ 75 May  3 21:54 /home/christ/.hermes/memories/MEMORY.md -> /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md
```

Code review verification, 2026-05-13:

```text
npm test: pass
bash scripts/verify.sh: pass
AC harness:
  byte_identical_double_run: true
  actual_matches_expected: true
  char_count: 1146
  byte_count: 1162
  symlink: /home/christ/.hermes/memories/MEMORY.md -> /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md
  cold-start: run_agent.py loads MemoryStore(...).load_from_disk(); MEMORY snapshot is position 7 per 29-0 audit and prompt order around run_agent.py system-prompt assembly.
```
