# Story 29-8 — `vault_request_disambiguation` MCP tool

**Status:** done  
**Epic:** 29 (Phase 6)  
**Story key:** `29-8-vault-request-disambiguation-mcp-tool`

---

## User story

As an agent using Vault IO, when I am uncertain about routing (folder, PAKE type, or which note to update), I want to ask the operator in Discord `#hermes` with numbered options instead of guessing silently, so the operator picks explicitly and I receive `{ choice, choice_index }` or a timeout signal.

---

## Tool specification

| Field | Value |
|-------|--------|
| **Name** | `vault_request_disambiguation` |
| **Input** | `{ question: string, candidates: string[] (2–3 items), context?: string }` strict object |
| **Success output** | `{ "choice": string, "choice_index": number }` JSON in MCP text content |
| **Timeout output** | `{ "timeout": true }` after **5 minutes** with no valid human reply |
| **Discord body** | `❓ Disambiguation needed:` + question + optional context block + blank line + numbered candidates + blank line + `Reply with 1 or 2.` (two candidates) or `Reply with 1, 2, or 3.` (three candidates) |
| **Side effects** | Discord POST + GET polling only. **No vault mutations. No `_meta/logs/agent-log.md` line.** |
| **Config** | `CNS_DISCORD_HERMES_CHANNEL_ID` + bot token (`CNS_DISCORD_BOT_TOKEN` or `HERMES_DISCORD_TOKEN` or `DISCORD_BOT_TOKEN`). Missing config: registered tool returns `IO_ERROR` JSON (not a throw). |

---

## Acceptance criteria

- [x] Tool registered in `src/register-vault-io-tools.ts`; `PHASE1_VAULT_IO_TOOL_NAMES` includes the name; `assertPhase1ToolSurface` passes.
- [x] Zod `vaultRequestDisambiguationInputSchema`: `question` required; `candidates` length 2–3; `context` optional; `.strict()`.
- [x] Discord message format matches the contract above (including two-option vs three-option reply line).
- [x] Returns operator choice on first qualifying human message after the anchor (non-bot author, digit in range); `{ timeout: true }` after 5 minutes.
- [x] No vault IO and no audit logging on any path.
- [x] `CLAUDE.md` (repo root): Vault IO tool count **10**; `cns_vault_io` table row updated.
- [x] `specs/cns-vault-contract/AGENTS.md` Section 4 tool list + version **v1.9.8**; canonical vault copy and repo `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` synced (identical to spec mirror).
- [x] `specs/cns-vault-contract/README.md`: env subsection for disambiguation.
- [x] `specs/cns-vault-contract/modules/vault-io.md`: Phase 1 tool name list includes `vault_request_disambiguation`.
- [x] Unit tests: valid 2- and 3-candidate schema/format, invalid candidate counts, mocked Discord success + timeout, MCP handler without Discord env.
- [x] `npm test` and `bash scripts/verify.sh` pass.

---

## Developer implementation notes

1. **Pattern:** Mirror `vault_log_action` registration: `safeParse` → `callToolErrorFromCns` on schema failure; `try/catch` with `handleToolInvocationCatch`.
2. **Core logic:** `src/tools/vault-request-disambiguation.ts` — `formatDisambiguationDiscordMessage`, `parseOperatorChoice`, `selectEarliestHumanChoice`, `vaultRequestDisambiguation` with injectable `fetchImpl`, `nowMs`, `sleep`, `timeoutMs`, `pollIntervalMs`, `apiBase` for tests.
3. **Discord REST (v10):** `POST /channels/{id}/messages` with `Authorization: Bot …`; `GET /channels/{id}/messages?after={anchorId}&limit=25` for polling. Source: Context7 `/discord/discord-api-docs` (Create Message).
4. **RuntimeConfig:** extend `src/config.ts` with `discordBotToken` / `discordHermesChannelId` from env (see README).
5. **Tests:** `tests/vault-io/vault-request-disambiguation.test.ts`; extend `phase1-tool-surface.test.ts` (10 tools); `fixture-vault-integration.test.ts` strict sweep valid input map.

---

## Completion record

- Implemented 2026-05-13: new tool module, registration, config, docs, constitution sync (spec + both vault paths), sprint status `done`.
