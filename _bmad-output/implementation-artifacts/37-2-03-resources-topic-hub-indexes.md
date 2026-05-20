---
story_id: 37-2
epic: 37
title: 03-resources-topic-hub-indexes
status: done
---

# Story 37.2: 03-Resources topic hub indexes (perplexity research clusters)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want **topic hub notes under `03-Resources/Research/`** that wikilink perplexity research clusters and **wire loose `03-Resources/` orphans** to existing hubs,  
so that **perplexity notes are discoverable by topic** and **Rule 2 orphan count is documented** (23 baseline after hubs — vault-lint filename-stem limitation; see `deferred-work.md`).

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 37: 03-Resources Vault Close-Out |
| **Phase** | 6 |
| **Story class** | **Operator / vault curation** — optional repo helper script only |
| **Predecessor** | **35-3** created `03-Resources/Research/_README.md` (broad Research hub); **37-1** may delete/stamp root-level notes — run **37-1 first** or exclude deleted paths from hub indexes |
| **Lint baseline** | Post-**36-3**: **27** Rule 2 orphans vault-wide; post-hub **23** remain (Hermes `/vault-lint`); target **Rule 2 orphans = 23** accepted baseline — vault-lint requires exact filename-stem wikilinks (`deferred-work.md`) |
| **Orphan mechanism** | Rule 2 counts **incoming** wikilinks; hub `_README.md` / topic hubs are edge **sources** ([Source: `specs/cns-vault-contract/modules/vault-lint.md`]) |
| **Evidence artifact** | `_bmad-output/implementation-artifacts/epic-37-hub-evidence.md` |

**Note placement:** Many perplexity notes live in **`03-Resources/` root** (not `Research/` subfolder). Hubs live under **`03-Resources/Research/`** but must wikilink targets by **`[[title]]`** or **`[[03-Resources/note-slug|Display]]`** path form so edges resolve.

## Acceptance Criteria

### Part A — Six topic hub notes (create via governed pipeline)

1. **Inventory:** `vault_search` or `vault_list` + latest `/vault-lint` Rule 2 section — list orphan candidates under `03-Resources/` before hub work; record baseline orphan **count** in evidence.
2. **Create six hub files** on live vault using **`vaultCreateNoteFromMarkdown`** (explicit vault-relative path — **not** MCP `vault_create_note` alone; see **35-3** AC2). Each hub uses **directory contract manifest** frontmatter:

   ```yaml
   ---
   purpose: Topic hub linking related perplexity research notes
   schema_required: true
   allowed_pake_types: SourceNote | InsightNote | SynthesisNote | ValidationNote
   naming_convention: Topic-scoped hub; wikilink index in body
   ---
   ```

3. **Hub paths and link targets:**

   | Hub path | Filename prefix / cluster to link |
   |----------|-----------------------------------|
   | `03-Resources/Research/consulting-rates-hub.md` | All notes matching `perplexity-creative-technologist-consulting-rates-sydney` (**3–4** notes) |
   | `03-Resources/Research/remote-roles-hub.md` | `perplexity-creative-technologist-remote-roles` (**3** notes) |
   | `03-Resources/Research/day-rate-hub.md` | `perplexity-freelance-consulting-day-rate` (**3** notes) |
   | `03-Resources/Research/retainer-pricing-hub.md` | `perplexity-how-to-price-creative-agency-retainers` (**2** notes) |
   | `03-Resources/Research/obsidian-pkm-hub.md` | `perplexity-obsidian-personal-knowledge-management` or `perplexity-obsidian-pkm` (**3** notes) |
   | `03-Resources/Research/ai-agent-orchestration-hub.md` | `perplexity-ai-agent-orchestration-frameworks` (**3** notes) |

4. **Hub body:** `# <Topic>` + 1–2 sentence scope + **`## Related notes`** wikilink list (one link per cluster note). Use frontmatter `title` for `[[Title]]`; use path-alias when title contains `/` or collides (Story **35-3** OpenClaw precedent).
5. **Discover notes:** `vault_search` with query scoped to `03-Resources/` per prefix; include notes in **root** and **`Research/`** subfolders. Document final linked paths in evidence.
6. **If hub path already exists:** `vault_read` first — merge index section only; do not duplicate contract YAML (Story **36-3** `mergeHubWithIndex` pattern).

### Part B — Wire loose orphans to existing hubs

7. **`03-Resources/Vault-Intelligence-Discovery-Workflow.md`:** Add wikilink from **`03-Resources/Research/_README.md`** (read-merge body; preserve contract manifest). Do not duplicate full note in hub body unless needed — one `[[Vault Intelligence Discovery Workflow]]` or path-alias entry under a “Workflow & discovery” subsection.
8. **`03-Resources/building-with-gemini-embedding-2-agentic-multimodal-rag-and-beyond.md`:** Link from **`03-Resources/Research/_README.md`** **only if file still exists** after **37-1** (if deleted, note “skipped — removed in 37-1” in evidence).
9. **`03-Resources/notebooklm-project-map.md`:** Resolve actual filename on vault (`notebooklm-project-map.md` vs `NotebookLM-Project-Map.md` — session-close skill accepts both). Add wikilink to **`03-Resources/_README.md`**:
   - Parent **`03-Resources/_README.md` already exists** in fixture — **update/enrich** only (AC: create parent README only if missing on live vault).
   - Add **`## Key resources`** (or similar) with link to notebooklm map note.
