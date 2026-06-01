---
baseline_commit: d7cf680
---

# Story 53.3: Add reason field to NO_ROUTE responses in notebook-query scorer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **53** (NotebookLM operational resilience)
Tracked in sprint-status as: **`53-3-add-reason-field-to-no-route-responses`**

## Story

As the **CNS operator**,
I want **Discord `/notebook-query` no-match replies to include a diagnostic `reason` from the resolver**,
so that **I can tell whether routing failed due to an empty question, no watched notebooks, or a below-threshold best match without re-running the scorer manually**.

## Acceptance Criteria

1. **NO_ROUTE reason codes on every failure path (AC: resolver)**
   **Given** `resolve-notebook.mjs` finishes routing without a `ROUTED` result
   **When** stdout JSON is emitted with `route.status === 'NO_ROUTE'`
   **Then** `route.reason` is a **string** and is exactly one of:
   - `"no_watched_notebooks"` — registry loaded successfully but zero entries have `watch: true`
   - `"empty_question"` — question is empty after trim **or** `tokenizeForScoring(question)` yields zero tokens (filler-only / short-token queries per scorer rules)
   - `"below_threshold: best=<Title> (<score>)"` — at least one valid watched row was scored, the best F1 score is **&lt; 0.75**, and the reason embeds that notebook title and score rounded to two decimal places in the display (scorer uses four-decimal internal rounding; format for Discord may use two decimals, e.g. `0.61` for `0.6100`)

2. **Discord no-match message surfaces reason (AC: discord)**
   **When** `route.status === 'NO_ROUTE'`
   **Then** `references/task-prompt.md` instructs the agent to post:
   ```
   📚 notebook-query: no confident match for your question.
   Reason: <route.reason>
   Try rephrasing or use /vault-lint to check notebook coverage.
   ```
   **And** the summary table row for NO_ROUTE is updated to match (including a concrete `below_threshold` example).

3. **ROUTED path unchanged (AC: regression)**
   **Given** a question that routes successfully
   **When** `resolve-notebook.mjs` emits stdout JSON
   **Then** `route` shape is unchanged: `status`, `id`, `title`, `reason` (`single-match` | `watch-preferred` | `top-ranked`), optional `domain`
   **And** no new fields are required on ROUTED.

4. **Existing tests pass (AC: tests)**
   **Then** all tests in `tests/hermes-notebook-query-skill.test.mjs` continue to pass (update assertions that assumed `reason === 'no-route'` on NO_ROUTE).

5. **New tests for three reason codes (AC: coverage)**
   **Then** `tests/hermes-notebook-query-skill.test.mjs` adds CLI-level cases via `runResolver` asserting:
   - empty watch registry → `no_watched_notebooks`
   - stopword-only question (e.g. `"what is"`) → `empty_question`
   - below-threshold overlap (e.g. `"linkedin strategy posts"` or `"is it ok"` against `watchRegistry`) → `below_threshold: best=...`

6. **Verify gate (AC: verify)**
   **Then** `bash scripts/verify.sh` passes before commit.

## Tasks / Subtasks

- [x] Implement ordered NO_ROUTE diagnostics in `resolve-notebook.mjs` (AC: 1)
  - [x] Early exit: `watchedRegistry.length === 0` → `no_watched_notebooks`
  - [x] Early exit: `!question.trim()` or `tokenizeForScoring(question).length === 0` → `empty_question` (import `tokenizeForScoring` from `notebook-scorer.mjs`)
  - [x] On scorer/disambiguator NO_ROUTE: compute best score across watched rows **without** the 0.75 cutoff (mirror title/domain max logic from `notebook-scorer.mjs`; keep logic in resolver only — do not change `notebook-scorer.mjs` per scope)
  - [x] Emit `below_threshold: best=<title> (<score>)` using top candidate; preserve `id: null`, `title: null` on NO_ROUTE
- [x] Update `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` NO_ROUTE reply + summary table (AC: 2)
- [x] Extend `tests/hermes-notebook-query-skill.test.mjs` (AC: 4, 5)
- [x] Run `bash scripts/verify.sh` (AC: 6)
- [x] If skill package changed: `bash scripts/install-hermes-skill-notebook-query.sh` and note operator smoke in completion notes (not required for CI)

## Dev Notes

### Problem / operator value

Today `/notebook-query` no-match text is generic. The resolver already distinguishes failure modes internally (empty watch list, filler-stripped tokens, sub-threshold F1) but collapses them to `disambiguateRoute` → `reason: 'no-route'`. This story **threads diagnostic reasons only through `resolve-notebook.mjs` stdout** and the Hermes task prompt — not through shared scorer/disambiguator libraries.

