---
story_id: 54-2
epic: 54
title: notebook-query-convex-log-reliability
status: done
baseline_commit: b3c957d
---

# Story 54.2: Notebook query Convex log reliability

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **CNS operator**,  
I want **successful NotebookLM answers from `/notebook-query` and morning-digest Vault context to reach the Convex `notebookQueries` table reliably**,  
so that **`/trends` → Notebook Query History is complete even when NLM queries run 50s+ and Hermes compacts context after the Discord reply**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 54: Hermes deployment parity & NotebookLM observability |
| **Predecessors** | **51-2** (log script + Convex table), **52-2** (morning-digest log step), **54-1** (skill install gate — parity trio must be installed after prompt edits) |
| **Problem** | `log-notebook-query.mjs` is invoked **after** the Discord answer with “fire-and-forget” wording. On long `query-notebook.mjs` runs (54s+ NLM), the Hermes turn often **ends or compacts** before step 5 runs — logs are **silently dropped** and `NotebookQueryHistoryPanel` is incomplete. |
| **Root cause class** | Agent lifecycle / prompt contract — not a Convex or `log-notebook-query.mjs` bug (script out of scope). |
| **Fix class** | **Awaited**, bounded `terminal(timeout=15)` **after** post; structured outcome record; optional **silent** Discord warning on hard failure — **never** block or edit the success answer/digest. |

### Operator brief (binding)

- Add explicit **15s** timeout and **error capture** on the terminal call that runs `log-notebook-query.mjs`.
- Log success/failure in **close-report style** structured output (JSON line — not `.session-close/close-report.json`).
- On log failure (non-zero exit or timeout): post a **single silent warning line** in Discord — not a hard skill failure.
- **Out of scope:** `log-notebook-query.mjs`, Convex schema, cns-dashboard, Operator Guide (optional follow-up), `SKILL.md` version bumps (task-prompt + tests only per operator scope).

## Acceptance Criteria

### 1. Bounded awaited log — notebook-query (AC: nq-terminal)

**Given** `/notebook-query` completed step 4 (formatted answer posted to `#hermes`) on the success path  
**When** step 5 runs  
**Then** the agent invokes the Hermes **`terminal`** tool (not undocumented fire-and-forget) with:

- `timeout=15` (seconds)
- `workdir` = `resolved_repo_root` (`OMNIPOTENT_REPO` if set, else `/home/christ/ai-factory/projects/Omnipotent.md`)
- `command` runs `log-notebook-query.mjs` with the same env vars as today (`NOTEBOOK_QUERY`, `NOTEBOOK_ANSWER`, `NOTEBOOK_ID`, `NOTEBOOK_TITLE`, `NOTEBOOK_DOMAIN`) using **POSIX `shellQuote`** for dynamic values (same rules as morning-digest Source 4)
- Script path: repo `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`, fallback `$HOME/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs`

**And** the agent **awaits** terminal completion before ending the skill turn (remove language that implies skipping or backgrounding the log step).

**And** Discord answer text from step 4 is **not** edited or retracted regardless of log outcome.

### 2. Bounded awaited log — morning-digest (AC: md-terminal)

**Given** morning-digest posted the full digest and Source 4 was ROUTED with non-empty `answer_full`  
**When** the post-post Convex log runs  
**Then** `terminal(..., timeout=15)` replaces `timeout=30`  
**And** the same await + capture contract as AC 1 applies (`NOTEBOOK_QUERY=winning_signal`, `NOTEBOOK_ANSWER=answer_full`, etc. — unchanged semantics from 52-2).

### 3. Structured outcome — close-report style (AC: telemetry)

**When** the log `terminal` call completes (success, non-zero exit, or timeout)  
**Then** the agent records **one** JSON line to **stderr** (or the tool transcript the operator can grep), shaped like:

```json
{"notebook_query_log":{"status":"ok","exit_code":0,"reason":"ok"}}
```

**Allowed `status` values:**

