---
baseline_commit: 42a8935f8e2c1d4a9b6e3f7c8d2e1a0b5c4d3e2f
---

# Story 52.2: Morning Digest NotebookLM Convex Log

Status: done

Epic: **52** (Morning Digest × NotebookLM)  
Tracked in sprint-status as: **`52-2-morning-digest-notebooklm-convex-log`**

**Operator intent:** After the morning digest posts Vault context to Discord, log successful NotebookLM hits to the existing `notebookQueries` Convex table via `log-notebook-query.mjs` — fire-and-forget, same pattern as Story 51-2. **No new Convex schema**, no dashboard widget work (51-2 already surfaces history on `/trends`).

---

## Story

As the **CNS operator**,  
I want **successful morning-digest Vault context answers logged to Convex**,  
so that **NotebookLM hits from the daily briefing appear alongside `/notebook-query` history on the `/trends` dashboard without scrolling Discord**.

---

## Acceptance Criteria

1. **Log only on successful Vault context (AC: scope)**  
   **Given** `morning-digest` completes Source 4 with `route.status === 'ROUTED'` and `query-notebook.mjs` returns valid stdout JSON `{ answer, elapsed_ms }`  
   **When** the full digest (including Vault context section) has been posted to `#hermes`  
   **Then** invoke `log-notebook-query.mjs` with:
   - `NOTEBOOK_QUERY` = `winning_signal` (the matched trend keyword or headline — **not** the templated NotebookLM prompt)
   - `NOTEBOOK_ANSWER` = `answer` from `query-notebook.mjs` stdout (**verbatim**, before Discord 500-char truncation)
   - `NOTEBOOK_ID` = `route.id`
   - `NOTEBOOK_TITLE` = `route.title`
   - `NOTEBOOK_DOMAIN` = `route.domain` when present on ROUTED payload; otherwise `'general'`
   **And** do **not** invoke the log script when:
   - `route.status === 'NO_ROUTE'`
   - `query-notebook.mjs` fails, times out, or returns invalid JSON
   - Vault context section shows `(source unavailable: …)`

2. **Fire-and-forget — same contract as 51-2 (AC: fire-and-forget)**  
   **Given** the log script runs after the Discord post  
   **Then** logging failure does **not** alter, retract, or append to the posted digest  
   **And** missing `CONVEX_URL` / `CONVEX_DEPLOY_KEY` → script exits **0** (skip, stderr only)  
   **And** malformed required env → exit **1**; HTTP/Convex error → exit **1**  
   **And** the Hermes agent does **not** await logging before considering the digest complete from the operator's perspective

3. **Reuse existing log script — no fork (AC: reuse)**  
   **Then** call the existing script at  
   `$HOME/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs`  
   (repo mirror: `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`)  
   **And** do **not** copy `log-notebook-query.mjs` into `morning-digest/`  
   **And** do **not** add or modify Convex schema, validators, or dashboard UI (51-2 `notebookQueries` table + `/trends` panel already exist)

4. **ROUTED payload includes domain (AC: domain)**  
   **Given** `pick-signal-notebook.mjs` returns `route.status === 'ROUTED'`  
   **When** stdout JSON is emitted  
   **Then** `route.domain` is present (lookup from watched registry entry by `route.id`, same pattern as `resolve-notebook.mjs` in 51-2)  
   **And** empty/missing registry domain becomes `''` (log script / Convex normalizes to `general`)

5. **Skill docs updated (AC: docs)**  
   **Then** `morning-digest/references/task-prompt.md` documents a **post-post log step** after the output contract (success path only)  
   **And** `morning-digest/SKILL.md` version bumps to **1.2.0** with:
   - Execution step for Convex log after digest post
   - Policy clarified: **no trend Convex push** (`trend-ingest.py --dry-run` unchanged); Vault context may log to `notebookQueries`
   **And** shell-quoted env vars use the same `shellQuote(value)` transform as Source 4 (apostrophes in signals/answers safe)

6. **Hard constraints preserved (AC: safety)**  
   **Then** still **no vault writes**, no digest archive, no `mcp__notebooklm__notebook_query`  
   **And** `trend-ingest.py` remains **`--dry-run`** only (no trend signal Convex push)  
   **And** secrets are not echoed in Discord

