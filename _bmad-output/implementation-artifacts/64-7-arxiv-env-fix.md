---
story_id: 64-7
epic: 64
title: arxiv-env-fix
status: review
baseline_commit: ce0dc5d
operator_brief: 2026-06-08
predecessors: 61-1, 61-3, 59-3
---

# Story 64.7: arXiv empty results fix (`MORNING_DIGEST_ARXIV_*` env)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest in `#hermes`**,
I want **arXiv preprints to appear when morning-digest runs with standard operator env setup**,
so that **Source 4 returns real papers instead of silent empty `papers[]` or misleading "source unavailable" bullets when configuration was never documented in the canonical env template**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 64: Intelligence Scoring Engine v1 — **64-7 is a parallel quick win** (no dependency on 64-1 schema) |
| **Repo** | Omnipotent.md only — no cns-dashboard changes |
| **Predecessors** | **61-1** (introduced `fetch-arxiv-rss.mjs` + Source 4); **61-3** / **59-3** (`resolveOperatorHome` in Node + HOME isolation in `hermes-run-newsapi.sh`) |
| **Touchpoints** | `fetch-arxiv-rss.mjs`, `hermes-run-arxiv.sh`, `trend-ingest.env.example`, skill references |
| **Pattern** | Mirror **NewsAPI/HN** env hygiene: wrapper HOME remap + `mergeTrendIngestEnv` + documented defaults in `.example` |
| **Out of scope** | Epic 64 scoring dimensions (64-2..64-5); live RSS network calls in `npm test`; arXiv PDF download; HN wrapper parity (unless trivial one-liner HOME block copy) |

### Problem (current state)

Morning digest Source 4 calls:

```text
terminal(command="bash scripts/session-close/hermes-run-arxiv.sh", workdir=resolved_repo_root, timeout=45)
```

**Known failure modes producing empty arXiv sections:**

1. **`MORNING_DIGEST_ARXIV_*` absent from `scripts/trend-ingest.env.example`** — operators copy the template to `~/.hermes/trend-ingest.env` and get NewsAPI/Convex keys but **never see arXiv vars**; `loadArxivConfig` sees empty categories → `{ papers: [] }`.
2. **No runtime default categories** — Story 61-1 deliberately avoided baking defaults into code; config-snippet documents `cs.AI,cs.LG,stat.ML` as *example only*. Enabled-by-default + empty categories = **silent empty success** (task-prompt treats empty `papers` as failure, but reason is opaque: "empty papers").
3. **`hermes-run-arxiv.sh` lacks HOME isolation remap** — `hermes-run-newsapi.sh` remaps `$HOME` when under `/.hermes/home` (Epic 59); arXiv wrapper is a bare `exec node` with **no bash-side HOME fix**. Node `mergeTrendIngestEnv` handles isolation, but wrapper parity reduces dual-path confusion and matches operator mental model.
4. **Weak operator diagnostics** — `{ papers: [] }` with no `error` key does not distinguish "disabled", "categories missing", "all feeds failed", or "RSS returned zero items".

### Operator brief (binding — sprint-change-proposal-2026-06-08)

1. Fix arXiv empty results when `MORNING_DIGEST_ARXIV_*` env is configured.
2. Primary files: `fetch-arxiv-rss.mjs` (env load + config), `hermes-run-arxiv.sh` (wrapper).
3. Success criterion: **arXiv returns papers when env configured** (Epic 64 proposal §Success criteria).
4. Can run in parallel with 64-1; does not block scoring engine stories.

## Acceptance Criteria

### 1. Documented env template (AC: template)

**Given** a fresh operator copies `scripts/trend-ingest.env.example` → `~/.hermes/trend-ingest.env`
**When** they enable morning digest arXiv
**Then** the example file includes a commented block for:

| Variable | Purpose | Example |
|----------|---------|---------|
| `MORNING_DIGEST_ARXIV_CATEGORIES` | Comma-separated category codes | `cs.AI,cs.LG,stat.ML` |
| `MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY` | Max papers per feed | `3` |
| `MORNING_DIGEST_ARXIV_ENABLED` | Disable without unsetting categories | `1` |

**And** `references/config-snippet.md` stays consistent with the example file (same keys, same documented defaults)

### 2. Sensible default categories when unset (AC: defaults)

**Given** arXiv is enabled (`MORNING_DIGEST_ARXIV_ENABLED` unset or truthy)
**And** `MORNING_DIGEST_ARXIV_CATEGORIES` is unset or empty after trim (including after `mergeTrendIngestEnv`)
**When** `loadArxivConfig` runs
**Then** it applies documented defaults: **`cs.AI,cs.LG,stat.ML`** (cap still enforced at 3 categories)