| status | When |
|--------|------|
| `ok` | Exit `0` and stderr does not indicate Convex HTTP/mutation failure |
| `skipped-env` | Exit `0` and stderr indicates missing `CONVEX_URL` / deploy key skip (script skip path) |
| `failed` | Exit non-zero |
| `timeout` | Terminal tool reports timeout / exceeded 15s |

**And** `reason` is a short snake_case or kebab token (≤ 80 chars), no secrets, no full `NOTEBOOK_ANSWER` body.

**And** this mirrors session-close telemetry discipline (structured, grep-friendly) without writing to `.session-close/close-report.json`.

### 4. Silent Discord warning on hard failure (AC: warn)

**When** `notebook_query_log.status` is `failed` or `timeout`  
**Then** post **one** additional line to `#hermes` after the answer/digest:

```text
_(Notebook history log failed — /trends may be missing this query.)_
```

**And** do **not** post the warning for `ok` or `skipped-env`  
**And** do **not** treat log failure as skill failure (no error reply replacing the success block).

### 5. Scope guards unchanged (AC: scope)

**Then** log step still runs **only** on success paths (51-2 / 52-2 rules):  
- notebook-query: not for `NO_ROUTE`, query timeout, or query errors  
- morning-digest: not for `NO_ROUTE`, `(source unavailable: …)`, empty answer

**And** `log-notebook-query.mjs` is **not** modified.

### 6. Tests + verify (AC: tests)

**Then** `tests/hermes-notebook-query-skill.test.mjs` gains task-prompt contract tests (file currently has **no** task-prompt coverage) asserting:

- `terminal(` + `timeout=15` on log step
- `log-notebook-query.mjs` + env var names preserved
- `notebook_query_log` JSON contract documented in prompt
- silent warning line exact text (or stable substring)
- **no** “fire-and-forget” on log step (may remain elsewhere only if unrelated — log section must not use it)
- step order: **After** posting answer / **await** before turn end

**And** `tests/hermes-morning-digest-skill.test.mjs` updated for `timeout=15`, telemetry JSON, warning line, removal of fire-and-forget on post-post section.

**And** `bash scripts/verify.sh` passes.

### 7. Hermes install (AC: deploy)

**Then** operator (or dev) runs:

```bash
bash scripts/install-hermes-skill-notebook-query.sh
bash scripts/install-hermes-skill-morning-digest.sh
```

**And** `node scripts/assert-hermes-skill-install-gate.mjs` reports clean parity for the trio (54-1 gate).

## Tasks / Subtasks

- [x] **T1** Update `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` §5 (AC: 1, 3, 4, 5)
  - [x] Add `resolved_repo_root` + `shellQuote` helper reference (copy morning-digest pattern; steps 1–3 may keep `execute_code bash`)
  - [x] Replace log invocation with `terminal(command=..., workdir=resolved_repo_root, timeout=15)`
  - [x] Document await-before-turn-end; remove fire-and-forget from §5
  - [x] Add telemetry JSON + Discord warning rules
- [x] **T2** Update `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` post-post section (AC: 2, 3, 4)
  - [x] `timeout=15`; add telemetry + warning; remove fire-and-forget wording
- [x] **T3** Tests (AC: 6)
  - [x] `tests/hermes-notebook-query-skill.test.mjs` — new `describe('notebook-query task-prompt contracts')`
  - [x] `tests/hermes-morning-digest-skill.test.mjs` — extend 52-2 assertions
- [x] **T4** `bash scripts/verify.sh` + install scripts (AC: 7)
- [x] **T5** Code review (54-2): sync `SKILL.md` (notebook-query 1.0.2, morning-digest 1.2.1), stderr→status table in task-prompts, test assertions

## Dev Notes

### Architecture / data flow (unchanged backend)

```
Success path (notebook-query or morning-digest Vault context)
  → post Discord answer/digest  (unchanged)
  → terminal(log-notebook-query.mjs, timeout=15)  ← THIS STORY
  → stderr: {"notebook_query_log":{...}}
  → optional Discord warning if failed|timeout
  → Convex notebookQueries (51-2) → /trends panel (no dashboard changes)
```

### notebook-query: migrate **log step only** to `terminal`

