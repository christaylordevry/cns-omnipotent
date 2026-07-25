# CNS Project Overview

**Updated:** 2026-07-25 (exhaustive multi-part brownfield rescan)

## Purpose

CNS is the operator’s personal intelligence system: ingest signals, score them for personal relevance, judge them in a morning cockpit, investigate, deepen trends, track entities, and capture knowledge in a PARA vault — with Hermes as the Discord/agent runtime and Convex as the shared data plane for the Nexus web app.

## Structure

| Part | Path | Role |
|------|------|------|
| Control | Omnipotent.md | Vault IO MCP, crons, adapters, constitution |
| App | cns-dashboard | Nexus + Trends UI on Convex `amiable-ox-862` |
| Runtime | ~/.hermes | Gateway, skills, scorer, voice |
| Knowledge | Knowledge-Vault-ACTIVE | PAKE vault (MCP only) |

## Current product truth

- **3** Nexus nav routes live; **5** dead buttons; `/trends` built but not in Nexus nav.
- Cockpit design: **INSTRUMENT** (2026-07-24).
- Morning digest: deterministic Node completion → Convex (legacy agent path still in tree).
- Gap is connective tissue and coherence, not raw capability (master plan + capability-parity scan).

## Documentation map

Full Phase 0 package: `_bmad-output/planning-artifacts/brownfield/`  
Start at `00-index.md`.

## Tech snapshot

- Omnipotent: Node ≥20, TypeScript, MCP SDK, Vitest + node:test
- Dashboard: SvelteKit 2 / Svelte 5 / Convex 1.39 / Vercel
- Hermes: Nous portal, Claude Sonnet 4.6 default, Honcho memory
