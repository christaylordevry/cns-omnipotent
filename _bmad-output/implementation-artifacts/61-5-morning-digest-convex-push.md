---
story_id: 61-5
epic: 61
title: morning-digest-convex-push
status: done
baseline_commit: bf6ef5c1a8e2c4d9f0b3a7e6d5c4b3a291807060
operator_brief: 2026-06-05
predecessors: 61-4, 52-2, 56-5, 61-3
---

# Story 61.5: Morning digest Convex push (data layer only)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator reviewing trends and digest history on the dashboard**,
I want **each morning-digest run to push structured run metadata and per-source signals into Convex as reusable product-grade entities**,
so that **the existing trend feed (and future briefings epic) can consume digest data without scraping Discord — with zero new dashboard UI in this story**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 61: Morning digest source expansion (operator brief 2026-06-04) |
| **Predecessors** | **61-4** (six-source `digest_sources`, SKILL v1.2.8, HN section); **52-2** (Convex HTTP push pattern via `log-notebook-query.mjs`); **56-5** (Convex mutation module + `convexTest` in `cns-dashboard`); **61-3** (`resolveOperatorHome` / `mergeTrendIngestEnv` — mandatory for env reads in morning-digest scripts) |
| **Repos touched** | `cns-dashboard/convex/` (schema + mutations + tests) **and** `Omnipotent.md/scripts/hermes-skill-examples/morning-digest/` (push script + task-prompt + SKILL) |
| **Pattern** | HTTP `POST /api/mutation` with `Authorization: Convex ${CONVEX_DEPLOY_KEY}` — same transport as `log-notebook-query.mjs`, **different** graceful-exit contract (always exit **0**, stderr warning only) |
| **Parity** | `morning-digest` is a parity skill — after Omnipotent.md edits run `bash scripts/install-hermes-skill-morning-digest.sh` and confirm `diff -rq` clean |
| **Out of scope** | New dashboard Svelte components; modifying `signalEvents` / `signalSources` / `trendTopics` tables; multi-tenant `workspaceId` enforcement; `briefings` table; operator guide edits (optional defer) |

### Operator brief (binding)

1. Add **`digestRuns`** and **`digestSignals`** tables to `cns-dashboard/convex/schema.ts`.
2. Add mutations: `createDigestRun`, `addDigestSignal`, `finalizeDigestRun` (module file at `convex/digest.ts` — **not** a `mutations/` subfolder; matches `notebookQueries.ts` layout).
3. New push script: `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs`.
4. After Sources 1–6 complete and `digest_sources` is assembled, push run + signals; `finalizeDigestRun` with status **`published`**.
5. **Graceful degradation:** any Convex failure → stderr warning, exit **0**, digest still completes (never abort Hermes task).
6. Uses `CONVEX_URL` + `CONVEX_DEPLOY_KEY` from env (already in Hermes `env_passthrough` in `~/.hermes/config.yaml`).
7. Uses **`resolveOperatorHome` pattern** via `mergeTrendIngestEnv` import from `fetch-arxiv-rss.mjs` — **not** `homedir()` for trend-ingest.env fallback.
8. `SKILL.md` bumped to **v1.2.9**.
9. `npm test` green (**642** Omnipotent.md), `bash scripts/verify.sh` green (includes `cns-dashboard npm test`).

## Acceptance Criteria

### 1. Convex schema — `digestRuns` (AC: schema-runs)

**Given** `cns-dashboard/convex/schema.ts` is updated  
**Then** a `digestRuns` table exists with fields:

| Field | Type | Notes |
|-------|------|-------|
| `date` | `string` | Civil date `"YYYY-MM-DD"` from digest |
| `ranAt` | `number` | Unix ms timestamp (digest start or push time — use `digest_start_ms` when available) |
| `status` | `string` | `"started"` \| `"completed"` \| `"failed"` \| `"published"` \| `"archived"` |
| `topTrend` | optional `string` | Top Google Trends keyword when available |
| `focusKeyword` | optional `string` | Recommended focus line value |
| `deepSignalSummary` | optional `string` | Perplexity Deep Signal body when available |
| `notebookId` | optional `string` | ROUTED notebook id from Source 6 |
| `vaultContextSummary` | optional `string` | Full `answer_full` from query (before Discord truncation) when ROUTED + success |
| `workspaceId` | optional `string` | Nullable stub — omit or `undefined` for operator/personal |
| `briefingId` | optional `string` | Nullable stub — always omit until future epic |

