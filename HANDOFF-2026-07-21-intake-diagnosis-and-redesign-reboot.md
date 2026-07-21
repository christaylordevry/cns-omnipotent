# HANDOFF 2026-07-21 — intake diagnosis, north-star reframe, redesign reboot

**Read this first.** Supersedes `HANDOFF-2026-07-21-ops-observability-and-notebooklm-source.md`
(its NotebookLM task is DONE — see §1). Companion research:
`cns-dashboard/_bmad-output/planning-artifacts/curation-selection-research-2026-07-21.md`.

---

## TL;DR

- **A five-line shell-quoting bug had been starving the intake pipeline.** Fixed. The
  continuous "always-alive" trend layer had been **dead for 46 days** while its crons ran
  every 15 minutes. It came back to life within ~90 minutes of the fix.
- **North star corrected by the operator:** Nexus is a **continuous intelligence cockpit**,
  not a morning briefing. Morning is the highest-stakes moment on the surface, not the
  definition of it.
- **The always-alive substrate already exists** — the trend layer, which the entire redesign
  had been ignoring in favour of the batch digest layer.
- **The shortlist problem is confirmed structural, not config.** With *correct* config the
  top 10 is **3 GitHub repos + 7 Polymarket markets — zero content signals**. Fixing the
  config made it worse, not better.
- Epic 89 opened: **89.1 greenlit** (GitHub STORE_MAX widen), **89-3 backlogged**
  (shortlist rules, blocked on a shortlist existing).

---

## Current state

| Repo | Branch | Head | State |
|---|---|---|---|
| `Omnipotent.md` | `hermes-consolidation` | `024f2ec` | pushed; **4 uncommitted** (89-1, 89-3, deferred-work, sprint-status) |
| `cns-dashboard` | `cns-redesign` | `f5e1e95` | pushed, clean |

Uncommitted in `Omnipotent.md` are Cursor's story artifacts from the 89.1 narrowing — commit
with the dev-story work.

---

## 1. NotebookLM `981466f0` — RESOLVED

Root cause: the 58-3 PDF migration covered **2 of 3** notebooks despite its record claiming
all 3. `981466f0` still held a pre-migration `generated_text` source with no Drive linkage.
Fixed by attaching the Drive PDF in the UI (new source `43663c0f-b944-429c-a258-6f0bea4b010c`,
type `word_doc`). **3/3 targets verified green** by hand-running the session-close argv
(`nlm source sync <nb> --source-ids <id> -y`) — no `/session-close` spend. No code change;
matcher untouched.

`NOTEBOOKLM_DRIVE_DOC_ID` lives in **`~/.hermes/session-close.env:14`** (a third env file —
why earlier greps of `.env.live-chain` and `~/.hermes/.env` came back empty). It is **not
stale**: resolves to a live 2.99 MB PDF modified 2026-07-20.

> Timing caveat: today's syncs ran 3–4s against an *unchanged* PDF. OPS-5's 41.2s bound is
> **untested by that run, not disproven**. Keep `NLM_SYNC_TIMEOUT_MS` at 120s.

---

## 2. 🔥 ROOT CAUSE — five unquoted env values starved the pipeline

`~/.hermes/trend-ingest.env` held space-separated values without quotes. In shell,
`FOO=a b c` sets `FOO=a` *for a command named `b`* — so the variables ended up **unset**,
and `b: command not found` was logged on every cron tick.

| Line | Variable | Words lost |
|---|---|---|
| 17 | `MORNING_DIGEST_GITHUB_QUERIES` | 27 of 28 |
| 22 | `MORNING_DIGEST_PROJECT_ENTITIES` | 4 of 5 |
| 29 | `MORNING_DIGEST_YOUTUBE_QUERIES` | 13 of 14 |
| 34 | `MORNING_DIGEST_PINTEREST_KEYWORDS` | 3 of 4 |
| 35 | `MORNING_DIGEST_POLYMARKET_KEYWORDS` | 4 of 5 |

`MORNING_DIGEST_REDDIT_SUBREDDITS` was unaffected — comma-separated, no spaces.

**Fixed 2026-07-21 14:46.** Backup: `~/.hermes/trend-ingest.env.bak-20260721-144626`.
Also installed **`pytrends` 4.9.2** to user site-packages (Google Trends had been erroring
hourly); verified it imports under a *bare env*, which is what cron actually gets.

