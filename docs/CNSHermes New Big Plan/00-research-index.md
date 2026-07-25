# CNS Consolidation Research — Master Index
_Compiled: 2026-06-23 | Session: Hermes + Vault + Provider research_

---

## What this package is

Complete research output from a six-prompt audit session covering:
- Current Hermes agent state (config, model, MCPs, memory)
- Vault alignment (what's stale, what's accurate, what's missing)
- Hermes Desktop connection architecture for Windows/WSL2
- Nous Portal as single subscription provider
- run-chain provider path to Portal
- The openai-codex fragility assessment

These files are the complete input package for the reasoning-model
consolidation epic design session.

---

## Files in this package

| File | What it contains | Use for |
|------|-----------------|---------|
| `00-research-index.md` | This file | Navigation |
| `01-ground-truth-system-state.md` | Complete current state of every component | Epic design baseline |
| `02-vault-alignment-report.md` | Vault findings, stale docs, both MEMORY files, AUTO blocks | Session-close prep + AGENTS §8 update |
| `03-hermes-desktop-connection.md` | Desktop architecture, WSL2 setup, 7-step install sequence | Hermes Desktop epic story |
| `04-nous-portal-integration.md` | Portal provider switch, run-chain paths, Firecrawl, subscription map | Provider consolidation epic story |
| `05-openai-codex-assessment.md` | What openai-codex is, why it works now, why it's fragile | Context for provider decision |
| `06-implementation-sequence.md` | Full ordered plan phases 0–4 + reasoning-model brief | Epic design session input |
| `07-merged-accurate-memory.md` | What both MEMORY.md files should say after session-close | Session-close + vault update |

---

## How to use these files

### For the reasoning-model consolidation session
Hand files 01, 03, 04, 05, and 06 to Claude Opus or o3.
Use the brief at the bottom of `06-implementation-sequence.md` verbatim.

### For running /session-close
Read `07-merged-accurate-memory.md` first.
Confirm test failure verdict (SAFE TO PROCEED, `failure_class: tests`) from `01-ground-truth-system-state.md`.
Fix the test fixture before closing (see `02-vault-alignment-report.md` Section G).

### For updating the vault
`02-vault-alignment-report.md` has the complete stale-document list.
Priority order: `AI-Context/MEMORY.md` → `~/.hermes/memories/MEMORY.md` → `CNS-Daily-Rhythm.md` AUTO blocks → `AGENTS.md §8`.

---

## Key decisions already made (do not re-litigate)

1. **Provider: Nous Portal** — moving everything off openai-codex and OpenRouter
2. **Hermes Desktop: install on Windows, connect to WSL2 backend** — not replacing Discord gateway
3. **run-chain: Portal proxy path** — `hermes proxy start` at `127.0.0.1:8645/v1`
4. **Session-close: SAFE TO PROCEED with `failure_class: tests`** — 7 failures are fixture drift, not infrastructure breakage

---

## Audit sources

| Prompt | What it ran | File |
|--------|------------|------|
| Hermes config audit | `~/.hermes/config.yaml`, skills, MEMORY, env | `cursor_hermes_consolidation_audit.md` |
| Vault alignment audit | Full vault read across all 11 sections | `cursor_vault_alignment_audit_report.md` |
| Prompt A — Test failures | `verify.sh`, test file, session-close docs | `cursor_session_close_failure_verificati.md` |
| Prompt B — Desktop | Context7, live config, WSL2 network | `cursor_connecting_hermes_desktop_to_wsl.md` |
| Prompt C — Portal | Context7, live config, adapter source | `cursor_nous_portal_integration_strategy.md` |
