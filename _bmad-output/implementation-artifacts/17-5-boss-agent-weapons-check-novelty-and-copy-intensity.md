# Story 17.5: Boss Agent — weapons check (novelty AND copy intensity both 10/10)

Status: done

Epic: 17 (Agency first product: content research agent chain)

## Story

As a **content strategist (operator)**,
I want **a Boss Agent that consumes a `HookRunResult` and subjects each of the four hooks to a
two-dimensional weapons check — invention novelty AND copy intensity — demanding 10/10 on
BOTH dimensions or triggering a rewrite loop until the gate clears**,
so that **nothing leaves the agency chain unless it is simultaneously a new angle AND a tight
sentence; and the verdict is stored as a single governed `WeaponsCheckNote` with a full
score trace suitable for post-hoc audit**.

## References

- Hook output contract (prerequisite, done): `src/agents/hook-agent.ts` — `HookRunResult`, `HookSlotResult`
- Synthesis pattern (adapter injection, 10/10 gate): `src/agents/synthesis-agent.ts`, `_bmad-output/implementation-artifacts/17-4-hook-agent-4-options-3-iterations-gate.md`
- Ingest pipeline: `src/ingest/pipeline.ts` — `runIngestPipeline()`
- PAKE / ingest typing: `src/pake/schemas.ts`, `src/ingest/classify.ts`, `src/tools/vault-create-note.ts` (`destinationDirectoryForCreate`)
- Audit logger: `src/audit/audit-logger.ts` — `appendRecord()`
- Error types: `src/errors.ts` — `CnsError`

## Acceptance Criteria

1. **Input validation (AC: input-validation)**
   **Given** a candidate `HookRunResult` (typed as `unknown` at the boundary)
   **When** `runBossAgent(vaultRoot, hookResult, opts)` is called
   **Then** the agent validates the shape with `hookRunResultSchema.safeParse()`
   **And** on failure throws `CnsError("SCHEMA_INVALID", …)` before any vault read or scoring adapter call.

2. **Hook skipped short-circuit (AC: hook-skipped)**
   **Given** a valid `HookRunResult` with `status: "skipped"`
   **When** the agent runs
   **Then** it returns a `BossRunResult` with `status: "skipped"`, `reason: "hook-skipped"`, and echoes the upstream `hook_skip_reason` plus (if present) `synthesis_skip_reason`
   **And** emits exactly one `appendRecord` with `action: "weapons_skipped"` and no `WeaponsCheckNote` is written.

3. **Weapons gate — novelty AND copy intensity both 10 (AC: weapons-gate)**
   **Given** `status: "ok"` with four `HookSlotResult` entries
   **When** the agent runs
   **Then** for each slot it calls an injected `WeaponsCheckAdapter.scoreAndRewrite(input)` at least once per slot and repeats until `scores.novelty === 10 AND scores.copy_intensity === 10`
   **And** each iteration passes back the `revised_hook` from the prior iteration so the adapter can continue the rewrite
   **And** if the slot does not clear both 10s within `MAX_WEAPONS_ITERATIONS` (default 10), the agent fails closed with `CnsError("IO_ERROR", …)` — no partial `WeaponsCheckNote` is written.

4. **Scoring rubric (AC: rubric — CRITICAL DESIGN)**
   The rubric is explicit, testable, and embedded in the `WeaponsCheckNote` body (so every future reviewer sees the criteria used). It MUST be exported as `WEAPONS_RUBRIC` from `src/agents/boss-agent.ts`:

   **Invention novelty (1–10) — Does this hook present a new angle the audience has not already internalised?**
   - 1: commodity platitude, interchangeable with competitor copy
   - 4: a familiar insight dressed in fresher language
   - 7: recognisable territory with a legitimately new framing
   - 10: a reframe the reader cannot unread — the core claim did not previously exist in the category conversation

   **Copy intensity (1–10) — Does every word pull weight, and does the line hit kinetically?**
   - 1: mushy, abstract, passive; could be removed without loss
   - 4: clear but inert; no rhythm, no verbs doing work
   - 7: tight and concrete, one or two soft spots
   - 10: every word pulls — concrete nouns, active verbs, specific stakes, nothing trimmable

   Both dimensions are integer 1–10 inclusive. Partial scores (9.5) are not permitted — the adapter must round and commit. A `rationale` string per iteration is mandatory (stored in the score trace).

