---
story_id: 35-3
epic: 35
title: orphan-wikilink-pass-research-index
status: ready-for-dev
---

# Story 35.3: Orphan wikilink pass — 03-Resources/Research index

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,  
I want a **`03-Resources/Research/_README.md` hub index** that wikilinks all Research **SourceNotes**,  
so that **orphan notes (no incoming wikilinks) in the Research cluster gain at least one incoming edge** and vault lint Rule 2 orphan counts drop after `/vault-lint`.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 35: Vault Curation + Housekeeping |
| **Phase** | 6 |
| **Lint source** | ~**60 orphan** WARNINGs vault-wide; **majority under `03-Resources/Research/`** (Rule 2) |
| **Predecessor** | **34-2** explicitly deferred Rule 2 orphans to Epic 35 |
| **Parent README** | `03-Resources/_README.md` **already exists** in vault fixture — **do not recreate** unless missing on live vault |
| **Evidence artifact** | `_bmad-output/implementation-artifacts/epic-35-orphan-research-index-evidence.md` |

**Mechanism:** Vault lint Rule 2 counts **incoming wikilinks** from any vault `.md` except `00-Inbox/` and `_meta/`. A directory hub `_README.md` with `[[Note Title]]` links to each SourceNote provides one incoming edge per linked note.

## Acceptance Criteria

1. **Inventory:** From latest **`/vault-lint`** (or `vault_list` + lint report), enumerate Research-cluster orphan candidates — target the set contributing to the **~60** vault-wide orphan WARNINGs (document count in evidence).
2. **`03-Resources/Research/_README.md` created** via **`vault_create_note`** (Vault IO MCP) on the **live vault** (`CNS_VAULT_ROOT`). Use **directory contract manifest** frontmatter per spec (not PAKE minimum template):

   ```yaml
   ---
   purpose: Hub index for Research SourceNotes and related reference material
   schema_required: true
   allowed_pake_types: SourceNote | InsightNote | SynthesisNote | ValidationNote
   naming_convention: Concept-scoped research filenames; see parent 03-Resources contract
   ---
   ```

3. **Body content:** `# Research` section with:
   - Brief “What goes here” (1–2 sentences, align with parent `03-Resources/_README.md`)
   - **Wikilink index** listing **all Research SourceNotes** (and optionally other PAKE types present in folder if they remain orphans) using `[[title from frontmatter]]` or `[[path|Display]]` — one link per orphan candidate note in cluster
   - Links must resolve per vault-lint edge rules (title match or path match)
4. **`03-Resources/_README.md`:** If missing on live vault, create with same contract template pattern; if present (expected), **skip creation** and note “already exists” in evidence.
5. **No duplicate hub:** If `03-Resources/Research/_README.md` already exists, **read first** — update via governed path only if WriteGate allows; prefer single create operation for new hub.
6. **Post-run lint:** Operator runs **`/vault-lint`**; **orphan WARNING count drops** materially (evidence records before/after Rule 2 counts; exact delta depends on how many Research orphans were linked).
7. **Evidence artifact** at **`_bmad-output/implementation-artifacts/epic-35-orphan-research-index-evidence.md`**: before/after orphan counts, path to hub note, count of wikilinks added, sample of linked paths, lint excerpt.
8. **Repo:** Evidence file only unless operator also mirrors hub into `Knowledge-Vault-ACTIVE/` fixture (optional; not required for AC).

**Out of scope:** Fixing orphans outside `03-Resources/Research/` (follow-up housekeeping), editing 60+ note bodies individually, `vault_move` bulk operations, changing vault-lint rules.

## Tasks / Subtasks

- [ ] Run **`/vault-lint`** (or read latest report); capture Rule 2 baseline counts. (AC1, AC7)
- [ ] `vault_list` **`03-Resources/Research/`** — collect SourceNotes (and orphan list from lint). (AC1)
- [ ] Confirm **`03-Resources/_README.md`** exists on live vault; create only if absent. (AC4)
- [ ] **`vault_create_note`** → `03-Resources/Research/_README.md` with contract frontmatter + wikilink index body. (AC2–3)
  - **Note:** `vault_create_note` routes by `pake_type` to `03-Resources/` root by default — if tool cannot place directly in `Research/` subfolder, create then **`vault_move`** to `03-Resources/Research/_README.md` per deferred-work pattern.
- [ ] Verify hub readable via `vault_read`; spot-check 3 orphan targets now have incoming edge from hub. (AC3)
- [ ] Re-run **`/vault-lint`**; record Rule 2 after metrics. (AC6)
- [ ] Write evidence artifact. (AC7)
- [ ] Standing task: Operator guide — **optional** one-line under vault structure if Research hub becomes operator-facing; otherwise note “no update required.”

## Dev Notes

### Directory contract template (normative)

From `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — `_README.md` uses `purpose`, `schema_required`, `allowed_pake_types`, `naming_convention` — **not** `pake_id` / `pake_type`.

`_README.md` files are **excluded** from orphan candidate nodes but **are** edge sources — links **from** the hub **to** notes count as incoming edges **on those notes**.

### vault_create_note placement caveat

From `deferred-work.md`: `vault_create_note` routes by `pake_type` only. For subdirectory placement:

1. Create contract manifest content with appropriate parameters, **or**
2. `vault_move` to `03-Resources/Research/_README.md` after creation

Confirm final path via `vault_read` / `vault_list`.

### Wikilink resolution (Rule 2)

- Prefer `[[Exact Title]]` matching `title` frontmatter (case-sensitive).
- For ambiguous titles, use `[[03-Resources/Research/note-slug|Display]]` path form.
- Do not link to `00-Inbox/` captures from hub.

### Hub body structure (suggested)

```markdown
# Research

## What goes here
Curated research SourceNotes, synthesis chains, and validation material for the Research cluster.

## SourceNote index
- [[First Note Title]]
- [[Second Note Title]]
…
```

Group optionally by tag or prefix if list exceeds ~40 lines (use `##` subsections).

### MCP tool schema

Read `mcps/.../vault_create_note.json` (or `specs/cns-vault-contract/CNS-Phase-1-Spec.md`) before call — use Context7 only if implementing code; this story is vault mutation via existing MCP.

### Verification

```bash
# After hub creation (operator / dev with MCP)
# vault_read 03-Resources/Research/_README.md
# /vault-lint in #hermes
```

### References

- [Source: `_bmad-output/implementation-artifacts/34-2-vault-lint-remediation-critical-issues.md` — Rule 2 deferred]
- [Source: `_bmad-output/implementation-artifacts/29-4-vault-lint-rules-spec-and-output-format.md` — Rule 2 edge rules]
- [Source: `specs/cns-vault-contract/modules/vault-lint.md` — orphan fix hint]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/_README.md` — parent contract]
- [Source: `deferred-work.md` — vault_create_note placement]

## Dev Agent Record

### Agent Model Used

(create-story)

### Completion Notes List

### File List

- `03-Resources/Research/_README.md` (live vault via MCP)
- `_bmad-output/implementation-artifacts/epic-35-orphan-research-index-evidence.md` (create on completion)
