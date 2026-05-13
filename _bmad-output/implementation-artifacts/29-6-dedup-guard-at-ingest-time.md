# Story 29.6: Dedup guard at ingest time (MCP `vault_create_note`)

Status: review

Epic: **29** (knowledge quality, agent memory)  
Planning source: **`_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md`** (story card 29-6, appendix ingest snapshot).

## Story

As a **knowledge steward**,  
I want **URL-level duplicate prevention on every governed ingest entrypoint that can create a note with a `source_uri` without going through `runIngestPipeline`**,  
so that **the same canonical source is not filed twice forward** and **Discord / MCP callers get an explicit warning instead of a silent skip or hard error**.

## Scope boundaries (non-negotiable)

| Topic | Rule |
|-------|------|
| Fix location | **MCP tool layer only:** pre-flight inside the **`vault_create_note`** tool handler in **`src/register-vault-io-tools.ts`** (not Hermes skill-only; catches **all** MCP callers). **Do not** rely on skill-level guards as the sole fix. |
| Lookup | Use **`governedNoteExistsWithSourceUri`** from **`src/ingest/duplicate.ts`** as the governed existence check. **Do not** reimplement an alternate full-vault scan or divergent search semantics. **Allowed:** extend **`duplicate.ts`** with a **shared internal helper** (or a thin path-returning wrapper) so the **vault_search + on-disk YAML verification** pattern exists **once**, and adjust verification if needed so normalization policy matches acceptance tests (see Dev Notes). |
| `runIngestPipeline` | Already calls **`governedNoteExistsWithSourceUri`** when `normalized.source_uri` is set ([`src/ingest/pipeline.ts`](src/ingest/pipeline.ts) ~147–151). **No behavior regression** for pipeline duplicate returns. |
| URL normalization (this story) | **Only:** (1) strip **trailing** slashes from the path (iterative or single trailing `/`), (2) normalize **`http://` → `https://`**. **Do not** implement full URL normalization (query strings, `www.`, fragments, punycode, case-folding hosts, etc.) — capture under **Deferred work** below. |
| On duplicate | **WARNING** to caller: **no** new note, **no** `vault_create_note` audit line (`appendRecord` for `create` / `vault_create_note` must not run). **Required human-readable `message`:** starts with **`⚠️ Dedup: [URL] already exists at [note-path]. Skipping create.`** — `[URL]` = incoming `source_uri` after trim (show what the caller passed); `[note-path]` = **vault-relative POSIX** to the **first** matching governed note. **Append one sentence** for override: Phase 1 has **no** `vault_update_note` tool; name **`vault_update_frontmatter`** (and/or other **documented** mutators from **`CNS-Phase-1-Spec.md`** / **`AGENTS.md`**) so the operator is not sent to a non-existent MCP tool. |
| Non-duplicate | **Unchanged** success path: existing **`vaultCreateNote`** behavior, PAKE, WriteGate, secret scan, audit. |

## Acceptance criteria

1. **`vault_create_note`** runs the dedup **pre-flight before any write or `vault_create_note` audit** when the MCP argument **`source_uri`** is present and **non-empty** after trim. *(PAKE frontmatter field is **`source_uri`**, not `source_url`.)*
2. **Duplicate detected:** response surfaces a **warning** (not MCP hard-error / not silent success with created paths). **No** note file created; **no** audit log line for this create.
3. **Non-duplicate:** behavior matches pre-story **`vault_create_note`** (same JSON success shape as today).
4. **Normalization:** before comparison, apply **only** trailing-slash strip and **`http://` → `https://`**; behavior covered by tests listed below.
5. **Lookup method:** **`governedNoteExistsWithSourceUri`** remains the boolean existence check; do not duplicate its search contract in another module.
6. **`npm test`** passes, including **new** unit tests for: **exact** duplicate URI; **trailing-slash** equivalent; **`http` / `https`** equivalent; **non-duplicate** proceeds to create.
7. **`bash scripts/verify.sh`** passes.
8. **Deferred work** subsection is present in this story file documenting **full URL normalization** (queries, `www.`, fragments, etc.) as future scope.

## Tasks / Subtasks

- [x] Add **`normalizeSourceUriForDedup`** (or equivalent name) in an appropriate **`src/`** module (prefer colocated with **`duplicate.ts`** or **`src/ingest/`**), **documented** as ingest/MCP dedup-only (not general-purpose URL canonicalization).
- [x] Wire MCP **`vault_create_note`** handler: if `source_uri` present → normalize → duplicate check → on hit return warning payload; else call existing **`vaultCreateNote`**.
- [x] Ensure **existing note path** is available for the warning string (extend **`duplicate.ts`** with a path-returning helper or refactor to shared core **without** copying the vault_search loop elsewhere).
- [x] Add **`tests/`** coverage (extend **`tests/vault-io/vault-create-note.test.ts`** and/or **`fixture-vault-integration.test.ts`**) for the four cases in AC6; use temp vault fixtures under existing patterns (`makeVault` / `registerVaultIoTools` / `callRegisteredTool` as appropriate).
- [x] Run **`npm test`** and **`bash scripts/verify.sh`**.
- [x] Update **`sprint-status.yaml`** for **`29-6-dedup-guard-at-ingest-time`** when implementation completes (this story file creation may set **ready-for-dev** only).

## Dev Notes

### Readiness context (implementation gap)

