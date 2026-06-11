# Story 68.11: Bound Perplexity Deep Signal via terminal adapter + reorder to eliminate morning-digest compression trigger

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **CNS operator running the Hermes morning-digest skill**,
I want **Perplexity's Deep Signal fetched through a bounded terminal adapter that emits a ≤1200-char blob and runs late in the collection order (after Source 12, before Source 6) instead of an unbounded ~50KB `mcp__perplexity__search` blob at position 3**,
so that **the gateway LLM loop no longer trips `gpt-4o-mini` compression mid-run, the §9 push gate / signal-mapping tables / Output Contract survive in context, and every run reliably writes `~/.hermes/digest-push-<date>.json` and pushes to Convex/Nexus**.

## Context / Problem

The morning-digest agent loop accumulates **every** source response in context. Today **Source 3 (Perplexity)** is a direct `mcp__perplexity__search` call that returns an unbounded prose blob (~50KB) and lands **early** (position 3 of the collection order). On `openai/gpt-4o` with `compression.threshold: 0.2`, this routinely fires `gpt-4o-mini` compression **mid-run**, which summarises away the pinned **§9 push gate**, the **signal-mapping tables**, and the **Output Contract**. The agent then never writes the digest push artifact or calls `push-digest-convex.mjs` — so no digest reaches Convex/Nexus.

This is a **structural / context-budget fix**, not a gateway-config change. Two levers:

1. **Bound the blob** — replace the MCP call with a terminal adapter that truncates the Deep Signal to **1200 chars** at a word boundary.
2. **Reorder** — move Perplexity from early (position 3) to the **tail** of data collection: **after Source 12 (Bluesky), before Source 6 (Vault context)** — so the large-ish blob enters context last, after the structural gates have already been read.

> **Brief-vs-current reconciliation:** The Tier 1A brief was written when the pipeline had fewer sources ("position 3 of 12", "move to position 11.5"). The current pipeline has 12 numbered sources (`0 → 1 → 2 → 3 → 4 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 6`). The brief's intent maps **exactly** onto today's pipeline: Perplexity fires **last among data sources, immediately before Source 6 (Vault context, always last)**. See Dev Notes for the recommended ordering line.

## Acceptance Criteria

> Verbatim from the Tier 1A operator brief (ACs are normative). Reference paths are exact.

1. `node scripts/hermes-skill-examples/morning-digest/scripts/fetch-perplexity-signal.mjs "<top_trend>"` (or via `bash scripts/session-close/hermes-run-perplexity.sh "<top_trend>"`) reads the top-trend keyword from **`process.argv[2]`**, prints `{"deepSignal":...}` **≤ 1200 chars** (or `{"error":...}`) and **exits 0 in all paths**.
2. Adapter resolves operator home / key via `mergeTrendIngestEnv` — **never `os.homedir()` directly** (use `resolveOperatorHome()` semantics, same as every other adapter).
3. `task-prompt.md` and `SKILL.md` show **identical collection order** with Perplexity **after Source 12 and before Source 6**; **no remaining `mcp__perplexity__search` reference**.
4. After `bash scripts/install-hermes-skill-morning-digest.sh`, the live `~/.hermes/skills/cns/morning-digest/` tree **matches** repo source.
5. A live morning-digest run completes through §9 with **no "Compacting context"** in Discord output; `digest:getRecentDigestRuns` returns today's published run.
6. **Deep Signal** section still renders **2–3 sentences** in Discord output.
7. `bash scripts/verify.sh` passes.

### Constraints (from brief — binding)

- `resolveOperatorHome()` only — never raw `os.homedir()`.
- **No new npm packages.**
- **No `--prod` flag.**
- Resync via `install-hermes-skill-morning-digest.sh` after **every** skill-file change.
- Do **not** touch `last30days-skill` (ADR-E67-001 — reference codebook only).

## Tasks / Subtasks

