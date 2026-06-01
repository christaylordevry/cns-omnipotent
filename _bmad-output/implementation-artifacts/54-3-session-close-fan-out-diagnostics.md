---
story_id: 54-3
epic: 54
title: session-close-fan-out-diagnostics
status: done
baseline_commit: ea98321
---

# Story 54.3: Session-close fan-out diagnostics

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **CNS operator**,  
I want **per-notebook `source_add` failures during `/session-close` to record `error_class`, export size, and a sanitized error snippet in `close-report.json`**,  
so that **I can root-cause NotebookLM fan-out failures (e.g. dc6abf1a / AI Factory Blueprint) without guessing from a generic `Could not add file source.` line**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 54: Hermes deployment parity & NotebookLM observability |
| **Predecessors** | **48-2** (`close-report.json` + `notebooklm_targets`), **50-7** (routing block in Discord), **53-1** (`nlm_auth` merge pattern), **54-1** (install gate + prune stale `task-prompt.md`), **54-2** (stderr→status telemetry discipline) |
| **Problem** | Operator reports `dc6abf1a` (AI Factory Blueprint) fails `source_add` on almost every session-close. Discord / close-report shows `error (Could not add file source.)` with **no** `error_class`, stderr, HTTP status, or file size — cannot distinguish size limit vs auth vs duplicate vs API flake. |
| **Phase** | Phase C is **Hermes MCP** (`mcp__notebooklm__source_add`), not `run-deterministic.mjs`. Phase A already writes `notebooklm_targets` with `{ notebook_id, title, export_path }` and `deterministic.export_bytes` on real close. |
| **Fix class** | Testable Node classifier + merge into `close-report.json` (mirror `nlm-auth-watchdog.mjs`), plus slim-skill + Discord template contract — **not** fixing the underlying NotebookLM failure. |

### Operator brief (binding)

- Capture **stderr** (and parseable HTTP status when present) from each `source_add` during session-close fan-out.
- Add **`error_class`** on failed per-notebook rows in `close-report.json`.
- Allowed classes: `size_limit`, `auth_error`, `duplicate_source`, `api_error`, `unknown`.
- Discord summary shows **`error_class`** next to failed notebooks.
- **Out of scope:** fixing the failure, Convex schema, cns-dashboard, Operator Guide (optional mention in completion notes only).

### Slim session-close router (do not regress)

- Active contract lives in `scripts/hermes-skill-examples/session-close/SKILL.md` (currently **1.0.8**).
- Router **must not** load `references/task-prompt.md` (`tests/hermes-session-close-skill.test.mjs` asserts `!body.includes("references/task-prompt")`).
- Add **`references/fanout-diagnostics.md`** for fan-out merge/classify contract — do **not** resurrect monolithic `task-prompt.md` (54-1 install prunes it).

## Acceptance Criteria

### 1. Per-notebook close-report fields (AC: report)

**Given** Phase A completed and `close-report.json` contains `notebooklm_targets[]` with at least one row  
**When** Hermes completes Phase C `source_add` fan-out for a target (success or failure)  
**Then** the matching row (same `notebook_id`) is updated in `close-report.json` with:

| Field | Success | Failure |
|-------|---------|---------|
| `fanout_status` | `ok` | `failed` |
| `error_class` | omitted or `null` | one of `size_limit`, `auth_error`, `duplicate_source`, `api_error`, `unknown` |
| `export_bytes` | number from `deterministic.export_bytes` at merge time, or `stat` fallback | same |
| `error_snippet` | omitted | sanitized stderr/message, **≤ 160 chars**, no secrets (reuse `sanitizeNlmAuthText` pattern from `nlm-auth-watchdog.mjs`) |
| `http_status` | omitted or `null` | integer when parseable from tool stderr (e.g. `HTTP 413`, `status code: 403`) |

**And** rows are **not** duplicated — merge updates in place on `notebook_id`.  
**And** no export file body, cookies, tokens, or full MCP JSON payloads are written to the report.

### 2. Error classification (AC: classify)

**Given** a failed `source_add` with combined stderr + error message text  
**When** `classifySourceAddError(text)` runs  
**Then** it returns one of the allowed `error_class` values using **first-match** ordered rules:

