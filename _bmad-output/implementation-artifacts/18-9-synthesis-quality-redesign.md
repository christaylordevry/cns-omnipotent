# Story 18-9: Synthesis Quality Redesign (Chris-Grade PAKE++ Notes)

Status: done

Epic: 18 (Research chain end-to-end quality)

## Story

As the **CNS Operator (Chris Taylor)**,
I want **synthesis notes to be Chris-grade (reasoned, vault-connected, decision-driving) rather than thin bullet summaries**,
so that **each research sweep produces an operator-ready intelligence artifact I can act on in the same session**.

## Context / Baseline

- Research chain (Epic 17 + 18) runs end-to-end; **515 tests green**.
- Current synthesis output is structurally valid but **quality is thin** (short bullet lists; little reasoning; weak callouts; few/no wikilinks; not operator-context-aware).
- Existing adapter constraint was introduced for token-budget stability:
  - “5 patterns max, 30 words each, 60 word summary”
  - This is no longer the correct output shape.
- Operator quality bar (reference style): notes like **CNS-Operator-Guide** and **Vault-Intelligence-Discovery-Workflow**:
  - verbose reasoning, callouts for hierarchy, tables for tradeoffs/epistemics, explicit “why this works”, and connected dots via wikilinks.

## Non-Negotiable Success Criteria (18-9)

18-9 **fails** if any of these slip:

1. **Output Contract (PAKE++) ships** (structure + section minimums + abstract-written-last).
2. **Operator Personalization ships** via typed `OperatorContext` parameter, with a hard rule:
   - “Where Chris Has Leverage” must name at least two tracks by **exact** `track.name` values.
3. **Reasoning Instruments ship**:
   - **Contradiction Ledger** (epistemic table)
   - **Decisions Needed** (Option A / Option B + downstream consequences)

## Scope (Config A, amended)

### A. Synthesis Adapter Interface Changes (Input)

Add two first-class inputs (adapter remains pure; retrieval happens upstream):

```ts
type OperatorContext = {
  name: string;                    // "Chris Taylor"
  location: string;                // "Sydney, Australia"
  positioning: string;             // "Creative Technologist"
  tracks: Array<{
    name: string;                  // "Escape Job" | "Build Agency"
    status: string;                // "active" | "planning"
    priority: "primary" | "secondary";
  }>;
  constraints: string[];           // ["limited runway", "solo operator"]
  vault_profile_note?: string;     // wikilink to operator profile when hydration ships
};

type VaultContextPacket = {
  notes: Array<{
    vault_path: string;
    title: string;
    excerpt: string;               // first ~400 chars
    retrieval_reason: "topic-match" | "tag-lane" | "recency" | "operator-profile";
    tags: string[];
  }>;
  total_notes: number;             // <= 12
  token_budget_used: number;
  retrieval_timestamp: string;
};
```

Revised adapter input (conceptual):

- `topic: string`
- `queries: string[]`
- `source_notes: Array<{ vault_path; body; frontmatter }>` (existing)
- `operator_context: OperatorContext` (**new, required**)
- `vault_context_packet: VaultContextPacket` (**new, required; may be empty**)

### B. Minimal VaultContextPacket Builder (18-9)

18-9 ships a **minimal-but-real** packet builder:

- **Guaranteed operator profile slot**
  - Prefer hardcoded path under `03-Resources/` (e.g., `03-Resources/Operator-Profile.md`)
  - If missing, the slot is absent and synthesis must emit the explicit “no vault context” warning callout.
- **2 topic-relevant notes (not filesystem recency)**
  - Use `vault_search` scoped to `03-Resources/` with a query derived from the brief topic (and/or top query terms).
  - Select up to 2 distinct notes from results; include excerpts.

Notes:

- This is intentionally **not** the full hybrid #14 retriever (40/30/20/10). That ships later.
- `VaultContextPacket` interface must be future-proof for the full hybrid retriever.

### C. Synthesis Output Contract (PAKE++ Body)

The synthesis note body must follow this skeleton (Obsidian markdown callouts/tables/wikilinks).

Baseline sections:

