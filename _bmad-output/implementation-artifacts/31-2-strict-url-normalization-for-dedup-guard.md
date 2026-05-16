---
story_id: 31-2
epic: 31
title: strict-url-normalization-for-dedup-guard
status: done
---

# Story 31.2: strict-url-normalization-for-dedup-guard

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide for Epic 31 dedup URL normalization. -->

## Story

As the **ingest pipeline**,  
I want **source URIs normalized for dedup before comparison**,  
so that **URL variants pointing to the same resource** (trailing slashes, `www.` prefix, query strings, fragments) **are treated as duplicates and not ingested twice**.

## Context

The dedup guard shipped in **Epic 29 story 29-6** (`src/ingest/duplicate.ts`, `normalizeSourceUriForDedup`). Today it handles only:

- trim
- `http://` → `https://`
- iterative trailing `/` strip on the full string

Three variant classes still escape dedup and can produce duplicate governed notes for the same resource:

| Variant | Example A | Example B |
|---------|-----------|-----------|
| Query string | `https://example.com/page?utm_source=twitter` | `https://example.com/page` |
| `www.` prefix | `https://www.example.com/page` | `https://example.com/page` |
| Fragment | `https://example.com/page#section` | `https://example.com/page` |

**29-6 explicitly deferred** full URL normalization to a future story (see [29-6 deferred work](29-6-dedup-guard-at-ingest-time.md#deferred-work-future-stories)). This story closes that gap.

**Scope (non-negotiable):**

- Change **`normalizeSourceUriForDedup`** in **`src/ingest/duplicate.ts`** only for normalization logic.
- **No** MCP tool signature changes, **no** vault writes, **no** audit logging changes, **no** WriteGate changes.
- Pipeline and MCP paths already call `governedNoteExistsWithSourceUri` / `normalizeSourceUriForDedup` before ingest — behavior updates automatically.

**Out of scope:** IDN/punycode, host case-folding, default-port stripping, query-parameter *ordering* canonicalization, path segment case-folding, aligning `normalizeUrl` in `src/ingest/normalize.ts` (ingest title/body path), changing stored `source_uri` values in existing notes.

## Acceptance Criteria

1. **`normalizeSourceUriForDedup`** strips **query strings** (everything from first `?` through end of URL, before fragment handling if both present) before comparison.
2. **`normalizeSourceUriForDedup`** strips **URL fragments** (everything from first `#` through end) before comparison.
3. **`normalizeSourceUriForDedup`** normalizes **`www.`** host prefix: `https://www.example.com/...` and `https://example.com/...` normalize to the same value.
4. **Composition:** a URL with `www.`, query string, **and** fragment normalizes to the same value as the clean base URL (plus existing http→https and trailing-slash rules).
5. **Regression:** existing normalizations (http→https, trailing slash) remain correct and covered by tests.
6. **Tests:** all new normalization cases plus compose case covered in **`tests/vault-io/vault-create-note.test.ts`** (extend existing `describe("normalizeSourceUriForDedup (Story 29.6)")`) **or** new **`tests/vault-io/duplicate.test.ts`** — dev agent picks whichever keeps coverage clearer. At least one **integration-style** case (MCP `vault_create_note` dedup pre-flight or `runIngestPipeline` duplicate) per variant class is recommended if `sourceUriVaultSearchLiteralsForDedup` is updated (see Dev Notes).
7. **`npm test`** passes. **`bash scripts/verify.sh`** passes.
8. **`deferred-work.md`:** add a **Closed / resolved** entry for strict URL dedup normalization (deferred from 29-6), referencing Story **31-2**. (There is no existing line 148 item for this topic — 29-6 tracked deferral in its own story file; do not mark unrelated resolved items.)

## Tasks / Subtasks

- [x] Read **`src/ingest/duplicate.ts`** in full (especially `normalizeSourceUriForDedup`, `sourceUriVaultSearchLiteralsForDedup`, `findAllGovernedPathsMatchingDedupSourceUri`).
- [x] Read existing dedup tests: **`tests/vault-io/vault-create-note.test.ts`** (`normalizeSourceUriForDedup`, MCP dedup pre-flight block) and **`tests/vault-io/ingest-pipeline.test.ts`** (dedup AC).
- [x] Extend **`normalizeSourceUriForDedup`** with ordered steps: **parse URL** (use `URL` when input is `http(s)://…`; for non-URL strings fall back to safe string ops consistent with current behavior) → **strip `www.`** from hostname → **strip query** → **strip fragment** → **http→https** → **trim** → **strip trailing slashes** iteratively.
- [x] Evaluate **`sourceUriVaultSearchLiteralsForDedup`**: if unit-normalized keys match but `vault_search` never returns hits (stored note has `?utm=…` or `www.` while incoming is canonical), extend literals in the **same file** using normalized key `k` plus minimal variants (e.g. `www.` host twin, `http`/`https`, trailing slash) — **do not** duplicate search loops elsewhere.
- [x] Add unit tests for query, fragment, `www.`, compose, and regression (http/slash).
- [x] Optionally add MCP or pipeline dedup tests mirroring 29-6 patterns (stored vs incoming variant).
- [x] Update **`_bmad-output/implementation-artifacts/deferred-work.md`** — **Closed / resolved** entry for 29-6 URL normalization deferral.
- [x] Run **`npm test`** and **`bash scripts/verify.sh`**.

## Dev Notes

### Epic 31 / prior story intelligence

| Source | Relevance |
|--------|-----------|
| **31-1** (done) | Triage command rename; unrelated to ingest dedup — no file overlap. |
| **29-6** (done) | Introduced `normalizeSourceUriForDedup`, MCP pre-flight, `sourceUriVaultSearchLiteralsForDedup`, tests in `vault-create-note.test.ts`. |
| **29-6 deferred work** | Listed queries, `www.`, fragments as **future** — this story implements that subset. |

### Current implementation (baseline)

```10:18:src/ingest/duplicate.ts
export function normalizeSourceUriForDedup(uri: string): string {
  let s = uri.trim();
  if (/^http:\/\//i.test(s)) {
    s = `https://${s.slice(7)}`;
  }
  while (s.endsWith("/")) {
    s = s.slice(0, -1);
  }
  return s;
}
```

Module docstring (lines 6–8) states queries/`www.`/fragments are **out of scope** — **update the comment** when implementing to describe the new rules and remaining exclusions (punycode, host case, etc.).

### Normalization order (required)

Per product intent:

1. trim (or trim after parse — be consistent)
2. parse as URL when possible
3. strip **`www.`** from hostname (`www.example.com` → `example.com`)
4. strip **query** (`search` / `?…`)
5. strip **fragment** (`hash` / `#…`)
6. **`http` → `https`**
7. strip **trailing slashes** iteratively on serialized result

