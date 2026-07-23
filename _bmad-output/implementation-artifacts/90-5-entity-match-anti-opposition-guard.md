---
story_id: 90-5
epic: 90
title: entity-match-anti-opposition-guard
status: done
created: 2026-07-23
operator_brief: 2026-07-23
baseline_commit: 610d5e3
predecessors: 90-4
sequencing: AFTER 90-4; deferred D1 from 90-4 code review
design_gate: APPROVED_G7 — operator 2026-07-23; antonym-always + short-title entity disable (min(|A|,|B|) <= 3)
do_not_touch: score-digest-signals.mjs; URL/domain/title-Jaccard arms; youtube v= canon (90-4 R1); R4 alarm / Convex contract; adapter exit-0/stdout; new npm deps
prod_evidence: ~/.hermes/digest-push-2026-07-22.json
sim_artifacts:
  - _bmad-output/implementation-artifacts/90-4-reconstructed-pre-dedupe-2026-07-22.json
  - _bmad-output/implementation-artifacts/90-4-sim-reconfirm-r1-canon-2026-07-22.json
  - _bmad-output/implementation-artifacts/90-5-guard-sim-proposal-2026-07-22.json
  - _bmad-output/implementation-artifacts/90-5-before-after-sim-proposal-2026-07-22.txt
  - _bmad-output/implementation-artifacts/90-5-before-after-sim-shipped-2026-07-22.json
  - _bmad-output/implementation-artifacts/90-5-before-after-sim-shipped-2026-07-22.txt
deferred_source: _bmad-output/implementation-artifacts/deferred-work.md (Entity-match over-clusters short opposite-topic titles) — CLOSED 2026-07-23
---

# Story 90.5: Entity-match anti-opposition / short-title guard

Status: done

<!-- DESIGN GATE: APPROVED G7 2026-07-23. Shipped antonym-always + short-title entity disable. -->

Epic: **90 — Intake health** · **`90-5-entity-match-anti-opposition-guard`**  
**Depends on:** 90-4 (R1 canon + R2 proportion≥0.5) · **Origin:** 90-4 review deferral D1

## Story

As a **CNS operator**,
I want **`crossTitleEntityMatch` to refuse short opposite-topic / extension-only title pairs while preserving load-bearing legit clusters**,
so that **distinct or contradictory stories (Shortage×Surplus, ETF×ETF Rally, Tips×Tips for beginners) keep separate primaries without re-opening the 90-4 YouTube vacuum**.

---

## Design gate — APPROVED

**Operator approved G7 (2026-07-23):** antonym-always + short-title entity disable (`min(|A|,|B|) <= 3`). Not G3a. Polymarket AC binds to fixture cluster size **5**. Short geo false-negatives (Austin×Miami) accepted.

---

## Problem (confirmed)

`crossTitleEntityMatch` clusters when:

- shared proper nouns ≥ 2
- `shared / min(|A|,|B|) ≥ 0.5` (90-4 R2)
- both `publishedAt` within 24h

This **over-clusters short titles** that share topic nouns but differ on the semantically decisive token:

| Pair | nouns | shared | denom | ratio | Today |
|------|-------|--------|-------|-------|-------|
| Nvidia Chip Shortage × Surplus | {nvidia,chip,shortage} × {nvidia,chip,surplus} | 2 | 3 | 0.67 | **merge (wrong)** |
| Bitcoin ETF × Bitcoin ETF Rally | {bitcoin,etf} ⊂ {bitcoin,etf,rally} | 2 | 2 | 1.0 | **merge (wrong)** |
| Claude Tips × Claude Tips for beginners | {claude,tips} = {claude,tips} (lowercase ignored) | 2 | 2 | 1.0 | **merge (wrong)** |

Effect is **bounded** (2-item clusters; not the 33-item vacuum 90-4 fixed) but still deletes a primary for a distinct/contradictory story.

### Load-bearing constraint — polymarket must survive

Fixture family (reconstructed 2026-07-22):

- 4× `Which company has best AI model end of July?… | Polymarket`
- 1× `Will Anthropic have the best AI model at the end of July 2026?`
- Cluster size after 90-4 ship: **5** (operator said “x6”; **AC binds to fixture size 5**)

