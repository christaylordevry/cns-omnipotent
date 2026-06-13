---
story_id: 71-1
epic: 71
title: fix-watchdog-false-success-on-started-runs
status: done
baseline_commit: 97045acae7643c9cbb408c989c4c8b89bc222197
priority: P0
baseline_date: 2026-06-12
repo: Omnipotent.md only
story_type: ops-reliability-hotfix
depends_on: 71-2 (completion-convex-push-failed terminal state + structured push errors incl. missing-convex-env)
blocks: 71-3 (outcome record consumes terminal states + alert dedupe), 71-4 (retry-eligibility split + artifact-only repair path)
sequencing_note: Second in Epic 71 rollout (after 71-2). Unblocks retries for runs 71-2 now correctly marks failed.
audit_ref: cursor_repository_audit_and_assessment.md (2026-06-12) Top-10 #1, Bugs §A
---

# Story 71.1: Fix Watchdog False-Success on `started` Runs

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator relying on the three daily watchdog windows to recover a crashed digest**,
I want **retry-eligibility to distinguish three incomplete buckets — `started`, real Convex push failures, and missing-env config failures — instead of treating all non-terminal states as one retry shape**,
so that **partial or abandoned runs recover correctly across watchdog windows without re-running ten adapters three times a day when the only problem is a missing env file**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 71 — Digest Job-State & Watchdog Truth |
| **Priority** | **P0 hotfix** — audit item #1 |
| **Predecessor** | **71-2** — `completion-convex-push-failed` is a real terminal log action; `detail` is JSON `{ error, signalsWritten }`; `error: "missing-convex-env"` is a distinct subtype (exit 0, no fetch attempted) |
| **Out of scope** | 71-3 outcome record file + post-cron alert script; 71-4 Discord-only repair implementation (but establish the artifact-only retry pattern 71-4 will extend); Convex schema changes |

### Problem (today)

`push-digest-watchdog.mjs` treats any today Convex row in `VALID_NON_FAILED_STATUSES` as terminal success:

```27:27:scripts/push-digest-watchdog.mjs
const VALID_NON_FAILED_STATUSES = new Set(['started', 'completed', 'published', 'archived']);
```

A run stuck at `started` → `hasNonFailedToday === true` → `skipped-already-pushed` → **no retry** across all three watchdog windows.

Separately, retry routing does not distinguish **71-2's `missing-convex-env` subtype** from real mutation/partial-write failures. Both log `completion-convex-push-failed`, but only the latter warrants a full adapter re-collect; missing-env is an operator-config problem and the scored artifact at `~/.hermes/digest-push-YYYY-MM-DD.json` is already valid.

### Retry eligibility — three buckets (normative)

| Bucket | Latest state signal | Retry? | Recovery shape |
|--------|-------------------|--------|----------------|
| **1 — Abandoned `started`** | Convex row `started` and/or log `started` with **no** terminal `completion-*` / `discord-post-ok` / `skipped-already-pushed` | Yes | **Full pipeline** — `collectAdapterOutputs` → dedupe → score → artifact → push |
| **2 — Real Convex push failure** | Log `completion-convex-push-failed` with `detail.error !== 'missing-convex-env'` (mutation, network, partial write) | Yes | **Full pipeline** re-run (transient failure; push should succeed once resolved) |
| **3 — Missing Convex env** | Log `completion-convex-push-failed` with `detail.error === 'missing-convex-env'` | Yes (self-heal once env fixed) | **Push-only from artifact** when `~/.hermes/digest-push-YYYY-MM-DD.json` exists — **do not** call `collectAdapterOutputs`. Same "retry the failed leg, not the adapters" shape 71-4 will use for Discord-only repair. |

**True terminals (no retry):** latest state is `completion-backfill-push`, `completion-force-rescore-push`, `completion-no-signals`, `discord-post-ok`, or `skipped-already-pushed` with a **published** Convex row (`published` / `archived` — not `started`).

> **71-4 cross-reference:** Bucket 3 establishes artifact-only retry for a failed downstream leg. Story 71-4 extends the same pattern to Discord-only repair (`convexDone && !discordDone`). Implementers of 71-4 should reuse the helper / routing introduced here rather than inventing a second artifact-replay path.

