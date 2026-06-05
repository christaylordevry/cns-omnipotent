---
story_id: 62-1
epic: 62
title: keyword-candidates-from-digest-signals
status: done
baseline_commit: 0fd5b4e1573941bdedc671e97aff0d53fb22b64d
operator_brief: 2026-06-05
predecessors: 61-5, 56-5, 61-3
---

# Story 62.1: Keyword candidates Convex table + generation from digest signals

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator building a Signal Seeds workflow**,
I want **morning-digest runs to upsert ranked keyword candidates into Convex derived from the same digest signal payload that populates `digestSignals`**,
so that **Phase 1 of Signal Seeds has a reusable data layer (top candidates by score) without new ingestion pipelines or dashboard UI**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 62: Signal Seeds (Phase 1 — data layer) |
| **Predecessors** | **61-5** (`digestRuns`/`digestSignals`, `push-digest-convex.mjs`, SKILL v1.2.9); **56-5** (`convexTest` + validators pattern); **61-3** (`mergeTrendIngestEnv` / `resolveOperatorHome` for env reads) |
| **Repos touched** | `cns-dashboard/convex/` (schema + module + tests) **and** `Omnipotent.md/scripts/hermes-skill-examples/morning-digest/` (push script + task-prompt + SKILL) |
| **Pattern** | HTTP `POST /api/mutation` with `Authorization: Convex ${CONVEX_DEPLOY_KEY}` — reuse transport from `push-digest-convex.mjs`; **always exit 0** on failure (graceful degradation) |
| **Input source** | **`DIGEST_PUSH_JSON`** payload (same shape as 61-5) — extract from `signals[]` **before/alongside** Convex insert; do **not** add a Convex query round-trip in Phase 1 |
| **Parity** | `morning-digest` is a parity skill — after Omnipotent.md edits run `bash scripts/install-hermes-skill-morning-digest.sh` and confirm `diff -rq` clean |
| **Out of scope** | Dashboard Svelte UI; accept/dismiss UX; NLP tokenization of titles; `digest_history` backfill job; multi-tenant `workspaceId` enforcement; modifying `signalEvents` / trend-ingest path |

### Operator brief (binding)

1. Add **`keywordCandidates`** table to `cns-dashboard/convex/schema.ts`.
2. Add mutation **`upsertKeywordCandidate`** and query **`getTopCandidates`** in `cns-dashboard/convex/keywordCandidates.ts` (flat module — same layout as `digest.ts`, **not** `mutations/` subfolder).
3. New script: `scripts/hermes-skill-examples/morning-digest/scripts/push-keyword-candidates.mjs`.
4. Runs **after** `push-digest-convex.mjs` in task-prompt post-post chain.
5. Extracts terms from digest signal payload: **Google Trends keywords**, **HN titles**, **arXiv titles** (omit headlines/deep_signal in Phase 1).
6. Scores each candidate: `google_trends_score * 0.4 + recency * 0.3 + seenCount * 0.3` (see Dev Notes for non-trends defaults).
7. Calls `upsertKeywordCandidate` via HTTP for each extracted term.
8. **Graceful degradation:** any failure → stderr warning, exit **0** (never abort Hermes task).
9. `SKILL.md` bumped to **v1.3.0**.
10. `npm test` green (**642+** Omnipotent.md baseline), `bash scripts/verify.sh` green (includes `cns-dashboard npm test`).

## Acceptance Criteria

### 1. Convex schema — `keywordCandidates` (AC: schema)

**Given** `cns-dashboard/convex/schema.ts` is updated  
**Then** a `keywordCandidates` table exists with fields:

