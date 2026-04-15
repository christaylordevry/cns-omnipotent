# Story 12.4: Minimal embeddings pipeline (operator-triggered)

Status: review

<!-- Sprint tracker: epic-12 / 12-4-minimal-embeddings-pipeline-operator-triggered. Deliver the first executable Brain index build as a bounded one-shot pipeline only: no scheduler, daemon, manifest UI, vector database, or new MCP tools unless an AC explicitly requires them (they do not). -->

## Story

As an **operator**,
I want **an on-demand index build with bounded scope and deterministic outputs**,
so that **I can refresh semantic retrieval without a shipped scheduler or daemon**.

## Acceptance Criteria

1. **Allowlist-backed corpus selection**
   **Given** the live allowlist file at `{vaultRoot}/_meta/schemas/brain-corpus-allowlist.json` and the validated contract in `src/brain/corpus-allowlist.ts`
   **When** the operator runs the documented single-shot trigger
   **Then** the pipeline loads that file from disk, validates it with `parseBrainCorpusAllowlist`, and derives the effective corpus roots from normalized `subtrees`
   **And** `inbox.enabled: true` is treated as explicit inclusion of `00-Inbox` even if it is not listed in `subtrees`
   **And** protected corpora remain opt-in only per the contract; there is no silent bypass of `AI-Context/**` or `_meta/**`
   **And** `_meta/logs/**` is never embedded in this story even if a broader `_meta` opt-in exists, because audit logs remain a hard exclusion in the charter.

2. **Canonical vault-boundary reads**
   **Given** candidate note files under the effective corpus roots
   **When** the pipeline resolves them for reading
   **Then** it applies the same canonical boundary posture as Phase 1 read paths by resolving the real vault root first and canonicalizing each candidate file before reading
   **And** symlink escapes or out-of-bound canonical paths are rejected or skipped with sanitized structured failures rather than embedded
   **And** only vault-relative POSIX-style paths are carried forward into pipeline records.

3. **Eligibility gates compose in a fixed order**
   **Given** a markdown note discovered under an allowlisted root
   **When** the pipeline evaluates whether it may be embedded
   **Then** it composes the gates in this order: allowlist root eligibility -> canonical read -> markdown/frontmatter parse -> optional `pake_types` filter -> secret exclusion gate -> embedding
   **And** notes whose frontmatter cannot be parsed are excluded from the embed set with sanitized structured failure data while the rest of the build continues
   **And** the secret gate uses the full serialized note text (frontmatter + body) through `evaluateNoteForEmbeddingSecretGate`
   **And** when `pake_types` is configured, notes with missing or non-matching `pake_type` values are excluded from the embed set rather than silently included
   **And** if `DailyNotes/**` is in scope, `## Agent Log` sections are excluded or stripped before embedding per the Brain charter.

4. **Bounded operator trigger and deterministic artifact**
   **Given** an operator-provided output directory outside the vault boundary and a defined corpus slice
   **When** the trigger runs on unchanged input with the same embedder behavior
   **Then** it writes machine-readable build artifact(s) outside the vault with deterministic record ordering and stable serialization
   **And** the artifact metadata includes the embedder/provider identifier used for the run
   **And** the trigger is explicitly one-shot only for this story: no cron, daemon, watcher, retry queue, or background service is added.

5. **Offline-verifiable test coverage**
   **Given** the repo verify gate
   **When** tests run
   **Then** coverage includes: allowlist file loading from a temp vault, `inbox.enabled` effective-root merge, `pake_types` filtering, canonical path enforcement including symlink escape rejection, secret-match exclusion, deterministic output ordering/serialization, and the operator trigger entrypoint
   **And** automated tests do not require live network access or provider credentials
   **And** `bash scripts/verify.sh` passes.

6. **Phase boundary for the first executable slice**
   **Given** later stories own manifest/freshness signals (`12.5`), retrieval API (`12.6`), ranking (`12.7`), and quarantine corpus policy (`12.8`)
   **When** this story completes
   **Then** deliverables are limited to the operator-triggered pipeline entrypoint, reusable Brain pipeline modules, deterministic output artifact(s), tests, and operator documentation needed to run it
   **And** there is still no new MCP tool registration, no vector database selection/deployment, no vault mutation path, and no operator UI shipped in this story.

## Tasks / Subtasks

