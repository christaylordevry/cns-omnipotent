# Story 3.1: MCP package scaffold and vault root configuration

Status: done

## Story

As an **operator**,  
I want **a local TypeScript MCP server that starts with a validated vault root**,  
so that **I can attach Vault IO to my IDE with predictable path behavior**.

## Acceptance Criteria

1. **Given** the architecture stack (Node, TypeScript, MCP SDK, Zod, Vitest, ESM)  
   **When** the Vault IO MCP server package is scaffolded in this repo  
   **Then** it builds and runs as a stdio MCP server with a minimal entrypoint ready to register tools.  
   [Source: `_bmad-output/planning-artifacts/epics.md` → Epic 3 / Story 3.1; `_bmad-output/planning-artifacts/architecture.md` → “Selected approach: TypeScript MCP package”]

2. **Given** the process starts with `CNS_VAULT_ROOT` set to an existing directory (and optional MCP config `vaultRoot` per architecture)  
   **When** the server initializes  
   **Then** it **rejects** missing/invalid vault root with an **actionable** error  
   **And** uses a clear precedence rule: **env overrides config**.  
   [Source: `_bmad-output/planning-artifacts/architecture.md` → “Configuration”]

3. **Given** an input path intended to be vault-relative  
   **When** the server resolves paths for Vault IO operations  
   **Then** resolution uses `path.resolve` + `path.normalize` anchored at `vaultRoot`  
   **And** rejects traversal / escapes outside root (e.g. `..`, absolute path outside root).  
   [Source: `_bmad-output/planning-artifacts/epics.md` → Story 3.1 AC; `_bmad-output/planning-artifacts/architecture.md` → “Path model and vault boundary”]

## Tasks / Subtasks

- [x] **Scaffold Node+TS package** (AC: 1)
  - [x] Create `package.json` for an ESM TypeScript package (`"type": "module"`)
  - [x] Add deps: `@modelcontextprotocol/sdk`, `zod`
  - [x] Add dev deps: `typescript`, `tsx`, `@types/node`, `vitest`
  - [x] Add scripts for local dev + tests (at minimum: `test`, `build`, `dev`)
  - [x] Create `tsconfig.json` aligned with Node ESM
  - [x] Ensure repo remains Phase 1 scoped (no extra surfaces, no web app)

- [x] **Implement configuration loader with validation** (AC: 2)
  - [x] Implement `src/config.ts` that produces a validated config object
  - [x] Read `CNS_VAULT_ROOT` (required) and validate: exists, is directory
  - [x] Optionally accept `vaultRoot` from MCP config if host provides it; **env overrides config**
  - [x] On error, return/throw an error with stable code and actionable message (see Dev Notes)

- [x] **Implement vault path resolution + boundary checks** (AC: 3)
  - [x] Implement `src/paths.ts` utilities:
    - `resolveVaultPath(vaultRoot, userPath)` (vault-relative input) → absolute resolved path
    - `assertWithinVault(vaultRoot, resolvedPath)` (boundary check)
  - [x] Ensure normalization and `startsWith(vaultRoot + path.sep)` check per architecture
  - [x] Include unit tests for boundary edge cases (see Testing Requirements)

- [x] **Create MCP stdio server entrypoint** (AC: 1, 2)
  - [x] Implement `src/index.ts` that:
    - loads config at startup (fails fast on invalid vault root)
    - starts stdio MCP server
    - registers placeholder / minimal tool wiring structure (no full tool implementation in this story)

## Dev Notes

### Guardrails (do not skip)

- **Phase 1 scope**: this story is only package scaffold + config + path guard. Do **not** implement full tool surface here (that arrives in later Epic 3 stories and beyond).  
  [Source: `_bmad-output/planning-artifacts/architecture.md` → “Implementation sequence”]

- **Runtime + stack locks**:
  - Node **>=20** (22.x LTS preferred)
  - `@modelcontextprotocol/sdk` **^1.29.0**
  - `zod` **^3**
  - TypeScript **^5.8**
  - Vitest **^3**
  [Source: `_bmad-output/planning-artifacts/epics.md` → “Additional Requirements”; `_bmad-output/planning-artifacts/architecture.md` → “Versions (verified 2026-04-01)”]

- **Transport**: stdio MCP only for Phase 1.  
  [Source: `_bmad-output/planning-artifacts/epics.md` → “Additional Requirements”; `_bmad-output/planning-artifacts/architecture.md` → “MCP transport”]

### Error shape to standardize now (future-proofing)

Even though only config/path work is implemented in this story, **establish the error code strings now** so later tools remain consistent:

- `VAULT_BOUNDARY`
- `IO_ERROR`

(Later stories add `PROTECTED_PATH`, `SCHEMA_INVALID`, `SECRET_PATTERN`, etc.)  
[Source: `_bmad-output/planning-artifacts/architecture.md` → “MCP tool error contract”]

### Project structure notes (must follow)

