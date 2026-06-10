---
story_id: 67-5b
epic: 67
title: producthunt-sourcetype-validator
status: ready-for-dev
baseline_date: 2026-06-10
operator_brief: 2026-06-10
predecessors: 67-5
blocks: producthunt-convex-push
repo: cns-dashboard only
parent_story: 67-5-producthunt-adapter-source-10
---

# Story 67.5b: Add `producthunt` to `digestSourceTypeValue`

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator running the morning digest with Product Hunt (Source 10)**,
I want **`digestSourceTypeValue` to accept the `producthunt` literal in cns-dashboard**,
so that **§9 push payloads from the 67-5 Omnipotent.md adapter are not rejected at the Convex validator boundary for `sourceType`, and Product Hunt signals can land in `digestSignals`**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 67 — Signal Quality + Source Expansion — **67-5b closes the Convex schema gap deferred from 67-5** |
| **Repo** | **`cns-dashboard` only** — single-file change per operator brief |
| **Predecessor** | **67-5** (Omnipotent.md ProductHunt adapter) — emits `sourceType: 'producthunt'` in §9 push payloads |
| **Blocks** | ProductHunt signals reaching Convex until this lands (67-5 adapter alone cannot push) |
| **Normative spec** | `architecture-epic-67-signal-quality-source-expansion.md` §3.1; PRD FR-10 |
| **Pattern reference** | **65-1** — same literal-add pattern for `github`, `reddit`, `rss` in `digestSourceTypeValue` |
| **Out of scope** | Omnipotent.md adapter/scoring/task-prompt (67-5); `digestSectionValue` literal (see **Section gap** below); `digest.test.ts` edits; any other file |

### Problem (current state)

`cns-dashboard/convex/validators.ts` defines `digestSourceTypeValue` with eight literals — no `producthunt`:

```133:142:/home/christ/ai-factory/projects/cns-dashboard/convex/validators.ts
export const digestSourceTypeValue = v.union(
	v.literal('google_trends'),
	v.literal('newsapi'),
	v.literal('arxiv'),
	v.literal('hackernews'),
	v.literal('deep_signal'),
	v.literal('github'),
	v.literal('reddit'),
	v.literal('rss')
);
```

Story **67-5** (Omnipotent.md) documents the intentional deferral: §9 payloads with `sourceType: 'producthunt'` **fail Convex validation** until this story lands. `digest.test.ts` currently asserts rejection:

```470:485:/home/christ/ai-factory/projects/cns-dashboard/tests/convex/digest.test.ts
	it('addDigestSignal rejects invalid sourceType literal', async () => {
		// ...
		sourceType: 'producthunt',
		// ...
		).rejects.toThrow();
	});
```

### Section gap (architecture vs operator scope)

Architecture §3.1 also lists `v.literal('producthunt')` for **`digestSectionValue`**. The 67-5 adapter maps **`section: 'producthunt'`** alongside `sourceType: 'producthunt'`. **This story is scoped to `digestSourceTypeValue` only** (operator brief). Pushes may still fail on `section` validation until a follow-up adds `digestSectionValue` — do **not** expand scope in this story; note in Completion Notes if end-to-end push remains blocked on section.

### Test tension (operator AC vs existing fixture)

AC requires **451 baseline tests pass** and **no other files changed**. After adding the literal, the rejection test above may **pass the mutation** (valid `sourceType` + valid `section: 'github'`) and **fail the test**. If that happens:

1. Do **not** edit `digest.test.ts` in this story (AC 4).
2. Report the conflict in Completion Notes for operator follow-up (test update story or AC amendment).

Run `npm test` from cns-dashboard and record exact pass/fail count.

## Acceptance Criteria

### 1. Convex dev deploy succeeds (AC: operator brief #1)

**Given** the one-line validator change in `convex/validators.ts`
**When** `npx convex dev --once` runs from `cns-dashboard` root
**Then** command exits 0 (schema push / codegen succeeds)

### 2. `producthunt` in `digestSourceTypeValue` (AC: operator brief #2)

**Given** `cns-dashboard/convex/validators.ts`
**When** the file is inspected
**Then** `digestSourceTypeValue` union includes `v.literal('producthunt')` alongside `github`, `reddit`, `rss`
**And** `digestSignalInputValidator`, `digestSignalRowValidator`, and `digestSignalListItemValidator` inherit the extended union automatically (no manual edits to those exports)

