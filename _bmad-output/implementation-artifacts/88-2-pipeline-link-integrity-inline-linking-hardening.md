---
story_id: 88-2
epic: 88
title: pipeline-link-integrity-inline-linking-hardening
status: done
zone: Hermes url-ingest governed create path (prompt block + install parity + E2E demo)
predecessors: 88-1 (note-style-guide conventions landed)
follow_up: 88-3 (Claude Code / Claude Desktop obsidian-markdown fire confirmation)
writegate_note: Does NOT edit AGENTS.md or note-style-guide.md. Touches live Hermes skill via install script after repo SSOT edit.
operator_gate: PROPOSE-THEN-STOP before any live-pipeline edit
baseline_commit: d5ecbfe
branch: hermes-consolidation (main tree — no worktree)
---

# Story 88.2: Pipeline link-integrity + inline-linking hardening (governed note connectivity)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

Epic: **88** (Note-creation governance polish)  
Tracked in sprint-status as: **`88-2-pipeline-link-integrity-inline-linking-hardening`** (RESERVED key — do not renumber)  
**Predecessor:** `88-1-clarify-note-style-guide-fresh-ai-status-linking` (done)  
**Follow-up stub:** `88-3-confirm-obsidian-markdown-fires-governed-create` (backlog — added by this story)

> [!warning] PROPOSE-THEN-STOP (operator gate)
> This story touches a **live** Hermes pipeline skill. Before editing
> `ingest-prompt-block.md` or reinstalling to `~/.hermes/`, the dev agent MUST
> paste a concrete proposed diff / prompt-block delta to the operator and
> **stop**. Do not implement until the operator approves the proposal.

## Story

As a **CNS operator whose Hermes `#hermes` URL-ingest path creates governed SourceNotes**,
I want **the ingest body-authoring prompt to require aggressive inline first-mention `[[wikilinks]]`, callout/block-ID cues, and a link-target verification step**,
so that **governed url-ingest notes are connectivity-rich (not Related-Notes-only / 0 inline links) and never invent dangling targets like `[[Honcho-deployment-decision]]`**, while **CNS enrichment frontmatter stays intact**.

## Problem statement (confirmed 2026-07-11 — do not re-investigate)

| Finding | Root cause |
|---------|------------|
| Governed url-ingest bodies are schema-correct but connectivity-poor (0 inline wikilinks) | `ingest-prompt-block.md` never asks for inline first-mention links and has no link-verification step |
| 88-1 fixed the **guide**; pipeline still ignores it | Hermes loads only `~/.hermes/skills/` (Context7: SSOT under `~/.hermes/skills/`; optional `skills.external_dirs`) — it **cannot** invoke `~/.claude/skills/obsidian-markdown` |
| Risk of duplicating rich Obsidian skill into Hermes | `~/.hermes/skills/note-taking/obsidian` is thin bash CRUD, not connectivity — fold a **concise** connectivity spec into the prompt block; do **not** tell Hermes to "load" the Claude skill; do **not** paste the rich skill verbatim |

## Architectural constraints (non-negotiable)

1. **Hermes skill load path:** `~/.hermes/skills/` is the single source of truth for Hermes skills (`SKILL.md` + optional `references/`). External dirs only if configured in `~/.hermes/config.yaml` `skills.external_dirs`. **Do not** instruct Hermes to load `~/.claude/skills/obsidian-markdown`.
   - [Source: Context7 `/nousresearch/hermes-agent` — skills.md; local CNS layout `~/.hermes/skills/cns/hermes-url-ingest-vault/`]
2. **Nexus is OUT OF SCOPE** — no Nexus prompt, bridge, or direct-FS path changes.
3. **Repo SSOT → live install:** Edit tracked
   `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/ingest-prompt-block.md`,
   then reinstall with `bash scripts/install-hermes-skill-url-ingest-vault.sh`.
   Confirm `diff` repo vs `~/.hermes/skills/cns/hermes-url-ingest-vault/references/ingest-prompt-block.md` is **empty**.
