---
story_id: 34-3
epic: 34
title: stale-pending-review-via-verify
status: in-progress
---

# Story 34.3: Stale pending review via /verify

Status: in-progress

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want to **clear the 22 stale `verification_status: pending` notes** flagged by vault lint (older than 14 days) using the live **`/verify`** workflow in `#hermes`,  
so that **verification debt is resolved** with human judgment (`verified` vs `disputed`) and an auditable evidence record.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 34: Vault Health + Cost Optimization |
| **Phase** | 6 |
| **Story class** | **Operator run** — not a code/repo implementation story |
| **Skill** | `vault-think` v1.3.0 — `/verify` queue, single-note review, marking tokens |
| **Lint source** | `Knowledge-Vault-ACTIVE/_meta/reports/vault-lint-2026-05-17.md` § Rule 3 (22 WARNINGs) |
| **Evidence artifact** | `_bmad-output/implementation-artifacts/epic-34-stale-pending-verify-evidence.md` |

## Acceptance Criteria

1. **Gateway live:** Hermes gateway running; `#hermes` bound to `vault-think`.
2. **Queue review:** Operator runs **`/verify`** (and **`/verify --offset N`** as needed) to see pending SynthesisNotes; for **non-SynthesisNote** stale items in the list below, use **`/verify <path>`** only if type is SynthesisNote; otherwise use **`vault_update_frontmatter`** via Vault IO MCP with operator judgment (WorkflowNote/InsightNote/SourceNote are **not** `/verify` targets per skill contract).
3. **All 22 Rule 3 paths processed:** Each note below receives **`verification_status: verified`** or **`disputed`** (not left `pending`).
4. **SynthesisNotes in list:** Prefer **`/verify verified <path>`** or **`/verify disputed <path>`** in Discord (governed mutator).
5. **Non-SynthesisNotes in list:** Use **`vault_update_frontmatter`** with `verification_status` + `modified` (same fields `/verify` would stamp); document command in evidence file.
6. **Evidence artifact** created at **`_bmad-output/implementation-artifacts/epic-34-stale-pending-verify-evidence.md`** with table: path, pake_type, days_pending, decision (`verified`/`disputed`), method (`/verify` vs MCP), timestamp (UTC).
7. **Post-run lint:** Re-run **`/vault-lint`**; **Rule 3 (stale_pending) count = 0** for these 22 paths (new stale notes may appear later — out of scope).
8. **No repo code changes** required for story completion (optional: evidence file only in `_bmad-output/`).

## Stale pending queue (22 notes — from vault-lint-2026-05-17)

