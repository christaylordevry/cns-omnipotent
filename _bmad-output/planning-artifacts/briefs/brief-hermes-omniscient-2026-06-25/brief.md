---
title: "Product Brief — Hermes Omniscient (JARVIS)"
status: ready
created: 2026-06-25
updated: 2026-06-25
source: bmad-product-brief
parent_initiative: Hermes Consolidation (G4/G5/G7)
grounding: research-hermes-omniscience-resurfacing.md
---

# Product Brief: Hermes Omniscient — Hands-Off JARVIS

## Executive Summary

Chris is building Hermes into a hands-off JARVIS for a solo operator-builder escaping employment into an AI-native agency. The operator talks or texts naturally; Hermes already knows where they left off, what's in the vault, what's moving in the world, and what to act on — then answers intelligently, suggests better paths, and executes on the stack without remembered skill names.

**Today:** The builder serves as Hermes's memory. Semantic recall is broken (stub embedder), learning loops are manual, and cognitive load dominates. Infrastructure matured in ~90 days (71 epics, constitution-following models, MCP, BMAD), but the *felt intelligence* layer — recall and learning — is the missing 30%.

**v1 (~30 days):**
- Real semantic recall — PortalEmbedder, Brain index, cited auto-injection
- Proactive morning digest — automate and enrich what already works
- **Voice on local Nexus** — polished JARVIS pane (push-to-talk, ElevenLabs TTS via Hermes); deployed Vercel `/nexus` stays awareness + async ask only
- Auxiliary routing to Haiku for affordable side-work

**v1.5:** Honcho learning loop, skill automation, kanban + trend fusion cockpit, remote voice via Tailscale.

**Out (near-term):** Client-facing Hermes, silent execution, day-one intention inference, always-on duplex.

**30-day success:** Open the cockpit unprompted, something proactive already surfaced, paid work shipped that week. **Trust line:** confident wrong answers about vault/state trigger a reset.

This brief finishes Hermes Consolidation G4/G5/G7 — not a new program.

## Vision

Hermes becomes a hands-off JARVIS: the operator talks or texts naturally, and Hermes knows where they left off, how they work, and what matters — then improves the path, not just retrieves the last note.

**Click moment.** A vague *"what was I supposed to do about that YouTube thing?"* must not trigger a skill hunt. Hermes connects history, unfinished work, live state, and vault knowledge — and says when there's a better way.

**Omniscience boundary.** The emotional bar is **operator intention** — what they're trying to accomplish and what's incomplete. Harder than file recall; north star for learning, not a day-one checkbox.

**Hands-off line.** Named skills only for dangerous/destructive actions. Hermes recognizes the boundary, asks, then acts.

**Interaction model.** **Local Nexus** is the primary voice + visual JARVIS surface (v1). Deployed `/nexus` delivers awareness and async ask. Desktop/Discord voice deferred; text/async remain supported.

**Learns-me bar.** Preferences, proactive anticipation, and workflow optimization — all in scope. Hermes compounds operator model + memory + recalled knowledge.

**Cost posture.** Pay for intelligence; route by reasoning need (Haiku for cheap work, Sonnet when it matters).

**2–3 year north star.** Single CNS/PAKE interface, autonomous background knowledge work, daily thinking partner compounding vault + live state.

## The Problem

The operator builds a system complex enough to need JARVIS while serving as JARVIS's memory.

**Recent failure mode.** Integrating Hermes requires manually reconstructing what already exists — architecture, epics, crons, skills, config. The builder is the indexer while the map changes fastest.

**Skill fatigue.** Not a ranked skill list — it's cognitive load plus wrong automation. The operator wants reminders when necessary, not token-burning auto-runs. Build phase precedes ingrained rhythm; manual skills are load-bearing scaffolding.

**Intention gap.** Not yet observed — upstream retrieval isn't good enough to test intent.

**Cost of status quo.** Cognitive load first: too much in head about what to trigger when.

**Unacceptable:** hallucinated confidence about system state; destructive auto-runs; cost rationing; remembered skill names on a "smart" surface.

## The Solution

Ambient operator interface: proactive preparation, truthful recall, transparent action, intelligent course-correction — no skill names, no silent execution, no dead-end *"I don't know."*

### Morning experience

Hermes has already run the digest, surfaced unfinished work, flagged attention items, and pulled signal-grade trend intelligence. North star includes kanban with priority dots; v1 ships digest automation + enrichment (kanban fusion is v1.5).

### Vague-question experience (YouTube bar)

**Ideal:** *"You were supposed to start filming — research done, script in place. Review the script, more research, or something else?"*

