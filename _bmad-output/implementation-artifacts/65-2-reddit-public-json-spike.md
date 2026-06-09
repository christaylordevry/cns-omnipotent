---
story_id: 65-2
epic: 65
title: reddit-public-json-spike
status: done
baseline_commit: 4a7fd2f
operator_brief: 2026-06-09
predecessors: 64-5, 64-8
blocks: 65-3
parallel: 65-1
---

# Story 65.2: Reddit public-JSON spike (risk gate)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS developer implementing Epic 65 Reddit ingest**,
I want **a spike script that simulates unattended cron fetches against Reddit public-JSON endpoints and documents a GO/NO-GO outcome**,
so that **story 65-3 can branch confidently between public-JSON and credential-fallback adapters without guessing rate-limit or block behavior under scheduled use**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 65: Native Source Adapter Expansion v1 — **65-2 is the risk gate** (mirror 64-1); blocks **65-3 only** |
| **Repo** | **Omnipotent.md only** — no `cns-dashboard` schema touch; no Convex push of Reddit rows |
| **Predecessors** | Epic 64 scoring live (64-5, 64-8); **65-1** may run in parallel (in review) — spike has **no schema dependency** |
| **Blocks** | **65-3** (Reddit production adapter) — `/bmad-create-story 65-3` forbidden until 65-2 is `done` with documented GO/NO-GO |
| **Normative spec** | `architecture-epic-65-native-source-adapters.md` §4.1, §6.2, ADR-E65-003, ADR-E65-004, ADR-E65-005; `prd-epic-65-native-source-adapters.md` §4.3 (FR-5, FR-6), UJ-3 |
| **FR IDs** | FR-5 (spike script + unattended simulation), FR-6 (GO/NO-GO gate), FR-16 (last30days runtime policy) |
| **Out of scope** | Production `fetch-reddit-signals.mjs` (65-3); `hermes-run-reddit.sh` (65-3); task-prompt Source 8 terminal step (65-3); Convex schema changes; `DIGEST_PUSH_JSON` Reddit rows; OAuth/credential fetch (65-3 fallback branch); Epic 44 `trend-ingest.py` Reddit collector unification; scoring formula or prior changes |

### Problem (current state)

Reddit ingest for morning-digest is **unvalidated** for unattended cron. Public `.json` endpoints may return 429/403, HTML block pages, or empty listings — operational risk is high enough that Epic 65 mandates a **spike-before-adapter** gate (ADR-E65-003), structurally equivalent to 64-1 gating the scoring chain.

No `spike-reddit-public-json.mjs` exists. `task-prompt.md` documents Reddit mapping rows as **future (65-3)** with no terminal invocation. `normalizeEngagement` reddit branch and schema literals for `reddit` are already prepared (65-1 / 64-4) but **no production Reddit stdout → digestSignal path** may ship until 65-3.

### Operator brief (binding)

1. **65-2 is the gate, not the adapter** — deliver spike script + fixture tests + GO/NO-GO artifact; zero production ingest code.
2. **Parallel with 65-1** — may start while 65-1 is in review; no dependency on schema literals landing.
3. **Live spike is operator-facing** — CI uses fixtures only; dev completes story by running spike against real subreddits once and recording outcome in **Completion Notes** (see AC 5).
4. **65-3 author must cite spike outcome** — PASS → public-JSON branch; FAIL → credential fallback only; PARTIAL → operator decision + documented mitigation.
5. **last30days is read-only codebook** — study Reddit fetch patterns at `~/ai-factory/projects/last30days-skill-reference` if present; never import or subprocess.

## Acceptance Criteria

### 1. Spike script and config (AC: FR-5, ADR-E65-001)

**Given** `spike-reddit-public-json.mjs` under morning-digest scripts
**When** invoked via `node spike-reddit-public-json.mjs`
**Then** config loads from merged `~/.hermes/trend-ingest.env` via `mergeTrendIngestEnv()` + `resolveOperatorHome()` (import from `fetch-arxiv-rss.mjs`)
**And** reads env vars:

| Env var | Default | Purpose |
|---------|---------|---------|
| `MORNING_DIGEST_REDDIT_SUBREDDITS` | — (required) | Comma-separated subreddit names **without** `r/` prefix |
| `MORNING_DIGEST_REDDIT_SPIKE_CYCLES` | `3` | Minimum consecutive fetch cycles |
| `MORNING_DIGEST_REDDIT_SPIKE_DELAY_MS` | `180000` | Delay between cycles (3 min — cron-realistic) |

