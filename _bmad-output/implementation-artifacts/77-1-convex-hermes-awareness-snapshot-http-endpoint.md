# Story 77.1: Convex HermesAwarenessSnapshot HTTP Endpoint

Status: done

**Epic:** 77 — JARVIS Awareness in Nexus (alias Epic D1)  
**Repo boundary:** **cns-dashboard only** (Convex HTTP + validators + tests). No Omnipotent.md code in this story — pull client is **77-2**.  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` Story 77-1; `architecture-hermes-consolidation.md` ADR-HERMES-002  
**Prerequisites:** Epic 74 `done` (Portal live). Existing Convex tables from Epics 42–73 — **no schema changes**.  
**Blocks:** **77-2** (Hermes pull client), **77-5** (Nexus awareness panels UI)

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As **Hermes (WSL agent)**,
I want **a least-privilege `GET /hermes/awareness` returning a fixed DTO**,
so that **I can read live cockpit state without Convex MCP or mutations (FR12, ADR-HERMES-002)**.

## Acceptance Criteria

### AC1 — HTTP route + bearer auth

**Given** `HERMES_CONVEX_READ_KEY` is set in the Convex deployment environment  
**When** `GET /hermes/awareness` is called with `Authorization: Bearer <key>`  
**Then** response is `200` with `Content-Type: application/json`  
**And** body validates against `hermesAwarenessSnapshotValidator`

**Given** missing, malformed, or wrong bearer token  
**When** the route is called  
**Then** response is `401` with no snapshot body (no stack traces in response)

**And** auth compares constant-time or plain equality against `process.env.HERMES_CONVEX_READ_KEY`  
**And** route is registered at path `/hermes/awareness` method `GET` in `convex/http.ts` (Convex `.convex.site` base URL)  
**And** implementation uses `httpRouter` + `httpAction` calling an `internalQuery` — **no direct `ctx.db` in httpAction**

### AC2 — DTO sections (HermesAwarenessSnapshot)

**Given** production Convex tables may be empty or partially populated  
**When** a authorized request succeeds  
**Then** JSON uses **camelCase** top-level keys exactly:

| Section | Source | Shape / limits |
|---------|--------|----------------|
| `sync` | `syncMetadata` singleton | `syncMetadataValidator` fields; `null` if no row |
| `vault` | `vaultHealth` singleton | `vaultHealthValidator`; `null` if no row |
| `chain` | `runChainStatus` singleton | `runChainStatusValidator`; `null` if no row |
| `mcps` | `mcpStatus` table | `mcpStatusRowValidator[]`, sorted by `name` (mirror `getDashboardSnapshot`) |
| `digest` | latest digest run + signals | `{ brief, topSignals }` — `brief` from latest `digestRuns` (same fields as `getLatestDigestBrief` non-null branch); `topSignals` max **5** via rank sort (`getDigestSignalsForRun` pattern) |
| `entities` | `getEntityIntelligence` logic | `{ tracked, emerging, hasBaselineHistory, runDate? }` — **max 5** `tracked`, **max 3** `emerging` (`entityLaneItemValidator` each) |
| `investigations` | board summary (not full board) | `{ totalItems, columnCounts: { triage, investigating, waiting, resolved } }` — counts only, no full `investigationBoardListItem` arrays |
| `trends` | trend intelligence | `{ anomalies, scores }` — max **3** anomalies (recent window, same enrichment as `getRecentAnomalies`); max **3** scores (`getLatestScores` with `limit: 3`) |

**And** response **must NOT** include `noteIndex`, `agentLogEntries`, or arbitrary table dumps  
**And** empty domains return empty arrays / zero counts / null singletons — not errors

### AC3 — Validators in `convex/validators.ts`

**Given** ADR-HERMES-002 DTO contract  
**When** validators are added  
**Then** export:

- `hermesAwarenessDigestSectionValidator` — `{ brief: <digest brief union>, topSignals: digestSignalListItemValidator[] }`
- `hermesAwarenessEntitiesSectionValidator` — `{ tracked, emerging, hasBaselineHistory, runDate? }`
- `hermesAwarenessInvestigationsSummaryValidator` — `{ totalItems, columnCounts }`
- `hermesAwarenessTrendsSectionValidator` — `{ anomalies, scores }` (define compact row validators mirroring existing query return shapes; do not import private types from `trendIntelligence.ts`)
- `hermesAwarenessSnapshotValidator` — top-level object composing sections above

**And** `internal.hermesAwareness.buildSnapshot` (or equivalent) declares `returns: hermesAwarenessSnapshotValidator`

### AC4 — Module layout

**Given** architecture file tree  
**When** implementation is complete  
**Then**:

| File | Role |
|------|------|
| `convex/http.ts` | **NEW** — `httpRouter`, route `/hermes/awareness`, bearer gate, `ctx.runQuery(internal.hermesAwareness.buildSnapshot)` |
| `convex/hermesAwareness.ts` | **NEW** — `internalQuery` assembler; reuse read logic from `dashboard.ts`, `digest.ts`, `entityIntelligence.ts`, `investigationBoard.ts`, `trendIntelligence.ts` (prefer shared pure helpers over duplicating large blocks) |
| `convex/validators.ts` | **UPDATE** — DTO validators |
| `docs/DEPLOY.md` | **UPDATE** — document `HERMES_CONVEX_READ_KEY` in Convex env table (WSL consumer in 77-2; **not** on Vercel) |

**And** `convex/schema.ts` **unchanged**  
**And** `ingestDashboardSnapshot` / `dashboard-sync.ts` **unchanged** (push path retained until 77-7)

### AC5 — Tests

**Given** `tests/convex/hermes-awareness.test.ts`  
**When** `npm test` and `bash scripts/verify.sh` run in cns-dashboard  
**Then** tests cover:

1. `buildSnapshot` internalQuery returns all sections with seeded fixtures (reuse `emptySnapshot()` + digest/entity fixtures from sibling tests)
2. Section limits enforced — 10 digest signals seeded → 5 returned; entity lanes sliced 5+3
3. Response shape excludes forbidden fields (`noteIndex`, `agentLogEntries` keys absent)
4. Bearer auth helper — valid key, missing header, wrong key → 401
5. Empty DB — authorized snapshot returns nulls/empty arrays without throw

**And** Omnipotent `bash scripts/verify.sh` passes (runs cns-dashboard `npm test` when sibling present)

### AC6 — Out of scope (explicit)

- `scripts/hermes-awareness-pull.ts` (77-2)
- `convex/hermesPush.ts` webhook push (77-3)
- Hermes skill (77-4)
- `/nexus` UI panels (77-5)
- `HERMES_DISCORD_WEBHOOK_URL` wiring
- Operator Convex env provisioning (document only; operator sets key in Convex dashboard)
- Deprecating `dashboard-sync.ts` (77-7)

## Tasks / Subtasks

### Prerequisite gate

- [ ] **T0 — Dependency check**
  - [ ] T0.1 Confirm Epic 74 `done` in sprint-status (Portal provider live)
  - [ ] T0.2 Read existing queries: `getDashboardSnapshot`, `getLatestDigestBrief`, `getDigestSignalsForRun`, `getEntityIntelligence`, `listInvestigationBoard`, `getRecentAnomalies`, `getLatestScores`

### Validators

- [ ] **T1 — DTO validators** (AC: 3)
  - [ ] T1.1 Add subsection validators in `convex/validators.ts`
  - [ ] T1.2 Export `hermesAwarenessSnapshotValidator`

### Snapshot assembler

- [ ] **T2 — `convex/hermesAwareness.ts`** (AC: 2, 4)
  - [ ] T2.1 `export const buildSnapshot = internalQuery({ returns: hermesAwarenessSnapshotValidator, ... })`
  - [ ] T2.2 Dashboard slices: read singleton rows + MCP list (copy `readSingletonRow` / sort helpers from `dashboard.ts` or extract to `convex/lib/dashboard_read.ts` if reuse is cleaner — **one** extraction, no duplicate singleton logic in three files)
  - [ ] T2.3 Digest: latest brief + top 5 signals
  - [ ] T2.4 Entities: call shared lane builder with `now: Date.now()` (**OK in internalQuery/httpAction** — not a reactive public query)
  - [ ] T2.5 Investigations: aggregate column counts from `investigationBoardItems` (do not return full board items)
  - [ ] T2.6 Trends: slice anomalies/scores to 3 each

### HTTP surface

- [ ] **T3 — `convex/http.ts`** (AC: 1, 4)
  - [ ] T3.1 `verifyHermesBearer(request)` helper — parse `Authorization: Bearer …`
  - [ ] T3.2 Route handler returns JSON snapshot or 401
  - [ ] T3.3 `export default http` router

### Docs + verify

- [ ] **T4 — Documentation** (AC: 4)
  - [ ] T4.1 Add `HERMES_CONVEX_READ_KEY` row to `docs/DEPLOY.md` Convex env section

- [ ] **T5 — Tests** (AC: 5)
  - [ ] T5.1 `tests/convex/hermes-awareness.test.ts`
  - [ ] T5.2 `bash scripts/verify.sh` in cns-dashboard
  - [ ] T5.3 Confirm Omnipotent verify gate green

## Dev Notes

### Repo boundary

| Repo | This story | Later stories |
|------|------------|---------------|
| **cns-dashboard** | HTTP endpoint + validators + tests | 77-5 UI |
| **Omnipotent.md** | None | 77-2 pull client, 77-4 skill |

Work from `../cns-dashboard` (or set `CNS_DASHBOARD_ROOT`). Commit in cns-dashboard repo.

### Architecture compliance

- **ADR-HERMES-001:** `/nexus` remains awareness UI; this endpoint serves **WSL Hermes pull**, not browser.
- **ADR-HERMES-002:** Fixed DTO; bearer `HERMES_CONVEX_READ_KEY`; not Convex MCP at runtime.
- **ADR-E63-005:** Never introduce `NEXUS_*` env vars — use `HERMES_*` / `CNS_*`.
- **ADR-E46-003:** Secrets stay server-side — read key only in Convex env + future WSL env (77-2), never `PUBLIC_*`.
- **No schema redesign** per architecture Data Architecture section.

### Current code state (READ BEFORE EDIT)

**`convex/dashboard.ts`** — `getDashboardSnapshot` returns full snapshot including `noteIndex` and `agentLogEntries`. Awareness endpoint must **omit** those fields while reusing vault/chain/mcp/sync reads:

```117:148:/home/christ/ai-factory/projects/cns-dashboard/convex/dashboard.ts
export const getDashboardSnapshot = query({
	args: {},
	handler: async (ctx) => {
		const [vaultHealthRows, mcpStatus, agentLogEntries, runChainStatusRows, noteIndex, syncMetadataRows] =
			await Promise.all([
				// ...
			]);
		return {
			vaultHealth: readSingletonRow(vaultHealthRows, 'vaultHealth'),
			mcpStatus: sortMcpByName(strippedMcp),
			agentLogEntries: sortByTimestamp(strippedAgentLog),
			runChainStatus: readSingletonRow(runChainStatusRows, 'runChainStatus'),
			noteIndex: [...strippedNotes].sort((a, b) => b.modifiedAt - a.modifiedAt),
			syncMetadata: readSingletonRow(syncMetadataRows, 'syncMetadata')
		};
	}
});
```

**`convex/digest.ts`** — `getLatestDigestBrief` + `getDigestSignalsForRun({ limit: 5 })` for digest section.

**`convex/entityIntelligence.ts`** — `getEntityIntelligence({ now })` then slice `trackedInMotion.slice(0, 5)`, `emergingToReview.slice(0, 3)`.

**`convex/investigationBoard.ts`** — `listInvestigationBoard` returns full items; awareness needs **counts only** — query `investigationBoardItems` by column index or map `listInvestigationBoard` to counts without serializing items.

**`convex/trendIntelligence.ts`** — `getRecentAnomalies({ hours: 24 })` slice 3; `getLatestScores({ limit: 3 })`.

### Existing validators to compose (do not duplicate field defs)

From `convex/validators.ts`:

- `syncMetadataValidator`, `vaultHealthValidator`, `runChainStatusValidator`, `mcpStatusRowValidator`
- `digestSignalListItemValidator`, `entityLaneItemValidator`
- `investigationBoardColumnValue` for column count keys

### HTTP implementation pattern (Context7 — Convex docs)

```typescript
// convex/http.ts — pattern only
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

