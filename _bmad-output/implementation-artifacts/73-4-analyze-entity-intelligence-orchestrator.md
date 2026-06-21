# Story 73.4: Analyze Entity Intelligence Orchestrator

Status: ready-for-dev

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **Omnipotent.md** (Node orchestrator + completion hook). Uses cns-dashboard mutations via HTTP (no Convex code changes in this story unless push client needs path registration).  
**Normative spec:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §4.1, §4.3, ADR-E73-001, ADR-E73-002  
**Prerequisites:** **73-1** (`clearEntityMentionsForRun`, `recordEntityMentions`), **73-3** (`buildEntityMentionPayload`)  
**Blocks:** 73-5 (real lane data), 73-7 (pipeline ordering expects this stage before digest entity fetch)

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a CNS operator running the morning digest,
I want a post-push Node stage that writes per-run entity mention snapshots via clear-then-write idempotency,
so that entity baselines accrue after each digest without failing the digest, without Convex reads in the write path, and without duplicating extraction in Convex.

## Acceptance Criteria

### AC1 — Orchestrator module (§4.1, ADR-E73-001)

**Given** architecture §4.1  
**When** implementation is complete  
**Then** new file exists:

`scripts/hermes-skill-examples/morning-digest/scripts/analyze-entity-intelligence.mjs`

**And** exports async function `runAnalyzeEntityIntelligence(scoredPayload, env, options?)` where:

- `scoredPayload` = in-memory result from digest push path (run + signals with Convex ids)
- Operates on **in-memory pushed signals** — **no Convex reads** (ADR-E73-001)
- Steps:
  1. `buildEntityMentionPayload(run, signals)` (73-3)
  2. If mentions empty → skip HTTP (optional log)
  3. `clearEntityMentionsForRun({ digestRunId })` via HTTP mutation
  4. `recordEntityMentions({ mentions })` via HTTP mutation
- On any error: **stderr warning**, return without throwing; caller treats as exit 0 (§8 degraded mode)

### AC2 — Clear-then-write idempotency (§4.3, ADR-E73-002)

**Given** a `digestRunId` already has `entityMentions` rows  
**When** `runAnalyzeEntityIntelligence` runs again for the same run (re-analysis / force-rescore)  
**Then** orchestrator calls `clearEntityMentionsForRun` **before** `recordEntityMentions`  
**And** stale snapshots from a different signal set cannot survive  
**And** **no** no-op-if-exists strategy

### AC3 — HTTP mutation calls (mirror push-digest-convex)

**Given** `resolveConvexPushEnv()` from `push-digest-convex.mjs`  
**When** mutations are invoked  
**Then** use same auth pattern as digest push: `POST {CONVEX_URL}/api/mutation` with `Authorization: Convex {deployKey}`  
**And** paths: `entityIntelligence:clearEntityMentionsForRun`, `entityIntelligence:recordEntityMentions`  
**And** reuse or extend existing HTTP helper from `push-digest-convex.mjs` / `push-digest-watchdog.mjs` (DRY if low risk)

### AC4 — Wire into completion orchestrator (§4.1)

**Given** `scripts/run-digest-convex-completion.mjs`  
**When** `scoreWriteAndPush()` completes successful `pushPayload()`  
**Then** invoke `runAnalyzeEntityIntelligence` with the pushed payload (run + signal ids)  
**And** entity stage runs **after** Convex push, **before** Discord post (73-7 extends Discord path)  
**And** repair/replay branches that push digest also invoke entity stage when push succeeds  
**And** entity stage failure does **not** block Discord or exit non-zero from completion cron (fire-and-forget)

### AC5 — Tests

**Given** `tests/analyze-entity-intelligence.test.mjs` (or extend `run-digest-convex-completion.test.mjs`)  
**When** `npm test` runs  
**Then** tests cover (with mocked `fetchFn`):

- Happy path: clear → record call order with correct args
- Empty mentions: no mutation calls
- Mutation failure: stderr logged, no throw
- Re-run: clear called even when prior snapshots existed

**And** `bash scripts/verify.sh` passes

### AC6 — Out of scope

- `getEntityIntelligence` query (73-5)
- Digest markdown entity sections (73-7)
- Dashboard UI (73-6)
- Extraction logic changes (73-2) unless bug found during integration
- WriteGate / vault

## Tasks / Subtasks

### Prerequisite gate

- [ ] **T0 — Dependency check**
  - [ ] T0.1 73-1: mutations deployed / available in dev Convex
  - [ ] T0.2 73-3: `buildEntityMentionPayload` exported

- [ ] **T1 — `analyze-entity-intelligence.mjs`** (AC: 1, 2, 3)
  - [ ] T1.1 `runAnalyzeEntityIntelligence(scoredPayload, env, { fetchFn })`
  - [ ] T1.2 `postConvexMutation(path, args, env)` helper or reuse existing
  - [ ] T1.3 Clear-then-write sequence locked

- [ ] **T2 — Completion wiring** (AC: 4)
  - [ ] T2.1 Export orchestrator from analyze module for completion import
  - [ ] T2.2 `run-digest-convex-completion.mjs` — call after `pushPayload` success in `scoreWriteAndPush` and repair paths
  - [ ] T2.3 Ensure pushed payload retains `digestRunId` + per-signal `digestSignalId` (extend push return if needed)

- [ ] **T3 — Tests** (AC: 5)
  - [ ] T3.1 Mock fetch tests for mutation order
  - [ ] T3.2 Completion orchestration test stub
  - [ ] T3.3 `bash scripts/verify.sh`

## Dev Notes

### Prerequisite gate

| Story | Delivers | Blocks this story |
|-------|----------|-------------------|
| **73-1** | Mutations | **Yes** |
| **73-3** | Payload builder | **Yes** |
| **73-2** | Indirect via 73-3 | — |
| **Blocks** | **73-5** (data), **73-7** (pipeline order) | |

### Architecture compliance

- **ADR-E73-001:** Post-push, in-memory, no Convex reads on write path
- **ADR-E73-002:** Clear-then-write — not optional
- **§8:** stderr + exit 0 on failure — digest must not fail

### Files to READ before editing (mandatory)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `scripts/run-digest-convex-completion.mjs` | `pushPayload`, `scoreWriteAndPush` | Add post-push hook |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | `resolveConvexPushEnv`, push mutations | HTTP pattern |
| `scripts/push-digest-watchdog.mjs` | `postQuery` pattern | Optional DRY for HTTP |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-entity-mention-payload.mjs` | 73-3 | Import builder |

### Push return value (may need extension)

Verify `pushPayload()` returns or can derive:

```javascript
{
  digestRunId,
  ranAt,
  date,
  signals: [{ digestSignalId, ...signalFields }]
}
```

If push only returns `digestRunId`, extend push wrapper to collect `addDigestSignal` ids — **required** for `signalRefs` in mentions.

### Pipeline order (locked for 73-7)

```
pushPayload()
  → runAnalyzeEntityIntelligence()   // this story
  → (73-7) fetch getEntityIntelligence + render markdown
  → postDigestToDiscord()
```

### New files (expected)

```
scripts/hermes-skill-examples/morning-digest/scripts/analyze-entity-intelligence.mjs
tests/analyze-entity-intelligence.test.mjs
```

### Modified files (expected)

```
scripts/run-digest-convex-completion.mjs
scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs  (if return shape extended)
```

### Testing requirements

- Mock `fetchFn` — no live Convex in unit tests
- Optional manual: run completion dry-run with dev Convex

### References

- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §4.1, §4.3, §8, ADR-E73-001, ADR-E73-002]
- [Source: Epic 64 §9 fire-and-forget scoring stage]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
