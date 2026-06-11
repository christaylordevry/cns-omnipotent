---
title: 'Epic 70 Story 1 — Wire Node orchestrator as cron entrypoint'
type: 'feature'
created: '2026-06-12'
status: 'done'
route: 'one-shot'
baseline_commit: 'b1ef54f'
---

# Epic 70 Story 1 — Wire Node orchestrator as cron entrypoint

## Intent

**Problem:** `scripts/run-morning-digest-cron.sh` invoked `hermes cron run "$JOB_ID"`, launching a full LLM agent session that accumulated 10+ source payloads, hit context compression, and fabricated digest output — the root cause of morning digest failures.

**Approach:** Replace the Hermes agent path with a direct call to `node scripts/run-digest-convex-completion.mjs`, which already runs the deterministic pipeline (`collectAdapterOutputs` → dedupe → score → artifact → Convex). Downgrade the gateway check from fatal `exit 1` to a warning; remove JOB_ID validation and `hermes cron run`/`tick`. Keep PATH bootstrap, `.env.live-chain` sourcing, and Discord env exports unchanged for Story 2.

## Suggested Review Order

- Cron now invokes Node orchestrator instead of Hermes agent session
  [`run-morning-digest-cron.sh:38`](../../scripts/run-morning-digest-cron.sh#L38)

- Gateway check warns instead of aborting — Node path has no gateway dependency
  [`run-morning-digest-cron.sh:21`](../../scripts/run-morning-digest-cron.sh#L21)

- `.env.live-chain` and Discord env exports preserved for Story 2 delivery
  [`run-morning-digest-cron.sh:26`](../../scripts/run-morning-digest-cron.sh#L26)
