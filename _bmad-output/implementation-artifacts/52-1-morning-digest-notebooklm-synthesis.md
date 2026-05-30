---
baseline_commit: adacf8d8f2e4c8b6e1a9d3f7c2b5e8a1d4f6c9b2
---

# Story 52.1: Morning Digest NotebookLM Synthesis

Status: done

Epic: **52** (Morning Digest × NotebookLM)  
Tracked in sprint-status as: **`52-1-morning-digest-notebooklm-synthesis`**

**Operator intent:** Extend the `morning-digest` Hermes skill so that, after the Perplexity deep-signal step, today's trend keywords and headlines are scored against **watched** notebooks (50-3 scorer + 50-4 disambiguator, same pipeline as 51-1), the best match is queried via **`query-notebook.mjs`** (CLI, not MCP), and the answer appears as a new **`Vault context`** section in the Discord digest. Still **no vault writes**.

---

## Story

As the **CNS operator in `#hermes`**,  
I want **the morning digest to include grounded NotebookLM context for today's strongest signal**,  
so that **my daily briefing connects live trends to the knowledge already curated in watched notebooks**.

---

## Acceptance Criteria

1. **Pipeline order unchanged for sources 1–3 (AC: order)**  
   **Given** `morning-digest` runs (manual or cron)  
   **When** the skill executes  
   **Then** it still runs **Source 1** (Google Trends dry-run) → **Source 2** (NewsAPI) → **Source 3** (Perplexity on top trend) in that order  
   **And** existing section contracts for Trending Now, Headlines, Deep Signal, and Recommended focus remain as in Story 49-6 unless this story explicitly extends them.

2. **Signal set for scoring (AC: signals)**  
   **Given** Sources 1 and/or 2 produced usable strings  
   **When** building the signal list for notebook routing  
   **Then** include up to **5** trend **keywords** from Source 1 (same sort/top-5 as digest bullets)  
   **And** include up to **5** headline **titles** from Source 2  
   **And** omit signals from a source that failed (`source unavailable`)  
   **And** dedupe case-insensitively (keep first occurrence; trends before headlines).

3. **Scoring via 51-1 / 50-3 stack (AC: score)**  
   **Given** a non-empty signal list and `notebook-registry.json` with at least one `watch: true` entry  
   **When** routing runs  
   **Then** `pick-signal-notebook.mjs` loads the registry, filters `watch: true`, and for **each signal** calls `scoreNotebooks(signal, watchedRegistry)` from `scripts/session-close/lib/notebook-scorer.mjs` (**imported, not reimplemented**)  
   **And** collects every match with `score >= 0.75` across all signals  
   **And** selects the single **winning pair** `(signal, notebook)` with the highest `match.score`  
   **And** tie-break: prefer the signal that appeared earlier in the list (trends before headlines); then `match.title` localeCompare; then `match.id` localeCompare (same spirit as scorer sort)  
   **And** runs `disambiguateRoute(scoreResultForWinningSignal, watchedRegistry)` from `notebook-disambiguate.mjs` (**imported**) to produce the final `route`  
   **And** if no signal produces any match ≥ 0.75, treat as **NO_ROUTE** (do not call `query-notebook.mjs`).

4. **Notebook query via CLI (AC: query)**  
   **Given** `route.status === 'ROUTED'` with valid `route.id` and `route.title`  
   **When** querying NotebookLM  
   **Then** invoke `query-notebook.mjs` from the repo mirror at  
   `$CNS_REPO_ROOT/scripts/hermes-skill-examples/notebook-query/scripts/query-notebook.mjs`  
   (or the installed copy under `~/.hermes/skills/cns/notebook-query/scripts/` when `CNS_REPO_ROOT` is unset)  
   **With**:
   - `NOTEBOOK_ID` = `route.id`
   - `NOTEBOOK_QUERY` = `Morning digest context for: <winning_signal>. Summarize what this notebook adds for an operator brief today (2–3 sentences, vault-aligned, no fluff).`
   - `NOTEBOOK_REMAINING_S` = remaining seconds from digest wall clock (see Dev Notes)  
   **And** parse stdout JSON `{ answer, elapsed_ms }`  
   **And** do **not** use `mcp__notebooklm__notebook_query` in the morning-digest skill (CLI only, same as 51-1 script path).

