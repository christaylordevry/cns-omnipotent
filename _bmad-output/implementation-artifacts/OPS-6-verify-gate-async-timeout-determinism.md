---
story_id: OPS-6
epic: ops-observability
title: verify-gate-async-timeout-determinism
status: done
created: 2026-07-23
design_gate: APPROVED_2026-07-23_H1_FIX_B
baseline_commit: 8d95632
incident: 2026-07-23 verify.sh non-determinism — 1549 pass vs 1540 pass / 9 cancelled (fail 0 both)
predecessors: OPS-1, 73-4, 73-7
do_not_touch: dedupe-digest-signals.mjs, score-digest-signals.mjs, anything from 90-5
---

# Story OPS-6: Make the verify gate deterministic (73-4 / 73-7 async-timeout flakes)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

Epic: **ops-observability** (reopened — gate honesty / refuse non-deterministic green)  
Tracked in sprint-status as: **`OPS-6-verify-gate-async-timeout-determinism`**  
**NOT Epic 90** — epic 90 is closed/pushed; baseline `8d95632` (90-5 landed).  
**Depends on:** nothing unshipped  
**Theme:** same fail-loud class as OPS-1 — a gate that randomly cancels cannot enforce "verify before every commit."

---

## Story

As the **CNS operator**,
I want **`bash scripts/verify.sh` to return the same result on the same tree every time**,
so that **the project's non-negotiable verify gate is enforceable and a red run means a real regression — not an AbortSignal timer race in two timeout-unit tests**.

---

## Design gate — APPROVED 2026-07-23 (H1 + fix B)

Operator approved **H1** and **fix B**. Implementation may proceed.

### Why B over A (binding)

| Fix | What it does | Risk |
|-----|--------------|------|
| **A** | Inject a pre-made controllable `AbortSignal` | **No longer exercises `timeoutMs → AbortSignal.timeout` plumbing.** If that path regresses, A stays green while a hung push never aborts — the exact defect the test is named for. |
| **B** | Keep `timeoutMs: 5` + real `AbortSignal.timeout`; add keepalive + `signal.aborted` pre-check on the mock | Real timer stays in the path; deterministic because keepalive holds the loop open until abort fires. |

**Do not reopen A** without operator approval. B is the approved fix.

### Independent confirmation (Opus, Node v22.23.1) — evidence

- **Isolated repro:** with the ONLY pending work being the unsafe mock + `AbortSignal.timeout(50)`, `beforeExit` fires at 0ms with the promise PENDING and exit code 0. The timeout timer is unref'd, so with nothing else holding the loop the abort never runs. This is verbatim the test-runner's `"Promise resolution is still pending but the event loop has already resolved"`.
- **Pre-aborted hazard is REAL:** a mock that only does `addEventListener('abort')` against an already-aborted signal NEVER settles. The `signal.aborted` pre-check is **mandatory**, not optional.
- **Production is sound:** `globalThis.AbortSignal.timeout` is passed to native `fetch`, which holds a ref'd socket handle, so the loop stays alive and the abort fires. **H2 refuted for the cron path.**

---

## Design gate — historical (diagnose-then-stop)

> ~~DIAGNOSE-THEN-STOP.~~ Gate cleared 2026-07-23 — see APPROVED block above.

---

## Incident (proven non-determinism)

**Same commit, opposite outcomes — 2026-07-23:**

| Run | Exit | Pass | Fail | Cancelled | Banner |
|-----|------|------|------|-----------|--------|
| A | 0 | 1549 | 0 | 0 | VERIFY PASSED |
| B | 1 | 1540 | 0 | 9 | TESTS failed |

**`fail 0` in both.** Red is entirely cancellations (`failureType: cancelledByParent`).

**Triggers (traced — do not re-derive):**

| ID | File:line | Test |
|----|-----------|------|
| A | `tests/analyze-entity-intelligence.test.mjs:388` | `pushDigestToConvex aborts a hung in-process push at the configured timeout` (Story 73-4) |
| B | `tests/render-digest-entity-section.test.mjs:250` | `fetchEntityIntelligence aborts a stalled query at its configured timeout` (Story 73-7) |

