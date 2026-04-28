# Story 19-3: Hybrid VaultContextPacket Retrieval (Bounded, Tiered)

Status: review

Epic: 19 (Live Chain Context Retrieval)

## Story

As a **research automation system**,
I want **a bounded hybrid `VaultContextPacket` retriever**,
so that **synthesis reliably connects external research to relevant vault notes without scanning or stuffing the whole vault**.

## Context / Baseline

- Story 18-9 shipped a minimal `VaultContextPacket` builder: operator profile slot + up to 2 topic-match hits, with `token_budget_used` hardcoded to 0.
- Story 19-2 hydrated `OperatorContext` from `03-Resources/Operator-Profile.md` frontmatter.
- This story replaces the minimal builder with a **bounded hybrid** retriever that fans out across operator-profile, tag-lane, topic-match, and recency tiers, accumulates a real token budget, and degrades silently when any tier fails.

## Scope

### Tier ordering (fill budget in this order)

1. **operator-profile** — always first, 1 slot max (`03-Resources/Operator-Profile.md`).
2. **tag-lane** — notes tagged with any active operator track name (lowercased, hyphenated). Track `"Escape Job"` → tag `"escape-job"`. Source: `vault_search` scoped to `03-Resources/`, max 2 notes total across all tags.
3. **topic-match** — `vault_search(topic, scope="03-Resources/", maxResults=5)`, skip already-seen paths, max 3 notes.
4. **recency** — `vault_list(scope="03-Resources/")` sorted by `modified` desc, take top 5, skip already-seen paths, max 2 notes.

### Budget enforcement

- `TOKEN_BUDGET = 2000` (default; overridable via test helper for unit tests).
- After adding each note, accumulate `token_budget_used += estimateTokens(note.excerpt)`.
- If adding the next note would exceed the budget, stop (do not add partial notes).
- `token_budget_used` on the final packet reflects the actual accumulated total.

Token estimator: `Math.ceil(text.length / 4)`.

### Invariants

- `EXCERPT_CHARS = 400` (unchanged).
- Signature unchanged: `buildVaultContextPacket(vaultRoot, topic, queries)`. `queries` remains accepted but unused (forward-compat).
- `loadOperatorContextFromVault` unchanged (Story 19-2).
- Failure handling: any tier that throws is skipped silently. `buildVaultContextPacket` never throws.

## Acceptance Criteria

1. The retriever fills tiers in order: operator-profile → tag-lane → topic-match → recency, stopping when the token budget is exhausted.
2. Each note carries a correct `retrieval_reason` reflecting the tier that selected it.
3. `token_budget_used` reflects the real accumulated `Math.ceil(excerpt.length / 4)` total — never 0 when notes were added.
4. Notes are deduplicated by `vault_path`; same path from multiple tiers appears only once.
5. Any tier that throws (scope missing, search/list error, read error) is skipped silently. `buildVaultContextPacket` never throws.
6. `PERPLEXITY_API_KEY="" bash scripts/verify.sh` passes (test count ≥ baseline 514).

## Tasks / Subtasks

- [x] Task 1: Add tag-lane derivation helper (`trackToTag`) and token estimator (`estimateTokens`).
- [x] Task 2: Replace `buildVaultContextPacket` body with the bounded tiered retriever.
- [x] Task 3: Wire `vaultListDirectory` for the recency tier with mtime-desc sort + top-5 cap.
- [x] Task 4: Expose `__setTokenBudgetForTests` / `__resetTokenBudgetForTests` test-only helpers so the budget cap can be exercised under EXCERPT_CHARS=400 and the production tier caps.
- [x] Task 5: Replace existing `describe("buildVaultContextPacket")` tests with the 7 cases from the spec; preserve `loadOperatorContextFromVault` tests untouched.
- [x] Task 6: Run `PERPLEXITY_API_KEY="" bash scripts/verify.sh` and confirm green.

## Dev Notes

- `vaultListDirectory` does not natively accept `sortBy`/`limit`; the builder sorts entries by `modified` descending and slices in-process.
- `vault_search` uses fixed-string matching, so `tag` queries (e.g. `"escape-job"`) match the YAML frontmatter line `  - "escape-job"`. Active tracks come from `loadOperatorContextFromVault`, which returns `DEFAULT_OPERATOR_CONTEXT` when the profile is absent or invalid — tag-lane therefore runs even without a vault profile.
- The 2000-token budget is effectively unreachable under production constraints (8 max notes × 100 max tokens/excerpt = 800), so the test for budget cap uses `__setTokenBudgetForTests` to exercise the stop logic deterministically.

## Dev Agent Record

### Implementation Plan
1. Helpers (`trackToTag`, `estimateTokens`, `tryAddNote`) keep the tier loop linear and per-tier failures isolated via try/catch.
2. Single `loadOperatorContextFromVault` call at top of tag-lane derives active track tags; redundant disk read tolerated for clarity.
3. Recency tier sorts `vaultListDirectory` entries by `modified` desc to mirror the spec's `sortBy="modified", limit=5`.

### Completion Notes
- Replaced the 18-9 minimal builder with bounded hybrid retrieval; tier caps 1/2/3/2 (op-profile/tag-lane/topic-match/recency).
- `token_budget_used` now accumulates real estimates (`Math.ceil(excerpt.length / 4)`).
- All four tiers wrapped in try/catch — `buildVaultContextPacket` never throws.
- Test-only `__setTokenBudgetForTests`/`__resetTokenBudgetForTests` exposes the budget for the cap test; production behavior is unchanged.

### File List
- `src/agents/vault-context-builder.ts` (modified) — replaced `buildVaultContextPacket` body, added tier helpers + test-only budget hooks.
- `tests/vault-io/vault-context-builder.test.ts` (modified) — replaced builder tests with the 7 cases; `loadOperatorContextFromVault` block left intact.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — `19-3` set to `review`.

## Change Log

| Date       | Change                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| 2026-04-28 | Implemented bounded hybrid retriever; replaced minimal builder; added tier-coverage tests. |
