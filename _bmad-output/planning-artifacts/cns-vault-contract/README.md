# CNS Vault Contract Specification

This directory holds the git **normative** mirror for CNS Phase 1: Foundation Layer. Copy or sync from here into `Knowledge-Vault-ACTIVE/AI-Context/` when deploying to the live vault: place `AGENTS.md` at `AI-Context/AGENTS.md` and copy `modules/*.md` to `AI-Context/modules/`.

## Files

| File | Purpose |
|------|---------|
| `CNS-Phase-1-Spec.md` | Complete Phase 1 specification: folder contract, `AGENTS.md` design, Vault IO MCP tool definitions, acceptance criteria |
| `AGENTS.md` | Vault constitution; deploy to `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` |
| `modules/*.md` | Vault IO and Security policy modules; deploy to `Knowledge-Vault-ACTIVE/AI-Context/modules/` |
| `AUDIT-PLAYBOOK.md` | Operator guide: reading `_meta/logs/agent-log.md`, correlating paths to log lines (FR23), human-only archive or trim (FR24, NFR-S3) |
| `README.md` | This file: index, IDE shim summary, **grounding parity checklist** |
| `shims/` | Templates for vault-root `CLAUDE.md` and Cursor rules (see below) |

## Relationship to BMAD

These specs are the **input** for BMAD planning. The PRD should be generated from `CNS-Phase-1-Spec.md` and scoped to Phase 1 deliverables only.

## Phase 1 deliverables

1. **Vault Folder Contract:** directory structure with agent-readable `_README.md` manifests
2. **AGENTS.md Constitution:** universal context file, under 500 lines, loaded by all tools
3. **Vault IO Layer:** MCP server exposing the Phase 1 tools (see `CNS-Phase-1-Spec.md`)

## Operator workflow: audit log

When debugging “who changed this note?” or maintaining a large `_meta/logs/agent-log.md`:

1. Read **`AUDIT-PLAYBOOK.md`** in this directory (git mirror). It documents the six-field line format, a path-to-line correlation walkthrough, WSL-friendly `grep` / `tail` examples, and **human-only** archive or trim steps (FR24) that do not use Vault IO mutators.
2. Keep behavior aligned with **`modules/security.md`** (logging and protected paths) and the bound Story 5.2 artifact `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` in the implementation repo.

Deploy the playbook into the live vault beside other spec mirrors if operators want a copy under `AI-Context/` (optional; implementation repo remains canonical for edits).

