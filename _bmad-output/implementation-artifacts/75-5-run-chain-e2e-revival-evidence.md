# Story 75-5 — Run-Chain E2E Revival Evidence

**Date:** 2026-06-24T17:21:09Z  
**Trigger surface:** CLI fallback (canonical skill `terminal()` command from `task-prompt.md` §2) — **not** Discord `#hermes` or Hermes Desktop (binding missing at preflight; follow-up below)  
**Brief topic slug:** cns-run-chain-revival-smoke-2026-06  
**Overall outcome:** **PASS**

## Preflight (75-4)

- `validate-anthropic-key.ts` exit: **0** (2026-06-25)
- Key mask line: `Anthropic key OK (sk-ant-api…****)` | Model: claude-haiku-4-5 | HTTP 200

## Hermes skill summary

**CLI fallback (documented):** `run-chain` was **not** listed in `~/.hermes/config.yaml` `channel_skill_bindings` for `#hermes` (`1500733488897462382`) at preflight. Hermes gateway was running (`hermes_cli.main gateway run`). Skill installed and `diff -rq` clean between repo mirror and `~/.hermes/skills/cns/run-chain`.

Executed the **canonical skill command** from `references/task-prompt.md` §2 (same shell: `source .env.live-chain` + `npx tsx scripts/run-chain.ts`):

```markdown
## Run-chain complete

- **topic:** CNS run-chain revival smoke 2026-06
- **exit:** 0
- **result:** PASS
- **synthesis:** 03-Resources/synthesis-cns-run-chain-revival-smoke-2026-06-2026-06-24.md
- **evidence:** _bmad-output/implementation-artifacts/75-5-run-chain-smoke-evidence.md
```

**Follow-up (operator):** Add `run-chain` to `channel_skill_bindings` and channel prompt on `#hermes` per `config-snippet.md`; consider raising `terminal.timeout` above 180s for shallow+ runs.

## CLI evidence (`--evidence-file`)

Path: `_bmad-output/implementation-artifacts/75-5-run-chain-smoke-evidence.md`

| Stage | Status | Notes |
|-------|--------|-------|
| Research | ok | notes_created=2, notes_skipped=3 |
| Synthesis | ok | sources_used=2 |
| Hook | ok | options=4 |
| Boss | ok | options=4 |

- Duration: 245282 ms (~4.1 min)
- Depth: shallow / 1 query
- PAKE++ validation: **PASS**

### Summary (read-back validation)

```
Result: PASS
- synthesis: 03-Resources/synthesis-cns-run-chain-revival-smoke-2026-06-2026-06-24.md (ok)
- hooks: 03-Resources/hooks-cns-run-chain-revival-smoke-2026-06-2026-06-24.md (ok)
- weapons: 03-Resources/weapons-check-cns-run-chain-revival-smoke-2026-06-2026-06-24.md (ok)
```

## Vault outputs (PASS)

| Stage | vault_path | read-back |
|-------|------------|-----------|
| Synthesis | `03-Resources/synthesis-cns-run-chain-revival-smoke-2026-06-2026-06-24.md` | ok |
| Hooks | `03-Resources/hooks-cns-run-chain-revival-smoke-2026-06-2026-06-24.md` | ok |
| Weapons | `03-Resources/weapons-check-cns-run-chain-revival-smoke-2026-06-2026-06-24.md` | ok |

- PAKE++ validation: **PASS**
- Result: **PASS**
- No HTTP 401 on Anthropic stages

## AC checklist

| AC | Result | Notes |
|----|--------|-------|
| #1 Preflight | **PASS** | validate exit 0 |
| #2 Skill installed | **PASS** | install script + diff clean; `OMNIPOTENT_REPO` set for run |
| #3 Hermes trigger | **PASS (CLI fallback)** | Canonical skill shell; `#hermes` binding follow-up deferred — accepted per code review 1A |
| #4 Outcome | **PASS** | exit 0, Result PASS, no 401 |
| #5 Vault outputs | **PASS** | all three notes on disk, read-back ok |
| #6 Evidence file | **PASS** | this file + smoke evidence |
| #7 Un-dormant docs | **PASS** | Status → Revived in governance docs |
| #8 Verify + protect-list | **PASS** | verify.sh green; no protect-list diffs |

## Protect-list

`git diff --name-only` → no protect-list paths (engine unchanged)
