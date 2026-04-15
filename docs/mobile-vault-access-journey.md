# Mobile vault access journey (read-first) and governance posture

**Canonical doc (implementation repo):** this file.  
**BMAD lineage:** planning stub at `_bmad-output/planning-artifacts/mobile-vault-access-journey.md` points here so epic and story links stay stable.

Status: reviewed  
Date: 2026-04-14  
Owner: Operator

## Purpose

Define a **supported mobile read journey** for the CNS vault, and an explicit governance posture for **mobile writes** so mobile clients are additive and never mistaken for:

- a substitute for the **governed Vault IO** mutation path, or
- the **Nexus dual-path** coexistence model.

This document is **documentation only**. It introduces no new MCP tools, no changes to WriteGate, and no mobile write hose design.

For existing dual-path documentation (Vault IO vs Nexus), see `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` Section 5 and `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`.

## Definitions and glossary

- **Vault content edit**: a filesystem change to a note under `Knowledge-Vault-ACTIVE/`, for example editing a synced file in Obsidian Mobile.
- **Vault IO mutation**: a governed mutation performed through the Vault IO MCP tools, for example `vault_create_note`, `vault_update_frontmatter`, `vault_move`, `vault_append_daily`. These are subject to WriteGate constraints and append an audit line to `_meta/logs/agent-log.md` on success.
- **Agent-mediated action**: a user request executed by an agent on an operator surface (Cursor, Claude Code) that performs Vault IO mutations, and can additionally call `vault_log_action` for operator-significant events.

## Governance posture summary

Mobile is **additive** and is **not** a Phase 1 first-class execution surface. The default posture is:

- **Read is supported**, with explicit authentication assumptions.
- **Write is restricted**, defaulting to **no direct mobile writes that bypass Vault IO**.
- If the operator allows a bounded mobile write exception, it must be treated as **operator-only risk**, and must never be presented to agents as a normal mutation path.

## Supported mobile read paths

### Path A: Obsidian Mobile with Sync (vault replicated onto device)

- **What it is**: A full or partial vault replica on the phone via Obsidian Sync or another sync mechanism.
- **Authentication assumptions**:
  - The device is enrolled and protected (biometric or PIN, disk encryption).
  - The sync provider is configured with an account protected by strong authentication.
  - If the vault contains sensitive operational data, the operator accepts the residual risk of a replicated copy on a mobile device.
- **Primary use**: Browse, search, and read stable notes, review daily logs, and perform lightweight triage decisions.

### Path B: SSH to the vault host (remote read via terminal)

- **What it is**: Remote access from a phone to the vault host, using SSH into WSL or Linux and reading files using terminal tooling. A typical stack is **Tailscale** (network overlay) plus **Blink Shell** (iOS SSH client), though any SSH client and VPN combination works.
- **Authentication assumptions**:
  - The vault host is reachable only through an operator-approved network posture, for example Tailscale or another VPN overlay.
  - SSH key management is secure on device, and host hardening is in place.
  - The operator understands that terminal access can easily become a write path, and configures tooling and habits accordingly.
- **Primary use**: Read notes that are not synced to phone, confirm a file state, check audit logs, and unblock urgent questions.

## Mobile write posture

### Default posture: no direct mobile writes

The operator posture for Phase 1 and early Phase 2 is:

- **Allowed mobile writes**: **none by default**
- **Rationale**: mobile edits are filesystem mutations that bypass Vault IO, bypass WriteGate governance, and bypass the Vault IO audit trail in `_meta/logs/agent-log.md`.

### Operator-only exception (if explicitly enabled)

If the operator chooses to allow a limited mobile write path, it is constrained to a narrow pattern that preserves governance expectations:

- **Only allow writes in `00-Inbox/`**, for capture or quick notes that are explicitly treated as untrusted until triaged.
- **Do not allow mobile edits to governed folders** like `03-Resources/`, `01-Projects/`, `_meta/`, or `AI-Context/`.
- **Assume no Vault IO audit** for those edits, and plan to convert, validate, and move the captured notes through Vault IO later.

