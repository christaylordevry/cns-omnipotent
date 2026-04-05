# Story 6.2: Fixture vault integration tests

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a **maintainer**,  
I want **integration tests against `tests/fixtures/minimal-vault/`**,  
so that **regressions on boundaries, secrets, audit, and search cap are caught in CI**.

## Acceptance Criteria

1. **Given** a reproducible fixture vault rooted at `tests/fixtures/minimal-vault/`  
   **When** integration tests run in CI or local dev  
   **Then** the fixture is built from committed files or a deterministic builder script, not from the operator's real vault  
   **And** test execution never depends on machine-local vault state (isolation guarantee).

2. **Given** the fixture layout contract for Story 6.2  
   **When** fixture setup completes  
   **Then** it includes:
   - one note per PAKE type in the correct routed directory,
   - at least one Inbox note without frontmatter,
   - at least one daily note,
   - pre-created `_meta/logs/agent-log.md`,
   - `AI-Context/` with a minimal `AGENTS.md` stub,
   - protected paths present but empty (for example `AI-Context/modules/`, `_meta/schemas/`).

3. **Given** the nine registered Phase 1 tools (`vault_search`, `vault_read`, `vault_read_frontmatter`, `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, `vault_list`, `vault_move`, `vault_log_action`)  
   **When** Story 6.2 integration tests execute  
   **Then** each tool has at least one integration test that exercises the real call chain (tool handler -> policies/write gate -> filesystem path -> return)  
   **And** each mutation path verifies append-only audit log behavior on `_meta/logs/agent-log.md`.

4. **Given** strict input contracts for registered tools  
   **When** callers send unsupported extra keys in at least one negative integration case  
   **Then** the call fails with the expected validation error shape  
   **And** this "extra-key throw" coverage is an explicit test task in the suite.

5. **Given** architecture performance guidance for fixture operations (NFR-P3)  
   **When** single-note read/write/move flows run on the fixture  
   **Then** results remain within documented interactive expectations  
   **And** `bash scripts/verify.sh` passes with the new integration suite.

## Tasks / Subtasks

- [x] Task 1: Lock fixture-vault structure before writing test cases (AC: 1, 2)
  - [x] **Authoring mode:** committed static files under `tests/fixtures/minimal-vault/`; tests copy into `mkdtemp` per case (`fs.promises.cp` recursive).
  - [x] Build fixture tree under `tests/fixtures/minimal-vault/` with required directories from Story AC2.
  - [x] Add one routed note per PAKE type:
    - [x] `SourceNote` in `03-Resources/`
    - [x] `InsightNote` in `03-Resources/`
    - [x] `SynthesisNote` in `03-Resources/`
    - [x] `WorkflowNote` in `01-Projects/p-fix/`
    - [x] `ValidationNote` in `03-Resources/`
  - [x] Add at least one Inbox raw-capture file in `00-Inbox/` with no frontmatter.
  - [x] Add at least one daily note in `DailyNotes/2026-01-15.md` (pinned date for fake-timer append test).
  - [x] Pre-create `_meta/logs/agent-log.md` (empty) and assert append behavior in tests.
  - [x] Ensure `AI-Context/AGENTS.md` exists as a minimal stub.
  - [x] Ensure protected paths exist but are empty aside from `.gitkeep`: `AI-Context/modules/`, `_meta/schemas/`.

- [x] Task 2: Build isolated integration harness (AC: 1, 3)
  - [x] Rehydrate fixture into a temp test vault per test case.
  - [x] Wire `RuntimeConfig` with `vaultRoot` + `defaultSearchScope: "03-Resources"`; `registerVaultIoTools`.
  - [x] No use of `Knowledge-Vault-ACTIVE/`.

- [x] Task 3: Add integration coverage for all nine tools (AC: 3)
  - [x] `vault_search`: default scope + marker query.
  - [x] `vault_read`: inbox body + `VAULT_BOUNDARY` on traversal.
  - [x] `vault_read_frontmatter`: multi-path `results` payload.
  - [x] `vault_create_note`: new `SourceNote` under `03-Resources/`.
  - [x] `vault_append_daily`: fake timer `2026-01-15`, section `Agent Log`.
  - [x] `vault_update_frontmatter`: merge `ai_summary` on fixture note.
  - [x] `vault_list`: `03-Resources` non-recursive.
  - [x] `vault_move`: `movable-note.md` → `movable-note-renamed.md`.
  - [x] `vault_log_action`: explicit audit line (`tool_used` maps to log `tool` column).

- [x] Task 4: Enforce mutation-audit verification in integration tests (AC: 3)
  - [x] Each mutator asserts log growth and expected `tool` pipe segment (`vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, `vault_move`; `vault_log_action` asserts `fixture_test` as logged tool per Story 5.2 mapping).
  - [x] NFR-S3: raw create body marker and daily append marker absent from full `agent-log.md`; `ai_summary` value absent after frontmatter update.

