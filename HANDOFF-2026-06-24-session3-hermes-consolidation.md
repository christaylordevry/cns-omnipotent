# HANDOFF — Hermes Consolidation Session 3 (2026-06-24)

**For:** a fresh Claude Code session (Sonnet 4.6) continuing this initiative.
**Role:** strategic checker/verifier alongside the operator (Chris), who runs BMAD workflows in **Cursor**. Verify Cursor's outputs against the locked plan, check diffs against the protect-list, and advise next steps. You do NOT run the BMAD story workflows yourself.

---

## 1. What this is

Make **Hermes the single always-on intelligence layer ("JARVIS")** on **one provider (Nous Portal)**, integrated with the Nexus/CNS dashboard. Full plan:

- **PRD:** `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- **Architecture (8 ADRs):** `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- **Epics/stories (29 across Epics 74–78):** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- **Session 1 handoff:** `HANDOFF-2026-06-24-hermes-consolidation.md`
- **Session 2 handoff:** `HANDOFF-2026-06-24-session2-hermes-consolidation.md`

---

## 2. Where we are RIGHT NOW (end of session 3)

Branch: **`hermes-consolidation`** (off master). HEAD: **`8c9f67f`**.

### Session 3 completions

| Story | Commit | Key outcome |
|-------|--------|-------------|
| 76-1 Session-close refresh | `58dc23d` | First real `/session-close` post-Portal; AGENTS §8 v2.1.44; epics 73+76 live in orientation artifacts |
| AGENTS mirror sync | `d71ad8a` | `specs/cns-vault-contract/AGENTS.md` synced to v2.1.44 |
| 76-2 project-context sync | `22ce571` | Both `project-context.md` files reflect Hermes Consolidation phase, ADR-HERMES-001..008 |
| 76-3 Fast-scan + inbox triage | `da38a2f` | fast-scan-index refreshed (55 rows); `inbox-triage-plan.md` created in vault canonical (103 items: 41 act-now / 52 defer / 10 archive) |
| 73-7 Digest entity sections | `8c9f67f` | Clean code review; all 71 tests pass; protect-list untouched |

### Epic status (end of session 3)

| Epic | Status | Notes |
|------|--------|-------|
| 72 | `done` | Closed in session 3 T2 |
| 73 | `in-progress` | 7/8 done; 73-8 (health gate) backlog — deferred |
| 74 | `done` | 74-4 Tool Gateway stays `backlog` (non-blocking) |
| 75 | `backlog` | Run-chain revival — **next priority** |
| 76 | `in-progress` | 3/4 done; 76-4 (governance stubs) backlog — deferred |
| 77 | `backlog` | JARVIS awareness in Nexus (cns-dashboard primary) |
| 78 | `backlog` | Voice + per-skill routing |

### Live system state (verified 2026-06-24 session 3)

- **Hermes:** v0.17.0, `provider: nous`, `model: anthropic/claude-sonnet-4.6`
- **Compression:** `nous` / `anthropic/claude-haiku-4.5`
- **Dashboard:** `hermes-dashboard.service` active on `0.0.0.0:9119`; `auth_path: oauth`
- **Browser UI:** `http://localhost:9119` (Windows) / `http://127.0.0.1:9119` (WSL)
- **Gateway:** systemd-managed (watchdog every 3 min)
- **Session-close:** live and verified (failure_class: null, 3/3 NotebookLM ok, 642 tests)
- **AGENTS.md:** v2.1.44 (both vault canonical and repo mirror in sync)

---

## 3. Locked decisions — DO NOT re-litigate

All from prior sessions, still valid:
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

## 5. NEXT: Epic 75 (run-chain revival)

**Recommended next story: 75-1** — the first story in Epic B (run-chain revival). Epic 73 is functionally complete (73-8 health gate is backlog, non-blocking); Epic 76 orientation is 3/4 done (76-4 governance stubs deferred). Epic 75 is the next Hermes Consolidation track story and directly advances the JARVIS build.

**To start:** fresh Cursor chat → `/bmad-create-story` for **75-1**.

Check `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` Epic 75 section for the full story spec before generating.

---

## 6. Deferred / backlog items

| Item | Priority | Notes |
|------|----------|-------|
| **73-8** Entity intelligence health gate | low | No story file; create when ready for live-prod verification |
| **74-4** Tool Gateway web search | low | FR-GATE confirmed; configure when Portal paid tier needed |
| **76-4** Governance stubs (mobile-posture, personas) | low | Orientation polish; fold into a future session-close |
| **Inbox triage execution** | operator | 103 items categorized; run `/triage` family via Hermes when ready |
| **OpenRouter account drain / Firecrawl cancel** | ops | Phase 5 post-74-4; do not cancel yet |
| **NEXUS bridge down** | ops | Separate ops issue; not blocking Epic 76 |

---

## 7. Working style

- Verify Cursor's claims independently (read actual diffs — don't rubber-stamp)
- Give clear recommendation + paste-ready message for Cursor at each gate
- Commit hygiene: explicit paths, logical commits, co-author trailer
- Be concise and decisive

## 8. Key file locations

- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`
- Inbox triage plan: `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md` (vault canonical)
- Triage plan generator: `scripts/generate-inbox-triage-plan.mjs`
- Epics: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
