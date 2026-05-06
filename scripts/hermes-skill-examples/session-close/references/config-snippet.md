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

`/session-close` first uses absolute `OMNIPOTENT_REPO` from the Hermes process environment. If it is unset, the skill uses this fixed host fallback:

```bash
/home/christ/ai-factory/projects/Omnipotent.md
```

Set `OMNIPOTENT_REPO` only when the checkout moves.
