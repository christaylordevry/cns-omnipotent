---
baseline_commit: 63532de0168c55e41b341e8ac25396b27f437cb4
---

# Story 79-3: Recall policy config + `recall-inject.ts`

Status: done

## Story

As an **operator**,
I want **versioned per-channel recall policy and inject-trim logic with citation fences**,
so that **injection respects token budgets and drops chunks without resolvable paths (FR18, NFR-RECALL-1, NFR-RECALL-4)**.

**Zone/Repo:** Omnipotent.md · `config/brain-recall-policy.json`, `src/brain/recall-inject.ts`, `tests/brain/recall-inject.test.ts` · **Branch:** `hermes-consolidation`

## Acceptance Criteria

1. **Policy config (AC: policy)**
   - **When** `config/brain-recall-policy.json` ships with channel keys `voice_pane`, `standard_text`, `yapped_text` and tunable placeholders
   - **Then** per-channel `max_top_k_fetch`, `min_score_threshold`, `max_injection_tokens`, `max_chunks` are config-driven (not hardcoded in TS)

2. **Inject trim + citations (AC: inject)**
   - **Then** `recall-inject.ts` fetches top-k, trims by per-channel `max_injection_tokens`, emits markdown fence with `vault:` path per chunk

3. **Drop rules (AC: nfr-recall-4)**
   - **And** chunks without resolvable path are dropped; secret-gate paths never injected

4. **Channel detection (AC: channel)**
   - **And** length heuristic for `yapped_text` vs `standard_text`; `voice_pane` accepts platform hint parameter

5. **Reversibility (AC: nfr5)**
   - **And** policy file is git-tracked and reversible via config version rollback

6. **Tests + verify (AC: nfr1)**
   - **And** `tests/brain/recall-inject.test.ts` covers trim, budget ceiling, and drop rules
   - **And** `bash scripts/verify.sh` passes

## Tasks / Subtasks

- [x] **Policy config** (AC: policy, nfr5)
  - [x] `config/brain-recall-policy.json` with schema_version, policy_version, channels, yapped_text_min_chars, shadow_mode
  - [x] `src/brain/recall-policy.ts` — zod parse + load from repo path

- [x] **recall-inject.ts** (AC: inject, nfr-recall-4, channel)
  - [x] `detectRecallChannel` — platform hint / length heuristic
  - [x] `buildRecallInjection` — query index, read vault excerpts, trim by budget + max_chunks
  - [x] Citation fence with `vault:` per chunk; drop unresolvable + secret-gate + blocked paths

- [x] **Tests** (AC: nfr1)
  - [x] `tests/brain/recall-inject.test.ts` — trim, budget ceiling, drop rules, channel detection

- [x] **Verify gate** (AC: nfr1)
  - [x] `bash scripts/verify.sh` passes

### Review Findings

- [x] [Review][Patch] Budget trim can reject the first valid hit instead of trimming or continuing [src/brain/recall-inject.ts:193]
- [x] [Review][Patch] Secret-gated raw text is read a second time before injection, leaving a TOCTOU gap [src/brain/recall-inject.ts:176]
- [x] [Review][Patch] Citation path text is injected into markdown without control-character hardening [src/brain/recall-inject.ts:99]
- [x] [Review][Patch] Inject blocked paths are hardcoded outside the versioned recall policy [src/brain/recall-inject.ts:55]
- [x] [Review][Patch] `index.stale_penalty_factor` is parsed as policy but not applied by recall query ranking [src/brain/recall-policy.ts:28]

## Dev Notes

### Architecture

- Policy keys per `architecture-hermes-omniscient.md`: `max_top_k_fetch`, `min_score_threshold`, `max_injection_tokens`, `max_chunks`
- Channel detection: `nexus-voice` platform hint → `voice_pane`; `len >= yapped_text_min_chars` → `yapped_text`; else `standard_text`
- Injection fence: markdown with explicit `vault:` path per chunk; chunks without resolvable path dropped (NFR-RECALL-4)
- Token estimate: `ceil(chars/4)` (same as `vault-context-builder.ts`)
- `shadow_mode: true` → empty `context`, citations still populated (FR19 prep for Story 79-4)
- Depends on Story 79-2 index / `queryBrainIndex`; fixture index OK for unit tests

### References

- `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` — Story 79-3
- `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` — policy shape, channel rules
- `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/addendum.md` — config JSON shape

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor), 2026-06-26

### Implementation Plan

- Git-tracked `config/brain-recall-policy.json` with tunable per-channel budgets (voice < standard < yapped enforced at parse).
- `recall-policy.ts` — zod schema + `loadBrainRecallPolicyFromRepo`.
- `recall-inject.ts` — `detectRecallChannel`, `buildRecallInjection` wrapping `queryBrainIndex` + vault reads + secret-gate + token/chunk trim.
- Citation format: `### vault:{path} (score: …)` inside `<!-- cns-brain-recall … -->` header block.
- Story 79-5 will wire `brain-recall-prefetch.mjs` to call `buildRecallInjection`.

### Debug Log References

- `npm run test:vitest -- tests/brain/recall-inject.test.ts` — 14/14 pass
- `bash scripts/verify.sh` — PASS (2026-06-26)

### Completion Notes List

- Added versioned `config/brain-recall-policy.json` with all three PRD channel keys and NFR-RECALL-1 token ordering.
- Added `recall-policy.ts` parser with channel budget invariant validation.
- Added `recall-inject.ts`: channel detection, path blocklist (`_meta/logs`, `AI-Context/AGENTS.md`), secret-gate drop, budget/chunk trim, cited markdown fence, shadow_mode support.
- Moved inject blocked paths into policy config, applied policy stale penalty to recall ranking, closed TOCTOU and citation-path hardening gaps, and made tight-budget trim continue past non-fitting hits.
- Added 18 recall-inject unit tests and 21 query-index tests covering policy parse, channel detection, drop rules, budget ceiling, max_chunks, shadow mode, blocklist config, budget continuation, and policy stale penalty.

### File List

- `config/brain-recall-policy.json`
- `src/brain/recall-policy.ts`
- `src/brain/recall-inject.ts`
- `src/brain/retrieval/query-index.ts`
- `tests/brain/recall-inject.test.ts`
- `tests/brain/query-index.test.ts`
- `_bmad-output/implementation-artifacts/79-3-recall-policy-config-recall-inject.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-26: Story 79-3 — recall policy config, recall-inject module, unit tests, verify gate pass.
- 2026-06-26: Code review findings patched; full verify gate pass; story marked done.
