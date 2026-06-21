---
baseline_commit: 714fb14705bf95f9ab8e5e3bf78325b63782f1fc
---

# Story 73.2: Extract Entities Pure Functions

Status: done

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **Omnipotent.md only** (Node pure functions + unit tests). No cns-dashboard changes.  
**Normative spec:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §4.1–4.2, ADR-E73-001, ADR-E73-003  
**Prerequisite:** None strict (parallel with 73-1); **73-3 blocks on this** for `aggregateRunEntities`  
**Blocks:** 73-3 (`buildEntityMentionPayload` calls extraction)

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a CNS developer implementing entity intelligence,
I want deterministic pure functions that extract type-tagged entities from structured digest signal fields only,
so that person/account/org keys are computed once in Node with no NLP, no Convex reads, and no cross-repo duplication.

## Acceptance Criteria

### AC1 — Module location and exports (§4.1)

**Given** architecture §4.1 file map  
**When** implementation is complete  
**Then** new file exists:

`scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs`

**And** it exports pure functions:

- `extractEntitiesFromSignal(signal)` → array of `{ entityType, entityKey, displayName, platform, tracked }`
- `normalizeEntityKey(entityType, parts)` — canonical key builder per ADR-E73-003
- `aggregateRunEntities(signals)` → `Map` or plain object grouped by `entityKey` with run-level aggregates

**And** module has **no** Convex imports, **no** `fetch`, **no** filesystem reads

### AC2 — Extraction algorithm (§4.2, ADR-E73-003)

**Given** a scored digest signal object (same shape as push payload signal)  
**When** `extractEntitiesFromSignal(signal)` runs  
**Then** extraction follows structured fields only:

1. If `sourceMetadata.peopleMatch.personName` → `person`, `tracked: true`, key `person:<normalize(personName)>`, displayName = personName
2. Else if `sourceMetadata.authorHandle` → `account`, key `account:<platform>:<stripAt(lower(handle))>` where platform = `sourceType`
3. Else if `sourceMetadata.author` (rss/youtube/tiktok/instagram/pinterest) → `account`, key `account:<platform>:<normalize(author)>`
4. If `sourceType === 'github'` and `url` matches `github.com/<owner>/<repo>` → `org`, key `org:github:<lower(owner)>`, displayName = owner

**And** a single signal may yield **multiple** entities (e.g. person + org on same GitHub signal)  
**And** `normalize` = trim + lowercase + collapse whitespace — reuse `tokenizeForScoring` normalization from `scripts/session-close/lib/notebook-scorer.mjs` where applicable (no new stopword lists)  
**And** no free-text title/summary extraction

### AC3 — Run aggregation (§4.2)

**Given** an array of signals for one run  
**When** `aggregateRunEntities(signals)` runs  
**Then** for each `entityKey` it computes:

- `mentionCount` — total signal references
- `distinctSignalCount` — distinct signal ids
- `sourceTypes` — distinct `sourceType` values
- `maxPersonalRelevance` / `maxRankScore` — max over entity's signals (`scores.personalRelevance`, `rankScore`)
- `coMentionedTrackedEntities` — tracked `entityKey`s appearing anywhere in the same run (signals with `peopleMatch`)
- `signalRefs` — up to 5 highest-`rankScore` evidence refs `{ digestSignalId, title, url, sourceType }`

**And** output is sufficient for 73-3 to map into `entityMentionInputValidator[]` without re-aggregation

### AC4 — Entity key fixtures (ADR-E73-003)

**Given** unit tests in `tests/morning-digest-extract-entities.test.mjs`  
**When** tests run via `npm test`  
**Then** they cover at minimum:

| Case | Expected key |
|------|----------------|
| `peopleMatch.personName: "Andrej Karpathy"` | `person:andrej karpathy` |
| Twitter `authorHandle: "@karpathy"` | `account:twitter:karpathy` |
| Bluesky handle | `account:bluesky:...` |
| RSS `author: "Jane Doe"` | `account:rss:jane doe` |
| GitHub url `github.com/ggml-org/llama.cpp` | `org:github:ggml-org` |
| Multi-entity signal (person + org) | both keys emitted |
| Signal with no entity fields | empty array |
| Normalization (extra spaces, `@` strip) | stable keys |

### AC5 — Verify gate

**Given** implementation complete  
**When** `bash scripts/verify.sh` runs from Omnipotent.md  
**Then** all pass (Omnipotent tests + sibling cns-dashboard when present)

### AC6 — Out of scope

- Convex schema/mutations (73-1)
- `buildEntityMentionPayload` (73-3)
- HTTP push to Convex (73-4)
- Lane ranking (73-5)
- WriteGate / vault

## Tasks / Subtasks

- [x] **T1 — `extract-entities.mjs`** (AC: 1, 2)
  - [x] T1.1 `normalizeEntityName(text)` — trim, lowercase, collapse whitespace
  - [x] T1.2 `normalizeEntityKey(entityType, platform, raw)` per ADR-E73-003 table
  - [x] T1.3 `extractEntitiesFromSignal(signal)` — four branches + multi-emit
  - [x] T1.4 GitHub URL regex: `github.com/<owner>/<repo>` owner segment only for org key

