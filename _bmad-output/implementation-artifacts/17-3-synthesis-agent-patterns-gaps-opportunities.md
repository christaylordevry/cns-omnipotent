# Story 17.3: Synthesis Agent — patterns, gaps, opportunities

Status: done

Epic: 17 (Agency first product: content research agent chain)

## Story

As a **content strategist (operator)**,
I want **a Synthesis Agent that consumes a `ResearchSweepResult` and distils patterns, gaps,
and opportunities into a single governed InsightNote (synthesis category)**,
so that **downstream agents (Hook, Boss) receive a compact, sourced thinking-tier artefact
rather than dozens of raw SourceNotes — and the synthesis itself is auditable and
reproducible**.

## References

- Research Agent output contract (prerequisite, done): `src/agents/research-agent.ts` — `ResearchSweepResult`, `researchSweepResultSchema`
- Ingest pipeline (prerequisite, done): `src/ingest/pipeline.ts` — `runIngestPipeline()`
- Ingest spec: `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md`
- PAKE schemas: `src/pake/schemas.ts` — `PAKE_TYPE_VALUES`, `InsightNote` (pipeline’s `ingest_as` only supports `SourceNote` | `InsightNote`; synthesis output is tagged `synthesis` and stored as `InsightNote`)
- Vault read tool: `src/tools/vault-read.ts` — `vaultReadFile()` (boundary-hardened canonical read)
- Frontmatter parse: `src/tools/vault-read-frontmatter.ts` — pattern reference (gray-matter parse)
- Audit logger: `src/audit/audit-logger.ts` — `appendRecord()`
- Error types: `src/errors.ts` — `CnsError`
- Previous story (pattern reference): `_bmad-output/implementation-artifacts/17-2-research-agent-firecrawl-apify-sweep.md`

## Acceptance Criteria

1. **Input validation (AC: input-validation)**
   **Given** a candidate `ResearchSweepResult`
   **When** `runSynthesisAgent(vaultRoot, sweep, opts)` is called
   **Then** the agent validates the sweep shape with `researchSweepResultSchema.safeParse()`
   **And** returns a typed `CnsError("SCHEMA_INVALID", ...)` on failure before any vault reads or LLM calls.

2. **Empty sweep short-circuit (AC: empty-sweep)**
   **Given** a valid sweep where `notes_created.length === 0`
   **When** the agent runs
   **Then** it returns a `SynthesisRunResult` with `status: "skipped"`, `reason: "no-source-notes"`, and no InsightNote is written
   **And** one audit record is emitted (`action: "synthesis_skipped"`) so the skip is traceable.

3. **Vault reads via injected adapter (AC: vault-reads)**
   **Given** a sweep with one or more `notes_created[]` entries
   **When** the agent runs
   **Then** it reads each `vault_path` via an injected `VaultReadAdapter.readNote()`
   **And** per-note read errors are caught — the path is collected in `sources_read_failed[]` and the sweep continues with remaining notes
   **And** if zero notes read successfully, the agent returns `status: "skipped"` with `reason: "no-readable-sources"` (no InsightNote written).

4. **Synthesis via injected adapter (AC: synthesis)**
   **Given** at least one source note read successfully
   **When** the agent runs
   **Then** it calls an injected `SynthesisAdapter.synthesize(input)` with `{ topic, queries, source_notes: [{ vault_path, body, frontmatter }] }`
   **And** the adapter returns `{ patterns: string[], gaps: string[], opportunities: string[], summary: string }`
   **And** the adapter result is validated with Zod (`synthesisAdapterOutputSchema`) before use — a malformed adapter response fails with `CnsError("SCHEMA_INVALID", ...)`.

5. **InsightNote via ingest pipeline (AC: insight-note)**
   **Given** a successful synthesis
   **When** the agent writes its output
   **Then** it calls `runIngestPipeline(vaultRoot, { input, source_type: "text", ingest_as: "InsightNote", fetched_content: body, title_hint, tags, ai_summary })`
   **And** the note body is structured markdown with `## Patterns`, `## Gaps`, `## Opportunities`, and a `## Sources` list that wikilinks each source `vault_path`
   **And** tags include `brief_topic`, `"synthesis"`, and `"research-sweep"` (plus sweep-derived topic tags)
   **And** `ai_summary` is the adapter’s `summary` field.

