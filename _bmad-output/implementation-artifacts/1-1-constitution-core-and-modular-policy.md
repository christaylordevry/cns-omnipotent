# Story 1.1: Constitution core and modular policy

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide created. -->

## Story

As a **maintainer**,  
I want **a core `AGENTS.md` constitution with bounded modules for extra policy**,  
so that **agents get universal rules and I can extend behavior without blowing the line budget**.

## Acceptance Criteria

1. **Given** the active vault’s `AI-Context/` tree exists per folder contract **when** a maintainer adds or edits a linked module file referenced from the core constitution **then** the next agent session can follow updated guidance by reading those files (no reliance on pasting the full policy into chat) **and** the linkage from core to modules is explicit (table or short list with vault-relative paths). (FR2, FR3)

2. **Core line budget:** `AGENTS.md` is **at most 500 lines** (UTF-8, LF). If content would exceed the budget, **extract** to `AI-Context/modules/*.md` and leave only summaries plus pointers in the core file. [Source: `_bmad-output/planning-artifacts/cns-vault-contract/CNS-Phase-1-Spec.md` §4 Deliverable 2]

3. **Progressive disclosure:** Core file remains the **map** (sections 1–7 per spec outline); modules hold **extended** Vault IO and security (and future domain) detail. Tool-agnostic Markdown; no surface-specific hacks inside the constitution body. [Source: same §4]

4. **Repo normative mirror:** `specs/cns-vault-contract/AGENTS.md` exists in this repository and matches the vault-deployable content (or documents one-way sync if the vault is canonical elsewhere). [Source: `CLAUDE.md` Key References]

5. **Phase 1 checklist alignment:** At least **`vault-io.md` or `security.md`** exists under the modules location that deploys to `AI-Context/modules/` (see File Structure). Content is non-placeholder enough that an agent could follow read/write and secrets guidance from the module alone when the task demands it. [Source: `CNS-Phase-1-Spec.md` acceptance checklist]

## Tasks / Subtasks

