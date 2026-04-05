# Story 6.3: Verification gate

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created. -->

## Story

As a **maintainer**,  
I want **`bash scripts/verify.sh` to run lint, typecheck, and tests**,  
so that **Phase 1 completion is objectively gated**.

## Spec binding and reviewer focus

This story is now bound to this artifact as the implementation spec for review and close-out.

Reviewer checklist for clean sign-off:

1. **`assert-verify-failure-modes.mjs` failure isolation:** confirm each mode (`test`, `lint`, `typecheck`) is proven independently, with minimal targeted injections per mode. Confirm the helper does not short-circuit after the first observed failure.
2. **`verify.sh` requires non-empty scripts:** confirm checks reject trivially bypassable scripts, including empty strings, comment-only scripts, and no-op scripts that return success without running real checks.
3. **ESLint config scope:** confirm `typescript-eslint` recommended rules apply to `*.ts` and `@eslint/js` recommended rules apply to `.mjs`, without TS rules leaking onto `.mjs` or `.mjs` being skipped.
4. **Mechanical lint fixes audit:** confirm `no-useless-assignment`, unused variable cleanups, and redundant `eslint-disable` removals did not change runtime behavior.
5. **Cross-link alignment:** confirm `specs/cns-vault-contract/README.md` links to the root `README.md` verification gate section.

After clean review, update this story status to `done` and set `6-3-verification-gate: done` in `_bmad-output/implementation-artifacts/sprint-status.yaml`.

---

## Extension: Story 6.4 (domain error surface)

**[`6-4-verification-gate-domain-error-message-sanitisation.md`](./6-4-verification-gate-domain-error-message-sanitisation.md)** extends this gate: **`npm test` must fail** if serialised `CnsError` / `IO_ERROR` MCP payloads leak **absolute host paths** (e.g. configured vault root). Implementer adds focused Vitest under `tests/verification/` (or equivalent) and updates the root `README.md` verification section with one bullet. Reviewer checklist add-on:

6. **Domain error sanitisation (6.4):** confirm new tests exercise real `mkdtemp` paths and assert `callToolErrorFromCns` JSON does not contain the absolute vault root substring; confirm `bash scripts/verify.sh` remains the single completion gate (no extra manual step).

## Acceptance Criteria

1. **Given** `package.json` scripts are wired consistently with [Source: `_bmad-output/planning-artifacts/architecture.md` — TypeScript MCP package, “Keeps verify gate simple (`npm test`, lint, typecheck)”]  
   **When** a developer runs the documented quality commands  
   **Then** `test`, `lint`, and `typecheck` are defined as non-empty npm scripts and are invocable via `npm run`  
   **And** script names and responsibilities stay aligned with architecture (tests via Vitest + existing `test:node` if still required; typecheck via `tsc --noEmit`; lint via **ESLint configured for TypeScript**, not “base ESLint only”).  
   **And** the lint toolchain **must** apply TypeScript-aware rules to `*.ts` sources (e.g. `typescript-eslint` with `@typescript-eslint/parser` and recommended or strict-type-checked presets as appropriate). A JS-only ESLint config that never registers TS language services can pass while leaving TS-only issues unflagged; that does **not** satisfy this story. Comments in `src/` and `tests/` that reference `@typescript-eslint` / TS-aware lint **must** match the actual config.

2. **Given** a clean clone with dependencies installed (`npm ci` in CI, `npm install` locally)  
   **When** `bash scripts/verify.sh` runs from any working directory  
   **Then** the script exits **0** only if **all** of the following succeed: **tests**, **lint**, **typecheck**  
   **And** if any of those steps fail, the script exits **non-zero** with a clear message (no silent skip of lint or typecheck).  
   **And** failure behavior is **proven**, not assumed: implementer demonstrates **three separate** failure modes—`verify.sh` exits non-zero when **tests** fail, when **lint** fails, and when **typecheck** fails (not merely one happy-path run with exit 0). Automation (e.g. a small Node helper such as `scripts/assert-verify-failure-modes.mjs` run via `npm run test:gate-failures`) is preferred; three documented manual runs are acceptable only if automation is infeasible.

