# Story 2.1: Per-directory manifests for the folder contract

Status: review

<!-- Ultimate context engine analysis pending: story context created, ready for dev. -->

## Story

As an **operator**,  
I want `_README.md` manifests in each contract directory to state purpose, allowed note types, naming expectations, and routing rules,  
so that **humans and agents share one map of the vault** and can place or move work correctly without improvising paths.

## Acceptance Criteria

1. **Contract-derived manifests:**  
   Given the Phase 1 folder contract from `specs/cns-vault-contract/CNS-Phase-1-Spec.md`,  
   when `_README.md` manifests are created for each governed directory,  
   then each manifest includes purpose, schema requirements (where relevant), allowed PAKE types, and naming_convention in an agent-readable way. (FR4, FR5)

2. **Routing-aligned type policy:**  
   Given the routing rules in `specs/cns-vault-contract/AGENTS.md` (Vault Map + Routing Rules),  
   when manifests describe where each PAKE note type goes by default,  
   then the allowed_pake_types and “what goes here” guidance are consistent with Vault IO placement expectations (outside Inbox). (FR5)

3. **Spec parity gap tracking:**  
   Given the manifests are authored,  
   when you review gaps against `CNS-Phase-1-Spec.md` directory contract obligations,  
   then any missing/ambiguous elements are explicitly called out for follow-up so future refinement does not silently drift from FR4. (FR4)

## Tasks / Subtasks

- [x] Create contract `_README.md` manifests (agent-readable)
  - [x] `00-Inbox/_README.md`
    - [x] `schema_required: false`
    - [x] `allowed_pake_types: any`
    - [x] `naming_convention: any Obsidian-friendly .md name; triage later applies PAKE standard when moved out of Inbox`
    - [x] Document Inbox exception: raw capture, triage destination, and “no schema enforcement on initial create” expectation.
    - [x] Document `Frontmatter Requirements` section: initial Inbox captures may omit YAML; after triage, notes must receive PAKE standard frontmatter.
  - [x] `01-Projects/_README.md`
    - [x] `schema_required: true`
    - [x] `allowed_pake_types: WorkflowNote` (route by project context expectations)
    - [x] `naming_convention: project-scoped, human-readable filenames; no directory-scoped schema encoded in the filename`
    - [x] Document directory role (“Active project folders”) and “what goes here” vs “what does not go here”.
    - [x] Document `Frontmatter Requirements` section: notes outside `00-Inbox/` must include PAKE standard frontmatter.
  - [x] `02-Areas/_README.md`
    - [x] `schema_required: true`
    - [x] `allowed_pake_types: WorkflowNote`
    - [x] `naming_convention: descriptive names aligned to ongoing responsibilities; avoid date-specific prefixes here`
    - [x] Document ongoing responsibilities semantics and routing expectations.
    - [x] Document `Frontmatter Requirements` section: notes outside `00-Inbox/` must include PAKE standard frontmatter.
  - [x] `03-Resources/_README.md`
    - [x] `schema_required: true`
    - [x] `allowed_pake_types: SourceNote | InsightNote | SynthesisNote | ValidationNote`
    - [x] `naming_convention: reference- and concept-scoped names; stable titles so agents can search reliably`
    - [x] Document reference/knowledge semantics and “gatekeeping” rules (no untriaged Inbox content).
    - [x] Document `Frontmatter Requirements` section: notes outside `00-Inbox/` must include PAKE standard frontmatter.
  - [x] `04-Archives/_README.md`
    - [x] `schema_required: true`
    - [x] `allowed_pake_types: any` with guidance that notes should be treated as archived content.
    - [x] `naming_convention: human-readable archived titles; status frontmatter should be `archived``
    - [x] Document read-only intent (“read-only unless reactivating”) and naming expectations for archived items.
    - [x] Document `Frontmatter Requirements` section: notes outside `00-Inbox/` must include PAKE standard frontmatter.
  - [x] `DailyNotes/_README.md`
    - [x] `schema_required: true`
    - [x] `allowed_pake_types: WorkflowNote`
    - [x] `naming_convention: DailyNotes/YYYY-MM-DD.md`
    - [x] Document daily file naming convention `YYYY-MM-DD.md` and append-only during the day, reviewed weekly expectations.
    - [x] Document `Frontmatter Requirements` section: notes outside `00-Inbox/` must include PAKE standard frontmatter (with daily tags).

