# Optional Hermes config snippet

Install destination:

- `~/.hermes/skills/cns/session-close/`

Bind the `#hermes` channel to the skill list that already owns CNS Discord commands:

```yaml
discord:
  channel_skill_bindings:
    - id: '1500733488897462382'
      skills:
        - hermes-url-ingest-vault
        - triage
        - session-close
```

## Environment (required for Phase A scripts)

Create `~/.hermes/session-close.env` (mode `600`):

```bash
OMNIPOTENT_REPO=/home/christ/ai-factory/projects/Omnipotent.md
CNS_VAULT_ROOT=/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE
```

Adjust paths when your checkout or vault root moves.

### Gateway export (same pattern as `dashboard-sync.env`)

Hermes Discord sessions must see `OMNIPOTENT_REPO` and `CNS_VAULT_ROOT` in the gateway process environment before `/session-close` runs. Mirror the dashboard-sync pattern:

1. Keep secrets and paths in `~/.hermes/session-close.env` (not in git).
2. Source that file from whatever starts `hermes gateway run` (shell wrapper, systemd unit, or tmux launcher), for example:

```bash
set -a
# shellcheck disable=SC1090
source "${HOME}/.hermes/session-close.env"
set +a
exec hermes gateway run
```

Cron jobs use a dedicated wrapper (`scripts/run-dashboard-sync-cron.sh` sources `dashboard-sync.env` under bash). Session-close has no cron wrapper; the gateway launcher is the supported export point.

If `OMNIPOTENT_REPO` is unset, the skill falls back to this fixed host path (documented fallback only):

```bash
/home/christ/ai-factory/projects/Omnipotent.md
```

Prefer explicit `OMNIPOTENT_REPO` in `session-close.env` so Hermes and `run-deterministic.mjs` resolve the same tree.
