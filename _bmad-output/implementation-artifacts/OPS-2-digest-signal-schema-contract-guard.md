---
story_id: OPS-2
epic: ops-observability
title: cross-repo-digest-signal-schema-contract-guard
status: done
baseline_commit: 5fd3e7d2e294d2f4f5f27b6c7deebbdb6340906d
design_gate: APPROVED_2026-07-20
sequencing: cns-dashboard half FIRST (generates manifest) → Omnipotent.md half (consumes)
created: 2026-07-20
operator_brief: 2026-07-20
incident: 2026-06-20 ArgumentValidationError `viewCount` — partial write, 11 signals landed, 5 silent failures
repos: Omnipotent.md (producer) + cns-dashboard (consumer)
predecessors: OPS-1, 72-1, BD-4
supersedes_priority_of: OPS-3 (retry — recommended close-unbuilt)
---

# Story OPS-2: Cross-repo digest-signal schema contract guard

Status: **done — Phase A patches from code review applied 2026-07-20; Phase B complete**

## Design decisions — RESOLVED 2026-07-20 (these override the "Open Questions" section below)

| # | Question | **Decision** |
|---|---|---|
| 1 | Manifest location | **`Omnipotent.md/contracts/digest-signal-contract.json`** — it is a generated build artifact; `specs/cns-vault-contract/` is governed prose under the 87-2 sync-drift gate and would fight a regenerated file |
| 2 | Sweep vs runtime assertion | **BOTH.** The sweep catches drift at `verify.sh` time; the pre-flight assertion converts any escapee into a clean local failure with zero partial write. Dropping the assertion leaves `signalsWritten: 11` possible — the actual 06-20 harm |
| 3 | 60-1 skill-parity gate coverage | **Verify empirically**, do not assume. Run it, paste output. If it does not cover the morning-digest scripts, add an explicit `cmp` step |
| 4 | Run-level (`createDigestRun`) payload | **Include in v1.** Same pattern, much smaller object; deferring leaves a second unguarded surface on the same boundary |

### ⚠️ Consequence of decision 1 — the cross-repo skip trap

The manifest lives in `Omnipotent.md`, but AC2's test runs in `cns-dashboard` and must read across
repos (mirroring `verify.sh:59-72`, which locates the sibling via `CNS_DASHBOARD_ROOT`).

**A test that silently skips when the sibling repo is absent is not a guard** — it is the exact
"default toward silence" defect OPS-1 was built to eliminate, relocated into the test suite. In a
Vercel build or a fresh single-repo clone, the sibling will be missing.

Binding rules:

- **The `Omnipotent.md` half (AC3) is the HARD gate.** The manifest and the producer both live in
  that repo, so that test can never legitimately skip. It must fail, never skip, under all
  conditions.
- **The `cns-dashboard` half (AC2) may skip only when the sibling repo is genuinely absent**, and
  when it skips it must print a loud, explicit reason naming the resolved path it tried. A silent
  green is forbidden.
- Resolve the sibling via an env var with a sane default (`OMNIPOTENT_ROOT`, defaulting to
  `../Omnipotent.md`), matching the existing `CNS_DASHBOARD_ROOT` convention.
- **AC2 must include a test that the skip path itself behaves** — point it at a nonexistent root
  and assert it reports skipped-with-reason rather than passing quietly.

---

## Original gate (superseded above where they conflict)

## Story

As the **CNS operator**,
I want **a test that fails the moment the digest payload can emit a field the Convex validator does not accept**,
so that **a cross-repo schema drift is caught in `verify.sh` instead of by a partial write into production at 07:15**.

---

## The incident this closes (2026-06-20)

```
action=completion-convex-push-failed date=2026-06-20 exit=0
detail={"error":"…ArgumentValidationError: Object contains extra field `viewCount` that is not",
        "signalsWritten":11}
```

Five failures across ~2 hours, every one `exit=0`. **This is materially worse than the 2026-07-20
outage that prompted OPS-1**, in two ways:

1. **`signalsWritten: 11` — it was a PARTIAL WRITE.** Eleven signals landed in Convex before the
   twelfth was rejected. The run was neither absent nor complete: it was silently truncated.
   A missing day is obvious once you look; a *truncated* day looks like a quiet news day.
2. **It was self-inflicted and fully preventable.** The YouTube adapter (Story 72-1) began
   emitting `sourceMetadata.viewCount`; `sourceMetadataValidator` in `cns-dashboard` did not
   list it. Two repos, one contract, no link between them.

### The 06-20 fix treated the instance, not the class

`cns-dashboard@b0a6a05` — *"sync viewCount validator with push mutation args, add regression test"* —
added `viewCount: v.optional(v.number())` and a hand-written test asserting a hardcoded
`viewCount: 523806` payload round-trips. That test **proves `viewCount` works and cannot catch the
next field.** The class of bug is still fully open.

**And the drift surface is live right now:** BD-4 (shipped 2026-07-20) added `topicSlug` across this
exact boundary. It happened to be added on both sides. Nothing enforced that.

---

## Why this is structural, not bad luck

| Side | Repo | Language | Sites | Enforcement |
|---|---|---|---|---|
| **Producer** | `Omnipotent.md` | JS, untyped | **15** hand-written `sourceMetadata:` literals in `build-digest-push-payload.mjs` (one per adapter), **plus** a spread in `dedupe-digest-signals.mjs:446` (`{ ...winner.sourceMetadata }`) that can propagate any field into a merged signal | none |
| **Consumer** | `cns-dashboard` | TypeScript | **1** closed `sourceMetadataValidator` (~22 optional fields + nested `contributingSources` ×14 + `peopleMatch`) in `convex/validators.ts` | Convex rejects unknown fields at runtime, mid-write |

Fifteen untyped producer sites, one strict consumer, **zero compile-time or test-time link between
them**, in two separate git repos. Every new adapter and every new metadata field is a fresh
opportunity for the same failure. Convex validators reject extra fields by design — that is correct
behaviour, and it is *why* the producer must be checked ahead of time.

The dedupe spread at `dedupe-digest-signals.mjs:446` is the nastiest part: a field can reach Convex
in a *merged* signal without appearing at any adapter's construction site, so reading the 15
literals is not sufficient to know what can be emitted.

---

## Design Gate — OPEN

### (a) Shape of the guard — **PROPOSED: two-sided manifest**

A checked-in JSON manifest is the contract SSOT, and **both repos assert against it**:

```
specs/cns-vault-contract/contracts/digest-signal-contract.json   ← SSOT (proposed location)
```

- **`cns-dashboard` test:** the manifest's field set **equals** what `validators.ts` accepts
  (derived mechanically from the validator object, not hand-copied). Adding a validator field
  without regenerating the manifest fails here.
- **`Omnipotent.md` test:** every field the producer can emit is a **subset** of the manifest.
  Adding an adapter field without adding it to the contract fails here.

Either side drifting fails a test **in its own repo**, before deploy.

> **Hand-copying the field list into a test is not acceptable** — that just relocates the drift.
> Both sides must derive their view mechanically.

**Enforcement is already free:** `scripts/verify.sh:59-72` runs `cns-dashboard npm test` when the
sibling repo exists. One `bash scripts/verify.sh` covers both halves. **No new CI.**

**Decision needed:** manifest location. `specs/cns-vault-contract/contracts/` is proposed (it is the
existing cross-surface contract home and already has a sync-drift gate from 87-2), but it is
vault-governed — confirm that a machine-generated file belongs there rather than in
`Omnipotent.md/contracts/` with a copy assertion.

### (b) How to enumerate what the producer CAN emit — **DECISION REQUIRED, hardest part**

Static analysis of 15 object literals plus a spread is brittle. Three options:

1. **Exhaustive fixture sweep** *(recommended)* — run `buildDigestPushPayload` over a fixture set
   covering all 17 adapters, then `dedupe` (to exercise the `:446` merge), and collect the union of
   all keys actually emitted under `sourceMetadata` (and top-level signal). Assert ⊆ manifest.
   **Strength:** catches the dedupe spread, which static reading cannot.
   **Weakness:** only as good as fixture coverage — a field on an adapter path with no fixture is
   invisible. **Mitigate with AC4** (adapter-count parity), which fails when a new adapter is added
   without a fixture.
2. **Runtime assertion in the push path** — validate the payload against the manifest immediately
   before `pushDigestToConvex` and fail fast with a clear local error instead of a partial remote
   write. Complements (1); does not replace it (still fails at 07:15, just cleanly and atomically).
3. Static AST parse of the literals — rejected: misses the spread, high maintenance.

**Recommend 1 + 2:** (1) catches drift at `verify.sh` time; (2) converts any escapee into a clean
pre-flight failure with **zero partial write**. (2) is the direct fix for `signalsWritten: 11`.

### (c) Scope of the contract — **PROPOSED**

Cover `digestSignalInputValidator` **and** the nested `sourceMetadataValidator` (including
`contributingSources` and `peopleMatch`). The run-level payload (`createDigestRun`) is a second,
smaller surface — **include it if cheap, defer if it doubles the story**, and say which in the Dev
Agent Record.

---

## Draft Acceptance Criteria

*(Not binding until the design gate is approved; (b) may reshape AC2–AC3.)*

**AC1 — Contract manifest exists** at the agreed path, machine-generated, with a documented
regeneration command. Never hand-edited.

**AC2 — `cns-dashboard` side:** a test asserts the manifest's field set equals the fields
`digestSignalInputValidator` + `sourceMetadataValidator` accept, derived from the validators
themselves. **Red-test proof:** adding a field to `validators.ts` without regenerating fails.

**AC3 — `Omnipotent.md` side:** a test asserts the union of keys emitted by
`buildDigestPushPayload` + `dedupeSignals` across an all-adapter fixture sweep is a subset of the
manifest. **Red-test proof required — the story is not done without it:** re-introduce the exact
06-20 defect (emit `sourceMetadata.viewCount` with `viewCount` removed from the manifest) and show
the test fails. A guard that has never been seen to fail is not a guard.

**AC4 — New-adapter tripwire:** the fixture sweep asserts coverage of every key in
`COLLECT_ADAPTER_TASK_KEYS` (`run-digest-convex-completion.mjs:127`, currently 17). Adding an
adapter without a fixture fails the test — this is what stops AC3 rotting into a false green.

**AC5 — Pre-flight validation (gate (b) option 2):** the push path validates against the manifest
before the first Convex write. On violation: fail with a named error identifying the offending
field, write **nothing**, and produce a terminal action that trips OPS-1's alert. **Zero partial
writes.**

**AC6 — OPS-1 interop:** a contract violation surfaces as `overall !== 'success'` → exit 1 + Discord
alert, naming the offending field. Regression-test against OPS-1's ACs; do not weaken them.

**AC7 — Dual-copy parity:** unlike OPS-1, this story **does** touch
`scripts/hermes-skill-examples/morning-digest/scripts/`, whose runtime twin is
`~/.hermes/skills/cns/morning-digest/scripts/`. Any modified file there must be byte-identical
across both trees — **verify with `cmp`** and paste the output. (`verify.sh` has a skill-parity gate
from 60-1; confirm it covers these files, and say so in the record.)

**AC8 — `bash scripts/verify.sh` passes**, exercising both repos' halves in one run.

## Out of Scope

- Making the Convex write **atomic/transactional** across signals. AC5 prevents the *known* partial
  write (contract violations); a mid-write network failure could still truncate. Genuine atomicity
  is a `cns-dashboard` Convex story — **log it, do not absorb it.**
