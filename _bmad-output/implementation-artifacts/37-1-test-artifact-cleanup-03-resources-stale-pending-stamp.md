---
story_id: 37-1
epic: 37
title: test-artifact-cleanup-03-resources-stale-pending-stamp
status: done
---

# Story 37.1: Test artifact cleanup + 03-Resources stale pending stamp

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want **E2E test fixtures removed from `03-Resources/`** and the **remaining `03-Resources/` Rule 3 stale-pending queue cleared**,  
so that **vault lint Rule 3 for this cluster reaches zero** and the Resources tree holds only durable knowledge.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 37: 03-Resources Vault Close-Out |
| **Phase** | 6 |
| **Story class** | **Operator / vault hygiene** — no repo code unless optional batch script |
| **Predecessor** | **36-3** left **4** Rule 3 stale-pending paths in `03-Resources/` (01/02 cleared); **34-2** kept `e2e-epic30-dedup-test.md` during Rule 1 duplicate fix — now delete both epic-30 dedup artifacts |
| **Lint baseline** | `Knowledge-Vault-ACTIVE/_meta/reports/vault-lint-2026-05-18.md` (post-36-3): Rule 3 **4** paths in `03-Resources/`; Rule 2 **27** vault-wide orphans (37-2 scope) |
| **Vault root** | `CNS_VAULT_ROOT` → `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` |
| **Evidence artifact** | `_bmad-output/implementation-artifacts/epic-37-03-resources-cleanup-evidence.md` |

**Critical:** Phase 1 Vault IO has **no** `vault_delete` / `vault_trash` tool (`CNS-Phase-1-Spec.md` § Security; Story **27-6**, **4-8**). Deletes are **operator filesystem** (`rm -f`) with a **mandatory** `vault_log_action` audit line per deletion — not Hermes triage automation.

## Acceptance Criteria

### Part A — Delete test artifacts (5 notes)

1. **Confirm paths exist** on live vault via `vault_read` or `vault_list` scoped to `03-Resources/` before delete.
2. **Delete exactly these five** E2E fixtures (no knowledge value):

   | # | Path |
   |---|------|
   | 1 | `03-Resources/e2e-epic30-dedup-test.md` |
   | 2 | `03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md` |
   | 3 | `03-Resources/vault-graduate-confirmed-working-via-discord-gateway-slash-less-invocation-uses-skill-name-form.md` |
   | 4 | `03-Resources/weapons-check-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md` |
   | 5 | `03-Resources/_e2e-27-7-disposable.md` |

3. **Delete method:** `rm -f "<VAULT_ROOT>/<relative_path>"` for each file (same class as Story **34-2** Rule 1 delete). Do **not** use triage discard, Obsidian bulk unlink, or hypothetical MCP delete tools.
4. **Audit per deletion:** Immediately after each successful `rm`, call **`vault_log_action`** with:
   - `action`: `delete` (or `fs_delete`)
   - `tool_used`: `operator_fs` (or `vault_log_action`)
   - `target_path`: vault-relative path
   - `details`: short reason, e.g. `e2e_fixture_epic37_1` + story id `story-37-1`
   - Surface in log should identify operator/dev run (match **34-2** / **36-3** `story-36-3` pattern).
5. **Post-delete verify:** `vault_read` on each path returns **NOT_FOUND** (or equivalent).
6. **Part A evidence:** Table in evidence artifact: path, delete command timestamp (UTC), `vault_log_action` line reference or `logged_at`.

### Part B — Stamp 4 stale pending in `03-Resources/`

7. **Queue** (from post-36-3 lint; re-confirm with live `/vault-lint` if counts differ):

   | Path | Days pending (baseline) | Notes |
   |------|-------------------------|-------|
   | `03-Resources/AI-Shared-Brain-Architecture.md` | 30 | WorkflowNote or InsightNote — read `pake_type` before stamp |
   | `03-Resources/Obsidian-Claude-Code-Personal-OS.md` | 51 | Same |
   | `03-Resources/_e2e-27-7-disposable.md` | — | **Skip if deleted in Part A** (delete takes priority) |
   | `03-Resources/building-with-gemini-embedding-2-agentic-multimodal-rag-and-beyond.md` | 16 | Live URL ingest E2E (26-6); stamp after operator judgment |

8. **Per remaining path:** Set `verification_status` to **`verified`** or **`disputed`** via **`vault_update_frontmatter`** only (`verification_status` + `modified`); do not edit bodies.
9. **SynthesisNote exception:** If any path is `SynthesisNote`, optional **`/verify verified|disputed <path>`** in `#hermes` instead of MCP (same as **34-3** / **36-3**).
10. **Completion:** No targeted path left `pending`.
11. **Part B evidence:** Extend same evidence file with path, `pake_type`, days_pending, decision, method, UTC timestamp; disputed rows need one-line rationale.
12. **Post-run lint:** Operator runs **`/vault-lint`** in `#hermes`; **Rule 3 count = 0** for `03-Resources/` stale-pending class (fresh ingest pending out of scope).
13. **Evidence artifact** at **`_bmad-output/implementation-artifacts/epic-37-03-resources-cleanup-evidence.md`** (Parts A + B + lint excerpt: Rule 3 before/after).
14. **Repo gate:** **Not a code story.** If no repo files change: no `npm test` required. If any repo file changes (optional script, evidence only in `_bmad-output/` is fine): run **`npm test`** and **`bash scripts/verify.sh`** before done claim.

**Out of scope:** Topic hub indexes (Story **37-2**), bulk Rule 2 orphan pass, changing vault-lint rules, deleting non-listed production notes.

## Tasks / Subtasks

