---
story_id: 68-7
epic: 68
title: x-integration-env-docs
status: review
baseline_date: 2026-06-11
baseline_commit: 02d0d4f
operator_brief: 2026-06-11
predecessors: 68-6
blocks: 68-8
repo: Omnipotent.md only
fr_ids: FR-12, FR-13, FR-14
priority: P3
operator_override: cookie-graphql-via-bird-search
---

# Story 68.7: X Integration + Env Docs + Credential Health Check

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator running the morning digest on WSL**,
I want **documented X/Twitter session-cookie setup, a `--check` health probe, and actionable stderr when cookies expire**,
so that **I can rotate `X_AUTH_TOKEN` / `X_CT0` before digest runs fail silently, Source 11 degrades predictably, and 68-8 live validation can record GO/NO-GO for X without official API keys or monthly budget tooling**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup |
| **Priority** | **P3** — integration polish after adapter lands; operator-dependent |
| **Repo** | **Omnipotent.md only** — fetch script `--check`, env docs, config-snippet, Operator Guide §15.11 extension, tests |
| **Predecessors** | **68-6** (done) — `fetch-x-signals.mjs`, `hermes-run-x.sh`, task-prompt Source 11, `normalizeEngagement` twitter branch, minimal `trend-ingest.env.example` comments |
| **Blocks** | **68-8** — live validation artifact needs operator runbook for X GO/NO-GO when cookies missing or stale |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.4 (FR-12..FR-14 integration delta); `addendum.md` §A1; **68-6 operator override** (cookie GraphQL, not `X_BEARER_TOKEN`) |
| **Out of scope** | Official X API v2 / `X_BEARER_TOKEN` / monthly 500k budget guard (obsolete under cookie auth); adapter core logic changes unless required for `--check`; `@steipete/sweet-cookie`; Python subprocess; `cns-dashboard` edits; vault WriteGate / `AI-Context/AGENTS.md`; Nexus inspector UI; blocking session-close step (optional future — not this story) |

### Operator binding override (supersedes PRD §4.4 budget-guard wording)

| PRD original (68-7 title) | CNS binding (68-6 override) |
|---------------------------|-----------------------------|
| Monthly API budget guard at 80% of 500k/month | **Out of scope** — cookie GraphQL has no Basic-tier quota telemetry |
| `X_BEARER_TOKEN` in env docs | **Out of scope** — canonical keys are **`X_AUTH_TOKEN`** + **`X_CT0`** |
| Integration-only delta on FR-12..FR-14 | **In scope:** credential health check, rotation runbook, session-expiry stderr, config-snippet + Operator Guide polish |

### Problem (current state after 68-6)

| Gap | Today |
|-----|--------|
| No `--check` on CNS fetch script | Vendored `bird-search.mjs --check` exists but is not wired into operator workflow; `fetch-x-signals.mjs` always runs full fetch |
| Minimal env docs | `trend-ingest.env.example` lists keys but no rotation steps, expiry symptoms, or probe command |
| No config-snippet X section | `config-snippet.md` documents arXiv/HN/GitHub/RSS/Bluesky tuning but **no X/Twitter block** |
| Session invalid = terse error | stdout `{"error":"X session invalid"}` with per-query stderr only — no operator-facing remediation line |
| Operator Guide gap | §15.11 lists `trend-ingest.env` generically; no X cookie extraction / rotation subsection |
| 68-8 readiness | Live validation needs documented NO-GO path when `--check` fails |

### Target deliverables (integration layer only)

```text
Operator runbook (Guide §15.11.x + config-snippet + env.example)
  ↓
fetch-x-signals.mjs --check  (config + optional live probe)
  ↓
Enhanced stderr on session expiry during normal fetch
  ↓
Tests (mocked probe — no live X in CI)
  ↓
68-8 can cite GO/NO-GO procedure
```

**Preserve:** Normal fetch stdout contract (`posts[]` / `error`, exit **0** always). `--check` is a **separate CLI mode** with its own stdout JSON and **non-zero exit** on failure (operator tooling — mirror `bird-search.mjs --check` / `nlm login --check` posture).

---

## Acceptance Criteria

