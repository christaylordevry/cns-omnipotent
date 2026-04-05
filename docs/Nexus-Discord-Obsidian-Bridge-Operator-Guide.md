---
title: Nexus Discord + Obsidian Bridge — Operator Guide
date: 2026-03-29
tags:
  - nexus
  - discord
  - obsidian
  - claude-code
  - wsl
  - automation
status: active
source: Cursor
---

# Nexus Discord + Obsidian Bridge — Operator Guide

> [!abstract] Executive summary
> **Nexus** is your Discord bot, but it does **not** run on Discord’s servers. It is **Claude Code** on your **Windows PC**, inside **WSL2 Ubuntu**, inside a **tmux** session, with the **official Discord plugin**. The bot is “green” only while that process is connected. **Cron** runs a **watchdog** every **3 minutes** to clear stuck menus (trust / plan / edit) and restart the bridge if it died. This note is the single place to learn how it works, how to keep it working, and how to fix it.

## Choose your path
This note is the operational “landing page” (fast answers + commands).

For the full verbose setup + troubleshooting playbook (setup/quickstart, secrets/safety, decision-tree troubleshooting, verification/health checks), use:
- `[[Nexus-Discord-Obsidian-Bridge-Full-Guide]]` — **canonical vault SSOT** for A–Z replication (supersedes informal drafts).

## Overview

You use Nexus to **DM Claude** so it can **read and write** your Obsidian vault on Windows. The vault path is:

| Where | Path |
| ----- | ---- |
| Windows (Obsidian app) | `C:\Users\Christopher Taylor\Knowledge-Vault-ACTIVE` |
| WSL (direct) | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` |
| WSL shortcut | `~/vault` → symlink to the folder above |

The NEXUS git repo (AI Software Factory template + scripts) lives at:

`/home/christ/ai-factory/projects/NEXUS`

Canonical runbook in the repo (engineering detail): `docs/# PROJECT: NEXUS DISCORD-OBSIDIAN BRIDGE.md`

## Key facts (how it works)

### Stack

```mermaid
flowchart LR
  Discord[Discord_DMs]
  Plugin[Discord_plugin_bun]
  ClaudeProc[claude_channels_tmux]
  Vault[Knowledge-Vault-ACTIVE]
  Discord --> Plugin
  Plugin --> ClaudeProc
  ClaudeProc --> Vault
```

1. **Discord** → messages hit the plugin.
2. **Claude Code** (`claude --channels plugin:discord@claude-plugins-official`) runs in **tmux** session **`nexus-global`** so it has a TTY.
3. File tools use the vault as cwd (launcher `cd`s to the **physical** `/mnt/c/...` path).

### Launcher flags (why they matter)

