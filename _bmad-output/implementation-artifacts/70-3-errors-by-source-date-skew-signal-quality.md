---
story_id: 70-3
epic: 70
title: errors-by-source-date-skew-signal-quality
status: done
baseline_date: 2026-06-12
baseline_commit: a8d209a
predecessors: 70-1, 70-2, spec-70-post-story-2-stabilization
repo: Omnipotent.md
priority: P0 (date skew) / P1 (errors_by_source, Bluesky) / P2 (X entities)
operator_brief: 2026-06-12
---

# Story 70.3: errors_by_source, date-skew fix, signal quality

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **CNS operator receiving the deterministic Node morning digest**,
I want **adapter failures surfaced per-source, digest dates locked to Australia/Sydney, and Bluesky/X signal titles rendered cleanly**,
so that **Convex pushes, Discord posts, and source-health metadata reflect the correct run day and trustworthy signal text**.

## Epic context (70 — Deterministic Morning Digest Orchestrator)

| Story | Status | Outcome |
|-------|--------|---------|
| 70-1 | done | Cron invokes `run-digest-convex-completion.mjs` instead of Hermes agent session ([spec-70-1](spec-70-1-wire-node-orchestrator-cron.md)) |
| 70-2 | done | Non-fatal Discord post after Convex push (`post-digest-discord.mjs`) |
| post-2 stabilization | done | Node payload fallback markdown renderer, watchdog NVM bootstrap ([spec-70-post-story-2-stabilization](spec-70-post-story-2-stabilization.md)) |
| **70-3** | **this story** | errors_by_source, Sydney date hardening, Bluesky/X title quality |

**Pipeline today:** `collectAdapterOutputs` → `buildDigestPushPayload` → dedupe → score → `writeDigestPushArtifact` → `pushDigestToConvex` → `postDigestToDiscord` (non-fatal).

## Acceptance Criteria

### AC1 — Date skew fix (P0)

**Given** the orchestrator runs without `CRON_TZ` / `TZ` set (manual dev run or minimal cron env)
**When** `runDigestConvexCompletion()` resolves `todayDate`
**Then** `todayDate` is the **Australia/Sydney** civil `YYYY-MM-DD` date (never UTC `toISOString().slice(0,10)` and never machine-local when env tz absent)

**And** every date string derived inside these files uses `formatSydneyDate()` or equivalent `Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' })`:
- `scripts/run-digest-convex-completion.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/write-digest-push-artifact.mjs`

**And** `payload.run.date`, artifact filename `digest-push-${date}.json`, and watchdog log `date=` field all match the same Sydney civil date for a single run

**Regression anchor:** At `2026-06-10T20:00:00.000Z`, Sydney civil date is `2026-06-11` (already tested for `formatSydneyDate` — extend coverage if helper moves).

### AC2 — errors_by_source on collectAdapterOutputs (P1)

**Given** one or more adapter wrappers fail (timeout, non-zero exit swallowed by execFile, empty stdout, invalid JSON, or adapter JSON `{ error: "…" }`)
**When** `collectAdapterOutputs(env)` completes
**Then** each source key returns a discriminated result:

```javascript
{ success: true, data: <parsed object> }
// or
{ success: false, error: '<short reason>' }
```

**And** a **one-line summary** is logged after collection (stderr or watchdog log detail), e.g.:
`collect: trends=ok newsapi=ok arxiv=fail:timeout twitter=fail:invalid-json …`

**And** `run.errors_by_source` (snake_case on `payload.run`) lists only failed sources: `{ "reddit": "timeout", "twitter": "X session invalid" }`

**And** collection remains **non-fatal** — partial sources still produce a digest when any signals exist

### AC3 — Downstream consumers handle wrapped adapter results (P1)

**Given** wrapped results from AC2
**When** `buildDigestPushPayload`, `buildSourceOutcomesFromPayload`, and Discord fallback renderer run
**Then** they unwrap via a shared helper (e.g. `unwrapAdapterResult(result)`) that:
- Returns `data` when `success === true`
- Returns `{ error: reason }` or empty object when `success === false`
- **Still accepts legacy bare objects** `{ posts: [...] }` / `{ error: "…" }` for test mocks and backward compatibility

**And** `sourceOutcomes` marks failed adapters `status: 'error'` with `reason` from `errors_by_source` even when zero signals emitted