5. **Adapter interface (AC: adapter)**
   **Given** weapons scoring is external (LLM-driven in production)
   **When** production callers wire an adapter
   **Then** the injected adapter conforms to:
   ```ts
   WeaponsCheckAdapter.scoreAndRewrite(input: {
     topic: string;
     synthesis_insight_path: string;
     hook_set_note_path: string;
     hook_slot: number;
     iteration: number;
     current_hook: string;
   }): Promise<{
     revised_hook: string;         // may equal current_hook if adapter decides no rewrite needed
     scores: { novelty: int 1-10; copy_intensity: int 1-10; rationale: string };
   }>
   ```
   **And** the agent validates the adapter response with `weaponsCheckAdapterOutputSchema.safeParse()` per iteration — malformed output throws `CnsError("SCHEMA_INVALID", …)`.

6. **WeaponsCheckNote via ingest pipeline (AC: weapons-note)**
   **Given** all four slots clear the gate
   **When** the agent writes output
   **Then** it calls `runIngestPipeline(vaultRoot, { source_type: "text", ingest_as: "WeaponsCheckNote", title_hint, tags, ai_summary, confidence_score: 0.7 })`
   **And** the body is structured markdown: header, wikilinks to `[[hook-set-basename]]` and `[[synthesis-basename]]`, the rubric as a fixed block (embedded copy of `WEAPONS_RUBRIC`), then four `## Hook option N` sections each containing final hook text, final scores, and an iteration trace (`novelty`, `copy_intensity`, `rationale` per iteration)
   **And** tags include `[topic-slug, "weapons-check", "research-sweep"]`.

7. **Audit trail (AC: audit)**
   **Given** a completed boss run (success or skip)
   **Then** exactly one sweep-level `appendRecord` beyond the pipeline's own ingest audit:
   - success → `action: "weapons_run"`, `targetPath: weapons_check_note.vault_path`, `payloadInput: { topic, weapons_check_note_pake_id, hook_set_note_path, slots: [{ slot, iterations }] }`
   - skip → `action: "weapons_skipped"`, `targetPath: "no-weapons-check-note"`, `payloadInput: { reason, hook_skip_reason?, synthesis_skip_reason? }`

8. **Tests (AC: tests)**
   **Given** LLM scoring is external
   **When** tests run
   **Then** `WeaponsCheckAdapter` is always mocked — no live LLM calls
   **And** tests cover:
   - Invalid `HookRunResult` input → `SCHEMA_INVALID`
   - Hook skipped propagation (both synthesis-skipped and synthesis-read-failed shapes)
   - Happy path: all four hooks clear in ≥1 iteration (scores hit `{10, 10}`)
   - Iteration path: one slot needs multiple passes before both dimensions hit 10
   - Malformed adapter output → `SCHEMA_INVALID`
   - Partial scores (e.g. 10 novelty + 9 copy_intensity) trigger another iteration, not acceptance
   - Max-iteration fail-closed → `CnsError("IO_ERROR")`, no `WeaponsCheckNote` written, no `weapons_run` audit line
   - `WEAPONS_RUBRIC` text is embedded in the rendered note body
   - Audit line present for both success and skip cases
   **And** `bash scripts/verify.sh` passes before the story is marked **review**.

## Tasks / Subtasks

- [x] Add `WeaponsCheckNote` to `PAKE_TYPE_VALUES` (`src/pake/schemas.ts`)
- [x] Extend `IngestOptions.ingest_as` and `resolvePakeType` return type to include `WeaponsCheckNote` (`src/ingest/classify.ts`)
- [x] Route `WeaponsCheckNote` to `03-Resources` in `destinationDirectoryForCreate` (`src/tools/vault-create-note.ts`)
- [x] Export `hookSlotResultSchema` + `hookRunResultSchema` from `src/agents/hook-agent.ts` (single source of truth for Boss Agent input)
- [x] Create `src/agents/boss-agent.ts` — types, Zod schemas, `WEAPONS_RUBRIC` export, `createDefaultWeaponsCheckAdapter`, `runBossAgent`
- [x] Implement per-slot loop (score → accept on 10+10, else iterate with revised hook) with hard cap `MAX_WEAPONS_ITERATIONS`
- [x] Render WeaponsCheckNote body (rubric block + four hook sections with score traces)
- [x] Emit `weapons_run` / `weapons_skipped` audit records
- [x] Add `tests/vault-io/boss-agent.test.ts` with mocked scoring adapter covering all ACs
- [x] Run `bash scripts/verify.sh` and mark story **review** + sprint `17-5` → `review`

