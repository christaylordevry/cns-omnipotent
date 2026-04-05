# Story 2.3: Note-type routing table

Status: done

## Story

As an **agent**,
I want **a documented mapping from PAKE note types to default vault destinations**,
so that **`vault_create_note` and operators agree on "correct" placement**.

## Acceptance Criteria

1. Contract-derived routing mapping:
   Given the vault folder contract manifests and PAKE note types defined in
   `specs/cns-vault-contract/CNS-Phase-1-Spec.md` and `specs/cns-vault-contract/AGENTS.md`,
   when routing rules are published (operator doc + implementer reference),
   then each supported `pake_type` maps to a contract-correct folder:
   - `SourceNote`, `InsightNote`, `SynthesisNote`, `ValidationNote` -> `03-Resources/`
   - `WorkflowNote` -> `01-Projects/<project-name>/` if project context is provided, otherwise -> `02-Areas/<area-name>/`
   - Unstructured captures -> `00-Inbox/` (Inbox default when in doubt).

2. Ambiguous `WorkflowNote` disambiguation:
   Given a `WorkflowNote` create request,
   when project context is missing,
   then routing must explicitly require operator or manifest disambiguation (and must document what "project context" means),
   and must describe the fallback used when project context is not available.

3. Doc/implementer consistency:
   Given the mapping above,
   when implementers follow the routing guidance in `specs/cns-vault-contract/modules/vault-io.md`
   and the tool contract in `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (`vault_create_note`),
   then the destination decision logic must not contradict `AGENTS.md` "Routing Rules".

## Tasks / Subtasks

- [x] Publish routing rules (operator doc)
  - [x] Update `specs/cns-vault-contract/AGENTS.md` Section 2: adjust `WorkflowNote` routing to explicitly mention the project context requirement and fallback.
  - [x] Add a short "Disambiguation for WorkflowNote" subsection describing the exact decision rule.

- [x] Publish routing rules (implementer reference)
  - [x] Update `specs/cns-vault-contract/modules/vault-io.md` with the same `WorkflowNote` disambiguation rule so tool implementers do not guess.
  - [x] Ensure `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (`vault_create_note`) `WorkflowNote` routing text matches the `AGENTS.md` decision rule.

- [x] Update directory manifests for operator clarity (recommended)
  - [x] Update `Knowledge-Vault-ACTIVE/01-Projects/_README.md` to explicitly state what "project context" means for a `WorkflowNote`.
  - [x] Update `Knowledge-Vault-ACTIVE/02-Areas/_README.md` to explicitly state what the fallback means when project context is not provided.

- [x] Add automated guard test
  - [x] Create `tests/note-type-routing-table.test.mjs` using `node:test` that asserts:
    - The operator routing table covers all five `pake_type` rows.
    - The `WorkflowNote` row includes both "requires project context" wording and the fallback to `02-Areas/`.
    - The `vault_create_note` section contains the same `WorkflowNote` routing text.
    - The `vault-io.md` module guidance references routing and includes the disambiguation rule.
  - [x] Prefer stable substring assertions over fragile full-sentence equality.

- [x] Verification gate note
  - [x] After the dev agent edits docs and tests, run `bash scripts/verify.sh`.

### Review Findings
- [x] [Review][Decision] Define "project context" semantics for routing — resolved: explicit only. Do not infer project context.
- [x] [Review][Decision] Resolve WorkflowNote fallback target specificity — resolved: prefer `02-Areas/<area-name>/`, allow `02-Areas/` root as temporary holding location that requires triage.
- [x] [Review][Patch] Implementer docs missing "operator or manifest disambiguation" requirement [specs/cns-vault-contract/modules/vault-io.md] — `AGENTS.md` requires "operator or manifest disambiguation" before routing beyond `02-Areas/`, but `vault-io.md` (implementer-facing) and `CNS-Phase-1-Spec.md` `vault_create_note` did not state that requirement. Added the requirement and updated guard tests to enforce it.
- [x] [Review][Patch] Fix likely-incorrect guard substring for vault-io disambiguation [tests/note-type-routing-table.test.mjs:71] — replaced fragile substring check with stable checks for disambiguation guidance and root temporary holding wording.
- [x] [Review][Patch] Reduce brittleness and false-pass risk in routing-table guard test [tests/note-type-routing-table.test.mjs] — anchored routing assertions to the Routing Rules section slice, added explicit assertion for Inbox routing (`00-Inbox/`), and relaxed brittle full-line matches.

