---
baseline_commit: f1f5330c9a66eb8048c7059b4dd9c51c8f1a23b
---

# Story 51.2: Notebook-Query History Log

Status: done

Epic: **51** (NotebookLM Query Surface)  
Tracked in sprint-status as: **`51-2-notebook-query-history-log`**

**Operator intent:** Persist every successful `/notebook-query` answer to Convex and surface a read-only history widget on `/trends` — closing the loop 51-1 explicitly deferred ("No response loop back to cns-dashboard").

---

## Story

As the **CNS operator**,  
I want **successful `/notebook-query` answers logged to Convex and visible on the `/trends` dashboard**,  
so that **I can review recent NotebookLM Q&A from Discord without scrolling Discord history**.

---

## Acceptance Criteria

1. **Convex table — `notebookQueries` (AC: schema)**  
   **Given** the cns-dashboard Convex schema is deployed  
   **When** the story is complete  
   **Then** a `notebookQueries` table exists with fields:
   - `question: string` — verbatim question (max 500 chars enforced at insert)
   - `answer: string` — answer text (max 4000 chars enforced at insert; truncate with `…` suffix if longer)
   - `notebookId: string`
   - `notebookTitle: string`
   - `domain: string` — kebab-case normalized (same `normalizeDomain()` pattern as `notebookHealth`)
   - `status: 'success'` — v1 logs successful answers only
   - `queriedAt: number` — epoch ms (server-side `Date.now()` at insert)
   **And** index `by_queriedAt` on `['queriedAt']` for efficient recent-first queries

2. **Convex API — append + query (AC: convex-api)**  
   **Given** the table exists  
   **When** `logNotebookQuery` mutation is called with a valid payload  
   **Then** one row is inserted  
   **And** if total rows exceed **100**, oldest rows (by `queriedAt` asc) are deleted until count ≤ 100  
   **When** `getRecentNotebookQueries` query is called with optional `{ limit?: number }`  
   **Then** rows are returned ordered by `queriedAt` desc, default limit **20**, max limit **50**

3. **Skill writes after successful answer (AC: skill-log)**  
   **Given** `/notebook-query` completes step 4 (successful answer posted to `#hermes`)  
   **When** the Hermes agent finishes posting the formatted answer  
   **Then** it runs `log-notebook-query.mjs` via `execute_code bash` with env vars:
   - `NOTEBOOK_QUERY` — original question (verbatim)
   - `NOTEBOOK_ANSWER` — answer from `query-notebook.mjs`
   - `NOTEBOOK_ID` — `route.id`
   - `NOTEBOOK_TITLE` — `route.title`
   - `NOTEBOOK_DOMAIN` — domain from registry lookup for `route.id`, or `''` if missing
   **And** the script POSTs to Convex HTTP `/api/mutation` with path `notebookQueries:logNotebookQuery` using the same auth pattern as `pushNotebookHealthSnapshot` (`Authorization: Convex ${CONVEX_DEPLOY_KEY}`, env from `CONVEX_URL` + `CONVEX_DEPLOY_KEY` with fallback to `~/.hermes/trend-ingest.env`)
   **And** logging failure does **not** block or alter the Discord answer — stderr only, exit 0 on skip (missing env), exit 1 only on malformed input

4. **Do not log non-success paths (AC: scope)**  
   **When** resolver returns `NO_ROUTE`, query times out, or any error path fires  
   **Then** `log-notebook-query.mjs` is **not** invoked

5. **Dashboard widget on `/trends` (AC: widget)**  
   **Given** I open `/trends` (Monitor scaffold)  
   **When** `getRecentNotebookQueries` returns rows  
   **Then** a **Notebook Query History** panel appears in the Monitor support column (below `KnowledgePulseStrip`)  
   **And** each row shows: relative time, truncated question (≤ 60 chars + `…`), notebook title, answer preview (≤ 120 chars + `…`)  
   **And** loading shows "Loading query history…"; empty table shows "No notebook queries logged yet."  
   **And** the panel is read-only (no mutations, no click actions in v1)

6. **Convex reactive — no polling (AC: reactive)**  
   **Given** the dashboard is open on `/trends`  
   **When** a new query is logged via the skill  
   **Then** the history panel updates reactively via `useQuery` — no `setInterval` or manual refresh

