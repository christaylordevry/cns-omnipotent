# Architecture Agenda — Open Design Questions

These were raised in review of the PRD and are deliberately **not yet answered**. They must be worked through during the **`bmad-create-architecture`** workflow, not assumed or resolved in this spec.

---

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