| Field | Type | Notes |
|-------|------|-------|
| `term` | `string` | Normalized lowercase dedupe key (trim + lowercase) |
| `displayTerm` | `string` | Original casing for UI |
| `sourceType` | `string` | `"google_trends"` \| `"newsapi"` \| `"arxiv"` \| `"hackernews"` \| `"digest_history"` |
| `score` | `number` | Heuristic composite (see AC: scoring) |
| `category` | `string` | `"trending"` \| `"personal"` \| `"adjacent"` |
| `firstSeenAt` | `number` | Unix ms — set on first insert only |
| `lastSeenAt` | `number` | Unix ms — updated every upsert |
| `seenCount` | `number` | Integer ≥ 1 — incremented on each upsert for same `term` |
| `accepted` | `boolean` | Default `false`; preserved on upsert unless args override |
| `dismissed` | `boolean` | Default `false`; preserved on upsert unless args override |
| `workspaceId` | optional `string` | Nullable stub — omit/`undefined` for operator/personal |

**And** add index `by_term` on `['term']` for upsert lookup  
**And** add index `by_dismissed_score` on `['dismissed', 'score']` for ranked feed queries  
**And** validators live in `convex/validators.ts` (`keywordCandidateRowValidator`, `keywordCandidateUpsertValidator`, enum validators for `sourceType`, `category`)  
**And** do **not** modify `digestRuns`, `digestSignals`, `signalEvents`, or trend-ingest tables

### 2. Convex mutation — `upsertKeywordCandidate` (AC: mutation)

**Then** `cns-dashboard/convex/keywordCandidates.ts` exports a **public** mutation callable via HTTP API:

| Mutation | Args (summary) | Returns |
|----------|----------------|---------|
| `upsertKeywordCandidate` | `candidate`: upsert fields (`term`, `displayTerm`, `sourceType`, `score`, `category`, optional `workspaceId`, optional `accepted`/`dismissed` overrides) | `Id<"keywordCandidates">` |

**And** `term` is normalized server-side: `trim().toLowerCase()` before lookup/insert  
**And** lookup uses `by_term` index with normalized `term` (workspace scoping deferred — match on `term` only in Phase 1)  
**And** on **existing row**: increment `seenCount`, set `lastSeenAt = Date.now()`, patch `score`, `displayTerm`, `sourceType`, `category` from args; **preserve** `accepted`/`dismissed`/`firstSeenAt` unless args explicitly pass overrides  
**And** on **new row**: insert with `firstSeenAt = lastSeenAt = Date.now()`, `seenCount = 1`, `accepted = false`, `dismissed = false` unless args override  
**And** mutation uses `args` + `returns` validators per Convex plugin rules  
**And** `Date.now()` allowed in mutation (not in queries)

### 3. Convex query — `getTopCandidates` (AC: query)

**Then** `getTopCandidates` is a **public** query:

| Query | Args | Returns |
|-------|------|---------|
| `getTopCandidates` | `limit?: number` (default 10, max 50) | Array of `keywordCandidateRowValidator` rows |

**And** returns candidates where `dismissed === false`, ordered by `score` descending, limited to `limit`  
**And** uses index `by_dismissed_score` with `dismissed = false` and `.order('desc')` on score  
**And** query has `args` + `returns` validators  
**And** **no `Date.now()`** in query handler (static ranking only)

### 4. Scoring contract (AC: scoring)

**Given** a digest signal extracted for candidate generation  
**When** computing `score` before upsert  
**Then** apply:

```text
score = (trendComponent * 0.4) + (recency * 0.3) + (seenCountComponent * 0.3)
```

Where:

| Component | google_trends | hackernews | arxiv |
|-----------|---------------|------------|-------|
| `trendComponent` | `signal.score` (normalizedValue 0–1) or `0` if missing | `min(signal.score / 500, 1)` when HN pts present, else `0.3` | `0.25` fixed prior |
| `recency` | `1.0` for current digest run (use `run.ranAt` / `digest_start_ms` as "now" anchor — all signals in one push share recency `1.0`) | same | same |
| `seenCountComponent` | On **first** upsert for term: use `1` normalized as `min(seenCount / 10, 1)` → `0.1`; mutation recomputes stored `score` using **post-upsert** `seenCount` | same | same |

**And** category mapping (Phase 1 heuristic):

