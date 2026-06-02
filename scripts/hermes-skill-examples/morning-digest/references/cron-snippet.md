# Cron: `morning-digest` (Story 49-6, 55-3)

## One-command install (Story 55-3)

```bash
bash scripts/install-morning-digest-cron.sh
```

Installs:
- WSL crontab line tagged **`cns-morning-digest-skill`** (real schedule, default **07:00 Sydney**)
- Hermes cron job **`morning-digest`** with `--skill morning-digest --deliver discord` and **dummy** Hermes schedule (`0 0 1 1 *`) — WSL is the sole trigger (26-7 pattern)
- Job id file: `~/.hermes/morning-digest-skill-cron-job-id`

Log: `~/.hermes/logs/morning-digest-skill-cron.log`

## Schedule default

- **07:00 Australia/Sydney** — `0 7 * * *` with `CRON_TZ=Australia/Sydney` on the WSL crontab line.
- Handles AEDT/AEST automatically via `CRON_TZ`; normative civil time is Sydney, not machine-local.
- UTC equivalent (standard time only): **21:00 UTC previous calendar day** — do not hard-code UTC offset alone (DST).

Overrides (re-run install after changing):

- Env: `MORNING_DIGEST_CRON` (5-field expression).
- Config: `morning_digest.cron` in `~/.hermes/config.yaml` (see `references/config-snippet.md`).

## Hermes cron job

Gateway must be running (same posture as Story 26-7 / 55-3 runner).

Manual create (install script preferred):

```bash
# WSL civil-time schedule (operator reference):
MORNING_DIGEST_CRON="${MORNING_DIGEST_CRON:-0 7 * * *}"

# Hermes job: dummy schedule — WSL calls run-morning-digest-cron.sh at MORNING_DIGEST_CRON
hermes cron create "0 0 1 1 *" \
  "Run morning-digest skill: collect Google Trends, NewsAPI, Perplexity; post Morning Digest contract to Discord." \
  --skill morning-digest \
  --name morning-digest \
  --deliver discord
```

`morning_digest.cron` in `~/.hermes/config.yaml` is an **operator reference** for the WSL crontab expression used by `install-morning-digest-cron.sh`. Changing YAML or env alone does **not** reschedule until you re-run `bash scripts/install-morning-digest-cron.sh` (or remove + recreate manually).

## WSL crontab (installed by `install-morning-digest-cron.sh`)

```cron
0 7 * * * CRON_TZ=Australia/Sydney /bin/bash "<repo>/scripts/run-morning-digest-cron.sh" >>"$HOME/.hermes/logs/morning-digest-skill-cron.log" 2>&1 # cns-morning-digest-skill
```

`run-morning-digest-cron.sh` checks `hermes gateway status`, then runs `hermes cron run <job-id>` and `hermes cron tick`. It does **not** post Discord text `morning-digest` (skill cron path per Story 55-1).

## Migration from Story 26-7

- **Disable** the legacy **07:00** line calling `scripts/hermes-morning-digest.sh` (comment out in `crontab -e`) — see Operator Guide §15.2.
- **Keep** 26-7 scripts in the repo for manual fallback.
- Do not confuse `~/.hermes/morning-digest-cron-job-id` (26-7) with **`~/.hermes/morning-digest-skill-cron-job-id`** (this skill).

## Gateway failure

If `hermes gateway status` does not show a running gateway, do not claim Discord delivery. Exit non-zero from `run-morning-digest-cron.sh`; retry on next schedule.
