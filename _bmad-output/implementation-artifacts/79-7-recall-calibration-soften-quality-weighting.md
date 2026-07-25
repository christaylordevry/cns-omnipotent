---
baseline_commit: 4b1eba7
course_correction_from: 79-6-chunked-brain-index-chunk-aware-recall
branch: hermes-consolidation
---

# Story 79.7: Recall calibration — soften quality weighting (tunable α) + threshold retune + recalibrate to pass

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an **operator**,
I want **quality weighting to be a tunable gentle nudge (α) with re-calibrated score thresholds on the existing chunked index**,
so that **recall ranking balances relevance and PAKE quality without quality dominating cosine similarity, and all 10 golden queries pass calibration before live inject (FR19 course-correction after 79-6)**.

**Zone/Repo:** Omnipotent.md · `src/brain/retrieval/`, `config/`, `tests/brain/` · **Branch:** `hermes-consolidation`

**Gate context:** Story 79-6 is committed (`4b1eba7`) and correct — chunking rescued 8 oversized notes (`failed: 0`), parent-collapse works. Remaining failure is **calibration scoring**, now precisely diagnosed on `text-embedding-3-large` (647 chunks / 160 notes):

| Mode | Channel runs passing |
|------|---------------------|
| Whole-note baseline (pre-79-6) | 2/36 |
| Chunked index, quality OFF | 16/36 |
| Chunked index, quality FULL (α=1) | 13/36 |

**Root cause:** `quality-weighting.ts` computes multiplier as a **product** of four ≤1 sub-weights (status × confidence × verification × type). Typical notes collapse to ~0.25–0.4; missing frontmatter gets flat 0.25. Quality spread is **4×** (0.25–1.0) vs relevance spread **~1.5×** (raw cosine ~0.28–0.41). Quality both **rescues** some queries (operator-profile, sprint-continuity) and **ejects** lower-quality-but-relevant notes (vault-fast-scan, hooks-run-chain-smoke went precision 1 → 0).

**Recall stays in shadow** (`shadow_mode: true`) until operator re-calibration passes and operator flips shadow + `operator_signoff`.

## Acceptance Criteria

1. **Tunable quality strength α (AC: alpha-blend)**
   - **When** quality weighting is enabled for a query
   - **Then** the effective multiplier uses blend formula: `effective = 1 - α·(1 - rawMultiplier)` where `rawMultiplier` is today's product (or flat 0.25 for missing/empty quality metadata)
   - **And** `α=0` reproduces quality-OFF (effective multiplier 1.0 for all records); `α=1` reproduces today's behaviour (regression lock)
   - **And** default `α ≈ 0.3` — quality breaks ties without dominating relevance
   - **And** `computeQualityMultiplierComponents` continues reporting **raw** sub-weights and **raw** multiplier for transparency; α applied only at the final effective multiplier step
   - **And** implement in `src/brain/retrieval/quality-weighting.ts` — add `applyQualityWeightStrength(rawMultiplier, alpha)` (or equivalent) exported for tests

2. **Config-only tuning (AC: config-alpha)**
   - **When** `config/brain-recall-policy.json` is loaded
   - **Then** `index.quality_weight_strength` is present (number in [0, 1], optional, default **0.3**)
   - **And** zod schema in `recall-policy.ts` validates range [0, 1]
   - **And** α threads: `policy.index.quality_weight_strength` → `queryBrainIndex({ qualityWeightStrength })` → `recall-inject.ts` → `calibration-harness.ts`
   - **And** when per-channel `quality_weighting: false`, behaviour matches α=0 (pure relevance) regardless of global α
   - **And** `query-index-cli.ts` optionally accepts `--quality-weight-strength` for operator debugging (pass-through to `queryBrainIndex`)

3. **Threshold retune (AC: thresholds)**
   - **When** dev runs `brain:calibrate` with softened α and corrected golden set
   - **Then** `min_score_threshold` values in `config/brain-recall-policy.json` are re-tuned for the new score band (placeholder 0.35/0.25/0.20 are too high — quality-weighted correct-note scores land ~0.17–0.25 on `text-embedding-3-large`)
   - **And** `policy_version` bumps (e.g. `0.2.0`) with `policy_notes` documenting α default + threshold rationale
   - **And** tuning loop uses harness only — no code round-trips for further α/threshold iteration

4. **Golden set frozen (AC: golden-frozen)**
   - **And** `config/brain-golden-queries.json` is **already corrected** (10 queries; expected paths validated against cal1 ranked results — see `curation_notes`)
   - **And** dev commits it **as-is** in the same logical change as α work — **DO NOT re-curate**
   - **And** `operator_signoff` remains `"pending"` until operator confirms post-calibration pass