**Given** operator explicitly sets `MORNING_DIGEST_ARXIV_CATEGORIES=` (empty string) **and** sets `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0` (new optional escape hatch)
**Then** return `{ error: 'categories not configured' }` without network fetch (exit 0)

**And** export `DEFAULT_ARXIV_CATEGORIES` constant (or equivalent) for tests — single source of truth in `fetch-arxiv-rss.mjs`

### 3. Clear error contract for misconfiguration (AC: errors)

**Given** arXiv enabled but categories empty **and** defaults disabled via `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0`
**Then** `runArxivFetch` returns `{ error: 'categories not configured' }` (not `{ papers: [] }`)

**Given** arXiv disabled (`MORNING_DIGEST_ARXIV_ENABLED` falsey)
**Then** unchanged: `{ error: 'arxiv disabled' }`

**Given** invalid category tokens in env
**Then** unchanged: `{ error: 'invalid category' }`

**Given** valid categories but all RSS fetches fail
**Then** unchanged: `{ error: '<reason>' }` from last fetch failure

**And** all CLI paths exit **0** on failure (digest must not abort)

### 4. Wrapper HOME isolation parity (AC: wrapper)

**Given** `hermes-run-arxiv.sh` is updated
**Then** it includes the same **HOME isolation remap** block as `hermes-run-newsapi.sh` (lines 9–14 pattern):

```bash
if [[ "$HOME" == */.hermes/home || "$HOME" == */.hermes/home/* ]]; then
  OPERATOR_HOME="${HOME%%/.hermes/home*}"
  if [[ -n "$OPERATOR_HOME" ]]; then
    export HOME="$OPERATOR_HOME"
  fi
fi
```

**And** still `exec node "$REPO_ROOT/scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs"` — logic stays in `.mjs`
**And** no inline env parsing in bash (Node `mergeTrendIngestEnv` remains SSOT for `trend-ingest.env` overlay)

### 5. Skill contract + version bump (AC: skill)

**Given** behavior changes above
**Then** update `references/task-prompt.md` Source 4:

- Document default categories when env unset
- Document `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0` escape hatch
- Map `error: categories not configured` → `- (source unavailable: categories not configured)`

**And** bump `SKILL.md` to **v1.3.1** (patch — env/default fix only)
**And** run `bash scripts/install-hermes-skill-morning-digest.sh` after skill edits; verify parity gate passes

### 6. Tests + verify gate (AC: tests)

**Then** update `tests/morning-digest-arxiv-rss.test.mjs`:

- Replace test **"does not embed default categories in code path"** with **"applies DEFAULT_ARXIV_CATEGORIES when unset"**
- Add test: `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0` + empty categories → `{ error: 'categories not configured' }`
- Extend `mergeTrendIngestEnv` isolation test to assert `MORNING_DIGEST_ARXIV_CATEGORIES` loads from operator `~/.hermes/trend-ingest.env` when `HOME` is profile-isolated

**And** extend `tests/hermes-morning-digest-skill.test.mjs`:

- Assert `hermes-run-arxiv.sh` contains HOME isolation remap (mirror newsapi assertion style)
- Assert `trend-ingest.env.example` documents `MORNING_DIGEST_ARXIV_CATEGORIES`

**And** `npm test` and `bash scripts/verify.sh` green

## Tasks / Subtasks

- [x] **Task 1 — Config defaults + error paths** (AC: 2, 3)
  - [x] Add `DEFAULT_ARXIV_CATEGORIES = 'cs.AI,cs.LG,stat.ML'` and `MORNING_DIGEST_ARXIV_USE_DEFAULTS` handling in `loadArxivConfig`
  - [x] Update `runArxivFetch` to surface `categories not configured` when appropriate
- [x] **Task 2 — Wrapper HOME remap** (AC: 4)
  - [x] Patch `scripts/session-close/hermes-run-arxiv.sh` with Epic 59 HOME isolation block
- [x] **Task 3 — Operator docs** (AC: 1, 5)
  - [x] Add arXiv block to `scripts/trend-ingest.env.example`
  - [x] Update `references/config-snippet.md` + `references/task-prompt.md` Source 4
  - [x] Bump `SKILL.md` to v1.4.1 (patch from v1.4.0; story drafted at v1.3.1)
- [x] **Task 4 — Tests** (AC: 6)
  - [x] Update `tests/morning-digest-arxiv-rss.test.mjs`
  - [x] Extend `tests/hermes-morning-digest-skill.test.mjs`
  - [x] Run `npm test` + `bash scripts/verify.sh` + skill install parity

### Review Findings

