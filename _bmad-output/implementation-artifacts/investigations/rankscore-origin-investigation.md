# Investigation: Where `rankScore` (the 0–100 number on each Nexus digest post) is computed and first assigned

## Hand-off Brief

1. **What happened.** The digest-feed `rankScore` is **computed locally**, not relayed from any upstream source — it is produced deterministically in Node by `computeRankScore()` in `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs:1625` as a fixed-weight blend of five 0–100 dimension scores plus optional normalized engagement (Confirmed; formula reproduces a real `45` exactly).
2. **Where the case stands.** Concluded, High confidence. The scorer runs one stage before the Convex push, inside the same Hermes morning-digest run; `push-digest-convex.mjs` merely relays the already-scored value into `digest:addDigestSignal`, and cns-dashboard only reads it. No LLM, external API score, or n8n workflow contributes to the number.
3. **What's needed next.** None required — diagnosis complete. If you want to *change* what a `45` means, edit the seven `RANK_WEIGHT_*` constants (`score-digest-signals.mjs:152-159`) or the five dimension scorers; no fix is warranted by this investigation.

## Case Info

| Field            | Value                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Ticket           | N/A                                                                                    |
| Date opened      | 2026-07-19                                                                              |
| Status           | Concluded                                                                               |
| System           | WSL2 (Node), Hermes runtime at `~/.hermes`; repo `Omnipotent.md`; cns-dashboard (Convex/SvelteKit, read-only) |
| Evidence sources | Runtime skill scripts, repo skill sources, Hermes task-prompt, live `digest-push-*.json` artifacts, git-tracked stories |

## Problem Statement

Trace where `rankScore` (0–100, shown on each post in the Nexus digest feed; operator reacts at ~45+) is actually computed and first assigned. Established going in: cns-dashboard only reads/sorts it; the only in-repo references are tests that mock already-scored signals and push a `pushedPayload.signals[]` shape — so production code *appeared* to relay a pre-scored value. **The premise ("production relays a pre-scored value") is refuted by the evidence below: production computes it.**

## Evidence Inventory

| Source | Status | Notes |
| ------ | ------ | ----- |
| `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs` | Available | The scorer. Contains `computeRankScore` + five dimension scorers + weights. Stronghold. |
| `~/.hermes/skills/cns/morning-digest/scripts/push-digest-convex.mjs` | Available | The producer that writes rows to Convex; relays the already-computed `rankScore`. |
| `~/.hermes/skills/cns/morning-digest/references/task-prompt.md` | Available | Orchestration contract: adapters → dedupe → **score** → artifact → Discord → push. |
| `~/.hermes/digest-push-2026-07-19.json` (+ 2026-06-11 … daily) | Available | Live artifacts with real `rankScore` + `scores` — ground truth for reproduction. |
| Repo `scripts/hermes-skill-examples/morning-digest/scripts/*` | Available | Git-tracked source; byte-identical to runtime copies (no drift). |
| `scripts/session-close/lib/notebook-scorer.mjs` (`f1`, `tokenizeForScoring`) | Available | Pure token-overlap helpers used by relevance/personalRelevance — deterministic, no LLM. |
| n8n / external scoring API / manual scorer | Missing (ruled out) | No such path exists in the digest pipeline; every scoring input is local. |

## Timeline of Events (per digest run)

