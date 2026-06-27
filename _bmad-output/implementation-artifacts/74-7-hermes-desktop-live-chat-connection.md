---
baseline_commit: d3f83fdcc613db361d1ede6083c776198c62c9c3
---

# Story 74.7: Hermes Desktop live chat connection

Status: done

<!-- Operator-first story: Windows Hermes Desktop install + REMOTE mode to WSL dashboard + OAuth + live WebSocket chat. NO src/ changes. Protect-list untouched. Full vault governance deferred to 74-8. -->

## Story

As an **operator**,
I want **Hermes Desktop on Windows connected with working WebSocket chat**,
so that **I have a local JARVIS conversational surface (FR6, ADR-HERMES-001)**.

## Acceptance Criteria

1. **Prerequisites — dashboard from 74-6 (WSL)**
   **Given** story **74-6** is **done** with `auth_path: oauth`
   **When** this story begins
   **Then** `systemctl --user is-active hermes-dashboard.service` → **active**
   **And** `curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'` → `true`, `["nous"]`
   **And** Windows `curl.exe -s http://localhost:9119/api/status` → HTTP **200**, `auth_required: true`
   **And** `hermes portal info` → logged in, Nous inference provider
   **And** `pgrep -af 'hermes_cli.main gateway'` shows gateway **running** (separate from dashboard)
   **And** if any prerequisite fails, **stop** — fix 74-6 state before continuing

