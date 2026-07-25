# Optional Hermes config snippet (operator-owned)

Copy skill to `~/.hermes/skills/cns/unified-loop/` via:

```bash
bash scripts/install-hermes-skill-unified-loop.sh
```

Discover-only cron (Story 84-1):

```bash
bash scripts/install-unified-loop-discover-cron.sh
```

## `#hermes` skill binding

In `~/.hermes/config.yaml`, add or extend `discord.channel_skill_bindings` for the `#hermes` channel ID (see Operator Guide §15.1).

If `#hermes` already binds other skills, **add** `unified-loop` per your Hermes version's multi-skill routing — do **not** replace the whole binding.

**Recommended binding order** (router scans in list order):

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
      - awareness-sync
      - morning-digest
      - unified-loop
      - notebook-query
```

Place **`unified-loop` after `morning-digest`** (or adjacent read-only skills) so prefix triggers stay unambiguous (`unified-loop` vs `morning-digest` vs `awareness-sync`). After reordering bindings, run **`/new`** in `#hermes` or restart the gateway session.

Replace `<hermes-channel-id>` with your live `#hermes` id.

## `channel_prompts` — explicit routing line

```yaml
discord:
  channel_prompts:
    "<hermes-channel-id>": |
      …existing prompt lines…
      - For Unified Loop Discover: when the operator posts single-line `unified-loop`, `unified-loop cron:discover`, or `unified-loop approve-build` (case-sensitive) in this channel, use the unified-loop skill. First call skill_view("unified-loop", "references/task-prompt.md"), then execute per trigger — Discover cron path is read-only; manual `unified-loop` pauses at approval gate.
```

Merge with your existing `channel_prompts` block; do **not** replace the whole prompt.

## Optional `unified_loop:` config block

Reference cron expression for `install-unified-loop-discover-cron.sh`:

```yaml
unified_loop:
  discover_cron: "0 8 * * *"
```

Environment override (takes precedence over YAML when install runs):

```bash
export UNIFIED_LOOP_DISCOVER_CRON="0 8 * * *"
```

Changing YAML or env alone does **not** reschedule until you re-run `bash scripts/install-unified-loop-discover-cron.sh`.

## Credentials (not in this repo)

| Secret / file | Purpose |
|---------------|---------|
| `OMNIPOTENT_REPO` | Absolute Omnipotent.md checkout for collector |
| `CNS_VAULT_ROOT` | Vault root for agent_log / vault_scan categories |
| `.env.live-chain` | `HERMES_DISCORD_TOKEN` for cron tick delivery |

## Coexistence

- **run-chain** skill: separate trigger (`run-chain topic:`) — protect-list adapters unchanged (NFR2).
- **session-close**: Persist stage (84-3) routes through session-close WriteGate — not on Discover path.