| Step | Event | Source | Confidence |
| ---- | ----- | ------ | ---------- |
| T0 | Source adapters (`hermes-run-*.sh` → `fetch-*.mjs`) return raw platform items (titles, engagement counts, `publishedAt`) | task-prompt.md §Sources 1–19 | Confirmed |
| T1 | Orchestrator maps adapter stdout into `digest_push_payload.signals[]` (no `rankScore` yet) | task-prompt.md §9 map | Confirmed |
| T2 | `dedupe-digest-signals.mjs` collapses duplicates | task-prompt.md Pre-Discord dedupe | Confirmed |
| T3 | **`score-digest-signals.mjs` computes `scores{}`, `normalizedEngagement`, `rankScore`, `disposition`, `rank`** | `score-digest-signals.mjs:1649` `scoreDigestSignals` | Confirmed |
| T4 | `write-digest-push-artifact.mjs` persists post-scoring payload to `~/.hermes/digest-push-<date>.json` | task-prompt.md §Persist artifact | Confirmed |
| T5 | Discord post to `#hermes` | task-prompt.md §Output contract | Confirmed |
| T6 | `push-digest-convex.mjs` relays scored signals to Convex `digest:addDigestSignal` | `push-digest-convex.mjs:494` | Confirmed |
| T7 | cns-dashboard reads/sorts `rankScore` (display only) | Established fact (out of scope) | Confirmed |

## Confirmed Findings

### Finding 1: `rankScore` is computed by `computeRankScore()` — a fixed-weight linear blend

**Evidence:** `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs:1625-1642` (and weights at `:152-159`).

**Detail:** The exact formula:

```
hasEngagement = normalizedEngagement is a finite number

rankScore = round(clamp(
    0.30 * personalRelevance
  + 0.20 * relevance
  + (hasEngagement ? 0.20 : 0.25) * momentum
  + 0.15 * urgency
  + 0.10 * novelty
  + (hasEngagement ? 0.05 * normalizedEngagement : 0),
  0, 100))
```

Weights are named constants: `RANK_WEIGHT_PERSONAL=0.3`, `RANK_WEIGHT_RELEVANCE=0.2`, `RANK_WEIGHT_MOMENTUM=0.2` (`…_NO_ENGAGEMENT=0.25`), `RANK_WEIGHT_URGENCY=0.15`, `RANK_WEIGHT_NOVELTY=0.1`, `RANK_WEIGHT_NORMALIZED_ENGAGEMENT=0.05`. When engagement is absent, its 0.05 weight is redistributed to momentum (0.20 → 0.25). This is invoked per-signal at `score-digest-signals.mjs:1663` inside `scoreDigestSignals`, which then sorts descending by `rankScore` and assigns integer `rank` (`:1689-1703`).

### Finding 2: The five dimension scores are deterministic heuristics (no LLM, no external score)

**Evidence:** `score-digest-signals.mjs` — `scoreRelevance:1288`, `scorePersonalRelevance:1416`, `scoreNovelty:1455`, `scoreUrgency:1541`, `scoreMomentum:1572`, `normalizeEngagement:184`.

**Detail:**
- **relevance** (`:1288`) — F1 token overlap (`f1Score` → `f1` from `notebook-scorer.mjs`) between signal title+summary tokens and `~/.hermes/trend-watchlist.yaml` domain keywords; returns flat `25` when watchlist missing.
- **personalRelevance** (`:1416`) — max of weighted-F1 against `~/.hermes/nexus-goals.yaml` and against the "personal" token set (in-progress sprint tokens from `_bmad-output/implementation-artifacts/sprint-status.yaml` + project entities + personal watchlist keywords), plus bonuses: `+15` epic-number match, `+20` people-handle match, `+10` people-name match (`~/.hermes/nexus-people.yaml`); clamped 0–100.
- **novelty** (`:1455`) — title/token overlap vs `DIGEST_NOVELTY_HISTORY_JSON` (prior digest titles): exact repeat `10`, ≥0.6 overlap `25`, ≥0.3 `45`, same source-type seen `65`, else `90`; `100` when no history.
- **urgency** (`:1541`) — `clamp(round(0.7·recency + 0.2·sourcePrior + breakingBonus))` where recency is bucketed by `publishedAt` age (`:1501`), `sourcePrior` is a per-platform constant (`SOURCE_PRIOR`, `:31`), and `breakingBonus` is `+20` if the title matches `/breaking|launch|released|announces|emergency|critical|cve-\d|outage|today/i`.
- **momentum** (`:1572`) — `clamp(round(0.75·normalizedEngagement + 0.25·trendProxy))`, or just `trendProxy` (per-platform `TREND_PROXY_PRIOR`, `:52`) when engagement is absent. `normalizedEngagement` (`:184`) is a log-scaled 0–100 map of raw platform counts (likes/stars/upvotes/views/points/volume) against per-source caps.