### 1. `--check` credential health mode (AC: FR-14, operator ergonomics)

**Given** `fetch-x-signals.mjs` is invoked with `--check` (and no other fetch args)
**When** the script runs after `mergeTrendIngestEnv` + `applyXCredentialEnv`
**Then** stdout is a single JSON object (not `posts[]`):

```json
{
  "status": "ok",
  "message": "X session valid",
  "credentialsPresent": true,
  "liveProbe": true
}
```

**And** valid `status` enum: `ok` | `missing_credentials` | `disabled` | `session_invalid` | `probe_failed`
**And** exit codes:

| status | exit code |
|--------|-----------|
| `ok` | **0** |
| `missing_credentials` | **1** |
| `disabled` (`MORNING_DIGEST_X_ENABLED=0`) | **0** with `"message"` explaining X intentionally disabled |
| `session_invalid` | **1** |
| `probe_failed` (network/timeout with creds present) | **1** |

**And** export testable pure function `checkXSession(env, options?)` implementing the logic (options may inject mock `searchClient` for CI)
**And** when credentials present and X enabled, perform **one minimal live probe**: single GraphQL search with query `from:karpathy since:{today-1d}` and `count=1` (reuse vendored `SearchClient` — same as normal fetch)
**And** probe treats `isSessionInvalidError()` shapes as `session_invalid`
**And** **no secrets** in stdout (never echo cookie values)
**And** `--check` mode does **not** write to stderr except optional single-line diagnostic when `DEBUG_X_CHECK=1`

### 2. Session-expiry stderr warnings on normal fetch (AC: FR-14)

**Given** a normal fetch (no `--check`) where `runXFetch` returns `{ error: 'X session invalid' }` or hits `isSessionInvalidError` with zero prior successes
**When** the CLI main block writes stdout JSON
**Then** stderr includes **one** actionable line:

```text
[x-auth] X session cookies expired or invalid — update X_AUTH_TOKEN and X_CT0 in ~/.hermes/trend-ingest.env (Operator Guide §15.11.1)
```

**And** when partial posts returned after mid-run session invalid (68-6 review fix 2B), stderr adds:

```text
[x-auth] X session became invalid mid-run — partial results returned; rotate cookies before next digest
```

**And** stdout contract unchanged: still `{"error":"..."}` or `{"posts":[...]}`, exit **0**

### 3. Extended `trend-ingest.env.example` (AC: FR-12)

**Given** `scripts/trend-ingest.env.example`
**When** the X/Twitter block is updated
**Then** it documents:

- **Required for live X:** `X_AUTH_TOKEN`, `X_CT0` (browser session cookies — **not** Developer Portal bearer tokens)
- **How to obtain:** brief pointer to Operator Guide §15.11.1 (DevTools → Application → Cookies → `x.com`)
- **Rotation trigger:** digest shows `(source unavailable: X session invalid)` or `node …/fetch-x-signals.mjs --check` exits non-zero
- **Health check command:**

  ```bash
  node scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs --check
  ```

- **WSL note:** manual paste only — no `@steipete/sweet-cookie`
- All optional `MORNING_DIGEST_X_*` keys from 68-6 (unchanged defaults)
- Explicit **deprecated / ignored:** `# X_BEARER_TOKEN` — not used by CNS (comment only, no code change required)

### 4. `config-snippet.md` X/Twitter section (AC: integration)

