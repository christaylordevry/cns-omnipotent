# Deferred work

## Deferred from: code review of 68-8-live-digest-validation (2026-06-11)

- No `--people-done` CLI flag for C6 when 68-2/68-3 ship — backlog waiver path sufficient until people stories land.
- No tests for `detectXStatusFromCheckScript` or `runValidateEpic68Digest` mock path — story marks integration smoke optional; pure-function coverage adequate for T1/T2 gate.
- Empty signals array undifferentiated from partial ingest failure — operator diagnostic polish; live run will surface via script error or FAIL rows.
- `tryRecoverFromArtifact` always returns exitCode 0 on failed recovery — pre-existing watchdog behavior; 68-8 only exported `postQuery`.
- Non-UTM query params bypass C5/dedup normalize — pre-existing `normalizeDigestUrl` scope in dedupe pipeline.

## Deferred from: code review of 68-7-x-integration-env-docs (2026-06-11)

- Partial warning guard lacks `sawSuccess` check — dead branch given current loop structure; only risky if aggregation refactored.
- Double `applyXCredentialEnv` in `--check` path — idempotent today; mirrors main fetch path.
- `isSessionInvalidError` treats JSON parse errors as session-invalid — pre-existing 68-6 behavior; may cause false rotation on transient CDN errors.
- `hermes-run-x-check.sh` empty `OPERATOR_HOME` edge case — same pattern as `hermes-run-x.sh`; container root HOME unlikely on operator WSL.

## Deferred from: code review of 68-6-x-twitter-adapter-source-11 (2026-06-11)

- `quoteCount` always 0 on live bird-search path — vendor `mapTweetResult` does not populate quotes; 5% scoring weight inert until vendor patch.
- Day-granular `since:YYYY-MM-DD` without post-fetch hour filter — AC 2 explicitly binds date-only `since:`; Bluesky-style `filterByLookback` out of spec for this story.

## Deferred from: code review of 68-5-bluesky-adapter-source-12 (2026-06-11)

- Terminal timeout budget vs 8 default actors — 45s Hermes timeout vs worst-case ~240s serial fetch; operator can trim `MORNING_DIGEST_BSKY_ACTORS`.
- Feed pagination capped at FEED_LIMIT=50 per author — high-volume authors may omit in-window posts beyond first page; acceptable v1 scope.
- Reply/repost-only feed entries may map poorly — `mapFeedPost` reads `record.text` only; v1 getAuthorFeed scope.
- Custom AppView host has no allowlist — operator-controlled env override; same trust model as other ingest endpoints.
- Empty `posts[]` after successful HTTP without `error` key — task-prompt treats empty array as agent-layer failure; consistent with other adapters.
- Duplicate bluesky cap tests in adapter + score-signals suites — maintenance drift only.

## Deferred from: code review of 68-1-cross-source-dedup-engine (2026-06-11)

- Entity match merges distinct stories sharing ≥2 proper nouns within 24h — spec-compliant per AC #1 rule 4 / addendum A4; quality tradeoff deferred.
- Union-find transitive title clustering can merge A–C when only A–B and B–C exceed Jaccard threshold — inherent to incremental clustering; acceptable for v1.

## Deferred from: code review of 67-9-fix-hermes-gateway-stale-pid-lock (2026-06-11)

- PID reuse after WSL suspend can fool `kill -0` — accepted limitation; flock/TOCTOU hardening out of scope (36-1 defer).
- Watchdog/@reboot TOCTOU double-start window — flock out of scope per story AC idempotent best-effort.

## Session kickoff — 2026-06-11 (Epic 67 live validation)

**Context:** Story **67-7** (prompt/skill hardening) is **done** in repo — contract tests green, Hermes skill synced. Core ingest pipeline (adapters, scoring, Convex validators, env vars) is solid. Remaining failures are **prompt-level execution reliability** — agents still deviate under context compression despite task-prompt guards. Further hardening may follow; do not reopen adapter scripts unless cron evidence proves a script defect.

**First real validation:** **07:00 machine-local cron** (`morning-digest cron:…`) — inspect Discord `#hermes` post + Convex `digestRuns` / `digestSignals` after run.

| # | Open item (observed pre-67-7 live) | What to check tomorrow |
|---|-----------------------------------|------------------------|
| 1 | **Product Hunt section missing** from digest Discord output | `**Product Hunt**` header present; `hermes-run-producthunt.sh` terminal fired; `(source unavailable)` vs bullets |
| 2 | **§9 Convex push not firing** via `push-digest-convex.mjs` | `digestRuns` row for run date; `digestSignals` populated; Hermes logs for `PUSH_SCRIPT` / `push-digest-convex` terminal (not improvised HTTP/MCP) |
| 3 | **GitHub format** — link previews vs bullets | Discord shows `- owner/repo — N stars, M forks` not bare `https://github.com/…` URL cards |
| 4 | **07:00 cron** | End-to-end: Sources 9–10 before Source 6, full Output Contract, §9+§10 push terminals |

**If cron passes all four:** close live-validation loop; consider **67-6** compare smoke or Epic 67 retro. **If any fail:** capture Discord transcript + Convex state; next story is likely another prompt-orchestration tighten (not adapter rewrite).

## Deferred from: code review of 67-5-producthunt-adapter-source-10 (2026-06-10)

- Empty/malformed GraphQL shape returns `{launches:[]}` not `{error}` — task-prompt step 5 treats empty launches as failure; optional adapter hardening.
- `hermes-run-github.sh` lacks HOME remap — pre-existing; not introduced by 67-5 (producthunt correctly mirrors newsapi).

## Deferred from: code review of 65-9-surface-intelligence-scoring-inspector-drawer (2026-06-09)

- Scoring panel absent during `getDigestSignalsForRun` fetch with no loading indicator — matches 63-5 drawer defer pattern; optional polish story.
- Rank fallback when keyword misses shows highest `rankScore` in run — by design per T1.2; operator brief accepts run-level fallback.

## Deferred from: code review of 65-8-build-digest-signals-github-reddit-caps (2026-06-09)

