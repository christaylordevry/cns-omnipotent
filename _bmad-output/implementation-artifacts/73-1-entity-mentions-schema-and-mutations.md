---
baseline_commit: 9dcd017636efd813593b6798556e38f94a080485
---

# Story 73.1: Entity Mentions Schema and Mutations

Status: done

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **cns-dashboard only** (Convex schema, validators, mutations). No Omnipotent.md script changes in this story.  
**Normative spec:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §3, ADR-E73-002  
**Blocks:** 73-3 (validator round-trip), 73-4 (`recordEntityMentions` / `clearEntityMentionsForRun`), 73-5 (`getEntityIntelligence` reads table)

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a CNS operator relying on entity intelligence baselines,
I want a persisted `entityMentions` Convex table with batched write and per-run clear mutations,
so that post-push entity snapshots are durable, indexed, and validator-guarded without duplicating extraction logic in Convex.

## Acceptance Criteria

### AC1 — Validators and table schema (§3.1)

**Given** the Epic 73 architecture §3.1 contract  
**When** `cns-dashboard/convex/validators.ts` is updated  
**Then** it exports:

- `entityTypeValue` — union `person | account | org`
- `entityMentionSignalRefValidator` — `{ digestSignalId, title, url?, sourceType }` (compact evidence ref)
- `entityMentionInputValidator` — full input row per architecture §3.1 (all fields listed)
- `entityMentionRowValidator` — identical shape to input (persisted row)

**And** `cns-dashboard/convex/schema.ts` defines:

```typescript
entityMentions: defineTable(entityMentionRowValidator)
  .index('by_entityKey', ['entityKey'])
  .index('by_ranAt', ['ranAt'])
  .index('by_digestRunId', ['digestRunId']),
```

**And** validation rules enforced at insert (mutation handler or shared helper):

- `mentionCount >= 1`, `distinctSignalCount >= 1`, `distinctSignalCount <= mentionCount`
- `0 <= maxPersonalRelevance <= 100`, `0 <= maxRankScore <= 100` when present
- `sourceTypes` non-empty; each entry is valid `digestSourceTypeValue`
- `signalRefs` length 1..5
- `tracked === true` ⟹ `entityType === 'person'` in v1

**And** **no fields** are added to `digestSignals` or `digestRuns` (§3.3)

### AC2 — `recordEntityMentions` mutation (§3.2)

**Given** a batched array of valid `entityMentionInputValidator` rows  
**When** `recordEntityMentions` is called via Convex HTTP API  
**Then** each row is inserted into `entityMentions`  
**And** parent `digestRunId` must exist (mirror `addDigestSignal` parent check — throw `digestRun not found` if missing)  
**And** returns `{ inserted: number }`  
**And** mutation is **public-by-design** (morning-digest push pattern, same as `addDigestSignal`)

### AC3 — `clearEntityMentionsForRun` mutation (§3.2, ADR-E73-002)

**Given** existing `entityMentions` rows for a `digestRunId`  
**When** `clearEntityMentionsForRun({ digestRunId })` runs  
**Then** all rows with that `digestRunId` are deleted via `by_digestRunId` index  
**And** returns `{ deleted: number }`  
**And** re-analysis idempotency is **clear-then-write** at the orchestrator (73-4) — this mutation does not infer clear internally inside `recordEntityMentions`

### AC4 — New module `entityIntelligence.ts`

**Given** mutations are implemented  
**When** reviewing file layout  
**Then** exports live in `cns-dashboard/convex/entityIntelligence.ts` (new file)  
**And** validators remain in `validators.ts` (existing pattern)  
**And** `convex/_generated/api` picks up new exports after `npx convex dev` / build

### AC5 — Tests and verify gate (§7, §11)

**Given** implementation complete  
**When** `npm test` runs in cns-dashboard and `bash scripts/verify.sh` from Omnipotent.md  
**Then** all pass  
**And** `cns-dashboard/tests/convex/entityIntelligence.test.ts` (new) covers:

- Canonical row built from architecture fixture shape → `entityMentionInputValidator` accepts
- Malformed rows rejected (e.g. `mentionCount: 0`, `signalRefs: []`, `tracked: true` + `entityType: 'org'`)
- `recordEntityMentions` inserts count matches input; parent-missing throws
- `clearEntityMentionsForRun` deletes only matching run rows; second clear returns `deleted: 0`

**And** tests use `convex-test` + `import.meta.glob` pattern from `digest-source-health.test.ts`

### AC6 — Out of scope (explicit)

- Node extraction (`extract-entities.mjs` — 73-2)
- Payload builder (`buildEntityMentionPayload` — 73-3)
- Post-push orchestrator (73-4)
- `getEntityIntelligence` query (73-5)
- `getEntityIntelligenceHealth` (73-8)
- WriteGate / vault mutations

## Tasks / Subtasks

### Schema + validators

- [x] **T1 — Validators** (AC: 1)
  - [x] T1.1 Add entity validators to `convex/validators.ts` per §3.1
  - [x] T1.2 Reuse existing `digestSourceTypeValue` — no new source-type literals

- [x] **T2 — Schema** (AC: 1)
  - [x] T2.1 Import `entityMentionRowValidator` in `schema.ts`
  - [x] T2.2 Add `entityMentions` table + three indexes

### Mutations

