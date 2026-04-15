# Development Guide

This repo is a **Node.js + TypeScript** codebase that ships an **MCP server** over **stdio**.

## Prerequisites

- Node.js **>= 20** (required by `package.json` `engines.node`)
- npm (lockfile is `package-lock.json`)

## Install

From repo root:

```bash
npm install
```

## Common commands

### Run (dev)

```bash
npm run dev
```

This runs `tsx src/index.ts`.

### Run the verification gate (required before “done”)

```bash
bash scripts/verify.sh
```

For Node/TS projects this runs, in order:

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build` *(if present; optional but failing still fails the script)*

### Test

```bash
npm test
```

Notes:

- `npm run test:node` runs Node’s built-in test runner on `tests/*.test.mjs`
- `npm run test:vitest` runs Vitest integration tests

### Lint

```bash
npm run lint
```

### Typecheck

```bash
npm run typecheck
```

## Configuration and runtime contract

### Vault root

For Phase 1 stdio, the Vault IO MCP server reads the vault root from:

- `CNS_VAULT_ROOT`

Operator details and policy: `specs/cns-vault-contract/README.md`.

## Project rules (important)

Before implementing changes, read:

- `CLAUDE.md` (phase scope boundaries and non-negotiables)

