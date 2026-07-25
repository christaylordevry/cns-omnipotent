# Cron: `unified-loop` Discover-only (Story 84-1)

## One-command install

```bash
bash scripts/install-unified-loop-discover-cron.sh
```

Installs:

- WSL crontab line tagged **`cns-unified-loop-discover`** (operator-chosen schedule; default documented below)
- Hermes cron job **`unified-loop-discover`** with `--skill unified-loop --deliver discord` and **dummy** Hermes schedule (`0 0 1 1 *`) — WSL is the sole civil-time trigger (morning-digest / 26-7 pattern)
- Job id file: `~/.hermes/unified-loop-discover-cron-job-id`

Log: `~/.hermes/logs/unified-loop-discover-cron.log`

## Schedule default

Suggested operator schedule (override via `UNIFIED_LOOP_DISCOVER_CRON` env or re-run install):

- Example: **08:00 Australia/Sydney** — `0 8 * * *` with `CRON_TZ=Australia/Sydney` on the WSL crontab line.

## Hermes cron job

Gateway must be running (same posture as Story 26-7 / 55-3 runner).

Manual create (install script preferred):

```bash
hermes cron create "0 0 1 1 *" \
  "Run unified-loop skill Discover-only: collect internal dev state, write discover.json, post bounded #hermes summary." \
  --skill unified-loop \
  --name unified-loop-discover \
  --deliver discord
```

## WSL crontab (installed by `install-unified-loop-discover-cron.sh`)

```cron
0 8 * * * CRON_TZ=Australia/Sydney /bin/bash "<repo>/scripts/run-unified-loop-discover-cron.sh" >>"$HOME/.hermes/logs/unified-loop-discover-cron.log" 2>&1 # cns-unified-loop-discover
```

`run-unified-loop-discover-cron.sh`:

1. Checks `hermes gateway status` (warn/abort if not running)
2. Runs `hermes cron run <job-id>` + `hermes cron tick`
3. Does **not** post raw Discord text `unified-loop` — skill cron path only

## Discover-only guarantee

- `approvals.cron_mode: deny` in `~/.hermes/config.yaml` — fully autonomous Build impossible
- Cron path invokes skill with Discover-only contract (`unified-loop cron:discover` semantics)
- **Never** wire Verify review skills or Build on recurring schedule in 84-1

## Gateway failure

If `hermes gateway status` does not show a running gateway, exit non-zero from `run-unified-loop-discover-cron.sh`; retry on next schedule.

## Coexistence

- **morning-digest** / **awareness-sync**: distinct triggers and cron tags — OK on same host.
- Install: `bash scripts/install-hermes-skill-unified-loop.sh` before first cron run.