- [x] **AC #1:** Add a disk-backed allowlist loader and effective-root helper in `src/brain/` that reads `{vaultRoot}/_meta/schemas/brain-corpus-allowlist.json`, delegates validation to `parseBrainCorpusAllowlist`, and merges `inbox.enabled` into the effective root set without changing the pure parser contract from 12.2.
- [x] **AC #1-#3:** Implement the core one-shot pipeline module in `src/brain/` that discovers candidate markdown notes, sorts them deterministically by vault-relative path, parses frontmatter via `parseNoteFrontmatter`, applies optional `pake_types` filtering, calls `evaluateNoteForEmbeddingSecretGate`, and hands only eligible note content to an embedder interface.
- [x] **AC #1-#3:** Enforce a hard exclude for `_meta/logs/**` and any equivalent audit-log sink paths defined by current repo conventions; this rule must survive broader protected-corpora opt-in and be covered by tests.
- [x] **AC #2:** Reuse existing read-boundary helpers (`getRealVaultRoot`, `resolveReadTargetCanonical`) instead of inventing new filesystem safety code; sanitize any structured failures so they do not echo secret material or absolute path noise beyond existing repo norms.
- [x] **AC #3:** Decide and implement the `DailyNotes` handling path required by the charter. Preferred default: strip `## Agent Log` sections before embedding while preserving the original raw note text for secret scanning earlier in the pipeline.
- [x] **AC #4:** Add the operator trigger. Preferred shape: an npm script (for example `brain:index`) that invokes a one-shot CLI entry such as `tsx src/brain/build-index-cli.ts --output-dir <abs-path>` and loads `CNS_VAULT_ROOT` via `loadRuntimeConfig`.
- [x] **AC #4:** Write deterministic artifact(s) outside the vault boundary only. A minimal JSON artifact is acceptable for this story if it contains stable ordering, vault-relative source paths, and embedder/provider metadata needed for later stories; do not introduce a production vector store yet.
- [x] **AC #4-#5:** Keep provider selection behind a small interface. If a live provider adapter is implemented in this story, prefer Node 20 built-ins (`fetch`, `parseArgs`) over new SDK dependencies, and keep tests fully stubbed/offline.
- [x] **AC #5:** Add focused tests under `tests/brain/` covering allowlist file IO, inbox merge behavior, `pake_types` filtering, canonical read boundary behavior, secret exclusion reuse, deterministic artifact output, and CLI/operator trigger behavior.
- [x] **AC #5:** Run `bash scripts/verify.sh` and record the result in Dev Agent Record.
- [x] **AC #6:** Confirm `src/index.ts` and `src/register-vault-io-tools.ts` remain unchanged for tool surface. Do not add scheduler code, manifest/freshness UI, or retrieval-query APIs in this story.
- [x] **Standing task — Operator guide:** Because this story introduces an operator-visible trigger and output location, update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (Section 13 or adjacent Brain section), bump `modified`, and add a Version History row describing how to run the one-shot index build and where artifacts are expected to live.

## Dev Notes

### Epic and program context

Epic 12 is the first executable Brain slice after the planning-first charter and contract stories. Story **12.2** established the operator-facing allowlist semantics and the live vault path `_meta/schemas/brain-corpus-allowlist.json`. Story **12.3** established the non-throwing secret gate for indexing. This story is the first place those pieces are composed into an actual build path:

- allowlist / effective roots
- canonical disk read
- frontmatter / `pake_type` eligibility
- secret exclusion
- embedding
- deterministic artifact write

Cross-story scope discipline:

- **12.5** will own manifest/freshness/drift reporting, so keep any 12.4 artifact minimal and execution-focused.
- **12.6** will own read-only query semantics, so 12.4 should not invent a public retrieval API.
- **12.7** and **12.8** own quality weighting and quarantine-corpus behavior; do not smuggle ranking heuristics or Nexus-specific secondary corpora into 12.4.

### Technical requirements (guardrails)

