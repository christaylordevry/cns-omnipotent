---
story_id: 89-3
epic: 89
title: judgment-shortlist-github-cap-and-polymarket-exclusion
status: backlog
created: 2026-07-21
operator_brief: 2026-07-21
blocked_by: judgment-shortlist-selector (WDS Phase 4 IA — not implemented 2026-07-21)
predecessors: 89-1
related: 89-1, 89-2, ia-cockpit.md, curation-selection-research-2026-07-21.md
moved_from: 89-1 (cut 2026-07-21 — no shortlist path to enforce)
---

# Story 89.3: Judgment shortlist — GitHub SHORTLIST_MAX + Polymarket type-exclusion

Status: backlog

> [!warning] Do not implement until a judgment shortlist selector exists
> As of 2026-07-21 there is **no** judgment shortlist in code (verified: zero hits for
> shortlist eligibility helpers in Omnipotent.md `scripts/` and cns-dashboard `src|convex/`;
> Discord post = chunking only; dashboard = rank-ordered feed). Implementing this story
> earlier means **building** the selector — Phase 4 IA work, undesigned here — or shipping
> unread knobs (silent no-op).

## Story

As a **CNS operator using the judgment shortlist (once it exists)**,
I want **GitHub limited to a small number of shortlist slots and Polymarket hard-excluded from every shortlist path**,
so that **standing-popularity repos and perpetual prediction markets cannot dominate the 3–5 items that deserve judgment — without a `rankScore` penalty**.

## Why these rules were cut from 89-1

89-1 is **data accumulation** (write STORE_MAX=40 GitHub rows/day). Selection rules belong
with the **selector**. Carrying them on 89-1 made the story claim UX ACs while labeling
itself non-UX, and had **no enforcement point**.

## Rationale (carry verbatim — do not re-derive)

### GitHub SHORTLIST_MAX=5

- GitHub is a **supporting** emergence source, not a dominant one.
- Domination matters in the **shortlist**, not the secondary feed.
- After STORE_MAX widen, ~40 GitHub rows may appear in the feed (~40 of ~110) — **fine**.
- At shortlist selection only: GitHub contributes **≤ 5** candidates.
- Env name when wired: `MORNING_DIGEST_GITHUB_SHORTLIST_MAX` (default 5) — **only** when
  selection code reads it. Do not add the env in 89-1.

### Polymarket — signal-TYPE exclusion (not a score penalty)

- Polymarket keywords work; output is still **structurally always-present** markets
  (level signal, not delta).
- **Hard-exclude** from **any** path that can surface an item into the top-ranked judgment
  shortlist — including secondary/fallback ranking paths. Cap = **0**.
- May continue to be **ingested and stored**.
- May appear as **inspector CONTEXT** once a topic is already under investigation
  ("is capital betting on this").
- **Do NOT** implement as a score penalty that a sufficiently high `rankScore` could
  overcome — it is a signal-type exclusion, not a tuning knob.
- Supersedes earlier ia-cockpit sketch of `polymarket ≤ 1`.

### Anti-patterns

- Do **not** add a shortlist-eligibility field on `digestSignals` as a workaround without
  an explicit OPS-2 contract story (row-shape change, dual-repo guard).
- Do **not** ship config knobs nothing reads.
- Priority among eligible rows remains `rankScore` **as stored** — no re-blend.

## Preconditions

1. A real judgment shortlist selection path exists (query and/or UI) — not raw feed top-N
   mistaken for a shortlist.
2. 89-1 has been shipping widened GitHub history long enough that Stage B (89-2) design is
   not blocked (selection can land in parallel with or after 89-2; coordinate).

## Acceptance Criteria (when unblocked)

1. GitHub contributes ≤ SHORTLIST_MAX (default 5) rows to the judgment shortlist.
2. `sourceType === 'polymarket'` never appears in any judgment-shortlist path (type exclusion).
3. Polymarket rows remain stored and inspectable as context.
4. Secondary feed may still show GitHub ≫ 5 and Polymarket rows.
5. Tests assert both rules against the real selector; verify.sh green.
6. No silent unread env; no undiscussed digestSignals schema / OPS-2 drift.

## Tasks / Subtasks

- [ ] Blocked until shortlist selector is designed + stubbed
- [ ] Wire SHORTLIST_MAX into selector only
- [ ] Wire Polymarket type-exclusion into every shortlist entry path
- [ ] Tests + verify

## Dev Notes

- Parent evidence + simulation: `89-1-digest-stage-a-github-store-max-widen.md`
- Design intent: `cns-dashboard/.../01-eric-morning-orient/ia-cockpit.md` (supersede poly≤1)
- Locks: no rankScore re-blend; no BD-5/BD-6; no confidence field

## Dev Agent Record

### Completion Notes List

- Created 2026-07-21 as destination for selection ACs cut from 89-1
