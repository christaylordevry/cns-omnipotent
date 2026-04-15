# Story 12.5: Index manifest and drift signals

Status: done

<!-- Sprint tracker: epic-12 / 12-5-index-manifest-and-drift-signals. Add operator-visible manifest + freshness/drift signals for the on-demand Brain index build. No new MCP tools; no vector DB; keep artifacts outside the vault boundary by default. -->

## Story

As an **operator**,
I want **an index manifest and freshness signals**,
so that **I can detect stale vectors, failed embeds, and drift against the vault without a shipped UI**.

## Acceptance Criteria

1. **Manifest artifact (machine-readable, operator-facing)**
   **Given** an operator-triggered index build (Story 12.4) that produces `brain-index.json`
   **When** the build completes successfully
   **Then** a **machine-readable manifest** is written alongside the index artifact in the **same output directory**
   **And** the manifest includes (at minimum):
   - a **schema version**
   - build outcome: `success`
   - build timestamp in **UTC** (ISO 8601)
   - **allowlist snapshot** (normalized `subtrees`, `inbox.enabled`, `pake_types` if present, and `protected_corpora_opt_in` presence—never echo operator rationale verbatim if it risks leaking arbitrary text; include it only if already treated as safe elsewhere)
   - **embedder metadata** (provider/model identifiers) matching `BuildIndexResult.embedder`
   - counts: **candidates discovered**, **embedded**, **excluded**, **failed**
   - exclusion **reason breakdown** keyed by stable reason codes (e.g. `VAULT_BOUNDARY`, `FRONTMATTER_PARSE`, `PAKE_TYPE_FILTER`, secret exclusion reason code from 12.3, and any hard exclusions like `_meta/logs/**`)
   **And** the manifest does **not** include full note bodies, frontmatter dumps, or matched-secret substrings.

2. **Failure and partial-failure reporting**
   **Given** the build may encounter per-file exclusions and unexpected IO errors
   **When** the build finishes (successfully) with exclusions and/or non-fatal failures
   **Then** the manifest counts and breakdowns reflect those outcomes
   **And** any per-file failure details are **bounded** (cap list length; include only vault-relative path + reason code + sanitized detail fields)
   **And** details never include:
   - absolute host paths
   - raw secrets (or substrings that matched secret patterns)
   - full frontmatter/body excerpts

3. **A manifest is produced for a failed run**
   **Given** the operator-triggered entrypoint (Story 12.4 CLI) can fail before completion (invalid allowlist, output-dir inside vault, unexpected exception)
   **When** the run fails after vault root config is known and output dir is valid
   **Then** a manifest is still written with outcome `failed`
   **And** it includes a stable failure code and a short message suitable for operator debugging
   **And** it remains safe (no secret echoes, no full note bodies).

4. **Drift / freshness signals**
   **Given** an index build timestamp and a known effective corpus (allowlist-derived roots)
   **When** the build completes (success or failed-with-output)
   **Then** the manifest includes **drift signals** sufficient for operators to estimate staleness without a UI, at the fidelity defined here:
   - `vault_snapshot` summary containing:
     - `vault_root_realpath_hash` (or equivalent stable identifier derived from canonical vault root, but not the raw absolute path)
     - total markdown candidates discovered at time of run
     - `max_mtime_utc` across discovered candidates (UTC ISO string) and/or `max_mtime_ms` (number)
   - `freshness` section containing:
     - `last_build_utc`
     - `estimated_stale_count` = number of discovered candidates with mtime > build timestamp
     - `estimated_stale_sample` = up to N (e.g. 20) vault-relative paths with newest mtimes (paths only; no bodies)
   **And** canonical path and boundary rules match the Phase 1 / Story 12.4 posture (realpath first; skip/record boundary failures rather than reading outside vault).

5. **Stable schema and backwards compatibility**
   **Given** operators and future stories (12.6+) may consume manifest data
   **When** the manifest is serialized
   **Then** it uses a stable, versioned JSON schema (starting at `schema_version: 1`)
   **And** fields are designed so that future versions can extend without breaking consumers.

