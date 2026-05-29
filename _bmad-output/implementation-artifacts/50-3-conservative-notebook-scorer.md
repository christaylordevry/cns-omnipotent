---
baseline_commit: 6a6478456395eeb58b06fbdcfb254f14b8450068
---

# Story 50.3: Conservative notebook scorer

Status: done

Epic: **50** (NotebookLM Full Integration)  
Tracked in sprint-status as: **`50-3-conservative-notebook-scorer`**

**Operator intent:** Add a **deterministic, offline** scoring function that maps a topic/keyword string to ranked NotebookLM notebooks from `notebook-registry.json`. This is the intelligence layer consumed by Story **50-4** (disambiguation when multiple high scores) and **50-5** (smart routing). No Hermes skill wiring, no session-close fan-out changes, no LLM, no network.

## Story

As an **operator**,  
I want **session-close automation to score a topic against the notebook registry using title and domain keyword overlap only**,  
so that **later stories can route queries to the right NotebookLM notebook without guessing or calling an LLM**.

## Acceptance Criteria

1. **Pure scorer module (AC: module)**  
   **Given** a non-empty registry array (same shape as Story 50-1 `NotebookRegistryEntry`)  
   **When** `scoreNotebooks(topic, registry)` is called from `scripts/session-close/lib/notebook-scorer.mjs`  
   **Then** the function is **pure** (no `fs`, no `fetch`, no `child_process`, no env reads)  
   **And** accepts `topic` as a string (keyword or short phrase)  
   **And** scores **every** registry row with valid `id` and `title` (skip malformed rows silently, same spirit as `sanitizeRegistryEntry`)  
   **And** uses only **`title`** and **`domain`** fields per entry for matching (ignore `watch`, `last_updated`)

2. **Scoring algorithm (AC: algorithm)**  
   **Given** token sets derived from the topic and each notebook  
   **When** computing per-entry `score` in `[0, 1]`  
   **Then** tokenize with a shared `tokenizeForScoring(text)`:
   - lowercase
   - split on non-alphanumeric runs
   - drop tokens shorter than 2 characters
   - no stop-word list in v1 (keep deterministic and simple)  
   **And** **title tokens** = `tokenizeForScoring(entry.title)`  
   **And** **domain tokens** = `tokenizeForScoring(entry.domain)` plus **domain keyword lexicon** tokens for that slug (see Dev Notes — must stay aligned with `infer-notebook-domain.mjs` rules)  
   **And** `titleScore = f1(queryTokens, titleTokens)`  
   **And** `domainScore = f1(queryTokens, domainTokens)`  
   **And** `f1(A, B) = (2 × |A ∩ B|) / (|A| + |B|)`; if either set is empty, that axis scores `0`  
   **And** `score = Math.max(titleScore, domainScore)` (**conservative**: one strong axis must carry the match; do not average weak signals)  
   **And** round `score` to **4 decimal places** before compare/sort (stable tests)

3. **Threshold and ranking (AC: threshold)**  
   **When** all entries are scored  
   **Then** keep only entries with `score >= 0.75`  
   **And** sort remaining matches by `score` descending, then `title` ascending (case-insensitive), then `id` ascending  
   **And** each match is `{ id, title, score }` (score number, not string)  
   **And** if **no** entry meets `>= 0.75`, return **`{ status: 'NO_ROUTE', matches: [] }`**  
   **And** if **one or more** qualify, return **`{ status: 'OK', matches: [...] }`**

4. **Edge inputs (AC: edges)**  
   **When** `topic` is empty or whitespace-only after trim  
   **Then** return `{ status: 'NO_ROUTE', matches: [] }` (do not score)  
   **When** `registry` is empty or all rows invalid  
   **Then** return `{ status: 'NO_ROUTE', matches: [] }`  
   **When** multiple entries tie at the same score  
   **Then** tie-break order is `title` then `id` (AC: threshold)

5. **Domain keyword lexicon (AC: domain-lexicon)**  
   **Then** domain keywords for each slug mirror Story 50-1 inference table (first-match domains), e.g.:
   - `cns-brain` → `cns`, `vault`, `pake`, `brain`
   - `ai-factory` → `ai`, `factory`, `blueprint`, `architecting`
   - `linkedin` → `linkedin`
   - `lead-gen` → `directory`, `monetization`, `lead`, `gen`
   - `learning` → `notebooklm`, `cursor`, `claude`, `code`, `tech`, `tina`, `huang`, `justin`, `sung`
   - `health` → `nutrition`, `muscle`, `fat`, `loss`
   - `general` → *(no extra keywords beyond slug token `general`)*  
   **And** implement via **one shared source of truth** with `infer-notebook-domain.mjs` (export a map or builder from `DOMAIN_RULES`; **do not** duplicate the table in a third file)

