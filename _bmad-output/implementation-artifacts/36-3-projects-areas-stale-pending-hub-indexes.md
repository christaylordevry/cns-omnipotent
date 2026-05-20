---
story_id: 36-3
epic: 36
title: projects-areas-stale-pending-hub-indexes
status: ready-for-dev
---

# Story 36.3: 01-Projects + 02-Areas stale pending review + hub indexes

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want **`01-Projects/` and `02-Areas/` verification debt cleared** via **`/verify`** and **hub `_README.md` indexes** that wikilink all **WorkflowNotes** in those trees,  
so that **Rule 3 stale-pending warnings drop to zero for those clusters**, **Rule 2 orphan warnings fall materially** (vault lint reported **40** orphans / **29** stale pending on 2026-05-18), and **project/area notes are discoverable from directory manifests**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 36: Operational Stability + Vault Close-Out |
| **Phase** | 6 |
| **Lint authority** | `_meta/reports/vault-lint-2026-05-18.md` — **R2: 40** orphan warnings; **R3: 29** stale pending (vault-wide) |
| **Part A cluster** | **`01-Projects/`** + **`02-Areas/`** only — **27 paths** in Rule 3 Fix JSON (remaining after 34-3 cleared 2 Project WorkflowNotes) |
| **Part B mechanism** | Extend existing contract manifests **`01-Projects/_README.md`**, **`02-Areas/_README.md`** with wikilink indexes (same class as Story **35-3** Research hub) |
| **Predecessor** | **34-3** (22 mixed-vault stale pending), **35-2** (Research cluster), **35-3** (Research orphan hub) |

**Important:** Parent `_README.md` files **already exist** on the live vault with contract frontmatter but **no wikilink index**. Part B is **update/enrich**, not blind create (duplicate path would fail).

## Acceptance Criteria

### Part A — Operator `/verify` run (stale pending)

1. **Gateway live:** Hermes gateway running; **`#hermes`** → **`vault-think`** with **`/verify`**.
2. **Queue:** Operator runs **`/verify`** in `#hermes` to list pending; work through **all `01-Projects/` and `02-Areas/` stale pending** targets (baseline **27** from `vault-lint-2026-05-18.md` Rule 3; use live queue if count differs).
3. **Per note:**
   - **SynthesisNote** (if any in cluster): **`/verify <path>`** then **`/verify verified <path>`** or **`/verify disputed <path>`**.
   - **WorkflowNote** (expected majority): **`vault_update_frontmatter`** via Vault IO MCP — `verification_status` + `modified` only (same as 34-3 / 35-2).
4. **Completion:** Every targeted path → **`verified`** or **`disputed`**; none left **`pending`**.
5. **Evidence artifact** at **`_bmad-output/implementation-artifacts/epic-36-stale-pending-verify-evidence.md`**: table with `path`, `pake_type`, `days_pending`, `decision`, `method`, `timestamp` (UTC); summary count.
6. **Post-run lint:** Operator runs **`/vault-lint`**; Rule 3 count for **01-Projects + 02-Areas** processed set → **0** (new ingest pending out of scope).

### Part B — Hub indexes (orphan reduction)

7. **Inventory:** From latest **`/vault-lint`** (or report), capture Rule 2 **before** counts; list orphan candidates under **`01-Projects/`** and **`02-Areas/`** (exclude `_README.md` from orphan targets; hubs are edge sources).
8. **`vault_list`** on **`01-Projects/`** and **`02-Areas/`** — collect all **`WorkflowNote`** paths (recursive; skip `_README.md`).
9. **Update `01-Projects/_README.md`** on live vault:
   - Preserve existing **contract frontmatter** (`purpose`, `schema_required`, `allowed_pake_types`, `naming_convention`).
   - Add **`## WorkflowNote index`** (or equivalent) with **`[[title]]`** wikilinks for **every WorkflowNote** under `01-Projects/` (group by project subfolder optional).
   - Use governed write path: **`vaultCreateNoteFromMarkdown`** pipeline with explicit path **or** Vault IO update tool that overwrites body — **not** naive `vault_create_note` with `pake_type` only (routes to wrong folder). See Story **35-3** AC2.