### Current pipeline (read before editing)

```56:70:scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs
const watchedRegistry = raw.filter((e) => e && e.watch === true);
const scoreResult = scoreNotebooks(question, watchedRegistry);
const route = disambiguateRoute(scoreResult, watchedRegistry);
// ...
process.stdout.write(JSON.stringify({ route: routeOutput, elapsed_ms }) + '\n');
```

- **Scorer** (`scripts/session-close/lib/notebook-scorer.mjs`): `SCORE_THRESHOLD = 0.75`; returns `{ status: 'NO_ROUTE', matches: [] }` for empty topic, zero tokens, empty valid rows, or no match ≥ threshold. Does **not** expose sub-threshold best match.
- **Disambiguator** (`scripts/session-close/lib/notebook-disambiguate.mjs`): maps scorer NO_ROUTE to `{ status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' }`. ROUTED uses `reason` for tie-break semantics (`single-match`, etc.) — **do not change disambiguator**; override/replace `route.reason` on the NO_ROUTE branch in the resolver only.

### Recommended resolver algorithm (ordered checks)

1. Load registry (unchanged exit `2` behavior).
2. `watchedRegistry = raw.filter(watch === true)`.
3. If `watchedRegistry.length === 0` → return `{ route: { status: 'NO_ROUTE', id: null, title: null, reason: 'no_watched_notebooks' }, elapsed_ms }`.
4. `question = (NOTEBOOK_QUERY ?? argv).trim()`.
5. If `!question` OR `tokenizeForScoring(question).length === 0` → `empty_question`.
6. `scoreResult = scoreNotebooks(question, watchedRegistry)`; `route = disambiguateRoute(...)`.
7. If `route.status === 'ROUTED'` → existing domain enrichment; stdout unchanged.
8. If `route.status === 'NO_ROUTE'`:
   - Compute `best` = highest `max(titleF1, domainF1)` over valid watched rows (same tokenization/domain lexicon as scorer — import `f1`, `tokenizeForScoring`, `normalizeDomainSlug`, `getDomainKeywordTokens` from session-close lib).
   - Set `route.reason = \`below_threshold: best=${best.title} (${formatScore(best.score)})\`` (if no valid rows, use a safe fallback string documented in tests; prefer never hitting this when `watchedRegistry` non-empty and tokens non-empty).
9. Write stdout JSON; exit `0`.

**Do not** call `query-notebook.mjs` on NO_ROUTE (unchanged).

### `reason` field naming collision (critical)

| `route.status` | `route.reason` meaning |
|----------------|------------------------|
| `ROUTED` | Disambiguation tie-break: `single-match`, `watch-preferred`, `top-ranked` |
| `NO_ROUTE` | Diagnostic: `no_watched_notebooks`, `empty_question`, or `below_threshold: best=...` |

Tests that pipe `scoreNotebooks` + `disambiguateRoute` directly (without resolver) may still see `no-route`; **new assertions must use `runResolver` CLI** for diagnostic reasons.

### Task prompt path

File is **`scripts/hermes-skill-examples/notebook-query/references/task-prompt.md`** (not repo-root `task-prompt.md`). Update:
- HARD RULES block (lines 6–9)
- Case A in §2
- Summary table row for NO_ROUTE

Optional: bump `SKILL.md` “Bounded output” line only if it duplicates the old no-match string verbatim.

### `pick-signal-notebook.mjs` — out of scope

Morning digest (`scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`) still returns `reason: 'no-route'` on NO_ROUTE and uses a silent “Vault context unavailable” bullet. **Do not change** in this story (Discord-only diagnostics).

### Test fixtures (reuse from existing file)

From `tests/hermes-notebook-query-skill.test.mjs`:

| Case | Question | Registry | Expected `route.reason` |
|------|----------|----------|-------------------------|
| No watch | any | `[]` or all `watch: false` | `no_watched_notebooks` |
| Stopword-only | `"what is"` | `watchRegistry` | `empty_question` |
| Below threshold | `"linkedin strategy posts"` or `"is it ok"` | `watchRegistry` | `below_threshold: best=AI Factory Blueprint (0.00)` on zero-overlap ties (title sort) — **assert with regex** `/^below_threshold: best=.+\([\d.]+\)$/` plus exact match when fixture-stable |

