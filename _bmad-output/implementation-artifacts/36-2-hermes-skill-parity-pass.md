---
story_id: 36-2
epic: 36
title: hermes-skill-parity-pass
status: review
---

# Story 36.2: Hermes skill parity pass

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **CNS maintainer**,  
I want **repo mirrors under `scripts/hermes-skill-examples/` to match installed `~/.hermes/skills/cns/`** for three drifted skills, with **install scripts** for skills that lack them,  
so that **`cp` + `cmp` verification is repeatable**, **Pitfalls and tooling survive reinstall**, and **Hermes skill capture (26-8) stays the single source of truth in git**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 36: Operational Stability + Vault Close-Out |
| **Phase** | 6 |
| **Audit source** | Repo audit 2026-05-18 — skill parity gaps |
| **Install pattern** | `scripts/install-hermes-skill-vault-think.sh` — `cp -a` from `scripts/hermes-skill-examples/<skill>/` → `~/.hermes/skills/cns/<skill>/` |
| **Predecessor** | **29-5** (vault-lint skill), **26-6** (url-ingest), **28-1** (session-close) |

### Drift summary (observed 2026-05-18)

| Skill | Repo gap | Installed-only |
|-------|----------|----------------|
| **session-close** | Missing **`## Pitfalls`** (~lines 59–111) | Pitfalls: MEMORY symlink ERRNO 18, NotebookLM `title` vs `source_name`, fast-scan token budget, execute_code locals, `hermes_tools.read_file` KeyError, no memory tool during close, changelog anchor, AGENTS hardlink, `source_add ready:false` |
| **vault-lint** | Stale **`SKILL.md`**; missing **`scripts/bulk_scan.py`** | Expanded Tools section + Pitfalls + `scripts/bulk_scan.py` |
| **hermes-url-ingest-vault** | Missing **`general-capture-prompt.md`**, **`general-config-snippet.md`**; stale **`SKILL.md`** | #general auto-ingest references (Story **28-3**) |

## Acceptance Criteria

### 1. session-close

1. Copy **`## Pitfalls`** section from **`~/.hermes/skills/cns/session-close/SKILL.md`** (installed, lines ~59–111) into **`scripts/hermes-skill-examples/session-close/SKILL.md`** — full section, no truncation.
2. Run **`bash scripts/install-hermes-skill-session-close.sh`**.
3. **`cmp`** exit 0:
   ```bash
   cmp scripts/hermes-skill-examples/session-close/SKILL.md \
     ~/.hermes/skills/cns/session-close/SKILL.md
   ```

### 2. vault-lint

4. Sync **entire tree** from installed → repo:
   - **`SKILL.md`** (Pitfalls + expanded Tools)
   - **`references/`** (if differs)
   - **`scripts/bulk_scan.py`** → **`scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py`**
5. Create **`scripts/install-hermes-skill-vault-lint.sh`** mirroring **`install-hermes-skill-vault-think.sh`** (same `cp -a` pattern, dest `~/.hermes/skills/cns/vault-lint/`).
6. Run install script; **`cmp -r`** (or per-file `cmp`) exit 0 for all mirrored files under **`vault-lint/`**.

### 3. hermes-url-ingest-vault

7. Sync from installed → repo:
   - **`SKILL.md`**
   - **`references/general-capture-prompt.md`**
   - **`references/general-config-snippet.md`**
   - **`references/ingest-prompt-block.md`** (if installed differs)
8. Create **`scripts/install-hermes-skill-url-ingest-vault.sh`** (mirror vault-think install script).
9. Run install script; **`cmp`** all three skill files + reference files (0 diffs).

### 4. Verification gate

10. **`npm test`** passes (extend skill tests if assertions added — optional but recommended for session-close Pitfalls heading).
11. **`bash scripts/verify.sh`** passes.
12. **One logical commit** for this story.

**Out of scope:** Changing skill behavior; Hermes `config.yaml` bindings; vault-think Pitfalls (audit found no drift); triage / vault-graduate mirrors unless `cmp` fails during verification.

## Tasks / Subtasks

- [x] **session-close:** Merge Pitfalls into repo `SKILL.md`; install; `cmp` (AC1–3)
- [x] **vault-lint:** `cp -a` installed → repo; add `install-hermes-skill-vault-lint.sh`; install; `cmp -r` (AC4–6)
- [x] **hermes-url-ingest-vault:** sync files; add `install-hermes-skill-url-ingest-vault.sh`; install; `cmp` all (AC7–9)
- [x] (Optional) Add **`tests/hermes-vault-lint-skill.test.mjs`** / extend session-close test for `## Pitfalls` (AC10)
- [x] **`npm test`** + **`verify.sh`** (AC10–11)
- [ ] Commit (AC12)
- [x] Standing task: Operator guide — **no update required** unless install paths are operator-facing (note in Dev Agent Record)

