# Story 12.2: Brain corpus allowlist contract

Status: done

<!-- Sprint tracker: epic-12 / 12-2-brain-corpus-allowlist-contract. Delivers operator-facing allowlist semantics + machine validation; no indexer execution or MCP tools in this story unless AC explicitly require wiring (they do not). -->

## Story

As a **maintainer**,
I want **an operator-editable allowlist file and validation rules for corpora selection**,
so that **indexing stays within explicit subtree and optional `pake_type` boundaries and never silently ingests protected classes**.

## Acceptance Criteria

1. **Charter alignment (paths and defaults)**  
   **Given** the Phase 2.1 Brain charter default include / exclude corpus classes, all expressed relative to `CNS_VAULT_ROOT`  
   **When** the allowlist contract is read (human doc + machine schema)  
   **Then** permitted subtrees and optional `pake_type` filters map cleanly to those classes (see charter “Candidate corpora” and “Default exclude candidates”)  
   **And** `00-Inbox/**` is never implied as included unless the operator explicitly enables an inbox flag or subtree entry (charter: inbox is opt-in only).

2. **Protected paths: no silent bypass**  
   **Given** `AI-Context/**` and `_meta/**` are default-exclude per charter  
   **When** an allowlist configuration is validated  
   **Then** including those subtrees (or glob equivalents) is rejected unless a dedicated explicit opt-in block is present (for example boolean plus non-empty operator rationale / acknowledgement field—exact shape defined in the contract doc)  
   **And** the contract doc states that opt-in must remain operator-visible and auditable (design intent; no Vault IO audit in this story).

3. **Single authoritative configuration shape**  
   **Given** operators need one place to express corpus rules  
   **When** they author JSON (recommended, to match `config/secret-patterns.json` patterns)  
   **Then** the contract specifies required fields, optional fields, defaults, and normalization rules (leading/trailing slashes, no `..` segments, no absolute filesystem paths—vault-relative POSIX-style paths only).

4. **Invalid-configuration handling**  
   **Given** malformed or policy-violating input  
   **When** the validator runs  
   **Then** failures are structured (discriminated error codes or issue list suitable for logging) and **must not** echo secret-like material from file contents  
   **And** validators distinguish: JSON parse errors, schema shape errors, and policy violations (protected path without opt-in, empty allowlist where forbidden, contradictory includes/excludes if such rules exist).

5. **Automated verification**  
   **Given** this story may add code and schema artifacts  
   **When** `bash scripts/verify.sh` runs  
   **Then** it passes (new unit tests included in the existing npm test pipeline).

6. **Phase boundary**  
   **Given** Epic 12.4+ will build the actual indexer  
   **When** this story completes  
   **Then** **no** embedding pipeline, vector store, or new MCP tool registration ships; deliverables are contract documentation, schema/types, parse/validate API, fixtures, and tests only.

## Tasks / Subtasks

- [x] **AC #1–#3:** Publish human contract under `_bmad-output/planning-artifacts/` (filename should clearly match story intent, e.g. `brain-corpus-allowlist-contract.md`) linking back to [Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` — Candidate corpora, Protected paths, Index artifact placement].
- [x] **AC #2–#4:** Implement Zod schemas and a `parseBrainCorpusAllowlist` (or equivalent) entry point following the house style in [Source: `src/secrets/pattern-config.ts`], [Source: `src/secrets/load-patterns.ts`] (parse JSON → `safeParse` → typed errors).
- [x] **AC #3:** Add operator-facing example JSON under `config/` (e.g. `brain-corpus-allowlist.example.json`) that mirrors charter **default include** posture for a typical vault; add at least one **negative** fixture for tests only (invalid / policy violation).
- [x] **AC #4–#5:** Add focused tests under `tests/` (new file or subdirectory) covering: valid minimal config, valid config with optional `pake_type` filter, protected path rejection without opt-in, protected path acceptance **only** when opt-in block is complete, path normalization and rejection of `..` / absolute paths.
- [x] **AC #5:** Run `bash scripts/verify.sh` and record outcome in Dev Agent Record.
- [x] **AC #6:** Confirm `src/index.ts` / `register-vault-io-tools.ts` unchanged for tool surface; no new dependencies unless justified and kept minimal (Zod already present).
- [x] **Standing task — Operator guide:** If the contract defines a vault-resident path for the live allowlist (e.g. under `_meta/schemas/`), document it in the contract doc and decide whether `03-Resources/CNS-Operator-Guide.md` needs a short pointer; if repo-only for now, note **“Operator guide: no update required”** or the opposite in Dev Agent Record with rationale.

### Review Findings

- [x] [Review][Patch] Inbox default is documented/exampled but not enforced in the parsed contract, so omitted `inbox` yields `undefined` instead of a canonical `{ enabled: false }` default. [src/brain/corpus-allowlist.ts:11-17]

## Dev Notes

### Epic and program context

Epic 12 adds semantic retrieval on top of PAKE. Story **12.1** published the Phase 2.1 charter and explicitly deferred “Operator allowlist placement vs. protected path exclusion” to this story. Stories **12.3–12.8** depend on a stable allowlist contract for secret scanning, pipeline scope, manifest snapshots, query API, ranking, and quarantine corpus.

Cross-story dependency graph (for scope discipline):

- **12.3** will consume “notes eligible for embed” predicates—keep parser outputs easy to compose (exported types + pure validation).
- **12.4** will load the same config file from disk—avoid coupling validation to `CNS_VAULT_ROOT` resolution inside the parser if possible (accept string paths for subtrees; resolve vault root only at pipeline boundary).

### Technical requirements (guardrails)

