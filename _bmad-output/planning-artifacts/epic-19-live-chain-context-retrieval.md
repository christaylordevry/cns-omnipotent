---
title: "Epic 19 Plan - Live Chain Context Confidence"
date: 2026-04-22
status: planned
source:
  - _bmad-output/implementation-artifacts/epic-18-retro-2026-04-22.md
  - _bmad-output/brainstorming/brainstorming-session-2026-04-22-003639.md
---

# Epic 19: Live chain context confidence

## Epic Goal

Prove the Epic 18 research chain in live operator conditions, then make its synthesis context durable by hydrating `OperatorContext` from vault profile notes and replacing the minimal vault context builder with bounded hybrid retrieval.

The operator outcome is simple: a live Research -> Synthesis -> Hook -> Boss run produces a PAKE++ synthesis note that is grounded in real external research, real vault context, and current operator profile data, with evidence captured and no secrets leaked.

## Why This Epic Now

Epic 18 closed the production adapter and PAKE++ synthesis work, but its retro left three material risks:

- The full chain has not been closed as a controlled live smoke with current adapters and a staging vault evidence record.
- `OperatorContext` still defaults to a static object instead of vault-owned profile data.
- `VaultContextPacket` is intentionally minimal: operator profile plus up to two topic matches from `03-Resources/`, not the hybrid retriever envisioned in the 18-9 brainstorm.

Epic 19 should address those risks before more prompt redesign or new agent surfaces are added.

## Scope

In scope:

- Operator-run live chain smoke using real `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`, and `ANTHROPIC_API_KEY`.
- Evidence capture that records dates, surfaces, stage statuses, generated artifact paths, external-service failures, and token/rate-limit observations without storing credentials or raw oversized payloads.
- Vault-driven `OperatorContext` hydration from a governed profile note, with validated fallback to `DEFAULT_OPERATOR_CONTEXT`.
- Hybrid `VaultContextPacket` retrieval with bounded allocation across operator profile, semantic/topic, tag-lane, and recency signals.
- A final context-aware live smoke that verifies the hydrated operator profile and hybrid retrieval materially show up in the synthesis note.
- Hook and weapons output review after PAKE++ synthesis, limited to a decision on whether a later prompt-redesign story is needed.

Out of scope:

- Live network calls in CI.
- A new MCP tool surface for running the chain.
- Scheduler or daemon behavior.
- Vault mutations outside the existing ingest pipeline and governed write paths.
- Unlimited RAG or full-vault scans as a default retrieval mode.
- Hook or weapons prompt redesign unless the final live review creates a follow-up story.

## Dependencies And Guardrails

- Live smoke requires operator-owned keys and should remain operator-run, not `scripts/verify.sh`-run.
- Tests must stay fully mocked even when the operator shell contains `PERPLEXITY_API_KEY`.
- Retrieval must respect existing vault boundaries, protected path policy, Brain allowlist/secret-scan posture where applicable, and PAKE quality weighting.
- Evidence artifacts must never include API keys, raw auth headers, or complete external response bodies.
- `runChain()` should remain adapter-injectable; hydration and retrieval defaults should be explicit and testable.

## Story Breakdown

### Story 19.1: Live chain smoke harness and evidence record

As an **operator**,  
I want **a repeatable live smoke procedure for `scripts/run-chain.ts` with safe evidence capture**,  
so that **we can prove the Epic 18 chain works under real credentials without converting live calls into CI requirements**.

Acceptance criteria:

1. Given a staging vault and valid Firecrawl, Perplexity, and Anthropic keys, when the operator runs the live chain smoke, then Research, Synthesis, Hook, and Boss each complete or fail with a documented external-service reason.
2. The smoke record captures date, command shape, vault root class (staging vs active), brief topic, stage statuses, generated vault paths, model/service errors, retry/rate-limit observations, and operator notes with no secrets.
3. `scripts/run-chain.ts` either supports or documents a safe evidence mode that avoids dumping full raw payloads by default.
4. Tests remain mocked and `scripts/verify.sh` does not require network access.

