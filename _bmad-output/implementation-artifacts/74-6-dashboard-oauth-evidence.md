# Story 74-6 — Dashboard OAuth + systemd + Reachability Evidence

**Story:** `74-6-hermes-dashboard-oauth-registration-systemd-and-reachability`  
**Operator:** Chris  
**Date completed:** 2026-06-24  
**Hermes version:** v0.17.0 (2026.6.19)  
**auth_path:** oauth

> **Redaction policy (NFR4):** No tokens, passwords, or full `HERMES_DASHBOARD_OAUTH_CLIENT_ID` values recorded below.

**74-7 handoff — dashboard URLs:**
- Windows (Hermes Desktop): `http://localhost:9119`
- WSL: `http://127.0.0.1:9119`

---

## Baseline (pre-dashboard, agent pre-check 2026-06-24)

| Property | Value |
|----------|-------|
| Portal logged in | **Yes** — Nous inference provider |
| Main model | `nous` / `anthropic/claude-sonnet-4.6` |
| `HERMES_DASHBOARD_OAUTH_CLIENT_ID` | **Absent** (pre-register) |
| Port 9119 | **Not listening** (pre-systemd) |
| `hermes-dashboard.service` | **Absent** (pre-systemd) |
| Gateway | **Running** — systemd PID 837348 |
| `web/dist` | **Missing** at story start — operator pre-built before enable |
| WSL linger | **Yes** (`Linger=yes`) |
| venv python (verified) | `/home/christ/.hermes/hermes-agent/venv/bin/python` ✓ exists |
| `.env` mode | `0600` |

### Evidence

```text
hermes --version:
Hermes Agent v0.17.0 (2026.6.19)

hermes portal info:
  Auth: ✓ logged in
  Model: ✓ using Nous as inference provider

grep -A4 '^model:' ~/.hermes/config.yaml:
  provider: nous
  default: anthropic/claude-sonnet-4.6

74-5 evidence: Discord FR4 PASS 2026-06-24 (portal-regression-ok)
```

---

## AC #1 Prerequisites — PASS (agent pre-check 2026-06-24)

| Check | Result |
|-------|--------|
| Portal logged in, Nous provider | **Yes** |
| Main model nous / Sonnet 4.6 | **Yes** |
| 74-5 evidence exists, Discord FR4 PASS | **Yes** |
| Gateway running baseline | **Yes** — PID 837348 |

---

## AC #2 OAuth register — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Dashboard name | `quiet_ibex` |
| `HERMES_DASHBOARD_OAUTH_CLIENT_ID` in `~/.hermes/.env` | **Yes** (value redacted) |
| `.env` mode `0600` | **Yes** |
| Register stdout (client name, no secrets) | **Yes** — `quiet_ibex` |
| Optional `config.yaml` mirror | Not required (env sufficient) |

### Evidence

```text
hermes dashboard register:
  Dashboard name: quiet_ibex
  HERMES_DASHBOARD_OAUTH_CLIENT_ID written to ~/.hermes/.env (value redacted)

ls -la ~/.hermes/.env → mode 0600
```

---

## AC #3 systemd — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Unit created with correct ExecStart | **Yes** |
| `enable --now` succeeds | **Yes** |
| Service active | **Yes** — `hermes-dashboard.service` active |
| Listener on `0.0.0.0:9119` | **Yes** — PID 3479017 |
| Restart policy | `Restart=on-failure`, `RestartSec=10` |

### Evidence

```text
systemctl --user is-active hermes-dashboard.service → active

ss -tlnp | grep 9119:
  LISTEN 0.0.0.0:9119 (PID 3479017)

ExecStart:
  venv python -m hermes_cli.main dashboard --no-open --host 0.0.0.0 --port 9119 --skip-build
```

---

## AC #4 Auth gate (WSL) — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| `auth_required: true` | **Yes** |
| OAuth / Nous in `auth_providers` | **Yes** — `["nous"]` |

### Evidence

```text
curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'
  auth_required: true
  auth_providers: ["nous"]
```

---

## AC #5 Windows reachability — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| HTTP 200 with JSON | **Yes** |
| `auth_required: true` in response | **Yes** |
| Actual URL used | `http://localhost:9119/api/status` (mirrored networking) |
| `auth_providers` | `["nous"]` |

### Evidence

```text
curl.exe -s http://localhost:9119/api/status (Windows host):
  auth_required: true
  auth_providers: ["nous"]
```

**74-7 Desktop settings:** use `http://localhost:9119` from Windows; WSL curl uses `http://127.0.0.1:9119`.

---

## AC #6 Gateway independence — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Gateway still running (separate PID) | **Yes** — PID 837348 |
| Dashboard separate process | **Yes** — PID 3479017 |
| Discord spot check | Skipped — 74-5 evidence unchanged |

### Evidence

```text
pgrep -af 'hermes_cli.main gateway':
  837348 ... python -m hermes_cli.main gateway run --replace

pgrep -af 'hermes_cli.main dashboard':
  3479017 ... python -m hermes_cli.main dashboard --no-open --host 0.0.0.0 --port 9119 --skip-build

Separate processes ✅
```

---

## AC #7 auth_path — oauth

| Field | Value |
|-------|-------|
| **auth_path** | **oauth** |
| Fallback reason | N/A — primary path succeeded |

---

## AC #8 verify.sh — PASS (2026-06-24)

```text
bash scripts/verify.sh → VERIFY PASSED
```

| Check | Result |
|-------|--------|
| verify.sh green at story close | **Yes** |
| No secret files in git diff | **Yes** — evidence + sprint-status + story only |
| Protect-list zero diffs | **Yes** |

---

## Completion checklist

- [x] AC #1 Prerequisites verified (portal, 74-5 reference, gateway baseline)
- [x] AC #2 OAuth register — `HERMES_DASHBOARD_OAUTH_CLIENT_ID` in `.env`
- [x] AC #3 systemd unit enabled; port 9119 listening on 0.0.0.0
- [x] AC #4 WSL auth gate curl — `auth_required: true`, OAuth in providers
- [x] AC #5 Windows reachability — actual URL documented
- [x] AC #6 Gateway independence — distinct PIDs
- [x] AC #7 `auth_path: oauth` recorded
- [x] AC #8 Final verify + protect-list scan at story close
