# CNS Brownfield Knowledge Index — Phase 0

**Generated:** 2026-07-25 · **Mode:** full_rescan · **Scan:** exhaustive  
**Purpose:** Ground truth for `/bmad-create-architecture` (unified-app master plan Gate 0)  
**Master plan:** [`../nexus-unified-app-master-plan.md`](../nexus-unified-app-master-plan.md)  
**Latest handoff:** [`../../../HANDOFF-2026-07-24-instrument-revert-and-capability-scan.md`](../../../HANDOFF-2026-07-24-instrument-revert-and-capability-scan.md)

> [!abstract]
> Four strata, one product goal. Backend is deep; UI surfaces ~⅓ of it. Nav: 3 live, 5 dead; `/trends` live but orphaned from Nexus shell. INSTRUMENT is the design SSOT on `/nexus` only.

---

## Parts documented

| Part ID | Location | Branch / state | Type |
|---------|----------|----------------|------|
| `omnipotent` | `/home/christ/ai-factory/projects/Omnipotent.md` | `hermes-consolidation` | CNS control + Vault IO MCP + crons |
| `dashboard` | `/home/christ/ai-factory/projects/cns-dashboard` | `cns-redesign` @ `f90723b` INSTRUMENT | Nexus web (SvelteKit 5 + Convex) |
| `hermes` | `~/.hermes` | runtime (not a product repo) | Gateway, skills, scorer, voice |
| `vault` | `Knowledge-Vault-ACTIVE` (via vault-io) | live PARA | PAKE knowledge — **do not vendor** |

**Prod Convex:** `amiable-ox-862` (`https://amiable-ox-862.convex.cloud`)

---

## Phase 0 deliverables (read in this order)

| # | Doc | Answers |
|---|-----|---------|
| 1 | [system-overview.md](./system-overview.md) | What exists, strata, tech, topology |
| 2 | [data-spine.md](./data-spine.md) | **(a)** source → cron/script → Convex table → app query → surface |
| 3 | [surface-inventory.md](./surface-inventory.md) | **(b)** every surface: LIVE / DEAD / ORPHANED |
| 4 | [operator-workflows.md](./operator-workflows.md) | **(c)** morning digest → judgment → investigate; trends; entities; vault |
| 5 | [ops-runtime-map.md](./ops-runtime-map.md) | Crons, Hermes skills, failure modes, dual-path digests |

Also mirrored for BMAD doc-project: [`../../../docs/index.md`](../../../docs/index.md)

---

## Hard facts for architecture (Gate 0 closed 2026-07-25)

1. **Two app shells today:** Nexus (`/nexus*`) and Trends (`/trends*`) — target is **one** product shell (Decision 2).
2. **INSTRUMENT tokens** (`cns-tokens.css`) drive cockpit; Trends still navy-instrument (`trends-theme.css`).
3. **Dismiss is client-only today** — target = durable Dismiss-with-decay on identity key (Decision 2 / DM-3).
4. **Dual morning-digest lineages** still in-tree; live crontab uses deterministic `run-digest-convex-completion.mjs`.
5. **Active defect (ops):** recent digest outcomes show Convex `ArgumentValidationError` on `contributedCount` — **M0 diagnose-first** (do not assume field absence).
6. **Vault stays out of monorepo** — reference via vault-io MCP only.
7. **Monorepo:** target **A** (multi-package workspace); migration **C-bridge-first** — see architecture SSOT.

**Architecture SSOT:** [`../architecture-nexus-unified-app.md`](../architecture-nexus-unified-app.md)

---

## Next

Gate 0 closed. Next executable = **M0** on explicit operator go. Phase B design gate preserved.
