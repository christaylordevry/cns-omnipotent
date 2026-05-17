---
story_id: 34-2
epic: 34
title: vault-lint-remediation-critical-issues
status: in-progress
---

# Story 34.2: Vault lint remediation — critical issues

Status: in-progress

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

- [x] Read full **`vault-lint-2026-05-17.md`** ERRORS section (Rule 1 + Rule 4); build checklist of 1 delete + 77 patch paths.
- [x] Execute **Rule 1** delete of `03-Resources/e2e-epic30-20260516-cursor-dev.md`.
- [x] For each Rule 4 path: `vault_read_frontmatter` → compute missing fields → `vault_update_frontmatter` with merge-safe updates.
- [x] Handle edge cases: notes with partial frontmatter, invalid `status`, `pake_id_not_uuid_v4` (Operator-Profile — fix UUID if in the 77 set).
- [x] Re-run `/vault-lint`; capture summary counts in Dev Agent Record.
- [x] Run `npm test` and `bash scripts/verify.sh`.
- [x] Standing task: Operator guide — **no update required** unless operator wants lint remediation documented (not in AC).

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

Composer (Cursor dev-story workflow)

### Completion Notes List

**Rule 1:** Deleted `03-Resources/e2e-epic30-20260516-cursor-dev.md` via filesystem (`rm -f`). Kept `03-Resources/e2e-epic30-dedup-test.md`.

**Rule 4:** Patched all **77** report paths via `vaultUpdateFrontmatter` (WriteGate + PAKE + audit, surface `story-34-2`). Defaults: `confidence_score` **0.7** when missing; `creation_method` **hybrid**; `tags` **["lint-auto"]** when empty; new UUID v4 for missing/invalid `pake_id` (incl. Operator-Profile).

**Extra (AC6 / invalid enums):** `CNS-Workflow-Map.md` `verification_status` **approved → verified**. Also fixed `stable` status on `CNS-Operator-Guide.md` and `Vault-Intelligence-Discovery-Workflow.md` (coerced `created`/`modified` to string dates for PAKE write).

**Status mappings (invalid → valid):** `parked→draft`, `operational→in-progress`, `reference→reviewed`, `active→in-progress` (36 notes; see script log).

**Post-remediation lint (equivalent scan, `scripts/vault-lint-remediate-34-2.ts` verifier):**

| Rule | ERROR count |
|------|-------------|
| Rule 1 duplicate `source_uri` | **0** |
| Rule 4 missing critical fields (77 remediated paths) | **0** |
| Rule 4 vault-wide (informational) | **0** |

Operator should run `/vault-lint` in `#hermes` to refresh on-disk report; Rule 2/3 warnings expected unchanged.

**Verification:** `npm test` — 606 Vitest passed; `bash scripts/verify.sh` — VERIFY PASSED. No test file changes.

**Audit:** 233 `vault_update_frontmatter` lines with `surface: story-34-2` in `_meta/logs/agent-log.md`.

### File List

- `Knowledge-Vault-ACTIVE/03-Resources/e2e-epic30-20260516-cursor-dev.md` (deleted)
- 77 governed notes under `01-Projects/`, `02-Areas/`, `03-Resources/` (frontmatter only; paths from `vault-lint-2026-05-17.md` Rule 4 Fix JSON)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (status + date coercion)
- `Knowledge-Vault-ACTIVE/03-Resources/Vault-Intelligence-Discovery-Workflow.md` (status + date coercion)
- `Knowledge-Vault-ACTIVE/_meta/logs/agent-log.md` (audit lines)
- `scripts/vault-lint-remediate-34-2.ts` (implementation helper; optional to keep)

### Review Findings

- [x] [Review][Decision] AC7 closure — **B selected (2026-05-17):** Block `done` until `/vault-lint` runs in `#hermes` and on-disk report shows Rule 1 + Rule 4 ERROR = 0. **Closed 2026-05-17 (re-review):** `vault-lint-2026-05-17.md` summary lines show Rule 1 = 0 errors, Rule 4 = 0 errors; `## ERRORS` section empty.

- [x] [Review][Patch] Commit or drop remediation script — committed `scripts/vault-lint-remediate-34-2.ts` (code review batch-apply).

- [x] [Review][Patch] Idempotent re-runs cause audit noise — `buildUpdates()` now emits only missing/invalid fields; re-run skips compliant notes (verified 2026-05-17).

- [x] [Review][Dismiss] Stale canonical lint report — on-disk report refreshed; no longer blocked.

- [ ] [Review][Patch] Post-success script re-run hard-fails — `parseRule4Paths()` returns 0 when report has no Rule 4 `Fix:` JSON (clean report); `main()` throws `Expected 77 Rule 4 paths, got 0`. Add `--verify-only` or skip path parsing when report summary shows Rule 4 = 0. [`scripts/vault-lint-remediate-34-2.ts`:342-344]

- [x] [Review][Defer] Duplicated Rule 4 checks in script — `rule4Findings()` mirrors `vault-lint.md` locally; drift risk if spec changes. Prefer shared module in a future story. [`scripts/vault-lint-remediate-34-2.ts`:221-244] — deferred, pre-existing one-off pattern

- [x] [Review][Defer] Report JSON coupling — `parseRule4Paths()` depends on exact `Fix:` JSON shape in the lint report; brittle if Hermes output format changes. [`scripts/vault-lint-remediate-34-2.ts`:47-57] — deferred, pre-existing

## Change Log

- 2026-05-17: Story created for Epic 34 — critical vault-lint remediation from 2026-05-17 report.
- 2026-05-17: Implemented Rule 1 delete + 77 Rule 4 `vault_update_frontmatter` patches; equivalent re-lint Rule 1/4 ERROR zero; verify gate passed.
- 2026-05-17: Code review — 1 decision-needed, 3 patch, 2 defer; vault state verified, on-disk report still stale.
- 2026-05-17: Re-review — AC7 closed (canonical report 0/0); 1 patch left as action item (`--verify-only`); status → in-progress.