**And** all existing tests in `run-digest-convex-completion.test.mjs`, `morning-digest-build-payload.test.mjs`, `parse-digest-source-outcomes.test.mjs`, `post-digest-discord.test.mjs` continue to pass (update mocks to wrapped shape where they inject `collectFn` results)

### AC4 — Bluesky title quality (P1)

**Given** a Bluesky post whose `record.text` is multi-line (e.g. first line `Full text:` and body on line 2)
**When** `mapFeedPost` maps the feed item
**Then** `title` is derived from the **first non-empty line** of `record.text`, with junk-prefix skip for lines matching `/^(full text|thread|re:|fw:):?\s*$/i` — use next non-empty line instead

**And** title is capped at **80 characters**, truncated at the **last word boundary** before 80 (no mid-word cut; append `…` only when truncated)

**And** when no usable text remains, fallback title is `[Bluesky post by @{handle}]`

**And** `TITLE_MAX_CHARS` (280) is no longer used for digest titles — keep 80 as `BSKY_TITLE_MAX_CHARS` constant

### AC5 — X/Twitter HTML entity unescape (P2)

**Given** tweet `text` / `full_text` containing `&amp;`, `&lt;`, `&gt;`, `&quot;`, or `&#39;`
**When** `mapBirdTweet` builds `title`
**Then** entities are unescaped **inline** before `truncateTitle` (no new npm packages)

**Example:** `Fish &amp; chips` → `Fish & chips` in Discord and Convex signal title

### AC6 — Verify gate

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass with no regressions

## Tasks / Subtasks

- [x] **T1 — Shared Sydney date helper** (AC1)
  - [x] T1.1 Extract `formatSydneyDate(envTz, now)` to `scripts/hermes-skill-examples/morning-digest/scripts/digest-date.mjs` (or colocate export from completion module if smaller diff)
  - [x] T1.2 Import in `run-digest-convex-completion.mjs`; keep default `'Australia/Sydney'` when `CRON_TZ`/`TZ` absent
  - [x] T1.3 Audit `push-digest-convex.mjs` and `write-digest-push-artifact.mjs` — if any date derivation is added or exists, use shared helper; document in file header that `run.date` must be Sydney civil date from caller
  - [x] T1.4 Align `push-digest-watchdog.mjs` `formatTodayLocalDate` default with Sydney (same default as `formatSydneyDate`) — prevents skew when watchdog runs standalone without `todayDate` injection
  - [x] T1.5 Tests: Sydney date at UTC boundary; missing env tz still returns Sydney date

- [x] **T2 — collectAdapterOutputs errors_by_source** (AC2)
  - [x] T2.1 Refactor loop in `collectAdapterOutputs` to emit `{ success, data? | error? }` per source
  - [x] T2.2 Map failure reasons: `timeout`, `empty-stdout`, `invalid-json`, `exec-error:<msg>`, `adapter-error:<json.error>`
  - [x] T2.3 Add `summarizeAdapterCollection(results)` → one-line log string; call after loop
  - [x] T2.4 Build `errors_by_source` object on `payload.run` in `runDigestConvexCompletion` before `buildDigestPushPayload`
  - [x] T2.5 Export `unwrapAdapterResult` for downstream use

- [x] **T3 — Downstream unwrap** (AC3)
  - [x] T3.1 Add `unwrapAdapterResult` usage in `runDigestConvexCompletion` when passing adapter data to `buildDigestPushPayload`
  - [x] T3.2 Update `buildSourceOutcomesFromPayload` in `parse-digest-source-outcomes.mjs` to read wrapped results (`success: false` → error outcome; `data.error` → error outcome)
  - [x] T3.3 Ensure `attachSourceOutcomes` receives unwrapped or wrapped `adapterResults` consistently (prefer wrapped for sourceOutcomes, unwrapped for signal build)

- [x] **T4 — Bluesky title** (AC4)
  - [x] T4.1 Add `deriveBlueskyTitle(text, authorHandle)` in `fetch-bluesky-signals.mjs`
  - [x] T4.2 Wire into `mapFeedPost`; update `truncateTitle` usage
  - [x] T4.3 Tests in `morning-digest-bluesky-adapter.test.mjs`: multi-line "Full text:" fixture, 80-char word boundary, fallback handle title

- [x] **T5 — X HTML entities** (AC5)
  - [x] T5.1 Add `unescapeHtmlEntities(text)` inline in `fetch-x-signals.mjs`
  - [x] T5.2 Apply in `mapBirdTweet` before `truncateTitle`
  - [x] T5.3 Test in `morning-digest-x-adapter.test.mjs`: `&amp;` in fixture tweet

