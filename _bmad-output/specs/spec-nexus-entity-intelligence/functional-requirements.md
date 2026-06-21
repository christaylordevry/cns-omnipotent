# Functional and Non-Functional Requirements

Verbatim from source PRD (`docs/brainstorming.md`). Normative for Epic 73.

## Functional requirements

### FR1: Support two lanes of entity intelligence

The system must maintain separate logical outputs for:

- established tracked entities, and
- emerging candidate entities.

### FR2: Detect tracked-entity acceleration

The system must identify when an already-tracked entity shows a meaningful change in activity relative to its recent baseline, such as:

- more mentions than usual,
- appearance in new sources/platforms,
- sudden increase in discussion velocity,
- unusual co-mention patterns with important topics or entities.

### FR3: Surface emerging candidates from existing data

The system must identify entities not currently tracked that appear to be gaining relevance within the inbound signals already collected by Nexus.

### FR4: Provide reasons and evidence

Every surfaced entity must include intelligible reasons for why it appears, such as:

- appeared in multiple signals,
- accelerated compared with prior window,
- now present across several source types,
- co-mentioned with tracked themes or tracked entities,
- seen in high-priority signal sources.

### FR5: Keep suggestions read-only in v1

The system must not auto-write surfaced candidates into YAML or other watchlist configuration in v1. Suggestions are to be reviewed by the user and acted on manually outside the feature until recommendation quality is proven.

### FR6: Work on top of existing signal collection

The system must behave as an analysis stage that runs after source ingestion and normalization, rather than as a new external adapter.

## Non-functional requirements

- Must not require resolving the parked LLM provider issue to ship v1.
- Must produce auditable outputs with understandable reasons, not opaque scores only.
- Must keep false positives low enough that the feature does not become noise.
- Must be modular enough to accept richer extraction inputs later without redesigning the product surface.
- Must preserve the distinction between known watchlist monitoring and emergence detection.

## Detection logic direction (principles — thresholds deferred)

### Established lane: tracked entities in motion

The established lane should answer: **What entities already on the watchlist are having a moment right now?**

This lane should not simply repeat baseline activity. It should emphasize change. Valuable signals include:

- activity above normal baseline,
- sudden cross-platform spread,
- new source-type penetration,
- abrupt increase in mentions or interactions,
- clustering around important narratives or topics.

### Emerging lane: entities to review

The emerging lane should answer: **What entities not yet tracked appear to be gaining meaningful traction?**

This should prioritize:

- acceleration over a short period,
- repeated presence within a compact time horizon,
- cross-source appearance,
- adjacency to tracked themes or tracked entities,
- concentration in high-signal sources.

### Windowing principle

- A short window for current acceleration or spikes.
- A longer baseline window for comparison and context.

Emergence should be detected through change relative to baseline, not only absolute counts. Exact thresholds intentionally unlocked — see `architecture-agenda.md` Q1.

### Entity types (conceptual model)

The conceptual entity model should support at least:

- People
- Companies/organizations
- Products/tools
- Repos/projects

The first implementation may be structurally strongest for people and posting entities because that is where structured fields are richest, but the system must not be framed as people-only. v1 mechanism for non-person entities — see `architecture-agenda.md` Q2.
