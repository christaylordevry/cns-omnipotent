---
story_id: 71-3
epic: 71
title: structured-run-outcome-record-observability-gate
status: done
baseline_commit: 97045acae7643c9cbb408c989c4c8b89bc222197
priority: P0
baseline_date: 2026-06-13
repo: Omnipotent.md only
story_type: ops-reliability-hotfix
depends_on: 71-1 (retry buckets + classifier), 71-2 (structured push result + Discord gate)
blocks: 71-4 (convexDone/discordDone split reads outcome record)
sequencing_note: Third in Epic 71 rollout. Consumer of 71-1/71-2 terminal states; must fold three 71-1 review deferrals into AC (artifact-only breadcrumb, dual recovery path mapping, skipped-already-pushed vs Convex divergence).
audit_ref: cursor_repository_audit_and_assessment.md (2026-06-12) Top-10 #3, Hidden SSOT table
---

# Story 71.3: Structured Run-Outcome Record + Post-Cron Observability Gate

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator who needs to know whether today's digest actually worked without grepping three systems**,
I want **each digest invocation to write one structured outcome record and a late-day cron check that exits non-zero (and optionally alerts Discord) when the day is partial, failed, or missing**,
so that **silent cron exit-0 failures (empty adapters, Convex/Discord divergence, artifact-only recovery) produce an external signal the operator will see**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 71 — Digest Job-State & Watchdog Truth |
| **Priority** | **P0** — audit item #3; closes "no single queryable record" gap |
| **Predecessors** | **71-2** (`normalizePushResult`, `completion-convex-push-failed`, structured push stdout); **71-1** (`classifyDigestRetryBucket`, `deferred-push-only-artifact`, `pushOnlyFromArtifact`, `recovered-push*`) |
| **Out of scope** | 71-4 Discord-only repair implementation (but outcome record must expose `convex`/`discord` flags 71-4 will read); Convex schema changes; cns-dashboard UI |
| **Review carry-forward** | Three items deferred from 71-1 code review **must** land here as concrete AC — not documentation notes ([deferred-work.md](./deferred-work.md) §2026-06-13) |

### Problem (today)

Truth is scattered across `~/.hermes/logs/push-digest-watchdog.log` greps, `~/.hermes/digest-push-YYYY-MM-DD.json`, and Convex `digestRuns` — never joined. Cron scripts exit 0 on total failure. Bucket-3 artifact-only recovery (`deferred-push-only-artifact` → `pushOnlyFromArtifact`) leaves **no log line** distinguishing it from a clean full pipeline day. Legacy watchdog `recovered-push` and orchestrator `completion-backfill-push` are equivalent successes in production but use different action strings. `skipped-already-pushed` can appear in the log while Convex is still `started`.

## Acceptance Criteria

### 1. Structured outcome record per invocation (AC: outcome-record-schema)

**Given** any digest run via `runDigestConvexCompletion` (morning cron, watchdog cron, or manual CLI)
**When** the invocation finishes (any branch — success, failure, early-exit, push-only recovery)
**Then** it writes **one JSON outcome record** to `~/.hermes/digest-outcomes/YYYY-MM-DD/<iso-timestamp>.json` (create directory as needed)
**And** the record includes at minimum:

```json
{
  "timestamp": "2026-06-13T08:15:02.123Z",
  "trigger": "watchdog-0715",
  "date": "2026-06-13",
  "runId": "md77t1mge1nppgtxnf7cg9nss188fad9",
  "terminalAction": "completion-backfill-push",
  "recoveryPath": "full-pipeline",
  "convex": { "ok": true, "signalsWritten": 71, "status": "published", "error": null },
  "discord": { "ok": true, "error": null },
  "sources": {
    "reddit": { "status": "error", "count": 0 },
    "google_trends": { "status": "ok", "count": 12 }
  },
  "overall": "partial"
}
```

**Field rules:**

| Field | Rule |
|-------|------|
| `trigger` | One of: `cron`, `watchdog-0715`, `watchdog-1300`, `watchdog-1830`, `manual` — derive from env `DIGEST_TRIGGER` set by cron wrappers, default `manual` for bare CLI |
| `date` | Sydney calendar date (`formatSydneyDate`) |
| `runId` | From push result when available; `null` if push never ran |
| `terminalAction` | Final orchestrator/watchdog action string for this invocation |
| `recoveryPath` | One of: `full-pipeline`, `push-only-artifact`, `watchdog-recover-artifact`, `none` (true terminal / skipped) — see AC #2 breadcrumb |
| `convex` | From 71-2 push result **and** post-hoc Convex query for today's row status |
| `discord` | From `postDigestToDiscord` result or inferred from log actions in this invocation |
| `sources` | Per canonical adapter key — `status`: `ok` \| `error` \| `empty` (never collapse error into empty) |
| `overall` | Computed per AC #3 mapping — **not** from process exit code |

**And** outcome write runs in a `finally` block (or equivalent) so failed branches still emit a record.

### 2. Artifact-only recovery breadcrumb (AC: push-only-breadcrumb) — 71-1 review deferral #1

**Given** the watchdog returns `{ action: 'deferred-push-only-artifact' }` (bucket 3 — missing-env push retry)
**When** `runDigestConvexCompletion` enters the `pushOnlyFromArtifact` path
**Then** it logs **before** calling `pushOnlyFromArtifact`:

```
action=push-only-artifact-recovery date=YYYY-MM-DD
```

