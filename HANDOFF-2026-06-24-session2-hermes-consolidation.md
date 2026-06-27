# HANDOFF — Hermes Consolidation Session 2 (2026-06-24)

**For:** a fresh Claude Code session (Sonnet 4.6) continuing this initiative.
**Role:** strategic checker/verifier alongside the operator (Chris), who runs BMAD workflows in **Cursor**. Verify Cursor's outputs against the locked plan, check diffs against the protect-list, and advise next steps. You do NOT run the BMAD story workflows yourself.

---

## 1. What this is

Make **Hermes the single always-on intelligence layer ("JARVIS")** on **one provider (Nous Portal)**, integrated with the Nexus/CNS dashboard. Full plan:

- **PRD:** `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- **Architecture (8 ADRs):** `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- **Epics/stories (29 across Epics 74–78):** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- **Original handoff:** `HANDOFF-2026-06-24-hermes-consolidation.md`

---

## 2. Where we are RIGHT NOW (end of session 2)

Branch: **`hermes-consolidation`** (off master). HEAD: **`cfbf60a`**.

### Epic 74 — COMPLETE (except 74-4)

| Story | Status | Key outcome |
|-------|--------|-------------|
| 74-1 Brain audit | ✅ `754ff90` | StubEmbedder only — Portal-safe |
| 74-2 Portal OAuth + provider switch | ✅ `a5e36f2` | Hermes on nous/Sonnet 4.6; openai-codex fallback documented |
| 74-3 Aux compression on Portal | ✅ `827a920` | compression → nous/Haiku 4.5; OpenRouter off |
| 74-5 Gateway/digest regression | ✅ `3d90725` | FR4 Discord gate PASS; digest path verified |
| 74-6 Dashboard OAuth + systemd | ✅ `d3f83fd` | hermes-dashboard.service on 0.0.0.0:9119; auth_path: oauth |
| 74-7 Browser live chat | ✅ `dd74547` | Browser UI at localhost:9119; portal-desktop-ok confirmed |
| 74-8 Governance docs | ✅ `91343cc` | hermes-desktop.md created; routing.md reconciled; Operator Guide §15.13 |
| **74-4 Tool Gateway web search** | **backlog** | Non-blocking; FR-GATE confirmed; configure when ready |

### Live system state (verified 2026-06-24 ~12:30 AEST)

- **Hermes:** v0.17.0, `provider: nous`, `model: anthropic/claude-sonnet-4.6`
- **Compression:** `nous` / `anthropic/claude-haiku-4.5`
- **Dashboard:** `hermes-dashboard.service` active on `0.0.0.0:9119`; auth_path: oauth; client `quiet_ibex`
- **Browser UI:** `http://localhost:9119` (Windows) / `http://127.0.0.1:9119` (WSL)
- **Gateway:** running (PID 837348 at session end — re-verify; systemd managed)
- **NEXUS bridge:** was NOT running at 74-5 check — separate ops concern
- **verify.sh:** green on `hermes-consolidation`

---

## 3. Locked decisions — DO NOT re-litigate

All from original handoff, still valid:
- **Topology (a) [ADR-HERMES-001]:** JARVIS on Hermes Desktop/Discord; `/nexus` = data-awareness + async ask box only
- **FR11 = Option A:** keep one `ANTHROPIC_API_KEY` for run-chain; zero engine edits
- **FR12 mechanism:** least-privilege Convex HTTP read endpoint
- **Dashboard auth = Nous OAuth** primary; basic-auth fallback trusted localhost only
- **Dashboard redesign = DEFERRED**

## 4. PROTECT-LIST — verify every diff

```
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
scripts/run-chain.ts
```

Also untouched: NEXUS bridge, morning-digest cron scripts, Brain index, Vault IO MCP.

---

## 5. NEXT: Epic 76, Story 76-1 (highest priority)

**76-1 is the keystone for this session.** `/session-close` has been blocked since the start of the initiative because Hermes had no working provider. Epic 74 fixed that. Now 76-1 runs session-close for the first time, restoring the CNS daily rhythm.

**Pre-2 (deferred session-close)** is explicitly unblocked by 74-2 and must execute via story 76-1.

After 76-1, sequencing is: 76-2+ (other Epic 76 stories) → then Epic 75 (run-chain proxy) or back to 74-4 (Tool Gateway).

**To start:** fresh Cursor chat → `/bmad-create-story` for **76-1**.

---

## 6. Other pending items

- **74-4** (Tool Gateway web search) — backlog, non-blocking; run after 76-1 if desired
- **AGENTS.md §7 row** for `hermes-desktop.md` — deferred to **76-4** (needs session-close live first)
- **NEXUS bridge down** — separate ops issue; not blocking Epic 76
- **OpenRouter account drain / Firecrawl cancel** — Phase 5 post-74-4 ops; do not cancel yet
- **vault-fast-scan-index.md** — committed `cfbf60a`; working tree clean

---

## 7. Working style

- Verify Cursor's claims independently (read actual diffs — don't rubber-stamp)
- Give clear recommendation + paste-ready message for Cursor at each gate
- Commit hygiene: explicit paths, logical commits, co-author trailer
- Be concise and decisive

## 8. Key file locations

- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`
- Governance module (new): `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md`
- Routing module: `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`
- Epics: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