- [x] Verify manifests conform to the required contract template
  - [x] Every manifest has YAML frontmatter fields: `purpose`, `schema_required`, `allowed_pake_types`, `naming_convention`.  
  - [x] Every manifest body contains: directory name heading, “What Goes Here” and “What Does Not Go Here”, and “Frontmatter Requirements”.
  - [x] No prose violates vault formatting constraints from `specs/cns-vault-contract/AGENTS.md` (notably no em dash usage).

- [x] Align manifests with PAKE frontmatter expectations
  - [x] For directories with `schema_required: true`, document that notes outside `00-Inbox/` must include the PAKE standard frontmatter block.
  - [x] For `00-Inbox/`, document that notes can be created without PAKE frontmatter initially, and that triage applies schema when moved out of Inbox.

- [x] Document the deploy target and where operator should copy/sync from
  - [x] Document deploy locations and copy steps so operators can mirror the manifests into their live vault root.

## Dev Notes

### Architecture compliance
- This story is **markdown + documentation**, not TypeScript. It provides the “contract map” that later Vault IO tools will rely on for routing and boundary explanations.  
  [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1]

- Manifest content must reflect the directory contracts defined by `CNS-Phase-1-Spec.md` “Directory Contracts” template.  
  [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §“Directory Contracts”]

### Technical requirements (guardrails)
- **Template compliance:** use the exact required frontmatter keys (`purpose`, `schema_required`, `allowed_pake_types`, `naming_convention`), because later tooling may parse these fields by name.
- **Routing consistency:** allowed_pake_types and routing rules must match `specs/cns-vault-contract/AGENTS.md` Routing Rules table.
- **Phase 1 scope only:** do not add Folder contract features that imply Phase 2 features (Bases control panels, NotebookLM ingestion, Discord ops, etc.).

### Testing requirements
- An automated Node test gate exists: `tests/folder-contract-manifests.test.mjs`.
- Manual checks:
  - Confirm each manifest exists and is non-empty in the deployed vault location.
  - Confirm the allowed PAKE types match the AGENTS routing rules.
  - Optionally add/extend a Node test later to assert manifest frontmatter keys if a mock vault tree is introduced.

### Previous story intelligence
- Story 1.* established the authoritative constitution and shims, plus repo/specs parity patterns.
- Reuse the same “vault paths vs repo paths” phrasing to avoid operator confusion: manifest guidance must assume live vault-relative paths like `00-Inbox/` and not repo-only `_bmad-output/` paths.  
  [Source: `_bmad-output/implementation-artifacts/1-1-constitution-core-and-modular-policy.md`]

### Git intelligence summary
- Recent work focuses on constitution + shims; this story adds the missing “folder map” layer before implementing routing logic and PAKE write gates.

### Latest tech information
- Not applicable (static Markdown).

### Project context reference
- Authority for routing and formatting rules:
  - `specs/cns-vault-contract/AGENTS.md`
  - `specs/cns-vault-contract/CNS-Phase-1-Spec.md`

## Open questions (saved for post-story)
- Whether to store the deployed vault folder contract manifests inside this repo as a mock `Knowledge-Vault-ACTIVE/` tree (to enable automated tests), or to keep this repo as specs-only and rely on operator deployment. This can be decided when adding automated manifest tests.

## References
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — Vault Folder Contract + Directory Contracts template]
- [Source: `specs/cns-vault-contract/AGENTS.md` — Vault Map + Routing Rules + Formatting Standards]

## Dev Agent Record

### Agent Model Used

Local validation pass (structure and workflow-compatibility only, no external LLM run).

### Debug Log References

- N/A (story context validation)

### Completion Notes List

- Added the missing required story sections so `bmad-dev-story` can parse and execute this story.
- Created the mock vault directory manifests under `Knowledge-Vault-ACTIVE/` and added a Node test to enforce the contract template.

### File List

- `_bmad-output/implementation-artifacts/2-1-per-directory-manifests-for-the-folder-contract.md`

## Change Log

- 2026-04-02: Implemented Story 2.1 by adding mock vault `_README.md` directory manifests and a Node test gate.

## Story completion status

- [x] Implementation complete
- [x] Acceptance criteria verified
- [x] File list updated