**And** add index `by_date` on `['date']` and `by_ranAt` on `['ranAt']` for feed queries  
**And** validators live in `convex/validators.ts` (input + row validators, same pattern as `notebookQueryRowValidator`)

### 2. Convex schema — `digestSignals` (AC: schema-signals)

**Then** a `digestSignals` table exists with fields:

| Field | Type | Notes |
|-------|------|-------|
| `digestRunId` | `Id<"digestRuns">` | Parent run |
| `section` | `string` | Display bucket: `"trends"` \| `"headlines"` \| `"arxiv"` \| `"hackernews"` \| `"deep_signal"` |
| `sourceType` | `string` | True identity: `"google_trends"` \| `"newsapi"` \| `"arxiv"` \| `"hackernews"` \| `"deep_signal"` |
| `title` | `string` | Primary human-readable label |
| `summary` | optional `string` | arXiv snippet, article lede, Deep Signal excerpt, etc. |
| `url` | optional `string` | Link when available |
| `externalId` | optional `string` | Stable dedupe key — see Dev Notes mapping table |
| `score` | optional `number` | HN pts, trend `normalizedValue`, recency weight, etc. |
| `rank` | `number` | 1-based ordering within section |
| `sourceMetadata` | optional `object` | Constrained: `{ comments?, categories?, author?, publishedAt? }` only |
| `workspaceId` | optional `string` | Nullable stub |

**And** add index `by_digestRunId` on `['digestRunId']`  
**And** do **not** modify `signalEvents`, `signalSources`, or any existing trend-ingest tables

### 3. Convex mutations (AC: mutations)

**Then** `cns-dashboard/convex/digest.ts` exports three **public** mutations callable via HTTP API:

| Mutation | Args (summary) | Returns |
|----------|----------------|---------|
| `createDigestRun` | Run metadata fields (date, ranAt, status=`"started"`, optional summaries/ids) | `Id<"digestRuns">` |
| `addDigestSignal` | `digestRunId` + signal fields (section, sourceType, title, rank, optional rest) | `Id<"digestSignals">` |
| `finalizeDigestRun` | `id: Id<"digestRuns">`, `status: string` (caller passes `"published"`) | `void` (null return) |

**And** `createDigestRun` inserts with `status: "started"` unless caller overrides in args  
**And** `addDigestSignal` validates `digestRunId` exists before insert  
**And** `finalizeDigestRun` patches `status` on the run (no throw when id missing — return silently or throw clear error; prefer throw for bad id in tests, HTTP caller treats as warning)  
**And** mutations use `args` + `returns` validators per Convex plugin rules  
**And** `Date.now()` is allowed in mutations (not queries)

### 4. Push script `push-digest-convex.mjs` (AC: push-script)

**Given** env `DIGEST_PUSH_JSON` contains a JSON payload (see Dev Notes shape)  
**When** `node scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` runs  
**Then** it:

1. Resolves Convex env via `mergeTrendIngestEnv` → `resolveOperatorHome` (import from `./fetch-arxiv-rss.mjs`) — **never** `import { homedir } from 'node:os'` for env path resolution
2. Missing `CONVEX_URL` / `CONVEX_DEPLOY_KEY` → stderr `push-digest-convex: skipped — missing CONVEX_URL or CONVEX_DEPLOY_KEY`, exit **0**
3. Calls `digest:createDigestRun` → captures returned id
4. For each signal in payload sections → calls `digest:addDigestSignal`
5. Calls `digest:finalizeDigestRun` with `status: "published"`
6. On **any** HTTP/mutation failure → stderr warning with short reason, exit **0** (digest must not fail)

**And** exported testable functions: `readDigestPushPayload(env)`, `resolveConvexPushEnv(env)` (reuse or share logic with notebook-query pattern), `pushDigestToConvex(opts)`  
**And** HTTP shape matches existing push scripts:

```json
{
  "path": "digest:createDigestRun",
  "args": { "...": "..." },
  "format": "json"
}
```

