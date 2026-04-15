# Source Tree Analysis (Annotated)

This is a **quick-scan** annotated tree of the most important directories and files. It is optimized for AI retrieval and onboarding.

```text
Omnipotent.md/
├── README.md                         # Repo overview + verification gate explanation
├── CLAUDE.md                         # Project rules, scope boundaries (Phase 1 only)
├── package.json                      # Node/TS manifest, scripts, engines (node >= 20)
├── package-lock.json                 # npm lockfile
├── tsconfig.json                     # TypeScript compiler config (NodeNext / ESM)
├── eslint.config.js                  # Lint configuration
├── vitest.config.ts                  # Vitest integration test configuration
├── scripts/
│   ├── verify.sh                     # Required verification gate (test + lint + typecheck + optional build)
│   └── ...                           # Other repo tooling scripts
├── src/
│   ├── index.ts                      # MCP server entrypoint (stdio transport)
│   └── ...                           # Vault IO tool registration + implementation modules
├── tests/
│   ├── *.test.mjs                    # Node test runner unit/contract tests
│   ├── vault-io/                     # Vitest integration tests (vault IO behaviors)
│   ├── verification/                 # Gate/verification-focused tests
│   └── fixtures/                     # Minimal vault fixtures, AGENTS.md fixtures, etc.
├── specs/
│   └── cns-vault-contract/
│       ├── CNS-Phase-1-Spec.md       # Authoritative Phase 1 spec (normative)
│       ├── README.md                 # Operator checklist + contract notes (Vault IO MCP)
│       ├── AGENTS.md                 # Constitution mirror (must stay in parity with vault constitution)
│       ├── modules/                  # Detailed contract modules (security, IO, etc.)
│       └── shims/                    # Deployable vault template shims (e.g., vault-side CLAUDE.md)
├── _bmad/
│   └── ...                           # BMAD workflow inputs/templates
├── _bmad-output/
│   ├── planning-artifacts/           # PRD, architecture, decisions, sprint artifacts
│   └── implementation-artifacts/     # Story-level bound artifacts (audit trails, etc.)
├── docs/
│   ├── index.md                      # Generated: master documentation index (primary entrypoint)
│   ├── project-overview.md           # Generated: repository overview + how to run
│   ├── source-tree-analysis.md       # Generated: this file
│   ├── development-guide.md          # Generated: dev/test/lint/typecheck workflows
│   ├── project-scan-report.json      # Generated: scan state + summaries
│   ├── architecture.md               # Existing: architecture notes (including dual-path model)
│   └── prd.md                        # Existing: PRD pointer + Phase 2.0 scope notes
├── Knowledge-Vault-ACTIVE/           # Active Obsidian vault (source of truth for knowledge)
├── dist/                             # TypeScript build output (tsc emit)
└── node_modules/                     # Local dependencies (should not be scanned exhaustively)
```

## Critical folders (why they matter)

- `src/`: The shipped implementation for Phase 1 (Vault IO MCP server + tools).
- `specs/cns-vault-contract/`: The normative contract and constitution mirror; changes here define correctness.
- `tests/`: Regression safety and contract enforcement; includes constitution parity validation.
- `scripts/verify.sh`: Objective “definition of done” gate for changes.
- `Knowledge-Vault-ACTIVE/`: The actual vault content; **not** the same thing as this implementation repo.

## Entry points

- **Runtime entry point**: `src/index.ts` (connects an MCP server over stdio)
- **Verification entry point**: `scripts/verify.sh`