**Immediately after:** `watchlistKeywords` **1 → 14**; `trendTopics` **5 → 19**, with the two
previously-disjoint topic vocabularies merging into one; ingest returns `httpStatus 200 / ok`;
stderr clean.

⚠️ **Any `~/.hermes/*.env` value containing spaces MUST be double-quoted.** Verify by sourcing
the file and checking for `command not found`.

---

## 3. North star (operator, authoritative)

**Nexus is a continuous intelligence cockpit, not a morning briefing.** Two modes, one surface:

- **Morning orient** — fastest path to "what changed, what matters, what deserves judgment now"
- **Live operating mode** — a calm, persistent surface returned to through the day

Required properties: ambient awareness (quiet when nothing moved), state continuity (return
without reopening a one-shot artifact), live deltas, persistent triage. **It should read as an
instrument panel, not a report.** The scenario name `01-eric-morning-orient` encodes the
superseded framing.

### Architecture correction — the alive substrate already exists

The redesign had been designed **entirely against the digest layer**, which is batch by
construction and could never support this.

| | Digest layer | Trend layer |
|---|---|---|
| Cadence | daily 07:00 | reddit 15min · news 30min · trends+analytics hourly |
| Unit | `digestSignals` — atomic row, ONE `sourceType`, per-run scoped | `signalEvents` — per-topic, per-source, timestamped, `dedupeKey` |
| Cross-source linkage | **0 of 75** (measured) | `trendTopics.sourceBreakdown` = per-source array |
| Aggregates | none | `trendScores`, `trendAnomalies`, `trendForecasts`, `trendAlerts` |

**This revises the curation-research headline finding.** Multi-source corroboration is absent
in the digest layer and **structurally present** in the trend layer. The cluster capability
identified as "missing" was largely already built — **starved, not absent.** Source the cockpit
from the trend layer, with the digest as an orientation lens. Far smaller than a cluster rebuild.

---

## 4. CHORE 1 — PASS ✅ (trend layer is alive)

```
16:01 — 19 topics, 8 with momentum != 0
llm-infrastructure=0.05 · ai-coding-tools=0.04 · ai-funding-rounds=0.02
creator-economy=0.01 · ai-agents=0.01
```

Dead 46 days (`lastUpdated` 1103.8 h) → computing momentum within ~90 min of the fix.
**`lifecycleStage` is still unset on all 19** — expected; lifecycle needs more history than
momentum. Re-check tomorrow.

`runAnalyticsPass` requires **`MIN_SIGNALS = 5`** over `SIGNAL_WINDOW_DAYS = 30`
(`convex/trendAnalytics.ts:15`) — it correctly declines to score below that and marks
`scored: false`. That's honest behaviour, not a bug.

---

## 5. CHORE 2 — ANSWERED ❌ (corrected config makes the shortlist WORSE)

Ran the **real builder + real scorer** locally (no push, no Discord, no Convex write):

```
built signals: 98   (vs 75 stored this morning)

TOP 15 BY rankScore — corrected config, live
  48 [github    ] langchain-ai/langchain
  47 [polymarket] Will Anthropic have the best AI model at the end of July 2026?
  47 [polymarket] Will OpenAI have the best AI model at the end of July 2026?
  47 [polymarket] Will Alibaba have the best AI model at the end of July 2026?
  45 [polymarket] Will Z.ai have the best AI model at the end of July 2026?
  45 [polymarket] Will the next Claude Opus model be released by July 31, 2026
  45 [polymarket] Will the next Claude Opus model be released by July 24, 2026
  44 [polymarket] Will Google have the best AI model at the end of July 2026?
  42 [github    ] obra/superpowers
  42 [github    ] langgenius/dify
  ...
  40 [twitter   ] it is good now!     ← #13

top-10 composition: {github: 3, polymarket: 7}
full intake: youtube:25 polymarket:15 rss:10 bluesky:10 arxiv:9 twitter:9
             newsapi:5 hackernews:5 github:5 producthunt:5
```

**All ten top slots come from the two sources identified as level-signal emitters. Zero
content signals in the top ten.** This morning (broken config) it was 3 of top 5; with
correct config it is 10 of 10 — curated Polymarket keywords match **more** markets (9 → 15).

**Therefore: `rankScore`'s bias is structural, not a config artifact. That question is closed.**

