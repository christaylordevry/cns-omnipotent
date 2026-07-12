---
pake_id: 28fd2cae-5a4c-4004-ab5d-327a66c4038d
pake_type: WorkflowNote
title: note-style-guide
created: 2026-04-03
modified: 2026-07-12
status: draft
tags:
  - vault-meta
  - style-guide
  - nexus
  - conventions
  - agents
---

# Note Style Guide

This module documents established conventions for this vault, reverse-engineered by Nexus across 141 notes in Phases 1-4. All agents must follow these patterns.

## Frontmatter Fields

Every note outside 00-Inbox requires:
- pake_type: (SourceNote | InsightNote | SynthesisNote | ValidationNote | WorkflowNote | HookSetNote | WeaponsCheckNote)
- pake_id: (UUID, generated on create)
- tags: (array)
- created: (YYYY-MM-DD)
- status: (draft | in-progress | reviewed | archived)
- modified: (YYYY-MM-DD, updated on every write)
- title: (optional but preferred)
- source_uri: (optional, for SourceNotes — URL or citation)

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

## Frontmatter — Prohibited Fields 
Do not add fields not listed above. The following are not part of this vault's schema and must never appear in note frontmatter: 
- certainty 
- status_reason

## Optional Quality Enrichment

The PAKE quality-enrichment tier (`confidence_score`, `verification_status`, `creation_method`) is optional on governed notes. Hermes Vault IO stamps defaults on governed creates; `/verify` may update `verification_status`; Nexus-shaped notes may omit these fields until triage via `vault_move` or `vault_update_frontmatter`. See AGENTS.md §3 for the canonical template.

## Callout Conventions

Callouts are **Obsidian blockquotes** — every line starts with `>`, including the `[!type]`
header line. They are NOT list items: `- [!tip]` renders as a plain bullet with literal
"[!tip]" text, not a callout. Correct form:

> [!tip] Optional inline title
> Body text of the callout.

Types and when to use each:
- `[!abstract]` — core thesis or summary at the top of research notes
- `[!tip]` — actionable insight or lesson
- `[!warning]` — risk, caveat, or thing to avoid
- `[!todo]` — next action or open question (checkbox items render inside the callout)
- `[!note]` — supporting context or elaboration

## Structure Conventions

- Related Notes section at the bottom of every substantial note
- Block IDs (^block-id) on referenceable paragraphs in hub notes
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
- Wikilink only to notes that exist: before writing a `[[link]]`, confirm the
  target note exists (vault search / list) or create a stub first; never invent
  links to notes that do not exist
- Notes are launchpads (connected + actionable), not libraries — every note should connect outward

## Rich Authoring

When creating or editing any governed note, author the body at full useful depth — not a thin outline. Let the content warrant the structure; do not impose a rigid section skeleton.

**Depth conventions:**
- Use multiple callouts where the content warrants them (`[!abstract]` for core thesis, `[!tip]` for insights, `[!warning]` for risks, `[!todo]` for open actions, `[!note]` for supporting context)
- Add block IDs (`^block-id`) on hub-style paragraphs that other notes should reference; do not spam IDs on every bullet
- Use embeds (`![[Note]]`, `![[Note#Heading]]`) only for vault targets that are confirmed to exist
- Standard Markdown depth is encouraged: tables, code blocks, footnotes when they improve the note

**Link-target verification (hard rule — before writing any `[[link]]`):**
1. **Enumerate first:** Build an explicit list of specific candidate note titles you intend to link (concrete names, e.g. `MCP-Servers-Ecosystem`, `ai-agent-orchestration-hub`). Do not treat a vague topic phrase as a candidate.
2. **Batch-verify those names** in as few vault IO calls as possible — prefer one `vault_list` or `vault_search` sweep over the candidate set. Fall back to per-target calls only if a single sweep cannot cover the full set.
3. Emit `[[title]]` for all candidates the sweep confirms exist. If a candidate is missing: omit the wikilink, use plain text. Do not invent titles. Do not create stubs unless the operator explicitly asks.
4. **Resolve on filename or alias, not `title`:** Obsidian resolves `[[wikilinks]]` against a note's filename (or an `aliases` entry), NOT its frontmatter `title`. When a note's `title` differs from its filename (e.g. `title: CNS Operator Guide` living in `CNS-Operator-Guide.md` with no alias), link the filename form, optionally piped for display: `[[CNS-Operator-Guide|CNS Operator Guide]]`. A spaced-title link to a hyphenated filename with no matching alias renders as a broken phantom link.

**Synthesis framing:** When the operator asks to relate source material to the existing system ("size this up to our system," "where do we land"), produce a genuine synthesis note — gap analysis, positioning verdict, actionable next steps — not a summary of the source.

## Daily Notes

Path: 00-Inbox/DailyNotes/YYYY-MM-DD.md
Status: draft
No PAKE frontmatter required (inbox exception)

## PAKE Type Guide

- SourceNote: external reference, article, paper, tool documentation
- InsightNote: your synthesis or observation derived from sources
- SynthesisNote: connects multiple concepts or sources into a unified view
- ValidationNote: test result, experiment outcome, proof of concept
- WorkflowNote: project task, plan, process, or operational note
- HookSetNote: run-chain hook agent output — four gated hook options with iteration trace
- WeaponsCheckNote: run-chain weapons-check output — novelty and copy-intensity rubric verdict
