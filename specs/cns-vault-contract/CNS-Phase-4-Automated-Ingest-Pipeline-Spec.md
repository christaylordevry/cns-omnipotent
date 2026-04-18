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

## 6. Open questions

1. **Trigger model:** On-demand only (IDE or CLI) versus scheduled pulls, and where the scheduler lives.
2. **Deduplication key:** URL, content hash, or `pake_id` lineage for re-ingest.
3. **Default `pake_type`:** SourceNote vs InsightNote vs ValidationNote for machine-ingested material.
4. **Inbox vs direct route:** Whether all automated captures land in `00-Inbox/` first for human triage.
5. **Cost and rate limits:** Per-account caps for Firecrawl, Perplexity, and Apify in operator policy.

## 7. Next implementation artifacts

1. Story: wire Tier 1 MCP env and document operator verification checklist (already partially reflected in AGENTS.md Section 8).
2. Story: minimal vertical slice (single URL to SourceNote via Vault IO) with tests in the CNS repo.
3. Story: expand to crawl and Apify Actor path with failure handling.

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-04-18 | Initial draft for Phase 4 session |
