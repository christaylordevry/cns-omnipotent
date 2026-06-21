# Story 73.7: Digest Entity Intelligence Sections

Status: ready-for-dev

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **Omnipotent.md only** (Node completion hook + markdown renderer). Dashboard UI is **73-6**. Convex query is **73-5**. Post-push analysis is **73-4**.  
**Normative spec:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §6.2, §4.3  
**UX contract:** `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/EXPERIENCE.md` § DigestEntitySection

<!-- Validation: optional `/bmad-create-story` checklist before `/bmad-dev-story`. -->

## Story

As a CNS operator reading the morning digest on Discord,
I want compact ranked sections for tracked entities accelerating now and emerging entities worth a look,
so that I get entity intelligence in the daily flow without opening the dashboard (CAP-8).

## Acceptance Criteria

### AC1 — Fetch entity intelligence once over HTTP (ADR-E73-007)

**Given** story **73-5** shipped `getEntityIntelligence` in cns-dashboard  
**When** the deterministic digest completion path prepares Discord markdown  
**Then** a new module calls Convex **once** via `POST {CONVEX_URL}/api/query` with path `entityIntelligence:getEntityIntelligence` and args `{ now: runRanAt }` where `runRanAt` is the digest run timestamp (ms) — **not** `Date.now()` unless run time unavailable  
**And** auth reuses `resolveConvexPushEnv()` + `Authorization: Convex {deployKey}` (mirror `postQuery()` in `scripts/push-digest-watchdog.mjs`)  
**And** on query failure, stderr logs warning and digest continues **without** entity sections (fire-and-forget — mirrors entity stage §8 degraded mode)

### AC2 — Markdown sections with line grammar (CAP-8, EXPERIENCE.md)

**Given** `getEntityIntelligence` returns `{ trackedInMotion, emergingToReview }`  
**When** `renderDigestEntitySection(result, options?)` runs  
**Then** it emits up to two markdown sub-sections (omit entirely when lane is empty — **no empty headers**):

```markdown
## Tracked entities accelerating now
• **Andrej Karpathy** (person) — ≈4× vs baseline · cross-source (3)
• ...

## Emerging entities worth a look
• **ggml-org/llama.cpp** (org) — new, 5 mentions/7d · cold start
• ...
```

**And** line grammar: `• **{displayName}** ({entityType}) — {momentumShort} · {topReasonLabel}`  
**And** `momentumShort` derived from `momentumSummary` or compact formatter (truncate long lines for Discord density)  
**And** `topReasonLabel` from first reason in `reasons[]` (human-readable short label, not raw code)  
**And** practical trim: **3–5 lines per lane** (below server `ENTITY_LANE_MAX_ITEMS` default 10) — configurable constant `DIGEST_ENTITY_MAX_LINES_PER_LANE = 5`  
**And** optional trailing markdown link: `[Open entity cockpit](/nexus/entities)` when digest template supports deep-link (plain URL acceptable for Discord)

### AC3 — Pipeline ordering (depends on 73-4)

**Given** the morning digest completion orchestrator runs  
**When** `scoreWriteAndPush()` completes Convex push  
**Then** execution order is:

1. `pushPayload()` — existing digest + keyword candidates push
2. **`analyze-entity-intelligence.mjs`** (73-4) — clear-then-write entity snapshots; stderr + exit 0 on failure
3. **Fetch `getEntityIntelligence` + render entity markdown** (this story)
4. **`postDigestToDiscord()`** — with base markdown **plus** appended entity block

**And** repair/replay paths in `run-digest-convex-completion.mjs` that post Discord follow the same order when entity stage is enabled  
**And** when 73-4 has not run (no snapshots), query may return empty lanes — Discord post proceeds with no entity sections (not an error)

### AC4 — Integration with existing markdown resolver

**Given** `resolveDigestMarkdownFromPayload(payload)` produces base digest markdown  
**When** entity sections are rendered  
**Then** final markdown = `baseMarkdown + (entityBlock ? '\n\n' + entityBlock : '')` before `splitDiscordMessages()` in `post-digest-discord.mjs`  
**And** entity block respects existing ~3400 char packing / 2000-char Discord chunking — if append would exceed limits, trim lines per lane (lowest rank first) before append  
**And** pre-rendered agent markdown paths (`digestMarkdown`, `outputContract`) still get entity append on completion cron path