- **Vault root authority:** use `loadRuntimeConfig` / `CNS_VAULT_ROOT` as the vault boundary authority; do not introduce a Brain-specific root rule.
- **Allowlist reuse:** treat `parseBrainCorpusAllowlist` as authoritative for normalization and protected-path policy. Add a small loader/helper around it rather than duplicating validation logic.
- **Audit logs stay out:** even with protected-corpora opt-in, `_meta/logs/**` remains a hard exclusion for 12.4 per the charter. Do not let the allowlist broaden into raw audit-log ingestion.
- **Canonical reads only:** reuse `getRealVaultRoot` and `resolveReadTargetCanonical` from `src/read-boundary.ts` for all filesystem reads. Do not read lexical paths directly from recursive traversal results.
- **Markdown-only scope for 12.4:** keep the first pipeline bounded to markdown notes; unsupported/binary files should be skipped deterministically rather than partially parsed. This closes one of the charter’s deferred implementation questions without broadening scope.
- **Frontmatter parsing:** use `parseNoteFrontmatter` for `pake_type` inspection instead of ad hoc YAML parsing.
- **Malformed frontmatter policy:** if frontmatter parsing fails, exclude the note with sanitized structured failure data and continue the build; do not crash the whole run on one bad note.
- **Secret scan order matters:** pass the full raw note text (including frontmatter) to `evaluateNoteForEmbeddingSecretGate` before any content sent to the embedder. Excluded notes may surface only sanitized reason data, never body excerpts.
- **DailyNotes safety:** if `DailyNotes` is included, exclude or strip `## Agent Log` sections before the embedding call. Do not strip before secret scanning; the secret gate should still see the original full note text.
- **Artifacts live outside the vault:** the charter is explicit that index artifacts stay outside `Knowledge-Vault-ACTIVE/` by default. If the operator points the output directory inside the vault, fail fast or reject it rather than silently writing there.
- **Determinism:** sort effective roots and candidate note records lexically by vault-relative POSIX path. Serialize artifacts in a stable field order; re-use the repo’s existing stable-JSON pattern if helpful.
- **Provider abstraction:** no embedding provider is pinned anywhere in repo context. Keep provider-specific network logic behind a small interface and make verify/test coverage independent of live credentials or external network.
- **No hidden Nexus heuristics:** there is still no reliable Nexus-origin detection signal in current repo code. Do not invent one in 12.4; keep handling limited to explicit allowlist and `pake_type` semantics.

### Architecture compliance

- **Stack:** TypeScript on Node `>=20`, existing test/lint/typecheck pipeline, existing `gray-matter` frontmatter parsing, existing Zod-based allowlist contract.
- **Recommended module split:**
  - `src/brain/load-corpus-allowlist.ts` (or similar): live file load + parse + effective roots
  - `src/brain/build-index.ts` (or similar): core pipeline orchestration
  - `src/brain/embedder.ts` (or similar): small provider interface / adapter
  - `src/brain/build-index-cli.ts` (or similar): operator trigger entrypoint
- **Operator entrypoint:** prefer a package script over a new MCP tool for this story.
- **No Phase 1 normative drift:** do not modify `specs/cns-vault-contract/` for 12.4 unless a separate approved story requires it.

### Library and framework requirements

- **No new vector database dependency** in 12.4.
- **Prefer existing repo primitives**: `parseNoteFrontmatter`, `evaluateNoteForEmbeddingSecretGate`, `parseBrainCorpusAllowlist`, `read-boundary.ts`.
- **If a live provider adapter is added**, prefer Node 20 built-ins (`fetch`, `parseArgs`) before adding an SDK dependency solely for the first operator-triggered slice.

### File structure requirements

| Area | Expected touch |
|------|----------------|
| `src/brain/corpus-allowlist.ts` | Reuse; only extend if a tiny export is needed for effective-root helpers |
| `src/brain/indexing-secret-gate.ts` | Reuse as-is for secret eligibility |
| `src/brain/*.ts` | New pipeline, loader, CLI, and embedder modules |
| `src/pake/parse-frontmatter.ts` | Reuse for `pake_type` inspection |
| `package.json` | Add documented operator trigger script if needed |
| `tests/brain/**` | New/extended tests for pipeline and CLI |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Update operator-facing Brain workflow |
| `src/index.ts`, `src/register-vault-io-tools.ts` | **No changes** |

### Testing requirements

- Use temp vault fixtures so tests exercise the live allowlist file path `_meta/schemas/brain-corpus-allowlist.json`, not just the pure parser.
- Include at least one symlink-escape or canonical-boundary regression test reusing the same trust model as Phase 1 read tools.
- Verify `inbox.enabled` contributes `00-Inbox` to effective roots even without an explicit subtree entry.
- Verify `_meta/logs/**` is excluded even when `_meta` is allowlisted with valid opt-in.
- Verify malformed frontmatter produces deterministic sanitized exclusion/failure behavior without aborting the whole build.
- Verify `pake_types` exclusion for missing / non-matching `pake_type`.
- Verify secret-matching notes are excluded without leaking matched substrings in serialized results.
- Verify deterministic artifact ordering and stable serialization with a fake embedder.
- Verify CLI/operator trigger rejects or safely handles an output directory inside the vault boundary.
- Run `bash scripts/verify.sh`.

### Previous story intelligence

From **12.3** ([Source: `_bmad-output/implementation-artifacts/12-3-secret-scan-enforcement-for-indexing.md`]):

- 12.4 must compose: **allowlist eligibility -> canonical read -> frontmatter / `pake_type` evaluation -> secret gate -> embed**.
- Secret eligibility uses the **same full-note string** shape as WriteGate scanning; do not switch to body-only text.
- The secret gate already provides a stable exclusion reason for future manifest accounting; reuse it, do not fork it.
- Story 12.3 is `done` in sprint tracking; treat `evaluateNoteForEmbeddingSecretGate` as the stable dependency for 12.4.

