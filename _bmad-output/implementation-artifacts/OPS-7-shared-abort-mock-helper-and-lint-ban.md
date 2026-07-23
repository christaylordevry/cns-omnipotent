---
story_id: OPS-7
epic: ops-observability
title: shared-abort-mock-helper-and-lint-ban
status: done
created: 2026-07-23
amended: 2026-07-23
baseline_commit: b4047c0
predecessors: OPS-6
closes_deferrals:
  - Shared Fix B hung-abort mock helper (OPS-6 review)
  - Suite-wide lint/grep ban on listener-only hung mocks (OPS-6 review)
do_not_touch: dedupe-digest-signals.mjs, score-digest-signals.mjs, anything from 90-5, production AbortSignal paths
coupled: true
amendment_notes: "Reframe notebook-stale + portal-embedder as live latent flakes; extend lint to tests/**/*.ts; migrate all four call sites"
---

# Story OPS-7: Shared abort-mock helper + lint ban on raw abort listeners in tests

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Amended 2026-07-23: four call sites (incl. .ts) are binding flake fixes; lint covers tests/**/*.{mjs,ts} -->

Epic: **ops-observability** (reopened — close both OPS-6 deferrals as one coupled ship)  
Tracked in sprint-status as: **`OPS-7-shared-abort-mock-helper-and-lint-ban`**  
**Depends on:** OPS-6 done (`b4047c0` — Fix B keepalive mocks live)  
**Theme:** same fail-loud / gate-honesty class as OPS-1 / OPS-6 — a verify gate that can silently re-flake is not a gate.

---

## Story

As the **CNS operator**,
I want **one audited hung-abort test helper and an ESLint ban that forces every test mock through it (`.mjs` and `.ts`)**,
so that **the next timeout-unit test cannot reintroduce the AbortSignal.timeout unref trap that made `verify.sh` a coin flip until OPS-6 — and the two remaining live latent flakes of the same pattern are closed in the same ship**.

---

## Why coupled (do not split)

| If you ship… | Alone… | Failure mode |
|--------------|--------|--------------|
| Lint ban only | CORRECT post-OPS-6 mocks still call `signal.addEventListener('abort', done, { once: true })` | Selector that catches the dangerous pattern also flags Fix B. Static AST cannot verify "has a keepalive". |
| Helper only | Nothing stops a future author from pasting the pre-OPS-6 listener-only mock | Recurrence of cancelledByParent suite flakes. |
| Lint on `.mjs` only | `.ts` flake stays live; trap freely reintroducible in every TS test | **Half the guard is no guard.** |

**Order is binding:** T1 helper → T2 migrate **all four** call sites onto helper → T3 lint ban on `tests/**/*.{mjs,ts}` → proof. Never enable the ban before the helper exists and call sites are migrated.

---

## Background (verified — do not re-derive)

From OPS-6 (baseline `b4047c0`, design gate H1 + Fix B):

- `AbortSignal.timeout()` **unrefs** its timer (`setWeakAbortSignalTimeout` in Node `abort_controller.js`).
- A mock that **only** registers an `'abort'` listener holds nothing ref'd → event loop drains → abort never fires → promise never settles → node reports `"Promise resolution is still pending but the event loop has already resolved"` as `cancelledByParent`, cancelling sibling subtests.
- Listener-only mocks also **never settle** against an already-aborted signal (late listeners are not invoked). `signal.aborted` pre-check is mandatory.
- **Production is sound** (H1 test-only): native `fetch` holds a ref'd socket, so abort fires. Do not "fix" production with `Promise.race`.
- Every morning-digest fetcher uses `globalThis.AbortSignal.timeout` — the next test that mocks any of them walks straight back into this without a ban.

---

## Live latent flakes (binding — not optional cleanup)

**Verified:** both non-OPS-6 sites are the **identical dangerous pattern** — listener-only, **no keepalive**, **no `signal.aborted` pre-check**:

| File | Test | Notes |
|------|------|-------|
| `tests/notebook-stale-alert.test.mjs:307` | `aborts a stalled Discord request and resolves` | Raw `init?.signal?.addEventListener("abort", …)` |
| `tests/brain/portal-embedder.test.ts:116` | `passes an abort signal and reports timeout when Portal hangs` | Same listener-only shape; SUT `timeoutMs: 1` |