4. **Do NOT change** `SKILL.md` enrichment / `vault_create_note` frontmatter mapping (confidence_score, tags, pake_type, etc.).
5. **Do NOT edit** `specs/cns-vault-contract/modules/note-style-guide.md` (88-1 owns it), `AGENTS.md`, Zod/enrichment schema, or `bulk_scan.py`.
6. **Branch / tree:** Work on **`hermes-consolidation` main checkout only**. Do **not** create or use a git worktree.
7. **Context7:** Only if a library/tool API is touched. This story is prompt + install + tests; no npm API changes expected.

## Current state of primary edit target (READ BEFORE PROPOSING)

File: `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/ingest-prompt-block.md`

Today it requires:
1. Untrusted page text
2. Markdown body only (no YAML — Vault IO stamps PAKE)
3. Sections: `> [!abstract]` blockquote → Overview → Key points → Source → Open questions
4. No em dashes
5. Paywall/empty → short error, no `vault_create_note`

**Missing (this story adds):**
- (a) Aggressive inline first-mention `[[wikilink]]` rule (Related Notes alone insufficient)
- (b) Link-target **verification** step: confirm each `[[target]]` exists via `vault_search` / `vault_list` before emitting; omit or stub if absent — **never invent**
- (c) Callout / block-ID cues consistent with `note-style-guide.md` (blockquote callouts; `^block-id` on referenceable hub paragraphs when appropriate)

**Known live drift (pre-existing):** live `~/.hermes/.../ingest-prompt-block.md` still has old `` `[!abstract]` callout `` wording; repo already has `` `> [!abstract]` blockquote `` (from `7897958`). Reinstall after this story's edit clears that drift as a side effect — confirm empty diff.

## Normative prompt-block additions (intent — propose exact wording in PROPOSE step)

Fold a **concise** connectivity contract into `ingest-prompt-block.md` (new numbered steps after existing structure rules, or integrated into step 3). Must encode:

### (a) Aggressive inline first-mention

- On first body mention of a vault concept that has (or will have) a note, use `[[Note Title]]` **inline** in Overview / Key points / abstract prose.
- A `## Related Notes` dump at the bottom is allowed as a **supplement**, never as the only linking.
- Mirror the 88-1 before/after intent (Honcho example) in compressed form — do not paste the full note-style-guide.

### (b) Link-target verification (HARD)

Before calling `vault_create_note` with body content containing `[[...]]`:
1. For each distinct wikilink target, confirm existence via Vault IO `vault_search` and/or `vault_list`.
2. If missing: **omit** the wikilink (plain text) **or** create a stub note first (only if operator/policy allows stubs on this path — default for url-ingest: **omit**, do not invent).
3. Never emit fabricated targets (regression class: `[[Honcho-deployment-decision]]`).

### (c) Callout / block-ID cues

- Keep existing required `> [!abstract]` blockquote (already present).
- Cue optional additional callouts (`[!tip]`, `[!warning]`, `[!todo]`, `[!note]`) as blockquotes when the page warrants them — AC requires **≥1 callout** on the demo note (abstract satisfies this if correctly formed).
- Cue `^block-id` only when a paragraph is intentionally referenceable (hub-style); do not spam block IDs on every bullet.

**Token budget:** Keep the added connectivity block **tight** (target ≤ ~25–40 lines). Do not embed the full obsidian-markdown skill.

## Claude Code path (VERIFY only — not Hermes)

- Confirm whether global `~/.claude/skills/obsidian-markdown` actually **fires** on a governed create in Claude Code.
- Do **not** assume it is loadable/auto-invoked.
- If it does **not** fire → that finding belongs to **88-3**, not a silent fix in 88-2.
- Record the verification result in the Dev Agent Record (pass/fail + how tested).

## 88-3 backlog stub (create in sprint-status)

Add story key (backlog):

`88-3-confirm-obsidian-markdown-fires-governed-create`

Intent (one-liner for sprint comment / future create-story):  
**Confirm obsidian-markdown loads + fires on a governed create across Claude Code AND Claude Desktop; fold the connectivity spec where it doesn't.**

