# HANDOFF — Hermes Consolidation Session 6 (2026-06-25)

**For:** a fresh Claude Code session (Sonnet 4.6) continuing this initiative.
**Role:** strategic checker/verifier alongside the operator (Chris), who runs BMAD workflows in **Cursor**. Verify Cursor's outputs against the locked plan, check diffs against the protect-list, and advise next steps. You do NOT run the BMAD story workflows yourself.

---

## 1. What this is

Make **Hermes the single always-on intelligence layer ("JARVIS")** on **one provider (Nous Portal)**, integrated with the Nexus/CNS dashboard. Full plan:

- **PRD:** `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- **Architecture (8 ADRs):** `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- **Epics/stories (29 across Epics 74–78):** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- **Prior handoffs:** `HANDOFF-2026-06-24-hermes-consolidation.md` through `HANDOFF-2026-06-25-session5-hermes-consolidation.md`

---

## 2. Where we are RIGHT NOW (end of session 6)

Branch: **`hermes-consolidation`** (Omnipotent.md). HEAD: **`34e224a`**
cns-dashboard: **`master`**. HEAD: **`1118ee4`** (pushed + deployed to Vercel + Convex production)

### Session 6 completions

| Story / Item | Commit | Key outcome |
|---|---|---|
| Config: `run-chain` + `awareness-sync` binding | `~/.hermes/config.yaml` | Both skills bound to `#hermes`; terminal.timeout 300s |
| Session-close model | already Haiku | `auxiliary.compression.model: anthropic/claude-haiku-4.5` — no change needed |
| 77-1 Convex HermesAwarenessSnapshot HTTP endpoint | cns-dashboard `6299704` | GET /hermes/awareness live, bearer auth, 587 tests |
| 77-2 Hermes awareness pull client + cron | Omnipotent.md `7b0077a` | 3-min cron running, cache at ~/.hermes/memories/awareness-snapshot.json |
| 77-4 awareness-sync Hermes skill | Omnipotent.md `34e224a` | Live in Discord — smoke tested, cockpit digest confirmed |
| 77-5 Nexus awareness panels UI | cns-dashboard `1118ee4` | JARVIS awareness strip live on /nexus in production |
| Ops: awareness-pull cron installed | `~/.hermes/awareness-pull.env` + crontab | Pulling every 3 min |
| Deferred work logged | `deferred-work.md` | Ops health items + CI esbuild issue |
| Session-close | Hermes #hermes | agents_sync ✓, export ✓, notebooklm 3 ok, daily_rhythm ✓ |

### Epic status (end of session 6)

| Epic | Status | Notes |
|------|--------|-------|
| 72 | done | |
| 73 | in-progress | 7/8 done; 73-8 health gate deferred |
| 74 | done | |
| 75 | done | Run-chain revived |
| 76 | in-progress | 3/6 done |
| **77** | **MVP done** | 77-1/2/4/5 done; 77-3 ready-for-dev; 77-6 stretch; 77-7 backlog |
| 78 | backlog | Voice + per-skill routing |

---

## 3. Locked decisions — DO NOT re-litigate

All from prior sessions, still valid:
- **Topology (a) [ADR-HERMES-001]:** JARVIS on Hermes Desktop/Discord; `/nexus` = data-awareness + async ask box only
- **FR11 = Option A:** keep one `ANTHROPIC_API_KEY` for run-chain; zero engine edits
- **FR12 mechanism:** Convex HTTP pull (GET /hermes/awareness) + local cache + Nexus reactive useQuery
- **Dashboard auth = Nous OAuth** primary; basic-auth fallback trusted localhost only
- **Dashboard redesign = DEFERRED** (post-Epic 77)
- **Session-close model = Haiku** (already active)

---

## 4. PROTECT-LIST — verify every diff

```
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
scripts/run-chain.ts
scripts/hermes-awareness-pull.ts  ← 77-2 complete; consume only
../cns-dashboard/convex/http.ts   ← 77-1 complete; extend only
```

