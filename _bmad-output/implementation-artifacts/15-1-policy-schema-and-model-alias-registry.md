# Story 15.1: Policy schema + model alias registry (no secrets)

Status: done

## Story

As a **maintainer**,  
I want a **repo-stored, vendor-neutral routing policy schema** plus a **model alias registry** that contains **no secrets**,  
so that **Phase 3 routing** can be implemented deterministically and audited safely across surfaces without retrofitting policy later.

## Context

- Source readout: `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md`
  - See “Recommended Phase 3 epic/story breakdown” item **(1) Policy schema + model alias registry (no secrets)**.
  - See “Minimal decision record (audit-friendly)” for required decision fields and “Never log / never echo list”.
- Architectural anchor for “config lives in repo (non-secret)”: `config/secret-patterns.json` is the existing precedent for versioned, non-secret policy config.

## Acceptance Criteria

1. **Given** the repo contains a routing policy schema and example policy files  
   **When** the schema validation test suite runs  
   **Then** all shipped example policy files validate successfully.

2. **Given** the schema and examples exist  
   **When** a maintainer reads `config/model-routing/_README.md`  
   **Then** they can understand:
   - what is allowed to live in repo config (non-secret),
   - what must never be stored there (credentials, prompts, responses, note content),
   - how policy versioning is intended to work (semantic version or hash).

3. **Given** the “minimal decision record” described in the readout  
   **When** the policy schema is defined  
   **Then** it includes (directly or as referenced definitions) the required fields:
   - `surface` (enum-like string values, at least: `cursor`, `claude-code`, `vault-io`, `unknown`)
   - `scope` (`session|task|tool`)
   - `policy_version` (string)
   - `selected_model_alias` (string)
   - `reason_code` (string constrained to a defined set)
   - `fallback_chain` (array of aliases, max 16 enforced by schema)
   - `operator_override` (boolean)
   - **No content fields** (no prompt text, no tool payloads, no note content).

4. **Given** the “model alias” concept in the readout  
   **When** the model alias registry is authored  
   **Then** it provides stable aliases (e.g. `default-reasoning`, `default-coding`) mapped to **non-secret** resolution metadata  
   **And** the registry format is vendor-neutral (fields must not force a specific provider SDK shape).

5. **Given** Phase 1 / Phase 2 security posture and secret-safety constraints  
   **When** the example configs are reviewed  
   **Then** they contain **no credentials** and no fields that would normally hold credentials (e.g. `apiKey`, `token`, `Authorization`).

## Tasks / Subtasks

- [x] Define the **directory + file layout** for non-secret routing policy config (AC: 1–5)
  - [x] Create `config/model-routing/`
  - [x] Add `config/model-routing/_README.md` documenting:
    - non-secret vs secret placement (env / keychain / vault-encrypted future) per readout
    - “never log / never echo” summary (no prompts, responses, vault content)
    - intended consumers (future routing engine + surface adapters), but note this story ships **config only**

- [x] Author the **policy schema** (AC: 1–3)
  - [x] Add `config/model-routing/policy.schema.json`
  - [x] Schema must support:
    - policy versioning (`policy_version`)
    - defaults per surface + task category (e.g. `coding|writing|analysis`)
    - allow/deny lists (at least per surface, optionally per tool)
    - reason codes (referenced definition; see below)
    - fallback chain constraints (max 16)

- [x] Add **reason codes** registry (AC: 3)
  - [x] Add `config/model-routing/reason-codes.json` (or `.schema.json` + `.json` if preferred)
  - [x] Must include at least:
    - `DEFAULT`
    - `FALLBACK_RATE_LIMIT`
    - `OPERATOR_OVERRIDE`
    - `POLICY_DENY`
    - `NO_MATCH_FAIL_CLOSED`

- [x] Author the **model alias registry** (AC: 4)
  - [x] Add `config/model-routing/model-alias-registry.schema.json`
  - [x] Add `config/model-routing/model-alias-registry.json`
  - [x] Include a small, realistic set of aliases (2–6) with safe placeholder resolution metadata.
  - [x] Must not include credentials.

- [x] Provide **example policy** (AC: 1–5)
  - [x] Add `config/model-routing/policy.defaults.json` (or `policy.example.json`)
  - [x] Include:
    - defaults by surface + task category
    - an allowlist for at least one surface
    - a denylist example
    - a fallback chain example

- [x] Add **tests** that validate the shipped config (AC: 1, 5)
  - [x] Add a Vitest test (suggested path: `tests/model-routing/policy-config.test.ts`) that:
    - loads all shipped JSON config files in `config/model-routing/`
    - validates them against the corresponding JSON Schemas
    - asserts the “no credentials fields” rule (blocklist keys like `apiKey`, `token`, `authorization`, case-insensitive)
  - [x] Keep the test **pure** (no network, no provider SDKs).

## Dev Notes

- **Hard constraints from the readout** (`_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md`):
  - Keep this vendor-neutral: config should not bake in one provider’s SDK.
  - Treat secrets as out-of-repo concerns: env / keychain; do not add secret-bearing fields or examples.
  - The “minimal decision record” explicitly forbids content fields; policy artifacts should be compatible with this stance.

- **Scope boundary**:
  - This story intentionally ships **config + schema + tests** only (no routing engine implementation).
  - Do not create runtime code paths that emit routing logs; Phase 1 audit logging posture remains unchanged.

### Project Structure Notes

- Existing precedent for versioned, non-secret config: `config/secret-patterns.json`.
- Tests live in `tests/` and use Vitest (see `package.json` scripts).

### References

- `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md`:
  - “Model alias” definition
  - “Never log / never echo list”
  - “Minimal decision record (audit-friendly)”
  - “Recommended Phase 3 epic/story breakdown” item 1

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor)

### Debug Log References

### Completion Notes List

- ✅ Shipped repo-stored, vendor-neutral model routing policy config under `config/model-routing/` (schemas + examples only).
- ✅ Included a minimal-decision-record definition in the policy schema (content-free, fallback chain capped at 16).
- ✅ Added Vitest coverage that validates shipped configs via JSON Schema and blocks credential-like keys (case-insensitive).
- ✅ Resolved review Highs: documented allow/deny precedence (deny wins), fixed shipped example to avoid allow/deny conflicts, and tightened `reason_code` to a canonical enum via schema `$ref` into the reason-code registry.
- Operator guide: no update required (config-only; no new tools/workflows exposed to operators).

### File List

- config/model-routing/_README.md
- config/model-routing/policy.schema.json
- config/model-routing/policy.defaults.json
- config/model-routing/reason-codes.schema.json
- config/model-routing/reason-codes.json
- config/model-routing/model-alias-registry.schema.json
- config/model-routing/model-alias-registry.json
- tests/model-routing/policy-config.test.ts
- vitest.config.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-04-15: Added non-secret routing policy schema, reason codes, and model alias registry (with config validation tests).
- 2026-04-15: 15-1 revision pass — deny-wins precedence documented; reason_code locked via registry `$ref`; shipped examples made conflict-free.

