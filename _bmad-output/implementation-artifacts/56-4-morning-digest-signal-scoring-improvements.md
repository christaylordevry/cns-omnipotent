---
story_id: 56-4
epic: 56
title: morning-digest-signal-scoring-improvements
status: done
baseline_commit: c2d039981461dc5448ec51c01a00f447de8c7651
---

# Story 56.4: Morning digest signal scoring improvements

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest**,  
I want **Vault context routing to score signals from Google Trends, NewsAPI headlines, and Perplexity findings—not trend keywords alone**,  
so that **more digest runs ROUTED with confident F1 scores above the soft-route floor (0.20) instead of NO_ROUTE or marginal soft_match**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 56: NotebookLM routing calibration + vault hygiene (operator brief 2026-06-02) |
| **Predecessors** | **55-2** (non-zero `normalizedValue` on trends); **56-1** (`SOFT_ROUTE_FLOOR = 0.20`, shared `resolveNotebookRoute`); **52-1** (pick-signal pipeline, task-prompt signal spec) |
| **Problem** | After 55-2 + 56-1, live digests still show winning F1 scores **0.01–0.23**. Soft floor is **0.20** but signals barely clear it. Operators see frequent `NO_ROUTE` or weak `soft_match` Vault context. |
| **Root cause (confirmed in code review)** | `pick-signal-notebook.mjs` already scores **every** string in `SIGNALS_JSON` via `resolveNotebookRoute`—it does **not** limit itself to one keyword. The gap is **upstream signal construction**: Hermes builds `SIGNALS_JSON` ad hoc; in practice often only top trend keywords are passed. Task-prompt lists trends + headlines but has **no deterministic builder** and **excludes Perplexity text** (52-1 explicitly deferred). LLM omission of headlines/Perplexity is not caught by tests. |
| **Goal** | Deterministic, code-owned signal assembly from all three sources before scoring; richer text → better F1 token overlap vs notebook titles/domains. |
| **In scope** | `pick-signal-notebook.mjs` (signal build + CLI input), `references/task-prompt.md` (Source 4 wiring), `tests/morning-digest-pick-signal-notebook.test.mjs`, `tests/hermes-morning-digest-skill.test.mjs` |
| **Read only** | `scripts/session-close/lib/notebook-scorer.mjs` — **do not** change `SCORE_THRESHOLD`, `SOFT_ROUTE_FLOOR`, or F1 logic |
| **Out of scope** | Threshold tuning, Convex schema, dashboard, digest Discord template headings, `trend-ingest.py`, cron install scripts |

### Operator brief (binding)

1. Audit what `pick-signal-notebook.mjs` receives today → confirm multi-signal loop vs single-keyword myth.
2. If NewsAPI / Perplexity are not reliably in the scorer input, add them with appropriate ordering/weighting.
3. Richer signal strings (headlines, Perplexity summary phrases) improve F1 against watched notebook titles.
4. Unified signal set from all available sources before `resolveNotebookRoute` cross-signal winner pick.
5. `bash scripts/verify.sh` green; at least one combined-source fixture scores ≥ 0.20 on typical registry.

## Acceptance Criteria

### 1. Deterministic multi-source signal builder (AC: sources)

**Given** parsed Source 1 trends JSON, Source 2 headlines JSON, and Source 3 Perplexity answer text (any source may be empty/unavailable)  
**When** the dev agent runs the new builder (exported from `pick-signal-notebook.mjs` or invoked via extended CLI)  
**Then** output is a deduped `string[]` with:

| Priority | Source | Max entries | Content |
|----------|--------|-------------|---------|
| 1 | Google Trends | 5 | `events[].keyword` sorted by `normalizedValue` desc (same as Trending Now) |
| 2 | NewsAPI | 5 | headline `title` strings |
| 3 | Perplexity | 3 | signal strings derived from Deep Signal text (see Dev Notes) |

**And** case-insensitive dedupe keeps **first** occurrence (trends before headlines before Perplexity-derived)  
**And** total cap **10** signals (`MAX_SIGNALS` unchanged)  
**And** failed sources are skipped without failing the builder (empty contribution).

### 2. CLI / env contract (AC: integration)

