---
story_id: 60-1
epic: 60
title: fix-verify-sh-hermes-skill-parity-gate
status: done
baseline_commit: 5f32989dce0132b8cb4158b8c25cb0df9ef94d24
operator_brief: 2026-06-04
predecessors: 36-2, 54-1, 59-1, 59-2, 56-4
---

# Story 60.1: Fix verify.sh Hermes skill parity gate

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **CNS maintainer**,  
I want **repo mirrors under `scripts/hermes-skill-examples/` to match installed `~/.hermes/skills/cns/` for every skill the verify gate enforces, and a clean audit of all other mirrors**,  
so that **`bash scripts/verify.sh` exits 0 on developer workstations** and Discord-bound skills do not run stale packages after Epic 59 session-close / morning-digest fixes.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 60: Hermes skill mirror hygiene (operator brief 2026-06-04) |
| **Gate** | Story **54-1** — `scripts/assert-hermes-skill-install-gate.mjs` via `scripts/verify.sh` |
| **Parity trio (enforced)** | `notebook-query`, `morning-digest`, `session-close` (`scripts/hermes-skill-bindings-expected.json` → `parity_skills`) |
| **Sync pattern** | Installed battle-tested content → repo mirror; repo-tested scripts → install pushes to `~/.hermes` |
| **Install scripts** | `scripts/install-hermes-skill-*.sh` — session-close uses `rsync -a --delete`; morning-digest still uses `cp -a` (deferred 54-1) |

### Live investigation (2026-06-04 — this workstation)

Operator brief cited **session-close** drift. **Current `diff -rq` state:**

| Skill | Parity gate? | `diff -rq` result | Action |
|-------|--------------|-------------------|--------|
| `session-close` | Yes | **clean** | No file sync required unless re-drifts after edits |
| `notebook-query` | Yes | **clean** | None |
| `morning-digest` | Yes | **DRIFT** — see below | **Primary fix for verify failure** |
| Other mirrors | No (binding audit only) | See §Full mirror audit | Remediate or document extras |

**`morning-digest` drift detail (blocks verify today):**

```
Files .../morning-digest/SKILL.md differ
Only in ~/.hermes/.../morning-digest/references: pick-signal-routing.md
Files .../pick-signal-notebook.mjs differ
```

| Artifact | Repo | Installed | Canonical source |
|----------|------|-----------|------------------|
| `SKILL.md` | v1.2.3, no `## Pitfalls` | v1.2.4 + Pitfalls (registry path, `DIGEST_SOURCES_JSON`, argv precedence) | **Installed → repo** |
| `references/pick-signal-routing.md` | missing | present (NO_ROUTE debug recipe) | **Installed → repo** |
| `scripts/pick-signal-notebook.mjs` | **newer** `parseRegistryPath()` (argv[3] + env; commits `5d3a8e2`, `da7844f`) | older inline precedence | **Repo → installed** (after mirror merge) |

**`session-close`:** Parity is clean after `0d34798` (troubleshooting bullets in repo). Re-verify with `diff -rq`; do not overwrite installed copy with stale repo content.

### Full mirror audit (non-gated skills — AC: no drift)

Run once before commit:

```bash
for skill in scripts/hermes-skill-examples/*/; do
  name=$(basename "$skill")
  diff -rq "$skill" "$HOME/.hermes/skills/cns/$name" 2>/dev/null || echo "MISSING installed: $name"
done
```

**Observed extras (installed-only, not failing verify):**

| Skill | Installed-only files | Remediation |
|-------|---------------------|-------------|
| `hermes-url-ingest-vault` | `general-capture-prompt-full.md`, `general-config-snippet-updated.md` | Delete if stale duplicates of `general-*.md` in repo, or copy to repo if canonical |
| `triage` | `references/pake-schema-enums.md` | Copy to repo if still used by live skill; else prune on install |
| `vault-think` | `SKILL.md.backup-2026-05-22`, `references/vault-graduate-task-prompt.md` | **Prune** from installed (not in repo mirror); do not add backups to git |

Gated trio must be **byte-identical trees** after fix. Non-gated skills should have **no unexplained file diffs** — either sync both ways or prune installed cruft.

## Acceptance Criteria

### 1. Verify gate green (AC: verify)

**Given** `~/.hermes/config.yaml` exists and `HERMES_SKIP_SKILL_INSTALL_GATE` is unset  
**When** `bash scripts/verify.sh` runs from repo root  
**Then** exit code is **0**  
**And** Hermes skill install gate reports no parity drift for `notebook-query`, `morning-digest`, `session-close`.

### 2. Parity trio trees match (AC: parity)

**Then** for each skill in `parity_skills`:

```bash
diff -rq scripts/hermes-skill-examples/<skill> ~/.hermes/skills/cns/<skill>
```

produces **no output** and exit 0.

