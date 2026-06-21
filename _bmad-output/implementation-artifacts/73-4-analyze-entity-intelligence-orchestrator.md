baseline_commit: d9397242797d3358755d76e024f4c63cf020a24d

Status: done

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **Omnipotent.md** (Node orchestrator + completion hook) and **cns-dashboard** (transactional entity replacement and identity-preserving rescore mutations).
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
  2. `replaceEntityMentionsForRun({ digestRunId, mentions })` via HTTP mutation, including empty sets
- On any error: **stderr warning**, return without throwing; caller treats as exit 0 (§8 degraded mode)

### AC2 — Clear-then-write idempotency (§4.3, ADR-E73-002)

**Given** a `digestRunId` already has `entityMentions` rows  
**When** `runAnalyzeEntityIntelligence` runs again for the same run (re-analysis / force-rescore)  
**Then** orchestrator calls transactional `replaceEntityMentionsForRun` on every invocation
**And** stale snapshots from a different signal set cannot survive  
**And** **no** no-op-if-exists strategy

### AC3 — HTTP mutation calls (mirror push-digest-convex)

**Given** `resolveConvexPushEnv()` from `push-digest-convex.mjs`  
**When** mutations are invoked  
**Then** use same auth pattern as digest push: `POST {CONVEX_URL}/api/mutation` with `Authorization: Convex {deployKey}`  
**And** path: `entityIntelligence:replaceEntityMentionsForRun`
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

- Happy path: transactional replacement call with correct args
- Empty mentions: replacement mutation still runs and clears stale rows
- Mutation failure: stderr logged, no throw
- Re-run: replacement runs against the same run and signal ids

**And** `bash scripts/verify.sh` passes

### AC6 — Out of scope

- `getEntityIntelligence` query (73-5)
- Digest markdown entity sections (73-7)
- Dashboard UI (73-6)
- Extraction logic changes (73-2) unless bug found during integration
- WriteGate / vault

## Tasks / Subtasks

### Prerequisite gate

- [x] **T0 — Dependency check**
  - [x] T0.1 73-1: mutations deployed / available in dev Convex
  - [x] T0.2 73-3: `buildEntityMentionPayload` exported

- [x] **T1 — `analyze-entity-intelligence.mjs`** (AC: 1, 2, 3)
  - [x] T1.1 `runAnalyzeEntityIntelligence(scoredPayload, env, { fetchFn })`
  - [x] T1.2 `postConvexMutation(path, args, env)` helper or reuse existing
  - [x] T1.3 Clear-then-write sequence locked

- [x] **T2 — Completion wiring** (AC: 4)
  - [x] T2.1 Export orchestrator from analyze module for completion import
  - [x] T2.2 `run-digest-convex-completion.mjs` — call after `pushPayload` success in `scoreWriteAndPush` and repair paths
  - [x] T2.3 Ensure pushed payload retains `digestRunId` + per-signal `digestSignalId` (extend push return if needed)

- [x] **T3 — Tests** (AC: 5)
  - [x] T3.1 Mock fetch tests for mutation order
  - [x] T3.2 Completion orchestration test stub
  - [x] T3.3 `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] Force-rescore reuses the existing `digestRunId` and complete `digestSignalId` set; partial replay identity fails closed.
- [x] [Review][Patch] Clear and write now execute inside one Convex `replaceEntityMentionsForRun` transaction, so validation or insertion failure rolls back the replacement.
- [x] [Review][Patch] Zero-mention runs invoke transactional replacement with an empty set, clearing stale snapshots unconditionally.
- [x] [Review][Patch] The watchdog `recovered-push` path consumes the push result and records or invokes entity analysis without double-running it.
- [x] [Review][Patch] Entity success, skip, and failure are included in structured invocation/outcome records; failure downgrades an otherwise successful outcome to partial.
- [x] [Review][Patch] Convex push mutations use a bounded 45-second overall abort signal.
- [x] [Review][Patch] `invokePostPushEntityStage` contains unexpected analyzer rejection, preserving Discord and exit-zero degraded behavior.
- [x] [Review][Patch] A successful push without `pushedPayload` emits an actionable structured entity failure instead of silently skipping.
- [x] [Review][Patch] Full `scoreWriteAndPush` coverage asserts push then analyze then Discord while preserving real mock run and signal ids across force-rescore.
- [x] [Review][Patch] Mutation ids reject whitespace-only strings and pushed metadata preserves the exact persisted `ranAt`.

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

Composer (Cursor)

### Debug Log References

- push-digest-convex now requires addDigestSignal to return ids; updated push test mocks accordingly
- Hermes skill parity: synced analyze-entity-intelligence.mjs + push-digest-convex.mjs to ~/.hermes/skills/cns/morning-digest

### Completion Notes List

- Added unconditional transactional `replaceEntityMentionsForRun`, including empty mention sets, with stderr plus structured non-throwing failure behavior.
- Added identity-preserving `rescoreDigestRun`; force-rescore reuses the same run and signal ids and rejects incomplete identity.
- Preserved pushed ids and exact `ranAt`; direct push persists the id-bearing artifact and runs entity analysis.
- Wired entity analysis into `scoreWriteAndPush`, `pushOnlyFromArtifact`, and watchdog recovery before Discord, with structured outcome visibility.
- Added bounded push/entity timeouts and rejection containment so degraded entity analysis cannot block Discord.
- Added full-path ordering, repeated-id idempotency, empty-set clearing, transactional rollback, watchdog, outcome, and validation tests.
- Synced the live Hermes skill mirror and passed `bash scripts/verify.sh` across Omnipotent.md and cns-dashboard.

### File List

- scripts/hermes-skill-examples/morning-digest/scripts/analyze-entity-intelligence.mjs (new)
- scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs (modified)
- scripts/hermes-skill-examples/morning-digest/SKILL.md (modified)
- scripts/hermes-skill-examples/morning-digest/references/task-prompt.md (modified)
- scripts/lib/digest-run-outcome.mjs (modified)
- scripts/push-digest-watchdog.mjs (modified)
- scripts/run-digest-convex-completion.mjs (modified)
- tests/analyze-entity-intelligence.test.mjs (new)
- tests/digest-run-outcome.test.mjs (modified)
- tests/morning-digest-push-convex.test.mjs (modified)
- tests/morning-digest-score-push-pipeline.test.mjs (modified)
- tests/push-digest-watchdog.test.mjs (modified)
- tests/run-digest-convex-completion.test.mjs (modified)
- ../cns-dashboard/convex/digest.ts (modified)
- ../cns-dashboard/convex/entityIntelligence.ts (modified)
- ../cns-dashboard/tests/convex/digest.test.ts (modified)
- ../cns-dashboard/tests/convex/entityIntelligence.test.ts (modified)
- _bmad-output/specs/spec-nexus-entity-intelligence/architecture.md (modified)

### Change Log

- 2026-06-21: Story 73-4 — post-push entity intelligence orchestrator + completion pipeline wiring (push → analyze → Discord)
- 2026-06-21: Review closeout — identity-preserving force-rescore, atomic replacement, recovery wiring, structured observability, timeout and full-path regression coverage