- [x] [Review][Defer] Unreachable `{ papers: [] }` fallback in `runArxivFetch` [`fetch-arxiv-rss.mjs:333`] — deferred, harmless dead code after defaults populate categories in `loadArxivConfig`
- [x] [Review][Defer] 64-6 commit landed wrapper HOME assertions before `hermes-run-arxiv.sh` remap [`tests/hermes-morning-digest-skill.test.mjs:220`] — deferred, resolved by uncommitted 64-7 wrapper patch; commit 64-7 to restore green HEAD

**Review context (operator):** `DEFAULT_ARXIV_CATEGORIES` intentionally overrides Story 61-1 "no baked defaults" per Epic 64 operator brief (`sprint-change-proposal-2026-06-08`); escape hatch `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0` documented. Not a policy slip — dismissed as noise.

## Dev Notes

### Architecture compliance

- **ADR-E64-001 (preview):** Scoring engine is Omnipotent.md-side; 64-7 improves **source availability** feeding future 64-2 scoring — no Convex schema work.
- **Epic 64 parallel track:** 64-7 does **not** wait on 64-1 `digestSignals.scores` extension.
- **Intentional 61-1 override:** Applying runtime defaults reverses 61-1 AC "default categories not baked into code" — **Epic 64 operator brief explicitly requires this fix**. Document the override in completion notes.

### Current module state (must read before editing)

```150:166:scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs
export function loadArxivConfig(env = process.env) {
  const enabled = isArxivEnabled(env.MORNING_DIGEST_ARXIV_ENABLED);
  const rawCategories = String(env.MORNING_DIGEST_ARXIV_CATEGORIES ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  // ... invalidCategories filter, maxPerCategory ...
  return { enabled, categories, maxPerCategory, invalidCategories };
}
```

```302:315:scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs
export async function runArxivFetch(env, options = {}) {
  const config = loadArxivConfig(env);
  if (!config.enabled) {
    return { error: 'arxiv disabled' };
  }
  if (config.categories.length === 0) {
    if (config.invalidCategories.length > 0) {
      return { error: 'invalid category' };
    }
    return { papers: [] };  // ← silent empty — primary bug
  }
  // ...
}
```

```1:9:scripts/session-close/hermes-run-arxiv.sh
#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.pyenv/shims:$HOME/.pyenv/bin:$PATH"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
exec node "$REPO_ROOT/scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs"
```

**Contrast — newsapi wrapper HAS HOME remap:**

```9:14:scripts/session-close/hermes-run-newsapi.sh
if [[ "$HOME" == */.hermes/home || "$HOME" == */.hermes/home/* ]]; then
  OPERATOR_HOME="${HOME%%/.hermes/home*}"
  if [[ -n "$OPERATOR_HOME" ]]; then
    export HOME="$OPERATOR_HOME"
  fi
fi
```

### Recommended implementation sketch

```js
export const DEFAULT_ARXIV_CATEGORIES = 'cs.AI,cs.LG,stat.ML';

function useArxivDefaults(env) {
  const v = String(env.MORNING_DIGEST_ARXIV_USE_DEFAULTS ?? '').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

export function loadArxivConfig(env = process.env) {
  const enabled = isArxivEnabled(env.MORNING_DIGEST_ARXIV_ENABLED);
  let rawCategories = String(env.MORNING_DIGEST_ARXIV_CATEGORIES ?? '')
    .split(',').map((c) => c.trim()).filter(Boolean);

  if (rawCategories.length === 0 && enabled && useArxivDefaults(env)) {
    rawCategories = DEFAULT_ARXIV_CATEGORIES.split(',').map((c) => c.trim());
  }
  // ... existing validation ...
}
```

In `runArxivFetch`, when `categories.length === 0` after load:

```js
if (config.categories.length === 0) {
  if (config.invalidCategories.length > 0) return { error: 'invalid category' };
  if (config.enabled && !useArxivDefaults(env)) return { error: 'categories not configured' };
  return { papers: [] }; // only when disabled path already returned above
}
```

### `mergeTrendIngestEnv` — preserve, do not duplicate

- **Import path:** Other morning-digest scripts import `mergeTrendIngestEnv` from `./fetch-arxiv-rss.mjs` — keep exports stable.
- **Isolation:** `resolveOperatorHome` + `mergeTrendIngestEnv` already read `$OPERATOR_HOME/.hermes/trend-ingest.env` under Hermes profile HOME — verified in `tests/morning-digest-arxiv-rss.test.mjs` (but test omits arXiv keys today).
- **Deferred (61-2):** EPERM/parse errors on unreadable env file swallowed silently — out of scope unless you add stderr warning without changing 61-1 deferral scope.

