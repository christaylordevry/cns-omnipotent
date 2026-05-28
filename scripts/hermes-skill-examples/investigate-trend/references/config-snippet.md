# Optional Hermes config snippet (operator-owned)

This repo mirror is intended to be copied to:

- `~/.hermes/skills/cns/investigate-trend/`

Hermes Discord routing is operator-owned. Bind the `#hermes` channel to the `investigate-trend` skill in `~/.hermes/config.yaml`.

## Example (conceptual)

In `~/.hermes/config.yaml`, under your existing Discord section:

```yaml
discord:
  # existing keys...
  # allowed_channels: ["<hermes-channel-id>"]
  # free_response_channels: ["<hermes-channel-id>"]

  channel_skill_bindings:
    "<hermes-channel-id>": "investigate-trend"
```

Notes:

- Ensure this binding does not conflict with other skills bound to the same channel.
- The skill trigger is a **multi-line payload** starting with `investigate-trend keyword:` (see `references/trigger-pattern.md`).
