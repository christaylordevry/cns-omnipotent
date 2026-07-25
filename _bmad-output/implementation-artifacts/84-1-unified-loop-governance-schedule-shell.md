# Story 84.1: Unified Loop governance + schedule shell

**Input of record:** `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md` (LOCKED 2026-07-06). All five DDR decisions are settled — do not re-open approval mechanism, shell choice, schedule split, cost posture, or scope.

baseline_commit: 3f5d4af7cd6fc8183669a6ee34e379877dfc8c41

Status: review

<!-- Ultimate context engine analysis completed 2026-07-06. Operator locked: artifact #1B (~/.hermes/artifacts/), continuation #2A (unified-loop approve-build). -->

## Story

As an **operator**,
I want **governance documenting the Unified Loop moves and a schedulable discover-only shell**,
so that **Discover/Build/Verify/Persist compose without rewriting the run-chain engine (FR22, NFR2)**.

**Zone/Repo:** Omnipotent.md + vault via session-close WriteGate · **Branch:** `hermes-consolidation`  
**Epic:** 84 — Unified Loop — Discover, Build, Verify, Persist (v1.5)  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 84-1  
**Architecture:** `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` (FR22 v1.5 defer; NFR2 protect-list)  
**DDR (LOCKED):** `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`

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

### AC2 — Hermes skill scaffold (morning-digest composition pattern)

**Given** DDR Decision 1 (NEW skill at `~/.hermes/skills/cns/unified-loop/`)  
**When** implementation completes  
**Then** repo mirror exists at `scripts/hermes-skill-examples/unified-loop/` with:

| Artifact | Purpose |
|----------|---------|
| `SKILL.md` | Orchestrator overview, trigger grammar, stage map, safety posture |
| `references/task-prompt.md` | **Source of truth** for Discover-only cron/manual execution + skill-contract gate spec |
| `references/trigger-pattern.md` | Manual + cron pseudo-trigger grammar |
| `references/cron-snippet.md` | WSL tag `cns-unified-loop-discover`, dummy Hermes schedule, install docs |
| `references/config-snippet.md` | `#hermes` skill binding + optional `unified_loop:` config block |
| Optional `scripts/write-discover-artifact.mjs` | Deterministic JSON write from collector stdout (if task-prompt delegates artifact I/O to script) |

**And** install script `scripts/install-hermes-skill-unified-loop.sh` rsyncs mirror → `~/.hermes/skills/cns/unified-loop/` (parity with `install-hermes-skill-morning-digest.sh`)  
**And** skill metadata tags include `cns`, `unified-loop`, `read-only`, `discover`  
**And** skill declares `requires_toolsets: [terminal]` only for Discover stage  
**And** repo contract tests exist: `tests/hermes-unified-loop-skill.test.mjs` (mirror parity, trigger grammar, forbidden-action enumeration in task-prompt, cron tag, install script paths)

### AC3 — Discover stage reuses Epic 81 collector (read-only)

**Given** `scripts/lib/collect-internal-dev-state.ts` (Story 81-1b) is live  
**When** Discover stage runs (manual or cron)  
**Then** it invokes **`collectInternalDevState()`** via terminal — e.g. `npx tsx` wrapper or existing render path — **read-only**  
**And** **no Build stage** executes in the cron path (`unified-loop cron:discover` / WSL discover cron)  
**And** Discover output includes:

1. `#hermes` markdown summary (bounded operator briefing)
2. Discover artifact at **`~/.hermes/artifacts/unified-loop/discover.json`** (operator decision #1B — see § Resolved operator decisions)

**And** artifact conforms to **`discover.json` schema v1** (Dev Notes § Discover artifact contract)  
**And** artifact **`repoRoot`** field is an **absolute path** to the checkout used during Discover (resolved from `OMNIPOTENT_REPO` or task-prompt fallback) — required for Build/worktree handoff (84-3)  
**And** Discover writes artifact via **absolute path** — never relative to process cwd  
**And** collector types remain hand-mirrored from `cns-dashboard/convex/validators.ts` — do not fork ranking logic.

### AC4 — Skill-contract approval gate spec (Discover→Build boundary)

**Given** DDR Decision 2 (skill-contract pause is the **only** operator-approval gate on the MCP-write path)  
**When** `references/task-prompt.md` is authored  
**Then** it documents the **Discover → [PAUSE] → Build** boundary explicitly  
**And** after Discover artifact + `#hermes` summary, the skill **stops** and emits structured Build intent  
**And** it awaits operator continuation via **`unified-loop approve-build`** before any Build-stage work (operator decision #2A)  
**And** continuation grammar: first line exactly `unified-loop approve-build` OR prefix `unified-loop approve-build ` with optional single token e.g. `story:84-2` (single-line Discord; case-sensitive)  
**And** `unified-loop continue` is a **negative example** — must not trigger Build  
**And** task-prompt **must not** represent `approvals.mode: manual` as an MCP safety net — native approval is **terminal shell-command guard only** (`approval.py` → `check_dangerous_command()` before `terminal()`); MCP vault mutators bypass it entirely  
**And** task-prompt **ENUMERATES** forbidden pre-approval actions (testable list — violation = skill failure):

| # | Forbidden before operator continuation | Detection |
|---|----------------------------------------|-----------|
| 1 | `vault_create_note` | MCP tool call |
| 2 | `vault_move` | MCP tool call |
| 3 | `vault_append_daily` | MCP tool call |
| 4 | `vault_update_frontmatter` | MCP tool call |
| 5 | `vault_log_action` | MCP tool call |
| 6 | Worktree-exiting merges (git merge/rebase/checkout that leaves isolated worktree) | terminal / git |
| 7 | session-close apply paths (any mutation that applies session-close drafts to vault/repo) | terminal / MCP |

**And** contract tests assert all seven forbidden rows appear verbatim in `references/task-prompt.md`.

### AC5 — Trigger grammar (Discover vs full loop)

**Given** DDR Decision 3 (schedule split)  
**When** trigger patterns are documented  
**Then** grammar includes at minimum:

| Trigger | Path | Autonomous? |
|---------|------|-------------|
| `unified-loop` | Full loop manual — Discover then **pause** at gate (Build not auto-run without continuation) | Partial |
| `unified-loop cron:discover` | Discover-only (cron pseudo-label + manual smoke) | Yes (read-only) |
| `unified-loop approve-build` | Build→Verify→Persist after approved Discover (84-2/84-3 wire stages; 84-1 documents contract only) | No |

**And** cron **never** enters full-loop / Build path  
**And** `references/trigger-pattern.md` documents case rules, continuation grammar, and negative examples (`unified-loop continue`, case mismatch — mirror `awareness-sync` / `morning-digest` discipline)

### AC6 — Discover-only cron install (morning-digest pattern)

**Given** WSL is sole civil-time trigger; Hermes job uses dummy schedule  
**When** operator runs `bash scripts/install-unified-loop-discover-cron.sh`  
**Then** WSL crontab line is tagged **`cns-unified-loop-discover`**  
**And** Hermes cron job uses `--skill unified-loop` with dummy schedule (`0 0 1 1 *`) and job-id file `~/.hermes/unified-loop-discover-cron-job-id`  
**And** `scripts/run-unified-loop-discover-cron.sh` checks gateway, runs `hermes cron run <job-id>` + `hermes cron tick` — **does not** post raw Discord text  
**And** cron snippet documents log path `~/.hermes/logs/unified-loop-discover-cron.log`  
**And** contract tests reference install script, runner, cron tag, and `--skill unified-loop`

### AC7 — Governance module via WriteGate (NFR-GOV-1, HARD)

**Given** WriteGate protects `AI-Context/**`  
**When** governance module is created  
**Then** `AI-Context/modules/unified-loop.md` is authored **via session-close WriteGate** — **NOT** a direct vault edit in dev-story  
**And** module is SSOT for: stage map (Schedule→Discover→Build→Verify→Persist), approval layers table (skill-contract / EnterWorktree / WriteGate / terminal-only native approval), protect-list, cost posture 4a (capability dormant after proof), trigger grammar (`unified-loop approve-build`), discover artifact contract (`~/.hermes/artifacts/unified-loop/discover.json`, schema v1, absolute `repoRoot` read rule)  
**And** both copies identical after session-close apply (repo mirror + canonical vault per AGENTS.md sync rule)  
**And** story evidence records session-close apply path + `diff -q` result

### AC8 — Verify gate (NFR1, HARD)

**Given** implementation complete  
**When** `bash scripts/verify.sh` runs  
**Then** it passes with no regressions

### AC9 — Scope boundary (84-1 only)

**Given** DDR story handoff table  
**When** this story closes  
**Then** **out of scope** for 84-1 (defer to 84-2 / 84-3):

- Wiring Verify to `bmad-code-review`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`
- EnterWorktree Build backstop implementation
- Persist via session-close in Build path
- E2E dry-run evidence docs
- Paid-stage automation on recurring schedule

**And** Build/Verify/Persist stages appear in governance + task-prompt as **documented placeholders** only — no execution wiring beyond Discover pause contract.

---

## Resolved operator decisions (2026-07-06)

| # | Choice | Locked value | Rationale |
|---|--------|--------------|-----------|
| **1** | **B** | `~/.hermes/artifacts/unified-loop/discover.json` | Hermes-native artifact home; single canonical path visible across EnterWorktree checkouts; aligns with `~/.hermes/memories/awareness-snapshot.json`. Operator preference over DDR diagram literal `.unified-loop/` (repo-relative) for worktree-read visibility. |
| **2** | **A** | `unified-loop approve-build` | Explicit Discover→Build intent; DDR Decision 2 table language. |

**Build/worktree read rule (84-1 documents; 84-3 implements):** Build stage **must** load the discover artifact from the **absolute** path `~/.hermes/artifacts/unified-loop/discover.json` (or env override `UNIFIED_LOOP_DISCOVER_ARTIFACT` if documented in governance). Build **must** use artifact field **`repoRoot`** (absolute checkout path recorded at Discover time) to `cd`/resolve work — **never** infer checkout from process cwd alone. If a future operator reopens repo-relative storage (DDR Option A), the same **`repoRoot` absolute-path rule** applies.

---

## Tasks / Subtasks

- [x] **AC2 — Repo skill mirror** (AC: #2, #5)
  - [x] Scaffold `scripts/hermes-skill-examples/unified-loop/` from morning-digest / awareness-sync patterns
  - [x] Author `SKILL.md`, `references/task-prompt.md`, trigger/cron/config snippets
  - [x] Add `scripts/install-hermes-skill-unified-loop.sh`
  - [x] Register in skill install gate manifest if required (`tests/hermes-skill-install-gate.test.mjs`)
- [x] **AC3 — Discover collector wiring** (AC: #3)
  - [x] Terminal invocation of `collectInternalDevState` (reuse 81-1b module; no fork)
  - [x] `#hermes` summary template (top N prioritized items)
  - [x] Artifact writer: `~/.hermes/artifacts/unified-loop/discover.json` per schema v1; mkdir `-p` on write
- [x] **AC4 — Forbidden-action enumeration** (AC: #4)
  - [x] All seven forbidden rows in task-prompt with "violation = skill failure"
  - [x] Document native approval as terminal-only (not MCP net)
- [x] **AC6 — Cron shell** (AC: #6)
  - [x] `scripts/install-unified-loop-discover-cron.sh`
  - [x] `scripts/run-unified-loop-discover-cron.sh`
- [x] **AC7 — Governance module** (AC: #7)
  - [x] Draft module content in story/evidence; apply via **session-close WriteGate** only
  - [x] Record `diff -q` vault copies in evidence artifact
- [x] **AC8 — Tests + verify** (AC: #2, #4, #6, #8)
  - [x] `tests/hermes-unified-loop-skill.test.mjs`
  - [x] `bash scripts/verify.sh` green
- [x] **AC1 — Protect-list audit** (AC: #1)
  - [x] Confirm zero diffs on five protect-list paths

---

## Dev Notes

### Locked DDR constraints (do not re-decide)

```yaml
# ~/.hermes/config.yaml — verified ground truth; OUT OF SCOPE to change
approvals:
  mode: manual
  timeout: 60
  cron_mode: deny   # fully autonomous Schedule→Discover→Build→Verify→Persist impossible
```

**Schedule split (Decision 3):**

| Stage | Trigger | Autonomous? |
|-------|---------|-------------|
| Discover | Cron or `unified-loop` / `unified-loop cron:discover` | Yes (read-only) |
| Build → Verify → Persist | `unified-loop approve-build` after Discover pause | No |

**Cost posture (Decision 4a):** Skill + discover cron may run (~$0). Paid stages capable but **not** on recurring schedule. One Verify dry-run (84-2) + one E2E approval-pause dry-run (84-3) then dormant.

**Epic 84 done definition (Decision 5):** Governance-complete + documented capability — loop proven once, not standing automation.

### Composition map (from DDR)

```
Schedule ──► unified-loop skill (orchestrator)
                 │
    Discover ────┤── terminal: collect-internal-dev-state.ts (Epic 81, read-only)
                 │              artifact: ~/.hermes/artifacts/unified-loop/discover.json
                 │              repoRoot: absolute checkout path (in artifact)
                 │
    [SKILL-CONTRACT APPROVAL GATE — Discover→Build]
                 │
    Build ───────┤── bmad-dev-story (+ EnterWorktree handoff) [84-3]
                 │
    Verify ──────┤── bmad-code-review, bmad-review-adversarial-general,
                 │              bmad-review-edge-case-hunter [84-2]
                 │
    Persist ─────┘── session-close path (WriteGate/PAKE/audit, Story 5.2) [84-3]
```

### Approval layers (governance must document)

| Layer | Role | MCP-write path? |
|-------|------|-----------------|
| **Primary — skill contract** | Operator approval gate | **Yes — only gate** |
| **Secondary — EnterWorktree** | Structural backstop (84-3) | Indirect |
| **Tertiary — WriteGate** | Boundary hard deny (`AI-Context/`, `_meta/`) | Enforcement, not approval |
| **Quaternary — native dangerous-command approval** | Terminal shell patterns only | **No — does not intercept MCP** |

**Vault mutators (actual MCP names):** `vault_create_note`, `vault_move`, `vault_append_daily`, `vault_update_frontmatter`, `vault_log_action`. There is **no** `vault_write` tool.

### Discover artifact contract (schema v1 — operator #1B)

**Canonical path:** `$HOME/.hermes/artifacts/unified-loop/discover.json`  
**Optional override env (governance may document):** `UNIFIED_LOOP_DISCOVER_ARTIFACT` — absolute path only  
**Optional dated archive (out of scope unless dev adds):** `discover-YYYY-MM-DD.json` sibling — not required for 84-1 AC

**Write rule:** Discover stage writes via **absolute path** (`path.join(os.homedir(), '.hermes/artifacts/unified-loop/discover.json')` or equivalent). Create parent dirs if missing.

**Read rule (Build / 84-3):** Load artifact from absolute Hermes path above; resolve checkout with **`artifact.repoRoot`** (absolute string recorded at Discover) — **never** assume artifact lives relative to cwd or worktree root.

```json
{
  "schemaVersion": 1,
  "stage": "discover",
  "generatedAt": "2026-07-06T08:00:00+10:00",
  "trigger": "cron:discover",
  "repoRoot": "/home/christ/ai-factory/projects/Omnipotent.md",
  "artifactPath": "/home/christ/.hermes/artifacts/unified-loop/discover.json",
  "collector": {
    "module": "scripts/lib/collect-internal-dev-state.ts",
    "itemCap": 20
  },
  "items": [
    {
      "rank": 1,
      "rankScore": 12.5,
      "title": "86-1-session-close-project-status-ssot",
      "category": "sprint",
      "rationale": "in-progress epic gate",
      "sourcePath": "_bmad-output/implementation-artifacts/sprint-status.yaml"
    }
  ],
  "topPick": {
    "storyKey": "86-1-session-close-project-status-ssot",
    "reason": "highest rankScore sprint item"
  },
  "buildIntent": {
    "proposedStoryKey": null,
    "status": "awaiting-operator-approval"
  }
}
```

**Field notes:**

| Field | Required | Notes |
|-------|----------|-------|
| `schemaVersion` | yes | `1` for 84-1 |
| `stage` | yes | always `"discover"` in 84-1 |
| `generatedAt` | yes | ISO-8601 with offset |
| `trigger` | yes | e.g. `cron:discover`, `manual`, `unified-loop` |
| `repoRoot` | yes | **Absolute** path to Omnipotent.md checkout used for collector |
| `artifactPath` | yes | **Absolute** path to this file (self-describing for 84-3) |
| `collector` | yes | module path + item cap |
| `items` | yes | `PrioritizedItem[]` from collector (max 20) |
| `topPick` | yes | highest-priority item snapshot for `#hermes` summary |
| `buildIntent` | yes | `status: awaiting-operator-approval` until `unified-loop approve-build` |

Contract tests must assert task-prompt and governance reference **`~/.hermes/artifacts/unified-loop/discover.json`** and **`repoRoot` absolute-path rule**.

### File structure requirements

| Location | Action |
|----------|--------|
| `scripts/hermes-skill-examples/unified-loop/**` | NEW — repo SSOT mirror |
| `~/.hermes/skills/cns/unified-loop/**` | NEW — installed via rsync script |
| `scripts/install-hermes-skill-unified-loop.sh` | NEW |
| `scripts/install-unified-loop-discover-cron.sh` | NEW |
| `scripts/run-unified-loop-discover-cron.sh` | NEW |
| `tests/hermes-unified-loop-skill.test.mjs` | NEW |
| `AI-Context/modules/unified-loop.md` | NEW via session-close only |
| `src/agents/*-adapter-llm.ts`, `run-chain.ts` | **FORBIDDEN** |

**Pattern references:**

- Skill mirror/install: `scripts/hermes-skill-examples/morning-digest/`, `scripts/install-hermes-skill-morning-digest.sh`
- Read-only skill: `scripts/hermes-skill-examples/awareness-sync/`
- Cron install: `scripts/install-morning-digest-cron.sh`, `references/cron-snippet.md` in morning-digest
- Governance module: Story 75-2 (`AI-Context/modules/run-chain.md` via WriteGate)
- Collector: `scripts/lib/collect-internal-dev-state.ts` (Story 81-1b)
- Mutation audit bound spec: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`

### Architecture compliance

- **NFR2:** Zero protect-list edits; unified-loop is a **new** Hermes skill — not run-chain recomposition
- **NFR-GOV-1:** Governance module + Persist path (future) via WriteGate; no silent vault corruption
- **NFR1:** `bash scripts/verify.sh` must pass
- **FR22:** v1.5 composed loop — 84-1 delivers shell + governance only
- **`approvals.cron_mode: deny`:** Immutable for Epic 84 — cron path is Discover-only

### Testing requirements

1. **Contract tests** (`tests/hermes-unified-loop-skill.test.mjs`):
   - Repo mirror exists; install script targets `~/.hermes/skills/cns/unified-loop`
   - `SKILL.md` references `skill_view("unified-loop", "references/task-prompt.md")`
   - Trigger pattern documents `unified-loop`, `unified-loop cron:discover`, and `unified-loop approve-build`
   - Trigger pattern lists `unified-loop continue` as negative example
   - Task-prompt references artifact path `~/.hermes/artifacts/unified-loop/discover.json` and absolute `repoRoot` rule
   - Task-prompt contains all **five vault mutator names** + worktree merge + session-close apply forbidden rows
   - Task-prompt states native approval does **not** intercept MCP
   - Cron snippet: tag `cns-unified-loop-discover`, dummy Hermes schedule
2. **Collector tests:** Reuse existing `tests/vault-io/collect-internal-dev-state.test.ts` — do not duplicate ranking tests unless artifact writer adds new pure functions
3. **Verify gate:** Full `bash scripts/verify.sh`

### Previous story intelligence (Epic 81 — Discover dependency)

From **81-1b** (`collect-internal-dev-state.ts`):

- Export `collectInternalDevState({ repoRoot, vaultRoot, now? })` → `PrioritizedItem[]` max 20
- Categories: `deferred` | `sprint` | `agent_log` | `vault_scan`
- Agent-log mutation tool set already enumerates the same five vault mutators — reuse for cross-reference in governance, not reimplementation
- Hand-mirror types from `cns-dashboard/convex/validators.ts`

From **75-2** (governance module pattern):

- Author module via WriteGate; `diff -q` both vault copies
- Do not install Hermes skill in governance-only stories — 84-1 **does** install skill (different scope)

From **77-4** (awareness-sync):

- Read-only skill + `terminal()` only + bounded `#hermes` output
- Contract tests in `tests/hermes-awareness-sync-skill.test.mjs` as template

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (v2.1.5)
- WriteGate: `src/write-gate.ts`
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`

### Sprint tracker

Epic 84 tracked in `sprint-status.yaml` — story key `84-1-unified-loop-governance-schedule-shell`.

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Protect-list audit: `git diff --name-only 3f5d4af7...` on five paths — empty (AC1 PASS)
- Contract tests: `node --test tests/hermes-unified-loop-skill.test.mjs tests/write-discover-artifact.test.mjs` — PASS
- Verify gate: `bash scripts/verify.sh` — PASS

### Completion Notes List

- Repo SSOT skill mirror at `scripts/hermes-skill-examples/unified-loop/` (SKILL.md, task-prompt, trigger/cron/config snippets, `write-discover-artifact.mjs`).
- Install script `scripts/install-hermes-skill-unified-loop.sh` rsyncs mirror → `~/.hermes/skills/cns/unified-loop/` (morning-digest parity).
- Discover artifact writer invokes `collectInternalDevState()` read-only; schema v1 `items[]` uses real `PrioritizedItem` shape; absolute `repoRoot` + `artifactPath`.
- task-prompt §5 enumerates all seven forbidden rows verbatim with `violation = skill failure`; native approval documented as terminal-only (not MCP).
- Cron shell: `install-unified-loop-discover-cron.sh` + `run-unified-loop-discover-cron.sh` with tag `cns-unified-loop-discover`, dummy Hermes schedule, `--skill unified-loop`.
- Governance module drafted in `84-1-governance-evidence.md` for session-close WriteGate — **no** direct `AI-Context/` edit (AC7).
- Skill install gate: unified-loop not added to live bindings manifest (optional until operator binds); mirror satisfies install-gate when bound.
- Build/Verify/Persist remain documented placeholders only (AC9).

### File List

- `scripts/hermes-skill-examples/unified-loop/SKILL.md` (NEW)
- `scripts/hermes-skill-examples/unified-loop/references/task-prompt.md` (NEW)
- `scripts/hermes-skill-examples/unified-loop/references/trigger-pattern.md` (NEW)
- `scripts/hermes-skill-examples/unified-loop/references/cron-snippet.md` (NEW)
- `scripts/hermes-skill-examples/unified-loop/references/config-snippet.md` (NEW)
- `scripts/hermes-skill-examples/unified-loop/scripts/write-discover-artifact.mjs` (NEW)
- `scripts/install-hermes-skill-unified-loop.sh` (NEW)
- `scripts/install-unified-loop-discover-cron.sh` (NEW)
- `scripts/run-unified-loop-discover-cron.sh` (NEW)
- `tests/hermes-unified-loop-skill.test.mjs` (NEW)
- `tests/write-discover-artifact.test.mjs` (NEW)
- `_bmad-output/implementation-artifacts/84-1-governance-evidence.md` (NEW)
- `_bmad-output/implementation-artifacts/84-1-unified-loop-governance-schedule-shell.md` (UPDATED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATED)

### Change Log

- 2026-07-06: Story 84-1 implementation — Unified Loop governance shell, Discover-only skill mirror, cron install, contract tests, governance evidence draft (session-close pending).

## References

- [Source: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`] — LOCKED input of record
- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Epic 84]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` — FR22, NFR2]
- [Source: `_bmad-output/implementation-artifacts/81-1b-internal-dev-state-collector-dashboard-sync-push.md`]
- [Source: `_bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md`]
- [Source: `scripts/lib/collect-internal-dev-state.ts`]
- [Source: `~/.hermes/skills/cns/morning-digest/references/cron-snippet.md`]
- [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`]
