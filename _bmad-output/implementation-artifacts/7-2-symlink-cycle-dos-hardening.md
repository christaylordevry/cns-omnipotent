# Story 7.2: Symlink cycle DoS hardening (`vault_search`, `vault_list`)

Status: done

**Scope:** Epic 7 closure hardening item. Fix symlink-cycle traversal DoS in read/list search paths while preserving canonical read-boundary behavior.

---

## Story

As an **operator**,  
I want **recursive vault traversal to terminate on canonical symlink cycles while still hard-failing on vault boundary escapes**,  
so that **Phase 1 tools remain both available (no traversal loops) and safe (no outside-vault reads silently skipped)**.

---

## Acceptance Criteria

### AC1 — `vault_search` cycle guard on canonical directories

**Given** Node-scanner traversal in `walkMarkdownFiles` (`src/tools/vault-search.ts`)

**When** traversal enters a directory whose canonical absolute path was already visited earlier in the same walk

**Then** recursion stops for that branch without re-entering the directory

**And** the traversal must continue yielding other reachable markdown files.

---

### AC2 — `vault_list` recursive enqueue uses canonical child directory paths

**Given** recursive mode in `vaultListDirectory` (`src/tools/vault-list.ts`)

**When** a child directory entry is considered for queueing

**Then** the implementation resolves the child to canonical path via `resolveReadTargetCanonical(...)`

**And** deduplicates queue/seen by canonical directory path, not lexical join path.

---

### AC3 — Regression tests for cycle protection

**Then** add tests that create an in-vault symlink cycle and prove both tools terminate with deterministic output:

- `tests/vault-io/vault-search.test.ts`: Node scanner cycle case
- `tests/vault-io/vault-list.test.ts`: recursive list cycle case

---

### AC4 — Verification gate

**Then** `bash scripts/verify.sh` passes.

---

### AC5 — Boundary and cycle guarantees compose (must not regress Story 4.9)

**Given** recursive `vault_list` child canonicalization (AC2)

**When** a symlinked directory entry points outside vault root

**Then** `resolveReadTargetCanonical(...)` must still surface `CnsError("VAULT_BOUNDARY", ...)`

**And** the implementation must not silently skip those paths in the name of cycle protection.

---

## Tasks / Subtasks

- [x] AC1: Add canonical visited-dir guard to `walkMarkdownFiles`
- [x] AC2: Canonicalize recursive `vault_list` child directories before enqueue; dedupe by canonical path
- [x] AC3: Add cycle regression tests for `vault_search` and `vault_list`
- [x] AC5: Add explicit recursive boundary regression proving outside symlink still throws `VAULT_BOUNDARY`
- [x] AC4: Run `bash scripts/verify.sh`

---

## Dev Notes

- **Bound spec context:** `specs/cns-vault-contract/AGENTS.md`, `specs/cns-vault-contract/modules/vault-io.md`, and Story 4.9 canonical read-boundary behavior in `tests/vault-io/canonical-read-boundary.test.ts`.
- **Composition rule:** cycle safety is a traversal-state concern (`visitedDirs` / canonical queue); boundary safety remains canonical path validation (`resolveReadTargetCanonical`) and is not downgraded to skip semantics.

### File List

- `src/tools/vault-search.ts`
- `src/tools/vault-list.ts`
- `tests/vault-io/vault-search.test.ts`
- `tests/vault-io/vault-list.test.ts`
- `tests/vault-io/canonical-read-boundary.test.ts`
- `_bmad-output/implementation-artifacts/7-2-symlink-cycle-dos-hardening.md`
