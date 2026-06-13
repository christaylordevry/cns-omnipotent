---
story_id: 71-4
epic: 71
key: 71-4-discord-only-repair-from-day-outcome-record
status: review
baseline_commit: 97045acae7643c9cbb408c989c4c8b89bc222197
title: discord-only-repair-from-day-outcome-record
priority: P1
story_type: ops-reliability-feature
depends_on:
  - 71-1 (classifyDigestRetryBucket, DIGEST_LOG_ACTIONS)
  - 71-2 (pushPayload result gate, Discord gated on Convex)
  - 71-3 + amendment (day-level outcome record, sticky convex/discord flags, readDayOutcomeRecord)
blocks: none
closes_epic: 71
supersedes: original Epic 71 §71-4 draft (log-scan inferDiscordFromLogActions); this version reads dayOutcome.discord.ok directly
audit_ref: cursor_repository_audit_and_assessment.md (2026-06-12) Top-10 #4, Bugs §C
---

# Story 71.4: Discord-Only Repair from Day Outcome Record

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator whose Convex digest row published but Discord never received the post**,
I want **the watchdog to retry only the Discord leg using the existing digest-push artifact and the day outcome record's sticky `discord.ok` flag**,
so that **a transient Discord failure does not leave the day permanently `partial` and does not risk a duplicate `digestRuns` row from re-running adapters or Convex push**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 71 — Digest Job-State & Watchdog Truth (**final planned story — closes 71-1..71-4 scope**) |
| **Redesign note** | Original epic draft inferred Discord status via log-scanning (`inferDiscordFromLogActions`). **Do not use that path for bucket-4 eligibility.** The 71-3 amendment's day record exists precisely to replace fragile inference — read `dayOutcome.discord.ok` directly. |
| **Predecessors** | 71-1 (retry buckets 1–3), 71-2 (Convex push gate), 71-3 (day-level `YYYY-MM-DD.json`, sticky merge, `readDayOutcomeRecord`) |
| **Out of scope** | Hermes Discord-skill pipeline; Convex schema changes; automated recovery when artifact is missing (AC3 — deliberate residual); new cron/install scripts |
| **Review expectation** | Small, focused diff after `dev-story` + `verify.sh` — one classifier branch, one orchestrator branch, one watchdog wiring change. No new storage model. |

### Problem (today)

Once Convex push succeeds for a date, `classifyDigestRetryBucket` (71-1) returns `terminal-success` and the watchdog no-ops — **even if Discord posting failed or never ran**. There is no path to retry *only* Discord without re-running the full adapter pipeline (duplicate `digestRuns` row risk — audit fragility item).

The 71-3 amendment tracks `convex.ok` and `discord.ok` as independent sticky flags on `~/.hermes/digest-outcomes/YYYY-MM-DD.json`. This story adds bucket **`discord-only-repair`**, triggered when convex succeeded for the day but discord did not.

**Watchdog dead-code trap (must fix in AC2, not just AC1):** Today `runPushDigestWatchdog` treats `evaluateTodayDigestRuns(...).hasNonFailedToday` (Convex row `published`/`archived`/`completed`) as sufficient for `skipped-already-pushed` — the watchdog's "nothing to do" early exit at lines 372–375. That is **precisely** the Convex-published state bucket-4 must inspect. If dev only reorders the day-record read but leaves the early-exit predicate as "Convex is published," bucket-4 is unreachable on every day it matters — **dead code on day one** that can still pass classifier unit tests in isolation.

## Acceptance Criteria

### AC1 — New classifier bucket: `discord-only-repair`

`classifyDigestRetryBucket` (`scripts/lib/digest-retry-eligibility.mjs`) gains an optional parameter: `dayOutcome` (day-level record from 71-3, or `null`/`undefined` if absent — **caller reads it; classifier stays pure, no I/O**).

**Decision order** (existing buckets 1–3 unchanged, evaluated first as today):

```
result = <existing bucket-1/2/3 logic, unchanged>

if (result === 'terminal-success') {
  if (dayOutcome
      && dayOutcome.convex.ok === true
      && dayOutcome.discord.ok === false
      && dayOutcome.inProgress === null) {
    return 'discord-only-repair';
  }
}

return result;
```

- If `dayOutcome` is `null`/absent → behavior **unchanged** (fail-safe: no repair without a day record).
- Update `@typedef` to include `'discord-only-repair'` in `DigestRetryBucket`.