All inputs are files on disk, env vars threaded from adapter stdout, and constants in the file. No network call, no model, no external scoring service participates in producing the number.

### Finding 3: The formula reproduces a real `45` exactly

**Evidence:** `~/.hermes/digest-push-2026-07-19.json`, signal rank 3 — Polymarket "Will the next Claude Opus model be released by Jul…", `scores{relevance:0, personalRelevance:0, novelty:100, urgency:88, momentum:83}`, `normalizedEngagement:96`.

**Detail:** Engagement present, so:
`0.30·0 + 0.20·0 + 0.20·83 + 0.15·88 + 0.10·100 + 0.05·96 = 0 + 0 + 16.6 + 13.2 + 10 + 4.8 = 44.6 → round = 45`. Matches the stored `rankScore: 45` exactly. (`disposition: "watch"` per `deriveDisposition:1595`.) Reproduction confirms the scorer, not display, sets the value.

### Finding 4: `push-digest-convex.mjs` relays, it does not compute

**Evidence:** `push-digest-convex.mjs:490-506` (`addDigestSignal` loop), `:311` `postConvexMutation`, `ADD_PATH='digest:addDigestSignal'` (`:20`).

**Detail:** The pusher spreads each already-scored signal (`{ ...signal, digestRunId }`) into a raw Convex HTTP mutation. It never reads or derives `rankScore`. It authenticates with `CONVEX_DEPLOY_KEY` and POSTs to `<CONVEX_URL>/api/mutation`. This is the "ConvexHttpClient/mutation call that writes the rows" — the boundary where the locally-computed value leaves the Node process into Convex `digestSignals`.

### Finding 5: Runtime and repo copies are byte-identical; git-tracked source matches production

**Evidence:** `diff` of `~/.hermes/skills/cns/morning-digest/scripts/{score-digest-signals,push-digest-convex}.mjs` against `scripts/hermes-skill-examples/morning-digest/scripts/*` → both `IDENTICAL`.

**Detail:** The in-repo tests (`tests/morning-digest-score-*.test.mjs`, `analyze-entity-intelligence.test.mjs`) push pre-scored mock signals because they exercise stages *downstream* of the scorer; they simulate the scorer's output. Production is not test code — the real orchestrator runs `score-digest-signals.mjs` at T3. This resolves the apparent "relay only" impression from the repo grep.

## Deduced Conclusions

### Deduction 1: Origin of the number is a single pure function, one stage before push

**Based on:** Findings 1–5.

**Reasoning:** The value is written by `computeRankScore` (T3), persisted to the artifact (T4), then relayed unchanged through `push-digest-convex.mjs` (T6) into Convex and read by the dashboard (T7). Every scoring input is local (files/env/constants) and deterministic; the reproduction in Finding 3 closes the loop.

**Conclusion:** "When I see 45" the number was computed locally by the Hermes morning-digest scorer during that morning's run, from that signal's five dimension scores and its normalized engagement — nothing upstream (scraper field, LLM, n8n, source-platform score) assigns it.

## Hypothesized Paths

### Hypothesis 1: Production relays a pre-scored `rankScore` from an upstream producer

**Status:** Refuted

**Theory:** Since in-repo references were only tests pushing pre-scored signals, production might also relay a value scored elsewhere (external API / LLM / n8n / platform).

**Would confirm:** A scoring source outside `score-digest-signals.mjs` feeding `rankScore` into the payload.

**Would refute:** A local computation of `rankScore` inside the digest pipeline whose output matches live data.

