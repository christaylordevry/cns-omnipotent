---
story_id: OPS-1
epic: ops-observability
title: fail-loudly-when-digest-push-writes-zero-signals
status: done
created: 2026-07-20
operator_brief: 2026-07-20
design_gate: APPROVED_2026-07-20
baseline_commit: dc3eca2
incident: 2026-07-20 Convex free-plan outage — full day of digest signals lost silently
predecessors: 67-10, 71-3, 81-2
---

# Story OPS-1: Fail loudly when the digest push writes zero signals

Status: done

## Story

As the **CNS operator**,
I want **the push-digest watchdog to exit non-zero and alert me in Discord the moment a push writes zero signals it had signals for**,
so that **a Convex outage surfaces within minutes of 07:15 instead of being discovered ~12h later by manually reading cron logs**.

---

## Incident (the bug this closes)

On **2026-07-20** a Convex free-plan ceiling silently disabled all deployments. Every digest
push failed. `~/.hermes/logs/push-digest-watchdog.log` recorded:

```
… action=completion-convex-push-failed date=2026-07-20 exit=0 detail={"error":"…","signalsWritten":0}
```

**`exit=0`.** Cron reported success while writing nothing. A full day of signals was lost and
found only by manually reading logs. The 19:00 `run-digest-outcome-check-cron.sh` gate would
have caught it — roughly 12 hours late. The watchdog must fail fast; this story does not
weaken or rely on the 19:00 gate.

---

## Review Gate — APPROVED (2026-07-20)

Three premises in the original operator brief were falsified during investigation. All three
corrections are approved.

### (a) The wrapper needs NO change — **APPROVED**

`scripts/run-push-digest-watchdog-cron.sh:38` ends with `exec node …`. `exec` **replaces** the
shell process, so node's exit status already *is* the wrapper's exit status. `set -euo pipefail`
is irrelevant to this path.

**The entire silent failure lives in the `.mjs`**, at `scripts/run-digest-convex-completion.mjs:1197-1209`:

```js
async function main() {
  const { forceRescore } = parseCompletionCliArgs(process.argv.slice(2));
  await runDigestConvexCompletion({ forceRescore });   // return value discarded
  process.exit(0);                                     // hardcoded
}
…
main().catch(() => process.exit(0));                   // even a throw exits 0
```

Every internal `return { action, exitCode: 0 }` is also hardcoded to 0, and `main` never reads
`exitCode` anyway.

> **Do not edit `run-push-digest-watchdog-cron.sh` in this story.** If a task seems to require
> it, stop and re-read this section.

### (b) The dual-copy / `cmp` AC is INAPPLICABLE — **APPROVED (AC replaced)**

Neither `run-digest-convex-completion.mjs` nor `run-push-digest-watchdog-cron.sh` exists
anywhere under `~/.hermes` (verified by `find`). Cron invokes them **directly from the repo
path** (verified in `crontab -l`):

```
15 7 * * * … /bin/bash "…/Omnipotent.md/scripts/run-push-digest-watchdog-cron.sh" …
```

The dual-copy tree is `scripts/hermes-skill-examples/morning-digest/scripts/` ↔
`~/.hermes/skills/cns/morning-digest/scripts/`. **This story touches none of it.** A `cmp` AC
here would pass vacuously and give false assurance.

**Replaced by AC7 — a negative assertion:** no file under `scripts/hermes-skill-examples/` is
modified. If the implementation finds itself needing to change a file in that tree, the design
is wrong — stop and escalate.

### (c) Cron discards the exit code — **ACKNOWLEDGED**

All four digest crontab entries redirect `>>logfile 2>&1` with no mailer. **Exit-non-zero alone
would have changed nothing on 2026-07-20.** The Discord alert is the load-bearing requirement.
The exit code still matters for manual runs, `bash -e` callers, and future supervision — ship
both, but do not treat the exit code as the alerting mechanism.

