---
story_id: 67-5c
epic: 67
title: producthunt-section-and-push-validators
status: review
baseline_date: 2026-06-10
operator_brief: 2026-06-10
predecessors: 67-5b
blocks: producthunt-convex-push-e2e
repo: cns-dashboard only
parent_story: 67-5-producthunt-adapter-source-10
companion_story: 67-5b-producthunt-sourcetype-validator
---

# Story 67.5c: Add `producthunt` section value + fix push validators

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator running the morning digest with Product Hunt (Source 10)**,
I want **`digestSectionValue` to accept `producthunt` and digest tests to assert successful push acceptance**,
so that **67-5 §9 payloads with paired `section: 'producthunt'` and `sourceType: 'producthunt'` pass Convex validation end-to-end without a second deployment gap, and the test suite reflects the new contract**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 67 — Signal Quality + Source Expansion — **67-5c completes the cns-dashboard schema gate split across 67-5b/67-5c** |
| **Repo** | **`cns-dashboard` only** — `convex/validators.ts` + `tests/convex/digest.test.ts` |
| **Predecessor** | **67-5b** — must land first (or be verified done): `digestSourceTypeValue` includes `producthunt` |
| **Upstream** | **67-5** (Omnipotent.md adapter) — emits paired `section` + `sourceType` both `producthunt`; maps `votesCount` → `sourceMetadata.upvotes` |
| **Blocks** | End-to-end ProductHunt signal push to Convex until **both** 67-5b and 67-5c are done |
| **Normative spec** | `architecture-epic-67-signal-quality-source-expansion.md` §3.1, §11; PRD FR-10 |
| **Pattern reference** | **65-1** — extended **both** `digestSectionValue` and `digestSourceTypeValue`; acceptance tests in `digest.test.ts` for github/reddit/rss |
| **Out of scope** | Omnipotent.md adapter/scoring (67-5); re-doing 67-5b if already merged; `keywordSourceTypeValue`; `sourceMetadataValidator` changes; any file outside validators + digest test fixtures |

### Why 67-5c exists (operator rationale)

67-5b adds `sourceType` only. The 67-5 adapter pushes **`section: 'producthunt'`** — without the section literal, payloads still fail at Convex. Splitting schema + test fixes across two stories avoids editing tests in 67-5b (no-test-change AC) but **67-5c is the deployment that makes push actually work** together with 67-5b's sourceType literal.

### Problem (current state)

`digestSectionValue` lacks `producthunt`:

```122:131:/home/christ/ai-factory/projects/cns-dashboard/convex/validators.ts
export const digestSectionValue = v.union(
	v.literal('trends'),
	v.literal('headlines'),
	v.literal('arxiv'),
	v.literal('hackernews'),
	v.literal('deep_signal'),
	v.literal('github'),
	v.literal('reddit'),
	v.literal('rss')
);
```

`digest.test.ts` asserts `producthunt` **rejection** (placeholder until validators exist):

```470:485:/home/christ/ai-factory/projects/cns-dashboard/tests/convex/digest.test.ts
	it('addDigestSignal rejects invalid sourceType literal', async () => {
		// ...
		section: 'github',
		sourceType: 'producthunt',
		// ...
		).rejects.toThrow();
	});
```

After **67-5b** alone, this test may fail (valid `sourceType` + valid `section: 'github'`). **67-5c** flips producthunt coverage to acceptance with the correct paired literals and restores rejection coverage with a genuinely invalid literal.

## Acceptance Criteria

### 1. `digestSectionValue` includes `producthunt` (AC: operator brief #1)

**Given** `cns-dashboard/convex/validators.ts`
**When** inspected after implementation
**Then** `digestSectionValue` union includes `v.literal('producthunt')` alongside `github`, `reddit`, `rss`
**And** signal validators (`digestSignalInputValidator`, `digestSignalRowValidator`, `digestSignalListItemValidator`) pick up the extended section union automatically

### 2. `digestSourceTypeValue` already includes `producthunt` from 67-5b (AC: operator brief #2)

**Given** work begins on 67-5c
**When** `convex/validators.ts` is read **before any edits**
**Then** `digestSourceTypeValue` already contains `v.literal('producthunt')` from merged **67-5b**
**And** if `producthunt` is **missing** from `digestSourceTypeValue`, **stop** — implement or merge **67-5b** first; do not add sourceType in this story

### 3. ProductHunt rejection tests flipped to acceptance (AC: operator brief #3)

**Given** both literals exist in validators
**When** `npm test` runs
**Then** tests that previously used `producthunt` as a **rejected** payload now **accept** a valid ProductHunt signal
**And** acceptance fixture uses paired literals: `section: 'producthunt'`, `sourceType: 'producthunt'`
**And** fixture includes `sourceMetadata: { upvotes: N }` (67-5 mapping contract)
**And** stored row assertions match github/reddit acceptance test style (`toMatchObject` on section, sourceType, metadata)

### 4. Convex dev succeeds (AC: operator brief #4)

**Given** validators + test updates
**When** `npx convex dev --once` runs from cns-dashboard root
**Then** command exits 0

### 5. Baseline tests pass (AC: operator brief #5)

**Given** cns-dashboard at repo root
**When** `npm test` runs
**Then** all tests pass (operator baseline: **451+**; count may increase by one if rejection test is split into accept + reject)

### 6. Scoped file diff (AC: operator brief #6)

**Given** implementation complete
**When** `git diff` is inspected
**Then** only **`convex/validators.ts`** and **`tests/convex/digest.test.ts`** (and no other test paths) are modified
**And** no Omnipotent.md files changed

## Tasks / Subtasks

