---
story_id: 67-3
epic: 67
title: personal-relevance-v2-nexus-goals
status: done
baseline_commit: d0238ab1663ced1b8ed8644289bd9224b26340d6
baseline_date: 2026-06-10
operator_brief: 2026-06-09
predecessors: 64-2, 64-5, 64-8
parallel: 67-1, 67-4
blocks: none
repo: Omnipotent.md
fr_ids: FR-6, FR-7
adr: ADR-E67-004
---

# Story 67.3: personalRelevance v2 — nexus-goals.yaml

Status: done

> **Epic 67 parallel track:** No dependency on 67-1 (live digest validation) or 67-4 (chip → inspector). Does **not** block 67-5. Scoring remains **pre-push** in morning-digest — **zero Convex / cns-dashboard changes** (ADR-E67-004).

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator maintaining quarterly focus areas**,
I want **`score-digest-signals.mjs` to load focus phrases from `~/.hermes/nexus-goals.yaml` and apply higher-weight token matching in `scorePersonalRelevance`**,
so that **digest signals mentioning my current goals rank higher on `personalRelevance` than generic sprint tokens alone, without redesigning the Epic 64 scoring engine or touching Convex schema**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 67 — Signal Quality + Source Expansion |
| **Repo** | **Omnipotent.md only** — no cns-dashboard, no Convex, no vault WriteGate |
| **Predecessors** | **64-2** (five dimensions + `scorePersonalRelevance` v1); **64-5** (orchestrator + rankScore); **64-8** (scoring stdout threading) |
| **Parallel** | **67-1** (live digest validation — operator artifact); **67-4** (Signal Seeds chip → inspector) |
| **Normative spec** | `prd-epic-67-2026-06-09` §4.3 (FR-6, FR-7); addendum A2; `architecture-epic-67-signal-quality-source-expansion.md` §5, ADR-E67-004 |
| **FR IDs** | FR-6 (goals file loader), FR-7 (weighted personalRelevance) |
| **Out of scope** | ProductHunt adapter (67-5); chip UX (67-4); Reddit OAuth (67-2); Compare smoke (67-6); `rankScore` weight changes; `deriveDisposition` threshold changes; new npm YAML dependencies; vault-managed goals file; Hermes skill/task-prompt edits unless example-file path docs warrant a one-line mention in task-prompt env table |

### Problem (current state)

`loadScoringContext()` builds `personalTokens` from sprint-status, `MORNING_DIGEST_PROJECT_ENTITIES`, watchlist `personal:` keywords, and keyword-candidate JSON — all at **implicit weight 1.0**. There is no operator-authored focus file. `scorePersonalRelevance()` computes unweighted F1:

```537:543:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
export function scorePersonalRelevance(signal, ctx) {
  const signalTokens = tokenizeSignalText(signal.title, signal.summary);
  const base = f1Score(signalTokens, ctx.personalTokens);
  const epicBonus = ctx.epicNumericTokens.some((token) => signalTokens.includes(token)) ? 15 : 0;
  return clamp(base + epicBonus, 0, 100);
}
```

Story **67-1** noted that `personalRelevance` could read zero when env/sprint tokens were misconfigured — v2 **adds** goal phrases on top of v1; it does not remove existing token sources.

### Operator brief (binding)

1. **Omnipotent.md only** — extend existing scoring module + tests; ship `scripts/nexus-goals.yaml.example`.
2. **Operator copies example to `~/.hermes/nexus-goals.yaml`** — not committed to repo; not vault WriteGate.
3. **Reuse line-safe YAML subset parser pattern** — same style as `parseWatchlistYaml` / `parseDevelopmentStatus`; do **not** add `yaml` npm package.
4. **Missing/malformed goals file must never throw** — empty goal set; stderr diagnostic once per run.
5. `bash scripts/verify.sh` green before marking done.

---

## Acceptance Criteria

### 1. Goals file loader (FR-6)

