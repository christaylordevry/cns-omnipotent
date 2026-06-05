---
story_id: 61-2
epic: 61
title: fix-vault-context-notebook-title-routing
status: done
baseline_commit: e21545f1
operator_brief: 2026-06-05
predecessors: 52-1, 50-7, 56-1, 56-4, 61-1, 60-1
---

# Story 61.2: Fix vault context notebook title routing

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest in `#hermes`**,  
I want **Vault context signal scoring to use human-readable notebook titles instead of raw UUID strings**,  
so that **today's trend/headline/arXiv signals can F1-match watched notebooks and ROUTED Vault context appears instead of "no watched notebook matched."**

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 61: Morning digest enhancements (operator brief 2026-06-04/05) |
| **Predecessors** | **52-1** (Vault context + `pick-signal-notebook.mjs`); **50-7** (`notebooklm_routing` metadata); **56-1** (soft-route floor); **56-4** (`DIGEST_SOURCES_JSON` / multi-source signals); **61-1** (arXiv source, SKILL v1.2.5); **60-1** (morning-digest mirror parity) |
| **Problem** | Live digests show `- (source unavailable: no watched notebook matched today's signals)` despite meaningful trend/headline overlap with operator notebooks. |
| **Root cause** | When `NOTEBOOKLM_NOTEBOOK_IDS` is set, session-close `readNotebookLmTargetsWithMeta` stores routing notebooks as `{ id, title: id }` (UUID duplicated as title). Morning digest `pick-signal-notebook.mjs` scores signals via F1 token overlap against **notebook titles** (`notebook-scorer.mjs` → `tokenizeForScoring(entry.title)`). UUID titles tokenize to hex fragments that never overlap keywords like `CNS`, `vault`, or `AI Factory`. |
| **Fix** | Operator config map `NOTEBOOKLM_NOTEBOOK_TITLES` in `~/.hermes/trend-ingest.env`; `pick-signal-notebook.mjs` loads it at runtime and overlays human-readable titles onto registry/routing rows **before** `pickSignalNotebook` / `resolveNotebookRoute` runs. Unmapped IDs keep existing title (safe degradation → UUID if that was the title). |
| **Parity** | `morning-digest` is in `parity_skills` — after edits run `bash scripts/install-hermes-skill-morning-digest.sh` and confirm verify gate clean |
| **Out of scope** | Changing `notebook-scorer.mjs` thresholds; session-close `read-sources.mjs` routing metadata (optional follow-up); Convex/dashboard; new npm dependencies; fixing `notebook-registry.json` sync |

### Operator brief (binding)

1. Add config map `NOTEBOOKLM_NOTEBOOK_TITLES` in `trend-ingest.env`:
   `NOTEBOOKLM_NOTEBOOK_TITLES=981466f0:CNS Vault Architecture,dc6abf1a:AI Factory Blueprint,f037c741:Nexus Discord Bridge`
2. `pick-signal-notebook.mjs` reads `NOTEBOOKLM_NOTEBOOK_TITLES` at runtime and overlays human-readable names onto routing/registry entries before signal scoring.
3. Falls back to existing title (UUID if unmapped) — safe degradation.
4. Document in `references/config-snippet.md`.
5. Bump `SKILL.md` to **v1.2.6**.
6. Tests cover title overlay logic and fallback.
7. `npm test` green, `bash scripts/verify.sh` green.

## Acceptance Criteria

### 1. Title map parser (AC: parser)

**Given** env string `NOTEBOOKLM_NOTEBOOK_TITLES=981466f0:CNS Vault Architecture,dc6abf1a:AI Factory Blueprint,f037c741:Nexus Discord Bridge`  
**When** the parser runs (exported helper from `pick-signal-notebook.mjs`)  
**Then** it returns a `Map` (or equivalent) with keys `981466f0`, `dc6abf1a`, `f037c741` and corresponding title values  
**And** splits on commas between entries and on the **first** colon per entry only (titles may contain spaces; no colons expected in titles)  
**And** empty/unset env → empty map (no throw)  
**And** malformed segments (no colon, empty prefix/title) are skipped without failing the whole map.

### 2. Title overlay before scoring (AC: overlay)

**Given** a watched registry row `{ id: '981466f0-de1c-4551-93a9-f3bc2a24b184', title: '981466f0-de1c-4551-93a9-f3bc2a24b184', watch: true, ... }` or `{ ..., title: '981466f0-de1c-4551-93a9-f3bc2a24b184' }`  
**And** title map contains prefix `981466f0` → `CNS Vault Architecture`  
**When** overlay runs then `pickSignalNotebook(['CNS vault architecture roadmap'], rows)`  
**Then** `route.status === 'ROUTED'` with `route.id` matching the full UUID  
**And** `route.title === 'CNS Vault Architecture'`.

