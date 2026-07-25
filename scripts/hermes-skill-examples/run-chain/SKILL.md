---
name: run-chain
description: "Hermes run-chain trigger for Discord #hermes and Desktop: parses operator brief (topic/query/depth), runs scripts/run-chain.ts via terminal() with .env.live-chain sourced in the same shell, and posts a bounded PASS/FAIL summary. No vault mutations in the default path. CLI only — never imports protect-list engine modules."
version: 1.0.0
author: CNS Operator
license: MIT
required_environment_variables:
  - name: OMNIPOTENT_REPO
    prompt: Absolute path to Omnipotent.md repo (directory containing scripts/run-chain.ts)
    required_for: locating scripts/run-chain.ts and sourcing .env.live-chain
metadata:
  hermes:
    tags: [cns, hermes, run-chain, terminal, research]
    requires_toolsets: [terminal]
---

# Hermes `run-chain` (Story 75-3 / FR8)

## Overview

Standalone revival trigger for the CNS research chain (**Research → Synthesis → Hook → Boss**). Invokes **`scripts/run-chain.ts`** via **`terminal()`** only — never call `runChain()` or import protect-list adapter modules directly.

- **Trigger**: `run-chain topic: "..."` plus `query:` / optional `depth:` / optional `evidence:` (see `references/trigger-pattern.md`)
- **Tools**: `terminal()` (Hermes shell) — **no** Vault IO mutators in the default path
- **Credentials**: operator-owned **`.env.live-chain`** at repo root (gitignored); skill docs list **variable names only**
- **SSOT**: stage order, env tables, CLI flags, failure modes — `AI-Context/modules/run-chain.md` (Epic 75-2)

## When to use

> **REFERENCE ONLY — invocation already confirmed.** Hermes already routed this skill. Parse the operator brief per `references/task-prompt.md` — do not re-check the Hermes binding.

- Operator posts a **`run-chain`** brief on Discord **`#hermes`** or requests a chain run in **Hermes Desktop**
- Operator wants a full research chain (not triage-embedded shallow synthesis)

## When not to use

- Payload missing required **`topic`** or **`query`** — reply with `run-chain: bad-payload` (see task-prompt); **do not** run terminal
- **`OMNIPOTENT_REPO` unset** — ask operator to export absolute repo path; do not guess cwd
- Requests to edit protect-list adapters or run live E2E proof artifacts (out of scope — Stories 75-4 / 75-5)

## Policy

- **CLI only**: `npx tsx scripts/run-chain.ts` under `OMNIPOTENT_REPO` with inline `source .env.live-chain` in the **same** shell command
- **No secrets in replies**: never echo API key values; cite missing var **names** only
- **Bounded output**: post exit code, topic, Result line, actionable next step — no full `ChainRunResult` JSON dump unless operator passed `--raw-json` and explicitly asked for verbose output
- **401 is explicit**: dead `ANTHROPIC_API_KEY` must name Story **75-4** (`scripts/validate-anthropic-key.ts`) — never silent failure
- **No vault writes** in default path (contrast with triage Story 30-2 embedded synthesis)

## Environment (names only — values in `.env.live-chain`)

| Variable | Required? | Notes |
|----------|-----------|-------|
| `FIRECRAWL_API_KEY` | Yes | Research — Firecrawl |
| `ANTHROPIC_API_KEY` | Yes | Synthesis (default), Hook, Boss |
| `APIFY_API_TOKEN` | Yes* | *Or deprecated `APIFY_TOKEN` when canonical unset |
| `OPENROUTER_API_KEY` | Conditional | When `CNS_SYNTHESIS_PROVIDER=openrouter` |
| `CNS_SYNTHESIS_MODEL` | Conditional | OpenRouter synthesis model |
| `PERPLEXITY_API_KEY` | Optional | Tier may disable |
| `CNS_VAULT_ROOT` | Optional | Vault path override |
| `SCRAPLING_COMMAND` | Optional | Default `scrapling` |
| `CNS_BRIEF_TOPIC` | Optional | Default topic when CLI omits `--topic` |
| `OMNIPOTENT_REPO` | Skill runtime | Hermes session — absolute path to Omnipotent.md checkout |

**`.env.live-chain`**: gitignored operator file at `$OMNIPOTENT_REPO/.env.live-chain`; always `source` in the same command as `npx tsx`.

## Steps (model)

1. Read **`references/task-prompt.md`** and follow it verbatim for parse rules, terminal command, and output templates.
2. If `OMNIPOTENT_REPO` is missing, reply with export instructions — **do not** run the chain.
3. On parse error, reply `run-chain: bad-payload` — **do not** invoke `terminal()`.

## Tools

- **`terminal()`** with `workdir` = resolved repo root and a single chained shell command (see task-prompt)
- **No** `vault_*` MCP tools in the default happy path

## References

- Normative behavior: `references/task-prompt.md`
- Trigger grammar: `references/trigger-pattern.md`
- Optional `#hermes` binding: `references/config-snippet.md`
- Governance SSOT: `AI-Context/modules/run-chain.md`
