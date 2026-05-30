---
baseline_commit: 71ddd88
---

# Story 50.8: Watched-notebook staleness alerts

Status: done

Epic: **50** (NotebookLM Full Integration)
Tracked in sprint-status as: **`50-8-watched-notebook-staleness-alerts`**

**Operator intent:** After `npm run sync-notebooks` completes, check every entry in `notebook-registry.json` where `watch: true`. If any such notebook has a `last_updated` timestamp older than a configurable threshold (default 7 days; controlled by `NOTEBOOK_STALE_DAYS` env var), post one Discord message per stale notebook to `#hermes` via the Discord bot token (`HERMES_DISCORD_TOKEN` / `DISCORD_BOT_TOKEN`) and channel (`CNS_DISCORD_HERMES_CHANNEL_ID`). Format: `⚠️ Notebook stale: **{title}** — last updated {N} days ago`. Notebooks where `watch: false` are never alerted. Notebooks where `last_updated` is `null` are skipped (brand-new; no staleness basis). Lives entirely in `Omnipotent.md`. No dashboard changes.

## Story

As an **operator**,
I want **a Discord alert in `#hermes` for every watched notebook that hasn't been updated recently**,
so that **I know which NotebookLM notebooks need a fresh source push before they go stale**.

## Acceptance Criteria

1. **Staleness detection (AC: detect)**
   **Given** `notebook-registry.json` contains a mix of entries with `watch: true` and `watch: false`
   **When** `checkStaleNotebooks(entries, staleDays)` is called
   **Then** it returns only entries where ALL of the following hold:
   - `watch === true`
   - `last_updated` is a non-null, parseable ISO-8601 string
   - The elapsed calendar days since `last_updated` ≥ `staleDays`
   **And** entries with `watch: false`, `last_updated: null`, or future/unparseable timestamps are excluded

2. **Alert message format (AC: format)**
   **Given** a stale registry entry `{ title, last_updated }`
   **When** the alert message is built
   **Then** the message is exactly: `⚠️ Notebook stale: **{title}** — last updated {N} days ago`
   **Where** `{N}` is `Math.floor((now - lastUpdated) / MS_PER_DAY)` (integer, no rounding quirks)

3. **Discord posting (AC: post)**
   **Given** `HERMES_DISCORD_TOKEN` (or `DISCORD_BOT_TOKEN`) and `CNS_DISCORD_HERMES_CHANNEL_ID` are set
   **When** a stale notebook is detected after sync
   **Then** one `fetch` `POST` is issued to `https://discord.com/api/v10/channels/{channelId}/messages` per stale notebook
   **And** the request body is `{ "content": "<message>" }` (JSON)
   **And** the `Authorization` header is `Bot {token}`
   **And** posts are issued sequentially (one at a time, not parallel) to avoid rate-limit burst

4. **Graceful no-op when not configured (AC: skip-unconfigured)**
   **When** `HERMES_DISCORD_TOKEN` / `DISCORD_BOT_TOKEN` is absent **or** `CNS_DISCORD_HERMES_CHANNEL_ID` is absent
   **Then** the staleness check still runs (stale notebooks are identified)
   **And** Discord posting is skipped with a `stderr` line: `[stale-alerts] Discord not configured — skipping alert posts`
   **And** the process exits zero

5. **No alerts when no stale notebooks (AC: no-alert)**
   **When** all watched notebooks are fresh (within threshold) or `watch: false` or `last_updated: null`
   **Then** no Discord posts are made
   **And** no error or warning is emitted

6. **NOTEBOOK_STALE_DAYS env var (AC: threshold)**
   **When** `NOTEBOOK_STALE_DAYS` is set to a positive integer string
   **Then** that integer is used as the staleness threshold in days
   **When** `NOTEBOOK_STALE_DAYS` is absent, zero, negative, or non-numeric
   **Then** the default threshold of `7` is used

7. **Integration with sync-notebooks (AC: wire)**
   **When** the operator runs `npm run sync-notebooks`
   **Then** after the registry is written, `alertStaleNotebooks(entries, options)` is called
   **And** the process exit code is `0` for any combination of: no stale notebooks, Discord not configured, all posts succeed
   **And** if one or more Discord posts fail (non-2xx response), stderr logs the failure but the process still exits `0` (best-effort; not a hard failure)