**Unexplained and worth investigating:** YouTube contributed **25 signals — the largest single
source, 26% of intake — and none appear in the top 15.** Newly alive today (its query var was
one of the five broken). Low-value, or under-weighted by `rankScore`? Unknown.

> ⚠️ **Caveat:** this used the real builder and real scorer with the real context loader, but
> it is a local harness and **the dedupe step was skipped**. The seven near-identical
> "Will X have the best AI model" rows are exactly what dedupe collapses, so production may
> show fewer Polymarket entries. Direction holds; exact count may soften. Tomorrow's 07:00
> run confirms through the real path.

### Forcing a same-day digest — how, and why it failed

`run-morning-digest-cron.sh` exited in 3s on **`skipped-already-pushed`**. The guard is the
**Convex `digestRuns` row for today**, *not* the `~/.hermes/digest-push-<date>.json` artifact.
Moving the artifact aside is necessary but **not sufficient**. Bypassing the guard risks a
double Convex write and a duplicate Discord post — prefer the local-harness measurement above.
(Artifact was moved and **restored**; system left as found.)

**Convex is healthy.** The `"free plan limits … deployments disabled"` line in
`morning-digest-skill-cron.log` is a **historical entry from the 2026-07-20 outage** in an
append-only log — not a current incident. Verify with a live query before reacting to it.

---

## 6. Source health (live 2026-07-21)

| Source | State |
|---|---|
| `reddit` | **fail — http-403** |
| `tiktok`, `instagram`, `pinterest`, `threads`, `linkedin` | **fail — credit-exhausted** (5 sources dead on billing) |
| `hackernews` | flaky — `TypeError` / `TimeoutError` / ok across three consecutive runs |
| `trends`, `newsapi`, `arxiv`, `github`, `rss`, `producthunt`, `twitter`, `bluesky`, `youtube`, `polymarket` | ok |

Operator direction: restore **Reddit** and core news (structurally useful); leave
TikTok/Instagram/Pinterest/Threads/LinkedIn **off for v1** unless they demonstrably improve
the shortlist or trend layer. Don't aim for "all sources up."

---

## 7. Epic 89 — stories

### 89.1 — GitHub STORE_MAX widen — ✅ **SHIPPED `3d3c73e`** (status: review)

Implemented via option **(a)**: in-code defaults raised to `MAX_REPOS_DEFAULT = 40` /
`PER_QUERY_DEFAULT = 5`, so the widen is real **without** depending on operator-local env.
Env pins were also set in `~/.hermes/trend-ingest.env` as belt-and-suspenders. A stripped-env
live fetch still returned 40 — the defaults do reach `loadGithubConfig()`.

**Proofs (independently re-verified):**
- fetcher: `repo_count=40`, `distinct_urls=40`; long tail present —
  `llm-d/llm-d-router` (261 ★), `CodingWithCalvin/VS-MCPServer` (64 ★)
- write path: 40 fetched → 40 `github` digestSignals, 1:1, all with `stars` + `externalId`
- **`build-digest-push-payload.mjs` is absent from the diff** — no cap was added to the
  write loop, which was the load-bearing requirement
- `tests/morning-digest-github-adapter.test.mjs` — **17 pass / 0 fail, exit 0**
- `verify.sh` — exit 0

**Code review: COMPLETE — status `done`.** 0 decision-needed, 0 patches, 4 deferred,
~12 dismissed. **Nothing blocks 40 GitHub rows/day reaching `digestSignals`** —
`push-digest-convex.mjs:523` loops the full `payload.signals` with no count ceiling, and
`dedupeReposByUrl` is URL-dedupe + STORE_MAX only.

**Confirmed downstream regression (display only, NOT a 89-1 reopen):** with github at 40,
a run builds ~133 signals and three consumers truncate at 100 —
`NexusDigestSignalFeed.svelte:29-39` (`DIGEST_SIGNAL_LIMIT=100`, drops the ~33 lowest
`rankScore`), `cns-dashboard/convex/digest.ts:337` (hard clamp `min(…, 100)`, applied after
`.collect()`), and `validate-epic-68-digest.mjs:18` (warns).

> **Deliberately NOT fixed yet.** The 133-row feed is a *secondary intake surface*; the
> cockpit target is 5–10 items. Raising the limit now optimises a surface the redesign is
> about to replace. Revisit only if the feed survives Phase 4 IA in its current form.

