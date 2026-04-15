# Brain corpus allowlist contract

**Status:** normative (planning artifact for Epic 12)  
**Date:** 2026-04-13  
**Story:** `12-2-brain-corpus-allowlist-contract`  
**Charter:** [`brain-service-phase-2-1-charter.md`](./brain-service-phase-2-1-charter.md) — Candidate corpora, default excludes, protected paths, inbox opt-in

## Purpose

Define a **single operator-editable JSON document** that declares which vault subtrees (relative to `CNS_VAULT_ROOT`) may participate in Brain indexing, optional `pake_type` filters, and explicit gates for **inbox** and **protected corpora**. Machine validation lives in `src/brain/corpus-allowlist.ts` (Zod + policy); this document is the human semantics layer.

## Alignment with the Phase 2.1 charter

| Charter class | Allowlist behavior |
|---------------|-------------------|
| Default include candidates: `03-Resources/**`, `01-Projects/**`, `02-Areas/**`, `DailyNotes/**` | Express as normalized subtree roots (see Normalization). Typical posture lists these four roots unless operators deliberately narrow scope. |
| `00-Inbox/**` | **Never implied.** Inclusion requires either an explicit `00-Inbox` subtree entry **or** `inbox.enabled: true` (see Inbox semantics). |
| Default excludes: `AI-Context/**`, `_meta/**`, `04-Archives/**` | `04-Archives` may appear in `subtrees` without a special block (operator trade-off on staleness). **`AI-Context` and `_meta` prefixes require `protected_corpora_opt_in`** — no silent bypass. |
| Optional `pake_type` filters | Optional `pake_types` array; when present, indexers should treat it as an allowlist of note types (integration in 12.4+). |

## Configuration shape (JSON)

All paths are **vault-relative POSIX-style strings** as seen inside the vault (forward slashes). They are **not** host absolute paths and must not use `..` segments.

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | `1` | Literal. Future versions may extend shape; parsers reject unknown versions. |
| `subtrees` | string[] | Non-empty after normalization. Each entry is one corpus root (file glob `/**` is normalized away). |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `pake_types` | string[] | If set, only notes whose `pake_type` is in this list are in scope for embedding (indexer enforces in 12.4+). Empty strings are rejected at validation. |
| `inbox` | `{ "enabled": boolean }` | When `enabled` is true, `00-Inbox` is an allowed corpus root **in addition to** explicit subtree rules (see Inbox semantics). |
| `protected_corpora_opt_in` | object | Required whenever any normalized subtree lies under `AI-Context` or `_meta`. |

### Protected corpora opt-in (no silent bypass)

When **any** entry in `subtrees` normalizes to a path under `AI-Context` or `_meta`, the following block **must** be present and valid:

```json
"protected_corpora_opt_in": {
  "enabled": true,
  "rationale": "Non-empty operator-written reason, visible in config and reviews.",
  "acknowledged_risks": true
}
```

**Design intent:** opt-in remains **operator-visible and auditable** (config + change control). This story does **not** wire Vault IO audit logging to allowlist edits.

### Inbox semantics

- Default: inbox is **out** unless the operator either lists a subtree starting with `00-Inbox` **or** sets `inbox.enabled` to `true`.
- `inbox.enabled: true` is treated as explicit operator intent to allow the inbox corpus even if they rely on convention rather than listing `00-Inbox` in `subtrees` (charter: flag **or** subtree). Indexers merge this with `subtrees` when building effective roots (12.4+).

### Normalization rules

Applied to each subtree string **before** policy checks:

1. Trim ASCII whitespace.
2. Convert `\` to `/`.
3. Strip a single leading `./` if present (repeat until none).
4. Remove a trailing `/` or trailing `/**` repeatedly until stable.
5. Collapse consecutive `/` to a single `/`.
6. Reject if the result is empty, if any path segment is `..`, if the path starts with `/`, or if it matches a Windows drive prefix (`^[A-Za-z]:`).

Normalized values are what validators and indexers use for prefix checks.

## Invalid configuration and errors

Validators return a **structured issue list** (discriminated `code` values). Categories:

1. **JSON parse errors** — malformed JSON (messages are generic; **no** echo of file contents).
2. **Schema errors** — Zod shape violations (messages use field paths and issue codes, not arbitrary input snippets).
3. **Policy violations** — empty allowlist, illegal paths, protected subtree without complete opt-in.

Implementations **must not** embed secret-like substrings from the config file into error messages (treat file bodies as untrusted for logging).

## File placement

| Location | Role |
|----------|------|
| `config/brain-corpus-allowlist.example.json` | Repo **example** aligned with charter default-include posture. |
| `{vaultRoot}/_meta/schemas/brain-corpus-allowlist.json` | **Recommended** vault-resident path for a live operator file (same schema). Not created by this story; future pipeline stories load from disk. |

## Phase boundary

This contract does **not** ship embeddings, vector stores, or MCP tools. Deliverables are documentation, schema/types, `parseBrainCorpusAllowlist`, fixtures, and tests only.

## References

- [`brain-service-phase-2-1-charter.md`](./brain-service-phase-2-1-charter.md)
- `src/brain/corpus-allowlist.ts`
- `config/brain-corpus-allowlist.example.json`
- `specs/cns-vault-contract/modules/security.md` (secrets and boundaries)
