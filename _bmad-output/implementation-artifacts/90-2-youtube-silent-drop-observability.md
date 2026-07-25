---
story_id: 90-2
epic: 90
title: youtube-silent-drop-observability
status: done
created: 2026-07-23
revised: 2026-07-23
operator_brief: 2026-07-23
baseline_commit: e9049d3
predecessors: 72-1, 72-2, 70-1, 71-3, 90-1
sequencing: 90-2 (obs) → 90-4 (dedupe retune) → 90-3 (youtube quality); independent of 90-1
related_deferred: deferred-work.md — 72-2 AC4; adapter-result bare-object hole
design_gate: APPROVED_2026-07-23 — Q1=B triple counts; Q2=always-on stderr; Q3=retitle Intake health; Q4=dedupe fix is 90-4 not 90-2
do_not_touch: score-digest-signals.mjs; dedupe-digest-signals.mjs (retune is 90-4); hardcoded API keys; adapter exit-0 / stdout; WriteGate / vault_log_action / security.md
prod_evidence: digestRunId md70q02w20sz4gzqwqhtp66mm18ayh8s; artifact digest-push-2026-07-22.json — confirmed CROSS-SOURCE DEDUPE over-collapse
root_cause: CONFIRMED — twitter winner clusterSize=33 absorbed all 25 youtube (contrib tally youtube:25); SOURCE_PRIORITY.youtube=4
---

# Story 90.2: YouTube silent drop — observability only (dedupe cause confirmed)

Status: done

<!-- Design gate APPROVED 2026-07-23. Dedupe *retune* is out of scope — see 90-4. -->

Epic: **90 — Intake health**  
Tracked as: **`90-2-youtube-silent-drop-observability`**  
**Repos:** Omnipotent.md only (`hermes-consolidation`)  
**Does not touch:** `score-digest-signals.mjs`, `dedupe-digest-signals.mjs` (behavior), WriteGate, `vault_log_action`, `security.md`

## Story

As a **CNS operator trusting morning-digest / Nexus source health**,
I want **bare `{error}` adapters to show as failures, `sourceOutcomes` to expose fetch vs primary-stored vs contributed counts, and always-on stage stderr that surfaces the known youtube dedupe cliff**,
so that **a 25-fetched / 0-primary youtube run can never again look “ok / fired 25”, and 90-4 has honest telemetry to validate the retune**.

---

## Root cause — CONFIRMED (not a hunt)

Verified against the real pushed payload **`digest-push-2026-07-22.json`** (`digestRunId md70q02w20sz4gzqwqhtp66mm18ayh8s`):

| Fact | Value |
|------|-------|
| Drop site | **Cross-source dedupe** (`dedupe-digest-signals.mjs`) |
| Winner | twitter — title ≈ “I got some really useful Claude prompting…” |
| `clusterSize` | **33** |
| Contributor tally | `{ rss: 2, twitter: 3, bluesky: 3, youtube: 25 }` |
| Mechanism | All **25** youtube signals absorbed into **one** cluster; losers deleted as primaries; `SOURCE_PRIORITY.youtube = 4` (lowest among social winners) |
| Classification | **Topic-collapse**, not event-corroboration — a 33-item single-entity cluster |

**Ruled out permanently for this incident:**

- Transient adapter `{error}` hidden by Defect A
- Scorer null-engagement drop (`TREND_PROXY_PRIOR.youtube=40` Path B; 1:1 map)
- Unwrap / `buildDigestPushPayload` youtube map bug (adapter returned healthy `{videos:[25]}`; build emitted youtube)

**Do not** reintroduce “transient error + Defect A” as the prod explanation in Completion Notes.

Dedupe **behavior** fix → **Story 90-4** (propose-then-stop; blocks 90-3). This story only makes the cliff **visible**.

---

## Scope — what 90-2 SHIPS

### 1. Bare `{error}` observability (Defect A)

`scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs`:

| Helper | Fix |
|--------|-----|
| `summarizeAdapterCollection` | Else branch: if `isAdapterErrorPayload(result)` → `key=fail:…`, else `key=ok` |
| `buildErrorsBySource` | Also record bare `isAdapterErrorPayload` rows (map collect key → source key) |

Also: `buildSourcesFromAdapterOutputs` (`digest-run-outcome.mjs`) — bare `{error}` → `status: 'error'`, not `empty`.