Other review results: Discord impact is **+1** 2000-char chunk (not a flood); GitHub API
still **12** search requests/run (`per_page` 3→5 adds no calls, well inside the ~30/min
authenticated budget); the OPS-2 contract guard is **count-agnostic** (field-set only); the
N→N test is non-trivial (would fail on a write-loop `slice(0,5)`).

⚠️ **Pre-existing, unchanged by this commit, worth knowing:** a single `http-429` aborts the
**entire** GitHub source. Same silent-failure shape this epic has been removing.

**Stage B warm-up clock starts on the next digests storing ≥30 github rows each (target 7
consecutive).** First one is tomorrow's 07:00.

<details>
<summary>Original story scope (as approved)</summary>
`_bmad-output/implementation-artifacts/89-1-digest-stage-a-github-store-max-widen.md`

Stage A is **data accumulation, not a UX win** — label retained deliberately.

- **AC1** STORE_MAX=40 / PER_QUERY=5, **write ALL rows** to `digestSignals`
- **AC2** env + space-quoting documented; asserts **no** `SHORTLIST_MAX`/`EMIT_MAX` introduced
- **AC3** no selection / no Stage B / no schema games
- **AC4** tests + verify

**Validated live:** those numbers return **exactly 40 distinct repos** after dedupe, and
surface a long tail previously discarded — `llm-d/llm-d-router` (261 ★), `yagil/ChatIDE` (222),
`alejandroll10/idea-evaluation-pipeline` (138), `zeitstein/brimm` (110),
`Netxeo/skill-file-security` (69), `CodingWithCalvin/VS-MCPServer` (64). **Emergence is
undetectable without this** — you cannot spot a rising repo you never fetch.

Pre-89.1 defaults were `MAX_REPOS_DEFAULT = 5`, `PER_QUERY_DEFAULT = 3`
(`fetch-github-signals.mjs:10-11`), neither set in env → 12 queries × 3 = 36 fetched,
**31 discarded**. Now 40 / 5.

⚠️ **Write-all is load-bearing.** `build-digest-push-payload.mjs:200` turns every returned repo
into a `digestSignals` row; there is no separate store. `digestSignals.sourceMetadata.stars`
**is** the star history. Capping writes at 5 would make the warm-up gate unreachable and
Stage B impossible — and would look fine for a week before anyone noticed.
*(Verified post-implementation: no cap was added — the file is absent from `3d3c73e`.)*

</details>

### 89-3 — shortlist rules — **BACKLOG, blocked**
`_bmad-output/implementation-artifacts/89-3-judgment-shortlist-github-cap-and-polymarket-exclusion.md`

Cut from 89.1 because **no judgment shortlist exists in code** — greps for
`isJudgmentShortlistEligible` / `judgmentShortlist` / `shortlist` return **zero hits** in
`Omnipotent.md/scripts/` and `cns-dashboard/src|convex/`; `post-digest-discord.mjs` only does
2000-char chunking. Holds: GitHub `SHORTLIST_MAX=5` + **Polymarket type-exclusion**
(a signal-type exclusion, **not** a score penalty a high `rankScore` could overcome).
Chore 2 makes this urgent.

### Stage B — velocity ranking — after ~7 days of warm-up
Star velocity is computable from stored history — **no new API**. `externalId` is stable and
`sourceMetadata.stars` persists. Measured 07-18 → 07-21:

```
obra/superpowers        256602 -> 258124  +1522 (+0.593%)
langgenius/dify         149173 -> 149505   +332 (+0.223%)
langchain-ai/langchain  142004 -> 142181   +177 (+0.125%)   ← provably static
MetaGPT                  69414 ->  69444    +30 (+0.043%)
labring/FastGPT          29014 ->  29040    +26 (+0.090%)
```

**Cold-start cliff:** across all 4 stored runs the GitHub rows were **the same 5 repos every
day** — history covers exactly 5 repos. Widen to 40 and ~87% have no prior observation.
A threshold **cannot** be honestly fitted to 5 mega-repos. Hence two stages.
**The absolute floor is load-bearing:** a 69-★ repo gaining 6 stars is +8.7% and would
out-rank everything on pure percent.

---

## 8. Verified constraints — do NOT re-derive

- **BD-2** `externalId` is stable run-over-run: **27/75 carryover**, ~48 new, 3 escalated,
  13 cooled. Deltas are real; BD-2 is *not-yet-built*, not thin-data.
