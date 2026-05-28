# Story 48.6 (SC-6): Session-close operator guide and Hermes smoke test

Status: ready-for-dev

Epic: **48** (Session-close context reduction — FR-17..19)  
Tracked in sprint-status as: **`48-6-session-close-operator-guide-and-hermes-smoke`**  
**Depends on:** SC-1 through SC-5 (full pipeline shippable)

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` (FR-19, Acceptance criteria #1–#5).

## Context

- **FR-19:** Token budget enforcement, documented skill/Hermes config contract, CI verification — operator-facing doc completes the contract.
- **Operator guide:** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.4 (vault path; repo mirror may exist for tests).
- **Smoke:** `/session-close --dry-run` in Discord `#hermes` — operator-measured ≤6k tokens after Phase A (ADR acceptance #1).
- **Env:** Document `~/.hermes/session-close.env` with `OMNIPOTENT_REPO` and `CNS_VAULT_ROOT` (ADR-SC-006).

## Story

As an **operator**,  
I want **Operator Guide documentation and a recorded dry-run smoke test for the two-phase session-close pipeline**,  
so that **I can run closes confidently and verify the token budget** (FR-19).

## Acceptance Criteria

1. **Operator Guide §15.4 (AC: guide)**  
   **Given** SC-5 slim skill is installed  
   **When** this story ships  
   **Then** `CNS-Operator-Guide.md` §15.4 describes:  
   - Two-phase pipeline (Phase A deterministic, Phase B §8 only, optional Phase C NotebookLM)  
   - Mandatory `run-deterministic.mjs` first step  
   - `~/.hermes/session-close.env` variables  
   - Dry-run vs real close behavior  
   - Token budget target (≤5k typical, **6k hard ceiling**)  
   - No `git commit` in session-close (preserve 43-1 correction)  
   **And** Version History row added  

2. **Hermes config snippet (AC: config)**  
   **When** shipped  
   **Then** `references/config-snippet.md` in skill package matches guide env instructions  
   **And** documents gateway should export env before Discord sessions (dashboard-sync.env pattern)  

3. **Dry-run smoke (AC: smoke)**  
   **When** operator runs `/session-close --dry-run` in `#hermes`  
   **Then** record evidence in Dev Agent Record:  
   - Phase A completed (`context-pack.json` present)  
   - No AGENTS/MEMORY/rhythm/export writes (dry-run)  
   - Discord preview includes sprint + §8 preview bullets from report  
   - Hermes session metrics: input tokens **≤6000** after Phase A completes (screenshot or log line reference)  

4. **Real close smoke (optional, AC: real-smoke)**  
   **If** operator approves real close in same sprint  
   **Then** verify parity checklist from ADR acceptance #2: both AGENTS copies, export file, MEMORY, fast-scan index, 11 AUTO markers, NotebookLM fan-out status lines  
   **Else** note "real close deferred" in Dev Agent Record  

5. **Deferred-work hygiene (AC: deferred)**  
   **When** complete  
   **Then** update `_bmad-output/implementation-artifacts/deferred-work.md` if any session-close token/context item exists — mark done or reference Epic 48  

6. **Gateway restart note (AC: cache)**  
   **When** documenting smoke  
   **Then** guide mentions reinstall + gateway restart if old monolithic skill cached (ADR risk table)  

7. **Verify gate (AC: verify)**  
   **When** shipped  
   **Then** `bash scripts/verify.sh` still passes (no regression from doc-only + smoke story)  

8. **Sprint status (AC: sprint)**  
   **When** all Epic 48 stories done  
   **Then** operator may set `epic-48: done` in `sprint-status.yaml` (out of scope until SC-1..5 complete)  

## Tasks / Subtasks

- [ ] Update Operator Guide §15.4 + version history (AC: guide)
- [ ] Align `config-snippet.md` with guide (AC: config)
- [ ] Run `/session-close --dry-run` smoke; record token metrics (AC: smoke)
- [ ] Deferred-work triage if applicable (AC: deferred)

## Dev Notes

### Standing task: Update operator guide

This story **is** the operator guide deliverable for Epic 48.

### References

- [Source: ADR — Acceptance criteria, Hermes config, Risks Hermes cache]
- [Source: `_bmad-output/implementation-artifacts/43-1-cns-daily-rhythm-auto-blocks-via-session-close.md` — §15.4 precedent]

## Dev Agent Record

_(pending dev-story — include smoke evidence)_

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Story SC-6 created from ADR |
