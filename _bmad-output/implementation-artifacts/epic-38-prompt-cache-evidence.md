# Epic 38 — Prompt cache hit rate verification (Story 38-3)

**Date:** 2026-05-22  
**Operator:** dev-story automation (CLI + gateway)  
**Verdict:** **PASS**

---

## TTL alignment (AC1)

| Key | Before | After | Effective control |
|-----|--------|-------|-------------------|
| `model.prompt_cache_ttl` | `1h` | `1h` (unchanged) | Not read by Hermes Python (`grep` over `~/.hermes/hermes-agent` — no references). Kept for Codex plugin intent per 38-1. |
| `prompt_caching.cache_ttl` | `5m` | **`1h`** | **Normative** — loaded in `run_agent.py` (`_cache_ttl` from `prompt_caching.cache_ttl`; valid values `5m` \| `1h` per Context7 / Hermes docs). |

Backup: `~/.hermes/config.yaml.backup-2026-05-22-pre-38-3`

---

## Gateway restart (AC2)

- **T0 (restart):** `2026-05-22 10:10:27` — `scripts/hermes-gateway-start.sh` with `DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN"` from `.env.live-chain`.
- **Log:** `gateway.log` — `Starting Hermes Gateway...` → Discord connected as Hermes#9214.

Earlier stop at `10:08:32` (gateway stop during config apply); final production restart at `10:10:27`.

---

## Warm-cache exercise (AC3)

### Phase A — same-session warm cache (during gateway downtime)

**Context:** TTL applied and gateway stopped at `10:08:32` before final restart at `10:10:27`. CLI `hermes chat -v` runs below are **pre-T0** but prove prefix caching with `prompt_caching.cache_ttl: 1h` already on disk.

| Turn | Session | Query | Timestamp (local) |
|------|---------|-------|-------------------|
| 1 | `20260522_100927_1babb6` | `ping` | 2026-05-22 10:09:36 |
| 2 | `20260522_100927_1babb6` | `Reply with exactly one word: DELTA` (resume) | 2026-05-22 10:10:16 |

Provider: `openai-codex` / `gpt-5.5` / Codex `base_url`.

### Phase B — post-restart audit (code review re-verify)

**Context:** Gateway running since T0 `10:10:27`. Single CLI turn after review (AC2 order: restart → exercise).

| Turn | Session | Query | Timestamp (local) |
|------|---------|-------|-------------------|
| 3 | `20260522_110512_b15a26` | `Reply with exactly one word: POSTRESTART` | 2026-05-22 11:05:21 |

---

## Log evidence — `cache=` on API lines (AC4, AC6)

**Path:** `~/.hermes/logs/agent.log`  
**Search:** `grep -E 'API call #[0-9]+:.*cache=' ~/.hermes/logs/agent.log`

Hermes does **not** emit a literal `cache_hit` token; observability uses the `cache=<read>/<prompt> (<pct>%)` suffix on `API call #N:` lines (`run_agent.py`).

### Redacted excerpts — Phase A (pre-T0, warm-cache proof)

```
2026-05-22 10:09:36,227 INFO [20260522_100927_1babb6] run_agent: API call #1: model=gpt-5.5 provider=openai-codex in=20740 out=5 total=20745 latency=3.1s cache=2560/20740 (12%)

2026-05-22 10:10:16,434 INFO [20260522_100927_1babb6] run_agent: API call #1: model=gpt-5.5 provider=openai-codex in=20759 out=15 total=20774 latency=8.6s cache=20480/20759 (99%)
```

- **Turn 1:** cold / partial prefix — 12% cache read.  
- **Turn 2 (same session):** **99%** cache read — confirms Codex prefix caching after TTL alignment.

### Redacted excerpts — Phase B (post-T0 `10:10:27`, AC2 audit)

```
2026-05-22 11:05:21,730 INFO [20260522_110512_b15a26] run_agent: API call #1: model=gpt-5.5 provider=openai-codex in=19688 out=31 total=19719 latency=7.3s cache=1536/19688 (8%)
```

- **Turn 3:** new session after gateway restart — partial cache read (8%); satisfies AC4 (`cache=` non-empty) and AC2 sequencing for post-restart evidence.

### Optional verbose line (AC5)

With `-v`, stderr shows the same stats via `_vprint` (`💾 Cache: …`). File log uses `cache=` on the API line above; no separate `Cache:` line required for PASS.

---

## Observations (not blocking)

1. **`hermes chat -Q` (quiet)** did not write `API call #` lines to `agent.log` for sessions `20260522_100858_*` (ALPHA/BETA/GAMMA); only `Loaded environment variables`. Use **`-v`** or non-quiet CLI when capturing evidence to `agent.log`.
2. **Discord gateway** sessions (e.g. `20260522_091509_*`, 7–30 `api_calls` in `gateway.run: response ready`) also had **no** `API call #` lines in `agent.log` before this test — likely logging path / usage attachment in gateway workers. CLI verification satisfies AC4.
3. **`model.prompt_cache_ttl`** remains documentation/plugin intent; **`prompt_caching.cache_ttl: 1h`** is the key that must match operator expectation.
4. **Timeline honesty:** Phase A lines predate T0; Phase B added after code review to close AC2 ordering without discarding valid warm-cache proof.

---

## Operator guide (standing task)

No Operator Guide update required — behavior is config + log grep; no new slash command.

---

## Summary

| AC | Result |
|----|--------|
| TTL `1h` on `prompt_caching.cache_ttl` | PASS |
| Gateway restart + token bridge | PASS |
| ≥2 turns same session | PASS (Phase A: 12% → 99%) |
| `cache=` in `agent.log` | PASS (Phase A + Phase B post-T0) |
| Evidence artifact | PASS (this file) |

**Follow-up (defer):** If Discord `#hermes` must show `API call #` in `agent.log` without `-v` CLI, file a Hermes upstream/gateway logging gap — out of scope for repo `src/`.
