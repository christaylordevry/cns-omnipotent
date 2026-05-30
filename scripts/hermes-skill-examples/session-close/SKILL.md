---
name: session-close
description: "Hermes CNS /session-close router. Runs deterministic Phase A, then bounded Section 8 synthesis using only the context pack, applies Section 8, and renders a Discord reply from the close report."
version: 1.0.7
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
OMNIPOTENT_REPO="${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}"
# wrapper required: systemd service environment does not inherit nvm PATH
# wrapper executes run-deterministic.mjs
"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-session-close.sh" [--dry-run]
```

If Phase A fails, stop and report from `close-report.json` (`failure_class`, `steps.*`).

## Bounded LLM pass (Section 8 only)

Read only:

- `.session-close/context-pack.json`
- `references/section8-synthesis.md`

Write `.session-close/section8-draft.md` within 1,500 tokens.

Real close only, apply the draft:

```bash
/home/christ/.nvm/versions/node/v24.14.0/bin/node "${OMNIPOTENT_REPO}/scripts/session-close/gate-apply-section8.mjs" --draft ".session-close/section8-draft.md"
```

`--draft` is relative to `OMNIPOTENT_REPO`, not the shell cwd.

**Phase A gate (inside `gate-apply-section8.mjs`):** Before token check or apply, the gate may **re-run Phase A once** when `context-pack.json` / `close-report.json` are missing or incomplete. If Phase A still cannot proceed, the gate exits **1** with stderr mentioning `Phase A incomplete` or `Phase A failed`; read `phase_a_gate` and `failure_class` from `.session-close/close-report.json`. Do not call `apply-section8.mjs` directly.

**Phase B token ABORT:** If the gate exits **1** with stderr containing `phase B token check ABORTED`, treat it as a **controlled skip** (§8 not applied): read `phase_b_token_check` from `.session-close/close-report.json`, still render the Discord reply, and surface the ABORT in the reply. Do not fail the whole session close for token ABORT alone.

## Reply and NotebookLM fan-out

Render the Discord reply from `.session-close/close-report.json` using `references/discord-reply-template.md`.
For NotebookLM, use report-provided IDs only and call `source_add` with `title: "My Knowledge Base"`, `wait: false`.

## Pitfalls (keep this short)

- `AI-Context/**` is WriteGate-protected; do not use Vault IO mutators for AGENTS.
- `MEMORY.md` symlink cross-device rename can fail (ERRNO 18), scripts write canonical vault path.
- NotebookLM `source_add` success returns `ready: false` (async), do not retry.
- Keep inputs bounded. Do not paste export bodies, sprint YAML, or AGENTS full text into prompts.
- Skill cache. Bump `version` and reinstall after changes.
