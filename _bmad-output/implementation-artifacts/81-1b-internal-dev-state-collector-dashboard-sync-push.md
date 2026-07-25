---
story_id: 81-1b
epic: 81
title: internal-dev-state-collector-dashboard-sync-push
status: done
baseline_commit: b3caaddc9f1c32220c11047622e656e6d4b5f6e1
zone: Omnipotent.md (scripts/lib/collect-internal-dev-state.ts, scripts/dashboard-sync.ts)
branch: hermes-consolidation
prerequisite: cns-dashboard@a0e7c73 (Story 81-1a merged — ingestInternalDevState/getInternalDevState live)
---

# Story 81-1b: Internal Dev-State Collector + Dashboard-Sync Push

Status: done

**Epic:** 81 — Morning Intelligence — Digest Enrichment + Discovery Surface  
**Story split:** **Omnipotent.md half only** of Epic 81 Story 81-1. Convex transport (`ingestInternalDevState` / `getInternalDevState`) is **done** in cns-dashboard Story 81-1a (`cns-dashboard@a0e7c73`).  
**Repo boundary:** Omnipotent.md only — no cns-dashboard edits, no `/nexus` UI, no morning-digest changes (those are 81-2 / 81-3).  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 81-1 (line ~482)  
**Architecture:** `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § FR20/FR21 Internal dev-state transport

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. Ranking heuristic APPROVED 2026-07-05 (operator corrections applied in Dev Notes § Proposed Ranking Heuristic). -->

## Story

As an **operator**,
I want **the existing dashboard-sync cron to collect and push prioritized internal dev-state to Convex**,
so that **deployed `/nexus` can show what to work on without reading WSL files (FR21 transport; FR20 shared collector module)**.

## Acceptance Criteria

### AC1 — Collector module + proposed ranking (shape gate)

**Given** cns-dashboard `prioritizedItemRowValidator` is live (81-1a)  
**When** `scripts/lib/collect-internal-dev-state.ts` is created  
**Then** it exports `collectInternalDevState(opts)` returning `PrioritizedItem[]` (max 20)  
**And** `PrioritizedItem` + `InternalDevStateCategory` types are **hand-mirrored** from `cns-dashboard/convex/validators.ts` with comment:

```typescript
/** Hand-mirrored from cns-dashboard/convex/validators.ts — keep in sync. */
```

(same discipline as `MCP_NAMES` at `scripts/dashboard-sync.ts:20-29`)

**And** four source parsers map 1:1 to category literals — no fifth source:

| Category | Source file | Resolved path |
|----------|-------------|---------------|
| `deferred` | `deferred-work.md` | `{repoRoot}/_bmad-output/implementation-artifacts/deferred-work.md` |
| `sprint` | `sprint-status.yaml` | `{repoRoot}/_bmad-output/implementation-artifacts/sprint-status.yaml` |
| `agent_log` | `agent-log.md` | `{vaultRoot}/_meta/logs/agent-log.md` |
| `vault_scan` | `vault-fast-scan-index.md` | `{vaultRoot}/AI-Context/vault-fast-scan-index.md` |

**And** agent-log parsing **reuses** `parseAgentLogContent()` / `readAgentLogEntries()` from `scripts/dashboard-sync.ts` — do not reimplement pipe-line parsing  
**And** sprint-status parsing follows `parseSprintStatusValue()` regex style (`scripts/dashboard-sync.ts:259-263`) but scans **all** `NNN-N-name: status` keys under `development_status`  
**And** deferred-work parser reads real format: `##` heading sections, free-text body, **no** frontmatter  
**And** vault-scan parser reads real format from `scripts/generate-vault-fast-scan-index.mjs:16-19`: `[TYPE] [path] | [title] | [created]` (skip `#` comment/header lines)  
**And** combined output assigns `rank` 1..N and `rankScore` float per **Proposed Ranking Heuristic** in Dev Notes below  
**And** each item includes human-readable `rationale` and repo/vault-relative `sourcePath`  
**And** ranking/scoring logic is documented in Dev Notes § Proposed Ranking Heuristic (operator-approved 2026-07-05) — dev-story must implement **exactly** that heuristic (do not invent alternate weights during implementation)

### AC2 — Dashboard-sync push extension