They pass today **only because unrelated ref'd handles keep the event loop alive under full-suite load** — the same accident that made the OPS-6 pair non-deterministic. Migrating them is a **FIX**, not housekeeping. Do **not** treat either as optional, residual, or "lint-scope cleanup."

---

## Design decisions (binding)

| # | Decision | Rule |
|---|----------|------|
| 1 | Story key **OPS-7**; reopen **ops-observability** | Not Epic 90 / 89. Closes both OPS-6 deferrals in `deferred-work.md`. |
| 2 | Helper path | `tests/helpers/abort-mock.mjs` — `tests/helpers/` already exists (`hermes-env-isolation.mjs`). Do not invent a new convention. |
| 3 | Lint = built-in `no-restricted-syntax` only | **No new npm deps** (no `eslint-plugin-*`). Repo security: packages &lt;14 days old need operator approval — so **zero new deps**. |
| 4 | Scope = `tests/**/*.{mjs,ts}` | Do **not** apply to `scripts/**` — production legitimately uses AbortController / AbortSignal. `.claude/worktrees/**` already in eslint `ignores` — no action. |
| 5 | Allowlist = helper module ONLY via **file-level** `no-restricted-syntax: "off"` | Flat-config override for `tests/helpers/abort-mock.mjs` only. **Do not** use `eslint-disable-next-line` for the audited listener: a line-scoped disable sits directly above the canonical banned pattern and is copy-pasteable — it would travel with any copy of the helper's listener and defeat the ban silently. A config-scoped override cannot be copied out of `eslint.config.js`. Accepted residual: a future second `no-restricted-syntax` rule for `tests/**` would silently not apply inside the helper — mitigate with a header comment in `abort-mock.mjs` requiring manual re-check when new selectors are added. No other exemptions. |
| 6 | Pure extraction for OPS-6 sites | `timeoutMs: 5` and **every assertion byte-identical**. Behaviour must not change. |
| 7 | Latent-flake sites = FIX | notebook-stale + portal-embedder migrations are required flake fixes; assertions stay byte-identical; **only mock construction changes**. |
| 8 | Production untouched | No changes to fetchers, `push-digest-convex.mjs`, `render-digest-entity-section.mjs`, 90-5 / dedupe / score. OPS-6 H1 verdict stands. |
| 9 | TS import type-clean | Helper is `.mjs`; `portal-embedder.test.ts` is under typescript-eslint + `tsconfig.eslint.json`. Make the import type-clean via **JSDoc-typed helper + `allowJs`**, **or** a co-located `.d.ts`. **Do not** weaken tsconfig strictness, add `any` casts, or add a dependency. |

---

## Current call-site inventory (2026-07-23 — selector verified; all four binding)

Selector under test (AST-confirmed via espree + ESLint API):

```
CallExpression[callee.property.name='addEventListener'][arguments.0.value='abort']
```

| File | Line | Pattern | Lint scope? | Action |
|------|------|---------|-------------|--------|
| `tests/analyze-entity-intelligence.test.mjs` | ~413 | Fix B keepalive + aborted pre-check | **Yes** | **Migrate to helper** (pure extraction) |
| `tests/render-digest-entity-section.test.mjs` | ~265 | Fix B keepalive + aborted pre-check | **Yes** | **Migrate to helper** (pure extraction) |
| `tests/notebook-stale-alert.test.mjs` | ~307 | Listener-only (optional chain) — **live latent flake** | **Yes** | **FIX — migrate to helper** |
| `tests/brain/portal-embedder.test.ts` | ~116 | Listener-only (optional chain) — **live latent flake** | **Yes** (`.ts` now in scope) | **FIX — migrate to helper**; mock construction **only** |

**Selector AST notes (verified):**

- Plain `signal.addEventListener('abort', …)` → **MATCH**
- Optional `init?.signal?.addEventListener("abort", …)` → still a `CallExpression` with `callee.property.name === 'addEventListener'` → **MATCH**
- `signal.onabort = …` → **MATCH** (second selector: `AssignmentExpression[left.property.name='onabort']` — ordinary alternate spelling of the same hung-listener trap; added OPS-7 review). Same message as the `addEventListener` selector.
- `addEventListener('click', …)` → **no match**
- Dynamic `addEventListener(eventName, …)` → **no match** (arg0 not Literal `'abort'`) — deliberate evasion, out of scope