6. **Tests (AC: tests)**  
   **Then** `tests/notebook-scorer.test.mjs` uses `node:test` + `node:assert/strict`  
   **And** uses **fixtures only** (inline registry arrays or `tests/fixtures/notebook-registry-scorer.json`) — no live `nlm`, no network  
   **And** covers at minimum:
   - `tokenizeForScoring` / `f1` unit cases
   - strong title match → `OK` with score ≥ 0.75
   - domain-only match (e.g. topic `pake` → notebook with domain `cns-brain`, weak title) → `OK` when domain axis ≥ 0.75
   - ambiguous top scores (two notebooks ≥ 0.75) → ranked array length 2, descending score (feeds 50-4)
   - below-threshold query → `NO_ROUTE`
   - empty topic → `NO_ROUTE`
   - empty registry → `NO_ROUTE`  
   **And** `bash scripts/verify.sh` passes

7. **Scope boundaries (AC: non-goals)**  
   **Then** this story does **not**:
   - Call or change `readNotebookLmTargets()` / watch fan-out (50-2)
   - Run `sync-notebooks` or mutate `notebook-registry.json`
   - Add MCP tools, Discord prompts, or Hermes skill text (50-4 / 50-5)
   - Use LLM, embeddings, or fuzzy string libraries (Levenshtein, etc.)
   - Change vault IO, WriteGate, or `specs/cns-vault-contract/`

## Tasks / Subtasks

- [x] Export domain keyword lexicon from `infer-notebook-domain.mjs` (or small shared `domain-lexicon.mjs`) (AC: domain-lexicon)
- [x] Implement `notebook-scorer.mjs`: `tokenizeForScoring`, `f1`, `scoreNotebooks` (AC: module, algorithm, threshold, edges)
- [x] Add `tests/notebook-scorer.test.mjs` + optional fixture JSON (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: tests)

### Review Findings

- [x] [Review][Patch] f1 uses array lengths instead of set cardinalities — score can exceed 1.0 on duplicate tokens [scripts/session-close/lib/notebook-scorer.mjs:f1]
- [x] [Review][Defer] Duplicate tokenizer implementations — identical logic in `tokenizePatternForLexicon` (infer-notebook-domain.mjs) and `tokenizeForScoring` (notebook-scorer.mjs); no circular-dep-free consolidation path yet [infer-notebook-domain.mjs + notebook-scorer.mjs] — deferred, pre-existing coupling constraint
- [x] [Review][Defer] `id.localeCompare` without locale pin in sort comparator — harmless for ASCII slugs but inconsistent with the title comparison above it [scripts/session-close/lib/notebook-scorer.mjs:sort] — deferred, pre-existing

## Dev Notes

### API contract (for 50-4 / 50-5)

```js
/**
 * @typedef {import('./sync-notebook-registry.mjs').NotebookRegistryEntry} NotebookRegistryEntry
 * @typedef {{ id: string, title: string, score: number }} NotebookScoreMatch
 * @typedef {{ status: 'OK', matches: NotebookScoreMatch[] } | { status: 'NO_ROUTE', matches: [] }} NotebookScoreResult
 */

export function tokenizeForScoring(text) { /* returns string[] unique, sorted for tests optional */ }

/**
 * @param {string} topic
 * @param {NotebookRegistryEntry[]} registry
 * @returns {NotebookScoreResult}
 */
export function scoreNotebooks(topic, registry) { ... }
```

Consumers (future stories) should branch on `status === 'NO_ROUTE'` vs `OK`; never infer routing from an empty array alone.

### Why `Math.max(titleScore, domainScore)`

Epic 50 routing must avoid false positives. Averaging would let weak title + weak domain clear 0.75. Taking the **max** means the operator topic must align strongly with **either** the notebook title **or** the domain lexicon — matching the “conservative” operator brief.

### Example scenarios (fixtures)

| Topic | Notebook title | domain | Expected |
|-------|----------------|--------|----------|
| `vault architecture` | `CNS Vault Architecture` | `cns-brain` | `OK`, high score (title overlap) |
| `pake quality` | `Random Notes` | `cns-brain` | `OK` if domain axis ≥ 0.75 |
| `cooking recipes` | `CNS Vault Architecture` | `cns-brain` | `NO_ROUTE` |
| `notebooklm cursor` | `Misc` | `learning` | `OK` via domain lexicon |

Tune fixture titles so scores are stable after 4-decimal rounding.

### Relationship to Story 50-1 / 50-2

