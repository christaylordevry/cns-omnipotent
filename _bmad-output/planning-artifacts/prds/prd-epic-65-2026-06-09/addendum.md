# Addendum — Epic 65 Native Source Adapter Expansion v1

Technical detail supporting the PRD. Normative fetch URLs, env var tables, and pipeline diagrams belong in `architecture-epic-65-native-source-adapters.md` (to be authored). This addendum captures contract excerpts from Epic 64 architecture and correct-course proposal.

## digestSignal emission contract (adapter → scoring → push)

Adapters produce **unscored** rows. Morning-digest task-prompt §9 builds `signals[]`, then `scoreDigestSignals` adds `scores`, `disposition`, `normalizedEngagement`, `rankScore`, and reassigns `rank`.

### Required keys (every signal)

| Key | Type | Notes |
|-----|------|-------|
| `section` | string | `github` \| `reddit` \| `rss` for Epic 65 sources |
| `sourceType` | string | Must match `digestSourceTypeValue` literal |
| `title` | string | Display title |
| `rank` | number | Pre-scoring placeholder; replaced after scoring sort |

### Optional keys (omit when absent — never `null`)

| Key | Type | Epic 65 usage |
|-----|------|---------------|
| `url` | string | Permalink to repo/post/article |
| `summary` | string | Snippet when available |
| `externalId` | string | Stable id (hash or platform id) |
| `sourceMetadata` | object | Engagement + auxiliary fields |
| `score` | number | Legacy; prefer metadata engagement fields |

### sourceMetadata engagement fields (Epic 64 §3.2 — normative for adapters)

```typescript
stars: v.optional(v.number()),      // github — required for normalizeEngagement
forks: v.optional(v.number()),      // github
upvotes: v.optional(v.number()),    // reddit — required for normalizeEngagement
commentCount: v.optional(v.number()), // reddit, hackernews
points: v.optional(v.number()),     // hackernews (65-5 optional alignment)
publishedAt: v.optional(v.string()), // ISO8601 — feeds urgency dimension
author: v.optional(v.string()),     // rss optional
```

## Cross-source normalization maps (Epic 64 §6.1 — adapters emit raw only)

Shared helper (implemented in `score-digest-signals.mjs`):

```
logNorm(value, cap) = round(clamp(100 * log10(1 + value) / log10(1 + cap), 0, 100))
```

| sourceType | Raw input | Cap constants | Formula |
|------------|-----------|---------------|---------|
| `github` | `stars`, `forks` | `GH_STARS_CAP = 50000`, `GH_FORKS_CAP = 5000` | `0.85 * logNorm(stars) + 0.15 * logNorm(forks)` |
| `reddit` | `upvotes`, `commentCount` | `RD_UPVOTES_CAP = 10000`, `RD_COMMENTS_CAP = 2000` | `0.75 * logNorm(upvotes) + 0.25 * logNorm(commentCount)` |
| `rss` | — | — | no `normalizedEngagement`; momentum Path B |

**Fixture tolerance (Epic 64 FR-11):** HN 500 points and GitHub 500 stars normalize to comparable bands (±15) but not equal values.

## digestSourceTypeValue extension (FR-1)

Add to `cns-dashboard/convex/validators.ts`:

```typescript
v.literal('github'),
v.literal('reddit'),
v.literal('rss'),
```

Existing literals unchanged: `google_trends`, `newsapi`, `arxiv`, `hackernews`, `deep_signal`.

## Reddit spike gate (65-2 → 65-3) — mirror 64-1 pattern

| Epic 64 gate | Epic 65 gate |
|--------------|--------------|
| 64-1 schema extension | 65-2 Reddit public-JSON spike |
| Blocks 64-2, 64-3, 64-4, 64-5 | Blocks 65-3 only |
| Unblocks scoring compute | Unblocks production Reddit adapter |

65-2 deliverables:

1. Spike script + fixture tests
2. Unattended simulation log (≥3 cycles)
3. GO/NO-GO table (FR-6) in story artifact
4. Explicit branch instruction for 65-3 author

**65-3 must reference 65-2 outcome in story Context block.**

## MIT / last30days attribution policy

| Rule | Detail |
|------|--------|
| Reference clone | `~/ai-factory/projects/last30days-skill-reference` (read-only) |
| Runtime | Never import, subprocess, or package.json dependency |
| Reimplementation | Translate Python fetch logic to Node; document studied files in story Dev Notes |
| Attribution | When algorithm derived from last30days, add comment citing MIT license + source file path in reference clone — not in production dependency graph |

## Config surface sketch (`~/.hermes/trend-ingest.env`)

Architecture doc finalizes names. PRD placeholders:

| Env var (proposed) | Adapter | Purpose |
|--------------------|---------|---------|
| `MORNING_DIGEST_GITHUB_ENABLED` | 65-1 | Feature flag |
| `MORNING_DIGEST_GITHUB_QUERY` or `_REPOS` | 65-1 | Search/repos list |
| `GITHUB_TOKEN` | 65-1 | Optional API rate-limit headroom |
| `MORNING_DIGEST_REDDIT_ENABLED` | 65-3 | Feature flag (post-spike) |
| `MORNING_DIGEST_REDDIT_SUBREDDITS` | 65-2/65-3 | Spike + adapter targets |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | 65-3 fallback | Credential path only |
| `MORNING_DIGEST_RSS_ENABLED` | 65-4 | Feature flag |
| `MORNING_DIGEST_RSS_FEEDS` | 65-4 | Comma-separated feed URLs |

All paths resolved via `resolveOperatorHome()` + `mergeTrendIngestEnv`.

## Epic 44 vs Epic 65 Reddit boundary

| Attribute | Epic 44 trend-ingest | Epic 65 morning-digest |
|-----------|---------------------|------------------------|
| Entry | `trend-ingest.py` / collectors | Hermes `morning-digest` skill |
| Story | `44-3-2` | 65-2 spike → 65-3 adapter |
| Output | Trend intelligence layer | `digestSignals` → Convex |
| Shared code in v1 | **None required** | Document only |

## Code touchpoints (expected)

| Path | Stories |
|------|---------|
| `cns-dashboard/convex/validators.ts` | 65-1 (FR-1) |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs` (new) | 65-1 |
| `scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs` (new) | 65-2 |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` (new) | 65-3 |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-rss-signals.mjs` (new) | 65-4 |
| `scripts/session-close/hermes-run-*.sh` wrappers | 65-1, 65-3, 65-4 |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | FR-12 |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | FR-12 |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` | 65-5 optional |
| `tests/morning-digest-*-adapter.test.mjs` (new) | all |

Scoring module `score-digest-signals.mjs` — **no algorithm changes** unless 65-5 HN mapping fix requires push-path metadata only.

## Story sequence diagram

```
                    ┌─────────────┐
                    │ 65-2 Spike  │──────blocks──────┐
                    │  (gate)     │                  │
                    └─────────────┘                  ▼
                          │                    ┌─────────────┐
              (parallel)  │                    │ 65-3 Reddit │
                          │                    │   adapter   │
┌─────────────┐           │                    └─────────────┘
│ 65-1 GitHub │◀── FR-1 ──┤
│  + schema   │           │
└─────────────┘           │
                          │
┌─────────────┐           │
│ 65-4 RSS    │◀──────────┘ (parallel)
└─────────────┘

┌─────────────┐
│ 65-5 HN opt │  (no blocker)
└─────────────┘

Epic 64 scoreDigestSignals ◀── all adapters emit matching metadata
```
