# AGENTS.md — Omnipotent.md (CNS Vault IO MCP Server)

## Repo Overview
- `src/`: TypeScript MCP server source
- `dist/`: Compiled output (do not edit directly)
- `specs/`: cns-vault-contract spec files (normative)

## Architecture
This is the Vault IO MCP server for the CNS. It exposes vault_read,
vault_write, vault_search, and related tools to Claude Code and Cursor.
All mutations go through WriteGate and the PAKE validation layer.

## Required Workflow
1. Read this file, then read specs/cns-vault-contract/CNS-Phase-1-Spec.md.
2. Run tests before any change: npm test.
3. Do not modify audit logging or WriteGate without operator approval.
4. Keep specs/ and src/ in sync; spec is normative.

## Commands
- Install: npm install
- Build: npm run build
- Test: npm test
- Verify: bash scripts/verify.sh

## Safe Edit Policy
Ask before: changing MCP tool signatures, modifying the audit log path,
touching security.md, or any bulk refactor.
