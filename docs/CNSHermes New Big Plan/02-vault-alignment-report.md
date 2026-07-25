# Vault Alignment Report
_As of 2026-06-23 | Sourced from vault alignment audit_

---

## Summary verdict

**Structurally sound, operationally drifting.**
The PAKE schema, vault map contract, and MCP tooling are all correct.
The orientation layer — MEMORY, Daily Rhythm, fast-scan index — has drifted
significantly since mid-June. Hermes cold-starts with stale context on
every session until these are fixed.

---

## The Two-MEMORY Problem

Two separate MEMORY files exist and both are wrong.

### File 1: `~/.hermes/memories/MEMORY.md` (Hermes cold-start)

```
Closed: 2026-06-21T21:49:12.729Z | AGENTS v2.1.43 | failure_class: none
Epics: 72, 73 in-progress | Tests: 642 passing
Vault: 0/0 clean — STALE REPORT (>7d)
Last Session Decisions: Story 53.3 done, 53.1 done, 52.2 done
Next Session: Review and close Story 53.3
```

**Problems:**
- Tests: 642 → reality 1317 pass / 7 fail
- Last decisions: Story 53.x (2 epic cycles ago)
- Next session: Story 53.3 (done long ago)
- failure_class: none (should be: tests)

### File 2: `vault AI-Context/MEMORY.md` (vault copy)

```
## CNS State (auto — /session-close)
Phase 6 complete. Epics 1–37 done. Epics 38 + 43 in progress. Epic 72 in-progress.

## Last Session Decisions
- Tracker: closed epics 54/55/56/60/61/64/65 (all stories done)
- Story 67-2: Reddit public-JSON adapter — done
- Epic 71: Digest job-state and watchdog truth — complete

## Environment
- Gateway: WSL @reboot cron runs scripts/hermes-gateway-start.sh
- SOUL.md: remove after every hermes version/gateway start
- Vault: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/

## Next Session
Scope next epic from the vault's deferred-work.md and operator briefs.
```

**Problems:**
- "Epics 38 + 43 in progress" → both done (2 cycles stale)
- Last decisions reference epic 67-2 and 71 — not current
- No provider/model state recorded
- No timestamp

### Which wins per dimension

| Dimension | Hermes MEMORY | Vault MEMORY | More current |
|-----------|--------------|--------------|-------------|
| Epic numbers | 72+73 ✅ | 38+43 ❌ | Hermes |
| Test count | 642 ❌ | absent | Neither |
| Decision log | 53.x ❌ | Epics 54–71 ✅ | Vault |
| Next session | Story 53.3 ❌ | Generic ✅ | Vault (barely) |
| Provider | absent | absent | — |
| Timestamp | 2026-06-21 ✅ | None | Hermes |

**Verdict: neither is usable as-is. Both need `/session-close` regeneration.**
See `07-merged-accurate-memory.md` for what the correct content should be.

---

## CNS-Daily-Rhythm.md AUTO Blocks

11 of 12 AUTO blocks are stale or wrong.

| Block | Current value | Correct value | Stale? |
|-------|--------------|--------------|--------|
| `AUTO:PROVIDER` | `openrouter / openai/gpt-4o` | `openai-codex / gpt-5.4-mini` (moving to: `nous / anthropic/claude-sonnet-4.6`) | **YES** |
| `AUTO:VAULT_NOTES` | `0` | 632 total `.md` | **YES** |
| `AUTO:VAULT_HEALTH` | `0/0 clean — STALE REPORT (>7d)` | 117/120 clean, 0 errors, 3 warnings (lint 2026-06-02) | Partially accurate |
| `AUTO:SPRINT` | Truncated: `72-1…72-5 done; 73-1…73-3 don…` | 72-1–72-8 done; 73-1–73-6 done, 73-7 in-progress | **YES** |
| `AUTO:AGENTS_VERSION` | `v2.1.42` | `v2.1.43` | **YES** |
| `AUTO:SKILLS_COUNT` | `94 available` | 106 `SKILL.md` files | **YES** |
| `AUTO:TESTS` | `642 passing` | 1317 pass / 7 fail | **YES** |
| `AUTO:LAST_SESSION` | `2026-06-21` | Accurate as last close date | OK |
| `AUTO:ACTIVE_PROJECTS` | Epic 72/73, LinkedIn ready | 73-7 should be in-progress not "review" | Partially stale |
| `AUTO:DEFERRED_SUMMARY` | P1 Composio, P2 rhythm auto-update | Repo `deferred-work.md` has 73-7 test failures, provider research | **YES** |
| `AUTO:ROADMAP` | Epics 1–73 table | Mostly OK | Mostly OK |

**Static body misalignment (not AUTO blocks — need manual edit):**
- "Web App Vision (Epic 42): Planned, Next.js + Vercel" → Epic 42 is DONE, SvelteKit + Convex, live at `cns-dashboard-three.vercel.app`
- "115+ notes" → 632 notes
- "609+ tests" → 1317 tests

---

