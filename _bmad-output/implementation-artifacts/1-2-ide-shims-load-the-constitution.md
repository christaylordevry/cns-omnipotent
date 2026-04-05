# Story 1.2: IDE shims load the constitution

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide created. -->

## Story

As an **operator**,  
I want **Cursor and Claude Code to load `AGENTS.md` automatically when I open the vault root**,  
so that **I never manually paste the constitution at session start**.

## Acceptance Criteria

1. **Vault root Claude Code shim:** When an operator copies the provided template to `Knowledge-Vault-ACTIVE/CLAUDE.md`, Claude Code loads the vault constitution via an explicit reference to `AI-Context/AGENTS.md` per `CNS-Phase-1-Spec.md` (FR1). The template text matches the spec table (shim mechanism column for Claude Code).

2. **Vault root Cursor shim:** The repo ships a Cursor-oriented template (`.cursorrules` at vault root **or** `.cursor/rules/*.mdc` under the vault) that points agents at `AI-Context/AGENTS.md` (vault-relative), consistent with the Phase 1 spec distribution table (FR1). Document which option was chosen and why (one paragraph in an existing README, not a new doc tree).

3. **Deploy path clarity:** `specs/cns-vault-contract/` contains a **`shims/`** subdirectory with the authoritative template files for vault deployment (names documented; operator copies or syncs them to the vault root and `.cursor/rules/` as needed). Paths in templates use vault-relative wording the spec expects (`AI-Context/AGENTS.md`).

4. **Implementation repo (this workspace):** Opening this repository in Cursor loads the same constitutional content for agent sessions by adding or updating **repo-local** Cursor rules (for example `.cursor/rules/` `*.mdc`) that reference `specs/cns-vault-contract/AGENTS.md`. Do **not** replace or remove the existing repo-root `CLAUDE.md` (that file is CNS **project** rules for the implementation repo; it is not the vault shim).

5. **Verification gate:** `bash scripts/verify.sh` passes with automated checks that prove: (a) shim templates exist under `specs/cns-vault-contract/shims/`, (b) they reference `AI-Context/AGENTS.md` where appropriate, (c) repo Cursor rules reference the specs mirror path. Extend existing Node tests or add a focused test file (FR28 partial: parity of “constitution available without paste” for this repo’s Cursor surface; full Claude-in-vault remains operator copy + manual smoke).

## Tasks / Subtasks

