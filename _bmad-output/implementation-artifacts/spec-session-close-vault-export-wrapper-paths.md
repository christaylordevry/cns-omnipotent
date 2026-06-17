---
title: 'Fix session-close vault export wrapper path resolution'
type: 'bugfix'
created: '2026-06-14'
status: 'in-review'
baseline_commit: '6dbf9ae052db55dab4348224bdb7d88d3b18574f'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/58-1-migrate-vault-export-drive-doc-sync.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Hermes `/session-close` skill invokes Phase B, Phase C, and reply wrappers through `${OMNIPOTENT_REPO}`. If that variable is absent from an individual terminal invocation, expansion happens before a wrapper starts and produces `/scripts/session-close/...`, so the wrappers' internal repo fallback never runs.

**Approach:** Make every session-close terminal entrypoint in `SKILL.md` an explicit absolute path to the installed Omnipotent.md repo. Preserve the wrapper scripts and their HOME/NVM bootstrap unchanged, add a regression assertion for the path contract, then reinstall the live skill mirror.

## Boundaries & Constraints

**Always:** Keep the repo skill and `~/.hermes/skills/cns/session-close/` byte-synchronized; bump the skill patch version; preserve Phase A/B/C ordering, dry-run behavior, best-effort fan-out, and wrapper PATH/HOME isolation logic; verify the active gateway still exposes `OMNIPOTENT_REPO`.

**Ask First:** Any change to wrapper behavior, Hermes environment configuration, MCP tool signatures, audit logging, WriteGate, or the Drive/NotebookLM data flow.

**Never:** Move Drive sync into `run-deterministic.mjs`; rely on cwd discovery; add a new package; hardcode secrets; edit generated `dist/`; weaken the legacy `source_add` fallback or auth-watchdog continuation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal Hermes runtime | Gateway has `OMNIPOTENT_REPO` | Skill invokes the same repo wrapper paths and completes unchanged | Existing wrapper/report handling applies |
| Isolated terminal call | `HOME=/home/christ/.hermes/home` and `OMNIPOTENT_REPO` is unset | Skill command still addresses an executable wrapper under `/home/christ/ai-factory/projects/Omnipotent.md` | No `/scripts/session-close/...` path is constructed |
| Live mirror deployment | Repo skill changed | Installer copies the exact skill tree to `~/.hermes/skills/cns/session-close/` | Parity check fails completion if drift remains |

</frozen-after-approval>

## Code Map

- `scripts/hermes-skill-examples/session-close/SKILL.md` -- canonical Hermes router and all terminal entrypoint instructions.
- `tests/hermes-session-close-skill.test.mjs` -- prompt contract and token-budget regression coverage.
- `scripts/install-hermes-skill-session-close.sh` -- exact-tree deployment to the live Hermes skill directory.
- `scripts/session-close/hermes-run-*.sh` -- existing executable wrappers whose internal HOME/NVM/repo fallback behavior must remain unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/hermes-skill-examples/session-close/SKILL.md` -- replace variable-dependent terminal entrypoints with the explicit repo path and bump the patch version.
- [x] `tests/hermes-session-close-skill.test.mjs` -- assert all required wrapper/gate entrypoints use the explicit repo prefix and reject variable-dependent Phase C paths.
- [x] `scripts/install-hermes-skill-session-close.sh` -- run the existing installer, restart the gateway after deployment, and prove repo/live parity.

**Acceptance Criteria:**
- Given `OMNIPOTENT_REPO` is absent in a Hermes-isolated shell, when the documented Drive write and sync commands are resolved, then both point to executable wrappers under `/home/christ/ai-factory/projects/Omnipotent.md`.
- Given the active gateway, when its process environment is inspected after deployment, then `OMNIPOTENT_REPO` resolves to `/home/christ/ai-factory/projects/Omnipotent.md`.
- Given the repo skill is installed, when `diff -rq` or `cmp -s` compares repo and live copies, then no drift exists.
- Given the completed patch, when focused session-close tests and `bash scripts/verify.sh` run, then both pass.
- Given a real Discord `/session-close`, when Phase C selects `drive-sync`, then the vault export wrappers are found and the prior "scripts not found" message does not recur.

## Spec Change Log

## Design Notes

The wrappers already contain the correct fallback and NVM bootstrap, but that fallback only helps after the shell has found and started the wrapper. Explicit entrypoint paths remove the earlier failure point while leaving runtime portability inside each wrapper intact.

## Verification

**Commands:**
- `node --test tests/hermes-session-close-skill.test.mjs tests/vault-export-drive-sync.test.mjs` -- expected: focused contracts pass.
- `env -i HOME=/home/christ/.hermes/home HERMES_HOME=/home/christ/.hermes test -x /home/christ/ai-factory/projects/Omnipotent.md/scripts/session-close/hermes-run-write-vault-export-to-drive.sh` -- expected: exit 0.
- `bash scripts/install-hermes-skill-session-close.sh && diff -rq scripts/hermes-skill-examples/session-close ~/.hermes/skills/cns/session-close` -- expected: install succeeds with no diff.
- `bash scripts/verify.sh` -- expected: full repository gate passes.

**Manual checks (if no CLI):**
- Run `/session-close` in Discord and confirm Vault Export Sync no longer reports that the scripts were not found.