**Given** `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
**When** operator reads morning-digest credential docs
**Then** a new **"X/Twitter session cookies (Story 68-7)"** section exists **after Product Hunt / before Bluesky** (matches Source 11 order)
**And** includes table of `X_AUTH_TOKEN`, `X_CT0`, and `MORNING_DIGEST_X_*` keys with defaults
**And** includes the `--check` command and link to Operator Guide §15.11.1
**And** states credentials load from `$HOME/.hermes/trend-ingest.env` with Epic 59 HOME remap in Hermes wrappers

### 5. Operator Guide §15.11.1 (AC: operator runbook)

**Given** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
**When** §15.11 is updated
**Then** new subsection **§15.11.1 X/Twitter session cookies (Epic 68)** covers:

1. Purpose — Source 11 in morning digest; cookie GraphQL via vendored bird-search
2. File — `~/.hermes/trend-ingest.env` (`chmod 600`)
3. Extract cookies — logged-in `x.com` → DevTools → Application → Cookies → copy `auth_token` → `X_AUTH_TOKEN`, `ct0` → `X_CT0`
4. Verify — `node …/fetch-x-signals.mjs --check` (or via repo path from Omnipotent.md root)
5. Symptom — Discord `(source unavailable: X session invalid)` or missing **X / Twitter** section content
6. Disable without delete — `MORNING_DIGEST_X_ENABLED=0`
7. Explicit non-goal — no X Developer Portal / Basic tier / `X_BEARER_TOKEN`

**And** changelog row added (patch version bump, e.g. **1.38.x**)
**And** §15.11 intro paragraph mentions X as optional Source 11 when cookies configured

### 6. SKILL.md troubleshooting (AC: integration polish)

**Given** `scripts/hermes-skill-examples/morning-digest/SKILL.md`
**When** operator troubleshooting section is read
**Then** a short **X / Twitter** bullet exists under credentials / source-unavailable guidance:
- Run `--check` before cron debugging
- Rotate cookies per §15.11.1
- Epic completable without X (Bluesky + other sources)

**And** no regression to existing Source 1–12 ordering text

### 7. Optional thin wrapper for `--check` (AC: ergonomics)

**Given** `scripts/session-close/hermes-run-x-check.sh` (new)
**When** invoked from repo root or Hermes `terminal(...)` 
**Then** it applies the same HOME isolation remap as `hermes-run-x.sh`
**And** runs `node …/fetch-x-signals.mjs --check`
**And** propagates exit code to caller (non-zero when check fails)
**And** documented in Operator Guide §15.11.1 and config-snippet

### 8. Tests + verify gate (AC: FR-12, FR-14)

**Given** implementation complete
**When** `npm test` runs
**Then** `tests/morning-digest-x-adapter.test.mjs` includes:
- `checkXSession` — missing credentials → `missing_credentials`, exit **1**
- `checkXSession` — mock probe success → `ok`
- `checkXSession` — mock probe 401/HTML interstitial → `session_invalid`
- `checkXSession` — disabled flag → `disabled`, exit **0**
- CLI `--check` integration via subprocess with env fixtures (mocked client injection if needed)
- stderr remediation line when main fetch returns session invalid (capture stderr)
**And** `tests/hermes-morning-digest-skill.test.mjs` asserts config-snippet contains `X_AUTH_TOKEN` and `--check`
**When** `bash scripts/verify.sh` runs
**Then** all tests green

---

## Tasks / Subtasks

- [x] **T1** Implement `checkXSession` + CLI `--check` branch (AC: 1)
  - [x] Export `checkXSession(env, options?)` from `fetch-x-signals.mjs`
  - [x] Parse `process.argv` for `--check` before normal fetch in main block
  - [x] Minimal live probe via injected or default `SearchClient`
  - [x] Separate exit-code policy from normal fetch (always exit 0)
- [x] **T2** Session-expiry stderr warnings (AC: 2)
  - [x] Add `warnXSessionExpiry(reason)` helper; call from main + `runXFetch` session-invalid paths
  - [x] Partial-run mid-invalid warning when `aggregated.length > 0`
- [x] **T3** Documentation pass (AC: 3, 4, 5, 6)
  - [x] Extend `scripts/trend-ingest.env.example`
  - [x] Add X section to `config-snippet.md`
  - [x] Add §15.11.1 to `CNS-Operator-Guide.md` + changelog
  - [x] Update `SKILL.md` troubleshooting bullet
- [x] **T4** `hermes-run-x-check.sh` (AC: 7)
  - [x] Mirror HOME remap from `hermes-run-x.sh`
- [x] **T5** Tests (AC: 8)
  - [x] Extend `morning-digest-x-adapter.test.mjs`
  - [x] Extend `hermes-morning-digest-skill.test.mjs`
- [x] **T6** Verify gate
  - [x] `npm test` + `bash scripts/verify.sh`
  - [x] Operator post-merge: `bash scripts/install-hermes-skill-morning-digest.sh`

### Review Findings

- [x] [Review][Patch] `checkXSession` uses `searchWithRetry` — adds 5s delay on HTML interstitial instead of single minimal probe [fetch-x-signals.mjs:436]
- [x] [Review][Patch] CLI `--check` tests spread `process.env` without clearing `TWITTER_AUTH_TOKEN` / `TWITTER_CT0` fallbacks — brittle in CI [tests/morning-digest-x-adapter.test.mjs:553]
- [x] [Review][Patch] Orphaned duplicate JSDoc block before `warnXSessionExpiry` [fetch-x-signals.mjs:350]
- [x] [Review][Patch] Operator Guide §15.11.1 says "Exit 1 → rotate cookies" without distinguishing transient `probe_failed` [CNS-Operator-Guide.md:62]
- [x] [Review][Patch] §15.11 section header omits Story 68-7 attribution [CNS-Operator-Guide.md:915]
- [x] [Review][Defer] Partial warning guard lacks `sawSuccess` check — dead branch given current loop [fetch-x-signals.mjs:623] — deferred, pre-existing structure
- [x] [Review][Defer] Double `applyXCredentialEnv` in `--check` path — idempotent today [fetch-x-signals.mjs:659] — deferred, pre-existing pattern
- [x] [Review][Defer] `isSessionInvalidError` treats JSON parse errors as session-invalid — pre-existing 68-6 [fetch-x-signals.mjs:489] — deferred, pre-existing
- [x] [Review][Defer] `hermes-run-x-check.sh` empty `OPERATOR_HOME` edge case — same as `hermes-run-x.sh` [hermes-run-x-check.sh:10] — deferred, pre-existing

---

## Dev Notes

### File paths (UPDATE vs NEW)

| Action | Path |
|--------|------|
| **Update** | `scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs` |
| **Create** | `scripts/session-close/hermes-run-x-check.sh` |
| **Update** | `scripts/trend-ingest.env.example` |
| **Update** | `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` |
| **Update** | `scripts/hermes-skill-examples/morning-digest/SKILL.md` |
| **Update** | `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` |
| **Update** | `tests/morning-digest-x-adapter.test.mjs` |
| **Update** | `tests/hermes-morning-digest-skill.test.mjs` |

Installed Hermes mirror updated via `bash scripts/install-hermes-skill-morning-digest.sh` (operator step — not CI).

### Current `fetch-x-signals.mjs` state (READ BEFORE EDIT)

**Main module today** (`521:536:scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs`):

- Loads env via `mergeTrendIngestEnv` + `applyXCredentialEnv`
- Always calls `runXFetch(merged)` → stdout JSON → **always `process.exit(0)`**
- No argv parsing

**Session invalid today** (`485:492:scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs`):

- Per-query `console.error` on search failure
- Returns `{ error: 'X session invalid' }` when no partial data
- Partial degrade (68-6 review 2B) when `aggregated.length > 0`

**This story adds:** `--check` branch **before** `runXFetch`; stderr remediation in main block when stdout error is session-related.

### `--check` implementation pattern (binding)

Mirror vendored CLI semantics (`vendor/bird-search/bird-search.mjs` lines 30–43) but add **live probe** for real session validation:

```javascript
/**
 * @returns {Promise<{ status: string, message: string, credentialsPresent: boolean, liveProbe: boolean }>}
 */
