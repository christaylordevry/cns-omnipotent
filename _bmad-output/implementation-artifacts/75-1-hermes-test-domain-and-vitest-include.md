# Story 75.1: Hermes test domain and vitest include

Status: done

baseline_commit: 55218a16837aaaa347f01110c6a81388bbd40c2a

<!-- Epic B setup story — establishes tests/hermes/ vitest domain. No run-chain engine edits. Real Hermes integration tests land in 75-4 and Epic 77. -->

## Story

As a **developer**,
I want **`tests/hermes/` registered in `vitest.config.ts`**,
so that **Hermes integration tests run in `verify.sh` (architecture test convention)** and later Epic B/D1 stories have a runner-covered home for `validate-anthropic-key`, awareness pull, and related scripts.

## Acceptance Criteria

1. **Vitest include glob extended**
   **Given** `vitest.config.ts` current include globs (`tests/vault-io/**`, `tests/verification/**`, `tests/brain/**`, `tests/model-routing/**`)
   **When** `"tests/hermes/**/*.test.ts"` is added to the `test.include` array
   **Then** `npm run test:vitest` discovers tests under `tests/hermes/`
   **And** the change is a one-line (or equivalent minimal) addition — no unrelated config churn

2. **Placeholder smoke test exists**
   **Given** the new include glob
   **When** `tests/hermes/run-chain.test.ts` (or equivalent `*.test.ts` under `tests/hermes/`) exists
   **Then** it contains at least one passing `it(...)` (placeholder is acceptable — e.g. `it('placeholder', () => {})`)
   **And** the file uses standard vitest imports (`describe`, `it`, `expect` from `"vitest"`)

3. **Verify gate (NFR1)**
   **Given** the repo verify gate
   **When** `bash scripts/verify.sh` runs
   **Then** it passes with no regressions

4. **Test placement anti-pattern avoided**
   **Given** Omnipotent.md test runner conventions
   **When** implementation completes
   **Then** no new `tests/*.test.ts` files are added at repo root (not picked up by either `test:node` or `test:vitest`)
   **And** no existing `tests/hermes-*.test.mjs` contract tests are moved or renamed (those are Node runner skill mirrors — different domain)

5. **Protect-list untouched (NFR2)**
   **Given** ADR-HERMES-004 protect-list
   **When** implementation completes
   **Then** these paths have **zero diffs**:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`

6. **Scope boundary — infrastructure only**
   **Given** this is story 75-1 (setup)
   **When** implementation completes
   **Then** no `scripts/validate-anthropic-key.ts`, Hermes skills, vault governance modules, or run-chain revival logic is added
   **And** no WriteGate / `vault_log_action` / `security.md` changes

## Tasks / Subtasks

- [x] **AC #1 — Extend vitest.config.ts** (AC: #1)
  - [x] Open `vitest.config.ts`; add `"tests/hermes/**/*.test.ts"` to `test.include` array (after existing domain globs)
  - [x] Confirm `npm run test:vitest` still runs all prior domains (vault-io, verification, brain, model-routing)

- [x] **AC #2 — Create placeholder test** (AC: #2)
  - [x] Create directory `tests/hermes/` if missing
  - [x] Add `tests/hermes/run-chain.test.ts` with minimal passing placeholder (name signals Epic B domain; real run-chain Hermes tests are 75-4+)
  - [x] Optionally add a one-line comment that this file bootstraps the domain until `validate-anthropic-key.test.ts` (75-4)

- [x] **AC #3 — Verify gate** (AC: #3)
  - [x] Run `bash scripts/verify.sh`; record pass + date in Dev Agent Record

- [x] **AC #4–#6 — Scope check** (AC: #4, #5, #6)
  - [x] `git diff` shows only `vitest.config.ts` + `tests/hermes/*` (+ this story file / sprint-status if updated by create-story)
  - [x] Confirm protect-list paths unchanged

## Dev Notes

### Epic and sequencing context

- **Epic 75 (Run-Chain Knowledge + Revival)** — alias **Epic B**; FRs FR7, FR8, FR11.
- **Depends:** Epic 74 substantially complete (Portal provider live). Story **75-1** is explicitly parallel-safe and does **not** require Anthropic key validation or run-chain execution.
- **This story blocks:** nothing critical — but **75-4** (`tests/hermes/validate-anthropic-key.test.ts`) and **77-*** (`tests/hermes/hermes-awareness-pull.test.ts`) assume this domain exists.
- **Follow-on stories:** 75-2 governance module, 75-3 Hermes skill, 75-4 validate-anthropic-key + real tests, 75-5 E2E revival.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75, §Story 75-1]

### Why a separate `tests/hermes/` domain?

Architecture decision: Hermes **integration script** tests (CLI wrappers, HTTP smoke mocks, awareness pull) belong in `tests/hermes/`, not `tests/vault-io/` (Vault IO MCP + agent unit tests) and not repo-root `tests/*.test.mjs` (Node skill contract tests).

| Runner | Command | Discovery glob | Example |
|--------|---------|----------------|---------|
| Node | `npm run test:node` | `tests/*.test.mjs` only | `tests/hermes-session-close-skill.test.mjs` |
| Vitest | `npm run test:vitest` | `vitest.config.ts` `test.include` | `tests/hermes/validate-anthropic-key.test.ts` (75-4) |

**Anti-pattern:** `tests/hermes-awareness-pull.test.ts` at repo root — **never runs in CI** (not in either runner).

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Test domain decision, §Test convention table]

### Current `vitest.config.ts` state (MUST read before edit)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/vault-io/**/*.test.ts",
      "tests/verification/**/*.test.ts",
      "tests/brain/**/*.test.ts",
      "tests/model-routing/**/*.test.ts",
    ],
  },
});
```

**Required change:** add one line: `"tests/hermes/**/*.test.ts"`.

[Source: `vitest.config.ts`]

### Do not confuse with existing run-chain tests

| Path | Purpose | Touch in 75-1? |
|------|---------|----------------|
| `tests/vault-io/run-chain.test.ts` | Unit/integration tests for `src/agents/run-chain.ts` orchestration (mocked agents) | **NO** — keep as-is |
| `tests/vault-io/run-chain-live-harness.test.ts` | Live harness (env-gated) | **NO** |
| `tests/hermes/run-chain.test.ts` | **NEW** — domain bootstrap placeholder only | **YES** — create |

The new `tests/hermes/run-chain.test.ts` is **not** a duplicate of vault-io run-chain tests; it only names the Epic B domain until real Hermes script tests arrive in 75-4.

### Placeholder test template

```typescript
import { describe, it } from "vitest";

