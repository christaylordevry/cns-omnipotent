---
story_id: 38-1
epic: 38
title: provider-migration-documentation
status: done
---

# Story 38.1: Provider migration documentation

Status: done

<!-- Retroactive close — work completed 2026-05-22 outside BMAD; story captures evidence and operator runbook. -->

## Story

As the **CNS maintainer**,
I want **today's Hermes provider migration** (main + auxiliary + gateway token) **documented with before/after config and log evidence**,
so that **Phase 7 cost optimization has an auditable baseline** and future rollbacks do not rely on chat memory.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 38: Cost + Provider Optimization |
| **Phase** | 7 (post–Phase 6 close-out) |
| **Scope** | Operator config + documentation only — **no** repo `src/` changes, **no** vault writes |
| **Work date** | 2026-05-22 (completed ad hoc; this story retro-closes it) |
| **Config file** | `~/.hermes/config.yaml` (operator-local; do not commit) |
| **Prior backup** | `~/.hermes/config.yaml.backup-2026-05-17` (Haiku auxiliary era) |
| **Repo touch** | Commit `f968ff8` — session-close note only; config lives on operator machine |

## Acceptance Criteria

1. **Main provider migrated** from `anthropic` / `claude-sonnet-4-6` to **`openai-codex`** / **`gpt-5.5`** with `base_url: https://chatgpt.com/backend-api/codex` (ChatGPT subscription / Codex OAuth path).
2. **`model.prompt_cache_ttl: 1h`** set on the `model:` block (Codex cross-session prefix cache intent).
3. **All auxiliary tasks** (`vision`, `web_extract`, `compression`, `session_search`, `skills_hub`, `approval`, `mcp`, `title_generation`) route to **`provider: openai-codex`** + **`model: gpt-5.4-mini`**; **`curator`** uses **`gpt-5.5`** on `openai-codex`.
4. **`compression.threshold`** lowered from **`0.5` → `0.2`** (companion to mini-model context ceiling; same rationale as Story 34-1 Haiku amendment).
5. **Gateway token bridge** on restart: `source .env.live-chain` then **`export DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"`** (and `DISCORD_ALLOW_ALL_USERS=true` for CNS `#hermes`); launcher **`scripts/hermes-gateway-start.sh`** already encodes this (Story 36-1).
6. **Gateway smoke:** `hermes gateway status` shows running; Discord connects as Hermes#9214; **`agent.log`** shows auxiliary lines like `Auxiliary compression: using openai-codex (gpt-5.4-mini) at https://chatgpt.com/backend-api/codex/`.
7. **Evidence artifact:** This story file's Dev Agent Record + dated config backup note (create `~/.hermes/config.yaml.backup-2026-05-22` if not already present).
8. **No vault IO** and **no** `npm test` / `verify.sh` gate (operator-only).

## Migration summary (before → after)

| Setting | Before (2026-05-17 backup) | After (2026-05-22) |
|---------|---------------------------|---------------------|
| `model.provider` | `anthropic` | `openai-codex` |
| `model.default` | `claude-sonnet-4-6` | `gpt-5.5` |
| `model.base_url` | (default) | `https://chatgpt.com/backend-api/codex` |
| `model.prompt_cache_ttl` | — | `1h` |
| `compression.threshold` | `0.5` | `0.2` |
| `auxiliary.*.model` | `''` (inherit / Haiku from 34-1 era) | `gpt-5.4-mini` |
| `auxiliary.*.provider` | `auto` | `openai-codex` (explicit per block) |
| `auxiliary.curator.model` | `''` | `gpt-5.5` |
| Gateway env | `DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"` | unchanged pattern |

## Tasks / Subtasks

- [x] Back up or diff against `~/.hermes/config.yaml.backup-2026-05-17`.
- [x] Set main `model:` block to `openai-codex` / `gpt-5.5` / Codex `base_url` / `prompt_cache_ttl: 1h`.
- [x] Map all `auxiliary.*` blocks to `gpt-5.4-mini` + `openai-codex` (curator `gpt-5.5`).
- [x] Set `compression.threshold: 0.2`.
- [x] Restart gateway with `.env.live-chain` + `DISCORD_BOT_TOKEN` bridge.
- [x] Capture `agent.log` auxiliary routing evidence (2026-05-22 session).
- [x] Document retroactively in this story file.
- [x] Standing task: Operator guide — **no update required** (internal provider routing; existing § gateway token table still accurate).