| sourceType | category |
|------------|----------|
| `google_trends` | `trending` |
| `newsapi` | `personal` (reserved — not extracted in Phase 1 push script) |
| `hackernews` | `adjacent` |
| `arxiv` | `adjacent` |
| `digest_history` | `personal` (reserved — mutation accepts; push script does not emit) |

**And** push script passes computed `score` to mutation; mutation stores the provided score (may refine using updated `seenCount` on upsert — see Dev Notes)

### 5. Push script `push-keyword-candidates.mjs` (AC: push-script)

**Given** env `DIGEST_PUSH_JSON` contains the same payload shape as 61-5 (`{ run, signals[] }`)  
**When** `node scripts/hermes-skill-examples/morning-digest/scripts/push-keyword-candidates.mjs` runs  
**Then** it:

1. Resolves Convex env via `mergeTrendIngestEnv` → import from `./fetch-arxiv-rss.mjs` — **never** `import { homedir } from 'node:os'` for env path resolution
2. Missing `CONVEX_URL` / `CONVEX_DEPLOY_KEY` → stderr `push-keyword-candidates: skipped — missing CONVEX_URL or CONVEX_DEPLOY_KEY`, exit **0**
3. Parses payload via shared reader (import `readDigestPushPayload` from `./push-digest-convex.mjs` or duplicate minimal reader — prefer **import reuse**)
4. Extracts candidate terms from `signals[]`:

| sourceType | Extract | term | displayTerm |
|------------|---------|------|-------------|
| `google_trends` | each trends signal | `title.toLowerCase().trim()` | `title` trimmed |
| `hackernews` | each HN signal | normalized title | `title` trimmed |
| `arxiv` | each arxiv signal | normalized title | `title` trimmed |

5. Deduplicates by `term` within the run (keep highest `trendComponent` signal if collision)
6. Computes `score` per AC: scoring using `run.ranAt` as recency anchor
7. Calls `keywordCandidates:upsertKeywordCandidate` via HTTP for each unique term
8. On **any** HTTP/mutation failure → stderr `push-keyword-candidates: warning — <reason>`, exit **0**

**And** exported testable functions: `extractKeywordCandidates(payload)`, `scoreKeywordCandidate(opts)`, `pushKeywordCandidatesToConvex(opts)`  
**And** HTTP shape:

```json
{
  "path": "keywordCandidates:upsertKeywordCandidate",
  "args": { "candidate": { "...": "..." } },
  "format": "json"
}
```

**And** reuses `postMutation` / `normalizeConvexUrl` pattern from `push-digest-convex.mjs` (extract shared helper to a small `convex-http.mjs` **only if** duplication exceeds ~40 lines — otherwise copy inline like 61-5)

### 6. Morning digest integration (AC: task-prompt)

**Given** the digest Convex push step (`push-digest-convex.mjs`) has been invoked  
**When** Hermes completes the digest per updated `references/task-prompt.md`  
**Then** a **subsequent post-post step** invokes:

```text
terminal(
  command="CANDIDATES_SCRIPT=<shellQuote(candidates_script)> DIGEST_PUSH_JSON=<shellQuote(JSON.stringify(digest_push_payload))> node \"$CANDIDATES_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=45
)
```

Where:

```text
candidates_script = resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/push-keyword-candidates.mjs"
```

**And** reuses the **same** `digest_push_payload` built for digest push (no second payload assembly)  
**And** runs on **every** digest run (success or partial failure) — same completion posture as digest push (mandatory invocation, fire-and-forget result)  
**And** failure does **not** edit Discord, does **not** fail the skill, does **not** post operator warning (stderr only)  
**And** emit optional stderr JSON:

```json
{"keyword_candidates_push":{"status":"ok|skipped-env|invalid-input|failed","exit_code":0,"upserted":3,"reason":"..."}}
```

**And** `SKILL.md` version **1.3.0** documents step 11 (after digest Convex push); policy adds keyword-candidates push bullet  
**And** Allowed tools table includes `push-keyword-candidates.mjs`

### 7. Scope guards (AC: scope)

