# Deferred work

**Triaged:** 2026-04-02 (before Epic 6).  
**Classification key:** **(a)** Epic 6 scope, **(b)** Phase 2 backlog (or operator-only docs), **(c)** closed or resolved by shipped work (Epics 4–5 and earlier).

**For Epic 6 story authors:** Do not open Epic 6 implementation until the **Epic 6 intake** rows are mapped to stories (6.1–6.3 or explicit follow-ups). The two highest-impact items for an honest verification gate are **`IO_ERROR` / `CnsError` message hygiene** and **`vault_move` Obsidian CLI success-path verification** (source `ENOENT` after exit 0).

---

## Summary table

| Item (short) | Class |
|--------------|-------|
| `vault_move` + Obsidian CLI: after exit 0, assert source gone (`ENOENT`) | (a) Epic 6 |
| Intentional `IO_ERROR` / `CnsError` messages not sanitised (4-8) | (a) Epic 6 |
| `vaultRootFromHost` not wired at stdio (3-1) | (a) Epic 6 (when host config exists) or document as known gap in 6.x |
| `vault_append_daily` double `safeParse` in register handler | (a) Epic 6 (consistency / hygiene) |
| Optional regression: two identical H2 headings, first-wins splice (4-6) | (a) Epic 6 optional (fixture / integration tests) |
| `normalizeAbsolute` duplicated (`audit-logger` / `vault-move`) | (a) Epic 6 optional or (b) if timeboxed out |
| Error-path `vaultMove` tests omit `_meta/logs` pre-create | (c) Accepted Phase 1 risk; reopen if audit runs earlier |
| `vault_move` wikilink repair O(n) per move | (b) Phase 2 at scale |
| Duplicated PAKE type enums (register + tools) | (a) Epic 6 or (b) pre–Phase 2 hygiene |
| Vault root at filesystem `/` (meaningless boundary) | (b) operator docs + optional hardening; (a) only if Epic 6 adds explicit rejection tests |
| Nexus trust-guard: detect `needs_configure` after Claude Code updates (NEXUS repo script) | (b) Phase 2 |
| `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`: Symptom E + trust-guard post-update reconnection | (b) Phase 2 |
| `vault_create_note` routes by `pake_type` only; ignores subdirectory path — use `vault_move` after creation for project subfolders | (b) Phase 2 / operator workflow |
| Symlink / `realpath` on reads | (c) Resolved: Story 4-9 |
| “Deferred to Epic 5.2” audit wiring in mutators | (c) Resolved: Epic 5 |

---

## Brain service (Epic 12)

### Nexus corpus exclusion by inbound path (12-8 finding)

Story 12-8 attempted to add build-time path exclusion for Nexus-origin notes from
`brain-index.json`. Investigation found no canonical Nexus inbound prefix exists in
the vault — Nexus writes to any directory it chooses, with governance limited to
`_README.md` manifest acknowledgements per `docs/architecture.md`.

**Charter requirement status:** The "no silent promotion" requirement from the
12-1 Brain scope charter is satisfied by the 12-7 quality floor: Nexus notes
without PAKE quality metadata score `0.25` and cannot compete with triaged vault
content at equivalent cosine similarity. Nexus notes *with* valid PAKE metadata
were operator-triaged and belong in retrieval results.

**Trigger to reopen:** If a canonical Nexus staging path is established (e.g.
`00-Inbox/nexus/` or `_nexus-inbound/`) and documented in AGENTS.md Section 5
and the Nexus operator guides, path-based build-time exclusion becomes feasible.
Implementation is a single filter in `src/brain/build-index.ts` against the
`CNS_NEXUS_INBOUND_PATH` env var (pattern already used by WriteGate for protected
paths).

**Alternatively:** If Nexus is updated to write `creation_method: nexus` frontmatter,
the quality extractor in `src/brain/quality.ts` can key off that field instead of
path, with no Nexus staging path required.

**Class:** (b) Phase 2 backlog — reopen only if Nexus write behaviour is formalised
or silent-promotion complaints arise in practice.

