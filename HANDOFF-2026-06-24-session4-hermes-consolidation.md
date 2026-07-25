# HANDOFF — Hermes Consolidation Session 4 (2026-06-24)

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
- **Session 3 handoff:** `HANDOFF-2026-06-24-session3-hermes-consolidation.md`

---

## 2. Where we are RIGHT NOW (end of session 4)

Branch: **`hermes-consolidation`** (off master). HEAD: **`3f2057b`**.

### Session 4 completions

| Story | Commit | Key outcome |
|-------|--------|-------------|
| 75-1 Hermes vitest domain | `722b28d` | `tests/hermes/**/*.test.ts` registered; placeholder bootstrap |
| 75-2 Run-chain governance module | `18b9171` | `AI-Context/modules/run-chain.md` + project stub + MEMORY cold-start pointer |
| 75-3 Hermes run-chain trigger skill | `8670092` | Skill mirror + install script + contract tests; shell-safety quoting rule added |
| 75-4 Anthropic key validate script | `3f2057b` | `scripts/validate-anthropic-key.ts` + 12 vitest tests + rotation docs in run-chain.md |

### Epic status (end of session 4)

| Epic | Status | Notes |
|------|--------|-------|
| 72 | `done` | |
| 73 | `in-progress` | 7/8 done; 73-8 (health gate) backlog — deferred |
| 74 | `done` | 74-4 Tool Gateway stays `backlog` (non-blocking) |
| 75 | `in-progress` | 4/5 done; **75-5 E2E revival** is next — gated on live Anthropic key |
| 76 | `in-progress` | 3/6 done; 76-3 inbox-triage-plan uncommitted (see below) |
| 77 | `backlog` | JARVIS awareness in Nexus |
| 78 | `backlog` | Voice + per-skill routing |

### Sprint tracker status (authoritative)

```yaml
75-1: done
75-2: review   # committed 18b9171; status not updated to done in yaml yet
75-3: review   # committed 8670092; status not updated to done in yaml yet
75-4: review   # committed 3f2057b; status not updated to done in yaml yet
75-5: backlog
76-3: review   # inbox-triage-plan.md uncommitted
```

**Note:** 75-2, 75-3, 75-4 show `review` in sprint-status.yaml but are fully committed and done. The yaml needs a cleanup pass — update those three to `done` at the start of the next session or fold into the 75-5 commit.

### Live system state (verified 2026-06-24 session 3, still valid)

- **Hermes:** v0.17.0, `provider: nous`, `model: anthropic/claude-sonnet-4.6`
- **Compression:** `nous` / `anthropic/claude-haiku-4.5`
- **Dashboard:** `hermes-dashboard.service` active on `0.0.0.0:9119`
- **Gateway:** systemd-managed (watchdog every 3 min)
- **Session-close:** live and verified
- **AGENTS.md:** v2.1.44 (vault canonical and repo mirror)

---

## 3. Locked decisions — DO NOT re-litigate

All from prior sessions, still valid:
- **Topology (a) [ADR-HERMES-001]:** JARVIS on Hermes Desktop/Discord; `/nexus` = data-awareness + async ask box only
- **FR11 = Option A:** keep one `ANTHROPIC_API_KEY` for run-chain; zero engine edits
- **FR12 mechanism:** least-privilege Convex HTTP read endpoint
- **Dashboard auth = Nous OAuth** primary; basic-auth fallback trusted localhost only
- **Dashboard redesign = DEFERRED**
- **Session-close model = DEFERRED** (switch to Haiku after Epic 75 done — saved in memory)

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

## 5. NEXT: Story 75-5 (E2E run-chain revival)

**This story is OPERATOR-GATED.** It cannot start until Chris has:

1. Obtained a new `ANTHROPIC_API_KEY` from console.anthropic.com
2. Updated `.env.live-chain` with the new key
3. Run `npx tsx scripts/validate-anthropic-key.ts` — must exit **0**

**Once the key is live**, proceed:

- Fresh Cursor chat → `/bmad-create-story` for **75-5**
- Source spec: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` Epic 75 §Story 75-5
- Story summary: trigger run-chain via Hermes skill on a test brief, capture evidence artifact, confirm synthesis/hook/weapons output lands in vault, mark chain un-dormant

**After 75-5 is done**, Epic 75 closes and Epic 77 (JARVIS awareness in Nexus) is the next track.

---

## 6. Working tree — uncommitted files to handle

Two files have been sitting unstaged across multiple stories. Handle them explicitly:

| File | What it is | Action |
|------|------------|--------|
| `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` | Session-close §7 row for run-chain module (deferred from 75-2) | Run `/session-close` in `#hermes` to pick up the AGENTS §7 row, then commit |
| `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md` | 76-3 scope (103-item inbox triage plan) | Commit as standalone 76-3 story close, or fold into a 76-3 cleanup commit |

Neither blocks 75-5. But both should be landed before creating the session handoff for Epic 77.

---

## 7. Deferred / backlog items

| Item | Priority | Notes |
|------|----------|-------|
| **75-5** E2E run-chain revival | **HIGH — next** | Operator-gated on live Anthropic key |
| **73-8** Entity intelligence health gate | low | No story file; create when ready for live-prod verification |
| **74-4** Tool Gateway web search | low | FR-GATE confirmed; configure when Portal paid tier needed |
| **76-4** Governance stubs (mobile-posture, personas) | low | Orientation polish |
| **76-5** Two-bot vault boundary documentation | low | |
| **76-6** Memory pillars and Honcho verification | low | |
| **Session-close model → Haiku** | ops (post-75-5) | Too risky mid-sprint; revisit after E2E revival proven |
| **Sprint-status.yaml cleanup** | low | 75-2/75-3/75-4 show `review` but are `done` |
| **Inbox triage execution** | operator | 103 items categorized; run `/triage` family via Hermes when ready |
| **OpenRouter account drain / Firecrawl cancel** | ops | Phase 5 post-74-4; do not cancel yet |

---

## 8. Key artifacts this session produced

| Artifact | Path |
|----------|------|
| Validate script | `scripts/validate-anthropic-key.ts` |
| Validate tests | `tests/hermes/validate-anthropic-key.test.ts` |
| Run-chain governance module | `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md` |
| Run-chain project stub | `Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md` |
| Run-chain skill mirror | `scripts/hermes-skill-examples/run-chain/` |
| Install script | `scripts/install-hermes-skill-run-chain.sh` |
| Skill contract tests | `tests/hermes-run-chain-skill.test.mjs` |
| Vitest domain bootstrap | `tests/hermes/run-chain.test.ts` (placeholder) |

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
- Validate script: `scripts/validate-anthropic-key.ts`
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