## vault-fast-scan-index.md

- Last regenerated: session-close 2026-06-21
- Most recent entry: `03-Resources/CNS-Operator-Guide.md | 2026-06-21`
- **Missing:** all Epics 67–73 implementation content, Entity Intelligence, Epic 70 digest refactor, HANDOFF docs (live in repo not vault)
- **Stale relative to vault:** no notes modified after AGENTS.md (2026-06-22) appear

---

## AGENTS.md §8 Stale References

| Location | Says | Reality |
|----------|------|---------|
| §8 Epic 72 | "no stories tracked yet" | 72-1 through 72-8 all **done** |
| §8 Story 73-7 | "in review" | **`in-progress`** |
| §8 Priority 2 | "Define and start Epic 72 stories" | Epic 72 complete |
| §7 / §5 | References `mobile-posture.md` | File **missing** from vault |
| Vault map | `personas/` directory | **Does not exist** |
| Anywhere | Hermes provider/model | **Not stated anywhere** in constitution |

---

## What the Vault Knows vs What Happened (Last 2 Months)

| Work stream | In vault? | Where |
|-------------|-----------|-------|
| Entity Intelligence (Epic 73) | Minimal | AGENTS §8 only; no architecture/decision notes |
| Nexus / cns-dashboard | Scattered | Inbox B-MAD note, stitch analysis mention; no project folder |
| Epic 70 morning digest refactor | **No** | Repo HANDOFF only; Operator Guide §15.2 still pre-Epic-70 |
| Epic 72 source adapters | **No** | Sprint tracker/repo only |
| Hermes v0.17 + provider switch | **No** | Config only in `~/.hermes/` |
| Operator Landing Page | Yes | Full Jun 2026 project folder |
| Mission Control eval | Yes | Jun 2026 area + resource notes |

**Vault is a poor record of implementation work since ~June 12.**
Captures business/operator research better than engineering state.

---

## Inbox Backlog

| Metric | Value |
|--------|-------|
| Total items | **103** |
| Oldest | March 2026 |
| Newest | June 5–6, 2026 |
| Last triage | Early June |
| Types | Morning digests, URL captures, brainstorming, handoffs, clippings, personal/financial |
| Misplaced | DailyNotes subfolder inside inbox (should be in `DailyNotes/`) |

**Recommendation:** Morning digests → archive or move to DailyNotes/; triage clippings; graduate or archive Apr handoffs

---

## AI-Context Governance Files

| File | Status |
|------|--------|
| `AGENTS.md` | Present, v2.1.43 — §8 stale (see above) |
| `CNS-Daily-Rhythm.md` | Present — 11/12 AUTO blocks stale |
| `MEMORY.md` | Present — 2 epic cycles stale |
| `USER.md` | Present |
| `Codex-Global-AGENTS.md` | Present |
| `vault-fast-scan-index.md` | Present — missing Epics 67–73 content |
| `agent-log.md.md` | Present but **empty placeholder** |
| `modules/vault-io.md` | Present |
| `modules/security.md` | Present |
| `modules/notebooklm-workflow.md` | Present |
| `modules/routing.md` | Present (IDE routing only — does not cover Hermes Portal) |
| `modules/note-style-guide.md` | Present |
| `modules/mobile-posture.md` | **MISSING** — referenced in §5, §7, §9 |
| `personas/` directory | **MISSING** — listed in vault map |

**No Hermes-Desktop module** — research is in a project note only.
**No run-chain module** — the chain has no governance document in the vault.

---

## Research Output in 03-Resources/

| Type | Count | Last activity |
|------|-------|--------------|
| SynthesisNotes | 20 | Mostly Apr–May 2026 |
| Hook notes | **0** | Last: 2026-04-21 |
| Weapons-check notes | **0** | Same — chain broken since |
| Research sweeps | Last 2026-06-19 (Apify, 2 notes) | |

Run-chain is producing sweeps but not durable synthesis/hook/weapons artifacts.
The 401 is the cause — chain fires the research stage but fails at Synthesis.

---

## G — Priority Documents to Fix (Ordered by Impact)

1. **`AI-Context/MEMORY.md`** — Actively states "Epics 38+43 in progress." Loaded by session-close and agents. Highest corruption risk for agent context.

2. **`AI-Context/CNS-Daily-Rhythm.md` AUTO blocks** — Wrong provider, wrong test count, wrong AGENTS version, zero vault notes, truncated sprint. First thing the rhythm doc surfaces.

3. **`~/.hermes/memories/MEMORY.md`** — Hermes runtime cold-start file with Story 53.3 next-step and 642-passing fiction. Corrupts every Hermes session start.

4. **`AGENTS.md §8`** — Constitution-level but partially corrected by session-close. Lower priority than MEMORY because session-close fixes it.

5. **`CNS-Daily-Rhythm.md` static body** — "Web App: Planned, Next.js + Vercel" is hardcoded wrong. Not an AUTO block — needs manual edit to `daily-rhythm-static-rows.md` in repo.