**Resolution:** Refuted by Findings 1–3 — `computeRankScore` computes it locally and reproduces a live `45` to the integer. The "relay" seen in-repo is test scaffolding + the post-scoring `push-digest-convex.mjs` relay stage, not the origin.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| None material to the diagnosis | — | — |
| (Minor) Exact `nexus-goals.yaml` / `trend-watchlist.yaml` contents on a given day | Would let you re-derive relevance/personalRelevance for a specific past signal | Read `~/.hermes/nexus-goals.yaml`, `~/.hermes/trend-watchlist.yaml`, `~/.hermes/nexus-people.yaml` |

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Value origin | `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs:1625` `computeRankScore()` (weights `:152-159`); assigned at `:1663` in `scoreDigestSignals` |
| Trigger | Hermes morning-digest run (Discord `morning-digest` line or morning cron) executes `score-digest-signals.mjs` per `references/task-prompt.md` Pre-Discord "Score signals before push (Epic 64-5)" |
| Condition | Runs on the deduped `digest_push_payload.signals[]`; degraded mode passes signals through unscored only if the scoring terminal returns empty/invalid |
| Boundary crossing | Node scorer (T3) → local artifact JSON (T4) → `push-digest-convex.mjs` raw HTTP `digest:addDigestSignal` (T6, `:494`/`:311`) → Convex `digestSignals` → cns-dashboard read (T7) |
| Related files | `dedupe-digest-signals.mjs`, `write-digest-push-artifact.mjs`, `push-digest-convex.mjs`, `analyze-entity-intelligence.mjs`, `scripts/session-close/lib/notebook-scorer.mjs`, `~/.hermes/{nexus-goals,nexus-people,trend-watchlist}.yaml`, `_bmad-output/implementation-artifacts/sprint-status.yaml` |

## Conclusion

**Confidence:** High (Confirmed root cause; deterministic reproduction of a live `45`).

`rankScore` is **computed locally**, deterministically, by `computeRankScore()` in `score-digest-signals.mjs` during each Hermes morning-digest run — a fixed-weight linear blend of five 0–100 heuristic dimension scores (personalRelevance ×0.3, relevance ×0.2, momentum ×0.2, urgency ×0.15, novelty ×0.1) plus normalized engagement ×0.05 (momentum absorbs engagement's 0.05 → 0.25 when engagement is missing), rounded and clamped to 0–100. There is **no** upstream scorer: the source adapters supply raw platform inputs (titles, engagement counts, timestamps), the scorer turns them into the number, `push-digest-convex.mjs` relays it into Convex, and cns-dashboard only displays it. The problem statement's "production relays a pre-scored value" hypothesis is refuted.

## Recommended Next Steps

### Fix direction

None warranted — this is a diagnosis, not a defect. To *tune* the meaning of a `45`: adjust `RANK_WEIGHT_*` (`score-digest-signals.mjs:152-159`) or the individual dimension scorers; the disposition bands (`priority`/`watch`/`ignore`/`escalate`) live in `deriveDisposition:1595`. Any edit must be mirrored in both the repo copy and `~/.hermes/skills/cns/morning-digest/scripts/` (they are currently byte-identical).

### Diagnostic

To explain any specific post's score, read that day's `~/.hermes/digest-push-<date>.json` — every signal carries its full `scores{}`, `normalizedEngagement`, `disposition`, and `rankScore`, so the composite is fully re-derivable offline with the formula in Finding 1.

## Side Findings

- The 0.05 engagement weight redistributes to momentum (0.25) when `normalizedEngagement` is null, so engagement-less sources (newsapi, arxiv, deep_signal, google_trends) lean harder on momentum's trend-proxy prior (`score-digest-signals.mjs:1636-1640`, `:52`). (Confirmed)
- `rank` (the ordinal position) and `rankScore` (the 0–100 value) are distinct: `rank` is assigned by descending `rankScore` sort with original-index tiebreak (`:1689-1703`). (Confirmed)
- A `07:15` push-digest-watchdog cron replays the Convex push from the persisted artifact if the agent skips §9 — so the stored `rankScore` is the value that reaches the dashboard even on watchdog recovery (`task-prompt.md:842`). (Confirmed)
