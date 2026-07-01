# Hermes Desktop + Portal Surface (Epic 74)

Governance for Hermes on Nous Portal with browser-based JARVIS chat from Windows to the WSL dashboard backend. **ADR-HERMES-001:** the primary conversational surface is a **browser UI** at `http://localhost:9119` (Hermes Agent **v0.17**, not a separate Electron app). **ADR-HERMES-008:** dashboard auth is **OAuth primary**; basic-auth is a documented fallback only.

## Topology (ADR-HERMES-001)

| Component | Where | Role |
|-----------|-------|------|
| **Dashboard UI** | Browser → `http://localhost:9119` | Primary JARVIS chat surface (FR6) |
| **Dashboard backend** | WSL `hermes dashboard :9119` | HTTP + WebSocket; reads canonical `~/.hermes/` |
| **Gateway** | WSL `hermes gateway` | Discord/Telegram — **separate process**, unchanged by Desktop connection |
| **Windows install** | `%LOCALAPPDATA%\hermes` | CLI/support layer — **not** a second agent home |
| **Not in scope** | Vercel `/nexus` | Embedded chat (ADR-HERMES-012 D3 opt-in) |

```
Windows Host (mirrored WSL networking)
└── Browser → http://localhost:9119
        │  HTTP /api/status + OAuth
        │  WebSocket /api/ws (live chat)
        ▼
WSL2 Ubuntu
├── hermes-dashboard.service → 0.0.0.0:9119 (--skip-build)
│       └── ~/.hermes/ (config.yaml, SOUL.md, skills, Portal auth)
└── hermes gateway (existing, independent PID)
        └── Discord #hermes
```

## Prerequisites (74-6 dashboard + Portal)

Confirm WSL backend before connecting from Windows:

```bash
# WSL
systemctl --user is-active hermes-dashboard.service   # → active
curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers, .backend_ready'
# → true, ["nous"], (backend_ready may be null until first session)

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
| `auth_path` | **oauth** (production — story 74-6/74-7) |
| Dashboard URL (Windows) | `http://localhost:9119` |
| Dashboard URL (WSL) | `http://127.0.0.1:9119` |
| WSL networking | Mirrored (`.wslconfig` → `networkingMode=mirrored`) |
| OAuth client name | `quiet_ibex` (ID redacted in vault; value in `~/.hermes/.env` mode `0600`) |

**Stop** if any prerequisite fails — restore 74-6 state before proceeding.

## Portal OAuth (WSL)

Primary inference auth on WSL (story 74-2):

```bash
hermes auth add nous --type oauth --manual-paste
hermes portal info
```

Expect: logged in, Nous as inference provider, API at `https://inference-api.nousresearch.com/v1`.

## Dashboard registration (ADR-HERMES-008 / FR5)

Register the dashboard OAuth client once per machine:

```bash
hermes dashboard register
```

| Outcome | Detail |
|---------|--------|
| Client name | `quiet_ibex` |
| Secret storage | `HERMES_DASHBOARD_OAUTH_CLIENT_ID` in `~/.hermes/.env` (mode **0600**) |
| Optional mirror | `config.yaml` — env file is sufficient |

## systemd (dashboard service)

User unit `hermes-dashboard.service` binds **`0.0.0.0:9119`** with `--skip-build` (operator pre-builds `web/dist` when needed). Gateway remains a **separate** systemd/cron process — do not merge dashboard and gateway into one unit.

```bash
systemctl --user status hermes-dashboard.service
journalctl --user -u hermes-dashboard -n 50
```

## Browser connection + live chat (FR6)

**Given** WSL dashboard active and Windows install complete (`install.ps1`):

1. Open **`http://localhost:9119`** in any browser (not a dedicated Electron app).
2. Confirm status bar shows WSL backend path (e.g. `~/home/christ/.hermes`) — **not** a Windows-local config.
3. Click **Sign in with Nous Research** (same Portal account as WSL `hermes portal info`).
4. Open **Chat** — confirm WebSocket connected (e.g. Active Sessions: 1).
5. Send test: `Reply with exactly: portal-desktop-ok` — expect reply via Portal (`anthropic/claude-sonnet-4.6`).

| Protocol | Endpoint | Purpose |
|----------|----------|---------|
| HTTP | `GET /api/status` | Auth gate, readiness (necessary, not sufficient) |
| HTTP | OAuth flow | Nous Portal authentication |
| WebSocket | `/api/ws` | **Live chat** (FR6) |

**Status page alone is insufficient** — always verify WebSocket chat.

### Windows install (`install.ps1`)

Run in **native Windows PowerShell** (not WSL):

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

| Outcome | Detail |
|---------|--------|
| Install path | `%LOCALAPPDATA%\hermes` |
| Admin required | **No** |
| Local agent setup | **Do not** run `hermes setup` on Windows for a second agent |

## URLs and env