6. **Sweep result (AC: result)**
   **Given** a completed synthesis run
   **When** the agent finishes
   **Then** it returns a `SynthesisRunResult` containing either:
   - `{ status: "ok", insight_note: { vault_path, pake_id }, sources_used: string[], sources_read_failed: string[], synthesis_timestamp }`, OR
   - `{ status: "skipped", reason: "no-source-notes" | "no-readable-sources", synthesis_timestamp }`
   **And** the result type is exported for downstream 17-4 consumption.

7. **Audit trail (AC: audit)**
   **Given** a completed synthesis run (success or skip)
   **When** the agent finishes
   **Then** exactly one sweep-level `appendRecord` is emitted in addition to the per-note ingest record (which is emitted by the pipeline itself when the InsightNote is written):
   - success → `action: "synthesis_run"`, `targetPath: insight_note.vault_path`, `payloadInput: { topic, sources_used_count, sources_read_failed_count, insight_note_pake_id }`
   - skip → `action: "synthesis_skipped"`, `targetPath: "no-insight-note"`, `payloadInput: { topic, reason, sources_read_failed_count }`

8. **Tests (AC: tests)**
   **Given** vault reads and LLM synthesis are external concerns
   **When** tests run
   **Then** all `VaultReadAdapter` and `SynthesisAdapter` calls are mocked (no live fs reads outside fixture vault, no live LLM calls)
   **And** tests cover: happy path (3 notes → InsightNote), empty-sweep skip, all-reads-fail skip, partial read failure (some succeed some fail), malformed adapter output, invalid sweep input, audit records present for both success and skip cases
   **And** `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Define `SynthesisAdapter`, `VaultReadAdapter`, `SynthesisRunResult` types + Zod schemas in `src/agents/synthesis-agent.ts`
- [x] Implement default `VaultReadAdapter` backed by `vaultReadFile()` + `gray-matter` frontmatter parse
- [x] Implement `runSynthesisAgent(vaultRoot, sweep, opts)` — validate sweep → read sources → synthesise → ingest as InsightNote → audit
- [x] Render structured markdown body (Patterns / Gaps / Opportunities / Sources with wikilinks)
- [x] Emit single sweep-level audit record (`synthesis_run` on success, `synthesis_skipped` on no-op)
- [x] Add `tests/vault-io/synthesis-agent.test.ts` covering all 8 ACs with mock adapters
- [x] `bash scripts/verify.sh` green

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7)

### Debug Log References

- All 19 synthesis-agent tests passed on first run; no red-phase debugging required.
- Full verify gate green on first pass: 398/398 tests (379 pre-existing + 19 new), lint clean, typecheck clean, build clean.

### Completion Notes List

- All 8 acceptance criteria satisfied. 19 new synthesis-agent tests; 398/398 tests green across the suite (19 added to the 379 baseline from 17-2).
- `runSynthesisAgent(vaultRoot, sweep, opts)` validates the sweep shape via `researchSweepResultSchema.safeParse()` (throws `CnsError("SCHEMA_INVALID", …)` on malformed input), reads source notes through an injected `VaultReadAdapter`, calls an injected `SynthesisAdapter`, validates the adapter output with Zod, then writes exactly one `InsightNote` through `runIngestPipeline()` with `ingest_as: "InsightNote"` and tags `[brief_topic, "synthesis", "research-sweep"]`.
- Adapter injection mirrors 17-2: `VaultReadAdapter.readNote()` + `SynthesisAdapter.synthesize()` interfaces. Defaults: `createDefaultVaultReadAdapter(vaultRoot)` wraps `vaultReadFile` + `gray-matter`; `createDefaultSynthesisAdapter()` throws `CnsError("UNSUPPORTED", …)` so production callers must explicitly wire an LLM.
- Skip paths: `notes_created.length === 0` → `status: "skipped", reason: "no-source-notes"`; all reads fail → `status: "skipped", reason: "no-readable-sources"`. Each skip emits exactly one `synthesis_skipped` audit record and writes no vault note.
- Success path emits the pipeline's own `ingest` audit record (via `runIngestPipeline`) plus one sweep-level `synthesis_run` record — verified by the audit-counting test.
- Rendered body: `# Synthesis: {topic}` header, summary paragraph, then `## Patterns` / `## Gaps` / `## Opportunities` / `## Sources` sections. Empty sections render `- _none identified_` so downstream parsers see a predictable structure. Sources are Obsidian wikilinks to note basenames (`[[note-a]]`), annotated with `pake_id` when available.
- No live LLM calls in tests; no live MCP calls. All external I/O behind adapters. Fixture vault is used only for the default-adapter smoke test (AC: tests) where a real file + real `vaultReadFile` call is the point.