| # | Path | Type | Days pending (report) |
|---|------|------|------------------------|
| 1 | `01-Projects/Brain - Central Nervous System Build/Session-Summary-Phase3-Day1.md` | WorkflowNote | 41 |
| 2 | `01-Projects/CNS-Phase-1/cns-phase-1-complete.md` | WorkflowNote | 44 |
| 3 | `03-Resources/AI-Native-Infrastructure/ai-factory-pillars-notebooklm-synthesis.md` | InsightNote | 42 |
| 4 | `03-Resources/CNS-Gap-Analysis-2026-04-06.md` | InsightNote | 41 |
| 5 | `03-Resources/notebooklm-project-map.md` | SourceNote | 42 |
| 6 | `03-Resources/perplexity-ai-agent-orchestration-frameworks-langchain-langgraph-2026-how-to-build-production-ai-agents-with-langgraph-2.md` | SynthesisNote | 19 |
| 7 | `03-Resources/perplexity-ai-agent-orchestration-frameworks-langchain-langgraph-2026-langchain-agent-tools-memory-and-state-management-.md` | SynthesisNote | 19 |
| 8 | `03-Resources/perplexity-ai-agent-orchestration-frameworks-langchain-langgraph-2026-langchain-vs-langgraph-agent-orchestration-compari.md` | SynthesisNote | 19 |
| 9 | `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-2026-04.md` | InsightNote | 17 |
| 10 | `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-bot-pro.md` | SynthesisNote | 17 |
| 11 | `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-reddit-com-creative-technologist-consulting-rates-sydney-2.md` | SynthesisNote | 17 |
| 12 | `03-Resources/perplexity-creative-technologist-remote-roles-and-how-to-position-for-them-in-2026-creative-technologist-remote-job-mark.md` | SynthesisNote | 25 |
| 13 | `03-Resources/perplexity-creative-technologist-remote-roles-and-how-to-position-for-them-in-2026-how-to-position-ai-skills-for-creativ.md` | InsightNote | 25 |
| 14 | `03-Resources/perplexity-creative-technologist-remote-roles-and-how-to-position-for-them-in-2026-what-do-companies-actually-want-when-.md` | InsightNote | 25 |
| 15 | `03-Resources/perplexity-freelance-consulting-day-rate-calculation-methodology-2026-freelance-consultant-pricing-strategy-value-based-.md` | SynthesisNote | 18 |
| 16 | `03-Resources/perplexity-freelance-consulting-day-rate-calculation-methodology-2026-how-to-calculate-your-freelance-day-rate-consultin.md` | SynthesisNote | 18 |
| 17 | `03-Resources/perplexity-freelance-consulting-day-rate-calculation-methodology-2026-independent-consultant-rate-card-positioning-premi.md` | InsightNote | 18 |
| 18 | `03-Resources/perplexity-how-to-price-creative-agency-retainers-in-2026-how-to-price-creative-agency-retainer-fees-and-packages-2026-0.md` | SynthesisNote | 20 |
| 19 | `03-Resources/perplexity-how-to-price-creative-agency-retainers-in-2026-what-should-a-small-creative-agency-charge-for-a-monthly-retai.md` | SynthesisNote | 20 |
| 20 | `03-Resources/perplexity-obsidian-personal-knowledge-management-workflows-2026-obsidian-linking-notes-zettelkasten-second-brain-workfl.md` | SynthesisNote | 19 |
| 21 | `03-Resources/perplexity-obsidian-personal-knowledge-management-workflows-2026-obsidian-pkm-system-setup-best-practices-2026-2026-04-2.md` | SynthesisNote | 19 |
| 22 | `03-Resources/perplexity-obsidian-personal-knowledge-management-workflows-2026-obsidian-plugins-and-templates-for-productivity-system-.md` | SynthesisNote | 19 |

**SynthesisNote count:** 14 (use `/verify` marking tokens).  
**Other types:** 8 (use `vault_update_frontmatter` — `/verify` rejects non-SynthesisNote per `vault-think` guards).

## Tasks / Subtasks

- [x] Confirm Hermes gateway + `vault-think` v1.3.0 on `#hermes` (operator sign-off 2026-05-18 — code review).
- [x] For each **SynthesisNote** row: stamped `verified`/`disputed` via `vault_update_frontmatter` (MCP pipeline; `/verify` marking tokens optional re-review in `#hermes`).
- [x] For each **WorkflowNote / InsightNote / SourceNote** row: `vault_update_frontmatter` with `verification_status` + `modified: 2026-05-17`.
- [x] Write evidence artifact with full decision log.
- [ ] Re-run `/vault-lint`; confirm Rule 3 clear for processed paths (vault state clear; on-disk report stale until Hermes refresh).
- [x] Standing task: Operator guide — **no update required** (`/verify` already documented v1.30.0).

### Review Findings

