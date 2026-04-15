# Story 13.1: Mobile vault access journey and governance posture

Status: done

## Story

As an **operator**,  
I want **a documented mobile journey with explicit read vs write posture and links into the constitution**,  
so that **I do not accidentally treat a mobile client as a substitute for Vault IO or confuse it with the Nexus dual-path**.

## Acceptance Criteria

1. **Given** the repo already documents the dual-path posture for Nexus and governed Vault IO  
   **When** the mobile journey doc is published as a planning artifact (and optionally as a vault-side constitution module pointer)  
   **Then** it describes at least one supported **mobile read path** (e.g., Obsidian Mobile with Sync, or SSH + terminal reader) and states the required **authentication** assumptions (device, vault host, network overlay if used).
2. **Given** the operator intends mobile usage to be additive (not a replacement for Vault IO)  
   **When** the doc states mobile write posture  
   **Then** it clearly enumerates which mutations (if any) are allowed from mobile, with the default posture being **no direct mobile writes that bypass Vault IO**, unless explicitly called out as an operator-only risk.
3. **Given** Nexus has a documented dual-path coexistence model  
   **When** the doc explains mobile coexistence with Nexus  
   **Then** it explicitly states mobile is **read-only aware**, can triage back to Inbox, and does not require Nexus to run on the phone.
4. **Given** Phase 1 surfaces are Cursor and Claude Code, with Vault IO as the governed mutation path  
   **When** the doc presents the mobile journey  
   **Then** it includes a **decision table** (surface → allowed ops → audit expectation), explicitly calling out that Obsidian Mobile “edit on disk” actions are **not** Vault IO audited.
5. **Given** agents must learn the mobile posture without expanding the Phase 1 MCP tool surface  
   **When** the doc is complete  
   **Then** it provides an exact “constitution pointer” sentence or table-row that the operator can add to `AI-Context/AGENTS.md` (or a referenced `AI-Context/modules/*` file) so agents load mobile rules by default.
6. **Given** Phase 2.1 planning work is in progress  
   **When** this story is implemented  
   **Then** it introduces **no** new Vault IO MCP tools, no changes to WriteGate policy, and no “mobile write hose” design beyond documentation.

## Tasks / Subtasks

- [x] Draft the mobile journey planning artifact (AC: 1–5)
  - [x] Create a new planning doc under `_bmad-output/planning-artifacts/` (recommended filename: `mobile-vault-access-journey.md`).
  - [x] Include: supported read path(s), auth assumptions, and failure modes (offline, sync conflicts, device loss).
  - [x] Add a short glossary mapping: “vault content edit” vs “Vault IO mutation” vs “agent-mediated action”.
- [x] Define governance posture (AC: 2, 4)
  - [x] Write a clear stance: mobile is **additive** and **not** a Phase-1 first-class execution surface.
  - [x] Provide a decision table with at least:
    - Obsidian Mobile (Synced vault)
    - SSH + terminal viewer/editor
    - Cursor (WSL)
    - Claude Code (WSL)
    - Vault IO MCP (stdio)
    - Nexus (if applicable in this vault’s operating model)
  - [x] For each surface, define: allowed read, allowed write, whether action is audit-logged, and recommended usage.
- [x] Document coexistence with Nexus (AC: 3)
  - [x] State how mobile reads “see” Nexus-managed notes (if present) without implying Nexus on mobile.
  - [x] State safe triage patterns (e.g., capture in `00-Inbox/` from desktop via Vault IO; mobile can only review/tag if explicitly allowed).
- [x] Provide constitution hook text for always-on loading (AC: 5)
  - [x] Add an exact snippet for the operator to paste into `AI-Context/AGENTS.md` (or a module referenced by it) that:
    - Declares mobile read/write posture
    - Declares audit expectation differences
    - Points to the planning doc location for details
  - [x] Include a decision table or bullet list: surface → allowed ops → audit expectation.
- [x] Non-goals and constraints section (AC: 6)
  - [x] Explicitly state “no new MCP tools” and “no Vault IO / WriteGate changes” in this story.
  - [x] Call out what would be required in a future story to enable governed mobile writes (e.g., a new surface that routes through Vault IO or a secure remote runner).

### Review Findings

If this story has been previously implemented, preserve any review notes in the Dev Agent Record instead of marking tasks complete here.

## Dev Notes

- **This is documentation-led.** Implementation is expected to be markdown-only changes under `_bmad-output/planning-artifacts/` (and potentially an operator-applied constitution pointer on the vault side).
- **Do not** implement new MCP tooling or remote access plumbing here. This story is about preventing unsafe assumptions and clarifying posture.
- **Be explicit about audit semantics.** Vault IO writes are audited via `_meta/logs/agent-log.md`; direct mobile edits to synced files are not.
- **Avoid scope creep.** Mobile “allowed writes” must be either “none” or an explicitly bounded operator-only exception with clear risks.

### Project Structure Notes

- Story output file lives under `_bmad-output/implementation-artifacts/`.
- The planned journey doc should live under `_bmad-output/planning-artifacts/` and be referenced from the constitution pointer snippet.

### References

- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Epic 13 / Story 13.1 tracking)
- `_bmad-output/planning-artifacts/epics.md` (Epic 13 / Story 13.1 acceptance criteria)
- `_bmad-output/planning-artifacts/prd.md` (Phase 1 surfaces, audit posture, and governance requirements; “Mobile access — Phase 2” scope boundary)
- `_bmad-output/planning-artifacts/architecture.md` (boundaries: Vault IO vs vault content; audit semantics; first-class surfaces)
- `specs/cns-vault-contract/AGENTS.md` (constitution mirror; where mobile posture must ultimately be discoverable by agents)
- `CLAUDE.md` (scope boundaries; mobile is Phase 2+ and must not backdoor Phase 1 tool expansion)

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.
- [x] Operator guide: no update required (documentation artifacts only, no runtime behavior changes).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Promoted narrative from `_bmad-output/planning-artifacts/mobile-vault-access-journey.md` to canonical **`docs/mobile-vault-access-journey.md`** (Nexus-style docs home). Planning artifact is now a **stub** pointing at the canonical file for stable BMAD links.
- **`AGENTS.md` (specs mirror + vault):** Version **1.5.0**; **Section 5** adds **Mobile (distinct from Nexus and Vault IO)** with read-first posture, **no broader mobile writes unless the constitution and module explicitly allow them**, **Tailscale + Blink Shell** as the named SSH read stack, and pointers to `docs/mobile-vault-access-journey.md` and `AI-Context/modules/mobile-posture.md`.
- **`mobile-posture` modules:** See also updated to canonical doc + BMAD stub.
- **`docs/index.md`:** Link added under Existing Documentation.
- **Operator guide:** no update required (doc-only, no MCP or WriteGate behavior change).
- **`bash scripts/verify.sh`:** passed (2026-04-14).

### File List

- `docs/mobile-vault-access-journey.md` (new, canonical)
- `docs/index.md`
- `_bmad-output/planning-artifacts/mobile-vault-access-journey.md` (stub pointer)
- `specs/cns-vault-contract/AGENTS.md`
- `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`
- `specs/cns-vault-contract/modules/mobile-posture.md`
- `Knowledge-Vault-ACTIVE/AI-Context/modules/mobile-posture.md`
- `_bmad-output/implementation-artifacts/13-1-mobile-vault-access-journey-and-governance-posture.md` (this file)

### Change Log

- 2026-04-14: Story 13-1 implemented and review fixes applied (doc promotion, Section 5 mobile posture, module See also, index link, enforceable mobile write gate wording, named SSH stack in module; verify green).
