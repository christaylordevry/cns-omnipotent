# Hermes Desktop Connection Architecture
_As of 2026-06-23 | Sourced from Prompt B (Context7 + live system inspection)_

---

## Critical conceptual clarification

**Gateway ≠ Dashboard.** These are two separate processes.

| Process | Purpose | Current state |
|---------|---------|--------------|
| `hermes gateway` | Discord/Telegram/Slack messaging | ✅ Running — PID 837348, `@reboot` cron |
| `hermes dashboard` | Desktop app + web admin + chat API | ❌ Not running |

The gateway stays running exactly as it is. Installing Hermes Desktop does not touch it.
Discord mobile surface is unaffected. The consolidation is **additive, not a migration.**

---

## Architecture

```
Windows Host (mirrored WSL networking)
│
└── Hermes Desktop (Electron app)
        │  HTTP GET /api/status + POST auth
        │  WebSocket /api/ws
        ▼
WSL2 Ubuntu
├── hermes dashboard :9119  ← NEW — needs to be started
│       │
│       └── ~/.hermes/ (config.yaml, SOUL.md, vault-io MCP, skills)
│
└── hermes gateway (existing, unchanged)
        │
        └── Discord API ← mobile surface, unchanged
```

Both processes share `~/.hermes/`. Hermes Desktop in remote mode reads
SOUL.md, config.yaml, and all skills from WSL — no Windows-side copy needed.

---

## Connection protocol

| Protocol | Used for |
|----------|---------|
| HTTP | `GET /api/status`, authentication, config REST |
| WebSocket | Live chat (`/api/ws`), terminal (`/api/pty`) |

Not named pipes. Not raw TCP to the gateway. The gateway is irrelevant to Desktop.

---

## WSL2 networking — lucky break

`.wslconfig` already has `networkingMode=mirrored`.

This means `http://localhost:9119` from Windows reaches the WSL2 dashboard directly.
**No `netsh portproxy` needed. No firewall rules. No WSL IP tracking.**

```
HERMES_DESKTOP_REMOTE_URL = http://localhost:9119
```

That is the complete connection URL. `http://` only — Desktop derives `ws://` internally after sign-in.

---

## WSL2 Side — what needs to happen

### Step 1: Configure dashboard auth

Add to `~/.hermes/.env` (mode 0600) **before** starting dashboard:

```bash
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=admin
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=<strong-password>
HERMES_DASHBOARD_BASIC_AUTH_SECRET=$(openssl rand -base64 32)
```

**Critical:** `--host 0.0.0.0` (required for remote Desktop) refuses to start without auth configured.
Generate the secret separately and paste the literal value.

### Step 2: Start dashboard

```bash
hermes dashboard --no-open --host 0.0.0.0 --port 9119 --skip-build
```

- `--host 0.0.0.0` — enables auth gate + allows Windows Desktop peer
- `--skip-build` — safe for cron/systemd, skips npm build step
- `--no-open` — don't try to open a browser in WSL2 headless

### Step 3: Verify before touching Windows

```bash
curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'
# Expected: true, ["basic"]
```

### Step 4: Persist across reboot

**Recommended: systemd user unit** (mirrors gateway pattern)

```ini
# ~/.config/systemd/user/hermes-dashboard.service
[Unit]
Description=Hermes Agent Dashboard
After=network-online.target

[Service]
Type=simple
EnvironmentFile=%h/.hermes/.env
ExecStart=%h/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main dashboard \
    --no-open --host 0.0.0.0 --port 9119 --skip-build
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now hermes-dashboard.service
loginctl enable-linger $USER   # if not already set for gateway
```

**Alternative: extend existing @reboot cron**

```cron
@reboot /usr/bin/env bash -lc 'hermes dashboard --no-open --host 0.0.0.0 --port 9119 --skip-build >>"$HOME/.hermes/logs/dashboard-reboot.log" 2>&1'

# Watchdog (mirror gateway pattern):
*/3 * * * * pgrep -f 'hermes_cli.main dashboard' > /dev/null || hermes dashboard --no-open --host 0.0.0.0 --port 9119 --skip-build >>"$HOME/.hermes/logs/dashboard-watchdog.log" 2>&1
```

No `config.yaml` changes required for bind/port — only `.env` auth vars.

---

## Windows Side — what needs to happen

### Step 1: Install Hermes Desktop

**Native Windows is fully supported — no WSL required for the Desktop app.**

Download: https://hermes-agent.nousresearch.com/

PowerShell one-liner (installs CLI + Desktop):
```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

The installer bundles: uv, Python 3.11, Node.js, ripgrep, ffmpeg, portable Git Bash.
Native Windows install lives under `%LOCALAPPDATA%\hermes`.

### Step 2: Configure remote connection

**In-app (preferred):**
1. Settings → Gateway → Remote gateway
2. Remote URL: `http://localhost:9119`
3. Sign in with basic-auth credentials from WSL `.env`
4. Save and reconnect

**Env override (optional):**
```powershell
$env:HERMES_DESKTOP_REMOTE_URL = "http://localhost:9119"
# Then launch Hermes Desktop
```

### Step 3: Verify

- Chat works (not just "backend ready" status)
- `/api/ws` WebSocket connects after sign-in
- Confirm gateway still running independently for Discord

---

## Complete 7-Step Install Sequence

1. WSL: Add basic-auth vars to `~/.hermes/.env`
2. WSL: Create `hermes-dashboard.service` (systemd user unit) + enable
3. WSL: `curl http://127.0.0.1:9119/api/status` → confirm `auth_required: true`
4. Windows: Install Hermes Desktop from nousresearch.com
5. Windows: Settings → Gateway → Remote URL `http://localhost:9119` → Sign in
6. Windows: Confirm chat works (WebSocket connected, not just status)
7. WSL: Confirm gateway still running independently for Discord mobile

---

## Risks and Unknowns

| Risk | Severity | Notes |
|------|----------|-------|
| Dashboard not started by default | High | Gateway cron exists; dashboard does not. Must be explicit install-story step. |
| Auth gate fail-closed | High | `--host 0.0.0.0` without auth configured → refuses to start |
| No `hermes dashboard install` | Low | Unlike gateway, dashboard has no built-in systemd installer — manual unit required |
| Dual Hermes homes | Medium | Windows install: `%LOCALAPPDATA%\hermes`; WSL: `~/.hermes`. Desktop in remote mode must not confuse the two. Use remote mode only — don't configure a local Windows agent. |
| Status vs chat disconnect | Medium | `/api/status` can pass while `/api/ws` fails. Verify WebSocket after sign-in. |
| Session persistence | Low | Without `HERMES_DASHBOARD_BASIC_AUTH_SECRET`, re-login required after every restart |
| SOUL.md in remote mode | Info | Desktop reads from WSL `~/.hermes/` — no Windows-side copy needed |
| Gateway ≠ Desktop backend | High (conceptual) | Document clearly — Discord gateway PID ≠ Desktop backend |

---

## Routing module gap

`AI-Context/modules/routing.md` covers IDE surfaces only (Cursor, Claude Code).
Hermes Desktop is not mentioned.
A new module or routing.md update should cover Desktop session model routing
as part of the consolidation epic.