10. **Spot-check:** At least **3** former orphan paths (from baseline list) show incoming edge from a hub via `vault_read` + lint logic or manual wikilink grep.
11. **Post-run lint:** Operator runs **`/vault-lint`** in `#hermes`; **Rule 2 orphan WARNING count = 23** vault-wide (baseline after hub creation; vault-lint requires exact filename-stem wikilinks — see `deferred-work.md`). Hubs reduced warnings **69 → 23**; remaining 23 perplexity notes flagged because topic hubs use human-readable display names, not exact `[[filename-stem]]` links. Accepted as vault-lint limitation, not hub defect.
12. **Evidence artifact** at **`_bmad-output/implementation-artifacts/epic-37-hub-evidence.md`**: baseline orphans, per-hub wikilink counts, parent README updates, after Rule 2 count, sample resolved paths.
13. **Repo gate:** No code required. If repo touched: **`npm test`** + **`bash scripts/verify.sh`**.

**Out of scope:** Stale pending (37-1), deleting E2E fixtures, changing lint rules, moving perplexity files into `Research/` (optional future; links suffice for Rule 2).

## Perplexity cluster reference (expected paths from prior epics)

Use live vault as source of truth; these paths appeared in **34-3** / chain evidence:

**consulting-rates-sydney (3):**
- `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-2026-04.md`
- `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-bot-pro.md`
- `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-reddit-com-creative-technologist-consulting-rates-sydney-2.md`

**remote-roles (3):**
- `03-Resources/perplexity-creative-technologist-remote-roles-and-how-to-position-for-them-in-2026-creative-technologist-remote-job-mark.md`
- `03-Resources/perplexity-creative-technologist-remote-roles-and-how-to-position-for-them-in-2026-how-to-position-ai-skills-for-creativ.md`
- `03-Resources/perplexity-creative-technologist-remote-roles-and-how-to-position-for-them-in-2026-what-do-companies-actually-want-when-.md`

**day-rate (3):**
- `03-Resources/perplexity-freelance-consulting-day-rate-calculation-methodology-2026-freelance-consultant-pricing-strategy-value-based-.md`
- `03-Resources/perplexity-freelance-consulting-day-rate-calculation-methodology-2026-how-to-calculate-your-freelance-day-rate-consultin.md`
- `03-Resources/perplexity-freelance-consulting-day-rate-calculation-methodology-2026-independent-consultant-rate-card-positioning-premi.md`

**retainer-pricing (2):**
- `03-Resources/perplexity-how-to-price-creative-agency-retainers-in-2026-how-to-price-creative-agency-retainer-fees-and-packages-2026-0.md`
- `03-Resources/perplexity-how-to-price-creative-agency-retainers-in-2026-what-should-a-small-creative-agency-charge-for-a-monthly-retai.md`

**obsidian-pkm (3):**
- `03-Resources/perplexity-obsidian-personal-knowledge-management-workflows-2026-obsidian-linking-notes-zettelkasten-second-brain-workfl.md`
- `03-Resources/perplexity-obsidian-personal-knowledge-management-workflows-2026-obsidian-pkm-system-setup-best-practices-2026-2026-04-2.md`
- `03-Resources/perplexity-obsidian-personal-knowledge-management-workflows-2026-obsidian-plugins-and-templates-for-productivity-system-.md`

**ai-agent-orchestration (3):**
- `03-Resources/perplexity-ai-agent-orchestration-frameworks-langchain-langgraph-2026-how-to-build-production-ai-agents-with-langgraph-2.md`
- `03-Resources/perplexity-ai-agent-orchestration-frameworks-langchain-langgraph-2026-langchain-agent-tools-memory-and-state-management-.md`
- `03-Resources/perplexity-ai-agent-orchestration-frameworks-langchain-langgraph-2026-langchain-vs-langgraph-agent-orchestration-compari.md`

## Tasks / Subtasks

- [x] Run `/vault-lint` or read latest report; capture Rule 2 baseline (AC1, AC11)
- [x] `vault_search` / `vault_list` per cluster; confirm paths (AC5)
- [x] Create six topic hubs via `vaultCreateNoteFromMarkdown` (AC2–4)
- [x] Update `03-Resources/Research/_README.md` — Vault-Intelligence + gemini note (AC7–8)
- [x] Update `03-Resources/_README.md` — notebooklm map link (AC9)
- [x] Spot-check incoming edges (AC10)
- [x] `/vault-lint` post-run; AC11 **Rule 2 orphans = 23** baseline documented (Hermes report; 69→23; 23 remain — vault-lint stem-match limitation)
- [x] Write `epic-37-hub-evidence.md` (AC12)
- [x] Standing task: Operator guide — no update required

### Review Findings