3. **Given** the repository README is the first stop for new contributors  
   **When** they read root `README.md`  
   **Then** it includes a **Verification gate** section that meets NFR-R2 [Source: `_bmad-output/planning-artifacts/architecture.md` — NFR-R2] with **all** of:  
   - **How to run the gate:** exact command (`bash scripts/verify.sh` from repo root, after `npm ci` / `npm install`).  
   - **What each step covers:** tests (including Node test files and Vitest), lint (ESLint + TypeScript rules), typecheck (`tsc --noEmit`), and—if `build` remains in the script—what that adds.  
   - **What “Phase 1 complete” means here:** Phase 1 (Foundation Layer) is not claimed complete until this gate is **green** (exit 0); tie explicitly to NFR-R2 / project rules.  
   A single one-liner (“run verify.sh”) without the bullets above does **not** satisfy this criterion.

## Tasks / Subtasks

- [x] Task 1: Add a real `lint` toolchain (AC: 1)  
  - [x] Add `lint` script to `package.json` using **ESLint + `typescript-eslint`** (parser `@typescript-eslint/parser`, TS-recommended or strict-type-checked rules for `*.ts`). Do **not** ship a config that only extends `eslint:recommended` for JS while leaving `.ts` files effectively unchecked.  
  - [x] Add minimal flat config (`eslint.config.js` or `eslint.config.mjs`) scoped to `src/` and `tests/` (and Vitest/TS test files as needed); ignore `dist/`, `_bmad/`, `_bmad-output/`, and other generated or vendor trees unless product asks.  
  - [x] Confirm `npm run lint` passes on a clean tree and that rules fire on TypeScript (spot-check: a deliberate unused variable or `any` in a throwaway branch should be reportable if rules are enabled).

- [x] Task 2: Harden `scripts/verify.sh` (AC: 2)  
  - [x] For Node projects with `package.json`, **require** `test`, `lint`, and `typecheck` scripts to exist and **run** them; **do not** treat missing `lint` as skippable (current script prints `(skip)` — that violates Story 6.3 AC).  
  - [x] Preserve repo-root resolution (`SCRIPT_DIR` / `REPO_ROOT`) so the script works from any cwd.  
  - [x] Decide explicitly whether `build` remains in the gate: epic AC names only test + lint + typecheck; if `build` stays, document it as an extra compile check and ensure failures still fail the script (do not weaken the three required steps).  
  - [x] **Constitution mirror parity (must not regress):** Planning vs specs `AGENTS.md` parity and related checks live in **`tests/constitution.test.mjs`** (Story 1.1) and run as part of **`npm test`**. When restructuring `verify.sh` for lint/typecheck, **do not** drop, skip, or short-circuit the full test suite that includes those tests. If step order changes, `npm test` must still run in full so constitution parity remains part of the gate. (There is no separate bash block for parity today—the guarantee is **tests + verify**; keep it that way unless you add an explicit redundant check without removing tests.)

- [x] Task 3: Documentation (AC: 3)  
  - [x] Update root `README.md` with a **Verification gate** section satisfying AC 3 in full: how to run, what each check covers, and the definition of Phase 1 complete vs this gate (NFR-R2)—not a one-liner.  
  - [x] Optional alignment: if `specs/cns-vault-contract/README.md` is the operator index, add one line cross-linking the same rule so spec readers see the gate (only if it avoids contradicting the vault-facing tone).

- [x] Task 4: Prove the gate (AC: 2)  
  - [x] **Failure mode 1 — tests:** With only the test step broken (e.g. temporary `package.json` `test` script that exits 1, or isolated test), `bash scripts/verify.sh` exits **non-zero**.  
  - [x] **Failure mode 2 — lint:** With only lint broken, `verify.sh` exits **non-zero**.  
  - [x] **Failure mode 3 — typecheck:** With only typecheck broken, `verify.sh` exits **non-zero**.  
  - [x] Run `bash scripts/verify.sh` on a clean tree (exit 0) after all changes. Prefer automating the three failure checks in the repo (implemented: `npm run test:gate-failures` / `scripts/assert-verify-failure-modes.mjs`) so CI and future refactors cannot regress silently.

## Dev Notes

### Why this story exists

