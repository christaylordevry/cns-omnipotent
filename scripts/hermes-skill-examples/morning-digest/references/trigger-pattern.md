# Trigger pattern: `morning-digest` (Story 49-6)

## Surface

- Discord `#hermes` only (scoped by Hermes `discord.allowed_channels` and per-channel skill binding).

## Manual trigger

After trimming leading/trailing whitespace, the **entire message** must match (case-insensitive):

```text
/morning-digest
```

Rules:

- Single line only (no extra words on the same message).
- No leading slash required.
- Do not run on messages that merely *contain* `morning-digest` as a substring.

### Positive examples

```text
/morning-digest
```

```text
  Morning-Digest
```

## Cron trigger (Hermes)

When invoked by Hermes scheduled job (not operator text), treat as authorized if the job name / instruction references `morning-digest` skill per `references/cron-snippet.md`.

Pseudo-trigger label for logs: `cron:morning-digest`.

## Failure modes (must not collect sources)

- Message has additional lines or tokens beyond the manual trigger.
- Message starts with a different skill prefix (e.g. `investigate-trend keyword:`).

## Operator-visible notes

- Posts back to **`#hermes`** only.
- No vault writes. No dashboard relay.