| Class | Match hints (case-insensitive; extend with operator-captured stderr from dc6abf1a) |
|-------|-------------------------------------------------------------------------------------|
| `size_limit` | `too large`, `size limit`, `file too big`, `exceeds`, `payload too large`, `413`, `request entity too large` |
| `auth_error` | `unauthenticated`, `not authenticated`, `login required`, `session expired`, `401`, `403`, `forbidden`, `unauthorized` |
| `duplicate_source` | `duplicate`, `already exists`, `already added` |
| `api_error` | `HTTP 5`, `502`, `503`, `504`, `internal server`, `service unavailable` |
| `unknown` | default when no rule matches (includes bare `Could not add file source.`) |

**And** classification is covered by **unit tests** with fixture strings (no live MCP).

### 3. Merge script (AC: merge)

**Given** `OMNIPOTENT_REPO` resolves to the repo root  
**When** the agent runs the merge helper after each fan-out result (or once with a batch JSON array)  
**Then** `scripts/session-close/merge-notebooklm-fanout.mjs` (name normative) updates `.session-close/close-report.json` without clobbering `steps`, `nlm_auth`, `notebooklm_routing`, or `failure_class`  
**And** on unreadable/missing report it exits **0** with stderr warning (same non-blocking posture as auth watchdog)  
**And** `hermes-run-merge-notebooklm-fanout.sh` wrapper exists if needed for Hermes `terminal` (nvm PATH), mirroring `hermes-run-nlm-auth-watchdog.sh`.

### 4. SKILL + reference contract (AC: skill)

**Given** real `/session-close` (not dry-run)  
**When** the agent performs NotebookLM fan-out per `SKILL.md`  
**Then** it:

1. Reads `notebooklm_targets` from `close-report.json` only (no re-derive from vault).
2. Calls `mcp__notebooklm__source_add` per row (`title: "My Knowledge Base"`, `wait: false` — unchanged).
3. After **each** call (or one batch at end), invokes merge helper with `notebook_id`, success/failure, and stderr text.
4. Does **not** retry on `ready: false` success (existing pitfall).

**And** `SKILL.md` references `references/fanout-diagnostics.md` for field shapes and merge CLI.  
**And** `version` in frontmatter bumps (e.g. **1.0.8 → 1.0.9**).  
**And** dry-run still skips `source_add` and does not write fan-out result fields.

### 5. Discord summary (AC: discord)

**When** rendering from `references/discord-reply-template.md`  
**Then** under `### NotebookLM targets`, each line includes:

- Success: `Title (short-id): ok`
- Failure: `Title (short-id): failed — error_class: <class>` (optional: `export_bytes`, `http_status` when present)

**And** aggregate `**notebooklm:**` line remains scannable (e.g. `2 ok, 1 failed (size_limit)`).  
**And** template rules still forbid raw stderr dumps in Discord.

### 6. Tests + verify (AC: tests)

**Then** `tests/notebooklm-fanout-diagnostics.test.mjs` (new) covers classifier + merge (temp close-report fixture).  
**And** `tests/hermes-session-close-skill.test.mjs` asserts:

- `fanout-diagnostics.md` exists
- `merge-notebooklm-fanout` (or documented script name) referenced in `SKILL.md`
- `error_class` documented
- fan-out diagnostics ordered **before** nlm auth watchdog (watchdog unchanged)

**And** `bash scripts/verify.sh` passes.  
**And** operator runs `bash scripts/install-hermes-skill-session-close.sh` after skill bump (54-1 parity gate).

### 7. Scope guards (AC: scope)

**Then** this story does **not**:

- Fix dc6abf1a / Blueprint notebook configuration or NotebookLM quotas
- Change Convex schema, `log-notebook-query.mjs`, or cns-dashboard
- Move fan-out into `run-deterministic.mjs` (optional future epic; not 54-3)
- Modify `AGENTS.md` or WriteGate paths
- Change `source_add` payload shape (`file_path`, `source_type`, notebook IDs)

## Tasks / Subtasks

