---
story_id: 68-9
epic: 68
title: morning-digest-pipeline-integration-fixes
status: done
baseline_date: 2026-06-11
predecessors: 68-1, 68-8
blocks: 68-8
repo: Omnipotent.md (+ Hermes skill mirror)
fr_ids: FR-15, FR-16
priority: P0
operator_brief: 2026-06-11
---

# Story 68.9: Morning Digest Pipeline Integration Fixes (68-8 Blockers)

Status: done

> **Hotfix story** surfaced by 68-8 live validation (2026-06-11 12:02 AEST). Fixes agent wiring gaps in `task-prompt.md` / `SKILL.md` — not adapter or dedup algorithm changes.

## Story

As a **CNS operator running Epic 68 live digest validation**,
I want **the morning-digest task contract to enforce §9 signal assembly before dedupe and `node` invocation for all `.mjs` scripts**,
so that **`dedupe-digest-signals.mjs` receives populated `DIGEST_SIGNALS_JSON`, Source 6 vault routing runs without bash import errors, and 68-8 can PASS**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion |
| **Priority** | **P0** — blocks 68-8 live validation |
| **Repo** | Omnipotent.md — `task-prompt.md`, `SKILL.md`, `pick-signal-notebook.mjs`, tests; Hermes mirror via `install-hermes-skill-morning-digest.sh` |
| **Predecessors** | 68-1 (dedup CLI), 68-8 (validation gate — in-progress, FAIL on these bugs) |
| **Out of scope** | Dedup algorithm changes; adapter fetch scripts; Convex schema; `resolveOperatorHome()` refactor of unrelated scripts |

### Live validation failures (2026-06-11)

| Bug | Symptom | Root cause |
|-----|---------|------------|
| **1** | `dedupe-digest-signals: warning — missing or invalid DIGEST_SIGNALS_JSON` | Agent invoked dedupe before building `digest_push_payload.signals` from all adapter stdout via §9 mapping |
| **2** | `import: command not found` on `pick-signal-notebook.mjs` | Agent or inline contract invoked `.mjs` with `bash` instead of `node` |

---

## Acceptance Criteria

### 1. §9 map gate before dedupe (Bug 1)

**Given** Sources 0–5, 7–12, and 6 have completed (or recorded unavailable)
**When** the agent reaches Pre-Discord processing
**Then** `task-prompt.md` contains a **non-negotiable** `### Build digest_push_payload.signals from §9 map` section **before** `### Dedupe signals before scoring`
**And** the section requires mapping **every** adapter stdout (Sources 1–5, 7–12) into `digest_push_payload.signals[]` per the §9 signal mapping table — not from memory
**And** the section states: **do not invoke `dedupe-digest-signals.mjs` until `digest_push_payload.signals` is built and `JSON.stringify(digest_push_payload.signals)` is non-empty when any source succeeded**
**And** the dedupe terminal command passes `DIGEST_SIGNALS_JSON=<shellQuote(JSON.stringify(digest_push_payload.signals))>` (unchanged contract)
**And** `SKILL.md` execution steps list correct order: Source 6 → **build §9 signals** → dedupe → score → artifact → Discord
**And** `tests/hermes-morning-digest-skill.test.mjs` asserts the construction gate exists and precedes dedupe

### 2. Node invocation for pick-signal-notebook (Bug 2)

**Given** Source 6 vault routing
**When** `task-prompt.md` or `SKILL.md` documents the pick-signal terminal call
**Then** every reference uses `node scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` (or `$PICK_SCRIPT` with `node "$PICK_SCRIPT"`) — **never** `bash ...pick-signal-notebook.mjs`
**And** checklist row for Source 6 shows explicit `node` prefix
**And** `pick-signal-notebook.mjs` has shebang `#!/usr/bin/env node`
**And** `tests/hermes-morning-digest-skill.test.mjs` asserts no `bash` + `pick-signal-notebook.mjs` pairing in task-prompt or SKILL.md

### 3. Dedupe CLI verification (Bug 1 confirm)

**Given** `dedupe-digest-signals.mjs`
**When** `DIGEST_SIGNALS_JSON` env is missing or invalid
**Then** stderr warns with prefix `dedupe-digest-signals:` and process exits **0** with `[]` stdout (existing behavior — no regression)

### 4. Hermes sync + verify gate

**Given** all file edits complete
**When** `bash scripts/install-hermes-skill-morning-digest.sh` runs
**Then** `~/.hermes/skills/cns/morning-digest/` mirrors repo skill files
**And** `bash scripts/verify.sh` passes

---

## Tasks

- [x] **T1** Add §9 map construction gate to `task-prompt.md` (AC: 1)
- [x] **T2** Fix `SKILL.md` step order and explicit `node` for pick-signal (AC: 1, 2)
- [x] **T3** Add shebang to `pick-signal-notebook.mjs` (AC: 2)
- [x] **T4** Extend `tests/hermes-morning-digest-skill.test.mjs` (AC: 1, 2)
- [x] **T5** Run `bash scripts/install-hermes-skill-morning-digest.sh` (AC: 4)
- [x] **T6** Run `bash scripts/verify.sh` (AC: 4)

---

## Verification (post-fix — operator)

1. Trigger `run morning digest` in Discord #hermes
2. No `missing or invalid DIGEST_SIGNALS_JSON` warning
3. No `import: command not found` error
4. Dedup clusters in digest output / Convex
5. Bluesky and X sections in Discord output
6. `node scripts/validate-epic-68-digest.mjs --latest --json` → `overall: pass`
