# Project Documentation Index

### Project Overview

- **Project**: CNS (Central Nervous System) — Phase 1 implementation repo
- **Type**: monolith (single-part) Node.js + TypeScript MCP server (stdio)
- **Primary Language**: TypeScript
- **Runtime**: Node.js (>= 20)

### Quick Reference

- **Entry point**: `src/index.ts`
- **Verification gate**: `bash scripts/verify.sh`
- **Authoritative spec**: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`

### Generated Documentation (this folder)

- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)
- [Project Scan Report (state)](./project-scan-report.json)

### Existing Documentation (this folder)

- [Architecture](./architecture.md) - Architecture notes (includes dual-path model rationale)
- [PRD](./prd.md) - Canonical PRD pointer + Phase 2.0 scope notes
- [Nexus / Discord / Obsidian Bridge — Operator Guide](./Nexus-Discord-Obsidian-Bridge-Operator-Guide.md)
- [Nexus / Discord / Obsidian Bridge — Full Guide](./Nexus-Discord-Obsidian-Bridge-Full-Guide.md)
- [Mobile vault access journey (read-first) and governance posture](./mobile-vault-access-journey.md)

### Key Docs Elsewhere in the Repo

- [Repository README](../README.md)
- [Project Rules](../CLAUDE.md)
- [Vault IO MCP Operator Checklist](../specs/cns-vault-contract/README.md)
- [Constitution Mirror](../specs/cns-vault-contract/AGENTS.md)
- [Phase 1 Spec](../specs/cns-vault-contract/CNS-Phase-1-Spec.md)
- [BMAD Planning Artifacts](../_bmad-output/planning-artifacts/)

### Getting Started

1. Install dependencies: `npm install`
2. Run the gate: `bash scripts/verify.sh`
3. Run the MCP server (dev): `npm run dev` (ensure `CNS_VAULT_ROOT` is set)