- [x] **T6 — Verification** (AC6)
  - [x] T6.1 `node --test tests/run-digest-convex-completion.test.mjs tests/morning-digest-build-payload.test.mjs tests/parse-digest-source-outcomes.test.mjs tests/morning-digest-bluesky-adapter.test.mjs tests/morning-digest-x-adapter.test.mjs`
  - [x] T6.2 `bash scripts/verify.sh`

### Review Findings

- [x] [Review][Decision] `errors_by_source` Convex persistence strategy — **Resolved A:** extended `digestRunInputValidator` + `digestRunRowValidator` with optional `errors_by_source: v.record(v.string(), v.string())`; added `digest.test.ts` coverage.

- [x] [Review][Patch] Google Trends adapter key mismatch — `buildSourceOutcomesFromPayload` maps `google_trends` → `trends` collect key. [`parse-digest-source-outcomes.mjs:402`]

- [x] [Review][Patch] `errors_by_source` key inconsistency — `buildErrorsBySource` maps `trends` → `google_trends`. [`adapter-result.mjs:78`]

- [x] [Review][Patch] Zero-signals path drops error metadata — zero-signal runs now attach sourceOutcomes, write artifact, and log `errors_by_source` in watchdog detail. [`run-digest-convex-completion.mjs:413`]

- [x] [Review][Patch] Missing test: `google_trends` wrapped failure → sourceOutcomes — added `trends` collect-key fixture. [`tests/parse-digest-source-outcomes.test.mjs`]

- [x] [Review][Patch] Missing test: nested `{ success: true, data: { error } }` — added twitter nested-error fixture. [`tests/parse-digest-source-outcomes.test.mjs`]

- [x] [Review][Defer] `isAdapterErrorPayload` treats `{ error, posts: [] }` as success — intentional heuristic: adapter error JSON has no data keys. Empty-array collision unlikely in production. [`adapter-result.mjs:21`] — deferred, pre-existing design choice

- [x] [Review][Defer] No dedicated `adapter-result.mjs` unit tests — logic covered indirectly via `run-digest-convex-completion.test.mjs` re-exports. [`adapter-result.mjs`] — deferred, pre-existing coverage gap

- [x] [Review][Defer] HTML unescape limited to five entities — AC5 specifies only `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`. Numeric entities out of scope. [`fetch-x-signals.mjs:133`] — deferred, AC5 satisfied

## Dev Notes

### Root cause — date skew

`formatSydneyDate` in `run-digest-convex-completion.mjs` defaults to `'Australia/Sydney'`:

```39:43:scripts/run-digest-convex-completion.mjs
export function formatSydneyDate(envTz, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: envTz?.trim() || 'Australia/Sydney',
  }).format(now);
}
```

`formatTodayLocalDate` in `push-digest-watchdog.mjs` does **not** default — `timeZone: undefined` falls back to **machine local**:

```35:38:scripts/push-digest-watchdog.mjs
export function formatTodayLocalDate(envTz, now = new Date()) {
  const timeZone = envTz?.trim() || undefined;
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}
```

When `runDigestConvexCompletion` passes `todayDate` into the watchdog, paths align. Standalone watchdog runs or any code path that derives date without the shared default can write/read `digest-push-YYYY-MM-DD.json` on the wrong civil day. **Fix: single helper, same default everywhere.**

Normative reference: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` §Hard constraints #6 — Sydney civil date for headers, `run.date`, artifact filenames.

### Root cause — silent adapter failures

Current `collectAdapterOutputs` swallows all errors:

```110:120:scripts/run-digest-convex-completion.mjs
  for (const [key, runner] of tasks) {
    try {
      const stdout = await runner();
      const parsed = parseAdapterStdout(stdout);
      if (parsed && typeof parsed === 'object') {
        results[key] = parsed;
      }
    } catch {
      // Adapter failures are non-fatal — continue with partial sources.
    }
  }
```

Failures produce **missing keys** — indistinguishable from "adapter not run". `buildSourceOutcomesFromPayload` only detects errors when `adapterPayload.error` exists:

```408:412:scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs
		const adapterPayload = adapterResults[adapterKey];
		if (adapterPayload && typeof adapterPayload === 'object' && 'error' in adapterPayload) {
			status = 'error';
			reason = String(/** @type {{ error?: unknown }} */ (adapterPayload).error ?? 'adapter error');
		}