**And** `Authorization: Convex ${CONVEX_DEPLOY_KEY}` header on every request

### 5. Morning digest integration (AC: task-prompt)

**Given** Sources 1–6 have run and `digest_sources` was assembled for Source 6 scoring  
**When** Hermes completes the digest per updated `references/task-prompt.md`  
**Then** a new **post-post step** (after Discord post; may run after or alongside notebook log) invokes:

```text
terminal(
  command="PUSH_SCRIPT=<shellQuote(push_script)> DIGEST_PUSH_JSON=<shellQuote(JSON.stringify(digest_push_payload))> node \"$PUSH_SCRIPT\"",
  workdir=resolved_repo_root,
  timeout=45
)
```

Where `push_script = resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs"`

**And** `digest_push_payload` includes:
- `run`: date, ranAt (`digest_start_ms`), topTrend, focusKeyword, deepSignalSummary, notebookId (if ROUTED), vaultContextSummary (`answer_full` if ROUTED+success), workspaceId omitted
- `signals[]`: mapped from parsed source outputs (not only `digest_sources` scoring subset — push **display items** with correct ranks)

**And** push runs **even when** some sources failed (push available signals; omit empty sections)  
**And** push failure does **not** edit Discord, does **not** fail the skill, does **not** post operator warning line (stderr only — unlike notebook log Discord warning)  
**And** `SKILL.md` version **1.2.9** documents the step; policy clarifies:
- **No trend-ingest Convex push** (`--dry-run` unchanged)
- **Digest entity push** to `digestRuns`/`digestSignals` (new, fire-and-forget)
- **Notebook query log** unchanged (52-2)

### 6. Signal mapping contract (AC: mapping)

**Given** parsed source outputs from the digest run  
**When** building `signals[]` for the push payload  
**Then** map with this **section → sourceType** table:

| Section | sourceType | Source data | title | summary | url | score | externalId |
|---------|------------|-------------|-------|---------|-----|-------|------------|
| `trends` | `google_trends` | Source 1 `events[]` | `keyword` | — | — | `normalizedValue` | `sha256(keyword + date)` short hex |
| `headlines` | `newsapi` | Source 2 `headlines[]` | `title` | — | `url` if present | — | url hash or title+date hash |
| `deep_signal` | `deep_signal` | Source 3 body | first 80 chars or `"Deep Signal"` | full text | — | — | `sha256(date + topTrend)` short hex |
| `arxiv` | `arxiv` | Source 4 `papers[]` | `title` | `snippet` | `link` | — | arxiv id from link (`/\d+\.\d+`) or link hash |
| `hackernews` | `hackernews` | Source 5 `stories[]` | `title` | — | `link` | `score` | HN item id from link/comments URL or title+date hash |

**And** `rank` is 1-based index within each section in display order  
**And** `sourceMetadata` populated when data exists: HN `comments`, arXiv `categories` from `category` field, etc.  
**And** use Node `crypto.createHash('sha256')` for hashes — built-in only, no new npm deps

### 7. Scope guards (AC: scope)

**Then** no new dashboard UI components in `cns-dashboard/src/`  
**And** no changes to `signalEvents` ingest path in `trends.ts` / `trend-ingest.py`  
**And** no `briefings` table  
**And** `workspaceId` accepted but never enforced (nullable stub)  
**And** Constitution WriteGate not triggered (no vault writes)

### 8. Tests + verify gate (AC: test)

**cns-dashboard** — NEW `tests/convex/digest.test.ts`:
- Schema defines `digestRuns` and `digestSignals`
- `createDigestRun` → returns id, row has `status: "started"`
- `addDigestSignal` × N → rows linked to run
- `finalizeDigestRun` → status becomes `"published"`
- Invalid `digestRunId` on add → throws or rejects

**Omnipotent.md** — NEW `tests/morning-digest-push-convex.test.mjs`:
- Payload reader validates required `run.date`
- Missing Convex env → skipped, exit 0, no fetch
- Happy path mock fetch → correct mutation paths and call order (create → N×add → finalize)
- HTTP 500 on add → stderr warning, exit 0
- `resolveConvexPushEnv` uses `mergeTrendIngestEnv` / operator home (fixture temp env file under resolved home path or `CNS_TREND_INGEST_ENV_PATH` override for tests)

