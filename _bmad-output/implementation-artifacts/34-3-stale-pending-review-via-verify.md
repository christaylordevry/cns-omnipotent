---
story_id: 34-3
epic: 34
title: stale-pending-review-via-verify
status: ready-for-dev
---

# Story 34.3: Stale pending review via /verify

Status: ready-for-dev

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

- [ ] Confirm Hermes gateway + `vault-think` v1.3.0 on `#hermes`.
- [ ] For each **SynthesisNote** row: `/verify <path>` (review excerpt) → `/verify verified <path>` or `/verify disputed <path>`.
- [ ] For each **WorkflowNote / InsightNote / SourceNote** row: `vault_update_frontmatter` with `verification_status` + `modified: 2026-05-17` (or run date).
- [ ] Write evidence artifact with full decision log.
- [ ] Re-run `/vault-lint`; confirm Rule 3 clear for processed paths.
- [ ] Standing task: Operator guide — **no update required** (`/verify` already documented v1.30.0).

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

_(operator / agent on run)_

### Completion Notes List

_(fill when 22/22 processed)_

### File List

- `_bmad-output/implementation-artifacts/epic-34-stale-pending-verify-evidence.md` (create on completion)
- Up to 22 vault notes (frontmatter `verification_status` only)

## Change Log

- 2026-05-17: Story created for Epic 34 — operator stale-pending clearance via `/verify` + MCP.