**Given** structured source payload on stdin or env (choose one design; document in Completion Notes)  
**When** Hermes runs Source 4 per updated task-prompt  
**Then** task-prompt no longer relies on the model hand-assembling `SIGNALS_JSON` from memory  
**And** legacy `SIGNALS_JSON='["kw",...]'` string-array input **still works** (backward compatible for tests and manual runs)  
**And** `pick-signal-notebook.mjs` stdout shape unchanged: `{ route, winning_signal, winning_score, elapsed_ms }`.

### 3. Scoring quality (AC: route)

**Given** fixture registry `watchRegistry` from `tests/morning-digest-pick-signal-notebook.test.mjs`  
**When** signals built from a **representative multi-source fixture** (trend keyword + CNS-relevant headline + short Perplexity phrase overlapping `AI Factory Blueprint`)  
**Then** `pickSignalNotebook` returns `route.status === 'ROUTED'` with `winning_score >= 0.20`  
**And** at least one Perplexity-derived or headline-only signal routes where trend-only did not in the same fixture (regression proves multi-source value).

### 4. Task-prompt and skill contract tests (AC: docs)

**Given** `references/task-prompt.md` Source 4 section  
**When** tests in `tests/hermes-morning-digest-skill.test.mjs` run  
**Then** task-prompt documents calling the builder with Source 1–3 payloads before `pick-signal-notebook.mjs`  
**And** documents Perplexity text inclusion for scoring (52-1 exclusion reversed for this story)  
**And** contract test asserts builder invocation + three-source mention (not only `SIGNALS_JSON` hand-built array).

### 5. Verify gate (AC: test)

**Then** `tests/morning-digest-pick-signal-notebook.test.mjs` covers: builder dedupe order, cap 10, Perplexity phrase extraction edge cases (empty, whitespace), multi-source ROUTED case  
**And** existing 56-1 soft-route / hard-route tests remain green  
**And** `bash scripts/verify.sh` passes.

### 6. Scope guards (AC: scope)

**Then** `notebook-scorer.mjs` thresholds and F1 implementation are **unchanged**  
**And** no Convex, dashboard, or vault writes.

## Tasks / Subtasks

- [x] **T1** Audit — trace current `SIGNALS_JSON` construction in task-prompt vs live Hermes behavior; document in Completion Notes (AC: 1)
- [x] **T2** Implement `buildDigestSignals({ trends, headlines, perplexityText })` in `pick-signal-notebook.mjs` with ordering/dedupe/cap per table (AC: 1)
- [x] **T3** Perplexity extraction — derive 1–3 scoring strings from summary (full summary as one signal and/or top noun phrases; avoid stopword-only tokens; min length 2 after trim) (AC: 1, 3)
- [x] **T4** CLI — accept structured JSON (`DIGEST_SOURCES_JSON` or stdin) + legacy `SIGNALS_JSON`; call builder then `pickSignalNotebook` (AC: 2)
- [x] **T5** Update `references/task-prompt.md` Source 4 — terminal pipeline: pass parsed JSON from Sources 1–3 into builder/picker (AC: 2, 4)
- [x] **T6** Tests — extend `morning-digest-pick-signal-notebook.test.mjs` + `hermes-morning-digest-skill.test.mjs` (AC: 3, 4, 5)
- [x] **T7** Run `bash scripts/verify.sh`; optional live dry-run evidence in Completion Notes (AC: 5)

## Dev Notes

### What pick-signal does today (do not misunderstand)

```104:125:scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
export function pickSignalNotebook(signals, watchedRegistry) {
  // ...
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const route = resolveNotebookRoute(signal, watchedOnly);
    if (route.status !== 'ROUTED') {
      continue;
    }
    // ... candidateBeatsIncumbent picks global winner
  }
}
```

Each string is scored independently via F1 token overlap (`notebook-scorer.mjs` → `notebook-route.mjs`). The bug is **empty or trend-only `signals[]`**, not the picker loop.

### What task-prompt already says (but is not enforced in code)

