---
baseline_commit: b5ce0ed1c5f461c2da51982b6659dd71f2595a45
---

# Story 50.1: Notebook registry sync

Status: done

Epic: **50** (NotebookLM Full Integration)  
Tracked in sprint-status as: **`50-1-notebook-registry-sync`**

**Operator intent (this story):** Establish a machine-readable, repo-committed registry of all NotebookLM notebooks by shelling out to `nlm list notebooks --json`. Epic 50 routing, scoring, and watch-list automation will read **`scripts/session-close/lib/notebook-registry.json`** as the single source of truth (SSOT). No vault IO mutator changes; no Hermes skill changes in this story.

## Story

As an **operator**,  
I want **`npm run sync-notebooks` to refresh a structured JSON registry from the live NotebookLM account**,  
so that **Epic 50 automation can route queries, score notebooks, and honor watch flags without parsing markdown maps or hardcoding IDs**.

## Acceptance Criteria

1. **Sync script (AC: sync)**  
   **Given** `nlm` is installed, authenticated (`nlm login` completed), and network-reachable  
   **When** the operator runs `npm run sync-notebooks`  
   **Then** the repo executes `nlm list notebooks --json` (no `--quiet`; full objects required)  
   **And** writes **`scripts/session-close/lib/notebook-registry.json`** as a **JSON array** (top-level array, not wrapped in `{ notebooks: ... }`)  
   **And** each element includes exactly these fields:
   - `id` (string, from CLI `id`)
   - `title` (string, from CLI `title`)
   - `watch` (boolean; default `false` for new IDs)
   - `domain` (string; inferred from `title` when not already set on merge — see AC: merge)
   - `last_updated` (ISO-8601 string from CLI `updated_at` on sync, or `null` only for **brand-new** IDs on their first appearance in the registry file)

2. **Merge semantics (AC: merge)**  
   **Given** `notebook-registry.json` already exists  
   **When** sync runs again  
   **Then** entries are keyed by `id`  
   **And** existing `watch` values are **preserved** (operator toggles must survive re-sync)  
   **And** existing non-empty `domain` values are **preserved** (operator overrides beat inference)  
   **And** notebooks present in the file but **absent** from the latest `nlm` output are **removed** (registry mirrors live account; no stale IDs)  
   **And** new notebooks from `nlm` get `watch: false`, inferred `domain`, and `last_updated` set from CLI `updated_at` on first insert

3. **Domain inference (AC: domain)**  
   **When** `domain` must be inferred for a new notebook (or empty string on existing row)  
   **Then** apply **case-insensitive** substring rules on `title` in **first-match order** (implement in testable pure function):

   | If title contains | `domain` value |
   |-------------------|----------------|
   | `cns`, `vault`, `pake`, `brain` | `cns-brain` |
   | `ai factory`, `blueprint`, `architecting ai` | `ai-factory` |
   | `linkedin` | `linkedin` |
   | `directory`, `monetization`, `lead gen` | `lead-gen` |
   | `notebooklm`, `cursor`, `claude code`, `code with`, `tech with`, `tina huang`, `justin sung` | `learning` |
   | `nutrition`, `muscle`, `fat loss` | `health` |
   | *(no match)* | `general` |

   **And** normalize inferred domain to lowercase `[a-z0-9-]` only (no spaces).

4. **npm script (AC: npm)**  
   **When** shipped  
   **Then** `package.json` defines `"sync-notebooks": "node scripts/session-close/sync-notebooks.mjs"`  
   **And** `bash scripts/verify.sh` passes (lint, typecheck, all tests).

5. **Failure handling (AC: errors)**  
   **When** `nlm` is missing, exits non-zero, prints non-JSON, or auth fails  
   **Then** the sync script exits **non-zero**  
   **And** stderr includes an actionable hint (`nlm login` / install `notebooklm-mcp-cli`)  
   **And** does **not** truncate or overwrite `notebook-registry.json` with invalid JSON.

6. **Tests (AC: tests)**  
   **When** implementation completes  
   **Then** `tests/sync-notebooks.test.mjs` (Node test runner, same pattern as `tests/session-close-pipeline.test.mjs`) covers at minimum:
   - Domain inference table (unit tests on pure helper)
   - Merge: preserves `watch` + custom `domain`, drops removed IDs, adds new IDs
   - CLI adapter: mocked `nlm` JSON stdout → expected registry array (spawn mocked via injectable `runNlm` or temp fixture script — **do not** call live `nlm` in CI)  
   **And** no network required for `npm test`.

