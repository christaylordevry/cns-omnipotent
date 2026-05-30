---
baseline_commit: e3f89794c9a66eb8048c7059b4dd9c51c8f1a23b
---

# Story 51.1: `/notebook-query` Discord Command

Status: done

Epic: **51** (NotebookLM Query Surface)  
Tracked in sprint-status as: **`51-1-notebook-query-discord-command`**

**Operator intent:** Build the read-side companion to Epic 50's write pipeline. The operator types `/notebook-query <question>` in `#hermes`; Hermes routes it to the most relevant watched notebook using the already-proven 50-3 scorer + 50-4 disambiguator, calls the NotebookLM MCP, and posts the grounded answer back — all within a 30-second total budget.

---

## Story

As the **CNS operator**,  
I want to type `/notebook-query <question>` in **#hermes** and receive a grounded answer from the most relevant watched notebook within 30 seconds,  
so that **I can query the knowledge base from Discord without manually targeting a notebook**.

---

## Acceptance Criteria

1. **Command handled by Hermes skill (AC: skill)**  
   **Given** a Discord message in `#hermes` starting with `/notebook-query ` followed by a non-empty question  
   **When** the skill is triggered  
   **Then** the message is parsed and the question extracted; the skill runs the pipeline below

2. **Routing via existing scorer (AC: routing)**  
   **Given** the question string  
   **When** scoring is performed  
   **Then** the question text is passed directly to `scoreNotebooks(question, watchedRegistry)` from `scripts/session-close/lib/notebook-scorer.mjs` — **not** `extractScoringTopic`  
   **And** `watchedRegistry` is the notebook registry filtered to only entries where `watch: true`  
   **And** the scorer is **imported, not reimplemented**

3. **Disambiguation via existing disambiguator (AC: disambiguate)**  
   **Given** the `NotebookScoreResult` from step AC:routing  
   **When** disambiguation is performed  
   **Then** `disambiguateRoute(scoreResult, watchedRegistry)` from `scripts/session-close/lib/notebook-disambiguate.mjs` is called  
   **And** the disambiguator is **imported, not reimplemented**  
   **And** if `route.status === 'NO_ROUTE'`, post the no-match message (AC: no-route) and stop — do not call `notebook_query`

4. **NO_ROUTE user message (AC: no-route)**  
   **When** `disambiguateRoute` returns `{ status: 'NO_ROUTE' }`  
   **Then** post to `#hermes` exactly:
   ```
   📚 notebook-query: no confident match
   No watched notebook scored ≥ 0.75 for that question. Try more specific keywords, or check `watch: true` flags in the notebook registry.
   ```
   **And** do not call `mcp__notebooklm__notebook_query`

5. **NotebookLM query with time budget (AC: query)**  
   **When** `route.status === 'ROUTED'`  
   **Then** record `elapsed_ms` from command receipt to post-disambiguation  
   **And** compute `remaining_s = Math.max(5, 30 - elapsed_ms / 1000)`  
   **And** call `mcp__notebooklm__notebook_query` with:
   - `notebook_id`: `route.id`
   - `query`: the original question text (verbatim)
   - `timeout`: `remaining_s`  
   **And** do NOT give `notebook_query` a fresh full 30 seconds — it gets the remaining budget only

6. **Answer posted to #hermes (AC: response)**  
   **When** `notebook_query` returns an answer  
   **Then** post to `#hermes` in this format:
   ```
   📚 **notebook-query:** <question>
   **Notebook:** <route.title>
   **Answer:** <answer text from notebook_query>
   ```
   **And** the question is included verbatim (truncated to 80 chars if longer with `…` suffix)

7. **Failure modes post back — never silent (AC: failures)**  
   **When** `notebook_query` times out (exceeds `remaining_s`)  
   **Then** post: `📚 notebook-query: timeout — answer not received within 30s. Try again.`  
   **When** `notebook_query` returns an MCP error or throws  
   **Then** post: `📚 notebook-query: error — <concise error description>`  
   **When** the registry file cannot be read or is malformed  
   **Then** post: `📚 notebook-query: error — could not load notebook registry`  
   **When** the registry contains no `watch: true` entries  
   **Then** post the no-match message from AC:no-route (treating as NO_ROUTE)