`collectAdapterOutputs` already wraps before summarize; still fix helpers + tests that pass **unwrapped** bare `{error}` (no pre-wrap).

### 2. sourceOutcomes honesty — **triple counts (Q1=B)**

Each relevant source outcome (at minimum youtube; prefer all collect sources) must expose:

| Field | Meaning |
|-------|---------|
| `fetchCount` | Adapter array length pre-dedupe (`videos[]` / `posts[]` / …) |
| `storedPrimaryCount` | Post-dedupe (+ post-score) signals with `sourceType === source` |
| `contributedCount` | Post-dedupe rows where this source appears in `sourceMetadata.contributingSources` (and is not the primary) |

**Binding:** a run with youtube `fetchCount=25`, `storedPrimaryCount=0`, `contributedCount=25` must be **operator-visible** as such — never a single `signalCount`/`ok` that reads “fired 25”.

Implementation notes:

- Prefer extending `run.sourceOutcomes[]` objects with these three fields (keep legacy `signalCount` = `storedPrimaryCount` for backward compat if needed; document).
- Day-outcome `sources.*.count` remains fetch-oriented **or** is labeled — do not silently redefine without Completion Notes.
- Markdown merge must not invent a lone high count that hides `storedPrimaryCount=0`.
- Avoid Convex schema churn if push payload already accepts extra outcome fields; if contract guard rejects unknown keys, extend the **Omnipotent** digest-signal / outcome contract allowlist — not dashboard UI.

### 3. Always-on stage stderr (Q2)

One `console.error` line on full-pipeline (same spirit as `collect: …`), always-on — **not** env-gated.

Example shape:

```text
yt-stage collect=25 build=25 dedupe_primary=0 dedupe_contrib=25 score_primary=0
```

Stages: collect → build → dedupe (primary + contrib) → score → (optional store).  
Purpose: **confirm** the known cliff every run — not investigate an unknown drop.

---

## Explicitly OUT of scope (90-2)

| Item | Where it lives |
|------|----------------|
| Change `shouldClusterSignals` / cluster breadth / entity-match | **90-4** |
| Change `SOURCE_PRIORITY` or `pickClusterWinner` | **90-4** |
| Keep loser rows as primaries with corroboration credit | **90-4** |
| YouTube quality selection | **90-3** (blocked on 90-4) |
| Any edit to `score-digest-signals.mjs` | Never in this epic thread |

---

## Pipeline (reference)

```text
collect → build → dedupe ← CONFIRMED CLIFF (youtube primaries → 0) → score (untouched) → store
```

---

## Acceptance Criteria

### 1. Bare `{error}` (AC: obs-error)

**Given** bare `{ error: "quota-exceeded" }` (no `success`, no data-array keys)  
**When** passed to `summarizeAdapterCollection` and `buildErrorsBySource`  
**Then** summary has `youtube=fail:…` (**not** `youtube=ok`)  
**And** `errors_by_source.youtube` is set  
**And** uses existing `isAdapterErrorPayload`

### 2. Triple counts (AC: outcomes)

**Given** adapter fetch N and post-dedupe primary 0 with contrib > 0 (prod-shaped)  
**When** `run.sourceOutcomes` is written  
**Then** youtube (and peers as implemented) expose `fetchCount`, `storedPrimaryCount`, `contributedCount`  
**And** `storedPrimaryCount=0` with `fetchCount=25` is visible without a misleading single “fired 25”  
**And** bare `{error}` → `buildSourcesFromAdapterOutputs` `status: 'error'`

### 3. Always-on stage line (AC: stage-log)

**Given** full-pipeline completion with youtube present  
**When** collect→build→dedupe→score runs  
**Then** stderr emits one always-on `yt-stage` (or equivalent) line with collect/build/dedupe_primary/dedupe_contrib/score_primary  
**And** for a fixture mirroring prod over-collapse, the line shows the primary→0 cliff

### 4. Regression tests (AC: tests)

**Given** fixtures (no live API)  
**Then** (a) bare `{error}` → fail in summarize **and** errors_by_source  
**And** (b) youtube-only healthy `{videos:[N]}` still yields N′ primaries through build→dedupe→score (sanity)  
**And** (c) mixed cluster fixture approximating prod (`clusterSize` large, youtube contrib) asserts triple counts / stage line show `fetchCount>0`, `storedPrimaryCount=0`, `contributedCount>0`  
**And** Completion Notes paste **real passing** test output  
**And** Completion Notes state root cause = **confirmed dedupe over-collapse** (cite clusterSize=33 / youtube:25) — not transient adapter error

