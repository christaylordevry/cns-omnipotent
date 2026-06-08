# Addendum — Epic 64 Intelligence Scoring Engine v1

Technical detail that supports the PRD but belongs outside the main narrative. Architecture doc (`architecture-epic-64-scoring-engine.md`) will normatively own algorithms; this addendum captures proposal-extracted requirements.

## Scoring dimension definitions (normative tables)

### relevance (0–100)

| Band | Meaning | v1 signals |
|------|---------|------------|
| 0–20 | Off-topic | No watchlist/domain token overlap |
| 21–50 | Peripheral | Weak overlap, generic tech news |
| 51–75 | On-theme | Clear watchlist keyword match |
| 76–100 | Core theme | Strong multi-token match to primary watchlist domains |

**Inputs:** `~/.hermes/trend-watchlist.yaml` keywords, signal title/summary tokens.

### personalRelevance (0–100)

| Band | Meaning | v1 signals |
|------|---------|------------|
| 0–20 | No personal overlap | Matches neither sprint nor project entities |
| 21–50 | Adjacent | Tangential project/sprint token |
| 51–75 | Active work | Matches current sprint epic/story keyword |
| 76–100 | Direct hit | Matches focus project + sprint keyword |

**Inputs (v1 thin match):** Active sprint metadata, current project names, watchlist `personal` category terms from Epic 62 `keywordCandidates` where available, operator config entities.

**Anti-drift:** This dimension answers "does this matter to *my* work right now?" — not "is this trending in my domain?" The latter is `relevance`.

### novelty (0–100)

| Band | Meaning |
|------|---------|
| 0–20 | Repeat from recent digest history |
| 21–50 | Variation on recent theme |
| 51–75 | New angle on known topic |
| 76–100 | First appearance in lookback window |

**Lookback:** `[ASSUMPTION]` 7 days of `digestSignals` titles per workspace.

### momentum (0–100)

| Band | Meaning |
|------|---------|
| 0–20 | Flat / no engagement signal |
| 21–50 | Moderate normalized engagement |
| 51–75 | Strong engagement for source type |
| 76–100 | Top-decile normalized engagement + trend acceleration |

**Requires:** `normalizedEngagement` when raw engagement present (ADR-E64-003).

### urgency (0–100)

| Band | Meaning |
|------|---------|
| 0–20 | Evergreen / no time pressure |
| 21–50 | This-week relevance |
| 51–75 | Days-level sensitivity |
| 76–100 | Breaking / act-today indicators |

**v1 heuristics:** Publication recency, breaking-news source patterns, time-bound language in title `[ASSUMPTION]`.

## Disposition threshold sketch (64-3)

Architecture owns final numbers. Starting proposal:

| disposition | Rule sketch |
|-------------|-------------|
| `escalate` | `urgency` ≥ 75 AND (`personalRelevance` ≥ 60 OR `relevance` ≥ 75) |
| `priority` | `rankScore` ≥ 70 AND `personalRelevance` ≥ 50 |
| `watch` | `rankScore` 40–69 OR any single dimension ≥ 60 |
| `ignore` | `rankScore` < 40 AND all dimensions < 50 |

## rankScore weight sketch (64-5)

| Component | Proposed weight |
|-----------|-----------------|
| personalRelevance | 0.30 |
| relevance | 0.20 |
| momentum | 0.20 |
| urgency | 0.15 |
| novelty | 0.10 |
| normalizedEngagement boost | 0.05 (additive cap 100) |

**Anti-drift:** `personalRelevance` weight MUST be > 0; cannot be reduced to zero in v1.

## Engagement normalization sketch (64-4)

Per-source monotonic maps to 0–100 (architecture finalizes):

| sourceType | Raw fields | Normalization approach |
|------------|------------|------------------------|
| hackernews | `points`, `commentCount` | Log-scaled caps (e.g. 500 pts → ~85) |
| github (Epic 65) | `stars`, `forks` | Log-scaled caps |
| reddit (Epic 65) | `upvotes`, `commentCount` | Log-scaled caps |
| newsapi | — | No engagement; momentum from recency/trend proxy |
| arxiv | — | No engagement; momentum from citation proxy or low default |
| google_trends | `normalizedValue` in trend row | Already 0–100; feeds momentum fallback |

**Rule:** Never compare 500 HN points to 500 GitHub stars directly.

## Schema reference (from sprint-change-proposal)

```typescript
scores: v.optional(v.object({
  relevance: v.number(),
  personalRelevance: v.number(),
  novelty: v.number(),
  momentum: v.number(),
  urgency: v.number(),
})),
disposition: v.optional(v.union(
  v.literal('priority'),
  v.literal('watch'),
  v.literal('ignore'),
  v.literal('escalate'),
)),
normalizedEngagement: v.optional(v.number()),
rankScore: v.optional(v.number()),
```

## ADR preview (for architecture doc)

| ADR | Decision |
|-----|----------|
| ADR-E64-001 | Scoring engine in Omnipotent.md digest scripts |
| ADR-E64-002 | `scores` object is SSOT for dimensions; `rankScore` for ordering |
| ADR-E64-003 | Raw engagement never compared cross-source |
| ADR-E64-004 | Personal relevance v1 = keyword/entity; vault-semantic deferred |
| ADR-E64-005 | last30days reference codebook only |

## Code touchpoints

| Path | Stories |
|------|---------|
| `cns-dashboard/convex/validators.ts` | 64-1 |
| `cns-dashboard/convex/digest.ts` | 64-1 |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | 64-1, 64-5 |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` (new) | 64-2..64-5 |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | unchanged purpose (64-5 regression guard) |
