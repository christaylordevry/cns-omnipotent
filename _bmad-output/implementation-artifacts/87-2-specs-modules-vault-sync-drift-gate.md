---
story_id: 87-2
epic: 87
title: specs-modules-vault-sync-drift-gate
status: done
baseline_commit: 59fe78cfe8fa6376063aa0d6dfbf2c2c0ed4f0a
zone: Omnipotent.md repo hygiene + session-close + verify gate
branch: hermes-consolidation
predecessors: 87-1, 48-4, 6-3
related_deferred: deferred-work.md §AGENTS.md line-ending flip-flop (LF pin already in .gitattributes — apply on module copy)
canonical_vault_modules: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/
---

# Story 87.2: Keep specs/ constitution mirror auto-synced + drift-gated

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

Epic: **87** (Constitution mirror dedup — stop tracking stale `Knowledge-Vault-ACTIVE/AI-Context/` copies)  
Tracked in sprint-status as: **`87-2-specs-modules-vault-sync-drift-gate`**  
**Depends on:** `87-1-untrack-vault-ai-context-constitution-duplicates` (11-file byte-clean mirror established)

## Story

As a **CNS maintainer**,
I want **`specs/cns-vault-contract/modules/` to stay byte-identical to the canonical vault modules tree via session-close auto-sync and a verify-gate parity test**,
so that **new, edited, or removed vault modules never silently drift out of the git-tracked mirror** (closing the gap 87-1 left open).

## Problem statement (confirmed — do not re-investigate)

Story **87-1** made `specs/cns-vault-contract/modules/` an exact copy of `$CNS_VAULT_ROOT/AI-Context/modules/` (11 files). Ongoing guardrails are still missing:

| Mechanism | AGENTS.md | modules/ |
|-----------|-----------|----------|
| Session-close auto-sync | ✅ `apply-section8.mjs` byte-syncs vault ↔ specs each close | ❌ none |
| Verify parity test | ✅ planning mirror vs specs (hardcoded) | ❌ only hardcoded existence list in `tests/constitution.test.mjs` — never compares to live vault |

**Gap:** Operator edits a vault module → specs mirror stale → agents/CI load outdated policy until someone manually copies.

## SSOT principle (LOCKED — inherited from 87-1)

```text
Real vault  AI-Context/modules/  →  SSOT (runtime)
     ↓ mirror exactly (git + session-close sync)
specs/cns-vault-contract/modules/  →  git-tracked mirror
```

**Direction:** vault → specs only (same as 87-1 one-time sync). Never push specs changes back to vault via this script.

## Out of scope (explicit)

- **AGENTS.md §1–7 / §8 body edits** — WriteGate; do not modify `apply-section8.mjs` or its AGENTS sync path
- **§7 Active Modules registration** for `hermes-desktop`, `run-chain`, `two-bot-vault-boundary`, `memory-pillars-verification` — separate operator WriteGate task
- **Personas sync** — not in this story
- **`vault-lint.md`** — lives at spec root (87-1); not part of modules mirror

## Acceptance Criteria

### AC#1 — Auto-sync (vault → specs)

**Given** canonical vault `$CNS_VAULT_ROOT/AI-Context/modules/` exists  
**When** session-close Phase A runs (real close, not dry-run)  
**Then** a new step invokes `scripts/session-close/lib/sync-vault-modules.mjs` (or thin wrapper) that makes `specs/cns-vault-contract/modules/` an **exact mirror**:

- **File set identical:** adds new vault modules, removes specs-only files not in vault
- **Content byte-identical** after LF normalization on write (see Dev Notes)
- Respects `.gitattributes` LF policy for `specs/cns-vault-contract/**/*.md`

**And** `--dry-run` on the sync script performs diff/preview only — **no writes** to specs or vault  
**And** session-close dry-run skips the sync step (same pattern as export/tests/memory)  
**And** `npm run sync-vault-modules` exists for ad-hoc operator use (mirrors `sync-notebooks` pattern)  
**And** `close-report.json` records `steps.sync_vault_modules` with `{ status, message }`  
**And** sync runs **before** `npm test` in Phase A so tests see post-sync state

### AC#2 — Drift gate (verify.sh via test)

