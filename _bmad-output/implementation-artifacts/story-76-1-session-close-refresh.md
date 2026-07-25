# Story 76.1: Session-close orientation artifact refresh

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->
<!-- Sprint key: 76-1-session-close-orientation-artifact-refresh | Branch: hermes-consolidation -->
<!-- Absorbs deferred Pre-2 (operator session-close) from sprint-status pre_implementation_checklist -->

## Story

As an **operator**,
I want **session-close to regenerate accurate AGENTS §8, MEMORY files, and AUTO blocks**,
so that **cold-start context matches Epic 72–78 / Hermes Consolidation reality (FR17, executes deferred Pre-2)**.

## Acceptance Criteria

1. **Pre-1 fixture gate (already done — verify only)**
   **Given** `pre_implementation_checklist.pre-1-fixture-fix` is `done` in `sprint-status.yaml`
   **When** dev verifies the fixture
   **Then** `tests/fixtures/session-close/section8-draft-fragment.md` starts with `### Project Status` (no blockquote preamble)
   **And** `bash scripts/verify.sh` exits 0 before operator session-close (NFR1)

2. **Portal provider prerequisite (unblocked by 74-2)**
   **Given** Epic 74 Portal migration complete (`provider: nous`, `default: anthropic/claude-sonnet-4.6` live per `HANDOFF-2026-06-24-session2-hermes-consolidation.md`)
   **When** operator runs pre-flight checks
   **Then** `hermes config get model.provider` returns `nous`
   **And** `hermes portal info` shows logged in
   **And** Discord `#hermes` gateway responds to a ping (optional spot check)

3. **Operator executes real session-close (Pre-2 / core AC)**
   **Given** AC #1–#2 pass
   **When** operator posts `/session-close` in Discord `#hermes` (not `--dry-run`)
   **Then** Phase A completes (`hermes-run-session-close.sh` → `close-report.json` without blocking `failure_class` except documented below)
   **And** Hermes LLM writes `section8-draft.md` from `section8-input.json` only (per `references/section8-synthesis.md`)
   **And** `gate-apply-section8.mjs` applies §8 to both AGENTS mirrors (repo + vault canonical)
   **And** Phase C fan-out + Discord reply render complete (best-effort fan-out failures do not block story done if orientation artifacts are correct)

4. **MEMORY.md copies reflect live sprint reality**
   **Given** successful session-close from AC #3
   **When** operator inspects both MEMORY paths
   **Then** vault `AI-Context/MEMORY.md` `## CNS State` references current phase line and first `in-progress` epic from `sprint-status.yaml` (expect **Epic 73** after T2 hygiene)
   **And** `~/.hermes/memories/MEMORY.md` `## CNS State` lists **all** `in-progress` epics in the `Epics:` line (expect **73, 76** only after T2 hygiene)
   **And** Hermes MEMORY `failure_class` is `none` (not `tests`) when verify gate is green
   **And** Tests line reflects Phase A npm capture (e.g. `tests: ok` / vitest summary — not stale pre-Portal failure)

5. **CNS-Daily-Rhythm AUTO blocks live**
   **Given** successful session-close
   **When** operator opens `AI-Context/CNS-Daily-Rhythm.md`
   **Then** `<!-- AUTO:PROVIDER -->` shows `nous / anthropic/claude-sonnet-4.6` (not `none` or `openai-codex`)
   **And** `<!-- AUTO:SPRINT -->` reflects active epics / notable story statuses from `sprint-status.yaml`
   **And** `<!-- AUTO:ROADMAP -->` table includes epics through **78** with statuses matching yaml (`epic-74` shows `done`; 74-4 remains `backlog` at story level)
   **And** `<!-- AUTO:TESTS -->` matches close-report tests step
   **And** footer `*Last auto-update: … | Provider: nous/…*` is today's date

6. **AGENTS §8 matches sprint-status.yaml**
   **Given** `section8-input.json` built from `readSprintSnapshot()` / `buildActiveEpics()`
   **When** operator compares vault `AI-Context/AGENTS.md` §8 to yaml
   **Then** `### Project Status` bullets list only epics present in `input.sprint.active_epics` (in-progress epics + notable story rows)
   **And** `### Current Priorities` mention Hermes Consolidation next steps (76-2+, 75-1, or 74-4 as appropriate — derived from input, not invented)
   **And** `### Recent Session Context` bullets cite recent story files from `_bmad-output/implementation-artifacts/` (e.g. 74-8, 74-7)
   **And** both AGENTS copies remain byte-identical (constitution sync rule)

7. **No spurious `failure_class: tests`**
   **Given** `bash scripts/verify.sh` passes on `hermes-consolidation` before close
   **When** close-report is read
   **Then** `failure_class` is not `tests`
   **And** if Phase A tests step failed, dev fixes root cause (do not waive unless tests genuinely red and documented in completion notes)

