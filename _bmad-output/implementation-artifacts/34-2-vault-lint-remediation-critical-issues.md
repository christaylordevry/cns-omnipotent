---
story_id: 34-2
epic: 34
title: vault-lint-remediation-critical-issues
status: ready-for-dev
---

# Story 34.2: Vault lint remediation — critical issues

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want **the two ERRORS** from the 2026-05-17 vault lint report resolved (duplicate `source_uri` delete + Rule 4 frontmatter bulk patch),  
so that **governed vault notes pass critical lint** and ingest/dedup trust is restored.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 34: Vault Health + Cost Optimization |
| **Phase** | 6 |
| **Lint report (authoritative list)** | `Knowledge-Vault-ACTIVE/_meta/reports/vault-lint-2026-05-17.md` |
| **Vault root** | `CNS_VAULT_ROOT` → `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` |
| **Summary from report** | Rule 1: **1 ERROR**; Rule 4 missing frontmatter: **77 ERROR(s)** |
| **Mutations** | Governed **`vault_update_frontmatter`** via Vault IO MCP; one **filesystem delete** for duplicate (lint-prescribed) |

## Acceptance Criteria

1. **Rule 1 — duplicate `source_uri`:** Delete the oldest duplicate per lint fix line:
   - **Remove:** `03-Resources/e2e-epic30-20260516-cursor-dev.md` (created 2026-05-16).
   - **Keep:** `03-Resources/e2e-epic30-dedup-test.md`.
   - Use exact lint command: `rm -f "<VAULT_ROOT>/03-Resources/e2e-epic30-20260516-cursor-dev.md"` (or operator-approved equivalent). This is an **E2E test artifact**, not production knowledge.
2. **Rule 4 — bulk frontmatter:** Patch **all 77** notes listed under **Rule 4 — Missing required frontmatter** in the report so each has valid PAKE critical fields per `specs/cns-vault-contract/modules/vault-lint.md` and `AGENTS.md` §3.
3. **Minimum fields** (user focus + spec): every patched note must have non-empty valid **`pake_id`**, **`pake_type`**, **`confidence_score`** (0.0–1.0), **`verification_status`**, **`creation_method`**, plus other critical fields the note lacks (`title`, `created`, `modified`, `status`, `tags` as applicable).
4. **Patch tool:** Use **`vault_update_frontmatter`** only for governed merges (no raw `fs.writeFile` on note bodies). One call per note (or batched per MCP contract if supported).
5. **Suggested values:** Follow **`vault-lint.md` § Rule 4** defaults:
   - `pake_id`: new UUID v4 when missing.
   - `pake_type`: `WorkflowNote` under `01-Projects/` or `02-Areas/`; `SourceNote` under `03-Resources/` when inferring missing type.
   - `confidence_score`: `0.7` when missing (document in completion notes if you use a different operator-approved default).
   - `verification_status`: `pending` for legacy unreviewed content unless note is clearly operator-verified → `verified`.
   - `creation_method`: `hybrid` when unknown.
   - `modified`: `2026-05-17` (or run date).
   - `tags`: `["lint-auto"]` minimum when missing (operator may refine later).
   - **`title`**: derive from first `#` heading or filename when missing.
   - **`created` / `modified`**: use file metadata or `2026-05-17` when unknowable; must be `YYYY-MM-DD`.
   - **`status`**: map invalid values (`parked`, `operational`, `reference`, `active`, `approved`) to nearest valid enum (`draft`, `in-progress`, `reviewed`, `archived`) and note mapping in completion log.
6. **Invalid enums:** Fix `invalid_verification_status: approved` on `03-Resources/CNS-Workflow-Map.md` → `verified` (or `pending` if content unreviewed).
7. **Post-remediation lint:** Re-run **`/vault-lint`** in `#hermes` (or equivalent scan). **Rule 1 ERROR count = 0** and **Rule 4 ERROR count = 0** for the same critical missing-field classes (warnings for orphans/stale pending may remain — out of scope for this story).
8. **Verification gate:** `npm test` (≥606 Vitest + node tests) and `bash scripts/verify.sh` pass with **no** test file changes unless a regression forces a fixture fix (unlikely).
9. **Audit:** Each `vault_update_frontmatter` success appends to `_meta/logs/agent-log.md` per WriteGate (expected).

