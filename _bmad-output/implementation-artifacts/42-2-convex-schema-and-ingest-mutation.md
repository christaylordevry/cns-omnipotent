---
story_id: 42-2
epic: 42
planning_epic: "Epic 42 / internal Epic 1 Story 1.2"
title: convex-schema-and-ingest-mutation
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 42.2: Convex schema and ingest mutation

Status: done

**Planning map:** Epic 42 Story 1.2 — `42-2-convex-schema-and-ingest-mutation`.

## Story

As a **developer**,
I want **Convex tables and `ingestDashboardSnapshot` mutation with `getDashboardSnapshot` query**,
so that **the sync script and browser share one validated data contract**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` only |
| **CNS repo touch** | **None** (`dashboard-sync.ts` is Story 42-3) |
| **Depends on** | 42-1 scaffold complete |

## Acceptance Criteria

1. **Schema (AC: schema)** — `convex/schema.ts` defines `vaultHealth`, `mcpStatus`, `agentLogEntries`, `runChainStatus`, `noteIndex`, `syncMetadata` per PRD § Convex Sync Data Contract.
2. **Ingest (AC: ingest)** — `ingestDashboardSnapshot` accepts camelCase `DashboardSnapshot`, validates with `convex/values`, atomically replaces all table rows; singleton tables hold one doc each; `noteIndex` keyed by `path`; exactly 7 `mcpStatus` rows by `name`.
3. **Query (AC: query)** — `getDashboardSnapshot` returns all panel data for the shell.
4. **Tests (AC: test)** — Vitest + `convex-test` cover ingest round-trip and MCP count validation.
5. **CNS boundary (AC: cns-boundary)** — `Omnipotent.md` diff limited to sprint/story artifacts; `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Add `convex/schema.ts` with six tables and indexes (`by_name`, `by_path`) (AC: schema)
- [x] Add `convex/validators.ts` + `convex/constants.ts` for `DashboardSnapshot` and MCP names (AC: ingest)
- [x] Implement `convex/dashboard.ts`: `ingestDashboardSnapshot`, `getDashboardSnapshot` (AC: ingest, query)
- [x] Add Vitest + `convex-test` and `tests/convex/dashboard.test.ts` (AC: test)
- [x] Run `npx convex dev --once`, `npm test`, `npm run build` (AC: test)
- [x] Confirm CNS repo `verify.sh` green; no `src/` or `package.json` changes in Omnipotent.md (AC: cns-boundary)
- [x] Standing task: Operator guide — no update required

## Dev Notes

- MCP names (FR10): `cns_vault_io`, `notebooklm`, `context7`, `firecrawl`, `perplexity`, `playwright`, `discord` — use stable `name` strings matching sync script (see architecture: vault-io as `cns_vault_io` or `vault-io` — PRD lists `vault-io`; use kebab names from FR10 table).
- `vaultHealth` includes `lintStale: boolean` per architecture C3.
- `pakeDistribution`: `Record<string, number>` via `v.record(v.string(), v.number())`.
- Timestamps: Unix ms (`number`). Enums per architecture format table.
- Out of scope: `searchNotes` (Epic 2 / later), `scripts/dashboard-sync.ts`, panel UI.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Completion Notes List

- Six Convex tables + `dashboardSnapshotValidator` aligned to PRD § Convex Sync Data Contract (`lintStale` on `vaultHealth`).
- `ingestDashboardSnapshot` clears and repopulates each table in one mutation; enforces 7 MCP names (FR10), unique `noteIndex.path`, max 20 agent-log rows.
- `getDashboardSnapshot` returns sorted panel payload (MCP by name, agent log chronological, notes by `modifiedAt` desc).
- Vitest + `convex-test`: 3 tests pass; `npm run build` / `check` green; CNS `verify.sh` 619 tests pass.
- **Operator guide: no update required.**

### File List

**cns-dashboard** (`/home/christ/ai-factory/projects/cns-dashboard/`):

- `convex/schema.ts`
- `convex/validators.ts`
- `convex/constants.ts`
- `convex/dashboard.ts`
- `convex/tsconfig.json` (exclude `*.test.ts`)
- `tests/convex/dashboard.test.ts`
- `vitest.config.ts`
- `package.json`
- `package-lock.json`

**Omnipotent.md** (tracking only):

- `_bmad-output/implementation-artifacts/42-2-convex-schema-and-ingest-mutation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Story created; implementation in progress.
- 2026-05-24: Convex schema, ingest/query functions, and tests complete — ready for review.
- 2026-05-24: Code review — 1 decision-needed, 3 patch, 1 defer, 2 dismissed; all resolved, story done.

### Review Findings

- [x] [Review][Decision] Singleton `id: "current"` vs clear-and-insert — **Resolved B:** keep clear-and-insert; architecture doc updated to match.
- [x] [Review][Patch] Query response includes Convex system fields [`convex/dashboard.ts`] — fixed: `stripConvexDoc` / `stripConvexRows` on all query results.
- [x] [Review][Patch] Missing validation-path tests [`tests/convex/dashboard.test.ts`] — fixed: duplicate path and >20 agent-log tests added.
- [x] [Review][Patch] Non-deterministic singleton read on multi-row drift [`convex/dashboard.ts`] — fixed: `readSingletonRow` throws if >1 row.
- [x] [Review][Defer] Unauthenticated public ingest mutation [`convex/dashboard.ts:44`] — deferred, pre-existing: Convex MVP relies on deploy-key-only sync writes; rate-limit/auth deferred to provisioning/ops story.
