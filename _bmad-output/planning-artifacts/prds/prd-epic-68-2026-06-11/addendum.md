# Addendum — Epic 68 Source Expansion

Technical detail for architecture and story authors. Not normative product language — see `prd.md` FRs.

---

## A1 — X/Twitter adapter (Source 11)

### Env keys (normative for implementation)

| Key | Required | Notes |
|-----|----------|-------|
| `X_BEARER_TOKEN` | Yes (Basic tier) | From X Developer Portal — app with Elevated/Basic access |
| `MORNING_DIGEST_X_ACCOUNTS` | No | Comma-separated handles without `@` — default curated AI/tech list in example |
| `MORNING_DIGEST_X_SEARCH_QUERIES` | No | Comma-separated search strings; capped at 3 per run |
| `MORNING_DIGEST_X_MAX_TWEETS` | No | Default `20`; hard cap `50` per run for Basic tier budget |
| `MORNING_DIGEST_X_LOOKBACK_HOURS` | No | Default `24` |

Study `last30days-skill-reference`:
- `skills/last30days/scripts/lib/signals.py` — X engagement weights: likes 0.55, reposts 0.25, replies 0.15, quotes 0.05
- `skills/last30days/scripts/lib/xquik.py` — field mapping (`likeCount`, `retweetCount`, etc.)

**Do not** subprocess `xurl` or any Python CLI — port field mapping to TypeScript.

### Stdout contract

```json
{
  "posts": [
    {
      "title": "Tweet text truncated to 280 chars or first sentence",
      "authorHandle": "karpathy",
      "url": "https://x.com/karpathy/status/1234567890",
      "publishedAt": "2026-06-11T08:00:00Z",
      "likes": 1200,
      "reposts": 340,
      "replies": 89,
      "quotes": 12
    }
  ]
}
```

Failure: `{"error":"<reason>"}` exit **0**.

### digestSignal mapping

| stdout | digestSignal |
|--------|--------------|
| `title` | `title` |
| first 200 chars | `summary` |
| `url` | `url` |
| `authorHandle` | `sourceMetadata.authorHandle` |
| engagement fields | `sourceMetadata.likes`, `reposts`, `replies`, `quotes` |
| — | `sourceType: 'twitter'`, `section: 'twitter'` |

### normalizeEngagement branch

Port weighted log-norm from last30days X weights with caps `[ASSUMPTION: X_LIKES_CAP=50000, X_REPOSTS_CAP=10000, X_REPLIES_CAP=5000, X_QUOTES_CAP=2000]`.

---

## A2 — People watchlist schema (`nexus-people.yaml`)

Operator file at `~/.hermes/nexus-people.yaml` (not vault WriteGate).

```yaml
version: 1
people:
  - name: "Andrej Karpathy"
    handles:
      twitter: "karpathy"
      bluesky: "karpathy.bsky.social"
    tags: ["llm", "research"]
    weight: 2.5   # optional; default 2.5
  - name: "Dario Amodei"
    handles:
      twitter: "darioamodei"
    tags: ["ai-safety", "anthropic"]
```

Limits (mirror nexus-goals pattern):
- Max **30** people entries
- Max **3** handles per person per platform
- Missing/malformed → empty set; stderr once; no throw

### personalRelevance v3 bonus

When `sourceMetadata.authorHandle` matches any loaded handle (case-insensitive, strip `@`):
- Add **+20** to `personalRelevance` (clamp 0–100)
- Stack with goal-weighted F1 from 67-3 (not replace)

When signal title/summary contains `person.name` token overlap (F1 ≥ 0.3): add **+10**.

---

## A3 — Bluesky adapter (Source 12)

### Public read path (v1 — no credentials)

Primary: `app.bsky.feed.getAuthorFeed` via public AppView for configured actor DIDs/handles.

| Key | Required | Notes |
|-----|----------|-------|
| `MORNING_DIGEST_BSKY_ACTORS` | No | Comma-separated handles — default AI community list in example |
| `MORNING_DIGEST_BSKY_MAX_POSTS` | No | Default `25`; cap `50` |
| `MORNING_DIGEST_BSKY_LOOKBACK_HOURS` | No | Default `24` |

Resolve handle → DID via `com.atproto.identity.resolveHandle` (public).

Optional future (out of 68-4 scope): `BSKY_HANDLE` + `BSKY_APP_PASSWORD` for `app.bsky.feed.searchPosts` — study `last30days bluesky.py`.

### Engagement weights (from last30days)

likes 0.40, reposts 0.30, replies 0.20, quotes 0.10

### Stdout contract

```json
{
  "posts": [
    {
      "title": "Post text",
      "authorHandle": "simonwillison.net",
      "url": "https://bsky.app/profile/simonwillison.net/post/3l...",
      "publishedAt": "2026-06-11T07:30:00Z",
      "likes": 450,
      "reposts": 120,
      "replies": 34,
      "quotes": 8
    }
  ]
}
```

---

## A4 — Cross-source deduplication algorithm

### Cluster key priority (first match wins)

1. **Normalized URL** — reuse RSS `normalizeUrl()` logic from `fetch-rss-signals.mjs`; strip tracking params (`utm_*`, `fbclid`)
2. **Canonical domain + path** — for URLs that differ only by redirector (news.ycombinator.com → external)
3. **Title fingerprint** — lowercase, collapse whitespace, strip punctuation; Jaccard ≥ 0.85 on token sets
4. **Cross-title entity match** — same proper-noun set (≥2 tokens) + published within 24h `[ASSUMPTION]`

### Merge semantics

Winner selection:
1. Highest `normalizedEngagement` (post-score if pre-scored; else raw engagement proxy)
2. Tie: prefer `newsapi` > `hackernews` > `twitter` > `bluesky` > `rss` > others
3. Tie: earliest `publishedAt`

Merged `digestSignal`:
```typescript
sourceMetadata: {
  // primary source fields preserved
  contributingSources: [
    { sourceType: 'hackernews', url: '...', upvotes: 412 },
    { sourceType: 'twitter', url: '...', likes: 890 }
  ],
  dedupClusterSize: 3
}
```

Dedup runs **after** all adapters map to digestSignals, **before** `scoreDigestSignals()` cap/sort.

Title-only dedup in `pick-signal-notebook.mjs` remains for notebook routing cap — cross-source dedup is separate layer in push pipeline.

---

## A5 — Story dependency graph

```
68-1 (dedup) ─────────────────────────────┐
68-2 (people yaml loader) ──► 68-3 (personalRelevance v3)
68-4a (schema twitter) ──► 68-6 (X adapter) ──► 68-7 (X integration)
68-4b (schema bluesky) ──► 68-5 (Bluesky adapter) ──► 68-5b (Bluesky integration)
68-1 + 68-3 + 68-7 + 68-5b ──► 68-8 (live validation)
```

68-4a and 68-4b may ship as single story `68-4` if cns-dashboard touch is one PR.

---

## A6 — Live validation checklist (68-8)

- [ ] ≥30 scored signals in run
- [ ] ≥1 `twitter` signal with engagement metadata
- [ ] ≥1 `bluesky` signal with engagement metadata
- [ ] ≥1 dedup cluster with `contributingSources.length ≥ 2`
- [ ] ≥1 signal with `personalRelevance` boosted by people match (fixture or live)
- [ ] No duplicate titles for same URL cluster in Convex push payload
- [ ] Discord digest section shows merged source attribution
