---
story_id: OPS-5
epic: ops-observability
title: drive-sync-timeout-canary-and-rollup-honesty
status: review
created: 2026-07-21
design_gate: APPROVED_2026-07-21
baseline_commit: ac987ca
incident: 2026-07-20 session 24 — drive-sync 3/3 failed; failure_class none; framed as intermittent
predecessors: OPS-1, OPS-4, 58-3, 58-4
related_deferred: deferred-work.md — Epic 58 residual (deterministic 25s sync timeout + rollup honesty)
do_not_run: /session-close to validate this story (unit tests + measured 41.2s only)
---

# Story OPS-5: Drive-sync must not fail deterministically, and total failure must not report success

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

Epic: **ops-observability** (reopened — fail-loud on unvalidated / vacuous success; same theme as OPS-1 / OPS-2 / OPS-4)  
Tracked in sprint-status as: **`OPS-5-drive-sync-timeout-canary-and-rollup-honesty`**  
**Depends on:** nothing unshipped (58-4 concurrent sync + per-call timeout + incremental merge are live)  
**Does not reopen:** Epic 58 (closed; this is residual fail-loud + bound hygiene under ops-observability)

## Story

As the **CNS operator**,
I want **`nlm source sync` bounded by a realistic timeout, a canary that warns before the bound is breached again as the export grows, and a drive-sync phase rollup that never reports `failure_class: none` when every target failed (or when zero targets resolved)**,
so that **session-close stops failing deterministically on the current ~1.6 MB export, trends are visible before the next outage, and total / vacuous failure cannot hide as success**.

---

## Incident (the bug this closes)

**Observed live 2026-07-20, session 24.** All **3 of 3** NotebookLM targets failed. Hermes summarised it as "the usual pattern (intermittent timeouts)" with `failure_class: none`. That framing is wrong.

### Measured evidence (LOCKED — do not re-derive)

| Fact | Value |
|------|-------|
| Live sync wall time | `time nlm source sync f037c741… --source-ids 19fdae14… -y` → **real 0m41.2s** (2026-07-21) |
| Current bound | `NLM_EXEC_TIMEOUT_MS = 25_000` (`sync-vault-export-drive.mjs:18`) |
| Export size | ~1.63 MB |
| Verdict | **41.2s > 25s → every sync of this export fails.** Deterministic, not intermittent. |

Log corroboration (`~/.hermes/logs/session-close-drive-sync.log`, session 24):

```
07:47:43.992  start
07:48:09.985  f037c741…  Command failed: nlm source sync …   → 25.99s
07:48:10.286  dc6abf1a…  Command failed: nlm source sync …   → 26.29s
```

Full analysis: `_bmad-output/implementation-artifacts/deferred-work.md` — **Epic 58 residual**.

### Three separable problems (only (a)+(c) in scope; keep (b) separate)

| # | Problem | In scope? |
|---|---------|-----------|
| (a) | Sync bound too short for current export size | **Yes** — split list vs sync bounds + canary |
| (b) | `981466f0` never reached sync — `NOTEBOOKLM_DRIVE_DOC_ID` matches no source; no fallback | **No** — operator UI fix (add PDF as Drive source). Do not lump under "timeouts" |
| (c) | Rollup reports `failure_class: none` while 3/3 failed | **Yes** — stamp at end of `runSyncVaultExportDrive` |

### Actual mechanism for silent success (not a side issue)

```479:479:scripts/session-close/sync-vault-export-drive.mjs
  return { ok: true, synced: updates.filter((u) => u.status === "ok").length };
```

When every target fails, this returns **`{ ok: true, synced: 0 }`**. Per-target stamps from 58-4 are correct; the **phase rollup** is the lie. Fixing `failure_class` without fixing this return leaves a second silent-success surface.

Same vacuous class: empty `notebooklm_targets` currently returns `{ ok: true, synced: 0 }` after a soft stderr line (~L407–409).

---

## Design decisions — APPROVED 2026-07-21 (binding)

