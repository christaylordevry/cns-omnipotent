---
story_id: 65-8
epic: 65
title: build-digest-signals-github-reddit-caps
status: review
baseline_commit: 56157f9
operator_brief: 2026-06-09
predecessors: 65-1, 65-3, 65-4, 65-7
source: epic-65-retro-2026-06-09 T3
---

# Story 65.8: `buildDigestSignals` GitHub/Reddit cap slots (architecture §7.3)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator whose morning digest routes NotebookLM queries via signal scoring**,
I want **`buildDigestSignals()` to include top GitHub repo titles and top Reddit post titles in the cap-10 NotebookLM routing pool**,
so that **Epic 65 adapter data (Sources 7–8) influences notebook pick the same way arXiv, HN, and RSS already do, completing the deferred §7.3 slot budget from 65-1/65-3/65-4**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 65: Native Source Adapter Expansion v1 — **65-8 closes retro action T3** (technical debt row in `epic-65-retro-2026-06-09.md`) |
| **Repo** | **Omnipotent.md only** — `pick-signal-notebook.mjs`, `task-prompt.md`, unit tests; **no** cns-dashboard, adapter fetch scripts, or scoring formula changes |
| **Predecessors** | **65-1** (GitHub adapter + `digest_sources.github` shape); **65-3** (Reddit adapter + `digest_sources.reddit` shape); **65-4** (RSS top-1 in `buildDigestSignals` — **mirror pattern**); **65-7** (Sources 7–9 stdout threading — `digest_sources` assembly now reliable) |
| **Normative spec** | `architecture-epic-65-native-source-adapters.md` **§7.3** (cap-10 source-order); **§7.1** (`digest_sources` JSON keys) |
| **Retro origin** | Epic 65 retro T3: *"`buildDigestSignals` github/reddit cap slots (architecture §7.3) — NotebookLM routing includes top-N from new sources"* |
| **Out of scope** | Rebalancing trends/headlines/perplexity caps (pre-existing drift vs §7.3 prose — **do not change** `MAX_TREND_KEYWORDS`, `MAX_HEADLINE_TITLES`, `MAX_PERPLEXITY_SIGNALS` in this story); scoring/`rankScore` changes; adapter fetch logic; Discord output sections; Convex schema; Hermes SKILL orchestration beyond doc sync for `buildDigestSignals` order string |

### Problem (current state)

`pick-signal-notebook.mjs` `buildDigestSignals()` assembles NotebookLM routing candidates from `digest_sources` but **ignores `github` and `reddit` keys entirely**. RSS top-1 landed in 65-4; github/reddit were explicitly deferred.

Current assembly order (lines 214–245):

```214:245:scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
export function buildDigestSignals(sources = {}) {
  // trends → headlines → perplexity → arxiv → hackernews → rss
  ordered.push(...extractRssSignals(sources.rss));
  return dedupeSignals(ordered);
}
```

**Gaps vs §7.3:**

| Slot | Architecture §7.3 | Current code |
|------|-------------------|--------------|
| github | top **2** by `stars` | **missing** |
| reddit | top **2** by `upvotes` | **missing** |
| rss | top **1** (after github/reddit) | present but **inserted before github/reddit would be** — order must become HN → github → reddit → rss |

`signalsFromParsedInput()` object guard (lines 389–401) checks `trends`, `headlines`, `perplexityText`, `arxiv`, `hackernews` but **not** `github`, `reddit`, or `rss` — a payload with only `github`/`reddit`/`rss` incorrectly falls through to `dedupeSignals(parsed)` instead of `buildDigestSignals()`.

`task-prompt.md` Source 6 bullet (line 267) documents order ending at RSS — **omits github/reddit**.

### What already works (do not reimplement)

| Component | State |
|-----------|-------|
| `fetch-github-signals.mjs` | stdout `repos[]` with `title`, `stars`, `forks`, `url` |
| `fetch-reddit-signals.mjs` | stdout `posts[]` with `title`, `upvotes`, `commentCount`, `url` |
| `task-prompt.md` `digest_sources` example | includes `github` and `reddit` keys with engagement numbers |
| `extractRssSignals` | sort by `publishedAt`, cap 1 — **template for ranking helpers** |
| `extractArxivSignals` / `extractHnSignals` | slice-first without engagement sort — github/reddit need **engagement sort** per §7.3 |
| Scoring / push | `rankScore` SSOT unchanged — this story only affects NotebookLM **pick** input |

