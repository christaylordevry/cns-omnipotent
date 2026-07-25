---
title: "Story 79-4 — Brain recall calibration gate"
pass_date_utc: "2026-06-26T05:18:01.358Z"
policy_version: "0.2.0"
shadow_mode: true
gate_status: SHADOW_WAIVER
epic_82_gate: true
---

# Story 79-4: Golden-set calibration pass (Epic 82 gate)

> **Epic 82 gate:** This artifact documents calibration **PASS** or an explicit **shadow-mode operator waiver** before Story 82-3.

## Run metadata

| Field | Value |
|-------|-------|
| Pass date (UTC) | 2026-06-26T05:18:01.358Z |
| Policy version | `0.2.0` |
| Shadow mode | `true` |
| Golden queries | 10 |
| Index path | `/home/christ/.hermes/brain/brain-index.json` |
| Golden set | `/home/christ/ai-factory/projects/Omnipotent.md/config/brain-golden-queries.json` |
| Gate status | **SHADOW_WAIVER** |

## Summary

- Channel runs: 24/30 passed
- All queries passed: **no**
- Token count degraded (estimate fallback): **yes**

## Warnings

- sprint-continuity/voice_pane: forbidden in retrieval (not cited): AI-Context/AGENTS.md
- sprint-continuity/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- sprint-continuity/standard_text: forbidden in retrieval (not cited): AI-Context/AGENTS.md
- sprint-continuity/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- sprint-continuity/yapped_text: forbidden in retrieval (not cited): AI-Context/AGENTS.md
- sprint-continuity/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- deferred-run-chain/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- deferred-run-chain/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- deferred-run-chain/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- morning-digest-time/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- morning-digest-time/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- morning-digest-time/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- session-close-how/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- session-close-how/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- session-close-how/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- notebooklm-routing/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- notebooklm-routing/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- notebooklm-routing/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hermes-voice-blocker/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hermes-voice-blocker/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hermes-voice-blocker/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- vault-fast-scan/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- vault-fast-scan/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- vault-fast-scan/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- operator-profile/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- operator-profile/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- operator-profile/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hooks-run-chain-smoke/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hooks-run-chain-smoke/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hooks-run-chain-smoke/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- nexus-bridge/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- nexus-bridge/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- nexus-bridge/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

## Operator waiver (shadow mode continue)

- Waived by: Chris
- Waived at (UTC): 2026-06-26T05:18:01.358Z
- Reason: voice_pane deferred to Epic 82 (dormant until voice surface wired); notebooklm-routing ranks #6 on standard, revisit via content nudge. Text channels 18/20 — shipping text recall.

## Per-query results

### sprint-continuity

**Prompt:** where did we leave off on the sprint?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- sprint-continuity/voice_pane: forbidden in retrieval (not cited): AI-Context/AGENTS.md
- sprint-continuity/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- sprint-continuity/standard_text: forbidden in retrieval (not cited): AI-Context/AGENTS.md
- sprint-continuity/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- sprint-continuity/yapped_text: forbidden in retrieval (not cited): AI-Context/AGENTS.md
- sprint-continuity/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | AI-Context/MEMORY.md, AI-Context/CNS-Daily-Rhythm.md | 774 | estimate | 800 | ✅ |
| standard_text | 1.000 | AI-Context/MEMORY.md, AI-Context/CNS-Daily-Rhythm.md, 03-Resources/CNS-Operator-Guide.md, 03-Resources/BMAD-v628-Release-Analysis-2026-05-26.md | 1518 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | AI-Context/MEMORY.md, AI-Context/CNS-Daily-Rhythm.md, 03-Resources/CNS-Operator-Guide.md, 03-Resources/BMAD-v628-Release-Analysis-2026-05-26.md, 01-Projects/Brain - Central Nervous System Build/Session-Summary-Phase3-Day1.md, 01-Projects/Linkedin/LinkedIn Profile Builder/11_Commenting_Strategy_Daily_Engagement.md | 3018 | estimate | 3000 | ✅ |

### deferred-run-chain

**Prompt:** what's still deferred about run-chain?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- deferred-run-chain/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- deferred-run-chain/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- deferred-run-chain/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | AI-Context/modules/run-chain.md, AI-Context/projects/run-chain/README.md | 816 | estimate | 800 | ✅ |
| standard_text | 1.000 | AI-Context/modules/run-chain.md, AI-Context/projects/run-chain/README.md, 03-Resources/hooks-cns-run-chain-revival-smoke-2026-06-2026-06-24.md | 1518 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | AI-Context/modules/run-chain.md, AI-Context/projects/run-chain/README.md, 03-Resources/hooks-cns-run-chain-revival-smoke-2026-06-2026-06-24.md, 03-Resources/synthesis-cns-run-chain-revival-smoke-2026-06-2026-06-24.md, 03-Resources/weapons-check-cns-run-chain-revival-smoke-2026-06-2026-06-24.md | 3017 | estimate | 3000 | ✅ |

