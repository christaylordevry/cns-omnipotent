---
story_id: 60-2
epic: 60
title: dry-refactor-shared-withsessioncloseenv-isolation-helper
status: review
baseline_commit: b17a9e3dce0132b8cb4158b8c25cb0df9ef94d24
operator_brief: 2026-06-04
predecessors: 59-2, 59-3, 60-1
deferred_from: deferred-work.md — session-close test HERMES_HOME isolation fix (2026-06-04)
spec_ref: _bmad-output/implementation-artifacts/spec-session-close-test-hermes-home-isolation.md
---

# Story 60.2: DRY refactor — shared `withSessionCloseEnvIsolation` helper

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **CNS maintainer**,  
I want **a single test helper that saves, neutralizes, and restores `HERMES_HOME` / `HOME` (and related NotebookLM env keys)**,  
so that **session-close routing tests cannot leak the operator's real `~/.hermes/session-close.env` and new tests cannot forget `HERMES_HOME` again**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 60 (operator brief 2026-06-04); this story closes deferred work from the **59-2 / HERMES_HOME isolation** fix |
| **Root cause doc** | `spec-session-close-test-hermes-home-isolation.md` — `defaultSessionCloseEnvPath()` prefers `HERMES_HOME` over `HOME` |
| **Production code** | **No changes** — `scripts/session-close/lib/load-session-close-env.mjs` precedence is correct for Hermes gateway |
| **Risk** | Pure structural refactor; behaviour must stay identical — run `npm test` before/after and compare only import paths + helper calls |

### Why this matters

Epic 59 added the same save/delete/restore blocks in three files. Duplication caused the original bug (isolating `HOME` only). A shared helper makes omitting `HERMES_HOME` impossible for call sites that use it.

### Out of scope

- `tests/vault-export-drive-sync.test.mjs` — different `withIsolatedEnv(overrides, fn)` that passes explicit `envPath` (no `HERMES_HOME` neutralization today)
- `tests/notebook-stale-alert.test.mjs` — generic override helper, unrelated keys
- Production session-close scripts, WriteGate, vault IO, Hermes skill mirrors (60-1 territory)
- Wiring the helper into `scripts/verify.sh` (no new gate)

## Acceptance Criteria

### 1. Shared helper module (AC: helper)

**Given** the repo test tree  
**When** the story is complete  
**Then** `tests/helpers/hermes-env-isolation.mjs` exists and exports at minimum:

- `restoreEnv(key, prior)` — `undefined` prior → `delete process.env[key]`, else assign
- `withSessionCloseEnvIsolation(opts, fn)` — canonical name per `deferred-work.md` (operator brief alias `withHermesEnvIsolation` is the same contract)

**And** during `fn`, `process.env.HERMES_HOME` is **always deleted** (neutralized) unless a future explicit opt-out is added — **no opt-out in this story**

**And** `opts` supports:

| Option | Purpose |
|--------|---------|
| `saveKeys?: string[]` | Extra env keys to save/restore (beyond `HOME`, `HERMES_HOME`) |
| `apply?: Record<string, string \| null \| undefined>` | Keys to set for the test body; `null` / omit after capture → delete during test |
| `home?: string` | If set, assign `process.env.HOME` for the test body |
| `tmpdir?: { prefix: string }` | If set, `mkdtemp` under `os.tmpdir()`, assign `HOME`, `rm` in `finally` |

**And** all saved keys restore in `finally` even when `fn` throws

### 2. Call sites migrated (AC: migrate)

**Then** duplicated inline / local helpers are removed from:

| File | Remove / replace |
|------|------------------|
| `tests/notebook-routing-report.test.mjs` | Local `restoreEnv` + `withIsolatedEnv` (lines ~14–70) → import shared helper |
| `tests/smart-routing.test.mjs` | Local `restoreEnv` + `withIsolatedEnv` (lines ~9–75) **and** inline block in `"env IDs win over smart routing"` (lines ~372–402) |
| `tests/session-close-pipeline.test.mjs` | Three inline save/restore blocks (lines ~286–353, ~356–435, ~438–513) → helper calls with equivalent `saveKeys` / `apply` / `home` / `tmpdir` |