**And** `morning-digest` repo mirror includes:

- `SKILL.md` with `## Pitfalls` and version aligned with installed (≥1.2.4)
- `references/pick-signal-routing.md`
- `scripts/pick-signal-notebook.mjs` matching repo tests (`tests/morning-digest-pick-signal-notebook.test.mjs`)

**And** `session-close` repo mirror still matches installed after any morning-digest install pass (re-run diff).

### 3. Full mirror audit (AC: audit)

**Then** the full-loop `diff -rq` in Dev Notes shows **no file content diffs** for any skill under `scripts/hermes-skill-examples/`  
**Or** each remaining diff is explicitly resolved (synced to repo or pruned from installed with documented rationale in Completion Notes).

### 4. Tests and commit (AC: done)

**Then** `npm test` passes (including `tests/hermes-skill-install-gate.test.mjs`, `tests/morning-digest-pick-signal-notebook.test.mjs`).  
**Then** one logical commit; push when operator requests (per sprint hygiene).

**Out of scope:** Changing `parity_skills` list; Hermes `config.yaml` bindings; skill behavior beyond mirror sync; expanding gate to all nine bound skills (future epic).

## Tasks / Subtasks

- [x] **T1** Confirm live drift: `node scripts/assert-hermes-skill-install-gate.mjs` and `diff -rq` per parity skill (AC: 1–2)
- [x] **T2** **morning-digest:** Copy installed → repo: `SKILL.md` (Pitfalls + version), `references/pick-signal-routing.md`; keep repo `pick-signal-notebook.mjs` as canonical script (AC: 2)
- [x] **T3** Run `bash scripts/install-hermes-skill-morning-digest.sh`; re-`diff -rq` morning-digest (AC: 2)
- [x] **T4** (Recommended) Update `install-hermes-skill-morning-digest.sh` to `rsync -a --delete` (mirror `install-hermes-skill-session-close.sh`) so installed-only cruft cannot linger (AC: 2, audit)
- [x] **T5** **session-close:** Verify `diff -rq` clean; if drift appears, sync installed → repo then `bash scripts/install-hermes-skill-session-close.sh` (AC: 2)
- [x] **T6** **Full audit:** Run loop over all `scripts/hermes-skill-examples/*`; fix or prune non-gated drift (AC: 3)
- [x] **T7** `npm test` + `bash scripts/verify.sh` (AC: 1, 4)
- [ ] **T8** Commit (AC: 4) — awaiting operator request per repo commit policy

### Review Findings

- [x] [Review][Decision] Split `specs/cns-vault-contract/AGENTS.md` mirror catch-up (2.1.33) from story 60-1 commit? — **Resolved: A** — same commit; include mirror sync in File List.

- [x] [Review][Patch] Story File List omits `specs/cns-vault-contract/AGENTS.md` [`specs/cns-vault-contract/AGENTS.md`:1]
- [x] [Review][Patch] `deferred-work.md` still claims morning-digest install uses `cp` without `--delete` [`_bmad-output/implementation-artifacts/deferred-work.md`:66] — fixed during review (54-1 bullet struck; 60-1 deferral section added)
- [x] [Review][Patch] `sprint-status.yaml` header comment `last_updated` disagrees with YAML field [`_bmad-output/implementation-artifacts/sprint-status.yaml`:2]

- [x] [Review][Defer] Duplicate Behavioral Integrity changelog rows in `AGENTS.md` [`specs/cns-vault-contract/AGENTS.md`:363] — deferred, pre-existing version-churn pattern
- [x] [Review][Defer] morning-digest install `cp` fallback lacks session-close stale-file `rm` [`scripts/install-hermes-skill-morning-digest.sh`:19] — deferred, rsync path is primary on dev workstations

## Dev Notes

### Gate implementation (do not change unless broken)

```99:100:scripts/verify.sh
echo "==> Hermes skill install gate"
node scripts/assert-hermes-skill-install-gate.mjs
```

```65:88:scripts/lib/hermes-skill-install-gate.mjs
  for (const skill of PARITY_SKILLS) {
    const repoMirror = join(repoRoot, "scripts", "hermes-skill-examples", skill);
    const installed = join(skillsRoot, skill);
    // ...
    execSync(`diff -rq "${repoMirror}" "${installed}"`, ...);
  }
```

`PARITY_SKILLS` loads from `scripts/hermes-skill-bindings-expected.json` — tests assert SSOT match.

### morning-digest merge procedure (canonical order)

1. `cp ~/.hermes/skills/cns/morning-digest/SKILL.md scripts/hermes-skill-examples/morning-digest/SKILL.md`
2. `cp ~/.hermes/skills/cns/morning-digest/references/pick-signal-routing.md scripts/hermes-skill-examples/morning-digest/references/`
3. **Do not** downgrade `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` — repo version fixes `parseRegistryPath` for tests.
4. `bash scripts/install-hermes-skill-morning-digest.sh`
5. `diff -rq scripts/hermes-skill-examples/morning-digest ~/.hermes/skills/cns/morning-digest` → silent