- `signalsFromParsedInput` guard path untested for github/reddit/rss-only payloads — AC4 satisfied in code; CLI regression test optional hardening.
- Title-less top-N-by-engagement entries consume slice slots without backfill — matches `extractRssSignals` pattern; AC allows "up to 2".
- Cap-10 eviction can exclude github/reddit/rss when upstream sources fill pool — architectural §7.3 priority order (new sources lowest).

## Deferred from: code review of 65-6-fix-hn-typeerror-morning-digest-task-prompt (2026-06-09)

- Sources 7–9 still use passive "Parse stdout JSON" bullets — same stdout-threading bug class as pre-65-6 HN; out of 65-6 scope.
- Output contract / SKILL template omit GitHub, Reddit, RSS Discord sections — separate UX story per 65-6 Out of scope.

## Deferred from: code review of 65-3-reddit-credential-adapter (2026-06-09)

- `r/` prefix in `MORNING_DIGEST_REDDIT_SUBREDDITS` corrupts OAuth URL silently — operator misconfig; story docs say omit `r/` prefix; strip guard optional in future hardening.

## Deferred from: code review of 65-2-reddit-public-json-spike (2026-06-09)

- Network/timeout failures labeled `parse-error` — spec allows indicator; distinct `timeout`/`network-error` would aid ops but not required for gate script.
- No upper bound on spike cycles or inter-cycle delay — mis-set env could run unbounded; operator config responsibility for gate script.

## Deferred from: code review of 64-2-scoring-engine-five-dimensions (2026-06-09)

- Novelty rule 65 (same `sourceType` in history) unreachable when `DIGEST_NOVELTY_HISTORY_JSON` is normative `string[]` without `sourceType` — scores 90 instead of 65 until 64-5 orchestration enriches history entries; object[] path tested in 64-2.

## Deferred from: code review of 64-7-arxiv-env-fix (2026-06-08)

- Unreachable `{ papers: [] }` fallback in `runArxivFetch` after defaults populate categories in `loadArxivConfig` — harmless dead code at `fetch-arxiv-rss.mjs:333`.
- 64-6 commit landed wrapper HOME assertions before `hermes-run-arxiv.sh` remap — HEAD red until 64-7 wrapper patch is committed.

## Deferred from: code review of 62-1-keyword-candidates-from-digest-signals (2026-06-06)

- `postMutation` duplicated from `push-digest-convex.mjs` — AC allows inline copy when under ~40 lines; shared `convex-http.mjs` extraction deferred unless duplication grows.
- `.unique()` on `by_term` throws if duplicate rows exist — story marks duplicate-row index race as acceptable Phase 1 risk; first-match patch deferred.
- No convexTest for server-side term normalization (whitespace collapse) — mutation implements normalize; happy-path term only tested.

## Deferred from: code review of 61-5-morning-digest-convex-push (2026-06-05)

- Duplicate `digestRuns` per date — no unique constraint or idempotency guard; feed consumer should pick latest by `ranAt` in a future epic.
- `shortSha256Hex` delimiter collision — `parts.join('')` matches spec's `sha256(keyword + date)` concatenation; delimiter fix requires spec change.
- `section` / `sourceType` pairing not enforced at Convex — mapping is Hermes agent contract; server-side cross-validator deferred.

## Deferred from: code review of 61-4-morning-digest-hackernews-source (2026-06-05)

- Story completion notes cite "505 tests pass" but `npm test` reports 642 — documentation drift in Dev Agent Record only; no code impact.

## Deferred from: code review of 61-2-fix-vault-context-notebook-title-routing (2026-06-05)

- Comma inside notebook title silently truncates title map — spec uses comma delimiter between entries; titles containing commas not supported without format change.
- Duplicate prefix key in NOTEBOOKLM_NOTEBOOK_TITLES silently overwrites — operator config edge; production map uses unique 8-char prefixes.
- Shorter prefix shadows longer prefix by Map insertion order — production uses non-overlapping hex prefixes only.
- Two registry rows sharing same prefix receive identical overlay title — UUID prefix uniqueness in production registry prevents collision.
- mergeTrendIngestEnv EPERM/parse errors swallowed — pre-existing 61-1 pattern; unreadable trend-ingest.env indistinguishable from absent file.
- CNS_NOTEBOOK_REGISTRY_PATH in trend-ingest.env ignored by pick-signal-notebook CLI — parseRegistryPath runs before mergeTrendIngestEnv; pre-existing asymmetry outside 61-2 file list.
- Unbalanced quotes in parseEnvFile produce prefix with leading quote — pre-existing fetch-arxiv-rss parser; overlay silently no-ops.
- AC3 file-first CLI integration test absent — AC6 table marks file-load CLI path optional; mergeTrendIngestEnv unit-tested in 61-1.

## Deferred from: code review of 61-1-morning-digest-arxiv-source (2026-06-04)

- Partial per-category RSS failure returns papers from successful categories without `error` — acceptable when at least one feed succeeds; operator may not see which category failed.

## Deferred from: code review of 57-3-vault-lint-result-auto-memory (2026-06-02)

- No CLI subprocess integration test — AC 7 table only requires script presence; lib paths covered in `vault-lint-memory-patch.test.mjs`.
- `findCnsStateRegion` prefix `indexOf("## CNS State")` could match unintended headings — inherited from 57-2; MEMORY schema uses canonical heading.

## Deferred from: code review of 57-2-session-close-memory-md-auto-update (2026-06-02)

- Gate stdout does not echo `memory_update` result — operator must read close-report; matches existing gate logging pattern for other steps.
- Cap enforced on UTF-8 byte length not Unicode code-point count — AC wording says "characters"; MEMORY telemetry is ASCII-only in practice.

## Deferred from: code review of 56-5-notebook-queries-convex-table-dedupe (2026-06-02)

- Concurrent duplicate mutation race in `logNotebookQuery` — two parallel HTTP mutations may both pass read-check before either inserts; story Dev Notes mark out of scope; database-level unique constraint deferred.

## Deferred from: code review of 56-4-morning-digest-signal-scoring-improvements (2026-06-02)