2. **Prerequisite — Hermes Desktop install (Windows, not yet present)**
   **Given** Hermes Desktop is **not** installed on Windows (confirmed at story prep 2026-06-24)
   **When** operator installs from **native Windows PowerShell** (not WSL):
   ```powershell
   iex (irm https://hermes-agent.nousresearch.com/install.ps1)
   ```
   **Then** install completes under `%LOCALAPPDATA%\hermes` (Windows-native home)
   **And** Hermes Desktop app launches or is available from Start menu
   **And** evidence records installer version / `hermes --version` from Windows if CLI is on PATH
   **And** operator does **not** configure a local Windows Hermes agent — this install is **Desktop UI only** in remote mode (see AC #3)

3. **Remote mode — point Desktop at WSL dashboard (not local backend)**
   **Given** Desktop installed (AC #2) and WSL dashboard reachable (AC #1)
   **When** operator configures Hermes Desktop:
   - Settings → **Gateway** → **Remote gateway**
   - Remote URL: `http://localhost:9119` (from 74-6 handoff; document if different)
   - **Do not** use "local gateway" / do not start a Windows-side `hermes gateway` or local dashboard backend
   **Then** Desktop is in **remote mode** attached to WSL `hermes dashboard :9119`
   **And** evidence confirms two separate Hermes homes:
     - WSL backend: `~/.hermes/` (config, SOUL.md, skills, Portal auth)
     - Windows Desktop shell: `%LOCALAPPDATA%\hermes` (UI only — remote client)
   **Optional env override (document if used):**
   ```powershell
   $env:HERMES_DESKTOP_REMOTE_URL = "http://localhost:9119"
   ```

4. **OAuth sign-in (matches 74-6 `auth_path: oauth`)**
   **Given** remote URL set (AC #3) and dashboard `auth_providers: ["nous"]`
   **When** operator signs in from Desktop using **Sign in with Nous Research** (OAuth / Portal — same account as WSL `hermes portal info`)
   **Then** sign-in completes without basic-auth credentials
   **And** Desktop shows authenticated / connected to remote backend (not stuck on sign-in gate)
   **Fallback only:** if 74-6 recorded `auth_path: basic-auth-fallback`, Desktop uses WSL basic-auth credentials instead — **not applicable** when 74-6 = `oauth` (current baseline)

5. **WebSocket live chat — not status-only**
   **Given** OAuth sign-in complete (AC #4)
   **When** operator opens chat in Hermes Desktop
   **Then** UI shows **WebSocket connected** (live chat channel — not merely "backend ready" / status-only)
   **And** operator verifies `/api/ws` path is active (Desktop derives `ws://` from `http://` URL after sign-in)
   **Note:** Context7 documents that readiness/status can pass while WebSocket chat fails — this AC requires **confirmed live chat connection**, not status page alone.

6. **Test message — Portal model response**
   **Given** WebSocket connected (AC #5)
   **When** operator sends a short test message in Desktop chat (e.g. "Reply with exactly: portal-desktop-ok")
   **Then** Hermes returns a **model response** routed via **Portal / Nous** (same stack as 74-2: `provider: nous`, `anthropic/claude-sonnet-4.6`)
   **And** response is not an auth error, connection error, or empty stream
   **And** evidence records test prompt + response summary (redact if sensitive)

7. **Discord mobile surface independence (FR4 / NFR2)**
   **Given** Desktop chat working (AC #6)
   **When** operator verifies Discord gateway
   **Then** `pgrep -af 'hermes_cli.main gateway'` (WSL) shows gateway **still running** — distinct PID from dashboard
   **And** Discord `#hermes` accepts a short spot-check message (or cite unchanged 74-5/74-6 evidence if gateway PID unchanged)
   **And** Desktop install did **not** stop, replace, or reconfigure WSL gateway

8. **Connection steps documented (feeds 74-8)**
   **Given** AC #2–#7 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/74-7-connection-steps-draft.md` exists with operator runbook: install → remote URL → OAuth sign-in → WebSocket verify → test message → Discord check
   **And** draft notes OAuth supersedes basic-auth-first steps in `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md`
   **And** draft is input for **74-8** vault `hermes-desktop.md` governance (WriteGate — do not edit `AI-Context/` this story)

9. **Evidence + verify gate (NFR1, NFR4, NFR2)**
   **Given** AC #2–#8 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/74-7-desktop-connection-evidence.md` exists with dated PASS/FAIL per AC (redacted)
   **And** `bash scripts/verify.sh` passes unchanged
   **And** git diff contains **no** secret files (`.env`, `auth.json`, Windows `%LOCALAPPDATA%\hermes` secrets)
   **And** protect-list paths have **zero** diffs (NFR2)
   **And** **no** `src/` changes

## Tasks / Subtasks

- [x] **AC #1 — Verify WSL dashboard prerequisites** (AC: #1)
  - [x] `systemctl --user is-active hermes-dashboard.service`
  - [x] WSL + Windows curl `/api/status` → `auth_required: true`, `["nous"]`
  - [x] `hermes portal info` logged in; gateway running

- [x] **AC #2 — Install Hermes Desktop on Windows** (AC: #2)
  - [x] Confirm Desktop absent pre-install (Start menu / `%LOCALAPPDATA%\hermes`)
  - [x] Run `iex (irm https://hermes-agent.nousresearch.com/install.ps1)` in PowerShell
  - [x] Record install location + version in evidence

- [x] **AC #3 — Configure remote mode** (AC: #3)
  - [x] Settings → Gateway → Remote gateway → `http://localhost:9119`
  - [x] Confirm NOT using local Windows backend
  - [x] Document dual-home separation in evidence

- [x] **AC #4 — OAuth sign-in** (AC: #4)
  - [x] Sign in with Nous Research (Portal OAuth)
  - [x] Confirm matches 74-6 `auth_path: oauth`

- [x] **AC #5 — WebSocket connected** (AC: #5)
  - [x] Chat UI shows WebSocket connected (not status-only)
  - [x] Document UI indicator observed

- [x] **AC #6 — Portal test message** (AC: #6)
  - [x] Send test message; capture model response via Portal

- [x] **AC #7 — Discord independence** (AC: #7)
  - [x] Gateway PID distinct from dashboard; Discord spot check

- [x] **AC #8 — Connection runbook draft** (AC: #8)
  - [x] Create `74-7-connection-steps-draft.md` for 74-8 handoff

- [x] **AC #9 — Evidence + verify** (AC: #9)
  - [x] Complete `74-7-desktop-connection-evidence.md`
  - [x] `bash scripts/verify.sh` green; protect-list + `src/` clean

## Dev Notes

### Epic and sequencing context

- **Epic 74 (Hermes on Portal + Desktop)** — story **74-7** implements **FR6** (Desktop WebSocket live chat).
- **Prerequisites done:** **74-6** dashboard OAuth + systemd + Windows reachability (`auth_path: oauth`).
- **Blocks:** **74-8** Portal + Desktop governance documentation (vault modules via session-close).
- **Does not include:** Tool Gateway web search (**74-4**), full `hermes-desktop.md` vault publish (**74-8**), voice/TTS (**78-1**).
- **Branch:** `hermes-consolidation`.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 74-7, §FR6; `sprint-status.yaml` Epic 74]

### Critical conceptual clarification (do not break Discord)

| Process | Where | Purpose | This story |
|---------|-------|---------|------------|
| **Gateway** | WSL `~/.hermes/` | Discord/Telegram messaging | **Observe only** — must stay running |
| **Dashboard** | WSL `~/.hermes/` | Desktop backend, `/api/ws` chat | **Already running** (74-6) — do not reconfigure |
| **Hermes Desktop** | Windows `%LOCALAPPDATA%\hermes` | Electron UI — **remote client** | **Install + connect** |

Desktop connects to **`hermes dashboard`** on `:9119`, **not** to `hermes gateway`. Gateway and Discord mobile surface are **unchanged**.

[Source: `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` §Critical conceptual clarification; Context7 `/nousresearch/hermes-agent` — web-dashboard.md]

### Live baseline from 74-6 (verify at story start — do not assume)

| Property | Expected (74-6 handoff) | Verify with |
|----------|-------------------------|-------------|
| Dashboard service | **Active** | `systemctl --user is-active hermes-dashboard.service` |
| Dashboard URL (Windows) | `http://localhost:9119` | `curl.exe` from PowerShell |
| Dashboard URL (WSL) | `http://127.0.0.1:9119` | `curl` from WSL |
| `auth_path` | **oauth** | `74-6-dashboard-oauth-evidence.md` |
| `auth_providers` | `["nous"]` | `/api/status` |
| OAuth client | `quiet_ibex` (name only) | 74-6 evidence |
| Gateway PID | Separate from dashboard | `pgrep -af gateway` vs `dashboard` |
| Hermes Desktop (Windows) | **Not installed** | Start menu / `%LOCALAPPDATA%\hermes` absent |
| Portal | Logged in, Nous provider | `hermes portal info` |
| WSL networking | Mirrored | `.wslconfig` → `networkingMode=mirrored` |
| verify.sh | Green | `bash scripts/verify.sh` |

[Source: `_bmad-output/implementation-artifacts/74-6-dashboard-oauth-evidence.md`]

### Operator runbook (canonical path — OAuth + remote mode)

#### Phase A — WSL preflight (AC #1)

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md

# Dashboard still up from 74-6
systemctl --user is-active hermes-dashboard.service
curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers, .backend_ready'

# Portal stack healthy
hermes portal info
grep -A4 '^model:' ~/.hermes/config.yaml   # expect provider: nous

# Gateway independent
pgrep -af 'hermes_cli.main gateway'
pgrep -af 'hermes_cli.main dashboard'     # distinct PIDs
```

From **Windows PowerShell**:

```powershell
curl.exe -s http://localhost:9119/api/status
# Expect: auth_required true, auth_providers ["nous"]
```

#### Phase B — Windows Desktop install (AC #2) — **required prerequisite**

```powershell
# Run in Windows PowerShell (NOT WSL)
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

- Installs to `%LOCALAPPDATA%\hermes` (uv, Python 3.11, Node, Desktop app).
- **No admin required.**
- After install: launch **Hermes Desktop** from Start menu.
- **Do not** run `hermes setup` on Windows to create a second agent — use **remote mode only**.

[Source: Context7 `/nousresearch/hermes-agent` — README.md, windows-native.md; `03-hermes-desktop-connection.md` §Windows Side]

#### Phase C — Remote connection + OAuth (AC #3, #4)

**In Hermes Desktop (Windows):**

1. **Settings** → **Gateway** → enable **Remote gateway**
2. **Remote URL:** `http://localhost:9119`
3. Click **Save and reconnect**
4. Sign in with **Sign in with Nous Research** (OAuth — same Portal account as WSL)
5. Confirm authenticated state — not stuck on login gate

**Env override (optional):**

```powershell
$env:HERMES_DESKTOP_REMOTE_URL = "http://localhost:9119"
# Then launch Hermes Desktop
```

[Source: Context7 `/nousresearch/hermes-agent` — web-dashboard.md, desktop.md, environment-variables.md]

#### Phase D — Live chat verification (AC #5, #6)

1. Open **Chat** in Desktop
2. Confirm **WebSocket connected** indicator (not merely "backend ready")
3. Send test message: `Reply with exactly: portal-desktop-ok`
4. Expect model response via Portal (nous / Sonnet 4.6)
5. If status passes but chat fails: check WSL `journalctl --user -u hermes-dashboard -n 50` for WebSocket errors

[Source: Context7 — web-dashboard.md warns status check is less stringent than live chat]

#### Phase E — Discord regression (AC #7)

```bash
# WSL — gateway still running?
pgrep -af 'hermes_cli.main gateway'

# Discord #hermes — short spot check (or cite 74-5/74-6 if PID unchanged)
```

#### Phase F — Close story (AC #8, #9)

```bash
bash scripts/verify.sh
# Create evidence + connection-steps draft (see Completion deliverables)
```

### Dual Hermes homes — anti-pattern prevention

| Home | Path | Role in CNS topology |
|------|------|----------------------|
| **WSL (canonical)** | `~/.hermes/` | Portal auth, config.yaml, SOUL.md, skills, gateway, dashboard |
| **Windows (Desktop shell)** | `%LOCALAPPDATA%\hermes` | Desktop app binaries only — **remote client** |

**Wrong:** Configure Windows `%LOCALAPPDATA%\hermes` as a standalone local agent with its own `config.yaml` / `hermes setup` / local gateway.

**Right:** Desktop in remote mode reads SOUL.md, skills, and inference config **from WSL backend** over HTTP/WebSocket.

[Source: `03-hermes-desktop-connection.md` §Risks — Dual Hermes homes; ADR-HERMES-001]

### OAuth vs legacy research doc

`docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` still shows **basic-auth-first** steps (Phase 2 in `06-implementation-sequence.md`). **Superseded by ADR-HERMES-008:** OAuth primary path from 74-6. Desktop sign-in = **Nous OAuth**, not WSL basic-auth credentials.

74-7 draft runbook must document OAuth path; 74-8 reconciles vault governance.

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` ADR-HERMES-008; 74-6 Dev Notes]

### Connection protocol reference

| Protocol | Endpoint | Purpose |
|----------|----------|---------|
| HTTP | `GET /api/status` | Auth gate, backend readiness |
| HTTP | OAuth sign-in flow | Nous Portal authentication |
| WebSocket | `/api/ws` | **Live chat** (FR6) |
| WebSocket | `/api/pty` | Terminal (out of scope) |

Desktop URL: `http://localhost:9119` only — app derives `ws://localhost:9119/api/ws` internally.

[Source: `03-hermes-desktop-connection.md` §Connection protocol]

### Troubleshooting matrix

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Desktop shows "backend ready" but no chat | Status ≠ WebSocket | Verify WS indicator; check dashboard logs |
| Sign-in fails | Wrong auth path | Confirm 74-6 `auth_path: oauth`; use Nous sign-in |
| Cannot reach `localhost:9119` from Windows | Dashboard down or networking | `systemctl --user status hermes-dashboard`; check `.wslconfig` mirrored mode |
| Desktop starts local backend | Not in remote mode | Settings → Remote gateway; do not use local gateway |
| Model error on chat | Portal session expired | `hermes portal info` in WSL; re-login if needed |
| Discord stopped working | Accidental gateway stop | Restart `hermes-gateway.service`; never tie Desktop install to gateway |
| Two configs diverge | Local Windows agent configured | Remove local agent config; remote mode only |

### Explicitly out of scope (defer)

| Action | Story |
|--------|-------|
| Vault `hermes-desktop.md` + `routing.md` publish | **74-8** (WriteGate) |
| Tool Gateway / web search | **74-4** |
| Push-to-talk / TTS | **78-1** |
| Dashboard systemd/OAuth register | **74-6** (done) |
| `src/` Vault IO MCP changes | **Forbidden** |
| Protect-list adapter/run-chain edits | **Forbidden** (NFR2) |
| NEXUS bridge / cns-dashboard changes | **Forbidden** (NFR2) |

### Architecture compliance

- **FR6:** Hermes Desktop connects to WSL backend; live WebSocket chat works.
- **ADR-HERMES-001:** Desktop = primary conversational JARVIS surface (with Discord secondary).
- **ADR-HERMES-008:** OAuth sign-in matches 74-6 dashboard registration.
- **FR4 / NFR2:** Gateway independent; protect-list untouched; no `src/` edits.
- **NFR4:** Secrets stay in `~/.hermes/` / Windows local app data — not in repo.
- **NFR1:** `verify.sh` must pass; **no new automated tests** (operator verification story).
- **WriteGate:** Connection draft in `_bmad-output/` only; vault modules deferred to **74-8**.

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` ADR-HERMES-001, ADR-HERMES-008; `prd-hermes-consolidation.md` §FR6]

### Protect-list (NFR2 — zero diffs required)

```
scripts/run-chain.ts
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
```

Plus entire `src/` tree — **no changes this story**.

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Process Patterns]

### CNS vault contract cite

This story performs **no Vault IO mutations**. Operator work touches Windows Desktop install + WSL Hermes runtime only. Vault MCP WriteGate unaffected until **74-8**.

[Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — no mutator paths engaged]

### Testing requirements

| Layer | Expectation |
|-------|-------------|
| Automated | `bash scripts/verify.sh` — must pass unchanged |
| Manual | AC #2–#7 operator checklist on Windows + WSL |
| Git | Evidence markdown + connection draft + sprint-status only; no secrets |
| Regression | Gateway running; Discord spot check; 74-6 dashboard unchanged except if troubleshooting |

### Completion deliverables

| Deliverable | Path |
|-------------|------|
| Operator evidence | `_bmad-output/implementation-artifacts/74-7-desktop-connection-evidence.md` (new) |
| Connection runbook draft (74-8 input) | `_bmad-output/implementation-artifacts/74-7-connection-steps-draft.md` (new) |
| Windows Desktop install | `%LOCALAPPDATA%\hermes` (operator machine — not in repo) |
| Tracker | `sprint-status.yaml` — story `done` after dev-story |

### Evidence file template (create at dev-story start)

```markdown
# Story 74-7 — Hermes Desktop Live Chat Connection Evidence

**Story:** 74-7-hermes-desktop-live-chat-connection
**Operator:** Chris
**Date completed:** YYYY-MM-DD
**Hermes WSL version:** (from `hermes --version` in WSL)
**Hermes Windows version:** (from Windows if available)
**auth_path:** oauth (from 74-6)
**Remote URL:** http://localhost:9119

> Redaction policy (NFR4): no tokens, passwords, or full OAuth client IDs.

## AC #1 WSL prerequisites — PASS/FAIL

## AC #2 Desktop install — PASS/FAIL
(install command, %LOCALAPPDATA%\hermes confirmed)

## AC #3 Remote mode — PASS/FAIL
(remote URL, NOT local backend)

## AC #4 OAuth sign-in — PASS/FAIL

## AC #5 WebSocket connected — PASS/FAIL
(UI indicator observed)

## AC #6 Portal test message — PASS/FAIL
(prompt + response summary)

## AC #7 Discord independence — PASS/FAIL
(gateway PID, Discord spot check)

## AC #8 Connection draft — PASS/FAIL
(74-7-connection-steps-draft.md created)

## AC #9 verify.sh — PASS/FAIL
```

### Connection steps draft template (AC #8 — feeds 74-8)

Create `74-7-connection-steps-draft.md` with sections:

1. Prerequisites (74-6 dashboard + Portal)
2. Windows install (`install.ps1`)
3. Remote mode configuration (URL, dual-home warning)
4. OAuth sign-in (Nous Research)
5. WebSocket + chat verification
6. Discord independence check
7. Troubleshooting (from matrix above)
8. Note: supersedes basic-auth-first in `03-hermes-desktop-connection.md`

### Previous story intelligence (74-6)

- Dashboard OAuth `quiet_ibex`; `auth_path: oauth`; `auth_providers: ["nous"]`.
- systemd `hermes-dashboard.service` active on `0.0.0.0:9119`.
- Windows reachability confirmed via mirrored networking: `http://localhost:9119`.
- Gateway PID 837348 / Dashboard PID 3479017 — separate processes (re-verify PIDs at 74-7 start).
- **74-7 handoff URLs:** Windows `http://localhost:9119`; WSL `http://127.0.0.1:9119`.

[Source: `_bmad-output/implementation-artifacts/74-6-dashboard-oauth-evidence.md`]

### Previous story intelligence (74-2, 74-5)

- Portal OAuth 2026-06-24; nous/Sonnet 4.6 primary model.
- 74-5 FR4 Discord regression PASS — spot check optional if gateway PID unchanged.

[Source: `_bmad-output/implementation-artifacts/74-2-portal-oauth-evidence.md`, `74-5-gateway-regression-evidence.md`]

### Git intelligence (hermes-consolidation branch)

Expect repo diffs: evidence markdown, connection draft, sprint-status, story file only. Hermes runtime state under `~/.hermes/` and Windows `%LOCALAPPDATA%\hermes` are gitignored / out of repo.

### Latest technical specifics (Context7 — Hermes Agent v0.17)

- **Windows install:** `iex (irm https://hermes-agent.nousresearch.com/install.ps1)` → `%LOCALAPPDATA%\hermes`
- **Remote URL env:** `HERMES_DESKTOP_REMOTE_URL=http://localhost:9119`
- **Desktop settings:** Settings → Gateway → Remote gateway → URL + sign-in
- **OAuth (recommended for remote):** `hermes dashboard register` (done 74-6) + Desktop "Sign in with Nous Research"
- **Desktop attaches to dashboard, not gateway:** gateway is separate Discord process
- **Status vs chat:** `/api/status` can pass while `/api/ws` fails — verify WebSocket explicitly

[Source: Context7 `/nousresearch/hermes-agent` — web-dashboard.md, desktop.md, windows-native.md, environment-variables.md]

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (no edits this story)
- PRD FR6: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR6
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` ADR-HERMES-001, ADR-HERMES-008
- Research (superseded auth section): `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md`
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15 (74-8 full update)

### Deferred work cross-reference

- Full vault `hermes-desktop.md` governance → **74-8**
- Tool Gateway web search → **74-4** (not blocker for Desktop chat)
- Pre-2 session-close → **76-1**

[Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor dev-story)

### Debug Log References

- Story prep 2026-06-24: evidence scaffold + read-only AC #1 pre-checks; paused for operator Windows install + Desktop UI (AC #2–#7).
- Operator close 2026-06-24: AC #2–#7 PASS; v0.17 browser UI model confirmed (not Electron); gateway PID 837348 unchanged.

### Completion Notes List

- Prep complete: `74-7-desktop-connection-evidence.md` scaffolded (2026-06-24).
- AC #1 PASS: dashboard active; oauth gate; gateway 837348 / dashboard 3479017.
- AC #2 PASS: hermes-agent v0.17.0 → `%LOCALAPPDATA%\hermes`; blank slate, no local provider.
- AC #3 PASS: browser UI at `http://localhost:9119`; status bar shows WSL `~/.hermes` backend.
- AC #4 PASS: OAuth `nas_user:96102_` via nous; matches 74-6 `auth_path: oauth`.
- AC #5 PASS: Active Sessions 1; live WebSocket chat (not status-only).
- AC #6 PASS: `portal-desktop-ok` exact reply via claude-sonnet-4.6 / Portal.
- AC #7 PASS: Gateway Status Running; PID 837348 unchanged (74-5/74-6 cite for Discord).
- AC #8 PASS: `74-7-connection-steps-draft.md` — documents v0.17 browser UI for 74-8.
- AC #9 PASS: verify.sh green; no secrets, protect-list, or `src/` diffs.
- **74-8 handoff:** Connection draft + browser UI correction for vault `hermes-desktop.md`.

### File List

- `_bmad-output/implementation-artifacts/74-7-desktop-connection-evidence.md` (operator evidence)
- `_bmad-output/implementation-artifacts/74-7-connection-steps-draft.md` (74-8 input)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (74-7 done)
- `_bmad-output/implementation-artifacts/74-7-hermes-desktop-live-chat-connection.md` (story tracking)

### Change Log

- 2026-06-24: Dev-story prep — evidence scaffold + read-only AC #1 prerequisite verification; paused for operator Windows/Desktop steps (AC #2–#7).
- 2026-06-24: Operator close — Desktop live chat via browser UI; all ACs PASS; story done.

## Story completion status

- **Status:** done
- **Context engine:** Ultimate context analysis completed — Windows Desktop install prerequisite, remote-mode dual-home guardrails, OAuth sign-in matching 74-6, WebSocket vs status-only verification, Portal test message, Discord independence, connection draft for 74-8, and protect-list/`src/` boundaries included.
- **Next story after done:** `74-8-portal-and-desktop-governance-documentation`