**Given** `resolveOperatorHome(env)` resolves operator home (same as watchlist path)
**When** `loadScoringContext(env)` runs
**Then** it attempts to read `join(operatorHome, '.hermes', 'nexus-goals.yaml')`
**And** exports `parseNexusGoalsYaml(yaml)` and `loadNexusGoals(operatorHome)` (or equivalent testable surface) for unit tests
**And** valid file with `version: 1` and `goals[]` entries yields `goalWeightedTokens: Array<{ token: string, weight: number }>` on `ScoringContext`
**And** each `goals[].phrase` is tokenized via `tokenizeForScoring()`; every token from a phrase inherits that phrase's `weight` (default **2.0** when omitted)
**And** at most **20** goal phrases are loaded (`NEXUS_GOALS_MAX_PHRASES = 20`); phrase 21+ ignored
**And** unknown `version` values log stderr warning once and yield empty goals (no throw)
**And** missing file → empty `goalWeightedTokens`; no throw
**And** malformed YAML → empty `goalWeightedTokens`; stderr diagnostic containing `score-digest-signals:` prefix; no throw
**And** `scripts/nexus-goals.yaml.example` exists in repo root `scripts/` with 5–10 sample phrases matching addendum A2 schema

**Normative schema (ADR-E67-004):**

```yaml
version: 1
goals:
  - phrase: "Nexus intelligence cockpit"
    weight: 2.0   # optional; default 2.0
  - phrase: "morning digest signal quality"
  - phrase: "Convex real-time dashboard"
    weight: 1.5   # per-phrase override honored
```

### 2. Weighted personalRelevance scoring (FR-7)

**Given** `ScoringContext` with both `personalTokens` (weight **1.0** tier) and `goalWeightedTokens` (weight **≥1.5** tier)
**When** `scorePersonalRelevance(signal, ctx)` runs
**Then** it implements `weightedPersonalF1(signalTokens, weightedRefTokens)` per ADR-E67-004:

- For each reference token `{ token, weight }` present in `signalTokens`, intersection contribution uses `weight`
- Precision denominator: `signalTokens.length` (or unique signal token count — match existing F1 semantics)
- Recall denominator: sum of weights for matched reference tokens
- Combined F1 scaled to 0–100 integer like `f1Score`; clamped

**And** `baseTier = weightedPersonalF1(signalTokens, personalTokens.map(t => ({ token: t, weight: 1 })))`
**And** `goalTier = weightedPersonalF1(signalTokens, ctx.goalWeightedTokens)`
**And** `combined = Math.max(baseTier, goalTier)` — goal tier can dominate when matched
**And** `epicBonus = 15` when epic numeric token in signal (unchanged from v1)
**And** `personalRelevance = clamp(combined + epicBonus, 0, 100)`
**And** `MORNING_DIGEST_PROJECT_ENTITIES`, sprint tokens, watchlist personal keywords remain in `personalTokens` at weight **1.0** — unchanged tier
**And** goal phrase tokens are **excluded from duplicate weighting** in `personalTokens` (goals scored only via `goalWeightedTokens`)

**Mandatory FR-7 fixture delta (architecture §5.3):**

| Input | Expected |
|-------|----------|
| Signal title: `"Nexus intelligence cockpit ships scoring panel"` | With goal phrase `"Nexus intelligence cockpit"` at weight 2.0 |
| Same signal, empty goals | `personalRelevance` at least **15 points lower** than with goals file |

**And** existing anti-drift tests in `scorePersonalRelevance anti-drift` describe block continue to pass (personal vs relevance independence; epic bonus +15)

### 3. Degraded mode and CLI safety

**Given** goals file missing or invalid
**When** `runScoreDigestSignalsCli` or `scoreDigestSignalsSafe` runs a full digest scoring pass
**Then** scoring completes with v1-equivalent personalRelevance (no goals boost)
**And** process exits **0** (unchanged contract)
**And** stderr emits at most one goals-related diagnostic per run (avoid log spam)

### 4. Tests and verify gate

**Given** implementation complete
**When** `npm test` and `bash scripts/verify.sh` run
**Then** all pass

**Extend `tests/morning-digest-score-signals.test.mjs` with:**

| Case | Assertion |
|------|-----------|
| Valid goals file via temp `~/.hermes/nexus-goals.yaml` | Goal phrase in title → higher `personalRelevance` than ctx without goals |
| Missing file | `goalWeightedTokens` empty; no throw |
| Malformed YAML | Empty goals; stderr captured |
| Per-phrase weight 1.5 | Lower score than default 2.0 for same phrase overlap (when measurable) |
| 21st phrase | Only first 20 loaded |
| FR-7 fixture delta | ≥15 point delta with vs without goals |
| `loadScoringContext` integration | Temp operator home loads goals into ctx |

---

## Tasks / Subtasks

