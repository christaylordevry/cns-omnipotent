---
story_id: 38-3
epic: 38
title: prompt-cache-hit-rate-verification
status: ready-for-dev
---

# Story 38.3: Prompt cache hit rate verification

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,
I want **prompt cache effectiveness verified in `~/.hermes/logs/agent.log` with a 1-hour TTL**,
so that **we confirm Codex/ChatGPT prefix caching is saving cost after the 38-1 provider migration** and TTL config is not silently wrong.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 38: Cost + Provider Optimization |
| **Phase** | 7 |
| **Scope** | Operator verification + optional single-key config fix — **no** repo `src/` unless TTL fix requires docs only |
| **Live config (2026-05-22)** | `model.prompt_cache_ttl: 1h` **and** `prompt_caching.cache_ttl: 5m` (conflict — align per Hermes docs) |
| **Hermes normative TTL** | `prompt_caching.cache_ttl` must be **`5m`** or **`1h`** (Context7 / `context-compression-and-caching.md`) |
| **Log path** | `~/.hermes/logs/agent.log` (rotates; check `logging` settings in config) |

## Acceptance Criteria

1. **TTL aligned to 1h:** Set **`prompt_caching.cache_ttl: 1h`** in `~/.hermes/config.yaml`. Remove reliance on undocumented `model.prompt_cache_ttl` alone, or set both consistently if Hermes reads both (document which key took effect in evidence).
2. **Gateway restart** after TTL change with standard token bridge (`DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"`).
3. **Warm-cache exercise:** Within one hour, complete **≥2 agent turns** in the same Discord `#hermes` session (or CLI `hermes chat`) so prefix cache can hit (second turn should show non-zero cache read).
4. **Log evidence — API lines:** `agent.log` contains at least one **`API call #N:`** line with non-empty **`cache=<read>/<prompt> (<pct>%)`** suffix (Hermes `run_agent.py` format). Example shape:
   `API call #2: model=gpt-5.5 provider=openai-codex in=… out=… total=… latency=…s cache=12000/45000 (27%)`
5. **Log evidence — verbose cache line (optional):** If verbose logging enabled, may also see `💾 Cache: <cached>/<prompt> tokens (<pct>% hit, <written> written)`.
6. **Note on `cache_hit`:** User-facing checks may refer to **`cache_hit`** colloquially; Hermes agent.log uses **`cache=`** on API call lines, not a literal `cache_hit` token. Evidence section must quote **actual** log substrings found.
7. **Evidence artifact:** `_bmad-output/implementation-artifacts/epic-38-prompt-cache-evidence.md` with redacted log excerpts (timestamps, model, cache fraction), TTL before/after, and PASS/FAIL verdict.
8. **No vault IO**; no `verify.sh` unless repo docs updated.

## Tasks / Subtasks

- [ ] Snapshot current `prompt_caching` + `model` cache TTL keys (before).
- [ ] Set `prompt_caching.cache_ttl: 1h`; validate YAML; restart gateway.
- [ ] Run ≥2-turn `#hermes` conversation (or CLI) within 60 minutes.
- [ ] `grep -E 'cache=|Cache:' ~/.hermes/logs/agent.log` — capture hits after restart timestamp.
- [ ] Write `epic-38-prompt-cache-evidence.md` with verdict.
- [ ] If zero cache after 2 turns: document failure mode (wrong TTL key, provider not reporting `cached_tokens`, session split) and open defer follow-up.
- [ ] Standing task: Operator guide — **no update** unless adding a troubleshooting bullet is warranted.

## Dev Notes

### Config snippet (target state)

```yaml
model:
  provider: openai-codex
  default: gpt-5.5
  prompt_cache_ttl: 1h   # keep if Codex plugin reads it; verify in evidence
  base_url: https://chatgpt.com/backend-api/codex

prompt_caching:
  cache_ttl: 1h          # REQUIRED per Hermes docs — primary TTL control
```

### Verification commands

```bash
# After restart (note timestamp T0)
grep -E 'API call #[0-9]+:.*cache=' ~/.hermes/logs/agent.log | tail -20

# Optional broader search (achievements plugin also matches "cache hit" in transcripts)
grep -iE 'cache=|Cache:.*hit|prompt caching' ~/.hermes/logs/agent.log | tail -30

# Confirm startup banner (CLI)
# hermes chat -q "ping" -Q  # may print: Prompt caching: ENABLED (..., 1h TTL)
```

### Failure modes to check

| Symptom | Likely cause |
|---------|----------------|
| No `cache=` suffix ever | TTL still `5m` and session too short; or provider usage not exposing `cached_tokens` |
| `cache=0/…` on every call | Cold cache only — need second turn with stable system prompt |
| Session split mid-test | Compression split resets session — use turns **before** split or disable compression for test |
| Only `prompt_cache_ttl` set | `prompt_caching.cache_ttl` still `5m` — **38-3 AC1** |

### Relationship to 38-1

38-1 set `model.prompt_cache_ttl: 1h` during Codex migration but left `prompt_caching.cache_ttl: 5m`. This story **closes that gap** and proves caching in logs.

### Anti-patterns

- Do **not** treat missing literal `cache_hit` as failure without checking `cache=` format.
- Do **not** commit operator logs to git (evidence file uses redacted excerpts only).

### References

- [Source: `~/.hermes/config.yaml` — `model.prompt_cache_ttl`, `prompt_caching`]
- [Source: `~/.hermes/hermes-agent/run_agent.py` ~L11660–11636 — `cache=` log suffix]
- [Source: `_bmad-output/implementation-artifacts/38-1-provider-migration-documentation.md`]
- [Source: Context7 `/nousresearch/hermes-agent` — `prompt_caching.cache_ttl`, Codex prefix caching]

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If adding cache-troubleshooting to Operator Guide: vault MCP update + version bump.
- [ ] Else: "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

(pending dev-story)

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-05-22: Story created for Epic 38 — Cost + Provider Optimization.