5. **Vault context section in digest output (AC: output)**  
   **Given** the digest is posted to `#hermes`  
   **When** all steps complete  
   **Then** the contract includes a new section **after Deep Signal** and **before Recommended focus**:

   ```text
   **Vault context** (NotebookLM — <route.title>)
   <answer text, max 500 chars; if longer truncate with … suffix>
   _Matched signal:_ <winning_signal>
   ```

   **When** NO_ROUTE (no signal matched):  
   ```text
   **Vault context** (NotebookLM)
   - (source unavailable: no watched notebook matched today's signals)
   ```

   **When** ROUTED but `query-notebook.mjs` fails or times out:  
   ```text
   **Vault context** (NotebookLM — <route.title>)
   - (source unavailable: <short reason>)
   ```

   **And** a failed Vault context step does **not** abort the digest (same partial-failure rule as 49-6).

6. **Hard constraints preserved (AC: safety)**  
   **Then** still **no vault writes**, no Convex trend push, no dashboard relay, no digest archive  
   **And** `trend-ingest.py` remains **`--dry-run`** only  
   **And** secrets are not echoed in Discord.

7. **Deterministic helper + tests (AC: tests)**  
   **Then** `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` exists  
   **And** `tests/morning-digest-pick-signal-notebook.test.mjs` covers signal dedupe, cross-signal winner selection, NO_ROUTE, and disambiguation wiring (fixtures only; no live `nlm`, no network)  
   **And** `tests/hermes-morning-digest-skill.test.mjs` asserts `**Vault context**`, `pick-signal-notebook.mjs`, and `query-notebook.mjs` references in `task-prompt.md` / `SKILL.md`  
   **And** `bash scripts/verify.sh` passes.

8. **Operator Guide (AC: docs)**  
   **Then** CNS Operator Guide §15.11 documents the Vault context section, prerequisite (`nlm` / notebook-query CLI path), and partial-failure behavior.

---

## Tasks / Subtasks

- [x] Add `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` (AC: 3, 7)
- [x] Update `references/task-prompt.md` — Source 4, timing, output contract, allowed tools (AC: 1, 4, 5, 6)
- [x] Update `SKILL.md` — version bump, inline contract, tools policy (remove NotebookLM ban) (AC: 5, 6)
- [x] Update `references/trigger-pattern.md` if execution steps listed (AC: 1)
- [x] Add `tests/morning-digest-pick-signal-notebook.test.mjs` (AC: 7)
- [x] Extend `tests/hermes-morning-digest-skill.test.mjs` (AC: 7)
- [x] Operator Guide §15.11 (AC: 8)
- [x] Run `bash scripts/verify.sh` (AC: 7)

### Review Findings

- [x] [Review][Patch] ROUTED query command cannot reliably invoke `query-notebook.mjs` [scripts/hermes-skill-examples/morning-digest/references/task-prompt.md:120]
- [x] [Review][Patch] Source 4 shell commands are unsafe for apostrophes in headlines or matched signals [scripts/hermes-skill-examples/morning-digest/references/task-prompt.md:99]
- [x] [Review][Patch] Live Hermes `morning-digest` install is stale and lacks the new Source 4 script [scripts/hermes-skill-examples/morning-digest/SKILL.md:4]
- [x] [Review][Patch] `pick-signal-notebook.mjs` documented registry override is broken and only works with a dummy argv slot [scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs:2]
- [x] [Review][Patch] SKILL inline fallback does not preserve exact NO_ROUTE and query-failure Vault context formats [scripts/hermes-skill-examples/morning-digest/SKILL.md:55]

---

## Dev Notes

### Architecture overview

