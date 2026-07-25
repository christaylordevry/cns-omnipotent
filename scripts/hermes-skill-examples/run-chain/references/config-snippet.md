# Optional Hermes config snippet (operator-owned)

This repo mirror is intended to be copied to:

- `~/.hermes/skills/cns/run-chain/`

Hermes Discord routing is operator-owned. Bind the `#hermes` channel to the `run-chain` skill in `~/.hermes/config.yaml` when you want Discord-triggered chain runs.

## Example (conceptual)

In `~/.hermes/config.yaml`, under your existing Discord section:

```yaml
discord:
  # existing keys...
  # allowed_channels: ["<hermes-channel-id>"]
  # free_response_channels: ["<hermes-channel-id>"]

  channel_skill_bindings:
    "<hermes-channel-id>": "run-chain"
```

## Session environment

Hermes subprocesses need **`OMNIPOTENT_REPO`** (absolute path to Omnipotent.md). Mirror the verify-gate / session-close pattern:

```bash
export OMNIPOTENT_REPO=/home/christ/ai-factory/projects/Omnipotent.md
```

Operator WSL fallback documented in task-prompt when unset.

## Optional `terminal.env_passthrough`

Prefer inline `source .env.live-chain` in the same shell command as `npx tsx` (triage / module SSOT pattern). Only if Hermes `terminal()` cannot see sourced vars, add passthrough for **names** (never commit values):

```yaml
# ~/.hermes/config.yaml (illustrative — operator-owned)
terminal:
  env_passthrough:
    - FIRECRAWL_API_KEY
    - ANTHROPIC_API_KEY
    - APIFY_API_TOKEN
    - OPENROUTER_API_KEY
    - CNS_SYNTHESIS_MODEL
    - PERPLEXITY_API_KEY
    - CNS_VAULT_ROOT
```

Values remain in gitignored `$OMNIPOTENT_REPO/.env.live-chain`.

## Notes

- `run-chain` is **not** in the default `parity_skills` trio — install via `scripts/install-hermes-skill-run-chain.sh`.
- Binding conflicts: only one skill per channel unless operator uses message-prefix routing documented for their gateway version.
