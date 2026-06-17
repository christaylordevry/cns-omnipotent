# Edge Case Hunter Review Prompt

Use the `bmad-review-edge-case-hunter` skill.

Build the complete change diff:

```bash
git diff 6dbf9ae052db55dab4348224bdb7d88d3b18574f -- \
  scripts/hermes-skill-examples/session-close/SKILL.md \
  tests/hermes-session-close-skill.test.mjs
git diff --no-index /dev/null \
  _bmad-output/implementation-artifacts/spec-session-close-vault-export-wrapper-paths.md
```

Treat the combined output as `content`. You may read the project only to trace boundaries directly referenced by changed lines. Return only the JSON array required by the skill.
