---
story_id: 90-4
epic: 90
title: dedupe-over-collapse-retune
status: done
created: 2026-07-23
revised: 2026-07-23
operator_brief: 2026-07-23
baseline_commit: e9049d3
predecessors: 90-2
sequencing: AFTER 90-2; BLOCKS 90-3; protects 90-1 reddit
design_gate: APPROVED_2026-07-23 — R1(canonicalDomainPath v=)+R2(prop≥0.5)+R4(K=5 stderr); SKIP cap8; STOP before merge (review implementation)
do_not_touch: score-digest-signals.mjs; adapter exit-0/stdout; hardcoded API keys; WriteGate
prod_evidence: ~/.hermes/digest-push-2026-07-22.json
sim_artifacts:
  - _bmad-output/implementation-artifacts/90-4-sim-reconfirm-r1-canon-2026-07-22.json
  - _bmad-output/implementation-artifacts/90-4-reconstructed-pre-dedupe-2026-07-22.json
  - _bmad-output/implementation-artifacts/90-4-sim-report-2026-07-22.json
  - _bmad-output/implementation-artifacts/90-4-before-after-sim-2026-07-22.txt
backlog_followon: invert normalize/canon to strip tracking-only and preserve identity params by default (NOT in 90-4)
---

# Story 90.4: Fix cross-source dedupe over-collapse

Status: done

<!-- Design APPROVED 2026-07-23. Implement only after / when operator starts dev-story; STOP for implementation review before merge. -->

Epic: **90 — Intake health** · **`90-4-dedupe-over-collapse-retune`**  
**Depends on:** 90-2 (triple counts) · **Blocks:** 90-3 · **Protects:** 90-1 reddit

## Story

As a **CNS operator**,
I want **YouTube URL identity restored in `canonicalDomainPath` and entity-match tightened to proportion≥0.5, with a wipe alarm when fetch≥5 stores 0 primaries**,
so that **distinct youtube (and other low-priority) items survive as primaries while genuine near-dups still delete-to-one-winner**.

---

## Approved ship package (binding)

| ID | Change | Notes |
|----|--------|-------|
| **R1** | Preserve YouTube `v=` / `youtu.be` id in **`canonicalDomainPath`** (primary) and align **`normalizeDigestUrl`** exact-URL arm | Domain-path arm is query-agnostic today (`host+pathname` only) — **that** is where 25 collide. Exact-URL alone is insufficient. |
| **R2** | `crossTitleEntityMatch`: keep shared≥2 + 24h window; **add** `shared / min(\|nounsA\|,\|nounsB\|) ≥ 0.5` | Deletion retained for clusters that still form |
| **R4** | Wipe/heavy-absorb **stderr** alarm from 90-2 `fetchCount`/`storedPrimaryCount` (K=5) | Log-only (yt-stage posture). **No** Convex/`sourceOutcomes` field. |
| **SKIP** | Entity size **cap8** | Residual vacuum≈6 is within legit range; static cap risks clipping large legit families |

**Q3 other hosts:** none now (path-based sources). **Backlog (do not build in 90-4):** invert normalize/canon to strip only tracking params (`utm_*`, `fbclid`, `gclid`, `ref`) and **preserve identity params by default**.

**Scorer:** untouched. **Deletion:** kept for genuine clusters.

---

## R1 — explicit `canonicalDomainPath` (verify before ship)

Today:

```158:168:scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs
export function canonicalDomainPath(url) {
  const normalized = normalizeDigestUrl(url);
  // ...
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${host}${path}`;  // drops u.search → all watch?v=* → youtube.com/watch
}
```

**Required behavior after R1:**

| Input | Prod canon | R1 canon |
|-------|------------|----------|
| `…/watch?v=x3r7coukSKk` | `youtube.com/watch` | `youtube.com/watch?v=x3r7coukSKk` |
| `…/watch?v=aKEQ0wRoRW0` | `youtube.com/watch` (same) | `youtube.com/watch?v=aKEQ0wRoRW0` (distinct) |

Reconfirm measurement: **prod unique yt canons = 1 → R1 unique yt canons = 25**.

Also update `normalizeDigestUrl` so the exact-URL arm matches (HN-style identity keep), but **AC tests must assert `canonicalDomainPath`**, not only normalize.

---

## Reconfirmed before/after (canonicalDomainPath wired in sim)

Fixture: reconstructed pre-dedupe from `digest-push-2026-07-22.json` (`90-4-reconstructed-pre-dedupe-2026-07-22.json`).  
Report: `90-4-sim-reconfirm-r1-canon-2026-07-22.json`.

| Package | yt primaries | twitter★ (Claude tips) | anth polymarket | btc ETF | rss near-dup |
|---------|-------------|------------------------|-----------------|---------|--------------|
| **PROD** | **0** | **30** (yt25) | 5 ✓ | 3 ✓ | 2 ✓ |
| **R1 only** (`canonicalDomainPath`+normalize) | **10** | 14 (yt12) | 5 ✓ | 3 ✓ | 2 ✓ |
| **SHIP R1+R2** | **18** | **6** (yt4) | 5 ✓ | 3 ✓ | 2 ✓ |

**Success checks for ship package:**

- YouTube primaries restored (0 → **18**)
- Three legit clusters still collapse (5 / 3 / 2)
- Residual twitter★=6 accepted (cap8 skipped; R4 alarms total wipes)

### Reddit inject (15 topic posts)

| Package | reddit primaries | absorbed into size≥8 clusters |
|---------|------------------|-------------------------------|
| PROD | 1 | **10** |
| R1 only | 1 | **10** |
| **SHIP R1+R2** | 1 | **5** (improved; not zero) |

R1 alone does not protect reddit (entity still glues). R2 halves cross-source absorption (10→5). Same-source reddit near-dup clusters among inject titles remain. **R4** catches total wipe (`fetch≥5 && primary==0`) and soft heavy-absorb (`primary < 50% fetch`) via **stderr only**; residual partial absorption is accepted without cap8.

---

## Acceptance Criteria

### 1. R1 canonicalDomainPath (AC: canon)

**Given** two distinct YouTube `watch?v=` URLs  
**When** `canonicalDomainPath` runs  
**Then** returned keys **differ** and each includes `v=<id>`  
**And** unit test fails if only `normalizeDigestUrl` is fixed but canon still returns `youtube.com/watch`  
**And** HN `id` preservation unchanged

### 2. R2 entity proportion (AC: entity)

**Given** `crossTitleEntityMatch`  
**When** shared proper nouns ≥2 and within 24h  
**Then** also require `shared/min(|A|,|B|) ≥ 0.5`  
**And** fixture reconfirm: yt primaries ≥18; anth≥5; btc≥3; rss≥2 on reconstructed 2026-07-22 set

### 3. Deletion preserved (AC: delete)

**Given** the three legit near-dup groups  
**Then** each still collapses to one primary (no keep-all-primaries)

### 4. R4 wipe alarm (AC: alarm)

**Given** 90-2 `fetchCount` / `storedPrimaryCount`  
**When** `fetchCount ≥ 5` and `storedPrimaryCount === 0`  
**Then** always-on **stderr** warn (hard wipe); soft heavy-absorb warn when `storedPrimaryCount < 0.5 * fetchCount`  
**And** no Convex/`sourceOutcomes` field; no forced re-insertion of losers

### 5. Reddit non-total-wipe (AC: reddit)

**Given** reddit-shaped inject  
**When** R1+R2 run  
**Then** cross-source absorption into size≥8 is **strictly less than** prod baseline (sim: 10→5)  
**And** Completion Notes record residual risk without cap8

### 6. Verify (AC: verify)

`bash scripts/verify.sh` exit 0; `score-digest-signals.mjs` untouched; real test output in Completion Notes

---

## Tasks / Subtasks

- [x] **T1 — R1** Amend `canonicalDomainPath` for youtube `v=` / youtu.be; align `normalizeDigestUrl`; tests assert **canon** keys distinct
- [x] **T2 — R2** Proportion ≥0.5 in `crossTitleEntityMatch`; fixture regression from reconstructed JSON
- [x] **T3 — R4** Alarm K=5 on 90-2 triple counts — **stderr-only** at push (`attachSourceOutcomes`); no contract/validator field
- [x] **T4 — Verify** `bash scripts/verify.sh`; paste output; note backlog invert-normalize
- [x] **T5 — STOP for operator implementation review before merge**

### Review Findings

- [x] [Review][Defer] R2 short-title / opposite-topic over-cluster — deferred (operator 2026-07-23): entity-match over-clusters short opposite-topic titles (e.g. `Nvidia Chip Shortage` × `Nvidia Chip Surplus`, ratio 0.67). Bounded (2-item clusters, no source wipe). Fix = require shared nouns to include the distinguishing token / anti-opposition guard; **MUST re-simulate polymarket cluster before shipping**. Do not raise `shared≥3` blindly. Not this PR.
- [x] [Review][Patch] Harden AC:reddit — assert `redditPrimaries >= 50% of injected` via reconstructed+inject path (aligned with R4 heavy-absorb 50% line); test-only; do not couple to fragile full-SSOT snapshot [tests/morning-digest-dedup-signals.test.mjs]
- [x] [Review][Patch] Orphaned JSDoc block attached to ENTITY_MATCH_PROPORTION instead of crossTitleEntityMatch [scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs:343-351]
- [x] [Review][Patch] normalizeYoutubeWatchUrl encodeURIComponent(v) vs canonicalDomainPath raw trim — align encoding [scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs:175,234]
- [x] [Review][Patch] classifyPrimaryAbsorbAlarm throws if counts is null/undefined — add nullish object guard [scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs:classifyPrimaryAbsorbAlarm]
- [x] [Review][Patch] 90-2 sanity test swapped youtu.be → watch?v= while comment still claims youtu.be coverage — restore at least one youtu.be URL [tests/parse-digest-source-outcomes.test.mjs:~412]
- [x] [Review][Defer] youtu.be/ID vs youtube.com/watch?v=ID still produce distinct canon keys [dedupe-digest-signals.mjs:canonicalDomainPath] — deferred, pre-existing (R1 comment intentional; path identity kept; bridging is invert-normalize adjacent)
- [x] [Review][Defer] Watch URLs with empty/missing v= still fall through to query-stripping fallback [normalizeYoutubeWatchUrl] — deferred, pre-existing malformed-URL edge
- [x] [Review][Defer] list=-only watch URLs without v= can still collapse to youtube.com/watch — deferred, pre-existing; out of 90-4 R1 scope
- [x] [Review][Defer] No host-variant unit tests for m./music./nocookie youtube hosts — deferred, pre-existing coverage gap
- [x] [Review][Defer] classifyPrimaryAbsorbAlarm treats negative storedPrimaryCount as heavy-absorb — deferred, counters are trusted integers from 90-2
- [x] [Review][Defer] attachSourceOutcomes console.error wiring has no direct spy test (alarm helpers covered separately) — deferred, yt-stage posture parity
- [x] [Review][Defer] Reddit inject test does not couple to collectPrimaryAbsorbAlarmWarnings / attachSourceOutcomes — deferred, R4 covered in outcomes suite

---

## Out of scope / backlog

- Entity size cap8 (skipped)
- Keep-all-primaries
- Survival floor
- Invert tracking-strip / identity-preserve-by-default for all hosts → **deferred backlog item** (documented in `deferred-work.md`)
- TikTok/other query-id hosts (none needed now)

---

## Dev Notes

### Implementation order

1. Fix **`canonicalDomainPath`** first (failing test: 25 distinct watch URLs → 25 distinct canons)  
2. Align `normalizeDigestUrl`  
3. Entity proportion  
4. Alarm wiring (needs 90-2 fields) — stderr only

### Anti-patterns

| Do not | Why |
|--------|-----|
| Fix only `normalizeDigestUrl` | Domain-path arm still collapses all youtube |
| Ship cap8 | Operator skipped |
| Edit scorer | Untouched |
| Build invert-normalize in 90-4 | Backlog |
| Persist `primaryAbsorbAlarm` on sourceOutcomes | Warning nothing renders ≠ Convex contract |

### References

- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` — `canonicalDomainPath`, `crossTitleEntityMatch`
- `_bmad-output/implementation-artifacts/90-4-sim-reconfirm-r1-canon-2026-07-22.json`
- `_bmad-output/implementation-artifacts/90-2-youtube-silent-drop-observability.md`

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Hermes skill install gate initially failed until `dedupe-digest-signals.mjs` + `parse-digest-source-outcomes.mjs` synced to `~/.hermes/skills/cns/morning-digest/scripts/`
- R4 corrected mid-impl: dropped persisted `primaryAbsorbAlarm` from outcomes/contract/dashboard validator; stderr-only like yt-stage

