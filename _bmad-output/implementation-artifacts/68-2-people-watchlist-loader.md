---
story_id: 68-2
epic: 68
title: people-watchlist-loader
status: done
baseline_commit: c19eef7
baseline_date: 2026-06-11
operator_brief: 2026-06-11
predecessors: 64-2, 64-5, 67-3
parallel: 68-5
blocks: 68-3
repo: Omnipotent.md
fr_ids: FR-4
priority: P2
---

# Story 68.2: People Watchlist Loader — `nexus-people.yaml`

Status: done

> **Epic 68 P2 — loader-only story.** Implements FR-4 (`parseNexusPeopleYaml`, `loadNexusPeople`, example file, `loadScoringContext` wire). **Does not** apply `personalRelevance` people bonus — that is **68-3** (FR-5). Mirrors **67-3** nexus-goals loader pattern; zero Convex / cns-dashboard changes.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator tracking founders and researchers on Bluesky and X**,
I want **`score-digest-signals.mjs` to load a people watchlist from `~/.hermes/nexus-people.yaml` with safe degraded-mode parsing**,
so that **68-3 can boost `personalRelevance` for signals authored by or mentioning watched people, I can maintain the list quarterly without code changes, and missing or malformed files never abort the morning digest**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup |
| **Priority** | **P2** — deepens UJ-2 personal relevance; parallel to Bluesky adapter work; no blocker for 68-6/68-7/68-8 |
| **Repo** | **Omnipotent.md only** — scoring module extension + example file + tests |
| **Predecessors** | **64-2** (five dimensions + `scorePersonalRelevance`); **64-5** (orchestrator); **67-3** (nexus-goals loader pattern — **primary implementation template**) |
| **Parallel** | **68-5** (Bluesky adapter — already **done**; emits `authorHandle` on mapped signals for future 68-3 bonus) |
| **Blocks** | **68-3** (personalRelevance v3 people bonus — requires loaded people on `ScoringContext`) |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.2 (FR-4); `addendum.md` §A2; decision log row 7 |
| **Out of scope** | `scorePersonalRelevance` bonus logic (68-3); `rankScore` weight changes; Convex schema; cns-dashboard; vault WriteGate; Hermes task-prompt edits (optional one-line env table mention only); `validate-epic-68-digest.mjs` `--people-done` flag (deferred-work.md); Operator Guide section (68-3 or follow-up) |

### Operator rationale (binding)

Epic 68 sequencing: `68-1` → `68-4` → `68-5` ∥ **`68-2`** → `68-3` → … People tracking complements **67-3** `nexus-goals.yaml` (goal phrases) with **named individuals** and platform handles. Social adapters (**68-5** Bluesky, **68-6** X) already map `authorHandle` into `sourceMetadata` — loader must be ready before 68-3 applies handle-match bonus.

### Problem (current state)

| Gap | Today |
|-----|--------|
| No people file | `loadScoringContext()` loads `nexus-goals.yaml`, watchlist, sprint tokens — **no** `nexus-people.yaml` |
| No parser | No `parseNexusPeopleYaml` / `loadNexusPeople` exports |
| No example | No `scripts/nexus-people.yaml.example` for operator copy |
| 68-8 gate | `validate-epic-68-digest.mjs` C6 people-boost **WAIVED** until 68-2 **and** 68-3 are `done` |

`scorePersonalRelevance()` today (67-3 v2):

```824:834:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
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

**68-2 does not modify this function.** It only adds people data to `ScoringContext` for 68-3.

### Target data flow

```text
resolveOperatorHome(env)
  → loadNexusPeople(operatorHome)     ← NEW (68-2)
  → ScoringContext.nexusPeople[]      ← NEW field
  → scorePersonalRelevance (unchanged) ← 68-3 adds people bonus here