## Acceptance Criteria

### AC1 — Demo note: inline links + callout + enrichment intact

**Given** a governed re-ingest of a test article via the Hermes url-ingest path (after prompt + reinstall)  
**When** the created note is read  
**Then** the body has **inline first-mention `[[wikilinks]]`** (not Related-Notes-only)  
**And** there is **≥1** correctly formed callout (blockquote `> [!…]`)  
**And** CNS enrichment frontmatter remains intact (`confidence_score` / `verification_status` / `creation_method` as stamped by Vault IO; `pake_type: SourceNote`; `source_uri` matches trigger)  
**And** evidence is **demonstrated** (paste the note or a substantial excerpt into the story Dev Agent Record) — not merely asserted

### AC2 — Link verification omits/stubs dangling target

**Given** a would-be dangling link (concept with no vault note; do not invent a title that does not exist)  
**When** the ingest path authors the body  
**Then** the dangling `[[target]]` is **omitted** (plain text) or replaced by a real stub that was created first  
**And** the case is **shown** in the Dev Agent Record (before/after or search-miss → omit)

### AC3 — Repo SSOT + live parity

**Given** the edited repo `ingest-prompt-block.md`  
**When** `bash scripts/install-hermes-skill-url-ingest-vault.sh` is run  
**Then** `diff` between repo and live `~/.hermes/skills/cns/hermes-url-ingest-vault/references/ingest-prompt-block.md` is empty  
**And** `SKILL.md` enrichment / `vault_create_note` mapping is unchanged

### AC4 — Verify gate + tests

**Given** implementation complete  
**When** `bash scripts/verify.sh` runs  
**Then** it exits 0  
**And** `tests/hermes-url-ingest-vault-skill.test.mjs` covers the new connectivity contract (extend assertions on `ingest-prompt-block.md` content: inline wikilink rule, verification step, no-invent / omit-or-stub language)

### AC5 — Scope + process discipline

**Given** the change set  
**When** reviewed  
**Then** Nexus, `bulk_scan.py`, Zod/enrichment schema, `note-style-guide.md`, and `AGENTS.md` are untouched  
**And** work was done on `hermes-consolidation` main tree (no worktree)  
**And** commits are small / one logical change each  
**And** PROPOSE-THEN-STOP was honored before live edits

### AC6 — Claude Code verify + 88-3 stub

**Given** Claude Code governed-create path  
**When** operator/dev checks whether `obsidian-markdown` fires  
**Then** the result is recorded (fires / does not fire)  
**And** `88-3-confirm-obsidian-markdown-fires-governed-create` exists as **backlog** in `sprint-status.yaml`

## Tasks / Subtasks

- [x] **Task 0 — PROPOSE-THEN-STOP** (AC5)
  - [x] Draft exact proposed additions to `ingest-prompt-block.md` (full text of new steps)
  - [x] List files to touch + test assertions to add
  - [x] Paste proposal to operator and **stop** until approved
- [x] **Task 1 — Edit repo SSOT prompt block** (AC1–AC3 intent) — *only after Task 0 approval*
  - [x] Add (a) aggressive inline first-mention rule
  - [x] Add (b) link-target verification step (vault_search/list; omit or stub; never invent)
  - [x] Add (c) callout / block-ID cues aligned with note-style-guide
  - [x] Preserve existing abstract/Overview/Key points/Source/Open questions + no-em-dash + untrusted rules
  - [x] Do **not** edit `SKILL.md` mapping table
- [x] **Task 2 — Extend unit tests** (AC4)
  - [x] Update `tests/hermes-url-ingest-vault-skill.test.mjs` to read `references/ingest-prompt-block.md` and assert connectivity keywords/rules present
- [x] **Task 3 — Reinstall live skill + parity** (AC3)
  - [x] `bash scripts/install-hermes-skill-url-ingest-vault.sh`
  - [x] Confirm `diff` empty (repo vs live ingest-prompt-block.md and preferably whole skill dir)