**Given** `~/.hermes/dashboard-sync.env` with `CONVEX_URL` + `CONVEX_DEPLOY_KEY` (Epic 77)  
**When** `scripts/dashboard-sync.ts` `main()` runs on the existing `*/3 * * * *` cron tick  
**Then** it builds the dashboard snapshot **and** calls `collectInternalDevState()` in the same invocation  
**And** pushes dev-state via new `pushInternalDevState()` targeting mutation path `internalDevState:ingestInternalDevState`  
**And** HTTP pattern mirrors `pushDashboardSnapshot()` exactly (`scripts/dashboard-sync.ts:556-588`):

- POST `${normalizeConvexUrl(convexUrl)}/api/mutation`
- Header `Authorization: Convex ${deployKey}`
- Body `{ path: "internalDevState:ingestInternalDevState", args: { items }, format: "json" }`

**And** payload is secret-scanned before push (reuse or generalize `scanSnapshotForSecretPatternId` — do not skip scanning for the new payload type)  
**And** **exactly one cron** — extend `main()`, do **not** add a second crontab line  
**And** `--no-push` / missing Convex env skips dev-state push the same way snapshot push is skipped

### AC3 — Independent failure semantics

**Given** both snapshot and dev-state pushes run in one `main()` tick  
**When** dev-state push fails (secret scan hit, HTTP error, Convex mutation error, collector throw)  
**Then** log `FATAL: internal-dev-state push failed: <message>` (or equivalent distinct prefix)  
**And** contribute non-zero exit code  
**And** **do not** block, corrupt, or roll back a successful dashboard snapshot push  
**And** **do not** attempt error-metadata retry push (no `syncMetadata` table for internalDevState in v1 — explicit 81-1a decision)  
**When** snapshot push fails but dev-state succeeds  
**Then** existing snapshot error-snapshot retry behavior is unchanged; dev-state success is not rolled back

### AC4 — Unit tests

**Given** `tests/vault-io/dashboard-sync.test.ts` exists as the dashboard-sync test home  
**When** `npm test` runs  
**Then** new tests cover the collector (new file `tests/vault-io/collect-internal-dev-state.test.ts` preferred for separation, or extend dashboard-sync.test.ts if that matches emerging pattern):

1. **deferred parser** — fixture with multiple `##` sections → expected titles/categories/rationales
2. **sprint parser** — fixture yaml with mixed statuses → only `review`/`in-progress`/`ready-for-dev` surfaced; `backlog`/`done`/`cancelled` excluded
3. **agent_log parser** — reuses shared parser; dedupe/recency behavior on synthetic tail
4. **vault_scan parser** — normative `[TYPE] path | title | created` rows; comment lines skipped
5. **combined rank** — merged fixture → ≤20 items, `rank` 1..N contiguous, `rankScore` descending, categories present

**And** tests use inline fixtures (no live vault dependency)  
**And** cns-dashboard `tests/convex/internal-dev-state.test.ts` already passes from 81-1a (verify gate includes sibling `npm test`)

### AC5 — Sprint tracker (this repo)

**Given** Epic 81 first lands in Omnipotent.md tracker  
**When** this story file is saved  
**Then** `_bmad-output/implementation-artifacts/sprint-status.yaml` gains an `epic-81` section with `epic-81: in-progress` and `81-1b-internal-dev-state-collector-dashboard-sync-push: ready-for-dev`

### AC6 — Verify gate (NFR1)

**Given** implementation complete  
**When** `bash scripts/verify.sh` runs  
**Then** Omnipotent.md `npm test` passes  
**And** sibling `cns-dashboard npm test` passes (`scripts/verify.sh` convention — unlike 81-1a where cns-dashboard build was explicitly skipped)

---

## Tasks / Subtasks

### Collector (AC1)

- [x] **T1 — Types + module scaffold** (AC: 1)
  - [x] T1.1 Create `scripts/lib/collect-internal-dev-state.ts` with hand-mirrored `PrioritizedItem` / category union
  - [x] T1.2 Export `collectInternalDevState({ repoRoot, vaultRoot, now? })` orchestrator
  - [x] T1.3 Implement four pure parser functions (one per category) with missing-file → `[]` (not throw)

- [x] **T2 — Ranking** (AC: 1)
  - [x] T2.1 Implement `scoreAndRankCandidates()` per Dev Notes § Proposed Ranking Heuristic (approved 2026-07-05)
  - [x] T2.2 Enforce global cap 20 before push (collector must never send >20 — Convex throws)

### Dashboard-sync integration (AC2, AC3)

