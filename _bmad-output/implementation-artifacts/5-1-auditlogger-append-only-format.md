# Story 5.1: AuditLogger append-only format

Status: done

<!-- Ultimate context engine analysis completed: comprehensive developer guide for Epic 5 Story 5.1. -->

## Story

As a **system**,  
I want **append-only structured lines in `_meta/logs/agent-log.md`**,  
so that **operators can trust a single audit sink**.

## Acceptance Criteria

1. **Given** the normative audit line format in `_bmad-output/planning-artifacts/architecture.md` §8 (and Epic 5 Story 5.1 in `_bmad-output/planning-artifacts/epics.md`)  
   **When** `AuditLogger` appends a record  
   **Then** each line is a single LF-terminated row:  
   `[ISO8601 UTC] | action | tool | surface | target_path | payload_summary`

2. **payload_summary** (NFR-S3, Phase 1 rule): never contains a full note body or full raw tool content. **Single normative representation:** a **human-readable string truncated to the first 120 characters** (JavaScript string length / UTF-16 code units, consistent with existing `vault_move` behavior). For structured caller input, build the string as **`JSON.stringify`** of a **canonical object** (sorted object keys at every nesting level, per architecture §8 intent) and then take **`.slice(0, 120)`**. For an already-short string supplied by the caller, take **`.slice(0, 120)`** only (no giant passthrough). **SHA-256 / hex digest is explicitly out of scope for Phase 1** (reserved for Phase 2 when operators have tooling to interpret hashes).

3. **Field sanitization (pipe-safe rows):** In **`surface`**, **`target_path`**, and **`payload_summary`** (and any other caller-supplied free-text segment that becomes part of the six fields), **replace every U+007C (`|`) with a single ASCII space** before writing the line, so log parsers that split on `|` cannot split one logical record into multiple columns. **Replace CR (`\r`) and LF (`\n`) with a single ASCII space** in those same segments so each audit record remains exactly **one** physical line (LF-terminated).

4. **surface:** use a caller-supplied MCP/host identifier when available; otherwise the literal `unknown` (matches architecture §8). Apply AC3 sanitization to the value before it appears in the line.

5. **Scope boundary (Story 5.1 vs 5.2):** The **only** vault mutator implementation refactored to call `AuditLogger` in this story is **`vault_move`** (`src/tools/vault-move.ts`). **`vault_create_note`**, **`vault_update_frontmatter`**, **`vault_append_daily`**, and the **`vault_log_action`** MCP tool **must not** be wired to `AuditLogger` in 5.1 — that wiring is **Story 5.2** only. This keeps the diff reviewable and testable.

6. **Direct agent writes** to `_meta/logs/**` remain forbidden except append to `agent-log.md` through audit machinery: **`assertWriteAllowed(..., { purpose: "audit-append", operation: "append" })`** immediately before append IO, resolving the log path with `AUDIT_AGENT_LOG_VAULT_REL` from `src/write-gate.ts` (FR22, NFR-S3; WriteGate already encodes this).

7. **Tests** (`npm test`): unit-level tests for line shape, **payload summarization (120-char truncation + stable JSON for objects)**, sanitization (`|`, CR, LF), and **single-line** invariant. Prefer colocated `src/audit/audit-logger.test.ts` or existing `tests/` patterns used in this repo.

8. **Alignment:** `src/tools/vault-move.ts` currently formats and appends audit lines locally (`formatMoveAuditLine`, `appendAgentAuditLine`). After `AuditLogger` exists, **route `vault_move` through the shared module** so there is **one** format implementation (avoids drift before Story 5.2 wires the rest), **without** changing other mutators per AC5.

## Tasks / Subtasks

- [x] Add `src/audit/audit-logger.ts` (and export surface as needed) implementing:
  - [x] `appendRecord(vaultRoot, fields)` (or equivalent) → builds line, applies AC3 sanitization to caller-supplied segments, runs WriteGate `audit-append`, then `appendFile` with UTF-8 and LF newline.
  - [x] `summarizePayloadForAudit(input: unknown): string` (or equivalent): **stable JSON** (sorted object keys at all depths) → `JSON.stringify` → **first 120 characters** per AC2; string input → **slice(0, 120)** only. No hash in Phase 1.
- [x] **Field hygiene:** implement AC3 explicitly (`|` → space; CR/LF → space in `surface`, `target_path`, `payload_summary`).
- [x] Refactor `vault_move` to call `AuditLogger` instead of `formatMoveAuditLine` / `appendAgentAuditLine`, preserving existing move semantics and `mkdir` behavior for the log directory if you keep it (note: WriteGate comment says bootstrap is not the gate’s job; creating `_meta/logs` for first append is acceptable if folder contract is missing in tests only).
- [x] Add tests per AC7; run `bash scripts/verify.sh` before marking story done in sprint status.

### Review Findings

- [x] [Review][Patch] `mkdir` fires before `assertWriteAllowed` in `appendRecord` — AC6 requires the gate "immediately before append IO"; current order is mkdir → gate → appendFile, so the `_meta/logs/` directory is created before the gate can reject the write [`src/audit/audit-logger.ts:97-98`]
- [x] [Review][Patch] `action` and `tool` fields are not sanitized in `formatAuditLine` — AC3 covers "any other caller-supplied free-text segment"; a pipe in either breaks log-parser column count [`src/audit/audit-logger.ts:77`]
- [x] [Review][Patch] `summarizePayloadForAudit` throws unhandled `TypeError` on circular-reference input; `undefined` input produces misleading string `"undefined"` with no signal — Story 5.2 wires more callers, making this more likely [`src/audit/audit-logger.ts:50`]
- [x] [Review][Defer] `normalizeAbsolute` duplicated in `audit-logger.ts` and `vault-move.ts` [`src/audit/audit-logger.ts:15`] — deferred, pre-existing pattern across codebase; consolidation belongs in a future utilities refactor
- [x] [Review][Defer] Error-path `vaultMove` tests don't pre-create `_meta/logs`; passes today because errors are thrown before audit — deferred, pre-existing; fragility is acceptable for Phase 1

