# Optional Hermes config snippet (operator-owned)

This repo mirror is intended to be copied to:

- `~/.hermes/skills/cns/awareness-sync/`

Install:

```bash
bash scripts/install-hermes-skill-awareness-sync.sh
```

## Environment

Set in Hermes session or gateway env:

```bash
export OMNIPOTENT_REPO=/absolute/path/to/Omnipotent.md
```

Pull credentials live in **`~/.hermes/awareness-pull.env`** (not repo `.env.live-chain`):

```bash
cp scripts/awareness-pull.env.example ~/.hermes/awareness-pull.env
chmod 600 ~/.hermes/awareness-pull.env
# Edit: CONVEX_URL, HERMES_CONVEX_READ_KEY (names only in docs — never commit values)
```

## Example `#hermes` binding (conceptual)

In `~/.hermes/config.yaml`, bind `awareness-sync` on the Hermes channel **after** `investigate-trend`, **before** `morning-digest` (prefix discipline):

```yaml
discord:
  channel_skill_bindings:
    "<hermes-channel-id>":
      - investigate-trend
      - awareness-sync
      - morning-digest
      # ... other skills per scripts/hermes-skill-bindings-expected.json
```

Repo SSOT for expected bindings: `scripts/hermes-skill-bindings-expected.json`.

## Notes

- Skill uses **`terminal()`** only — no Convex MCP registration required for FR12 read path.
- Cron optional: `scripts/run-awareness-pull-cron.sh` every 3 min keeps cache warm; skill still supports on-demand refresh.