- `> [!abstract]` (written **last**)  
  - 2–3 sentences summarizing:
    - single most important finding
    - highest-leverage action
- `## What We Know` (prose reasoning, vault-connected; no bullets)
- `> [!note] Signal vs Noise` (includes Contradiction Ledger table)
- `## The Gap Map` (Known/Unknown/Why table)
- `> [!warning] Blind Spots`
- `## Where Chris Has Leverage` (operator-context-aware)
- `> [!tip] Highest-Leverage Move`
- `## Connected Vault Notes` (table)
- `## Decisions Needed` (Option A/B + downstream consequences)
- `## Open Questions` (decision-blocking only)
- `## Version / Run Metadata` (Date | Brief topic | Sources ingested | Queries run)

### D. Depth Contract (Minimums; enforceable + testable)

Minimum thresholds:

| Section | Minimum | Format |
|---------|---------|--------|
| Abstract | 2-3 sentences | Callout, written last |
| What We Know | ≥180 words prose | No bullets, 3+ wikilinks |
| Contradiction Ledger | ≥3 rows | Table: Claim / Agree / Disagree / Implication |
| Gap Map | ≥4 rows | Table: Known / Unknown / Why it matters |
| Where Chris Has Leverage | ≥150 words prose | Must name 2 tracks explicitly (verbatim) |
| Highest-Leverage Move | 1 callout | Specific, timeable, vault-connected |
| Decisions Needed | ≥4 decisions | Each with Option A / Option B / downstream consequence |
| Connected Vault Notes | ≥5 rows | Table: Note / Why relevant / Status |
| Open Questions | ≥3 items | Numbered, decision-blocking only |

### E. Token Budget

- Set synthesis `MAX_TOKENS = 4000`.
- The retry helper from 18-8 already handles rate-limit pressure.

## Prompt / Style Rules (voice constraints)

Non-negotiable rules in the prompt (must be testable via assertions on prompt text and/or output text):

- **No “thin bullet summary” mode**: enforce the depth contract above.
- **Operator Personalization**
  - Must reference:
    - operator location (Sydney)
    - positioning (Creative Technologist)
    - at least two tracks by exact `track.name` values (e.g. “Escape Job”, “Build Agency”) in “Where Chris Has Leverage”.
- **Reasoning Instruments**
  - Contradiction Ledger table must be present with ≥3 rows.
  - Decisions Needed must have ≥4 decisions, each with Option A / Option B and consequences.
- **Abstract written last** after all sections.

## Test Plan (what changes in `tests/vault-io/synthesis-adapter-llm.test.ts`)

This story intentionally changes the synthesis adapter’s output shape and budget. The existing test file must be updated accordingly:

1. **`max_tokens` assertion**
   - Update from `800` to **`4000`**.

2. **Prompt includes new inputs**
   - Assert request `messages[0].content` includes:
     - `operator_context` (name/location/positioning)
     - both track names as literals somewhere in the prompt rules
     - `vault_context_packet` summary and at least one included vault note when provided

3. **Happy path output**
   - Mock Anthropic response text with a **PAKE++ markdown body** that satisfies minimums (shortened in test but still meeting thresholds via tight wording).
   - Validate returned object (new schema) and/or returned markdown contains:
     - `[!abstract]` callout
     - `## What We Know`
     - Contradiction Ledger table header
     - Gap Map table header
     - `## Where Chris Has Leverage` and contains two track names
     - `## Decisions Needed`
     - `## Connected Vault Notes`
     - `## Version / Run Metadata`

4. **Depth contract assertions**
   - Add deterministic assertions:
     - word count lower bounds for “What We Know” and “Where Chris Has Leverage”
     - row-count checks for tables (Contradiction Ledger ≥3, Gap Map ≥4, Connected Notes ≥5)
     - decisions count ≥4
     - wikilink count ≥3 within “What We Know”

5. **No vault context warning behavior**
   - Add a test where `vault_context_packet.notes` is empty → output must include:
     - `> [!warning] No vault context found — this synthesis is grounded in external research only.`

## Acceptance Criteria

1. **Adapter interface updated**
   - Synthesis adapter accepts `operator_context` and `vault_context_packet` and uses them in prompt.

