---
baseline_commit: 1285ba81c5fdbebe5e5004ddc778b066474bcd51
---

# Story 79-1: A4-0 — `pre_llm_call` inject probe (confirm-early)

Status: done

## Story

As an **operator**,
I want **a minimal `cns-brain-recall` plugin stub that returns `[brain-recall:probe]` on one live Hermes turn**,
so that **the ADR-HERMES-015 mutation contract is proven before recall production depends on it (A4-0 gate)**.

**Zone/Repo:** Omnipotent.md (`scripts/hermes-plugin-examples/cns-brain-recall/`, install script) → WSL `~/.hermes/plugins/` · **Branch:** `hermes-consolidation`

## Acceptance Criteria

1. **Context7 pre_llm_call contract (AC: context7)**
   - **Given** Context7 `resolve-library-id` + `query-docs` on `/nousresearch/hermes-agent` for `pre_llm_call` hook return shape
   - **When** implementation begins
   - **Then** stub returns `{"context": "[brain-recall:probe]"}` per Hermes docs

2. **Install + enable (AC: install)**
   - **When** `bash scripts/install-hermes-plugin-cns-brain-recall.sh` runs and `hermes plugins enable cns-brain-recall` runs
   - **Then** plugin is present under `~/.hermes/plugins/cns-brain-recall/`

3. **Live probe turn (AC: probe)**
   - **Then** one live `hermes chat` turn shows probe text in model-visible context (log excerpt or verbose capture)

4. **Protect-list clean (AC: nfr2)**
   - **And** protect-list files (`src/agents/*`, `run-chain.ts`, `scripts/run-chain.ts`) have zero diffs

5. **No core fork (AC: no-fork)**
   - **And** no edits under `~/.hermes/hermes-agent/`

6. **Evidence file (AC: evidence, NFR4)**
   - **And** `_bmad-output/implementation-artifacts/79-1-a4-0-inject-probe-evidence.md` records install output, redacted `hermes plugins list`, probe turn proof — no secrets

7. **Reversibility (AC: nfr5)**
   - **And** `hermes plugins disable cns-brain-recall` documented in evidence

8. **Verify gate (AC: nfr1)**
   - **And** `bash scripts/verify.sh` passes

## Tasks / Subtasks

- [x] **Context7 Hermes pre_llm_call docs** (AC: context7)
  - [x] `resolve-library-id` + `query-docs` on `/nousresearch/hermes-agent`
  - [x] Document return shape in Dev Agent Record

- [x] **Plugin stub + install script** (AC: install, no-fork)
  - [x] `scripts/hermes-plugin-examples/cns-brain-recall/` with `plugin.py`, `plugin.yaml`, `__init__.py`
  - [x] `scripts/install-hermes-plugin-cns-brain-recall.sh` copies to `~/.hermes/plugins/cns-brain-recall/`
  - [x] `references/config-snippet.md` for enable/disable

- [x] **Repo tests** (AC: nfr1)
  - [x] `tests/hermes/cns-brain-recall-plugin.test.ts` — source files, install script, hook return shape

- [x] **Live probe + evidence** (AC: probe, evidence, nfr5)
  - [x] Run install script + `hermes plugins enable cns-brain-recall`
  - [x] One `hermes chat -q` turn with probe visible in context
  - [x] Write `79-1-a4-0-inject-probe-evidence.md` with redacted output

- [x] **Verify gate** (AC: nfr1, nfr2)
  - [x] `bash scripts/verify.sh` passes
  - [x] Confirm protect-list paths unchanged

### Review Findings

- [x] [Review][Decision] No-core-fork AC is not currently self-proving — resolved by operator choice 2: accepted as unrelated/pre-existing and annotated in evidence with file, mtime `2026-06-21 03:23:47.900114252 +1000`, and the 79-1 touch boundary.
- [x] [Review][Patch] Installer ignores `HERMES_HOME` and can install to a plugin directory Hermes does not load [scripts/install-hermes-plugin-cns-brain-recall.sh:6]
- [x] [Review][Patch] Installer incrementally copies the source tree, retaining stale runtime files and propagating ignored Python bytecode [scripts/install-hermes-plugin-cns-brain-recall.sh:13]
- [x] [Review][Patch] Plugin tests import `plugin.py` directly but do not prove `__init__.py` and `register(ctx)` satisfy the Hermes loader path [tests/hermes/cns-brain-recall-plugin.test.ts:25]
- [x] [Review][Patch] Python import test writes `__pycache__` into the source tree and the install-script test only string-inspects the installer [tests/hermes/cns-brain-recall-plugin.test.ts:25]
- [x] [Review][Patch] Evidence omits the concrete Context7 resolve/query proof and post-restore repo-to-installed parity after the installed-only nonce probe [_bmad-output/implementation-artifacts/79-1-a4-0-inject-probe-evidence.md:13]

## Dev Notes

### Architecture

- ADR-HERMES-015: FR18 seam = `pre_llm_call` plugin `cns-brain-recall`; Honcho slot preserved.
- Hermes loads `plugin.yaml` + `__init__.py` with `register(ctx)`; repo keeps logic in `plugin.py` per architecture tree.
- `pre_llm_call` return `{"context": "..."}` injects into **user message** at API-call time only (ephemeral).

### References

- `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` — Story 79-1
- `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` — ADR-HERMES-015, A4-0 gate
- Context7 `/nousresearch/hermes-agent` — build-a-hermes-plugin, hooks.md

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor), 2026-06-26

### Implementation Plan

- Minimal probe stub only — no Brain index or prefetch CLI (Story 79-5).
- Install mirrors existing `install-hermes-skill-*.sh` pattern.
- `__init__.py` loads sibling `plugin.py` via `importlib` (bare `from plugin import` fails under Hermes module loader).

### Debug Log References

- `bash scripts/verify.sh` — PASS (2026-06-26)
- `bash scripts/verify.sh` — PASS after review patches (2026-06-25T20:55:49Z)
- Live probe session `20260626_020407_fa2139` — model quoted `[brain-recall:probe]`

### Completion Notes List

- Added `cns-brain-recall` Hermes plugin stub with `pre_llm_call` hook returning `{"context": "[brain-recall:probe]"}`.
- Install script copies repo source to `~/.hermes/plugins/cns-brain-recall/`.
- Live `hermes chat` turn confirmed probe marker in model-visible user message (A4-0 gate).
- Evidence file records install, enable/list, probe, disable — no secrets.
- Operator guide: no update required (internal probe stub; production wiring is Story 79-5).

### File List

- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py`
- `scripts/hermes-plugin-examples/cns-brain-recall/__init__.py`
- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.yaml`
- `scripts/hermes-plugin-examples/cns-brain-recall/references/config-snippet.md`
- `scripts/install-hermes-plugin-cns-brain-recall.sh`
- `tests/hermes/cns-brain-recall-plugin.test.ts`
- `_bmad-output/implementation-artifacts/79-1-a4-0-inject-probe.md`
- `_bmad-output/implementation-artifacts/79-1-a4-0-inject-probe-evidence.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Summary |
|------|---------|
| 2026-06-26 | A4-0 probe stub + install script + tests; live inject proof; evidence; verify PASS; status → review |
| 2026-06-26 | Review patches applied: `HERMES_HOME` installer, clean mirror replacement, loader-path tests, bytecode guard, Context7/parity evidence; verify PASS; status → done |
