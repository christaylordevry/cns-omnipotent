# Config snippet: `notebook-query` (Story 51-1)

This repo mirror is intended to be copied to:

- `~/.hermes/skills/cns/notebook-query/`

Hermes Discord routing is operator-owned. Bind the `#hermes` channel to the `notebook-query` skill in `~/.hermes/config.yaml`.

## Example (conceptual)

In `~/.hermes/config.yaml`, under your existing Discord section:

```yaml
discord:
  # existing keys...
  # allowed_channels: ["<hermes-channel-id>"]
  # free_response_channels: ["<hermes-channel-id>"]

  channel_skill_bindings:
    "<hermes-channel-id>": "notebook-query"
```

## CNS_REPO_ROOT environment variable

The resolver helper (`scripts/resolve-notebook.mjs`) imports the scorer and disambiguator from the CNS repo.
It defaults to `~/ai-factory/projects/Omnipotent.md` if `CNS_REPO_ROOT` is not set.

To override, set `CNS_REPO_ROOT` in the Hermes environment:

```yaml
# ~/.hermes/config.yaml
env:
  CNS_REPO_ROOT: /home/christ/ai-factory/projects/Omnipotent.md
```

Or add it to `~/.hermes/session-close.env` if you use that file for environment injection.

## Notebook registry path

The resolver reads `$CNS_REPO_ROOT/scripts/session-close/lib/notebook-registry.json` by default.
To override, set `CNS_NOTEBOOK_REGISTRY_PATH`:

```yaml
env:
  CNS_NOTEBOOK_REGISTRY_PATH: /path/to/custom/notebook-registry.json
```

## Notes

- Ensure `channel_skill_bindings` does not conflict with other skills bound to the same channel.
- The skill trigger is a single-line prefix `/notebook-query <question>` (see `references/trigger-pattern.md`).
- At least one notebook in the registry must have `watch: true` for queries to route successfully.
- The skill requires the `notebooklm` MCP to be authenticated (operator's Google session token).