```
morning-digest trigger
        │
        ├─ Source 1: Google Trends (terminal / dry-run)
        ├─ Source 2: NewsAPI (terminal)
        ├─ Source 3: Perplexity deep signal (mcp__perplexity__search)
        │
        ├─ Build signals[] = top-5 keywords + top-5 headlines (deduped)
        │
        ├─ terminal: pick-signal-notebook.mjs (JSON signals on stdin or argv)
        │       └─ scoreNotebooks + disambiguateRoute per 51-1 / 50-3 / 50-4
        │
        ├─ route NO_ROUTE → Vault context unavailable bullet
        │
        └─ route ROUTED → query-notebook.mjs (nlm CLI)
                └─ inject **Vault context** section → post full digest
```

Record `digest_start_ms` at the beginning of task execution (same wall clock as 51-1 `start_time` pattern).

After Source 3 completes:

```
remaining_s = Math.max(15, Math.min(60, 120 - (Date.now() - digest_start_ms) / 1000))
```

Pass as `NOTEBOOK_REMAINING_S` to `query-notebook.mjs`. Floor 15s prevents zero-timeout calls; cap 60s so the digest does not stall indefinitely.

---

### `pick-signal-notebook.mjs` specification

**Path:** `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`  
**Installed to:** `~/.hermes/skills/cns/morning-digest/scripts/pick-signal-notebook.mjs`

**Input (prefer env for shell safety):**

```bash
SIGNALS_JSON='["ai agents","headline title",...]' \
node pick-signal-notebook.mjs
```

- `SIGNALS_JSON`: JSON array of strings (max 10 entries; script truncates extras).
- Legacy: `node pick-signal-notebook.mjs '<json-array-string>'`

**Stdout (exit 0):**

```json
{
  "route": { "status": "ROUTED", "id": "...", "title": "...", "reason": "..." }
        | { "status": "NO_ROUTE", "id": null, "title": null, "reason": "no-route" },
  "winning_signal": "<string or null>",
  "winning_score": <number or null>,
  "elapsed_ms": <number>
}
```

**Exit codes:** `2` registry read/parse failure (same semantics as `resolve-notebook.mjs`); `1` import/routing failure.

**Winner selection (normative):**

```js
// Pseudocode — implement in script
let best = null;
for (let i = 0; i < signals.length; i++) {
  const signal = signals[i];
  const scoreResult = scoreNotebooks(signal, watchedRegistry);
  if (scoreResult.status !== 'OK' || !scoreResult.matches.length) continue;
  const top = scoreResult.matches[0];
  if (!best || top.score > best.score
      || (top.score === best.score && i < best.signalIndex)) {
    best = { signal, signalIndex: i, scoreResult, top };
  }
}
if (!best) { /* NO_ROUTE */ }
const route = disambiguateRoute(best.scoreResult, watchedRegistry);
```

Registry path: same as `resolve-notebook.mjs` (`CNS_NOTEBOOK_REGISTRY_PATH` → `CNS_REPO_ROOT/scripts/session-close/lib/notebook-registry.json`).

---

### Reuse `query-notebook.mjs` (do not fork)

Copying `query-notebook.mjs` into `morning-digest/` is **forbidden** — single source of truth lives under `notebook-query/scripts/`.

**Repo path (preferred in task-prompt):**

```bash
QUERY_SCRIPT="${CNS_REPO_ROOT:-$HOME/ai-factory/projects/Omnipotent.md}/scripts/hermes-skill-examples/notebook-query/scripts/query-notebook.mjs"
NOTEBOOK_ID="$NOTEBOOK_ID" NOTEBOOK_QUERY="$NOTEBOOK_QUERY" NOTEBOOK_REMAINING_S="$remaining_s" \
  node "$QUERY_SCRIPT"
```

Install helper `install-hermes-skill-morning-digest.sh` does **not** need to copy notebook-query if the repo path is documented; optional one-line echo in install output: "Requires notebook-query scripts in repo (51-1)."

**Prerequisite:** `nlm` / `uvx` notebooklm CLI must be on PATH (Operator Guide §15.11 / notebook-query §15.x). If CLI missing, Vault context shows `(source unavailable: notebooklm CLI not found)`.

