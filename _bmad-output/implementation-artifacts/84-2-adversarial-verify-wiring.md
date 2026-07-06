# Story 84.2: Adversarial verify wiring

**Input of record:** `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md` (LOCKED 2026-07-06). Cost posture is **4a** (governance + prove-once dry-run, capability dormant after; NOT a recurring loop). Builds on Story **84-1** (commit `1d6d77e` / done `d91eee4`).

baseline_commit: d91eee4

Status: review

<!-- Ultimate context engine analysis completed 2026-07-06. Operator locked: dry-run #1B (84-1 diff 1d6d77e), invocation #2A (handoff STOP + verify-handoff.md). -->

## Story

As an **operator**,
I want **existing BMAD adversarial review skills wired into the Verify move**,
so that **the loop uses Blind Hunter / Cynical Review / Edge Case Hunter — not new review logic (FR22)**.

**Zone/Repo:** Omnipotent.md · `~/.hermes/skills/cns/unified-loop/` (edit existing mirror) · **Branch:** `hermes-consolidation`  
**Epic:** 84 — Unified Loop — Discover, Build, Verify, Persist (v1.5)  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 84-2  
**DDR (LOCKED):** `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`  
**Prerequisite:** Story **84-1** — unified-loop Hermes skill mirror at `scripts/hermes-skill-examples/unified-loop/` with Verify as **documented placeholder** in `references/task-prompt.md` §7.

## Acceptance Criteria

### AC1 — Protect-list firewall (NFR2, HARD)

**Given** protect-list paths are forbidden  
**When** this story completes  
**Then** **zero diffs** on:

- `src/agents/synthesis-adapter-llm.ts`
- `src/agents/hook-adapter-llm.ts`
- `src/agents/boss-adapter-llm.ts`
- `src/agents/run-chain.ts`
- `scripts/run-chain.ts`

**And** no edits that recompose run-chain engine stages inside `src/agents/*` or `run-chain.ts`.

### AC2 — Verify composes three existing review skills (no new review logic)

**Given** Story 84-1 shell exists at `scripts/hermes-skill-examples/unified-loop/`  
**When** Verify move is wired  
**Then** `references/task-prompt.md` and governance (`AI-Context/modules/unified-loop.md` via session-close WriteGate) name all three skills **by exact registered skill ID**:

| Order | Skill ID | Purpose |
|-------|----------|---------|
| 1 | `bmad-code-review` | Structured adversarial code review (parallel layers + triage) |
| 2 | `bmad-review-adversarial-general` | Cynical Review — attitude-driven gap finding |
| 3 | `bmad-review-edge-case-hunter` | Path-tracer — unhandled edge cases only (JSON output) |

**And** implementation is **pure composition** — no new review logic, no fork of review skill internals, no duplicate adversarial prompts in Hermes skill files  
**And** skill paths for reference (IDE surfaces, not Hermes): `.claude/skills/bmad-code-review/`, `.claude/skills/bmad-review-adversarial-general/`, `.claude/skills/bmad-review-edge-case-hunter/` (and `.cursor/skills/` mirrors where present)

### AC3 — Verify placement: post-approval only, NEVER cron Discover (HARD)

**Given** DDR Decision 3 (schedule split) and Decision 4a (Verify proven once, then dormant)  
**When** Verify documentation and task-prompt are updated  
**Then** Verify runs **only** on the operator-invoked post-approval path — i.e. after `unified-loop approve-build` (within Build→Verify→Persist sequence)  
**And** Verify is **explicitly gated** — documented as forbidden on:

- `unified-loop cron:discover`
- WSL cron tag `cns-unified-loop-discover`
- Any Discover-only / read-only path

**And** task-prompt states Verify is **never** auto-fired on recurring schedule or cron  
**And** the three review skills are **paid** — the loop must **not** auto-invoke them without operator action (4a posture)

### AC4 — Build and Persist remain placeholders (84-3 scope boundary)

**Given** DDR story handoff table  
**When** this story closes  
**Then** **Build** and **Persist** stages remain **documented placeholders only** in task-prompt / SKILL.md — execution wiring deferred to **84-3**  
**And** 84-2 may document Verify handoff contract and post-Build sequencing **without** implementing Build or Persist execution