### AC2 — Watchdog early-exit predicate must include Discord (not just read ordering)

`scripts/push-digest-watchdog.mjs` must change **what** triggers `skipped-already-pushed`, not merely **when** the day record is read. Reordering alone leaves bucket-4 dead: the old predicate fires on Convex-published alone, before the classifier ever runs.

#### Two cases that today collapse into one `skipped-already-pushed`

| Case | Day record | Correct watchdog behavior |
|------|------------|---------------------------|
| **A — genuinely done** | `convex.ok && discord.ok` (or discord absent/true after merge) | Early exit: `skipped-already-pushed`. Day-record read **not required** for this path — Convex published + sticky discord ok is sufficient. |
| **B — bucket-4 target** | `convex.ok && !discord.ok` | **Must not** early-exit on Convex-published alone. Read day record, classify with `dayOutcome`, return `deferred-discord-only-repair`. |

The early-exit condition changes from:

```
// TODAY (broken for 71-4) — fires on every published Convex day
if (hasNonFailedToday) → skipped-already-pushed
```

to:

```
// REQUIRED — only skip when Discord leg is also done for the day
if (hasNonFailedToday && dayDiscordOk) → skipped-already-pushed
// where dayDiscordOk = dayOutcome?.discord?.ok === true
// (when day record absent or discord.ok not true → do NOT early-exit here)
```

When case B applies, flow continues to `classifyDigestRetryBucket({ ..., dayOutcome })`, which returns `discord-only-repair` per AC1.

#### Normative watchdog flow (replace lines ~364–390)

1. Convex query (unchanged) → `hasNonFailedToday`, `todayConvexStatus`.
2. **If `hasNonFailedToday`:** read day record (lazy read — only needed on this branch):
   ```js
   import {
     readDayOutcomeRecord,
     resolveDigestOutcomeDir,
   } from './lib/digest-run-outcome.mjs';

   const outcomeDir = resolveDigestOutcomeDir(operatorHome);
   const dayOutcome = await readDayOutcomeRecord(outcomeDir, todayDate, readFileFn);
   ```
3. **Early exit only when both legs done:**
   ```js
   if (hasNonFailedToday && dayOutcome?.discord?.ok === true) {
     await log('skipped-already-pushed', 0);
     return { action: 'skipped-already-pushed', exitCode: 0 };
   }
   ```
   Do **not** return `skipped-already-pushed` when `hasNonFailedToday && dayOutcome?.discord?.ok !== true`.
4. **Classify** (for all non–case-A paths, and when day record missing/`discord.ok` false):
   ```js
   const bucket = classifyDigestRetryBucket({
     latestLogAction: latestLog?.action ?? null,
     detail: latestLog?.detail ?? null,
     convexStatus: todayConvexStatus,
     hasArtifact,
     dayOutcome, // null if not read yet — read before classify when hasNonFailedToday was false OR discord not ok
   });
   ```
   When step 2 was skipped (Convex not published), read `dayOutcome` here before calling classify if bucket-4 eligibility depends on it (classifier fail-safe: null dayOutcome → no repair).
5. **Act on bucket:**
   - `discord-only-repair` → `{ action: 'deferred-discord-only-repair', exitCode: 0 }` (orchestrator owns side effects; mirror `deferred-push-only-artifact`).
   - `terminal-success` → `skipped-already-pushed` (covers terminal log/convex paths where both legs are done without needing case-A early exit).
   - Existing buckets 1–3 handling unchanged below this point.

**Review litmus test:** With Convex row `published` and day record `{ convex: { ok: true }, discord: { ok: false }, inProgress: null }`, `runPushDigestWatchdog` must return `deferred-discord-only-repair`, **not** `skipped-already-pushed`. If it returns `skipped-already-pushed`, AC2 is not implemented — regardless of classifier unit tests.

**`readDayOutcomeRecord` signature (71-3 — already exported):**

```js
readDayOutcomeRecord(dir, date, readFileFn?, warnFn?) → Promise<Record | null>
```

- First arg is **outcomes directory** (`resolveDigestOutcomeDir(operatorHome)`), not operator home root.
- File path: `join(dir, `${date}.json`)` — day-level merge model from 71-3 amendment.
- No signature change expected; if a call site passes `operatorHome` directly, fix the call site only.

### AC3 — Orchestrator handles `discord-only-repair`