7. **Tests + verify (AC: tests)**  
   **Then** `tests/hermes-morning-digest-skill.test.mjs` asserts `log-notebook-query.mjs`, fire-and-forget wording, and success-only scope in task-prompt / SKILL  
   **And** `tests/morning-digest-pick-signal-notebook.test.mjs` asserts ROUTED CLI stdout includes `route.domain`  
   **And** `bash scripts/verify.sh` passes

8. **Operator Guide (AC: operator-guide)**  
   **Then** CNS Operator Guide §15.11 notes that successful Vault context answers log to Convex `/trends` Notebook Query History (shared with `/notebook-query`)

---

## Tasks / Subtasks

- [x] T1: Extend `pick-signal-notebook.mjs` ROUTED stdout with `route.domain` (AC: 4)
- [x] T2: Update `morning-digest/references/task-prompt.md` — post-post log step (AC: 1, 2, 5)
- [x] T3: Update `morning-digest/SKILL.md` — v1.2.0, policy, execution step (AC: 5, 6)
- [x] T4: Extend contract tests (AC: 7)
- [x] T5: Operator Guide §15.11 one-line Convex log note (AC: 8)
- [x] T6: Run `bash scripts/verify.sh` (AC: 7)
- [x] T7: Operator step in completion notes — re-run `install-hermes-skill-morning-digest.sh` + ensure `install-hermes-skill-notebook-query.sh` has been run (log script lives in notebook-query skill)

---

## Dev Notes

### Architecture overview

```
morning-digest Sources 1–4 (unchanged)
        │
   Post full digest to #hermes (includes Vault context)
        │
   [success path only: ROUTED + valid answer JSON]
        │
   terminal: log-notebook-query.mjs (fire-and-forget)
        │  NOTEBOOK_QUERY = winning_signal
        │  POST → notebookQueries:logNotebookQuery (51-2 schema)
        ▼
   /trends NotebookQueryHistoryPanel (51-2 — no changes)
```

**Timing:** Log runs **after** the Discord reply, not before. The operator sees the digest immediately; Convex history is best-effort telemetry.

**Question field semantics:** Dashboard history shows `winning_signal` as the question (e.g. `"AI agents"` or a NewsAPI headline), not the long templated `Morning digest context for: …` prompt sent to NotebookLM. This distinguishes digest hits from manual `/notebook-query` entries while keeping the panel useful.

---

### task-prompt.md delta (add after `## Output contract`)

New section **`## Post-post — Log Vault context to Convex (ROUTED + query success only)`**:

1. **Precondition:** Source 4 finished with `route.status === 'ROUTED'` and parsed `{ answer }` from `query-notebook.mjs` (not unavailable bullet).
2. **After** posting the full digest to `#hermes`, call `terminal` once (fire-and-forget; do not block operator completion on result):

```text
terminal(
  command="LOG_SCRIPT=<shellQuote(log_script)> NOTEBOOK_QUERY=<shellQuote(winning_signal)> NOTEBOOK_ANSWER=<shellQuote(answer)> NOTEBOOK_ID=<shellQuote(route.id)> NOTEBOOK_TITLE=<shellQuote(route.title)> NOTEBOOK_DOMAIN=<shellQuote(route.domain or 'general')> node \"$LOG_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=30
)
```

Where:

```text
log_script = resolved_repo_root + "/scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs"
```

Fallback if repo path missing: `$HOME/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs`

3. **Do not run** for NO_ROUTE, query failure, or when Vault context section is `(source unavailable: …)`.
4. **Failure handling:** ignore non-zero exit; do not edit Discord message.

Mirror notebook-query task-prompt step 5 language from 51-2 for consistency.

---

### `pick-signal-notebook.mjs` domain extension

**Small additive change** — mirror `resolve-notebook.mjs` lines 62–68:

After `disambiguateRoute(...)`, when `route.status === 'ROUTED'`:

```js
const entry = watchedRegistry.find((e) => e && e.id === route.id);
routeOutput = {
  ...route,
  domain: typeof entry?.domain === 'string' ? entry.domain : '',
};
```

Apply in the CLI main block before `process.stdout.write(JSON.stringify(...))`. **Do not** change exit codes or winner-selection logic from 52-1.

---

### Reuse `log-notebook-query.mjs` (51-2 — do not modify unless bugfix)

**Path in repo:** `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`  
**Installed to:** `~/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs`

**Convex mutation:** `notebookQueries:logNotebookQuery` — already deployed in 51-2.

