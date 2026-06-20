# HANDOFF — 2026-06-20 — Epic 72 Story 72-3

**Session end:** 2026-06-20  
**Last commit:** `296b286` — feat(scrapecreators): TikTok + Instagram adapters, Sources 14–15 (72-3)

---

## TL;DR for next session

Epic **72-3** shipped TikTok (Source 14) and Instagram (Source 15) via ScrapeCreators — full registry/orchestrator/skill parity, `verify.sh` green. Epic 72 remains **in-progress** (72-4 live validation; **72-5 Pinterest** / **72-6 Polymarket** not scoped).

One **parked architecture decision**: LLM Provider Consolidation (research compiled; no changes). **Do not mint a fresh Anthropic key for run-chain 401** until mindmap §4 verification completes.

**Digest catch-up mechanism — decided not to build** (see § Decided #4). Manual recovery remains the answer for a missed window.

---

## Operational gap (kickoff context — item #1)

No digest catch-up mechanism for a missed 07:00 window. The morning digest only has **four fixed-time chances** to run (07:00 primary cron, 07:15 / 13:00 / 18:30 watchdogs) — fixed crontab times, not continuous retries. If the laptop is off through all four, nothing runs until tomorrow. Bit us this morning; manual trigger used to recover.

**Manual recovery (one line, from repo root with gateway/env up):**

```bash
DIGEST_TRIGGER=manual node scripts/run-digest-convex-completion.mjs
```

(Sources `.env.live-chain` vars as needed; Discord post step requires `HERMES_DISCORD_TOKEN` in env. Alternative: post `morning-digest` in `#hermes`.)

---

## EPIC 72 — Source Expansion (in-progress)

| Story | Status | Notes |
|-------|--------|-------|
| 72-1 YouTube Data API | done | Source 13 |
| 72-2 YouTube outcome investigation | done | Pre-deploy cron root cause; parity test guard |
| 72-3 TikTok + Instagram ScrapeCreators | done | Sources 14–15; commit `296b286` |
| 72-4 | not scoped | Live ScrapeCreators validation deferred from 72-3 code review |

Morning digest now has **15 sources** when all adapters are wired. Next live cron should show `tiktok` and `instagram` keys in `~/.hermes/digest-outcomes/YYYY-MM-DD.json` after deploy.

---

## Parked decisions (numbered — do not action without explicit scope)

These survive between sessions the same way handoff docs do. Full detail in `deferred-work.md` where noted.

### 1. LLM Provider Consolidation

**Research started, not scoped.** See [`docs/llm-provider-mindmap.md`](llm-provider-mindmap.md).

Six verification checks identified (mindmap §4); **no changes made**. Do **not** fix the run-chain 401 with a fresh Anthropic key until this is resolved — there is likely a better answer already half-built in Epic 38 (`callOpenRouterSynthesis()` from Story 38-2).

Also tracked: `_bmad-output/implementation-artifacts/deferred-work.md` (top-level + Phase 2 backlog).

### 2. Digest source registry SSOT

Cross-repo single-source-of-truth for `DIGEST_SOURCE_SECTION_MAP`, `DIGEST_SOURCE_HEALTH_REGISTRY`, Convex literals, and badge maps — deferred from 72-2 code review. Structural parity test (`tests/digest-source-registry-parity.test.mjs`) guards drift for Sources 1–15 but does not eliminate manual touch count.

See `deferred-work.md` → "Cross-repo digest source registry single-source-of-truth".

### 3. Source roadmap follow-ons — Pinterest (72-5) / Polymarket (72-6)

TikTok and Instagram moved from "out of scope" (sprint-change-proposal 2026-06-08) to shipped (72-3). **Pinterest** (72-5) and **Polymarket** (72-6) remain follow-on backlog per Epic 65 PRD source roadmap — no story files, no operator brief. Park until scoped.

---

## Decided (numbered — closed, do not reopen without new evidence)

### 4. Digest catch-up mechanism — decided: not building

Accepted as a known limitation. Manual recovery command (see **Operational gap** section above) remains the answer for a missed window. Revisit if laptop-off mornings become frequent enough that this is costing more than the fix would.

---

## RECOMMENDED FIRST ACTIONS NEXT SESSION

1. **If run-chain is needed:** Run mindmap §4 verification checks (read-only) before any Anthropic key spend — start with `~/.hermes/config.yaml` and `38-2-kimi-k2-6-evaluation-run-chain` story file
2. **If digest validation is priority:** Scope 72-4 live ScrapeCreators smoke with real `SCRAPECREATORS_API_KEY`; confirm Sources 14–15 in next 07:00 AEST outcome record
3. **If Epic 72 close is priority:** Code-review 72-3 if not yet reviewed; then decide whether 72-4 closes the epic or 72-5/72-6 land first

---

## Session close-out

Everything from today's session is captured except **Pinterest (72-5)** and **Polymarket (72-6)** — still on source roadmap, not scoped.

---

*Generated 2026-06-20 — post Epic 72-3 session.*
