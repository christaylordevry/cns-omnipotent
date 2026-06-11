---
story_id: 68-8
epic: 68
title: live-digest-validation
status: in-progress
story_type: operator-validation + lightweight-tooling
baseline_date: 2026-06-11
baseline_commit: 9fd8b00532cc1127221ff0643ab42d254df154b7
operator_brief: 2026-06-11
predecessors: 68-1, 68-4, 68-5, 68-6, 68-7
optional_predecessors: 68-2, 68-3
blocks: epic-68-retrospective
repo: Omnipotent.md (+ operator + cns-dashboard read-only verification)
fr_ids: FR-15, FR-16
---

# Story 68.8: Live Digest Validation — Epic 68 Gate

Status: in-progress

> **Lightweight gate story.** Primary deliverables: (1) operator validation artifact with Run Record, (2) `scripts/validate-epic-68-digest.mjs` helper that queries Convex and scores addendum A6 checklist. **Not** a full adapter implementation — file hotfix stories for blocking defects; do not scope-creep Epic 68 features into this gate.
>
> **Epic 68 closure:** Epic 68 is **not** `done` until this story is `done` with **PASS** (or documented PASS-with-waivers per waiver table below).

<!-- Ultimate context engine analysis completed — comprehensive operator validation guide created. -->

## Story

As a **CNS operator**,
I want **one documented live morning-digest run plus a checklist script that proves Epic 68 sources (dedup, Bluesky, optional X) fire end-to-end without regressing Epic 67 adapters**,
so that **Epic 68 production readiness is operator-trusted, addendum A6 is machine-checkable, and the epic can close with evidence instead of fixture-only confidence**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup — **68-8 is the production-readiness gate** |
| **Story type** | Operator validation artifact + **lightweight validation script** (distinct from 67-1 zero-code gate) |
| **Repo** | Omnipotent.md (`validate-epic-68-digest.mjs` + tests); operator actions across Hermes + Convex; artifact in `_bmad-output/` |
| **Predecessors (required)** | **68-1** (dedup); **68-4** (schema literals — must be **deployed** to Convex before live push); **68-5** (Bluesky); **68-6** (X adapter); **68-7** (X check + env docs) |
| **Predecessors (optional)** | **68-2** (people loader), **68-3** (personalRelevance v3) — still **backlog**; people-boost A6 row is **waivable** |
| **Blocks** | Epic 68 retrospective / epic `done` declaration |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.5 (FR-15, FR-16), addendum **A6**; ADR-E67-007 pattern (artifact-first gate) |
| **FR IDs** | FR-15 (validation artifact), FR-16 (Epic 67 regression — ProductHunt, GitHub, RSS) |
| **Out of scope** | New adapters; Convex schema changes; Discord formatting for `contributingSources` chips (PRD non-goal); people loader/scoring (68-2/68-3); Nexus inspector UI; `bash scripts/verify.sh` gate changes beyond adding unit tests for the new script |

### Problem (current state)

Epic 68 shipped cross-source dedup (68-1), Bluesky Source 12 (68-5), X Source 11 (68-6/68-7), and schema literals (68-4) with fixture tests — but **no operator has recorded a production digest run** proving:

- `sourceMetadata.contributingSources` clusters land in Convex (`length ≥ 2`)
- `sourceType: 'bluesky'` rows with engagement metadata (`likes`, `reposts`)
- Optional `sourceType: 'twitter'` when X GO (68-7 `--check` exit 0)
- Epic 67 sources still present: `producthunt`, `github`, `rss`
- Pre/post dedup counts show meaningful merge (success metric ≥20% reduction when ≥3 sources active — document even if not met)

67-1 established the artifact pattern; 68-8 extends it for Epic 68-specific checklist rows and adds a **repeatable Convex query script** so future runs do not require manual tallying.

### Operator brief (binding)

1. **Run one full morning-digest** — Hermes `morning-digest` end-to-end with Discord post **and** `push-digest-convex.mjs` completion (task-prompt §9).
2. **Record X GO/NO-GO before run** — `bash scripts/session-close/hermes-run-x-check.sh`; document exit code in artifact (68-7 handoff).
3. **Verify in Convex** — `digestRunId` + per-`sourceType` counts; run `node scripts/validate-epic-68-digest.mjs --digest-run-id <id>` (or `--latest`).
4. **Artifact is the deliverable** — fill **Run Record** in this file; script output JSON excerpt attached or pasted (redact secrets).
5. **FAIL is valid** — root cause + hotfix story ID; do not mark `done` until PASS or operator accepts documented FAIL with remediation plan.