```

Wrapped `{ success: false, error }` must satisfy this path (or unwrap layer must surface `error`).

### Root cause — Bluesky titles

`mapFeedPost` uses `truncateTitle(String(recordRow.text ?? ''))` on the **full** post body (280 chars). Multi-line posts with label lines (`Full text:`) surface garbage titles. Fix: first meaningful line, 80 chars, word boundary, handle fallback.

### Root cause — X HTML entities

`mapBirdTweet` passes raw API text to `truncateTitle`. Twitter GraphQL returns HTML-escaped entities. Unescape before truncate.

### Architecture compliance

| Constraint | Rule |
|------------|------|
| `resolveOperatorHome()` | Never `os.homedir()` — use existing `fetch-arxiv-rss.mjs` helper |
| Discord post | Non-fatal after Convex push — do not throw from `postDigestToDiscord` failure |
| `run-morning-digest-cron.sh` | **Do not modify** (Epic 70-1 boundary) |
| New packages | **None** |
| Vault WriteGate | Not touched |
| ADR-E67-001 | Adapters stay Node-native; no subprocess to last30days |

### File structure — touch map

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/digest-date.mjs` | **NEW** (optional — shared `formatSydneyDate`) |
| `scripts/run-digest-convex-completion.mjs` | **UPDATE** — `collectAdapterOutputs`, `errors_by_source`, unwrap, date import |
| `scripts/push-digest-watchdog.mjs` | **UPDATE** — align date default (T1.4) |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | **AUDIT** — date strings; pass through `errors_by_source` / `sourceOutcomes` on `run` if present |
| `scripts/hermes-skill-examples/morning-digest/scripts/write-digest-push-artifact.mjs` | **AUDIT** — date strings; persist `errors_by_source` in artifact JSON |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | **UPDATE** — wrapped adapter result handling |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs` | **UPDATE** — `deriveBlueskyTitle` |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs` | **UPDATE** — `unescapeHtmlEntities` |
| `tests/run-digest-convex-completion.test.mjs` | **UPDATE** — wrapped collect, errors_by_source, date boundary |
| `tests/morning-digest-bluesky-adapter.test.mjs` | **UPDATE** — title quality cases |
| `tests/morning-digest-x-adapter.test.mjs` | **UPDATE** — entity unescape |
| `tests/parse-digest-source-outcomes.test.mjs` | **UPDATE** — wrapped adapter error → sourceOutcomes |
| `tests/push-digest-watchdog.test.mjs` | **UPDATE** if date default changes |

### Testing requirements

- Use `node:test` / `node:assert/strict` — match existing digest test style
- Mock `collectFn` in completion tests with wrapped shape
- Do **not** require live network for AC4/AC5 — fixture-only
- `bash scripts/verify.sh` is the merge gate

### Library / framework requirements

- **No new npm packages**
- **No Context7 lookup required** — pure Node `Intl`, string helpers, existing adapter patterns
- Convex push contract unchanged — `errors_by_source` is optional metadata on `run` object (verify `digestRunInputValidator` tolerates extra keys or extend validator in cns-dashboard only if push rejects unknown fields — check before adding)

### Previous story intelligence (70-1, 70-2, post-2 stabilization)

From [spec-70-post-story-2-stabilization](spec-70-post-story-2-stabilization.md):

- Discord markdown fallback lives in `resolveDigestMarkdownFromPayload()` / `renderDigestMarkdownFromPayload()` — signal `title` fields flow directly into Discord bullets; fixing Bluesky/X titles improves Discord output without renderer changes
- Non-fatal Discord: completion logs `discord-post-failed` but returns `completion-backfill-push` success — preserve this
- Tests proving non-fatal Discord: `run-digest-convex-completion.test.mjs` line ~77 expects `discord-post-failed` in log when token missing

From git history (`a8d209a`, `f9477d1`, `f5aac17`):

- Epic 70 replaced Hermes agent cron with Node orchestrator — all adapter collection now goes through `collectAdapterOutputs`; this story hardens that path
- `post-digest-discord.mjs` added in 70-2 — runs after `pushPayload` in `scoreWriteAndPush`

### Git intelligence

Recent commits (2026-06-12):

1. `a8d209a` — stabilize epic 70 digest delivery (fallback markdown, watchdog NVM, cron contract test)
2. `f9477d1` — feat(70-2): Discord post step after Convex push
3. `f5aac17` — feat(70-1): Node orchestrator cron entrypoint

