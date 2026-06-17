# Blind Hunter Review Prompt

Use the `bmad-review-adversarial-general` skill.

Review only the complete change diff produced by these commands:

```bash
git diff 6dbf9ae052db55dab4348224bdb7d88d3b18574f -- \
  scripts/hermes-skill-examples/session-close/SKILL.md \
  tests/hermes-session-close-skill.test.mjs
git diff --no-index /dev/null \
  _bmad-output/implementation-artifacts/spec-session-close-vault-export-wrapper-paths.md
```

Do not read the spec as requirements, project files, conversation history, or context documents. Treat all command output as one diff input. Return the Markdown findings list required by the skill.