- Malformed `DIGEST_SOURCES_JSON` / `SIGNALS_JSON` parse errors yield silent `[]` → `NO_ROUTE` — parity with pre-56-4 behavior; optional stderr warning in a future ops-hardening story.

## Deferred from: code review of 56-3-session-close-fan-out-error-class-dashboard-widget (2026-06-02)

- Part B Knowledge Pulse badge overlay (AC 6) — separate Cursor session per story split; T7/T8.
- `lastFanoutAt` uses report `generated_at` from Phase A write, not Phase C fan-out completion — accepted next-close visibility model in story Dev Notes.

## Deferred from: code review of 56-1-notebooklm-routing-threshold-tuning (2026-06-02)

- `read-sources.mjs` `smartRoute` still uses hard-only `scoreNotebooks` + `disambiguateRoute` — morning digest and `/notebook-query` now soft-route; session-close fan-out parity is a follow-up outside 56-1 file list.
- Soft-route path double-scores via `scoreNotebooks` then `rankAllMatches` — acceptable for now; cache ranked result if hot path matters.
- `belowThresholdReason(null)` maps to `no_watched_notebooks` — misleading label but unreachable given resolver/pick-signal pre-checks.

## Deferred from: code review of 55-3-morning-digest-cron-automation (2026-06-02)

- SKILL.md still documents 08:00 machine-local default — out of 55-3 scope; track as doc follow-up.
- Gateway status grep substring brittleness — matches existing 26-7 launcher pattern.
- E2E `#hermes` digest smoke deferred in dev record — operational gate when gateway restarts.
- Concurrent install race without flock — not in sibling cron installers.
- Log rotation / failure alerting absent — pre-existing cron pattern across CNS installers.
- Optional env overrides (`MORNING_DIGEST_SKILL_CRON_*`) undocumented in Operator Guide — minor.

## Deferred from: code review of 55-2-google-trends-normalized-value-fix (2026-06-02)

- Sub-0.5 mean rounds to zero indistinguishable from true all-zero window — watchlist not affected; optional future metadata for pre-round mean.
- Fetch tests omit `isPartial` row filtering — mocks lack `.index`/`.loc`; production filter at L744–745 unchanged.
- Missing `isPartial` column includes incomplete hour in mean — pytrends frame-shape dependency; no fallback today.
- NaN/non-numeric series values raise unhandled exceptions in aggregation — corrupt-frame gap predates 55-2.

## Deferred from: code review of 54-4-trigger-contract-audit (2026-06-02)

- Contract test scans only first 120 lines of SKILL.md for REFERENCE ONLY — AC 6 sketch; full-file scan is follow-up hardening.
- `references/trigger-pattern.md` not in contract manifest — AC 6 scope is task-prompt + SKILL; operator-doc footers tracked separately.
- `session-close/references/trigger-pattern.md` lacks REFERENCE ONLY banner — SKILL.md fixed; operator doc optional follow-up.

## Deferred from: code review of 54-3-session-close-fan-out-diagnostics (2026-06-01)

- Broad `\bexceeds\b` size_limit classifier rule — bound by story AC2 hint table; rare misclassify on non-size "exceeds" strings in stderr.

## Deferred from: code review of 54-2-notebook-query-convex-log-reliability (2026-06-01)

- 15s log `terminal` timeout vs slow Convex HTTP — operator brief explicitly requires 15s cap (AC 1/2).
- Large `NOTEBOOK_ANSWER` shell env / ARG_MAX — inherited 52-2 `shellQuote` pattern; not introduced by 54-2.

## Deferred from: code review of 60-1-fix-verify-sh-hermes-skill-parity-gate (2026-06-04)

- Duplicate Behavioral Integrity changelog rows in `specs/cns-vault-contract/AGENTS.md` — pre-existing version-churn pattern; not introduced by 60-1.
- morning-digest install `cp` fallback lacks session-close's explicit stale-file `rm` — rsync path is primary on operator workstations; non-rsync edge rare.

## Deferred from: code review of 54-1-skill-install-gate (2026-06-01)

- `vault-fast-scan-index.md` date bump alongside Operator Guide §15.12 — incidental index maintenance, not story File List.
- ~~notebook-query / morning-digest install scripts still use `cp` without `--delete`~~ — **Resolved Story 60-1 (2026-06-04):** `install-hermes-skill-morning-digest.sh` now uses `rsync -a --delete` (session-close already had rsync). notebook-query install still `cp` without `--delete` if unchanged.

## Deferred from: code review of 53-3-add-reason-field-to-no-route-responses (2026-06-01)

- `below_threshold: best=unknown (0.00)` when `watch: true` rows exist but none pass `validRegistryRow` — mislabels registry corruption as weak semantic match; no test coverage.
- Unescaped notebook titles in `route.reason` (`)`, `=`, newlines) — Discord/regex parsing risk for operators.

## Deferred from: code review of 52-2-morning-digest-notebooklm-convex-log (2026-05-31)

- Fire-and-forget via awaited `terminal(timeout=30)` — same 51-2 pattern; Hermes agent semantics, not a 52-2 regression.
- No idempotency/dedupe on `notebookQueries` rows — out of scope for 52-2; same as `/notebook-query` log path.
- `pickSignalNotebook()` export lacks domain enrichment (CLI-only) — no non-CLI consumer today.
- `OMNIPOTENT_REPO` vs `CNS_REPO_ROOT` env split — pre-existing 52-1 Source 4 wiring.
- `readLogPayload` trims `NOTEBOOK_ANSWER` — pre-existing 51-2 log script; AC "verbatim" means pre-Discord-truncation, not no-trim.
- Large `NOTEBOOK_ANSWER` shell env / ARG_MAX — pre-existing 51-2 pattern; Convex truncates at insert.

## Deferred from: code review of 51-1-notebook-query-discord-command (2026-05-30)

