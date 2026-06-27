# Trigger pattern: `run-chain` (Story 75-3)

## Surfaces

- **Discord `#hermes`** — multi-line brief (operator binding in `~/.hermes/config.yaml`; see `config-snippet.md`)
- **Hermes Desktop** — natural language equivalent ("run chain on topic X with query Y") maps to the same fields

## Canonical payload grammar (Discord)

After trimming leading/trailing whitespace, the message must begin with line 1 below. Lines 2+ may have optional leading spaces.

1. `run-chain topic: "<topic>"`
2. `query: "<primary query>"` (required; repeat for multiple queries)
3. `depth: shallow` | `depth: standard` | `depth: deep` (optional; default **`deep`** per `AI-Context/modules/run-chain.md`)
4. `evidence: <path>` (optional; maps to `--evidence-file`)

### Field rules

- **`<topic>`**: required, **single ASCII double-quoted** string on line 1 after `run-chain topic:`.
- **`query:`**: required, at least one line; each value is a double-quoted string → one `--query` flag.
- **`depth:`**: optional; exactly `shallow`, `standard`, or `deep`. Default **`deep`** when omitted.
- **`evidence:`**: optional bare or quoted path under repo or vault (e.g. `_bmad-output/run-chain-<slug>.md`).

### Positive trigger (example)

```text
run-chain topic: "AI agent orchestration"
  query: "multi-agent frameworks 2026"
  query: "reddit.com AI agent orchestration"
  depth: deep
  evidence: _bmad-output/run-chain-ai-agents.md
```

### Desktop / natural language

Map equivalent intent to the same CLI args:

- Topic → `--topic`
- Primary research question(s) → `--query` (repeatable)
- Shallow/standard/deep → `--depth`
- Optional evidence path → `--evidence-file`

## Failure modes (must not run terminal)

- Missing `run-chain topic:` first line.
- Topic not double-quoted.
- No `query:` line.
- Invalid `depth:` value (not shallow | standard | deep).

Reply with `run-chain: bad-payload` per `references/task-prompt.md` §1.

## Operator-visible notes

- Posts back to the **same Discord thread** or **Desktop session** that invoked the skill.
- No vault mutations in the default path.
- Chain may be **dormant** until Story **75-4** rotates `ANTHROPIC_API_KEY` — skill must report 401 explicitly.