8. **Skill installed (AC: install)**  
   **Given** `bash scripts/install-hermes-skill-notebook-query.sh` is run  
   **Then** the skill is installed to `~/.hermes/skills/cns/notebook-query/`  
   **And** the resolver helper script is installed to `~/.hermes/skills/cns/notebook-query/scripts/resolve-notebook.mjs`  
   **And** a `README` or `config-snippet.md` instructs the operator how to bind the skill in `~/.hermes/config.yaml`

9. **Tests pass (AC: tests)**  
   **Then** `tests/hermes-notebook-query-skill.test.mjs` uses `node:test` + `node:assert/strict`, fixtures only (no live MCP, no live registry, no network)  
   **And** covers the contract scenarios listed in the Dev Notes test plan  
   **And** all existing tests continue to pass (`bash scripts/verify.sh` green)

10. **AGENTS.md version bump (AC: agents-md)**  
    **Then** `specs/cns-vault-contract/AGENTS.md` version is bumped (was 2.1.16) and **both** copies updated per the sync rule

---

## Tasks / Subtasks

- [x] Create resolver helper: `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` (AC: routing, disambiguate)
- [x] Write skill package: `scripts/hermes-skill-examples/notebook-query/SKILL.md` (AC: skill)
- [x] Write trigger doc: `scripts/hermes-skill-examples/notebook-query/references/trigger-pattern.md` (AC: skill)
- [x] Write task prompt: `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` (AC: routing, disambiguate, query, response, failures)
- [x] Write config snippet: `scripts/hermes-skill-examples/notebook-query/references/config-snippet.md` (AC: install)
- [x] Write install script: `scripts/install-hermes-skill-notebook-query.sh` (AC: install)
- [x] Add contract tests: `tests/hermes-notebook-query-skill.test.mjs` (AC: tests)
- [x] Bump AGENTS.md version to 2.1.18 in both copies (AC: agents-md)
- [x] Run `bash scripts/verify.sh` (AC: tests)

---

## Dev Notes

### Architecture overview

```
Operator Discord message:  /notebook-query What are the PAKE validation rules?
                                              │
                                     [trigger-pattern.md]
                                              │
                              parse question: "What are the PAKE validation rules?"
                                              │
                         [resolve-notebook.mjs — node via execute_code]
                           1. Read registry (JSON), filter watch:true
                           2. scoreNotebooks(question, watchedRegistry)   ← 50-3
                           3. disambiguateRoute(scoreResult, watchedRegistry) ← 50-4
                           4. Output: { route, elapsed_ms } as JSON
                                              │
                               route.status === 'NO_ROUTE' → post no-match message
                               route.status === 'ROUTED'   ↓
                                              │
                         compute remaining_s = max(5, 30 - elapsed_ms/1000)
                                              │
                         mcp__notebooklm__notebook_query(id, question, remaining_s)
                                              │
                              format + post answer to #hermes
```

---

### Resolver helper: `resolve-notebook.mjs`

**Path in repo**: `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs`  
**Installed to**: `~/.hermes/skills/cns/notebook-query/scripts/resolve-notebook.mjs`

This module is the ONLY new business-logic file. It wraps the two existing 50-series modules. Keep it thin — no logic beyond what's needed to bridge the skill to the library.

```js
// resolve-notebook.mjs
// Usage: node resolve-notebook.mjs "<question>" [registryPath]
// Outputs JSON to stdout: { route: DisambiguationResult, elapsed_ms: number }

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Import from CNS repo — path resolved via CNS_REPO_ROOT env var
const CNS_REPO_ROOT = process.env.CNS_REPO_ROOT ||
  join(homedir(), 'ai-factory', 'projects', 'Omnipotent.md');
const LIB_PATH = join(CNS_REPO_ROOT, 'scripts', 'session-close', 'lib');

const { scoreNotebooks } = await import(join(LIB_PATH, 'notebook-scorer.mjs'));
const { disambiguateRoute } = await import(join(LIB_PATH, 'notebook-disambiguate.mjs'));

const question = process.argv[2] ?? '';
const registryPath = process.argv[3] ??
  (process.env.CNS_NOTEBOOK_REGISTRY_PATH ||
   join(LIB_PATH, 'notebook-registry.json'));

const start = Date.now();
const raw = JSON.parse(await readFile(registryPath, 'utf8'));
const watchedRegistry = Array.isArray(raw) ? raw.filter(e => e && e.watch === true) : [];
const scoreResult = scoreNotebooks(question, watchedRegistry);
const route = disambiguateRoute(scoreResult, watchedRegistry);
const elapsed_ms = Date.now() - start;

process.stdout.write(JSON.stringify({ route, elapsed_ms }) + '\n');
```