### morning-digest-time

**Prompt:** what time does the morning digest cron run?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- morning-digest-time/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- morning-digest-time/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- morning-digest-time/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | 03-Resources/CNS-Operator-Guide.md, 01-Projects/Foundation-First-Client/Foundation-First-Client-Master-Plan.md | 817 | estimate | 800 | ✅ |
| standard_text | 1.000 | 03-Resources/CNS-Operator-Guide.md, 01-Projects/Foundation-First-Client/Foundation-First-Client-Master-Plan.md | 1518 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | 03-Resources/CNS-Operator-Guide.md, 01-Projects/Foundation-First-Client/Foundation-First-Client-Master-Plan.md, AI-Context/CNS-Daily-Rhythm.md, 03-Resources/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md | 3017 | estimate | 3000 | ✅ |

### session-close-how

**Prompt:** how do I close a session again?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- session-close-how/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- session-close-how/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- session-close-how/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | 03-Resources/CNS-Operator-Guide.md, AI-Context/MEMORY.md | 817 | estimate | 800 | ✅ |
| standard_text | 1.000 | 03-Resources/CNS-Operator-Guide.md, AI-Context/MEMORY.md, AI-Context/CNS-Daily-Rhythm.md | 1517 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | 03-Resources/CNS-Operator-Guide.md, AI-Context/MEMORY.md, AI-Context/CNS-Daily-Rhythm.md, 03-Resources/Research/Best Practices for Claude Code.md, 03-Resources/Research/This SIMPLE Obsidian + Claude Code setup could turn your vault into a 24×7 AI agent.md | 3017 | estimate | 3000 | ✅ |

### notebooklm-routing

**Prompt:** which notebook should CNS research go to?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- notebooklm-routing/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- notebooklm-routing/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- notebooklm-routing/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 0.000 | 03-Resources/Research/Hermes-Agent-CNS-Comparison.md | 817 | estimate | 800 | ❌ |
| standard_text | 1.000 | 03-Resources/Research/Hermes-Agent-CNS-Comparison.md, 01-Projects/CNS-Phase-1/cns-phase-1-complete.md, 03-Resources/Claude-Morning-Research-Agent-cyrilXBT.md, 01-Projects/AI-Native-Infrastructure/Codex-Cursor-CNS-Integration-Plan.md | 1518 | estimate | 1500 | ❌ |
| yapped_text | 1.000 | 03-Resources/Research/Hermes-Agent-CNS-Comparison.md, 01-Projects/CNS-Phase-1/cns-phase-1-complete.md, 03-Resources/Claude-Morning-Research-Agent-cyrilXBT.md, 01-Projects/AI-Native-Infrastructure/Codex-Cursor-CNS-Integration-Plan.md, 03-Resources/CNS-Workflow-Map.md, AI-Context/modules/notebooklm-workflow.md | 3018 | estimate | 3000 | ✅ |

### hermes-voice-blocker

**Prompt:** why isn't desktop voice working yet?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- hermes-voice-blocker/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hermes-voice-blocker/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hermes-voice-blocker/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | 01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Desktop-App-Research-and-Setup-Guide-2026-06-07.md | 817 | estimate | 800 | ✅ |
| standard_text | 1.000 | 01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Desktop-App-Research-and-Setup-Guide-2026-06-07.md, AI-Context/modules/hermes-desktop.md, 03-Resources/Research/Claude Code + NotebookLM + Obsidian The Research Stack Nobody's Using.md | 1517 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | 01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Desktop-App-Research-and-Setup-Guide-2026-06-07.md, AI-Context/modules/hermes-desktop.md, 03-Resources/Research/Claude Code + NotebookLM + Obsidian The Research Stack Nobody's Using.md, 03-Resources/CNS-Operator-Guide.md, 01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-Wake-Agent-Multi-Profile-2026-06-Gap-Analysis.md | 3018 | estimate | 3000 | ✅ |

### vault-fast-scan

