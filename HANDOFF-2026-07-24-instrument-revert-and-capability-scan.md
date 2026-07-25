# HANDOFF 2026-07-24 — INSTRUMENT revert + capability-parity scan

**Read this first.** This session was almost entirely on the sibling repo **cns-dashboard**
(`cns-redesign` branch), not Omnipotent.md. No Omnipotent.md commits this session. Supersedes the
design-direction sections of the redesign memory — **the design is now INSTRUMENT, not Monera.**

---

## TL;DR

The `/nexus` cockpit design was **reverted from Monera → INSTRUMENT** after the operator got
overwhelmed and asked to "go back to the first design I loved." All shipped + pushed on
cns-dashboard `cns-redesign` (`origin` at `f90723b`, parity 0/0):

| SHA | What |
|---|---|
| `ae02e5c` | Stage 2a design record (Monera target + S01–S04 IA refinements) |
| `3d0d79d` | Stage 2a Monera Morning Cockpit on `/nexus` (live Convex) |
| `1ed8f46` | **89-3** judgment-queue selection quality — source-class caps + substance floor |
| `f90723b` | **INSTRUMENT re-skin** — reverted the Monera look to the operator's chosen target |

Then: a full **capability-parity GitHub scan** (artifact below). Verdict: no capability hole; the
system is at/ahead of parity; the gap is **deploy**.

---

## The design arc (don't relitigate)

1. **Stage 2a** shipped the Monera Morning Cockpit (deep glass, viz violet/magenta/lime/cyan).
2. **89-3** fixed selection quality — the queue was surfacing tweet noise. Source-class caps
   (social ≤1, markets/repos/video ≤1, trends ≤2) + a **raw-clamp substance floor ≥10**.
   ⚠️ Review-gate catch worth remembering: prod scores are **0–100 ints**, so the floor must NOT
   route through `normalizeScorePercent` — its `value<=1 ? *100` branch turns a raw `1` into `100`
   and defeats the floor. Uses `clampRawScore0to100` instead. Live queue is now a real mix
   (github · polymarket · 1 tweet · google_trends · producthunt).
3. **Stage 3 /trends unification** — attempted, spiked (Monera tokens on the /trends instrument
   surface), operator got **overwhelmed** ("what's the point of these cards") and rejected it.
   **ABANDONED.** Reverted the one dirty file (`trends-theme.css`); `/trends` left as-is (old navy
   instrument) and is being **ignored**. Do NOT resume /trends work unless asked.
4. **Revert to INSTRUMENT.** "The first design I loved" = the **INSTRUMENT target** (published as
   artifact "Nexus Morning Cockpit — INSTRUMENT target", Jul 23). Source recovered from a
   prior-session scratchpad and preserved into
   `cns-dashboard/_bmad-output/D-Design-System/nexus-cockpit-instrument-target.html`.
   Airlinesim-grounded: near-black `#111`, flat hairline panels, tight radii (10/6), **single cyan
   accent** (`#0090C0` dark / `#006D95` light), semantic gain/loss/warn.

### How the re-skin was done (elegant, reusable)

**Token-only change** (`f90723b`): rewrote `src/lib/styles/cns-tokens.css` to the instrument
palette, **keeping the `--color-viz-*` token NAMES** but repointing them to the cyan/accent family
so `cockpit-monera.css` + `NexusMorningCockpit.svelte` render instrument with **zero component
edits**. The token architecture paid off — one file changed the whole look. 763/763 tests, lint 0,
dark+light verified live via Playwright.

**Honesty preserved:** the INSTRUMENT mockup showed demo-data affordances (per-signal
sparklines, a trajectory line, a "Confidence 62 · capped single-family" box) that the real data
can't honestly fill. These were **NOT reproduced** — the cockpit keeps its honest level bars,
honest-empty trajectory, and "signal strength" (not fake confidence). Those remain a DATA task,
not a paint job.

---

## Capability-parity scan

Operator asked to "research the entire system, find what's missing, search GitHub, pull it in."
Ran a web-search GitHub scan (firecrawl was 401/offline). Deliverable artifact (INSTRUMENT-styled):
**https://claude.ai/code/artifact/9dad5ea5-d21d-43ce-a45c-659a9a80968c**

**Verdict: no capability hole.** Comparables are things we already do or chose not to:
- **Nexus/digest** ≈ Horizon (our pipeline), Meridian (embeddings→UMAP/HDBSCAN clustering). Parity.
- **Vault/PAKE** — Khoj (chat-over-vault + /research deep mode). *Partial gap* if the operator
  wants a conversational vault copilot.
- **Memory** — Cognee/Zep/Mem0. We have Honcho (the pillar) — adding another = surface. Skip.
- **Hermes** — search literally returned Hermes as best-in-class. Ahead.

⚠️ **Correction to the artifact's one "needle-mover":** I flagged Meridian's clustering as fixing
the YouTube dedupe-over-collapse — but **90-4 (`610d5e3`, 2026-07-23) already fixed that**
(`canonicalDomainPath` embeds youtube `v=`, entity-match proportion ≥0.5). So even the single real
find is largely already closed — which only strengthens the "no capability gap" conclusion. If ever
revisited, Meridian-style density clustering is a *more general* approach than the 90-4 point-fix,
but there is no acute bug driving it.

---

## ⚠️ Strategic pattern (load-bearing)

This whole session = **polish → overwhelm → revert**, then "let's pull in more github software."
That is live, textbook confirmation of the standing thesis: the system is **over-built**; the
bottleneck is **deploy/revenue, not capability or design**. The capability scan confirmed it from
the outside. When the operator drifts to build/polish, surface this. The needle-mover is **shipping
what exists in front of someone**, not more software. See memory
`project_strategic_bottleneck_deploy_not_build`.

---

## State + open threads

- **cns-dashboard `cns-redesign`**: pushed clean at `f90723b`. `/nexus` = INSTRUMENT cockpit (89-3
  selection intact, honest primitives intact). `/trends` = untouched navy, ignored. One orphan
  untracked doc left in tree: `_bmad-output/implementation-artifacts/cns-redesign-stage-3-trends-monera-unification.md`
  (abandoned Stage 3 story — harmless, remove if you want).
- **Omnipotent.md**: no commits this session; branch still `hermes-consolidation`.
- **Memory updated** this session: `project_cns_redesign_open_design.md` (new INSTRUMENT block at
  top; Monera marked superseded) + MEMORY.md index line.
- **Optional next (only if operator asks):** Meridian-style clustering (general, no acute bug);
  Khoj-style vault research-copilot (new surface, only if they'd use it). **Recommended next: not
  more building — deploy.**
