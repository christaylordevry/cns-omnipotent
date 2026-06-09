# ADR-E67-001: `last30days-skill` is a Codebook, Not a Dependency

**Date:** 2026-06-09  
**Status:** Accepted  
**Supersedes:** Amendment to Handoff 2026-06-08 §10 ("fork and run via subprocess")  
**Applies to:** Omnipotent.md, cns-dashboard, all future CNS/Nexus epics

---

## Context

An earlier planning document (Amendment to Handoff 2026-06-08) proposed forking
`github.com/mvanhorn/last30days-skill` into `~/ai-factory/projects/last30days-skill`
and running it as a subprocess from the CNS morning digest pipeline. The rationale
was that it would save 3–4 epics of custom ingest work.

Subsequent session planning (2026-06-09 kickoff) introduced a contradictory instruction:
clone to `last30days-skill-reference`, reference only, never run.

This ADR resolves the conflict and formally deprecates the "fork and run" proposal.

---

## Decision

`last30days-skill` is a **reference codebook only**. It is never a runtime dependency,
subprocess target, or imported module in any CNS or Nexus code.

**The "fork and run via subprocess" proposal is deprecated and must not be implemented.**

---

## Rules (binding for all future epics)

1. **Repo role:** `~/ai-factory/projects/last30days-skill-reference` exists solely as a
   read-only reference. Developers may study its adapter logic, endpoint patterns,
   pagination approaches, and engagement metric formulas. Nothing more.

2. **Language:** All CNS ingest adapters are implemented in Node.js/TypeScript.
   No new Python subprocesses are introduced into the ingest pipeline.

3. **Execution:** No CNS script, Hermes skill, or Convex function may `import`,
   `exec`, `spawn`, or `subprocess` the `last30days-skill` repo in any form.

4. **Ownership:** CNS owns every adapter it runs. All source adapters are
   Node.js `.mjs` files in `Omnipotent.md` following the imperative stdout
   threading pattern established in Epics 64–65.

5. **Reference use is optional and scoped:** The reference repo is relevant only
   when building a specific adapter where last30days has a proven implementation
   to study (e.g. Reddit public JSON, X/Twitter pagination, YouTube engagement
   scoring). It is not a general architecture reference.

---

## Rationale

**1. Node→Python subprocess boundary is a known failure mode.**
The Hermes HOME isolation bug (ADR pre-Epic-59) shows that subprocess boundaries
in this system introduce silent failures that are hard to detect and debug.
A Python subprocess with its own dependency tree and HOME assumptions would
multiply this risk significantly.

**2. CNS scoring and personal relevance are the differentiator.**
The strategic decision is to buy/borrow commodity ingest and build the orchestration,
scoring, and personal relevance logic in-house. Running last30days as the ingest
agent means outsourcing the signal collection to a third-party codebase and then
parsing prose back into structured Convex records. That is the opposite of the
intended architecture.

**3. Maintenance cost.**
Forking and running last30days would make CNS a solo-maintainer of scrapers against
hostile platforms (Reddit, X, TikTok, Instagram). These scrapers break frequently.
Reference-only access allows cherry-picking stable ideas without inheriting the
maintenance burden.

**4. Existing adapter pattern scales.**
The imperative stdout threading pattern (Epics 64–65) already works for GitHub, RSS,
Reddit (OAuth path), and HackerNews. The same pattern handles additional sources.
last30days' engagement metric formulas (log-scaled upvotes, PR velocity, etc.) can
be ported to TypeScript adapters directly.

---

## Consequences

- Epic 67 and beyond build all new source adapters in Node.js/TypeScript
- Reddit adapter resumes when OAuth credentials become available (not via last30days)
- X/Twitter adapter references last30days engagement logic but is implemented natively
- `last30days-skill-reference` clone is optional; only clone it when actively building
  an adapter that benefits from studying its implementation
- No Python dependency management required in the ingest pipeline

---

## What This Does Not Change

- The signal scoring model (five dimensions + derived disposition) — stays as-is
- The engagement normalization approach (log-scaled, cross-source capped) — stays as-is
- The `buildDigestSignals` assembly pattern — stays as-is
- The plan to expand source coverage in Epic 67 — stays as-is, just implemented natively