- `CNS_REPO_ROOT` controls dynamic import path — operator-trusted env; same deployment model as session-close (`resolve-notebook.mjs`).
- `argv[3]` registry path override — only Hermes `execute_code` invokes script; not Discord-exposed (`resolve-notebook.mjs`).
- Install `cp -R` fallback permissions — matches `install-hermes-skill-investigate-trend.sh` pattern (`install-hermes-skill-notebook-query.sh`).

## Deferred from: code review of 50-1-notebook-registry-sync (2026-05-29)

- Stable sort order for `notebook-registry.json` output (e.g. by `id`) — not required by story AC; optional for cleaner git diffs on operator sync.

## Deferred from: code review of 48-4-session-close-apply-section8-agents-sync (2026-05-28)

- `indexOf("## 8.")` section boundaries are shared with `prepare-context.mjs` and `read-sources.mjs`; prefer `## 8. Current Focus` anchoring in a single shared helper when tightening regex drift mitigation.
- Golden tests use inline assertions rather than a committed expected-output bytes fixture; acceptable for SC-4 verify AC.

## Deferred from: code review of 48-3-session-close-memory-and-daily-rhythm-scripts (2026-05-28)

- `AUTO:AGENTS_VERSION` reflects pre-`apply-section8` AGENTS during Phase A — SC-4/SC-5 will reorder full close; story AC 5 already allows fixture timing.
- Full ADR step 6–7 after §8 apply not enforced in `run-deterministic.mjs` — documented; Hermes skill SC-5 owns end-to-end ordering.
- No non–dry-run orchestrator E2E test for memory/rhythm — covered by script unit tests and `verify.sh`.

## Deferred from: code review of 48-2-session-close-deterministic-orchestrator (2026-05-28)

- No integration test for partial close on export or test failure — Story AC verify only required dry-run orchestrator fixture.
- Vitest summary regex is format-specific — only `Tests N passed` recognized; other vitest output yields false `failure_class: tests`.
- `npm-env.sh` hardcodes Node `v24.14.0` fallback when nvm has no versions — matches 43-1 pattern.

## Deferred from: code review of 48-1-session-close-context-pack-scaffold (2026-05-28)

- Hardcoded `DEFAULT_OMNIPOTENT_REPO` / `DEFAULT_CNS_VAULT_ROOT` in `paths.mjs` — matches ADR operator defaults; env overrides are the supported portability path.

**Triaged:** 2026-04-02 (before Epic 6).  
**Classification key:** **(a)** Epic 6 scope, **(b)** Phase 2 backlog (or operator-only docs), **(c)** closed or resolved by shipped work (Epics 4–5 and earlier).

**Note:** This document was originally written as a pre–Epic 6 triage queue. **Epic 6 has since shipped**, so the former “Epic 6 intake” items below are now either **closed** (moved to class **(c)**) or explicitly reclassified into **Phase 2** backlog (**(b)**) where applicable.

---

## Summary table

| Item (short) | Class |
|--------------|-------|
| `vault_move` + Obsidian CLI: after exit 0, assert source gone (`ENOENT`) | (c) Closed (Story 7-1) |
| Intentional `IO_ERROR` / `CnsError` messages not sanitised (4-8) | (c) Closed (Story 6-4) |
| `vaultRootFromHost` not wired at stdio (3-1) | (c) Closed (Story 6-5 env-only policy) |
| `vault_append_daily` double `safeParse` in register handler | (c) Closed (Story 6-6 safeParse removal) |
| Optional regression: two identical H2 headings, first-wins splice (4-6) | (c) Closed (Story 6-6 regression addressed) |
| `normalizeAbsolute` duplicated (`audit-logger` / `vault-move`) | (b) Phase 2 hygiene (optional refactor) |
| Error-path `vaultMove` tests omit `_meta/logs` pre-create | (c) Accepted Phase 1 risk; reopen if audit runs earlier |
| `vault_move` wikilink repair O(n) per move | (b) Phase 2 at scale |
| Duplicated PAKE type enums (register + tools) | (b) Phase 2 hygiene |
| Vault root at filesystem `/` (meaningless boundary) | (b) operator docs + optional hardening |
| Nexus trust-guard: detect `needs_configure` after Claude Code updates (NEXUS repo script) | (b) Phase 2 |
| `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`: Symptom E + trust-guard post-update reconnection | (b) Phase 2 |
| `vault_create_note` routes by `pake_type` only; ignores subdirectory path — use `vault_move` after creation for project subfolders | (b) Phase 2 / operator workflow |
| Vault-lint Rule 2 filename-stem matching — display-text/title wikilinks not counted (37-2: 23 orphans baseline) | (b) Phase 2 backlog |
| CNS-Daily-Rhythm.md auto-update from session-close `AUTO` blocks | (b) Architecture, Medium |
| Weekly autonomous business report cron | (b) Architecture, Medium, Epic 41 |
| Composio MCP for client delivery | (b) Architecture, High when first client onboarded, Epic 41 |
| Hermes morning health ping | (b) Ops, Low |
| Epic 42 tech stack: SvelteKit + Convex | (b) Architecture, Low, Epic 42 |
| `hermes-url-auto-capture-inbox`: SKILL/config-snippet/capture-prompt still use `/approve`, `/execute-approved` | (c) Closed by 35-1 |
| `vault-think` SKILL.md Pitfalls section on installed copy only (not repo mirror) | (c) Closed — no drift found in either copy |
| Symlink / `realpath` on reads | (c) Resolved: Story 4-9 |
| “Deferred to Epic 5.2” audit wiring in mutators | (c) Resolved: Epic 5 |

---

## Deferred from: code review of 45-6-arima-forecasting (2026-05-27)

- **ARIMA trains on value sequence only, not calendar spacing** (`convex/lib/predictiveAnalytics.ts`) — architecture assumes ~daily signals; irregular or multiple signals per day are treated as sequential observations without time-axis modeling.

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

## Epic 6 intake (detail) — archived

### `vault_move` Obsidian CLI success path (4-7 review)

After CLI exit 0 and destination checks, **verify the source path no longer exists** (`stat` → `ENOENT`) so a broken CLI cannot leave a duplicate at the source while appearing successful.

- **Class:** (c) Closed (Story 7-1).

