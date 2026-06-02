---
story_id: 56-5
epic: 56
title: notebook-queries-convex-table-dedupe
status: done
baseline_commit: d7d2af981461dc5448ec51c01a00f447de8c7651
---

# Story 56.5: notebookQueries Convex table dedupe

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator reviewing Notebook Query History on `/trends`**,  
I want **duplicate Convex log rows for the same notebook + question within a short window to be silently dropped**,  
so that **rapid `/notebook-query` retries, morning-digest loops, and 54-2 awaited log steps do not pollute history with identical entries**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 56: NotebookLM routing calibration + vault hygiene (operator brief 2026-06-02) |
| **Predecessors** | **51-2** (Convex `notebookQueries` table + `logNotebookQuery` mutation); **52-2** (morning-digest log path); **54-2** (awaited 15s terminal log — increases duplicate-call exposure on retries) |
| **Deferred item resolved** | `deferred-work.md` §52-2: *"No idempotency/dedupe on notebookQueries rows"* — this story closes that gap |
| **Problem** | `logNotebookQuery` always inserts. Rapid duplicate calls (same `notebookId` + `question` within ~60s) produce duplicate rows in `NotebookQueryHistoryPanel`, degrading operator trust. |
| **Goal** | Idempotent dedupe guard inside `logNotebookQuery` — first call inserts; duplicates within window return early with no error. |
| **In scope** | `cns-dashboard/convex/notebookQueries.ts`, `cns-dashboard/tests/convex/notebookQueries.test.ts` |
| **Out of scope** | Schema/index changes, dashboard components, `log-notebook-query.mjs`, Omnipotent.md Hermes skill changes, WriteGate / vault IO |

### Operator brief (binding)

1. Before insert in `logNotebookQuery`, query for an existing row with matching `notebookId` + `question` where `_creationTime > now - 60000ms`.
2. If match exists → return early (silent, idempotent).
3. If no match → insert as today (truncate, normalize, 100-row cap unchanged).
4. Add `dedupeWindowMs` config constant (default `60000`) for tuning.
5. `bash scripts/verify.sh` green.

## Acceptance Criteria

### 1. Dedupe guard on insert (AC: dedupe)

**Given** `logNotebookQuery` receives `{ entry: { question, answer, notebookId, notebookTitle, domain } }`  
**When** a row already exists with the same normalized `notebookId` and normalized `question` within the dedupe window  
**Then** the mutation returns without inserting (no throw, no stderr contract change for HTTP callers)  
**And** the existing row is unchanged.

**When** no matching row exists within the window  
**Then** insert proceeds exactly as today (field truncation, domain normalization, `status: 'success'`, `queriedAt: now`, 100-row cap enforcement).

### 2. Normalization parity (AC: match-key)

**Given** dedupe key comparison  
**Then** `notebookId` is compared after `.trim()` (same as insert path)  
**And** `question` is compared after `truncate(question, MAX_QUESTION_LEN)` (same as insert path)  
**So that** a 600-char question and its truncated stored form dedupe correctly.

### 3. Window constant (AC: config)

**Then** module exports or defines `DEDUPE_WINDOW_MS = 60_000` (or `dedupeWindowMs` — pick one name, document in Completion Notes)  
**And** dedupe logic uses `now - DEDUPE_WINDOW_MS` as window start  
**And** no env var or dashboard config surface is required for v1.

### 4. Distinct entries still log (AC: negative)

**Given** two calls within the dedupe window  
**When** `notebookId` differs **or** normalized `question` differs  
**Then** both rows are inserted (two distinct history entries).

### 5. Window expiry (AC: expiry)

**Given** a row was inserted for `(notebookId, question)`  
**When** a second call arrives after the dedupe window has elapsed  
**Then** a new row is inserted (history may legitimately repeat the same question later).

### 6. Regression + verify (AC: test)

**Then** existing tests remain green: 100-row cap, `getRecentNotebookQueries` ordering, truncate/normalize exports  
**And** new tests cover: duplicate drop within window, distinct keys insert, window expiry  
**And** `bash scripts/verify.sh` passes (includes `cns-dashboard npm test` when sibling exists).

### 7. Scope guards (AC: scope)

**Then** `convex/schema.ts` is **unchanged** (no new indexes)  
**And** `getRecentNotebookQueries`, validators, and Hermes log script are **unchanged**  
**And** no Omnipotent.md source edits.

