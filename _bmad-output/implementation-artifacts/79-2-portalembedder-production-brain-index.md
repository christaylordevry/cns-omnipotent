---
baseline_commit: 024b480d158c6aedbbfb09d370e8c31727ec1935
---

# Story 79-2: PortalEmbedder + production Brain index

Status: done

## Story

As an **operator**,
I want **real Portal `/embeddings` vectors in the Brain index with secret-gate and allowlist enforcement**,
so that **semantic recall returns meaningful scores instead of StubEmbedder fake vectors (FR16, NFR3, NFR-GOV-2)**.

**Zone/Repo:** Omnipotent.md · `src/brain/`, `config/brain-corpus-allowlist.json`, `tests/brain/` · **Branch:** `hermes-consolidation`

## Acceptance Criteria

1. **Context7 Portal embeddings (AC: context7, NFR7)**
   - **Given** Context7 docs for Nous Portal `/embeddings` fetched before implement
   - **When** implementation begins
   - **Then** `PortalEmbedder` uses OpenAI-compatible `POST /v1/embeddings` via Hermes subscription proxy allowed path

2. **PortalEmbedder + index build (AC: embedder)**
   - **When** `PortalEmbedder` implements `Embedder` and `npm run brain:index` runs with `CNS_BRAIN_EMBEDDER=portal`
   - **Then** indexed vectors are non-stub (`providerId: portal`, model in manifest) with `freshness.last_build_utc`

3. **Secret gate + allowlist (AC: nfr-gov-2)**
   - **And** `indexing-secret-gate.ts` excludes protected paths; spot-check paths verified in tests

4. **Query smoke (AC: query)**
   - **And** `npm run brain:query` returns ranked vault paths with scores on ≥3 smoke queries (mocked Portal integration test)

5. **Incremental rebuild docs (AC: nfr-recall-2)**
   - **And** incremental rebuild path documented (cron 15–30 min) + on-demand session-close hook note

6. **Reversibility (AC: nfr5)**
   - **And** embedder behind `CNS_BRAIN_EMBEDDER` env flag — revert to StubEmbedder without vault mutation

7. **Tests + verify (AC: nfr1, nfr-pkg-1)**
   - **And** `tests/brain/portal-embedder.test.ts` passes; no new packages
   - **And** `bash scripts/verify.sh` passes

## Tasks / Subtasks

- [x] **Context7 Hermes Portal embeddings docs** (AC: context7)
  - [x] `resolve-library-id` + `query-docs` on `/nousresearch/hermes-agent` — subscription proxy `/v1/embeddings` allowed path

- [x] **PortalEmbedder implementation** (AC: embedder)
  - [x] `src/brain/embedder-portal.ts` — OpenAI-compatible POST `/embeddings`
  - [x] `src/brain/resolve-embedder.ts` — `CNS_BRAIN_EMBEDDER=stub|portal` factory

- [x] **Wire CLIs** (AC: embedder, nfr5)
  - [x] `build-index-cli.ts` + `query-index-cli.ts` use `resolveBrainEmbedder()` (fixes deferred 12-6 CLI mismatch)

- [x] **Secret-gate spot checks** (AC: nfr-gov-2)
  - [x] AWS secret pattern exclusion
  - [x] `_meta/logs/**` hard exclude
  - [x] `AI-Context/AGENTS.md` excluded without protected opt-in

- [x] **Incremental rebuild documentation** (AC: nfr-recall-2)
  - [x] `src/brain/references/incremental-rebuild.md`

- [x] **Tests** (AC: query, nfr1)
  - [x] `tests/brain/portal-embedder.test.ts`
  - [x] `tests/brain/portal-embedder-secret-gate-spotcheck.test.ts`

- [x] **Verify gate** (AC: nfr1)
  - [x] `bash scripts/verify.sh` passes

### Review Findings

- [x] [Review][Patch] Enforce query embedder compatibility with the index embedder [src/brain/query-index-cli.ts:87]
- [x] [Review][Patch] Add a timeout or abort boundary for Portal embedding requests [src/brain/embedder-portal.ts:52]
- [x] [Review][Patch] Isolate per-note Portal embedding failures instead of failing the full build [src/brain/build-index.ts:295]
- [x] [Review][Patch] Record and validate vector dimension for Portal index artifacts [src/brain/brain-index-manifest.ts:66]
- [x] [Review][Patch] Make the `AI-Context/AGENTS.md` protected-path spot check exercise the protected allowlist gate [tests/brain/portal-embedder-secret-gate-spotcheck.test.ts:66]

## Dev Notes

### Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CNS_BRAIN_EMBEDDER` | `stub` | `stub` or `portal` |
| `CNS_BRAIN_EMBED_BASE_URL` | `http://127.0.0.1:8645/v1` | Hermes proxy base |
| `CNS_BRAIN_EMBED_MODEL` | (required for portal) | Portal embedding model id |
| `CNS_BRAIN_EMBED_API_KEY` | `unused` | Bearer for proxy (any value OK) |

### Context7

Hermes subscription proxy forwards `/v1/embeddings` for Nous Portal (`/nousresearch/hermes-agent` subscription-proxy docs).

### References

- `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` — Story 79-2
- `_bmad-output/implementation-artifacts/74-1-brain-embedder-audit-report.md` — preconditions
- `src/brain/references/incremental-rebuild.md` — cron / session-close notes

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor), 2026-06-26

### Implementation Plan

- Drop-in `PortalEmbedder` on existing `Embedder` interface (Story 12.4).
- Env-selected factory preserves stub default for NFR5 reversibility.
- Both CLIs share `resolveBrainEmbedder()` — query adapter matches index build (74-1 precondition #3).
- Incremental engine deferred; operator doc covers cron 15–30 min + session-close hook for Story 79-5.

### Debug Log References

- `bash scripts/verify.sh` — PASS (2026-06-26)
- `npm run test:vitest -- tests/brain/portal-embedder*.ts` — 15/15 pass
- `npm run test:vitest -- tests/brain` — 85/85 pass (2026-06-26 review fixes)
- `bash scripts/verify.sh` — PASS (2026-06-26 review fixes)

### Completion Notes List

- Added `PortalEmbedder` calling `POST {baseUrl}/embeddings` with OpenAI-compatible JSON.
- Added `resolveBrainEmbedder()` — default stub; portal mode requires `CNS_BRAIN_EMBED_MODEL`.
- Wired `brain:index` and `brain:query` CLIs to shared embedder resolution.
- Documented incremental rebuild cadence in `src/brain/references/incremental-rebuild.md`.
- Secret-gate spot checks: AWS pattern, `_meta/logs/**`, `AI-Context/AGENTS.md` without opt-in.
- Integration test: mocked Portal vectors, 3 smoke queries return ranked paths with scores.

### File List

- `src/brain/embedder-portal.ts`
- `src/brain/resolve-embedder.ts`
- `src/brain/references/incremental-rebuild.md`
- `src/brain/build-index-cli.ts`
- `src/brain/query-index-cli.ts`
- `tests/brain/portal-embedder.test.ts`
- `tests/brain/portal-embedder-secret-gate-spotcheck.test.ts`
- `_bmad-output/implementation-artifacts/79-2-portalembedder-production-brain-index.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-26: Story 79-2 — PortalEmbedder, env embedder selection, CLI wiring, tests, incremental rebuild docs.