## Acceptance Criteria

### 1. `extractGithubSignals` — top 2 by stars (AC: §7.3 github slice)

**Given** `pick-signal-notebook.mjs`
**When** `extractGithubSignals(githubList)` is exported
**Then** it accepts `Array<{ title?: string, stars?: number }>`
**And** sorts by `stars` descending (missing/non-finite `stars` → 0)
**And** returns up to **2** non-empty trimmed `title` strings
**And** skips entries with blank/missing titles without throwing

### 2. `extractRedditSignals` — top 2 by upvotes (AC: §7.3 reddit slice)

**Given** the same module
**When** `extractRedditSignals(redditList)` is exported
**Then** it accepts `Array<{ title?: string, upvotes?: number }>`
**And** sorts by `upvotes` descending (missing/non-finite `upvotes` → 0)
**And** returns up to **2** non-empty trimmed `title` strings
**And** skips entries with blank/missing titles without throwing

### 3. `buildDigestSignals` source-order fix (AC: §7.3 full order)

**Given** `buildDigestSignals(sources)`
**When** any combination of source keys is present
**Then** assembly order is:

1. trends (unchanged)
2. headlines (unchanged)
3. perplexity-derived (unchanged)
4. arxiv (unchanged)
5. hackernews (unchanged)
6. **github** — `extractGithubSignals(sources.github)`
7. **reddit** — `extractRedditSignals(sources.reddit)`
8. **rss** — `extractRssSignals(sources.rss)` (unchanged logic, **moved after github/reddit**)

**And** `dedupeSignals()` still caps final output at **10** with case-insensitive first-wins dedupe
**And** empty/missing `github`/`reddit` arrays contribute nothing (no throw)
**And** JSDoc on `buildDigestSignals` `sources` param extended with `github` and `reddit` array shapes

### 4. `signalsFromParsedInput` guard (AC: CLI / env path)

**Given** `signalsFromParsedInput(parsed)`
**When** parsed object contains only `github`, `reddit`, and/or `rss` keys (with or without other digest keys)
**Then** it routes through `buildDigestSignals()` — not `dedupeSignals(parsed)`
**And** guard condition adds `'github' in parsed`, `'reddit' in parsed`, `'rss' in parsed` (mirror existing key checks)

### 5. Unit tests (AC: regression lock)

**Given** `tests/morning-digest-pick-signal-notebook.test.mjs`
**When** tests run via `npm test`
**Then** new coverage includes:

| Test | Assertion |
|------|-----------|
| `extractGithubSignals` ranks by stars desc, caps at 2 | highest-star titles win |
| `extractRedditSignals` ranks by upvotes desc, caps at 2 | highest-upvote titles win |
| Order: github after HN | `hackernews` index < `github` title index |
| Order: reddit after github | github index < reddit title index |
| Order: rss after reddit | reddit index < rss title index |
| Dedupe: headline wins over github title | case-insensitive, length 1 |
| Cap-10 with all sources populated | `signals.length === 10`, includes github + reddit + rss picks |
| `extractGithubSignals` / `extractRedditSignals` empty arrays | return `[]` |
| `buildDigestSignals({ github: [] })` only | returns `[]` (via guard + empty extract) |

**And** existing `buildDigestSignals` / RSS / HN / arXiv tests remain green (update order assertions if rss-after-reddit shift breaks index checks)

### 6. Task-prompt doc sync (AC: Hermes contract)

**Given** `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` Source 6 assembly bullet
**When** documentation is updated
**Then** the `buildDigestSignals` order string reads:

`trends → headlines → Perplexity-derived phrases (up to 3) → arXiv titles (up to 3) → HackerNews titles (up to 3) → GitHub repo titles (up to 2, highest stars) → Reddit post titles (up to 2, highest upvotes) → RSS title (up to 1, most recent by publishedAt when available)`

**And** case-insensitive dedupe + cap **10** language preserved
**And** no changes to §9 push mapping, Source 7–9 fetch bullets, or scoring terminal sections

### 7. Verify gate (AC: FR-16 pattern)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs from Omnipotent.md
**Then** all tests pass
**And** run `bash scripts/install-hermes-skill-morning-digest.sh` after `pick-signal-notebook.mjs` or `task-prompt.md` edits (rsync mirror to `~/.hermes/skills/cns/morning-digest/`)

