---
baseline_commit: 3d90725
---

# Story 74.6: Hermes dashboard OAuth registration, systemd, and reachability

Status: done

<!-- Operator-first story: WSL Hermes dashboard OAuth + systemd + Windows reachability. NO src/ code changes. Gateway must remain independent. Desktop chat is 74-7. -->

## Story

As an **operator**,
I want **hermes dashboard registered with Nous OAuth, running persistently, and reachable from Windows**,
so that **Hermes Desktop can connect to the WSL backend with Portal auth (FR5, ADR-HERMES-008)**.

## Acceptance Criteria

1. **Prerequisites — Portal stack + regression gate (74-2, 74-5)**
   **Given** stories **74-2** and **74-5** are **done**
   **When** this story begins
   **Then** `hermes portal info` shows **logged in** with **Nous inference provider**
   **And** `grep -A4 '^model:' ~/.hermes/config.yaml` shows `provider: nous`, `default: anthropic/claude-sonnet-4.6`
   **And** `74-5-gateway-regression-evidence.md` exists with Discord FR4 gate **PASS**
   **And** if any prerequisite fails, **stop** — complete 74-2/74-5 before continuing
   **Note:** **74-4** (Tool Gateway) may still be backlog — **not** a hard blocker for dashboard work.

2. **Dashboard OAuth registration (primary auth path)**
   **Given** Portal login from 74-2
   **When** operator runs (verify live flags first):
   ```bash
   hermes dashboard --help
   hermes dashboard register --help
   hermes dashboard register
   ```
   **Then** `HERMES_DASHBOARD_OAUTH_CLIENT_ID` is written to `~/.hermes/.env`
   **And** `~/.hermes/.env` file mode is **`0600`**
   **And** register stdout (client name, no secrets) is captured in evidence
   **And** optional mirror in `~/.hermes/config.yaml` is acceptable:
   ```yaml
   dashboard:
     oauth:
       client_id: <from register>
   ```

3. **systemd user unit — persistent dashboard on `0.0.0.0:9119`**
   **Given** OAuth client ID from AC #2
   **When** operator creates and enables `~/.config/systemd/user/hermes-dashboard.service`
   **Then** unit `ExecStart` runs dashboard with **`--no-open --host 0.0.0.0 --port 9119 --skip-build`**
   **And** unit loads `EnvironmentFile=%h/.hermes/.env`
   **And** `Restart=on-failure` with reasonable `RestartSec` (e.g. 10)
   **And** `systemctl --user enable --now hermes-dashboard.service` succeeds
   **And** `systemctl --user is-active hermes-dashboard.service` → **active**
   **And** `ss -tlnp | grep 9119` (or `curl`) confirms listener on **0.0.0.0:9119**
   **And** `loginctl enable-linger $USER` is set if dashboard must survive logout (match gateway pattern)