Verification gate for Phase 1 close-out: run `bash scripts/verify.sh` as documented in root [`README.md` Verification gate (NFR-R2)](../../../README.md#verification-gate-nfr-r2).

## Vault folder contract manifests

This repository includes a deployable mock vault tree at `Knowledge-Vault-ACTIVE/` for CI and operator reference.

To deploy to your live vault, mirror these directories and copy their `_README.md` files into the vault root:
- `00-Inbox/_README.md`
- `01-Projects/_README.md`
- `02-Areas/_README.md`
- `03-Resources/_README.md`
- `04-Archives/_README.md`
- `DailyNotes/_README.md`

## IDE shims (vault deploy)

Templates live under `specs/cns-vault-contract/shims/` in the implementation repo. Copy them into the live vault so Cursor and Claude Code load `AI-Context/AGENTS.md` without pasting the constitution into chat.

| Template | Copy to vault |
|----------|----------------|
| `shims/CLAUDE.md` | `Knowledge-Vault-ACTIVE/CLAUDE.md` (vault root) |
| `shims/cursor-rules/agents.mdc` | `Knowledge-Vault-ACTIVE/.cursor/rules/agents.mdc` (create `.cursor/rules/` if needed) |

We ship a **Cursor rules** fragment (`*.mdc`) so rules stay versionable, can set `alwaysApply`, and match the Phase 1 spec option of `.cursor/rules/agents.mdc`. Operators who prefer one flat file can mirror the same text into `.cursorrules` at the vault root.

**Implementation repo (optional):** when editing the CNS codebase, the repo may include `.cursor/rules/cns-specs-constitution.mdc` so the specs mirror of `AGENTS.md` loads. That is separate from the vault copy above.

## Vault IO MCP: vault root (Phase 1)

1. **Stdio server** (`src/index.ts`): vault root comes **only** from the **`CNS_VAULT_ROOT`** environment variable on the MCP server process (validated in `loadRuntimeConfig`). On Cursor, Claude Code, and similar hosts, set `CNS_VAULT_ROOT` in the MCP **`env`** block. Do not assume an IDE-specific "vault root" field outside that process environment is read by the server today.
2. **`vaultRootFromHost`** on `loadRuntimeConfig` is for **embedded use, tests, and future host wiring**. The current stdio entrypoint does **not** pass it.
3. **Precedence:** when both could apply in programmatic calls, **`CNS_VAULT_ROOT` wins** over `vaultRootFromHost`. See `tests/vault-io/config.test.ts`.

---

## Grounding parity checklist

Use this **once per machine or workspace** (WSL), then re-check after major tool upgrades. It aligns with Stories 1.1 and 1.2: constitution load without manual paste, vault-relative paths, and no extra paste steps beyond what one-time MCP and shim setup require.

### One-time setup: Cursor on WSL

- [ ] **Workspace:** Open **`Knowledge-Vault-ACTIVE/`** (Obsidian vault root) as the Cursor workspace when doing vault work. Use the CNS implementation repo as the workspace only when you intend to edit that repo.
- [ ] **Vault Cursor rule:** Copy `shims/cursor-rules/agents.mdc` to `Knowledge-Vault-ACTIVE/.cursor/rules/agents.mdc` so the rule pulls in `AI-Context/AGENTS.md` (see the `@` lines in the template).
- [ ] **MCP:** Register the **Vault IO** MCP server once per Cursor profile (stdio transport). Set **`CNS_VAULT_ROOT`** in the server **`env`** (see **Vault IO MCP: vault root (Phase 1)** above). After registration, confirm the Vault IO tools appear without pasting credentials into chat.
- [ ] **Sanity:** Start a new chat; confirm the agent behaves as if `AGENTS.md` is grounded (no request to paste the full constitution).

### One-time setup: Claude Code on WSL

- [ ] **Working directory:** Run Claude Code with **`Knowledge-Vault-ACTIVE/`** as the project root for vault sessions (WSL path to the vault).
- [ ] **Shim:** Copy `shims/CLAUDE.md` to `Knowledge-Vault-ACTIVE/CLAUDE.md` so the file references `AI-Context/AGENTS.md` (see `@AI-Context/AGENTS.md` in the template).
- [ ] **MCP:** Configure the same **Vault IO** MCP server with **`CNS_VAULT_ROOT`** pointing at your vault root (for example `Knowledge-Vault-ACTIVE/`). See **Vault IO MCP: vault root (Phase 1)** above. Confirm tools are listed without manual routing of policy text.
- [ ] **Sanity:** Open a new session; confirm grounding from the shim without pasting `AGENTS.md`.

### Parity (NFR-I1)

After one-time setup, **Cursor** and **Claude Code** on WSL share the same **grounding** and **Vault IO mediated** expectations:

- **Grounding:** Constitution comes from `AI-Context/AGENTS.md` via the vault-deployed shim or Cursor rules, with vault-relative paths. Neither surface should need a standing “paste this constitution” step each session.
- **Vault IO:** When MCP is configured, reads and writes follow the same Vault IO protocol and module policy (`AI-Context/modules/vault-io.md`, `AI-Context/modules/security.md`).

**Intentional deltas:** Cursor loads via `.mdc` rules (`alwaysApply`). Claude Code loads via vault-root `CLAUDE.md`. The files differ; the **logical** constitution source and path semantics do not.

### Time-to-grounded spot check (NFR-P1)

Repeatable **informal** timing (no benchmark harness in Phase 1):

| | |
|---|---|
| **Start event** | Start a stopwatch when you **open the workspace** on the vault root, **or** when you send the **first** agent message in a new session. Pick one and keep it consistent across comparisons. |
| **Task-ready (stop event)** | Stop when the session is **task-ready**: the constitution is effectively in context **and** Vault MCP tools are usable when MCP is installed, without you pasting `AGENTS.md` or hand-routing policy. |
| **Target** | **Median** wall time **under 30 seconds**, per PRD NFR-P1. Log outliers; this is a spot check, not a CI metric. |

---

## Planning-artifact copy

BMAD planning mirrors this content under `_bmad-output/planning-artifacts/cns-vault-contract/README.md`. **Edit this file first**, then refresh the planning copy if your workflow requires a duplicate there.

Verification gate reference: see root [`README.md` Verification gate (NFR-R2)](../../../README.md#verification-gate-nfr-r2).
