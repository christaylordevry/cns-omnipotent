# Story 12.3: Secret scan enforcement for indexing

Status: done

<!-- Sprint tracker: epic-12 / 12-3-secret-scan-enforcement-for-indexing. Delivers reusable indexing-time secret classification aligned with WriteGate; no embeddings pipeline or MCP tools unless AC explicitly require wiring (they do not). -->

## Story

As a **maintainer**,
I want **never-embed exclusion when secret patterns match, with tests and non-leaking errors**,
so that **Brain indexing does not amplify accidental secret material in the vault**.

## Acceptance Criteria

1. **Alignment with WriteGate scanning scope**  
   **Given** the same conceptual scope as WriteGate secret scanning — **full serialized note text** (YAML frontmatter string values and body), aligned with `config/secret-patterns.json` merged with optional `{vaultRoot}/_meta/schemas/secret-patterns.json` per existing merge rules  
   **When** Brain code evaluates whether note content may be embedded  
   **Then** the evaluation uses the **same merged pattern set** as `assertVaultWriteContentNoSecretPatterns` ([Source: `src/secrets/load-patterns.ts`], [Source: `src/secrets/scan.ts`]).

2. **Exclusion without amplification**  
   **Given** a note whose full text matches at least one compiled pattern  
   **When** the indexing gate runs  
   **Then** the outcome is **exclude from embed set** (not a thrown write error)  
   **And** the reason is **classifiable** for logging and manifests (e.g. a stable reason code plus `patternId` from pattern config)  
   **And** **no** API surface echoes matched substrings, file bodies, or secret-like material in messages or structured fields (same NFR as [Source: `specs/cns-vault-contract/modules/security.md`] and existing secret-scan tests).

3. **Non-match path**  
   **Given** content that matches no configured patterns  
   **When** the indexing gate runs  
   **Then** the outcome indicates the content **may proceed** toward embedding (subject to allowlist and future pipeline gates in 12.4+).

4. **Automated tests**  
   **Given** representative fixtures  
   **When** tests run  
   **Then** they cover: **match** (exclude + `patternId` present), **non-match** (allow), and **boundary** cases consistent with [Source: `tests/vault-io/secret-scan.test.ts`] (e.g. secret-like value in YAML frontmatter, body-only hit)  
   **And** assertions prove matched material is not present in error strings or serialized details.

5. **Verification gate**  
   **Given** the repo verify script  
   **When** `bash scripts/verify.sh` runs  
   **Then** it passes.

6. **Phase boundary**  
   **Given** Story 12.4 will implement the operator-triggered pipeline  
   **When** this story completes  
   **Then** **no** embedding pipeline, vector store, index manifest, or new MCP tool registration ships; deliverables are shared scanning/indexing gate logic (and minimal refactor in `src/secrets/` if needed), tests, and optional short documentation cross-links — **unless** an AC explicitly requires a doc update.

## Tasks / Subtasks

- [x] **AC #1–#3:** Implement an **async** API suitable for indexing (e.g. `vaultRoot` + full note string → structured allow/exclude result) that **reuses** `loadMergedSecretPatterns` and shares core matching logic with `assertContentMatchesNoSecretPatterns` without duplicating regex loops in two divergent ways. Prefer extracting a small **pure** helper (e.g. first matching `patternId` or `null`) used by both the **throwing** write path and the **non-throwing** indexing path to avoid drift.
- [x] **AC #2:** Define stable machine-facing codes for “excluded due to secret pattern” suitable for Story 12.5 manifest reason breakdown later (string union or const object; document in Dev Notes).
- [x] **AC #4:** Add tests under `tests/brain/` and/or `tests/secrets/` using temp vault roots where vault override merge behavior must be exercised (mirror patterns from `secret-scan.test.ts`).
- [x] **AC #5:** Run `bash scripts/verify.sh` and record in Dev Agent Record.
- [x] **AC #6:** Confirm no change to MCP tool registration or Phase 1 Vault IO tool semantics unless an AC requires it (it does not). If `assertVaultWriteContentNoSecretPatterns` is refactored, preserve existing write-time behavior and keep `tests/vault-io/secret-scan.test.ts` green.
- [x] **Standing task — Operator guide:** If operators need to know that secret-pattern matches exclude notes from embeddings (recommended: one short bullet): update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (Section 13 or adjacent Brain subsection), bump `modified` and Version History; otherwise document **“Operator guide: no update required”** with rationale in Dev Agent Record.

## Dev Notes

### Epic and program context

Epic 12 builds semantic retrieval on top of PAKE. **12.2** delivered `parseBrainCorpusAllowlist` and documented `_meta/schemas/brain-corpus-allowlist.json`. **12.3** adds the **secret gate** that applies to **note content** inside an allowlisted path: a file can pass corpus rules yet still must not be embedded if it contains credential-shaped material. **12.4** will load files from disk and should call this gate on the **same full-note string** representation used for WriteGate scanning (frontmatter + body).

Cross-story dependency:

- **12.4** must compose: allowlist eligibility → read/normalize note → **this story’s gate** → embed.

### Technical requirements (guardrails)

