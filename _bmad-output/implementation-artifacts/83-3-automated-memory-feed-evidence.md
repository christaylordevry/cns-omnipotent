# Story 83-3 — Automated memory feed verification evidence

**Story:** `83-3-automated-session-close-feeding-memory`  
**Date:** 2026-07-06 (AEDT)  
**OQ-8 status:** **Closed** — no scheduled session-close; automated memory = Honcho (per-turn) + native flush (session exit / session reset only)  
**Operator decision:** LEAN / NO BUILD — verify + document only; no cron, no config edits

---

## Hermes baseline

```
Hermes Agent v0.17.0 (2026.6.19)
memory.provider: honcho
memory_enabled / user_profile_enabled: true / true
```

Cross-references:
- **83-1:** `83-1-honcho-config-evidence.md` — Honcho dialectic live, `dialecticCadence: 3`, observation on, `sessionStrategy: global`
- **83-2:** `83-2-memory-budget-evidence.md` — caps raised to 4400/2750, cross-session native recall PASS

---

## Live Honcho status (2026-07-06, redacted)

Captured: `hermes honcho status` (2026-07-06 ~07:54 AEDT)

```
Honcho status
────────────────────────────────────────
  Host:           hermes
  Enabled:        True
  API key:        ...[REDACTED]
  Workspace:      cns-jarvis
  Config:         /home/christ/.hermes/honcho.json
  AI peer:        hermes
  User peer:      chris
  Session key:    cns-jarvis
  Session strat:  global
  Recall mode:    hybrid
  Context budget: 1200 tokens
  Dialectic cad:  every 3 turns
  Reasoning:      base=low, cap=high, heuristic=on
  Observation:    user(me=True,others=True) ai(me=True,others=True)
  Write freq:     async

  Connection... OK

  User peer card (24 facts):
    - IDENTITY: [REDACTED — 4 facts shown in CLI, 20 more not listed]
    - ATTRIBUTE: [REDACTED — sample categories: Location, Track, Working Style, OS, Repository]
    ... and 14 more

  AI peer representation:
    ## Explicit Observations
    [REDACTED — timestamped observation entries present; bodies omitted]
```

**Compounding proof:** User peer `chris` = **24 facts** (was **0** on 2026-07-05 per 83-1 baseline). AI peer representation populated.

### Honcho config excerpt (`~/.hermes/honcho.json`, redacted)

```json
{
  "dialecticCadence": 3,
  "hosts": {
    "hermes": {
      "enabled": true,
      "aiPeer": "hermes",
      "peerName": "chris",
      "workspace": "cns-jarvis",
      "sessionStrategy": "global",
      "observation": {
        "user": { "observeMe": true, "observeOthers": true },
        "ai": { "observeMe": true, "observeOthers": true }
      }
    }
  }
}
```

---

## Native memory config (`~/.hermes/config.yaml`, read-only grep)

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false
  memory_char_limit: 4400
  user_char_limit: 2750
  provider: honcho
  nudge_interval: 10
  flush_min_turns: 6
  creation_nudge_interval: 15
```

**Session reset (Discord — triggers same native flush hook as session end):**

```yaml
session_reset:
  mode: both
  idle_minutes: 60
  at_hour: 21
```

---

## Native flush log excerpt (`~/.hermes/logs/agent.log`, redacted)

Native memory shutdown hook fires on **session exit** (CLI) or **session reset** (Discord: `idle_minutes: 60`, `at_hour: 21`) — **not per-turn**. Mid-session persistence uses the `memory` tool (immediate disk write) and Honcho observation (async); the shutdown hook is an auxiliary flush when the session ends or resets.

```
2026-07-04 10:25:05,492 INFO [20260704_102434_a94bc2] cli: CLI cleanup calling memory shutdown for session 20260704_102434_a94bc2 with 10 message(s)
2026-07-05 23:42:43,198 INFO [20260705_234227_192363] cli: CLI cleanup calling memory shutdown for session 20260705_234227_192363 with 4 message(s)
2026-07-05 23:42:59,493 INFO [20260705_234251_5bdc2b] cli: CLI cleanup calling memory shutdown for session 20260705_234251_5bdc2b with 2 message(s)
```

Context line (same session, pre-shutdown — Honcho upload, bodies redacted):

```
2026-07-05 23:42:43,132 INFO plugins.memory.honcho.session: Uploaded MEMORY.md to Honcho for cns-jarvis (user peer)
2026-07-05 23:42:43,198 INFO [20260705_234227_192363] cli: CLI cleanup calling memory shutdown for session 20260705_234227_192363 with 4 message(s)
```

`flush_min_turns: 6` — automatic auxiliary flush runs only when session message count meets threshold **at shutdown/reset**; below threshold, explicit `memory` tool writes still persist immediately (see 83-2 evidence).

---

## OQ-8 resolution table

| Question | Resolution | Owner | Date |
|----------|------------|-------|------|
| OQ-8: Auto session-close trigger (idle / daily / hybrid)? | **None scheduled.** Automated memory feed = **Honcho (per-turn dialectic, cadence 3)** + **native flush (session exit CLI / session reset Discord only — not per-turn)**. Full `/session-close` = operator manual when AGENTS.md §8, vault synthesis, CNS-Daily-Rhythm AUTO blocks, fast-scan index, or NotebookLM fan-out needed. **$0 recurring** for memory automation. Cronning session-close rejected (~$3–5/run, ~$90–150/mo). | Operator | 2026-07-06 |

---

## Three-layer memory vs session-close (FR15)

```
Per-turn (automatic, $0 cron):
  1. Native MEMORY.md + USER.md injection     ← session-start snapshot (83-2 caps 4400/2750)
  2. Honcho prefetch_all + dialectic          ← every 3 turns (83-1)
  3. cns-brain-recall pre_llm_call            ← Epic 79 (unchanged)

Per-session exit / reset only (automatic, NOT per-turn):
  4. Native memory shutdown flush hook        ← agent.log; flush_min_turns: 6
     CLI: session exit
     Discord: session_reset idle_minutes 60 / at_hour 21

On-demand only (manual /session-close, ~$3–5):
  5. AGENTS.md §8 regen + vault synthesis + NotebookLM fan-out
  6. MEMORY.md CNS State block refresh (session-close script — governance, not Honcho compounding)
```

PRD FR15 "Automate session-close feeding memory" is satisfied by **existing Hermes + Honcho mechanisms**, not by cronning session-close.

---

## Scope boundary (AC #3)

| Item | Status |
|------|--------|
| Cron / systemd / Hermes scheduled session-close | **Not created** (operator rejected) |
| `~/.hermes/config.yaml`, `honcho.json`, `brain-recall-policy.json` | **No edits** (read-only grep) |
| `AI-Context/AGENTS.md`, WriteGate paths | **No edits** |
| New scripts / skills | **None** |

---

## Epic 83 closure (v1.5 FR15 tranche)

Epic 83 complete at verification layer:

| Story | Deliverable | Status |
|-------|-------------|--------|
| 83-1 | Honcho dialectic configuration | Done — `83-1-honcho-config-evidence.md` |
| 83-2 | Memory budget raise + cross-session verification | Done — `83-2-memory-budget-evidence.md` |
| 83-3 | Automated feed verification + OQ-8 close | **This file** |

**FR15:** Progressive operator learning — Honcho compounds per turn; native memory persists via tool writes + session-exit/reset flush; full session-close remains manual governance refresh.

**OQ-8:** Closed 2026-07-06 — trigger definition in operator guide §15.3.1 and this evidence file.
