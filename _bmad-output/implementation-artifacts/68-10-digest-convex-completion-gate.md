---
story_id: 68-10
epic: 68
title: digest-convex-completion-gate
status: done
baseline_date: 2026-06-11
predecessors: 67-10, 68-9
repo: Omnipotent.md (+ Hermes gateway hook)
priority: P0
operator_brief: 2026-06-11
---

# Story 68.10: Digest Convex Completion Gate (agent:end hook + deterministic backfill)

Status: done

## Story

As a **CNS operator running Epic 68 live validation**,
I want **a gateway `agent:end` hook and deterministic completion script that backfills Convex when the Hermes agent skips artifact write and §9 push under context compression**,
so that **`validate-epic-68-digest.mjs --latest` passes even when the LLM posts Discord and stops early**.

## Investigation (2026-06-11 12:13 AEST)

| Check | Result |
|-------|--------|
| `~/.hermes/digest-push-2026-06-11.json` | **MISSING** |
| Convex `digest:getRecentDigestRuns` | **No 2026-06-11 row** — latest published is 2026-06-10 |
| `push-digest-watchdog.log` | **Missing until manual run** — 07:15 cron ran before 12:13 manual digest |
| Agent log §9 / artifact | **No** `write-digest-push-artifact` or `push-digest-convex` invocations |
| Context compression | **12:03:48** session split `20260611_120222_47dd3149` → `20260611_120348_2c9e5c` |
| Compressed session | ~10 source terminals → Discord post at 12:13:51 — **skipped dedupe/score/artifact/push** |
| task-prompt artifact gate | Present and correct (67-10) |
| Hermes skill mirror | In sync with repo |
| Watchdog cron | Installed `15 7 * * *` — insufficient for manual afternoon runs |

**Root cause:** Scenario **A + C** — context compression dropped completion gates; 67-10 artifact/watchdog cannot recover without artifact or afternoon watchdog.

## Acceptance Criteria

### 1. Deterministic completion script (AC: backfill)

**Given** today's Convex digest run is missing or `failed` only
**When** `run-digest-convex-completion.mjs` runs
**Then** it first attempts `runPushDigestWatchdog` (artifact replay)
**And** if artifact is missing, runs adapter wrappers, builds `digest_push_payload`, dedupes, scores, writes artifact, pushes §9 + §10
**And** always exits 0 (fire-and-forget posture)

### 2. Gateway agent:end hook (AC: hook)

**Given** inbound message matches morning-digest trigger
**When** agent finishes (`agent:end`)
**Then** hook spawns `run-digest-convex-completion.mjs` in a background thread (non-blocking)
**And** install script copies hook to `~/.hermes/hooks/morning-digest-convex-completion/`

### 3. Afternoon watchdog crons (AC: cron)

**Given** `install-morning-digest-cron.sh` runs
**Then** crontab includes additional watchdog lines at **13:00** and **18:30** Australia/Sydney (manual-run safety net)

### 4. Verify gate

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass
**And** `bash scripts/install-hermes-skill-morning-digest.sh` syncs skill mirror

## Tasks

- [x] T1 `build-digest-push-payload.mjs` + tests
- [x] T2 `run-digest-convex-completion.mjs` + tests
- [x] T3 Gateway hook + `install-morning-digest-convex-completion-hook.sh`
- [x] T4 Extend `install-morning-digest-cron.sh` afternoon watchdog crons
- [x] T5 `verify.sh` green + Hermes skill install

## Completion Notes (2026-06-11)

- Manual backfill: `node scripts/run-digest-convex-completion.mjs` → `completion-backfill-push`, artifact written, Convex run `md77t1mge1nppgtxnf7cg9nss188fad9` published.
- `validate-epic-68-digest.mjs --latest --json` → **overall: pass** (63 signals, C2/C3/C4/C8 pass).
- Gateway restarted; hook loaded at `~/.hermes/hooks/morning-digest-convex-completion/`.
- Afternoon watchdog crons: 13:00 + 18:30 AEST.
