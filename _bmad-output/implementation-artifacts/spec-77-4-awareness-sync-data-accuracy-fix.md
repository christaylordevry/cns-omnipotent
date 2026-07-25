---
title: '77-4 awareness-sync data-accuracy fix'
type: 'bugfix'
created: '2026-07-04'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Hermes self-improvement injected false sprint-status scope guidance and a stale frozen story table into deployed-only `awareness-sync` skill files, causing Discord #hermes to report wrong JARVIS story statuses (77-2/78-2/77-5).

**Approach:** Remove false claims, replace frozen tables with live `sprint-status.yaml` grep patterns, mirror to repo SSOT, reinstall to `~/.hermes`, and document evidence plus governance deferral.

## Suggested Review Order

1. [Evidence + before/after](77-4-awareness-sync-data-accuracy-fix-evidence.md) — live bug transcript and re-test output
2. [SKILL.md Pitfalls](../../scripts/hermes-skill-examples/awareness-sync/SKILL.md) — sprint-status as SSOT for all epics
3. [cns-epic-project-status.md](../../scripts/hermes-skill-examples/awareness-sync/references/cns-epic-project-status.md) — grep patterns only, no status tables
4. [task-prompt.md story routing](../../scripts/hermes-skill-examples/awareness-sync/references/task-prompt.md) — §4 + §Story-level status
5. [deferred-work.md governance note](deferred-work.md) — self-improvement ungoverned writes
