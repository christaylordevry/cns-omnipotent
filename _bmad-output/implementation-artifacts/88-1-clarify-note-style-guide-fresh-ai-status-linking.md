---
story_id: 88-1
epic: 88
title: clarify-note-style-guide-fresh-ai-status-linking
status: review
zone: Omnipotent.md note-style-guide module (specs SSOT) + canonical vault AI-Context mirror
predecessors: 87-2, 87-3, callout-blockquote fix (55103a0 / vault 2924cc4)
related_deferred: deferred-work.md §note-style-guide (legacy keys — OUT OF SCOPE)
writegate_note: AI-Context/modules/ edit is operator-sanctioned deliberate resync (NOT session-close regen; NOT AGENTS.md)
operator_approved_status_wording: 2026-07-11
baseline_commit: 789795867501ff8d84108e3416ae48a1cf5bd070
---

# Story 88.1: Clarify note-style-guide — fresh-AI status, no-dangling-links, aggressive inline linking

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

Epic: **88** (Note-creation governance polish)  
Tracked in sprint-status as: **`88-1-clarify-note-style-guide-fresh-ai-status-linking`**  
**Follow-up (do not implement here):** `88-2-pipeline-link-integrity-inline-linking-hardening` (backlog — pipeline/enforcement hardening)

## Story

As a **CNS operator whose agents create governed notes under loaded governance**,
I want **`note-style-guide.md` to unambiguously define creation-time `status`, forbid invented wikilinks, and show a concrete aggressive-inline-link example**,
so that **fresh AI notes land as `draft`/`in-progress` with real inline links instead of location-stamped `reviewed` + Related-Notes-only dumps + dangling invented targets**.

## Problem statement (confirmed — do not re-investigate)

E2E production-path test (Claude Desktop, governance loaded) created a lint-clean note that still violated guide intent:

| Finding | Root cause in guide |
|---------|---------------------|
| Agent stamped `status: draft` in `03-Resources/` while summary claimed "reviewed" — OR agents stamp `reviewed` because location table says so | "Status by location: 03-Resources → reviewed" does not distinguish **creation-time** vs **post-triage** |
| Zero inline wikilinks in body; all links dumped in Related Notes | "Wikilinks on first concept mention per section (aggressive)" exists but has **no concrete example** — agents miss it |
| Invented dangling `[[Honcho-deployment-decision]]` (note does not exist) | Guide has **no** rule against linking to non-existent notes |

These are **semantic/prose** rules. `bulk_scan.py` does not enforce them — lint can stay Errors=0 while notes still violate intent. Fix the class in the guide; do not change the linter in this story.

## Operator-approved status wording (LOCKED — 2026-07-11)

**Replace** the current block:

```markdown
Status by location:
- 00-Inbox: draft
- 01-Projects: in-progress
- 03-Resources: reviewed
- Clippings: reviewed
- 04-Archive: archived
```

**With exactly:**

```markdown
Creation-time status reflects review state, not location. Governed
enrichment-carrying notes (those stamped with `verification_status`) enter as
`draft` (or `in-progress` when created under `01-Projects/`) and are promoted
to `reviewed` only after human or `/verify` review (which sets
`verification_status: verified`). Never auto-stamp `reviewed` on a note whose
`verification_status` is `pending`. Nexus-shaped sparse notes (which omit the
enrichment tier) follow the Nexus triage model and are out of scope for this
rule.

Target status by location (after triage / review — not the value stamped at
creation):
- 00-Inbox: draft
- 01-Projects: in-progress
- 03-Resources: reviewed
- Clippings: reviewed
- 04-Archive: archived
```

Do not paraphrase. Do not soften "Never auto-stamp".

## Normative edits (ONLY these three clarifications)

### 1. Status rule (Frontmatter Fields)

Apply the LOCKED replacement above. Leave the required-fields bullet list and Optional Quality Enrichment section unchanged.

### 2. No dangling links (Structure Conventions)

Add a bullet under `## Structure Conventions` (after or adjacent to the aggressive-wikilinks line):

```markdown
- Wikilink only to notes that exist: before writing a `[[link]]`, confirm the
  target note exists (vault search / list) or create a stub first; never invent
  links to notes that do not exist
```

### 3. Aggressive linking — concrete before/after (Structure Conventions)

Strengthen the existing line:

```markdown
- Wikilinks on first concept mention per section (aggressive)
```

to include an unmissable example. Use this exact pattern (or byte-equivalent):

```markdown
- Wikilinks on first concept mention per section (aggressive). Related Notes
  alone is not enough — first body mention must be an inline wikilink.

  Before (wrong — plain text + dump at bottom):
  Honcho is the dialectic memory provider.
  ## Related Notes
  - [[Honcho]]

  After (right — inline on first mention):
  [[Honcho]] is the dialectic memory provider.
  ## Related Notes
  - [[Honcho]]
```

Keep the other Structure bullets (Related Notes, block IDs, launchpads) unchanged.