7. **Tests pass (AC: tests)**  
   **Then** Omnipotent.md: `tests/notebook-query-log.test.mjs` covers log script env resolution, payload shape, truncation, skip-on-missing-env, and mock fetch success/failure (no live Convex)  
   **And** cns-dashboard: unit tests for `formatNotebookQueryPreview` utility + Convex module smoke (validator/truncation helpers if extracted)  
   **And** `bash scripts/verify.sh` passes in both repos (Omnipotent.md verify runs sibling cns-dashboard when present)

---

## Tasks / Subtasks

### T1: Convex data layer (cns-dashboard) (AC: 1, 2, 6)

- [x] T1.1 Add validators to `convex/validators.ts`:
  - `notebookQueryInputValidator` — `{ question, answer, notebookId, notebookTitle, domain }` (all strings)
  - `notebookQueryRowValidator` — input fields + `status: v.literal('success')` + `queriedAt: v.number()`
- [x] T1.2 Add `notebookQueries` table to `convex/schema.ts` with `.index('by_queriedAt', ['queriedAt'])`
- [x] T1.3 Create `convex/notebookQueries.ts`:
  - `getRecentNotebookQueries` query — `args: { limit: v.optional(v.number()) }`, uses index + `.order('desc').take(limit)`
  - `logNotebookQuery` mutation — truncate fields, normalize domain, insert, enforce 100-row cap
- [x] T1.4 Run `npx convex dev --once` to deploy schema + regenerate API types

### T2: Log script + skill wiring (Omnipotent.md) (AC: 3, 4)

- [x] T2.1 Create `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`:
  - Read env: `NOTEBOOK_QUERY`, `NOTEBOOK_ANSWER`, `NOTEBOOK_ID`, `NOTEBOOK_TITLE`, `NOTEBOOK_DOMAIN`
  - Validate required fields non-empty; exit 1 + stderr on bad input
  - Resolve Convex env (inline copy of `resolveConvexPushEnv` / `normalizeConvexUrl` / `parseKeyValueEnv` from `run-deterministic.mjs` — do **not** import session-close orchestrator)
  - POST mutation; exit 0 on skip or success; exit 1 on HTTP/Convex error
- [x] T2.2 Update `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` — add **step 5) Log to Convex** after step 4, before Summary table
- [x] T2.3 Update `scripts/hermes-skill-examples/notebook-query/SKILL.md` — mention history log in Overview + Tools
- [x] T2.4 Re-run `bash scripts/install-hermes-skill-notebook-query.sh` guidance in completion notes (operator step)

### T3: Dashboard widget (cns-dashboard) (AC: 5, 6)

- [x] T3.1 Add `NotebookQueriesQuery` type + `notebookQueriesQuery` field to `src/lib/context/trends-context.ts`
- [x] T3.2 Hoist `useQuery(api.notebookQueries.getRecentNotebookQueries, { limit: 20 })` in `src/routes/trends/+layout.svelte`; pass to `createTrendsContext`
- [x] T3.3 Create `src/lib/utils/notebook-query-history.ts`:
  - `truncateText(text, max): string`
  - `formatQueriedAt(ts): string` — relative time ("2m ago", "3h ago", locale date for older)
  - `formatNotebookQueryPreview(row): { question, answer, title, time }`
- [x] T3.4 Create `src/lib/components/trends/NotebookQueryHistoryPanel.svelte` — follow `AnomalyFeed.svelte` panel structure (`ti-panel`, loading/error/empty states)
- [x] T3.5 Mount in `src/lib/components/trends/MonitorScaffold.svelte` inside `ti-monitor-support`, after `KnowledgePulseStrip`

### T4: Tests + verify (AC: 7)

- [x] T4.1 `tests/notebook-query-log.test.mjs` in Omnipotent.md
- [x] T4.2 `tests/utils/notebook-query-history.test.ts` in cns-dashboard
- [x] T4.3 `bash scripts/verify.sh` green in Omnipotent.md (includes cns-dashboard)

### Review Findings

- [x] [Review][Patch] Revert unrelated AGENTS.md bump from 51-2 changeset [`specs/cns-vault-contract/AGENTS.md`] — story scope lists AGENTS.md under "Do NOT modify"; working-tree diff only adds v2.1.21 changelog duplicate (51-1 text), not 51-2 telemetry.
- [x] [Review][Patch] Use stable Convex `_id` for Svelte list keys [`cns-dashboard/src/lib/components/trends/NotebookQueryHistoryPanel.svelte:40`] — composite `queriedAt + notebookId + question` can collide for rapid repeat queries.
- [x] [Review][Defer] Cap enforcement uses full `.collect()` on each insert [`cns-dashboard/convex/notebookQueries.ts:48-55`] — acceptable at MAX_ROWS=100 per story; revisit if cap grows.
- [x] [Review][Defer] Public `logNotebookQuery` mutation (HTTP deploy key) [`cns-dashboard/convex/notebookQueries.ts:34`] — same trust model as `upsertNotebookHealthSnapshot`; v1 documented, no new auth layer required by spec.