- [x] **T3 — Push path** (AC: 2, 3)
  - [x] T3.1 Add `INGEST_INTERNAL_DEV_STATE_PATH`, `buildIngestInternalDevStateRequest()`, `pushInternalDevState()`
  - [x] T3.2 Add `scanInternalDevStateForSecretPatternId()` (generalize snapshot scanner or thin wrapper)
  - [x] T3.3 Extend `main()` / `collectAndMaybePush` flow: snapshot first, dev-state second; independent exit codes
  - [x] T3.4 Success log line includes dev-state item count

### Tests + verify (AC4, AC6)

- [x] **T4 — Tests** (AC: 4)
  - [x] T4.1 `tests/vault-io/collect-internal-dev-state.test.ts` — four parsers + combined rank
  - [x] T4.2 Push request builder test (path + args shape)

- [x] **T5 — Verify** (AC: 6)
  - [x] T5.1 `bash scripts/verify.sh` green

---

## Dev Notes

### Ranking heuristic — operator approved (2026-07-05)

Chris approved Dev Notes § Proposed Ranking Heuristic with four corrections (recency formulas, exclude `backlog`, no per-category caps, no synthetic epic items). T2 is unblocked for `/bmad-dev-story`.

### Confirmed Convex row shape (81-1a — do not deviate)

Live in `cns-dashboard/convex/validators.ts` + `internalDevState.ts`:

| Field | Type | Notes |
|-------|------|-------|
| `rank` | `number` | 1-based display position |
| `rankScore` | `number` | Underlying float that produced rank |
| `title` | `string` | Human headline |
| `category` | `'deferred' \| 'sprint' \| 'agent_log' \| 'vault_scan'` | Closed union |
| `rationale` | `string` | Why surfaced (shown in UI) |
| `sourcePath` | `string` | Vault/repo-relative path |

Cap: Convex rejects `items.length > 20` with `ConvexError`. Collector must truncate/sort to ≤20 **before** push.

### Proposed Ranking Heuristic (APPROVED — implement exactly)

Design goals: surface **actionable internal work** first (sprint items in flight), then **known deferred debt**, then **recent agent activity**, then **fresh vault notes**. Scores are 0–100 floats; final list sorted `rankScore` desc, tie-break `title` asc; `rank` assigned 1..N after sort.

#### Step 1 — Per-source candidate extraction

**A. `sprint` (from `sprint-status.yaml`)**

- Scan `development_status:` for keys matching `/^\s*(\d+-\d+\w*(?:-[\w-]+)*):\s*(\S+)/` (exclude `epic-*`, `*-retrospective`, `pre-*` checklist keys).
- **Include** statuses: `review`, `in-progress`, `ready-for-dev` only.
- **Exclude** statuses: `backlog`, `done`, `cancelled`, `deferred`, `optional`, comments-only lines.
- **No synthetic items** for `epic-*` keys or other epic-level entries without a matching story key.
- `title` = story key (e.g. `81-1b-internal-dev-state-collector-dashboard-sync-push`).
- `rationale` = `Sprint status: {status}` (+ epic comment from nearest preceding `# Epic N` line when present).
- `sourcePath` = `_bmad-output/implementation-artifacts/sprint-status.yaml`.

**B. `deferred` (from `deferred-work.md`)**

- Each `## {heading}` section → one candidate (skip `# Deferred work` document title).
- `title` = heading text trimmed (e.g. `Hermes self-improvement ungoverned skill writes`).
- `rationale` = first `**Surfaced by:**` line if present, else first non-empty body line (max 120 chars).
- `sourcePath` = `_bmad-output/implementation-artifacts/deferred-work.md`.
- `surfacedAt` = parse date from heading suffix `(YYYY-MM-DD)` or `**Surfaced by:**` line if parseable; else `null`.

**C. `agent_log` (from vault `agent-log.md`)**

- `readAgentLogEntries(vaultRoot)` → last 20 valid pipe lines (existing limit).
- **Dedupe** by `targetPath`, keep entry with max `timestamp`.
- `title` = `{action} {targetPath}` (e.g. `read 03-Resources/foo.md`).
- `rationale` = `{tool} via {surface}: {summary}` (truncated 120 chars).
- `sourcePath` = `_meta/logs/agent-log.md`.

**D. `vault_scan` (from `AI-Context/vault-fast-scan-index.md`)**

