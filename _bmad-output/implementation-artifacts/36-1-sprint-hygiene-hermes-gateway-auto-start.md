---
story_id: 36-1
epic: 36
title: sprint-hygiene-hermes-gateway-auto-start
status: review
---

# Story 36.1: Sprint hygiene + Hermes gateway auto-start

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want **sprint tracking aligned with Phase 6 close-out** and the **Hermes Discord gateway to start automatically on WSL boot**,  
so that **BMAD status reflects reality**, **Discord `#hermes` recovers after reboot without manual tmux**, and **MEMORY.md / Operator Guide document the launcher**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 36: Operational Stability + Vault Close-Out |
| **Phase** | 6 |
| **Predecessor** | Epic 35 stories done; repo audit (2026-05-18) flagged sprint drift + gateway manual-start |
| **Nexus pattern** | `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md` — WSL `crontab` automation (watchdog every 3 min); Hermes uses **`@reboot`** one-shot start (no Hermes watchdog in scope) |
| **MEMORY.md** | Canonical: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` — currently says **"Gateway: manual start required (not systemd)"** (must update) |
| **Morning digest** | Story **26-7** already uses WSL cron at 07:00 Sydney; digest **requires** gateway up (`scripts/hermes-morning-digest.sh` exits 1 if gateway down) |

## Acceptance Criteria

### Part A — Sprint hygiene (no code; sprint-status.yaml only)

1. **`16-2-perplexity-mcp-install-and-live-tool-call-verification`:** Status **`cancelled`** (or equivalent) with YAML comment: **superseded by `17-1` (live call verified) + `22-1` (formal MCP)**. Remove ambiguous `deferred` if present.
2. **`epic-35`:** Status **`done`** (all stories 35-1–35-3 complete).
3. **`epic-33`:** Status **`done`**; **`33-3-operator-guide-phase6-completeness`:** **`done`** (session confirmed).
4. **`epic-34`:** Status **`done`**; stories **`34-2`**, **`34-3`:** **`done`** (session confirmed).
5. **Retrospective rows added** (status **`optional`**):
   - `epic-33-retrospective: optional`
   - `epic-34-retrospective: optional`
   - `epic-35-retrospective: optional`
6. **`last_updated`** in `sprint-status.yaml` bumped to story completion date.
7. **No TypeScript / test changes** for Part A.

### Part B — Gateway auto-start (repo + operator docs)

8. **Launcher script** at **`scripts/hermes-gateway-start.sh`** (executable):
   - `set -euo pipefail`
   - `cd /home/christ/ai-factory/projects/Omnipotent.md` (or `$REPO_ROOT` from script location)
   - `set -a; source .env.live-chain; set +a`
   - Export **`DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"`**, **`DISCORD_ALLOW_ALL_USERS=true`**
   - If **`hermes gateway status`** already reports running → **exit 0** (idempotent)
   - Else start gateway in background with log append, e.g.:
     ```bash
     nohup hermes gateway run >>"$HOME/.hermes/logs/gateway-cron.log" 2>&1 &
     ```
   - Document log path in Dev Agent Record
9. **WSL `@reboot` crontab** line installed (user crontab, not system):
   ```cron
   @reboot /usr/bin/env bash -lc '/home/christ/ai-factory/projects/Omnipotent.md/scripts/hermes-gateway-start.sh >>"$HOME/.hermes/logs/gateway-reboot-cron.log" 2>&1'
   ```
   Adjust repo path if clone differs. **`crontab -l`** must show this line after install.
10. **MEMORY.md** — under **`## Environment`**, replace manual-gateway bullet with **`@reboot` cron + script path** (no secrets). If session-close schema is the source of truth, also update **`scripts/hermes-skill-examples/session-close/references/task-prompt.md`** MEMORY template so future `/session-close` runs preserve the line (only if template hard-codes gateway text).
11. **Operator Guide** — new subsection under **§15 Hermes** (e.g. **§15.x Gateway auto-start on WSL boot**): `@reboot` line, launcher path, log files, idempotent behavior, relationship to morning digest gateway dependency. Bump **`modified`** + Version History row referencing **36-1**.
12. **Simulated restart verified:**
    - Stop gateway (`hermes gateway stop` or kill PIDs from `hermes gateway status`)
    - Run **`bash scripts/hermes-gateway-start.sh`**
    - **`hermes gateway status`** → running; gateway log shows Discord connected (redact token in Dev Agent Record)
    - Optional: document that full WSL reboot test is operator-accepted if sandbox blocks reboot
13. **`npm test`** passes.
14. **`bash scripts/verify.sh`** passes.
15. **One logical commit** for Part B (and Part A sprint-status if same session; acceptable as one commit for story 36-1).