### AC5 — One documented Verify dry-run (evidence artifact)

**Given** DDR Decision 4a requires one Verify dry-run then dormant capability  
**When** implementation completes  
**Then** evidence doc `_bmad-output/implementation-artifacts/84-2-verify-evidence.md` exists mirroring `84-1-governance-evidence.md` pattern  
**And** evidence captures **invocation paths + outputs** for all three review skills against **84-1 diff** (`git diff 3f5d4af..1d6d77e` or `git show 1d6d77e`) per operator decision **#1B**  
**And** evidence records 4a posture: Verify proven once — **not** wired to recurring schedule/cron after proof

### AC6 — Contract tests extended

**Given** `tests/hermes-unified-loop-skill.test.mjs` from 84-1  
**When** this story completes  
**Then** tests assert:

- `references/task-prompt.md` and/or `SKILL.md` name all three review skills by exact ID
- Verify is documented as **post-approval-only** (gated; never cron)
- Verify is documented as **not** on recurring schedule (4a dormant-after-proof language)

### AC7 — Verify gate (NFR1, HARD)

**Given** implementation complete  
**When** `bash scripts/verify.sh` runs  
**Then** it passes with no regressions

---

## Resolved operator decisions (2026-07-06)

| # | Choice | Locked value | Dev-story binding |
|---|--------|--------------|-------------------|
| **1** | **B** | One Verify dry-run: document invocation contract **+ run all three review skills once** against **84-1's committed diff** (`1d6d77e`; `git diff 3f5d4af..1d6d77e`, ~14 files, unified-loop skill mirror, no protect-list) | Evidence doc `84-2-verify-evidence.md` must capture **real outputs** from `bmad-code-review`, `bmad-review-adversarial-general`, and `bmad-review-edge-case-hunter` on that diff. Est. cost ~$2–6. |
| **2** | **A** | **Handoff STOP block** — `references/task-prompt.md` §Verify + **new** `references/verify-handoff.md` | On `unified-loop approve-build`, Hermes **STOPs** after Build placeholder ack and posts `#hermes` Verify handoff. Operator runs three BMAD skills in **Cursor** (or Claude Code); saves outputs to evidence doc. **No** terminal/CLI wrapper; **no** inline Hermes review. |