## Tasks / Subtasks

- [x] **T1** Add `DEDUPE_WINDOW_MS` constant (default `60_000`) at top of `notebookQueries.ts` (AC: 3)
- [x] **T2** Pre-insert dedupe check in `logNotebookQuery` — normalize keys, query recent rows, early return on match (AC: 1, 2)
- [x] **T3** Tests in `notebookQueries.test.ts` — duplicate drop, distinct keys, window expiry (AC: 4, 5, 6)
- [x] **T4** Run `bash scripts/verify.sh` from Omnipotent.md repo root (AC: 6)
- [x] **T5** Mark deferred-work item resolved in Completion Notes (reference only — do not edit deferred-work.md unless operator asks)

## Dev Notes

### Current mutation (read before editing)

```33:58:../cns-dashboard/convex/notebookQueries.ts
// Public by design: Hermes skill pushes individual log entries via HTTP API.
export const logNotebookQuery = mutation({
	args: { entry: notebookQueryInputValidator },
	handler: async (ctx, { entry }) => {
		const now = Date.now();
		await ctx.db.insert('notebookQueries', {
			question: truncate(entry.question, MAX_QUESTION_LEN),
			answer: truncate(entry.answer, MAX_ANSWER_LEN),
			notebookId: entry.notebookId.trim(),
			notebookTitle: entry.notebookTitle.trim(),
			domain: normalizeDomain(entry.domain || 'general'),
			status: 'success',
			queriedAt: now
		});

		const all = await ctx.db
			.query('notebookQueries')
			.withIndex('by_queriedAt')
			.order('asc')
			.collect();
		if (all.length > MAX_ROWS) {
			const excess = all.slice(0, all.length - MAX_ROWS);
			await Promise.all(excess.map((row) => ctx.db.delete(row._id)));
		}
	}
});
```

**Preserve:** public mutation contract, MAX_ROWS cap logic, truncate/normalize helpers, exported test utilities.

### Recommended dedupe implementation (no schema change)

Schema has only `by_queriedAt` on `['queriedAt']` — **do not add indexes** (out of scope). Table is capped at **100 rows**, so a bounded recent scan is acceptable.

```typescript
const DEDUPE_WINDOW_MS = 60_000;

// Inside handler, after `const now = Date.now()`:
const normalizedQuestion = truncate(entry.question, MAX_QUESTION_LEN);
const normalizedNotebookId = entry.notebookId.trim();
const windowStart = now - DEDUPE_WINDOW_MS;

const recent = await ctx.db
	.query('notebookQueries')
	.withIndex('by_queriedAt', (q) => q.gte('queriedAt', windowStart))
	.collect();

const isDuplicate = recent.some(
	(row) =>
		row.notebookId === normalizedNotebookId &&
		row.question === normalizedQuestion &&
		row._creationTime >= windowStart
);

if (isDuplicate) return;

// then insert using normalizedQuestion / normalizedNotebookId (avoid double truncate)
```

