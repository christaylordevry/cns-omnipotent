# HANDOFF — 2026-06-12 — Epics 68, 69, 70 Closed

**Session end:** ~10:35 AM AEST 2026-06-12
**Last commit:** chore: close Epic 66 — 66-2 cancelled, superseded by 69-5
**Note:** `/session-close` ran but did NOT generate this file — vault export
sync step failed (see Open Issues). This handoff was written manually.

---

## TL;DR for next session

Today closed **four epics** (66, 68, 69, 70) and fixed a **production-blocking
bug** in the morning digest pipeline. The 07:00 AEST cron now runs fully
deterministically — Node orchestrator, no Hermes agent, no compression,
Discord delivery confirmed live at 07:02 AEST with 71 scored signals across
all 10 sources.

Two small PATH-class issues remain (non-blocking, see Open Issues).

---

## EPIC 70 — Deterministic Morning Digest Orchestrator (DONE)

The core structural fix of the last several sessions. The LLM agent was
previously orchestrator + memory + parser + deduper + writer across 12
sources — compression fired mid-run, destroyed task structure, agent
fabricated content (hallucinated paths, wrong adapters).

### Story 70-1 — Wire Node orchestrator as cron entrypoint
`scripts/run-morning-digest-cron.sh` now calls
`node scripts/run-digest-convex-completion.mjs` directly instead of
`hermes cron run`. Gateway check is warning-only (was fatal exit).
Commit `f5aac17`.

### Story 70-2 — Discord post step
New `post-digest-discord.mjs` — raw Discord REST v10, posts to `#hermes`
(channel `1500733488897462382`) after successful Convex push. Non-fatal,
chunked on word boundaries, max 2000 chars/message. Commit `f9477d1`.

### Story 70-3 + stabilization — errors_by_source, date skew, signal quality
- `formatSydneyDate()` shared helper — all date strings now use
  `Australia/Sydney` consistently across orchestrator/watchdog
- `collectAdapterOutputs()` returns `{ success, data|error }` per source;
  `errors_by_source` attached to `payload.run`, surfaced in `sourceOutcomes`
- Bluesky: `deriveBlueskyTitle()` fixes garbage titles (was showing
  "Full text:" etc.) — first meaningful line, 80-char word boundary,
  `@handle` fallback
- X/Twitter: `unescapeHtmlEntities()` — `&amp;` → `&` etc.
- Convex `digestRunInputValidator` extended to accept optional
  `errors_by_source: v.record(v.string(), v.string())`
Commits `a8d209a` + follow-up.

### Pre-Epic-70 fix — gateway check pipefail bug
`hermes gateway status` started exiting non-zero (outdated unit warning) in
Hermes v0.15.1. With `set -o pipefail`, this poisoned the grep check even
when the gateway WAS running — `run-morning-digest-cron.sh` aborted every
time with "Hermes gateway is not running". Fixed by capturing output with
`|| true` before grepping. Commit `b1ef54f`.

**LIVE VERIFICATION:** 07:00 AEST cron fired at 07:02, posted two Discord
messages, 71 signals across 10 sources (Headlines, arXiv, HackerNews,
GitHub, RSS/Newsletters, Product Hunt, X/Twitter, Bluesky). Zero
"Compacting context" events. Zero Hermes agent sessions.

---

## EPIC 68 — Live Digest Validation (DONE)

### Story 68-8 — closed today
`node scripts/validate-epic-68-digest.mjs --latest --json --people-done`
→ `overall: pass`. All C1-C10 automated checks pass. C7/C11 are manual
operator items (documented, non-blocking).

### Critical hotfix found during 68-8 validation: People bonus scoring
**Root cause:** `~/.hermes/nexus-people.yaml` has unquoted inline arrays
(`tags: [ai, education]`, `twitter: [emollick]`). The line-safe YAML parser
in `score-digest-signals.mjs` only accepted QUOTED inline arrays — so
`malformed: true` was set and **the entire watchlist returned zero people**.
Every handle (emollick, ylecun, etc.) scored `personalRelevance: 0`, no +20
bonus, silently, for an unknown number of prior runs.

**Fix:** Parser now handles quoted + unquoted flow arrays, and salvages
valid people entries instead of zeroing the whole file on partial
malformation. `emollick` now scores `personalRelevance: 37` (20 handle
bonus + base tier). Also added `buildDigestPipelineChildEnv()` —
`resolveOperatorHome()` resolves HOME before forking score/dedupe children
(Hermes profile isolation).