- **`runIngestPipeline`** already returns `{ status: "duplicate", source_uri }` when **`governedNoteExistsWithSourceUri`** is true ([`src/ingest/pipeline.ts`](src/ingest/pipeline.ts) 147–151).
- **Gap:** callers that invoke **`vaultCreateNote`** / MCP **`vault_create_note`** with **`source_uri`** **bypass** that pipeline (e.g. Hermes URL ingest). The fix is **pre-flight in the MCP handler** ([`src/register-vault-io-tools.ts`](src/register-vault-io-tools.ts) ~208–237).

### `governedNoteExistsWithSourceUri` behavior ([`src/ingest/duplicate.ts`](src/ingest/duplicate.ts))

- Builds `query = \`source_uri: ${JSON.stringify(sourceUri)}\`` and **`vaultSearch`** with **`scope: "03-Resources"`**, **`forceNodeScanner: true`**.
- For each hit, reads file, parses frontmatter, returns **true** only if **`source_uri` YAML string equals** `sourceUri` **exactly** (line 25–26).
- **Implication:** if acceptance tests require **equivalence** across trailing slash or scheme, either:
  - pass **query variants** (limited set: normalized, normalized + `/`, and `http`/`https` twin of the same host/path), **or**
  - relax the **YAML equality check** to **`normalizeSourceUriForDedup(stored) === normalizeSourceUriForDedup(sought)`** while keeping the **same** `vaultSearch` + read + parse structure **inside `duplicate.ts`**.
- **Title duplicates:** **`findGovernedResourceNotesByTitle`** is pipeline-only for title collision; **out of scope** unless you need it for the warning path (you should not for URI dedup).

### MCP handler touchpoint

```215:237:src/register-vault-io-tools.ts
    async (args) => {
      try {
        const out = await vaultCreateNote(
          cfg.vaultRoot,
          {
            title: args.title,
            content: args.content,
            pake_type: args.pake_type,
            tags: args.tags,
            confidence_score: args.confidence_score,
            source_uri: args.source_uri,
            project: args.project,
            area: args.area,
          },
          { surface: "mcp" },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
```

- Inject dedup **after** args are validated by the tool schema but **before** **`vaultCreateNote`**.
- **`vaultCreateNote`** audit path: [`src/tools/vault-create-note.ts`](src/tools/vault-create-note.ts) appends **`vault_create_note`** only when **`suppressAudit !== true`** (default MCP path uses **`surface: "mcp"`**, audit **on**). Early return must skip **`vaultCreateNote`** entirely so **no** create audit.

### Warning response shape

- Use a **JSON object** in the tool `text` content so Hermes/IDE can parse it reliably, e.g. include a boolean like **`dedup_warning: true`**, **`message`** with the exact format from scope, and optionally **`existing_path`**. **Do not** use MCP **`isError: true`** for duplicate (operator asked for **warning**, not hard failure).

### Override wording

- Original epic card wording referenced **`vault_update_note`**; **this codebase** exposes **`vault_update_frontmatter`**, **`vault_move`**, **`vault_append_daily`**, etc. — see **`src/register-vault-io-tools.ts`**. The warning **`message`** must not direct operators to a **non-existent** tool name.

### References

- Epic card + appendix: [`_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md`](_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md) (§29-6, Appendix ingest snapshot).
- Duplicate + pipeline: [`src/ingest/duplicate.ts`](src/ingest/duplicate.ts), [`src/ingest/pipeline.ts`](src/ingest/pipeline.ts).
- Create + audit ordering: [`src/tools/vault-create-note.ts`](src/tools/vault-create-note.ts) (mutation pipeline comment ~55–60).

## Deferred work (future stories)

- **Full URL normalization:** query-string ordering, `www.` vs bare host, fragments, default ports, IDN/punycode, case on path, etc. **Out of scope for 29-6**; any partial alignment with **`normalizeUrl`** in [`src/ingest/normalize.ts`](src/ingest/normalize.ts) (e.g. `www.` → `https://`) is **not** required here.

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If MCP / Discord-visible behavior changes: update **`03-Resources/CNS-Operator-Guide.md`** per project standing task in template.
- [x] If behavior is MCP-only and documented elsewhere first: still confirm whether Operator Guide needs a one-line note under Vault IO / ingest.

## Dev Agent Record

### Agent model used

Composer (GPT-5.2)

### Debug log references

*(none)*

### Completion notes list

- Added `normalizeSourceUriForDedup` and multi-literal `vault_search` + normalized YAML verification in `src/ingest/duplicate.ts`; exported `findFirstGovernedNotePathForDedupSourceUri`; `governedNoteExistsWithSourceUri` now uses the same equivalence rules (pipeline duplicate detection aligned with MCP).
- MCP `vault_create_note` pre-flight in `src/register-vault-io-tools.ts` returns JSON warning (`dedup_warning`, `message`, `existing_path`) without calling `vaultCreateNote` (no write, no create audit).
- Tests: `tests/vault-io/vault-create-note.test.ts` (normalize helper + four MCP cases); `npm test` and `bash scripts/verify.sh` passed.
- Operator guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` callout for Story 29.6 dedup behavior.

### File list

- `src/ingest/duplicate.ts`
- `src/register-vault-io-tools.ts`
- `tests/vault-io/vault-create-note.test.ts`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/29-6-dedup-guard-at-ingest-time.md`

---

**Story completion (create-story):** Ultimate context engine analysis completed — comprehensive developer guide created for 29-6.