## Acceptance Criteria

### 1. Bucket 1 — `started` without terminal state (AC: started-retry)

**Given** today's latest digest state is `started` (Convex row and/or log) with no terminal completion record
**When** the watchdog or `runDigestConvexCompletion` idempotency check runs
**Then** the run is **incomplete** and eligible for **full pipeline** retry
**And** it is **not** treated as `skipped-already-pushed`

### 2. Bucket 2 — real `completion-convex-push-failed` (AC: convex-mutation-retry)

**Given** today's latest terminal log for the digest is `completion-convex-push-failed` with parsed `detail.error` **not equal to** `'missing-convex-env'` (e.g. `Convex HTTP 500`, partial-write)
**When** a later watchdog window runs
**Then** the day is **not complete**
**And** recovery runs the **full pipeline** (`collectAdapterOutputs` and downstream), even if `digest-push-YYYY-MM-DD.json` already exists from the prior attempt

### 3. Bucket 3 — `missing-convex-env` push failure (AC: missing-env-push-only)

**Given** today's latest terminal log is `completion-convex-push-failed` with `detail.error === 'missing-convex-env'`
**And** `~/.hermes/digest-push-YYYY-MM-DD.json` exists from the prior `started` run (artifact written before push in `scoreWriteAndPush`)
**When** a later watchdog window runs
**Then** the run is **retry-eligible** (not `skipped-already-pushed`)
**And** recovery **re-attempts push only** from the existing artifact (via `tryRecoverFromArtifact` / `tryRescoreFromArtifact` / equivalent) — **does not** call `collectAdapterOutputs`
**And** if env is still missing, push fails again with the same `missing-convex-env` outcome without adapter noise

**Given** bucket 3 applies but **no** artifact file exists
**When** watchdog runs
**Then** fall through to **full pipeline** (same as bucket 1 — nothing scored to push yet)

### 4. True terminals preserved (AC: idempotency-preserved)

**Given** today's latest terminal state is `completion-backfill-push`, `completion-force-rescore-push`, `completion-no-signals`, `discord-post-ok`, or Convex row `published`/`archived` for today
**When** the watchdog runs
**Then** it early-exits without re-running adapters (existing correct behavior — do not regress)

### 5. Shared taxonomy for downstream stories (AC: exported-helper)

**Given** retry classification is implemented
**Then** export a small shared module or named exports usable by 71-3 and 71-4, e.g.:
- `MISSING_CONVEX_ENV_ERROR = 'missing-convex-env'` (single source of truth — may live in `push-digest-convex.mjs` and be re-exported)
- `parseCompletionLogDetail(detail: string): { error?: string; signalsWritten?: number } | null`
- `classifyDigestRetryBucket({ latestLogAction, detail, convexStatus, hasArtifact }): 'terminal-success' | 'full-pipeline' | 'push-only-artifact'`

**And** code comment documents: `retryable ≠ alert-worthy every time` — 71-3 owns alert dedupe for bucket 3; this story only owns routing.

### 6. Regression tests (AC: tests)

| Scenario | Expected |
|----------|----------|
| Convex: today row `started` only; no terminal log | Not `skipped-already-pushed`; proceeds to recovery |
| Log: only `started` for today; no artifact | Full pipeline (`collectFn` called) |
| Log: `started` → `completion-backfill-push` for today | Watchdog early-exit / no adapter re-collect |
| Log: `completion-convex-push-failed` + `error: "Convex HTTP 500"` + artifact present | Full pipeline retry (`collectFn` called) |
| Log: `completion-convex-push-failed` + `error: "missing-convex-env"` + artifact present | Push-only (`collectFn` **not** called; push spawn or `pushFn` called with artifact payload) |
| Log: `completion-convex-push-failed` + `missing-convex-env` + no artifact | Full pipeline |
| Convex: today `published` | `skipped-already-pushed`, no spawn |

Prefer injectable `collectFn`, `watchdogFn`, `pushFn`, `readFileFn` (existing patterns in `runDigestConvexCompletion` tests).

### 7. Verify gate (AC: verify)

