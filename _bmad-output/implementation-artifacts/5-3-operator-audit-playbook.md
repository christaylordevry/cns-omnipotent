# Story 5.3: Operator audit playbook

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide for Epic 5 Story 5.3. -->

## Story

As a **maintainer**,  
I want **documentation for reading and manually archiving audit logs**,  
so that **long-running vaults stay maintainable**.

## Acceptance Criteria

1. **Given** Phase 1 append-only audit behavior in `src/audit/audit-logger.ts` and WriteGate policy in `src/write-gate.ts`  
   **When** an operator reads the new playbook  
   **Then** it explains the on-disk audit line format (`[ISO8601] | action | tool | surface | target_path | payload_summary`) and how to interpret each field for troubleshooting  
   **And** it includes at least one concrete correlation walkthrough from a changed note path to matching log lines (FR23).

2. **Given** FR24 allows human maintenance of `_meta/logs/agent-log.md`  
   **When** the operator follows the playbook for manual trim or archive  
   **Then** the documented workflow uses human-run file operations (outside Vault IO mutator tools) and does not require any code change that weakens append-only guarantees for agents  
   **And** the playbook clearly distinguishes human maintenance from agent/tool writes (FR24, NFR-S3).

3. **Given** Story 5.2 is bound as normative mutation-audit behavior  
   **When** this story lands  
   **Then** docs and references remain aligned with `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`, `specs/cns-vault-contract/CNS-Phase-1-Spec.md`, and `specs/cns-vault-contract/modules/security.md`  
   **And** no guidance suggests direct agent edits to `_meta/logs/` or logging full payload content.

4. **Given** operators need practical diagnostics  
   **When** the playbook is used during incidents  
   **Then** it includes a short command cookbook for safe log inspection (for example: date filtering, tool filtering, target path filtering) and expected pitfalls (pipe delimiter in free text already sanitized, payload is summary not full content)  
   **And** examples are compatible with WSL usage and repository conventions.

## Tasks / Subtasks

- [x] Author operator-facing audit playbook document (AC: 1, 2, 4)
  - [x] Create new playbook doc under `specs/cns-vault-contract/` (recommended: `specs/cns-vault-contract/AUDIT-PLAYBOOK.md`) with sections: purpose, line format, investigation workflow, manual archive workflow, safety boundaries, quick commands.
  - [x] Include at least one end-to-end example mapping a note mutation (`target_path`) to a matching log line and likely source tool.
  - [x] Include explicit "what not to do" guidance: do not use Vault IO mutator tools to rewrite old logs, do not store secrets in details fields, do not expect payload summary to contain full note body.

- [x] Wire playbook into operator entry points (AC: 1, 3)
  - [x] Update `specs/cns-vault-contract/README.md` with a link to the playbook in the operator workflow section.
  - [x] Add or update references in `specs/cns-vault-contract/modules/security.md` and any nearby Phase 1 ops docs so FR23/FR24 guidance is discoverable.

- [x] Validate policy and implementation alignment (AC: 2, 3)
  - [x] Reconfirm current guardrails still hold: only `appendRecord` can write to `_meta/logs/agent-log.md` through WriteGate `audit-append`.
  - [x] Ensure playbook language does not imply relaxing `PROTECTED_PATH` constraints or enabling agent-side log cleanup.
  - [x] Add a brief implementation note in this story if no code change is required for FR24 (documentation-only completion is acceptable when alignment is explicit).

- [x] Verification and quality gate (AC: 1, 2, 3, 4)
  - [x] Run `bash scripts/verify.sh` and record result in completion notes.
  - [x] If any docs/tests are added for playbook discoverability, ensure they pass with the same verify run.

## Dev Notes

### Architecture and policy context

- `architecture.md` explicitly sets `_meta/logs/agent-log.md` as append-only via `AuditLogger`, and also states humans may archive/trim logs (manual maintenance path).
- `write-gate.ts` must remain the single policy gate; this story should not introduce a bypass for agent-initiated edits.
- Story 5.2 is already complete and bound as normative for mutation logging behavior and payload minimization.

### Implementation guardrails for this story