to `~/.hermes/logs/push-digest-watchdog.log` (same log file / `formatWatchdogLogLine` helper as other completion actions)
**And** the outcome record sets `recoveryPath: 'push-only-artifact'`
**And** `recoveryPath` is **not** `full-pipeline` for this invocation

**Design choice (normative):** log at **orchestrator entry**, not in watchdog — watchdog already returns the defer action without logging; orchestrator owns `pushOnlyFromArtifact` and writes the outcome record. Do **not** add a watchdog log for `deferred-push-only-artifact` itself.

**Given** legacy watchdog `tryRecoverFromArtifact` succeeds
**When** outcome is written
**Then** `recoveryPath: 'watchdog-recover-artifact'` (distinct from bucket-3 `push-only-artifact`)

### 3. Terminal / recovery action mapping table (AC: action-mapping) — 71-1 review deferral #2

**Given** the outcome record builder computes `convex.ok`, `discord.ok`, and `overall`
**Then** it uses this **normative mapping** (not a naive "terminalAction === success" check):

#### Convex push succeeded (`convex.ok === true`)

| Log / terminal action | Notes |
|----------------------|-------|
| `completion-backfill-push` | Bucket-3 `pushOnlyFromArtifact` **and** full pipeline both log this on success — use `recoveryPath` to distinguish |
| `completion-force-rescore-push` | Force-rescore path |
| `recovered-push` | Legacy watchdog `tryRecoverFromArtifact` spawn success |
| `skipped-already-pushed` | **Only** if AC #4 Convex verification passes (published/archived/completed) |

#### Convex push failed (`convex.ok === false`)

| Log / terminal action | Notes |
|----------------------|-------|
| `completion-convex-push-failed` | Includes `missing-convex-env` subtype in `convex.error` |
| `recovered-push-failed` | Legacy watchdog spawn failure |
| `completion-backfill-push-failed` | Push-only path exception |

#### Discord succeeded (`discord.ok === true`)

| Log / terminal action |
|----------------------|
| `discord-post-ok` |

#### Discord failed (`discord.ok === false`)

| Log / terminal action |
|----------------------|
| `discord-post-failed` |

#### Neither leg ran / N/A

| Log / terminal action | `convex` / `discord` |
|----------------------|---------------------|
| `completion-no-signals` | `convex.ok: false` (no push), `discord.ok: false` |
| `completion-artifact-failed` | both false |
| `completion-pipeline-failed` | both false |
| `skipped-no-artifact` | defer to full pipeline in same or later invocation — this action alone is not terminal success |
| `skipped-no-convex-env` | convex false |
| `push-only-artifact-recovery` | breadcrumb only — not terminal; success/failure follows subsequent actions |

#### `overall` computation

| Condition | `overall` |
|-----------|-----------|
| `convex.ok && discord.ok` && no source `error` with signals expected | `success` |
| `convex.ok && !discord.ok` | `partial` |
| `!convex.ok && discord.ok` | `partial` (71-2 should prevent this; still flag if detected) |
| Any source `status === 'error'` while `payload.signals.length > 0` | `partial` (at minimum) |
| `completion-no-signals` or push/convex failure actions | `failed` |
| Missing outcome record for today after last watchdog window | treated as `failed` by check script |

**And** unit tests assert mapping for at least: `recovered-push` vs `completion-backfill-push` both → `convex.ok: true`; `recovered-push-failed` → `convex.ok: false`.

### 4. `skipped-already-pushed` vs Convex divergence (AC: skipped-convex-cross-check) — 71-1 review deferral #3

**Given** the latest log action for the invocation or day is `skipped-already-pushed`
**When** the outcome builder queries Convex `digest:getRecentDigestRuns` for today's row
**Then** if today's row status is **not** in `published` / `archived` / `completed` (e.g. still `started`, missing, or `failed`)
**Then** `convex.ok` is set to `false`
**And** `overall` is **`partial`** (not `success`)
**And** `convex.error` includes a short string like `log-skipped-but-convex-not-published`
**And** the check script (`check-digest-run-outcome.mjs`) treats this as non-success (non-zero exit)

**Given** `skipped-already-pushed` and Convex row is `published`/`archived`/`completed`
**Then** `convex.ok: true` and overall follows normal discord/source rules.

### 5. Post-cron observability gate (AC: outcome-check-script)

**Given** `scripts/check-digest-run-outcome.mjs` runs (manual or cron)
**When** it evaluates "today" (Sydney date)
**Then** it reads the **latest** outcome JSON for that date from `~/.hermes/digest-outcomes/YYYY-MM-DD/`
**And** exits **non-zero** if: no record exists, or `overall` is `partial` or `failed`
**And** exits **0** only if `overall === 'success'`
**And** optionally posts a short Discord alert via `postDigestToDiscord` raw REST helper (reuse 70-2 pattern) or a minimal `fetch` to Discord API when `CHECK_DIGEST_ALERT=1` and token present — message includes date, `overall`, `terminalAction`, and one-line `convex`/`discord` summary

**And** `scripts/run-digest-outcome-check-cron.sh` is a thin wrapper (env load + `node scripts/check-digest-run-outcome.mjs`)
**And** `scripts/install-morning-digest-cron.sh` registers a **fourth** crontab line tagged `cns-digest-outcome-check` at **19:00 Australia/Sydney** (30 min after last watchdog 18:30), logging to `~/.hermes/logs/digest-outcome-check.log`

### 6. Source status: error vs empty (AC: reddit-error-classification)