### Part A
- [x] Confirm Hermes gateway optional (MCP-only path OK for stamp; lint refresh still via `#hermes` if available)
- [x] Verify five paths exist; record in evidence
- [x] For each path: `rm -f` + `vault_log_action` audit line
- [x] Confirm NOT_FOUND on all five

### Part B
- [x] Skip `_e2e-27-7-disposable.md` if Part A deleted it
- [x] `vault_read_frontmatter` on each stamp target; apply judgment table (below)
- [x] `vault_update_frontmatter` (surface `story-37-1`) for each remaining path
- [x] Write / finalize evidence artifact
- [x] `/vault-lint` post-run; paste Rule 3 summary into evidence
- [x] Standing task: Operator guide — **no update required** unless operator wants E2E cleanup documented

## Dev Notes

### Delete + audit pattern (normative)

Phase 1 does **not** implement `vault_delete`. User brief “vault_delete or direct fs remove” means:

1. **Filesystem delete** under `CNS_VAULT_ROOT`
2. **`vault_log_action`** for audit trail (Story **5-2** — metadata-only `details`, no secrets)

Example sequence per file:

```text
rm -f "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/e2e-epic30-dedup-test.md"
vault_log_action(action=delete, tool_used=operator_fs, target_path=03-Resources/e2e-epic30-dedup-test.md, details=story-37-1 e2e_fixture)
```

Optional: single batch script under `scripts/` mirroring `scripts/vault-lint-remediate-34-2.ts` DELETE_REL pattern — must still call audit logger per file.

### Judgment guidance (Part B)

| Path | Suggested stamp | Rationale |
|------|-----------------|-----------|
| `AI-Shared-Brain-Architecture.md` | `verified` | Durable architecture reference (docs/Nexus guide links) |
| `Obsidian-Claude-Code-Personal-OS.md` | `verified` | Durable PKM reference |
| `building-with-gemini-embedding-2-...md` | `verified` or `disputed` | Real ingest artifact; keep if URL summary still useful; `disputed` if superseded by newer embedding research |
| `_e2e-27-7-disposable.md` | N/A if deleted | E2E triage fixture — **delete**, do not stamp |

### `/verify` vs MCP

Same as **36-3**: `/verify` marking tokens apply to **`SynthesisNote`** in `03-Resources/` only. Expect Part B targets to be **WorkflowNote**, **InsightNote**, or **SourceNote** → **`vault_update_frontmatter`**.

### References

- [Source: `_bmad-output/implementation-artifacts/34-2-vault-lint-remediation-critical-issues.md` — fs delete + audit]
- [Source: `_bmad-output/implementation-artifacts/36-3-projects-areas-stale-pending-hub-indexes.md` — stamp pattern]
- [Source: `_bmad-output/implementation-artifacts/epic-36-retro-2026-05-20.md` — 4 Rule 3 paths in 03-Resources]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md` — Rule 3]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — no delete MCP]

## Dev Agent Record

### Agent Model Used

Composer (Cursor dev-story workflow)

### Completion Notes List

**Part A:** Deleted all five E2E fixtures via `rm -f` under live vault; five `vault_log_action` audit lines (`action=delete`, `tool_used=operator_fs`, surface `story-37-1`). Post-delete `vaultReadFile` confirmed NOT_FOUND on each path.

**Part B:** Stamped three remaining notes `verified` via `vaultUpdateFrontmatter` (`modified=2026-05-21`). Skipped `_e2e-27-7-disposable.md` (Part A delete). All targets were SourceNote; no `/verify` Discord path needed.

**Rule 3:** Equivalent post-run scan (vault-lint.md Rule 3 logic) shows **0** stale-pending paths in `03-Resources/` and **0** vault-wide. Operator should run `/vault-lint` in `#hermes` to refresh on-disk report.

**Verification:** `npm test` and `bash scripts/verify.sh` passed (optional batch script added).

**Operator guide:** No update required.

### File List

- `scripts/epic-37-1-03-resources-cleanup.ts` (new)
- `_bmad-output/implementation-artifacts/epic-37-03-resources-cleanup-evidence.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status)
- `_bmad-output/implementation-artifacts/37-1-test-artifact-cleanup-03-resources-stale-pending-stamp.md` (this file)

### Change Log

- 2026-05-21: Story 37-1 — deleted five 03-Resources E2E fixtures; stamped three stale-pending notes verified; Rule 3 cluster at zero.

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

### Review Findings

- [x] [Review][Decision] AC12 — Hermes `/vault-lint` satisfied (2026-05-21): ERRORS 0, Rule 3 stale pending 0; excerpt pasted in `epic-37-03-resources-cleanup-evidence.md`.

- [x] [Review][Patch] Mislabeled “vault-wide” Rule 3 metric [`scripts/epic-37-1-03-resources-cleanup.ts`] — Fixed: scan now walks 01/02/03 governed scope; evidence table labels 03-Resources vs vault-wide separately.

- [x] [Review][Patch] Pre-delete table hardcodes `pending` [`scripts/epic-37-1-03-resources-cleanup.ts`:150] — Fixed: reads `verification_status` from frontmatter before delete.

- [x] [Review][Defer] No unit test for batch script [`scripts/epic-37-1-03-resources-cleanup.ts`] — Matches other epic hygiene scripts (34-2, 36-3); `npm test` passes but does not exercise this path. deferred, pre-existing pattern

- [x] [Review][Defer] Script not idempotent on re-run [`scripts/epic-37-1-03-resources-cleanup.ts`:147-148] — Second run throws on missing delete targets. Acceptable for one-shot operator batch; document in script header or add `--dry-run`. deferred, pre-existing pattern

- [x] [Review][Defer] Uncommitted repo changes outside story File List [`specs/cns-vault-contract/AGENTS.md`, `_bmad-output/planning-artifacts/epics.md`] — Not part of 37-1 deliverables; keep out of this story’s commit. deferred, pre-existing