### AC5 — Tests and verify gate

**Given** implementation complete  
**When** `npm test` and `bash scripts/verify.sh` run from Omnipotent.md  
**Then** all pass  
**And** `tests/render-digest-entity-section.test.mjs` covers:
- both lanes populated → two headers + correct line grammar
- empty tracked lane → emerging section only
- both empty → returns `''`
- reason label mapping for `acceleration`, `cold_start`, `cross_source`
- line trim at `DIGEST_ENTITY_MAX_LINES_PER_LANE`
**And** `tests/run-digest-convex-completion.test.mjs` (or dedicated test) asserts orchestration calls entity render **after** push and **before** Discord post (mock `fetchFn`)

### AC6 — Out of scope (explicit)

- Hermes agent `task-prompt.md` output contract changes (optional follow-up — cron path is v1 minimum)
- New Convex mutations (owned by 73-1/73-4)
- Dashboard UI (73-6)
- `getEntityIntelligenceHealth` in digest (health is dashboard footnote only)
- WriteGate / vault mutations

## Tasks / Subtasks

### Prerequisite gate

- [ ] **T0 — Dependency check** (AC: 1, 3)
  - [ ] T0.1 Confirm `entityIntelligence:getEntityIntelligence` exists (73-5)
  - [ ] T0.2 Confirm `analyze-entity-intelligence.mjs` wired in completion (73-4) — or implement 73-4 first / same session with 73-4 merged before Discord reorder test passes

### New renderer module

- [ ] **T1 — `render-digest-entity-section.mjs`** (AC: 2)
  - [ ] T1.1 Create `scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs`
  - [ ] T1.2 Export `fetchEntityIntelligence(env, { now, fetchFn })` — wraps `postQuery` to `entityIntelligence:getEntityIntelligence`
  - [ ] T1.3 Export `renderDigestEntitySection(result, { maxPerLane })` — pure markdown string
  - [ ] T1.4 Export `reasonCodeToDigestLabel(code, detail?)` — short labels for digest lines
  - [ ] T1.5 Export `compactMomentumSummary(momentumSummary)` — one-line trim for Discord
  - [ ] T1.6 Add `tests/render-digest-entity-section.test.mjs`

### Wire completion + Discord

- [ ] **T2 — Orchestrator reorder** (AC: 3, 4)
  - [ ] T2.1 In `scripts/run-digest-convex-completion.mjs` `scoreWriteAndPush()` (and Discord repair branches):
    - after successful `pushPayload()`, invoke analyze stage (73-4 export or spawn)
    - call `fetchEntityIntelligence` + `renderDigestEntitySection`
    - pass enriched markdown to `postDigestToDiscord()` via new optional param or payload field `entityDigestMarkdown`
  - [ ] T2.2 Update `post-digest-discord.mjs` / `resolveDigestMarkdownFromPayload()` to append entity block when present
  - [ ] T2.3 Ensure force-rescore / artifact replay paths don't skip entity append when snapshots exist

- [ ] **T3 — Shared HTTP helper (optional DRY)**
  - [ ] T3.1 If duplication grows, extract `postConvexQuery()` beside `postQuery` in watchdog or a small `convex-http-client.mjs` — **only if** it reduces duplication without scope creep

### Verify

- [ ] **T4 — Verify gate** (AC: 5)
  - [ ] T4.1 `bash scripts/verify.sh` from Omnipotent.md
  - [ ] T4.2 Manual: dry-run with mocked query response → Discord markdown contains both sections; empty lanes omit headers

## Dev Notes

### Prerequisite stories

| Story | Delivers | Blocks |
|-------|----------|--------|
| **73-5** | `getEntityIntelligence` query | **Yes** — nothing to fetch without it |
| **73-4** | Post-push snapshots | **Soft** — empty lanes OK, but real value needs snapshots |
| **73-1..73-3** | Schema + extraction + payload | Upstream of 73-4 |

