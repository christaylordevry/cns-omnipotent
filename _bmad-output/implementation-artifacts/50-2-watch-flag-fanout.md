---
baseline_commit: ca642b74d9d0257232cc6021fd331ca8f3ac2a1c
---

# Story 50.2: Watch-flag fanout

Status: done

Epic: **50** (NotebookLM Full Integration)  
Tracked in sprint-status as: **`50-2-watch-flag-fanout`**

**Operator intent:** Use `notebook-registry.json` (Story 50-1 SSOT) to drive session-close NotebookLM fan-out when `NOTEBOOKLM_NOTEBOOK_IDS` is unset — only notebooks with `watch: true` are targeted.

## Story

As an **operator**,  
I want **session-close to fan out vault exports to watch-flagged notebooks from the committed registry**,  
so that **I can toggle fan-out membership via `watch` without editing env vars or the project map**.

## Acceptance Criteria

1. **Resolution order (AC: order)**  
   **Given** `readNotebookLmTargets(vaultRoot, exportPath)`  
   **When** resolving fan-out targets  
   **Then** precedence is unchanged for env: `NOTEBOOKLM_NOTEBOOK_IDS` (process env, then `~/.hermes/session-close.env`) wins when non-empty  
   **And** when env IDs are empty, load `scripts/session-close/lib/notebook-registry.json`  
   **And** if the registry contains **one or more** entries with `watch: true`, return **only** those entries (by `id`)  
   **And** each target includes `notebook_id`, `title` (from registry), and file-upload fields matching env override shape: `source_name: "CNS Vault Export"`, `source_type: "file"`, `file_path: exportPath`  
   **And** if the registry is missing, empty, or has no `watch: true` rows, fall through to `NotebookLM-Project-Map.md` parsing (current behavior)

2. **Registry IO reuse (AC: io)**  
   **Then** registry load reuses Story 50-1 sanitization (`sanitizeRegistryEntry` / `readRegistry`) — no duplicate parse logic in `read-sources.mjs`

3. **Tests (AC: tests)**  
   **Then** `tests/session-close-pipeline.test.mjs` (or dedicated test file) covers: env override still wins; watched registry IDs returned with export metadata; empty watch list falls back to project map fixture; missing registry file falls back

4. **Scope boundaries (AC: non-goals)**  
   **Then** this story does **not**: run `sync-notebooks` in session-close; change domain inference; add MCP tools; mutate vault files

5. **Verify gate (AC: verify)**  
   **Then** `bash scripts/verify.sh` passes

## Tasks / Subtasks

- [x] Wire registry watch-flag into `readNotebookLmTargets` (AC: order, io)
- [x] Add tests (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: verify)

## Dev Notes

- Depends on Story 50-1: `notebook-registry.json`, `readRegistry`, `sanitizeRegistryEntry` in `sync-notebooks.mjs`
- `prepare-context.mjs` already calls `readNotebookLmTargets`; no Hermes skill change required for Phase A pack IDs

## References

- [Source: `50-1-notebook-registry-sync.md` — SSOT + forward context]
- [Source: `scripts/session-close/lib/read-sources.mjs` — `readNotebookLmTargets`]
- [Source: `tests/session-close-pipeline.test.mjs` — env override tests]

## Dev Agent Record

### Agent Model Used

Composer

### Completion Notes List

- `readNotebookLmTargets` resolves env IDs first, then `watch: true` registry rows (with export upload metadata), then project map.
- Optional `registryPath` on third arg for tests; production uses `DEFAULT_REGISTRY_PATH` from Story 50-1.
- `notebookTargetsFromWatchRegistry` exported for unit tests.

### File List

- `scripts/session-close/lib/read-sources.mjs` (modified)
- `tests/session-close-pipeline.test.mjs` (modified)

### Review Findings

- [x] [Review][Defer] Missing-registry ENOENT fallback untested — AC: tests cites missing file; `readRegistry` returns `[]` so behavior is correct; add a one-case test when convenient. [`tests/session-close-pipeline.test.mjs`] — deferred, operator accepted implementation as-is
- [x] [Review][Defer] `read-sources.mjs` imports CLI module `sync-notebooks.mjs` for `readRegistry` — consider `lib/notebook-registry-io.mjs` if CLI surface grows. [`scripts/session-close/lib/read-sources.mjs`:5] — deferred, no functional issue today

## Change Log

- 2026-05-29: Story 50-2 — watch-flag fanout in session-close target resolution.
- 2026-05-29: Renamed story key `50-2-watch-flag-fanout`; accepted as-is (operator).
- 2026-05-29: Code review — clean (2 defer), verify passed.