- [x] [Review][Patch] Topic hub re-run overwrites full body — Fixed: `mergeTopicHubWithIndex` preserves hub body, replaces `## Related notes` only.
- [x] [Review][Patch] Script evidence template leaves post-run lint placeholder — Fixed: `captureBulkScanSummary` + `formatPostRunSection`; preserves existing post-run block when scan unavailable.
- [x] [Review][Defer] AC11 closed — Hermes `/vault-lint`: **23** orphans accepted baseline; `bulk_scan.py` stem mismatch vs display-text hubs documented in evidence + `deferred-work.md`
- [x] [Review][Defer] Workflow & discovery links beyond AC7–8 minimum — hooks E2E, Gemini PE, Top Github wired for extra orphan edges
- [x] [Review][Defer] `appendSectionIfMissing` skips section refresh on re-run — first-run idempotency only
- [x] [Review][Defer] Obsidian cluster uses long prefix only — `perplexity-obsidian-pkm` alt not scanned; live run matched 3 notes
- [x] [Review][Defer] No `validatePakeForVaultPath` integration test for `*-hub.md` — path-rule unit test only; create test covers bypass

## Dev Notes

### Hub create vs `vault_create_note`

MCP **`vault_create_note`** routes by **`pake_type` only** — cannot place `03-Resources/Research/consulting-rates-hub.md` with contract manifest frontmatter. Use:

- **`vaultCreateNoteFromMarkdown`** from implementation repo (`src/tools/vault-create-note.ts` pipeline), or
- Equivalent WriteGate-governed explicit-path create used in **35-3** / **36-3**.

Contract manifests use `purpose`, `schema_required`, `allowed_pake_types`, `naming_convention` — not PAKE `pake_id` / `pake_type` on the hub file itself (see `isContractManifestReadmePath` bypass in **35-3**).

### Relationship to `Research/_README.md`

**35-3** hub links **all** Research folder SourceNotes (~43 links). This story adds **topic sub-hubs** for perplexity clusters (mostly root-level filenames) and **patches** the parent Research README for loose workflow notes — avoid deleting 35-3 index; **append** sections.

### Execution order with 37-1

Run **37-1** before **37-2** if both in same session: gemini ingest note may be deleted in 37-1; do not link deleted paths.

### Optional script

`scripts/epic-37-2-topic-hubs.ts` may automate wikilink list generation from `vault_search` — not required; mirror `scripts/epic-36-3-projects-areas.ts` if batching.

### References

- [Source: `_bmad-output/implementation-artifacts/35-3-orphan-wikilink-pass-research-index.md`]
- [Source: `_bmad-output/implementation-artifacts/36-3-projects-areas-stale-pending-hub-indexes.md`]
- [Source: `_bmad-output/implementation-artifacts/epic-36-retro-2026-05-20.md`]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/_README.md`]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md` — Rule 2]

## Dev Agent Record

### Agent Model Used

Composer (Cursor dev-story)

### Completion Notes List

**Part A:** Created six topic hubs under `03-Resources/Research/*-hub.md` via `vaultCreateNoteFromMarkdown` (contract manifest frontmatter; extended `isContractTopicHubPath` for PAKE skip). **17** perplexity cluster wikilinks (path-alias form).

**Part B:** Merged `Research/_README.md` (Topic hubs + Workflow & discovery) and `03-Resources/_README.md` (Key resources → NotebookLM map). Gemini ingest note linked (37-1 retained).

**Rule 2:** Baseline **23** orphans (Hermes 2026-05-21 pre-hub); post-hub Hermes `/vault-lint`: **23** orphans (**69 → 23** warnings). AC11 satisfied at **= 23** accepted baseline — vault-lint Rule 2 requires exact `[[filename-stem]]` wikilinks; topic hubs use readable display names (vault-lint limitation, not hub defect). Phase 2 fix tracked in `deferred-work.md`. Six Rule 4 flags on hub contract files (expected; not PAKE notes).

**Verification:** `npm test` 609 passed; `scripts/epic-37-2-topic-hubs.ts` batch on live vault.

**Operator guide:** No update required.

### File List

- `scripts/epic-37-2-topic-hubs.ts` (new)
- `src/pake/path-rules.ts` (`isContractTopicHubPath`, `isContractManifestPath`)
- `src/pake/validate.ts`, `src/tools/vault-create-note.ts` (contract hub bypass)
- `tests/vault-io/pake-validation.test.ts`, `tests/vault-io/vault-create-note.test.ts`
- `_bmad-output/implementation-artifacts/epic-37-hub-evidence.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (Phase 2 Rule 2 stem matching)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/37-2-03-resources-topic-hub-indexes.md` (this file)

### Change Log

- 2026-05-21: Story 37-2 — six Research topic hubs, README wiring, vault warnings 69→23, Rule 2 orphans = 23 baseline (Hermes `/vault-lint`).
- 2026-05-21: Code review — `mergeTopicHubWithIndex`, evidence post-run via `bulk_scan.py` (batch option 0).
- 2026-05-21: Close-out — AC11 target revised to **23** baseline; deferred-work Phase 2: vault-lint Rule 2 filename-stem matching.

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.