- [x] **T0** Verify 67-5b prerequisite (AC: 2)
  - [x] Read `digestSourceTypeValue` — confirm `v.literal('producthunt')` present
  - [x] If missing: halt, complete 67-5b first
- [x] **T1** Add section literal (AC: 1, 6)
  - [x] Add `v.literal('producthunt')` to `digestSectionValue` after `v.literal('rss')`
  - [x] Do not modify `digestSourceTypeValue`, `keywordSourceTypeValue`, or `sourceMetadataValidator`
- [x] **T2** Update digest tests (AC: 3, 5, 6)
  - [x] Replace `addDigestSignal rejects invalid sourceType literal` producthunt case with **`addDigestSignal accepts producthunt signal with upvotes metadata`** (mirror `github` test at lines 412–435)
  - [ ] Payload shape:

```typescript
{
  digestRunId: runId,
  section: 'producthunt',
  sourceType: 'producthunt',
  title: 'Example Launch',
  url: 'https://www.producthunt.com/posts/example-launch',
  rank: 1,
  sourceMetadata: { upvotes: 500 }
}
```

  - [x] Assert stored signal: `section: 'producthunt'`, `sourceType: 'producthunt'`, `sourceMetadata: { upvotes: 500 }`
  - [x] **Preserve rejection coverage:** add/rename a test that rejects a **still-invalid** literal (e.g. `sourceType: 'tiktok'` or `'invalid_source'`) so the suite still guards unknown source types
- [x] **T3** Verify (AC: 4, 5)
  - [x] `npx convex dev --once`
  - [x] `npm test` — record final pass count in Completion Notes

## Dev Notes

### Exact validator change (binding)

One line addition in `cns-dashboard/convex/validators.ts` — **section union only**:

```typescript
export const digestSectionValue = v.union(
	v.literal('trends'),
	v.literal('headlines'),
	v.literal('arxiv'),
	v.literal('hackernews'),
	v.literal('deep_signal'),
	v.literal('github'),
	v.literal('reddit'),
	v.literal('rss'),
	v.literal('producthunt')  // ADD THIS LINE
);
```

**Do not re-add** `producthunt` to `digestSourceTypeValue` if 67-5b already merged it.

### Test change pattern (mirror 65-1 / github)

Reference acceptance test:

```412:435:/home/christ/ai-factory/projects/cns-dashboard/tests/convex/digest.test.ts
	it('addDigestSignal accepts github signal with stars and forks metadata', async () => {
		// section + sourceType paired; sourceMetadata engagement fields
	});
```

ProductHunt uses **`upvotes`** in `sourceMetadataValidator` (already defined — no schema change).

### Rejection test migration

| Before (67-5b may break this) | After (67-5c) |
|-------------------------------|---------------|
| `section: 'github'`, `sourceType: 'producthunt'` → reject | `section: 'producthunt'`, `sourceType: 'producthunt'` → **accept** |
| — | New case: e.g. `sourceType: 'tiktok'` → **reject** |

Only **`tests/convex/digest.test.ts`** references `producthunt` today (grep-confirmed). No other test files need edits unless grep finds new references after 67-5b.

### Execution order with 67-5b

```
67-5b (sourceType literal, validators.ts only)
    ↓
67-5c (section literal + digest.test.ts)  ← this story
    ↓
67-5 adapter push succeeds end-to-end
```

Deploy **67-5b then 67-5c** in sequence, or squash both validator commits before one Convex push if operator prefers single deployment — story scope still respects two story files for BMAD tracking.

### Anti-patterns (do not)

- Do not implement 67-5b's sourceType change inside 67-5c if 67-5b is not merged.
- Do not touch Omnipotent.md `tests/morning-digest-push-convex.test.mjs` (separate repo/story scope).
- Do not extend `keywordSourceTypeValue`.
- Do not run `npx convex deploy` — use `npx convex dev --once` only.

### WSL / cross-repo workflow

- Work in **`cns-dashboard`** (`../cns-dashboard` from Omnipotent.md or `CNS_DASHBOARD_ROOT`).
- Optional cross-check: `bash scripts/verify.sh` from Omnipotent.md after cns-dashboard `npm test` green.

### References

- [Source: Operator brief 2026-06-10 — Story 67-5c]
- [Source: `_bmad-output/implementation-artifacts/67-5b-producthunt-sourcetype-validator.md` — predecessor]
- [Source: `_bmad-output/implementation-artifacts/67-5-producthunt-adapter-source-10.md` — §9 mapping]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md` §3.1, §11]
- [Source: `_bmad-output/implementation-artifacts/65-1-digest-source-types-github-adapter.md` — dual-union + test pattern]
- [Source: `cns-dashboard/convex/validators.ts`, `cns-dashboard/tests/convex/digest.test.ts`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Verified 67-5b prerequisite: `digestSourceTypeValue` already includes `v.literal('producthunt')`.
- Added `v.literal('producthunt')` to `digestSectionValue` in `cns-dashboard/convex/validators.ts`.
- Added `addDigestSignal accepts producthunt signal with upvotes metadata` acceptance test in `tests/convex/digest.test.ts` (paired section + sourceType, `sourceMetadata: { upvotes: 500 }`).
- Rejection coverage preserved: existing `addDigestSignal rejects invalid sourceType literal` test still uses `invalid_source`.
- `npx convex dev --once` exit 0 (dev deployment `exciting-pony-764`).
- `npm test` and `bash scripts/verify.sh` green — **460** tests (459 baseline + 1 new acceptance test).

### File List

- `cns-dashboard/convex/validators.ts`
- `cns-dashboard/tests/convex/digest.test.ts`
