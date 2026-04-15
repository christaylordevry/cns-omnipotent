# CNS (Central Nervous System) — Implementation Repo Overview

## What this repository is

This is the **implementation repository** for **CNS Phase 1**. It contains:

- The **normative spec** and constitution mirror under `specs/cns-vault-contract/`
- The **Vault IO MCP server** implementation under `src/`
- Test suites under `tests/`
- BMAD planning artifacts under `_bmad/` and `_bmad-output/`

It is intentionally separate from the live Obsidian vault under `Knowledge-Vault-ACTIVE/`.

## Project purpose (Phase 1)

Phase 1 delivers three foundations:

1. **Vault Folder Contract**
2. **`AGENTS.md` Constitution (mirror)**
3. **Vault IO Layer** — an MCP server exposing standardized vault read/write tools with enforcement and auditability

Authoritative spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`.

## Quick reference

| Category | Value |
|---|---|
| Primary language | TypeScript |
| Runtime | Node.js (>= 20) |
| Output | `dist/` (ESM, NodeNext) |
| Entry point | `src/index.ts` |
| Quality gate | `bash scripts/verify.sh` |
| Tests | `npm test` (`node --test` + `vitest run`) |
| Lint | `npm run lint` (ESLint) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) |

## How to run (developer workflows)

### Install

From repo root:

- `npm install`

### Run the MCP server (stdio)

- `npm run dev`

The server reads the vault root from **`CNS_VAULT_ROOT`** (Phase 1 stdio contract).

### Verification gate (required)

- `bash scripts/verify.sh`

This enforces (at minimum) **test**, **lint**, and **typecheck** for Node/TS projects and fails if any required script is missing.

## Repository map (high-signal)

- `src/`: Vault IO MCP server (tool registration, config, enforcement)
- `specs/`: Phase 1 spec + constitution mirror (normative docs)
- `tests/`: Unit + integration verification (including constitution parity checks)
- `scripts/`: Repo tooling and verification gate
- `_bmad/`, `_bmad-output/`: BMAD planning and implementation artifacts
- `docs/`: Human-oriented project documentation and scan outputs (this folder)

## Where to start reading

If you’re trying to understand the system quickly:

1. `README.md` (repo overview + verification gate)
2. `CLAUDE.md` (scope boundaries and non-negotiables)
3. `specs/cns-vault-contract/README.md` (operator checklist + Vault IO MCP contract)
4. `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (authoritative Phase 1 spec)
5. `src/index.ts` (MCP server entrypoint) and `src/` modules