**Critical**: imports are **dynamic ESM** (`await import()`) using absolute paths from `CNS_REPO_ROOT`. This avoids needing to symlink or copy the scorer/disambiguator files. The default `CNS_REPO_ROOT` value (`~/ai-factory/projects/Omnipotent.md`) is the actual WSL2 path for this operator.

**Contract tests** test this module's exported logic by importing the scorer/disambiguator directly (not the helper script, which would need a live registry file). See test plan below.

---

### Skill package structure

```
scripts/hermes-skill-examples/notebook-query/
├── SKILL.md                          ← skill metadata + overview
├── scripts/
│   └── resolve-notebook.mjs          ← resolver helper (see above)
└── references/
    ├── trigger-pattern.md            ← trigger grammar + failure modes
    ├── task-prompt.md                ← full Hermes task instructions
    └── config-snippet.md             ← ~/.hermes/config.yaml snippet
```

---

### SKILL.md structure (follow investigate-trend pattern)

```yaml
---
name: notebook-query
description: "Hermes /notebook-query for #hermes: routes a freeform question to the most relevant watched NotebookLM notebook using offline scorer+disambiguator (50-3/50-4); posts grounded answer. 30s total budget."
version: 1.0.0
author: CNS Operator
license: MIT
metadata:
  hermes:
    tags: [cns, hermes, notebooklm, query, read-only]
---
```

Sections: Overview, When to use, When not to use, Policy, Tools, Non-goals.

**Tools**: `mcp__notebooklm__notebook_query` only for live queries; `execute_code bash` to run `resolve-notebook.mjs`.

**Non-goals**: No vault writes. No dashboard relay. No fan-out. Discord only.

---

### trigger-pattern.md: trigger grammar

**Positive trigger** (trimmed message starts with `/notebook-query ` + non-empty text):
```
/notebook-query What are the PAKE validation rules?
/notebook-query how does the conservative scorer handle ambiguous domains
```

**Failure modes** (must not run pipeline):
- Message is exactly `/notebook-query` with no trailing question (post: `notebook-query: bad-trigger (question required)`)
- Message does not start with `/notebook-query `

**Question extraction rule**: take everything after `/notebook-query ` (leading/trailing whitespace trimmed); max 500 chars (truncate silently if longer — the scorer will handle long text gracefully).

---

### task-prompt.md: full Hermes instructions

Structure the task-prompt.md with these sections:

**0) Trigger and abort gates**
1. Message must start with `/notebook-query ` (case-sensitive, space-terminated)
2. Extract question: everything after the prefix, trimmed
3. If question is empty: reply `notebook-query: bad-trigger (question required)` and stop
4. Record start timestamp (wall clock)

**1) Run resolver**

Via execute_code bash:
```bash
SKILL_DIR="$HOME/.hermes/skills/cns/notebook-query"
node "$SKILL_DIR/scripts/resolve-notebook.mjs" "<question>"
```

Parse the JSON output line. Extract `route` and `elapsed_ms`.

Error handling:
- If node exits non-zero or output is not valid JSON: post `📚 notebook-query: error — could not resolve notebook routing` and stop.
- If `watchedRegistry` was empty (infer from `route.status === 'NO_ROUTE'` with no registry entries): post the no-match message.

**2) Route decision**

- `route.status === 'NO_ROUTE'` → post no-match message (AC:no-route) and stop
- `route.status === 'ROUTED'` → continue to step 3

**3) Query notebook**

Compute:
```
remaining_s = max(5, 30 - elapsed_ms / 1000)
```

Call `mcp__notebooklm__notebook_query`:
- `notebook_id`: `route.id`
- `query`: original question (verbatim, not truncated for the MCP call)
- `timeout`: `remaining_s`