Today steps 1–3 use `execute_code bash`; step 5 also uses bash. **Only step 5** moves to `terminal` so timeout and completion are first-class Hermes tool semantics (same as morning-digest Sources 1–4).

**Add to task-prompt** (before §1 or in §5 preamble) minimal shared helpers:

```text
resolved_repo_root = OMNIPOTENT_REPO || /home/christ/ai-factory/projects/Omnipotent.md
shellQuote(value) = "'" + String(value).replaceAll("'", "'\\''") + "'"
```

**Step 5 shape (normative):**

```text
terminal(
  command="LOG_SCRIPT=<shellQuote(log_script)> NOTEBOOK_QUERY=<shellQuote(question)> NOTEBOOK_ANSWER=<shellQuote(answer)> NOTEBOOK_ID=<shellQuote(route.id)> NOTEBOOK_TITLE=<shellQuote(route.title)> NOTEBOOK_DOMAIN=<shellQuote(route.domain or 'general')> node \"$LOG_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=15
)
```

Where `log_script` = `resolved_repo_root + "/scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs"` with installed fallback.

**After terminal returns:** parse exit status → emit `notebook_query_log` JSON line → if `failed`|`timeout`, post warning line.

### morning-digest delta

In `## Post-post — Log Vault context to Convex`:

| Before (52-2) | After (54-2) |
|---------------|--------------|
| `timeout=30` | `timeout=15` |
| “fire-and-forget; do not block…” | “await terminal; 15s cap; emit notebook_query_log; warning on failed\|timeout” |
| “ignore non-zero exit” | capture exit → telemetry + conditional warning |

Preserve: `NOTEBOOK_QUERY=winning_signal`, `answer_full` before Discord truncation, success-only guards, `shellQuote` on all dynamic env values.

### `log-notebook-query.mjs` behavior (read-only — do not edit)

| Exit | Meaning | `notebook_query_log.status` |
|------|---------|----------------------------|
| 0 + skip stderr | Missing Convex env | `skipped-env` |
| 0 + success | Row inserted | `ok` |
| 1 | Malformed env or HTTP error | `failed` |

Script path: `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`  
Convex mutation: `notebookQueries:logNotebookQuery` (51-2).

### close-report style vs session-close file

Session-close writes `.session-close/close-report.json` with `steps`, `nlm_auth`, etc. **This story does not add keys there.** “Close-report style” means:

- Single JSON object
- Stable field names
- No PII / secrets / full answers
- Suitable for operator grep in Hermes logs

### Anti-patterns (do not)

- Do **not** move log before Discord post (operator must see answer first).
- Do **not** increase log timeout above 15s without operator approval (brief is explicit).
- Do **not** fail the skill or edit the success message on log errors.
- Do **not** reintroduce “fire-and-forget” on the log step — that wording caused dropped steps.
- Do **not** modify `log-notebook-query.mjs`, Convex schema, or dashboard widgets.

### Test contract hints

**notebook-query** — add at end of `tests/hermes-notebook-query-skill.test.mjs`:

```js
const taskPromptPath = join(repoRoot, 'scripts/hermes-skill-examples/notebook-query/references/task-prompt.md');
// assert terminal + timeout=15 in §5, notebook_query_log, warning text, After posting, no fire-and-forget in log section
```

**morning-digest** — update existing `Story 52-2` test:

- Replace `fire-and-forget` assert with `timeout=15` + `notebook_query_log`
- Assert warning substring `Notebook history log failed`