Also untouched: NEXUS bridge, morning-digest cron scripts, Brain index, Vault IO MCP.

---

## 5. NEXT: Epic 77 remaining + Epic 78

### Epic 77 remaining

| Story | Status | Repo | Notes |
|-------|--------|------|-------|
| 77-3 | ready-for-dev | cns-dashboard | Convex webhook push for high-signal events; independent of 77-5 |
| 77-6 | backlog | cns-dashboard | Async ask-Hermes box — stretch FR13; not MVP gate |
| 77-7 | backlog | cns-dashboard | dashboard-sync retention decision; needs 77-2 validated ≥24h |

**77-3** is the recommended next story — it's independent, cns-dashboard only, and completes the FR12 push path (proactive Discord alerts on P0/P1 events).

### After Epic 77: Epic 78
Voice (push-to-talk + TTS) and per-skill model routing. FR-GATE required for TTS.

---

## 6. Operator actions still open

| Action | Notes |
|--------|-------|
| **Smoke /nexus** live in production | JARVIS awareness strip confirmed in screenshot — done |
| **Run-chain manual trigger** | Chain dormant 25 days; trigger when ready |
| **Inbox triage execution** | 103 items categorized; run `/triage` family via Hermes |
| **MCP health check** | context7/discord/firecrawl/playwright UNKNOWN; vault-io stale |
| **Investigation board** | 8 items, all in triage; review when ops window allows |
| **77-7 retention decision** | Wait ≥24h of awareness-pull cron running, then decide on dashboard-sync |

---

## 7. Key ops facts learned this session (IMPORTANT for next session)

- **cns-dashboard Cursor launcher** — must open via UNC path every session:
  ```powershell
  & "C:\Users\Christopher Taylor\AppData\Local\Programs\cursor\Cursor.exe" "\\wsl$\Ubuntu-24.04\home\christ\ai-factory\projects\cns-dashboard"
  ```
- **Hermes config at** `/home/christ/.hermes/config.yaml` — access via WSL, not PowerShell
- **cns-dashboard tests** require NVM: `source ~/.nvm/nvm.sh && node_modules/.bin/vitest run`
- **HERMES_CONVEX_READ_KEY** — in Convex prod env + `~/.hermes/awareness-pull.env` (not in memory)
- **HTTP Actions URL** — `https://amiable-ox-862.convex.site` (not `.convex.cloud`)
- **CI esbuild failure** — `@esbuild/aix-ppc64` platform mismatch in package-lock.json; Vercel builds fine; deferred

---

## 8. Deferred / backlog items

| Item | Priority | Notes |
|------|----------|-------|
| **77-3** Convex webhook push | next | cns-dashboard; P0/P1 event → Discord |
| **77-6** Async ask box | stretch | FR13; not MVP gate |
| **77-7** dashboard-sync retention | low | After ≥24h pull validation |
| **CI esbuild fix** | low | package-lock.json cleanup |
| **73-8** Entity health gate | low | No story file yet |
| **74-4** Tool Gateway web search | low | FR-GATE required |
| **76-4/5/6** Governance stubs | low | |
| **Run-chain dormant** | ops | Trigger manual chain run |
| **Inbox triage 103 items** | operator | Run /triage family |
| **MCP health** | ops | Resolve UNKNOWN/stale statuses |
| **Dashboard RUN_CHAIN_STORY_KEY** | low | Still points at Epic 38 |

---

## 9. Working style

- Verify Cursor's claims independently (read actual diffs — don't rubber-stamp)
- Give clear recommendation + paste-ready terminal commands (always lead with repo + branch)
- Commit hygiene: explicit paths, logical commits, co-author trailer
- Sprint-status.yaml and story files must both reflect true status
- Be concise and decisive

## 10. Key file locations

- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`
- Epics: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- Awareness cache: `~/.hermes/memories/awareness-snapshot.json`
- Awareness pull env: `~/.hermes/awareness-pull.env`
- Hermes config: `/home/christ/.hermes/config.yaml`
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