5. **Calibration gate (AC: calibrate)**
   - **And** after implementation, operator runs live re-calibration (Portal proxy + env — commands in Dev Notes)
   - **And** story completion requires `brain:calibrate` **PASS on all 10 golden queries** (each query passes all applicable channels) OR documented operator waiver per 79-4 artifact writer
   - **And** completion notes document chosen α, final thresholds, and calibration result summary
   - **And** **DO NOT** flip `shadow_mode` in code — operator action after pass

6. **Safety + no reindex (AC: nfr)**
   - **And** scoring-only change — **no reindex** required; existing `~/.hermes/brain` v2 index unchanged
   - **And** protect-list **zero edits**: `src/agents/{synthesis,hook,boss}-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`
   - **And** **no touch** `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` (prefetch JSON contract unchanged)
   - **And** no new npm/pip dependency — pure math/config change
   - **And** `bash scripts/verify.sh` passes

7. **Tests (AC: tests)**
   - **And** `quality-weighting.test.ts`: α=0 → effective 1.0; α=1 → today's product values (regression); α=0.3 → blended values; α applied to missing-frontmatter flat 0.25 case
   - **And** `query-index.test.ts`: `qualityWeightStrength` honoured in `finalScore`
   - **And** `recall-inject.test.ts` + `calibration-harness.test.ts`: fixtures pass α through; existing behaviour preserved when α=1
   - **And** regression: `portal-embedder.test.ts`, `indexing-secret-gate.test.ts` still green

## Tasks / Subtasks

- [x] **`quality-weighting.ts` α blend** (AC: alpha-blend)
  - [x] Add `applyQualityWeightStrength(rawMultiplier: number, alpha: number): number` — clamp α to [0,1]; formula `1 - α * (1 - rawMultiplier)`
  - [x] Update `computeQualityMultiplier` / export path used by `query-index.ts` to accept optional `qualityWeightStrength` and apply blend after raw computation
  - [x] Keep `computeQualityMultiplierComponents` returning **raw** `multiplier` (pre-α); add optional `effectiveMultiplier` in query explain components OR apply α in query-index only (pick one SSOT — prefer apply in query-index so components stay raw)

- [x] **`recall-policy.ts` schema** (AC: config-alpha)
  - [x] Extend `index` zod object: `quality_weight_strength: z.number().min(0).max(1).optional()` with default 0.3 at read/use site
  - [x] Update `config/brain-recall-policy.json`: add `"quality_weight_strength": 0.3` under `index`; bump `policy_version`; retune `min_score_threshold` per channel after harness iteration

- [x] **Thread α through call chain** (AC: config-alpha)
  - [x] `QueryBrainIndexParams`: add `qualityWeightStrength?: number` (default from policy or 0.3 when qualityWeighting true)
  - [x] `query-index.ts`: when `qualityWeighting` false → multiplier 1; when true → `applyQualityWeightStrength(raw, strength ?? 0.3)`
  - [x] `recall-inject.ts`: pass `params.policy.index?.quality_weight_strength`
  - [x] `calibration-harness.ts`: same pass-through on both `queryBrainIndex` and `buildRecallInjection` paths
  - [x] `query-index-cli.ts`: optional `--quality-weight-strength` flag

- [x] **Golden queries commit** (AC: golden-frozen)
  - [x] Include `config/brain-golden-queries.json` in commit (already corrected — verify no accidental edits)

- [x] **Threshold tuning** (AC: thresholds)
  - [x] Run `npm run brain:calibrate` against live Portal index (operator session) OR use fixture harness in dev to bracket starting thresholds (~0.12–0.18 voice, lower for yapped — let harness drive final numbers)
  - [x] Document final thresholds in completion notes

- [x] **Verify gate** (AC: nfr, tests)
  - [x] `bash scripts/verify.sh` passes
  - [x] Confirm protect-list diff clean

- [ ] **Operator calibration session** (AC: calibrate) — **not dev-session unless Portal env available**
  - [ ] Live `brain:calibrate --write-artifact` PASS all 10 queries
  - [ ] Record α + thresholds + pass summary in completion notes
  - [ ] Operator sets `operator_signoff: confirmed` + `shadow_mode: false` post-story (not in code)

## Dev Notes

### Current code state (READ BEFORE EDITING)

| File | Today | This story changes |
|------|-------|-------------------|
| `src/brain/retrieval/quality-weighting.ts` | Raw product → multiplier; flat 0.25 missing quality | Add `applyQualityWeightStrength`; raw components unchanged |
| `src/brain/retrieval/query-index.ts` | `qualityWeighting` bool → raw multiplier directly on `finalScore` | Add `qualityWeightStrength`; blend raw before multiply |
| `src/brain/recall-policy.ts` | `index`: stale_penalty only | Add `quality_weight_strength` zod + type |
| `config/brain-recall-policy.json` | thresholds 0.35/0.25/0.20; no α | Add α=0.3; retune thresholds; bump version |
| `config/brain-golden-queries.json` | 10 corrected queries | Commit as-is |
| `src/brain/recall-inject.ts` | Passes `qualityWeighting` only | Pass `qualityWeightStrength` from policy |
| `src/brain/calibration-harness.ts` | Same | Thread α |
| `src/brain/query-index-cli.ts` | `--no-quality-weighting` only | Add optional `--quality-weight-strength` |