### (d) Detection condition: REUSE `computeOverall`, do not invent — **APPROVED**

`computeOverall()` (`scripts/lib/digest-run-outcome.mjs:299`) already classifies this exact
incident as `'failed'` — `completion-convex-push-failed` is in `CONVEX_FAILURE_TERMINAL_ACTIONS`.
`runDigestConvexCompletion` **already computes it every run** in its `finally` block
(`:1183-1194` → `mergeInvocationOutcomeRecord` → `computeOutcomeFromInvocation`) and then
throws it away.

**Condition: `overall !== 'success'` → exit 1 + alert.**

A bespoke `signalsWritten === 0 && expectedCount > 0` check was rejected: it catches only one
row of the table below and misses two other real silent-failure classes.

| terminal action | `overall` | exit | rationale |
|---|---|---|---|
| `skipped-already-pushed` **+ Convex row confirmed** | `success` | 0 | the normal 13:00 / 18:30 no-op — **must not alarm** |
| `skipped-already-pushed` **but no Convex row** | `partial` | 1 | second silent class — log says pushed, reality disagrees |
| `skipped-no-artifact` | *never terminal* — falls through to full pipeline (`:1106`) | — | cannot false-alarm |
| `completion-convex-push-failed` | `failed` | 1 | **the 2026-07-20 bug** |
| `completion-no-signals` | `failed` | 1 | see (e) |
| `discord-post-failed` (Convex wrote OK) | `partial` | 1 | see (f) |

### (e) `completion-no-signals` exits non-zero — **APPROVED**

Strictly this exceeds the brief's "signals were available AND the push failed" rule — here no
signals were available. Approved anyway: **all 17 adapters returning empty is not a legitimate
no-op**, it is a different outage wearing a quieter mask. No code change needed — `computeOverall`
already returns `'failed'` for it.

### (f) Discord-failed-but-Convex-wrote (`partial`) alerts, with distinct wording — **APPROVED**

If Convex wrote but the Discord post failed, the data is safe but **the digest never reached the
operator** — that is worth knowing. It must be visibly distinct from a data-loss alert so the
operator can triage severity at a glance. See AC4 wording.

---

## Acceptance Criteria

**AC1 — Non-zero exit on non-success.**
`runDigestConvexCompletion` surfaces the computed `overall`, and `main()` exits `1` when
`overall !== 'success'`, `0` when `'success'`. `main().catch()` exits `1` (currently `0`).

**AC2 — No false alarm on legitimate no-ops.**
A `skipped-already-pushed` run with a confirmed terminal Convex row exits `0` and posts **no**
alert. This is the 13:00 and 18:30 steady state — regression here is worse than the bug.

**AC3 — The failure is visible in the log line.**
The watchdog log line for a non-success terminal action records `exit=1`, not `exit=0`, so
`grep 'exit=1'` over `~/.hermes/logs/push-digest-watchdog.log` finds real failures.
(`formatWatchdogLogLine`, `scripts/push-digest-watchdog.mjs:229`.)

**AC4 — Discord alert on non-success, reusing the proven path.**
On `overall !== 'success'`, post to the Hermes channel via `postOutcomeCheckAlert()`
(`scripts/check-digest-run-outcome.mjs:54`). No new integration, no new secret, no new channel.
Message must state date, `overall`, terminal action, and `signalsWritten`, and must
**distinguish data-loss from delivery-loss**, e.g.:

- `FAIL: digest push wrote 0/50 signals — 2026-07-20 overall=failed action=completion-convex-push-failed`
- `WARN: digest wrote 50 signals to Convex but Discord delivery failed — 2026-07-20 overall=partial`

Alert failure (network, bad token) must **never** mask the exit code — wrap in try/catch, log to
stderr, still exit 1. Mirror the existing handling at `check-digest-run-outcome.mjs:181-188`.