## Dev Notes

### Architecture compliance

- This story is documentation and contract-guard work for Phase 1 routing, not a new runtime Vault IO feature (consistent with Story 2.1 and Story 2.2).
- The normative routing decision must be described in two places:
  - Operator-facing: `specs/cns-vault-contract/AGENTS.md` "Routing Rules"
  - Implementer-facing: `specs/cns-vault-contract/modules/vault-io.md` and `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (`vault_create_note`)
- Do not introduce unicode em dashes or double-hyphen punctuation in doc text.

### Testing requirements

- Follow the existing Node guard test patterns:
  - `tests/constitution.test.mjs`
  - `tests/inbox-capture-semantics.test.mjs`
- Tests should validate the presence of policy text that describes decisions, not just that a folder exists.

### Previous story intelligence

- Story 2.1 established the directory contract manifest template and added a manifest-shape guard test.
- Story 2.2 introduced the pattern of "doc + contract guard" rather than claiming unimplemented runtime behavior.

### Project Structure Notes

- When updating constitution mirrors, keep `specs/cns-vault-contract/AGENTS.md` and
  `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` byte-for-byte in sync
  because `tests/constitution.test.mjs` asserts equality.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2, Story 2.3]
- [Source: `specs/cns-vault-contract/AGENTS.md` - Vault Map + Routing Rules]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` - `vault_create_note` routing]
- [Source: `specs/cns-vault-contract/modules/vault-io.md` - Writing Notes + Mediated access]
- [Source: `Knowledge-Vault-ACTIVE/01-Projects/_README.md`]
- [Source: `Knowledge-Vault-ACTIVE/02-Areas/_README.md`]

## Dev Agent Record

### Agent Model Used

Local story-context generation for workflow handoff.

### Debug Log References

N/A.

### Completion Notes List

- Created routing-table story context for `2-3-note-type-routing-table`.
- Marked story status as `ready-for-dev` for `dev-story` handoff.
- Updated story status to `review` after passing verification gate and full regression tests.
- Published explicit `WorkflowNote` project-context disambiguation and fallback text in `specs/cns-vault-contract/AGENTS.md` and kept `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` byte-for-byte in sync. Added a guard test that now passes.
- Published the same `WorkflowNote` disambiguation rule in `specs/cns-vault-contract/modules/vault-io.md` and updated `specs/cns-vault-contract/CNS-Phase-1-Spec.md` `vault_create_note` routing text to include the same fallback wording. Re-ran `npm test`.
- Updated `Knowledge-Vault-ACTIVE/01-Projects/_README.md` and `Knowledge-Vault-ACTIVE/02-Areas/_README.md` with explicit `WorkflowNote` project-context meaning and `02-Areas/` fallback guidance.
- Expanded `tests/note-type-routing-table.test.mjs` to cover operator routing table coverage plus `vault_create_note` and `vault-io.md` disambiguation consistency. Re-ran `npm test`.

### File List

- `_bmad-output/implementation-artifacts/2-3-note-type-routing-table.md`
- `specs/cns-vault-contract/AGENTS.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md`
- `tests/note-type-routing-table.test.mjs`
- `specs/cns-vault-contract/modules/vault-io.md`
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- `Knowledge-Vault-ACTIVE/01-Projects/_README.md`
- `Knowledge-Vault-ACTIVE/02-Areas/_README.md`