**This was a silent bug for an unknown duration — check if any people-based
alerts/decisions were made based on zero personalRelevance scores.**

---

## EPIC 69 — Nexus Intelligence UI (DONE — all 5 stories)

| Story | What |
|-------|------|
| 69-1 | Inspector dedup merge provenance — shows merged-cluster contributors/engagement in inspector drawer below Signal Intelligence. Code review patch applied: Svelte `{#each}` key collision fix (contributors now keyed by `url` not `badge+title`) |
| 69-2 | People match indicator — done (no work this session) |
| 69-3 | Source Health Panel — `/nexus` shows 12-source status grid (fired/unavailable/error/unknown). Code review patches: brief-query error handling, disclaimer logic (now only shows when ALL rows inferred — option C), keyboard-accessible mobile scroll, parser fixes for h2 headers / contributingSources / mergeSourceOutcomeRows preserving error states over markdown |
| 69-4 | Digest signal feed disposition hierarchy — gate story, done prior session |
| 69-5 | Investigation Workspace (`/nexus/investigate`) — full kanban board, Convex `investigationBoardItems` schema, "Add to investigation" entry points from feed + inspector. Was ALREADY implemented/done from a prior session — just verified + closed in tracker today |

All cns-dashboard verify gates passed (515 tests).

---

## EPIC 66 — Closed via cleanup
66-2 (agent orchestration workspace Screen 10) marked `cancelled` —
superseded by 69-5. All other children already done. `epic-66: done`.

---

## SPRINT STATUS — current state

```
epic-66: done
epic-68: done
epic-69: done
epic-70: done
epic-67: in-progress (67-2, 67-6 still backlog — see below)
```

Reconciled drift: 67-11, 68-11 marked done (were stuck in `review` despite
being live in production for days).

---

## OPEN ISSUES / DEFERRED

### 1. Vault export sync — PATH issue (low priority)
`/session-close` reported: "Vault Export Sync: Attempted to run export and
sync scripts, but they were not found." Scripts DO exist at
`scripts/session-close/hermes-run-write-vault-export-to-drive.sh` and
`hermes-run-sync-vault-export-drive.sh`. This is almost certainly the SAME
class of bug as the gateway/watchdog PATH issues fixed today (Hermes
v0.15.1 changed something about how subprocess PATH/cwd resolves). NotebookLM
fanout fell back gracefully to `drive-sync` mode, so this is non-blocking —
but worth a quick-dev pass next session: check whether
`hermes-run-session-close.sh` invokes these by bare name vs full path, and
whether the NVM PATH bootstrap pattern from 67-11/Story-3 needs to be applied
here too.

### 2. `/session-close` did not write a handoff doc
This handoff was written manually. Worth checking why — possibly related to
issue #1 (the vault export step failing may have short-circuited doc
generation).

### 3. Story file internal status drift (cosmetic)
`69-1-inspector-dedup-merge-provenance.md` and
`69-5-investigation-workspace-screen-10.md` story files still say `review`
and `ready-for-dev` internally even though sprint-status.yaml says `done`.
sprint-status.yaml is SSOT per project convention — low priority to sync the
file headers.

### 4. WSL2 keep-alive task installed
Windows Task Scheduler entry `WSL2KeepAlive` created — runs
`wsl.exe -d Ubuntu -e sleep infinity` on logon. Should keep systemd/Hermes
gateway alive for future 07:00 cron runs without manual intervention.

---

## EPIC 67 — remaining backlog (not touched this session)
- `67-2-reddit-oauth-retry-live-wiring` — backlog, requires operator Reddit
  OAuth app registration (manual credential setup, not a code task)
- `67-6-compare-smoke-test-documentation` — backlog, needs ≥2 live cron runs
  to compare (we now HAVE multiple runs from today — 06:46, 07:02, plus
  force-rescores — this might be unblocked now)

Neither has a story file yet — would need `bmad-create-story` first.

---

## RECOMMENDED FIRST ACTIONS NEXT SESSION

1. Quick-dev pass on vault-export-sync PATH issue (Open Issue #1) —
   likely same NVM bootstrap fix pattern as 67-11/68-11/watchdog
2. Investigate why `/session-close` didn't generate a handoff doc
3. Consider 67-6 (compare smoke test docs) — now unblocked with today's
   live run data
4. Epic 69/70 retrospectives are "optional" — consider running if there's
   appetite, otherwise low priority

---

*Generated manually 2026-06-12 ~10:35 AM AEST — /session-close ran but did
not produce a handoff file (vault export sync step failed).*