`bash scripts/verify.sh` green before marking done.

## Tasks / Subtasks

- [x] T1 — Fix `evaluateTodayDigestRuns` / `VALID_NON_FAILED_STATUSES`: remove `started` from terminal-success set; only `published`/`archived` (and `completed` if still used pre-finalize) block recovery
- [x] T2 — Add log-aware retry classifier (`classifyDigestRetryBucket` + detail parser) reading `~/.hermes/logs/push-digest-watchdog.log` for today's latest digest action
- [x] T3 — Wire classifier into `runDigestConvexCompletion` before `collectAdapterOutputs`: bucket 2 → full pipeline; bucket 3 + artifact → push-only path; bucket 1 → full pipeline
- [x] T4 — Align `runPushDigestWatchdog` with classifier so bucket 2 does not short-circuit into `tryRecoverFromArtifact` when a full re-collect is required
- [x] T5 — Export `MISSING_CONVEX_ENV_ERROR` constant from push script (or shared digest-retry module)
- [x] T6 — Regression tests (AC #6)
- [x] T7 — `bash scripts/verify.sh` green

## Dev Notes

### Files to touch (UPDATE — read before editing)

| File | Current behavior | This story changes |
|------|------------------|-------------------|
| `scripts/push-digest-watchdog.mjs` | `started` ∈ `VALID_NON_FAILED_STATUSES` → false `skipped-already-pushed` | Remove `started` from terminal-success; optionally consult log classifier before `tryRecoverFromArtifact` |
| `scripts/run-digest-convex-completion.mjs` | Watchdog short-circuit then full collect on `skipped-no-artifact` only | Log-aware bucket routing; push-only path for bucket 3 |
| New (optional): `scripts/lib/digest-retry-eligibility.mjs` | — | `classifyDigestRetryBucket`, `parseCompletionLogDetail`, log tail reader |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | `error: 'missing-convex-env'` inline string | Export `MISSING_CONVEX_ENV_ERROR` constant |
| `tests/push-digest-watchdog.test.mjs` | No `started`-blocks-recovery test | Add bucket 1 + terminal preservation cases |
| `tests/run-digest-convex-completion.test.mjs` | Convex-failure gate tests from 71-2 | Add bucket 2/3 routing tests with mocked `collectFn` |

**Do not modify:** `post-digest-discord.mjs`, Convex mutations, 71-3 outcome script.

### Critical code anchors

**Broken idempotency (bucket 1 root cause):**

```115:142:scripts/push-digest-watchdog.mjs
export function evaluateTodayDigestRuns(runs, todayDate) {
  // ...
    if (VALID_NON_FAILED_STATUSES.has(status)) {
      sawTodayNonFailed = true;
      break;
    }
  // ...
}
```

**Orchestrator entry — today only branches on watchdog action, not log bucket:**

```539:551:scripts/run-digest-convex-completion.mjs
    const watchdogResult = await watchdogFn({ env, todayDate });
    if (watchdogResult.action === 'skipped-already-pushed' || watchdogResult.action === 'recovered-push') {
      return watchdogResult;
    }
    if (watchdogResult.action !== 'skipped-no-artifact') {
      return watchdogResult;
    }
  }
  const collectFn = opts.collectFn ?? collectAdapterOutputs;
```

**71-2 failure detail shape (parse for bucket 2 vs 3):**

```436:441:scripts/run-digest-convex-completion.mjs
      const detail = JSON.stringify({
        error: pushResult.error?.slice(0, 120) ?? 'convex-push-failed',
        signalsWritten: pushResult.signalsWritten ?? 0,
      }).slice(0, 200);
      await log('completion-convex-push-failed', 0, detail);
```

**Existing artifact-only paths to reuse (bucket 3 + 71-4 pattern):**

- `tryRecoverFromArtifact` in `push-digest-watchdog.mjs` — spawn `push-digest-convex.mjs` with artifact JSON
- `tryRescoreFromArtifact` in `run-digest-convex-completion.mjs` — re-score + push from artifact (`--force-rescore` path)

For bucket 3, prefer the lighter path: artifact already scored in prior run → `tryRecoverFromArtifact` shape (push only, skip dedupe/score unless payload stale). Do **not** require `--force-rescore`.

### Implementation guidance

1. **Log tail reader** — scan `push-digest-watchdog.log` for lines matching `date=${todayDate}`; take the **latest** digest-relevant action (`started`, `completion-*`, `discord-post-*`, `skipped-already-pushed`). Parse `detail=` as JSON when action is `completion-convex-push-failed`.

2. **Convex + log join** — `evaluateTodayDigestRuns` handles Convex-only truth; classifier merges Convex status with log action. A Convex `started` row with no log terminal → bucket 1.

3. **Bucket 2 vs watchdog artifact recovery** — today, any non-`hasNonFailedToday` falls through to `tryRecoverFromArtifact`. After removing `started` from terminal set, bucket 2 (mutation failure) would incorrectly hit artifact-only recovery. **Gate:** if classifier says `full-pipeline`, return `{ action: 'skipped-no-artifact', exitCode: 0 }` from watchdog (or a new action like `deferred-full-pipeline`) so completion proceeds to `collectAdapterOutputs`.

4. **Do not conflate** watchdog pre-check `skipped-no-convex-env` (no Convex credentials before query) with orchestrator `completion-convex-push-failed` + `missing-convex-env` (push script skip inside pipeline). Both are bucket 3-ish; neither should block forever.

5. **Terminal Convex statuses** — minimum fix: drop `started`. Keep `published`/`archived` as terminal. Verify whether `completed` appears in production rows before removing it.

6. **71-4 note in code** — one-line comment at artifact-only branch: `// Pattern shared with 71-4 Discord-only repair — retry failed leg from digest-push artifact`.

### Architecture compliance

- Epic 70 deterministic pipeline order preserved for **full-pipeline** path only
- No WriteGate / vault_log_action changes
- Orchestrator process exit code stays 0 (68-10 fire-and-forget); truth in log actions
- Hermes skill mirror: only if shared constants move to a file mirrored by install script

### Testing requirements

- `npm test -- tests/push-digest-watchdog.test.mjs tests/run-digest-convex-completion.test.mjs`
- Gate: `bash scripts/verify.sh`
- Mock `collectFn` to assert call count 0 vs 1 per bucket
- Seed log files via `appendFileFn` / temp operator home

### Previous story intelligence (71-2)

| Learning | Impact on 71-1 |
|----------|----------------|
| `completion-convex-push-failed` is the failure terminal action | Classifier must treat it as incomplete, not success |
| `missing-convex-env` → `ok: false`, exit `0` | Bucket 3; distinguish from mutation failures in `detail.error` |
| `formatPushResult` / `normalizePushResult` in push + completion | Reuse `MISSING_CONVEX_ENV_ERROR` string constant — do not duplicate |
| Injectable `pushFn` on `runDigestConvexCompletion` | Use for push-only bucket 3 tests |
| 67-10 `recovered-push-failed` on non-zero spawn | Push-only path already logs this; bucket 3 may repeat until env fixed |

### Git intelligence

Recent commits are session-close PATH hygiene — no conflicting digest work in flight. Story 71-2 landed with structured push results and Discord gate.

### Project context reference

- Verify gate: `bash scripts/verify.sh`
- Epic 71 sequencing: 71-2 → **71-1** → 71-3 → 71-4
- [Epic 71 planning](../planning-artifacts/epic-71-digest-job-state-and-watchdog-truth.md)
- [Story 71-2](./71-2-pushpayload-result-check-gate-discord-on-convex.md)
- [Story 71-4 backlog](./71-4-discord-retry-convex-success-discord-failure.md) — artifact-only repair pattern (when file exists)

### References

- [Source: `_bmad-output/planning-artifacts/epic-71-digest-job-state-and-watchdog-truth.md` — Story 71-1]
- [Source: `scripts/push-digest-watchdog.mjs` — `evaluateTodayDigestRuns`, `tryRecoverFromArtifact`]
- [Source: `scripts/run-digest-convex-completion.mjs` — `runDigestConvexCompletion`, `tryRescoreFromArtifact`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` — `formatPushResult`, `missing-convex-env`]
- [Source: `tests/push-digest-watchdog.test.mjs`]
- [Source: `tests/run-digest-convex-completion.test.mjs`]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

### Completion Notes List

- Removed `started` from Convex terminal-success set in `evaluateTodayDigestRuns`; only `published`/`archived`/`completed` block recovery.
- Added pure `scripts/lib/digest-retry-eligibility.mjs` with `classifyDigestRetryBucket`, `parseCompletionLogDetail`, log tail reader; exported `MISSING_CONVEX_ENV_ERROR` from push script.
- Watchdog now classifies three retry buckets before routing: bucket 1/2 → `skipped-no-artifact` (full pipeline); bucket 3 missing-env → `deferred-push-only-artifact`; legacy artifact recovery unchanged via `tryRecoverFromArtifact`.
- Orchestrator `pushOnlyFromArtifact` reuses `pushPayload` → `normalizePushResult` → Discord gate (same path as full pipeline push leg — addresses bucket 3 drift concern).
- Regression tests cover started retry, terminal preservation, bucket 2 full re-collect, bucket 3 push-only without collect, and classifier purity.
- `bash scripts/verify.sh` green; morning-digest Hermes skill mirror synced for push-digest-convex.mjs constant export.

### File List

- scripts/lib/digest-retry-eligibility.mjs (new)
- scripts/push-digest-watchdog.mjs
- scripts/run-digest-convex-completion.mjs
- scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs
- tests/digest-retry-eligibility.test.mjs (new)
- tests/push-digest-watchdog.test.mjs
- tests/run-digest-convex-completion.test.mjs

### Change Log

- 2026-06-12: Story created from Epic 71; design decision flagged for `missing-convex-env` (deferred).
- 2026-06-13: AC rewritten with normative three-bucket retry eligibility (started / mutation failure / missing-env push-only) per 71-2 `missing-convex-env` subtype; 71-4 artifact-replay cross-reference added.
- 2026-06-13: Implemented three-bucket classifier, watchdog/orchestrator routing, push-only artifact path with 71-2 gating; tests + verify green.

### Review Findings

- [x] [Review][Patch] Bucket 3 broken when Convex row is still `started` — `classifyDigestRetryBucket` returns `full-pipeline` before evaluating `completion-convex-push-failed` + `missing-convex-env`; production path almost always has Convex `started` after a failed push, but bucket-3 tests mock empty Convex query [scripts/lib/digest-retry-eligibility.mjs:132-141]
- [x] [Review][Patch] `pushOnlyFromArtifact` null fallback aborts instead of full pipeline — when watchdog returns `deferred-push-only-artifact` but artifact read/parse fails, orchestrator returns that action without calling `collectAdapterOutputs` (violates AC bucket-3 no-artifact fallthrough) [scripts/run-digest-convex-completion.mjs:606-620]
- [x] [Review][Patch] Add classifier test: Convex `started` + latest `completion-convex-push-failed` + `missing-convex-env` + artifact → `push-only-artifact` [tests/digest-retry-eligibility.test.mjs]
- [x] [Review][Patch] Add recovery-chain test: log `started` → `completion-convex-push-failed` → `completion-backfill-push` classifies as terminal-success (guards latest-not-any-terminal regression) [tests/digest-retry-eligibility.test.mjs or tests/push-digest-watchdog.test.mjs]
- [x] [Review][Defer] `deferred-push-only-artifact` writes no watchdog log line — 71-3 outcome record must infer defer from orchestrator logs or add explicit breadcrumb [scripts/push-digest-watchdog.mjs:398-400] — deferred, 71-3 scope
- [x] [Review][Defer] Legacy `tryRecoverFromArtifact` logs `recovered-push*` vs bucket-3 `pushOnlyFromArtifact` logs `completion-backfill-push` — 71-3 must not treat as equivalent success shapes [scripts/push-digest-watchdog.mjs:403-406] — deferred, 71-3 scope
- [x] [Review][Defer] `skipped-already-pushed` in log alone is terminal without requiring published Convex row [scripts/lib/digest-retry-eligibility.mjs:124-126] — deferred, low probability if logging consistent