Keep TC-1..TC-9 ROUTED tests; update any NO_ROUTE unit tests on raw `disambiguateRoute` only if they incorrectly expected diagnostic reasons.

### Files to touch

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` | UPDATE — NO_ROUTE reason threading + best-score helper |
| `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` | UPDATE — Discord template |
| `tests/hermes-notebook-query-skill.test.mjs` | UPDATE — three new CLI tests + fix NO_ROUTE assertions |

### Out of scope (do not implement)

- Changing `SCORE_THRESHOLD` or `notebook-scorer.mjs` / `notebook-disambiguate.mjs`
- `query-notebook.mjs`, Convex log, dashboard
- Morning digest / `pick-signal-notebook.mjs`
- Vault IO, WriteGate, MCP signatures

### Previous story intelligence (53-1)

- **53-1** added session-close `nlm login --check` watchdog; explicitly did **not** change routing/scoring. Pattern: small lib helper, fixture tests, `verify.sh` gate, optional `install-hermes-skill-*` for live Hermes parity.
- Baseline commit at story creation: `d7cf680` (after 53-1 merge `95892b0`).

### Git context

Recent notebook-query lineage: `51-1` resolver + task prompt, `51-2` Convex log, `52-*` morning digest reuse of `query-notebook.mjs`. Follow **51-1** install/test patterns.

### References

- [Source: `_bmad-output/implementation-artifacts/51-1-notebook-query-discord-command.md`] — original NO_ROUTE Discord contract
- [Source: `scripts/session-close/lib/notebook-scorer.mjs`] — threshold, tokenization, F1
- [Source: `scripts/session-close/lib/notebook-disambiguate.mjs`] — ROUTED reason values
- [Source: `tests/notebook-scorer.test.mjs`] — below-threshold scoring examples
- [Source: `scripts/install-hermes-skill-notebook-query.sh`] — live skill sync
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`] — NotebookLM routing epic context (read-only)

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- `empty_question` CLI test uses `"what is"` (zero scorer tokens); `"is it ok"` tokenizes to `it`/`ok` and correctly hits `below_threshold` path.

### Completion Notes List

- `resolve-notebook.mjs`: ordered early exits (`no_watched_notebooks`, `empty_question`); overrides disambiguator `no-route` with `below_threshold: best=<title> (<score>)` via resolver-local best F1 helper (no scorer/disambiguator changes).
- `task-prompt.md`: NO_ROUTE Discord template and summary table include `Reason: <route.reason>`.
- Five new CLI tests in `hermes-notebook-query-skill.test.mjs`; `bash scripts/verify.sh` green.
- Operator: run `bash scripts/install-hermes-skill-notebook-query.sh` for live Hermes parity before Discord smoke.

### File List

- `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs`
- `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md`
- `tests/hermes-notebook-query-skill.test.mjs`

### Review Findings

- [x] [Review][Patch] Task-prompt `below_threshold` example shows `(0.61)` but `watchRegistry` + `"linkedin strategy posts"` yields `(0.00)` — operators may treat live output as a bug [`task-prompt.md`:66,173]
- [x] [Review][Patch] `bestWatchedMatch` tie-break uses first registry row when scores tie; scorer uses title-then-id sort — diagnostic title can disagree with scorer ranking [`resolve-notebook.mjs`:139-141]
- [x] [Review][Patch] AC5 cites `"is it ok"` → `empty_question` but implementation correctly routes to `below_threshold`; add CLI test for `"is it ok"` → `below_threshold` and fix story AC5 wording [`tests/hermes-notebook-query-skill.test.mjs`]
- [x] [Review][Patch] HARD RULES “post exactly” block has inconsistent indentation on the `Reason:` / `Try rephrasing` lines [`task-prompt.md`:6-9]
- [x] [Review][Defer] `below_threshold: best=unknown (0.00)` when watched rows exist but none pass `validRegistryRow` — untested, mislabels config errors [`resolve-notebook.mjs`:186] — deferred, pre-existing edge
- [x] [Review][Defer] Notebook titles with `)` or `=` copied verbatim into `route.reason` — Discord/regex parsing risk [`resolve-notebook.mjs`:184] — deferred, pre-existing

## Change Log

- 2026-06-01: Thread diagnostic NO_ROUTE reasons through resolver stdout and Hermes task prompt; CLI tests + verify gate.
- 2026-06-01: Code review patches — scorer tie-break in `bestWatchedMatch`, prompt examples `(0.00)`, `is it ok` CLI test, AC5 wording.