- Parse data lines: `/^(SRC|INS|SYN|DLY|OTH)\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d{4}-\d{2}-\d{2})$/`.
- Skip `#` header/comment lines.
- `title` = note title field.
- `rationale` = `Fast-scan: {TYPE} note modified {created}`.
- `sourcePath` = vault-relative path from row (e.g. `03-Resources/CNS-Operator-Guide.md`).
- Index may be stale between session-close runs — expected, not a bug.

#### Step 2 — Base score table

| Source | Condition | Base `rankScore` |
|--------|-----------|------------------|
| sprint | `review` | 92 |
| sprint | `in-progress` | 88 |
| sprint | `ready-for-dev` | 78 |
| deferred | section with `blocking` / `blocker` / `FATAL` in first 3 body lines (case-insensitive) | 72 |
| deferred | default section | 62 |
| agent_log | vault **mutation** tools (`vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`, `vault_log_action`) | 58 |
| agent_log | read-only / other tools | 48 |
| vault_scan | `SYN` or `INS` type | 42 |
| vault_scan | `SRC` type | 38 |
| vault_scan | `DLY` or `OTH` | 32 |

#### Step 3 — Recency adjustments (additive, clamp final score to [0, 100])

| Source | Adjustment |
|--------|------------|
| sprint | none (status is primary signal) |
| deferred | `+min(8, daysSince(surfacedAt, now))` when `surfacedAt` within 30 days; **intentional:** older unaddressed debt ranks higher within the window |
| agent_log | `+max(0, 12 - hoursSince(timestamp, now) / 2)` — fresher activity scores higher (up to +12 at `hoursSince` = 0) |
| vault_scan | `+max(0, 10 - daysSince(created, now) * (10/14))` — fresher notes score higher (up to +10 at `daysSince` = 0; 0 bonus at ≥14 days) |

#### Step 4 — Merge, cap, assign rank

1. Union all candidates with computed `rankScore`.
2. Sort: `rankScore` desc → `category` priority (`sprint` > `deferred` > `agent_log` > `vault_scan`) → `title` asc.
3. Take first **20** rows — **pure global top-20 by `rankScore`; no per-category soft caps**.
4. Assign `rank` = 1..N in sort order.

**Operator decisions (2026-07-05):**

1. **`backlog` excluded** from sprint candidate extraction (Step 1A).
2. **No per-category soft caps** — global top-20 only (Step 4).
3. **No synthetic epic-level items** when no story key exists (Step 1A).
4. **Recency formulas corrected** for `agent_log` and `vault_scan` (reward freshness); `deferred` recency unchanged (reward older debt).

### Files to read before editing (mandatory)

| File | Why |
|------|-----|
| `scripts/dashboard-sync.ts` | `parseAgentLogContent`, `readAgentLogEntries`, `pushDashboardSnapshot`, `scanSnapshotForSecretPatternId`, `main()` |
| `scripts/dashboard-sync.ts:20-29` | Hand-mirror comment discipline |
| `scripts/dashboard-sync.ts:556-588` | Convex HTTP push pattern |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Real deferred format |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Real sprint format |
| `scripts/generate-vault-fast-scan-index.mjs:16-19` | vault-scan line format |
| `cns-dashboard/convex/validators.ts` | `prioritizedItemRowValidator` SSOT |
| `cns-dashboard/convex/internalDevState.ts` | Ingest contract |
| `cns-dashboard/_bmad-output/implementation-artifacts/81-1a-internal-dev-state-convex-transport.md` | Sister story decisions |

### `main()` integration sketch (independent failures)

```typescript
// Pseudocode — snapshot path unchanged; dev-state additive
const snapshotResult = await collectAndMaybePush({ ... });
let exitCode = snapshotResult.exitCode;

if (push && convexUrl && deployKey) {
  try {
    const items = await collectInternalDevState({ repoRoot, vaultRoot, now });
    const patternId = await scanInternalDevStateForSecretPatternId(items, vaultRoot);
    if (patternId !== null) {
      console.error(`FATAL: internal-dev-state matches secret pattern: ${patternId}`);
      exitCode = 1;
    } else {
      await pushInternalDevState(items, { convexUrl, deployKey });
      console.log(`dashboard-sync: pushed ${items.length} internal dev-state items`);
    }
  } catch (err) {
    console.error(`FATAL: internal-dev-state push failed: ${message}`);
    exitCode = exitCode || 1;
  }
}

return exitCode;
```

### Cron (confirmed — do not duplicate)

```
*/3 * * * * ... cd /home/christ/ai-factory/projects/Omnipotent.md && npx tsx scripts/dashboard-sync.ts ...
```

