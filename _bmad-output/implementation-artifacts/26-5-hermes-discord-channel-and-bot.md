# Story 26.5 (HI-5): Hermes Discord `#hermes` channel and bot wiring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **26** (Hermes CNS Integration)  
Epic label in vault: **HI-5** (Discord: dedicated `#hermes` channel, Hermes bot token binding, listen scope, live online + reply proof).

## Context

- **HI-1** completed `hermes setup` with **`HERMES_DISCORD_TOKEN`** (separate from Nexus token) and explicitly **deferred** Discord channel layout to **HI-5**. [Source: `26-1-hermes-wsl2-install-and-config.md` §Scope boundaries, AC2]
- **HI-2–HI-4** established constitution, Vault IO MCP writes, and MEMORY/USER scaffold; **do not regress** HI-2 `.hermes.md` → `AI-Context/AGENTS.md`, HI-3 governed-write policy, or HI-4 symlinked `~/.hermes/memories/*` layout.
- **Operator input:** `HERMES_DISCORD_TOKEN` is **already set** in **`.env.live-chain`** (git-ignored operator pattern per live-chain smoke; do not paste values into this repo). [Source: `specs/cns-vault-contract/modules/mcp-operator-runbook.md` — `.env.live-chain` pattern]

## Story

As an **operator**,  
I want **a dedicated Discord text channel `#hermes` on the CNS/Hermes server, the Hermes Discord bot token sourced consistently (including from `.env.live-chain` when used), and Hermes configured so the bot process listens for traffic in `#hermes`**,  
so that **Hermes has a single obvious surface for Discord-driven sessions**, **the bot proves online**, and **a test message in `#hermes` yields a visible bot response** without mixing Nexus bot identity or tokens.

## Acceptance Criteria

1. **Channel exists (AC: channel)**  
   **Given** the operator’s Discord server used for Hermes/CNS work  
   **When** setup completes  
   **Then** a **text** channel named **`hermes`** exists (Discord UI may show `#hermes`).  
   **And** the **server ID + channel ID** (snowflakes) are recorded in **Dev Agent Record** (safe to share; not secrets).

2. **Bot membership and visibility (AC: membership)**  
   **Given** the Hermes Discord application / bot tied to `HERMES_DISCORD_TOKEN`  
   **When** the operator finishes Discord-side configuration  
   **Then** the bot is **invited/joined** to the server and can **see** `#hermes` (role/channel permissions documented in Dev Agent Record: minimal read/send/message history as required by Hermes upstream).

3. **Token wiring to Hermes runtime (AC: token-wire)**  
   **Given** `HERMES_DISCORD_TOKEN` is present in **`.env.live-chain`** (operator-confirmed)  
   **When** Hermes Discord transport is started per upstream docs  
   **Then** the running process receives the token via **one** coherent path: exported env before launch, `source .env.live-chain && …`, and/or **`~/.hermes/.env`** / **`~/.hermes/config.yaml`** — whichever combination **actually** works on the host.  
   **And** Dev Agent Record lists **env var names and file paths only** (no token values, no full `.env` bodies).

4. **Listen scope on `#hermes` (AC: listen-channel)**  
   **Given** AC1–AC3 satisfied  
   **When** Hermes is configured for Discord per **current** NousResearch docs  
   **Then** configuration is **explicit** that inbound handling is scoped to **`#hermes`** (channel ID or name+guild resolution — **observed** mechanism wins over this story’s wording if docs differ).  
   **If** upstream only supports guild-wide listen: document that limitation, the mitigation (dedicated server or permission lockdown), and operator sign-off in Dev Agent Record — do not silently widen scope without recording it.

5. **Online and reply proof (AC: live-proof)**  
   **Given** AC1–AC4 satisfied  
   **When** the operator posts a **single** identifiable test message in `#hermes` (e.g. contains a unique nonce string)  
   **Then** within a **reasonable** upstream-documented window, the bot shows **online** (or equivalent gateway-connected state) and posts a **reply or acknowledgment** that proves the Hermes stack handled that message (screenshot or redacted log excerpt acceptable; **no** token or full message dumps with secrets).  
   **And** evidence notes **date**, **Hermes version** (`hermes version`), and **whether** Vault IO MCP was **not required** for this story (expected: operator/Discord/Hermes only).