- [x] Task 5: Add explicit extra-key negative test (AC: 4)
  - [x] `vault_update_frontmatter.inputSchema.safeParse` with `evil_extra_key`; expect `unrecognized_keys`; note + audit unchanged.
  - [x] Carry-over from Story 6.1 residual: keep explicit "extra-key negative" coverage visible in this suite as the agreed location (schema strict-sweep across all nine registered tools).

- [x] Task 6: Verify and capture results (AC: 5)
  - [x] `bash scripts/verify.sh` passed (includes Vitest + typecheck + build).
  - [x] No dedicated p95 harness in this story (optional follow-up).

### Implementation note: strict tool inputs (AC 4 alignment)

All Phase 1 MCP tool `inputSchema` objects use **Zod `.strict()`** so unknown keys fail validation the same way as the MCP SDK’s `validateToolInput` path. Integration tests parse with `tool.inputSchema.parse(args)` before calling `.handler`, matching production argument shaping.

## Dev Notes

### First implementation decision (blocking)

The first decision in this story is fixture vault structure and reproducibility. Do not start test case authoring until Task 1 and Task 2 establish an isolated, deterministic fixture strategy and directory contract.

### Architecture and policy guardrails

- Story 6.2 is the architecture sequence step that validates full integration behavior on fixture vaults before the final verify gate.
- All mutation paths must continue to obey Story 5.2 audit constraints and append-only semantics.
- Tool surface for coverage must stay aligned to Story 6.1 canonical list of nine names.

### File structure requirements

| Area | Path |
|------|------|
| Fixture vault | `tests/fixtures/minimal-vault/` |
| Integration tests | `tests/vault-io/` |
| Tool registration | `src/register-vault-io-tools.ts` |
| Audit logger | `src/audit/audit-logger.ts` |
| Verify gate | `scripts/verify.sh` |

### Testing requirements

- Integration tests must execute through registered tool handlers, not direct helper internals only.
- Keep tests deterministic by owning all input content in fixture files or deterministic setup code.
- Include at least one negative schema/validation case for "extra keys" to prevent silent contract drift.

### Previous story intelligence (6.1)

- Story 6.1 introduced and validated the canonical nine-tool surface, this story must consume that same source of truth for integration coverage accounting.
- `registerVaultIoTools` return shape is already test-friendly, use it to keep integration harness stable and avoid ad hoc registration logic.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 6, Story 6.2]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - fixture vault, integration tests, NFR-P3]
- [Source: `_bmad-output/implementation-artifacts/6-1-register-full-phase-1-tool-surface.md` - canonical nine-tool surface]
- [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` - mutation audit requirements]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` - tool contracts and security boundaries]

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude) — dev-story implementation, 2026-04-03.

### Debug Log References

None.

### Completion Notes List

- Committed fixture `tests/fixtures/minimal-vault/` (PAKE types, inbox sans frontmatter, daily, audit file, AGENTS stub, empty protected dirs).
- Added `tests/vault-io/fixture-vault-integration.test.ts`: nine-tool coverage, audit assertions, strict extra-key case.
- Added temp-vault teardown (`rm -rf` after each test) for `mkdtemp` isolation copies to prevent WSL temp leakage/state bleed.
- Strengthened strict-contract coverage with a full nine-tool `.strict()` negative sweep (`unexpected_extra_key` rejected with `unrecognized_keys`).
- NFR-S3 assertions now use credential-shaped marker content and assert absence from full raw `_meta/logs/agent-log.md`.
- Applied `.strict()` to all registered tool input schemas plus `vaultAppendDailyInputSchema` / `vaultLogActionInputSchema`.
- `bash scripts/verify.sh` green.

### File List

- `tests/fixtures/minimal-vault/**`
- `tests/vault-io/fixture-vault-integration.test.ts`
- `src/register-vault-io-tools.ts`
- `src/tools/vault-append-daily.ts`
- `src/tools/vault-log-action.ts`
- `_bmad-output/implementation-artifacts/6-2-fixture-vault-integration-tests.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
