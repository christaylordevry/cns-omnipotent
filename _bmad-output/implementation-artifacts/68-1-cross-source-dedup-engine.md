---
story_id: 68-1
epic: 68
title: cross-source-dedup-engine
status: review
baseline_commit: d6de728f4b3407ee11bd9fabc96b42888599a6dd
baseline_date: 2026-06-11
operator_brief: 2026-06-11
predecessors: 64-5, 64-8, 67-5c, 67-10
blocks: 68-8
repo: Omnipotent.md + cns-dashboard
fr_ids: FR-1, FR-2, FR-3
priority: P0
---

# Story 68.1: Cross-Source Dedup Engine + Pipeline Wire

Status: done

> **Epic 68 P0 — signal-value first story.** Cross-source dedup is a quality multiplier on all eight active digest sources **before** Bluesky/X adapters add volume. Distinct from title-only `dedupeSignals()` in `pick-signal-notebook.mjs` (NotebookLM routing cap only).

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator reading the Nexus ranked digest**,
I want **duplicate stories from HackerNews, NewsAPI, RSS, GitHub, and other sources collapsed into one canonical `digestSignal` with merged provenance**,
so that **I see one high-confidence row per story with combined engagement metadata (`contributingSources`) instead of three near-identical headlines, and `rankScore` reflects aggregate community motion across sources**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup |
| **Priority** | **P0** — operator rationale: immediate quality gain on all existing sources; run **before** 68-4/68-5 social adapters |
| **Repos** | **Omnipotent.md** (dedup engine + pipeline wire) **and** **cns-dashboard** (Convex `sourceMetadata` contract) |
| **Predecessors** | **64-5** (`scoreDigestSignals` orchestrator); **64-8** (scoring stdout threading); **67-5c** (ProductHunt push validators — current eight-source push contract); **67-10** (post-scoring artifact write — dedup inserts **before** scoring, artifact remains post-scoring) |
| **Blocks** | **68-8** live validation (needs dedup clusters with `contributingSources.length ≥ 2`) |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.1 (FR-1..FR-3); `addendum.md` §A4; decision log row 6 |
| **Architecture** | ADR-E68-* not yet authored — **addendum A4 is binding** for this story; do not wait on architecture doc |
| **Out of scope** | Bluesky/X adapters (68-4..68-7); people tracking (68-2/68-3); Nexus inspector UI for `contributingSources` chips; changes to `pick-signal-notebook.mjs` `dedupeSignals()`; `normalizeEngagement` redesign; vault WriteGate; Hermes gateway |

### Operator rationale (binding)

Cross-source dedup improves signal quality across **all** existing sources immediately — before new social adapters increase feed volume. Ship **68-1 first** in Epic 68 sprint sequencing: `68-1` → `68-4` → `68-5` ∥ `68-2` → …

### Problem (current state)

Morning digest builds **one `digestSignal` per source row** in task-prompt §9 mapping, then scores and pushes. The same story routinely appears as HN + NewsAPI + RSS with no merge:

| Layer | Location | Behavior today |
|-------|----------|----------------|
| Notebook routing dedup | `pick-signal-notebook.mjs` → `dedupeSignals()` | Case-insensitive **title** cap-10 for NotebookLM pick only |
| Per-adapter dedup | e.g. `fetch-rss-signals.mjs` `dedupeEntries()` | Within-source URL/title dedup |
| Push pipeline | task-prompt §9 → `score-digest-signals.mjs` → push | **No cross-source merge** — duplicate URLs/titles push as separate Convex rows |

`sourceMetadataValidator` in cns-dashboard accepts only flat engagement fields — no `contributingSources` or `dedupClusterSize`:

```146:156:/home/christ/ai-factory/projects/cns-dashboard/convex/validators.ts
export const sourceMetadataValidator = v.object({
	comments: v.optional(v.number()),
	categories: v.optional(v.array(v.string())),
	author: v.optional(v.string()),
	publishedAt: v.optional(v.string()),
	stars: v.optional(v.number()),
	forks: v.optional(v.number()),
	upvotes: v.optional(v.number()),
	points: v.optional(v.number()),
	commentCount: v.optional(v.number())
});
```

