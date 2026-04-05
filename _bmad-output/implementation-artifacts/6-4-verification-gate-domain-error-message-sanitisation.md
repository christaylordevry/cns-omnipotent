# Story 6.4: Verification gate — domain `CnsError` / `IO_ERROR` message sanitisation

Status: done

**Relationship to Story 6.3:** This work **extends the verification gate** defined in [`6-3-verification-gate.md`](./6-3-verification-gate.md). It does **not** replace 6.3; it adds a **mandatory** quality bar enforced by the same `bash scripts/verify.sh` path (via `npm test` → Vitest). No Phase 2 scope.

**Problem class:** [`deferred-work.md`](./deferred-work.md) — `handleToolInvocationCatch` normalises non-`CnsError` throws, but **`callToolErrorFromCns` passes through `CnsError.message` and `details` verbatim** into the MCP JSON payload. Several domain sites embed **absolute filesystem paths** (host layout leakage), e.g. `src/config.ts` (`CNS_VAULT_ROOT` validation) and `src/secrets/load-patterns.ts` (JSON / schema errors with `absPath`). That contradicts a safe operator/agent error surface and is hard to reason about under NFR-R2’s “objective gate” if left unchecked.

---

## Story

As a **maintainer**,  
I want **the verification gate to fail when MCP-visible domain errors would leak internal (absolute) host paths**,  
so that **Phase 1 completion cannot regress to exposing `/home/…`, `/tmp/…`, or other resolved filesystem paths in `IO_ERROR` / `CnsError` JSON**.

---

## Acceptance Criteria

### AC1 — Policy: MCP JSON surface (normative)

**Given** the string returned as MCP tool error content (the `JSON.stringify` payload produced by `callToolErrorFromCns` in [`src/mcp-result.ts`](../../src/mcp-result.ts))

**Then** that serialized text **must not** contain **absolute host path leakage**, defined for this story as:

- Any substring equal to the configured **`vaultRoot` absolute path** used in the test or runtime scenario (after `path.resolve` / normalisation the code under test uses), **except** where the product explicitly documents an unavoidable exception (none in Phase 1 — **zero exceptions** for this story).

**And** stable **`path` fields** in `details` that denote **vault-relative** locations must remain **vault-relative POSIX** strings (as today for most vault IO tools), not canonical OS absolute paths — unless a future story explicitly defines a redacted alternate shape.

**And** generic **`IO_ERROR` messages** must remain actionable without embedding full absolute paths in `message` (operators may use env and logs locally; MCP JSON is the contract under test).

**Implementation preference (dev guidance):** Central sanitisation at the **MCP boundary** (`callToolErrorFromCns` and/or a dedicated helper used only there) is preferred over scattering string fixes, so new `CnsError` sites cannot accidentally bypass review. Site-level message cleanup is acceptable only if paired with boundary tests that prove the **serialized** payload cannot contain the vault root absolute prefix.

---

### AC2 — Automated gate check (required)

**Given** `npm test` as invoked by [`scripts/verify.sh`](../../scripts/verify.sh)

**When** the new tests run

**Then** they **fail** if any covered scenario’s `callToolErrorFromCns` output JSON (parse `content[0].text`) **includes** the absolute `vaultRoot` string used in that scenario (see AC1).

**And** tests must use **real** temp directories (`fs.mkdtemp` under OS tmp) so path leakage is not a hypothetical regex — the forbidden substring is the actual resolved vault root path.

**Coverage minimum for this story (timeboxed):**

1. **Config:** `loadRuntimeConfig` with `CNS_VAULT_ROOT` set to a temp path where `stat` fails or is not a directory — assert serialised error text does **not** contain that absolute path (after implementing sanitisation).
2. **Secret patterns:** at least one path that today embeds `absPath` / `filePath` in `CnsError` from [`src/secrets/load-patterns.ts`](../../src/secrets/load-patterns.ts) — assert no absolute path substring from the fixture in the MCP JSON.