- [x] **Task 1 — Create `fetch-perplexity-signal.mjs` adapter (AC: #1, #2, #6)**
  - [x] Create `scripts/hermes-skill-examples/morning-digest/scripts/fetch-perplexity-signal.mjs`.
  - [x] Mirror the exported-function + `isMainModule()` shape of `fetch-producthunt-launches.mjs` (closest template — HTTP POST adapter with API key).
  - [x] Import `mergeTrendIngestEnv` from `./fetch-arxiv-rss.mjs` (do **not** re-implement env loading; do **not** call `os.homedir()` directly — `mergeTrendIngestEnv` → `resolveOperatorHome()` already handles Hermes HOME isolation).
  - [x] Read `PERPLEXITY_API_KEY` from the merged env. Missing key → `{"error":"missing PERPLEXITY_API_KEY"}` exit 0.
  - [x] Read the top-trend keyword from **`process.argv[2]`** (positional CLI arg threaded by the agent via `hermes-run-perplexity.sh "<top_trend>"`). Missing/empty `argv[2]` → `{"error":"no top trend keyword"}` exit 0 (mirrors current Source 3 "no top trend keyword" behavior).
  - [x] Call the Perplexity HTTP API directly via built-in `fetch` (POST, `Authorization: Bearer ${apiKey}`). **Confirm endpoint + current model slug via Context7 / Perplexity docs before coding** (see Dev Notes — do not hardcode a model from memory).
  - [x] 15s fetch timeout via `globalThis.AbortSignal.timeout(15_000)` (match other adapters).
  - [x] Truncate `deepSignal` to **1200 chars at a word boundary** — reuse the truncation pattern from `trimSnippet()` in `fetch-arxiv-rss.mjs` (export an equivalent helper for unit tests).
  - [x] stdout shape: `{"deepSignal":"...","topTrend":"<kw>"}` on success; `{"error":"<short reason>"}` on any failure; **always `process.exit(0)`**.
  - [x] Export an injectable-`fetch` `runPerplexityFetch(env, options)` (fixture/fetch injection) for tests — no network in unit tests.
- [x] **Task 2 — Create `hermes-run-perplexity.sh` wrapper (AC: #1, #3)**
  - [x] Create `scripts/session-close/hermes-run-perplexity.sh` — same shape as `hermes-run-hn.sh` plus **forward `$1` as argv[2]** to the adapter: `exec node "$REPO_ROOT/.../fetch-perplexity-signal.mjs" "$1"` (agent calls `bash scripts/session-close/hermes-run-perplexity.sh "<top_trend>"` with Source 1's top keyword shell-quoted).
  - [x] `chmod +x` the wrapper.
- [x] **Task 3 — Edit `task-prompt.md`: Source 3 → terminal + reorder + allowed tools (AC: #3)**
  - [x] Convert **Source 3 — Perplexity deep signal** from `mcp__perplexity__search` to a `terminal(command="… hermes-run-perplexity.sh", …)` call with the stdout-threading pattern used by Sources 5/7–12 (parse `{"deepSignal","topTrend"}` or `{"error"}`; on failure → `- (source unavailable: <short reason>)`).
  - [x] Thread Source 1's top-trend keyword as a **quoted shell argument** to the terminal call: `terminal(command="bash scripts/session-close/hermes-run-perplexity.sh <shellQuote(top_trend_keyword)>", …)` — see Dev Notes.
  - [x] Update the **Strict collection order** line so Perplexity fires after Source 12 and before Source 6.
  - [x] Remove `mcp__perplexity__search` from the **Allowed tools** table; the Deep Signal now uses `terminal`.
  - [x] Keep `digest_sources.perplexityText` / Source 6 assembly + §9 `deep_signal` mapping intact (the assembled field name stays — only the fetch mechanism changes).
- [x] **Task 4 — Edit `SKILL.md`: same changes mirrored (AC: #3, #4)**
  - [x] Convert the inline Deep Signal step (`Call mcp__perplexity__search once`) to the terminal-call form.
  - [x] Update **Strict collection order** lines (both the Execution rule section and Inline task contract) to match `task-prompt.md` exactly.
  - [x] `requires_toolsets: [terminal, perplexity]` → `requires_toolsets: [terminal]`; scrub `mcp__perplexity__search` references; update the `description`/`Tools` lines that say "Perplexity deep signal" via MCP.
  - [x] Bump `version:` (e.g. `1.4.7` → `1.5.0`) and update the parity test's version assertion (see Task 6).
- [x] **Task 5 — Unit test `tests/morning-digest-perplexity-adapter.test.mjs` (AC: #1, #2, #6)**
  - [x] New test mirroring `tests/morning-digest-producthunt-adapter.test.mjs` structure (node:test + node:assert/strict).
  - [x] Cover: success returns `{deepSignal, topTrend}` with `deepSignal.length <= 1200`; truncation at word boundary; missing key → `{"error":"missing PERPLEXITY_API_KEY"}`; missing keyword → `{"error":"no top trend keyword"}`; fetch failure → `{error}`; CLI subprocess exits 0 and prints JSON on failure path.
- [x] **Task 6 — Update parity test `tests/hermes-morning-digest-skill.test.mjs` (AC: #3, #7)**
  - [x] Update assertions that hardcode the MCP Perplexity contract (exact lines in Dev Notes "Parity test impact").
- [x] **Task 7 — Resync + verify (AC: #4, #5, #7)**
  - [x] Run `bash scripts/install-hermes-skill-morning-digest.sh`; confirm `~/.hermes/skills/cns/morning-digest/` matches repo source (the parity gate in `verify.sh` enforces this).
  - [x] Run `bash scripts/verify.sh` → green.
  - [ ] **AC #5/#6 (live):** operator-gated live morning-digest run — no "Compacting context" in Discord; `digest:getRecentDigestRuns` shows today's run; Deep Signal renders 2–3 sentences. Record evidence (this is the production-confidence gate; capture in the story Dev Agent Record or a short artifact note).

## Dev Notes

### Adapter pattern (copy this — do not invent a new shape)

`fetch-producthunt-launches.mjs` is the closest template: an HTTP adapter with an API key, exported pure helpers, an injectable-`fetch` `run*Fetch()`, and an `isMainModule()` block that does `mergeTrendIngestEnv(process.env)` → `run*Fetch(merged)` → `stdout.write(JSON.stringify(payload))` → `process.exit(0)`.

```javascript
// fetch-perplexity-signal.mjs — skeleton (confirm Perplexity endpoint/model via Context7 first)
import { fileURLToPath } from 'node:url';
import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const PPLX_URL = 'https://api.perplexity.ai/chat/completions'; // CONFIRM via docs
const FETCH_TIMEOUT_MS = 15_000;
const DEEP_SIGNAL_MAX = 1200;

export function truncateAtWord(text, maxLen = DEEP_SIGNAL_MAX) { /* mirror trimSnippet() */ }
export function loadPerplexityConfig(env = process.env, keywordArg) { /* apiKey from env; keyword from argv[2] */ }
export async function runPerplexityFetch(env, keywordArg, options = {}) { /* returns {deepSignal,topTrend} | {error} */ }

function isMainModule() { /* same as other adapters */ }
if (isMainModule()) {
  try {
    const merged = await mergeTrendIngestEnv(process.env);
    const keywordArg = process.argv[2];
    const payload = await runPerplexityFetch(merged, keywordArg);
    process.stdout.write(JSON.stringify(payload) + '\n');
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: '<short>' }) + '\n');
    process.exit(0);
  }
}
```

- **Env / home (AC #2):** `mergeTrendIngestEnv(baseEnv)` (in `fetch-arxiv-rss.mjs`) already resolves the operator home via `resolveOperatorHome()` and merges `~/.hermes/trend-ingest.env`. Import and use it. **Never** call `os.homedir()` / `homedir()` directly in the adapter.
- **Truncation (AC #1, #6):** `trimSnippet()` in `fetch-arxiv-rss.mjs` already does word-boundary truncation (find last space past 50% of the slice). Replicate that for the 1200-char cap so Deep Signal stays a clean 2–3 sentences.
- **`PERPLEXITY_API_KEY`** is the canonical env name used elsewhere in this repo (`src/agents/perplexity-slot.ts:39`). Read it from the merged env.

### Keyword input contract (normative)

The current Source 3 derives its query from **Source 1's top trend keyword** ("top item from Source 1 after sort"). The relocated terminal adapter receives that keyword via **`process.argv[2]`**:

- **Agent terminal call:** `terminal(command="bash scripts/session-close/hermes-run-perplexity.sh <shellQuote(top_trend_keyword)>", workdir=resolved_repo_root, timeout=45)` — use Source 1's top keyword after sort; do **not** invent a fallback from headlines.
- **Wrapper:** `hermes-run-perplexity.sh` forwards `"$1"` → `node …/fetch-perplexity-signal.mjs "$1"`.
- **Adapter:** reads `process.argv[2]`; echoes it in stdout as `topTrend` on success.
- Adapter query string preserves the current Source 3 shape: `"<keyword> — latest news and developments last 24 hours — CNS operator brief"`.
- Missing/empty `argv[2]` → `{"error":"no top trend keyword"}` (maps to `- (source unavailable: no top trend keyword)`). On timeout → `{"error":"perplexity timeout"}` → `- (source unavailable: perplexity timeout)`.

### Perplexity HTTP API — confirm before coding (Context7 mandatory)

Per project rule (Context7-Mandatory-Documentation-Protocol), before implementing the HTTP call:
1. `resolve-library-id` for Perplexity API, then `query-docs` for the chat/completions request shape and **current model slug** (do not assume `sonar`/`sonar-pro` from memory — model names change).
2. Implement the POST (`Authorization: Bearer ${PERPLEXITY_API_KEY}`, JSON body with `model` + `messages`) from those docs.
3. Extract the answer text from the response, then word-boundary-truncate to 1200 chars.

Note: `src/agents/perplexity-slot.ts` uses the **MCP** path (`perplexity-mcp` via npx), not the direct HTTP API — it is a reference for the env var name only, not the HTTP shape.

### Ordering line (recommended, AC #3)

Current strict order (`task-prompt.md` §"Strict collection order", line ~17 and SKILL.md lines ~37):
```
0 → 1 → 2 → 3 → 4 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 6 → §9 map → dedup → score → artifact → Discord → §9 push → §10
```
Recommended new order (Perplexity relocated to just before Source 6):
```
0 → 1 → 2 → 4 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 3 → 6 → §9 map → dedup → score → artifact → Discord → §9 push → §10
```
**Recommendation:** keep the section header text "## Source 3 — Perplexity deep signal" (avoid renumbering all sources — high churn and the parity test slices on `## Source 3` / `## Source 4`). Only the **runtime order** and the **invocation mechanism** change. Document in the Source 3 section that it fires after Source 12, before Source 6, and add a pre-flight note in Source 12 / Source 6 mirroring the existing "MUST fire before Source 6" gates.

### Parity test impact — `tests/hermes-morning-digest-skill.test.mjs` (AC #3, #7)

These assertions currently encode the MCP-Perplexity contract and **will fail** after this change. Update each:

| Line | Current assertion | Required change |
|------|-------------------|-----------------|
| ~48 | `body.includes("version: 1.4.7")` | bump to new version (e.g. `1.5.0`) |
| ~55 | `requires_toolsets: [terminal, perplexity]` | → `requires_toolsets: [terminal]` |
| ~70 | SKILL.md `body.includes("mcp__perplexity__search")` | replace with a `hermes-run-perplexity.sh` (or terminal Deep Signal) assertion |
| ~139 | task-prompt `body.includes("mcp__perplexity__search")` | replace with the terminal Perplexity assertion |
| ~197 | `Call \`mcp__perplexity__search\` exactly once` | → assert the terminal Perplexity call form |
| ~159, ~402 | `perplexityText` | **keep** — Source 6 `digest_sources.perplexityText` field is unchanged |
| ~625 | `source2End = taskBody.indexOf("## Source 3")` | safe if `## Source 3` header is retained (recommended). If you renumber, fix this slice boundary. |

Grep the full file for `perplexity`/`Perplexity` and reconcile every hit; there may be additional assertions beyond the table.

### Files to touch

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-perplexity-signal.mjs` | **Create** |
| `scripts/session-close/hermes-run-perplexity.sh` | **Create** (chmod +x) |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | **Edit** — Source 3 → terminal, reorder, allowed-tools |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | **Edit** — Source 3 → terminal, reorder, `requires_toolsets`, version, description |
| `tests/morning-digest-perplexity-adapter.test.mjs` | **Create** |
| `tests/hermes-morning-digest-skill.test.mjs` | **Edit** — update MCP-Perplexity assertions (table above) |
| `~/.hermes/skills/cns/morning-digest/...` | **Resync** via `install-hermes-skill-morning-digest.sh` after edits |

### Testing standards

- Unit tests use `node:test` + `node:assert/strict`, executed by `verify.sh` (CNS repo `npm test`).
- Adapters are tested with injected `fetch`/fixtures — **no live network** in unit tests (see `tests/morning-digest-producthunt-adapter.test.mjs`).
- `verify.sh` includes a **Hermes skill parity gate** (Epic 60-1) that fails if `~/.hermes/skills/cns/morning-digest/` diverges from repo source — hence the mandatory resync (AC #4) before the gate runs.

### Project Structure Notes

- This story extends the **Epic 68** morning-digest pipeline-hardening line (`68-9` pipeline integration fixes, `68-10` Convex completion gate). Story key chosen as **68-11** because Epic 68 is the active source/pipeline epic; this is a pipeline-reliability fix in the same family. (Operator labelled it "Tier 1A" — a priority label, not an epic number.)
- All adapters live in `scripts/hermes-skill-examples/morning-digest/scripts/*.mjs`; all wrappers in `scripts/session-close/hermes-run-*.sh` — naming follows the established convention (`fetch-<source>-*.mjs`, `hermes-run-<source>.sh`).
- This story touches Hermes skill files only — **no Convex schema change**, **no WriteGate / vault paths**, **no `security.md`**. No operator-approval-gated surfaces.

### References

- Tier 1A operator brief (verbatim ACs above) — provided in-session; not a repo file.
- Adapter template: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-producthunt-launches.mjs`
- Env/home helpers (`mergeTrendIngestEnv`, `resolveOperatorHome`, `trimSnippet`): `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs`
- Wrapper template: `scripts/session-close/hermes-run-hn.sh`
- Task contract (current Source 3 + ordering + allowed tools): `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (Source 3 §123–131; strict order line ~17; allowed tools §943–951)
- Skill mirror (Deep Signal step, `requires_toolsets`, version): `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- Parity test: `tests/hermes-morning-digest-skill.test.mjs`
- Adapter test pattern: `tests/morning-digest-producthunt-adapter.test.mjs`
- Env var precedent: `src/agents/perplexity-slot.ts` (`PERPLEXITY_API_KEY`)
- Architecture anti-drift (resolveOperatorHome, no Python subprocess, native adapters): `_bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md` §0; ADR-E67-001 (`docs/ADR-E67-001-last30days-codebook-only.md`)
- Context7 protocol (Perplexity API lookup): `.cursor/rules/Context7-Mandatory-Documentation-Protocol.mdc`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Context7: Perplexity API `POST /chat/completions`, model `sonar`, Bearer auth, response in `choices[0].message.content`.
- Parity tests initially failed because `indexOf("## Source 3")` matched the early doc section (line 125), not the runtime boundary after Source 12 — fixed slice boundaries to use `## Source 6` for Source 12 content.

### Completion Notes List

- Implemented bounded Perplexity terminal adapter (`fetch-perplexity-signal.mjs`) with keyword from `process.argv[2]`, `mergeTrendIngestEnv`, 1200-char word-boundary truncation, and always exit 0.
- Added `hermes-run-perplexity.sh` wrapper forwarding `"$1"` to the adapter.
- Relocated Perplexity runtime order to after Source 12, before Source 6 in `task-prompt.md` and `SKILL.md` (v1.5.0); removed `mcp__perplexity__search` from allowed tools; `requires_toolsets: [terminal]` only.
- Unit + parity tests added/updated; `bash scripts/verify.sh` green; Hermes skill resynced.
- **AC #5 deferred (operator gate):** live morning-digest run with no "Compacting context" and Convex published run requires operator trigger in #hermes.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-perplexity-signal.mjs` (create)
- `scripts/session-close/hermes-run-perplexity.sh` (create)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (edit)
- `scripts/hermes-skill-examples/morning-digest/SKILL.md` (edit)
- `tests/morning-digest-perplexity-adapter.test.mjs` (create)
- `tests/hermes-morning-digest-skill.test.mjs` (edit)

## Change Log

- 2026-06-11: Story 68-11 implementation — bounded Perplexity terminal adapter, collection reorder, skill v1.5.0, tests + verify green. AC #5 live validation pending operator.
