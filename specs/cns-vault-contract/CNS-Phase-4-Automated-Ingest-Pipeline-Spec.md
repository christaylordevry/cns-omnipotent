---
pake_id: cns-phase4-ingest-spec-001
pake_type: WorkflowNote
title: "CNS Phase 4: Automated Ingest Pipeline (draft)"
status: draft
created: 2026-04-18
modified: 2026-04-18
tags:
  - cns
  - architecture
  - phase-4
  - ingestion
  - spec
---

# CNS Phase 4: Automated Ingest Pipeline (draft)

## 1. Purpose

Define an **automated ingest pipeline** that moves external research and web signals into the vault under PAKE rules, using **Vault IO** for governed writes and **Tier 1 MCP** (Firecrawl, Perplexity, Apify) for acquisition and enrichment. This document is the working spec; implementation stories will split work by stage.

## 2. Scope

**In scope**

- End-to-end flow from operator or agent trigger through normalized note material ready for `vault_create_note` or `vault_update_frontmatter`.
- Explicit handoff points between tools (no implicit side channels).
- Idempotency and deduplication strategy at the spec level (exact keys TBD in implementation).
- Failure modes: partial fetch, rate limits, PAKE validation rejections, boundary violations.

**Out of scope for this pipeline (until Tier 1 MCP is verified)**

- Multi-agent orchestration chains, scheduled daemons, or brand foundations that run ahead of MCP verification.
- Replacing NotebookLM ingestion; that remains a parallel path until consolidated.

## 3. Prerequisites

