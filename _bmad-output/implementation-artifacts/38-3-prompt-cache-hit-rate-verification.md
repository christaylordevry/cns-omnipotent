---
story_id: 38-3
epic: 38
title: prompt-cache-hit-rate-verification
status: done
---

# Story 38.3: Prompt cache hit rate verification

Status: done

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

- [x] Snapshot current `prompt_caching` + `model` cache TTL keys (before).
- [x] Set `prompt_caching.cache_ttl: 1h`; validate YAML; restart gateway.
- [x] Run ≥2-turn `#hermes` conversation (or CLI) within 60 minutes.
- [x] `grep -E 'cache=|Cache:' ~/.hermes/logs/agent.log` — capture hits after restart timestamp.
- [x] Write `epic-38-prompt-cache-evidence.md` with verdict.
- [x] If zero cache after 2 turns: document failure mode (wrong TTL key, provider not reporting `cached_tokens`, session split) and open defer follow-up.
- [x] Standing task: Operator guide — **no update** unless adding a troubleshooting bullet is warranted.

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
- [x] If adding cache-troubleshooting to Operator Guide: vault MCP update + version bump.
- [x] Else: "Operator guide: no update required" in Dev Agent Record.

### Review Findings

- [x] [Review][Patch] Evidence mislabels cache lines as post-restart — fixed: Phase A (pre-T0) vs Phase B (post-T0 `11:05:21`) in `epic-38-prompt-cache-evidence.md`.
- [x] [Review][Decision] AC2 sequencing vs CLI proof — resolved: post-restart `hermes chat -v` turn `20260522_110512_b15a26`, `cache=1536/19688 (8%)` after T0.
- [x] [Review][Patch] Story completion note contradicts timeline — fixed in Dev Agent Record below.
- [x] [Review][Patch] Evidence artifact untracked in git — staged for commit with story/sprint (`git add` at review close).
- [x] [Review][Defer] Discord `#hermes` lacks `API call #` in `agent.log` — documented in evidence §Observations; follow-up deferred to Hermes upstream/gateway logging.

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- Config backup: `~/.hermes/config.yaml.backup-2026-05-22-pre-38-3`
- Gateway restart T0: `2026-05-22 10:10:27` (`gateway.log`)
- CLI Phase A (pre-T0): `20260522_100927_1babb6` — warm-cache 12% → 99%
- CLI Phase B (post-T0, code review): `20260522_110512_b15a26` — `cache=1536/19688 (8%)` at `11:05:21`

### Completion Notes List

- Closed 38-1 TTL gap: `prompt_caching.cache_ttl` **5m → 1h**; `model.prompt_cache_ttl` already `1h`.
- Hermes code reads **`prompt_caching.cache_ttl`** only for `_cache_ttl`; `model.prompt_cache_ttl` is not referenced in Python (documented in evidence).
- Warm-cache proof (Phase A, pre-T0 during gateway stop): turn 1 `cache=2560/20740 (12%)`, turn 2 `cache=20480/20759 (99%)`.
- Post-restart audit (Phase B): `cache=1536/19688 (8%)` after T0 `10:10:27` (code review re-verify).
- Quiet CLI (`-Q`) may omit `API call #` lines from `agent.log`; use `-v` when capturing evidence (noted in evidence artifact).
- Operator guide: no update required.

### File List

- `_bmad-output/implementation-artifacts/epic-38-prompt-cache-evidence.md` (new)
- `_bmad-output/implementation-artifacts/38-3-prompt-cache-hit-rate-verification.md` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status)
- `~/.hermes/config.yaml` (operator — not in git)
- `~/.hermes/config.yaml.backup-2026-05-22-pre-38-3` (operator — not in git)

## Change Log

- 2026-05-22: Story created for Epic 38 — Cost + Provider Optimization.
- 2026-05-22: Implemented — TTL aligned, gateway restarted, cache hits verified (PASS). Evidence: `epic-38-prompt-cache-evidence.md`.
- 2026-05-22: Code review — timeline corrected; post-restart CLI re-verify (Phase B). Story → `done`.
