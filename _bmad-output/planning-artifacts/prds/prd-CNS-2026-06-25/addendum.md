# Addendum — PRD Hermes Omniscient

Technical depth, ADR drafts, and rejected-alternative rationale. Not duplicated in `prd.md` main narrative.

## ADR amendments required (draft stubs — finalize after operator menus)

### ADR-HERMES-001 amendment — Voice surface reversal

**Was (locked 2026-06-24):** Hermes Desktop/Discord = primary conversational + voice; Vercel `/nexus` = awareness + async ask only.

**Proposed amendment (brief-locked 2026-06-25):**

| Surface | Role | Voice v1 |
|---------|------|----------|
| **Local Nexus** (`localhost:5173`) | Primary JARVIS — voice pane, realtime chat, recall-injected turns | Yes |
| **Deployed Vercel `/nexus`** | Cockpit, trends, awareness, async ask via dispatch | No (mic UI local-only-activated) |
| **Hermes Desktop / Discord** | Text/async supported; voice deferred v1 | No v1 |

**Rationale:** Operator wants visually polished JARVIS pane in cns-dashboard with same recall/memory as text; Desktop voice deferred; Vercel cannot reach WSL `:9119` without tunnel (v1.5 Tailscale).

### ADR-HERMES-013 (new) — Vercel ↔ WSL voice reachability split

**Locked (operator):** Local Nexus SvelteKit `$lib/server` routes → `127.0.0.1:9119`. Voice pane local-only-activated; deployed Vercel has no mic UI.

### ADR-HERMES-014 (new) — ElevenLabs delivery path

*Deferred to architecture (operator Menu OQ-1=C).*

### ADR-HERMES-015 (new) — FR18 cited auto-injection seam

*See addendum § FR18 auto-injection seam (OQ-9).*

## Voice topology (from brief addendum)

```
Deployed Vercel /nexus — awareness · trends · digest · async ask — NO realtime voice v1

Local Nexus (localhost:5173) — JARVIS voice pane · push-to-talk · streaming TTS
    → SvelteKit server routes (same machine / WSL network)
    → WSL Hermes gateway (:9119) + Brain recall + memory
    → tts.provider: elevenlabs (or Portal-managed TTS)
    → Audio stream → browser
```

## Interaction input model (naming collision resolution)

| Term | What it is | v1 role |
|------|------------|---------|
| **Wispr Flow** | Third-party OS-level dictation app (owned, free) | Universal speech→text into any field (Cursor, Discord, Nexus async ask, terminal). No vault awareness, no TTS. |
| **Whisper** | faster-whisper STT inside Hermes voice pipeline | Optional in-pane capture for local JARVIS pane only |

## Recall policy config shape (for architecture — not normative values)

```json
{
  "schema_version": 1,
  "channels": {
    "voice_pane": { "max_top_k_fetch": "TUNE", "min_score_threshold": "TUNE", "max_injection_tokens": "TUNE", "max_chunks": "TUNE" },
    "standard_text": { "max_top_k_fetch": "TUNE", "min_score_threshold": "TUNE", "max_injection_tokens": "TUNE", "max_chunks": "TUNE" },
    "yapped_text": { "max_top_k_fetch": "TUNE", "min_score_threshold": "TUNE", "max_injection_tokens": "TUNE", "max_chunks": "TUNE" }
  },
  "yapped_text_min_chars": "TUNE",
  "index": { "incremental_cron_minutes": "TUNE", "stale_penalty_factor": "TUNE", "max_staleness_minutes": "TUNE" },
  "shadow_mode": false
}
```

**FR19 calibration:** golden query set + harness → tune `TUNE` placeholders → log config version at go-live.

## FR18 auto-injection seam (OQ-9 — architecture must resolve)

FR18 specifies *what* gets injected and *how much* (per-channel policy). It does **not** specify *where* recall hooks into a Hermes turn. Parent PRD §2 flagged: *no dedicated external-event-injection endpoint — awareness must be designed.*

**Candidate seams (architecture evaluates — Context7 on Hermes extension points before deciding):**

| # | Seam | Pros | Risks |
|---|------|------|-------|
| 1 | **Native memory provider** (`agent/memory_provider.py`) | Rides existing memory injection path; config/skill territory | Must confirm recall fits memory provider contract; budget interaction with native memory caps |
| 2 | **Gateway system-message layering** | Parent PRD notes frontend system message layers on core prompt | Per-surface wiring (Discord vs Local Nexus proxy); may not cover all channels uniformly |
| 3 | **Always-on MCP tool** (agent instructed each turn) | Loosely coupled; no core fork | Token overhead; model may skip tool; less "automatic" than true injection |

**Hard constraints (non-negotiable):**
- Must use a **supported Hermes extension seam** — no fork of `~/.hermes/hermes-agent` core (dies on `hermes update`).
- Implementation must stay **off the Omnipotent.md protect-list** — injection lives in `~/.hermes/` config, MCP registration, memory-provider wiring, or CNS skills; not `src/agents/synthesis-adapter-llm.ts` et al.
- Brain fetch/trim logic remains in `src/brain/` (additive); seam is the Hermes-side delivery only.

**Deliverable:** ADR-HERMES-015 (or subsection of recall architecture) selects seam + documents channel metadata path (`voice_pane` from Nexus proxy, `yapped_text` from char count).

## Loop Engineering mapping (v1 vs v1.5)
|------|-----|------|
| Discover (internal dev-state) | Morning cockpit scan — informs only | Composed into unified loop |
| Build | Operator/Cursor — not autonomous | Approval-gated autonomous build |
| Verify (adversarial) | Skills exist; operator-invoked | Wired into schedulable run-chain |
| Persist | WriteGate/PAKE/audit — done | Reuse |
| Schedule | 13 crons; no composed cycle | Unified Loop epic |