**Given** `$CNS_VAULT_ROOT/AI-Context/modules/` is reachable  
**When** `npm test` runs (and therefore `bash scripts/verify.sh`)  
**Then** `tests/constitution.test.mjs` (or dedicated test file imported by it) asserts:

- Same file set (no extras, no missing)
- Byte-identical content per file (`vault-io.md` … `mcp-operator-runbook.md` — all 11)

**And** on mismatch, test **fails** with a message listing divergent files (added / removed / content diff) and pointing to:

```bash
npm run sync-vault-modules
```

**And** when `CNS_VAULT_ROOT` is unset **or** `$CNS_VAULT_ROOT/AI-Context/modules/` does not exist, the vault parity assertion is **skipped** (test passes with explicit skip reason) — same conditional pattern as `verify.sh` cns-dashboard sibling skip

### AC#3 — Prove it (automated + manual evidence)

**Given** a temp fixture vault with intentional module divergence  
**When** parity helper runs against fixture vs a stale specs copy  
**Then** (a) gate **FAILS** naming the divergent file(s)  
**And** (b) after `runSyncVaultModules({ dryRun: false })`, `diff -qr` between vault modules and specs modules is **empty**

**Manual evidence (document in Dev Agent Record):**

```bash
# 1. Touch a vault module (operator machine with live vault)
echo "<!-- drift probe -->" >> "$CNS_VAULT_ROOT/AI-Context/modules/security.md"
bash scripts/verify.sh   # expect FAIL on modules parity
npm run sync-vault-modules
bash scripts/verify.sh   # expect PASS
git checkout -- specs/cns-vault-contract/modules/security.md  # revert probe if needed
```

### AC#4 — verify green

**When** implementation ships  
**Then** `bash scripts/verify.sh` exit code **0** with live vault present (87-1 left mirror clean — gate should be green after sync step lands)

## Tasks / Subtasks