**Unacceptable:** *"I don't know what YouTube thing"* with no follow-up. Partial context → narrow and offer options.

### Remind vs act

Hermes pings what it's doing — no silent execution (v1). **Remind** on scope drift or imminent breakage. **Act** after operator approval on destructive actions.

### Voice (non-negotiable, Nexus-first)

Visually appealing JARVIS pane in cns-dashboard: push-to-talk, streaming speech, conversation UI. Same recall and memory as text.

**Split-surface topology (locked):**

| Surface | Role | Voice |
|---------|------|-------|
| **Local Nexus** (`localhost:5173`) | Full JARVIS — voice, realtime chat, recall-injected turns | Yes (v1) |
| **Deployed Vercel `/nexus`** | Cockpit, trends, awareness, async ask via dispatch | No (v1) |

Local SvelteKit routes reach WSL Hermes (`127.0.0.1:9119`) without public exposure. One codebase; voice pane activates when local backend is reachable. Tailscale for remote voice in v1.5.

**Data path:** Mic → local API → WSL Hermes (Whisper STT) → inference + Brain recall → ElevenLabs TTS (`tts.provider: elevenlabs`). Hermes is the brain; ElevenLabs is the voice skin. ConvAI-as-brain deferred.

**Duplex:** v1 = push-to-talk + streaming TTS. Always-on duplex is upstream [#35750](https://github.com/NousResearch/hermes-agent/issues/35750).

### Context, proactivity, suggestions

Hybrid recall — light ambient context always, deep pull when needed; machinery invisible. Proactive rhythm + events + intent nudges, never spammy. Suggest better paths when meaningfully better, unprompted.

## What Makes This Different

**Unfair advantage:** Persistent structured brain Hermes can read, write, and schedule against — compounding vs session-zero reset.

**Moat:** **Compounding** (71 epics of institutional memory) + **full-stack control** (executes, not just advises). Context feeds compounding; operator-owned infra is secondary.

**Honest weakness:** Cold-start one-offs — generic AI wins when grounding overhead has no payoff.

**Why now:** Platform pieces crossed threshold together in ~90 days; omniscience layer is the tail to finish.

**Frame:** Hermes orchestrates tools (Cursor for code, Hermes for operating) — doesn't replace all of them.

**Defensibility:** Uncertain at 2 years; compounding velocity may be the emergent moat.

## Who This Serves

**Primary:** Solo operator-builder → AI-native agency; system is vehicle and product. Transitioning builder → operator within ~6 months.

**Weekly outcome:** Stop starting from zero. Catch-up becomes act. Proposals, decisions, and trends pre-oriented. Success ranked: lower anxiety, then better decisions; output follows.

**Agency model:** Clients get work product ROI, not Hermes access. Scale-with-me first; SaaS only after meaningful agency income.

**Aha moments:** (1) vague question answered without setup, (2) morning cockpit already right, (3) scope drift caught early; (4) no manual session-close week — later.

## Success Criteria

**30-day test:** Cockpit opened unprompted + proactive surfacing + paid work shipped/landed that week.

**Trust reset:** Confident fabrication in operator context; stopped catching gaps; silent vault corruption.

**Cost:** No rationing questions; spend produces output faster than without the system. Hard cap when billing steady.

| Dimension | Bar |
|-----------|-----|
| Recall | Zero dead-ends without follow-up; cite sources |
| Proactive | Morning cockpit correct; ≥1 scope-drift save/month; actionable trend intel |
| Hands-off | North star: forgot skills exist; 30-day: auto session-close ≥80% |
| Cost | Ask freely; auxiliary never on main model |

## Scope

**Sequence:** Recall → learning → automation.

### v1 IN

| Item | Notes |
|------|-------|
| Semantic recall | PortalEmbedder + Brain index + cited auto-injection |
| Morning digest | Automate + enrich existing digest |
| Nexus voice (local) | JARVIS pane; ElevenLabs via Hermes; amends ADR-HERMES-001 |
| Auxiliary → Haiku | Cost mechanism; retire inert `smart_model_routing` |
| Auto session-close | Optional parallel if 80% milestone is hard target |

### v1.5 IN

Honcho + memory budgets; skill automation; kanban + trend fusion; Tailscale remote voice.

### OUT (near-term)

Client Hermes; silent execution; day-one intention inference; build-phase meta-mode; duplex; Desktop/Discord voice v1.

**Tension acknowledged:** Vision describes full kanban cockpit and intention inference; v1 delivers felt intelligence via recall + digest + local voice.
