# Architecture

(TODO: Generate via BMAD on project start)

---

## P3 Dual-Path Model (approved 2026-04-03)

### Overview

The CNS architecture accepts two write paths into the vault as a permanent model for single-operator use. This is not a transitional state — it is the documented architecture.

| Path | Surface | Governance | Frontmatter |
|------|---------|------------|-------------|
| **vault-io (MCP)** | Cursor, Claude Code | Full: boundary enforcement, PAKE validation, WriteGate, audit log | Fully PAKE-compliant on create and update |
| **Nexus (Discord bot)** | Discord | Trusted surface; operates outside vault-io | May be partial; triage like Inbox captures |

### Nexus as trusted write surface

Nexus has direct filesystem access to the vault and writes notes independently. It carries the vault's conventions via style guide learning and produces valued output. The decision not to refactor Nexus through vault-io is deliberate: the integration cost and code coupling outweigh the governance benefit for a single-operator system where the operator is also the Nexus administrator.

Nexus is acknowledged in `AGENTS.md` and in the `_README.md` manifests for directories it writes to. This serves as the governance boundary: agents and operators know which notes may lack full PAKE frontmatter, and those notes are triaged accordingly. An optional enhancement — prompting Nexus to include `pake_type` in generated frontmatter — is a one-line prompt change if schema alignment becomes important, not a code change.

### vault-io as agent governance layer

vault-io governs all IDE agent sessions (Cursor, Claude Code). Every mutation from these surfaces passes through WriteGate, boundary enforcement, PAKE validation, and audit logging. This is the enforced path. The security, compliance, and auditability properties described in the Phase 1 spec apply exclusively to this path.

The two paths do not share enforcement logic. vault-io makes no assumptions about Nexus-written content, and Nexus has no dependency on vault-io at runtime.

### Coexistence

The paths coexist because:

1. **Single operator.** Chris is both the vault administrator and the only Nexus operator. Drift between paths is observable and correctable without automated reconciliation.
2. **Triage is the equalizer.** Nexus-created notes without full PAKE frontmatter are treated like `00-Inbox/` captures: they exist, they are useful, and they get schema-aligned when triage runs. No silent corruption.
3. **No shared transport needed.** Nexus does not need to call vault-io MCP tools to remain coherent. Coupling two independent systems to a shared library creates more failure surface than the drift risk it solves.

### Drift risks accepted

| Risk | Accepted mitigation |
|------|---------------------|
| Nexus notes lack `pake_id` or full schema | Acknowledged in `_README.md` manifests; triage process applies schema on promotion |
| Two write surfaces diverge on routing conventions | AGENTS.md and Nexus style guide are kept aligned by the operator; no automated enforcement |
| Audit log does not capture Nexus mutations | Accepted for single-operator use; Nexus writes are attributable via git history and note timestamps |
| Future multi-operator use requires convergence | Convergence via shared PAKE library is the documented P2 escape hatch; not triggered until multi-operator or formal audit requirements emerge |

### Convergence escape hatch (P2, not planned)

If the system ever requires multi-operator use, formal audit coverage of Nexus writes, or automated schema enforcement on the Nexus path, the escape hatch is: reuse or extend the **shared PAKE type and schema module** in this repo (`src/pake/schemas.ts` and validation pipeline) from Nexus or another writer. Phase 2 Epic B deduplicated MCP tool enums against that module for vault-io consistency; wiring Nexus to the same code is optional and lives outside this package until needed.

### Scale: `vault_move` wikilink repair (Phase 1–2)

When Obsidian CLI is unavailable or fails, the fallback path performs a **full scan of `*.md` files under the vault** to rewrite `[[wikilink]]` targets — **O(n) in markdown file count** per move.

- **Operational assumption:** Acceptable for single-operator vaults through **low thousands** of markdown notes at interactive latency on WSL; prefer **`CNS_OBSIDIAN_CLI`** when Obsidian is installed so the CLI handles backlinks without a full-vault scan.
- **If scale outgrows this:** Options are incremental indexing, limiting repair scope, or other strategies — not part of Phase 2.0 unless product reopens the decision.