| # | Decision | Binding rule |
|---|----------|--------------|
| 1 | Story key **OPS-5**; reopen **ops-observability** | Epic 58 stays closed. Fail-loud / refuse-vacuous-success theme. |
| 2 | Split timeout constants | `NLM_LIST_TIMEOUT_MS=25_000`, `NLM_SYNC_TIMEOUT_MS=120_000`. Both env-overridable. |
| 3 | **REMOVE** `NLM_EXEC_TIMEOUT_MS` | No deprecated alias. Update the test that asserts `25_000` on that export. |
| 4 | Canary fraction default **0.5** | Env `NLM_SYNC_CANARY_FRACTION`. Warn when sync duration ≥ fraction × sync bound. |
| 5 | Rollup site | **End of `runSyncVaultExportDrive`**, after `Promise.allSettled`, before return. Stamp close-report there. |
| 6 | `failure_class` names | Total → `notebooklm`; partial → `notebooklm_partial`; zero targets → `notebooklm_no_targets`. |
| 7 | Never overwrite Phase A classes | Only stamp when `failure_class` is null/empty. Never clear `tests` / `export` / `section8` / etc. |
| 8 | Invalid-copy | Touch skill references → `git diff --name-only` then `cmp` every changed twin under `~/.hermes/skills/cns/session-close/`. If somehow none touched → assert negative. |
| 9 | No live `/session-close` to prove the 120s bound | Measured **41.2s** is the adequacy proof. First real close after ship is live confirmation only. |
| 10 | Architectural facts (do not re-investigate) | `nlm source sync` has no async/no-wait; outer budget is Hermes `terminal: timeout: 300` (not `browser.command_timeout: 30`); notebooks concurrent via `Promise.allSettled` → wall ≈ max, not sum; 3×120s fits 300s. |

### Rollup table (complete — includes zero)

| Outcome | `failure_class` (if currently null) | Return |
|---------|--------------------------------------|--------|
| **N == 0** targets | `notebooklm_no_targets` | `{ ok: false, … }` + loud reason naming why zero targets resolved |
| N≥1, **all** failed | `notebooklm` | `{ ok: false, synced: 0 }` |
| N≥1, **some** failed | `notebooklm_partial` | `{ ok: false, synced: <ok-count> }` |
| N≥1, all ok | leave null | `{ ok: true, synced: N }` |

**Hard rule (addition A):** N==0 must never read as success. Vacuous "all targets ok" is the OPS-1/2/4 incident shape.

**Hard rule (addition B):** Invalid env override must never disable the bound. `Number("")` / `Number("typo")` / `0` / negative → NaN or 0 → Node `execFile` **no timeout** = unbounded hang, worse than the 25s bug.

---

## Acceptance Criteria

### AC1 — Split list vs sync timeouts; remove `NLM_EXEC_TIMEOUT_MS`

**Given** `scripts/session-close/sync-vault-export-drive.mjs`  
**When** the default `nlm` runner invokes `source list` vs `source sync`  
**Then** list uses `NLM_LIST_TIMEOUT_MS` (default **25_000**) and sync uses `NLM_SYNC_TIMEOUT_MS` (default **120_000**)  
**And** both are resolved via a shared positive-int env helper (AC3)  
**And** exported `NLM_EXEC_TIMEOUT_MS` is **gone** (no alias)  
**And** `tests/vault-export-drive-sync.test.mjs` asserts the two new defaults (not the removed symbol)

### AC2 — Sync under/over bound classification (injected exec — no live nlm)

**Given** injected `runNlm` / clock (no live `nlm` calls in tests)  
**When** sync completes under the sync bound  
**Then** status is ok  
**When** sync exceeds the sync bound (timeout error)  
**Then** `error_class: nlm_sync_timeout`  
**And** list timeouts still classify `nlm_list_timeout` under the **list** bound (25s default), independent of the 120s sync bound

### AC3 — Env override validation (never disable the bound)

**Given** helper e.g. `resolvePositiveIntMsEnv(name, defaultMs, env)` used for both timeout envs and for parsing canary fraction as a finite number in `(0, 1]` (or document if fraction uses a sibling helper)  
**When** override is unset → use default  
**When** override is a finite positive integer (timeouts) / finite number in valid range (fraction) → use override  
**When** override is non-numeric, empty, `0`, or negative (or out-of-range fraction)  
**Then** fall back to the default **and** log a loud WARNING naming the **variable** and the **bad value**  
**And** never pass `NaN`, `0`, or negative into `execFile` `timeout`  
**And** unit tests cover: unset, valid, non-numeric, zero, negative (for each timeout env at minimum)

### AC4 — Canary warning before outage