**Given** an adapter returns `{ error: "..." }` JSON with exit 0 (Reddit today)
**When** the orchestrator collects adapter outputs
**Then** `sources.<key>.status` is `error` (not `empty`)
**And** `count` is 0

**Implementation:** ensure `collectAdapterOutputs` / `buildErrorsBySource` / `resolveSourceOutcomes` path classifies `isAdapterErrorPayload` as `error`. If `fetch-reddit-signals.mjs` still exits 0 on failure, the wrapper `hermes-run-reddit.sh` → `collectAdapterOutputs` must surface `{ success: false, error: ... }` — add non-zero exit or explicit error wrapper if the collect path does not already classify it (verify with test).

### 7. Cron trigger wiring (AC: trigger-env)

**Given** `run-morning-digest-cron.sh` runs the orchestrator
**Then** it exports `DIGEST_TRIGGER=cron` before `node run-digest-convex-completion.mjs`

**Given** each watchdog cron wrapper (`run-push-digest-watchdog-cron.sh` or install script variants)
**Then** it exports `DIGEST_TRIGGER=watchdog-0715` | `watchdog-1300` | `watchdog-1830` matching the window

### 8. Regression tests (AC: tests)

| Test file | Scenario |
|-----------|----------|
| New: `tests/digest-run-outcome.test.mjs` | Mapping table: `recovered-push` → `convex.ok`; `completion-backfill-push` + `recoveryPath: push-only-artifact` → `convex.ok` + correct recoveryPath |
| Same | `skipped-already-pushed` + Convex `started` → `overall: partial`, `convex.ok: false` |
| Same | `push-only-artifact-recovery` log line present when deferred path taken |
| New: `tests/check-digest-run-outcome.test.mjs` | Missing record → exit 1; `success` → exit 0; `partial` → exit 1 |
| `tests/run-digest-convex-completion.test.mjs` | Outcome file written on convex-push-failed branch |

### 9. Verify gate (AC: verify)

`bash scripts/verify.sh` green before marking done.

## Tasks / Subtasks