6. **Identity separation (AC: not-nexus)**  
   **When** this story closes  
   **Then** documentation confirms the **Hermes** bot token / application is **not** the Nexus bridge token and **not** shared client IDs with Nexus where avoidable.  
   **If** physical reuse is unavoidable, record **why** and the blast-radius — prefer separate app/token per HI-1.

7. **Regression: constitution + SOUL (AC: regress)**  
   **Given** HI-1 / HI-2 / HI-4 policies  
   **When** HI-5 completes  
   **Then** **`SOUL.md` remains absent** from Hermes workspace paths checked in HI-2 / HI-4; **`.hermes.md` → `AI-Context/AGENTS.md`** behavior unchanged unless upstream forces a change (document if forced).  
   **And** no governed vault mutation is **required** for this story; if a vault note is created for operator notes, prefer **operator FS** or **00-Inbox/** + triage — do not bypass HI-3 for governed paths.

8. **Operator guide (AC: docs)**  
   **Given** this story is operator-facing infrastructure  
   **When** it closes  
   **Then** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` gains a short **Hermes Discord (`#hermes`)** subsection: channel purpose, how to load `.env.live-chain`, where Hermes reads `HERMES_DISCORD_TOKEN`, link to Hermes Discord docs, and **security note** (tokens git-ignored; never paste into vault notes). Bump `modified` + Version History row referencing **`26-5-hermes-discord-channel-and-bot`**.

## Tasks / Subtasks

- [x] **Prereq check**  
  - [x] Confirm `26-4-hermes-persistent-context-scaffold` is **done** in `sprint-status.yaml`.  
  - [x] Re-read HI-1 scope table: Discord channel was **explicitly out of scope** for HI-1 — this story owns it. [Source: `26-1-hermes-wsl2-install-and-config.md`]

- [x] **Discord server (AC: channel, membership)**  
  - [x] Create `#hermes` (or rename an existing draft channel) on the target server.  
  - [x] Invite Hermes bot; set channel + category permissions so the bot can read/send (and use message content intent if upstream requires — match **Discord Developer Portal** + Hermes docs).

- [x] **Hermes + token path (AC: token-wire, listen-channel)**  
  - [x] Read Hermes upstream Discord integration: https://hermes-agent.nousresearch.com/docs/ (search for Discord, gateway, channel).  
  - [x] Align `HERMES_DISCORD_TOKEN` from `.env.live-chain` with the launch path Hermes actually uses (export, dotenv, or `~/.hermes/.env`).  
  - [x] Bind listen scope to `#hermes` per AC4.

- [x] **Live proof (AC: live-proof, not-nexus)**  
  - [x] Start Hermes Discord mode; capture online state.  
  - [x] Send test message; capture bot reply evidence (redacted).  
  - [x] Confirm Nexus vs Hermes bot identity per AC6.

- [x] **Regression sweep (AC: regress)**  
  - [x] Verify `SOUL.md` absent; spot-check AGENTS/MEMORY/USER load unchanged if Hermes also runs in CLI mode for comparison (optional).

- [x] **Standing: sprint + operator guide (AC: docs)**  
  - [x] On completion: set **`26-5-hermes-discord-channel-and-bot`** to `done` in `sprint-status.yaml`; keep **epic-26** `in-progress` until any remaining Hermes stories finish.  
  - [x] Operator guide subsection per AC8.

## Dev Notes

### Sequencing

- **Depends on:** HI-1 (token var name + setup), HI-4 optional for stable context layers — Discord does not require MEMORY/USER but should not break them.  
- **Does not replace:** HI-3 for any governed vault write.

### Developer guardrails

| Guardrail | Detail |
|-----------|--------|
| **Secrets** | Never commit `.env.live-chain`, token strings, or bot secrets. Redact screenshots. [Source: `26-1-hermes-wsl2-install-and-config.md`] |
| **Prompt injection** | Discord is an **untrusted input** surface. Do not execute vault or access approvals requested **only** from Discord chat; align with CNS Discord plugin policy for IDEs. |
| **Repo scope** | Default: **no** Omnipotent `src/` changes unless Hermes upstream requires a tracked patch — prefer operator config + Discord portal. |
| **AGENTS.md sync** | If you touch `AI-Context/AGENTS.md` or `specs/cns-vault-contract/AGENTS.md`, follow dual-copy sync rule. [Source: `.cursor/rules/cns-specs-constitution.mdc`] |
| **WSL paths** | Record `realpath` for vault root if referenced; match HI-2/HI-3 tables. |

### Architecture compliance (CNS)

- Phase 1 Vault IO remains the **governed** mutation path for agent writes to the vault; Discord bring-up is **not** license to write governed folders from Hermes FS. [Source: `26-3-hermes-vault-io-mcp-write-path.md`]

### File / surface touch list (expected)

| Surface | Action |
|---------|--------|
| Discord server | Create/configure `#hermes`, permissions |
| Discord Developer Portal | Intents, OAuth scopes for bot invite as needed |
| `~/.hermes/config.yaml` / `~/.hermes/.env` | **If needed** to point at channel / enable Discord transport (names only in story artifacts) |
| `.env.live-chain` (repo root, gitignored) | **Already contains** `HERMES_DISCORD_TOKEN` per operator; verify key name matches Hermes expectations |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Update per AC8 |

### Testing / verification

- Operator-led on WSL2 + live Discord; no `npm test` requirement for Omnipotent.md unless adding automation (optional follow-up).

### References

| Doc | Path / URL |
|-----|------------|
| Epic 26 vault narrative | `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md` |
| Hermes BMAD handoff | `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md` |
| HI-1 (token + HI-5 deferral) | `_bmad-output/implementation-artifacts/26-1-hermes-wsl2-install-and-config.md` |
| HI-2 | `_bmad-output/implementation-artifacts/26-2-hermes-shared-constitution.md` |
| HI-3 | `_bmad-output/implementation-artifacts/26-3-hermes-vault-io-mcp-write-path.md` |
| HI-4 | `_bmad-output/implementation-artifacts/26-4-hermes-persistent-context-scaffold.md` |
| Hermes docs | https://hermes-agent.nousresearch.com/docs/ |
| Env file pattern | `specs/cns-vault-contract/modules/mcp-operator-runbook.md` (`.env.live-chain`) |

### Latest tech / upstream

- Hermes Discord wiring and env var names can change between releases; **`hermes version` + rendered docs** override static story text.  
- Discord **Message Content Intent** and privileged intents: follow **current** Discord Developer Portal requirements when the bot reads non-slash content.

## Previous story intelligence (HI-4)

- **Config surface:** `~/.hermes/config.yaml` and `~/.hermes/.env` are live operator surfaces; symlinks under `~/.hermes/memories/` point at vault `AI-Context/MEMORY.md` and `USER.md`. Do not break those when editing env for Discord. [Source: `26-4-hermes-persistent-context-scaffold.md` Dev Agent Record]  
- **SOUL.md:** Hermes may re-seed `~/.hermes/SOUL.md`; delete before close if observed.  
- **Evidence style:** Redacted snippets, version strings, dates, and path tables — mirror HI-4 completion notes.

## Git intelligence summary

- No new code commits expected in Omnipotent.md for default execution path; sprint-status + this story file are tracked in-repo; operator guide lives in vault.

## Project context reference

- CNS Phase 1 scope boundary: **Discord / Nexus bridge** is Phase 2 for **product** — this story is **Hermes operator integration** only (Epic 26), not Nexus feature work. [Source: `CLAUDE.md` Scope Boundaries — interpret as “do not build Nexus bridge features”; Hermes Discord is explicitly Epic 26 HI-5 per HI-1.]

## Standing tasks (every story)

### Standing task: Update operator guide

- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12. **AC8 mandates an update.**  
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record — **not applicable if AC8 stands**.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex), 2026-05-04

### Debug Log References

- **Repo pre-change gate:** `npm test` passed before edits: Node TAP suites passed and Vitest reported **48 files / 576 tests passed**.
- **Installed Hermes:** `hermes version` -> `Hermes Agent v0.12.0 (2026.4.30)`, project `/home/christ/.hermes/hermes-agent`, Python `3.11.15`.
- **Live upstream docs:** Hermes Discord docs fetched 2026-05-04. Observed current env var is **`DISCORD_BOT_TOKEN`**, not `HERMES_DISCORD_TOKEN`; required authorization is `DISCORD_ALLOWED_USERS` or `DISCORD_ALLOWED_ROLES`; channel scoping is supported by `discord.allowed_channels` / `DISCORD_ALLOWED_CHANNELS`; mention-free channel behavior by `discord.free_response_channels` / `DISCORD_FREE_RESPONSE_CHANNELS`.
- **Local env presence check only:** `.env.live-chain` exists and contains `HERMES_DISCORD_TOKEN`; it does not contain `DISCORD_BOT_TOKEN`, `DISCORD_ALLOWED_USERS`, `DISCORD_ALLOWED_ROLES`, `DISCORD_ALLOWED_CHANNELS`, or `DISCORD_FREE_RESPONSE_CHANNELS`. Token values were not printed.
- **Token bridge proof:** from repo root, `set -a; . ./.env.live-chain; set +a; DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN" hermes gateway status` executed without exposing token values; gateway was not running.
- **Discord API metadata proof:** `GET /users/@me` with bot token succeeded. Bot ID `1500308953840484353`, username `Hermes`. `GET /oauth2/applications/@me` succeeded: application ID `1500308953840484353`, name `Hermes`, `bot_public: True`, `bot_require_code_grant: False`. `GET /users/@me/guilds` returned `guild_count: 0`.
- **HALT blocker:** Hermes bot is not joined to any Discord server, so the dev agent cannot create or verify `#hermes`, cannot record server/channel snowflakes, cannot set channel permissions, cannot bind `discord.allowed_channels`, and cannot produce online/reply proof. Operator must invite bot to the target CNS/Hermes server first.
- **Invite URL (safe metadata):** `https://discord.com/oauth2/authorize?client_id=1500308953840484353&scope=bot%20applications.commands&permissions=68672` requests View Channel, Send Messages, Read Message History, and Add Reactions. If channel creation by bot is desired, grant Manage Channels temporarily and remove it after `#hermes` exists.
- **Regression sweep:** `~/.hermes/SOUL.md` was re-seeded by Hermes CLI checks and removed again; `SOUL.md` absent at `~/.hermes/`, `~/ai-factory/hermes/`, vault root, and `AI-Context/`. Vault `.hermes.md` still points to `AI-Context/AGENTS.md`; `~/.hermes/memories/MEMORY.md` and `USER.md` symlinks still point to vault `AI-Context/`.
- **Operator guide:** active vault guide `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` updated with Hermes Discord `#hermes` subsection and Version History row `1.8.3`; `vault_log_action` recorded the documentation edit metadata.
- **Discord server/channel proof:** after operator created `#hermes`, bot-token API checks showed Hermes joined guild `Nexus` (`1484880486122913802`) and can see text channel `hermes` (`1500733488897462382`, parent category `1484880486785486949`). Bot member ID remains `1500308953840484353`, username `Hermes`, role `1500731501015335076`.
- **Listen-scope binding:** `~/.hermes/config.yaml` now has `discord.allowed_channels: '1500733488897462382'` and `discord.free_response_channels: '1500733488897462382'`; `discord.require_mention` remains `true`, so mention-free behavior is limited to `#hermes`.
- **Gateway startup attempt:** `tmux new-session -d -s hermes-hi5 ... DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN" DISCORD_ALLOWED_ROLES=1484880486122913802 hermes gateway run` briefly launched, but `hermes gateway status` later reported not running. `~/.hermes/logs/gateway.log` recorded `discord connect timed out after 30s`; `errors.log` recorded `PrivilegedIntentsRequired`.
- **Authorization retry:** a second foreground run with `DISCORD_ALLOWED_USERS=000000000000000000` still failed with `PrivilegedIntentsRequired`, proving the remaining blocker is the Discord application **Message Content Intent** portal toggle, not only role-based Server Members Intent.
- **Live proof nonce watcher:** REST polling for `HI5-live-proof-20260504-0545` in `#hermes` ran against channel history and found no messages during the watch window. No reply proof captured.
- **Operator guide follow-up:** active vault guide updated to Version History row `1.8.4`, recording live `#hermes` channel ID and the Message Content Intent prerequisite; `vault_log_action` recorded the documentation edit metadata.
- **Clean gateway proof run:** after Message Content Intent was enabled, `tmux new-session -d -s hermes-hi5 "cd /home/christ/ai-factory/projects/Omnipotent.md && set -a && . ./.env.live-chain && set +a && DISCORD_BOT_TOKEN=\"$HERMES_DISCORD_TOKEN\" DISCORD_ALLOW_ALL_USERS=true hermes gateway run"` started successfully. `hermes gateway status` reported running PIDs `22874, 22869`; gateway log recorded `[Discord] Connected as Hermes#9214`, `discord connected`, and `Gateway running with 1 platform(s)`; `errors.log` was empty.
- **Live reply proof:** operator posted `HI5-live-proof-20260504-0614` in `#hermes` at `2026-05-04T06:23:04.482Z` as Discord user `christaylor0060` (`1429000334553911358`). Hermes replied at `2026-05-04T06:23:13.940Z` as bot `Hermes` (`1500308953840484353`) with an acknowledgment including the same nonce. Gateway log corroborated inbound message handling and response delivery: inbound at local `2026-05-03 23:23:06`, response ready in `7.3s`, sent to channel `1500733488897462382`.

### Completion Notes List

- Prereqs complete: HI-4 is `done`; HI-1 explicitly deferred Discord channel/server layout to HI-5.
- Current upstream Hermes Discord runtime expects `DISCORD_BOT_TOKEN`; CNS keeps the operator secret as `HERMES_DISCORD_TOKEN` in `.env.live-chain`. Working launch pattern is process-level aliasing: `DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN" hermes gateway run`.
- `~/.hermes/config.yaml` has `discord.require_mention: true`, `discord.free_response_channels: '1500733488897462382'`, and `discord.allowed_channels: '1500733488897462382'`.
- AC8 documentation update is complete in the active vault guide. It records channel purpose, `.env.live-chain` loading, upstream token var, live server/channel IDs, channel scoping keys, docs link, Message Content Intent prerequisite, and secret hygiene.
- Story complete: Message Content Intent was enabled, gateway connected cleanly, and `#hermes` live reply proof passed. The proof run used process-level `DISCORD_ALLOW_ALL_USERS=true`; channel handling remained scoped by `discord.allowed_channels` to `1500733488897462382`.

### File List

- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (vault; Section 15 + Version History)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/_meta/logs/agent-log.md` (vault audit line via `vault_log_action`)
- `_bmad-output/implementation-artifacts/26-5-hermes-discord-channel-and-bot.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `~/.hermes/config.yaml` (operator home; Discord `allowed_channels` / `free_response_channels` bound to `#hermes`)
- `~/.hermes/SOUL.md` (operator home; generated by Hermes check, removed again)

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-04 | Started HI-5, verified token/application metadata without exposing secrets, documented current upstream Discord env/config keys, updated operator guide 1.8.3, removed re-seeded `~/.hermes/SOUL.md`, and halted because Hermes bot is not yet in any Discord guild. |
| 2026-05-04 | Resumed HI-5 after `#hermes` creation, verified guild/channel IDs, bound `discord.allowed_channels` and `discord.free_response_channels`, attempted gateway startup, and halted on Discord Developer Portal Message Content Intent requirement (`PrivilegedIntentsRequired`). |
| 2026-05-04 | Enabled Message Content Intent, started Hermes gateway cleanly in `tmux` session `hermes-hi5`, captured live `#hermes` nonce and Hermes acknowledgment, updated sprint status, and closed HI-5. |

### Operator Verification Pending

| Field | Value |
|-------|-------|
| Date | 2026-05-04 |
| Hermes version | `Hermes Agent v0.12.0 (2026.4.30)` |
| Hermes bot application ID | `1500308953840484353` |
| Hermes bot username | `Hermes` |
| Discord guild status | `guild_count: 1`; guild name `Nexus` |
| Server ID | `1484880486122913802` |
| `#hermes` channel ID | `1500733488897462382` |
| Listen-scope plan | Complete: `discord.allowed_channels` and `discord.free_response_channels` set to `1500733488897462382` in `~/.hermes/config.yaml` |
| Gateway status | Complete: running in `tmux` session `hermes-hi5`; connected as `Hermes#9214` with empty `errors.log` during proof |
| Live proof | Operator nonce `HI5-live-proof-20260504-0614` at `2026-05-04T06:23:04.482Z`; Hermes acknowledgment at `2026-05-04T06:23:13.940Z`; gateway response ready in `7.3s` |
| Vault IO MCP required? | No, except `vault_log_action` used to audit operator-guide documentation edit |
| Nexus separation | Hermes application ID `1500308953840484353`; Nexus bot role separately observed as `1484881109719191655`, so Hermes identity is distinct from Nexus |

---

**Story completion status:** Done; AC1 through AC8 satisfied.

## Saved questions / clarifications (optional)

- If the operator uses **multiple** Discord servers, confirm which guild ID is canonical for CNS Hermes before locking `#hermes` IDs in the guide.
