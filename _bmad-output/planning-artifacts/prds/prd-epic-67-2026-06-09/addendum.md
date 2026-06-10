# Epic 67 PRD Addendum — Technical Reference

Companion to `prd.md`. Implementation choices that belong out of the normative FR narrative.

---

## A1. ProductHunt adapter (Source 10) — API surface

**Preferred path:** Product Hunt public GraphQL API (`https://api.producthunt.com/v2/api/graphql`) with daily `posts` query filtered to `featuredAt` or `createdAt` within last 24h.

**Auth:** Developer token via `PRODUCTHUNT_API_TOKEN` in `~/.hermes/trend-ingest.env` (free tier sufficient for daily digest).

**Engagement fields for Epic 64 normalization:**

| Field | sourceMetadata key | Notes |
|-------|-------------------|-------|
| Upvotes | `upvotes` | Maps to existing cross-source upvote branch if present, else new `producthunt` branch in `normalizeEngagement` |
| Comment count | `commentCount` | Optional compound |
| Launch date | `publishedAt` | ISO string for momentum/urgency |

**Stdout contract (matches Epics 64–65):**

```json
{"launches":[{"name":"...","tagline":"...","url":"...","upvotes":42,"commentCount":7,"publishedAt":"..."}]}
```

or `{"error":"..."}` with exit 0 on failure.

**Reference study:** `last30days-skill-reference` Product Hunt section (read-only) — port pagination and field mapping to TypeScript; never subprocess.

**Schema:** Add `producthunt` to `digestSourceTypeValue` in cns-dashboard (65-1 pattern). Test fixture in `digest.test.ts` already references literal — extend validators in 67-5.

---

## A2. `nexus-goals.yaml` — draft schema

**Path:** `~/.hermes/nexus-goals.yaml` (operator-authored; not vault WriteGate).

```yaml
# Operator focus areas for personalRelevance v2 (5–10 phrases)
version: 1
updated: 2026-06-09
goals:
  - phrase: "Nexus intelligence cockpit"
    weight: 2.0   # optional per-phrase override; default 2.0 vs sprint 1.0
  - phrase: "morning digest signal quality"
  - phrase: "Convex real-time dashboard"
```

**Loader:** `loadScoringContext()` in `score-digest-signals.mjs` reads via `resolveOperatorHome()` → `join(operatorHome, '.hermes', 'nexus-goals.yaml')`.

**Scoring integration:**

- Tokenize each `goals[].phrase` into `goalTokens` with per-token weight multiplier (default **2.0** vs sprint token weight **1.0**).
- `scorePersonalRelevance` computes weighted F1: goal matches contribute double sprint-token matches.
- Missing file → degrade gracefully (no throw); log once per run in stderr JSON diagnostic `[ASSUMPTION: optional observability story]`.

**Example file:** Add `scripts/nexus-goals.yaml.example` in Omnipotent.md repo (not `~/.hermes` — operator copies manually).

---

## A3. Signal Seeds chip → Inspector slug resolution

**Problem:** `keywordCandidates.term` is canonical storage key (e.g. `ai-agents`); `displayTerm` is human label (`AI agents`). Inspector selection uses `topicSlug` from `getTrendTopics`.

**Resolution algorithm (67-4):**

1. On chip body click (not Track/Dismiss buttons), normalize `displayTerm` and each topic's `headerMeta.keyword` (case-fold, collapse whitespace).
2. Exact match → `setSelectedTopicSlug(topic.slug)`.
3. Else slugify `displayTerm` (`term` field) and match `topic.slug`.
4. Else no-op with optional `aria-live` "No matching topic" — do not open empty inspector.

**Reuse:** `resolveScoredDigestSignal` keyword normalization in `nexus-inspector-scoring.ts` should share util to avoid drift.

---

## A4. Live digest validation checklist (67-1)

Operator or story author runs **one full morning-digest** (not `--dry-run` trend-ingest) and records:

| Check | Pass criteria |
|-------|---------------|
| Signal count | ≥30 scored `digestSignals` in Convex for run |
| GitHub | ≥1 signal with `sourceType: github`, `sourceMetadata.stars` present |
| RSS | ≥1 signal with `sourceType: rss` |
| personalRelevance | ≥1 signal with `scores.personalRelevance > 0` mentioning project entity |
| Inspector | GitHub/RSS signals open in drawer with Signal Intelligence panel |
| Degraded mode | Failed source emits `(source unavailable: …)` without aborting digest |

Artifact: `_bmad-output/implementation-artifacts/67-1-live-digest-validation.md` with run timestamp, `digestRunId`, signal counts by `sourceType`, screenshot or JSON excerpt.

---

## A5. Reddit OAuth retry (67-2)

**Subreddits (env `MORNING_DIGEST_REDDIT_SUBREDDITS`):**

`MachineLearning,LocalLLaMA,SideProject,entrepreneur,devops,artificial,singularity`

**Env keys in `~/.hermes/trend-ingest.env`:**

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT` (format: `platform:app-id:version (by /u/username)`)
- `REDDIT_USERNAME` / `REDDIT_PASSWORD` (password grant — existing 65-3 path)

**Captcha blocker:** old.reddit.com/prefs/apps — operator retries in browser; story documents outcome only.

---

## A6. Compare smoke test protocol (67-6)

**Prerequisites:** `NEXUS_COMPARE_ENABLED=true` (Convex), `PUBLIC_NEXUS_COMPARE_ENABLED=true` (client if prod), ≥2 digest runs within 7 days sharing same `digestFocusKeyword`.

**Steps:**

1. Run morning digest twice on consecutive days with stable watchlist keyword (e.g. `ai agents`).
2. Open inspector on matching topic → tap **Compare**.
3. Record: prior run found (Y/N), streamed diff mentions source/score delta (Y/N), session persisted (Y/N).

**Artifact:** `67-6-compare-smoke-test.md` with dates, topic slug, `investigationSessions` id, operator notes.

---

## A7. Architecture constraints (binding)

From operator brief + ADR-E67-001:

- All adapters: Node.js `.mjs` in `Omnipotent.md/scripts/hermes-skill-examples/morning-digest/scripts/`
- Wrappers: `scripts/session-close/hermes-run-*.sh`
- `resolveOperatorHome()` in all new scripts — never `os.homedir()` alone
- No Python subprocesses in ingest pipeline
- BMAD stories only — no cowboy edits
- `bash scripts/verify.sh` green before story done
