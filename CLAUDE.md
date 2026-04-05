# Project Rules — CNS (Central Nervous System)

This file is **implementation-repo** project rules for the Omnipotent.md codebase. It is **not** the Obsidian vault `CLAUDE.md` shim; the deployable vault template lives at `specs/cns-vault-contract/shims/CLAUDE.md`.

This repo builds the **Central Nervous System**: a unified control plane that orchestrates all AI agents, LLMs, CLIs, and IDEs from a single vault-based architecture.

## System Context

- **CNS** is the control layer: agent routing, context loading, vault IO, security gates, input surfaces.
- **PAKE** is the knowledge layer (subsystem): note schemas, quality scoring, ingestion pipelines, retrieval.
- The Obsidian vault at `Knowledge-Vault-ACTIVE/` is the single source of truth for all knowledge.
- This repo contains the implementation code, specs, and tooling. It is separate from the vault.

## Current Phase: Phase 1 — Foundation Layer

Three deliverables:
1. **Vault Folder Contract** — locked directory structure with agent-readable manifests
2. **AGENTS.md Constitution** — compact, always-on context file loaded by every tool (<500 lines)
3. **Vault IO Layer** — MCP server exposing eight standardized vault read/write tools

**Authoritative spec:** `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
**AGENTS.md reference:** `specs/cns-vault-contract/AGENTS.md`

## Scope Boundaries

Phase 1 ONLY. Do not implement, spec, or plan:
- Brain service (RAG + vector index) — Phase 2
- Discord / Nexus bridge — Phase 2
- NotebookLM ingestion pipeline — Phase 2
- Always-on daemon / OpenClaw — Phase 3
- Mobile access — Phase 2
- Multi-model routing — Phase 3

## Tooling

This repo uses:
- **BMAD Method** (`_bmad/`, `_bmad-output/`) for planning: PRD, architecture, epics, stories
- **Ralph Orchestrator** (`ralph.*.yml`, `.ralph/`) for execution loops with backpressure gates
- **Verification gate:** `bash scripts/verify.sh` must pass before any phase is complete

## Non-Negotiables

1. **Spec-first.** Create or confirm specs in `specs/<feature>/` before implementing.
2. **BMAD artifacts are source-of-truth.** Planning docs live in `_bmad-output/planning-artifacts/`.
3. **Verification is mandatory.** Run `bash scripts/verify.sh` before claiming done.
4. **Small commits.** One logical change per commit.
5. **Phase 1 scope only.** Do not build beyond the three deliverables listed above.

## Workflow

1. BMAD produces PRD, architecture, epics, and stories.
2. Stories become Ralph specs (convert with `scripts/bmad_to_ralph.py`).
3. Ralph executes implementation loops with backpressure gates (tests/lint/typecheck).
4. `bash scripts/verify.sh` is the completion gate for every story.

## Key References

- **MCP vault root (Phase 1 stdio):** the server reads the vault root **only** from **`CNS_VAULT_ROOT`**. `vaultRootFromHost` on `loadRuntimeConfig` is for programmatic use, tests, and future host wiring, not the current stdio entrypoint. Operators: `specs/cns-vault-contract/README.md` (**Vault IO MCP: vault root (Phase 1)**).
- Phase 1 Spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- Mutation audit + `vault_log_action` (bound spec, reviewer checklist): `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- AGENTS.md (vault constitution): `specs/cns-vault-contract/AGENTS.md`
- Operator index and **grounding parity checklist** (MCP, Cursor, Claude Code on WSL): `specs/cns-vault-contract/README.md`
- BMAD artifacts: `_bmad-output/planning-artifacts/`
- Verify gate: `scripts/verify.sh`