- This is expected to be primarily a **documentation story**. Code changes are only needed if a concrete mismatch is found between docs and enforced behavior.
- If touching runtime code, avoid any change that allows tool-driven overwrite/delete on `_meta/logs/**`.
- Preserve stable error contract (`PROTECTED_PATH`, `IO_ERROR`, etc.) and append-only semantics.

### Suggested playbook content outline

1. Purpose and scope (operator diagnostics + maintenance only).
2. Audit line format and field semantics.
3. Troubleshooting workflow:
   - Start from note path.
   - Filter by `target_path`.
   - Narrow by time window.
   - Validate tool + action sequence.
4. Manual maintenance workflow (copy/archive/trim by human shell operations).
5. Risk controls and rollback suggestions.
6. FAQ on common misconceptions (payload summary limits, why mutators do not expose bulk log cleanup).

### Testing requirements

- No new unit test is strictly required if completion is docs-only, but verify gate remains mandatory.
- If tests are added, scope them to behavior assertions already covered by Epic 4/5 boundaries, not redundant snapshot churn.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR23, FR24, NFR-S3]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — audit logger design + manual maintenance note]
- [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` — bound mutation audit spec]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — audit contract and Phase 1 checklist]
- [Source: `specs/cns-vault-contract/modules/security.md` — hard rules for logging and protected paths]
- [Source: `src/audit/audit-logger.ts`]
- [Source: `src/write-gate.ts`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- **Documentation-only (FR24):** No runtime code changes. WriteGate still allows only `appendRecord` with `purpose: "audit-append"` and operation `create` or `append` on exactly `_meta/logs/agent-log.md`; all other `_meta/logs/**` tool writes remain `PROTECTED_PATH` (`src/write-gate.ts` lines 141–157).
- Added `specs/cns-vault-contract/AUDIT-PLAYBOOK.md` with line format, FR23 walkthrough, human-only archive/trim, safety table, WSL command cookbook, pitfalls, and “what not to do.”
- Linked playbook from `specs/cns-vault-contract/README.md` (operator workflow section + Files table), `modules/security.md`, and `CNS-Phase-1-Spec.md` § Story 5.2.
- **`bash scripts/verify.sh`:** PASSED (2026-04-03); re-run after review edits (2026-04-02).

### File List

- `specs/cns-vault-contract/AUDIT-PLAYBOOK.md`
- `specs/cns-vault-contract/README.md`
- `specs/cns-vault-contract/modules/security.md`
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5-3-operator-audit-playbook.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/README.md` (synced from specs mirror, 2026-04-02)

## Change Log

- 2026-04-03: Story created and context-complete for dev handoff.
- 2026-04-03: Implemented operator audit playbook and spec cross-links; verify.sh green; status → review.
- 2026-04-02: Code review: FR23 example cross-linked to `audit-logger` tests; §5 explicit “no MCP log trim”; §7 tool-column wording fixed; ripgrep PATH note; `grep` cookbook exercised on fixture line; pipe sanitisation verified against `sanitizeAuditFreeText`; planning `README.md` synced from `specs/cns-vault-contract/README.md`. Status → done.

---

## Code review (documentation)

**Reviewer checklist (addressed in this pass):**

1. **FR23 walkthrough** — Example line field order matches `formatAuditLine` (`[iso] | action | tool | surface | targetPath | payloadSummary`). Playbook now points operators at `tests/vault-io/audit-logger.test.ts` for a ground-truth `appendRecord` line shape; illustrative JSON in the example remains plausible for `vault_update_frontmatter` summaries.
2. **Pipe sanitisation** — Matches implementation: `sanitizeAuditFreeText` in `audit-logger.ts` replaces `|`, CR, and LF with spaces on all free-text columns including `payload_summary` after truncation.
3. **FR24 human-only** — §5 states explicitly that Phase 1 exposes no MCP tool for log rotation/trim and that agents must not use Vault IO for that; §6/§8 reinforce `PROTECTED_PATH` on `_meta/logs/**` except audit-append on `agent-log.md`.
4. **WSL recipes** — `tail`, `grep -F`, `grep '^\[DATE'`, and `grep -c` were run successfully against a single-line fixture; `rg` requires ripgrep on PATH (noted in playbook).

---

**Completion note:** Ultimate context engine analysis completed, comprehensive developer guide created.