10. **Update `02-Areas/_README.md`** — same pattern for all **`02-Areas/`** WorkflowNotes.
11. **Spot-check:** At least **3** former orphan paths now have incoming edge from hub (`vault_read` + lint logic).
12. **Post-run lint:** Operator runs **`/vault-lint`**; **Rule 2 orphan WARNING count drops materially** (evidence records before/after; target: clear **01-Projects/** and **02-Areas/** orphans listed in baseline report — vault-wide **40** may not reach zero if orphans remain in `03-Resources/`).
13. **Evidence:** Extend **`epic-36-stale-pending-verify-evidence.md`** or add **`epic-36-projects-areas-hub-evidence.md`** with before/after Rule 2 counts, wikilink counts, sample paths.
14. **Repo:** Evidence files in `_bmad-output/` only unless mirroring hubs into **`Knowledge-Vault-ACTIVE/`** fixture (optional).
15. **No repo code** required unless hub update uses new scripts (optional).

**Out of scope:** `03-Resources/` orphans (other stories), bulk body edits on individual notes, changing vault-lint rules, SynthesisNote queue outside 01/02.

## Stale pending queue — 01-Projects + 02-Areas (27 paths, vault-lint-2026-05-18)

| # | Path |
|---|------|
| 1 | `01-Projects/AI-Native-Infrastructure/V-1 Build of Ai Native Cross Device Build.md` |
| 2 | `01-Projects/AI-Native-Infrastructure/V-1 The Unified 2026 AI-Native Cross-Device Infrastructure Blueprint.md` |
| 3 | `01-Projects/Brain - Central Nervous System Build/001 Central Nervous System.md` |
| 4 | `01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md` |
| 5 | `01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md` |
| 6 | `01-Projects/Brain - Central Nervous System Build/Perplexity deep research.md` |
| 7 | `01-Projects/CNS-Phase-1/deferred-work.md` |
| 8 | `01-Projects/Lead-Gen-Directory-Sydney/Lead-Gen-Directory-Sydney.md` |
| 9 | `01-Projects/Linkedin/LinkedIn From Zero - The Complete Account Creation & Dual-Market Setup Guide.md` |
| 10 | `01-Projects/Linkedin/LinkedIn Profile Builder/01_Headline_Options.md` |
| 11 | `01-Projects/Linkedin/LinkedIn Profile Builder/02_About_Section_Full_Draft.md` |
| 12 | `01-Projects/Linkedin/LinkedIn Profile Builder/03_Experience_Entries_All_Roles.md` |
| 13 | `01-Projects/Linkedin/LinkedIn Profile Builder/04_Skills_List_Complete.md` |
| 14 | `01-Projects/Linkedin/LinkedIn Profile Builder/05_Education_Certifications_Featured.md` |
| 15 | `01-Projects/Linkedin/LinkedIn Profile Builder/06_Profile_Photo_Banner_Specs.md` |
| 16 | `01-Projects/Linkedin/LinkedIn Profile Builder/07_First_LinkedIn_Posts_3_Drafts.md` |
| 17 | `01-Projects/Linkedin/LinkedIn Profile Builder/08_Connection_Request_Templates.md` |
| 18 | `01-Projects/Linkedin/LinkedIn Profile Builder/09_Recruiter_Outreach_Templates.md` |
| 19 | `01-Projects/Linkedin/LinkedIn Profile Builder/10_Endorsement_Recommendation_Templates.md` |
| 20 | `01-Projects/Linkedin/LinkedIn Profile Builder/11_Commenting_Strategy_Daily_Engagement.md` |
| 21 | `01-Projects/Linkedin/Prompt - Research.md` |
| 22 | `01-Projects/Linkedin/SEEK - Australian Jobs.md` |
| 23 | `01-Projects/PROJECT_NEXUS DISCORD-OBSIDIAN BRIDGE.md` |
| 24 | `02-Areas/About Me/Career Path Brainstorming.md` |
| 25 | `02-Areas/About Me/Perplexity Feedback.md` |
| 26 | `02-Areas/About Me/The Man Himself.md` |
| 27 | `02-Areas/MASTER - iOS_Notes_Synthesis.md` |

**Note:** User brief cited **29** stale pending vault-wide; **27** are in 01/02 clusters. Part A scope is **only** the table above (not `03-Resources/`).

## Orphan baseline — 01-Projects + 02-Areas (Rule 2, same report)

Paths flagged as orphans (hub indexes should link these WorkflowNotes):

- `01-Projects/AI-Native-Infrastructure/Codex-Cursor-CNS-Integration-Plan.md`
- `01-Projects/AI-Native-Infrastructure/V-1 The Unified 2026 AI-Native Cross-Device Infrastructure Blueprint.md`
- `01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md`
- `01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md`
- `01-Projects/Brain - Central Nervous System Build/Perplexity deep research.md`
- `01-Projects/Brain - Central Nervous System Build/Session-Summary-Phase3-Day1.md`
- `01-Projects/CNS-Phase-1/cns-phase-1-complete.md`
- `01-Projects/CNS-Phase-1/deferred-work.md`
- `01-Projects/CV-For-Alex/Chris-Taylor-CV.md`
- `01-Projects/Foundation-First-Client/Foundation-First-Client-Master-Plan.md`
- `01-Projects/Linkedin/Prompt - Research.md`
- `01-Projects/Linkedin/SEEK Profile Setup Guide.md`
- `02-Areas/About Me/Perplexity Feedback.md`

(Plus any additional WorkflowNotes under 01/02 not listed — **index all WorkflowNotes**, not only current orphans.)

## Tasks / Subtasks

### Part A
- [ ] Confirm gateway + `vault-think` on `#hermes` (AC1)
- [ ] Process all 27 paths; write evidence artifact (AC2–5)
- [ ] `/vault-lint` post-run for Rule 3 (AC6)

### Part B
- [ ] Capture Rule 2 baseline (AC7)
- [ ] `vault_list` both trees (AC8)
- [ ] Update **`01-Projects/_README.md`** with wikilink index (AC9)
- [ ] Update **`02-Areas/_README.md`** with wikilink index (AC10)
- [ ] Spot-check incoming edges (AC11)
- [ ] `/vault-lint` post-run; record Rule 2 delta (AC12–13)
- [ ] Standing task: Operator guide — **optional** one line under vault structure if hubs become operator-facing; else "no update required"

## Dev Notes

### `/verify` recap (WorkflowNote vs SynthesisNote)

Same as **34-3** / **35-2**:

- **`/verify`** marking tokens apply to **`SynthesisNote`** in **`03-Resources/`** only.
- **All Part A paths are `WorkflowNote`** → use **`vault_update_frontmatter`** MCP (batch script acceptable if operator approves; Discord `/verify` optional for human review only).

### Hub update vs `vault_create_note`

MCP **`vault_create_note`** routes by **`pake_type`** only — cannot place `_README.md` contract manifests by path. Use:

1. **`vaultCreateNoteFromMarkdown`** (Node pipeline) with explicit **`03-Resources/`-style path** — for `_README.md` at `01-Projects/_README.md`, or
2. Governed full-file overwrite if Vault IO exposes it, or
3. Operator FS write to vault path **only** if WriteGate policy allows (prefer Vault IO mutator for audit trail).

Story **35-3** created **new** Research hub; this story **updates existing** manifests — read current body first, append index section, preserve contract YAML.

### Wikilink rules (Rule 2)

From **`specs/cns-vault-contract/modules/vault-lint.md`**:

- Prefer **`[[Exact Title]]`** from frontmatter.
- Path form **`[[01-Projects/.../file|Display]]`** when titles collide.
- `_README.md` is excluded from orphan **candidates** but **is** an edge **source**.

### Judgment guidance (stale pending)

Same as 34-3: stable project plans / handoffs → **`verified`**; abandoned drafts / superseded → **`disputed`**. Document rationale per row in evidence for disputed items.

### References

- [Source: `_bmad-output/implementation-artifacts/34-3-stale-pending-review-via-verify.md`]
- [Source: `_bmad-output/implementation-artifacts/35-3-orphan-wikilink-pass-research-index.md`]
- [Source: `_meta/reports/vault-lint-2026-05-18.md` on live vault]
- [Source: `Knowledge-Vault-ACTIVE/01-Projects/_README.md` — contract template]
- [Source: `Knowledge-Vault-ACTIVE/02-Areas/_README.md`]

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] Optional — note in Dev Agent Record if no update