```95:103:scripts/hermes-skill-examples/morning-digest/references/task-prompt.md
### Build `signals` (for scoring)

From parsed Source 1 and Source 2 only (skip a source that failed with `source unavailable`):

- Up to **5** trend **keywords** from Source 1 (same sort/top-5 as Trending Now bullets).
- Up to **5** headline **titles** from Source 2.
- Dedupe case-insensitively (keep first; trends before headlines).
```

**Gap:** No Source 3 (Perplexity) in scoring list; LLM may omit headlines. **56-4 adds Perplexity + code path.**

### Scorer (read only)

```7:8:scripts/session-close/lib/notebook-scorer.mjs
export const SCORE_THRESHOLD = 0.75;
export const SOFT_ROUTE_FLOOR = 0.2;
```

F1 uses `tokenizeForScoring` (min length 2, stopword filter). Longer, domain-rich strings (headlines, Perplexity sentences) increase intersection with notebook **title** and **domain** lexicon tokens.

**Example from 56-1 Completion Notes:** `"ai agent orchestration"` → soft_match **~0.33** vs `AI Factory Blueprint`. Headlines like `"How AI agents are reshaping enterprise automation"` should score higher when tokens align.

### Recommended `buildDigestSignals` API

```js
/**
 * @param {{
 *   trends?: Array<{ keyword: string, normalizedValue?: number }>,
 *   headlines?: Array<{ title: string } | string>,
 *   perplexityText?: string,
 * }} sources
 * @returns {string[]}
 */
export function buildDigestSignals(sources) { /* ... */ }
```

**Trends:** sort by `normalizedValue` descending; map `keyword`; skip empty.  
**Headlines:** accept `{ title }` or bare string; skip empty titles.  
**Perplexity:** trim; if length > 0:
- Always include **one** signal = first sentence or full text truncated to ~200 chars (whitespace-safe), OR
- Split on `. ` / `; ` and take up to 3 non-empty segments as separate signals  
Do **not** pass the templated NotebookLM query string—only Deep Signal body text.

**Dedupe:** reuse `dedupeSignals` after concatenating ordered lists.

### CLI design options (pick one in T4)

| Option | Pros | Cons |
|--------|------|------|
| **A. `DIGEST_SOURCES_JSON` env** | Shell-quote once; Hermes already uses env for `SIGNALS_JSON` | Large JSON in env |
| **B. stdin JSON to pick script** | No env size issues | task-prompt must pipe via `node` one-liner |

Prefer **A** for parity with existing `SIGNALS_JSON` + `shellQuote` pattern in task-prompt. Example shape:

```json
{
  "trends": [{ "keyword": "AI agent orchestration", "normalizedValue": 0.42 }],
  "headlines": [{ "title": "Enterprise AI agents gain orchestration tooling" }],
  "perplexityText": "AI agent orchestration platforms saw major releases this week..."
}
```

Legacy path: if `SIGNALS_JSON` set and `DIGEST_SOURCES_JSON` unset → `dedupeSignals(JSON.parse(SIGNALS_JSON))` only.

### task-prompt Source 4 change (normative)

Replace hand-built `signals_json` array with:

1. After Source 3, assemble `digest_sources` object from parsed tool outputs.
2. `terminal(command="DIGEST_SOURCES_JSON=<shellQuote(...)> node .../pick-signal-notebook.mjs", ...)`
3. Keep `shellQuote` for all dynamic env values.

Update SKILL.md one-liner if it still says "Build trend/headline signals" without Perplexity—optional doc sync if install mirror copies from repo.

### Perplexity weighting guidance

- Do **not** multiply F1 scores in code (scorer unchanged).
- "Weighting" = **inclusion order + more signals**: headlines/Perplexity get scored in the cross-signal loop; earliest high score wins per `candidateBeatsIncumbent`.
- Cap Perplexity at **3** strings so trends/headlines are not crowded out of `MAX_SIGNALS=10`.

### Test fixtures

| Case | Input | Expected |
|------|-------|----------|
| Trends only (legacy) | `SIGNALS_JSON=['ai agent orchestration']` | Same as today soft_match test |
| Multi-source win | trends + headline with "AI Factory" tokens | ROUTED `ai-watch-1`, score ≥ 0.20 |
| Dedupe | trend keyword appears in headline title | Single entry (trend wins) |
| Perplexity only | empty trends/headlines, perplexity mentions "vault architecture" | ROUTED `cns-watch-1` if tokens align |
| All empty | `{}` | `[]` → NO_ROUTE |