**Anthropic ↔ Which company** (the load-bearing edge):

- nouns: `{will,anthropic,ai,july}` ↔ `{which,ai,july,trading,odds,predictions,polymarket}`
- shared = `{ai,july}` = **2**, denom = 4, ratio = **0.5**
- title-Jaccard ≈ **0.333** (misses 0.85 arm)
- → clusters **only** via entity-match

**Do NOT:**

- raise global `shared ≥ 3` (sim: `shared3_global` → polymarket collapses; `legit_ok=false`)
- add company-name / “ai” / “july” stopwords (same glue tokens)

---

## Candidate guards (compared)

Sim source: `90-5-guard-sim-proposal-2026-07-22.json` · summary: `90-5-before-after-sim-proposal-2026-07-22.txt`  
Fixture: `90-4-reconstructed-pre-dedupe-2026-07-22.json` + 6-title opposite/short inject.

| ID | Guard | Opposite inject OK? | Legit clusters OK? | Notes |
|----|-------|---------------------|--------------------|-------|
| **baseline** | 90-4 R2 only | no (2/6 primaries) | yes | Nvidia/btc/claude all merge |
| **G1** | Antonym lexicon only | **no** | yes | Fixes Shortage×Surplus; **misses** ETF⊂Rally + Claude Tips |
| **G3a** | Short (`min≤3`) require `shared≥3` | **yes** | yes | Passes both checks; opaque vs G7; same short false-negatives |
| **G3b** | Short require prop≥0.75 | **no** | yes | Misses ratio=1.0 subset/identical |
| **G4** | Antonym + short subset + short identical-weak-jaccard | **no** | yes | Claude+Nvidia OK; **Rally still absorbs into fixture Bitcoin ETF Flows** (shared bitcoin+etf, denom=3) |
| **G7 ★** | **Antonym ALWAYS + short entity disable (`min(|A|,|B|)≤3`)** | **yes (6/6)** | **yes** | Recommended — **SHIPPED** |
| **shared≥3 global** | Raise shared floor everywhere | yes | **NO** | Breaks Anthropic↔Which |

### Side effect under G7 (fixture, no inject)

| Metric | BEFORE (R1+R2) | AFTER G7 |
|--------|----------------|----------|
| youtube_primaries | 18 | **22** |
| total primaries | 124 | **129** |
| polymarket best-AI | **5** | **5** |
| Bitcoin ETF Flows | **3** | **3** |
| Import AI 465 | **2** | **2** |

More short-title entity clusters dissolve → more primaries (aligned with intake-health goal). Legit three still collapse.

### Residual false-negative (accepted)

Short near-dups that only entity-match would catch, e.g. `Tesla Robotaxi Austin` × `Tesla Robotaxi Miami` (shared=2, denom=3, jaccard≪0.85), stay separate under G7. They must win via URL/canon/Jaccard if they should merge. Document in Completion Notes; do not re-open global shared≥3 to “fix” them.

---

## Shipped package (G7)

1. **Antonym exclusive-token guard (always):** if exclusive proper-noun tokens on A/B form a known antonym pair → `crossTitleEntityMatch` returns false.  
   In-code `const ANTONYM_PAIRS` (lowercase; no new dep). Seed: shortage/surplus, rise/fall, up/down, gain/loss, buy/sell, bull/bear, win/loss, hike/cut, increase/decrease, boom/bust, surge/slump, rally/crash.
2. **Short-title entity disable:** after shared≥2 + proportion≥0.5 gates, if `min(|nounsA|,|nounsB|) ≤ 3` → return false (entity arm off). Short titles may still cluster via exact-URL, `canonicalDomainPath`, or title-Jaccard ≥ 0.85.

**Untouched:**

- URL / domain-path / title-Jaccard arms in `shouldClusterSignals`
- 90-4 YouTube `v=` canon
- Deletion semantics for clusters that still form
- `score-digest-signals.mjs`
- R4 stderr alarms / Convex `sourceOutcomes` contract (no new persisted field)