---

## Dev Notes

### Architecture overview

```
Discord /notebook-query success
        │
   [task-prompt step 4: post answer to #hermes]
        │
   [task-prompt step 5: log-notebook-query.mjs]
        │  POST /api/mutation → notebookQueries:logNotebookQuery
        ▼
   Convex notebookQueries table (append, cap 100)
        │
   useQuery getRecentNotebookQueries (hoisted in +layout.svelte)
        ▼
   NotebookQueryHistoryPanel on /trends Monitor scaffold
```

---

### Convex module contract (`convex/notebookQueries.ts`)

Follow the focused-module pattern from `convex/notebookHealth.ts` — separate file, public mutation for Hermes HTTP push (same trust model as `upsertNotebookHealthSnapshot`: personal internal dashboard, session-close/skill pushes only).

```typescript
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { notebookQueryInputValidator } from './validators';

const MAX_ROWS = 100;
const MAX_QUESTION_LEN = 500;
const MAX_ANSWER_LEN = 4000;
const DEFAULT_QUERY_LIMIT = 20;
const MAX_QUERY_LIMIT = 50;

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export const getRecentNotebookQueries = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(1, limit ?? DEFAULT_QUERY_LIMIT), MAX_QUERY_LIMIT);
    return ctx.db
      .query('notebookQueries')
      .withIndex('by_queriedAt')
      .order('desc')
      .take(take);
  }
});

// Public by design: Hermes skill pushes individual log entries via HTTP API.
export const logNotebookQuery = mutation({
  args: { entry: notebookQueryInputValidator },
  handler: async (ctx, { entry }) => {
    const now = Date.now();
    await ctx.db.insert('notebookQueries', {
      question: truncate(entry.question, MAX_QUESTION_LEN),
      answer: truncate(entry.answer, MAX_ANSWER_LEN),
      notebookId: entry.notebookId.trim(),
      notebookTitle: entry.notebookTitle.trim(),
      domain: normalizeDomain(entry.domain || 'general'),
      status: 'success',
      queriedAt: now
    });

    const all = await ctx.db.query('notebookQueries').withIndex('by_queriedAt').order('asc').collect();
    if (all.length > MAX_ROWS) {
      const excess = all.slice(0, all.length - MAX_ROWS);
      await Promise.all(excess.map((row) => ctx.db.delete(row._id)));
    }
  }
});
```

**Index note:** Convex requires the index field to be the sort key. `by_queriedAt` on `['queriedAt']` supports `.order('desc')` on that index.

---

### Log script: `log-notebook-query.mjs`

**Path in repo:** `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`  
**Installed to:** `~/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs`

**HTTP push pattern** — copy from `scripts/session-close/run-deterministic.mjs`:
- `normalizeConvexUrl` (line ~126)
- `parseKeyValueEnv` (line ~149)
- `resolveConvexPushEnv` (line ~185) — reads `CONVEX_URL` + `CONVEX_DEPLOY_KEY` from env, falls back to `~/.hermes/trend-ingest.env` (or `CNS_TREND_INGEST_ENV_PATH`)
- Fetch body: `{ path: 'notebookQueries:logNotebookQuery', args: { entry: { question, answer, notebookId, notebookTitle, domain } }, format: 'json' }`

**Env resolution for domain:** The skill already has `route.id` and `route.title` from resolver JSON. For domain, either:
1. Extend `resolve-notebook.mjs` stdout to include `route.domain` when `ROUTED` (lookup from watched registry entry by id), **or**
2. Pass domain from Hermes by re-reading registry in a tiny helper.

**Preferred:** extend `resolve-notebook.mjs` output when `ROUTED`:

```json
{ "route": { "status": "ROUTED", "id": "...", "title": "...", "domain": "cns-brain" }, "elapsed_ms": 42 }
```

This is a **small additive change** to `resolve-notebook.mjs` + contract tests — domain is already on registry entries; lookup by `route.id` in the filtered watch list.

**Task-prompt step 5 (add after step 4):**