### File structure

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` | **UPDATE** — defaults, `USE_DEFAULTS`, error contract |
| `scripts/session-close/hermes-run-arxiv.sh` | **UPDATE** — HOME isolation block |
| `scripts/trend-ingest.env.example` | **UPDATE** — arXiv env block |
| `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` | **UPDATE** |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | **UPDATE** Source 4 |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | **UPDATE** v1.3.1 |
| `tests/morning-digest-arxiv-rss.test.mjs` | **UPDATE** |
| `tests/hermes-morning-digest-skill.test.mjs` | **UPDATE** |

**Do not touch:** `cns-dashboard/`, WriteGate paths, `push-digest-convex.mjs`, `pick-signal-notebook.mjs` scoring logic, `trend-ingest.py`.

### Testing standards

- Mirror `tests/morning-digest-arxiv-rss.test.mjs` fixture patterns — **no live network** in `npm test`.
- Use `runArxivFetch({ MORNING_DIGEST_ARXIV_CATEGORIES: undefined }, { fixtureXml: FIXTURE_RSS })` to prove defaults trigger fetch.
- Hermes skill parity: `scripts/verify.sh` runs install + diff gate — mandatory after SKILL.md edits.

### Previous story intelligence

| Story | Learning for 64-7 |
|-------|-------------------|
| **61-1** | Established `fetch-arxiv-rss.mjs`, RSS parse, `papers[]` JSON contract, no new npm deps |
| **61-3 / 59-3** | HOME isolation required for Hermes subprocesses; Node `resolveOperatorHome` + bash wrapper remap are **defense in depth** |
| **61-4** | HN wrapper also thin `exec node` — arXiv fix sets pattern for optional future HN wrapper hardening |
| **64-6** | Parallel Epic 64 quick win: update `trend-ingest.env.example` + task-prompt + fixture tests in same PR style |

### Git intelligence

Recent commits (`48b2d71` 61-3 HOME isolation, `bf6ef5c` 61-4 HN, `ef81568`/`0116eab` 61-5 Convex push) established morning-digest source stack. Follow same conventions: small Omnipotent.md-only diff, task-prompt as normative contract, fixture tests, verify gate.

### Security / operator approval

- **No WriteGate / vault_log_action / security.md** changes.
- **No new npm packages** (supply-chain rule).
- arXiv RSS is public — no API keys in env.

### Project structure notes

- Morning-digest scripts live under `scripts/hermes-skill-examples/morning-digest/scripts/` and mirror to `~/.hermes/skills/cns/morning-digest/` via `bash scripts/install-hermes-skill-morning-digest.sh`.
- Sprint proposal cited `scripts/session-close/fetch-arxiv-rss.mjs` — **actual path is** `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs`; wrapper is `scripts/session-close/hermes-run-arxiv.sh`.

## References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md` — Epic 64 story table, success criteria, file map]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 64 goal + 64-7 parallel note]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs` — current implementation]
- [Source: `scripts/session-close/hermes-run-arxiv.sh` — wrapper gap vs newsapi]
- [Source: `scripts/session-close/hermes-run-newsapi.sh` — HOME isolation reference]
- [Source: `_bmad-output/implementation-artifacts/61-1-morning-digest-arxiv-source.md` — original AC (defaults policy superseded by 64-7)]
- [Source: `_bmad-output/implementation-artifacts/64-6-newsapi-query-tightening.md` — parallel quick-win story shape]
- [Source: `scripts/trend-ingest.env.example` — missing arXiv keys today]
- [Source: `project-context.md` — verify gate, no new npm deps]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

### Completion Notes List

- Applied runtime default categories (`cs.AI,cs.LG,stat.ML`) when `MORNING_DIGEST_ARXIV_CATEGORIES` unset — overrides Story 61-1 "no baked defaults" per Epic 64 operator brief.
- Added `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0` escape hatch returning `{ error: 'categories not configured' }`.
- Added Epic 59 HOME isolation remap to `hermes-run-arxiv.sh` (parity with newsapi wrapper).
- Documented arXiv env keys in `trend-ingest.env.example`, `config-snippet.md`, and `task-prompt.md` Source 4.
- Bumped morning-digest skill to v1.4.1 (current baseline was v1.4.0, not v1.3.0 when story was drafted).
- `npm test` and `bash scripts/verify.sh` green; skill install parity gate passed.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-arxiv-rss.mjs`
- `scripts/session-close/hermes-run-arxiv.sh`
- `scripts/trend-ingest.env.example`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-arxiv-rss.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-08: Story 64-7 — arXiv env defaults, USE_DEFAULTS escape hatch, wrapper HOME remap, operator docs, tests.