8. **Tests (AC: tests)**
   **Then** `tests/notebook-stale-alert.test.mjs` uses `node:test` + `node:assert/strict`, fixtures only (no live Discord, no network)
   **And** covers (at minimum):
   - `checkStaleNotebooks`: fresh watch-true entries excluded; stale watch-true included; watch-false excluded; null last_updated excluded; custom staleDays respected
   - `buildStaleAlertMessage`: correct format with 1-day and 7-day intervals
   - `alertStaleNotebooks`: no posts when Discord not configured; posts correct content per stale entry; sequential; failed HTTP response logs to stderr but resolves (not throws)
   - `resolveStaleThreshold`: valid int parsed; default fallback for missing/zero/negative/NaN
   - `bash scripts/verify.sh` passes

9. **Scope boundaries (AC: non-goals)**
   **Then** this story does **not**:
   - Change `mergeNotebookRegistry`, `readRegistry`, or any registry merge/read logic
   - Change session-close scripts (`prepare-context.mjs`, `run-deterministic.mjs`, `read-sources.mjs`)
   - Touch cns-dashboard (`../cns-dashboard`)
   - Add vault mutations or WriteGate changes
   - Change `AGENTS.md` or any `AI-Context/` files
   - Retry failed Discord posts or implement exponential backoff
   - Add an npm script beyond what's already in `sync-notebooks` (the alert runs inside the existing script)

## Tasks / Subtasks

- [x] Add `scripts/session-close/lib/notebook-stale-alert.mjs` (AC: detect, format, post, skip-unconfigured, no-alert, threshold)
  - [x] Export `resolveStaleThreshold(env)` — reads `NOTEBOOK_STALE_DAYS`, falls back to 7
  - [x] Export `checkStaleNotebooks(entries, staleDays)` — returns stale watch-true entries
  - [x] Export `buildStaleAlertMessage(entry, nowMs)` — returns formatted alert string
  - [x] Export `alertStaleNotebooks(entries, options)` — orchestrates detect + post with injectable fetch and channel/token resolution
  - [x] Internal `postDiscordMessage(channelId, token, content, fetchFn)` — one-shot Discord REST call
- [x] Modify `scripts/session-close/sync-notebooks.mjs` — call `alertStaleNotebooks` after `syncNotebookRegistry` succeeds (AC: wire)
  - [x] Import `alertStaleNotebooks` from `./lib/notebook-stale-alert.mjs`
  - [x] Call with `{ registryPath, fetchFn, env: process.env }` after the successful write
  - [x] Catch and log any unexpected errors from `alertStaleNotebooks` without changing exit code
- [x] Add `tests/notebook-stale-alert.test.mjs` (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: tests)

### Review Findings

- [x] [Review][Decision] Raw notebook titles can trigger Discord mentions or Markdown injection — dismissed by operator decision: these are trusted personal NotebookLM titles and AC3 exact body remains unchanged.
- [x] [Review][Patch] `sync-notebooks` can hang indefinitely on a stalled Discord request [scripts/session-close/lib/notebook-stale-alert.mjs:65]
- [x] [Review][Patch] Discord token and channel env values are not trimmed before use [scripts/session-close/lib/notebook-stale-alert.mjs:111]
- [x] [Review][Patch] Staleness detection accepts Date-parseable non-ISO timestamps despite AC1 requiring ISO-8601 [scripts/session-close/lib/notebook-stale-alert.mjs:31]
- [x] [Review][Patch] `sync-notebooks` stale-alert wiring lacks integration coverage [tests/notebook-stale-alert.test.mjs:164]
- [x] [Review][Patch] Unrelated Discord reply-template change is included in this story diff [scripts/hermes-skill-examples/session-close/references/discord-reply-template.md:23]

## Dev Notes

### Architecture: `notebook-stale-alert.mjs` module design

This is a new lib module at `scripts/session-close/lib/notebook-stale-alert.mjs`. It follows the same injectable-function pattern used across the session-close stack (see `sync-notebooks.mjs` → `createRunNlm`, `setRunNlmForTests`).

**Public API surface:**

```js
/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {number} staleness threshold in days (always ≥ 1)
 */
export function resolveStaleThreshold(env) { ... }

/**
 * @param {import('../sync-notebooks.mjs').NotebookRegistryEntry[]} entries
 * @param {number} staleDays
 * @param {number} [nowMs] — injectable for tests; defaults to Date.now()
 * @returns {Array<{ entry: NotebookRegistryEntry, daysStale: number }>}
 */
export function checkStaleNotebooks(entries, staleDays, nowMs = Date.now()) { ... }

/**
 * @param {{ title: string }} entry
 * @param {number} daysStale
 * @returns {string}
 */
export function buildStaleAlertMessage(entry, daysStale) {
  return `⚠️ Notebook stale: **${entry.title}** — last updated ${daysStale} days ago`;
}

/**
 * @param {import('../sync-notebooks.mjs').NotebookRegistryEntry[]} entries
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   nowMs?: number,
 *   fetchFn?: typeof fetch,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function alertStaleNotebooks(entries, options = {}) { ... }
```

