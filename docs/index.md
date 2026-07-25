# Project Documentation Index

**Generated:** 2026-07-25 · **Mode:** full_rescan · **Scan:** exhaustive  
**Repository type:** multi-part system (not a single monolith)

### Project Overview

- **Project:** CNS (Central Nervous System) — control + Nexus app + Hermes + vault
- **Parts:** 4 — `omnipotent`, `dashboard`, `hermes`, `vault`
- **Primary languages:** TypeScript (both code repos); Python (trend-ingest, Hermes hooks)
- **Prod Convex:** `amiable-ox-862`
- **Branches:** Omnipotent.md `hermes-consolidation` · cns-dashboard `cns-redesign`

### Phase 0 brownfield (architecture ground truth)

**Primary package for Gate 0 / `/bmad-create-architecture`:**

- [Brownfield index](../_bmad-output/planning-artifacts/brownfield/00-index.md)
- [System overview](../_bmad-output/planning-artifacts/brownfield/system-overview.md)
- [Data spine](../_bmad-output/planning-artifacts/brownfield/data-spine.md) — source → cron → Convex → query → surface
- [Surface inventory](../_bmad-output/planning-artifacts/brownfield/surface-inventory.md) — LIVE / DEAD / ORPHANED
- [Operator workflows](../_bmad-output/planning-artifacts/brownfield/operator-workflows.md)
- [Ops & runtime map](../_bmad-output/planning-artifacts/brownfield/ops-runtime-map.md)

**Plan context:**

- [Nexus unified-app master plan](../_bmad-output/planning-artifacts/nexus-unified-app-master-plan.md)
- [HANDOFF 2026-07-24 INSTRUMENT revert](../HANDOFF-2026-07-24-instrument-revert-and-capability-scan.md)

### Quick reference by part

#### omnipotent (this repo)

- **Type:** backend / MCP + orchestration scripts
- **Entry:** `src/index.ts` (`cns-vault-io`, 10 tools)
- **Verify:** `bash scripts/verify.sh`
- **Constitution:** `specs/cns-vault-contract/AGENTS.md` v2.1.59

#### dashboard (`../cns-dashboard`)

- **Type:** web (SvelteKit 5 + Convex)
- **Live routes:** `/nexus`, `/nexus/investigate`, `/nexus/entities`
- **Orphan shell:** `/trends*`
- **Tokens:** `src/lib/styles/cns-tokens.css` (INSTRUMENT)

#### hermes (`~/.hermes`)

- **Type:** runtime (gateway, 14 CNS skills, digester scorer)
- **Model:** nous / `anthropic/claude-sonnet-4.6`

#### vault (live PARA)

- **Access:** vault-io MCP only — do not treat as code / do not vendor

### Generated documentation (this folder)

- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)
- [Project Scan Report (state)](./project-scan-report.json)

### Existing documentation (this folder)

- [Architecture](./architecture.md) _(superseded for unified-app by brownfield package + upcoming create-architecture)_
- [PRD](./prd.md)
- [Nexus / Discord / Obsidian Bridge — Operator Guide](./Nexus-Discord-Obsidian-Bridge-Operator-Guide.md)
- [Nexus / Discord / Obsidian Bridge — Full Guide](./Nexus-Discord-Obsidian-Bridge-Full-Guide.md)
- [Mobile vault access journey](./mobile-vault-access-journey.md)

### Key docs elsewhere

- [CLAUDE.md](../CLAUDE.md)
- [Vault contract](../specs/cns-vault-contract/)
- [project-context.md](../project-context.md)
- [BMAD planning artifacts](../_bmad-output/planning-artifacts/)

### Getting Started

1. Read [brownfield/00-index.md](../_bmad-output/planning-artifacts/brownfield/00-index.md)
2. Omnipotent: `npm install` && `bash scripts/verify.sh`
3. Dashboard: sibling repo; Convex URL `PUBLIC_CONVEX_URL=https://amiable-ox-862.convex.cloud`
4. Next workflow: `/bmad-create-architecture` with brownfield index as input
