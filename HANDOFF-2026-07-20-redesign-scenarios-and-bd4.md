# HANDOFF 2026-07-20 — CNS Redesign Phase 3 + BD-4 + Convex outage

**Read `memory: project_cns_redesign_open_design` first (⭐), then this.**
Supersedes `HANDOFF-2026-07-19-cns-redesign-and-open-design.md`. Everything below is done
and pushed — pick up at **WDS Phase 4 design**, with **two verification chores** first.

---

## TL;DR
- **WDS Phase 3 COMPLETE** — all 4 UX scenarios outlined AND codebase-grounded. Next = **Phase 4 design** (`wds-4-ux-design`).
- **BD-4 shipped** (signal→topic link, the Obj 2.3 blocker) — implemented, reviewed, committed, pushed. **Its IDF matcher has never run live** — verify on the next morning digest.
- **Convex was DOWN** (free-plan limit disabled deployments). Billing paid, service restored, `2026-07-20` digest backfilled. No data lost.
- Both repos **pushed clean**. Trees clean.

## Current state
| Repo | Branch | Head | State |
|---|---|---|---|
| `Omnipotent.md` | `hermes-consolidation` | `e96ba41` | pushed, clean |
| `cns-dashboard` | `cns-redesign` | `0754734` | pushed (new remote branch), clean |

---

## ⚠️ TWO VERIFICATION CHORES — do these first

### 1. Verify the IDF matcher on the next 07:00 digest (HIGH)
BD-4's matcher was rewritten during code review (IDF-weighted, `WATCHLIST_MATCH_MIN_CONFIDENCE = 50`, ambiguous-tie omission). It is unit-tested (171 pass) but **has never executed against real data** — the live run I verified used the *pre-fix* matcher.

**The before-picture (defective, from run `2026-07-20`):** 20/50 signals stamped, but `biotech-ai` (6) and `knowledge-management-software` (5) were garbage magnets — `langchain-ai/langchain` was tagged `biotech-ai`; a tweet about Linux was tagged `knowledge-management-software`.

**Check:** query the newest digest run's signals and confirm `langchain`-style signals no longer resolve to `biotech-ai`, and that stamps are semantically sane. Two-minute job:
```bash
# 1) newest run id
curl -s -X POST 'https://amiable-ox-862.convex.cloud/api/query' \
  -H 'Content-Type: application/json' \
  -d '{"path":"digest:getRecentDigestRuns","args":{},"format":"json"}'

# 2) signals for that run — arg is digestRunId (NOT runId); pass limit:100
#    (default limit ?? 50 truncates full morning runs, which are ~75 signals)
curl -s -X POST 'https://amiable-ox-862.convex.cloud/api/query' \
  -H 'Content-Type: application/json' \
  -d '{"path":"digest:getDigestSignalsForRun","args":{"digestRunId":"<newest _id>","limit":100},"format":"json"}'
```
Stamp-density grounding (usable content stamps vs trends self-matches) and **BD-5** live in
`cns-dashboard/_bmad-output/C-UX-Scenarios/03-eric-dig-and-deepen/grounding-verdict.md`.

### 2. Confirm the digest is still writing
The plan-limit outage silently killed a full day of pushes. Confirm today's run has `signalsWritten > 0` in `~/.hermes/logs/push-digest-watchdog.log` and that a run row exists in Convex for today's date.

---

## NEXT WORK — in order

1. **Silent-failure bug (small, high value).** `push-digest-watchdog` logged `action=completion-convex-push-failed … signalsWritten:0` with **`exit=0`**. That is why a full day of missing data went unnoticed. A push that writes zero signals when it had signals to write must exit non-zero and be visible. Story prompt is ready (see below).
2. **WDS Phase 4 design** — in Cursor on `cns-dashboard`, `wds-4-ux-design`, starting from scenario 01 step 1. **Read each scenario's `grounding-verdict.md` before designing.**
3. **Design system / OD `brand-extract`** — only after the IA design, never before.

---

## REDESIGN STATE (WDS)

