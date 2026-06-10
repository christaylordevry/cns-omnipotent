---
story_id: 67-1
epic: 67
title: live-digest-validation
status: ready-for-dev
story_type: operator-validation
baseline_date: 2026-06-09
operator_brief: 2026-06-09
predecessors: 64-5, 64-8, 65-1, 65-4, 65-7, 65-8, 65-9
blocks: 67-5
parallel: 67-3, 67-4
closes: epic-65-retro-2026-06-09 P1
repo: Omnipotent.md (+ operator + cns-dashboard read-only verification)
---

# Story 67.1: Live Digest Validation — GitHub + RSS

Status: ready-for-dev

> **NOT A CODE STORY.** ADR-E67-007: produce a validation artifact only. No Omnipotent.md or cns-dashboard source changes unless a **blocking defect** is discovered — file a separate hotfix story; do not scope-creep this gate.
>
> **Epic 67 gate:** 67-5 (ProductHunt) and production confidence for Epic 65 adapters **must not start** until this story is `done` with a **PASS** artifact (or documented FAIL with operator sign-off and remediation plan).

<!-- Ultimate context engine analysis completed — comprehensive operator validation guide created. -->

## Story

As a **CNS operator**,
I want **one documented live morning-digest run with Convex push that proves GitHub and RSS adapters produce scored signals in production**,
so that **Epic 65 adapter integration is operator-trusted, Epic 65 retro P1 is closed, and downstream Epic 67 stories (especially 67-5 ProductHunt) can proceed on a validated pipeline**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 67 — Signal Quality + Source Expansion — **67-1 is the production-readiness gate** |
| **Story type** | Operator validation + artifact (ADR-E67-007) — **zero code deliverables** |
| **Repo** | Operator actions across Hermes + Convex; artifact in Omnipotent.md `_bmad-output/` |
| **Predecessors** | **64-5** (ranked push); **64-8** (scoring stdout threading); **65-1** (GitHub); **65-4** (RSS); **65-7** (Sources 7–9 imperative stdout); **65-8** (buildDigestSignals caps); **65-9** (Signal Intelligence panel in inspector) |
| **Blocks** | **67-5** (ProductHunt adapter) — do not `/bmad-create-story 67-5` until 67-1 PASS |
| **Parallel** | **67-3** (nexus-goals.yaml scoring), **67-4** (chip → inspector) — may proceed without 67-1 |
| **Normative spec** | `prd-epic-67-2026-06-09` §4.1 (FR-1–FR-3), addendum A4; `architecture-epic-67-signal-quality-source-expansion.md` §7.1; ADR-E67-007 |
| **FR IDs** | FR-1 (≥30 scored signals), FR-2 (GitHub + RSS attribution), FR-3 (validation artifact) |
| **Out of scope** | Reddit live validation (67-2); ProductHunt (67-5); nexus-goals.yaml (67-3); chip UX (67-4); Compare smoke (67-6); new automation scripts; `bash scripts/verify.sh` changes |

### Problem (current state)

Epic 65 shipped GitHub (Source 7) and RSS (Source 9) adapters with fixture tests and Hermes skill wiring, but **no operator has recorded a production digest run** showing:

- `digestSignals` rows with `sourceType: 'github'` / `'rss'` in Convex
- `rankScore` and `scores` populated at scale (≥30 signals)
- Signal Intelligence panel rendering for those rows in Nexus inspector (65-9)

Epic 65 retrospective **P1** explicitly flags: *"live digest with new sources not yet operator-validated."*

### Operator brief (binding)