**Prompt:** where's the fast scan index thing?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- vault-fast-scan/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- vault-fast-scan/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- vault-fast-scan/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | 03-Resources/CNS-Operator-Guide.md | 816 | estimate | 800 | ❌ |
| standard_text | 1.000 | 03-Resources/CNS-Operator-Guide.md, 01-Projects/AI-Native-Infrastructure/Codex-Cursor-CNS-Integration-Plan.md, AI-Context/vault-fast-scan-index.md | 1518 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | 03-Resources/CNS-Operator-Guide.md, 01-Projects/AI-Native-Infrastructure/Codex-Cursor-CNS-Integration-Plan.md, AI-Context/vault-fast-scan-index.md, 03-Resources/Research/OpenClaw-AI-Research.md, 03-Resources/Research/Firecrawl-Web-Data-API.md, 03-Resources/CNS-Workflow-Map.md | 3018 | estimate | 3000 | ✅ |

### operator-profile

**Prompt:** what does my operator profile say about how I work?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- operator-profile/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- operator-profile/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- operator-profile/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | 02-Areas/About Me/Career Path Brainstorming.md | 816 | estimate | 800 | ❌ |
| standard_text | 1.000 | 02-Areas/About Me/Career Path Brainstorming.md, 03-Resources/Operator-Profile.md, 01-Projects/Linkedin/LinkedIn Profile Builder/07_First_LinkedIn_Posts_3_Drafts.md | 1517 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | 02-Areas/About Me/Career Path Brainstorming.md, 03-Resources/Operator-Profile.md, 01-Projects/Linkedin/LinkedIn Profile Builder/07_First_LinkedIn_Posts_3_Drafts.md, 01-Projects/Operator-Landing-Page/Product Brief - Operator Landing Page.md | 3016 | estimate | 3000 | ✅ |

### hooks-run-chain-smoke

**Prompt:** what was that run-chain revival smoke about?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- hooks-run-chain-smoke/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hooks-run-chain-smoke/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- hooks-run-chain-smoke/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | AI-Context/projects/run-chain/README.md, AI-Context/modules/run-chain.md | 817 | estimate | 800 | ❌ |
| standard_text | 1.000 | AI-Context/projects/run-chain/README.md, AI-Context/modules/run-chain.md, 03-Resources/hooks-cns-run-chain-revival-smoke-2026-06-2026-06-24.md | 1518 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | AI-Context/projects/run-chain/README.md, AI-Context/modules/run-chain.md, 03-Resources/hooks-cns-run-chain-revival-smoke-2026-06-2026-06-24.md, 03-Resources/synthesis-cns-run-chain-revival-smoke-2026-06-2026-06-24.md, 03-Resources/weapons-check-cns-run-chain-revival-smoke-2026-06-2026-06-24.md | 3018 | estimate | 3000 | ✅ |

### nexus-bridge

**Prompt:** how does discord talk to obsidian again?

**Token measure:** voice_pane=estimate, standard_text=estimate, yapped_text=estimate

**Query warnings:**
- nexus-bridge/voice_pane: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- nexus-bridge/standard_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate
- nexus-bridge/yapped_text: token count unavailable (Token count error: Path /v1/messages/count_tokens is not forwarded by this proxy. Allowed: /chat/completions, /completions, /embeddings, /models); using chars/4 estimate

| Channel | precision@k | cited | tokens | measure | budget | pass |
|---------|---------------|-------|--------|---------|--------|------|
| voice_pane | 1.000 | 01-Projects/PROJECT_NEXUS DISCORD-OBSIDIAN BRIDGE.md, 03-Resources/Nexus-Discord-Obsidian-Bridge-Full-Guide.md | 817 | estimate | 800 | ❌ |
| standard_text | 1.000 | 01-Projects/PROJECT_NEXUS DISCORD-OBSIDIAN BRIDGE.md, 03-Resources/Nexus-Discord-Obsidian-Bridge-Full-Guide.md, 03-Resources/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md | 1518 | estimate | 1500 | ✅ |
| yapped_text | 1.000 | 01-Projects/PROJECT_NEXUS DISCORD-OBSIDIAN BRIDGE.md, 03-Resources/Nexus-Discord-Obsidian-Bridge-Full-Guide.md, 03-Resources/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md, 03-Resources/AI-Shared-Brain-Architecture.md, 03-Resources/Obsidian-Claude-Code-Personal-OS.md, 03-Resources/Research/How-I-Use-Obsidian-Claude-Code-To-Run-My-Life-Isenberg-Vin.md | 3017 | estimate | 3000 | ✅ |

## Re-run triggers

Re-run calibration when:

- Embedder model changes
- Corpus ingest delta >20%
- Per-channel policy budgets or thresholds change materially

## Reversibility (NFR5)

Revert `config/brain-recall-policy.json` to prior `policy_version` in git; set `shadow_mode: true` until re-calibrated.
