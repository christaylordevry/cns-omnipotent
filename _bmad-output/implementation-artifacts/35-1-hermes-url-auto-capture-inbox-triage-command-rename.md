---
story_id: 35-1
epic: 35
title: hermes-url-auto-capture-inbox-triage-command-rename
status: done
---

# Story 35.1: hermes-url-auto-capture-inbox triage command rename

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want the **`hermes-url-auto-capture-inbox`** skill documentation to reference **`/triage-approve`** and **`/triage-execute`** instead of deprecated **`/approve`** and **`/execute-approved`**,  
so that **#general capture docs align with Story 31-1** and operators are not sent to gateway-intercepted command names after Inbox capture.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 35: Vault Curation + Housekeeping |
| **Phase** | 6 |
| **Predecessor** | Story **31-1** renamed triage skill commands; **33-3** updated Operator Guide §15.3 |
| **Deferred item** | `deferred-work.md` row 27; Epic 33 retro action item #4 |
| **Scope** | Doc-only rename in **three files** — no behaviour change to capture logic |

**Root cause (unchanged from 31-1):** Hermes gateway owns **`/approve [session|always]`**. The capture skill only documents the post-capture manual triage path; it must not teach deprecated names.

**Install path correction:** User brief mentioned `~/.hermes/skills/cns/hermes-url-ingest-vault/` — that is the **URL ingest** skill. This story’s skill is **`hermes-url-auto-capture-inbox`**. Canonical live path per `scripts/install-hermes-skill-url-auto-capture-inbox.sh`:

`~/.hermes/skills/cns/hermes-url-auto-capture-inbox/`

## Acceptance Criteria

1. **`scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/SKILL.md`:** Replace normative references **`/approve`** → **`/triage-approve`**, **`/execute-approved`** → **`/triage-execute`**. Workflow chain reads: `/triage` → `/triage-approve` → `/triage-execute`. Policy bullet “must not call” lists updated command names.
2. **`references/config-snippet.md`:** `#hermes` channel prompt line documents **`/triage-approve`** and **`/triage-execute`** (not `/approve` / `/execute-approved`).
3. **`references/capture-prompt.md`:** **Manual Triage Boundary** section uses canonical names; no normative instruction to call deprecated commands.
4. **Live mirror:** Run **`bash scripts/install-hermes-skill-url-auto-capture-inbox.sh`** (or `cp -a` equivalent). Verify repo and live copies match:
   ```bash
   cmp -r scripts/hermes-skill-examples/hermes-url-auto-capture-inbox \
     ~/.hermes/skills/cns/hermes-url-auto-capture-inbox
   ```
   Exit 0 on all three files (`SKILL.md`, `references/config-snippet.md`, `references/capture-prompt.md`).
5. **No stale deprecated strings** in normative sections of those three files (grep `/approve` and `/execute-approved` — only allowed in optional one-line “deprecated” migration note if you add one; prefer zero occurrences).
6. **`npm test`** passes (including `tests/hermes-url-auto-capture-inbox-skill.test.mjs`).
7. **`bash scripts/verify.sh`** passes.
8. **Commit:** One logical commit for this story (user-requested).

**Optional hardening (recommended):** Extend `tests/hermes-url-auto-capture-inbox-skill.test.mjs` to assert **`/triage-approve`** and **`/triage-execute`** in `SKILL.md` and `capture-prompt.md`, and assert **no** `/execute-approved` in normative capture boundary text.

**Out of scope:** Triage skill files (done in 31-1), Operator Guide (done in 33-3), Hermes gateway config edits beyond what operator already has in `~/.hermes/config.yaml`, version bump of capture skill unless you add assertions (not required).

## Tasks / Subtasks

