---
story_id: 86-1
epic: 86
title: session-close-project-status-ssot
status: done
zone: Omnipotent.md scripts/session-close
branch: hermes-consolidation
incident: HANDOFF-2026-07-05-session14-hermes-consolidation.md §0
predecessors: 48-1, 59-1, 76-1, 57-2
---

# Story 86.1: Derive session-close project status from sprint-status.yaml (SSOT)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->
<!-- Format locked: Option A (generalized) — operator 2026-07-05. -->

Epic: **86** (Session-close project status SSOT hotfix — 2026-07-05)  
Tracked in sprint-status as: **`86-1-session-close-project-status-ssot`**

## Story

As the **CNS operator running `/session-close`**,
I want **`project_status_line` derived from `sprint-status.yaml` instead of stale `CLAUDE.md` Phase Status text**,
so that **AGENTS.md §8 `### Project Status` and MEMORY.md CNS State never regress to years-old boilerplate on every close**.

## Problem statement (confirmed — do not re-investigate)

On **2026-07-05**, a real `/session-close` regressed `AGENTS.md` from **v2.1.47** (granular, accurate) to **v2.1.48** (stale boilerplate). Standalone `write-memory.mjs` against production paths produced the same garbage.

| Stage | Source | Stale output |
|-------|--------|--------------|
| `readProjectStatusLine` | `CLAUDE.md` `## Phase Status` first `Phase …` line | `Phase 6 complete. Epics 1–37 done. Epics 38 + 43 in progress` |
| `prepare-context.mjs` → `readSprintSnapshot` | passes above into `context-pack.json` / `section8-input.json` | `sprint.project_status_line` |
| Section 8 LLM + `write-memory.mjs` | faithfully renders input | AGENTS §8 + MEMORY CNS State polluted |

**Root cause (code-level, verified):**

```105:122:scripts/session-close/lib/read-sources.mjs
export async function readProjectStatusLine(repoRoot) {
  try {
    const claudePath = join(repoRoot, "CLAUDE.md");
    const raw = await readFile(claudePath, "utf8");
    // ... reads ## Phase Status, returns first "Phase " line ...
  } catch {
    // fall through
  }
  return "Phase 6 complete; active epics in sprint-status.yaml";
}
```

`readSprintSnapshot` already parses the real SSOT via `parseDevelopmentStatus(yaml)` (lines 43–60) and `buildActiveEpics(entries)` (lines 66–98), but **`project_status_line` bypasses that parser entirely**.

## Format Decision — LOCKED (Option A, generalized)

**Operator choice (2026-07-05):** Option A count summary, generalized for **N** in-progress epics.

**Format spec:**

- `{done} epics done; {n} in-progress ({comma-separated epic numbers, ascending})`
- Singular: `1 in-progress (78)` when exactly one epic is in-progress
- Zero in-progress: `{done} epics done; none in-progress`
- Epic numbers from `parseDevelopmentStatus` epic rows; strip `epic-` prefix; **no theme/comment parsing**

**Live SSOT output (2026-07-05):**

> `76 epics done; 2 in-progress (78, 86)`

Stale strings that must **never** appear: `Phase 6`, `1–37`, `Epics 38`, `43 in progress`

## Acceptance Criteria

### 1. SSOT-only derivation (AC: ssot)

**Given** `_bmad-output/implementation-artifacts/sprint-status.yaml` exists and parses  
**When** `readProjectStatusLine` runs (directly or via `readSprintSnapshot`)  
**Then** the returned line is derived **solely** from `parseDevelopmentStatus(yaml)` epic-key rows (`/^epic-\d+$/`)  
**And** **no read of `CLAUDE.md`** remains in `readProjectStatusLine` (remove `repoRoot`-based CLAUDE path entirely)  
**And** the fallback when yaml is missing/unparseable is a **neutral string** (e.g. `Sprint status unavailable`) — **not** Phase/CLAUDE-derived text

### 2. Token cap compatibility (AC: tokens)