**And** no remaining hand-rolled `priorHermesHome` / `oldHermesHome` save-restore in those three files (grep confirms)

**And** optional convenience export `withSmartRoutingIsolatedEnv(smartRoutingValue, fn)` is allowed **only if** it is a thin wrapper over `withSessionCloseEnvIsolation` (same behaviour as today's local `withIsolatedEnv`) — avoids duplicating logic twice in the helper file

### 3. Tests green (AC: test)

**When** `npm run test:node` runs from repo root  
**Then** exit code is **0** (all `tests/*.test.mjs` including the three migrated files)

**When** `npm test` runs  
**Then** exit code is **0** (node + vitest)

### 4. Verify gate (AC: verify)

**When** `bash scripts/verify.sh` runs  
**Then** exit code is **0**

### 5. No behaviour change (AC: pure refactor)

**Then** diff touches **only** `tests/helpers/hermes-env-isolation.mjs` and the three test files above  
**And** no edits under `scripts/`, `src/`, `specs/`, or vault paths  
**And** test assertions and fixture data are unchanged — only env isolation plumbing moves

## Tasks / Subtasks

- [x] **T1** Add `tests/helpers/hermes-env-isolation.mjs` with `restoreEnv` + `withSessionCloseEnvIsolation` (AC: 1)
- [x] **T2** (Optional) Add `withSmartRoutingIsolatedEnv` wrapper matching current `withIsolatedEnv` semantics (AC: 1–2)
- [x] **T3** Migrate `tests/notebook-routing-report.test.mjs` — drop local helpers, import from helper (AC: 2)
- [x] **T4** Migrate `tests/smart-routing.test.mjs` — drop local helpers + inline `"env IDs win"` block (AC: 2)
- [x] **T5** Migrate `tests/session-close-pipeline.test.mjs` — three notebook env tests (AC: 2)
- [x] **T6** Grep guard: `rg 'oldHermesHome|priorHermesHome' tests/notebook-routing-report.test.mjs tests/smart-routing.test.mjs tests/session-close-pipeline.test.mjs` → no matches (AC: 2)
- [x] **T7** `npm run test:node` → `npm test` → `bash scripts/verify.sh` (AC: 3–4)
- [x] **T8** Update `deferred-work.md` — strike or mark resolved the DRY bullet under "session-close test HERMES_HOME isolation fix" (AC: 5)
- [x] **T9** Commit when operator requests (repo policy)

## Dev Notes

### Root cause (read first)

```9:31:scripts/session-close/lib/load-session-close-env.mjs
function resolveHermesHome(env) {
  const explicit = env.HERMES_HOME;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }
  // ... infers from HOME when profile-isolated ...
}

export function defaultSessionCloseEnvPath(env = process.env) {
  const hermesHome = resolveHermesHome(env);
  if (hermesHome) {
    return join(hermesHome, "session-close.env");
  }
  return join(homedir(), ".hermes", "session-close.env");
}
```

Hermes gateway sets `HERMES_HOME=/home/christ/.hermes`. Tests that only swap `HOME` still read the operator's real `session-close.env`. **Every** isolation block must delete `HERMES_HOME` for the test body.

### Pattern A — smart routing / routing report (today's `withIsolatedEnv`)

Both files define **identical** local helpers:

```43:70:tests/notebook-routing-report.test.mjs
async function withIsolatedEnv(smartRoutingValue, fn) {
  const priorHome = process.env.HOME;
  const priorHermesHome = process.env.HERMES_HOME;
  const priorIds = process.env.NOTEBOOKLM_NOTEBOOK_IDS;
  const priorFlag = process.env.NOTEBOOK_SMART_ROUTING;
  const fakeHome = await mktmp("routing-report-home-");
  try {
    process.env.HOME = fakeHome;
    delete process.env.HERMES_HOME;
    delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
    // smartRoutingValue null → delete NOTEBOOK_SMART_ROUTING, else set
    await fn();
  } finally {
    restoreEnv("HOME", priorHome);
    restoreEnv("HERMES_HOME", priorHermesHome);
    restoreEnv("NOTEBOOKLM_NOTEBOOK_IDS", priorIds);
    restoreEnv("NOTEBOOK_SMART_ROUTING", priorFlag);
    await rm(fakeHome, { recursive: true, force: true });
  }
}
```

`smart-routing.test.mjs` uses prefix `sr-home-` instead of `routing-report-home-` — preserve distinct prefixes when using `tmpdir.prefix`.

**Migration:** `import { withSmartRoutingIsolatedEnv } from "./helpers/hermes-env-isolation.mjs"` (or call `withSessionCloseEnvIsolation` with equivalent `saveKeys` / `apply` / `tmpdir`).

**`"env IDs win over smart routing"`** (smart-routing ~372–402): same keys as Pattern A but also sets `NOTEBOOKLM_NOTEBOOK_IDS` and `NOTEBOOK_SMART_ROUTING=1` before assertions — express via `apply: { NOTEBOOK_SMART_ROUTING: "1", NOTEBOOKLM_NOTEBOOK_IDS: envId }` plus `tmpdir`.

### Pattern B — session-close-pipeline (three tests)

Uses manual `if (oldX === undefined) delete else assign` instead of `restoreEnv` — helper must produce **identical** restore semantics.

| Test name (approx.) | Keys saved | Keys cleared at start | HOME |
|---------------------|------------|------------------------|------|
| reads NotebookLM env file targets… | HOME, NOTEBOOKLM_NOTEBOOK_IDS, NOTEBOOKLM_DRIVE_DOC_ID, HERMES_HOME | same three + HERMES_HOME | `mkdtemp` `session-close-home-` + writes `~/.hermes/session-close.env` under it |
| uses watch:true registry entries… | same | same | separate `home` + `dir` temps — only env keys go through helper; test still owns `dir` lifecycle |
| falls back to project map… | same | same | same |

Example mapping for first test:

```javascript
await withSessionCloseEnvIsolation(
  {
    saveKeys: ["NOTEBOOKLM_NOTEBOOK_IDS", "NOTEBOOKLM_DRIVE_DOC_ID"],
    apply: {
      NOTEBOOKLM_NOTEBOOK_IDS: null,
      NOTEBOOKLM_DRIVE_DOC_ID: null,
    },
    tmpdir: { prefix: "session-close-home-" },
  },
  async () => {
    const home = process.env.HOME; // set by helper
    await mkdir(join(home, ".hermes"), { recursive: true });
    // ... rest unchanged
  },
);
```

**Do not** fold unrelated temp dirs (`notebook-registry-fanout-`) into the helper — tests keep creating and `rm` their own fixture dirs.

### Suggested helper implementation sketch

```javascript
// tests/helpers/hermes-env-isolation.mjs
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function restoreEnv(key, prior) {
  if (prior === undefined) delete process.env[key];
  else process.env[key] = prior;
}

export async function withSessionCloseEnvIsolation(opts, fn) {
  const saveKeys = ["HOME", "HERMES_HOME", ...(opts.saveKeys ?? [])];
  const prior = Object.fromEntries(saveKeys.map((k) => [k, process.env[k]]));
  let tmpHome;
  try {
    delete process.env.HERMES_HOME;
    if (opts.tmpdir) {
      tmpHome = await mkdtemp(join(tmpdir(), opts.tmpdir.prefix));
      process.env.HOME = tmpHome;
    } else if (opts.home) {
      process.env.HOME = opts.home;
    }
    for (const [key, value] of Object.entries(opts.apply ?? {})) {
      if (value === null || value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fn();
  } finally {
    for (const key of saveKeys) restoreEnv(key, prior[key]);
    if (tmpHome) await rm(tmpHome, { recursive: true, force: true });
  }
}
```

Adjust ordering only if a test required a specific sequence — **default:** delete `HERMES_HOME` before applying `apply` and setting `HOME`.

### Import path

Tests live in `tests/*.test.mjs`. Use:

```javascript
import { withSessionCloseEnvIsolation, restoreEnv } from "./helpers/hermes-env-isolation.mjs";
```

Node 20+ native test runner resolves relative ESM imports from `tests/` — no `package.json` export map required.

### Testing

| Command | Expect |
|---------|--------|
| `npm run test:node` | All `tests/*.test.mjs` green |
| `npm test` | node + vitest |
| `bash scripts/verify.sh` | exit 0 |

Focused runs during dev:

```bash
node --test tests/notebook-routing-report.test.mjs tests/smart-routing.test.mjs tests/session-close-pipeline.test.mjs
```

### Architecture compliance

- **Spec-first:** No vault contract / MCP / WriteGate changes.
- **Security:** No operator approval needed — test-only refactor.
- **Constitution / AGENTS.md:** No edits.

### Previous story intelligence

| Story | Learning |
|-------|----------|
| **59-2** | False `failure_class: tests` traced to env leakage, not Vitest regex alone |
| **59-3** | `HERMES_HOME` + profile `HOME` isolation — production `operator-home.mjs` unchanged |
| **60-1** | Epic 60 started with Hermes mirror parity; 60-2 is independent test hygiene — do not mix skill mirror edits |
| **spec-session-close-test-hermes-home-isolation.md** | Review order lists exact line ranges; use as regression checklist |
| **deferred-work.md:707–709** | Explicit deferral of this DRY extract — close in T8 |

### Git intelligence

Recent: `b17a9e3` (60-1 morning-digest parity). Test files with HERMES_HOME blocks are stable since 59-2/59-3 — refactor should be a small, reviewable diff.

## Project Context Reference

- [Source: `_bmad-output/implementation-artifacts/spec-session-close-test-hermes-home-isolation.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — session-close test HERMES_HOME isolation fix]
- [Source: `scripts/session-close/lib/load-session-close-env.mjs`]
- [Source: `package.json` — `test:node`: `node --test tests/*.test.mjs`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

_(none)_

### Completion Notes List

- Added `tests/helpers/hermes-env-isolation.mjs` with `restoreEnv`, `withSessionCloseEnvIsolation`, and `withSmartRoutingIsolatedEnv` (optional `prefix` for distinct tmpdir names).
- Migrated three test files; `notebook-routing-report` uses a one-line `withRoutingReportEnv` alias for `routing-report-home-` prefix.
- Grep guard: no `oldHermesHome` / `priorHermesHome` in migrated files.
- `npm run test:node` (456 pass), `npm test` (642 vitest + node), `bash scripts/verify.sh` — all exit 0.
- Marked deferred-work DRY bullet resolved.

### File List

- `tests/helpers/hermes-env-isolation.mjs` (new)
- `tests/notebook-routing-report.test.mjs`
- `tests/smart-routing.test.mjs`
- `tests/session-close-pipeline.test.mjs`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-06-04: Story 60-2 created — DRY shared test env isolation helper; closes deferred-work from HERMES_HOME test fix.
- 2026-06-04: Implemented shared helper and migrated three test files; verify gate green; status → review.
- 2026-06-04: Code review — clean (0 patch, 0 decision-needed); status → done.

### Review Findings

- [x] [Review][Defer] No dedicated unit tests for `tests/helpers/hermes-env-isolation.mjs` — deferred, pre-existing pattern (integration coverage via three migrated suites is sufficient for this story scope).