Do not invent a "smarter" selector that tries to detect keepalive — that is why the helper funnel exists. Do not chase computed/variable event names.

---

## Acceptance Criteria

### AC1 — Shared helper exists and is documented

**Given** `tests/helpers/`  
**When** the helper is added  
**Then** `tests/helpers/abort-mock.mjs` exports a factory (or pair of exports) that:

1. Starts a **ref'd** `globalThis.setInterval` keepalive.
2. Settles **only** via a single `done()` that `clearInterval`s then rejects with `signal.reason` (or equivalent abort reason).
3. **Pre-checks** `signal.aborted` and calls `done()` immediately if already aborted.
4. Supports both call shapes used by tests:
   - fetch-shaped: `(_url, init) => …` reading `init.signal`
   - direct: `(signal) => …` if a call site needs it
5. Has **JSDoc** explaining the unref rationale (why keepalive exists) so the next reader does not "simplify" it away.
6. Is **importable type-clean** from `tests/brain/portal-embedder.test.ts` (JSDoc + `allowJs` in eslint/ts project config as needed, **or** co-located `abort-mock.d.ts`). No `any` casts at call sites; no strictness weaken; no new deps.

### AC2 — OPS-6 call sites refactored (pure extraction)

**Given** the two OPS-6 timeout tests  
**When** they use the helper  
**Then**:

- `tests/analyze-entity-intelligence.test.mjs` — `pushDigestToConvex … configured timeout` still uses `timeoutMs: 5` and asserts `assert.match(result.error, /timed out|timeout/i)` **byte-identical**.
- `tests/render-digest-entity-section.test.mjs` — `fetchEntityIntelligence … configured timeout` still uses `timeoutMs: 5`, `assert.rejects(…, /timeout|aborted/i)`, and `assert.equal(DIGEST_ENTITY_FETCH_TIMEOUT_MS, 10_000)` **byte-identical**.
- Inline Fix B blocks (setInterval / done / aborted / addEventListener) are removed from those tests in favour of the helper import.

### AC3 — Live latent flake sites fixed (both required)

**Given** the two listener-only latent flakes  
**When** migrated onto the helper  
**Then**:

- `tests/notebook-stale-alert.test.mjs` — mock uses helper; assertions unchanged (`receivedSignal?.aborted === true`, stderr string).
- `tests/brain/portal-embedder.test.ts` — mock uses helper; assertions unchanged (`rejects.toMatchObject` with `IO_ERROR` / timed out; `signals[0]?.aborted === true`).
- **Zero** raw `addEventListener('abort'| "abort")` remain under `tests/` outside `tests/helpers/abort-mock.mjs`.

### AC4 — Lint ban live on `.mjs` and `.ts`

**Given** ESLint 10 flat config (`eslint.config.js`, installed `eslint@10.5.0`)  
**When** the ban is added  
**Then**:

- A config block with `files: ["tests/**/*.mjs", "tests/**/*.ts"]` (or equivalent `tests/**/*.{mjs,ts}`) sets `no-restricted-syntax` to **error** with the verified selectors (literal `addEventListener(..., 'abort')` **and** `signal.onabort = …`) and a message that names the trap + remedy, e.g.  
  `"AbortSignal.timeout unrefs its timer — a listener-only abort mock never settles and silently cancels the suite. Use the shared abort-mock helper (OPS-6)."`
- **Not** scoped to `scripts/**`.
- Helper file is the **only** allowlist via flat-config override `no-restricted-syntax: "off"` for `tests/helpers/abort-mock.mjs` (not a line-scoped disable — those are copy-pasteable and would defeat the ban). Header comment in the helper requires re-checking when new restricted-syntax selectors are added.
- No new dependencies in `package.json`.

### AC5 — Negative + positive lint proof

**Given** the ban  
**When** proving it works  
**Then**:

1. **Negative:** temporarily reintroduce a raw listener-only mock in a test file under the ban (`.mjs` **and** `.ts`) for both `addEventListener('abort', …)` and `signal.onabort = …` → `npm run lint` / `npx eslint <probe>` **FAILS** with the OPS-7 message. Paste output. Revert.
2. **Positive:** after revert / on the helper-based tree → `npm run lint` clean.