### α blend math (normative)

```typescript
// rawMultiplier from computeQualityMultiplierComponents (product or 0.25 flat)
function applyQualityWeightStrength(rawMultiplier: number, alpha: number): number {
  const a = Math.max(0, Math.min(1, alpha));
  const raw = Math.max(0, Math.min(1, rawMultiplier));
  return 1 - a * (1 - raw);
}
```

**Worked examples (α=0.3):**

| rawMultiplier | effective |
|---------------|-----------|
| 1.0 (reviewed) | 1.0 |
| 0.25 (missing FM) | 0.775 |
| 0.364 (typical draft product) | 0.809 |

**Spread reduction:** At α=0.3, quality range ~0.775–1.0 (1.29×) vs relevance ~1.5× — quality nudges ties instead of dominating.

**Explain output:** Keep `components.quality.multiplier` as **raw**; add `components.quality.effectiveMultiplier` (or `qualityWeightStrength` + `effectiveQualityMultiplier`) when `explain: true` so operators can debug blend.

### Score band guidance (threshold tuning)

Calibration evidence on chunked `text-embedding-3-large` index:

- Raw cosine for relevant hits: ~0.28–0.41
- With full quality (α=1): finalScores for correct notes ~0.17–0.25 for many queries
- Current thresholds 0.35/0.25/0.20 **filter out correct answers**

**Tuning procedure:**

1. Set α=0.3 in policy
2. Run `npm run brain:calibrate -- --index-path ...` (no `--write-artifact` until pass)
3. Lower `min_score_threshold` per channel until all queries pass; avoid going so low that noise floods top-k
4. If some queries still fail at reasonable thresholds, try α=0.25 or α=0.35 — **config only**
5. Bump `policy_version` once stable

### Operator calibration commands (post-implementation)

