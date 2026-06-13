---
status: draft
source: cursor_repository_audit_and_assessment.md (2026-06-12) — corrected top-10, items #1-4
depends_on: epic-70 (deterministic morning-digest orchestrator)
supersedes_priority: epic-67 remainder (67-2, 67-6), session-close vault-export PATH work
---

# Epic 71 — Digest Job-State & Watchdog Truth

## Why this epic exists

Epic 70 made the morning-digest pipeline **deterministic and code-driven**. It
did not make it **observable**. The 06-12 audit's single most important
finding is that the pipeline can — and currently does, in at least four
documented paths — report "success" while having silently done the wrong
thing or nothing at all.

Until this is fixed, every other fix in the system (vault-export PATH work,
Reddit OAuth, source-count parity, etc.) is **unverifiable**: you cannot tell
from cron exit codes, Convex state, or Discord posts alone whether a given
morning's digest actually ran end-to-end correctly. The operator currently
has to manually cross-reference logs, Convex, and Discord to know what
happened — and even then, several failure modes (D, E, F below) leave **zero
trace** in any of those three places.

This epic closes that gap. It does not change *what* the digest does; it
changes *what you can know* about what it did.

## Scope

In scope:
- Watchdog `started`-state false-success bug (audit item #1)
- `pushPayload` result checking + Discord/Convex divergence (audit item #2)
- Post-cron observability gate / structured run-outcome surface (audit item #3)
- Discord retry-on-Convex-success-but-Discord-failure (audit item #4)

Out of scope (deliberately deferred — see audit "what dropped out of top 10"):
- Reddit OAuth live wiring (67-2) — depends on this epic's observability to be worth doing
- Cron vs manual source-count reconciliation (10 vs 12) — doc/product decision, not a reliability bug
- Session-close vault-export PATH / drive-sync (separate track — b1cdea6/97045ac already in flight)
- Trends pipeline dedup (digest dry-run vs `run-trend-ingest-cron.sh`) — note as known duplication, don't fix yet

## Definition of done for the epic

A human (or future agent) can answer, for any given calendar date, **without
reading source code**, purely from a structured record:

1. Did the digest run start? When? Which cron invocation (morning / watchdog)?
2. Did it complete, partially complete, or abort? With what reason?
3. Did the Convex push actually succeed (rows present), independent of exit code?
4. Did the Discord post actually succeed, independent of Convex outcome?
5. Per source: did it run, error, or return zero items — and which?
6. If anything above is "no" or "unknown", was there an external signal (non-zero exit / Discord alert) the operator would have seen without manually checking?

If the answer to #6 can be "no, nothing alerted, and the cron exited 0," the
epic is not done.

---

## Story 71-1 — Fix watchdog false-success on `started` runs

**Audit ref:** Top-10 #1, Bugs §A
**Severity:** Critical
**Effort:** 2-4 hours
**Type:** Hotfix

### Problem
`run-push-digest-watchdog-cron.sh` calls
`run-digest-convex-completion.mjs`. The orchestrator's idempotency check
treats a digest run already marked `started` (but never reaching
`completion-*`) as **not eligible for retry** — i.e. a crashed or partially
run digest blocks all three daily watchdog windows (07:15 / 13:00 / 18:30)
from ever recovering it.

### Acceptance criteria
- A run whose latest state for a given date is `started` (no terminal
  `completion-*`/`completion-no-signals`/`skipped-already-pushed` record) is
  treated as **incomplete** and is eligible for full retry by the watchdog.
- A run whose latest state is any `completion-*` or `discord-post-ok` /
  `skipped-already-pushed` is treated as **terminal** and is not retried
  (existing correct behavior — do not regress this).
- New regression test: simulate a log/state file containing only a `started`
  entry for today's date, run the watchdog entrypoint, assert it proceeds to
  a full pipeline run rather than early-exiting.
- New regression test: simulate a log containing `started` →
  `completion-backfill-push` for today, assert watchdog early-exits
  (idempotency preserved).

### Files likely touched
- `scripts/run-digest-convex-completion.mjs` (idempotency/state-check logic)
- Whatever module determines "already pushed today" — likely shares code with
  `skipped-already-pushed` check
- New/extended test under the digest test suite

---

## Story 71-2 — `pushPayload` result check; gate Discord on Convex outcome

**Audit ref:** Top-10 #2, Bugs §B
**Severity:** Critical
**Effort:** 2-3 hours
**Type:** Hotfix
**Depends on:** none (can land independently of 71-1)

### Problem
`pushPayload(payload, env)` shells out via `execFileAsync` to
`push-digest-convex.mjs`, which **always exits 0** regardless of whether the
Convex mutations actually succeeded. `run-digest-convex-completion.mjs` does
not inspect stdout/stderr or any structured result — it proceeds to
`postDigestToDiscord(payload, env)` unconditionally. Result: Discord can show
a full digest while Convex has zero or partial rows for that date, with no
signal anywhere that they diverged.

### Acceptance criteria
- `push-digest-convex.mjs` returns a **non-zero exit code** on any mutation
  failure (network error, auth error, validator rejection, partial
  create/finalize), and emits a structured JSON result on stdout
  (`{ ok: boolean, runId?, signalsWritten?, error? }`) on both success and
  failure paths.
- `run-digest-convex-completion.mjs` parses this result. If `ok: false`:
  - Discord post is **skipped** (or replaced with a single short failure
    alert — see 71-3 for the alerting mechanism).
  - The run's terminal state is recorded as a failure state (not
    `completion-backfill-push` / success), so 71-1's retry logic picks it up.
- If `ok: true` but `signalsWritten` doesn't match `payload.signals.length`,
  this is also treated as a partial failure (not silent success).
- New test: mock `push-digest-convex.mjs` to exit non-zero / return
  `{ok:false}`, assert `postDigestToDiscord` is **not** called and the run is
  marked retryable.
- New test: mock a partial-write result (`signalsWritten < signals.length`),
  assert it is treated as failure, not success.

### Files likely touched
- `scripts/push-digest-convex.mjs` (add real exit codes + structured stdout)
- `scripts/run-digest-convex-completion.mjs` (consume result, branch on it)
- Convex mutation wrappers if exit-code propagation needs plumbing through
  `execFileAsync`

---

## Story 71-3 — Structured run-outcome record + post-cron observability gate

**Audit ref:** Top-10 #3, Hidden SSOT table
**Severity:** High
**Effort:** 3-4 hours
**Type:** Hotfix / small feature
**Depends on:** 71-1, 71-2 (this story is the consumer of the states they introduce)

### Problem
There is currently **no single queryable record** of "did today's digest
work." The real source of truth is scattered across
`~/.hermes/logs/push-digest-watchdog.log` line greps
(`completion-backfill-push`, `discord-post-ok`), `~/.hermes/digest-push-*.json`
artifacts, and Convex `digestRuns` rows — and none of these are checked
together. Cron exit codes are meaningless (item D/E/F all exit 0 on total
failure).

### Acceptance criteria
- Each digest run (cron or watchdog) writes **one structured outcome record**
  per invocation — JSON, one line/file per run — capturing at minimum:
  - `timestamp`, `trigger` (`cron` | `watchdog-0715` | `watchdog-1300` |
    `watchdog-1830` | `manual`)
  - `runId` / date
  - `convex`: `{ ok, signalsWritten, error? }` (from 71-2)
  - `discord`: `{ ok, error? }`
  - `sources`: per-adapter `{ status: ok|error|empty, count }` — this must
    distinguish **empty (item D)** from **error (item E, Reddit)** at the
    type level, not collapse both into "0 signals"
  - `overall`: `success | partial | failed` — computed from the above, not
    from process exit code
- A small new script (e.g. `scripts/check-digest-run-outcome.mjs`) reads the
  latest outcome record for "today" and:
  - exits non-zero if `overall != success`
  - optionally posts a short Discord alert (reuse 70-2's raw REST poster) on
    `partial`/`failed`/missing-record
- This check script is added as a **separate cron entry** running ~30 min
  after the last watchdog window (e.g. 19:00 AEST), so a fully-failed day
  (D/E/F) produces an actual alert even though the digest scripts themselves
  exit 0.
- New test: feed `check-digest-run-outcome.mjs` a `failed`/`partial`/missing
  outcome record, assert non-zero exit + alert call.
- New test: feed it a `success` record, assert exit 0, no alert.

### Files likely touched
- `scripts/run-digest-convex-completion.mjs` (write the outcome record as a
  final step, regardless of branch taken)
- New: `scripts/check-digest-run-outcome.mjs`
- New: `scripts/run-digest-outcome-check-cron.sh`
- `scripts/install-morning-digest-cron.sh` (register the new cron entry)
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs`
  — change `{error: ...}` JSON-with-exit-0 contract so the orchestrator can
  classify it as `error` not `empty` (ties into item E)

---

## Story 71-4 — Discord retry when Convex succeeded but Discord failed

**Audit ref:** Top-10 #4, Bugs §C
**Severity:** Medium-High
**Effort:** 4-6 hours
**Type:** Small feature
**Depends on:** 71-1 (retry-eligibility logic), 71-3 (outcome record to detect the split state)

### Problem
Once a run reaches `skipped-already-pushed` (Convex push succeeded for that
date), subsequent watchdog runs short-circuit entirely — including any
Discord-only repair. If Convex push succeeded but the Discord post step
failed (network blip, rate limit, gateway down), there is **no path** to
retry just the Discord post for the rest of the day. Nexus shows the digest;
Discord never gets it.

### Acceptance criteria
- The "already pushed today" check is split into two independent flags:
  `convexDone` and `discordDone` (both derivable from 71-3's outcome record
  or Convex `digestRuns` row).
- If `convexDone === true && discordDone === false`, the watchdog entrypoint
  takes a **Discord-only repair path**: re-read the existing pushed payload
  (from the Convex row or the `~/.hermes/digest-push-YYYY-MM-DD.json`
  artifact — do **not** re-run the 10 adapters) and call
  `postDigestToDiscord` directly.
- If `convexDone === true && discordDone === true`, watchdog remains a no-op
  (existing behavior preserved).
- If `convexDone === false`, full pipeline retry per 71-1 (existing/updated
  behavior, unchanged by this story).
- New test: outcome record with `convex.ok=true, discord.ok=false` →
  watchdog calls `postDigestToDiscord` with the artifact payload, does not
  call `collectAdapterOutputs`/adapters again.
- New test: `convex.ok=true, discord.ok=true` → watchdog is a no-op.

### Files likely touched
- `scripts/run-digest-convex-completion.mjs` (branch logic + Discord-only path)
- `scripts/run-push-digest-watchdog-cron.sh` (may need to pass a flag/mode,
  or this logic can live entirely in the .mjs and the .sh stays a dumb
  wrapper — prefer the latter to avoid the "watchdog cron ≠ push only" naming
  confusion the audit flagged in item F)

---

## Sequencing & rollout

1. **71-2 first** (independent, smallest blast radius, fixes the worst
   silent divergence — Convex/Discord disagreement).
2. **71-1 second** (unblocks retries for anything 71-2 now correctly marks as
   failed).
3. **71-3 third** (now that 71-1/71-2 produce real failure states, give them
   a structured home + an external alert).
4. **71-4 last** (the only story that's additive/feature-shaped rather than
   a correctness fix; depends on the outcome record from 71-3).

Each story should land with `bash scripts/verify.sh` green before moving to
the next — do not batch all four into one PR. The audit's core complaint is
that validators currently report `pass` while the system is blind; landing
these incrementally with passing tests at each step is itself evidence that
the *test suite*, not just the runtime, now covers job-state correctness.

## After this epic

- **67-6** (compare-smoke docs) becomes meaningful — you'll have a real
  outcome-record history to compare across runs instead of eyeballing logs.
- **67-2** (Reddit OAuth) becomes worth doing — 71-3's source-status
  classification means a dead Reddit adapter will now show as `error`, not
  silently as `empty`, so fixing it has a visible payoff.
- Revisit the **Cron vs Manual Digest Contract** doc (audit recommendation
  #5) — it's still valid, but write it *after* this epic so it can document
  the new outcome-record/alerting behavior too, rather than needing a second
  pass.
- The session-close/vault-export PATH track (b1cdea6/97045ac and follow-on)
  continues independently — it does not block or get blocked by this epic.