**Given** `prepare-section8-input.mjs` enforces `truncateToTokens(project_status_line, 60)`  
**When** the derived line is emitted for current SSOT  
**Then** it fits within the existing **≤60-token** cap without truncation under the operator-selected format  
**And** no changes to `SECTION8_INPUT_TOKEN_LIMIT` or cap logic are required unless truncation would mangle meaning (document in Dev Agent Record if so)

### 3. Downstream propagation unchanged (AC: parity)

**Given** a successful Phase A context pack build  
**When** `context-pack.json` and `section8-input.json` are written  
**Then** `sprint.project_status_line` reflects the new derivation  
**And** `write-memory.mjs` continues to prefer pack `project_status_line` when present (no behavioral change beyond better input)  
**And** `sprint.active_epics` behavior is **unchanged**

### 4. Unit test with fixture (AC: test)

**Given** test fixtures built from inline sprint-status yaml fragments (no CLAUDE.md)

**When** `deriveProjectStatusLine(parseDevelopmentStatus(yaml))` runs

**Then** plural case: epics 1–86 with `epic-78` + `epic-86` in-progress → `84 epics done; 2 in-progress (78, 86)`  
**And** singular case: epics 1–82 with only `epic-78` in-progress → `81 epics done; 1 in-progress (78)`  
**And** both lines contain **none** of: `Phase 6`, `1–37`, `Epics 38`, `43 in progress`  
**And** tests live in `tests/session-close-pipeline.test.mjs` under `describe("session-close read-sources")`

### 5. Verify gate (AC: verify)

**When** implementation is complete  
**Then** `bash scripts/verify.sh` passes  
**And** if only `tests/vault-io/research-agent.test.ts` times out, re-run once (known flaky)

## Tasks / Subtasks

- [x] **T0 — Operator format selection** (AC: gate)
  - [x] Operator picked Option A (generalized for N in-progress)
  - [x] Recorded in Dev Agent Record
