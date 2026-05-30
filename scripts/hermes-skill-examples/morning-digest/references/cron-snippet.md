# Cron: `morning-digest` (Story 49-6)

## Schedule default

- **08:00 machine-local** — `0 8 * * *` (five-field cron).
- Uses WSL/Linux **system timezone** and optional `process.env.TZ`. **Do not** set `CRON_TZ` to a fixed region in repo docs for this skill.

Overrides:

- Env: `MORNING_DIGEST_CRON` (5-field expression).
- Config: `morning_digest.cron` in `~/.hermes/config.yaml` (see `references/config-snippet.md`).

## Hermes cron job (preferred)

Gateway must be running (same posture as Story 26-7 launcher).

```bash
MORNING_DIGEST_CRON="${MORNING_DIGEST_CRON:-0 8 * * *}"
hermes cron create "$MORNING_DIGEST_CRON" \
  "Run morning-digest skill: collect Google Trends, NewsAPI, Perplexity; post Morning Digest contract to Discord." \
  --skill morning-digest \
  --name morning-digest \
  --deliver discord
```

If you use `morning_digest.cron` in `~/.hermes/config.yaml`, copy that value into `MORNING_DIGEST_CRON` before creating or recreating the Hermes cron job. Hermes stores the schedule on the cron job; changing the env var or YAML later requires removing and recreating the job.

Record job id (optional operator file):

```bash
hermes cron list | grep morning-digest
# echo "<id>" > ~/.hermes/morning-digest-skill-cron-job-id
```

Remove / recreate after schedule changes:

```bash
hermes cron remove <id>
```

## WSL crontab alternative

If you mirror the 26-7 pattern (external tick + `hermes cron run`), use **machine-local** time only:

```cron
# 0 8 * * * /usr/bin/env bash -lc 'hermes gateway status | grep -qi "gateway is running" && hermes cron run <job-id> && hermes cron tick'
```

Adjust `<job-id>` from `hermes cron list`. Log to `~/.hermes/logs/morning-digest-skill-cron.log` if desired.

## Migration from Story 26-7

- **Disable** the legacy **07:00** line calling `scripts/hermes-morning-digest.sh` (comment out in `crontab -e`) — see Operator Guide §15.2.
- **Keep** 26-7 scripts in the repo for manual fallback.
- Optional: `hermes cron remove <id>` for job in `~/.hermes/morning-digest-cron-job-id` when fully retired.

## Gateway failure

If `hermes gateway status` does not show a running gateway, do not claim Discord delivery. Exit non-zero from any wrapper script; retry on next schedule.