### File List

- `src/agents/synthesis-agent.ts` (new, ~260 lines)
- `tests/vault-io/synthesis-agent.test.ts` (new, 19 tests)
- `_bmad-output/implementation-artifacts/17-3-synthesis-agent-patterns-gaps-opportunities.md` (modified — tasks, Dev Agent Record, status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — epic-17 update, 17-3 → review, last_updated bumped)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-18 | Story file created (ready-for-dev) |
| 2026-04-18 | Implementation complete — 19 tests, verify gate green; status → review |

### Review Findings

_BMAD code review (2026-04-18). Focus: adapter Zod contract, skip-path audit, InsightNote frontmatter, wikilinks for 17-4. Review layers run inline in single session._

- [x] [Review][Patch] AC8 calls for a happy path with **three** source notes — **Fixed:** `validSweep()` now includes `note-c.md`; happy-path, adapter-input, partial-read, all-fail, result-shape, and InsightNote body expectations updated [`tests/vault-io/synthesis-agent.test.ts`](../../tests/vault-io/synthesis-agent.test.ts)

- [x] [Review][Defer] **Audit timestamp source split** — `synthesis_run` / `synthesis_skipped` pass `isoUtc: synthesis_timestamp` (run start), while the pipeline’s `ingest` line uses `appendRecord` without `isoUtc` (log time at write). Long runs can make bracket timestamps diverge from strict causal ordering; pre-existing pipeline pattern [`src/agents/synthesis-agent.ts`](../../src/agents/synthesis-agent.ts), [`src/ingest/pipeline.ts`](../../src/ingest/pipeline.ts) — deferred

- [x] [Review][Defer] **Wikilink basename collisions** — `wikilinkTarget()` uses `path.basename` only, so two different paths sharing the same stem (e.g. different folders) produce identical `[[stem]]` and ambiguous Obsidian resolution; accepted tradeoff per story “basename” guidance unless vault policy forbids duplicate stems [`src/agents/synthesis-agent.ts`](../../src/agents/synthesis-agent.ts) — deferred

- [x] [Review][Defer] **No runtime Zod for `SynthesisRunResult`** — TypeScript export is sufficient for compile-time 17-4 handoff; add `z.discriminatedUnion` (or similar) later if 17-4 ingests untyped JSON [`src/agents/synthesis-agent.ts`](../../src/agents/synthesis-agent.ts) — deferred

- [x] [Review][Defer] **AC5 `fetched_content` vs implementation** — AC text shows `fetched_content: body` for text ingest; code passes the full markdown as `input` only. For `source_type: "text"`, `normalizeInput` ignores `fetched_content` (see `normalizeText`), so behavior matches intent; align AC prose in a future doc pass — deferred as doc drift only

- [x] [Review][Defer] **`synthesisAdapterOutputSchema` strips unknown keys** — default Zod object behavior; malformed shapes still fail; extra keys silently dropped — deferred unless `.strict()` is desired for adapter debugging

---

## Developer Context — Implementation Guide

### What Already Exists (DO NOT reinvent)

| Module | Path | Relevant exports |
|--------|------|-----------------|
| Research Agent | `src/agents/research-agent.ts` | `ResearchSweepResult`, `researchSweepResultSchema` |
| Ingest pipeline | `src/ingest/pipeline.ts` | `runIngestPipeline(vaultRoot, input, opts)` → `IngestResult` |
| Vault read | `src/tools/vault-read.ts` | `vaultReadFile(vaultRoot, userPath)` |
| PAKE schemas | `src/pake/schemas.ts` | `PAKE_TYPE_VALUES`, `PakeType` — use `InsightNote` (pipeline-supported mapping for synthesis output) |
| Audit logger | `src/audit/audit-logger.ts` | `appendRecord()` |
| Error types | `src/errors.ts` | `CnsError(code, message)` — use `SCHEMA_INVALID` for validation failures |
| gray-matter | npm `gray-matter` (already in deps) | Parse frontmatter + body (pattern in `src/tools/vault-read-frontmatter.ts`) |