### Architecture compliance

- **§6.2:** Digest calls query once; no reactive subscription.
- **§8:** Entity stage / query failures must not fail digest post — stderr + continue.
- **ADR-E73-001:** No Convex reads during scoring hot path; this read is post-push only.
- **CAP-6:** Zero new adapters.
- **No WriteGate** — read-only HTTP query.

### Files to READ before editing (mandatory)

| File | Current state | This story changes |
|------|---------------|---------------------|
| `scripts/run-digest-convex-completion.mjs` | `scoreWriteAndPush()` pushes then Discord immediately | Insert analyze + entity fetch between push and Discord |
| `scripts/hermes-skill-examples/morning-digest/scripts/post-digest-discord.mjs` | `postDigestToDiscord`, chunking | Accept appended entity markdown |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | `resolveDigestMarkdownFromPayload`, `renderDigestMarkdownFromPayload` | Append hook or caller-side concat |
| `scripts/push-digest-watchdog.mjs` | `postQuery()` HTTP pattern | Copy pattern for entity query |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | `resolveConvexPushEnv`, `normalizeConvexUrl` | Reuse env resolution |

### Expected query response shape (from architecture §5.2)

```typescript
{
  trackedInMotion: EntityLaneItem[];  // ranked, sliced server-side
  emergingToReview: EntityLaneItem[];
}
// EntityLaneItem: entityKey, entityType, displayName, momentumSummary, reasons[], evidence[], ...
```

### HTTP query call pattern (copy from watchdog)

```javascript
await postQuery(fetchFn, convexEnv, 'entityIntelligence:getEntityIntelligence', {
  now: payload.run.ranAt,
});
```

### Orchestration pseudocode

```javascript
const pushResult = await pushPayload(scoredPayload, env);
await runAnalyzeEntityIntelligence(scoredPayload, env); // 73-4, exit 0 on fail
let markdown = resolveDigestMarkdownFromPayload(scoredPayload);
try {
  const intel = await fetchEntityIntelligence(env, { now: scoredPayload.run.ranAt });
  const entityBlock = renderDigestEntitySection(intel, { maxPerLane: 5 });
  if (entityBlock) markdown = `${markdown}\n\n${entityBlock}`;
} catch (err) {
  console.error('[entity-digest]', err.message);
}
await postDigestToDiscord({ ...scoredPayload, digestMarkdown: markdown }, env);
```

### Testing requirements

- Pure renderer tests with fixture `EntityLaneItem[]` — no live Convex
- Orchestration test with mocked `fetchFn` returning fixture JSON
- Regression: existing `tests/post-digest-discord.test.mjs` chunking still passes when entity block appended
- Regression: `tests/parse-digest-source-outcomes.test.mjs` unchanged behavior when no entity block

### Discord density rules

- Plain text bullets (no HTML); bold via `**name**` where Discord markdown supports it
- Trim to 3–5 lines/lane before append; further trim if total markdown exceeds pack limit
- Omit section header when lane count === 0

### Hermes agent path (deferred note)

Live Hermes skill posts Discord from agent markdown **before** completion cron in some flows. This story targets the **deterministic completion cron** (`run-morning-digest-cron.sh` → `run-digest-convex-completion.mjs`). Extending `task-prompt.md` with entity headings is optional follow-up — document in completion notes if skipped.

### Anti-patterns (do NOT)

- Call `getEntityIntelligence` inside adapter collect loop
- Fail Discord post when entity query fails
- Re-implement lane ranking in Node (trust server order)
- Add LLM summarization for digest lines
- Block on 73-4 success before posting Discord (post with empty sections if analyze failed)

### References

- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §6.2, §4.3, §8]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/EXPERIENCE.md` § DigestEntitySection]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/DESIGN.md` § DigestEntitySection]
- [HTTP query pattern: `scripts/push-digest-watchdog.mjs` `postQuery()`]
- [Completion hook pattern: `_bmad-output/implementation-artifacts/69-3-source-health-panel.md` T8–T9]
- [Pipeline: `_bmad-output/implementation-artifacts/70-1-wire-node-orchestrator-cron.md`]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