- [x] [Review][Decision] AC1 — Hermes gateway sign-off not recorded — Resolved 2026-05-18: operator confirmed gateway live + `vault-think` on `#hermes`.
- [x] [Review][Decision] AC4 — SynthesisNotes stamped via MCP only, not `/verify` tokens — Resolved 2026-05-18: MCP batch accepted; Discord re-review not required.
- [x] [Review][Patch] AC7 — Refresh on-disk lint report — Acknowledged 2026-05-18: operator will run `/vault-lint` in `#hermes` (story task remains open until complete).
- [x] [Review][Defer] Evidence UTC vs audit log sub-second skew — Evidence table times (e.g. `11:23:17.436Z`) differ slightly from `agent-log.md` lines (e.g. `11:23:17.462Z`); cosmetic only. — deferred, pre-existing

## Dev Notes

### `/verify` command recap (SynthesisNote only)

From `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`:

- **Queue:** `/verify`, `/verify --offset 10`
- **Review:** `/verify <path-or-title>` (SynthesisNote in `03-Resources/`, `pending`)
- **Mark:** `/verify verified <vault-relative-path>` | `/verify disputed <vault-relative-path>`
- **Mutator:** single `vault_update_frontmatter` per mark (`verification_status` + `modified` only)

### Judgment guidance

| Signal | Suggested stamp |
|--------|-----------------|
| Epic/session summaries, project maps, gap analyses still accurate | `verified` |
| Superseded research sweeps, duplicate perplexity chains, low-trust bot output | `disputed` |
| Operator unsure | `disputed` + note in evidence (revisit later) |

### Dependency on 34-2

If **34-2** has not run, some paths may still lack valid `pake_type` / `verification_status` enum — complete frontmatter patch first or stamp via MCP with valid enums.

### Evidence artifact template

```markdown
# Epic 34 — Stale pending /verify evidence

**Run date:** YYYY-MM-DD  
**Operator:** …  
**Gateway:** hermes gateway status …

| Path | pake_type | Decision | Method | UTC time |
|------|-----------|----------|--------|----------|
| … | … | verified | /verify verified … | … |
```

### Anti-patterns

- Do not use `/verify` on InsightNote/WorkflowNote/SourceNote (skill returns `verify not-synthesis`).
- Do not leave any of the 22 paths in `pending`.
- Do not edit note bodies.

### References

- [Source: `Knowledge-Vault-ACTIVE/_meta/reports/vault-lint-2026-05-17.md` — Rule 3 section]
- [Source: `_bmad-output/implementation-artifacts/33-1-verify-command-synthesisnote-review.md`]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — §15.8 `/verify`]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md` — Rule 3]

## Dev Agent Record

### Agent Model Used

Composer (Cursor dev-story)

### Completion Notes List

**22/22 processed** via `vaultUpdateFrontmatter` (surface `story-34-3`): **5 verified** (session summary, phase-1 complete, pillars synthesis, gap analysis, notebooklm map); **17 disputed** (perplexity research chains per judgment table).

**AC4 note:** SynthesisNotes stamped via MCP pipeline; code review (2026-05-18) accepted MCP batch — Discord re-review not required.

**AC1:** Operator confirmed Hermes gateway + `vault-think` v1.3.0 on `#hermes` (2026-05-18).

**AC7:** All 22 paths `verified|disputed` on disk. Operator to run `/vault-lint` in `#hermes` to refresh report (pending).

**Audit:** 22 `story-34-3` lines in `_meta/logs/agent-log.md`.

**Evidence:** `epic-34-stale-pending-verify-evidence.md`

### File List

- `_bmad-output/implementation-artifacts/epic-34-stale-pending-verify-evidence.md`
- 22 vault notes (frontmatter `verification_status` + `modified` only)
- `Knowledge-Vault-ACTIVE/_meta/logs/agent-log.md` (audit lines)

## Change Log

- 2026-05-17: Story created for Epic 34 — operator stale-pending clearance via `/verify` + MCP.
- 2026-05-17: 22/22 stale-pending queue stamped; evidence artifact created; status → review (Hermes gateway sign-off + `/vault-lint` refresh pending).
- 2026-05-18: Code review — AC1 signed off, AC4 MCP batch accepted; AC7 `/vault-lint` refresh committed by operator; status → in-progress.