### `IO_ERROR` / `CnsError` message sanitisation (4-8)

`handleToolInvocationCatch` normalises non-`CnsError` throws; **domain `CnsError("IO_ERROR", …)` messages may still embed internal paths or backend detail**. Review before trusting the verification gate on “safe” error text for operators or future external surfaces.

- **Class:** (c) Closed (Story 6-4).

### `vaultRootFromHost` not wired at stdio (3-1)

Optional MCP host `vaultRoot`; defer until host/SDK exposes initialization config for the server process.

- **Class:** (c) Closed (Story 6-5 documented env-only policy).

### `vault_append_daily` double `safeParse` (code review)

Handler uses `vaultAppendDailyInputSchema.safeParse` while other tools rely on MCP/schema validation only.

- **Class:** (c) Closed (Story 6-6).

### Optional regression: `vault_append_daily` identical H2 headings (4-6)

Assert first-wins splice when two level-2 headings share the same title.

- **Class:** (c) Closed (Story 6-6).

### `normalizeAbsolute` duplication (5-1 review)

Identical helper in `audit-logger.ts` and `vault-move.ts`; consolidate in a shared utility when touching either area.

- **Class:** (b) Phase 2 hygiene (optional refactor).

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

### Per-skill Hermes model routing

Haiku for triage/graduate/vault-lint/session-close; Sonnet for vault-think/verify/run-chain. Blocked on Hermes native per-skill model API. Policy documented in MEMORY.md.

- **Class:** (b) Phase 2 backlog

### `vault-lint-remediate-34-2.ts` `--verify-only`

Add flag to skip `parseRule4Paths` when report shows Rule 4 = 0.

- **Class:** (b) XS effort. Source: 34-2 code review.

### MCP `vault_create_note` explicit path support

Hub/manifest creates currently require `vaultCreateNoteFromMarkdown` internal pipeline; MCP surface still routes by `pake_type` only.

- **Class:** (b) L effort. Source: 35-3 code review.

### Vault-lint Rule 2 filename-stem matching

Orphan checker requires exact `[[filename-stem]]` wikilinks, not display-text or title-based links. Topic hubs use readable names; **23** perplexity research notes remain flagged as orphans after Story **37-2** (vault warnings **69 → 23**). Fix options: (a) regenerate hubs with exact stems, (b) add title-based matching to vault-lint Rule 2.

- **Class:** (b) Phase 2 backlog. Source: Story 37-2 close-out (2026-05-21).

### CNS-Daily-Rhythm.md auto-update from session-close

Extend `session-close` to find and replace `<!-- AUTO:xxx -->` blocks in `AI-Context/CNS-Daily-Rhythm.md` with live system state.

- **Class:** (b) Architecture.
- **Priority:** Medium.

### Weekly autonomous business report cron

Add a Hermes cron skill that reads `02-Areas/Business/performance-log.md`, runs `emerge`, synthesises a weekly state-of-operator report, files it to the vault, and pings `<#1500733488897462382>`.

- **Class:** (b) Architecture.
- **Priority:** Medium.
- **Epic:** 41.

### Composio MCP for client delivery

Evaluate or add Composio MCP as a single connector to 1000+ apps, including client auth handling. Required for agency service delivery.

- **Class:** (b) Architecture.
- **Priority:** High when first client is onboarded.
- **Epic:** 41.

### Hermes morning health ping

Add a cron skill that checks Hermes gateway status each morning and pings `<#1500733488897462382>` if anything broke overnight.

- **Class:** (b) Ops.
- **Priority:** Low.

### Epic 42 tech stack: SvelteKit + Convex

Use SvelteKit + Convex for Epic 42 rather than Next.js + Supabase. Rationale: agent has better context on Svelte because it is HTML and TypeScript native; Convex keeps backend state, schema, and functions in code, giving agents complete project context.

- **Class:** (b) Architecture.
- **Priority:** Low.
- **Epic:** 42.

---

## Closed / resolved (detail)

### Strict URL normalization for dedup guard (29-6 deferral)

`normalizeSourceUriForDedup` handled only http→https and trailing slashes; query strings, `www.`, and fragments were deferred. **Resolved** by Story **31-2** (`src/ingest/duplicate.ts`).

- **Class:** (c)

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

## Deferred from: Epic 30 E2E (Story 30-3, 2026-05-16)

- **`/approve` / `/execute-approved` triage routing** — **Resolved** in triage skill by Story **31-1** (`/triage-approve`, `/triage-execute`). Remaining stale references: `hermes-url-auto-capture-inbox` skill copies (see Story 33-3 deferred items).
- **`vault_create_note` routes by `pake_type` only; ignores caller-specified path** — E2E Inbox test notes must be created via direct filesystem write under `00-Inbox/` (already noted in summary table row 26; reinforced by 30-3 live run).

**Class:** (b) Phase 2 / operator workflow (triage routing resolved 31-1; operator guide resolved 33-3).

---

## Deferred from: code review of 22-1-perplexity-formal-mcp (2026-04-30)

- `perplexityProbe()` tries only the first query; a single transient Perplexity failure marks `perplexity_skipped=true` for the entire sweep. Consider retrying, probing more than one query, or treating probe failure as “service degraded” while still attempting filing for other queries.

---

## Deferred from: code review of story 24-1 (2026-04-30)

- Perplexity MCP adapter: timeout wrapper rejects but does not cancel/kill the underlying stdio process, which can leave hung child processes (`src/adapters/perplexity-mcp-adapter.ts`).
- Apify env var naming inconsistency across code/docs (`APIFY_API_TOKEN` vs `APIFY_TOKEN`) risks false “missing token” diagnoses in operator runs (`scripts/run-chain.ts`, `_bmad-output/implementation-artifacts/16-3-apify-mcp-install-and-live-tool-call-verification.md`).
- Live runner usage strings include inline `FIRECRAWL_API_KEY=...` style assignments that land in shell history, conflicting with the “no secrets in pasted commands” posture (`scripts/run-chain.ts`).

---

## Deferred from: code review of story 18-8 (2026-04-21)

