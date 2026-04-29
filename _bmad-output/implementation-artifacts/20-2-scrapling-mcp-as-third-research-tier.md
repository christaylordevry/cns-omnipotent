# Story 20.2: Research Agent - Scrapling MCP as third research tier
#
Status: review

Epic: 20 (Research agent routing hardening)

## Story

As an **operator / dev agent**,  
I want the **Research Agent** to use **Scrapling's StealthyFetcher-powered MCP tools** as a **third research tier** (after Firecrawl + Apify),
so that we can retrieve content from **Cloudflare / bot-protected sites** with governed `SourceNote` ingestion into the vault research pipeline.

## Context / Baseline

Current Research Agent orchestration (baseline):
- `runResearchAgent()` runs **Firecrawl sweep** and **Apify sweep** and collects `notes_created[]` + `notes_skipped[]`
- Perplexity is handled after the sweeps (probe + optional ingest)
- All note creation must still happen via `runIngestPipeline()` (no direct vault writes)
- Adapter methods are injected; tests use deterministic mock adapters

Existing adapter contracts:
- Firecrawl adapter: `search()` + `scrape()`
- Apify adapter: injected adapter factory matches `src/adapters/apify-adapter.ts`:
  - `buildApifyAdapter(apiToken, recordServiceError) => { ragWebBrowser(query, opts): Promise<ApifyRagResult[]> }`

This story's change:
- Add a new **Scrapling tier** as an injected adapter
- Ensure Scrapling is invoked **after** Firecrawl + Apify (sequentially for tier ordering)

## Touch points (developer must read)

- `src/agents/research-agent.ts`
  - `runResearchAgent()` orchestration order
  - adapter type definitions + `researchSourceSchema` validation
  - ingest invariants (quality gate, skip reasons, duplicate handling)
- `src/adapters/apify-adapter.ts` (must match integration pattern)
- `src/adapters/scrapling-adapter.ts` (new Scrapling adapter, Apify-shaped factory)
- `tests/vault-io/research-agent.test.ts`
  - extend mock helpers + new AC coverage
- `scripts/run-chain.ts`
  - extend live smoke wiring to configure Scrapling adapter for real runs
- `src/agents/chain-smoke-evidence.ts` (only if service list / evidence needs updating)

## References

