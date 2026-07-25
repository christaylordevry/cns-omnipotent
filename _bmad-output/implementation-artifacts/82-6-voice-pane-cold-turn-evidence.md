# Story 82-6 — Voice-pane cold-turn evidence

**Date:** 2026-06-30  
**Policy version:** 0.2.1  
**Branch:** hermes-consolidation  

## Budget decision (operator note folded in)

True-cold latency is variable. Before locking the voice budget, dev measured true-cold (restart `hermes-proxy`, then prefetch) **≥3×**:

| Run | Procedure | Elapsed (s) |
|-----|-----------|-------------|
| 1 | `systemctl --user restart hermes-proxy` → prefetch | **3.51** |
| 2 | proxy restart → prefetch | **2.71** |
| 3 | proxy restart → prefetch | **2.73** |
| 4 | proxy restart → prefetch (post-impl) | **4.30** |
| (prior operator) | true-cold sample | **4.95** |
| (prior operator) | idle sample | **~3.2** |

**Worst observed:** 4.95s (operator). **Margin:** ~1s → **6s** `voice_pane_timeout_seconds` (not 5s). Warm-keep (AC1) remains the **mandatory primary fix**; 6s is headroom for jitter when warm-keep is missed.

Standard `prefetch.timeout_seconds` unchanged at **5**.

## Policy snapshot

```json
"prefetch": {
  "timeout_seconds": 5,
  "voice_pane_timeout_seconds": 6
},
"embedder_warm_keep": {
  "enabled": false,
  "ping_interval_minutes": 10,
  "warm_on_dashboard_start": true
}
```

Operator enables warm-keep: set `enabled: true`, then `bash scripts/install-brain-embedder-warm-cron.sh`.

## Timed prefetch (voice channel, policy 0.2.1)

Query: `CNS daily rhythm voice-smoke-82-6` · channel: `voice_pane` · `shadow_mode: false`

| Phase | Elapsed | Exit | channel | context |
|-------|---------|------|---------|---------|
| COLD (proxy restart) | 4.30s | 0 | voice_pane | non-empty |
| WARM (immediate repeat) | 1.65s | 0 | voice_pane | non-empty |

Both complete within **6s** voice budget.

## Warm-keep wiring

| Artifact | Purpose |
|----------|---------|
| `scripts/brain-embedder-warm.mjs` | CLI wrapper |
| `scripts/run-brain-embedder-warm.sh` | Cron entrypoint (NVM + brain-recall.env) |
| `scripts/install-brain-embedder-warm-cron.sh` | Idempotent cron tag `cns-brain-embedder-warm` + optional dashboard backgrounded `ExecStartPost` |

Warm ping: minimal `"warm"` embedding via `resolveBrainEmbedder()` → Portal `POST /v1/embeddings`. Skips with exit 0 when proxy down. Default **disabled** in policy.

## Sidecar / chip path

Existing plugin tests (`cns-brain-recall-plugin.test.ts`) cover recall-status sidecar write with `channel=voice_pane`, `injected=true` after successful prefetch.

**Live PTT chip:** accepted operator validation gate — restart proxy, enable warm-keep, first PTT on `localhost:5173/nexus` should show VoiceDrawer chip `voice_pane` (not `degraded`). Dev session did not run live PTT in this pass.

## Env keys (redacted)

Present in `~/.hermes/brain-recall.env` (names only):

- `CNS_OMNIPOTENT_ROOT`
- `CNS_BRAIN_INDEX_PATH`
- `CNS_VAULT_ROOT`
- `CNS_BRAIN_EMBEDDER=portal`
- `CNS_NODE_BIN`

## Verify gate

- `npm test`: **766 passed** (includes `tests/brain/embedder-warm.test.ts`)
- `bash scripts/verify.sh`: fails on **pre-existing** Hermes `session-close` skill parity drift (unchanged by this story; noted in AC4)

## Policy rationale table

| Scenario | Timeout | Expected prefetch | Outcome |
|----------|---------|-------------------|---------|
| Warm voice | 6s | ~1.7–2.1s | Sidecar + inject |
| Cold voice (no warm-keep) | 6s | ~3.5–4.95s | Borderline — warm-keep required for reliability |
| Cold voice + warm-keep | 6s | ~1.7–2.1s | Reliable first turn |
| Standard text | 5s | (unchanged) | No regression |