http.route({
  path: '/hermes/awareness',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!verifyHermesBearer(request)) {
      return new Response(null, { status: 401 });
    }
    const snapshot = await ctx.runQuery(internal.hermesAwareness.buildSnapshot, {});
    return Response.json(snapshot);
  })
});

export default http;
```

**Deploy note:** HTTP routes are served from the deployment's `.convex.site` URL (not `.convex.cloud`). Document both URLs in DEPLOY.md — 77-2 pull client will call `.convex.site/hermes/awareness`.

**Auth note:** This is a **custom static bearer**, not Convex JWT auth. Do not use `ctx.auth.getUserIdentity()` for this route.

### DTO naming alignment (77-2 / dashboard-sync)

Field names must align with:

- `dashboardSnapshotValidator` for overlapping sections (`vaultHealth` → response key `vault`, etc.)
- `scripts/dashboard-sync.ts` mirror comment pattern (Omnipotent) — 77-2 will add TypeScript types with sync comment referencing `hermesAwarenessSnapshotValidator`

Top-level keys use **short names** (`sync`, `vault`, `chain`) per ADR-HERMES-002, not `syncMetadata` / `vaultHealth`.

### Testing strategy

- **Primary:** Test `internal.hermesAwareness.buildSnapshot` via `convex-test` + `t.query(internal.hermesAwareness.buildSnapshot, {})` — same pattern as `tests/convex/dashboard.test.ts`.
- **Auth:** Unit-test `verifyHermesBearer` with mock `Request` objects and env stub.
- **HTTP integration:** Optional `t.fetch` against registered route if convex-test supports HTTP in this project version; if not, auth unit tests + internalQuery tests satisfy AC5.
- **Fixtures:** Seed via `ingestDashboardSnapshot`, digest mutations, entity mention fixtures — copy patterns from `tests/convex/entityIntelligence.test.ts`, `digest.test.ts`.

### Cross-story context (Epic 77)

| Story | Depends on 77-1 |
|-------|-----------------|
| 77-2 | Pull client calls this endpoint |
| 77-3 | Webhook push — independent |
| 77-4 | Skill invokes 77-2 pull |
| 77-5 | UI uses Convex reactive queries (may share validators, not this HTTP route) |
| 77-7 | Retention decision for dashboard-sync vs pull |

### Protect-list / WriteGate

**Not applicable** — cns-dashboard story; no vault WriteGate, no Omnipotent adapter paths.

### Project structure notes

```
cns-dashboard/
├── convex/
│   ├── http.ts                 # NEW
│   ├── hermesAwareness.ts      # NEW
│   └── validators.ts           # UPDATE
├── tests/convex/
│   └── hermes-awareness.test.ts  # NEW
└── docs/DEPLOY.md              # UPDATE
```

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` — Epic 77, Story 77-1]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` § ADR-HERMES-002]
- [Source: `../cns-dashboard/project-context.md` — Epic 77 planned files]
- [Source: `../cns-dashboard/convex/validators.ts` — composable validators]
- [Source: `../cns-dashboard/convex/dashboard.ts` — singleton read patterns]
- [Source: Convex docs — `httpRouter`, `httpAction`, `ctx.runQuery` via Context7 `/llmstxt/convex_dev_llms_txt`]

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor)

### Debug Log References

- `bash scripts/verify.sh` — 587 tests passed, lint/typecheck/build green

### Completion Notes List

- Added `GET /hermes/awareness` HTTP route with bearer auth (`HERMES_CONVEX_READ_KEY`)
- `internal.hermesAwareness.buildSnapshot` assembles fixed DTO (no `noteIndex` / `agentLogEntries`)
- Extracted singleton read helpers to `convex/lib/dashboard_read.ts`
- DTO validators in `convex/validators.ts`; DEPLOY.md documents Convex env key + `.convex.site` URL

### File List

- `convex/http.ts` (new)
- `convex/hermesAwareness.ts` (new)
- `convex/lib/dashboard_read.ts` (new)
- `convex/lib/hermes_auth.ts` (new)
- `convex/validators.ts` (updated)
- `convex/dashboard.ts` (updated — uses shared read helpers)
- `tests/convex/hermes-awareness.test.ts` (new)
- `docs/DEPLOY.md` (updated)