**Env resolution:** `CONVEX_URL` + `CONVEX_DEPLOY_KEY` from env, fallback `~/.hermes/trend-ingest.env` (same as 51-2 / Knowledge Pulse).

**Prerequisite:** Operator must have run `bash scripts/install-hermes-skill-notebook-query.sh` at least once so the log script exists under `~/.hermes/skills/cns/notebook-query/scripts/`. Morning-digest install does **not** copy notebook-query scripts.

---

### SKILL.md edits

- Bump `version` to **1.2.0**.
- Execution rule: add step **7** — after posting digest, log successful Vault context via `log-notebook-query.mjs` (fire-and-forget).
- Policy section — replace blanket **"No Convex push"** with:
  - **No trend Convex push** — `trend-ingest.py --dry-run` mandatory.
  - **Vault context Convex log** — optional telemetry via `log-notebook-query.mjs` on success only; failures silent.
- Inline contract: optional one-line note that logging happens after post (not in Discord output).

---

### Project structure summary

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE — add `route.domain` on ROUTED |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE — post-post log step |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE — v1.2.0, policy, execution |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE — domain in CLI stdout |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE — log script contract |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | UPDATE §15.11 |

**Do NOT modify:**

- `../cns-dashboard/convex/*` — schema exists from 51-2
- `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs` — call only (unless shared bugfix required)
- Vault IO / WriteGate / AGENTS.md
- `scripts/session-close/lib/notebook-scorer.mjs` / `notebook-disambiguate.mjs`

---

### Architecture compliance

- **Cross-repo read-only on dashboard:** Consumes existing 51-2 Convex table; **no cns-dashboard code changes** in this story
- **Spec-first:** Discord/skill surface only; no `specs/cns-vault-contract/` tool signature changes
- **Verify gate:** `bash scripts/verify.sh` mandatory (Omnipotent.md only for this story — cns-dashboard tests still run if sibling present)
- **WriteGate:** N/A — append-only Convex telemetry; no vault mutations
- **Security:** Same trust boundary as 51-2 — deploy key in `~/.hermes/trend-ingest.env`; answers already visible in Discord; Convex truncates at insert (4000 chars answer, 500 chars question)

---

### Previous story intelligence

**52-1 (morning-digest Vault context):** Established Source 4 pipeline, `pick-signal-notebook.mjs`, `query-notebook.mjs` call, Discord output contract. Explicitly deferred Convex logging — **this story implements that deferred item**. Preserve all 52-1 partial-failure semantics; logging is an **additive post-step** only.

**51-2 (notebook-query history log):** Defines `log-notebook-query.mjs`, env vars, fire-and-forget contract, Convex `notebookQueries` table, `/trends` panel. **Copy the log step pattern verbatim** — only differences are:
- Trigger: morning-digest success path vs `/notebook-query` step 5
- `NOTEBOOK_QUERY` = `winning_signal` instead of operator question
- Log script path resolved from repo or notebook-query install dir

**51-1 (notebook-query):** `resolve-notebook.mjs` already adds `domain` to ROUTED — mirror in `pick-signal-notebook.mjs`.

---

### Git intelligence (recent)

- `42a8935` — 52-1 morning-digest Vault context + review patches (baseline for this story)
- `adacf8d` — 51-2 log script + Convex `notebookQueries` (reuse, do not recreate)
- `ae8f9a4` — Convex push env fallback to `~/.hermes/trend-ingest.env` (log script already uses this)

---

### Testing requirements

**Extend `tests/hermes-morning-digest-skill.test.mjs`:**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | task-prompt | contains `log-notebook-query.mjs` |
| 2 | task-prompt | fire-and-forget / after post / do not edit Discord |
| 3 | task-prompt | success-only (NO_ROUTE / unavailable excluded) |
| 4 | task-prompt | `NOTEBOOK_QUERY` tied to `winning_signal` |
| 5 | SKILL.md | version `1.2.0`; trend dry-run vs Vault context log policy |

**Extend `tests/morning-digest-pick-signal-notebook.test.mjs`:**

| # | Scenario | Expected |
|---|----------|----------|
| 8 | CLI with fixture registry + CNS signal | stdout JSON `route.domain === 'cns-brain'` |

**No new `notebook-query-log.test.mjs` changes** unless log script is touched (should not be).

Run: `bash scripts/verify.sh` from Omnipotent.md root.

---

### Scope boundaries (non-goals)

