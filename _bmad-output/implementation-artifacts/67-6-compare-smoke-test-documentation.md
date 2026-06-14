---
story: 67-6
key: 67-6-compare-smoke-test-documentation
status: done
epic: 67
closed: 2026-06-14
---

# Story 67-6 — Compare Smoke Test & Documentation

## Summary

Verified the Compare action in the Nexus Intelligence Inspector works
end-to-end against live production digest data. Also resolved a blocking
infrastructure bug that prevented Compare from being enabled at all.

## Blocker resolved (not originally in scope — fixed as prerequisite)

**Root cause:** `isCompareEnabled()` in
`src/lib/utils/nexus-investigation.ts` used `import.meta.env.PUBLIC_NEXUS_COMPARE_ENABLED`
instead of SvelteKit's `$env/static/public` module. SvelteKit does not
register `import.meta.env.PUBLIC_*` vars in its env pipeline — Vite
tree-shook the check to `function it(){return!1}` (hardcoded false) at
build time. Setting `PUBLIC_NEXUS_COMPARE_ENABLED=true` in Vercel's env
panel had no effect across multiple redeployments because the var never
entered the Vite build.

**Fix (Cursor quick-dev):** Switched to `import { PUBLIC_NEXUS_COMPARE_ENABLED }
from '$env/static/public'` — the correct SvelteKit static env import. Added
`$env/static/public` types in `src/app.d.ts`, a vitest module mock, and
updated the unit test. 516 tests pass.

**Build verification:**
| State | Compiled `isCompareEnabled` |
|-------|-----------------------------|
| Before fix | `function it(){return!1}` |
| After fix, var=true | `function it(){return ce===\`true\`}` (inlined "true") |
| After fix, var unset | `function it(){return ce===\`true\`}` (ce="" → false) |

Both Vercel env vars were confirmed set before the fix landed:
- `PUBLIC_NEXUS_COMPARE_ENABLED=true` — Vercel Production env panel
- `NEXUS_COMPARE_ENABLED=true` — Convex prod (`npx convex env list --prod`)

## Smoke test — observed behavior

**Date:** 2026-06-14
**Signal tested:** `langgenius/dify` (GH source, from June 14 digest run
`md70xk1gw26ket5ggpdt51kqc588kc58`, top trend: biotech AI)
**Compared against:** prior signals for same entity in Convex

**UI behavior confirmed:**
- Compare button clickable (no longer greyed out / disabled tooltip)
- Inspector transitions to COMPARE panel with "Back" button
- AI-generated narrative renders correctly, referencing actual dimensional
  scores from the signal record
- "Run again" button present and functional

**Sample Compare output observed:**
> "The latest signal for 'langgenius/dify' shows a consistent rank score of
> 41.00, unchanged from the second prior signal, indicating stability in
> perceived importance. The momentum and novelty also remain the same,
> reflecting continued interest and freshness in the topic. Notably, the
> urgency dimension has decreased from 68.00 in the first prior signal to
> 57.00 in the current and second prior signal, suggesting a slight decline
> in the immediacy or pressure associated with this topic. Maintain a watchful
> stance as the interest level remains high with stable engagement metrics."

This confirms: cross-signal comparison is working, dimensional score history
is accessible to the Compare AI call, and the narrative is coherent and
grounded in real score data (not hallucinated).

## Production data available for Compare

| Run ID | Date | Top Trend | Status |
|--------|------|-----------|--------|
| `md70xk1gw26ket5ggpdt51kqc588kc58` | 2026-06-14 | biotech AI | published |
| `md75by2ca2t1vxd5z64eczj1ds88kcmk` | 2026-06-13 | AI agents | published |
| `md78f8jg65425wprqprg8fxn4n88eced` | 2026-06-12 | AI agents | published |

Note: two additional June 12 runs (`md7cymz7...`, `md724cqqh...`) are also
published — same date, same trend. Known fragility (no unique constraint on
date in `digestRuns`); tracked separately, not blocking.

## Definition of done — confirmed

- [x] Compare button enabled in production
- [x] Compare renders AI narrative grounded in real score data
- [x] "Run again" available for re-comparison
- [x] ≥2 digest runs with overlapping signals available in Convex
- [x] Root cause of feature flag bug documented and fixed
- [x] 516 tests pass post-fix

## Epic 67 closure

With 67-6 done, Epic 67's planned scope is complete:

| Story | Status |
|-------|--------|
| 67-1 live digest validation | done |
| 67-2 Reddit OAuth | backlog (research task — OAuth not credential issue) |
| 67-3 personalRelevance v2 | done |
| 67-4 Signal Seeds chip→Inspector | done |
| 67-5 ProductHunt adapter | done |
| 67-5b/c producthunt sourceType/section | done |
| 67-6 Compare smoke test | **done** |
| 67-7 Digest execution reliability | done |
| 67-8 through 67-11 | done |

67-2 (Reddit OAuth) remains backlog — it is a research task (OAuth failure
mode not yet diagnosed), not a missing-credential task. Deferred to its own
investigation spike.

Epic 67 → `done` (pending sprint-status.yaml update).
