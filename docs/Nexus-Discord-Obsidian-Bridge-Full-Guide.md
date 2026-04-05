---
title: Nexus Discord + Obsidian Bridge — Full Guide
date: 2026-03-30
tags:
  - nexus
  - discord
  - obsidian
  - claude-code
  - wsl
  - automation
status: active
source: Cursor
canonical_ssot: true
---

# Nexus Discord + Obsidian Bridge — Full Guide

> [!info] Canonical vault runbook (single source of truth)
> Use **this note** end-to-end to replicate Nexus (Discord bridge + Obsidian vault) on a new machine. The NEXUS git repo runbook mirrors it for engineering: `docs/# PROJECT: NEXUS DISCORD-OBSIDIAN BRIDGE.md` in the NEXUS repo.
>
> **Supersedes for replication:** informal drafts such as [[Gemini First try setting up the Nexus]] (historical / mixed accuracy) and the old handshake checklist in [[PROJECT_NEXUS DISCORD-OBSIDIAN BRIDGE]] (the project card now defers to this note).

> [!abstract] Executive summary
> Nexus is not a Discord-hosted bot. Nexus is a **Claude Code** process running inside **tmux** (in WSL2), connected to Discord via the official Discord plugin. When messages arrive, Claude reads/writes your **Windows Obsidian vault** directly. Reliability comes from:
>
> 1. A canonical launcher script (`scripts/nexus-discord-bridge.sh`) that starts Claude correctly (vault path + flags).
> 2. A watchdog (`scripts/nexus-discord-bridge-watchdog.sh`) run every ~3 minutes (cron or scheduler) that restarts the bridge if it died.
> 3. A trust-guard (`scripts/nexus-discord-trust-guard.sh`) that clears common blocking UI prompts inside the tmux pane.

---

## Replication checklist (A–Z)

Follow in order on a **new Windows + WSL2** setup (adjust paths if your Windows username or vault folder name differs).