### Completion Notes List

- **R1:** `canonicalDomainPath` embeds `v=` for youtube watch hosts; `normalizeDigestUrl` preserves `v=` (HN-style). Prod 25→1 collision → 25 distinct keys.
- **R2:** `crossTitleEntityMatch` requires `shared/min(|A|,|B|) ≥ 0.5` (keeps shared≥2 + 24h). Cap8 skipped.
- **R4:** `classifyPrimaryAbsorbAlarm` / `collectPrimaryAbsorbAlarmWarnings` → `console.error` in `attachSourceOutcomes`. Hard wipe (`primary==0`) + soft heavy-absorb (`primary < 50% fetch`). No Convex field.
- **Residual without cap8:** reddit-style partial absorb still possible; soft alarm surfaces it in run logs.
- **Backlog:** invert-normalize documented in `deferred-work.md`.
- **`score-digest-signals.mjs`:** untouched (git clean).

#### Before/after sim (2026-07-22 reconstructed)

```
=== BEFORE/AFTER SIM (2026-07-22 reconstructed) ===
R1 canon: prod unique yt keys=1 → R1 unique yt keys=25
  sample prod: youtube.com/watch
  sample R1: youtube.com/watch?v=x3r7coukSKk, youtube.com/watch?v=aKEQ0wRoRW0, youtube.com/watch?v=Sqltu1xopSs
SHIP R1+R2: youtube_primaries=18 (target ≥18)
  polymarket anth cluster size=5
  Bitcoin ETF cluster size=3
  Import AI 465 cluster size=2
R4 alarms:
  dedupe-primary-wipe: youtube fetchCount=25 storedPrimaryCount=0
  dedupe-heavy-absorb: reddit fetchCount=15 storedPrimaryCount=1 (<50% of fetch)
```

