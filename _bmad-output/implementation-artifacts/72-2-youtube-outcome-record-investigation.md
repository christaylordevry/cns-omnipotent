---
story_id: 72-2
epic: 72
title: youtube-outcome-record-investigation
status: done
baseline_commit: 0bfb3c6c52000090d2f9282354d8503278653337
operator_brief: docs/72-2-youtube-outcome-record-investigation.md
predecessors: 72-1, 71-3
---

# Story 72.2: YouTube missing from digest outcome record — investigation + observability gaps

Status: done

## Story

As a **CNS operator reviewing the first live cron after shipping YouTube (72-1)**,
I want **the root cause of `youtube` absent from `~/.hermes/digest-outcomes/YYYY-MM-DD.json` diagnosed and observability gaps closed**,
so that **the next digest run reports YouTube in the outcome record, Convex source health, and push metadata — and we do not misclassify a deployment-timing miss as a permanent adapter failure**.

## Root cause (confirmed)

**Hypothesis A — adapter did not run on the 2026-06-19 07:00 cron** (not Hypothesis B alone).

| Evidence | Finding |
|----------|---------|
| **Step 1 — Convex** | `digest:getDigestSignalsForRun` with `digestRunId: md714jkzrbe7fkfr2d41w5a7v588wcmf` → **72 signals, 0 `youtube` sourceType** |
| **Cron collect log** | `~/.hermes/logs/morning-digest-skill-cron.log` lines 12–13: `collect: … bluesky=ok` — **no `youtube=` token** |
| **Deploy timing** | Cron log mtime **07:00:56 AEST**; commit `0bfb3c6` (72-1 orchestrator wiring) landed **21:53:10 AEST** same day |

The morning cron executed **~15 hours before** 72-1 was on disk. The orchestrator that ran literally had no YouTube collect task — not a silent adapter failure and not outcome-writer blindness alone.

**Secondary Fix Path B (real, would have bitten the next run):**

1. `scripts/lib/digest-run-outcome.mjs` — `ADAPTER_COUNT_KEYS` omitted `videos` → successful YouTube adapter would report `sources.youtube: { status: 'empty', count: 0 }`.
2. `parse-digest-source-outcomes.mjs` — `DIGEST_SOURCE_SECTION_MAP` had no `youtube` row.
3. `cns-dashboard/convex/lib/digest_source_registry.ts` — source health panel registry stopped at Bluesky (12 rows).

Same bug class as 72-1 `ADAPTER_DATA_KEYS` patch — fixed-list drift on new Source 13.

## Acceptance Criteria

1. [x] Root cause stated explicitly — **Hypothesis A (pre-deploy cron)** + secondary B gaps documented above.
2. [x] Fix implemented per Fix Path B (orchestrator already wired in 72-1; no Fix Path A needed).
3. [x] `bash scripts/verify.sh` passes.
4. [ ] **Operator:** next 07:00 AEST cron (or manual `DIGEST_TRIGGER=manual` full pipeline) shows `sources.youtube` with `status: ok`, `count > 0`, and Convex youtube signals for that run.
5. [x] Integration coverage gap noted — see Deferred work (orchestrator↔wrapper parity test).
6. [x] `deferred-work.md` closure entry added.

## Tasks / Subtasks

- [x] **Step 1** — Convex prod query (`digestRunId` not `runId`): zero youtube signals → Hypothesis A
- [x] **Step 2** — Orchestrator grep: `youtube` present in `run-digest-convex-completion.mjs` (same pattern as Bluesky); cron log proves pre-72-1 code ran
- [x] **Step 3** — Manual `hermes-run-youtube.sh`: returns valid `videos[]` JSON (adapter OK)
- [x] **Step 4** — Env: `trend-ingest.env` sources `YOUTUBE` vars in interactive shell; not implicated for 07:00 miss
- [x] Add `videos` to `ADAPTER_COUNT_KEYS` in `digest-run-outcome.mjs`
- [x] Add `youtube` to `DIGEST_SOURCE_SECTION_MAP` + Hermes skill sync
- [x] Add `youtube` to `DIGEST_SOURCE_HEALTH_REGISTRY` (13 rows) + dashboard tests
- [x] Unit test: `buildSourcesFromAdapterOutputs` counts `videos[]`
- [x] `bash scripts/verify.sh` green
- [ ] **Operator AC4** — confirm next live run (pending)

### Review Findings

- [ ] [Review][Decision] **Consolidate source-key registries vs. checklist-only for Source 14+** — **Resolved: A (structural parity test).** `tests/digest-source-registry-parity.test.mjs` + `scripts/lib/digest-source-registry-parity.mjs` guard SECTION_MAP, HEALTH_REGISTRY, digestSourceTypeValue, digestSectionValue, badge map, collect task keys, and ADAPTER_PAYLOAD_ARRAY_KEYS.

- [x] [Review][Patch] **Unrelated AGENTS.md constitution churn in 72-2 diff** [`specs/cns-vault-contract/AGENTS.md`] — reverted; vault mirror synced.

- [x] [Review][Patch] **DRY adapter payload array keys** [`scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs`] — exported `ADAPTER_PAYLOAD_ARRAY_KEYS`; `digest-run-outcome.mjs` imports shared constant.

- [x] [Review][Patch] **Missing YouTube badge unit test** [`cns-dashboard/tests/lib/nexus-digest-feed.test.ts`] — added `formatDigestSourceBadge('youtube')` → `'YT'`.

- [x] [Review][Defer] **Cross-repo registry single-source-of-truth** — Architectural debt predates 72-2; consolidation to shared contract is a follow-up story, not blocking this fix. — deferred, pre-existing pattern

- [x] [Review][Defer] **Orchestrator↔wrapper parity test** — `COLLECT_ADAPTER_TASK_KEYS` exported; wrapper map derived from it. Full hermes-run-*.sh file-existence parity still deferred in `deferred-work.md`. — deferred

## Dev Agent Record

### Debug Log

- Brief query used wrong arg `runId`; correct API is `digestRunId` (Convex `Id<'digestRuns'>`).
- Post-72-1 local collect: `youtube=ok` with 25 videos; before fix, outcome mapper returned `empty/0`.

### Completion Notes

- Primary incident: deployment timing, not adapter/orchestrator omission in current HEAD.
- Closed observability gaps so the **next** run reports YouTube correctly in outcome JSON, `sourceOutcomes`, and Nexus source health.
- AC4 live re-validation deferred to operator (next cron or manual full pipeline) — today's digest already `skipped-already-pushed`.

## File List

- `scripts/lib/digest-run-outcome.mjs`
- `scripts/lib/digest-source-registry-parity.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `tests/digest-run-outcome.test.mjs`
- `tests/digest-source-registry-parity.test.mjs`
- `../cns-dashboard/convex/lib/digest_source_registry.ts`
- `../cns-dashboard/convex/validators.ts`
- `../cns-dashboard/tests/convex/digest-source-health.test.ts`
- `../cns-dashboard/tests/convex/digest.test.ts`
- `../cns-dashboard/tests/lib/nexus-source-health.test.ts`
- `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts`
- `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-06-19: Code review — parity test, DRY adapter payload keys, AGENTS.md revert, YouTube badge test; verify green.
- 2026-06-19: Investigation complete — root cause pre-deploy cron; Fix Path B observability patches; verify green.

## Status

review
