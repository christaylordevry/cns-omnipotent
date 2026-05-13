# Story 29.7: CLAUDE.md shim update + Token Budget Policy in AGENTS.md

Status: ready-for-dev

## Story

As a CNS operator,
I want the vault-root Claude shim and constitution to reflect post-Epic-28 Vault IO reality and a normative token budget policy,
so that cold-start context stays bounded and deploy documentation stays accurate without duplicating the full repo CLAUDE.md.

## Acceptance Criteria

1. **Shim updated** (`specs/cns-vault-contract/shims/CLAUDE.md`): Vault IO MCP tool count is **9** with an explicit forward note that story **29-8** adds `vault_request_disambiguation` for a total of **10**; **Epic 29** scope is described (not "Epic 29 (scope TBD)"); cross-link to normative vault lint at `specs/cns-vault-contract/modules/vault-lint.md` (resolvable path from the spec tree). Shim remains vault-deploy focused; do not byte-align to repo `CLAUDE.md`.
2. **§6.5 Token Budget Policy** present under **§6 Security Boundaries** in `specs/cns-vault-contract/AGENTS.md` with the exact policy body and current budgets listed (USER.md, MEMORY.md, fast-scan index, Hermes skills).
3. **Version** in `AGENTS.md` header bumped to **v1.9.7** with changelog row: `v1.9.7 — §6.5 Token Budget Policy added (Epic 29).`
4. **Dual sync:** `specs/cns-vault-contract/AGENTS.md` and canonical vault `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (Windows path per constitution rule) are **identical** after the edit.
5. **Scope:** No other repository files changed (story artifact path above is allowed).
6. **Quality gate:** `npm test` and `bash scripts/verify.sh` pass.

## Tasks / Subtasks

- [x] Draft shim: tool count 9 + 29-8 note, Epic 29 summary, vault-lint link (AC: 1)
- [x] Insert `### §6.5 Token Budget Policy` under Section 6; bump version and changelog (AC: 2, 3)
- [x] Copy `AGENTS.md` to both vault locations (AC: 4)
- [x] Run `npm test` and `bash scripts/verify.sh` (AC: 6)

## Dev Notes

- **Dual-sync rule:** Per `.cursor/rules/cns-specs-constitution.mdc`, every `AGENTS.md` edit updates both `specs/cns-vault-contract/AGENTS.md` and `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` in the same operation; confirm byte match or single source copy.
- **Epic 29 summary source:** Section 8 of current `AGENTS.md` (Phase 6, stories 29-0 through 29-10 themes: token audit, USER/MEMORY, vault-lint, dedup, disambiguation tool, fast-scan, thinking commands).
- **Em dashes:** Constitution forbids em dashes in prose; use commas or colons in new shim text.

### References

- [Source: `specs/cns-vault-contract/AGENTS.md` §8 Current Focus]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md`]
- [Source: `.cursor/rules/cns-specs-constitution.mdc` AGENTS.md sync rule]

## Standing tasks (every story)

### Standing task: Update operator guide

- Operator guide: no update required (constitution and deploy shim only; no new MCP operator workflow in this story).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Completion Notes List

- Shim expanded with deploy contract snapshot; AGENTS §6.5 and v1.9.7 applied; vault copies synced via `cp`.
- §6.5 sentence uses `, so` instead of an em dash between "not guidelines" and "a story fails" to satisfy Section 3 style rules in `AGENTS.md`.

### File List

- `_bmad-output/implementation-artifacts/29-7-claude-md-shim-update-and-token-budget-policy-in-agents-md.md`
- `specs/cns-vault-contract/shims/CLAUDE.md`
- `specs/cns-vault-contract/AGENTS.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (synced from spec mirror)

**Story completion (create-story):** Ultimate context engine analysis completed — comprehensive developer guide created for 29-7.
