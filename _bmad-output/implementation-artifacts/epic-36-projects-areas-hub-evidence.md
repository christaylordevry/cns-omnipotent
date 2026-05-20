# Epic 36 — Projects + Areas hub index evidence

| Field | Value |
|-------|--------|
| **Story** | 36-3-projects-areas-stale-pending-hub-indexes |
| **Run date** | 2026-05-20 (UTC) |
| **Vault root** | `CNS_VAULT_ROOT` → live Knowledge-Vault-ACTIVE |
| **Lint baseline** | `_meta/reports/vault-lint-2026-05-18.md` |

## Rule 2 baseline (01-Projects + 02-Areas)

| Metric | Count |
|--------|------:|
| Orphan paths in baseline report (01/02 prefix, Rule 2 section only) | **13** |
| Vault-wide Rule 2 (lint summary) | **40** |

Baseline orphan paths:

- `01-Projects/AI-Native-Infrastructure/Codex-Cursor-CNS-Integration-Plan.md`
- `01-Projects/AI-Native-Infrastructure/V-1 The Unified 2026 AI-Native Cross-Device Infrastructure Blueprint.md`
- `01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md`
- `01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md`
- `01-Projects/Brain - Central Nervous System Build/Perplexity deep research.md`
- `01-Projects/Brain - Central Nervous System Build/Session-Summary-Phase3-Day1.md`
- `01-Projects/CNS-Phase-1/cns-phase-1-complete.md`
- `01-Projects/CNS-Phase-1/deferred-work.md`
- `01-Projects/CV-For-Alex/Chris-Taylor-CV.md`
- `01-Projects/Foundation-First-Client/Foundation-First-Client-Master-Plan.md`
- `01-Projects/Linkedin/Prompt - Research.md`
- `01-Projects/Linkedin/SEEK Profile Setup Guide.md`
- `02-Areas/About Me/Perplexity Feedback.md`

## Hub updates

| Hub | WorkflowNote wikilinks |
|-----|----------------------:|
| `01-Projects/_README.md` | **29** |
| `02-Areas/_README.md` | **4** |

**Tool:** `vaultCreateNoteFromMarkdown` (read existing manifest, preserve body, replace `## WorkflowNote index` section).

### Spot-check (incoming edge from hub)

| Target | Linked from hub |
|--------|-----------------|
| `01-Projects/CNS-Phase-1/deferred-work.md` | Yes |
| `01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md` | Yes |
| `02-Areas/About Me/Perplexity Feedback.md` | Yes |

## Post-run `/vault-lint` (operator `#hermes`, live vault)

| Metric | Before (2026-05-18) | After (post 36-3) | Delta |
|--------|--------------------:|------------------:|------:|
| Vault-wide Rule 2 orphan warnings | **40** | **27** | **−13** |
| 01/02 orphans cleared via hub index (Part B) | — | **13** notes wired | matches delta |
| Lint ERRORS | — | **0** | — |
| Lint warnings (total) | **69** | **31** | **−38** |

**AC12:** Satisfied — Rule 2 dropped materially (40 → 27); 13 orphan paths in 01/02 baseline now have hub incoming edges. Remaining 27 vault-wide orphans include `03-Resources/` (out of scope).