## Tasks / Subtasks

- [x] **T1** Add `MAX_GITHUB_SIGNALS = 2`, `MAX_REDDIT_SIGNALS = 2` constants (AC: 1, 2)
- [x] **T2** Implement and export `extractGithubSignals` + `extractRedditSignals` with engagement sort (AC: 1, 2)
- [x] **T3** Extend `buildDigestSignals` — insert github/reddit slices; move rss after both (AC: 3)
- [x] **T4** Extend `signalsFromParsedInput` guard for `github`/`reddit`/`rss` keys (AC: 4)
- [x] **T5** Add/extend tests in `tests/morning-digest-pick-signal-notebook.test.mjs` (AC: 5)
- [x] **T6** Update `task-prompt.md` Source 6 `buildDigestSignals` order bullet (AC: 6)
- [x] **T7** `bash scripts/install-hermes-skill-morning-digest.sh`; `bash scripts/verify.sh` green (AC: 7)

### Review Findings

- [x] [Review][Defer] `signalsFromParsedInput` guard path untested for github/reddit/rss-only payloads [`pick-signal-notebook.mjs:439-455`] — deferred, AC4 satisfied in code; CLI regression test optional hardening
- [x] [Review][Defer] Title-less top-N-by-engagement entries consume slice slots without backfill [`pick-signal-notebook.mjs:183-188,205-210`] — deferred, matches `extractRssSignals` pattern; AC allows "up to 2"
- [x] [Review][Defer] Cap-10 eviction can exclude github/reddit/rss when upstream sources fill pool [`pick-signal-notebook.mjs:262-295`] — deferred, architectural §7.3 priority order (new sources lowest)

## Dev Notes

### Architecture compliance (§7.3 — binding)

```553:568:_bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md
### 7.3 `buildDigestSignals` cap-10 allocation (resolves PRD §8 OQ-3)

Extend `buildDigestSignals()` source-order (lowest priority last):
1. trends (top 3 by `normalizedValue`)
2. headlines (top 2)
3. perplexity (top 2 sentences)
4. arxiv (existing cap)
5. hackernews (existing cap)
6. **github (top 2 by stars)**
7. **reddit (top 2 by upvotes)** — when present
8. **rss (top 1)**

Then `dedupeSignals()` → max 10 titles for NotebookLM routing.
```

**Intentional scope boundary:** Steps 1–3 use higher caps in live code (`MAX_TREND_KEYWORDS = 5`, `MAX_HEADLINE_TITLES = 5`, `MAX_PERPLEXITY_SIGNALS = 3`) — pre-dates Epic 65 and is **out of scope** for 65-8. This story only closes the **github/reddit** deferral and fixes **rss placement** after them.

**Ranking SSOT reminder:** `buildDigestSignals` order affects NotebookLM pick only. Nexus cockpit ranking uses `rankScore` after `scoreDigestSignals` — do not conflate the two.

### Implementation sketch (normative)

Mirror `extractRssSignals` sort pattern but rank on engagement:

```javascript
const MAX_GITHUB_SIGNALS = 2;
const MAX_REDDIT_SIGNALS = 2;

export function extractGithubSignals(githubList) {
  if (!Array.isArray(githubList)) return [];
  const sorted = [...githubList].sort(
    (a, b) => (Number(b?.stars) || 0) - (Number(a?.stars) || 0),
  );
  const out = [];
  for (const entry of sorted.slice(0, MAX_GITHUB_SIGNALS)) {
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    if (title) out.push(title);
  }
  return out;
}

// extractRedditSignals: same pattern with upvotes + MAX_REDDIT_SIGNALS
```

In `buildDigestSignals`, replace the single `extractRssSignals` call with:

```javascript
ordered.push(...extractHnSignals(sources.hackernews));
ordered.push(...extractGithubSignals(sources.github));
ordered.push(...extractRedditSignals(sources.reddit));
ordered.push(...extractRssSignals(sources.rss));
```

### `signalsFromParsedInput` fix (required for CLI)

```389:401:scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
function signalsFromParsedInput(parsed) {
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    ('trends' in parsed ||
      'headlines' in parsed ||
      'perplexityText' in parsed ||
      'arxiv' in parsed ||
      'hackernews' in parsed)
  ) {
```

Add `'github' in parsed || 'reddit' in parsed || 'rss' in parsed` to the guard.