## Dev Agent Record

### Agent Model Used

Composer (agent router)

### Debug Log References

- Initial verify run flagged a pre-existing unused type import (`HookGenerationAdapterInput`) in `tests/vault-io/hook-agent.test.ts`; removed to keep the lint stage green.

### Completion Notes List

- Extended PAKE typing for `WeaponsCheckNote` across four files (`PAKE_TYPE_VALUES`, `IngestOptions.ingest_as`, `resolvePakeType` return type, `destinationDirectoryForCreate` switch → `03-Resources`).
- Exported `hookSlotResultSchema` + `hookRunResultSchema` from `hook-agent.ts`; `boss-agent.ts` consumes the union directly, so `HookRunResult` has a single source of truth.
- `runBossAgent` validates unknown input with `hookRunResultSchema`, reuses `createDefaultVaultReadAdapter` (from `synthesis-agent.ts`), and requires an injected `WeaponsCheckAdapter` (default throws `UNSUPPORTED`).
- Per-slot loop: starts from the hook-set's `final_hook` as the initial draft, iterates until `novelty === 10 && copy_intensity === 10` (strict equality, not `>=`). Hard cap `MAX_WEAPONS_ITERATIONS = 10`; exhaustion throws `CnsError("IO_ERROR", …)` — no partial `WeaponsCheckNote` on gate failure.
- Topic parsed from the HookSetNote body (`# Hook set: {topic}` header) via injected `VaultReadAdapter`; HookSetNote read failure surfaces as a hard `CnsError("IO_ERROR")` (not a skip) — this is distinct from hook-agent's treatment of synthesis-read failures because a HookSetNote absence means the upstream contract is broken, not that upstream gracefully declined to run.
- `WEAPONS_RUBRIC` exported as a `const` string literal, embedded verbatim in every rendered note, and asserted exactly in `WEAPONS_RUBRIC` test to trip on accidental edits.
- Success path writes one `WeaponsCheckNote` via `runIngestPipeline` (confidence 0.7, tags `[topic-slug, "weapons-check", "research-sweep"]`) and emits `weapons_run`; skip path emits `weapons_skipped` only (hook-skipped propagation).
- `bash scripts/verify.sh` green: **423** Vitest tests (14 new boss-agent + existing surfaces unchanged), plus lint/typecheck/build.

### File List

