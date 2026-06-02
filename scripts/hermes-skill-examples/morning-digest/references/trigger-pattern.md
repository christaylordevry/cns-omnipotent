# Trigger pattern: `morning-digest` (Story 49-6, 55-1)

## Surface

- Discord `#hermes` only (scoped by Hermes `discord.allowed_channels` and per-channel skill binding).

## Canonical manual trigger grammar (Story 55-1)

After trimming leading/trailing whitespace on the full message, the **first non-empty line** is the trigger line. The message must be **single-line** for manual Discord triggers, with no additional non-empty lines.

The trigger line must satisfy **one** of:

1. **Exact token** — equals `morning-digest` (case-sensitive).
2. **Prefix + optional cron label** — begins with `morning-digest ` (literal lowercase token, trailing space) followed by exactly one token matching `cron:<label>` (for example, `cron:manual` for operator smoke). `<label>` may contain ASCII letters, digits, `_`, or `-`. Any other trailing text, such as `morning-digest extra`, does **not** trigger.

### Case rule

- Manual trigger token `morning-digest` is **case-sensitive** (aligned with `/notebook-query` discipline).
- `Morning-Digest`, `MORNING-DIGEST`, and mixed case **do not** trigger.

### Positive examples

```text
morning-digest
```

```text
morning-digest cron:manual
```

### Negative examples (must not run digest)

| Message | Why |
|---------|-----|
| `Morning-Digest` | Case mismatch |
| `morning-digest extra` | Trailing text is not `cron:<label>` |
| `morning-digest cron:manual now` | Multiple trailing tokens |
| `morning-digest extra token` | Multiple trailing tokens |
| `please run morning-digest` | Substring / wrong line-1 prefix |
| `morning-digest\nsecond line` | Multi-line manual message |
| `investigate-trend keyword: "x"` | Different skill prefix |

## Cron trigger (Hermes)

When invoked by Hermes scheduled job (not operator text), treat as authorized if the job references the `morning-digest` skill per `references/cron-snippet.md` (`--skill morning-digest`). Cron does **not** use the Discord line-1 grammar; §0 in `references/task-prompt.md` documents the cron pseudo-trigger.

Pseudo-trigger label for logs: `cron:morning-digest`.

## Failure modes (must not collect sources)

- Trigger line does not equal `morning-digest` and does not begin with `morning-digest ` per rules above.
- Message contains `morning-digest` only as a substring (not at line-1 prefix).
- Message has a second non-empty line (manual path).
- Message starts with a different skill prefix (e.g. `investigate-trend keyword:`).

## Operator-visible notes

- Posts back to **`#hermes`** only.
- No vault writes. No dashboard relay. Source order: Trends → NewsAPI → Perplexity → NotebookLM vault context (CLI only).