- Retry (OPS-3 — recommended close-unbuilt, zero transient failures in log history).
- Widening `sourceMetadataValidator` to `v.any()` — that would "fix" the symptom by deleting the
  contract. **Explicitly rejected.**
- Backfilling the truncated 2026-06-20 run.
- Contract guards for other Convex surfaces (entityMentions, keywordCandidates, hermesAwareness).
  Same class of risk; separate stories. Note whether the manifest pattern generalizes.

## Verification

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md
node --test tests/morning-digest-build-payload.test.mjs tests/morning-digest-dedup-signals.test.mjs
bash scripts/verify.sh          # runs BOTH repos (verify.sh:59-72)

cd ../cns-dashboard && npm test -- digest
```

Plus both red-test proofs (AC2, AC3) demonstrated and pasted into the Dev Agent Record.

## Tasks / Subtasks (Phase B — Omnipotent.md)

- [x] AC3 — Fixture sweep: `buildDigestPushPayload` + `dedupeSignals` emitted keys ⊆ manifest
- [x] AC3 — Red-test proof: strip `viewCount` from manifest copy → FAIL (paste below)
- [x] AC4 — New-adapter tripwire against `COLLECT_ADAPTER_TASK_KEYS` (17)
- [x] AC5 — Pre-flight validation in `pushDigestToConvex` before first Convex write (zero partial writes)
- [x] AC6 — OPS-1 interop: contract violation → `overall !== success` → exit 1 + Discord alert naming field; AC2 zero-call spy preserved
- [x] AC7 — Dual-copy `cmp` of modified morning-digest scripts; empirical 60-1 skill-parity check
- [x] AC8 — `bash scripts/verify.sh` PASS

## Open Questions — close before dev

1. **Manifest location** — RESOLVED: `Omnipotent.md/contracts/`
2. **Fixture sweep vs runtime assertion** — RESOLVED: BOTH
3. Does `verify.sh`'s 60-1 skill-parity gate already cover the morning-digest scripts touched here,
   or is a `cmp` step needed in this story? (AC7) — **RESOLVED empirically: YES, 60-1 covers `morning-digest` via `PARITY_SKILLS` (`diff -rq` of entire skill tree). Explicit `cmp` still run for the two modified files.**
4. Include the run-level (`createDigestRun`) payload in v1, or defer? — RESOLVED: include in v1

## Dev Agent Record

### Implementation Plan

1. Consume Phase A manifest at `contracts/digest-signal-contract.json` (hard gate — never skip).
2. Guard module `digest-signal-contract-guard.mjs`: load manifest, collect emitted keys, validate ⊆ field sets; sanitize rescore-transport `run.digestRunId` / `signal.digestSignalId` before check.
3. All-adapter fixture covering 17 `COLLECT_ADAPTER_TASK_KEYS` + dedicated dedupe cluster for `:446` merge.
4. Wire `assertPayloadMatchesDigestSignalContract` into `pushDigestToConvex` before any Convex fetch.
5. OPS-1 interop test: poison payload → real `pushDigestToConvex` → `completion-convex-push-failed` → exit 1 + alert naming field; strengthen AC2 zero-call spy.
6. Dual-copy via `install-hermes-skill-morning-digest.sh` + `cmp`.

### Debug Log

- Pre-flight initially rejected rescore payloads carrying `run.digestRunId` / `signal.digestSignalId` (local identity carriers, omitted before Convex mutations). Fixed via `sanitizePayloadForContractCheck` + omit `digestRunId` on create path.
- Lint: `preserve-caught-error` required `{ cause: err }` on contract parse failure.

### Completion Notes

- **Phase B only** (AC3–AC8). Phase A (AC1–AC2) landed in cns-dashboard; manifest present at `contracts/digest-signal-contract.json`.
- Decision 4: run-level `digestRunInput` / `digestSourceOutcome` included in validation.
- **AC3 red-test proof (pasted):**
  ```
  [OPS-2 AC3 red-test] FAIL as required:
   OPS-2 contract violation: extra field(s) not in digest-signal-contract.json: sourceMetadata.viewCount
  violations: sourceMetadata.viewCount
  ✔ RED-TEST PROOF: emit viewCount with viewCount removed from manifest → FAIL
  ```
- **AC7 `cmp` proof (pasted):**
  ```
  cmp guard: OK
  cmp push: OK
  ```
- **Decision 3 / 60-1 empirical:** `PARITY_SKILLS = ['notebook-query', 'morning-digest', 'session-close']` — **YES, the 60-1 gate covers these files** (`diff -rq` of the entire `morning-digest` skill tree). Explicit `cmp` still executed for the two modified scripts. `node scripts/assert-hermes-skill-install-gate.mjs` → exit 0.
- OPS-1 AC2 not weakened: skipped-already-pushed asserts `alertCalls === 0`.
- `bash scripts/verify.sh` → **VERIFY PASSED** (both repos).

### File List

- `contracts/digest-signal-contract.json` (Phase A artifact — consumed, not authored here)
- `scripts/hermes-skill-examples/morning-digest/scripts/digest-signal-contract-guard.mjs` (new)
- `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` (modified — AC5 pre-flight)
- `tests/fixtures/all-adapters-digest-contract.fixture.mjs` (new)
- `tests/digest-signal-contract-guard.test.mjs` (new — AC3/AC4)
- `tests/morning-digest-push-convex.test.mjs` (modified — AC5)
- `tests/run-digest-convex-completion.test.mjs` (modified — AC6 + OPS-1 AC2 spy)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/OPS-2-digest-signal-schema-contract-guard.md` (this story)
- `~/.hermes/skills/cns/morning-digest/scripts/{digest-signal-contract-guard,push-digest-convex}.mjs` (dual-copy install)

