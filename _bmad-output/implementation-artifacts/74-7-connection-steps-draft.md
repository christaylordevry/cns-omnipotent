# Hermes Desktop Connection Runbook (Draft — 74-8 input)

**Story:** 74-7-hermes-desktop-live-chat-connection  
**Date:** 2026-06-24  
**Status:** Draft for **74-8** vault governance (`hermes-desktop.md` via WriteGate)  
**Supersedes:** Basic-auth-first steps in `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` and any **Electron app** references — see §UI model below.

---

## 1. Prerequisites (74-6 dashboard + Portal)

Before connecting Hermes Desktop, confirm WSL backend from story **74-6**:

```bash
# WSL
systemctl --user is-active hermes-dashboard.service   # → active
curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'
# → true, ["nous"]

hermes portal info    # → logged in, Nous inference provider
pgrep -af 'hermes_cli.main gateway'    # gateway running (Discord)
pgrep -af 'hermes_cli.main dashboard'  # separate PID from gateway
```

From **Windows PowerShell**:

```powershell
curl.exe -s http://localhost:9119/api/status
# → auth_required: true, auth_providers: ["nous"]
```

| Property | Expected |
|----------|----------|
| `auth_path` | **oauth** (from 74-6) |
| Dashboard URL (Windows) | `http://localhost:9119` |
| Dashboard URL (WSL) | `http://127.0.0.1:9119` |
| WSL networking | Mirrored (`.wslconfig` → `networkingMode=mirrored`) |
| OAuth client name | `quiet_ibex` (ID redacted in vault) |

**Stop** if any prerequisite fails — fix 74-6 state first.

---

## 2. Windows install (`install.ps1`)

Run in **native Windows PowerShell** (not WSL):

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

| Outcome | Detail |
|---------|--------|
| Install path | `%LOCALAPPDATA%\hermes` |
| Version (74-7) | hermes-agent **v0.17.0** |
| Admin required | **No** |
| Local agent setup | **Do not** run `hermes setup` on Windows for a second agent |

**Blank-slate rule:** Windows install provides CLI + dashboard server support. Do **not** configure a local Windows inference provider — use remote mode to WSL only.

---

## 3. UI model — browser-based (v0.17 correction)

> **Governance note for 74-8:** In Hermes Agent **v0.17**, "Hermes Desktop" is **not** a separate Electron application. The conversational UI is **browser-based** at `http://localhost:9119`. The Windows `install.ps1` installs the Hermes CLI and dashboard server support; operators open **any browser** to the dashboard URL to chat.

This supersedes research doc references to an Electron Desktop app in `03-hermes-desktop-connection.md`.

| Component | Where | Role |
|-----------|-------|------|
| **Dashboard UI** | Browser → `http://localhost:9119` | Primary JARVIS chat surface (FR6) |
| **Dashboard backend** | WSL `hermes dashboard :9119` | Serves HTTP + WebSocket; reads `~/.hermes/` |
| **Windows install** | `%LOCALAPPDATA%\hermes` | CLI/support layer — **not** a second agent home |
| **Gateway** | WSL `hermes gateway` | Discord/Telegram — **unchanged** by Desktop connection |

---

## 4. Remote mode configuration

**Given** WSL dashboard running (74-6) and Windows install complete:

1. Open browser to **`http://localhost:9119`**
2. Confirm status bar shows WSL backend path (e.g. `~/home/christ/.hermes`) — **not** a Windows-local config
3. **Do not** start a Windows-side `hermes gateway` or local dashboard backend
4. **Do not** use "local gateway" mode

**Optional env override** (if documented for automation):

```powershell
$env:HERMES_DESKTOP_REMOTE_URL = "http://localhost:9119"
```

### Dual-home anti-pattern

| Home | Path | Role |
|------|------|------|
| **WSL (canonical)** | `~/.hermes/` | Portal auth, config.yaml, SOUL.md, skills, gateway, dashboard |
| **Windows (support)** | `%LOCALAPPDATA%\hermes` | Install binaries / CLI — **remote client only** |

**Wrong:** Configure Windows `%LOCALAPPDATA%\hermes` as standalone agent with its own `config.yaml` / local gateway.  
**Right:** Browser UI reads SOUL.md, skills, and inference config **from WSL backend** over HTTP/WebSocket.

---

## 5. OAuth sign-in (Nous Research)

**Given** `auth_providers: ["nous"]` from 74-6 (`auth_path: oauth`):

1. In browser UI at `http://localhost:9119`, click **Sign in with Nous Research**
2. Complete Portal OAuth (same account as WSL `hermes portal info`)
3. Confirm authenticated state — not stuck on login gate
4. **Do not** use WSL basic-auth credentials (fallback only if 74-6 recorded `auth_path: basic-auth-fallback`)

74-7 verified: authenticated as `nas_user:96102_` via nous.

---

## 6. WebSocket + chat verification

Status page alone is **insufficient** — verify live chat:

1. Open **Chat** in browser UI
2. Confirm **Active Sessions: 1** (or equivalent WebSocket connected indicator)
3. Send test message: `Reply with exactly: portal-desktop-ok`
4. Expect exact reply via Portal (`anthropic/claude-sonnet-4.6`)

| Protocol | Endpoint | Purpose |
|----------|----------|---------|
| HTTP | `GET /api/status` | Auth gate, readiness (necessary not sufficient) |
| HTTP | OAuth flow | Nous Portal authentication |
| WebSocket | `/api/ws` | **Live chat** (FR6) |

If status passes but chat fails: `journalctl --user -u hermes-dashboard -n 50` in WSL.

---

## 7. Discord independence check

Desktop/browser connection must **not** affect Discord gateway:

```bash
pgrep -af 'hermes_cli.main gateway'   # must still be running
pgrep -af 'hermes_cli.main dashboard' # distinct PID
```

Optional: post short spot check in `#hermes`, or cite 74-5/74-6 evidence if gateway PID unchanged.

74-7: Gateway PID **837348** unchanged; UI showed Gateway Status: **Running**.

---

## 8. Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| "Backend ready" but no chat | Status ≠ WebSocket | Check Active Sessions; dashboard logs |
| Sign-in fails | Wrong auth path | Confirm 74-6 `auth_path: oauth`; use Nous sign-in |
| Cannot reach `localhost:9119` | Dashboard down / networking | `systemctl --user status hermes-dashboard`; check mirrored WSL |
| UI uses Windows local config | Not remote to WSL | Confirm status bar shows `~/.hermes` WSL path |
| Model error on chat | Portal session expired | `hermes portal info` in WSL; re-login if needed |
| Discord stopped | Accidental gateway stop | Restart `hermes-gateway.service` |
| Two configs diverge | Local Windows agent configured | Remove local agent config; browser → WSL only |
| Expecting Electron app | Outdated research doc | v0.17 = browser UI at `:9119` |

---

## 9. 74-8 handoff notes

- Publish reconciled runbook to vault `hermes-desktop.md` (WriteGate — session-close)
- Update `routing.md` / Operator Guide §15 with OAuth-primary + browser UI model
- Retire or annotate Electron references in `03-hermes-desktop-connection.md`
- Evidence: `74-7-desktop-connection-evidence.md`
- ADR refs: ADR-HERMES-001 (Desktop = primary JARVIS surface), ADR-HERMES-008 (OAuth)
