---
story_id: 67-9
epic: 67
title: fix-hermes-gateway-stale-pid-lock
status: ready-for-dev
priority: P1
baseline_date: 2026-06-11
operator_brief: 2026-06-11
predecessors: 36-1, 67-8
repo: Omnipotent.md only
story_type: ops-hotfix
---

# Story 67.9: Fix Hermes Gateway Stale PID Lock

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator on WSL who suspends the machine overnight**,
I want **`hermes-gateway-start.sh` to clear stale `gateway.pid` / lock files and restart a dead gateway**,
so that **`@reboot` and the */3 watchdog cron recover automatically** instead of leaving Hermes down until manual intervention.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 67 — ops hotfix chain after 2026-06-11 live validation |
| **Priority** | **P1** — morning digest and Discord surface stay down after WSL resume until manual fix |
| **Repo** | **Omnipotent.md only** — `scripts/hermes-gateway-start.sh` + tests |
| **Predecessors** | **36-1** (launcher + `@reboot` cron); **67-8** (status grep fix for cron — implement 67-8 first or in parallel; this story also updates launcher grep) |
| **Root cause (confirmed)** | WSL suspend kills the gateway process but leaves **`~/.hermes/gateway.pid`** (JSON: `{"pid": N, "kind": "hermes-gateway", ...}`) and **`~/.hermes/gateway.lock`**. On resume, `hermes gateway run` / start path treats the lock as "already running" and refuses. Watchdog cron (`*/3 * * * * pgrep -f 'hermes gateway' || bash .../hermes-gateway-start.sh`) invokes the launcher but recovery fails silently — **`~/.hermes/logs/watchdog.log` may never be created** if the script exits before meaningful output or never reaches `nohup`. |
| **Current launcher gap** | `scripts/hermes-gateway-start.sh` greps **`gateway is running`** (same bug as 67-8) and only validates PID from **status stdout** via `sed 's/.*PID: \([0-9]*\).*/\1/p'` — systemd status uses **Main PID:** not `PID:` in all formats; it does **not** read or validate **`~/.hermes/gateway.pid`** directly. |
| **Out of scope** | Hermes upstream CLI changes; systemd unit edits; flock/TOCTOU hardening (36-1 defer); migrating off `nohup` to `hermes gateway start` unless dev proves necessary for recovery |

### Watchdog + reboot crontab (operator machine — do not edit in story unless install script exists)

```cron
@reboot .../scripts/hermes-gateway-start.sh >>"$HOME/.hermes/logs/gateway-reboot-cron.log" 2>&1
*/3 * * * * pgrep -f 'hermes gateway' > /dev/null || bash .../scripts/hermes-gateway-start.sh >> ~/.hermes/logs/watchdog.log 2>&1
```

Recovery must work when **only** the launcher is invoked (watchdog path).

### Stale lock anatomy

| File | Format | Stale when |
|------|--------|------------|
| `~/.hermes/gateway.pid` | JSON with `"pid": <int>` | `kill -0 <pid>` fails |
| `~/.hermes/gateway.lock` | lock file alongside pid | pid file stale or process dead |

Example live pid file:
```json
{"pid": 111887, "kind": "hermes-gateway", "argv": [...], "start_time": 2045424}
```

## Acceptance Criteria

### 1. Stale PID detection and cleanup (AC: stale-pid)

**Given** `~/.hermes/gateway.pid` exists with pid **N** and `kill -0 N` fails (process dead after WSL suspend)
**When** `bash scripts/hermes-gateway-start.sh` runs
**Then** it removes or invalidates stale **`gateway.pid`** and **`gateway.lock`** before attempting start
**And** it proceeds to start the gateway (see AC 3)
**And** Dev Agent Record logs cleanup action (no secrets)

**Given** `gateway.pid` exists and `kill -0 N` succeeds
**When** the launcher runs
**Then** it exits **0** idempotently with "already running" (no duplicate start)

**Given** `gateway.pid` is missing or unreadable
**When** the launcher runs
**Then** it does not fail solely on missing pid file — falls through to normal start logic

### 2. Status grep aligned with current CLI (AC: status-grep)

**Given** `hermes gateway status` prints `✓ User gateway service is running`
**When** the launcher evaluates running state
**Then** it uses the **same pattern as 67-8** (`gateway service is running|gateway is running` or equivalent)
**And** if status claims running but extracted PID is dead, it cleans stale locks and restarts (existing intent at L33 — preserve and strengthen with pid-file check)

### 3. Gateway actually starts after WSL resume (AC: recovery)

**Given** gateway process is dead and stale lock files exist (simulated: stop gateway without Hermes cleanup, or manual stale pid fixture in test)
**When** launcher completes
**Then** `hermes gateway status` eventually reports running **or** `pgrep -f 'hermes gateway'` succeeds
**And** watchdog log path `$HOME/.hermes/logs/watchdog.log` receives append output on recovery run (script must echo to stdout/stderr so cron redirect captures it)