- New Convex tables, mutations, or dashboard widgets
- Logging failed digest queries, NO_ROUTE, or unavailable bullets
- Logging Perplexity or trend-ingest data to Convex
- Vault writes or digest archive JSONL
- Session-close integration
- AGENTS.md constitution bump (dashboard telemetry only)
- Copying `log-notebook-query.mjs` into morning-digest skill dir

---

## References

- [Source: operator brief — Epic 52 / 52-2 morning digest NotebookLM Convex log]
- [Source: `52-1-morning-digest-notebooklm-synthesis.md` — Source 4 pipeline; deferred Convex logging]
- [Source: `51-2-notebook-query-history-log.md` — log script, env vars, fire-and-forget, Convex schema]
- [Source: `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`]
- [Source: `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` — step 5 log pattern]
- [Source: `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` — domain on ROUTED]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — current Source 4 + output contract]
- [Source: `../cns-dashboard/convex/notebookQueries.ts` — existing mutation (read-only for this story)]
- [Source: Operator Guide §15.11 — morning-digest skill]
- [Source: `project-context.md` — verify gate, no WriteGate impact]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

(none)

### Completion Notes List

- Added `route.domain` to ROUTED stdout in `pick-signal-notebook.mjs` (mirrors `resolve-notebook.mjs` pattern).
- Added post-post Convex log step to `task-prompt.md` — fire-and-forget `log-notebook-query.mjs` after Discord post, success path only, `NOTEBOOK_QUERY=winning_signal`.
- Bumped `morning-digest` SKILL.md to v1.2.0; execution step 7 + policy split (no trend Convex push vs optional Vault context log).
- Extended contract tests in `hermes-morning-digest-skill.test.mjs` and `morning-digest-pick-signal-notebook.test.mjs` (domain assertion).
- Operator Guide §15.11 updated with Convex log note and v1.2.0.
- `bash scripts/verify.sh` passed.

**Operator steps (T7):**
1. `bash scripts/install-hermes-skill-morning-digest.sh` — deploy v1.2.0 skill to `~/.hermes/skills/cns/morning-digest/`
2. Ensure `bash scripts/install-hermes-skill-notebook-query.sh` has been run (log script prerequisite)

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-31: Code review patches — answer_full contract, exit-1 docs, shellQuote inventory, domain tests

### Review Findings

- [x] [Review][Patch] Document exit-1 failure modes in task-prompt failure handling [task-prompt.md:224]
- [x] [Review][Patch] Cross-list post-post vars in Source 4 shellQuote inventory [task-prompt.md:101]
- [x] [Review][Patch] Require non-empty answer in post-post precondition (mirror notebook-query step 3) [task-prompt.md:197]
- [x] [Review][Patch] Mandate separate pre-truncation answer variable for NOTEBOOK_ANSWER [task-prompt.md:217]
- [x] [Review][Patch] Assert "After posting" timing in contract test [hermes-morning-digest-skill.test.mjs]
- [x] [Review][Patch] Assert NOTEBOOK_ANSWER verbatim contract in contract test [hermes-morning-digest-skill.test.mjs]
- [x] [Review][Patch] Add CLI test for empty/missing registry domain → route.domain === '' [morning-digest-pick-signal-notebook.test.mjs]
- [x] [Review][Patch] Assert route.domain on legacy argv CLI path [morning-digest-pick-signal-notebook.test.mjs:139]
- [x] [Review][Defer] Fire-and-forget via awaited terminal(timeout=30) — same 51-2 pattern [task-prompt.md:199] — deferred, pre-existing
- [x] [Review][Defer] No idempotency/dedupe on notebookQueries rows — out of scope for 52-2 [log-notebook-query.mjs] — deferred, pre-existing
- [x] [Review][Defer] pickSignalNotebook() export lacks domain enrichment (CLI-only) [pick-signal-notebook.mjs:107] — deferred, no non-CLI consumer
- [x] [Review][Defer] OMNIPOTENT_REPO vs CNS_REPO_ROOT env split — pre-existing 52-1 [task-prompt.md:18] — deferred, pre-existing
- [x] [Review][Defer] readLogPayload trims NOTEBOOK_ANSWER — pre-existing 51-2 log script [log-notebook-query.mjs:110] — deferred, pre-existing
- [x] [Review][Defer] Large NOTEBOOK_ANSWER shell env / ARG_MAX — pre-existing 51-2 pattern [task-prompt.md:203] — deferred, pre-existing

---

## Story completion status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **done**
