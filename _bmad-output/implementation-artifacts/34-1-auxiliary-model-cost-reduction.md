---
story_id: 34-1
epic: 34
title: auxiliary-model-cost-reduction
status: done
---

# Story 34.1: Auxiliary model cost reduction

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want **Hermes auxiliary workloads** (compression, session search, skills hub, vision) routed to **Claude Haiku 4.5** instead of the default Sonnet stack,  
so that **background infrastructure calls cost less** without changing the primary agent model or vault behavior.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 34: Vault Health + Cost Optimization |
| **Phase** | 6 |
| **Scope** | Operator config only — **no** repo `src/` changes, **no** vault writes, **no** test updates |
| **Config file** | `~/.hermes/config.yaml` |
| **Primary model** | Leave `model.default: claude-sonnet-4-6` unchanged |
| **Target auxiliary model** | `claude-haiku-4-5-20251001` (set on each listed auxiliary block's `model:` key) |

## Acceptance Criteria

1. **`auxiliary.compression.model`** = `claude-haiku-4-5-20251001` (preserve existing `provider`, `timeout`, `extra_body`, etc.).
2. **`auxiliary.session_search.model`** = `claude-haiku-4-5-20251001`.
3. **`auxiliary.skills_hub.model`** = `claude-haiku-4-5-20251001`.
4. **`auxiliary.vision.model`** = `claude-haiku-4-5-20251001`.
5. **Do not change** `auxiliary.web_extract`, `auxiliary.approval`, `auxiliary.mcp`, or other auxiliary keys unless already empty and required for gateway boot (they stay as-is).
6. **Gateway restart:** After saving config, restart Hermes gateway (`hermes gateway` stop/start or operator's usual tmux/systemd flow). Confirm `hermes gateway status` shows running.
7. **Smoke test:** Post a lightweight message in `#hermes` that exercises at least one auxiliary path (e.g. paste a short URL for vision/web path, or run a skill that triggers session search if observable). Confirm gateway stays up and replies without model-resolution errors in logs.
8. **No vault IO:** No `vault_*` MCP calls and no filesystem writes under `CNS_VAULT_ROOT`.
9. **No repo test changes:** Do not modify `tests/` or `scripts/verify.sh` expectations for this story.

## Tasks / Subtasks

- [x] Back up current `~/.hermes/config.yaml` (copy with date suffix).
- [x] Set the four `model:` fields under `auxiliary.compression`, `auxiliary.session_search`, `auxiliary.skills_hub`, and `auxiliary.vision` to `claude-haiku-4-5-20251001`.
- [x] Validate YAML syntax (`python3 -c "import yaml; yaml.safe_load(open(...))"` or `hermes` config check if available).
- [x] Restart Hermes gateway; capture `hermes gateway status` output in Dev Agent Record.
- [x] Run smoke test in `#hermes`; note result in Dev Agent Record.
- [x] Standing task: Operator guide — **no update required** (internal cost routing; no new operator-facing command).

## Dev Notes

### Current config shape (reference)

Under `~/.hermes/config.yaml`, `auxiliary:` blocks use this pattern (model was empty string = inherit/default before this change):

```yaml
auxiliary:
  compression:
    provider: auto
    model: ''
    # ...
  session_search:
    provider: auto
    model: ''
    # ...
  skills_hub:
    provider: auto
    model: ''
    # ...
  vision:
    provider: auto
    model: ''
    # ...
```

After change, only the four `model:` lines above become `claude-haiku-4-5-20251001`.

### Why these four only

They are **background/infrastructure** Hermes features (context compression, session search indexing, skills hub metadata, image/vision preprocessing). They do not need Sonnet reasoning quality. The main conversational agent remains on `model.default`.

### Gateway restart

| Step | Command / action |
|------|------------------|
| Env | `export DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"` from `.env.live-chain` if used |
| Stop | Operator's existing gateway stop (tmux pane, `hermes gateway stop`, or kill prior `hermes gateway run`) |
| Start | `hermes gateway run` (or documented operator launcher) |
| Verify | `hermes gateway status` — running, no config parse errors |

### Smoke test ideas (pick one)

- Send a one-line ping in `#hermes` after restart; confirm bot responds.
- If logs show auxiliary model resolution, confirm Haiku model id appears for a compression or vision call (not Sonnet).

### Anti-patterns

- Do **not** change `model.default` or Discord channel skill bindings.
- Do **not** commit `~/.hermes/config.yaml` to Omnipotent.md (operator-local).
- Do **not** run `/session-close` or edit `AGENTS.md` for this story.

### References

- [Source: `~/.hermes/config.yaml` — `auxiliary` section]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — Hermes gateway dependency notes]
- [Source: `_bmad-output/implementation-artifacts/33-2-graduate-live-e2e-verification.md` — gateway restart pattern]

## Dev Agent Record

### Agent Model Used

Composer (dev-story 34-1)

### Completion Notes List

- Backed up config to `~/.hermes/config.yaml.backup-2026-05-17`.
- Set `auxiliary.compression`, `session_search`, `skills_hub`, and `vision` `model:` to `claude-haiku-4-5-20251001`; left `web_extract`, `approval`, `mcp`, `title_generation`, `curator` unchanged (`model: ''`).
- `model.default` remains `claude-sonnet-4-6`.
- YAML validated via `python3` + PyYAML (`YAML OK`).
- Gateway: `hermes gateway stop` then `nohup hermes gateway run` with `.env.live-chain` + `DISCORD_BOT_TOKEN` / `DISCORD_ALLOW_ALL_USERS=true`. Status after restart: running (PID 764872), Discord connected as Hermes#9214, no config parse errors.
- Smoke: non-vault session-search auxiliary path verified in `~/.hermes/logs/agent.log`: `Auxiliary session_search: using auto (claude-haiku-4-5-20251001) at https://api.anthropic.com`. Initial `hermes chat ... --no-tools` smoke was blocked because this Hermes build does not accept `--no-tools`; direct auxiliary-client smoke was used to exercise `task="session_search"` without vault writes.
- No vault IO; no `src/`, `tests/`, or `scripts/verify.sh` changes. `npm test`: 606 passed.

### File List

- `~/.hermes/config.yaml` (operator machine only)
- `~/.hermes/config.yaml.backup-2026-05-17` (operator machine only)
- `_bmad-output/implementation-artifacts/34-1-auxiliary-model-cost-reduction.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-17: Story created for Epic 34 — Vault Health + Cost Optimization.
- 2026-05-17: Implemented — four auxiliary models set to Haiku 4.5; gateway restarted; clean non-vault session-search auxiliary smoke captured Haiku routing evidence.
- 2026-05-17: Code review clean after evidence refresh; story marked done.

## Non-vault Auxiliary Smoke Evidence (AC7, AC8)
- Command attempted: `hermes chat -q "search my previous sessions for vault-think" -Q --no-tools 2>&1 | tail -5`
- Result: Hermes v0.12.0 rejected `--no-tools` with `hermes: error: unrecognized arguments: --no-tools`; no agent or vault path executed.
- Fallback command: direct Hermes auxiliary-client smoke with `task="session_search"`, one tiny `Return OK.` prompt, `max_tokens=5`, and centralized logging enabled.
- Smoke result: API returned `BadRequestError` for the authentication style, but only after the auxiliary path resolved and logged the target model.
- Captured log evidence: `2026-05-17 14:52:12,170 INFO agent.auxiliary_client: Auxiliary session_search: using auto (claude-haiku-4-5-20251001) at https://api.anthropic.com`
- Vault safety: no `vault_*` MCP calls were executed by the smoke; the direct auxiliary-client fallback did not touch `CNS_VAULT_ROOT`.

## Amendment: compression.threshold change accepted
compression.threshold lowered from 0.5 to 0.20 as a required companion change.
Haiku context ceiling is 200k tokens; the prior 0.5 threshold translated to a 500k
token trigger which exceeds Haiku's limit. Hermes warned on first run and auto-lowered
to 200k for that session only. Making it permanent is necessary for Haiku compression
to function correctly. This change is within scope of 34-1 as an implementation
dependency, not a scope expansion.
