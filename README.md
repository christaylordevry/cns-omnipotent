# CNS Phase 1 — Omnipotent.md (implementation repo)

This repository implements the **Central Nervous System (CNS) Phase 1** foundation: vault folder contract, `AGENTS.md` constitution mirror under `specs/cns-vault-contract/`, and the Vault IO MCP package (`src/`).

What’s inside:

- `specs/cns-vault-contract/` — normative spec and constitution mirror
- `src/` — TypeScript MCP server and Vault IO tools
- `tests/` — Node (`*.test.mjs`) and Vitest (`tests/vault-io/`, `tests/verification/`) suites
- `_bmad/` and `_bmad-output/` — BMAD planning artifacts
- `.ralph/` — Ralph orchestrator state (optional)
- `scripts/verify.sh` — **verification gate** (see below)

Start in Cursor: `/bmad-help` (BMAD workflow). Project rules: `CLAUDE.md`. Vault IO MCP: set **`CNS_VAULT_ROOT`** on the server process; full env policy and operator checklist: [`specs/cns-vault-contract/README.md`](specs/cns-vault-contract/README.md).

## Verification gate (NFR-R2)

**Phase 1 (Foundation Layer) is not complete** until the verification gate is **green**: `bash scripts/verify.sh` exits **0**. This matches **NFR-R2** in `_bmad-output/planning-artifacts/architecture.md` and repo rules in `CLAUDE.md`.

### How to run

From the repository root (after `npm ci` or `npm install`):

```bash
bash scripts/verify.sh
```

The script resolves the repo root and works from any working directory.

### What each step covers

| Step | What it runs | Purpose |
|------|----------------|--------|
| **test** | `npm test` → `test:node` (Node’s test runner on `tests/*.test.mjs`) then `test:vitest` (integration tests under `tests/vault-io/` and `tests/verification/`) | Unit/integration coverage, including **constitution mirror parity** (`tests/constitution.test.mjs` is part of `test:node`) and **MCP domain error surface** checks (serialised `CnsError` payloads must not embed the absolute vault root) |
| **lint** | `npm run lint` → ESLint with **TypeScript** rules (`typescript-eslint` on `*.ts`, recommended rules on `*.mjs` in `tests/` / `scripts/`) | Catch TS/JS issues the typechecker does not enforce |
| **typecheck** | `npm run typecheck` → `tsc --noEmit` | Ensure `src/` type-checks against `tsconfig.json` |
| **build** *(if present)* | `npm run build` → `tsc` emit to `dist/` | Optional compile check; failures still fail the script |

Missing or empty `test`, `lint`, or `typecheck` scripts in `package.json` cause the gate to **fail** (no silent skip).

### Failure-mode proof (Story 6.3)

To confirm `verify.sh` exits **non-zero** when any required step fails (not only the success path), run:

```bash
npm run test:gate-failures
```

That script temporarily patches `package.json` scripts and asserts `scripts/verify.sh` fails for **test**, **lint**, and **typecheck** failures separately. It is **not** part of the default `npm test` chain (it would recurse into `verify.sh`). Run it after a green `verify.sh` when changing the gate.

### Phase 1 complete

Claim **Phase 1 complete** only when:

1. `bash scripts/verify.sh` passes (exit 0), and  
2. Scope matches `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (this gate is the objective bar for implementation health, not the only Phase 1 deliverable).

---

*Originally bootstrapped from an AI Software Factory template; CNS content and gate are project-specific.*
