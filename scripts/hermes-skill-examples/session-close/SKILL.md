---
name: session-close
description: "Hermes CNS /session-close router. Runs deterministic Phase A, bounded Section 8 synthesis from section8-input.json only, applies via gate, runs script-wrapped fan-out, and posts a rendered Discord reply."
version: 1.0.12
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

> **REFERENCE ONLY — invocation already confirmed.** Accept only `/session-close` or `/session-close --dry-run`. Reject unsupported flags or trailing arguments without running tools.

## Hard gate (Phase A, mandatory first action)

Terminal only. **First action is always:**

```bash
OMNIPOTENT_REPO="${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}"
"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-session-close.sh" [--dry-run]
```

If Phase A fails, stop and report from `.session-close/close-report.json` (`failure_class`, `steps.*`).

## Section 8 (bounded LLM pass)

Read **only**:

- `.session-close/section8-input.json`
- `references/section8-synthesis.md`

**Do not read:** `AGENTS.md`, `sprint-status.yaml`, `_bmad-output/` story files, vault export bodies, `.session-close/context-pack.json`, `references/task-prompt.legacy.md`, or other reference files unless a render/fan-out script fails.

Write `.session-close/section8-draft.md` (≤1,500 tokens).

Real close — apply via gate (not `apply-section8.mjs` directly):

```bash
/home/christ/.nvm/versions/node/v24.14.0/bin/node "${OMNIPOTENT_REPO}/scripts/session-close/gate-apply-section8.mjs" --draft ".session-close/section8-draft.md"
```

`--draft` is relative to `OMNIPOTENT_REPO`. If the gate exits **1** with `phase B token check ABORTED`, treat as controlled skip: read `phase_b_token_check` from `close-report.json`, still render Discord reply, surface ABORT in reply.

## Phase C (NotebookLM, real close only)

Dry-run: skip Drive write, sync, and `source_add`; NotebookLM = `skipped in dry-run`.

Run in order (scripts only — do not load fan-out reference markdown):

1. `"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-record-notebooklm-fanout-mode.sh"` — read stdout JSON `mode` (`drive-sync` or `legacy-source-add`)
2. If `drive-sync`: `hermes-run-write-vault-export-to-drive.sh` then `hermes-run-sync-vault-export-drive.sh` (no `source_add`)
3. If `legacy-source-add`: MCP `source_add` per `close-report.json` target + `hermes-run-merge-notebooklm-fanout.sh` after each call
4. `"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-nlm-auth-watchdog.sh" [--dry-run]`

Fan-out is best-effort; always continue to the watchdog. Never paste tokens, emails, or raw MCP stderr into Discord.

## Discord reply (deterministic)

Prefer script output over template load:

```bash
"${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-render-discord-reply.sh"
```

Post stdout as the reply. Fallback only if render fails: `references/discord-reply-template.md`.

## Pitfalls

- WriteGate protects `AI-Context/**`; do not use Vault IO mutators for AGENTS.
- Bump `version`, run `bash scripts/install-hermes-skill-session-close.sh`, restart gateway after skill changes.
