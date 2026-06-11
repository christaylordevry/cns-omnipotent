---
story_id: 68-4
epic: 68
title: schema-literals-twitter-bluesky
status: ready-for-dev
baseline_date: 2026-06-11
operator_brief: 2026-06-11
predecessors: 68-1, 67-5c
blocks: 68-5, 68-6
repo: cns-dashboard only
fr_ids: FR-7, FR-11
priority: P1
---

# Story 68.4: Convex Schema Literals — `twitter` + `bluesky`

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator expanding the morning digest with X/Twitter (Source 11) and Bluesky (Source 12)**,
I want **`digestSourceTypeValue`, `digestSectionValue`, and social engagement fields on `sourceMetadataValidator` to accept the `twitter` and `bluesky` literals in cns-dashboard**,
so that **§9 push payloads from upcoming 68-5/68-6 adapters are not rejected at the Convex validator boundary, and social signals can land in `digestSignals` with paired section/sourceType and engagement metadata**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup |
| **Priority** | **P1** — small schema gate; run **after 68-1**, **before 68-5 / 68-6** |
| **Repo** | **`cns-dashboard` only** — `convex/validators.ts` + `tests/convex/digest.test.ts` |
| **Predecessors** | **68-1** (done) — `contributingSources` uses `v.string()` for contributor `sourceType` (twitter/bluesky cluster rows already forward-compatible); **67-5c** (done) — ProductHunt paired literal pattern |
| **Blocks** | **68-5** (Bluesky adapter), **68-6** (X/Twitter adapter) — adapters cannot push until literals exist |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.3 FR-7, §4.4 FR-11; `addendum.md` §A1, §A3, §A5 |
| **Pattern reference** | **67-5b + 67-5c** — combined in one story (addendum: "68-4a and 68-4b may ship as single story 68-4 if cns-dashboard touch is one PR") |
| **Out of scope** | Omnipotent.md adapters (`fetch-bluesky-signals.mjs`, `fetch-x-signals.mjs`); `normalizeEngagement()` branches; task-prompt Source 11/12 sections; Hermes wrappers; `keywordSourceTypeValue`; vault WriteGate |

### Operator rationale (binding)

Epic 68 sprint sequencing: `68-1` → **`68-4`** → `68-5` ∥ `68-2` → … Social adapter stories assume Convex accepts `sourceType: 'twitter' | 'bluesky'` with **paired** `section` values and social `sourceMetadata` fields. This story is intentionally small — one cns-dashboard PR — but must cover **section + sourceType + metadata** or 68-5/68-6 live pushes still fail after adapter work.

### Problem (current state)

`cns-dashboard/convex/validators.ts` has nine digest literals (through `producthunt`) — no social sources:

```122:144:/home/christ/ai-factory/projects/cns-dashboard/convex/validators.ts
export const digestSectionValue = v.union(
	v.literal('trends'),
	// ...
	v.literal('producthunt')
);

export const digestSourceTypeValue = v.union(
	v.literal('google_trends'),
	// ...
	v.literal('producthunt')
);
```

Addendum mapping contract (both platforms use **paired** section + sourceType):

| Platform | `section` | `sourceType` | Engagement → `sourceMetadata` |
|----------|-----------|--------------|--------------------------------|
| X/Twitter | `'twitter'` | `'twitter'` | `authorHandle`, `likes`, `reposts`, `replies`, `quotes` |
| Bluesky | `'bluesky'` | `'bluesky'` | same shape per addendum A3 |

Top-level `sourceMetadataValidator` today lacks social fields (they exist only on `contributingSources[]` child rows from 68-1):

```146:175:/home/christ/ai-factory/projects/cns-dashboard/convex/validators.ts
export const sourceMetadataValidator = v.object({
	comments: v.optional(v.number()),
	// ... stars, forks, upvotes, points, commentCount ...
	contributingSources: v.optional(/* child rows include likes, reposts, ... */),
	dedupClusterSize: v.optional(v.number())
});
```

Convex `v.object` rejects unknown keys — pushes with `sourceMetadata.likes` or `authorHandle` **fail today** even if literals were added without metadata extension.

### Decision log (binding)

| Decision | Source |
|----------|--------|
| Literal name is `twitter` (not `x`) | PRD decision log row; matches `normalizeEngagement` branch naming in 68-6/68-7 |
| Literal name is `bluesky` | PRD FR-7 |
| Single story ships both platform literals | addendum §A5 |

## Acceptance Criteria

### 1. Social literals in `digestSourceTypeValue` (AC: FR-11, FR-7)

