# Story 6.1: Register full Phase 1 tool surface

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As an **agent**,  
I want **all Phase 1 Vault IO tools available on the MCP server**,  
so that **I can complete read/write journeys without raw filesystem workarounds**.

## Acceptance Criteria

1. **Given** the normative tool definitions in `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (section **Tool Definitions**, same content as PRD FR26)  
   **When** the MCP server starts and `registerVaultIoTools` runs  
   **Then** exactly these tools are registered under these **exact** names: `vault_search`, `vault_read`, `vault_read_frontmatter`, `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, `vault_list`, `vault_move`, `vault_log_action`  
   **And** each tool exposes **Zod-validated** inputs (via `@modelcontextprotocol/sdk` `registerTool` `inputSchema`, and for handlers that double-check, `safeParse` where already used) so malformed client args fail with a structured error, not silent coercion.

2. **Given** the spec’s input field names and types for each tool  
   **When** a reviewer compares registration schemas to the spec  
   **Then** required vs optional fields and enumerations align (e.g. `vault_read_frontmatter`: exactly one of `path` or `paths`; `vault_search`: `query`, optional `scope`, optional `max_results` with int cap 50; `vault_create_note`: `title`, `content`, `pake_type`, `tags`, optional `confidence_score`, `source_uri`, and implementation extensions `project` / `area` for WorkflowNote routing per constitution)  
   **And** `vault_log_action` uses `action`, `tool_used`, optional `target_path`, optional `details` per spec; audit **line format** on disk remains the **six-field** contract from Story 5.2 (`_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`), not the shortened diagram in the Phase 1 spec box alone.

3. **Given** Epic 3–5 delivered individual tool behavior tests  
   **When** this story completes  
   **Then** a **focused regression test** (new file under `tests/vault-io/`) asserts the full registered tool **name set** matches a single canonical list (exported constant or shared test fixture) so renames or missing registrations fail CI  
   **And** `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Inventory current registration (AC: 1, 2)
  - [x] Read `src/register-vault-io-tools.ts` and `src/index.ts`; confirm all nine tools call `server.registerTool` with the correct string names.
  - [x] Cross-walk each `inputSchema` against `CNS-Phase-1-Spec.md` Tool Definitions; note any intentional extensions (e.g. `project` / `area`, config-driven default search scope) and ensure they do not violate FR26 names for the standard fields.

- [x] Normalize “source of truth” for the tool list (AC: 1, 3)
  - [x] Add `export const PHASE1_VAULT_IO_TOOL_NAMES` (or equivalent) in `src/register-vault-io-tools.ts` (or a tiny `src/phase1-tool-surface.ts` if you want zero cycle risk) listing the nine names in a stable order; use it inside `registerVaultIoTools` or in tests only—prefer one list used by both registration smoke and tests to avoid drift.

- [x] Add regression test (AC: 3)
  - [x] New test file: e.g. `tests/vault-io/phase1-tool-surface.test.ts`—construct `McpServer`, call `registerVaultIoTools(server, minimalRuntimeConfig)`, introspect registered tools per SDK (or call the exported name list + assert each registration exists if the SDK exposes handles only).
  - [x] If the MCP SDK does not expose a public tool registry iterator, validate indirectly: assert `registerVaultIoTools` return object has exactly nine keys matching the canonical names (current API already returns handles).

- [x] Fix spec drift if found (AC: 2)
  - [x] If any schema field is misnamed vs spec, align the **MCP-exposed** shape to the spec (internal mapping is OK if needed for audit/logger).
  - [x] Do not weaken WriteGate, PAKE, secret scan, or audit behavior; those are out of scope except where schema naming must match FR26.

- [x] Verification (AC: 3)
  - [x] Run `bash scripts/verify.sh` and record outcome in Dev Agent Record.

## Dev Notes

### Brownfield context (do not reinvent)

- `registerVaultIoTools` in `src/register-vault-io-tools.ts` **already** registers all nine Phase 1 tools with Zod `inputSchema` objects. This story is primarily **normative alignment and guardrails**, not greenfield scaffolding.
- Server entrypoint: `src/index.ts` loads config, constructs `McpServer`, calls `registerVaultIoTools`, connects stdio transport.

### Architecture compliance

- Stack: Node, TypeScript, `@modelcontextprotocol/sdk`, `zod` (per `architecture.md`).
- NFR-P2: `vault_search` must never default to whole-vault scan without a configured default scope; current behavior uses `cfg.defaultSearchScope` from env—do not regress.
- Mutation audit: remain consistent with `5-2-mutations-and-vault-log-action.md`; this story does not change logging payloads.

### File structure

| Area | Path |
|------|------|
| Registration | `src/register-vault-io-tools.ts` |
| Bootstrap | `src/index.ts` |
| Tool impl | `src/tools/*.ts` |
| Tests | `tests/vault-io/*.test.ts` |
| Normative spec | `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (Tool Definitions) |
| Audit field contract | `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` |

### Testing requirements

- Prefer **unit-level** surface test with minimal config (`vaultRoot` can point at a temp or fixture path that is not exercised if the test only checks registration keys).
- Epic 6 Story 6.2 will add deeper fixture integration tests; avoid duplicating full read/write flows here.

### Previous story intelligence (Epic 5)

- Story 5.3 stressed documentation and verify gate; Story 5.2 bound six-field audit lines and `vault_log_action` registration for test destructuring—keep return shape of `registerVaultIoTools` stable for tests that destructure handles.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6, Story 6.1]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — Tool Definitions, § security / FR26]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — MCP package, NFR-P2, verify gate]
- [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` — audit line and `vault_log_action`]
- [Source: `src/register-vault-io-tools.ts`]
- [Source: `src/index.ts`]

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude) — dev-story workflow, 2026-04-02.

### Debug Log References

None.

### Completion Notes List

- Confirmed all nine tools register with spec-aligned names; `index.ts` calls `registerVaultIoTools` unchanged.
- Cross-walked Tool Definitions in `CNS-Phase-1-Spec.md`: schemas already match (including `vault_read_frontmatter` XOR, `vault_search` caps, `vault_create_note` + optional `project`/`area`, `vault_log_action` fields). Six-field audit line remains in `appendRecord` / Story 5.2; spec diagram in Phase 1 box is illustrative only.
- Added `PHASE1_VAULT_IO_TOOL_NAMES` (Story 6.1 AC1 order), `Phase1VaultIoToolName`, `assertPhase1ToolSurface` at return, and ordered return object to match the canonical list.
- New regression test `tests/vault-io/phase1-tool-surface.test.ts` compares registration keys to the exported constant (sorted set equality).
- `bash scripts/verify.sh` passed (Node tests + Vitest + typecheck + build).

### File List

- `src/register-vault-io-tools.ts`
- `tests/vault-io/phase1-tool-surface.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-1-register-full-phase-1-tool-surface.md`

### Change Log

- 2026-04-02: Story 6.1 — canonical Phase 1 tool name constant, runtime surface assertion, `phase1-tool-surface` regression test; sprint status → review.
