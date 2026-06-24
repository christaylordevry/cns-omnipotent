# Story 73.7: Digest Entity Intelligence Sections

Status: done

baseline_commit: a8270ade473992e7363755cd7ac5740ccc2133db

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
**And** `topReasonLabel` from the first non-redundant reason in `reasons[]` (human-readable short label, not raw code); a first-position `acceleration` reason may be skipped when `momentumShort` already carries the same ratio
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
**And** entity block respects existing ~3400 char packing / 2000-char Discord chunking — if append would exceed limits, trim lines per lane (lowest rank first) before append; if no complete entity heading and line fits, omit the entity block entirely
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

- [x] **T0 — Dependency check** (AC: 1, 3)
  - [x] T0.1 Confirm `entityIntelligence:getEntityIntelligence` exists (73-5)
  - [x] T0.2 Confirm `analyze-entity-intelligence.mjs` wired in completion (73-4) — or implement 73-4 first / same session with 73-4 merged before Discord reorder test passes

### New renderer module

- [x] **T1 — `render-digest-entity-section.mjs`** (AC: 2)
  - [x] T1.1 Create `scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs`
  - [x] T1.2 Export `fetchEntityIntelligence(env, { now, fetchFn })` — wraps `postQuery` to `entityIntelligence:getEntityIntelligence`
  - [x] T1.3 Export `renderDigestEntitySection(result, { maxPerLane })` — pure markdown string
  - [x] T1.4 Export `reasonCodeToDigestLabel(code, detail?)` — short labels for digest lines
  - [x] T1.5 Export `compactMomentumSummary(momentumSummary)` — one-line trim for Discord
  - [x] T1.6 Add `tests/render-digest-entity-section.test.mjs`

### Wire completion + Discord

- [x] **T2 — Orchestrator reorder** (AC: 3, 4)
  - [x] T2.1 In `scripts/run-digest-convex-completion.mjs` `scoreWriteAndPush()` (and Discord repair branches):
    - after successful `pushPayload()`, invoke analyze stage (73-4 export or spawn)
    - call `fetchEntityIntelligence` + `renderDigestEntitySection`
    - pass enriched markdown to `postDigestToDiscord()` via new optional param or payload field `entityDigestMarkdown`
  - [x] T2.2 Update `post-digest-discord.mjs` / `resolveDigestMarkdownFromPayload()` to append entity block when present
  - [x] T2.3 Ensure force-rescore / artifact replay paths don't skip entity append when snapshots exist

- [x] **T3 — Shared HTTP helper (optional DRY)**
  - [x] T3.1 If duplication grows, extract `postConvexQuery()` beside `postQuery` in watchdog or a small `convex-http-client.mjs` — **only if** it reduces duplication without scope creep

### Verify

- [x] **T4 — Verify gate** (AC: 5)
  - [x] T4.1 `bash scripts/verify.sh` from Omnipotent.md
  - [x] T4.2 Manual: dry-run with mocked query response → Discord markdown contains both sections; empty lanes omit headers

### Review Findings

- [x] [Review][Patch] Amend AC4 to explicitly permit complete entity-section omission when the base digest leaves insufficient room under the 3400-character pack limit. [scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs:184]
- [x] [Review][Patch] Amend AC2 to permit skipping a first-position `acceleration` reason when momentum already carries the same ratio, preserving the locked `cross-source (3)` example without duplicate information. [scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs:98]
- [x] [Review][Patch] Run and record the entity analysis stage before entity fetch in `discordOnlyFromArtifact`; the current repair path fetches directly and can query stale snapshots. [scripts/run-digest-convex-completion.mjs:738]
- [x] [Review][Patch] Record entity-fetch failures in structured invocation/day outcomes; stderr-only handling recreates the silent-failure pattern fixed in Story 73-4. [scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs:279]
- [x] [Review][Patch] Bound the Convex entity query with a timeout so a stalled query cannot block Discord delivery indefinitely. [scripts/push-digest-watchdog.mjs:56]
- [x] [Review][Patch] Sanitize dynamic entity fields before markdown rendering, including embedded newlines, markdown control text, Discord mentions, and emoji prohibited by the UX gate. [scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs:119]
- [x] [Review][Patch] Filter or skip malformed lane members so one null or primitive item does not suppress the entire entity block. [scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs:140]
- [x] [Review][Patch] Add strict ordering assertions for push-only and Discord-only repair paths; the current array assertion correctly enforces order only for force-rescore `scoreWriteAndPush`. [tests/run-digest-convex-completion.test.mjs:504]
- [x] [Review][Patch] Trim lowest-ranked lines across both lanes without exhausting the emerging lane first, and test the real deep-link-enabled output shape near production base lengths. [scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs:184]
- [x] [Review][Defer] Full verify gate currently fails seven unrelated session-close Section 8 tests because the changed draft validator rejects existing fixtures that do not start with `###`. [scripts/session-close/gate-apply-section8.mjs:73] — deferred, pre-existing

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

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Reused existing `postQuery` from `push-digest-watchdog.mjs` (T3 skipped — no new HTTP client).
- Hermes skill resynced via `install-hermes-skill-morning-digest.sh` for verify gate parity.

### Completion Notes List

- Added `render-digest-entity-section.mjs`: single HTTP fetch to `entityIntelligence:getEntityIntelligence`, EXPERIENCE.md line grammar, `DIGEST_ENTITY_MAX_LINES_PER_LANE=5`, pack-limit trim, fire-and-forget on failure.
- Wired `enrichPayloadWithEntityDigest` into completion paths after 73-4 analyze and before Discord (`scoreWriteAndPush`, `pushOnlyFromArtifact`, `discordOnlyFromArtifact`).
- `resolveDigestMarkdownFromPayload` appends `entityDigestMarkdown` with 3400-char pack trim.
- Fixtures grounded on production-shaped entities (Mollick, LeCun, Clark, Lambert + llama.cpp org).
- Hermes `task-prompt.md` entity headings deferred (cron deterministic path is v1 minimum per story).
- Initial implementation verification was recorded as passed before review; current review gate status is documented below.
- Review fixes enforce analysis before fetch in all Discord paths, structured entity-fetch failure outcomes, a 10-second query timeout, sanitized emoji-free dynamic fields, malformed-row isolation, and balanced lane trimming.
- Review verification: 71 focused story tests pass; `bash scripts/verify.sh` green (2026-06-24 re-review).

### File List

- scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs
- scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs
- scripts/run-digest-convex-completion.mjs
- tests/render-digest-entity-section.test.mjs
- tests/run-digest-convex-completion.test.mjs
- tests/parse-digest-source-outcomes.test.mjs

### Change Log

- 2026-06-22: Story 73-7 — digest entity intelligence sections (HTTP query + markdown renderer + completion pipeline reorder).
- 2026-06-22: Code review patch set applied; story returned to in-progress because the required full verify gate is not green.