**And** each cycle fetches public-JSON endpoint per architecture §6.2:

```
GET https://www.reddit.com/r/{subreddit}/hot.json?limit=10&raw_json=1
```

**And** headers include `User-Agent: CNS-morning-digest/1.0` (Reddit requires descriptive UA)
**And** HTTP timeout is **15s** per request (`FETCH_TIMEOUT_MS = 15_000`)
**And** cycles iterate subreddits round-robin (cycle 1 → first subreddit, cycle 2 → second or wrap)
**And** script performs **no OAuth**, no credentials, no `last30days` import/subprocess
**And** on any failure path stdout is valid JSON and **exit code is 0** (mirror HN/GitHub adapters)

### 2. Spike stdout artifact shape (AC: FR-5)

**Given** spike completes one or more cycles
**When** stdout is emitted
**Then** root object matches architecture §6.2:

```json
{
  "cycles": [
    {
      "cycle": 1,
      "subreddit": "MachineLearning",
      "httpStatus": 200,
      "latencyMs": 842,
      "parseOk": true,
      "postCount": 10,
      "blockIndicator": null
    }
  ],
  "summary": {
    "totalCycles": 3,
    "parseSuccessRate": 1.0,
    "p95LatencyMs": 1200,
    "sustainedBlock": false
  },
  "goNoGo": "PASS"
}
```

**And** each cycle records: `cycle` (1-based), `subreddit`, `httpStatus`, `latencyMs`, `parseOk`, `postCount`, `blockIndicator`
**And** `parseOk` is `true` only when body is JSON with `data.children` array containing ≥1 child with parseable `data.title`
**And** `blockIndicator` is `null` on success; otherwise short string: `http-429`, `http-403`, `html-response`, `captcha-marker`, `empty-listing`, `parse-error`, etc.
**And** `summary.parseSuccessRate` = fraction of cycles where `parseOk === true`
**And** `summary.p95LatencyMs` = 95th percentile of `latencyMs` across cycles (integer ms)
**And** `summary.sustainedBlock` = `true` when ≥2 consecutive cycles show `http-429` or `http-403` block indicators

**And** exports `runRedditSpike(env, options)` with injectable `fetch`, `fixtureJsonByCycle`, and `delayMs` override (0 in tests) — mirror `runGithubFetch` pattern

### 3. GO/NO-GO evaluation (AC: FR-6)

**Given** spike `summary` and `cycles[]`
**When** `evaluateGoNoGo(summary, cycles)` runs (exported pure function)
**Then** outcome follows PRD FR-6 / architecture §6.2:

| Outcome | Criteria | 65-3 branch |
|---------|----------|-------------|
| **PASS** | `parseSuccessRate >= 0.8` AND no `sustainedBlock` AND `p95LatencyMs < 15000` AND ≥80% of successful parses have `postCount >= 1` | Public-JSON adapter |
| **FAIL** | `sustainedBlock === true` OR `parseSuccessRate < 0.5` OR majority of failures are `html-response`/`captcha-marker`/`parse-error` | Credential fallback only |
| **PARTIAL** | Otherwise | Operator decision; 65-3 must document mitigation |

**And** stdout includes top-level `"goNoGo": "PASS" | "FAIL" | "PARTIAL"`
**And** spike alone does **not** enable Reddit rows in `DIGEST_PUSH_JSON` — production ingest remains 65-3

### 4. Fixture tests and verify gate (AC: FR-5, FR-16)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs from Omnipotent.md
**Then** all tests pass including new `tests/morning-digest-reddit-spike.test.mjs` covering:
  - `parseSubreddits` — comma split, trim, reject empty
  - `parseRedditListing` — fixture `data.children[].data` → `postCount`, `parseOk`
  - `detectBlockIndicator` — 429/403 status, HTML body prefix, captcha markers
  - `computeSpikeSummary` — parseSuccessRate, p95LatencyMs, sustainedBlock
  - `evaluateGoNoGo` — PASS/FAIL/PARTIAL boundary fixtures
  - `runRedditSpike` — mocked fetch across 3 cycles, `delayMs: 0`, no live network
  - CLI main path — missing subreddits → `{ error: "missing-subreddits" }`, exit 0