### Target pipeline order

```text
adapters → §9 map (unscored signals[])
         → dedupe-digest-signals.mjs   ← NEW (68-1)
         → score-digest-signals.mjs
         → write-digest-push-artifact.mjs (67-10, post-scoring)
         → Discord post
         → push-digest-convex.mjs
```

**Preserve:** `pick-signal-notebook.mjs` title dedup remains orthogonal (Source 6 / NotebookLM only).

---

## Acceptance Criteria

### 1. Dedup cluster engine (FR-1)

**Given** an array of unscored `digestSignal` candidates (§9 mapping shape)
**When** `dedupeDigestSignals(signals)` runs
**Then** it returns one output signal per cluster; singletons pass through unchanged
**And** clustering follows addendum A4 priority:

1. **Normalized URL** — strip `utm_*`, `fbclid`, `www.`, query, fragment; `http`→`https`; trailing `/` (port semantics from `src/ingest/duplicate.ts` `normalizeSourceUriForDedup` — **inline equivalent in morning-digest module**, do not import from `src/`)
2. **Canonical domain + path** — merge HN redirector URLs (`news.ycombinator.com/item?id=…`) with external canonical URLs when resolvable from signal `url` fields
3. **Title fingerprint** — lowercase, collapse whitespace, strip punctuation; **Jaccard ≥ 0.85** on token sets from `tokenizeSignalText(title, summary)` (import from `score-digest-signals.mjs`)
4. **Cross-title entity match** — ≥2 shared proper-noun tokens + `publishedAt` within **24h** `[ASSUMPTION: per PRD §9]`

**And** winner selection per cluster:

1. Highest `rawEngagementProxy(signal)` (pre-score sum of available `sourceMetadata` engagement numbers — **not** `normalizeEngagement`, which may be null for newsapi/rss)
2. Tie: source priority `newsapi` > `hackernews` > `twitter` > `bluesky` > `rss` > `reddit` > `github` > `producthunt` > others
3. Tie: earliest `sourceMetadata.publishedAt` (ISO string compare; missing `publishedAt` sorts last)

**And** merged winner `sourceMetadata` includes:

```typescript
contributingSources: Array<{
  sourceType: string;
  url?: string;
  // per-source engagement snapshot — include only fields present on loser signal
  points?: number;
  upvotes?: number;
  stars?: number;
  likes?: number;      // forward-compatible for 68-6
  reposts?: number;
  // …omit keys when absent; never null
}>;
dedupClusterSize: number; // total cluster size including winner
```

**And** primary `sourceType`, `section`, `title`, `url` come from **winner**; loser engagement preserved only in `contributingSources`
**And** **never** drop an entire cluster — worst case unmergeable signals pass through as separate rows
**And** exports testable helpers (minimum): `dedupeDigestSignals`, `normalizeDigestUrl`, `titleFingerprintJaccard`, `pickClusterWinner`, `mergeClusterSignals` (names may vary; must be unit-testable without CLI)
**And** new unit tests in `tests/morning-digest-dedup-signals.test.mjs`:

| Fixture | Expected |
|---------|----------|
| HN + NewsAPI + RSS, same normalized URL | 1 signal; `contributingSources.length === 3`; `dedupClusterSize === 3` |
| HN `news.ycombinator.com` + NewsAPI external URL, same story title ≥0.85 Jaccard | 1 merged signal |
| Unrelated titles/URLs | 2+ signals unchanged |
| Cluster of 1 | No `contributingSources` key (omit) or `dedupClusterSize` omitted — **prefer omit both when size === 1** |

### 2. Pipeline integration (FR-2)

**Given** task-prompt Pre-Discord flow (build → score → artifact → Discord)
**When** implementation completes
**Then** new script `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`:

