# Story 1.3: Grounding parity checklist

Status: done

## Story

As an **operator**,  
I want **a short checklist documenting one-time MCP and IDE setup for both first-class surfaces**,  
so that **grounding and Vault IO journeys match on Cursor and Claude Code beyond the first open**.

## Acceptance Criteria

1. **Operator-facing doc:** README or operator doc (repo or vault-side path already used in Epic 1) contains a **checklist** covering: one-time MCP configuration for **Cursor** and **Claude Code** on **WSL**, and the steps that align with Story 1.1–1.2 outcomes (constitution load without manual paste, vault-relative paths). No duplicate constitution paste steps beyond what one-time MCP setup requires.

2. **Parity (NFR-I1):** The checklist explicitly states that **both** surfaces follow the same **grounding** and **Vault IO–mediated** journey expectations after one-time setup, and calls out any intentional deltas (if any) in one short subsection.

3. **Time-to-grounded (NFR-P1):** The doc defines a **repeatable observation method** for time-to-grounded spot checks: what to start the stopwatch on (e.g. workspace open or first agent message), what counts as “task-ready” (constitution + MCP tools usable without routing paste), and a simple note that the **median** target is **under 30 seconds** per `prd.md` NFR-P1 (no full benchmark harness required in Phase 1).

4. **Verification gate:** `bash scripts/verify.sh` passes; if the checklist lives in markdown under `specs/` or `_bmad-output/`, add or extend a **lightweight automated check** (e.g. Node test) that required section headings or keywords exist so the checklist cannot silently rot.

## Tasks / Subtasks

- [x] **Choose doc home** (AC: #1)  
  - [x] Extend an existing operator-facing README (prefer `specs/cns-vault-contract/README.md`, `_bmad-output/planning-artifacts/cns-vault-contract/README.md`, or `CLAUDE.md` project pointer) rather than sprawl; one primary checklist location.

- [x] **Write checklist body** (AC: #1, #2, #3)  
  - [x] Cursor: one-time steps (MCP, workspace at vault root, rules if any).  
  - [x] Claude Code on WSL: one-time steps (MCP, vault root, shim from `specs/cns-vault-contract/shims/` as needed).  
  - [x] NFR-I1 parity subsection; NFR-P1 observation rubric (start event, done condition, 30s median reference).

- [x] **Automated guard** (AC: #4)  
  - [x] Add or extend `tests/*.test.mjs` to assert the checklist file(s) contain expected anchors (titles or keywords).  
  - [x] Run `bash scripts/verify.sh` until green.

## Dev Notes

### Architecture compliance

- Documentation and light tests only; no Vault IO server behavior change unless a prior story left a gap. [Source: `architecture.md` — NFR-I1, MCP stdio]

### Project structure notes

- Reuse paths from Stories 1.1–1.2: `specs/cns-vault-contract/AGENTS.md`, `specs/cns-vault-contract/shims/`, `.cursor/rules/` for repo.

### Technical requirements (guardrails)

- **LF** line endings; **no em dashes** in new prose per `AGENTS.md` style rules.

- **Phase 1 scope only:** do not document Phase 2 bridges (Discord, NotebookLM) as required setup.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR-P1, NFR-I1]
- [Source: `_bmad-output/implementation-artifacts/1-2-ide-shims-load-the-constitution.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Completion Notes List

- Canonical operator doc: `specs/cns-vault-contract/README.md` (grounding parity checklist, IDE shim summary, NFR-I1 and NFR-P1 rubric).
- Planning mirror reduced to a pointer to avoid duplicate drift; edits go to specs first.
- Automated guard: `tests/grounding-checklist.test.mjs`.

### File List

- `specs/cns-vault-contract/README.md` (created)
- `_bmad-output/planning-artifacts/cns-vault-contract/README.md` (pointer to specs)
- `tests/grounding-checklist.test.mjs` (created)
- `CLAUDE.md` (Key References: checklist link)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-3 → done)

## Change Log

- 2026-04-01: Story created from epics; sprint set to `ready-for-dev`; Ralph bridge run (`scripts/bmad_to_ralph.py` → `.ralph/specs/1-3-grounding-parity-checklist.md`).
- 2026-04-01: Implemented checklist in `specs/cns-vault-contract/README.md`, tests, verify green; sprint `review`.
- 2026-04-01: BMAD code review complete; minor README punctuation and `CLAUDE.md` EOF fix; sprint `done`.

## Story completion status

- [x] Implementation complete
- [x] Acceptance criteria verified
- [x] File list updated

### Review Findings

BMAD code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). **0** decision-needed, **2** patch (applied), **0** defer, **0** dismissed as noise.

- [x] [Review][Patch] Replace em dash and en dash punctuation in `specs/cns-vault-contract/README.md` for AGENTS style parity (Story Dev Notes).
- [x] [Review][Patch] Add missing newline at end of `CLAUDE.md`.

**Acceptance audit:** AC1 checklist (Cursor and Claude Code on WSL, MCP, shims, no redundant paste steps), AC2 NFR-I1 parity plus intentional deltas, AC3 NFR-P1 start or stop event and under 30s median, AC4 `verify.sh` and `tests/grounding-checklist.test.mjs` guard: all satisfied.