**Why `queriedAt` index + `_creationTime` check:** Operator brief specifies `_creationTime`; `queriedAt` is set to `Date.now()` on insert so index range on `queriedAt >= windowStart` efficiently bounds the scan. In-memory `_creationTime >= windowStart` satisfies the brief and guards clock skew edge cases. Per Convex best practices: prefer index range over bare `.filter()` on full table ([Convex: avoid filter on large sets](https://docs.convex.dev/understanding/best-practices)).

**`Date.now()` in mutations:** Allowed — the `no-date-now-in-queries` rule applies to **queries** (reactivity/caching), not mutations.

### Concurrent duplicate calls (known limitation)

Two parallel HTTP mutations may both pass the read-check before either inserts (same class of race as pre-48-5 alert dedupe). **In scope:** sequential duplicate calls within 60s (primary operator pain). **Out of scope:** database-level unique constraint or concurrent canonicalization — table stays schema-stable.

### Callers (unchanged)

| Caller | Path |
|--------|------|
| `/notebook-query` skill | `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs` → HTTP `notebookQueries:logNotebookQuery` |
| Morning digest | Same script via Source 4 post-post step (52-2, 54-2 awaited terminal) |
| Dashboard read | `getRecentNotebookQueries` on `/trends` — read-only consumer |

Silent early return is correct for fire-and-forget HTTP pushes — script already treats non-throwing success as OK.

### Testing strategy

Use `convexTest` pattern from existing `notebookQueries.test.ts`:

| Test | Setup | Assert |
|------|-------|--------|
| Duplicate drop | Two identical `logNotebookQuery` calls back-to-back | `ctx.db.query('notebookQueries').collect()` length === 1 |
| Distinct question | Same `notebookId`, different `question` | length === 2 |
| Distinct notebook | Same `question`, different `notebookId` | length === 2 |
| Window expiry | `vi.useFakeTimers()` — first call at T0, advance `61_000` ms, second identical call | length === 2 |
| Cap regression | Existing 101-insert cap test still passes | unchanged behavior |

Export `DEDUPE_WINDOW_MS` if tests need to reference the constant (optional). Fake timers: restore in `afterEach`.

**Do not** add Omnipotent.md tests — scope is cns-dashboard Convex module only.

### Previous story intelligence (Epic 56)

- **56-4** touched morning-digest signal builder only — no Convex changes. Duplicate log exposure may increase when multi-source routing succeeds more often (more ROUTED → more log steps).
- **54-2** awaited log terminal — retries/timeouts can invoke log script more than once for the same Q&A; dedupe closes the history pollution loop.
- **51-2 review deferrals** explicitly flagged missing dedupe — this story is the intended fix.

### Git baseline

| Repo | HEAD (story creation) |
|------|------------------------|
| Omnipotent.md | `d7d2af9` — 56-4 morning digest signal scoring |
| cns-dashboard | `9a794b7` — 56-3 Part B fanout badge (Convex module last touched in 51-2 era) |

### File structure

| File | Action |
|------|--------|
| `cns-dashboard/convex/notebookQueries.ts` | UPDATE — dedupe guard + constant |
| `cns-dashboard/tests/convex/notebookQueries.test.ts` | UPDATE — dedupe test cases |

**Verify gate:** From Omnipotent.md root: `bash scripts/verify.sh` (runs `npm test` here + `cns-dashboard npm test` when `../cns-dashboard` exists).

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 52-2 dedupe deferral]
- [Source: `_bmad-output/implementation-artifacts/51-2-notebook-query-history-log.md` — table contract, cap, HTTP push model]
- [Source: `_bmad-output/implementation-artifacts/54-2-notebook-query-convex-log-reliability.md` — awaited log increases duplicate-call risk]
- [Source: `cns-dashboard/convex/schema.ts` — `notebookQueries` + `by_queriedAt` index only]
- [Source: `cns-dashboard/convex/trends.ts` — dedupe-by-key pattern (`by_dedupeKey` + early continue) for reference; notebookQueries uses time-window match instead]
- [Convex docs: filter vs index](https://docs.convex.dev/understanding/best-practices) — bounded index range preferred

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

(none)

### Completion Notes List

- Added exported `DEDUPE_WINDOW_MS = 60_000` and pre-insert dedupe in `logNotebookQuery`: bounded `by_queriedAt` index scan, normalized `notebookId` + truncated `question` match, `_creationTime >= windowStart`, silent early return.
- Tests: duplicate drop, distinct question/notebook, window expiry (`vi.useFakeTimers` + advance past window). Existing cap/ordering/truncate tests unchanged.
- `bash scripts/verify.sh` passed (Omnipotent.md + cns-dashboard).
- Resolves `deferred-work.md` §52-2 idempotency deferral (reference only; file not edited).
- Code review patch: added truncation parity test (600-char question dedupes to single row; stored question matches `truncateNotebookQueryField`).

### File List

- `cns-dashboard/convex/notebookQueries.ts` (modified)
- `cns-dashboard/tests/convex/notebookQueries.test.ts` (modified)

### Change Log

- 2026-06-02: Story 56-5 — `logNotebookQuery` dedupe guard + tests; sprint status → review.

### Review Findings

- [x] [Review][Patch] Missing AC 2 truncation dedupe test [`cns-dashboard/tests/convex/notebookQueries.test.ts`] — fixed: added 600-char question truncation parity test.
- [x] [Review][Defer] Concurrent duplicate mutation race [`cns-dashboard/convex/notebookQueries.ts:44-56`] — deferred, pre-existing known limitation documented in story Dev Notes; two parallel HTTP mutations may both pass read-check before either inserts; out of scope per operator brief.