**Given** `NLM_SYNC_CANARY_FRACTION` default **0.5** (validated like AC3 — invalid → default + warn)  
**When** a successful or timed-out sync's measured duration ≥ `fraction * NLM_SYNC_TIMEOUT_MS`  
**Then** log a WARNING that includes **duration**, **bound**, and **source size** (bytes from vault-export file on disk)  
**When** duration is strictly below the threshold  
**Then** no canary WARNING  
**And** tests use injected clock so canary fires at threshold and not below it

### AC5 — Rollup honesty at end of `runSyncVaultExportDrive`

**Given** notebook workers have settled (or early exit for N==0)  
**When** rollup runs (after `allSettled` / at the empty-targets gate — before return)  
**Then** apply the rollup table above  
**And** `{ ok: true, synced: 0 }` is impossible for N≥1 with failures and impossible for N==0  
**And** existing non-null `failure_class` is preserved  
**And** tests assert:
  - 3/3 failed → `failure_class` is **`notebooklm`** (not `none` / null)
  - 1/3 failed → `notebooklm_partial`
  - 0 targets → `notebooklm_no_targets` + `ok: false` (never silent success)

### AC6 — Dual-copy skill docs + verify exit code

**Given** prose/tables that say "25 s" / `NLM_EXEC_TIMEOUT_MS` for sync  
**Then** update at least:
  - `scripts/hermes-skill-examples/session-close/references/drive-export-sync.md`
  - `scripts/hermes-skill-examples/session-close/references/fanout-diagnostics.md`
**And** document list vs sync bounds, canary, and rollup `failure_class` values  
**And** install / sync twin under `~/.hermes/skills/cns/session-close/` per existing install script if that is the repo convention  
**And** run `git diff --name-only`; for every changed file under `scripts/hermes-skill-examples/session-close/`, `cmp` against the `~/.hermes` twin and paste output in completion notes  
**And** `bash scripts/verify.sh` must pass by **EXIT CODE** (do not claim pass from piped/truncated output alone — OPS-4 review trap)

### AC7 — Deferred-work + sprint-status hygiene

**Then** mark the Epic 58 residual entry in `deferred-work.md` as being-fixed / fixed-by **OPS-5** (do not erase the measured 41.2s evidence)  
**And** sprint-status lists this story `ready-for-dev` → implementer moves to `review`/`done` per normal flow

### AC8 — Out of scope stays out

**Then** do **not** change concurrency model or export scope  
**And** do **not** "fix" the `981466f0` missing Drive source in code — leave operator UI note only  
**And** do **not** run `/session-close` as the verification method for this story

---

## Tasks / Subtasks

- [x] AC1 — Split constants; remove `NLM_EXEC_TIMEOUT_MS`; default runner picks timeout by argv (`list` vs `sync`)
  - [x] Export `NLM_LIST_TIMEOUT_MS` / `NLM_SYNC_TIMEOUT_MS` (and canary default constant)
  - [x] Update import/assert in `tests/vault-export-drive-sync.test.mjs`
- [x] AC3 — `resolvePositiveIntMsEnv` (or equivalent) + fraction validator; wire all three env knobs
  - [x] Tests: unset / valid / non-numeric / zero / negative
- [x] AC2 — Timeout classification tests with injected exec (list bound vs sync bound)
- [x] AC4 — Measure sync duration; canary WARNING with duration, bound, source size
  - [x] Tests: at threshold fires; below does not
- [x] AC5 — Rollup stamp + fix `{ ok: true, synced: 0 }` and empty-targets early return
  - [x] Tests: 3/3 → `notebooklm`; 1/3 → `notebooklm_partial`; 0 → `notebooklm_no_targets`
- [x] AC6 — Update `drive-export-sync.md` + `fanout-diagnostics.md`; twin cmp; `verify.sh` exit 0
- [x] AC7 — Annotate `deferred-work.md` Epic 58 residual; leave sprint-status for workflow

---

## Dev Notes