- `src/agents/boss-agent.ts` (new)
- `src/agents/hook-agent.ts` (modified — export `hookSlotResultSchema`, `hookRunResultSchema`)
- `src/pake/schemas.ts` (modified — `WeaponsCheckNote` in `PAKE_TYPE_VALUES`)
- `src/ingest/classify.ts` (modified — `ingest_as` / `resolvePakeType` extend to `WeaponsCheckNote`)
- `src/tools/vault-create-note.ts` (modified — `WeaponsCheckNote` routing → `03-Resources`)
- `tests/vault-io/boss-agent.test.ts` (new)
- `tests/vault-io/hook-agent.test.ts` (modified — remove pre-existing unused type import)
- `_bmad-output/implementation-artifacts/17-5-boss-agent-weapons-check-novelty-and-copy-intensity.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-18 | Story file created (ready-for-dev) |
| 2026-04-18 | Implementation complete — WeaponsCheckNote + boss-agent + 14 tests; verify green (423 Vitest); status → review |
| 2026-04-18 | BMAD code review closed — 0 patches, focus areas clean; sprint + story status → done |

---

## Developer Context — Implementation Guide

### Scoring Rubric as Code

Export a constant so the rubric is versioned in source AND embedded in every `WeaponsCheckNote`:

```typescript
export const WEAPONS_RUBRIC = `**Invention novelty (1–10)** — Does this hook present a new angle the audience has not already internalised?
- 1: commodity platitude, interchangeable with competitor copy
- 4: a familiar insight dressed in fresher language
- 7: recognisable territory with a legitimately new framing
- 10: a reframe the reader cannot unread — the core claim did not previously exist in the category conversation

**Copy intensity (1–10)** — Does every word pull weight, and does the line hit kinetically?
- 1: mushy, abstract, passive; could be removed without loss
- 4: clear but inert; no rhythm, no verbs doing work
- 7: tight and concrete, one or two soft spots
- 10: every word pulls — concrete nouns, active verbs, specific stakes, nothing trimmable

Gate: both dimensions must equal 10 (integer) simultaneously; any lower score triggers a rewrite and re-score.` as const;
```

The string literal is asserted verbatim in at least one test so accidental edits to the rubric break the suite.

### Consuming HookRunResult

Two options for the input schema:
1. Export `hookRunResultSchema` from `src/agents/hook-agent.ts` and import it here (preferred — single source of truth).
2. Mirror it locally like the pattern in `hook-agent.ts` mirrored synthesis. (Acceptable if export would add noise.)

Prefer option 1: add `export const hookRunResultSchema = …` to `hook-agent.ts` next to `synthesisRunResultSchema`. Shape:

```typescript
export const hookSlotResultSchema = z.object({
  slot: z.number().int().min(1),
  final_hook: z.string().min(1),
  iterations: z.number().int().min(1),
  trace: z.array(z.object({
    iteration: z.number().int().min(1),
    score: z.number().int().min(1).max(10),
  })),
});

export const hookRunResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    hook_set_note: z.object({ vault_path: z.string(), pake_id: z.string() }),
    synthesis_insight_path: z.string(),
    options: z.array(hookSlotResultSchema),
    hook_timestamp: z.string(),
  }),
  z.object({
    status: z.literal("skipped"),
    reason: z.enum(["synthesis-skipped", "synthesis-read-failed"]),
    synthesis_skip_reason: z.enum(["no-source-notes", "no-readable-sources"]).optional(),
    hook_timestamp: z.string(),
  }),
]);
```

### Per-Slot Loop

```typescript
const MIN_WEAPONS_ITERATIONS = 1;
const MAX_WEAPONS_ITERATIONS = 10;

for (let i = 1; i <= MAX_WEAPONS_ITERATIONS; i++) {
  const raw = await adapter.scoreAndRewrite({
    topic, synthesis_insight_path, hook_set_note_path,
    hook_slot, iteration: i, current_hook: draft,
  });
  const parsed = weaponsCheckAdapterOutputSchema.safeParse(raw);
  if (!parsed.success) throw new CnsError("SCHEMA_INVALID", …);
  draft = parsed.data.revised_hook;
  trace.push({ iteration: i, ...parsed.data.scores });
  if (parsed.data.scores.novelty === 10 && parsed.data.scores.copy_intensity === 10) {
    return { slot: hook_slot, final_hook: draft, iterations: i, trace };
  }
}
throw new CnsError("IO_ERROR", `Weapons slot ${hook_slot} failed gate within ${MAX_WEAPONS_ITERATIONS} iterations`);
```

Both dimensions must hit exactly 10 (not `>= 10`; the schema caps at 10 anyway, but the equality check communicates intent).

### WeaponsCheckNote Body

```markdown
# Weapons check: {topic}

Hook set: [[{hook_set_basename}]]
Synthesis: [[{synthesis_basename}]]

_All four hooks cleared the weapons gate (novelty = 10 AND copy intensity = 10)._

## Rubric

{WEAPONS_RUBRIC}

## Hook option 1

**Final hook:** {text}

**Final scores:** novelty 10/10 · copy intensity 10/10 · iterations {n}

### Iteration trace

- Iteration 1: novelty 7, copy 8 — {rationale}
- Iteration 2: novelty 10, copy 10 — {rationale}

