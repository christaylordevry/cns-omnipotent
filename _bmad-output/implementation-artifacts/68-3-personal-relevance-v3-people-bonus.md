---
story_id: 68-3
epic: 68
title: personal-relevance-v3-people-bonus
status: done
baseline_commit: a3ca8c0
baseline_date: 2026-06-11
operator_brief: 2026-06-11
predecessors: 68-2, 67-3, 64-2
parallel: none
blocks: 68-8
repo: Omnipotent.md
fr_ids: FR-5
priority: P2
---

# Story 68.3: personalRelevance v3 — People Watchlist Bonus

Status: done

> **Epic 68 P2 — scoring-only story.** Implements FR-5: extend `scorePersonalRelevance` to apply handle-match (+20) and name-match (+10) bonuses from `ctx.nexusPeople` loaded by **68-2**. **Omnipotent.md only** — no Convex, cns-dashboard, adapter, or vault changes.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator tracking founders and researchers on Bluesky and X**,
I want **`scorePersonalRelevance` to boost signals authored by or mentioning people in my `nexus-people.yaml` watchlist**,
so that **Karpathy posts and Dario Amodei headlines rank above generic LLM news with equal market relevance, people tracking is meaningful in the ranked feed, and Epic 68 live validation (68-8 C6) can pass when the watchlist is configured**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup |
| **Priority** | **P2** — completes people-tracking layer started in 68-2; unblocks 68-8 C6 people-boost row |
| **Repo** | **Omnipotent.md only** — `score-digest-signals.mjs` + tests (+ optional validator threshold fix) |
| **Predecessors** | **68-2** (**done** — `loadNexusPeople`, `ScoringContext.nexusPeople`, `normalizePeopleHandle`); **67-3** (goal-weighted F1 v2 — bonuses **stack**, not replace); **64-2** (five dimensions + `computeRankScore`) |
| **Blocks** | **68-8** — C6 people-boost currently **WAIVED** until 68-2 **and** 68-3 are `done` |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.2 FR-5; `addendum.md` §A2 personalRelevance v3 bonus |
| **Out of scope** | `rankScore` weight changes (`RANK_WEIGHT_*`); Convex schema; cns-dashboard; adapter edits (68-5/68-6 already emit `authorHandle`); vault WriteGate; `nexus-people.yaml` parser/loader changes (68-2); Operator Guide (optional follow-up) |

### Operator rationale (binding)

Epic 68 sequencing: `68-1` → `68-4` → `68-5` ∥ `68-2` → **`68-3`** → … **68-2** loaded the watchlist but deliberately left `scorePersonalRelevance` unchanged. Social adapters already map `authorHandle` into `sourceMetadata`. This story makes people tracking affect ranking via existing `RANK_WEIGHT_PERSONAL` (0.3) — no formula redesign.

### Problem (current state)

| Gap | Today |
|-----|--------|
| No people bonus | `scorePersonalRelevance` uses base tier + goal tier + epic bonus only — ignores `ctx.nexusPeople` |
| Anti-drift test locks gap | `scorePersonalRelevance is unchanged when nexusPeople is populated` asserts **equality** — must flip to bonus assertions |
| JSDoc incomplete | `DigestSignal.sourceMetadata` missing `authorHandle` (deferred from 68-2) |
| 68-8 C6 waived | `validate-epic-68-digest.mjs` defaults `peopleStoriesDone: false` |

**Current `scorePersonalRelevance` (post-67-3, pre-68-3):**

```1181:1191:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
export function scorePersonalRelevance(signal, ctx) {
  const signalTokens = tokenizeSignalText(signal.title, signal.summary);
  const baseTier = weightedPersonalF1(
    signalTokens,
    ctx.personalTokens.map((token) => ({ token, weight: 1 })),
  );
  const goalTier = weightedPersonalF1(signalTokens, ctx.goalWeightedTokens ?? []);
  const combined = Math.max(baseTier, goalTier);
  const epicBonus = ctx.epicNumericTokens.some((token) => signalTokens.includes(token)) ? 15 : 0;
  return clamp(combined + epicBonus, 0, 100);
}
```

**68-2 already wires `nexusPeople` on context:**