**Omnipotent.md** — UPDATE `tests/hermes-morning-digest-skill.test.mjs`:
- Asserts `push-digest-convex.mjs` in task-prompt post-post section
- Asserts `DIGEST_PUSH_JSON`, fire-and-forget / graceful wording
- Asserts SKILL v1.2.9

**Then** `npm test` reports **642+** passing (net +new tests)  
**And** `bash scripts/verify.sh` passes including `cns-dashboard npm test`

## Tasks / Subtasks

- [x] **T1** `cns-dashboard/convex/validators.ts` — add `digestRunRowValidator`, `digestRunInputValidator`, `digestSignalRowValidator`, `digestSignalInputValidator`, `sourceMetadataValidator` (AC: 1, 2)
- [x] **T2** `cns-dashboard/convex/schema.ts` — register `digestRuns` + `digestSignals` tables with indexes (AC: 1, 2, 7)
- [x] **T3** `cns-dashboard/convex/digest.ts` — implement three mutations (AC: 3)
- [x] **T4** `cns-dashboard/tests/convex/digest.test.ts` — convexTest coverage (AC: 8)
- [x] **T5** `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` — NEW push script with graceful exit 0 (AC: 4)
- [x] **T6** `references/task-prompt.md` — post-post digest Convex push step + `digest_push_payload` contract (AC: 5, 6)
- [x] **T7** `SKILL.md` v1.2.9 — execution step 10, policy update (AC: 5)
- [x] **T8** `tests/morning-digest-push-convex.test.mjs` + `tests/hermes-morning-digest-skill.test.mjs` updates (AC: 8)
- [x] **T9** `bash scripts/install-hermes-skill-morning-digest.sh`; `diff -rq` parity; `bash scripts/verify.sh` (AC: 8)

### Review Findings

- [x] [Review][Patch] Orphan `digestRun` on partial push failure — `push-digest-convex.mjs` catches errors after `createDigestRun` without calling `finalizeDigestRun({ status: 'failed' })`, leaving runs stuck in `started` (AC: push-script graceful degradation intent).
- [x] [Review][Patch] `finalizeDigestRun` accepts arbitrary `status` strings — `digest.ts:30` uses `v.string()` instead of `digestRunStatusValue`; patch to enum validator (AC: mutations).
- [x] [Review][Patch] task-prompt `ranAt` placeholder is a quoted string — `"ranAt": "<digest_start_ms>"` may cause LLM to serialize a string; Convex rejects and push silently skips (AC: task-prompt payload shape).
- [x] [Review][Patch] task-prompt "alongside" notebook log permits race — `notebookId` / `vaultContextSummary` missing if push runs before Source 6 completes; SKILL.md step 10 is sequential — align task-prompt wording (AC: task-prompt).
- [x] [Review][Patch] Observability table omits `invalid-input` — malformed `DIGEST_PUSH_JSON` returns `reason: 'invalid-input'` but status mapping table has no row (AC: task-prompt observability).
- [x] [Review][Patch] Add-failure test does not assert finalize skipped — `morning-digest-push-convex.test.mjs:150` uses `callCount >= 2` instead of `=== 2` and does not verify `finalizeDigestRun` absent (AC: test).
- [x] [Review][Patch] Missing `finalizeDigestRun` invalid-id test — implementation throws but `digest.test.ts` only covers `addDigestSignal` rejection (AC: mutations / test).
- [x] [Review][Patch] Missing `createDigestRun` HTTP failure test — first-mutation 500 path has zero coverage (AC: test).
- [x] [Review][Defer] Duplicate `digestRuns` per date — no unique constraint or idempotency guard; acceptable for data-layer-only story; feed consumer should pick latest by `ranAt` (future epic).
- [x] [Review][Defer] `shortSha256Hex` delimiter collision — `parts.join('')` matches spec's `sha256(keyword + date)` concatenation; delimiter fix is a spec change (AC: mapping).
- [x] [Review][Defer] `section` / `sourceType` pairing not enforced at Convex — mapping is Hermes agent contract in task-prompt; server-side cross-validator deferred.

## Dev Notes

### Architecture overview

