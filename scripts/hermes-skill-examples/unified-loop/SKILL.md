---
name: unified-loop
description: "Hermes Unified Loop v1.5 — Discover-only shell (read-only) with skill-contract approval gate before Build. Composes Epic 81 collector, bounded #hermes briefing, and discover artifact at ~/.hermes/artifacts/unified-loop/discover.json. Build/Verify/Persist are documented placeholders (84-2/84-3)."
version: 1.0.0
author: CNS Operator
license: MIT
required_environment_variables:
  - name: OMNIPOTENT_REPO
    prompt: Absolute path to Omnipotent.md repo (directory containing scripts/lib/collect-internal-dev-state.ts)
    required_for: Discover collector + artifact writer
  - name: CNS_VAULT_ROOT
    prompt: Absolute path to Knowledge-Vault-ACTIVE (optional; task-prompt documents default)
    required_for: vault_scan + agent_log categories in collector
metadata:
  hermes:
    tags: [cns, unified-loop, read-only, discover]
    requires_toolsets: [terminal]
---

# Hermes `unified-loop` (Story 84-1 / FR22 v1.5)

## Overview

Schedulable **Discover-only** shell for the Unified Loop (Schedule → Discover → **[PAUSE]** → Build → Verify → Persist). Story **84-1** delivers governance + Discover stage only — **no Build/Verify/Persist execution wiring**.

- **Discover**: `terminal()` → `collectInternalDevState()` (Epic 81, read-only) → `#hermes` summary + `~/.hermes/artifacts/unified-loop/discover.json`
- **Approval gate**: After Discover, skill **stops** until operator posts `unified-loop approve-build` (84-2/84-3 wire later stages)
- **Cron path**: `unified-loop cron:discover` — Discover-only, autonomous, read-only
- **Protect-list**: Zero edits to `src/agents/*-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts` (NFR2)

## When to use

> **REFERENCE ONLY — invocation already confirmed.** Hermes already routed this skill. Follow `references/task-prompt.md` — do not re-check the Hermes binding.

| Trigger | Path |
|---------|------|
| `unified-loop` | Full loop manual — Discover then **pause** at gate |
| `unified-loop cron:discover` | Discover-only (cron pseudo-label + manual smoke) |
| `unified-loop approve-build` | Build→Verify→Persist **after** approved Discover (contract only in 84-1) |

First call: `skill_view("unified-loop", "references/task-prompt.md")` then execute per trigger.

## When not to use

- **`OMNIPOTENT_REPO` unset** — reply with export instructions; do not guess cwd
- **Pre-approval Build work** — forbidden MCP mutators and session-close apply paths (see task-prompt table)
- **Cron expecting full loop** — `approvals.cron_mode: deny` + schedule split; cron never enters Build

## Policy

- **Discover stage only uses `terminal()`** — no MCP vault mutators on Discover/cron path
- **Skill-contract pause is the only operator-approval gate on the MCP-write path** — native `approvals.mode: manual` guards **terminal shell commands only**; it does **not** intercept MCP
- **Artifact absolute paths** — `repoRoot` and `artifactPath` in discover.json are absolute; Build (84-3) must read artifact from `~/.hermes/artifacts/unified-loop/discover.json`, never infer checkout from cwd alone
- **No ranking fork** — collector SSOT is `scripts/lib/collect-internal-dev-state.ts`; types hand-mirrored from `cns-dashboard/convex/validators.ts`

## Stages (84-1 scope)

| Stage | 84-1 status |
|-------|-------------|
| Schedule | WSL cron + Hermes dummy job (`references/cron-snippet.md`) |
| Discover | **Implemented** — terminal collector + artifact writer |
| Build | **Placeholder** — awaits `unified-loop approve-build` (84-3) |
| Verify | **Placeholder** — bmad review skills (84-2) |
| Persist | **Placeholder** — session-close WriteGate (84-3) |

## Environment (names only)

| Variable | Required? | Notes |
|----------|-----------|-------|
| `OMNIPOTENT_REPO` | Yes | Absolute Omnipotent.md checkout |
| `CNS_VAULT_ROOT` | Optional | Vault root for agent_log / vault_scan |
| `UNIFIED_LOOP_DISCOVER_ARTIFACT` | Optional | Absolute override for discover.json path |
| `UNIFIED_LOOP_TRIGGER` | Optional | Logged in artifact (`cron:discover`, `manual`, `unified-loop`) |

## Steps (model)

1. Read **`references/task-prompt.md`** and follow it verbatim for trigger routing, Discover execution, approval gate, and forbidden-action enforcement.
2. For cron pseudo-trigger, treat as `unified-loop cron:discover` — Discover-only, no Build.
3. After Discover on manual `unified-loop`, **stop** at skill-contract gate; emit Build intent; await `unified-loop approve-build`.

## References

- Normative behavior: `references/task-prompt.md`
- Trigger grammar: `references/trigger-pattern.md`
- Cron install: `references/cron-snippet.md`
- `#hermes` binding: `references/config-snippet.md`
- Governance SSOT (WriteGate): `AI-Context/modules/unified-loop.md` — apply via session-close, not dev-story direct edit
- Collector SSOT: `scripts/lib/collect-internal-dev-state.ts` (Story 81-1b)
- Artifact writer: `scripts/write-discover-artifact.mjs` (this skill mirror)
