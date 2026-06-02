---
story_id: 57-4
epic: 57
title: external-memory-provider-eval
status: done
story_type: research-spike
predecessors: 57-2, 57-3, 29-2, 26-4
repos: Omnipotent.md
---

# Story 57.4: External memory provider evaluation — Mem0 vs Honcho

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

Epic: **57** (Hermes `MEMORY.md` CNS State freshness — operator brief 2026-06-02)  
Tracked in sprint-status as: **`57-4-external-memory-provider-eval`**

## Story

As the **CNS operator**,  
I want **a structured decision document comparing external memory providers (Mem0, Honcho, Zep, LangMem, Convex custom) against Hermes constraints**,  
so that **we can decide whether to adopt SaaS memory, build on existing Convex, or defer until Epic 57 local memory improvements prove insufficient**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 57 — Hermes `MEMORY.md` freshness; stories 57-2/57-3 auto-update `## CNS State` within **2,200 UTF-8 byte** cap (`MEMORY_FILE_CHAR_LIMIT`) |
| **Gap** | Bounded `MEMORY.md` holds sprint telemetry, not cross-session operator preferences, project history, or accumulated learnings beyond one close cycle |
| **Hermes runtime** | Discord gateway on WSL2 Ubuntu 24.04; OpenRouter `claude-sonnet-4-5`; no VPS — compute local |
| **Constraint** | Any external provider: **HTTPS + API key**; operator does **not** want to operate self-hosted memory infra (Postgres/Qdrant/Redis) on WSL |
| **Deliverable** | Single markdown decision doc — **no implementation code** |
| **Output path** | `docs/research/57-4-external-memory-provider-eval.md` |

### Problem

Hermes native memory (`~/.hermes/memories/MEMORY.md`, `memory_char_limit: 2200`) plus session-close/vault-lint patches keep **CNS State** fresh but cannot store unbounded persistent context. Commercial memory layers (Mem0, Honcho, Zep) and a Convex-backed custom store are candidates. This spike produces an adoption recommendation aligned with vault privacy and WriteGate policy.

## Acceptance Criteria

### 1. Research document exists (AC: doc)

**Given** this story is executed  
**When** research completes  
**Then** `docs/research/57-4-external-memory-provider-eval.md` exists with sections:

- Executive Summary
- Candidate Profiles (one per provider)
- Integration Sketch
- Privacy Analysis
- Recommendation + Next Steps

**And** recommendation is exactly one of: `adopt Mem0`, `adopt Honcho`, `adopt Zep`, `build on Convex`, `defer`

### 2. Research questions answered (AC: RQ1–6)

**Then** all six research questions from the operator brief are answered with cited sources (vendor docs, Context7 Hermes/Mem0, repo artifacts):

1. Mem0 — API, pricing, data model, retrieval, SDK maturity, self-host option  
2. Honcho — same dimensions  
3. Alternatives — Zep, LangMem, Convex vector store  
4. Hermes integration — read/write injection points  
5. Privacy — vault content egress  
6. Recommendation with rationale  

### 3. Quality gate (AC: verify)

**Then** `bash scripts/verify.sh` passes (doc-only change must not break tests)

### 4. Commit (AC: commit)

**Then** commit message: `docs(research): 57-4 external memory provider evaluation`

## Tasks / Subtasks

- [x] **Task 1 — Vendor research** (AC: #2)  
  - [x] Mem0: platform + OSS paths, pricing tiers, Python/TS SDK, data model (`user_id`, messages → memories)  
  - [x] Honcho: peer/session model, token pricing, chat vs search APIs, SDK  
  - [x] Zep vs Graphiti, LangMem, Convex fit for CNS  

- [x] **Task 2 — Hermes + CNS integration sketch** (AC: #2, #4)  
  - [x] Map cold-start `MemoryStore` / `memory_char_limit` vs external retrieval injection  
  - [x] Map write paths: per-turn `memory` tool, `background_review`, `/session-close`  

- [x] **Task 3 — Privacy analysis** (AC: #2, #5)  
  - [x] Classify what may leave WSL if agent uses external memory tools on vault-adjacent content  

- [x] **Task 4 — Write decision doc** (AC: #1, #2, #6)  
  - [x] Executive summary + single recommendation  

- [x] **Task 5 — Verify and commit** (AC: #3, #4)  

## Dev Notes

### Hermes memory pipeline (read before writing doc)

| Stage | Mechanism | Source |
|-------|-----------|--------|
| Cold start | `memory_enabled` → `MemoryStore.load_from_disk()` → `MEMORY.md` truncated to `memory_char_limit` (2200) in system prompt | Hermes docs `/nousresearch/hermes-agent` — `memory.md`, `config.yaml` |
| Per-turn | Agent `memory` tool (`add` / `replace` / `delete`) | `tools-reference.md` |
| Post-turn | Optional `background_review` thread updates memory/skills | `background_review.py` |
| Session-close | `update-memory-cns-state.mjs` block-replaces `## CNS State` (57-2); vault-lint line patch (57-3) | `scripts/session-close/lib/` |
| Constitution | Vault `AI-Context/MEMORY.md` full overwrite Phase A (`steps.memory`) — distinct from Hermes path | Story 29-2 |

**Integration implication:** External memory is unlikely to hook *inside* `build_context_files_prompt()` without upstream Hermes changes. Pragmatic CNS integration: **MCP tools** (search before reply, add after close) or a thin **gateway wrapper** script — document both, mark gateway hook as higher effort.

### Convex existing role

- `cns-dashboard` Convex (`amiable-ox-862.convex.cloud`): dashboard snapshots, trends, notebook query logs — **not** agent episodic memory today.  
- "Build on Convex" means **new tables + vector index + session-close ingest** — significant epic, not a drop-in.

### Security / policy guardrails

- Do **not** route raw vault note bodies or `AGENTS.md` §8 through external memory without operator-approved data classification.  
- Align with deferred-work: *"Thin retrieval and Mem0 backlog items lack measurable acceptance gates"* — any future adoption story must define objective thresholds (retrieval latency, $/month cap, false-recall rate).  
- WriteGate: external memory must not become a bypass for governed `AI-Context/` writes.

### Out of scope

- Implementing Mem0/Honcho SDK in Hermes  
- Changing `MEMORY_FILE_CHAR_LIMIT` or AGENTS §6.5  
- Vault IO mutator changes  

### References

- [Source: `_bmad-output/implementation-artifacts/57-2-session-close-memory-md-auto-update.md`]
- [Source: `_bmad-output/implementation-artifacts/57-3-vault-lint-result-auto-memory.md`]
- [Source: `_bmad-output/implementation-artifacts/29-2-memory-md-schema-and-session-close-integration.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — Mem0 backlog gates]
- [Source: Hermes Context7 `/nousresearch/hermes-agent` — memory, prompt assembly]
- [Source: Mem0 Context7 `/mem0ai/mem0`]
- [Source: `docs/research/57-4-external-memory-provider-eval.md`] — normative output of this story

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Completion Notes List

- Research spike completed 2026-06-02; decision doc at `docs/research/57-4-external-memory-provider-eval.md`.
- Recommendation: **defer** commercial memory SaaS; future build path favors Convex episodic ingest if gates fail.

### File List

- `docs/research/57-4-external-memory-provider-eval.md` (create)
- `_bmad-output/implementation-artifacts/57-4-external-memory-provider-eval.md` (this file)

## Change Log

- 2026-06-02: Story 57-4 created — external memory provider research spike (Mem0 vs Honcho vs alternatives).