This exception is an **operator workflow choice**, not a capability agents should assume.

## Coexistence with Nexus

Nexus is a separate trusted surface that can write directly to the vault filesystem outside Vault IO governance. Mobile does not require Nexus to run on the phone.

- **Mobile is read-only aware** of Nexus-managed notes. If Nexus created or modified content, mobile can still read it as normal vault content.
- **Triage back to Inbox**: Mobile can triage items back to `00-Inbox/` for later desktop processing via Vault IO. Mobile does not need Nexus running on the phone to perform this triage.
- **Safe triage pattern**:
  - Mobile can review and decide what to do next.
  - Actual mutations that should be governed should be executed from Cursor or Claude Code via Vault IO.
  - If a capture is needed from mobile, use `00-Inbox/` only, then triage on desktop.

## Decision table: surface → allowed ops → audit expectation

This table is normative for how agents and operators should reason about mobile.

| Surface | Read | Write | Vault IO audit line in `_meta/logs/agent-log.md` | Recommended usage |
|--------|------|-------|---------------------------------------------------|-------------------|
| Obsidian Mobile (synced vault) | Yes | Default: no. Optional: `00-Inbox/` only, operator-only risk | No (on-device "edit on disk" actions are filesystem mutations, not Vault IO audited) | Read, review, lightweight triage decisions |
| SSH terminal on phone (to vault host) | Yes | Default: no | No | Read-only remote inspection, avoid editing |
| Cursor (WSL) | Yes | Yes, through Vault IO tools | Yes, for Vault IO successes | Primary operator surface for governed work |
| Claude Code (WSL) | Yes | Yes, through Vault IO tools | Yes, for Vault IO successes | Primary operator surface for governed work |
| Vault IO MCP (stdio) | Yes | Yes, governed mutations only | Yes, for Vault IO successes | Canonical governed mutation path |
| Nexus (Discord bridge) | Yes | Yes, direct filesystem writes | No | Trusted but non-governed surface, treat outputs as needing later triage and validation |

## Failure modes and operational risks

- **Offline mobile**: device may have stale content, and decisions might be made on outdated state.
- **Sync conflicts**: note bodies can diverge; conflicts are filesystem-level and not WriteGate mediated.
- **Device loss or compromise**: a replicated vault copy increases exposure; plan for remote wipe and account recovery.
- **Hidden writes**: some mobile actions that feel like "just editing" can touch frontmatter, links, and metadata, and can accidentally mutate governed content without audit.

## Non-goals and constraints (Story 13-1)

- No new Vault IO MCP tools.
- No WriteGate policy changes.
- No "mobile write hose" design.
- No assumption that the phone is a trusted execution surface.

## What would be required for governed mobile writes (future story)

Any future "mobile write" capability should be designed so that writes still route through the governed mutation path, for example:

- a secure remote runner that executes Vault IO tools on the vault host, or
- a dedicated capture tool that only appends to an Inbox file through Vault IO, or
- an operator-approved workflow that enforces WriteGate constraints even when initiated from mobile.

## Constitution pointer (agents)

**Applied in repo:** `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` Section 7 includes a **Mobile posture** module row, and Section 5 states how mobile relates to Nexus and Vault IO. The short module lives at `AI-Context/modules/mobile-posture.md`.

### One-line pointer

Mobile posture: treat mobile clients as **read-first** surfaces, do not assume mobile filesystem edits are Vault IO audited, and do not propose direct mobile writes outside `00-Inbox/`; details live in `docs/mobile-vault-access-journey.md` and `AI-Context/modules/mobile-posture.md`.

### Module table row (Section 7)

| Module | Path | Load When |
| --- | --- | --- |
| Mobile posture | `AI-Context/modules/mobile-posture.md` | Any question about mobile access, or any suggestion that mobile is a write surface |
