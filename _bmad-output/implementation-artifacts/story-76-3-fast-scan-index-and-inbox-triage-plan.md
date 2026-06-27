# Story 76.3: Fast-scan index and inbox triage plan

Status: review

baseline_commit: b8d2f1cfa621e365b243ead67d934dedfe1cb91f

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->
<!-- Sprint key: 76-3-fast-scan-index-and-inbox-triage-plan | Branch: hermes-consolidation -->
<!-- FR17 orientation artifact — follows 76-1 session-close + 76-2 project-context sync -->

## Story

As an **operator**,
I want **vault-fast-scan-index refreshed and a triage plan for the 103-item inbox backlog**,
so that **orientation layer is actionable not stale (FR17)**.

## Acceptance Criteria

1. **Fast-scan index regenerated on canonical vault**
   **Given** session-close from 76-1 ran successfully and `scripts/generate-vault-fast-scan-index.mjs` exists (Story 29-9)
   **When** dev runs `CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE" npm run vault:fast-scan`
   **Then** `AI-Context/vault-fast-scan-index.md` on the canonical vault is overwritten with normative header + data rows (Story 29-9 format)
   **And** `Math.ceil(content.length / 4) <= 2000` (token budget)
   **And** top rows include recently modified Hermes Consolidation hotspots (expect `03-Resources/CNS-Operator-Guide.md`, Hermes/CNS project notes under `01-Projects/Brain - Central Nervous System Build/`, governance resources modified since Epic 74)
   **And** row count > 10 (canonical index was ~55 data rows pre-story; repo fixture was stale at 7 rows)

2. **Repo fixture fast-scan synced for verify gate**
   **Given** AC #1 complete
   **When** dev runs `npm run vault:fast-scan` with default `CNS_VAULT_ROOT` (repo `Knowledge-Vault-ACTIVE/`)
   **Then** `Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md` in the Omnipotent repo is regenerated
   **And** `tests/vault-fast-scan-index.test.mjs` passes (normative header + token cap)