Handle result:
- Timeout (tool error with timeout signal) → post timeout message (AC:failures)
- MCP error → post error message (AC:failures)

**4) Post answer**

Format per AC:response. Truncate question to 80 chars with `…` if longer.

---

### install script: `scripts/install-hermes-skill-notebook-query.sh`

Follow the exact pattern of `scripts/install-hermes-skill-investigate-trend.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/notebook-query"
DEST_DIR="${HOME}/.hermes/skills/cns/notebook-query"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-notebook-query: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

if cp -a "$SRC_DIR/." "$DEST_DIR/" 2>/dev/null; then
  :
else
  cp -R "$SRC_DIR/." "$DEST_DIR/"
fi

echo "Installed Hermes skill to: $DEST_DIR"
echo "Next: bind notebook-query in #hermes via ~/.hermes/config.yaml (see $DEST_DIR/references/config-snippet.md)."
echo "Ensure CNS_REPO_ROOT env var is set in ~/.hermes/config.yaml mcp_servers or ~/.hermes/session-close.env"
```

---

### config-snippet.md

```yaml
# ~/.hermes/config.yaml
# Bind notebook-query to the #hermes channel
discord:
  channel_skill_bindings:
    "<hermes-channel-id>": "notebook-query"

# Ensure CNS_REPO_ROOT is available to the skill
# (defaults to ~/ai-factory/projects/Omnipotent.md if unset)
# env:
#   CNS_REPO_ROOT: /home/christ/ai-factory/projects/Omnipotent.md
```

Note: `channel_skill_bindings` allows only one skill per channel — this is an override. If `#hermes` currently has multiple skills (free_response), use the free-response routing and document that the trigger prefix `/notebook-query` routes to this skill.

---

### Contract test plan: `tests/hermes-notebook-query-skill.test.mjs`

The tests cover the **routing pipeline** (scorer + disambiguator + watch filter), not the full Hermes skill runtime (which requires Claude + live MCP). Import the actual scorer/disambiguator modules directly.

```js
import { scoreNotebooks } from '../scripts/session-close/lib/notebook-scorer.mjs';
import { disambiguateRoute } from '../scripts/session-close/lib/notebook-disambiguate.mjs';
```

**Test registry fixture**:
```js
const watchRegistry = [
  { id: 'cns-watch-1', title: 'CNS Vault Architecture', watch: true, domain: 'cns-brain', last_updated: null },
  { id: 'ai-watch-1',  title: 'AI Factory Blueprint',   watch: true, domain: 'ai-factory', last_updated: null },
];
const mixedRegistry = [
  ...watchRegistry,
  { id: 'unwatch-1', title: 'LinkedIn Strategy 2026', watch: false, domain: 'linkedin', last_updated: null },
];
```

**Test cases** (minimum required):

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | Strong title match → ROUTED | `"CNS vault architecture"`, watchRegistry | `{ status: 'ROUTED', id: 'cns-watch-1' }` |
| 2 | Domain keyword match → ROUTED | `"pake brain vault"`, watchRegistry | `{ status: 'ROUTED', id: 'cns-watch-1' }` |
| 3 | No keyword overlap → NO_ROUTE | `"linkedin strategy posts"`, watchRegistry | `{ status: 'NO_ROUTE' }` |
| 4 | Unwatch-flagged entry excluded | `"linkedin strategy"`, watchRegistry (cns+ai only) | `{ status: 'NO_ROUTE' }` — linkedin not in watchRegistry |
| 5 | Empty watched registry → NO_ROUTE | `"vault architecture"`, `[]` | `{ status: 'NO_ROUTE' }` |
| 6 | Watch-flag tiebreak with 2 matches | Tie-question, 2-entry watchRegistry | disambiguate → ROUTED (top-ranked or watch-preferred per 50-4) |
| 7 | Question with short tokens only | `"is it ok"`, watchRegistry | `{ status: 'NO_ROUTE' }` (tokens < 2 chars dropped by scorer) |
| 8 | Mixed registry — watch filter works | `"linkedin"`, mixedRegistry, filtered to watchRegistry | `{ status: 'NO_ROUTE' }` (linkedin unwatch excluded) |

