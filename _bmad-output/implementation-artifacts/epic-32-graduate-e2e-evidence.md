# Epic 32 / Story 33-2 — `/graduate` live E2E evidence

**Date:** 2026-05-17  
**Channel:** Discord `#hermes` (`1500733488897462382`)  
**Gateway:** `hermes gateway run` with `.env.live-chain`, `DISCORD_ALLOW_ALL_USERS=true` (PID 594773 at run start)  
**Operator / dev agent:** Christopher Taylor vault; Cursor dev agent (Story 33-2)

## AC1 — Live `/graduate` execution (PASS with inbound note)

| Step | Detail |
|------|--------|
| **Command issued** | `/graduate` (7-day default scan) |
| **Gateway** | Running and connected (`Hermes#9214`) before and during the run |
| **Inbound** | Bot-posted `/graduate` in `#hermes` did **not** enqueue gateway processing (Hermes ignores own bot messages; no `inbound message` log line). Production execution used **`hermes chat -q "/graduate" -s vault-graduate -Q --yolo`** — same `vault-graduate` skill and `cns_vault_io` MCP stack as `#hermes` channel bindings |
| **Hermes session** | `20260517_091658_7ef54f` |
| **Discord response** | Graduate report template posted to `#hermes` (message `1505348665126944851`, `2026-05-16T23:18:09Z`) — matches Hermes chat output below |

### Observed Discord response (exact template)

```text
🎓 Graduate report (last 7 days)

Promoted:
• Epic 33-2 E2E graduate fixture (controlled) — story 33-2 cursor-dev → 03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md (from DailyNotes/2026-05-16.md)

Receipt appended (today's daily):
• DailyNotes/2026-05-16.md — ## Graduated 2026-05-16 (1 item with source filenames)
```

## AC2–3 — Controlled fixture and vault outcomes

| Item | Value |
|------|--------|
| **Fixture source** | `DailyNotes/2026-05-16.md` — line appended via **`vault_append_daily`** (section `Log`): `- Epic 33-2 E2E graduate fixture (controlled) #graduate — story 33-2 cursor-dev` |
| **Fixture prep timestamp** | `2026-05-16T23:15:28.047Z` (`vault_append_daily` audit) |
| **Run timestamp** | `2026-05-16T23:17:31Z`–`23:17:34Z` (create + receipt append) |
| **Created InsightNote** | `03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md` |
| **Skipped** | None (first promotion) |
| **Daily receipt** | `## Graduated 2026-05-16` on `DailyNotes/2026-05-16.md` (Option B — today's UTC daily at run time) |
| **`#graduate` on source line** | Retained on source daily (no body-edit mutator) |

## AC4 — Skill parity (PASS)

`diff -q` on repo mirror vs installed copy:

- `scripts/hermes-skill-examples/vault-graduate/SKILL.md` ↔ `~/.hermes/skills/cns/vault-graduate/SKILL.md`
- `scripts/hermes-skill-examples/vault-graduate/references/task-prompt.md` ↔ `~/.hermes/skills/cns/vault-graduate/references/task-prompt.md`

Result: **identical** (`SKILL_PARITY_OK`).

## AC5 — Live config binding (PASS)

From `~/.hermes/config.yaml`:

- `discord.channel_skill_bindings` for `1500733488897462382` includes **`vault-graduate`**
- Channel prompt: *"Use vault-graduate for /vault-graduate and /vault-graduate --days &lt;n&gt;."* (updated post-run; prior dev run used `/graduate` forms)
- `mcp_servers.cns_vault_io.env.CNS_VAULT_ROOT` → `Knowledge-Vault-ACTIVE`

## AC6 — Governed vault writes only (PASS)

Audit log (`_meta/logs/agent-log.md`) for this run:

| Timestamp (UTC) | Tool | Target |
|-----------------|------|--------|
| `2026-05-16T23:15:28.069Z` | `vault_append_daily` | `DailyNotes/2026-05-16.md` (fixture line, section Log) |
| `2026-05-16T23:17:31.343Z` | `vault_create_note` | `03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md` |
| `2026-05-16T23:17:34.954Z` | `vault_append_daily` | `DailyNotes/2026-05-16.md` (graduation receipt) |

No direct filesystem writes under `DailyNotes/` or `03-Resources/` for promotion (Hermes `file` tools not used on governed paths).

## AC7 — Verification gate (PASS)

| Check | Result |
|-------|--------|
| `npm test` | **606** passed |
| `bash scripts/verify.sh` | **VERIFY PASSED** |

## Follow-up (optional operator spot-check)

Post a fresh `#graduate` line in a daily note, then send **`/graduate`** from your Discord user (not the bot) in `#hermes` to confirm gateway inbound routing matches this MCP-backed run. Re-run should show **Skipped (already graduated)** for the fixture title.

---

## Live gateway run — `/vault-graduate` (2026-05-17, Story 33-2 AC1–AC4 closure)

**Canonical trigger:** `/vault-graduate` (Hermes auto-registers `/{skill-name}` for skill `vault-graduate`).

| Item | Detail |
|------|--------|
| **Command issued** | `/vault-graduate` (7-day default scan) |
| **Inbound path** | Operator message in `#hermes` → live gateway (`hermes gateway run`, `.env.live-chain`) |
| **Dedup (05-16 fixture)** | **Skipped (already graduated):** `Epic 33-2 E2E graduate fixture (controlled) — story 33-2 cursor-dev` → `03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md` (from prior run on `DailyNotes/2026-05-16.md`) |
| **Fresh promotion (05-17)** | Line on `DailyNotes/2026-05-17.md`: `/vault-graduate confirmed working via Discord gateway. Slash-less invocation uses skill name form. #graduate` |
| **Created InsightNote** | `03-Resources/vault-graduate-confirmed-working-via-discord-gateway-slash-less-invocation-uses-skill-name-form.md` |
| **Daily receipt** | `## Graduated 2026-05-17` appended to `DailyNotes/2026-05-17.md` (Option B — today's UTC daily) |

### Observed Discord response (live gateway)

```text
🎓 Graduate report (last 7 days)

Promoted:
• /vault-graduate confirmed working via Discord gateway. Slash-less invocation uses skill name form. → 03-Resources/vault-graduate-confirmed-working-via-discord-gateway-slash-less-invocation-uses-skill-name-form.md (from DailyNotes/2026-05-17.md)

Skipped (already graduated):
• Epic 33-2 E2E graduate fixture (controlled) — story 33-2 cursor-dev → 03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md

Receipt appended (today's daily):
• DailyNotes/2026-05-17.md — ## Graduated 2026-05-17 (1 item with source filenames)
```

### Audit log (`_meta/logs/agent-log.md`) — live gateway run

| Timestamp (UTC) | Tool | Target |
|-----------------|------|--------|
| `2026-05-17T00:06:41.936Z` | `vault_create_note` | `03-Resources/vault-graduate-confirmed-working-via-discord-gateway-slash-less-invocation-uses-skill-name-form.md` |
| `2026-05-17T00:06:45.288Z` | `vault_append_daily` | `DailyNotes/2026-05-17.md` (`section`: `Graduated 2026-05-17`) |

No direct filesystem writes under `DailyNotes/` or `03-Resources/` for promotion.

### Trigger doc cleanup (post-run)

- Skill mirror + `~/.hermes/skills/cns/vault-graduate/`: canonical triggers restored to **`/vault-graduate`** and **`/vault-graduate --days <n>`** (reverted "leading slash optional" / bare `graduate` forms).
- `~/.hermes/config.yaml` channel prompt: `Use vault-graduate for /vault-graduate and /vault-graduate --days <n>.`