---

## Acceptance Criteria

### 1. Validation script (FR-15 helper)

**Given** `~/.hermes/trend-ingest.env` contains `CONVEX_URL` and `CONVEX_DEPLOY_KEY`
**When** `node scripts/validate-epic-68-digest.mjs --digest-run-id <id>` runs (or `--latest` scans `getRecentDigestRuns`)
**Then** the script queries `digest:getDigestSignalsForRun` via Convex HTTP `/api/query` (same pattern as `push-digest-watchdog.mjs` — **reuse** `normalizeConvexUrl`, `resolveConvexPushEnv` imports; do not duplicate HTTP client)
**And** stdout prints a human-readable checklist table with PASS/FAIL/WAIVED per A6 row
**And** `--json` emits structured report: `{ digestRunId, xStatus: 'go'|'no-go', checks: [...], manualChecksPending: [...], overall: 'pass'|'fail' }` (`manualChecksPending` lists operator-only rows such as C7; does not block `overall`)
**And** exit **0** when mandatory checks pass (twitter row WAIVED when `--x-no-go` or auto-detect from `hermes-run-x-check.sh` exit 1)
**And** exit **1** when any mandatory check fails
**And** `tests/validate-epic-68-digest.test.mjs` covers pure checklist functions with **fixture signal arrays** (no live Convex in CI)

**CLI surface (minimum):**

```text
node scripts/validate-epic-68-digest.mjs [--digest-run-id <id> | --latest] [--json] [--x-go | --x-no-go]
```

Optional thin wrapper: `bash scripts/session-close/hermes-validate-epic-68.sh` → same script with HOME remap (mirror `hermes-run-x-check.sh`).

### 2. Live digest run with scored signal floor (A6 + FR-15)

**Given** Hermes gateway running and trend-ingest.env configured
**When** operator triggers one complete `morning-digest` run
**Then** Convex contains a new `digestRun` with non-failed status
**And** `getDigestSignalsForRun` returns **≥30** signals with `rankScore` defined
**And** fewer than **10%** lack `rankScore` unless documented upstream degradation

### 3. Bluesky coverage (A6 mandatory)

**Given** the live run from AC-2
**When** signals are tallied by `sourceType`
**Then** **≥1** signal has `sourceType: 'bluesky'`
**And** `sourceMetadata.likes` or `sourceMetadata.reposts` is present on that row

### 4. Cross-source dedup clusters (A6 mandatory)

**Given** the same live run
**When** signals are scanned for `sourceMetadata.contributingSources`
**Then** **≥1** signal has `contributingSources.length ≥ 2`
**And** `dedupClusterSize ≥ 2` on that row
**And** no two pushed signals share the same normalized URL (duplicate cluster leak check — any post-dedup URL collision is a FAIL; script imports `normalizeDigestUrl` from `dedupe-digest-signals.mjs`)
**And** artifact records **pre-dedup vs post-dedup** signal counts from `~/.hermes/digest-push-<date>.json` if available (compare `signals.length` before/after dedup is not stored — use stderr `dedupe-digest-signals:` log line or re-run dedupe on artifact snapshot if needed)

### 5. X/Twitter conditional coverage (A6 row 2 — waived path)

**Given** `hermes-run-x-check.sh` completed before digest
**When** check exits **0** (X GO)
**Then** **≥1** `sourceType: 'twitter'` signal with `sourceMetadata.likes` or `reposts`
**When** check exits **1** (X NO-GO)
**Then** artifact documents NO-GO; validation script marks twitter row **WAIVED**; Epic 68 may still **PASS** (PRD UJ-4, §4.4 FR-14)

### 6. People boost (A6 row 5 — conditional)

**Given** **68-2** and **68-3** are `done` and `~/.hermes/nexus-people.yaml` exists
**When** reviewing scored signals
**Then** **≥1** signal shows people-match evidence (`scores.personalRelevance` elevated with `sourceMetadata.authorHandle` matching watchlist, or title token overlap documented)
**When** **68-2/68-3** remain backlog (current sprint state)
**Then** validation script marks people-boost row **WAIVED**; not a FAIL

### 7. Discord / merge attribution (A6 row 7)

