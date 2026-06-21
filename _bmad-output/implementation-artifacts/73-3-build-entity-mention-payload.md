# Story 73.3: Build Entity Mention Payload

Status: ready-for-dev

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **Omnipotent.md only** (canonical payload builder + round-trip test). No cns-dashboard code changes unless validator drift requires sync with 73-1.  
**Normative spec:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §3.2, §4.3, §7, ADR-E73-007  
**Prerequisites:** **73-1** (live `entityMentionInputValidator` in cns-dashboard), **73-2** (`extract-entities.mjs`)  
**Blocks:** 73-4 (orchestrator calls this builder)

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a CNS developer wiring the entity intelligence write path,
I want a canonical `buildEntityMentionPayload(run, signals)` that mirrors `buildDigestPushPayload` discipline,
so that every `entityMentions` field round-trips through the real Convex validator and registry drift is prevented before HTTP push.

## Acceptance Criteria

### AC1 — Module and canonical builder (§4.1, §7, ADR-E73-007)

**Given** architecture §4.1 and ADR-E73-007 validator discipline  
**When** implementation is complete  
**Then** new file exists:

`scripts/hermes-skill-examples/morning-digest/scripts/build-entity-mention-payload.mjs`

**And** exports:

- `buildEntityMentionPayload(run, signals)` → `entityMentionInputValidator[]` shaped objects (plain JS objects matching Convex validator)
- `buildCanonicalEntityMentionFixture()` — minimal canonical row for tests (mirror `buildCanonicalPinterestDigestSignal` pattern)

**And** builder:

- Calls `aggregateRunEntities(signals)` from `extract-entities.mjs` (73-2)
- Maps run metadata: `digestRunId`, `ranAt`, `date` from `run` object
- Sets `workspaceId` when present on run/signals
- Ensures all §3.1 business rules before return (`mentionCount`, `signalRefs` cap, `tracked` ⟹ `person`)

### AC2 — Round-trip validator test (§7)

**Given** `tests/morning-digest-entity-mention-payload.test.mjs`  
**When** `npm test` runs  
**Then** `buildEntityMentionPayload(run, signals)` output:

- Matches expected field keys for a multi-entity fixture run
- Canonical fixture passes validation against **real** `entityMentionInputValidator` from cns-dashboard

**Validator import strategy (pick one, document in test):**

1. **Preferred:** dynamic import or JSON schema export from cns-dashboard if test harness already cross-repos
2. **Acceptable:** duplicate validator assertion via `convex-test` in cns-dashboard (73-1) + Node test asserts structural equality against documented fixture — **both** must agree

**And** malformed builder output (forced bad fixture) is rejected by validator test in cns-dashboard `entityIntelligence.test.ts` (73-1) — this story adds Node-side shape tests

### AC3 — Integration with push payload shape

**Given** a scored `buildDigestPushPayload()` result  
**When** `buildEntityMentionPayload(run, signals)` is called with the same `run` + `signals[]`  
**Then** each `signalRefs[].digestSignalId` uses the **Convex-assigned** `digestSignalId` from push response (not pre-push)  
**And** document in dev notes: orchestrator (73-4) must call builder **after** signals are inserted and ids are known — builder accepts signals augmented with `digestSignalId` field post-push

### AC4 — Fixture test coverage (§11)

**Given** `tests/morning-digest-entity-mention-payload.test.mjs`  
**When** tests run  
**Then** coverage includes:

- Person tracked entity from `peopleMatch`
- Account from `authorHandle`
- Org from GitHub URL
- Multi-entity run → multiple mention rows
- `coMentionedTrackedEntities` populated when two tracked people in same run
- `signalRefs` capped at 5, ordered by rankScore
- Empty signals array → empty mentions array

### AC5 — Verify gate

**Given** implementation complete  
**When** `bash scripts/verify.sh` runs  
**Then** all pass

### AC6 — Out of scope

- HTTP Convex mutations (73-4)
- `clearEntityMentionsForRun` calls (73-4)
- `getEntityIntelligence` (73-5)
- Schema changes beyond what 73-1 shipped

## Tasks / Subtasks

### Prerequisite gate

- [ ] **T0 — Dependency check**
  - [ ] T0.1 Confirm 73-1 merged: `entityMentionInputValidator` exists in cns-dashboard
  - [ ] T0.2 Confirm 73-2 merged: `extract-entities.mjs` exports `aggregateRunEntities`

- [ ] **T1 — Builder module** (AC: 1, 3)
  - [ ] T1.1 `buildEntityMentionPayload(run, signals)`
  - [ ] T1.2 Map aggregates → validator row shape per §3.1
  - [ ] T1.3 `buildCanonicalEntityMentionFixture()` for shared test anchor

- [ ] **T2 — Tests** (AC: 2, 4, 5)
  - [ ] T2.1 `tests/morning-digest-entity-mention-payload.test.mjs`
  - [ ] T2.2 Mirror `tests/morning-digest-build-payload.test.mjs` structure
  - [ ] T2.3 Optional: `tests/fixtures/entity-mention.fixture.mjs` for canonical row
  - [ ] T2.4 `bash scripts/verify.sh`

## Dev Notes

### Prerequisite gate

| Story | Delivers | Blocks this story |
|-------|----------|-------------------|
| **73-1** | `entityMentionInputValidator` | **Yes** — round-trip target |
| **73-2** | `extract-entities.mjs` | **Yes** — aggregation |
| **Blocks** | **73-4** — orchestrator imports builder |

### Architecture compliance

- **ADR-E73-007:** Single canonical fixture anchor — same class as `buildDigestPushPayload` + `morning-digest-build-payload.test.mjs`
- **§4.3:** Builder produces payloads for clear-then-write; does not call mutations
- **§7:** Round-trip through real validator mandatory

### Files to READ before editing (mandatory)

| File | Current state | Mirror pattern |
|------|---------------|----------------|
| `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` | Canonical payload builder | Export style, `omitUndefinedKeys`, fixture discipline |
| `tests/morning-digest-build-payload.test.mjs` | Round-trip tests | Test layout |
| `scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs` | 73-2 output | Import aggregation |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | Push flow | Where `digestRunId` / signal ids come from |
| `cns-dashboard/convex/validators.ts` | `entityMentionInputValidator` | Field contract |

### Post-push id wiring (critical for 73-4)

Push flow today:

1. `createDigestRun` → `digestRunId`
2. Per signal `addDigestSignal` → `digestSignalId`

`buildEntityMentionPayload` must receive signals with `digestSignalId` populated. Orchestrator pattern:

```javascript
const mentions = buildEntityMentionPayload(
  { digestRunId, ranAt, date, workspaceId },
  pushedSignals, // each signal includes digestSignalId from addDigestSignal response
);
```

### New files (expected)

```
scripts/hermes-skill-examples/morning-digest/scripts/build-entity-mention-payload.mjs
tests/morning-digest-entity-mention-payload.test.mjs
tests/fixtures/entity-mention.fixture.mjs  (optional)
```

### Testing requirements

- Node tests only in Omnipotent.md
- Cross-validator: coordinate with 73-1 convex test using same canonical fixture object

### References

- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §3.2, §4.3, §7, ADR-E73-007]
- [Source: `build-digest-push-payload.mjs` — canonical fixture precedent]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