- [x] **T1** `scripts/session-close/lib/classify-source-add-error.mjs` — export `classifySourceAddError`, `parseHttpStatus`, `sanitizeFanoutErrorText` (AC: 2)
- [x] **T2** `scripts/session-close/merge-notebooklm-fanout.mjs` + optional `hermes-run-merge-notebooklm-fanout.sh` (AC: 1, 3)
- [x] **T3** `scripts/hermes-skill-examples/session-close/references/fanout-diagnostics.md` — normative merge CLI, field table, MCP capture rules (AC: 4)
- [x] **T4** Update `SKILL.md` fan-out section + version bump; link reference (AC: 4)
- [x] **T5** Update `references/discord-reply-template.md` for `error_class` lines (AC: 5)
- [x] **T6** Tests: `tests/notebooklm-fanout-diagnostics.test.mjs` + extend `tests/hermes-session-close-skill.test.mjs` (AC: 6)
- [x] **T7** `bash scripts/verify.sh` + `bash scripts/install-hermes-skill-session-close.sh` (AC: 6)

## Dev Notes

### Architecture — where fan-out runs today

```
Phase A (deterministic, zero LLM)
  hermes-run-session-close.sh → run-deterministic.mjs
  → close-report.json: notebooklm_targets[], deterministic.export_bytes, notebooklm_routing

Phase B (LLM Section 8)
  gate-apply-section8.mjs

Phase C (Hermes MCP — THIS STORY)
  FOR each notebooklm_targets[]:
    mcp__notebooklm__source_add(...)
    → merge-notebooklm-fanout.mjs  ← NEW

Phase C½ (existing)
  hermes-run-nlm-auth-watchdog.sh → nlm_auth in close-report

Discord reply
  discord-reply-template.md ← show error_class
```

[Source: `scripts/hermes-skill-examples/session-close/SKILL.md`, `architecture-session-close-fr17-19.md`]

### Current `notebooklm_targets` row (Phase A only)

From `buildCloseReport` / pipeline tests:

```json
{
  "notebook_id": "00000000-0000-4000-8000-000000000001",
  "title": "T",
  "export_path": "/repo/scripts/output/vault-export-for-notebooklm.md"
}
```

After 54-3 failed example:

```json
{
  "notebook_id": "dc6abf1a-....",
  "title": "AI Factory Blueprint",
  "export_path": "/home/christ/ai-factory/projects/Omnipotent.md/scripts/output/vault-export-for-notebooklm.md",
  "fanout_status": "failed",
  "error_class": "size_limit",
  "export_bytes": 1847296,
  "http_status": 413,
  "error_snippet": "Could not add file source. HTTP 413 ..."
}
```

### Merge helper — recommended CLI shape

Mirror `nlm-auth-watchdog.mjs` single-row update pattern; support batch for fewer terminal round-trips:

```bash
node scripts/session-close/merge-notebooklm-fanout.mjs \
  --notebook-id "<uuid>" \
  --status ok|failed \
  --stderr "<sanitized-or-raw-for-classifier>"
```

Optional batch:

```bash
echo '[{"notebook_id":"...","status":"failed","stderr":"..."}]' | \
  node scripts/session-close/merge-notebooklm-fanout.mjs --batch
```

Implementation notes:

- Read `close-report.json` from `OMNIPOTENT_REPO/.session-close/close-report.json` (or `--report`).
- Set `export_bytes` from `report.deterministic.export_bytes` when number; else `stat(export_path).size` when file exists.
- Preserve all other top-level keys (spread merge like `mergeNlmAuthIntoCloseReport`).

[Source: `scripts/session-close/lib/nlm-auth-watchdog.mjs`:211-218]

### MCP `source_add` capture (Hermes agent)

Tool: `mcp__notebooklm__source_add` per `~/.hermes/config.yaml` registration (28-2).

Observed args (SKILL.md): `notebook_id`, `title: "My Knowledge Base"`, `source_type: "file"`, `file_path` from row `export_path`, `wait: false`.

On tool error, Hermes exposes **error message + stderr** in tool result — agent must pass **both** concatenated into merge `--stderr` for classification.

Do **not** log full `file_path` contents or MCP response bodies to Discord.

[Source: MCP descriptor `source_add.json`; `Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md`]

### Size limit context (operator triage)

Export script documents NotebookLM hints ~500K words / ~200MB — confirm in product UI.