```

---

## Acceptance Criteria

### 1. People file loader (FR-4)

**Given** `resolveOperatorHome(env)` resolves operator home (same path family as `nexus-goals.yaml`)
**When** `loadScoringContext(env)` runs
**Then** it attempts to read `join(operatorHome, '.hermes', 'nexus-people.yaml')`
**And** exports `parseNexusPeopleYaml(yaml)` and `loadNexusPeople(operatorHome)` for unit tests
**And** valid file with `version: 1` and `people[]` entries yields `nexusPeople` on `ScoringContext`
**And** each person entry includes:
- `name` (string, required)
- `handles` (object: platform key → handle string or array of strings)
- `tags` (optional string array)
- `weight` (optional number; default **2.5** when omitted)

**And** handle normalization on load:
- Case-insensitive storage (lowercase)
- Strip leading `@` from handles
- At most **3** handles per platform per person; excess ignored

**And** at most **30** people loaded (`NEXUS_PEOPLE_MAX_PEOPLE = 30`); person 31+ ignored
**And** when truncation occurs, stderr emits **one** diagnostic per run containing `score-digest-signals:` prefix and `nexus-people.yaml` (e.g. `truncated to 30 people`)
**And** unknown `version` values log stderr warning once and yield empty people (no throw)
**And** missing file → empty `nexusPeople`; no throw; no diagnostic required
**And** malformed YAML → empty `nexusPeople`; stderr diagnostic with `score-digest-signals:` prefix; no throw
**And** `scripts/nexus-people.yaml.example` exists with **8–12** sample AI/tech figures matching addendum A2 schema

**Normative schema (addendum A2):**

```yaml
version: 1
people:
  - name: "Andrej Karpathy"
    handles:
      twitter: "karpathy"
      bluesky: "karpathy.bsky.social"
    tags: ["llm", "research"]
    weight: 2.5   # optional; default 2.5
  - name: "Dario Amodei"
    handles:
      twitter: "darioamodei"
    tags: ["ai-safety", "anthropic"]
```

### 2. ScoringContext wire (FR-4 integration — no bonus yet)

**Given** `loadScoringContext` after this story
**When** a valid `nexus-people.yaml` exists in operator home
**Then** returned `ScoringContext` includes `nexusPeople: NexusPerson[]` (non-optional; empty array when file absent)
**And** `scorePersonalRelevance` behavior is **identical** to pre-68-2 for the same inputs (no people bonus — verified by existing anti-drift tests)
**And** `runScoreDigestSignalsCli` / `scoreDigestSignalsSafe` still exit **0** when people file missing or malformed

### 3. Parser implementation constraints

**Given** implementation in `score-digest-signals.mjs`
**When** parsing YAML
**Then** use **line-safe subset parser** — same style as `parseNexusGoalsYaml` / `parseWatchlistYaml`
**And** do **not** add `yaml` npm package
**And** export anti-drift constants: `NEXUS_PEOPLE_MAX_PEOPLE`, `NEXUS_PEOPLE_MAX_HANDLES_PER_PLATFORM`, `DEFAULT_PERSON_WEIGHT`

**Suggested `NexusPerson` shape (JSDoc typedef):**

```javascript
/**
 * @typedef {{
 *   name: string,
 *   handles: Record<string, string[]>,  // platform → normalized handles (max 3 each)
 *   tags: string[],
 *   weight: number,
 * }} NexusPerson
 */
```

**Optional helper for 68-3 (export if trivial):** `normalizePeopleHandle(raw)` — lowercase, strip `@`, trim.

### 4. Tests and verify gate

**Given** implementation complete
**When** `npm test` and `bash scripts/verify.sh` run
**Then** all pass

**Extend `tests/morning-digest-score-signals.test.mjs` with describe block `nexus-people.yaml loader`:**

| Case | Assertion |
|------|-----------|
| `parseNexusPeopleYaml` valid fixture | `version: 1`, 2+ people, handles/tags/weights parsed |
| Handle normalization | `@Karpathy` → `karpathy`; `Twitter: KARPATHY` case fold |
| Max 3 handles per platform | 4th handle on same platform ignored |
| 31st person | Only first 30 loaded; truncation path covered |
| Missing file | `nexusPeople: []`; no throw |
| Malformed YAML | Empty people; diagnostic captured |
| Unsupported version | Empty people; version warning diagnostic |
| Empty file / version-only | No throw; empty people |
| `loadScoringContext` integration | Temp operator home with valid file → `ctx.nexusPeople.length > 0` |
| **Regression** | Existing `nexus-goals.yaml loader` and `scorePersonalRelevance anti-drift` blocks still green |

**Explicit non-test for 68-2:** No assertion that `personalRelevance` increases for Karpathy handle — that is **68-3**.

---

## Tasks / Subtasks

- [x] **Task 1 — Constants + parser (AC: 1, 3)** (FR-4)
  - [x] Add `NEXUS_PEOPLE_MAX_PEOPLE = 30`, `NEXUS_PEOPLE_MAX_HANDLES_PER_PLATFORM = 3`, `DEFAULT_PERSON_WEIGHT = 2.5`
  - [x] Implement `parseNexusPeopleYaml(yaml)` — line-safe parser for `version`, `people[].name`, `people[].handles`, `people[].tags`, `people[].weight`
  - [x] Support `handles.twitter: "karpathy"` (scalar) and `handles.twitter: ["a", "b"]` (list) — normalize to `string[]`
  - [x] Implement `normalizePeopleHandle(raw)` (export)

- [x] **Task 2 — Loader + context wire (AC: 1, 2)** (FR-4)
  - [x] Implement `loadNexusPeople(operatorHome)` — read file, version gate, truncate, return `{ people, diagnostic? }`
  - [x] Extend `ScoringContext` typedef with `nexusPeople: NexusPerson[]`
  - [x] Wire into `loadScoringContext()` after `loadNexusGoals`; log `diagnostic` to stderr once (mirror goals pattern)
  - [x] Create `scripts/nexus-people.yaml.example` (8–12 figures: Karpathy, Amodei, Hassabis, Altman, LeCun, Ng, Hinton, Brockman, etc.)

- [x] **Task 3 — Tests (AC: 4)**
  - [x] Add `nexus-people.yaml loader` describe block
  - [x] Cover matrix above + parser edge cases (empty file, missing `people:` key, invalid weight string)
  - [x] Confirm goals loader + personalRelevance anti-drift tests unchanged

- [x] **Task 4 — Verify gate**
  - [x] `npm test`
  - [x] `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] Inline `tags: [...]` silently parsed as spurious `handles.tags` platform — corrupts operator example file [score-digest-signals.mjs:742-784] — fixed: `parseInlineTagArray` + `tagsInlineMatch` before platform scalar