### Test fixture hints

**Github sort test:**

```javascript
extractGithubSignals([
  { title: 'low-star/repo', stars: 10 },
  { title: 'high-star/repo', stars: 9999 },
  { title: 'mid-star/repo', stars: 500 },
]);
// → ['high-star/repo', 'mid-star/repo']
```

**Order test** (extend existing "places RSS title after HN" — now rss must be after reddit):

```javascript
buildDigestSignals({
  hackernews: [{ title: 'HN Story' }],
  github: [{ title: 'gh-low', stars: 1 }, { title: 'gh-high', stars: 100 }],
  reddit: [{ title: 'rd-low', upvotes: 1 }, { title: 'rd-high', upvotes: 50 }],
  rss: [{ title: 'Newsletter', publishedAt: '2026-06-09T00:00:00.000Z' }],
});
// index order: HN < gh-high < rd-high < Newsletter
```

**Breaking test change risk:** `places RSS title after HN titles in order` (line ~281) asserts `hnIdx < rssIdx` — still true, but add assertions that github/reddit sit between HN and RSS.

### Files to touch

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE — constants, extractors, `buildDigestSignals`, `signalsFromParsedInput`, JSDoc |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE — import new exports; add order/sort/cap tests |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE — Source 6 `buildDigestSignals` order bullet only |

**Do NOT edit:** `fetch-github-signals.mjs`, `fetch-reddit-signals.mjs`, `score-digest-signals.mjs`, `SKILL.md` (unless audit finds stale `buildDigestSignals` mention — optional one-line sync only if clearly wrong; 65-7 already references github/reddit in digest assembly)

### Previous story intelligence

| Story | Learning relevant to 65-8 |
|-------|---------------------------|
| **65-4** | Established `extractRssSignals` + `buildDigestSignals` integration pattern; explicitly deferred github/reddit — **this story completes that gap** |
| **65-1 / 65-3** | Adapter stdout shapes stable; engagement fields at adapter row level (`stars`, `upvotes`) match what extractors must sort on |
| **65-7** | `digest_sources.github` / `.reddit` assembly is now reliable in live runs — notebook routing was the remaining gap |
| **61-4 / 56-4** | `dedupeSignals` first-wins + cap 10 is long-standing; preserve behavior |

### Git intelligence (recent Epic 65 commits)

| Commit | Relevance |
|--------|-----------|
| `56157f9` 65-7 stdout threading | Sources 7–8 data reaches `digest_sources` — prerequisite for meaningful github/reddit notebook signals |
| `aa26222` 65-4 RSS | `extractRssSignals` landed — copy sort/cap structure |
| `e751756` 65-3 Reddit | `posts[].upvotes` contract stable |
| 65-1 GitHub | `repos[].stars` contract stable |

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — no WriteGate / vault mutations in this story
- Verify gate: `bash scripts/verify.sh` mandatory before done
- Deferred work: closes retro T3 row; does **not** close Discord output sections (separate story) or trends/headlines cap rebalance

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md` §7.1, §7.3]
- [Source: `_bmad-output/implementation-artifacts/epic-65-retro-2026-06-09.md` — Technical Debt T3]
- [Source: `_bmad-output/implementation-artifacts/65-4-rss-adapter.md` — buildDigestSignals gap note]
- [Source: `_bmad-output/implementation-artifacts/65-1-digest-source-types-github-adapter.md` — defer note]
- [Source: `_bmad-output/implementation-artifacts/65-3-reddit-credential-adapter.md` — §7.3 defer note]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`]
- [Source: `tests/morning-digest-pick-signal-notebook.test.mjs`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- Added `extractGithubSignals` (top 2 by `stars`) and `extractRedditSignals` (top 2 by `upvotes`) mirroring `extractRssSignals` engagement-sort pattern.
- Fixed `buildDigestSignals` source order: HN → github → reddit → rss (§7.3).
- Extended `signalsFromParsedInput` guard for `github`/`reddit`/`rss` keys.
- Updated `task-prompt.md` Source 6 assembly order bullet.
- 8 new unit tests; 713/713 pass; `verify.sh` green; Hermes skill mirrored.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `tests/morning-digest-pick-signal-notebook.test.mjs`

### Change Log

- 2026-06-09: Story 65-8 — `buildDigestSignals` github/reddit cap slots + rss order fix (retro T3).