- [x] T1 — Add `scripts/lib/digest-run-outcome.mjs`: schema builder, action mapping table, Convex cross-check, `writeDigestOutcomeRecord`
- [x] T2 — Wire outcome write + `push-only-artifact-recovery` log in `run-digest-convex-completion.mjs` (`finally` on all exit paths)
- [x] T3 — Set `DIGEST_TRIGGER` in cron wrappers (`run-morning-digest-cron.sh`, watchdog cron install paths)
- [x] T4 — Implement `scripts/check-digest-run-outcome.mjs` + `scripts/run-digest-outcome-check-cron.sh`
- [x] T5 — Register 19:00 outcome-check cron in `scripts/install-morning-digest-cron.sh`
- [x] T6 — Source error vs empty: verify/fix Reddit collect classification (AC #6)
- [x] T7 — Tests (AC #8)
- [x] T8 — `bash scripts/verify.sh` green

### Review Findings

**Operator verification answers (2026-06-13 — all three layers complete: [Blind Hunter](a5796e2c-dc6c-4b8e-983f-f0e0d67c0c7f), [Acceptance Auditor](950494ff-6b67-4465-a333-6b59f021ae72), [Edge Case Hunter](43582ada-e054-42d2-b8cd-f5b7c779c9ec)):**

1. **71-1 regression coverage — YES, clean.** Breadcrumb additive; classifier unchanged for terminal-success set. Crash-between-breadcrumb-and-terminal edge untested (safe direction).

2. **DIGEST_TRIGGER on manual paths — PARTIAL.** CLI → `manual`. Hermes skill → no outcome record. **New (Edge):** watchdog runner sourcing `.env.live-chain` may overwrite crontab-inherited `DIGEST_TRIGGER=watchdog-*` unless preserved after source.

3. **18:30 vs 19:00 timing — schedule buffer only; no in-progress branch.** **Cross-layer consensus:** false-alert risks are (a) Convex query null conflated with divergence, (b) **latest outcome file wins** — a later partial/failed watchdog record shadows an earlier 07:00 success at 19:00, (c) `recovered-push` paths write `overall: partial` (Discord never attempted in that invocation).

**All nine ACs substantively met; verify green.**

- [x] [Review][Decision] 19:00 check vs in-flight 18:30 watchdog — resolved via `inProgress` + `DIGEST_INPROGRESS_GRACE_MINUTES` (default 20) grace branch in check script

- [x] [Review][Decision] Outcome selection at 19:00 — resolved via day-level sticky-true merge (`YYYY-MM-DD.json`); success cannot be shadowed by later partial invocation

- [x] [Review][Decision] `CHECK_DIGEST_ALERT` default-on — resolved: wrapper `run-digest-outcome-check-cron.sh:20` exports `${CHECK_DIGEST_ALERT:-1}`; `check-digest-run-outcome.mjs` alerts unless `CHECK_DIGEST_ALERT=0` (defense-in-depth for direct `.mjs` invocation); Discord alert wrapped in try/catch so network errors do not obscure outcome message

- [x] [Review][Defer] Distinguish Convex query failure from real skipped/Convex divergence (`convex-status-query-failed` vs `log-skipped-but-convex-not-published`) — deferred fast-follow; sticky day model makes this a history diagnostic nicety, not alerting/correctness [`run-digest-convex-completion.mjs`, `digest-run-outcome.mjs`]

- [x] [Review][Patch] `convex.runId` stripped in `computeOutcomeFromInvocation` — fixed; `runId` now forwarded from `computeConvexBlock` / `pushResult` into persisted day record [`digest-run-outcome.mjs:375-380`]

- [x] [Review][Patch] `computeConvexBlock` applied Convex row-status gating to all success terminal actions — fixed; status cross-check remains only on `skipped-already-pushed` per AC #3/#4 [`digest-run-outcome.mjs:229-236` removed]

- [x] [Review][Dismiss] Blind Hunter pre-71-3 items (double normalizePushResult, parsePushStdout, evaluateTodayDigestRuns ordering, exit-code migration) — pre-existing or intentional from 71-1/71-2; out of 71-3 closure scope

- [x] [Review][Defer] `markInvocationStarted` outside try/finally — ops edge (disk full at startup); sticky model + cron logs still surface failure; no lock file in epic scope

**Second review pass (2026-06-13):** 0 decision-needed, 2 patches applied, 2 deferred, 8 dismissed. Verify green post-patch.

- [x] [Review][Patch] Preserve crontab `DIGEST_TRIGGER` after sourcing `.env.live-chain` in watchdog runner (`.env.live-chain` does not define `DIGEST_TRIGGER` — comment + `_inherited_trigger` re-export added) [`scripts/run-push-digest-watchdog-cron.sh`]

- [x] [Review][Patch] `recovered-push` early-return leaves `pushResult`/`discordResult` empty → spurious `overall: partial` at 19:00; fixed via sticky-true day merge (Discord from prior invocation preserved)

- [x] [Review][Patch] Add `completion-backfill-push-failed` / `completion-force-rescore-push-failed` to `DIGEST_LOG_ACTIONS` so watchdog log scan matches outcome terminal actions [`digest-retry-eligibility.mjs:22-37`]

- [x] [Review][Patch] Export `DIGEST_TRIGGER` in watchdog runner keyed to Sydney hour for manual invocations [`scripts/run-push-digest-watchdog-cron.sh`]

- [x] [Review][Patch] Add check-script tests: sticky success, in-progress grace/stuck, corrupt read [`tests/digest-run-outcome.test.mjs`]

- [x] [Review][Defer] Hermes Discord skill writes no outcome record — out of AC #1 scope

- [x] [Review][Defer] `runId: null` on `recovered-push` — cosmetic

- [x] [Review][Defer] Check-script tests consolidated in `digest-run-outcome.test.mjs` — organizational only

- [x] [Review][Defer] Concurrent dual-invocation / corrupt JSON read paths — pre-existing ops edge; no lock file in epic scope

**Operator step before done:** Re-run `bash scripts/install-morning-digest-cron.sh` on the host to register the 19:00 `cns-digest-outcome-check` crontab line (repo change alone does not update live crontab).

## Dev Notes

### Files to touch

| File | Change |
|------|--------|
| **New** `scripts/lib/digest-run-outcome.mjs` | Outcome schema, `TERMINAL_ACTION_MAP`, `computeOverall`, Convex query helper |
| `scripts/run-digest-convex-completion.mjs` | Outcome `finally`; log `push-only-artifact-recovery` before `pushOnlyFromArtifact`; pass `trigger` from env |
| **New** `scripts/check-digest-run-outcome.mjs` | Read latest outcome; exit code; optional Discord alert |
| **New** `scripts/run-digest-outcome-check-cron.sh` | Env + node wrapper |
| `scripts/install-morning-digest-cron.sh` | Fourth cron line 19:00 AEST |
| `scripts/run-morning-digest-cron.sh` | `export DIGEST_TRIGGER=cron` |
| `scripts/run-push-digest-watchdog-cron.sh` or install script | `DIGEST_TRIGGER=watchdog-*` per window |
| `tests/digest-run-outcome.test.mjs`, `tests/check-digest-run-outcome.test.mjs` | New |
| `tests/run-digest-convex-completion.test.mjs` | Outcome file assertions |

**Do not modify:** Convex mutations/schema, WriteGate, `post-digest-discord.mjs` digest posting logic (only reuse for alert if needed).

### Critical code anchors

**Bucket-3 defer — no log today (fix in this story):**

```606:616:scripts/run-digest-convex-completion.mjs
    if (watchdogResult.action === 'deferred-push-only-artifact') {
      const pushOnlyResult = await pushOnlyFromArtifact({
        env,
        todayDate,
        operatorHome,
        log,
        pushFn,
      });
```

Insert `await log('push-only-artifact-recovery', 0);` immediately before `pushOnlyFromArtifact`.

**Legacy vs bucket-3 success shape divergence:**

```283:284:scripts/push-digest-watchdog.mjs
    const action = pushExitCode === 0 ? 'recovered-push' : 'recovered-push-failed';
```

vs `pushOnlyFromArtifact` logging `completion-backfill-push` — mapping table in AC #3 unifies these for `convex.ok`.

**Classifier trusts log terminal without Convex (outcome must override):**

```124:126:scripts/lib/digest-retry-eligibility.mjs
  if (latestLogAction && TERMINAL_SUCCESS_LOG_ACTIONS.has(latestLogAction)) {
    return 'terminal-success';
  }
```

Outcome record **cross-checks** Convex when action is `skipped-already-pushed` — do not change classifier here (71-1 scope); 71-3 outcome is the divergence detector.

**Reuse from 71-1/71-2:**

- `fetchRecentDigestRuns`, `postQuery`, `evaluateTodayDigestRuns` from `push-digest-watchdog.mjs`
- `TERMINAL_CONVEX_STATUSES`, `parseCompletionLogDetail`, `DIGEST_LOG_ACTIONS` from `digest-retry-eligibility.mjs`
- `normalizePushResult`, `expectedSignalCount` from completion script
- `resolveSourceOutcomes` / `buildErrorsBySource` for per-source status

### Outcome directory layout

```
~/.hermes/digest-outcomes/
  2026-06-13/
    2026-06-13T07:00:01.234Z.json   # morning cron
    2026-06-13T07:15:02.456Z.json   # watchdog
```

Latest file by filename sort (ISO timestamp) or parse `timestamp` field — pick one, document in module.

### Implementation guidance

1. **Pure mapping module** — keep `computeOutcomeFromInvocation({ terminalAction, recoveryPath, pushResult, discordResult, adapterOutputs, convexRow, logActions })` pure for tests.

2. **Convex query in outcome builder** — reuse `resolveConvexPushEnv` + `fetchRecentDigestRuns`; filter today's date; read `status` field. Injectable `fetchFn` for tests.

3. **Alert dedupe for bucket 3** — 71-1 note: `missing-convex-env` may retry all day. Check script at 19:00 fires once; optional: include `recoveryPath` in alert text so operator knows it was push-only recovery.

4. **Orchestrator exit code** — preserve 68-10 fire-and-forget (`process.exit(0)`). Check script provides the external non-zero signal.

5. **Hermes skill mirror** — only if `fetch-reddit-signals.mjs` changes; run install script if touched.

### Architecture compliance

- No WriteGate / vault_log_action / security.md changes
- Epic 70 pipeline order unchanged for full-pipeline path
- Outcome records live under `~/.hermes/` (operator home) — not vault
- `bash scripts/verify.sh` gate required

### Previous story intelligence

| Story | Learning for 71-3 |
|-------|-------------------|
| **71-2** | `convex` block comes from `normalizePushResult`; include `signalsWritten` and `error` verbatim |
| **71-1** | Three review deferrals are **in scope** for this story; `deferred-push-only-artifact` is watchdog return only — breadcrumb at orchestrator |
| **71-1** | `recoveryPath` must distinguish `push-only-artifact` (bucket 3) vs `watchdog-recover-artifact` (`tryRecoverFromArtifact`) |
| **70-3** | `errors_by_source` on payload; `resolveSourceOutcomes` distinguishes unavailable vs empty |
| **67-10** | Watchdog log format `action=... date=... exit=... detail=...` — stay consistent |

### Git intelligence

Recent commits are session-close PATH hygiene — no conflicting digest work. Stories 71-1 and 71-2 are done per sprint-status; implementation may be local/uncommitted — read live files before editing.

### Project context reference

- Verify gate: `bash scripts/verify.sh`
- Epic 71 sequencing: 71-2 → 71-1 → **71-3** → 71-4
- [deferred-work.md](./deferred-work.md) — remove or strike the three 71-1 deferral bullets when this story ships
- [Epic 71 planning](../planning-artifacts/epic-71-digest-job-state-and-watchdog-truth.md)

### References

- [Source: `_bmad-output/planning-artifacts/epic-71-digest-job-state-and-watchdog-truth.md` — Story 71-3]
- [Source: `_bmad-output/implementation-artifacts/71-1-fix-watchdog-false-success-on-started-runs.md` — Review Findings deferrals]
- [Source: `scripts/run-digest-convex-completion.mjs` — `pushOnlyFromArtifact`, `runDigestConvexCompletion`]
- [Source: `scripts/lib/digest-retry-eligibility.mjs` — `TERMINAL_SUCCESS_LOG_ACTIONS`, classifier]
- [Source: `scripts/push-digest-watchdog.mjs` — `recovered-push*`, `fetchRecentDigestRuns`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` — `isAdapterErrorPayload`]
- [Source: `scripts/install-morning-digest-cron.sh` — cron registration pattern]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- Fixed ESLint `no-useless-assignment` on logContent read in writeInvocationOutcomeRecord

### Completion Notes List

- Added `scripts/lib/digest-run-outcome.mjs` with pure `computeOutcomeFromInvocation`, action mapping, Convex cross-check for `skipped-already-pushed`, and outcome file I/O under `~/.hermes/digest-outcomes/YYYY-MM-DD/`.
- Wired orchestrator `finally` block to always write outcome records; logs `push-only-artifact-recovery` before bucket-3 `pushOnlyFromArtifact`.
- Added `scripts/check-digest-run-outcome.mjs` + cron wrapper; 19:00 Sydney outcome-check cron registered in install script with optional Discord alert (`CHECK_DIGEST_ALERT=1`).
- Set `DIGEST_TRIGGER` on morning cron (`cron`) and watchdog crons (`watchdog-0715|1300|1830`).
- Resolved three 71-1 review deferrals (artifact breadcrumb, action mapping, skipped/Convex divergence); updated `deferred-work.md`.
- Tests: `tests/digest-run-outcome.test.mjs` (includes check script cases), extended `tests/run-digest-convex-completion.test.mjs`.
- `bash scripts/verify.sh` green.
- **Amendment (day-level merge):** Replaced per-invocation timestamped files with single `~/.hermes/digest-outcomes/YYYY-MM-DD.json`; added `markInvocationStarted` (before watchdog eligibility), `mergeInvocationOutcome` with sticky-true convex/discord merge, atomic write, corrupt-read handling, and check-script in-progress grace (`DIGEST_INPROGRESS_GRACE_MINUTES`, default 20). Mapping/compute logic unchanged. Patch A: confirmed `.env.live-chain` does not set `DIGEST_TRIGGER` — added ordering comment + inherited-trigger re-export + Sydney-hour fallback for manual watchdog runs. Eight amendment tests added; verify green.

### File List

- `scripts/lib/digest-run-outcome.mjs` (new → amended: day-level merge I/O)
- `scripts/check-digest-run-outcome.mjs` (new → amended: in-progress grace branch)
- `scripts/run-digest-outcome-check-cron.sh` (new)
- `scripts/run-digest-convex-completion.mjs` (amended: markInvocationStarted before watchdog, merge in finally)
- `scripts/lib/digest-retry-eligibility.mjs`
- `scripts/run-morning-digest-cron.sh`
- `scripts/run-push-digest-watchdog-cron.sh` (amended: DIGEST_TRIGGER ordering comment + preserve/fallback)
- `scripts/install-morning-digest-cron.sh`
- `tests/digest-run-outcome.test.mjs` (new → +8 amendment tests)
- `tests/run-digest-convex-completion.test.mjs`
- `_bmad-output/implementation-artifacts/deferred-work.md`

### Change Log

- 2026-06-13: Story created from Epic 71; folded three 71-1 review deferrals into concrete AC (artifact-only breadcrumb, action mapping table, skipped-already-pushed Convex cross-check).
- 2026-06-13: Implemented structured outcome records, observability check script + 19:00 cron, DIGEST_TRIGGER wiring, tests; verify green.
- 2026-06-13: Amendment — day-level merged outcome record (`YYYY-MM-DD.json`), sticky-true merge semantics, in-progress grace in check script, `markInvocationStarted` before watchdog; 8 new tests; verify green.

## Story Completion Status

- Status: **review**
- Ultimate context engine analysis completed — comprehensive developer guide created

---
amends: _bmad-output/implementation-artifacts/71-3-structured-run-outcome-record-observability-gate.md
reason: >
  Three independent review layers (Acceptance Auditor, Blind Hunter, Edge Case
  Hunter) converged on the same root cause for the "in-progress vs missing vs
  failed" decision item: per-invocation outcome files with latest-file-wins
  selection cannot represent a day with multiple invocations in different
  roles (cron / watchdog / recovery). This amendment replaces the storage
  model before the story is marked done. Mapping table, classification logic,
  and computeConvexBlock/computeDiscordBlock/computeOverall from the original
  71-3 implementation are UNCHANGED — they now operate on a merged day record
  instead of a fresh per-invocation one.
status: ready-for-dev (amendment to in-progress story)
---

# 71-3 Amendment — Day-Level Merged Outcome Record

## Problem this amendment fixes

The shipped implementation writes one timestamped JSON file per invocation
under `~/.hermes/digest-outcomes/YYYY-MM-DD/<timestamp>.json`, and
`check-digest-run-outcome.mjs` reads whichever file is lexicographically last.

This causes, in order of severity:

1. **A 19:00 check can report `failed`/`partial` on a fully healthy day**
   because the 18:30 watchdog's *own outcome-record query* races against its
   *own watchdog-decision query* (two separate Convex reads), and a transient
   `started`/lag status on the second read produces a `partial` record that
   becomes "latest" — shadowing the 07:00 `success` record.
2. **`recovered-push` (legacy watchdog recovery) always writes `overall:
   'partial'`**, regardless of whether Discord already succeeded earlier that
   day, because the per-invocation record has no memory of prior invocations.
3. **No way to distinguish "18:30 run still executing" from "no run happened
   today"** — both read as "no record yet" / null.

## New storage model

### File layout
Replace the per-invocation directory with a single per-day file:

```
~/.hermes/digest-outcomes/YYYY-MM-DD.json
```

(Old-format `YYYY-MM-DD/<timestamp>.json` directories from prior days are left
in place — no migration needed. The check script and writer only ever address
the single-file path going forward.)

### Schema

```ts
interface DigestDayOutcome {
  date: string;                  // YYYY-MM-DD (Sydney)
  updatedAt: string;             // ISO timestamp of last write
  inProgress: { since: string; trigger: string } | null;

  // "Sticky" fields — see merge semantics below. Represent the best
  // result achieved by ANY invocation so far today, not just the latest.
  convex: { ok: boolean; signalsWritten: number; runId: string | null;
            status: string | null; error: string | null };
  discord: { ok: boolean; error: string | null };
  sources: Record<string, { status: 'ok' | 'error' | 'empty'; count: number }>;
  overall: 'success' | 'partial' | 'failed';

  // Diagnostics — last invocation's own values, for quick "what just
  // happened" reading without scanning history.
  lastInvocation: {
    timestamp: string;
    trigger: string;
    recoveryPath: string | null;
    action: string | null;       // terminal log action for that invocation
  };

  // Full audit trail — one entry per invocation, each invocation's OWN
  // (non-merged) computed convex/discord/overall, plus any warnings raised
  // during merge (e.g. divergence vs sticky day state).
  history: Array<{
    timestamp: string;
    trigger: string;
    recoveryPath: string | null;
    action: string | null;
    convex: DigestDayOutcome['convex'];
    discord: DigestDayOutcome['discord'];
    overall: DigestDayOutcome['overall'];
    ranAdapters: boolean;
    warnings: string[];          // e.g. ["divergence: this invocation's
                                  //  convex check returned ok=false/started
                                  //  but day record already convex.ok=true
                                  //  from 07:00 — day record unchanged"]
  }>;
}
```

### I/O functions (new, in `scripts/lib/digest-run-outcome.mjs`)

- `readDayOutcomeRecord(dir, date)` — reads `YYYY-MM-DD.json`, returns `null`
  if absent. **Wrapped in try/catch**: a corrupt/partial JSON file is treated
  as `null` (logged as a warning), not thrown — addresses the
  Acceptance-Auditor-flagged silent-exit-1-on-corrupt-file finding.
- `writeDayOutcomeRecordAtomic(dir, date, record)` — writes to
  `YYYY-MM-DD.json.tmp` then `rename()`s over `YYYY-MM-DD.json`. Atomic
  rename avoids partial-write corruption on crash/SIGKILL, which is the
  primary source of the corrupt-file case above.
- `markInvocationStarted(dir, date, { trigger })` — read-merge-write: sets
  `inProgress = { since: now, trigger }`, `updatedAt = now`. Does **not**
  touch `convex`/`discord`/`overall`/`history` — those are untouched until
  finalize. If no day record exists yet, creates one with sticky fields at
  their zero-value (`convex.ok: false`, `discord.ok: false`,
  `overall: 'failed'`, empty `sources`/`history`) plus `inProgress` set.
- `mergeInvocationOutcome(dir, date, invocationResult)` — read-merge-write,
  called from the orchestrator's `finally`. Implements the merge semantics
  below, sets `inProgress: null`, appends to `history`.

### Merge semantics (the core of this amendment)

Given `existing` (day record, possibly the zero-value record from
`markInvocationStarted`, or `null` if somehow finalize ran without a prior
start-mark — treat `null` as the zero-value record) and `current`
(*this invocation's own* computed `convex`/`discord`/`overall`/`sources`,
produced by the **unchanged** 71-3 `computeConvexBlock` /
`computeDiscordBlock` / `computeOverall`):

**Convex block — sticky-true:**
```
if current.convex.ok === true:
    merged.convex = current.convex          // fresher success details win
else if existing.convex.ok === true:
    merged.convex = existing.convex          // keep prior success
    if current.convex.ok === false:
        warning = "divergence: this invocation's convex check returned "
                + `ok=false (${current.convex.error}) but day record already `
                + "convex.ok=true — day record unchanged"
else:
    merged.convex = current.convex           // no prior success; latest wins
```

**Discord block — same sticky-true pattern**, substituting `discord`.

**Sources — only overwrite if this invocation ran adapters:**
```
if current.ranAdapters === true:
    merged.sources = current.sources
else:
    merged.sources = existing.sources         // preserve last full-pipeline read
```
(`ranAdapters` is a new field on the invocation result — `true` for
bucket-1/2 full-pipeline runs, `false` for bucket-3 push-only and
`recovered-push`/`skipped-already-pushed` fast-exits.)

**Overall — recomputed from merged convex/discord using the EXISTING 71-3
`computeOverall` logic** (success = both ok; partial = convex ok, discord
not; failed = convex not ok). Because `convex.ok`/`discord.ok` are sticky-true,
`overall` can only move toward `success` over the course of a day, never away
from it. A day that reaches `success` stays `success` regardless of later
invocations' transient divergence — this is the direct fix for finding #1
(dual-query-race false partial on a healthy day) and the
`skipped-already-pushed` + Convex `started` finding.

**`lastInvocation`** — always overwritten with this invocation's own
trigger/recoveryPath/action (diagnostics, not part of the sticky model).

**`history`** — append this invocation's *own* (non-merged) `convex`,
`discord`, `overall`, plus any `warnings` from the sticky-merge step above.
This preserves the Edge-Case-Hunter-flagged attribution concern: you can
always see "what did THIS invocation actually observe," separate from "what's
the day's best-known state."

### Check script logic (`check-digest-run-outcome.mjs`)

```
record = readDayOutcomeRecord(dir, today)

if record === null:
    exit 1   // no record at all today — unchanged from current behavior

if record.overall === 'success':
    exit 0   // sticky success wins immediately, regardless of inProgress

if record.inProgress !== null:
    elapsedMin = (now - record.inProgress.since) in minutes
    if elapsedMin <= DIGEST_INPROGRESS_GRACE_MINUTES (default 20):
        log "WARN: digest run in progress (started {elapsedMin}m ago,
             trigger={record.inProgress.trigger}) — not yet success, no alert"
        exit 0   // do NOT alert — run may still complete successfully
    else:
        log "FAIL: digest run started {elapsedMin}m ago and still marked
             in-progress — likely stuck/crashed"
        exit 1   // alert — stuck process is a real failure signal

// record.overall is 'partial' or 'failed', and inProgress is null
// (invocation completed and did not reach success)
exit 1
```

`DIGEST_INPROGRESS_GRACE_MINUTES` is a new env var, default `20` (the
implementation notes' bounded full-pipeline estimate was ~10-12 minutes;
20 gives headroom without being so large that a genuinely stuck process goes
undetected until the next day).

### Orchestrator wiring (`run-digest-convex-completion.mjs`)

- Call `markInvocationStarted(dir, date, { trigger })` as the **first**
  action after resolving `date`/`trigger`/`outcomeDir` — before any
  Convex-eligibility check, adapter collection, or push attempt. This must
  fire on **every** code path, including ones that will fast-exit
  (`skipped-already-pushed`, `recovered-push`, `deferred-push-only-artifact`),
  so that even a near-instant fast-exit briefly sets `inProgress` and then
  immediately clears it via `mergeInvocationOutcome` in `finally` — leaving
  no window where a fast-exit looks like a stuck run.
- The existing `finally` block now calls `mergeInvocationOutcome(...)`
  instead of the old per-invocation file write. `computeConvexBlock` /
  `computeDiscordBlock` / `computeOverall` / the action-mapping table are
  called exactly as today to produce `current`; only the persistence step
  changes.
- Set `current.ranAdapters = true` only on bucket-1/2 full-pipeline paths
  (i.e., wherever `collectAdapterOutputs` was actually called this
  invocation).

## Independent small patches (bundle into this amendment, not separate)

### Patch A — `DIGEST_TRIGGER` in watchdog wrapper
`run-push-digest-watchdog-cron.sh` currently relies on the crontab line
prefix (`DIGEST_TRIGGER=watchdog-1830 /bin/bash ...`) to set the trigger, but
then sources `.env.live-chain` with `set -a`, which **overwrites** any
inherited env var if `.env.live-chain` also defines `DIGEST_TRIGGER`.

Fix: confirm whether `.env.live-chain` defines `DIGEST_TRIGGER` at all.
- If it does **not** — no code change needed; the crontab-prefix mechanism
  already works, and the Blind Hunter concern doesn't apply in practice.
  Add a comment in the wrapper noting the ordering dependency so it isn't
  "fixed" accidentally later by someone reordering the source.
- If it **does** — remove `DIGEST_TRIGGER` from `.env.live-chain` (it has no
  business being a static env-file value; it's per-invocation), or
  explicitly re-export the inherited value *after* sourcing:
  ```bash
  _inherited_trigger="${DIGEST_TRIGGER:-}"
  set -a; . "$REPO_ROOT/.env.live-chain"; set +a
  [[ -n "$_inherited_trigger" ]] && export DIGEST_TRIGGER="$_inherited_trigger"
  ```
Either way, add a test/assertion (shell-level or via the existing
`resolveDigestTrigger` unit test with an env fixture) proving a watchdog
invocation records `trigger: 'watchdog-1830'`, not `'manual'`.

### Patch B — corrupt-file handling
Covered above as part of `readDayOutcomeRecord`'s try/catch — no separate
work item, just confirm the new reader has this from the start (the old
`readLatestOutcomeRecord` did not).

## Test matrix additions

1. **Sticky success across invocations** — seed day record with
   `convex.ok: true, discord.ok: true, overall: 'success'` (simulating 07:00).
   Run `mergeInvocationOutcome` with a `current` representing the 18:30
   dual-query-race divergence (`convex.ok: false, error: 'started'`). Assert
   merged `overall` stays `'success'`, `history` has 2 entries, latest entry
   has a `warnings` array with the divergence note.

2. **`recovered-push` inherits prior Discord success** — seed day record with
   `discord.ok: true` from 07:00, `convex.ok: false, overall: 'failed'`
   (07:00 push failed). Run `mergeInvocationOutcome` with `current` from a
   `recovered-push` (`convex.ok: true, discord: null/not-attempted`). Assert
   merged `overall === 'success'` (convex now true, discord stays sticky-true
   from earlier).

3. **In-progress, within grace** — day record with
   `inProgress: { since: now - 5min }`, `overall: 'failed'` (no success yet
   today). `check-digest-run-outcome.mjs` → exit 0, log contains "WARN" and
   "no alert".

4. **In-progress, past grace (stuck)** — same but `since: now - 45min`. →
   exit 1, log contains "FAIL" and "stuck".

5. **No record at all** — unchanged, exit 1.

6. **Atomic write survives concurrent-ish read** — write a day record, then
   immediately `readDayOutcomeRecord` in the same test; assert no
   partial-read errors (sanity check on the tmp-then-rename pattern).

7. **`markInvocationStarted` then immediate `mergeInvocationOutcome`
   (fast-exit path)** — assert final record has `inProgress: null` and
   exactly one `history` entry — no dangling in-progress state from a
   near-instant `skipped-already-pushed`/`recovered-push` invocation.

8. **Sources preserved across push-only invocation** — day record has
   `sources` populated from a 07:00 full-pipeline run. Run
   `mergeInvocationOutcome` with `current.ranAdapters = false` (bucket-3
   push-only). Assert `sources` unchanged from the 07:00 values.

## What this amendment does NOT change

- The action-string mapping table, `computeConvexBlock`,
  `computeDiscordBlock`, `computeOverall`, Reddit error-vs-empty
  classification, the breadcrumb log line, and all 71-1 retry-eligibility
  logic are untouched. Re-running the existing 71-1 and 71-3 unit tests for
  those modules should require zero changes — only the *persistence layer*
  (`writeInvocationOutcomeRecord` → `mergeInvocationOutcome` +
  `markInvocationStarted`, `findLatestOutcomeFile`/`readLatestOutcomeRecord`
  → `readDayOutcomeRecord`) and the check script's exit-code function change.
- The Hermes Discord-skill outcome-record gap remains deferred, as previously
  agreed — out of AC scope, tracked in `deferred-work.md`.

## Definition of done for this amendment

- `bash scripts/verify.sh` green, including the 8 new tests above plus all
  pre-existing 71-1/71-3 tests unchanged.
- A focused re-review (not a full 3-layer re-run) confirming: (a) the merge
  semantics correctly implement sticky-true as specified, (b)
  `markInvocationStarted` fires on every code path including fast-exits, (c)
  the check script's three-way branch (success / in-progress-within-grace /
  fail) matches the pseudocode above.
- Story 71-3 → `done`. Operator step unchanged: re-run
  `bash scripts/install-morning-digest-cron.sh`.