### 5. Verify + contracts (AC: verify)

**Given** implementation complete  
**When** `bash scripts/verify.sh`  
**Then** exit 0  
**And** `score-digest-signals.mjs` and dedupe **behavior** unchanged  
**And** adapter exit-0 / `{error}` stdout contracts preserved; no hardcoded API keys

---

## Tasks / Subtasks

- [x] **T1 — Defect A** (AC: #1)
  - [x] `summarizeAdapterCollection` + `buildErrorsBySource` via `isAdapterErrorPayload`
  - [x] `buildSourcesFromAdapterOutputs` bare error → `error`
  - [x] Tests: bare `{error}` without pre-wrap

- [x] **T2 — Triple counts** (AC: #2)
  - [x] Extend `resolveSourceOutcomes` / `buildSourceOutcomesFromPayload` (and contract allowlist if needed)
  - [x] Wire `fetchCount` from adapterResults; `storedPrimaryCount` + `contributedCount` from post-dedupe signals
  - [x] Markdown merge must not erase honesty
  - [x] Tests for prod-shaped 25/0/25

- [x] **T3 — Stage stderr** (AC: #3)
  - [x] Always-on one-liner in full-pipeline path
  - [x] Fixture (c) asserts cliff visible in log or counted fields

- [x] **T4 — Verify** (AC: #4, #5)
  - [x] `bash scripts/verify.sh` exit 0
  - [x] Completion Notes: real output + confirmed root cause pointer to 90-4

---

## Dev Notes

### Files to touch

| Path | Role |
|------|------|
| `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` | Defect A |
| `scripts/lib/digest-run-outcome.mjs` | Bare error → `error` |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | Triple counts |
| `scripts/run-digest-convex-completion.mjs` | Stage line; pass adapterResults into outcomes |
| `contracts/digest-signal-contract.json` (or outcome allowlist) | Only if needed for new fields |
| `tests/run-digest-convex-completion.test.mjs` | Bare error + stage/outcomes |
| `tests/parse-digest-source-outcomes.test.mjs` / `tests/digest-run-outcome.test.mjs` | Triple counts |
| Hermes skill sync if mirrored | Per project convention |

### Files NOT to touch

- `dedupe-digest-signals.mjs` — **90-4**
- `score-digest-signals.mjs`
- Vault / WriteGate / security.md

### Operator design answers (binding)

| # | Answer |
|---|--------|
| Q1 | **B** — dual/triple counts (`fetchCount` + `storedPrimaryCount` + `contributedCount`) |
| Q2 | **Always-on** stderr stage line |
| Q3 | **Yes** — epic title “Intake health” |
| Q4 | Dedupe is the real bug; **fix in 90-4** (propose-then-stop), **not** in 90-2 |

### Anti-patterns

| Do not | Why |
|--------|-----|
| Retune dedupe / `SOURCE_PRIORITY` here | 90-4 |
| Blame transient adapter error for 2026-07-22 | Empirically false |
| Edit scorer | Untouched |
| Single `signalCount` that hides 25→0 | Recreates the lie |
| Break exit-0 / hardcode keys | Contracts |

### References

- Prod artifact: `digest-push-2026-07-22.json` — twitter winner, `clusterSize=33`, contrib `youtube:25`
- [Source: scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs]
- [Source: scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs — shouldClusterSignals entity-match; SOURCE_PRIORITY]
- [Source: scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs]
- [Source: _bmad-output/implementation-artifacts/90-4-dedupe-over-collapse-retune.md] (follow-on)
- [Source: _bmad-output/implementation-artifacts/90-1-restore-reddit-intake.md]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Confirmed youtube.com/watch?v=* collapses via canonicalDomainPath=/watch (dedupe behavior; retune deferred to 90-4). Sanity fixture uses distinct youtu.be paths.

### Completion Notes List

- **Root cause (confirmed, not fixed here):** cross-source dedupe over-collapse — twitter winner `clusterSize=33`, contrib tally `youtube:25` on `digest-push-2026-07-22.json` / `digestRunId md70q02w20sz4gzqwqhtp66mm18ayh8s`. Dedupe retune is **90-4**. Scorer untouched.
- **Defect A:** `summarizeAdapterCollection` + `buildErrorsBySource` treat bare `{error}` via `isAdapterErrorPayload` as failure; `buildSourcesFromAdapterOutputs` → `status: 'error'`.
- **Triple counts:** `sourceOutcomes` now expose `fetchCount` / `storedPrimaryCount` / `contributedCount`; legacy `signalCount` = `storedPrimaryCount` only (contrib no longer inflates). Markdown merge preserves triple honesty.
- **Stage line:** always-on `yt-stage collect=N build=N dedupe_primary=N dedupe_contrib=N score_primary=N` from `scoreWriteAndPush` when `'youtube' in adapterResults` (`shouldEmitYoutubeStageLine`) — including collect=0; not gated on any-stage > 0 (review Option 1).
- **Contract:** Omnipotent allowlist + cns-dashboard `digestSourceOutcomeValidator` optional fields; regenerated `contracts/digest-signal-contract.json`.
- **Hermes sync:** `bash scripts/install-hermes-skill-morning-digest.sh`.
- **verify.sh:** exit 0 (`==> VERIFY PASSED`).

**Regression test output (real):**
```
✔ classifies bare {error} adapter stdout as sources.error not empty (Story 90-2)
✔ exposes triple counts for prod-shaped youtube over-collapse (Story 90-2)
✔ markdown merge does not hide storedPrimaryCount=0 behind a lone high signalCount (Story 90-2)
✔ formatYoutubeStageLine surfaces the primary→0 cliff (Story 90-2)
✔ youtube-only healthy videos survive build→dedupe→score as primaries (Story 90-2 sanity)
✔ mixed cluster fixture shows fetch>0 / primary=0 / contrib>0 after real dedupe (Story 90-2)
✔ summarizeAdapterCollection classifies bare {error} as fail (Story 90-2 Defect A)
✔ buildErrorsBySource records bare {error} without pre-wrap (Story 90-2 Defect A)
ℹ tests 8
ℹ pass 8
ℹ fail 0
```

**verify.sh (tail):**
```
==> Hermes skill install gate
==> VERIFY PASSED
```

### File List

- scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs
- scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs
- scripts/lib/digest-run-outcome.mjs
- scripts/run-digest-convex-completion.mjs
- contracts/digest-signal-contract.json
- tests/parse-digest-source-outcomes.test.mjs
- tests/digest-run-outcome.test.mjs
- tests/run-digest-convex-completion.test.mjs
- _bmad-output/implementation-artifacts/90-2-youtube-silent-drop-observability.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- ../cns-dashboard/convex/validators.ts (optional triple-count fields on digestSourceOutcomeValidator)
- ../cns-dashboard/tests/convex/digest.test.ts (accepts 25/0/25 outcome)

### Review Findings

- [x] [Review][Decision] `yt-stage` stderr gate vs Q2/AC3 “always-on” — Resolved **Option 1** (2026-07-23): emit when `'youtube' in adapterResults` via `shouldEmitYoutubeStageLine`, including all-zeros / collect=0. Not gated on any-stage > 0. Patched `run-digest-convex-completion.mjs` + helper/tests.
- [x] [Review][Defer] `digestSourceOutcomeValidator` accepts any number (incl. negative/fractional) for new optional count fields [`convex/validators.ts`] — deferred, pre-existing `v.optional(v.number())` pattern already used for `signalCount`
- [x] [Review][Defer] `countAdapterPayloadItems` returns first recognized array length only [`adapter-result.mjs`] — deferred, pre-existing helper behavior relocated from `digest-run-outcome.mjs`
- [x] [Review][Defer] Bare non-error unknown object / scalar adapter stdout still maps to `empty` [`digest-run-outcome.mjs`] — deferred, pre-existing exit-0 stdout contract edge outside Defect A bare-`{error}` scope

## Change Log

- 2026-07-23: Story 90-2 — bare `{error}` failure classification; sourceOutcomes triple counts; always-on yt-stage stderr; contract + dashboard validator allowlist; verify PASS.
- 2026-07-23: Code review (gpt-5.6-terra layers) — 1 decision-needed, 0 patch, 3 defer; verify.sh PASS.
- 2026-07-23: Review close — Option 1 applied (`shouldEmitYoutubeStageLine`: youtube key present); verify re-run.
