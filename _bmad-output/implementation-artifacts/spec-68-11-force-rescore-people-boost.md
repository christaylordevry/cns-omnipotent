---
title: '68-11 force-rescore bypasses already-pushed for people boost'
type: 'bugfix'
created: '2026-06-11'
status: 'ready-for-dev'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/68-10-digest-convex-completion-gate.md'
  - '{project-root}/_bmad-output/implementation-artifacts/68-3-personal-relevance-v3-people-bonus.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After 68-3 shipped, the 13:09 live digest's `agent:end` completion hook returned `skipped-already-pushed` because the 02:28 backfill run (`md77t1mge1nppgtxnf7cg9nss188fad9`) was scored without people bonuses. C6 fails on `--latest` even though rescoring the artifact locally produces ylecun `personalRelevance: 20`.

**Approach:** Add `--force-rescore` to `run-digest-convex-completion.mjs` that bypasses the watchdog already-pushed gate, re-reads today's artifact (or adapter backfill), re-dedupes/re-scores with `loadScoringContext` (nexus-people.yaml), writes artifact, and pushes a new Convex run with fresh `ranAt`.

## Boundaries & Constraints

**Always:** `resolveOperatorHome()` for paths; exit 0 fire-and-forget posture; `bash scripts/verify.sh` green; run `install-hermes-skill-morning-digest.sh` after script changes.

**Ask First:** Changing watchdog already-pushed semantics globally (only bypass via explicit `--force-rescore`).

**Never:** Cowboy edits outside this spec; modifying Convex schema; editing operator `nexus-people.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | `--force-rescore`, artifact exists, nexus-people loaded | New Convex run with ≥1 signal `personalRelevance ≥ 20` + `authorHandle`; log `completion-force-rescore-push` | N/A |
| ALREADY_PUSHED | Normal completion, non-failed run today | Unchanged: `skipped-already-pushed`, no re-push | N/A |
| NO_ARTIFACT | `--force-rescore`, no artifact | Fall through to adapter collect + score + push (existing backfill path) | log `completion-no-signals` if empty |
| SCORE_FAIL | Scoring throws | log `completion-pipeline-failed`, exit 0 | existing catch |

</frozen-after-approval>

## Code Map

- `scripts/run-digest-convex-completion.mjs` — add `forceRescore` opt + CLI flag; artifact rescore path
- `tests/run-digest-convex-completion.test.mjs` — force-rescore bypasses watchdog skip
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — already loads nexus-people via `loadScoringContext` (no change)

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/run-digest-convex-completion.mjs` — add `--force-rescore` flag and `rescoreFromArtifact` path — bypass already-pushed when operator needs post-ship rescore
- [ ] `tests/run-digest-convex-completion.test.mjs` — test force-rescore skips watchdog early return and rescores artifact

**Acceptance Criteria:**
- Given today's artifact with ylecun handle and pre-68-3 scores, when `node scripts/run-digest-convex-completion.mjs --force-rescore`, then a new Convex run is pushed with ylecun `personalRelevance ≥ 20`
- Given `node scripts/validate-epic-68-digest.mjs --latest --json --people-done`, then C6 status is `pass` and overall is `pass`
- Given normal completion without flag, when run exists for today, then behavior unchanged (`skipped-already-pushed`)

## Verification

**Commands:**
- `npm test -- tests/run-digest-convex-completion.test.mjs` — expected: pass
- `bash scripts/verify.sh` — expected: pass
- `node scripts/run-digest-convex-completion.mjs --force-rescore` — expected: new run pushed
- `node scripts/validate-epic-68-digest.mjs --latest --json --people-done` — expected: overall pass, C6 pass