## Epic 6 intake (detail)

### `vault_move` Obsidian CLI success path (4-7 review)

After CLI exit 0 and destination checks, **verify the source path no longer exists** (`stat` → `ENOENT`) so a broken CLI cannot leave a duplicate at the source while appearing successful.

- **Class:** (a) Epic 6 (verification / move correctness; pair with integration or unit tests in 6.2).

### `IO_ERROR` / `CnsError` message sanitisation (4-8)

`handleToolInvocationCatch` normalises non-`CnsError` throws; **domain `CnsError("IO_ERROR", …)` messages may still embed internal paths or backend detail**. Review before trusting the verification gate on “safe” error text for operators or future external surfaces.

- **Class:** (a) Epic 6 (6.3 verification gate or a tight hygiene story).

### `vaultRootFromHost` not wired at stdio (3-1)

Optional MCP host `vaultRoot`; defer until host/SDK exposes initialization config for the server process.

- **Class:** (a) Epic 6 as config contract + docs when feasible; otherwise document “env-only” in gate docs and keep (b) for full host-driven root.

### `vault_append_daily` double `safeParse` (code review)

Handler uses `vaultAppendDailyInputSchema.safeParse` while other tools rely on MCP/schema validation only.

- **Class:** (a) Epic 6 (align on one validation pattern).

### Optional regression: `vault_append_daily` identical H2 headings (4-6)

Assert first-wins splice when two level-2 headings share the same title.

- **Class:** (a) Epic 6 optional (good fit for fixture integration tests).

### `normalizeAbsolute` duplication (5-1 review)

Identical helper in `audit-logger.ts` and `vault-move.ts`; consolidate in a shared utility when touching either area.

- **Class:** (a) Epic 6 optional or (b) if not picked up.

---

## Phase 2 backlog (detail)

### `vault_move` wikilink repair is O(number of `.md` files)

Known operational characteristic; acceptable for Phase 1-scale vaults.

- **Class:** (b)

### Duplicated PAKE type enums

Same literals in `register-vault-io-tools.ts` and tool modules; refactor to shared schema/constants.

- **Class:** (b) if not addressed in Epic 6; else fold into (a).

### Vault root at filesystem root (`/`)

Boundary checks are meaningless; prefer operator documentation and optional explicit rejection in a later hardening pass.

- **Class:** (b) default; (a) only if Epic 6 verification adds a concrete test and product decision.

### Nexus trust-guard patch (`nexus-discord-trust-guard.sh`)

Update `nexus-discord-trust-guard.sh` (NEXUS repo) to detect **`needs_configure`** state after Claude Code updates. Patch is documented. Apply after testing in a non-critical session.

- **Class:** (b) Phase 2 (operator / NEXUS repo maintenance; not Omnipotent vault-io code).

### Nexus Full Guide: Symptom E and post-update reconnection

Update `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md` with **Symptom E** and a **trust-guard post-update reconnection** section (so operators know what to do after Claude Code or plugin changes).

- **Class:** (b) Phase 2 (documentation in this repo).

### `vault_create_note` placement vs project subfolders (NotebookLM / MCP workflow)

`vault_create_note` routes by `pake_type` only and ignores subdirectory path in the requested target — use `vault_move` after creation to place notes in project subfolders.

- **Class:** (b) Phase 2 / operator workflow (documented workaround; Story 10-1 smoke verified).

### Firecrawl URL result volatility (topic/search quality)

Repeated runs of the same research prompt can yield **different source URLs** from Firecrawl, causing downstream note sets (and derived scoring/gates) to vary even when the chain architecture is stable. Treat this as a **topic/search result quality** issue (source selection / ranking / dedupe), not a chain correctness defect.

- **Class:** (b) Phase 2 backlog (research source quality + stability / dedupe policy).

---

## Closed / resolved (detail)

### Symlink / realpath for reads (3-1 deferral)

Read tools used lexical resolution only; symlink escape on read was deferred. **Resolved** by Story **4-9** (`read-boundary.ts`, canonical read path aligned with WriteGate policy).

- **Class:** (c)