**Out of scope:** Hermes watchdog every N minutes (Nexus class); systemd units; changing `.env.live-chain` secrets; `hermes gateway` flags beyond existing operator pattern.

## Tasks / Subtasks

### Part A
- [x] Edit **`_bmad-output/implementation-artifacts/sprint-status.yaml`** per AC1–AC6 (AC: 1–7)
- [x] Grep sprint file for stale `in-progress` on epics 33–35 (AC: 3–4)

### Part B
- [x] Add **`scripts/hermes-gateway-start.sh`** (AC: 8)
- [x] Install **`@reboot`** crontab line; capture **`crontab -l`** excerpt in Dev Agent Record (AC: 9)
- [x] Update **`AI-Context/MEMORY.md`** (+ session-close template if needed) (AC: 10)
- [x] Update **`03-Resources/CNS-Operator-Guide.md`** via vault path (AC: 11)
- [x] Simulated restart test (AC: 12)
- [x] **`npm test`** + **`bash scripts/verify.sh`** (AC: 13–14)
- [x] Commit (AC: 15)
- [x] Standing task: Operator guide — **required** (AC11)

## Dev Notes

### Exact gateway command (normative)

From operator E2E stories (30-3, 32-graduate, 34-1):

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md && source .env.live-chain && DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN" DISCORD_ALLOW_ALL_USERS=true hermes gateway run
```

Launcher wraps this with **`nohup`** + log redirect for boot/cron context.

### WSL / cron constraints

- User **`crontab`** does not run when WSL is not started — same limitation as **26-7** Operator Guide §15.2.
- **`@reboot`** fires when cron daemon starts (typically WSL session / Windows host boot), not when PC sleeps.
- Ensure **`mkdir -p ~/.hermes/logs`** before first log append.

### Idempotency

Double `@reboot` or overlapping manual start must not leave multiple gateway processes. Pattern:

1. Check **`hermes gateway status`**
2. Start only if not running
3. Optionally record PID in Dev Agent Record

### 16-2 status wording

Current sprint line (reference):

```yaml
16-2-perplexity-mcp-install-and-live-tool-call-verification: deferred # superseded by 17-1 ...
```

Target:

```yaml
16-2-perplexity-mcp-install-and-live-tool-call-verification: cancelled # superseded by 17-1 (live call verified) + 22-1 (formal MCP)
```

Keep epic-16 comment block intact for audit trail.

### Optional test hardening

If adding **`tests/hermes-gateway-start.test.mjs`**: assert script exists, is executable, sources `.env.live-chain`, exports `DISCORD_BOT_TOKEN`, and contains idempotent `gateway status` check — **not required** unless verify gate needs it.

### References

- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml`]
- [Source: `_bmad-output/implementation-artifacts/26-7-hermes-daily-digest-cron-aedt.md` — WSL cron pattern]
- [Source: `_bmad-output/implementation-artifacts/34-1-auxiliary-model-cost-reduction.md` — gateway restart]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15]
- [Source: `Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` — Environment section]
- [Source: `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md` — cron automation class]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Completion Notes List

- **Part A:** Sprint hygiene — `16-2` → `cancelled`; epics 33–35 and stories 33-3, 34-2, 34-3 → `done`; retros 33–35 → `optional`; `last_updated` → 2026-05-20.
- **Launcher:** `scripts/hermes-gateway-start.sh` with `REPO_ROOT` resolution, `.env.live-chain`, Discord exports, idempotent check (status + live PID via `kill -0`), `nohup` → `~/.hermes/logs/gateway-cron.log`.
- **Crontab:** `@reboot` line installed (see File List / crontab excerpt below).
- **Docs:** MEMORY.md + session-close MEMORY template; Operator Guide §15.3 (renumbered §15.4–15.9), v1.31.0.
- **Simulated restart:** Stale `hermes gateway status` (no live PID) → launcher started gateway PID 58555; `~/.hermes/logs/gateway.log` shows `[Discord] Connected as Hermes#9214` and `✓ discord connected` (2026-05-20). Full WSL reboot left to operator.
- **Tests:** `npm test` and `bash scripts/verify.sh` passed.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `scripts/hermes-gateway-start.sh`
- `scripts/hermes-skill-examples/session-close/references/task-prompt.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

**Crontab excerpt (AC9):**

```cron
@reboot /usr/bin/env bash -lc '/home/christ/ai-factory/projects/Omnipotent.md/scripts/hermes-gateway-start.sh >>"$HOME/.hermes/logs/gateway-reboot-cron.log" 2>&1'
```

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] Required — §15 gateway auto-start (AC11)

## Change Log

- 2026-05-20: Story 36-1 — sprint hygiene + Hermes gateway `@reboot` auto-start, launcher, MEMORY/Operator Guide.
