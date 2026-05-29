---
baseline_commit: 5128271c95694891fe384781a6f453b120e829f9
---

# Story 50.7: Session-close notebook routing report

Status: done

Epic: **50** (NotebookLM Full Integration)
Tracked in sprint-status as: **`50-7-notebook-routing-report`**

**Operator intent:** After session-close completes its NotebookLM fan-out, inject a compact "notebook routing report" block into the Discord close summary. Show which notebooks were targeted, which routing method resolved them (`env-override` / `watch-flag` / `smart-route` / `project-map` / `empty`), and the disambiguator `reason` when `smart-route` fired. Maximum 3 lines in Discord — scannable, not verbose. Scope: session-close scripts (`read-sources.mjs`, `prepare-context.mjs`, `run-deterministic.mjs`) and the Hermes `discord-reply-template.md`. No dashboard changes, no AGENTS.md changes, no MCP tool changes.

## Story

As an **operator**,  
I want **the Discord session-close summary to include a compact notebook routing report**,  
so that **I can instantly confirm which notebooks were targeted and by which routing method — without reading logs**.

## Acceptance Criteria

1. **Routing metadata captured (AC: capture)**  
   **Given** `readNotebookLmTargets` resolves targets via any method  
   **When** `prepare-context.mjs` calls `readNotebookLmTargetsWithMeta` (new export)  
   **Then** `pack.notebooklm_routing` contains:
   - `method`: one of `'env-override' | 'watch-flag' | 'smart-route' | 'project-map' | 'empty'`
   - `notebooks`: `{ id: string; title: string }[]` — one entry per resolved target
   - `reason`: string (only present when method is `'smart-route'` and disambiguator returned a reason; absent/undefined otherwise)

2. **Routing metadata in close-report (AC: report)**  
   **When** `buildCloseReport` constructs the close report  
   **Then** `close-report.json` includes `notebooklm_routing` with the `NotebookRoutingMeta` shape  
   **And** the field is `null` when routing metadata is unavailable (pipeline failure path)

3. **Discord routing block (AC: discord)**  
   **When** Hermes renders the Discord close summary from `close-report.json`  
   **Then** a compact `### Notebook routing` block appears in the summary with **at most 3 lines**:
   - Line 1: `**method:**` — one of the 5 method labels
   - Line 2: `**targets:**` — comma-joined notebook titles; truncate beyond 2 with `+ N more`
   - Line 3: `**reason:**` — only rendered when method is `smart-route` and `routing.reason` is a non-empty string  
   **And** the block is gracefully omitted when `notebooklm_routing` is `null` or absent from the report

4. **Backward compatibility (AC: compat)**  
   **Given** existing callers and tests use `readNotebookLmTargets(vaultRoot, exportPath, options)`  
   **When** the story is implemented  
   **Then** `readNotebookLmTargets` return type remains `unknown[]` — unchanged  
   **And** all existing tests in `tests/smart-routing.test.mjs` pass without modification

5. **Tests (AC: tests)**  
   **Then** `tests/notebook-routing-report.test.mjs` uses `node:test` + `node:assert/strict`, fixtures only (no live `nlm`, no network)  
   **And** covers:
   - `readNotebookLmTargetsWithMeta` returns `{ targets, routing }` for each method:
     - `env-override`: `routing.method === 'env-override'`; `routing.notebooks` contains IDs; no `reason`
     - `watch-flag`: `routing.method === 'watch-flag'`; `routing.notebooks` matches watched registry entries
     - `smart-route` (ROUTED): `routing.method === 'smart-route'`; `routing.reason` matches disambiguator `route.reason`
     - `project-map`: `routing.method === 'project-map'`; `routing.notebooks` contains parsed IDs
     - `empty`: `routing.method === 'empty'`; `routing.notebooks` is `[]`
   - `readNotebookLmTargets` still returns a plain `unknown[]` (backward compat guard)
   - `buildCloseReport` includes `notebooklm_routing` when passed in input; `null` when omitted
   - `bash scripts/verify.sh` passes