- [x] **T1 — Refactor `readProjectStatusLine`** (AC: #1, #2)
  - [x] Added `deriveProjectStatusLine(entries)`; `readProjectStatusLine(entries)` delegates
  - [x] Removed CLAUDE.md read; neutral fallback `Sprint status unavailable`
  - [x] `readSprintSnapshot(sprintPath)` uses parsed entries only (dropped unused `repoRoot`)
- [x] **T2 — Unit test** (AC: #4)
  - [x] Plural + singular + zero-in-progress cases in `session-close-pipeline.test.mjs`
- [x] **T3 — Verify** (AC: #5)
  - [x] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, cns-dashboard tests pass
  - [x] Full `verify.sh` blocked at pre-existing Hermes skill parity drift (`session-close/SKILL.md` repo vs `~/.hermes`) — unrelated to this change
- [ ] **T4 — Post-merge operator step** (out of scope for code)
  - [ ] Re-run full `/session-close` via Discord to heal AGENTS.md + MEMORY.md (WriteGate — do **not** hand-edit `AI-Context/`)

## Dev Notes

### Files to touch (UPDATE only)

| File | Change |
|------|--------|
| `scripts/session-close/lib/read-sources.mjs` | Added `deriveProjectStatusLine`; sync `readProjectStatusLine(entries)`; `readSprintSnapshot` SSOT-only |
| `scripts/session-close/prepare-context.mjs` | Drop unused `repoRoot` arg to `readSprintSnapshot` |
| `scripts/session-close/write-memory.mjs` | Drop unused `repoRoot` arg to `readSprintSnapshot` |
| `tests/session-close-pipeline.test.mjs` | Plural/singular/none in-progress tests + stale-marker assertions |

### Files that must NOT change

| Path | Reason |
|------|--------|
| `specs/cns-vault-contract/AGENTS.md` | WriteGate — healed by session-close after fix |
| `AI-Context/**`, vault `MEMORY.md` | Same |
| `src/agents/{synthesis,hook,boss}-adapter-llm.ts` | Protect-list |
| `src/agents/run-chain.ts`, `scripts/run-chain.ts` | Protect-list |
| `CLAUDE.md` | Stale Phase Status is a separate cleanup; **not** this story's SSOT |

### Implementation hints

**Reuse existing parser (do not duplicate):**

```43:60:scripts/session-close/lib/read-sources.mjs
export function parseDevelopmentStatus(yaml) { /* ... */ }
```

**Suggested signature refactor:**

```javascript
// Prefer synchronous — no file I/O inside:
export function deriveProjectStatusLine(entries, format = "A") { /* ... */ }

// readSprintSnapshot becomes:
const entries = parseDevelopmentStatus(yaml);
const project_status_line = deriveProjectStatusLine(entries, selectedFormat);
```

If Option B/C needs epic theme text, parse the comment on the same yaml line as `epic-N:` (regex after `# —` or `# Epic N —`). Do **not** add a new title registry file.

**Call chain (unchanged except input quality):**

```
prepare-context.mjs
  → readSprintSnapshot(sprintPath, repoRoot)
    → parseDevelopmentStatus + buildActiveEpics + deriveProjectStatusLine
  → buildSection8Input(pack)
    → enforceSection8InputBudget (60-token cap on project_status_line)
write-memory.mjs
  → projectStatusFromPack(pack) ?? sprint.project_status_line
```

**Stale fallback to remove:**

```javascript
return "Phase 6 complete; active epics in sprint-status.yaml"; // DELETE
```

**Neutral fallback example:**

```javascript
return "Sprint status unavailable"; // when yaml missing or zero epic keys parsed
```

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md`] `context-pack.json` schema field `sprint.project_status_line` remains; **source of truth** changes from CLAUDE.md to sprint-status.yaml (aligns with Epic 48 intent; SC-1 AC that said "consistent with CLAUDE.md" is **superseded** by this hotfix).
- [Source: `_bmad-output/implementation-artifacts/59-1-session-close-context-reduction.md`] `section8-input.json` still carries `sprint.project_status_line` — bounded field, no schema change.
- [Source: `_bmad-output/implementation-artifacts/28-1-automate-agents-md-section-8-via-hermes-session-close.md`] §8 must reflect sprint-status.yaml — this story fixes the deterministic input that the LLM was never meant to invent.

### Testing standards

- Follow existing `describe("session-close read-sources")` patterns in `tests/session-close-pipeline.test.mjs` (imports `parseDevelopmentStatus`, `buildActiveEpics` from read-sources.mjs).
- Use inline yaml string fixture — no dependency on live sprint-status.yaml (keeps test stable when tracker updates).
- Assert **negative** substrings (`Phase 6`, etc.) explicitly.

### Previous story intelligence

| Story | Relevant learning |
|-------|-------------------|
| **48-1** | Introduced `project_status_line` tied to CLAUDE.md — **wrong SSOT**; this story corrects that design debt. |
| **59-1** | Slim `section8-input.json`; `project_status_line` is a first-class bounded field — fix input, not LLM contract. |
| **76-1** | §8 must list only epics in `active_epics`; `project_status_line` is the narrative seed for `### Project Status` — stale seed poisons output even when `active_epics` is correct. |
| **57-2** | MEMORY.md reads `projectStatusLine` from pack/snapshot — same stale bug path. |
| **HANDOFF 2026-07-05** | Do not hand-run individual session-close scripts against production until this lands; full `/session-close` heals AGENTS + MEMORY. |

### Git intelligence

Recent session-close work on `hermes-consolidation` (Epic 76/81) did not touch `readProjectStatusLine`. The bug predates consolidation and survived because CLAUDE.md Phase Status was never wired to auto-sync.

### Library / framework requirements

None — plain Node ESM, existing test runner (`node --test`). No new dependencies.

### Project context reference

- Constitution WriteGate: [Source: `specs/cns-vault-contract/AGENTS.md`] — AGENTS mutations via session-close only.
- Verify gate: `bash scripts/verify.sh` mandatory before done claim.
- Deferred-work: consider logging MEMORY.md test-fixture corruption (HANDOFF §0 item 3) separately — **out of scope** unless operator expands.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Operator Format Selection

**Option A (generalized)** — `{done} epics done; {n} in-progress ({nums})` | zero → `none in-progress`

### Debug Log References

- Live SSOT check: `deriveProjectStatusLine(parseDevelopmentStatus(sprint-status.yaml))` → `76 epics done; 2 in-progress (78, 86)`

### Completion Notes List

- Exported `deriveProjectStatusLine` for direct unit testing; `readProjectStatusLine(entries)` remains thin alias
- Removed async CLAUDE.md path entirely; fallback is `Sprint status unavailable` when no epic rows parse
- `readSprintSnapshot` signature simplified to `(sprintPath)` — callers updated
- All 781 vitest + node session-close tests pass; lint/typecheck/build clean
- `verify.sh` Hermes skill parity gate fails on pre-existing `session-close/SKILL.md` drift (not introduced by this story)

### File List

- `scripts/session-close/lib/read-sources.mjs`
- `scripts/session-close/prepare-context.mjs`
- `scripts/session-close/write-memory.mjs`
- `tests/session-close-pipeline.test.mjs`
- `_bmad-output/implementation-artifacts/86-1-session-close-project-status-ssot.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story tracking only)

### Review Findings

Code review 2026-07-10 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). All 5 ACs verified MET against source; `bash scripts/verify.sh` PASSED (node 1409 + vitest 791, lint/typecheck/build, cns-dashboard, Hermes install-gate). Derivation logic confirmed correct (SSOT-only, comment-safe status match, singular/plural/none). No blockers, no majors, no decision-needed. Findings are LOW/non-AC polish — routed to a fast-follow patch, not blocking closure.

- [ ] [Review][Patch] Stale `@param {string} repoRoot` JSDoc on `readSprintSnapshot` after the param was dropped [scripts/session-close/lib/read-sources.mjs:559]
- [ ] [Review][Patch] Duplicate epic keys double-count in `deriveProjectStatusLine` — `parseDevelopmentStatus` pushes per matching line (no de-dupe), so two `epic-N:` rows count twice; asymmetric with `buildActiveEpics` which de-dupes via a Map (last-wins). Low likelihood (invalid YAML map / bad merge), silent wrong output. Fix: de-dupe last-wins before counting [scripts/session-close/lib/read-sources.mjs:108-129]
- [ ] [Review][Patch] `readProjectStatusLine(entries)` is now a dead export — zero callers, no test references it (only `deriveProjectStatusLine` is used). Remove it, or add a direct unit test if the alias is intended as public API [scripts/session-close/lib/read-sources.mjs:147-149]
- [ ] [Review][Patch] none-case test omits the stale-marker assertion loop present in the plural/singular tests (AC4-compliant, consistency only) [tests/session-close-pipeline.test.mjs]
- [x] [Review][Defer] Token-cap deep truncation (`token-estimate.mjs` ~20-token last resort) can cut the in-progress nums list mid-string — pre-existing mechanism, not introduced here, unreachable at current epic scale — deferred, pre-existing
- Dismissed (2): non-terminal epic statuses (review/backlog/cancelled) omitted from the tally — by ratified Option-A format (done count + in-progress list, not a census); un-migrated external caller TypeError — no callers of the old signatures exist (grep-confirmed).

## Story Completion Status

- **Status:** done
- **Ultimate context engine analysis completed** — implementation done, code review passed (2026-07-10), all ACs verified, verify.sh green
- **Review outcome:** 4 LOW patch items + 1 defer routed to fast-follow; closed done (deliverable complete against all ACs, no blocker/major)
- **Operator follow-up:** run `/session-close` via Discord to heal AGENTS.md §8 + MEMORY.md from the now-SSOT-derived `project_status_line`