- **Reuse patterns, do not reinvent:** Mirror the baseline + optional override mental model from secret patterns only if this story explicitly specifies vault-resident files; otherwise a single JSON document validated in isolation is enough for 12.2.
- **Path safety:** Charter requires `realpath` before reads at **index** time (Story 12.4). For 12.2, still reject obvious traversal (`..`) and absolute paths in the allowlist file so misconfiguration fails fast.
- **No Phase 1 normative drift:** Do not change Vault IO tool semantics or `specs/cns-vault-contract/CNS-Phase-1-Spec.md` unless a separate approved story requires it. If you add a **new** normative markdown under `specs/`, restrict it to Brain allowlist scope and cross-link from planning artifacts—default is **planning artifact + `src` types/tests only** to reduce constitution mirror churn.
- **Errors:** Follow `CnsError` / existing error typing where the validator is integrated; for a pure parse module, returning a `Result` or `{ ok: false; issues: [...] }` pattern is acceptable if no `CnsError` dependency is needed yet.

### Architecture compliance

- **Stack:** TypeScript, Zod, existing npm test runner ([Source: `package.json` scripts: `test`, `lint`, `typecheck`]).
- **Module placement:** Prefer a small dedicated module namespace, e.g. `src/brain/corpus-allowlist.ts` (create `src/brain/` if no `brain` package exists), rather than scattering types in `src/pake/` unless you have a strong cohesion argument.
- **Documentation split:** Human semantics and operator procedures live in `_bmad-output/planning-artifacts/`; machine-readable rules live in `src/` + `config/` examples.

### Library and framework requirements

- **Zod** for schema validation (already in use). No new embedding / vector / HTTP client libraries.

### File structure requirements

| Area | Expected touch |
|------|----------------|
| `_bmad-output/planning-artifacts/brain-corpus-allowlist-contract.md` (or agreed name) | New: normative human contract |
| `src/brain/*.ts` | New: schema + parser |
| `config/brain-corpus-allowlist.example.json` | New: golden example |
| `tests/**` | New: unit tests |
| `src/index.ts`, MCP registration | **No** changes for tool surface (AC #6) |

### Testing requirements

- Use existing test conventions ([Source: `tests/vault-io/secret-scan.test.ts`] for patterns of fixture loading if helpful).
- Cover both success and failure paths; ensure error messages for policy violations do not include raw file bodies (AC #4).

### Previous story intelligence

From **12.1** ([Source: `_bmad-output/implementation-artifacts/12-1-brain-service-scope-charter-phase-21.md`]):

- Charter path: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` (authoritative for corpora classes).
- Review explicitly deferred **Nexus-origin detection**, **unknown `pake_type`**, and **allowlist vs protected-path bootstrapping**—12.2 owns the last item; keep Nexus detection out of scope unless you only add optional placeholder fields documented as “reserved for 12.8”.
- 12.1 completed doc-only; **12.2 is the first story in Epic 12 that may land executable validation code**—run the full verify gate after code changes.

### Git intelligence summary

Recent work on `master` includes planning mirror symlink fixes and BMAD story template updates (`3756ae9`, `5937761`, `0769b49`). No Brain implementation modules exist yet; this story establishes the first `src/brain/` footprint—keep it minimal.

### Latest technical information

No additional runtime or cloud APIs are required. Prefer stable JSON over YAML so operators can validate with the same Zod schemas the repo tests use.

### Project context reference

No `project-context.md` in repo. Use this story, the charter, `CLAUDE.md`, and `specs/cns-vault-contract/modules/security.md` as the context bundle.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 12, Story 12.2]
- [Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` — Candidate corpora, Protected paths, Default-safe posture]
- [Source: `_bmad-output/implementation-artifacts/12-1-brain-service-scope-charter-phase-21.md`]
- [Source: `src/secrets/pattern-config.ts` — Zod schema style]
- [Source: `src/secrets/load-patterns.ts` — JSON load + validate pattern]
- [Source: `specs/cns-vault-contract/modules/security.md` — secrets and boundaries]
- [Source: `scripts/verify.sh` — verification gate]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note **“Operator guide: no update required”** in Dev Agent Record (acceptable default only if operators truly have no new file to edit—if you document a vault-resident allowlist path, the guide likely needs a pointer).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent) — `bmad-dev-story` workflow.

### Debug Log References

### Completion Notes List

- Story context prepared: ultimate context engine analysis completed — comprehensive developer guide created (BMAD create-story workflow).
- Implemented `parseBrainCorpusAllowlist` / `parseBrainCorpusAllowlistUnknown` with Zod + path/protected policy; human contract at `_bmad-output/planning-artifacts/brain-corpus-allowlist-contract.md`; example `config/brain-corpus-allowlist.example.json`; negative fixture `tests/fixtures/brain-corpus-allowlist-invalid-protected.json`; Vitest `tests/brain/corpus-allowlist.test.ts`; `vitest.config.ts` extended to include `tests/brain/**`.
- **`bash scripts/verify.sh`:** PASSED (2026-04-13).
- **Operator guide:** Updated `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` with Section 13 (Brain corpus allowlist pointer), version 1.1.0 history row, and `modified` bump—because the contract specifies vault-resident `_meta/schemas/brain-corpus-allowlist.json`.

### File List

- `_bmad-output/planning-artifacts/brain-corpus-allowlist-contract.md`
- `src/brain/corpus-allowlist.ts`
- `config/brain-corpus-allowlist.example.json`
- `tests/fixtures/brain-corpus-allowlist-invalid-protected.json`
- `tests/brain/corpus-allowlist.test.ts`
- `vitest.config.ts`
- `_bmad-output/implementation-artifacts/12-2-brain-corpus-allowlist-contract.md` (this story — permitted sections only)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

### Change Log

- 2026-04-13 — Story 12.2: Brain corpus allowlist contract (planning doc, parser, fixtures, tests, operator guide pointer; verify gate green).