Pattern: small focused commits per story; test files colocated in `tests/`; no new dependencies.

### Project context reference

- [project-context.md](../../project-context.md) — verify gate, no vault writes, spec-first
- [task-prompt.md](../../scripts/hermes-skill-examples/morning-digest/references/task-prompt.md) — Sydney date rule, source failure independence
- [ADR-E67-001-last30days-codebook-only.md](../../docs/ADR-E67-001-last30days-codebook-only.md) — adapters are Node-only
- [69-3-source-health-panel.md](69-3-source-health-panel.md) — `sourceOutcomes` contract (this story improves error accuracy feeding 69-3 panel)

### Implementation sketch — unwrap helper

```javascript
/**
 * @param {unknown} result
 * @returns {Record<string, unknown>}
 */
export function unwrapAdapterResult(result) {
  if (!result || typeof result !== 'object') {
    return {};
  }
  if ('success' in result) {
    const row = /** @type {{ success?: boolean; data?: unknown; error?: unknown }} */ (result);
    if (row.success === false) {
      return { error: String(row.error ?? 'adapter failed') };
    }
    if (row.data && typeof row.data === 'object') {
      return /** @type {Record<string, unknown>} */ (row.data);
    }
    return {};
  }
  return /** @type {Record<string, unknown>} */ (result);
}
```

### Implementation sketch — Bluesky title

```javascript
const BSKY_TITLE_MAX = 80;
const JUNK_LINE_RE = /^(full text|thread|re|fw):\s*$/i;

export function deriveBlueskyTitle(text, authorHandle) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let line = lines.find((l) => !JUNK_LINE_RE.test(l)) ?? '';
  if (!line) {
    const handle = String(authorHandle ?? '').trim();
    return handle ? `[Bluesky post by @${handle}]` : '[Bluesky post]';
  }
  if (line.length <= BSKY_TITLE_MAX) return line;
  const slice = line.slice(0, BSKY_TITLE_MAX);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 20 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}
```

### Implementation sketch — X entity unescape

```javascript
export function unescapeHtmlEntities(text) {
  return String(text ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
```

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Hermes skill install gate required `bash scripts/install-hermes-skill-morning-digest.sh` after adding `digest-date.mjs` and `adapter-result.mjs` to skill mirror.

### Completion Notes List

- Extracted `formatSydneyDate` to `digest-date.mjs`; watchdog `formatTodayLocalDate` now delegates to Sydney default (fixes standalone watchdog date skew).
- `collectAdapterOutputs` emits wrapped `{ success, data | error }` per source; logs `collect: key=ok|fail:reason` summary; `errors_by_source` on `payload.run`.
- Shared `adapter-result.mjs`: `unwrapAdapterResult`, `summarizeAdapterCollection`, `buildErrorsBySource`, `isAdapterErrorPayload`.
- `buildSourceOutcomesFromPayload` marks wrapped failures as `status: 'error'` even with zero signals.
- Bluesky: `deriveBlueskyTitle` — junk-line skip, 80-char word boundary, handle fallback.
- X: `unescapeHtmlEntities` applied before title truncate (`Fish &amp; chips` → `Fish & chips`).
- `bash scripts/verify.sh` passed (including cns-dashboard tests and Hermes skill parity).

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/digest-date.mjs` (new)
- `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` (new)
- `scripts/run-digest-convex-completion.mjs`
- `scripts/push-digest-watchdog.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/write-digest-push-artifact.mjs`
- `tests/run-digest-convex-completion.test.mjs`
- `tests/parse-digest-source-outcomes.test.mjs`
- `tests/morning-digest-bluesky-adapter.test.mjs`
- `tests/morning-digest-x-adapter.test.mjs`
- `tests/push-digest-watchdog.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `../cns-dashboard/convex/validators.ts` (review: `errors_by_source` on digest run validators)
- `../cns-dashboard/tests/convex/digest.test.ts` (review: `errors_by_source` mutation test)

### Change Log

- 2026-06-12: Story 70.3 — errors_by_source, Sydney date hardening, Bluesky/X signal title quality.
- 2026-06-12: Code review — Convex `errors_by_source` validator, trends/google_trends key alignment, zero-signals artifact persistence, test coverage.

## Story completion status

- Status: **done**
- Code review patches applied; `bash scripts/verify.sh` passed.
- Review decision: extend Convex validators for `errors_by_source` (option A).