In `scripts/run-digest-convex-completion.mjs`, add a branch when watchdog returns `deferred-discord-only-repair` (parallel to `deferred-push-only-artifact`):

1. Read `~/.hermes/digest-push-YYYY-MM-DD.json` (same artifact path as bucket-3 push-only recovery).
2. **Artifact present and parseable:**
   - Call `postDigestToDiscord(payload, env)` directly — **no** `collectAdapterOutputs`, **no** `pushPayload`/Convex push (convex already `ok: true` for the day; do not risk duplicate `digestRuns` row).
   - On success: log `discord-only-repair-ok`. In outcome merge: `current.discord = { ok: true, error: null }`, `current.ranAdapters = false`. Sticky merge sets day `discord.ok = true`, `overall` recomputes to `success`.
   - On failure: log `discord-only-repair-failed` with error detail. `current.discord = { ok: false, error: <reason> }`. Day record stays `discord.ok: false`, `overall` stays `partial`. History entry records this attempt.
3. **Artifact missing or invalid JSON:**
   - Log `discord-only-repair-skipped-no-artifact`.
   - **Deliberately do not escalate to full-pipeline** — would reintroduce duplicate `digestRuns` row risk this story exists to avoid. Day stays `partial`.
   - Add an inline code comment at this branch:
     ```js
     // deliberately not escalating to full-pipeline — see 71-4 AC3
     ```
   - `current.discord` unchanged; day record stays `partial`.

Set `invocation.recoveryPath` appropriately (suggest `'none'` — Discord-only is not adapter recovery; document in history via terminal action).

### AC4 — Action vocabulary additions

Add to `DIGEST_LOG_ACTIONS` in `digest-retry-eligibility.mjs` (so `findLatestDigestLogEntryForDate` recognizes audit lines):

- `discord-only-repair-ok`
- `discord-only-repair-failed`
- `discord-only-repair-skipped-no-artifact`

**Not** in `TERMINAL_SUCCESS_LOG_ACTIONS` or `CONVEX_FAILURE_TERMINAL_ACTIONS` — bucket-4 eligibility is keyed off the day outcome record, not log inference (same treatment as `push-only-artifact-recovery`).

### AC5 — Idempotency: repair attempted at most once per success; retries on failure

Because `discord-only-repair` only fires when `dayOutcome.discord.ok === false`, a successful repair sets `discord.ok: true` and the bucket naturally stops firing on subsequent watchdog windows the same day — no separate "already tried" flag.

A **failed** repair leaves `discord.ok: false`, so the **next watchdog window retries** (e.g. 13:00 fails → 18:30 retries). Tests must assert: repeated failures keep retrying; one success stops further attempts.

## Tasks / Subtasks

- [x] **Classifier (AC1, AC4)** — `scripts/lib/digest-retry-eligibility.mjs`
  - [x] Add `dayOutcome` optional param and bucket-4 branch after terminal-success
  - [x] Extend `DigestRetryBucket` typedef; add three new `DIGEST_LOG_ACTIONS`
- [x] **Watchdog wiring (AC2)** — `scripts/push-digest-watchdog.mjs`
  - [x] Import `readDayOutcomeRecord`, `resolveDigestOutcomeDir`
  - [x] **Change early-exit predicate:** `hasNonFailedToday && dayOutcome?.discord?.ok === true` (not Convex-published alone)
  - [x] Read day record when `hasNonFailedToday` before deciding early exit; pass `dayOutcome` into classifier
  - [x] Return `deferred-discord-only-repair` when bucket matches (not `skipped-already-pushed`)
- [x] **Orchestrator branch (AC3)** — `scripts/run-digest-convex-completion.mjs`
  - [x] Handle `deferred-discord-only-repair` like push-only defer
  - [x] Discord-only path: artifact read → `postDigestToDiscord` only
  - [x] Outcome merge with `ranAdapters: false`; AC2.3 comment on no-escalation
- [x] **Tests (AC1–AC5)** — see Test Matrix below
- [x] **Verify gate** — `bash scripts/verify.sh` green

### Review Findings