| Context | URL / variable |
|---------|----------------|
| Windows browser | `http://localhost:9119` |
| WSL curl | `http://127.0.0.1:9119` |
| Optional automation | `HERMES_DESKTOP_REMOTE_URL=http://localhost:9119` |

## Dual-home anti-pattern

| Home | Path | Role |
|------|------|------|
| **WSL (canonical)** | `~/.hermes/` | Portal auth, config.yaml, SOUL.md, skills, gateway, dashboard |
| **Windows (support)** | `%LOCALAPPDATA%\hermes` | Install binaries / CLI — **remote client only** |

**Wrong:** Configure Windows `%LOCALAPPDATA%\hermes` as standalone agent with its own `config.yaml` / local gateway.  
**Right:** Browser UI reads SOUL.md, skills, and inference config **from WSL backend** over HTTP/WebSocket.

## auth_path record

| Field | Value |
|-------|-------|
| **Production (74-6/74-7)** | **oauth** |
| Dashboard OAuth client | `quiet_ibex` |
| Fallback reason | N/A — primary path succeeded |

Record any deviation in story evidence with operator approval.

## Basic-auth fallback (trusted localhost only)

Use only when OAuth registration cannot complete on a **trusted localhost** machine:

1. Set `HERMES_DASHBOARD_BASIC_AUTH_*` in `~/.hermes/.env` (never commit values).
2. Record **`auth_path: basic-auth-fallback`** plus reason in operator notes / evidence.
3. **Never** expose basic-auth on internet-facing hosts.
4. **Never** default to basic-auth when OAuth is available.

## Reversibility (NFR5)

Portal primary and compression are reversible. Full copy-paste commands live in **`AI-Context/modules/routing.md`** (Hermes agent surface section).

**Portal → openai-codex primary (last resort):**

```bash
hermes config set model.provider openai-codex
hermes config set model.default gpt-5.4-mini
hermes config set model.base_url https://chatgpt.com/backend-api/codex
hermes gateway restart
```

**Fragility:** openai-codex relies on undocumented Cloudflare allowlisting; residential IP only. See `docs/CNSHermes New Big Plan/05-openai-codex-assessment.md`.

## Subscription cost (NFR6)

One Nous Portal **$30/mo paid tier** replaces prior fragmented spend for Hermes inference and Tool Gateway access.

| Prior spend / fragility | Post-Portal posture |
|-------------------------|---------------------|
| openai-codex primary (Cloudflare / IP fragile) | Last-resort fallback only |
| OpenRouter (402 exhausted) | Removed from compression (74-3); account drain deferred |
| Dead Anthropic for Hermes inference | Portal OAuth replaces; **run-chain Boss still uses `.env.live-chain` `ANTHROPIC_API_KEY` (FR11-A)** |
| Standalone Firecrawl / TTS | Cancel only after **74-4** + **78-1** confirm Tool Gateway covers needs |

**Operator gate:** confirm net savings and Tool Gateway stability before cancelling any legacy subscription. Do not cancel standalone subscriptions until operator confirms Tool Gateway + stability (74-4 / Phase 5 cleanup).

## Discord independence

Desktop/browser connection must **not** stop the Discord gateway:

```bash
pgrep -af 'hermes_cli.main gateway'   # must still be running
pgrep -af 'hermes_cli.main dashboard' # distinct PID
```

If gateway stopped accidentally: restart `hermes-gateway.service` or your usual launcher.

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| "Backend ready" but no chat | Status ≠ WebSocket | Check Active Sessions; `journalctl --user -u hermes-dashboard -n 50` |
| Sign-in fails | Wrong auth path | Confirm `auth_path: oauth`; use Nous sign-in |
| Cannot reach `localhost:9119` | Dashboard down / networking | `systemctl --user status hermes-dashboard`; check mirrored WSL |
| UI uses Windows local config | Not remote to WSL | Confirm status bar shows `~/.hermes` WSL path |
| Model error on chat | Portal session expired | `hermes portal info` in WSL; re-login if needed |
| Discord stopped | Accidental gateway stop | Restart gateway service |
| Two configs diverge | Local Windows agent configured | Remove local agent config; browser → WSL only |
| Expecting Electron app | Outdated research doc | v0.17 = browser UI at `:9119` |

## References

- **ADR-HERMES-001** — Desktop = primary JARVIS surface (browser UI, WSL backend)
- **ADR-HERMES-008** — Dashboard OAuth primary; basic-auth fallback documented only
- **Model aliases + rollback:** `AI-Context/modules/routing.md`
- **Operator index:** `03-Resources/CNS-Operator-Guide.md` §15.13
- **Superseded research:** `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` (historical Electron/basic-auth-first steps)
- **openai-codex assessment:** `docs/CNSHermes New Big Plan/05-openai-codex-assessment.md`
- **Evidence:** `_bmad-output/implementation-artifacts/74-6-dashboard-oauth-evidence.md`, `74-7-desktop-connection-evidence.md`