- **BD-5** usable signal→topic stamp rate **3.1–6.3%**; 11 watchlist topics have a trends row,
  only `llm-infrastructure` has content evidence → **10 of 11 open with nothing crossing**.
  All trends-row stamps are tautological self-matches. This is why "What You Should Watch"
  reads as an echo (11 of 19 live rows were GT self-matches).
- **BD-6** No per-signal Confidence. One `sourceType` per signal; `externalId`s under >1
  source = **0/75**; `dedupClusterSize` / `contributingSources` on **4/75**. On ~95% of cards
  Confidence would just restate `sourceType`. Confidence is an **entity** property.
- **BD-7** Entity emergence has no substrate: `trackedInMotion: 0`, `emergingToReview: 1`
  (`org:github:labring`, single-source), `hasBaselineHistory: true` — not cold start.
- **Priority = `rankScore` as stored.** Transparent fixed blend, already in Convex, no LLM.
  Never re-blend — that double-counts.
- Entities have **no lifecycle**; lifecycle is a **topic** property (`trendScores.lifecycleStage`).
- Baseline is **non-adoption** — success is trust and adoption, not minutes saved. The live
  board reads `9 items · 9 triage`: no disposition has ever moved, so nothing the operator has
  judged has ever fed back into selection.

---

## 9. Running the dashboard

```bash
cd ~/ai-factory/projects/cns-dashboard && npx vite dev   # WSL, nvm sourced
http://localhost:5173/nexus
```

Gotchas that cost time: **`nohup` alone does not keep it alive** (dies with the parent shell),
and it must run from **WSL with nvm sourced** — Windows `npx` shadows it and fails.
`.claude/launch.json` is committed in `cns-dashboard`. The operator had **never seen the
running app** before today — baseline non-adoption was literal.

---

## 10. Open threads

1. **Chore 2 confirmation** — tomorrow's 07:00 run through the real pipeline, **with dedupe**,
   to confirm the Polymarket cluster count. Query the newest `digestRuns` row and read the top
   N. Note the arg is **`digestRunId`**, not `runId`, and pass **`limit: 100`** — the default
   is 50 and silently truncates (this caused two wrong measurements today).
2. **YouTube invisibility** — 25 signals, 0 in top 15. Low-value or under-weighted?
3. **`lifecycleStage`** still unset on all 19 topics — re-check after more history.
4. **Reddit 403 + 5 credit-exhausted sources** — restore Reddit and core news; leave the rest off.
5. **Premise decision** — feed vs analyst. Better posed: *your sources emit **levels**; an
   analyst needs **deltas**.* The trend layer already computes momentum.
6. **Vault-corruption origin** (from the superseded handoff) — some write between 07-14 and
   07-20 dirtied `AI-Context/AGENTS.md`. OPS-4 contains the blast radius, doesn't explain it.
7. **Unguarded Convex siblings** — `entityMentions`, `keywordCandidates`, `hermesAwareness`
   cross the producer→Convex boundary with no contract. The OPS-2 manifest pattern generalises.

---

## 11. Operating notes that cost time today

- **A selection rule that has not been executed against real data is a hypothesis.** Cursor's
  first rule read as well-argued — change gate, source caps, explicit rejections table — and
  produced the tweet `"it is good now!"` at position 3 when simulated. Simulating took four
  minutes. **Always demand the simulated before/after in the story.**
- **Read the function signature before parsing its output.** Three shape-assumption errors
  today: `sourceBreakdown` is an **array** not a dict (produced a false "empty" reading);
  `runGithubFetch` returns `{repos}` not `{signals}`; `scoreDigestSignalsSafe(signals, env)`
  takes the **array**, not the payload object. Each produced a plausible-looking wrong answer.
- **Check the query's default limit.** `getDigestSignalsForRun` defaults to `limit ?? 50` on a
  75-signal run — two separate analyses were computed on truncated data.
- **Historical log lines look like live incidents.** The Convex "deployments disabled" line was
  a month-old entry in an append-only log. Verify with a live call.
- **Config bugs and architecture bugs look identical from the UI.** Half of today was spent
  proving a shortlist problem was architectural; it was partly a quoting bug — and then the
  corrected data proved the *remaining* problem genuinely is architectural. Both passes were
  necessary; neither could have been skipped by reasoning.