**Phase 3 complete.** `cns-dashboard/_bmad-output/C-UX-Scenarios/`:
- `01-eric-morning-orient` — signals/now: Status Band → Ranked List → Inspector → Disposition
- `02-eric-entity-narrative` — entities/lift: Field Scan → Entity Row → Selected-Entity Arc → Carry Forward
- `03-eric-dig-and-deepen` — topic/trajectory, **owns Obj 2.3**: Dig Board → Trends Crossing → Time-Depth → Verdict
- `04-dana-demo-glance` — perceptual lens, **zero pages** (delivers nothing; all fixes land in 01/02)

Coverage 7/7. **Each has a `grounding-verdict.md`** — these are the highest-value artifacts in the whole redesign; they record what was verified against real code.

### Build-dependency register (in 03's grounding-verdict)
- **BD-1 CLOSED** — Dig = `addToInvestigationBoard`, Watch = `addWatchlistKeyword`, Dismiss = **ephemeral client-side only** (`digestSignals` are per-run scoped, so noise cannot accumulate; no mutation needed).
- **BD-2 OPEN** — status-band run-over-run delta query (new derivation; joinable via `externalId`).
- **BD-3 RESOLVED** — entity Confidence computable from `sourceTypes` + `evidence` signalRefs + `mentionCount`.
- **BD-4 SHIPPED** — see above.
- **BD-5 OPEN** — usable content stamp density too low for high-IA Trends Crossing (03.2);
  demote IA weight in Phase 4. Details in S03 `grounding-verdict.md` (2026-07-21).

---

## KEY FINDINGS — do NOT re-derive

- **rankScore is fully transparent** (traced this session): `computeRankScore()` in `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs` = `round(0.3·personalRelevance + 0.2·relevance + 0.2·momentum + 0.15·urgency + 0.1·novelty + 0.05·normalizedEngagement)`. No LLM/API. Weights at `:152-159`. **The 5 component scores are ALREADY stored in Convex** (`scores{}`) and `NexusInspectorDrawer` already renders them → "make the score legible" is mostly PRESENTATION.
- **Entities have NO lifecycle.** The 5-stage lifecycle is a TOPIC/trend property (`trendScores.lifecycleStage`). Entity emergence = `activeCount` vs `baselineCount`. (This error propagated into scenario 02 and had to be reworked — don't repeat it.)
- **Confidence is a new, orthogonal axis** — do NOT re-blend rankScore's internals into a new Priority formula (double-counts). Spec: `A-Product-Brief/scoring-model-spec.md`.
- **The Kanban already exists**: `investigationBoardItems.column` = `triage|investigating|waiting|resolved`, with `moveBoardItem` (fires a Hermes push on promotion to `investigating`) and full board UI.
- **Baseline is NON-ADOPTION** — the operator has never used the system. Success = adoption + trust, not shaving minutes. `A-Product-Brief/baseline-capture.md`.
- **Charts are the biggest remaining build risk** — LayerChart (SVG) + ECharts (canvas) need **in-engine** re-theming; Tailwind `@theme` tokens will not touch them. Nothing has de-risked this yet.

---

## OPEN / UNRESOLVED

- **Vault `note-style-guide.md` was corrupted** and restored from the specs SSOT (verified byte-identical; all 12 modules match). **Root cause unknown.** Worth its own investigation.
- **Milanote per-case evidence canvas** — full target architecture logged in `deferred-work.md`. Deferred until real digs exist (canvas engine + `canvasLayouts` already built but global/topic-keyed; no connectors).
- **Convex is now a paid plan** — watch usage; the free-tier ceiling silently disabled all deployments.

---

## Artifact index
- Scenarios + grounding: `cns-dashboard/_bmad-output/C-UX-Scenarios/`
- Baseline / scoring spec: `cns-dashboard/_bmad-output/A-Product-Brief/`
- BD-4 story: `Omnipotent.md/_bmad-output/implementation-artifacts/BD-4-stamp-matched-watchlist-topic.md`
- rankScore investigation: `Omnipotent.md/_bmad-output/implementation-artifacts/investigations/rankscore-origin-investigation.md`
- Deferred work: `Omnipotent.md/_bmad-output/implementation-artifacts/deferred-work.md`
- Memory: `project_cns_redesign_open_design` (⭐)