| Artifact | Role |
|----------|------|
| `notebook-registry.json` | SSOT input for production callers (50-5 will load via `readRegistry`) |
| `readRegistry` / `sanitizeRegistryEntry` | **Not** called inside scorer; callers pass arrays. Tests may import sanitize to build fixtures. |
| `readNotebookLmTargets` | Unchanged; still env → watch → project map |

### Implementation sketch

```text
infer-notebook-domain.mjs
  └─ export DOMAIN_KEYWORDS_BY_SLUG (or getDomainKeywordTokens(slug))

notebook-scorer.mjs
  ├─ tokenizeForScoring
  ├─ f1
  ├─ corpusTokens(entry) = title tokens ∪ domain slug tokens ∪ domain lexicon tokens
  ├─ scoreNotebooks → map score, filter >= 0.75, sort, OK | NO_ROUTE
  └─ no fs/network

tests/notebook-scorer.test.mjs
  └─ fixture registry arrays + edge cases
```

### Project structure

| Path | Action |
|------|--------|
| `scripts/session-close/lib/notebook-scorer.mjs` | NEW |
| `scripts/session-close/lib/infer-notebook-domain.mjs` | MODIFY — export lexicon helper (minimal surface) |
| `tests/notebook-scorer.test.mjs` | NEW |
| `tests/fixtures/notebook-registry-scorer.json` | NEW (optional) |

### Testing standards

- Same stack as `tests/sync-notebooks.test.mjs` and `tests/session-close-pipeline.test.mjs`
- `npm test` picks up `tests/*.test.mjs` automatically
- Assert exact `status` and match ordering; use `assert.deepEqual` for small arrays

### Architecture compliance

- **Spec-first:** No vault contract changes (repo-local session-close lib)
- **Verify gate:** `bash scripts/verify.sh` mandatory before done
- **WriteGate:** N/A
- **Security:** No secrets in fixtures; registry IDs are non-sensitive

### Epic 50 forward context (do not implement here)

| Story | Planned use of scorer |
|-------|------------------------|
| **50-4** Disambiguation | When `OK` and `matches.length > 1`, prompt operator or structured choice |
| **50-5** Smart routing | Replace/supplement project-map fallback using `scoreNotebooks` + watch/env precedence |

### Previous story intelligence

- **50-1:** Registry schema `{ id, title, watch, domain, last_updated }`; `inferNotebookDomain` / `DOMAIN_RULES` live in `infer-notebook-domain.mjs`
- **50-2:** `readNotebookLmTargets` precedence unchanged; optional `registryPath` for tests
- **Review defer (50-2):** `read-sources.mjs` imports `sync-notebooks.mjs` for `readRegistry` — scorer should **not** add to that coupling; keep scorer dependency only on registry **types** and domain lexicon

### Git intelligence

Recent Epic 50 commits:

- `6a64784` — 50-1 registry + 50-2 watch fanout (`read-sources.mjs`, `sync-notebooks.mjs`, tests)
- `ca642b7` — 50-1 initial registry sync

Follow established `.mjs` + `node:test` patterns; one logical commit for 50-3.

## References

- [Source: operator brief — Epic 50 / 50-3 conservative notebook scorer]
- [Source: `50-1-notebook-registry-sync.md` — registry schema, domain inference table]
- [Source: `50-2-watch-flag-fanout.md` — fan-out precedence, no scorer wiring]
- [Source: `scripts/session-close/lib/infer-notebook-domain.mjs` — `DOMAIN_RULES`]
- [Source: `scripts/session-close/sync-notebooks.mjs` — `readRegistry`, `sanitizeRegistryEntry`]
- [Source: `tests/sync-notebooks.test.mjs` — test patterns]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Completion Notes List

- Exported `DOMAIN_RULES`, `getDomainKeywordTokens(slug)` built from `DOMAIN_RULES` patterns (single lexicon source; `general` returns no extra tokens).
- Added pure `notebook-scorer.mjs`: `tokenizeForScoring`, `f1`, `scoreNotebooks` with `Math.max(titleScore, domainScore)`, threshold 0.75, 4-decimal rounding, tie-break by title then id.
- Added `tests/notebook-scorer.test.mjs` and `tests/fixtures/notebook-registry-scorer.json`; `bash scripts/verify.sh` passed.

### File List

- `scripts/session-close/lib/infer-notebook-domain.mjs` (modified)
- `scripts/session-close/lib/notebook-scorer.mjs` (new)
- `tests/notebook-scorer.test.mjs` (new)
- `tests/fixtures/notebook-registry-scorer.json` (new)

## Change Log

- 2026-05-29: Story 50-3 — conservative notebook scorer (create-story).
- 2026-05-29: Implemented offline notebook scorer + tests (dev-story).

## Story completion status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **done**