7. **Scope boundaries (AC: non-goals)**  
   **Then** this story does **not**:
   - Change `readNotebookLmTargets()` / session-close fan-out (still project map + `NOTEBOOKLM_NOTEBOOK_IDS`)
   - Add WriteGate or vault mutations
   - Commit secrets or profile tokens (registry is IDs + titles only)
   - Wire sync into `/session-close` cron (future Epic 50 story)

## Tasks / Subtasks

- [x] Add `scripts/session-close/lib/infer-notebook-domain.mjs` — pure `inferNotebookDomain(title)` (AC: domain)
- [x] Add `scripts/session-close/lib/sync-notebook-registry.mjs` — `mergeNotebookRegistry(existing, nlmRows)` + write helper (AC: merge)
- [x] Add `scripts/session-close/sync-notebooks.mjs` — CLI: spawn `nlm list notebooks --json`, parse, merge, write (AC: sync, errors)
- [x] Seed or document initial `notebook-registry.json` (AC: sync) — may be `[]` until first operator run; **commit** the file (not gitignored)
- [x] Add `sync-notebooks` npm script (AC: npm)
- [x] Add `tests/sync-notebooks.test.mjs` (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: npm)

## Dev Notes

### Why this path

| Concern | Choice |
|---------|--------|
| SSOT location | `scripts/session-close/lib/notebook-registry.json` — colocated with session-close / NotebookLM pipeline code (Epic 48) that will consume registry in later Epic 50 stories |
| CLI command | **`nlm list notebooks --json`** (verified 2026-05-29 on operator host). Context7 docs also mention `nlm notebook list`; use the subcommand that works in `nlm --help` → `list notebooks`. |
| Git | **Commit** registry JSON. Unlike `.session-close/`, this file is intentional operator-synced config for automation. |
| Testability | Split **spawn** (CLI) from **merge + infer** (pure functions) so tests never hit Google APIs. |

### Live `nlm` JSON shape (sample)

Observed fields per notebook (extra fields may appear; ignore unknown keys):

```json
{
  "id": "981466f0-de1c-4551-93a9-f3bc2a24b184",
  "title": "CNS Vault Architecture",
  "source_count": 32,
  "updated_at": "2026-05-28T15:52:05Z"
}
```

Map `updated_at` → registry `last_updated` on sync. Do not persist `source_count` in v1 schema (future story can extend).

### Relationship to existing NotebookLM surfaces

| Artifact | Role today | After 50-1 |
|----------|------------|------------|
| `03-Resources/NotebookLM-Project-Map.md` | Human/agent project → notebook **title** map | Unchanged; still valid for PAKE workflow |
| `readNotebookLmTargets()` in `read-sources.mjs` | session-close fan-out IDs | Unchanged in this story |
| `NOTEBOOKLM_NOTEBOOK_IDS` / `~/.hermes/session-close.env` | Override fan-out set | Unchanged |
| **`notebook-registry.json`** | *(new)* | SSOT for Epic 50 code paths |

### Implementation sketch

```text
sync-notebooks.mjs
  ├─ execFile('nlm', ['list', 'notebooks', '--json'])
  ├─ JSON.parse(stdout) → array
  ├─ read existing notebook-registry.json (or [])
  ├─ mergeNotebookRegistry(existing, nlmRows)
  └─ writeFile(registryPath, JSON.stringify(result, null, 2) + '\n')
```

Use `import { spawn } from 'node:child_process'` or `execFile` with maxBuffer large enough for ~100 notebooks. Set `utf8` encoding.

**Executable bit:** not required (invoked via `node`, like `prepare-context.mjs`).

### Domain inference vs project map

`NotebookLM-Project-Map.md` maps **projects** to notebook **titles** (no IDs in current vault copy). Registry maps **IDs** → metadata for automation. Optional cross-check (non-blocking): if a mapped title fuzzy-matches a registry `title`, future stories may set `domain` to project slug — **out of scope** for 50-1 except title heuristics above.

### Auth and CI

- Local/operator: requires `nlm login` (same as NotebookLM MCP server instructions).
- CI: tests use **fixtures only**; no `nlm` in verify gate.
- Optional manual step in completion record: operator runs `npm run sync-notebooks` once to populate real IDs (not required for green `verify.sh`).

### Project structure

| Path | Action |
|------|--------|
| `scripts/session-close/sync-notebooks.mjs` | NEW — CLI entry |
| `scripts/session-close/lib/infer-notebook-domain.mjs` | NEW |
| `scripts/session-close/lib/sync-notebook-registry.mjs` | NEW |
| `scripts/session-close/lib/notebook-registry.json` | NEW — committed SSOT (start `[]` or post-first-sync) |
| `package.json` | MODIFY — add `sync-notebooks` script |
| `tests/sync-notebooks.test.mjs` | NEW |

### Testing standards

