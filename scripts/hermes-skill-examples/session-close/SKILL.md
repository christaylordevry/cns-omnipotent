---
name: session-close
description: "Hermes CNS /session-close router. Runs deterministic Phase A, then bounded Section 8 synthesis using only the context pack, applies Section 8, and renders a Discord reply from the close report."
version: 1.0.1
author: CNS Operator
license: MIT
metadata:
  hermes:
    tags: [cns, hermes, session-close, agents-md, notebooklm]
    requires_toolsets: [terminal]
    related_skills: ["hermes-url-ingest-vault", "triage"]
---

# Hermes CNS session close (SC-5 router)

## Trigger

Follow `references/trigger-pattern.md`. Only accept:

- `/session-close`
- `/session-close --dry-run`

Reject everything else (extra flags, trailing text, multi-line input). Do not run any tools.

## Hard gate (Phase A, deterministic)

Use terminal toolset only. First action is always:

```bash
node "${OMNIPOTENT_REPO}/scripts/session-close/run-deterministic.mjs" [--dry-run]
```

If `.session-close/context-pack.json` is missing after Phase A, stop and report failure from `close-report.json`.

## Bounded LLM pass (Section 8 only)

Read only:

- `.session-close/context-pack.json`
- `references/section8-synthesis.md`

Write `.session-close/section8-draft.md` within 1,500 tokens.

Real close only, apply the draft:

```bash
node "${OMNIPOTENT_REPO}/scripts/session-close/apply-section8.mjs" --draft ".session-close/section8-draft.md"
```

## Reply and NotebookLM fan-out

Render the Discord reply from `.session-close/close-report.json` using `references/discord-reply-template.md`.
For NotebookLM, use report-provided IDs only and call `source_add` with `title: "My Knowledge Base"`, `wait: false`.

## Pitfalls (keep this short)

- `AI-Context/**` is WriteGate-protected; do not use Vault IO mutators for AGENTS.
- `MEMORY.md` symlink cross-device rename can fail (ERRNO 18), scripts write canonical vault path.
- NotebookLM `source_add` success returns `ready: false` (async), do not retry.
- Keep inputs bounded. Do not paste export bodies, sprint YAML, or AGENTS full text into prompts.
- Skill cache. Bump `version` and reinstall after changes.