- [x] **Author vault templates** (AC: #1, #2, #3)  
  - [x] Add `specs/cns-vault-contract/shims/CLAUDE.md` (vault deploy: copy to `Knowledge-Vault-ACTIVE/CLAUDE.md`). Body must instruct Claude Code to load `AI-Context/AGENTS.md` using the mechanism described in `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §4 (Distribution to tools).  
  - [x] Add Cursor template: either `specs/cns-vault-contract/shims/.cursorrules` **or** `specs/cns-vault-contract/shims/cursor-rules/agents.mdc` (and document copy target). Content must make `AI-Context/AGENTS.md` the constitutional source for vault work.

- [x] **Repo Cursor rules** (AC: #4)  
  - [x] Add or update `.cursor/rules/*.mdc` so agents in this repo load `specs/cns-vault-contract/AGENTS.md` (and mention modules path if useful). Prefer `alwaysApply: true` or equivalent so constitution is on by default.  
  - [x] Confirm repo-root `CLAUDE.md` remains the implementation-project rules file; add a one-line clarification there only if needed to avoid operator confusion (optional).

- [x] **Operator documentation** (AC: #2, #3)  
  - [x] Extend an existing README (prefer `_bmad-output/planning-artifacts/cns-vault-contract/README.md` or add a short section to `specs/cns-vault-contract/` via a single `README.md` in that folder if missing) with copy/sync steps: constitution + modules + **shims** from `specs/cns-vault-contract/shims/` into the live vault layout.

- [x] **Automated tests** (AC: #5)  
  - [x] Add or extend `tests/*.test.mjs` to assert template files exist, contain expected path strings, and repo `.cursor/rules` reference `specs/cns-vault-contract/AGENTS.md`.  
  - [x] Run `bash scripts/verify.sh` until green.

## Dev Notes

### Architecture compliance

- Constitution and shims stay **out of Vault IO server code**; this story is templates, Cursor rules, and docs plus tests. [Source: `_bmad-output/planning-artifacts/architecture.md` FR mapping, Constitution load row]

- WSL and vault path reality: templates talk in **vault-relative** paths; the implementation repo may not contain `Knowledge-Vault-ACTIVE/`. [Source: Story 1.1 dev notes]

### Project structure notes

| Artifact | Repo path | Operator deploy target (vault) |
|----------|-----------|--------------------------------|
| Claude shim template | `specs/cns-vault-contract/shims/CLAUDE.md` | `Knowledge-Vault-ACTIVE/CLAUDE.md` |
| Cursor shim template | under `specs/cns-vault-contract/shims/` (see tasks) | vault root `.cursorrules` and/or `Knowledge-Vault-ACTIVE/.cursor/rules/` |
| Live constitution | `specs/cns-vault-contract/AGENTS.md` (mirror) | `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` |
| Repo Cursor load | `.cursor/rules/*.mdc` | N/A (repo only) |

### Technical requirements (guardrails)

- **LF** line endings on new files. [Source: `architecture.md` Formats]

- **No em dashes** in authored markdown per `AGENTS.md` style rules.

- **Phase 1 scope only:** do not add Discord, NotebookLM, daemon, or mobile shim logic.

- **Claude Code include syntax:** follow current Anthropic Claude Code documentation for referencing a file from `CLAUDE.md`; if the spec’s `@AI-Context/AGENTS.md` pattern differs from the tool’s current syntax, prefer **working** inclusion and note the delta in the shim comment header.

### Testing requirements

- Node `node:test` per existing `package.json`; keep tests fast and deterministic (filesystem read + string asserts).

### Previous story intelligence

- Story 1.1 established `specs/cns-vault-contract/AGENTS.md`, modules, constitution tests, and planning/spec mirror parity. Reuse patterns from `tests/constitution.test.mjs`. [Source: `_bmad-output/implementation-artifacts/1-1-constitution-core-and-modular-policy.md`]

### Git intelligence summary

- Constitution and verify gate landed in recent work; extend tests rather than forking patterns.

### Latest tech information

- Cursor rules use `.mdc` with YAML frontmatter (`description`, `alwaysApply`, `globs`). Confirm against Cursor docs in effect for 2026.

### Project context reference

- Phase 1 spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §4 Location and Distribution, and folder diagram with `CLAUDE.md` / `.cursorrules`.

### Open questions (saved for post-story)

- Whether to automate copying shims into a live vault via script (optional; out of scope unless quick).

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §4 Deliverable 2, Distribution table]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Constitution load, FR1–FR3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR1, FR28]
- [Source: `_bmad-output/implementation-artifacts/1-1-constitution-core-and-modular-policy.md`]

## Dev Agent Record

### Agent Model Used

Cursor agent (Composer)

### Debug Log References

- `bash scripts/verify.sh` exit 0 (Story 1.1 + Story 1.2 tests).

### Completion Notes List

- Added vault deploy templates: `specs/cns-vault-contract/shims/CLAUDE.md` (`@AI-Context/AGENTS.md` per Phase 1 spec) and `specs/cns-vault-contract/shims/cursor-rules/agents.mdc` (always-apply Cursor rule for the vault).
- Added repo-local Cursor rule `.cursor/rules/cns-specs-constitution.mdc` pointing at `specs/cns-vault-contract/AGENTS.md` and modules path.
- Clarified repo-root `CLAUDE.md` vs vault shim in `CLAUDE.md` first paragraph.
- Documented copy targets and `.mdc` vs `.cursorrules` rationale in `_bmad-output/planning-artifacts/cns-vault-contract/README.md`.
- Added `tests/shims.test.mjs` for template and repo rule assertions.

### File List

- `specs/cns-vault-contract/shims/CLAUDE.md`
- `specs/cns-vault-contract/shims/cursor-rules/agents.mdc`
- `.cursor/rules/cns-specs-constitution.mdc`
- `tests/shims.test.mjs`
- `CLAUDE.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/README.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-01: Story created from epics; sprint set to `ready-for-dev`; Ralph bridge run (`scripts/bmad_to_ralph.py` → `.ralph/specs/1-2-ide-shims-load-the-constitution.md`).
- 2026-04-02: Story 1.2 implemented; shims, repo Cursor rule, README, tests; verify green; status `review`.
- 2026-04-02: BMAD code review complete; no code changes required; status `done`.

## Story completion status

- [x] Implementation complete
- [x] Acceptance criteria verified
- [x] File list updated

### Review Findings

BMAD code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). **0** decision-needed, **0** patch, **0** defer, **0** dismissed as noise.

**Acceptance audit:** AC1 vault `CLAUDE.md` template with `@AI-Context/AGENTS.md` and spec-aligned mechanism note; AC2 vault Cursor `agents.mdc` plus `.mdc` vs `.cursorrules` rationale in `specs/cns-vault-contract/README.md`; AC3 `specs/cns-vault-contract/shims/` templates and paths; AC4 repo `.cursor/rules/cns-specs-constitution.mdc` and repo-root `CLAUDE.md` remains project rules; AC5 `tests/shims.test.mjs` and `bash scripts/verify.sh` green. No em dash violations in `shims/` templates.