- Reads `DIGEST_SIGNALS_JSON` env (same contract as scoring CLI)
- Writes deduped JSON array to **stdout**
- Always exits **0**; stderr prefix `dedupe-digest-signals:`
- Passthrough on catastrophic failure (return input signals unchanged)

**And** task-prompt documents ordering: **adapters → map → dedup → score → artifact → Discord → push**
**And** Pre-Discord section adds **Dedupe signals before scoring (REQUIRED)** terminal block **between** §9 signal build and existing scoring terminal — agent must replace `digest_push_payload.signals` with dedupe stdout (same stdout-threading pattern as 64-8 scoring)
**And** `SKILL.md` step list updated to mention dedup terminal
**And** `tests/hermes-morning-digest-skill.test.mjs` asserts task-prompt contains `dedupe-digest-signals.mjs` and dedup-before-score ordering
**And** `bash scripts/verify.sh` green (Omnipotent.md + cns-dashboard)

**Anti-patterns (must not ship):**

- Dedup inside `pick-signal-notebook.mjs`
- Dedup after `scoreDigestSignals()` (engagement winner needs pre-score proxy)
- Dedup only on cap-10 notebook titles

### 3. Convex metadata contract (FR-3)

**Given** `cns-dashboard/convex/validators.ts`
**When** `sourceMetadataValidator` is extended
**Then** it accepts optional:

```typescript
contributingSources: v.optional(v.array(v.object({
  sourceType: v.string(),  // or digestSourceTypeValue if strict union preferred
  url: v.optional(v.string()),
  points: v.optional(v.number()),
  upvotes: v.optional(v.number()),
  stars: v.optional(v.number()),
  forks: v.optional(v.number()),
  commentCount: v.optional(v.number()),
  likes: v.optional(v.number()),
  reposts: v.optional(v.number()),
  replies: v.optional(v.number()),
  quotes: v.optional(v.number()),
  publishedAt: v.optional(v.string()),
}))),
dedupClusterSize: v.optional(v.number()),
```

**And** existing flat metadata fields remain unchanged (backward compatible)
**And** `tests/convex/digest.test.ts` adds acceptance case: push signal with `contributingSources` length 2 + `dedupClusterSize: 2` stores successfully
**And** `npx convex dev --once` from cns-dashboard exits 0

**Note:** If validator strictness on `contributingSources[].sourceType` blocks forward-compat twitter/bluesky literals before 68-4, use `v.string()` for contributor rows (document in Completion Notes).

---

## Tasks / Subtasks

- [x] **T1 — Dedup module** (AC: 1)
  - [x] Create `dedupe-digest-signals.mjs` with URL normalize (inline port of `normalizeSourceUriForDedup` + utm/fbclid strip)
  - [x] Implement union-find or incremental clustering per A4 priority
  - [x] Implement `rawEngagementProxy` + winner tie-breaks
  - [x] Implement merge preserving winner primary fields + `contributingSources`
- [x] **T2 — Unit tests** (AC: 1)
  - [x] `tests/morning-digest-dedup-signals.test.mjs` — URL merge, title Jaccard, singleton omit, 3-source cluster
- [x] **T3 — Pipeline wire** (AC: 2)
  - [x] CLI: `DIGEST_SIGNALS_JSON` → stdout
  - [x] Update `task-prompt.md` Pre-Discord section (dedup terminal + ordering comment in §9)
  - [x] Update `SKILL.md`
  - [x] Extend `tests/hermes-morning-digest-skill.test.mjs`
- [x] **T4 — cns-dashboard validator** (AC: 3)
  - [x] Extend `sourceMetadataValidator` in `convex/validators.ts`
  - [x] Add `digest.test.ts` acceptance fixture
  - [x] Run `npm test` + `npx convex dev --once` in cns-dashboard
- [x] **T5 — Verify gate** (AC: 2)
  - [x] `bash scripts/verify.sh` green from Omnipotent.md root

---