```bash
NOTEBOOK_QUERY='<question>' \
NOTEBOOK_ANSWER='<answer>' \
NOTEBOOK_ID='<route.id>' \
NOTEBOOK_TITLE='<route.title>' \
NOTEBOOK_DOMAIN='<route.domain or general>' \
node "$HOME/.hermes/skills/cns/notebook-query/scripts/log-notebook-query.mjs"
```

- Use the same single-quote escaping rules as step 1 (`'\''` for embedded quotes).
- **Fire-and-forget:** if log script exits non-zero, do **not** edit or retract the Discord answer. Optionally append nothing — silence is acceptable for v1.
- **Do not await** logging before considering the command complete from the operator's perspective — run log script after the answer post.

---

### Widget: `NotebookQueryHistoryPanel.svelte`

Follow `AnomalyFeed.svelte` patterns exactly:
- `getTrendsContext()` → `notebookQueriesQuery`
- `$derived` rows from `queryDataArray` or direct `data ?? []`
- `ti-panel` + `ti-panel-header` + list rows
- Loading / error / empty copy per AC-5
- **No ECharts** — plain text list (simpler than Knowledge Pulse; no chart needed for v1)
- CSS: reuse existing `ti-text-instrument`, `ti-text-prose`, `ti-anomaly-feed-list` classes where applicable or add minimal `ti-query-history-*` classes in `trends-theme.css` if needed

**Placement in MonitorScaffold:**

```svelte
<div class="ti-monitor-support">
  <ScoreStrip />
  <AnomalyFeed />
  <ForecastStrip />
  <KnowledgePulseStrip />
  <NotebookQueryHistoryPanel />  <!-- NEW: after Knowledge Pulse -->
</div>
```

---

### Context plumbing changes

Mirror `notebookHealthQuery` addition from Story 50-6:

1. `src/lib/context/trends-context.ts` — add `NotebookQueriesQuery` type alias + field
2. `createTrendsContext(...)` — add parameter **after** `notebookHealthQuery`, before `initialTopicId`
3. `src/routes/trends/+layout.svelte` — hoist query, pass to context factory

**Do NOT** call `useQuery` inside `NotebookQueryHistoryPanel.svelte` — hoisted only (NFR from 50-6).

---

### Project structure summary

| Path | Repo | Action |
|------|------|--------|
| `convex/validators.ts` | cns-dashboard | UPDATE — add notebookQuery validators |
| `convex/schema.ts` | cns-dashboard | UPDATE — add `notebookQueries` table + index |
| `convex/notebookQueries.ts` | cns-dashboard | NEW |
| `src/lib/context/trends-context.ts` | cns-dashboard | UPDATE |
| `src/routes/trends/+layout.svelte` | cns-dashboard | UPDATE |
| `src/lib/utils/notebook-query-history.ts` | cns-dashboard | NEW |
| `src/lib/components/trends/NotebookQueryHistoryPanel.svelte` | cns-dashboard | NEW |
| `src/lib/components/trends/MonitorScaffold.svelte` | cns-dashboard | UPDATE |
| `tests/utils/notebook-query-history.test.ts` | cns-dashboard | NEW |
| `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs` | Omnipotent.md | NEW |
| `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` | Omnipotent.md | UPDATE — add `domain` to ROUTED payload |
| `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` | Omnipotent.md | UPDATE — step 5 log |
| `scripts/hermes-skill-examples/notebook-query/SKILL.md` | Omnipotent.md | UPDATE — mention history |
| `tests/notebook-query-log.test.mjs` | Omnipotent.md | NEW |
| `tests/hermes-notebook-query-skill.test.mjs` | Omnipotent.md | UPDATE — assert ROUTED includes domain |

**Do NOT modify:**
- `scripts/session-close/` orchestration (no session-close coupling for v1)
- WriteGate / vault IO / AGENTS.md (no constitution change required)
- `notebookHealth` table or Knowledge Pulse components (separate concern)

---

### Architecture compliance

- **Cross-repo story:** Convex + UI in `../cns-dashboard`; skill + log script in Omnipotent.md
- **Spec-first:** No `specs/cns-vault-contract/` changes — dashboard telemetry only
- **Verify gate:** `bash scripts/verify.sh` from Omnipotent.md (runs cns-dashboard tests when sibling present)
- **WriteGate:** N/A — read-only vault; append-only Convex log
- **Security:** Log script must not push secrets — answers come from NotebookLM (already operator-visible in Discord). Reuse existing Convex deploy key trust boundary. Truncate answer at 4000 chars to limit payload size.
- **ADR-E46-002:** No new ECharts usage — text panel only
- **ADR-E46-001:** Hoist Convex query in `trends/+layout.svelte`
- **Public mutation auth:** Same as `notebookHealth:upsertNotebookHealthSnapshot` — document "personal internal dashboard" in mutation comment; no new auth layer in v1

