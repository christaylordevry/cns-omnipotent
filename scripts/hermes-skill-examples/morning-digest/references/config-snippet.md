# Optional Hermes config snippet (operator-owned)

Copy skill to `~/.hermes/skills/cns/morning-digest/` via:

```bash
bash scripts/install-hermes-skill-morning-digest.sh
```

Automated daily run (Story 55-3):

```bash
bash scripts/install-morning-digest-cron.sh
```

## `#hermes` skill binding

In `~/.hermes/config.yaml`, add or extend `discord.channel_skill_bindings` for the `#hermes` channel ID (see Operator Guide §15.1).

If `#hermes` already binds other skills (`triage`, `session-close`, `investigate-trend`, …), **add** `morning-digest` per your Hermes version’s multi-skill routing — do **not** replace the whole binding with a single skill. Triggers must stay distinct (`morning-digest` line-1 token vs `investigate-trend keyword:`).

**Recommended binding order** (router scans in list order; Story 55-1):

```yaml
discord:
  channel_skill_bindings:
    # Example only — merge with your live bindings; do not wipe existing skills.
    "<hermes-channel-id>":
      - hermes-url-ingest-vault
      - triage
      - session-close
      - vault-lint
      - vault-think
      - vault-graduate
      - investigate-trend
      - morning-digest
      - notebook-query
```

Place **`morning-digest` immediately after `investigate-trend`** so prefix triggers stay unambiguous. After reordering bindings, run **`/new`** in `#hermes` or restart the gateway session so injected skill context refreshes.

Replace `<hermes-channel-id>` with your live `#hermes` id.

## `channel_prompts` — explicit routing line (Story 55-1)

Live `#hermes` prompts often list `/triage`, `/session-close`, and vault-* commands but omit skill triggers. Add a line so the model prioritizes `skill_view` + task-prompt for this skill:

```yaml
discord:
  channel_prompts:
    "<hermes-channel-id>": |
      …existing prompt lines…
      - For a daily trend briefing: when the operator posts single-line `morning-digest` or `morning-digest cron:<label>` (case-sensitive) in this channel, use the morning-digest skill. First call skill_view("morning-digest", "references/task-prompt.md"), then execute the full digest contract — do not summarize the skill or ask whether to proceed.
```

Merge with your existing `channel_prompts` block; do **not** replace the whole prompt.

## Optional schedule keys

Reference cron expression for `install-morning-digest-cron.sh` — **WSL line uses `CRON_TZ=Australia/Sydney`**:

```yaml
morning_digest:
  cron: "0 7 * * *"
```

Environment override (same 5-field cron; takes precedence over YAML when install runs):

```bash
export MORNING_DIGEST_CRON="0 7 * * *"
```

Changing YAML or env alone does **not** reschedule the Hermes job until you re-run `bash scripts/install-morning-digest-cron.sh`.

## Credentials (not in this repo)

| Secret / file | Purpose |
|---------------|---------|
| `~/.hermes/trend-ingest.env` | `NEWSAPI_API_KEY` |
| `~/.hermes/trend-watchlist.yaml` | Google Trends watchlist |
| `OMNIPOTENT_REPO` | Optional; defaults to clone path in task-prompt |
| `.env.live-chain` | `HERMES_DISCORD_TOKEN` for cron tick delivery |

## Coexistence

- **investigate-trend**: bound to same channel with different trigger prefix — OK.
- **Legacy 26-7**: comment out WSL crontab line in Operator Guide §15.2 when this skill cron is active.