- [x] **Inventory and line-count** (AC: #2)  
  - [x] Baseline: `wc -l` on core `AGENTS.md` candidate (start from `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` if no `specs/` copy yet).

- [x] **Create `specs/cns-vault-contract/` tree** (AC: #4, #5)  
  - [x] Add `specs/cns-vault-contract/AGENTS.md`.  
  - [x] Add `specs/cns-vault-contract/modules/vault-io.md` and `specs/cns-vault-contract/modules/security.md` (deploy to `Knowledge-Vault-ACTIVE/AI-Context/modules/`).

- [x] **Modularize** (AC: #1, #2, #3)  
  - [x] Move or refactor **detailed** Vault IO protocol from core into `vault-io.md`; leave a short “when to load” blurb + pointer in core §4 (or equivalent).  
  - [x] Move or refactor **detailed** security / secrets guidance into `security.md`; leave hard limits summary in core §5 if spec requires universal visibility.  
  - [x] Keep core §6 **Active Modules** table accurate (paths must read `AI-Context/modules/...` for vault-relative truth).

- [x] **Verify** (AC: #2, #3)  
  - [x] `AGENTS.md` ≤ 500 lines after edits.  
  - [x] Section outline still covers: System Identity, Vault Map, Formatting Standards, Vault IO (summary + pointer), Security (summary + pointer), Active Modules, Current Focus, Changelog or version footer as appropriate. [Source: `CNS-Phase-1-Spec.md` §4]

- [x] **Operator note (optional but recommended)**  
  - [x] One short note in an existing doc (e.g. `specs/cns-vault-contract/README.md` only if it already exists, or `_bmad-output/planning-artifacts/cns-vault-contract/README.md`) describing copy/sync from `specs/cns-vault-contract/` to `Knowledge-Vault-ACTIVE/AI-Context/` — do **not** create new markdown files unless the repo already uses that pattern for this feature; prefer a sentence in an existing README.

## Dev Notes

### Architecture compliance

- Constitution and shims are **out of Vault IO code**; this story is **markdown + repo layout**, not TypeScript. [Source: `_bmad-output/planning-artifacts/architecture.md` FR mapping table]

- **Evolution protocol:** Universal rules in core; domain-specific depth in modules; new module = new file + **one line** pointer in core; commit message convention `cns: [update|add-module|refine] <description>`. [Source: `CNS-Phase-1-Spec.md` §4]

### Project structure notes

| Artifact | Repo path (normative for git) | Deploy path (vault) |
|----------|-------------------------------|---------------------|
| Constitution | `specs/cns-vault-contract/AGENTS.md` | `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` |
| Modules | `specs/cns-vault-contract/modules/*.md` | `Knowledge-Vault-ACTIVE/AI-Context/modules/*.md` |

- This repo may **not** contain `Knowledge-Vault-ACTIVE/`; treat it as **runtime** vault root. Do not invent a full vault unless a story explicitly requires it.

- **Planning artifact** `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` is a strong reference copy; reconcile with `specs/` so CLAUDE.md references stay true.

### Technical requirements (guardrails)

- **Line endings:** LF only on written files. [Source: `architecture.md` Formats]

- **Style:** Respect existing constitution rules (e.g. no em dash rule in current `AGENTS.md`) when editing prose.

- **Do not** move Phase 2/3 scope into modules as if it were active (Discord, NotebookLM, daemon, mobile stay in parking lot / defer sections).

### Testing requirements

- No automated test gate for this story unless `scripts/verify.sh` already includes markdown or line-count checks (unlikely). **Manual checks:** `wc -l specs/cns-vault-contract/AGENTS.md`; open module links paths for consistency.

### Previous story intelligence

- *N/A* (first story in Epic 1.)

### Git intelligence summary

- Recent history: single initial import commit; no prior constitution refactor patterns in git.

### Latest tech information

- Not applicable (static Markdown). MCP/SDK versions matter for Epic 3+, not this story.

### Project context reference

- No `project-context.md` found in repo; use `CLAUDE.md`, `CNS-Phase-1-Spec.md`, and `architecture.md` as authority.

### Open questions (saved for post-story)

- Whether to automate sync (symlink, script, or manual) between `specs/cns-vault-contract/` and a live vault on the operator machine.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1]
- [Source: `_bmad-output/planning-artifacts/cns-vault-contract/CNS-Phase-1-Spec.md` §4]
- [Source: `_bmad-output/planning-artifacts/prd.md` — MVP bullet on AGENTS.md + modularization]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Constitution out of MCP code; repo `specs/` layout]
- [Source: `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` — current full draft]

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude) for implementation; code-review pass: Composer (separate session), BMAD code-review workflow (Blind / edge / acceptance layers).

### Debug Log References

- `bash scripts/verify.sh` exit 0 after `npm test` (Node `node:test`).

### Completion Notes List

- Added `specs/cns-vault-contract/AGENTS.md` (v1.1.0, progressive disclosure) and modules `vault-io.md`, `security.md`.
- Synced `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` to match specs mirror byte-for-byte.
- Copied `CNS-Phase-1-Spec.md` into `specs/cns-vault-contract/` so `CLAUDE.md` paths resolve.
- Extended `_bmad-output/planning-artifacts/cns-vault-contract/README.md` with deploy/sync instructions.
- Added `package.json` and `tests/constitution.test.mjs` so `scripts/verify.sh` runs a real test gate (was failing on day-0 with no `package.json`).

### File List

- `specs/cns-vault-contract/AGENTS.md`
- `specs/cns-vault-contract/modules/vault-io.md`
- `specs/cns-vault-contract/modules/security.md`
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/README.md`
- `package.json`
- `tests/constitution.test.mjs`

## Change Log

- 2026-04-01: Story 1.1 implemented; constitution modularized; verify gate green via constitution tests.
- 2026-04-01: BMAD code-review (adversarial, edge-case, acceptance layers); clean review; sprint status set to `done`.

### Code review summary (BMAD)

- **Story key:** `1-1-constitution-core-and-modular-policy`
- **Layers:** Blind Hunter (diff-or-equivalent file review), Edge Case Hunter (tests and boundaries), Acceptance Auditor (AC 1 to 5 vs `specs/` + `tests/constitution.test.mjs`).
- **Outcome:** No `decision-needed` or `patch` items; minor observations dismissed (for example: optional stronger assertions for `security.md` headings; CNS spec lists seven numbered sections while core adds §8 Agent Behavior and Changelog, consistent with story checklist and companion-file evolution).
- **Verify:** `bash scripts/verify.sh` exit 0 at review time.

## Story completion status

- [x] Implementation complete
- [x] Acceptance criteria verified
- [x] File list updated