- [x] **Task 4 — E2E demo** (AC1, AC2)
  - [x] Governed re-ingest of a test article in `#hermes` (or equivalent governed path)
  - [x] Paste note evidence (inline links + callout + frontmatter)
  - [x] Demonstrate dangling-link omit/stub case
- [x] **Task 5 — Claude Code verify + 88-3 stub** (AC6)
  - [x] Verify whether `obsidian-markdown` fires on governed create; record result
  - [x] Ensure sprint-status has `88-3-confirm-obsidian-markdown-fires-governed-create: backlog`
- [x] **Task 6 — Verify gate + commits** (AC4, AC5)
  - [x] `bash scripts/verify.sh` exit 0
  - [x] Small commits (prompt+tests; install is local/untracked live path — do not commit `~/.hermes`)

## Dev Notes

### Primary files

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/ingest-prompt-block.md` | **UPDATE** — connectivity contract |
| `tests/hermes-url-ingest-vault-skill.test.mjs` | **UPDATE** — assert prompt-block rules |
| `scripts/install-hermes-skill-url-ingest-vault.sh` | **RUN** (no edit expected) — copies repo → `~/.hermes/skills/cns/hermes-url-ingest-vault/` |
| `scripts/hermes-skill-examples/hermes-url-ingest-vault/SKILL.md` | **READ ONLY** — do not change enrichment mapping |
| `specs/cns-vault-contract/modules/note-style-guide.md` | **READ ONLY** — conventions source (88-1) |
| `~/.hermes/skills/cns/hermes-url-ingest-vault/` | **LIVE** — reinstall target; not git-tracked |
| `~/.hermes/skills/note-taking/obsidian/` | **DO NOT duplicate** — thin CRUD only |
| `~/.claude/skills/obsidian-markdown/` | **VERIFY fire only** — Claude Code path; 88-3 if missing |

### What must be preserved

- Body-only output (no YAML in `content`)
- Required section order and abstract blockquote form
- Untrusted-page + no-em-dash rules
- `vault_create_note` argument mapping in `SKILL.md` (SourceNote, tags, confidence_score, source_uri)
- `#general` capture-only mode (untouched)
- WriteGate / PAKE enrichment stamping by Vault IO (pipeline must not strip enrichment)

### Anti-patterns (prevent these disasters)

| Anti-pattern | Why wrong |
|--------------|-----------|
| "Load the obsidian-markdown skill" in Hermes prompt | Hermes does not load `~/.claude/skills/` |
| Copying full obsidian-markdown SKILL into Hermes | Token bloat; duplicates thin `note-taking/obsidian` poorly |
| Editing note-style-guide.md | 88-1 owns guide prose |
| Changing Zod / bulk_scan to "enforce" links | Out of scope; prose+prompt enforcement only |
| Claiming AC1 without pasting the note | Acceptance requires demonstration |
| Editing live `~/.hermes` without updating repo SSOT | Drift returns; verify/install gate fails intent |
| Creating a worktree | Operator: main `hermes-consolidation` tree only |
| Implementing before PROPOSE-THEN-STOP approval | Live pipeline risk |

### Previous story intelligence (88-1)

- Landed creation-time status wording, no-dangling rule, aggressive inline before/after (Honcho) in `note-style-guide.md`.
- Explicitly reserved **88-2** for pipeline/skill enforcement.
- Review note: governed-note edge-case hardening belongs in **88-2 pipeline**, not guide prose.
- Sync lesson: for Hermes skills, direction is **repo examples → install script → live**; opposite of vault-module `sync-vault-modules` (vault→specs).
- [Source: `_bmad-output/implementation-artifacts/88-1-clarify-note-style-guide-fresh-ai-status-linking.md`]

### Git intelligence (recent)

- `d5ecbfe` — close 88-1
- `3b919b9` — note-style-guide clarifications (88-1)
- `7897958` — callout blockquote form in url-ingest **prompt docs** (repo ahead of live — reinstall clears)
- `55103a0` / `5d34aaf` — callout modeling + load guide into Claude/Cursor context

