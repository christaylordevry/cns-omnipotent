# Ralph Loop Prompt — CNS Phase 1

## Mission
Build the CNS Foundation Layer: vault folder contract, AGENTS.md constitution, and Vault IO MCP server.

## Authoritative Spec
specs/cns-vault-contract/CNS-Phase-1-Spec.md

## Inputs
- BMAD artifacts: `_bmad-output/` (PRD/architecture/epics/stories)
- Phase 1 Spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- AGENTS.md reference: `specs/cns-vault-contract/AGENTS.md`
- Verification gate: `bash scripts/verify.sh`

## Operating Rules
1. If a spec is missing, create or refine it before coding.
2. Implement in small steps; rerun verification often.
3. Never claim completion unless `bash scripts/verify.sh` passes.
4. Stay within Phase 1 scope. Do not build brain service, Discord bridge, or daemon features.
5. If blocked, ask a single clear question.

## Phase 1 Acceptance Criteria
- [ ] Vault folder structure matches the contract (all directories, all _README.md files)
- [ ] AI-Context/AGENTS.md exists, under 500 lines, loaded by Claude Code and Cursor shims
- [ ] CLAUDE.md at vault root references AGENTS.md
- [ ] .cursorrules at vault root references AGENTS.md
- [ ] _meta/schemas/ contains frontmatter definitions for all five pake_types
- [ ] At least one module exists in AI-Context/modules/ (vault-io.md or security.md)
- [ ] Vault IO MCP server runs and exposes all eight tools from the spec
- [ ] vault_create_note produces valid PAKE-compliant frontmatter
- [ ] All write operations produce entries in _meta/logs/agent-log.md
- [ ] A new session in Claude Code or Cursor requires zero re-orientation

When all criteria are met, output: LOOP_COMPLETE