describe("tests/hermes domain", () => {
  it("placeholder — real Hermes integration tests land in 75-4+", () => {
    // Bootstrap only; verify.sh requires ≥1 discovered test under tests/hermes/
  });
});
```

Keep it minimal. No imports from protect-list modules.

### Protect-list (NFR2 — zero diffs required)

| Path | Reason |
|------|--------|
| `src/agents/synthesis-adapter-llm.ts` | Synthesis LLM adapter |
| `src/agents/hook-adapter-llm.ts` | Hook LLM adapter |
| `src/agents/boss-adapter-llm.ts` | Boss LLM adapter |
| `src/agents/run-chain.ts` | Run-chain orchestration |
| `scripts/run-chain.ts` | Run-chain CLI entry |

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Protect-list gate]

### Verify gate mechanics

`scripts/verify.sh` runs `npm test` which chains:
1. `npm run test:node` → `node --test tests/*.test.mjs`
2. `npm run test:vitest` → `vitest run --config vitest.config.ts`

New Hermes vitest tests **only** run if the include glob is added. Without it, files under `tests/hermes/` are silently ignored.

[Source: `package.json` scripts, `scripts/verify.sh`]

### WriteGate / security

This story does **not** touch vault mutations, `AI-Context/`, audit logging, or `specs/cns-vault-contract/security.md`. No operator approval required.

### Technical requirements

- **Vitest:** `^3.2.4` (repo pin in `package.json`); use `defineConfig` from `"vitest/config"`.
- **TypeScript:** tests use `.test.ts` extension; project `tsconfig` already covers `tests/`.
- **No new npm dependencies.**

[Source: `package.json`, Context7 `/vitest-dev/vitest/v3_2_4` — `test.include` glob array]

### File structure requirements

| File | Action |
|------|--------|
| `vitest.config.ts` | **UPDATE** — add include glob |
| `tests/hermes/run-chain.test.ts` | **NEW** — placeholder smoke |
| `tests/hermes/` | **NEW** directory |

**Forbidden:** new files under `src/`, `scripts/run-chain.ts`, protect-list paths, repo-root `tests/*.test.ts`.

### Testing requirements

- **Pre-change:** note current `npm run test:vitest` test count (baseline).
- **Post-change:** `npm run test:vitest` must show +1 test from `tests/hermes/`.
- **Gate:** `bash scripts/verify.sh` must pass (lint + typecheck + full test suite).
- **Regression:** all existing vitest domains still discovered; no changes to `tests/*.test.mjs` contract tests.

### Project context reference

- Hermes Consolidation track: Epics 74–78 on branch `hermes-consolidation`.
- Epic 74 `done` (74-4 Tool Gateway optional backlog); Epic 75 starting with this infrastructure story.
- ADR-HERMES-004: run-chain adapters stay untouched; Option A uses `ANTHROPIC_API_KEY` validation in 75-4.

[Source: `project-context.md`]

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75, Story 75-1]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Test domain decision, §Protect-list, §Project Structure]
- [Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §G2 preservation, §In scope run-chain revival]
- [Source: `vitest.config.ts`]
- [Source: `package.json` — `test`, `test:vitest` scripts]
- [Source: `scripts/verify.sh` — NFR1 gate]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- `npm run test:vitest`: 51 test files, 643 tests passed (+1 file from `tests/hermes/run-chain.test.ts`)
- `bash scripts/verify.sh`: VERIFY PASSED (2026-06-24)

### Completion Notes List

- Added `"tests/hermes/**/*.test.ts"` to `vitest.config.ts` `test.include` array
- Created `tests/hermes/run-chain.test.ts` placeholder bootstrap test for Epic B domain
- All protect-list paths unchanged (zero diffs on synthesis/hook/boss adapters, run-chain.ts)
- No new dependencies; infrastructure-only scope as specified

### File List

- `vitest.config.ts` (modified)
- `tests/hermes/run-chain.test.ts` (new)

### Change Log

- 2026-06-24: Story 75-1 — Hermes vitest domain bootstrap (include glob + placeholder test)