### AC6 — Isolation still green

**Given** `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"` (never absolute-path-only `node` — CLI `spawn('node')` ENOENT gotcha)  
**When** running the touched suites in isolation:

```bash
node --test tests/analyze-entity-intelligence.test.mjs
node --test tests/render-digest-entity-section.test.mjs
node --test tests/notebook-stale-alert.test.mjs
# portal-embedder is vitest — use the repo's existing vitest invocation for that file
```

**Then** analyze **18/18**, render **12/12**, `fail 0`, `cancelled 0`; notebook-stale green; portal-embedder timeout test green. No ambient-env fallout from the brain file (mock-only change).

### AC7 — verify.sh exit 0 (lint is a real gate)

**Given** `scripts/verify.sh` lines 78–85 (`npm run lint` → `LINT failed` → `exit 1`)  
**When** `bash scripts/verify.sh`  
**Then** exit 0. Confirm this path exercises the new rule (negative proof in AC5 already shows lint fails; verify must still pass on the clean tree).

### AC8 — Scope hygiene + deferred-work close

**Given** the diff  
**When** reviewed  
**Then**:

- No production code / 90-5 / dedupe / score touched.
- Both OPS-6 deferral bullets in `_bmad-output/implementation-artifacts/deferred-work.md` marked **CLOSED by OPS-7** (preserve original text; annotate, do not erase).
- No "residual optional" language for portal-embedder — it shipped in this story.

---

## Tasks / Subtasks

- [x] Task 1: Add `tests/helpers/abort-mock.mjs` (+ type surface for TS) (AC: 1)
  - [x] 1.1 Factory / exports for fetch-shaped + direct-signal forms
  - [x] 1.2 Keepalive + single `done()` + `signal.aborted` pre-check
  - [x] 1.3 JSDoc with unref rationale (cite OPS-6 / Node unref)
  - [x] 1.4 Type-clean TS import path: JSDoc + `allowJs` (minimal, no strictness weaken) **or** co-located `abort-mock.d.ts` — no `any`, no new deps
- [x] Task 2: Refactor OPS-6 call sites onto helper (AC: 2)
  - [x] 2.1 `tests/analyze-entity-intelligence.test.mjs` — keep assertions identical
  - [x] 2.2 `tests/render-digest-entity-section.test.mjs` — keep assertions identical
- [x] Task 3: FIX live latent flakes onto helper (AC: 3)
  - [x] 3.1 `tests/notebook-stale-alert.test.mjs` — mock only; keep abort/stderr assertions
  - [x] 3.2 `tests/brain/portal-embedder.test.ts` — **mock construction only**; keep all assertions; do not touch env setup / stubs / other tests in that file
- [x] Task 4: Add lint ban + helper allowlist in `eslint.config.js` (AC: 4)
  - [x] 4.1 New flat-config block: `files: ["tests/**/*.mjs", "tests/**/*.ts"]` + `no-restricted-syntax`
  - [x] 4.2 Allowlist override for `tests/helpers/abort-mock.mjs` only
  - [x] 4.3 Re-verify selector against AST / temporary reintroduction (do not commit a weaker selector)
- [x] Task 5: Proof pack (AC: 5, 6, 7)
  - [x] 5.1 Negative lint (paste fail) → revert
  - [x] 5.2 Positive lint clean
  - [x] 5.3 Isolation: analyze 18/18, render 12/12, cancelled 0; notebook-stale green; portal-embedder green
  - [x] 5.4 `bash scripts/verify.sh` exit 0
- [x] Task 6: Close OPS-6 deferrals in `deferred-work.md` (AC: 8)

### Review Findings