**Given** a merged cluster exists in Convex (AC-4)
**When** operator reviews Discord digest for the same story
**Then** the winning headline appears **once** (not duplicated as separate HN + NewsAPI bullets for the same URL cluster)
**And** artifact notes whether Discord surfaces `contributingSources` text (likely **no** — PRD defers inspector chips); Convex row is sufficient evidence

### 8. Epic 67 regression (FR-16)

**Given** the live run from AC-2
**When** per-`sourceType` counts are tallied
**Then** **≥1** `producthunt`, **≥1** `github`, **≥1** `rss` (same bars as 67-1 C3/C4 extended to ProductHunt)
**And** failures triaged as **hotfix** stories, not Epic 68 scope creep

### 9. Validation artifact (FR-15)

**Given** live run + script execution complete
**When** operator fills **Run Record** below
**Then** artifact includes: run timestamp (Australia/Sydney), `digestRunId`, X GO/NO-GO, per-`sourceType` table, dedup cluster sample JSON, people-boost note, pre/post dedup notes, script `--json` excerpt, overall PASS/FAIL/WAIVED summary against A6
**And** story status → `done` only on **PASS** (mandatory rows green or explicitly WAIVED per table)

---

## Waiver table (normative for PASS-with-waivers)

| A6 row | Mandatory? | Waiver condition |
|--------|------------|------------------|
| ≥30 scored signals | **Yes** | — |
| ≥1 twitter + engagement | Conditional | WAIVED when X NO-GO documented |
| ≥1 bluesky + engagement | **Yes** | — |
| ≥1 dedup cluster | **Yes** | — |
| people-boost | Conditional | WAIVED when 68-2/68-3 backlog |
| no duplicate URL cluster in push | **Yes** | — |
| Discord merged attribution | **Yes** | PASS = single headline in Discord + Convex cluster; full `contributingSources` Discord text not required |

---

## Run Procedure (operator)

### Pre-flight

| Step | Command / check | Pass |
|------|-----------------|------|
| P1 | `hermes gateway status` — gateway running | ☐ |
| P2 | `bash scripts/install-hermes-skill-morning-digest.sh` | ☐ |
| P3 | `~/.hermes/trend-ingest.env` has `CONVEX_URL`, `CONVEX_DEPLOY_KEY` | ☐ |
| P4 | **68-4 deployed** — cns-dashboard accepts `twitter`/`bluesky` push (if unsure: push one fixture row or check `validators.ts` on deployed deployment) | ☐ |
| P5 | `bash scripts/session-close/hermes-run-x-check.sh` → record exit code (GO=0 / NO-GO=1) | ☐ |
| P6 | Optional isolation: `bash scripts/session-close/hermes-run-bluesky.sh`, `hermes-run-x.sh` — JSON stdout sanity | ☐ |
| P7 | `bash scripts/session-close/hermes-run-github.sh`, `hermes-run-rss.sh`, `hermes-run-producthunt.sh` — Epic 67 regression pre-check | ☐ |

### Trigger digest

**Preferred:** Post `morning-digest` in Discord `#hermes`.

**Alternate:** `bash scripts/run-morning-digest-cron.sh` from repo root.

**Wait for:** Discord digest + Hermes logs show `push-digest-convex.mjs` exit 0.

### Post-run validation

```bash
# From Omnipotent.md repo root — after convex push completes
node scripts/validate-epic-68-digest.mjs --latest --json | tee /tmp/68-8-validation.json

# Or explicit run id from:
cd ../cns-dashboard && npx convex run digest:getRecentDigestRuns '{"limit": 3}'
```

Fill **Run Record** below from script output + manual Discord notes.

---

## Validation Checklist (addendum A6 + FR-16)

| # | Check | Pass criteria | Pass? | Evidence |
|---|-------|---------------|-------|----------|
| C1 | Signal count | ≥30 with `rankScore` | ☐ | |
| C2 | Bluesky | ≥1 `bluesky` + likes/reposts metadata | ☐ | |
| C3 | Twitter | ≥1 `twitter` + engagement **or** X NO-GO waiver | ☐ | |
| C4 | Dedup cluster | ≥1 `contributingSources.length ≥ 2` | ☐ | |
| C5 | No cluster leak | No duplicate normalized URL in push (any collision post-dedup) | ☐ | |
| C6 | People boost | people-match **or** 68-2/68-3 waiver | ☐ | |
| C7 | Discord merge | Single headline for merged story | ☐ | |
| C8 | ProductHunt | ≥1 `producthunt` (FR-16) | ☐ | |
| C9 | GitHub | ≥1 `github` (FR-16) | ☐ | |
| C10 | RSS | ≥1 `rss` (FR-16) | ☐ | |
| C11 | Dedup effectiveness | Document pre/post counts; note if <20% reduction | ☐ | |