Epic 6 closes with an **objective** Phase 1 completion criterion. Story 6.1 registered tools; Story 6.2 added fixture integration tests. This story ensures the **orchestrated gate** matches planning: **lint + typecheck + tests**, documented for humans, enforced by `verify.sh`.

### Current repo gaps (do not skip)

| Item | Today | Target |
|------|--------|--------|
| `package.json` `lint` | Absent | Required script, real ESLint (or equivalent) |
| `verify.sh` + lint | Skips if missing | Must **fail** or **run** lint; no skip path for TS package |
| Root `README.md` | Generic template | Must state NFR-R2 / Phase 1 verify requirement |

### Architecture compliance

- **NFR-R2:** `scripts/verify.sh` must pass before Phase 1 is claimed done [Source: `_bmad-output/planning-artifacts/architecture.md`].  
- **Handoff:** “Run `bash scripts/verify.sh` before claiming story complete” [Source: `_bmad-output/planning-artifacts/architecture.md` — Implementation handoff].  
- **Stack:** Node, TypeScript, Vitest; keep versions consistent with existing `package.json` / lockfile [Source: `_bmad-output/planning-artifacts/architecture.md` — Selected approach].

### File structure requirements

| Area | Path |
|------|------|
| Verify gate | `scripts/verify.sh` |
| npm scripts | `package.json` |
| Lint config | repo root (e.g. `eslint.config.js`) |
| Operator-facing blurb | `README.md` |

### Testing requirements

- **Mandatory:** Three explicit failure-mode proofs for `verify.sh` (test fail, lint fail, typecheck fail), plus one success run—see Task 4 and AC 2. Automation is preferred.  
- Constitution mirror parity remains covered by `tests/constitution.test.mjs` as part of `npm test`; keep that in the gate path (see Task 2).

### Previous story intelligence (6.2)

- Integration suite lives under `tests/vault-io/`; fixture at `tests/fixtures/minimal-vault/`. The verify gate must continue to run **Vitest** (`npm test` already chains `test:node` and `test:vitest`).  
- Story 6.2 explicitly relied on `verify.sh` passing with the integration suite; 6.3 tightens **lint** and **documentation**, not the tool semantics.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6, Story 6.3]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — NFR-R2, verify gate rationale, implementation handoff]  
- [Source: `_bmad-output/implementation-artifacts/6-2-fixture-vault-integration-tests.md` — test layout and verify expectations]  
- [Source: `CLAUDE.md` — “Verification gate: `bash scripts/verify.sh` must pass” (repo rules; keep README consistent)]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Added ESLint flat config with `typescript-eslint` recommended rules for `*.ts` (`tsconfig.eslint.json` for project-wide lint), plus recommended ESLint for `tests/**/*.mjs` and `scripts/**/*.mjs`.
- Hardened `scripts/verify.sh`: require non-empty `test`, `lint`, `typecheck`; echo that `npm test` includes constitution parity tests; optional `build` unchanged.
- Added `scripts/assert-verify-failure-modes.mjs` and `npm run test:gate-failures` to prove three failure modes without nesting inside `npm test` (avoids recursion into `verify.sh`).
- Root `README.md` documents how to run the gate, step table, NFR-R2 / Phase 1 meaning, and `test:gate-failures`.
- `specs/cns-vault-contract/README.md` includes a verification-gate cross-link to root `README.md` (kept in sync with `_bmad-output/planning-artifacts/cns-vault-contract/README.md`).
- Fixed minor lint findings in `src/index.ts`, `vault-append-daily.ts`, `wikilink-repair.ts`.

### File List

- `eslint.config.js` (new)
- `tsconfig.eslint.json` (new)
- `scripts/verify.sh` (modified)
- `scripts/assert-verify-failure-modes.mjs` (new)
- `package.json` (modified)
- `package-lock.json` (modified)
- `README.md` (modified)
- `src/index.ts` (modified)
- `src/tools/vault-append-daily.ts` (modified)
- `src/tools/wikilink-repair.ts` (modified)
- `_bmad-output/implementation-artifacts/6-3-verification-gate.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-04-02: Story 6.3 — verification gate (ESLint+TS, verify.sh, README, failure-mode helper).
