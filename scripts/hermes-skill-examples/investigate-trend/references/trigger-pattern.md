# Trigger pattern: `investigate-trend` (Story 49-4)

## Surface

- Discord `#hermes` only (scoped by Hermes config `discord.allowed_channels` and per-channel skill binding).

## Canonical payload grammar (exact 4-line form)

After trimming leading/trailing whitespace, the message must begin with the first line below; the remaining lines may have optional leading spaces.

1. `investigate-trend keyword: "<keyword>"`
2. `topicSlug: <topicSlug>`
3. `context: <context>`
4. `request: <request>`

### Field rules

- **`<keyword>`**: required, must be a **single ASCII double-quoted** string on line 1. Do not accept unquoted keywords in this story.
- **`<topicSlug>`**: required, a single “bare” token (no quotes). Example: `ai-agent-orchestration`
- **`<context>`**: required, freeform text (use the line verbatim in the reply).
- **`<request>`**: required, freeform text (used as intent framing; do not echo unless helpful).

### Positive trigger (example)

```text
investigate-trend keyword: "AI agent orchestration"
  topicSlug: ai-agent-orchestration
  context: GROWING · score: 0.78 · anomaly: +3.8σ at 14:32
  request: trace sources, assess momentum, recommend watch/ignore
```

## Failure modes (must not run Perplexity)

- Missing any required line or label.
- Keyword missing quotes or contains multiple quoted segments.
- Message does not start with `investigate-trend keyword:`.

## Operator-visible notes

- This skill posts back to **`#hermes`** only.
- No vault writes. No dashboard relay.