**Preferred start command:** use existing `nohup hermes gateway run` **or** `hermes gateway start` if systemd user service is enabled — match what works on operator WSL without breaking 36-1 `@reboot` flow. Dev Agent Record must state which path was validated.

### 4. Contract tests (AC: verify)

**Given** no dedicated gateway test file exists today (36-1 optional)
**When** story closes
**Then** add focused tests (e.g. `tests/hermes-gateway-start.test.mjs`) asserting script contains:
- stale pid cleanup logic (`gateway.pid`, `kill -0` or equivalent)
- updated status grep pattern (aligned with 67-8)
- idempotent early-exit when live pid exists
**And** `npm test` + `bash scripts/verify.sh` pass

### 5. No double-start regression (AC: idempotent)

**Given** gateway is healthy and running
**When** launcher runs twice in succession
**Then** second run exits 0 without spawning duplicate gateway processes (best-effort — full flock out of scope per 36-1 defer)

## Tasks / Subtasks

- [ ] Read current `scripts/hermes-gateway-start.sh` and reproduce stale-pid failure mode (AC: 1)
- [ ] Implement `gateway.pid` JSON parse + `kill -0` validation + lock cleanup (AC: 1)
- [ ] Align status grep with 67-8 pattern (AC: 2)
- [ ] Validate recovery: stop gateway, plant stale pid, run launcher, confirm running (AC: 3)
- [ ] Add `tests/hermes-gateway-start.test.mjs` (or extend existing suite) (AC: 4)
- [ ] `npm test` + `bash scripts/verify.sh` (AC: 4)
- [ ] Note watchdog.log creation in Dev Agent Record (AC: 3)

## Dev Notes

### Current launcher (partial — needs pid-file path)

```26:37:scripts/hermes-gateway-start.sh
gateway_status_out="$(hermes gateway status 2>/dev/null || true)"
if echo "$gateway_status_out" | grep -qi "gateway is running"; then
  gateway_pid="$(echo "$gateway_status_out" | sed -n 's/.*PID: \([0-9]*\).*/\1/p' | head -1)"
  if [[ -n "${gateway_pid:-}" ]] && kill -0 "$gateway_pid" 2>/dev/null; then
    echo "hermes-gateway-start: gateway already running (PID $gateway_pid)"
    exit 0
  fi
  echo "hermes-gateway-start: status reported running but PID ${gateway_pid:-unknown} not alive; starting"
fi

nohup hermes gateway run >>"$GATEWAY_LOG" 2>&1 &
```

### Suggested implementation sketch

```bash
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
PID_FILE="$HERMES_HOME/gateway.pid"
LOCK_FILE="$HERMES_HOME/gateway.lock"

clear_stale_gateway_lock() {
  local pid=""
  if [[ -f "$PID_FILE" ]]; then
    pid="$(python3 -c "import json; print(json.load(open('$PID_FILE')).get('pid',''))" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0  # live — caller should exit idempotent
    fi
    rm -f "$PID_FILE" "$LOCK_FILE"
    echo "hermes-gateway-start: cleared stale gateway lock (pid=${pid:-unknown})"
  fi
}
```

Call `clear_stale_gateway_lock` **before** status check; if live pid from file, exit 0 early.

Also try extracting PID from status via `Main PID:` and `PID:` patterns for systemd output.

### Files to touch

| File | Action |
|------|--------|
| `scripts/hermes-gateway-start.sh` | **UPDATE** — stale lock recovery + grep fix |
| `tests/hermes-gateway-start.test.mjs` | **NEW** — script contract tests |

### Manual test script (Dev Agent Record)

```bash
# Simulate stale lock (CAUTION: only on dev — gateway will restart)
hermes gateway stop
# If pid file remains with dead pid:
bash scripts/hermes-gateway-start.sh
hermes gateway status | grep -i running
ls -la ~/.hermes/logs/watchdog.log  # after watchdog cron or manual redirect
```

### Previous story intelligence

- **36-1** implemented idempotent launcher but deferred fragile grep and watchdog/flock.
- **36-1 review:** "status reported running but PID not alive; starting" — logic exists but never triggers when grep fails (67-8 class) and doesn't read `gateway.pid`.
- **67-8** should land first so cron and launcher share grep pattern.

### References

- [Source: `scripts/hermes-gateway-start.sh`]
- [Source: `_bmad-output/implementation-artifacts/36-1-sprint-hygiene-hermes-gateway-auto-start.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 36-1 deferred grep + watchdog]
- [Source: `~/.hermes/hermes-agent/website/docs/developer-guide/gateway-internals.md` — gateway/status.py lock management]
- [Source: operator crontab — `@reboot` + `*/3` watchdog lines]

## Dev Agent Record

### Agent Model Used

(pending implementation)

### Debug Log References

### Completion Notes List

### File List