---

## Acceptance Criteria

### 0. Design gate (AC: gate)

**Given** this story  
**When** operator has not approved a guard  
**Then** no production code change lands  
**And** after approval, ship exactly the approved package (default **G7**)

### 1. Opposite / short pairs separate (AC: oppose)

**Given** synthetic pairs within 24h  
**When** `crossTitleEntityMatch` runs under approved guard  
**Then** all return false:

- `Nvidia Chip Shortage` × `Nvidia Chip Surplus`
- `Bitcoin ETF` × `Bitcoin ETF Rally`
- `Claude Tips` × `Claude Tips for beginners`

**And** fixture+inject sim: all six inject URLs remain primaries (`nvidiaBoth && btcBoth && claudeBoth`)

### 2. Legit clusters survive (AC: legit)

**Given** `90-4-reconstructed-pre-dedupe-2026-07-22.json`  
**When** full `dedupeDigestSignals` runs  
**Then**:

| Cluster | `dedupClusterSize` |
|---------|-------------------|
| polymarket best-AI / Anthropic family | **5** |
| Bitcoin ETF Flows family | **3** |
| Import AI 465 × Kimi K3 near-dup | **2** |
| youtube primaries | **≥ 18** (G7 sim: 22 OK) |

### 3. Scope hygiene (AC: scope)

**Given** the change set  
**Then** only `crossTitleEntityMatch` (and its local constants/helpers) change inside `dedupe-digest-signals.mjs`  
**And** `score-digest-signals.mjs` git-clean  
**And** no new Convex/validator/persisted outcome field  
**And** CLI still exit 0 + JSON stdout on success/failure paths

### 4. Lexicon (AC: lexicon)

**Given** antonym list  
**Then** it is a small in-file constant (no npm/pip dep)  
**And** covers at least the seed pairs in the recommended package

### 5. Verify (AC: verify)

`bash scripts/verify.sh` exit 0; paste real output in Completion Notes

---

## Tasks / Subtasks

