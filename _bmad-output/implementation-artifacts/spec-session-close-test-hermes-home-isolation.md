---
title: 'Session-close test regression — HERMES_HOME isolation'
type: 'bugfix'
created: '2026-06-04'
status: 'done'
route: 'one-shot'
---

# Session-close test regression — HERMES_HOME isolation

## Intent

**Problem:** `/session-close` reported `failure_class: tests` because `npm test` failed inside the Hermes gateway subprocess (`HOME=/home/christ/.hermes/home`, `HERMES_HOME=/home/christ/.hermes`) while passing locally. The real cause was test isolation: `defaultSessionCloseEnvPath()` resolves the session-close env file from `HERMES_HOME` first, so several node tests that isolated only `HOME` read the operator's real `~/.hermes/session-close.env` (3 real NotebookLM IDs) instead of their fixtures. (The handoff brief's hypotheses — unrestored `process.env` mutation and the vitest `surface-adapters` test — were both incorrect.)

**Approach:** Each HOME-isolation block in the three affected node test files now also saves, deletes, and restores `process.env.HERMES_HOME`, forcing env resolution back to the isolated `HOME`. A latent, unrelated race in `surface-adapters.test.ts` (reading a fire-and-forget audit write) was also hardened with a bounded poll helper. Production code was not changed — `HERMES_HOME` precedence is correct for the real Hermes gateway.

## Suggested Review Order

1. `../../scripts/session-close/lib/load-session-close-env.mjs` (lines 9–32) — the root cause: `HERMES_HOME` outranks `HOME` in `defaultSessionCloseEnvPath`. Read this first to understand why isolating only `HOME` leaked.
2. `../../tests/notebook-routing-report.test.mjs` (`withIsolatedEnv`) — smallest, clearest instance of the fix pattern.
3. `../../tests/smart-routing.test.mjs` — same fix in the shared helper plus the standalone `"env IDs win"` block (caught by review).
4. `../../tests/session-close-pipeline.test.mjs` — three inline isolation blocks; verify save/delete/restore symmetry.
5. `../../tests/model-routing/surface-adapters.test.ts` (`waitForAuditEntry`) — orthogonal race-hardening for the fire-and-forget audit write.
6. `../../_bmad-output/implementation-artifacts/deferred-work.md` (tail) — deferred DRY refactor into a shared isolation helper.
