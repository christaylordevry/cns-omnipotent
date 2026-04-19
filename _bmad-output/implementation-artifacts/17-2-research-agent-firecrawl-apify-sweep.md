# Story 17.2: Research Agent — Firecrawl + Apify sweep (Perplexity slot stubbed)

Status: done

Epic: 17 (Agency first product: content research agent chain)

## Story

As a **content strategist (operator)**,  
I want **a Research Agent that accepts a research brief and returns a sweep of sourced vault notes**,  
so that **downstream agents (Synthesis, Hook, Boss) work from governed, audited source material
rather than ephemeral tool outputs — and the sweep degrades gracefully when Perplexity is
unavailable**.

## References

- Ingest pipeline (prerequisite, done): `src/ingest/pipeline.ts` — `runIngestPipeline()`
- Ingest spec: `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md`
- PAKE schemas: `src/pake/schemas.ts` — `PAKE_TYPE_VALUES`, `InsightNote`, `SourceNote`
- AGENTS.md Tier 1 tool routing: `specs/cns-vault-contract/AGENTS.md` §7 (Firecrawl, Apify, Perplexity)
- Audit logger: `src/audit/audit-logger.ts` — `appendRecord()`
- Error types: `src/errors.ts` — `CnsError`
- MCP tool registry: `src/register-vault-io-tools.ts` (pattern reference)
- Epic 16 story 16-4 (ingest pattern): `_bmad-output/implementation-artifacts/16-4-automated-ingest-pipeline-inbox-classification-pake-index.md`

## Acceptance Criteria

1. **Brief ingestion (AC: brief)**  
   **Given** a `ResearchBrief` with `topic`, `queries[]` (1–10), `depth` (`shallow|standard|deep`), and optional `tags[]`  
   **When** the Research Agent runs  
   **Then** it validates the brief schema with Zod before executing any MCP calls  
   **And** an invalid brief fails fast with a typed error before any external I/O.

2. **Firecrawl sweep (AC: firecrawl)**  
   **Given** valid brief and Firecrawl MCP configured (`FIRECRAWL_API_KEY` present)  
   **When** the agent sweeps  
   **Then** it calls `firecrawl_search` for each query in `queries[]` (capped at 5 results per query)  
   **And** each result URL is scraped via `firecrawl_scrape` and fed to `runIngestPipeline()` as a URL source  
   **And** the agent catches and logs Firecrawl errors per-URL without aborting the whole sweep.

3. **Apify sweep (AC: apify)**  
   **Given** valid brief and Apify MCP configured (Apify token set)  
   **When** the agent sweeps  
   **Then** it calls the `apify/rag-web-browser` actor (actor ID `apify/rag-web-browser`) for each query  
   **And** each returned snippet + URL is fed to `runIngestPipeline()` as a URL or text source  
   **And** Apify errors are caught and logged per-query without aborting the sweep.

4. **Perplexity stub with graceful degradation (AC: perplexity-stub)**  
   **Given** Perplexity MCP may or may not be configured  
   **When** the agent sweeps  
   **Then** it calls a `PerplexitySlot` interface that checks for the `PERPLEXITY_API_KEY` env var  
   **And** if absent or slot returns a config error, the sweep continues with a `perplexity_skipped` flag in the result — no thrown error, no test failure  
   **And** the slot is structured so a future story can wire the real Perplexity MCP call in without changing the agent orchestrator.

5. **Vault notes via ingest pipeline (AC: vault-notes)**  
   **Given** scraped/fetched content from sweep sources  
   **When** each piece of content is ingested  
   **Then** it goes through `runIngestPipeline()` with `pake_type` `SourceNote` (raw web capture)  
   **And** the brief `topic` and `queries` are added to `tags` on each note  
   **And** the resulting `vault_path` from each ingest result is collected in the sweep manifest.

6. **Sweep manifest (AC: manifest)**  
   **Given** a completed sweep (partial or full)  
   **When** the agent finishes  
   **Then** it returns a `ResearchSweepResult` containing:  
   - `brief_topic`: string  
   - `notes_created`: `{ vault_path, pake_id, source_uri?, source: 'firecrawl'|'apify'|'perplexity' }[]`  
   - `notes_skipped`: `{ source_uri, reason: 'duplicate'|'validation_error'|'conflict'|'fetch_error' }[]`  
   - `perplexity_skipped`: boolean  
   - `sweep_timestamp`: ISO8601 string  
   **And** the manifest is not written to the vault by this story (writing reserved for story 17-6).

