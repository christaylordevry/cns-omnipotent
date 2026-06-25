# cns-brain-recall — config snippet

Enable after install:

```bash
bash scripts/install-hermes-plugin-cns-brain-recall.sh
hermes plugins enable cns-brain-recall
```

Required env (WSL operator shell or `~/.hermes/.env`):

```bash
export CNS_OMNIPOTENT_ROOT=/home/christ/ai-factory/projects/Omnipotent.md
export CNS_BRAIN_INDEX_PATH=/abs/path/to/brain-index.json
export CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"
# optional: CNS_BRAIN_EMBEDDER=portal (must match index build)
# Hermes gateway/systemd PATH often lacks nvm — set explicit node if recall never fires:
# export CNS_NODE_BIN="$HOME/.nvm/versions/node/v24.14.0/bin/node"
# optional timeout overrides (defaults from policy prefetch block: 5s standard, 3s nexus-voice):
# export CNS_BRAIN_RECALL_PREFETCH_TIMEOUT_S=5
# export CNS_BRAIN_RECALL_VOICE_PREFETCH_TIMEOUT_S=3
```

Policy: `config/brain-recall-policy.json` — `shadow_mode: true` logs would-inject without injecting until Story 79-4 calibration pass. `prefetch.timeout_seconds` / `voice_pane_timeout_seconds` cap per-turn subprocess wait (fail-open on timeout).

Or add under `~/.hermes/config.yaml`:

```yaml
plugins:
  enabled:
    - cns-brain-recall
```

Disable (reversibility / NFR5):

```bash
hermes plugins disable cns-brain-recall
```

Revert live injection without disabling plugin: set `shadow_mode: true` in policy and restart Hermes session.