**Dry-run diff command (locked #1B):**

```bash
git diff 3f5d4af..1d6d77e
# or: git show 1d6d77e --stat
```

**Handoff surfaces (locked #2A):** `references/verify-handoff.md` (SSOT for operator procedure); task-prompt §Verify links to it; governance module §Verify cross-references after session-close apply.

---

## Tasks / Subtasks

- [x] **Lock operator decisions** — #1B + #2A recorded; status `ready-for-dev`
- [x] **AC2 — Wire Verify in existing skill mirror** (AC: #2, #3, #4)
  - [x] Replace task-prompt §7 Verify placeholder with Verify stage spec (post-approval-only, three skills, handoff #2A)
  - [x] Add `references/verify-handoff.md` — invocation contract, skill order, Cursor `/bmad-*` triggers, diff scope, output capture → `84-2-verify-evidence.md`
  - [x] Update `SKILL.md` stage table: Verify → **documented + handoff** (not placeholder); Build/Persist remain placeholders
  - [x] Update `references/trigger-pattern.md` — Verify only on `unified-loop approve-build` path
- [x] **AC3 — Cron safety** (AC: #3)
  - [x] Explicit negative: Verify forbidden on `cron:discover` and discover cron job
  - [x] Document 4a dormant-after-proof in task-prompt + governance draft
- [x] **AC5 — Verify dry-run evidence** (AC: #5)
  - [x] Create `84-2-verify-evidence.md` per locked #1B
  - [x] Run all three review skills in Cursor against `git diff 3f5d4af..1d6d77e`; capture invocation paths + real outputs
- [x] **AC6 — Governance module delta** (AC: #2, #3)
  - [x] Draft Verify section for `AI-Context/modules/unified-loop.md` — apply via **session-close WriteGate only** (mirror 84-1 AC7)
- [x] **AC6 — Contract tests** (AC: #6, #7)
  - [x] Extend `tests/hermes-unified-loop-skill.test.mjs`
  - [x] `bash scripts/verify.sh` green
- [x] **AC1 — Protect-list audit** (AC: #1)
  - [x] Confirm zero diffs on five protect-list paths

---

## Dev Notes

### Locked DDR constraints (do not re-decide)

```yaml
# ~/.hermes/config.yaml — OUT OF SCOPE to change
approvals:
  mode: manual
  timeout: 60
  cron_mode: deny
```

**Cost posture (Decision 4a):** One Verify dry-run (this story) + one E2E approval-pause dry-run (84-3). Paid Verify/Build/Persist **capable but not on recurring schedule**. After proof, Verify capability is **dormant** — documented, not auto-fired.

**Schedule split (Decision 3):**

| Stage | Trigger | Verify allowed? |
|-------|---------|-----------------|
| Discover | Cron / `unified-loop cron:discover` | **NO** |
| Build → Verify → Persist | `unified-loop approve-build` only | **YES** (Verify sub-stage) |

### Composition map (Verify slice — 84-2 scope)

```
unified-loop approve-build  (operator post-approval — manual only)
        │
        ├── Build ─── placeholder (84-3)
        │
        ├── Verify ──┬── bmad-code-review
        │              ├── bmad-review-adversarial-general
        │              └── bmad-review-edge-case-hunter
        │              [handoff to Cursor — operator decision #2A]
        │
        └── Persist ─ placeholder (84-3)
```

### Files to EDIT (not create new skill)

| Location | Action |
|----------|--------|
| `scripts/hermes-skill-examples/unified-loop/references/task-prompt.md` | **UPDATE** — replace §7 Verify placeholder with wired spec |
| `scripts/hermes-skill-examples/unified-loop/references/verify-handoff.md` | **NEW** (#2A) — operator handoff contract |
| `scripts/hermes-skill-examples/unified-loop/SKILL.md` | **UPDATE** — Verify stage status, post-approval gate |
| `scripts/hermes-skill-examples/unified-loop/references/trigger-pattern.md` | **UPDATE** — Verify placement |
| `tests/hermes-unified-loop-skill.test.mjs` | **UPDATE** — three skill names, post-approval-only, no cron |
| `_bmad-output/implementation-artifacts/84-2-verify-evidence.md` | **NEW** — dry-run evidence |
| `AI-Context/modules/unified-loop.md` | **UPDATE via session-close WriteGate** — Verify section |
| `~/.hermes/skills/cns/unified-loop/**` | Reinstall via `bash scripts/install-hermes-skill-unified-loop.sh` |

**FORBIDDEN:** New Hermes skill directory; protect-list paths; new review logic/scripts.

### Review skills — invocation reference (for handoff doc)

| Skill | Trigger examples | Output shape |
|-------|------------------|--------------|
| `bmad-code-review` | `/bmad-code-review` on `branch changes` / `uncommitted changes` | Structured triage categories |
| `bmad-review-adversarial-general` | Attach skill; provide diff/content | Markdown findings list (≥10 items expected) |
| `bmad-review-edge-case-hunter` | Attach skill; provide diff/content | JSON array `[{location, trigger_condition, guard_snippet, potential_consequence}]` |

Skill roots: `.claude/skills/bmad-code-review/SKILL.md`, `.claude/skills/bmad-review-adversarial-general/SKILL.md`, `.claude/skills/bmad-review-edge-case-hunter/SKILL.md`

### Architecture compliance

- **NFR2:** Zero protect-list edits; edit existing unified-loop mirror only
- **NFR-GOV-1:** Governance module delta via session-close WriteGate
- **NFR1:** `bash scripts/verify.sh` must pass
- **FR22:** Verify move completes composed loop documentation (Build/Persist remain 84-3)
- **4a:** No cron/recurring wiring for paid Verify skills

### Testing requirements

Extend `tests/hermes-unified-loop-skill.test.mjs`:

1. Assert task-prompt (or verify-handoff) contains exact strings: `bmad-code-review`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`
2. Assert post-approval-only language: Verify tied to `unified-loop approve-build`; forbidden on `cron:discover` / discover cron
3. Assert 4a dormant language: not on recurring schedule; prove-once dry-run
4. Assert Build/Persist still placeholders (84-3 boundary)
5. Full `bash scripts/verify.sh`

### Previous story intelligence (84-1)

From **84-1** (`1d6d77e`):

- Repo mirror at `scripts/hermes-skill-examples/unified-loop/` — **edit this tree**, do not create parallel skill
- task-prompt §7 currently lists Verify as placeholder with three skill names — **84-2 promotes to executable handoff spec**
- Contract test pattern in `tests/hermes-unified-loop-skill.test.mjs` — extend, don't duplicate
- Governance evidence pattern: `84-1-governance-evidence.md` — session-close WriteGate for `AI-Context/modules/unified-loop.md`
- On `unified-loop approve-build` in 84-1: skill replies Build/Verify/Persist deferred — **84-2 replaces Verify portion only**

From **75-3** (run-chain Hermes skill):

- Hermes skills invoke **CLI via terminal()** when target is a script; **documented procedure** when target is IDE-only
- `#hermes` bounded output templates for handoff/failure

### Git intelligence

Recent Epic 84 commits:

- `d91eee4` — chore(84-1): mark story done after verified review
- `1d6d77e` — feat(84-1): Unified Loop governance + discover-only schedule shell (14 files, skill mirror)
- `3f5d4af` — docs(84): DDR-E84-001 locked 4a

84-2 diff target for dry-run option (b): `git diff 3f5d4af..1d6d77e` or `git show 1d6d77e` file list.

### Project context reference

- DDR: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`
- Story 84-1: `_bmad-output/implementation-artifacts/84-1-unified-loop-governance-schedule-shell.md`
- Evidence template: `_bmad-output/implementation-artifacts/84-1-governance-evidence.md`
- Constitution: `specs/cns-vault-contract/AGENTS.md`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`

---

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- Fixed 84-1 contract test: version assertion updated to semver pattern after SKILL bump to 1.1.0

### Completion Notes List

- Wired Verify as operator handoff (#2A) composing `bmad-code-review`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter` by exact skill ID — no new review logic in Hermes files
- Added `references/verify-handoff.md` SSOT; updated task-prompt §7, SKILL.md (v1.1.0), trigger-pattern.md with post-approval-only gate and cron forbidden language
- Created `84-2-verify-evidence.md` with prove-once dry-run outputs from all three review skills against `git diff 3f5d4af..1d6d77e`
- Governance Verify delta drafted in evidence file for session-close WriteGate (not direct vault edit)
- Extended contract tests (Story 84-2 describe block); `bash scripts/verify.sh` PASS
- Protect-list audit: zero diffs on five forbidden paths

### File List

- `scripts/hermes-skill-examples/unified-loop/references/verify-handoff.md` (new)
- `scripts/hermes-skill-examples/unified-loop/references/task-prompt.md` (updated §7)
- `scripts/hermes-skill-examples/unified-loop/SKILL.md` (updated stages, v1.1.0)
- `scripts/hermes-skill-examples/unified-loop/references/trigger-pattern.md` (Verify cron forbidden)
- `tests/hermes-unified-loop-skill.test.mjs` (84-2 tests + version pattern fix)
- `_bmad-output/implementation-artifacts/84-2-verify-evidence.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (84-2 → review)

### Change Log

- 2026-07-06: Story 84-2 — Verify handoff wiring, dry-run evidence, contract tests; verify.sh green

---

## References

- [Source: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`] — LOCKED input of record
- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 84-2]
- [Source: `_bmad-output/implementation-artifacts/84-1-unified-loop-governance-schedule-shell.md`]
- [Source: `_bmad-output/implementation-artifacts/84-1-governance-evidence.md`]
- [Source: `scripts/hermes-skill-examples/unified-loop/references/task-prompt.md` §7]
- [Source: `.claude/skills/bmad-code-review/SKILL.md`]
- [Source: `.claude/skills/bmad-review-adversarial-general/SKILL.md`]
- [Source: `.claude/skills/bmad-review-edge-case-hunter/SKILL.md`]
- [Source: `_bmad-output/implementation-artifacts/75-3-hermes-run-chain-trigger-skill.md` — Hermes handoff pattern]