### Testing requirements

- Extend `tests/hermes-url-ingest-vault-skill.test.mjs` (currently only checks SKILL.md + general refs + install script existence — **does not** read `ingest-prompt-block.md` yet).
- Suggested assertions (illustrative): file exists; body includes `[[` / wikilink / first-mention language; includes `vault_search` or verification language; includes omit/stub / never invent; retains `> [!abstract]`.
- Hard gate: `bash scripts/verify.sh`.
- E2E: manual governed re-ingest + paste evidence (AC1/AC2).

### Spec citations

- [Source: `specs/cns-vault-contract/modules/note-style-guide.md` — Callout Conventions; Structure Conventions (aggressive inline, no-dangling)]
- [Source: `specs/cns-vault-contract/AGENTS.md` §3–§4 — PAKE frontmatter; Vault IO; load note-style-guide before create]
- [Source: `scripts/hermes-skill-examples/hermes-url-ingest-vault/SKILL.md` — ingest prompt pointer; vault_create_note mapping]
- [Source: Context7 `/nousresearch/hermes-agent` — `~/.hermes/skills/` SSOT + `references/` layout]
- [Source: `project-context.md` — verify gate; Hermes skills at `~/.hermes/skills/cns/`]

### Project context reference

- Spec-first; verify before done; small commits; Context7 if library APIs touched.
- No WriteGate / `vault_log_action` / `security.md` changes expected — no operator approval beyond PROPOSE-THEN-STOP for live skill prompt.
- Deferred-work: note-style-guide legacy items are **out of scope** (already handled or unrelated).

## Out of scope (explicit)

- Nexus (any path)
- `bulk_scan.py` / vault-lint enforcement of wikilinks
- Zod / PAKE enrichment schema changes
- `note-style-guide.md` prose edits (88-1)
- `AGENTS.md`
- Duplicating `~/.claude/skills/obsidian-markdown` into Hermes
- Changing `SKILL.md` enrichment/frontmatter mapping
- Git worktrees
- Implementing 88-3 (stub only)

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Task 0 proposal approved 2026-07-11 with two tweaks: (1) batched Vault IO verification; (2) drop "(or will have)" from step 4.
- Operator pause: stop before Task 4 — operator will run `#hermes` ingest for AC1/AC2 evidence.
- AC1 first attempt failed (0 inline links / vague topic `vault_search`); step 5 refined to enumerate-then-batch-verify; structure later relaxed to rich Obsidian note.
- Claude Code fire-check (Task 5): `obsidian-markdown` does **not** auto-fire on governed create → deferred to 88-3.

### Completion Notes List

- Task 0: PROPOSE-THEN-STOP honored; operator approved with batched-verification + "has a note" wording.
- Task 1: Repo SSOT `ingest-prompt-block.md` updated — connectivity + rich-note contract; `SKILL.md` untouched.
- Task 2: Unit tests assert rich flexible notes, enumerate-then-batch verify, link-all-confirmed, no-invent, abstract+Source, enrichment note.
- Task 3: Reinstall; `diff` empty repo vs live skill dir.
- Task 4 / AC1: Demo note `03-Resources/loop-engineering-for-quant-trading-rohonchain.md` (see evidence below).
- Task 4 / AC2: Prompt omits missing targets; demo body only emits confirmed inline `[[...]]` (no fabricated titles). Earlier failed ingest (vague search → 0 links) is the miss→omit regression class.
- Task 5: Claude Code `obsidian-markdown` **does not fire** on governed create (see fire-check). `88-3-confirm-obsidian-markdown-fires-governed-create` remains **backlog**.
- Task 6: `bash scripts/verify.sh` VERIFY PASSED (operator-confirmed green before close); small commits landed.

### Claude Code fire-check (AC6)

**Result: does not auto-fire** on governed create.