**Query vs fragment:** when both exist, strip query first (fragment follows `?` in standard URLs). Reuse logic similar to **`stripQueryAndFragment`** in [`src/ingest/classify.ts`](src/ingest/classify.ts) for string fallbacks, but **do not** change `classify.ts` unless necessary — prefer `URL` API inside `duplicate.ts`.

### `sourceUriVaultSearchLiteralsForDedup` — critical for end-to-end dedup

Normalization alone fixes **comparison** (`normalizeSourceUriForDedup(stored) === seekKey`) only when **`vault_search` returns a candidate hit**. Search uses **exact** `source_uri:` literals.

| Scenario | Risk if only `normalizeSourceUriForDedup` changes |
|----------|---------------------------------------------------|
| Incoming has `?utm=…`, stored canonical | Often OK: literals include `trimmed` (with query); verify pass uses normalized keys. |
| Incoming canonical, stored has `?utm=…` or `www.` | **May miss hit** unless literals include variants that match stored YAML strings. |

**Guidance:** After implementing normalization, run MCP dedup tests (copy 29-6 trailing-slash / http-https tests) for at least one **www.** and one **query** case. If integration tests fail, extend **`sourceUriVaultSearchLiteralsForDedup`** in **`duplicate.ts`** (same PR, same module — not MCP) to emit `www.` and slash/scheme twins of `k`, and consider including **both** `trimmed` and `k` when they differ. Do **not** reimplement vault scan logic outside `duplicate.ts`.

### Existing test anchor (extend, don’t duplicate blindly)

```308:311:tests/vault-io/vault-create-note.test.ts
describe("normalizeSourceUriForDedup (Story 29.6)", () => {
  it("strips trailing slashes iteratively and upgrades http to https", () => {
    expect(normalizeSourceUriForDedup("  http://a.com/b//  ")).toBe("https://a.com/b");
```

Rename or extend describe block to cite **31-2**; add cases:

| Input | Expected (illustrative — confirm in implementation) |
|-------|-----------------------------------------------------|
| `https://example.com/page?utm_source=twitter` | `https://example.com/page` |
| `https://example.com/page#section` | `https://example.com/page` |
| `https://www.example.com/page` | `https://example.com/page` |
| `http://www.example.com/page/?utm=x#frag` | `https://example.com/page` |
| `  http://a.com/b//  ` | `https://a.com/b` (regression) |

### Architecture compliance

- **Spec-first:** Ingest dedup is pipeline/MCP behavior; no constitution change.
- **WriteGate / audit:** Untouched.
- **Operator guide:** No user-facing command or MCP contract change — standing task: note **"Operator guide: no update required"** unless product wants a one-line ingest dedup note (optional, not blocking).