```1075:1080:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
  const nexusPeopleResult = await loadNexusPeople(operatorHome);
  if (nexusPeopleResult.diagnostic) {
    console.error(nexusPeopleResult.diagnostic);
  }
  const nexusPeople = nexusPeopleResult.people;
```

### Target scoring flow

```text
scorePersonalRelevance(signal, ctx)
  → baseTier + goalTier (67-3, unchanged)
  → epicBonus (+15, unchanged)
  → peopleHandleBonus (+20 if authorHandle matches any loaded handle)  ← NEW
  → peopleNameBonus (+10 if name F1 ≥ 0.3 vs title/summary)            ← NEW
  → clamp(0, 100)
  → flows through computeRankScore via existing RANK_WEIGHT_PERSONAL
```

---

## Acceptance Criteria

### 1. Handle-match bonus (FR-5)

**Given** `ctx.nexusPeople` contains a person with `handles.twitter: ["karpathy"]` (or bluesky handle)
**When** `scorePersonalRelevance` scores a signal with `sourceMetadata.authorHandle: "karpathy"` or `"@Karpathy"` or `"karpathy.bsky.social"`
**Then** result includes **+20** people-handle bonus on top of base/goal/epic tiers
**And** handle comparison uses `normalizePeopleHandle` (lowercase, strip `@`, trim) on both signal handle and all handles across all platforms per person
**And** at most **one** +20 per signal (multiple people or duplicate handles do not stack beyond +20)
**And** missing or empty `authorHandle` → no handle bonus

**Mandatory FR-5 fixture delta:**

| Input | Expected |
|-------|----------|
| Karpathy bluesky signal with `authorHandle: "karpathy.bsky.social"`, people file loaded | `personalRelevance` **≥20 points higher** than same signal with `ctx.nexusPeople: []` |
| Same signal, empty `nexusPeople` | No people bonus (baseline) |

### 2. Name-match bonus (FR-5)

**Given** `ctx.nexusPeople` contains `{ name: "Dario Amodei", handles: { twitter: ["darioamodei"] } }`
**When** signal title is `"Dario Amodei discusses AI safety roadmap"` **without** `authorHandle` match
**Then** result includes **+10** people-name bonus
**And** name match uses `f1Score(signalTokens, tokenizeForScoring(person.name))` with threshold **≥ 30** (F1 fraction ≥ 0.3 on 0–100 integer scale)
**And** at most **one** +10 per signal across all people (best match wins; do not stack +10 per person)
**And** name bonus **stacks** with handle bonus when both apply (+30 max from people layer)

**Mandatory FR-5 fixture:**

| Input | Expected |
|-------|----------|
| Headline mentioning `"Dario Amodei"`, people configured, no handle | `personalRelevance` **≥10 points higher** than without people |
| Unrelated headline, people configured | No name bonus |

### 3. Stacking and preservation (FR-5 + 67-3)

**Given** signal matches both a goal phrase (67-3) and a watched person
**When** `scorePersonalRelevance` runs
**Then** `combined = Math.max(baseTier, goalTier)` unchanged
**And** people bonuses add **after** combined tier and epic bonus
**And** `personalRelevance = clamp(combined + epicBonus + peopleHandleBonus + peopleNameBonus, 0, 100)`
**And** existing `scorePersonalRelevance anti-drift` tests still pass (personal vs relevance independence; epic +15)
**And** existing `nexus-goals.yaml loader` tests still pass
**And** `computeRankScore`, `deriveDisposition`, `RANK_WEIGHT_*` constants **unchanged**
**And** `person.weight` (default 2.5) is **not** used in bonus calculation — fixed +20/+10 per addendum A2

### 4. JSDoc and exports

**Given** implementation touches `DigestSignal` typedef
**When** complete
**Then** `sourceMetadata` JSDoc includes optional `authorHandle?: string` (deferred from 68-2)
**And** export anti-drift constants for tests: `PEOPLE_HANDLE_MATCH_BONUS = 20`, `PEOPLE_NAME_MATCH_BONUS = 10`, `PEOPLE_NAME_F1_THRESHOLD = 30`
**And** export pure helper `scorePeopleBonuses(signal, nexusPeople)` (or equivalent) for unit testing without full context mock — mirror `weightedPersonalF1` export pattern

### 5. Tests and verify gate

**Given** implementation complete
**When** `npm test` and `bash scripts/verify.sh` run
**Then** all pass