### Change Log

- 2026-07-20: OPS-2 Phase B — fixture sweep ⊆ manifest, new-adapter tripwire, pre-flight assertion (zero partial writes), OPS-1 interop, dual-copy parity. verify.sh PASS.

## Open Questions — closed (see Design decisions table at top)

### Review Findings

Phase A commit `ced8406` reviewed 2026-07-20 (cns-dashboard half). Focus: complete validator walk, skip trap, generator determinism.

- [x] [Review][Patch] `generatedAt` breaks byte-identical regeneration — fixed via `resolveGeneratedAt()` / `DETERMINISTIC_GENERATED_AT` (+ `SOURCE_DATE_EPOCH`) [`scripts/lib/digest-signal-contract.ts`]
- [x] [Review][Patch] Nested object walk is allowlisted, not discovered — fixed via `discoverNestedObjectFieldSets` / `isNestableObjectField` [`scripts/lib/digest-signal-contract.ts`]
- [x] [Review][Patch] AC2 red-test / fail-path unproven in suite — added stale-manifest red-test + non-array fieldSets fail test [`tests/contracts/digest-signal-contract.test.ts`]
- [x] [Review][Patch] Hand-copied `peopleMatch` field list in sanity test — replaced with mechanical `nestedObjectFieldNames` equality [`tests/contracts/digest-signal-contract.test.ts`]
- [x] [Review][Patch] Non-array `fieldSets` values throw instead of returning `fail` — `Array.isArray` guard in `diffFieldSets` [`scripts/lib/digest-signal-contract.ts`]
- [x] [Review][Defer] Convex validator introspection depends on undocumented `kind`/`fields`/`element` (+ `isOptional` flag) — deferred, inherent to mechanical approach; live Convex keeps optional as `kind=object|array` with `isOptional`, so current nests work; if Convex wraps as `kind=optional`, extractor throws (loud) not silent skip
- [x] [Review][Defer] Sibling presence check is `package.json` only — deferred, soft false-positive risk if another Node tree sits at `OMNIPOTENT_ROOT`
- [x] [Review][Defer] Generator writes into sibling repo without Omnipotent identity check / atomic write — deferred, operational; `OMNIPOTENT_ROOT` documented