**Then** no new dashboard UI components in `cns-dashboard/src/`  
**And** no changes to `push-digest-convex.mjs` graceful contract (still exit 0) beyond optional shared helper extraction if chosen  
**And** no changes to `signalEvents` ingest path  
**And** `workspaceId` accepted but never enforced  
**And** Constitution WriteGate not triggered (no vault writes)

### 8. Tests + verify gate (AC: test)

**cns-dashboard** — NEW `tests/convex/keywordCandidates.test.ts`:
- Schema defines `keywordCandidates` table + indexes
- `upsertKeywordCandidate` insert → returns id, row has `seenCount: 1`, `accepted: false`, `dismissed: false`
- Second upsert same `term` → same id, `seenCount: 2`, `lastSeenAt` updated, `firstSeenAt` unchanged
- `getTopCandidates` → returns non-dismissed rows ordered by score desc, respects limit
- Dismissed row excluded from `getTopCandidates`

**Omnipotent.md** — NEW `tests/morning-digest-push-keyword-candidates.test.mjs`:
- `extractKeywordCandidates` pulls trends + HN + arxiv; skips headlines/deep_signal
- Dedupes by normalized term within payload
- Missing Convex env → skipped, exit 0, no fetch
- Happy path mock fetch → N upsert calls with path `keywordCandidates:upsertKeywordCandidate`
- HTTP 500 on upsert → stderr warning, exit 0
- `scoreKeywordCandidate` formula spot-check for google_trends vs arxiv

**Omnipotent.md** — UPDATE `tests/hermes-morning-digest-skill.test.mjs`:
- Asserts `push-keyword-candidates.mjs` in task-prompt post-post section (after digest push)
- Asserts reuse of `DIGEST_PUSH_JSON`
- Asserts SKILL v1.3.0

**Then** `npm test` reports **642+** passing (net +new tests)  
**And** `bash scripts/verify.sh` passes including `cns-dashboard npm test`

## Tasks / Subtasks

- [x] **T1** `cns-dashboard/convex/validators.ts` — add enum validators + `keywordCandidateRowValidator`, `keywordCandidateUpsertValidator` (AC: 1)
- [x] **T2** `cns-dashboard/convex/schema.ts` — register `keywordCandidates` + indexes (AC: 1, 7)
- [x] **T3** `cns-dashboard/convex/keywordCandidates.ts` — `upsertKeywordCandidate` + `getTopCandidates` (AC: 2, 3)
- [x] **T4** `cns-dashboard/tests/convex/keywordCandidates.test.ts` — convexTest coverage (AC: 8)
- [x] **T5** `scripts/.../push-keyword-candidates.mjs` — NEW push script with graceful exit 0 (AC: 4, 5)
- [x] **T6** `references/task-prompt.md` — post-post keyword candidates step after digest push (AC: 6)
- [x] **T7** `SKILL.md` v1.3.0 — execution step 11, policy update (AC: 6)
- [x] **T8** `tests/morning-digest-push-keyword-candidates.test.mjs` + `tests/hermes-morning-digest-skill.test.mjs` updates (AC: 8)
- [x] **T9** `bash scripts/install-hermes-skill-morning-digest.sh`; `diff -rq` parity; `bash scripts/verify.sh` (AC: 8)

### Review Findings

- [x] [Review][Decision] Score refinement on repeat upsert — resolved: added `trendComponent` to upsert validator; mutation recomputes score from post-upsert `seenCount`.
- [x] [Review][Patch] Partial upsert failure reports `upserted: 0` [push-keyword-candidates.mjs:197-208] — fixed: loop tracks partial `upserted` count before catch.
- [x] [Review][Patch] Invalid `baseline_commit` in story frontmatter [62-1-keyword-candidates-from-digest-signals.md:6] — fixed to `0fd5b4e1573941bdedc671e97aff0d53fb22b64d`.
- [x] [Review][Defer] `postMutation` duplicated from `push-digest-convex.mjs` [push-keyword-candidates.mjs:137-172] — deferred, pre-existing; AC allows inline copy when duplication is under ~40 lines.
- [x] [Review][Defer] `.unique()` on `by_term` throws if duplicate rows exist [keywordCandidates.ts:18-21] — deferred, pre-existing; story Dev Notes mark duplicate-row race as acceptable Phase 1 risk.
- [x] [Review][Defer] No convexTest for server-side term normalization (whitespace collapse) [keywordCandidates.ts:8-10] — deferred, pre-existing; mutation implements normalize but tests only cover happy-path term.