**Extend `tests/morning-digest-score-signals.test.mjs` with describe block `personalRelevance v3 people bonus`:**

| Case | Assertion |
|------|-----------|
| Handle match Karpathy | ≥20 delta vs empty `nexusPeople` |
| Handle normalization `@Karpathy` | Same bonus as `karpathy` |
| Bluesky handle `karpathy.bsky.social` | +20 when configured |
| Name match Dario Amodei (no handle) | ≥10 delta |
| Name F1 below threshold | No name bonus |
| Both handle + name | +30 incremental (stack) |
| Stacks with goals | Goal boost + people boost both present |
| Empty `nexusPeople` | Zero people bonuses |
| Clamp at 100 | High base + bonuses capped at 100 |

**Replace 68-2 anti-drift test** `scorePersonalRelevance is unchanged when nexusPeople is populated` — invert to assert **withPeople > withoutPeople** for Karpathy handle fixture.

### 6. 68-8 validator alignment (recommended — same PR if trivial)

**Given** scoring uses 0–100 integer `personalRelevance` (task-prompt §9)
**When** `hasPeopleBoostEvidence` in `validate-epic-68-digest.mjs` evaluates Convex signals
**Then** threshold aligns with 0–100 scale: `PEOPLE_RELEVANCE_THRESHOLD` should be **20** (not `0.2`) so C6 passes when `peopleStoriesDone: true` and handle bonus fires
**And** update `tests/validate-epic-68-digest.test.mjs` fixtures to use 0–100 scores (e.g. `personalRelevance: 45` pass, `10` fail)
**And** optionally add `--people-done` CLI flag setting `peopleStoriesDone: true` (deferred-work.md backlog — include if ≤15 lines)

---

## Tasks / Subtasks

- [x] **Task 1 — People bonus helpers (AC: 1, 2, 4)** (FR-5)
  - [x] Add constants: `PEOPLE_HANDLE_MATCH_BONUS = 20`, `PEOPLE_NAME_MATCH_BONUS = 10`, `PEOPLE_NAME_F1_THRESHOLD = 30`
  - [x] Implement `collectNormalizedWatchHandles(nexusPeople)` — flat Set of all platform handles
  - [x] Implement `scorePeopleBonuses(signal, nexusPeople)` returning `{ handleBonus, nameBonus }` with at-most-once semantics
  - [x] Name match: iterate people, `f1Score(signalTokens, tokenizeForScoring(person.name)) >= PEOPLE_NAME_F1_THRESHOLD`

- [x] **Task 2 — Wire into scorePersonalRelevance (AC: 3)** (FR-5)
  - [x] Extend `scorePersonalRelevance` to add `peopleHandleBonus + peopleNameBonus` after epic bonus
  - [x] Guard: `ctx.nexusPeople ?? []` empty → skip people layer (fast path)
  - [x] Add `authorHandle?: string` to `DigestSignal.sourceMetadata` JSDoc

- [x] **Task 3 — Tests (AC: 5)**
  - [x] Add `personalRelevance v3 people bonus` describe block (matrix above)
  - [x] Replace/invert 68-2 anti-drift test at ~L1341
  - [x] Confirm goals loader + anti-drift + orchestrator tests green

- [x] **Task 4 — Validator threshold fix (AC: 6)** (recommended)
  - [x] Fix `PEOPLE_RELEVANCE_THRESHOLD` to `20` in `validate-epic-68-digest.mjs`
  - [x] Update validator unit tests to 0–100 scale
  - [x] Optional: `--people-done` CLI flag

- [x] **Task 5 — Verify gate**
  - [x] `npm test`
  - [x] `bash scripts/verify.sh`

---

## Dev Notes

### Architecture compliance

| Rule | Value |
|------|-------|
| Handle bonus | +20 fixed (addendum A2) |
| Name bonus | +10 fixed when name F1 ≥ 0.3 |
| Bonus stacking | Handle + name stack (+30 max); stack with 67-3 goals + epic +15 |
| `person.weight` | Stored on `NexusPerson` — **not consumed** in v3 (reserved for future) |
| Score scale | 0–100 integers throughout scoring pipeline |
| `rankScore` | Unchanged — bonus flows via `RANK_WEIGHT_PERSONAL * personalRelevance` |
| Convex schema | **No change** |
| File ownership | `nexus-people.yaml` operator config — not WriteGate |