### Files in scope

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` | UPDATE §5 + helpers |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE post-post |
| `tests/hermes-notebook-query-skill.test.mjs` | ADD task-prompt describe |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE 52-2 assertions |

### Out of scope

- `log-notebook-query.mjs`, `query-notebook.mjs`, `resolve-notebook.mjs`
- cns-dashboard / Convex schema
- `SKILL.md` version bumps (optional follow-up; not in operator file list)
- Operator Guide § edits (optional; mention 54-2 in completion notes if updated)
- Changing notebook-query steps 1–4 tool shape (`execute_code bash` OK)

## Previous story intelligence (54-1)

- **54-1** added `assert-hermes-skill-install-gate.mjs` — `diff -rq` on notebook-query / morning-digest / session-close. After editing task-prompts, **re-run install scripts** or parity gate fails.
- Install scripts for notebook-query / morning-digest still use `cp` without `--delete`; gate catches drift — do not expand to rsync in 54-2.

## Git intelligence

Recent lineage: `b3c957d` (54-1 skill install gate), `0007934` (notebook-query task-prompt §0 REFERENCE ONLY — prevents re-checking trigger). Follow **52-2** morning-digest post-post patterns for `shellQuote` and `answer_full` semantics.

## Latest technical notes (Hermes)

Hermes skills should use the **`terminal`** tool with an explicit `timeout` for subprocess steps that must complete before the agent turn ends. Morning-digest already documents `terminal(command, workdir, timeout)` — extend that contract to notebook-query **log step only** (Context7: `/nousresearch/hermes-agent`).

## Project context reference

- Verify gate: `bash scripts/verify.sh`
- Deferred: 52-2 review noted fire-and-forget + `timeout=30` as pre-existing — **54-2 closes that defer for log reliability**
- Dashboard panel: `NotebookQueryHistoryPanel` on `/trends` (51-2) — read-only consumer of `notebookQueries`

## References

- [Source: operator brief — Epic 54 / 54-2 Notebook query Convex log reliability]
- [Source: `51-2-notebook-query-history-log.md` — env vars, success-only, Convex table]
- [Source: `52-2-morning-digest-notebooklm-convex-log.md` — post-post pattern, `answer_full`, winning_signal]
- [Source: `54-1-skill-install-gate.md` — parity trio install + verify gate]
- [Source: `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` — current §5]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — post-post §]
- [Source: `tests/hermes-morning-digest-skill.test.mjs` — 52-2 contract tests]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 52-2 fire-and-forget defer]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- Test fixes: §5 contains `(not execute_code bash)` prose — assert `Via execute_code bash` absent, not bare substring.
- Morning-digest post-post uses `Do not edit` (capital D).

### Completion Notes List

- notebook-query §5: migrated Convex log to awaited `terminal(..., timeout=15)` with `shellQuote`, `notebook_query_log` telemetry, and conditional Discord warning.
- morning-digest post-post: `timeout=30` → `15`, removed fire-and-forget, added same telemetry/warning contract as notebook-query.
- Installed skills to `~/.hermes/skills/cns/`; `assert-hermes-skill-install-gate.mjs` clean; `bash scripts/verify.sh` passed.
- `log-notebook-query.mjs` and SKILL.md unchanged (per scope).

### File List

- `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md`
- `scripts/hermes-skill-examples/notebook-query/SKILL.md`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/hermes-notebook-query-skill.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-01: Story 54-2 — bounded awaited Convex log for notebook-query §5 and morning-digest post-post; task-prompt contract tests; closes 52-2 fire-and-forget defer for log step.
- 2026-06-01: Code review — SKILL.md sync (1.0.2 / 1.2.1), stderr→status mapping, strengthened tests; verify + install gate passed.

## Story completion status

- **Status:** done
- **Note:** Code review complete; operator choice B applied (SKILL.md in scope).

### Review Findings

- [x] [Review][Decision] **SKILL.md still contradicts awaited `terminal` log contract** — resolved: notebook-query 1.0.2 + morning-digest 1.2.1 synced; installed to `~/.hermes/skills/cns/`.

- [x] [Review][Patch] **Bind telemetry status to script stderr substrings** — resolved: stderr→status table in both task-prompts.

- [x] [Review][Patch] **notebook-query test missing `workdir` contract** — resolved.

- [x] [Review][Patch] **notebook-query test missing `log_script` fallback** — resolved.

- [x] [Review][Defer] **15s log timeout vs slow Convex** [`task-prompt.md`] — deferred, pre-existing risk class; operator brief explicitly caps at 15s (AC 1/2).

- [x] [Review][Defer] **Very large `NOTEBOOK_ANSWER` shell command length** [`task-prompt.md`] — deferred, inherited from 52-2 `shellQuote` env pattern; not introduced by 54-2.