6. **Scope boundaries (AC: non-goals)**  
   **Then** this story does **not**:
   - Change `readNotebookLmTargets` return type or call signatures
   - Touch cns-dashboard (`../cns-dashboard`)
   - Add any MCP tool changes or vault IO mutations
   - Change `AGENTS.md` or any `AI-Context/` files
   - Change `scoreNotebooks`, `disambiguateRoute`, or any routing decision logic (observation only)
   - Run or modify `sync-notebooks` / registry sync

## Tasks / Subtasks

- [x] Modify `smartRoute` in `read-sources.mjs` to return `{ targets: unknown[], reason: string | undefined } | null` (AC: capture)
- [x] Add `readNotebookLmTargetsWithMeta(vaultRoot, exportPath, options)` exported function returning `{ targets: unknown[], routing: NotebookRoutingMeta }` (AC: capture)
  - [x] Refactor `readNotebookLmTargets` to delegate: `const { targets } = await readNotebookLmTargetsWithMeta(...); return targets;` (AC: compat)
- [x] Update `prepare-context.mjs`: call `readNotebookLmTargetsWithMeta`; store `notebooklm_routing` in pack alongside `notebooklm_targets` (AC: capture)
- [x] Update `run-deterministic.mjs` `buildCloseReport` JSDoc + return object: add `notebooklm_routing` field; propagate from pack in `runDeterministicPipeline`; `null` in pipeline-failure path (AC: report)
- [x] Update `~/.hermes/skills/cns/session-close/references/discord-reply-template.md` with `### Notebook routing` block (AC: discord); bump `version` in `~/.hermes/skills/cns/session-close/SKILL.md` to `1.0.5`
- [x] Add `tests/notebook-routing-report.test.mjs` (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: tests)

### Review Findings

- [x] [Review][Patch] Keep `notebooklm_routing.notebooks` synchronized when token-budget pruning shortens or removes `notebooklm_targets` [`scripts/session-close/lib/token-estimate.mjs`:132]

## Dev Notes

### Typedef — NotebookRoutingMeta

Add as a JSDoc typedef in `read-sources.mjs` (no runtime overhead):

```js
/**
 * @typedef {'env-override' | 'watch-flag' | 'smart-route' | 'project-map' | 'empty'} RoutingMethod
 * @typedef {{ method: RoutingMethod; notebooks: { id: string; title: string }[]; reason?: string }} NotebookRoutingMeta
 */
```

### Step 1 — Modify `smartRoute` (internal, non-exported)

**Current return type:** `unknown[] | null`  
**New return type:** `{ targets: unknown[]; reason: string | undefined } | null`

```js
function smartRoute(registry, exportPath, contextPack) {
  try {
    const topic = extractScoringTopic(contextPack);
    const scoreResult = scoreNotebooks(topic, registry);
    const route = disambiguateRoute(scoreResult, registry);
    if (route.status === "ROUTED") {
      process.stderr.write(
        `[smart-routing] ROUTED → ${route.title} (${route.id}) via ${route.reason ?? "unknown"}\n`,
      );
      return {
        targets: [
          {
            notebook_id: route.id,
            title: route.title,
            source_name: "CNS Vault Export",
            source_type: "file",
            file_path: exportPath,
          },
        ],
        reason: route.reason,
      };
    }
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[smart-routing] error: ${message}\n`);
    return null;
  }
}
```

**Impact on existing callers:** The only caller is `readNotebookLmTargets` (which will become a thin wrapper over `readNotebookLmTargetsWithMeta`). The internal call site changes from `const routed = smartRoute(...); if (routed) return routed;` to `const sr = smartRoute(...); if (sr) return { targets: sr.targets, routing: ... };`. No exported interface changes; all existing tests pass.

### Step 2 — Add `readNotebookLmTargetsWithMeta` and refactor `readNotebookLmTargets`

**Pattern:** Extract all resolution logic into `readNotebookLmTargetsWithMeta`; make `readNotebookLmTargets` a one-liner wrapper.

```js
/**
 * @param {string} vaultRoot
 * @param {string} exportPath
 * @param {{ registryPath?: string, contextPack?: unknown }} [options]
 * @returns {Promise<{ targets: unknown[]; routing: NotebookRoutingMeta }>}
 */