- [x] **T3 — `entityIntelligence.ts`** (AC: 2, 3, 4)
  - [x] T3.1 `recordEntityMentions` — validate args, parent check, batch insert
  - [x] T3.2 `clearEntityMentionsForRun` — index scan + delete loop
  - [x] T3.3 Optional shared `assertEntityMentionRow(row)` for business rules beyond Convex validator

### Tests

- [x] **T4 — Convex tests** (AC: 5)
  - [x] T4.1 Create `tests/convex/entityIntelligence.test.ts`
  - [x] T4.2 Canonical fixture object matching architecture §3.1 example fields
  - [x] T4.3 Mutation integration via `convexTest`

- [x] **T5 — Verify gate** (AC: 5)
  - [x] T5.1 `npm test` in cns-dashboard
  - [x] T5.2 `bash scripts/verify.sh` from Omnipotent.md

### Review Findings

- [x] [Review][Patch] Reject non-finite numeric fields so `NaN`/`Infinity` cannot bypass the architecture §3.1 count and score constraints [cns-dashboard/convex/entityIntelligence.ts:10]
- [x] [Review][Patch] Enforce the one-row-per-`(digestRunId, entityKey)` snapshot invariant so duplicate inputs or missed clears cannot inflate 73-5 baseline counts [cns-dashboard/convex/entityIntelligence.ts:48]

## Dev Notes

### Prerequisite gate

| Story | Relationship |
|-------|----------------|
| **None** | First story in Epic 73 backend chain |
| **Blocks** | 73-3 (validator round-trip), 73-4 (HTTP mutations), 73-5 (read table) |

### Architecture compliance

- **ADR-E73-002:** Persisted snapshot table — not stateless aggregation over `digestSignals`
- **ADR-E73-007:** Validator discipline — canonical fixture will round-trip via Node in 73-3; this story owns Convex-side accept/reject tests
- **§1.1:** Public-by-design mutations mirror `addDigestSignal` in `digest.ts`

### Files to READ before editing (mandatory)

| File | Current state | Preserve |
|------|---------------|----------|
| `cns-dashboard/convex/digest.ts` | `addDigestSignal` parent-check + insert pattern | Public mutation shape, error strings |
| `cns-dashboard/convex/validators.ts` | `digestSignalInputValidator`, `sourceMetadataValidator`, `peopleMatch` | Existing digest validators unchanged |
| `cns-dashboard/convex/schema.ts` | `digestRuns`, `digestSignals` indexes | No schema drift on existing tables |
| `cns-dashboard/tests/convex/digest-source-health.test.ts` | `convexTest` harness pattern | Test module glob |

### New files (expected)

```
cns-dashboard/convex/entityIntelligence.ts
cns-dashboard/tests/convex/entityIntelligence.test.ts
```

### Modified files (expected)

```
cns-dashboard/convex/validators.ts
cns-dashboard/convex/schema.ts
```

### Canonical fixture shape (for tests — align with 73-3)

Use a minimal valid row:

```typescript
{
  digestRunId,       // Id<'digestRuns'> from test insert
  ranAt: 1_749_657_600_000,
  date: '2026-06-11',
  entityKey: 'person:andrej karpathy',
  entityType: 'person',
  displayName: 'Andrej Karpathy',
  platform: 'twitter',
  tracked: true,
  mentionCount: 2,
  distinctSignalCount: 2,
  sourceTypes: ['twitter'],
  maxPersonalRelevance: 72,
  maxRankScore: 85,
  coMentionedTrackedEntities: [],
  signalRefs: [{ digestSignalId, title: '...', sourceType: 'twitter' }],
}
```

### Testing requirements

- Validator accept/reject only in this story — lane math tests belong to 73-5
- No WriteGate / vault_log_action

### References

- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §3, ADR-E73-002]
- [Source: `cns-dashboard/convex/digest.ts` — `addDigestSignal` pattern]
- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §10 — story 73-1 row]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Schema index introspection uses `indexDescriptor` array (not object map) — aligned test with `keywordCandidates.test.ts` pattern.

### Completion Notes List

- Added `entityTypeValue`, `entityMentionSignalRefValidator`, `entityMentionInputValidator`, `entityMentionRowValidator` to `validators.ts` per architecture §3.1; reuses `digestSourceTypeValue`.
- Added `entityMentions` table with `by_entityKey`, `by_ranAt`, `by_digestRunId` indexes; no changes to `digestSignals` / `digestRuns`.
- Created `entityIntelligence.ts` with public `recordEntityMentions` (parent check mirrors `addDigestSignal`, batch insert) and `clearEntityMentionsForRun` (index delete, returns count). Clear-then-write idempotency is orchestrator responsibility per ADR-E73-002.
- Exported `assertEntityMentionRow` for §3.1 business rules: mention/distinct counts, score bands, sourceTypes non-empty, signalRefs 1..5, tracked⇒person.
- Added 10 convex-test cases in `entityIntelligence.test.ts` covering validator exports, canonical fixture, malformed and non-finite rejections, insert count, parent-missing throw, duplicate snapshot rejection, and clear idempotency.
- `npm test` (535 tests) and `bash scripts/verify.sh` pass.

### File List

```
cns-dashboard/convex/validators.ts
cns-dashboard/convex/schema.ts
cns-dashboard/convex/entityIntelligence.ts
cns-dashboard/tests/convex/entityIntelligence.test.ts
```

### Change Log

- 2026-06-21: Story 73-1 — entityMentions schema, validators, recordEntityMentions + clearEntityMentionsForRun mutations, convex validator tests.