- [x] **T0 — Operator approval** (AC: #0)
  - [x] Confirm **G7** or name alternate (`G3a` also passed both checks — record choice)
  - [x] Only then proceed to T1+
- [x] **T1 — Implement approved guard in `crossTitleEntityMatch`** (AC: #1 #3 #4)
  - [x] Antonym helper + `ANTONYM_PAIRS` constant
  - [x] Short disable `min(lenA,lenB) ≤ 3`
  - [x] Keep shared≥2, proportion≥0.5, 24h window
  - [x] Do not alter `shouldClusterSignals` URL/canon/Jaccard branches
- [x] **T2 — Tests** (AC: #1 #2)
  - [x] Unit: three opposite/short pairs → entity false
  - [x] Unit: OpenAI GPT-5 Release Event × Developer Preview still true (denom=4, non-antonym)
  - [x] Unit: Fed Hike × Cut long-antonym → false (G7 > G3a regression)
  - [x] Unit: shared antonym word does not fire opposition
  - [x] Fixture regression: polymarket=5, btc=3, importAI=2, yt≥18
  - [x] Optional: fixture+6 inject all remain primaries
- [x] **T3 — Re-run before/after sim; archive under `90-5-*`** (AC: #1 #2)
  - [x] Must show opposite separate **and** legit collapse
- [x] **T4 — Verify** (AC: #5)
  - [x] `bash scripts/verify.sh`; sync Hermes skill install if gate requires
- [x] **T5 — Close deferred item** in `deferred-work.md` for this D1 once shipped

### Review Findings

- [x] [Review][Decision] Lexicon policy — expand beyond approved seed and/or tighten ultra-generic pairs — **Resolved B (2026-07-23):** operator rejected C (keep all ultra-generic seeds). Ship B1 plural/inflected coverage of existing seeds first, then B2 small finance/tech expansion (singular+plural). Only `ANTONYM_PAIRS` changed.
- [x] [Review][Patch] Add plural/inflected forms for seed antonyms [`scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs:360`] — B1: explicit plurals (hikes/cuts, gains/losses, …); no stemmer.
- [x] [Review][Patch] Add short-title boundary unit tests [`tests/morning-digest-dedup-signals.test.mjs:328`] — min=3 reject + min=4 non-antonym still-true; plus B1/B2/false-fire regressions.
- [x] [Review][Patch] Amend Completion Notes AC:verify claim [`_bmad-output/implementation-artifacts/90-5-entity-match-anti-opposition-guard.md`] — scoped dedup green vs full-gate 73 flake caveat (see Completion Notes).
- [x] [Review][Defer] Sentence-case / lowercase decisive antonyms invisible to entity arm [`scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs:312`] — deferred, pre-existing — documented in `ANTONYM_PAIRS` comment; Title-Case filter is inherent.

---

## Dev Notes

### Current code (read before edit)

```346:380:scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs
/** Minimum shared/min(|A|,|B|) for entity-match (Story 90-4 R2). */
const ENTITY_MATCH_PROPORTION = 0.5;

export function crossTitleEntityMatch(a, b) {
  const nounsA = extractProperNounTokens(String(a.title ?? ''));
  const nounsB = extractProperNounTokens(String(b.title ?? ''));
  // shared≥2, proportion≥0.5, 24h window — only this function gains G7 gates
}
```

`shouldClusterSignals` order: exact URL → `canonicalDomainPath` → HN+Jaccard → Jaccard≥0.85 → **entity**. Only the last arm changes.

### Implementation sketch (G7 — shipped)

```js
const ENTITY_MATCH_SHORT_MAX = 3;
const ANTONYM_PAIRS = [ /* lowercase seed pairs */ ];
// build Map once at module load

function hasAntonymOpposition(nounsA, nounsB) { /* exclusive tokens antonym-linked */ }

// inside crossTitleEntityMatch, after proportion gate, before time gate:
if (hasAntonymOpposition(nounsA, nounsB)) return false;
if (Math.min(nounsA.length, nounsB.length) <= ENTITY_MATCH_SHORT_MAX) return false;
```

### Anti-patterns

| Do not | Why |
|--------|-----|
| `shared ≥ 3` globally | Breaks polymarket Anthropic↔Which (shared=2) |
| Company / AI stopwords | Same glue tokens |
| Edit Jaccard threshold to “fix” entity | Out of scope; breaks other arms |
| Touch scorer / Convex outcomes | Explicit constraint |
| Cap8 / keep-all-primaries | 90-4 already rejected |
| New dependency for lexicon | In-code constant only |

### Previous story intelligence (90-4)

- R1: `canonicalDomainPath` embeds youtube `v=` — **leave alone**
- R2: proportion≥0.5 — **keep**; G7 layers on top
- R4: stderr wipe/heavy-absorb — **leave alone**
- Review D1 deferred this exact bug; D2+ patches already landed
- Hermes skill install gate syncs `scripts/hermes-skill-examples/...` → `~/.hermes/skills/cns/morning-digest/scripts/`

### Git intelligence

Recent: `610d5e3` feat(90-4) dedupe retune; `ffb1297` 90-3 youtube quality; `8e0f1c9` 90-2 obs. Pattern: morning-digest scripts + `tests/morning-digest-dedup-signals.test.mjs`; verify.sh + skill install gate.

### Spec / vault

- No WriteGate / `vault_log_action` / `security.md` touch — vault constitution N/A for this script change
- Deferred SSOT: `_bmad-output/implementation-artifacts/deferred-work.md` (90-4 D1 bullet)
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`]
- [Source: `_bmad-output/implementation-artifacts/90-4-dedupe-over-collapse-retune.md`]
- [Source: `_bmad-output/implementation-artifacts/90-5-guard-sim-proposal-2026-07-22.json`]

### Project structure

| Path | Role |
|------|------|
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | **ONLY** production edit (`crossTitleEntityMatch` + constants) |
| `tests/morning-digest-dedup-signals.test.mjs` | New AC tests + keep 90-4 fixture regression |
| `_bmad-output/implementation-artifacts/90-5-*` | Sim / proposal artifacts |
| `~/.hermes/skills/cns/morning-digest/scripts/` | Install-gate mirror (verify.sh) |

---

## Open questions for operator (answer before T1)

1. **Approve G7?** (default recommendation) — or prefer **G3a** (`short shared≥3`), which also passed both sim checks? → **G7 approved**
2. **Fixture polymarket size:** AC uses **5** (reconstructed). Confirm OK vs live “x6” wording. → **binds to 5**
3. **Accept short geo false-negatives** (Austin×Miami stay separate)? Recommended yes. → **accepted**

---

## Dev Agent Record

### Agent Model Used

Composer (bmad-dev-story)

### Debug Log References

- Ship sim: `_bmad-output/implementation-artifacts/90-5-before-after-sim-shipped-2026-07-22.{json,txt}`
- Fixture AFTER G7: yt=22 polymarket=5 btc=3 importAI=2 primaries=129; inject 6/6 primaries

### Completion Notes List

- **T0:** Operator approved **G7** (not G3a). Polymarket AC = fixture size **5**. Short geo FNs (e.g. Tesla Robotaxi Austin × Miami) accepted — they must win via URL/canon/Jaccard.
- **T1:** Added lowercase `ANTONYM_PAIRS` + `ANTONYM_OF` map; `hasAntonymOpposition` tests exclusive tokens only (A−B × B−A); short disable `ENTITY_MATCH_SHORT_MAX=3`. Gates after proportion, before 24h window. `shouldClusterSignals` URL/canon/Jaccard untouched.
- **T2:** Unit tests for 3 short opposite pairs, OpenAI still-true, Fed Hike×Cut long-antonym (proves G7 > G3a), shared-antonym non-fire, fixture+6 inject. Existing 90-4 fixture regression still green.
- **T3:** Shipped sim archived; matches proposal expectations.
- **T4:** Hermes mirror synced (`diff -q` clean). Dedup suite green independently of full gate.

**Verify (scoped vs full):**
- **Scoped (authoritative for 90-5):** `node --test tests/morning-digest-dedup-signals.test.mjs` — **36/36 PASS** after review B1/B2 (was 32; +4 plural/new-pair/false-fire/boundary). Fixture ACs: polymarket=5, btc=3, importAI=2, yt≥18 intact.
- **Full `bash scripts/verify.sh` (2026-07-23 review B):** **VERIFY PASSED** (exit 0; npm `1549` pass / `0` fail / `0` cancelled). Pre-existing Story 73-4/73-7 async-timeout flakes (`cancelledByParent`) remain a known residual risk on other runs — **not attributable to 90-5** when they appear.
- **T5:** Closed 90-4 D1 bullet in `deferred-work.md`.
- **Review B (2026-07-23):** Operator chose expand (not C). B1 plurals + B2 finance/tech pairs added to `ANTONYM_PAIRS` only; Title-Case filter noted in comment; plural Hikes×Cuts / Gains×Losses regressions + false-fire guards shipped.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` (modified — G7 in `crossTitleEntityMatch` + local helpers/constants)
- `tests/morning-digest-dedup-signals.test.mjs` (modified — Story 90-5 G7 suite)
- `_bmad-output/implementation-artifacts/90-5-before-after-sim-shipped-2026-07-22.json` (added)
- `_bmad-output/implementation-artifacts/90-5-before-after-sim-shipped-2026-07-22.txt` (added)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — close D1)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — in-progress → review)
- `_bmad-output/implementation-artifacts/90-5-entity-match-anti-opposition-guard.md` (this story)
- `~/.hermes/skills/cns/morning-digest/scripts/dedupe-digest-signals.mjs` (Hermes install mirror sync; not git-tracked)

### Change Log

- 2026-07-23: Story created (propose-then-stop). G7 recommended; sim artifacts written. Awaiting operator approval before implementation.
- 2026-07-23: Operator approved G7. Implemented antonym-always + short-title disable; tests + ship sim; verify PASS; deferred D1 closed; status → review.
- 2026-07-23: Code review Decision **B** (reject C). B1 plural/inflected seed coverage + B2 finance/tech expansion in `ANTONYM_PAIRS` only; tests 36/36; fixture ACs intact.