- [x] [Review][Decision] Selector completeness — string-literal `'abort'` only — **Resolved: harden narrowly.** Added `AssignmentExpression[left.property.name='onabort']` with the same message. Rationale: `signal.onabort = …` is an ordinary alternate spelling of the identical flake (plausible-accident path), not deliberate evasion. Computed/variable event names remain out of scope; keepalive inference remains forbidden.
- [x] [Review][Decision] Helper allowlist turns `no-restricted-syntax` fully `"off"` — **Resolved: keep file-level `"off"`.** Line-scoped `eslint-disable-next-line` is copy-pasteable above the canonical banned pattern and would defeat the ban if carried out with a copied listener; config override cannot travel. Residual accepted: future restricted-syntax rules skip the helper — mitigated by header comment in `abort-mock.mjs`.
- [x] [Review][Patch] notebook-stale bare `catch` remaps every rejection to `Error("aborted")` [`tests/notebook-stale-alert.test.mjs:313`] — fixed: rethrow unless `init.signal.aborted`; remap with `{ cause: err }` for `preserve-caught-error`
- [x] [Review][Patch] AC5 negative-lint paste missing from story Dev Agent Record — fixed: pasted addEventListener + onabort proofs for `.mjs` and `.ts` below
- [x] [Review][Defer] `onabort` / non-`addEventListener` hung patterns bypass ban — **superseded by Decision 1 harden** (`onabort` selector shipped); other EventTarget APIs remain deferred below
- [x] [Review][Defer] `hungUntilAbort` TOCTOU between `signal.aborted` check and listener attach [`tests/helpers/abort-mock.mjs:33`] — deferred, pre-existing
- [x] [Review][Defer] `hungUntilAbort` lacks input validation before `setInterval` (bad arg can leak keepalive) [`tests/helpers/abort-mock.mjs:27`] — deferred, pre-existing
- [x] [Review][Defer] Dual `.mjs` / `.d.ts` signature drift risk [`tests/helpers/abort-mock.d.ts`] — deferred, pre-existing
- [x] [Review][Defer] No dedicated unit coverage of helper branches (already-aborted / invalid signal / keepalive clear) — deferred, pre-existing

---

## Dev Notes

### Suggested helper shape (illustrative — match repo style)

```js
/**
 * Hung fetch mock that settles only when `signal` aborts.
 *
 * Why keepalive: `AbortSignal.timeout()` unrefs its timer. A listener-only
 * mock holds nothing ref'd → the event loop drains → abort never fires →
 * the test promise stays pending and node cancels the suite
 * (`cancelledByParent`). Production fetch is fine (socket is ref'd).
 * See OPS-6 / OPS-7.
 *
 * @param {AbortSignal} signal
 * @returns {Promise<never>}
 */
export function hungUntilAbort(signal) {
  return new Promise((_resolve, reject) => {
    const keepalive = globalThis.setInterval(() => {}, 1);
    const done = () => {
      globalThis.clearInterval(keepalive);
      reject(signal.reason);
    };
    if (signal.aborted) {
      done();
      return;
    }
    // sole audited abort listener — allowlisted via eslint.config.js file override (OPS-7)
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * Fetch-shaped factory for injection as `fetchFn`.
 * @returns {(url: unknown, init?: { signal?: AbortSignal }) => Promise<never>}
 */
export function createHungAbortFetchMock() {
  return async (_url, init) => {
    const signal = init?.signal;
    if (!(signal instanceof AbortSignal)) {
      throw new TypeError("createHungAbortFetchMock requires init.signal");
    }
    return hungUntilAbort(signal);
  };
}
```

Prefer a **scoped flat-config override** for the helper file — **required** after OPS-7 review (Decision 5). Do **not** use `eslint-disable-next-line` on the listener: those comments are copy-pasteable and would defeat the ban if carried out with a copied listener.

Use `globalThis.setInterval` / `clearInterval` (OPS-6: bare `setInterval` tripped `no-undef` under the tests/scripts eslint globals block).

### Type-clean import from `.mjs` into `portal-embedder.test.ts`

`tsconfig.eslint.json` today: `strict: true`, **no** `allowJs`, includes `tests/**/*.ts` only. The helper is `.mjs`.

**Allowed approaches (pick one; no deps):**

1. **JSDoc on the helper + `allowJs: true`** in `tsconfig.eslint.json` (and include `tests/helpers/abort-mock.mjs` if needed so the project service sees it). Do **not** turn off `strict` or add looseness flags.
2. **Co-located `tests/helpers/abort-mock.d.ts`** declaring the exports with proper types; keep the `.mjs` implementation as SSOT.

**Forbidden:** `as any` / `as unknown as typeof fetch` solely to silence the helper import; weakening strictness; new npm packages for interop.

