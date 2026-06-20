---
story_id: 72-5
epic: 72
title: pinterest-scrapecreators-adapter
status: done
baseline_commit: aebe05771748033597628417769bb7c6f822b6c6
operator_brief: 2026-06-20
predecessors: 72-1, 72-2, 72-3, 68-1, 68-4, 70-1
blocks: 72-4
repo: cross-repo (Omnipotent.md adapters + cns-dashboard schema)
fr_ids: FR-1, FR-2, FR-3, FR-4, FR-5
priority: P1
---

# Story 72.5: Pinterest ScrapeCreators Adapter (Source 16)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest**,
I want **a Pinterest signal adapter via ScrapeCreators (API-key only) wired as Source 16**,
so that **visual/inspiration signals from keyword watchlists enter the digest with repin-based engagement scoring, full registry/orchestrator parity, and Convex push validators that cannot repeat today's `viewCount` / contributor-metadata drift failure**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 72 — Source Expansion (continues after YouTube 72-1/72-2, TikTok/Instagram 72-3) |
| **Priority** | **P1** — extends ScrapeCreators coverage; no new credential (reuses `SCRAPECREATORS_API_KEY` from 72-3) |
| **Repo** | **Cross-repo** — schema: `cns-dashboard/convex/validators.ts`; adapters + pipeline: Omnipotent.md |
| **Predecessors** | **72-3** (ScrapeCreators client pattern, credit-budget conversation — **env key only**; otherwise independent), **72-2** (registry parity test), **72-1** (query-watchlist adapter shape), **68-1** (dedup), **70-1** (orchestrator) |
| **Vendor** | ScrapeCreators — `https://api.scrapecreators.com`, auth header `x-api-key`, env `SCRAPECREATORS_API_KEY` |
| **Out of scope** | Pinterest board pins, individual pin, profile endpoints (deeper drill-down — skip for v1); Pinterest official ads/OAuth API; npm ScrapeCreators SDK; `last30days` subprocess; vault writes |

### Operator brief (binding — 2026-06-20)