### `checkStaleNotebooks` logic

```js
const MS_PER_DAY = 86_400_000;

export function checkStaleNotebooks(entries, staleDays, nowMs = Date.now()) {
  const results = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry.watch) continue;
    if (entry.last_updated === null || typeof entry.last_updated !== "string") continue;
    const ts = Date.parse(entry.last_updated);
    if (!Number.isFinite(ts)) continue;
    const daysStale = Math.floor((nowMs - ts) / MS_PER_DAY);
    if (daysStale >= staleDays) {
      results.push({ entry, daysStale });
    }
  }
  return results;
}
```

### `resolveStaleThreshold` logic

```js
export function resolveStaleThreshold(env) {
  const raw = (env ?? {}).NOTEBOOK_STALE_DAYS;
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}
```

### `alertStaleNotebooks` orchestration

```js
export async function alertStaleNotebooks(entries, options = {}) {
  const env = options.env ?? process.env;
  const nowMs = options.nowMs ?? Date.now();
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  const staleDays = resolveStaleThreshold(env);
  const stale = checkStaleNotebooks(entries, staleDays, nowMs);
  if (stale.length === 0) return;

  const token = env.HERMES_DISCORD_TOKEN || env.DISCORD_BOT_TOKEN || "";
  const channelId = env.CNS_DISCORD_HERMES_CHANNEL_ID || "";

  if (!token || !channelId) {
    process.stderr.write("[stale-alerts] Discord not configured — skipping alert posts\n");
    return;
  }

  for (const { entry, daysStale } of stale) {
    const content = buildStaleAlertMessage(entry, daysStale);
    await postDiscordMessage(channelId, token, content, fetchFn);
  }
}
```

### `postDiscordMessage` — Discord REST API

Uses the Discord REST API channel message endpoint. The bot token (`HERMES_DISCORD_TOKEN`) is the same credential used by Hermes gateway.