6. **Offline-verifiable test coverage**
   **Given** the repo verify gate
   **When** tests run
   **Then** coverage includes:
   - manifest written on success (alongside `brain-index.json`)
   - manifest written (with `failed`) for a representative failure case that still has a valid output dir
   - counts/breakdowns are correct for exclusions produced by existing gates (secret exclusion, `PAKE_TYPE_FILTER`, `FRONTMATTER_PARSE`, canonical boundary failures)
   - drift signal calculations are correct and do not require network access
   - serialization does **not** contain secret substrings when a candidate note includes secret-like text (mirror `build-index.test.ts` “no echo” assertions)
   **And** `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] **AC #1–#5:** Define a `BrainIndexManifest` schema/type (new module under `src/brain/`, versioned JSON).
- [x] **AC #1–#3:** Implement `serializeBrainIndexManifest()` with deterministic field ordering where practical (timestamps are allowed and expected to differ run-to-run; ordering should still be stable).
- [x] **AC #1–#3:** Implement `writeBrainIndexManifest(vaultRoot, outputDir, manifest)` that reuses `assertOutputDirOutsideVault` for canonical safety and writes atomically (tmp + rename).
- [x] **AC #1–#4:** Integrate manifest creation into the Story 12.4 CLI flow:
  - on success: write `brain-index.json` and `brain-index-manifest.json` (or `brain-index.manifest.json`; pick one and document)
  - on failure after output dir is validated: write a failed manifest
- [x] **AC #4:** Compute drift signals using only file metadata (`stat.mtimeMs`) and vault-relative paths; do not read note bodies for drift.
- [x] **AC #2:** Add bounded per-file failure summaries (cap list length; sanitize details).
- [x] **AC #6:** Add/extend tests under `tests/brain/` to cover manifest writing, schema shape, and safety (“no echo”), plus drift/freshness calculations.
- [x] **AC #6:** Run `bash scripts/verify.sh` and record the result in Dev Agent Record.
- [x] **Standing task — Operator guide:** Because this story adds new operator-visible artifacts (manifest + drift signals), update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` to document:
  - where the manifest lives relative to the output directory
  - what fields to inspect for “is my index stale?”
  - how to interpret “failed” vs “success with exclusions”

## Dev Notes

### Epic and program context

Story 12.5 is the operator’s visibility layer for the first executable Brain slice (12.4). The index build already produces `brain-index.json` outside the vault boundary; 12.5 adds a **manifest** that operators can inspect without a UI, aligned with charter expectations:

- allowlist snapshot
- build timestamp
- counts and exclusions breakdown
- drift/freshness estimates

This story must remain **read-only** with respect to the vault. It writes artifacts only to the operator-provided output directory (outside the vault boundary) and may read file metadata inside the vault under the same canonical boundary posture as 12.4.

### Technical requirements (guardrails)

- **Do not invent a new corpus discovery mechanism:** reuse `discoverMarkdownCandidates()` and `effectiveCorpusRoots()` from 12.4 so manifest counts match the same candidate set used for embedding.
- **No secrets / bodies in manifest:** treat manifest as operator-debug-friendly but safe. Path lists are acceptable; body excerpts are not.
- **Canonical boundary stays authoritative:** reuse `getRealVaultRoot` / `resolveReadTargetCanonical` posture for any file-system reads. For drift stats, prefer `stat` on canonicalized targets and record boundary failures rather than crashing.
- **Hard exclude stays hard:** `_meta/logs/**` remains excluded; ensure manifest breakdown can represent this exclusion reason explicitly (even if it does not appear in `BuildIndexResult.exclusions`).
- **Output directory must remain outside the vault:** reuse `assertOutputDirOutsideVault` and keep atomic writes (tmp + rename). Avoid following symlinks that would write into the vault.
- **No new MCP tool surface:** keep this in the CLI / pipeline modules only; do not register new tools.

### Architecture compliance

- TypeScript / Node, Vitest, existing repo patterns for safe path and error handling.
- Keep changes scoped to `src/brain/` + `tests/brain/` + operator documentation.

### File structure requirements