- [x] **Task 1 — Parser + loader (AC: 1)** (FR-6)
  - [x] Add constants: `NEXUS_GOALS_MAX_PHRASES = 20`, `DEFAULT_GOAL_WEIGHT = 2.0`
  - [x] Implement `parseNexusGoalsYaml(yaml)` — line-safe subset parser for `version`, `goals[].phrase`, `goals[].weight`
  - [x] Implement `loadNexusGoals(operatorHome)` — read file, validate version, truncate, return `{ goalWeightedTokens }`
  - [x] Extend `ScoringContext` typedef with `goalWeightedTokens: Array<{ token: string, weight: number }>`
  - [x] Wire into `loadScoringContext()` after `resolveOperatorHome`
  - [x] Create `scripts/nexus-goals.yaml.example`

- [x] **Task 2 — Weighted scorer (AC: 2)** (FR-7)
  - [x] Export `weightedPersonalF1(signalTokens, weightedRefTokens)`
  - [x] Refactor `scorePersonalRelevance` to dual-tier `Math.max(baseTier, goalTier)` + epicBonus
  - [x] Ensure goal tokens not duplicated in flat `personalTokens` array

- [x] **Task 3 — Tests (AC: 4)**
  - [x] Add describe block `nexus-goals.yaml loader and weighted personalRelevance`
  - [x] Cover all architecture §5.2 test matrix rows + FR-7 fixture delta
  - [x] Confirm existing `scorePersonalRelevance anti-drift` tests still green