**Given** a row whose `id` has **no** matching prefix in the map  
**When** overlay runs  
**Then** the row's `title` is unchanged (fallback).

**Prefix match rule:** map key matches when `entry.id === key` OR `entry.id.startsWith(key + '-')` OR `entry.id.startsWith(key)` (support 8-char shorthand and full UUID keys).

### 3. Env loading (AC: env)

**Given** operator file `~/.hermes/trend-ingest.env` contains `NOTEBOOKLM_NOTEBOOK_TITLES=...`  
**When** `pick-signal-notebook.mjs` main path runs  
**Then** it merges file env the same way as `fetch-arxiv-rss.mjs` (`mergeTrendIngestEnv` / `parseEnvFile` pattern — **reuse** exported helpers from `fetch-arxiv-rss.mjs` rather than duplicating parse logic)  
**And** process.env values override file values (file first, then spread `process.env` on top)  
**And** does **not** echo secrets or env file contents to stdout.

### 4. CLI contract unchanged (AC: contract)

**Given** overlay applied in main module before `pickSignalNotebook`  
**When** CLI runs with `DIGEST_SOURCES_JSON` or legacy `SIGNALS_JSON`  
**Then** stdout shape is unchanged: `{ route, winning_signal, winning_score, elapsed_ms }`  
**And** ROUTED responses still include `route.domain` from registry entry  
**And** exit codes unchanged (2 registry, 1 routing).

### 5. Operator docs + skill version (AC: docs)

**Given** `references/config-snippet.md`  
**When** operator reads morning-digest config  
**Then** a **NotebookLM title map** section documents `NOTEBOOKLM_NOTEBOOK_TITLES` with the three production prefix examples and notes that prefixes are the first 8 hex chars of notebook UUIDs  
**And** documents load order: `$HOME/.hermes/trend-ingest.env` then process env override  
**And** `SKILL.md` frontmatter `version` is **1.2.6** (no task-prompt source renumbering required unless overlay pitfall warrants one line in Source 5 — optional).

### 6. Tests and verify gate (AC: tests)

**Then** `tests/morning-digest-pick-signal-notebook.test.mjs` includes:

| Case | Assert |
|------|--------|
| `parseNotebookTitleMap` happy path | three entries parsed |
| Overlay + ROUTED | UUID-title registry + map → ROUTED with human title |
| Fallback | unmapped prefix keeps UUID title; scoring still runs (may NO_ROUTE) |
| CLI integration (optional) | env `NOTEBOOKLM_NOTEBOOK_TITLES` + fixture registry path → ROUTED stdout |

**And** `npm test` passes  
**And** `bash scripts/verify.sh` passes (includes hermes skill parity gate).

## Tasks / Subtasks

- [x] **T1** Export `parseNotebookTitleMap(raw)` + `applyNotebookTitleOverlay(rows, map)` from `pick-signal-notebook.mjs` (AC: 1, 2)
- [x] **T2** Wire main module: `mergeTrendIngestEnv` → read map → overlay watched registry rows before `pickSignalNotebook` (AC: 2, 3, 4)
- [x] **T3** Update `references/config-snippet.md` with `NOTEBOOKLM_NOTEBOOK_TITLES` (AC: 5)
- [x] **T4** Bump `SKILL.md` to v1.2.6; optional Pitfalls line about title map when env IDs used (AC: 5)
- [x] **T5** Extend `tests/morning-digest-pick-signal-notebook.test.mjs` (AC: 6)
- [x] **T6** Run `bash scripts/install-hermes-skill-morning-digest.sh`; `npm test`; `bash scripts/verify.sh` (AC: 6)

### Review Findings