1. **Run one full morning-digest** — not `trend-ingest.py --dry-run` alone; the Hermes `morning-digest` skill end-to-end with Discord post **and** `push-digest-convex.mjs` completion (task-prompt §9).
2. **Verify in Convex** — not Discord screenshots alone; record `digestRunId` and per-`sourceType` counts from `getDigestSignalsForRun`.
3. **Verify in Nexus UI** — open inspector on at least one GitHub and one RSS signal; confirm Signal Intelligence panel (65-9).
4. **Artifact is the deliverable** — commit `_bmad-output/implementation-artifacts/67-1-live-digest-validation.md` (this file's **Run Record** section below is the template; duplicate or replace with dated run content).
5. **FAIL is valid** — document root cause and remediation; do not mark story `done` until PASS or operator accepts documented FAIL with follow-up hotfix story.

---

## Acceptance Criteria

### 1. Live digest run with scored signal floor (FR-1, SM-1)

**Given** Hermes gateway is running and `~/.hermes/trend-ingest.env` has `CONVEX_URL`, `CONVEX_DEPLOY_KEY`, GitHub token, and RSS feed URLs configured
**When** the operator triggers one complete `morning-digest` run (see **Run Procedure** below)
**Then** Convex contains a new `digestRun` with status finalized
**And** `getDigestSignalsForRun({ digestRunId })` returns **≥30** signals with `rankScore` defined
**And** fewer than **10%** of signals lack `rankScore` or full `scores` object (scoring degraded mode) unless operator documents upstream source failure in artifact

### 2. GitHub and RSS source attribution (FR-2)

**Given** the same live run from AC-1
**When** signals are queried by `digestRunId`
**Then** **≥1** signal has `sourceType: 'github'` with `sourceMetadata.stars` present
**And** **≥1** signal has `sourceType: 'rss'` (and `section: 'rss'` where projected)
**And** opening a GitHub signal in Nexus Intelligence Inspector shows the **Signal Intelligence** panel with dimension bars (65-9 contract)
**And** opening an RSS signal shows the same panel when scoring fields exist

### 3. personalRelevance sanity check (addendum A4)

**Given** `MORNING_DIGEST_PROJECT_ENTITIES` and/or sprint tokens are configured in scoring context (`score-digest-signals.mjs` → `loadScoringContext`)
**When** reviewing scored signals for the run
**Then** **≥1** signal has `scores.personalRelevance > 0` whose title or summary mentions a project entity or sprint epic token
**And** if all `personalRelevance` values are 0, artifact documents env/symlink diagnosis (known pre-67-3 gap — not a FAIL by itself if other ACs pass, but must be noted)

### 4. Degraded mode behavior (addendum A4)

**Given** any source fails during the digest (network, auth, rate limit)
**When** the Discord digest posts
**Then** the failed section shows `- (source unavailable: …)` only
**And** the digest **does not abort** — other sources still render and Convex push still fires when scoring completes
**And** artifact notes which sources degraded (if any)

### 5. Validation artifact (FR-3)

**Given** the live run completes
**When** the operator fills the **Run Record** section of this file (or a sibling `67-1-live-digest-validation-RUN-YYYY-MM-DD.md` linked from here)
**Then** artifact includes: run timestamp (Australia/Sydney), `digestRunId`, per-`sourceType` signal counts table, pass/fail per checklist row, Discord section screenshot or excerpt (optional), Convex query excerpt (redact secrets), inspector screenshot note (optional)
**And** Epic 65 retro P1 closure noted in **Completion Notes**
**And** story status moves to `done` only on **PASS** (all mandatory checklist rows green)

---

## Run Procedure (operator)

### Pre-flight

| Step | Command / check | Pass |
|------|-----------------|------|
| P1 | `hermes gateway status` shows gateway running | ☐ |
| P2 | `bash scripts/install-hermes-skill-morning-digest.sh` (idempotent) | ☐ |
| P3 | `~/.hermes/trend-ingest.env` contains `CONVEX_URL`, `CONVEX_DEPLOY_KEY` (same deployment as cns-dashboard §16) | ☐ |
| P4 | GitHub token present (`GITHUB_TOKEN` or documented key in trend-ingest.env) | ☐ |
| P5 | RSS feeds configured (`MORNING_DIGEST_RSS_FEEDS` or per 65-4 docs) | ☐ |
| P6 | Optional adapter isolation — if digest fails, run standalone: `bash scripts/session-close/hermes-run-github.sh` and `bash scripts/session-close/hermes-run-rss.sh` from repo root; stdout must parse as JSON with `repos[]` / `entries[]` | ☐ |

### Trigger digest

**Preferred (manual):** Post single-line `morning-digest` in Discord `#hermes` (gateway must be up; skill bound per Operator Guide §15.11).

**Alternate (cron runner):** `bash scripts/run-morning-digest-cron.sh` from Omnipotent.md repo root (same gateway requirement).

**Wait for:** Discord digest message in `#hermes` with sections including **GitHub** and **Newsletters / RSS** (or `(source unavailable: …)`). Confirm Hermes logs show `push-digest-convex.mjs` terminal completed (stderr warnings OK; script exits 0).

### Convex verification

From `cns-dashboard/` (sibling repo):

```bash
cd ../cns-dashboard
npx convex run digest:getRecentDigestRuns '{"limit": 3}'
```

Copy the `_id` of the newest run → `digestRunId`.

```bash
npx convex run digest:getDigestSignalsForRun '{"digestRunId": "<paste_id>", "limit": 100}'
```

Tally counts by `sourceType`. Confirm `rankScore` presence. Sample one `github` and one `rss` row for `sourceMetadata` and `scores`.

**UI path (recommended for inspector AC):** Open Nexus cockpit → select topic matching digest focus keyword → Intelligence Inspector drawer → confirm **Signal Intelligence** panel on GitHub/RSS-backed signals.

---

## Validation Checklist (addendum A4 + architecture §7.1)

| # | Check | Pass criteria | Pass? | Evidence |
|---|-------|---------------|-------|----------|
| C1 | Signal count | ≥30 `digestSignals` with `rankScore` for run | ☐ | |
| C2 | Scoring coverage | `rankScore` on ≥90% of signals (<10% degraded) | ☐ | |
| C3 | GitHub | ≥1 `sourceType: github`, `sourceMetadata.stars` | ☐ | |
| C4 | RSS | ≥1 `sourceType: rss` | ☐ | |
| C5 | personalRelevance | ≥1 signal `scores.personalRelevance > 0` (or documented env gap) | ☐ | |
| C6 | Inspector | GitHub + RSS signals open with Signal Intelligence panel | ☐ | |
| C7 | Degraded mode | Failed sources → `(source unavailable: …)` only; digest continues | ☐ | |

**Overall:** ☐ PASS / ☐ FAIL

---

## Run Record

> **Operator:** Fill this section after the live run. Replace `TBD` values. If FAIL, add **Root Cause** and **Remediation** subsections.

| Field | Value |
|-------|-------|
| Run date (Australia/Sydney) | TBD |
| Trigger method | TBD (`discord manual` / `run-morning-digest-cron.sh`) |
| `digestRunId` | TBD |
| `digestRun.date` | TBD |
| `focusKeyword` | TBD |
| Hermes skill version | TBD (from `SKILL.md` — expect ≥1.4.5) |
| Operator | Chris Taylor |

### Per-source signal counts

| sourceType | count | notes |
|------------|-------|-------|
| google_trends | TBD | |
| newsapi | TBD | |
| perplexity | TBD | |
| arxiv | TBD | |
| hackernews | TBD | |
| notebooklm | TBD | |
| **github** | TBD | **required ≥1** |
| reddit | TBD | optional (67-2) |
| **rss** | TBD | **required ≥1** |
| _other_ | TBD | |

### Scoring summary

| Metric | Value |
|--------|-------|
| Total signals | TBD |
| With `rankScore` | TBD |
| Degraded (no rankScore) | TBD |
| Max `rankScore` | TBD |
| Signals with `personalRelevance > 0` | TBD |

### Sample signal excerpts (redacted)

**GitHub sample (`sourceType: github`):**

```json
TBD — paste one row: title, sourceType, sourceMetadata.stars, rankScore, scores
```

**RSS sample (`sourceType: rss`):**

```json
TBD
```

### Inspector verification

| Signal type | Topic/slug opened | Signal Intelligence panel visible? | Notes |
|-------------|-------------------|--------------------------------------|-------|
| GitHub | TBD | ☐ | |
| RSS | TBD | ☐ | |

### Degraded sources (if any)

| Source | Symptom | Discord message | Convex impact |
|--------|---------|-----------------|----------------|
| — | — | — | — |

---

## Failure Diagnostics

**If C3 (GitHub) fails:**

1. `bash scripts/session-close/hermes-run-github.sh` from repo root — expect JSON stdout with `repos[]`.
2. Check `GITHUB_TOKEN` / trend-ingest.env merge via `resolveOperatorHome()`.
3. Review task-prompt Source 7 slice — agent must parse `gh_json.repos` only (65-7).

**If C4 (RSS) fails:**

1. `bash scripts/session-close/hermes-run-rss.sh` — expect `entries[]`.
2. Verify feed URLs in env; test one feed with `curl -sI`.
3. Review task-prompt Source 9 slice — parse `rss_json.entries` only (65-7).

**If C1 (<30 signals) fails:**

1. Check `buildDigestSignals` caps in `pick-signal-notebook.mjs` (65-8).
2. Verify Google Trends watchlist keywords (operator updated 14 keywords 2026-06-09 — tune only if GT section empty).
3. Document per-source counts in artifact; do not start 67-5 until resolved.

**If C6 (inspector) fails but Convex data is good:**

- Likely UX/query issue — file **cns-dashboard** hotfix story; 67-1 can still PASS ingest if C1–C5 green and inspector failure is documented as separate defect.

---

## Tasks / Subtasks

- [ ] **T1: Pre-flight** (AC: all)
  - [ ] T1.1 Complete pre-flight table P1–P6
  - [ ] T1.2 Confirm morning-digest skill parity (`bash scripts/verify.sh` skill gate or manual `diff` vs repo mirror)
- [ ] **T2: Live digest run** (AC: 1, 2, 4)
  - [ ] T2.1 Trigger `morning-digest` (manual or cron runner)
  - [ ] T2.2 Confirm Discord post + Convex push in Hermes logs
- [ ] **T3: Convex verification** (AC: 1, 2, 3)
  - [ ] T3.1 `getRecentDigestRuns` → capture `digestRunId`
  - [ ] T3.2 `getDigestSignalsForRun` → tally by `sourceType`, scoring coverage
- [ ] **T4: Nexus inspector verification** (AC: 2, 3)
  - [ ] T4.1 Open GitHub signal → Signal Intelligence panel
  - [ ] T4.2 Open RSS signal → Signal Intelligence panel
- [ ] **T5: Artifact completion** (AC: 5)
  - [ ] T5.1 Fill Run Record + checklist
  - [ ] T5.2 Set overall PASS/FAIL; update story Status
  - [ ] T5.3 Note Epic 65 retro P1 closure in Completion Notes

---

## Dev Notes

### Gate discipline (Epic 67 sequence)

```
67-1 PASS ──gates──▶ 67-5 (ProductHunt)
67-3, 67-4 — parallel (no 67-1 dependency)
67-2 — operator Reddit OAuth (may slip)
67-6 — needs ≥2 digest runs (best after 67-1 green)
```

Do **not** mark 67-1 `done` on fixture tests or partial runs. This gate requires **live Convex rows** from a real Hermes digest.

### What "live digest" means (distinct from unit tests)

| | Unit/fixture tests | 67-1 live validation |
|--|-------------------|----------------------|
| Convex | Mocked or absent | Real `digestRuns` / `digestSignals` |
| Sources | Fixture JSON | Network fetches via Hermes terminals |
| Scoring | `score-digest-signals.mjs` in isolation | Post-Discord stdout threading → push |
| Operator | CI | Chris |

### Scoring pipeline (read-only — do not modify)

1. `pick-signal-notebook.mjs` → `buildDigestSignals` (includes github/reddit/rss keys per 65-8)
2. `score-digest-signals.mjs` → stdout `scored_signals` JSON
3. Agent assigns `digest_push_payload.signals = scored_signals` (64-8 / 65-7 imperative threading)
4. `push-digest-convex.mjs` with `DIGEST_PUSH_JSON`

### personalRelevance (pre-67-3)

Current token sources in `loadScoringContext()`:

- `MORNING_DIGEST_PROJECT_ENTITIES` (env)
- Sprint tokens from `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Watchlist keywords
- Keyword candidates

**67-3** adds `nexus-goals.yaml` — not required for 67-1 PASS if entity/sprint tokens yield `personalRelevance > 0`. If all zeros, document env path in artifact.

### Reddit (Source 8)

Not required for 67-1. Reddit validation is **67-2**. Discord may show `(source unavailable: reddit …)` — acceptable.

### No verify.sh gate for story done

`bash scripts/verify.sh` is unchanged by this story. Completion = artifact PASS + checklist green.

### Project Structure Notes

| Path | Role |
|------|------|
| `scripts/hermes-skill-examples/morning-digest/` | Skill mirror — task-prompt §7–9 sources |
| `scripts/session-close/hermes-run-github.sh` | Standalone GitHub diagnostic |
| `scripts/session-close/hermes-run-rss.sh` | Standalone RSS diagnostic |
| `~/.hermes/trend-ingest.env` | Operator credentials (never commit) |
| `../cns-dashboard/convex/digest.ts` | `getRecentDigestRuns`, `getDigestSignalsForRun` |
| `cns-dashboard/.../NexusInspectorDrawer.svelte` | Signal Intelligence panel (65-9) |

---

## References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/prd.md` §4.1, §13, SM-1]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/addendum.md` §A4]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md` §7.1, §10.1, ADR-E67-007]
- [Source: `_bmad-output/implementation-artifacts/epic-65-retro-2026-06-09.md` P1 action]
- [Source: `_bmad-output/implementation-artifacts/65-9-surface-intelligence-scoring-inspector-drawer.md` — inspector panel contract]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` §7–9 — GitHub/RSS threading + push gate]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.11 — morning-digest trigger]
- [Source: `../cns-dashboard/convex/digest.ts` — `getRecentDigestRuns`, `getDigestSignalsForRun`]

---

## Dev Agent Record

### Agent Model Used

_(filled on execution)_

### Completion Notes List

- Epic 65 retro P1 ("live digest with new sources not yet operator-validated"): _pending / closed on PASS_
- Downstream unblocked on PASS: 67-5 ProductHunt; 67-6 Compare (after second run)

### File List

- `_bmad-output/implementation-artifacts/67-1-live-digest-validation.md` (this file — artifact + story)