- **Do not fork pattern lists:** Indexing must use `loadMergedSecretPatterns(vaultRoot)` — not a duplicate JSON load path.
- **Distinguish write vs index semantics:** Writes throw `CnsError` `SECRET_PATTERN`; indexing **returns** an exclusion result. Do not misuse throw/catch for control flow in hot paths unless profiling shows it is negligible; a **return-based** first-match scan is preferred.
- **Content shape:** Accept the **full markdown note string** (including `---` frontmatter block) as the scan input, matching [Source: `src/tools/vault-create-note.ts`] / [Source: `src/tools/vault-update-frontmatter.ts`] secret scan call sites.
- **No Phase 1 normative drift:** Do not change `specs/cns-vault-contract/` unless a separate story requires it; prefer `src/` + tests + optional planning artifact pointer (same pattern as 12.2).

### Architecture compliance

- **Stack:** TypeScript, Vitest, existing secrets module ([Source: `src/secrets/`]).
- **Module placement:** Implement Brain-facing entry in `src/brain/` (e.g. `indexing-secret-gate.ts` or similar) that **calls into** `src/secrets/`; keep `src/secrets/scan.ts` as the home for shared primitive if extracted.
- **Errors:** Indexing gate returns structured data; if helpers throw only on **config IO** failures (`loadMergedSecretPatterns` / invalid vault override JSON), that is acceptable and consistent with write path behavior when patterns cannot be loaded.

### Library and framework requirements

- **None new.** Use existing regex compilation from `loadMergedSecretPatterns`.

### File structure requirements

| Area | Expected touch |
|------|----------------|
| `src/secrets/scan.ts` (or adjacent) | Optional: extract shared `findFirstSecretPatternMatch` (or similar) used by write + index |
| `src/brain/*.ts` | New: public API for “eligible for embed from secret perspective” |
| `tests/brain/**` and/or `tests/secrets/**` | New or extended tests |
| `src/register-vault-io-tools.ts` | **No** changes |

### Testing requirements

- Mirror the **no echo** guarantees from [Source: `tests/vault-io/secret-scan.test.ts`]: check `message` and `details` / JSON serialization for absent secret substrings.
- Include at least one test with **vault override** under `_meta/schemas/secret-patterns.json` proving merge behavior matches write path expectations.

### Previous story intelligence

From **12.2** ([Source: `_bmad-output/implementation-artifacts/12-2-brain-corpus-allowlist-contract.md`]):

- Allowlist parser returns structured issues without echoing config secrets — apply the **same discipline** to indexing exclusion results.
- `src/brain/corpus-allowlist.ts` establishes the `src/brain/` namespace; add new files alongside rather than coupling secret scanning into the allowlist parser.
- 12.2 updated the operator guide because `_meta/schemas/brain-corpus-allowlist.json` was normative; if this story makes secret exclusion **operator-visible**, add a concise Brain subsection bullet.

From **12.1** ([Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md`] — Security):

- Charter requires policies for **secret-bearing notes** so they are not embedded or are excluded; this story implements **pattern-based exclusion** consistent with that intent.

### Git intelligence summary

Recent commits on `master` are documentation/symlink fixes (`3756ae9`, `5937761`); no conflicting Brain work. **12.2** landed `src/brain/corpus-allowlist.ts` and `tests/brain/` — follow the same verify and test layout patterns.

### Latest technical information

No new npm packages. Regex behavior follows existing `m` flag compilation in [Source: `src/secrets/load-patterns.ts`] (`new RegExp(p.regex, "m")`).

### Project context reference

No `project-context.md` in repo. Use this story, [Source: `CLAUDE.md`], [Source: `specs/cns-vault-contract/modules/security.md`], and the Brain charter.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 12, Story 12.3]
- [Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` — Security, secret-bearing notes]
- [Source: `_bmad-output/planning-artifacts/brain-corpus-allowlist-contract.md`]
- [Source: `_bmad-output/implementation-artifacts/12-2-brain-corpus-allowlist-contract.md`]
- [Source: `src/secrets/scan.ts`]
- [Source: `src/secrets/load-patterns.ts`]
- [Source: `config/secret-patterns.json`]
- [Source: `tests/vault-io/secret-scan.test.ts`]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note **“Operator guide: no update required”** in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Cursor Agent — BMAD dev-story workflow (2026-04-13).

### Debug Log References

### Completion Notes List

- Extracted `findFirstMatchingSecretPatternId` in `src/secrets/scan.ts`; `assertContentMatchesNoSecretPatterns` delegates to it (write path unchanged; `secret-scan.test.ts` green).
- Added `src/brain/indexing-secret-gate.ts` with async `evaluateNoteForEmbeddingSecretGate(vaultRoot, fullNoteText)` using `loadMergedSecretPatterns` + shared matcher; stable `INDEXING_SECRET_EXCLUSION_REASON` (`EXCLUDED_SECRET_PATTERN`) and `patternId` on exclude; allow path `{ eligible: true }`.
- Tests: `tests/brain/indexing-secret-gate.test.ts` (match, non-match, YAML frontmatter, body-only, vault override merge + no-echo JSON).
- Operator guide §13 + Version History 1.2.0 (Brain secret-pattern exclusion from embeddings).
- Verification: `bash scripts/verify.sh` passed (2026-04-13); re-run passed (2026-04-14).

### File List

- `src/secrets/scan.ts`
- `src/brain/indexing-secret-gate.ts`
- `tests/brain/indexing-secret-gate.test.ts`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/12-3-secret-scan-enforcement-for-indexing.md`

### Change Log

- 2026-04-13 — Story 12.3: indexing secret gate API, shared scan helper, tests, operator guide; sprint status → review.
- 2026-04-14 — Sprint tracker: `12-3-secret-scan-enforcement-for-indexing` marked `done` after verify gate green (`bash scripts/verify.sh`).
