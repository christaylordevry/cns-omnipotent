# HANDOFF — Hermes Consolidation Session 5 (2026-06-25)

**For:** a fresh Claude Code session (Sonnet 4.6) continuing this initiative.
**Role:** strategic checker/verifier alongside the operator (Chris), who runs BMAD workflows in **Cursor**. Verify Cursor's outputs against the locked plan, check diffs against the protect-list, and advise next steps. You do NOT run the BMAD story workflows yourself.

---

## 1. What this is

Make **Hermes the single always-on intelligence layer ("JARVIS")** on **one provider (Nous Portal)**, integrated with the Nexus/CNS dashboard. Full plan:

- **PRD:** `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- **Architecture (8 ADRs):** `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- **Epics/stories (29 across Epics 74–78):** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- **Session 1–4 handoffs:** `HANDOFF-2026-06-24-hermes-consolidation.md` through `HANDOFF-2026-06-24-session4-hermes-consolidation.md`

---

## 2. Where we are RIGHT NOW (end of session 5)

Branch: **`hermes-consolidation`** (off master). HEAD: **`09cea0d`** (pending one more commit — see §6).

### Session 5 completions

| Story / Item | Commit | Key outcome |
|---|---|---|
| 75-5 Run-chain E2E revival | `b350841` | Live chain PASS, PAKE++, vault notes written, chain marked Revived |
| sprint-status cleanup | `0143574` | 75-2/75-3/75-4/76-3 → done; epic-75 → done |
| 76-3 inbox-triage-plan | `09cea0d` | 103-item inbox triage plan committed to vault |
| AGENTS.md session-close | **pending** | `specs/cns-vault-contract/AGENTS.md` modified, not yet committed — see §6 |

### Epic status (end of session 5)

| Epic | Status | Notes |
|------|--------|-------|
| 72 | `done` | |
| 73 | `in-progress` | 7/8 done; 73-8 (health gate) backlog — deferred |
| 74 | `done` | 74-4 Tool Gateway stays `backlog` (non-blocking) |
| 75 | **`done`** | All 5 stories done; run-chain revived and evidenced |
| 76 | `in-progress` | 3/6 done; 76-4/76-5/76-6 backlog |
| 77 | `backlog` | **NEXT — JARVIS awareness in Nexus** |
| 78 | `backlog` | Voice + per-skill routing |

---

## 3. Locked decisions — DO NOT re-litigate

All from prior sessions, still valid:
- **Topology (a) [ADR-HERMES-001]:** JARVIS on Hermes Desktop/Discord; `/nexus` = data-awareness + async ask box only
- **FR11 = Option A:** keep one `ANTHROPIC_API_KEY` for run-chain; zero engine edits
- **FR12 mechanism:** least-privilege Convex HTTP read endpoint
- **Dashboard auth = Nous OAuth** primary; basic-auth fallback trusted localhost only
- **Dashboard redesign = DEFERRED**
- **Session-close model = DEFERRED** (switch to Haiku after Epic 75 done — now revisit: Epic 75 is done)

---

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

## 5. NEXT: Epic 77 — JARVIS Awareness in Nexus

Epic 77 is now **unblocked** (Epic 75 done, Epic 74 done).

**Sequencing within Epic 77:**
- 77-1 gates 77-5 (Convex HTTP endpoint must exist before Nexus panels can read it)
- 77-2/77-3/77-4 can run in parallel after 77-1
- 77-6 (async ask box) is stretch-FR13 — not Epic 77 MVP gate

**Stories:**

| Story | Summary |
|---|---|
| 77-1 | Convex `hermes-awareness` snapshot HTTP endpoint (gates 77-5) |
| 77-2 | Hermes awareness-pull client and cron cache |
| 77-3 | Convex webhook push for high-signal events |
| 77-4 | Awareness-sync Hermes skill |
| 77-5 | Nexus awareness panels UI (depends 77-1) |
| 77-6 | Async ask-Hermes box (stretch-FR13) |
| 77-7 | Dashboard sync retention decision |

**To start:** fresh Cursor chat → `/bmad-create-story` → source `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` Epic 77, Story 77-1.

---

## 6. Working tree — one pending commit

One item must be committed before starting Epic 77:

| File | Action |
|---|---|
| `specs/cns-vault-contract/AGENTS.md` | Session-close §7 run-chain row; commit as `chore(hermes-consolidation): session-close AGENTS.md sync — run-chain §7 row` |

Command:
```bash
git add specs/cns-vault-contract/AGENTS.md
git commit -m "chore(hermes-consolidation): session-close AGENTS.md sync — run-chain §7 row"
```

Note: `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` was **not** modified by session-close this run — the spec mirror (`specs/cns-vault-contract/AGENTS.md`) is the only file changed.

---

## 7. Deferred / backlog items

| Item | Priority | Notes |
|------|----------|-------|
| **Session-close model → Haiku** | ops (**now eligible**) | Epic 75 done — original deferral condition met; revisit this session |
| **Discord `#hermes` skill binding** | ops | `run-chain` missing from `channel_skill_bindings`; add per `config-snippet.md`; raise `terminal.timeout` > 180s |
| **73-8** Entity intelligence health gate | low | No story file; create when ready for live-prod verification |
| **74-4** Tool Gateway web search | low | FR-GATE confirmed; configure when Portal paid tier needed |
| **76-4** Governance stubs (mobile-posture, personas) | low | |
| **76-5** Two-bot vault boundary documentation | low | |
| **76-6** Memory pillars and Honcho verification | low | |
| **Dashboard `RUN_CHAIN_STORY_KEY`** | low | Still points at Epic 38 (`scripts/dashboard-sync.ts:112`); update to 75-5 |
| **`parseEnvFile` edge cases** | low | EXPORT casing, CRLF — deferred from 75-5 review |
| **Skill mirror dormant refs** | low | `trigger-pattern.md`, `task-prompt.md` still reference dormant state |
| **Inbox triage execution** | operator | 103 items categorized; run `/triage` family via Hermes when ready |
| **OpenRouter account drain / Firecrawl cancel** | ops | Phase 5 post-74-4; do not cancel yet |

---

## 8. Key artifacts this session produced

| Artifact | Path |
|---|---|
| E2E revival evidence | `_bmad-output/implementation-artifacts/75-5-run-chain-e2e-revival-evidence.md` |
| CLI smoke evidence | `_bmad-output/implementation-artifacts/75-5-run-chain-smoke-evidence.md` |
| Story 75-5 (closed) | `_bmad-output/implementation-artifacts/75-5-run-chain-end-to-end-revival-verification.md` |
| Inbox triage plan | `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md` |

---

## 9. Working style

- Verify Cursor's claims independently (read actual diffs — don't rubber-stamp)
- Give clear recommendation + paste-ready message for Cursor at each gate
- Commit hygiene: explicit paths, logical commits, co-author trailer
- Sprint-status.yaml and story files must both reflect true status
- Be concise and decisive

## 10. Key file locations

- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`
- Epics: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- Run-chain SSOT: `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