## Dev Notes

### Architecture overview

```
morning-digest Sources 1–6
        │
   Build digest_push_payload (61-5)
        │
   Post digest to #hermes
        │
   [61-5] push-digest-convex.mjs → digestRuns + digestSignals
        │
   [NEW 62-1] push-keyword-candidates.mjs (same DIGEST_PUSH_JSON)
        │  extract terms from signals[] → score → upsertKeywordCandidate × N
        ▼
   keywordCandidates table (cns-dashboard Convex)
        │
   (future 62-2+) dashboard Signal Seeds UI — NO UI in 62-1
```

**Why same payload, not Convex read-back:** Phase 1 avoids an extra HTTP query/action round-trip and works even if digest push partially failed but payload is still available. The table **`digestSignals`** remains the archival source of truth; candidates are a **derived projection** refreshed each digest run.

### Term normalization (normative)

```js
function normalizeTerm(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
```

- Skip empty after normalize.
- Skip terms shorter than 2 chars or longer than 120 chars.
- `displayTerm` = original trimmed string before lowercase.

### `keywordCandidates.ts` mutation sketch

```typescript
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  keywordCandidateUpsertValidator,
  keywordCandidateRowValidator,
} from './validators';

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const upsertKeywordCandidate = mutation({
  args: { candidate: keywordCandidateUpsertValidator },
  returns: v.id('keywordCandidates'),
  handler: async (ctx, { candidate }) => {
    const term = normalizeTerm(candidate.term);
    const now = Date.now();
    const existing = await ctx.db
      .query('keywordCandidates')
      .withIndex('by_term', (q) => q.eq('term', term))
      .unique();

    if (existing) {
      const seenCount = existing.seenCount + 1;
      await ctx.db.patch(existing._id, {
        displayTerm: candidate.displayTerm.trim(),
        sourceType: candidate.sourceType,
        score: candidate.score,
        category: candidate.category,
        lastSeenAt: now,
        seenCount,
        ...(candidate.accepted !== undefined ? { accepted: candidate.accepted } : {}),
        ...(candidate.dismissed !== undefined ? { dismissed: candidate.dismissed } : {}),
        ...(candidate.workspaceId !== undefined ? { workspaceId: candidate.workspaceId } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert('keywordCandidates', {
      term,
      displayTerm: candidate.displayTerm.trim(),
      sourceType: candidate.sourceType,
      score: candidate.score,
      category: candidate.category,
      firstSeenAt: now,
      lastSeenAt: now,
      seenCount: 1,
      accepted: candidate.accepted ?? false,
      dismissed: candidate.dismissed ?? false,
      workspaceId: candidate.workspaceId,
    });
  },
});

export const getTopCandidates = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(keywordCandidateRowValidator),
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(1, limit ?? 10), 50);
    return await ctx.db
      .query('keywordCandidates')
      .withIndex('by_dismissed_score', (q) => q.eq('dismissed', false))
      .order('desc')
      .take(take);
  },
});
```

Adjust validators to match schema. Use `.unique()` on `by_term` — if duplicate rows ever exist, patch the first match (test should enforce single row per term).

### Validator enums (sketch)

```typescript
export const keywordSourceTypeValue = v.union(
  v.literal('google_trends'),
  v.literal('newsapi'),
  v.literal('arxiv'),
  v.literal('hackernews'),
  v.literal('digest_history'),
);

export const keywordCategoryValue = v.union(
  v.literal('trending'),
  v.literal('personal'),
  v.literal('adjacent'),
);
```

