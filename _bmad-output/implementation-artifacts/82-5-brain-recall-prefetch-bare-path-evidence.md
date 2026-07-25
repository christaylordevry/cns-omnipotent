# Story 82-5 — Brain-recall prefetch bare-PATH + dashboard env evidence

**Date:** 2026-06-30  
**Story:** `82-5-brain-recall-prefetch-bare-path-dashboard-env`

## AC1 — Prefetch resolves toolchain without ambient PATH

**Automated (PASS):** `tests/hermes/cns-brain-recall-plugin.test.ts` → `brain-recall-prefetch.mjs succeeds with PATH=/usr/bin:/bin when CNS_NODE_BIN is set`

- Invokes wrapper via `process.execPath` (mirrors plugin `cmd = [node_bin, script, ...]`)
- `CNS_NODE_BIN` → resolves `node_modules/.bin/tsx` via absolute node path (no `npx` on bare PATH)
- Review hardening: newest nvm fallback is version-aware, child PATH prepends node bin by component match only, and last-resort relative `node` no longer adds `.` to PATH.
- Exit 0, JSON stdout with citations

## AC2 — Dashboard systemd drop-ins

**Install (PASS):**

```bash
bash scripts/install-hermes-brain-recall-env.sh
systemctl --user daemon-reload
systemctl --user restart hermes-dashboard.service
```

Created:

- `~/.config/systemd/user/hermes-dashboard.service.d/brain-recall.conf`
- `~/.config/systemd/user/hermes-dashboard.service.d/env.conf`

Gateway drop-ins already present — install script skipped (idempotent).

Review hardening:

- Existing but invalid `brain-recall.conf` / `env.conf` are refreshed instead of trusted.
- `brain-recall.env` values are shell-quoted, including `CNS_VAULT_ROOT` with spaces, so `hermes-dashboard-start.sh` can source the file.
- Install test uses an isolated fake HOME/NVM tree and proves `sort -V`-style newest-node behavior without depending on the operator's real NVM install.

## AC2 — Dashboard process environ (PASS)

```text
systemctl --user is-active hermes-dashboard.service → active
PID=2408205 (post-restart 2026-06-30)

CNS_BRAIN_INDEX_PATH=/home/christ/.hermes/brain/brain-index.json
CNS_NODE_BIN=/home/christ/.nvm/versions/node/v24.14.0/bin/node
PATH=/home/christ/.nvm/versions/node/v24.14.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

PATH nvm segment from `env.conf` (not `brain-recall.env`). `brain-recall.env` unchanged — no `PATH=` line.

## AC3 / AC4 — Tests + verify gate

- `npm run test:vitest -- tests/hermes/cns-brain-recall-plugin.test.ts` — brain recall suite green (22 tests incl. 82-5 bare-PATH, resolver hardening, install drop-in smoke)
- `bash scripts/verify.sh` — all unit tests pass; **pre-existing** `session-close` Hermes skill parity drift fails gate (documented story waiver AC6)

## AC5 — Live voice turn (operator follow-up)

**Prefetch path under dashboard CNS env (partial):**

Simulated `recall_hook` with `CNS_*` vars loaded from dashboard `/proc/<pid>/environ`, isolated `HERMES_HOME`, `sessions.source=nexus-voice`:

- Prefetch subprocess launched (no `npx` ENOENT)
- Sidecar file written at `{HERMES_HOME}/recall-status/<session_id>.json` (previously missing on dashboard turns)
- Live portal embedder hit 3s `voice_pane` timeout on this probe query — environmental; not bare-PATH regression

**Operator PTT smoke (pending manual before closeout):**

1. Open `http://localhost:5173/nexus` → VoiceDrawer PTT
2. Confirm `~/.hermes/recall-status/<session_id>.json` with `channel=voice_pane`, `injected=true`
3. VoiceDrawer budget chip shows `voice_pane` (not `degraded`)

## AC6 — Protect-list

No edits to protect-list adapter files or Hermes core. Context7 `/nousresearch/hermes-agent` consulted for dashboard `EnvironmentFile` + `hermes dashboard` launch pattern.

## Redacted env keys

Evidence uses paths only; no API keys or OAuth secrets recorded.