### Install script rsync template (optional T4)

```bash
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SRC_DIR/" "$DEST_DIR/"
else
  # cp fallback + explicit rm of known stale files
fi
```

### session-close — already clean

Commit `0d34798` restored repo parity. Operator brief may predate that fix. **Verify only** unless `diff -rq` fails.

### Non-gated prune examples

```bash
rm -f ~/.hermes/skills/cns/vault-think/SKILL.md.backup-2026-05-22
rm -f ~/.hermes/skills/cns/vault-think/references/vault-graduate-task-prompt.md
```

Only remove files **not** referenced by live `SKILL.md` / `task-prompt.md`. When unsure, grep installed skill before delete.

### Testing

| Test | Validates |
|------|-----------|
| `tests/hermes-skill-install-gate.test.mjs` | Parser, PARITY_SKILLS SSOT, skip when no config |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | `parseRegistryPath` / NO_ROUTE |
| `tests/hermes-morning-digest-skill.test.mjs` | SKILL structure, script paths |

Run: `npm test` then `bash scripts/verify.sh`.

### Architecture compliance

- No vault / WriteGate / MCP tool changes.
- No edits to `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`.
- Operator Guide update **optional** — only if install script behavior changes (rsync prune).

### Previous story intelligence

| Story | Learning |
|-------|----------|
| **36-2** | Installed → repo for battle-tested Pitfalls; `cmp`/`diff -rq` loop |
| **54-1** | Verify enforces parity trio only; session-close `rsync --delete` prunes stale `task-prompt.md` |
| **56-4** | `pick-signal-notebook.mjs` + `DIGEST_SOURCES_JSON` scoring — repo tests are SSOT for script |
| **59-1** | session-close SKILL slimming — parity restored in 59-1/59-2; do not reintroduce `task-prompt.md` to repo |
| **deferred-work.md** | morning-digest `cp` without `--delete` deferred — this story may close that for morning-digest |

### Git intelligence

Recent commits: `0d34798` (session-close parity), `da7844f` / `5d3a8e2` (morning-digest registry path), `5f32989` (epic 59 done). High risk: repo script ahead of installed SKILL/docs.

## Project Context Reference

- [Source: `_bmad-output/implementation-artifacts/54-1-skill-install-gate.md`]
- [Source: `_bmad-output/implementation-artifacts/36-2-hermes-skill-parity-pass.md`]
- [Source: `scripts/lib/hermes-skill-install-gate.mjs`]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.12 — skill install gate]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — morning-digest install rsync deferral]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- T1: gate failed on morning-digest only (SKILL.md, pick-signal-routing.md, pick-signal-notebook.mjs); notebook-query and session-close clean.
- T6 non-gated: pruned installed-only cruft on hermes-url-ingest-vault, triage, vault-think; synced `vault-graduate-task-prompt.md` installed → repo (repo SKILL already referenced it).

### Completion Notes List

- Synced morning-digest mirror to v1.2.4 with `## Pitfalls` and `references/pick-signal-routing.md`; kept repo `pick-signal-notebook.mjs` as SSOT; install pushed via rsync.
- `install-hermes-skill-morning-digest.sh` now uses `rsync -a --delete` (closes deferred 54-1 cp-without-delete for morning-digest).
- Updated `tests/hermes-morning-digest-skill.test.mjs` for v1.2.4, Pitfalls, pick-signal-routing, and rsync install contract.
- Operator Guide §15.11 version 1.2.4; §15.12 documents rsync on morning-digest + session-close install helpers.
- Repo constitution mirror synced to canonical 2.1.33 (`specs/cns-vault-contract/AGENTS.md`; same commit per review decision A).
- `npm test` and `bash scripts/verify.sh` exit 0. Commit deferred until operator requests.

### File List

- `specs/cns-vault-contract/AGENTS.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/hermes-skill-examples/morning-digest/references/pick-signal-routing.md`
- `scripts/hermes-skill-examples/vault-think/references/vault-graduate-task-prompt.md`
- `scripts/install-hermes-skill-morning-digest.sh`
- `tests/hermes-morning-digest-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/60-1-fix-verify-sh-hermes-skill-parity-gate.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] Only if T4 changes install/prune behavior — add rsync note beside §15.12 parity trio recovery

## Change Log

- 2026-06-04: Story 60-1 created — fix verify Hermes parity gate; live blocker is morning-digest drift, session-close currently clean.
- 2026-06-04: Implemented — morning-digest parity restored; full mirror audit clean; verify.sh green; status → review.
- 2026-06-04: Code review complete — decision A (AGENTS mirror in same commit); patches applied; status → done. T8 commit still awaiting operator request.