```js
async function postDiscordMessage(channelId, token, content, fetchFn) {
  try {
    const resp = await fetchFn(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      },
    );
    if (!resp.ok) {
      process.stderr.write(
        `[stale-alerts] Discord post failed: ${resp.status} ${resp.statusText}\n`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[stale-alerts] Discord post error: ${message}\n`);
  }
}
```

**Key detail — best-effort:** `postDiscordMessage` catches all errors and logs to stderr but never throws. This ensures one failed post does not prevent the remaining stale notebook alerts from being posted.

### Wiring into `sync-notebooks.mjs`

Add at the top of the file:
```js
import { alertStaleNotebooks } from "./lib/notebook-stale-alert.mjs";
```

In `main()`, after the successful write log line:
```js
// Before exit (in the try block, after writeFile/log):
await alertStaleNotebooks(merged);
```

This means `alertStaleNotebooks` is called with the freshly-merged registry array and reads `process.env` by default for token/channel/threshold. No changes to `syncNotebookRegistry` (the exported function) are needed — the alert only runs from the CLI entry point.

**Important:** If `alertStaleNotebooks` itself throws unexpectedly, wrap the call in a try/catch that logs and does NOT set `process.exitCode = 1`:
```js
try {
  await alertStaleNotebooks(merged);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[stale-alerts] unexpected error: ${message}\n`);
}
```

### Environment variables

| Var | Purpose | Notes |
|-----|---------|-------|
| `NOTEBOOK_STALE_DAYS` | Staleness threshold in days | Default: 7; must be positive integer |
| `HERMES_DISCORD_TOKEN` | Discord bot token (primary) | Same token used by Hermes gateway |
| `DISCORD_BOT_TOKEN` | Discord bot token (fallback) | Checked if `HERMES_DISCORD_TOKEN` absent |
| `CNS_DISCORD_HERMES_CHANNEL_ID` | `#hermes` channel snowflake | `1500733488897462382` in production |

All are read from `process.env` at runtime. Never hardcode values. Token resolution: `HERMES_DISCORD_TOKEN` takes priority over `DISCORD_BOT_TOKEN`.

### Test patterns

Follow the same test conventions as `tests/sync-notebooks.test.mjs` and `tests/notebook-routing-report.test.mjs`:
- `node:test` + `node:assert/strict`
- No live Discord API — inject a `fetchFn` stub
- Use `withIsolatedEnv` (copy the helper directly into this test file; don't import cross-test)

```js
// withIsolatedEnv helper (copy from smart-routing.test.mjs)
function withIsolatedEnv(overrides, fn) {
  return async () => {
    const saved = {};
    const keys = Object.keys(overrides);
    for (const k of keys) {
      saved[k] = process.env[k];
      if (overrides[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = overrides[k];
      }
    }
    try {
      await fn();
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) {
          delete process.env[k];
        } else {
          process.env[k] = saved[k];
        }
      }
    }
  };
}
```

**Injectable fetchFn pattern for tests:**

```js
// Builds a stub fetch that returns the given status
function makeFetchStub(status = 200) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init?.body ?? "{}") });
    return { ok: status >= 200 && status < 300, status, statusText: String(status) };
  };
  return { fetchFn, calls };
}
```

### Test cases required

| Test | Setup | Assert |
|------|-------|--------|
| `resolveStaleThreshold` — default | no env | `=== 7` |
| `resolveStaleThreshold` — valid int | `NOTEBOOK_STALE_DAYS=14` | `=== 14` |
| `resolveStaleThreshold` — zero | `NOTEBOOK_STALE_DAYS=0` | `=== 7` |
| `resolveStaleThreshold` — negative | `NOTEBOOK_STALE_DAYS=-1` | `=== 7` |
| `resolveStaleThreshold` — non-numeric | `NOTEBOOK_STALE_DAYS=abc` | `=== 7` |
| `checkStaleNotebooks` — fresh watch-true excluded | `watch: true`, `last_updated` = yesterday, `staleDays = 7` | `[]` |
| `checkStaleNotebooks` — stale watch-true included | `watch: true`, `last_updated` = 10 days ago, `staleDays = 7` | length 1, `daysStale = 10` |
| `checkStaleNotebooks` — watch-false excluded | `watch: false`, stale date | `[]` |
| `checkStaleNotebooks` — null last_updated skipped | `watch: true`, `last_updated: null` | `[]` |
| `checkStaleNotebooks` — exactly at threshold | `daysStale === staleDays` | included |
| `buildStaleAlertMessage` — 1 day | `daysStale = 1` | `⚠️ Notebook stale: **Title** — last updated 1 days ago` |
| `buildStaleAlertMessage` — 7 days | `daysStale = 7` | correct format |
| `alertStaleNotebooks` — no posts when Discord not configured | no token/channel in env | 0 fetch calls; no throw |
| `alertStaleNotebooks` — posts correct content per stale entry | 2 stale entries, stub fetch | 2 fetch calls; correct `content` and `Authorization: Bot …` |
| `alertStaleNotebooks` — sequential | 2 stale entries | calls appear in order in `fetchFn.calls` |
| `alertStaleNotebooks` — failed HTTP (4xx) logs to stderr, no throw | stub returns 400 | process.exitCode unchanged; stderr captured |
| `alertStaleNotebooks` — no stale entries → no calls | all fresh | 0 fetch calls |

### Project structure

| Path | Action |
|------|--------|
| `scripts/session-close/lib/notebook-stale-alert.mjs` | NEW — `resolveStaleThreshold`, `checkStaleNotebooks`, `buildStaleAlertMessage`, `alertStaleNotebooks`, `postDiscordMessage` |
| `scripts/session-close/sync-notebooks.mjs` | MODIFY — import and call `alertStaleNotebooks` after registry write in `main()` |
| `tests/notebook-stale-alert.test.mjs` | NEW |

### Architecture compliance

- **Spec-first:** No `specs/cns-vault-contract/` changes — operator tooling, not vault contract
- **Verify gate:** `bash scripts/verify.sh` mandatory before done
- **WriteGate:** N/A — no `AI-Context/` writes
- **Security:** Token read from env only; never logged or written to disk; no retry of failed posts (no amplification risk)
- **No dashboard changes:** Confirmed out of scope

### Previous story intelligence (50-7 routing report)

- The injectable-function test pattern is well established across this epic: `createRunNlm`/`setRunNlmForTests` in `sync-notebooks.mjs`; `withIsolatedEnv` in test files. Follow the same convention.
- `HERMES_DISCORD_TOKEN` → `DISCORD_BOT_TOKEN` fallback precedence is the same pattern used in `src/config.ts` (`firstNonEmptyTrimmed` over multiple env var names). Apply the same priority order here.
- `last_updated` may be `null` for brand-new entries (see Story 50-1 AC2: "set `last_updated` from CLI `updated_at` on **first insert**" — but the sync script sets it from `updated_at` on first insert too, so `null` only survives if `updated_at` was missing from `nlm` output). Always guard against `null`.
- Tests must not call live Discord API — `fetch` must be injectable. Node's built-in `fetch` is available in Node ≥ 18 (this project uses `"type": "module"` so it's the global `fetch` from `globalThis`).

### `notebookTargetsFromWatchRegistry` reference (from `read-sources.mjs`)

The `watch` flag semantics are already established:
```js
// scripts/session-close/lib/read-sources.mjs
const watched = entries.filter((row) => row.watch === true);
```
Use the same strict `=== true` comparison in `checkStaleNotebooks`.

## References

- [Source: `scripts/session-close/sync-notebooks.mjs` — `syncNotebookRegistry`, `readRegistry`, `writeRegistry`, `main()`]
- [Source: `scripts/session-close/lib/sync-notebook-registry.mjs` — `NotebookRegistryEntry` typedef, `mergeNotebookRegistry`]
- [Source: `scripts/session-close/lib/read-sources.mjs` — `notebookTargetsFromWatchRegistry` (watch flag pattern)]
- [Source: `scripts/session-close/lib/notebook-registry.json` — registry SSOT schema]
- [Source: `src/config.ts` — `CNS_DISCORD_HERMES_CHANNEL_ID`, token env var precedence]
- [Source: `scripts/hermes-gateway-start.sh` — `HERMES_DISCORD_TOKEN` → `DISCORD_BOT_TOKEN` mapping]
- [Source: `tests/sync-notebooks.test.mjs` — test patterns, node:test conventions]
- [Source: `tests/notebook-routing-report.test.mjs` — `withIsolatedEnv` helper, injectable fetch stubs]
- [Source: `50-1-notebook-registry-sync.md` — `NotebookRegistryEntry` shape, `last_updated` semantics]
- [Source: `50-2-watch-flag-fanout.md` — watch flag semantics]
- [Source: `50-7-notebook-routing-report.md` — previous story dev notes, injectable-function pattern]
- [Discord REST API: `POST /channels/{channel.id}/messages` — `https://discord.com/developers/docs/resources/message#create-message`]

## Dev Agent Record

### Agent Model Used

GPT-5.5

### Debug Log References

- Red phase: `node --test tests/notebook-stale-alert.test.mjs` failed with `ERR_MODULE_NOT_FOUND` before `notebook-stale-alert.mjs` existed.
- Green/refactor phase: `node --test tests/notebook-stale-alert.test.mjs` passed after adding the module.
- Regression: `npm test` passed after wiring `sync-notebooks.mjs`.
- Definition of done: `bash scripts/verify.sh` passed, including CNS test/lint/typecheck/build and sibling `cns-dashboard` tests.

### Implementation Plan

- Add a focused stale-alert library that keeps registry staleness detection, message formatting, Discord posting, and env threshold resolution separate from registry sync/merge logic.
- Keep Discord delivery best-effort: missing config, failed HTTP responses, and fetch errors log to stderr where required but do not change process exit behavior.
- Wire the alert only into the `sync-notebooks.mjs` CLI `main()` success path so the exported `syncNotebookRegistry()` behavior remains unchanged for tests and callers.

### Completion Notes List

- Added watched-notebook staleness detection using strict `watch === true`, parseable non-future `last_updated`, and integer day thresholds.
- Added exact stale alert formatting and sequential Discord REST posts to `POST /api/v10/channels/{channelId}/messages` using `Authorization: Bot {token}`.
- Wired `npm run sync-notebooks` CLI flow to run stale alerts after a successful registry write and catch unexpected alert errors without failing sync.
- Added fixture-only `node:test` coverage for threshold parsing, stale detection, alert formatting, no-op paths, sequential posting, token precedence, and failed HTTP logging.

### File List

- `scripts/session-close/lib/notebook-stale-alert.mjs`
- `scripts/session-close/sync-notebooks.mjs`
- `tests/notebook-stale-alert.test.mjs`

## Change Log

- 2026-05-30: Implemented watched-notebook staleness alerts, wired them into `sync-notebooks`, added unit coverage, and passed `bash scripts/verify.sh`.