**Key constraint:** NEVER call `vaultCreateNote()` directly from the agent. All writes go through `runIngestPipeline()`, which handles WriteGate, PAKE, dedup, index, and audit in the correct order.

**Pipeline `ingest_as` constraint:** `IngestOptions.ingest_as` is typed `Extract<PakeType, "SourceNote" | "InsightNote">`. Synthesis output is stored as `InsightNote` and tagged `synthesis` so Bases/retrieval can distinguish it. Do NOT pass `"SynthesisNote"` — it won't compile.

### New File Locations

```
src/
  agents/
    synthesis-agent.ts        ← main orchestrator + types + default adapters
tests/
  vault-io/
    synthesis-agent.test.ts
```

No new MCP tool in `src/tools/` — the synthesis agent is an internal orchestration module called by tests and downstream agents (17-4, 17-6). It is NOT registered on the Phase 1 MCP surface.

### Adapter Injection Pattern (identical to 17-2)

```typescript
export type VaultReadAdapter = {
  readNote(vaultPath: string): Promise<{ body: string; frontmatter: Record<string, unknown> }>;
};

export type SynthesisAdapterInput = {
  topic: string;
  queries: string[];
  source_notes: Array<{
    vault_path: string;
    body: string;
    frontmatter: Record<string, unknown>;
  }>;
};

export type SynthesisAdapterOutput = {
  patterns: string[];
  gaps: string[];
  opportunities: string[];
  summary: string;
};

export type SynthesisAdapter = {
  synthesize(input: SynthesisAdapterInput): Promise<SynthesisAdapterOutput>;
};

export type SynthesisAgentOptions = {
  surface?: string;
  queries?: string[]; // optional override — defaults to empty (sweep does not carry queries)
  adapters?: {
    vaultRead?: VaultReadAdapter;
    synthesis?: SynthesisAdapter;
  };
};
```

Tests inject fakes for both adapters. Default `VaultReadAdapter` wraps `vaultReadFile()` + `gray-matter`; default `SynthesisAdapter` throws `CnsError("UNSUPPORTED", "…synthesis adapter not configured")` so production callers must wire an LLM explicitly (future story work — Epic 15 surface adapters may provide this).

### Adapter Output Schema

```typescript
export const synthesisAdapterOutputSchema = z.object({
  patterns: z.array(z.string()).min(0),
  gaps: z.array(z.string()).min(0),
  opportunities: z.array(z.string()).min(0),
  summary: z.string().min(1),
});
```

A synthesis run can legitimately produce zero patterns or zero gaps — but the `summary` must be non-empty (it becomes `ai_summary` on the InsightNote).

### Note Body Rendering

```markdown
# Synthesis: {topic}

{summary}

## Patterns

- {pattern 1}
- {pattern 2}

## Gaps

- {gap 1}

## Opportunities

- {opp 1}

## Sources

- [[{source_vault_path_without_ext_or_folder}]] ({pake_id})
```

Use `basename(vault_path, ".md")` for the wikilink target (Obsidian resolves across folders). Include each source’s `pake_id` in parens if available in frontmatter.

When a section is empty, render `- _none identified_` so the structure is predictable for downstream parsing.

### Ingest Call Pattern

```typescript
const body = renderSynthesisBody({ topic, queries, summary, patterns, gaps, opportunities, sources });
const title = `Synthesis: ${topic} (${new Date().toISOString().slice(0, 10)})`;

const result = await runIngestPipeline(vaultRoot, {
  input: body,                     // text source — classifySource() returns "text"
  source_type: "text",
  ingest_as: "InsightNote",
  title_hint: title,
  tags: [topic, "synthesis", "research-sweep"],
  ai_summary: summary,
  confidence_score: 0.6,
}, { surface: opts.surface ?? "synthesis-agent" });
```

The pipeline will write to `03-Resources/` (or wherever PAKE gate routes InsightNote). A text source has no `source_uri`, so the duplicate check is skipped automatically.