2. **Chris-grade PAKE++ structure**
   - Produced note body contains all required sections/callouts/tables.

3. **Depth contract met**
   - Minimum thresholds are satisfied (word counts, row counts, decisions, wikilinks).

4. **Operator personalization enforced**
   - “Where Chris Has Leverage” contains at least two track names verbatim and references location + positioning.

5. **Reasoning instruments enforced**
   - Contradiction Ledger and Decisions Needed present and non-stubbed (meets row/decision minimums).

6. **Token budget updated**
   - Anthropic request uses `max_tokens: 4000`.

7. **Test suite updated**
   - `tests/vault-io/synthesis-adapter-llm.test.ts` updated to the new contract; all tests green.

## Out of Scope (explicit)

- Full hybrid retriever (#14: 40/30/20/10 allocation) beyond the minimal packet builder.
- Vault-driven hydration of `OperatorContext` (Category #9) beyond a future story.
- Hook prompt redesign (expected to improve after richer synthesis; separate story if needed).

## Implementation Notes (likely files touched)

- `src/agents/synthesis-agent.ts`
  - Update adapter input/output contracts and the ingest body generation path (likely ingest the adapter’s markdown body directly instead of rendering bullet sections).
- `src/agents/synthesis-adapter-llm.ts`
  - Update prompt, token budget, and output validation (new schema).
- `src/tools/vault-search.ts` (used; not modified) and a small new module for minimal packet assembly (if needed).
- `tests/vault-io/synthesis-adapter-llm.test.ts`
  - Update assertions for the new prompt and output contract.

## Dev Agent Record

### Agent Model Used

Codex

### Debug Log References

- `npm run -s test:vitest -- tests/vault-io/synthesis-adapter-llm.test.ts tests/vault-io/vault-context-builder.test.ts tests/vault-io/synthesis-agent.test.ts tests/vault-io/run-chain.test.ts` - PASSED (50 tests)
- `bash scripts/verify.sh` - VERIFY PASSED (22 TAP tests, 506 Vitest tests, lint, typecheck, build)

### Completion Notes List

- Added typed `OperatorContext` and `VaultContextPacket` contracts with Chris Taylor defaults and a minimal vault context builder.
- Updated synthesis adapter contract to `{ body, summary }`; synthesis ingest now passes `output.body` directly and preserves `ai_summary: output.summary`.
- Added PAKE++ prompt requirements for abstract-last structure, reasoning instruments, operator personalization, track-name literals, vault context, and no-vault warning behavior.
- Added post-LLM PAKE++ validation in `runSynthesisAgent()` so the depth contract is enforced after generation, not only requested in prompt text.
- Fixed chain plumbing so `runChain()` builds a vault context packet when absent, passes `DEFAULT_OPERATOR_CONTEXT`, and threads research `brief.queries` into synthesis.
- Updated `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` because the story changes user-facing research synthesis behavior.

### Code Review Closure

- Review finding: PAKE++ depth/output contract was prompt-only. Resolution: added deterministic post-LLM validation for required markers, section ordering, word counts, wikilink counts, table row counts, decision count, operator personalization, abstract sentence count, and Highest-Leverage Move specificity.
- Review finding: missing operator profile did not reliably trigger the required no-vault warning. Resolution: no-vault warning is now required when the packet is empty or lacks an `operator-profile` note.
- Review finding: `runChain()` did not pass research queries into synthesis. Resolution: `brief.queries` is now passed to `runSynthesisAgent()`.

### File List

- Added: `src/agents/operator-context.ts`
- Added: `src/agents/vault-context-builder.ts`
- Added: `tests/vault-io/vault-context-builder.test.ts`
- Edited: `src/agents/synthesis-agent.ts`
- Edited: `src/agents/synthesis-adapter-llm.ts`
- Edited: `src/agents/run-chain.ts`
- Edited: `tests/vault-io/synthesis-agent.test.ts`
- Edited: `tests/vault-io/synthesis-adapter-llm.test.ts`
- Edited: `tests/vault-io/run-chain.test.ts`
- Edited: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- Edited: `_bmad-output/implementation-artifacts/sprint-status.yaml`