- Scrapling MCP server guide (tools + setup commands)
  - [Scrapling MCP Server Guide](https://scrapling.readthedocs.io/en/latest/ai/mcp-server/)
- Scrapling Stealthy fetching / StealthyFetcher
  - [Fetching dynamic websites with hard protections](https://scrapling.readthedocs.io/en/latest/fetching/stealthy.html)

## Acceptance Criteria

### A. Adapter contract + "Apify-shaped" integration (AC: adapter-shape)
1. Add a new injected `scrapling` adapter to `ResearchAgentAdapters`.
2. Create a new adapter factory in `src/adapters/` that follows the same integration pattern as Apify:
   - Export a `buildScraplingAdapter(...)` factory that returns an object with a single async method used by the research sweep.
   - Method signature must accept the same kind of `query` input used by other sweeps, and a `{ limit }`-style opts object (even if the adapter currently always returns <= 1 item).
   - Adapter failures must call `recordServiceError()` with a safe, truncated failure summary (no secrets).
3. Update `researchSourceSchema` / `CreatedNote` validation to accept `source: "scrapling"`.

### B. Orchestration order: "after Firecrawl + Apify" (AC: tier-order)
1. `runResearchAgent()` must execute:
   - Firecrawl sweep
   - Apify sweep
   - then Scrapling sweep (third tier)
2. Scraping/ingest effects from Scrapling must not occur until both Firecrawl + Apify promises have resolved/rejected per existing error-isolation behavior.

### C. Tier semantics: quality gate + ingest invariants (AC: ingest-invariants)
1. Scrapling sweep must enforce the same body quality gate behavior as other sweeps:
   - if fetched text is too short, skip with `reason: "quality_gate"`
2. Scrapling sweep must still create `SourceNote`s via `runIngestPipeline()` only.
3. Scrapling created notes must:
   - have `source: "scrapling"`
   - provide `source_uri` as the URL being scraped (or a deterministic synthetic URI if the adapter fails before URL resolution)
4. Audit semantics must remain unchanged:
   - `runResearchAgent()` emits exactly one sweep audit line (`action: "research_sweep"`, `tool: "research_agent"`) with the same payload shape as baseline.

### D. Tests (AC: tests)
1. Extend `tests/vault-io/research-agent.test.ts` with a Scrapling test block:
   - Verifies Scrapling adapter is invoked only after Firecrawl + Apify resolves (order check with mocks).
   - Verifies quality gate skip behavior for Scrapling short bodies.
   - Verifies adapter failure does not crash the overall sweep and results in `fetch_error` skips.
2. Ensure the full suite passes with `bash scripts/verify.sh`.

### E. MCP server setup for Claude Code + Cursor (AC: operator-setup)
This story also includes an operator runbook so Scrapling is available as an MCP tool in Claude Code and Cursor:
1. Operator must install Scrapling with MCP support:
   - `pip install "scrapling[ai]"`
   - `scrapling install`
2. Operator must register the MCP server in **Claude Code** using stdio:
   - `claude mcp add ScraplingServer "$(which scrapling)" mcp`
   - then completely quit + restart Claude Code.
3. Operator must register an equivalent MCP entry in **Cursor** `~/.cursor/mcp.json` for `ScraplingServer` using the local `scrapling` executable and args `["mcp"]`.
   Example shape (fill the absolute path from `which scrapling`):
   ```json
   {
     "mcpServers": {
       "ScraplingServer": {
         "command": "/ABSOLUTE/PATH/TO/scrapling",
         "args": ["mcp"]
       }
     }
   }
   ```
4. Operator must verify at least one live tool call succeeds (no secrets recorded), using Scrapling's `stealthy_fetch` on a public URL.

## Tasks / Subtasks

- [x] 1. Extend adapter types + validation
  - [x] Update `researchSourceSchema` to include `"scrapling"`.
  - [x] Add `ScraplingAdapter` + result types in `src/agents/research-agent.ts`.
  - [x] Add `scrapling?: ScraplingAdapter | undefined` to `ResearchAgentAdapters`.

- [x] 2. Implement Scrapling sweep orchestration
  - [x] Add `scraplingSweep(...)` alongside `firecrawlSweep()` and `apifySweep()`.
  - [x] Ensure it uses the same:
    - quality gate threshold
    - skip reason mapping (`quality_gate`, `fetch_error`, `duplicate`)
    - `runIngestPipeline()` invariants (`ingest_as: "SourceNote"`)
  - [x] Wire `scraplingSweep()` as a third tier in `runResearchAgent()`:
    - call after both Firecrawl + Apify sweeps complete

- [x] 3. Implement adapter factory (match Apify pattern)
  - [x] Create `src/adapters/scrapling-adapter.ts`:
    - export `buildScraplingAdapter(...)`
    - internal mechanism must use Stealthy fetching (via Scrapling MCP `stealthy_fetch` tool and/or direct StealthyFetcher usage), producing Markdown/text for ingest
    - transform Scrapling tool outputs into the `ScraplingRagResult[]` shape used by `scraplingSweep()`
    - on HTTP/tool failure: call `recordServiceError()` + throw an Error with a safe summary (mirroring Apify's error summarization pattern)

- [x] 4. Live smoke runner wiring
  - [x] Extend `scripts/run-chain.ts`:
    - configure Scrapling adapter (via local scrapling MCP server availability or other agreed runtime wiring)
    - add Scrapling to "Services configured: ..." output
    - pass `adapters.scrapling` into `runChain({ research: { adapters: ... } })`

- [x] 5. Tests
  - [x] Update `tests/vault-io/research-agent.test.ts`:
    - add `makeScrapling()` mock helper
    - add AC tests for tier order, quality gate, error isolation
  - [x] Ensure `bash scripts/verify.sh` passes.

- [x] 6. Operator runbook (Claude Code + Cursor)
  - [x] Ensure this story file's operator section is kept correct and complete:
    - install commands
    - `claude mcp add` command
    - Cursor `~/.cursor/mcp.json` entry shape
    - a concrete live verification step using `stealthy_fetch`.

## Dev Agent Record

### Agent Model Used

- Codex GPT-5

### Debug Log References

- `npm test` baseline before edits: passed.
- `bash scripts/verify.sh`: passed after implementation.

### Completion Notes List

- Added Scrapling as a third Research Agent source with `source: "scrapling"` validation.
- Added `scraplingSweep()` and sequenced `runResearchAgent()` as Firecrawl, then Apify, then Scrapling.
- Added `buildScraplingAdapter()` in `src/adapters/scrapling-adapter.ts` using the local Scrapling MCP server and `stealthy_fetch`.
- Wired Scrapling into the live chain smoke runner and compact evidence service list.
- Confirmed operator runbook covers both Claude Code `claude mcp add` and Cursor `~/.cursor/mcp.json`.

### File List

- `_bmad-output/implementation-artifacts/20-2-scrapling-mcp-as-third-research-tier.md`
- `scripts/run-chain.ts`
- `src/adapters/scrapling-adapter.ts`
- `src/agents/chain-smoke-evidence.ts`
- `src/agents/research-agent.ts`
- `tests/vault-io/research-agent.test.ts`

## Verify Gate

- Implementation must run: `bash scripts/verify.sh`