---

### Previous story intelligence (51-1)

- **Pipeline is script-driven:** Hermes runs bash only — `resolve-notebook.mjs` → `query-notebook.mjs` → format Discord reply. Step 5 adds `log-notebook-query.mjs` as fourth script.
- **Time budget:** 90s total (updated from original 30s story spec). Logging happens **after** answer post — not counted in query budget.
- **NOTEBOOK_QUERY env var:** Required for shell-safe question passing — use same pattern for `NOTEBOOK_ANSWER` (answers may contain quotes/newlines).
- **resolve-notebook.mjs exit codes:** 0 = success JSON, 1 = routing error, 2 = registry error. Extend ROUTED JSON only — do not change exit code contract.
- **query-notebook.mjs stdout:** `{ answer, elapsed_ms }` — log script consumes `answer` field only.
- **Install script:** `bash scripts/install-hermes-skill-notebook-query.sh` copies entire skill dir — new script auto-installs on re-run.
- **Review patches from 51-1:** NOTEBOOK_QUERY env-only interpolation, start_time budget from command receipt, CLI integration tests — preserve all of these.
- **Explicit non-goal reversed:** 51-1 deferred "No response loop back to cns-dashboard" — **this story implements that deferred loop** for successful answers only.

---

### Previous story intelligence (50-6 Knowledge Pulse)

- **Convex module separation:** `convex/notebookHealth.ts` — create `convex/notebookQueries.ts` the same way, not bundled into `dashboard.ts`
- **Domain normalization:** Use identical `normalizeDomain()` on insert so future drawer filtering by `topicSlug` stays consistent
- **Context hoisting pattern:** `notebookHealthQuery` in layout → extend with `notebookQueriesQuery`
- **Deferred item awareness:** `collect()` unbounded on `notebookHealth` was deferred — **this story MUST cap at 100 rows** on insert to avoid the same issue
- **Empty/error UX:** Follow AnomalyFeed/KnowledgePulse loading patterns; don't silently hide on Convex error (show "Query history unavailable.")

---

### Git intelligence (recent commits)

- `f1f5330` — AGENTS.md sync (no schema impact)
- `ae8f9a4` — Knowledge Pulse Convex push env fallback fix — **reuse this env resolution pattern** for log script
- `a6635a9` — notebook-query timeout 30s → 90s
- `0623376` / `36c5f41` — script-only pipeline (`query-notebook.mjs`) — logging is another script in the same package

---

### Library / framework requirements

| Technology | Version / source | Usage |
|------------|------------------|-------|
| Convex | prod `amiable-ox-862.convex.cloud` | `notebookQueries` table, HTTP `/api/mutation` |
| convex-svelte | existing in cns-dashboard | `useQuery(api.notebookQueries.getRecentNotebookQueries)` |
| Svelte 5 | existing | `$derived`, `$props()` in panel |
| node:test | Omnipotent.md | log script contract tests |

**Context7 reference:** Convex HTTP API — `POST /api/mutation` with `{ path, args, format: "json" }` and `Authorization: Convex ${deployKey}`. Index queries — `.withIndex('by_queriedAt').order('desc').take(n)`.

---

### Testing requirements

**Omnipotent.md — `tests/notebook-query-log.test.mjs`:**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | All env vars set, mock fetch 200 success | exit 0, correct mutation path + args shape |
| 2 | Missing CONVEX_URL and no fallback file | exit 0, skip (no fetch) |
| 3 | Missing NOTEBOOK_ANSWER | exit 1 |
| 4 | Answer > 4000 chars | truncated in payload (if truncation in script) OR passes full and Convex truncates — pick one layer, test it |
| 5 | Fetch returns HTTP 500 | exit 1 |

**Omnipotent.md — extend `tests/hermes-notebook-query-skill.test.mjs`:**

| # | Scenario | Expected |
|---|----------|----------|
| 9 | ROUTED resolver output | JSON includes `domain` field from registry entry |

**cns-dashboard — `tests/utils/notebook-query-history.test.ts`:**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `truncateText` boundary | 60-char question + ellipsis |
| 2 | `formatQueriedAt` recent | "just now" / "5m ago" |
| 3 | `formatNotebookQueryPreview` | all preview fields populated |

Run: `bash scripts/verify.sh` from Omnipotent.md root before marking done.