**Overall:** ☐ PASS / ☐ PASS-with-waivers / ☐ FAIL

**X status:** ☐ GO / ☐ NO-GO (waives C3)

---

## Run Record

> **Operator:** Fill after live run. Replace `TBD`.

| Field | Value |
|-------|-------|
| Run date (Australia/Sydney) | TBD |
| Trigger method | TBD |
| `digestRunId` | TBD |
| `digestRun.date` | TBD |
| `focusKeyword` | TBD |
| X pre-flight (`hermes-run-x-check.sh`) | TBD (exit 0 GO / exit 1 NO-GO) |
| Validation script command | TBD |
| Operator | Chris Taylor |

### Per-source signal counts

| sourceType | count | notes |
|------------|-------|-------|
| google_trends | TBD | |
| newsapi | TBD | |
| perplexity | TBD | |
| arxiv | TBD | |
| hackernews | TBD | |
| notebooklm | TBD | |
| github | TBD | **FR-16 ≥1** |
| reddit | TBD | optional |
| rss | TBD | **FR-16 ≥1** |
| producthunt | TBD | **FR-16 ≥1** |
| **twitter** | TBD | required if X GO |
| **bluesky** | TBD | **required ≥1** |
| _other_ | TBD | |

### Dedup summary

| Metric | Value |
|--------|-------|
| Signals with `contributingSources` | TBD |
| Max `dedupClusterSize` | TBD |
| Sample cluster `sourceType`s | TBD |
| Pre-dedup count (artifact/log) | TBD |
| Post-dedup pushed count | TBD |
| Reduction % | TBD |

### Sample cluster excerpt (redacted)

```json
TBD — one signal with contributingSources.length >= 2
```

### Script JSON excerpt

```json
TBD — paste validate-epic-68-digest.mjs --json output (redact)
```

### Degraded sources (if any)

| Source | Symptom | Discord | Convex impact |
|--------|---------|---------|---------------|
| — | — | — | — |

---

## Tasks / Subtasks

- [x] **T1: Implement validation script** (AC: 1)
  - [x] T1.1 Create `scripts/validate-epic-68-digest.mjs` — extract pure `evaluateEpic68Checks(signals, opts)` for testing
  - [x] T1.2 Wire Convex query via shared helpers from `push-digest-convex.mjs` / `push-digest-watchdog.mjs`
  - [x] T1.3 Implement CLI (`--latest`, `--digest-run-id`, `--json`, `--x-go`, `--x-no-go`)
  - [x] T1.4 Optional `scripts/session-close/hermes-validate-epic-68.sh` wrapper
- [x] **T2: Unit tests** (AC: 1)
  - [x] T2.1 `tests/validate-epic-68-digest.test.mjs` — fixture signals for each A6 row + waiver paths
  - [x] T2.2 Ensure `npm test` picks up new file (existing test glob)
- [ ] **T3: Operator live run** (AC: 2–8)
  - [ ] T3.1 Complete pre-flight P1–P7
  - [ ] T3.2 Trigger morning-digest; confirm Discord + Convex push
  - [ ] T3.3 Run validation script; capture `--json`
- [ ] **T4: Artifact completion** (AC: 9)
  - [ ] T4.1 Fill Run Record + checklist
  - [ ] T4.2 Set overall PASS/FAIL; move story to `done` on PASS
  - [ ] T4.3 If PASS: set `epic-68` ready for retrospective in sprint-status (manual)

### Review Findings

