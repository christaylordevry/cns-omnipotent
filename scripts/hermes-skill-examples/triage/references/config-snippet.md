# Optional Hermes config snippet (operator-owned)

This repo mirror is intended to be copied to:

- `~/.hermes/skills/cns/triage/`

Hermes Discord routing is upstream-dependent. Based on HI-6, the operator may bind the `#hermes` channel to a skill by name.

## Example (conceptual)

In `~/.hermes/config.yaml`, under your existing Discord section:

```yaml
discord:
  # existing keys...
  # allowed_channels: ["<hermes-channel-id>"]
  # free_response_channels: ["<hermes-channel-id>"]

  channel_skill_bindings:
    "<hermes-channel-id>": "triage"
```

If you already use `channel_skill_bindings` for another skill, ensure bindings do not conflict. Hermes delivers the full Discord line to the skill; `triage` accepts **`/triage`** plus optional **`--offset`** and an optional **single-line keyword phrase** per `references/trigger-pattern.md`.