Use `rankAllMatches` from `notebook-scorer.mjs` in tests to tune fixture strings if scores are borderline.

### Files to touch

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE — `buildDigestSignals`, CLI/env |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE — Source 4 builder wiring |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE — builder + multi-source routing |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE — task-prompt contract |
| `scripts/session-close/lib/notebook-scorer.mjs` | **READ ONLY** |

### Previous story intelligence

**56-1:** Soft-route at 0.20 via `resolveNotebookRoute`; production band 0.01–0.23 on **trend-only** signals. This story raises scores by **richer inputs**, not threshold changes. `read-sources.mjs` smartRoute still hard-only — out of scope (deferred-work.md).

**55-2:** Trends now have real `normalizedValue`; sorting top-5 for signals should use same sort as Trending Now display.

**52-1:** Explicitly excluded Perplexity from signals — **56-4 supersedes that exclusion** for scoring only (Deep Signal display unchanged).

### Git intelligence

Recent: `c2d0399` (56-3), `31df2bc` (56-1 routing). Follow `node:test`, fixture registries, `verify.sh` gate. No new npm dependencies.

### Project references

- [Source: `_bmad-output/implementation-artifacts/56-1-notebooklm-routing-threshold-tuning.md`]
- [Source: `_bmad-output/implementation-artifacts/55-2-google-trends-normalized-value-fix.md`]
- [Source: `_bmad-output/implementation-artifacts/52-1-morning-digest-notebooklm-synthesis.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 56-1 session-close parity]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.11 — vault context pipeline]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

### Completion Notes List

- **T1 audit:** `pick-signal-notebook.mjs` already scored every `SIGNALS_JSON` entry; the gap was upstream. Task-prompt told the model to assemble trends + headlines into `SIGNALS_JSON` by hand and excluded Perplexity (52-1). Hermes often passed trend-only arrays, yielding F1 0.01–0.23 and frequent `NO_ROUTE`/marginal `soft_match`.
- **Implementation:** Added `buildDigestSignals`, `extractPerplexitySignals` (sentence split, `tokenizeForScoring` stopword-only filter, 200-char cap), and `DIGEST_SOURCES_JSON` env (preferred over legacy `SIGNALS_JSON`). CLI argv accepts digest-sources object or string array. `notebook-scorer.mjs` thresholds unchanged.
- **CLI design:** Option A — `DIGEST_SOURCES_JSON` + `shellQuote` in task-prompt (parity with prior env pattern).
- **Quality:** Multi-source fixture routes `ai-watch-1` at ≥0.20; headline-only routes when trend-only does not; perplexity-only routes `cns-watch-1`. `bash scripts/verify.sh` passed after `install-hermes-skill-morning-digest.sh` sync.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-02: Multi-source deterministic signal builder + `DIGEST_SOURCES_JSON` CLI; task-prompt Source 4 and contract tests updated (Story 56-4).

### Review Findings

- [x] [Review][Patch] Treat empty `DIGEST_SOURCES_JSON` as unset so legacy `SIGNALS_JSON` still applies [`pick-signal-notebook.mjs:241-243`] — `hasEnvDigestSources()` uses `!== undefined`, so `DIGEST_SOURCES_JSON=""` skips JSON parse and returns `[]` without falling back to `SIGNALS_JSON` (AC2 rollback / manual runs).
- [x] [Review][Patch] Add CLI test: empty `DIGEST_SOURCES_JSON` + valid `SIGNALS_JSON` routes via legacy array [`tests/morning-digest-pick-signal-notebook.test.mjs`]
- [x] [Review][Defer] Malformed `DIGEST_SOURCES_JSON` / `SIGNALS_JSON` parse errors yield silent `[]` → `NO_ROUTE` [`pick-signal-notebook.mjs:269-282`] — deferred, matches pre-56-4 `SIGNALS_JSON` behavior; stderr warning could be a follow-up ops story.