**Isolation (reproduced 2026-07-23, this session — consistent cancel):**

```
node --test tests/analyze-entity-intelligence.test.mjs
# tests 18 / pass 10 / fail 0 / cancelled 8

node --test --test-name-pattern='aborts a hung' tests/analyze-entity-intelligence.test.mjs
# cancelled — duration ~8ms (< timeoutMs: 5 abort window) with
# "Promise resolution is still pending but the event loop has already resolved"
```

**Shared test pattern:**

```js
timeoutMs: 5,
fetchFn: async (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  }),
```

Production constants: `DIGEST_PUSH_TIMEOUT_MS = 45_000`, `DIGEST_ENTITY_FETCH_TIMEOUT_MS = 10_000`. The `5` is test-only.

---

## Root-cause verdict (binding)

### Verdict: **H1 — TEST-ONLY timing / event-loop artifact**

**Evidence grade: HIGH**

Production abort paths in `pushDigestToConvex` / `fetchEntityIntelligence` **do guarantee settlement** when using `globalThis.fetch` (cron path). The flake is the test mock waiting solely on an **unref'd** `AbortSignal.timeout` timer with **no ref'd handle** keeping Node's event loop alive.

### Why not H2

H2 would require: returned promise can remain unsettled after the timeout when a remote hangs under production `fetch`. Proven false for native fetch (see settlement matrix). A hung Convex TCP connection still leaves an active network handle → event loop stays alive → unref'd timeout still fires → fetch rejects with `TimeoutError` → both wrappers settle (`pushDigestToConvex` → `formatPushResult({ status: 'failed' })`; `fetchEntityIntelligence` throws → `enrichPayloadWithEntityDigest` catches).

### Mechanism (Node v22.23.1 — normative)

From Node `lib/internal/abort_controller.js` (`setWeakAbortSignalTimeout`):

```js
// … we don't want the timer to keep the Node.js process open on it's own …
timeout.unref();
```

`AbortSignal.timeout(ms)` **intentionally unrefs** its timer. Abort only runs if something else keeps the loop alive (e.g. an in-flight `fetch` socket).