- [x] [Review][Decision] C5 leak check: any duplicate URL vs spec "same URL + identical titles" — **Resolved D1:B** — stricter any-duplicate-URL check kept; AC-4 C5 + checklist C5 updated.
- [x] [Review][Decision] `normalizeDigestUrl` import vs inline port — **Resolved D2:A** — import from `dedupe-digest-signals.mjs` kept; Dev Notes updated.
- [x] [Review][Decision] `overall: 'pass'` while C7 is `manual` — **Resolved D3:B** — `manualChecksPending` added to `--json` report; `overall` remains machine-check only.
- [x] [Review][Patch] Truncation warning when signal page is full [scripts/validate-epic-68-digest.mjs:432]
- [x] [Review][Patch] `--help` should exit 0, not 1 [scripts/validate-epic-68-digest.mjs:355]
- [x] [Review][Patch] `--x-go` + `--x-no-go` conflict guard order-dependent [scripts/validate-epic-68-digest.mjs:368]
- [x] [Review][Patch] `--json` flag not surfaced from `runValidateEpic68Digest` return [scripts/validate-epic-68-digest.mjs:464]
- [x] [Review][Patch] X auto-detect treats spawnSync ENOENT/crash as silent NO-GO [scripts/validate-epic-68-digest.mjs:379]
- [x] [Review][Patch] Checklist table alignment breaks for WAIVED/MANUAL rows [scripts/validate-epic-68-digest.mjs:316]
- [x] [Review][Defer] No `--people-done` CLI flag for C6 when 68-2/68-3 ship [scripts/validate-epic-68-digest.mjs:404] — deferred, pre-existing backlog waiver path
- [x] [Review][Defer] No tests for `detectXStatusFromCheckScript` or `runValidateEpic68Digest` mock path [tests/validate-epic-68-digest.test.mjs] — deferred, story marks integration smoke optional
- [x] [Review][Defer] Empty signals array undifferentiated from partial ingest failure [scripts/validate-epic-68-digest.mjs:162] — deferred, operator diagnostic polish
- [x] [Review][Defer] `tryRecoverFromArtifact` always returns exitCode 0 on failed recovery [scripts/push-digest-watchdog.mjs:239] — deferred, pre-existing watchdog behavior; only `postQuery` export touched in this story
- [x] [Review][Defer] Non-UTM query params bypass C5/dedup normalize [dedupe-digest-signals.mjs:62] — deferred, pre-existing normalizeDigestUrl scope

---

## Dev Notes

### Gate discipline

```
68-1..68-7 done ──▶ 68-8 PASS ──▶ epic-68 retrospective / done
68-2/68-3 backlog ──▶ people-boost WAIVED (not blocking)
X NO-GO ──▶ twitter row WAIVED (not blocking)
```

Do **not** mark 68-8 `done` on fixture tests alone. Gate requires **live Convex rows** from a real Hermes digest (same bar as 67-1).

### Validation script design (keep lightweight)

**Reuse, do not reinvent:**

| Need | Reuse from |
|------|------------|
| Convex HTTP query | `push-digest-watchdog.mjs` → `postQuery` pattern |
| Env resolution | `push-digest-convex.mjs` → `resolveConvexPushEnv` |
| URL normalize for C5 | Import `normalizeDigestUrl` from `dedupe-digest-signals.mjs` (do **not** import from `src/`) |
| X GO probe | `spawnSync` `bash scripts/session-close/hermes-run-x-check.sh` when neither `--x-go` nor `--x-no-go` |

**Pure function signature (suggested):**

```javascript
/**
 * @param {Array<Record<string, unknown>>} signals — getDigestSignalsForRun page
 * @param {{ xStatus: 'go'|'no-go', peopleStoriesDone: boolean }} opts
 * @returns {{ checks: Array<{ id: string, status: 'pass'|'fail'|'waived', detail: string }>, overall: 'pass'|'fail' }}
 */
export function evaluateEpic68Checks(signals, opts) { /* ... */ }
```

**Mandatory tallies:** `countBySourceType`, `findDedupClusters`, `findDuplicateUrlClusters`, `countScored`.

**CI:** Tests call `evaluateEpic68Checks` only — no network. Script integration smoke optional behind env guard.

### What differs from 67-1

| | 67-1 | 68-8 |
|--|------|------|
| Code deliverable | None | `validate-epic-68-digest.mjs` + tests |
| New sources | github, rss | bluesky, twitter (optional), dedup metadata |
| Regression scope | — | producthunt + github + rss (FR-16) |
| X waiver | N/A | 68-7 `--check` GO/NO-GO |
| People boost | pre-67-3 note | waivable until 68-2/68-3 |

### Scoring pipeline (read-only — do not modify)

```text
adapters → §9 map → dedupe-digest-signals.mjs → score-digest-signals.mjs
  → write-digest-push-artifact.mjs → Discord → push-digest-convex.mjs
```

### 68-4 schema prerequisite

Sprint shows **68-4** `ready-for-dev`. Live push of `twitter`/`bluesky` rows **fails** until cns-dashboard validators deploy. **Complete or verify 68-4** before T3 live run.

### Failure diagnostics