#### Unit tests (excerpt)

```
ℹ tests 53
ℹ pass 53
ℹ fail 0
✔ R1+R2: 25 distinct yt canons, ≥18 yt primaries, legit clusters still collapse
✔ classifyPrimaryAbsorbAlarm hard wipe + soft heavy-absorb (Story 90-4 R4)
```

#### Verify

```
==> Hermes skill install gate
==> VERIFY PASSED
exit_code: 0
```

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `tests/morning-digest-dedup-signals.test.mjs`
- `tests/parse-digest-source-outcomes.test.mjs`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/90-4-dedupe-over-collapse-retune.md`
- `_bmad-output/implementation-artifacts/90-4-before-after-sim-2026-07-22.txt`
- `_bmad-output/implementation-artifacts/90-4-reconstructed-pre-dedupe-2026-07-22.json`
- `_bmad-output/implementation-artifacts/90-4-sim-reconfirm-r1-canon-2026-07-22.json`
- `_bmad-output/implementation-artifacts/90-4-sim-report-2026-07-22.json`

### Change Log

- 2026-07-23: Implemented R1+R2+R4 (stderr-only). SKIP cap8. verify.sh PASS. Status → review.
- 2026-07-23: Code review — D1 deferred (anti-opposition guard + polymarket re-sim); D2/P0–P4 applied (reddit ≥50% inject AC, JSDoc, encode align, null guard, youtu.be restore). verify PASS. Status → done.
