# Architecture Vision — Hermes JARVIS End State

**Companion to:** `prd-hermes-consolidation.md`
**Status:** Vision diagram for `bmad-create-architecture` input · **Date:** 2026-06-24

> This is the **target end state** once all epics (A–D) are built — not current state.
> It is a north-star picture, not a locked design. The architecture phase resolves the
> open questions in PRD §10 (especially the FR12 event-awareness mechanism).

> **⚠️ Updated post-architecture (ADR-HERMES-001, topology a):** the Vercel-hosted cockpit
> **cannot reach** WSL-local Hermes (`:9119`). So the `Cockpit ⇄ API (embed)` arrow below is
> **Epic D3 — dev-local/tunnel opt-in only, NOT production.** In production, the cockpit's
> "live agent" feel comes from **FR12 data-awareness** (Convex `/hermes/awareness` HTTP pull +
> webhook push) and a **Vercel-safe async "ask Hermes" box** (via `hermes-dispatch` → reply in
> Discord/Desktop). The conversational + voice JARVIS surface is **Hermes Desktop / Discord.**

---

## Full-picture diagram

```mermaid
flowchart TB
    OP(["Operator — Chris<br/>talk / voice / type"])

    subgraph PROVIDER["Nous Portal — single subscription (cost-effective)"]
        direction LR
        INF["Inference<br/>sonnet-4.6 / haiku-4.5"]
        TG["Tool Gateway<br/>web search · TTS · browser"]
        EMB["/v1/embeddings"]
        PROXY["Subscription Proxy<br/>127.0.0.1:8645/v1"]
    end

    subgraph SURFACES["Operator Surfaces"]
        DESK["Hermes Desktop<br/>(Windows -> WSL :9119)"]
        DISC["Discord #hermes<br/>(mobile/secondary)"]
        COCKPIT["Nexus Cockpit /nexus<br/>+ embedded JARVIS pane (voice)"]
        OBS["Obsidian (human)"]
        NEXUSBOT["NEXUS bridge bot<br/>(Claude Code · UNTOUCHED)"]
    end

    subgraph HERMES["HERMES — single JARVIS intelligence layer"]
        direction TB
        CORE["Hermes Agent core<br/>provider: nous"]
        MEM["Memory · Skills · Honcho<br/>self-improving loop"]
        API["API Server /v1 + voice"]
        SKILLS["Skills: session-close · digest<br/>vault-think · triage · run-chain"]
        CORE --- MEM
        CORE --- API
        CORE --- SKILLS
    end

    subgraph CONTROL["CNS Control Layer (Omnipotent.md)"]
        VIO["Vault IO MCP<br/>(WriteGate · PAKE · audit)"]
        DIGEST["Morning Digest<br/>Node orchestrator"]
        RUNCHAIN["Run-chain (revived)<br/>Research->Synthesis->Hook->Boss"]
        BRAIN["Brain semantic index"]
        ROUTING["Per-skill model routing"]
    end

    subgraph KNOW["PAKE Knowledge Layer"]
        VAULT[("Knowledge-Vault-ACTIVE<br/>PARA · source of truth")]
        NLM["NotebookLM"]
    end

    subgraph DATA["Nexus / Convex (cns-dashboard)"]
        CONVEX[("Convex DB")]
        OBSV["Observability:<br/>runChainStatus · agentLog<br/>mcpStatus · vaultHealth"]
        INTEL["Intelligence:<br/>digest · entities · trends<br/>investigations"]
        CONVEX --- OBSV
        CONVEX --- INTEL
    end

    %% operator paths
    OP <--> DESK
    OP <--> DISC
    OP <--> COCKPIT
    OP --> OBS
    OP <--> NEXUSBOT

    %% surfaces to hermes
    DESK <--> CORE
    DISC <--> CORE
    COCKPIT -.->|"D3 embed (dev-local/tunnel opt-in only)"| API

    %% hermes uses portal
    CORE -->|inference + voice/TTS| INF
    CORE --> TG
    BRAIN --> EMB
    RUNCHAIN -->|OpenAI format| PROXY
    PROXY --> INF

    %% hermes drives control layer
    CORE --> VIO
    CORE --> SKILLS
    SKILLS --> DIGEST
    SKILLS --> RUNCHAIN
    CORE --> BRAIN
    CORE --> ROUTING
    ROUTING -.cheap tasks.-> INF

    %% knowledge
    VIO <--> VAULT
    CORE --> NLM
    NLM -.fan-out.- VAULT
    BRAIN --> VAULT
    RUNCHAIN --> VAULT
    DIGEST --> VAULT

    %% bidirectional dashboard awareness (FR12)
    DIGEST --> CONVEX
    CORE <-->|"read intel + write state<br/>(JARVIS awareness)"| CONVEX
    COCKPIT -->|reactive queries| CONVEX
    COCKPIT -->|dashboard AI via Portal| PROXY

    %% nexus bot stays on its own vault path
    NEXUSBOT <--> VAULT

    classDef portal fill:#1e3a5f,stroke:#4a90d9,color:#fff
    classDef hermes fill:#3d2c5f,stroke:#9b6dd9,color:#fff
    classDef protect fill:#5f3a1e,stroke:#d99b4a,color:#fff
    class INF,TG,EMB,PROXY portal
    class CORE,MEM,API,SKILLS hermes
    class NEXUSBOT protect
```

---

## How to read it

- **Hermes (purple) is the center** — one intelligence layer reachable from Desktop, Discord, and the embedded cockpit pane, all sharing the same memory/skills/Honcho user-model so intelligence compounds across surfaces.
- **Nous Portal (blue) is the single fuel source** — inference, voice/TTS, embeddings, and the proxy that revives run-chain and powers the dashboard's own AI. One bill replaces openai-codex + OpenRouter + dead Anthropic + standalone TTS.
- **The new JARVIS seam** is the bold bidirectional arrow `Hermes <-> Convex` (FR12) — Hermes reads live intelligence (digest / entities / trends / investigations) and writes its own state into the observability tables, so the cockpit reflects a live agent, not a 3-minute snapshot. *The exact mechanism is the #1 architecture question (PRD §10.1).*
- **NEXUS bridge (orange) sits to the side, untouched**, on its own vault path — the "keep both bots" boundary (NFR8).
- **The engine and vault governance stay exactly as built** — Vault IO MCP's WriteGate / PAKE / audit still gates every write; run-chain's hook/boss/weapons logic is revived by credential (FR11), not rewritten.

---

## What is genuinely NEW vs an upgrade of an existing seam

| Element | New build? | Notes |
|---|---|---|
| Portal provider switch | Config | Verified CLI path |
| Hermes Desktop + dashboard service | Config + systemd | Native Hermes |
| Voice (push-to-talk + TTS) | Config | Native Hermes + Portal Tool Gateway |
| "Grows smarter" (memory/skills/Honcho) | Native | Used, not built |
| Embedded cockpit chat pane | **New** | Hermes API Server + session-key |
| FR12 bidirectional Convex awareness | **New (the real build)** | Upgrades existing 3-min snapshot seam |
| Dashboard AI via Portal | Rewire | `explain`/`summarise-risk`/investigation off dead OpenRouter |
| Per-skill model routing | Activate | Layer-3 engine already built, was blocked on Hermes-native API |
| Run-chain revival | Credential | Engine untouched (FR11 decision) |