**Do NOT change:** adapters, dedup engine, `normalizeEngagement`, `loadNexusPeople` parser, cns-dashboard, task-prompt (unless optional one-line scoring note).

### Implementation sketch (preserve 67-3 structure)

```javascript
export function scorePersonalRelevance(signal, ctx) {
  const signalTokens = tokenizeSignalText(signal.title, signal.summary);
  const baseTier = weightedPersonalF1(signalTokens, ctx.personalTokens.map((t) => ({ token: t, weight: 1 })));
  const goalTier = weightedPersonalF1(signalTokens, ctx.goalWeightedTokens ?? []);
  const combined = Math.max(baseTier, goalTier);
  const epicBonus = ctx.epicNumericTokens.some((t) => signalTokens.includes(t)) ? 15 : 0;
  const { handleBonus, nameBonus } = scorePeopleBonuses(signal, ctx.nexusPeople ?? []);
  return clamp(combined + epicBonus + handleBonus + nameBonus, 0, 100);
}
```

**Handle match logic:**

```javascript
const rawHandle = signal.sourceMetadata?.authorHandle;
if (typeof rawHandle === 'string' && rawHandle.trim()) {
  const normalized = normalizePeopleHandle(rawHandle);
  if (watchHandles.has(normalized)) handleBonus = PEOPLE_HANDLE_MATCH_BONUS;
}
```

**Name match logic:** use existing `f1Score` + `tokenizeForScoring` from `notebook-scorer.mjs` (already imported). Tokenize `person.name` the same way as goal phrases.

### Current file state — what to preserve

| Function | Preserve |
|----------|----------|
| `loadScoringContext` | No changes — `nexusPeople` already wired (68-2) |
| `loadNexusPeople` / `parseNexusPeopleYaml` | No changes |
| `weightedPersonalF1` / `f1Score` | Reuse for name match — do not duplicate F1 math |
| `normalizePeopleHandle` | Reuse for handle compare (exported 68-2) |
| `scoreDigestSignals` | Orchestrator unchanged — higher `personalRelevance` propagates automatically |
| CLI | Always exit 0 via `scoreDigestSignalsSafe` |

### Social adapter contract (already satisfied — do not edit)

- `fetch-bluesky-signals.mjs` → `posts[].authorHandle`
- `fetch-x-signals.mjs` → `posts[].authorHandle`
- `build-digest-push-payload.mjs` / task-prompt §9 → `sourceMetadata.authorHandle`

### 68-8 downstream impact

When 68-3 ships:

1. Update sprint-status: `68-3` → `done`
2. Re-run live validation with `peopleStoriesDone: true` (or `--people-done` if added)
3. C6 should **pass** when operator has `~/.hermes/nexus-people.yaml` and digest includes social signals from watched handles
4. `hasPeopleBoostEvidence` currently uses `PEOPLE_RELEVANCE_THRESHOLD = 0.2` against 0–100 scores — **fix in Task 4** or C6 will false-fail

### Test patterns (mirror 67-3)

```javascript
const ctxWithPeople = {
  ...baseCtx({ personalTokens: [], goalWeightedTokens: [], epicNumericTokens: [] }),
  nexusPeople: [
    { name: 'Andrej Karpathy', handles: { twitter: ['karpathy'], bluesky: ['karpathy.bsky.social'] }, tags: [], weight: 2.5 },
  ],
};
const signal = {
  title: 'New training run results',
  sourceType: 'bluesky',
  sourceMetadata: { authorHandle: 'karpathy.bsky.social' },
};
assert.ok(scorePersonalRelevance(signal, ctxWithPeople) - scorePersonalRelevance(signal, { ...ctxWithPeople, nexusPeople: [] }) >= 20);
```

Use `parseNexusPeopleYaml` / example file for integration-style fixtures where helpful.

### Deferred work reference

From `deferred-work.md` (68-2 review):

- `authorHandle` JSDoc — **68-3 scope** (Task 2)
- `--people-done` CLI — optional Task 4
- Hyphenated platform names in parser — out of scope (line-parser limitation)

### Git intelligence (recent patterns)

