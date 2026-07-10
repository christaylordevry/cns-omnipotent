---
pake_id: 28fd2cae-5a4c-4004-ab5d-327a66c4038d
pake_type: WorkflowNote
title: note-style-guide
created: 2026-04-03
modified: 2026-07-10
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

Status by location:
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
- Wikilinks on first concept mention per section (aggressive)
- Notes are launchpads (connected + actionable), not libraries — every note should connect outward

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