### 3. Baseline tests pass (AC: operator brief #3)

**Given** cns-dashboard at repo root (or `CNS_DASHBOARD_ROOT`)
**When** `npm test` runs
**Then** all tests pass (operator baseline: **451**)
**And** if the producthunt rejection test fails, document in Completion Notes — do not fix in this story

### 4. Single-file diff (AC: operator brief #4)

**Given** the implementation is complete
**When** `git diff` is inspected
**Then** **only** `convex/validators.ts` is modified
**And** no Omnipotent.md files, no test files, no schema.ts hand-edits

## Tasks / Subtasks

- [ ] **T1** Add literal (AC: 1, 2, 4)
  - [ ] Open `cns-dashboard/convex/validators.ts`
  - [ ] Add `v.literal('producthunt')` to `digestSourceTypeValue` union after `v.literal('rss')` (alphabetical optional; mirror 65-1 append-after-rss pattern)
  - [ ] Do **not** touch `digestSectionValue`, `keywordSourceTypeValue`, or `sourceMetadataValidator`
- [ ] **T2** Verify Convex (AC: 1)
  - [ ] From cns-dashboard: `npx convex dev --once`
- [ ] **T3** Verify tests (AC: 3)
  - [ ] From cns-dashboard: `npm test`
  - [ ] Record pass count; note any rejection-test failure per **Test tension** above

## Dev Notes

### Exact change (binding)

One line addition in `cns-dashboard/convex/validators.ts`:

```typescript
export const digestSourceTypeValue = v.union(
	v.literal('google_trends'),
	v.literal('newsapi'),
	v.literal('arxiv'),
	v.literal('hackernews'),
	v.literal('deep_signal'),
	v.literal('github'),
	v.literal('reddit'),
	v.literal('rss'),
	v.literal('producthunt')  // ADD THIS LINE
);
```

### What must be preserved

- **`keywordSourceTypeValue`** — unchanged (keywords pipeline is separate; 65-1 established this rule).
- **`sourceMetadataValidator`** — already has `upvotes`; Product Hunt maps `votesCount` → `upvotes` in 67-5. No change needed.
- **Existing literals** — do not reorder or rename; append only.

### WSL / cross-repo workflow

- Edit validators in **`cns-dashboard`** (sibling repo: `../cns-dashboard` from Omnipotent.md).
- Verify from cns-dashboard: `npm test` and `npx convex dev --once`.
- Omnipotent.md `bash scripts/verify.sh` runs cns-dashboard tests when sibling exists — optional cross-check after cns-dashboard-local verify passes.

### Relationship to 67-5

| Layer | Story | Repo |
|-------|-------|------|
| Adapter, scoring, task-prompt | 67-5 | Omnipotent.md |
| `digestSourceTypeValue` literal | **67-5b** | cns-dashboard |
| `digestSectionValue` literal (if needed) | *future / out of scope* | cns-dashboard |

67-5b can land **in parallel with or after** 67-5 dev; it has **no Omnipotent.md code dependency** — only unblocks Convex acceptance of `sourceType: 'producthunt'`.

### Anti-patterns (do not)

- Do not add Product Hunt adapter code in this story.
- Do not extend `digest.test.ts` “rejects producthunt” test — out of scope unless operator amends AC 4.
- Do not add `producthunt` to `digestSectionValue` unless operator expands scope.
- Do not run `npx convex deploy` — dev only (`npx convex dev --once`).

### Project Structure Notes

- cns-dashboard path: `{Omnipotent.md}/../cns-dashboard` or `CNS_DASHBOARD_ROOT`.
- Convex tables use validator-driven shapes; **`schema.ts` should not need a hand-edit** for this literal-only change.

### References

- [Source: Operator brief 2026-06-10 — Story 67-5b]
- [Source: `_bmad-output/implementation-artifacts/67-5-producthunt-adapter-source-10.md` — Convex push gap]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md` §3.1]
- [Source: `_bmad-output/implementation-artifacts/65-1-digest-source-types-github-adapter.md` — literal-add pattern]
- [Source: `cns-dashboard/convex/validators.ts` — target file]
- [Source: PRD Epic 67 FR-10 — `producthunt` digestSourceTypeValue]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