### Pre–Epic 5 “deferred to Epic 5.2” audit comments

Mutators now call `AuditLogger` / `appendRecord`; `vault_log_action` registered. **Resolved** by Epic **5**.

- **Class:** (c)

### Error-path `vaultMove` tests without `_meta/logs` (5-1 review)

Passes because errors throw before audit; fragile if audit moves earlier in the flow. **Accepted for Phase 1.**

- **Class:** (c) (explicitly accepted debt; not blocking Epic 6 unless behaviour changes)

---

## Deferred from: code review of 12-1-brain-service-scope-charter-phase-21 (2026-04-13)

- Nexus-origin note detection mechanism undefined: no reliable signal exists to identify Nexus-created notes at indexing time; needs a follow-on story to define markers (e.g., `creation_method: nexus` or `source_surface` frontmatter)
- Non-markdown/binary files in candidate subtrees: charter does not scope file types for embedding; implementation detail for the embeddings pipeline story
- `_README.md` contract manifests in included subtrees: could be embedded as knowledge content; needs implementation-level exclusion or explicit carve-out
- No consistency model for concurrent mutation during index build: vault writes during indexing could cause mixed-state index; implementation concern for pipeline story
- Embedding model version not in index manifest: model change silently invalidates all existing vectors; add model identifier to manifest spec in follow-on
- `pake_type` filter behavior for unknown/missing types: notes with malformed, missing, or future `pake_type` values have no defined handling; schema evolution edge case
- Query result provenance staleness after vault_move: path references in query results may become stale; solve in query API story
- Operator allowlist placement vs. protected path exclusion: natural locations for Brain config (`_meta/`, `AI-Context/`) are both excluded by default, creating a bootstrapping problem; solve in allowlist contract story

---

## Deferred from: code review of story 13-1 (2026-04-13)

- Tool count "9 tools" vs previously stated "8" — Section 8 claims 9 tools but repo CLAUDE.md and Phase 1 spec say eight standardized tools; verify which is correct
- Date skew: AGENTS "Last updated: 2026-04-10" vs sprint-status "2026-04-13" — different clocks for different documents; define an authoritative timestamp policy (and/or regenerate derived timestamps from one source)

---

## Deferred from: code review of 14-1-multi-model-routing-pre-architecture-readout.md (2026-04-13)

- (none — review `decision-needed` items were resolved; `patch` items were fixed in-repo)

---

## Deferred from: code review of story 13-1 (2026-04-13) — follow-ups

- Mirror duplication tax — AGENTS.md and module files are duplicated across vault and specs/ trees; no mechanical enforcement of sync; consider a sync script or single-source-of-truth restructuring
- Section 8 rewrite scope bundled with 13.1 diff — the uncommitted diff conflates Section 8 changes (likely from story 12.1) with 13.1 mobile work; should be committed separately
- "171 tests" as a moving target — embedding a specific test count in AGENTS.md creates staleness risk on every test addition/deletion
- Sprint-status adds epics 12-14 without corresponding planning artifacts in the diff — verify epics.md and story files exist for all tracked entries
- Retros marked done (epics 9-11) without retro artifacts visible in the diff — confirm artifacts exist or reclassify as optional
- Thin retrieval and Mem0 backlog items lack measurable acceptance gates — define objective thresholds before these enter active sprint
- specs/cns-vault-contract/README.md files table doesn't mention mobile-posture module — extend modules listing when README is next updated
- AGENTS "Adding New Modules" boilerplate doesn't acknowledge mobile module already exists — consider rewording the forward-looking text

---

## Deferred from: code review of 12-5-index-manifest-and-drift-signals (2026-04-14)

- Persist per-file index-time `mtimeMs` values in the manifest so future consumers can compare a specific file's current mtime against the indexed value, not only global freshness aggregates

---

## Deferred from: code review of 12-6-retrieval-query-api-read-only (2026-04-15)

