---
title: "Product Brief — 58-2 WatchedSurface Tier-2 Multi-Surface (go/no-go)"
status: ready
created: 2026-07-13
updated: 2026-07-13
source: bmad-product-brief
intent: settle-and-close
story: 58-2-watchedsurface-tier2-multi-surface
epic: 58
recommendation: NO-GO
---

# Product Brief: 58-2 WatchedSurface — Tier-2 Multi-Surface (Go / No-Go)

## Verdict

**NO-GO. Do not build. Cancel 58-2 (reservation withdrawn). Close Epic 58.**

No concrete, recurring operator decision measurably fails on the current single Drive-PDF fan-out. The 58-1 reservation was architectural foresight without a pain driver. Tier-2 would add duplication and sync failure modes against a path just hardened in 58-3 and 58-4. The operator bottleneck is revenue, not NotebookLM surface coverage.

## Why this brief exists

Story `58-2-watchedsurface-tier2-multi-surface` was `reserved` in sprint-status: planned in 58-1, never scoped, no design doc. Question: should session-close NotebookLM fan-out grow a Tier-2 WatchedSurface layer (additional watched Drive sources beyond the single vault-export PDF), or is the single-export design sufficient?

**Acceptable outcome:** close without building if the value case is weak.

**GO bar (held high):** name a concrete recurring decision that the Tier-1 corpus notebook answers wrong or staler than a scoped surface would. Abstract "more freshness" or "cleaner separation" does not clear the bar. A coverage gap without a failing query does not earn a build.

## What ships today (Tier-1)

| Piece | Behavior |
|-------|----------|
| Phase A export | `export-vault-for-notebooklm.sh` → `scripts/output/vault-export-for-notebooklm.md` |
| Export scope (verified) | **`01-Projects/` + `03-Resources/` only** — not a literal whole vault |
| Explicitly excluded | `AI-Context/`, `00-Inbox/`, `02-Areas/`, `04-Archives/`, `DailyNotes/`, `_meta/`, `_README*` |
| Phase C fan-out | md → PDF → Drive `uploadType=media` overwrite → `nlm source sync` per watched notebook |
| Watched notebooks | CNS Vault Architecture (`981466f0…`), AI Factory Blueprint (`dc6abf1a…`), Nexus Discord Bridge (`f037c741…`) |
| Hardening already done | 58-1 Drive stability; 58-3 PDF under 60s budget; 58-4 concurrent sync, per-call timeouts, incremental stamps |

[ASSUMPTION] Operator migration for 58-3 (PDF source on all three watched notebooks) remains the production path.

Confirmed: "AI Factory Blueprint near source-limit" history is **manual research `source_add` churn**, not vault-export fan-out — out of scope for 58-2.

Confirmed: no standing "I keep manually adding X into NotebookLM" pain; the 58-1 reservation is the whole origin story.

## Problem (or lack of one)

**Origin:** 58-1 carved Tier-2 out of scope so Drive-sync could ship first. No subsequent design pass. No operator thread naming a recurring NotebookLM miss that a second watched surface would fix.

**Coping today:** session-close keeps one corpus fresh; constitution focus (§8) is written by session-close into live `AGENTS.md`; sprint state lives in repo `sprint-status.yaml` and dashboard/IDE surfaces; Daily Rhythm sits under `AI-Context/` and is outside the export filter by design.

**Cost of status quo:** none observed for Tier-2. **Cost of building:** N additional Drive files, N× match/sync paths, title-anchored PDF fallbacks, per-notebook migration, more mixed-snapshot failure modes — against a fan-out path that just stopped bleeding.

## Candidate surfaces — kill matrix

| Candidate | In Tier-1 PDF? | Named recurring NLM failure if absent? | Verdict |
|-----------|----------------|----------------------------------------|---------|
| Per-PARA area exports | Projects + Resources already covered; Areas/Inbox/Archives not | No | Kill — overlap + duplication; Areas gap unproven |
| `CNS-Daily-Rhythm.md` | No (`AI-Context/` excluded by design) | No | Kill — coverage gap ≠ failure |
| `sprint-status.yaml` | No (repo file, not vault export) | No | Kill — SSOT already in tracker/IDE; NLM is the wrong home |
| `AGENTS.md` §8 | No (`AI-Context/` excluded by design) | No | Kill — §8 applied live by session-close; NLM is not the §8 consumer of record |

## Recommendation rationale

1. **Bar not met.** No named decision fails on the single PDF.
2. **Wrong bottleneck.** Substrate is mature; revenue is the constraint.
3. **Regress risk > option value.** Multi-surface sync multiplies failure classes 58-3/58-4 fixed (write budget, list timeouts, unstamped targets, matcher ambiguity).
4. **Landscape.** Multi-source helps when notebooks have distinct jobs; overlapping vault PDFs do not. PDF Drive sources stay snapshot/manual-sync class vs native Doc auto-sync — more PDFs means more sync choreography.
5. **Reopen path.** Later failure → new story with failed query + scoped surface as AC#0 evidence. Do not keep a forever-reserved stub.

## Scope

### In (this brief)

- Settle GO / NO-GO
- Closure text for sprint-status + deferred-work
- Close Epic 58 (58-1 / 58-3 / 58-4 `done`; 58-2 `cancelled`)

### Out

- Implementing any Tier-2 WatchedSurface machinery
- Changing export filters, Drive IDs, or watched-notebook registry
- Expanding AI Factory Blueprint source hygiene (manual research adds)
- Raising drive-sync wall-clock budgets as a substitute design

## Success criteria (for this decision)

- [x] Sprint-status: `58-2` → `cancelled`; `epic-58` → `done`
- [x] Deferred-work: closure note recorded (no open Tier-2 promise)
- [x] No new session-close code for multi-surface
- [x] Reopen only with a named failing query

## Applied closure

### sprint-status.yaml

```yaml
  # Epic 58 — NotebookLM vault export Drive sync (operator brief 2026-06-03)
  # Closed 2026-07-13: 58-2 WatchedSurface Tier-2 NO-GO (brief-CNS-2026-07-13).
  epic-58: done
  58-1-migrate-vault-export-drive-doc-sync: done
  58-2-watchedsurface-tier2-multi-surface: cancelled # NO-GO 2026-07-13 (brief-CNS-2026-07-13): reservation-without-pain, no failing single-corpus query; Tier-2 reopens 58-3/58-4 sync failure modes; export scope 01-Projects+03-Resources by design
  58-3-session-close-notebooklm-pdf-source-fix: done
  58-4-drive-sync-phase-hardening-and-diagnostics-integrity: done
```

### deferred-work.md

See prepended section: **58-2 WatchedSurface Tier-2 multi-surface — ✅ CLOSED 2026-07-13, NO-GO / cancelled**.

## What would reopen this

A GO requires all of:

1. A recurring operator question or decision (named, not hypothetical)
2. Evidence the Tier-1 PDF notebook answers it wrong, incomplete, or stale
3. A scoped surface that would fix that miss without largely duplicating Projects+Resources
4. Acceptance that the new surface pays its own sync/ops cost

Until then: single-export design is sufficient.