```49:49:scripts/export-vault-for-notebooklm.sh
  echo "- **NotebookLM hints:** Google NotebookLM sources are often cited around ~500K words or ~200MB per source; confirm current limits in the product UI before upload."
```

When `export_bytes` is high and `error_class` is `size_limit`, operator can correlate without re-statting the file.

### Discord template delta (50-7 + 54-3)

Existing block:

```markdown
### NotebookLM targets

{{notebooklm_targets_lines}}
```

Normative line format after 54-3:

```markdown
- **AI Factory Blueprint** (`dc6abf1a…`): failed — error_class: size_limit (1.8 MB)
```

Keep `### Notebook routing` block (50-7) unchanged — orthogonal to per-target fan-out status.

### Anti-patterns (do not)

- Do **not** add `failure_class: notebooklm` for per-notebook fan-out failures — session-close stays **best-effort**; aggregate `failure_class` remains for Phase A export/tests/pipeline only unless operator explicitly expands policy later.
- Do **not** retry `source_add` on failure or on `ready: false` success.
- Do **not** write fan-out diagnostics from `run-deterministic.mjs` (no MCP there).
- Do **not** resurrect `references/task-prompt.md` or reference it from `SKILL.md`.
- Do **not** paste stderr into Discord — only `error_class` + optional compact bytes/status.

### Test contract hints

**`tests/notebooklm-fanout-diagnostics.test.mjs`**

```js
import { classifySourceAddError } from '../scripts/session-close/lib/classify-source-add-error.mjs';
// fixtures: size_limit 413, auth 401, duplicate, api 503, unknown generic message
// merge: temp dir, write minimal close-report, run merge CLI, assert row fields
```

**`tests/hermes-session-close-skill.test.mjs`** — new `describe('Story 54.3 fan-out diagnostics')`:

- `existsSync(fanout-diagnostics.md)`
- SKILL includes `merge-notebooklm-fanout` and `error_class`
- Order: fan-out merge instructions before `nlm auth watchdog`

### Files in scope

| File | Action |
|------|--------|
| `scripts/session-close/lib/classify-source-add-error.mjs` | **New** |
| `scripts/session-close/merge-notebooklm-fanout.mjs` | **New** |
| `scripts/session-close/hermes-run-merge-notebooklm-fanout.sh` | **New** (if PATH wrapper needed) |
| `scripts/hermes-skill-examples/session-close/references/fanout-diagnostics.md` | **New** |
| `scripts/hermes-skill-examples/session-close/SKILL.md` | Update fan-out + version |
| `scripts/hermes-skill-examples/session-close/references/discord-reply-template.md` | Update targets lines |
| `tests/notebooklm-fanout-diagnostics.test.mjs` | **New** |
| `tests/hermes-session-close-skill.test.mjs` | Extend |

### Files explicitly out of scope

| File | Reason |
|------|--------|
| `run-deterministic.mjs` | Phase A only; no MCP |
| `log-notebook-query.mjs`, Convex schema | 54-2 boundary |
| `../cns-dashboard/**` | operator brief |
| `references/task-prompt.legacy.md` | historical only |
| NotebookLM MCP server source | classify at Hermes boundary |

### Previous story intelligence (54-2)

- **Telemetry discipline:** structured JSON, grep-friendly, no secrets, short `reason` tokens — apply same to `error_snippet` / `error_class`.
- **stderr→status tables** in notebook-query/morning-digest task-prompts — mirror as **stderr→error_class** table in `fanout-diagnostics.md`.
- **Await/capture:** fan-out merge is synchronous per target (cheap JSON write); do not fire-and-forget merge script.
- **Install:** bump SKILL version; run `install-hermes-skill-session-close.sh`; 54-1 gate must stay green.

[Source: `_bmad-output/implementation-artifacts/54-2-notebook-query-convex-log-reliability.md`]

### Previous story intelligence (53-1)

- Watchdog runs **after** fan-out, **before** Discord reply; must not mask fan-out results — 54-3 fields must be written **before** watchdog runs.
- `sanitizeNlmAuthText` — reuse or extract shared sanitizer for fan-out snippets.
- Non-blocking: merge failures log to stderr and continue session-close.

[Source: `_bmad-output/implementation-artifacts/53-1-nlm-auth-watchdog.md`]

