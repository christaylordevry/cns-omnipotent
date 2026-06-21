# v1 Scope Boundaries

Verbatim from source PRD (`docs/brainstorming.md`).

## v1 promise

Nexus will analyze existing inbound signals and surface:

- important already-tracked entities that are accelerating or unusually active, and
- not-yet-tracked entities that appear to be gaining traction and deserve review.

## v1 outputs

| Output | Description | Primary action |
|---|---|---|
| Tracked Entities in Motion | Existing watchlist members showing unusual activity, acceleration, or cross-source spread | Inspect now |
| Emerging Entities to Review | Not-yet-tracked entities surfaced from current signals with reasons and evidence | Decide whether they deserve tracking |

## Scope decision

**v1 should not promise true open-world discovery.** Instead, v1 should promise **emergence detection from the inbound signals Nexus already collects**, plus improved monitoring for entities that are already tracked.

Passive aggregation of inbound signals cannot find entities the current source universe never touched.

## In scope for v1

- Analysis stage on top of existing signals.
- Separate outputs for tracked and emerging entities.
- Reviewable, read-only entity suggestions.
- Reasoned evidence cards or explanation text for surfaced entities.
- Acceleration/emergence framing rather than pure long-window counting.
- Support for current tracked-entity momentum signals.

## Out of scope for v1

- One-click approve that mutates YAML or watchlist files automatically.
- Full cross-platform identity linking across all networks.
- True outbound topic-to-entity discovery outside the existing signal universe.
- Rich free-text extraction across titles, summaries, abstracts, repo descriptions, and arbitrary text.
- Full company/org canonicalization and profile graphing.
- Autonomous entity writing or automatic watchlist governance.

## Future roadmap (not v1)

### v2: richer extraction and better recall

After the LLM provider decision is resolved or a separate extraction path is chosen: entity extraction from free text (headlines, summaries, repo descriptions, abstracts). Expected gains: better company/product detection, stronger non-author entity coverage.

### v3: topic-driven outbound discovery

Genuine topic-to-entity expansion by proactively searching outward from strategic themes — not the shippable v1.

## Decision summary

| Decision | Outcome |
|---|---|
| Primary product need | Track both established and emerging entities |
| v1 approval model | Read-only suggestions first |
| v1 system type | Analysis stage on top of existing signals |
| v1 discovery claim | Emergence detection from inbound signals, not full open-world discovery |
| v1 extraction bias | Structured-field-first, deterministic where possible |
| Already-tracked entities | Do not exclude; surface them in a separate acceleration lane |
| Detection style | Compare short-window momentum to a recent baseline |
| v1 watchlist mutation | Not allowed |
| Free-text extraction | Explicit v2, blocked on provider/extraction path |
| Longer-term direction | Add richer extraction, then topic-driven outbound discovery |