- [x] [Review][Patch] AC1 test missing colon-in-title fixture [`tests/morning-digest-pick-signal-notebook.test.mjs:64`] — added `preserves colons after the first delimiter in title values` test.
- [x] [Review][Patch] AC5 config-snippet test asserts only 1 of 3 production examples [`tests/hermes-morning-digest-skill.test.mjs:354`] — now asserts all three production prefix:title pairs.
- [x] [Review][Defer] Comma inside notebook title silently truncates map [`pick-signal-notebook.mjs:225`] — deferred, comma-delimited format is spec-bound; titles with commas not supported.
- [x] [Review][Defer] Duplicate prefix key silently overwrites prior entry [`pick-signal-notebook.mjs:233`] — deferred, operator config error; production map has unique prefixes.
- [x] [Review][Defer] Shorter prefix shadows longer prefix by insertion order [`pick-signal-notebook.mjs:252`] — deferred, production uses non-overlapping 8-char hex prefixes only.
- [x] [Review][Defer] Two registry rows sharing prefix get identical overlay title [`pick-signal-notebook.mjs:248`] — deferred, UUID prefix uniqueness in production registry.
- [x] [Review][Defer] mergeTrendIngestEnv EPERM/parse errors swallowed silently [`fetch-arxiv-rss.mjs:174`] — deferred, pre-existing 61-1 pattern; no stderr on unreadable trend-ingest.env.
- [x] [Review][Defer] CNS_NOTEBOOK_REGISTRY_PATH in trend-ingest.env ignored by CLI [`pick-signal-notebook.mjs:391`] — deferred, pre-existing asymmetry; parseRegistryPath runs before merge; out of 61-2 scope.
- [x] [Review][Defer] Unbalanced quotes in parseEnvFile corrupt prefix match [`fetch-arxiv-rss.mjs:131`] — deferred, pre-existing env parser; overlay silently no-ops.
- [x] [Review][Defer] AC3 file-first CLI integration test absent [`tests/morning-digest-pick-signal-notebook.test.mjs`] — deferred, AC6 marks file-load CLI test optional; mergeTrendIngestEnv covered in 61-1.

## Dev Notes

### Root cause (read before coding)

Session-close env override path — **do not change in this story**, but understand it:

```359:361:scripts/session-close/lib/read-sources.mjs
          method: "env-override",
          notebooks: ids.map((id) => ({ id, title: id })),
        },
```

`notebooklm_routing.notebooks[].title` is the raw UUID. Morning digest does **not** read close-report routing today; it loads `notebook-registry.json` and filters `watch: true`. Production failure modes this story fixes:

1. **Registry drift** — watched rows synced with `title` equal to `id` or empty (scorer drops empty titles via `validRegistryRow`).
2. **Env-ID parity** — operator fan-out uses `NOTEBOOKLM_NOTEBOOK_IDS` from `session-close.env`; digest scoring must still tokenize **human** titles for those same three notebooks.
3. **Future-safe** — overlay runs on whatever title is on the row before F1; map is the operator-controlled SSOT for display titles when registry/routing metadata is UUID-only.

### Scoring dependency (read only)

```132:137:scripts/session-close/lib/notebook-scorer.mjs
function scoreAllEntries(queryTokens, rows) {
  /** @type {NotebookScoreMatch[]} */
  const ranked = [];
  for (const entry of rows) {
    const titleTokens = tokenizeForScoring(entry.title);
    const domainTokens = domainTokensForEntry(entry);
```

Domain tokens still apply after overlay; do not modify scorer.

### Reuse env merge from 61-1

```168:177:scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs
export async function mergeTrendIngestEnv(baseEnv) {
  const path = join(homedir(), '.hermes', 'trend-ingest.env');
  try {
    const content = await readFile(path, 'utf8');
    const fromFile = parseEnvFile(content);
    return { ...fromFile, ...baseEnv };
  } catch {
    return { ...baseEnv };
  }
}
```

Import `mergeTrendIngestEnv` in `pick-signal-notebook.mjs` (same skill scripts dir). Main is already async top-level — await merge before overlay.

### Suggested overlay implementation

```javascript
// Pseudocode — implement in pick-signal-notebook.mjs
export function parseNotebookTitleMap(raw) {
  const map = new Map();
  for (const segment of String(raw ?? '').split(',')) {
    const idx = segment.indexOf(':');
    if (idx <= 0) continue;
    const prefix = segment.slice(0, idx).trim();
    const title = segment.slice(idx + 1).trim();
    if (prefix && title) map.set(prefix, title);
  }
  return map;
}

export function applyNotebookTitleOverlay(rows, titleMap) {
  if (!titleMap.size) return rows;
  return rows.map((row) => {
    if (!row || typeof row.id !== 'string') return row;
    for (const [prefix, title] of titleMap) {
      if (row.id === prefix || row.id.startsWith(prefix + '-') || row.id.startsWith(prefix)) {
        return { ...row, title };
      }
    }
    return row;
  });
}
```

Apply to **all** registry rows loaded from file, then filter `watch === true` (existing behavior). Do not mutate the on-disk registry.

### Production title map (operator reference)

| Prefix | Full ID (registry) | Title |
|--------|-------------------|-------|
| `981466f0` | `981466f0-de1c-4551-93a9-f3bc2a24b184` | CNS Vault Architecture |
| `dc6abf1a` | `dc6abf1a-99d2-428d-af63-107591ff2c2e` | AI Factory Blueprint |
| `f037c741` | `f037c741-f7e1-4a90-880f-d2d38986767b` | Nexus Discord Bridge |

Example `~/.hermes/trend-ingest.env` addition (document only — operator-owned file):