**AC5 — Alert de-duplication within a day.**
Three watchdog runs/day + the 19:00 gate would fire four alerts on one outage. Stamp `alertedAt`
(and the `overall` it alerted for) on the day outcome record; suppress a **repeat** alert for the
same `overall` on the same date. **Exit code is never suppressed** — every failing run still
exits 1. An escalation (`partial` → `failed`) is a new state and **does** alert.

**AC6 — Operator escape hatch.**
`CHECK_DIGEST_ALERT=0` suppresses the alert (exit code unaffected), matching the existing
convention at `check-digest-run-outcome.mjs:180`.

**AC7 — Dual-copy tree untouched** *(replaces the `cmp` AC — see gate (b))*.
`git diff --name-only` shows **no** file under `scripts/hermes-skill-examples/` modified.
Assert in the story record, not by `cmp`.

**AC8 — Wrapper unmodified** *(see gate (a))*.
`scripts/run-push-digest-watchdog-cron.sh` is byte-identical to its `dc3eca2` state.

**AC9 — Tests.**
New cases in `tests/run-digest-convex-completion.test.mjs` (and `tests/digest-run-outcome.test.mjs`
for record-shape changes). Minimum set:
1. `completion-convex-push-failed` → exit 1, alert fired, message names `signalsWritten`.
2. `skipped-already-pushed` + confirmed Convex row → exit 0, **alert NOT called** (assert the spy has zero calls).
3. `skipped-already-pushed` + missing Convex row → exit 1, alert fired.
4. `completion-no-signals` → exit 1, alert fired.
5. `partial` (Convex ok, Discord failed) → exit 1, alert uses delivery-loss wording.
6. Second failing run same day, same `overall` → exit 1, alert **not** re-fired (AC5).
7. Escalation `partial` → `failed` same day → alert fires again.
8. `CHECK_DIGEST_ALERT=0` → exit 1, no alert.
9. Alert throws → still exit 1 (no masking).

Use injected `alertFn` / `fetchFn` — **no network in tests**.

**AC10 — `bash scripts/verify.sh` passes.**

---

## Implementation Notes

### Seam 1 — return the outcome (no logic moves)

`mergeInvocationOutcome` (`scripts/lib/digest-run-outcome.mjs:644`) **already returns
`{ record, filePath }`**. `mergeInvocationOutcomeRecord` (`run-digest-convex-completion.mjs:898`)
currently returns nothing — have it return that. Purely additive.

### Seam 2 — thread it through the `finally`

`runDigestConvexCompletion`'s `finally` (`:1183`) calls `writeOutcomeFn`. Capture its return into
an outer-scope variable and include `overall` in the resolved value. **Careful:** `result` is
assigned via `return` inside `try` blocks — the `finally` runs after. Do not restructure the
try/finally; only capture.

> Guard: a `return` inside `finally` silently swallows the try-block's return value. Do not
> introduce one. Set the outer variable and let the existing returns stand.

### Seam 3 — `main()`

```js
async function main() {
  const { forceRescore } = parseCompletionCliArgs(process.argv.slice(2));
  const { overall } = await runDigestConvexCompletion({ forceRescore });
  process.exit(overall === 'success' ? 0 : 1);
}
main().catch((err) => { process.stderr.write(…); process.exit(1); });
```

### Seam 4 — the `exit=1` log field (AC3)

The `log()` closure at `:978` takes `exitCode` and every caller passes `0`. Pass `1` at the
non-success call sites (`completion-convex-push-failed` at `:639` and `:727`,
`completion-no-signals` at `:1164`, `completion-artifact-failed`, `completion-pipeline-failed`,
`*-push-failed`). Do **not** change `discord-post-ok` / `entity-analysis-*` informational lines.

### Where the alert fires

Fire from `runDigestConvexCompletion`'s `finally`, **after** the outcome record is merged (so
`alertedAt` de-dup reads a consistent record) — not from `main()`, so the behaviour is
test-reachable without spawning a process.

### Import note