**Helper function under test** (define inline in tests — do not import from the skill package):
```js
function resolveForQuestion(question, registry) {
  const watched = registry.filter(e => e && e.watch === true);
  const scoreResult = scoreNotebooks(question, watched);
  return disambiguateRoute(scoreResult, watched);
}
```

This function is the testable contract for the resolver helper. The test file validates the pipeline behavior the skill depends on — not the Hermes runtime execution.

---

### Timing budget implementation note

The `elapsed_ms` in the resolver JSON output covers:
- Registry JSON read from disk (~5–50ms on WSL2)
- `scoreNotebooks` call (synchronous, <1ms for 50-entry registry)
- `disambiguateRoute` call (synchronous, <1ms)

In practice `elapsed_ms ≈ 10–100ms`, so `remaining_s ≈ 29.9s`. The constraint in AC #7 is a correctness requirement — the implementation must track and subtract, even if the deduction is small.

**Task-prompt.md must explicitly compute**: `remaining_s = Math.max(5, 30 - elapsed_ms / 1000)` and pass to `notebook_query`'s `timeout` field. The floor of 5 seconds prevents accidentally giving the MCP call zero time if something delays the script.

---

### Question-as-topic rationale

Epic 50's scoring pipeline used `extractScoringTopic(contextPack)` to derive a topic from the session sprint state. For `/notebook-query`, the **question itself is the topic** — it directly expresses the operator's intent. No topic extraction is needed; the raw question goes straight to `scoreNotebooks`.

The F1 scorer handles natural language questions well enough: common words score low, domain-specific terms score high. A question like `"What are the PAKE validation rules?"` → tokens `["what", "are", "the", "pake", "validation", "rules"]` — where `"pake"` hits the `cns-brain` domain lexicon (added in 50-3 from `infer-notebook-domain.mjs`).

---

### Registry path resolution (priority order)

1. `process.env.CNS_NOTEBOOK_REGISTRY_PATH` (explicit override)
2. `$CNS_REPO_ROOT/scripts/session-close/lib/notebook-registry.json` (computed from `CNS_REPO_ROOT` env or default path)

The default `CNS_REPO_ROOT` = `~/ai-factory/projects/Omnipotent.md`. This is the live registry file — same one that session-close uses. The skill always reads the current state (no stale copy).

---

