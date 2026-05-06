# Trigger pattern: `session-close` (Story 28.1)

## Surface

- Discord `#hermes` only, scoped by Hermes config `discord.allowed_channels`, `discord.free_response_channels`, and `discord.channel_skill_bindings`.

## Canonical command grammar

After trimming leading and trailing ASCII whitespace, the message must be a single line.

Positive triggers:

- `/session-close`
- `/session-close --dry-run`

Rules:

- `--dry-run` may appear once and only after `/session-close`.
- No other flags are accepted.
- No trailing free text is accepted.
- Multi-line messages are rejected before any tools run.

## Exclusivity

- URL-only messages remain owned by `hermes-url-ingest-vault`.
- Inbox commands remain owned by `triage`: `/triage`, `/approve`, and `/execute-approved`.
- `/session-close` must not fan out into triage or URL ingest.

## Config binding

Add `session-close` beside the existing CNS skills for the `#hermes` channel:

```yaml
discord:
  channel_skill_bindings:
    - id: '1500733488897462382'
      skills:
        - hermes-url-ingest-vault
        - triage
        - session-close
```

This documents the observed binding style in `~/.hermes/config.yaml`: one channel row with a `skills` list.