## Sync / commit contract (CRITICAL — opposite of naive `sync-vault-modules`)

**SSOT for this story:** `specs/cns-vault-contract/modules/note-style-guide.md` (specs-first).

**Canonical vault mirror:** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/note-style-guide.md`

> [!warning] Do NOT run `npm run sync-vault-modules` after a specs-only edit
> That script is **vault → specs** (`sync-vault-modules.mjs`). Running it after
> editing specs **clobbers** the SSOT with stale vault content.
> [Source: HANDOFF-2026-07-10-session19-hermes-consolidation.md]

**Correct sequence:**

1. Edit specs SSOT (`specs/cns-vault-contract/modules/note-style-guide.md`)
2. Bump frontmatter `modified:` to today (`2026-07-11`)
3. Copy specs → canonical vault **byte-identical** (e.g. `cp` or equivalent; LF preserved)
4. Verify: `diff` between the two paths is empty
5. Verify: `bash scripts/verify.sh` passes (includes `vault-modules-parity`)
6. Confirm lint unchanged: `bulk_scan.py` still Errors=0 (no code change to scanner)
7. **Two commits:**
   - **Commit 1 (repo):** SSOT edit in Omnipotent.md only
   - **Commit 2 (vault):** mirror resync in Knowledge-Vault-ACTIVE, matching pattern of vault commit `2924cc4` (`docs(note-style): resync AI-Context mirror to note-style-guide SSOT …`)

**WriteGate note:** `AI-Context/` is WriteGate territory. This module resync is an **operator-sanctioned deliberate edit**, not a session-close regen, and **not** an `AGENTS.md` constitution edit. Do not touch `AGENTS.md`.

## Cursor rule mirror (small, same commit 1)

`.cursor/rules/note-style-guide.mdc` Structure Conventions must stay aligned with the module for the two linking clarifications (aggressive example + no-dangling). Status rule lives only in the full module (CLAUDE.md `@`-imports the SSOT). Do not invent a third status copy in the cursor rule unless already present.

## Out of scope (explicit)

- **88-2** — pipeline / skill / prompt enforcement of link-integrity and inline linking (reserved backlog)
- Changing `bulk_scan.py`, Zod schemas, Vault IO writers, or `/verify` behavior
- Reconciling deferred legacy `date`/`reference` keys (already closed in Lane B / deferred-work)
- Editing `AGENTS.md`, `CNS-Phase-1-Spec.md`, or other modules
- Unrelated prose polish in `note-style-guide.md`
- Running `npm run sync-vault-modules` as the sync path

## Acceptance Criteria

### AC1 — Status rule (operator-approved text)

**Given** `specs/cns-vault-contract/modules/note-style-guide.md`  
**When** the Frontmatter Fields status section is read  
**Then** it contains the LOCKED creation-time vs target-by-location wording verbatim  
**And** the old bare "Status by location:" header without the creation-time paragraph is gone  
**And** the location table still lists Inbox/Projects/Resources/Clippings/Archive targets unchanged

### AC2 — No dangling links

**Given** Structure Conventions  
**When** an agent reads the guide before creating a note  
**Then** there is an explicit rule: wikilink only to notes that exist (or create a stub first); never invent links

### AC3 — Aggressive linking example

**Given** Structure Conventions  
**When** the aggressive first-mention rule is read  
**Then** a concrete before/after example shows plain-text mention (wrong) vs inline `[[wikilink]]` on first body mention (right), with Related Notes still allowed as a supplement

### AC4 — Scope discipline

**Given** the module diff  
**When** reviewed  
**Then** only the three clarifications (plus `modified` date bump) changed — no unrelated edits

### AC5 — Byte-identical vault mirror

**Given** specs SSOT and canonical vault module path  
**When** `diff` is run  
**Then** the two files are byte-identical  
**And** `vault-modules-parity` / `bash scripts/verify.sh` pass

### AC6 — Lint behavior unchanged

**Given** no changes to `bulk_scan.py`  
**When** vault-lint bulk scan is run (or confirmed unchanged by diff)  
**Then** scanner behavior is identical; Errors=0 baseline preserved (these rules remain prose-only)

### AC7 — Two commits

**Given** implementation complete  
**When** commits are created  
**Then** commit 1 is repo SSOT (+ cursor rule sync if needed)  
**And** commit 2 is vault `AI-Context/modules/note-style-guide.md` resync only (message class like `2924cc4`)

## Tasks / Subtasks

- [x] **Task 1 — Specs SSOT edit** (AC1–AC4)
  - [x] Replace status block with LOCKED wording
  - [x] Add no-dangling-links bullet under Structure Conventions
  - [x] Expand aggressive-linking line with before/after example
  - [x] Bump `modified:` to `2026-07-11`
  - [x] Diff-review: only those changes
- [x] **Task 2 — Cursor rule Structure sync** (AC4)
  - [x] Update `.cursor/rules/note-style-guide.mdc` Structure Conventions to match linking clarifications
- [x] **Task 3 — Vault mirror resync** (AC5, AC7)
  - [x] Copy specs → `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/note-style-guide.md`
  - [x] `diff` empty between specs and vault
  - [x] Do **not** run `npm run sync-vault-modules`
- [x] **Task 4 — Verify gate** (AC5, AC6)
  - [x] `bash scripts/verify.sh` exit 0
  - [x] Confirm no `bulk_scan.py` diff
- [x] **Task 5 — Commits** (AC7)
  - [x] Commit 1: Omnipotent.md (specs + cursor rule)
  - [x] Commit 2: Knowledge-Vault-ACTIVE mirror only

### Review Findings

- [x] [Review][Decision][Dismissed] Repo commit scope exceeds AC7 contract — Operator accepted current commit scope as normal BMAD metadata.
- [x] [Review][Decision][Dismissed] Locked status wording leaves one governed-note edge case ambiguous — Operator chose to preserve the locked wording exactly. Revising to "missing `verification_status` = pending" is explicitly rejected because it would contradict the Nexus-shaped exemption; hardening this edge case belongs in 88-2 pipeline enforcement, not the guide.

## Dev Notes

### Current module state (read before edit)

File: `specs/cns-vault-contract/modules/note-style-guide.md` (85 lines today)

- Lines 32–37: bare "Status by location" table — **replace**
- Lines 64–69: Structure Conventions — **extend** (do not delete Related Notes / block IDs / launchpads)
- Lines 39–46: Prohibited fields + Optional Quality Enrichment — **do not touch** (87-3 contract)
- Callout Conventions (blockquote form) — **do not touch** (55103a0 / 2924cc4)

### What must be preserved

- PAKE required field list and status enum values (`draft | in-progress | reviewed | archived`)
- Prohibition of `certainty` / `status_reason`
- Optional quality enrichment paragraph (Hermes stamps; `/verify` updates `verification_status`)
- Callout blockquote modeling
- PAKE Type Guide and Daily Notes sections

### Sync direction cheat-sheet

| Intent | Command / action |
|--------|------------------|
| Specs-first module edit (this story) | Edit specs → `cp` to vault → `diff` empty → verify |
| Vault-first module edit (87-2/87-3 era) | Edit vault → `npm run sync-vault-modules` → verify |
| Wrong after specs edit | `npm run sync-vault-modules` (clobbers specs) |

### Previous story intelligence

- **87-2:** Established vault↔specs module parity gate; sync script is vault→specs only.
- **87-3:** Reclassified enrichment fields; edited note-style-guide via vault then sync. This story is the **inverse** direction (specs-first), matching session-19 Lane B / callout fix pattern.
- **55103a0 / vault 2924cc4:** Callout blockquote clarification — same two-commit / mirror-resync class as this story.

### Git intelligence (recent)

- `55103a0` — callouts are blockquotes; resync mirror
- `5d34aaf` — load note-style-guide into Claude Code + Cursor via `@` import / cursor rule
- `7897958` — prompt docs callout form (out of scope here)

### Testing requirements

- No new unit tests required (prose module only)
- Hard gates: `diff` empty (specs vs vault), `bash scripts/verify.sh`, no `bulk_scan.py` change
- Optional smoke: create a throwaway AI note under governance and confirm agent stamps `draft` + inline links (manual; not blocking if verify green)

### Project context reference

- Spec-first; verify before done; WriteGate for `AGENTS.md` (this story does not edit AGENTS)
- Module is `@`-imported in `CLAUDE.md` — SSOT edit propagates to Claude Code sessions automatically
- [Source: `project-context.md`, `CLAUDE.md` Note Style section, `specs/cns-vault-contract/modules/note-style-guide.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Specs-first edit; `cp` to canonical vault (did not run `npm run sync-vault-modules`)
- `diff` specs vs vault: empty
- `bash scripts/verify.sh`: exit 0
- No `bulk_scan.py` changes

### Completion Notes List

- Applied LOCKED creation-time vs target-by-location status wording verbatim
- Added no-dangling-links Structure bullet
- Expanded aggressive first-mention rule with Honcho before/after example
- Synced `.cursor/rules/note-style-guide.mdc` Structure Conventions (linking clarifications only; no status copy)
- Bumped module `modified:` to 2026-07-11
- Vault mirror byte-identical; verify gate green

### File List

- `specs/cns-vault-contract/modules/note-style-guide.md`
- `.cursor/rules/note-style-guide.mdc`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/88-1-clarify-note-style-guide-fresh-ai-status-linking.md`
- Canonical vault (commit 2): `AI-Context/modules/note-style-guide.md`

## Change Log

- 2026-07-11: Clarified note-style-guide creation-time status, no-dangling links, and aggressive inline linking example; resynced vault mirror

## Story completion status

- Status: **review**
- Ultimate context engine analysis completed — comprehensive developer guide created
- Operator status wording signed off 2026-07-11; Epic 88 created with 88-2 reserved backlog
- Implementation complete; verify.sh passed; ready for code-review