```
morning-digest Sources 1–6
        │
   Assemble digest_sources (Source 6 scoring)
        │
   Post full digest to #hermes
        │
   [existing] notebook log (ROUTED + success only, awaited 15s)
        │
   [NEW] push-digest-convex.mjs (fire-and-forget, exit 0 always)
        │  createDigestRun → addDigestSignal × N → finalizeDigestRun("published")
        ▼
   digestRuns + digestSignals tables (cns-dashboard Convex)
        │
   (future) trend feed / briefings consumers — NO UI in 61-5
```

**Separation from trend-ingest:** `trend-ingest.py` pushes to `signalEvents` via a different pipeline. This story adds **digest-native entities** for the morning briefing product. Do not wire digest push into `trends.ts` or modify `signalEvents`.

### `DIGEST_PUSH_JSON` payload shape (normative)

```json
{
  "run": {
    "date": "2026-06-05",
    "ranAt": 1749091200000,
    "topTrend": "AI agents",
    "focusKeyword": "AI agents",
    "deepSignalSummary": "Two sentence Perplexity sweep...",
    "notebookId": "cns-watch-uuid",
    "vaultContextSummary": "Full notebook answer text..."
  },
  "signals": [
    {
      "section": "trends",
      "sourceType": "google_trends",
      "title": "AI agents",
      "score": 0.87,
      "rank": 1,
      "externalId": "a1b2c3..."
    },
    {
      "section": "hackernews",
      "sourceType": "hackernews",
      "title": "Show HN: ...",
      "url": "https://...",
      "score": 142,
      "rank": 1,
      "externalId": "48408186",
      "sourceMetadata": { "comments": 12 }
    }
  ]
}
```

Hermes agent builds this from **parsed terminal/Perplexity outputs**, not from memory. Empty sections → omit signals (do not insert placeholder rows).

### Push script env resolution (61-3 compliance)

**Do not copy `log-notebook-query.mjs` homedir pattern.** That script predates 61-3 and lives in `notebook-query/` (out of scope to refactor here).

For `push-digest-convex.mjs`:

```js
import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

export async function resolveConvexPushEnv(baseEnv = process.env) {
  const merged = await mergeTrendIngestEnv(baseEnv);
  const convexUrl = merged.CONVEX_URL?.trim();
  const convexDeployKey = merged.CONVEX_DEPLOY_KEY?.trim();
  if (convexUrl && convexDeployKey) {
    return { convexUrl, convexDeployKey };
  }
  return null;
}
```

Tests can set `CNS_TREND_INGEST_ENV_PATH` to a temp file (pattern from `tests/notebook-query-log.test.mjs`) **or** mock `mergeTrendIngestEnv`.

### HTTP mutation transport (from Context7 + 51-2/52-2 production pattern)

```js
const response = await fetch(`${normalizeConvexUrl(convexUrl)}/api/mutation`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Convex ${convexDeployKey}`,
  },
  body: JSON.stringify({ path: 'digest:createDigestRun', args: { ... }, format: 'json' }),
});
```

Mutation return value for `createDigestRun` arrives in JSON response body — parse to get `digestRunId` for subsequent `addDigestSignal` calls.

### `digest.ts` mutation sketch

```typescript
import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { digestRunInputValidator, digestSignalInputValidator } from './validators';

export const createDigestRun = mutation({
  args: { run: digestRunInputValidator },
  returns: v.id('digestRuns'),
  handler: async (ctx, { run }) => {
    return await ctx.db.insert('digestRuns', {
      ...run,
      status: run.status ?? 'started',
    });
  },
});

export const addDigestSignal = mutation({
  args: { signal: digestSignalInputValidator },
  returns: v.id('digestSignals'),
  handler: async (ctx, { signal }) => {
    const parent = await ctx.db.get(signal.digestRunId);
    if (!parent) throw new Error('digestRun not found');
    return await ctx.db.insert('digestSignals', signal);
  },
});

export const finalizeDigestRun = mutation({
  args: { id: v.id('digestRuns'), status: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
    return null;
  },
});
```

Adjust validator shapes to match schema fields. `digestSignalInputValidator` includes `digestRunId: v.id('digestRuns')`.

### task-prompt.md delta

Add section **`## Post-post — Push digest entities to Convex (all runs)`** after the existing notebook Convex log section:

- **Precondition:** Sources 1–6 attempted; `digest_sources` assembled; Discord post complete.
- Build `digest_push_payload` per mapping table.
- `terminal` call with 45s timeout; **do not await success** for skill completion beyond terminal return — but unlike notebook log, **never** post Discord warning on failure.
- Emit optional stderr JSON line for observability:

```json
{"digest_convex_push":{"status":"ok|skipped-env|failed","exit_code":0,"reason":"..."}}
```

- Always `exit_code: 0` from push script.

Update **Allowed tools** table to include `push-digest-convex.mjs`.

### SKILL.md edits (v1.2.9)

- Bump `version: 1.2.9`.
- Execution rule: add step after notebook log — push digest entities via `push-digest-convex.mjs`.
- Policy block — three bullets:
  1. No trend-ingest Convex push (`--dry-run`)
  2. Digest entity push (`digestRuns`/`digestSignals`) — fire-and-forget, failures silent to operator
  3. Notebook query log unchanged

### Files to touch

| Path | Repo | Action |
|------|------|--------|
| `convex/validators.ts` | cns-dashboard | UPDATE — digest validators |
| `convex/schema.ts` | cns-dashboard | UPDATE — two tables + indexes |
| `convex/digest.ts` | cns-dashboard | **NEW** — mutations |
| `tests/convex/digest.test.ts` | cns-dashboard | **NEW** |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | Omnipotent.md | **NEW** |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | Omnipotent.md | UPDATE — post-post push |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | Omnipotent.md | UPDATE — v1.2.9 |
| `tests/morning-digest-push-convex.test.mjs` | Omnipotent.md | **NEW** |
| `tests/hermes-morning-digest-skill.test.mjs` | Omnipotent.md | UPDATE — contract assertions |
| `~/.hermes/skills/cns/morning-digest/` | installed | SYNC via install script |

**Read only:** `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs` (HTTP pattern reference), `convex/notebookQueries.ts` (mutation module pattern), `convex/trends.ts` (do not modify).

### Contract-test regressions to fix (do NOT leave red)

`tests/hermes-morning-digest-skill.test.mjs` currently asserts v1.2.8 — bump to **1.2.9** everywhere. Add assertions for:
- `push-digest-convex.mjs` in task-prompt
- `DIGEST_PUSH_JSON`
- Post-post section heading for digest Convex push
- Policy distinguishes trend-ingest vs digest entity push

### Testing guidance

**`tests/morning-digest-push-convex.test.mjs`** (mirror `notebook-query-log.test.mjs` structure):

| Test | Assert |
|------|--------|
| Happy path | Mock fetch captures 3+ calls: create, add×N, finalize; paths `digest:*` |
| Missing env | `status: 'skipped'`, exit 0, fetch not called |
| create OK, add fails | stderr contains warning, exit 0 |
| `readDigestPushPayload` | rejects missing `run.date` |
| externalId helper | stable hash for same inputs |

**`tests/convex/digest.test.ts`** (mirror `notebookQueries.test.ts`):

- Use `convexTest(schema, modules)` with `import.meta.glob('../../convex/**/*.ts')`
- Full create → add 2 signals → finalize lifecycle
- Verify `by_digestRunId` query returns signals for run

### Previous story intelligence

- **61-4:** Post-post notebook log is **awaited** 15s with Discord warning on failure. Digest push is **silent** to operator (stderr only) and **always exit 0** — do not copy notebook log exit-1 semantics.
- **61-3:** Any new morning-digest script that reads `trend-ingest.env` must use `mergeTrendIngestEnv` / `resolveOperatorHome`.
- **52-2:** Post-post steps go in task-prompt **after** output contract; Hermes agent must not skip them.
- **56-5:** Convex changes require `cns-dashboard` tests; `verify.sh` runs them automatically when sibling exists at `../cns-dashboard`.
- **60-1:** Run `bash scripts/install-hermes-skill-morning-digest.sh` after skill edits; `rsync --delete` parity gate.

### Git intelligence