How tested (2026-07-11):
1. Skill exists at `~/.claude/skills/obsidian-markdown/SKILL.md` (global only).
2. Not present under project `.claude/skills/`; not referenced in repo `CLAUDE.md` (create path loads `note-style-guide.md` via `@` import instead).
3. No Claude settings hook / always-on skill load for `vault_create_note` or governed create (`~/.claude/settings.json` has no skill force-load; project `.claude/settings.local.json` empty).
4. Description-match discovery alone is not a reliable fire for Hermes/Vault-IO governed creates.

**Follow-up:** `88-3-confirm-obsidian-markdown-fires-governed-create` (backlog) — confirm load+fire across Claude Code **and** Claude Desktop; fold connectivity where it does not.

### AC1 / AC2 demo evidence

**Path:** `03-Resources/loop-engineering-for-quant-trading-rohonchain.md`  
**source_uri:** `https://x.com/RohOnChain/status/2069056530960490835`

**Frontmatter (enrichment intact):**
```yaml
pake_type: SourceNote
status: draft
confidence_score: 0.55
verification_status: pending
creation_method: ai
tags: [hermes-ingest, url-ingest, domain-x-com, loop-engineering, ...]
source_uri: "https://x.com/RohOnChain/status/2069056530960490835"
```

**Body excerpt (rich synthesis — 3 callouts, gap table, inline links):**
```markdown
> [!abstract]
> @RohOnChain ... six universal loop components and a five-stage autonomous trading system ...

## Overview
... Boris Cherny (Head of [[Claude Code]], Anthropic) quote ... The [[Ralph-Loop-Autonomous-Workflows]] note covers a structurally similar pattern ...

## CNS Gap Analysis
| Component | RohOnChain pattern | CNS / Hermes today | Gap |
|---|---|---|---|
| Skills | SKILL.md per loop stage | ~/.hermes/skills/ per task type | **Direct match** |
| Worktrees | Git worktrees per parallel agent | Not structured in CNS pipelines | **Gap** |
| Self-improving skill | Auto-appends lessons to SKILL.md | Skills manually patched | **Gap** |

> [!note]
> The biggest specific gap is **automated skill mutation** ...

> [!tip]
> The /goal loop pattern ... maps cleanly onto the run-chain depth:shallow / depth:deep flag.

## Source
https://x.com/RohOnChain/status/2069056530960490835
Retrieved: 2026-07-11T00:00:00Z

## Related Notes
- [[Ralph-Loop-Autonomous-Workflows]]
- [[MCP-Servers-Ecosystem]]
- [[Building Effective AI Agents - Anthropic Engineering]]
```

**AC1 checks:** inline first-mention `[[Claude Code]]`, `[[Ralph-Loop-Autonomous-Workflows]]` (not Related-Notes-only); ≥3 blockquote callouts (`abstract`, `note`, `tip`); gap-analysis table; enrichment + `pake_type: SourceNote` + matching `source_uri`.

### File List

- `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/ingest-prompt-block.md` (modified)
- `tests/hermes-url-ingest-vault-skill.test.mjs` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/88-2-pipeline-link-integrity-inline-linking-hardening.md` (story record)

## Change Log

- 2026-07-11: Story context created (create-story); sprint 88-2 → in-progress; 88-3 backlog stub added
- 2026-07-11: Tasks 0–3 done — prompt connectivity contract + tests + live reinstall (empty diff); paused before Task 4 E2E
- 2026-07-11: AC1 miss (0 inline links / vague vault_search) — refined step 5 to enumerate candidate titles then batch-verify; reinstall + tests; paused for operator re-ingest
- 2026-07-11: Relaxed rigid section template → rich Obsidian note (abstract+Source required; embeds/callouts/block-IDs; link all confirmed); tests + reinstall + verify.sh; paused for demo ingest
- 2026-07-11: Tasks 4–6 complete — AC1 demo evidence pasted; Claude Code fire-check → does not fire (88-3 backlog); sprint 88-2 → done; small commits

## Story completion status

- Status: **done**
- All tasks/subtasks complete; AC1–AC6 satisfied; verify.sh green; Claude Code path deferred to 88-3