```bash
NOTEBOOKLM_NOTEBOOK_TITLES=981466f0:CNS Vault Architecture,dc6abf1a:AI Factory Blueprint,f037c741:Nexus Discord Bridge
```

### Files to touch

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE — parser, overlay, env merge in main |
| `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` | UPDATE — title map section |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE — version 1.2.6 |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE — overlay + fallback tests |
| `~/.hermes/skills/cns/morning-digest/` | SYNC via install script |

**Read only:** `notebook-scorer.mjs`, `notebook-route.mjs`, `read-sources.mjs`, `fetch-arxiv-rss.mjs`.

**Do not edit:** `scripts/trend-ingest.env.example` unless adding a commented example line is explicitly desired — prefer `config-snippet.md` only (operator live file is `~/.hermes/trend-ingest.env`).

### Testing guidance

**Fixture for overlay ROUTED test:**

```javascript
const uuidTitleRegistry = [
  {
    id: '981466f0-de1c-4551-93a9-f3bc2a24b184',
    title: '981466f0-de1c-4551-93a9-f3bc2a24b184',
    watch: true,
    domain: 'cns-brain',
    last_updated: null,
  },
];
const map = parseNotebookTitleMap(
  '981466f0:CNS Vault Architecture',
);
const overlaid = applyNotebookTitleOverlay(uuidTitleRegistry, map);
const result = pickSignalNotebook(['CNS vault architecture'], overlaid);
// expect ROUTED, title 'CNS Vault Architecture'
```

**Fallback test:** registry with unmapped UUID title + empty map → same NO_ROUTE as today (proves no regression).

**CLI test:** set `process.env.NOTEBOOKLM_NOTEBOOK_TITLES`, write temp registry, run script via `execFile` — mirror existing CLI tests in same file.

Clear `DIGEST_SOURCES_JSON` in isolated CLI tests (Pitfalls from 60-1 / 61-1).

### Previous story intelligence (61-1)

- arXiv added as Source 4; Vault context is **Source 5** — do not renumber sources.
- `fetch-arxiv-rss.mjs` owns `mergeTrendIngestEnv` / `parseEnvFile` — import, don't copy.
- SKILL at v1.2.5; install uses `rsync -a --delete`.
- `pick-signal-notebook.mjs` repo copy is SSOT; `parseRegistryPath` precedence unchanged.

### Git intelligence

Recent commits: `feat(epic-61): 61-1 ...`, `refactor(epic-60): 60-2 ...`. Follow one logical commit: `feat(epic-61): 61-2 fix vault context notebook title routing`.

### Security / ops

- Title map contains no secrets; safe to document in config-snippet.
- Never log or print full `trend-ingest.env` in Discord or stdout.
- No WriteGate / vault mutation / `vault_log_action` impact.

### Deferred (do not fix here)

- Session-close `read-sources.mjs` using same map for `notebooklm_routing.notebooks[].title` in close-report (operator-visible Discord routing block) — separate story if needed.
- Malformed `DIGEST_SOURCES_JSON` silent `[]` (56-4 deferral).

## References

- [Source: `scripts/session-close/lib/read-sources.mjs` — env-override `title: id`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`]
- [Source: `scripts/session-close/lib/notebook-scorer.mjs` — F1 on title tokens]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`]
- [Source: `_bmad-output/implementation-artifacts/52-1-morning-digest-notebooklm-synthesis.md`]
- [Source: `_bmad-output/implementation-artifacts/56-4-morning-digest-signal-scoring-improvements.md`]
- [Source: `_bmad-output/implementation-artifacts/61-1-morning-digest-arxiv-source.md`]
- [Source: `scripts/session-close/lib/notebook-registry.json` — watched notebook IDs/titles]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Pre-existing `notebook-query` Hermes parity drift blocked verify gate; resolved via `install-hermes-skill-notebook-query.sh` (unrelated to 61-2 code).

### Completion Notes List

- Added `parseNotebookTitleMap` and `applyNotebookTitleOverlay` exports; main CLI merges `~/.hermes/trend-ingest.env` via `mergeTrendIngestEnv` before overlay.
- UUID-title registry rows now ROUTED-match when `NOTEBOOKLM_NOTEBOOK_TITLES` maps 8-char prefix → human title.
- SKILL v1.2.6 + config-snippet NotebookLM title map section; Pitfalls line added.
- Tests: parser happy path, overlay ROUTED, fallback NO_ROUTE, CLI integration with env map.
- `npm test` and `bash scripts/verify.sh` green; morning-digest skill synced to `~/.hermes/skills/cns/morning-digest/`.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-05: Story 61-2 — NotebookLM title map overlay for vault context signal routing; SKILL v1.2.6.
