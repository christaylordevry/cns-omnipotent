# Trigger pattern: `notebook-query` (Story 51-1)

## Surface

- Discord `#hermes` only (scoped by Hermes config `discord.allowed_channels` and per-channel skill binding).

## Canonical trigger grammar

The message must begin with the literal prefix `/notebook-query ` (case-sensitive, with a trailing space), followed by a non-empty question string.

### Positive triggers (examples)

```text
/notebook-query What are the PAKE validation rules?
/notebook-query how does the conservative scorer handle ambiguous domains
/notebook-query CNS vault architecture overview
```

### Question extraction rule

Take everything after the `/notebook-query ` prefix, trim leading and trailing whitespace. Truncate silently to 500 chars if longer (the scorer handles long text gracefully).

```
raw_message  = "/notebook-query What are the PAKE validation rules?"
question     = "What are the PAKE validation rules?"
```

## Failure modes (must not run the pipeline)

| Condition | Reply and stop |
|-----------|----------------|
| Message is exactly `/notebook-query` with no trailing text | `notebook-query: bad-trigger (question required)` |
| Message is `/notebook-query ` with whitespace-only text after prefix | `notebook-query: bad-trigger (question required)` |
| Message does not start with `/notebook-query ` | Do not handle; not this skill's trigger |

## Operator-visible notes

- This skill posts back to **`#hermes`** only.
- No vault writes. No dashboard relay. No NotebookLM fan-out.
- The `/notebook-query` prefix is case-sensitive. `/Notebook-Query` will not trigger.

## Runtime (agents)

> **REFERENCE ONLY at runtime.** Hermes `channel_skill_bindings` already matched this skill before the agent runs. Binding grammar in this file is for operators and `config.yaml` authors. At runtime, follow `references/task-prompt.md` §0 — do not re-check the prefix against extracted question text; validate question content only.