### Git intelligence

Recent commits:

- `ea98321` — 54-2: terminal telemetry for notebook-query/morning-digest Convex log
- `b3c957d` — 54-1: skill install gate + rsync prune
- Pattern: Hermes skill changes paired with contract tests in `tests/hermes-*-skill.test.mjs`

### Project context reference

- Constitution / WriteGate: no `AI-Context/AGENTS.md` edits in this story.
- Verify gate: `bash scripts/verify.sh` mandatory before done.
- Context7: not required for merge/classify logic; if touching NotebookLM MCP registration, use `/nousresearch/hermes-agent` only for Hermes tool names — fan-out uses existing `mcp__notebooklm__source_add`.

[Source: `project-context.md`, `CLAUDE.md`]

## References

- [Source: operator brief — Epic 54 / 54-3 session-close fan-out diagnostics]
- [Source: `_bmad-output/implementation-artifacts/48-2-session-close-deterministic-orchestrator.md` — close-report schema]
- [Source: `_bmad-output/implementation-artifacts/50-7-notebook-routing-report.md` — Discord routing block]
- [Source: `_bmad-output/implementation-artifacts/53-1-nlm-auth-watchdog.md` — merge-into-close-report pattern]
- [Source: `_bmad-output/implementation-artifacts/54-2-notebook-query-convex-log-reliability.md` — stderr classification tables]
- [Source: `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` — Phase A/B/C split]
- [Source: `scripts/hermes-skill-examples/session-close/SKILL.md`]
- [Source: `scripts/session-close/lib/nlm-auth-watchdog.mjs`]
- [Source: `Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md`]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- Batch merge CLI: guard `process.stdin.isTTY` to avoid hang when `--batch` runs without piped stdin.

### Completion Notes List

- Added `classifySourceAddError` (first-match rules), `parseHttpStatus`, and `sanitizeFanoutErrorText` (reuses `sanitizeNlmAuthText`).
- Added `merge-notebooklm-fanout.mjs` with single-row and `--batch` merge; non-blocking exit 0 on missing report.
- Session-close skill **1.0.9**: per-target merge after `source_add`, `references/fanout-diagnostics.md`, Discord template shows `error_class`.
- Installed skill to `~/.hermes/skills/cns/session-close`. `scripts/verify.sh` passes.

### File List

- `scripts/session-close/lib/classify-source-add-error.mjs` (new)
- `scripts/session-close/merge-notebooklm-fanout.mjs` (new)
- `scripts/session-close/hermes-run-merge-notebooklm-fanout.sh` (new)
- `scripts/hermes-skill-examples/session-close/references/fanout-diagnostics.md` (new)
- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `scripts/hermes-skill-examples/session-close/references/discord-reply-template.md`
- `tests/notebooklm-fanout-diagnostics.test.mjs` (new)
- `tests/hermes-session-close-skill.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-06-01: Story 54-3 created — session-close NotebookLM fan-out diagnostics (`error_class`, merge script, Discord template, contract tests).
- 2026-06-01: Implemented fan-out classifier, merge helper, skill 1.0.9, tests; status → review.
- 2026-06-01: Code review patches — batch/unknown-id stderr warnings, stat fallback test, stdin read timeout; status → done.

### Review Findings

- [x] [Review][Patch] Batch `--batch` with empty stdin no-ops silently [`scripts/session-close/merge-notebooklm-fanout.mjs`:157-178] — fixed: stderr + early exit when `--batch` and `updates.length === 0`.
- [x] [Review][Patch] Partial batch merge has no stderr when `notebook_id` missing [`scripts/session-close/merge-notebooklm-fanout.mjs`:99-109,173-197] — fixed: stderr when `mergedCount < updates.length`.
- [x] [Review][Patch] No test for `export_bytes` stat fallback [`tests/notebooklm-fanout-diagnostics.test.mjs`] — fixed: stat fallback unit test + CLI warning tests.
- [x] [Review][Defer] Broad `\bexceeds\b` size_limit rule [`scripts/session-close/lib/classify-source-add-error.mjs`:13] — deferred, pre-existing; bound by story AC2 hint table; rare misclassify on non-size "exceeds" strings.