export async function readNotebookLmTargetsWithMeta(vaultRoot, exportPath, options = {}) {
  // Step 1 — env override (process.env or session-close.env file)
  let notebookIds = typeof process.env.NOTEBOOKLM_NOTEBOOK_IDS === "string"
    ? process.env.NOTEBOOKLM_NOTEBOOK_IDS : "";
  if (!notebookIds.trim()) {
    // ... (same env-file read logic as current readNotebookLmTargets) ...
  }
  if (notebookIds.trim()) {
    const ids = notebookIds.split(",").map(id => id.trim()).filter(id => id.length > 0);
    if (ids.length > 0) {
      const targets = ids.map(notebook_id => ({ notebook_id, source_name: "CNS Vault Export", source_type: "file", file_path: exportPath }));
      return {
        targets,
        routing: { method: "env-override", notebooks: ids.map(id => ({ id, title: id })) },
      };
    }
  }

  // Step 2 — watch-flag registry
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY_PATH;
  let registry = [];
  try {
    registry = await readRegistry(registryPath);
    const fromRegistry = notebookTargetsFromWatchRegistry(registry, exportPath);
    if (fromRegistry) {
      return {
        targets: fromRegistry,
        routing: {
          method: "watch-flag",
          notebooks: fromRegistry.map(t => ({ id: t.notebook_id, title: t.title ?? t.notebook_id })),
        },
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notebooklm-router] registry read failed:", message);
  }

  // Step 3 — smart routing
  const smartRoutingEnv = process.env.NOTEBOOK_SMART_ROUTING ?? "";
  if (isTruthy(smartRoutingEnv)) {
    const sr = smartRoute(registry, exportPath, options.contextPack);
    if (sr) {
      return {
        targets: sr.targets,
        routing: {
          method: "smart-route",
          notebooks: sr.targets.map(t => ({ id: t.notebook_id, title: t.title ?? t.notebook_id })),
          ...(sr.reason !== undefined ? { reason: sr.reason } : {}),
        },
      };
    }
  }

  // Step 4 — project-map
  for (const rel of PROJECT_MAP_CANDIDATES) {
    // ... (same project-map parse logic) ...
    if (targets.length > 0) {
      return {
        targets,
        routing: {
          method: "project-map",
          notebooks: targets.map(t => ({ id: t.notebook_id, title: t.title ?? t.notebook_id })),
        },
      };
    }
  }

  // Step 5 — empty
  return { targets: [], routing: { method: "empty", notebooks: [] } };
}

/**
 * Backward-compat wrapper — return type unchanged (unknown[]).
 * @param {string} vaultRoot
 * @param {string} exportPath
 * @param {{ registryPath?: string, contextPack?: unknown }} [options]
 * @returns {Promise<unknown[]>}
 */
export async function readNotebookLmTargets(vaultRoot, exportPath, options = {}) {
  const { targets } = await readNotebookLmTargetsWithMeta(vaultRoot, exportPath, options);
  return targets;
}
```

**Key detail — `env-override` title fallback:** Env-ID targets don't have titles (pre-existing shape from Story 50-1 era). Use the raw notebook ID as the title when no title is available. This is consistent with the pre-existing deferred item noted in 50-5 review.

**Key detail — `reason` field spreading:** Use `...(sr.reason !== undefined ? { reason: sr.reason } : {})` so that `reason` is truly absent (not `undefined`) in the routing object for non-smart-route methods. This keeps the JSON serialization clean.

### Step 3 — `prepare-context.mjs` update

Change the `readNotebookLmTargets` import to also import `readNotebookLmTargetsWithMeta`:

```js
import {
  // ...existing imports...
  readNotebookLmTargetsWithMeta,
} from "./lib/read-sources.mjs";
```

Replace the call in `buildContextPack`:
```js
// Before:
const notebooklm_targets = await readNotebookLmTargets(paths.vaultRoot, exportPath, {
  contextPack: { sprint, recent_stories },
});

// After:
const { targets: notebooklm_targets, routing: notebooklm_routing } =
  await readNotebookLmTargetsWithMeta(paths.vaultRoot, exportPath, {
    contextPack: { sprint, recent_stories },
  });
```

Add `notebooklm_routing` to the pack object (after `notebooklm_targets`):
```js
const pack = {
  // ...existing fields...
  notebooklm_targets,
  notebooklm_routing,   // NEW — NotebookRoutingMeta
  // ...
};
```

No changes to `enforceTokenBudget` needed — the routing meta is small and won't affect budget.

### Step 4 — `run-deterministic.mjs` update

**Update `buildCloseReport` JSDoc input shape:**
```js
/**
 * @param {{
 *   mode: string;
 *   repoRoot: string;
 *   vaultRoot: string;
 *   contextPackPath: string;
 *   steps: Record<string, { status: string; message?: string }>;
 *   failureClass: string | null;
 *   deterministic: Record<string, unknown>;
 *   notebooklm_targets: unknown[];
 *   notebooklm_routing?: import('./lib/read-sources.mjs').NotebookRoutingMeta | null;
 *   memory_preview?: string | null;
 *   daily_rhythm_preview?: Record<string, string> | null;
 * }} input
 */
export function buildCloseReport(input) {
  return {
    // ...existing fields...
    notebooklm_targets: input.notebooklm_targets,
    notebooklm_routing: input.notebooklm_routing ?? null,   // NEW
    // ...
  };
}
```

**In `runDeterministicPipeline`** (the happy path `buildCloseReport` call near line 405):
```js
const reportTargets = enrichNotebooklmTargets(pack);
const report = buildCloseReport({
  // ...existing fields...
  notebooklm_targets: reportTargets,
  notebooklm_routing: pack.notebooklm_routing ?? null,   // NEW
  // ...
});
```

**In the pipeline failure path** (the early-return `buildCloseReport` call near line 252):
```js
const pipelineFailureReport = buildCloseReport({
  // ...existing fields...
  notebooklm_targets: enrichNotebooklmTargets(pack),
  notebooklm_routing: null,   // NEW — no routing info on failure
  // ...
});
```

### Step 5 — Discord reply template update

File: `~/.hermes/skills/cns/session-close/references/discord-reply-template.md`

Add a `### Notebook routing` section after `### NotebookLM targets`. The Hermes agent renders this from `close-report.json`. Template instructions (not a template engine — the LLM reads the instructions):

```markdown
### Notebook routing

(derive from `notebooklm_routing` in close-report.json; omit this block entirely if the field is null or absent)
- **method:** {{routing_method}}
- **targets:** {{comma-joined titles from routing.notebooks; if >2, show first 2 + "+" N more"}}
- **reason:** {{routing.reason}} — only render this line when method is "smart-route" and reason is a non-empty string

Max 3 lines. Do not expand IDs or titles beyond what is in the field.
```

**Version bump required:** After updating the template, also bump `version` in `~/.hermes/skills/cns/session-close/SKILL.md` from `1.0.4` → `1.0.5` and reinstall the skill.

### Step 6 — Test file: `tests/notebook-routing-report.test.mjs`

Use the same test infrastructure as `tests/smart-routing.test.mjs`: `node:test` + `node:assert/strict`, `withIsolatedEnv` helper, temp registry fixtures, temp vault with project-map.

```js
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  readNotebookLmTargets,
  readNotebookLmTargetsWithMeta,
} from "../scripts/session-close/lib/read-sources.mjs";
import { buildCloseReport } from "../scripts/session-close/run-deterministic.mjs";
```

**Test cases to cover:**

| Test | Setup | Assert on `routing` |
|------|-------|---------------------|
| env-override | `NOTEBOOKLM_NOTEBOOK_IDS=abc-123` | `method === 'env-override'`, `notebooks[0].id === 'abc-123'`, no `reason` |
| watch-flag | registry with `watch: true` entry | `method === 'watch-flag'`, `notebooks[0].title` matches entry title |
| smart-route ROUTED | `NOTEBOOK_SMART_ROUTING=1`, registry+contextPack that produces ROUTED | `method === 'smart-route'`, `reason` present |
| smart-route NO_ROUTE → falls to project-map | `NOTEBOOK_SMART_ROUTING=1`, context doesn't match, vault has project-map | `method === 'project-map'` |
| project-map only | no env, no watch, `NOTEBOOK_SMART_ROUTING` unset, vault has project-map UUID | `method === 'project-map'`, `notebooks[0].id` is UUID |
| empty | no env, no watch, no smart, no project-map | `method === 'empty'`, `notebooks` is `[]` |
| backward compat | call `readNotebookLmTargets` (old API) | returns `Array` directly (not `{ targets, routing }`) |
| `buildCloseReport` includes routing | pass `notebooklm_routing: { method: 'watch-flag', notebooks: [] }` | report has `notebooklm_routing.method === 'watch-flag'` |
| `buildCloseReport` nulls routing when omitted | pass no `notebooklm_routing` | report has `notebooklm_routing === null` |

Use the same `withIsolatedEnv` helper from `smart-routing.test.mjs` — copy it into this test file (don't import across test files; no shared test helpers module exists in this project).

### Project structure

| Path | Action |
|------|--------|
| `scripts/session-close/lib/read-sources.mjs` | MODIFY — add `NotebookRoutingMeta` typedef; change `smartRoute` return type; add `readNotebookLmTargetsWithMeta`; refactor `readNotebookLmTargets` as wrapper |
| `scripts/session-close/prepare-context.mjs` | MODIFY — import `readNotebookLmTargetsWithMeta`; destructure call; add `notebooklm_routing` to pack |
| `scripts/session-close/run-deterministic.mjs` | MODIFY — update `buildCloseReport` JSDoc + return; propagate `notebooklm_routing` from pack in both call sites |
| `~/.hermes/skills/cns/session-close/references/discord-reply-template.md` | MODIFY — add `### Notebook routing` block (3-line max instructions) |
| `~/.hermes/skills/cns/session-close/SKILL.md` | MODIFY — bump `version: 1.0.4` → `1.0.5` |
| `tests/notebook-routing-report.test.mjs` | NEW |

### Architecture compliance

- **Spec-first:** No `specs/cns-vault-contract/` changes — routing report is operator tooling, not vault contract
- **Verify gate:** `bash scripts/verify.sh` mandatory before done
- **WriteGate:** N/A — no AI-Context writes
- **Security:** No secrets; routing meta contains only notebook IDs/titles + method label

### Previous story intelligence (50-5 smart-routing)

- `smartRoute` currently returns `unknown[] | null` — changing to `{ targets, reason } | null` is safe because it is not exported
- `route.reason` from `disambiguateRoute` can be `undefined` — the 50-5 review patched the `via undefined` log; guard in routing meta using conditional spread
- Pre-existing deferred: env-ID targets lack `title` field — use the raw `notebook_id` string as title fallback; this is safe and consistent with the deferred item
- Test isolation pattern: use `withIsolatedEnv(flagValue, fn)` exactly as in `smart-routing.test.mjs`; isolate `HOME`, `NOTEBOOKLM_NOTEBOOK_IDS`, `NOTEBOOK_SMART_ROUTING`

### `disambiguateRoute` reason contract (from 50-4)

`disambiguateRoute(scoreResult, registry)` returns `{ status: 'ROUTED' | 'NO_ROUTE', id?, title?, reason? }`.  
When `status === 'ROUTED'`, `reason` is a short string like `'top-domain-match'`, `'only-match'`, etc.  
It can be `undefined` (deferred 50-4 contract concern) — the conditional spread handles this safely.

## References

- [Source: `scripts/session-close/lib/read-sources.mjs` — `readNotebookLmTargets`, `smartRoute`, `notebookTargetsFromWatchRegistry`]
- [Source: `scripts/session-close/prepare-context.mjs` — `buildContextPack`, pack shape]
- [Source: `scripts/session-close/run-deterministic.mjs` — `buildCloseReport`, `runDeterministicPipeline`, failure path]
- [Source: `~/.hermes/skills/cns/session-close/references/discord-reply-template.md` — current template]
- [Source: `~/.hermes/skills/cns/session-close/SKILL.md` — version field]
- [Source: `tests/smart-routing.test.mjs` — `withIsolatedEnv` helper, test fixture patterns]
- [Source: `50-5-smart-routing.md` — `smartRoute` implementation, deferred review items]
- [Source: `50-4-disambiguation.md` — `disambiguateRoute` return contract, `reason` field]

## Dev Agent Record

### Agent Model Used

GPT-5.5

### Debug Log References

- Baseline `npm test` passed before implementation.
- Red phase: `node --test tests/notebook-routing-report.test.mjs` failed because `readNotebookLmTargetsWithMeta` was not exported.
- Green/refactor: `node --test tests/notebook-routing-report.test.mjs` passed.
- Regression: `node --test tests/smart-routing.test.mjs` passed.
- Regression: `npm test` passed.
- DoD gate: `bash scripts/verify.sh` passed.
- Review patch: `node --test tests/notebook-routing-report.test.mjs` passed.
- Review patch DoD gate: `bash scripts/verify.sh` passed.

### Implementation Plan

- Preserve the existing `readNotebookLmTargets` caller contract by moving resolution logic into `readNotebookLmTargetsWithMeta` and keeping the legacy export as a wrapper.
- Capture routing metadata at each existing routing branch without changing scoring, disambiguation, registry sync, or target decision order.
- Thread `notebooklm_routing` from the context pack into `close-report.json`, with `null` used for unavailable pipeline-failure metadata.
- Update the mirrored and installed Hermes session-close skill template so the Discord renderer has instructions for the compact routing block.

### Completion Notes List

- Added `NotebookRoutingMeta` metadata for `env-override`, `watch-flag`, `smart-route`, `project-map`, and `empty` routing paths.
- Preserved backward compatibility: `readNotebookLmTargets` still returns a plain `unknown[]`.
- Added routing metadata to context packs and close reports, including `reason` only for smart-route results with a defined reason.
- Added node:test coverage for all routing methods, backward compatibility, and close-report routing serialization.
- Updated and reinstalled the Hermes `session-close` skill at version `1.0.5`.
- Review patch: synchronized `notebooklm_routing.notebooks` with pruned `notebooklm_targets` so the Discord routing block reflects the actual fan-out targets after token-budget enforcement.

### File List

- `_bmad-output/implementation-artifacts/50-7-notebook-routing-report.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `scripts/session-close/lib/read-sources.mjs`
- `scripts/session-close/prepare-context.mjs`
- `scripts/session-close/run-deterministic.mjs`
- `scripts/session-close/lib/token-estimate.mjs`
- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `scripts/hermes-skill-examples/session-close/references/discord-reply-template.md`
- `tests/notebook-routing-report.test.mjs`
- `/home/christ/.hermes/skills/cns/session-close/SKILL.md`
- `/home/christ/.hermes/skills/cns/session-close/references/discord-reply-template.md`

### Change Log

- 2026-05-30: Implemented notebook routing metadata capture and Discord routing report support; story moved to review after tests and verify passed.