- [x] **Implement sync module** (AC#1): `scripts/session-close/lib/sync-vault-modules.mjs`
  - [x] Export `resolveVaultModulesPaths({ repoRoot, vaultRoot })` using `resolvePaths()` from `paths.mjs`
  - [x] Export `compareVaultModulesMirror(vaultDir, specsDir)` → `{ ok, added, removed, changed }`
  - [x] Export `runSyncVaultModules({ dryRun, repoRoot, vaultRoot })` — copy vault → specs, delete extras, normalize LF on write
  - [x] CLI entry: `scripts/session-close/sync-vault-modules.mjs` with `--dry-run` flag (thin wrapper acceptable)
- [x] **Wire Phase A** (AC#1): `scripts/session-close/run-deterministic.mjs`
  - [x] Add step after `prepare_context`, before `export` (or immediately before `tests`)
  - [x] Real close: call sync; dry-run: `steps.sync_vault_modules = skipped`
  - [x] On sync failure: set `failureClass` appropriately; do not block partial close artifacts
- [x] **npm script** (AC#1): `package.json` → `"sync-vault-modules": "node scripts/session-close/sync-vault-modules.mjs"`
- [x] **Drift gate test** (AC#2): extend `tests/constitution.test.mjs` or add `tests/vault-modules-parity.test.mjs`
  - [x] Reuse/compare helper from sync lib (DRY — do not duplicate diff logic)
  - [x] Conditional skip when vault path unavailable
  - [x] Actionable failure message with `npm run sync-vault-modules` hint
- [x] **Fixture divergence tests** (AC#3): in same test file using `node:test` + temp dirs under `tests/fixtures/` or `os.tmpdir()`
- [x] **Session-close pipeline test** (AC#1): extend `tests/session-close-pipeline.test.mjs` — sync step recorded, dry-run skips writes
- [x] **Verify** (AC#4): `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] Skip modules sync when `usingRepoVaultFallback` is active [`scripts/session-close/run-deterministic.mjs:706`] — Fixed via `runSessionCloseVaultModulesSync` skip when repo vault fallback active.

- [x] [Review][Patch] Abort sync when vault modules dir is empty but specs mirror has files [`scripts/session-close/lib/sync-vault-modules.mjs:145`] — Empty-vault guard throws before destructive delete.

- [x] [Review][Patch] Use `rm(..., { force: true })` for orphan removal [`scripts/session-close/lib/sync-vault-modules.mjs:175`] — Applied.

- [x] [Review][Patch] Add pipeline test: real-mode sync skipped when repo vault fallback active [`tests/session-close-pipeline.test.mjs`] — Added fallback skip tests in pipeline + parity suites.

- [x] [Review][Defer] `apply-section8.mjs` edited in commit `4d4902e` (87-1 review bundle) — violates story hard constraint #2 but is out of 87-2 file scope; track under 87-1 follow-up.

- [x] [Review][Defer] `resolveLiveVaultModulesDir` reads `~/.hermes/session-close.env` when process env unset — intentional hotfix (Completion Notes); deviates from AC#2 literal "CNS_VAULT_ROOT unset → skip" wording but functionally correct on operator machines.

**Suggested commits:** (1) sync lib + npm script + unit tests, (2) run-deterministic wiring + pipeline test, (3) constitution parity gate + fixture proof tests

## Dev Notes

### Hard constraints

1. **Spec-first** — read `specs/cns-vault-contract/README.md` mirror model (87-1)
2. **Do NOT edit `apply-section8.mjs`** or AGENTS sync behavior
3. **No AGENTS §1–7 / §8 edits** — WriteGate
4. **No new npm packages** unless >14 days old and justified
5. **Small commits** — one logical change each
6. **LF on write** — vault files on `/mnt/c/...` may be CRLF; specs mirror must be LF per `.gitattributes` and constitution §3. Normalize on copy: read UTF-8, replace `\r\n` → `\n`, write LF. Parity test compares normalized bytes OR compares after same normalization — document choice in Completion Notes.

### Expected 11-file inventory (SSOT)

Same list as 87-1 — parity gate must not hardcode a different set:

1. `vault-io.md`
2. `security.md`
3. `note-style-guide.md`
4. `notebooklm-workflow.md`
5. `hermes-desktop.md`
6. `run-chain.md`
7. `two-bot-vault-boundary.md`
8. `memory-pillars-verification.md`
9. `routing.md`
10. `mobile-posture.md`
11. `mcp-operator-runbook.md`

**Not in modules/:** `vault-lint.md` (spec root only)

### Files to READ before editing (current state)

| File | Current behavior | This story changes |
|------|------------------|-------------------|
| `scripts/session-close/lib/paths.mjs` | Resolves `repoRoot`, `vaultRoot`, `agentsPath`, `repoAgentsPath` | **Optional:** add `vaultModulesPath` / `repoModulesPath` helpers — do not break existing exports |
| `scripts/session-close/run-deterministic.mjs` | Phase A: prepare_context → export → fast_scan → tests → memory → daily_rhythm | **Add** `sync_vault_modules` step before tests |
| `scripts/session-close/apply-section8.mjs` | Byte-sync AGENTS vault ↔ specs on §8 apply | **Do not touch** |
| `tests/constitution.test.mjs` | Hardcoded 11-file existence + vault-lint root placement | **Extend** with live vault byte parity (conditional skip) |
| `scripts/verify.sh` | Runs `npm test` (constitution tests included); skips cns-dashboard if missing | **No change required** if parity lives in npm test — optional echo line only |
| `package.json` | Has `sync-notebooks` precedent | **Add** `sync-vault-modules` |
| `.gitattributes` | `specs/cns-vault-contract/**/*.md text eol=lf` | **No change** — sync must honor |

### Implementation pattern — mirror `apply-section8.mjs` + directory sync

**AGENTS sync pattern (reference only — do not modify):**

```145:180:scripts/session-close/apply-section8.mjs
  const targets = [
    { label: "repo", path: paths.repoAgentsPath },
    { label: "vault", path: paths.agentsPath },
  ];
  // ... dry-run writes preview only; real run writeFile to each target with rollback
```

**Directory sync algorithm (vault → specs):**

1. Resolve `vaultModules = join(vaultRoot, "AI-Context", "modules")` and `specsModules = join(repoRoot, "specs/cns-vault-contract/modules")`
2. If vault modules dir missing → throw clear error (session-close) / skip (parity test when env absent)
3. List basenames in both dirs (files only, `.md` or all files — vault uses `.md` only today)
4. For each vault file: read, normalize LF, write to specs path (create parent dirs)
5. Delete specs files not present in vault set
6. Return `{ added, updated, removed, dryRun }`

**Dry-run:** compute diff only; optionally write report to `.session-close/modules-sync-preview.json` (optional — not required if stdout is sufficient)

### paths.mjs vault resolution (reuse, do not duplicate)

```64:98:scripts/session-close/lib/paths.mjs
export function resolvePaths(overrides = {}) {
  // CNS_VAULT_ROOT → DEFAULT_CNS_VAULT_ROOT → vaultFallbackUnderRepo(repoRoot)
  return {
    repoRoot,
    vaultRoot,
    agentsPath: join(vaultRoot, "AI-Context", "AGENTS.md"),
    repoAgentsPath: join(repoRoot, "specs/cns-vault-contract/AGENTS.md"),
    // ADD: vaultModulesPath, repoModulesPath
  };
}
```

Note: `vaultFallbackUnderRepo` uses tracked `vault-fast-scan-index.md` marker (87-1) — sync should use the same resolved `vaultRoot`, not a separate path.

### Conditional skip pattern (match verify.sh / cns-dashboard)

```59:73:scripts/verify.sh
CNS_DASHBOARD_ROOT="${CNS_DASHBOARD_ROOT:-${REPO_ROOT}/../cns-dashboard}"
if [[ -f "${CNS_DASHBOARD_ROOT}/package.json" ]]; then
  # run tests
else
  echo "(skip) cns-dashboard not found at ${CNS_DASHBOARD_ROOT} — set CNS_DASHBOARD_ROOT if relocated"
fi
```

**Test skip helper example:**

```javascript
function resolveVaultModulesDir() {
  const vaultRoot = process.env.CNS_VAULT_ROOT?.trim();
  if (!vaultRoot) return null;
  const modulesDir = join(vaultRoot, "AI-Context", "modules");
  if (!existsSync(modulesDir)) return null;
  return modulesDir;
}
// it("...", { skip: !resolveVaultModulesDir() }, () => { ... });
```

### Session-close step ordering rationale

```
prepare_context → sync_vault_modules → export → fast_scan → tests → memory → daily_rhythm
```

Sync before tests ensures constitution parity gate sees current vault state on operator machines. Sync before export is also acceptable if export embeds module references — prefer **before tests** as minimum.

### Testing standards

- Use Node built-in `node:test` + `assert` (no new test framework)
- Temp fixtures: create minimal vault modules dir with 1–2 `.md` files for divergence proof
- Import sync helpers from lib — test the same code path CLI and session-close use
- Extend `tests/session-close-pipeline.test.mjs` for step recording (pattern: existing export/fast_scan/tests step assertions)
- Run full gate: `bash scripts/verify.sh`

### Previous story intelligence (87-1)

- **87-1 done:** 11 modules synced; `vault-lint.md` relocated to spec root; in-repo `Knowledge-Vault-ACTIVE/AI-Context/{AGENTS,modules,personas}` untracked
- **87-1 test gap:** Added existence test only — this story adds live vault parity
- **87-1 commit:** `59fe78c refactor(vault): single-source constitution mirror in specs/, untrack stale AI-Context copies (87-1)`
- **Do not re-relocate vault-lint** or re-copy 11 modules manually unless probe fails

### Git intelligence (recent commits)

| Commit | Relevance |
|--------|-----------|
| `59fe78c` | 87-1 mirror + untrack — baseline for this story |
| `e08ad98` | `.gitattributes` LF pin — sync must write LF to specs |
| `634c831` | session-close AGENTS §8 regen — unrelated; do not conflate with modules sync |

### Architecture compliance

- **NFR-R2:** verify gate remains `bash scripts/verify.sh`; parity is part of `npm test`, not a separate bash block (Story 6-3 pattern)
- **WriteGate:** sync writes **specs/** only — allowed without WriteGate (implementation repo, not canonical vault)
- **FR-17/18 session-close:** Phase A deterministic steps only; modules sync is deterministic file copy (no LLM)
- **Constitution mirror rule** (`.cursor/rules/cns-specs-constitution.mdc`): AGENTS sync remains session-close §8 path; modules sync is complementary, vault → specs

### Project context reference

- Mirror model: `project-context.md` Non-negotiable #3 (WriteGate for AGENTS; specs mirror for repo work)
- `specs/cns-vault-contract/README.md` — documents 11-file modules mirror
- Deferred: AGENTS CRLF flip-flop — modules copy should normalize to LF proactively

### Library / framework requirements

- **No new dependencies** — Node `fs/promises`, `path`, existing `resolvePaths`
- **Context7:** not required (stdlib only)

## References

- [Source: `_bmad-output/implementation-artifacts/87-1-untrack-vault-ai-context-constitution-duplicates.md`]
- [Source: `scripts/session-close/apply-section8.mjs` — byte-sync pattern reference]
- [Source: `scripts/session-close/lib/paths.mjs` — vault root resolution]
- [Source: `scripts/session-close/run-deterministic.mjs` — Phase A pipeline]
- [Source: `tests/constitution.test.mjs` — extend parity gate]
- [Source: `scripts/verify.sh` — conditional skip pattern]
- [Source: `specs/cns-vault-contract/README.md` — mirror contract]
- [Source: `.gitattributes` — LF policy for specs mirror]
- [Source: `_bmad-output/implementation-artifacts/48-4-session-close-apply-section8-agents-sync.md` — SC-4 sync precedent]
- [Source: `_bmad-output/implementation-artifacts/6-3-verification-gate.md` — npm test includes constitution checks]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Early test run without explicit path overrides briefly wrote to real `specs/cns-vault-contract/modules/` — restored via `git checkout`; hardened `resolveVaultModulesPaths` to honor explicit `repoRoot`+`vaultRoot` overrides.

### Completion Notes List

- Added `sync-vault-modules.mjs` lib + CLI: vault → specs mirror with LF normalization on write, dry-run diff preview, add/update/remove reporting.
- Wired `sync_vault_modules` into Phase A after `prepare_context`, before `export`; dry-run skips; failures set `failureClass: sync_vault_modules` without aborting pipeline.
- Added `npm run sync-vault-modules` operator script.
- Added `tests/vault-modules-parity.test.mjs`: unit tests for compare/sync/CLI + live vault parity gate (skips when `CNS_VAULT_ROOT` unset).
- Extended `tests/session-close-pipeline.test.mjs` for dry-run skip assertions on `steps.sync_vault_modules`.
- Extended `paths.mjs` with `vaultModulesPath` / `repoModulesPath`.
- Parity compares normalized LF content on both sides.
- `bash scripts/verify.sh` PASS (2026-07-09).
- **Hotfix:** `resolveLiveVaultModulesDir()` now async; falls back to `CNS_VAULT_ROOT` via `readSessionCloseEnvVar` (`~/.hermes/session-close.env`) when process env unset — parity gate runs on ambient `verify.sh` (skipped 0, not false-green skip).

### File List

- `scripts/session-close/lib/sync-vault-modules.mjs` (new)
- `scripts/session-close/sync-vault-modules.mjs` (new)
- `scripts/session-close/lib/paths.mjs` (modified)
- `scripts/session-close/run-deterministic.mjs` (modified)
- `package.json` (modified)
- `tests/vault-modules-parity.test.mjs` (new)
- `tests/session-close-pipeline.test.mjs` (modified)

### Manual evidence (AC#3)

```text
# After probe append to vault security.md:
AssertionError: Vault modules mirror drift detected:
  changed (content differs): security.md
Run: npm run sync-vault-modules

# After npm run sync-vault-modules:
live vault modules mirror matches specs when CNS_VAULT_ROOT is available — PASS (6/6 tests)

# Ambient verify (no exported CNS_VAULT_ROOT) — parity gate runs, skipped 0:
env -u CNS_VAULT_ROOT node --test tests/vault-modules-parity.test.mjs
  ✔ live vault modules mirror matches specs when vault is configured
ℹ pass 7 | skipped 0

env -u CNS_VAULT_ROOT bash scripts/verify.sh → VERIFY PASSED (ℹ skipped 0)

# Stray specs file → red:
  removed (in specs, missing from vault): _drift-probe-87-2.md
ℹ fail 1 | skipped 0
# After rm → green again
```

## Change Log

- 2026-07-09: Story 87-2 created — auto-sync vault modules to specs + drift gate in verify.
- 2026-07-09: Implemented sync lib, session-close wiring, parity tests, verify green.
- 2026-07-09: Code review patches — repo-fallback skip, empty-vault guard, rm force, pipeline tests; story done.

## Story Completion Status

- **Status:** done
- **Completion note:** Auto-sync + drift gate shipped; verify.sh green; review patches applied (fallback skip, empty-vault guard, rm force, pipeline tests).
