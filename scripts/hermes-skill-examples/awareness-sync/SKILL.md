---
name: awareness-sync
description: "Hermes on-demand Nexus/cockpit awareness for Discord #hermes and Desktop: refreshes scripts/hermes-awareness-pull.ts via terminal(), reads ~/.hermes/memories/awareness-snapshot.json, and posts a bounded markdown summary. CLI pull + local cache only — no Convex MCP or live HTTP per chat turn."
version: 1.0.0
author: CNS Operator
license: MIT
required_environment_variables:
  - name: OMNIPOTENT_REPO
    prompt: Absolute path to Omnipotent.md repo (directory containing scripts/hermes-awareness-pull.ts)
    required_for: locating pull script and sourcing awareness-pull.env
  - name: CONVEX_URL
    prompt: Convex deployment URL (.convex.cloud) — value in ~/.hermes/awareness-pull.env only
    required_for: awareness pull client (never echo value in replies)
  - name: HERMES_CONVEX_READ_KEY
    prompt: Bearer read key for GET /hermes/awareness — value in ~/.hermes/awareness-pull.env only
    required_for: awareness pull client (never echo value in replies)
metadata:
  hermes:
    tags: [cns, hermes, nexus, awareness, cockpit, terminal, read-only]
    requires_toolsets: [terminal]
---

# Hermes `awareness-sync` (Story 77-4 / FR12)

## Overview

On-demand refresh and bounded summary of the **Hermes awareness snapshot** (Nexus/cockpit state). Invokes **`scripts/hermes-awareness-pull.ts`** via **`terminal()`** only — never call Convex HTTP, Convex SDK, or Convex MCP directly from this skill.

- **Trigger**: `awareness-sync` (see `references/trigger-pattern.md`) or natural-language cockpit questions when bound
- **Tools**: `terminal()` — pull CLI + read local cache file
- **Cache**: `~/.hermes/memories/awareness-snapshot.json` (or `HERMES_AWARENESS_CACHE_PATH`)
- **Envelope**: `{ pulledAt, sourceUrl, snapshot }` with eight snapshot keys: `sync`, `vault`, `chain`, `mcps`, `digest`, `entities`, `investigations`, `trends`
- **Safety**: **No vault writes**, **no Convex MCP**, **no secrets in replies** (env var names only)

## When to use

> **REFERENCE ONLY — invocation already confirmed.** Hermes already routed this skill. Follow `references/task-prompt.md` — do not re-check the Hermes binding.

- Operator asks about live Nexus/cockpit state on Discord **`#hermes`** or **Hermes Desktop**
- Operator wants a fresh pull before answering (default) or cache-only read (`awareness-sync --cache-only`)
- Examples: run-chain status, vault health, morning digest, investigations board, MCP health, trend anomalies

## When not to use

- **`OMNIPOTENT_REPO` unset** — reply with export instructions; do not guess cwd
- **`~/.hermes/awareness-pull.env` missing** — reply with copy instructions from `scripts/awareness-pull.env.example`; do not run pull without `CONVEX_URL` + `HERMES_CONVEX_READ_KEY`
- Operator wants full raw JSON in normal chat — use `awareness-sync --json` debug mode only (warn about size)
- Requests to mutate vault, edit run-chain adapters, or call Convex MCP live per turn (out of scope — ADR-HERMES-002)

## Policy

- **CLI pull only**: `npx tsx scripts/hermes-awareness-pull.ts` under `OMNIPOTENT_REPO` with inline `source ~/.hermes/awareness-pull.env` in the **same** shell command
- **No secrets in replies**: never echo `HERMES_CONVEX_READ_KEY` or bearer tokens; cite missing var **names** only
- **Bounded output**: Discord-safe markdown digest (≤25 lines for bare trigger); no full JSON dump unless `--json` debug
- **Stale honesty**: when pull fails but prior cache exists, label **STALE** with `pulledAt` age — never claim freshness
- **No vault mutations** — read-only skill

## Environment (names only — values in `~/.hermes/awareness-pull.env`)

| Variable | Required? | Notes |
|----------|-----------|-------|
| `OMNIPOTENT_REPO` | Skill runtime | Hermes session — absolute path to Omnipotent.md checkout |
| `CONVEX_URL` | Yes (pull) | `.convex.cloud` deployment URL — pull client derives `.convex.site` route |
| `HERMES_CONVEX_READ_KEY` | Yes (pull) | Bearer for GET `/hermes/awareness` |
| `HERMES_AWARENESS_CACHE_PATH` | Optional | Override cache file (default `~/.hermes/memories/awareness-snapshot.json`) |

**`awareness-pull.env`**: operator file at `~/.hermes/awareness-pull.env` (chmod 600); always `source` in the same command as `npx tsx`. Template: `scripts/awareness-pull.env.example`.

## Steps (model)

1. Read **`references/task-prompt.md`** and follow it verbatim for pull, cache read, stale fallback, and summary templates.
2. If `OMNIPOTENT_REPO` is missing, reply with export instructions — **do not** run terminal.
3. Route operator questions to snapshot sections per task-prompt routing table.

## Tools

- **`terminal()`** with `workdir` = resolved repo root for pull and cache read (`cat` with quoted path)
- **No** Convex MCP, **no** `vault_*` mutators

## References

- Normative behavior: `references/task-prompt.md`
- Trigger grammar: `references/trigger-pattern.md`
- Example Q&A: `references/example-prompts.md`
- Optional `#hermes` binding: `references/config-snippet.md`
- Pull client SSOT: `scripts/hermes-awareness-pull.ts` (Story 77-2 — consume, do not modify)