- [x] [Review][Patch] No test exercises example-file tag syntax or `parseNexusPeopleYaml(example)` round-trip [tests/morning-digest-score-signals.test.mjs] — fixed: example round-trip + inline tags tests
- [x] [Review][Patch] Truncation diagnostic hardcodes literal `30` instead of `NEXUS_PEOPLE_MAX_PEOPLE` [score-digest-signals.mjs:842] — fixed
- [x] [Review][Patch] AC4 handle-normalization row missing parser integration test for uppercase platform keys [tests/morning-digest-score-signals.test.mjs] — fixed
- [x] [Review][Defer] Hyphenated platform names (e.g. `x-twitter`) not supported by `\w+` regex [score-digest-signals.mjs:772] — deferred, line-parser limitation; not in A2 schema
- [x] [Review][Defer] `authorHandle` not added to `DigestSignal.sourceMetadata` JSDoc — deferred to 68-3 per story dev notes

---

## Dev Notes

### Architecture compliance

| Rule | Value |
|------|-------|
| People path | `join(resolveOperatorHome(), '.hermes', 'nexus-people.yaml')` |
| Max people | 30 |
| Max handles per platform | 3 |
| Default person weight | 2.5 (stored on `NexusPerson`; consumed by 68-3) |
| File ownership | Operator `~/.hermes/` — **not** vault WriteGate |
| Convex schema | **No change** |
| Scoring bonus | **68-3 only** — +20 handle match, +10 name F1 ≥ 0.3 per addendum A2 |

**Do NOT change in 68-2:** `scorePersonalRelevance`, `computeRankScore`, `deriveDisposition`, `normalizeEngagement`, dedup engine, adapters, or any cns-dashboard file.

### Current file state — what to preserve

**`score-digest-signals.mjs` patterns to mirror (67-3):**

```518:557:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
export async function loadNexusGoals(operatorHome) {
  const goalsPath = join(operatorHome, '.hermes', 'nexus-goals.yaml');
  try {
    const raw = await readFile(goalsPath, 'utf8');
    const parsed = parseNexusGoalsYaml(raw);
    // ... version gate, malformed → empty, ENOENT → empty
  }
}
```

**`loadScoringContext` wire point (after goals load ~L719–724):**

```714:724:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
export async function loadScoringContext(env = process.env) {
  const operatorHome = await resolveOperatorHome(env);
  const nexusGoals = await loadNexusGoals(operatorHome);
  if (nexusGoals.diagnostic) {
    console.error(nexusGoals.diagnostic);
  }
  // INSERT loadNexusPeople here; add nexusPeople to return object
```

**Social adapters already emit `authorHandle` (68-3 consumer):**

- `fetch-bluesky-signals.mjs` → `posts[].authorHandle`
- `fetch-x-signals.mjs` → `posts[].authorHandle`
- `build-digest-push-payload.mjs` maps to `sourceMetadata.authorHandle`

Extend `DigestSignal` JSDoc `sourceMetadata` with optional `authorHandle?: string` when touching typedef (68-2 or 68-3).

### Parser edge cases (mirror 67-3 test matrix)

| Input | Expected |
|-------|----------|
| Empty file | `{ version: null, people: [], malformed: false }` |
| `version: 1` only | Empty people; not malformed |
| `weight: "2.5"` string | Malformed → empty people + diagnostic |
| Person without `name` | Skip entry or mark malformed (prefer skip + continue, like goals orphan keys) |
| Unknown platform keys in `handles` | Accept and preserve key (forward-compatible for future platforms) |
| Duplicate handles same person/platform | Dedupe after normalize |