### Push script env resolution (61-3 compliance)

Same as 61-5 — import `mergeTrendIngestEnv` from `./fetch-arxiv-rss.mjs`:

```js
import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';
import { readDigestPushPayload } from './push-digest-convex.mjs';
```

Reuse `resolveConvexPushEnv` from `push-digest-convex.mjs` if exported; if not exported, duplicate the 10-line function (prefer **export + import** to avoid drift).

### task-prompt.md delta

Add section **`## Post-post — Push keyword candidates to Convex (REQUIRED — all runs)`** immediately **after** the digest Convex push section:

- **Precondition:** `digest_push_payload` already built; `push-digest-convex.mjs` terminal call already invoked.
- Reuse same shell-quoted `DIGEST_PUSH_JSON`.
- Mandatory completion step (same non-negotiable language as digest push §9).
- Observability JSON line documented in AC 6.

Update **Allowed tools** table to include `push-keyword-candidates.mjs`.

### SKILL.md edits (v1.3.0)

- Bump `version: 1.3.0`.
- Execution rule: add step **11** after step 10 (digest push) — keyword candidates push via `push-keyword-candidates.mjs`.
- Policy block — add bullet:
  - **Keyword candidates push (fire-and-forget):** After digest entity push, upsert `keywordCandidates` from digest signals. Failures stderr-only; always exit 0.

### Files to touch