3. **Inbox inventory matches PRD count**
   **Given** canonical vault mounted at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`
   **When** dev counts recursive inbox markdown
   **Then** `find …/00-Inbox -name '*.md' | wc -l` equals **103** (±0; document if drift)
   **And** inventory lists every path vault-relative under `00-Inbox/` in the triage plan doc

4. **Inbox triage plan document (plan only — no moves)**
   **Given** the 103-item inbox backlog
   **When** dev authors `AI-Context/inbox-triage-plan.md` on the canonical vault via **operator filesystem write** (same write class as `vault-fast-scan-index.md`; not `vault_create_note`)
   **Then** document header states generation date, total count, and FR17 / Epic 76-3 scope
   **And** every inbox `.md` path appears in exactly one category:
   - **Act now** — high-value for Hermes Consolidation (CNS/Hermes governance, active project captures, operator workflows)
   - **Defer** — useful but not blocking consolidation (personal, job search, generic clippings to process later)
   - **Archive candidate** — stale duplicates, superseded captures, low-signal clippings (relocation target documented; **no bulk moves in this story**)
   **And** each row includes vault-relative path + one-line rationale + optional suggested `03-Resources/` or `01-Projects/` destination (advisory only)
   **And** plan explicitly states execution path: Hermes `/triage` + `/triage-approve` + `/triage-execute` per Operator Guide §15.3 (Epic 27)

5. **WriteGate and AI-Context boundary**
   **Given** `AI-Context/**` is WriteGate-protected for Vault IO mutators
   **When** implementation completes
   **Then** fast-scan index and inbox triage plan are written via operator FS / `npm run vault:fast-scan` (not `vault_create_note`, `vault_update_frontmatter`, or direct IDE edits to canonical `AI-Context/AGENTS.md`)
   **And** zero diffs to `specs/cns-vault-contract/AGENTS.md` or vault canonical AGENTS
   **And** repo mirror `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md` committed if operator copies plan into fixture vault for CI parity (optional but recommended)

6. **Verify gate + scope boundary (NFR1, NFR2)**
   **Given** changes are vault orientation docs + optional repo fixture sync
   **When** dev runs `bash scripts/verify.sh` from Omnipotent.md root
   **Then** exit code 0
   **And** zero diffs in protect-list paths:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no `vault_move`, bulk delete, or archive execution in this story

## Tasks / Subtasks

- [x] **T1 — Baseline inventory** (AC: #3)
  - [x] Confirm canonical vault mount: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`
  - [x] Run `find …/00-Inbox -name '*.md'` → expect **103** paths; save list to working notes
  - [x] Read current `AI-Context/vault-fast-scan-index.md` (canonical + repo fixture); note row counts and stale hotspots
  - [x] Read `scripts/generate-vault-fast-scan-index.mjs` and Story 29-9 normative format (do not change format without new story)

- [x] **T2 — Regenerate fast-scan index** (AC: #1, #2, #5)
  - [x] `CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE" npm run vault:fast-scan`
  - [x] `npm run vault:fast-scan` (repo fixture default)
  - [x] Verify token budget: `node -e "const fs=require('fs');const t=fs.readFileSync('Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md','utf8');console.log('tokens',Math.ceil(t.length/4))"`
  - [x] Spot-check top 10 rows for Hermes Consolidation relevance (Operator Guide, CNS/Hermes project paths)

- [x] **T3 — Author inbox triage plan** (AC: #3, #4, #5)
  - [x] Draft `AI-Context/inbox-triage-plan.md` on canonical vault (operator FS)
  - [x] Categorize all 103 paths into act-now / defer / archive-candidate tables
  - [x] Add execution footer: `/triage`, `/triage-approve`, `/triage-execute` references (Operator Guide §15.3)
  - [x] Copy plan to repo `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md` for fixture parity (recommended)
  - [x] **Do not** run triage-execute or bulk vault_move — plan document only

- [x] **T4 — Verify and close** (AC: #6)
  - [x] `bash scripts/verify.sh`
  - [x] Grep: no protect-list diffs; no AGENTS.md edits
  - [x] Update story File List; mark sprint-status after code review

## Dev Notes

### What this story is (and is not)

- **IS:** Refresh orientation artifacts — `vault-fast-scan-index.md` + new `inbox-triage-plan.md` (FR17).
- **IS NOT:** Executing inbox moves (Epic 27 `/triage-execute`), session-close changes (76-1 done), project-context sync (76-2 done), governance stubs (76-4), or Hermes config edits.
- **Plan-only triage:** Categories are operator guidance. Physical moves happen in later operator sessions via Hermes triage commands.

### Fast-scan index — reuse Story 29-9

| Item | Value |
|------|-------|
| Generator | `scripts/generate-vault-fast-scan-index.mjs` |
| npm script | `npm run vault:fast-scan` |
| Governed roots | `01-Projects/`, `02-Areas/`, `03-Resources/` only (no Inbox) |
| Output | `AI-Context/vault-fast-scan-index.md` |
| Token cap | `ceil(chars/4) <= 2000`; row cap 100, trim by 5 |
| Session-close | Phase A in `run-deterministic.mjs` already calls `vault:fast-scan` — this story ensures post-76-1 freshness + repo fixture sync |

**Normative header (do not alter):**

```markdown
# Vault Fast-Scan Index (auto — /session-close)
# Format: [TYPE] [path] | [title] | [created]
# Token budget: ≤2,000 tokens | Cap: 100 most-recently-modified notes

```

**Baseline (2026-06-24):** Canonical index ~55 data rows (healthy). Repo fixture index ~7 rows (stale — must regenerate for verify).

### Inbox triage plan — document structure

**Path:** `AI-Context/inbox-triage-plan.md` (canonical + repo fixture mirror)

**Write class:** Operator filesystem — same as `vault-fast-scan-index.md` and `MEMORY.md`. **Not** a Vault IO mutator path.

**Suggested skeleton:**

```markdown
# Inbox Triage Plan (Hermes Consolidation — FR17)

> Generated: YYYY-MM-DD | Total: 103 markdown files under 00-Inbox/
> Story: 76-3 | Execution: Hermes `/triage` family (Operator Guide §15.3) — plan only, no moves in this story.

## Summary

| Category | Count | Intent |
|----------|-------|--------|
| Act now | N | Route during consolidation sprint |
| Defer | N | Process after Epics 74–78 critical path |
| Archive candidate | N | Relocate to 04-Archives/ when operator approves |

## Act now

| Path | Rationale | Suggested destination |
|------|-----------|----------------------|
| 00-Inbox/… | … | 03-Resources/ or 01-Projects/… |

## Defer

…

## Archive candidate

…

## Execution notes

- Preview: `/triage` in Discord `#hermes`
- Approve: `/triage-approve <path> --to <dir>/`
- Execute (later): `/triage-execute <path> --to <dir>/` — one `vault_move` per invocation
- Obsidian panel: `_meta/bases/inbox-triage.base`
```

### Categorization heuristics (guidance — apply judgment)

| Signal | Typical category |
|--------|------------------|
| CNS, Hermes, BMAD, vault, Nexus, run-chain, session-close | **Act now** → `01-Projects/Brain…` or `03-Resources/` |
| `Clippings/` web articles (tool docs, AI news) | **Defer** or **Archive** if duplicate of vault resources |
| Personal/job search (`Alex - Per Jwana Job/`) | **Defer** |
| iPhone dump / bulk unstructured captures | **Defer** (triage in batches) |
| Duplicate clippings, empty stubs, superseded drafts | **Archive candidate** → `04-Archives/` (document only) |
| Morning digest captures (`hermes-morning-digest-*.md`) | **Defer** or route to `03-Resources/` if novel |

**Inbox shape (sample):** `00-Inbox/Clippings/` (large subtree), project folders, Hermes captures, personal notes. Recursive listing required — top-level `ls` shows ~29 entries but **103** `.md` files total.

### Vault paths

| Path | Role |
|------|------|
| `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/` | Canonical vault (operator) |
| `Knowledge-Vault-ACTIVE/` | Repo fixture (verify + seed) |
| `AI-Context/vault-fast-scan-index.md` | Fast-scan output |
| `AI-Context/inbox-triage-plan.md` | **New** triage plan output |
| `00-Inbox/` | Inventory source (read-only this story) |

### WriteGate reminder

From Operator Guide §15.4 and Story 29-9:

> Do not use Vault IO mutators for `AI-Context/AGENTS.md`, `CNS-Daily-Rhythm.md`, `MEMORY.md`, or `vault-fast-scan-index.md`.

Extend mentally to `inbox-triage-plan.md` — same operator FS write class.

### Protect-list (forbidden)

```
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
scripts/run-chain.ts
```

### Relationship to 76-1 and 76-2

| Story | Delivers |
|-------|----------|
| 76-1 | Session-close live; AGENTS §8, MEMORY, AUTO blocks refreshed |
| 76-2 | Both `project-context.md` files synced to Hermes Consolidation |
| **76-3** | `vault-fast-scan-index.md` + `inbox-triage-plan.md` — remaining FR17 orientation gaps before 76-4 (mobile-posture, personas) |

76-2 explicitly deferred fast-scan/inbox to **this story**.

## Architecture Compliance

- **FR17** — fast-scan-index + inbox triage plan [Source: `epics-hermes-consolidation.md` Story 76-3, `prd-hermes-consolidation.md` §5]
- **NFR1** — `bash scripts/verify.sh` before done
- **NFR2** — protect-list untouched; no NEXUS bridge changes; plan-only (no destructive inbox ops)
- **Story 29-9** — fast-scan format and token budget are normative; do not relax
- **Epic 27 triage** — execution contract in Operator Guide §15.3; reference only

## Library / Framework Requirements

**None** for generator changes. Optional inventory helper:

```bash
find "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/00-Inbox" -name '*.md' | sort
```

No new npm dependencies. No Context7 unless dev touches Hermes skill docs for wording accuracy.

## File Structure Requirements

| Action | Path | Repo / vault |
|--------|------|--------------|
| **REGENERATE** | `AI-Context/vault-fast-scan-index.md` | Canonical vault + repo fixture |
| **CREATE** | `AI-Context/inbox-triage-plan.md` | Canonical vault + repo fixture (recommended) |
| **READ** | `00-Inbox/**` | Canonical vault (inventory only) |
| **READ** | `scripts/generate-vault-fast-scan-index.mjs` | Omnipotent.md |
| **READ** | `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3 | Triage execution reference |
| **VERIFY** | `bash scripts/verify.sh` | Omnipotent.md |

**Do not edit:** `specs/cns-vault-contract/AGENTS.md`, canonical AGENTS, `CLAUDE.md` files, session-close scripts (unless verify failure requires unrelated fix — document in completion notes).

## Testing Requirements

1. `npm run vault:fast-scan` (both vault roots) — must succeed
2. `npm test` / `bash scripts/verify.sh` — mandatory exit 0
3. Manual: canonical fast-scan top rows include Operator Guide + CNS/Hermes project notes
4. Manual: triage plan row count = inbox `find` count (103)
5. Grep: every inbox path appears exactly once across act-now + defer + archive sections
6. Grep guard: no `vault_move` or triage-execute invocations in story implementation commits

## Previous Story Intelligence (76-2)

From `story-76-2-project-context-sync.md` (done 2026-06-24):

- Project-context files now reflect Hermes Consolidation phase; constitution v2.1.44
- Fast-scan/inbox explicitly scoped to **76-3** — do not assume 76-2 touched orientation vault files
- Operator FS write class pattern established; WriteGate for AGENTS unchanged
- Two-repo commit pattern when cns-dashboard touched — **not applicable** here (vault docs only)
- `bash scripts/verify.sh` is mandatory gate

From `story-76-1-session-close-refresh.md` (done):

- Session-close Phase A runs `vault:fast-scan` — canonical index may already be fresh; **still** regenerate explicitly and sync repo fixture
- Canonical vault path confirmed in session-close scripts

## Git Intelligence Summary

Recent `hermes-consolidation` commits:

| Commit | Relevance |
|--------|-----------|
| `a9ffe2e` | 76-2 closed — project-context sync |
| `22ce571` | 76-2 implementation |
| `58dc23d` | 76-1 session-close orientation live |
| `cfbf60a` | fast-scan index committed (per HANDOFF) |

Pattern: orientation stories are markdown + vault FS writes; small commits; verify gate before done.

## Latest Technical Information

**Inbox count (verified 2026-06-24):** 103 recursive `.md` files under canonical `00-Inbox/`.

**Fast-scan generator:** unchanged since Story 29-9; sorts by `modified` desc; Hermes consolidation notes under `01-Projects/Brain - Central Nervous System Build/Hermes/` should surface when recently touched.

**Triage execution (deferred):** Hermes skill `triage` v1.7.0 at `~/.hermes/skills/cns/triage/`; repo mirror `scripts/hermes-skill-examples/triage/`.

## Project Context Reference

- Constitution §9 step 3: agents read `vault-fast-scan-index.md` before broad vault search
- §6.5 token budget: fast-scan ≤2,000 tokens
- Sprint SSOT: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Deferred: bulk inbox automation out of scope — plan + manual triage only

## Story Completion Status

- **Status:** review
- **Completion note:** Fast-scan index refreshed on canonical + fixture vaults; inbox triage plan authored for all 103 inbox items; verify gate passed

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Inbox inventory: 103 `.md` files under canonical `00-Inbox/` (verified via `find`)
- Canonical fast-scan pre-story: ~55 data rows; repo fixture pre-story: 7 rows (stale)
- Canonical fast-scan post-regen: 55 rows, est. 1954 tokens; top rows include `CNS-Operator-Guide.md` and `01-Projects/Brain - Central Nervous System Build/Hermes/*`

### Completion Notes List

- Regenerated `vault-fast-scan-index.md` on canonical vault and repo fixture via `npm run vault:fast-scan` (operator FS; no Vault IO mutators)
- Authored `AI-Context/inbox-triage-plan.md` on canonical vault (41 act now / 52 defer / 10 archive candidate); all 103 inbox paths listed exactly once
- Mirrored triage plan to repo fixture `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md`
- Added `scripts/generate-inbox-triage-plan.mjs` helper for reproducible plan regeneration from inbox inventory
- `bash scripts/verify.sh` exit 0; no protect-list or AGENTS.md diffs; no `vault_move` executed

### File List

- `Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md` (regenerated)
- `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md` (created)
- `scripts/generate-inbox-triage-plan.mjs` (created)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)
- `_bmad-output/implementation-artifacts/story-76-3-fast-scan-index-and-inbox-triage-plan.md` (story tracking)

**Canonical vault (operator FS, not in git):**

- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md` (regenerated)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md` (created)

## Change Log

- 2026-06-24: Story 76-3 — fast-scan index refresh + inbox triage plan (FR17 orientation); plan-only, no inbox moves