- [x] Grep repo for `/approve` and `/execute-approved` under `hermes-url-auto-capture-inbox/` — confirm only the three target files need edits. (AC prep)
- [x] Edit **`SKILL.md`** Overview + Non-goals bullets. (AC1)
- [x] Edit **`references/config-snippet.md`** `#hermes` prompt line. (AC2)
- [x] Edit **`references/capture-prompt.md`** Manual Triage Boundary. (AC3)
- [x] Install to **`~/.hermes/skills/cns/hermes-url-auto-capture-inbox/`**; **`cmp`** verify. (AC4)
- [x] Grep post-edit for deprecated strings. (AC5)
- [x] (Optional) Update **`tests/hermes-url-auto-capture-inbox-skill.test.mjs`**. (AC6)
- [x] Run **`npm test`** and **`bash scripts/verify.sh`**. (AC6–7)
- [x] Commit with message focused on doc hygiene / 31-1 alignment. (AC8)
- [x] Standing task: Operator guide — **no update required** (§15.3 already canonical).

## Dev Notes

### Exact strings to replace (three files)

| File | Current (examples) | Target |
|------|-------------------|--------|
| `SKILL.md` L19 | `/triage` -> `/approve` -> `/execute-approved` | `/triage` -> `/triage-approve` -> `/triage-execute` |
| `SKILL.md` L38 | must not call `/approve` or `/execute-approved` | `/triage-approve` / `/triage-execute` |
| `config-snippet.md` L16 | `/triage, /approve, and /execute-approved` | `/triage`, `/triage-approve`, and `/triage-execute` |
| `capture-prompt.md` L104 | `/approve`, `/execute-approved`; workflow chain | canonical names |

### Discord operator syntax (from 31-1)

In Discord, operators may omit the leading slash: `triage-approve …`, `triage-execute …`. Capture skill docs may mention both forms in a single footnote if needed; primary documentation should use **`/triage-approve`** / **`/triage-execute`** for consistency with Operator Guide.

### Install helper

```bash
bash scripts/install-hermes-skill-url-auto-capture-inbox.sh
```

### Verification commands

```bash
rg '/approve|/execute-approved' scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/
cmp scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/SKILL.md \
  ~/.hermes/skills/cns/hermes-url-auto-capture-inbox/SKILL.md
npm test
bash scripts/verify.sh
```

### References

- [Source: `_bmad-output/implementation-artifacts/31-1-triage-command-rename-and-constitution-sync.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — row 27]
- [Source: `_bmad-output/implementation-artifacts/epic-33-retro-2026-05-17.md` — action item #4]
- [Source: `scripts/install-hermes-skill-url-auto-capture-inbox.sh`]

## Dev Agent Record

### Agent Model Used

Composer (bmad-dev-story)

### Completion Notes List

- Renamed triage workflow commands in three capture-skill files to align with Story 31-1 (`/triage-approve`, `/triage-execute`).
- Extended `hermes-url-auto-capture-inbox-skill.test.mjs` with assertions for canonical names and absence of `/execute-approved`.
- Installed live mirror via `install-hermes-skill-url-auto-capture-inbox.sh`; `cmp` verified all three files.
- `npm test` (680 tests) and `scripts/verify.sh` exit 0.

### File List

- `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/SKILL.md`
- `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/references/config-snippet.md`
- `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/references/capture-prompt.md`
- `tests/hermes-url-auto-capture-inbox-skill.test.mjs`
- `_bmad-output/implementation-artifacts/35-1-hermes-url-auto-capture-inbox-triage-command-rename.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `~/.hermes/skills/cns/hermes-url-auto-capture-inbox/` (installed mirror)

### Review Findings

- 2026-05-18: **Clean review** — Blind Hunter, Edge Case Hunter, and Acceptance Auditor passed. All acceptance criteria satisfied in commit `3e3a11f`. No patch, decision, or defer items.

### Change Log

- 2026-05-18: Story 35-1 — capture skill docs use `/triage-approve` and `/triage-execute`; tests hardened; live install synced.
- 2026-05-18: Code review complete — status `done`.