- Add jitter / backoff strategy to reduce thundering herd on 429s (avoid synchronized retries across parallel runs); current clamp+sleep is acceptable but could still cause repeat collisions.

---

## Deferred from: code review of 31-1-triage-command-rename-and-constitution-sync (2026-05-16)

- Operator guide §15.3 still documents legacy `/approve` and `/execute-approved` — **Resolved** by Story **33-3** (Operator Guide v1.29.0; §15.3 marks deprecated names and documents `/triage-approve` / `/triage-execute`).

- **Class:** (c)

---

## Deferred from: Story 33-3 operator-guide-phase6-completeness (2026-05-17)

### hermes-url-auto-capture-inbox triage command names stale

`SKILL.md`, `config-snippet.md`, `capture-prompt.md` (repo + installed) still reference `/approve` and `/execute-approved`. Operator Guide §15.3 marks these deprecated correctly. Update all three files to `/triage-approve` / `/triage-execute`.

- **Class:** (c) Closed by 35-1

### vault-think SKILL.md Pitfalls section — installed only

`~/.hermes/skills/cns/vault-think/SKILL.md` has a Pitfalls section absent from `scripts/hermes-skill-examples/vault-think/SKILL.md`. No command or version drift. Mirror on next vault-think touch.

- **Class:** (c) Closed — no drift found in either copy

---

## Deferred from: code review (34-2-vault-lint-remediation-critical-issues.md) (2026-05-17)

- **Duplicated Rule 4 checks in remediation script** — `scripts/vault-lint-remediate-34-2.ts` reimplements `rule4Findings()` from `vault-lint.md`; prefer shared lint module on a future vault-health story.

- **Report JSON coupling in `parseRule4Paths()`** — remediation depends on exact Hermes `Fix:` JSON in `vault-lint-2026-05-17.md`; brittle if report format changes.

---

## Historical notes (archived context)

The following paragraphs record **pre-triage** notes (2026-04-02) for audit trail only; the tables above supersede them.

<details>
<summary>Pre–Epic 5 triage excerpt (superseded)</summary>

Epic 5 audit scope from code: no `TODO.*audit` in `src/`; deferrals were “deferred to Epic 5.2” in mutator tools (now closed). Placement table previously suggested CLI move verification and `IO_ERROR` hygiene for Epic 6; this file now classifies them formally as **(a)**.

</details>

## Deferred from: code review of 34-3-stale-pending-review-via-verify (2026-05-18)

- Evidence UTC vs audit log sub-second skew — cosmetic timestamp display only; no vault or audit integrity impact.

## Deferred from: code review of 35-2-research-cluster-stale-pending-review-via-verify (2026-05-18)

- Evidence UTC vs audit log sub-second skew — cosmetic timestamp display only; no vault or audit integrity impact.

## Deferred from: code review of 35-3-orphan-wikilink-pass-research-index (2026-05-18)

- AC6 authoritative `/vault-lint` post-run — after metrics are simulated in evidence; operator refresh in `#hermes` still required for `_meta/reports/vault-lint-YYYY-MM-DD.md` (same pattern as 34-x stories).

## Deferred from: code review of 36-1-sprint-hygiene-hermes-gateway-auto-start (2026-05-20)

- Fragile `hermes gateway status` text/PID parsing — same class as `hermes-morning-digest.sh`; optional hardening later.
- No post-`nohup` health check — script exits 0 after fork even if gateway dies immediately; manual recovery documented in Operator Guide §15.3.
- TOCTOU on concurrent launcher runs — overlapping `@reboot`/manual runs could double-start; watchdog/flock out of story scope.
- Crontab install not re-verified in review sandbox — Dev Agent Record has excerpt; operator should confirm `crontab -l` on live WSL user.

## Deferred from: code review of 36-2-hermes-skill-parity-pass (2026-05-20)

- Commit bundles non-36-2 changes (36-3 story scaffold, AGENTS.md 2.0.8 bump, 36-1 deferred-work entries, epic-33 retrospective) — violates AC12 one-logical-commit intent; already on history at `0ec1b5b`.
- No CI `diff -rq` parity gate for skill mirrors — same class as pre-36-2 skills; manual `cmp` only.
- New install scripts omit post-install "Next:" hints present on vault-think/session-close — cosmetic consistency only.

## Deferred from: code review of 36-3-projects-areas-stale-pending-hub-indexes (2026-05-20)

- Live vault hub/index not mirrored into repo `Knowledge-Vault-ACTIVE/` fixture — AC14 optional; review could not verify Part B from repo tree alone.

## Deferred from: code review of 37-1-test-artifact-cleanup-03-resources-stale-pending-stamp (2026-05-21)

- No unit test for `scripts/epic-37-1-03-resources-cleanup.ts` — same class as 34-2/36-3 hygiene scripts; `npm test` green but path not exercised.
- Script not idempotent on re-run — second run throws on missing delete targets; acceptable for one-shot batch; optional `--dry-run` or header note.
- Uncommitted `AGENTS.md` / `epics.md` edits outside story File List — exclude from 37-1 commit scope.

## Deferred from: code review of 37-2-03-resources-topic-hub-indexes (2026-05-21)

- AC11 closed (2026-05-21) — Hermes `/vault-lint`: **23** Rule 2 orphans accepted baseline; vault-lint stem-match limitation → Phase 2 backlog (see **Vault-lint Rule 2 filename-stem matching** above).
- Workflow & discovery links beyond AC7–8 minimum — hooks E2E, Gemini PE, Top Github wired for extra orphan edges; not spec violations.
- `appendSectionIfMissing` skips section refresh on re-run — first-run idempotency only.
- Obsidian cluster uses long prefix only — `perplexity-obsidian-pkm` alt not scanned; live run matched 3 notes per evidence.
- No `validatePakeForVaultPath` integration test for `*-hub.md` — path-rule unit test + create test cover contract hub bypass.

## Deferred from: code review of 38-3-prompt-cache-hit-rate-verification (2026-05-22)