### Project structure summary

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/notebook-query/SKILL.md` | NEW |
| `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` | NEW |
| `scripts/hermes-skill-examples/notebook-query/references/trigger-pattern.md` | NEW |
| `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` | NEW |
| `scripts/hermes-skill-examples/notebook-query/references/config-snippet.md` | NEW |
| `scripts/install-hermes-skill-notebook-query.sh` | NEW |
| `tests/hermes-notebook-query-skill.test.mjs` | NEW |
| `specs/cns-vault-contract/AGENTS.md` | MODIFY — version bump 2.1.16 → 2.1.17 |
| `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` | MODIFY — same bump (sync rule) |

**Do NOT modify**:
- `scripts/session-close/lib/notebook-scorer.mjs` (import only)
- `scripts/session-close/lib/notebook-disambiguate.mjs` (import only)
- `scripts/session-close/lib/notebook-registry.json` (read-only at runtime)
- `scripts/session-close/` orchestration scripts
- `../cns-dashboard` (not in scope)

---

### Architecture compliance

- **Spec-first**: No `specs/cns-vault-contract/` module changes (Discord command surface; no WriteGate, no vault IO)
- **Verify gate**: `bash scripts/verify.sh` mandatory before done
- **WriteGate**: N/A — skill is read-only; no vault mutations
- **Security**: `notebook_query` calls require the notebooklm MCP to be authenticated (operator's session token); no new credential handling required
- **AGENTS.md sync rule**: Both copies must be updated atomically in the same commit

---

### Previous story intelligence (Epic 50)

- **50-3 scorer contract**: `scoreNotebooks(topic, registry)` is **pure** — no IO, no env reads, no network. `topic` is a string; `registry` is a `NotebookRegistryEntry[]`. Returns `NotebookScoreResult`. Threshold 0.75, F1 on set cardinalities. Live at `scripts/session-close/lib/notebook-scorer.mjs`.

- **50-4 disambiguator contract**: `disambiguateRoute(scoreResult, registry)` is **pure**. Returns `DisambiguationResult` — either `{ status: 'ROUTED', id, title, reason }` or `{ status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' }`. Live at `scripts/session-close/lib/notebook-disambiguate.mjs`. Registry entries with `watch: true` get tiebreak preference — already handled internally by the disambiguator.

- **Important**: pass the same `watchedRegistry` (filtered array) to **both** `scoreNotebooks` AND `disambiguateRoute`. The disambiguator's watch-flag tiebreak works on the registry it receives — if you pass the full registry it will see unwatch entries and the tiebreak will use them. Filter first, then pass the filtered array to both calls.

- **50-5 pattern for registry loading**: `readRegistry()` from `scripts/session-close/sync-notebooks.mjs` with `DEFAULT_REGISTRY_PATH`. For the Hermes skill context (outside session-close), use a direct `JSON.parse(await readFile(...))` call — simpler and avoids importing the full sync-notebooks module.

- **Review findings from 50-4**: `isValidScoreResult` in the disambiguator treats `{ status: 'NO_ROUTE' }` without a `matches` field as valid (correct behavior). When the scorer returns `NO_ROUTE`, `matches` is `[]` — this is valid. No need to special-case in the resolver.

- **Test stack**: `node:test` + `node:assert/strict` + inline fixtures. No external test runners. Tests auto-discovered by `npm test` via the `"test"` script in `package.json` (runs `node --test tests/*.test.mjs`).

---

### Git intelligence (recent commits)

- `e3f8979` — fix: push notebookHealth snapshot to Convex after session-close (Knowledge Pulse wiring)
- `98e4b16` — chore: populate notebook registry, set watch:true on core 3 notebooks
- `0eedf59` — test: add CLI stale-alert path coverage (50-8 follow-up)
- `0fd3138` — chore: close epic-50 — NotebookLM full integration complete
- `b869434` — feat(50-8): watched-notebook staleness alerts via Discord on session-close
- `71ddd88` — feat(50-7): notebook routing report block in Discord session-close summary

Live `watch: true` notebooks in `notebook-registry.json` as of `98e4b16`:
- `981466f0` — CNS Vault Architecture (domain: cns-brain)
- `dc6abf1a` — AI Factory Blueprint (domain: ai-factory)
- `f037c741` — Nexus Discord Bridge (domain: general)

These three are the initial watch targets — the skill will route to whichever one best matches the question.

---

### Scope boundaries (non-goals)

- **No response loop back to cns-dashboard** — Discord only (explicitly deferred)
- **No session-close changes** — skill operates independently of the session-close pipeline
- **No vault reads or writes** — no Vault IO MCP calls
- **No registry mutation** — read-only access to `notebook-registry.json`
- **No NotebookLM source add or notebook creation** — query only
- **No LLM-based routing** — the scorer + disambiguator are deterministic and offline

---

## References

- [Source: operator brief — Epic 51 / 51-1 `/notebook-query` Discord command]
- [Source: `50-3-conservative-notebook-scorer.md` — scorer contract, `scoreNotebooks`, `tokenizeForScoring`, `f1`]
- [Source: `50-4-disambiguation.md` — disambiguator contract, `disambiguateRoute`, `DisambiguationResult`]
- [Source: `50-5-smart-routing.md` — registry load pattern, watch filter precedence]
- [Source: `scripts/session-close/lib/notebook-scorer.mjs` — live scorer implementation]
- [Source: `scripts/session-close/lib/notebook-disambiguate.mjs` — live disambiguator implementation]
- [Source: `scripts/session-close/lib/notebook-registry.json` — live registry with watch flags]
- [Source: `scripts/hermes-skill-examples/investigate-trend/` — skill package structure to follow]
- [Source: `scripts/install-hermes-skill-investigate-trend.sh` — install script pattern to follow]
- [Source: MCP tool schema: `user-notebooklm/tools/notebook_query.json` — `notebook_id`, `query`, `timeout` params]
- [Source: `tests/notebook-disambiguate.test.mjs` — test patterns for `node:test` + `node:assert/strict`]
- [Source: `specs/cns-vault-contract/AGENTS.md` — v2.1.16, sync rule for dual-file update]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Completion Notes List

- Implemented `resolve-notebook.mjs` as thin wrapper: reads registry JSON, filters `watch: true`, calls `scoreNotebooks` then `disambiguateRoute` via dynamic ESM imports from `CNS_REPO_ROOT`. Outputs `{ route, elapsed_ms }` JSON to stdout.
- Skill package follows the `investigate-trend` pattern exactly: `SKILL.md` + `references/` with trigger-pattern, task-prompt, and config-snippet.
- `task-prompt.md` covers all pipeline steps: trigger abort gates, resolver execution, route decision (NO_ROUTE vs ROUTED), `remaining_s = Math.max(5, 30 - elapsed_ms / 1000)` time budget computation, `notebook_query` call, and all failure mode reply strings per AC:failures and AC:response.
- Install script follows `install-hermes-skill-investigate-trend.sh` pattern with `cp -a` fallback and `CNS_REPO_ROOT` guidance.
- Contract tests: 11 tests across 2 suites covering all 8 required scenarios plus 3 additional edge cases. All pass. Uses `node:test` + `node:assert/strict` + inline fixtures, no live MCP, no network.
- AGENTS.md bumped to 2.1.18 (2.1.17 was already taken by a session-close regeneration that ran before this story). Both copies updated atomically and verified identical.
- `bash scripts/verify.sh` passed (VERIFY PASSED).

### File List

- `scripts/hermes-skill-examples/notebook-query/SKILL.md` — NEW
- `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` — NEW
- `scripts/hermes-skill-examples/notebook-query/references/trigger-pattern.md` — NEW
- `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` — NEW
- `scripts/hermes-skill-examples/notebook-query/references/config-snippet.md` — NEW
- `scripts/install-hermes-skill-notebook-query.sh` — NEW
- `tests/hermes-notebook-query-skill.test.mjs` — NEW
- `specs/cns-vault-contract/AGENTS.md` — MODIFIED (v2.1.17 → v2.1.18)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` — MODIFIED (v2.1.17 → v2.1.18)

### Review Findings

- [x] [Review][Patch] Registry read/parse failures post wrong message — exit code 2 → `could not load notebook registry`; exit 1 → routing error [`task-prompt.md`, `resolve-notebook.mjs`]
- [x] [Review][Patch] 30s budget from command receipt — `remaining_s = Math.min(30, Math.max(5, 30 - (Date.now() - start_time) / 1000))` [`task-prompt.md` §3]
- [x] [Review][Patch] Non-array registry JSON exits 2 — no silent NO_ROUTE on malformed registry [`resolve-notebook.mjs`]
- [x] [Review][Patch] TC-8 exercises top-ranked tiebreak with injected tied matches [`tests/hermes-notebook-query-skill.test.mjs`]
- [x] [Review][Patch] Shell-unsafe question interpolation — `NOTEBOOK_QUERY` env var only [`task-prompt.md`, `resolve-notebook.mjs`]
- [x] [Review][Patch] `resolve-notebook.mjs` CLI integration tests — exit codes, JSON stdout, env question [`tests/hermes-notebook-query-skill.test.mjs`]
- [x] [Review][Defer] `CNS_REPO_ROOT` controls dynamic import path — operator-trusted env; same deployment model as session-close [`resolve-notebook.mjs`:9-15] — deferred, pre-existing trust boundary
- [x] [Review][Defer] `argv[3]` registry path override — only Hermes `execute_code` invokes script; not Discord-exposed [`resolve-notebook.mjs`:18-21] — deferred, operator tooling
- [x] [Review][Defer] Install `cp -R` fallback permissions — matches `install-hermes-skill-investigate-trend.sh` pattern [`install-hermes-skill-notebook-query.sh`:16-20] — deferred, pre-existing pattern

---

## Change Log

- 2026-05-30: Story 51-1 created — `/notebook-query` Discord command (create-story).
- 2026-05-30: Code review patches applied — registry exit codes, NOTEBOOK_QUERY env, start_time budget, CLI tests (16 pass), verify.sh green.

## Story completion status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **done**