## Dev Notes

### Install script template

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/vault-lint"
DEST_DIR="${HOME}/.hermes/skills/cns/vault-lint"
mkdir -p "$DEST_DIR"
cp -a "$SRC_DIR/." "$DEST_DIR/"
echo "Installed Hermes skill to: $DEST_DIR"
```

Duplicate for **`hermes-url-ingest-vault`** with correct paths.

### cmp verification one-liner

```bash
for skill in session-close vault-lint hermes-url-ingest-vault; do
  diff -rq "scripts/hermes-skill-examples/$skill" "$HOME/.hermes/skills/cns/$skill" || true
done
```

Expect **no output** on success.

### session-close Pitfalls — do not edit live first

**Source of truth for Pitfalls content:** installed copy (battle-tested in Discord `/session-close`). **Repo is behind** — copy installed → repo, then install script proves round-trip.

### vault-lint bulk_scan.py

Installed path: **`~/.hermes/skills/cns/vault-lint/scripts/bulk_scan.py`** (~10.5 KB). Repo must include **`scripts/hermes-skill-examples/vault-lint/scripts/`** directory. Skill may invoke via Hermes `execute_code` — keep shebang and `VAULT` env docs intact.

### hermes-url-ingest-vault #general files

From Story **28-3** — `general-capture-prompt.md` and `general-config-snippet.md` document **`#general`** channel auto-capture; repo mirror was never updated after live install.

### Existing install scripts (reference)

| Script | Skill |
|--------|-------|
| `install-hermes-skill-session-close.sh` | session-close |
| `install-hermes-skill-vault-think.sh` | vault-think |
| `install-hermes-skill-triage.sh` | triage |
| `install-hermes-skill-url-auto-capture-inbox.sh` | hermes-url-auto-capture-inbox |
| `install-hermes-skill-vault-graduate.sh` | vault-graduate |

### References

- [Source: `scripts/install-hermes-skill-vault-think.sh`]
- [Source: `_bmad-output/implementation-artifacts/26-8-hermes-skill-capture-workflow.md`]
- [Source: `_bmad-output/implementation-artifacts/28-3-wire-general-auto-ingest.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — vault-think Pitfalls closed; session-close/vault-lint/url-ingest open]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Completion Notes List

- **session-close:** Merged full `## Pitfalls` section (53 lines) from installed → repo `SKILL.md`; `cmp` exit 0 after `install-hermes-skill-session-close.sh`. Repo `task-prompt.md` retains Story 36-1 gateway `@reboot` line (pushed to installed on install).
- **vault-lint:** `cp -a` installed tree → repo (SKILL.md, references, `scripts/bulk_scan.py`); added `install-hermes-skill-vault-lint.sh`; `diff -rq` clean after install.
- **hermes-url-ingest-vault:** Synced SKILL + references (`general-capture-prompt.md`, `general-config-snippet.md`, ingest block); added `install-hermes-skill-url-ingest-vault.sh`; `diff -rq` clean after install.
- **Tests:** Extended `hermes-session-close-skill.test.mjs` (Pitfalls); added `hermes-vault-lint-skill.test.mjs`, `hermes-url-ingest-vault-skill.test.mjs`.
- **Gates:** `npm test` and `bash scripts/verify.sh` passed.
- **Operator guide:** No update required — install paths are maintainer scripts, not new operator-facing behavior.

### File List

- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `scripts/hermes-skill-examples/vault-lint/SKILL.md`
- `scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py`
- `scripts/hermes-skill-examples/vault-lint/references/` (synced if changed)
- `scripts/hermes-skill-examples/hermes-url-ingest-vault/SKILL.md`
- `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/general-capture-prompt.md`
- `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/general-config-snippet.md`
- `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/` (other synced files)
- `scripts/install-hermes-skill-vault-lint.sh`
- `scripts/install-hermes-skill-url-ingest-vault.sh`
- `tests/hermes-session-close-skill.test.mjs`
- `tests/hermes-vault-lint-skill.test.mjs`
- `tests/hermes-url-ingest-vault-skill.test.mjs`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] Operator guide: no update required (maintainer install scripts only)

## Change Log

- 2026-05-20: Story 36-2 — Hermes skill parity for session-close, vault-lint, hermes-url-ingest-vault; install scripts + tests.