## Hook option 2
...
```

Use `path.basename(vault_path, '.md')` for wikilink targets (Obsidian resolves across folders).

### Ingest Call

```typescript
await runIngestPipeline(vaultRoot, {
  input: body,
  source_type: "text",
  ingest_as: "WeaponsCheckNote",
  title_hint: `Weapons check: ${topic} (${dateYmd})`,
  tags: [topicTagSlug(topic), "weapons-check", "research-sweep"],
  ai_summary: `Four hooks passed the weapons gate (novelty = 10 AND copy intensity = 10) for: ${topic}`,
  confidence_score: 0.7,
}, { surface });
```

### Topic Parsing

Derive `topic` from the HookSetNote itself — read the note body via the injected `VaultReadAdapter` (same pattern as 17-4 reading the synthesis) and parse a `# Hook set: {topic}` line. Fall back to a generic "research-topic" if missing. This keeps the Boss Agent's input contract tight: it only needs the `HookRunResult`, not a separate topic argument.

### Adapter Injection (mirror 17-4 exactly)

```typescript
export type BossAgentAdapters = {
  vaultRead?: VaultReadAdapter | undefined;
  weaponsCheck?: WeaponsCheckAdapter | undefined;
};

export function createDefaultWeaponsCheckAdapter(): WeaponsCheckAdapter {
  return {
    async scoreAndRewrite() {
      throw new CnsError(
        "UNSUPPORTED",
        "Weapons check adapter not configured — inject an LLM-backed WeaponsCheckAdapter via opts.adapters.weaponsCheck",
      );
    },
  };
}
```

Reuse `createDefaultVaultReadAdapter` from `synthesis-agent.ts` (already imported by `hook-agent.ts`).

### Anti-Patterns to Avoid

- Do NOT accept `score >= 10` — the rubric caps at 10 integer, and the gate is exactly `===` on both dimensions. Using `>=` risks a silent rubric drift if the schema were ever loosened.
- Do NOT write a partial `WeaponsCheckNote` on max-iteration fail — fail closed with `CnsError("IO_ERROR")`. This matches the 17-4 hook-agent pattern.
- Do NOT short-circuit when `novelty === 10` alone (or `copy_intensity === 10` alone) — both are required. Test explicitly that 10+9 and 9+10 both iterate again.
- Do NOT call the scoring adapter in tests without mocking — there is no default-adapter smoke test for this story; LLM scoring is purely injected behaviour.
- Do NOT introduce a new audit action name — use `weapons_run` / `weapons_skipped` consistently with the 17-2/17-3/17-4 naming pattern (`<agent>_run` / `<agent>_skipped`).
- Do NOT persist intermediate hook drafts as separate vault notes. The final hook text + trace lives only inside the `WeaponsCheckNote`.

### Previous Story Learnings (from 17-4)

1. **Extend PAKE + ingest typing for a new note type** — 17-4 added `HookSetNote` to (a) `PAKE_TYPE_VALUES`, (b) `IngestOptions.ingest_as` extract type, (c) `resolvePakeType` return type, (d) `destinationDirectoryForCreate` switch. TypeScript's exhaustive switch will flag missing cases at compile time. Do the same for `WeaponsCheckNote` — four files, four small edits.
2. **Max-iteration fail-closed** — 17-4 used `MAX_HOOK_ITERATIONS = 20`; this story uses a tighter `MAX_WEAPONS_ITERATIONS = 10` because the weapons gate is higher-signal and a rewrite should converge faster.
3. **Audit line format** — `formatAuditLine` is pipe-delimited; assert with `lines[n].includes("| weapons_run |")`, not JSON shape.
4. **Zod discriminated union for input** — `HookRunResult` is a union of `ok` and `skipped`. Use `z.discriminatedUnion("status", …)` so the agent can branch on `.status` type-safely after `safeParse`.
5. **Do NOT write a default smoke test that calls the real LLM-adapter** — for 17-3 and 17-4, the default adapter throws `UNSUPPORTED`. Test that behaviour directly; do not attempt a happy path with the default adapter.

### Verify Gate

`bash scripts/verify.sh` must pass: `npm run lint`, `npm run typecheck`, `npm test` (all 409+ existing tests must still pass plus new boss-agent tests).