**And** **no** changes to `cns-dashboard` (verify may still run sibling tests — must remain green)
**And** **no** `bash scripts/install-hermes-skill-morning-digest.sh` required — spike is **not** wired into Hermes morning-digest Sources (65-3 adds wrapper + task-prompt)
**And** existing morning-digest tests remain green (no regressions)

### 5. Live spike artifact (AC: FR-6, operator gate)

**Given** fixture tests green
**When** operator (or dev with network) runs spike once against real subreddits
**Then** Completion Notes in this story file record:
  - Date/time of live run
  - `MORNING_DIGEST_REDDIT_SUBREDDITS` value used (e.g. `MachineLearning,LocalLLaMA,artificial`)
  - Pasted or summarized `summary` + `goNoGo` from stdout
  - **Explicit branch instruction for 65-3 author** (one sentence: which adapter branch to implement)
**And** if live run yields **PARTIAL**, operator decision is recorded (proceed public-JSON with backoff, reduced subreddit set, or credential path)

**Fast dev run (optional):** `MORNING_DIGEST_REDDIT_SPIKE_DELAY_MS=5000` for shorter wall-clock; production gate assessment should use default 180000 ms when operator validates cron realism.

### 6. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** `fetch-reddit-signals.mjs`
**And** no `scripts/session-close/hermes-run-reddit.sh`
**And** no task-prompt Source 8 terminal invocation
**And** no changes to `score-digest-signals.mjs`, `push-digest-convex.mjs`, or `pick-signal-notebook.mjs`
**And** no npm packages added (built-in `fetch` only)
**And** no shared Reddit module with Epic 44 trend-ingest (ADR-E65-004)

## Tasks / Subtasks

- [x] **T1** `spike-reddit-public-json.mjs` — core spike module (AC: 1, 2, 3)
  - [x] `loadSpikeConfig`, `parseSubreddits`, `fetchRedditHotJson`, `parseRedditListing`, `detectBlockIndicator`
  - [x] `runRedditSpike` with cycle loop, configurable `delayMs`, injectable `fetch` + `fixtureJsonByCycle`
  - [x] `computeSpikeSummary`, `evaluateGoNoGo`
  - [x] Main: `mergeTrendIngestEnv` → stdout JSON with `cycles`, `summary`, `goNoGo` → exit 0 on all paths
- [x] **T2** `tests/morning-digest-reddit-spike.test.mjs` (AC: 4)
  - [x] Unit tests for parse, block detection, summary, GO/NO-GO
  - [x] Integration: 3-cycle mocked spike with mixed success/failure fixtures
  - [x] CLI smoke: missing-subreddits error path
- [x] **T3** Live spike + artifact (AC: 5)
  - [x] Run spike against ≥2 real subreddits; record GO/NO-GO in Completion Notes
  - [x] Document 65-3 branch instruction for next story author
- [x] **T4** Verify gate (AC: 4)
  - [x] `bash scripts/verify.sh` green

### Review Findings

- [x] [Review][Patch] `captcha-marker` false positive on valid JSON listings — `detectBlockIndicator` scans raw body for `captcha`/`blocked` before checking `parsed.parseOk`, so legitimate post titles/selftext can force FAIL/PARTIAL [spike-reddit-public-json.mjs:88-90]
- [x] [Review][Patch] No test asserts Reddit hot.json URL or User-Agent header — AC 1 fetch contract untested; add mock-fetch test for `buildRedditHotUrl` / `fetchRedditHotJson` [morning-digest-reddit-spike.test.mjs]
- [x] [Review][Patch] `MORNING_DIGEST_REDDIT_SPIKE_CYCLES` accepts values below 3 — PRD FR-5 requires minimum three consecutive cycles; clamp with `Math.max(3, rawCycles)` [spike-reddit-public-json.mjs:33-36]
- [x] [Review][Defer] Network/timeout failures labeled `parse-error` — spec allows indicator; distinct `timeout`/`network-error` would aid ops but not required [spike-reddit-public-json.mjs:254-262] — deferred, pre-existing spec ambiguity
- [x] [Review][Defer] No upper bound on spike cycles or inter-cycle delay — mis-set env could run unbounded; operator config responsibility for gate script [spike-reddit-public-json.mjs:33-38] — deferred, pre-existing

## Dev Notes

### Gate role (critical — ADR-E65-003)

65-2 is **not** a feature story. It is the Epic 65 equivalent of 64-1: a prerequisite that prevents expensive wrong-path work downstream.

