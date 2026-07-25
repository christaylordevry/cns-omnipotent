# Story 74-7 — Hermes Desktop Live Chat Connection Evidence

**Story:** `74-7-hermes-desktop-live-chat-connection`  
**Operator:** Chris  
**Date completed:** 2026-06-24  
**Hermes WSL version:** v0.17.0 (2026.6.19)  
**Hermes Windows version:** v0.17.0 (hermes-agent — `%LOCALAPPDATA%\hermes`)  
**auth_path:** oauth (from 74-6)  
**Remote URL:** `http://localhost:9119` (Windows browser UI) / `http://127.0.0.1:9119` (WSL)

> **Redaction policy (NFR4):** No tokens, passwords, or full OAuth client IDs recorded below.

**v0.17 UI clarification:** Hermes Desktop in v0.17 is **browser-based** at `http://localhost:9119` — not a separate Electron app. Windows `install.ps1` installs CLI + dashboard server support; the conversational UI is accessed in any browser against the WSL backend.

**74-6 handoff baseline:**
- Dashboard OAuth client name: `quiet_ibex` (value redacted)
- Gateway PID: **837348** (unchanged through 74-7)
- Dashboard PID: **3479017** (unchanged through 74-7)

---

## AC #1 WSL prerequisites — PASS (agent pre-check 2026-06-24)

| Check | Result |
|-------|--------|
| `systemctl --user is-active hermes-dashboard.service` | **active** |
| WSL `auth_required` | **true** |
| WSL `auth_providers` | **`["nous"]`** |
| Windows `curl.exe` HTTP 200 + `auth_required: true` | **Yes** |
| `hermes portal info` logged in | **Yes** — Nous inference provider |
| Main model | `nous` / `anthropic/claude-sonnet-4.6` |
| Gateway running (separate from dashboard) | **Yes** — PID 837348 |
| Dashboard process (separate PID) | **Yes** — PID 3479017 |
| Hermes Desktop pre-install (`%LOCALAPPDATA%\hermes`) | **Absent** (expected) |

### Evidence

```text
systemctl --user is-active hermes-dashboard.service → active

curl -s http://127.0.0.1:9119/api/status | jq '{auth_required, auth_providers}':
  auth_required: true
  auth_providers: ["nous"]

curl.exe -s http://localhost:9119/api/status → HTTP 200; auth_required: true

hermes portal info → Auth: ✓ logged in; Nous inference provider
model: provider nous / anthropic/claude-sonnet-4.6

pgrep gateway → 837348; pgrep dashboard → 3479017
Pre-install %LOCALAPPDATA%\hermes → ABSENT
```

---

## AC #2 Desktop install — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Pre-install absent | **Yes** (agent pre-check) |
| `install.ps1` run in Windows PowerShell | **Yes** |
| Install location | `%LOCALAPPDATA%\hermes` |
| Version | **hermes-agent v0.17.0** |
| Blank slate (no local provider configured) | **Yes** — Windows install is support layer only |
| Separate Electron app | **No** — v0.17 UI is browser-based (see note above) |

### Evidence

```text
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
  → hermes-agent v0.17.0 installed to %LOCALAPPDATA%\hermes
  → blank slate; no local inference provider configured
```

---

## AC #3 Remote mode — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Remote URL `http://localhost:9119` | **Yes** |
| Backend reads WSL `~/.hermes` | **Yes** — status bar shows `~/home/christ/.hermes` (WSL backend path) |
| NOT using local Windows agent backend | **Yes** — remote client to WSL dashboard |
| Dual-home separation | **Yes** — WSL canonical config; Windows `%LOCALAPPDATA%\hermes` = CLI/support only |

### Evidence

```text
Browser UI at http://localhost:9119
Status bar: backend path ~/home/christ/.hermes (WSL)
Windows %LOCALAPPDATA%\hermes = install/support; inference + SOUL from WSL
```

---

## AC #4 OAuth sign-in — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Sign in with Nous Research (Portal OAuth) | **Yes** |
| Authenticated identity | `nas_user:96102_` via **nous** (Portal OAuth) |
| Matches 74-6 `auth_path: oauth` | **Yes** |
| Not stuck on sign-in gate | **Yes** |

### Evidence

```text
OAuth: authenticated as nas_user:96102_ via nous (Portal OAuth)
Matches 74-6 auth_path: oauth — no basic-auth fallback used
```

---

## AC #5 WebSocket connected — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Live chat WebSocket active | **Yes** — Active Sessions: **1** |
| Not status-only / backend-ready only | **Yes** — live chat confirmed in browser UI |
| UI indicator | Active Sessions count + working chat channel |

### Evidence

```text
Dashboard UI: Active Sessions: 1
Live chat confirmed — not merely /api/status backend_ready
WebSocket path: ws://localhost:9119/api/ws (derived from HTTP URL)
```

---

## AC #6 Portal test message — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Test prompt | `Reply with exactly: portal-desktop-ok` |
| Response | **`portal-desktop-ok`** (exact match) |
| Model route | **Portal / Nous** — `anthropic/claude-sonnet-4.6` |
| Auth/connection errors | **None** |

### Evidence

```text
Prompt: Reply with exactly: portal-desktop-ok
Reply: portal-desktop-ok (exact)
Model: claude-sonnet-4.6 via Portal/Nous
```

---

## AC #7 Discord independence — PASS (operator 2026-06-24)

| Check | Result |
|-------|--------|
| Gateway PID distinct from dashboard | **Yes** — Gateway 837348 / Dashboard 3479017 |
| Gateway Status in UI | **Running** (separate process) |
| Desktop install did not stop WSL gateway | **Yes** — PID unchanged |
| Discord `#hermes` spot check | Skipped — 74-5/74-6 evidence; gateway PID unchanged |

### Evidence

```text
UI Gateway Status: Running (separate from dashboard)
pgrep at story close:
  gateway → 837348
  dashboard → 3479017
Windows install did not reconfigure or stop WSL gateway
```

---

## AC #8 Connection draft — PASS (2026-06-24)

| Check | Result |
|-------|--------|
| `74-7-connection-steps-draft.md` created | **Yes** |
| OAuth supersedes basic-auth in research doc | **Noted** in draft |
| v0.17 browser-based UI documented | **Yes** — supersedes Electron references |

---

## AC #9 verify.sh — PASS (2026-06-24)

```text
bash scripts/verify.sh → VERIFY PASSED
```

| Check | Result |
|-------|--------|
| verify.sh green at story close | **Yes** |
| No secret files in git diff | **Yes** — evidence + draft + sprint-status + story only |
| Protect-list zero diffs | **Yes** |
| No `src/` changes | **Yes** |

---

## Completion checklist

- [x] AC #1 WSL prerequisites verified
- [x] AC #2 Windows install — v0.17.0 to `%LOCALAPPDATA%\hermes`
- [x] AC #3 Remote mode — browser UI → WSL backend `~/.hermes`
- [x] AC #4 OAuth sign-in — `nas_user:96102_` via nous
- [x] AC #5 WebSocket live chat — Active Sessions: 1
- [x] AC #6 Portal test message — `portal-desktop-ok` exact reply
- [x] AC #7 Gateway independence — Running, PID unchanged
- [x] AC #8 Connection steps draft for 74-8
- [x] AC #9 verify.sh green; protect-list + `src/` clean