export async function checkXSession(env, options = {}) {
  const config = loadXConfig(env);
  if (!config.enabled) {
    return { status: 'disabled', message: 'X disabled via MORNING_DIGEST_X_ENABLED', credentialsPresent: false, liveProbe: false };
  }
  if (!config.authToken || !config.ct0) {
    return { status: 'missing_credentials', message: 'X credentials not configured', credentialsPresent: false, liveProbe: false };
  }
  // optional: inject options.searchClient for tests
  // one minimal probe query; map isSessionInvalidError → session_invalid
  return { status: 'ok', message: 'X session valid', credentialsPresent: true, liveProbe: true };
}
```

CLI:

```javascript
if (process.argv.includes('--check')) {
  const merged = await mergeTrendIngestEnv(process.env);
  applyXCredentialEnv(merged);
  const result = await checkXSession(merged, { searchClient: undefined });
  process.stdout.write(JSON.stringify(result) + '\n');
  const exitCode = result.status === 'ok' || result.status === 'disabled' ? 0 : 1;
  process.exit(exitCode);
}
```

**Do not** reuse `runXFetch` for `--check` — full multi-account search is too slow and noisy for health probes.

### Probe query constants

```javascript
const CHECK_PROBE_HANDLE = 'karpathy'; // stable public account; same ecosystem as DEFAULT_X_ACCOUNTS
```

Build query: `` `from:${CHECK_PROBE_HANDLE} since:${buildSinceDate(24)}` `` with `count=1`, `FETCH_TIMEOUT_MS` (15s from 68-6).

### Stderr warning helper (binding)

```javascript
const X_AUTH_REMEDIATION =
  '[x-auth] X session cookies expired or invalid — update X_AUTH_TOKEN and X_CT0 in ~/.hermes/trend-ingest.env (Operator Guide §15.11.1)';