### Story 19.2: Operator context hydration from vault profile

As the **CNS Operator**,  
I want **`OperatorContext` populated from a governed vault profile note**,  
so that **synthesis personalization follows the vault source of truth instead of a static code default**.

Acceptance criteria:

1. Given `03-Resources/Operator-Profile.md` or the agreed profile path exists with valid frontmatter/body fields, when context hydration runs, then it returns an `OperatorContext` that passes `operatorContextSchema`.
2. Given the profile is missing or invalid, when hydration runs, then it falls back to `DEFAULT_OPERATOR_CONTEXT` with an explicit source/status signal and no silent partial context.
3. `runChain()` uses hydrated operator context by default when `opts.operator_context` is not provided, while preserving explicit injection for tests and callers.
4. Unit tests cover valid profile, missing profile fallback, invalid profile fallback/error policy, and explicit `opts.operator_context` override.
5. Operator-facing docs state where the profile lives, which fields drive synthesis, and how direct Obsidian edits differ from Vault IO audited writes.

### Story 19.3: Hybrid vault context retrieval

As a **research automation system**,  
I want **a bounded hybrid `VaultContextPacket` retriever**,  
so that **synthesis reliably connects external research to relevant vault notes without scanning or stuffing the whole vault**.

Acceptance criteria:

1. The retriever selects at most 12 notes and preserves the existing `VaultContextPacket` contract, including `retrieval_reason`, `token_budget_used`, and `retrieval_timestamp`.
2. Selection uses bounded allocation across:
   - 1 reserved operator profile slot when present,
   - up to 5 semantic/topic results from the Brain retrieval API or deterministic fallback when the index is unavailable,
   - up to 3 tag-lane matches derived from brief tags/queries/operator tracks,
   - up to 3 recency matches from allowed project/resource areas,
   - unused slots filled in priority order without exceeding 12 total notes.
3. Results are deduplicated, stable in order, excerpt-limited, and include retrieval reasons that explain why each note was selected.
4. Protected paths, secret-excluded notes, and disallowed corpus areas are not silently included.
5. Tests cover allocation, dedupe, empty corpus fallback, unavailable Brain index fallback, protected path exclusion, and token/excerpt bounds.

### Story 19.4: Context-aware live chain smoke and quality review

As an **operator**,  
I want **a second live chain smoke after hydration and hybrid retrieval ship**,  
so that **we verify the generated PAKE++ artifact actually uses the operator profile and vault context under live conditions**.

Acceptance criteria:

1. Given Stories 19.2 and 19.3 are complete, when the live smoke runs, then the synthesis note includes hydrated operator fields and a `Vault Context Used`/connected-notes section tied to hybrid retrieval results.
2. The smoke record links the generated synthesis, hook, and weapons artifacts and summarizes whether each stage met the Epic 18 quality bar.
3. Hook and weapons outputs are reviewed against the richer PAKE++ synthesis. If prompt redesign is needed, a follow-up backlog story is created with evidence; if not, the decision is recorded.
4. `bash scripts/verify.sh` passes after any code/doc changes, with live smoke evidence remaining operator-run and outside CI.

## Suggested Sequence

1. Start with 19.1 to establish baseline live behavior and evidence format.
2. Implement 19.2 and 19.3 next. They can be developed independently if their write scopes stay separate.
3. Close with 19.4 to prove the integrated context-aware chain and decide whether hook/weapons prompt work belongs in Epic 20 or the backlog.

## Completion Definition

Epic 19 is done when:

- all four stories are `done` in `sprint-status.yaml`;
- `bash scripts/verify.sh` passes after the implementation stories;
- live smoke evidence exists for both baseline and context-aware runs;
- `OperatorContext` defaults to vault hydration with safe fallback;
- `VaultContextPacket` retrieval is hybrid, bounded, tested, and documented;
- hook/weapons prompt follow-up is either created with evidence or explicitly declined with evidence.
