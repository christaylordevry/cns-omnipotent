# Mobile posture (read-first) and governance boundaries

Mobile access is **additive**. It is not a first-class execution surface for governed work.

## Read posture

Supported:

- Obsidian Mobile with Sync, as a replicated read surface.
- SSH terminal access to the vault host, typically via **Tailscale** plus **Blink Shell**, as a remote read surface.

Assumptions:

- The device is protected, the operator accepts replication risk where applicable, and any remote access is gated by operator-approved network posture.

## Write posture

Default posture:

- **No direct mobile writes** that bypass Vault IO.

Reason:

- Direct mobile edits are filesystem mutations that bypass WriteGate constraints and do not append a Vault IO audit line to `_meta/logs/agent-log.md`.

Operator-only exception (if explicitly enabled):

- Writes may be allowed only in `00-Inbox/`, and those captures must be triaged later through Vault IO before they are treated as governed content.

## Audit semantics

- Vault IO mutations are audited via `_meta/logs/agent-log.md` on success.
- Mobile filesystem edits are not Vault IO audited.
- Nexus direct filesystem writes are not Vault IO audited.

## Guidance for agents

- Treat mobile as **read-first**.
- Do not recommend mobile edits to governed folders.
- When a mutation is needed, route the operator to Cursor or Claude Code and propose Vault IO tools for the change.

## See also

- **Canonical journey (implementation repo):** `../../../docs/mobile-vault-access-journey.md`
- **BMAD stub (stable link):** `_bmad-output/planning-artifacts/mobile-vault-access-journey.md` (points at the canonical doc)