- Discord `#hermes` lacks `API call #` lines in `agent.log` (gateway workers) — CLI `-v` satisfies AC4; Hermes upstream/gateway logging gap if Discord parity required.

## Deferred from: code review of 43-1-cns-daily-rhythm-auto-blocks-via-session-close (2026-05-23)

- Step 6 optional `npm run vault:fast-scan` PATH — Hermes PATH gap predates 43-1; fix when centralizing npm prelude in session-close Hard constraints.
- SKILLS_COUNT nested `SKILL.md` dedupe — count rule may double-count parent/child dirs; low risk at current Hermes skill tree scale.

## Deferred from: code review of 38-2-kimi-k2-6-evaluation-run-chain (2026-05-24)

- OpenRouter error-path test parity — Anthropic adapter tests cover HTTP 429, non-JSON, schema-invalid; OpenRouter branch has happy-path + missing-key tests only.
- Duplicated fetch/parse logic in `callAnthropicSynthesis` vs `callOpenRouterSynthesis` — acceptable spike scope; refactor when hook/boss also move to OpenRouter.

## Deferred from: code review of 42-1-scaffold-cns-dashboard-repository (2026-05-24)

- No initial git commit in `cns-dashboard` — staged scaffold only; operator commits per Dev Agent Record.
- Anonymous local Convex deployment — cloud/team linking deferred to Stories 42-2+.

## Deferred from: code review of 42-2-convex-schema-and-ingest-mutation (2026-05-24)

- Unauthenticated public `ingestDashboardSnapshot` mutation — Convex MVP relies on deploy-key-only sync writes; rate-limit/auth deferred to provisioning/ops story.

## Deferred from: code review of 42-3-cns-dashboard-sync-collectors (2026-05-24)

- Hand-mirrored `DashboardSnapshot` types in `scripts/dashboard-sync.ts` can drift from `cns-dashboard/convex/validators.ts` — intentional until CNS may add a shared package; keep manual sync comment discipline.

## Deferred from: code review of 42-4-sync-push-secret-guard-hermes-cron (2026-05-24)

- Log rotation for `~/.hermes/logs/dashboard-sync.log` — append-only cron log will grow unbounded; add logrotate or size cap in ops story.
- Crontab install race without file locking — concurrent `install-dashboard-sync-cron.sh` runs could drop unrelated crontab entries; low frequency operator action.
- Re-chmod existing `~/.hermes/dashboard-sync.env` on reinstall — installer only `chmod 600` on first create; pre-existing loose permissions not corrected.
- NFR-P5 ≤60s sync benchmark on 118+ note vault — no perf test or timeout guard; full vault walk may exceed 60s at scale.
- `flock` guard for overlapping 3-min cron runs — hung or slow sync can overlap next cron tick; enhancement beyond story AC.
- Automated tests for `install-dashboard-sync-cron.sh` — shell installer validated manually; no CI coverage for crontab line shape.

## Deferred from: code review of 42-5-dashboard-shell-and-panel-grid (2026-05-25)

- Add `<svelte:head><title>` for browser tab — not required by 42-5 AC; defer to accessibility polish story.
- Vite Node.js ≥20.19 warning during build — environment/toolchain, not introduced by 42-5 UI.

## Deferred from: code review of 42-6-stale-banner-and-last-sync-chrome (2026-05-25)

- 30s `nowMs` tick can lag staleness banner/header suffix up to one interval — documented in story Dev Notes; acceptable for Phase 1.
- Shell subscribes to full `getDashboardSnapshot` while only consuming `syncMetadata` — intentional until 42-7 wires panels to same query.
- No component/integration tests for `DashboardShell` / `StaleBanner` — story scoped pure-helper unit tests only.
- Background-tab timer throttling for 30s interval — enhancement; revisit if operators report stale chrome stuck after tab resume.

## Deferred from: code review of 42-7-real-time-panel-updates (2026-05-25)

- No Svelte component/integration tests for panel wiring — story scoped pure-helper unit tests only (same as 42-6).
- `dashboard-snapshot.ts` types maintained separately from Convex validators — revisit if Convex→TS codegen is adopted.
- No `aria-live` on panels for live subscription updates — accessibility polish; not required by 42-7 AC.

## Deferred from: code review of 42-9-vercel-production-deploy (2026-05-26)

- Production build allows empty `PUBLIC_CONVEX_URL` — `+layout.svelte` only throws in DEV; Vercel misconfig yields silent broken Convex client until operator fixes env.
- CI does not validate `PUBLIC_CONVEX_URL` at build time — workflow matches local `npm run build`; contract enforced in DEPLOY/Vercel operator steps.
- Vercel password protection may require paid Deployment Protection tier — operator verifies during first provisioning.
- Acceptance checklist FCP gate allows subjective pass — manual Epic 42 gate by design; optional Lighthouse follow-up out of scope.

## Deferred from: code review of 42-10-vault-search (2026-05-26)

- Full-table fallback `collect()` on empty search index — test-only path per story dev notes; production uses Convex `search_metadata` index.
- No Convex auth on `searchNotes` — pre-existing pattern; no `ctx.auth` on any dashboard query in Epic 42.

## Deferred from: code review of 44-1-1-convex-trend-schema (2026-05-26)

- `note-search.test.ts` import path fix (`noteSearch` vs `note-search`) — pre-existing broken test; required for `npm test` gate; out of story scope but acceptable.
- Wire `signalIngestBatchValidator` reject paths — until `ingestSignalBatch` wires validators in Story 44-1-2; no standalone public parse API in cns-dashboard tests today.

## Deferred from: code review of 44-1-2-ingest-signal-batch (2026-05-26)

- No automated test for C8 stale thresholds or stale refresh on partial batch — follow-up hardening in 44-1-3 or dedicated test story.
- `findPriorNormalizedValue` collects all topic events per insert — acceptable at 500 retention cap for MVP; optimize with tuple index if profiling shows pain.
- `note-search.test.ts` import path fix — same collateral item as 44-1-1 review; already applied in working tree.

## Deferred from: code review of 44-1-3-trend-queries-get-topics-sources (2026-05-26)