**Given** `cns-dashboard/convex/validators.ts`
**When** inspected after implementation
**Then** `digestSourceTypeValue` union includes `v.literal('twitter')` and `v.literal('bluesky')` after `v.literal('producthunt')`
**And** `digestSignalInputValidator`, `digestSignalRowValidator`, and `digestSignalListItemValidator` inherit the extended union automatically (no manual edits to those exports)

### 2. Social literals in `digestSectionValue` (AC: FR-7, FR-11)

**Given** the same validators file
**When** inspected
**Then** `digestSectionValue` union includes `v.literal('twitter')` and `v.literal('bluesky')` after `v.literal('producthunt')`
**And** signal row validators pick up the extended section union automatically

### 3. Social engagement on primary `sourceMetadata` (AC: unblocks 68-5/68-6 push)

**Given** addendum A1/A3 maps engagement + author to `sourceMetadata`
**When** `sourceMetadataValidator` is inspected
**Then** top-level object includes optional fields: `authorHandle: v.optional(v.string())`, `likes`, `reposts`, `replies`, `quotes` as `v.optional(v.number())`
**And** existing fields (`contributingSources`, `dedupClusterSize`, github/hn fields) are unchanged
**And** `keywordSourceTypeValue` is untouched

### 4. Acceptance tests for paired literals (AC: mirror 67-5c)

**Given** validators updated
**When** `npm test` runs from cns-dashboard
**Then** `tests/convex/digest.test.ts` includes:
- `addDigestSignal accepts twitter signal with social metadata` — paired `section: 'twitter'`, `sourceType: 'twitter'`, `sourceMetadata: { authorHandle, likes, reposts, replies, quotes }`
- `addDigestSignal accepts bluesky signal with social metadata` — paired `section: 'bluesky'`, `sourceType: 'bluesky'`, same metadata shape
**And** stored row assertions use `toMatchObject` (mirror github/producthunt tests at lines 412–435, 480–500)
**And** existing `addDigestSignal rejects invalid sourceType literal` test still rejects e.g. `invalid_source` (do not remove rejection coverage)

### 5. Convex dev deploy succeeds

**Given** validator + test changes
**When** `npx convex dev --once` runs from cns-dashboard root
**Then** command exits 0 (schema push / codegen succeeds)
**And** do **not** run `npx convex deploy` — dev only

### 6. Baseline tests pass

**Given** cns-dashboard at repo root (or `CNS_DASHBOARD_ROOT`)
**When** `npm test` runs
**Then** all tests pass (baseline **461** as of 2026-06-11; count may increase by +2 acceptance tests)
**And** optional cross-check: `bash scripts/verify.sh` from Omnipotent.md when sibling repo exists

### 7. Scoped file diff

**Given** implementation complete
**When** `git diff` is inspected
**Then** only **`convex/validators.ts`** and **`tests/convex/digest.test.ts`** are modified
**And** no Omnipotent.md files changed

## Tasks / Subtasks

- [ ] **T1** Extend unions (AC: 1, 2, 7)
  - [ ] Open `cns-dashboard/convex/validators.ts`
  - [ ] Append `v.literal('twitter')`, `v.literal('bluesky')` to **`digestSectionValue`** after `producthunt`
  - [ ] Append same two literals to **`digestSourceTypeValue`** after `producthunt`
  - [ ] Do **not** reorder or rename existing literals; append only
- [ ] **T2** Extend primary `sourceMetadataValidator` (AC: 3)
  - [ ] Add optional top-level: `authorHandle`, `likes`, `reposts`, `replies`, `quotes`
  - [ ] Place new fields before `contributingSources` (group engagement fields logically)
  - [ ] Do **not** duplicate or change `contributingSources` child schema
- [ ] **T3** Add acceptance tests (AC: 4, 6)
  - [ ] Add twitter acceptance test after producthunt/github block (~line 435+)
  - [ ] Add bluesky acceptance test adjacent to twitter test
  - [ ] Use fixture URLs: `https://x.com/karpathy/status/123`, `https://bsky.app/profile/simonwillison.net/post/3ltest`
- [ ] **T4** Verify Convex + tests (AC: 5, 6)
  - [ ] `npx convex dev --once` from cns-dashboard
  - [ ] `npm test` — record pass count in Completion Notes
  - [ ] Optional: `bash scripts/verify.sh` from Omnipotent.md

## Dev Notes

### Exact validator change (binding)

```typescript
export const digestSectionValue = v.union(
	// ... existing literals ...
	v.literal('producthunt'),
	v.literal('twitter'),
	v.literal('bluesky')
);

export const digestSourceTypeValue = v.union(
	// ... existing literals ...
	v.literal('producthunt'),
	v.literal('twitter'),
	v.literal('bluesky')
);

export const sourceMetadataValidator = v.object({
	// ... existing optional fields ...
	commentCount: v.optional(v.number()),
	authorHandle: v.optional(v.string()),
	likes: v.optional(v.number()),
	reposts: v.optional(v.number()),
	replies: v.optional(v.number()),
	quotes: v.optional(v.number()),
	contributingSources: v.optional(/* unchanged */),
	dedupClusterSize: v.optional(v.number())
});
```

