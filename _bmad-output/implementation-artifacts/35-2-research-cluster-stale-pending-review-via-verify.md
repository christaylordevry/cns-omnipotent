---
story_id: 35-2
epic: 35
title: research-cluster-stale-pending-review-via-verify
status: ready-for-dev
---

# Story 35.2: Research cluster stale pending review via /verify

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want to **clear all 69 Research-cluster notes** still at **`verification_status: pending`** (aged ~7–8 weeks) using the live **`/verify`** workflow in **`#hermes`**,  
so that **Research verification debt is resolved** with human judgment and an auditable evidence record, and vault lint stale-pending counts drop for that cluster.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 35: Vault Curation + Housekeeping |
| **Phase** | 6 |
| **Story class** | **Operator run only** — no repo code changes required |
| **Skill** | `vault-think` v1.3.0+ — `/verify` queue, single-note review, marking tokens |
| **Cluster** | `03-Resources/Research/` (and paths lint reports under that cluster) |
| **Scale** | **69 notes** with `verification_status: pending`, ~7–8 weeks old |
| **Predecessor** | Story **34-3** cleared 22 cross-vault stale pending (mixed types); this story is **Research-only** at larger scale |
| **Evidence artifact** | `_bmad-output/implementation-artifacts/epic-35-research-verify-evidence.md` |

**Lint relationship:** Rule 3 (`stale_pending`) flags governed notes left in `pending` longer than 14 days. After 34-3, Research cluster pending debt remains concentrated in `03-Resources/Research/`.

## Acceptance Criteria

1. **Gateway live:** Hermes gateway running; **`#hermes`** bound to **`vault-think`** with `/verify` available.
2. **Queue discovery:** Operator runs **`/verify`** in `#hermes` (and **`/verify --offset N`** as needed) to enumerate pending items; filter or track progress against the **Research cluster** target set (**69 notes**).
3. **Per-note review:** For each Research-cluster path:
   - **SynthesisNote:** Use **`/verify <path>`** for review, then **`/verify verified <vault-relative-path>`** or **`/verify disputed <vault-relative-path>`** (governed mutator — single `vault_update_frontmatter` per mark).
   - **Non-SynthesisNote** (SourceNote, InsightNote, etc. in Research): `/verify` may reject non-SynthesisNote targets — use **`vault_update_frontmatter`** via Vault IO MCP with `verification_status` + `modified` only; document method in evidence.
4. **Completion:** All **69** Research-cluster pending notes receive **`verified`** or **`disputed`** — none left `pending`.
5. **Evidence artifact** at **`_bmad-output/implementation-artifacts/epic-35-research-verify-evidence.md`** containing:
   - Run date, operator, gateway confirmation
   - Table: `path`, `pake_type`, `days_pending` (from lint or frontmatter), `decision` (`verified`|`disputed`), `method` (`/verify` vs MCP), `timestamp` (UTC)
   - Summary counts: verified / disputed / total processed = **69**
6. **Post-run lint:** Operator runs **`/vault-lint`** in `#hermes`; **Research cluster stale pending count drops to 0** for the processed set (new pending from fresh ingest out of scope).
7. **No repo code changes** required for story completion (evidence file in `_bmad-output/` only).

## Tasks / Subtasks

- [ ] Confirm Hermes gateway + `vault-think` on `#hermes`. (AC1)
- [ ] Run **`/verify`**; capture initial queue size and Research paths (screenshot or paste into evidence draft). (AC2)
- [ ] Build working checklist of 69 paths (from latest `/vault-lint` Rule 3 section or `/verify` queue + `vault_list` `03-Resources/Research/`). (AC2)
- [ ] Process each note with judgment; stamp via `/verify` tokens or MCP. (AC3–4)
- [ ] Write **`epic-35-research-verify-evidence.md`** with full decision log. (AC5)
- [ ] Re-run **`/vault-lint`**; record Rule 3 Research metrics in evidence. (AC6)
- [ ] Standing task: Operator guide — **no update required** unless `/verify` behaviour changed (already v1.30.0).

## Dev Notes

### `/verify` command recap (SynthesisNote)

From `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`:

| Step | Command |
|------|---------|
| Queue | `/verify`, `/verify --offset 10` |
| Review | `/verify <path-or-title>` |
| Mark verified | `/verify verified <vault-relative-path>` |
| Mark disputed | `/verify disputed <vault-relative-path>` |

**Mutator:** one `vault_update_frontmatter` per mark (`verification_status` + `modified` only).

### Judgment guidance (same as 34-3)

| Signal | Suggested stamp |
|--------|-----------------|
| Research still accurate, sources intact | `verified` |
| Superseded sweep, duplicate chain, low-trust bot output | `disputed` |
| Unsure | `disputed` + note in evidence |

### MCP fallback (non-SynthesisNote)

```
vault_update_frontmatter {
  path: "03-Resources/Research/....md",
  updates: { verification_status: "verified"|"disputed", modified: "YYYY-MM-DD" }
}
```

### Evidence artifact template

```markdown
# Epic 35 — Research cluster /verify evidence

**Run date:** YYYY-MM-DD  
**Operator:** …  
**Gateway:** …  
**Target:** 69 notes under 03-Resources/Research/

| Path | pake_type | Days pending | Decision | Method | UTC time |
|------|-----------|--------------|----------|--------|----------|
| … | … | … | verified | /verify | … |

## Summary
- Processed: 69
- Verified: …
- Disputed: …
- Post /vault-lint Rule 3 (Research): …
```

### Dependency on Epic 34

If any Research note still lacks valid `pake_type` / `verification_status` enum from **34-2** gaps, patch frontmatter first or stamp via MCP with valid enums before counting toward AC4.

### Anti-patterns

- Bulk-stamping all 69 as `verified` without review (violates quality loop intent).
- Editing note bodies or non-verification frontmatter via MCP.
- Leaving evidence incomplete “will fill later.”

### References

- [Source: `_bmad-output/implementation-artifacts/34-3-stale-pending-review-via-verify.md`]
- [Source: `_bmad-output/implementation-artifacts/33-1-verify-command-synthesisnote-review.md`]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — § verify / vault-think]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md` — Rule 3]

## Dev Agent Record

### Agent Model Used

(create-story)

### Completion Notes List

### File List

- `_bmad-output/implementation-artifacts/epic-35-research-verify-evidence.md` (create on completion)