`postOutcomeCheckAlert` is exported from `scripts/check-digest-run-outcome.mjs`, which also has
an `isMain` self-exec guard (`:203`). That guard checks `process.argv[1]`, so importing it is
safe under `node --test`. **Verify this holds** — if the guard misfires under the test runner,
extract `postOutcomeCheckAlert` into `scripts/lib/` rather than working around it, and note the
extraction in the Dev Agent Record.

## Out of Scope

- Any change to `run-push-digest-watchdog-cron.sh` (gate (a)).
- Any change under `scripts/hermes-skill-examples/` (gate (b)).
- Changing the 19:00 `run-digest-outcome-check-cron.sh` gate or its schedule.
- Backfilling the lost 2026-07-20 signals (already handled — see HANDOFF-2026-07-20).
- Retry / self-healing on push failure. **Alerting only.** A retry story is a separate decision.
- Changing `computeOverall`'s classification rules for any action not listed in gate (d).

## Verification

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md
node --test tests/run-digest-convex-completion.test.mjs tests/digest-run-outcome.test.mjs
bash scripts/verify.sh
git diff --name-only        # AC7/AC8: no hermes-skill-examples/, no cron wrapper
```

**Live proof (AC1 + AC2, no outage required):** run the wrapper manually after the morning push
has already succeeded — it should hit `skipped-already-pushed`, print `$?` = `0`, and post no
Discord message:

```bash
bash scripts/run-push-digest-watchdog-cron.sh; echo "exit=$?"
```

## Dev Agent Record

### Implementation Plan

1. Seam 1: `mergeInvocationOutcomeRecord` returns `{ record, filePath }` from `mergeInvocationOutcome`.
2. Seam 2: `finally` captures write result into outer `overall`; mutates `result.overall` / `result.exitCode` in place (no `return` in `finally`; no reassignment of `result` that would orphan the try-return reference).
3. Seam 3: `main()` exits on `overall === 'success' ? 0 : 1`; `main().catch` exits 1.
4. Seam 4: failure terminal `log()` sites pass `exit=1`; informational discord/entity lines unchanged.
5. Alert from `finally` via injected `alertFn` defaulting to `postOutcomeCheckAlert`; dedup via `alertedAt` + `alertedOverall`; `CHECK_DIGEST_ALERT=0` escape hatch; alert errors never mask exit 1.
6. Detection: reuse `computeOverall` only — no bespoke `signalsWritten===0` rule.

### Debug Log

- Trap (try/finally return): avoided `return` in `finally`. Also hit a related trap: `result = { ...result, overall }` in `finally` does **not** update the object already captured by `return result` in `try`. Fixed by mutating `result.overall` / `result.exitCode` in place.
- Trap (isMain import): `postOutcomeCheckAlert` imports cleanly under `node --test` (probe test passed). **No extraction to `scripts/lib/` needed.**

### Completion Notes

- AC1–AC6, AC9 implemented in `scripts/run-digest-convex-completion.mjs` + tests.
- AC2 alert spy uses `assert.equal(alerts.length, 0, ...)` — zero-call assertion.
- AC7/AC8 confirmed — see `git diff --name-only` below (no `scripts/hermes-skill-examples/`, no `run-push-digest-watchdog-cron.sh`).
- Code review patches (1a + P1–P3): clear stamps on success; default unknown→failed; stamp only on `posted === true`; omit `0/0` ratio and append truncated errors.
- `node --test tests/run-digest-convex-completion.test.mjs tests/digest-run-outcome.test.mjs` → 89/89 pass.
- `bash scripts/verify.sh` → PASS.

### File List

- `scripts/run-digest-convex-completion.mjs` (modified)
- `tests/run-digest-convex-completion.test.mjs` (modified)
- `tests/digest-run-outcome.test.mjs` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/OPS-1-digest-push-fail-loud.md` (this story)

### Change Log