- Tier 1 MCP stack installed and **health-checked** in Claude Code (`claude mcp list`) and Cursor (`~/.cursor/mcp.json`): Firecrawl (`FIRECRAWL_API_KEY`), Perplexity (`PERPLEXITY_API_KEY` from [pplx.ai](https://pplx.ai), not Pro subscription), Apify (`https://mcp.apify.com` OAuth or Bearer token).
- Vault IO MCP available and `CNS_VAULT_ROOT` set when writes go through MCP.
- `AGENTS.md` v1.9.0 or later for routing rules (Perplexity, Firecrawl, Apify rows in Section 7).

## 4. Pipeline stages (conceptual)

| Stage | Role | Primary tools |
|-------|------|----------------|
| 1. Intent | Classify ingest goal (single URL, crawl, competitor scan, market question) | Agent + constitution routing |
| 2. Acquire | Fetch or search the web | Firecrawl (scrape, crawl, map, extract; Perplexity (real-time Q&A, search); Apify (Actors, RAG web browser, datasets) |
| 3. Normalize | Strip boilerplate, unify structure, attach provenance | Implementation-defined; must preserve `source_uri` and timestamps |
| 4. PAKE gate | Validate frontmatter, `pake_type`, routing target | Vault IO validators + Section 2 rules |
| 5. Write | Create or update notes | `vault_create_note`, `vault_update_frontmatter`, daily log when appropriate |
| 6. Audit | Append agent log | Vault IO audit trail per Section 4 |

Stages 2 and 3 may loop (e.g. Apify run then Firecrawl on result URLs) but each loop must be explicit in the story that implements it.

## 5. Routing alignment

- **Perplexity:** Use when the question requires current market data, competitor intelligence, real-time search results, or information that may have changed in the last 30 days (`AGENTS.md` Section 9).
- **Firecrawl:** Prefer for known URLs, crawl boundaries, and structured extraction when a page or site is the unit of work.
- **Apify:** Prefer when an Actor or store workflow already matches the source pattern (e.g. vertical scraper, dataset retrieval).

## 6. Open questions — resolved for Story 16-4

| # | Question | Decision |
|---|----------|----------|
| 1 | **Trigger model** | On-demand only. The pipeline is a callable TypeScript module invoked from CLI or tests. No scheduled daemon in Phase 4; that belongs to Phase 3 OpenClaw scope. |
| 2 | **Deduplication key** | `source_uri`. If a note with the same `source_uri` already exists in the vault (detectable via `vault_search`), the pipeline skips creation and returns a `DUPLICATE` result. Content hashes are out of scope here. |
| 3 | **Default `pake_type`** | `SourceNote` for raw URL captures and PDF imports (the capture is the primary asset). `InsightNote` when the caller explicitly signals that the note is a single-source analysis (via the `ingest_as` option). `SynthesisNote` requires explicit opt-in and is reserved for multi-source cross-references; it is not a pipeline default. |
| 4 | **Inbox vs direct route** | Two-phase: the pipeline always writes an intermediate `InboxEntry` note to `00-Inbox/` first (no PAKE validation required). After the PAKE gate passes, it promotes via `vault_create_note` to the governed destination and removes the inbox draft. This preserves the vault's "00-Inbox is a safe landing zone" contract. If PAKE validation fails, the inbox draft remains for human triage and the pipeline surfaces a structured error. |
| 5 | **Cost and rate limits** | Operator responsibility. The pipeline does not enforce API rate limits internally; callers are expected to apply back-pressure. Operator policy caps are documented in the MCP operator guide for each Tier 1 tool (Firecrawl, Perplexity, Apify). |

## 7. Master index

**Path:** `_meta/ingest-index.md`

Format: a Markdown table with one row per successful ingest. The pipeline appends a row; it does not rewrite the table. If the file does not exist, the pipeline creates it with a header row first.

```markdown
| date | pake_id | pake_type | title | source_uri | vault_path |
|------|---------|-----------|-------|-----------|------------|
| YYYY-MM-DD | uuid4 | SourceNote | "Title" | https://… | 03-Resources/slug.md |
```

Fields: `date` is the UTC date of ingest, `vault_path` is the vault-relative path where the governed note was committed. All pipe characters in field values are replaced with a space before appending (same sanitization rule as audit lines).

## 8. Wiki-ingest field mapping (AC: wiki-ingest)

The LLM Wikid `/wiki-ingest` pattern is a conceptual reference for structured web-to-note ingestion. The explicit PAKE field mapping is:

| Wikid field | PAKE frontmatter field | Notes |
|-------------|------------------------|-------|
| `url` | `source_uri` | Required for URL sources; omitted for raw text |
| `title` | `title` | Required; pipeline derives from page `<title>` or first `# heading` if absent |
| `summary` | `ai_summary` | Optional; populated when caller provides a pre-computed summary |
| `content` | Note body (after `---`) | Stripped of navigation chrome; preserves semantic structure |
| `type` = article/webpage | `pake_type: SourceNote` | Default for raw captures |
| `type` = analysis | `pake_type: InsightNote` | When caller sets `ingest_as: InsightNote` |
| `fetched_at` | `created` / `modified` | ISO date; both set to today on first creation |
| `tags` | `tags` | Caller-supplied; pipeline adds `ingest` tag automatically |
| — | `pake_id` | Generated by pipeline (UUID v4) |
| — | `status: draft` | Always `draft` on creation |
| — | `confidence_score: 0.5` | Default; callers may override |
| — | `verification_status: pending` | Always `pending` on creation |
| — | `creation_method: ai` | Always `ai` for pipeline-created notes |

**Non-flat mapping guarantee:** the pipeline maps into typed PAKE shapes, not a flat key-value dump. `pake_type` routing and frontmatter validation are enforced by the PAKE gate (Stage 4 of Section 4) before any governed write.

## 9. Next implementation artifacts

1. Story 16-1: wire Firecrawl MCP and document operator verification checklist (done).
2. Story 16-3: wire Apify MCP (done).
3. Story 16-4: implement pipeline module with tests in CNS repo (this story).

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-04-18 | Initial draft for Phase 4 session |
| 2026-04-18 | Resolved all open questions (sections 6-9); added master index spec (Section 7) and wiki-ingest mapping (Section 8) for Story 16-4 |