## Dev Notes

### Files to touch

| Action | Path | Repo |
|--------|------|------|
| **NEW** | `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | Omnipotent.md |
| **NEW** | `tests/morning-digest-dedup-signals.test.mjs` | Omnipotent.md |
| **UPDATE** | `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | Omnipotent.md |
| **UPDATE** | `scripts/hermes-skill-examples/morning-digest/SKILL.md` | Omnipotent.md |
| **UPDATE** | `tests/hermes-morning-digest-skill.test.mjs` | Omnipotent.md |
| **UPDATE** | `convex/validators.ts` | cns-dashboard |
| **UPDATE** | `tests/convex/digest.test.ts` | cns-dashboard |

**Do NOT edit:** `pick-signal-notebook.mjs`, `score-digest-signals.mjs` scoring formulas (unless importing shared tokenize only), `push-digest-convex.mjs` mutation logic, vault/WriteGate paths.

### URL normalization guidance

RSS adapter today uses naive lowercase trim:

```152:154:scripts/hermes-skill-examples/morning-digest/scripts/fetch-rss-signals.mjs
function normalizeUrl(url) {
  return String(url ?? '').trim().toLowerCase();
}
```

**68-1 dedup must be stricter** — port behavior from vault dedup guard:

```49:58:src/ingest/duplicate.ts
export function normalizeSourceUriForDedup(uri: string): string {
  const trimmed = uri.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeHttpUrlStringFallback(trimmed);
  }
  // ...
}
```

**Do not** add a cross-package import from `src/` into hermes scripts (no existing pattern). Copy the normalization logic into `dedupe-digest-signals.mjs` (or a colocated `digest-url-normalize.mjs` helper in the same scripts folder).

Additionally strip tracking params: `utm_*`, `fbclid` (per addendum A4) before comparison.

### Title fingerprint / Jaccard

Reuse `tokenizeSignalText` from `score-digest-signals.mjs` for consistent tokenization with scoring. Fingerprint comparison:

```javascript
// Jaccard = |A ∩ B| / |A ∪ B|  — threshold 0.85 per PRD §9 [ASSUMPTION]
```

Punctuation strip: remove non-alphanumeric except spaces before tokenize (document in test fixtures).

### `rawEngagementProxy` (pre-score winner)

Sum finite numeric engagement fields from `sourceMetadata`:

- `points`, `upvotes`, `stars`, `commentCount`, `likes`, `reposts`, `replies`, `quotes`
- Treat missing as 0; signals with all missing → proxy 0 (tie-break falls through to source priority)

Do **not** call `normalizeEngagement()` for winner pick — newsapi/rss return `null` there.

### CLI stdout threading (mirror 64-8)

```text
terminal(
  command="DEDUPE_SCRIPT=<path> DIGEST_SIGNALS_JSON=<shellQuote(JSON.stringify(digest_push_payload.signals))> node \"$DEDUPE_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=30
)
```

After return: parse stdout → if non-empty array, `digest_push_payload.signals = deduped_signals` → **then** invoke scoring terminal.

### cns-dashboard deployment note

Validator changes require cns-dashboard deploy before live digest pushes merged metadata. Coordinate with operator — same pattern as 67-5b/67-5c split. **68-1 includes validator in scope** (FR-3); dev agent runs both repo tests via `verify.sh`.

### Engagement on merged winner

Post-dedup, `scoreDigestSignals()` scores the **winner's** primary `sourceMetadata` only. Loser engagement lives in `contributingSources` for inspector/provenance — **do not** sum into `normalizeEngagement` in 68-1 (future story may aggregate; out of scope).

### Testing standards

- Omnipotent.md: node:test pattern in `tests/morning-digest-*.test.mjs`
- cns-dashboard: vitest convex tests in `tests/convex/digest.test.ts`
- No live network in unit tests
- `bash scripts/verify.sh` is the merge gate

### Project structure notes