| Path | Repo | Action |
|------|------|--------|
| `convex/validators.ts` | cns-dashboard | UPDATE — keyword candidate validators |
| `convex/schema.ts` | cns-dashboard | UPDATE — table + indexes |
| `convex/keywordCandidates.ts` | cns-dashboard | **NEW** — mutation + query |
| `tests/convex/keywordCandidates.test.ts` | cns-dashboard | **NEW** |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-keyword-candidates.mjs` | Omnipotent.md | **NEW** |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | Omnipotent.md | UPDATE — post-post candidates push |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | Omnipotent.md | UPDATE — v1.3.0 |
| `tests/morning-digest-push-keyword-candidates.test.mjs` | Omnipotent.md | **NEW** |
| `tests/hermes-morning-digest-skill.test.mjs` | Omnipotent.md | UPDATE — contract assertions |
| `~/.hermes/skills/cns/morning-digest/` | installed | SYNC via install script |

**Read only:** `push-digest-convex.mjs`, `digest.ts`, `notebookQueries.ts`, `tests/morning-digest-push-convex.test.mjs`.

**Optional refactor (only if duplication hurts):** export `resolveConvexPushEnv` + `postMutation` from `push-digest-convex.mjs` or thin `convex-http.mjs` — keep diff minimal.

### Contract-test regressions to fix (do NOT leave red)

`tests/hermes-morning-digest-skill.test.mjs` currently asserts v1.2.9 — bump to **1.3.0** everywhere. Add assertions for:
- `push-keyword-candidates.mjs` in task-prompt after digest push section
- Step ordering: digest push before keyword candidates push
- Policy mentions keyword candidates

### Testing guidance

**`tests/convex/keywordCandidates.test.ts`** (mirror `digest.test.ts`):

| Test | Assert |
|------|--------|
| Schema | `keywordCandidates` table + `by_term`, `by_dismissed_score` indexes |
| Insert | `seenCount === 1`, flags false |
| Upsert | same term → `seenCount === 2`, `firstSeenAt` stable |
| getTopCandidates | dismiss one → excluded; order by score desc |
| Validators exported | kind === 'object' |

**`tests/morning-digest-push-keyword-candidates.test.mjs`** (mirror `morning-digest-push-convex.test.mjs`):

| Test | Assert |
|------|--------|
| extractKeywordCandidates | trends + hn + arxiv only |
| Dedupe | two identical trend titles → one upsert |
| Missing env | skipped, exit 0 |
| Happy path | mock fetch N calls, path `keywordCandidates:upsertKeywordCandidate` |
| Failure | HTTP 500 → warning, exit 0 |

### Previous story intelligence

- **61-5:** Digest push is mandatory post-post with fire-and-forget **result**; keyword push follows same operator contract. Reuse `DIGEST_PUSH_JSON` — do not invent a second payload env unless necessary.
- **61-5 review:** Orphan runs on partial failure — keyword push is independent; failures must not block digest completion.
- **61-3:** Any script reading `trend-ingest.env` must use `mergeTrendIngestEnv`.
- **56-5:** All Convex public functions need `args` + `returns` validators; `convexTest` required.
- **60-1:** Run install script + `diff -rq` after skill edits.

### Git intelligence

Recent pattern: `feat(epic-62): 62-1 <description>` or `fix(epic-62): ...`. Baseline **642** Omnipotent tests, **374** cns-dashboard tests. This story spans **both repos** — commit each before claiming done.

### Security / ops

- `CONVEX_DEPLOY_KEY` never echoed to Discord.
- `DIGEST_PUSH_JSON` may contain vault context — shell-quote via `shellQuote()` (already used for digest push).
- No new npm packages (14-day supply-chain rule).

### Deferred / do not "fix"

- Headlines → keyword extraction (newsapi) — schema accepts `newsapi`; push script skips until Phase 2.
- `digest_history` sourceType — reserved for future backfill from historical `digestSignals`.
- Dashboard accept/dismiss UI — future story.
- Unique constraint enforcement beyond upsert-by-term — acceptable duplicate risk if index race; upsert uses `by_term` lookup.

## Project Structure Notes

- Convex modules at `cns-dashboard/convex/<feature>.ts` (flat).
- Morning-digest scripts under `scripts/hermes-skill-examples/morning-digest/scripts/`.
- `verify.sh` runs Omnipotent.md `npm test` then sibling `cns-dashboard npm test`.

## References

- [Source: `_bmad-output/implementation-artifacts/61-5-morning-digest-convex-push.md` — digest push pattern, payload shape, graceful exit 0]
- [Source: `cns-dashboard/convex/digest.ts` — public HTTP mutation module pattern]
- [Source: `cns-dashboard/convex/schema.ts` — table + index patterns]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` — HTTP transport, payload reader]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — post-post digest push §]
- [Source: `tests/morning-digest-push-convex.test.mjs` — push script test template]
- [Source: Convex docs — mutations/queries with validators (Context7 `/websites/convex_dev`)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Fixed schema index assertion: Convex `schema.tables.*.indexes` is an array, not a keyed object.
- Fixed ESLint unused-var issues in push script and test file.

### Completion Notes List

- Added `keywordCandidates` Convex table with `by_term` and `by_dismissed_score` indexes, validators, `upsertKeywordCandidate` mutation, and `getTopCandidates` query in cns-dashboard.
- Added `push-keyword-candidates.mjs` extracting google_trends/hackernews/arxiv signals, scoring, and HTTP upserting with graceful exit 0.
- Integrated mandatory post-post step in task-prompt (after digest push) and SKILL.md v1.3.0 step 11 + policy bullet.
- Added 6 convexTest cases + 6 push-script contract tests + hermes skill contract assertions.
- Installed skill to `~/.hermes/skills/cns/morning-digest/`; `diff -rq` clean.
- `bash scripts/verify.sh` passed (Omnipotent 642 vitest + cns-dashboard 377 tests).

### File List

**cns-dashboard**
- `convex/validators.ts`
- `convex/schema.ts`
- `convex/keywordCandidates.ts` (new)
- `tests/convex/keywordCandidates.test.ts` (new)

**Omnipotent.md**
- `scripts/hermes-skill-examples/morning-digest/scripts/push-keyword-candidates.mjs` (new)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-push-keyword-candidates.test.mjs` (new)
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-05: Story 62-1 created (ready-for-dev) — keywordCandidates Convex table + digest signal candidate generation.
- 2026-06-06: Code review patches applied — server-side score refinement via `trendComponent`, partial upsert observability, baseline_commit fix; status → done.