- [x] [Review][Patch] Spurious convex divergence warning on discord-only-repair happy path [`scripts/lib/digest-run-outcome.mjs:mergeDayOutcomeRecord`] — `computeConvexBlock` catch-all returned `ok:false` for `discord-only-repair-*`; sticky merge wrote false divergence into `history[].warnings`. Fixed: `CONVEX_UNTOUCHED_TERMINAL_ACTIONS` suppresses divergence; history mirrors existing convex and recomputes `overall`.
- [x] [Review][Patch] Test gap: 71-4 success/failure tests did not assert `history.at(-1).warnings` [`tests/run-digest-convex-completion.test.mjs`] — added assertions; added unit test in `digest-run-outcome.test.mjs`.
- [x] [Review][Patch] `DISCORD_SUCCESS_ACTIONS` / `DISCORD_FAILURE_ACTIONS` missing repair actions [`scripts/lib/digest-run-outcome.mjs:48-49`] — added `discord-only-repair-ok` / `discord-only-repair-failed` for log inference hardening.
- [x] [Review][Defer] `recoveryPath = 'none'` for discord-only-repair branch mislabels observability [`scripts/run-digest-convex-completion.mjs:819`] — deferred, pre-existing enum gap; no correctness impact.

## Test Matrix

| # | Scope | Assert |
|---|-------|--------|
| 1 | `digest-retry-eligibility.test.mjs` | Log/convex → `terminal-success` inputs + `dayOutcome = { convex:{ok:true}, discord:{ok:false}, inProgress:null }` → `'discord-only-repair'` |
| 2 | same | `dayOutcome.discord.ok = true` → `'terminal-success'` |
| 3 | same | `dayOutcome = null` → `'terminal-success'` (unchanged pre-71-4) |
| 4 | same | `dayOutcome.inProgress !== null` → `'terminal-success'` |
| 4b | `push-digest-watchdog.test.mjs` | **AC2 litmus:** Convex `published` + day record `convex.ok:true, discord.ok:false` → `deferred-discord-only-repair`, **not** `skipped-already-pushed` |
| 4c | same | Convex `published` + day record `discord.ok:true` → `skipped-already-pushed` (case A — no classify needed for repair) |
| 5 | `run-digest-convex-completion.test.mjs` | Artifact present, mock `postDigestToDiscord` ok → no `collectAdapterOutputs`, no push spawn, `discord-only-repair-ok` logged, merged day record `discord.ok: true`, `overall: 'success'` |
| 6 | same | `postDigestToDiscord` fails → `discord-only-repair-failed`, `discord.ok` stays false, `overall: 'partial'`, history entry |
| 7 | same | Missing artifact → `discord-only-repair-skipped-no-artifact`, no `collectAdapterOutputs`, `overall` stays `'partial'` |
| 8 | `push-digest-watchdog.test.mjs` or completion test | 13:00 failed repair then 18:30: bucket-4 fires again while `discord.ok === false`; after success, bucket stops |

## Dev Notes

### Architecture compliance

- **Pure classifier, impure callers:** `classifyDigestRetryBucket` remains side-effect free (71-1 contract). Day record I/O lives in watchdog only.
- **Sticky day merge:** Use existing `mergeInvocationOutcome` / `mergeDayOutcomeRecord` — do not write raw JSON by hand. Set `ranAdapters: false` on Discord-only path so sources are not wiped.
- **No Convex push on repair path:** Duplicate `digestRuns` per date has no unique constraint — re-push is the primary fragility this story avoids.
- **Defer action pattern:** Watchdog returns defer actions (`deferred-push-only-artifact` today); orchestrator executes. Follow same pattern for `deferred-discord-only-repair`.

### Files to touch

| File | Change |
|------|--------|
| `scripts/lib/digest-retry-eligibility.mjs` | Bucket 4, `dayOutcome` param, log action constants |
| `scripts/push-digest-watchdog.mjs` | Read day outcome, classifier wiring, defer return |
| `scripts/run-digest-convex-completion.mjs` | Discord-only branch, outcome merge shaping |
| `tests/digest-retry-eligibility.test.mjs` | Tests 1–4 |
| `tests/run-digest-convex-completion.test.mjs` | Tests 5–7 |
| `tests/push-digest-watchdog.test.mjs` | Test 8 (multi-window retry) |

### Code patterns to reuse (do not reinvent)

**Broken early exit today (must replace — not just move):**

```372:375:scripts/push-digest-watchdog.mjs
    if (evaluated.hasNonFailedToday) {
      await log('skipped-already-pushed', 0);
      return { action: 'skipped-already-pushed', exitCode: 0 };
    }
```

This fires on every Convex-published day before `classifyDigestRetryBucket` runs. AC2 requires gating on `dayOutcome?.discord?.ok === true` as well.