| Area | Expected touch |
|------|----------------|
| `src/brain/build-index.ts` | Extend result/serialization/writers or add companion manifest module |
| `src/brain/build-index-cli.ts` | Write manifest on success and on eligible failure paths |
| `src/brain/brain-index-manifest.ts` (new) | Manifest schema + serialization + drift computation helpers |
| `tests/brain/build-index.test.ts` | Extend to assert manifest behavior and safety |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Document manifest + freshness interpretation |

### Testing requirements

- Use temp vault fixtures (as in `tests/brain/build-index.test.ts`).
- Add at least one test proving drift count is non-zero when a file is touched after the build timestamp.
- Add at least one “no echo” test ensuring manifest JSON never contains secret-like substrings, mirroring existing secret-scan assertions.

### Previous story intelligence

From **12.4** ([Source: `_bmad-output/implementation-artifacts/12-4-minimal-embeddings-pipeline-operator-triggered.md`]):

- The index artifact is stable JSON with `schema_version: 1`, `embedder`, `records`, and `exclusions`.
- The candidate discovery and gate chain are already implemented in `src/brain/build-index.ts`; 12.5 should build manifest counts and drift signals from the same data so operators don’t see inconsistent numbers.

From the **charter** ([Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` — Observability and operations]):

- Operators need manifest + drift signals without a UI.
- Failure reporting must omit raw secrets and full note bodies.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 12, Story 12.5]
- [Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` — Observability and operations]
- [Source: `src/brain/build-index.ts`]
- [Source: `src/brain/build-index-cli.ts`]
- [Source: `tests/brain/build-index.test.ts`]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in the existing Brain/operator history section used by Stories 12.2 and 12.3.
- [ ] If no user-facing behavior changed: note **"Operator guide: no update required"** in Dev Agent Record.

### Review Findings

- [x] [Review][Patch] Avoid overwriting a successful `brain-index.json` with a zeroed failed manifest after post-artifact errors [`src/brain/build-index-cli.ts`]
- [x] [Review][Patch] Enforce capped, sanitized failure summaries at the manifest serialization boundary [`src/brain/brain-index-manifest.ts`]
- [x] [Review][Defer] Persist per-file index-time `mtimeMs` values for later consumer comparison [`src/brain/brain-index-manifest.ts`] — deferred by user after review; aggregate drift signals remain shipped in Story 12.5

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

 - `bash scripts/verify.sh` — PASS (2026-04-14)
 - `bash scripts/verify.sh` — PASS after review fixes (2026-04-14)

### Completion Notes List

 - Added `brain-index-manifest.json` alongside `brain-index.json`, including allowlist snapshot, embedder provider/model IDs, counts/breakdowns, bounded per-file failure summaries, and drift/freshness signals (metadata-only).
 - Ensured secret exclusion reason code is imported from `src/brain/indexing-secret-gate.ts` (`INDEXING_SECRET_EXCLUSION_REASON`) and never redefined.
 - Added tests for: manifest on success, failed manifest for invalid allowlist with valid output dir, drift/freshness calculations, and “no echo” secret safety.
 - Fixed review follow-up: a post-artifact manifest/drift failure no longer backfills a contradictory zero-count failed manifest over a successful index artifact path.
 - Fixed review follow-up: manifest serialization now re-applies failure-summary caps and sanitization so callers cannot bypass the safety contract with oversized or unsanitized `failures`.
 - Deferred follow-up: per-file index-time `mtimeMs` persistence for future consumer comparison remains backlog work by explicit user choice.
 - **`bash scripts/verify.sh`**: PASSED.

### File List

 - `src/brain/brain-index-manifest.ts`
 - `src/brain/build-index.ts`
 - `src/brain/build-index-cli.ts`
 - `tests/brain/build-index.test.ts`
 - `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
 - `_bmad-output/implementation-artifacts/12-5-index-manifest-and-drift-signals.md`
 - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

 - 2026-04-14 — Implemented index manifest + drift/freshness signals, added tests, and updated operator guide; set story to `review`.
 - 2026-04-14 — Applied code-review fixes for failure-manifest coherence and serializer-level failure sanitization; user deferred per-file `mtimeMs` persistence; set story to `done`.