### File structure requirements

| Path | Action |
|------|--------|
| `src/ingest/duplicate.ts` | Extend `normalizeSourceUriForDedup`; update module comment; optionally extend `sourceUriVaultSearchLiteralsForDedup` |
| `tests/vault-io/vault-create-note.test.ts` and/or `tests/vault-io/duplicate.test.ts` | Unit + optional integration tests |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Closed / resolved entry |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Set story **done** when implementation completes (create-story sets **ready-for-dev** only) |

**Not in scope:** `src/register-vault-io-tools.ts`, `src/ingest/pipeline.ts` (unless a one-line comment only), `src/ingest/normalize.ts`, `specs/`, `AGENTS.md`, Hermes skills.

### Testing requirements

**Blocking:**

```bash
npm test
bash scripts/verify.sh
```

**Minimum unit coverage (AC 1–5):** query strip, fragment strip, `www.` strip, composed URL, http/slash regression.

**Recommended integration coverage (AC 6):** duplicate `vault_create_note` or `runIngestPipeline` when incoming URL has tracking params and vault already has canonical `source_uri` (and reverse if literals are extended).

### `deferred-work.md` update (AC 8)

Under **`## Closed / resolved (detail)`**, add:

```markdown
### Strict URL normalization for dedup guard (29-6 deferral)

`normalizeSourceUriForDedup` handled only http→https and trailing slashes; query strings, `www.`, and fragments were deferred. **Resolved** by Story **31-2** (`src/ingest/duplicate.ts`).

- **Class:** (c)
```

Do not edit unrelated deferred items.

### References

- [Source: `_bmad-output/implementation-artifacts/29-6-dedup-guard-at-ingest-time.md` — original scope + deferred full URL normalization]
- [Source: `src/ingest/duplicate.ts` — `normalizeSourceUriForDedup`, `governedNoteExistsWithSourceUri`]
- [Source: `src/ingest/pipeline.ts` — `governedNoteExistsWithSourceUri` before write (~147–151)]
- [Source: `src/ingest/classify.ts` — `stripQueryAndFragment` pattern reference]
- [Source: `tests/vault-io/vault-create-note.test.ts` — Story 29.6 dedup tests]
- [Source: `tests/vault-io/ingest-pipeline.test.ts` — pipeline duplicate AC]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If no user-facing behavior change beyond fewer duplicate notes: note **"Operator guide: no update required"** in Dev Agent Record.
- [ ] Optional: one-line callout under ingest/dedup if operator asks for visibility (not required for AC).

## Dev Agent Record

### Agent Model Used

Composer (bmad-dev-story on 31-2)

### Debug Log References

_(none)_

### Completion Notes List

- Extended `normalizeSourceUriForDedup` with safe string normalization (trim → www strip → query/fragment clear → https → trailing-slash strip) while preserving out-of-scope host case/default-port behavior.
- Extended `sourceUriVaultSearchLiteralsForDedup` with `www.` host twins and prefix `source_uri:` queries for literals that normalize to the same key, so stored notes with query/fragment suffixes still hit vault_search.
- Unit tests (query, fragment, www, compose, regression, out-of-scope preservation) + MCP dedup (www, stored-with-query, composed stored variant) + pipeline dedup variant test.
- Operator guide: no update required (fewer duplicate notes only; no MCP contract change).
- `npm test` 606 passed; `bash scripts/verify.sh` passed.

### File List

- `src/ingest/duplicate.ts`
- `tests/vault-io/vault-create-note.test.ts`
- `tests/vault-io/ingest-pipeline.test.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/31-2-strict-url-normalization-for-dedup-guard.md`

### Verification

| Check | Result |
|-------|--------|
| `npm test` | pass (606 tests) |
| `bash scripts/verify.sh` | pass |

## Code Review

- 2026-05-16: Review found one dedup search miss for clean incoming URLs when the stored `source_uri` combined `http`, `www.`, trailing slash, query string, and fragment variants. Fixed by enabling prefix `source_uri:` search for all literals that normalize to the same dedup key, including `http` variants.
- 2026-05-16: Review also removed incidental URL API canonicalization so out-of-scope host case/default-port behavior stays unchanged.
- Final review status: pass. No open findings.

## Change Log

- 2026-05-16: Story 31-2 created (ready-for-dev) — strict URL normalization for ingest/MCP dedup guard; closes 29-6 deferred normalization scope.
- 2026-05-16: Implementation complete — strict URL dedup normalization, search literal extensions, tests; status → review.
- 2026-05-16: Code review complete — composed stored variant fixed, full gates green; status → done.