### Ingest Result Handling

```typescript
if (result.status === "ok") {
  // success path — return { status: "ok", insight_note: { vault_path, pake_id }, ... }
} else if (result.status === "conflict" || result.status === "validation_error") {
  throw new CnsError("IO_ERROR", `Synthesis ingest failed: ${result.error}`);
} else {
  // "duplicate" should not occur for text source (no source_uri); treat defensively.
  throw new CnsError("IO_ERROR", "Synthesis ingest returned unexpected duplicate status");
}
```

### Audit Record

One sweep-level audit record per run, emitted AFTER the pipeline’s own ingest record:

```typescript
// Success
await appendRecord(vaultRoot, {
  action: "synthesis_run",
  tool: "synthesis_agent",
  surface,
  targetPath: insight_note.vault_path,
  payloadInput: {
    topic,
    sources_used_count,
    sources_read_failed_count,
    insight_note_pake_id,
  },
  isoUtc: synthesis_timestamp,
});

// Skipped
await appendRecord(vaultRoot, {
  action: "synthesis_skipped",
  tool: "synthesis_agent",
  surface,
  targetPath: "no-insight-note",
  payloadInput: { topic, reason, sources_read_failed_count },
  isoUtc: synthesis_timestamp,
});
```

### TypeScript Conventions (match existing codebase)

- ESM (`"type": "module"`) — all imports use `.js` extension
- `kebab-case` file names, `PascalCase` types, `camelCase` functions
- Zod validation at public boundaries (`safeParse` for the sweep input, `parse` for adapter output since adapter is trusted-ish but we still guard)
- No `console.log` in production paths — use `appendRecord` or throw `CnsError`
- `async`/`await` throughout

### Downstream Contract (17-4 reads this output)

`SynthesisRunResult` is the handoff to Story 17-4 (Hook Agent). The hook agent needs the `insight_note.vault_path` and `insight_note.pake_id` to reference the synthesis in its own ingestion. Do not change the result shape without coordinating with 17-4.

### Anti-Patterns to Avoid

- Do NOT call `vaultCreateNote()` directly — use `runIngestPipeline()`
- Do NOT emit per-source audit lines from the agent — vault reads are non-mutating and don’t require audit
- Do NOT make live LLM calls in tests — inject `SynthesisAdapter` mock returning deterministic content
- Do NOT make live fs reads in tests — inject `VaultReadAdapter` mock (fixture-vault reads are fine for a few smoke tests, but ACs are covered via adapter mocks)
- Do NOT pass `ingest_as: "SynthesisNote"` — pipeline type constraint rejects it; use `"InsightNote"` + `"synthesis"` tag
- Do NOT throw on malformed source note frontmatter — treat as readable but flag in `sources_read_failed` only when the file read itself fails

### Previous Story Learnings (from 17-2 code review)

1. **Single audit line per operation** — the ingest pipeline emits one `ingest` audit line for the InsightNote itself; the agent adds ONE more (`synthesis_run` or `synthesis_skipped`) for the overall run. No per-source audit lines.
2. **Synthetic source_uri for adapter failures** — 17-2 introduced `firecrawlQueryAdapterFailureUri` / `apifyQueryAdapterFailureUri`. For 17-3, read failures surface in `sources_read_failed[]` (vault paths, not URIs) — no URNs needed since sources are already governed vault paths.
3. **Adapter injection default** — 17-2’s Perplexity slot ships a stub that throws `UNSUPPORTED`. Do the same for the default `SynthesisAdapter` so production callers explicitly wire an LLM.
4. **Zod `safeParse` vs `parse`** — for externally-provided inputs (sweep result handed in by a caller), use `safeParse` and translate to `CnsError`. For internal re-validation of the final result shape, `parse` is fine (throw-through is acceptable).
5. **No `SynthesisNote` via ingest pipeline** — pipeline accepts only `SourceNote | InsightNote`. Use `InsightNote` + `synthesis` tag. If a future story wants a true `SynthesisNote` pake_type, it’ll need to extend `IngestOptions.ingest_as` first.

### Verify Gate

`bash scripts/verify.sh` must pass: `npm run lint`, `npm run typecheck`, `npm test` (all 379+ existing tests must still pass plus new synthesis-agent tests).
