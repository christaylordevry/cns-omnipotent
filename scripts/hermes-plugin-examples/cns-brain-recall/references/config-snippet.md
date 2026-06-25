# cns-brain-recall — config snippet

Enable after install:

```bash
bash scripts/install-hermes-plugin-cns-brain-recall.sh
hermes plugins enable cns-brain-recall
```

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