The script [`nexus-discord-bridge.sh`](file:///home/christ/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh) starts:

- `--dangerously-skip-permissions`
- `--permission-mode bypassPermissions`

Together they reduce **interactive** “approve this edit?” / plan gates that used to wedge Discord (**green + typing, no message**).

### Automation (keep-alive)

| Piece | Path / command | Role |
| ----- | ---------------- | ---- |
| **Watchdog** | `…/NEXUS/scripts/nexus-discord-bridge-watchdog.sh` | Runs trust-guard twice; restarts bridge if `claude --channels` is missing |
| **Trust-guard** | `…/NEXUS/scripts/nexus-discord-trust-guard.sh` | Reads tmux scrollback; **Escape** then **Enter** for trust / plan / edit prompts (up to 3 passes) |
| **Cron** | `crontab -l` | `*/3 * * * *` → watchdog + append to `~/.local/share/nexus-bridge/cron.log` |
| **Windows optional** | `…/NEXUS/scripts/nexus-windows-keepalive.cmd` | Task Scheduler can call this if you prefer Windows-side triggers |

### Secrets and access

- **Bot token:** `~/.claude/channels/discord/.env` → `DISCORD_BOT_TOKEN=…` (mode `600`, your user — not `root`).
- **Allowlist:** If you see `channel … is not allowlisted`, fix with `/discord:access` or `~/.claude/channels/discord/access.json` (new DM channel IDs need to be allowed).

### Shell aliases (if present in `~/.zshrc`)

- `nexus-bridge` → launcher
- `nexus-watchdog` / `nexus-keepalive` → watchdog
- `nexus-trust-guard` → trust-guard only

## Daily operation (what you actually do)

1. **Nothing**, if the PC is on, WSL is up, and cron is installed — the watchdog runs every 3 minutes.
2. After **reboot**, if the bot is grey: open a WSL terminal and run:
   ```bash
   bash ~/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --detach
   ```
   Or: `nexus-bridge --detach`
3. **Power:** if the laptop **sleeps**, the bot goes grey until the machine wakes and WSL runs again.

## First-time / recovery checklist

1. **Verify cron:** `crontab -l` shows the `*/3 * * * *` line pointing at `nexus-discord-bridge-watchdog.sh`.
2. **Verify cron daemon:** `systemctl is-active cron` → `active`.
3. **Verify process:** `pgrep -af 'claude --channels.*plugin:discord'` shows one line with `--permission-mode bypassPermissions`.
4. **Verify tmux:** `tmux list-sessions` includes `nexus-global`.
5. **Verify logs (recent activity):**
   - `tail ~/.local/share/nexus-bridge/cron.log`
   - `tail ~/.local/share/nexus-bridge/watchdog.log`
6. **Discord smoke test:** DM **ping**; you should get a reply. If not, `tmux attach -t nexus-global` and look for a menu at the bottom.

## Troubleshooting

| Symptom | Likely cause | What to do |
| ------- | ------------- | ----------- |
| Bot **grey** | WSL off, PC asleep, or `claude` crashed | Wake PC; open WSL; run `nexus-bridge --detach`; wait for cron or run `nexus-watchdog` |
| **Green**, **typing**, then **silence** | Stuck on trust / plan / edit in tmux | Wait ≤3 min for trust-guard **or** `tmux attach -t nexus-global` and press **Enter** on the highlighted Yes **or** run `nexus-trust-guard` |
| **No reply**, error about allowlist | New DM / channel id | `/discord:access` or edit `access.json` |
| Old behavior after you “fixed” scripts | Process never restarted | `nexus-bridge --kill && nexus-bridge --detach` |

### Hard restart (when you are OK interrupting the bot)

```bash
bash ~/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --kill
bash ~/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh --detach
```

## Contrarian / limits

- **Not 24/7 on a sleeping laptop:** If the hardware is off or suspended, nothing keeps Discord green.
- **Not a hosted bot:** You are the infra. Updates to Claude Code or the plugin can change TUI prompts; trust-guard patterns may need occasional updates in the NEXUS repo.
- **Large vault jobs from Discord** (e.g. “relink everything”) can run **many minutes**; Discord may show typing a long time — that can be normal work, not always a hang.

## Open questions / seeds

- [ ] Do you want a **Windows Task Scheduler** task *in addition to* cron for when WSL is closed until first open?
- [ ] Should heavy vault refactors be **started from desktop Claude** instead of Discord to avoid long typing states?

## Sources

1. NEXUS repo runbook: `docs/# PROJECT: NEXUS DISCORD-OBSIDIAN BRIDGE.md`
2. Scripts: `scripts/nexus-discord-bridge.sh`, `nexus-discord-bridge-watchdog.sh`, `nexus-discord-trust-guard.sh`, `nexus-windows-keepalive.cmd`
3. Example crontab: `docs/nexus-crontab.example`
4. Claude Code CLI help: `claude --help` (trust / `--permission-mode`)

## Related notes

- [[CLAUDE.md]] (vault root — conventions for agents)
- Add a project hub note and link it here if you use one (e.g. NEXUS / AI Factory).

---

## Last health check (automated)

Recorded when this guide was written/refreshed:

- **cron:** installed and active; `*/3` watchdog line present.
- **claude:** single `claude --channels … --permission-mode bypassPermissions` process observed.
- **tmux:** `nexus-global` session present; pane showed active agent work (long-running task — “Listening” may be scrolled up in history).

To re-run checks yourself, paste into WSL:

```bash
crontab -l; systemctl is-active cron
pgrep -af 'claude --channels.*plugin:discord' || echo "MISSING"
tmux list-sessions
tail -5 ~/.local/share/nexus-bridge/cron.log
```
