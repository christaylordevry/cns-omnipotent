# Story 76.4: Missing governance files — mobile-posture and personas

Status: done

<!-- Epic 76 | FR17 governance gap closure | Docs-only -->

## Story

As a **maintainer**,
I want **`personas/` created and linked from AGENTS** (mobile-posture already complete),
so that **governance gaps from FR17 are closed**.

## Acceptance Criteria

1. **mobile-posture.md — pre-existing (no work)**
   **Given** `specs/cns-vault-contract/modules/mobile-posture.md` and vault `AI-Context/modules/mobile-posture.md` already exist (46 lines)
   **When** this story runs
   **Then** neither file is recreated or modified
   **And** AGENTS §7 Mobile posture row remains unchanged

2. **personas/ directory with real content**
   **Given** AGENTS §2 vault map references `personas/` but directory was missing
   **When** implementation completes
   **Then** `specs/cns-vault-contract/personas/` and `AI-Context/personas/` exist on repo fixture + canonical vault
   **And** `_README.md` catalogs persona conventions
   **And** `code-review-adversarial-layers.md` documents Blind Hunter, Edge Case Hunter, Acceptance Auditor (`/bmad-code-review` pattern)

3. **AGENTS linkage**
   **Given** constitution dual-path rule
   **When** AGENTS updated to v2.1.49
   **Then** §7 Active Modules adds Personas row pointing at `AI-Context/personas/`
   **And** §9 When Uncertain adds persona load guidance
   **And** `specs/cns-vault-contract/AGENTS.md` and canonical vault copy stay identical

## Implementation Record

| Artifact | Path |
|----------|------|
| Personas README | `specs/cns-vault-contract/personas/_README.md` |
| Code review persona | `specs/cns-vault-contract/personas/code-review-adversarial-layers.md` |
| Vault mirrors | `Knowledge-Vault-ACTIVE/AI-Context/personas/`, `/mnt/c/.../AI-Context/personas/` |
| AGENTS bump | v2.1.49 — §7 Personas row, §9 load hints |

**Scope note:** mobile-posture intentionally untouched per operator scoping (half of original AC already done).

## Dev Agent Record

### Completion Notes

- Created personas directory with non-stub code-review adversarial layers persona grounded in live `bmad-code-review` workflow.
- Synced dual-path mirrors (specs + repo fixture vault + canonical vault).
- AGENTS.md updated in specs and canonical vault; planning-artifacts mirror symlink already tracks specs.

### File List

- `specs/cns-vault-contract/personas/_README.md` (new)
- `specs/cns-vault-contract/personas/code-review-adversarial-layers.md` (new)
- `Knowledge-Vault-ACTIVE/AI-Context/personas/*` (mirrored)
- `specs/cns-vault-contract/AGENTS.md` (modified)
- Canonical vault `AI-Context/AGENTS.md` + `AI-Context/personas/*` (mirrored)