## Dev Notes

### YAML duplicate-key caveat

Several `auxiliary` blocks list `provider:` twice (`auto` then `openai-codex`). PyYAML keeps the **last** key — effective provider is **`openai-codex`**. When editing, collapse to a single `provider:` line per block to avoid confusion.

### `prompt_caching.cache_ttl` vs `model.prompt_cache_ttl`

Current live config still has `prompt_caching.cache_ttl: 5m` while `model.prompt_cache_ttl: 1h`. Hermes normative TTL for Anthropic-style caching is **`prompt_caching.cache_ttl`** (`5m` or `1h` per Context7 / Hermes docs). Story **38-3** owns alignment and log verification; do not change here unless closing 38-1 required it (it did not).

### Gateway restart commands

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md
set -a && source .env.live-chain && set +a
export DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"
export DISCORD_ALLOW_ALL_USERS=true
hermes gateway stop   # or kill stale PID if status lies
nohup hermes gateway run >> ~/.hermes/logs/gateway-cron.log 2>&1 &
sleep 5 && hermes gateway status
```

Or: `bash scripts/hermes-gateway-start.sh` (idempotent).

### Anti-patterns

- Do **not** commit `~/.hermes/config.yaml` to Omnipotent.md.
- Do **not** edit canonical vault `AI-Context/AGENTS.md` for provider config (WriteGate).
- Do **not** change `scripts/run-chain.ts` LLM adapters in this story (see **38-2**).

### References

- [Source: `~/.hermes/config.yaml` — live post-migration state]
- [Source: `~/.hermes/config.yaml.backup-2026-05-17` — pre-migration baseline]
- [Source: `_bmad-output/implementation-artifacts/34-1-auxiliary-model-cost-reduction.md` — auxiliary mapping pattern]
- [Source: `_bmad-output/implementation-artifacts/36-1-sprint-hygiene-hermes-gateway-auto-start.md` — token bridge + launcher]
- [Source: git commit `f968ff8` — session-close 2026-05-22 mentions Codex OAuth migration]
- [Source: Context7 `/nousresearch/hermes-agent` — Codex runtime, auxiliary routing, `prompt_caching.cache_ttl`]

## Dev Agent Record

### Agent Model Used

Operator session 2026-05-22 (outside BMAD); story authored by Composer (create-story retro).

### Completion Notes List

- Main model: **`openai-codex` / `gpt-5.5`** with Codex `base_url` and **`prompt_cache_ttl: 1h`** on `model:` block.
- Auxiliary stack: **`gpt-5.4-mini`** on **`openai-codex`** for compression, session_search, skills_hub, vision, web_extract, approval, mcp, title_generation; **curator** on **`gpt-5.5`**.
- **`compression.threshold`**: `0.5` → `0.2`.
- Gateway restarted 2026-05-22 ~09:14 AEST; Discord connected **Hermes#9214**.
- Log evidence (auxiliary routing):
  - `2026-05-22 09:17:45 … Auxiliary title_generation: using openai-codex (gpt-5.4-mini) at https://chatgpt.com/backend-api/codex/`
  - `2026-05-22 09:23:37 … Auxiliary compression: using openai-codex (gpt-5.4-mini) at https://chatgpt.com/backend-api/codex/` (repeated through session-close compression split)
- Token bridge: `DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"` from `.env.live-chain` (same as 36-1).
- Repo: no `src/` changes; constitution bump in `f968ff8` is session-close metadata only.
- Post-close backup: `~/.hermes/config.yaml.backup-2026-05-22` created for AC7.

### File List

- `~/.hermes/config.yaml` (operator machine)
- `~/.hermes/config.yaml.backup-2026-05-17` (operator machine — pre-migration)
- `~/.hermes/config.yaml.backup-2026-05-22` (operator machine — post-migration)
- `_bmad-output/implementation-artifacts/38-1-provider-migration-documentation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`

## Change Log

- 2026-05-22: Story created retroactively; migration work already applied; marked **done** with log + config diff evidence.