- 2026-07-20: OPS-1 — fail loud on non-success digest push (`overall` → exit 1 + Discord alert + dedup); tests AC9.1–9.9.
- 2026-07-20: Code review patches — 1a clear stamps on success; P1 missing-record fail-loud; P2 `posted === true`; P3 alert copy (no 0/0, append errors). verify.sh PASS.

### AC7 / AC8 proof (`git diff --name-only`)

```
_bmad-output/implementation-artifacts/sprint-status.yaml
scripts/run-digest-convex-completion.mjs
tests/digest-run-outcome.test.mjs
tests/run-digest-convex-completion.test.mjs
```

(Untracked story file `OPS-1-digest-push-fail-loud.md` also present; not in diff --name-only for tracked files.)

- Did the `check-digest-run-outcome.mjs` import work under `node --test`, or was extraction needed?
  → **Worked. No extraction.**
- Confirm AC7/AC8 with the actual `git diff --name-only` output pasted in.
  → **Pasted above.**
- Confirm the AC2 alert-spy assertion is a zero-call assertion, not merely "no failure".
  → **Yes: `assert.equal(alerts.length, 0, 'AC2: alert spy must have zero calls')`.**

## Review Findings

### Operator focus (code review 2026-07-20) — verified PASS

1. AC5 dedup / escalation / exit-never-suppressed / stamp survival via `...base` — PASS (tests 6–7 + digest-run-outcome merge test).
2. AC2 zero-call spy — PASS (`assert.equal(alerts.length, 0, 'AC2: alert spy must have zero calls')`).
3. Finally mutates `result` in place for all early-return paths — PASS (no `return` in `finally`; no `result = {…}` reassignment).
4. AC4 alert try/catch does not mask exit 1 — PASS (test 9).
5. AC text not softened vs Review Gate / Implementation Notes — PASS (AC1–AC10 intact; untracked story has no prior committed AC baseline to diff).

### Findings

- [x] [Review][Decision→Patch] Clear alert stamps after success (1a) — **resolved 2026-07-20.** Operator chose clear `alertedAt`/`alertedOverall` when `overall === 'success'`. Rationale: fail → recover → fail is the 2026-07-20 sequence; a NEW failure at 18:30 must alert. "First alert covers it" is the same assumption that caused the original bug. Implemented + test 12.
- [x] [Review][Patch] P1 void outcome write defaults toward silence [`scripts/run-digest-convex-completion.mjs`] — **re-classified from dismissed → patch by operator review.** Defect class: DEFAULTING TOWARD SILENCE. `let overall = 'success'` + `if (written?.record)` gate meant a void `writeOutcomeFn` returned exit 0 with no alert — same bug OPS-1 exists to kill, dormant behind the injectable seam. Fixed: default `overall = 'failed'`; missing-record path logs `completion-outcome-record-missing` and alerts. Test 10.
- [x] [Review][Patch] P2 `posted !== false` stamps on undefined — **re-classified from dismissed → patch by operator review.** Same defect class: undefined post stamped dedup and suppressed later real alerts. Fixed: `posted === true` only. Test 11.
- [x] [Review][Patch] P3 alert copy `0/0` + dropped errors — **re-classified from dismissed → patch by operator review.** Same defect class: `expected ?? 0` yielded `wrote 0/0` (reads like a legitimate no-op) and omitted `convex.error`/`discord.error` (lost plan-limit root cause on 07-20). Fixed: omit ratio when expected is 0; append truncated error. Tests 1 + formatDigestPushFailureAlert cases.
- [x] [Review][Defer] Concurrent alert stamp race [`scripts/run-digest-convex-completion.mjs`] — deferred, pre-existing day-file check-then-act; cron slots are hours apart

### Patch verification (2026-07-20)

- `node --test tests/run-digest-convex-completion.test.mjs tests/digest-run-outcome.test.mjs` → 89/89 pass
- `bash scripts/verify.sh` → PASS