- Follow `tests/session-close-pipeline.test.mjs`: `node:test`, `node:assert/strict`, isolated temp dirs where needed.
- `npm test` runs `test:node` glob `tests/*.test.mjs` — new file is auto-included.
- No Vitest required unless pure TS helpers added (prefer `.mjs` to match session-close stack).

### Architecture compliance

- **Spec-first:** No `specs/cns-vault-contract/` changes required (repo-local operator tooling).
- **Verify gate:** `bash scripts/verify.sh` mandatory before done.
- **WriteGate:** N/A — no `AI-Context/` writes.
- **Security:** Registry file must not include cookies, tokens, or email. IDs + titles only.

### Latest technical reference (Context7)

- Library: `/jacob-bd/notebooklm-mcp-cli` (NotebookLM MCP CLI)
- List command supports `--json`; re-auth via `nlm login`
- Pre-flight for operators: `nlm login --check || nlm login` before cron/automation (document in completion notes if adding operator doc touch — **optional**, not AC)

### Epic 50 forward context (do not implement here)

Planned follow-ons (backlog, not this story): watch-list driven fan-out, domain-based routing scores, session-close hook to run sync, deprecating markdown-only ID discovery. This story only delivers the SSOT file + manual sync command.

## References

- [Source: user story brief — Epic 50 / 50-1 Notebook registry sync]
- [Source: `scripts/session-close/lib/read-sources.mjs` — `readNotebookLmTargets`, project map parsing]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/NotebookLM-Project-Map.md` — title-level mappings]
- [Source: `_bmad-output/implementation-artifacts/10-1-notebooklm-vault-integration.md` — NotebookLM workflow baseline]
- [Source: `_bmad-output/implementation-artifacts/48-1-session-close-context-pack-scaffold.md` — session-close `lib/` layout pattern]
- [Source: Context7 `/jacob-bd/notebooklm-mcp-cli` — `list notebooks --json`, `nlm login`]
- [Source: `package.json` — npm script conventions (`vault:fast-scan`)]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- `bash scripts/verify.sh` — VERIFY PASSED (2026-05-29)

### Implementation Plan

- Split pure `inferNotebookDomain` / `mergeNotebookRegistry` from CLI spawn (`createRunNlm`, injectable `runNlmFn` for tests).
- Registry SSOT: top-level JSON array at `scripts/session-close/lib/notebook-registry.json` (committed `[]` until operator runs `npm run sync-notebooks`).
- Merge preserves `watch` and non-empty `domain`; drops IDs absent from latest `nlm` output; updates `last_updated` from CLI `updated_at`.

### Completion Notes List

- Shipped `npm run sync-notebooks` → `nlm list notebooks --json` with merge/write and actionable stderr on failure (no corrupt overwrite).
- Added `tests/sync-notebooks.test.mjs` (domain table, merge semantics, mocked CLI) — no network in CI.
- Optional operator step: run `nlm login` then `npm run sync-notebooks` once to populate real notebook IDs.

### File List

- `scripts/session-close/lib/infer-notebook-domain.mjs` (new)
- `scripts/session-close/lib/sync-notebook-registry.mjs` (new)
- `scripts/session-close/sync-notebooks.mjs` (new)
- `scripts/session-close/lib/notebook-registry.json` (new)
- `package.json` (modified)
- `tests/sync-notebooks.test.mjs` (new)

### Review Findings

- [x] [Review][Patch] AC5 failure path untested — `syncNotebookRegistry` should not overwrite `notebook-registry.json` when `runNlm` or JSON parse fails; add a test that seeds a registry file, forces failure, and asserts on-disk bytes unchanged. [`tests/sync-notebooks.test.mjs`]
- [x] [Review][Patch] Duplicate `id` rows in `nlm` output yield duplicate registry entries — `mergeNotebookRegistry` should dedupe by `id` (last row wins) before returning. [`scripts/session-close/lib/sync-notebook-registry.mjs`:36]
- [x] [Review][Patch] `readRegistry` accepts malformed array elements — entries missing `id` can pollute the `byId` map; filter or validate rows on read so merge only sees well-formed entries. [`scripts/session-close/sync-notebooks.mjs`:76]
- [x] [Review][Defer] Stable sort order for registry output — not required by AC; optional follow-up for diff-friendly commits. [`scripts/session-close/lib/sync-notebook-registry.mjs`] — deferred, pre-existing (nice-to-have)

## Change Log

- 2026-05-29: Story 50-1 — notebook registry sync CLI, merge/infer libs, tests, committed empty registry SSOT.
- 2026-05-29: Code review — 3 patch, 1 defer.
- 2026-05-29: Review patches applied (AC5 failure tests, nlm id dedupe, registry sanitize on read).

## Story completion status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **review**
