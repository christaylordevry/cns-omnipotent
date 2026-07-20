---
story_id: OPS-2
epic: ops-observability
title: cross-repo-digest-signal-schema-contract-guard
status: draft-pending-design-gate
created: 2026-07-20
operator_brief: 2026-07-20
incident: 2026-06-20 ArgumentValidationError `viewCount` — partial write, 11 signals landed, 5 silent failures
repos: Omnipotent.md (producer) + cns-dashboard (consumer)
predecessors: OPS-1, 72-1, BD-4
supersedes_priority_of: OPS-3 (retry — recommended close-unbuilt)
---

# Story OPS-2: Cross-repo digest-signal schema contract guard

Status: **draft — design gate OPEN, operator approval required before dev**

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

## Open Questions — close before dev

1. **Manifest location** — `specs/cns-vault-contract/contracts/` (vault-governed) vs
   `Omnipotent.md/contracts/`? See gate (a).
2. **Fixture sweep vs runtime assertion** — confirm both (gate (b) 1+2), or one?
3. Does `verify.sh`'s 60-1 skill-parity gate already cover the morning-digest scripts touched here,
   or is a `cmp` step needed in this story? (AC7)
4. Include the run-level (`createDigestRun`) payload in v1, or defer? (gate (c))