| Situation | Event loop keepalive? | Outcome |
|-----------|----------------------|---------|
| Production `fetch` + `AbortSignal.timeout` | Yes — network handle | Abort fires → fetch rejects → wrapper settles |
| Test mock: Promise + `addEventListener('abort')` only | **No** | Loop drains → test runner cancels (`cancelledByParent`) **before** abort |
| Same mock under full suite load | Sometimes — other tests' I/O/timers | Abort may fire in time → **flake green** |
| Mock + `setInterval` keepalive (or aborted-check + ref'd timer) | Yes | Settles deterministically |

**Secondary race (also test-only):** if abort fires *before* `addEventListener` (already-aborted signal), the listener never runs and the Promise hangs forever. Spec: late `abort` listeners are **not** invoked for already-aborted signals. Native `fetch` checks `signal.aborted` at start and rejects immediately. Proven:

| Mock | Pre-aborted signal | Settles? |
|------|--------------------|----------|
| Unsafe (`addEventListener` only) | yes | **NO** — PENDING |
| Safe (`if (signal.aborted) reject` first) | yes | **YES** — TimeoutError |
| Native `fetch` | yes | **YES** — TimeoutError |

### Flake shape explained

1. Timeout test starts `AbortSignal.timeout(5)` + hung mock with no keepalive.
2. If the event loop drains (isolation, or unlucky scheduling): runner emits `cancelledByParent` / "Promise resolution is still pending but the event loop has already resolved" — often at **duration &lt; 5ms** (abort never even fired).
3. Sibling tests in the file/suite cancel → **8 or 9 cancelled**, **fail 0**.
4. Under load, other activity keeps the loop alive long enough for the 5ms abort → test asserts pass → full suite exit 0.

---

## Settlement proof (required matrix)

Both functions use the same contract: pass `AbortSignal` into `fetchFn` / `postConvexMutation` / `postQuery`, then `await` that call. Settlement = the awaited fetch promise settles (resolve or reject), then the wrapper returns or throws.

### `pushDigestToConvex` (`push-digest-convex.mjs`)

| Case | Ordering | Guarantee |
|------|----------|-----------|
| **(a) abort fires** | `AbortSignal.timeout` → abort → native fetch rejects → `catch` → `formatPushResult({ status: 'failed', reason })` | **Settles** (failed result, exitCode 1). Best-effort finalize uses same already-aborted signal → immediate reject → inner `catch` → still returns. |
| **(b) fetch never settles (ignores signal)** | Timeout aborts signal; mock/custom fetch ignores it | **Does not settle** — but this is **not** production `fetch`. Cron uses `globalThis.fetch`, which respects abort. |
| **(c) timer fires first** | Same as (a) for native fetch | **Settles** |
| **(d) unrelated reject after timeout already fired** | Timeout abort may already have rejected the in-flight fetch; a second reject is ignored | First settlement wins; wrapper already in `catch` or returned. **Settles** |

### `fetchEntityIntelligence` (`render-digest-entity-section.mjs`)

| Case | Ordering | Guarantee |
|------|----------|-----------|
| **(a) abort fires** | timeout signal → `postQuery` → fetch rejects → throw | **Settles** (reject). Caller `enrichPayloadWithEntityDigest` catches → `{ status: 'failed' }`. |
| **(b) fetch never settles (ignores signal)** | Same caveat as push — custom mock only | Not production path |
| **(c) timer fires first** | Same as (a) | **Settles** |
| **(d) unrelated reject after timeout** | First rejection settles the await | **Settles** |

**Operational note (OPS-1 class):** a hung Convex that *respects* abort cannot silently hang the digest push — timeout → failed result. A hypothetical `fetchFn` that swallows abort could hang; that is injection misuse, not the flake under investigation. Do **not** "fix" H2 by wrapping production in `Promise.race` unless the operator reopens H2 after rejecting this verdict.

---

## Proposed fix (test-side — APPROVED: B)

### Fix B (binding — keepalive mock; real timeoutMs path)

Rewrite **both** timeout tests so they:

1. Still prove abort-on-timeout causes the wrapper to settle with a timeout/abort error.
2. **Keep** `timeoutMs: 5` so production `AbortSignal.timeout` plumbing stays under test.
3. Use a hung mock that (a) checks `signal.aborted` first, (b) holds a **ref'd** `setInterval` keepalive until abort, (c) `clearInterval` on every settle path.

```js
fetchFn: async (_url, init) =>
  new Promise((_resolve, reject) => {
    const signal = init.signal;
    const keepalive = globalThis.setInterval(() => {}, 1);
    const done = () => {
      globalThis.clearInterval(keepalive);
      reject(signal.reason);
    };
    if (signal.aborted) {
      done();
      return;
    }
    signal.addEventListener('abort', done, { once: true });
  }),
```

### Why not A (rejected)

Injecting a pre-made controllable signal skips `timeoutMs → AbortSignal.timeout`. A green A-test would not catch a regression where that plumbing stops aborting hung pushes.

### Anti-patterns (FORBIDDEN)

- Raising `timeoutMs` to "make it green"
- Retries / reordering awaits until flake disappears
- `it.skip` / quarantine
- Weakening assertions (must still prove abort/timeout path)
- Touching `dedupe-digest-signals.mjs`, `score-digest-signals.mjs`, or any 90-5 surface
- Changing exit-0/stdout adapter contracts or Convex payload contract
- Production `Promise.race` "belt and suspenders"
- Fix A (signal inject) without reopening design gate

### Blast radius

| Surface | Change? |
|---------|---------|
| `tests/analyze-entity-intelligence.test.mjs` | **Yes** — timeout test mock (and only that test unless signal inject needs a helper) |
| `tests/render-digest-entity-section.test.mjs` | **Yes** — same |
| `push-digest-convex.mjs` | **No** under preferred B; **optional tiny** `signal?` under preferred A |
| `render-digest-entity-section.mjs` | **No** (already has `signal`) unless improving docs |
| Dual-copy `~/.hermes/skills/...` | **No** if production untouched; if A adds `signal` to push — `cmp` twin if that file is mirrored |
| verify.sh / package.json | **No** |
| 90-5 / dedupe / score | **Hard no** |

---

## Acceptance Criteria

### AC1 — Design gate

**Given** this story file  
**When** implementation starts  
**Then** `design_gate` must already be `APPROVED_*` (operator accepted H1 + proposed fix). If not, **HALT**.

### AC2 — Timeout tests still prove abort

**Given** the two timeout tests  
**When** the hung fetch never returns a body  
**Then** each still asserts timeout/abort failure (`/timed out|timeout|aborted/i`) and does **not** skip or soften the assertion.

### AC3 — Isolation cancelled = 0

**Given** PATH includes nvm node (`export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"`) — never invoke node by absolute path alone (CLI spawn ENOENT gotcha)  
**When** running:

```bash
node --test tests/analyze-entity-intelligence.test.mjs
node --test tests/render-digest-entity-section.test.mjs
```

**Then** both report `cancelled 0` (and fail 0).

### AC4 — verify.sh deterministic green (×3)

**Given** the same tree after the fix  
**When** `bash scripts/verify.sh` is run **three consecutive times**  
**Then** each exits 0 with pasted output showing pass counts and `cancelled 0` (or no cancelled line / zero cancelled). Paste all three into the Dev Agent Record.

### AC5 — No 90-5 / contract regressions

**Given** the diff  
**When** reviewed  
**Then** no files from 90-5 / dedupe / score are touched; Convex payload + adapter stdout contracts unchanged.

### AC6 — Do not implement H2 "fixes"

**Given** H1 is approved  
**When** coding  
**Then** do not add production Promise.race / raise production timeouts / change `DIGEST_*_TIMEOUT_MS` defaults as the flake fix.

---

## Tasks / Subtasks

- [x] Task 0: Confirm operator flipped `design_gate` to APPROVED (AC: 1) — APPROVED_2026-07-23_H1_FIX_B
- [x] Task 1: Fix hung-abort mock in `tests/analyze-entity-intelligence.test.mjs` (AC: 2, 3)
  - [x] 1.1 Fix B: keepalive + `signal.aborted` pre-check (`globalThis.setInterval` / `clearInterval`)
  - [x] 1.2 Keep assertion on timeout/abort error
- [x] Task 2: Fix stalled-query mock in `tests/render-digest-entity-section.test.mjs` (AC: 2, 3)
  - [x] 2.1 Same Fix B mock; keep `timeoutMs: 5` + all assertions including `DIGEST_ENTITY_FETCH_TIMEOUT_MS === 10_000`
- [x] Task 3: Isolation proof — both files `cancelled 0` (AC: 3)
- [x] Task 4: Three consecutive `bash scripts/verify.sh` exit 0 with pasted output (AC: 4)
- [x] Task 5: Diff hygiene — no 90-5 / contract files (AC: 5, 6)

### Review Findings

- [x] [Review][Defer] Extract shared Fix B hung-abort mock helper — deferred, pre-existing (story open question #2: optional follow-up; two verbatim copies match binding Fix B and are in scope as-is)
- [x] [Review][Defer] Suite-wide lint/grep ban on listener-only hung mocks without keepalive — deferred, pre-existing (story open question #2: still open, out of OPS-6 scope)

---

## Dev Notes

### Environment gotcha (not the bug)

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
```

Invoking `node` by absolute path makes CLI-contract tests that `spawn('node')` fail with `spawn node ENOENT`. Unrelated to this flake.

### Files to read before coding

| File | Why |
|------|-----|
| `tests/analyze-entity-intelligence.test.mjs:388-407` | Trigger A |
| `tests/render-digest-entity-section.test.mjs:250-264` | Trigger B |
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` (`pushDigestToConvex`, `DIGEST_PUSH_TIMEOUT_MS`, `postConvexMutation`) | Production settlement path — preserve |
| `scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs` (`fetchEntityIntelligence`, `DIGEST_ENTITY_FETCH_TIMEOUT_MS`) | Already has `options.signal` |
| Node `abort_controller.js` `setWeakAbortSignalTimeout` | Why unref matters |

### Previous story intelligence

- **OPS-1:** fail-loud when digest push silently succeeds with zero writes — same operational theme (silent failure class). Do not weaken OPS-1 paths.
- **73-4 / 73-7:** introduced these timeout unit tests with `timeoutMs: 5` + abort-listener mocks; production timeouts are 45s / 10s.
- **90-5** (`8d95632`): explicitly noted these flakes as residual risk **not attributable to 90-5**. This story closes that residual under OPS, not epic 90.

### Git intelligence (branch `hermes-consolidation`)

Recent commits are epic-90 intake/dedupe/quality. **Do not** mix OPS-6 fixes into 90-5 files. Baseline for this story: `8d95632`.

### Testing standards

- Runner: `node --test` via `npm test` / `scripts/verify.sh`
- No vitest for these `.mjs` tests
- Prefer deterministic mocks over wall-clock sleeps

### Project context reference

- Non-negotiable: `bash scripts/verify.sh` must pass before claiming done — this story restores that claim's meaning.
- Spec cite: no WriteGate / `vault_log_action` / `security.md` touch → no operator security approval beyond design_gate.
- Deferred-work: 73-7 review leftovers exist but are unrelated to this flake; do not expand scope into them.

---

## Open questions (resolved)

1. ~~Prefer A vs B?~~ → **B** (approved). A rejected: skips `timeoutMs→AbortSignal.timeout`.
2. Optional follow-up (separate story): lint/grep ban on listener-only hung mocks without keepalive — still open, out of scope.

---

## Dev Agent Record

### Agent Model Used

Composer (implement Fix B after H1 approval)

### Debug Log References

- Pre-fix isolation: `cancelled 8` / `cancelled 1` (unsafe mock)
- Post-fix isolation: analyze 18/18 pass cancelled 0; render 12/12 pass cancelled 0
- Lint: bare `setInterval` → `no-undef`; fixed via `globalThis.setInterval` / `globalThis.clearInterval`
- verify.sh ×3: all exit 0, `# pass 1549` / `# fail 0` / `# cancelled 0`

### Completion Notes List

- Design gate APPROVED H1 + Fix B (B over A: keeps real `timeoutMs→AbortSignal.timeout` under test)
- Opus independent confirmation recorded in story (beforeExit@0ms, pre-abort hang, production sound)
- Both timeout tests use keepalive + mandatory `signal.aborted` pre-check; assertions unchanged
- Production code untouched; 90-5 / dedupe / score untouched

### Proof — isolation (2026-07-23)

```
# analyze-entity-intelligence.test.mjs
# tests 18
# pass 18
# fail 0
# cancelled 0

# render-digest-entity-section.test.mjs
# tests 12
# pass 12
# fail 0
# cancelled 0
```

Previously-cancelled siblings (8 + 1) now PASS with the timeout tests.

### Proof — verify.sh ×3 (PATH=nvm node v22.23.1)

```
======== VERIFY RUN 1 ========
# tests 1549
# pass 1549
# fail 0
# cancelled 0
==> VERIFY PASSED
RUN1_EXIT=0

======== VERIFY RUN 2 ========
# tests 1549
# pass 1549
# fail 0
# cancelled 0
==> VERIFY PASSED
RUN2_EXIT=0

======== VERIFY RUN 3 ========
# tests 1549
# pass 1549
# fail 0
# cancelled 0
==> VERIFY PASSED
RUN3_EXIT=0

SUMMARY e1=0 e2=0 e3=0
```

### File List

- `tests/analyze-entity-intelligence.test.mjs` (Fix B mock only)
- `tests/render-digest-entity-section.test.mjs` (Fix B mock only)
- `_bmad-output/implementation-artifacts/OPS-6-verify-gate-async-timeout-determinism.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