| Requirement | Value |
|-------------|-------|
| Auth | Single `x-api-key` header — **no OAuth**, same key as 72-3 |
| Env | `SCRAPECREATORS_API_KEY` (already set), `MORNING_DIGEST_PINTEREST_KEYWORDS` |
| Endpoint (v1 only) | `GET /v1/pinterest/search?query={keyword}` — returns pins with title, description, image URL, outbound link, pinner, saves/repin_count |
| Skipped endpoints | Board pins, individual pin, profile — future drill-down only |
| Engagement signal | **`repin_count` (saves)** — not likes; weight in 5-dimension scoring analogous to ProductHunt upvotes / social likes |
| Pattern | Mirror **GitHub/YouTube query-watchlist** adapter shape (`fetch-*-signals.mjs` + `hermes-run-*.sh`) |
| Registry | Source **16** — extend `tests/digest-source-registry-parity.test.mjs`, `DIGEST_SOURCE_SECTION_MAP`, `DIGEST_SOURCE_HEALTH_REGISTRY`, `digestSourceTypeValue` / `digestSectionValue`, `DIGEST_SOURCE_BADGE`, `COLLECT_ADAPTER_TASK_KEYS`, `ADAPTER_PAYLOAD_ARRAY_KEYS` |
| Validator gate (critical) | **Before marking done:** confirm every field the adapter → push pipeline emits is declared on the **actual** `digest:addDigestSignal` args validator (`digestSignalInputValidator` → `sourceMetadataValidator`), not only a shared type that is not wired to the mutation. Add a **fixture regression test** in `digest.test.ts` matching the full Pinterest payload shape (same pattern as today's contributor `viewCount` fix). |

### Problem (current state)

| Gap | Today |
|-----|--------|
| No Pinterest adapter | Sources 1–15 wired; no ScrapeCreators Pinterest fetch script |
| Schema | `digestSourceTypeValue` / `digestSectionValue` lack `pinterest` |
| Orchestrator | `COLLECT_ADAPTER_TASK_KEYS` ends at `instagram` |
| Registry parity | 15 rows in `DIGEST_SOURCE_SECTION_MAP` / `DIGEST_SOURCE_HEALTH_REGISTRY` |
| Scoring/dedup | No `normalizeEngagement` or `SOURCE_PRIORITY` branch for Pinterest |
| Collection order | Skill/task-prompt ends at Source 15 before Perplexity |

### Target pipeline touchpoints

```text
… → hermes-run-instagram.sh (15)
  → hermes-run-pinterest.sh → fetch-pinterest-signals.mjs   ← NEW Source 16
  → hermes-run-perplexity.sh (Source 3)
  → pick-signal-notebook / §9 map / dedupe / score / push
```

**Collection order update:** `… → 14 → 15 → **16** → 3 → 6`

---

## Acceptance Criteria

### 1. Schema literals (AC: FR-1)

**Given** cns-dashboard digest signal validators
**When** extended for Pinterest
**Then** `digestSourceTypeValue` adds `v.literal('pinterest')`
**And** `digestSectionValue` adds `v.literal('pinterest')`
**And** push payloads with `sourceType`/`section` `pinterest` pass **`digest:addDigestSignal`** (the real mutation — not a standalone type export)
**And** unknown literals still rejected

**Apply in:** `cns-dashboard/convex/validators.ts` + `cns-dashboard/tests/convex/digest.test.ts`

**Validator wiring checklist (mandatory before done):**

1. Trace `digest:addDigestSignal` in `cns-dashboard/convex/digest.ts` → confirm it uses `digestSignalInputValidator`.
2. List every key written to `signal.sourceMetadata` for Pinterest in `build-digest-push-payload.mjs`.
3. Confirm each key exists on `sourceMetadataValidator` in `validators.ts`.
4. If dedupe may merge Pinterest clusters, confirm `contributingSources[]` nested validator accepts any engagement keys copied from `ENGAGEMENT_FIELDS` (today includes `upvotes`, `likes`, `viewCount`, etc. — see spec `spec-morning-digest-convex-contributor-engagement-validator.md`).
5. Add `digest.test.ts` case: build fixture from adapter test helper → call `t.mutation('digest:addDigestSignal', …)` → assert stored document matches.

### 2. ScrapeCreators HTTP client contract (AC: FR-2)

**Given** `fetch-pinterest-signals.mjs`
**When** calling ScrapeCreators
**Then** base URL `https://api.scrapecreators.com`
**And** header `x-api-key: ${SCRAPECREATORS_API_KEY}` on every request
**And** **no new npm dependencies** — Node built-in `fetch` only
**And** credentials via `mergeTrendIngestEnv()` + `resolveOperatorHome()` — key in `~/.hermes/trend-ingest.env` (already set from 72-3)
**And** never print API key to stdout/stderr/Discord
**And** HTTP timeout 15s per request; optional 100ms delay between keyword calls
**And** process **always exits 0** — failures return `{"error":"<short reason>"}` stdout (≤120 chars)
**And** reuse `classifyScrapeCreatorsHttpError` pattern from 72-3 (402 → `credit-exhausted`, 401/403 fatal)

**Credit awareness:** Log stderr one-line warning when keyword count × estimated credits per call exceeds soft threshold; do **not** hard-block cron.

### 3. Pinterest adapter stdout contract (AC: FR-2, FR-3)

**Given** `fetch-pinterest-signals.mjs`
**When** enabled and configured
**Then** stdout success shape:

```json
{
  "pins": [
    {
      "title": "Pin title trimmed",
      "description": "Pin description trimmed (optional)",
      "url": "https://www.pinterest.com/pin/123456789/",
      "link": "https://example.com/outbound-article",
      "imageUrl": "https://i.pinimg.com/...",
      "author": "pinner_username",
      "pinId": "123456789",
      "repinCount": 4200,
      "publishedAt": "2026-06-18T10:00:00.000Z"
    }
  ]
}
```

**And** stdout key is **`pins[]` only** — distinct from `videos[]`, `reels[]`, `posts[]`, `repos[]`

**Primary flow — keyword watchlist:**

- Parse `MORNING_DIGEST_PINTEREST_KEYWORDS` comma-separated
- Per keyword: `GET /v1/pinterest/search?query={keyword}&trim=true`
- Map API pin objects → stdout rows:
  - `title` ← pin title (fallback: first line of description)
  - `description` ← trimmed description when present
  - `url` ← canonical Pinterest pin URL (`id` / `url` from response)
  - `link` ← outbound destination link when present
  - `imageUrl` ← primary image URL (for Discord/display only — **do not push to Convex** unless validator extended)
  - `author` ← pinner username/display name
  - `pinId` ← stable pin id for dedupe + `externalId`
  - `repinCount` ← `repin_count` / `saves` / equivalent save count field from API
  - `publishedAt` ← when API exposes created_at / date (optional)
- Dedupe by `pinId` / canonical URL across keywords
- Respect `MORNING_DIGEST_PINTEREST_MAX_PINS` (default **15**, hard max **30**)

**Explicitly forbidden in v1:**

- `GET /v1/pinterest/board` (board pins)
- `GET /v1/pinterest/pin` (individual pin drill-down)
- `GET /v1/pinterest/user_boards` / profile endpoints
- Pagination loops beyond first page per keyword (single page per keyword in v1)

**Failure stdout examples:** `pinterest disabled`, `missing-api-key`, `missing-keywords`, `http-401`, `http-403`, `credit-exhausted`

**Exports:** `runPinterestFetch(env, options)` with injectable `fetch` + fixtures (mirror `runGithubFetch` / `runTiktokFetch`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCRAPECREATORS_API_KEY` | Shared with TikTok/Instagram | required when enabled |
| `MORNING_DIGEST_PINTEREST_KEYWORDS` | Comma-separated search queries | required when enabled |
| `MORNING_DIGEST_PINTEREST_ENABLED` | Falsy: `0`, `false`, `no`, `off` | enabled |
| `MORNING_DIGEST_PINTEREST_MAX_PINS` | Global cap after dedupe | `15` |
| `MORNING_DIGEST_PINTEREST_PER_KEYWORD` | Max pins per keyword search | `5` |
| `MORNING_DIGEST_PINTEREST_LOOKBACK_HOURS` | Client-side filter when `publishedAt` present | `168` (7d) |

### 4. Shell wrapper + Hermes contract (AC: FR-4)

**Given** `scripts/session-close/hermes-run-pinterest.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-youtube.sh` / `hermes-run-tiktok.sh`
**And** thin `exec node` on `fetch-pinterest-signals.mjs`
**And** stdout reads **`pins[]`** only

### 5. Source 16 in task-prompt.md + SKILL.md (AC: FR-4)

**Given** morning-digest task contract
**When** Source 16 is added
**Then** insert **after Source 15 (Instagram), before Source 3 (Perplexity)**
**And** update strict collection order: `… → 15 → **16** → 3 → 6`
**And** REQUIRED SOURCES checklist adds row **16 | Pinterest**
**And** Steps 9–15 gate becomes **Steps 9–16 gate** (Sources 9–16 before Source 3 / Source 6)
**And** Source 3 gate: Perplexity fires **after Source 16**

**Source 16 block includes:**

- `terminal(command="bash scripts/session-close/hermes-run-pinterest.sh", workdir=resolved_repo_root, timeout=45)`
- Imperative stdout: `pin_stdout` → `JSON.parse` → `pin_json.pins[]` only
- Failure: **Pinterest** header + `- (source unavailable: <short reason>)` → continue to Source 3
- Discord bullets: `- <title> — <repinCount> saves` (or "repins" in operator-facing copy)

**§9 mapping table** adds:

| Section | sourceType | Source data | title | summary | url | externalId |
|---------|------------|-------------|-------|---------|-----|------------|
| `pinterest` | `pinterest` | Source 16 `pins[]` | `title` | first 200 chars of `description` or `title` | `url` | `pinId` or `sha256(url).slice(0,16)` |

**§9 sourceMetadata (Convex push — validator-bound fields only):**

| stdout field | digestSignal field | Notes |
|--------------|-------------------|-------|
| `repinCount` | `sourceMetadata.upvotes` | **ProductHunt analog** — saves/repins are Pinterest's primary engagement signal |
| `author` | `sourceMetadata.author` | pinner |
| `publishedAt` | `sourceMetadata.publishedAt` | when present |
| `link` | omit from metadata | use pin `url` as signal URL; outbound link optional in summary only |

**Do not push** `imageUrl`, `description`, or `link` as top-level metadata keys unless added to `sourceMetadataValidator` first.

**digest_sources assembly** adds `"pinterest": [...]` with `repinCount` for ranking in `buildDigestSignals`

**Strict-schema unions** extend `section` and `sourceType` with `pinterest`

### 6. Orchestrator + registry parity (AC: FR-4, FR-5)

**Given** `collectAdapterOutputs()` in `scripts/run-digest-convex-completion.mjs`
**When** deterministic digest runs
**Then** add task after `instagram`:

```javascript
['pinterest', () => runWrapper('hermes-run-pinterest.sh', mergedEnv, 45_000)],
```

**And** extend `COLLECT_ADAPTER_TASK_KEYS` + `COLLECT_ADAPTER_WRAPPER_BY_KEY` in same commit

**Registry parity (72-2 guard — update ALL in one commit):**

| Location | Add |
|----------|-----|
| `DIGEST_SOURCE_SECTION_MAP` | `pinterest` row + label patterns |
| `SECTION_LITERAL_TO_SOURCE_KEY` | `pinterest` |
| `cns-dashboard/convex/lib/digest_source_registry.ts` | 16th health row |
| `cns-dashboard/convex/validators.ts` | literals |
| `cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | badge `PI` |
| `ADAPTER_PAYLOAD_ARRAY_KEYS` | add `pins` |
| `tests/digest-source-registry-parity.test.mjs` | must pass without weakening assertions |

**Verify:** `bash scripts/verify.sh` fails if any list drifts.

### 7. Scoring + dedup branches (AC: FR-5)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement` for `pinterest`
**Then** mirror **ProductHunt** weights on **`sourceMetadata.upvotes`** (mapped from `repinCount`):
- **0.75** × logNorm(upvotes, cap) + **0.25** × logNorm(commentCount, cap) when commentCount present
- When commentCount absent: **1.0** × logNorm(upvotes, `RD_UPVOTES_CAP`) — repins-only path
**And** all missing/zero repins → `null` (Path B momentum)
**And** `SOURCE_PRIOR.pinterest = 8` (discovery tier — align with producthunt/github-adjacent visual signal)
**And** `TREND_PROXY_PRIOR.pinterest = 42` (align with producthunt)
**And** extend `DigestSourceType` typedef

**Given** `dedupe-digest-signals.mjs`
**When** merge priority resolves clusters
**Then** add `pinterest: 3` to `SOURCE_PRIORITY` (same tier as `reddit: 3` — link/outbound content often overlaps headlines)
**And** ensure `upvotes` already in `ENGAGEMENT_FIELDS` — no change needed if mapping repins → upvotes

**Do not** modify merge algorithm core, rankScore weights, or disposition thresholds.

### 8. buildDigestSignals integration (AC: FR-4)

**Given** `pick-signal-notebook.mjs`
**When** `digest_sources.pinterest` present
**Then** export `extractPinterestSignals()` — top **2** titles by `repinCount` desc
**And** insert after Instagram, before title dedupe cap-10
**And** extend `signalsFromParsedInput()` guard keys

### 9. Tests + verify gate (AC: FR-5)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass including:

- `cns-dashboard/tests/convex/digest.test.ts` — **`addDigestSignal accepts pinterest signal with upvotes (repin) metadata`** — fixture must mirror exact push payload from `pinterestPinToDigestSignal` helper; call real mutation
- `cns-dashboard/tests/lib/nexus-digest-feed.test.ts` — `formatDigestSourceBadge('pinterest')` → `'PI'`
- `cns-dashboard/tests/convex/digest-source-health.test.ts` — **16** registry rows
- `tests/morning-digest-pinterest-adapter.test.mjs` (new) — config, keyword parse, pin mapping, dedupe, disabled/missing-key, 401/402 credit paths, `pinterestPinToDigestSignal` → validator-safe shape
- `tests/morning-digest-score-signals.test.mjs` (extend) — pinterest `normalizeEngagement` from upvotes
- `tests/morning-digest-push-convex.test.mjs` (extend) — sourceType passthrough
- `tests/hermes-morning-digest-skill.test.mjs` (extend) — Source 16 block, `pins[]` threading, §9 rows, collection order
- `tests/morning-digest-pick-signal-notebook.test.mjs` (extend) — extract helper
- `tests/digest-source-registry-parity.test.mjs` — green (structural)
- `tests/run-digest-convex-completion.test.mjs` (extend) — `{ error: 'credit-exhausted' }` / `{ error: 'missing-api-key' }` for Source 16
- `tests/digest-run-outcome.test.mjs` (extend) — pinterest success/error outcome counts

**And** `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper changes
**And** **no live ScrapeCreators calls in CI** — mock `fetch` with fixtures

**Mandatory pre-done validator audit (repeat from AC 1):**

```bash
# In cns-dashboard — must pass before claiming done
npm test -- tests/convex/digest.test.ts
# In Omnipotent.md
bash scripts/verify.sh
```

### 10. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** board/pin/profile drill-down integration
**And** **no** OAuth or Pinterest official API
**And** **no** new ScrapeCreators credential beyond existing `SCRAPECREATORS_API_KEY`
**And** **no** `last30days` import/subprocess
**And** TikTok/Instagram/YouTube adapters unchanged except shared env merge if needed

---

## Tasks / Subtasks

- [x] **T1** `cns-dashboard/convex/validators.ts` — `pinterest` literals (AC: 1)
- [x] **T2** `cns-dashboard/tests/convex/digest.test.ts` + badge/health tests — **full mutation fixture for Pinterest payload** (AC: 1, 9)
- [x] **T3** `fetch-pinterest-signals.mjs` + `hermes-run-pinterest.sh` (AC: 2, 3, 4)
- [x] **T4** Registry parity sweep — SECTION_MAP, HEALTH_REGISTRY, SECTION_LITERAL_TO_SOURCE_KEY, badges, `pins` in `ADAPTER_PAYLOAD_ARRAY_KEYS` (AC: 6)
- [x] **T5** `run-digest-convex-completion.mjs` — collect task + JSDoc (AC: 6)
- [x] **T6** `score-digest-signals.mjs` + `dedupe-digest-signals.mjs` (AC: 7)
- [x] **T7** `pick-signal-notebook.mjs` + `build-digest-push-payload.mjs` — extract helper + §9 mapping (AC: 8)
- [x] **T8** `task-prompt.md` + `SKILL.md` — Source 16, gates, §9, collection order (AC: 5)
- [x] **T9** Omnipotent.md + dashboard tests (AC: 9)
- [x] **T10** **Validator audit** — trace every emitted metadata field to `digestSignalInputValidator`; document in Completion Notes (AC: 1, 9)
- [x] **T11** Verify + Hermes sync (AC: 9)
  - [x] `bash scripts/verify.sh` green
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`

### Review Findings

- [x] [Review][Patch] **`buildDigestPushPayload` Pinterest path untested** [`tests/morning-digest-build-payload.test.mjs`] — Fixed: builder + canonical fixture tests; metadata keys guarded.
- [x] [Review][Patch] **Convex mutation fixture duplicated, not wired to helper** [`cns-dashboard/tests/convex/digest.test.ts:768`] — Fixed: `digest.test.ts` imports `buildCanonicalPinterestDigestSignal()` from `tests/fixtures/pinterest-digest-signal.fixture.mjs` (SSOT via production §9 builder).
- [x] [Review][Defer] **Cross-repo changes uncommitted** — Reclassified: fixture drift closed in code; commit remains operator action before merge.

---

## Dev Notes

### Cross-repo workflow (critical)

1. Schema + registry in `../cns-dashboard/`
2. Adapters + tests in Omnipotent.md
3. Verify: `bash scripts/verify.sh` from Omnipotent.md (`CNS_DASHBOARD_ROOT` to override)

### Canonical adapter pattern (mirror — do not reinvent)

| Concern | Copy from |
|---------|-----------|
| Query-watchlist loop | `fetch-github-signals.mjs`, `fetch-youtube-signals.mjs` |
| ScrapeCreators HTTP + error class | `fetch-tiktok-signals.mjs` — `classifyScrapeCreatorsHttpError`, `x-api-key`, 402 handling |
| Env merge / operator home | `fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome` |
| Shell wrapper | `hermes-run-tiktok.sh` |
| §9 + mutation fixture test | `tests/morning-digest-youtube-adapter.test.mjs` — `youtubeVideoToDigestSignal`; **`digest.test.ts` merged contributor regression** |
| Registry parity | `72-2` / `72-3` — extend all lists in **one commit** |
| Source N task-prompt | Insert 16 after 15 block in `72-3` story |

### ScrapeCreators Pinterest API reference

**Base:** `https://api.scrapecreators.com`

**Auth:** `x-api-key: SCRAPECREATORS_API_KEY`

**Search pins (v1 only):**

```http
GET /v1/pinterest/search?query=ai+agents&trim=true
x-api-key: ...
```

**MCP descriptor (manual validation):** `v1_pinterest_search` — returns pins with id, url, title, description, images, link, domain, board info, pinner details; supports cursor (skip pagination in v1).

**Response mapping hints:**

- Save count: `repin_count`, `save_count`, `saves`, or nested statistics — normalize to stdout `repinCount`
- Pinner: `pinner.username` or equivalent → `author`
- Pin id: top-level `id` → `pinId` + canonical URL construction
- Image URL: for Discord bullets only unless validator extended

**Docs:** https://docs.scrapecreators.com/openapi.json

**Skipped (document in Completion Notes, do not implement):**

- `v1_pinterest_board`
- `v1_pinterest_pin`
- `v1_pinterest_user_boards`

### Dedup implementation sketch

```javascript
function pinDedupeKey(row) {
  const pinId = String(row.pinId ?? row.id ?? '').trim();
  if (pinId) return `pin:${pinId}`;
  const url = normalizeUrl(row.url);
  if (url) return `pin:url:${url}`;
  return null;
}
```

### Validator wiring lesson (2026-06-20 — mandatory)

Today's production failure: digest collection succeeded but Convex push failed with `ArgumentValidationError: Object contains extra field viewCount` on **`contributingSources[]`**, not top-level metadata. The fix was patching the **mutation's** nested validator in `validators.ts`, plus a regression test calling `digest:addDigestSignal` directly.

**For Pinterest, before done:**

1. Implement `pinterestPinToDigestSignal()` in adapter tests.
2. Copy the exact object into `digest.test.ts` and invoke the mutation.
3. If adding any new metadata key (e.g. `repins`, `saves`, `imageUrl`), add it to `sourceMetadataValidator` **and** `contributingSources[]` nested schema if dedupe copies it.
4. Prefer mapping `repinCount` → existing `upvotes` to avoid schema churn.

Reference: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`

### WriteGate / security

- **No vault writes** — read-only HTTP adapters
- **No AGENTS.md edit** required (Operator Guide env docs optional in 72-4)
- API key env-only — never commit
- **No new npm packages**

### Files to touch

| File | Action |
|------|--------|
| `../cns-dashboard/convex/validators.ts` | UPDATE |
| `../cns-dashboard/convex/lib/digest_source_registry.ts` | UPDATE — 1 row |
| `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | UPDATE — badge `PI` |
| `../cns-dashboard/tests/convex/digest.test.ts` | UPDATE — pinterest mutation fixture |
| `../cns-dashboard/tests/convex/digest-source-health.test.ts` | UPDATE — 16 rows |
| `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-source-health.test.ts` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-pinterest-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-pinterest.sh` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` | UPDATE — `pins` key |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | UPDATE |
| `scripts/lib/digest-source-registry-parity.mjs` | UPDATE |
| `scripts/run-digest-convex-completion.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `tests/morning-digest-pinterest-adapter.test.mjs` | NEW |
| `tests/morning-digest-score-signals.test.mjs` | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |
| `tests/run-digest-convex-completion.test.mjs` | UPDATE |
| `tests/digest-run-outcome.test.mjs` | UPDATE |

**Do NOT edit:** TikTok/Instagram adapters (except shared constants), dedupe merge core, rankScore weights, Pinterest board/pin/profile endpoints

### Example operator env (`~/.hermes/trend-ingest.env`)

```bash
SCRAPECREATORS_API_KEY=sc_...   # already set from 72-3
MORNING_DIGEST_PINTEREST_KEYWORDS=ai agents,home office,mcp servers,claude ai
```

### Testing notes

- Fixture with string repin counts (coerce via `parseStatCount`)
- Duplicate pin ids across keywords — assert single output row
- Empty search response → exit 0 with `pins: []` — **not** throw
- `pinterestPinToDigestSignal` helper → `normalizeEngagement` non-null when repinCount > 0
- Parity test must fail if developer adds schema literal but forgets SECTION_MAP

---

## Previous Story Intelligence

| Story | Learning |
|-------|----------|
| **72-3** | ScrapeCreators `x-api-key`, credit stderr warning, 402 → `credit-exhausted`, distinct stdout array keys (`videos[]`, `reels[]`), classifyScrapeCreatorsHttpError |
| **72-2** | **Registry drift is the default failure mode** — patch ALL lists in one commit; parity test is structural gate |
| **72-1** | Query-watchlist adapter shape; schema before push; cross-repo verify |
| **viewCount bug (2026-06-20)** | Top-level `viewCount` was already valid — failure was **nested `contributingSources[]`** on real mutation; always test via `digest:addDigestSignal`, not validator file existence alone |
| **68-5** | Distinct stdout array key per source — Pinterest uses `pins[]` |
| **67-5** | ProductHunt upvotes → `normalizeEngagement` pattern to mirror for repins |
| **70-1** | `collectAdapterOutputs` is cron SSOT — wire orchestrator in same commit as skill |

---

## Git Intelligence

Follow Epic 72 commits: Node `.mjs` adapters, thin bash wrappers, contract tests in `hermes-morning-digest-skill.test.mjs`, registry parity in same commit as schema literals. 72-3 commit pattern: adapter + orchestrator + parity + digest.test.ts tiktok/instagram fixtures in one logical change.

---

## Latest Tech Information

**Source:** ScrapeCreators MCP descriptors + operator brief (2026-06-20)

- API base `https://api.scrapecreators.com`, auth `x-api-key` header only
- Pinterest search: `GET /v1/pinterest/search?query={keyword}` — pins with title, description, images, outbound link, pinner, saves/repin_count
- Four Pinterest endpoints exist; **only Search Pins** needed for v1 digest
- No Pinterest business account or OAuth — unofficial REST wrapper (same pattern as TikTok/Instagram)
- Reuses existing `SCRAPECREATORS_API_KEY` and credit budget from 72-3

---

## Project Context Reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — no direct AI-Context edits
- Nexus principle: `project-context.md` — adapters in Node; no last30days subprocess
- Validator bugfix spec: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`
- Verify gate: `bash scripts/verify.sh` mandatory before done
- Mutation audit: N/A (read-only adapters)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Fixed `mapPinItem` to keep outbound `link` separate from canonical pin `url` (fixture had only `link`, was mis-mapped).
- Pinterest `normalizeEngagement` returns `null` when `upvotes <= 0` (repin-only path per AC 7).

### Completion Notes List

- **Source 16 adapter:** `fetch-pinterest-signals.mjs` — keyword watchlist via `GET /v1/pinterest/search`, stdout `pins[]`, ScrapeCreators `x-api-key`, exit-0 error contract, credit stderr warning.
- **Validator audit (T10):** Pinterest push emits only `sourceMetadata.upvotes` (from `repinCount`), `author`, `publishedAt` — all declared on `sourceMetadataValidator`. `imageUrl`, `description`, `link` omitted from Convex push. `digest.test.ts` calls real `digest:addDigestSignal` mutation with full fixture.
- **Registry parity:** 16 rows across dashboard health registry, SECTION_MAP, validators, badges (`PI`), orchestrator collect task, `ADAPTER_PAYLOAD_ARRAY_KEYS` (`pins`).
- **Scoring/dedup:** `pinterest` uses ProductHunt upvotes weights; `SOURCE_PRIOR=8`, `TREND_PROXY_PRIOR=42`, `SOURCE_PRIORITY=3`.
- **Collection order:** `… → 15 → 16 → 3 → 6` in task-prompt + SKILL.md; Steps 9–16 gate.
- **Skipped v1:** board/pin/profile endpoints, pagination, OAuth — documented in story scope.
- **Verify:** `bash scripts/verify.sh` PASS; Hermes skill synced.

### File List

| File | Action |
|------|--------|
| `../cns-dashboard/convex/validators.ts` | UPDATE |
| `../cns-dashboard/convex/lib/digest_source_registry.ts` | UPDATE |
| `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | UPDATE |
| `../cns-dashboard/tests/convex/digest.test.ts` | UPDATE |
| `../cns-dashboard/tests/convex/digest-source-health.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-source-health.test.ts` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-pinterest-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-pinterest.sh` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | UPDATE |
| `scripts/lib/digest-source-registry-parity.mjs` | UPDATE |
| `scripts/run-digest-convex-completion.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `tests/morning-digest-pinterest-adapter.test.mjs` | NEW |
| `tests/morning-digest-score-signals.test.mjs` | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |
| `tests/run-digest-convex-completion.test.mjs` | UPDATE |
| `tests/digest-run-outcome.test.mjs` | UPDATE |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE |

### Change Log

- 2026-06-20: Story 72-5 — Pinterest ScrapeCreators adapter (Source 16), registry/orchestrator/skill parity, validator-bound push via `upvotes` mapping, full test coverage, verify green.

---

## Story Completion Status

- Status: **done**
- All ACs satisfied; `bash scripts/verify.sh` green; Hermes skill synced; code review patches applied (fixture SSOT)
- Next: `/bmad-code-review` in fresh chat (different LLM recommended)