From **12.2** ([Source: `_bmad-output/implementation-artifacts/12-2-brain-corpus-allowlist-contract.md`]):

- The live operator file path is `_meta/schemas/brain-corpus-allowlist.json`.
- `inbox.enabled` is explicit operator intent and must merge into effective roots in 12.4.
- Keep `src/brain/` as the implementation namespace; the parser is intentionally pure and should stay decoupled from vault-root IO.

From **12.1** / the charter ([Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md`]):

- Index artifacts belong **outside the vault** by default.
- `DailyNotes` may be included, but `## Agent Log` sections must be stripped/excluded before embedding.
- Earlier review intentionally deferred non-markdown file scope, concurrent mutation during index build, Nexus-origin detection, and manifest model-version handling. 12.4 should solve only the first of those by staying markdown-only and may include embedder/provider metadata in the artifact to avoid silent ambiguity.

### Git intelligence summary

Recent `master` commits are repo-maintenance and workflow updates (`3756ae9`, `5937761`, `0769b49`). The live Brain implementation footprint is currently small (`src/brain/corpus-allowlist.ts`, `src/brain/indexing-secret-gate.ts`, and matching tests), so 12.4 should extend that namespace directly instead of creating a parallel subsystem.

### Latest technical information

`package.json` already provides what 12.4 needs for the first slice:

- Node `>=20`
- `gray-matter` for frontmatter parsing
- `zod` for contract validation
- `vitest` for offline unit tests

No embedding SDK or provider package exists in repo today. Favor built-in platform capabilities and keep provider wiring thin.

### Project context reference

No `project-context.md` exists in repo. Use this story, `CLAUDE.md`, `specs/cns-vault-contract/modules/security.md`, and the Brain charter / allowlist contract as the context bundle.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 12, Story 12.4]
- [Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md`]
- [Source: `_bmad-output/planning-artifacts/brain-corpus-allowlist-contract.md`]
- [Source: `_bmad-output/implementation-artifacts/12-1-brain-service-scope-charter-phase-21.md`]
- [Source: `_bmad-output/implementation-artifacts/12-2-brain-corpus-allowlist-contract.md`]
- [Source: `_bmad-output/implementation-artifacts/12-3-secret-scan-enforcement-for-indexing.md`]
- [Source: `src/brain/corpus-allowlist.ts`]
- [Source: `src/brain/indexing-secret-gate.ts`]
- [Source: `src/pake/parse-frontmatter.ts`]
- [Source: `src/read-boundary.ts`]
- [Source: `src/config.ts`]
- [Source: `src/audit/audit-logger.ts`]
- [Source: `package.json`]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in the existing Brain/operator history section used by Stories 12.2 and 12.3.
- [ ] If no user-facing behavior changed: note **"Operator guide: no update required"** in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5.4 (Cursor agent) — `bmad-create-story` (story draft) and `bmad-dev-story` (implementation).

### Debug Log References

### Completion Notes List

- Story context prepared: ultimate context engine analysis completed — comprehensive developer guide created for the first executable Brain index-build slice.
- Implemented disk allowlist loader (`load-corpus-allowlist.ts`), path helpers (`brain-path-utils.ts`), stub embedder interface (`embedder.ts`), pipeline + deterministic JSON artifact (`build-index.ts`), and CLI (`build-index-cli.ts`) with `npm run brain:index`.
- Gates: canonical read via `getRealVaultRoot` / `resolveReadTargetCanonical`, frontmatter parse, optional `pake_types`, full-note secret gate, DailyNotes `## Agent Log` strip before embed; hard `_meta/logs/**` exclusion in discovery; symlink-to-file discovery + boundary rejection covered by tests.
- **`bash scripts/verify.sh`:** PASSED (2026-04-14).
- Standing operator-guide task: user-facing workflow added; `CNS-Operator-Guide.md` Section 13 updated (not the “no update required” path).

### File List

- `src/brain/load-corpus-allowlist.ts`
- `src/brain/brain-path-utils.ts`
- `src/brain/embedder.ts`
- `src/brain/build-index.ts`
- `src/brain/build-index-cli.ts`
- `tests/brain/build-index.test.ts`
- `package.json`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/12-4-minimal-embeddings-pipeline-operator-triggered.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-14 — Story 12.4 created and sprint status advanced to `ready-for-dev`.
- 2026-04-14 — Implemented operator-triggered Brain index pipeline, tests, operator guide update, sprint status `review`.