---

### task-prompt.md edits (delta from 49-6)

1. Remove constraint **"No NotebookLM fan-out"**; replace with: **NotebookLM read via `query-notebook.mjs` only after signal scoring; no `source_add`, no session-close fan-out.**

2. Add **Source 4 — Vault context (NotebookLM)** after Source 3:

   - Build `signals` array per AC:signals.
   - Run `pick-signal-notebook.mjs` with `SIGNALS_JSON`.
   - On ROUTED, run `query-notebook.mjs` with templated `NOTEBOOK_QUERY`.
   - Map exit codes: non-zero → unavailable bullet; timeout message must include `notebook query timed out` substring from script stderr.

3. Extend **Output contract** with **Vault context** section (AC:output).

4. **Allowed tools** table: add row for `terminal` → pick-signal + query-notebook scripts; keep Perplexity + trend scripts.

5. **Forbidden:** still no Vault IO mutators; no `mcp__notebooklm__notebook_query` in this skill (use CLI wrapper).

---

### SKILL.md edits

- Bump `version` to **1.1.0** (NotebookLM vault-context section).
- Add `terminal` to `requires_toolsets` if Hermes honors it (mirror notebook-query policy).
- Update inline contract and execution rule list (step 5 = Vault context, step 6 = post digest).
- Remove "no NotebookLM" from Overview/Safety where 49-6 forbade it.

---

### Contract test plan

**`tests/morning-digest-pick-signal-notebook.test.mjs`** (new):

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `["CNS vault architecture"]` vs watchRegistry | ROUTED `cns-watch-1`, winning_signal set |
| 2 | `["unrelated xyz topic"]` | NO_ROUTE |
| 3 | Two signals; lower-index trend beats equal score | winner = first signal |
| 4 | Two signals; higher score wins regardless of order | higher score notebook |
| 5 | Dedupe `["AI Agents","ai agents"]` | single scoring pass per unique |
| 6 | Empty `SIGNALS_JSON` | NO_ROUTE |
| 7 | Mixed registry — unwatch excluded | linkedin signal → NO_ROUTE |

Import `scoreNotebooks` / `disambiguateRoute` only in pick-script tests via executing the script with fixture registry path argv/env.

**Extend `tests/hermes-morning-digest-skill.test.mjs`:**

- `**Vault context**` in task-prompt
- `pick-signal-notebook.mjs` path exists
- `query-notebook.mjs` referenced (repo path)
- SKILL version `1.1.0`
- Forbidden list does **not** block NotebookLM CLI

---

### Project structure summary

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | NEW |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | NEW |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | UPDATE §15.11 |

**Do NOT modify:**

- `scripts/session-close/lib/notebook-scorer.mjs` (import only)
- `scripts/session-close/lib/notebook-disambiguate.mjs` (import only)
- `scripts/hermes-skill-examples/notebook-query/scripts/query-notebook.mjs` (call only unless shared bugfix required — out of scope)
- `../cns-dashboard` (no Convex widget for digest queries in v1)
- Vault IO / WriteGate paths

**AGENTS.md:** Optional minor Section 8 note in a follow-up session-close; **not required** for this story unless operator wants constitution changelog entry.

---

### Architecture compliance

- **Spec-first:** Discord/skill surface only; no `specs/cns-vault-contract/` tool signature changes.
- **Verify gate:** `bash scripts/verify.sh` mandatory.
- **WriteGate:** N/A — read-only NotebookLM + existing digest sources.
- **Security:** No new credentials; `nlm` uses existing operator auth (same as 51-1).
- **Deferred-work.md:** See 49-6 deferred item on morning-digest task-prompt injection — when implementing, verify Hermes actually loads `task-prompt.md` in production; add smoke note to Operator Guide if still broken.

---

### Previous story intelligence