- Morning-digest scripts mirror to `~/.hermes/skills/cns/morning-digest/` on skill install — source of truth is `scripts/hermes-skill-examples/morning-digest/`
- Cross-repo story: one logical commit per repo if operator requests commits separately

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.1, §6.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A4]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` §9, Pre-Discord scoring]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — CLI env pattern]
- [Source: `src/ingest/duplicate.ts` — URL normalization semantics (port, don't import)]
- [Source: `_bmad-output/implementation-artifacts/64-8-fix-scoring-pipeline-push-threading.md` — stdout threading pattern]
- [Source: `_bmad-output/implementation-artifacts/67-10-push-watchdog-convex-push-failure-safe.md` — artifact ordering after scoring]
- [Source: `../cns-dashboard/convex/validators.ts` — `sourceMetadataValidator`]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- Fixed proper-noun extraction to capture tokens like `OpenAI` (regex missed camelCase brands).
- Hermes skill install gate required `install-hermes-skill-morning-digest.sh` after SKILL/task-prompt changes.

### Completion Notes List

- Implemented `dedupe-digest-signals.mjs` with union-find clustering (URL, canonical domain+path, title Jaccard ≥0.85, entity match within 24h), `rawEngagementProxy` winner selection, and `contributingSources` / `dedupClusterSize` merge metadata.
- Wired Pre-Discord pipeline: adapters → map → **dedup** → score → artifact → Discord → push in `task-prompt.md` and `SKILL.md`.
- Extended `sourceMetadataValidator` with optional `contributingSources` (uses `v.string()` for `sourceType` on contributor rows for twitter/bluesky forward-compat) and `dedupClusterSize`.
- Code review patches (2026-06-11): HN `item?id=` URLs now preserve `id` during normalization; `isHnRedirectorUrl` checks raw URL; regression test for distinct HN items; `comments` added to `rawEngagementProxy`.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` (NEW)
- `tests/morning-digest-dedup-signals.test.mjs` (NEW)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/hermes-morning-digest-skill.test.mjs`
- `../cns-dashboard/convex/validators.ts`
- `../cns-dashboard/tests/convex/digest.test.ts`

### Change Log

- 2026-06-11: Story 68-1 — cross-source dedup engine, pipeline wire, Convex metadata contract (FR-1..FR-3).

### Review Findings

- [x] [Review][Patch] HN item URLs collapse after query strip — all `news.ycombinator.com/item?id=*` normalize to `https://news.ycombinator.com/item`, so unrelated HN stories merge via normalized-URL rule (verified: two distinct titles → `dedupe len 1`). [dedupe-digest-signals.mjs:98-114,279-284] — fixed: preserve `id` in `normalizeHnItemUrl`
- [x] [Review][Patch] `isHnRedirectorUrl` checks post-normalize URL; `?id=` is already stripped so rule-3 HN+external branch never fires (HN+NewsAPI test passes only via title Jaccard). Preserve HN `id` in normalize or test raw URL before strip. [dedupe-digest-signals.mjs:270-297] — fixed: raw URL check before normalize
- [x] [Review][Patch] Missing regression test: two unrelated HN `item?id=` URLs with different titles must remain separate signals. [tests/morning-digest-dedup-signals.test.mjs] — fixed
- [x] [Review][Patch] `rawEngagementProxy` omits `comments` field accepted by `sourceMetadataValidator` — minor winner tie-break gap. [dedupe-digest-signals.mjs:22-32,314-327] — fixed
- [x] [Review][Defer] Entity match merges distinct stories sharing ≥2 proper nouns within 24h — spec-compliant per AC #1 rule 4 / addendum A4; quality tradeoff deferred. [dedupe-digest-signals.mjs:242-264] — deferred, pre-existing design choice
- [x] [Review][Defer] Union-find transitive title clustering can merge A–C when only A–B and B–C exceed Jaccard threshold — inherent to incremental clustering; acceptable for v1. [dedupe-digest-signals.mjs:465-472] — deferred, pre-existing design choice