```
65-2 (Reddit spike) ──blocks──▶ 65-3 (Reddit adapter)
65-2 ──parallel──▶ 65-1 (schema + GitHub) — no dependency
```

**Do not** start 65-3 implementation or story authoring until 65-2 is `done` with documented `goNoGo`.

### Architecture compliance

| ADR | Requirement for 65-2 |
|-----|----------------------|
| **ADR-E65-001** | Native Node `.mjs`; always exit 0; `mergeTrendIngestEnv`; 15s timeout; `CNS-morning-digest/1.0` UA |
| **ADR-E65-003** | Spike gates 65-3; no production Reddit in digest push |
| **ADR-E65-004** | No shared module with Epic 44 trend-ingest Reddit |
| **ADR-E65-005** | last30days reference only — MIT attribution comment if fetch logic derived from reference clone |
| **ADR-E64-005** | Same runtime policy extends to Epic 65 |

### Adapter reference pattern (mirror 65-1 / HN)

Study `fetch-github-signals.mjs` and `fetch-hn-rss.mjs`:

```167:228:scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs
export async function runGithubFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  // ...
}
// main: mergeTrendIngestEnv → JSON stdout → process.exit(0)
```

Spike differences:
- stdout root is `cycles[]` + `summary` + `goNoGo` — **not** `posts[]`
- multi-cycle loop with `setTimeout` / `delayMs` between fetches
- no feature-flag disable pattern required (spike is explicitly invoked; missing subreddits → error object)

### Reddit public-JSON parse contract (spike validation only)

Reddit listing response shape (simplified):

```json
{
  "data": {
    "children": [
      {
        "data": {
          "title": "Example post",
          "score": 42,
          "num_comments": 7,
          "permalink": "/r/MachineLearning/comments/abc/example/"
        }
      }
    ]
  }
}
```

**Spike `parseOk` criteria:** valid JSON + `data.children` is array + at least one child has non-empty `data.title`.

**65-3 mapping preview** (do not implement in 65-2): `data.score` → `upvotes`; `data.num_comments` → `commentCount`; permalink → absolute URL. See architecture §5.3.

### Block detection heuristics

| Signal | `blockIndicator` |
|--------|------------------|
| HTTP 429 | `http-429` |
| HTTP 403 | `http-403` |
| Body starts with `<!DOCTYPE` or `<html` | `html-response` |
| Body contains `captcha` or `blocked` (case-insensitive) | `captcha-marker` |
| JSON parses but `children` empty | `empty-listing` |
| JSON parse throw | `parse-error` |

Set `summary.sustainedBlock` when two+ consecutive cycles return `http-429` or `http-403`.

### GO/NO-GO worked examples (for tests)

| cycles | parseSuccessRate | p95LatencyMs | sustainedBlock | Expected `goNoGo` |
|--------|------------------|--------------|----------------|-------------------|
| 3/3 parseOk, latency 800–1200ms | 1.0 | 1200 | false | PASS |
| 1/3 parseOk, rest 429 | 0.33 | 500 | true | FAIL |
| 2/3 parseOk, one 403 | 0.67 | 900 | false | PARTIAL |
| 3/3 parseOk, p95 16000ms | 1.0 | 16000 | false | PARTIAL (latency gate) |

### Epic 44 boundary (do not cross)

Epic 44 Reddit (`44-3-2`) lives in `trend-ingest.py` — separate Convex tables, separate config. Morning-digest spike **must not** import or call trend-ingest collectors. Duplicate fetch logic in v1 is acceptable per ADR-E65-004.

### last30days study protocol

If reference clone exists at `~/ai-factory/projects/last30days-skill-reference`:
1. Search for Reddit `.json` fetch patterns (public hot listing).
2. Translate URL construction and UA conventions to Node — do not copy Python imports.
3. Add file-level comment: `// Reddit public-JSON pattern informed by last30days reference (MIT) — no runtime dependency`

If clone absent, implement from architecture §6.2 only.

### Testing standards

- **CI:** 100% fixture/mocked — zero live Reddit calls in `npm test`
- **File:** `tests/morning-digest-reddit-spike.test.mjs` per architecture §10
- **Pattern:** import exported functions from spike module; use `node:test` + `assert/strict` (match `morning-digest-github-adapter.test.mjs`)
- **Verify:** `bash scripts/verify.sh` mandatory before story `done`

### WriteGate / vault / security