- CLI always uses StubEmbedder — `query-index-cli.ts` hardcodes `new StubEmbedder()`; running `npm run brain:query` against a real-embedder-built index produces meaningless scores. Wire a real embedder adapter when the production embedder story ships.
- No path normalization or vault-relative validation on result paths — results return `rec.path` verbatim from the index artifact; if the index contains absolute or non-POSIX paths they pass through. Trust boundary belongs to the indexing pipeline (Story 12.4), not this read-only layer.

---

## Deferred from: code review of 17-2-research-agent-firecrawl-apify-sweep (2026-04-18)

- AC2 “scrape each URL” vs depth modes — story Implementation Guide documents snippet vs full scrape by depth; implementation matches the guide; AC2 prose is tighter than the guide.
- ~~Query-level Firecrawl/Apify adapter throws leave no `notes_skipped` manifest row~~ — **Resolved in 17-2 (2026-04-18):** synthetic `urn:cns:research-sweep:{firecrawl|apify}:query:…` entries with `fetch_error`.
- `perplexity_skipped === false` means the probe call succeeded, not that any note has `source: "perplexity"` — document for Story 17-3 synthesis handoff.
- Apify text-only ingests can yield `notes_skipped[].source_uri === ""` — text sources have no canonical URI; consumers should tolerate empty strings.

---

## Deferred from: code review of 17-3-synthesis-agent-patterns-gaps-opportunities (2026-04-18)

- **Audit timestamp source split:** `synthesis_run` / `synthesis_skipped` use caller `isoUtc` (run start), while pipeline `ingest` uses default log time; long runs can skew bracket ordering vs strict causality.
- **Wikilink basename collisions:** synthesis body uses `[[basename]]` only; duplicate stems in different folders produce ambiguous Obsidian links unless vault naming avoids collisions.
- **No runtime Zod for `SynthesisRunResult`:** consider exported schema when 17-4 consumes untyped JSON.
- **AC5 `fetched_content` wording:** text path correctly uses `input` as body; `fetched_content` unused for `source_type: "text"` — align story AC prose when convenient.
- **`synthesisAdapterOutputSchema` non-strict:** unknown adapter keys stripped without error; use `.strict()` only if stricter adapter contracts are desired.

---

## Deferred from: code review of 17-6-answer-filing-insight-synthesis-notes (2026-04-18)

- **Bare-host / non-URL-shaped citations:** `canonUrlKey` only accepts `http(s)://…` or `www.…` prefixes before `new URL`. Model citations without a scheme do not match acquisition `source_uri`, so vault backlinks and SynthesisNote thresholding may under-trigger until normalisation is extended or operators document URL-shaped citations only.

---

## Deferred from: code review of 21-2-pre-run-hygiene-automation (2026-04-29)

- Prefix-cleanup casing/separator quirks (`.MD`, case-sensitive prefixes, `relDir` separator mixing) — behavior is acceptable per current ACs but may surprise operators on Windows/WSL
- Windows/WSL file-lock (`EPERM`) cleanup failures are recorded only as “skipped” without reasons — consider richer skipped diagnostics under an opt-in verbose mode

---

## Deferred from: code review of 22-1-perplexity-formal-mcp (2026-04-30)

- `perplexityProbe()` tries only the first query; a single transient Perplexity failure marks `perplexity_skipped=true` for the entire sweep. Consider retrying, probing more than one query, or treating probe failure as “service degraded” while still attempting filing for other queries.

---

## Deferred from: code review of story 18-8 (2026-04-21)

- Add jitter / backoff strategy to reduce thundering herd on 429s (avoid synchronized retries across parallel runs); current clamp+sleep is acceptable but could still cause repeat collisions.

---

## Historical notes (archived context)

The following paragraphs record **pre-triage** notes (2026-04-02) for audit trail only; the tables above supersede them.

<details>
<summary>Pre–Epic 5 triage excerpt (superseded)</summary>

Epic 5 audit scope from code: no `TODO.*audit` in `src/`; deferrals were “deferred to Epic 5.2” in mutator tools (now closed). Placement table previously suggested CLI move verification and `IO_ERROR` hygiene for Epic 6; this file now classifies them formally as **(a)**.

</details>