| Step | What to do |
| ---- | ------------ |
| **A** | **WSL2 networking:** In Windows, edit `%USERPROFILE%\.wslconfig` so `[wsl2]` includes `networkingMode=mirrored` (and optional memory/cpu as you like). In **PowerShell**: `wsl --shutdown`, then reopen WSL. If gateway/WebSocket to Discord fails without this, mirrored mode is the usual fix. |
| **B** | **Discord application:** [Discord Developer Portal](https://discord.com/developers/applications) → New Application → name it (e.g. Nexus) → **Bot** → add bot, **Reset Token**, copy token once. |
| **C** | **Privileged intents:** On the Bot page, enable **Presence Intent** and **Message Content Intent**, then click **Save Changes**. |
| **D** | **Token on disk (WSL):** `mkdir -p ~/.claude/channels/discord`. Create `~/.claude/channels/discord/.env` with exactly: `DISCORD_BOT_TOKEN=your_token_here` (no quotes around the token; one line). `chmod 600 ~/.claude/channels/discord/.env`. Ensure the file is owned by your user, not `root`. |
| **E** | **Claude Code + plugin:** In an interactive Claude Code session you will use the same machine: `/plugin install discord@claude-plugins-official` and `/discord:configure <token>` *or* rely on `.env` above — never commit the token to git. |
| **F** | **Vault paths:** Know both: Windows `C:\Users\Christopher Taylor\Knowledge-Vault-ACTIVE` and WSL `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`. The launcher `cd`s to the **physical** `/mnt/c/...` path so workspace trust matches `~/.claude.json`. |
| **G** | **Clone / have NEXUS repo:** Scripts live at `/home/christ/ai-factory/projects/NEXUS` (or your clone path). |
| **H** | **Start the bridge (canonical):** From WSL: `bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --detach` (after `--kill` if replacing a session). **Do not** use a raw one-liner `tmux ... claude --channels` without the launcher — you need vault `cd`, `nexus-global`, and `--permission-mode bypassPermissions`. |
| **I** | **Workspace trust (first time):** If prompted, `tmux attach -t nexus-global`, choose **Yes** for trusting the vault folder, wait until you see `Listening for channel messages from: plugin:discord@claude-plugins-official`, then `Ctrl+b` `d` to detach. |
| **J** | **Pairing / allowlist:** DM the bot from Discord; complete pairing per plugin instructions (e.g. `/discord:access` with the code). If you see `channel … is not allowlisted`, fix with `/discord:access` (do not approve strangers from chat). |
| **K** | **Verify:** `tmux list-sessions` shows `nexus-global`; `pgrep -af 'claude.*--channels.*plugin:discord'` shows the process; Discord shows the bot online (green) while the process runs. |
| **L** | **Automation:** Install cron (or Windows Task Scheduler) so `nexus-discord-bridge-watchdog.sh` runs about every **3 minutes**; confirm `crontab -l` and `systemctl is-active cron`. Optional: `nexus-windows-keepalive.cmd` for logon/repeat triggers. See repo `docs/nexus-crontab.example` and runbook §10–11. |
| **M** | **Smoke test:** Send `ping` in the allowlisted DM/channel; if **green + typing** but no reply, attach to tmux and clear trust/plan/edit prompts (or trust-guard logs). |

**Repo engineering detail** (scripts, channel IDs, Windows scheduler): NEXUS repo `docs/# PROJECT: NEXUS DISCORD-OBSIDIAN BRIDGE.md`.

---

## Overview (the mental model)
Nexus = Discord -> plugin -> Claude Code (tmux) -> Obsidian vault.

```mermaid
flowchart LR
  Discord[Discord DMs] --> Plugin[Discord plugin]
  Plugin --> Claude[Claude Code (tmux session)]
  Claude --> Vault[Obsidian vault (Windows path)]
```

### What "green" really means
Discord "green/online" is only as good as your **local** Claude Code process being connected to Discord's gateway.

### The single source of truth (repo scripts)
These scripts implement the actual behavior you are documenting:
- `scripts/nexus-discord-bridge.sh` (canonical launcher)
- `scripts/nexus-discord-bridge-watchdog.sh` (watchdog; typically via cron)
- `scripts/nexus-discord-trust-guard.sh` (auto-clear blocking prompts via tmux)
- `scripts/nexus-windows-keepalive.cmd` (Windows Task Scheduler helper)

Repo root for those scripts:
- `/home/christ/ai-factory/projects/NEXUS`

---

## Prerequisites (before you do anything)
1. You can access your vault in Windows and in WSL:
   - Windows: `C:\Users\Christopher Taylor\Knowledge-Vault-ACTIVE`
   - WSL: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`
2. Your Discord plugin token is stored locally for Claude:
   - `~/.claude/channels/discord/.env`
   - Must contain: `DISCORD_BOT_TOKEN=...`
   - Must be readable only by your user (mode `600`).
3. You have allowlisted the channel(s) you will DM from:
   - via `/discord:access` inside Claude

---

## Quickstart (5-15 minutes to "bot works")

### Step 1: Start (or restart) the bridge
From WSL (recommended):
```bash
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --kill
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --detach
```

What the launcher does (so you know what to expect):
- Uses tmux session name: `nexus-global` (override with `NEXUS_TMUX_SESSION`)
- Uses the physical vault path: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` (override with `NEXUS_VAULT_DIR`)
- Starts Claude with:
  - `--dangerously-skip-permissions`
  - `--permission-mode bypassPermissions`
  - `--channels plugin:discord@claude-plugins-official` (override with `NEXUS_DISCORD_PLUGIN`)

Expected observations:
- `tmux attach -t nexus-global` should show a live Claude session (not a dead/stale one)
- after a short moment, Discord should be "green" (gateway connected)

### Step 2: Verify tmux session exists
```bash
tmux list-sessions | rg "nexus-global"
```
Expected:
- You see `nexus-global` in the output.

### Step 3: Verify the bridge process is running
```bash
pgrep -af 'claude.*--channels.*plugin:discord'
```
Expected:
- one (or a small number of) `claude` lines connected to `plugin:discord`

### Step 4: Verify watchdog is installed (cron path)
Check that cron runs the watchdog every 3 minutes:
```bash
crontab -l | rg nexus-discord-bridge-watchdog.sh
```
Expected:
- a line containing `*/3 * * * * ... nexus-discord-bridge-watchdog.sh`

Then check cron daemon is active:
```bash
systemctl is-active cron
```
Expected:
- `active`

### Step 5: Smoke-test Discord
1. In Discord, DM the bot (or the allowlisted channel flow) with: `ping`
2. Watch Discord for typing, then a reply.

If no reply:
- follow the troubleshooting decision tree below.

---

## Reliability design (how it avoids getting stuck)

### Watchdog behavior
The watchdog is intended for cron (or Windows Task Scheduler calling into WSL):
- runs trust-guard twice
- if Claude is missing, it kills stale tmux session and restarts the bridge
- logs to:
  - `~/.local/share/nexus-bridge/watchdog.log`
  - `~/.local/share/nexus-bridge/cron.log`

### Trust-guard behavior
The trust-guard:
- captures tmux pane scrollback (up to `NEXUS_TRUST_GUARD_SCROLL` lines, default `1200`)
- detects common blocker text (trust / plan / edit approvals)
- sends `Escape` then `Enter` into tmux
- repeats for up to `NEXUS_TRUST_GUARD_PASSES` passes (default `3`)
- logs to:
  - `~/.local/share/nexus-bridge/trust-guard.log`

---

## Secrets + Safety (what is safe, what is risky)

### Token storage (do this)
Store your Discord bot token only here:
- `~/.claude/channels/discord/.env`

With content shape:
```text
DISCORD_BOT_TOKEN=YOUR_TOKEN_HERE
```

Permissions:
- `chmod 600 ~/.claude/channels/discord/.env`
- ensure ownership is your user, not `root`

### Never embed secrets in the vault
Do not paste the token string into Obsidian notes.
If a token ever appears in chat or a repo, rotate it in the Discord Developer Portal.

### Allowlist safety (the "channel is not allowlisted" symptom)
Nexus only replies to allowlisted channels. If you open a new DM thread and see:
- `channel ... is not allowlisted`

Fix:
- run `/discord:access` in Claude
- or edit `~/.claude/channels/discord/access.json` (advanced; do only if you already know what you are changing)

### Why `--dangerously-skip-permissions` is used
Those flags are used to reduce interactive prompt wedging from Discord-driven edits (the exact UI path where you might otherwise see "approve this edit?" or plan gates that stall the run).

Tradeoff:
- You reduce interactive friction, so you must keep this setup constrained to your trusted machine + trusted vault.

---

## Troubleshooting decision tree (symptom -> likely cause -> fastest fix)

### Symptom A: Bot is "grey" / offline
Likely causes:
- WSL stopped (or you never restarted after reboot)
- PC slept / hibernated
- `claude` process crashed or tmux got killed

Fastest fix:
```bash
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --detach
```
If still broken:
```bash
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --kill
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --detach
```

Deeper checks:
1. tmux session exists: `tmux list-sessions | rg nexus-global`
2. bridge process exists: `pgrep -af 'claude.*--channels.*plugin:discord'`
3. watchdog is running via cron:
   - `crontab -l` contains the `*/3` line
   - `systemctl is-active cron`
4. watchdog logs:
   - `tail -n 50 ~/.local/share/nexus-bridge/watchdog.log`
   - `tail -n 50 ~/.local/share/nexus-bridge/cron.log`

### Symptom B: Bot shows "green" + typing, then silence
Likely causes:
- A trust/plan/edit prompt is stuck inside the tmux pane (trust-guard did not clear it or the UI changed)

Fastest fix (human intervention, minimal):
```bash
tmux attach -t nexus-global
```
Then look at the bottom/options in the tmux UI and select the highlighted "Yes/Proceed" choice.

Alternative fix (script-assisted):
```bash
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-trust-guard.sh
```

Deeper checks:
1. Confirm trust-guard log is updating:
   - `tail -n 50 ~/.local/share/nexus-bridge/trust-guard.log`
2. If blockers persist, the UI strings may have changed; update trust-guard logic in the NEXUS repo.

### Symptom C: No reply + allowlist / permissions error
Likely cause:
- Channel/thread is not allowlisted

Fastest fix:
- run `/discord:access` in Claude, then retry the DM

Deeper checks:
- ensure `~/.claude/channels/discord/access.json` is being used by the running Claude session

### Symptom D: tmux session exists, claude runs, but Discord never responds correctly
Likely causes:
- Discord gateway connectivity issues (WSL networking configuration)
- incorrect plugin identifier or missing token in `.env`

Fastest fix:
1. Confirm token file exists:
   - `ls -l ~/.claude/channels/discord/.env`
2. Restart bridge:
```bash
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --kill
bash /home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --detach
```

Deeper checks:
- verify you are in the intended WSL networking mode (mirrored), if you have seen gateway drop issues before
- check watchdog logs for restart loops

---

## Verification / Health checks (paste-able)

### 1) One-shot health command block
Run in WSL:
```bash
echo "== tmux sessions =="; tmux list-sessions | rg nexus-global || echo "MISSING"
echo "== claude process =="; pgrep -af 'claude.*--channels.*plugin:discord' || echo "MISSING"
echo "== cron watchdog line =="; crontab -l | rg nexus-discord-bridge-watchdog.sh || echo "MISSING"
echo "== cron.log tail =="; tail -n 5 ~/.local/share/nexus-bridge/cron.log 2>/dev/null || true
echo "== watchdog.log tail =="; tail -n 20 ~/.local/share/nexus-bridge/watchdog.log 2>/dev/null || true
echo "== trust-guard.log tail =="; tail -n 20 ~/.local/share/nexus-bridge/trust-guard.log 2>/dev/null || true
```

### 2) What "healthy" looks like
- `tmux list-sessions` includes `nexus-global`
- `pgrep` finds a `claude ... --channels plugin:discord ...` process
- `crontab -l` includes the `*/3` watchdog line
- `cron.log` and `watchdog.log` show watchdog cycles
- `trust-guard.log` shows occasional "finished up" or "Escape+Enter" entries when prompts occur

---

## Where Nexus fits in your universal setup
Nexus is a specialization of your "Obsidian + Claude Code as a Personal OS":
- Your vault is the working set.
- Claude Code is the execution layer.
- Discord is the input/output surface.

Links:
- Universal personal OS: `[[Obsidian-Claude-Code-Personal-OS]]`
- Shared brain architecture: `[[AI-Shared-Brain-Architecture]]`
- Nexus landing page: `[[Nexus-Discord-Obsidian-Bridge-Operator-Guide]]`

---

## Notes (important limits)
- Not 24/7 on a sleeping laptop: if your machine sleeps, WSL processes sleep too.
- The plugin UI can change: if trust-guard stops clearing prompts, update the script behavior in the NEXUS repo.