Existing portal-embedder casts on `fetchFn` that predate this story may remain if untouched; do not *add* new `any` to force the helper through.

### CAUTION — `tests/brain/**` environment sensitivity

Brain/recall tests have broken before from ambient env pollution. For `portal-embedder.test.ts`:

- Change **ONLY** the hung-abort mock construction (the `addEventListener('abort')` Promise body).
- Do **not** touch env setup, stub embedders, `resolveBrainEmbedder` cases, or any other assertion in that file.
- If migrating the mock turns out to require touching brain env wiring → **STOP and report** rather than proceeding.

### eslint.config.js placement

Existing block already covers `files: ["tests/**/*.mjs", "scripts/**/*.mjs"]` with recommended rules. **Append** a tests-only ban block covering **both** `tests/**/*.mjs` and `tests/**/*.ts`, then a helper allowlist block. Flat config: later matching configs override the same rule.

Do **not** put the ban on the combined tests+scripts block. Do **not** worry about `.claude/worktrees/**` — already ignored.

### Files to read before coding

| File | Why |
|------|-----|
| `tests/analyze-entity-intelligence.test.mjs` (~388–419) | OPS-6 Fix B site A |
| `tests/render-digest-entity-section.test.mjs` (~250–276) | OPS-6 Fix B site B |
| `tests/notebook-stale-alert.test.mjs` (~302–326) | Live latent flake — FIX |
| `tests/brain/portal-embedder.test.ts` (~109–130) | Live latent flake — FIX; mock only |
| `tests/helpers/hermes-env-isolation.mjs` | Existing helpers convention / import style |
| `eslint.config.js` | Flat config target |
| `tsconfig.eslint.json` | Type-clean `.mjs` import surface |
| `scripts/verify.sh` (~78–85) | Lint gate |
| `OPS-6-verify-gate-async-timeout-determinism.md` | H1 + Fix B binding context |

### Anti-patterns (FORBIDDEN)

- Splitting helper vs lint into separate PRs/stories
- Enabling the ban before all four migrations → red verify
- Leaving portal-embedder as "residual" / optional
- Scoping lint to `.mjs` only (half guard)
- Exempting call-site test files "temporarily"
- Weakening / rewording assertions while refactoring
- Expanding lint to `scripts/**` or inventing a custom eslint plugin
- Touching production AbortSignal / fetch timeout code
- Touching brain env wiring / stubs beyond the one mock
- `any` casts or strictness weaken to force TS import
- Raising `timeoutMs` / skipping tests to stay green

### Previous story intelligence (OPS-6)

- Fix B (keepalive + aborted pre-check) is the approved mock shape; Fix A (inject controllable signal) was **rejected** — skips `timeoutMs → AbortSignal.timeout` plumbing.
- Isolation proof target: analyze **18/18**, render **12/12**, cancelled **0**.
- `globalThis.setInterval` required for lint globals.
- PATH must include nvm node binary directory.

### Git intelligence

- HEAD / baseline: `b4047c0` — `fix(OPS-6): make verify gate deterministic — AbortSignal.timeout unref trap`
- Branch: `hermes-consolidation`
- Do not mix this work into epic-90 files.

### Latest tech (ESLint 10)