- Full-table `collect()` before `slice` on `getTrendTopics` — watchlist-bounded row count; index/limit push-down optional per story dev notes.
- No upper cap on `limit` arg — AC/spec specify default 10 only; table size bounded by watchlist mirror scale.

## Deferred from: code review of 44-2-1-trend-ingest-skeleton-watchlist-dry-run (2026-05-26)

- Python `unittest` not wired into `scripts/verify.sh` — Omnipotent.md gate is npm-only; story AC boundary requires manual `python3 -m unittest tests.test_trend_ingest`.

## Deferred from: code review of 44-2-2-trend-ingest-http-push-secret-guard (2026-05-26)

- Python `unittest` not wired into `scripts/verify.sh` — same npm-only gate as 44-2-1; run `python3 -m unittest tests.test_trend_ingest` before production push.

## Deferred from: code review of 44-3-1-google-trends-collector-pytrends (2026-05-26)

- Python `unittest` not wired into `scripts/verify.sh` — same npm-only gate as 44-2-1/44-2-2; run `python3 -m unittest tests.test_trend_ingest` before live trends collect/push.

## Deferred from: code review of 44-3-2-reddit-news-collectors-norm-cache (2026-05-26)

- ~~New PRAW `Reddit()` client per keyword~~ — **Resolved in 44-4-1:** `create_reddit_client` + one client per `collect_reddit` run.

## Deferred from: code review of 44-4-1-cron-install-documentation-env-example (2026-05-26)

- PRAW `Reddit()` client not explicitly closed after each cron run — low impact at operator watchlist scale; revisit if connection leaks show up in 44-4-2 reliability pass.

## Deferred from: code review of 44-3-3-cli-sources-polish-logging (2026-05-26)

- ~~Operator guide **Trend ingest logging** section~~ — **Resolved in 44-4-1:** CNS-Operator-Guide §16.5 (cron, log path, `jq`, NewsAPI quota).
- Story 44-3-3 implementation landed in commit `e4dc309` (dashboard-sync cron message) — no functional defect; consider a dedicated commit message on future touch for traceability.

## Deferred from: code review of 44-4-2-seven-day-pipeline-reliability-verification (2026-05-26)

- Log lines with `activeSources` length ≠ 1 are dropped from per-source stats — safe for cron (single source per run); manual multi-source runs are mis-counted.
- Full log file read into memory on each audit — acceptable for 7-day JSONL at expected operator volume.

## Deferred from: code review of 44-5-1-wire-trend-stub-panel-live-convex-queries (2026-05-26)

- `docs/DEPLOY.md` cron/NVM troubleshooting rows are unrelated to Trend panel wire-up — commit separately from 44-5-1.
- ~~Ingest health footer `errorCount` / `lastError`~~ — resolved in 44-5-2 (FR36/UX-DR11).

## Deferred from: code review of 50-3-conservative-notebook-scorer (2026-05-29)

- Duplicate tokenizer implementations — identical logic in `tokenizePatternForLexicon` (infer-notebook-domain.mjs) and `tokenizeForScoring` (notebook-scorer.mjs); no circular-dep-free consolidation path in current module graph; extract to shared `scoring-utils.mjs` in a future pass.
- `id.localeCompare` without locale pin in the `scoreNotebooks` sort comparator — harmless for ASCII slugs but inconsistent with the title comparison above it; add `{ sensitivity: 'base' }` option on next touch.

## Deferred from: code review of 50-4-disambiguation (2026-05-29)

- `slugToKeywords` allows 2-char stopwords ("in", "to", "of") — semantic noise in topic string; add a small stopword set or raise minimum token length on next touch.
- `DisambiguationResult` typedef not exported — JSDoc consumers must duplicate the return type; add `@exports DisambiguationResult` or a companion `.d.ts` in a future pass.
- `slugToKeywords` `token.length >= 2` filter is an undocumented addition beyond the spec's stated "strip numeric prefixes and hyphens" — benign for CNS story slugs but out-of-spec; document intent or align with spec on next touch.

## Deferred from: code review of 50-5-smart-routing (2026-05-29)

- ROUTED target shape includes `title` field but env-ID targets omit it — inconsistent across source types; align shapes in a future pass.
- `process.stderr.write` in `smartRoute` vs `console.error` in the adjacent registry-fail catch block — style inconsistency in the same module; normalise on next touch.
- `route.title`/`route.id` undefined if `disambiguateRoute` (50-4) violates its own ROUTED contract — add explicit guards or tighten the 50-4 typedef when the disambiguator is next touched.

## Deferred from: Story 49-6 morning-digest (2026-05-29)

- ~~**49-6:** morning-digest task-prompt never injected~~ — **Resolved Story 55-1 (2026-06-02):** strict line-1 trigger grammar, `channel_prompts` routing line in config-snippet, mandatory `skill_view` discipline; operator applies prompt in `~/.hermes/config.yaml`.

## Deferred from: code review of 49-6-morning-digest-upgrade (2026-05-30)

- Sprint-status diff bundles unrelated Epic 38 and Epic 50 state changes into the 49-6 review scope. Deferred by operator decision: Epic 38 and Epic 50 sprint-status changes are legitimate completed work, not something to revert; handle sprint-status ownership / commit-splitting separately.

## Deferred from: session-close test HERMES_HOME isolation fix (2026-06-04)

- ~~Three test files hand-roll HOME/HERMES_HOME isolation~~ **Resolved (Story 60-2, 2026-06-04):** shared helper `tests/helpers/hermes-env-isolation.mjs` exports `withSessionCloseEnvIsolation` and `withSmartRoutingIsolatedEnv`; migrated `tests/notebook-routing-report.test.mjs`, `tests/smart-routing.test.mjs`, `tests/session-close-pipeline.test.mjs`.

## Deferred from: code review of 60-2-dry-refactor-shared-withsessioncloseenv-isolation-helper (2026-06-04)

- Optional direct unit tests for `tests/helpers/hermes-env-isolation.mjs` (save/restore ordering, nested-call safety); integration coverage via three migrated suites is sufficient for now.