| Commit | Relevance |
|--------|-----------|
| `a3ca8c0` | 68-2 — `nexusPeople` on context, `normalizePeopleHandle`, loader tests |
| `739c16a` (67-3) | `weightedPersonalF1` dual-tier pattern — stack people bonuses similarly |
| `316e36c` / `02d0d4f` | Adapters emit `authorHandle` — consumer only in this story |

### File touch list

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **UPDATE** — people bonus helpers + `scorePersonalRelevance` |
| `tests/morning-digest-score-signals.test.mjs` | **UPDATE** — v3 bonus tests; invert 68-2 anti-drift test |
| `scripts/validate-epic-68-digest.mjs` | **UPDATE** (recommended) — threshold 0–100 alignment |
| `tests/validate-epic-68-digest.test.mjs` | **UPDATE** (recommended) — threshold fixtures |

**No changes:** `scripts/nexus-people.yaml.example`, adapters, cns-dashboard, vault, `task-prompt.md` (optional).

### Testing standards

- `bash scripts/verify.sh` mandatory (CNS npm tests + sibling cns-dashboard when `../cns-dashboard` exists)
- Context7 **not required** — no new libraries
- ADR-E67-001: no Python subprocess

### Project context reference

- Nexus intelligence principle: every signal scored for personal relevance
- WriteGate: `nexus-people.yaml` is operator Hermes config
- Mutation audit (5.2): **not applicable** — no vault mutations

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.2 FR-5, §3 UJ-2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A2 — +20/+10 bonus rules]
- [Source: `_bmad-output/implementation-artifacts/68-2-people-watchlist-loader.md` — loader complete; 68-3 preview section]
- [Source: `_bmad-output/implementation-artifacts/67-3-personal-relevance-v2-nexus-goals.md` — stacking pattern with goals]
- [Source: `_bmad-output/implementation-artifacts/68-8-live-digest-validation.md` — C6 people-boost waiver]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — `scorePersonalRelevance`, `normalizePeopleHandle`, `f1Score`]
- [Source: `scripts/validate-epic-68-digest.mjs` — `hasPeopleBoostEvidence`, `PEOPLE_RELEVANCE_THRESHOLD`]
- [Source: `project-context.md` — verify gate, Nexus intelligence principle]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 68-2/68-8 deferrals]

---

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor Agent)

### Debug Log References

- Stacking test initially used high goal-overlap title that clamped at 100 before people bonus was visible; fixed with `Omnipotent weekly update` fixture (goals ~57 + people +20 = 77).
- `verify.sh` Hermes skill parity gate required `bash scripts/install-hermes-skill-morning-digest.sh` after scoring changes.

### Completion Notes List

- Implemented FR-5 personalRelevance v3: `+20` handle match, `+10` name match (F1 ≥ 30), stack with 67-3 goals and epic +15, clamp 0–100.
- Exported `PEOPLE_HANDLE_MATCH_BONUS`, `PEOPLE_NAME_MATCH_BONUS`, `PEOPLE_NAME_F1_THRESHOLD`, `collectNormalizedWatchHandles`, `scorePeopleBonuses`.
- Added 10-case `personalRelevance v3 people bonus` test suite; inverted 68-2 anti-drift test to assert handle bonus.
- Fixed `PEOPLE_RELEVANCE_THRESHOLD` from `0.2` → `20` for 0–100 scale; added `--people-done` CLI flag.
- `npm test` (916 pass) and `bash scripts/verify.sh` pass.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/validate-epic-68-digest.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `tests/validate-epic-68-digest.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-11 — Story 68-3: personalRelevance v3 people watchlist bonuses (+20 handle, +10 name), validator threshold alignment, tests.

### Review Findings

- [x] [Review][Patch] C6 false-fail at exact threshold — `hasPeopleBoostEvidence` uses `personalRelevance > PEOPLE_RELEVANCE_THRESHOLD` (strict `>`). Handle-only match with zero base personal tokens scores exactly **20** (`scorePersonalRelevance` verified), so live C6 fails when `peopleStoriesDone: true`. Change to `>=` and add boundary test (`personalRelevance: 20` pass, `19` fail). [`scripts/validate-epic-68-digest.mjs:149`]

- [x] [Review][Defer] `collectNormalizedWatchHandles` rebuilt per signal in `scorePeopleBonuses` — pre-existing scale concern; 30-person cap makes impact negligible. [`score-digest-signals.mjs:1212`] — deferred, pre-existing perf pattern