### Downstream: Story 68-3 preview (do not implement here)

68-3 will use `ctx.nexusPeople` to:
1. Match `sourceMetadata.authorHandle` (normalized) → **+20** `personalRelevance`
2. Match `person.name` tokens in title/summary (F1 ≥ 0.3) → **+10**
3. Stack with goal-weighted F1 from 67-3; clamp 0–100

68-8 `hasPeopleBoostEvidence` checks `personalRelevance > 0.4` with `authorHandle` present — only meaningful after **68-3**.

### Deferred work reference

From `deferred-work.md`: `--people-done` CLI flag for `validate-epic-68-digest.mjs` C6 when 68-2/68-3 ship — **not** 68-2 scope; 68-3 or small follow-up.

### Git intelligence (recent Epic 68 patterns)

| Commit | Relevance |
|--------|-----------|
| `316e36c` | 68-5 Bluesky — `authorHandle` on stdout + §9 mapping |
| `02d0d4f` | 68-6 X — same `authorHandle` contract |
| `6c18ea9` | 68-1 — export testable pure functions from morning-digest modules |
| `739c16a` (67-3) | nexus-goals loader — **primary template** for parser/loader/tests |

### Operator setup (document in example file header)

```bash
cp scripts/nexus-people.yaml.example ~/.hermes/nexus-people.yaml
# Edit names/handles quarterly; max 30 people
```

### File touch list

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **UPDATE** — parser, loader, context wire, exports |
| `scripts/nexus-people.yaml.example` | **NEW** |
| `tests/morning-digest-score-signals.test.mjs` | **UPDATE** — loader test describe block |

**No changes:** `task-prompt.md`, adapters, `validate-epic-68-digest.mjs`, cns-dashboard, vault.

### Testing standards

- Follow `tests/morning-digest-score-signals.test.mjs` patterns: `mkdtemp`, write `~/.hermes/nexus-people.yaml` under temp operator home, `loadScoringContext({ HOME: operatorHome, ... })`
- Import new exports at top of test file alongside `parseNexusGoalsYaml`, `loadNexusGoals`
- `bash scripts/verify.sh` is mandatory gate (CNS npm tests + sibling cns-dashboard when present)

### Project context reference

- ADR-E67-001: `last30days` codebook only — no Python subprocess for people tracking
- WriteGate: `nexus-people.yaml` is operator Hermes config, not vault-managed
- Context7 not required — no new library; line-safe YAML subset only

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.2 FR-4, §3 UJ-2, §6.2 story map]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A2 — schema + limits]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/.decision-log.md` row 7]
- [Source: `_bmad-output/implementation-artifacts/67-3-personal-relevance-v2-nexus-goals.md` — loader pattern template]
- [Source: `_bmad-output/implementation-artifacts/68-5-bluesky-adapter-source-12.md` — `authorHandle` emission]
- [Source: `_bmad-output/implementation-artifacts/68-8-live-digest-validation.md` — C6 people-boost waiver until 68-2+68-3]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — `loadNexusGoals`, `loadScoringContext`]
- [Source: `project-context.md` — Nexus intelligence principle, verify gate]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Parser initially treated indented `handles:` / `tags:` as people-section exit (mirrored goals bug class); fixed by requiring unindented keys for section exit.
- `weight:` after `handles:` was mis-parsed as a platform handle until weight matching was ordered before platform scalar matching.

### Completion Notes List

- Implemented FR-4: `parseNexusPeopleYaml`, `loadNexusPeople`, `normalizePeopleHandle`, anti-drift constants, and `ScoringContext.nexusPeople` wire in `loadScoringContext`.
- Added `scripts/nexus-people.yaml.example` with 10 AI/tech figures.
- Added 13 tests in `nexus-people.yaml loader` describe block; confirmed `scorePersonalRelevance` unchanged (68-3 owns bonus).
- `npm test` and `bash scripts/verify.sh` pass; synced Hermes morning-digest skill install for parity gate.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — parser, loader, context wire, exports
- `scripts/nexus-people.yaml.example` — operator example file (NEW)
- `tests/morning-digest-score-signals.test.mjs` — loader test suite

### Change Log

- 2026-06-11: Story 68-2 — nexus-people.yaml loader (FR-4); ScoringContext.nexusPeople wire; no personalRelevance bonus (68-3).
- 2026-06-11: Code review — fixed inline `tags: [...]` parser bug, added example round-trip tests, diagnostic uses `NEXUS_PEOPLE_MAX_PEOPLE`.
