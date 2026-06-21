# Brainstorming Handoff — Nexus Entity Intelligence Feature

**Purpose of this document:** This is a handoff brief for the BMAD architecture workflow in Cursor. It contains a fully-developed product brief (second draft) plus a set of explicitly unresolved design questions that should be worked through as part of the BMAD back-and-forth, not treated as already-decided. Use the PRD section as the substantive starting point; use the Open Questions section as the discussion agenda for the architecture phase.

**How this came about:** This feature emerged from a broader session focused on getting Nexus's trend-intelligence pipeline (the morning digest, 19 sources as of today) "fully fleshed out." Pipeline performance was ruled out as a current problem (today's real 19-source run completed in ≤15 minutes, comfortably within the cron watchdog window — confirmed via live data, not assumed). Entity resolution was identified as the second, genuinely unsolved half of that goal. Through iterative research and self-questioning, the framing evolved from "dynamic entity resolution" (too broad, conflates several different systems) to the dual-lane Entity Intelligence model below.

**Constraint carried over from the parent session:** There is a separate, currently-parked architectural decision about LLM provider consolidation (the research-chain's Anthropic API key is dead; whether to fix it or migrate to OpenRouter/subscription routing is unresolved). This feature is explicitly designed to ship without depending on that resolution — see the PRD's non-functional requirements and Risk 4.

---

# Nexus PRD: Entity Intelligence, Watchlists, and Emergence Detection

## Overview

This product requirements document defines a new intelligence layer for Nexus: a system that helps a solo operator stay ahead of the market by tracking both established entities already known to matter and emerging entities beginning to matter across the signal universe Nexus already collects.

The core design conclusion is that Nexus should not depend on a hand-maintained people list as its primary intelligence model. Instead, it should treat entity intelligence as an analysis stage on top of existing signals, with two connected but distinct lanes: a monitoring lane for established entities and an emergence lane for entities that are gaining traction and deserve attention.

This brief also captures an important strategic constraint: v1 should ship without reopening unresolved LLM provider dependencies. That means the first version should lean on existing structured fields and deterministic scoring wherever possible, while explicitly deferring richer free-text extraction and broader outbound discovery into later phases.

## Product context

Nexus is intended to function as a live intelligence operating layer rather than a passive dashboard. Its purpose is to keep one operator "ear to the ground" across markets, people, tools, narratives, and opportunities, while translating those signals into ranked, decision-relevant outputs rather than raw streams of links or posts.

That positioning matters for this feature. The entity layer is not being introduced to solve a generic CRM-style contact-management problem or a pure identity-resolution problem. It exists to strengthen the system's ability to answer questions like:

- Who already matters and is moving right now?
- Who or what is starting to matter before it becomes obvious?
- Which people, companies, products, tools, or repos deserve more attention based on live signals?
- Which existing watchlist members are having a moment and therefore require interpretation or action?

## Problem statement

The current watchlist model is fundamentally manual. A hand-maintained YAML list can work as a basic registry of people already known to matter, but it does not solve the harder and more valuable problem: helping the system determine who or what should be watched in the first place.

Several distinct problems were considered during ideation:

| Problem shape | Description | Value | Status in this PRD |
|---|---|---|---|
| Cross-platform identity linking | Unifying the same person across X, Bluesky, LinkedIn, Threads, and other platforms | Useful later for enrichment and profile unification | Deferred from v1 |
| Auto-discovery from existing signals | Surfacing people or entities already present in collected data that appear important enough to track | High immediate value | In scope |
| Topic-to-entity expansion | Finding relevant people or companies beyond what current sources have already surfaced | Very high value, truer discovery | Deferred from v1 |
| Company/org resolution | Building canonical company profiles and links across repos, posts, sites, and sources | High value, broader than people-only | Partially planned, not fully in scope for v1 |

The most important conclusion from the project work so far is that the true user pain is not mainly identity stitching. The core pain is not knowing who or what should be tracked in the first place, while also wanting better awareness of already-established players.

## Product goal

The goal of this feature is to make Nexus better at staying ahead of the market by introducing a dual-lane entity intelligence system:

1. A lane for established entities that are already strategically important and should be continuously monitored for unusual movement or acceleration.
2. A lane for emerging entities that the system surfaces from inbound signals because they appear to be gaining momentum and may soon matter.

This goal intentionally combines two needs the user has stated explicitly:

- Track established people or entities who already matter.
- Surface emerging people or entities that may become important before the market fully recognizes them.

## Product principles

### Start from signals, not a pre-decided list

The entity system should be derived from the signals Nexus already collects, not from a static registry that claims to know everything worth following in advance.

### Separate monitoring from emergence

Established monitoring and emergence detection are related but different jobs. The scoring logic, user action, and product meaning differ enough that they should not be collapsed into one ambiguous feed.

### Favor reviewable intelligence over automation theater

The first version should surface reviewable suggestions and stateful intelligence, not automatically mutate watchlist files or system configuration. Human-in-the-loop patterns are more appropriate while the quality of recommendations is still being proved.

### Ship without unresolved provider dependencies

Wherever possible, the first version should use deterministic or structured inputs already available from the pipeline. Free-text extraction and richer entity parsing should be explicitly documented as later work that depends on LLM provider resolution or a separate extraction layer.

### Optimize for being early, not just being comprehensive

If the product promise is staying ahead, then the system must care about acceleration, spikes, and new movement patterns, not only raw frequency over long windows.

## Strategic framing

This feature should not be framed as "dynamic entity resolution" in the abstract. That phrase is too broad and hides several materially different systems. The more accurate framing is:

**Entity Intelligence for Nexus = monitored watchlists + emergence detection from inbound signals.**

That framing preserves a clean v1 scope and makes later phases more legible:

- v1: emergence detection from current signals plus stronger monitoring of established entities
- v2: richer extraction from free text, better company/product coverage, stronger clustering
- v3: topic-driven outbound discovery beyond the current signal set

## Users and use cases

### Primary user

The primary user is a solo operator/founder using Nexus as a premium intelligence cockpit to maintain ambient awareness across markets, narratives, tools, capital, and people relevant to leverage and opportunity.

### Core jobs to be done

- Understand which already-important people or organizations are having a moment right now.
- Notice emerging names, tools, or organizations before they become obvious.
- Decide whether a surfaced entity deserves deeper research or ongoing tracking.
- Preserve context around why an entity was surfaced instead of relying on vague intuition.
- Build confidence that the system is truly surfacing useful candidates rather than noisy vanity outputs.

## Scope decision

The project work to date supports a clear scope decision:

**v1 should not promise true open-world discovery.** Instead, v1 should promise **emergence detection from the inbound signals Nexus already collects**, plus improved monitoring for entities that are already tracked.

This distinction matters because passive aggregation of inbound signals cannot find entities the current source universe never touched. That is a narrower problem than full topic-to-entity discovery, but it is still highly useful if stated honestly and implemented well.

## v1 product definition

### Feature name

Working internal names:

- Entity Intelligence
- Emerging and Established Entities
- Watch + Surface
- Tracked Entities in Motion + Emerging Entities

The strongest conceptual naming split is:

- **Tracked Entities in Motion** for established entities
- **Emerging Entities to Review** for candidate entities

### v1 promise

Nexus will analyze existing inbound signals and surface:

- important already-tracked entities that are accelerating or unusually active, and
- not-yet-tracked entities that appear to be gaining traction and deserve review.

### v1 outputs

| Output | Description | Primary action |
|---|---|---|
| Tracked Entities in Motion | Existing watchlist members showing unusual activity, acceleration, or cross-source spread | Inspect now |
| Emerging Entities to Review | Not-yet-tracked entities surfaced from current signals with reasons and evidence | Decide whether they deserve tracking |

## Design fork decisions captured

### Approval workflow

The recommended and accepted sequencing for approval is read-only suggestions first. This means surfaced entities should appear in the digest and dashboard as reviewable suggestions with supporting reasons, but should not automatically update watchlist files or configuration.

### Extraction strategy

The safest initial extraction path is structured-field-first, explicitly deferring richer free-text extraction to a later version dependent on provider resolution or a separate extraction layer.

However, the ideation process also surfaced a more important correction: a plain frequency-based author aggregation feature is not enough if the goal is staying ahead. v1 therefore needs emergence logic, not just entity counting.

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

## Signal model and conceptual data flow

The broader Nexus signal model already points in the right direction:

sources -> raw signals -> classified entities -> scored events -> dashboard feeds -> actions.

This feature inserts itself between scored signals and product presentation as an entity-intelligence analysis stage.

Conceptually:

1. Existing sources produce normalized signals.
2. The entity-intelligence stage reads author/profile/entity-adjacent fields and signal metadata.
3. It builds candidate entities and tracked-entity activity summaries over defined windows.
4. It scores them for emergence or acceleration.
5. It emits two output sets: tracked entities in motion, and emerging entities to review.
6. The dashboard and digest render those outputs with evidence and reasoning.

## Detection logic direction

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

## Windowing and time horizons

A key insight from ideation is that a long rolling window alone can make the feature laggy and backward-looking. Weak-signal detection and mention-spike systems are more useful when they compare a short active window to a recent baseline rather than simply tallying long-run frequency.

Therefore, the intended logic direction is:

- A short window for current acceleration or spikes.
- A longer baseline window for comparison and context.

This PRD intentionally does not lock exact thresholds yet, but it does lock the principle that emergence should be detected through change relative to baseline, not only absolute counts.

## Entity types

People-only is probably too narrow for the product promise of staying ahead of the market. A useful intelligence cockpit needs room to surface more than authors.

Therefore the conceptual entity model should support at least:

- People
- Companies/organizations
- Products/tools
- Repos/projects

The first implementation may be structurally strongest for people and posting entities because that is where structured fields are richest, but the PRD should not frame the system as people-only. Doing so would undercut the larger market-awareness goal.

## UI and product surface

### Dashboard modules

The redesigned dashboard should include two modules or two tabs within one module:

| Module | Purpose |
|---|---|
| Tracked Entities in Motion | Monitor established entities and flag unusual momentum |
| Emerging Entities to Review | Surface new candidates with reasoning and evidence |

Each surfaced entity should include:

- display name,
- type,
- why it is here,
- activity/momentum summary,
- supporting source traces,
- quick actions such as inspect, compare, save, or manually track later.

### Digest surface

The daily digest should be able to include a small ranked section for:

- tracked entities accelerating now,
- emerging entities worth a look.

This keeps the feature useful even outside the dashboard and supports the broader goal of ambient awareness.

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

## Risks and trade-offs

### Risk 1: High precision but low recall

If v1 leans too heavily on structured fields and known authors, it may mostly surface established posters rather than genuinely early signals.

Mitigation:

- Emphasize acceleration over steady-state counts.
- Keep the feature framed as emergence-from-inbound-signals, not universal discovery.
- Evaluate whether surfaced entities are genuinely decision-relevant.

### Risk 2: People-only bias

If the system becomes people-only in practice, it may miss much of what matters in the market, including tools, products, companies, and repos.

Mitigation:

- Keep the PRD entity model broader than people only.
- Design the UI language around entities rather than just people.

### Risk 3: Noise and obviousness

The feature could devolve into showing familiar names the user already knows, making it feel redundant or ornamental.

Mitigation:

- Include spike logic for tracked entities.
- Include emergence logic for untracked entities.
- Define success criteria tied to actual usefulness, not just output volume.

### Risk 4: Hidden dependency creep

Free-text extraction could quietly become a v1 dependency and reopen the parked provider problem.

Mitigation:

- Explicitly gate richer extraction to v2.
- Keep v1 shippable on current structured inputs.

## Success criteria

This feature should not be judged by whether it produces a lot of cards. It should be judged by whether it improves awareness and decisions.

Proposed success criteria for initial evaluation:

- Within the first month, the feature surfaces at least a small number of genuinely relevant candidates or spikes rather than mostly obvious noise.
- At least one surfaced emerging entity leads to a real decision such as manual addition to a watchlist, follow-up research, or deeper monitoring.
- At least one tracked entity acceleration signal feels meaningfully earlier or more interpretable than noticing the shift manually.
- The user can usually understand why an entity appeared without reading code or logs.
- The feature is trusted enough to stay in the regular dashboard/digest flow rather than being ignored.

## Evaluation questions

The following questions should be used after an initial version exists:

- Did this surface entities that were actually worth caring about?
- Did it mostly show familiar names, or did it produce at least some useful novelty?
- Did the tracked-entity lane catch momentum changes early enough to matter?
- Did the emerging lane feel like signal or noise?
- Did the reasons shown for surfaced entities help the user trust the output?
- Did the lack of free-text extraction materially limit usefulness, or was v1 still strong enough to justify iteration?

## Future roadmap

### v2: richer extraction and better recall

After the LLM provider decision is resolved or a separate extraction path is chosen, the next major expansion should add entity extraction from free text such as headlines, summaries, repo descriptions, and abstracts.

Expected gains:

- better company detection,
- better product/tool detection,
- stronger non-author entity coverage,
- broader recall of entities mentioned by others rather than only entities posting directly.

### v3: topic-driven outbound discovery

A later and more ambitious phase can pursue genuine topic-to-entity expansion by proactively searching outward from strategic themes, categories, or market areas rather than relying only on the current inbound signal universe.

That is the phase that more closely matches full discovery, but it should not be confused with the shippable v1.

## Recommended product position

The cleanest way to describe the feature inside the broader Nexus system is:

**Nexus Entity Intelligence helps monitor the names that already matter and surface the names beginning to matter, using live inbound signals and explicit reasoning rather than a static hand-maintained list.**

That sentence captures the product promise, the dual-lane model, and the strategic scope boundary.

## Decision summary

The ideation and research so far support the following decisions:

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

## Conclusion

This feature is worth pursuing, but only with the right framing. A naive entity-suggestion feature based purely on recurring authors would likely be too narrow and too backward-looking for the stated goal of staying ahead. A stronger and more honest v1 is a dual-lane entity-intelligence layer: one lane that flags tracked entities in motion, and one lane that surfaces emerging entities to review from the inbound signal universe already available to Nexus.

That version is concrete, strategically aligned, shippable without reopening parked infrastructure decisions, and broad enough to matter while still disciplined enough to build safely.

---

# Open Design Questions — To Resolve During BMAD Architecture Workflow

These were raised in review of the PRD above and are deliberately **not yet answered**. They should be worked through as part of the architecture/back-and-forth process in Cursor, not assumed.

### Q1. Thresholds are intentionally unlocked — who locks them, and when?

The PRD explicitly defers exact window lengths and spike thresholds. Decide: should the architecture workflow propose concrete starting defaults (e.g. 7-day active window vs. 30-day baseline) as part of this phase, explicitly flagged as tunable and revisable — the same way other recent CNS work (e.g. Polymarket's scoring weights) left first-pass numbers loose rather than over-engineering them upfront? Or should specific numbers be decided by the operator before implementation starts? Recommend resolving this explicitly rather than letting it stay ambiguous into dev-story.

### Q2. "Broader than people-only" needs an actual v1 mechanism, not just a stated principle.

Risk 2's mitigation is aspirational ("keep the model broader") but doesn't specify what v1 *does* for non-person entities. A concrete, achievable option that stays within the structured-field-only constraint: extract org/company entities from fields that already exist on certain sources — e.g. GitHub signals' repo owner/org field, ProductHunt signals' maker/company field — as a second structured entity type alongside person/author fields. Decide whether this is in scope for v1 or genuinely deferred to v2, and if deferred, make sure the PRD's "broader than people-only" framing doesn't overpromise what v1 actually ships.

### Q3. "Co-mentioned with tracked themes" needs a structured definition to avoid re-opening the LLM dependency.

This phrase appears in both FR2 and FR3/FR4 but isn't pinned to an existing structured field. To avoid quietly drifting into free-text/NLP territory (which Risk 4 explicitly warns against), this should resolve to something that already exists in the pipeline — most likely the `personalRelevance` score already computed by the digest scoring engine, or the digest's `focusKeyword` field. Confirm this mapping explicitly during architecture so "theme adjacency" doesn't become an unstated LLM dependency.

### Q4. Cold-start logic for the emerging lane isn't fully specified.

"Acceleration relative to baseline" assumes a baseline exists. A genuinely new, never-before-seen entity has no baseline — its first appearance(s) *are* the signal. The emerging lane needs its own distinct rule, separate from the established lane's baseline-comparison logic (e.g., something like "N+ appearances within a short window with zero prior history counts as a candidate"). Define this explicitly as its own detection path, not a special case bolted onto the acceleration logic.

### Q5. The architecture implies persistent state — this needs an explicit data-model decision.

"Acceleration vs. baseline" cannot be computed purely as a stateless, fresh-every-time query over existing `digestSignals` — it requires *some* stored history of entity-mention activity over time to know what "baseline" means for any given entity. This likely means a new, lightweight Convex table (e.g. periodic per-entity mention-count snapshots), not just a live aggregation query. This is a real architectural decision that should be made explicit early, since it changes the technical shape of the feature meaningfully from a pure read-only/stateless analysis stage to one with its own persisted intelligence layer (the persisted layer itself should still only ever produce read-only *suggestions* per FR5 — the persistence is for computing trend/baseline, not for storing approved/dismissed state, which remains out of scope for v1 per the PRD).

---

# Constraints carried over from parent session (do not relitigate without cause)

- **No new ScrapeCreators/external adapter** — this is explicitly an analysis stage on existing collected signals, not a new digest source. Do not wedge this into the Epic 72 source-registry/three-list-class pattern used for TikTok/Instagram/Pinterest/Polymarket/Threads/LinkedIn — that pattern is for adapters with new external API dependencies.
- **No dependency on the parked LLM provider question** — the research-chain's `ANTHROPIC_API_KEY` is currently dead and that decision (fix vs. migrate to OpenRouter/subscription routing) is intentionally unresolved. This feature must not require any LLM call to ship v1.
- **Validator/registry-drift discipline** — if this feature does add new Convex tables/mutations, apply the same lesson learned today from three separate incidents (viewCount validator desync, Pinterest/Polymarket health-registry omission, Threads/LinkedIn missing-env-var gap): confirm every field actually round-trips through the real mutation validator via a canonical fixture, and confirm any new health/status surface is actually wired and live-verified against prod, not just passing local tests.
