# Story 27.3: Routing suggestions via heuristics (PAKE type, filename pattern, age)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **operator**,
I want **`/triage` to attach read-only routing suggestions for each Inbox candidate using simple heuristics (frontmatter `pake_type` when present, filename and path patterns when not, plus age buckets from modified time)**,
so that **I can review candidates faster and decide which items to approve for moves in later stories without Hermes mutating anything now**.

## Acceptance Criteria

1. **Read-only routing suggestions (AC: suggestions)**

   - **Given** `/triage` lists candidate notes under `00-Inbox/`
   - **When** Hermes renders each candidate preview row
   - **Then** each item includes a **routing suggestion** block with:
     - suggested `pake_type` (or `unknown`)
     - suggested destination directory (vault-relative, e.g. `03-Resources/` or `02-Areas/`)
     - a short reason string (1 sentence, deterministic, no speculation)
     - a confidence label: `low | medium | high`
   - **And** suggestions are **advisory only** and explicitly state that no actions were taken

2. **Primary signal: frontmatter `pake_type` when available (AC: pake-type)**

   - **Given** a candidate note contains YAML frontmatter with a valid `pake_type`
   - **When** Hermes generates suggestions
   - **Then** it uses `pake_type` as the primary signal and maps it to a destination using Phase 1 routing defaults:
     - `SourceNote | InsightNote | SynthesisNote | ValidationNote` → `03-Resources/`
     - `WorkflowNote` → `01-Projects/<project>/` only when explicit project context is provided, otherwise `02-Areas/` (fallback)
   - **And** Hermes may call `vault_read_frontmatter` for candidates to extract `pake_type` without reading full bodies when possible

3. **Secondary signal: filename and path patterns (AC: filename-heuristics)**

   - **Given** a candidate has no valid `pake_type` frontmatter
   - **When** Hermes generates suggestions
   - **Then** it uses simple deterministic pattern rules over `vaultPath` and filename to infer a likely type and destination
   - **And** ambiguous cases resolve to `unknown` with destination `00-Inbox/` and `low` confidence

4. **Tertiary signal: age buckets (AC: age)**

   - **Given** candidate inventory includes `modified` timestamps from `vault_list`
   - **When** Hermes generates suggestions
   - **Then** it assigns an **age bucket** per candidate: `fresh` (≤ 2 days), `recent` (≤ 14 days), `stale` (> 14 days)
   - **And** stale items include a note in the reason string suggesting operator review for relevance, without proposing deletion or discard

5. **No new discovery scope or mutations (AC: guardrails)**

   - **Given** Stories 27.1–27.2 discovery and refusal rules exist
   - **When** `/triage` runs with routing suggestions enabled
   - **Then** all Vault IO calls remain scoped **at or under** `00-Inbox/` only
   - **And** Hermes still calls **no mutating tools**, and does not introduce any new tool calls beyond `vault_list`, `vault_search` (scoped, optional), `vault_read`, and `vault_read_frontmatter`

## Tasks / Subtasks

- [x] **Update triage skill docs to include routing suggestions** (AC: suggestions, guardrails)
  - [x] Update `scripts/hermes-skill-examples/triage/SKILL.md` description and bump version if behavior changes.
  - [x] Extend `scripts/hermes-skill-examples/triage/references/task-prompt.md` with a deterministic “routing suggestion” section and output schema additions.
  - [x] If trigger grammar needs any new optional flags, update `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`. Prefer no new flags; suggestions should be default-on for Story 27.3. _(No trigger changes required.)_

- [x] **Implement heuristics specification in the task prompt** (AC: pake-type, filename-heuristics, age)
  - [x] Define the routing table based on `pake_type` literals and Phase 1 folder destinations.
  - [x] Define deterministic filename/path heuristics for when `pake_type` is missing.
  - [x] Define age bucket computation using `modified` timestamps returned by `vault_list`.

- [x] **Add regression tests for the prompt contract** (AC: suggestions, guardrails)
  - [x] Update `tests/hermes-triage-skill.test.mjs` to assert the new routing suggestion schema and mapping rules exist.

- [x] **Operator guide update (standing task)** (if user-visible output changes)
  - [x] If output changes are operator-visible, update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3 and bump Version History.
  - [x] If no update is required, record “Operator guide: no update required” in Dev Agent Record. _(N/A: operator guide updated.)_

### Review Findings

- [x] [Review][Patch] Filename/path heuristic matches do not define deterministic reason strings [scripts/hermes-skill-examples/triage/references/task-prompt.md:164]: fixed by adding explicit reason templates for each filename/path heuristic branch and a regression assertion for all five templates.

## Dev Notes

### Sequencing

- **Depends on:** 27.1 and 27.2. This story must not implement approval UX (27.4) or any move execution (27.5).
- Suggestions must be **read-only** and must not imply that Hermes can move notes now.

### Routing defaults (Phase 1)

- Use Phase 1 default routing map for `pake_type` to folders as described in `specs/cns-vault-contract/CNS-Phase-1-Spec.md` and mirrored in `specs/cns-vault-contract/AGENTS.md`.
- For `WorkflowNote`, do not infer project context. If explicit project context is not present, use `02-Areas/` fallback only.

### Safety and determinism

- Keep suggestions deterministic and based only on:
  - `vaultPath` and filename tokens
  - `modified` timestamps from `vault_list`
  - frontmatter `pake_type` from `vault_read_frontmatter` when present
- Do not use note body content as a routing signal in this story. Body excerpts remain for preview only.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

- `node --test tests/hermes-triage-skill.test.mjs` (2026-05-04): PASS.
- `bash scripts/verify.sh` (2026-05-04): PASS.
- Code review fix: `bash scripts/verify.sh` (2026-05-04): PASS.

### Completion Notes List

- Skill bumped to **v1.2.0**; `/triage` now includes **read-only routing suggestions** per candidate in the prompt contract.
- Suggestions are deterministic and use only: `vaultPath`, `modified` (from `vault_list`), and optional `vault_read_frontmatter` for `pake_type` (no note body used for routing signals).
- Mapping defaults align to Phase 1 routing: `SourceNote|InsightNote|SynthesisNote|ValidationNote` → `03-Resources/`; `WorkflowNote` → `02-Areas/` unless explicit project context is present (not inferred).
- Added age buckets `fresh|recent|stale` and stale copy rule (“stale capture, review relevance”) without proposing discard or deletion.

### File List

- `scripts/hermes-skill-examples/triage/SKILL.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `tests/hermes-triage-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/27-3-routing-suggestions-via-heuristics-pake-type-filename-pattern-age.md`

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-04 | Story 27.3: added routing suggestion contract to Hermes triage skill (prompt + tests), updated operator guide, and marked story ready for review. |
| 2026-05-04 | Code review fix: added deterministic reason templates for filename/path heuristic matches, strengthened prompt-contract regression coverage, verified, and marked story done. |