**Push-only defer (mirror this):**

```752:766:scripts/run-digest-convex-completion.mjs
      if (watchdogResult.action === 'deferred-push-only-artifact') {
        invocation.recoveryPath = 'push-only-artifact';
        await log('push-only-artifact-recovery', 0);
        const pushOnlyResult = await pushOnlyFromArtifact({
          env,
          todayDate,
          operatorHome,
          log,
          pushFn,
          invocation,
        });
```

**Day record read (already exported, tested):**

```415:427:scripts/lib/digest-run-outcome.mjs
export async function readDayOutcomeRecord(dir, date, readFileFn = readFile, warnFn) {
  const warn = warnFn ?? ((message) => process.stderr.write(`${message}\n`));
  try {
    const raw = await readFileFn(join(dir, `${date}.json`), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    warn(`[digest-run-outcome] corrupt or unreadable day record ${date}.json — treating as absent`);
    return null;
  }
}
```

**Artifact path (shared with bucket-3):**

```507:507:scripts/run-digest-convex-completion.mjs
  const artifactPath = join(ctx.operatorHome, '.hermes', `digest-push-${ctx.todayDate}.json`);
```

**Existing comment acknowledging 71-4 pattern at push-only path:**

```520:520:scripts/run-digest-convex-completion.mjs
  // Pattern shared with 71-4 Discord-only repair — retry failed leg from digest-push artifact.
```

Discord-only repair differs: **skip** the `pushPayload` call in that shared pattern — Discord leg only.

### Anti-patterns (will fail review)

| Do not | Why |
|--------|-----|
| Re-run `collectAdapterOutputs` on missing artifact | AC3 — deliberate no-escalation |
| Call `pushPayload` on Discord-only repair | Duplicate `digestRuns` row risk |
| Use `inferDiscordFromLogActions` for bucket-4 eligibility | Superseded design; use `dayOutcome.discord.ok` |
| Add `discord-only-repair-*` to `TERMINAL_SUCCESS_LOG_ACTIONS` | Would break bucket 1/2/3 ordering |
| Early-exit on `hasNonFailedToday` alone (reorder read but keep old predicate) | Bucket-4 dead code — every published Convex day skips before classify |
| Return `skipped-already-pushed` when `convex.ok && !discord.ok` | Case B must defer to orchestrator |

### What this story does not solve

**Missing-artifact case (AC3)** leaves the day permanently `partial` if Convex succeeded but the artifact was deleted and Discord never posted. Rare but possible (disk issue, manual cleanup). Acceptable for solo-operator system — history shows `discord-only-repair-skipped-no-artifact` as diagnostic signal; operator can manually re-trigger from Convex row signals. **Not worth automated full-pipeline recovery** — trades one fragility for another.

### Testing standards

- Use existing `node:test` patterns in `tests/digest-retry-eligibility.test.mjs`, `tests/run-digest-convex-completion.test.mjs`, `tests/push-digest-watchdog.test.mjs`.
- Mock `postDigestToDiscord`, `collectFn`, `watchdogFn`, `readFileFn` — no live Discord/Convex in unit tests.
- For outcome assertions, use `resolveDayOutcomeFilePath(operatorHome, date)` or `readDayOutcomeRecord` read-back (see 71-3 tests).
- Run full gate: `bash scripts/verify.sh`.

### Project Structure Notes

- All changes in `scripts/` and `tests/` — no Vault IO MCP / WriteGate / `security.md` touch.
- No operator cron install step — watchdog windows already exist (07:15 / 13:00 / 18:30).

## Previous Story Intelligence (71-3)

| Learning | Application for 71-4 |
|----------|----------------------|
| Day-level `YYYY-MM-DD.json` with sticky-true `convex.ok` / `discord.ok` | Bucket-4 reads `dayOutcome.discord.ok` directly |
| `readDayOutcomeRecord(dir, date)` exported from `digest-run-outcome.mjs` | Watchdog imports it; first arg is outcomes dir |
| `mergeInvocationOutcome` with `ranAdapters: false` preserves sources | Discord-only path must set `ranAdapters: false` |
| `inProgress` marker blocks check script during concurrent runs | Bucket-4 requires `inProgress === null` to avoid racing |
| `inferDiscordFromLogActions` still used inside `computeDiscordBlock` for per-invocation outcome build | **Do not** use it for retry eligibility — different concern |
| Amendment closed 71-3 with 8 new tests + verify green | Extend same test files; keep amendment tests passing |