**File suggestion:** `tests/verification/domain-error-surface.test.ts` (or equivalent under `tests/` included by Vitest config). The word **verification** in the path signals Story 6.3 gate alignment.

---

### AC3 — Documentation touch (6.3 alignment)

**Given** root [`README.md`](../../README.md) **Verification gate** section from Story 6.3

**When** this story ships

**Then** add **one bullet** (or one table row) stating that tests include **MCP domain error surface checks** (no absolute path leakage in serialised `CnsError` payloads), so contributors know why those tests exist.

**And** optionally one line in [`specs/cns-vault-contract/README.md`](../../specs/cns-vault-contract/README.md) only if it fits operator tone without contradicting vault-facing docs (optional; README root is the required doc update).

---

### AC4 — Verification gate green

**Then** `bash scripts/verify.sh` passes on a clean tree after implementation.

---

## Tasks / Subtasks

- [x] AC1: Implement sanitisation policy (boundary helper + wire `callToolErrorFromCns`, or equivalent that satisfies AC1)
- [x] AC2: Add Vitest verification tests; ensure they fail on current main if run before fix (prove the gate)
- [x] AC3: Update root `README.md` Verification gate section
- [x] AC4: Run `bash scripts/verify.sh`

---

## Dev Notes

### Why the gate, not a loose hygiene story

[`scripts/verify.sh`](../../scripts/verify.sh) already orchestrates **tests + lint + typecheck**. Folding this into **Story 6.3’s meaning** (“objective Phase 1 completion”) means the **new tests are part of `npm test`**, not a forgotten manual checklist item.

### Code touchpoints (non-exhaustive)

| Area | Risk |
|------|------|
| [`src/mcp-result.ts`](../../src/mcp-result.ts) | Serialisation boundary — preferred choke point |
| [`src/config.ts`](../../src/config.ts) | Absolute `path` in message + `details` |
| [`src/secrets/load-patterns.ts`](../../src/secrets/load-patterns.ts) | `filePath`, `absPath` in messages/details |
| Other `new CnsError("IO_ERROR"` sites | Grep for `` `...${...}` `` embedding `path.join`, `resolve`, or raw `fs` paths |

### Testing standards

- Use existing Vitest patterns from [`tests/vault-io/mcp-tool-invocation-error.test.ts`](../../tests/vault-io/mcp-tool-invocation-error.test.ts) for `callToolErrorFromCns` / JSON shape.
- Do not assert on exact error message wording unless stabilising copy is part of AC; primary assertion is **absence of absolute vault root substring** in serialised payload.

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — `IO_ERROR` / `CnsError` message sanitisation (4-8 review)]
- [Source: `_bmad-output/implementation-artifacts/6-3-verification-gate.md` — verification gate binding]
- [Source: `src/mcp-result.ts` — `callToolErrorFromCns`, `handleToolInvocationCatch`]
- [Source: `_bmad-output/planning-artifacts/epics.md` — NFR-R2, MCP error table]

---

## Dev Agent Record

### Agent Model Used

Cursor agent

### Debug Log References

### Completion Notes List

- MCP boundary: `callToolErrorFromCns` / `handleToolInvocationCatch` accept optional `mcpVaultRoot`; registered tools pass `cfg.vaultRoot` so serialised JSON redacts resolved/normalised absolute vault-root prefixes with `[vault-root]`, including nested `details`.
- Gate tests in `tests/verification/domain-error-surface.test.ts` use real `mkdtemp` paths: `loadRuntimeConfig` (vault root is a file) and `loadMergedSecretPatterns` (invalid vault override JSON).
- README verification table + repo “What’s inside” mention MCP domain error surface / `tests/verification/`.

### File List

- `src/mcp-result.ts`
- `src/register-vault-io-tools.ts`
- `tests/verification/domain-error-surface.test.ts`
- `vitest.config.ts`
- `README.md`
