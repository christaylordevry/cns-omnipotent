---
baseline_commit: 94c6c75ce6c284adb7bd78c1c40443317b79a70d
---

# Story 79-5: Production `cns-brain-recall` plugin + prefetch CLI

Status: done

## Story

As an **operator**,
I want **cited Brain recall auto-injected on every Hermes turn via `pre_llm_call` plugin calling `brain-recall-prefetch.mjs`**,
so that **I stop invoking `brain:query` manually and vague questions get grounded context (FR18, ADR-HERMES-015)**.

**Zone/Repo:** Omnipotent.md (`scripts/brain-recall-prefetch.mjs`, plugin source, install script) → WSL `~/.hermes/plugins/` · **Branch:** `hermes-consolidation`

## Acceptance Criteria

1. **Production wiring (AC: wiring)**
   - **Given** Story 79-1 probe proven and Stories 79-3/79-4 complete (calibration pass or documented shadow waiver)
   - **When** production `plugin.py` subprocesses `brain-recall-prefetch.mjs` with JSON stdout `{ context, citations, channel, shadow }`
   - **Then** prefetch calls `buildRecallInjection` (79-3), replacing 79-1 probe stub

2. **Shadow mode gate (AC: shadow)**
   - **And** `shadow_mode: true` in policy logs would-inject payload to stderr, returns empty context (no live inject until 79-4 gate)

3. **Channel detection (AC: channel)**
   - **And** `nexus-voice` platform hint → `voice_pane`; yapped_text length heuristic only

4. **Honcho slot preserved (AC: adr-015)**
   - **And** no `MemoryProvider` registration for Brain

5. **Evidence + reversibility (AC: evidence, NFR4, NFR5)**
   - **And** evidence file with install, `hermes plugins list`, shadow probe, `diff -rq` parity, disable path

6. **Protect-list + no fork (AC: nfr2)**
   - **And** protect-list zero edits; no Hermes core fork

7. **Verify gate (AC: nfr1)**
   - **And** `bash scripts/verify.sh` passes

## Tasks / Subtasks

- [x] **Context7 pre_llm_call contract** (AC: wiring)
  - [x] `/nousresearch/hermes-agent` — `{"context": "..."}` inject shape confirmed

- [x] **brain-recall-prefetch.mjs + recall-prefetch-cli.ts** (AC: wiring, shadow, channel)
  - [x] `scripts/brain-recall-prefetch.mjs` → `src/brain/recall-prefetch-cli.ts`
  - [x] Calls `buildRecallInjection`; stdout JSON `{ context, citations, channel, shadow }`
  - [x] Shadow logs `[cns-brain-recall:shadow]` would-inject block to stderr

- [x] **Production plugin.py** (AC: wiring, shadow, adr-015)
  - [x] Subprocess prefetch CLI; shadow → `{}` (no inject); live context when `shadow_mode: false`
  - [x] `config/brain-recall-policy.json` set `shadow_mode: true` for this story

- [x] **Repo tests** (AC: nfr1)
  - [x] `tests/hermes/cns-brain-recall-plugin.test.ts` — loader path, subprocess contract, prefetch CLI, install

- [x] **Install + evidence** (AC: evidence, nfr5)
  - [x] `bash scripts/install-hermes-plugin-cns-brain-recall.sh`
  - [x] Shadow probe + `diff -rq` parity in evidence file
  - [x] `hermes plugins disable cns-brain-recall` documented

- [x] **Verify gate** (AC: nfr1, nfr2)
  - [x] `bash scripts/verify.sh` passes

### Review Findings

- [x] [Review][Patch] PREFETCH_TIMEOUT_S=45 too long for per-turn hook — tightened to policy/env 5s standard / 3s nexus-voice [`plugin.py`, `config/brain-recall-policy.json`]
- [x] [Review][Patch] recall_hook must fail-open on all exceptions — wrapped body in try/except Exception → `{}`; TimeoutExpired/OSError in `_run_prefetch` [`plugin.py:167-201`]
- [x] [Review][Patch] Resolve node binary robustly (CNS_NODE_BIN / NVM) for gateway PATH [`plugin.py:_resolve_node_bin`]
- [x] [Review][Patch] Confirm pre_llm_call passes user_message — Context7 signature + real hook subprocess test in evidence [`79-5-brain-recall-plugin-evidence.md`]
- [x] [Review][Defer] Per-turn cold-start + index load + Portal embed latency — measure at 79-4 live cutover; consider persistent helper [`plugin.py`] — deferred, forward flag for live cutover

## Dev Notes

### Architecture

- ADR-HERMES-015: FR18 seam = `pre_llm_call` → `brain-recall-prefetch.mjs` → `buildRecallInjection`
- Shadow mode (FR19): policy `shadow_mode: true` until 79-4 calibration pass or operator waiver
- Env: `CNS_OMNIPOTENT_ROOT`, `CNS_BRAIN_INDEX_PATH`, `CNS_VAULT_ROOT`, `CNS_BRAIN_EMBEDDER`, `CNS_NODE_BIN`, prefetch timeout env overrides
- In-repo-with-install: `scripts/hermes-plugin-examples/cns-brain-recall/` → `~/.hermes/plugins/`

### References

- `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` — Story 79-5
- `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` — ADR-HERMES-015, prefetch flow
- Context7 `/nousresearch/hermes-agent` — pre_llm_call return contract

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor), 2026-06-26

### Implementation Plan

- Replace 79-1 probe stub with production `plugin.py` subprocess to `brain-recall-prefetch.mjs`.
- TS CLI wraps `buildRecallInjection` (79-3); policy `shadow_mode: true` for safe wiring pre-79-4 gate.
- Tests exercise Hermes loader `register()` path and prefetch JSON contract.

### Debug Log References

- `npm run test:vitest -- tests/hermes/cns-brain-recall-plugin.test.ts` — 12/12 pass (incl. hook e2e + fail-open)
- `bash scripts/verify.sh` — PASS (2026-06-26, post code-review patches)
- Shadow probe — stdout `context:null`, stderr `[cns-brain-recall:shadow]` with cited vault block

### Completion Notes List

- Added `src/brain/recall-prefetch-cli.ts` and `scripts/brain-recall-prefetch.mjs` calling `buildRecallInjection`.
- Production `plugin.py` subprocesses prefetch CLI; respects shadow_mode (logs, no inject).
- Policy `shadow_mode: true` until 79-4 calibration gate enables live injection.
- Updated plugin tests for loader path, shadow/live hook behavior, prefetch wrapper, install parity.
- Code review patches: 5s/3s prefetch timeouts (policy+env), fail-open hook wrapper, CNS_NODE_BIN/NVM node resolution, hook e2e user_message probe in evidence.

### File List

- `scripts/brain-recall-prefetch.mjs`
- `src/brain/recall-prefetch-cli.ts`
- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py`
- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.yaml`
- `scripts/hermes-plugin-examples/cns-brain-recall/references/config-snippet.md`
- `config/brain-recall-policy.json`
- `tests/hermes/cns-brain-recall-plugin.test.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/79-5-production-cns-brain-recall-plugin-prefetch-cli.md`
- `_bmad-output/implementation-artifacts/79-5-brain-recall-plugin-evidence.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Summary |
|------|---------|
| 2026-06-26 | Code review — timeout/fail-open/node resolution/user_message probe; 12 tests; verify PASS; status → done |
| 2026-06-26 | Story 79-5 — production plugin + prefetch CLI; shadow_mode true; tests + evidence; verify PASS; status → review |