- [x] **Task 4 — Verify gate**
  - [x] `npm test`
  - [x] `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] Add parser edge-case unit tests (empty file, missing `goals:` key, `weight: "2.0"` string) [tests/morning-digest-score-signals.test.mjs] — runtime probes confirm no-throw + correct empty/diagnostic behavior; tests not yet locked in for operator focus matrix item #1
- [x] [Review][Patch] Add sprint-token overlap regression test for double-weight guard [tests/morning-digest-score-signals.test.mjs] — watchlist overlap covered; no test asserts sprint/entity token shared with goal phrase is excluded from `personalTokens` and not double-scored

---

## Dev Notes

### Architecture compliance (ADR-E67-004)

| Rule | Value |
|------|-------|
| Goals path | `join(resolveOperatorHome(), '.hermes', 'nexus-goals.yaml')` |
| Max phrases | 20 |
| Default goal weight | 2.0 |
| Sprint / entity / watchlist / keyword-candidate | 1.0 (unchanged) |
| Convex schema | **No change** |
| Scoring location | Pre-push in morning-digest CLI only |

**Do NOT change:** `computeRankScore` weights, `deriveDisposition` thresholds, `normalizeEngagement`, `rankScore` formula, or any cns-dashboard file.

### Current file state — what to preserve

**`score-digest-signals.mjs` today:**

| Function | Behavior to preserve |
|----------|---------------------|
| `loadScoringContext` | Watchlist, sprint, entities, keyword candidates, novelty history — all unchanged except adding goals load |
| `scorePersonalRelevance` | Epic bonus +15 unchanged; v1 token sources remain at 1× |
| `scoreDigestSignals` | Orchestrator unchanged except higher personalRelevance values when goals match |
| CLI | Always exit 0; passthrough on catastrophic failure via `scoreDigestSignalsSafe` |

**Existing parser patterns to mirror** (no new dependencies):

```203:255:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
export function parseWatchlistYaml(yaml) {
  // line-safe: section headers, list items, quoted values
}
```

Goals parser should handle:
- `version: 1`
- `goals:` section
- `- phrase: "..."` or `- phrase: ...`
- optional `weight: 1.5` on same list item or indented under item

### weightedPersonalF1 algorithm sketch

Architecture normative intent — implement exactly in exported function for testability:

```javascript
export function weightedPersonalF1(signalTokens, weightedRefTokens) {
  if (signalTokens.length === 0 || weightedRefTokens.length === 0) return 0;
  const signalSet = new Set(signalTokens);
  let weightedIntersection = 0;
  let totalRefWeight = 0;
  for (const { token, weight } of weightedRefTokens) {
    const w = Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_GOAL_WEIGHT;
    totalRefWeight += w;
    if (signalSet.has(token)) weightedIntersection += w;
  }
  if (weightedIntersection === 0) return 0;
  const precision = weightedIntersection / signalTokens.length;
  const recall = weightedIntersection / totalRefWeight;
  const f1val = (2 * precision * recall) / (precision + recall);
  return Math.round(clamp(f1val * 100, 0, 100));
}
```

Dev agent: verify against FR-7 fixture; adjust only if tests prove architecture fixture requires different denominator semantics — document any deviation in Completion Notes.

### Tokenization reuse

Import from existing module — **never duplicate stopwords:**

```8:8:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
import { f1, tokenizeForScoring } from '../../../session-close/lib/notebook-scorer.mjs';
```

Phrase `"Nexus intelligence cockpit"` → tokens `['nexus', 'intelligence', 'cockpit']` each at phrase weight.

### Operator setup (post-merge — not dev deliverable)

Operator copies example:

```bash
cp scripts/nexus-goals.yaml.example ~/.hermes/nexus-goals.yaml
# edit phrases; optional weight overrides
```

Optional env already documented in task-prompt §9 scoring table: `MORNING_DIGEST_PROJECT_ENTITIES` remains complementary at 1×.

### Previous story intelligence (67-1)

- **67-1 is operator-validation only** — no code patterns to reuse.
- **67-1 AC-3** checks `personalRelevance > 0` via sprint/entity tokens; v2 adds goals as additional boost path.
- If 67-1 artifact noted all-zero personalRelevance, root cause was env/symlink — v2 does not fix misconfigured `CNS_REPO_ROOT` or missing sprint path; goals file is additive.
- **67-1 explicitly out-of-scoped nexus-goals** — this story delivers that deferred capability.

### Git intelligence (recent patterns)

- Epic 64–65 scoring work landed in `score-digest-signals.mjs` with exhaustive `tests/morning-digest-score-signals.test.mjs` — extend, don't fork.
- Commit style: `feat(epic-67): 67-3 nexus-goals weighted personalRelevance` (one logical change).
- No cns-dashboard sibling changes expected — verify.sh should pass Omnipotent.md tests only for this story.

### Security / WriteGate

- `nexus-goals.yaml` lives in `~/.hermes/` — operator-controlled Hermes config.
- **No WriteGate, no vault_log_action, no security.md changes.**

### Project structure

| Action | Path |
|--------|------|
| **UPDATE** | `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` |
| **UPDATE** | `tests/morning-digest-score-signals.test.mjs` |
| **NEW** | `scripts/nexus-goals.yaml.example` |

### Testing standards

- Use `mkdtemp` + `writeFile` for temp operator home (existing `loadScoringContext` test pattern at line 729+).
- Export pure functions for unit tests (`parseNexusGoalsYaml`, `weightedPersonalF1`, `loadNexusGoals`).
- Capture stderr in tests when asserting malformed-file diagnostics (pattern in `runScoreDigestSignalsCli` tests).
- Do not add live network or Convex tests.

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/prd.md` §4.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/addendum.md` A2]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md` §5, ADR-E67-004]
- [Source: `_bmad-output/implementation-artifacts/64-2-scoring-engine-five-dimensions.md` §4 personalRelevance v1]
- [Source: `_bmad-output/implementation-artifacts/67-1-live-digest-validation.md` § personalRelevance pre-67-3]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`]
- [Source: `tests/morning-digest-score-signals.test.mjs`]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Implemented ADR-E67-004 line-safe `parseNexusGoalsYaml` / `loadNexusGoals` with degraded-mode stderr (once per `loadScoringContext` call).
- Dual-tier `scorePersonalRelevance` via exported `weightedPersonalF1`; goal tokens excluded from flat `personalTokens`.
- Hermes skill parity restored via `bash scripts/install-hermes-skill-morning-digest.sh` before verify gate.

### Completion Notes List

- ✅ FR-6: `~/.hermes/nexus-goals.yaml` loader with version gate, 20-phrase cap, default weight 2.0, malformed/missing safe paths.
- ✅ FR-7: Weighted personal F1 with `Math.max(baseTier, goalTier)`; FR-7 fixture delta ≥15 points verified in tests.
- ✅ `scripts/nexus-goals.yaml.example` shipped (8 sample phrases).
- ✅ All `scorePersonalRelevance anti-drift` tests remain green.
- ✅ `npm test` and `bash scripts/verify.sh` pass.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/nexus-goals.yaml.example`
- `tests/morning-digest-score-signals.test.mjs`

### Change Log

- 2026-06-10: Story 67-3 — nexus-goals.yaml loader + weighted personalRelevance v2 (ADR-E67-004).

---

## Story completion status

- **Status:** done
- **Completion note:** Implementation complete; verify gate green; code review passed with test-coverage patches applied.
