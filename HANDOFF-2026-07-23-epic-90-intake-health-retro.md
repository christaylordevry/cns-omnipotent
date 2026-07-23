# HANDOFF / RETRO 2026-07-23 — Epic 90, intake health (Reddit + YouTube + dedupe)

**Read this first.** Supersedes the YouTube/dedupe threads in
`HANDOFF-2026-07-21-intake-diagnosis-and-redesign-reboot.md` (its §5 "Chore 2" and open
threads #2/#4 are now resolved — see below). The premise-decision and trend-layer sections of
that handoff still stand.

---

## TL;DR

Epic 90 closed the intake-health loop the 07-21 handoff opened. Four stories shipped and
committed on `hermes-consolidation` (unpushed):

| SHA | Story | What |
|---|---|---|
| `f7327f5` | 90-1 | Reddit restored via app-free Atom RSS (both digest + trend layers) |
| `8e0f1c9` | 90-2 | Silent source drops made visible (bare-`{error}` classification + fetch/primary/contributed counts + yt-stage canary) |
| `610d5e3` | 90-4 | Dedupe over-collapse fixed (`canonicalDomainPath` embeds youtube `v=`; entity-match proportion ≥0.5; partial-absorb alarm) |
| `ffb1297` | 90-3 | YouTube quality selection (view-velocity rank + `views≥200 AND likes≥5` floor, keep 12) — ~100× median-view lift |

cns-dashboard `cns-redesign`: `ada50fe` (90-2 validator sync) committed; `curation-selection-research-2026-07-21.md` addendum still uncommitted.

---

## The YouTube "drop" — 3 wrong hypotheses before the root cause

YouTube fetched ~25 videos/run and stored **0** digestSignals. The path to the real cause is
the most reusable thing in this epic, because each wrong turn *looked* right:

1. **"Transient adapter bare-`{error}` at build time."** (My first call.) Refuted: the cron
   `collect:` log showed `youtube=ok` every run, and the adapter returns a healthy `{videos:[25]}`
   today. YouTube reached build fine.
2. **"Cross-source dedupe loses on `SOURCE_PRIORITY.youtube=4`."** (Cursor's subagents,
   "Hypothesis D".) Right *mechanism*, wrong *primary cause* — it attributed the collapse to
   entity-match/priority.
3. **"Entity-match topic-collapse."** Real, but **secondary**.

**Actual root cause (found by the 90-4 sim, confirmed against the real pushed payload):**
`canonicalDomainPath` built its dedup key from `host + u.pathname` and **dropped `u.search`
entirely**, so every `youtube.com/watch?v=AAA/BBB/CCC…` collapsed to the single key
`youtube.com/watch` — **25 URLs → 1 canon key, ~300 false URL edges.** Entity-match then chained
the survivors. All 25 youtube signals landed in **one 33-item twitter cluster** (contributor
tally `{rss:2, twitter:3, bluesky:3, youtube:25}`), and youtube — lowest priority — lost every
`pickClusterWinner`, surviving only as `contributingSources`.

The single query that settled it: dump the pushed payload's `contributingSources` and count
youtube. `dedupClusterSize>1` on only 4/101 signals, but one of those 4 held all 25 youtube.
Reasoning had produced three plausible wrong answers in a row; **one look at real data ended it.**

---

## Reusable lessons (the point of this note)

1. **"ok / fired N" while storing 0 ⇒ suspect a downstream identity/dedup bug, not the adapter.**
   The fetcher was healthy the whole time. Check the *stored payload's* cluster structure
   (`contributingSources`, `dedupClusterSize`) before touching the source.
2. **Resolve hypotheses against the real artifact, not by reasoning.** The 07-22 pushed payload
   (`~/.hermes/digest-push-*.json`) had the answer in one grep. Three careful hypotheses were
   wrong; the data was not.
3. **Read the function before trusting its output.** `canonicalDomainPath` used `u.pathname`
   (no `u.search`); the exact-URL arm was a red herring. Fixing only `normalizeDigestUrl` would
   have silently under-delivered — the AC (25→25 distinct keys) is what caught it.
4. **Observability lies compound.** `summarizeAdapterCollection` printed `=ok` for any bare
   object *including* `{error}`, and `buildErrorsBySource` only recorded `success===false`. That
   false-`ok` is why both the youtube drop and the 46-day trend-layer death were invisible.
   Fixing observability (90-2) had to come *before* trusting any drop diagnosis.
5. **The dedupe vacuum is a general hazard, not youtube-specific.** Any low-priority source
   (`SOURCE_PRIORITY`: github 2, reddit 3, youtube 4, rss 4) can be zeroed by entity-clustering
   into a higher-priority neighbor. 90-4 fixed the youtube URL-identity case; the entity-match
   over-cluster of *short opposite-topic* titles ("Nvidia Chip Shortage" × "…Surplus") is
   **deferred (D1)** — needs an anti-opposition/distinguishing-token guard **with polymarket
   re-sim** before shipping.
6. **Propose-then-stop + a simulated before/after earns its keep on ranking/dedup changes.** It
   caught: the reddit "scorer null-drops" premise that was *false* (null → Path B survives, the
   real fix was adapter-side omit-upvotes); the dedupe philosophy fork; and the youtube quality
   formula. A selection rule not run against real data is a hypothesis.

---

## What each fix actually corrected (don't re-derive)

- **Reddit**: OAuth is a dead end (operator can't register a Reddit app; PRAW blocked by the same
  wall). Verified from the operator IP: `.json` → 403 all UAs, `top/.rss?t=day` → 200. RSS has no
  upvotes; the scorer does **not** null-drop upvote-less reddit (null → Path B, survives) — the
  real trap was coercing `upvotes:0` (Path A crush). Fix = adapter omits upvotes; scorer untouched.
- **YouTube quality**: the fetcher selected by recency (`order:'date'` + newest-25), never by the
  view/like stats it already fetched. `order:'viewCount'/'relevance'` returns evergreen all-time
  virals, so it keeps `date` + client-side **view-velocity** (`views / max(hours, 1h)`) over a
  quality floor. The downstream scorer was already correct — the whole problem was upstream
  candidate selection (same shape as 89-1 github).
- **Dedupe**: `canonicalDomainPath` now embeds youtube `v=` (and collapses m./music./nocookie
  host variants onto `youtube.com`); entity-match requires `shared/min(|A|,|B|) ≥ 0.5` in addition
  to the retained `shared ≥ 2`. Genuine duplicates still collapse (deletion kept). Scorer and the
  Convex contract untouched.

---

## Open threads

1. **Push.** 4 commits on `hermes-consolidation` unpushed — push from **WSL as `christaylordevry`**
   (Windows Git Bash 403s as `christaylorau23`).
2. **cns-dashboard** `cns-redesign` has the uncommitted `curation-selection-research-2026-07-21.md`
   addendum — commit or stash.
3. **D1 — anti-opposition entity-match guard** (deferred): short opposite-topic titles still
   over-cluster. Needs a distinguishing-token guard + polymarket re-sim. `deferred-work.md`.
4. **Digest-layer floor-wipe visibility** (deferred): a YouTube quality-floor wipe returns
   `{videos:[]}` (working-as-designed quiet, caught by a loud stderr line) but isn't distinct from
   an empty fetch at the digest observability layer. Add a `filtered` status only if it earns it.
5. **`youtu.be` vs `watch?v=` canon** (W1, deferred): same video via short-link and watch-link get
   distinct canon keys → a duplicate survives (over-count, not a drop). Fold into the
   invert-normalize backlog (strip *known tracking* params, preserve identity params by default).
6. **Verify on the next 07:00 runs**: youtube should now show `fetched N → ~≤12 stored primaries`
   (not 0), reddit should contribute non-zero primaries to both layers, and the yt-stage canary +
   partial-absorb alarm should be quiet on healthy runs. Stage-B github warm-up (from the 07-21
   handoff) is still accruing star history.

---

## Verified constraints — do NOT re-derive

- Scorer (`score-digest-signals.mjs`) is correct and was untouched across all four stories. Null
  engagement routes to the no-engagement rank branch (momentum = `TREND_PROXY_PRIOR[source]`), it
  does **not** drop signals.
- The producer↔Convex contract (`contracts/digest-signal-contract.json` ↔ `cns-dashboard
  convex/validators.ts`) is the OPS-2 boundary: any new persisted field needs the allowlist +
  a `v.optional` validator on both sides, or the *entire* push fails (0 written). 90-2's triple
  counts followed this; 90-4's R4 alarm deliberately stayed **stderr-only** to avoid it.
- YouTube API quota: `queries×100 + ceil(candidates/50)`; the `candidateMax=100` cap keeps a
  full run at ~1002 units, well under the 2000 warn.