## Tasks / Subtasks

- [ ] Read full **`vault-lint-2026-05-17.md`** ERRORS section (Rule 1 + Rule 4); build checklist of 1 delete + 77 patch paths.
- [ ] Execute **Rule 1** delete of `03-Resources/e2e-epic30-20260516-cursor-dev.md`.
- [ ] For each Rule 4 path: `vault_read_frontmatter` → compute missing fields → `vault_update_frontmatter` with merge-safe updates.
- [ ] Handle edge cases: notes with partial frontmatter, invalid `status`, `pake_id_not_uuid_v4` (Operator-Profile — fix UUID if in the 77 set).
- [ ] Re-run `/vault-lint`; capture summary counts in Dev Agent Record.
- [ ] Run `npm test` and `bash scripts/verify.sh`.
- [ ] Standing task: Operator guide — **no update required** unless operator wants lint remediation documented (not in AC).

## Dev Notes

### Rule 1 detail (from report)

```
Duplicate source_uri: https://en.wikipedia.org/wiki/Model_Context_Protocol
  - 03-Resources/e2e-epic30-20260516-cursor-dev.md (created: 2026-05-16)  ← DELETE
  - 03-Resources/e2e-epic30-dedup-test.md (created: 2026-05-16)           ← KEEP
```

### Rule 4 scope

- **77 ERROR rows** in report § **Rule 4 — Missing required frontmatter** (lines ~39–~455 in `vault-lint-2026-05-17.md`).
- Report `Fix:` JSON often shows only `"modified"` — treat that as **minimum**; dev must supply **all** missing critical fields per lint finding text (e.g. `missing_pake_id, missing_pake_type, ...`).
- **Out of scope:** Rule 2 orphans (60 WARNINGs), Rule 3 stale pending (22 WARNINGs) → story **34-3**.
- **Out of scope:** Rule 4 **pake_id format** WARNING on `Operator-Profile.md` unless it blocks ERROR clearance.

### MCP workflow pattern

```
1. vault_read_frontmatter { path }
2. vault_update_frontmatter { path, updates: { ...fields, modified: "2026-05-17" } }
```

- Preserve unspecified frontmatter keys (merge semantics).
- Do **not** use `vault_create_note` (would replace body).
- Do **not** write under `AI-Context/`, `_meta/schemas/`, or `_meta/logs/` except via audit side-effect.

### Path resolution

- All paths **vault-relative** POSIX (`01-Projects/...`, `02-Areas/...`, `03-Resources/...`).
- Report truncates long paths with `…` — use full path from JSON `Fix:` block on each bullet.

### WriteGate

- Governed folders only; delete of E2E duplicate is **filesystem** per lint spec (not `vault_move` unless operator forbids shell delete).
- Secret scan still applies to frontmatter string values on update.

### Test baseline

- Current gate: **606** Vitest + **74** node tests; `verify.sh` exit 0.

### Anti-patterns

- Do not bulk-edit markdown bodies.
- Do not skip notes because report Fix JSON looks minimal.
- Do not mark story done without re-lint showing Rule 1 + Rule 4 **ERROR** zero.

### References

- [Source: `Knowledge-Vault-ACTIVE/_meta/reports/vault-lint-2026-05-17.md`]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md` — Rules 1, 4]
- [Source: `specs/cns-vault-contract/AGENTS.md` — §3 Frontmatter Template]
- [Source: `_bmad-output/implementation-artifacts/29-5-vault-lint-hermes-skill-and-vault-log-write.md` — read-only lint vs mutator separation]

## Dev Agent Record

### Agent Model Used

_(fill on implementation)_

### Completion Notes List

_(fill on implementation — include re-lint summary table)_

### File List

- `Knowledge-Vault-ACTIVE/03-Resources/e2e-epic30-20260516-cursor-dev.md` (deleted)
- Up to 77 governed notes under `01-Projects/`, `02-Areas/`, `03-Resources/` (frontmatter only)
- `_meta/logs/agent-log.md` (audit lines from updates)

## Change Log

- 2026-05-17: Story created for Epic 34 — critical vault-lint remediation from 2026-05-17 report.
