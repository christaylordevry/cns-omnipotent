# Story 2.2: Inbox capture semantics

Status: done

## Story

As an **operator**,  
I want **`00-Inbox/` to accept raw capture without PAKE enforcement on initial create**,  
so that **I can dump inputs quickly and triage later**.

## Acceptance Criteria

1. **Inbox initial create bypass:**  
   Given a note created under `00-Inbox/` via Vault IO,  
   when frontmatter is minimal or absent per policy,  
   then create succeeds without PAKE validation failure. (FR6)

2. **Explicit contract in docs:**  
   The bypass behavior is documented in both:
   - `Knowledge-Vault-ACTIVE/00-Inbox/_README.md` (manifest + frontmatter exception), and
   - `specs/cns-vault-contract/modules/vault-io.md` and/or constitution rules clarifying “outside 00-Inbox” schema validation.

3. **Automated guard:**  
   Add/extend a focused Node test so future changes cannot silently remove the “outside `00-Inbox/`” PAKE validation boundary.

## Tasks / Subtasks

- [x] Update/verify inbox manifest exception
  - [x] `Knowledge-Vault-ACTIVE/00-Inbox/_README.md` includes:
    - `schema_required: false`
    - `allowed_pake_types: any`
    - `Frontmatter Requirements` section stating initial create under `00-Inbox/` may omit PAKE standard frontmatter

- [x] Update/verify Vault IO write policy boundary
  - [x] `specs/cns-vault-contract/modules/vault-io.md` documents PAKE schema validation is enforced **outside** `00-Inbox/`

- [x] Add automated contract guard
  - [x] Add `tests/inbox-capture-semantics.test.mjs` asserting both manifest + module + constitution mirror boundary statements exist

- [x] Verification gate
  - [x] `bash scripts/verify.sh` passes

### Review Findings
- [x] [Review][Decision] Inbox “minimal or absent YAML” ambiguity: choose `1A` (YAML frontmatter block can be entirely missing, not just PAKE keys). Evidence: `Knowledge-Vault-ACTIVE/00-Inbox/_README.md` explicitly allows initial create without PAKE standard frontmatter, and we interpret “absent YAML” as delimiter-less missing YAML. (Policy interpretation resolved.)
- [x] [Review][Decision] Acceptance Criteria runtime claim vs current Phase 1 scope: choose `2A` (reword AC to “documentation + guard exist” for Phase 1 reality). We do not yet have runtime Vault IO bypass implementation in this repo, so AC should reflect the current contract + test guard. (Scope resolved.)
- [x] [Review][Patch] Remove unicode em dash characters in Story 2.2 artifact [/_bmad-output/implementation-artifacts/2-2-inbox-capture-semantics.md:53]
- [x] [Review][Patch] Strengthen inbox manifest test to assert the exact “missing YAML frontmatter at initial creation” statement (not just Frontmatter Requirements + schema_required/allowed_pake_types). Evidence: `tests/inbox-capture-semantics.test.mjs` now checks the exact missing-YAML sentence.
- [x] [Review][Patch] Strengthen `vault-io.md` test assertions from substring checks to more specific phrases: require “Always validate frontmatter” and “outside `00-Inbox/`” together. Evidence: `tests/inbox-capture-semantics.test.mjs` now asserts “Always validate frontmatter” + `outside 00-Inbox/`.
- [x] [Review][Patch] Strengthen AGENTS mirror test to ensure it asserts the “YAML frontmatter required on all notes outside `00-Inbox/`” requirement line explicitly (not just generic “YAML frontmatter” + “outside” mentions). Evidence: `tests/inbox-capture-semantics.test.mjs` now asserts the full requirement-line substring.
- [x] [Review][Patch] Add a single coherent policy assertion in the inbox test that bundles: schema_required false + allowed_pake_types any + initial create allowed without PAKE standard frontmatter. Evidence: `tests/inbox-capture-semantics.test.mjs` now bundles these checks into one assertion.
- [x] [Review][Patch] Verify Story 2.2 “Explicit contract in docs” remains true after the Story 2.1 exemption decision for directory contract `_README.md` manifests. Evidence: the updated guard test asserts the exemption-compatible contract text in Inbox README, `vault-io.md`, and the `AGENTS.md` mirror.
- [x] [Review][Defer] Pre-existing risk: string-based Node tests are brittle against wording changes. Defer until a more structured contract test harness (parse YAML fields + template sections) exists.

## Dev Notes

### Architecture compliance
- This story is **documentation + contract enforcement** (frontmatter and module guidance), not yet an implementation of the Vault IO MCP server itself.

### Testing requirements
- The automated guard is a lightweight Node test that checks for explicit boundary text and key frontmatter values.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2, Story 2.2]
- [Source: `Knowledge-Vault-ACTIVE/00-Inbox/_README.md`]
- [Source: `specs/cns-vault-contract/modules/vault-io.md`]
- [Source: `specs/cns-vault-contract/AGENTS.md`]

