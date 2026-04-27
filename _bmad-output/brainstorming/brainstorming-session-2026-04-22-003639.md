---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: 'Synthesis Note Quality Redesign for CNS Agency Content Chain (Epic 18-9)'
session_goals: 'Define Chris-grade synthesis note structure; design operator-context ingestion + vault retrieval; set token budgets; assess hook prompt implications; specify test updates for tests/vault-io/synthesis-adapter-llm.test.ts; propose voice/style constraints; produce clear Story Brief for 18-9.'
selected_approach: 'Progressive Technique Flow'
techniques_used: ['What If Scenarios', 'Mind Mapping', 'Morphological Analysis', 'Decision Tree Mapping']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** {{user_name}}
**Date:** {{date}}

## Session Overview

**Topic:** Synthesis Note Quality Redesign for CNS Agency Content Chain (Epic 18-9)
**Goals:** Define Chris-grade synthesis note structure; operator-context ingestion + vault retrieval; token budgets; hook prompt implications; test updates; voice/style constraints; deliver Story Brief.

### Context Guidance

Operator quality bar: verbose reasoning, callouts, tables, wikilinks, “why this works”, and connected-dots synthesis (vs thin 5-bullet outputs). Operator context to influence synthesis: US citizen in Sydney; independent consultant; building agency + escaping current job; Creative Technologist positioning.

## Technique Selection

**Approach:** Progressive Technique Flow
**Journey Design:** Systematic development from exploration to action

**Progressive Techniques:**

- **Phase 1 - Exploration:** What If Scenarios (break current constraints; generate many candidate shapes)
- **Phase 2 - Pattern Recognition:** Mind Mapping (cluster redesign dimensions + dependencies)
- **Phase 3 - Development:** Morphological Analysis (systematically combine design parameters into candidate architectures)
- **Phase 4 - Action Planning:** Decision Tree Mapping (choose path + define implementation/test plan)

**Journey Rationale:** We need to expand beyond the current token-constrained synthesis prompt, then converge into a testable, implementable Story Brief for 18-9.

## Technique Execution Results (In Progress)

### Phase 1 — What If Scenarios (Exploration)

**Interactive Focus:** Define a “Chris-grade” synthesis note skeleton + generate redesign variants for structure, context, retrieval, voice, token budget, hooks, and tests.