- Installed: `eslint@10.5.0`, `@eslint/js@10.0.1`, flat config via `tseslint.config(...)`.
- `no-restricted-syntax` accepts `{ selector, message }` objects ([ESLint docs](https://eslint.org/docs/latest/rules/no-restricted-syntax)).
- Per-glob enable/disable via `files` + later override block ([flat config rules](https://eslint.org/docs/latest/use/configure/rules)).

### Project context / specs

- Non-negotiable verify gate: this story hardens the lint leg so the unref trap cannot silently return — and closes two live latent flakes of the same class.
- No WriteGate / `vault_log_action` / `security.md` touch → no operator security approval required.
- Spec cite: ops theme only; vault contract N/A for test-helper work.
- Closes deferred-work OPS-6 bullets (shared helper + lint ban).

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Pre-migration isolation: analyze 18/18 cancelled 0; render 12/12 cancelled 0
- Post-migration isolation identical; notebook-stale 17/17; portal-embedder 14/14
- `no-undef` on bare `AbortSignal` in helper + notebook-stale → switched to `globalThis.AbortSignal` (same pattern as OPS-6 `globalThis.setInterval`)
- Code-review patches (2026-07-23): `onabort` selector; notebook-stale fail-loud catch; Decision 5 rationale + helper header comment; AC5 pastes below
- Post-review: `npm run lint` clean; notebook-stale 17/17 cancelled 0

### Negative lint proofs (AC5 — pasted 2026-07-23)

Probes under `tests/_ops7-lint-probe.{mjs,ts}` (reverted after each run). Message identical for all four.

**addEventListener / .mjs**
```
/home/christ/ai-factory/projects/Omnipotent.md/tests/_ops7-lint-probe.mjs
  3:3  error  AbortSignal.timeout unrefs its timer — a listener-only abort mock never settles and silently cancels the suite. Use the shared abort-mock helper (OPS-6)  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
```

**addEventListener / .ts**
```
/home/christ/ai-factory/projects/Omnipotent.md/tests/_ops7-lint-probe.ts
  3:3  error  AbortSignal.timeout unrefs its timer — a listener-only abort mock never settles and silently cancels the suite. Use the shared abort-mock helper (OPS-6)  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
```

**onabort / .mjs** (`signal.onabort = () => {}`)
```
/home/christ/ai-factory/projects/Omnipotent.md/tests/_ops7-lint-probe.mjs
  3:3  error  AbortSignal.timeout unrefs its timer — a listener-only abort mock never settles and silently cancels the suite. Use the shared abort-mock helper (OPS-6)  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
```

**onabort / .ts** (`signal.onabort = () => {}`)
```
/home/christ/ai-factory/projects/Omnipotent.md/tests/_ops7-lint-probe.ts
  3:3  error  AbortSignal.timeout unrefs its timer — a listener-only abort mock never settles and silently cancels the suite. Use the shared abort-mock helper (OPS-6)  no-restricted-syntax
✖ 1 problem (1 error, 0 warnings)
```

**Positive:** `npm run lint` → clean (exit 0) after probes reverted.

### Completion Notes List

- Added `tests/helpers/abort-mock.mjs` (`hungUntilAbort` + `createHungAbortFetchMock`) with keepalive, single `done()`, `signal.aborted` pre-check, JSDoc unref rationale
- Co-located `abort-mock.d.ts` for type-clean TS import; included in `tsconfig.eslint.json` (no `allowJs`, no `any`, no new deps)
- Pure extraction: analyze + render OPS-6 sites → helper; assertions byte-identical; isolation still 18/18 and 12/12 cancelled 0
- FIX: notebook-stale + portal-embedder listener-only mocks → helper (portal: mock construction only); notebook remaps abort → `Error("aborted", { cause })` only when `signal.aborted` (fail-loud otherwise)
- Zero raw `addEventListener('abort')` / `onabort` assignments under `tests/` outside the helper
- Lint ban on `tests/**/*.{mjs,ts}` via `no-restricted-syntax` (literal `addEventListener` + `onabort` assignment); file-level allowlist for helper only; header comment requires re-check when new selectors land
- Negative proof: addEventListener + onabort × `.mjs`/`.ts` (pasted above); positive lint clean
- `bash scripts/verify.sh` → VERIFY PASSED (exit 0) pre-review; lint + notebook-stale re-verified post-review
- Both OPS-6 deferral bullets annotated **CLOSED by OPS-7**; code-review decisions resolved

### File List

- `tests/helpers/abort-mock.mjs` (NEW)
- `tests/helpers/abort-mock.d.ts` (NEW)
- `tests/analyze-entity-intelligence.test.mjs`
- `tests/render-digest-entity-section.test.mjs`
- `tests/notebook-stale-alert.test.mjs`
- `tests/brain/portal-embedder.test.ts` (mock construction only)
- `eslint.config.js`
- `tsconfig.eslint.json`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/OPS-7-shared-abort-mock-helper-and-lint-ban.md`

### Change Log

- 2026-07-23: Implemented OPS-7 — shared abort-mock helper, migrated all four call sites, lint ban last, proof pack green, closed OPS-6 deferrals
- 2026-07-23: Code review — `onabort` selector harden; keep file-level allowlist + rationale; notebook-stale fail-loud catch; AC5 pastes; story → done