## Change Log

- 2026-04-02: AC tightened before dev (pipe sanitization, 5.1-only `vault_move` wiring, Phase 1 truncation-only payload). Implemented `src/audit/audit-logger.ts`, `tests/vault-io/audit-logger.test.ts`, refactored `vault_move`; `verify.sh` passed.

## Dev Notes

### Architecture compliance

- **Normative line format:** `_bmad-output/planning-artifacts/architecture.md` §8 Audit logging.  
- **Repo layout:** same file names `src/audit/audit-logger.ts` as architecture “Repository layout” diagram.  
- **Timestamps:** ISO 8601 **UTC** (e.g. `new Date().toISOString()`).

### Spec cross-check (resolve conflicts explicitly)

- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §5 `vault_log_action` shows a **5-field** example (`[timestamp] | action | tool | target | details`). **Story 5.1 follows architecture §8 (six fields including `surface` and `payload_summary`)**; Story 5.2 will implement `vault_log_action` using the same logger so the MCP tool and file format stay aligned.

### Project structure notes

- **WriteGate is already audit-aware:** `src/write-gate.ts` exports `AUDIT_AGENT_LOG_VAULT_REL`, `WritePurpose`, and allows only `operation: "append"` when `purpose === "audit-append"` and path is exactly `agent-log.md`.
- **Deferred to 5.2:** wiring `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, and the `vault_log_action` tool to call `AuditLogger` (see comments in those tools: “deferred to Epic 5.2”).
- **Do not** bypass WriteGate for log writes; do not add a second path to `agent-log.md`.

### Testing requirements

- Match existing stack: **Vitest**, TypeScript ESM (`*.test.ts` or repo convention under `tests/`).
- Cover: object args (stable JSON + 120-char truncate), string truncate path, AC3 sanitization, and successful append with mocked `fs` or temp directory under `os.tmpdir()` if integration-style is preferred.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.1]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — §3 Protected paths, §8 Audit logging, §Implementation sequence step 2]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — §5 tools, acceptance checklist §7]
- [Source: `src/write-gate.ts` — `AUDIT_AGENT_LOG_VAULT_REL`, `audit-append`]
- [Source: `src/tools/vault-move.ts` — current audit append to refactor]

## Developer context (guardrails)

| Topic | Requirement |
|--------|-------------|
| **Single choke point** | All append-only log IO goes through `AuditLogger` + WriteGate `audit-append`. |
| **No payload leaks** | NFR-S3: never log full bodies; Phase 1 uses **120-char truncated** string only (no hash). |
| **Format** | Six pipe-separated fields + LF; stable across tools for grep/ops. |
| **Drift** | Remove duplicate formatters when centralizing `vault_move`. |

## Previous story intelligence (Epic 4 closure)

- **4.9** established shared **canonical read** helpers and strict **`VAULT_BOUNDARY` / `NOT_FOUND`** semantics. Audit IO is **write-side**; still use **resolved absolute paths** consistent with `resolveVaultPath` / `path.join(vaultRoot, …AUDIT_AGENT_LOG_VAULT_REL.split("/"))` before WriteGate, matching `vault_move` today.
- Epic 4 tools emphasized **WriteGate before any mutation** and **no silent failures**. Audit append failures should surface as **`IO_ERROR`** (or `PROTECTED_PATH` / `VAULT_BOUNDARY` if misconfigured), not swallow.

## Git intelligence summary

Recent commits are sprint-status and Story 2.1 manifest work; **no prior `src/audit/` tree**. Greenfield module under established `src/` + WriteGate patterns.

## Latest technical notes

- Phase 1 **does not** use `crypto` for audit payload summaries; truncation only (AC2). Hash-based summaries are deferred to Phase 2.

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude)

### Debug Log References

_(none)_

### Completion Notes List

- Added `appendRecord`, `summarizePayloadForAudit`, `sanitizeAuditFreeText`, and `formatAuditLine` in `src/audit/audit-logger.ts` (ISO UTC timestamp, six fields, AC2 truncation, AC3 sanitization on surface/target_path/payload_summary, WriteGate + mkdir + append).
- Refactored `vault_move` to call `appendRecord` with structured `{ source, destination }` payload (JSON summary, lexicographic key order).
- Tests: `tests/vault-io/audit-logger.test.ts` (sanitization, summarization, line shape, append integration); updated `vault-move.test.ts` log expectations for JSON payload fragment.
- `bash scripts/verify.sh` passed (tests, typecheck, build).

### File List

- `src/audit/audit-logger.ts` (new)
- `src/tools/vault-move.ts` (modified)
- `tests/vault-io/audit-logger.test.ts` (new)
- `tests/vault-io/vault-move.test.ts` (modified)
- `_bmad-output/implementation-artifacts/5-1-auditlogger-append-only-format.md` (AC + story metadata)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

---

**Completion note:** Story 5.1 implementation complete; status `review`.
