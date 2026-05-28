# Optional Hermes config snippet (operator-owned)

Copy skill to `~/.hermes/skills/cns/morning-digest/` via:

```bash
bash scripts/install-hermes-skill-morning-digest.sh
```

## `#hermes` skill binding

In `~/.hermes/config.yaml`, add or extend `discord.channel_skill_bindings` for the `#hermes` channel ID (see Operator Guide §15.1).

If `#hermes` already binds other skills (`triage`, `session-close`, `investigate-trend`, …), **add** `morning-digest` per your Hermes version’s multi-skill routing — do **not** replace the whole binding with a single skill. Triggers must stay distinct (`morning-digest` vs `investigate-trend keyword:`).

```yaml
discord:
  channel_skill_bindings:
    # Example only — merge with your live bindings; do not wipe existing skills.
    "1500733488897462382":
      - triage
      - session-close
      - investigate-trend
      - morning-digest
```

Replace the channel ID with your live `#hermes` id if different. If your Hermes build uses a string binding per channel, follow upstream docs and keep coexistence notes in Operator Guide §15.11.

## Optional schedule keys

Cron expression only — **no timezone key** (machine local via WSL/Linux system TZ and optional `process.env.TZ`):

```yaml
morning_digest:
  cron: "0 8 * * *"
```

Environment override (same 5-field cron):

```bash
export MORNING_DIGEST_CRON="0 8 * * *"
```

## Credentials (not in this repo)

| Secret / file | Purpose |
|---------------|---------|
| `~/.hermes/trend-ingest.env` | `NEWSAPI_API_KEY` |
| `~/.hermes/trend-watchlist.yaml` | Google Trends watchlist |
| `OMNIPOTENT_REPO` | Optional; defaults to clone path in task-prompt |

## Coexistence

- **investigate-trend**: bound to same channel with different trigger — OK.
- **Legacy 26-7**: comment out WSL crontab line in Operator Guide §15.2 when this skill is active.
