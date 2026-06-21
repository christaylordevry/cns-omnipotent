---
id: SPEC-nexus-entity-intelligence
epic: 73
status: draft
created: 2026-06-21
updated: 2026-06-21
companions:
  - functional-requirements.md
  - scope-boundaries.md
  - architecture-agenda.md
  - parent-session-constraints.md
  - architecture-diagrams.md
  - ../../../project-context.md
sources:
  - docs/brainstorming.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only.

# Nexus Entity Intelligence (Epic 73)

## Why

**Pain + opportunity.** The solo operator running Nexus as an intelligence cockpit cannot stay ahead of the market with a hand-maintained YAML watchlist alone. The harder problem — who or what should be watched in the first place, and which already-important entities are moving now — is unsolved. Entity resolution was identified as the second half of fully fleshing out the trend-intelligence pipeline (19 sources, ≤15-minute runs). This work introduces a dual-lane entity intelligence layer: monitor names that already matter, surface names beginning to matter, from inbound signals already collected — without reopening the parked LLM provider decision.

**Product position:** Nexus Entity Intelligence helps monitor the names that already matter and surface the names beginning to matter, using live inbound signals and explicit reasoning rather than a static hand-maintained list.

## Capabilities

- id: CAP-1
  intent: The operator sees two separate entity intelligence outputs — **Tracked Entities in Motion** (established watchlist members) and **Emerging Entities to Review** (not-yet-tracked candidates).
  success: Dashboard and digest render both lanes distinctly; neither lane collapses into a single ambiguous feed.

- id: CAP-2
  intent: The operator is notified when an already-tracked entity shows meaningful acceleration or unusual activity relative to its recent baseline (mentions, new sources/platforms, velocity, co-mention patterns).
  success: At least one tracked-entity acceleration signal in the first month feels meaningfully earlier or more interpretable than noticing the shift manually.

- id: CAP-3
  intent: The operator discovers entities not currently tracked that appear to be gaining relevance within inbound signals Nexus already collects.
  success: At least one surfaced emerging entity leads to a real decision (manual watchlist addition, follow-up research, or deeper monitoring) within the first month.

- id: CAP-4
  intent: Every surfaced entity includes intelligible reasons and supporting evidence (multi-signal presence, acceleration, cross-source spread, theme/entity adjacency, high-priority sources).
  success: The operator can usually understand why an entity appeared without reading code or logs.

- id: CAP-5
  intent: Surfaced entities appear as reviewable, read-only suggestions; v1 does not auto-write watchlist YAML or configuration.
  success: No automatic mutation of watchlist files or system configuration from this feature in v1.

- id: CAP-6
  intent: Entity intelligence runs as an analysis stage after source ingestion and normalization on existing collected signals — not as a new external adapter or Epic 72 source expansion.
  success: Feature ships with zero new ScrapeCreators/external digest sources; analysis consumes normalized signals from the existing ~19-source universe.

- id: CAP-7
  intent: The Nexus dashboard exposes dual modules (or tabs) with evidence cards — display name, type, why here, momentum summary, source traces, inspect/compare/save/manual-track actions.
  success: Both modules are present in the redesigned dashboard surface with the fields above.

- id: CAP-8
  intent: The daily digest includes a small ranked section for tracked entities accelerating now and emerging entities worth a look.
  success: Digest output includes both ranked sections; feature remains useful outside the dashboard.

## Constraints

- **Epic 73** — separate from Epic 72 (source-adapter expansion). Do not route through Epic 72 adapter/three-list-class pattern.
- **No LLM for v1** — must not require resolving the parked LLM provider issue (`ANTHROPIC_API_KEY` dead; fix vs OpenRouter unresolved). No LLM calls to ship v1. See `functional-requirements.md` (NFRs) and `parent-session-constraints.md`.
- **Structured-field-first** — v1 leans on existing structured fields and deterministic scoring; free-text extraction is v2.
- **Emergence logic required** — not plain long-window frequency counting; compare short-window momentum to a recent baseline (exact thresholds deferred — see `architecture-agenda.md` Q1).
- **v1 discovery claim** — emergence detection from inbound signals already collected, not open-world or outbound topic-to-entity discovery.
- **Separate lanes** — monitoring (established) and emergence (candidates) must not share one ambiguous scoring model or feed.
- **Human-in-the-loop** — reviewable suggestions until recommendation quality is proven.
- **Validator/registry discipline** — new Convex tables/mutations must round-trip through real mutation validators via canonical fixtures; new health/status surfaces live-verified against prod. See `parent-session-constraints.md`.
- **Entity model breadth** — conceptual model supports people, companies/orgs, products/tools, repos/projects; v1 mechanism for non-person entities is unresolved (see `architecture-agenda.md` Q2).
- **Persistence for baselines** — acceleration vs baseline likely requires stored entity-mention history; data-model choice deferred to architecture (Q5). Persistence is for trend computation only, not approved/dismissed suggestion state.

## Non-goals

See `scope-boundaries.md` for the full v1 out-of-scope list. Summary:

- One-click approve mutating YAML/watchlist files automatically
- Full cross-platform identity linking
- True outbound topic-to-entity discovery outside existing signal universe
- Rich free-text extraction (titles, summaries, abstracts, repo descriptions)
- Full company/org canonicalization and profile graphing
- Autonomous entity writing or automatic watchlist governance
- New ScrapeCreators/external adapters or Epic 72 source-registry pattern
- Any LLM dependency for v1 shipment

## Success signal

Within the first month: the feature surfaces a small number of genuinely relevant candidates or spikes (not mostly obvious noise); at least one emerging entity drives a real operator decision; at least one tracked acceleration signal is meaningfully useful vs manual observation; reasons are understandable; the feature stays in regular dashboard/digest flow rather than being ignored. Judged on awareness and decisions, not card volume.

## Assumptions

- Epic **73** is the next epic number after in-progress Epic 72.
- Existing 19-source pipeline performance is adequate (≤15-minute runs within cron watchdog window).
- Structured author/profile/entity-adjacent fields on current signals are sufficient to ship a useful v1 without free-text extraction.
- Watchlist membership for "tracked" lane is defined by existing operator watchlist configuration (e.g. people watchlist loader / YAML), not redefined here.

## Open Questions

Deferred to **`architecture-agenda.md`** — do not answer in implementation until architecture resolves:

- Q1 — Threshold ownership and default window lengths
- Q2 — v1 mechanism for non-person entities (structured org fields vs defer to v2)
- Q3 — Structured definition of "co-mentioned with tracked themes"
- Q4 — Cold-start detection path for emerging lane (no baseline)
- Q5 — Persistent state / data-model for entity-mention history and baselines