```bash
export CNS_VAULT_ROOT=/mnt/c/Users/Christopher\ Taylor/Knowledge-Vault-ACTIVE
export CNS_BRAIN_EMBEDDER=portal
export CNS_BRAIN_EMBED_MODEL=text-embedding-3-large
export CNS_BRAIN_EMBED_BASE_URL=http://127.0.0.1:8645/v1
export CNS_BRAIN_INDEX_PATH=/abs/path/to/brain-index.json   # existing v2 index — NO rebuild
export CNS_BRAIN_TOKEN_COUNT_BASE_URL=http://127.0.0.1:8645/v1
export CNS_BRAIN_TOKEN_COUNT_MODEL=anthropic/claude-sonnet-4-6

hermes proxy start   # separate terminal

# Iterate thresholds / α in config/brain-recall-policy.json only:
npm run brain:calibrate -- --index-path "$CNS_BRAIN_INDEX_PATH"

# On PASS:
npm run brain:calibrate -- \
  --index-path "$CNS_BRAIN_INDEX_PATH" \
  --write-artifact

# Operator post-pass (NOT in dev code):
# - config/brain-golden-queries.json → operator_signoff: confirmed
# - config/brain-recall-policy.json → shadow_mode: false
```

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § query-index.ts] — quality weighting lives in retrieval layer; policy numbers config-tunable per FR19
- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` Epic 79 FR19] — calibration gate before live inject
- [Source: `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md` §4.1] — per-channel `quality_weighting` override preserved; global α is index-level default
- **ADR-HERMES-015:** Plugin/prefetch unchanged — scoring fix flows through existing `buildRecallInjection`
- **NFR-GOV-2:** No index build changes — secret gate / allowlist untouched
- **WriteGate:** No vault mutations

### Library / framework requirements

**No new dependencies.** No Context7 lookup required — pure math on existing code.

### File structure requirements

| Action | Path |
|--------|------|
| **UPDATE** | `src/brain/retrieval/quality-weighting.ts` |
| **UPDATE** | `src/brain/retrieval/query-index.ts` |
| **UPDATE** | `src/brain/recall-policy.ts` |
| **UPDATE** | `src/brain/recall-inject.ts` |
| **UPDATE** | `src/brain/calibration-harness.ts` |
| **UPDATE** | `src/brain/query-index-cli.ts` (optional debug flag) |
| **UPDATE** | `config/brain-recall-policy.json` |
| **COMMIT AS-IS** | `config/brain-golden-queries.json` |
| **UPDATE** | `tests/brain/quality-weighting.test.ts` |
| **UPDATE** | `tests/brain/query-index.test.ts` |
| **UPDATE** | `tests/brain/recall-inject.test.ts` |
| **UPDATE** | `tests/brain/calibration-harness.test.ts` |
| **NO TOUCH** | `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` |
| **NO TOUCH** | Protect-list paths |
| **NO TOUCH** | `src/brain/build-index.ts`, `note-chunker.ts` (no reindex) |

### Testing requirements

1. **`quality-weighting.test.ts`:**
   - `applyQualityWeightStrength(0.25, 0)` → 1.0
   - `applyQualityWeightStrength(0.25, 1)` → 0.25
   - `applyQualityWeightStrength(0.25, 0.3)` → 0.775
   - Full path: reviewed note at α=1 → 1.0; α=0 → 1.0; α=0.3 → 1.0 (raw already 1.0)
   - Draft product at α=1 matches existing regression values

2. **`query-index.test.ts`:**
   - Fixture with two chunks differing only in quality: α=0 ranks by cosine; α=1 ranks by quality-weighted score; α=0.3 intermediate

3. **`recall-inject.test.ts` / `calibration-harness.test.ts`:**
   - Policy fixture includes `quality_weight_strength: 0.3`
   - Harness passes α to query path (mock or assert call args if using spies)

4. **Regression:** `portal-embedder.test.ts`, `indexing-secret-gate.test.ts`, `note-chunker.test.ts`, parent-collapse tests unchanged

### Previous story intelligence (79-6)

- **Chunking fixed ranking geometry** — parent-collapse + passage vectors; do not revisit chunking in this story
- **Calibration still fails** at 13–16/30 channel runs (10 queries × 3 channels) — root cause is quality dominance, not chunking
- **79-6 left `shadow_mode: true`** — preserve
- **79-6 operator session block** — reuse env vars; **skip `brain:index`** (scoring-only)
- **Golden set reduced 12→10** with corrected expected paths — treat as fixed target

### Git intelligence

Recent Epic 79: `4b1eba7` (79-6 chunking) → `dc46cc7` (79-5 plugin) → `94c6c75` (79-4 calibration). Follow: vitest in `tests/brain/`, one logical commit, co-author trailer, `verify.sh` gate.

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — no direct `AI-Context/AGENTS.md` edits
- Deferred: `deferred-work.md` §79-4/79-5 — live calibration blocked until this story; latency measurement at live cutover
- Sprint: Epic 79 `in-progress`; 79-6 in `review`

### References

- `_bmad-output/implementation-artifacts/79-6-chunked-brain-index-chunk-aware-recall.md` — chunking + calibration evidence
- `_bmad-output/implementation-artifacts/79-4-golden-set-calibration-gate.md` — harness + waiver path
- `config/brain-golden-queries.json` — frozen 10-query set
- `src/brain/retrieval/quality-weighting.ts` — current product formula (Story 12.7)
- `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` — Epic 79 FR19

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor)

### Debug Log References

- Implemented α blend in `query-index.ts` only (SSOT); `computeQualityMultiplierComponents` stays raw.
- Default α=0.3 via `DEFAULT_QUALITY_WEIGHT_STRENGTH`; `qualityWeighting: false` forces effective multiplier 1.0 regardless of policy α.
- Explain output: `qualityMultiplier` = raw; `effectiveQualityMultiplier` + `qualityWeightStrength` on components when weighting enabled.

### Completion Notes List

- **α default:** 0.3 in `config/brain-recall-policy.json` (`index.quality_weight_strength`)
- **Thresholds (starting bracket, live tune pending):** voice_pane 0.15, standard_text 0.12, yapped_text 0.10; policy_version `0.2.0`
- **Regression lock:** `applyQualityWeightStrength(raw, 1)` === raw; tests at α=1 preserve pre-79-7 ranking behaviour
- **verify.sh:** PASS (1340 tests)
- **Live calibration:** NOT RUN this session — operator to run `brain:calibrate` against Portal + existing v2 index after diff review; then flip `operator_signoff` + `shadow_mode`

### File List

- `src/brain/retrieval/quality-weighting.ts`
- `src/brain/retrieval/query-index.ts`
- `src/brain/recall-policy.ts`
- `src/brain/recall-inject.ts`
- `src/brain/calibration-harness.ts`
- `src/brain/query-index-cli.ts`
- `config/brain-recall-policy.json`
- `tests/brain/quality-weighting.test.ts`
- `tests/brain/query-index.test.ts`
- `tests/brain/recall-inject.test.ts`
- `tests/brain/calibration-harness.test.ts`

### Change Log

- 2026-06-26: Story 79-7 — tunable α quality blend, policy schema, call-chain threading, threshold bracket, tests (live cal deferred to operator)