4. **Auth gate verification (WSL localhost)**
   **Given** dashboard service running from AC #3
   **When** operator runs:
   ```bash
   curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'
   ```
   **Then** `auth_required` is **`true`**
   **And** `auth_providers` includes **OAuth / Nous** (not basic-auth-only unless fallback path — see AC #7)
   **And** unauthenticated requests do **not** expose config/API keys (gate engaged on non-loopback bind)

5. **Windows host reachability (FR5 — live curl, no assumptions)**
   **Given** WSL dashboard listening on `0.0.0.0:9119`
   **When** operator runs from **Windows** (PowerShell or cmd):
   ```powershell
   curl.exe -s http://localhost:9119/api/status
   ```
   **Or** documents the working URL if mirrored networking uses a different host (WSL IP, hostname)
   **Then** HTTP **200** with JSON body; `auth_required: true` in response
   **And** evidence records the **actual URL** used (default expectation: `http://localhost:9119` when `.wslconfig` has `networkingMode=mirrored`)
   **And** if reachability fails, operator documents diagnosis (firewall, non-mirrored networking, wrong bind) before fallback

6. **Gateway independence preserved (FR4 / NFR2)**
   **Given** dashboard service started
   **When** operator verifies gateway
   **Then** `pgrep -af 'hermes_cli.main gateway'` (or `hermes gateway status`) shows gateway **still running**
   **And** gateway is a **separate process** from dashboard (not replaced or stopped by dashboard install)
   **And** Discord `#hermes` spot check optional but recommended: one short ping or rely on 74-5 evidence if unchanged

7. **Auth path flag + fallback governance (ADR-HERMES-008)**
   **Given** story completion
   **When** operator records outcome
   **Then** evidence and Dev Agent Record include **`auth_path: oauth`** (primary) **or** **`auth_path: basic-auth-fallback`**
   **Primary path:** OAuth register (AC #2) — **default expectation**
   **Fallback only:** if `hermes dashboard register` fails after documented retry (Portal logged in, network OK, CLI v0.17+), operator may set `HERMES_DASHBOARD_BASIC_AUTH_*` in `~/.hermes/.env` per Hermes docs — **trusted WSL localhost only**
   **And** fallback completion **must** cite reason for register failure and link forward to **74-8** governance (never silent basic-auth default)
   **And** **74-7** Desktop AC must match recorded `auth_path`

8. **Evidence + verify gate (NFR1, NFR4)**
   **Given** AC #2–#7 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/74-6-dashboard-oauth-evidence.md` exists with dated checklist (PASS/FAIL per AC, redacted)
   **And** `bash scripts/verify.sh` passes unchanged
   **And** git diff contains **no** secret files (`.env`, `auth.json`, `.env.live-chain`)
   **And** protect-list paths have **zero** diffs (NFR2)

## Tasks / Subtasks

- [x] **AC #1 — Verify prerequisites** (AC: #1)
  - [x] `hermes portal info` → logged in, Nous provider
  - [x] Confirm 74-5 evidence PASS
  - [x] Confirm gateway running baseline

- [x] **AC #2 — OAuth register** (AC: #2)
  - [x] `hermes dashboard register` (after `--help` verification)
  - [x] Confirm `HERMES_DASHBOARD_OAUTH_CLIENT_ID` in `~/.hermes/.env`, mode `0600`
  - [x] Optional `config.yaml` `dashboard.oauth.client_id` mirror

- [x] **AC #3 — systemd unit** (AC: #3)
  - [x] Create `~/.config/systemd/user/hermes-dashboard.service` (template in Dev Notes)
  - [x] `daemon-reload`, `enable --now`, confirm active + port 9119 listening
  - [x] `loginctl enable-linger` if needed

- [x] **AC #4 — WSL auth gate curl** (AC: #4)
  - [x] `curl` `/api/status` → `auth_required: true`, OAuth in providers

- [x] **AC #5 — Windows reachability** (AC: #5)
  - [x] `curl.exe` from Windows host; record actual URL

- [x] **AC #6 — Gateway independence** (AC: #6)
  - [x] `pgrep` gateway separate from dashboard; optional Discord spot check

- [x] **AC #7 — Record auth_path** (AC: #7)
  - [x] Set `auth_path: oauth` or document fallback with reason

- [x] **AC #8 — Evidence + verify** (AC: #8)
  - [x] Complete `74-6-dashboard-oauth-evidence.md`
  - [x] `bash scripts/verify.sh` green; protect-list + secret scan clean

## Dev Notes

### Epic and sequencing context

- **Epic 74 (Hermes on Portal + Desktop)** — story **74-6** implements **FR5** (dashboard service + OAuth + reachability).
- **Prerequisites done:** **74-2** Portal OAuth, **74-5** gateway/digest regression gate.
- **Parallel OK:** **74-4** Tool Gateway web search may still be backlog — does not block dashboard.
- **Blocks:** **74-7** Hermes Desktop live chat (needs reachable dashboard + auth gate).
- **Does not include:** Desktop install, WebSocket chat, full `hermes-desktop.md` governance (**74-7**, **74-8**).
- **Branch:** `hermes-consolidation`.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 74-6, §FR5; `sprint-status.yaml` Epic 74 sequencing]

### Live baseline (verify at story start — do not assume)

| Property | Expected before 74-6 | Verify with |
|----------|----------------------|-------------|
| Portal auth | Logged in | `hermes portal info` |
| Dashboard OAuth client | **Absent** | `grep HERMES_DASHBOARD_OAUTH ~/.hermes/.env` |
| Port 9119 | **Not listening** | `ss -tlnp \| grep 9119` |
| `hermes-dashboard.service` | **Absent** | `systemctl --user status hermes-dashboard` |
| Gateway | Running (independent) | `pgrep -af 'hermes_cli.main gateway'` |
| Hermes CLI | v0.17+ | `hermes --version` |
| WSL networking | Mirrored (expected) | `.wslconfig` → `networkingMode=mirrored` |
| verify.sh | Green | `bash scripts/verify.sh` |

### Operator runbook (canonical OAuth path)

```bash
# 0. Repo + preflight
cd /home/christ/ai-factory/projects/Omnipotent.md
hermes --version                    # expect v0.17.x+
hermes portal info                  # logged in, Nous provider
pgrep -af 'hermes_cli.main gateway' # gateway baseline PID

# 1. Verify CLI surface (do not skip — flags drift)
hermes dashboard --help
hermes dashboard register --help

# 2. Register OAuth client (requires Portal login from 74-2)
hermes dashboard register
# Expect: writes HERMES_DASHBOARD_OAUTH_CLIENT_ID to ~/.hermes/.env
ls -la ~/.hermes/.env               # mode 0600
grep '^HERMES_DASHBOARD_OAUTH_CLIENT_ID=' ~/.hermes/.env  # redact value in evidence

# 3. Optional config.yaml mirror (ADR-HERMES-008)
# dashboard:
#   oauth:
#     client_id: <same as env>

# 4. Create systemd user unit (see template below)
mkdir -p ~/.config/systemd/user
# write hermes-dashboard.service
systemctl --user daemon-reload
systemctl --user enable --now hermes-dashboard.service
systemctl --user status hermes-dashboard.service

# 5. WSL verification
ss -tlnp | grep 9119
curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'

# 6. Gateway still independent
pgrep -af 'hermes_cli.main gateway'
pgrep -af 'hermes_cli.main dashboard'

# 7. Windows reachability (run on Windows host — not WSL)
# curl.exe -s http://localhost:9119/api/status

# 8. Verify gate
bash scripts/verify.sh
```

[Source: Context7 `/nousresearch/hermes-agent` — web-dashboard.md; ADR-HERMES-008]

### systemd unit template (match live gateway venv path)

```ini
# ~/.config/systemd/user/hermes-dashboard.service
[Unit]
Description=Hermes Agent Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=%h/.hermes/.env
WorkingDirectory=%h/.hermes
ExecStart=%h/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main dashboard \
    --no-open --host 0.0.0.0 --port 9119 --skip-build
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now hermes-dashboard.service
loginctl enable-linger "$USER"   # if not already set for hermes-gateway
journalctl --user -u hermes-dashboard -f   # debug startup failures
```

**Contrast with gateway unit:** gateway uses `Restart=always`; dashboard per FR5 uses **`Restart=on-failure`** (epic AC). Do **not** conflate the two services.

[Source: live `~/.config/systemd/user/hermes-gateway.service`; `architecture-hermes-consolidation.md` ADR-HERMES-008]

### OAuth bind semantics (v0.17 — Context7 verified)

- Binding `--host 0.0.0.0` engages the **auth gate** on non-loopback addresses.
- Without `HERMES_DASHBOARD_OAUTH_CLIENT_ID` (or `dashboard.oauth.client_id`), dashboard **refuses** to bind to `0.0.0.0`.
- **`--insecure`** skips the auth gate — **forbidden** for this story (operator trusted network still requires OAuth per ADR-HERMES-008).
- `--skip-build` serves pre-built `web/dist` — required for headless/systemd (no npm in service context).

[Source: Context7 `/nousresearch/hermes-agent` — web-dashboard.md OAuth gate error text]

### Gateway ≠ Dashboard (conceptual — do not break Discord)

| Process | CLI | Purpose | This story |
|---------|-----|---------|------------|
| **Gateway** | `hermes gateway run` | Discord/Telegram messaging | **Observe only** — must stay running |
| **Dashboard** | `hermes dashboard` | Desktop backend, web admin, `/api/ws` chat API | **Install + enable** |

Both share `~/.hermes/` config but are **separate processes**. Starting dashboard must **not** stop gateway.

[Source: `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` §Critical conceptual clarification]

### Windows reachability troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| WSL `curl 127.0.0.1:9119` works; Windows fails | Non-mirrored networking | Check `.wslconfig`; try WSL IP `$(hostname -I \| awk '{print $1}')` |
| Dashboard refuses start | OAuth client missing | Run `hermes dashboard register` first |
| `auth_providers` shows only `basic` | Fell through to fallback | Retry OAuth register; do not silently accept |
| Port in use | Stale dashboard process | `hermes dashboard --stop` then restart systemd |
| Service crash loop | Missing `web/dist` | Pre-build: `cd ~/.hermes/hermes-agent/web && npm run build` once, then `--skip-build` |

**Document actual URL in evidence** — 74-7 Desktop settings depend on it.

[Source: `prd-hermes-consolidation.md` §FR5 live curl test; `implementation-readiness-report-2026-06-24.md`]

### Basic-auth fallback runbook (AC #7 only — not default)

Use **only** if `hermes dashboard register` fails after retry with Portal logged in:

```bash
# Append to ~/.hermes/.env (mode 0600) — TRUSTED LOCALHOST ONLY
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=admin
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=<strong-password>
HERMES_DASHBOARD_BASIC_AUTH_SECRET=<openssl rand -base64 32>
systemctl --user restart hermes-dashboard.service
```

Record **`auth_path: basic-auth-fallback`** + failure reason. **74-7** Desktop sign-in uses basic-auth credentials instead of OAuth. Full governance in **74-8**.

**Supersedes:** `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` and `06-implementation-sequence.md` Phase 2 steps 1–5 which show basic-auth-first — **ADR-HERMES-008 OAuth is primary**.

### Explicitly out of scope (defer)

| Action | Story |
|--------|-------|
| Hermes Desktop install + WebSocket chat | 74-7 |
| Full `hermes-desktop.md` + routing reconciliation | 74-8 |
| `hermes tools` → Web search = Nous Subscription | 74-4 |
| `/session-close` orientation refresh | 76-1 |
| Run-chain / Brain / Vault IO code | Protect-list |
| NEXUS bridge changes | **Forbidden** (NFR2) |
| Optional dashboard watchdog cron | Ops follow-up (not AC) |

### Architecture compliance

- **FR5:** Dashboard systemd + OAuth + Windows reachability.
- **ADR-HERMES-008:** OAuth primary; basic-auth fallback documented only on failure.
- **FR4 / NFR2:** Gateway independent; no protect-list edits.
- **NFR4:** Secrets in `~/.hermes/.env` / `auth.json` only; evidence redacts values.
- **NFR1:** `verify.sh` must pass; **no new automated tests** (operator verification story).
- **NFR8:** Two-bot boundary unchanged — dashboard does not touch NEXUS bridge.
- **WriteGate:** Do **not** edit `AI-Context/AGENTS.md`; governance doc updates deferred to **74-8** (except fallback cross-reference in evidence).

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` ADR-HERMES-008; `prd-hermes-consolidation.md` §FR5]

### CNS vault contract cite

This story performs **no Vault IO mutations**. Hermes dashboard reads `~/.hermes/` only. Vault MCP WriteGate unaffected.

[Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — no mutator paths engaged]

### Testing requirements

| Layer | Expectation |
|-------|-------------|
| Automated | `bash scripts/verify.sh` — must pass unchanged |
| Manual | AC #2–#7 operator checklist → evidence file |
| Git | No secret files; protect-list clean; evidence markdown + sprint-status only |
| Regression | Gateway still running; 74-5 FR4 preservation not regressed |

### Completion deliverables

| Deliverable | Path |
|-------------|------|
| Operator evidence | `_bmad-output/implementation-artifacts/74-6-dashboard-oauth-evidence.md` (new) |
| systemd unit | `~/.config/systemd/user/hermes-dashboard.service` (operator home — not in repo) |
| Env var | `~/.hermes/.env` → `HERMES_DASHBOARD_OAUTH_CLIENT_ID` (not in repo) |
| Tracker | `sprint-status.yaml` — story `done` after dev-story |
| **auth_path** | Recorded in evidence + Dev Agent Record |

### Evidence file template (create at dev-story start)

```markdown
# Story 74-6 — Dashboard OAuth + systemd + Reachability Evidence

**Story:** 74-6-hermes-dashboard-oauth-registration-systemd-and-reachability
**Operator:** Chris
**Date completed:** YYYY-MM-DD
**Hermes version:** (from hermes --version)
**auth_path:** oauth | basic-auth-fallback

> Redaction policy (NFR4): no tokens, passwords, or full client_id values.

## AC #1 Prerequisites — PASS/FAIL
(portal info, 74-5 reference)

## AC #2 OAuth register — PASS/FAIL
(register stdout redacted; .env mode 0600 confirmed)

## AC #3 systemd — PASS/FAIL
(systemctl status, ss/curl port check)

## AC #4 Auth gate (WSL) — PASS/FAIL
(curl /api/status jq output)

## AC #5 Windows reachability — PASS/FAIL
(actual URL used, curl.exe output summary)

## AC #6 Gateway independence — PASS/FAIL
(gateway pgrep, dashboard pgrep — distinct PIDs)

## AC #7 auth_path — oauth | basic-auth-fallback
(fallback reason if applicable)

## AC #8 verify.sh — PASS/FAIL
```

### Previous story intelligence (74-5)

- FR4 regression gate **done** 2026-06-24; Discord `portal-regression-ok` exact match.
- Gateway running via systemd; digest cron path documented; NEXUS hands-off.
- **74-6 should not re-run full 74-5** unless gateway stopped during dashboard install.

[Source: `_bmad-output/implementation-artifacts/74-5-gateway-and-morning-digest-regression-gate.md`]

### Previous story intelligence (74-2)

- Portal OAuth 2026-06-24; Pre-4 paid tier + Tool Gateway confirmed.
- `hermes portal info` baseline; `auth.json` mode 0600; nous/Sonnet 4.6 primary.
- WSL OAuth: `--manual-paste` when loopback fails.

[Source: `_bmad-output/implementation-artifacts/74-2-portal-oauth-login-and-provider-switch.md`]

### Previous story intelligence (74-3)

- Compression on Portal Haiku; unrelated to dashboard but confirms Portal stack healthy.

[Source: `_bmad-output/implementation-artifacts/74-3-auxiliary-compression-on-portal.md`]

### Git intelligence (hermes-consolidation branch)

Recent commits: **74-5** regression gate, **74-3** compression, **74-2** Portal OAuth. Expect **evidence markdown + sprint-status** as repo diffs only; Hermes state under `~/.hermes/` (gitignored).

### Latest technical specifics (Context7 — Hermes Agent v0.17)

- **Register:** `hermes dashboard register` → writes `HERMES_DASHBOARD_OAUTH_CLIENT_ID` to `~/.hermes/.env`
- **Start:** `hermes dashboard --host 0.0.0.0 --port 9119 --no-open --skip-build`
- **Status:** `curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'`
- **Stop/list:** `hermes dashboard --stop` / `--status`
- **No `hermes dashboard install`** — manual systemd unit required (unlike gateway installer)

[Source: Context7 `/nousresearch/hermes-agent` — web-dashboard.md, desktop.md]

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (no edits this story)
- PRD FR5: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR5
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` ADR-HERMES-008
- Desktop architecture: `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` (note OAuth supersedes basic-auth-first)
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15

### Deferred work cross-reference

- Dashboard **visual redesign** intentionally deferred (not Epic 74 scope).
- Pre-2 session-close remains **76-1** — not a 74-6 gate.

[Source: `_bmad-output/implementation-artifacts/deferred-work.md` §Parked initiative Dashboard UX]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor dev-story)

### Debug Log References

- Story prep 2026-06-24: evidence scaffold + read-only AC #1 pre-checks; paused for operator CLI (AC #2–#7).
- Operator close 2026-06-24: AC #2–#7 PASS; `auth_path: oauth`; gateway/dashboard separate PIDs (837348 / 3479017).
- venv path verified: `/home/christ/.hermes/hermes-agent/venv/bin/python` exists (matches live `hermes-gateway.service` ExecStart).

### Completion Notes List

- Prep complete: `74-6-dashboard-oauth-evidence.md` scaffolded (2026-06-24).
- AC #1 PASS: portal logged in, nous/Sonnet 4.6, 74-5 FR4 evidence, gateway running.
- AC #2 PASS: OAuth register — dashboard `quiet_ibex`; `HERMES_DASHBOARD_OAUTH_CLIENT_ID` in `.env` mode 0600.
- AC #3 PASS: `hermes-dashboard.service` active; listening `0.0.0.0:9119` (PID 3479017); `Restart=on-failure`.
- AC #4 PASS: WSL curl — `auth_required: true`, `auth_providers: ["nous"]`.
- AC #5 PASS: Windows `curl.exe` — `http://localhost:9119/api/status` (mirrored networking).
- AC #6 PASS: Gateway PID 837348 independent from dashboard PID 3479017.
- AC #7 PASS: `auth_path: oauth`.
- AC #8 PASS: verify.sh green; no secrets or protect-list diffs.
- **74-7 handoff:** Desktop URL `http://localhost:9119` (Windows) / `http://127.0.0.1:9119` (WSL).

### File List

- `_bmad-output/implementation-artifacts/74-6-dashboard-oauth-evidence.md` (operator evidence)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (74-6 done)
- `_bmad-output/implementation-artifacts/74-6-hermes-dashboard-oauth-registration-systemd-and-reachability.md` (story tracking)

### Change Log

- 2026-06-24: Dev-story prep — evidence scaffold + read-only prerequisite verification; paused for operator CLI (AC #2–#7).
- 2026-06-24: Operator close — dashboard OAuth + systemd + reachability; story done.

## Story completion status

- **Status:** done
- **Context engine:** Ultimate context analysis completed — OAuth register runbook, systemd template, Windows reachability gate, gateway independence checks, auth_path flag, and ADR-HERMES-008 fallback rules included.
- **Next story after done:** `74-7-hermes-desktop-live-chat-connection`
