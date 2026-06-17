# Acceptance Auditor Review Prompt

Audit the implementation against:

- `_bmad-output/implementation-artifacts/spec-session-close-vault-export-wrapper-paths.md`
- `project-context.md`
- `_bmad-output/implementation-artifacts/58-1-migrate-vault-export-drive-doc-sync.md`

Build the complete change diff:

```bash
git diff 6dbf9ae052db55dab4348224bdb7d88d3b18574f -- \
  scripts/hermes-skill-examples/session-close/SKILL.md \
  tests/hermes-session-close-skill.test.mjs
git diff --no-index /dev/null \
  _bmad-output/implementation-artifacts/spec-session-close-vault-export-wrapper-paths.md
```

Check every frozen intent constraint, task, acceptance criterion, context rule, and verification claim. Inspect referenced project files where needed. Return findings ordered by severity with exact file and line references. If no finding exists, state that clearly and list residual manual-validation risk.