Implement the scaffold to match the architecture’s repo layout so future stories land cleanly:

- `src/index.ts` (stdio MCP entry)
- `src/config.ts` (env/config validation)
- `src/paths.ts` (resolve + boundary checks)
- Leave placeholders for later modules (`write-gate.ts`, `audit/`, `pake/`, `tools/`) but do not build them yet unless required for compilation.

[Source: `_bmad-output/planning-artifacts/architecture.md` → “Repository layout (this repo: Omnipotent.md)”]

### Testing requirements

Use **Vitest**. Minimum tests to prevent regressions in later stories:

- **Config validation**
  - Missing `CNS_VAULT_ROOT` fails with actionable error
  - Non-existent path fails
  - Path to file (not dir) fails
- **Path boundary**
  - `resolveVaultPath(vaultRoot, "notes/a.md")` resolves under root
  - `resolveVaultPath(vaultRoot, "../escape.md")` rejected (boundary)
  - Absolute user paths outside root rejected

[Source: `_bmad-output/planning-artifacts/architecture.md` → “NFR-R1”, “Path model and vault boundary”, “Verify: npm test includes boundary … tests”]

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3 / Story 3.1; Additional Requirements block)
- `_bmad-output/planning-artifacts/architecture.md` (Stack, versions, config precedence, path model, repo layout)
- `_bmad-output/planning-artifacts/prd.md` (Vault IO scope, WSL constraints, first-class surfaces)

### Review Findings

- [x] [Review][Patch] Boundary check rejects paths that resolve **exactly** to `vaultRoot` (e.g. `userPath` of `""`, `"."`, or equivalent) because `startsWith(vaultRoot + sep)` is false when `resolved === vaultRoot`. Add an equality branch or use `path.relative` / `hasPath` semantics so the vault root directory itself is inside the boundary. [`src/paths.ts:12-18`, `src/paths.ts:27-29`] — Fixed: `isWithinResolvedVaultRoot` treats exact root match as inside; regression tests added.

- [x] [Review][Patch] Story tasks require **Zod** on the stack and a validated config object; `zod` is listed in `package.json` but `src/config.ts` uses manual checks only. Either validate `CNS_VAULT_ROOT` / merged vault root with a minimal Zod schema (and map errors to `CnsError`) or document an explicit exception in the story if manual validation was intentional (prefer aligning with the stated stack). [`package.json`, `src/config.ts`] — Fixed: `vaultRootPathSchema` + `safeParse` before `stat`; directory checks unchanged.

- [x] [Review][Defer] `src/index.ts` does not pass `vaultRootFromHost` into `loadRuntimeConfig`. AC2 allows optional MCP host config; stdio startup may not expose a hook yet — defer wiring until the MCP host/SDK provides a server initialization config path. [`src/index.ts:6`, `src/config.ts:27-40`]

- [x] [Review][Defer] Path checks use string resolution only, not `realpath`/`fs.realpath` — symlink-based escapes outside the vault are not addressed (common follow-up for Vault IO hardening). [`src/paths.ts`]

- [x] [Review][Defer] If `vaultRoot` were ever set to the filesystem root (e.g. `/` on Unix), prefix semantics degenerate (everything is “under” `/`). Operator guardrail or explicit rejection could be a later story. [`src/paths.ts`]

### Review notes (Chunk 2 — specs/docs)

- No acceptance-criteria contradictions found for Story 3.1 in the specs mirror vs `src/` behavior; remaining diff volume is largely normative markdown, shims, and lockfile.

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

 - `npm test`
 - `bash scripts/verify.sh`
 - `npm run typecheck`
 - `npm run build`

### Completion Notes List

 - ✅ Implemented TypeScript MCP server scaffold (`src/index.ts`) using `@modelcontextprotocol/sdk` stdio transport.
 - ✅ Added validated vault-root config loader (`src/config.ts`) with env-over-host precedence.
 - ✅ Added vault path boundary utilities (`src/paths.ts`) with `VAULT_BOUNDARY` errors on escape.
 - ✅ Added Vitest unit tests for config validation and path boundary checks.
 - ✅ Verified: `npm test`, `npm run typecheck`, `npm run build`, and `bash scripts/verify.sh` pass.
 - ✅ Code review (2026-04-02): batch-applied boundary + Zod patches; re-verified locally after fixes.

### File List

 - `package.json`
 - `package-lock.json`
 - `tsconfig.json`
 - `vitest.config.ts`
 - `src/index.ts`
 - `src/config.ts`
 - `src/paths.ts`
 - `src/errors.ts`
 - `tests/vault-io/config.test.ts`
 - `tests/vault-io/paths.test.ts`

### Change Log

 - 2026-04-02: Scaffolded Vault IO MCP server package + config/path guard + Vitest unit tests.
 - 2026-04-02: Addressed review patches — vault-root equality in boundary check; Zod validation for merged vault root string.