**49-6 (morning-digest):** Established three-source digest, partial-failure semantics, explicit `terminal(...)` Hermes tool shape, machine-local date, `--dry-run` only. Explicitly **forbade** NotebookLM — this story **narrows** that ban to "no fan-out / no MCP notebook tools" while allowing CLI query. Keep all 49-6 section headers; add Vault context only.

**51-1 (notebook-query):** `resolve-notebook.mjs` scores a **single question**; this story scores **many signals** and picks a global winner. Reuse scorer/disambiguator imports from `CNS_REPO_ROOT/scripts/session-close/lib/`. `query-notebook.mjs` already wraps `nlm query notebook` with `NOTEBOOK_REMAINING_S` (default 20s; 51-1 uses up to 90s for Discord). Digest uses a **60s cap** on notebook time to protect total cron runtime.

**51-2:** Logs successful `/notebook-query` to Convex — **out of scope** for morning-digest (do not call `log-notebook-query.mjs` unless operator later requests analytics).

**50-3 / 50-4:** Threshold 0.75 F1; watch-filter registry before both calls. Live watches (registry): CNS Vault Architecture, AI Factory Blueprint, Nexus Discord Bridge.

---

### Git intelligence (recent)

- `adacf8d` — 51-2 notebook-query history log (skill + Convex; not used here)
- `a6635a9` — notebook-query timeout 30s → 90s for Discord; digest should use explicit `NOTEBOOK_REMAINING_S` instead of relying on default 20s
- `0623376` — notebook-query script-only pipeline (mirror for morning-digest Source 4)

---

### Scope boundaries (non-goals)

- Logging digest NotebookLM answers to Convex / dashboard widget
- Scoring Perplexity **text** as a signal (signals are trend keywords + headline titles only)
- Multiple notebook queries per digest (exactly **one** query for the winning pair)
- Vault IO reads for context (NotebookLM only; section name is operator-facing "Vault context")
- Changing Epic 44 trend-ingest cron or Convex schema

---

## References

- [Source: operator brief — Epic 52 / 52-1 morning digest NotebookLM synthesis]
- [Source: `49-6-morning-digest-upgrade.md` — base digest contract]
- [Source: `51-1-notebook-query-discord-command.md` — scorer, disambiguator, `query-notebook.mjs`]
- [Source: `50-3-conservative-notebook-scorer.md` — `scoreNotebooks`, threshold 0.75]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — current SOURCE 1–3]
- [Source: `scripts/hermes-skill-examples/notebook-query/scripts/query-notebook.mjs`]
- [Source: `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` — registry exit codes pattern]
- [Source: `scripts/session-close/lib/notebook-scorer.mjs`]
- [Source: `scripts/session-close/lib/notebook-disambiguate.mjs`]
- [Source: `scripts/session-close/lib/notebook-registry.json`]
- [Source: `deferred-work.md` — 49-6 task-prompt injection risk]
- [Source: Operator Guide §15.11 — morning-digest skill]

---

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Completion Notes List

- Added `pick-signal-notebook.mjs`: dedupes up to 10 signals, scores watched registry via imported `scoreNotebooks` / `disambiguateRoute`, cross-signal winner with score ≥ 0.75 and tie-break rules.
- Extended morning-digest skill to v1.1.0: Source 4 Vault context via CLI (`pick-signal` + repo `query-notebook.mjs`), digest wall-clock `NOTEBOOK_REMAINING_S`, output contract after Deep Signal.
- Tests: new `morning-digest-pick-signal-notebook.test.mjs` (7 routing scenarios + CLI); extended hermes-morning-digest contract tests.
- Operator Guide §15.11 documents Vault context, prerequisites, partial failure.
- `bash scripts/verify.sh` passed.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` (new)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/hermes-skill-examples/morning-digest/references/trigger-pattern.md`
- `tests/morning-digest-pick-signal-notebook.test.mjs` (new)
- `tests/hermes-morning-digest-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `scripts/install-hermes-skill-morning-digest.sh`

### Change Log

- 2026-05-30: Story 52-1 — morning digest Vault context (NotebookLM CLI after signal scoring).

---

## Story completion status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **review**