**[Category #1]**: Chris-Grade Baseline Skeleton
_Concept_: Adopt a mandatory synthesis note structure with an `[!abstract]` one-liner, a prose “What We Know” that explicitly connects to existing vault context via wikilinks, a “Signal vs Noise” callout, a “Gap Map” table (Known/Unknown/Why it matters), a “Blind Spots” warning callout, a “Where Chris Has Leverage” section tied to Sydney + agency-building + Creative Technologist positioning, a “Highest-Leverage Move” tip callout, a “Connected Vault Notes” wikilink table (min 5), “Open Questions” (decision-gating), and “Version/Run Metadata”.
_Novelty_: Treats synthesis as operator-ready intelligence (reasoned, connected, actioned) rather than a compact bullet summary; forces explicit vault linkage and decision gating.

**[Category #4]**: Contradiction Ledger
_Concept_: Replace vague “mixed opinions” prose with an epistemic table for contested claims: Claim | Sources agreeing | Sources disagreeing | What would change Chris’s decision | Implication for Chris (Sydney / agency / CT positioning). Use this inside (or adjacent to) the “Signal vs Noise” callout so it becomes adjudication, not averaging.
_Novelty_: Forces the model to do explicit reasoning about evidence quality and disagreement; upgrades synthesis from summary to epistemic accounting, aligned with how warning callouts work in operator guides.

**[Category #5]**: Decision-Gated Synthesis
_Concept_: Promote “Open Questions” into “Decisions Needed” where each item is a fork: Decision | Option A | Option B | Downstream consequences (what sections/actions change) | How to decide (what evidence or vault context to check). Treat the note as a decision tool Chris can complete in-session.
_Novelty_: Converts passive uncertainty into action-driving decision architecture; mirrors “choose one path” patterns that make workflows operationally useful.

**[Category #6]**: Explicit Operator Tracks in Leverage Section
_Concept_: Require “Where Chris Has Leverage” to explicitly reference the two named operator tracks (escaping current job; building the agency) and map opportunities to each track separately (what helps now vs later, what compounds).
_Novelty_: Prevents generic “opportunities” text by binding leverage to operator-specific goals; implies operator context must be a first-class input, not inferred.

**[Category #7]**: OperatorContext Parameter (First-Class, Typed)
_Concept_: Add a first-class `operatorContext` parameter to synthesis with a typed schema (e.g., Zod). Prompt must include non-negotiable rules: the “Where Chris Has Leverage” section must name at least two tracks by exact `track.name` values, and must reference location + positioning. This is asserted in tests via string checks.
_Novelty_: Personalization becomes deterministic and testable; supports future multi-operator usage without system-prompt hacks.

**[Category #9]**: Vault-Driven Operator Context (Fallback Source of Truth)
_Concept_: Keep the `OperatorContext` interface stable, but populate it from vault profile notes (e.g., `[[Operator-Profile]]`) in a future story. Synthesis becomes vault-aware without changing downstream prompt/structure—only the context sourcing changes.
_Novelty_: Evolves personalization over time while keeping the adapter contract stable; avoids “drift” inherent in system-prompt injection.

**[Category #10]**: OperatorContext Schema (18-9 Minimum)
_Concept_: Define `OperatorContext` with name, location, positioning, named tracks (name/status/priority), constraints, and optional `vault_profile_note` wikilink. Enforce a prompt rule: leverage section must name tracks verbatim; tests assert presence of those strings.
_Novelty_: Establishes a portable personalization contract that can be validated and later hydrated from the vault.

**[Category #14]**: Hybrid Budgeted Vault Context Packet (Default)
_Concept_: Build a bounded `VaultContextPacket` upstream of synthesis using a fixed mix of signals: topic-semantic, tag-lanes, and recency—plus a guaranteed operator-profile inclusion if present. Cap at max 12 notes; include excerpts and retrieval reasons; synthesis is only allowed to cite wikilinks that appear in the packet and must render a “Vault Context Used” table from it. If packet empty, synthesis adds an explicit warning callout that it’s grounded in external research only.
_Novelty_: Makes “connect to vault” deterministic and auditable while keeping token/cost bounded; avoids missing either active work (recency) or foundations (tags/topic).

**[Category #15]**: VaultContextPacket Schema (18-9 Minimum)
_Concept_: Define `VaultContextPacket` with `notes[]` entries including `vault_path`, `title`, `excerpt` (first ~400 chars), `retrieval_reason` (topic-match | tag-lane | recency | operator-profile), and `tags[]`, plus packet metadata: `total_notes` (<=12), `token_budget_used`, `retrieval_timestamp`. Note body includes “Vault Context Used” table mapping title/reason/wikilink.
_Novelty_: Creates a stable contract between retriever and synthesizer and a direct path to “prove you read the vault”.

**[Category #16]**: Keep Synthesis Adapter Pure (Retrieval Upstream)
_Concept_: `synthesize()` receives `operatorContext` + `vaultContextPacket` alongside existing `topic/queries/source_notes`. Retrieval happens in a pre-synthesis step (or dedicated `VaultContextRetriever`) outside the adapter. Adapter stays deterministic: inputs → note.
_Novelty_: Clear separation of concerns, easier testing, and avoids hidden vault IO side-effects in adapter.

**[Category #17]**: Fixed Higher Cap + Section Minimums (18-9 Default)
_Concept_: Raise synthesis output budget to `MAX_TOKENS=4000` and enforce a minimum-depth contract per section (word counts, row counts, and required inclusion of operator track names and wikilinks). Use string/regex assertions in tests to validate the contract.
_Novelty_: Achieves Chris-grade depth with predictable cost and minimal implementation complexity; makes quality measurable in CI.

**[Category #18b]**: Abstract Written Last (Borrowed from Two-Pass)
_Concept_: Instruct the model to write all sections first, then write the top `> [!abstract]` callout last (2–3 sentences) summarizing the single most important finding and the highest-leverage action, based on the completed body.
_Novelty_: Produces a TL;DR that reflects the actual document rather than a pre-commitment summary.

**[Category #21]**: Section Minimum Contract (Concrete Thresholds)
_Concept_: Minimums for 18-9: Abstract 2–3 sentences (callout, written last); What We Know ≥180 words prose with 3+ wikilinks; Contradiction Ledger ≥3 rows (Claim/Agree/Disagree/Implication); Gap Map ≥4 rows (Known/Unknown/Why); Where Chris Has Leverage ≥150 words prose and must name 2 tracks verbatim; Highest-Leverage Move 1 tip callout (specific/timeable/vault-connected); Decisions Needed ≥4 decisions each with Option A/Option B/downstream consequence; Connected Vault Notes ≥5 rows (Note/Why/Status); Open Questions ≥3 numbered items (decision-blocking only).
_Novelty_: Converts “quality” into an enforceable rubric that can be validated automatically.

### Phase 2 — Mind Mapping (Pattern Recognition)

**Non-Negotiable Branches (18-9):**

- **Output Contract (PAKE++)**: the visible deliverable; section minimums + callout hierarchy + abstract-written-last.
- **Operator Personalization**: typed `OperatorContext` with “must name tracks verbatim” rule; makes leverage section Chris-specific.
- **Reasoning Instruments**: Contradiction Ledger + Decisions Needed; converts note from report to decision tool.

**Slip-Allowed (18-9):**

- **Vault Grounding**: can ship minimal retrieval now while keeping `VaultContextPacket` interface for future hybrid.
- **Hook Quality Downstream**: explicitly out of scope; expected to improve once synthesis is richer.
