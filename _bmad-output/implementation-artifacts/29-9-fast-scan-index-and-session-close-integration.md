# Story 29.9: Fast-scan index + session-close integration

Status: done

## Story

As an **operator** running `/session-close`,
I want a **compact, agent-readable vault catalog** regenerated each close at `AI-Context/vault-fast-scan-index.md`,
so that **agents orient to governed notes without loading the full ingest index (~272KB)**.

## Acceptance Criteria

1. **`AI-Context/vault-fast-scan-index.md`** exists after a real `/session-close` run (and after running the repo generator for CI or seed) with the **exact** header and line shape specified in **Index format (normative)** below.
2. **One line per note:** `TYPE path | title | created` where `path` is vault-relative POSIX under `01-Projects/`, `02-Areas/`, or `03-Resources/`; `TYPE` matches `pake_type` per type-code table; `title` and `created` (`YYYY-MM-DD`) present (sensible fallbacks allowed where documented).
3. **Coverage:** Recursive `*.md` under the three governed roots only (no `00-Inbox/`, no `DailyNotes/`, no `AI-Context/` unless a path somehow lives under 01–03, which it must not).
4. **Sort and cap:** Rows sorted by **modified** descending (frontmatter `modified` when parseable as `YYYY-MM-DD`, else filesystem `mtime`). Hard cap **100** rows before token trim; if `ceil(charCount / 4) > 2000` for the **entire file**, reduce included row count in steps of **5** until the budget fits (minimum 1 row if possible).
5. **Token budget:** For the written file, `Math.ceil(content.length / 4) <= 2000` using UTF-16 code unit length (same as Story acceptance and `scripts/generate-vault-fast-scan-index.mjs`).
6. **Session-close:** **Step 6.6** added to `references/task-prompt.md` **immediately after Step 6.5** in:
   - `~/.hermes/skills/cns/session-close/references/task-prompt.md` (live)
   - `scripts/hermes-skill-examples/session-close/references/task-prompt.md` (repo mirror)
7. **Write path:** Overwrite `vault-fast-scan-index.md` via **direct operator filesystem write** to canonical vault `AI-Context/` (same class as `MEMORY.md`). **Do not** call `vault_create_note` or any Vault IO mutator for this file.
8. **Dry-run:** Step 6.6 skipped when `/session-close --dry-run` (same as Step 6.5); dry-run constraints extended so this file is not written.
9. **Seed:** Repo fixture vault (`Knowledge-Vault-ACTIVE/`) contains a generated `AI-Context/vault-fast-scan-index.md` with real governed-folder content after `npm run vault:fast-scan` (or equivalent).
10. **`npm test`** and **`bash scripts/verify.sh`** pass.

## Index format (normative)

The file **must** begin with these four lines (blank line after header block):

```markdown
# Vault Fast-Scan Index (auto — /session-close)
# Format: [TYPE] [path] | [title] | [created]
# Token budget: ≤2,000 tokens | Cap: 100 most-recently-modified notes

```

Each following line:

```text
[TYPE] [vault-relative/path.md] | [title] | [YYYY-MM-DD]
```

**Type codes**

| `pake_type` (frontmatter) | Code |
|---------------------------|------|
| SourceNote | SRC |
| InsightNote | INS |
| SynthesisNote | SYN |
| DailyNote | DLY |
| Any other or missing | OTH |

**Title sanitization:** Strip YAML outer quotes if present. Replace any literal `|` in the title with ` - ` so the line stays unambiguous.

## Tasks / Subtasks

- [x] Add `scripts/generate-vault-fast-scan-index.mjs` + `npm run vault:fast-scan` (AC: 1, 2, 4, 5, 9)
- [x] Add `tests/vault-fast-scan-index.test.mjs` (AC: 1, 2, 5)
- [x] Document Step 6.6 in both `task-prompt.md` copies; extend dry-run and final-reply bullets (AC: 6, 7, 8)
- [x] Update `session-close/SKILL.md` (repo + live) sequence line (AC: 6)
- [x] Constitution: Section 9 “When Starting a Session” points agents at `vault-fast-scan-index.md` before broad vault search; bump version + changelog; sync **all** AGENTS mirrors (AC: agent entrypoint narrative)
- [x] `CNS-Operator-Guide.md`: §2 grounding table + §15.4 session-close bullets + version row (standing task)
- [x] Run generator seed + `npm test` + `verify.sh` (AC: 10)

## Dev Notes

- **Precedent:** Story **29-2** added Step **6.5** (`MEMORY.md`) with operator FS overwrite and dry-run skip. Mirror that structure for **6.6**.
- **Canonical vault path** in prompts: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/` (operator machine). Repo tests use `Knowledge-Vault-ACTIVE` under repo root via `CNS_VAULT_ROOT` or default in script.
- **Reads:** Session-close may use `vault_read_frontmatter` batch or operator FS reads for governed notes; **writes** only via FS for `AI-Context/vault-fast-scan-index.md`.
- **§6.5** in `AGENTS.md` already lists “Fast-scan index: ≤2,000 tokens total (story 29-9)”; do not relax WriteGate or audit logging.

### References

- `_bmad-output/implementation-artifacts/29-2-memory-md-schema-and-session-close-integration.md` (MEMORY.md pattern)
- `scripts/hermes-skill-examples/session-close/references/task-prompt.md` (insert point after Step 6.5)
- `specs/cns-vault-contract/AGENTS.md` §6.5 Token Budget Policy
- `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md` (29-9 story card)

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] §15.4 and §2 updated for fast-scan index + `npm run vault:fast-scan` pointer.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Added `scripts/generate-vault-fast-scan-index.mjs` and `npm run vault:fast-scan`; token cap uses `ceil(chars/4) <= 2000` with row cap trimmed in steps of 5 from 100.
- Step **6.6** inserted after **6.5** in repo and live `session-close/references/task-prompt.md`; dry-run extended to skip writing `vault-fast-scan-index.md`; Discord template includes `vault_fast_scan`.
- Constitution **v1.9.9**: Section 9 step 3 points agents at `AI-Context/vault-fast-scan-index.md`; synced to planning symlink target, repo fixture `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`, and canonical Windows vault path when mounted.
- Seeded **`vault-fast-scan-index.md`** on repo fixture vault and on `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/` (canonical) via `CNS_VAULT_ROOT` for operator parity.
- `bash scripts/verify.sh` passed after ESLint fix (`dirname` + `fileURLToPath` for script root).

### File List

- `scripts/generate-vault-fast-scan-index.mjs`
- `package.json`
- `tests/vault-fast-scan-index.test.mjs`
- `scripts/hermes-skill-examples/session-close/references/task-prompt.md`
- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `~/.hermes/skills/cns/session-close/references/task-prompt.md` (live)
- `~/.hermes/skills/cns/session-close/SKILL.md` (live)
- `specs/cns-vault-contract/AGENTS.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md`
- `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`
- `Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