Single cron; "same tick" = same `main()` invocation.

### Architecture firewall (out of scope)

- No Vercel server routes reading WSL paths
- No browser Brain calls
- No morning-digest import yet (81-2)
- No `DiscoveryWorkPanel.svelte` (81-3)

### Protect-list / governance

- No WriteGate / `vault_log_action` changes
- No `security.md` edits
- Collector is **read-only** on all four sources
- Secret scan before push is mandatory (Epic 42-4 discipline)

### Test location

Primary home: `tests/vault-io/collect-internal-dev-state.test.ts` (new). Mirror vitest style from `tests/vault-io/dashboard-sync.test.ts`. Add push-builder test there or in dashboard-sync.test.ts.

### Epic 81 dependency graph

| Story | Repo | Status |
|-------|------|--------|
| 81-1a | cns-dashboard | done (`a0e7c73`) |
| **81-1b** | **Omnipotent.md** | **this story** |
| 81-2 | Omnipotent.md | backlog — imports same collector for digest block |
| 81-3 | cns-dashboard | backlog — `DiscoveryWorkPanel.svelte` |

### Previous story intelligence (81-1a)

- `rankScore` not `score`; bare `PrioritizedItem[]` query return; no `syncMetadata` retry table.
- `ingestInternalDevState` uses deploy-key auth (no `ctx.auth`) — same as dashboard snapshot.
- Empty `items: []` is valid (clears panel).
- Hand-mirror comment required on Omnipotent types.

### Git / codebase patterns

- `scripts/lib/` already hosts digest/hermes helpers — new collector fits here.
- Dashboard-sync exports parsers for test reuse — import from `dashboard-sync.ts` or extract shared imports if circular risk appears (prefer importing existing exports).
- `RUN_CHAIN_STORY_KEY` pattern (`dashboard-sync.ts:112`) shows single-key sprint parse exists; this story needs **full** `development_status` scan instead.

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor) — dev-story pass 2026-07-05

### Completion Notes List

- Story created with ranking heuristic in Dev Notes; operator approved 2026-07-05 (recency fix, exclude backlog, no caps, no synthetic epics).
- cns-dashboard transport confirmed at `a0e7c73`; row shape locked.
- Cron confirmed single `dashboard-sync.ts` invocation every 3 min.
- **Implementation complete (2026-07-05):** Added `scripts/lib/collect-internal-dev-state.ts` with four parsers, approved ranking heuristic (base scores + recency adjustments, global top-20 cap), and `collectInternalDevState()` orchestrator. Extended `scripts/dashboard-sync.ts` with `pushInternalDevState()`, `scanInternalDevStateForSecretPatternId()`, and independent dev-state push in `main()` after snapshot (non-blocking failure semantics). 15 unit tests in `tests/vault-io/collect-internal-dev-state.test.ts`. `bash scripts/verify.sh` green (Omnipotent.md + cns-dashboard).

### Scope deviation

- **Sprint story-key regex:** Dev Notes Step 1A documents `/^\d+-\d+-[\w-]+/` but real keys include alphanumeric story ids (e.g. `81-1b-internal-dev-state-collector-dashboard-sync-push`). Implemented `/^\s*(\d+-\d+\w*(?:-[\w-]+)*):\s*(\S+)/` to match all story keys under `development_status` while still excluding `epic-*`, `*-retrospective`, and `pre-*` keys per AC.

### File List

- `_bmad-output/implementation-artifacts/81-1b-internal-dev-state-collector-dashboard-sync-push.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (epic-81 section; 81-1b → review)
- `scripts/lib/collect-internal-dev-state.ts` (new)
- `scripts/dashboard-sync.ts` (dev-state push + main() integration)
- `tests/vault-io/collect-internal-dev-state.test.ts` (new)

### Change Log

- 2026-07-05: Story 81-1b implementation — internal dev-state collector + dashboard-sync push (Composer dev-story)

---

## References

- Epic spec: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Epic 81, Story 81-1
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § FR20/FR21
- Sister story: `cns-dashboard/_bmad-output/implementation-artifacts/81-1a-internal-dev-state-convex-transport.md`
- Dashboard sync: `scripts/dashboard-sync.ts` (Epic 42-3/42-4, Epic 77)
- PRD FR21: `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md` § FR21 Discovery surface
- Research seed: `_bmad-output/planning-artifacts/research-hermes-omniscience-resurfacing.md` (internal dev-state gap)