## Git Intelligence

Recent commits on branch are mostly session-close / epic closure work — Epic 71 implementation (71-1..71-3) is in working tree patterns, not necessarily in recent commit titles. Follow established patterns from:

- `deferred-push-only-artifact` defer + orchestrator branch (71-1 review)
- Day outcome merge in `finally` block of `runDigestConvexCompletion` (71-3)

## Latest Tech Information

No new external libraries. Node built-ins + existing Hermes digest scripts only. `postDigestToDiscord` API unchanged (`scripts/hermes-skill-examples/morning-digest/scripts/post-digest-discord.mjs`).

## Project Context Reference

- [Source: `project-context.md` — verify gate, spec-first]
- [Source: `_bmad-output/planning-artifacts/epic-71-digest-job-state-and-watchdog-truth.md` — Story 71-4 original intent (superseded eligibility mechanism)]
- [Source: `_bmad-output/implementation-artifacts/71-3-structured-run-outcome-record-observability-gate.md` — day record schema, sticky merge, amendment]
- [Source: `_bmad-output/implementation-artifacts/71-1-fix-watchdog-false-success-on-started-runs.md` — classifier buckets 1–3]
- [Source: `_bmad-output/implementation-artifacts/71-2-pushpayload-result-check-gate-discord-on-convex.md` — Discord gated on Convex in full pipeline]

## Definition of Done

- `bash scripts/verify.sh` green, including tests 1–8 (plus 4b/4c AC2 litmus).
- Focused review confirms: **AC2 early-exit predicate** uses `hasNonFailedToday && discord.ok` (not Convex-published alone); bucket-4 ordering (only overrides `terminal-success`, never 1/2/3); no Convex push on repair path; day record merge reflects repair success/failure per sticky-discord rules; AC3 no-escalation comment present.
- No operator cron/install changes.
- **Epic 71 planned scope (71-1 through 71-4) complete** — epic can move to retrospective / done after this story merges.

## Dev Agent Record

### Agent Model Used

Composer 2.5 (Cursor Agent)

### Debug Log References

- AC2 litmus verified in `tests/push-digest-watchdog.test.mjs`: Convex `published` + day record `{ convex: { ok: true }, discord: { ok: false }, inProgress: null }` → `result.action === 'deferred-discord-only-repair'` (explicit `assert.notEqual(..., 'skipped-already-pushed')`).

### Completion Notes List

- Added bucket-4 `discord-only-repair` to pure classifier with `dayOutcome` param; overrides `terminal-success` only when sticky day record shows convex ok + discord failed + not in progress.
- Fixed watchdog dead-code trap: early exit now requires `hasNonFailedToday && dayOutcome?.discord?.ok === true`; case B defers to orchestrator via `deferred-discord-only-repair`.
- Orchestrator `discordOnlyFromArtifact` reads digest-push artifact, calls `postDigestToDiscord` only (no `pushPayload` / no adapters); AC3 no-escalation comment on missing artifact branch.
- **Review litmus (AC2):** With Convex row `published` and day record `{ convex: { ok: true }, discord: { ok: false }, inProgress: null }`, `runPushDigestWatchdog` returns `{ action: 'deferred-discord-only-repair', exitCode: 0 }` — **not** `skipped-already-pushed`. Test name: `AC2 litmus: Convex published + discord.ok false → deferred-discord-only-repair`.
- `bash scripts/verify.sh` green (CNS + cns-dashboard).
- **Adversarial review (second pass):** Confirmed operator hypothesis — every successful `discord-only-repair-ok` wrote spurious `divergence: convex check returned ok=false` into history despite day-level sticky merge staying correct. Patched `mergeDayOutcomeRecord` + tests; verify green post-patch.

### File List

- `scripts/lib/digest-retry-eligibility.mjs`
- `scripts/lib/digest-run-outcome.mjs`
- `scripts/push-digest-watchdog.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `tests/digest-retry-eligibility.test.mjs`
- `tests/digest-run-outcome.test.mjs`
- `tests/push-digest-watchdog.test.mjs`
- `tests/run-digest-convex-completion.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-06-13: Story 71-4 — discord-only repair bucket, watchdog early-exit predicate fix, orchestrator defer branch, tests 1–8 + AC2 litmus.

## Story Completion Status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **review**
- Epic 71 planned scope (71-1 through 71-4) complete — ready for retrospective after merge
