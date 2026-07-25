# Story 76.5: Two-bot vault boundary documentation

Status: done

<!-- Epic 76 | NFR8 NFR2 | Docs-only — no NEXUS bridge code touched -->

## Story

As an **operator**,
I want **documented non-colliding boundary between Hermes and NEXUS bridge on the vault**,
so that **consolidation work never breaks the bridge bot (NFR8, NFR2)**.

## Acceptance Criteria

1. **Boundary module published**
   **Given** no prior two-bot boundary doc in repo
   **When** `AI-Context/modules/two-bot-vault-boundary.md` is authored
   **Then** doc lists Hermes write paths vs NEXUS paths, env var namespaces, and escalation if collision suspected
   **And** follows mobile-posture `modules/` precedent (not Operator Guide section)

2. **ADR-E63-005 cross-reference**
   **Given** ADR-E63-005 already locked in architecture artifacts
   **When** doc is read
   **Then** `NEXUS_*` prohibition on cns-dashboard is cited, not redefined
   **And** `HERMES_*` / `CNS_*` / `DASHBOARD_*` / `PUBLIC_*` namespaces documented

3. **No NEXUS bridge changes**
   **Given** Epic 76 scope guard
   **When** story completes
   **Then** zero diffs in NEXUS bridge code or config

4. **AGENTS linkage**
   **Then** §7 Active Modules includes Two-bot boundary row
   **And** §9 points to module on Hermes vs NEXUS questions

## Implementation Record

| Section | Content |
|---------|---------|
| Bots at a glance | Hermes `#hermes` + Vault IO vs NEXUS tmux dual-path |
| Write paths | Vault IO, session-close, NEXUS direct FS |
| Collision zones | 00-Inbox through AI-Context WriteGate |
| Env namespaces | ADR-E63-005 reference |
| Escalation | 6-step operator playbook |

Mirrored: `specs/cns-vault-contract/modules/`, repo fixture, canonical vault.

## Dev Agent Record

### Completion Notes

- New module `two-bot-vault-boundary.md` follows Epic 13/76 mobile-posture modules pattern.
- Cross-references `8-1-nexus-coexistence-documentation`, `74-5` regression evidence, Nexus operator guides.
- No code or NEXUS config touched.

### File List

- `specs/cns-vault-contract/modules/two-bot-vault-boundary.md` (new)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/two-bot-vault-boundary.md` (mirrored)
- Canonical vault `AI-Context/modules/two-bot-vault-boundary.md` (mirrored)
- `specs/cns-vault-contract/AGENTS.md` (modified §7/§9)