function warnXSessionExpiry(kind /* 'total' | 'partial' */) {
  if (kind === 'partial') {
    console.error('[x-auth] X session became invalid mid-run — partial results returned; rotate cookies before next digest');
    return;
  }
  console.error(X_AUTH_REMEDIATION);
}
```

Call from main when `payload.error` matches `/session invalid|credentials not configured/i` (map `credentials not configured` to a distinct stderr hint: "configure X_AUTH_TOKEN and X_CT0").

### `hermes-run-x-check.sh` skeleton

Copy `hermes-run-x.sh` HOME remap block; replace exec target:

```bash
exec node "$REPO_ROOT/scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs" --check
```

Propagate exit code — **do not** force exit 0.

### Operator Guide edit constraints

- Path: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — **not** WriteGate (`AI-Context/` only)
- Add §15.11.1; bump doc version in frontmatter/changelog table
- Cross-link §16.5 for shared `trend-ingest.env` file (same file holds NewsAPI + X cookies)

### config-snippet gap (must fix)

`config-snippet.md` currently jumps from RSS env block to NotebookLM title map — **no X keys**. Add section between RSS and NotebookLM (or after Product Hunt if PH section exists elsewhere in file).

Suggested table rows:

| Key | Purpose | Default |
|-----|---------|---------|
| `X_AUTH_TOKEN` | `auth_token` cookie | _(required for live X)_ |
| `X_CT0` | `ct0` cookie | _(required for live X)_ |
| `MORNING_DIGEST_X_ENABLED` | Kill switch | `1` |
| `MORNING_DIGEST_X_ACCOUNTS` | Curated handles | 5 defaults (68-6 review 1D) |
| `MORNING_DIGEST_X_MAX_TWEETS` | Per-run cap | `20` (hard 50) |
| `MORNING_DIGEST_X_LOOKBACK_HOURS` | `since:` window | `24` |

### What must be preserved

- **68-6 adapter contract** — normal fetch stdout `posts[]`, exit 0 on all failure shapes
- **68-5 Bluesky** — do not reorder sources or regress gate 9–10–11–12
- **68-1 dedup** — no changes
- **ADR-E67-001** — Node-only; no Python
- **Epic 59 HOME remap** — both `hermes-run-x.sh` and new check wrapper
- **No `@steipete/sweet-cookie`**

### Anti-patterns (do not)

- Do not implement `X_BEARER_TOKEN` or monthly API budget counter / stderr quota warnings
- Do not add session-close blocking step that fails `/session-close` when X check fails (non-blocking digest source only)
- Do not change Convex validators (68-4)
- Do not subprocess `bird-search.mjs --check` — implement in `fetch-x-signals.mjs` so env loading stays consistent (`mergeTrendIngestEnv`, `X_*` alias mapping)
- Do not print cookie values in stdout/stderr/logs
- Do not make `--check` exit 0 on `session_invalid` (operator must see failure)

### Previous story intelligence (68-6)

- **Cookie auth binding** — `X_AUTH_TOKEN` + `X_CT0`; vendored bird-search; `BIRD_DISABLE_BROWSER_COOKIES=1`
- **Deferred explicitly to 68-7** — extended env docs, health check, rotation runbook (AC 11 minimal docs only in 68-6)
- **Review fixes to respect** — partial post degrade on mid-run auth fail; `isSessionInvalidError()` for HTML/login interstitial; 5 default accounts + 15s timeout
- **Known vendor gap** — `quoteCount` often 0 from bird-search; do not scope-creep vendor patch here
- **Post-merge** — `bash scripts/install-hermes-skill-morning-digest.sh`

### Git intelligence

- `02d0d4f` — Epic 68-6 X adapter (predecessor baseline)
- `316e36c` — Bluesky adapter pattern for config-snippet / env.example structure
- `6c18ea9` — Epic 68-1 dedup (twitter priority already wired)

### 68-8 handoff

After 68-7, validation story should run:

```bash
node scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs --check
```

Record in `68-8-live-digest-validation.md`:

- `--check` exit 0 → X GO (expect ≥1 `twitter` signal in live digest)
- `--check` exit 1 → X NO-GO (waived twitter rows in addendum A6 checklist)

### Testing fixtures

Mock `searchClient.search` to return:

- `{ success: true, tweets: [fixtureTweet] }` → `ok`
- `{ success: false, error: '401 Unauthorized' }` → `session_invalid`
- Missing env → `missing_credentials` without network

**No live X GraphQL in CI.**

Optional operator smoke (not CI): run `--check` with real cookies in `~/.hermes/trend-ingest.env`.

### Project Structure Notes

- Health-check pattern reference: `scripts/session-close/lib/nlm-auth-watchdog.mjs` (session-close watchdog — **pattern only**, do not wire X into session-close in this story)
- Vendored `--check` reference: `vendor/bird-search/bird-search.mjs` (config-only check — CNS goes further with live probe)
- Verify gate: `bash scripts/verify.sh`

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.4, §6.2 — FR-12..FR-14 integration delta]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A1]
- [Source: `_bmad-output/implementation-artifacts/68-6-x-twitter-adapter-source-11.md` — predecessor; 68-7 handoff §]
- [Source: `_bmad-output/implementation-artifacts/68-5-bluesky-adapter-source-12.md` — config-snippet / env.example mirror]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/vendor/bird-search/bird-search.mjs` — `--check` reference]
- [Source: `scripts/session-close/lib/nlm-auth-watchdog.mjs` — health-check UX pattern]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.11, §16.5]
- [Source: `docs/ADR-E67-001-last30days-codebook-only.md`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

### Completion Notes List

- Implemented `checkXSession` with live probe (`from:karpathy since:{24h}`), `getCheckExitCode`, and CLI `--check` branch (exit 0 for `ok`/`disabled`, exit 1 otherwise).
- Added `warnXSessionExpiry`, `emitXFetchStderr` for actionable `[x-auth]` stderr on session expiry and missing credentials; partial mid-run warning in `runXFetch`.
- Created `hermes-run-x-check.sh` with Epic 59 HOME remap; documented in config-snippet and Operator Guide §15.11.1.
- Extended `trend-ingest.env.example`, `config-snippet.md`, `SKILL.md`, and Operator Guide (v1.38.1 changelog).
- Tests: `checkXSession` unit cases, CLI `--check` subprocess, stderr helpers, config-snippet assertions.
- `bash scripts/verify.sh` passed (642 tests); Hermes skill installed via `install-hermes-skill-morning-digest.sh`.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs` (updated)
- `scripts/session-close/hermes-run-x-check.sh` (created)
- `scripts/trend-ingest.env.example` (updated)
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` (updated)
- `scripts/hermes-skill-examples/morning-digest/SKILL.md` (updated)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (updated)
- `tests/morning-digest-x-adapter.test.mjs` (updated)
- `tests/hermes-morning-digest-skill.test.mjs` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)

### Change Log

- 2026-06-11: Story 68-7 — X `--check` health probe, session-expiry stderr, env docs, Operator Guide §15.11.1, `hermes-run-x-check.sh`, tests.

---

## Story Completion Status

- **Status:** done
- **Completion note:** All ACs satisfied; code review patches applied; verify gate green