---

### Scope boundaries (non-goals)

- **No error/timeout/no-route logging** — success path only in v1
- **No drawer drill-down** — list panel only; no click-to-expand
- **No vault writes** — Convex append only
- **No session-close integration** — skill pushes per query, not batch sync
- **No AGENTS.md version bump** — unless operator requests constitution note (not required for dashboard telemetry)
- **No shared `convex-http-push.mjs` refactor** — inline in log script; extract helper only if dev sees duplication worth it

---

## References

- [Source: operator brief — Epic 51 / 51-2 notebook-query history log]
- [Source: `51-1-notebook-query-discord-command.md` — pipeline, deferred dashboard loop, script patterns]
- [Source: `../cns-dashboard/_bmad-output/implementation-artifacts/50-6-knowledge-pulse-dashboard-widget.md` — Convex + context + widget patterns]
- [Source: `scripts/session-close/run-deterministic.mjs` — `pushNotebookHealthSnapshot`, `resolveConvexPushEnv`, HTTP mutation shape]
- [Source: `../cns-dashboard/convex/notebookHealth.ts` — focused Convex module pattern]
- [Source: `../cns-dashboard/src/lib/components/trends/AnomalyFeed.svelte` — panel list UX pattern]
- [Source: `../cns-dashboard/src/lib/context/trends-context.ts` — context hoisting pattern]
- [Source: `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md` — step 4 success path insertion point]
- [Source: Convex HTTP API — `/api/mutation`, deploy key auth (Context7 `/llmstxt/convex_dev_llms-full_txt`)]
- [Source: `project-context.md` — cross-repo verify, ADR-E46-001/002]
- [Source: `../cns-dashboard/project-context.md` — Convex reactive, no polling]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Fixed log-script test env isolation: missing-Convex-env test must point `CNS_TREND_INGEST_ENV_PATH` at a non-existent file to avoid operator machine fallback.
- Convex schema smoke test uses `schema.tables` property check (indexes are array-shaped in convex-test schema export).

### Completion Notes List

- Added `notebookQueries` Convex table with `logNotebookQuery` mutation (100-row cap, truncation, domain normalization) and `getRecentNotebookQueries` query (default 20, max 50).
- Created `log-notebook-query.mjs` with inline Convex HTTP push (same auth pattern as notebook health snapshot); extended `resolve-notebook.mjs` ROUTED JSON with `domain` from registry.
- Wired skill docs: task-prompt step 5 + SKILL.md history log; updated 90s budget copy in SKILL.md.
- Dashboard: hoisted `notebookQueriesQuery` in trends layout; added read-only `NotebookQueryHistoryPanel` below Knowledge Pulse on Monitor scaffold.
- Tests: `notebook-query-log.test.mjs`, extended `hermes-notebook-query-skill.test.mjs` (domain field), `notebook-query-history.test.ts`, `notebookQueries.test.ts`.
- `bash scripts/verify.sh` green (Omnipotent.md + cns-dashboard).
- **Operator step:** re-run `bash scripts/install-hermes-skill-notebook-query.sh` to copy updated skill (including `log-notebook-query.mjs`) to `~/.hermes/skills/cns/notebook-query/`.

### File List

**cns-dashboard**
- `convex/validators.ts`
- `convex/schema.ts`
- `convex/notebookQueries.ts`
- `convex/_generated/api.d.ts` (regenerated)
- `src/lib/context/trends-context.ts`
- `src/routes/trends/+layout.svelte`
- `src/lib/utils/notebook-query-history.ts`
- `src/lib/components/trends/NotebookQueryHistoryPanel.svelte`
- `src/lib/components/trends/MonitorScaffold.svelte`
- `tests/utils/notebook-query-history.test.ts`
- `tests/convex/notebookQueries.test.ts`

**Omnipotent.md**
- `scripts/hermes-skill-examples/notebook-query/scripts/log-notebook-query.mjs`
- `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs`
- `scripts/hermes-skill-examples/notebook-query/references/task-prompt.md`
- `scripts/hermes-skill-examples/notebook-query/SKILL.md`
- `tests/notebook-query-log.test.mjs`
- `tests/hermes-notebook-query-skill.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Change Log

- 2026-05-30: Story 51-2 implemented — Convex notebookQueries log, Hermes log script, /trends history panel, tests + verify green.
- 2026-05-30: Code review — reverted unrelated AGENTS.md bump; Svelte list keys use Convex `_id`; verify green; status → done.

---

## Story completion status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **done**