### Test fixtures (binding)

**Twitter:**

```typescript
{
  digestRunId: runId,
  section: 'twitter',
  sourceType: 'twitter',
  title: 'Sample tweet text',
  url: 'https://x.com/karpathy/status/1234567890',
  rank: 1,
  sourceMetadata: {
    authorHandle: 'karpathy',
    likes: 1200,
    reposts: 340,
    replies: 89,
    quotes: 12
  }
}
```

**Bluesky:**

```typescript
{
  digestRunId: runId,
  section: 'bluesky',
  sourceType: 'bluesky',
  title: 'Sample post text',
  url: 'https://bsky.app/profile/simonwillison.net/post/3ltest',
  rank: 1,
  sourceMetadata: {
    authorHandle: 'simonwillison.net',
    likes: 450,
    reposts: 120,
    replies: 34,
    quotes: 8
  }
}
```

### What must be preserved

- **`keywordSourceTypeValue`** — unchanged (keywords pipeline is separate; established in 65-1 / 67-5b).
- **`contributingSources[].sourceType`** — remains `v.string()` for forward-compat (68-1); do not tighten to union on child rows.
- **68-1 dedup fields** — `contributingSources`, `dedupClusterSize` unchanged.
- **Existing literals** — append only; no renames (`twitter` not `x`).

### Relationship to downstream stories

| Layer | Story | Repo | Depends on 68-4 |
|-------|-------|------|-----------------|
| Schema literals + social metadata | **68-4** | cns-dashboard | — |
| Bluesky adapter + scoring + task-prompt | **68-5** | Omnipotent.md | Yes — push uses `bluesky` literals |
| X/Twitter adapter | **68-6** | Omnipotent.md | Yes — push uses `twitter` literals |
| X integration + env docs | **68-7** | Omnipotent.md | Yes (via 68-6) |
| Live validation | **68-8** | Omnipotent.md artifact | Yes — needs ≥1 bluesky (+ optional twitter) row in Convex |

### WSL / cross-repo workflow

- Edit in **`cns-dashboard`** (sibling: `../cns-dashboard` from Omnipotent.md; override with `CNS_DASHBOARD_ROOT`).
- Verify locally in cns-dashboard first; Omnipotent.md `bash scripts/verify.sh` runs cns-dashboard tests when sibling exists.
- **No Omnipotent.md code** in this story — adapters reference these literals in 68-5/68-6 only.

### Anti-patterns (do not)

- Do not implement Bluesky/X fetch adapters in this story.
- Do not add `normalizeEngagement()` branches — that is 68-5/68-6/68-7 scope.
- Do not add task-prompt Source 11/12 sections.
- Do not use literal `'x'` instead of `'twitter'`.
- Do not run `npx convex deploy`.
- Do not hand-edit `schema.ts` — validator-driven shapes only.

### Previous story intelligence (68-1)

- Dedup engine already references `twitter` / `bluesky` in `SOURCE_PRIORITY` and `contributingSources` rows with `v.string()` contributor types — no 68-1 changes needed when literals land.
- 68-1 acceptance test at `digest.test.ts` line ~437 validates merged `contributingSources`; ensure new twitter/bluesky tests do not break that fixture.

### Project Structure Notes

- Target repo path: `{Omnipotent.md}/../cns-dashboard` or `CNS_DASHBOARD_ROOT`.
- Pattern mirrors **67-5c** (validators + digest tests) but adds **both** platforms and **sourceMetadata** social fields in one PR.

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.3–4.4, §6.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A1, §A3, §A5]
- [Source: `_bmad-output/implementation-artifacts/67-5b-producthunt-sourcetype-validator.md` — literal-add pattern]
- [Source: `_bmad-output/implementation-artifacts/67-5c-producthunt-section-and-push-validators.md` — paired section + acceptance tests]
- [Source: `_bmad-output/implementation-artifacts/68-1-cross-source-dedup-engine.md` — contributingSources forward-compat]
- [Source: `cns-dashboard/convex/validators.ts` — target file]
- [Source: `cns-dashboard/tests/convex/digest.test.ts` — acceptance/rejection tests]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

- `cns-dashboard/convex/validators.ts`
- `cns-dashboard/tests/convex/digest.test.ts`

---

## Story Completion Status

- **Status:** ready-for-dev
- **Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created for cns-dashboard schema gate unblocking 68-5 and 68-6.