- **No WriteGate** — story does not touch `AI-Context/AGENTS.md` or vault paths
- **No `security.md` changes**
- **No new npm packages** — built-in `fetch` only (security policy: no packages <14 days old)
- **No API keys in repo** — spike uses public JSON only

### Project structure

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs` | **NEW** |
| `tests/morning-digest-reddit-spike.test.mjs` | **NEW** |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | **NO CHANGE** (Source 8 lands in 65-3) |
| `cns-dashboard/**` | **NO CHANGE** |

### Previous story intelligence (65-1 parallel)

65-1 (in review) established:
- GitHub adapter pattern: `run*Fetch`, fixture injection, exit 0, `mergeTrendIngestEnv`
- Schema literals `github`/`reddit`/`rss` in cns-dashboard — spike does not depend on these
- `SOURCE_PRIOR` / `TREND_PROXY_PRIOR` extended for reddit — spike does not touch scoring
- Anti-drift: 65-1 explicitly excluded `spike-reddit-public-json.mjs` — **that exclusion ends here; 65-2 owns the spike**

### Git intelligence

Recent Epic 65 commit is planning-only (`4a7fd2f chore(epic-65): PRD and architecture`). Adapter implementation pattern is established in working tree from 65-1 (`fetch-github-signals.mjs`, `morning-digest-github-adapter.test.mjs`) — mirror exports and test structure.

### Latest technical specifics

- **Reddit public JSON:** Unauthenticated `https://www.reddit.com/r/{sub}/hot.json?limit=10&raw_json=1` — no OAuth for spike
- **User-Agent:** Reddit blocks generic/missing UA; use `CNS-morning-digest/1.0` consistently
- **Rate limits:** Public JSON is best-effort; spike purpose is to **measure** not **solve** — backoff/retry belongs in 65-3 if PASS
- **Node fetch:** Use `AbortSignal.timeout(15_000)` (same as GitHub/HN adapters)
- **Context7:** Not required — no new library; built-in `fetch` only

### Deferred work cross-check

No items in `deferred-work.md` block 65-2. Epic 38-2 run-chain remains dormant — irrelevant to spike.

## References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md` §4.1, §6.2, §8, §9, §10, ADR-E65-003/004/005]
- [Source: `_bmad-output/planning-artifacts/prd-epic-65-native-source-adapters.md` §4.3, UJ-3, FR-5, FR-6, FR-16]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/addendum.md` — spike gate table, env vars]
- [Source: `_bmad-output/implementation-artifacts/65-1-digest-source-types-github-adapter.md` — adapter pattern, parallel track note]
- [Source: `_bmad-output/implementation-artifacts/64-1-digest-signals-schema-extension.md` — gate pattern reference]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs` — `run*Fetch` + main module pattern]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` — exit 0 + mergeTrendIngestEnv]
- [Source: `project-context.md` — last30days codebook policy, verify gate]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — N/A for spike (no vault IO)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor subagent)

### Debug Log References

- Fixture suite: `node --test tests/morning-digest-reddit-spike.test.mjs` — 22/22 pass
- Hermes install gate required `bash scripts/install-hermes-skill-morning-digest.sh` to sync new spike script parity (no task-prompt/cron wiring)

### Completion Notes List

**Live spike artifact (2026-06-08 23:58 UTC)**

- **Run date:** 2026-06-08 23:58:37 UTC
- **Subreddits:** `MachineLearning,LocalLLaMA,artificial`
- **Env:** `MORNING_DIGEST_REDDIT_SPIKE_DELAY_MS=5000` (fast dev iteration; 3 cycles, ~12s wall-clock)
- **summary:** `{ "totalCycles": 3, "parseSuccessRate": 0, "p95LatencyMs": 905, "sustainedBlock": true }`
- **goNoGo:** `FAIL`
- **Cycle detail:** All 3 cycles returned HTTP 403 (`http-403`) — MachineLearning (587ms), LocalLLaMA (324ms), artificial (905ms); zero parseable listings
- **65-3 branch instruction:** Implement **credential fallback only** (OAuth/app-token Reddit API per architecture §6.3 Branch B); do **not** ship public-JSON adapter as primary path from this environment/profile.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs` (NEW)
- `tests/morning-digest-reddit-spike.test.mjs` (NEW)

### Change Log

- 2026-06-09: Story 65-2 — Reddit public-JSON spike script, fixture tests, live spike FAIL artifact (403 sustained block), verify gate green