8. **Protect-list + scope boundary (NFR2)**
   **Given** this story is orientation / operator-run
   **When** implementation completes
   **Then** zero diffs in protect-list paths:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** dev changes limited to session-close scripts/tests only if AC #3–#7 cannot pass without code fixes

## Tasks / Subtasks

### Dev (pre-operator — minimal)

- [ ] **T1 — Verify Pre-1 fixture + verify gate** (AC: #1, #7)
  - [ ] Confirm `tests/fixtures/session-close/section8-draft-fragment.md` has no blockquote preamble
  - [ ] Run `bash scripts/verify.sh` on `hermes-consolidation`; fix only session-close-related failures
  - [ ] **T2 — Sprint hygiene for accurate orientation (before operator close)** (AC: #4–#6)
  - [x] Mark `epic-72: done` in `sprint-status.yaml` (all 72-x stories `done`) — applied 2026-06-24
  - [x] **`epic-74: done`** — operator decision 2026-06-24: functionally complete per handoff; 74-4 remains `backlog` (non-blocking). Reopen `epic-74: in-progress` only if/when 74-4 is picked up
  - [x] Set `epic-76: in-progress` (auto via create-story)
  - [ ] Do **not** edit vault `AGENTS.md` directly — session-close applies §8
- [ ] **T3 — Code fixes only if dry-run proves gap** (AC: #4–#7)
  - [ ] Run Phase A dry-run: `node scripts/session-close/run-deterministic.mjs --dry-run` from repo root with `OMNIPOTENT_REPO` set
  - [ ] Inspect `.session-close/context-pack.json` + preview MEMORY/rhythm output
  - [ ] Patch `scripts/session-close/**` only if markers/§8/MEMORY logic is wrong vs yaml

### Operator (primary — executes Pre-2)

- [ ] **T4 — Pre-flight** (AC: #2)
  - [ ] `hermes config get model.provider` → `nous`
  - [ ] `hermes config get model.default` → `anthropic/claude-sonnet-4.6`
  - [ ] `pgrep -f 'hermes gateway'` or watchdog log confirms gateway up
- [ ] **T5 — Run session-close in Discord** (AC: #3)
  - [ ] Post `/session-close` in `#hermes`
  - [ ] Wait for Phase A → §8 synthesis → gate apply → Phase C → Discord reply
  - [ ] Save `close-report.json` path: `OMNIPOTENT_REPO/.session-close/close-report.json`
- [ ] **T6 — Verify orientation artifacts** (AC: #4–#7)
  - [ ] Vault `AI-Context/MEMORY.md` + `~/.hermes/memories/MEMORY.md`
  - [ ] Vault `AI-Context/CNS-Daily-Rhythm.md` AUTO blocks + footer
  - [ ] Vault `AI-Context/AGENTS.md` §8 vs `sprint-status.yaml`
  - [ ] Confirm repo mirror `specs/cns-vault-contract/AGENTS.md` matches vault copy
- [ ] **T7 — Record evidence in story Dev Agent Record** (AC: all)
  - [ ] Paste truncated Discord reply summary
  - [ ] Note `failure_class`, AGENTS version bump, provider line, epic lines from both MEMORY files
  - [ ] Mark story `done` in sprint-status after verification

## Dev Notes

### What this story is (and is not)

- **IS:** First real `/session-close` after Portal restore; executes **Pre-2** deferred since Hermes Consolidation kickoff (provider was `none` pre-74-2).
- **IS NOT:** Full FR17 scope (project-context sync = **76-2**, fast-scan/inbox = **76-3**, governance stubs = **76-4**). This story only refreshes artifacts that session-close already owns: §8, both MEMORY surfaces, AUTO blocks.
- **Operator-run:** Dev does not run Discord session-close; dev ensures verify gate green and fixes session-close code if deterministic path is wrong.

### Session-close pipeline (do not reinvent)

| Phase | Entry | Writes |
|-------|--------|--------|
| A | `scripts/session-close/hermes-run-session-close.sh` → `run-deterministic.mjs` | export, fast-scan, **npm test capture**, vault `MEMORY.md` (`write-memory.mjs`), `CNS-Daily-Rhythm.md` AUTO blocks (`refresh-daily-rhythm.mjs`), `context-pack.json`, `section8-input.json` |
| B | Hermes skill LLM + `gate-apply-section8.mjs` | `AI-Context/AGENTS.md` §8 + repo mirror via apply |
| C | NotebookLM fan-out scripts | Drive sync / `source_add` (best-effort) |
| Post | `update-memory-cns-state.mjs` (via skill after apply) | `~/.hermes/memories/MEMORY.md` `## CNS State` block |

Hermes skill router: `scripts/hermes-skill-examples/session-close/SKILL.md` v**1.0.16** (installed to `~/.hermes/skills/cns/session-close/`). After skill edits: `bash scripts/install-hermes-skill-session-close.sh` + gateway restart.

### Two MEMORY.md copies — different writers

| Path | Writer | Epic signal |
|------|--------|-------------|
| `Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` | `write-memory.mjs` → `buildMemoryMarkdown()` | **First** `in-progress` epic only + recent done story IDs |
| `~/.hermes/memories/MEMORY.md` | `update-memory-cns-state.mjs` → `buildCnsStateBlock()` | **All** `in-progress` epic numbers in `Epics:` line |

Both must be checked at T6. If vault MEMORY still says `Epic 48` or `openai-codex`, orientation is stale.

### sprint-status.yaml — SSOT for session-close

`readSprintSnapshot()` → `buildActiveEpics()` includes epics where `development_status` value is `in-progress`, plus notable story rows (`ready-for-dev`, `review`, `deferred`, `done`) per epic.

**Current expected state (2026-06-24, branch `hermes-consolidation`):**

| Epic key | Yaml status | Notes |
|----------|-------------|-------|
| epic-72 | **`done`** | Applied 2026-06-24 — all 72-x stories complete |
| epic-73 | `in-progress` | 73-7 `in-progress`, 73-8 `backlog` |
| epic-74 | **`done`** | Operator decision 2026-06-24 — functionally complete; 74-4 `backlog` non-blocking; reopen epic if 74-4 picked up |
| epic-75–78 | `backlog` | Hermes Consolidation track |
| epic-76 | `in-progress` | Set by create-story |

Epics file AC text ("72 done, 73 in-progress, 74+ backlog") is **stale** — session-close reflects **yaml**. T2 complete: epic-72 and epic-74 `done`; active in-progress epics are **73** and **76** only.

### CNS-Daily-Rhythm AUTO markers

Tags refreshed by `refreshRhythmDocument()` / `applyAutoMarkers()`:

`PROVIDER`, `VAULT_NOTES`, `VAULT_HEALTH`, `SPRINT`, `AGENTS_VERSION`, `SKILLS_COUNT`, `TESTS`, `LAST_SESSION`, `ACTIVE_PROJECTS`, `DEFERRED_SUMMARY`, `ROADMAP`

- **PROVIDER** reads `~/.hermes/config.yaml` via `readHermesProviderLine()` — must show `nous / anthropic/claude-sonnet-4.6` post-74-2.
- **ROADMAP** reads themes from `_bmad-output/planning-artifacts/epics.md` — **epics 72–78 titles are NOT in epics.md** (only in `epics-hermes-consolidation.md`), so theme column may show generic `Epic 74` until epics index updated (**76-2** or optional epics.md stub). **Status column** still comes from yaml and must be correct.
- **Pre-3** (`CNS-Daily-Rhythm.md` static body rows for Epic 42 DONE, stack, URL) remains optional — not a blocker for 76-1.

### AGENTS §8 / WriteGate

- **Never** direct-edit vault `AI-Context/AGENTS.md` in dev tasks — use session-close apply path.
- Constitution rule: repo `specs/cns-vault-contract/AGENTS.md` and vault canonical copy must match after apply.
- §8 LLM input is **bounded**: only `section8-input.json` fields (`sprint.active_epics`, `recent_stories`, `agents.section8_excerpt`). LLM must not read yaml or story files directly.

### Phase A tests step

`run-deterministic.mjs` runs `npm test` capture into `close-report.json` `steps.tests`. Failure sets `failure_class: tests` and blocks clean close. Pre-1 fixed fixture drift that caused false §8 gate failures; verify gate must be green before operator close.

### Protect-list (forbidden)

No edits unless operator explicitly authorizes FR11-B:

```
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
scripts/run-chain.ts
```

Also leave untouched: NEXUS bridge, morning-digest cron scripts, Vault IO MCP mutators for AGENTS.

## Architecture Compliance

- **FR17** (orientation artifact regeneration): §8, MEMORY, AUTO blocks — this story [Source: `epics-hermes-consolidation.md` Epic 76]
- **NFR1**: `bash scripts/verify.sh` before story done
- **NFR2**: protect-list + non-destructive consolidation [Source: `architecture-hermes-consolidation.md` operatorConstraints.untouched]
- **ADR session-close FR17-19**: Phase A deterministic → bounded §8 LLM → gate apply [Source: `architecture-session-close-fr17-19.md`]
- **WriteGate**: AGENTS mutations via session-close only [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`, Story 5.2 audit if touching vault_log_action — unlikely here]

## Library / Framework Requirements

- **Hermes Agent** `/nousresearch/hermes-agent` — provider `nous`, gateway restart after skill install [Context7: `hermes config set model.provider nous`; gateway `stop && start`]
- **Node** v24.14.0 path used in SKILL.md for `gate-apply-section8.mjs`
- **No new npm packages** — use existing session-close toolchain only

## File Structure Requirements

| Action | Path |
|--------|------|
| Read | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Read | `scripts/hermes-skill-examples/session-close/SKILL.md` |
| Read | `scripts/session-close/run-deterministic.mjs` |
| Read | `scripts/session-close/lib/read-sources.mjs` (`buildActiveEpics`, `readSprintSnapshot`) |
| Read | `scripts/session-close/lib/update-memory-cns-state.mjs` |
| Read | `scripts/session-close/lib/rhythm-markers.mjs` |
| Read | `tests/fixtures/session-close/section8-draft-fragment.md` |
| Maybe update | `sprint-status.yaml` (epic status hygiene only) |
| Maybe update | `scripts/session-close/**`, `tests/session-close*.mjs` — only if AC fail |
| Operator output | `Knowledge-Vault-ACTIVE/AI-Context/{AGENTS.md,MEMORY.md,CNS-Daily-Rhythm.md}` |
| Operator output | `~/.hermes/memories/MEMORY.md` |
| Operator output | `.session-close/close-report.json` |

## Testing Requirements

1. `bash scripts/verify.sh` — mandatory gate (CNS + cns-dashboard when sibling present)
2. `npm run test:vitest -- tests/session-close-pipeline.test.mjs tests/session-close-token-gate.test.mjs tests/hermes-session-close-skill.test.mjs` — if touching session-close code
3. Dry-run smoke: `node scripts/session-close/run-deterministic.mjs --dry-run` with `OMNIPOTENT_REPO=/home/christ/ai-factory/projects/Omnipotent.md`
4. Operator acceptance: real `/session-close` + manual artifact checklist (T6)

## Previous Story Intelligence (Epic 74 — Portal unblock)

From **74-2** (`74-2-portal-oauth-login-and-provider-switch.md`):

- Portal OAuth via `hermes auth add nous --type oauth --manual-paste`
- `model.provider: nous`, `default: anthropic/claude-sonnet-4.6`
- Pre-4 FR-GATE marked `done` 2026-06-24
- **This unblocks Pre-2** — session-close LLM steps were impossible when provider resolved to `none`

From **74-8** (`91343cc`):

- `AI-Context/modules/hermes-desktop.md` created; `routing.md` reconciled
- Operator Guide §15.13 added
- Governance via session-close WriteGate path — first live run is **this story**

From **HANDOFF-2026-06-24-session2-hermes-consolidation.md**:

- Epic 74 functionally complete except **74-4** Tool Gateway (non-blocking)
- **76-1 is keystone** — restores CNS daily rhythm after consolidation

## Git Intelligence Summary

Recent `hermes-consolidation` commits (newest first):

| Commit | Summary |
|--------|---------|
| `7de7774` | Session 2 handoff — Epic 74 complete, next 76-1 |
| `91343cc` | 74-8 governance docs |
| `dd74547` | 74-7 Desktop live chat |
| `a5e36f2` | 74-2 Portal OAuth + nous provider |

Pattern: operator-first Epic 74 stories with evidence artifacts; zero protect-list diffs. Continue that pattern.

## Latest Technical Information

**Hermes on Nous Portal (June 2026):**

```yaml
# ~/.hermes/config.yaml (expected live)
model:
  provider: nous
  default: anthropic/claude-sonnet-4.6
  base_url: https://inference-api.nousresearch.com/v1
```

Session-close §8 synthesis requires a working inference provider — `nous` is now mandatory primary. After skill install changes: `hermes gateway stop && hermes gateway start`.

## Project Context Reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (v2.1.5) — dual-copy sync rule
- Hermes Consolidation PRD §2 orientation stale note [Source: `prd-hermes-consolidation.md`]
- Deferred: dashboard UX redesign, 74-4 Tool Gateway [Source: `deferred-work.md`]
- `project-context.md` in repo is **stale** (still Epic 64–66) — **76-2** updates; do not block 76-1 on it

## Story Completion Status

- **Status:** done
- **Operator decision (2026-06-24):** `epic-74: done` in sprint-status — 74-4 stays `backlog`; reopen epic-74 only if 74-4 is picked up
- **Completed 2026-06-24:** T4–T7 operator session-close — all AC pass; orientation artifacts refreshed (AGENTS §8, MEMORY, AUTO blocks)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- `.session-close/close-report.json`
- `~/.hermes/logs/session-close*.log` (if Phase A fails)
- `~/.hermes/logs/watchdog.log` (gateway)

### Completion Notes List

_(Operator fills after T5–T7)_

### File List

_(Dev/operator fills on completion)_