### Files to UPDATE (primary)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `scripts/session-close/sync-vault-export-drive.mjs` | Single `NLM_EXEC_TIMEOUT_MS=25_000` for list+sync; empty targets → `ok: true`; end return `ok: true` with `synced` count even if 0 | Split timeouts; env validation; canary; rollup stamp; honest `ok` |
| `tests/vault-export-drive-sync.test.mjs` | Asserts `NLM_EXEC_TIMEOUT_MS === 25_000`; timeout class tests exist | New constants; env validation; canary; rollup cases; remove old export |
| `scripts/hermes-skill-examples/session-close/references/drive-export-sync.md` | "each nlm call bounded by **25 s** (`NLM_EXEC_TIMEOUT_MS`)" | List 25s / sync 120s; canary; failure_class rollup |
| `scripts/hermes-skill-examples/session-close/references/fanout-diagnostics.md` | list/sync timeout rows say 25 s | Sync row → 120 s (or "NLM_SYNC_TIMEOUT_MS"); list stays 25 s |

### Preserve (do not break)

- Incremental per-notebook merge + async mutex (58-4)
- `Promise.allSettled` concurrency
- `nlm_list_timeout` / `nlm_sync_timeout` error_class distinction via `isTimeoutError`
- Stamp-before-log-append ordering
- `drive_sync_phase.{started_at,finished_at}`
- Match cascade (doc id → google_docs → word_doc title) — do not "fix" missing source by inventing fallbacks
- Test log isolation (`driveSyncLogPath`); never write fake failures into real `~/.hermes/logs/session-close-drive-sync.log`
- Drive/sync remains non-blocking for Phase A completion — stamping `failure_class` makes Discord/report honest; do not invent a new Phase A abort unless already required elsewhere

### Suggested helper shape (guidance, not mandatory API)

```js
/** @returns {number} finite positive integer ms */
export function resolvePositiveIntMsEnv(name, defaultMs, env = process.env) {
  const raw = env[name];
  if (raw === undefined || raw === "") return defaultMs;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    process.stderr.write(
      `session-close: WARNING invalid ${name}=${JSON.stringify(raw)}; using default ${defaultMs}\n`,
    );
    return defaultMs;
  }
  return n;
}
```

Default runner must apply **resolved** list vs sync timeout per call — never a shared stale constant captured once without re-read if tests mutate env (prefer resolve at call time or inject resolved values).

### Canary threshold math

- Default: `0.5 * 120_000 = 60_000` ms  
- Measured live sync **41.2s** is **below** 60s → canary should **not** fire on today's export size (good — room to grow before warning)  
- As export grows toward ~60s wall, WARNING appears before the 120s hard fail

### Discord / MEMORY rendering

`renderDiscordReply` already prints `failure_class` as string or `none` when null. No change required unless tests prove `notebooklm_partial` / `notebooklm_no_targets` need template docs — optional one-line note in `discord-reply-template.md` if you touch skill refs anyway.

### Verification (read carefully)

1. **Unit tests + measured 41.2s** prove the 120s bound is adequate. **Do not** run `/session-close` to validate this story.  
2. After ship: the **first real** `/session-close` is live confirmation — operator should check drive-sync results (targets ok / `failure_class`) rather than assume green.  
3. `bash scripts/verify.sh` — claim pass only from **exit code 0**.

### Project structure notes

- Session-close scripts live under `scripts/session-close/`; Hermes skill examples under `scripts/hermes-skill-examples/session-close/` with live twin `~/.hermes/skills/cns/session-close/`.  
- No WriteGate / `AI-Context` / `security.md` / `vault_log_action` touches expected. If implementation drifts there → stop and escalate.  
- Spec citation: constitution fail-loud ethos in `specs/cns-vault-contract/AGENTS.md` (operator honesty); no Vault IO schema change.

### Previous story intelligence

| Story | Carry forward |
|-------|----------------|
| **58-4** | Concurrent sync, 25s single bound, incremental merge, mutex, phase markers, test-log isolation. This story **splits** that bound and fixes rollup the 58-4 stamping made visible but not loud. |
| **58-3** | PDF media write ≪ 60s; problem moved from write→sync as export grew 1.5→1.6 MB. Same budget-vs-duration class. |
| **OPS-1 / OPS-4** | Vacuous success is never success; dual-copy `cmp` only when skill tree touched; verify by exit code. |
| **OPS-4** | Design gate + binding decisions table pattern; do-not-run `/session-close` for paid/risky validation. |

### Git intelligence (recent)

- `ac987ca` / `b57ff2d` — OPS-4 constitution guard (fail-loud before propagate)  
- Prior 58-4 commits established drive-sync test patterns in `tests/vault-export-drive-sync.test.mjs`

