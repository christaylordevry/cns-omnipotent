# Story 29.1: USER.md — write and wire operator identity

Status: complete

## Story

As an operator,
I want stable, human-edited `USER.md` within a hard cap of 1200 characters,
so that Hermes cold-start position 8 reflects durable identity without drift.

## Acceptance Criteria

1. `AI-Context/USER.md` (canonical file in the Obsidian vault) contains **exactly** the pre-approved content in **“USER.md content (exact)”** below, with **LF** line endings.
2. The `AI-Context/USER.md` content is verified to be **under 1,200 characters** (record the command used and the resulting character count in the Dev Agent Record).
3. The symlink `~/.hermes/memories/USER.md` → the vault `AI-Context/USER.md` path is confirmed intact (record evidence: `ls -l` output or equivalent).
4. Scope guard: **No modifications** are made to `MEMORY.md` or any `AGENTS.md` file(s) as part of this story. **USER.md only.**

## Tasks / Subtasks

- [x] Write canonical USER file (AC: #1, #4)
  - [x] Ensure target file is the **vault canonical** file: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/USER.md`
  - [x] Write **exact** content (verbatim) from “USER.md content (exact)”
  - [x] Ensure **LF** line endings (no CRLF)
  - [x] Verify **no other files** were touched/modified (especially `AI-Context/MEMORY.md`, any `AGENTS.md`)

- [x] Verify character count under cap (AC: #2)
  - [x] Measure character count (recommended: `python -c 'import pathlib; p=\"/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/USER.md\"; print(len(pathlib.Path(p).read_text(encoding=\"utf-8\")))'` or `wc -m`)
  - [x] Record the exact count and command in Dev Agent Record

- [x] Verify Hermes memory symlink (AC: #3)
  - [x] Confirm `~/.hermes/memories/USER.md` is a symlink to the canonical vault file
  - [x] Record evidence in Dev Agent Record

## Dev Notes

- **Source of truth**: `AI-Context/USER.md` is the Hermes-layer operator identity artifact. The repo’s `src/agents/operator-context.ts` may document defaults, but it is not the canonical identity for Hermes once wired.
- **Environment constraints** (must be respected in the file content and verification):
  - WSL2 on Windows host
  - Vault path: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/`
  - Repo path: `/home/christ/ai-factory/projects/Omnipotent.md`
  - Use POSIX paths in WSL2
  - Enforce LF line endings for all writes
- **Do not** introduce secrets or credentials into `USER.md`.

### USER.md content (exact)

```markdown
# Hermes User Context (Stable)

**Identity:** Chris Taylor | Sydney (UTC+10/11) | Creative Technologist & AI Systems Builder
**Tracks:** Escape Job, Build Agency | Solo operator, building in public

**Environment:**
- WSL2 on Win host; Vault at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/`
- Repo: `/home/christ/ai-factory/projects/Omnipotent.md`
- Always use POSIX paths in WSL2; enforce LF line endings on all file writes

**Working Style:**
- Ship-oriented (done > perfect), iterative increments, verify before advancing
- Zero preamble, no filler, highly concise
- Flag blockers early with a proposed path forward
- If ambiguous: ask exactly ONE focused clarifying question

**Code & Output:**
- Prefer concise diffs over full file rewrites unless full context is required
- Short responses default; expand only when complexity demands it

**Toolchain:**
- Dev: Claude Code / Cursor (Omnipotent.md)
- Runtime: Hermes (Discord surface via Nexus)
- Long context: Gemini CLI | Synthesis: NotebookLM
- Vault: Obsidian (Knowledge-Vault-ACTIVE)
```

### References

- Epic 29 planning artifact story card 29-1 (persona + baseline AC): `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md` (see “29-1 — USER.md — write and wire operator identity”).

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

Completion date: 2026-05-13

### Debug Log References

### Completion Notes List

- [x] Operator guide: no update required
- [x] Char count verified: 1056 chars, LF (under 1200)
- [x] Symlink verified: symlink resolves correctly to canonical vault path
- [x] Scope guard confirmed: no `MEMORY.md` or `AGENTS.md` edits

Wrote USER.md content (1056 chars, LF) to canonical vault path AI-Context/USER.md. Verified char count under 1200, symlink resolves correctly, scope guard honored.

### File List

- [x] `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/USER.md` (written/updated)