- [x] **T2 — Aggregation** (AC: 3)
  - [x] T2.1 `aggregateRunEntities(signals)` — group by entityKey
  - [x] T2.2 `pickTopSignalRefs(signals, limit=5)` by rankScore
  - [x] T2.3 `collectCoMentionedTracked(signals, entityKey)` for run-level co-mentions

- [x] **T3 — Tests** (AC: 4, 5)
  - [x] T3.1 `tests/morning-digest-extract-entities.test.mjs`
  - [x] T3.2 Fixture signals mirroring `build-digest-push-payload` output shape (use existing test fixtures where possible)
  - [x] T3.3 `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] Parse GitHub repository URLs by exact hostname and valid repository path; add malformed, partial, foreign-host, and `/orgs/` rejection fixtures [scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs:49]
- [x] [Review][Patch] Require Convex-assigned `digestSignalId` for aggregation identity and every `signalRef`; deduplicate capped evidence by that identifier so output is validator-ready for 73-3 [scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs:145]
- [x] [Review][Patch] Exclude non-finite relevance and rank scores from aggregate maxima and treat them as zero for evidence sorting to preserve the 73-1 validator contract [scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs:261]
- [x] [Review][Patch] Remove the discarded per-entity full-run co-mention rescan and use the already computed tracked-key set once [scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs:357]

## Dev Notes

### Prerequisite gate

| Story | Relationship |
|-------|----------------|
| **73-1** | Parallel — no hard dependency; extraction is pure |
| **Blocks** | **73-3** — payload builder imports this module |

### Architecture compliance

- **ADR-E73-001:** Extraction logic lives in exactly one Node module; Convex never re-extracts
- **ADR-E73-003:** v1 entity model — person/account/org from structured fields only; ProductHunt org deferred v2
- **§4.2:** Deterministic — no LLM/NLP

### Files to READ before editing (mandatory)

| File | Current state | This story uses |
|------|---------------|-----------------|
| `scripts/session-close/lib/notebook-scorer.mjs` | `tokenizeForScoring()` | Normalization reuse |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | Signal shape after scoring | Field paths for `scores`, `sourceMetadata` |
| `cns-dashboard/convex/validators.ts` | `peopleMatch`, `sourceMetadataValidator` | Field names (read-only reference) |
| `tests/morning-digest-build-payload.test.mjs` | Payload signal shape | Fixture patterns |
| `tests/fixtures/*-digest-signal.fixture.mjs` | Canonical signals per source | Extend for entity cases |

### Signal shape reference

Extraction consumes **post-score** signals as in `buildDigestPushPayload` output — each signal has:

- `sourceType`, `title`, `url`, `rankScore`, `scores.personalRelevance`
- `sourceMetadata.authorHandle`, `author`, `peopleMatch`, `contributingSources`

Signals in push payload may use `digestSignalId` only after Convex insert — aggregation in 73-3 assigns ids from pushed response; extraction here uses in-memory signal index or provisional id field if present in payload.

### New files (expected)

```
scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs
tests/morning-digest-extract-entities.test.mjs
```

### Testing requirements

- Node `node:test` — same as other morning-digest tests
- No Convex / no network

### References

- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §4.1–4.2, ADR-E73-001, ADR-E73-003]
- [Source: Story 68-2/68-3 — `peopleMatch` on `sourceMetadata`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- Hermes skill install gate required `bash scripts/install-hermes-skill-morning-digest.sh` after adding `extract-entities.mjs` to morning-digest scripts tree.

### Completion Notes List

- Added `extract-entities.mjs` with pure exports: `normalizeEntityName`, `normalizeEntityKey`, `extractEntitiesFromSignal`, `aggregateRunEntities`, plus helpers `pickTopSignalRefs`, `collectCoMentionedTracked`, `parseGithubRepoUrl`, `getSignalRefId`, `toSignalRef`.
- Extraction follows ADR-E73-003 structured-field branches only; `peopleMatch` takes precedence over `authorHandle`; GitHub org is additive (person + org on same signal).
- `author` branch limited to rss/youtube/tiktok/instagram/pinterest per architecture §4.2; GitHub `/orgs/` paths rejected as non-repo URLs.
- `aggregateRunEntities` returns plain object keyed by `entityKey` with run-level fields matching §4.2 / `entityMentionInputValidator` inputs for 73-3.
- 22 unit tests in `tests/morning-digest-extract-entities.test.mjs`; `bash scripts/verify.sh` passed.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/extract-entities.mjs` (new)
- `tests/morning-digest-extract-entities.test.mjs` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

### Change Log

- 2026-06-21: Story 73-2 — entity extraction pure functions + unit tests (Epic 73).
- 2026-06-21: Code review patches applied; strict GitHub URL parsing, post-push signal identity contract, finite score handling, and co-mention aggregation cleanup.