Recent pattern: `feat(epic-61): 61-N <description>`, one commit per story, note test count in completion (e.g. "643 total"). This story spans two repos — prefer **one commit in Omnipotent.md** and **one in cns-dashboard**, or a single Omnipotent.md commit if dashboard changes are committed there via submodule/worktree — follow whichever pattern the operator used for 51-2/56-5 (those were cns-dashboard-only). For 61-5, **both repos need commits** before claiming done.

### Security / ops

- `CONVEX_DEPLOY_KEY` never echoed to Discord or stdout; only `Authorization` header.
- `DIGEST_PUSH_JSON` may contain vault context text — shell-quote via `shellQuote()` in task-prompt (same as `DIGEST_SOURCES_JSON`).
- Hermes `env_passthrough` already includes `CONVEX_URL` and `CONVEX_DEPLOY_KEY` (`~/.hermes/config.yaml` lines 80–81).
- No new npm packages (14-day supply-chain rule).

### Deferred / do not "fix"

- `log-notebook-query.mjs` still uses `homedir()` — out of scope; do not refactor in 61-5.
- Malformed `DIGEST_SOURCES_JSON` → silent `[]` (56-4 deferral) — unchanged.
- No dashboard consumer query in this story — trend feed wiring is a future epic.

## Project Structure Notes

- Convex modules live at `cns-dashboard/convex/<feature>.ts` (flat, not `mutations/` subdir).
- Morning-digest scripts stay under `scripts/hermes-skill-examples/morning-digest/scripts/`.
- `verify.sh` runs Omnipotent.md `npm test` then `cns-dashboard npm test` — both must pass.

## References

- [Source: `_bmad-output/implementation-artifacts/61-4-morning-digest-hackernews-source.md` — six-source digest, post-post patterns]
- [Source: `_bmad-output/implementation-artifacts/52-2-morning-digest-notebooklm-convex-log.md` — HTTP push, task-prompt post-post]
- [Source: `_bmad-output/implementation-artifacts/56-5-notebook-queries-convex-table-dedupe.md` — convexTest pattern]
- [Source: `cns-dashboard/convex/schema.ts` — existing table patterns]
- [Source: `cns-dashboard/convex/notebookQueries.ts` — public HTTP mutation module pattern]
- [Source: `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs` — HTTP transport]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome`]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — `digest_sources`, post-post notebook log]
- [Source: `tests/notebook-query-log.test.mjs` — push script test template]
- [Source: Convex docs — public mutations + HTTP API via `/api/mutation` (Context7 `/websites/convex_dev`)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor Agent)

### Debug Log References

- Fixed notebook-log contract test slice after adding second post-post section (digest push includes `fire-and-forget`).
- `mergeTrendIngestEnv` test uses `parseEnvFile` (no `export` prefix) under operator-home `.hermes/trend-ingest.env`.

### Completion Notes List

- Added `digestRuns` / `digestSignals` Convex tables with validators and `createDigestRun`, `addDigestSignal`, `finalizeDigestRun` mutations in `cns-dashboard`.
- Added `push-digest-convex.mjs` with `mergeTrendIngestEnv` env resolution, always-exit-0 graceful degradation, and create → add × N → finalize HTTP flow.
- Updated morning-digest `task-prompt.md` (signal mapping + post-post terminal step) and `SKILL.md` v1.2.9 (policy distinguishes trend-ingest vs digest entity push).
- Tests: `digest.test.ts` (4 cases), `morning-digest-push-convex.test.mjs` (6 cases), skill contract updates.
- `npm test`: Omnipotent.md **642** passed; cns-dashboard **374** passed; `bash scripts/verify.sh` green; Hermes skill parity `diff -rq` clean.

### File List

- `cns-dashboard/convex/validators.ts` (modified)
- `cns-dashboard/convex/schema.ts` (modified)
- `cns-dashboard/convex/digest.ts` (new)
- `cns-dashboard/tests/convex/digest.test.ts` (new)
- `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` (new)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (modified)
- `scripts/hermes-skill-examples/morning-digest/SKILL.md` (modified)
- `tests/morning-digest-push-convex.test.mjs` (new)
- `tests/hermes-morning-digest-skill.test.mjs` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-06-05: Story 61-5 created (ready-for-dev) — morning digest Convex push data layer.
- 2026-06-05: Story 61-5 implemented — Convex digest tables/mutations, push script, skill v1.2.9, tests + verify green (status → review).