**C2 (Bluesky) fails:** `bash scripts/session-close/hermes-run-bluesky.sh` — expect `posts[]`. Check `MORNING_DIGEST_BSKY_ACTORS` in trend-ingest.env.

**C4 (dedup) fails:** Inspect `~/.hermes/digest-push-<date>.json` for `contributingSources` on scored signals. If absent, dedupe terminal stdout threading broke (64-8 pattern) — hotfix story.

**C8–C10 (FR-16) fails:** Run standalone wrappers (`hermes-run-github.sh`, etc.). File Epic 67 regression hotfix — not 68-8 implementation scope.

**C3 (twitter) fails with X GO:** Rotate cookies per Operator Guide §15.11.1; re-run `hermes-run-x-check.sh`.

### Anti-patterns (do not)

- Do not add Discord `contributingSources` formatting in this story (follow-up UX)
- Do not implement 68-2/68-3 people loader as part of gate
- Do not change dedupe/scoring/adapters unless blocking defect
- Do not require live Convex in unit tests
- Do not subprocess Python or last30days runtime (ADR-E67-001)

### verify.sh

New unit tests must pass under `bash scripts/verify.sh`. No new mandatory verify gate step for operator live run (same as 67-1).

### Project Structure Notes

| Path | Role |
|------|------|
| `scripts/validate-epic-68-digest.mjs` | **NEW** — A6 checklist evaluator + Convex query CLI |
| `tests/validate-epic-68-digest.test.mjs` | **NEW** — pure function fixtures |
| `scripts/session-close/hermes-validate-epic-68.sh` | **NEW optional** — HOME remap wrapper |
| `scripts/push-digest-watchdog.mjs` | Query HTTP pattern reference |
| `scripts/session-close/hermes-run-x-check.sh` | X GO/NO-GO pre-flight |
| `~/.hermes/digest-push-YYYY-MM-DD.json` | Post-scoring artifact for dedup count forensics |
| `../cns-dashboard/convex/digest.ts` | `getRecentDigestRuns`, `getDigestSignalsForRun` |

---

## References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.5, §6.2, §7 — FR-15/16, success metrics]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A6 — checklist]
- [Source: `_bmad-output/implementation-artifacts/67-1-live-digest-validation.md` — artifact gate pattern]
- [Source: `_bmad-output/implementation-artifacts/68-7-x-integration-env-docs.md` §68-8 handoff — X GO/NO-GO]
- [Source: `_bmad-output/implementation-artifacts/68-1-cross-source-dedup-engine.md` — contributingSources contract]
- [Source: `_bmad-output/implementation-artifacts/68-5-bluesky-adapter-source-12.md` — bluesky evidence bar]
- [Source: `scripts/push-digest-watchdog.mjs` — Convex query POST pattern]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.11.1 — X cookies]
- [Source: `../cns-dashboard/convex/digest.ts`]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Implementation Plan

- Exported `postQuery` from `push-digest-watchdog.mjs` for shared Convex HTTP query client.
- Implemented pure `evaluateEpic68Checks` with A6 rows C1–C11; C7/C11 marked `manual` (operator/artifact).
- CLI auto-detects X GO/NO-GO via `hermes-run-x-check.sh` when `--x-go`/`--x-no-go` omitted.
- People-boost (C6) defaults WAIVED (`peopleStoriesDone: false`) matching 68-2/68-3 backlog.

### Completion Notes List

- Epic 68 gate tooling: **T1/T2 complete** — validation script + unit tests; code review patches applied (C5 spec, `manualChecksPending`, CLI hardening); `bash scripts/verify.sh` PASS.
- **T3/T4 pending operator:** live morning-digest run + Run Record fill required before story `done`.
- Waivers applied: _TBD (X NO-GO, people-boost)_

### File List

- `_bmad-output/implementation-artifacts/68-8-live-digest-validation.md` (this file — story + artifact)
- `scripts/validate-epic-68-digest.mjs` (NEW)
- `tests/validate-epic-68-digest.test.mjs` (NEW)
- `scripts/session-close/hermes-validate-epic-68.sh` (NEW)
- `scripts/push-digest-watchdog.mjs` (export `postQuery`)

### Change Log

- 2026-06-11: Story 68-8 — Epic 68 A6 validation script, tests, Hermes wrapper; operator live run pending.
- 2026-06-11: Code review — D1:B/D2:A/D3:B resolved; 6 patches applied (truncation warn, help exit 0, x-flag guard, jsonMode return, X detect warn, table pad).