### Anti-patterns (do not)

- Keep `NLM_EXEC_TIMEOUT_MS` as alias "for compatibility"
- Raise only the shared 25s constant without splitting list vs sync
- Fire-and-forget sync + poll (not available — confirmed no async flag on `nlm source sync`)
- Classify `981466f0` missing-source as `nlm_sync_timeout`
- Stamp `failure_class: none` or leave null when N==0 or all failed
- `timeout: Number(process.env.NLM_SYNC_TIMEOUT_MS)` without validation
- Pipe `verify.sh` and infer pass from truncated output
- Run `/session-close` as the story's test plan

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — Epic 58 residual]  
- [Source: `scripts/session-close/sync-vault-export-drive.mjs` — L18, L237, L407–409, L443–479]  
- [Source: `scripts/hermes-skill-examples/session-close/references/drive-export-sync.md`]  
- [Source: `_bmad-output/implementation-artifacts/58-4-drive-sync-phase-hardening-and-diagnostics-integrity.md`]  
- [Source: `_bmad-output/implementation-artifacts/OPS-1-digest-push-fail-loud.md` — vacuous success / dual-copy lessons]  
- [Source: `_bmad-output/implementation-artifacts/OPS-4-session-close-constitution-propagation-guard.md` — design-gate + verify exit-code discipline]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Measured adequacy proof (locked): live sync 41.2s < NLM_SYNC_TIMEOUT_MS 120s; canary threshold 60s so today's export does not warn.
- `bash scripts/verify.sh` → exit code 0 (VERIFY PASSED). No `/session-close` run.

### Completion Notes List

- AC5 (priority 1): `runSyncVaultExportDrive` rollup stamps `notebooklm` / `notebooklm_partial` / `notebooklm_no_targets` when `failure_class` is null/empty; returns ok:false for total/partial/zero-target failure. Vacuous ok:true with synced:0 eliminated for N>=1 failures and N==0.
- AC1: Removed `NLM_EXEC_TIMEOUT_MS`; exported `NLM_LIST_TIMEOUT_MS=25000`, `NLM_SYNC_TIMEOUT_MS=120000`, `NLM_SYNC_CANARY_FRACTION=0.5`. Default runner picks timeout via `resolveNlmCallTimeoutMs(args)`.
- AC3 / addition B: `resolvePositiveIntMsEnv` + `resolveCanaryFractionEnv` — invalid env falls back + WARNING; never NaN/0/negative into execFile timeout.
- AC2: Existing list/sync timeout class tests retained; bounds independent via helpers.
- AC4: Canary WARNING with duration/bound/source_size_bytes; injected clock tests at/below threshold.
- AC6 dual-copy: Updated `drive-export-sync.md` + `fanout-diagnostics.md`; install script; cmp both twins exit 0.
- AC7: Epic 58 residual annotated fixed-by OPS-5 (41.2s evidence preserved); piece (b) left open.
- Rollup uses `expectedCount: notebookIds.length` so rejected-after-stamp workers are not misclassified as `notebooklm_no_targets`.

#### Dual-copy cmp paste

```
git diff --name-only -- scripts/hermes-skill-examples/session-close/
scripts/hermes-skill-examples/session-close/references/drive-export-sync.md
scripts/hermes-skill-examples/session-close/references/fanout-diagnostics.md

cmp drive-export-sync.md twin → exit: 0
cmp fanout-diagnostics.md twin → exit: 0
```

### File List

- scripts/session-close/sync-vault-export-drive.mjs
- tests/vault-export-drive-sync.test.mjs
- scripts/hermes-skill-examples/session-close/references/drive-export-sync.md
- scripts/hermes-skill-examples/session-close/references/fanout-diagnostics.md
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/OPS-5-drive-sync-timeout-canary-and-rollup-honesty.md

### Change Log

- 2026-07-21: Implemented OPS-5 — split list/sync timeouts, env validation, sync canary, rollup honesty; dual-copy skill docs; verify.sh exit 0.

---

## Story completion status

- Status: **review**
- Design gate: **APPROVED_2026-07-21** (constants 25k/120k/0.5; failure_class names; rollup site; remove `NLM_EXEC_TIMEOUT_MS`; additions A zero-targets + B env validation)
- Completion note: Implementation complete; ready for code-review. verify.sh exit 0.