7. **Audit trail (AC: audit)**  
   **Given** a completed sweep (with or without created notes)  
   **When** the sweep completes  
   **Then** exactly one `appendRecord` call is made for the sweep as a whole (no per-query audit lines) with:  
   - `action: "research_sweep"`  
   - `tool: "research_agent"`  
   - `targetPath`: first created note path (or `"no-notes-created"` if sweep produced none)  
   - `payloadInput`: `{ topic, query_count, notes_created_count, perplexity_skipped }`  
   **And** individual per-note audit lines are NOT emitted (the ingest pipeline handles those via `suppressAudit: false` — do NOT pass `suppressAudit: true` on individual ingest calls for this agent).

8. **Tests (AC: tests)**  
   **Given** Firecrawl and Apify MCP calls are external network I/O  
   **When** tests run  
   **Then** all network MCP calls are mocked (no live HTTP in tests)  
   **And** tests cover: happy path (both sources), Firecrawl-only (Apify fails), Perplexity absent, duplicate URL suppression, all-fail sweep (no notes created; adapter failures surfaced in `notes_skipped`)  
   **And** `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Define `ResearchBrief` and `ResearchSweepResult` types with Zod schemas in `src/agents/research-agent.ts`
- [x] Implement `PerplexitySlot` interface in `src/agents/perplexity-slot.ts` — check env, return `{ available: boolean; search?: (q: string) => Promise<PerplexityResult> }`
- [x] Implement `firecrawlSweep(brief, vaultRoot)` — `firecrawl_search` per query + `firecrawl_scrape` per URL + runIngestPipeline
- [x] Implement `apifySweep(brief, vaultRoot)` — `apify/rag-web-browser` per query + runIngestPipeline
- [x] Wire orchestrator: `runResearchAgent(vaultRoot, brief)` → firecrawl + apify in parallel → perplexity slot → collect manifest → single audit record
- [x] Add `tests/vault-io/research-agent.test.ts` covering all 8 ACs
- [x] `bash scripts/verify.sh` green

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7) / Sonnet 4.6 (claude-sonnet-4-6)

### Debug Log References

- Initial test failures: duplicate filename collisions when mock adapters returned identical body content across queries. `normalizeUrl()` in the ingest pipeline derives title from body (not `title_hint`), so identical bodies produced identical target filenames and the second ingest hit EEXIST. Fix: varied mock content per query (`# Title ${query}` / `body for ${q}`) so each ingested SourceNote had a distinct derived title.
- Lint error on `_query` unused parameter (underscore-prefix convention not accepted by this project's ESLint config). Fixed by renaming to `query` and embedding a 40-char preview in the `CnsError` message.

### Completion Notes List

- All 8 acceptance criteria satisfied. 31 new research-agent tests; 379/379 tests green across the suite.
- `runResearchAgent(vaultRoot, brief, opts)` validates the brief with Zod, runs `firecrawlSweep` and `apifySweep` in parallel, probes the Perplexity slot, emits exactly one sweep-level `appendRecord` (action: `research_sweep`), and returns a `ResearchSweepResult` typed for downstream consumption by 17-3.
- Adapter injection pattern: `FirecrawlAdapter` (search + scrape) and `ApifyAdapter` (ragWebBrowser) are interfaces passed through `opts.adapters`. No live MCP calls in tests — mocks return deterministic content.
- Perplexity slot degrades gracefully: missing API key or stub throw is caught by `perplexityProbe`, which flips `perplexity_skipped: true` on the result without aborting the sweep.
- Depth profile: shallow=2 results/no scrape, standard=5 results/no scrape, deep=5 results + `firecrawl_scrape` each. Apify limit mirrors the same cap.
- All writes go through `runIngestPipeline()` with `ingest_as: "SourceNote"` and tags `[brief.topic, "research-sweep"|"apify-sweep", ...brief.tags]`. No direct `vaultCreateNote()` calls from the agent.
- Per-URL/per-query errors caught locally — one fetch failure or actor crash does not abort the wider sweep. `notes_skipped` records the URL and reason (`duplicate`/`conflict`/`validation_error`/`fetch_error`).

### File List

- `src/agents/research-agent.ts` (new)
- `src/agents/perplexity-slot.ts` (new)
- `tests/vault-io/research-agent.test.ts` (new, 31 tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — epic-17 block added, 17-2 → review)
- `_bmad-output/implementation-artifacts/17-2-research-agent-firecrawl-apify-sweep.md` (modified — tasks checked, Dev Agent Record filled, status → review)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-18 | Story file created (ready-for-dev) |
| 2026-04-18 | Implementation complete — 31 tests, verify gate green; status → review |
| 2026-04-18 | Code review closure: query tags + `researchSweepResultSchema` + adapter-failure synthetic skips; AC7 clarified; verify green; status → done |

### Review Findings

_Focus areas: `ResearchSweepResult` / 17-3 handoff, per-URL error isolation, Perplexity slot degradation, audit accuracy. BMAD code review, 2026-04-18. **Closed 2026-04-18** — patches applied; AC7 decision recorded._

#### `decision-needed`

- [x] [Review][Decision] AC7 wording vs zero-note sweep audit — **Resolved:** Always emit exactly one sweep-level `appendRecord` with `action: "research_sweep"` (no per-query audit lines). Use `targetPath: "no-notes-created"` when no notes were ingested. AC7 text updated above to match.

#### `patch`

- [x] [Review][Patch] AC5 — `queries[]` on ingest tags — **Fixed:** `sweepBaseTags()` adds `...brief.queries` before the sweep label in `src/agents/research-agent.ts`.

- [x] [Review][Patch] Zod for `ResearchSweepResult` — **Fixed:** Exported `researchSweepResultSchema`, `createdNoteSchema`, `skippedNoteSchema`, `researchSourceSchema`, `skipReasonSchema`; `runResearchAgent` returns `researchSweepResultSchema.parse(...)`. Story 17-3 can `researchSweepResultSchema.safeParse(unknown)`.

- [x] [Review][Patch] Query-level adapter throws visible in manifest — **Fixed:** Synthetic `source_uri` values `firecrawlQueryAdapterFailureUri` / `apifyQueryAdapterFailureUri` with `reason: "fetch_error"` when `search` / `ragWebBrowser` throws.

- [x] [Review][Defer] Sweep audit payload truncation for very long `topic` — **Deferred:** optional follow-up in `audit-logger` or caller-side topic cap for log summary only; not blocking.

#### `defer`

- [x] [Review][Defer] AC2 “scrape each URL” vs depth modes [`src/agents/research-agent.ts:124-131`](../../src/agents/research-agent.ts) — deferred, pre-existing: shallow/standard use search snippets; deep uses `scrape`. Matches this story’s Implementation Guide depth table; AC2 bullet text is tighter than the guide.

- [x] [Review][Defer] `perplexity_skipped === false` does not imply Perplexity-sourced notes [`src/agents/research-agent.ts:240-247`](../../src/agents/research-agent.ts) — deferred; flag reflects probe success only. Downstream 17-3 should not assume `source: "perplexity"` entries exist when the flag is false; document in synthesis handoff.

- [x] [Review][Defer] Apify text-only path and empty `source_uri` in skips [`src/agents/research-agent.ts:199-232`](../../src/agents/research-agent.ts) — deferred; `sourceUriForSkip` can be `""` for text inputs on non-duplicate failures. Consumers should treat `source_uri` as optional in practice despite the type being `string`.

---

## Developer Context — Implementation Guide

### What Already Exists (DO NOT reinvent)

| Module | Path | Relevant exports |
|--------|------|-----------------|
| Ingest pipeline | `src/ingest/pipeline.ts` | `runIngestPipeline(vaultRoot, input, opts)` → `IngestResult` |
| Classify | `src/ingest/classify.ts` | `classifySource(input)` → `SourceType`, `resolvePakeType()` |
| PAKE schemas | `src/pake/schemas.ts` | `PAKE_TYPE_VALUES`, `PakeType` — use `SourceNote` for web captures |
| Audit logger | `src/audit/audit-logger.ts` | `appendRecord(vaultRoot, opts)` |
| Error types | `src/errors.ts` | `CnsError(code, message)` — codes: `IO_ERROR`, `UNSUPPORTED`, etc. |
| Vault paths | `src/paths.ts` | `resolveVaultPath(vaultRoot, rel)` |
| Vault create note | `src/tools/vault-create-note.ts` | `vaultCreateNote()` — called internally by ingest pipeline |

**Key constraint:** NEVER call `vaultCreateNote()` directly from the agent. All writes go through `runIngestPipeline()`, which handles WriteGate, PAKE, dedup, index, and audit in the correct order.

### New File Locations

```
src/
  agents/
    research-agent.ts   ← main orchestrator + types
    perplexity-slot.ts  ← Perplexity interface (stub only in this story)
tests/
  vault-io/
    research-agent.test.ts
```

No new `src/tools/` file is needed for this story — the agent is not a new MCP tool, it's an internal orchestration module called by downstream agents and tests.

### Ingest Pipeline Call Pattern

```typescript
// Example — Firecrawl URL result → ingest
const result = await runIngestPipeline(vaultRoot, {
  input: url,                       // classified as "url" automatically
  fetched_content: scrapedMarkdown, // required for URL sources (no live HTTP in pipeline)
  title_hint: pageTitle,            // optional
  ingest_as: "SourceNote",          // web capture = SourceNote
  tags: [brief.topic, "research-sweep", ...brief.tags ?? []],
  ai_summary: undefined,            // summary is story 17-3's job
}, { surface: "research-agent" });
```

`fetched_content` is **required** for URL sources — the ingest pipeline does not make HTTP requests. The agent must pass the scraped body from Firecrawl.

### Ingest Result Handling

```typescript
if (result.status === "ok") {
  notes_created.push({ vault_path: result.vault_path, pake_id: result.pake_id, source_uri: url, source: 'firecrawl' });
} else if (result.status === "duplicate") {
  notes_skipped.push({ source_uri: url, reason: "duplicate" });
} else if (result.status === "conflict") {
  notes_skipped.push({ source_uri: url, reason: "conflict" });
} else {
  notes_skipped.push({ source_uri: url, reason: "validation_error" });
}
```

### Firecrawl MCP Adapter Pattern

The Firecrawl MCP is an external MCP server — not a TypeScript import. In tests, inject a mock adapter:

```typescript
// src/agents/research-agent.ts
export type FirecrawlAdapter = {
  search(query: string, opts: { limit: number }): Promise<FirecrawlSearchResult[]>;
  scrape(url: string): Promise<{ markdown: string; title?: string }>;
};

// Default adapter for production — calls MCP via dynamic import or configured bridge
export const defaultFirecrawlAdapter: FirecrawlAdapter = { ... };
```

Tests inject a fake adapter — no live MCP call in `npm test`. This is the same injection pattern used in the routing module (`src/routing/adapters/`).

### Apify MCP Adapter Pattern

Same injection pattern:

```typescript
export type ApifyAdapter = {
  ragWebBrowser(query: string): Promise<ApifyRagResult[]>;
};
```

The Apify `rag-web-browser` actor returns snippets with URLs. Feed each URL+snippet as a text source:

```typescript
await runIngestPipeline(vaultRoot, {
  input: snippet.url ?? snippet.text,
  fetched_content: snippet.text,
  source_type: snippet.url ? "url" : "text",
  ingest_as: "SourceNote",
  tags: [brief.topic, "apify-sweep", ...brief.tags ?? []],
}, { surface: "research-agent" });
```

### Perplexity Slot — Stub Implementation

```typescript
// src/agents/perplexity-slot.ts
export type PerplexityResult = { answer: string; citations: string[] };

export type PerplexitySlot = {
  available: boolean;
  search(query: string): Promise<PerplexityResult>;
};

export function createPerplexitySlot(): PerplexitySlot {
  const available = Boolean(process.env.PERPLEXITY_API_KEY);
  return {
    available,
    async search(_query: string): Promise<PerplexityResult> {
      if (!available) throw new CnsError("UNSUPPORTED", "Perplexity not configured — PERPLEXITY_API_KEY missing");
      // Story 17-1 will wire the real call here; stub for now
      throw new CnsError("UNSUPPORTED", "Perplexity MCP call not yet implemented (stub — 17-1 blocked on API key)");
    },
  };
}
```

The orchestrator catches the stub error and sets `perplexity_skipped: true` — it does NOT propagate.

### Sweep Parallelism

Run Firecrawl and Apify sweeps **in parallel** (`Promise.all`). Each sweep is internally sequential per query. Rationale: independent external sources; concurrency halves wall-clock time.

```typescript
const [firecrawlNotes, apifyNotes] = await Promise.all([
  firecrawlSweep(brief, vaultRoot, adapters.firecrawl),
  apifySweep(brief, vaultRoot, adapters.apify),
]);
```

Per-URL errors within a sweep are caught individually — one bad URL does not abort the sweep.

### Query Cap

`queries[]` max 10 items (Zod: `z.array(z.string()).min(1).max(10)`). Firecrawl search results per query: hard cap 5 (`limit: 5`). Apify: 1 actor call per query (returns up to 5 snippets per call).

Total max vault notes from a single sweep: `10 queries × 5 Firecrawl results + 10 queries × 5 Apify snippets = 100`. After dedup (same `source_uri`), typically much fewer.

### Audit Record

One audit record per sweep (after all notes are created):

```typescript
await appendRecord(vaultRoot, {
  action: "research_sweep",
  tool: "research_agent",
  surface: opts.surface ?? "research-agent",
  targetPath: notes_created[0]?.vault_path ?? "no-notes-created",
  payloadInput: {
    topic: brief.topic,
    query_count: brief.queries.length,
    notes_created_count: notes_created.length,
    perplexity_skipped,
  },
});
```

### Depth Parameter Semantics

| `depth`    | Firecrawl result limit | Apify max snippets/query |
|------------|----------------------|-------------------------|
| `shallow`  | 2 results/query      | 2 snippets/query         |
| `standard` | 5 results/query      | 5 snippets/query         |
| `deep`     | 5 results/query + scrape each | 5 snippets/query |

`deep` mode additionally calls `firecrawl_scrape` on each search result URL for full body extraction. `shallow` uses the search snippet directly as `fetched_content`.

### Test Structure Reference (from 16-4)

```typescript
// tests/vault-io/research-agent.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { runResearchAgent } from "../../src/agents/research-agent.js";
import type { FirecrawlAdapter, ApifyAdapter } from "../../src/agents/research-agent.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

// Each test gets a fresh fixture vault copy (pattern from ingest-pipeline.test.ts)
// Mock adapters return deterministic HTML/markdown strings
// Never call live MCP endpoints
```

Follow the exact fixture vault pattern from `tests/vault-io/ingest-pipeline.test.ts` — copy the minimal vault to a temp directory, pass it as `vaultRoot`.

### Downstream Contract (17-3 reads this output)

The `ResearchSweepResult.notes_created` array is the primary handoff to Story 17-3 (Synthesis Agent). It must include `vault_path` for each created note so 17-3 can call `vault_read()` on each. Do not change this type shape without coordinating with 17-3.

### TypeScript Conventions (match existing codebase)

- ESM (`"type": "module"` in package.json) — all imports use `.js` extension
- `kebab-case` file names, `PascalCase` types, `camelCase` functions
- Zod validation at public boundaries; internal functions trust their callers
- No `console.log` in production paths — use `appendRecord` or throw `CnsError`
- `async`/`await` throughout; no `.then()` chains

### Verify Gate

`bash scripts/verify.sh` must pass: `npm run lint`, `npm run typecheck`, `npm test` (all 348+ existing tests must still pass plus new research-agent tests).

### Anti-Patterns to Avoid

- ❌ Do NOT call `vaultCreateNote()` directly — use `runIngestPipeline()`
- ❌ Do NOT emit per-note audit lines from the agent — ingest pipeline handles those
- ❌ Do NOT make live HTTP calls in tests — inject mock adapters
- ❌ Do NOT throw on Perplexity absence — set `perplexity_skipped: true` and continue
- ❌ Do NOT scrape in `shallow` mode — use search snippet as `fetched_content` to save tokens
- ❌ Do NOT import from `src/tools/vault-create-note.ts` in agent code — it's inside WriteGate; go through the pipeline

### Previous Story Learnings (from 16-4 code review)

1. **Single audit line per operation** — ingest pipeline uses `suppressAudit: true` on `vaultCreateNote` and emits one line. Same pattern here: let per-note audit happen naturally inside `runIngestPipeline` (no `suppressAudit`) and add one sweep-level record after. (Note: this is the inverse of 16-4's choice; we want both the per-note ingest audit AND the sweep summary audit.)
2. **`source_uri` dedup** — `runIngestPipeline` calls `governedNoteExistsWithSourceUri` before writing. If the same URL was already ingested in a prior sweep, the pipeline returns `{ status: "duplicate" }`. Handle this gracefully in `notes_skipped`.
3. **`fetched_content` required for URLs** — normalizeInput throws `UNSUPPORTED` when URL source has missing/empty `fetched_content`. Firecrawl adapter MUST populate this field.
4. **WriteGate on inbox** — `assertWriteAllowed` runs on inbox drafts too. The ingest pipeline handles this; do not write directly to 00-Inbox from the agent.
5. **Conflict vs validation error** — EEXIST maps to `{ status: "conflict" }` in the pipeline. The agent must handle `conflict` in `notes_skipped` just like `validation_error`.
